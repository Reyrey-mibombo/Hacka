import { CustomCommand } from '../models/index.js';

/**
 * Service for processing custom commands
 */
class CustomCommandService {
  /**
   * Create a new custom command
   * @param {Object} commandData - Command data
   * @returns {Promise<CustomCommand>} Created command
   */
  async createCommand(commandData) {
    try {
      // Check if command already exists
      const existing = await CustomCommand.findByName(commandData.guildId, commandData.name);

      if (existing) {
        throw new Error('A command with this name already exists');
      }

      const commandId = CustomCommand.generateCommandId();

      const command = new CustomCommand({
        guildId: commandData.guildId,
        commandId,
        name: commandData.name.toLowerCase(),
        description: commandData.description || 'A custom command',
        type: commandData.type || 'text',
        category: commandData.category || 'general',
        aliases: commandData.aliases || [],
        responses: commandData.responses || [],
        mainResponse: commandData.mainResponse || { content: '' },
        variables: commandData.variables || [],
        cooldown: commandData.cooldown || { enabled: false, duration: 5000 },
        permissions: commandData.permissions || { enabled: false },
        actions: commandData.actions || {},
        isSlashCommand: commandData.isSlashCommand || false,
        slashOptions: commandData.slashOptions || [],
        createdBy: {
          userId: commandData.createdBy.userId,
          username: commandData.createdBy.username
        }
      });

      await command.save();
      return command;
    } catch (error) {
      throw new Error(`Failed to create command: ${error.message}`);
    }
  }

  /**
   * Get command by ID
   * @param {string} commandId - Command ID
   * @returns {Promise<CustomCommand|null>} Command or null
   */
  async getCommand(commandId) {
    return CustomCommand.findOne({ commandId });
  }

  /**
   * Get command by name
   * @param {string} guildId - Discord guild ID
   * @param {string} name - Command name
   * @returns {Promise<CustomCommand|null>} Command or null
   */
  async getCommandByName(guildId, name) {
    return CustomCommand.findByName(guildId, name);
  }

  /**
   * Get all commands for a guild
   * @param {string} guildId - Discord guild ID
   * @param {Object} options - Query options
   * @returns {Promise<Array>} Array of commands
   */
  async getGuildCommands(guildId, options = {}) {
    const {
      category = null,
      enabledOnly = false,
      limit = 100,
      skip = 0
    } = options;

    const filter = { guildId };

    if (category) filter.category = category;
    if (enabledOnly) filter.isEnabled = true;

    return CustomCommand.find(filter)
      .sort({ name: 1 })
      .skip(skip)
      .limit(limit);
  }

  /**
   * Update a command
   * @param {string} commandId - Command ID
   * @param {Object} updates - Updates to apply
   * @param {Object} updatedBy - User making the update
   * @returns {Promise<CustomCommand>} Updated command
   */
  async updateCommand(commandId, updates, updatedBy) {
    const command = await CustomCommand.findOneAndUpdate(
      { commandId },
      {
        $set: updates,
        updatedBy: {
          userId: updatedBy.userId,
          username: updatedBy.username
        }
      },
      { new: true }
    );

    if (!command) {
      throw new Error('Command not found');
    }

    return command;
  }

  /**
   * Delete a command
   * @param {string} commandId - Command ID
   * @returns {Promise<boolean>} True if deleted
   */
  async deleteCommand(commandId) {
    const result = await CustomCommand.deleteOne({ commandId });
    return result.deletedCount > 0;
  }

  /**
   * Toggle command enabled status
   * @param {string} commandId - Command ID
   * @returns {Promise<CustomCommand>} Updated command
   */
  async toggleCommand(commandId) {
    const command = await CustomCommand.findOne({ commandId });

    if (!command) {
      throw new Error('Command not found');
    }

    await command.toggle();
    return command;
  }

  /**
   * Execute a command
   * @param {string} guildId - Discord guild ID
   * @param {string} commandName - Command name
   * @param {Object} context - Execution context
   * @returns {Promise<Object>} Command response
   */
  async executeCommand(guildId, commandName, context) {
    const command = await CustomCommand.findByName(guildId, commandName);

    if (!command) {
      throw new Error('Command not found');
    }

    if (!command.isEnabled) {
      throw new Error('Command is disabled');
    }

    // Check cooldown
    const cooldownCheck = command.checkCooldown(context.userId, context.userRoles || []);
    if (cooldownCheck.onCooldown) {
      throw new Error(`Command is on cooldown. Try again in ${Math.ceil(cooldownCheck.duration / 1000)} seconds.`);
    }

    // Check permissions
    const permissionCheck = command.checkPermissions(
      context.userId,
      context.userRoles || [],
      context.userPermissions || [],
      context.channelId
    );

    if (!permissionCheck.allowed) {
      throw new Error(permissionCheck.reason || 'You do not have permission to use this command');
    }

    // Execute command
    const response = await command.execute(context.userId, guildId, context);

    return {
      response,
      actions: command.actions,
      deleteTrigger: command.actions.deleteTrigger,
      deleteAfter: command.actions.deleteAfter
    };
  }

  /**
   * Add alias to command
   * @param {string} commandId - Command ID
   * @param {string} alias - Alias to add
   * @returns {Promise<CustomCommand>} Updated command
   */
  async addAlias(commandId, alias) {
    const command = await CustomCommand.findOne({ commandId });

    if (!command) {
      throw new Error('Command not found');
    }

    await command.addAlias(alias.toLowerCase());
    return command;
  }

  /**
   * Remove alias from command
   * @param {string} commandId - Command ID
   * @param {string} alias - Alias to remove
   * @returns {Promise<CustomCommand>} Updated command
   */
  async removeAlias(commandId, alias) {
    const command = await CustomCommand.findOne({ commandId });

    if (!command) {
      throw new Error('Command not found');
    }

    await command.removeAlias(alias);
    return command;
  }

  /**
   * Add response to command
   * @param {string} commandId - Command ID
   * @param {Object} response - Response data
   * @returns {Promise<CustomCommand>} Updated command
   */
  async addResponse(commandId, response) {
    const command = await CustomCommand.findOne({ commandId });

    if (!command) {
      throw new Error('Command not found');
    }

    await command.addResponse(response);
    return command;
  }

  /**
   * Update command cooldown
   * @param {string} commandId - Command ID
   * @param {Object} cooldown - Cooldown settings
   * @returns {Promise<CustomCommand>} Updated command
   */
  async updateCooldown(commandId, cooldown) {
    const command = await CustomCommand.findOneAndUpdate(
      { commandId },
      { $set: { cooldown } },
      { new: true }
    );

    if (!command) {
      throw new Error('Command not found');
    }

    return command;
  }

  /**
   * Update command permissions
   * @param {string} commandId - Command ID
   * @param {Object} permissions - Permission settings
   * @returns {Promise<CustomCommand>} Updated command
   */
  async updatePermissions(commandId, permissions) {
    const command = await CustomCommand.findOneAndUpdate(
      { commandId },
      { $set: { permissions } },
      { new: true }
    );

    if (!command) {
      throw new Error('Command not found');
    }

    return command;
  }

  /**
   * Update command actions
   * @param {string} commandId - Command ID
   * @param {Object} actions - Action settings
   * @returns {Promise<CustomCommand>} Updated command
   */
  async updateActions(commandId, actions) {
    const command = await CustomCommand.findOneAndUpdate(
      { commandId },
      { $set: { actions } },
      { new: true }
    );

    if (!command) {
      throw new Error('Command not found');
    }

    return command;
  }

  /**
   * Convert command to slash command
   * @param {string} commandId - Command ID
   * @param {Array} options - Slash command options
   * @returns {Promise<CustomCommand>} Updated command
   */
  async convertToSlash(commandId, options = []) {
    const command = await CustomCommand.findOneAndUpdate(
      { commandId },
      {
        $set: {
          isSlashCommand: true,
          slashOptions: options
        }
      },
      { new: true }
    );

    if (!command) {
      throw new Error('Command not found');
    }

    return command;
  }

  /**
   * Duplicate a command
   * @param {string} commandId - Command ID to duplicate
   * @param {string} newName - New command name
   * @param {Object} createdBy - User creating the duplicate
   * @returns {Promise<CustomCommand>} Duplicated command
   */
  async duplicateCommand(commandId, newName, createdBy) {
    const original = await CustomCommand.findOne({ commandId });

    if (!original) {
      throw new Error('Command not found');
    }

    const commandData = {
      guildId: original.guildId,
      name: newName.toLowerCase(),
      description: original.description,
      type: original.type,
      category: original.category,
      aliases: original.aliases,
      responses: original.responses,
      mainResponse: original.mainResponse,
      variables: original.variables,
      cooldown: original.cooldown,
      permissions: original.permissions,
      actions: original.actions,
      isSlashCommand: false,
      createdBy
    };

    return this.createCommand(commandData);
  }

  /**
   * Search commands
   * @param {string} guildId - Discord guild ID
   * @param {string} query - Search query
   * @returns {Promise<Array>} Matching commands
   */
  async searchCommands(guildId, query) {
    return CustomCommand.find({
      guildId,
      $or: [
        { name: { $regex: query, $options: 'i' } },
        { description: { $regex: query, $options: 'i' } },
        { aliases: { $in: [new RegExp(query, 'i')] } }
      ]
    }).limit(20);
  }

  /**
   * Get command categories for guild
   * @param {string} guildId - Discord guild ID
   * @returns {Promise<Array>} Array of categories
   */
  async getCategories(guildId) {
    const categories = await CustomCommand.distinct('category', { guildId });
    return categories;
  }

  /**
   * Get most used commands
   * @param {string} guildId - Discord guild ID
   * @param {number} limit - Number of results
   * @returns {Promise<Array>} Most used commands
   */
  async getMostUsed(guildId, limit = 10) {
    return CustomCommand.find({ guildId })
      .sort({ 'usage.count': -1 })
      .limit(limit)
      .select('name description usage category');
  }

  /**
   * Get command statistics
   * @param {string} guildId - Discord guild ID
   * @returns {Promise<Object>} Command statistics
   */
  async getCommandStats(guildId) {
    const stats = await CustomCommand.aggregate([
      { $match: { guildId } },
      {
        $group: {
          _id: null,
          total: { $sum: 1 },
          enabled: { $sum: { $cond: ['$isEnabled', 1, 0] } },
          disabled: { $sum: { $cond: ['$isEnabled', 0, 1] } },
          slashCommands: { $sum: { $cond: ['$isSlashCommand', 1, 0] } },
          totalUsage: { $sum: '$usage.count' }
        }
      }
    ]);

    const categoryStats = await CustomCommand.aggregate([
      { $match: { guildId } },
      {
        $group: {
          _id: '$category',
          count: { $sum: 1 }
        }
      }
    ]);

    return {
      total: stats[0]?.total || 0,
      enabled: stats[0]?.enabled || 0,
      disabled: stats[0]?.disabled || 0,
      slashCommands: stats[0]?.slashCommands || 0,
      totalUsage: stats[0]?.totalUsage || 0,
      byCategory: categoryStats.reduce((acc, c) => {
        acc[c._id] = c.count;
        return acc;
      }, {})
    };
  }

  /**
   * Bulk enable/disable commands
   * @param {string} guildId - Discord guild ID
   * @param {Array} commandIds - Command IDs
   * @param {boolean} enabled - Enable or disable
   * @returns {Promise<number>} Number of commands updated
   */
  async bulkToggle(guildId, commandIds, enabled) {
    const result = await CustomCommand.updateMany(
      {
        guildId,
        commandId: { $in: commandIds }
      },
      { $set: { isEnabled: enabled } }
    );

    return result.modifiedCount;
  }

  /**
   * Bulk delete commands
   * @param {string} guildId - Discord guild ID
   * @param {Array} commandIds - Command IDs
   * @returns {Promise<number>} Number of commands deleted
   */
  async bulkDelete(guildId, commandIds) {
    const result = await CustomCommand.deleteMany({
      guildId,
      commandId: { $in: commandIds }
    });

    return result.deletedCount;
  }
}

export default new CustomCommandService();
