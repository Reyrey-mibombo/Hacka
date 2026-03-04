import express from 'express';
import axios from 'axios';
import { authenticateJWT } from '../middleware/auth.js';
import { requireGuildAccess, requireManageServer } from '../middleware/permissions.js';
import { apiLimiter, discordApiLimiter } from '../middleware/rateLimiter.js';
import { User, Guild, Staff, Shift, Ticket, Warning, ActivityLog } from '../models/index.js';

const router = express.Router();

const DISCORD_API = 'https://discord.com/api/v10';

router.get('/', authenticateJWT, apiLimiter, async (req, res) => {
  try {
    const user = await User.findOne({ discordId: req.user.id });

    if (!user) {
      return res.status(404).json({
        success: false,
        error: 'Not Found',
        message: 'User not found'
      });
    }

    const manageableGuilds = [];

    for (const userGuild of user.guilds) {
      const permissions = BigInt(userGuild.permissions || '0');
      const hasManageServer = (permissions & BigInt(0x00000020)) === BigInt(0x00000020);
      const isAdmin = (permissions & BigInt(0x00000008)) === BigInt(0x00000008);

      if (hasManageServer || isAdmin || userGuild.owner) {
        let guildData = await Guild.findOne({ guildId: userGuild.guildId });

        if (!guildData) {
          guildData = new Guild({
            guildId: userGuild.guildId,
            name: userGuild.name,
            icon: userGuild.icon,
            ownerId: userGuild.owner ? req.user.id : null,
            features: userGuild.features
          });
          await guildData.save();
        }

        manageableGuilds.push({
          id: userGuild.guildId,
          name: userGuild.name,
          icon: userGuild.icon ? `https://cdn.discordapp.com/icons/${userGuild.guildId}/${userGuild.icon}.png` : null,
          owner: userGuild.owner,
          permissions: userGuild.permissions,
          dashboardEnabled: guildData.settings?.dashboardEnabled ?? true,
          botEnabled: guildData.settings?.botEnabled ?? false,
          memberCount: guildData.memberCount,
          tier: guildData.tier
        });
      }
    }

    res.json({
      success: true,
      data: { guilds: manageableGuilds }
    });
  } catch (error) {
    console.error('Get Guilds Error:', error);
    res.status(500).json({
      success: false,
      error: 'Internal Server Error',
      message: 'Failed to fetch guilds'
    });
  }
});

router.get('/:guildId', authenticateJWT, requireGuildAccess, apiLimiter, async (req, res) => {
  try {
    const { guildId } = req.params;

    const [guild, guildData] = await Promise.all([
      axios.get(`${DISCORD_API}/guilds/${guildId}`, {
        headers: { Authorization: `Bot ${process.env.DISCORD_BOT_TOKEN}` },
        timeout: 10000
      }).catch(() => null),
      Guild.findOne({ guildId })
    ]);

    if (!guild?.data) {
      return res.status(404).json({
        success: false,
        error: 'Not Found',
        message: 'Guild not found or bot is not a member'
      });
    }

    const discordGuild = guild.data;

    const response = {
      id: discordGuild.id,
      name: discordGuild.name,
      icon: discordGuild.icon ? `https://cdn.discordapp.com/icons/${discordGuild.id}/${discordGuild.icon}.png` : null,
      banner: discordGuild.banner ? `https://cdn.discordapp.com/banners/${discordGuild.id}/${discordGuild.banner}.png` : null,
      description: discordGuild.description,
      ownerId: discordGuild.owner_id,
      memberCount: discordGuild.approximate_member_count || guildData?.memberCount || 0,
      premiumTier: discordGuild.premium_tier,
      premiumSubscriptionCount: discordGuild.premium_subscription_count,
      features: discordGuild.features,
      verificationLevel: discordGuild.verification_level,
      defaultMessageNotifications: discordGuild.default_message_notifications,
      explicitContentFilter: discordGuild.explicit_content_filter,
      preferredLocale: discordGuild.preferred_locale,
      settings: guildData?.settings || {},
      tier: guildData?.tier || 'free',
      statistics: guildData?.statistics || {}
    };

    res.json({
      success: true,
      data: { guild: response }
    });
  } catch (error) {
    console.error('Get Guild Error:', error);
    res.status(500).json({
      success: false,
      error: 'Internal Server Error',
      message: 'Failed to fetch guild details'
    });
  }
});

router.get('/:guildId/stats', authenticateJWT, requireGuildAccess, apiLimiter, async (req, res) => {
  try {
    const { guildId } = req.params;
    const { days = 30 } = req.query;

    const [guildData, staffCount, shiftStats, ticketStats, warningStats] = await Promise.all([
      Guild.findOne({ guildId }),
      Staff.countDocuments({ guildId, isActive: true }),
      Shift.getGuildStats(guildId, parseInt(days)),
      Ticket.getStats(guildId, parseInt(days)),
      Warning.aggregate([
        {
          $match: {
            guildId,
            createdAt: { $gte: new Date(Date.now() - parseInt(days) * 24 * 60 * 60 * 1000) }
          }
        },
        {
          $group: {
            _id: null,
            total: { $sum: 1 },
            active: {
              $sum: { $cond: [{ $and: [{ $eq: ['$revoked', false] }, { $eq: ['$expired', false] }] }, 1, 0] }
            }
          }
        }
      ])
    ]);

    const activityStats = await ActivityLog.getStats(guildId, parseInt(days));

    res.json({
      success: true,
      data: {
        overview: {
          memberCount: guildData?.memberCount || 0,
          staffCount,
          tier: guildData?.tier || 'free',
          commandsUsed: guildData?.statistics?.commandsUsed || 0
        },
        shifts: shiftStats,
        tickets: ticketStats,
        warnings: warningStats[0] || { total: 0, active: 0 },
        activity: activityStats,
        period: {
          days: parseInt(days),
          since: new Date(Date.now() - parseInt(days) * 24 * 60 * 60 * 1000)
        }
      }
    });
  } catch (error) {
    console.error('Get Guild Stats Error:', error);
    res.status(500).json({
      success: false,
      error: 'Internal Server Error',
      message: 'Failed to fetch guild statistics'
    });
  }
});

router.patch('/:guildId/settings', authenticateJWT, requireManageServer, apiLimiter, async (req, res) => {
  try {
    const { guildId } = req.params;
    const updates = req.body;

    const allowedSettings = ['prefix', 'timezone', 'dashboardEnabled', 'botEnabled'];
    const filteredUpdates = {};

    for (const key of allowedSettings) {
      if (updates[key] !== undefined) {
        filteredUpdates[`settings.${key}`] = updates[key];
      }
    }

    if (Object.keys(filteredUpdates).length === 0) {
      return res.status(400).json({
        success: false,
        error: 'Bad Request',
        message: 'No valid settings provided'
      });
    }

    const guild = await Guild.findOneAndUpdate(
      { guildId },
      { $set: filteredUpdates },
      { new: true, upsert: true }
    );

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
        description: 'Guild settings updated',
        changes: Object.keys(filteredUpdates).map(k => ({
          field: k.replace('settings.', ''),
          oldValue: null,
          newValue: filteredUpdates[k]
        }))
      },
      source: { type: 'dashboard' }
    });

    res.json({
      success: true,
      data: { settings: guild.settings }
    });
  } catch (error) {
    console.error('Update Guild Settings Error:', error);
    res.status(500).json({
      success: false,
      error: 'Internal Server Error',
      message: 'Failed to update guild settings'
    });
  }
});

export default router;
