import express from 'express';
import { authenticateJWT } from '../middleware/auth.js';
import { requireModerator, checkRoleHierarchy } from '../middleware/permissions.js';
import { apiLimiter } from '../middleware/rateLimiter.js';
import { Warning, Staff, ActivityLog } from '../models/index.js';

const router = express.Router({ mergeParams: true });

router.get('/', authenticateJWT, requireModerator, apiLimiter, async (req, res) => {
  try {
    const { guildId } = req.params;
    const { 
      status = 'all', 
      userId, 
      issuerId, 
      severity, 
      page = 1, 
      limit = 20,
      startDate,
      endDate
    } = req.query;

    const query = { guildId };

    if (status === 'active') {
      query.revoked = false;
      query.expired = false;
      query.$or = [
        { expiresAt: null },
        { expiresAt: { $gt: new Date() } }
      ];
    } else if (status === 'expired') {
      query.expired = true;
    } else if (status === 'revoked') {
      query.revoked = true;
    }

    if (userId) query.targetId = userId;
    if (issuerId) query.issuerId = issuerId;
    if (severity) query.severity = severity;

    if (startDate || endDate) {
      query.createdAt = {};
      if (startDate) query.createdAt.$gte = new Date(startDate);
      if (endDate) query.createdAt.$lte = new Date(endDate);
    }

    const skip = (parseInt(page) - 1) * parseInt(limit);

    const [warnings, total] = await Promise.all([
      Warning.find(query)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(parseInt(limit))
        .select('-__v'),
      Warning.countDocuments(query)
    ]);

    const stats = await Warning.aggregate([
      {
        $match: { guildId }
      },
      {
        $group: {
          _id: '$severity',
          count: { $sum: 1 },
          active: {
            $sum: {
              $cond: [
                { $and: [{ $eq: ['$revoked', false] }, { $eq: ['$expired', false] }] },
                1,
                0
              ]
            }
          }
        }
      }
    ]);

    res.json({
      success: true,
      data: {
        warnings: warnings.map(w => ({
          id: w._id,
          warningId: w.warningId,
          target: {
            userId: w.targetId,
            username: w.targetUsername,
            avatar: w.targetAvatar
          },
          issuer: {
            userId: w.issuerId,
            username: w.issuerUsername,
            avatar: w.issuerAvatar
          },
          reason: w.reason,
          severity: w.severity,
          weight: w.weight,
          points: w.points,
          createdAt: w.createdAt,
          expiresAt: w.expiresAt,
          expired: w.expired,
          revoked: w.revoked,
          acknowledged: w.acknowledged,
          appealed: w.appealed,
          appealStatus: w.appealStatus
        })),
        pagination: {
          page: parseInt(page),
          limit: parseInt(limit),
          total,
          pages: Math.ceil(total / parseInt(limit))
        },
        stats: stats.reduce((acc, s) => {
          acc[s._id] = { total: s.count, active: s.active };
          return acc;
        }, {})
      }
    });
  } catch (error) {
    console.error('Get Warnings Error:', error);
    res.status(500).json({
      success: false,
      error: 'Internal Server Error',
      message: 'Failed to fetch warnings'
    });
  }
});

router.get('/user/:userId', authenticateJWT, requireModerator, apiLimiter, async (req, res) => {
  try {
    const { guildId, userId } = req.params;
    const { includeExpired = 'false', includeRevoked = 'false' } = req.query;

    const warnings = await Warning.getActiveWarnings(guildId, userId);

    if (includeExpired === 'true' || includeRevoked === 'true') {
      const query = { guildId, targetId: userId };
      if (includeExpired !== 'true') {
        query.expired = false;
      }
      if (includeRevoked !== 'true') {
        query.revoked = false;
      }

      const allWarnings = await Warning.find(query)
        .sort({ createdAt: -1 })
        .select('-__v');

      const totalWeight = await Warning.getTotalWeight(guildId, userId);

      return res.json({
        success: true,
        data: {
          userId,
          warnings: allWarnings,
          summary: {
            total: allWarnings.length,
            active: allWarnings.filter(w => w.isActive).length,
            expired: allWarnings.filter(w => w.expired).length,
            revoked: allWarnings.filter(w => w.revoked).length,
            totalWeight
          }
        }
      });
    }

    const totalWeight = await Warning.getTotalWeight(guildId, userId);

    res.json({
      success: true,
      data: {
        userId,
        warnings,
        summary: {
          total: warnings.length,
          totalWeight
        }
      }
    });
  } catch (error) {
    console.error('Get User Warnings Error:', error);
    res.status(500).json({
      success: false,
      error: 'Internal Server Error',
      message: 'Failed to fetch user warnings'
    });
  }
});

router.post('/', authenticateJWT, requireModerator, checkRoleHierarchy, apiLimiter, async (req, res) => {
  try {
    const { guildId } = req.params;
    const {
      targetId,
      targetUsername,
      reason,
      severity = 'medium',
      weight = 1,
      duration = null,
      evidence = []
    } = req.body;

    if (!targetId || !targetUsername || !reason) {
      return res.status(400).json({
        success: false,
        error: 'Bad Request',
        message: 'targetId, targetUsername, and reason are required'
      });
    }

    const warningId = Warning.generateWarningId();

    const warning = new Warning({
      guildId,
      warningId,
      targetId,
      targetUsername,
      issuerId: req.user.id,
      issuerUsername: req.user.username,
      issuerAvatar: req.user.avatar,
      reason,
      severity,
      weight,
      duration,
      evidence,
      expiresAt: duration ? new Date(Date.now() + duration * 1000) : null
    });

    await warning.save();

    const staff = await Staff.findOne({ guildId, userId: targetId });
    if (staff) {
      await staff.addWarning(warning._id);
    }

    await ActivityLog.createLog({
      guildId,
      type: 'member_warned',
      severity: severity === 'critical' ? 'high' : severity,
      actor: {
        userId: req.user.id,
        username: req.user.username,
        avatar: req.user.avatar
      },
      target: { userId: targetId, username: targetUsername },
      details: {
        description: `Warned ${targetUsername}: ${reason}`,
        severity,
        weight
      },
      relatedEntities: { warningId: warning.warningId },
      source: { type: 'dashboard' }
    });

    res.status(201).json({
      success: true,
      data: { warning }
    });
  } catch (error) {
    console.error('Create Warning Error:', error);
    res.status(500).json({
      success: false,
      error: 'Internal Server Error',
      message: 'Failed to create warning'
    });
  }
});

router.get('/:warningId', authenticateJWT, requireModerator, apiLimiter, async (req, res) => {
  try {
    const { guildId, warningId } = req.params;

    const warning = await Warning.findOne({ guildId, warningId: warningId });

    if (!warning) {
      return res.status(404).json({
        success: false,
        error: 'Not Found',
        message: 'Warning not found'
      });
    }

    res.json({
      success: true,
      data: { warning }
    });
  } catch (error) {
    console.error('Get Warning Error:', error);
    res.status(500).json({
      success: false,
      error: 'Internal Server Error',
      message: 'Failed to fetch warning'
    });
  }
});

router.post('/:warningId/revoke', authenticateJWT, requireModerator, apiLimiter, async (req, res) => {
  try {
    const { guildId, warningId } = req.params;
    const { reason } = req.body;

    if (!reason) {
      return res.status(400).json({
        success: false,
        error: 'Bad Request',
        message: 'Revoke reason is required'
      });
    }

    const warning = await Warning.findOne({ guildId, warningId: warningId });

    if (!warning) {
      return res.status(404).json({
        success: false,
        error: 'Not Found',
        message: 'Warning not found'
      });
    }

    if (warning.revoked) {
      return res.status(400).json({
        success: false,
        error: 'Bad Request',
        message: 'Warning is already revoked'
      });
    }

    await warning.revoke(req.user, reason);

    const staff = await Staff.findOne({ guildId, userId: warning.targetId });
    if (staff) {
      await staff.resolveWarning();
    }

    await ActivityLog.createLog({
      guildId,
      type: 'dashboard_action',
      severity: 'medium',
      actor: {
        userId: req.user.id,
        username: req.user.username,
        avatar: req.user.avatar
      },
      target: { userId: warning.targetId, username: warning.targetUsername },
      details: {
        description: `Revoked warning for ${warning.targetUsername}`,
        reason
      },
      relatedEntities: { warningId: warning.warningId },
      source: { type: 'dashboard' }
    });

    res.json({
      success: true,
      data: { warning }
    });
  } catch (error) {
    console.error('Revoke Warning Error:', error);
    res.status(500).json({
      success: false,
      error: 'Internal Server Error',
      message: 'Failed to revoke warning'
    });
  }
});

router.post('/:warningId/appeal', authenticateJWT, apiLimiter, async (req, res) => {
  try {
    const { guildId, warningId } = req.params;
    const { reason } = req.body;

    if (!reason) {
      return res.status(400).json({
        success: false,
        error: 'Bad Request',
        message: 'Appeal reason is required'
      });
    }

    const warning = await Warning.findOne({ guildId, warningId: warningId });

    if (!warning) {
      return res.status(404).json({
        success: false,
        error: 'Not Found',
        message: 'Warning not found'
      });
    }

    if (warning.targetId !== req.user.id) {
      return res.status(403).json({
        success: false,
        error: 'Forbidden',
        message: 'You can only appeal your own warnings'
      });
    }

    await warning.submitAppeal(reason);

    res.json({
      success: true,
      data: { warning }
    });
  } catch (error) {
    console.error('Submit Appeal Error:', error);
    res.status(400).json({
      success: false,
      error: 'Bad Request',
      message: error.message
    });
  }
});

router.post('/:warningId/appeal/review', authenticateJWT, requireModerator, apiLimiter, async (req, res) => {
  try {
    const { guildId, warningId } = req.params;
    const { decision, reason } = req.body;

    if (!decision || !['approved', 'denied'].includes(decision)) {
      return res.status(400).json({
        success: false,
        error: 'Bad Request',
        message: 'Decision must be approved or denied'
      });
    }

    if (!reason) {
      return res.status(400).json({
        success: false,
        error: 'Bad Request',
        message: 'Review reason is required'
      });
    }

    const warning = await Warning.findOne({ guildId, warningId: warningId });

    if (!warning) {
      return res.status(404).json({
        success: false,
        error: 'Not Found',
        message: 'Warning not found'
      });
    }

    await warning.reviewAppeal(decision, req.user, reason);

    const staff = await Staff.findOne({ guildId, userId: warning.targetId });
    if (staff && decision === 'approved') {
      await staff.resolveWarning();
    }

    await ActivityLog.createLog({
      guildId,
      type: 'dashboard_action',
      severity: 'medium',
      actor: {
        userId: req.user.id,
        username: req.user.username,
        avatar: req.user.avatar
      },
      target: { userId: warning.targetId, username: warning.targetUsername },
      details: {
        description: `${decision === 'approved' ? 'Approved' : 'Denied'} warning appeal for ${warning.targetUsername}`,
        reason
      },
      relatedEntities: { warningId: warning.warningId },
      source: { type: 'dashboard' }
    });

    res.json({
      success: true,
      data: { warning }
    });
  } catch (error) {
    console.error('Review Appeal Error:', error);
    res.status(500).json({
      success: false,
      error: 'Internal Server Error',
      message: 'Failed to review appeal'
    });
  }
});

export default router;
