import express from 'express';
import { authenticateJWT } from '../middleware/auth.js';
import { requireModerator } from '../middleware/permissions.js';
import { apiLimiter } from '../middleware/rateLimiter.js';
import { ActivityLog } from '../models/index.js';

const router = express.Router({ mergeParams: true });

router.get('/', authenticateJWT, requireModerator, apiLimiter, async (req, res) => {
  try {
    const { guildId } = req.params;
    const { 
      page = 1, 
      limit = 50, 
      type, 
      severity, 
      actorId, 
      targetId,
      startDate,
      endDate
    } = req.query;

    const options = {
      limit: parseInt(limit),
      skip: (parseInt(page) - 1) * parseInt(limit),
      types: type,
      severity,
      actorId,
      targetId,
      startDate,
      endDate
    };

    const logs = await ActivityLog.getRecentLogs(guildId, options);

    const total = await ActivityLog.countDocuments({
      guildId,
      isDeleted: false,
      ...(type && { type }),
      ...(severity && { severity }),
      ...(actorId && { 'actor.userId': actorId }),
      ...(targetId && { 'target.userId': targetId }),
      ...(startDate || endDate ? {
        timestamp: {
          ...(startDate && { $gte: new Date(startDate) }),
          ...(endDate && { $lte: new Date(endDate) })
        }
      } : {})
    });

    const types = await ActivityLog.distinct('type', { guildId });

    res.json({
      success: true,
      data: {
        logs: logs.map(log => ({
          id: log._id,
          logId: log.logId,
          type: log.type,
          severity: log.severity,
          timestamp: log.timestamp,
          actor: log.actor,
          target: log.target,
          channel: log.channel,
          details: log.details,
          relatedEntities: log.relatedEntities,
          source: log.source
        })),
        types,
        pagination: {
          page: parseInt(page),
          limit: parseInt(limit),
          total,
          pages: Math.ceil(total / parseInt(limit))
        }
      }
    });
  } catch (error) {
    console.error('Get Activity Logs Error:', error);
    res.status(500).json({
      success: false,
      error: 'Internal Server Error',
      message: 'Failed to fetch activity logs'
    });
  }
});

router.get('/stats', authenticateJWT, requireModerator, apiLimiter, async (req, res) => {
  try {
    const { guildId } = req.params;
    const { days = 7 } = req.query;

    const stats = await ActivityLog.getStats(guildId, parseInt(days));

    const dailyStats = await ActivityLog.aggregate([
      {
        $match: {
          guildId,
          timestamp: { $gte: new Date(Date.now() - parseInt(days) * 24 * 60 * 60 * 1000) },
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
    ]);

    res.json({
      success: true,
      data: {
        ...stats,
        daily: dailyStats,
        period: {
          days: parseInt(days),
          since: new Date(Date.now() - parseInt(days) * 24 * 60 * 60 * 1000)
        }
      }
    });
  } catch (error) {
    console.error('Get Activity Stats Error:', error);
    res.status(500).json({
      success: false,
      error: 'Internal Server Error',
      message: 'Failed to fetch activity statistics'
    });
  }
});

router.get('/user/:userId', authenticateJWT, requireModerator, apiLimiter, async (req, res) => {
  try {
    const { guildId, userId } = req.params;
    const { days = 30, page = 1, limit = 20 } = req.query;

    const options = {
      limit: parseInt(limit),
      skip: (parseInt(page) - 1) * parseInt(limit),
      startDate: new Date(Date.now() - parseInt(days) * 24 * 60 * 60 * 1000)
    };

    const [actorLogs, targetLogs, stats] = await Promise.all([
      ActivityLog.getRecentLogs(guildId, { ...options, actorId: userId }),
      ActivityLog.getRecentLogs(guildId, { ...options, targetId: userId }),
      ActivityLog.getStaffActivity(guildId, userId, parseInt(days))
    ]);

    res.json({
      success: true,
      data: {
        userId,
        stats,
        asActor: actorLogs,
        asTarget: targetLogs,
        period: {
          days: parseInt(days),
          since: options.startDate
        }
      }
    });
  } catch (error) {
    console.error('Get User Activity Error:', error);
    res.status(500).json({
      success: false,
      error: 'Internal Server Error',
      message: 'Failed to fetch user activity'
    });
  }
});

router.get('/:logId', authenticateJWT, requireModerator, apiLimiter, async (req, res) => {
  try {
    const { guildId, logId } = req.params;

    const log = await ActivityLog.findOne({ guildId, logId })
      .select('-__v -isDeleted -deletedAt -deletedBy');

    if (!log) {
      return res.status(404).json({
        success: false,
        error: 'Not Found',
        message: 'Log entry not found'
      });
    }

    res.json({
      success: true,
      data: { log }
    });
  } catch (error) {
    console.error('Get Log Error:', error);
    res.status(500).json({
      success: false,
      error: 'Internal Server Error',
      message: 'Failed to fetch log entry'
    });
  }
});

router.delete('/:logId', authenticateJWT, requireModerator, apiLimiter, async (req, res) => {
  try {
    const { guildId, logId } = req.params;

    const log = await ActivityLog.softDelete(logId, {
      userId: req.user.id,
      username: req.user.username
    });

    if (!log) {
      return res.status(404).json({
        success: false,
        error: 'Not Found',
        message: 'Log entry not found'
      });
    }

    res.json({
      success: true,
      message: 'Log entry deleted successfully'
    });
  } catch (error) {
    console.error('Delete Log Error:', error);
    res.status(500).json({
      success: false,
      error: 'Internal Server Error',
      message: 'Failed to delete log entry'
    });
  }
});

router.post('/cleanup', authenticateJWT, requireModerator, apiLimiter, async (req, res) => {
  try {
    const { guildId } = req.params;
    const { olderThanDays = 90 } = req.body;

    const deletedCount = await ActivityLog.bulkDeleteOld(guildId, olderThanDays);

    res.json({
      success: true,
      data: {
        deletedCount,
        olderThanDays
      }
    });
  } catch (error) {
    console.error('Cleanup Logs Error:', error);
    res.status(500).json({
      success: false,
      error: 'Internal Server Error',
      message: 'Failed to cleanup old logs'
    });
  }
});

export default router;
