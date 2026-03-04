import mongoose from 'mongoose';

const staffSchema = new mongoose.Schema({
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
    required: true,
    trim: true
  },
  discriminator: {
    type: String,
    default: '0'
  },
  globalName: {
    type: String,
    default: null
  },
  avatar: {
    type: String,
    default: null
  },
  nickname: {
    type: String,
    default: null
  },
  rank: {
    type: String,
    required: true,
    trim: true,
    default: 'Trial Moderator'
  },
  rankLevel: {
    type: Number,
    default: 0,
    min: 0
  },
  points: {
    type: Number,
    default: 0,
    min: 0
  },
  totalPointsEarned: {
    type: Number,
    default: 0,
    min: 0
  },
  shifts: {
    total: {
      type: Number,
      default: 0
    },
    active: {
      type: Boolean,
      default: false
    },
    currentShiftId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Shift',
      default: null
    },
    lastShiftAt: {
      type: Date,
      default: null
    },
    totalDuration: {
      type: Number,
      default: 0
    },
    weeklyDuration: {
      type: Number,
      default: 0
    },
    monthlyDuration: {
      type: Number,
      default: 0
    }
  },
  warnings: {
    count: {
      type: Number,
      default: 0
    },
    active: {
      type: Number,
      default: 0
    },
    history: [{
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Warning'
    }]
  },
  promotions: [{
    fromRank: String,
    toRank: String,
    promotedBy: String,
    promotedByUsername: String,
    reason: String,
    timestamp: {
      type: Date,
      default: Date.now
    }
  }],
  demotions: [{
    fromRank: String,
    toRank: String,
    demotedBy: String,
    demotedByUsername: String,
    reason: String,
    timestamp: {
      type: Date,
      default: Date.now
    }
  }],
  joinedAt: {
    type: Date,
    default: Date.now
  },
  lastActiveAt: {
    type: Date,
    default: Date.now
  },
  isActive: {
    type: Boolean,
    default: true
  },
  isOnLeave: {
    type: Boolean,
    default: false
  },
  leaveReason: {
    type: String,
    default: null
  },
  leaveStartedAt: {
    type: Date,
    default: null
  },
  leaveEndsAt: {
    type: Date,
    default: null
  },
  roles: [{
    roleId: String,
    name: String,
    color: Number
  }],
  permissions: [{
    type: String
  }],
  metrics: {
    messagesHandled: {
      type: Number,
      default: 0
    },
    ticketsHandled: {
      type: Number,
      default: 0
    },
    warnsIssued: {
      type: Number,
      default: 0
    },
    mutesIssued: {
      type: Number,
      default: 0
    },
    kicksIssued: {
      type: Number,
      default: 0
    },
    bansIssued: {
      type: Number,
      default: 0
    },
    reportsHandled: {
      type: Number,
      default: 0
    }
  },
  notes: {
    type: String,
    default: null,
    maxlength: 2000
  },
  adminNotes: {
    type: String,
    default: null,
    maxlength: 2000,
    select: false
  },
  discordRoles: [{
    type: String
  }],
  department: {
    type: String,
    default: null
  },
  canManageShifts: {
    type: Boolean,
    default: false
  },
  canPromote: {
    type: Boolean,
    default: false
  },
  canWarn: {
    type: Boolean,
    default: true
  }
}, {
  timestamps: true
});

staffSchema.index({ guildId: 1, userId: 1 }, { unique: true });
staffSchema.index({ guildId: 1, rank: 1 });
staffSchema.index({ guildId: 1, points: -1 });
staffSchema.index({ guildId: 1, 'shifts.active': 1 });
staffSchema.index({ guildId: 1, isActive: 1 });
staffSchema.index({ userId: 1 });
staffSchema.index({ joinedAt: -1 });

staffSchema.methods.getDisplayName = function() {
  return this.nickname || this.globalName || this.username;
};

staffSchema.methods.getAvatarURL = function(size = 128) {
  if (this.avatar) {
    return `https://cdn.discordapp.com/avatars/${this.userId}/${this.avatar}.png?size=${size}`;
  }
  const defaultAvatar = parseInt(this.discriminator) % 5;
  return `https://cdn.discordapp.com/embed/avatars/${defaultAvatar}.png`;
};

staffSchema.methods.addPoints = async function(points, reason = 'Manual addition') {
  this.points += points;
  this.totalPointsEarned += points;
  
  await this.save();
  
  return {
    previousPoints: this.points - points,
    currentPoints: this.points,
    added: points,
    reason
  };
};

staffSchema.methods.startShift = async function() {
  if (this.shifts.active) {
    throw new Error('Staff member is already on shift');
  }
  
  this.shifts.active = true;
  this.lastActiveAt = new Date();
  await this.save();
  
  return this;
};

staffSchema.methods.endShift = async function(duration, pointsEarned) {
  if (!this.shifts.active) {
    throw new Error('Staff member is not on shift');
  }
  
  this.shifts.active = false;
  this.shifts.currentShiftId = null;
  this.shifts.lastShiftAt = new Date();
  this.shifts.total += 1;
  this.shifts.totalDuration += duration;
  this.shifts.weeklyDuration += duration;
  this.shifts.monthlyDuration += duration;
  this.points += pointsEarned;
  this.totalPointsEarned += pointsEarned;
  
  await this.save();
  
  return this;
};

staffSchema.methods.promote = async function(newRank, promotedBy, reason) {
  const oldRank = this.rank;
  this.rank = newRank;
  this.rankLevel += 1;
  
  this.promotions.push({
    fromRank: oldRank,
    toRank: newRank,
    promotedBy: promotedBy.userId || promotedBy,
    promotedByUsername: promotedBy.username || 'Unknown',
    reason,
    timestamp: new Date()
  });
  
  await this.save();
  
  return {
    previousRank: oldRank,
    newRank,
    promotions: this.promotions
  };
};

staffSchema.methods.addWarning = async function(warningId) {
  this.warnings.count += 1;
  this.warnings.active += 1;
  this.warnings.history.push(warningId);
  await this.save();
};

staffSchema.methods.resolveWarning = async function() {
  if (this.warnings.active > 0) {
    this.warnings.active -= 1;
    await this.save();
  }
};

staffSchema.methods.resetWeeklyStats = async function() {
  this.shifts.weeklyDuration = 0;
  await this.save();
};

staffSchema.methods.resetMonthlyStats = async function() {
  this.shifts.monthlyDuration = 0;
  await this.save();
};

staffSchema.statics.getLeaderboard = async function(guildId, limit = 10) {
  return this.find({ guildId, isActive: true })
    .sort({ points: -1 })
    .limit(limit)
    .select('userId username avatar rank points shifts.total');
};

staffSchema.statics.getActiveStaff = async function(guildId) {
  return this.find({ guildId, 'shifts.active': true });
};

const Staff = mongoose.model('Staff', staffSchema);

export default Staff;
