import { Shift, Staff } from '../models/index.js';
import mongoose from 'mongoose';

/**
 * Service for managing staff shifts
 */
class ShiftService {
  /**
   * Start a new shift for a staff member
   * @param {string} guildId - Discord guild ID
   * @param {string} userId - Staff member's Discord ID
   * @param {string} username - Staff member's username
   * @param {Object} options - Shift options
   * @returns {Promise<Shift>} Created shift document
   */
  async startShift(guildId, userId, username, options = {}) {
    const session = await mongoose.startSession();
    session.startTransaction();

    try {
      // Check if staff exists
      const staff = await Staff.findOne({ guildId, userId }).session(session);

      if (!staff) {
        throw new Error('Staff member not found');
      }

      if (staff.shifts.active) {
        throw new Error('Staff member is already on shift');
      }

      // Create shift
      const shift = new Shift({
        guildId,
        userId,
        username,
        staffRecordId: staff._id,
        startTime: new Date(),
        status: 'active',
        notes: options.notes || null,
        startedBy: options.startedBy || userId,
        requiresApproval: options.requiresApproval || false,
        metadata: {
          ipAddress: options.ipAddress,
          userAgent: options.userAgent,
          startedFromDashboard: options.startedFromDashboard || false,
          startedFromDiscord: options.startedFromDiscord || false
        }
      });

      await shift.save({ session });

      // Update staff record
      staff.shifts.active = true;
      staff.shifts.currentShiftId = shift._id;
      await staff.save({ session });

      await session.commitTransaction();
      return shift;
    } catch (error) {
      await session.abortTransaction();
      throw new Error(`Failed to start shift: ${error.message}`);
    } finally {
      session.endSession();
    }
  }

  /**
   * End an active shift
   * @param {string} guildId - Discord guild ID
   * @param {string} userId - Staff member's Discord ID
   * @param {Object} options - End shift options
   * @returns {Promise<Shift>} Updated shift document
   */
  async endShift(guildId, userId, options = {}) {
    const session = await mongoose.startSession();
    session.startTransaction();

    try {
      const shift = await Shift.findOne({
        guildId,
        userId,
        status: { $in: ['active', 'paused'] }
      }).session(session);

      if (!shift) {
        throw new Error('No active shift found');
      }

      const staff = await Staff.findOne({ guildId, userId }).session(session);

      if (!staff) {
        throw new Error('Staff member not found');
      }

      // End the shift
      await shift.end(options.endedBy || userId, options.notes);

      // Update staff record
      const duration = shift.duration;
      const pointsEarned = shift.pointsEarned;

      await staff.endShift(duration, pointsEarned);

      await session.commitTransaction();
      return shift;
    } catch (error) {
      await session.abortTransaction();
      throw new Error(`Failed to end shift: ${error.message}`);
    } finally {
      session.endSession();
    }
  }

  /**
   * Pause an active shift
   * @param {string} guildId - Discord guild ID
   * @param {string} userId - Staff member's Discord ID
   * @param {string} reason - Pause reason
   * @returns {Promise<Shift>} Updated shift document
   */
  async pauseShift(guildId, userId, reason = null) {
    const shift = await Shift.findOne({
      guildId,
      userId,
      status: 'active'
    });

    if (!shift) {
      throw new Error('No active shift found');
    }

    await shift.pause(reason);
    return shift;
  }

  /**
   * Resume a paused shift
   * @param {string} guildId - Discord guild ID
   * @param {string} userId - Staff member's Discord ID
   * @returns {Promise<Shift>} Updated shift document
   */
  async resumeShift(guildId, userId) {
    const shift = await Shift.findOne({
      guildId,
      userId,
      status: 'paused'
    });

    if (!shift) {
      throw new Error('No paused shift found');
    }

    await shift.resume();
    return shift;
  }

  /**
   * Cancel an active shift
   * @param {string} guildId - Discord guild ID
   * @param {string} userId - Staff member's Discord ID
   * @param {string} cancelledBy - User ID who cancelled
   * @param {string} reason - Cancellation reason
   * @returns {Promise<Shift>} Updated shift document
   */
  async cancelShift(guildId, userId, cancelledBy, reason) {
    const session = await mongoose.startSession();
    session.startTransaction();

    try {
      const shift = await Shift.findOne({
        guildId,
        userId,
        status: { $in: ['active', 'paused'] }
      }).session(session);

      if (!shift) {
        throw new Error('No active shift found');
      }

      const staff = await Staff.findOne({ guildId, userId }).session(session);

      await shift.cancel(cancelledBy, reason);

      // Reset staff shift status
      staff.shifts.active = false;
      staff.shifts.currentShiftId = null;
      await staff.save({ session });

      await session.commitTransaction();
      return shift;
    } catch (error) {
      await session.abortTransaction();
      throw new Error(`Failed to cancel shift: ${error.message}`);
    } finally {
      session.endSession();
    }
  }

  /**
   * Get active shift for a staff member
   * @param {string} guildId - Discord guild ID
   * @param {string} userId - Staff member's Discord ID
   * @returns {Promise<Shift|null>} Active shift or null
   */
  async getActiveShift(guildId, userId) {
    return Shift.getActiveShift(guildId, userId);
  }

  /**
   * Get shift by ID
   * @param {string} shiftId - Shift document ID
   * @returns {Promise<Shift|null>} Shift document or null
   */
  async getShiftById(shiftId) {
    return Shift.findById(shiftId);
  }

  /**
   * Get shifts for a staff member
   * @param {string} guildId - Discord guild ID
   * @param {string} userId - Staff member's Discord ID
   * @param {Object} options - Query options
   * @returns {Promise<Array>} Array of shifts
   */
  async getStaffShifts(guildId, userId, options = {}) {
    const { 
      status = null, 
      limit = 50, 
      skip = 0, 
      startDate = null, 
      endDate = null 
    } = options;

    const filter = { guildId, userId };

    if (status) {
      filter.status = status;
    }

    if (startDate || endDate) {
      filter.startTime = {};
      if (startDate) filter.startTime.$gte = new Date(startDate);
      if (endDate) filter.startTime.$lte = new Date(endDate);
    }

    return Shift.find(filter)
      .sort({ startTime: -1 })
      .skip(skip)
      .limit(limit);
  }

  /**
   * Get all shifts for a guild
   * @param {string} guildId - Discord guild ID
   * @param {Object} options - Query options
   * @returns {Promise<Array>} Array of shifts
   */
  async getGuildShifts(guildId, options = {}) {
    const { 
      status = null, 
      limit = 50, 
      skip = 0,
      date = null
    } = options;

    const filter = { guildId };

    if (status) {
      filter.status = status;
    }

    if (date) {
      const startOfDay = new Date(date);
      startOfDay.setHours(0, 0, 0, 0);
      const endOfDay = new Date(date);
      endOfDay.setHours(23, 59, 59, 999);

      filter.startTime = {
        $gte: startOfDay,
        $lte: endOfDay
      };
    }

    return Shift.find(filter)
      .sort({ startTime: -1 })
      .skip(skip)
      .limit(limit);
  }

  /**
   * Approve a pending shift
   * @param {string} shiftId - Shift document ID
   * @param {string} approvedBy - User ID who approved
   * @returns {Promise<Shift>} Updated shift document
   */
  async approveShift(shiftId, approvedBy) {
    const shift = await Shift.findById(shiftId);

    if (!shift) {
      throw new Error('Shift not found');
    }

    if (shift.isApproved) {
      throw new Error('Shift is already approved');
    }

    await shift.approve(approvedBy);
    return shift;
  }

  /**
   * Add bonus points to a shift
   * @param {string} shiftId - Shift document ID
   * @param {number} points - Points to add
   * @param {string} reason - Reason for bonus
   * @param {string} addedBy - User ID who added bonus
   * @returns {Promise<Shift>} Updated shift document
   */
  async addBonusPoints(shiftId, points, reason, addedBy) {
    const shift = await Shift.findById(shiftId);

    if (!shift) {
      throw new Error('Shift not found');
    }

    await shift.addBonusPoints(points, reason, addedBy);
    return shift;
  }

  /**
   * Add checkpoint to shift
   * @param {string} guildId - Discord guild ID
   * @param {string} userId - Staff member's Discord ID
   * @param {string} notes - Checkpoint notes
   * @returns {Promise<Object>} Checkpoint data
   */
  async addCheckpoint(guildId, userId, notes = null) {
    const shift = await Shift.findOne({
      guildId,
      userId,
      status: { $in: ['active', 'paused'] }
    });

    if (!shift) {
      throw new Error('No active shift found');
    }

    const checkpoint = await shift.addCheckpoint(notes);
    return checkpoint;
  }

  /**
   * Log activity to current shift
   * @param {string} guildId - Discord guild ID
   * @param {string} userId - Staff member's Discord ID
   * @param {string} activityType - Type of activity
   * @param {number} count - Activity count
   * @returns {Promise<void>}
   */
  async logActivity(guildId, userId, activityType, count = 1) {
    const shift = await Shift.findOne({
      guildId,
      userId,
      status: { $in: ['active', 'paused'] }
    });

    if (!shift) {
      return; // Silently return if no active shift
    }

    await shift.logActivity(activityType, count);
  }

  /**
   * Get staff shift statistics
   * @param {string} guildId - Discord guild ID
   * @param {string} userId - Staff member's Discord ID
   * @param {number} days - Number of days to look back
   * @returns {Promise<Object>} Shift statistics
   */
  async getStaffStats(guildId, userId, days = 30) {
    return Shift.getStaffStats(guildId, userId, days);
  }

  /**
   * Get guild shift statistics
   * @param {string} guildId - Discord guild ID
   * @param {number} days - Number of days to look back
   * @returns {Promise<Object>} Shift statistics
   */
  async getGuildStats(guildId, days = 30) {
    return Shift.getGuildStats(guildId, days);
  }

  /**
   * Calculate points for shift duration
   * @param {number} duration - Shift duration in seconds
   * @param {number} baseRate - Points per minute
   * @returns {number} Calculated points
   */
  calculatePoints(duration, baseRate = 0.1) {
    const minutes = Math.floor(duration / 60);
    return Math.floor(minutes * baseRate);
  }

  /**
   * Get currently active shifts for guild
   * @param {string} guildId - Discord guild ID
   * @returns {Promise<Array>} Active shifts
   */
  async getActiveShifts(guildId) {
    return Shift.find({
      guildId,
      status: { $in: ['active', 'paused'] }
    }).sort({ startTime: -1 });
  }

  /**
   * Get shift leaderboard for guild
   * @param {string} guildId - Discord guild ID
   * @param {number} days - Number of days to look back
   * @param {number} limit - Number of results
   * @returns {Promise<Array>} Shift leaderboard
   */
  async getShiftLeaderboard(guildId, days = 7, limit = 10) {
    const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000);

    const leaderboard = await Shift.aggregate([
      {
        $match: {
          guildId,
          status: 'completed',
          startTime: { $gte: since }
        }
      },
      {
        $group: {
          _id: '$userId',
          username: { $first: '$username' },
          totalShifts: { $sum: 1 },
          totalDuration: { $sum: '$duration' },
          totalPoints: { $sum: '$pointsEarned' }
        }
      },
      {
        $sort: { totalDuration: -1 }
      },
      {
        $limit: limit
      }
    ]);

    return leaderboard;
  }

  /**
   * Auto-end shifts that have been running too long
   * @param {string} guildId - Discord guild ID
   * @param {number} maxDuration - Maximum shift duration in hours
   * @returns {Promise<number>} Number of shifts ended
   */
  async autoEndLongShifts(guildId, maxDuration = 12) {
    const cutoff = new Date(Date.now() - maxDuration * 60 * 60 * 1000);

    const longShifts = await Shift.find({
      guildId,
      status: { $in: ['active', 'paused'] },
      startTime: { $lt: cutoff }
    });

    for (const shift of longShifts) {
      try {
        await this.endShift(guildId, shift.userId, {
          endedBy: 'system',
          notes: `Auto-ended after ${maxDuration} hours`
        });
      } catch (error) {
        console.error(`Failed to auto-end shift ${shift._id}:`, error);
      }
    }

    return longShifts.length;
  }
}

export default new ShiftService();
