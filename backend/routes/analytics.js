const express = require('express');
const db = require('../database/connection');
const { verifyDiscordToken } = require('./auth');

const router = express.Router({ mergeParams: true });

// Get server overview stats
router.get('/analytics/overview', verifyDiscordToken, (req, res) => {
    try {
        const { guildId } = req.params;
        const days = parseInt(req.query.days) || 30;
        const startDate = new Date();
        startDate.setDate(startDate.getDate() - days);

        // Member stats
        const memberStats = db.prepare(`
            SELECT 
                COUNT(*) as totalMembers,
                SUM(CASE WHEN is_staff = 1 THEN 1 ELSE 0 END) as staffCount,
                SUM(CASE WHEN is_admin = 1 THEN 1 ELSE 0 END) as adminCount
            FROM guild_members
            WHERE guild_id = ?
        `).get(guildId);

        // Activity stats
        const activityStats = db.prepare(`
            SELECT 
                SUM(message_count) as totalMessages,
                SUM(member_joins) as totalJoins,
                SUM(member_leaves) as totalLeaves,
                SUM(voice_minutes) as totalVoiceMinutes,
                SUM(commands_used) as totalCommands
            FROM daily_stats
            WHERE guild_id = ? AND date >= ?
        `).get(guildId, startDate.toISOString().split('T')[0]);

        // Moderation stats
        const modStats = db.prepare(`
            SELECT 
                COUNT(*) as totalActions,
                SUM(CASE WHEN action_type = 'ban' THEN 1 ELSE 0 END) as bans,
                SUM(CASE WHEN action_type = 'kick' THEN 1 ELSE 0 END) as kicks,
                SUM(CASE WHEN action_type = 'timeout' THEN 1 ELSE 0 END) as timeouts,
                SUM(CASE WHEN action_type = 'warn' THEN 1 ELSE 0 END) as warnings
            FROM moderation_actions
            WHERE guild_id = ? AND created_at >= ?
        `).get(guildId, startDate.toISOString());

        // Recent activity trend
        const dailyTrend = db.prepare(`
            SELECT 
                date,
                message_count as messages,
                member_joins as joins,
                member_leaves as leaves,
                active_members as activeMembers
            FROM daily_stats
            WHERE guild_id = ? AND date >= ?
            ORDER BY date ASC
        `).all(guildId, startDate.toISOString().split('T')[0]);

        res.json({
            members: {
                total: memberStats?.totalMembers || 0,
                staff: memberStats?.staffCount || 0,
                admins: memberStats?.adminCount || 0
            },
            activity: {
                messages: activityStats?.totalMessages || 0,
                joins: activityStats?.totalJoins || 0,
                leaves: activityStats?.totalLeaves || 0,
                voiceMinutes: activityStats?.totalVoiceMinutes || 0,
                commands: activityStats?.totalCommands || 0
            },
            moderation: {
                total: modStats?.totalActions || 0,
                bans: modStats?.bans || 0,
                kicks: modStats?.kicks || 0,
                timeouts: modStats?.timeouts || 0,
                warnings: modStats?.warnings || 0
            },
            trend: dailyTrend
        });
    } catch (error) {
        console.error('[Analytics] Overview error:', error);
        res.status(500).json({ error: 'Failed to fetch analytics overview' });
    }
});

// Get daily stats
router.get('/analytics/daily', verifyDiscordToken, (req, res) => {
    try {
        const { guildId } = req.params;
        const days = parseInt(req.query.days) || 30;
        const startDate = new Date();
        startDate.setDate(startDate.getDate() - days);

        const stats = db.prepare(`
            SELECT 
                date,
                message_count as messageCount,
                member_joins as memberJoins,
                member_leaves as memberLeaves,
                voice_minutes as voiceMinutes,
                active_members as activeMembers,
                new_members as newMembers,
                commands_used as commandsUsed
            FROM daily_stats
            WHERE guild_id = ? AND date >= ?
            ORDER BY date DESC
        `).all(guildId, startDate.toISOString().split('T')[0]);

        res.json({ stats });
    } catch (error) {
        console.error('[Analytics] Daily stats error:', error);
        res.status(500).json({ error: 'Failed to fetch daily stats' });
    }
});

// Get hourly activity heatmap
router.get('/analytics/heatmap', verifyDiscordToken, (req, res) => {
    try {
        const { guildId } = req.params;
        const days = parseInt(req.query.days) || 7;
        const startDate = new Date();
        startDate.setDate(startDate.getDate() - days);

        const stats = db.prepare(`
            SELECT 
                strftime('%H', hour) as hourOfDay,
                AVG(message_count) as avgMessages,
                AVG(voice_minutes) as avgVoiceMinutes
            FROM hourly_stats
            WHERE guild_id = ? AND hour >= datetime(?)
            GROUP BY hourOfDay
            ORDER BY hourOfDay
        `).all(guildId, startDate.toISOString());

        // Format as 24-hour array
        const heatmap = Array(24).fill(0).map((_, i) => ({
            hour: i,
            messages: 0,
            voiceMinutes: 0
        }));

        for (const stat of stats) {
            const hour = parseInt(stat.hourOfDay);
            if (heatmap[hour]) {
                heatmap[hour].messages = Math.round(stat.avgMessages || 0);
                heatmap[hour].voiceMinutes = Math.round(stat.avgVoiceMinutes || 0);
            }
        }

        res.json({ heatmap });
    } catch (error) {
        console.error('[Analytics] Heatmap error:', error);
        res.status(500).json({ error: 'Failed to fetch heatmap' });
    }
});

// Get member activity
router.get('/analytics/members', verifyDiscordToken, (req, res) => {
    try {
        const { guildId } = req.params;
        const days = parseInt(req.query.days) || 7;
        const startDate = new Date();
        startDate.setDate(startDate.getDate() - days);

        const activity = db.prepare(`
            SELECT 
                user_id as userId,
                username,
                SUM(message_count) as messages,
                SUM(voice_minutes) as voiceMinutes,
                SUM(xp_earned) as xpEarned,
                SUM(points_earned) as pointsEarned
            FROM member_activity
            WHERE guild_id = ? AND date >= ?
            GROUP BY user_id
            ORDER BY messages DESC
            LIMIT 100
        `).all(guildId, startDate.toISOString().split('T')[0]);

        res.json({ activity });
    } catch (error) {
        console.error('[Analytics] Member activity error:', error);
        res.status(500).json({ error: 'Failed to fetch member activity' });
    }
});

// Get top members by metric
router.get('/analytics/top', verifyDiscordToken, (req, res) => {
    try {
        const { guildId } = req.params;
        const metric = req.query.metric || 'messages';
        const limit = parseInt(req.query.limit) || 10;

        let orderBy = 'message_count';
        if (metric === 'voice') orderBy = 'voice_minutes';
        if (metric === 'xp') orderBy = 'xp_earned';
        if (metric === 'points') orderBy = 'points_earned';

        const top = db.prepare(`
            SELECT 
                gm.user_id as id,
                gm.username,
                gm.avatar,
                COALESCE(SUM(ma.${orderBy}), 0) as value,
                CASE 
                    WHEN ${orderBy} = 'voice_minutes' THEN ROUND(value / 60, 1) || 'h'
                    ELSE value
                END as displayValue
            FROM guild_members gm
            LEFT JOIN member_activity ma ON gm.guild_id = ma.guild_id AND gm.user_id = ma.user_id
            WHERE gm.guild_id = ?
            GROUP BY gm.user_id
            ORDER BY value DESC
            LIMIT ?
        `).all(guildId, limit);

        res.json({ 
            metric,
            top: top.map(t => ({
                ...t,
                value: t.value || 0
            }))
        });
    } catch (error) {
        console.error('[Analytics] Top members error:', error);
        res.status(500).json({ error: 'Failed to fetch top members' });
    }
});

// Get channel stats
router.get('/analytics/channels', verifyDiscordToken, (req, res) => {
    try {
        const { guildId } = req.params;
        const days = parseInt(req.query.days) || 7;

        // This would typically come from actual channel message tracking
        // For now, return a placeholder structure
        res.json({
            channels: [],
            note: 'Channel-specific stats require message tracking by channel'
        });
    } catch (error) {
        console.error('[Analytics] Channel stats error:', error);
        res.status(500).json({ error: 'Failed to fetch channel stats' });
    }
});

// Get growth metrics
router.get('/analytics/growth', verifyDiscordToken, (req, res) => {
    try {
        const { guildId } = req.params;
        const months = parseInt(req.query.months) || 6;

        // Calculate growth per month
        const growth = [];
        const now = new Date();

        for (let i = months - 1; i >= 0; i--) {
            const date = new Date(now.getFullYear(), now.getMonth() - i, 1);
            const endDate = new Date(date.getFullYear(), date.getMonth() + 1, 0);

            const stats = db.prepare(`
                SELECT 
                    SUM(member_joins) as joins,
                    SUM(member_leaves) as leaves,
                    SUM(message_count) as messages
                FROM daily_stats
                WHERE guild_id = ? AND date >= ? AND date <= ?
            `).get(guildId, date.toISOString().split('T')[0], endDate.toISOString().split('T')[0]);

            growth.push({
                month: date.toLocaleString('default', { month: 'short', year: 'numeric' }),
                joins: stats?.joins || 0,
                leaves: stats?.leaves || 0,
                netGrowth: (stats?.joins || 0) - (stats?.leaves || 0),
                messages: stats?.messages || 0
            });
        }

        res.json({ growth });
    } catch (error) {
        console.error('[Analytics] Growth error:', error);
        res.status(500).json({ error: 'Failed to fetch growth metrics' });
    }
});

// Get retention stats
router.get('/analytics/retention', verifyDiscordToken, (req, res) => {
    try {
        const { guildId } = req.params;

        // Get members who joined in last 30 days and are still in server
        const thirtyDaysAgo = new Date();
        thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

        const fourteenDaysAgo = new Date();
        fourteenDaysAgo.setDate(fourteenDaysAgo.getDate() - 14);

        const sevenDaysAgo = new Date();
        sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

        const retention = db.prepare(`
            SELECT 
                COUNT(CASE WHEN joined_at >= ? THEN 1 END) as joined30d,
                COUNT(CASE WHEN joined_at >= ? AND last_active_at >= ? THEN 1 END) as retained14d,
                COUNT(CASE WHEN joined_at >= ? AND last_active_at >= ? THEN 1 END) as retained7d
            FROM guild_members
            WHERE guild_id = ? AND joined_at >= ?
        `).get(
            thirtyDaysAgo.toISOString(),
            thirtyDaysAgo.toISOString(),
            fourteenDaysAgo.toISOString(),
            thirtyDaysAgo.toISOString(),
            sevenDaysAgo.toISOString(),
            guildId,
            thirtyDaysAgo.toISOString()
        );

        res.json({
            joined30Days: retention?.joined30d || 0,
            retained14Days: retention?.retained14d || 0,
            retained7Days: retention?.retained7d || 0,
            retentionRate14d: retention?.joined30d > 0 
                ? Math.round((retention.retained14d / retention.joined30d) * 100) 
                : 0,
            retentionRate7d: retention?.joined30d > 0 
                ? Math.round((retention.retained7d / retention.joined30d) * 100) 
                : 0
        });
    } catch (error) {
        console.error('[Analytics] Retention error:', error);
        res.status(500).json({ error: 'Failed to fetch retention stats' });
    }
});

// Get moderation timeline
router.get('/analytics/moderation-timeline', verifyDiscordToken, (req, res) => {
    try {
        const { guildId } = req.params;
        const days = parseInt(req.query.days) || 30;
        const startDate = new Date();
        startDate.setDate(startDate.getDate() - days);

        const timeline = db.prepare(`
            SELECT 
                date(created_at) as date,
                action_type as actionType,
                COUNT(*) as count
            FROM moderation_actions
            WHERE guild_id = ? AND created_at >= ?
            GROUP BY date(created_at), action_type
            ORDER BY date DESC
        `).all(guildId, startDate.toISOString());

        // Group by date
        const grouped = {};
        for (const item of timeline) {
            if (!grouped[item.date]) {
                grouped[item.date] = { date: item.date };
            }
            grouped[item.date][item.actionType] = item.count;
        }

        res.json({ timeline: Object.values(grouped) });
    } catch (error) {
        console.error('[Analytics] Moderation timeline error:', error);
        res.status(500).json({ error: 'Failed to fetch moderation timeline' });
    }
});

// Get engagement score
router.get('/analytics/engagement', verifyDiscordToken, (req, res) => {
    try {
        const { guildId } = req.params;
        const days = parseInt(req.query.days) || 7;
        const startDate = new Date();
        startDate.setDate(startDate.getDate() - days);

        // Calculate engagement metrics
        const stats = db.prepare(`
            SELECT 
                COUNT(DISTINCT user_id) as activeUsers,
                SUM(message_count) as totalMessages,
                SUM(voice_minutes) as totalVoiceMinutes
            FROM member_activity
            WHERE guild_id = ? AND date >= ?
        `).get(guildId, startDate.toISOString().split('T')[0]);

        const totalMembers = db.prepare(`
            SELECT COUNT(*) as count FROM guild_members WHERE guild_id = ?
        `).get(guildId).count;

        const engagement = {
            activeUsers: stats?.activeUsers || 0,
            totalMembers: totalMembers || 0,
            activityRate: totalMembers > 0 ? Math.round((stats?.activeUsers || 0) / totalMembers * 100) : 0,
            messagesPerActiveUser: stats?.activeUsers > 0 
                ? Math.round((stats?.totalMessages || 0) / stats.activeUsers) 
                : 0,
            voiceMinutesPerActiveUser: stats?.activeUsers > 0 
                ? Math.round((stats?.totalVoiceMinutes || 0) / stats.activeUsers) 
                : 0,
            score: 0
        };

        // Calculate overall engagement score (0-100)
        const activityScore = Math.min(50, engagement.activityRate / 2);
        const messageScore = Math.min(30, engagement.messagesPerActiveUser / 10);
        const voiceScore = Math.min(20, engagement.voiceMinutesPerActiveUser / 30);
        engagement.score = Math.round(activityScore + messageScore + voiceScore);

        res.json({ engagement });
    } catch (error) {
        console.error('[Analytics] Engagement error:', error);
        res.status(500).json({ error: 'Failed to fetch engagement stats' });
    }
});

// Export analytics data
router.get('/analytics/export', verifyDiscordToken, (req, res) => {
    try {
        const { guildId } = req.params;
        const format = req.query.format || 'json';
        const days = parseInt(req.query.days) || 30;
        const startDate = new Date();
        startDate.setDate(startDate.getDate() - days);

        // Get all relevant data
        const dailyStats = db.prepare(`
            SELECT * FROM daily_stats 
            WHERE guild_id = ? AND date >= ?
            ORDER BY date ASC
        `).all(guildId, startDate.toISOString().split('T')[0]);

        const memberActivity = db.prepare(`
            SELECT * FROM member_activity
            WHERE guild_id = ? AND date >= ?
            ORDER BY date ASC
        `).all(guildId, startDate.toISOString().split('T')[0]);

        const moderationActions = db.prepare(`
            SELECT * FROM moderation_actions
            WHERE guild_id = ? AND created_at >= ?
            ORDER BY created_at ASC
        `).all(guildId, startDate.toISOString());

        const exportData = {
            guildId,
            exportedAt: new Date().toISOString(),
            period: { days, startDate: startDate.toISOString() },
            dailyStats,
            memberActivity,
            moderationActions
        };

        if (format === 'csv') {
            // Convert to CSV
            const csv = convertToCSV(dailyStats);
            res.setHeader('Content-Type', 'text/csv');
            res.setHeader('Content-Disposition', `attachment; filename="analytics-${guildId}.csv"`);
            return res.send(csv);
        }

        res.json(exportData);
    } catch (error) {
        console.error('[Analytics] Export error:', error);
        res.status(500).json({ error: 'Failed to export analytics' });
    }
});

// Record daily stats (bot would call this)
router.post('/analytics/daily', verifyDiscordToken, (req, res) => {
    try {
        const { guildId } = req.params;
        const {
            date,
            messageCount,
            memberJoins,
            memberLeaves,
            voiceMinutes,
            activeMembers,
            newMembers,
            commandsUsed
        } = req.body;

        const stmt = db.prepare(`
            INSERT INTO daily_stats 
            (guild_id, date, message_count, member_joins, member_leaves, 
             voice_minutes, active_members, new_members, commands_used)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
            ON CONFLICT(guild_id, date) DO UPDATE SET
                message_count = excluded.message_count,
                member_joins = excluded.member_joins,
                member_leaves = excluded.member_leaves,
                voice_minutes = excluded.voice_minutes,
                active_members = excluded.active_members,
                new_members = excluded.new_members,
                commands_used = excluded.commands_used
        `);

        stmt.run(
            guildId,
            date || new Date().toISOString().split('T')[0],
            messageCount || 0,
            memberJoins || 0,
            memberLeaves || 0,
            voiceMinutes || 0,
            activeMembers || 0,
            newMembers || 0,
            commandsUsed || 0
        );

        res.json({ success: true, message: 'Daily stats recorded' });
    } catch (error) {
        console.error('[Analytics] Record daily stats error:', error);
        res.status(500).json({ error: 'Failed to record daily stats' });
    }
});

// Record member activity (bot would call this)
router.post('/analytics/member-activity', verifyDiscordToken, (req, res) => {
    try {
        const { guildId } = req.params;
        const {
            userId,
            username,
            date,
            messageCount,
            voiceMinutes,
            xpEarned,
            pointsEarned
        } = req.body;

        const stmt = db.prepare(`
            INSERT INTO member_activity 
            (guild_id, user_id, date, message_count, voice_minutes, xp_earned, points_earned)
            VALUES (?, ?, ?, ?, ?, ?, ?)
            ON CONFLICT(guild_id, user_id, date) DO UPDATE SET
                message_count = message_count + excluded.message_count,
                voice_minutes = voice_minutes + excluded.voice_minutes,
                xp_earned = xp_earned + excluded.xp_earned,
                points_earned = points_earned + excluded.points_earned
        `);

        stmt.run(
            guildId,
            userId,
            date || new Date().toISOString().split('T')[0],
            messageCount || 0,
            voiceMinutes || 0,
            xpEarned || 0,
            pointsEarned || 0
        );

        res.json({ success: true, message: 'Member activity recorded' });
    } catch (error) {
        console.error('[Analytics] Record member activity error:', error);
        res.status(500).json({ error: 'Failed to record member activity' });
    }
});

function convertToCSV(data) {
    if (data.length === 0) return '';
    
    const headers = Object.keys(data[0]);
    const csv = [
        headers.join(','),
        ...data.map(row => headers.map(h => {
            const val = row[h];
            if (typeof val === 'string' && val.includes(',')) {
                return `"${val}"`;
            }
            return val;
        }).join(','))
    ].join('\n');
    
    return csv;
}

module.exports = router;
