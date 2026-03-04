import express from 'express';
import { authenticateJWT } from '../middleware/auth.js';
import { requireManageServer } from '../middleware/permissions.js';
import { apiLimiter } from '../middleware/rateLimiter.js';
import { CustomCommand, ActivityLog } from '../models/index.js';

const router = express.Router({ mergeParams: true });

router.get('/', authenticateJWT, requireManageServer, apiLimiter, async (req, res) => {
  try {
    const { guildId } = req.params;
    const { category, enabled, page = 1, limit = 20, search } = req.query;

    const query = { guildId };

    if (category) query.category = category;
    if (enabled !== undefined) query.isEnabled = enabled === 'true';
    if (search) {
      query.$or = [
        { name: { $regex: search, $options: 'i' } },
        { description: { $regex: search, $options: 'i' } }
      ];
    }

    const skip = (parseInt(page) - 1) * parseInt(limit);

    const [commands, total] = await Promise.all([
      CustomCommand.find(query)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(parseInt(limit))
        .select('-__v'),
      CustomCommand.countDocuments(query)
    ]);

    const categories = await CustomCommand.distinct('category', { guildId });

    res.json({
      success: true,
      data: {
        commands: commands.map(cmd => ({
          id: cmd._id,
          commandId: cmd.commandId,
          name: cmd.name,
          description: cmd.description,
          type: cmd.type,
          category: cmd.category,
          aliases: cmd.aliases,
          isEnabled: cmd.isEnabled,
          isSlashCommand: cmd.isSlashCommand,
          usage: cmd.usage,
          createdBy: cmd.createdBy,
          createdAt: cmd.createdAt,
          updatedAt: cmd.updatedAt
        })),
        categories,
        pagination: {
          page: parseInt(page),
          limit: parseInt(limit),
          total,
          pages: Math.ceil(total / parseInt(limit))
        }
      }
    });
  } catch (error) {
    console.error('Get Custom Commands Error:', error);
    res.status(500).json({
      success: false,
      error: 'Internal Server Error',
      message: 'Failed to fetch custom commands'
    });
  }
});

router.get('/:commandId', authenticateJWT, requireManageServer, apiLimiter, async (req, res) => {
  try {
    const { guildId, commandId } = req.params;

    const command = await CustomCommand.findOne({ guildId, commandId })
      .select('-__v');

    if (!command) {
      return res.status(404).json({
        success: false,
        error: 'Not Found',
        message: 'Custom command not found'
      });
    }

    res.json({
      success: true,
      data: { command }
    });
  } catch (error) {
    console.error('Get Custom Command Error:', error);
    res.status(500).json({
      success: false,
      error: 'Internal Server Error',
      message: 'Failed to fetch custom command'
    });
  }
});

router.post('/', authenticateJWT, requireManageServer, apiLimiter, async (req, res) => {
  try {
    const { guildId } = req.params;
    const {
      name,
      description,
      type = 'text',
      category = 'general',
      aliases = [],
      mainResponse,
      responses = [],
      variables = [],
      cooldown = {},
      permissions = {},
      actions = {},
      isSlashCommand = false,
      slashOptions = []
    } = req.body;

    if (!name || !mainResponse) {
      return res.status(400).json({
        success: false,
        error: 'Bad Request',
        message: 'name and mainResponse are required'
      });
    }

    const existingCommand = await CustomCommand.findOne({
      guildId,
      $or: [
        { name: name.toLowerCase() },
        { aliases: name.toLowerCase() }
      ]
    });

    if (existingCommand) {
      return res.status(409).json({
        success: false,
        error: 'Conflict',
        message: 'A command with this name or alias already exists'
      });
    }

    const commandId = CustomCommand.generateCommandId();

    const command = new CustomCommand({
      guildId,
      commandId,
      name: name.toLowerCase(),
      description: description || 'A custom command',
      type,
      category,
      aliases: aliases.map(a => a.toLowerCase()),
      mainResponse,
      responses,
      variables,
      cooldown,
      permissions,
      actions,
      isSlashCommand,
      slashOptions,
      createdBy: {
        userId: req.user.id,
        username: req.user.username
      }
    });

    await command.save();

    await ActivityLog.createLog({
      guildId,
      type: 'dashboard_action',
      severity: 'low',
      actor: {
        userId: req.user.id,
        username: req.user.username,
        avatar: req.user.avatar
      },
      details: {
        description: `Created custom command: ${name}`
      },
      relatedEntities: { commandId },
      source: { type: 'dashboard' }
    });

    res.status(201).json({
      success: true,
      data: { command }
    });
  } catch (error) {
    console.error('Create Custom Command Error:', error);
    res.status(500).json({
      success: false,
      error: 'Internal Server Error',
      message: 'Failed to create custom command'
    });
  }
});

router.patch('/:commandId', authenticateJWT, requireManageServer, apiLimiter, async (req, res) => {
  try {
    const { guildId, commandId } = req.params;
    const updates = req.body;

    const allowedFields = ['description', 'type', 'category', 'aliases', 'mainResponse', 'responses', 'variables', 'cooldown', 'permissions', 'actions', 'isSlashCommand', 'slashOptions'];
    const filteredUpdates = {};

    for (const field of allowedFields) {
      if (updates[field] !== undefined) {
        filteredUpdates[field] = updates[field];
      }
    }

    if (Object.keys(filteredUpdates).length === 0) {
      return res.status(400).json({
        success: false,
        error: 'Bad Request',
        message: 'No valid fields to update'
      });
    }

    filteredUpdates.updatedBy = {
      userId: req.user.id,
      username: req.user.username
    };

    const command = await CustomCommand.findOneAndUpdate(
      { guildId, commandId },
      { $set: filteredUpdates },
      { new: true }
    );

    if (!command) {
      return res.status(404).json({
        success: false,
        error: 'Not Found',
        message: 'Custom command not found'
      });
    }

    await ActivityLog.createLog({
      guildId,
      type: 'dashboard_action',
      severity: 'low',
      actor: {
        userId: req.user.id,
        username: req.user.username,
        avatar: req.user.avatar
      },
      details: {
        description: `Updated custom command: ${command.name}`
      },
      relatedEntities: { commandId },
      source: { type: 'dashboard' }
    });

    res.json({
      success: true,
      data: { command }
    });
  } catch (error) {
    console.error('Update Custom Command Error:', error);
    res.status(500).json({
      success: false,
      error: 'Internal Server Error',
      message: 'Failed to update custom command'
    });
  }
});

router.delete('/:commandId', authenticateJWT, requireManageServer, apiLimiter, async (req, res) => {
  try {
    const { guildId, commandId } = req.params;

    const command = await CustomCommand.findOneAndDelete({ guildId, commandId });

    if (!command) {
      return res.status(404).json({
        success: false,
        error: 'Not Found',
        message: 'Custom command not found'
      });
    }

    await ActivityLog.createLog({
      guildId,
      type: 'dashboard_action',
      severity: 'medium',
      actor: {
        userId: req.user.id,
        username: req.user.username,
        avatar: req.user.avatar
      },
      details: {
        description: `Deleted custom command: ${command.name}`
      },
      relatedEntities: { commandId },
      source: { type: 'dashboard' }
    });

    res.json({
      success: true,
      message: 'Custom command deleted successfully'
    });
  } catch (error) {
    console.error('Delete Custom Command Error:', error);
    res.status(500).json({
      success: false,
      error: 'Internal Server Error',
      message: 'Failed to delete custom command'
    });
  }
});

router.post('/:commandId/toggle', authenticateJWT, requireManageServer, apiLimiter, async (req, res) => {
  try {
    const { guildId, commandId } = req.params;

    const command = await CustomCommand.findOne({ guildId, commandId });

    if (!command) {
      return res.status(404).json({
        success: false,
        error: 'Not Found',
        message: 'Custom command not found'
      });
    }

    const isEnabled = await command.toggle();

    await ActivityLog.createLog({
      guildId,
      type: 'dashboard_action',
      severity: 'low',
      actor: {
        userId: req.user.id,
        username: req.user.username,
        avatar: req.user.avatar
      },
      details: {
        description: `${isEnabled ? 'Enabled' : 'Disabled'} custom command: ${command.name}`
      },
      relatedEntities: { commandId },
      source: { type: 'dashboard' }
    });

    res.json({
      success: true,
      data: { command, isEnabled }
    });
  } catch (error) {
    console.error('Toggle Custom Command Error:', error);
    res.status(500).json({
      success: false,
      error: 'Internal Server Error',
      message: 'Failed to toggle custom command'
    });
  }
});

router.post('/:commandId/alias', authenticateJWT, requireManageServer, apiLimiter, async (req, res) => {
  try {
    const { guildId, commandId } = req.params;
    const { alias } = req.body;

    if (!alias) {
      return res.status(400).json({
        success: false,
        error: 'Bad Request',
        message: 'Alias is required'
      });
    }

    const command = await CustomCommand.findOne({ guildId, commandId });

    if (!command) {
      return res.status(404).json({
        success: false,
        error: 'Not Found',
        message: 'Custom command not found'
      });
    }

    const aliases = await command.addAlias(alias.toLowerCase());

    res.json({
      success: true,
      data: { command, aliases }
    });
  } catch (error) {
    console.error('Add Alias Error:', error);
    res.status(500).json({
      success: false,
      error: 'Internal Server Error',
      message: 'Failed to add alias'
    });
  }
});

router.delete('/:commandId/alias/:alias', authenticateJWT, requireManageServer, apiLimiter, async (req, res) => {
  try {
    const { guildId, commandId, alias } = req.params;

    const command = await CustomCommand.findOne({ guildId, commandId });

    if (!command) {
      return res.status(404).json({
        success: false,
        error: 'Not Found',
        message: 'Custom command not found'
      });
    }

    const aliases = await command.removeAlias(alias.toLowerCase());

    res.json({
      success: true,
      data: { command, aliases }
    });
  } catch (error) {
    console.error('Remove Alias Error:', error);
    res.status(500).json({
      success: false,
      error: 'Internal Server Error',
      message: 'Failed to remove alias'
    });
  }
});

export default router;
