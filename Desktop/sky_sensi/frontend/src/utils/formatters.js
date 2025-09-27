/**
 * Formatting utilities for aviation weather data display
 * Handles time formatting, weather data presentation, and pilot-friendly displays
 */

/**
 * PAVE-consistent flight category thresholds
 */
const FLIGHT_CATEGORY_THRESHOLDS = {
  VFR: { visibility: 5, ceiling: 3000 },   // > 5 SM vis, > 3000 ft ceiling
  MVFR: { visibility: 3, ceiling: 1000 },  // 3-5 SM vis, 1000-3000 ft ceiling  
  IFR: { visibility: 1, ceiling: 500 },    // 1-3 SM vis, 500-1000 ft ceiling
  LIFR: { visibility: 0, ceiling: 0 }      // < 1 SM vis, < 500 ft ceiling
};

/**
 * Flight category color mappings
 */
const FLIGHT_CATEGORIES = {
  VFR: { 
    color: 'bg-green-100 text-green-800',
    hex: '#10b981' 
  },
  MVFR: { 
    color: 'bg-yellow-100 text-yellow-800',
    hex: '#f59e0b' 
  },
  IFR: { 
    color: 'bg-red-100 text-red-800',
    hex: '#ef4444' 
  },
  LIFR: { 
    color: 'bg-purple-100 text-purple-800',
    hex: '#8b5cf6' 
  }
};

/**
 * Determine flight category from visibility and ceiling (PAVE-consistent)
 * @param {number} visibility - Visibility in statute miles
 * @param {number} ceiling - Ceiling in feet AGL
 * @returns {string} Flight category (VFR, MVFR, IFR, LIFR)
 */
export const getFlightCategory = (visibility, ceiling) => {
  // Handle missing or invalid values
  const vis = visibility != null && !isNaN(visibility) ? visibility : 10;
  const ceil = ceiling != null && !isNaN(ceiling) ? ceiling : 5000;

  // LIFR: Visibility < 1 SM and/or ceiling < 500 feet
  if (vis < 1 || ceil < 500) {
    return 'LIFR';
  }
  
  // IFR: Visibility 1 to < 3 SM and/or ceiling 500 to < 1000 feet  
  if (vis < 3 || ceil < 1000) {
    return 'IFR';
  }
  
  // MVFR: Visibility 3 to 5 SM and/or ceiling 1000 to 3000 feet
  if (vis < 5 || ceil < 3000) {
    return 'MVFR';
  }
  
  // VFR: Visibility > 5 SM and ceiling > 3000 feet
  return 'VFR';
};

/**
 * Get flight category color as hex code for charts
 * @param {string} category - Flight category
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
 * Weather phenomena descriptions for pilot understanding
 */
const WEATHER_PHENOMENA = {
  // Precipitation
  'RA': 'Rain',
  'DZ': 'Drizzle', 
  'SN': 'Snow',
  'SG': 'Snow Grains',
  'IC': 'Ice Crystals',
  'PL': 'Ice Pellets',
  'GR': 'Hail',
  'GS': 'Small Hail',
  'UP': 'Unknown Precipitation',
  
  // Obscuration
  'FG': 'Fog',
  'BR': 'Mist',
  'HZ': 'Haze',
  'FU': 'Smoke',
  'VA': 'Volcanic Ash',
  'DU': 'Dust',
  'SA': 'Sand',
  'PY': 'Spray',
  
  // Other
  'SQ': 'Squalls',
  'FC': 'Funnel Cloud/Tornado',
  'SS': 'Sandstorm',
  'DS': 'Duststorm',
  'TS': 'Thunderstorm'
};

/**
 * Intensity prefixes
 */
const INTENSITY_PREFIXES = {
  '-': 'Light',
  '': 'Moderate', 
  '+': 'Heavy',
  'VC': 'Vicinity'
};

/**
 * Format UTC time to local display format
 * @param {string|Date} utcTime - UTC time string or Date object
 * @param {boolean} includeDate - Whether to include date in output
 * @returns {string} Formatted time string
 */
export const formatTime = (utcTime, includeDate = false) => {
  if (!utcTime) return 'N/A';
  
  try {
    const date = typeof utcTime === 'string' ? new Date(utcTime) : utcTime;
    
    if (isNaN(date.getTime())) {
      return 'Invalid time';
    }

    const options = {
      hour: '2-digit',
      minute: '2-digit',
      timeZoneName: 'short'
    };

    if (includeDate) {
      options.month = 'short';
      options.day = 'numeric';
    }

    return date.toLocaleString('en-US', options);
  } catch (error) {
    console.error('Time formatting error:', error);
    return 'Invalid time';
  }
};

/**
 * Format UTC time for aviation (Zulu time)
 * @param {string|Date} utcTime - UTC time
 * @returns {string} Time in HHMM Z format
 */
export const formatZuluTime = (utcTime) => {
  if (!utcTime) return 'N/A';
  
  try {
    const date = typeof utcTime === 'string' ? new Date(utcTime) : utcTime;
    
    if (isNaN(date.getTime())) {
      return 'Invalid';
    }

    const hours = date.getUTCHours().toString().padStart(2, '0');
    const minutes = date.getUTCMinutes().toString().padStart(2, '0');
    
    return `${hours}${minutes}Z`;
  } catch (error) {
    return 'Invalid';
  }
};

/**
 * Format visibility for pilot display
 * @param {number|Object} visibility - Visibility value or object
 * @returns {string} Formatted visibility string
 */
export const formatVisibility = (visibility) => {
  if (!visibility && visibility !== 0) return 'N/A';
  
  if (typeof visibility === 'object') {
    if (visibility.distanceSm !== undefined) {
      return formatVisibility(visibility.distanceSm);
    }
    if (visibility.distance !== undefined) {
      return formatVisibility(visibility.distance);
    }
  }
  
  const vis = parseFloat(visibility);
  if (isNaN(vis)) return 'N/A';
  
  if (vis >= 10) return '10+ SM';
  if (vis >= 1) return `${vis.toFixed(vis % 1 === 0 ? 0 : 1)} SM`;
  if (vis >= 0.25) return `${(vis * 4).toFixed(0)}/4 SM`;
  return `${vis.toFixed(2)} SM`;
};

/**
 * Format ceiling height for pilot display
 * @param {number|Object} ceiling - Ceiling value or object
 * @returns {string} Formatted ceiling string
 */
export const formatCeiling = (ceiling) => {
  if (!ceiling && ceiling !== 0) return 'Clear';
  
  if (typeof ceiling === 'object') {
    if (ceiling.heightAgl !== undefined) {
      return formatCeiling(ceiling.heightAgl);
    }
    if (ceiling.height !== undefined) {
      return formatCeiling(ceiling.height);
    }
  }
  
  const height = parseInt(ceiling);
  if (isNaN(height)) return 'N/A';
  
  if (height >= 12000) return 'Clear';
  return `${height.toLocaleString()} ft`;
};

/**
 * Format wind information for display
 * @param {Object} wind - Wind data object
 * @returns {string} Formatted wind string
 */
export const formatWind = (wind) => {
  if (!wind) return 'Calm';
  
  const { direction, speed, gust, variable } = wind;
  
  if (variable) {
    return 'Variable';
  }
  
  if (!speed || speed === 0) {
    return 'Calm';
  }
  
  const dir = direction ? direction.toString().padStart(3, '0') : 'VRB';
  const spd = Math.round(speed);
  
  if (gust && gust > speed) {
    return `${dir}° at ${spd} gusts ${Math.round(gust)} kt`;
  }
  
  return `${dir}° at ${spd} kt`;
};

/**
 * Format weather phenomena for pilot understanding
 * @param {string} wxString - Weather string (like -RASN)
 * @returns {string} Human-readable weather description
 */
export const formatWeatherPhenomena = (wxString) => {
  if (!wxString || typeof wxString !== 'string') return '';
  
  let description = '';
  let remaining = wxString.trim();
  
  // Handle intensity
  if (remaining.startsWith('-') || remaining.startsWith('+')) {
    const intensity = remaining.charAt(0);
    description += INTENSITY_PREFIXES[intensity] + ' ';
    remaining = remaining.slice(1);
  } else if (remaining.startsWith('VC')) {
    description += INTENSITY_PREFIXES['VC'] + ' ';
    remaining = remaining.slice(2);
  }
  
  // Handle weather phenomena (2-character codes)
  const phenomena = [];
  while (remaining.length >= 2) {
    const code = remaining.slice(0, 2);
    if (WEATHER_PHENOMENA[code]) {
      phenomena.push(WEATHER_PHENOMENA[code]);
      remaining = remaining.slice(2);
    } else {
      break;
    }
  }
  
  if (phenomena.length > 0) {
    description += phenomena.join(' and ');
  } else if (remaining) {
    description += remaining; // Unknown phenomenon
  }
  
  return description.trim() || 'Unknown weather';
};

/**
 * Determine flight category based on visibility and ceiling (PAVE-consistent)
 * @param {number} visibility - Visibility in statute miles
 * @param {number} ceiling - Ceiling height in feet AGL
 * @returns {string} Flight category (VFR, MVFR, IFR, LIFR)
 */
export const getFlightCategoryLegacy = (visibility, ceiling) => {
  // Convert visibility to number if it's an object
  let vis = visibility;
  if (typeof visibility === 'object' && visibility.distanceSm) {
    vis = visibility.distanceSm;
  }
  vis = parseFloat(vis);
  
  // Convert ceiling to number if it's an object  
  let ceil = ceiling;
  if (typeof ceiling === 'object' && ceiling.heightAgl) {
    ceil = ceiling.heightAgl;
  }
  ceil = parseInt(ceil);
  
  // Handle missing data
  if (isNaN(vis) || isNaN(ceil)) {
    return 'UNKNOWN';
  }
  
  // Use new centralized logic
  return getFlightCategory(vis, ceil);
};

/**
 * Format temperature for display
 * @param {number} tempC - Temperature in Celsius
 * @param {boolean} includeFahrenheit - Whether to include Fahrenheit
 * @returns {string} Formatted temperature string
 */
export const formatTemperature = (tempC, includeFahrenheit = false) => {
  if (tempC === null || tempC === undefined || isNaN(tempC)) {
    return 'N/A';
  }
  
  const celsius = Math.round(tempC);
  
  if (includeFahrenheit) {
    const fahrenheit = Math.round((tempC * 9/5) + 32);
    return `${celsius}°C (${fahrenheit}°F)`;
  }
  
  return `${celsius}°C`;
};

/**
 * Format pressure/altimeter setting for display
 * @param {number} pressure - Pressure in inHg
 * @returns {string} Formatted pressure string
 */
export const formatPressure = (pressure) => {
  if (!pressure || isNaN(pressure)) return 'N/A';
  
  return `${pressure.toFixed(2)}" Hg`;
};

/**
 * Format relative humidity for display
 * @param {number} humidity - Humidity percentage
 * @returns {string} Formatted humidity string  
 */
export const formatHumidity = (humidity) => {
  if (humidity === null || humidity === undefined || isNaN(humidity)) {
    return 'N/A';
  }
  
  return `${Math.round(humidity)}%`;
};

/**
 * Format a time range for display
 * @param {string} start - Start time
 * @param {string} end - End time
 * @returns {string} Formatted time range
 */
export const formatTimeRange = (start, end) => {
  if (!start && !end) return 'N/A';
  if (!end) return `From ${formatZuluTime(start)}`;
  if (!start) return `Until ${formatZuluTime(end)}`;
  
  return `${formatZuluTime(start)} - ${formatZuluTime(end)}`;
};

/**
 * Format distance for aviation use
 * @param {number} distance - Distance value
 * @param {string} unit - Unit (nm, mi, km)
 * @returns {string} Formatted distance
 */
export const formatDistance = (distance, unit = 'nm') => {
  if (!distance || isNaN(distance)) return 'N/A';
  
  const dist = Math.round(distance);
  return `${dist} ${unit}`;
};

/**
 * Get color class for flight category
 * @param {string} category - Flight category (VFR, MVFR, IFR, LIFR)
 * @returns {string} Tailwind color class
 */
export const getFlightCategoryColor = (category) => {
  const cat = FLIGHT_CATEGORIES[category?.toUpperCase()];
  return cat ? cat.color : 'gray';
};

/**
 * Format severity level for alerts
 * @param {string} severity - Severity level
 * @returns {Object} Severity styling information
 */
export const formatSeverity = (severity) => {
  switch (severity?.toUpperCase()) {
    case 'HIGH':
      return {
        text: 'HIGH',
        color: 'severity-high',
        badge: 'bg-severity-high/20 text-severity-high',
        bg: 'bg-severity-high/10',
        border: 'border-severity-high/30'
      };
    case 'MEDIUM':
      return {
        text: 'MEDIUM', 
        color: 'severity-medium',
        badge: 'bg-severity-medium/20 text-severity-medium',
        bg: 'bg-severity-medium/10',
        border: 'border-severity-medium/30'
      };
    case 'LOW':
      return {
        text: 'LOW',
        color: 'severity-low', 
        badge: 'bg-severity-low/20 text-severity-low',
        bg: 'bg-severity-low/10',
        border: 'border-severity-low/30'
      };
    default:
      return {
        text: 'UNKNOWN',
        color: 'gray-400',
        badge: 'bg-gray-800/50 text-gray-400',
        bg: 'bg-gray-800/50',
        border: 'border-gray-600'
      };
  }
};

/**
 * Format reliability rating for forecast accuracy
 * @param {string} rating - Reliability rating (HIGH, MEDIUM, LOW, VERY_LOW)
 * @returns {Object} Reliability styling information
 */
export const formatReliability = (rating) => {
  switch (rating?.toUpperCase()) {
    case 'HIGH':
      return {
        text: 'HIGH',
        color: 'text-vfr-500',
        bg: 'bg-vfr-500/10',
        border: 'border-vfr-500/30'
      };
    case 'MEDIUM':
      return {
        text: 'MEDIUM',
        color: 'text-mvfr-500',
        bg: 'bg-mvfr-500/10',
        border: 'border-mvfr-500/30'
      };
    case 'LOW':
      return {
        text: 'LOW',
        color: 'text-severity-high',
        bg: 'bg-severity-high/10',
        border: 'border-severity-high/30'
      };
    case 'VERY_LOW':
      return {
        text: 'VERY LOW',
        color: 'text-lifr-500',
        bg: 'bg-lifr-500/10',
        border: 'border-lifr-500/30'
      };
    default:
      return {
        text: 'UNKNOWN',
        color: 'text-gray-400',
        bg: 'bg-gray-800/50',
        border: 'border-gray-600'
      };
  }
};

/**
 * Parse METAR string into structured data
 * @param {string} metar - Raw METAR string
 * @returns {Object} Parsed METAR data
 */
export const parseMetar = (metar) => {
  if (!metar || typeof metar !== 'string') return null;

  const parsed = {
    raw: metar,
    icaoCode: null,
    time: null,
    wind: null,
    visibility: null,
    weather: [],
    clouds: [],
    temperature: null,
    dewpoint: null,
    altimeter: null,
    ceiling: null
  };

  try {
    // Split into components
    const parts = metar.trim().split(/\s+/);
    let partIndex = 0;

    // ICAO code (first part)
    if (parts[partIndex] && /^[A-Z]{4}$/.test(parts[partIndex])) {
      parsed.icaoCode = parts[partIndex];
      partIndex++;
    }

    // Time (DDHHMMZ format)
    if (parts[partIndex] && /^\d{6}Z$/.test(parts[partIndex])) {
      const timeStr = parts[partIndex];
      parsed.time = `${timeStr.slice(0, 2)}/${timeStr.slice(2, 4)}:${timeStr.slice(4, 6)}Z`;
      partIndex++;
    }

    // Skip AUTO/COR if present
    if (parts[partIndex] && /^(AUTO|COR)$/.test(parts[partIndex])) {
      partIndex++;
    }

    // Wind
    if (parts[partIndex] && /^\d{3}\d{2,3}(G\d{2,3})?(KT|MPS)$/.test(parts[partIndex])) {
      const windStr = parts[partIndex];
      const windMatch = windStr.match(/^(\d{3})(\d{2,3})(G(\d{2,3}))?(KT|MPS)$/);
      if (windMatch) {
        const direction = windMatch[1];
        const speed = windMatch[2];
        const gust = windMatch[4];
        const unit = windMatch[5];
        
        parsed.wind = gust ? 
          `${direction}°/${speed}G${gust} ${unit}` : 
          `${direction}°/${speed} ${unit}`;
      }
      partIndex++;
    } else if (parts[partIndex] && /^(VRB)\d{2,3}(KT|MPS)$/.test(parts[partIndex])) {
      parsed.wind = parts[partIndex].replace('VRB', 'Variable ');
      partIndex++;
    }

    // Visibility
    if (parts[partIndex] && (/^\d{1,2}SM$/.test(parts[partIndex]) || /^\d{4}$/.test(parts[partIndex]))) {
      if (parts[partIndex].endsWith('SM')) {
        parsed.visibility = parseFloat(parts[partIndex].replace('SM', ''));
      } else if (/^\d{4}$/.test(parts[partIndex])) {
        // Visibility in meters
        const visMeters = parseInt(parts[partIndex]);
        parsed.visibility = Math.round(visMeters * 0.000621371 * 100) / 100; // Convert to miles
      }
      partIndex++;
    }

    // Weather phenomena
    while (partIndex < parts.length && /^([-+]?)([A-Z]{2,4})$/.test(parts[partIndex])) {
      parsed.weather.push(formatWeatherPhenomena(parts[partIndex]));
      partIndex++;
    }

    // Clouds and ceiling
    let lowestCeiling = null;
    while (partIndex < parts.length && /^(FEW|SCT|BKN|OVC|CLR|SKC|NSC)\d{3}?/.test(parts[partIndex])) {
      const cloudStr = parts[partIndex];
      const cloudMatch = cloudStr.match(/^(FEW|SCT|BKN|OVC|CLR|SKC|NSC)(\d{3})?/);
      
      if (cloudMatch) {
        const coverage = cloudMatch[1];
        const altitude = cloudMatch[2] ? parseInt(cloudMatch[2]) * 100 : null;
        
        parsed.clouds.push({
          coverage,
          altitude
        });

        // Determine ceiling (BKN or OVC)
        if ((coverage === 'BKN' || coverage === 'OVC') && altitude) {
          if (!lowestCeiling || altitude < lowestCeiling) {
            lowestCeiling = altitude;
          }
        }
      }
      partIndex++;
    }

    parsed.ceiling = lowestCeiling;

    // Temperature and dewpoint
    if (parts[partIndex] && /^(M?\d{2})\/(M?\d{2})$/.test(parts[partIndex])) {
      const tempDewMatch = parts[partIndex].match(/^(M?\d{2})\/(M?\d{2})$/);
      if (tempDewMatch) {
        parsed.temperature = parseInt(tempDewMatch[1].replace('M', '-'));
        parsed.dewpoint = parseInt(tempDewMatch[2].replace('M', '-'));
      }
      partIndex++;
    }

    // Altimeter
    if (parts[partIndex] && /^A\d{4}$/.test(parts[partIndex])) {
      const altStr = parts[partIndex].replace('A', '');
      parsed.altimeter = (parseInt(altStr) / 100).toFixed(2);
      partIndex++;
    }

  } catch (error) {
    console.warn('Error parsing METAR:', error);
  }

  return parsed;
};

/**
 * Parse TAF string into structured data
 * @param {string} taf - Raw TAF string
 * @returns {Object} Parsed TAF data
 */
export const parseTaf = (taf) => {
  if (!taf || typeof taf !== 'string') return null;

  const parsed = {
    raw: taf,
    icaoCode: null,
    issuedTime: null,
    validPeriod: null,
    conditions: []
  };

  try {
    // Split into lines and clean up
    const lines = taf.split('\n').map(line => line.trim()).filter(line => line.length > 0);
    const fullText = lines.join(' ');
    const parts = fullText.split(/\s+/);
    let partIndex = 0;

    // Skip TAF keyword
    if (parts[partIndex] === 'TAF') {
      partIndex++;
    }

    // ICAO code
    if (parts[partIndex] && /^[A-Z]{4}$/.test(parts[partIndex])) {
      parsed.icaoCode = parts[partIndex];
      partIndex++;
    }

    // Issued time
    if (parts[partIndex] && /^\d{6}Z$/.test(parts[partIndex])) {
      const timeStr = parts[partIndex];
      parsed.issuedTime = `${timeStr.slice(0, 2)}/${timeStr.slice(2, 4)}:${timeStr.slice(4, 6)}Z`;
      partIndex++;
    }

    // Valid period
    if (parts[partIndex] && /^\d{4}\/\d{4}$/.test(parts[partIndex])) {
      const periodMatch = parts[partIndex].match(/^(\d{2})(\d{2})\/(\d{2})(\d{2})$/);
      if (periodMatch) {
        parsed.validPeriod = `${periodMatch[1]}/${periodMatch[2]}Z - ${periodMatch[3]}/${periodMatch[4]}Z`;
      }
      partIndex++;
    }

    // Parse forecast conditions (simplified)
    let currentCondition = {
      time: 'Base Forecast',
      wind: null,
      visibility: null,
      weather: [],
      clouds: [],
      ceiling: null,
      changeType: 'BASE'
    };

    while (partIndex < parts.length) {
      const part = parts[partIndex];

      // Time periods (FM, TEMPO, BECMG, PROB)
      if (/^(FM|TEMPO|BECMG|PROB\d{2})\d{0,6}/.test(part)) {
        // Save current condition if it has content
        if (currentCondition.wind || currentCondition.visibility || currentCondition.weather.length > 0) {
          parsed.conditions.push({ ...currentCondition });
        }

        // Start new condition
        const changeMatch = part.match(/^(FM|TEMPO|BECMG|PROB\d{2})(\d{6})?/);
        if (changeMatch) {
          currentCondition = {
            time: changeMatch[2] ? `${changeMatch[1]} ${changeMatch[2]}` : changeMatch[1],
            wind: null,
            visibility: null,
            weather: [],
            clouds: [],
            ceiling: null,
            changeType: changeMatch[1].startsWith('PROB') ? 'PROB' : changeMatch[1]
          };
        }
        partIndex++;
        continue;
      }

      // Wind
      if (/^\d{3}\d{2,3}(G\d{2,3})?(KT|MPS)$/.test(part)) {
        const windMatch = part.match(/^(\d{3})(\d{2,3})(G(\d{2,3}))?(KT|MPS)$/);
        if (windMatch) {
          const direction = windMatch[1];
          const speed = windMatch[2];
          const gust = windMatch[4];
          const unit = windMatch[5];
          
          currentCondition.wind = gust ? 
            `${direction}°/${speed}G${gust} ${unit}` : 
            `${direction}°/${speed} ${unit}`;
        }
      }
      // Visibility
      else if (/^\d{1,2}SM$/.test(part) || /^\d{4}$/.test(part)) {
        if (part.endsWith('SM')) {
          currentCondition.visibility = parseFloat(part.replace('SM', ''));
        } else if (/^\d{4}$/.test(part)) {
          const visMeters = parseInt(part);
          currentCondition.visibility = Math.round(visMeters * 0.000621371 * 100) / 100;
        }
      }
      // Weather phenomena
      else if (/^([-+]?)([A-Z]{2,4})$/.test(part)) {
        currentCondition.weather.push(formatWeatherPhenomena(part));
      }
      // Clouds
      else if (/^(FEW|SCT|BKN|OVC|CLR|SKC)\d{3}?/.test(part)) {
        const cloudMatch = part.match(/^(FEW|SCT|BKN|OVC|CLR|SKC)(\d{3})?/);
        if (cloudMatch) {
          const coverage = cloudMatch[1];
          const altitude = cloudMatch[2] ? parseInt(cloudMatch[2]) * 100 : null;
          
          currentCondition.clouds.push({
            coverage,
            altitude
          });

          // Update ceiling
          if ((coverage === 'BKN' || coverage === 'OVC') && altitude) {
            if (!currentCondition.ceiling || altitude < currentCondition.ceiling) {
              currentCondition.ceiling = altitude;
            }
          }
        }
      }

      partIndex++;
    }

    // Add the last condition
    if (currentCondition.wind || currentCondition.visibility || currentCondition.weather.length > 0 || 
        currentCondition.clouds.length > 0) {
      parsed.conditions.push(currentCondition);
    }

  } catch (error) {
    console.warn('Error parsing TAF:', error);
  }

  return parsed;
};

export default {
  formatTime,
  formatZuluTime,
  formatVisibility,
  formatCeiling,
  formatWind,
  formatWeatherPhenomena,
  getFlightCategory,
  getFlightCategoryLegacy,
  getFlightCategoryHex,
  formatTemperature,
  formatPressure,
  formatHumidity,
  formatTimeRange,
  formatDistance,
  getFlightCategoryColor,
  formatSeverity,
  formatReliability,
  parseMetar,
  parseTaf,
  FLIGHT_CATEGORY_THRESHOLDS
};