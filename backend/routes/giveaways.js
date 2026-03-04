const express = require('express');
const db = require('../database/connection');
const { verifyDiscordToken } = require('./auth');

const router = express.Router({ mergeParams: true });

// Get all giveaways
router.get('/giveaways', verifyDiscordToken, (req, res) => {
    try {
        const { guildId } = req.params;
        const { status } = req.query; // active, ended, all

        let query = `
            SELECT 
                id,
                prize,
                description,
                channel_id as channelId,
                message_id as messageId,
                winner_count as winnerCount,
                required_role_id as requiredRoleId,
                required_level as requiredLevel,
                required_points as requiredPoints,
                end_time as endTime,
                ended,
                winners,
                entries_count as entriesCount,
                creator_id as creatorId,
                creator_username as creatorUsername,
                created_at as createdAt,
                ended_at as endedAt
            FROM giveaways
            WHERE guild_id = ?
        `;

        const params = [guildId];

        if (status === 'active') {
            query += ' AND ended = 0 AND end_time > datetime(\'now\')';
        } else if (status === 'ended') {
            query += ' AND (ended = 1 OR end_time <= datetime(\'now\'))';
        }

        query += ' ORDER BY created_at DESC';

        const giveaways = db.prepare(query).all(...params);

        // Parse winners JSON
        const parsed = giveaways.map(g => ({
            ...g,
            winners: g.winners ? JSON.parse(g.winners) : [],
            ended: g.ended === 1,
            isEnded: g.ended === 1 || new Date(g.endTime) <= new Date()
        }));

        res.json({ giveaways: parsed });
    } catch (error) {
        console.error('[Giveaways] Get giveaways error:', error);
        res.status(500).json({ error: 'Failed to fetch giveaways' });
    }
});

// Get single giveaway
router.get('/giveaways/:giveawayId', verifyDiscordToken, (req, res) => {
    try {
        const { guildId, giveawayId } = req.params;

        const giveaway = db.prepare(`
            SELECT 
                id,
                prize,
                description,
                channel_id as channelId,
                message_id as messageId,
                winner_count as winnerCount,
                required_role_id as requiredRoleId,
                required_level as requiredLevel,
                required_points as requiredPoints,
                bypass_role_id as bypassRoleId,
                end_time as endTime,
                ended,
                winners,
                entries_count as entriesCount,
                creator_id as creatorId,
                creator_username as creatorUsername,
                created_at as createdAt,
                ended_at as endedAt
            FROM giveaways
            WHERE id = ? AND guild_id = ?
        `).get(giveawayId, guildId);

        if (!giveaway) {
            return res.status(404).json({ error: 'Giveaway not found' });
        }

        // Get entries
        const entries = db.prepare(`
            SELECT 
                user_id as userId,
                username,
                entered_at as enteredAt
            FROM giveaway_entries
            WHERE giveaway_id = ?
            ORDER BY entered_at ASC
        `).all(giveawayId);

        res.json({
            ...giveaway,
            winners: giveaway.winners ? JSON.parse(giveaway.winners) : [],
            ended: giveaway.ended === 1,
            entries
        });
    } catch (error) {
        console.error('[Giveaways] Get giveaway error:', error);
        res.status(500).json({ error: 'Failed to fetch giveaway' });
    }
});

// Create giveaway
router.post('/giveaways', verifyDiscordToken, (req, res) => {
    try {
        const { guildId } = req.params;
        const {
            prize,
            description,
            channelId,
            winnerCount,
            requiredRoleId,
            requiredLevel,
            requiredPoints,
            bypassRoleId,
            duration // in minutes
        } = req.body;

        if (!prize || !channelId || !duration) {
            return res.status(400).json({ error: 'Prize, channelId, and duration are required' });
        }

        const endTime = new Date(Date.now() + duration * 60000).toISOString();

        const stmt = db.prepare(`
            INSERT INTO giveaways (
                guild_id, creator_id, creator_username, prize, description, 
                channel_id, winner_count, required_role_id, required_level, 
                required_points, bypass_role_id, end_time
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `);

        const result = stmt.run(
            guildId,
            req.discordUser.id,
            req.discordUser.username,
            prize,
            description || '',
            channelId,
            winnerCount || 1,
            requiredRoleId || null,
            requiredLevel || 0,
            requiredPoints || 0,
            bypassRoleId || null,
            endTime
        );

        const giveawayId = result.lastInsertRowid;

        logActivity(guildId, req.discordUser.id, 'giveaway_created', { 
            giveawayId, 
            prize,
            duration 
        });

        res.json({ 
            success: true, 
            message: 'Giveaway created',
            giveawayId,
            endTime
        });
    } catch (error) {
        console.error('[Giveaways] Create error:', error);
        res.status(500).json({ error: 'Failed to create giveaway' });
    }
});

// Update giveaway
router.patch('/giveaways/:giveawayId', verifyDiscordToken, (req, res) => {
    try {
        const { guildId, giveawayId } = req.params;
        const {
            prize,
            description,
            winnerCount,
            requiredRoleId,
            requiredLevel,
            requiredPoints,
            bypassRoleId,
            endTime
        } = req.body;

        // Check if giveaway exists and isn't ended
        const existing = db.prepare('SELECT ended FROM giveaways WHERE id = ? AND guild_id = ?')
            .get(giveawayId, guildId);

        if (!existing) {
            return res.status(404).json({ error: 'Giveaway not found' });
        }

        if (existing.ended) {
            return res.status(400).json({ error: 'Cannot edit ended giveaway' });
        }

        const stmt = db.prepare(`
            UPDATE giveaways SET
                prize = COALESCE(?, prize),
                description = COALESCE(?, description),
                winner_count = COALESCE(?, winner_count),
                required_role_id = COALESCE(?, required_role_id),
                required_level = COALESCE(?, required_level),
                required_points = COALESCE(?, required_points),
                bypass_role_id = COALESCE(?, bypass_role_id),
                end_time = COALESCE(?, end_time)
            WHERE id = ? AND guild_id = ?
        `);

        stmt.run(
            prize,
            description,
            winnerCount,
            requiredRoleId,
            requiredLevel,
            requiredPoints,
            bypassRoleId,
            endTime,
            giveawayId,
            guildId
        );

        logActivity(guildId, req.discordUser?.id, 'giveaway_updated', { giveawayId });

        res.json({ success: true, message: 'Giveaway updated' });
    } catch (error) {
        console.error('[Giveaways] Update error:', error);
        res.status(500).json({ error: 'Failed to update giveaway' });
    }
});

// End giveaway early
router.post('/giveaways/:giveawayId/end', verifyDiscordToken, (req, res) => {
    try {
        const { guildId, giveawayId } = req.params;

        db.prepare(`
            UPDATE giveaways 
            SET ended = 1, ended_at = CURRENT_TIMESTAMP
            WHERE id = ? AND guild_id = ? AND ended = 0
        `).run(giveawayId, guildId);

        logActivity(guildId, req.discordUser.id, 'giveaway_ended', { giveawayId });

        res.json({ success: true, message: 'Giveaway ended' });
    } catch (error) {
        console.error('[Giveaways] End error:', error);
        res.status(500).json({ error: 'Failed to end giveaway' });
    }
});

// Delete giveaway
router.delete('/giveaways/:giveawayId', verifyDiscordToken, (req, res) => {
    try {
        const { guildId, giveawayId } = req.params;

        db.prepare('DELETE FROM giveaways WHERE id = ? AND guild_id = ?').run(giveawayId, guildId);

        logActivity(guildId, req.discordUser.id, 'giveaway_deleted', { giveawayId });

        res.json({ success: true, message: 'Giveaway deleted' });
    } catch (error) {
        console.error('[Giveaways] Delete error:', error);
        res.status(500).json({ error: 'Failed to delete giveaway' });
    }
});

// Enter giveaway
router.post('/giveaways/:giveawayId/enter', verifyDiscordToken, (req, res) => {
    try {
        const { guildId, giveawayId } = req.params;
        const { userId, username } = req.body;

        // Check if giveaway is active
        const giveaway = db.prepare(`
            SELECT ended, end_time, required_role_id, required_level, required_points, bypass_role_id
            FROM giveaways WHERE id = ? AND guild_id = ?
        `).get(giveawayId, guildId);

        if (!giveaway) {
            return res.status(404).json({ error: 'Giveaway not found' });
        }

        if (giveaway.ended || new Date(giveaway.end_time) <= new Date()) {
            return res.status(400).json({ error: 'Giveaway has ended' });
        }

        // Check if already entered
        const existing = db.prepare(`
            SELECT 1 FROM giveaway_entries WHERE giveaway_id = ? AND user_id = ?
        `).get(giveawayId, userId);

        if (existing) {
            return res.status(400).json({ error: 'Already entered this giveaway' });
        }

        // Add entry
        const stmt = db.prepare(`
            INSERT INTO giveaway_entries (giveaway_id, user_id, username)
            VALUES (?, ?, ?)
        `);

        stmt.run(giveawayId, userId, username);

        // Update entries count
        db.prepare(`
            UPDATE giveaways 
            SET entries_count = entries_count + 1
            WHERE id = ?
        `).run(giveawayId);

        res.json({ success: true, message: 'Entered giveaway' });
    } catch (error) {
        console.error('[Giveaways] Enter error:', error);
        res.status(500).json({ error: 'Failed to enter giveaway' });
    }
});

// Leave giveaway
router.delete('/giveaways/:giveawayId/entries/:userId', verifyDiscordToken, (req, res) => {
    try {
        const { guildId, giveawayId, userId } = req.params;

        db.prepare(`
            DELETE FROM giveaway_entries WHERE giveaway_id = ? AND user_id = ?
        `).run(giveawayId, userId);

        // Update entries count
        db.prepare(`
            UPDATE giveaways 
            SET entries_count = MAX(0, entries_count - 1)
            WHERE id = ?
        `).run(giveawayId);

        res.json({ success: true, message: 'Left giveaway' });
    } catch (error) {
        console.error('[Giveaways] Leave error:', error);
        res.status(500).json({ error: 'Failed to leave giveaway' });
    }
});

// Draw winners
router.post('/giveaways/:giveawayId/draw', verifyDiscordToken, (req, res) => {
    try {
        const { guildId, giveawayId } = req.params;

        const giveaway = db.prepare(`
            SELECT winner_count, ended FROM giveaways WHERE id = ? AND guild_id = ?
        `).get(giveawayId, guildId);

        if (!giveaway) {
            return res.status(404).json({ error: 'Giveaway not found' });
        }

        // Get all entries
        const entries = db.prepare(`
            SELECT user_id as userId FROM giveaway_entries WHERE giveaway_id = ?
        `).all(giveawayId);

        if (entries.length === 0) {
            return res.status(400).json({ error: 'No entries to draw from' });
        }

        // Shuffle and pick winners
        const shuffled = [...entries].sort(() => 0.5 - Math.random());
        const winnerCount = Math.min(giveaway.winner_count, shuffled.length);
        const winners = shuffled.slice(0, winnerCount).map(e => e.userId);

        // Update giveaway
        db.prepare(`
            UPDATE giveaways 
            SET winners = ?, ended = 1, ended_at = CURRENT_TIMESTAMP
            WHERE id = ?
        `).run(JSON.stringify(winners), giveawayId);

        logActivity(guildId, req.discordUser.id, 'giveaway_drawn', { 
            giveawayId, 
            winners,
            totalEntries: entries.length
        });

        res.json({ 
            success: true, 
            message: 'Winners drawn',
            winners,
            totalEntries: entries.length
        });
    } catch (error) {
        console.error('[Giveaways] Draw error:', error);
        res.status(500).json({ error: 'Failed to draw winners' });
    }
});

// Reroll winner
router.post('/giveaways/:giveawayId/reroll', verifyDiscordToken, (req, res) => {
    try {
        const { guildId, giveawayId } = req.params;
        const { excludeWinners } = req.body;

        // Get current winners and all entries
        const giveaway = db.prepare(`
            SELECT winners FROM giveaways WHERE id = ? AND guild_id = ?
        `).get(giveawayId, guildId);

        if (!giveaway) {
            return res.status(404).json({ error: 'Giveaway not found' });
        }

        const currentWinners = giveaway.winners ? JSON.parse(giveaway.winners) : [];

        // Get eligible entries
        let entries;
        if (excludeWinners) {
            entries = db.prepare(`
                SELECT user_id as userId FROM giveaway_entries 
                WHERE giveaway_id = ? AND user_id NOT IN (${currentWinners.map(() => '?').join(',')})
            `).all(giveawayId, ...currentWinners);
        } else {
            entries = db.prepare(`
                SELECT user_id as userId FROM giveaway_entries WHERE giveaway_id = ?
            `).all(giveawayId);
        }

        if (entries.length === 0) {
            return res.status(400).json({ error: 'No eligible entries to reroll' });
        }

        // Pick new winner
        const newWinner = entries[Math.floor(Math.random() * entries.length)].userId;

        // Update winners
        const updatedWinners = excludeWinners 
            ? [...currentWinners, newWinner]
            : [newWinner, ...currentWinners.slice(1)];

        db.prepare(`
            UPDATE giveaways SET winners = ? WHERE id = ?
        `).run(JSON.stringify(updatedWinners), giveawayId);

        logActivity(guildId, req.discordUser.id, 'giveaway_rerolled', { giveawayId, newWinner });

        res.json({ 
            success: true, 
            message: 'Winner rerolled',
            newWinner
        });
    } catch (error) {
        console.error('[Giveaways] Reroll error:', error);
        res.status(500).json({ error: 'Failed to reroll winner' });
    }
});

// Update message ID (after posting to Discord)
router.patch('/giveaways/:giveawayId/message', verifyDiscordToken, (req, res) => {
    try {
        const { guildId, giveawayId } = req.params;
        const { messageId } = req.body;

        db.prepare(`
            UPDATE giveaways SET message_id = ? WHERE id = ? AND guild_id = ?
        `).run(messageId, giveawayId, guildId);

        res.json({ success: true, message: 'Message ID updated' });
    } catch (error) {
        console.error('[Giveaways] Update message error:', error);
        res.status(500).json({ error: 'Failed to update message ID' });
    }
});

function logActivity(guildId, userId, actionType, metadata) {
    try {
        const stmt = db.prepare(`
            INSERT INTO activity_logs (guild_id, user_id, action_type, metadata)
            VALUES (?, ?, ?, ?)
        `);
        stmt.run(guildId, userId, actionType, JSON.stringify(metadata));
    } catch (e) {
        console.error('[Activity Log] Error:', e);
    }
}

module.exports = router;
