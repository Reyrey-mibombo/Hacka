import { Promotion, RankRequirement, PromotionRequest, Staff, Shift, Warning } from '../models/index.js';
import mongoose from 'mongoose';

/**
 * Service for managing staff promotions and demotions
 */
class PromotionService {
  /**
   * Check if staff member meets promotion requirements
   * @param {string} guildId - Discord guild ID
   * @param {string} userId - Staff member's Discord ID
   * @param {string} targetRank - Target rank name
   * @returns {Promise<Object>} Requirements check result
   */
  async checkRequirements(guildId, userId, targetRank) {
    const [staff, rankRequirement] = await Promise.all([
      Staff.findOne({ guildId, userId }),
      RankRequirement.findOne({ guildId, rankName: targetRank })
    ]);

    if (!staff) {
      throw new Error('Staff member not found');
    }

    if (!rankRequirement) {
      throw new Error('Target rank not found');
    }

    // Check if target rank is higher than current
    if (rankRequirement.rankLevel <= staff.rankLevel) {
      return {
        eligible: false,
        reason: 'Target rank must be higher than current rank',
        currentRank: staff.rank,
        targetRank
      };
    }

    // Get active warnings count
    const activeWarnings = await Warning.countDocuments({
      guildId,
      targetId: userId,
      revoked: false,
      expired: false,
      $or: [
        { expiresAt: null },
        { expiresAt: { $gt: new Date() } }
      ]
    });

    const staffData = {
      points: staff.points,
      shifts: staff.shifts,
      warnings: { count: activeWarnings }
    };

    const checkResult = rankRequirement.checkRequirements(staffData);

    return {
      eligible: checkResult.allMet,
      currentRank: staff.rank,
      targetRank,
      requirements: checkResult.results,
      staffStats: {
        points: staff.points,
        totalShifts: staff.shifts.total,
        totalDuration: staff.shifts.totalDuration,
        activeWarnings
      }
    };
  }

  /**
   * Promote a staff member
   * @param {string} guildId - Discord guild ID
   * @param {string} userId - Staff member's Discord ID
   * @param {string} newRank - New rank name
   * @param {Object} processedBy - User processing the promotion
   * @param {Object} options - Promotion options
   * @returns {Promise<Promotion>} Created promotion record
   */
  async promote(guildId, userId, newRank, processedBy, options = {}) {
    const session = await mongoose.startSession();
    session.startTransaction();

    try {
      const staff = await Staff.findOne({ guildId, userId }).session(session);

      if (!staff) {
        throw new Error('Staff member not found');
      }

      const oldRank = staff.rank;

      if (oldRank === newRank) {
        throw new Error('New rank is same as current rank');
      }

      // Get rank requirements
      const [currentRankReq, newRankReq] = await Promise.all([
        RankRequirement.findOne({ guildId, rankName: oldRank }).session(session),
        RankRequirement.findOne({ guildId, rankName: newRank }).session(session)
      ]);

      // Check requirements if not bypassed
      let requirementsCheck = null;
      if (!options.bypassRequirements) {
        const activeWarnings = await Warning.countDocuments({
          guildId,
          targetId: userId,
          revoked: false,
          expired: false,
          $or: [
            { expiresAt: null },
            { expiresAt: { $gt: new Date() } }
          ]
        }).session(session);

        const staffData = {
          points: staff.points,
          shifts: staff.shifts,
          warnings: { count: activeWarnings }
        };

        if (newRankReq) {
          requirementsCheck = newRankReq.checkRequirements(staffData);

          if (!requirementsCheck.allMet) {
            throw new Error('Staff member does not meet all requirements for this promotion');
          }
        }
      }

      // Update staff record
      await staff.promote(newRank, processedBy, options.reason);

      // Create promotion record
      const promotion = new Promotion({
        guildId,
        userId,
        username: staff.username,
        avatar: staff.avatar,
        type: 'promotion',
        fromRank: oldRank,
        toRank: newRank,
        fromLevel: currentRankReq?.rankLevel || staff.rankLevel - 1,
        toLevel: newRankReq?.rankLevel || staff.rankLevel,
        fromPoints: staff.points,
        toPoints: staff.points,
        processedBy: {
          userId: processedBy.userId,
          username: processedBy.username,
          avatar: processedBy.avatar || null
        },
        reason: options.reason,
        effectiveDate: options.effectiveDate || new Date(),
        requirements: newRankReq?.requirements || {},
        metRequirements: !options.bypassRequirements,
        unmetRequirements: requirementsCheck ?
          requirementsCheck.results.filter(r => !r.met).map(r => r.requirement) : [],
        rolesAdded: options.rolesAdded || [],
        rolesRemoved: options.rolesRemoved || [],
        probationary: options.probationary || false,
        probationEndDate: options.probationEndDate || null,
        notes: options.notes || null,
        metadata: {
          processedFromDashboard: options.fromDashboard || false,
          processedFromDiscord: options.fromDiscord || false,
          ipAddress: options.ipAddress || null,
          userAgent: options.userAgent || null
        }
      });

      await promotion.save({ session });

      await session.commitTransaction();
      return promotion;
    } catch (error) {
      await session.abortTransaction();
      throw new Error(`Failed to promote staff: ${error.message}`);
    } finally {
      session.endSession();
    }
  }

  /**
   * Demote a staff member
   * @param {string} guildId - Discord guild ID
   * @param {string} userId - Staff member's Discord ID
   * @param {string} newRank - New rank name (lower)
   * @param {Object} processedBy - User processing the demotion
   * @param {Object} options - Demotion options
   * @returns {Promise<Promotion>} Created demotion record
   */
  async demote(guildId, userId, newRank, processedBy, options = {}) {
    const session = await mongoose.startSession();
    session.startTransaction();

    try {
      const staff = await Staff.findOne({ guildId, userId }).session(session);

      if (!staff) {
        throw new Error('Staff member not found');
      }

      const oldRank = staff.rank;

      if (oldRank === newRank) {
        throw new Error('New rank is same as current rank');
      }

      // Update staff record
      await staff.demote(newRank, processedBy, options.reason);

      // Create demotion record
      const demotion = new Promotion({
        guildId,
        userId,
        username: staff.username,
        avatar: staff.avatar,
        type: 'demotion',
        fromRank: oldRank,
        toRank: newRank,
        processedBy: {
          userId: processedBy.userId,
          username: processedBy.username,
          avatar: processedBy.avatar || null
        },
        reason: options.reason,
        effectiveDate: options.effectiveDate || new Date(),
        rolesAdded: options.rolesAdded || [],
        rolesRemoved: options.rolesRemoved || [],
        notes: options.notes || null,
        metadata: {
          processedFromDashboard: options.fromDashboard || false,
          processedFromDiscord: options.fromDiscord || false
        }
      });

      await demotion.save({ session });

      await session.commitTransaction();
      return demotion;
    } catch (error) {
      await session.abortTransaction();
      throw new Error(`Failed to demote staff: ${error.message}`);
    } finally {
      session.endSession();
    }
  }

  /**
   * Auto-promote eligible staff members
   * @param {string} guildId - Discord guild ID
   * @returns {Promise<Array>} Array of auto-promotions
   */
  async autoPromote(guildId) {
    const promotions = [];

    // Get all rank requirements with auto-promote enabled
    const autoPromoteRanks = await RankRequirement.find({
      guildId,
      autoPromote: true,
      isActive: true
    }).sort({ rankLevel: 1 });

    for (const rankReq of autoPromoteRanks) {
      // Get staff members eligible for this rank
      const eligibleStaff = await this.findEligibleStaff(guildId, rankReq);

      for (const staff of eligibleStaff) {
        try {
          const promotion = await this.promote(
            guildId,
            staff.userId,
            rankReq.rankName,
            { userId: 'system', username: 'System' },
            { reason: 'Auto-promotion: requirements met' }
          );
          promotions.push(promotion);
        } catch (error) {
          console.error(`Auto-promotion failed for ${staff.userId}:`, error.message);
        }
      }
    }

    return promotions;
  }

  /**
   * Find staff members eligible for a rank
   * @param {string} guildId - Discord guild ID
   * @param {RankRequirement} rankRequirement - Rank requirement document
   * @returns {Promise<Array>} Array of eligible staff members
   */
  async findEligibleStaff(guildId, rankRequirement) {
    const lowerRankLevel = await RankRequirement.findOne({
      guildId,
      rankLevel: { $lt: rankRequirement.rankLevel }
    }).sort({ rankLevel: -1 });

    // Find staff in the rank below this one
    const staffQuery = {
      guildId,
      rank: lowerRankLevel?.rankName || { $exists: true },
      isActive: true,
      isOnLeave: false
    };

    const staffMembers = await Staff.find(staffQuery);
    const eligible = [];

    for (const staff of staffMembers) {
      const activeWarnings = await Warning.countDocuments({
        guildId,
        targetId: staff.userId,
        revoked: false,
        expired: false,
        $or: [
          { expiresAt: null },
          { expiresAt: { $gt: new Date() } }
        ]
      });

      const staffData = {
        points: staff.points,
        shifts: staff.shifts,
        warnings: { count: activeWarnings }
      };

      const checkResult = rankRequirement.checkRequirements(staffData);

      if (checkResult.allMet) {
        eligible.push(staff);
      }
    }

    return eligible;
  }

  /**
   * Create a promotion request
   * @param {Object} requestData - Promotion request data
   * @returns {Promise<PromotionRequest>} Created request
   */
  async createPromotionRequest(requestData) {
    const existingRequest = await PromotionRequest.findOne({
      guildId: requestData.guildId,
      userId: requestData.userId,
      status: 'pending'
    });

    if (existingRequest) {
      throw new Error('You already have a pending promotion request');
    }

    const request = new PromotionRequest({
      guildId: requestData.guildId,
      userId: requestData.userId,
      username: requestData.username,
      currentRank: requestData.currentRank,
      requestedRank: requestData.requestedRank,
      reason: requestData.reason
    });

    await request.save();
    return request;
  }

  /**
   * Review a promotion request
   * @param {string} requestId - Request ID
   * @param {string} decision - 'approved' or 'denied'
   * @param {Object} reviewedBy - User reviewing
   * @param {Object} options - Review options
   * @returns {Promise<PromotionRequest>} Updated request
   */
  async reviewPromotionRequest(requestId, decision, reviewedBy, options = {}) {
    const request = await PromotionRequest.findById(requestId);

    if (!request) {
      throw new Error('Promotion request not found');
    }

    if (request.status !== 'pending') {
      throw new Error('This request has already been reviewed');
    }

    request.status = decision;
    request.reviewedBy = {
      userId: reviewedBy.userId,
      username: reviewedBy.username,
      avatar: reviewedBy.avatar || null
    };
    request.reviewedAt = new Date();
    request.reviewNotes = options.notes || null;

    // Check requirements and store results
    if (decision === 'approved') {
      const eligibility = await this.checkRequirements(
        request.guildId,
        request.userId,
        request.requestedRank
      );

      request.requirementsCheck = {
        checked: true,
        results: eligibility.requirements,
        allMet: eligibility.eligible
      };

      // Process the promotion
      await this.promote(
        request.guildId,
        request.userId,
        request.requestedRank,
        reviewedBy,
        { reason: `Approved promotion request: ${options.notes || 'No notes'}` }
      );
    }

    await request.save();
    return request;
  }

  /**
   * Withdraw a promotion request
   * @param {string} requestId - Request ID
   * @param {string} userId - User withdrawing
   * @returns {Promise<PromotionRequest>} Updated request
   */
  async withdrawPromotionRequest(requestId, userId) {
    const request = await PromotionRequest.findOne({
      _id: requestId,
      userId
    });

    if (!request) {
      throw new Error('Promotion request not found');
    }

    if (request.status !== 'pending') {
      throw new Error('Cannot withdraw a reviewed request');
    }

    request.status = 'withdrawn';
    await request.save();

    return request;
  }

  /**
   * Get promotion history for a staff member
   * @param {string} guildId - Discord guild ID
   * @param {string} userId - Staff member's Discord ID
   * @returns {Promise<Array>} Array of promotions
   */
  async getPromotionHistory(guildId, userId) {
    return Promotion.find({
      guildId,
      userId,
      type: { $in: ['promotion', 'demotion'] }
    }).sort({ processedAt: -1 });
  }

  /**
   * Get pending promotion requests for guild
   * @param {string} guildId - Discord guild ID
   * @returns {Promise<Array>} Array of pending requests
   */
  async getPendingRequests(guildId) {
    return PromotionRequest.find({
      guildId,
      status: 'pending'
    }).sort({ requestedAt: 1 });
  }

  /**
   * Revert a promotion
   * @param {string} promotionId - Promotion ID
   * @param {Object} revertedBy - User reverting
   * @param {string} reason - Revert reason
   * @returns {Promise<Promotion>} Updated promotion
   */
  async revertPromotion(promotionId, revertedBy, reason) {
    const promotion = await Promotion.findById(promotionId);

    if (!promotion) {
      throw new Error('Promotion not found');
    }

    if (promotion.isReverted) {
      throw new Error('Promotion is already reverted');
    }

    // Revert the staff member's rank
    const staff = await Staff.findOne({
      guildId: promotion.guildId,
      userId: promotion.userId
    });

    if (staff) {
      staff.rank = promotion.fromRank;
      staff.rankLevel = promotion.fromLevel || staff.rankLevel - 1;
      await staff.save();
    }

    await promotion.revert(revertedBy, reason);
    return promotion;
  }

  /**
   * Complete probation period
   * @param {string} promotionId - Promotion ID
   * @param {boolean} passed - Whether probation was passed
   * @param {Object} reviewedBy - User reviewing
   * @param {string} notes - Review notes
   * @returns {Promise<Promotion>} Updated promotion
   */
  async completeProbation(promotionId, passed, reviewedBy, notes) {
    const promotion = await Promotion.findById(promotionId);

    if (!promotion) {
      throw new Error('Promotion not found');
    }

    await promotion.completeProbation(passed, reviewedBy, notes);

    // If probation failed, demote the staff member
    if (!passed) {
      await this.demote(
        promotion.guildId,
        promotion.userId,
        promotion.fromRank,
        reviewedBy,
        { reason: `Probation period failed: ${notes}` }
      );
    }

    return promotion;
  }
}

export default new PromotionService();
