import { Ticket } from '../models/index.js';
import mongoose from 'mongoose';

/**
 * Service for managing ticket lifecycle
 */
class TicketService {
  /**
   * Create a new ticket
   * @param {Object} ticketData - Ticket data
   * @returns {Promise<Ticket>} Created ticket document
   */
  async createTicket(ticketData) {
    try {
      const ticketId = Ticket.generateTicketId();

      const ticket = new Ticket({
        guildId: ticketData.guildId,
        ticketId,
        channelId: ticketData.channelId,
        category: ticketData.category || 'general',
        priority: ticketData.priority || 'medium',
        creator: {
          userId: ticketData.creatorId,
          username: ticketData.creatorUsername,
          discriminator: ticketData.creatorDiscriminator || '0',
          avatar: ticketData.creatorAvatar || null
        },
        reason: ticketData.reason || null,
        subject: ticketData.subject || null,
        participants: [{
          userId: ticketData.creatorId,
          username: ticketData.creatorUsername,
          joinedAt: new Date(),
          messagesCount: 0
        }]
      });

      await ticket.save();
      return ticket;
    } catch (error) {
      throw new Error(`Failed to create ticket: ${error.message}`);
    }
  }

  /**
   * Get ticket by ID
   * @param {string} ticketId - Ticket ID
   * @returns {Promise<Ticket|null>} Ticket document or null
   */
  async getTicket(ticketId) {
    return Ticket.findOne({ ticketId });
  }

  /**
   * Get ticket by channel ID
   * @param {string} channelId - Discord channel ID
   * @returns {Promise<Ticket|null>} Ticket document or null
   */
  async getTicketByChannel(channelId) {
    return Ticket.findOne({ channelId });
  }

  /**
   * Get all tickets for a guild
   * @param {string} guildId - Discord guild ID
   * @param {Object} options - Query options
   * @returns {Promise<Array>} Array of tickets
   */
  async getGuildTickets(guildId, options = {}) {
    const {
      status = null,
      category = null,
      limit = 50,
      skip = 0,
      sort = { createdAt: -1 }
    } = options;

    const filter = { guildId };

    if (status) filter.status = status;
    if (category) filter.category = category;

    return Ticket.find(filter)
      .sort(sort)
      .skip(skip)
      .limit(limit);
  }

  /**
   * Get open tickets for a guild
   * @param {string} guildId - Discord guild ID
   * @returns {Promise<Array>} Array of open tickets
   */
  async getOpenTickets(guildId) {
    return Ticket.getOpenTickets(guildId);
  }

  /**
   * Get tickets created by a user
   * @param {string} guildId - Discord guild ID
   * @param {string} userId - User's Discord ID
   * @param {number} limit - Number of results
   * @returns {Promise<Array>} Array of tickets
   */
  async getUserTickets(guildId, userId, limit = 10) {
    return Ticket.getUserTickets(guildId, userId, limit);
  }

  /**
   * Claim a ticket
   * @param {string} ticketId - Ticket ID
   * @param {string} userId - User claiming
   * @param {string} username - Username of claimer
   * @returns {Promise<Ticket>} Updated ticket
   */
  async claimTicket(ticketId, userId, username) {
    const ticket = await Ticket.findOne({ ticketId });

    if (!ticket) {
      throw new Error('Ticket not found');
    }

    if (ticket.status !== 'open') {
      throw new Error('Ticket is not open');
    }

    await ticket.claim(userId, username);
    return ticket;
  }

  /**
   * Unclaim a ticket
   * @param {string} ticketId - Ticket ID
   * @returns {Promise<Ticket>} Updated ticket
   */
  async unclaimTicket(ticketId) {
    const ticket = await Ticket.findOne({ ticketId });

    if (!ticket) {
      throw new Error('Ticket not found');
    }

    await ticket.unclaim();
    return ticket;
  }

  /**
   * Close a ticket
   * @param {string} ticketId - Ticket ID
   * @param {Object} closedBy - User closing the ticket
   * @param {string} reason - Close reason
   * @returns {Promise<Ticket>} Updated ticket
   */
  async closeTicket(ticketId, closedBy, reason = null) {
    const ticket = await Ticket.findOne({ ticketId });

    if (!ticket) {
      throw new Error('Ticket not found');
    }

    await ticket.close(closedBy, reason);
    return ticket;
  }

  /**
   * Reopen a closed ticket
   * @param {string} ticketId - Ticket ID
   * @param {Object} reopenedBy - User reopening
   * @param {string} reason - Reopen reason
   * @returns {Promise<Ticket>} Updated ticket
   */
  async reopenTicket(ticketId, reopenedBy, reason = null) {
    const ticket = await Ticket.findOne({ ticketId });

    if (!ticket) {
      throw new Error('Ticket not found');
    }

    await ticket.reopen(reopenedBy, reason);
    return ticket;
  }

  /**
   * Archive a ticket
   * @param {string} ticketId - Ticket ID
   * @returns {Promise<Ticket>} Updated ticket
   */
  async archiveTicket(ticketId) {
    const ticket = await Ticket.findOne({ ticketId });

    if (!ticket) {
      throw new Error('Ticket not found');
    }

    await ticket.archive();
    return ticket;
  }

  /**
   * Add message to ticket
   * @param {string} ticketId - Ticket ID
   * @param {Object} messageData - Message data
   * @returns {Promise<Ticket>} Updated ticket
   */
  async addMessage(ticketId, messageData) {
    const ticket = await Ticket.findOne({ ticketId });

    if (!ticket) {
      throw new Error('Ticket not found');
    }

    await ticket.addMessage(messageData);
    return ticket;
  }

  /**
   * Add participant to ticket
   * @param {string} ticketId - Ticket ID
   * @param {string} userId - User ID
   * @param {string} username - Username
   * @returns {Promise<Ticket>} Updated ticket
   */
  async addParticipant(ticketId, userId, username) {
    const ticket = await Ticket.findOne({ ticketId });

    if (!ticket) {
      throw new Error('Ticket not found');
    }

    await ticket.addParticipant(userId, username);
    return ticket;
  }

  /**
   * Add support agent to ticket
   * @param {string} ticketId - Ticket ID
   * @param {string} userId - User ID
   * @param {string} username - Username
   * @returns {Promise<Ticket>} Updated ticket
   */
  async addSupportAgent(ticketId, userId, username) {
    const ticket = await Ticket.findOne({ ticketId });

    if (!ticket) {
      throw new Error('Ticket not found');
    }

    const alreadyAdded = ticket.supportAgents.some(agent => agent.userId === userId);

    if (!alreadyAdded) {
      ticket.supportAgents.push({
        userId,
        username,
        joinedAt: new Date()
      });
      await ticket.save();
    }

    return ticket;
  }

  /**
   * Add internal note to ticket
   * @param {string} ticketId - Ticket ID
   * @param {string} note - Note content
   * @param {Object} author - Note author
   * @returns {Promise<Ticket>} Updated ticket
   */
  async addInternalNote(ticketId, note, author) {
    const ticket = await Ticket.findOne({ ticketId });

    if (!ticket) {
      throw new Error('Ticket not found');
    }

    await ticket.addInternalNote(note, author.userId, author.username);
    return ticket;
  }

  /**
   * Set ticket transcript
   * @param {string} ticketId - Ticket ID
   * @param {string} url - Transcript URL
   * @param {number} messagesCount - Number of messages
   * @returns {Promise<Ticket>} Updated ticket
   */
  async setTranscript(ticketId, url, messagesCount) {
    const ticket = await Ticket.findOne({ ticketId });

    if (!ticket) {
      throw new Error('Ticket not found');
    }

    await ticket.setTranscript(url, messagesCount);
    return ticket;
  }

  /**
   * Submit ticket rating
   * @param {string} ticketId - Ticket ID
   * @param {number} rating - Rating (1-5)
   * @param {string} feedback - Optional feedback
   * @returns {Promise<Ticket>} Updated ticket
   */
  async submitRating(ticketId, rating, feedback = null) {
    const ticket = await Ticket.findOne({ ticketId });

    if (!ticket) {
      throw new Error('Ticket not found');
    }

    if (rating < 1 || rating > 5) {
      throw new Error('Rating must be between 1 and 5');
    }

    await ticket.submitRating(rating, feedback);
    return ticket;
  }

  /**
   * Add tag to ticket
   * @param {string} ticketId - Ticket ID
   * @param {string} tag - Tag to add
   * @returns {Promise<Ticket>} Updated ticket
   */
  async addTag(ticketId, tag) {
    const ticket = await Ticket.findOne({ ticketId });

    if (!ticket) {
      throw new Error('Ticket not found');
    }

    if (!ticket.tags.includes(tag)) {
      ticket.tags.push(tag);
      await ticket.save();
    }

    return ticket;
  }

  /**
   * Remove tag from ticket
   * @param {string} ticketId - Ticket ID
   * @param {string} tag - Tag to remove
   * @returns {Promise<Ticket>} Updated ticket
   */
  async removeTag(ticketId, tag) {
    const ticket = await Ticket.findOne({ ticketId });

    if (!ticket) {
      throw new Error('Ticket not found');
    }

    ticket.tags = ticket.tags.filter(t => t !== tag);
    await ticket.save();

    return ticket;
  }

  /**
   * Link related ticket
   * @param {string} ticketId - Primary ticket ID
   * @param {string} relatedTicketId - Related ticket ID
   * @param {string} relation - Relation type
   * @returns {Promise<Ticket>} Updated ticket
   */
  async linkRelatedTicket(ticketId, relatedTicketId, relation = 'related') {
    const ticket = await Ticket.findOne({ ticketId });

    if (!ticket) {
      throw new Error('Ticket not found');
    }

    const alreadyLinked = ticket.relatedTickets.some(t => t.ticketId === relatedTicketId);

    if (!alreadyLinked) {
      ticket.relatedTickets.push({
        ticketId: relatedTicketId,
        relation
      });
      await ticket.save();
    }

    return ticket;
  }

  /**
   * Update ticket priority
   * @param {string} ticketId - Ticket ID
   * @param {string} priority - New priority
   * @returns {Promise<Ticket>} Updated ticket
   */
  async updatePriority(ticketId, priority) {
    const validPriorities = ['low', 'medium', 'high', 'urgent'];

    if (!validPriorities.includes(priority)) {
      throw new Error('Invalid priority level');
    }

    const ticket = await Ticket.findOneAndUpdate(
      { ticketId },
      { $set: { priority } },
      { new: true }
    );

    if (!ticket) {
      throw new Error('Ticket not found');
    }

    return ticket;
  }

  /**
   * Get ticket statistics
   * @param {string} guildId - Discord guild ID
   * @param {number} days - Number of days to look back
   * @returns {Promise<Object>} Ticket statistics
   */
  async getTicketStats(guildId, days = 30) {
    return Ticket.getStats(guildId, days);
  }

  /**
   * Get tickets assigned to a user
   * @param {string} guildId - Discord guild ID
   * @param {string} userId - User's Discord ID
   * @returns {Promise<Array>} Array of tickets
   */
  async getAssignedTickets(guildId, userId) {
    return Ticket.find({
      guildId,
      'claimedBy.userId': userId,
      status: 'open'
    }).sort({ createdAt: -1 });
  }

  /**
   * Auto-close inactive tickets
   * @param {string} guildId - Discord guild ID
   * @param {number} hours - Hours of inactivity
   * @returns {Promise<number>} Number of tickets closed
   */
  async autoCloseInactive(guildId, hours = 24) {
    const cutoff = new Date(Date.now() - hours * 60 * 60 * 1000);

    const inactiveTickets = await Ticket.find({
      guildId,
      status: 'open',
      lastMessageAt: { $lt: cutoff }
    });

    for (const ticket of inactiveTickets) {
      try {
        ticket.status = 'closed';
        ticket.closedAt = new Date();
        ticket.closedBy = { userId: 'system', username: 'System' };
        ticket.closeReason = `Auto-closed after ${hours} hours of inactivity`;
        ticket.automation.autoClosed = true;
        ticket.automation.autoCloseReason = 'Inactivity';
        await ticket.save();
      } catch (error) {
        console.error(`Failed to auto-close ticket ${ticket.ticketId}:`, error);
      }
    }

    return inactiveTickets.length;
  }

  /**
   * Search tickets
   * @param {string} guildId - Discord guild ID
   * @param {string} query - Search query
   * @param {Object} options - Search options
   * @returns {Promise<Array>} Matching tickets
   */
  async searchTickets(guildId, query, options = {}) {
    const { limit = 20, status = null } = options;

    const filter = {
      guildId,
      $or: [
        { ticketId: { $regex: query, $options: 'i' } },
        { 'creator.username': { $regex: query, $options: 'i' } },
        { subject: { $regex: query, $options: 'i' } },
        { reason: { $regex: query, $options: 'i' } }
      ]
    };

    if (status) {
      filter.status = status;
    }

    return Ticket.find(filter)
      .sort({ createdAt: -1 })
      .limit(limit);
  }

  /**
   * Delete a ticket (soft delete)
   * @param {string} ticketId - Ticket ID
   * @returns {Promise<boolean>} True if deleted
   */
  async deleteTicket(ticketId) {
    const ticket = await Ticket.findOneAndUpdate(
      { ticketId },
      { $set: { status: 'deleted' } },
      { new: true }
    );

    return !!ticket;
  }
}

export default new TicketService();
