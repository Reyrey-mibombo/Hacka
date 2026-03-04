import express from 'express';
import { authenticateJWT } from '../middleware/auth.js';
import { requireManageServer, requireModerator, checkRoleHierarchy } from '../middleware/permissions.js';
import { apiLimiter } from '../middleware/rateLimiter.js';
import { Staff, Shift, Warning, Promotion, ActivityLog } from '../models/index.js';

const router = express.Router({ mergeParams: true });

router.get('/', authenticateJWT, requireModerator, apiLimiter, async (req, res) => {
  try {
    const { guildId } = req.params;
    const { status = 'active', page = 1, limit = 20, search = '', sortBy = 'points' } = req.query;

    const query = { guildId };

    if (status === 'active') {
      query.isActive = true;
    } else if (status === 'inactive') {
      query.isActive = false;
    } else if (status === 'on_leave') {
      query.isOnLeave = true;
    }

    if (search) {
      query.$or = [
        { username: { $regex: search, $options: 'i' } },
        { nickname: { $regex: search, $options: 'i' } },
        { globalName: { $regex: search, $options: 'i' } }
      ];
    }

    const sortOptions = {};
    if (sortBy === 'points') sortOptions.points = -1;
    else if (sortBy === 'shifts') sortOptions['shifts.total'] = -1;
    else if (sortBy === 'joined') sortOptions.joinedAt = -1;
    else if (sortBy === 'name') sortOptions.username = 1;

    const skip = (parseInt(page) - 1) * parseInt(limit);

    const [staff, total] = await Promise.all([
      Staff.find(query)
        .sort(sortOptions)
        .skip(skip)
        .limit(parseInt(limit))
        .select('-__v'),
      Staff.countDocuments(query)
    ]);

    const activeShifts = await Staff.countDocuments({ guildId, 'shifts.active': true });

    res.json({
      success: true,
      data: {
        staff: staff.map(s => ({
          id: s._id,
          userId: s.userId,
          username: s.username,
          globalName: s.globalName,
          nickname: s.nickname,
          avatar: s.getAvatarURL(),
          rank: s.rank,
          rankLevel: s.rankLevel,
          points: s.points,
          shifts: s.shifts,
          warnings: s.warnings,
          isActive: s.isActive,
          isOnLeave: s.isOnLeave,
          joinedAt: s.joinedAt,
          lastActiveAt: s.lastActiveAt,
          department: s.department
        })),
        pagination: {
          page: parseInt(page),
          limit: parseInt(limit),
          total,
          pages: Math.ceil(total / parseInt(limit))
        },
        summary: {
          total,
          active: await Staff.countDocuments({ guildId, isActive: true }),
          onShift: activeShifts,
          onLeave: await Staff.countDocuments({ guildId, isOnLeave: true })
        }
      }
    });
  } catch (error) {
    console.error('Get Staff Error:', error);
    res.status(500).json({
      success: false,
      error: 'Internal Server Error',
      message: 'Failed to fetch staff members'
    });
  }
});

router.post('/', authenticateJWT, requireManageServer, apiLimiter, async (req, res) => {
  try {
    const { guildId } = req.params;
    const { userId, username, rank = 'Trial Moderator', ...otherData } = req.body;

    if (!userId || !username) {
      return res.status(400).json({
        success: false,
        error: 'Bad Request',
        message: 'userId and username are required'
      });
    }

    const existingStaff = await Staff.findOne({ guildId, userId });

    if (existingStaff) {
      return res.status(409).json({
        success: false,
        error: 'Conflict',
        message: 'User is already a staff member'
      });
    }

    const staff = new Staff({
      guildId,
      userId,
      username,
      rank,
      ...otherData,
      joinedAt: new Date()
    });

    await staff.save();

    await ActivityLog.createLog({
      guildId,
      type: 'member_joined',
      severity: 'medium',
      actor: {
        userId: req.user.id,
        username: req.user.username,
        avatar: req.user.avatar
      },
      target: { userId, username },
      details: {
        description: `Added ${username} as staff member with rank ${rank}`
      },
      source: { type: 'dashboard' }
    });

    res.status(201).json({
      success: true,
      data: { staff }
    });
  } catch (error) {
    console.error('Create Staff Error:', error);
    res.status(500).json({
      success: false,
      error: 'Internal Server Error',
      message: 'Failed to add staff member'
    });
  }
});

router.get('/:userId', authenticateJWT, requireModerator, apiLimiter, async (req, res) => {
  try {
    const { guildId, userId } = req.params;

    const staff = await Staff.findOne({ guildId, userId });

    if (!staff) {
      return res.status(404).json({
        success: false,
        error: 'Not Found',
        message: 'Staff member not found'
      });
    }

    const [recentShifts, recentWarnings, promotions] = await Promise.all([
      Shift.find({ guildId, userId })
        .sort({ startTime: -1 })
        .limit(10)
        .select('-__v'),
      Warning.find({ guildId, targetId: userId })
        .sort({ createdAt: -1 })
        .limit(10)
        .select('-__v'),
      Promotion.find({ guildId, userId })
        .sort({ processedAt: -1 })
        .limit(10)
        .select('-__v')
    ]);

    res.json({
      success: true,
      data: {
        staff: {
          id: staff._id,
          userId: staff.userId,
          username: staff.username,
          globalName: staff.globalName,
          nickname: staff.nickname,
          avatar: staff.getAvatarURL(),
          rank: staff.rank,
          rankLevel: staff.rankLevel,
          points: staff.points,
          totalPointsEarned: staff.totalPointsEarned,
          shifts: staff.shifts,
          warnings: staff.warnings,
          promotions: staff.promotions,
          demotions: staff.demotions,
          metrics: staff.metrics,
          isActive: staff.isActive,
          isOnLeave: staff.isOnLeave,
          leaveReason: staff.leaveReason,
          notes: staff.notes,
          department: staff.department,
          joinedAt: staff.joinedAt,
          lastActiveAt: staff.lastActiveAt,
          createdAt: staff.createdAt,
          updatedAt: staff.updatedAt
        },
        recentShifts,
        recentWarnings,
        promotionHistory: promotions
      }
    });
  } catch (error) {
    console.error('Get Staff Member Error:', error);
    res.status(500).json({
      success: false,
      error: 'Internal Server Error',
      message: 'Failed to fetch staff member details'
    });
  }
});

router.patch('/:userId', authenticateJWT, requireManageServer, apiLimiter, async (req, res) => {
  try {
    const { guildId, userId } = req.params;
    const updates = req.body;

    const allowedFields = ['nickname', 'rank', 'department', 'notes', 'isActive', 'isOnLeave', 'leaveReason'];
    const filteredUpdates = {};

    for (const field of allowedFields) {
      if (updates[field] !== undefined) {
        filteredUpdates[field] = updates[field];
      }
    }

    if (Object.keys(filteredUpdates).length === 0) {
      return res.status(400).json({
        success: false,
        error: 'Bad Request',
        message: 'No valid fields to update'
      });
    }

    const staff = await Staff.findOneAndUpdate(
      { guildId, userId },
      { $set: filteredUpdates },
      { new: true }
    );

    if (!staff) {
      return res.status(404).json({
        success: false,
        error: 'Not Found',
        message: 'Staff member not found'
      });
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
      target: { userId: staff.userId, username: staff.username },
      details: {
        description: `Updated staff member ${staff.username}`,
        changes: Object.keys(filteredUpdates)
      },
      source: { type: 'dashboard' }
    });

    res.json({
      success: true,
      data: { staff }
    });
  } catch (error) {
    console.error('Update Staff Error:', error);
    res.status(500).json({
      success: false,
      error: 'Internal Server Error',
      message: 'Failed to update staff member'
    });
  }
});

router.delete('/:userId', authenticateJWT, requireManageServer, checkRoleHierarchy, apiLimiter, async (req, res) => {
  try {
    const { guildId, userId } = req.params;

    const staff = await Staff.findOne({ guildId, userId });

    if (!staff) {
      return res.status(404).json({
        success: false,
        error: 'Not Found',
        message: 'Staff member not found'
      });
    }

    await Staff.deleteOne({ guildId, userId });

    await ActivityLog.createLog({
      guildId,
      type: 'dashboard_action',
      severity: 'high',
      actor: {
        userId: req.user.id,
        username: req.user.username,
        avatar: req.user.avatar
      },
      target: { userId: staff.userId, username: staff.username },
      details: {
        description: `Removed ${staff.username} from staff`
      },
      source: { type: 'dashboard' }
    });

    res.json({
      success: true,
      message: 'Staff member removed successfully'
    });
  } catch (error) {
    console.error('Remove Staff Error:', error);
    res.status(500).json({
      success: false,
      error: 'Internal Server Error',
      message: 'Failed to remove staff member'
    });
  }
});

router.post('/:userId/points', authenticateJWT, requireManageServer, apiLimiter, async (req, res) => {
  try {
    const { guildId, userId } = req.params;
    const { points, reason = 'Manual adjustment' } = req.body;

    if (points === undefined || typeof points !== 'number') {
      return res.status(400).json({
        success: false,
        error: 'Bad Request',
        message: 'Points must be a number'
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

    const result = await staff.addPoints(points, reason);

    await ActivityLog.createLog({
      guildId,
      type: 'dashboard_action',
      severity: 'low',
      actor: {
        userId: req.user.id,
        username: req.user.username,
        avatar: req.user.avatar
      },
      target: { userId: staff.userId, username: staff.username },
      details: {
        description: `${points > 0 ? 'Added' : 'Removed'} ${Math.abs(points)} points to ${staff.username}`,
        reason
      },
      source: { type: 'dashboard' }
    });

    res.json({
      success: true,
      data: {
        staff,
        pointsChange: result
      }
    });
  } catch (error) {
    console.error('Update Points Error:', error);
    res.status(500).json({
      success: false,
      error: 'Internal Server Error',
      message: 'Failed to update points'
    });
  }
});

router.post('/:userId/leave', authenticateJWT, requireManageServer, apiLimiter, async (req, res) => {
  try {
    const { guildId, userId } = req.params;
    const { reason, endDate } = req.body;

    const staff = await Staff.findOneAndUpdate(
      { guildId, userId },
      {
        $set: {
          isOnLeave: true,
          leaveReason: reason,
          leaveStartedAt: new Date(),
          leaveEndsAt: endDate ? new Date(endDate) : null
        }
      },
      { new: true }
    );

    if (!staff) {
      return res.status(404).json({
        success: false,
        error: 'Not Found',
        message: 'Staff member not found'
      });
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
      target: { userId: staff.userId, username: staff.username },
      details: {
        description: `Put ${staff.username} on leave`,
        reason,
        endDate
      },
      source: { type: 'dashboard' }
    });

    res.json({
      success: true,
      data: { staff }
    });
  } catch (error) {
    console.error('Set Leave Error:', error);
    res.status(500).json({
      success: false,
      error: 'Internal Server Error',
      message: 'Failed to set leave status'
    });
  }
});

router.post('/:userId/return', authenticateJWT, requireManageServer, apiLimiter, async (req, res) => {
  try {
    const { guildId, userId } = req.params;

    const staff = await Staff.findOneAndUpdate(
      { guildId, userId },
      {
        $set: {
          isOnLeave: false,
          leaveReason: null,
          leaveStartedAt: null,
          leaveEndsAt: null
        }
      },
      { new: true }
    );

    if (!staff) {
      return res.status(404).json({
        success: false,
        error: 'Not Found',
        message: 'Staff member not found'
      });
    }

    await ActivityLog.createLog({
      guildId,
      type: 'dashboard_action',
      severity: 'low',
      actor: {
        userId: req.user.id,
        username: req.user.username,
        avatar: req.user.avatar
      },
      target: { userId: staff.userId, username: staff.username },
      details: {
        description: `${staff.username} returned from leave`
      },
      source: { type: 'dashboard' }
    });

    res.json({
      success: true,
      data: { staff }
    });
  } catch (error) {
    console.error('Return From Leave Error:', error);
    res.status(500).json({
      success: false,
      error: 'Internal Server Error',
      message: 'Failed to process return from leave'
    });
  }
});

export default router;
