import { SystemSettings } from '../models/index.js';

/**
 * Service for managing system settings
 */
class SystemSettingsService {
  /**
   * Get or create system settings for a guild
   * @param {string} guildId - Discord guild ID
   * @returns {Promise<SystemSettings>} System settings document
   */
  async getSettings(guildId) {
    return SystemSettings.getOrCreate(guildId);
  }

  /**
   * Update system settings
   * @param {string} guildId - Discord guild ID
   * @param {Object} updates - Settings updates
   * @param {Object} updatedBy - User making the update
   * @returns {Promise<SystemSettings>} Updated settings
   */
  async updateSettings(guildId, updates, updatedBy) {
    const settings = await SystemSettings.findOneAndUpdate(
      { guildId },
      {
        $set: updates,
        'updatedBy.userId': updatedBy.userId,
        'updatedBy.username': updatedBy.username
      },
      { new: true, upsert: true }
    );

    return settings;
  }

  /**
   * Update a specific module settings
   * @param {string} guildId - Discord guild ID
   * @param {string} moduleName - Module name
   * @param {Object} moduleUpdates - Module settings updates
   * @param {Object} updatedBy - User making the update
   * @returns {Promise<SystemSettings>} Updated settings
   */
  async updateModule(guildId, moduleName, moduleUpdates, updatedBy) {
    const settings = await SystemSettings.findOne({ guildId });

    if (!settings) {
      throw new Error('Settings not found');
    }

    return settings.updateModule(moduleName, moduleUpdates, updatedBy.userId, updatedBy.username);
  }

  /**
   * Toggle module enabled status
   * @param {string} guildId - Discord guild ID
   * @param {string} moduleName - Module name
   * @param {boolean} enabled - Whether to enable or disable
   * @returns {Promise<SystemSettings>} Updated settings
   */
  async toggleModule(guildId, moduleName, enabled) {
    const updatePath = `${moduleName}.enabled`;

    const settings = await SystemSettings.findOneAndUpdate(
      { guildId },
      { $set: { [updatePath]: enabled } },
      { new: true, upsert: true }
    );

    return settings;
  }

  /**
   * Check if a module is enabled
   * @param {string} guildId - Discord guild ID
   * @param {string} moduleName - Module name
   * @returns {Promise<boolean>} True if enabled
   */
  async isModuleEnabled(guildId, moduleName) {
    const settings = await SystemSettings.findOne({ guildId });

    if (!settings) return false;

    return settings.isModuleEnabled(moduleName);
  }

  // ==================== AUTOMOD SETTINGS ====================

  /**
   * Update automod settings
   * @param {string} guildId - Discord guild ID
   * @param {Object} automodSettings - Automod settings
   * @returns {Promise<SystemSettings>} Updated settings
   */
  async updateAutomodSettings(guildId, automodSettings) {
    const settings = await SystemSettings.findOneAndUpdate(
      { guildId },
      { $set: { automod: automodSettings } },
      { new: true, upsert: true }
    );

    return settings;
  }

  /**
   * Update specific automod rule
   * @param {string} guildId - Discord guild ID
   * @param {string} ruleName - Rule name (spam, mentions, invites, etc.)
   * @param {Object} ruleSettings - Rule settings
   * @returns {Promise<SystemSettings>} Updated settings
   */
  async updateAutomodRule(guildId, ruleName, ruleSettings) {
    const updatePath = `automod.rules.${ruleName}`;

    const settings = await SystemSettings.findOneAndUpdate(
      { guildId },
      { $set: { [updatePath]: ruleSettings } },
      { new: true }
    );

    return settings;
  }

  // ==================== WELCOME SETTINGS ====================

  /**
   * Update welcome settings
   * @param {string} guildId - Discord guild ID
   * @param {Object} welcomeSettings - Welcome settings
   * @returns {Promise<SystemSettings>} Updated settings
   */
  async updateWelcomeSettings(guildId, welcomeSettings) {
    const settings = await SystemSettings.findOneAndUpdate(
      { guildId },
      { $set: { welcome: welcomeSettings } },
      { new: true, upsert: true }
    );

    return settings;
  }

  /**
   * Update goodbye settings
   * @param {string} guildId - Discord guild ID
   * @param {Object} goodbyeSettings - Goodbye settings
   * @returns {Promise<SystemSettings>} Updated settings
   */
  async updateGoodbyeSettings(guildId, goodbyeSettings) {
    const settings = await SystemSettings.findOneAndUpdate(
      { guildId },
      { $set: { goodbye: goodbyeSettings } },
      { new: true, upsert: true }
    );

    return settings;
  }

  // ==================== TICKET SETTINGS ====================

  /**
   * Update ticket settings
   * @param {string} guildId - Discord guild ID
   * @param {Object} ticketSettings - Ticket settings
   * @returns {Promise<SystemSettings>} Updated settings
   */
  async updateTicketSettings(guildId, ticketSettings) {
    const settings = await SystemSettings.findOneAndUpdate(
      { guildId },
      { $set: { tickets: ticketSettings } },
      { new: true, upsert: true }
    );

    return settings;
  }

  /**
   * Add ticket panel
   * @param {string} guildId - Discord guild ID
   * @param {Object} panel - Panel configuration
   * @returns {Promise<SystemSettings>} Updated settings
   */
  async addTicketPanel(guildId, panel) {
    const settings = await SystemSettings.findOneAndUpdate(
      { guildId },
      { $push: { 'tickets.panels': panel } },
      { new: true }
    );

    return settings;
  }

  /**
   * Remove ticket panel
   * @param {string} guildId - Discord guild ID
   * @param {string} panelName - Panel name
   * @returns {Promise<SystemSettings>} Updated settings
   */
  async removeTicketPanel(guildId, panelName) {
    const settings = await SystemSettings.findOneAndUpdate(
      { guildId },
      { $pull: { 'tickets.panels': { name: panelName } } },
      { new: true }
    );

    return settings;
  }

  // ==================== LOGGING SETTINGS ====================

  /**
   * Update logging settings
   * @param {string} guildId - Discord guild ID
   * @param {Object} loggingSettings - Logging settings
   * @returns {Promise<SystemSettings>} Updated settings
   */
  async updateLoggingSettings(guildId, loggingSettings) {
    const settings = await SystemSettings.findOneAndUpdate(
      { guildId },
      { $set: { logging: loggingSettings } },
      { new: true, upsert: true }
    );

    return settings;
  }

  /**
   * Toggle logging event
   * @param {string} guildId - Discord guild ID
   * @param {string} eventName - Event name
   * @param {boolean} enabled - Whether to enable
   * @returns {Promise<SystemSettings>} Updated settings
   */
  async toggleLoggingEvent(guildId, eventName, enabled) {
    const updatePath = `logging.events.${eventName}.enabled`;

    const settings = await SystemSettings.findOneAndUpdate(
      { guildId },
      { $set: { [updatePath]: enabled } },
      { new: true }
    );

    return settings;
  }

  // ==================== VERIFICATION SETTINGS ====================

  /**
   * Update verification settings
   * @param {string} guildId - Discord guild ID
   * @param {Object} verificationSettings - Verification settings
   * @returns {Promise<SystemSettings>} Updated settings
   */
  async updateVerificationSettings(guildId, verificationSettings) {
    const settings = await SystemSettings.findOneAndUpdate(
      { guildId },
      { $set: { verification: verificationSettings } },
      { new: true, upsert: true }
    );

    return settings;
  }

  // ==================== SUGGESTIONS SETTINGS ====================

  /**
   * Update suggestions settings
   * @param {string} guildId - Discord guild ID
   * @param {Object} suggestionsSettings - Suggestions settings
   * @returns {Promise<SystemSettings>} Updated settings
   */
  async updateSuggestionsSettings(guildId, suggestionsSettings) {
    const settings = await SystemSettings.findOneAndUpdate(
      { guildId },
      { $set: { suggestions: suggestionsSettings } },
      { new: true, upsert: true }
    );

    return settings;
  }

  // ==================== AUTOROLE SETTINGS ====================

  /**
   * Update autorole settings
   * @param {string} guildId - Discord guild ID
   * @param {Object} autoroleSettings - Autorole settings
   * @returns {Promise<SystemSettings>} Updated settings
   */
  async updateAutoroleSettings(guildId, autoroleSettings) {
    const settings = await SystemSettings.findOneAndUpdate(
      { guildId },
      { $set: { autorole: autoroleSettings } },
      { new: true, upsert: true }
    );

    return settings;
  }

  /**
   * Add autorole
   * @param {string} guildId - Discord guild ID
   * @param {string} roleId - Role ID
   * @param {boolean} isBotRole - Whether this is a bot role
   * @returns {Promise<SystemSettings>} Updated settings
   */
  async addAutorole(guildId, roleId, isBotRole = false) {
    const field = isBotRole ? 'autorole.botRoles' : 'autorole.roles';

    const settings = await SystemSettings.findOneAndUpdate(
      { guildId },
      { $addToSet: { [field]: roleId } },
      { new: true }
    );

    return settings;
  }

  /**
   * Remove autorole
   * @param {string} guildId - Discord guild ID
   * @param {string} roleId - Role ID
   * @param {boolean} isBotRole - Whether this is a bot role
   * @returns {Promise<SystemSettings>} Updated settings
   */
  async removeAutorole(guildId, roleId, isBotRole = false) {
    const field = isBotRole ? 'autorole.botRoles' : 'autorole.roles';

    const settings = await SystemSettings.findOneAndUpdate(
      { guildId },
      { $pull: { [field]: roleId } },
      { new: true }
    );

    return settings;
  }

  // ==================== BACKUP SETTINGS ====================

  /**
   * Update backup settings
   * @param {string} guildId - Discord guild ID
   * @param {Object} backupSettings - Backup settings
   * @returns {Promise<SystemSettings>} Updated settings
   */
  async updateBackupSettings(guildId, backupSettings) {
    const settings = await SystemSettings.findOneAndUpdate(
      { guildId },
      { $set: { backup: backupSettings } },
      { new: true, upsert: true }
    );

    return settings;
  }

  // ==================== UTILITY METHODS ====================

  /**
   * Reset all settings to default
   * @param {string} guildId - Discord guild ID
   * @param {Object} updatedBy - User resetting settings
   * @returns {Promise<SystemSettings>} Reset settings
   */
  async resetSettings(guildId, updatedBy) {
    await SystemSettings.deleteOne({ guildId });

    const newSettings = new SystemSettings({
      guildId,
      updatedBy: {
        userId: updatedBy.userId,
        username: updatedBy.username
      }
    });

    await newSettings.save();
    return newSettings;
  }

  /**
   * Export settings
   * @param {string} guildId - Discord guild ID
   * @returns {Promise<Object>} Settings export
   */
  async exportSettings(guildId) {
    const settings = await SystemSettings.findOne({ guildId });

    if (!settings) {
      throw new Error('Settings not found');
    }

    return {
      guildId: settings.guildId,
      automod: settings.automod,
      welcome: settings.welcome,
      goodbye: settings.goodbye,
      tickets: settings.tickets,
      logging: settings.logging,
      antispam: settings.antispam,
      suggestions: settings.suggestions,
      verification: settings.verification,
      autorole: settings.autorole,
      customCommands: settings.customCommands,
      backup: settings.backup,
      exportedAt: new Date()
    };
  }

  /**
   * Import settings
   * @param {string} guildId - Discord guild ID
   * @param {Object} settingsData - Settings to import
   * @param {Object} updatedBy - User importing settings
   * @returns {Promise<SystemSettings>} Imported settings
   */
  async importSettings(guildId, settingsData, updatedBy) {
    // Remove sensitive fields
    delete settingsData._id;
    delete settingsData.createdAt;
    delete settingsData.updatedAt;
    delete settingsData.exportedAt;

    settingsData.guildId = guildId;
    settingsData.updatedBy = {
      userId: updatedBy.userId,
      username: updatedBy.username
    };
    settingsData.lastUpdated = new Date();

    const settings = await SystemSettings.findOneAndUpdate(
      { guildId },
      { $set: settingsData },
      { new: true, upsert: true }
    );

    return settings;
  }

  /**
   * Get settings summary
   * @param {string} guildId - Discord guild ID
   * @returns {Promise<Object>} Settings summary
   */
  async getSettingsSummary(guildId) {
    const settings = await SystemSettings.findOne({ guildId });

    if (!settings) {
      return {
        guildId,
        modules: {
          automod: false,
          welcome: false,
          tickets: false,
          logging: false,
          antispam: false,
          suggestions: false,
          verification: false,
          autorole: false
        },
        lastUpdated: null
      };
    }

    return {
      guildId: settings.guildId,
      modules: {
        automod: settings.automod?.enabled || false,
        welcome: settings.welcome?.enabled || false,
        goodbye: settings.goodbye?.enabled || false,
        tickets: settings.tickets?.enabled || false,
        logging: settings.logging?.enabled || false,
        antispam: settings.antispam?.enabled || false,
        suggestions: settings.suggestions?.enabled || false,
        verification: settings.verification?.enabled || false,
        autorole: settings.autorole?.enabled || false
      },
      lastUpdated: settings.lastUpdated,
      updatedBy: settings.updatedBy
    };
  }
}

export default new SystemSettingsService();
