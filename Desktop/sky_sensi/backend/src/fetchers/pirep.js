const TTLCache = require('../cache/ttlCache');
const { makeRequest } = require('../utils/awcClient');
const { normalizeTimestamp } = require('../utils/timestampUtils');

const DEFAULT_TTL_SECONDS = 300;

class PIREPFetcher {
  /**
   * Fetch PIREP data within a bounding box
   * @param {string} bboxString - Bounding box string (minLon,minLat,maxLon,maxLat)
   * @returns {Promise<Array>} Array of PIREP data objects
   */
  static async fetchPIREP(bboxString) {
    const normalizedBbox = this.normalizeBoundingBox(bboxString);
    if (!normalizedBbox) {
      return [];
    }

    // Create cache key from bounding box
    const cacheKey = `pirep:${normalizedBbox}`;
    
    // Check cache first
    const cachedData = TTLCache.get(cacheKey);
    if (cachedData) {
      return cachedData;
    }

    try {
      console.log(`Fetching PIREP data for bbox: ${normalizedBbox}`);
      
      const response = await makeRequest({
        url: '/pirep',
        params: {
          bbox: normalizedBbox,
          format: 'json'
        },
        timeout: 15000 // PIREPs can be slower
      });

      // Handle 204 No Content (no data available)
      if (response.status === 204 || !response.data) {
        console.log('No PIREP data available (204 No Content)');
        TTLCache.set(cacheKey, [], DEFAULT_TTL_SECONDS); // Cache empty result for 5 minutes
        return [];
      }

      const rawPireps = Array.isArray(response.data) ? response.data : [];
      const pirepData = rawPireps
        .map(pirep => this.normalizePirepRecord(pirep))
        .filter(Boolean);

      console.log('Normalized PIREPs generated:', pirepData.length);

      // Cache the result
  TTLCache.set(cacheKey, pirepData, DEFAULT_TTL_SECONDS);
      
      console.log(`Successfully fetched ${pirepData.length} PIREPs`);
      return pirepData;

    } catch (error) {
      console.error('PIREP fetch error:', error.message);
      
      // Handle rate limiting (429)
      if (error.response && error.response.status === 429) {
        console.log('Rate limited - implementing backoff');
        await this.exponentialBackoff(1500); // Longer delay for PIREPs
        
        // Retry once after backoff
        try {
          const retryResponse = await makeRequest({
            url: '/pirep',
            params: {
              bbox: normalizedBbox,
              format: 'json'
            },
            timeout: 15000
          });

          if (retryResponse.status === 204 || !retryResponse.data) {
            return [];
          }

          const retryRaw = Array.isArray(retryResponse.data) ? retryResponse.data : [];
          const retryData = retryRaw
            .map(pirep => this.normalizePirepRecord(pirep))
            .filter(Boolean);

          TTLCache.set(cacheKey, retryData, DEFAULT_TTL_SECONDS);
          return retryData;

        } catch (retryError) {
          console.error('PIREP retry failed:', retryError.message);
          throw new Error(`PIREP fetch failed after retry: ${retryError.message}`);
        }
      }

      throw new Error(`PIREP fetch failed: ${error.message}`);
    }
  }

  /**
   * Parse altitude string (e.g., "FL250", "050", "UKN")
   * @param {string} altitudeStr - Altitude string from PIREP
   * @returns {object|null} Parsed altitude information
   */
  static parseAltitude(altitudeStr) {
    if (!altitudeStr || altitudeStr === 'UKN') {
      return null;
    }

    // Flight Level (FL250 = 25,000 feet)
    if (altitudeStr.startsWith('FL')) {
      const fl = parseInt(altitudeStr.substring(2));
      return {
        value: fl * 100,
        type: 'FL',
        feet: fl * 100
      };
    }

    // Direct altitude in hundreds of feet
    const altitude = parseInt(altitudeStr);
    if (!isNaN(altitude)) {
      return {
        value: altitude * 100,
        type: 'MSL',
        feet: altitude * 100
      };
    }

    return null;
  }

  /**
   * Categorize weather phenomenon from PIREP text
   * @param {string} rawText - Raw PIREP text
   * @returns {Array} Array of categorized phenomena
   */
  static categorizePhenomenon(rawText) {
    if (!rawText) return [];

    const phenomena = [];
    const text = rawText.toUpperCase();

    // Turbulence indicators
    if (text.includes('TURB') || text.includes('TB') || text.includes('CHOP')) {
      phenomena.push('TURBULENCE');
    }

    // Icing indicators
    if (text.includes('ICE') || text.includes('IC') || text.includes('RIME') || text.includes('MIXED')) {
      phenomena.push('ICING');
    }

    // Cloud/visibility indicators
    if (text.includes('IMC') || text.includes('IFR') || text.includes('BKN') || text.includes('OVC')) {
      phenomena.push('CLOUDS');
    }

    // Precipitation
    if (text.includes('RAIN') || text.includes('SNOW') || text.includes('PRECIP')) {
      phenomena.push('PRECIPITATION');
    }

    // Wind/shear
    if (text.includes('WIND') || text.includes('SHEAR') || text.includes('GUST')) {
      phenomena.push('WIND');
    }

    // Convective activity
    if (text.includes('TSTM') || text.includes('CONVECTIVE') || text.includes('CB')) {
      phenomena.push('CONVECTIVE');
    }

    return phenomena;
  }

  /**
   * Extract intensity information from PIREP text
   * @param {string} rawText - Raw PIREP text
   * @returns {string|null} Intensity level
   */
  static extractIntensity(rawText) {
    if (!rawText) return null;

    const text = rawText.toUpperCase();

    // Intensity keywords in order of severity
    if (text.includes('SEVERE') || text.includes('SVR') || text.includes('EXTREME')) {
      return 'SEVERE';
    }
    if (text.includes('MODERATE') || text.includes('MOD')) {
      return 'MODERATE';
    }
    if (text.includes('LIGHT') || text.includes('LGT')) {
      return 'LIGHT';
    }
    if (text.includes('TRACE') || text.includes('TRC')) {
      return 'TRACE';
    }
    if (text.includes('SMOOTH') || text.includes('SMT')) {
      return 'SMOOTH';
    }

    return null;
  }

  static convertToFlightLevel(altitude, rawAltitude) {
    if (!altitude && rawAltitude) {
      altitude = this.parseAltitude(rawAltitude);
    }

    if (!altitude) {
      return null;
    }

    if (typeof altitude === 'number' && Number.isFinite(altitude)) {
      return Math.round(altitude / 100);
    }

    if (typeof altitude === 'object' && typeof altitude.feet === 'number') {
      return Math.round(altitude.feet / 100);
    }

    return null;
  }

  static getPrimaryPhenomenon(phenomena) {
    if (!Array.isArray(phenomena) || phenomena.length === 0) {
      return 'OTHER';
    }

    const priority = ['TURBULENCE', 'ICING', 'CONVECTIVE', 'PRECIPITATION', 'WIND', 'CLOUDS'];
    for (const key of priority) {
      if (phenomena.includes(key)) {
        return key;
      }
    }

    return phenomena[0] || 'OTHER';
  }

  static normalizePirepRecord(pirep) {
    if (!pirep || typeof pirep !== 'object') {
      console.warn('Skipping malformed PIREP record: missing object');
      return null;
    }

    const { lat, lon } = pirep;
    if (lat === undefined || lon === undefined || lat === null || lon === null) {
      console.warn('Skipping PIREP due to missing coordinates:', pirep.pirepId || pirep.rawOb || 'unknown');
      return null;
    }

    const numericLat = Number(lat);
    const numericLon = Number(lon);
    if (!Number.isFinite(numericLat) || !Number.isFinite(numericLon) ||
      numericLat < -90 || numericLat > 90 || numericLon < -180 || numericLon > 180) {
      console.warn('Skipping PIREP due to invalid coordinate range:', {
        id: pirep.pirepId,
        lat: pirep.lat,
        lon: pirep.lon
      });
      return null;
    }

    const altitude = this.parseAltitude(pirep.fltlvl);
    const phenomena = this.categorizePhenomenon(pirep.rawOb) || [];
    const intensity = this.extractIntensity(pirep.rawOb) || 'UNKNOWN';
    const primaryPhenomenon = this.getPrimaryPhenomenon(phenomena);
    const flightLevel = this.convertToFlightLevel(altitude, pirep.fltlvl);
    const normalizedTime = normalizeTimestamp(pirep.obsTime, { context: `PIREP:${pirep.pirepId || 'unknown'}.obsTime` });

    if (pirep.obsTime && !normalizedTime) {
      console.warn('PIREP timestamp normalization failed:', {
        id: pirep.pirepId || 'unknown',
        obsTime: pirep.obsTime
      });
    }

    if (process.env.NODE_ENV === 'development') {
      console.debug('PIREP timestamp normalization', {
        id: pirep.pirepId || 'unknown',
        original: pirep.obsTime,
        normalized: normalizedTime
      });
    }

    const normalized = {
      id: pirep.pirepId,
  lat: numericLat,
  lon: numericLon,
      fl: flightLevel,
      type: primaryPhenomenon,
      intensity,
      time: normalizedTime,
      aircraftType: pirep.acType || null,
      reportType: pirep.reportType || null,
      rawText: pirep.rawOb || null,
      phenomenon: phenomena,
      _legacy: {
        reportTime: normalizedTime,
        rawReportTime: pirep.obsTime,
  latitude: numericLat,
  longitude: numericLon,
        altitude,
        altitudeFt: altitude?.feet ?? null,
        aircraftType: pirep.acType,
        reportType: pirep.reportType,
        phenomenon: phenomena,
        phenomenonText: phenomena.join(', '),
        intensity,
        severity: intensity,
        location: pirep.location,
        rawText: pirep.rawOb
      }
    };

    if (normalized.fl === null) {
      console.warn('PIREP missing derived flight level:', normalized.id || 'unknown');
    }

    return normalized;
  }

  /**
   * Filter PIREPs by phenomenon type
   * @param {Array} pireps - Array of PIREP objects
   * @param {string} phenomenonType - Type of phenomenon to filter by
   * @returns {Array} Filtered PIREPs
   */
  static filterByPhenomenon(pireps, phenomenonType) {
    if (!Array.isArray(pireps) || !phenomenonType) {
      return [];
    }

    const target = phenomenonType.toUpperCase();

    return pireps.filter(pirep => {
      if (!pirep || typeof pirep !== 'object') {
        return false;
      }

      const typeMatch = typeof pirep.type === 'string' && pirep.type.toUpperCase() === target;
      const legacyMatch = Array.isArray(pirep.phenomenon) &&
        pirep.phenomenon.some(item => typeof item === 'string' && item.toUpperCase() === target);

      return typeMatch || legacyMatch;
    });
  }

  /**
   * Filter PIREPs by time (hours ago)
   * @param {Array} pireps - Array of PIREP objects
   * @param {number} hoursAgo - Maximum age in hours
   * @returns {Array} Filtered PIREPs
   */
  static filterByAge(pireps, hoursAgo = 6) {
    const cutoffTime = new Date(Date.now() - (hoursAgo * 60 * 60 * 1000));
    
    return pireps.filter(pirep => {
      const reportTimeValue = pirep.time ?? pirep._legacy?.reportTime ?? pirep.obsTime;
      if (!reportTimeValue) {
        return false;
      }

      const reportTime = new Date(reportTimeValue);
      return reportTime >= cutoffTime;
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
   * Normalize different bounding box inputs to API string
   * @param {string|Array<number>} bbox - Bounding box input
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
   * Get cache statistics for PIREP data
   * @returns {object} Cache statistics
   */
  static getCacheStats() {
    const allStats = TTLCache.getStats();
    const pirepKeys = TTLCache.keys().filter(key => key.startsWith('pirep:'));
    
    return {
      totalPirepKeys: pirepKeys.length,
      overallCacheStats: allStats
    };
  }
}

module.exports = PIREPFetcher;