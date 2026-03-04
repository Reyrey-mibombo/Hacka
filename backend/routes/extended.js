const express = require('express');
const db = require('../database/connection');
const { verifyDiscordToken } = require('./auth');

const router = express.Router({ mergeParams: true });

// ========== ECONOMY SYSTEM ==========

// Get economy config
router.get('/economy/config', verifyDiscordToken, (req, res) => {
    try {
        const { guildId } = req.params;

        const config = db.prepare(`
            SELECT 
                enabled,
                currency_name as currencyName,
                currency_symbol as currencySymbol,
                daily_amount as dailyAmount,
                work_cooldown as workCooldown,
                work_min_amount as workMinAmount,
                work_max_amount as workMaxAmount
            FROM economy_config
            WHERE guild_id = ?
        `).get(guildId);

        if (!config) {
            return res.json({
                enabled: false,
                currencyName: 'Coins',
                currencySymbol: '🪙',
                dailyAmount: 100,
                workCooldown: 3600,
                workMinAmount: 10,
                workMaxAmount: 100
            });
        }

        res.json(config);
    } catch (error) {
        console.error('[Economy] Get config error:', error);
        res.status(500).json({ error: 'Failed to fetch economy config' });
    }
});

// Update economy config
router.patch('/economy/config', verifyDiscordToken, (req, res) => {
    try {
        const { guildId } = req.params;
        const {
            enabled,
            currencyName,
            currencySymbol,
            dailyAmount,
            workCooldown,
            workMinAmount,
            workMaxAmount
        } = req.body;

        const stmt = db.prepare(`
            INSERT INTO economy_config 
            (guild_id, enabled, currency_name, currency_symbol, daily_amount, work_cooldown, work_min_amount, work_max_amount)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?)
            ON CONFLICT(guild_id) DO UPDATE SET
                enabled = excluded.enabled,
                currency_name = excluded.currency_name,
                currency_symbol = excluded.currency_symbol,
                daily_amount = excluded.daily_amount,
                work_cooldown = excluded.work_cooldown,
                work_min_amount = excluded.work_min_amount,
                work_max_amount = excluded.work_max_amount
        `);

        stmt.run(
            guildId,
            enabled ? 1 : 0,
            currencyName || 'Coins',
            currencySymbol || '🪙',
            dailyAmount || 100,
            workCooldown || 3600,
            workMinAmount || 10,
            workMaxAmount || 100
        );

        logActivity(guildId, req.discordUser?.id, 'economy_config_updated', { enabled });

        res.json({ success: true, message: 'Economy configuration updated' });
    } catch (error) {
        console.error('[Economy] Update config error:', error);
        res.status(500).json({ error: 'Failed to update economy config' });
    }
});

// Get user economy
router.get('/economy/users/:userId', verifyDiscordToken, (req, res) => {
    try {
        const { guildId, userId } = req.params;

        const economy = db.prepare(`
            SELECT 
                balance,
                bank,
                total_earned as totalEarned,
                total_spent as totalSpent,
                daily_streak as dailyStreak,
                last_daily as lastDaily,
                last_work as lastWork
            FROM user_economy
            WHERE guild_id = ? AND user_id = ?
        `).get(guildId, userId);

        if (!economy) {
            return res.json({
                balance: 0,
                bank: 0,
                totalEarned: 0,
                totalSpent: 0,
                dailyStreak: 0,
                lastDaily: null,
                lastWork: null
            });
        }

        res.json(economy);
    } catch (error) {
        console.error('[Economy] Get user error:', error);
        res.status(500).json({ error: 'Failed to fetch user economy' });
    }
});

// Get economy leaderboard
router.get('/economy/leaderboard', verifyDiscordToken, (req, res) => {
    try {
        const { guildId } = req.params;
        const limit = parseInt(req.query.limit) || 10;

        const leaderboard = db.prepare(`
            SELECT 
                ue.user_id as userId,
                ue.username,
                ue.balance,
                ue.bank,
                (ue.balance + ue.bank) as total,
                ue.total_earned as totalEarned,
                RANK() OVER (ORDER BY (ue.balance + ue.bank) DESC) as rank
            FROM user_economy ue
            WHERE ue.guild_id = ?
            ORDER BY total DESC
            LIMIT ?
        `).all(guildId, limit);

        res.json({ leaderboard });
    } catch (error) {
        console.error('[Economy] Leaderboard error:', error);
        res.status(500).json({ error: 'Failed to fetch economy leaderboard' });
    }
});

// Add/remove balance
router.post('/economy/users/:userId/balance', verifyDiscordToken, (req, res) => {
    try {
        const { guildId, userId } = req.params;
        const { amount, reason } = req.body;

        if (!amount) {
            return res.status(400).json({ error: 'Amount is required' });
        }

        // Get or create user economy
        let economy = db.prepare('SELECT * FROM user_economy WHERE guild_id = ? AND user_id = ?')
            .get(guildId, userId);

        if (!economy) {
            db.prepare(`
                INSERT INTO user_economy (guild_id, user_id, balance, total_earned)
                VALUES (?, ?, 0, 0)
            `).run(guildId, userId);
            economy = { balance: 0, total_earned: 0 };
        }

        const newBalance = economy.balance + amount;
        if (newBalance < 0) {
            return res.status(400).json({ error: 'Insufficient balance' });
        }

        db.prepare(`
            UPDATE user_economy 
            SET balance = ?, 
                total_earned = CASE WHEN ? > 0 THEN total_earned + ? ELSE total_earned END,
                total_spent = CASE WHEN ? < 0 THEN total_spent + ABS(?) ELSE total_spent END,
                updated_at = CURRENT_TIMESTAMP
            WHERE guild_id = ? AND user_id = ?
        `).run(newBalance, amount, amount, amount, amount, guildId, userId);

        logActivity(guildId, req.discordUser?.id, amount > 0 ? 'balance_added' : 'balance_removed', { 
            targetUserId: userId, 
            amount, 
            reason 
        });

        res.json({ 
            success: true, 
            message: `Balance ${amount > 0 ? 'added' : 'removed'}`,
            newBalance
        });
    } catch (error) {
        console.error('[Economy] Update balance error:', error);
        res.status(500).json({ error: 'Failed to update balance' });
    }
});

// ========== SHOP SYSTEM ==========

// Get shop items
router.get('/economy/shop', verifyDiscordToken, (req, res) => {
    try {
        const { guildId } = req.params;

        const items = db.prepare(`
            SELECT 
                id,
                name,
                description,
                price,
                role_id as roleId,
                stock,
                available,
                created_at as createdAt
            FROM shop_items
            WHERE guild_id = ?
            ORDER BY price ASC
        `).all(guildId);

        res.json({ items });
    } catch (error) {
        console.error('[Economy] Get shop error:', error);
        res.status(500).json({ error: 'Failed to fetch shop items' });
    }
});

// Add shop item
router.post('/economy/shop', verifyDiscordToken, (req, res) => {
    try {
        const { guildId } = req.params;
        const { name, description, price, roleId, stock } = req.body;

        if (!name || !price) {
            return res.status(400).json({ error: 'Name and price are required' });
        }

        const stmt = db.prepare(`
            INSERT INTO shop_items (guild_id, name, description, price, role_id, stock)
            VALUES (?, ?, ?, ?, ?, ?)
        `);

        const result = stmt.run(guildId, name, description || '', price, roleId || null, stock || -1);

        logActivity(guildId, req.discordUser?.id, 'shop_item_created', { itemId: result.lastInsertRowid, name, price });

        res.json({ 
            success: true, 
            message: 'Shop item created',
            itemId: result.lastInsertRowid
        });
    } catch (error) {
        console.error('[Economy] Create shop item error:', error);
        res.status(500).json({ error: 'Failed to create shop item' });
    }
});

// Update shop item
router.patch('/economy/shop/:itemId', verifyDiscordToken, (req, res) => {
    try {
        const { guildId, itemId } = req.params;
        const { name, description, price, roleId, stock, available } = req.body;

        const stmt = db.prepare(`
            UPDATE shop_items SET
                name = COALESCE(?, name),
                description = COALESCE(?, description),
                price = COALESCE(?, price),
                role_id = COALESCE(?, role_id),
                stock = COALESCE(?, stock),
                available = COALESCE(?, available)
            WHERE id = ? AND guild_id = ?
        `);

        stmt.run(name, description, price, roleId, stock, available !== undefined ? (available ? 1 : 0) : undefined, itemId, guildId);

        logActivity(guildId, req.discordUser?.id, 'shop_item_updated', { itemId });

        res.json({ success: true, message: 'Shop item updated' });
    } catch (error) {
        console.error('[Economy] Update shop item error:', error);
        res.status(500).json({ error: 'Failed to update shop item' });
    }
});

// Delete shop item
router.delete('/economy/shop/:itemId', verifyDiscordToken, (req, res) => {
    try {
        const { guildId, itemId } = req.params;

        db.prepare('DELETE FROM shop_items WHERE id = ? AND guild_id = ?').run(itemId, guildId);

        logActivity(guildId, req.discordUser?.id, 'shop_item_deleted', { itemId });

        res.json({ success: true, message: 'Shop item deleted' });
    } catch (error) {
        console.error('[Economy] Delete shop item error:', error);
        res.status(500).json({ error: 'Failed to delete shop item' });
    }
});

// ========== AUTOMOD RULES ==========

// Get automod rules
router.get('/automod/rules', verifyDiscordToken, (req, res) => {
    try {
        const { guildId } = req.params;

        const rules = db.prepare(`
            SELECT 
                id,
                name,
                rule_type as ruleType,
                enabled,
                action,
                duration,
                threshold,
                whitelist_channels as whitelistChannels,
                whitelist_roles as whitelistRoles,
                blacklist_content as blacklistContent,
                created_at as createdAt
            FROM automod_rules
            WHERE guild_id = ?
            ORDER BY created_at DESC
        `).all(guildId);

        // Parse JSON fields
        const parsed = rules.map(rule => ({
            ...rule,
            whitelistChannels: rule.whitelistChannels ? JSON.parse(rule.whitelistChannels) : [],
            whitelistRoles: rule.whitelistRoles ? JSON.parse(rule.whitelistRoles) : [],
            blacklistContent: rule.blacklistContent ? JSON.parse(rule.blacklistContent) : []
        }));

        res.json({ rules: parsed });
    } catch (error) {
        console.error('[Automod] Get rules error:', error);
        res.status(500).json({ error: 'Failed to fetch automod rules' });
    }
});

// Create automod rule
router.post('/automod/rules', verifyDiscordToken, (req, res) => {
    try {
        const { guildId } = req.params;
        const {
            name,
            ruleType,
            action,
            duration,
            threshold,
            whitelistChannels,
            whitelistRoles,
            blacklistContent
        } = req.body;

        if (!name || !ruleType) {
            return res.status(400).json({ error: 'Name and ruleType are required' });
        }

        const stmt = db.prepare(`
            INSERT INTO automod_rules 
            (guild_id, name, rule_type, action, duration, threshold, whitelist_channels, whitelist_roles, blacklist_content)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
        `);

        const result = stmt.run(
            guildId,
            name,
            ruleType,
            action || 'warn',
            duration || null,
            threshold || null,
            JSON.stringify(whitelistChannels || []),
            JSON.stringify(whitelistRoles || []),
            JSON.stringify(blacklistContent || [])
        );

        logActivity(guildId, req.discordUser?.id, 'automod_rule_created', { 
            ruleId: result.lastInsertRowid, 
            name,
            ruleType 
        });

        res.json({ 
            success: true, 
            message: 'Automod rule created',
            ruleId: result.lastInsertRowid
        });
    } catch (error) {
        console.error('[Automod] Create rule error:', error);
        res.status(500).json({ error: 'Failed to create automod rule' });
    }
});

// Update automod rule
router.patch('/automod/rules/:ruleId', verifyDiscordToken, (req, res) => {
    try {
        const { guildId, ruleId } = req.params;
        const updates = req.body;

        const stmt = db.prepare(`
            UPDATE automod_rules SET
                name = COALESCE(?, name),
                enabled = COALESCE(?, enabled),
                action = COALESCE(?, action),
                duration = COALESCE(?, duration),
                threshold = COALESCE(?, threshold),
                whitelist_channels = COALESCE(?, whitelist_channels),
                whitelist_roles = COALESCE(?, whitelist_roles),
                blacklist_content = COALESCE(?, blacklist_content),
                updated_at = CURRENT_TIMESTAMP
            WHERE id = ? AND guild_id = ?
        `);

        stmt.run(
            updates.name,
            updates.enabled !== undefined ? (updates.enabled ? 1 : 0) : undefined,
            updates.action,
            updates.duration,
            updates.threshold,
            updates.whitelistChannels !== undefined ? JSON.stringify(updates.whitelistChannels) : undefined,
            updates.whitelistRoles !== undefined ? JSON.stringify(updates.whitelistRoles) : undefined,
            updates.blacklistContent !== undefined ? JSON.stringify(updates.blacklistContent) : undefined,
            ruleId,
            guildId
        );

        logActivity(guildId, req.discordUser?.id, 'automod_rule_updated', { ruleId });

        res.json({ success: true, message: 'Automod rule updated' });
    } catch (error) {
        console.error('[Automod] Update rule error:', error);
        res.status(500).json({ error: 'Failed to update automod rule' });
    }
});

// Delete automod rule
router.delete('/automod/rules/:ruleId', verifyDiscordToken, (req, res) => {
    try {
        const { guildId, ruleId } = req.params;

        db.prepare('DELETE FROM automod_rules WHERE id = ? AND guild_id = ?').run(ruleId, guildId);

        logActivity(guildId, req.discordUser?.id, 'automod_rule_deleted', { ruleId });

        res.json({ success: true, message: 'Automod rule deleted' });
    } catch (error) {
        console.error('[Automod] Delete rule error:', error);
        res.status(500).json({ error: 'Failed to delete automod rule' });
    }
});

// ========== VOICE TRACKING ==========

// Get voice session stats
router.get('/voice/stats', verifyDiscordToken, (req, res) => {
    try {
        const { guildId } = req.params;
        const days = parseInt(req.query.days) || 7;
        const startDate = new Date();
        startDate.setDate(startDate.getDate() - days);

        const stats = db.prepare(`
            SELECT 
                COUNT(*) as totalSessions,
                SUM(duration_minutes) as totalMinutes,
                AVG(duration_minutes) as avgMinutes,
                COUNT(DISTINCT user_id) as uniqueUsers
            FROM voice_sessions
            WHERE guild_id = ? AND joined_at >= ?
        `).get(guildId, startDate.toISOString());

        const topUsers = db.prepare(`
            SELECT 
                user_id as userId,
                username,
                SUM(duration_minutes) as totalMinutes,
                COUNT(*) as sessionCount
            FROM voice_sessions
            WHERE guild_id = ? AND joined_at >= ?
            GROUP BY user_id
            ORDER BY totalMinutes DESC
            LIMIT 10
        `).all(guildId, startDate.toISOString());

        const topChannels = db.prepare(`
            SELECT 
                channel_id as channelId,
                SUM(duration_minutes) as totalMinutes,
                COUNT(DISTINCT user_id) as uniqueUsers
            FROM voice_sessions
            WHERE guild_id = ? AND joined_at >= ?
            GROUP BY channel_id
            ORDER BY totalMinutes DESC
            LIMIT 10
        `).all(guildId, startDate.toISOString());

        res.json({
            summary: {
                totalSessions: stats?.totalSessions || 0,
                totalHours: Math.round((stats?.totalMinutes || 0) / 60 * 10) / 10,
                avgMinutes: Math.round(stats?.avgMinutes || 0),
                uniqueUsers: stats?.uniqueUsers || 0
            },
            topUsers,
            topChannels
        });
    } catch (error) {
        console.error('[Voice] Stats error:', error);
        res.status(500).json({ error: 'Failed to fetch voice stats' });
    }
});

// Get active voice sessions
router.get('/voice/sessions', verifyDiscordToken, (req, res) => {
    try {
        const { guildId } = req.params;

        const sessions = db.prepare(`
            SELECT 
                id,
                user_id as userId,
                username,
                channel_id as channelId,
                joined_at as joinedAt,
                (julianday('now') - julianday(joined_at)) * 24 * 60 as currentDuration
            FROM voice_sessions
            WHERE guild_id = ? AND left_at IS NULL
            ORDER BY joined_at ASC
        `).all(guildId);

        res.json({ sessions });
    } catch (error) {
        console.error('[Voice] Sessions error:', error);
        res.status(500).json({ error: 'Failed to fetch voice sessions' });
    }
});

// Start voice session (called by bot)
router.post('/voice/sessions', verifyDiscordToken, (req, res) => {
    try {
        const { guildId } = req.params;
        const { userId, username, channelId } = req.body;

        const stmt = db.prepare(`
            INSERT INTO voice_sessions (guild_id, user_id, username, channel_id, joined_at)
            VALUES (?, ?, ?, ?, datetime('now'))
        `);

        const result = stmt.run(guildId, userId, username, channelId);

        res.json({ 
            success: true, 
            sessionId: result.lastInsertRowid 
        });
    } catch (error) {
        console.error('[Voice] Start session error:', error);
        res.status(500).json({ error: 'Failed to start voice session' });
    }
});

// End voice session (called by bot)
router.patch('/voice/sessions/:sessionId', verifyDiscordToken, (req, res) => {
    try {
        const { guildId, sessionId } = req.params;

        db.prepare(`
            UPDATE voice_sessions 
            SET left_at = datetime('now'),
                duration_minutes = (julianday('now') - julianday(joined_at)) * 24 * 60
            WHERE id = ? AND guild_id = ? AND left_at IS NULL
        `).run(sessionId, guildId);

        res.json({ success: true, message: 'Voice session ended' });
    } catch (error) {
        console.error('[Voice] End session error:', error);
        res.status(500).json({ error: 'Failed to end voice session' });
    }
});

// ========== SERVER SETTINGS ==========

// Get extended server settings
router.get('/settings/extended', verifyDiscordToken, (req, res) => {
    try {
        const { guildId } = req.params;

        const settings = db.prepare(`
            SELECT 
                prefix,
                language,
                timezone,
                embed_color as embedColor,
                premium_until as premiumUntil,
                backup_enabled as backupEnabled,
                backup_channel_id as backupChannelId,
                mute_role_id as muteRoleId,
                quarantine_role_id as quarantineRoleId,
                verified_role_id as verifiedRoleId,
                verification_enabled as verificationEnabled,
                verification_channel_id as verificationChannelId,
                verification_message as verificationMessage
            FROM server_settings
            WHERE guild_id = ?
        `).get(guildId);

        if (!settings) {
            return res.json({
                prefix: '!',
                language: 'en',
                timezone: 'UTC',
                embedColor: '#6c63ff',
                backupEnabled: false,
                verificationEnabled: false
            });
        }

        res.json(settings);
    } catch (error) {
        console.error('[Settings] Get extended settings error:', error);
        res.status(500).json({ error: 'Failed to fetch extended settings' });
    }
});

// Update extended server settings
router.patch('/settings/extended', verifyDiscordToken, (req, res) => {
    try {
        const { guildId } = req.params;
        const updates = req.body;

        const stmt = db.prepare(`
            INSERT INTO server_settings (
                guild_id, prefix, language, timezone, embed_color, 
                backup_enabled, backup_channel_id, mute_role_id, quarantine_role_id,
                verified_role_id, verification_enabled, verification_channel_id, verification_message
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            ON CONFLICT(guild_id) DO UPDATE SET
                prefix = COALESCE(excluded.prefix, prefix),
                language = COALESCE(excluded.language, language),
                timezone = COALESCE(excluded.timezone, timezone),
                embed_color = COALESCE(excluded.embed_color, embed_color),
                backup_enabled = COALESCE(excluded.backup_enabled, backup_enabled),
                backup_channel_id = COALESCE(excluded.backup_channel_id, backup_channel_id),
                mute_role_id = COALESCE(excluded.mute_role_id, mute_role_id),
                quarantine_role_id = COALESCE(excluded.quarantine_role_id, quarantine_role_id),
                verified_role_id = COALESCE(excluded.verified_role_id, verified_role_id),
                verification_enabled = COALESCE(excluded.verification_enabled, verification_enabled),
                verification_channel_id = COALESCE(excluded.verification_channel_id, verification_channel_id),
                verification_message = COALESCE(excluded.verification_message, verification_message),
                updated_at = CURRENT_TIMESTAMP
        `);

        stmt.run(
            guildId,
            updates.prefix,
            updates.language,
            updates.timezone,
            updates.embedColor,
            updates.backupEnabled !== undefined ? (updates.backupEnabled ? 1 : 0) : undefined,
            updates.backupChannelId,
            updates.muteRoleId,
            updates.quarantineRoleId,
            updates.verifiedRoleId,
            updates.verificationEnabled !== undefined ? (updates.verificationEnabled ? 1 : 0) : undefined,
            updates.verificationChannelId,
            updates.verificationMessage
        );

        logActivity(guildId, req.discordUser?.id, 'server_settings_updated', { fields: Object.keys(updates) });

        res.json({ success: true, message: 'Settings updated' });
    } catch (error) {
        console.error('[Settings] Update extended settings error:', error);
        res.status(500).json({ error: 'Failed to update settings' });
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
