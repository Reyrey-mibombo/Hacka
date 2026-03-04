import mongoose from 'mongoose';

const activityLogSchema = new mongoose.Schema({
  guildId: {
    type: String,
    required: true,
    index: true
  },
  logId: {
    type: String,
    required: true,
    unique: true,
    index: true
  },
  type: {
    type: String,
    required: true,
    enum: [
      'command_executed',
      'message_deleted',
      'message_edited',
      'member_joined',
      'member_left',
      'member_banned',
      'member_unbanned',
      'member_kicked',
      'member_muted',
      'member_unmuted',
      'member_timeout',
      'member_warned',
      'role_created',
      'role_deleted',
      'role_updated',
      'channel_created',
      'channel_deleted',
      'channel_updated',
      'voice_joined',
      'voice_left',
      'voice_moved',
      'nickname_changed',
      'settings_changed',
      'dashboard_login',
      'dashboard_action',
      'staff_shift_start',
      'staff_shift_end',
      'ticket_created',
      'ticket_closed',
      'ticket_claimed',
      'automod_triggered',
      'promotion_given',
      'demotion_given',
      'custom'
    ],
    index: true
  },
  severity: {
    type: String,
    enum: ['info', 'low', 'medium', 'high', 'critical'],
    default: 'info'
  },
  timestamp: {
    type: Date,
    default: Date.now,
    index: true
  },
  actor: {
    userId: {
      type: String,
      default: null
    },
    username: {
      type: String,
      default: 'System'
    },
    discriminator: {
      type: String,
      default: '0'
    },
    avatar: {
      type: String,
      default: null
    },
    isBot: {
      type: Boolean,
      default: false
    },
    ipAddress: {
      type: String,
      default: null,
      select: false
    }
  },
  target: {
    userId: {
      type: String,
      default: null
    },
    username: {
      type: String,
      default: null
    },
    discriminator: {
      type: String,
      default: null
    },
    avatar: {
      type: String,
      default: null
    }
  },
  channel: {
    channelId: {
      type: String,
      default: null
    },
    name: {
      type: String,
      default: null
    },
    type: {
      type: String,
      default: null
    }
  },
  message: {
    messageId: {
      type: String,
      default: null
    },
    content: {
      type: String,
      default: null
    },
    attachments: [{
      url: String,
      filename: String,
      size: Number
    }],
    embeds: [{
      type: Object
    }],
    oldContent: {
      type: String,
      default: null
    }
  },
  details: {
    description: {
      type: String,
      required: true
    },
    reason: {
      type: String,
      default: null
    },
    duration: {
      type: Number,
      default: null
    },
    changes: [{
      field: String,
      oldValue: mongoose.Schema.Types.Mixed,
      newValue: mongoose.Schema.Types.Mixed
    }],
    metadata: {
      type: mongoose.Schema.Types.Mixed,
      default: {}
    }
  },
  relatedEntities: {
    ticketId: {
      type: String,
      default: null
    },
    warningId: {
      type: String,
      default: null
    },
    shiftId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Shift',
      default: null
    },
    commandId: {
      type: String,
      default: null
    },
    roleId: {
      type: String,
      default: null
    }
  },
  source: {
    type: {
      type: String,
      enum: ['discord', 'dashboard', 'api', 'automod', 'system'],
      default: 'system'
    },
    version: {
      type: String,
      default: null
    }
  },
  expiresAt: {
    type: Date,
    default: null,
    index: true
  },
  isDeleted: {
    type: Boolean,
    default: false
  },
  deletedAt: {
    type: Date,
    default: null
  },
  deletedBy: {
    userId: {
      type: String,
      default: null
    },
    username: {
      type: String,
      default: null
    }
  }
}, {
  timestamps: true
});

activityLogSchema.index({ guildId: 1, type: 1 });
activityLogSchema.index({ guildId: 1, timestamp: -1 });
activityLogSchema.index({ guildId: 1, 'actor.userId': 1 });
activityLogSchema.index({ guildId: 1, 'target.userId': 1 });
activityLogSchema.index({ guildId: 1, severity: 1 });
activityLogSchema.index({ type: 1, timestamp: -1 });
activityLogSchema.index({ isDeleted: 1 });

activityLogSchema.statics.createLog = async function(logData) {
  const logId = 'log_' + Date.now().toString(36) + '_' + Math.random().toString(36).substr(2, 9);
  
  const log = new this({
    ...logData,
    logId
  });
  
  await log.save();
  return log;
};

activityLogSchema.statics.getRecentLogs = async function(guildId, options = {}) {
  const {
    limit = 50,
    skip = 0,
    types = null,
    severity = null,
    actorId = null,
    targetId = null,
    startDate = null,
    endDate = null
  } = options;
  
  const query = { guildId, isDeleted: false };
  
  if (types) {
    query.type = Array.isArray(types) ? { $in: types } : types;
  }
  
  if (severity) {
    query.severity = severity;
  }
  
  if (actorId) {
    query['actor.userId'] = actorId;
  }
  
  if (targetId) {
    query['target.userId'] = targetId;
  }
  
  if (startDate || endDate) {
    query.timestamp = {};
    if (startDate) query.timestamp.$gte = new Date(startDate);
    if (endDate) query.timestamp.$lte = new Date(endDate);
  }
  
  return this.find(query)
    .sort({ timestamp: -1 })
    .skip(skip)
    .limit(limit)
    .select('-__v');
};

activityLogSchema.statics.getStats = async function(guildId, days = 7) {
  const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
  
  const stats = await this.aggregate([
    {
      $match: {
        guildId,
        timestamp: { $gte: since },
        isDeleted: false
      }
    },
    {
      $group: {
        _id: '$type',
        count: { $sum: 1 }
      }
    },
    { $sort: { count: -1 } }
  ]);
  
  const severityStats = await this.aggregate([
    {
      $match: {
        guildId,
        timestamp: { $gte: since },
        isDeleted: false
      }
    },
    {
      $group: {
        _id: '$severity',
        count: { $sum: 1 }
      }
    }
  ]);
  
  const total = stats.reduce((acc, s) => acc + s.count, 0);
  
  return {
    total,
    byType: stats.reduce((acc, s) => {
      acc[s._id] = s.count;
      return acc;
    }, {}),
    bySeverity: severityStats.reduce((acc, s) => {
      acc[s._id] = s.count;
      return acc;
    }, {})
  };
};

activityLogSchema.statics.getStaffActivity = async function(guildId, userId, days = 30) {
  const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
  
  const activity = await this.aggregate([
    {
      $match: {
        guildId,
        'actor.userId': userId,
        timestamp: { $gte: since },
        isDeleted: false
      }
    },
    {
      $group: {
        _id: '$type',
        count: { $sum: 1 }
      }
    },
    { $sort: { count: -1 } }
  ]);
  
  const total = activity.reduce((acc, a) => acc + a.count, 0);
  
  return {
    total,
    byType: activity.reduce((acc, a) => {
      acc[a._id] = a.count;
      return acc;
    }, {})
  };
};

activityLogSchema.statics.softDelete = async function(logId, deletedBy) {
  return this.findOneAndUpdate(
    { logId },
    {
      $set: {
        isDeleted: true,
        deletedAt: new Date(),
        deletedBy
      }
    },
    { new: true }
  );
};

activityLogSchema.statics.bulkDeleteOld = async function(guildId, olderThanDays) {
  const cutoff = new Date(Date.now() - olderThanDays * 24 * 60 * 60 * 1000);
  
  const result = await this.deleteMany({
    guildId,
    timestamp: { $lt: cutoff },
    severity: { $in: ['info', 'low'] }
  });
  
  return result.deletedCount;
};

activityLogSchema.methods.addChange = async function(field, oldValue, newValue) {
  this.details.changes.push({
    field,
    oldValue,
    newValue
  });
  await this.save();
  return this;
};

const ActivityLog = mongoose.model('ActivityLog', activityLogSchema);

export default ActivityLog;
