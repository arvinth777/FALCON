import axios from 'axios'
import { assertValidBriefing } from '../utils/validation.js'

const resolveBooleanFlag = (value, defaultValue = false) => {
  if (value === undefined || value === null) {
    return defaultValue;
  }
  return String(value).toLowerCase() === 'true';
};

const safeNumber = (value, fallback) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
};

const API_TIMEOUT_MS = safeNumber(import.meta.env.VITE_API_TIMEOUT, 30000);
const ENABLE_DEBUG_LOGS = resolveBooleanFlag(import.meta.env.VITE_ENABLE_DEBUG_LOGS);
const NODE_ENV = import.meta.env.VITE_ENV || import.meta.env.MODE;

// Create axios instance with base configuration
const api = axios.create({
  baseURL: import.meta.env.VITE_API_BASE_URL || 'http://localhost:3001/api',
  timeout: API_TIMEOUT_MS,
  headers: {
    'Content-Type': 'application/json',
  }
});

// Request interceptor for logging and debugging
api.interceptors.request.use(
  (config) => {
    if (ENABLE_DEBUG_LOGS) {
      console.log(`API Request: ${config.method?.toUpperCase()} ${config.url}`);
    }
    return config;
  },
  (error) => {
    if (NODE_ENV === 'development') {
      console.error('API Request Error:', error);
    }
    return Promise.reject(error);
  }
);

// Response interceptor for error handling
api.interceptors.response.use(
  (response) => {
    return response.data;
  },
  (error) => {
    if (NODE_ENV === 'development') {
      console.error('API Response Error:', error);
    }
    
    // Handle different error types
    if (error.code === 'ECONNABORTED') {
      throw new Error('Request timed out - weather service may be slow');
    }
    
    if (!error.response) {
      throw new Error('Network error - check your connection');
    }
    
  const status = error.response.status;
  const message = error.response.data?.error || error.response.data?.message || 'Unknown error';
    
    switch (status) {
      case 400:
        throw new Error(`Invalid request: ${message}`);
      case 404:
        throw new Error('Weather service not found');
      case 429:
        throw new Error('Too many requests - please wait and try again');
      case 500:
        throw new Error(`Server error: ${message}`);
      case 502:
      case 503: {
        if (error.response.data?.code === 'AI_SERVICE_UNAVAILABLE') {
          throw new Error('AI briefing unavailable - configure GEMINI_API_KEY to enable AI features.');
        }
        throw new Error('Weather service temporarily unavailable');
      }
      default:
        throw new Error(`Request failed: ${message}`);
    }
  }
);

const unwrapApiData = (payload) => {
  if (payload && typeof payload === 'object' && 'data' in payload) {
    return payload.data;
  }
  return payload;
};

/**
 * Fetch weather briefing for the specified route
 * @param {string} route - Comma-separated ICAO airport codes
 * @returns {Promise<Object>} Weather briefing data with AI analysis
 */
const ROUTE_PATTERN = /^[A-Z]{4}(?:,[A-Z]{4})*$/;

const normalizeRoute = (rawRoute) => {
  const cleaned = rawRoute.trim().replace(/\s+/g, '').toUpperCase();
  if (!ROUTE_PATTERN.test(cleaned)) {
    throw new Error('Route must be a comma-separated list of ICAO airport codes (e.g., KLAX,KSFO).');
  }
  return cleaned;
};

export const fetchBriefing = async (route) => {
  const cleanRoute = normalizeRoute(route);

  return withRetry(() => {
    return api.get('/briefing', {
      params: { route: cleanRoute }
    });
  })
    .then(unwrapApiData)
    .then((data) => {
      try {
        return assertValidBriefing(data);
      } catch (error) {
        throw new Error(error?.message || 'Received invalid briefing data from server.');
      }
    });
};

/**
 * Send a chat message to the AI system for weather-related Q&A
 * @param {string} question - Pilot's question about the weather
 * @param {Object} briefingData - Current weather briefing context
 * @returns {Promise<Object>} AI response with answer and recommendations
 */
const CHAT_ENDPOINT = '/ai/chat';

export const sendChatMessage = async (question, briefingData) => {
  const trimmedQuestion = question.trim();
  if (!trimmedQuestion) {
    throw new Error('Please enter a question for the AI copilot.');
  }

  return withRetry(() => {
    return api.post(CHAT_ENDPOINT, {
      question: trimmedQuestion,
      briefingData: {
        route: briefingData.route,
        generatedAt: briefingData.generatedAt,
        // Include aiSummary if available
        aiSummary: briefingData.aiSummary,
        // Include essential context without full raw data to reduce payload
        summary: briefingData.summary,
        airports: briefingData.airports,
        // Include rawData under correct path structure
        rawData: {
          metarsByIcao: briefingData.rawData?.metarsByIcao || briefingData.metarsByIcao,
          tafsByIcao: briefingData.rawData?.tafsByIcao || briefingData.tafsByIcao
        },
        hazards: briefingData.hazards
      }
    });
  }).then(unwrapApiData);
};

/**
 * Retry a failed API request with exponential backoff
 * @param {Function} apiCall - The API function to retry
 * @param {number} maxRetries - Maximum number of retry attempts
 * @param {number} baseDelay - Base delay in milliseconds
 * @returns {Promise} The result of the successful API call
 */
export const withRetry = async (apiCall, maxRetries = 3, baseDelay = 1000) => {
  let lastError;
  
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await apiCall();
    } catch (error) {
      lastError = error;
      
      // Don't retry on client errors (4xx)
      if (error.message.includes('Invalid request') || 
          error.message.includes('Weather service not found')) {
        throw error;
      }
      
      // Don't retry on the last attempt
      if (attempt === maxRetries) {
        break;
      }
      
      // Calculate delay with exponential backoff and jitter
      const delay = baseDelay * Math.pow(2, attempt) + Math.random() * 1000;
      if (NODE_ENV === 'development') {
        console.log(`API retry attempt ${attempt + 1}/${maxRetries} in ${Math.round(delay)}ms`);
      }
      
      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }
  
  throw lastError;
};

/**
 * Check if the API service is healthy
 * @returns {Promise<boolean>} True if service is healthy
 */
export const checkHealth = async () => {
  try {
    await api.get('/health', { timeout: 5000 });
    return true;
  } catch (error) {
    if (NODE_ENV === 'development') {
      console.warn('API health check failed:', error.message);
    }
    return false;
  }
};

export default api;