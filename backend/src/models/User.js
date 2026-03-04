import mongoose from 'mongoose';

const userSchema = new mongoose.Schema({
  discordId: {
    type: String,
    required: true,
    unique: true,
    index: true
  },
  username: {
    type: String,
    required: true,
    trim: true,
    maxlength: 32
  },
  discriminator: {
    type: String,
    default: '0',
    match: /^\d{1,4}$/
  },
  globalName: {
    type: String,
    trim: true,
    maxlength: 32,
    default: null
  },
  avatar: {
    type: String,
    default: null
  },
  banner: {
    type: String,
    default: null
  },
  bannerColor: {
    type: String,
    default: null
  },
  accentColor: {
    type: Number,
    default: null
  },
  locale: {
    type: String,
    default: 'en-US'
  },
  mfaEnabled: {
    type: Boolean,
    default: false
  },
  email: {
    type: String,
    default: null,
    lowercase: true,
    trim: true
  },
  verified: {
    type: Boolean,
    default: false
  },
  accessToken: {
    type: String,
    required: true,
    select: false
  },
  refreshToken: {
    type: String,
    required: true,
    select: false
  },
  tokenExpiresAt: {
    type: Date,
    required: true
  },
  guilds: [{
    guildId: {
      type: String,
      required: true
    },
    name: {
      type: String,
      required: true
    },
    icon: {
      type: String,
      default: null
    },
    owner: {
      type: Boolean,
      default: false
    },
    permissions: {
      type: String,
      default: '0'
    },
    features: [{
      type: String
    }],
    joinedAt: {
      type: Date,
      default: Date.now
    }
  }],
  isAdmin: {
    type: Boolean,
    default: false
  },
  isBanned: {
    type: Boolean,
    default: false
  },
  banReason: {
    type: String,
    default: null
  },
  lastLogin: {
    type: Date,
    default: Date.now
  },
  loginCount: {
    type: Number,
    default: 1
  },
  dashboardAccess: [{
    guildId: {
      type: String,
      required: true
    },
    role: {
      type: String,
      enum: ['owner', 'admin', 'moderator', 'viewer'],
      default: 'viewer'
    },
    grantedAt: {
      type: Date,
      default: Date.now
    },
    grantedBy: {
      type: String,
      default: null
    }
  }],
  preferences: {
    theme: {
      type: String,
      enum: ['light', 'dark', 'system'],
      default: 'system'
    },
    language: {
      type: String,
      default: 'en'
    },
    notifications: {
      email: {
        type: Boolean,
        default: true
      },
      browser: {
        type: Boolean,
        default: true
      }
    },
    timezone: {
      type: String,
      default: 'UTC'
    }
  },
  sessionHistory: [{
    ip: String,
    userAgent: String,
    timestamp: {
      type: Date,
      default: Date.now
    }
  }]
}, {
  timestamps: true
});

userSchema.index({ discordId: 1 });
userSchema.index({ email: 1 });
userSchema.index({ isAdmin: 1 });
userSchema.index({ 'guilds.guildId': 1 });
userSchema.index({ lastLogin: -1 });

userSchema.methods.getDisplayName = function() {
  return this.globalName || this.username;
};

userSchema.methods.getAvatarURL = function(size = 128) {
  if (this.avatar) {
    return `https://cdn.discordapp.com/avatars/${this.discordId}/${this.avatar}.png?size=${size}`;
  }
  const defaultAvatar = parseInt(this.discriminator) % 5;
  return `https://cdn.discordapp.com/embed/avatars/${defaultAvatar}.png`;
};

userSchema.methods.hasDashboardAccess = function(guildId, minRole = 'viewer') {
  const roleHierarchy = ['viewer', 'moderator', 'admin', 'owner'];
  const minRoleIndex = roleHierarchy.indexOf(minRole);
  
  const access = this.dashboardAccess.find(a => a.guildId === guildId);
  if (!access) return false;
  
  const userRoleIndex = roleHierarchy.indexOf(access.role);
  return userRoleIndex >= minRoleIndex;
};

userSchema.methods.isTokenExpired = function() {
  return new Date() >= this.tokenExpiresAt;
};

const User = mongoose.model('User', userSchema);

export default User;
