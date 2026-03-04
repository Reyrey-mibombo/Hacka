import { Warning, Staff } from '../models/index.js';
import mongoose from 'mongoose';

/**
 * Service for managing warnings
 */
class WarningService {
  /**
   * Issue a new warning
   * @param {Object} warningData - Warning data
   * @returns {Promise<Warning>} Created warning document
   */
  async issueWarning(warningData) {
    const session = await mongoose.startSession();
    session.startTransaction();

    try {
      // Generate warning ID
      const warningId = Warning.generateWarningId();

      // Create warning
      const warning = new Warning({
        guildId: warningData.guildId,
        warningId,
        targetId: warningData.targetId,
        targetUsername: warningData.targetUsername,
        targetDiscriminator: warningData.targetDiscriminator || '0',
        targetAvatar: warningData.targetAvatar || null,
        issuerId: warningData.issuerId,
        issuerUsername: warningData.issuerUsername,
        issuerDiscriminator: warningData.issuerDiscriminator || '0',
        issuerAvatar: warningData.issuerAvatar || null,
        reason: warningData.reason,
        severity: warningData.severity || 'medium',
        weight: warningData.weight || 1,
        points: warningData.points || 0,
        evidence: warningData.evidence || [],
        expiresAt: warningData.expiresAt || null,
        duration: warningData.duration || null,
        metadata: {
          channelId: warningData.channelId || null,
          messageId: warningData.messageId || null,
          context: warningData.context || null,
          automated: warningData.automated || false,
          triggeredBy: warningData.triggeredBy || null,
          ruleId: warningData.ruleId || null
        }
      });

      await warning.save({ session });

      // Update staff record if target is a staff member
      const staff = await Staff.findOne({
        guildId: warningData.guildId,
        userId: warningData.targetId
      }).session(session);

      if (staff) {
        await staff.addWarning(warning._id);
      }

      await session.commitTransaction();
      return warning;
    } catch (error) {
      await session.abortTransaction();
      throw new Error(`Failed to issue warning: ${error.message}`);
    } finally {
      session.endSession();
    }
  }

  /**
   * Get warning by ID
   * @param {string} warningId - Warning ID (WARN-XXX)
   * @returns {Promise<Warning|null>} Warning document or null
   */
  async getWarning(warningId) {
    return Warning.findOne({ warningId });
  }

  /**
   * Get warning by MongoDB ID
   * @param {string} id - Warning MongoDB ID
   * @returns {Promise<Warning|null>} Warning document or null
   */
  async getWarningById(id) {
    return Warning.findById(id);
  }

  /**
   * Get warnings for a user
   * @param {string} guildId - Discord guild ID
   * @param {string} targetId - Target user's Discord ID
   * @param {Object} options - Query options
   * @returns {Promise<Array>} Array of warnings
   */
  async getUserWarnings(guildId, targetId, options = {}) {
    const { 
      includeExpired = false, 
      includeRevoked = false,
      limit = 50,
      skip = 0
    } = options;

    const filter = { guildId, targetId };

    if (!includeExpired) {
      filter.$or = [
        { expiresAt: null },
        { expiresAt: { $gt: new Date() } }
      ];
      filter.expired = false;
    }

    if (!includeRevoked) {
      filter.revoked = false;
    }

    return Warning.find(filter)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit);
  }

  /**
   * Get active warnings for a user
   * @param {string} guildId - Discord guild ID
   * @param {string} targetId - Target user's Discord ID
   * @returns {Promise<Array>} Array of active warnings
   */
  async getActiveWarnings(guildId, targetId) {
    return Warning.getActiveWarnings(guildId, targetId);
  }

  /**
   * Revoke a warning
   * @param {string} warningId - Warning ID
   * @param {Object} revokedBy - User revoking the warning
   * @param {string} reason - Reason for revocation
   * @returns {Promise<Warning>} Updated warning document
   */
  async revokeWarning(warningId, revokedBy, reason) {
    const session = await mongoose.startSession();
    session.startTransaction();

    try {
      const warning = await Warning.findOne({ warningId }).session(session);

      if (!warning) {
        throw new Error('Warning not found');
      }

      await warning.revoke(revokedBy, reason);

      // Update staff record if target is a staff member
      const staff = await Staff.findOne({
        guildId: warning.guildId,
        userId: warning.targetId
      }).session(session);

      if (staff) {
        await staff.resolveWarning();
      }

      await session.commitTransaction();
      return warning;
    } catch (error) {
      await session.abortTransaction();
      throw new Error(`Failed to revoke warning: ${error.message}`);
    } finally {
      session.endSession();
    }
  }

  /**
   * Acknowledge a warning
   * @param {string} warningId - Warning ID
   * @returns {Promise<Warning>} Updated warning document
   */
  async acknowledgeWarning(warningId) {
    const warning = await Warning.findOne({ warningId });

    if (!warning) {
      throw new Error('Warning not found');
    }

    await warning.acknowledge();
    return warning;
  }

  /**
   * Submit appeal for a warning
   * @param {string} warningId - Warning ID
   * @param {string} reason - Appeal reason
   * @returns {Promise<Warning>} Updated warning document
   */
  async submitAppeal(warningId, reason) {
    const warning = await Warning.findOne({ warningId });

    if (!warning) {
      throw new Error('Warning not found');
    }

    await warning.submitAppeal(reason);
    return warning;
  }

  /**
   * Review a warning appeal
   * @param {string} warningId - Warning ID
   * @param {string} decision - 'approved' or 'denied'
   * @param {Object} reviewer - User reviewing the appeal
   * @param {string} reason - Review reason
   * @returns {Promise<Warning>} Updated warning document
   */
  async reviewAppeal(warningId, decision, reviewer, reason) {
    const warning = await Warning.findOne({ warningId });

    if (!warning) {
      throw new Error('Warning not found');
    }

    await warning.reviewAppeal(decision, reviewer, reason);
    return warning;
  }

  /**
   * Add evidence to a warning
   * @param {string} warningId - Warning ID
   * @param {Object} evidence - Evidence data
   * @returns {Promise<Warning>} Updated warning document
   */
  async addEvidence(warningId, evidence) {
    const warning = await Warning.findOne({ warningId });

    if (!warning) {
      throw new Error('Warning not found');
    }

    await warning.addEvidence(evidence);
    return warning;
  }

  /**
   * Process expired warnings
   * @param {string} guildId - Discord guild ID
   * @returns {Promise<number>} Number of warnings expired
   */
  async processExpiredWarnings(guildId) {
    const expiredWarnings = await Warning.find({
      guildId,
      expired: false,
      expiresAt: { $lt: new Date() }
    });

    for (const warning of expiredWarnings) {
      await warning.checkExpiration();

      // Update staff record if target is a staff member
      const staff = await Staff.findOne({
        guildId: warning.guildId,
        userId: warning.targetId
      });

      if (staff) {
        await staff.resolveWarning();
      }
    }

    return expiredWarnings.length;
  }

  /**
   * Get warning count for a user
   * @param {string} guildId - Discord guild ID
   * @param {string} targetId - Target user's Discord ID
   * @param {Object} options - Count options
   * @returns {Promise<number>} Warning count
   */
  async getWarningCount(guildId, targetId, options = {}) {
    return Warning.getWarningCount(guildId, targetId, options);
  }

  /**
   * Get total warning weight for a user
   * @param {string} guildId - Discord guild ID
   * @param {string} targetId - Target user's Discord ID
   * @returns {Promise<number>} Total weight
   */
  async getTotalWeight(guildId, targetId) {
    return Warning.getTotalWeight(guildId, targetId);
  }

  /**
   * Get staff warning statistics
   * @param {string} guildId - Discord guild ID
   * @param {string} issuerId - Issuer's Discord ID
   * @param {number} days - Number of days to look back
   * @returns {Promise<Object>} Warning statistics
   */
  async getStaffStats(guildId, issuerId, days = 30) {
    return Warning.getStaffStats(guildId, issuerId, days);
  }

  /**
   * Get guild warning statistics
   * @param {string} guildId - Discord guild ID
   * @param {number} days - Number of days to look back
   * @returns {Promise<Object>} Warning statistics
   */
  async getGuildStats(guildId, days = 30) {
    const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000);

    const stats = await Warning.aggregate([
      {
        $match: {
          guildId,
          createdAt: { $gte: since }
        }
      },
      {
        $group: {
          _id: null,
          total: { $sum: 1 },
          active: {
            $sum: {
              $cond: [{ $and: [{ $eq: ['$expired', false] }, { $eq: ['$revoked', false] }] }, 1, 0]
            }
          },
          revoked: { $sum: { $cond: ['$revoked', 1, 0] } },
          expired: { $sum: { $cond: ['$expired', 1, 0] } }
        }
      }
    ]);

    const severityStats = await Warning.aggregate([
      {
        $match: {
          guildId,
          createdAt: { $gte: since }
        }
      },
      {
        $group: {
          _id: '$severity',
          count: { $sum: 1 }
        }
      }
    ]);

    return {
      total: stats[0]?.total || 0,
      active: stats[0]?.active || 0,
      revoked: stats[0]?.revoked || 0,
      expired: stats[0]?.expired || 0,
      bySeverity: severityStats.reduce((acc, s) => {
        acc[s._id] = s.count;
        return acc;
      }, {})
    };
  }

  /**
   * Get warnings issued by a staff member
   * @param {string} guildId - Discord guild ID
   * @param {string} issuerId - Issuer's Discord ID
   * @param {Object} options - Query options
   * @returns {Promise<Array>} Array of warnings
   */
  async getWarningsByIssuer(guildId, issuerId, options = {}) {
    const { limit = 50, skip = 0 } = options;

    return Warning.find({ guildId, issuerId })
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit);
  }

  /**
   * Bulk revoke warnings
   * @param {string} guildId - Discord guild ID
   * @param {string} targetId - Target user's Discord ID
   * @param {Object} revokedBy - User revoking the warnings
   * @param {string} reason - Reason for revocation
   * @returns {Promise<number>} Number of warnings revoked
   */
  async bulkRevoke(guildId, targetId, revokedBy, reason) {
    const warnings = await Warning.find({
      guildId,
      targetId,
      revoked: false,
      expired: false
    });

    for (const warning of warnings) {
      await this.revokeWarning(warning.warningId, revokedBy, reason);
    }

    return warnings.length;
  }
}

export default new WarningService();
