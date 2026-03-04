const express = require('express');
const db = require('../database/connection');
const { verifyDiscordToken } = require('./auth');

const router = express.Router({ mergeParams: true });

// Get leveling configuration
router.get('/leveling/config', verifyDiscordToken, (req, res) => {
    try {
        const { guildId } = req.params;
        
        const config = db.prepare(`
            SELECT 
                enabled,
                xp_rate as xpRate,
                xp_cooldown as xpCooldown,
                max_xp_per_message as maxXpPerMessage,
                min_xp_per_message as minXpPerMessage,
                level_up_channel_id as levelUpChannelId,
                level_up_message as levelUpMessage,
                dm_on_level_up as dmOnLevelUp,
                stack_roles as stackRoles,
                ignored_channels as ignoredChannels,
                ignored_roles as ignoredRoles
            FROM leveling_config
            WHERE guild_id = ?
        `).get(guildId);

        if (!config) {
            // Return default config
            return res.json({
                enabled: true,
                xpRate: 1,
                xpCooldown: 60,
                maxXpPerMessage: 25,
                minXpPerMessage: 15,
                levelUpChannelId: '',
                levelUpMessage: 'Congratulations {user}, you reached level {level}!',
                dmOnLevelUp: false,
                stackRoles: true,
                ignoredChannels: [],
                ignoredRoles: []
            });
        }

        res.json({
            ...config,
            ignoredChannels: config.ignoredChannels ? JSON.parse(config.ignoredChannels) : [],
            ignoredRoles: config.ignoredRoles ? JSON.parse(config.ignoredRoles) : []
        });
    } catch (error) {
        console.error('[Leveling] Get config error:', error);
        res.status(500).json({ error: 'Failed to fetch leveling config' });
    }
});

// Update leveling configuration
router.patch('/leveling/config', verifyDiscordToken, (req, res) => {
    try {
        const { guildId } = req.params;
        const {
            enabled,
            xpRate,
            xpCooldown,
            maxXpPerMessage,
            minXpPerMessage,
            levelUpChannelId,
            levelUpMessage,
            dmOnLevelUp,
            stackRoles,
            ignoredChannels,
            ignoredRoles
        } = req.body;

        const stmt = db.prepare(`
            INSERT INTO leveling_config (
                guild_id, enabled, xp_rate, xp_cooldown, max_xp_per_message, min_xp_per_message,
                level_up_channel_id, level_up_message, dm_on_level_up, stack_roles, 
                ignored_channels, ignored_roles
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            ON CONFLICT(guild_id) DO UPDATE SET
                enabled = excluded.enabled,
                xp_rate = excluded.xp_rate,
                xp_cooldown = excluded.xp_cooldown,
                max_xp_per_message = excluded.max_xp_per_message,
                min_xp_per_message = excluded.min_xp_per_message,
                level_up_channel_id = excluded.level_up_channel_id,
                level_up_message = excluded.level_up_message,
                dm_on_level_up = excluded.dm_on_level_up,
                stack_roles = excluded.stack_roles,
                ignored_channels = excluded.ignored_channels,
                ignored_roles = excluded.ignored_roles,
                updated_at = CURRENT_TIMESTAMP
        `);

        stmt.run(
            guildId,
            enabled !== undefined ? (enabled ? 1 : 0) : 1,
            xpRate || 1,
            xpCooldown || 60,
            maxXpPerMessage || 25,
            minXpPerMessage || 15,
            levelUpChannelId || '',
            levelUpMessage || 'Congratulations {user}, you reached level {level}!',
            dmOnLevelUp ? 1 : 0,
            stackRoles !== undefined ? (stackRoles ? 1 : 0) : 1,
            JSON.stringify(ignoredChannels || []),
            JSON.stringify(ignoredRoles || [])
        );

        logActivity(guildId, req.discordUser?.id, 'leveling_config_updated', { enabled });

        res.json({ success: true, message: 'Leveling configuration updated' });
    } catch (error) {
        console.error('[Leveling] Update config error:', error);
        res.status(500).json({ error: 'Failed to update leveling config' });
    }
});

// Get level roles
router.get('/leveling/roles', verifyDiscordToken, (req, res) => {
    try {
        const { guildId } = req.params;
        
        const roles = db.prepare(`
            SELECT 
                id,
                level,
                role_id as roleId,
                remove_previous as removePrevious
            FROM level_roles
            WHERE guild_id = ?
            ORDER BY level ASC
        `).all(guildId);

        res.json({ roles });
    } catch (error) {
        console.error('[Leveling] Get roles error:', error);
        res.status(500).json({ error: 'Failed to fetch level roles' });
    }
});

// Add/update level role
router.post('/leveling/roles', verifyDiscordToken, (req, res) => {
    try {
        const { guildId } = req.params;
        const { level, roleId, removePrevious } = req.body;

        if (!level || !roleId) {
            return res.status(400).json({ error: 'Level and roleId are required' });
        }

        const stmt = db.prepare(`
            INSERT INTO level_roles (guild_id, level, role_id, remove_previous)
            VALUES (?, ?, ?, ?)
            ON CONFLICT(guild_id, level) DO UPDATE SET
                role_id = excluded.role_id,
                remove_previous = excluded.remove_previous
        `);

        stmt.run(guildId, level, roleId, removePrevious ? 1 : 0);

        logActivity(guildId, req.discordUser?.id, 'level_role_updated', { level, roleId });

        res.json({ success: true, message: 'Level role updated' });
    } catch (error) {
        console.error('[Leveling] Add role error:', error);
        res.status(500).json({ error: 'Failed to add level role' });
    }
});

// Delete level role
router.delete('/leveling/roles/:roleId', verifyDiscordToken, (req, res) => {
    try {
        const { guildId, roleId } = req.params;

        db.prepare('DELETE FROM level_roles WHERE id = ? AND guild_id = ?').run(roleId, guildId);

        logActivity(guildId, req.discordUser?.id, 'level_role_deleted', { roleId });

        res.json({ success: true, message: 'Level role deleted' });
    } catch (error) {
        console.error('[Leveling] Delete role error:', error);
        res.status(500).json({ error: 'Failed to delete level role' });
    }
});

// Get leaderboard
router.get('/leveling/leaderboard', verifyDiscordToken, (req, res) => {
    try {
        const { guildId } = req.params;
        const limit = parseInt(req.query.limit) || 100;
        
        const leaderboard = db.prepare(`
            SELECT 
                user_id as id,
                username,
                level,
                xp,
                total_messages as totalMessages,
                total_voice_minutes as totalVoiceMinutes,
                RANK() OVER (ORDER BY level DESC, xp DESC) as rank
            FROM user_levels
            WHERE guild_id = ?
            ORDER BY level DESC, xp DESC
            LIMIT ?
        `).all(guildId, limit);

        res.json({ leaderboard });
    } catch (error) {
        console.error('[Leveling] Leaderboard error:', error);
        res.status(500).json({ error: 'Failed to fetch leaderboard' });
    }
});

// Get user level
router.get('/leveling/users/:userId', verifyDiscordToken, (req, res) => {
    try {
        const { guildId, userId } = req.params;
        
        const userLevel = db.prepare(`
            SELECT 
                user_id as id,
                username,
                level,
                xp,
                total_messages as totalMessages,
                total_voice_minutes as totalVoiceMinutes,
                last_xp_gain as lastXpGain,
                created_at as joinedAt
            FROM user_levels
            WHERE guild_id = ? AND user_id = ?
        `).get(guildId, userId);

        if (!userLevel) {
            return res.status(404).json({ error: 'User level data not found' });
        }

        // Calculate XP needed for next level (formula: level^2 * 100)
        const xpNeeded = Math.pow(userLevel.level + 1, 2) * 100;
        const xpForCurrentLevel = Math.pow(userLevel.level, 2) * 100;
        const xpProgress = userLevel.xp - xpForCurrentLevel;
        const xpRequired = xpNeeded - xpForCurrentLevel;
        const progressPercent = Math.min(100, Math.round((xpProgress / xpRequired) * 100));

        // Get rank
        const rankData = db.prepare(`
            SELECT COUNT(*) as rank
            FROM user_levels
            WHERE guild_id = ? AND (level > ? OR (level = ? AND xp > ?))
        `).get(guildId, userLevel.level, userLevel.level, userLevel.xp);

        res.json({
            ...userLevel,
            rank: (rankData?.rank || 0) + 1,
            xpNeeded,
            xpProgress,
            xpRequired,
            progressPercent
        });
    } catch (error) {
        console.error('[Leveling] Get user error:', error);
        res.status(500).json({ error: 'Failed to fetch user level' });
    }
});

// Get level rewards
router.get('/leveling/rewards', verifyDiscordToken, (req, res) => {
    try {
        const { guildId } = req.params;
        
        const rewards = db.prepare(`
            SELECT 
                id,
                name,
                description,
                level_required as levelRequired,
                reward_type as rewardType,
                reward_value as rewardValue
            FROM level_rewards
            WHERE guild_id = ?
            ORDER BY level_required ASC
        `).all(guildId);

        res.json({ rewards });
    } catch (error) {
        console.error('[Leveling] Get rewards error:', error);
        res.status(500).json({ error: 'Failed to fetch level rewards' });
    }
});

// Add level reward
router.post('/leveling/rewards', verifyDiscordToken, (req, res) => {
    try {
        const { guildId } = req.params;
        const { name, description, levelRequired, rewardType, rewardValue } = req.body;

        if (!name || !levelRequired) {
            return res.status(400).json({ error: 'Name and levelRequired are required' });
        }

        const stmt = db.prepare(`
            INSERT INTO level_rewards (guild_id, name, description, level_required, reward_type, reward_value)
            VALUES (?, ?, ?, ?, ?, ?)
        `);

        const result = stmt.run(guildId, name, description || '', levelRequired, rewardType || '', rewardValue || '');

        logActivity(guildId, req.discordUser?.id, 'level_reward_created', { name, levelRequired });

        res.json({ 
            success: true, 
            message: 'Level reward created',
            rewardId: result.lastInsertRowid
        });
    } catch (error) {
        console.error('[Leveling] Add reward error:', error);
        res.status(500).json({ error: 'Failed to add level reward' });
    }
});

// Delete level reward
router.delete('/leveling/rewards/:rewardId', verifyDiscordToken, (req, res) => {
    try {
        const { guildId, rewardId } = req.params;

        db.prepare('DELETE FROM level_rewards WHERE id = ? AND guild_id = ?').run(rewardId, guildId);

        logActivity(guildId, req.discordUser?.id, 'level_reward_deleted', { rewardId });

        res.json({ success: true, message: 'Level reward deleted' });
    } catch (error) {
        console.error('[Leveling] Delete reward error:', error);
        res.status(500).json({ error: 'Failed to delete level reward' });
    }
});

// Reset user XP/level
router.post('/leveling/users/:userId/reset', verifyDiscordToken, (req, res) => {
    try {
        const { guildId, userId } = req.params;

        db.prepare(`
            UPDATE user_levels 
            SET xp = 0, level = 1, total_messages = 0, total_voice_minutes = 0
            WHERE guild_id = ? AND user_id = ?
        `).run(guildId, userId);

        logActivity(guildId, req.discordUser?.id, 'user_level_reset', { targetUserId: userId });

        res.json({ success: true, message: 'User level reset' });
    } catch (error) {
        console.error('[Leveling] Reset user error:', error);
        res.status(500).json({ error: 'Failed to reset user level' });
    }
});

// Add XP to user
router.post('/leveling/users/:userId/add-xp', verifyDiscordToken, (req, res) => {
    try {
        const { guildId, userId } = req.params;
        const { amount, reason } = req.body;

        if (!amount || amount <= 0) {
            return res.status(400).json({ error: 'Valid amount is required' });
        }

        const userLevel = db.prepare('SELECT * FROM user_levels WHERE guild_id = ? AND user_id = ?').get(guildId, userId);

        if (!userLevel) {
            return res.status(404).json({ error: 'User not found' });
        }

        const newXp = userLevel.xp + amount;
        let newLevel = userLevel.level;

        // Check for level up
        const xpNeeded = Math.pow(newLevel + 1, 2) * 100;
        if (newXp >= xpNeeded) {
            newLevel++;
        }

        db.prepare(`
            UPDATE user_levels 
            SET xp = ?, level = ?, updated_at = CURRENT_TIMESTAMP
            WHERE guild_id = ? AND user_id = ?
        `).run(newXp, newLevel, guildId, userId);

        logActivity(guildId, req.discordUser?.id, 'xp_added', { 
            targetUserId: userId, 
            amount, 
            reason,
            leveledUp: newLevel > userLevel.level
        });

        res.json({ 
            success: true, 
            message: 'XP added',
            newXp,
            newLevel,
            leveledUp: newLevel > userLevel.level
        });
    } catch (error) {
        console.error('[Leveling] Add XP error:', error);
        res.status(500).json({ error: 'Failed to add XP' });
    }
});

// Import XP from CSV/JSON
router.post('/leveling/import', verifyDiscordToken, (req, res) => {
    try {
        const { guildId } = req.params;
        const { users } = req.body; // Array of { userId, username, xp, level }

        if (!Array.isArray(users) || users.length === 0) {
            return res.status(400).json({ error: 'Users array is required' });
        }

        const insertStmt = db.prepare(`
            INSERT INTO user_levels (guild_id, user_id, username, xp, level, last_xp_gain)
            VALUES (?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
            ON CONFLICT(guild_id, user_id) DO UPDATE SET
                xp = excluded.xp,
                level = excluded.level,
                username = excluded.username,
                updated_at = CURRENT_TIMESTAMP
        `);

        const insertMany = db.transaction((users) => {
            for (const user of users) {
                insertStmt.run(guildId, user.userId, user.username, user.xp || 0, user.level || 1);
            }
        });

        insertMany(users);

        logActivity(guildId, req.discordUser?.id, 'leveling_data_imported', { count: users.length });

        res.json({ 
            success: true, 
            message: `Imported ${users.length} users`,
            imported: users.length
        });
    } catch (error) {
        console.error('[Leveling] Import error:', error);
        res.status(500).json({ error: 'Failed to import leveling data' });
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
