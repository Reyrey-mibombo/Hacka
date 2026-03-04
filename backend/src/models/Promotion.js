import mongoose from 'mongoose';

const promotionSchema = new mongoose.Schema({
  guildId: {
    type: String,
    required: true,
    index: true
  },
  userId: {
    type: String,
    required: true,
    index: true
  },
  username: {
    type: String,
    required: true
  },
  avatar: {
    type: String,
    default: null
  },
  type: {
    type: String,
    enum: ['promotion', 'demotion', 'role_change', 'rank_reset'],
    required: true
  },
  fromRank: {
    type: String,
    required: true
  },
  toRank: {
    type: String,
    required: true
  },
  fromLevel: {
    type: Number,
    default: null
  },
  toLevel: {
    type: Number,
    default: null
  },
  fromPoints: {
    type: Number,
    default: null
  },
  toPoints: {
    type: Number,
    default: null
  },
  processedBy: {
    userId: {
      type: String,
      required: true
    },
    username: {
      type: String,
      required: true
    },
    avatar: {
      type: String,
      default: null
    }
  },
  reason: {
    type: String,
    required: true,
    maxlength: 1000
  },
  processedAt: {
    type: Date,
    default: Date.now
  },
  effectiveDate: {
    type: Date,
    default: Date.now
  },
  requirements: {
    minPoints: {
      type: Number,
      default: null
    },
    minShifts: {
      type: Number,
      default: null
    },
    minDuration: {
      type: Number,
      default: null
    },
    timeInRank: {
      type: Number,
      default: null
    },
    noActiveWarnings: {
      type: Boolean,
      default: false
    },
    customRequirements: [{
      name: String,
      met: Boolean,
      value: mongoose.Schema.Types.Mixed
    }]
  },
  metRequirements: {
    type: Boolean,
    default: true
  },
  unmetRequirements: [{
    type: String
  }],
  rolesAdded: [{
    roleId: String,
    name: String
  }],
  rolesRemoved: [{
    roleId: String,
    name: String
  }],
  permissionsGranted: [{
    type: String
  }],
  permissionsRevoked: [{
    type: String
  }],
  probationary: {
    type: Boolean,
    default: false
  },
  probationEndDate: {
    type: Date,
    default: null
  },
  probationStatus: {
    type: String,
    enum: ['pending', 'passed', 'failed', null],
    default: null
  },
  probationReviewedBy: {
    type: String,
    default: null
  },
  probationReviewedAt: {
    type: Date,
    default: null
  },
  probationNotes: {
    type: String,
    default: null
  },
  isReverted: {
    type: Boolean,
    default: false
  },
  revertedAt: {
    type: Date,
    default: null
  },
  revertedBy: {
    userId: String,
    username: String
  },
  revertReason: {
    type: String,
    default: null
  },
  notes: {
    type: String,
    default: null,
    maxlength: 2000
  },
  announcementPosted: {
    type: Boolean,
    default: false
  },
  announcementChannelId: {
    type: String,
    default: null
  },
  announcementMessageId: {
    type: String,
    default: null
  },
  metadata: {
    processedFromDashboard: {
      type: Boolean,
      default: false
    },
    processedFromDiscord: {
      type: Boolean,
      default: false
    },
    ipAddress: String,
    userAgent: String
  }
}, {
  timestamps: true
});

const rankRequirementSchema = new mongoose.Schema({
  guildId: {
    type: String,
    required: true,
    index: true
  },
  rankName: {
    type: String,
    required: true
  },
  rankLevel: {
    type: Number,
    required: true,
    min: 0
  },
  displayName: {
    type: String,
    required: true
  },
  description: {
    type: String,
    default: null
  },
  color: {
    type: String,
    default: '#99AAB5'
  },
  roleId: {
    type: String,
    default: null
  },
  hoist: {
    type: Boolean,
    default: false
  },
  icon: {
    type: String,
    default: null
  },
  requirements: {
    minPoints: {
      type: Number,
      default: 0
    },
    minShifts: {
      type: Number,
      default: 0
    },
    minTotalDuration: {
      type: Number,
      default: 0
    },
    minShiftsPerWeek: {
      type: Number,
      default: 0
    },
    minShiftsPerMonth: {
      type: Number,
      default: 0
    },
    timeInPreviousRank: {
      type: Number,
      default: 0
    },
    maxWarnings: {
      type: Number,
      default: null
    },
    maxActiveWarnings: {
      type: Number,
      default: null
    },
    requiredTraining: [{
      name: String,
      completed: Boolean
    }],
    customRequirements: [{
      name: String,
      description: String,
      type: {
        type: String,
        enum: ['boolean', 'number', 'string']
      },
      value: mongoose.Schema.Types.Mixed
    }]
  },
  benefits: {
    pointsMultiplier: {
      type: Number,
      default: 1.0
    },
    permissions: [{
      type: String
    }],
    canPromote: {
      type: Boolean,
      default: false
    },
    canDemote: {
      type: Boolean,
      default: false
    },
    canManageShifts: {
      type: Boolean,
      default: false
    },
    canManageWarnings: {
      type: Boolean,
      default: false
    },
    canManageTickets: {
      type: Boolean,
      default: false
    },
    dashboardAccess: {
      type: String,
      enum: ['none', 'view', 'moderate', 'admin'],
      default: 'view'
    }
  },
  autoPromote: {
    type: Boolean,
    default: false
  },
  requiresApproval: {
    type: Boolean,
    default: true
  },
  isDefault: {
    type: Boolean,
    default: false
  },
  isHighest: {
    type: Boolean,
    default: false
  },
  order: {
    type: Number,
    required: true
  },
  isActive: {
    type: Boolean,
    default: true
  }
}, {
  timestamps: true
});

const promotionRequestSchema = new mongoose.Schema({
  guildId: {
    type: String,
    required: true,
    index: true
  },
  userId: {
    type: String,
    required: true,
    index: true
  },
  username: {
    type: String,
    required: true
  },
  currentRank: {
    type: String,
    required: true
  },
  requestedRank: {
    type: String,
    required: true
  },
  status: {
    type: String,
    enum: ['pending', 'approved', 'denied', 'withdrawn'],
    default: 'pending'
  },
  requestedAt: {
    type: Date,
    default: Date.now
  },
  reason: {
    type: String,
    required: true,
    maxlength: 1000
  },
  reviewedBy: {
    userId: String,
    username: String,
    avatar: String
  },
  reviewedAt: {
    type: Date,
    default: null
  },
  reviewNotes: {
    type: String,
    default: null
  },
  requirementsCheck: {
    checked: {
      type: Boolean,
      default: false
    },
    results: [{
      requirement: String,
      met: Boolean,
      current: mongoose.Schema.Types.Mixed,
      required: mongoose.Schema.Types.Mixed
    }],
    allMet: {
      type: Boolean,
      default: false
    }
  }
}, {
  timestamps: true
});

promotionSchema.index({ guildId: 1, userId: 1 });
promotionSchema.index({ guildId: 1, processedAt: -1 });
promotionSchema.index({ guildId: 1, type: 1 });
promotionSchema.index({ userId: 1, type: 1 });
promotionSchema.index({ probationary: 1, probationStatus: 1 });

rankRequirementSchema.index({ guildId: 1, rankLevel: 1 }, { unique: true });
rankRequirementSchema.index({ guildId: 1, rankName: 1 });
rankRequirementSchema.index({ guildId: 1, order: 1 });

promotionRequestSchema.index({ guildId: 1, userId: 1, status: 1 });
promotionRequestSchema.index({ guildId: 1, status: 1 });

promotionSchema.methods.revert = async function(revertedBy, reason) {
  if (this.isReverted) {
    throw new Error('Promotion is already reverted');
  }
  
  this.isReverted = true;
  this.revertedAt = new Date();
  this.revertedBy = {
    userId: revertedBy.userId || revertedBy,
    username: revertedBy.username || 'Unknown'
  };
  this.revertReason = reason;
  
  await this.save();
  return this;
};

promotionSchema.methods.completeProbation = async function(passed, reviewedBy, notes) {
  if (!this.probationary || this.probationStatus !== 'pending') {
    throw new Error('No active probation period');
  }
  
  this.probationStatus = passed ? 'passed' : 'failed';
  this.probationReviewedBy = reviewedBy.userId || reviewedBy;
  this.probationReviewedAt = new Date();
  this.probationNotes = notes;
  
  await this.save();
  return this;
};

rankRequirementSchema.statics.getRankHierarchy = async function(guildId) {
  return this.find({ guildId, isActive: true })
    .sort({ order: 1 })
    .select('-__v');
};

rankRequirementSchema.statics.getNextRank = async function(guildId, currentRankName) {
  const currentRank = await this.findOne({ guildId, rankName: currentRankName });
  if (!currentRank) return null;
  
  return this.findOne({
    guildId,
    order: { $gt: currentRank.order },
    isActive: true
  }).sort({ order: 1 });
};

rankRequirementSchema.methods.checkRequirements = function(staffData) {
  const results = [];
  let allMet = true;
  
  const checks = [
    { name: 'Points', current: staffData.points, required: this.requirements.minPoints },
    { name: 'Total Shifts', current: staffData.shifts?.total, required: this.requirements.minShifts },
    { name: 'Total Duration', current: staffData.shifts?.totalDuration, required: this.requirements.minTotalDuration }
  ];
  
  for (const check of checks) {
    const met = check.current >= check.required;
    if (!met) allMet = false;
    
    results.push({
      requirement: check.name,
      met,
      current: check.current,
      required: check.required
    });
  }
  
  if (this.requirements.maxWarnings !== null) {
    const met = staffData.warnings?.count <= this.requirements.maxWarnings;
    if (!met) allMet = false;
    results.push({
      requirement: 'Max Warnings',
      met,
      current: staffData.warnings?.count,
      required: this.requirements.maxWarnings
    });
  }
  
  return { allMet, results };
};

const Promotion = mongoose.model('Promotion', promotionSchema);
const RankRequirement = mongoose.model('RankRequirement', rankRequirementSchema);
const PromotionRequest = mongoose.model('PromotionRequest', promotionRequestSchema);

export { Promotion, RankRequirement, PromotionRequest };
export default Promotion;
