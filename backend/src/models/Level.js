import mongoose from 'mongoose';

const levelSchema = new mongoose.Schema({
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
  discriminator: {
    type: String,
    default: '0'
  },
  avatar: {
    type: String,
    default: null
  },
  level: {
    type: Number,
    default: 0,
    min: 0
  },
  xp: {
    type: Number,
    default: 0,
    min: 0
  },
  totalXp: {
    type: Number,
    default: 0,
    min: 0
  },
  xpToNextLevel: {
    type: Number,
    default: 100
  },
  messageCount: {
    type: Number,
    default: 0
  },
  voiceMinutes: {
    type: Number,
    default: 0
  },
  lastMessageAt: {
    type: Date,
    default: null
  },
  cooldownExpiresAt: {
    type: Date,
    default: null
  },
  rank: {
    type: Number,
    default: null
  },
  rolesAwarded: [{
    roleId: String,
    level: Number,
    awardedAt: {
      type: Date,
      default: Date.now
    }
  }],
  history: [{
    level: Number,
    xp: Number,
    timestamp: {
      type: Date,
      default: Date.now
    },
    source: {
      type: String,
      enum: ['message', 'voice', 'command', 'admin', 'bonus', 'event']
    }
  }],
  achievements: [{
    achievementId: String,
    name: String,
    description: String,
    icon: String,
    unlockedAt: {
      type: Date,
      default: Date.now
    }
  }],
  multipliers: {
    global: {
      type: Number,
      default: 1.0
    },
    active: [{
      value: Number,
      source: String,
      expiresAt: Date
    }]
  },
  settings: {
    notifications: {
      type: Boolean,
      default: true
    },
    dmNotifications: {
      type: Boolean,
      default: false
    },
    publicProfile: {
      type: Boolean,
      default: true
    }
  },
  stats: {
    highestLevel: {
      type: Number,
      default: 0
    },
    xpGainedToday: {
      type: Number,
      default: 0
    },
    xpGainedWeek: {
      type: Number,
      default: 0
    },
    xpGainedMonth: {
      type: Number,
      default: 0
    },
    lastXpReset: {
      type: Date,
      default: null
    }
  },
  lastReset: {
    type: Date,
    default: null
  },
  imported: {
    type: Boolean,
    default: false
  },
  importedFrom: {
    type: String,
    default: null
  }
}, {
  timestamps: true
});

const levelRewardSchema = new mongoose.Schema({
  guildId: {
    type: String,
    required: true,
    index: true
  },
  level: {
    type: Number,
    required: true,
    min: 1
  },
  roleId: {
    type: String,
    required: true
  },
  roleName: {
    type: String,
    required: true
  },
  keepPreviousRoles: {
    type: Boolean,
    default: false
  },
  removePreviousRoles: {
    type: Boolean,
    default: false
  },
  message: {
    type: String,
    default: null
  },
  dmMessage: {
    type: String,
    default: null
  },
  isEnabled: {
    type: Boolean,
    default: true
  }
}, {
  timestamps: true
});

const xpMultiplierSchema = new mongoose.Schema({
  guildId: {
    type: String,
    required: true,
    index: true
  },
  name: {
    type: String,
    required: true
  },
  multiplier: {
    type: Number,
    required: true,
    min: 0.1,
    max: 10
  },
  type: {
    type: String,
    enum: ['global', 'channel', 'role', 'user', 'time'],
    required: true
  },
  target: {
    type: String,
    default: null
  },
  stackWithOthers: {
    type: Boolean,
    default: true
  },
  priority: {
    type: Number,
    default: 0
  },
  isEnabled: {
    type: Boolean,
    default: true
  },
  expiresAt: {
    type: Date,
    default: null
  }
}, {
  timestamps: true
});

levelSchema.index({ guildId: 1, userId: 1 }, { unique: true });
levelSchema.index({ guildId: 1, level: -1, xp: -1 });
levelSchema.index({ guildId: 1, totalXp: -1 });
levelSchema.index({ guildId: 1, messageCount: -1 });
levelSchema.index({ guildId: 1, 'stats.xpGainedToday': -1 });
levelSchema.index({ userId: 1 });

levelRewardSchema.index({ guildId: 1, level: 1 }, { unique: true });
levelRewardSchema.index({ guildId: 1, isEnabled: 1 });

xpMultiplierSchema.index({ guildId: 1, type: 1 });
xpMultiplierSchema.index({ guildId: 1, priority: -1 });

levelSchema.methods.calculateXpForLevel = function(level) {
  return Math.floor(100 * Math.pow(1.5, level));
};

levelSchema.methods.addXp = async function(amount, source = 'message') {
  const now = new Date();
  
  if (this.cooldownExpiresAt && now < this.cooldownExpiresAt && source === 'message') {
    return { leveledUp: false, level: this.level, xp: this.xp };
  }
  
  let xpToAdd = amount;
  
  const activeMultipliers = this.multipliers.active.filter(m => !m.expiresAt || m.expiresAt > now);
  const multiplier = activeMultipliers.reduce((acc, m) => acc * m.value, this.multipliers.global);
  
  xpToAdd = Math.floor(xpToAdd * multiplier);
  
  this.xp += xpToAdd;
  this.totalXp += xpToAdd;
  this.stats.xpGainedToday += xpToAdd;
  this.stats.xpGainedWeek += xpToAdd;
  this.stats.xpGainedMonth += xpToAdd;
  
  let leveledUp = false;
  const levelsGained = [];
  
  while (this.xp >= this.xpToNextLevel) {
    this.xp -= this.xpToNextLevel;
    this.level += 1;
    this.xpToNextLevel = this.calculateXpForLevel(this.level);
    leveledUp = true;
    levelsGained.push(this.level);
    
    if (this.level > this.stats.highestLevel) {
      this.stats.highestLevel = this.level;
    }
    
    this.history.push({
      level: this.level,
      xp: this.xp,
      source,
      timestamp: now
    });
  }
  
  if (source === 'message') {
    this.messageCount += 1;
    this.lastMessageAt = now;
  }
  
  await this.save();
  
  return {
    leveledUp,
    levelsGained,
    level: this.level,
    xp: this.xp,
    xpToNextLevel: this.xpToNextLevel,
    totalXp: this.totalXp,
    xpAdded: xpToAdd
  };
};

levelSchema.methods.addVoiceXp = async function(minutes, xpPerMinute = 1) {
  const xp = Math.floor(minutes * xpPerMinute);
  this.voiceMinutes += minutes;
  
  return this.addXp(xp, 'voice');
};

levelSchema.methods.setCooldown = async function(durationSeconds) {
  this.cooldownExpiresAt = new Date(Date.now() + durationSeconds * 1000);
  await this.save();
};

levelSchema.methods.addRoleAward = async function(roleId, level) {
  if (!this.rolesAwarded.find(r => r.roleId === roleId)) {
    this.rolesAwarded.push({
      roleId,
      level,
      awardedAt: new Date()
    });
    await this.save();
  }
  return this;
};

levelSchema.methods.removeRoleAward = async function(roleId) {
  this.rolesAwarded = this.rolesAwarded.filter(r => r.roleId !== roleId);
  await this.save();
  return this;
};

levelSchema.methods.resetStats = async function(keepLevel = false) {
  if (!keepLevel) {
    this.level = 0;
    this.xp = 0;
    this.totalXp = 0;
    this.xpToNextLevel = 100;
    this.rolesAwarded = [];
    this.history = [];
  }
  
  this.messageCount = 0;
  this.voiceMinutes = 0;
  this.stats.xpGainedToday = 0;
  this.stats.xpGainedWeek = 0;
  this.stats.xpGainedMonth = 0;
  this.stats.lastXpReset = new Date();
  
  await this.save();
  return this;
};

levelSchema.methods.getProgress = function() {
  const prevLevelXp = this.level > 0 ? this.calculateXpForLevel(this.level - 1) : 0;
  const currentLevelXp = this.xpToNextLevel;
  const xpInLevel = this.xp;
  
  return {
    level: this.level,
    xp: this.xp,
    totalXp: this.totalXp,
    xpToNextLevel: this.xpToNextLevel,
    xpInCurrentLevel: xpInLevel,
    progressPercent: Math.floor((xpInLevel / currentLevelXp) * 100),
    messages: this.messageCount,
    voiceMinutes: this.voiceMinutes
  };
};

levelSchema.statics.getLeaderboard = async function(guildId, limit = 10) {
  return this.find({ guildId })
    .sort({ level: -1, xp: -1 })
    .limit(limit)
    .select('userId username avatar level xp totalXp messageCount');
};

levelSchema.statics.getRank = async function(guildId, userId) {
  const user = await this.findOne({ guildId, userId });
  if (!user) return null;
  
  const count = await this.countDocuments({
    guildId,
    $or: [
      { level: { $gt: user.level } },
      { level: user.level, xp: { $gt: user.xp } }
    ]
  });
  
  return count + 1;
};

levelSchema.statics.getOrCreate = async function(guildId, userId, username, avatar) {
  let profile = await this.findOne({ guildId, userId });
  
  if (!profile) {
    profile = new this({
      guildId,
      userId,
      username,
      avatar,
      level: 0,
      xp: 0,
      xpToNextLevel: 100
    });
    await profile.save();
  } else if (profile.username !== username || profile.avatar !== avatar) {
    profile.username = username;
    profile.avatar = avatar;
    await profile.save();
  }
  
  return profile;
};

levelSchema.statics.resetDailyXp = async function(guildId) {
  await this.updateMany(
    { guildId },
    { $set: { 'stats.xpGainedToday': 0 } }
  );
};

levelSchema.statics.resetWeeklyXp = async function(guildId) {
  await this.updateMany(
    { guildId },
    { $set: { 'stats.xpGainedWeek': 0 } }
  );
};

levelSchema.statics.resetMonthlyXp = async function(guildId) {
  await this.updateMany(
    { guildId },
    { $set: { 'stats.xpGainedMonth': 0 } }
  );
};

levelRewardSchema.statics.getRewardsForLevel = async function(guildId, level) {
  return this.find({
    guildId,
    level: { $lte: level },
    isEnabled: true
  }).sort({ level: -1 });
};

xpMultiplierSchema.statics.getActiveMultipliers = async function(guildId, context = {}) {
  const now = new Date();
  
  const query = {
    guildId,
    isEnabled: true,
    $or: [
      { expiresAt: null },
      { expiresAt: { $gt: now } }
    ]
  };
  
  if (context.channelId) {
    query.$or.push(
      { type: { $ne: 'channel' } },
      { type: 'channel', target: context.channelId }
    );
  }
  
  if (context.roleIds?.length > 0) {
    query.$or.push(
      { type: { $ne: 'role' } },
      { type: 'role', target: { $in: context.roleIds } }
    );
  }
  
  if (context.userId) {
    query.$or.push(
      { type: { $ne: 'user' } },
      { type: 'user', target: context.userId }
    );
  }
  
  return this.find(query).sort({ priority: -1 });
};

const Level = mongoose.model('Level', levelSchema);
const LevelReward = mongoose.model('LevelReward', levelRewardSchema);
const XpMultiplier = mongoose.model('XpMultiplier', xpMultiplierSchema);

export { Level, LevelReward, XpMultiplier };
export default Level;
