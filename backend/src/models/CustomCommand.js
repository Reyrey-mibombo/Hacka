import mongoose from 'mongoose';

const customCommandSchema = new mongoose.Schema({
  guildId: {
    type: String,
    required: true,
    index: true
  },
  commandId: {
    type: String,
    required: true,
    unique: true,
    index: true
  },
  name: {
    type: String,
    required: true,
    trim: true,
    maxlength: 32,
    match: /^[a-zA-Z0-9_-]+$/
  },
  description: {
    type: String,
    default: 'A custom command',
    maxlength: 100
  },
  type: {
    type: String,
    enum: ['text', 'embed', 'random', 'choice', 'list', 'image', 'button', 'menu'],
    default: 'text'
  },
  category: {
    type: String,
    default: 'general'
  },
  aliases: [{
    type: String,
    trim: true,
    maxlength: 32
  }],
  responses: [{
    content: {
      type: String,
      required: true
    },
    weight: {
      type: Number,
      default: 1,
      min: 1
    },
    embed: {
      title: String,
      description: String,
      color: Number,
      image: String,
      thumbnail: String,
      footer: String,
      fields: [{
        name: String,
        value: String,
        inline: Boolean
      }]
    }
  }],
  mainResponse: {
    content: {
      type: String,
      default: ''
    },
    embed: {
      title: String,
      description: String,
      color: {
        type: Number,
        default: 3447003
      },
      image: String,
      thumbnail: String,
      footer: {
        text: String,
        icon: String
      },
      author: {
        name: String,
        icon: String,
        url: String
      },
      fields: [{
        name: String,
        value: String,
        inline: Boolean
      }],
      timestamp: Boolean
    },
    attachments: [{
      url: String,
      filename: String
    }]
  },
  variables: [{
    name: String,
    type: {
      type: String,
      enum: ['user', 'guild', 'channel', 'random', 'custom']
    },
    value: String,
    fallback: String
  }],
  cooldown: {
    enabled: {
      type: Boolean,
      default: false
    },
    duration: {
      type: Number,
      default: 5000
    },
    bypassRoles: [{
      type: String
    }],
    bypassUsers: [{
      type: String
    }]
  },
  permissions: {
    enabled: {
      type: Boolean,
      default: false
    },
    requiredRoles: [{
      type: String
    }],
    blockedRoles: [{
      type: String
    }],
    requiredPermissions: [{
      type: String
    }],
    blockedUsers: [{
      type: String
    }],
    channels: {
      mode: {
        type: String,
        enum: ['blacklist', 'whitelist'],
        default: 'blacklist'
      },
      list: [{
        type: String
      }]
    }
  },
  actions: {
    deleteTrigger: {
      type: Boolean,
      default: false
    },
    deleteAfter: {
      type: Number,
      default: null
    },
    dmUser: {
      type: Boolean,
      default: false
    },
    dmContent: {
      type: String,
      default: null
    },
    addRole: {
      type: String,
      default: null
    },
    removeRole: {
      type: String,
      default: null
    },
    reactWith: [{
      type: String
    }],
    pinMessage: {
      type: Boolean,
      default: false
    },
    logUsage: {
      type: Boolean,
      default: false
    }
  },
  usage: {
    count: {
      type: Number,
      default: 0
    },
    lastUsed: {
      type: Date,
      default: null
    },
    lastUsedBy: {
      type: String,
      default: null
    }
  },
  isSlashCommand: {
    type: Boolean,
    default: false
  },
  slashOptions: [{
    name: String,
    description: String,
    type: {
      type: String,
      enum: ['string', 'integer', 'boolean', 'user', 'channel', 'role', 'mentionable', 'number']
    },
    required: Boolean,
    choices: [{
      name: String,
      value: mongoose.Schema.Types.Mixed
    }]
  }],
  isEnabled: {
    type: Boolean,
    default: true
  },
  isGlobal: {
    type: Boolean,
    default: false
  },
  createdBy: {
    userId: {
      type: String,
      required: true
    },
    username: {
      type: String,
      required: true
    }
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

customCommandSchema.index({ guildId: 1, name: 1 }, { unique: true });
customCommandSchema.index({ guildId: 1, category: 1 });
customCommandSchema.index({ guildId: 1, isEnabled: 1 });
customCommandSchema.index({ name: 1 });
customCommandSchema.index({ commandId: 1 });
customCommandSchema.index({ aliases: 1 });
customCommandSchema.index({ isGlobal: 1 });

customCommandSchema.pre('save', function(next) {
  this.updatedAt = new Date();
  next();
});

customCommandSchema.methods.execute = async function(userId, guildId, options = {}) {
  this.usage.count += 1;
  this.usage.lastUsed = new Date();
  this.usage.lastUsedBy = userId;
  await this.save();
  
  let response = this.getResponse();
  response = this.processVariables(response, { userId, guildId, ...options });
  
  return response;
};

customCommandSchema.methods.getResponse = function() {
  if (this.type === 'random' && this.responses.length > 0) {
    const totalWeight = this.responses.reduce((sum, r) => sum + r.weight, 0);
    let random = Math.random() * totalWeight;
    
    for (const response of this.responses) {
      random -= response.weight;
      if (random <= 0) {
        return response;
      }
    }
    return this.responses[0];
  }
  
  return this.mainResponse;
};

customCommandSchema.methods.processVariables = function(response, context) {
  let processed = JSON.parse(JSON.stringify(response));
  
  const variables = {
    '{user}': `<@${context.userId}>`,
    '{user.id}': context.userId,
    '{user.mention}': `<@${context.userId}>`,
    '{guild}': context.guildName || 'Server',
    '{guild.id}': guildId,
    '{channel}': `<#${context.channelId}>`,
    '{channel.id}': context.channelId,
    '{random}': Math.floor(Math.random() * 100),
    '{time}': new Date().toLocaleTimeString(),
    '{date}': new Date().toLocaleDateString()
  };
  
  if (processed.content) {
    for (const [key, value] of Object.entries(variables)) {
      processed.content = processed.content.replace(new RegExp(key, 'g'), value);
    }
  }
  
  if (processed.embed) {
    for (const [key, value] of Object.entries(variables)) {
      if (processed.embed.title) {
        processed.embed.title = processed.embed.title.replace(new RegExp(key, 'g'), value);
      }
      if (processed.embed.description) {
        processed.embed.description = processed.embed.description.replace(new RegExp(key, 'g'), value);
      }
      if (processed.embed.footer?.text) {
        processed.embed.footer.text = processed.embed.footer.text.replace(new RegExp(key, 'g'), value);
      }
    }
  }
  
  return processed;
};

customCommandSchema.methods.checkCooldown = function(userId, userRoles) {
  if (!this.cooldown.enabled) return { onCooldown: false };
  
  if (this.cooldown.bypassUsers.includes(userId)) {
    return { onCooldown: false };
  }
  
  if (userRoles.some(role => this.cooldown.bypassRoles.includes(role))) {
    return { onCooldown: false };
  }
  
  return {
    onCooldown: true,
    duration: this.cooldown.duration
  };
};

customCommandSchema.methods.checkPermissions = function(userId, userRoles, userPermissions, channelId) {
  if (!this.permissions.enabled) return { allowed: true };
  
  if (this.permissions.blockedUsers.includes(userId)) {
    return { allowed: false, reason: 'You are blocked from using this command' };
  }
  
  const channelAllowed = this.permissions.channels.mode === 'whitelist'
    ? this.permissions.channels.list.includes(channelId)
    : !this.permissions.channels.list.includes(channelId);
  
  if (!channelAllowed) {
    return { allowed: false, reason: 'This command cannot be used in this channel' };
  }
  
  if (this.permissions.requiredRoles.length > 0) {
    const hasRole = userRoles.some(role => this.permissions.requiredRoles.includes(role));
    if (!hasRole) {
      return { allowed: false, reason: 'You do not have the required role' };
    }
  }
  
  if (userRoles.some(role => this.permissions.blockedRoles.includes(role))) {
    return { allowed: false, reason: 'Your role is blocked from using this command' };
  }
  
  return { allowed: true };
};

customCommandSchema.methods.toggle = async function() {
  this.isEnabled = !this.isEnabled;
  await this.save();
  return this.isEnabled;
};

customCommandSchema.methods.addAlias = async function(alias) {
  if (!this.aliases.includes(alias)) {
    this.aliases.push(alias);
    await this.save();
  }
  return this.aliases;
};

customCommandSchema.methods.removeAlias = async function(alias) {
  this.aliases = this.aliases.filter(a => a !== alias);
  await this.save();
  return this.aliases;
};

customCommandSchema.methods.addResponse = async function(responseData) {
  this.responses.push(responseData);
  await this.save();
  return this.responses;
};

customCommandSchema.statics.findByName = async function(guildId, name) {
  return this.findOne({
    guildId,
    $or: [
      { name: name.toLowerCase() },
      { aliases: name.toLowerCase() }
    ]
  });
};

customCommandSchema.statics.findEnabled = async function(guildId) {
  return this.find({ guildId, isEnabled: true });
};

customCommandSchema.statics.generateCommandId = function() {
  return 'cmd_' + Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);
};

const CustomCommand = mongoose.model('CustomCommand', customCommandSchema);

export default CustomCommand;
