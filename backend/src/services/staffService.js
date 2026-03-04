import { Staff, Shift, Warning, Promotion } from '../models/index.js';

/**
 * Service for managing staff members
 */
class StaffService {
  /**
   * Create a new staff member
   * @param {Object} staffData - Staff member data
   * @returns {Promise<Staff>} Created staff document
   */
  async createStaff(staffData) {
    try {
      const existingStaff = await Staff.findOne({
        guildId: staffData.guildId,
        userId: staffData.userId
      });

      if (existingStaff) {
        throw new Error('Staff member already exists in this guild');
      }

      const staff = new Staff({
        guildId: staffData.guildId,
        userId: staffData.userId,
        username: staffData.username,
        discriminator: staffData.discriminator || '0',
        globalName: staffData.globalName || null,
        avatar: staffData.avatar || null,
        nickname: staffData.nickname || null,
        rank: staffData.rank || 'Trial Moderator',
        rankLevel: staffData.rankLevel || 0,
        points: staffData.points || 0,
        roles: staffData.roles || [],
        department: staffData.department || null,
        permissions: staffData.permissions || [],
        canManageShifts: staffData.canManageShifts || false,
        canPromote: staffData.canPromote || false,
        canWarn: staffData.canWarn !== false
      });

      await staff.save();
      return staff;
    } catch (error) {
      throw new Error(`Failed to create staff: ${error.message}`);
    }
  }

  /**
   * Get staff member by ID
   * @param {string} guildId - Discord guild ID
   * @param {string} userId - User's Discord ID
   * @returns {Promise<Staff|null>} Staff document or null
   */
  async getStaff(guildId, userId) {
    return Staff.findOne({ guildId, userId });
  }

  /**
   * Get all staff members for a guild
   * @param {string} guildId - Discord guild ID
   * @param {Object} options - Query options
   * @returns {Promise<Array>} Array of staff members
   */
  async getGuildStaff(guildId, options = {}) {
    const { 
      isActive = true, 
      limit = 100, 
      skip = 0, 
      sort = { joinedAt: -1 },
      rank = null 
    } = options;

    const filter = { guildId, isActive };
    if (rank) filter.rank = rank;

    return Staff.find(filter)
      .sort(sort)
      .skip(skip)
      .limit(limit);
  }

  /**
   * Update staff member information
   * @param {string} guildId - Discord guild ID
   * @param {string} userId - User's Discord ID
   * @param {Object} updateData - Data to update
   * @returns {Promise<Staff>} Updated staff document
   */
  async updateStaff(guildId, userId, updateData) {
    const staff = await Staff.findOneAndUpdate(
      { guildId, userId },
      { $set: updateData },
      { new: true }
    );

    if (!staff) {
      throw new Error('Staff member not found');
    }

    return staff;
  }

  /**
   * Delete staff member
   * @param {string} guildId - Discord guild ID
   * @param {string} userId - User's Discord ID
   * @returns {Promise<boolean>} True if deleted
   */
  async deleteStaff(guildId, userId) {
    const result = await Staff.deleteOne({ guildId, userId });
    return result.deletedCount > 0;
  }

  /**
   * Change staff member's rank
   * @param {string} guildId - Discord guild ID
   * @param {string} userId - User's Discord ID
   * @param {string} newRank - New rank name
   * @param {Object} promotedBy - User who made the change
   * @param {string} reason - Reason for rank change
   * @returns {Promise<Staff>} Updated staff document
   */
  async changeRank(guildId, userId, newRank, promotedBy, reason) {
    const staff = await Staff.findOne({ guildId, userId });

    if (!staff) {
      throw new Error('Staff member not found');
    }

    const oldRank = staff.rank;

    if (oldRank === newRank) {
      throw new Error('New rank is same as current rank');
    }

    staff.rank = newRank;
    staff.rankLevel += 1;
    staff.promotions.push({
      fromRank: oldRank,
      toRank: newRank,
      promotedBy: promotedBy.userId,
      promotedByUsername: promotedBy.username,
      reason,
      timestamp: new Date()
    });

    await staff.save();
    return staff;
  }

  /**
   * Demote staff member
   * @param {string} guildId - Discord guild ID
   * @param {string} userId - User's Discord ID
   * @param {string} newRank - New rank name
   * @param {Object} demotedBy - User who made the change
   * @param {string} reason - Reason for demotion
   * @returns {Promise<Staff>} Updated staff document
   */
  async demote(guildId, userId, newRank, demotedBy, reason) {
    const staff = await Staff.findOne({ guildId, userId });

    if (!staff) {
      throw new Error('Staff member not found');
    }

    const oldRank = staff.rank;

    staff.rank = newRank;
    staff.rankLevel = Math.max(0, staff.rankLevel - 1);
    staff.demotions.push({
      fromRank: oldRank,
      toRank: newRank,
      demotedBy: demotedBy.userId,
      demotedByUsername: demotedBy.username,
      reason,
      timestamp: new Date()
    });

    await staff.save();
    return staff;
  }

  /**
   * Add points to staff member
   * @param {string} guildId - Discord guild ID
   * @param {string} userId - User's Discord ID
   * @param {number} points - Points to add
   * @param {string} reason - Reason for adding points
   * @returns {Promise<Object>} Points update result
   */
  async addPoints(guildId, userId, points, reason = 'Manual addition') {
    const staff = await Staff.findOne({ guildId, userId });

    if (!staff) {
      throw new Error('Staff member not found');
    }

    return staff.addPoints(points, reason);
  }

  /**
   * Remove points from staff member
   * @param {string} guildId - Discord guild ID
   * @param {string} userId - User's Discord ID
   * @param {number} points - Points to remove
   * @param {string} reason - Reason for removing points
   * @returns {Promise<Object>} Points update result
   */
  async removePoints(guildId, userId, points, reason = 'Manual removal') {
    const staff = await Staff.findOne({ guildId, userId });

    if (!staff) {
      throw new Error('Staff member not found');
    }

    staff.points = Math.max(0, staff.points - points);
    await staff.save();

    return {
      previousPoints: staff.points + points,
      currentPoints: staff.points,
      removed: points,
      reason
    };
  }

  /**
   * Calculate staff points based on activity
   * @param {string} guildId - Discord guild ID
   * @param {string} userId - User's Discord ID
   * @param {Object} activity - Activity metrics
   * @returns {Promise<number>} Calculated points
   */
  async calculatePoints(guildId, userId, activity) {
    const staff = await Staff.findOne({ guildId, userId });

    if (!staff) {
      throw new Error('Staff member not found');
    }

    let points = 0;

    // Base points calculation
    if (activity.shiftsCompleted) points += activity.shiftsCompleted * 10;
    if (activity.ticketsHandled) points += activity.ticketsHandled * 5;
    if (activity.messagesHandled) points += Math.floor(activity.messagesHandled / 100);
    if (activity.warnsIssued) points += activity.warnsIssued * 2;
    if (activity.mutesIssued) points += activity.mutesIssued * 3;
    if (activity.kicksIssued) points += activity.kicksIssued * 5;
    if (activity.bansIssued) points += activity.bansIssued * 5;
    if (activity.reportsHandled) points += activity.reportsHandled * 3;

    // Bonus for shift duration
    if (activity.shiftDuration) {
      points += Math.floor(activity.shiftDuration / 3600) * 5; // 5 points per hour
    }

    return points;
  }

  /**
   * Set staff on leave
   * @param {string} guildId - Discord guild ID
   * @param {string} userId - User's Discord ID
   * @param {string} reason - Leave reason
   * @param {Date} leaveEndsAt - When leave ends
   * @returns {Promise<Staff>} Updated staff document
   */
  async setOnLeave(guildId, userId, reason, leaveEndsAt = null) {
    const staff = await Staff.findOneAndUpdate(
      { guildId, userId },
      {
        $set: {
          isOnLeave: true,
          leaveReason: reason,
          leaveStartedAt: new Date(),
          leaveEndsAt
        }
      },
      { new: true }
    );

    if (!staff) {
      throw new Error('Staff member not found');
    }

    return staff;
  }

  /**
   * End staff leave
   * @param {string} guildId - Discord guild ID
   * @param {string} userId - User's Discord ID
   * @returns {Promise<Staff>} Updated staff document
   */
  async endLeave(guildId, userId) {
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
      throw new Error('Staff member not found');
    }

    return staff;
  }

  /**
   * Deactivate staff member
   * @param {string} guildId - Discord guild ID
   * @param {string} userId - User's Discord ID
   * @returns {Promise<Staff>} Updated staff document
   */
  async deactivateStaff(guildId, userId) {
    const staff = await Staff.findOneAndUpdate(
      { guildId, userId },
      { $set: { isActive: false } },
      { new: true }
    );

    if (!staff) {
      throw new Error('Staff member not found');
    }

    return staff;
  }

  /**
   * Reactivate staff member
   * @param {string} guildId - Discord guild ID
   * @param {string} userId - User's Discord ID
   * @returns {Promise<Staff>} Updated staff document
   */
  async reactivateStaff(guildId, userId) {
    const staff = await Staff.findOneAndUpdate(
      { guildId, userId },
      { $set: { isActive: true } },
      { new: true }
    );

    if (!staff) {
      throw new Error('Staff member not found');
    }

    return staff;
  }

  /**
   * Get staff statistics
   * @param {string} guildId - Discord guild ID
   * @param {string} userId - User's Discord ID
   * @returns {Promise<Object>} Staff statistics
   */
  async getStaffStats(guildId, userId) {
    const staff = await Staff.findOne({ guildId, userId });

    if (!staff) {
      throw new Error('Staff member not found');
    }

    const shifts = await Shift.find({
      guildId,
      userId,
      status: 'completed'
    });

    const warnings = await Warning.find({
      guildId,
      targetId: userId,
      revoked: false,
      expired: false
    });

    return {
      staffInfo: {
        rank: staff.rank,
        points: staff.points,
        joinedAt: staff.joinedAt,
        isActive: staff.isActive,
        isOnLeave: staff.isOnLeave
      },
      shifts: {
        total: staff.shifts.total,
        totalDuration: staff.shifts.totalDuration,
        weeklyDuration: staff.shifts.weeklyDuration,
        monthlyDuration: staff.shifts.monthlyDuration
      },
      warnings: {
        count: staff.warnings.count,
        active: staff.warnings.active
      },
      metrics: staff.metrics,
      promotionCount: staff.promotions.length,
      demotionCount: staff.demotions.length
    };
  }

  /**
   * Search staff members
   * @param {string} guildId - Discord guild ID
   * @param {string} query - Search query
   * @returns {Promise<Array>} Matching staff members
   */
  async searchStaff(guildId, query) {
    return Staff.find({
      guildId,
      $or: [
        { username: { $regex: query, $options: 'i' } },
        { nickname: { $regex: query, $options: 'i' } },
        { userId: query }
      ]
    }).limit(20);
  }

  /**
   * Get active staff members on shift
   * @param {string} guildId - Discord guild ID
   * @returns {Promise<Array>} Active staff members
   */
  async getActiveStaff(guildId) {
    return Staff.find({
      guildId,
      isActive: true,
      'shifts.active': true
    });
  }

  /**
   * Update staff permissions
   * @param {string} guildId - Discord guild ID
   * @param {string} userId - User's Discord ID
   * @param {Object} permissions - Permission updates
   * @returns {Promise<Staff>} Updated staff document
   */
  async updatePermissions(guildId, userId, permissions) {
    const update = {};

    if (permissions.canManageShifts !== undefined) {
      update.canManageShifts = permissions.canManageShifts;
    }
    if (permissions.canPromote !== undefined) {
      update.canPromote = permissions.canPromote;
    }
    if (permissions.canWarn !== undefined) {
      update.canWarn = permissions.canWarn;
    }

    const staff = await Staff.findOneAndUpdate(
      { guildId, userId },
      { $set: update },
      { new: true }
    );

    if (!staff) {
      throw new Error('Staff member not found');
    }

    return staff;
  }
}

export default new StaffService();
