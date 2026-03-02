const express = require('express');
const cors = require('cors');
const router = express.Router();
const { User, Guild, Shift, Warning, Activity } = require('../database/mongo');

// Middleware: verify Discord token against Discord API
async function verifyDiscordToken(req, res, next) {
    const auth = req.headers.authorization;
    if (!auth || !auth.startsWith('Bearer ')) return res.status(401).json({ error: 'Unauthorized' });
    const token = auth.split(' ')[1];
    try {
        const discordRes = await fetch('https://discord.com/api/users/@me', {
            headers: { Authorization: `Bearer ${token}` }
        });
        if (!discordRes.ok) return res.status(401).json({ error: 'Invalid Discord token' });
        req.discordUser = await discordRes.json();
        next();
    } catch {
        res.status(401).json({ error: 'Token verification failed' });
    }
}

// ── GET /api/me — current user's staff profile ──
router.get('/me', verifyDiscordToken, async (req, res) => {
    try {
        const userId = req.discordUser.id;
        const user = await User.findOne({ userId }).lean();
        res.json({
            discord: {
                id: req.discordUser.id,
                username: req.discordUser.username,
                avatar: req.discordUser.avatar
            },
            staff: user?.staff || null,
            guilds: user?.guilds || []
        });
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

// ── GET /api/staff?guildId=xxx ── real staff list from DB
router.get('/staff', verifyDiscordToken, async (req, res) => {
    try {
        const { guildId } = req.query;
        const query = guildId ? { 'guilds.guildId': guildId, 'staff.points': { $gt: 0 } } : { 'staff.points': { $gt: 0 } };
        const users = await User.find(query).sort({ 'staff.points': -1 }).limit(25).lean();
        const staffList = await Promise.all(users.map(async u => {
            const shiftCount = await Shift.countDocuments({ userId: u.userId, ...(guildId && { guildId }), endTime: { $ne: null } });
            const warnCount = await Warning.countDocuments({ userId: u.userId, ...(guildId && { guildId }) });
            return {
                userId: u.userId,
                username: u.username || 'Unknown',
                avatar: u.avatar || null,
                rank: u.staff?.rank || 'member',
                points: u.staff?.points || 0,
                consistency: u.staff?.consistency || 0,
                streak: u.staff?.streak || 0,
                shiftCount,
                warnCount,
                lastShift: u.staff?.lastShift || null
            };
        }));
        res.json(staffList);
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

// ── GET /api/shifts?userId=xxx&guildId=xxx ── user shift history
router.get('/shifts', verifyDiscordToken, async (req, res) => {
    try {
        const userId = req.query.userId || req.discordUser.id;
        const { guildId } = req.query;
        const q = { userId, endTime: { $ne: null }, ...(guildId && { guildId }) };
        const shifts = await Shift.find(q).sort({ startTime: -1 }).limit(20).lean();
        res.json(shifts.map(s => ({
            id: s._id,
            guildId: s.guildId,
            startTime: s.startTime,
            endTime: s.endTime,
            duration: s.duration,
            hoursFormatted: s.duration ? `${Math.floor(s.duration / 3600)}h ${Math.floor((s.duration % 3600) / 60)}m` : 'N/A',
            pointsEarned: s.duration ? Math.floor(s.duration / 300) : 0,
            status: s.status || 'completed'
        })));
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

// ── GET /api/promotion?userId=xxx&guildId=xxx ── real promotion status
router.get('/promotion', verifyDiscordToken, async (req, res) => {
    try {
        const userId = req.query.userId || req.discordUser.id;
        const { guildId } = req.query;

        const [user, guildData, shiftCount, warnCount] = await Promise.all([
            User.findOne({ userId }).lean(),
            guildId ? Guild.findOne({ guildId }).lean() : null,
            Shift.countDocuments({ userId, ...(guildId && { guildId }), endTime: { $ne: null } }),
            Warning.countDocuments({ userId, ...(guildId && { guildId }) })
        ]);

        const RANK_ORDER = ['member', 'trial', 'staff', 'senior', 'manager', 'admin'];
        const DEFAULT_REQS = {
            trial: { points: 0, shifts: 0, consistency: 0, maxWarnings: 99 },
            staff: { points: 100, shifts: 5, consistency: 70, maxWarnings: 3 },
            senior: { points: 300, shifts: 10, consistency: 75, maxWarnings: 2 },
            manager: { points: 600, shifts: 20, consistency: 80, maxWarnings: 1 },
            admin: { points: 1000, shifts: 30, consistency: 85, maxWarnings: 0 }
        };
        const reqs = { ...DEFAULT_REQS, ...(guildData?.promotionRequirements || {}) };
        const currentRank = user?.staff?.rank || 'member';
        const points = user?.staff?.points || 0;
        const consistency = user?.staff?.consistency || 0;

        const rankData = RANK_ORDER.map(rank => {
            const req = reqs[rank] || {};
            return {
                rank,
                required: req,
                current: { points, shifts: shiftCount, consistency, warnings: warnCount },
                progress: req.points > 0 ? Math.min(100, Math.round((points / req.points) * 100)) : 100,
                eligible: points >= (req.points || 0) && shiftCount >= (req.shifts || 0) && consistency >= (req.consistency || 0) && warnCount <= (req.maxWarnings ?? 99),
                isCurrentRank: rank === currentRank,
                isPast: RANK_ORDER.indexOf(rank) < RANK_ORDER.indexOf(currentRank)
            };
        });

        res.json({ currentRank, staff: user?.staff || {}, rankData, shiftCount, warnCount });
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

// ── GET /api/analytics?guildId=xxx ── real analytics
router.get('/analytics', verifyDiscordToken, async (req, res) => {
    try {
        const { guildId } = req.query;
        const now = new Date();
        const sevenDaysAgo = new Date(now - 7 * 86400000);
        const prevSevenDays = new Date(now - 14 * 86400000);

        const q = guildId ? { guildId } : {};
        const [weekActs, prevActs, weekWarnings, weekShifts, guildData] = await Promise.all([
            Activity.find({ ...q, createdAt: { $gte: sevenDaysAgo } }).lean(),
            Activity.find({ ...q, createdAt: { $gte: prevSevenDays, $lt: sevenDaysAgo } }).lean(),
            Warning.find({ ...q, createdAt: { $gte: sevenDaysAgo } }).lean(),
            Shift.find({ ...q, startTime: { $gte: sevenDaysAgo }, endTime: { $ne: null } }).lean(),
            guildId ? Guild.findOne({ guildId }).lean() : null
        ]);

        const activeUsers = new Set(weekActs.map(a => a.userId)).size;
        const prevUsers = new Set(prevActs.map(a => a.userId)).size;
        const memberCount = guildData?.memberCount || 100;
        const engagePct = Math.round((activeUsers / Math.max(memberCount, 1)) * 100);
        const commandCount = weekActs.filter(a => a.type === 'command').length;
        const prevCommands = prevActs.filter(a => a.type === 'command').length;
        const cmdGrowth = prevCommands > 0 ? (((commandCount - prevCommands) / prevCommands) * 100).toFixed(1) : null;

        res.json({
            activeUsers,
            prevUsers,
            engagePct,
            commandCount,
            cmdGrowth,
            warnings: weekWarnings.length,
            shifts: weekShifts.length,
            totalEvents: weekActs.length,
            memberCount
        });
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

// ── GET /api/stats ── public server stats (no auth)
router.get('/stats', async (req, res) => {
    try {
        const [staffCount, totalShifts, totalWarnings] = await Promise.all([
            User.countDocuments({ 'staff.points': { $gt: 0 } }),
            Shift.countDocuments({ endTime: { $ne: null } }),
            Warning.countDocuments({})
        ]);
        res.json({ staffCount, totalShifts, totalWarnings });
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

module.exports = router;
