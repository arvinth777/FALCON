const NodeCache = require('node-cache');

// TTL cache with 5-10 minute expiration (8 minutes default)
const CACHE_TTL_SECONDS = parseInt(process.env.CACHE_TTL_MINUTES || '8', 10) * 60;

// Create cache instance with automatic cleanup
const cache = new NodeCache({
  stdTTL: CACHE_TTL_SECONDS,
  checkperiod: 60, // Check for expired keys every 60 seconds
  useClones: false // Better performance, but be careful with object mutations
});

class TTLCache {
  /**
   * Get value from cache
   * @param {string} key - Cache key
   * @returns {*} Cached value or undefined
   */
  static get(key) {
    const value = cache.get(key);
    if (value !== undefined) {
      logDebug(`Cache HIT for key: ${key}`);
      return value;
    }
    logDebug(`Cache MISS for key: ${key}`);
    return undefined;
  }

  /**
   * Set value in cache with TTL
   * @param {string} key - Cache key
   * @param {*} value - Value to cache
   * @param {number} ttl - TTL in seconds (optional, uses default if not provided)
   * @returns {boolean} Success status
   */
  static set(key, value, ttl = CACHE_TTL_SECONDS) {
    const success = cache.set(key, value, ttl);
    if (success) {
      logDebug(`Cache SET for key: ${key}, TTL: ${ttl}s`);
    }
    return success;
  }

  /**
   * Check if key exists in cache
   * @param {string} key - Cache key
   * @returns {boolean} True if key exists
   */
  static has(key) {
    return cache.has(key);
  }

  /**
   * Delete key from cache
   * @param {string} key - Cache key
   * @returns {number} Number of deleted keys
   */
  static del(key) {
    return cache.del(key);
  }

  /**
   * Clear entire cache
   */
  static flush() {
    cache.flushAll();
    logDebug('Cache flushed');
  }

  /**
   * Get cache statistics
   * @returns {object} Cache stats
   */
  static getStats() {
    const stats = cache.getStats();
    return {
      keys: stats.keys,
      hits: stats.hits,
      misses: stats.misses,
      hitRate: stats.hits / (stats.hits + stats.misses) || 0,
      vsize: stats.vsize
    };
  }

  /**
   * Get all cache keys
   * @returns {string[]} Array of cache keys
   */
  static keys() {
    return cache.keys();
  }

  /**
   * Get TTL for a key
   * @param {string} key - Cache key
   * @returns {number} TTL in seconds, or undefined if key doesn't exist
   */
  static getTtl(key) {
    return cache.getTtl(key);
  }
}

// Log cache events
cache.on('set', (key, value) => {
  logDebug(`Cache event: SET ${key}`);
});

cache.on('del', (key, value) => {
  logDebug(`Cache event: DEL ${key}`);
});

cache.on('expired', (key, value) => {
  logDebug(`Cache event: EXPIRED ${key}`);
});

function logDebug(message) {
  if (process.env.NODE_ENV === 'development') {
    console.log(message);
  }
}

module.exports = TTLCache;