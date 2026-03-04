import mongoose from 'mongoose';

const ticketSchema = new mongoose.Schema({
  guildId: {
    type: String,
    required: true,
    index: true
  },
  ticketId: {
    type: String,
    required: true,
    unique: true,
    index: true
  },
  channelId: {
    type: String,
    required: true,
    unique: true
  },
  category: {
    type: String,
    default: 'general'
  },
  status: {
    type: String,
    enum: ['open', 'closed', 'archived', 'deleted'],
    default: 'open'
  },
  priority: {
    type: String,
    enum: ['low', 'medium', 'high', 'urgent'],
    default: 'medium'
  },
  creator: {
    userId: {
      type: String,
      required: true
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
    }
  },
  reason: {
    type: String,
    default: null
  },
  subject: {
    type: String,
    default: null
  },
  claimedBy: {
    userId: {
      type: String,
      default: null
    },
    username: {
      type: String,
      default: null
    },
    claimedAt: {
      type: Date,
      default: null
    }
  },
  participants: [{
    userId: String,
    username: String,
    joinedAt: {
      type: Date,
      default: Date.now
    },
    messagesCount: {
      type: Number,
      default: 0
    }
  }],
  supportAgents: [{
    userId: String,
    username: String,
    joinedAt: {
      type: Date,
      default: Date.now
    }
  }],
  createdAt: {
    type: Date,
    default: Date.now
  },
  closedAt: {
    type: Date,
    default: null
  },
  closedBy: {
    userId: {
      type: String,
      default: null
    },
    username: {
      type: String,
      default: null
    }
  },
  closeReason: {
    type: String,
    default: null
  },
  reopenedAt: {
    type: Date,
    default: null
  },
  reopenedBy: {
    userId: {
      type: String,
      default: null
    },
    username: {
      type: String,
      default: null
    }
  },
  transcript: {
    generated: {
      type: Boolean,
      default: false
    },
    url: {
      type: String,
      default: null
    },
    messagesCount: {
      type: Number,
      default: 0
    },
    generatedAt: {
      type: Date,
      default: null
    }
  },
  messages: [{
    messageId: String,
    authorId: String,
    authorUsername: String,
    authorAvatar: String,
    content: String,
    attachments: [{
      url: String,
      filename: String,
      size: Number
    }],
    embeds: [{
      type: Object
    }],
    timestamp: Date,
    edited: {
      type: Boolean,
      default: false
    },
    editedTimestamp: Date
  }],
  ratings: {
    userRating: {
      type: Number,
      min: 1,
      max: 5,
      default: null
    },
    userFeedback: {
      type: String,
      default: null
    },
    ratedAt: {
      type: Date,
      default: null
    }
  },
  tags: [{
    type: String
  }],
  internalNotes: [{
    note: String,
    authorId: String,
    authorUsername: String,
    createdAt: {
      type: Date,
      default: Date.now
    }
  }],
  relatedTickets: [{
    ticketId: String,
    relation: {
      type: String,
      enum: ['duplicate', 'related', 'escalated', 'merged']
    }
  }],
  sla: {
    firstResponseAt: {
      type: Date,
      default: null
    },
    firstResponseTime: {
      type: Number,
      default: null
    },
    resolutionTime: {
      type: Number,
      default: null
    },
    deadline: {
      type: Date,
      default: null
    },
    breached: {
      type: Boolean,
      default: false
    }
  },
  automation: {
    autoClosed: {
      type: Boolean,
      default: false
    },
    autoCloseReason: {
      type: String,
      default: null
    }
  }
}, {
  timestamps: true
});

ticketSchema.index({ guildId: 1, status: 1 });
ticketSchema.index({ guildId: 1, createdAt: -1 });
ticketSchema.index({ guildId: 1, 'creator.userId': 1 });
ticketSchema.index({ guildId: 1, category: 1 });
ticketSchema.index({ guildId: 1, priority: 1 });
ticketSchema.index({ guildId: 1, 'claimedBy.userId': 1 });
ticketSchema.index({ status: 1, createdAt: -1 });
ticketSchema.index({ ticketId: 1 });

ticketSchema.virtual('isOpen').get(function() {
  return this.status === 'open';
});

ticketSchema.virtual('duration').get(function() {
  const endTime = this.closedAt || new Date();
  return Math.floor((endTime - this.createdAt) / 1000);
});

ticketSchema.virtual('responseTime').get(function() {
  if (!this.sla.firstResponseAt) return null;
  return Math.floor((this.sla.firstResponseAt - this.createdAt) / 1000);
});

ticketSchema.methods.claim = async function(userId, username) {
  if (this.claimedBy.userId) {
    throw new Error('Ticket is already claimed');
  }
  
  this.claimedBy = {
    userId,
    username,
    claimedAt: new Date()
  };
  
  if (!this.sla.firstResponseAt) {
    this.sla.firstResponseAt = new Date();
    this.sla.firstResponseTime = Math.floor((new Date() - this.createdAt) / 1000);
  }
  
  await this.save();
  return this;
};

ticketSchema.methods.unclaim = async function() {
  this.claimedBy = {
    userId: null,
    username: null,
    claimedAt: null
  };
  
  await this.save();
  return this;
};

ticketSchema.methods.close = async function(closedBy, reason = null) {
  if (this.status === 'closed') {
    throw new Error('Ticket is already closed');
  }
  
  this.status = 'closed';
  this.closedAt = new Date();
  this.closedBy = {
    userId: closedBy.userId || closedBy,
    username: closedBy.username || 'Unknown'
  };
  this.closeReason = reason;
  
  if (this.sla.firstResponseAt) {
    this.sla.resolutionTime = Math.floor((new Date() - this.createdAt) / 1000);
  }
  
  await this.save();
  return this;
};

ticketSchema.methods.reopen = async function(reopenedBy, reason = null) {
  if (this.status !== 'closed') {
    throw new Error('Only closed tickets can be reopened');
  }
  
  this.status = 'open';
  this.reopenedAt = new Date();
  this.reopenedBy = {
    userId: reopenedBy.userId || reopenedBy,
    username: reopenedBy.username || 'Unknown'
  };
  this.closedAt = null;
  this.closedBy = { userId: null, username: null };
  this.closeReason = null;
  
  if (reason) {
    this.internalNotes.push({
      note: `Reopened: ${reason}`,
      authorId: reopenedBy.userId || reopenedBy,
      authorUsername: reopenedBy.username || 'Unknown'
    });
  }
  
  await this.save();
  return this;
};

ticketSchema.methods.archive = async function() {
  this.status = 'archived';
  await this.save();
  return this;
};

ticketSchema.methods.addMessage = async function(messageData) {
  this.messages.push({
    ...messageData,
    timestamp: new Date()
  });
  
  const participant = this.participants.find(p => p.userId === messageData.authorId);
  if (participant) {
    participant.messagesCount += 1;
  } else {
    this.participants.push({
      userId: messageData.authorId,
      username: messageData.authorUsername,
      messagesCount: 1
    });
  }
  
  if (!this.sla.firstResponseAt && messageData.authorId !== this.creator.userId) {
    this.sla.firstResponseAt = new Date();
    this.sla.firstResponseTime = Math.floor((new Date() - this.createdAt) / 1000);
  }
  
  await this.save();
  return this;
};

ticketSchema.methods.addParticipant = async function(userId, username) {
  if (!this.participants.find(p => p.userId === userId)) {
    this.participants.push({
      userId,
      username,
      joinedAt: new Date()
    });
    await this.save();
  }
  return this;
};

ticketSchema.methods.addInternalNote = async function(note, authorId, authorUsername) {
  this.internalNotes.push({
    note,
    authorId,
    authorUsername,
    createdAt: new Date()
  });
  await this.save();
  return this;
};

ticketSchema.methods.setTranscript = async function(url, messagesCount) {
  this.transcript.generated = true;
  this.transcript.url = url;
  this.transcript.messagesCount = messagesCount;
  this.transcript.generatedAt = new Date();
  await this.save();
  return this;
};

ticketSchema.methods.submitRating = async function(rating, feedback = null) {
  if (this.ratings.userRating) {
    throw new Error('Rating already submitted');
  }
  
  this.ratings.userRating = rating;
  this.ratings.userFeedback = feedback;
  this.ratings.ratedAt = new Date();
  
  await this.save();
  return this;
};

ticketSchema.statics.generateTicketId = function() {
  const timestamp = Date.now().toString(36).toUpperCase();
  const random = Math.random().toString(36).substring(2, 6).toUpperCase();
  return `${timestamp}-${random}`;
};

ticketSchema.statics.getOpenTickets = async function(guildId) {
  return this.find({ guildId, status: 'open' }).sort({ createdAt: -1 });
};

ticketSchema.statics.getUserTickets = async function(guildId, userId, limit = 10) {
  return this.find({
    guildId,
    'creator.userId': userId
  })
    .sort({ createdAt: -1 })
    .limit(limit);
};

ticketSchema.statics.getStats = async function(guildId, days = 30) {
  const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
  
  const stats = await this.aggregate([
    {
      $match: {
        guildId,
        createdAt: { $gte: since }
      }
    },
    {
      $group: {
        _id: '$status',
        count: { $sum: 1 }
      }
    }
  ]);
  
  const total = stats.reduce((acc, s) => acc + s.count, 0);
  const byStatus = stats.reduce((acc, s) => {
    acc[s._id] = s.count;
    return acc;
  }, {});
  
  const avgResponse = await this.aggregate([
    {
      $match: {
        guildId,
        createdAt: { $gte: since },
        'sla.firstResponseTime': { $ne: null }
      }
    },
    {
      $group: {
        _id: null,
        avgResponse: { $avg: '$sla.firstResponseTime' }
      }
    }
  ]);
  
  const avgResolution = await this.aggregate([
    {
      $match: {
        guildId,
        createdAt: { $gte: since },
        status: 'closed',
        'sla.resolutionTime': { $ne: null }
      }
    },
    {
      $group: {
        _id: null,
        avgResolution: { $avg: '$sla.resolutionTime' }
      }
    }
  ]);
  
  return {
    total,
    byStatus,
    averageResponseTime: Math.round(avgResponse[0]?.avgResponse || 0),
    averageResolutionTime: Math.round(avgResolution[0]?.avgResolution || 0)
  };
};

const Ticket = mongoose.model('Ticket', ticketSchema);

export default Ticket;
