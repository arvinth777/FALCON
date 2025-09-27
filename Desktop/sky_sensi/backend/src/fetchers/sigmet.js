const TTLCache = require('../cache/ttlCache');
const { makeRequest } = require('../utils/awcClient');

class SIGMETFetcher {
  /**
   * Fetch SIGMET/AIRMET data within a bounding box
   * @param {string} bboxString - Bounding box string (minLon,minLat,maxLon,maxLat)
   * @returns {Promise<Array>} Array of SIGMET GeoJSON features
   */
  static async fetchSIGMET(bboxString) {
    const normalizedBbox = this.normalizeBoundingBox(bboxString);
    if (!normalizedBbox) {
      return [];
    }

    // Create cache key from bounding box
    const cacheKey = `sigmet:${normalizedBbox}`;
    
    // Check cache first
    const cachedData = TTLCache.get(cacheKey);
    if (cachedData) {
      return cachedData;
    }

    try {
      console.log(`Fetching SIGMET data for bbox: ${normalizedBbox}`);
      
      const response = await makeRequest({
        url: '/airsigmet',
        params: {
          bbox: normalizedBbox,
          format: 'geojson'
        },
        timeout: 15000
      });

      // Handle 204 No Content (no data available)
      if (response.status === 204 || !response.data || !response.data.features) {
        console.log('No SIGMET data available (204 No Content)');
        TTLCache.set(cacheKey, [], 300);
        return [];
      }

      // Extract and normalize SIGMET features
      const sigmetData = response.data.features.map(feature => ({
        id: feature.properties.id,
        type: 'SIGMET',
        phenomenon: this.categorizePhenomenon(feature.properties.hazard),
        severity: feature.properties.severity,
        validFrom: feature.properties.validTimeFrom,
        validTo: feature.properties.validTimeTo,
        altitudeLow: feature.properties.altitudeLow1,
        altitudeHigh: feature.properties.altitudeHigh1,
        geometry: feature.geometry,
        rawText: feature.properties.rawAirSigmet || feature.properties.rawText
      }));

      // Cache the result
      TTLCache.set(cacheKey, sigmetData);
      
      console.log(`Successfully fetched ${sigmetData.length} SIGMETs`);
      return sigmetData;

    } catch (error) {
      console.error('SIGMET fetch error:', error.message);
      
      // Handle rate limiting (429)
      if (error.response && error.response.status === 429) {
        console.log('Rate limited - implementing backoff');
        await this.exponentialBackoff(1500);
        
        // Retry once after backoff
        try {
          const retryResponse = await makeRequest({
            url: '/airsigmet',
            params: {
              bbox: normalizedBbox,
              format: 'geojson'
            },
            timeout: 15000
          });

          if (retryResponse.status === 204 || !retryResponse.data || !retryResponse.data.features) {
            return [];
          }

          const retryData = retryResponse.data.features.map(feature => ({
            id: feature.properties.id,
            type: 'SIGMET',
            phenomenon: this.categorizePhenomenon(feature.properties.hazard),
            severity: feature.properties.severity,
            validFrom: feature.properties.validTimeFrom,
            validTo: feature.properties.validTimeTo,
            altitudeLow: feature.properties.altitudeLow1,
            altitudeHigh: feature.properties.altitudeHigh1,
            geometry: feature.geometry,
            rawText: feature.properties.rawAirSigmet || feature.properties.rawText
          }));

          TTLCache.set(cacheKey, retryData);
          return retryData;

        } catch (retryError) {
          console.error('SIGMET retry failed:', retryError.message);
          throw new Error(`SIGMET fetch failed after retry: ${retryError.message}`);
        }
      }

      throw new Error(`SIGMET fetch failed: ${error.message}`);
    }
  }

  /**
   * Categorize phenomenon from SIGMET hazard field
   * @param {string} hazard - Hazard string from SIGMET properties
   * @returns {string} Categorized phenomenon
   */
  static categorizePhenomenon(hazard) {
    if (!hazard) return 'UNKNOWN';

    const hazardUpper = hazard.toUpperCase();

    if (hazardUpper.includes('TURB')) return 'TURBULENCE';
    if (hazardUpper.includes('ICE')) return 'ICING';
    if (hazardUpper.includes('CONVECTIVE') || hazardUpper.includes('TSTM')) return 'CONVECTIVE';
    if (hazardUpper.includes('MOUNTAIN') || hazardUpper.includes('MTN')) return 'MOUNTAIN_WAVE';
    if (hazardUpper.includes('DUST') || hazardUpper.includes('SAND')) return 'DUST';
    if (hazardUpper.includes('ASH') || hazardUpper.includes('VOLCANIC')) return 'VOLCANIC_ASH';
    if (hazardUpper.includes('IFR')) return 'IFR_CONDITIONS';
    
    return hazard;
  }

  /**
   * Filter SIGMETs by phenomenon type
   * @param {Array} sigmets - Array of SIGMET objects
   * @param {string} phenomenonType - Type of phenomenon to filter by
   * @returns {Array} Filtered SIGMETs
   */
  static filterByPhenomenon(sigmets, phenomenonType) {
    return sigmets.filter(sigmet => 
      sigmet.phenomenon.toUpperCase() === phenomenonType.toUpperCase()
    );
  }

  /**
   * Filter SIGMETs by validity (currently active)
   * @param {Array} sigmets - Array of SIGMET objects
   * @returns {Array} Currently valid SIGMETs
   */
  static filterValid(sigmets) {
    const now = new Date();
    
    return sigmets.filter(sigmet => {
      const validFrom = new Date(sigmet.validFrom);
      const validTo = new Date(sigmet.validTo);
      return now >= validFrom && now <= validTo;
    });
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
   * Normalize bounding box input to string format
   * @param {string|Array<number>} bbox - Bounding box values
   * @returns {string|null} Normalized string or null if invalid
   */
  static normalizeBoundingBox(bbox) {
    if (!bbox) {
      return null;
    }

    if (typeof bbox === 'string') {
      const parts = bbox.split(',').map(Number).filter(num => !Number.isNaN(num));
      if (parts.length === 4) {
        return parts.join(',');
      }
      return null;
    }

    if (Array.isArray(bbox) && bbox.length === 4 && bbox.every(num => typeof num === 'number' && Number.isFinite(num))) {
      return bbox.join(',');
    }

    return null;
  }

  /**
   * Get cache statistics for SIGMET data
   * @returns {object} Cache statistics
   */
  static getCacheStats() {
    const allStats = TTLCache.getStats();
    const sigmetKeys = TTLCache.keys().filter(key => key.startsWith('sigmet:'));
    
    return {
      totalSigmetKeys: sigmetKeys.length,
      overallCacheStats: allStats
    };
  }
}

module.exports = SIGMETFetcher;