import mongoose from 'mongoose';

const economySchema = new mongoose.Schema({
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
  wallet: {
    type: Number,
    default: 0,
    min: 0
  },
  bank: {
    type: Number,
    default: 0,
    min: 0
  },
  totalEarned: {
    type: Number,
    default: 0
  },
  totalSpent: {
    type: Number,
    default: 0
  },
  cooldowns: {
    daily: {
      type: Date,
      default: null
    },
    weekly: {
      type: Date,
      default: null
    },
    work: {
      type: Date,
      default: null
    },
    beg: {
      type: Date,
      default: null
    },
    crime: {
      type: Date,
      default: null
    },
    rob: {
      type: Date,
      default: null
    },
    gamble: {
      type: Date,
      default: null
    },
    slots: {
      type: Date,
      default: null
    }
  },
  streaks: {
    daily: {
      type: Number,
      default: 0
    },
    weekly: {
      type: Number,
      default: 0
    },
    lastDaily: {
      type: Date,
      default: null
    },
    lastWeekly: {
      type: Date,
      default: null
    }
  },
  stats: {
    commandsUsed: {
      type: Number,
      default: 0
    },
    gamblingWins: {
      type: Number,
      default: 0
    },
    gamblingLosses: {
      type: Number,
      default: 0
    },
    gamblingProfit: {
      type: Number,
      default: 0
    },
    itemsBought: {
      type: Number,
      default: 0
    },
    itemsSold: {
      type: Number,
      default: 0
    },
    timesRobbed: {
      type: Number,
      default: 0
    },
    timesBeenRobbed: {
      type: Number,
      default: 0
    },
    successfulCrimes: {
      type: Number,
      default: 0
    },
    failedCrimes: {
      type: Number,
      default: 0
    }
  },
  inventory: [{
    itemId: String,
    name: String,
    category: {
      type: String,
      enum: ['collectible', 'consumable', 'tool', 'badge', 'role', 'background', 'other']
    },
    quantity: {
      type: Number,
      default: 1
    },
    purchasedAt: {
      type: Date,
      default: Date.now
    },
    purchasedPrice: Number,
    metadata: {
      type: mongoose.Schema.Types.Mixed,
      default: {}
    }
  }],
  activeEffects: [{
    type: {
      type: String,
      enum: ['multiplier', 'protection', 'bonus', 'penalty']
    },
    value: Number,
    description: String,
    expiresAt: Date,
    source: String
  }],
  achievements: [{
    achievementId: String,
    name: String,
    unlockedAt: {
      type: Date,
      default: Date.now
    }
  }],
  badges: [{
    badgeId: String,
    name: String,
    icon: String,
    awardedAt: {
      type: Date,
      default: Date.now
    }
  }],
  transactions: [{
    type: {
      type: String,
      enum: ['deposit', 'withdraw', 'transfer', 'daily', 'weekly', 'work', 'beg', 'crime', 'rob', 'gamble', 'purchase', 'sale', 'fine', 'admin_add', 'admin_remove', 'other']
    },
    amount: Number,
    wallet: Number,
    bank: Number,
    description: String,
    fromUserId: String,
    toUserId: String,
    metadata: {
      type: mongoose.Schema.Types.Mixed,
      default: {}
    },
    timestamp: {
      type: Date,
      default: Date.now
    }
  }],
  job: {
    id: {
      type: String,
      default: null
    },
    name: {
      type: String,
      default: null
    },
    salary: {
      type: Number,
      default: 0
    },
    joinedAt: {
      type: Date,
      default: null
    },
    lastWorked: {
      type: Date,
      default: null
    }
  },
  passiveIncome: {
    enabled: {
      type: Boolean,
      default: false
    },
    amount: {
      type: Number,
      default: 0
    },
    interval: {
      type: Number,
      default: 3600000
    },
    lastCollected: {
      type: Date,
      default: null
    }
  },
  settings: {
    notifications: {
      type: Boolean,
      default: true
    },
    privacy: {
      type: String,
      enum: ['public', 'friends', 'private'],
      default: 'public'
    },
    dmNotifications: {
      type: Boolean,
      default: true
    }
  },
  createdAt: {
    type: Date,
    default: Date.now
  },
  updatedAt: {
    type: Date,
    default: Date.now
  }
}, {
  timestamps: true
});

economySchema.index({ guildId: 1, userId: 1 }, { unique: true });
economySchema.index({ guildId: 1, 'wallet + bank': -1 });
economySchema.index({ guildId: 1, wallet: -1 });
economySchema.index({ guildId: 1, bank: -1 });
economySchema.index({ guildId: 1, 'stats.commandsUsed': -1 });
economySchema.index({ userId: 1 });
economySchema.index({ createdAt: -1 });

economySchema.virtual('balance').get(function() {
  return this.wallet + this.bank;
});

economySchema.virtual('netWorth').get(function() {
  const inventoryValue = this.inventory.reduce((sum, item) => {
    return sum + (item.purchasedPrice * item.quantity);
  }, 0);
  return this.balance + inventoryValue;
});

economySchema.methods.deposit = async function(amount) {
  if (amount > this.wallet) {
    throw new Error('Insufficient wallet balance');
  }
  
  this.wallet -= amount;
  this.bank += amount;
  
  this.transactions.push({
    type: 'deposit',
    amount,
    wallet: this.wallet,
    bank: this.bank,
    description: `Deposited ${amount} to bank`
  });
  
  await this.save();
  return this;
};

economySchema.methods.withdraw = async function(amount) {
  if (amount > this.bank) {
    throw new Error('Insufficient bank balance');
  }
  
  this.wallet += amount;
  this.bank -= amount;
  
  this.transactions.push({
    type: 'withdraw',
    amount,
    wallet: this.wallet,
    bank: this.bank,
    description: `Withdrew ${amount} from bank`
  });
  
  await this.save();
  return this;
};

economySchema.methods.addMoney = async function(amount, source = 'admin_add', description = null) {
  this.wallet += amount;
  this.totalEarned += amount;
  
  this.transactions.push({
    type: source,
    amount,
    wallet: this.wallet,
    bank: this.bank,
    description: description || `Added ${amount} to wallet`
  });
  
  await this.save();
  return this;
};

economySchema.methods.removeMoney = async function(amount, source = 'admin_remove', description = null) {
  if (amount > this.wallet) {
    throw new Error('Insufficient wallet balance');
  }
  
  this.wallet -= amount;
  this.totalSpent += amount;
  
  this.transactions.push({
    type: source,
    amount: -amount,
    wallet: this.wallet,
    bank: this.bank,
    description: description || `Removed ${amount} from wallet`
  });
  
  await this.save();
  return this;
};

economySchema.methods.transfer = async function(targetUser, amount, description = null) {
  if (amount > this.wallet) {
    throw new Error('Insufficient wallet balance');
  }
  
  this.wallet -= amount;
  this.totalSpent += amount;
  targetUser.wallet += amount;
  targetUser.totalEarned += amount;
  
  this.transactions.push({
    type: 'transfer',
    amount: -amount,
    wallet: this.wallet,
    bank: this.bank,
    toUserId: targetUser.userId,
    description: description || `Transferred ${amount} to ${targetUser.username}`
  });
  
  targetUser.transactions.push({
    type: 'transfer',
    amount,
    wallet: targetUser.wallet,
    bank: targetUser.bank,
    fromUserId: this.userId,
    description: description || `Received ${amount} from ${this.username}`
  });
  
  await this.save();
  await targetUser.save();
  
  return this;
};

economySchema.methods.daily = async function(baseAmount, streakBonus = 0.1) {
  const now = new Date();
  const cooldownEnd = this.cooldowns.daily;
  
  if (cooldownEnd && now < cooldownEnd) {
    const timeLeft = cooldownEnd - now;
    throw new Error(`Daily cooldown: ${Math.ceil(timeLeft / 1000 / 60)} minutes remaining`);
  }
  
  const yesterday = new Date(now - 24 * 60 * 60 * 1000);
  const lastDaily = this.streaks.lastDaily;
  
  if (lastDaily && lastDaily > yesterday) {
    this.streaks.daily = 0;
  } else if (lastDaily && lastDaily.toDateString() === yesterday.toDateString()) {
    this.streaks.daily += 1;
  } else {
    this.streaks.daily = 1;
  }
  
  const bonus = Math.floor(baseAmount * (this.streaks.daily - 1) * streakBonus);
  const totalAmount = baseAmount + bonus;
  
  this.wallet += totalAmount;
  this.totalEarned += totalAmount;
  this.cooldowns.daily = new Date(now.getTime() + 24 * 60 * 60 * 1000);
  this.streaks.lastDaily = now;
  
  this.transactions.push({
    type: 'daily',
    amount: totalAmount,
    wallet: this.wallet,
    bank: this.bank,
    description: `Daily reward: ${baseAmount} + ${bonus} (streak: ${this.streaks.daily})`
  });
  
  await this.save();
  return { amount: totalAmount, streak: this.streaks.daily, bonus };
};

economySchema.methods.work = async function(minAmount, maxAmount, cooldown) {
  const now = new Date();
  
  if (this.cooldowns.work && now < this.cooldowns.work) {
    const timeLeft = this.cooldowns.work - now;
    throw new Error(`Work cooldown: ${Math.ceil(timeLeft / 1000)} seconds remaining`);
  }
  
  const amount = Math.floor(Math.random() * (maxAmount - minAmount + 1)) + minAmount;
  
  this.wallet += amount;
  this.totalEarned += amount;
  this.cooldowns.work = new Date(now.getTime() + cooldown * 1000);
  this.stats.commandsUsed += 1;
  
  this.transactions.push({
    type: 'work',
    amount,
    wallet: this.wallet,
    bank: this.bank,
    description: `Worked and earned ${amount}`
  });
  
  await this.save();
  return amount;
};

economySchema.methods.buyItem = async function(item, quantity = 1) {
  const totalCost = item.price * quantity;
  
  if (totalCost > this.wallet) {
    throw new Error('Insufficient wallet balance');
  }
  
  this.wallet -= totalCost;
  this.totalSpent += totalCost;
  
  const existingItem = this.inventory.find(i => i.itemId === item.id);
  
  if (existingItem) {
    existingItem.quantity += quantity;
  } else {
    this.inventory.push({
      itemId: item.id,
      name: item.name,
      category: item.category,
      quantity,
      purchasedPrice: item.price,
      metadata: item.metadata || {}
    });
  }
  
  this.stats.itemsBought += quantity;
  
  this.transactions.push({
    type: 'purchase',
    amount: -totalCost,
    wallet: this.wallet,
    bank: this.bank,
    description: `Bought ${quantity}x ${item.name}`
  });
  
  await this.save();
  return this;
};

economySchema.methods.sellItem = async function(itemId, quantity = 1, sellPrice) {
  const inventoryItem = this.inventory.find(i => i.itemId === itemId);
  
  if (!inventoryItem || inventoryItem.quantity < quantity) {
    throw new Error('Insufficient item quantity');
  }
  
  const totalValue = sellPrice * quantity;
  
  this.wallet += totalValue;
  inventoryItem.quantity -= quantity;
  
  if (inventoryItem.quantity === 0) {
    this.inventory = this.inventory.filter(i => i.itemId !== itemId);
  }
  
  this.stats.itemsSold += quantity;
  
  this.transactions.push({
    type: 'sale',
    amount: totalValue,
    wallet: this.wallet,
    bank: this.bank,
    description: `Sold ${quantity}x ${inventoryItem.name}`
  });
  
  await this.save();
  return this;
};

economySchema.methods.addEffect = async function(effect) {
  this.activeEffects.push({
    ...effect,
    expiresAt: new Date(Date.now() + effect.duration)
  });
  await this.save();
  return this;
};

economySchema.methods.checkCooldowns = function() {
  const now = new Date();
  const cooldowns = {};
  
  for (const [type, expiresAt] of Object.entries(this.cooldowns)) {
    if (expiresAt) {
      const timeLeft = Math.max(0, expiresAt - now);
      cooldowns[type] = {
        ready: timeLeft === 0,
        timeLeft,
        expiresAt
      };
    } else {
      cooldowns[type] = { ready: true, timeLeft: 0, expiresAt: null };
    }
  }
  
  return cooldowns;
};

economySchema.statics.getLeaderboard = async function(guildId, type = 'balance', limit = 10) {
  const sortField = type === 'bank' ? 'bank' : type === 'wallet' ? 'wallet' : 'wallet';
  
  return this.find({ guildId })
    .sort({ [sortField]: -1 })
    .limit(limit)
    .select('userId username avatar wallet bank totalEarned stats.commandsUsed');
};

economySchema.statics.getOrCreate = async function(guildId, userId, username, avatar) {
  let profile = await this.findOne({ guildId, userId });
  
  if (!profile) {
    profile = new this({
      guildId,
      userId,
      username,
      avatar,
      wallet: 0,
      bank: 0
    });
    await profile.save();
  } else if (profile.username !== username || profile.avatar !== avatar) {
    profile.username = username;
    profile.avatar = avatar;
    await profile.save();
  }
  
  return profile;
};

economySchema.statics.getGuildStats = async function(guildId) {
  const stats = await this.aggregate([
    { $match: { guildId } },
    {
      $group: {
        _id: null,
        totalUsers: { $sum: 1 },
        totalWallet: { $sum: '$wallet' },
        totalBank: { $sum: '$bank' },
        avgWallet: { $avg: '$wallet' },
        avgBank: { $avg: '$bank' },
        totalEarned: { $sum: '$totalEarned' },
        totalSpent: { $sum: '$totalSpent' }
      }
    }
  ]);
  
  return stats[0] || {
    totalUsers: 0,
    totalWallet: 0,
    totalBank: 0,
    avgWallet: 0,
    avgBank: 0,
    totalEarned: 0,
    totalSpent: 0
  };
};

const Economy = mongoose.model('Economy', economySchema);

export default Economy;
