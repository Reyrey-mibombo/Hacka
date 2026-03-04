import express from 'express';
import { authenticateJWT } from '../middleware/auth.js';
import { requireGuildAccess } from '../middleware/permissions.js';
import { apiLimiter } from '../middleware/rateLimiter.js';
import { User, Guild, Staff, Shift, Ticket, Warning, ActivityLog, CustomCommand } from '../models/index.js';

const router = express.Router();

router.get('/overview', authenticateJWT, apiLimiter, async (req, res) => {
  try {
    const user = await User.findOne({ discordId: req.user.id });

    if (!user) {
      return res.status(404).json({
        success: false,
        error: 'Not Found',
        message: 'User not found'
      });
    }

    const manageableGuilds = user.guilds.filter(g => {
      const permissions = BigInt(g.permissions || '0');
      return (permissions & BigInt(0x00000020)) === BigInt(0x00000020) ||
             (permissions & BigInt(0x00000008)) === BigInt(0x00000008) ||
             g.owner;
    }).slice(0, 6);

    const guildsWithStats = await Promise.all(
      manageableGuilds.map(async (userGuild) => {
        const [guildData, staffCount, ticketStats, recentActivity] = await Promise.all([
          Guild.findOne({ guildId: userGuild.guildId }),
          Staff.countDocuments({ guildId: userGuild.guildId, isActive: true }),
          Ticket.getStats(userGuild.guildId, 7),
          ActivityLog.getRecentLogs(userGuild.guildId, { limit: 5 })
        ]);

        return {
          id: userGuild.guildId,
          name: userGuild.name,
          icon: userGuild.icon ? `https://cdn.discordapp.com/icons/${userGuild.guildId}/${userGuild.icon}.png` : null,
          owner: userGuild.owner,
          memberCount: guildData?.memberCount || 0,
          staffCount,
          tickets: ticketStats,
          recentActivity: recentActivity.length,
          dashboardEnabled: guildData?.settings?.dashboardEnabled ?? true
        };
      })
    );

    const totalStats = guildsWithStats.reduce((acc, guild) => ({
      totalGuilds: acc.totalGuilds + 1,
      totalStaff: acc.totalStaff + (guild.staffCount || 0),
      totalTickets: acc.totalTickets + (guild.tickets?.total || 0)
    }), { totalGuilds: 0, totalStaff: 0, totalTickets: 0 });

    res.json({
      success: true,
      data: {
        user: {
          id: user.discordId,
          username: user.username,
          globalName: user.globalName,
          avatar: user.getAvatarURL()
        },
        guilds: guildsWithStats,
        summary: totalStats
      }
    });
  } catch (error) {
    console.error('Get Dashboard Overview Error:', error);
    res.status(500).json({
      success: false,
      error: 'Internal Server Error',
      message: 'Failed to fetch dashboard overview'
    });
  }
});

router.get('/guilds/:guildId/overview', authenticateJWT, requireGuildAccess, apiLimiter, async (req, res) => {
  try {
    const { guildId } = req.params;

    const [
      guildData,
      staffStats,
      shiftStats,
      ticketStats,
      warningStats,
      activityStats
    ] = await Promise.all([
      Guild.findOne({ guildId }),
      Staff.aggregate([
        { $match: { guildId, isActive: true } },
        {
          $group: {
            _id: null,
            total: { $sum: 1 },
            onShift: { $sum: { $cond: ['$shifts.active', 1, 0] } },
            onLeave: { $sum: { $cond: ['$isOnLeave', 1, 0] } },
            totalPoints: { $sum: '$points' }
          }
        }
      ]),
      Shift.getGuildStats(guildId, 7),
      Ticket.getStats(guildId, 7),
      Warning.aggregate([
        {
          $match: {
            guildId,
            revoked: false,
            expired: false,
            $or: [{ expiresAt: null }, { expiresAt: { $gt: new Date() } }]
          }
        },
        {
          $group: {
            _id: '$severity',
            count: { $sum: 1 }
          }
        }
      ]),
      ActivityLog.getStats(guildId, 7)
    ]);

    const recentActivity = await ActivityLog.getRecentLogs(guildId, { limit: 10 });

    const stats = staffStats[0] || { total: 0, onShift: 0, onLeave: 0, totalPoints: 0 };

    res.json({
      success: true,
      data: {
        guild: {
          id: guildId,
          name: guildData?.name,
          icon: guildData?.getIconURL(),
          memberCount: guildData?.memberCount || 0,
          tier: guildData?.tier || 'free'
        },
        staff: {
          total: stats.total,
          onShift: stats.onShift,
          onLeave: stats.onLeave,
          totalPoints: stats.totalPoints
        },
        shifts: shiftStats,
        tickets: ticketStats,
        warnings: warningStats.reduce((acc, w) => {
          acc[w._id] = w.count;
          return acc;
        }, {}),
        activity: activityStats,
        recentActivity
      }
    });
  } catch (error) {
    console.error('Get Guild Overview Error:', error);
    res.status(500).json({
      success: false,
      error: 'Internal Server Error',
      message: 'Failed to fetch guild overview'
    });
  }
});

router.get('/guilds/:guildId/charts', authenticateJWT, requireGuildAccess, apiLimiter, async (req, res) => {
  try {
    const { guildId } = req.params;
    const { days = 30 } = req.query;

    const since = new Date(Date.now() - parseInt(days) * 24 * 60 * 60 * 1000);

    const [activityTrend, shiftTrend, ticketTrend] = await Promise.all([
      ActivityLog.aggregate([
        {
          $match: {
            guildId,
            timestamp: { $gte: since },
            isDeleted: false
          }
        },
        {
          $group: {
            _id: { $dateToString: { format: '%Y-%m-%d', date: '$timestamp' } },
            count: { $sum: 1 }
          }
        },
        { $sort: { _id: 1 } }
      ]),
      Shift.aggregate([
        {
          $match: {
            guildId,
            status: 'completed',
            startTime: { $gte: since }
          }
        },
        {
          $group: {
            _id: { $dateToString: { format: '%Y-%m-%d', date: '$startTime' } },
            shifts: { $sum: 1 },
            duration: { $sum: '$duration' }
          }
        },
        { $sort: { _id: 1 } }
      ]),
      Ticket.aggregate([
        {
          $match: {
            guildId,
            createdAt: { $gte: since }
          }
        },
        {
          $group: {
            _id: { $dateToString: { format: '%Y-%m-%d', date: '$createdAt' } },
            created: { $sum: 1 },
            closed: {
              $sum: { $cond: [{ $eq: ['$status', 'closed'] }, 1, 0] }
            }
          }
        },
        { $sort: { _id: 1 } }
      ])
    ]);

    const staffByRank = await Staff.aggregate([
      { $match: { guildId, isActive: true } },
      {
        $group: {
          _id: '$rank',
          count: { $sum: 1 }
        }
      },
      { $sort: { count: -1 } }
    ]);

    res.json({
      success: true,
      data: {
        activityTrend,
        shiftTrend,
        ticketTrend,
        staffByRank,
        period: {
          days: parseInt(days),
          since
        }
      }
    });
  } catch (error) {
    console.error('Get Dashboard Charts Error:', error);
    res.status(500).json({
      success: false,
      error: 'Internal Server Error',
      message: 'Failed to fetch dashboard charts'
    });
  }
});

router.get('/search', authenticateJWT, apiLimiter, async (req, res) => {
  try {
    const { q, guildId } = req.query;

    if (!q || q.length < 2) {
      return res.status(400).json({
        success: false,
        error: 'Bad Request',
        message: 'Search query must be at least 2 characters'
      });
    }

    const user = await User.findOne({ discordId: req.user.id });
    const userGuildIds = user.guilds
      .filter(g => {
        const permissions = BigInt(g.permissions || '0');
        return (permissions & BigInt(0x00000020)) === BigInt(0x00000020) ||
               (permissions & BigInt(0x00000008)) === BigInt(0x00000008) ||
               g.owner;
      })
      .map(g => g.guildId);

    const searchGuildIds = guildId && userGuildIds.includes(guildId) 
      ? [guildId] 
      : userGuildIds;

    const [staffResults, ticketResults, commandResults] = await Promise.all([
      Staff.find({
        guildId: { $in: searchGuildIds },
        $or: [
          { username: { $regex: q, $options: 'i' } },
          { nickname: { $regex: q, $options: 'i' } },
          { globalName: { $regex: q, $options: 'i' } }
        ]
      }).limit(10).select('guildId userId username globalName avatar rank'),
      
      Ticket.find({
        guildId: { $in: searchGuildIds },
        $or: [
          { ticketId: { $regex: q, $options: 'i' } },
          { subject: { $regex: q, $options: 'i' } },
          { 'creator.username': { $regex: q, $options: 'i' } }
        ]
      }).limit(10).select('guildId ticketId subject status creator'),
      
      CustomCommand.find({
        guildId: { $in: searchGuildIds },
        $or: [
          { name: { $regex: q, $options: 'i' } },
          { description: { $regex: q, $options: 'i' } }
        ]
      }).limit(10).select('guildId commandId name description category')
    ]);

    res.json({
      success: true,
      data: {
        query: q,
        results: {
          staff: staffResults,
          tickets: ticketResults,
          commands: commandResults
        },
        total: staffResults.length + ticketResults.length + commandResults.length
      }
    });
  } catch (error) {
    console.error('Search Error:', error);
    res.status(500).json({
      success: false,
      error: 'Internal Server Error',
      message: 'Failed to perform search'
    });
  }
});

export default router;
