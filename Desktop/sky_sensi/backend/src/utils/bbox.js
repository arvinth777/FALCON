/**
 * Bounding box calculation utility for aviation weather queries
 * Calculates geographic boundaries for PIREP and SIGMET/ISIGMET searches
 */

class BoundingBox {
  /**
   * Calculate bounding box from array of airport coordinates
   * @param {Array} coordinates - Array of {lat, lon} objects
   * @param {number} bufferDegrees - Buffer to add around bounding box (default: 1.5 degrees)
   * @returns {object} Bounding box with minLat, maxLat, minLon, maxLon
   */
  static calculate(coordinates, bufferDegrees = 1.5) {
    this.assertValidCoordinates(coordinates);

    // Find min/max coordinates
    let minLat = coordinates[0].lat;
    let maxLat = coordinates[0].lat;
    let minLon = coordinates[0].lon;
    let maxLon = coordinates[0].lon;

    coordinates.forEach(coord => {
      if (coord.lat < minLat) minLat = coord.lat;
      if (coord.lat > maxLat) maxLat = coord.lat;
      if (coord.lon < minLon) minLon = coord.lon;
      if (coord.lon > maxLon) maxLon = coord.lon;
    });

    // Apply buffer
    minLat = Math.max(-90, minLat - bufferDegrees);
    maxLat = Math.min(90, maxLat + bufferDegrees);
    minLon = Math.max(-180, minLon - bufferDegrees);
    maxLon = Math.min(180, maxLon + bufferDegrees);

    return {
      minLat,
      maxLat,
      minLon,
      maxLon
    };
  }

  /**
   * Format bounding box for Aviation Weather Center API
   * @param {object} bbox - Bounding box object
   * @returns {string} Formatted bounding box string (minLon,minLat,maxLon,maxLat)
   */
  static formatForAPI(bbox) {
    return `${bbox.minLon},${bbox.minLat},${bbox.maxLon},${bbox.maxLat}`;
  }

  /**
   * Calculate bounding box from array of coordinates and return API-formatted string
   * @param {Array} coordinates - Array of {lat, lon} objects
   * @param {number} bufferDegrees - Buffer to add around bounding box
   * @returns {string} API-formatted bounding box string
   */
  static calculateAndFormat(coordinates, bufferDegrees = 1.5) {
    const bbox = this.calculate(coordinates, bufferDegrees);
    return this.formatForAPI(bbox);
  }

  /**
   * Handle edge cases like routes crossing international date line
   * @param {Array} coordinates - Array of {lat, lon} objects
   * @param {number} bufferDegrees - Buffer to add around bounding box
   * @returns {object|Array} Single bounding box or array of bounding boxes for date line crossing
   */
  static calculateWithDateLine(coordinates, bufferDegrees = 1.5) {
    this.assertValidCoordinates(coordinates);

    // Check if route crosses international date line
    const longitudes = coordinates.map(coord => coord.lon);
    const lonSpan = Math.max(...longitudes) - Math.min(...longitudes);
    
    // If longitude span is greater than 180 degrees, likely crossing date line
    if (lonSpan > 180) {
      // For simplicity in demo, return a large bounding box covering the Pacific
      // In production, this would need more sophisticated handling
      console.warn('Route appears to cross international date line - using Pacific-wide bounding box');
      const westernHemisphere = coordinates.filter(coord => coord.lon <= 0);
      const easternHemisphere = coordinates.filter(coord => coord.lon >= 0);

      if (westernHemisphere.length === 0 || easternHemisphere.length === 0) {
        return {
          minLat: Math.max(-90, Math.min(...coordinates.map(c => c.lat)) - bufferDegrees),
          maxLat: Math.min(90, Math.max(...coordinates.map(c => c.lat)) + bufferDegrees),
          minLon: -180,
          maxLon: 180,
          crossesDateLine: true
        };
      }

      return [
        { ...this.calculate(westernHemisphere, bufferDegrees), crossesDateLine: true },
        { ...this.calculate(easternHemisphere, bufferDegrees), crossesDateLine: true }
      ];
    }

    // Normal case - no date line crossing
    return { ...this.calculate(coordinates, bufferDegrees), crossesDateLine: false };
  }

  /**
   * Calculate and format bounding box while handling date line
   * @param {Array} coordinates - Array of {lat, lon}
  * @param {number} bufferDegrees - Buffer to add around bounding box
   * @returns {string|string[]} Formatted bounding box string(s)
   */
  static calculateWithDateLineFormatted(coordinates, bufferDegrees = 1.5) {
    const result = this.calculateWithDateLine(coordinates, bufferDegrees);

    if (Array.isArray(result)) {
      return result.map(bbox => this.formatForAPI(bbox));
    }

    return this.formatForAPI(result);
  }

  /**
   * Validate coordinates array
   * @param {Array} coordinates - Array of {lat, lon} objects
   * @returns {boolean} True if valid
   */
  static validateCoordinates(coordinates) {
    if (!Array.isArray(coordinates) || coordinates.length === 0) {
      return false;
    }

    return coordinates.every(coord => 
      coord && 
      typeof coord.lat === 'number' && 
      typeof coord.lon === 'number' &&
      coord.lat >= -90 && coord.lat <= 90 &&
      coord.lon >= -180 && coord.lon <= 180
    );
  }

  /**
   * Throw a descriptive error when coordinates invalid
   * @param {Array} coordinates
   */
  static assertValidCoordinates(coordinates) {
    if (!this.validateCoordinates(coordinates)) {
      throw new Error('Invalid coordinates provided for bounding box calculation');
    }
  }

  /**
   * Calculate the approximate area of a bounding box in square degrees
   * @param {object} bbox - Bounding box object
   * @returns {number} Area in square degrees
   */
  static calculateArea(bbox) {
    const latSpan = bbox.maxLat - bbox.minLat;
    const lonSpan = bbox.maxLon - bbox.minLon;
    return latSpan * lonSpan;
  }
}

module.exports = BoundingBox;