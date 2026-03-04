import { ActivityLog } from '../models/index.js';

/**
 * Service for logging activity
 */
class ActivityLogService {
  /**
   * Log an activity
   * @param {Object} logData - Log data
   * @returns {Promise<ActivityLog>} Created log entry
   */
  async log(logData) {
    try {
      const log = await ActivityLog.createLog(logData);
      return log;
    } catch (error) {
      console.error('Failed to create activity log:', error);
      // Don't throw - logging should not break functionality
      return null;
    }
  }

  /**
   * Log command execution
   * @param {string} guildId - Discord guild ID
   * @param {Object} actor - User who executed command
   * @param {string} commandName - Command name
   * @param {Object} options - Log options
   * @returns {Promise<ActivityLog>} Created log
   */
  async logCommand(guildId, actor, commandName, options = {}) {
    return this.log({
      guildId,
      type: 'command_executed',
      severity: 'info',
      actor: {
        userId: actor.userId,
        username: actor.username,
        discriminator: actor.discriminator || '0',
        avatar: actor.avatar || null
      },
      channel: options.channel || null,
      details: {
        description: `Executed command: ${commandName}`,
        metadata: {
          command: commandName,
          args: options.args || [],
          ...options.metadata
        }
      },
      source: options.source || { type: 'discord' }
    });
  }

  /**
   * Log moderation action
   * @param {string} guildId - Discord guild ID
   * @param {string} type - Action type (ban, kick, mute, warn)
   * @param {Object} actor - Staff member performing action
   * @param {Object} target - Target user
   * @param {Object} options - Log options
   * @returns {Promise<ActivityLog>} Created log
   */
  async logModeration(guildId, type, actor, target, options = {}) {
    const typeMap = {
      ban: 'member_banned',
      kick: 'member_kicked',
      mute: 'member_muted',
      unmute: 'member_unmuted',
      warn: 'member_warned',
      timeout: 'member_timeout'
    };

    return this.log({
      guildId,
      type: typeMap[type] || 'custom',
      severity: options.severity || 'medium',
      actor: {
        userId: actor.userId,
        username: actor.username,
        discriminator: actor.discriminator || '0',
        avatar: actor.avatar || null
      },
      target: {
        userId: target.userId,
        username: target.username,
        discriminator: target.discriminator || '0',
        avatar: target.avatar || null
      },
      channel: options.channel || null,
      details: {
        description: options.description || `${type} action performed`,
        reason: options.reason || null,
        duration: options.duration || null,
        metadata: options.metadata || {}
      },
      relatedEntities: options.relatedEntities || {},
      source: options.source || { type: 'discord' }
    });
  }

  /**
   * Log dashboard action
   * @param {string} guildId - Discord guild ID
   * @param {Object} actor - User performing action
   * @param {string} action - Action description
   * @param {Object} options - Log options
   * @returns {Promise<ActivityLog>} Created log
   */
  async logDashboardAction(guildId, actor, action, options = {}) {
    return this.log({
      guildId,
      type: 'dashboard_action',
      severity: options.severity || 'info',
      actor: {
        userId: actor.userId,
        username: actor.username,
        discriminator: actor.discriminator || '0',
        avatar: actor.avatar || null,
        ipAddress: options.ipAddress || null
      },
      details: {
        description: action,
        changes: options.changes || [],
        metadata: options.metadata || {}
      },
      source: {
        type: 'dashboard',
        version: options.version || null
      }
    });
  }

  /**
   * Log settings change
   * @param {string} guildId - Discord guild ID
   * @param {Object} actor - User changing settings
   * @param {string} settingName - Setting name
   * @param {*} oldValue - Old value
   * @param {*} newValue - New value
   * @param {Object} options - Log options
   * @returns {Promise<ActivityLog>} Created log
   */
  async logSettingsChange(guildId, actor, settingName, oldValue, newValue, options = {}) {
    return this.log({
      guildId,
      type: 'settings_changed',
      severity: 'low',
      actor: {
        userId: actor.userId,
        username: actor.username,
        discriminator: actor.discriminator || '0',
        avatar: actor.avatar || null
      },
      details: {
        description: `Changed setting: ${settingName}`,
        changes: [{
          field: settingName,
          oldValue,
          newValue
        }],
        metadata: options.metadata || {}
      },
      source: options.source || { type: 'dashboard' }
    });
  }

  /**
   * Log shift action
   * @param {string} guildId - Discord guild ID
   * @param {string} action - Action type (start, end)
   * @param {Object} actor - Staff member
   * @param {Object} options - Log options
   * @returns {Promise<ActivityLog>} Created log
   */
  async logShiftAction(guildId, action, actor, options = {}) {
    const typeMap = {
      start: 'staff_shift_start',
      end: 'staff_shift_end'
    };

    return this.log({
      guildId,
      type: typeMap[action] || 'custom',
      severity: 'info',
      actor: {
        userId: actor.userId,
        username: actor.username,
        discriminator: actor.discriminator || '0',
        avatar: actor.avatar || null
      },
      details: {
        description: `Shift ${action}ed`,
        duration: options.duration || null,
        metadata: {
          shiftId: options.shiftId || null,
          ...options.metadata
        }
      },
      relatedEntities: {
        shiftId: options.shiftId || null
      },
      source: options.source || { type: 'dashboard' }
    });
  }

  /**
   * Log ticket action
   * @param {string} guildId - Discord guild ID
   * @param {string} action - Action type (created, closed, claimed)
   * @param {Object} actor - User performing action
   * @param {Object} options - Log options
   * @returns {Promise<ActivityLog>} Created log
   */
  async logTicketAction(guildId, action, actor, options = {}) {
    const typeMap = {
      created: 'ticket_created',
      closed: 'ticket_closed',
      claimed: 'ticket_claimed'
    };

    return this.log({
      guildId,
      type: typeMap[action] || 'custom',
      severity: 'info',
      actor: {
        userId: actor.userId,
        username: actor.username,
        discriminator: actor.discriminator || '0',
        avatar: actor.avatar || null
      },
      target: options.target || null,
      details: {
        description: `Ticket ${action}`,
        metadata: {
          ticketId: options.ticketId || null,
          ...options.metadata
        }
      },
      relatedEntities: {
        ticketId: options.ticketId || null
      },
      source: options.source || { type: 'discord' }
    });
  }

  /**
   * Log promotion/demotion
   * @param {string} guildId - Discord guild ID
   * @param {string} type - Type (promotion, demotion)
   * @param {Object} processedBy - User processing
   * @param {Object} target - Target user
   * @param {Object} options - Log options
   * @returns {Promise<ActivityLog>} Created log
   */
  async logPromotion(guildId, type, processedBy, target, options = {}) {
    const typeMap = {
      promotion: 'promotion_given',
      demotion: 'demotion_given'
    };

    return this.log({
      guildId,
      type: typeMap[type] || 'custom',
      severity: 'medium',
      actor: {
        userId: processedBy.userId,
        username: processedBy.username,
        discriminator: processedBy.discriminator || '0',
        avatar: processedBy.avatar || null
      },
      target: {
        userId: target.userId,
        username: target.username,
        discriminator: target.discriminator || '0',
        avatar: target.avatar || null
      },
      details: {
        description: `${type} from ${options.fromRank} to ${options.toRank}`,
        reason: options.reason || null,
        metadata: {
          fromRank: options.fromRank,
          toRank: options.toRank,
          ...options.metadata
        }
      },
      source: options.source || { type: 'dashboard' }
    });
  }

  /**
   * Get recent logs
   * @param {string} guildId - Discord guild ID
   * @param {Object} options - Query options
   * @returns {Promise<Array>} Array of logs
   */
  async getRecentLogs(guildId, options = {}) {
    return ActivityLog.getRecentLogs(guildId, options);
  }

  /**
   * Get log statistics
   * @param {string} guildId - Discord guild ID
   * @param {number} days - Number of days
   * @returns {Promise<Object>} Log statistics
   */
  async getStats(guildId, days = 7) {
    return ActivityLog.getStats(guildId, days);
  }

  /**
   * Get staff activity
   * @param {string} guildId - Discord guild ID
   * @param {string} userId - User ID
   * @param {number} days - Number of days
   * @returns {Promise<Object>} Staff activity
   */
  async getStaffActivity(guildId, userId, days = 30) {
    return ActivityLog.getStaffActivity(guildId, userId, days);
  }

  /**
   * Soft delete a log entry
   * @param {string} logId - Log ID
   * @param {Object} deletedBy - User deleting
   * @returns {Promise<ActivityLog>} Updated log
   */
  async deleteLog(logId, deletedBy) {
    return ActivityLog.softDelete(logId, deletedBy);
  }

  /**
   * Bulk delete old logs
   * @param {string} guildId - Discord guild ID
   * @param {number} olderThanDays - Delete logs older than this many days
   * @returns {Promise<number>} Number of logs deleted
   */
  async bulkDeleteOld(guildId, olderThanDays) {
    return ActivityLog.bulkDeleteOld(guildId, olderThanDays);
  }

  /**
   * Get logs by type
   * @param {string} guildId - Discord guild ID
   * @param {string|Array} types - Log types
   * @param {Object} options - Query options
   * @returns {Promise<Array>} Array of logs
   */
  async getLogsByType(guildId, types, options = {}) {
    const queryOptions = {
      ...options,
      types
    };

    return ActivityLog.getRecentLogs(guildId, queryOptions);
  }

  /**
   * Get logs for a specific user
   * @param {string} guildId - Discord guild ID
   * @param {string} userId - User ID
   * @param {Object} options - Query options
   * @returns {Promise<Array>} Array of logs
   */
  async getUserLogs(guildId, userId, options = {}) {
    const queryOptions = {
      ...options,
      actorId: userId
    };

    return ActivityLog.getRecentLogs(guildId, queryOptions);
  }

  /**
   * Get logs targeting a specific user
   * @param {string} guildId - Discord guild ID
   * @param {string} userId - Target user ID
   * @param {Object} options - Query options
   * @returns {Promise<Array>} Array of logs
   */
  async getTargetLogs(guildId, userId, options = {}) {
    const queryOptions = {
      ...options,
      targetId: userId
    };

    return ActivityLog.getRecentLogs(guildId, queryOptions);
  }

  /**
   * Add change to existing log
   * @param {string} logId - Log ID
   * @param {string} field - Changed field
   * @param {*} oldValue - Old value
   * @param {*} newValue - New value
   * @returns {Promise<ActivityLog>} Updated log
   */
  async addChangeToLog(logId, field, oldValue, newValue) {
    const log = await ActivityLog.findOne({ logId });

    if (!log) {
      throw new Error('Log not found');
    }

    await log.addChange(field, oldValue, newValue);
    return log;
  }
}

export default new ActivityLogService();
