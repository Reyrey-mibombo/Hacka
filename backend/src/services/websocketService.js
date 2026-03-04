import { WebSocketServer } from 'ws';
import jwt from 'jsonwebtoken';

const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key-change-in-production';

/**
 * Service for managing WebSocket connections and real-time updates
 */
class WebSocketService {
  constructor() {
    this.wss = null;
    this.clients = new Map(); // userId -> Set of WebSocket connections
    this.guildClients = new Map(); // guildId -> Set of userIds
    this.heartbeatInterval = 30000; // 30 seconds
  }

  /**
   * Initialize WebSocket server
   * @param {http.Server} server - HTTP server instance
   */
  initialize(server) {
    this.wss = new WebSocketServer({ server, path: '/ws' });

    this.wss.on('connection', (ws, req) => {
      this.handleConnection(ws, req);
    });

    // Start heartbeat check
    this.startHeartbeat();

    console.log('WebSocket server initialized');
  }

  /**
   * Handle new WebSocket connection
   * @param {WebSocket} ws - WebSocket connection
   * @param {http.IncomingMessage} req - HTTP request
   */
  async handleConnection(ws, req) {
    try {
      // Authenticate connection
      const user = await this.authenticateConnection(req);

      if (!user) {
        ws.close(1008, 'Authentication failed');
        return;
      }

      // Store connection
      ws.userId = user.userId;
      ws.guilds = user.guilds || [];
      ws.isAlive = true;

      // Add to user clients
      if (!this.clients.has(user.userId)) {
        this.clients.set(user.userId, new Set());
      }
      this.clients.get(user.userId).add(ws);

      // Add to guild clients
      for (const guildId of ws.guilds) {
        if (!this.guildClients.has(guildId)) {
          this.guildClients.set(guildId, new Set());
        }
        this.guildClients.get(guildId).add(user.userId);
      }

      // Send connection confirmation
      this.sendToClient(ws, {
        type: 'connection',
        status: 'connected',
        userId: user.userId
      });

      // Set up event handlers
      ws.on('message', (data) => this.handleMessage(ws, data));
      ws.on('close', () => this.handleDisconnect(ws));
      ws.on('error', (error) => this.handleError(ws, error));
      ws.on('pong', () => {
        ws.isAlive = true;
      });

      // Subscribe to guild events
      this.sendToClient(ws, {
        type: 'subscribed',
        guilds: ws.guilds
      });

    } catch (error) {
      console.error('WebSocket connection error:', error);
      ws.close(1011, 'Internal server error');
    }
  }

  /**
   * Authenticate WebSocket connection
   * @param {http.IncomingMessage} req - HTTP request
   * @returns {Promise<Object|null>} User data or null
   */
  async authenticateConnection(req) {
    try {
      const token = this.extractToken(req);

      if (!token) {
        return null;
      }

      const decoded = jwt.verify(token, JWT_SECRET);

      if (decoded.type !== 'access') {
        return null;
      }

      return {
        userId: decoded.userId,
        username: decoded.username,
        guilds: decoded.guilds || []
      };
    } catch (error) {
      return null;
    }
  }

  /**
   * Extract JWT token from request
   * @param {http.IncomingMessage} req - HTTP request
   * @returns {string|null} Token or null
   */
  extractToken(req) {
    // Check query string
    const url = new URL(req.url, `http://${req.headers.host}`);
    const token = url.searchParams.get('token');

    if (token) return token;

    // Check headers
    const authHeader = req.headers.authorization;
    if (authHeader && authHeader.startsWith('Bearer ')) {
      return authHeader.substring(7);
    }

    return null;
  }

  /**
   * Handle incoming message
   * @param {WebSocket} ws - WebSocket connection
   * @param {Buffer} data - Message data
   */
  handleMessage(ws, data) {
    try {
      const message = JSON.parse(data);

      switch (message.type) {
        case 'ping':
          this.sendToClient(ws, { type: 'pong', timestamp: Date.now() });
          break;

        case 'subscribe':
          this.handleSubscribe(ws, message);
          break;

        case 'unsubscribe':
          this.handleUnsubscribe(ws, message);
          break;

        case 'typing':
          this.broadcastToGuild(ws, message.guildId, {
            type: 'typing',
            userId: ws.userId,
            channelId: message.channelId
          });
          break;

        default:
          this.sendToClient(ws, {
            type: 'error',
            message: 'Unknown message type'
          });
      }
    } catch (error) {
      this.sendToClient(ws, {
        type: 'error',
        message: 'Invalid message format'
      });
    }
  }

  /**
   * Handle subscription request
   * @param {WebSocket} ws - WebSocket connection
   * @param {Object} message - Subscription message
   */
  handleSubscribe(ws, message) {
    const { guildId } = message;

    if (!guildId) return;

    // Add to guild subscription
    if (!ws.guilds.includes(guildId)) {
      ws.guilds.push(guildId);
    }

    if (!this.guildClients.has(guildId)) {
      this.guildClients.set(guildId, new Set());
    }
    this.guildClients.get(guildId).add(ws.userId);

    this.sendToClient(ws, {
      type: 'subscribed',
      guildId
    });
  }

  /**
   * Handle unsubscription request
   * @param {WebSocket} ws - WebSocket connection
   * @param {Object} message - Unsubscription message
   */
  handleUnsubscribe(ws, message) {
    const { guildId } = message;

    if (!guildId) return;

    // Remove from guild subscription
    ws.guilds = ws.guilds.filter(g => g !== guildId);

    if (this.guildClients.has(guildId)) {
      this.guildClients.get(guildId).delete(ws.userId);
    }

    this.sendToClient(ws, {
      type: 'unsubscribed',
      guildId
    });
  }

  /**
   * Handle client disconnect
   * @param {WebSocket} ws - WebSocket connection
   */
  handleDisconnect(ws) {
    // Remove from user clients
    if (this.clients.has(ws.userId)) {
      this.clients.get(ws.userId).delete(ws);

      if (this.clients.get(ws.userId).size === 0) {
        this.clients.delete(ws.userId);
      }
    }

    // Remove from guild clients
    for (const guildId of ws.guilds || []) {
      if (this.guildClients.has(guildId)) {
        this.guildClients.get(guildId).delete(ws.userId);
      }
    }

    console.log(`Client disconnected: ${ws.userId}`);
  }

  /**
   * Handle connection error
   * @param {WebSocket} ws - WebSocket connection
   * @param {Error} error - Error object
   */
  handleError(ws, error) {
    console.error(`WebSocket error for user ${ws.userId}:`, error);
  }

  /**
   * Send message to specific client
   * @param {WebSocket} ws - WebSocket connection
   * @param {Object} data - Message data
   */
  sendToClient(ws, data) {
    if (ws.readyState === 1) { // WebSocket.OPEN
      ws.send(JSON.stringify(data));
    }
  }

  /**
   * Send message to specific user
   * @param {string} userId - User ID
   * @param {Object} data - Message data
   */
  sendToUser(userId, data) {
    const userConnections = this.clients.get(userId);

    if (userConnections) {
      for (const ws of userConnections) {
        this.sendToClient(ws, data);
      }
    }
  }

  /**
   * Broadcast message to all users in a guild
   * @param {WebSocket} sender - Sender WebSocket (to exclude)
   * @param {string} guildId - Guild ID
   * @param {Object} data - Message data
   */
  broadcastToGuild(sender, guildId, data) {
    const userIds = this.guildClients.get(guildId);

    if (!userIds) return;

    for (const userId of userIds) {
      if (userId === sender.userId) continue;

      const userConnections = this.clients.get(userId);

      if (userConnections) {
        for (const ws of userConnections) {
          if (ws.readyState === 1) {
            ws.send(JSON.stringify(data));
          }
        }
      }
    }
  }

  /**
   * Broadcast message to all connected clients
   * @param {Object} data - Message data
   */
  broadcastToAll(data) {
    for (const userConnections of this.clients.values()) {
      for (const ws of userConnections) {
        if (ws.readyState === 1) {
          ws.send(JSON.stringify(data));
        }
      }
    }
  }

  /**
   * Start heartbeat interval
   */
  startHeartbeat() {
    setInterval(() => {
      for (const userConnections of this.clients.values()) {
        for (const ws of userConnections) {
          if (ws.isAlive === false) {
            ws.terminate();
            continue;
          }

          ws.isAlive = false;
          ws.ping();
        }
      }
    }, this.heartbeatInterval);
  }

  // ==================== NOTIFICATION METHODS ====================

  /**
   * Notify about new ticket
   * @param {string} guildId - Guild ID
   * @param {Object} ticket - Ticket data
   */
  notifyNewTicket(guildId, ticket) {
    this.broadcastToGuild({ userId: null }, guildId, {
      type: 'ticket_created',
      guildId,
      ticket
    });
  }

  /**
   * Notify about ticket update
   * @param {string} guildId - Guild ID
   * @param {Object} ticket - Ticket data
   * @param {string} updateType - Type of update
   */
  notifyTicketUpdate(guildId, ticket, updateType) {
    this.broadcastToGuild({ userId: null }, guildId, {
      type: 'ticket_updated',
      guildId,
      ticket,
      updateType
    });
  }

  /**
   * Notify about staff shift update
   * @param {string} guildId - Guild ID
   * @param {Object} staff - Staff data
   * @param {string} action - Action type
   */
  notifyShiftUpdate(guildId, staff, action) {
    this.broadcastToGuild({ userId: null }, guildId, {
      type: 'shift_updated',
      guildId,
      staff,
      action
    });
  }

  /**
   * Notify about leaderboard update
   * @param {string} guildId - Guild ID
   * @param {string} type - Leaderboard type
   * @param {Object} data - Leaderboard data
   */
  notifyLeaderboardUpdate(guildId, type, data) {
    this.broadcastToGuild({ userId: null }, guildId, {
      type: 'leaderboard_updated',
      guildId,
      leaderboardType: type,
      data
    });
  }

  /**
   * Notify about settings change
   * @param {string} guildId - Guild ID
   * @param {string} moduleName - Module name
   * @param {Object} settings - Settings data
   */
  notifySettingsUpdate(guildId, moduleName, settings) {
    this.broadcastToGuild({ userId: null }, guildId, {
      type: 'settings_updated',
      guildId,
      module: moduleName,
      settings
    });
  }

  /**
   * Notify about warning issued
   * @param {string} guildId - Guild ID
   * @param {Object} warning - Warning data
   */
  notifyWarningIssued(guildId, warning) {
    this.broadcastToGuild({ userId: null }, guildId, {
      type: 'warning_issued',
      guildId,
      warning
    });
  }

  /**
   * Notify user directly
   * @param {string} userId - User ID
   * @param {string} notificationType - Notification type
   * @param {Object} data - Notification data
   */
  notifyUser(userId, notificationType, data) {
    this.sendToUser(userId, {
      type: 'notification',
      notificationType,
      data,
      timestamp: Date.now()
    });
  }

  /**
   * Get connection statistics
   * @returns {Object} Connection stats
   */
  getStats() {
    let totalConnections = 0;
    for (const connections of this.clients.values()) {
      totalConnections += connections.size;
    }

    return {
      totalUsers: this.clients.size,
      totalConnections,
      guilds: this.guildClients.size
    };
  }

  /**
   * Check if user is online
   * @param {string} userId - User ID
   * @returns {boolean} True if online
   */
  isUserOnline(userId) {
    const connections = this.clients.get(userId);
    return connections && connections.size > 0;
  }

  /**
   * Get online users for a guild
   * @param {string} guildId - Guild ID
   * @returns {Array} Array of user IDs
   */
  getOnlineUsers(guildId) {
    const userIds = this.guildClients.get(guildId);
    return userIds ? Array.from(userIds).filter(id => this.isUserOnline(id)) : [];
  }
}

export default new WebSocketService();
