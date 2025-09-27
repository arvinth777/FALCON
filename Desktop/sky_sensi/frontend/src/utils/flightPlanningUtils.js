/**
 * Aviation flight planning utility functions
 * Provides AI-powered recommendations for altitude, route optimization, and safety considerations
 */

/**
 * Aircraft performance categories for altitude optimization
 */
const AIRCRAFT_CATEGORIES = {
  LIGHT: {
    minAltitude: 2000,
    maxAltitude: 14000,
    optimalRange: [6000, 10000],
    turbulenceLimit: 'MODERATE'
  },
  MEDIUM: {
    minAltitude: 3000,
    maxAltitude: 25000,
    optimalRange: [8000, 16000],
    turbulenceLimit: 'MODERATE'
  },
  HEAVY: {
    minAltitude: 5000,
    maxAltitude: 41000,
    optimalRange: [25000, 37000],
    turbulenceLimit: 'SEVERE'
  }
};

/**
 * Weather severity scoring for altitude planning
 */
const WEATHER_SEVERITY_WEIGHTS = {
  // Visibility conditions
  visibility: {
    VFR: 0,      // > 5 SM
    MVFR: 2,     // 3-5 SM
    IFR: 5,      // 1-3 SM
    LIFR: 8      // < 1 SM
  },
  // Cloud conditions 
  ceiling: {
    VFR: 0,      // > 3000 ft
    MVFR: 2,     // 1000-3000 ft
    IFR: 5,      // 500-1000 ft
    LIFR: 8      // < 500 ft
  },
  // Wind conditions (knots)
  wind: {
    CALM: 0,     // 0-10 kts
    LIGHT: 1,    // 11-20 kts
    MODERATE: 3, // 21-35 kts
    STRONG: 6,   // 36-50 kts
    SEVERE: 9    // > 50 kts
  },
  // Turbulence intensity
  turbulence: {
    NONE: 0,
    LIGHT: 2,
    MODERATE: 5,
    SEVERE: 8,
    EXTREME: 10
  },
  // Icing conditions
  icing: {
    NONE: 0,
    TRACE: 1,
    LIGHT: 3,
    MODERATE: 6,
    SEVERE: 9
  },
  // Convective activity
  convection: {
    NONE: 0,
    LIGHT: 2,
    MODERATE: 5,
    HEAVY: 8,
    SEVERE: 10
  }
};

/**
 * Get altitude recommendation based on weather conditions and aircraft performance
 * @param {Object} params - Altitude recommendation parameters
 * @param {Object} params.weather - Current and forecast weather conditions
 * @param {Object} params.aircraft - Aircraft performance category and specifications
 * @param {Object} params.route - Route information including distance and waypoints
 * @param {Object} params.preferences - Pilot preferences and constraints
 * @returns {Object} Comprehensive altitude recommendation with reasoning
 */
export const getAltitudeRecommendation = ({
  weather = {},
  aircraft = { category: 'LIGHT', equipmentType: 'VFR' },
  route = { distance: 0, direction: 0 },
  preferences = { comfort: 'MODERATE', fuelEfficiency: 'HIGH' }
}) => {
  try {
    const aircraftSpecs = AIRCRAFT_CATEGORIES[aircraft.category?.toUpperCase()] || AIRCRAFT_CATEGORIES.LIGHT;
    
    // Calculate weather severity score
    const weatherScore = calculateWeatherSeverity(weather);
    
    // Base altitude calculation
    let recommendedAltitudes = calculateBaseAltitudes(aircraftSpecs, route, weatherScore);
    
    // Apply weather-based adjustments
    recommendedAltitudes = applyWeatherAdjustments(recommendedAltitudes, weather, weatherScore);
    
    // Apply aircraft performance constraints
    recommendedAltitudes = applyAircraftConstraints(recommendedAltitudes, aircraftSpecs, aircraft);
    
    // Apply regulatory constraints (hemispheric rule, minimum safe altitude)
    recommendedAltitudes = applyRegulatoryConstraints(recommendedAltitudes, route);
    
    // Prioritize based on preferences
    const finalRecommendation = prioritizeRecommendations(recommendedAltitudes, preferences, weatherScore);
    
    return {
      primary: finalRecommendation,
      alternatives: recommendedAltitudes.filter(alt => alt.altitude !== finalRecommendation.altitude).slice(0, 2),
      weatherScore,
      reasoning: generateRecommendationReasoning(finalRecommendation, weather, weatherScore),
      confidence: calculateConfidenceLevel(weatherScore, aircraft),
      restrictions: generateRestrictions(weather, aircraftSpecs),
      updatedAt: new Date().toISOString()
    };
    
  } catch (error) {
    console.error('Error generating altitude recommendation:', error);
    return {
      primary: null,
      alternatives: [],
      weatherScore: 0,
      reasoning: ['Error calculating altitude recommendation. Using standard practices.'],
      confidence: 'LOW',
      restrictions: ['Unable to process weather data'],
      error: error.message,
      updatedAt: new Date().toISOString()
    };
  }
};

/**
 * Calculate weather severity score
 * @private
 */
function calculateWeatherSeverity(weather) {
  let totalScore = 0;
  let factorCount = 0;
  
  // Visibility/ceiling conditions
  if (weather.flightCategory) {
    totalScore += WEATHER_SEVERITY_WEIGHTS.visibility[weather.flightCategory] || 0;
    factorCount++;
  }
  
  // Wind conditions  
  if (weather.windSpeed !== undefined) {
    const windCategory = categorizeWind(weather.windSpeed);
    totalScore += WEATHER_SEVERITY_WEIGHTS.wind[windCategory] || 0;
    factorCount++;
  }
  
  // Turbulence
  if (weather.turbulence) {
    totalScore += WEATHER_SEVERITY_WEIGHTS.turbulence[weather.turbulence.toUpperCase()] || 0;
    factorCount++;
  }
  
  // Icing
  if (weather.icing) {
    totalScore += WEATHER_SEVERITY_WEIGHTS.icing[weather.icing.toUpperCase()] || 0;
    factorCount++;
  }
  
  // Convective activity
  if (weather.convection || (weather.weather && weather.weather.includes('TS'))) {
    const convectionLevel = weather.convection || 'LIGHT';
    totalScore += WEATHER_SEVERITY_WEIGHTS.convection[convectionLevel.toUpperCase()] || 2;
    factorCount++;
  }
  
  return factorCount > 0 ? Math.round(totalScore / factorCount) : 0;
}

/**
 * Categorize wind speed
 * @private
 */
function categorizeWind(windSpeed) {
  if (windSpeed <= 10) return 'CALM';
  if (windSpeed <= 20) return 'LIGHT';
  if (windSpeed <= 35) return 'MODERATE';
  if (windSpeed <= 50) return 'STRONG';
  return 'SEVERE';
}

/**
 * Calculate base altitude options
 * @private
 */
function calculateBaseAltitudes(aircraftSpecs, route, weatherScore) {
  const baseAltitudes = [];
  const { minAltitude, maxAltitude, optimalRange } = aircraftSpecs;
  
  // Low altitude option (fuel efficient, weather dependent)
  if (weatherScore < 5) {
    baseAltitudes.push({
      altitude: Math.max(minAltitude, optimalRange[0] - 2000),
      type: 'LOW',
      fuelEfficiency: 'HIGH',
      weatherAvoidance: 'MINIMAL',
      comfort: 'MODERATE'
    });
  }
  
  // Optimal altitude (balance of efficiency and weather avoidance)
  baseAltitudes.push({
    altitude: Math.round((optimalRange[0] + optimalRange[1]) / 2 / 1000) * 1000,
    type: 'OPTIMAL',
    fuelEfficiency: 'HIGH',
    weatherAvoidance: 'GOOD',
    comfort: 'HIGH'
  });
  
  // High altitude option (weather avoidance, less efficient for short routes)
  if (route.distance > 100 && weatherScore > 3) {
    baseAltitudes.push({
      altitude: Math.min(maxAltitude, optimalRange[1] + 2000),
      type: 'HIGH',
      fuelEfficiency: 'MODERATE',
      weatherAvoidance: 'EXCELLENT',
      comfort: 'HIGH'
    });
  }
  
  return baseAltitudes;
}

/**
 * Apply weather-based altitude adjustments
 * @private
 */
function applyWeatherAdjustments(altitudes, weather, weatherScore) {
  return altitudes.map(alt => {
    let adjustedAltitude = alt.altitude;
    const adjustments = [];
    
    // Severe weather: recommend higher altitudes
    if (weatherScore >= 7) {
      adjustedAltitude += 4000;
      adjustments.push('Increased altitude for severe weather avoidance');
    } else if (weatherScore >= 5) {
      adjustedAltitude += 2000;
      adjustments.push('Increased altitude for weather avoidance');
    }
    
    // Icing conditions: avoid typical icing altitudes (2000-12000 ft)
    if (weather.icing && weather.icing !== 'NONE') {
      if (adjustedAltitude >= 2000 && adjustedAltitude <= 12000) {
        adjustedAltitude = adjustedAltitude < 7000 ? 14000 : Math.max(adjustedAltitude, 14000);
        adjustments.push('Altitude adjusted to avoid icing conditions');
      }
    }
    
    // Turbulence: climb above typical turbulent layers
    if (weather.turbulence === 'SEVERE' || weather.turbulence === 'EXTREME') {
      adjustedAltitude = Math.max(adjustedAltitude, 15000);
      adjustments.push('Increased altitude to avoid severe turbulence');
    }
    
    return {
      ...alt,
      altitude: adjustedAltitude,
      weatherAdjustments: adjustments
    };
  });
}

/**
 * Apply aircraft performance constraints
 * @private
 */
function applyAircraftConstraints(altitudes, aircraftSpecs, aircraft) {
  return altitudes
    .map(alt => ({
      ...alt,
      altitude: Math.max(aircraftSpecs.minAltitude, Math.min(aircraftSpecs.maxAltitude, alt.altitude))
    }))
    .filter(alt => {
      // Remove altitudes outside aircraft capabilities
      if (aircraft.equipmentType === 'VFR' && alt.altitude > 17999) {
        return false; // Class A airspace requires IFR
      }
      return true;
    });
}

/**
 * Apply regulatory constraints (hemispheric rule, etc.)
 * @private
 */
function applyRegulatoryConstraints(altitudes, route) {
  return altitudes.map(alt => {
    let regulatoryAltitude = alt.altitude;
    const regulations = [];
    
    // Apply hemispheric rule for altitudes above 3000 AGL
    if (regulatoryAltitude >= 3000) {
      const isEastbound = route.direction >= 0 && route.direction < 180;
      
      if (regulatoryAltitude < 18000) {
        // VFR altitudes
        const baseAlt = Math.floor(regulatoryAltitude / 1000) * 1000;
        regulatoryAltitude = isEastbound ? 
          baseAlt + (baseAlt % 2000 === 0 ? 500 : 0) :  // Odd thousands + 500
          baseAlt + (baseAlt % 2000 === 1000 ? 500 : 1500); // Even thousands + 500
        
        regulations.push(`Hemispheric rule applied: ${isEastbound ? 'eastbound' : 'westbound'} altitude`);
      }
    }
    
    return {
      ...alt,
      altitude: regulatoryAltitude,
      regulations
    };
  });
}

/**
 * Prioritize recommendations based on pilot preferences
 * @private
 */
function prioritizeRecommendations(altitudes, preferences, weatherScore) {
  if (altitudes.length === 0) return null;
  
  // Score each altitude based on preferences
  const scoredAltitudes = altitudes.map(alt => {
    let score = 0;
    
    // Fuel efficiency preference
    if (preferences.fuelEfficiency === 'HIGH' && alt.fuelEfficiency === 'HIGH') score += 3;
    if (preferences.fuelEfficiency === 'MODERATE' && alt.fuelEfficiency !== 'LOW') score += 2;
    
    // Comfort preference
    if (preferences.comfort === 'HIGH' && alt.comfort === 'HIGH') score += 2;
    if (preferences.comfort === 'MODERATE' && alt.comfort !== 'LOW') score += 1;
    
    // Weather severity adjustment
    if (weatherScore >= 5 && alt.weatherAvoidance === 'EXCELLENT') score += 4;
    if (weatherScore >= 3 && alt.weatherAvoidance === 'GOOD') score += 2;
    
    return { ...alt, score };
  });
  
  // Return highest scoring altitude
  return scoredAltitudes.reduce((best, current) => 
    current.score > best.score ? current : best
  );
}

/**
 * Generate human-readable reasoning for the recommendation
 * @private
 */
function generateRecommendationReasoning(recommendation, weather, weatherScore) {
  if (!recommendation) return ['Unable to generate recommendation'];
  
  const reasoning = [];
  
  // Primary altitude rationale
  reasoning.push(`Recommended ${recommendation.altitude.toLocaleString()} ft (${recommendation.type.toLowerCase()} altitude)`);
  
  // Weather considerations
  if (weatherScore >= 7) {
    reasoning.push('Severe weather conditions require higher altitude for safety');
  } else if (weatherScore >= 5) {
    reasoning.push('Moderate weather conditions suggest altitude increase for comfort');
  } else if (weatherScore <= 2) {
    reasoning.push('Favorable weather allows for fuel-efficient lower altitude');
  }
  
  // Specific weather factors
  if (weather.icing && weather.icing !== 'NONE') {
    reasoning.push('Altitude selected to minimize icing exposure');
  }
  if (weather.turbulence === 'SEVERE' || weather.turbulence === 'EXTREME') {
    reasoning.push('High altitude recommended to avoid severe turbulence');
  }
  if (weather.windSpeed > 35) {
    reasoning.push('Altitude may help reduce wind effects on flight');
  }
  
  // Performance factors
  if (recommendation.fuelEfficiency === 'HIGH') {
    reasoning.push('Altitude optimized for fuel efficiency');
  }
  
  return reasoning;
}

/**
 * Calculate confidence level for recommendation
 * @private
 */
function calculateConfidenceLevel(weatherScore, aircraft) {
  let confidence = 'HIGH';
  
  if (weatherScore >= 8) confidence = 'LOW';
  else if (weatherScore >= 5) confidence = 'MODERATE';
  
  if (!aircraft.category || aircraft.category === 'UNKNOWN') {
    confidence = confidence === 'HIGH' ? 'MODERATE' : 'LOW';
  }
  
  return confidence;
}

/**
 * Generate flight restrictions and cautions
 * @private
 */
function generateRestrictions(weather, aircraftSpecs) {
  const restrictions = [];
  
  if (weather.flightCategory === 'IFR' || weather.flightCategory === 'LIFR') {
    restrictions.push('IFR flight rules required due to low visibility/ceiling');
  }
  
  if (weather.icing && weather.icing !== 'NONE') {
    restrictions.push('Anti-icing/de-icing equipment required');
  }
  
  if (weather.turbulence === 'SEVERE' || weather.turbulence === 'EXTREME') {
    restrictions.push('Consider delaying flight due to severe turbulence');
  }
  
  if (weather.windSpeed > 50) {
    restrictions.push('Extreme wind conditions - flight not recommended');
  }
  
  return restrictions;
}

export default {
  getAltitudeRecommendation,
  AIRCRAFT_CATEGORIES,
  WEATHER_SEVERITY_WEIGHTS
};