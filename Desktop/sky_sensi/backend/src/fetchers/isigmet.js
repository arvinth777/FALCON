const { makeRequest } = require('../utils/awcClient');
const TTLCache = require('../cache/ttlCache');
const { normalizeTimestamp } = require('../utils/timestampUtils');
const { isValidGeometry } = require('../utils/geo');

class ISIGMETFetcher {
  static getCacheTTLSeconds() {
    const parsed = parseInt(process.env.ISIGMET_CACHE_TTL_SECONDS, 10);
    if (!Number.isNaN(parsed) && parsed > 0) {
      return parsed;
    }

    return 300; // Default to five minutes if not configured
  }

  /**
   * Fetch International SIGMET data within a bounding box
   * @param {string} bboxString - Bounding box string (minLon,minLat,maxLon,maxLat)
   * @returns {Promise<Array>} Array of International SIGMET GeoJSON features
   */
  static async fetchISIGMET(bboxString) {
    const normalizedBbox = this.normalizeBoundingBox(bboxString);
    if (!normalizedBbox) {
      return [];
    }

    if (!this.isBoundingBoxStringValid(normalizedBbox)) {
      console.warn('Skipping ISIGMET fetch due to invalid bbox format:', normalizedBbox);
      return [];
    }

    // Create cache key from bounding box
    const cacheKey = `isigmet:${normalizedBbox}`;
    
    // Check cache first
    const cachedData = TTLCache.get(cacheKey);
    if (cachedData) {
      return cachedData;
    }

    const bboxSegments = this.splitBoundingBox(normalizedBbox);
    if (bboxSegments.length === 0) {
      console.warn('ISIGMET bbox normalization produced no segments');
      return [];
    }

    const seenIds = new Set();
    const combinedResults = [];

    for (const segment of bboxSegments) {
      const segmentResults = await this.fetchGeoJsonSegment(segment);
      for (const entry of segmentResults) {
        if (!entry?.id || seenIds.has(entry.id)) {
          continue;
        }
        seenIds.add(entry.id);
        combinedResults.push(entry);
      }
    }

    const ttlSeconds = this.getCacheTTLSeconds();
    TTLCache.set(cacheKey, combinedResults, ttlSeconds);

    console.log(`Successfully fetched ${combinedResults.length} International SIGMETs across ${bboxSegments.length} segment(s)`);
    return combinedResults;
  }

  static splitBoundingBox(bboxString) {
    const parts = bboxString.split(',').map(Number);
    if (parts.length !== 4 || parts.some(num => Number.isNaN(num))) {
      return [];
    }

    const [minLon, minLat, maxLon, maxLat] = parts;

    if (minLon <= maxLon) {
      return [bboxString];
    }

    return [
      [minLon, minLat, 180, maxLat].join(','),
      [-180, minLat, maxLon, maxLat].join(',')
    ];
  }

  static async fetchGeoJsonSegment(bboxString) {
    const requestParams = {
      bbox: bboxString,
      format: 'geojson'
    };

    const logContext = { endpoint: '/isigmet', params: requestParams };

    try {
      console.log('ISIGMET API call:', logContext);
      const response = await makeRequest({
        url: '/isigmet',
        params: requestParams,
        timeout: 15000
      });

      if (response.status === 204 || !response.data || !response.data.features) {
        console.log('No International SIGMET data available (204 No Content)');
        return [];
      }

      const features = Array.isArray(response.data.features) ? response.data.features : [];
      console.log('Raw ISIGMET features received:', features.length, 'for bbox', bboxString);

      const normalizedFeatures = features.map(feature => this.transformFeature(feature)).filter(Boolean);
      const droppedCount = features.length - normalizedFeatures.length;
      if (droppedCount > 0) {
        console.warn('Dropped ISIGMET features during normalization:', droppedCount, 'for bbox', bboxString);
      }

      return normalizedFeatures;
    } catch (error) {
      const status = error.response?.status;
      const errorMsg = status
        ? `International SIGMET fetch error (status ${status}) for bbox ${bboxString}: ${error.message}`
        : `International SIGMET fetch error for bbox ${bboxString}: ${error.message}`;

      console.error(errorMsg);

      if (status === 429) {
        console.log('Rate limited - implementing backoff');
        await this.exponentialBackoff(1500);

        try {
          const retryResponse = await makeRequest({
            url: '/isigmet',
            params: requestParams,
            timeout: 15000
          });

          if (retryResponse.status === 204 || !retryResponse.data || !retryResponse.data.features) {
            return [];
          }

          const retryFeatures = Array.isArray(retryResponse.data.features) ? retryResponse.data.features : [];
          console.log('Raw ISIGMET features received on retry:', retryFeatures.length, 'for bbox', bboxString);
          return retryFeatures.map(feature => this.transformFeature(feature)).filter(Boolean);
        } catch (retryError) {
          console.error(`International SIGMET retry failed for bbox ${bboxString}:`, retryError.message);
          throw new Error(`International SIGMET fetch failed after retry for bbox ${bboxString}: ${retryError.message}`);
        }
      }

      if (status === 400) {
        throw new Error(`International SIGMET fetch failed: AWC API rejected bbox ${bboxString} (400 Bad Request)`);
      }

      throw new Error(`International SIGMET fetch failed for bbox ${bboxString}: ${error.message}`);
    }
  }

  /**
   * Categorize phenomenon from International SIGMET hazard field
   * @param {string} hazard - Hazard string from ISIGMET properties
   * @returns {string} Categorized phenomenon
   */
  static categorizePhenomenon(hazard) {
    if (!hazard) return 'UNKNOWN';

    const hazardUpper = hazard.toUpperCase();

    if (hazardUpper.includes('TURB')) return 'TURBULENCE';
    if (hazardUpper.includes('ICE')) return 'ICING';
    if (hazardUpper.includes('CONVECTIVE') || hazardUpper.includes('TSTM')) return 'CONVECTIVE';
    if (hazardUpper.includes('TROPICAL') || hazardUpper.includes('CYCLONE')) return 'TROPICAL_CYCLONE';
    if (hazardUpper.includes('DUST') || hazardUpper.includes('SAND')) return 'DUST';
    if (hazardUpper.includes('ASH') || hazardUpper.includes('VOLCANIC')) return 'VOLCANIC_ASH';
    if (hazardUpper.includes('RADIOACTIVE')) return 'RADIOACTIVE';
    
    return hazard;
  }

  /**
   * Filter International SIGMETs by Flight Information Region (FIR)
   * @param {Array} isigmets - Array of International SIGMET objects
   * @param {string} firCode - FIR code to filter by
   * @returns {Array} Filtered International SIGMETs
   */
  static filterByFIR(isigmets, firCode) {
    return isigmets.filter(isigmet => 
      isigmet.fir && isigmet.fir.toUpperCase() === firCode.toUpperCase()
    );
  }

  /**
   * Filter International SIGMETs by phenomenon type
   * @param {Array} isigmets - Array of International SIGMET objects
   * @param {string} phenomenonType - Type of phenomenon to filter by
   * @returns {Array} Filtered International SIGMETs
   */
  static filterByPhenomenon(isigmets, phenomenonType) {
    return isigmets.filter(isigmet => 
      isigmet.phenomenon.toUpperCase() === phenomenonType.toUpperCase()
    );
  }

  /**
   * Filter International SIGMETs by validity (currently active)
   * @param {Array} isigmets - Array of International SIGMET objects
   * @returns {Array} Currently valid International SIGMETs
   */
  static filterValid(isigmets) {
    const now = new Date();
    
    return isigmets.filter(isigmet => {
      const validFrom = new Date(isigmet.validFrom);
      const validTo = new Date(isigmet.validTo);
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
   * Normalize bounding box inputs to expected string format
   * @param {string|Array<number>} bbox - Bounding box input
   * @returns {string|null} Normalized bounding box
   */
  static normalizeBoundingBox(bbox) {
    if (!bbox) {
      return null;
    }

    if (typeof bbox === 'string') {
      const parts = bbox.split(',').map(Number).filter(num => !Number.isNaN(num));
      return parts.length === 4 ? parts.join(',') : null;
    }

    if (Array.isArray(bbox) && bbox.length === 4 && bbox.every(num => typeof num === 'number' && Number.isFinite(num))) {
      return bbox.join(',');
    }

    return null;
  }

  /**
   * Validate bounding box string format (minLon,minLat,maxLon,maxLat)
   * @param {string} bboxString - Bounding box string
    * @returns {boolean} True if format appears valid
   */
  static isBoundingBoxStringValid(bboxString) {
    if (!bboxString || typeof bboxString !== 'string') {
      return false;
    }

    const parts = bboxString.split(',').map(Number);
    if (parts.length !== 4 || parts.some(num => Number.isNaN(num))) {
      return false;
    }

    const [minLon, minLat, maxLon, maxLat] = parts;

    const lonRangeValid =
      minLon >= -180 && minLon <= 180 &&
      maxLon >= -180 && maxLon <= 180;

    const latRangeValid =
      minLat >= -90 && minLat <= 90 &&
      maxLat >= -90 && maxLat <= 90 &&
      minLat <= maxLat;

    return lonRangeValid && latRangeValid;
  }

  /**
   * Validate GeoJSON geometry from API response
   * @param {object} geometry - GeoJSON geometry
   * @returns {boolean} True when geometry appears well-formed
   */
  /**
   * Transform GeoJSON feature into normalized ISIGMET record
   * @param {object} feature - GeoJSON feature from API
   * @returns {object|null} Normalized ISIGMET object or null if invalid
   */
  static transformFeature(feature) {
    if (!feature || typeof feature !== 'object') {
      console.warn('Skipping ISIGMET feature: missing feature object');
      return null;
    }

  const properties = feature.properties || {};
  const requiredProps = ['id', 'hazard', 'validTimeFrom', 'validTimeTo'];
    const missingProp = requiredProps.find(prop => properties[prop] === undefined || properties[prop] === null);
    if (missingProp) {
      console.warn('Skipping ISIGMET feature due to missing property:', missingProp);
      return null;
    }

    if (!isValidGeometry(feature.geometry)) {
      console.warn('Skipping ISIGMET feature due to invalid geometry:', properties.id);
      return null;
    }

  const validFrom = this.normalizeValidTime(properties.validTimeFrom, 'validTimeFrom', properties.id);
  const validTo = this.normalizeValidTime(properties.validTimeTo, 'validTimeTo', properties.id);

    if (!validFrom || !validTo) {
      console.warn('Skipping ISIGMET feature due to invalid valid time range:', properties.id);
      return null;
    }

    return {
      id: properties.id,
      type: 'ISIGMET',
      phenomenon: this.categorizePhenomenon(properties.hazard),
      severity: properties.severity || 'UNKNOWN',
      validFrom,
      validTo,
      altitudeLow: properties.altitudeLow1,
      altitudeHigh: properties.altitudeHigh1,
      geometry: feature.geometry,
      fir: properties.fir,
      rawText: properties.rawIntlSigmet || properties.rawText
    };
  }

  static normalizeValidTime(value, fieldName, featureId) {
    if (value === undefined || value === null) {
      console.warn('Missing ISIGMET valid time field:', fieldName, 'for feature', featureId || 'unknown');
      return null;
    }

    const normalized = normalizeTimestamp(value, { context: `ISIGMET:${featureId || 'unknown'}.${fieldName}` });

    if (!normalized) {
      console.warn('Invalid ISIGMET valid time field:', fieldName, 'value:', value, 'for feature', featureId || 'unknown');
    } else if (process.env.NODE_ENV === 'development') {
      console.debug('ISIGMET timestamp normalization', {
        id: featureId || 'unknown',
        field: fieldName,
        original: value,
        normalized
      });
    }

    return normalized;
  }

  /**
   * Get cache statistics for International SIGMET data
   * @returns {object} Cache statistics
   */
  static getCacheStats() {
    const allStats = TTLCache.getStats();
    const isigmetKeys = TTLCache.keys().filter(key => key.startsWith('isigmet:'));
    
    return {
      totalIsigmetKeys: isigmetKeys.length,
      overallCacheStats: allStats
    };
  }
}

module.exports = ISIGMETFetcher;