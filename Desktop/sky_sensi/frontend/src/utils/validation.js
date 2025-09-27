/**
 * Validation utilities for aviation weather app
 * Handles ICAO code validation, route parsing, and input sanitization
 */

/**
 * Regular expression for ICAO airport codes
 * ICAO codes are exactly 4 letters, typically starting with K for US airports
 */
const ICAO_REGEX = /^[A-Z]{4}$/;

/**
 * Common invalid ICAO patterns to catch
 */
const INVALID_PATTERNS = [
  /^[0-9]/,  // Starting with number
  /[^A-Z]/,  // Non-alphabetic characters
  /(.)\1{3}/ // Same letter repeated 4 times (AAAA, BBBB, etc.)
];

/**
 * Known valid ICAO prefixes by region
 */
const VALID_PREFIXES = {
  'K': 'United States',
  'C': 'Canada',
  'E': 'Northern Europe', 
  'L': 'Southern Europe',
  'P': 'Pacific',
  'R': 'Asia',
  'S': 'South America',
  'F': 'Africa',
  'A': 'Pacific/Australia',
  'V': 'India/Maldives',
  'O': 'Middle East',
  'D': 'West Africa',
  'G': 'West Africa',
  'H': 'East Africa',
  'U': 'Russia/CIS',
  'Z': 'China',
  'Y': 'Australia',
  'N': 'Pacific Islands',
  'W': 'Southeast Asia',
  'M': 'Central America/Caribbean'
};

const isFiniteNumber = (value) => typeof value === 'number' && Number.isFinite(value);

const hasValidCoordinateSet = (input) => {
  if (!Array.isArray(input) || input.length === 0) {
    return false;
  }

  const stack = [input];
  while (stack.length > 0) {
    const current = stack.pop();
    if (!Array.isArray(current)) {
      continue;
    }

    if (current.length >= 2 && current.every(isFiniteNumber)) {
      return true;
    }

    current.forEach((item) => {
      if (Array.isArray(item)) {
        stack.push(item);
      }
    });
  }

  return false;
};

const getPirepAltitudeValue = (pirep) => {
  if (!pirep) return null;

  if (isFiniteNumber(pirep.altitude)) {
    return pirep.altitude;
  }

  if (pirep.altitude && typeof pirep.altitude === 'object' && isFiniteNumber(pirep.altitude.feet)) {
    return pirep.altitude.feet;
  }

  if (isFiniteNumber(pirep.altitudeFt)) {
    return pirep.altitudeFt;
  }

  return null;
};

/**
 * Validate a single ICAO airport code
 * @param {string} code - The ICAO code to validate
 * @returns {Object} Validation result with isValid flag and error message
 */
export const validateIcaoCode = (code) => {
  if (!code || typeof code !== 'string') {
    return {
      isValid: false,
      error: 'Airport code is required'
    };
  }

  const cleanCode = code.trim().toUpperCase();

  if (cleanCode.length === 0) {
    return {
      isValid: false,
      error: 'Airport code cannot be empty'
    };
  }

  if (cleanCode.length !== 4) {
    return {
      isValid: false,
      error: `ICAO codes must be exactly 4 letters (got ${cleanCode.length})`
    };
  }

  if (!ICAO_REGEX.test(cleanCode)) {
    return {
      isValid: false,
      error: 'ICAO codes must contain only letters'
    };
  }

  // Check for obviously invalid patterns
  for (const pattern of INVALID_PATTERNS) {
    if (pattern.test(cleanCode)) {
      return {
        isValid: false,
        error: 'Invalid ICAO code format'
      };
    }
  }

  // Check if it starts with a known valid prefix
  const prefix = cleanCode.charAt(0);
  if (!VALID_PREFIXES[prefix]) {
    return {
      isValid: true, // Still valid, just provide a warning
      warning: `Uncommon ICAO prefix '${prefix}' - please verify airport code`,
      region: 'Unknown'
    };
  }

  return {
    isValid: true,
    region: VALID_PREFIXES[prefix],
    cleanCode: cleanCode
  };
};

/**
 * Parse a route string into individual airport codes
 * @param {string} route - Comma-separated airport codes
 * @returns {Array<string>} Array of cleaned airport codes
 */
export const parseRoute = (route) => {
  if (!route || typeof route !== 'string') {
    return [];
  }

  return route
    .split(',')
    .map(code => code.trim().toUpperCase())
    .filter(code => code.length > 0)
    .filter((code, index, arr) => arr.indexOf(code) === index); // Remove duplicates
};

/**
 * Validate an entire route string
 * @param {string} route - Comma-separated airport codes  
 * @returns {Object} Validation result with detailed information
 */
export const validateRoute = (route) => {
  const airports = parseRoute(route);
  
  if (airports.length === 0) {
    return {
      isValid: false,
      error: 'Route must contain at least one airport',
      airports: []
    };
  }

  if (airports.length > 10) {
    return {
      isValid: false,
      error: 'Route cannot contain more than 10 airports',
      airports: airports
    };
  }

  const validationResults = airports.map(airport => ({
    code: airport,
    ...validateIcaoCode(airport)
  }));

  const invalidCodes = validationResults.filter(result => !result.isValid);
  const warnings = validationResults.filter(result => result.warning);

  return {
    isValid: invalidCodes.length === 0,
    airports: validationResults,
    errors: invalidCodes.map(result => `${result.code}: ${result.error}`),
    warnings: warnings.map(result => `${result.code}: ${result.warning}`),
    validCount: validationResults.filter(result => result.isValid).length,
    totalCount: airports.length
  };
};

/**
 * Sanitize user input for route entry
 * @param {string} input - Raw user input
 * @returns {string} Cleaned and sanitized input
 */
export const sanitizeRouteInput = (input) => {
  if (!input || typeof input !== 'string') {
    return '';
  }

  return input
    .toUpperCase()
    .replace(/[^A-Z,\s]/g, '') // Only allow letters, commas, and spaces
    .replace(/\s+/g, ' ') // Normalize spaces
    .replace(/,+/g, ',') // Normalize commas  
    .replace(/,\s*,/g, ',') // Remove empty entries
    .trim();
};

/**
 * Format a route for display
 * @param {string} route - Route string
 * @returns {string} Nicely formatted route
 */
export const formatRoute = (route) => {
  const airports = parseRoute(route);
  return airports.join(' → ');
};

/**
 * Get suggestions for common typos in airport codes
 * @param {string} code - Potentially misspelled code
 * @returns {Array<string>} Array of suggested corrections
 */
export const getSuggestions = (code) => {
  if (!code || code.length !== 4) {
    return [];
  }

  const cleanCode = code.toUpperCase();
  const suggestions = [];

  // Common US airport code corrections
  const commonCodes = {
    'LAX': 'KLAX',
    'JFK': 'KJFK', 
    'ORD': 'KORD',
    'DEN': 'KDEN',
    'SFO': 'KSFO',
    'ATL': 'KATL',
    'DFW': 'KDFW',
    'LAS': 'KLAS',
    'PHX': 'KPHX',
    'SEA': 'KSEA'
  };

  // If it's a 3-letter code, suggest adding K prefix for US airports
  if (code.length === 3 && /^[A-Z]{3}$/.test(code)) {
    if (commonCodes[code]) {
      suggestions.push(commonCodes[code]);
    } else {
      suggestions.push(`K${code}`);
    }
  }

  // Common character substitutions
  const substitutions = {
    '0': 'O',
    '1': 'I',
    '5': 'S',
    '8': 'B'
  };

  let corrected = cleanCode;
  for (const [wrong, right] of Object.entries(substitutions)) {
    corrected = corrected.replace(new RegExp(wrong, 'g'), right);
  }

  if (corrected !== cleanCode && validateIcaoCode(corrected).isValid) {
    suggestions.push(corrected);
  }

  return suggestions;
};

/**
 * Check if a route contains duplicate airports
 * @param {string} route - Route string
 * @returns {Array<string>} Array of duplicate airport codes
 */
export const findDuplicateAirports = (route) => {
  const airports = parseRoute(route);
  const seen = new Set();
  const duplicates = new Set();

  airports.forEach(airport => {
    if (seen.has(airport)) {
      duplicates.add(airport);
    } else {
      seen.add(airport);
    }
  });

  return Array.from(duplicates);
};

export const validateAirportData = (airport) => {
  if (!airport || typeof airport !== 'object') {
    return {
      isValid: false,
      errors: ['Airport entry must be an object']
    };
  }

  const errors = [];
  const identifier = airport.icao || airport.icaoCode || airport.identifier || airport.id;

  if (!identifier || typeof identifier !== 'string' || identifier.trim().length === 0) {
    errors.push('Missing airport identifier');
  }

  if (!isFiniteNumber(airport.latitude) || !isFiniteNumber(airport.longitude)) {
    errors.push('Invalid airport coordinates');
  }

  ['metarRaw', 'tafRaw'].forEach((field) => {
    if (airport[field] != null && typeof airport[field] !== 'string') {
      errors.push(`Field ${field} must be a string when provided`);
    }
  });

  // Allow metar and taf to be either strings or objects (parsed data)
  ['metar', 'taf'].forEach((field) => {
    if (airport[field] != null && typeof airport[field] !== 'string' && typeof airport[field] !== 'object') {
      errors.push(`Field ${field} must be a string or object when provided`);
    }
  });

  return {
    isValid: errors.length === 0,
    errors
  };
};

export const validateHazardData = (hazards) => {
  if (!hazards || typeof hazards !== 'object') {
    return {
      isValid: false,
      errors: ['Hazards payload must be an object']
    };
  }

  const errors = [];

  const sigmetCandidates = [];
  if (Array.isArray(hazards.sigmets)) {
    sigmetCandidates.push(...hazards.sigmets);
  }
  if (Array.isArray(hazards.sigmets?.active)) {
    sigmetCandidates.push(...hazards.sigmets.active);
  }

  sigmetCandidates.forEach((sigmet, index) => {
    if (!sigmet || typeof sigmet !== 'object') {
      errors.push(`SIGMET[${index}] must be an object`);
      return;
    }

    const coordinates = sigmet.geometry?.coordinates ?? sigmet.coordinates ?? sigmet.polygon ?? sigmet.points;
    if (!hasValidCoordinateSet(coordinates)) {
      errors.push(`SIGMET[${index}] has invalid geometry or coordinates`);
    }
  });

  const pirepCandidates = [];
  if (Array.isArray(hazards.pireps)) {
    pirepCandidates.push(...hazards.pireps);
  }
  if (Array.isArray(hazards.pireps?.recent)) {
    pirepCandidates.push(...hazards.pireps.recent);
  }

  pirepCandidates.forEach((pirep, index) => {
    if (!pirep || typeof pirep !== 'object') {
      errors.push(`PIREP[${index}] must be an object`);
      return;
    }

    const lat = pirep.latitude ?? pirep.lat;
    const lon = pirep.longitude ?? pirep.lon;
    const altitude = getPirepAltitudeValue(pirep);

    if (!isFiniteNumber(lat) || !isFiniteNumber(lon)) {
      errors.push(`PIREP[${index}] must include valid latitude/longitude`);
    }

    if (altitude === null) {
      errors.push(`PIREP[${index}] is missing altitude information`);
    }
  });

  return {
    isValid: errors.length === 0,
    errors
  };
};

export const validateAiSummary = (aiSummary) => {
  if (!aiSummary || typeof aiSummary !== 'object') {
    return {
      isValid: false,
      errors: ['AI summary must be an object']
    };
  }

  const errors = [];

  if (typeof aiSummary.routeSummary !== 'string' || aiSummary.routeSummary.trim().length === 0) {
    errors.push('routeSummary must be a non-empty string');
  }

  if (!Array.isArray(aiSummary.keyFindings)) {
    errors.push('keyFindings must be an array');
  } else if (!aiSummary.keyFindings.every((finding) => typeof finding === 'string')) {
    errors.push('keyFindings must contain only strings');
  }

  if (typeof aiSummary.overallConditions !== 'string' || aiSummary.overallConditions.trim().length === 0) {
    errors.push('overallConditions must be a non-empty string');
  }

  if (typeof aiSummary.confidence !== 'string' || aiSummary.confidence.trim().length === 0) {
    errors.push('confidence must be a non-empty string');
  }

  return {
    isValid: errors.length === 0,
    errors
  };
};

export const validateBriefingResponse = (response) => {
  if (!response || typeof response !== 'object') {
    return {
      isValid: false,
      errors: ['Briefing response must be an object']
    };
  }

  const errors = [];

  if (typeof response.route !== 'string' || response.route.trim().length === 0) {
    errors.push('route must be a non-empty string');
  }

  if (!response.generatedAt || Number.isNaN(new Date(response.generatedAt).getTime())) {
    errors.push('generatedAt must be a valid datetime string');
  }

  if (!Array.isArray(response.airports) || response.airports.length === 0) {
    errors.push('airports must be a non-empty array');
  } else {
    response.airports.forEach((airport, index) => {
      const result = validateAirportData(airport);
      if (!result.isValid) {
        result.errors.forEach((error) => {
          errors.push(`airport[${index}]: ${error}`);
        });
      }
    });
  }

  if (response.metarsByIcao != null && typeof response.metarsByIcao !== 'object') {
    errors.push('metarsByIcao must be an object map');
  }

  if (response.tafsByIcao != null && typeof response.tafsByIcao !== 'object') {
    errors.push('tafsByIcao must be an object map');
  }

  const hazardSource = {};

  if (response.hazards != null) {
    if (typeof response.hazards !== 'object') {
      errors.push('hazards must be an object when provided');
    } else {
      Object.assign(hazardSource, response.hazards);
    }
  }

  if (!hazardSource.sigmets && Array.isArray(response.sigmets)) {
    hazardSource.sigmets = response.sigmets;
  }

  if (!hazardSource.pireps && Array.isArray(response.pireps)) {
    hazardSource.pireps = response.pireps;
  }

  if (Object.keys(hazardSource).length > 0) {
    const hazardValidation = validateHazardData(hazardSource);
    if (!hazardValidation.isValid) {
      hazardValidation.errors.forEach((error) => errors.push(error));
    }
  }

  if (response.aiSummary) {
    const aiValidation = validateAiSummary(response.aiSummary);
    if (!aiValidation.isValid) {
      aiValidation.errors.forEach((error) => errors.push(`aiSummary: ${error}`));
    }
  }

  return {
    isValid: errors.length === 0,
    errors
  };
};

export const assertValidBriefing = (response) => {
  const result = validateBriefingResponse(response);
  if (!result.isValid) {
    throw new Error(`Invalid briefing response: ${result.errors.join('; ')}`);
  }
  return response;
};

export default {
  validateIcaoCode,
  parseRoute,
  validateRoute,
  sanitizeRouteInput,
  formatRoute,
  getSuggestions,
  findDuplicateAirports,
  validateAirportData,
  validateHazardData,
  validateAiSummary,
  validateBriefingResponse,
  assertValidBriefing
};