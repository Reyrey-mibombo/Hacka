import express from 'express';
import { authenticateJWT } from '../middleware/auth.js';
import { requireManageServer } from '../middleware/permissions.js';
import { apiLimiter } from '../middleware/rateLimiter.js';
import { SystemSettings, ActivityLog } from '../models/index.js';

const router = express.Router({ mergeParams: true });

router.get('/automod', authenticateJWT, requireManageServer, apiLimiter, async (req, res) => {
  try {
    const { guildId } = req.params;

    const settings = await SystemSettings.getOrCreate(guildId);

    res.json({
      success: true,
      data: { automod: settings.automod }
    });
  } catch (error) {
    console.error('Get Automod Settings Error:', error);
    res.status(500).json({
      success: false,
      error: 'Internal Server Error',
      message: 'Failed to fetch automod settings'
    });
  }
});

router.patch('/automod', authenticateJWT, requireManageServer, apiLimiter, async (req, res) => {
  try {
    const { guildId } = req.params;
    const updates = req.body;

    const settings = await SystemSettings.getOrCreate(guildId);

    Object.assign(settings.automod, updates);
    settings.updatedBy = { userId: req.user.id, username: req.user.username };

    await settings.save();

    await ActivityLog.createLog({
      guildId,
      type: 'settings_changed',
      severity: 'medium',
      actor: {
        userId: req.user.id,
        username: req.user.username,
        avatar: req.user.avatar
      },
      details: {
        description: 'Updated automod settings'
      },
      source: { type: 'dashboard' }
    });

    res.json({
      success: true,
      data: { automod: settings.automod }
    });
  } catch (error) {
    console.error('Update Automod Settings Error:', error);
    res.status(500).json({
      success: false,
      error: 'Internal Server Error',
      message: 'Failed to update automod settings'
    });
  }
});

router.get('/welcome', authenticateJWT, requireManageServer, apiLimiter, async (req, res) => {
  try {
    const { guildId } = req.params;

    const settings = await SystemSettings.getOrCreate(guildId);

    res.json({
      success: true,
      data: {
        welcome: settings.welcome,
        goodbye: settings.goodbye
      }
    });
  } catch (error) {
    console.error('Get Welcome Settings Error:', error);
    res.status(500).json({
      success: false,
      error: 'Internal Server Error',
      message: 'Failed to fetch welcome settings'
    });
  }
});

router.patch('/welcome', authenticateJWT, requireManageServer, apiLimiter, async (req, res) => {
  try {
    const { guildId } = req.params;
    const updates = req.body;

    const settings = await SystemSettings.getOrCreate(guildId);

    if (updates.welcome) {
      Object.assign(settings.welcome, updates.welcome);
    }
    if (updates.goodbye) {
      Object.assign(settings.goodbye, updates.goodbye);
    }

    settings.updatedBy = { userId: req.user.id, username: req.user.username };
    await settings.save();

    await ActivityLog.createLog({
      guildId,
      type: 'settings_changed',
      severity: 'low',
      actor: {
        userId: req.user.id,
        username: req.user.username,
        avatar: req.user.avatar
      },
      details: {
        description: 'Updated welcome/goodbye settings'
      },
      source: { type: 'dashboard' }
    });

    res.json({
      success: true,
      data: {
        welcome: settings.welcome,
        goodbye: settings.goodbye
      }
    });
  } catch (error) {
    console.error('Update Welcome Settings Error:', error);
    res.status(500).json({
      success: false,
      error: 'Internal Server Error',
      message: 'Failed to update welcome settings'
    });
  }
});

router.get('/autorole', authenticateJWT, requireManageServer, apiLimiter, async (req, res) => {
  try {
    const { guildId } = req.params;

    const settings = await SystemSettings.getOrCreate(guildId);

    res.json({
      success: true,
      data: { autorole: settings.autorole }
    });
  } catch (error) {
    console.error('Get Autorole Settings Error:', error);
    res.status(500).json({
      success: false,
      error: 'Internal Server Error',
      message: 'Failed to fetch autorole settings'
    });
  }
});

router.patch('/autorole', authenticateJWT, requireManageServer, apiLimiter, async (req, res) => {
  try {
    const { guildId } = req.params;
    const updates = req.body;

    const settings = await SystemSettings.getOrCreate(guildId);

    Object.assign(settings.autorole, updates);
    settings.updatedBy = { userId: req.user.id, username: req.user.username };

    await settings.save();

    await ActivityLog.createLog({
      guildId,
      type: 'settings_changed',
      severity: 'low',
      actor: {
        userId: req.user.id,
        username: req.user.username,
        avatar: req.user.avatar
      },
      details: {
        description: 'Updated autorole settings'
      },
      source: { type: 'dashboard' }
    });

    res.json({
      success: true,
      data: { autorole: settings.autorole }
    });
  } catch (error) {
    console.error('Update Autorole Settings Error:', error);
    res.status(500).json({
      success: false,
      error: 'Internal Server Error',
      message: 'Failed to update autorole settings'
    });
  }
});

router.get('/logging', authenticateJWT, requireManageServer, apiLimiter, async (req, res) => {
  try {
    const { guildId } = req.params;

    const settings = await SystemSettings.getOrCreate(guildId);

    res.json({
      success: true,
      data: { logging: settings.logging }
    });
  } catch (error) {
    console.error('Get Logging Settings Error:', error);
    res.status(500).json({
      success: false,
      error: 'Internal Server Error',
      message: 'Failed to fetch logging settings'
    });
  }
});

router.patch('/logging', authenticateJWT, requireManageServer, apiLimiter, async (req, res) => {
  try {
    const { guildId } = req.params;
    const updates = req.body;

    const settings = await SystemSettings.getOrCreate(guildId);

    Object.assign(settings.logging, updates);
    settings.updatedBy = { userId: req.user.id, username: req.user.username };

    await settings.save();

    await ActivityLog.createLog({
      guildId,
      type: 'settings_changed',
      severity: 'low',
      actor: {
        userId: req.user.id,
        username: req.user.username,
        avatar: req.user.avatar
      },
      details: {
        description: 'Updated logging settings'
      },
      source: { type: 'dashboard' }
    });

    res.json({
      success: true,
      data: { logging: settings.logging }
    });
  } catch (error) {
    console.error('Update Logging Settings Error:', error);
    res.status(500).json({
      success: false,
      error: 'Internal Server Error',
      message: 'Failed to update logging settings'
    });
  }
});

router.get('/antispam', authenticateJWT, requireManageServer, apiLimiter, async (req, res) => {
  try {
    const { guildId } = req.params;

    const settings = await SystemSettings.getOrCreate(guildId);

    res.json({
      success: true,
      data: { antispam: settings.antispam }
    });
  } catch (error) {
    console.error('Get Antispam Settings Error:', error);
    res.status(500).json({
      success: false,
      error: 'Internal Server Error',
      message: 'Failed to fetch antispam settings'
    });
  }
});

router.patch('/antispam', authenticateJWT, requireManageServer, apiLimiter, async (req, res) => {
  try {
    const { guildId } = req.params;
    const updates = req.body;

    const settings = await SystemSettings.getOrCreate(guildId);

    Object.assign(settings.antispam, updates);
    settings.updatedBy = { userId: req.user.id, username: req.user.username };

    await settings.save();

    await ActivityLog.createLog({
      guildId,
      type: 'settings_changed',
      severity: 'medium',
      actor: {
        userId: req.user.id,
        username: req.user.username,
        avatar: req.user.avatar
      },
      details: {
        description: 'Updated antispam settings'
      },
      source: { type: 'dashboard' }
    });

    res.json({
      success: true,
      data: { antispam: settings.antispam }
    });
  } catch (error) {
    console.error('Update Antispam Settings Error:', error);
    res.status(500).json({
      success: false,
      error: 'Internal Server Error',
      message: 'Failed to update antispam settings'
    });
  }
});

router.get('/tickets', authenticateJWT, requireManageServer, apiLimiter, async (req, res) => {
  try {
    const { guildId } = req.params;

    const settings = await SystemSettings.getOrCreate(guildId);

    res.json({
      success: true,
      data: { tickets: settings.tickets }
    });
  } catch (error) {
    console.error('Get Ticket Settings Error:', error);
    res.status(500).json({
      success: false,
      error: 'Internal Server Error',
      message: 'Failed to fetch ticket settings'
    });
  }
});

router.patch('/tickets', authenticateJWT, requireManageServer, apiLimiter, async (req, res) => {
  try {
    const { guildId } = req.params;
    const updates = req.body;

    const settings = await SystemSettings.getOrCreate(guildId);

    Object.assign(settings.tickets, updates);
    settings.updatedBy = { userId: req.user.id, username: req.user.username };

    await settings.save();

    await ActivityLog.createLog({
      guildId,
      type: 'settings_changed',
      severity: 'medium',
      actor: {
        userId: req.user.id,
        username: req.user.username,
        avatar: req.user.avatar
      },
      details: {
        description: 'Updated ticket system settings'
      },
      source: { type: 'dashboard' }
    });

    res.json({
      success: true,
      data: { tickets: settings.tickets }
    });
  } catch (error) {
    console.error('Update Ticket Settings Error:', error);
    res.status(500).json({
      success: false,
      error: 'Internal Server Error',
      message: 'Failed to update ticket settings'
    });
  }
});

router.get('/', authenticateJWT, requireManageServer, apiLimiter, async (req, res) => {
  try {
    const { guildId } = req.params;

    const settings = await SystemSettings.getOrCreate(guildId);

    res.json({
      success: true,
      data: {
        automod: settings.automod,
        welcome: settings.welcome,
        goodbye: settings.goodbye,
        autorole: settings.autorole,
        logging: settings.logging,
        antispam: settings.antispam,
        tickets: settings.tickets,
        suggestions: settings.suggestions,
        giveaways: settings.giveaways,
        verification: settings.verification,
        customCommands: settings.customCommands,
        backup: settings.backup,
        lastUpdated: settings.lastUpdated,
        updatedBy: settings.updatedBy
      }
    });
  } catch (error) {
    console.error('Get All System Settings Error:', error);
    res.status(500).json({
      success: false,
      error: 'Internal Server Error',
      message: 'Failed to fetch system settings'
    });
  }
});

export default router;
