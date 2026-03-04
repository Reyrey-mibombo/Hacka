import mongoose from 'mongoose';

const guildSchema = new mongoose.Schema({
  guildId: {
    type: String,
    required: true,
    unique: true,
    index: true
  },
  name: {
    type: String,
    required: true,
    trim: true,
    maxlength: 100
  },
  icon: {
    type: String,
    default: null
  },
  banner: {
    type: String,
    default: null
  },
  description: {
    type: String,
    default: null,
    maxlength: 120
  },
  ownerId: {
    type: String,
    required: true,
    index: true
  },
  region: {
    type: String,
    default: 'us-west'
  },
  preferredLocale: {
    type: String,
    default: 'en-US'
  },
  memberCount: {
    type: Number,
    default: 0,
    min: 0
  },
  maxMembers: {
    type: Number,
    default: 250000
  },
  premiumTier: {
    type: Number,
    default: 0,
    min: 0,
    max: 3
  },
  premiumSubscriptionCount: {
    type: Number,
    default: 0
  },
  features: [{
    type: String
  }],
  afkChannelId: {
    type: String,
    default: null
  },
  afkTimeout: {
    type: Number,
    default: 300
  },
  systemChannelId: {
    type: String,
    default: null
  },
  systemChannelFlags: {
    type: Number,
    default: 0
  },
  rulesChannelId: {
    type: String,
    default: null
  },
  publicUpdatesChannelId: {
    type: String,
    default: null
  },
  verificationLevel: {
    type: Number,
    default: 0,
    min: 0,
    max: 4
  },
  defaultMessageNotifications: {
    type: Number,
    default: 0
  },
  explicitContentFilter: {
    type: Number,
    default: 0,
    min: 0,
    max: 2
  },
  mfaLevel: {
    type: Number,
    default: 0
  },
  nsfwLevel: {
    type: Number,
    default: 0
  },
  vanityURLCode: {
    type: String,
    default: null
  },
  settings: {
    prefix: {
      type: String,
      default: '!',
      maxlength: 5
    },
    timezone: {
      type: String,
      default: 'UTC'
    },
    dashboardEnabled: {
      type: Boolean,
      default: true
    },
    botEnabled: {
      type: Boolean,
      default: true
    },
    modules: {
      leveling: {
        enabled: {
          type: Boolean,
          default: false
        },
        xpRate: {
          type: Number,
          default: 1.0
        },
        xpCooldown: {
          type: Number,
          default: 60
        },
        stackRoles: {
          type: Boolean,
          default: false
        },
        ignoredChannels: [{
          type: String
        }],
        ignoredRoles: [{
          type: String
        }],
        levelUpChannel: {
          type: String,
          default: null
        },
        levelUpMessage: {
          type: String,
          default: 'Congratulations {user}, you reached level {level}!'
        }
      },
      economy: {
        enabled: {
          type: Boolean,
          default: false
        },
        currencyName: {
          type: String,
          default: 'coins'
        },
        currencySymbol: {
          type: String,
          default: '🪙'
        },
        dailyAmount: {
          type: Number,
          default: 100
        },
        workCooldown: {
          type: Number,
          default: 3600
        },
        workMinAmount: {
          type: Number,
          default: 10
        },
        workMaxAmount: {
          type: Number,
          default: 100
        }
      },
      tickets: {
        enabled: {
          type: Boolean,
          default: false
        },
        categoryId: {
          type: String,
          default: null
        },
        transcriptChannelId: {
          type: String,
          default: null
        },
        supportRoles: [{
          type: String
        }],
        maxTicketsPerUser: {
          type: Number,
          default: 3
        },
        autoCloseAfter: {
          type: Number,
          default: 24
        }
      },
      staff: {
        enabled: {
          type: Boolean,
          default: false
        },
        ranks: [{
          name: String,
          minPoints: Number,
          color: String,
          roleId: String
        }],
        shiftChannelId: {
          type: String,
          default: null
        },
        requireShiftApproval: {
          type: Boolean,
          default: false
        }
      },
      suggestions: {
        enabled: {
          type: Boolean,
          default: false
        },
        channelId: {
          type: String,
          default: null
        },
        upvoteEmoji: {
          type: String,
          default: '👍'
        },
        downvoteEmoji: {
          type: String,
          default: '👎'
        }
      },
      giveaways: {
        enabled: {
          type: Boolean,
          default: false
        },
        defaultDuration: {
          type: Number,
          default: 3600000
        },
        winnerRoleId: {
          type: String,
          default: null
        }
      }
    }
  },
  tier: {
    type: String,
    enum: ['free', 'basic', 'premium', 'enterprise'],
    default: 'free'
  },
  tierExpiresAt: {
    type: Date,
    default: null
  },
  subscriptionId: {
    type: String,
    default: null
  },
  apiKey: {
    type: String,
    default: null,
    select: false
  },
  webhookUrl: {
    type: String,
    default: null
  },
  webhookSecret: {
    type: String,
    default: null,
    select: false
  },
  customDomain: {
    type: String,
    default: null
  },
  whitelistedIPs: [{
    type: String
  }],
  blacklistedUsers: [{
    userId: String,
    reason: String,
    addedAt: {
      type: Date,
      default: Date.now
    },
    addedBy: String,
    expiresAt: Date
  }],
  statistics: {
    commandsUsed: {
      type: Number,
      default: 0
    },
    messagesProcessed: {
      type: Number,
      default: 0
    },
    ticketsCreated: {
      type: Number,
      default: 0
    },
    warningsIssued: {
      type: Number,
      default: 0
    },
    lastCommandAt: {
      type: Date,
      default: null
    },
    joinedAt: {
      type: Date,
      default: Date.now
    }
  },
  backupData: {
    lastBackupAt: {
      type: Date,
      default: null
    },
    backupFrequency: {
      type: String,
      enum: ['never', 'daily', 'weekly', 'monthly'],
      default: 'never'
    },
    backups: [{
      id: String,
      createdAt: Date,
      size: Number,
      url: String
    }]
  }
}, {
  timestamps: true
});

guildSchema.index({ guildId: 1 });
guildSchema.index({ ownerId: 1 });
guildSchema.index({ tier: 1 });
guildSchema.index({ 'settings.prefix': 1 });
guildSchema.index({ memberCount: -1 });
guildSchema.index({ createdAt: -1 });

guildSchema.methods.getIconURL = function(size = 128, format = 'png') {
  if (this.icon) {
    return `https://cdn.discordapp.com/icons/${this.guildId}/${this.icon}.${format}?size=${size}`;
  }
  return null;
};

guildSchema.methods.getBannerURL = function(size = 1024, format = 'png') {
  if (this.banner) {
    return `https://cdn.discordapp.com/banners/${this.guildId}/${this.banner}.${format}?size=${size}`;
  }
  return null;
};

guildSchema.methods.isPremium = function() {
  if (!this.tierExpiresAt) return this.tier !== 'free';
  return this.tier !== 'free' && new Date() < this.tierExpiresAt;
};

guildSchema.methods.hasFeature = function(feature) {
  return this.features.includes(feature);
};

guildSchema.methods.incrementStat = async function(statName) {
  const update = {
    $inc: { [`statistics.${statName}`]: 1 },
    $set: { [`statistics.last${statName.charAt(0).toUpperCase() + statName.slice(1)}At`]: new Date() }
  };
  return this.updateOne(update);
};

const Guild = mongoose.model('Guild', guildSchema);

export default Guild;
