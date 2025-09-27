/**
 * Reliability Calculator Utility
 * Calculates forecast reliability scores based on forecast vs actual comparisons
 * Provides accuracy ratings and confidence metrics for TAF predictions
 */

const FACTOR_WEIGHTS = {
  visibility: 0.3,
  ceiling: 0.3,
  weather: 0.25,
  wind: 0.15
};

const TOTAL_AVAILABLE_WEIGHT = Object.values(FACTOR_WEIGHTS).reduce((sum, weight) => sum + weight, 0);

class ReliabilityCalculator {
  /**
   * Calculate overall forecast reliability score
   * @param {object} comparison - Forecast vs actual comparison data
   * @returns {object} Reliability score and rating
   */
  static calculateOverallReliability(comparison) {
    if (!comparison || !comparison.comparisons) {
      return {
        score: 0,
        rating: 'UNKNOWN',
        confidence: 0,
        factors: []
      };
    }

    const factors = [];
    let totalScore = 0;
    let weightSum = 0;

    // Visibility reliability
    if (comparison.comparisons.visibility) {
      const visReliability = this.calculateVisibilityReliability(comparison.comparisons.visibility);
      factors.push({
        type: 'visibility',
        score: visReliability.score,
        weight: FACTOR_WEIGHTS.visibility,
        details: visReliability.details
      });
      totalScore += visReliability.score * FACTOR_WEIGHTS.visibility;
      weightSum += FACTOR_WEIGHTS.visibility;
    }

    // Ceiling reliability
    if (comparison.comparisons.ceiling) {
      const ceilReliability = this.calculateCeilingReliability(comparison.comparisons.ceiling);
      factors.push({
        type: 'ceiling',
        score: ceilReliability.score,
        weight: FACTOR_WEIGHTS.ceiling,
        details: ceilReliability.details
      });
      totalScore += ceilReliability.score * FACTOR_WEIGHTS.ceiling;
      weightSum += FACTOR_WEIGHTS.ceiling;
    }

    // Weather phenomena reliability
    if (comparison.comparisons.weather) {
      const wxReliability = this.calculateWeatherReliability(comparison.comparisons.weather);
      factors.push({
        type: 'weather',
        score: wxReliability.score,
        weight: FACTOR_WEIGHTS.weather,
        details: wxReliability.details
      });
      totalScore += wxReliability.score * FACTOR_WEIGHTS.weather;
      weightSum += FACTOR_WEIGHTS.weather;
    }

    // Wind reliability
    if (comparison.comparisons.wind) {
      const windReliability = this.calculateWindReliability(comparison.comparisons.wind);
      factors.push({
        type: 'wind',
        score: windReliability.score,
        weight: FACTOR_WEIGHTS.wind,
        details: windReliability.details
      });
      totalScore += windReliability.score * FACTOR_WEIGHTS.wind;
      weightSum += FACTOR_WEIGHTS.wind;
    }

    const finalScore = weightSum > 0 ? totalScore / weightSum : 0;
    const rating = this.scoreToRating(finalScore);
  const confidence = this.calculateConfidence(factors, weightSum);

    return {
      score: Math.round(finalScore * 100) / 100,
      rating,
      confidence: Math.round(confidence * 100) / 100,
      factors
    };
  }

  /**
   * Calculate visibility forecast reliability
   * @param {object} visComparison - Visibility comparison data
   * @returns {object} Visibility reliability score and details
   */
  static calculateVisibilityReliability(visComparison) {
    if (!visComparison.forecast || visComparison.actual === null) {
      return { score: 0, details: 'Insufficient data' };
    }

    const forecast = this.parseVisibility(visComparison.forecast);
    const actual = visComparison.actual;

    if (forecast === null || actual === null) {
      return { score: 0, details: 'Unable to parse visibility values' };
    }

    // Calculate percentage error
    const error = Math.abs(forecast - actual);
    const relativeError = actual > 0 ? error / actual : 1;

    let score;
    let details;

    if (relativeError <= 0.1) {
      score = 1.0; // Excellent (within 10%)
      details = 'Excellent accuracy (±10%)';
    } else if (relativeError <= 0.25) {
      score = 0.8; // Good (within 25%)
      details = 'Good accuracy (±25%)';
    } else if (relativeError <= 0.5) {
      score = 0.6; // Fair (within 50%)
      details = 'Fair accuracy (±50%)';
    } else {
      score = 0.3; // Poor (over 50% error)
      details = 'Poor accuracy (>50% error)';
    }

    return {
      score,
      details,
      forecastValue: forecast,
      actualValue: actual,
      error: Math.round(error * 100) / 100,
      relativeError: Math.round(relativeError * 100) / 100
    };
  }

  /**
   * Calculate ceiling forecast reliability
   * @param {object} ceilComparison - Ceiling comparison data
   * @returns {object} Ceiling reliability score and details
   */
  static calculateCeilingReliability(ceilComparison) {
    if (!ceilComparison.forecast || !ceilComparison.actual) {
      return { score: 0, details: 'Insufficient data' };
    }

    const forecastAlt = ceilComparison.forecast.altitude;
    const actualAlt = ceilComparison.actual.altitude;

    if (!forecastAlt || !actualAlt) {
      return { score: 0, details: 'Missing altitude data' };
    }

    const error = Math.abs(forecastAlt - actualAlt);
    let score;
    let details;

    if (error <= 200) {
      score = 1.0; // Excellent (within 200 ft)
      details = 'Excellent accuracy (±200 ft)';
    } else if (error <= 500) {
      score = 0.8; // Good (within 500 ft)
      details = 'Good accuracy (±500 ft)';
    } else if (error <= 1000) {
      score = 0.6; // Fair (within 1000 ft)
      details = 'Fair accuracy (±1000 ft)';
    } else {
      score = 0.3; // Poor (over 1000 ft error)
      details = 'Poor accuracy (>1000 ft error)';
    }

    return {
      score,
      details,
      forecastAltitude: forecastAlt,
      actualAltitude: actualAlt,
      error: error,
      coverageMatch: ceilComparison.forecast.coverage === ceilComparison.actual.coverage
    };
  }

  /**
   * Calculate weather phenomena forecast reliability
   * @param {object} wxComparison - Weather phenomena comparison data
   * @returns {object} Weather reliability score and details
   */
  static calculateWeatherReliability(wxComparison) {
    if (!wxComparison.forecast || wxComparison.actual === undefined) {
      return { score: 0, details: 'Insufficient data' };
    }

    const forecastWx = Array.isArray(wxComparison.forecast) ? wxComparison.forecast : [];
    const actualWx = wxComparison.actual || '';

    // Check for significant weather match
    const significantWx = ['TS', 'SN', 'FZ', 'RA'];
    const forecastSig = forecastWx.filter(wx => significantWx.includes(wx));
    const actualSig = significantWx.filter(wx => actualWx.includes(wx));

    let score;
    let details;

    if (forecastSig.length === 0 && actualSig.length === 0) {
      score = 1.0; // Perfect - no significant weather predicted or observed
      details = 'No significant weather - accurate';
    } else if (forecastSig.length > 0 && actualSig.length > 0) {
      // Both predicted and observed significant weather
      const matches = forecastSig.filter(wx => actualWx.includes(wx));
      const matchRatio = matches.length / Math.max(forecastSig.length, actualSig.length);
      
      if (matchRatio >= 0.8) {
        score = 0.9;
        details = 'Significant weather well predicted';
      } else if (matchRatio >= 0.5) {
        score = 0.7;
        details = 'Significant weather partially predicted';
      } else {
        score = 0.4;
        details = 'Significant weather poorly predicted';
      }
    } else if (forecastSig.length > 0 && actualSig.length === 0) {
      score = 0.5; // False positive - predicted weather didn't occur
      details = 'False positive - predicted weather did not occur';
    } else {
      score = 0.3; // False negative - missed significant weather
      details = 'False negative - missed significant weather';
    }

    return {
      score,
      details,
      forecastPhenomena: forecastWx,
      actualPhenomena: actualWx,
      significantMatch: forecastSig.length > 0 && actualSig.length > 0
    };
  }

  /**
   * Calculate wind forecast reliability
   * @param {object} windComparison - Wind comparison data
   * @returns {object} Wind reliability score and details
   */
  static calculateWindReliability(windComparison) {
    if (!windComparison.forecast || !windComparison.actual) {
      return { score: 0, details: 'Insufficient wind data' };
    }

    const { forecast, actual } = windComparison;

    const forecastSpeed = typeof forecast.speed === 'number' ? forecast.speed : null;
    const actualSpeed = typeof actual.speed === 'number' ? actual.speed : null;

    if (forecastSpeed === null || actualSpeed === null) {
      return { score: 0, details: 'Missing wind speed data' };
    }

    const speedError = Math.abs(forecastSpeed - actualSpeed);
    let speedScore;
    if (speedError <= 5) speedScore = 1.0;
    else if (speedError <= 10) speedScore = 0.75;
    else if (speedError <= 15) speedScore = 0.5;
    else speedScore = 0.3;

    let directionScore = 1.0;
    if (forecast.direction !== 'VRB' && actual.direction !== 'VRB' &&
        typeof forecast.direction === 'number' && typeof actual.direction === 'number') {
      const diff = this.normalizeDirectionDifference(forecast.direction, actual.direction);
      if (diff <= 20) directionScore = 1.0;
      else if (diff <= 45) directionScore = 0.75;
      else if (diff <= 90) directionScore = 0.5;
      else directionScore = 0.25;
    } else if (forecast.direction === 'VRB' || actual.direction === 'VRB') {
      directionScore = 0.6; // Reduced confidence with variable winds
    }

    let gustScore = 1.0;
    if (forecast.gust || actual.gust) {
      const forecastGust = forecast.gust || 0;
      const actualGust = actual.gust || 0;
      const gustError = Math.abs(forecastGust - actualGust);
      if (gustError <= 5) gustScore = 1.0;
      else if (gustError <= 10) gustScore = 0.75;
      else gustScore = 0.4;
    }

    const combinedScore = (speedScore * 0.5) + (directionScore * 0.3) + (gustScore * 0.2);

    return {
      score: Math.round(combinedScore * 100) / 100,
      details: `Wind forecast error: Δspeed ${speedError}kt` +
        (forecast.direction !== 'VRB' && actual.direction !== 'VRB'
          ? `, Δdir ${this.normalizeDirectionDifference(forecast.direction, actual.direction)}°`
          : ''),
      speedError,
      forecastWind: forecast,
      actualWind: actual
    };
  }

  /**
   * Normalize difference between wind directions (0-180)
   * @param {number} dirA - Direction A
   * @param {number} dirB - Direction B
   * @returns {number} Minimum angular difference
   */
  static normalizeDirectionDifference(dirA, dirB) {
    const rawDiff = Math.abs(dirA - dirB) % 360;
    return rawDiff > 180 ? 360 - rawDiff : rawDiff;
  }

  /**
   * Parse visibility value to numeric SM
   * @param {object} visibilityObj - Visibility object with value and unit
   * @returns {number|null} Visibility in statute miles
   */
  static parseVisibility(visibilityObj) {
    if (!visibilityObj || !visibilityObj.value) return null;

    let value = visibilityObj.value;

    // Handle fraction strings like "1/2", "3/4"
    if (typeof value === 'string' && value.includes('/')) {
      const parts = value.split('/');
      if (parts.length === 2) {
        value = parseFloat(parts[0]) / parseFloat(parts[1]);
      }
    } else {
      value = parseFloat(value);
    }

    if (isNaN(value)) return null;

    // Convert to statute miles if needed
    if (visibilityObj.unit === 'M') {
      return value * 0.000621371; // Meters to SM
    } else if (visibilityObj.unit === 'SM') {
      return value;
    }

    return value; // Assume SM if no unit specified
  }

  /**
   * Convert numeric score to rating
   * @param {number} score - Numeric score (0-1)
   * @returns {string} Rating string
   */
  static scoreToRating(score) {
    if (score >= 0.8) return 'HIGH';
    if (score >= 0.6) return 'MEDIUM';
    if (score >= 0.3) return 'LOW';
    return 'VERY_LOW';
  }

  /**
   * Calculate confidence based on available factors
   * @param {Array} factors - Array of reliability factors
   * @returns {number} Confidence score (0-1)
   */
  static calculateConfidence(factors, weightUtilized = 0) {
    if (factors.length === 0) return 0;

    const totalWeight = factors.reduce((sum, factor) => sum + factor.weight, 0);
    const denominator = TOTAL_AVAILABLE_WEIGHT || weightUtilized || 1;

    const weightConfidence = Math.min(1, totalWeight / denominator);
    const scoreVariance = this.calculateScoreVariance(factors);
    
    // Higher variance reduces confidence
    const varianceConfidence = Math.max(0, 1 - scoreVariance);
    
    return (weightConfidence + varianceConfidence) / 2;
  }

  /**
   * Calculate variance in factor scores
   * @param {Array} factors - Array of reliability factors
   * @returns {number} Score variance
   */
  static calculateScoreVariance(factors) {
    if (factors.length <= 1) return 0;

    const scores = factors.map(f => f.score);
    const mean = scores.reduce((sum, score) => sum + score, 0) / scores.length;
    const variance = scores.reduce((sum, score) => sum + Math.pow(score - mean, 2), 0) / scores.length;
    
    return Math.sqrt(variance); // Standard deviation
  }

  /**
   * Generate reliability summary text
   * @param {object} reliability - Reliability calculation result
   * @returns {string} Human-readable reliability summary
   */
  static generateSummary(reliability) {
    if (!reliability || reliability.rating === 'UNKNOWN') {
      return 'Forecast reliability cannot be determined due to insufficient data.';
    }

    // Guard against NaN scores
    const score = isNaN(reliability.score) ? 0 : reliability.score;

    const ratingText = {
      'HIGH': 'highly reliable',
      'MEDIUM': 'moderately reliable', 
      'LOW': 'low reliability',
      'VERY_LOW': 'very low reliability'
    };

    const confidenceText = reliability.confidence >= 0.7 ? 'high confidence' : 
                          reliability.confidence >= 0.5 ? 'moderate confidence' : 'low confidence';

    return `Forecast is ${ratingText[reliability.rating]} (${Math.round(score * 100)}% accuracy) with ${confidenceText}.`;
  }
}

module.exports = ReliabilityCalculator;