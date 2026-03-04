import axios from 'axios';

const DISCORD_API_BASE = 'https://discord.com/api/v10';
const BOT_TOKEN = process.env.DISCORD_BOT_TOKEN;

/**
 * Service for Discord API interactions
 */
class DiscordService {
  constructor() {
    this.api = axios.create({
      baseURL: DISCORD_API_BASE,
      headers: {
        Authorization: `Bot ${BOT_TOKEN}`,
        'Content-Type': 'application/json'
      }
    });

    // Add response interceptor for rate limiting
    this.api.interceptors.response.use(
      (response) => response,
      async (error) => {
        if (error.response?.status === 429) {
          const retryAfter = error.response.headers['retry-after'] || 1;
          await this.sleep(retryAfter * 1000);
          return this.api.request(error.config);
        }
        return Promise.reject(error);
      }
    );
  }

  /**
   * Sleep for specified milliseconds
   * @param {number} ms - Milliseconds to sleep
   * @returns {Promise<void>}
   */
  sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  // ==================== GUILD METHODS ====================

  /**
   * Get guild information
   * @param {string} guildId - Discord guild ID
   * @param {boolean} withCounts - Include approximate member counts
   * @returns {Promise<Object>} Guild data
   */
  async getGuild(guildId, withCounts = true) {
    try {
      const response = await this.api.get(`/guilds/${guildId}`, {
        params: { with_counts: withCounts }
      });
      return response.data;
    } catch (error) {
      throw new Error(`Failed to get guild: ${error.response?.data?.message || error.message}`);
    }
  }

  /**
   * Get guild channels
   * @param {string} guildId - Discord guild ID
   * @returns {Promise<Array>} Array of channels
   */
  async getGuildChannels(guildId) {
    try {
      const response = await this.api.get(`/guilds/${guildId}/channels`);
      return response.data;
    } catch (error) {
      throw new Error(`Failed to get channels: ${error.response?.data?.message || error.message}`);
    }
  }

  /**
   * Get guild roles
   * @param {string} guildId - Discord guild ID
   * @returns {Promise<Array>} Array of roles
   */
  async getGuildRoles(guildId) {
    try {
      const response = await this.api.get(`/guilds/${guildId}/roles`);
      return response.data;
    } catch (error) {
      throw new Error(`Failed to get roles: ${error.response?.data?.message || error.message}`);
    }
  }

  /**
   * Get guild members
   * @param {string} guildId - Discord guild ID
   * @param {Object} options - Query options
   * @returns {Promise<Array>} Array of members
   */
  async getGuildMembers(guildId, options = {}) {
    try {
      const { limit = 1000, after = null } = options;
      const params = { limit };
      if (after) params.after = after;

      const response = await this.api.get(`/guilds/${guildId}/members`, { params });
      return response.data;
    } catch (error) {
      throw new Error(`Failed to get members: ${error.response?.data?.message || error.message}`);
    }
  }

  /**
   * Search guild members
   * @param {string} guildId - Discord guild ID
   * @param {string} query - Search query
   * @param {number} limit - Max results
   * @returns {Promise<Array>} Array of matching members
   */
  async searchGuildMembers(guildId, query, limit = 10) {
    try {
      const response = await this.api.get(`/guilds/${guildId}/members/search`, {
        params: { query, limit }
      });
      return response.data;
    } catch (error) {
      throw new Error(`Failed to search members: ${error.response?.data?.message || error.message}`);
    }
  }

  // ==================== CHANNEL METHODS ====================

  /**
   * Get channel information
   * @param {string} channelId - Discord channel ID
   * @returns {Promise<Object>} Channel data
   */
  async getChannel(channelId) {
    try {
      const response = await this.api.get(`/channels/${channelId}`);
      return response.data;
    } catch (error) {
      throw new Error(`Failed to get channel: ${error.response?.data?.message || error.message}`);
    }
  }

  /**
   * Create guild channel
   * @param {string} guildId - Discord guild ID
   * @param {Object} channelData - Channel data
   * @returns {Promise<Object>} Created channel
   */
  async createChannel(guildId, channelData) {
    try {
      const response = await this.api.post(`/guilds/${guildId}/channels`, channelData);
      return response.data;
    } catch (error) {
      throw new Error(`Failed to create channel: ${error.response?.data?.message || error.message}`);
    }
  }

  /**
   * Send message to channel
   * @param {string} channelId - Discord channel ID
   * @param {Object} messageData - Message data
   * @returns {Promise<Object>} Sent message
   */
  async sendMessage(channelId, messageData) {
    try {
      const response = await this.api.post(`/channels/${channelId}/messages`, messageData);
      return response.data;
    } catch (error) {
      throw new Error(`Failed to send message: ${error.response?.data?.message || error.message}`);
    }
  }

  /**
   * Delete message
   * @param {string} channelId - Discord channel ID
   * @param {string} messageId - Message ID
   * @returns {Promise<void>}
   */
  async deleteMessage(channelId, messageId) {
    try {
      await this.api.delete(`/channels/${channelId}/messages/${messageId}`);
    } catch (error) {
      throw new Error(`Failed to delete message: ${error.response?.data?.message || error.message}`);
    }
  }

  // ==================== MEMBER METHODS ====================

  /**
   * Get guild member
   * @param {string} guildId - Discord guild ID
   * @param {string} userId - User ID
   * @returns {Promise<Object>} Member data
   */
  async getGuildMember(guildId, userId) {
    try {
      const response = await this.api.get(`/guilds/${guildId}/members/${userId}`);
      return response.data;
    } catch (error) {
      throw new Error(`Failed to get member: ${error.response?.data?.message || error.message}`);
    }
  }

  /**
   * Modify guild member
   * @param {string} guildId - Discord guild ID
   * @param {string} userId - User ID
   * @param {Object} data - Member modification data
   * @returns {Promise<Object>} Updated member
   */
  async modifyGuildMember(guildId, userId, data) {
    try {
      const response = await this.api.patch(`/guilds/${guildId}/members/${userId}`, data);
      return response.data;
    } catch (error) {
      throw new Error(`Failed to modify member: ${error.response?.data?.message || error.message}`);
    }
  }

  /**
   * Add role to member
   * @param {string} guildId - Discord guild ID
   * @param {string} userId - User ID
   * @param {string} roleId - Role ID
   * @returns {Promise<void>}
   */
  async addRole(guildId, userId, roleId) {
    try {
      await this.api.put(`/guilds/${guildId}/members/${userId}/roles/${roleId}`);
    } catch (error) {
      throw new Error(`Failed to add role: ${error.response?.data?.message || error.message}`);
    }
  }

  /**
   * Remove role from member
   * @param {string} guildId - Discord guild ID
   * @param {string} userId - User ID
   * @param {string} roleId - Role ID
   * @returns {Promise<void>}
   */
  async removeRole(guildId, userId, roleId) {
    try {
      await this.api.delete(`/guilds/${guildId}/members/${userId}/roles/${roleId}`);
    } catch (error) {
      throw new Error(`Failed to remove role: ${error.response?.data?.message || error.message}`);
    }
  }

  /**
   * Kick member from guild
   * @param {string} guildId - Discord guild ID
   * @param {string} userId - User ID
   * @param {string} reason - Kick reason
   * @returns {Promise<void>}
   */
  async kickMember(guildId, userId, reason = null) {
    try {
      await this.api.delete(`/guilds/${guildId}/members/${userId}`, {
        headers: reason ? { 'X-Audit-Log-Reason': reason } : {}
      });
    } catch (error) {
      throw new Error(`Failed to kick member: ${error.response?.data?.message || error.message}`);
    }
  }

  /**
   * Ban member from guild
   * @param {string} guildId - Discord guild ID
   * @param {string} userId - User ID
   * @param {Object} options - Ban options
   * @returns {Promise<void>}
   */
  async banMember(guildId, userId, options = {}) {
    try {
      const { deleteMessageDays = 0, reason = null } = options;

      await this.api.put(`/guilds/${guildId}/bans/${userId}`, {
        delete_message_days: deleteMessageDays
      }, {
        headers: reason ? { 'X-Audit-Log-Reason': reason } : {}
      });
    } catch (error) {
      throw new Error(`Failed to ban member: ${error.response?.data?.message || error.message}`);
    }
  }

  /**
   * Unban member from guild
   * @param {string} guildId - Discord guild ID
   * @param {string} userId - User ID
   * @param {string} reason - Unban reason
   * @returns {Promise<void>}
   */
  async unbanMember(guildId, userId, reason = null) {
    try {
      await this.api.delete(`/guilds/${guildId}/bans/${userId}`, {
        headers: reason ? { 'X-Audit-Log-Reason': reason } : {}
      });
    } catch (error) {
      throw new Error(`Failed to unban member: ${error.response?.data?.message || error.message}`);
    }
  }

  /**
   * Timeout member
   * @param {string} guildId - Discord guild ID
   * @param {string} userId - User ID
   * @param {number} duration - Timeout duration in minutes
   * @param {string} reason - Timeout reason
   * @returns {Promise<Object>} Updated member
   */
  async timeoutMember(guildId, userId, duration, reason = null) {
    try {
      const communicationDisabledUntil = new Date(Date.now() + duration * 60 * 1000).toISOString();

      const response = await this.api.patch(`/guilds/${guildId}/members/${userId}`, {
        communication_disabled_until: communicationDisabledUntil
      }, {
        headers: reason ? { 'X-Audit-Log-Reason': reason } : {}
      });

      return response.data;
    } catch (error) {
      throw new Error(`Failed to timeout member: ${error.response?.data?.message || error.message}`);
    }
  }

  /**
   * Remove timeout from member
   * @param {string} guildId - Discord guild ID
   * @param {string} userId - User ID
   * @param {string} reason - Reason
   * @returns {Promise<Object>} Updated member
   */
  async removeTimeout(guildId, userId, reason = null) {
    try {
      const response = await this.api.patch(`/guilds/${guildId}/members/${userId}`, {
        communication_disabled_until: null
      }, {
        headers: reason ? { 'X-Audit-Log-Reason': reason } : {}
      });

      return response.data;
    } catch (error) {
      throw new Error(`Failed to remove timeout: ${error.response?.data?.message || error.message}`);
    }
  }

  // ==================== USER METHODS ====================

  /**
   * Get user information
   * @param {string} userId - User ID
   * @returns {Promise<Object>} User data
   */
  async getUser(userId) {
    try {
      const response = await this.api.get(`/users/${userId}`);
      return response.data;
    } catch (error) {
      throw new Error(`Failed to get user: ${error.response?.data?.message || error.message}`);
    }
  }

  /**
   * Get current bot user
   * @returns {Promise<Object>} Bot user data
   */
  async getCurrentUser() {
    try {
      const response = await this.api.get('/users/@me');
      return response.data;
    } catch (error) {
      throw new Error(`Failed to get current user: ${error.response?.data?.message || error.message}`);
    }
  }

  // ==================== UTILITY METHODS ====================

  /**
   * Check if bot has permission in guild
   * @param {string} guildId - Discord guild ID
   * @param {string} permission - Permission to check
   * @returns {Promise<boolean>} True if has permission
   */
  async hasPermission(guildId, permission) {
    try {
      const member = await this.getGuildMember(guildId, process.env.DISCORD_CLIENT_ID);
      const permissions = BigInt(member.permissions);
      const requiredPermission = BigInt(permission);

      return (permissions & requiredPermission) === requiredPermission;
    } catch (error) {
      return false;
    }
  }

  /**
   * Get bot's permissions in guild
   * @param {string} guildId - Discord guild ID
   * @returns {Promise<BigInt>} Permission bitfield
   */
  async getBotPermissions(guildId) {
    try {
      const member = await this.getGuildMember(guildId, process.env.DISCORD_CLIENT_ID);
      return BigInt(member.permissions);
    } catch (error) {
      return BigInt(0);
    }
  }

  /**
   * Fetch all guild members (handles pagination)
   * @param {string} guildId - Discord guild ID
   * @returns {Promise<Array>} All members
   */
  async fetchAllGuildMembers(guildId) {
    const allMembers = [];
    let after = null;
    const limit = 1000;

    while (true) {
      const members = await this.getGuildMembers(guildId, { limit, after });

      if (members.length === 0) break;

      allMembers.push(...members);

      if (members.length < limit) break;

      after = members[members.length - 1].user.id;
    }

    return allMembers;
  }

  /**
   * Send DM to user
   * @param {string} userId - User ID
   * @param {Object} messageData - Message data
   * @returns {Promise<Object>} Sent message
   */
  async sendDM(userId, messageData) {
    try {
      // First, create DM channel
      const channelResponse = await this.api.post('/users/@me/channels', {
        recipient_id: userId
      });

      // Then send message
      const response = await this.api.post(`/channels/${channelResponse.data.id}/messages`, messageData);
      return response.data;
    } catch (error) {
      throw new Error(`Failed to send DM: ${error.response?.data?.message || error.message}`);
    }
  }

  /**
   * Get guild audit log
   * @param {string} guildId - Discord guild ID
   * @param {Object} options - Query options
   * @returns {Promise<Object>} Audit log data
   */
  async getAuditLog(guildId, options = {}) {
    try {
      const response = await this.api.get(`/guilds/${guildId}/audit-logs`, {
        params: options
      });
      return response.data;
    } catch (error) {
      throw new Error(`Failed to get audit log: ${error.response?.data?.message || error.message}`);
    }
  }

  /**
   * Create guild role
   * @param {string} guildId - Discord guild ID
   * @param {Object} roleData - Role data
   * @returns {Promise<Object>} Created role
   */
  async createRole(guildId, roleData) {
    try {
      const response = await this.api.post(`/guilds/${guildId}/roles`, roleData);
      return response.data;
    } catch (error) {
      throw new Error(`Failed to create role: ${error.response?.data?.message || error.message}`);
    }
  }

  /**
   * Delete guild role
   * @param {string} guildId - Discord guild ID
   * @param {string} roleId - Role ID
   * @returns {Promise<void>}
   */
  async deleteRole(guildId, roleId) {
    try {
      await this.api.delete(`/guilds/${guildId}/roles/${roleId}`);
    } catch (error) {
      throw new Error(`Failed to delete role: ${error.response?.data?.message || error.message}`);
    }
  }

  /**
   * Bulk delete messages
   * @param {string} channelId - Channel ID
   * @param {Array<string>} messageIds - Message IDs to delete
   * @returns {Promise<void>}
   */
  async bulkDeleteMessages(channelId, messageIds) {
    try {
      if (messageIds.length === 1) {
        await this.deleteMessage(channelId, messageIds[0]);
      } else {
        await this.api.post(`/channels/${channelId}/messages/bulk-delete`, {
          messages: messageIds
        });
      }
    } catch (error) {
      throw new Error(`Failed to bulk delete messages: ${error.response?.data?.message || error.message}`);
    }
  }

  /**
   * Create invite
   * @param {string} channelId - Channel ID
   * @param {Object} options - Invite options
   * @returns {Promise<Object>} Created invite
   */
  async createInvite(channelId, options = {}) {
    try {
      const response = await this.api.post(`/channels/${channelId}/invites`, {
        max_age: options.maxAge || 86400,
        max_uses: options.maxUses || 0,
        temporary: options.temporary || false,
        unique: options.unique || true
      });
      return response.data;
    } catch (error) {
      throw new Error(`Failed to create invite: ${error.response?.data?.message || error.message}`);
    }
  }

  /**
   * Get guild invites
   * @param {string} guildId - Guild ID
   * @returns {Promise<Array>} Array of invites
   */
  async getGuildInvites(guildId) {
    try {
      const response = await this.api.get(`/guilds/${guildId}/invites`);
      return response.data;
    } catch (error) {
      throw new Error(`Failed to get invites: ${error.response?.data?.message || error.message}`);
    }
  }
}

export default new DiscordService();
