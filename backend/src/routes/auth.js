import express from 'express';
import axios from 'axios';
import { generateTokens, verifyRefreshToken } from '../middleware/auth.js';
import { authLimiter } from '../middleware/rateLimiter.js';
import { User, Guild, ActivityLog } from '../models/index.js';

const router = express.Router();

const DISCORD_CLIENT_ID = process.env.DISCORD_CLIENT_ID;
const DISCORD_CLIENT_SECRET = process.env.DISCORD_CLIENT_SECRET;
const DISCORD_REDIRECT_URI = process.env.DISCORD_REDIRECT_URI || 'http://localhost:3000/auth/callback';
const DISCORD_SCOPE = 'identify email guilds guilds.members.read';

router.get('/discord', authLimiter, (req, res) => {
  try {
    const state = Buffer.from(JSON.stringify({
      timestamp: Date.now(),
      nonce: Math.random().toString(36).substring(2)
    })).toString('base64');

    const params = new URLSearchParams({
      client_id: DISCORD_CLIENT_ID,
      redirect_uri: DISCORD_REDIRECT_URI,
      response_type: 'code',
      scope: DISCORD_SCOPE,
      state: state,
      prompt: 'consent'
    });

    const authUrl = `https://discord.com/api/oauth2/authorize?${params.toString()}`;

    res.json({
      success: true,
      data: {
        authUrl,
        state
      }
    });
  } catch (error) {
    console.error('Discord Auth URL Error:', error);
    res.status(500).json({
      success: false,
      error: 'Internal Server Error',
      message: 'Failed to generate authentication URL'
    });
  }
});

router.post('/callback', authLimiter, async (req, res) => {
  try {
    const { code } = req.body;

    if (!code) {
      return res.status(400).json({
        success: false,
        error: 'Bad Request',
        message: 'Authorization code is required'
      });
    }

    const tokenResponse = await axios.post(
      'https://discord.com/api/oauth2/token',
      new URLSearchParams({
        client_id: DISCORD_CLIENT_ID,
        client_secret: DISCORD_CLIENT_SECRET,
        grant_type: 'authorization_code',
        code,
        redirect_uri: DISCORD_REDIRECT_URI
      }),
      {
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        timeout: 10000
      }
    );

    const { access_token, refresh_token, expires_in } = tokenResponse.data;

    const [userResponse, guildsResponse] = await Promise.all([
      axios.get('https://discord.com/api/users/@me', {
        headers: { Authorization: `Bearer ${access_token}` },
        timeout: 10000
      }),
      axios.get('https://discord.com/api/users/@me/guilds', {
        headers: { Authorization: `Bearer ${access_token}` },
        timeout: 10000
      })
    ]);

    const discordUser = userResponse.data;
    const guilds = guildsResponse.data;

    const tokenExpiresAt = new Date(Date.now() + expires_in * 1000);

    let user = await User.findOne({ discordId: discordUser.id });

    if (user) {
      user.username = discordUser.username;
      user.discriminator = discordUser.discriminator || '0';
      user.globalName = discordUser.global_name || null;
      user.avatar = discordUser.avatar;
      user.email = discordUser.email;
      user.verified = discordUser.verified;
      user.locale = discordUser.locale;
      user.mfaEnabled = discordUser.mfa_enabled;
      user.accessToken = access_token;
      user.refreshToken = refresh_token;
      user.tokenExpiresAt = tokenExpiresAt;
      user.guilds = guilds.map(g => ({
        guildId: g.id,
        name: g.name,
        icon: g.icon,
        owner: g.owner,
        permissions: g.permissions,
        features: g.features
      }));
      user.lastLogin = new Date();
      user.loginCount += 1;

      await user.save();
    } else {
      user = new User({
        discordId: discordUser.id,
        username: discordUser.username,
        discriminator: discordUser.discriminator || '0',
        globalName: discordUser.global_name || null,
        avatar: discordUser.avatar,
        email: discordUser.email,
        verified: discordUser.verified,
        locale: discordUser.locale,
        mfaEnabled: discordUser.mfa_enabled,
        accessToken: access_token,
        refreshToken: refresh_token,
        tokenExpiresAt,
        guilds: guilds.map(g => ({
          guildId: g.id,
          name: g.name,
          icon: g.icon,
          owner: g.owner,
          permissions: g.permissions,
          features: g.features
        }))
      });

      await user.save();
    }

    const tokens = generateTokens({
      id: user.discordId,
      username: user.username,
      discriminator: user.discriminator,
      avatar: user.avatar,
      email: user.email
    });

    await ActivityLog.createLog({
      guildId: 'global',
      type: 'dashboard_login',
      severity: 'info',
      actor: {
        userId: user.discordId,
        username: user.username,
        avatar: user.avatar
      },
      details: {
        description: `User logged in via Discord OAuth`
      },
      source: { type: 'dashboard' }
    });

    res.json({
      success: true,
      data: {
        user: {
          id: user.discordId,
          username: user.username,
          globalName: user.globalName,
          avatar: user.getAvatarURL(),
          email: user.email
        },
        tokens
      }
    });
  } catch (error) {
    console.error('Discord Callback Error:', error.message);

    if (error.response?.status === 400) {
      return res.status(400).json({
        success: false,
        error: 'Bad Request',
        message: 'Invalid authorization code'
      });
    }

    res.status(500).json({
      success: false,
      error: 'Internal Server Error',
      message: 'Authentication failed'
    });
  }
});

router.post('/refresh', authLimiter, async (req, res) => {
  try {
    const { refreshToken } = req.body;

    if (!refreshToken) {
      return res.status(400).json({
        success: false,
        error: 'Bad Request',
        message: 'Refresh token is required'
      });
    }

    const decoded = verifyRefreshToken(refreshToken);

    if (!decoded) {
      return res.status(401).json({
        success: false,
        error: 'Unauthorized',
        message: 'Invalid refresh token'
      });
    }

    const user = await User.findOne({ discordId: decoded.userId });

    if (!user) {
      return res.status(404).json({
        success: false,
        error: 'Not Found',
        message: 'User not found'
      });
    }

    try {
      const tokenResponse = await axios.post(
        'https://discord.com/api/oauth2/token',
        new URLSearchParams({
          client_id: DISCORD_CLIENT_ID,
          client_secret: DISCORD_CLIENT_SECRET,
          grant_type: 'refresh_token',
          refresh_token: user.refreshToken
        }),
        {
          headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
          timeout: 10000
        }
      );

      const { access_token, refresh_token, expires_in } = tokenResponse.data;

      user.accessToken = access_token;
      user.refreshToken = refresh_token;
      user.tokenExpiresAt = new Date(Date.now() + expires_in * 1000);
      await user.save();
    } catch (discordError) {
      console.error('Discord Token Refresh Error:', discordError.message);
    }

    const tokens = generateTokens({
      id: user.discordId,
      username: user.username,
      discriminator: user.discriminator,
      avatar: user.avatar,
      email: user.email
    });

    res.json({
      success: true,
      data: { tokens }
    });
  } catch (error) {
    console.error('Token Refresh Error:', error);
    res.status(500).json({
      success: false,
      error: 'Internal Server Error',
      message: 'Failed to refresh token'
    });
  }
});

router.post('/logout', async (req, res) => {
  try {
    const authHeader = req.headers.authorization;

    if (authHeader?.startsWith('Bearer ')) {
      const token = authHeader.substring(7);
      const decoded = verifyRefreshToken(token);

      if (decoded?.userId) {
        await ActivityLog.createLog({
          guildId: 'global',
          type: 'dashboard_action',
          severity: 'info',
          actor: { userId: decoded.userId, username: 'Unknown' },
          details: { description: 'User logged out' },
          source: { type: 'dashboard' }
        });
      }
    }

    res.json({
      success: true,
      message: 'Logged out successfully'
    });
  } catch (error) {
    console.error('Logout Error:', error);
    res.status(500).json({
      success: false,
      error: 'Internal Server Error',
      message: 'Logout failed'
    });
  }
});

router.get('/me', async (req, res) => {
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader?.startsWith('Bearer ')) {
      return res.status(401).json({
        success: false,
        error: 'Unauthorized',
        message: 'Access token required'
      });
    }

    const token = authHeader.substring(7);
    const decoded = verifyRefreshToken(token);

    if (!decoded || decoded.type !== 'access') {
      return res.status(401).json({
        success: false,
        error: 'Unauthorized',
        message: 'Invalid token'
      });
    }

    const user = await User.findOne({ discordId: decoded.userId });

    if (!user) {
      return res.status(404).json({
        success: false,
        error: 'Not Found',
        message: 'User not found'
      });
    }

    const manageableGuilds = user.guilds.filter(g => {
      const permissions = BigInt(g.permissions || '0');
      return (permissions & BigInt(0x00000020)) === BigInt(0x00000020) ||
             (permissions & BigInt(0x00000008)) === BigInt(0x00000008);
    });

    res.json({
      success: true,
      data: {
        user: {
          id: user.discordId,
          username: user.username,
          globalName: user.globalName,
          discriminator: user.discriminator,
          avatar: user.getAvatarURL(),
          email: user.email,
          verified: user.verified,
          locale: user.locale,
          mfaEnabled: user.mfaEnabled,
          preferences: user.preferences,
          isAdmin: user.isAdmin
        },
        guilds: manageableGuilds.map(g => ({
          id: g.guildId,
          name: g.name,
          icon: g.icon ? `https://cdn.discordapp.com/icons/${g.guildId}/${g.icon}.png` : null,
          owner: g.owner,
          permissions: g.permissions
        }))
      }
    });
  } catch (error) {
    console.error('Get Me Error:', error);
    res.status(500).json({
      success: false,
      error: 'Internal Server Error',
      message: 'Failed to fetch user data'
    });
  }
});

export default router;
