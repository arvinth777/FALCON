/**
 * Chart utility functions for TAF timeline and other aviation weather visualizations
 * Handles data transformation, flight category calculations, and formatting
 */

import { getFlightCategory as getFlightCategoryUnified } from './formatters';

export const FLIGHT_CATEGORY_THRESHOLDS = Object.freeze({
  VFR: {
    visibility: 5,
    ceiling: 3000
  },
  MVFR: {
    visibility: 3,
    ceiling: 1000
  },
  IFR: {
    visibility: 1,
    ceiling: 500
  },
  LIFR: {
    visibility: 0,
    ceiling: 200
  }
});

/**
 * Determine flight category from visibility and ceiling conditions (unified proxy)
 * @param {number} visibility - Visibility in statute miles
 * @param {number} ceiling - Ceiling in feet AGL
 * @returns {string} Flight category (VFR, MVFR, IFR, LIFR)
 */
export const flightCategoryFromConditions = (visibility, ceiling) => {
  return getFlightCategoryUnified(visibility, ceiling);
};

/**
 * Get flight category color as hex code for chart rendering
 * @param {string} category - Flight category (VFR, MVFR, IFR, LIFR)
 * @returns {string} Hex color code
 */
export const getFlightCategoryHex = (category) => {
  switch (category?.toUpperCase()) {
    case 'VFR': return '#22c55e';   // Green
    case 'MVFR': return '#eab308';  // Yellow
    case 'IFR': return '#ef4444';   // Red
    case 'LIFR': return '#a855f7';  // Purple
    default: return '#6b7280';      // Gray
  }
};

/**
 * Transform TAF forecasts into timeline chart data
 * @param {Array} tafForecasts - Array of TAF forecast objects
 * @returns {Array} Timeline data formatted for Recharts
 */
export const toTAFTimelineData = (tafForecasts) => {
  if (!Array.isArray(tafForecasts)) return [];

  return tafForecasts.map((forecast, index) => {
    // Parse forecast period with graceful fallbacks
    const startTimeRaw = forecast.validFrom ?? forecast.startTime ?? null;
    const endTimeRaw = forecast.validTo ?? forecast.endTime ?? null;

    const startTime = (() => {
      if (startTimeRaw) {
        const parsed = new Date(startTimeRaw);
        if (!Number.isNaN(parsed.getTime())) {
          return parsed;
        }
      }
      return new Date();
    })();

    const endTime = (() => {
      if (endTimeRaw) {
        const parsed = new Date(endTimeRaw);
        if (!Number.isNaN(parsed.getTime())) {
          return parsed;
        }
      }
      return new Date(Date.now() + 6 * 60 * 60 * 1000);
    })();

    const safeEndTime = endTime <= startTime
      ? new Date(startTime.getTime() + 60 * 60 * 1000)
      : endTime;
    
    // Calculate duration in hours
    const durationHours = Math.max(0.5, (safeEndTime - startTime) / (1000 * 60 * 60));
    
    // Extract weather conditions
    const visibility = forecast.visibility || forecast.prevailingVisibility || 10;
    const ceiling = forecast.ceiling || forecast.cloudCeiling || 5000;
    
    // Determine flight category
    const flightCategory = flightCategoryFromConditions(visibility, ceiling);
    
    // Format time display
    const timeDisplay = `${startTime.getHours().toString().padStart(2, '0')}:${startTime.getMinutes().toString().padStart(2, '0')}`;
    const dateDisplay = startTime.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    
    // Parse change types
    const changeType = forecast.changeType || forecast.type || 'BASE';
    const probability = forecast.probability || null;
    
    return {
      id: `forecast-${index}`,
      timeDisplay,
      dateDisplay,
      fullTimeDisplay: `${dateDisplay} ${timeDisplay}`,
      startTime: startTime.getTime(),
  endTime: safeEndTime.getTime(),
      durationHours: Math.round(durationHours * 10) / 10,
      flightCategory,
      flightCategoryColor: getFlightCategoryHex(flightCategory),
      visibility: Math.round(visibility * 10) / 10,
      ceiling: Math.round(ceiling),
      windSpeed: forecast.windSpeed || 0,
      windDirection: forecast.windDirection || 0,
      windGust: forecast.windGust || null,
      temperature: forecast.temperature || null,
      dewpoint: forecast.dewpoint || null,
      altimeter: forecast.altimeter || null,
      weather: Array.isArray(forecast.weather) ? forecast.weather : [],
      clouds: Array.isArray(forecast.clouds) ? forecast.clouds : [],
      rawText: forecast.rawText || forecast.text || '',
      changeType,
      probability,
      airportCode: forecast.airportCode || null,
      airportName: forecast.airportName || null,
      // Chart display value - using duration for bar height
      value: durationHours,
      // Grouping for multi-airport displays
      group: forecast.airportCode || 'Unknown'
    };
  }).sort((a, b) => a.startTime - b.startTime);
};

/**
 * Format timeline tooltip content
 * @param {Object} data - Timeline data point
 * @param {boolean} showDetails - Whether to show detailed information
 * @returns {Object} Formatted tooltip data
 */
export const formatTimelineTooltip = (data, showDetails = true) => {
  if (!data) return null;

  const tooltip = {
    title: data.fullTimeDisplay,
    subtitle: data.changeType !== 'BASE' ? `${data.changeType}${data.probability ? ` ${data.probability}%` : ''}` : null,
    items: []
  };

  // Basic flight conditions
  tooltip.items.push({
    label: 'Category',
    value: data.flightCategory,
    color: data.flightCategoryColor,
    type: 'category'
  });

  tooltip.items.push({
    label: 'Duration',
    value: `${data.durationHours}h`,
    type: 'duration'
  });

  if (showDetails) {
    // Detailed conditions
    tooltip.items.push({
      label: 'Visibility',
      value: `${data.visibility} SM`,
      type: 'visibility'
    });

    tooltip.items.push({
      label: 'Ceiling',
      value: `${data.ceiling} ft`,
      type: 'ceiling'
    });

    if (data.windSpeed > 0) {
      const windStr = data.windGust ? 
        `${data.windDirection}°/${data.windSpeed}G${data.windGust} kt` :
        `${data.windDirection}°/${data.windSpeed} kt`;
      
      tooltip.items.push({
        label: 'Wind',
        value: windStr,
        type: 'wind'
      });
    }

    if (data.temperature !== null && data.temperature !== undefined) {
      tooltip.items.push({
        label: 'Temperature',
        value: `${data.temperature}°C`,
        type: 'temperature'
      });
    }

    if (data.weather.length > 0) {
      tooltip.items.push({
        label: 'Weather',
        value: data.weather.join(', '),
        type: 'weather'
      });
    }
  }

  return tooltip;
};

/**
 * Calculate timeline summary statistics
 * @param {Array} timelineData - Array of timeline data points
 * @returns {Object} Summary statistics
 */
export const calculateTimelineStats = (timelineData) => {
  if (!Array.isArray(timelineData) || timelineData.length === 0) {
    return {
      totalDuration: 0,
      worstCategory: 'VFR',
      totalPeriods: 0,
      changeEvents: 0,
      averageVisibility: 10,
      averageCeiling: 5000
    };
  }

  const stats = {
    totalDuration: 0,
    worstCategory: 'VFR',
    totalPeriods: timelineData.length,
    changeEvents: 0,
    averageVisibility: 0,
    averageCeiling: 0
  };

  let totalVis = 0;
  let totalCeil = 0;
  let visCount = 0;
  let ceilCount = 0;

  // Category priority for determining worst conditions
  const categoryPriority = { 'VFR': 0, 'MVFR': 1, 'IFR': 2, 'LIFR': 3 };
  let worstPriority = -1;

  timelineData.forEach(item => {
    stats.totalDuration += item.durationHours;
    
    // Track worst category
    const priority = categoryPriority[item.flightCategory] || 0;
    if (priority > worstPriority) {
      worstPriority = priority;
      stats.worstCategory = item.flightCategory;
    }

    // Count change events
    if (item.changeType !== 'BASE') {
      stats.changeEvents++;
    }

    // Average visibility and ceiling
    if (item.visibility > 0) {
      totalVis += item.visibility;
      visCount++;
    }
    if (item.ceiling > 0) {
      totalCeil += item.ceiling;
      ceilCount++;
    }
  });

  stats.totalDuration = Math.round(stats.totalDuration * 10) / 10;
  stats.averageVisibility = visCount > 0 ? Math.round((totalVis / visCount) * 10) / 10 : 10;
  stats.averageCeiling = ceilCount > 0 ? Math.round(totalCeil / ceilCount) : 5000;

  return stats;
};

/**
 * Group timeline data by airport for multi-airport displays
 * @param {Array} timelineData - Array of timeline data points
 * @returns {Object} Data grouped by airport code
 */
export const groupTimelineByAirport = (timelineData) => {
  if (!Array.isArray(timelineData)) return {};

  const grouped = {};
  
  timelineData.forEach(item => {
    const airport = item.airportCode || 'Unknown';
    if (!grouped[airport]) {
      grouped[airport] = {
        airportCode: airport,
        airportName: item.airportName || airport,
        forecasts: [],
        stats: null
      };
    }
    grouped[airport].forecasts.push(item);
  });

  // Calculate stats for each airport
  Object.keys(grouped).forEach(airport => {
    grouped[airport].stats = calculateTimelineStats(grouped[airport].forecasts);
  });

  return grouped;
};

/**
 * Generate time axis ticks for timeline charts
 * @param {number} startTime - Start time in milliseconds
 * @param {number} endTime - End time in milliseconds
 * @param {number} maxTicks - Maximum number of ticks to generate
 * @returns {Array} Array of tick values and labels
 */
export const generateTimeAxisTicks = (startTime, endTime, maxTicks = 12) => {
  const duration = endTime - startTime;
  const interval = duration / maxTicks;
  const ticks = [];

  for (let i = 0; i <= maxTicks; i++) {
    const tickTime = startTime + (i * interval);
    const date = new Date(tickTime);
    
    ticks.push({
      value: tickTime,
      label: `${date.getHours().toString().padStart(2, '0')}:${date.getMinutes().toString().padStart(2, '0')}`,
      fullLabel: date.toLocaleString('en-US', {
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      })
    });
  }

  return ticks;
};

/**
 * Validate and sanitize TAF forecast data
 * @param {Object} forecast - Raw forecast object
 * @returns {Object} Sanitized forecast object
 */
export const sanitizeForecastData = (forecast) => {
  if (!forecast || typeof forecast !== 'object') {
    return null;
  }

  return {
    validFrom: forecast.validFrom || forecast.startTime || null,
    validTo: forecast.validTo || forecast.endTime || null,
    visibility: Math.max(0, parseFloat(forecast.visibility || forecast.prevailingVisibility || 10)),
    ceiling: Math.max(0, parseInt(forecast.ceiling || forecast.cloudCeiling || 5000)),
    windSpeed: Math.max(0, parseInt(forecast.windSpeed || 0)),
    windDirection: Math.max(0, Math.min(360, parseInt(forecast.windDirection || 0))),
    windGust: forecast.windGust ? Math.max(0, parseInt(forecast.windGust)) : null,
    temperature: forecast.temperature !== undefined ? parseFloat(forecast.temperature) : null,
    dewpoint: forecast.dewpoint !== undefined ? parseFloat(forecast.dewpoint) : null,
    altimeter: forecast.altimeter !== undefined ? parseFloat(forecast.altimeter) : null,
    weather: Array.isArray(forecast.weather) ? forecast.weather : [],
    clouds: Array.isArray(forecast.clouds) ? forecast.clouds : [],
    changeType: forecast.changeType || forecast.type || 'BASE',
    probability: forecast.probability ? Math.max(0, Math.min(100, parseInt(forecast.probability))) : null,
    rawText: forecast.rawText || forecast.text || '',
    airportCode: forecast.airportCode || null,
    airportName: forecast.airportName || null
  };
};

/**
 * Format timestamp for chart time axis
 * @param {number} timestamp - Unix timestamp in milliseconds
 * @param {boolean} includeDate - Whether to include date in format
 * @returns {string} Formatted time string
 */
export const formatChartTime = (timestamp, includeDate = false) => {
  if (!timestamp || isNaN(timestamp)) return '';
  
  try {
    const date = new Date(timestamp);
    
    if (includeDate) {
      return date.toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      });
    }
    
    return `${date.getHours().toString().padStart(2, '0')}:${date.getMinutes().toString().padStart(2, '0')}Z`;
  } catch (error) {
    console.error('Error formatting chart time:', error);
    return '';
  }
};

export default {
  flightCategoryFromConditions,
  getFlightCategoryHex,
  toTAFTimelineData,
  formatTimelineTooltip,
  calculateTimelineStats,
  groupTimelineByAirport,
  generateTimeAxisTicks,
  sanitizeForecastData,
  formatChartTime,
  FLIGHT_CATEGORY_THRESHOLDS
};