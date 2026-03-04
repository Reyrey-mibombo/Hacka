import express from 'express';
import { authenticateJWT } from '../middleware/auth.js';
import { requireGuildAccess } from '../middleware/permissions.js';
import { apiLimiter } from '../middleware/rateLimiter.js';
import { Staff, Shift, Warning } from '../models/index.js';

const router = express.Router({ mergeParams: true });

router.get('/', authenticateJWT, requireGuildAccess, apiLimiter, async (req, res) => {
  try {
    const { guildId } = req.params;
    const { type = 'points', limit = 10, page = 1 } = req.query;

    const skip = (parseInt(page) - 1) * parseInt(limit);
    let leaderboard = [];
    let total = 0;

    switch (type) {
      case 'points':
        leaderboard = await Staff.find({ guildId, isActive: true })
          .sort({ points: -1 })
          .skip(skip)
          .limit(parseInt(limit))
          .select('userId username globalName avatar rank points shifts.total');
        total = await Staff.countDocuments({ guildId, isActive: true });
        break;

      case 'shifts':
        leaderboard = await Staff.find({ guildId, isActive: true })
          .sort({ 'shifts.total': -1 })
          .skip(skip)
          .limit(parseInt(limit))
          .select('userId username globalName avatar rank points shifts.total shifts.totalDuration');
        total = await Staff.countDocuments({ guildId, isActive: true });
        break;

      case 'duration':
        leaderboard = await Staff.find({ guildId, isActive: true })
          .sort({ 'shifts.totalDuration': -1 })
          .skip(skip)
          .limit(parseInt(limit))
          .select('userId username globalName avatar rank points shifts.total shifts.totalDuration');
        total = await Staff.countDocuments({ guildId, isActive: true });
        break;

      case 'weekly':
        leaderboard = await Staff.find({ guildId, isActive: true })
          .sort({ 'shifts.weeklyDuration': -1 })
          .skip(skip)
          .limit(parseInt(limit))
          .select('userId username globalName avatar rank points shifts.weeklyDuration');
        total = await Staff.countDocuments({ guildId, isActive: true });
        break;

      case 'monthly':
        leaderboard = await Staff.find({ guildId, isActive: true })
          .sort({ 'shifts.monthlyDuration': -1 })
          .skip(skip)
          .limit(parseInt(limit))
          .select('userId username globalName avatar rank points shifts.monthlyDuration');
        total = await Staff.countDocuments({ guildId, isActive: true });
        break;

      case 'warnings':
        const warningStats = await Warning.aggregate([
          {
            $match: {
              guildId,
              revoked: false,
              expired: false,
              $or: [
                { expiresAt: null },
                { expiresAt: { $gt: new Date() } }
              ]
            }
          },
          {
            $group: {
              _id: '$targetId',
              count: { $sum: 1 },
              totalWeight: { $sum: '$weight' }
            }
          },
          { $sort: { count: -1 } },
          { $skip: skip },
          { $limit: parseInt(limit) }
        ]);

        const userIds = warningStats.map(s => s._id);
        const staffData = await Staff.find({ guildId, userId: { $in: userIds } })
          .select('userId username globalName avatar rank');

        leaderboard = warningStats.map(stat => {
          const staff = staffData.find(s => s.userId === stat._id);
          return {
            userId: stat._id,
            username: staff?.username || 'Unknown',
            globalName: staff?.globalName,
            avatar: staff?.getAvatarURL(),
            rank: staff?.rank,
            warningCount: stat.count,
            totalWeight: stat.totalWeight
          };
        });
        total = await Warning.distinct('targetId', { guildId }).then(ids => ids.length);
        break;

      default:
        return res.status(400).json({
          success: false,
          error: 'Bad Request',
          message: 'Invalid leaderboard type. Valid types: points, shifts, duration, weekly, monthly, warnings'
        });
    }

    res.json({
      success: true,
      data: {
        leaderboard: leaderboard.map((entry, index) => ({
          rank: skip + index + 1,
          ...entry.toObject ? entry.toObject() : entry
        })),
        type,
        pagination: {
          page: parseInt(page),
          limit: parseInt(limit),
          total,
          pages: Math.ceil(total / parseInt(limit))
        }
      }
    });
  } catch (error) {
    console.error('Get Leaderboard Error:', error);
    res.status(500).json({
      success: false,
      error: 'Internal Server Error',
      message: 'Failed to fetch leaderboard'
    });
  }
});

router.get('/rankings', authenticateJWT, requireGuildAccess, apiLimiter, async (req, res) => {
  try {
    const { guildId } = req.params;

    const rankings = await Staff.aggregate([
      { $match: { guildId, isActive: true } },
      {
        $group: {
          _id: '$rank',
          count: { $sum: 1 },
          totalPoints: { $sum: '$points' },
          avgPoints: { $avg: '$points' },
          totalShifts: { $sum: '$shifts.total' }
        }
      },
      { $sort: { avgPoints: -1 } }
    ]);

    res.json({
      success: true,
      data: { rankings }
    });
  } catch (error) {
    console.error('Get Rankings Error:', error);
    res.status(500).json({
      success: false,
      error: 'Internal Server Error',
      message: 'Failed to fetch rankings'
    });
  }
});

router.get('/user/:userId', authenticateJWT, requireGuildAccess, apiLimiter, async (req, res) => {
  try {
    const { guildId, userId } = req.params;

    const staff = await Staff.findOne({ guildId, userId });

    if (!staff) {
      return res.status(404).json({
        success: false,
        error: 'Not Found',
        message: 'User not found in staff'
      });
    }

    const [pointsRank, shiftsRank] = await Promise.all([
      Staff.countDocuments({
        guildId,
        isActive: true,
        points: { $gt: staff.points }
      }),
      Staff.countDocuments({
        guildId,
        isActive: true,
        'shifts.total': { $gt: staff.shifts.total }
      })
    ]);

    const totalStaff = await Staff.countDocuments({ guildId, isActive: true });

    res.json({
      success: true,
      data: {
        user: {
          userId: staff.userId,
          username: staff.username,
          globalName: staff.globalName,
          avatar: staff.getAvatarURL(),
          rank: staff.rank
        },
        stats: {
          points: {
            value: staff.points,
            rank: pointsRank + 1,
            total: totalStaff
          },
          shifts: {
            value: staff.shifts.total,
            rank: shiftsRank + 1,
            total: totalStaff,
            totalDuration: staff.shifts.totalDuration
          }
        }
      }
    });
  } catch (error) {
    console.error('Get User Rank Error:', error);
    res.status(500).json({
      success: false,
      error: 'Internal Server Error',
      message: 'Failed to fetch user rank'
    });
  }
});

export default router;
