import { Guild } from '../models/index.js';

/**
 * Service for managing Discord guild operations
 */
class GuildService {
  /**
   * Create a new guild record
   * @param {Object} guildData - Guild data from Discord
   * @returns {Promise<Guild>} Created guild document
   */
  async createGuild(guildData) {
    try {
      const existingGuild = await Guild.findOne({ guildId: guildData.id });

      if (existingGuild) {
        return this.updateGuild(guildData.id, guildData);
      }

      const guild = new Guild({
        guildId: guildData.id,
        name: guildData.name,
        icon: guildData.icon,
        banner: guildData.banner,
        description: guildData.description,
        ownerId: guildData.owner_id,
        region: guildData.region,
        preferredLocale: guildData.preferred_locale,
        memberCount: guildData.member_count || 0,
        maxMembers: guildData.max_members || 250000,
        premiumTier: guildData.premium_tier || 0,
        premiumSubscriptionCount: guildData.premium_subscription_count || 0,
        features: guildData.features || [],
        afkChannelId: guildData.afk_channel_id,
        afkTimeout: guildData.afk_timeout,
        systemChannelId: guildData.system_channel_id,
        systemChannelFlags: guildData.system_channel_flags,
        rulesChannelId: guildData.rules_channel_id,
        publicUpdatesChannelId: guildData.public_updates_channel_id,
        verificationLevel: guildData.verification_level,
        defaultMessageNotifications: guildData.default_message_notifications,
        explicitContentFilter: guildData.explicit_content_filter,
        mfaLevel: guildData.mfa_level,
        nsfwLevel: guildData.nsfw_level,
        vanityURLCode: guildData.vanity_url_code
      });

      await guild.save();
      return guild;
    } catch (error) {
      throw new Error(`Failed to create guild: ${error.message}`);
    }
  }

  /**
   * Update existing guild record
   * @param {string} guildId - Discord guild ID
   * @param {Object} updateData - Guild data to update
   * @returns {Promise<Guild>} Updated guild document
   */
  async updateGuild(guildId, updateData) {
    try {
      const formattedData = {
        ...(updateData.name && { name: updateData.name }),
        ...(updateData.icon !== undefined && { icon: updateData.icon }),
        ...(updateData.banner !== undefined && { banner: updateData.banner }),
        ...(updateData.description !== undefined && { description: updateData.description }),
        ...(updateData.owner_id && { ownerId: updateData.owner_id }),
        ...(updateData.region && { region: updateData.region }),
        ...(updateData.preferred_locale && { preferredLocale: updateData.preferred_locale }),
        ...(updateData.member_count !== undefined && { memberCount: updateData.member_count }),
        ...(updateData.premium_tier !== undefined && { premiumTier: updateData.premium_tier }),
        ...(updateData.premium_subscription_count !== undefined && { premiumSubscriptionCount: updateData.premium_subscription_count }),
        ...(updateData.features && { features: updateData.features }),
        ...(updateData.afk_channel_id !== undefined && { afkChannelId: updateData.afk_channel_id }),
        ...(updateData.afk_timeout !== undefined && { afkTimeout: updateData.afk_timeout }),
        ...(updateData.system_channel_id !== undefined && { systemChannelId: updateData.system_channel_id }),
        ...(updateData.verification_level !== undefined && { verificationLevel: updateData.verification_level }),
        ...(updateData.vanity_url_code !== undefined && { vanityURLCode: updateData.vanity_url_code })
      };

      const guild = await Guild.findOneAndUpdate(
        { guildId },
        { $set: formattedData },
        { new: true, upsert: true }
      );

      return guild;
    } catch (error) {
      throw new Error(`Failed to update guild: ${error.message}`);
    }
  }

  /**
   * Get guild by ID
   * @param {string} guildId - Discord guild ID
   * @returns {Promise<Guild|null>} Guild document or null
   */
  async getGuild(guildId) {
    return Guild.findOne({ guildId });
  }

  /**
   * Get guild settings
   * @param {string} guildId - Discord guild ID
   * @returns {Promise<Object>} Guild settings object
   */
  async getGuildSettings(guildId) {
    const guild = await Guild.findOne({ guildId }).select('settings');

    if (!guild) {
      throw new Error('Guild not found');
    }

    return guild.settings;
  }

  /**
   * Update guild settings
   * @param {string} guildId - Discord guild ID
   * @param {Object} settings - Settings to update
   * @returns {Promise<Guild>} Updated guild
   */
  async updateGuildSettings(guildId, settings) {
    try {
      const guild = await Guild.findOneAndUpdate(
        { guildId },
        { $set: settings },
        { new: true, upsert: true }
      );

      return guild;
    } catch (error) {
      throw new Error(`Failed to update guild settings: ${error.message}`);
    }
  }

  /**
   * Update specific module settings
   * @param {string} guildId - Discord guild ID
   * @param {string} moduleName - Module name (e.g., 'leveling', 'economy', 'tickets')
   * @param {Object} moduleSettings - Module-specific settings
   * @returns {Promise<Guild>} Updated guild
   */
  async updateModuleSettings(guildId, moduleName, moduleSettings) {
    try {
      const updatePath = `settings.modules.${moduleName}`;

      const guild = await Guild.findOneAndUpdate(
        { guildId },
        { $set: { [updatePath]: moduleSettings } },
        { new: true }
      );

      if (!guild) {
        throw new Error('Guild not found');
      }

      return guild;
    } catch (error) {
      throw new Error(`Failed to update module settings: ${error.message}`);
    }
  }

  /**
   * Toggle bot status for guild
   * @param {string} guildId - Discord guild ID
   * @param {boolean} enabled - Whether bot should be enabled
   * @returns {Promise<Guild>} Updated guild
   */
  async toggleBotStatus(guildId, enabled) {
    const guild = await Guild.findOneAndUpdate(
      { guildId },
      { $set: { 'settings.botEnabled': enabled } },
      { new: true }
    );

    if (!guild) {
      throw new Error('Guild not found');
    }

    return guild;
  }

  /**
   * Check if bot is enabled for guild
   * @param {string} guildId - Discord guild ID
   * @returns {Promise<boolean>} True if bot is enabled
   */
  async isBotEnabled(guildId) {
    const guild = await Guild.findOne({ guildId }).select('settings.botEnabled');
    return guild?.settings?.botEnabled ?? true;
  }

  /**
   * Check if bot is present in guild via Discord API
   * @param {string} guildId - Discord guild ID
   * @param {string} botToken - Discord bot token
   * @returns {Promise<boolean>} True if bot is in guild
   */
  async checkBotStatus(guildId, botToken) {
    try {
      const axios = (await import('axios')).default;
      await axios.get(`https://discord.com/api/guilds/${guildId}`, {
        headers: {
          Authorization: `Bot ${botToken}`
        }
      });
      return true;
    } catch (error) {
      if (error.response?.status === 404 || error.response?.status === 403) {
        return false;
      }
      throw new Error(`Failed to check bot status: ${error.message}`);
    }
  }

  /**
   * Get guild statistics
   * @param {string} guildId - Discord guild ID
   * @returns {Promise<Object>} Guild statistics
   */
  async getGuildStats(guildId) {
    const guild = await Guild.findOne({ guildId }).select('statistics');

    if (!guild) {
      throw new Error('Guild not found');
    }

    return guild.statistics;
  }

  /**
   * Increment guild statistic
   * @param {string} guildId - Discord guild ID
   * @param {string} statName - Statistic name
   * @returns {Promise<void>}
   */
  async incrementStat(guildId, statName) {
    await Guild.findOneAndUpdate(
      { guildId },
      {
        $inc: { [`statistics.${statName}`]: 1 },
        $set: { [`statistics.last${statName.charAt(0).toUpperCase() + statName.slice(1)}At`]: new Date() }
      }
    );
  }

  /**
   * Add user to guild blacklist
   * @param {string} guildId - Discord guild ID
   * @param {string} userId - User ID to blacklist
   * @param {string} reason - Reason for blacklist
   * @param {string} addedBy - User ID who added to blacklist
   * @param {Date} [expiresAt] - Optional expiration date
   * @returns {Promise<Guild>} Updated guild
   */
  async addToBlacklist(guildId, userId, reason, addedBy, expiresAt = null) {
    const blacklistEntry = {
      userId,
      reason,
      addedAt: new Date(),
      addedBy,
      expiresAt
    };

    const guild = await Guild.findOneAndUpdate(
      { guildId },
      { $push: { blacklistedUsers: blacklistEntry } },
      { new: true }
    );

    if (!guild) {
      throw new Error('Guild not found');
    }

    return guild;
  }

  /**
   * Remove user from guild blacklist
   * @param {string} guildId - Discord guild ID
   * @param {string} userId - User ID to remove
   * @returns {Promise<Guild>} Updated guild
   */
  async removeFromBlacklist(guildId, userId) {
    const guild = await Guild.findOneAndUpdate(
      { guildId },
      { $pull: { blacklistedUsers: { userId } } },
      { new: true }
    );

    if (!guild) {
      throw new Error('Guild not found');
    }

    return guild;
  }

  /**
   * Check if user is blacklisted
   * @param {string} guildId - Discord guild ID
   * @param {string} userId - User ID to check
   * @returns {Promise<boolean>} True if user is blacklisted
   */
  async isUserBlacklisted(guildId, userId) {
    const guild = await Guild.findOne({
      guildId,
      'blacklistedUsers.userId': userId,
      $or: [
        { 'blacklistedUsers.expiresAt': null },
        { 'blacklistedUsers.expiresAt': { $gt: new Date() } }
      ]
    });

    return !!guild;
  }

  /**
   * Get all guilds with filter
   * @param {Object} filter - Query filter
   * @param {Object} options - Query options
   * @returns {Promise<Array>} Array of guilds
   */
  async getGuilds(filter = {}, options = {}) {
    const { limit = 50, skip = 0, sort = { createdAt: -1 } } = options;

    return Guild.find(filter)
      .sort(sort)
      .skip(skip)
      .limit(limit);
  }

  /**
   * Delete guild record
   * @param {string} guildId - Discord guild ID
   * @returns {Promise<boolean>} True if deleted
   */
  async deleteGuild(guildId) {
    const result = await Guild.deleteOne({ guildId });
    return result.deletedCount > 0;
  }
}

export default new GuildService();
