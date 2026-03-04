import express from 'express';
import { authenticateJWT } from '../middleware/auth.js';
import { requireManageServer, checkRoleHierarchy } from '../middleware/permissions.js';
import { apiLimiter } from '../middleware/rateLimiter.js';
import { Promotion, RankRequirement, PromotionRequest, Staff, ActivityLog } from '../models/index.js';

const router = express.Router({ mergeParams: true });

router.get('/requirements', authenticateJWT, requireManageServer, apiLimiter, async (req, res) => {
  try {
    const { guildId } = req.params;

    const requirements = await RankRequirement.find({ guildId, isActive: true })
      .sort({ order: 1 })
      .select('-__v');

    res.json({
      success: true,
      data: { requirements }
    });
  } catch (error) {
    console.error('Get Rank Requirements Error:', error);
    res.status(500).json({
      success: false,
      error: 'Internal Server Error',
      message: 'Failed to fetch rank requirements'
    });
  }
});

router.post('/requirements', authenticateJWT, requireManageServer, apiLimiter, async (req, res) => {
  try {
    const { guildId } = req.params;
    const {
      rankName,
      rankLevel,
      displayName,
      description,
      color,
      roleId,
      requirements,
      benefits,
      autoPromote,
      requiresApproval,
      order
    } = req.body;

    if (!rankName || rankLevel === undefined || !displayName || order === undefined) {
      return res.status(400).json({
        success: false,
        error: 'Bad Request',
        message: 'rankName, rankLevel, displayName, and order are required'
      });
    }

    const existingRank = await RankRequirement.findOne({ guildId, rankName });

    if (existingRank) {
      return res.status(409).json({
        success: false,
        error: 'Conflict',
        message: 'Rank with this name already exists'
      });
    }

    const rankRequirement = new RankRequirement({
      guildId,
      rankName,
      rankLevel,
      displayName,
      description,
      color,
      roleId,
      requirements: requirements || {},
      benefits: benefits || {},
      autoPromote: autoPromote ?? false,
      requiresApproval: requiresApproval ?? true,
      order
    });

    await rankRequirement.save();

    await ActivityLog.createLog({
      guildId,
      type: 'dashboard_action',
      severity: 'medium',
      actor: {
        userId: req.user.id,
        username: req.user.username,
        avatar: req.user.avatar
      },
      details: {
        description: `Created rank requirement: ${displayName}`
      },
      source: { type: 'dashboard' }
    });

    res.status(201).json({
      success: true,
      data: { requirement: rankRequirement }
    });
  } catch (error) {
    console.error('Create Rank Requirement Error:', error);
    res.status(500).json({
      success: false,
      error: 'Internal Server Error',
      message: 'Failed to create rank requirement'
    });
  }
});

router.patch('/requirements/:rankId', authenticateJWT, requireManageServer, apiLimiter, async (req, res) => {
  try {
    const { guildId, rankId } = req.params;
    const updates = req.body;

    const allowedFields = ['displayName', 'description', 'color', 'roleId', 'requirements', 'benefits', 'autoPromote', 'requiresApproval', 'order', 'isActive'];
    const filteredUpdates = {};

    for (const field of allowedFields) {
      if (updates[field] !== undefined) {
        filteredUpdates[field] = updates[field];
      }
    }

    const rankRequirement = await RankRequirement.findOneAndUpdate(
      { _id: rankId, guildId },
      { $set: filteredUpdates },
      { new: true }
    );

    if (!rankRequirement) {
      return res.status(404).json({
        success: false,
        error: 'Not Found',
        message: 'Rank requirement not found'
      });
    }

    res.json({
      success: true,
      data: { requirement: rankRequirement }
    });
  } catch (error) {
    console.error('Update Rank Requirement Error:', error);
    res.status(500).json({
      success: false,
      error: 'Internal Server Error',
      message: 'Failed to update rank requirement'
    });
  }
});

router.delete('/requirements/:rankId', authenticateJWT, requireManageServer, apiLimiter, async (req, res) => {
  try {
    const { guildId, rankId } = req.params;

    const rankRequirement = await RankRequirement.findOneAndDelete({ _id: rankId, guildId });

    if (!rankRequirement) {
      return res.status(404).json({
        success: false,
        error: 'Not Found',
        message: 'Rank requirement not found'
      });
    }

    res.json({
      success: true,
      message: 'Rank requirement deleted successfully'
    });
  } catch (error) {
    console.error('Delete Rank Requirement Error:', error);
    res.status(500).json({
      success: false,
      error: 'Internal Server Error',
      message: 'Failed to delete rank requirement'
    });
  }
});

router.get('/', authenticateJWT, requireManageServer, apiLimiter, async (req, res) => {
  try {
    const { guildId } = req.params;
    const { userId, type, page = 1, limit = 20 } = req.query;

    const query = { guildId };

    if (userId) query.userId = userId;
    if (type) query.type = type;

    const skip = (parseInt(page) - 1) * parseInt(limit);

    const [promotions, total] = await Promise.all([
      Promotion.find(query)
        .sort({ processedAt: -1 })
        .skip(skip)
        .limit(parseInt(limit))
        .select('-__v'),
      Promotion.countDocuments(query)
    ]);

    res.json({
      success: true,
      data: {
        promotions,
        pagination: {
          page: parseInt(page),
          limit: parseInt(limit),
          total,
          pages: Math.ceil(total / parseInt(limit))
        }
      }
    });
  } catch (error) {
    console.error('Get Promotions Error:', error);
    res.status(500).json({
      success: false,
      error: 'Internal Server Error',
      message: 'Failed to fetch promotions'
    });
  }
});

router.post('/', authenticateJWT, requireManageServer, checkRoleHierarchy, apiLimiter, async (req, res) => {
  try {
    const { guildId } = req.params;
    const {
      userId,
      toRank,
      reason,
      probationary = false,
      probationDuration = null
    } = req.body;

    if (!userId || !toRank || !reason) {
      return res.status(400).json({
        success: false,
        error: 'Bad Request',
        message: 'userId, toRank, and reason are required'
      });
    }

    const staff = await Staff.findOne({ guildId, userId });

    if (!staff) {
      return res.status(404).json({
        success: false,
        error: 'Not Found',
        message: 'Staff member not found'
      });
    }

    if (staff.rank === toRank) {
      return res.status(400).json({
        success: false,
        error: 'Bad Request',
        message: 'User is already this rank'
      });
    }

    const rankRequirement = await RankRequirement.findOne({ guildId, rankName: toRank });

    const promotion = new Promotion({
      guildId,
      userId,
      username: staff.username,
      avatar: staff.avatar,
      type: 'promotion',
      fromRank: staff.rank,
      toRank,
      fromLevel: staff.rankLevel,
      toLevel: (staff.rankLevel || 0) + 1,
      fromPoints: staff.points,
      toPoints: staff.points,
      processedBy: {
        userId: req.user.id,
        username: req.user.username,
        avatar: req.user.avatar
      },
      reason,
      probationary,
      probationEndDate: probationDuration ? new Date(Date.now() + probationDuration * 24 * 60 * 60 * 1000) : null,
      probationStatus: probationary ? 'pending' : null,
      requirements: rankRequirement?.requirements || {}
    });

    await promotion.save();

    await staff.promote(toRank, req.user, reason);

    await ActivityLog.createLog({
      guildId,
      type: 'promotion_given',
      severity: 'medium',
      actor: {
        userId: req.user.id,
        username: req.user.username,
        avatar: req.user.avatar
      },
      target: { userId, username: staff.username },
      details: {
        description: `Promoted ${staff.username} to ${toRank}`,
        reason,
        probationary
      },
      source: { type: 'dashboard' }
    });

    res.status(201).json({
      success: true,
      data: { promotion, staff }
    });
  } catch (error) {
    console.error('Create Promotion Error:', error);
    res.status(500).json({
      success: false,
      error: 'Internal Server Error',
      message: 'Failed to create promotion'
    });
  }
});

router.post('/demote', authenticateJWT, requireManageServer, checkRoleHierarchy, apiLimiter, async (req, res) => {
  try {
    const { guildId } = req.params;
    const { userId, toRank, reason } = req.body;

    if (!userId || !toRank || !reason) {
      return res.status(400).json({
        success: false,
        error: 'Bad Request',
        message: 'userId, toRank, and reason are required'
      });
    }

    const staff = await Staff.findOne({ guildId, userId });

    if (!staff) {
      return res.status(404).json({
        success: false,
        error: 'Not Found',
        message: 'Staff member not found'
      });
    }

    const demotion = new Promotion({
      guildId,
      userId,
      username: staff.username,
      avatar: staff.avatar,
      type: 'demotion',
      fromRank: staff.rank,
      toRank,
      fromLevel: staff.rankLevel,
      toLevel: Math.max(0, (staff.rankLevel || 0) - 1),
      processedBy: {
        userId: req.user.id,
        username: req.user.username,
        avatar: req.user.avatar
      },
      reason
    });

    await demotion.save();

    staff.demotions.push({
      fromRank: staff.rank,
      toRank,
      demotedBy: req.user.id,
      demotedByUsername: req.user.username,
      reason,
      timestamp: new Date()
    });

    staff.rank = toRank;
    staff.rankLevel = Math.max(0, (staff.rankLevel || 0) - 1);
    await staff.save();

    await ActivityLog.createLog({
      guildId,
      type: 'demotion_given',
      severity: 'high',
      actor: {
        userId: req.user.id,
        username: req.user.username,
        avatar: req.user.avatar
      },
      target: { userId, username: staff.username },
      details: {
        description: `Demoted ${staff.username} to ${toRank}`,
        reason
      },
      source: { type: 'dashboard' }
    });

    res.status(201).json({
      success: true,
      data: { demotion, staff }
    });
  } catch (error) {
    console.error('Create Demotion Error:', error);
    res.status(500).json({
      success: false,
      error: 'Internal Server Error',
      message: 'Failed to create demotion'
    });
  }
});

router.get('/requests', authenticateJWT, requireManageServer, apiLimiter, async (req, res) => {
  try {
    const { guildId } = req.params;
    const { status = 'pending', page = 1, limit = 20 } = req.query;

    const query = { guildId };
    if (status !== 'all') {
      query.status = status;
    }

    const skip = (parseInt(page) - 1) * parseInt(limit);

    const [requests, total] = await Promise.all([
      PromotionRequest.find(query)
        .sort({ requestedAt: -1 })
        .skip(skip)
        .limit(parseInt(limit))
        .select('-__v'),
      PromotionRequest.countDocuments(query)
    ]);

    res.json({
      success: true,
      data: {
        requests,
        pagination: {
          page: parseInt(page),
          limit: parseInt(limit),
          total,
          pages: Math.ceil(total / parseInt(limit))
        }
      }
    });
  } catch (error) {
    console.error('Get Promotion Requests Error:', error);
    res.status(500).json({
      success: false,
      error: 'Internal Server Error',
      message: 'Failed to fetch promotion requests'
    });
  }
});

router.post('/requests', authenticateJWT, apiLimiter, async (req, res) => {
  try {
    const { guildId } = req.params;
    const { requestedRank, reason } = req.body;
    const userId = req.user.id;

    if (!requestedRank || !reason) {
      return res.status(400).json({
        success: false,
        error: 'Bad Request',
        message: 'requestedRank and reason are required'
      });
    }

    const staff = await Staff.findOne({ guildId, userId });

    if (!staff) {
      return res.status(404).json({
        success: false,
        error: 'Not Found',
        message: 'Staff record not found'
      });
    }

    const existingRequest = await PromotionRequest.findOne({
      guildId,
      userId,
      status: 'pending'
    });

    if (existingRequest) {
      return res.status(409).json({
        success: false,
        error: 'Conflict',
        message: 'You already have a pending promotion request'
      });
    }

    const request = new PromotionRequest({
      guildId,
      userId,
      username: staff.username,
      currentRank: staff.rank,
      requestedRank,
      reason
    });

    await request.save();

    res.status(201).json({
      success: true,
      data: { request }
    });
  } catch (error) {
    console.error('Create Promotion Request Error:', error);
    res.status(500).json({
      success: false,
      error: 'Internal Server Error',
      message: 'Failed to create promotion request'
    });
  }
});

router.post('/requests/:requestId/review', authenticateJWT, requireManageServer, apiLimiter, async (req, res) => {
  try {
    const { guildId, requestId } = req.params;
    const { decision, notes } = req.body;

    if (!decision || !['approved', 'denied'].includes(decision)) {
      return res.status(400).json({
        success: false,
        error: 'Bad Request',
        message: 'Decision must be approved or denied'
      });
    }

    const request = await PromotionRequest.findOne({ _id: requestId, guildId });

    if (!request) {
      return res.status(404).json({
        success: false,
        error: 'Not Found',
        message: 'Promotion request not found'
      });
    }

    if (request.status !== 'pending') {
      return res.status(400).json({
        success: false,
        error: 'Bad Request',
        message: 'This request has already been reviewed'
      });
    }

    request.status = decision;
    request.reviewedBy = {
      userId: req.user.id,
      username: req.user.username,
      avatar: req.user.avatar
    };
    request.reviewedAt = new Date();
    request.reviewNotes = notes;

    await request.save();

    await ActivityLog.createLog({
      guildId,
      type: 'dashboard_action',
      severity: 'medium',
      actor: {
        userId: req.user.id,
        username: req.user.username,
        avatar: req.user.avatar
      },
      target: { userId: request.userId, username: request.username },
      details: {
        description: `${decision === 'approved' ? 'Approved' : 'Denied'} promotion request from ${request.username}`,
        notes
      },
      source: { type: 'dashboard' }
    });

    res.json({
      success: true,
      data: { request }
    });
  } catch (error) {
    console.error('Review Promotion Request Error:', error);
    res.status(500).json({
      success: false,
      error: 'Internal Server Error',
      message: 'Failed to review promotion request'
    });
  }
});

export default router;
