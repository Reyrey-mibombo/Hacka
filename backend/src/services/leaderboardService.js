import { Staff, Level, Economy, Shift } from '../models/index.js';

/**
 * Service for calculating and caching leaderboards
 */
class LeaderboardService {
  constructor() {
    this.cache = new Map();
    this.cacheTTL = 5 * 60 * 1000; // 5 minutes
  }

  /**
   * Get cache key
   * @param {string} type - Leaderboard type
   * @param {string} guildId - Guild ID
   * @param {Object} options - Additional options
   * @returns {string} Cache key
   */
  getCacheKey(type, guildId, options = {}) {
    const optionsStr = JSON.stringify(options);
    return `${type}:${guildId}:${optionsStr}`;
  }

  /**
   * Get cached data
   * @param {string} key - Cache key
   * @returns {Object|null} Cached data or null
   */
  getCached(key) {
    const cached = this.cache.get(key);

    if (!cached) return null;

    if (Date.now() > cached.expiresAt) {
      this.cache.delete(key);
      return null;
    }

    return cached.data;
  }

  /**
   * Set cached data
   * @param {string} key - Cache key
   * @param {Object} data - Data to cache
   */
  setCached(key, data) {
    this.cache.set(key, {
      data,
      expiresAt: Date.now() + this.cacheTTL
    });
  }

  /**
   * Clear cache for a guild
   * @param {string} guildId - Guild ID
   */
  clearGuildCache(guildId) {
    for (const key of this.cache.keys()) {
      if (key.includes(guildId)) {
        this.cache.delete(key);
      }
    }
  }

  /**
   * Get staff points leaderboard
   * @param {string} guildId - Discord guild ID
   * @param {number} limit - Number of results
   * @returns {Promise<Array>} Leaderboard entries
   */
  async getStaffPointsLeaderboard(guildId, limit = 10) {
    const cacheKey = this.getCacheKey('staff-points', guildId, { limit });
    const cached = this.getCached(cacheKey);

    if (cached) return cached;

    const leaderboard = await Staff.getLeaderboard(guildId, limit);

    this.setCached(cacheKey, leaderboard);
    return leaderboard;
  }

  /**
   * Get staff shifts leaderboard
   * @param {string} guildId - Discord guild ID
   * @param {number} days - Number of days to look back
   * @param {number} limit - Number of results
   * @returns {Promise<Array>} Leaderboard entries
   */
  async getStaffShiftsLeaderboard(guildId, days = 7, limit = 10) {
    const cacheKey = this.getCacheKey('staff-shifts', guildId, { days, limit });
    const cached = this.getCached(cacheKey);

    if (cached) return cached;

    const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000);

    const leaderboard = await Shift.aggregate([
      {
        $match: {
          guildId,
          status: 'completed',
          startTime: { $gte: since }
        }
      },
      {
        $group: {
          _id: '$userId',
          username: { $first: '$username' },
          totalShifts: { $sum: 1 },
          totalDuration: { $sum: '$duration' },
          totalPoints: { $sum: '$pointsEarned' }
        }
      },
      {
        $sort: { totalDuration: -1 }
      },
      {
        $limit: limit
      }
    ]);

    this.setCached(cacheKey, leaderboard);
    return leaderboard;
  }

  /**
   * Get level leaderboard
   * @param {string} guildId - Discord guild ID
   * @param {number} limit - Number of results
   * @returns {Promise<Array>} Leaderboard entries
   */
  async getLevelLeaderboard(guildId, limit = 10) {
    const cacheKey = this.getCacheKey('level', guildId, { limit });
    const cached = this.getCached(cacheKey);

    if (cached) return cached;

    const leaderboard = await Level.getLeaderboard(guildId, limit);

    // Enhance with ranks
    const enhanced = leaderboard.map((entry, index) => ({
      ...entry.toObject(),
      rank: index + 1
    }));

    this.setCached(cacheKey, enhanced);
    return enhanced;
  }

  /**
   * Get economy/balance leaderboard
   * @param {string} guildId - Discord guild ID
   * @param {string} type - 'balance', 'wallet', or 'bank'
   * @param {number} limit - Number of results
   * @returns {Promise<Array>} Leaderboard entries
   */
  async getEconomyLeaderboard(guildId, type = 'balance', limit = 10) {
    const cacheKey = this.getCacheKey('economy', guildId, { type, limit });
    const cached = this.getCached(cacheKey);

    if (cached) return cached;

    const leaderboard = await Economy.getLeaderboard(guildId, type, limit);

    // Calculate balance and add rank
    const enhanced = leaderboard.map((entry, index) => ({
      ...entry.toObject(),
      balance: entry.wallet + entry.bank,
      rank: index + 1
    }));

    this.setCached(cacheKey, enhanced);
    return enhanced;
  }

  /**
   * Get comprehensive guild leaderboard
   * @param {string} guildId - Discord guild ID
   * @param {Object} options - Leaderboard options
   * @returns {Promise<Object>} Comprehensive leaderboard
   */
  async getGuildLeaderboard(guildId, options = {}) {
    const { limit = 10, includeStaff = true, includeLevels = true, includeEconomy = true } = options;

    const cacheKey = this.getCacheKey('guild', guildId, options);
    const cached = this.getCached(cacheKey);

    if (cached) return cached;

    const result = {};

    if (includeStaff) {
      result.staff = {
        points: await this.getStaffPointsLeaderboard(guildId, limit),
        shifts: await this.getStaffShiftsLeaderboard(guildId, 7, limit)
      };
    }

    if (includeLevels) {
      result.levels = await this.getLevelLeaderboard(guildId, limit);
    }

    if (includeEconomy) {
      result.economy = {
        balance: await this.getEconomyLeaderboard(guildId, 'balance', limit),
        wallet: await this.getEconomyLeaderboard(guildId, 'wallet', limit)
      };
    }

    this.setCached(cacheKey, result);
    return result;
  }

  /**
   * Get user rank in a leaderboard
   * @param {string} guildId - Discord guild ID
   * @param {string} userId - User's Discord ID
   * @param {string} type - Leaderboard type
   * @returns {Promise<number|null>} User rank or null
   */
  async getUserRank(guildId, userId, type) {
    switch (type) {
      case 'level':
        return Level.getRank(guildId, userId);

      case 'staff-points': {
        const staff = await Staff.findOne({ guildId, userId });
        if (!staff) return null;

        const higherCount = await Staff.countDocuments({
          guildId,
          isActive: true,
          $or: [
            { points: { $gt: staff.points } },
            { points: staff.points, joinedAt: { $lt: staff.joinedAt } }
          ]
        });

        return higherCount + 1;
      }

      case 'economy': {
        const economy = await Economy.findOne({ guildId, userId });
        if (!economy) return null;

        const balance = economy.wallet + economy.bank;
        const higherCount = await Economy.countDocuments({
          guildId,
          $expr: { $gt: [{ $add: ['$wallet', '$bank'] }, balance] }
        });

        return higherCount + 1;
      }

      default:
        return null;
    }
  }

  /**
   * Refresh leaderboard cache
   * @param {string} guildId - Guild ID
   * @param {string} type - Leaderboard type (optional)
   */
  refreshCache(guildId, type = null) {
    if (type) {
      for (const key of this.cache.keys()) {
        if (key.startsWith(`${type}:${guildId}`)) {
          this.cache.delete(key);
        }
      }
    } else {
      this.clearGuildCache(guildId);
    }
  }

  /**
   * Get weekly top performers
   * @param {string} guildId - Discord guild ID
   * @returns {Promise<Object>} Weekly top performers
   */
  async getWeeklyTopPerformers(guildId) {
    const cacheKey = this.getCacheKey('weekly-top', guildId);
    const cached = this.getCached(cacheKey);

    if (cached) return cached;

    const since = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

    const [topStaff, topLevels] = await Promise.all([
      // Top staff by shifts this week
      Shift.aggregate([
        {
          $match: {
            guildId,
            status: 'completed',
            startTime: { $gte: since }
          }
        },
        {
          $group: {
            _id: '$userId',
            username: { $first: '$username' },
            totalShifts: { $sum: 1 },
            totalDuration: { $sum: '$duration' }
          }
        },
        { $sort: { totalDuration: -1 } },
        { $limit: 5 }
      ]),

      // Top levels gained this week
      Level.find({ guildId })
        .sort({ 'stats.xpGainedWeek': -1 })
        .limit(5)
        .select('userId username avatar level stats.xpGainedWeek')
    ]);

    const result = {
      staff: topStaff,
      levels: topLevels
    };

    this.setCached(cacheKey, result);
    return result;
  }

  /**
   * Get leaderboard statistics
   * @param {string} guildId - Discord guild ID
   * @returns {Promise<Object>} Leaderboard statistics
   */
  async getLeaderboardStats(guildId) {
    const [staffCount, levelCount, economyCount] = await Promise.all([
      Staff.countDocuments({ guildId, isActive: true }),
      Level.countDocuments({ guildId }),
      Economy.countDocuments({ guildId })
    ]);

    return {
      totalStaff: staffCount,
      totalLeveledUsers: levelCount,
      totalEconomyUsers: economyCount,
      cachedLeaderboards: Array.from(this.cache.keys()).filter(k => k.includes(guildId)).length
    };
  }
}

export default new LeaderboardService();
