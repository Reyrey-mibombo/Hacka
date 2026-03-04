import axios from 'axios';
import jwt from 'jsonwebtoken';
import { User } from '../models/index.js';

const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key-change-in-production';
const JWT_REFRESH_SECRET = process.env.JWT_REFRESH_SECRET || 'your-refresh-secret-key-change-in-production';
const DISCORD_CLIENT_ID = process.env.DISCORD_CLIENT_ID;
const DISCORD_CLIENT_SECRET = process.env.DISCORD_CLIENT_SECRET;
const DISCORD_REDIRECT_URI = process.env.DISCORD_REDIRECT_URI;

/**
 * Service for handling authentication-related operations
 */
class AuthService {
  /**
   * Exchange Discord authorization code for access token
   * @param {string} code - Discord OAuth authorization code
   * @returns {Promise<Object>} Discord token response
   */
  async exchangeCodeForToken(code) {
    try {
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
          headers: {
            'Content-Type': 'application/x-www-form-urlencoded'
          }
        }
      );

      return tokenResponse.data;
    } catch (error) {
      throw new Error(`Failed to exchange code for token: ${error.response?.data?.error_description || error.message}`);
    }
  }

  /**
   * Fetch Discord user data using access token
   * @param {string} accessToken - Discord access token
   * @returns {Promise<Object>} Discord user data
   */
  async fetchDiscordUser(accessToken) {
    try {
      const userResponse = await axios.get('https://discord.com/api/users/@me', {
        headers: {
          Authorization: `Bearer ${accessToken}`
        }
      });

      return userResponse.data;
    } catch (error) {
      throw new Error(`Failed to fetch Discord user: ${error.response?.data?.message || error.message}`);
    }
  }

  /**
   * Fetch user's guilds from Discord
   * @param {string} accessToken - Discord access token
   * @returns {Promise<Array>} Array of guild objects
   */
  async fetchUserGuilds(accessToken) {
    try {
      const guildsResponse = await axios.get('https://discord.com/api/users/@me/guilds', {
        headers: {
          Authorization: `Bearer ${accessToken}`
        }
      });

      return guildsResponse.data;
    } catch (error) {
      throw new Error(`Failed to fetch user guilds: ${error.response?.data?.message || error.message}`);
    }
  }

  /**
   * Generate JWT access and refresh tokens
   * @param {Object} user - User object or Discord user data
   * @returns {Object} Object containing accessToken and refreshToken
   */
  generateTokens(user) {
    const accessToken = jwt.sign(
      {
        userId: user.discordId || user.id,
        username: user.username,
        discriminator: user.discriminator,
        avatar: user.avatar,
        email: user.email,
        type: 'access'
      },
      JWT_SECRET,
      { expiresIn: '15m' }
    );

    const refreshToken = jwt.sign(
      {
        userId: user.discordId || user.id,
        type: 'refresh'
      },
      JWT_REFRESH_SECRET,
      { expiresIn: '7d' }
    );

    return { accessToken, refreshToken };
  }

  /**
   * Verify JWT access token
   * @param {string} token - JWT token to verify
   * @returns {Object|null} Decoded token payload or null if invalid
   */
  verifyAccessToken(token) {
    try {
      return jwt.verify(token, JWT_SECRET);
    } catch (error) {
      return null;
    }
  }

  /**
   * Verify JWT refresh token
   * @param {string} token - Refresh token to verify
   * @returns {Object|null} Decoded token payload or null if invalid
   */
  verifyRefreshToken(token) {
    try {
      return jwt.verify(token, JWT_REFRESH_SECRET);
    } catch (error) {
      return null;
    }
  }

  /**
   * Refresh access token using refresh token
   * @param {string} refreshToken - JWT refresh token
   * @returns {Promise<Object>} New tokens
   */
  async refreshAccessToken(refreshToken) {
    const decoded = this.verifyRefreshToken(refreshToken);

    if (!decoded || decoded.type !== 'refresh') {
      throw new Error('Invalid refresh token');
    }

    const user = await User.findOne({ discordId: decoded.userId });

    if (!user) {
      throw new Error('User not found');
    }

    if (user.isBanned) {
      throw new Error('User is banned');
    }

    // Update last login
    user.lastLogin = new Date();
    user.loginCount += 1;
    await user.save();

    const tokens = this.generateTokens(user);

    return {
      tokens,
      user: {
        id: user.discordId,
        username: user.username,
        discriminator: user.discriminator,
        avatar: user.avatar,
        email: user.email
      }
    };
  }

  /**
   * Refresh Discord access token
   * @param {string} refreshToken - Discord refresh token
   * @returns {Promise<Object>} New Discord tokens
   */
  async refreshDiscordToken(refreshToken) {
    try {
      const tokenResponse = await axios.post(
        'https://discord.com/api/oauth2/token',
        new URLSearchParams({
          client_id: DISCORD_CLIENT_ID,
          client_secret: DISCORD_CLIENT_SECRET,
          grant_type: 'refresh_token',
          refresh_token: refreshToken
        }),
        {
          headers: {
            'Content-Type': 'application/x-www-form-urlencoded'
          }
        }
      );

      return tokenResponse.data;
    } catch (error) {
      throw new Error(`Failed to refresh Discord token: ${error.response?.data?.error_description || error.message}`);
    }
  }

  /**
   * Create or update user from Discord OAuth data
   * @param {Object} discordUser - Discord user data
   * @param {Object} tokens - Discord tokens
   * @returns {Promise<User>} User document
   */
  async createOrUpdateUser(discordUser, tokens) {
    const expiresAt = new Date(Date.now() + tokens.expires_in * 1000);

    const userData = {
      discordId: discordUser.id,
      username: discordUser.username,
      discriminator: discordUser.discriminator || '0',
      globalName: discordUser.global_name || null,
      avatar: discordUser.avatar,
      banner: discordUser.banner || null,
      bannerColor: discordUser.banner_color || null,
      accentColor: discordUser.accent_color || null,
      locale: discordUser.locale || 'en-US',
      mfaEnabled: discordUser.mfa_enabled || false,
      email: discordUser.email || null,
      verified: discordUser.verified || false,
      accessToken: tokens.access_token,
      refreshToken: tokens.refresh_token,
      tokenExpiresAt: expiresAt,
      lastLogin: new Date()
    };

    const user = await User.findOneAndUpdate(
      { discordId: discordUser.id },
      {
        $set: userData,
        $inc: { loginCount: 1 }
      },
      { upsert: true, new: true }
    );

    return user;
  }

  /**
   * Update user's guild list
   * @param {string} userId - User's Discord ID
   * @param {Array} guilds - Array of guild objects from Discord
   * @returns {Promise<User>} Updated user
   */
  async updateUserGuilds(userId, guilds) {
    const formattedGuilds = guilds.map(guild => ({
      guildId: guild.id,
      name: guild.name,
      icon: guild.icon,
      owner: guild.owner,
      permissions: guild.permissions,
      features: guild.features || [],
      joinedAt: new Date()
    }));

    const user = await User.findOneAndUpdate(
      { discordId: userId },
      { $set: { guilds: formattedGuilds } },
      { new: true }
    );

    return user;
  }

  /**
   * Revoke Discord access token
   * @param {string} accessToken - Discord access token
   * @returns {Promise<void>}
   */
  async revokeDiscordToken(accessToken) {
    try {
      await axios.post(
        'https://discord.com/api/oauth2/token/revoke',
        new URLSearchParams({
          client_id: DISCORD_CLIENT_ID,
          client_secret: DISCORD_CLIENT_SECRET,
          token: accessToken
        }),
        {
          headers: {
            'Content-Type': 'application/x-www-form-urlencoded'
          }
        }
      );
    } catch (error) {
      throw new Error(`Failed to revoke token: ${error.response?.data?.error_description || error.message}`);
    }
  }

  /**
   * Logout user and invalidate session
   * @param {string} userId - User's Discord ID
   * @returns {Promise<void>}
   */
  async logout(userId) {
    const user = await User.findOne({ discordId: userId });

    if (user && user.accessToken) {
      try {
        await this.revokeDiscordToken(user.accessToken);
      } catch (error) {
        // Continue even if token revocation fails
        console.warn('Failed to revoke Discord token:', error.message);
      }
    }
  }

  /**
   * Check if user's Discord token needs refresh
   * @param {User} user - User document
   * @returns {Promise<boolean>} True if token needs refresh
   */
  async shouldRefreshToken(user) {
    if (!user.tokenExpiresAt) return false;

    // Refresh if token expires in less than 5 minutes
    const refreshThreshold = new Date(Date.now() + 5 * 60 * 1000);
    return user.tokenExpiresAt < refreshThreshold;
  }

  /**
   * Ensure user has valid Discord token
   * @param {User} user - User document
   * @returns {Promise<string>} Valid access token
   */
  async ensureValidToken(user) {
    if (await this.shouldRefreshToken(user)) {
      const tokens = await this.refreshDiscordToken(user.refreshToken);

      user.accessToken = tokens.access_token;
      user.refreshToken = tokens.refresh_token;
      user.tokenExpiresAt = new Date(Date.now() + tokens.expires_in * 1000);
      await user.save();

      return tokens.access_token;
    }

    return user.accessToken;
  }
}

export default new AuthService();
