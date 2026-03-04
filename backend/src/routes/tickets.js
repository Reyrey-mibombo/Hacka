import express from 'express';
import { authenticateJWT } from '../middleware/auth.js';
import { requireModerator } from '../middleware/permissions.js';
import { apiLimiter } from '../middleware/rateLimiter.js';
import { Ticket, ActivityLog } from '../models/index.js';

const router = express.Router({ mergeParams: true });

router.get('/', authenticateJWT, requireModerator, apiLimiter, async (req, res) => {
  try {
    const { guildId } = req.params;
    const { status = 'all', page = 1, limit = 20, userId, claimedBy } = req.query;

    const query = { guildId };

    if (status !== 'all') {
      query.status = status;
    }

    if (userId) {
      query['creator.userId'] = userId;
    }

    if (claimedBy) {
      query['claimedBy.userId'] = claimedBy;
    }

    const skip = (parseInt(page) - 1) * parseInt(limit);

    const [tickets, total] = await Promise.all([
      Ticket.find(query)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(parseInt(limit))
        .select('-messages -__v'),
      Ticket.countDocuments(query)
    ]);

    const stats = await Ticket.getStats(guildId);

    res.json({
      success: true,
      data: {
        tickets: tickets.map(t => ({
          id: t._id,
          ticketId: t.ticketId,
          channelId: t.channelId,
          category: t.category,
          status: t.status,
          priority: t.priority,
          creator: t.creator,
          claimedBy: t.claimedBy,
          subject: t.subject,
          reason: t.reason,
          createdAt: t.createdAt,
          closedAt: t.closedAt,
          ratings: t.ratings
        })),
        pagination: {
          page: parseInt(page),
          limit: parseInt(limit),
          total,
          pages: Math.ceil(total / parseInt(limit))
        },
        stats
      }
    });
  } catch (error) {
    console.error('Get Tickets Error:', error);
    res.status(500).json({
      success: false,
      error: 'Internal Server Error',
      message: 'Failed to fetch tickets'
    });
  }
});

router.get('/stats', authenticateJWT, requireModerator, apiLimiter, async (req, res) => {
  try {
    const { guildId } = req.params;
    const { days = 30 } = req.query;

    const stats = await Ticket.getStats(guildId, parseInt(days));

    const categoryStats = await Ticket.aggregate([
      {
        $match: {
          guildId,
          createdAt: { $gte: new Date(Date.now() - parseInt(days) * 24 * 60 * 60 * 1000) }
        }
      },
      {
        $group: {
          _id: '$category',
          count: { $sum: 1 }
        }
      },
      { $sort: { count: -1 } }
    ]);

    const agentStats = await Ticket.aggregate([
      {
        $match: {
          guildId,
          status: 'closed',
          'claimedBy.userId': { $ne: null },
          createdAt: { $gte: new Date(Date.now() - parseInt(days) * 24 * 60 * 60 * 1000) }
        }
      },
      {
        $group: {
          _id: '$claimedBy.userId',
          username: { $first: '$claimedBy.username' },
          ticketsClosed: { $sum: 1 },
          avgResolutionTime: { $avg: '$sla.resolutionTime' }
        }
      },
      { $sort: { ticketsClosed: -1 } },
      { $limit: 10 }
    ]);

    res.json({
      success: true,
      data: {
        ...stats,
        byCategory: categoryStats,
        topAgents: agentStats,
        period: {
          days: parseInt(days),
          since: new Date(Date.now() - parseInt(days) * 24 * 60 * 60 * 1000)
        }
      }
    });
  } catch (error) {
    console.error('Get Ticket Stats Error:', error);
    res.status(500).json({
      success: false,
      error: 'Internal Server Error',
      message: 'Failed to fetch ticket statistics'
    });
  }
});

router.get('/:ticketId', authenticateJWT, requireModerator, apiLimiter, async (req, res) => {
  try {
    const { guildId, ticketId } = req.params;

    const ticket = await Ticket.findOne({ guildId, ticketId })
      .select('-__v');

    if (!ticket) {
      return res.status(404).json({
        success: false,
        error: 'Not Found',
        message: 'Ticket not found'
      });
    }

    res.json({
      success: true,
      data: { ticket }
    });
  } catch (error) {
    console.error('Get Ticket Error:', error);
    res.status(500).json({
      success: false,
      error: 'Internal Server Error',
      message: 'Failed to fetch ticket'
    });
  }
});

router.post('/', authenticateJWT, apiLimiter, async (req, res) => {
  try {
    const { guildId } = req.params;
    const { category = 'general', subject, reason, priority = 'medium' } = req.body;
    const userId = req.user.id;

    const ticketId = Ticket.generateTicketId();

    const ticket = new Ticket({
      guildId,
      ticketId,
      channelId: `temp_${ticketId}`,
      category,
      priority,
      creator: {
        userId,
        username: req.user.username,
        avatar: req.user.avatar
      },
      subject,
      reason,
      status: 'open'
    });

    await ticket.save();

    await ActivityLog.createLog({
      guildId,
      type: 'ticket_created',
      severity: 'low',
      actor: {
        userId: req.user.id,
        username: req.user.username,
        avatar: req.user.avatar
      },
      details: {
        description: `Created ticket: ${subject || reason || 'No subject'}`,
        category,
        priority
      },
      relatedEntities: { ticketId: ticket.ticketId },
      source: { type: 'dashboard' }
    });

    res.status(201).json({
      success: true,
      data: { ticket }
    });
  } catch (error) {
    console.error('Create Ticket Error:', error);
    res.status(500).json({
      success: false,
      error: 'Internal Server Error',
      message: 'Failed to create ticket'
    });
  }
});

router.post('/:ticketId/claim', authenticateJWT, requireModerator, apiLimiter, async (req, res) => {
  try {
    const { guildId, ticketId } = req.params;

    const ticket = await Ticket.findOne({ guildId, ticketId });

    if (!ticket) {
      return res.status(404).json({
        success: false,
        error: 'Not Found',
        message: 'Ticket not found'
      });
    }

    if (ticket.claimedBy.userId) {
      return res.status(409).json({
        success: false,
        error: 'Conflict',
        message: 'Ticket is already claimed'
      });
    }

    await ticket.claim(req.user.id, req.user.username);

    await ActivityLog.createLog({
      guildId,
      type: 'ticket_claimed',
      severity: 'low',
      actor: {
        userId: req.user.id,
        username: req.user.username,
        avatar: req.user.avatar
      },
      target: { userId: ticket.creator.userId, username: ticket.creator.username },
      details: {
        description: `Claimed ticket ${ticketId}`
      },
      relatedEntities: { ticketId: ticket.ticketId },
      source: { type: 'dashboard' }
    });

    res.json({
      success: true,
      data: { ticket }
    });
  } catch (error) {
    console.error('Claim Ticket Error:', error);
    res.status(500).json({
      success: false,
      error: 'Internal Server Error',
      message: 'Failed to claim ticket'
    });
  }
});

router.post('/:ticketId/unclaim', authenticateJWT, requireModerator, apiLimiter, async (req, res) => {
  try {
    const { guildId, ticketId } = req.params;

    const ticket = await Ticket.findOne({ guildId, ticketId });

    if (!ticket) {
      return res.status(404).json({
        success: false,
        error: 'Not Found',
        message: 'Ticket not found'
      });
    }

    if (ticket.claimedBy.userId !== req.user.id) {
      return res.status(403).json({
        success: false,
        error: 'Forbidden',
        message: 'Only the claiming user can unclaim this ticket'
      });
    }

    await ticket.unclaim();

    res.json({
      success: true,
      data: { ticket }
    });
  } catch (error) {
    console.error('Unclaim Ticket Error:', error);
    res.status(500).json({
      success: false,
      error: 'Internal Server Error',
      message: 'Failed to unclaim ticket'
    });
  }
});

router.post('/:ticketId/close', authenticateJWT, requireModerator, apiLimiter, async (req, res) => {
  try {
    const { guildId, ticketId } = req.params;
    const { reason } = req.body;

    const ticket = await Ticket.findOne({ guildId, ticketId });

    if (!ticket) {
      return res.status(404).json({
        success: false,
        error: 'Not Found',
        message: 'Ticket not found'
      });
    }

    await ticket.close(req.user, reason);

    await ActivityLog.createLog({
      guildId,
      type: 'ticket_closed',
      severity: 'low',
      actor: {
        userId: req.user.id,
        username: req.user.username,
        avatar: req.user.avatar
      },
      target: { userId: ticket.creator.userId, username: ticket.creator.username },
      details: {
        description: `Closed ticket ${ticketId}`,
        reason
      },
      relatedEntities: { ticketId: ticket.ticketId },
      source: { type: 'dashboard' }
    });

    res.json({
      success: true,
      data: { ticket }
    });
  } catch (error) {
    console.error('Close Ticket Error:', error);
    res.status(500).json({
      success: false,
      error: 'Internal Server Error',
      message: 'Failed to close ticket'
    });
  }
});

router.post('/:ticketId/reopen', authenticateJWT, requireModerator, apiLimiter, async (req, res) => {
  try {
    const { guildId, ticketId } = req.params;
    const { reason } = req.body;

    const ticket = await Ticket.findOne({ guildId, ticketId });

    if (!ticket) {
      return res.status(404).json({
        success: false,
        error: 'Not Found',
        message: 'Ticket not found'
      });
    }

    await ticket.reopen(req.user, reason);

    await ActivityLog.createLog({
      guildId,
      type: 'dashboard_action',
      severity: 'low',
      actor: {
        userId: req.user.id,
        username: req.user.username,
        avatar: req.user.avatar
      },
      target: { userId: ticket.creator.userId, username: ticket.creator.username },
      details: {
        description: `Reopened ticket ${ticketId}`,
        reason
      },
      relatedEntities: { ticketId: ticket.ticketId },
      source: { type: 'dashboard' }
    });

    res.json({
      success: true,
      data: { ticket }
    });
  } catch (error) {
    console.error('Reopen Ticket Error:', error);
    res.status(500).json({
      success: false,
      error: 'Internal Server Error',
      message: 'Failed to reopen ticket'
    });
  }
});

router.post('/:ticketId/note', authenticateJWT, requireModerator, apiLimiter, async (req, res) => {
  try {
    const { guildId, ticketId } = req.params;
    const { note } = req.body;

    if (!note) {
      return res.status(400).json({
        success: false,
        error: 'Bad Request',
        message: 'Note content is required'
      });
    }

    const ticket = await Ticket.findOne({ guildId, ticketId });

    if (!ticket) {
      return res.status(404).json({
        success: false,
        error: 'Not Found',
        message: 'Ticket not found'
      });
    }

    await ticket.addInternalNote(note, req.user.id, req.user.username);

    res.json({
      success: true,
      data: { ticket }
    });
  } catch (error) {
    console.error('Add Note Error:', error);
    res.status(500).json({
      success: false,
      error: 'Internal Server Error',
      message: 'Failed to add note'
    });
  }
});

export default router;
