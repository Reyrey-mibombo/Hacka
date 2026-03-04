import mongoose from 'mongoose';

const shiftSchema = new mongoose.Schema({
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
  staffRecordId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Staff',
    required: true,
    index: true
  },
  startTime: {
    type: Date,
    required: true,
    default: Date.now
  },
  endTime: {
    type: Date,
    default: null
  },
  duration: {
    type: Number,
    default: 0
  },
  status: {
    type: String,
    enum: ['active', 'completed', 'cancelled', 'paused'],
    default: 'active'
  },
  pointsEarned: {
    type: Number,
    default: 0
  },
  basePoints: {
    type: Number,
    default: 0
  },
  bonusPoints: {
    type: Number,
    default: 0
  },
  bonusReason: {
    type: String,
    default: null
  },
  notes: {
    type: String,
    default: null,
    maxlength: 1000
  },
  startedBy: {
    type: String,
    default: null
  },
  endedBy: {
    type: String,
    default: null
  },
  approvedBy: {
    type: String,
    default: null
  },
  approvedAt: {
    type: Date,
    default: null
  },
  isApproved: {
    type: Boolean,
    default: false
  },
  requiresApproval: {
    type: Boolean,
    default: false
  },
  pauseHistory: [{
    pausedAt: Date,
    resumedAt: Date,
    duration: Number
  }],
  currentPauseStarted: {
    type: Date,
    default: null
  },
  totalPauseDuration: {
    type: Number,
    default: 0
  },
  breaks: [{
    startTime: Date,
    endTime: Date,
    reason: String,
    duration: Number
  }],
  activity: {
    messagesRead: {
      type: Number,
      default: 0
    },
    messagesSent: {
      type: Number,
      default: 0
    },
    commandsUsed: {
      type: Number,
      default: 0
    },
    ticketsHandled: {
      type: Number,
      default: 0
    },
    warningsIssued: {
      type: Number,
      default: 0
    },
    usersHelped: {
      type: Number,
      default: 0
    }
  },
  checkpoints: [{
    timestamp: Date,
    duration: Number,
    notes: String
  }],
  metadata: {
    ipAddress: String,
    userAgent: String,
    startedFromDashboard: {
      type: Boolean,
      default: false
    },
    startedFromDiscord: {
      type: Boolean,
      default: false
    }
  }
}, {
  timestamps: true
});

shiftSchema.index({ guildId: 1, status: 1 });
shiftSchema.index({ guildId: 1, userId: 1 });
shiftSchema.index({ guildId: 1, startTime: -1 });
shiftSchema.index({ userId: 1, status: 1 });
shiftSchema.index({ staffRecordId: 1 });
shiftSchema.index({ isApproved: 1 });
shiftSchema.index({ startTime: -1, endTime: -1 });

shiftSchema.virtual('isActive').get(function() {
  return this.status === 'active';
});

shiftSchema.virtual('isPaused').get(function() {
  return this.status === 'paused';
});

shiftSchema.virtual('currentDuration').get(function() {
  if (this.status === 'completed' || this.status === 'cancelled') {
    return this.duration;
  }
  
  const now = new Date();
  const elapsed = now - this.startTime;
  const pauseTime = this.totalPauseDuration + 
    (this.currentPauseStarted ? now - this.currentPauseStarted : 0);
  
  return Math.floor((elapsed - pauseTime) / 1000);
});

shiftSchema.methods.end = async function(endedBy, notes = null) {
  if (this.status !== 'active' && this.status !== 'paused') {
    throw new Error('Shift is not active');
  }
  
  const now = new Date();
  const duration = this.currentDuration;
  
  this.endTime = now;
  this.duration = duration;
  this.status = 'completed';
  this.endedBy = endedBy;
  
  if (notes) {
    this.notes = notes;
  }
  
  const minutes = Math.floor(duration / 60);
  this.basePoints = Math.floor(minutes / 10);
  this.pointsEarned = this.basePoints + this.bonusPoints;
  
  await this.save();
  
  return this;
};

shiftSchema.methods.pause = async function(reason = null) {
  if (this.status !== 'active') {
    throw new Error('Shift must be active to pause');
  }
  
  this.status = 'paused';
  this.currentPauseStarted = new Date();
  
  if (reason) {
    this.breaks.push({
      startTime: this.currentPauseStarted,
      reason,
      duration: 0
    });
  }
  
  await this.save();
  return this;
};

shiftSchema.methods.resume = async function() {
  if (this.status !== 'paused') {
    throw new Error('Shift must be paused to resume');
  }
  
  const now = new Date();
  const pauseDuration = Math.floor((now - this.currentPauseStarted) / 1000);
  
  this.pauseHistory.push({
    pausedAt: this.currentPauseStarted,
    resumedAt: now,
    duration: pauseDuration
  });
  
  this.totalPauseDuration += pauseDuration;
  this.currentPauseStarted = null;
  this.status = 'active';
  
  const currentBreak = this.breaks[this.breaks.length - 1];
  if (currentBreak && !currentBreak.endTime) {
    currentBreak.endTime = now;
    currentBreak.duration = pauseDuration;
  }
  
  await this.save();
  return this;
};

shiftSchema.methods.cancel = async function(cancelledBy, reason) {
  if (this.status !== 'active' && this.status !== 'paused') {
    throw new Error('Cannot cancel a completed shift');
  }
  
  this.status = 'cancelled';
  this.endTime = new Date();
  this.endedBy = cancelledBy;
  this.notes = reason || 'Shift cancelled';
  this.pointsEarned = 0;
  this.basePoints = 0;
  this.bonusPoints = 0;
  
  await this.save();
  return this;
};

shiftSchema.methods.addBonusPoints = async function(points, reason, addedBy) {
  this.bonusPoints += points;
  this.bonusReason = reason;
  this.pointsEarned = this.basePoints + this.bonusPoints;
  
  await this.save();
  
  return {
    totalPoints: this.pointsEarned,
    bonusPoints: this.bonusPoints,
    reason,
    addedBy
  };
};

shiftSchema.methods.approve = async function(approvedBy) {
  this.isApproved = true;
  this.approvedBy = approvedBy;
  this.approvedAt = new Date();
  
  await this.save();
  return this;
};

shiftSchema.methods.addCheckpoint = async function(notes = null) {
  const duration = this.currentDuration;
  
  this.checkpoints.push({
    timestamp: new Date(),
    duration,
    notes
  });
  
  await this.save();
  return this.checkpoints[this.checkpoints.length - 1];
};

shiftSchema.methods.logActivity = async function(activityType, count = 1) {
  if (this.activity[activityType] !== undefined) {
    this.activity[activityType] += count;
    await this.save();
  }
};

shiftSchema.statics.getActiveShift = async function(guildId, userId) {
  return this.findOne({
    guildId,
    userId,
    status: { $in: ['active', 'paused'] }
  });
};

shiftSchema.statics.getStaffStats = async function(guildId, userId, days = 30) {
  const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
  
  const stats = await this.aggregate([
    {
      $match: {
        guildId,
        userId,
        status: 'completed',
        startTime: { $gte: since }
      }
    },
    {
      $group: {
        _id: null,
        totalShifts: { $sum: 1 },
        totalDuration: { $sum: '$duration' },
        totalPoints: { $sum: '$pointsEarned' },
        avgDuration: { $avg: '$duration' },
        totalTickets: { $sum: '$activity.ticketsHandled' },
        totalWarnings: { $sum: '$activity.warningsIssued' }
      }
    }
  ]);
  
  return stats[0] || {
    totalShifts: 0,
    totalDuration: 0,
    totalPoints: 0,
    avgDuration: 0,
    totalTickets: 0,
    totalWarnings: 0
  };
};

shiftSchema.statics.getGuildStats = async function(guildId, days = 30) {
  const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
  
  const stats = await this.aggregate([
    {
      $match: {
        guildId,
        status: 'completed',
        startTime: { $gte: since }
      }
    },
    {
      $group: {
        _id: null,
        totalShifts: { $sum: 1 },
        uniqueStaff: { $addToSet: '$userId' },
        totalDuration: { $sum: '$duration' },
        totalPoints: { $sum: '$pointsEarned' },
        avgDuration: { $avg: '$duration' }
      }
    },
    {
      $project: {
        totalShifts: 1,
        uniqueStaff: { $size: '$uniqueStaff' },
        totalDuration: 1,
        totalPoints: 1,
        avgDuration: 1
      }
    }
  ]);
  
  return stats[0] || {
    totalShifts: 0,
    uniqueStaff: 0,
    totalDuration: 0,
    totalPoints: 0,
    avgDuration: 0
  };
};

const Shift = mongoose.model('Shift', shiftSchema);

export default Shift;
