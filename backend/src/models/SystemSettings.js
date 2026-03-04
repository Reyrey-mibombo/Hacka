import mongoose from 'mongoose';

const systemSettingsSchema = new mongoose.Schema({
  guildId: {
    type: String,
    required: true,
    unique: true,
    index: true
  },
  automod: {
    enabled: {
      type: Boolean,
      default: false
    },
    logChannelId: {
      type: String,
      default: null
    },
    ignoredChannels: [{
      type: String
    }],
    ignoredRoles: [{
      type: String
    }],
    ignoredUsers: [{
      type: String
    }],
    rules: {
      spam: {
        enabled: {
          type: Boolean,
          default: true
        },
        threshold: {
          type: Number,
          default: 5
        },
        interval: {
          type: Number,
          default: 5000
        },
        action: {
          type: String,
          enum: ['warn', 'mute', 'kick', 'ban', 'delete'],
          default: 'warn'
        },
        duration: {
          type: Number,
          default: 300000
        }
      },
      mentions: {
        enabled: {
          type: Boolean,
          default: true
        },
        maxMentions: {
          type: Number,
          default: 5
        },
        maxRoleMentions: {
          type: Number,
          default: 3
        },
        action: {
          type: String,
          enum: ['warn', 'mute', 'kick', 'ban', 'delete'],
          default: 'warn'
        },
        duration: {
          type: Number,
          default: 300000
        }
      },
      invites: {
        enabled: {
          type: Boolean,
          default: false
        },
        action: {
          type: String,
          enum: ['warn', 'mute', 'kick', 'ban', 'delete'],
          default: 'delete'
        },
        allowedInvites: [{
          type: String
        }],
        duration: {
          type: Number,
          default: 300000
        }
      },
      links: {
        enabled: {
          type: Boolean,
          default: false
        },
        mode: {
          type: String,
          enum: ['blacklist', 'whitelist'],
          default: 'blacklist'
        },
        allowedDomains: [{
          type: String
        }],
        blockedDomains: [{
          type: String
        }],
        action: {
          type: String,
          enum: ['warn', 'mute', 'kick', 'ban', 'delete'],
          default: 'delete'
        },
        duration: {
          type: Number,
          default: 300000
        }
      },
      attachments: {
        enabled: {
          type: Boolean,
          default: false
        },
        maxSize: {
          type: Number,
          default: 8388608
        },
        allowedTypes: [{
          type: String,
          default: ['image/png', 'image/jpeg', 'image/gif', 'application/pdf']
        }],
        action: {
          type: String,
          enum: ['warn', 'mute', 'kick', 'ban', 'delete'],
          default: 'delete'
        }
      },
      caps: {
        enabled: {
          type: Boolean,
          default: false
        },
        threshold: {
          type: Number,
          default: 70
        },
        minLength: {
          type: Number,
          default: 10
        },
        action: {
          type: String,
          enum: ['warn', 'mute', 'kick', 'ban', 'delete'],
          default: 'warn'
        }
      },
      zalgo: {
        enabled: {
          type: Boolean,
          default: false
        },
        action: {
          type: String,
          enum: ['warn', 'mute', 'kick', 'ban', 'delete'],
          default: 'delete'
        }
      },
      profanity: {
        enabled: {
          type: Boolean,
          default: false
        },
        filter: {
          type: String,
          enum: ['basic', 'strict', 'custom'],
          default: 'basic'
        },
        customWords: [{
          type: String
        }],
        action: {
          type: String,
          enum: ['warn', 'mute', 'kick', 'ban', 'delete'],
          default: 'warn'
        }
      },
      repeatedText: {
        enabled: {
          type: Boolean,
          default: false
        },
        threshold: {
          type: Number,
          default: 3
        },
        action: {
          type: String,
          enum: ['warn', 'mute', 'kick', 'ban', 'delete'],
          default: 'warn'
        }
      }
    },
    punishments: {
      warnThreshold: {
        type: Number,
        default: 3
      },
      warnAction: {
        type: String,
        enum: ['mute', 'kick', 'ban', 'none'],
        default: 'mute'
      },
      muteDuration: {
        type: Number,
        default: 300000
      }
    }
  },
  welcome: {
    enabled: {
      type: Boolean,
      default: false
    },
    channelId: {
      type: String,
      default: null
    },
    dmEnabled: {
      type: Boolean,
      default: false
    },
    message: {
      type: String,
      default: 'Welcome {user} to {server}!'
    },
    dmMessage: {
      type: String,
      default: 'Welcome to {server}! Please read the rules.'
    },
    cardEnabled: {
      type: Boolean,
      default: false
    },
    cardSettings: {
      background: {
        type: String,
        default: 'default'
      },
      textColor: {
        type: String,
        default: '#FFFFFF'
      },
      accentColor: {
        type: String,
        default: '#7289DA'
      }
    },
    deleteAfter: {
      type: Number,
      default: null
    },
    mentionUser: {
      type: Boolean,
      default: true
    }
  },
  goodbye: {
    enabled: {
      type: Boolean,
      default: false
    },
    channelId: {
      type: String,
      default: null
    },
    message: {
      type: String,
      default: 'Goodbye {user}!'
    },
    deleteAfter: {
      type: Number,
      default: null
    }
  },
  autorole: {
    enabled: {
      type: Boolean,
      default: false
    },
    roles: [{
      type: String
    }],
    botRoles: [{
      type: String
    }],
    delay: {
      type: Number,
      default: 0
    },
    requireVerification: {
      type: Boolean,
      default: false
    }
  },
  logging: {
    enabled: {
      type: Boolean,
      default: false
    },
    channelId: {
      type: String,
      default: null
    },
    events: {
      messageDelete: {
        enabled: {
          type: Boolean,
          default: true
        },
        ignoredChannels: [{
          type: String
        }]
      },
      messageEdit: {
        enabled: {
          type: Boolean,
          default: true
        },
        ignoredChannels: [{
          type: String
        }]
      },
      memberJoin: {
        enabled: {
          type: Boolean,
          default: true
        }
      },
      memberLeave: {
        enabled: {
          type: Boolean,
          default: true
        }
      },
      memberUpdate: {
        enabled: {
          type: Boolean,
          default: false
        }
      },
      voiceUpdate: {
        enabled: {
          type: Boolean,
          default: false
        }
      },
      channelCreate: {
        enabled: {
          type: Boolean,
          default: true
        }
      },
      channelDelete: {
        enabled: {
          type: Boolean,
          default: true
        }
      },
      channelUpdate: {
        enabled: {
          type: Boolean,
          default: false
        }
      },
      roleCreate: {
        enabled: {
          type: Boolean,
          default: true
        }
      },
      roleDelete: {
        enabled: {
          type: Boolean,
          default: true
        }
      },
      roleUpdate: {
        enabled: {
          type: Boolean,
          default: false
        }
      },
      banAdd: {
        enabled: {
          type: Boolean,
          default: true
        }
      },
      banRemove: {
        enabled: {
          type: Boolean,
          default: true
        }
      },
      nicknameChange: {
        enabled: {
          type: Boolean,
          default: false
        }
      },
      inviteCreate: {
        enabled: {
          type: Boolean,
          default: false
        }
      },
      inviteDelete: {
        enabled: {
          type: Boolean,
          default: false
        }
      },
      commandUsage: {
        enabled: {
          type: Boolean,
          default: false
        }
      },
      automod: {
        enabled: {
          type: Boolean,
          default: true
        }
      }
    },
    format: {
      type: String,
      enum: ['embed', 'text'],
      default: 'embed'
    },
    timestampFormat: {
      type: String,
      enum: ['relative', 'absolute', 'both'],
      default: 'relative'
    }
  },
  antispam: {
    enabled: {
      type: Boolean,
      default: false
    },
    strictness: {
      type: String,
      enum: ['low', 'medium', 'high'],
      default: 'medium'
    },
    detectDuplicate: {
      type: Boolean,
      default: true
    },
    duplicateThreshold: {
      type: Number,
      default: 3
    },
    detectMentions: {
      type: Boolean,
      default: true
    },
    mentionThreshold: {
      type: Number,
      default: 5
    },
    detectRapid: {
      type: Boolean,
      default: true
    },
    rapidThreshold: {
      type: Number,
      default: 5
    },
    rapidInterval: {
      type: Number,
      default: 3000
    },
    action: {
      type: String,
      enum: ['warn', 'mute', 'kick', 'ban', 'timeout'],
      default: 'mute'
    },
    duration: {
      type: Number,
      default: 600000
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
    logChannelId: {
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
    maxOpenTickets: {
      type: Number,
      default: 50
    },
    autoCloseAfter: {
      type: Number,
      default: 24
    },
    autoCloseEnabled: {
      type: Boolean,
      default: true
    },
    pingSupportRoles: {
      type: Boolean,
      default: true
    },
    requireReason: {
      type: Boolean,
      default: false
    },
    namingFormat: {
      type: String,
      default: 'ticket-{username}-{number}'
    },
    panels: [{
      name: String,
      description: String,
      emoji: String,
      category: String,
      message: String,
      requiredRole: String
    }],
    messages: {
      created: {
        type: String,
        default: 'Your ticket has been created: {channel}'
      },
      closed: {
        type: String,
        default: 'This ticket has been closed by {user}'
      },
      reopened: {
        type: String,
        default: 'This ticket has been reopened by {user}'
      }
    },
    allowUserClose: {
      type: Boolean,
      default: true
    },
    saveTranscripts: {
      type: Boolean,
      default: true
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
    },
    threadEnabled: {
      type: Boolean,
      default: true
    },
    anonymous: {
      type: Boolean,
      default: false
    },
    minVotesForAction: {
      type: Number,
      default: 10
    }
  },
  giveaways: {
    defaultDuration: {
      type: Number,
      default: 3600000
    },
    defaultWinners: {
      type: Number,
      default: 1
    },
    winnerRoleId: {
      type: String,
      default: null
    }
  },
  verification: {
    enabled: {
      type: Boolean,
      default: false
    },
    type: {
      type: String,
      enum: ['reaction', 'captcha', 'button', 'command'],
      default: 'reaction'
    },
    channelId: {
      type: String,
      default: null
    },
    roleId: {
      type: String,
      default: null
    },
    message: {
      type: String,
      default: 'React to verify!'
    }
  },
  customCommands: {
    prefixEnabled: {
      type: Boolean,
      default: true
    },
    slashEnabled: {
      type: Boolean,
      default: false
    }
  },
  backup: {
    autoBackup: {
      type: Boolean,
      default: false
    },
    frequency: {
      type: String,
      enum: ['daily', 'weekly', 'monthly'],
      default: 'weekly'
    },
    maxBackups: {
      type: Number,
      default: 5
    },
    backupChannels: {
      type: Boolean,
      default: true
    },
    backupRoles: {
      type: Boolean,
      default: true
    },
    backupSettings: {
      type: Boolean,
      default: true
    }
  },
  vanity: {
    customUrl: {
      type: String,
      default: null
    },
    redirectEnabled: {
      type: Boolean,
      default: false
    }
  },
  lastUpdated: {
    type: Date,
    default: Date.now
  },
  updatedBy: {
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

systemSettingsSchema.index({ guildId: 1 });

systemSettingsSchema.pre('save', function(next) {
  this.lastUpdated = new Date();
  next();
});

systemSettingsSchema.statics.getOrCreate = async function(guildId) {
  let settings = await this.findOne({ guildId });
  
  if (!settings) {
    settings = new this({ guildId });
    await settings.save();
  }
  
  return settings;
};

systemSettingsSchema.methods.updateModule = async function(moduleName, updates, userId, username) {
  const modulePath = moduleName.split('.');
  let current = this;
  
  for (let i = 0; i < modulePath.length - 1; i++) {
    current = current[modulePath[i]];
  }
  
  const finalKey = modulePath[modulePath.length - 1];
  Object.assign(current[finalKey], updates);
  
  this.updatedBy = { userId, username };
  this.lastUpdated = new Date();
  
  await this.save();
  return this;
};

systemSettingsSchema.methods.isModuleEnabled = function(moduleName) {
  const module = this[moduleName];
  return module && module.enabled;
};

const SystemSettings = mongoose.model('SystemSettings', systemSettingsSchema);

export default SystemSettings;
