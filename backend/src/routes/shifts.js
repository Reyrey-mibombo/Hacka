import express from 'express';
import { authenticateJWT } from '../middleware/auth.js';
import { requireModerator } from '../middleware/permissions.js';
import { apiLimiter } from '../middleware/rateLimiter.js';
import { Shift, Staff, ActivityLog } from '../models/index.js';

const router = express.Router({ mergeParams: true });

router.get('/', authenticateJWT, requireModerator, apiLimiter, async (req, res) => {
  try {
    const { guildId } = req.params;
    const { status = 'all', userId, page = 1, limit = 20, startDate, endDate } = req.query;

    const query = { guildId };

    if (status !== 'all') {
      query.status = status;
    }

    if (userId) {
      query.userId = userId;
    }

    if (startDate || endDate) {
      query.startTime = {};
      if (startDate) query.startTime.$gte = new Date(startDate);
      if (endDate) query.startTime.$lte = new Date(endDate);
    }

    const skip = (parseInt(page) - 1) * parseInt(limit);

    const [shifts, total] = await Promise.all([
      Shift.find(query)
        .sort({ startTime: -1 })
        .skip(skip)
        .limit(parseInt(limit))
        .select('-__v'),
      Shift.countDocuments(query)
    ]);

    const activeShifts = await Shift.find({ guildId, status: { $in: ['active', 'paused'] } })
      .select('-__v');

    res.json({
      success: true,
      data: {
        shifts: shifts.map(s => ({
          id: s._id,
          userId: s.userId,
          username: s.username,
          startTime: s.startTime,
          endTime: s.endTime,
          duration: s.duration,
          status: s.status,
          pointsEarned: s.pointsEarned,
          basePoints: s.basePoints,
          bonusPoints: s.bonusPoints,
          notes: s.notes,
          isApproved: s.isApproved,
          approvedBy: s.approvedBy,
          activity: s.activity
        })),
        activeShifts: activeShifts.map(s => ({
          id: s._id,
          userId: s.userId,
          username: s.username,
          startTime: s.startTime,
          status: s.status,
          currentDuration: s.currentDuration
        })),
        pagination: {
          page: parseInt(page),
          limit: parseInt(limit),
          total,
          pages: Math.ceil(total / parseInt(limit))
        }
      }
    });
  } catch (error) {
    console.error('Get Shifts Error:', error);
    res.status(500).json({
      success: false,
      error: 'Internal Server Error',
      message: 'Failed to fetch shifts'
    });
  }
});

router.get('/stats', authenticateJWT, requireModerator, apiLimiter, async (req, res) => {
  try {
    const { guildId } = req.params;
    const { days = 30, userId } = req.query;

    let stats;
    if (userId) {
      stats = await Shift.getStaffStats(guildId, userId, parseInt(days));
      const staff = await Staff.findOne({ guildId, userId });
      stats.user = staff ? {
        userId: staff.userId,
        username: staff.username,
        avatar: staff.getAvatarURL(),
        rank: staff.rank
      } : null;
    } else {
      stats = await Shift.getGuildStats(guildId, parseInt(days));
    }

    const dailyStats = await Shift.aggregate([
      {
        $match: {
          guildId,
          status: 'completed',
          startTime: { $gte: new Date(Date.now() - parseInt(days) * 24 * 60 * 60 * 1000) }
        }
      },
      {
        $group: {
          _id: { $dateToString: { format: '%Y-%m-%d', date: '$startTime' } },
          shifts: { $sum: 1 },
          duration: { $sum: '$duration' },
          points: { $sum: '$pointsEarned' }
        }
      },
      { $sort: { _id: 1 } }
    ]);

    res.json({
      success: true,
      data: {
        summary: stats,
        daily: dailyStats,
        period: {
          days: parseInt(days),
          since: new Date(Date.now() - parseInt(days) * 24 * 60 * 60 * 1000)
        }
      }
    });
  } catch (error) {
    console.error('Get Shift Stats Error:', error);
    res.status(500).json({
      success: false,
      error: 'Internal Server Error',
      message: 'Failed to fetch shift statistics'
    });
  }
});

router.post('/start', authenticateJWT, apiLimiter, async (req, res) => {
  try {
    const { guildId } = req.params;
    const userId = req.user.id;

    const existingShift = await Shift.getActiveShift(guildId, userId);

    if (existingShift) {
      return res.status(409).json({
        success: false,
        error: 'Conflict',
        message: 'You already have an active shift',
        data: { shift: existingShift }
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

    const shift = new Shift({
      guildId,
      userId,
      username: staff.username,
      staffRecordId: staff._id,
      startTime: new Date(),
      status: 'active',
      metadata: {
        ipAddress: req.ip,
        userAgent: req.headers['user-agent'],
        startedFromDashboard: true
      }
    });

    await shift.save();
    await staff.startShift();

    await ActivityLog.createLog({
      guildId,
      type: 'staff_shift_start',
      severity: 'info',
      actor: {
        userId: req.user.id,
        username: req.user.username,
        avatar: req.user.avatar
      },
      details: {
        description: `${staff.username} started a shift`
      },
      relatedEntities: { shiftId: shift._id },
      source: { type: 'dashboard' }
    });

    res.status(201).json({
      success: true,
      data: { shift }
    });
  } catch (error) {
    console.error('Start Shift Error:', error);
    res.status(500).json({
      success: false,
      error: 'Internal Server Error',
      message: 'Failed to start shift'
    });
  }
});

router.post('/end', authenticateJWT, apiLimiter, async (req, res) => {
  try {
    const { guildId } = req.params;
    const userId = req.user.id;
    const { notes } = req.body;

    const shift = await Shift.getActiveShift(guildId, userId);

    if (!shift) {
      return res.status(404).json({
        success: false,
        error: 'Not Found',
        message: 'No active shift found'
      });
    }

    const staff = await Staff.findOne({ guildId, userId });

    await shift.end(userId, notes);
    await staff.endShift(shift.duration, shift.pointsEarned);

    await ActivityLog.createLog({
      guildId,
      type: 'staff_shift_end',
      severity: 'info',
      actor: {
        userId: req.user.id,
        username: req.user.username,
        avatar: req.user.avatar
      },
      details: {
        description: `${staff.username} ended a shift`,
        duration: shift.duration,
        pointsEarned: shift.pointsEarned
      },
      relatedEntities: { shiftId: shift._id },
      source: { type: 'dashboard' }
    });

    res.json({
      success: true,
      data: {
        shift,
        staff: {
          shifts: staff.shifts,
          points: staff.points
        }
      }
    });
  } catch (error) {
    console.error('End Shift Error:', error);
    res.status(500).json({
      success: false,
      error: 'Internal Server Error',
      message: 'Failed to end shift'
    });
  }
});

router.post('/:shiftId/pause', authenticateJWT, apiLimiter, async (req, res) => {
  try {
    const { guildId, shiftId } = req.params;
    const { reason } = req.body;
    const userId = req.user.id;

    const shift = await Shift.findOne({ _id: shiftId, guildId, userId });

    if (!shift) {
      return res.status(404).json({
        success: false,
        error: 'Not Found',
        message: 'Shift not found'
      });
    }

    await shift.pause(reason);

    res.json({
      success: true,
      data: { shift }
    });
  } catch (error) {
    console.error('Pause Shift Error:', error);
    res.status(400).json({
      success: false,
      error: 'Bad Request',
      message: error.message
    });
  }
});

router.post('/:shiftId/resume', authenticateJWT, apiLimiter, async (req, res) => {
  try {
    const { guildId, shiftId } = req.params;
    const userId = req.user.id;

    const shift = await Shift.findOne({ _id: shiftId, guildId, userId });

    if (!shift) {
      return res.status(404).json({
        success: false,
        error: 'Not Found',
        message: 'Shift not found'
      });
    }

    await shift.resume();

    res.json({
      success: true,
      data: { shift }
    });
  } catch (error) {
    console.error('Resume Shift Error:', error);
    res.status(400).json({
      success: false,
      error: 'Bad Request',
      message: error.message
    });
  }
});

router.post('/:shiftId/approve', authenticateJWT, requireModerator, apiLimiter, async (req, res) => {
  try {
    const { guildId, shiftId } = req.params;

    const shift = await Shift.findOne({ _id: shiftId, guildId });

    if (!shift) {
      return res.status(404).json({
        success: false,
        error: 'Not Found',
        message: 'Shift not found'
      });
    }

    await shift.approve(req.user.id);

    await ActivityLog.createLog({
      guildId,
      type: 'dashboard_action',
      severity: 'low',
      actor: {
        userId: req.user.id,
        username: req.user.username,
        avatar: req.user.avatar
      },
      target: { userId: shift.userId, username: shift.username },
      details: {
        description: `Approved shift for ${shift.username}`,
        duration: shift.duration,
        pointsEarned: shift.pointsEarned
      },
      relatedEntities: { shiftId: shift._id },
      source: { type: 'dashboard' }
    });

    res.json({
      success: true,
      data: { shift }
    });
  } catch (error) {
    console.error('Approve Shift Error:', error);
    res.status(500).json({
      success: false,
      error: 'Internal Server Error',
      message: 'Failed to approve shift'
    });
  }
});

router.post('/:shiftId/bonus', authenticateJWT, requireModerator, apiLimiter, async (req, res) => {
  try {
    const { guildId, shiftId } = req.params;
    const { points, reason } = req.body;

    if (!points || points < 1) {
      return res.status(400).json({
        success: false,
        error: 'Bad Request',
        message: 'Bonus points must be at least 1'
      });
    }

    const shift = await Shift.findOne({ _id: shiftId, guildId });

    if (!shift) {
      return res.status(404).json({
        success: false,
        error: 'Not Found',
        message: 'Shift not found'
      });
    }

    await shift.addBonusPoints(points, reason, req.user.id);

    res.json({
      success: true,
      data: { shift }
    });
  } catch (error) {
    console.error('Add Bonus Points Error:', error);
    res.status(500).json({
      success: false,
      error: 'Internal Server Error',
      message: 'Failed to add bonus points'
    });
  }
});

export default router;
