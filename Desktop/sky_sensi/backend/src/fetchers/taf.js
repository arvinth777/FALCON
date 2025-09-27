const TTLCache = require('../cache/ttlCache');
const TAFParser = require('../parsers/tafParser');
const ReliabilityCalculator = require('../utils/reliabilityCalculator');
const { normalizeTimestamp } = require('../utils/timestampUtils');
const { awcClient, chunk, limitConcurrency } = require('../utils/awcClient');

const BATCH_SIZE = 20; // Chunk size for ICAO codes to avoid URL length issues

class TAFFetcher {
  /**
   * Fetch TAF data for multiple ICAO codes
   * @param {Array} icaoCodes - Array of ICAO airport codes
   * @returns {Promise<Array>} Array of TAF data objects with parsed blocks
   */
  static async fetchTAF(icaoCodes) {
    const validCodes = this.validateICAOCodes(icaoCodes);
    if (!validCodes || validCodes.length === 0) {
      return [];
    }

    // Create cache key from sorted ICAO codes
    const sortedIds = [...validCodes].sort();
    const cacheKey = `taf:${sortedIds.join(',')}`;
    
    // Check cache first
    const cachedData = TTLCache.get(cacheKey);
    if (cachedData) {
      return cachedData;
    }

    try {
  console.log(`Fetching TAF data for: ${validCodes.join(', ')}`);
      
      // Split ICAO codes into chunks of BATCH_SIZE
  const chunks = chunk(validCodes, BATCH_SIZE);
      console.log(`Split into ${chunks.length} chunks of up to ${BATCH_SIZE} ICAOs each`);

      // Create promise factories for each chunk
  const chunkPromises = chunks.map(chunkIds => () => this.fetchTAFChunk(chunkIds));

      // Execute chunks with limited concurrency (up to 3 concurrent requests)
      const chunkResults = await limitConcurrency(chunkPromises, 3);

      // Merge all chunk results into single array
      const mergedResults = chunkResults.flat();

      // Cache the merged result
      TTLCache.set(cacheKey, mergedResults);
      
      console.log(`Successfully fetched TAF data for ${mergedResults.length} airports from ${chunks.length} chunks`);
      return mergedResults;

    } catch (error) {
      console.error('TAF fetch error:', error.message);
      throw new Error(`TAF fetch failed: ${error.message}`);
    }
  }

  /**
   * Fetch TAF data for a single chunk of ICAO codes
   * @param {Array} chunkIds - Chunk of ICAO codes
   * @returns {Promise<Array>} Array of TAF data objects for this chunk
   */
  static async fetchTAFChunk(chunkIds) {
    try {
      const response = await awcClient.get('/taf', {
        params: {
          ids: chunkIds.join(','),
          format: 'json'
        }
      });

      // Handle 204 No Content (no data available)
      if (response.status === 204 || !response.data) {
        console.log(`No TAF data available for chunk: ${chunkIds.join(', ')} (204 No Content)`);
        return []; // Return empty array for this chunk
      }

      // Process TAF data and parse forecast blocks
      const tafData = response.data.map(taf => {
        const parsed = TAFParser.parse(taf.rawTAF);

        const normalized = {
          issueTime: normalizeTimestamp(taf.issueTime, { context: `TAF:${taf.icaoId}.issueTime` }),
          bulletinTime: normalizeTimestamp(taf.bulletinTime, { context: `TAF:${taf.icaoId}.bulletinTime` }),
          validTimeFrom: normalizeTimestamp(taf.validTimeFrom, { context: `TAF:${taf.icaoId}.validTimeFrom` }),
          validTimeTo: normalizeTimestamp(taf.validTimeTo, { context: `TAF:${taf.icaoId}.validTimeTo` })
        };

        Object.entries(normalized).forEach(([field, value]) => {
          if (taf[field] && !value) {
            console.warn(`TAF timestamp normalization failed for ${taf.icaoId}.${field}`, taf[field]);
          }
        });

        if (process.env.NODE_ENV === 'development') {
          console.debug('TAF timestamp normalization', {
            icao: taf.icaoId,
            original: {
              issueTime: taf.issueTime,
              bulletinTime: taf.bulletinTime,
              validTimeFrom: taf.validTimeFrom,
              validTimeTo: taf.validTimeTo
            },
            normalized
          });
        }

        return {
          icao: taf.icaoId,
          issueTime: normalized.issueTime,
          bulletinTime: normalized.bulletinTime,
          validTimeFrom: normalized.validTimeFrom,
          validTimeTo: normalized.validTimeTo,
          rawTAF: taf.rawTAF,
          forecastBlocks: parsed.blocks,
          currentBlock: TAFParser.getCurrentBlock(parsed),
          currentBlockIndex: parsed.currentBlockIndex
        };
      });

      console.log(`Fetched TAF data for ${tafData.length} airports in chunk: ${chunkIds.join(', ')}`);
      return tafData;

    } catch (error) {
      // Handle rate limiting (429) with backoff and retry
      if (error.response && error.response.status === 429) {
        console.log(`Rate limited for chunk ${chunkIds.join(', ')} - implementing backoff`);
        await this.exponentialBackoff(1000);
        
        // Retry once after backoff
        try {
          const retryResponse = await awcClient.get('/taf', {
            params: {
              ids: chunkIds.join(','),
              format: 'json'
            }
          });

          if (retryResponse.status === 204 || !retryResponse.data) {
            return [];
          }

          const retryData = retryResponse.data.map(taf => {
            const parsed = TAFParser.parse(taf.rawTAF);

            const normalized = {
              issueTime: normalizeTimestamp(taf.issueTime, { context: `TAF:${taf.icaoId}.issueTime` }),
              bulletinTime: normalizeTimestamp(taf.bulletinTime, { context: `TAF:${taf.icaoId}.bulletinTime` }),
              validTimeFrom: normalizeTimestamp(taf.validTimeFrom, { context: `TAF:${taf.icaoId}.validTimeFrom` }),
              validTimeTo: normalizeTimestamp(taf.validTimeTo, { context: `TAF:${taf.icaoId}.validTimeTo` })
            };

            Object.entries(normalized).forEach(([field, value]) => {
              if (taf[field] && !value) {
                console.warn(`TAF timestamp normalization failed for ${taf.icaoId}.${field} (retry)`, taf[field]);
              }
            });

            return {
              icao: taf.icaoId,
              issueTime: normalized.issueTime,
              bulletinTime: normalized.bulletinTime,
              validTimeFrom: normalized.validTimeFrom,
              validTimeTo: normalized.validTimeTo,
              rawTAF: taf.rawTAF,
              forecastBlocks: parsed.blocks,
              currentBlock: TAFParser.getCurrentBlock(parsed),
              currentBlockIndex: parsed.currentBlockIndex
            };
          });

          console.log(`Retry successful for chunk: ${chunkIds.join(', ')}`);
          return retryData;

        } catch (retryError) {
          console.error(`TAF retry failed for chunk ${chunkIds.join(', ')}:`, retryError.message);
          throw new Error(`TAF chunk fetch failed after retry: ${retryError.message}`);
        }
      }

      console.error(`TAF chunk fetch error for ${chunkIds.join(', ')}:`, error.message);
      throw new Error(`TAF chunk fetch failed: ${error.message}`);
    }
  }

  /**
   * Fetch TAF data for a single airport
   * @param {string} icaoCode - Single ICAO airport code
   * @returns {Promise<object|null>} TAF data object or null if not found
   */
  static async fetchSingleTAF(icaoCode) {
    const results = await this.fetchTAF([icaoCode]);
    return results.length > 0 ? results[0] : null;
  }

  /**
   * Validate ICAO codes format
   * @param {Array} icaoCodes - Array of ICAO codes to validate
   * @returns {Array} Array of valid ICAO codes
   */
  static validateICAOCodes(icaoCodes) {
    if (!Array.isArray(icaoCodes)) {
      return [];
    }

    return icaoCodes.filter(code => 
      typeof code === 'string' &&
      code.length === 4 &&
      /^[A-Z]{4}$/.test(code.toUpperCase())
    ).map(code => code.toUpperCase());
  }

  /**
   * Get forecast comparison for current conditions with reliability scoring
   * @param {object} tafData - TAF data object
   * @param {object} metarData - Current METAR data object
   * @returns {object} Comparison between forecast and actual conditions with reliability
   */
  static compareForecastVsActual(tafData, metarData) {
    if (!tafData || !metarData || !tafData.currentBlock) {
      return null;
    }

    const forecast = tafData.currentBlock;
    const actual = {
      ...metarData,
      visibility: this.normalizeMetarVisibility(metarData.visibility),
      wind: this.extractWindFromMetar(metarData)
    };

    const comparisons = {};

    const comparison = {
      timestamp: new Date().toISOString(),
      icao: tafData.icao,
      forecastBlock: forecast.type,
      comparisons
    };

    // Compare visibility
    const actualVisibility = actual.visibility;
    if (forecast.visibility && actualVisibility !== null) {
      comparisons.visibility = {
        forecast: forecast.visibility,
        actual: actualVisibility,
        match: this.compareVisibility(forecast.visibility, actualVisibility)
      };
    }

    // Compare ceiling
    if (forecast.ceiling && actual.clouds) {
      const actualCeiling = this.extractCeilingFromClouds(actual.clouds);
      comparisons.ceiling = {
        forecast: forecast.ceiling,
        actual: actualCeiling,
        match: this.compareCeiling(forecast.ceiling, actualCeiling)
      };
    }

    // Compare weather phenomena
    if (forecast.weather && forecast.weather.length > 0) {
      comparisons.weather = {
        forecast: forecast.weather,
        actual: actual.presentWeather || '',
        match: this.compareWeatherPhenomena(forecast.weather, actual.presentWeather)
      };
    }

    // Compare winds
    if (forecast.wind && actual.wind) {
      comparisons.wind = {
        forecast: forecast.wind,
        actual: actual.wind,
        match: this.compareWind(forecast.wind, actual.wind)
      };
    }

    // Calculate reliability using new calculator
    const reliability = ReliabilityCalculator.calculateOverallReliability(comparison);
    comparison.reliability = reliability;
    comparison.reliabilitySummary = ReliabilityCalculator.generateSummary(reliability);
    comparison.reliabilityRating = reliability.rating;

    return comparison;
  }

  /**
   * Extract ceiling information from METAR clouds array
   * @param {Array} clouds - Array of cloud layer objects
   * @returns {object|null} Ceiling information
   */
  static extractCeilingFromClouds(clouds) {
    if (!clouds || !Array.isArray(clouds)) return null;

    // Find lowest BKN or OVC layer
    const ceilingLayers = clouds.filter(layer => 
      layer.cover === 'BKN' || layer.cover === 'OVC'
    ).sort((a, b) => a.base - b.base);

    return ceilingLayers.length > 0 ? {
      altitude: ceilingLayers[0].base,
      coverage: ceilingLayers[0].cover
    } : null;
  }

  /**
   * Compare visibility values
   * @param {object} forecast - Forecast visibility
   * @param {number} actual - Actual visibility in statute miles
   * @returns {boolean} True if values match within tolerance
   */
  static compareVisibility(forecast, actual) {
    if (!forecast || actual === null || actual === undefined) return false;

    // Convert forecast to comparable number
    let forecastValue;
    if (forecast.unit === 'SM') {
      if (forecast.greaterThan) {
        forecastValue = parseFloat(forecast.value) || 0;
        return actual >= forecastValue;
      }

      // Handle fractions like 1/2, 3/4
      if (typeof forecast.value === 'string' && forecast.value.includes('/')) {
        const parts = forecast.value.split('/');
        forecastValue = parseInt(parts[0]) / parseInt(parts[1]);
      } else if (typeof forecast.value === 'string' && forecast.value.includes(' ')) {
        // Mixed number e.g., "1 1/2"
        const [whole, fraction] = forecast.value.split(' ');
        const [num, denom] = fraction.split('/').map(Number);
        forecastValue = parseFloat(whole) + (num / denom);
      } else {
        forecastValue = parseFloat(forecast.value);
      }
    } else if (forecast.unit === 'M') {
      // Convert meters to statute miles
      forecastValue = forecast.value * 0.000621371;
    } else {
      return false;
    }

    // Allow 25% tolerance
    const tolerance = Math.max(0.5, forecastValue * 0.25);
    return Math.abs(forecastValue - actual) <= tolerance;
  }

  /**
   * Compare ceiling values
   * @param {object} forecast - Forecast ceiling
   * @param {object} actual - Actual ceiling
   * @returns {boolean} True if values match within tolerance
   */
  static compareCeiling(forecast, actual) {
    if (!forecast || !actual) return false;

    // Allow 500 feet tolerance
    const tolerance = 500;
    return Math.abs(forecast.altitude - actual.altitude) <= tolerance;
  }

  /**
   * Compare weather phenomena
   * @param {Array} forecast - Forecast weather codes
   * @param {string} actual - Actual weather string
   * @returns {boolean} True if significant weather matches
   */
  static compareWeatherPhenomena(forecast, actual) {
    if (!forecast || !actual) return forecast.length === 0 && !actual;

    // Check if any forecast phenomena appear in actual weather
    return forecast.some(phenomenon => actual.includes(phenomenon));
  }

  /**
   * Compare wind forecast to actual wind
   * @param {object} forecast - Forecast wind data
   * @param {object} actual - Actual wind data
   * @returns {boolean} True if wind components align within tolerance
   */
  static compareWind(forecast, actual) {
    if (!forecast || !actual) return false;

    const speedForecast = typeof forecast.speed === 'number' ? forecast.speed : null;
    const speedActual = typeof actual.speed === 'number' ? actual.speed : null;

    if (speedForecast === null || speedActual === null) {
      return false;
    }

    const speedMatch = Math.abs(speedForecast - speedActual) <= 5; // ±5 kt tolerance

    let directionMatch = true;
    if (forecast.direction !== 'VRB' && actual.direction !== 'VRB' &&
        typeof forecast.direction === 'number' && typeof actual.direction === 'number') {
      const diff = Math.abs(forecast.direction - actual.direction);
      directionMatch = diff <= 30 || diff >= 330; // ±30 degrees
    }

    return speedMatch && directionMatch;
  }

  /**
   * Normalize METAR visibility into statute miles
   * @param {number|string|null} visibility - Raw METAR visibility
   * @returns {number|null} Visibility in SM
   */
  static normalizeMetarVisibility(visibility) {
    if (visibility === null || visibility === undefined) {
      return null;
    }

    if (typeof visibility === 'number') {
      return visibility;
    }

    const parsed = parseFloat(String(visibility));
    return Number.isFinite(parsed) ? parsed : null;
  }

  /**
   * Extract actual wind information from METAR data
   * @param {object} metar - METAR data
   * @returns {object|null} Wind object
   */
  static extractWindFromMetar(metar) {
    if (!metar) {
      return null;
    }

    const direction = Number.isFinite(metar.windDirection) ? metar.windDirection : null;
    const speed = Number.isFinite(metar.windSpeed) ? metar.windSpeed : null;
    const gust = Number.isFinite(metar.windGust) ? metar.windGust : null;

    if (direction === null && speed === null && gust === null) {
      return null;
    }

    return {
      direction: direction === null ? 'VRB' : direction,
      speed,
      gust,
      unit: 'KT'
    };
  }

  /**
   * Exponential backoff for rate limiting
   * @param {number} baseDelay - Base delay in milliseconds
   * @param {number} maxRetries - Maximum number of retries
   * @returns {Promise} Promise that resolves after delay
   */
  static async exponentialBackoff(baseDelay, maxRetries = 3) {
    const delay = baseDelay * Math.pow(2, Math.floor(Math.random() * maxRetries));
    await new Promise(resolve => setTimeout(resolve, delay));
  }

  /**
   * Get cache statistics for TAF data
   * @returns {object} Cache statistics
   */
  static getCacheStats() {
    const allStats = TTLCache.getStats();
    const tafKeys = TTLCache.keys().filter(key => key.startsWith('taf:'));
    
    return {
      totalTafKeys: tafKeys.length,
      overallCacheStats: allStats
    };
  }
}

module.exports = TAFFetcher;