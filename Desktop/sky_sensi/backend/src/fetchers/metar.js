const TTLCache = require('../cache/ttlCache');
const { awcClient, chunk, limitConcurrency } = require('../utils/awcClient');
const { normalizeTimestamp } = require('../utils/timestampUtils');

const BATCH_SIZE = 20; // Chunk size for ICAO codes to avoid URL length issues

class METARFetcher {
  /**
   * Fetch METAR data for multiple ICAO codes
   * @param {Array} icaoCodes - Array of ICAO airport codes
   * @returns {Promise<Array>} Array of METAR data objects
   */
  static async fetchMETAR(icaoCodes) {
    if (!icaoCodes || icaoCodes.length === 0) {
      return [];
    }

    // Create cache key from sorted ICAO codes
    const sortedIds = [...icaoCodes].sort();
    const cacheKey = `metar:${sortedIds.join(',')}`;
    
    // Check cache first
    const cachedData = TTLCache.get(cacheKey);
    if (cachedData) {
      return cachedData;
    }

    try {
      console.log(`Fetching METAR data for: ${icaoCodes.join(', ')}`);
      
      // Split ICAO codes into chunks of BATCH_SIZE
      const chunks = chunk(icaoCodes, BATCH_SIZE);
      console.log(`Split into ${chunks.length} chunks of up to ${BATCH_SIZE} ICAOs each`);

      // Create promise factories for each chunk
      const chunkPromises = chunks.map(chunkIds => () => this.fetchMETARChunk(chunkIds));

      // Execute chunks with limited concurrency (up to 3 concurrent requests)
      const chunkResults = await limitConcurrency(chunkPromises, 3);

      // Merge all chunk results into single array
      const mergedResults = chunkResults.flat();

      // Cache the merged result
      TTLCache.set(cacheKey, mergedResults);
      
      console.log(`Successfully fetched METAR data for ${mergedResults.length} airports from ${chunks.length} chunks`);
      return mergedResults;

    } catch (error) {
      console.error('METAR fetch error:', error.message);
      throw new Error(`METAR fetch failed: ${error.message}`);
    }
  }

  /**
   * Fetch METAR data for a single chunk of ICAO codes
   * @param {Array} chunkIds - Chunk of ICAO codes
   * @returns {Promise<Array>} Array of METAR data objects for this chunk
   */
  static async fetchMETARChunk(chunkIds) {
    try {
      const params = {
        ids: chunkIds.join(','),
        format: 'json'
      };

      const response = await awcClient.get('/metar', {
        params
      });

      // Handle 204 No Content (no data available)
      if (response.status === 204 || !response.data) {
        console.log(`No METAR data available for chunk: ${chunkIds.join(', ')} (204 No Content)`);
        return []; // Return empty array for this chunk
      }

      // Extract essential METAR fields
      const metarData = response.data.map(metar => {
        const rawObservationTime = metar.obsTimeMs ?? metar.obsTime;
        const observationTime = normalizeTimestamp(rawObservationTime, {
          context: `METAR:${metar.icaoId || 'unknown'}.observationTime`
        });
        const visibility = this.normalizeVisibility(metar.visib);
        const windDirection = this.toNumber(metar.wdir);
        const windSpeed = this.toNumber(metar.wspd);
        const windGust = this.toNumber(metar.wgst);

        return {
          icao: metar.icaoId,
          name: metar.name,
          lat: this.toNumber(metar.lat),
          lon: this.toNumber(metar.lon),
          observationTime,
          temperature: this.toNumber(metar.temp),
          dewpoint: this.toNumber(metar.dewp),
          windDirection,
          windSpeed,
          windGust,
          wind: this.buildWindObject(windDirection, windSpeed, windGust),
          visibility,
          visibilityUnits: 'SM',
          altimeter: this.toNumber(metar.altim),
          flightCategory: metar.fltCat, // VFR, MVFR, IFR, LIFR
          rawText: metar.rawOb,
          clouds: Array.isArray(metar.clouds) ? metar.clouds : [],
          presentWeather: metar.wxString || ''
        };
      });

      console.log(`Fetched METAR data for ${metarData.length} airports in chunk: ${chunkIds.join(', ')}`);
      return metarData;

    } catch (error) {
      // Handle rate limiting (429) with backoff and retry
      if (error.response && error.response.status === 429) {
        console.log(`Rate limited for chunk ${chunkIds.join(', ')} - implementing backoff`);
        await this.exponentialBackoff(1000);
        
        // Retry once after backoff
        try {
          const retryParams = {
            ids: chunkIds.join(','),
            format: 'json'
          };

          const retryResponse = await awcClient.get('/metar', {
            params: retryParams
          });

          if (retryResponse.status === 204 || !retryResponse.data) {
            return [];
          }

          const retryData = retryResponse.data.map(metar => {
            const rawObservationTime = metar.obsTimeMs ?? metar.obsTime;
            const observationTime = normalizeTimestamp(rawObservationTime, {
              context: `METAR:${metar.icaoId || 'unknown'}.observationTime`
            });
            const visibility = this.normalizeVisibility(metar.visib);
            const windDirection = this.toNumber(metar.wdir);
            const windSpeed = this.toNumber(metar.wspd);
            const windGust = this.toNumber(metar.wgst);

            return {
              icao: metar.icaoId,
              name: metar.name,
              lat: this.toNumber(metar.lat),
              lon: this.toNumber(metar.lon),
              observationTime,
              temperature: this.toNumber(metar.temp),
              dewpoint: this.toNumber(metar.dewp),
              windDirection,
              windSpeed,
              windGust,
              wind: this.buildWindObject(windDirection, windSpeed, windGust),
              visibility,
              visibilityUnits: 'SM',
              altimeter: this.toNumber(metar.altim),
              flightCategory: metar.fltCat,
              rawText: metar.rawOb,
              clouds: Array.isArray(metar.clouds) ? metar.clouds : [],
              presentWeather: metar.wxString || ''
            };
          });

          console.log(`Retry successful for chunk: ${chunkIds.join(', ')}`);
          return retryData;

        } catch (retryError) {
          console.error(`METAR retry failed for chunk ${chunkIds.join(', ')}:`, retryError.message);
          throw new Error(`METAR chunk fetch failed after retry: ${retryError.message}`);
        }
      }

      console.error(`METAR chunk fetch error for ${chunkIds.join(', ')}:`, error.message);
      throw new Error(`METAR chunk fetch failed: ${error.message}`);
    }
  }

  /**
   * Fetch METAR data for a single airport
   * @param {string} icaoCode - Single ICAO airport code
   * @returns {Promise<object|null>} METAR data object or null if not found
   */
  static async fetchSingleMETAR(icaoCode) {
    const results = await this.fetchMETAR([icaoCode]);
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
   * Convert numeric-like values to numbers if possible
   * @param {number|string|null} value - Value to convert
   * @returns {number|null} Numeric value or null
   */
  static toNumber(value) {
    if (value === null || value === undefined) {
      return null;
    }

    const num = typeof value === 'number' ? value : parseFloat(value);
    return Number.isFinite(num) ? num : null;
  }

  /**
   * Normalize METAR visibility to statute miles
   * @param {number|string|null} visibility - Raw visibility value
   * @returns {number|null} Visibility in SM
   */
  static normalizeVisibility(visibility) {
    if (visibility === null || visibility === undefined) {
      return null;
    }

    if (typeof visibility === 'number') {
      return visibility;
    }

    const cleaned = String(visibility).trim();
    if (cleaned.includes('/')) {
      const [num, denom] = cleaned.split('/').map(Number);
      if (Number.isFinite(num) && Number.isFinite(denom) && denom !== 0) {
        return num / denom;
      }
    }

    const parsed = parseFloat(cleaned);
    return Number.isFinite(parsed) ? parsed : null;
  }

  /**
   * Build wind object with direction, speed, and gust data
   * @param {number|null} direction - Wind direction
   * @param {number|null} speed - Wind speed in knots
   * @param {number|null} gust - Wind gust in knots
   * @returns {object|null} Wind information object
   */
  static buildWindObject(direction, speed, gust) {
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
   * Get cache statistics for METAR data
   * @returns {object} Cache statistics
   */
  static getCacheStats() {
    const allStats = TTLCache.getStats();
    const metarKeys = TTLCache.keys().filter(key => key.startsWith('metar:'));
    
    return {
      totalMetarKeys: metarKeys.length,
      overallCacheStats: allStats
    };
  }
}

module.exports = METARFetcher;