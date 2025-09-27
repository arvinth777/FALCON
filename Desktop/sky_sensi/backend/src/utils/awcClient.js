const axios = require('axios');

// Request deduplication cache
const requestCache = new Map();
const CACHE_DURATION = 5000; // 5 seconds

/**
 * Shared AWC client configuration
 */
const awcClient = axios.create({
  baseURL: process.env.AWC_BASE_URL || 'https://aviationweather.gov/api/data',
  headers: {
    'User-Agent': process.env.AWC_USER_AGENT || 'Sky-Sensi-Backend/1.0 (https://github.com/sky-sensi)',
    'Accept': 'application/json'
  },
  timeout: parseInt(process.env.AWC_TIMEOUT_MS || '10000', 10)
});

// Request interceptor for logging and deduplication
awcClient.interceptors.request.use(
  (config) => {
    config.params = sanitizeParams(config.params);
    const requestKey = `${config.method}:${config.url}:${JSON.stringify(config.params || {})}`;
    
    // Check for duplicate requests
    const cached = requestCache.get(requestKey);
    if (cached && Date.now() - cached.timestamp < CACHE_DURATION) {
      if (process.env.NODE_ENV === 'development') {
        console.log(`AWC Request deduplicated: ${config.method?.toUpperCase()} ${config.url}`);
      }
      config._deduped = true;
      config._cachedPromise = cached.promise;
      return config;
    }
    
    if (process.env.NODE_ENV === 'development') {
      console.log(`AWC Request: ${config.method?.toUpperCase()} ${config.url}`);
    }
    
    return config;
  },
  (error) => {
    console.error('AWC Request interceptor error:', error.message);
    return Promise.reject(error);
  }
);

// Response interceptor for standardized error mapping
awcClient.interceptors.response.use(
  (response) => {
    if (process.env.NODE_ENV === 'development') {
      console.log(`AWC Response: ${response.status} ${response.config.url}`);
    }
    return response;
  },
  (error) => {
    // Standardized error mapping
    const standardError = {
      message: error.message,
      status: error.response?.status,
      statusText: error.response?.statusText,
      code: error.code,
      isNetworkError: !error.response,
      isTimeout: error.code === 'ECONNABORTED'
    };
    
    console.error(`AWC Error: ${error.config?.url} - ${error.message}`);
    error.standardized = standardError;
    return Promise.reject(error);
  }
);

/**
 * Retry wrapper with exponential backoff
 * @param {Function} requestFn - Function that makes the request
 * @param {number} maxRetries - Maximum number of retry attempts
 * @param {number} baseDelay - Base delay in milliseconds
 * @returns {Promise} Request result
 */
async function withRetry(requestFn, maxRetries = 3, baseDelay = 1000) {
  let lastError;
  
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      const result = await requestFn();
      return result;
    } catch (error) {
      lastError = error;
      
      // Don't retry on client errors (4xx) or last attempt
      if (attempt === maxRetries || (error.response?.status >= 400 && error.response?.status < 500)) {
        break;
      }
      
      // Only retry on network errors or server errors (5xx)
      if (!error.standardized?.isNetworkError && !error.standardized?.isTimeout && 
          error.response?.status < 500) {
        break;
      }
      
      // Exponential backoff with jitter
      const delay = baseDelay * Math.pow(2, attempt) + Math.random() * 1000;
      console.log(`AWC Retry attempt ${attempt + 1}/${maxRetries} after ${delay}ms`);
      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }
  
  throw lastError;
}

/**
 * Enhanced AWC request with deduplication and retry
 * @param {Object} config - Axios request config
 * @returns {Promise} Request result
 */
async function makeRequest(config) {
  const sanitizedConfig = {
    ...config,
    params: sanitizeParams(config.params)
  };

  const requestKey = `${sanitizedConfig.method || 'GET'}:${sanitizedConfig.url}:${JSON.stringify(sanitizedConfig.params || {})}`;
  
  // Check cache first
  const cached = requestCache.get(requestKey);
  if (cached && Date.now() - cached.timestamp < CACHE_DURATION) {
    return cached.promise;
  }
  
  // Create request promise with retry
  const requestPromise = withRetry(() => awcClient(sanitizedConfig));
  
  // Cache the promise
  requestCache.set(requestKey, {
    promise: requestPromise,
    timestamp: Date.now()
  });
  
  // Clean up cache entry after completion
  requestPromise.finally(() => {
    setTimeout(() => requestCache.delete(requestKey), CACHE_DURATION);
  });
  
  return requestPromise;
}

/**
 * Utility to chunk arrays into smaller arrays
 * @param {Array} array - Array to chunk
 * @param {number} size - Size of each chunk
 * @returns {Array} Array of chunks
 */
function chunk(array, size) {
  if (!Array.isArray(array) || size <= 0) {
    return [];
  }
  
  const chunks = [];
  for (let i = 0; i < array.length; i += size) {
    chunks.push(array.slice(i, i + size));
  }
  return chunks;
}

/**
 * Execute promises with limited concurrency
 * @param {Array} promises - Array of promise factories
 * @param {number} limit - Concurrency limit
 * @returns {Promise<Array>} Array of results
 */
async function limitConcurrency(promises, limit = 3) {
  const results = [];
  for (let i = 0; i < promises.length; i += limit) {
    const batch = promises.slice(i, i + limit);
    const batchResults = await Promise.all(batch.map(promiseFactory => promiseFactory()));
    results.push(...batchResults);
  }
  return results;
}

/**
 * Remove undefined or null query params before calling AWC
 * @param {object} params - Query parameters
 * @returns {object|undefined} Sanitized params
 */
function sanitizeParams(params) {
  if (!params || typeof params !== 'object') {
    return undefined;
  }

  return Object.entries(params).reduce((acc, [key, value]) => {
    if (value !== undefined && value !== null && value !== '') {
      acc[key] = value;
    }
    return acc;
  }, {});
}

function clearRequestCache() {
  requestCache.clear();
}

function getRequestCacheSnapshot() {
  return Array.from(requestCache.entries());
}

module.exports = {
  awcClient,
  makeRequest,
  withRetry,
  chunk,
  limitConcurrency,
  sanitizeParams,
  clearRequestCache,
  getRequestCacheSnapshot
};