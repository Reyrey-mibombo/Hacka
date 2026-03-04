import mongoose from 'mongoose';

const warningSchema = new mongoose.Schema({
  guildId: {
    type: String,
    required: true,
    index: true
  },
  warningId: {
    type: String,
    required: true,
    unique: true,
    index: true
  },
  targetId: {
    type: String,
    required: true,
    index: true
  },
  targetUsername: {
    type: String,
    required: true
  },
  targetDiscriminator: {
    type: String,
    default: '0'
  },
  targetAvatar: {
    type: String,
    default: null
  },
  issuerId: {
    type: String,
    required: true,
    index: true
  },
  issuerUsername: {
    type: String,
    required: true
  },
  issuerDiscriminator: {
    type: String,
    default: '0'
  },
  issuerAvatar: {
    type: String,
    default: null
  },
  reason: {
    type: String,
    required: true,
    maxlength: 1000
  },
  severity: {
    type: String,
    enum: ['low', 'medium', 'high', 'critical'],
    default: 'medium'
  },
  weight: {
    type: Number,
    default: 1,
    min: 1,
    max: 10
  },
  points: {
    type: Number,
    default: 0
  },
  evidence: [{
    type: {
      type: String,
      enum: ['image', 'video', 'link', 'text', 'message']
    },
    url: String,
    content: String,
    messageId: String,
    channelId: String,
    timestamp: Date
  }],
  createdAt: {
    type: Date,
    default: Date.now
  },
  expiresAt: {
    type: Date,
    default: null
  },
  duration: {
    type: Number,
    default: null
  },
  expired: {
    type: Boolean,
    default: false
  },
  expiredAt: {
    type: Date,
    default: null
  },
  revoked: {
    type: Boolean,
    default: false
  },
  revokedAt: {
    type: Date,
    default: null
  },
  revokedBy: {
    type: String,
    default: null
  },
  revokedByUsername: {
    type: String,
    default: null
  },
  revokeReason: {
    type: String,
    default: null
  },
  acknowledged: {
    type: Boolean,
    default: false
  },
  acknowledgedAt: {
    type: Date,
    default: null
  },
  appealed: {
    type: Boolean,
    default: false
  },
  appealReason: {
    type: String,
    default: null
  },
  appealSubmittedAt: {
    type: Date,
    default: null
  },
  appealStatus: {
    type: String,
    enum: ['pending', 'approved', 'denied'],
    default: null
  },
  appealReviewedBy: {
    type: String,
    default: null
  },
  appealReviewedAt: {
    type: Date,
    default: null
  },
  appealDecisionReason: {
    type: String,
    default: null
  },
  relatedWarnings: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Warning'
  }],
  notes: {
    type: String,
    default: null,
    maxlength: 1000
  },
  metadata: {
    channelId: String,
    messageId: String,
    context: String,
    automated: {
      type: Boolean,
      default: false
    },
    triggeredBy: String,
    ruleId: String
  },
  actionsTaken: [{
    type: {
      type: String,
      enum: ['mute', 'kick', 'ban', 'timeout', 'role_add', 'role_remove', 'note']
    },
    duration: Number,
    reason: String,
    executedAt: {
      type: Date,
      default: Date.now
    },
    executedBy: String,
    reversed: {
      type: Boolean,
      default: false
    },
    reversedAt: Date,
    reversedBy: String
  }]
}, {
  timestamps: true
});

warningSchema.index({ guildId: 1, targetId: 1 });
warningSchema.index({ guildId: 1, issuerId: 1 });
warningSchema.index({ guildId: 1, createdAt: -1 });
warningSchema.index({ guildId: 1, severity: 1 });
warningSchema.index({ targetId: 1, expired: 1, revoked: 1 });
warningSchema.index({ expired: 1, expiresAt: 1 });
warningSchema.index({ warningId: 1 });
warningSchema.index({ 'metadata.automated': 1 });

warningSchema.virtual('isActive').get(function() {
  return !this.expired && !this.revoked;
});

warningSchema.virtual('isExpired').get(function() {
  if (this.expired) return true;
  if (this.expiresAt && new Date() > this.expiresAt) {
    return true;
  }
  return false;
});

warningSchema.methods.checkExpiration = async function() {
  if (this.expiresAt && new Date() > this.expiresAt && !this.expired) {
    this.expired = true;
    this.expiredAt = new Date();
    await this.save();
    return true;
  }
  return false;
};

warningSchema.methods.revoke = async function(revokedBy, reason) {
  if (this.revoked) {
    throw new Error('Warning is already revoked');
  }
  
  this.revoked = true;
  this.revokedAt = new Date();
  this.revokedBy = revokedBy.userId || revokedBy;
  this.revokedByUsername = revokedBy.username || revokedBy;
  this.revokeReason = reason;
  
  await this.save();
  return this;
};

warningSchema.methods.acknowledge = async function() {
  if (this.acknowledged) return this;
  
  this.acknowledged = true;
  this.acknowledgedAt = new Date();
  await this.save();
  return this;
};

warningSchema.methods.submitAppeal = async function(reason) {
  if (this.appealed) {
    throw new Error('An appeal has already been submitted for this warning');
  }
  
  if (this.revoked || this.expired) {
    throw new Error('Cannot appeal a revoked or expired warning');
  }
  
  this.appealed = true;
  this.appealReason = reason;
  this.appealSubmittedAt = new Date();
  this.appealStatus = 'pending';
  
  await this.save();
  return this;
};

warningSchema.methods.reviewAppeal = async function(decision, reviewer, reason) {
  if (!this.appealed || this.appealStatus !== 'pending') {
    throw new Error('No pending appeal to review');
  }
  
  this.appealStatus = decision;
  this.appealReviewedBy = reviewer.userId || reviewer;
  this.appealReviewedAt = new Date();
  this.appealDecisionReason = reason;
  
  if (decision === 'approved') {
    await this.revoke(reviewer, 'Appeal approved: ' + reason);
  }
  
  await this.save();
  return this;
};

warningSchema.methods.addEvidence = async function(evidence) {
  this.evidence.push({
    ...evidence,
    timestamp: new Date()
  });
  await this.save();
  return this;
};

warningSchema.methods.addAction = async function(action) {
  this.actionsTaken.push({
    ...action,
    executedAt: new Date()
  });
  await this.save();
  return this;
};

warningSchema.statics.generateWarningId = function() {
  const timestamp = Date.now().toString(36).toUpperCase();
  const random = Math.random().toString(36).substring(2, 6).toUpperCase();
  return `WARN-${timestamp}-${random}`;
};

warningSchema.statics.getActiveWarnings = async function(guildId, targetId) {
  await this.updateMany(
    {
      guildId,
      targetId,
      expired: false,
      revoked: false,
      expiresAt: { $lt: new Date() }
    },
    {
      $set: { expired: true, expiredAt: new Date() }
    }
  );
  
  return this.find({
    guildId,
    targetId,
    expired: false,
    revoked: false
  }).sort({ createdAt: -1 });
};

warningSchema.statics.getWarningCount = async function(guildId, targetId, options = {}) {
  const { severity = null, includeExpired = false, includeRevoked = false } = options;
  
  const query = { guildId, targetId };
  
  if (!includeExpired) {
    query.$or = [
      { expiresAt: null },
      { expiresAt: { $gt: new Date() } }
    ];
    query.expired = false;
  }
  
  if (!includeRevoked) {
    query.revoked = false;
  }
  
  if (severity) {
    query.severity = severity;
  }
  
  return this.countDocuments(query);
};

warningSchema.statics.getTotalWeight = async function(guildId, targetId) {
  const result = await this.aggregate([
    {
      $match: {
        guildId,
        targetId,
        expired: false,
        revoked: false,
        $or: [
          { expiresAt: null },
          { expiresAt: { $gt: new Date() } }
        ]
      }
    },
    {
      $group: {
        _id: null,
        totalWeight: { $sum: '$weight' }
      }
    }
  ]);
  
  return result[0]?.totalWeight || 0;
};

warningSchema.statics.getStaffStats = async function(guildId, issuerId, days = 30) {
  const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
  
  const stats = await this.aggregate([
    {
      $match: {
        guildId,
        issuerId,
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
  
  const total = stats.reduce((acc, s) => acc + s.count, 0);
  
  return {
    total,
    bySeverity: stats.reduce((acc, s) => {
      acc[s._id] = s.count;
      return acc;
    }, {})
  };
};

const Warning = mongoose.model('Warning', warningSchema);

export default Warning;
