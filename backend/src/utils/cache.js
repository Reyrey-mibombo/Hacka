/**
 * Simple in-memory cache utility for Hacka Discord Dashboard
 * Provides caching with TTL support and key generation utilities
 * @module utils/cache
 */

/**
 * Cache entry structure
 * @typedef {Object} CacheEntry
 * @property {*} value - Cached value
 * @property {number} expiresAt - Timestamp when entry expires
 */

/**
 * In-memory cache store
 * @type {Map<string, CacheEntry>}
 */
const cacheStore = new Map();

/**
 * Default TTL in milliseconds (5 minutes)
 * @constant {number}
 */
const DEFAULT_TTL = 5 * 60 * 1000;

/**
 * Maximum cache size (to prevent memory issues)
 * @constant {number}
 */
const MAX_CACHE_SIZE = 10000;

/**
 * Cache statistics
 * @type {Object}
 */
const stats = {
  hits: 0,
  misses: 0,
  sets: 0,
  deletes: 0,
  clears: 0,
};

/**
 * Generate a cache key from multiple parts
 * @param {...(string|number|Object)} parts - Key parts
 * @returns {string} Generated cache key
 * @example
 * generateKey('user', 12345) // "user:12345"
 * generateKey('guild', 'abc', 'settings') // "guild:abc:settings"
 */
export const generateKey = (...parts) => {
  return parts.map(part => {
    if (typeof part === 'object' && part !== null) {
      return JSON.stringify(part);
    }
    return String(part);
  }).join(':');
};

/**
 * Generate a guild-scoped cache key
 * @param {string} guildId - Discord guild ID
 * @param {...(string|number)} parts - Additional key parts
 * @returns {string} Generated cache key
 * @example
 * generateGuildKey('123456789', 'settings') // "guild:123456789:settings"
 */
export const generateGuildKey = (guildId, ...parts) => {
  return generateKey('guild', guildId, ...parts);
};

/**
 * Generate a user-scoped cache key
 * @param {string} userId - Discord user ID
 * @param {...(string|number)} parts - Additional key parts
 * @returns {string} Generated cache key
 * @example
 * generateUserKey('987654321', 'preferences') // "user:987654321:preferences"
 */
export const generateUserKey = (userId, ...parts) => {
  return generateKey('user', userId, ...parts);
};

/**
 * Set a value in the cache
 * @param {string} key - Cache key
 * @param {*} value - Value to cache
 * @param {number} [ttl] - Time to live in milliseconds
 * @returns {boolean} True if set successfully
 * @example
 * set('user:123', { name: 'John' }, 60000); // Cache for 1 minute
 */
export const set = (key, value, ttl = DEFAULT_TTL) => {
  try {
    // Enforce max cache size with LRU eviction
    if (cacheStore.size >= MAX_CACHE_SIZE && !cacheStore.has(key)) {
      // Remove oldest entry
      const oldestKey = cacheStore.keys().next().value;
      cacheStore.delete(oldestKey);
    }

    const expiresAt = Date.now() + ttl;
    cacheStore.set(key, { value, expiresAt });
    stats.sets++;
    return true;
  } catch (error) {
    console.error('Cache set error:', error);
    return false;
  }
};

/**
 * Get a value from the cache
 * @param {string} key - Cache key
 * @returns {*} Cached value or undefined if not found/expired
 * @example
 * const user = get('user:123');
 * if (user) {
 *   console.log('Cache hit:', user);
 * }
 */
export const get = (key) => {
  try {
    const entry = cacheStore.get(key);
    
    if (!entry) {
      stats.misses++;
      return undefined;
    }

    // Check if expired
    if (Date.now() > entry.expiresAt) {
      cacheStore.delete(key);
      stats.misses++;
      return undefined;
    }

    stats.hits++;
    return entry.value;
  } catch (error) {
    console.error('Cache get error:', error);
    return undefined;
  }
};

/**
 * Get a value from cache or compute it if not present
 * @param {string} key - Cache key
 * @param {Function} factory - Function to compute value if not cached
 * @param {number} [ttl] - Time to live in milliseconds
 * @returns {*} Cached or computed value
 * @example
 * const user = await getOrSet('user:123', async () => {
 *   return await fetchUserFromDatabase(123);
 * }, 60000);
 */
export const getOrSet = async (key, factory, ttl = DEFAULT_TTL) => {
  const cached = get(key);
  if (cached !== undefined) {
    return cached;
  }

  try {
    const value = await factory();
    set(key, value, ttl);
    return value;
  } catch (error) {
    console.error('Cache factory error:', error);
    throw error;
  }
};

/**
 * Check if a key exists in the cache and is not expired
 * @param {string} key - Cache key
 * @returns {boolean} True if key exists and is valid
 * @example
 * if (has('user:123')) {
 *   console.log('User is cached');
 * }
 */
export const has = (key) => {
  const entry = cacheStore.get(key);
  if (!entry) return false;
  if (Date.now() > entry.expiresAt) {
    cacheStore.delete(key);
    return false;
  }
  return true;
};

/**
 * Delete a value from the cache
 * @param {string} key - Cache key
 * @returns {boolean} True if key existed and was deleted
 * @example
 * del('user:123');
 */
export const del = (key) => {
  const existed = cacheStore.delete(key);
  if (existed) {
    stats.deletes++;
  }
  return existed;
};

/**
 * Delete multiple values matching a pattern
 * @param {RegExp|string} pattern - Pattern to match keys against
 * @returns {number} Number of keys deleted
 * @example
 * delPattern('user:*'); // Delete all user keys
 * delPattern(/^guild:123/); // Delete all keys starting with guild:123
 */
export const delPattern = (pattern) => {
  let count = 0;
  const regex = pattern instanceof RegExp ? pattern : new RegExp(pattern.replace(/\*/g, '.*'));
  
  for (const key of cacheStore.keys()) {
    if (regex.test(key)) {
      cacheStore.delete(key);
      count++;
    }
  }
  
  if (count > 0) {
    stats.deletes += count;
  }
  return count;
};

/**
 * Clear all values from the cache
 * @returns {void}
 * @example
 * clear();
 */
export const clear = () => {
  cacheStore.clear();
  stats.clears++;
};

/**
 * Get all cache keys
 * @returns {string[]} Array of cache keys
 * @example
 * const keys = keys();
 * console.log('Cached keys:', keys);
 */
export const keys = () => {
  return Array.from(cacheStore.keys());
};

/**
 * Get cache size (number of entries)
 * @returns {number} Number of cached entries
 * @example
 * console.log('Cache size:', size());
 */
export const size = () => {
  return cacheStore.size;
};

/**
 * Get cache statistics
 * @returns {Object} Cache statistics
 * @example
 * const stats = getStats();
 * console.log('Hit rate:', stats.hitRate);
 */
export const getStats = () => {
  const total = stats.hits + stats.misses;
  return {
    ...stats,
    size: cacheStore.size,
    hitRate: total > 0 ? (stats.hits / total) : 0,
    missRate: total > 0 ? (stats.misses / total) : 0,
  };
};

/**
 * Reset cache statistics
 * @returns {void}
 * @example
 * resetStats();
 */
export const resetStats = () => {
  stats.hits = 0;
  stats.misses = 0;
  stats.sets = 0;
  stats.deletes = 0;
  stats.clears = 0;
};

/**
 * Clean up expired entries
 * @returns {number} Number of expired entries removed
 * @example
 * const removed = cleanup();
 * console.log('Cleaned up', removed, 'expired entries');
 */
export const cleanup = () => {
  const now = Date.now();
  let count = 0;
  
  for (const [key, entry] of cacheStore.entries()) {
    if (now > entry.expiresAt) {
      cacheStore.delete(key);
      count++;
    }
  }
  
  return count;
};

/**
 * Get remaining TTL for a key
 * @param {string} key - Cache key
 * @returns {number|null} Remaining TTL in milliseconds, or null if not found
 * @example
 * const ttl = getTTL('user:123');
 * if (ttl !== null) {
 *   console.log('Expires in', ttl, 'ms');
 * }
 */
export const getTTL = (key) => {
  const entry = cacheStore.get(key);
  if (!entry) return null;
  
  const remaining = entry.expiresAt - Date.now();
  return remaining > 0 ? remaining : null;
};

/**
 * Update TTL for an existing key
 * @param {string} key - Cache key
 * @param {number} ttl - New TTL in milliseconds
 * @returns {boolean} True if TTL was updated
 * @example
 * touch('user:123', 300000); // Extend to 5 more minutes
 */
export const touch = (key, ttl = DEFAULT_TTL) => {
  const entry = cacheStore.get(key);
  if (!entry) return false;
  
  entry.expiresAt = Date.now() + ttl;
  return true;
};

/**
 * Cache class for creating namespaced cache instances
 * Useful for organizing cache by feature/module
 */
export class Cache {
  /**
   * Create a new Cache instance
   * @param {string} namespace - Cache namespace/prefix
   * @param {Object} [options] - Cache options
   * @param {number} [options.defaultTTL] - Default TTL in milliseconds
   */
  constructor(namespace, options = {}) {
    this.namespace = namespace;
    this.defaultTTL = options.defaultTTL || DEFAULT_TTL;
  }

  /**
   * Generate namespaced key
   * @param {...(string|number)} parts - Key parts
   * @returns {string} Namespaced key
   * @private
   */
  _key(...parts) {
    return generateKey(this.namespace, ...parts);
  }

  /**
   * Set a value in the cache
   * @param {string|number} key - Cache key (without namespace)
   * @param {*} value - Value to cache
   * @param {number} [ttl] - Time to live in milliseconds
   * @returns {boolean}
   */
  set(key, value, ttl) {
    return set(this._key(key), value, ttl || this.defaultTTL);
  }

  /**
   * Get a value from the cache
   * @param {string|number} key - Cache key (without namespace)
   * @returns {*}
   */
  get(key) {
    return get(this._key(key));
  }

  /**
   * Get or set a value
   * @param {string|number} key - Cache key (without namespace)
   * @param {Function} factory - Factory function
   * @param {number} [ttl] - Time to live in milliseconds
   * @returns {*}
   */
  async getOrSet(key, factory, ttl) {
    return getOrSet(this._key(key), factory, ttl || this.defaultTTL);
  }

  /**
   * Check if key exists
   * @param {string|number} key - Cache key (without namespace)
   * @returns {boolean}
   */
  has(key) {
    return has(this._key(key));
  }

  /**
   * Delete a value
   * @param {string|number} key - Cache key (without namespace)
   * @returns {boolean}
   */
  del(key) {
    return del(this._key(key));
  }

  /**
   * Delete all values in this namespace
   * @returns {number} Number of keys deleted
   */
  clear() {
    return delPattern(`^${this.namespace}:`);
  }

  /**
   * Get remaining TTL
   * @param {string|number} key - Cache key (without namespace)
   * @returns {number|null}
   */
  getTTL(key) {
    return getTTL(this._key(key));
  }

  /**
   * Update TTL
   * @param {string|number} key - Cache key (without namespace)
   * @param {number} ttl - Time to live in milliseconds
   * @returns {boolean}
   */
  touch(key, ttl) {
    return touch(this._key(key), ttl || this.defaultTTL);
  }
}

export default {
  generateKey,
  generateGuildKey,
  generateUserKey,
  set,
  get,
  getOrSet,
  has,
  del,
  delPattern,
  clear,
  keys,
  size,
  getStats,
  resetStats,
  cleanup,
  getTTL,
  touch,
  Cache,
  DEFAULT_TTL,
  MAX_CACHE_SIZE,
};
