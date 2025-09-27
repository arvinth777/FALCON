/**
 * Map utility functions for aviation weather visualization
 * Handles coordinate calculations, bounds, routes, and map layer formatting
 */

/**
 * Shared validator for numeric coordinates
 * @param {any} v - Value to validate
 * @returns {boolean} True if valid finite number
 */
const isValidNum = (v) => v !== null && v !== undefined && !Number.isNaN(Number(v)) && Number.isFinite(Number(v));

/**
 * Validate geographic coordinates
 * @param {number} latitude - Latitude value to validate
 * @param {number} longitude - Longitude value to validate
 * @returns {Object} Validation result with isValid boolean and error message if invalid
 */
export const validateCoordinates = (latitude, longitude) => {
  // Check if values are numbers
  if (typeof latitude !== 'number' || typeof longitude !== 'number') {
    return {
      isValid: false,
      error: 'Coordinates must be numeric values'
    };
  }

  // Check for NaN or infinite values
  if (isNaN(latitude) || isNaN(longitude) || !isFinite(latitude) || !isFinite(longitude)) {
    return {
      isValid: false,
      error: 'Coordinates must be finite numeric values'
    };
  }

  // Check latitude bounds (-90 to 90)
  if (latitude < -90 || latitude > 90) {
    return {
      isValid: false,
      error: `Latitude must be between -90 and 90 degrees, got ${latitude}`
    };
  }

  // Check longitude bounds (-180 to 180)
  if (longitude < -180 || longitude > 180) {
    return {
      isValid: false,
      error: `Longitude must be between -180 and 180 degrees, got ${longitude}`
    };
  }

  return {
    isValid: true,
    error: null
  };
};

/**
 * Calculate great circle distance between two points in nautical miles
 * @param {number} lat1 - Latitude of first point
 * @param {number} lon1 - Longitude of first point
 * @param {number} lat2 - Latitude of second point
 * @param {number} lon2 - Longitude of second point
 * @returns {number} Distance in nautical miles
 */
export const calculateDistance = (lat1, lon1, lat2, lon2) => {
  const R = 3440.065; // Earth's radius in nautical miles
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  
  const a = Math.sin(dLat/2) * Math.sin(dLat/2) +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
    Math.sin(dLon/2) * Math.sin(dLon/2);
  
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
  return R * c;
};

/**
 * Calculate bearing between two points
 * @param {number} lat1 - Latitude of first point
 * @param {number} lon1 - Longitude of first point
 * @param {number} lat2 - Latitude of second point
 * @param {number} lon2 - Longitude of second point
 * @returns {number} Bearing in degrees
 */
export const calculateBearing = (lat1, lon1, lat2, lon2) => {
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const lat1Rad = lat1 * Math.PI / 180;
  const lat2Rad = lat2 * Math.PI / 180;
  
  const y = Math.sin(dLon) * Math.cos(lat2Rad);
  const x = Math.cos(lat1Rad) * Math.sin(lat2Rad) -
    Math.sin(lat1Rad) * Math.cos(lat2Rad) * Math.cos(dLon);
  
  const bearing = Math.atan2(y, x) * 180 / Math.PI;
  return (bearing + 360) % 360;
};

/**
 * Calculate total route distance through multiple waypoints using Haversine formula
 * @param {Array} waypoints - Array of waypoint objects with latitude and longitude properties
 * @returns {Object} Route statistics including total distance, individual leg distances, and leg bearings
 */
export const calculateRouteDistance = (waypoints) => {
  if (!waypoints || waypoints.length < 2) {
    return {
      totalDistance: 0,
      legs: [],
      error: 'Route requires at least 2 waypoints'
    };
  }

  let totalDistance = 0;
  const legs = [];

  for (let i = 0; i < waypoints.length - 1; i++) {
    const from = waypoints[i];
    const to = waypoints[i + 1];

    // Validate coordinates
    const fromValid = validateCoordinates(from.latitude, from.longitude);
    const toValid = validateCoordinates(to.latitude, to.longitude);

    if (!fromValid.isValid) {
      return {
        totalDistance: 0,
        legs: [],
        error: `Invalid coordinates for waypoint ${i + 1}: ${fromValid.error}`
      };
    }

    if (!toValid.isValid) {
      return {
        totalDistance: 0,
        legs: [],
        error: `Invalid coordinates for waypoint ${i + 2}: ${toValid.error}`
      };
    }

    // Calculate leg distance and bearing using Haversine formula
    const distance = calculateDistance(from.latitude, from.longitude, to.latitude, to.longitude);
    const bearing = calculateBearing(from.latitude, from.longitude, to.latitude, to.longitude);

    totalDistance += distance;

    legs.push({
      from: {
        latitude: from.latitude,
        longitude: from.longitude,
        identifier: from.identifier || `WPT${i + 1}`
      },
      to: {
        latitude: to.latitude,
        longitude: to.longitude,
        identifier: to.identifier || `WPT${i + 2}`
      },
      distance: Math.round(distance * 10) / 10, // Round to 0.1 nm precision
      bearing: Math.round(bearing),
      legNumber: i + 1
    });
  }

  return {
    totalDistance: Math.round(totalDistance * 10) / 10, // Round to 0.1 nm precision
    legs,
    waypoints: waypoints.length,
    error: null
  };
};

/**
 * Calculate map bounds for a set of airports with padding
 * @param {Array} airports - Array of airport objects with lat/lon
 * @param {number} padding - Padding factor (default 0.1)
 * @returns {Object} Bounds object with southwest and northeast corners
 */
export const calculateBounds = (airports, padding = 0.1) => {
  if (!airports || airports.length === 0) {
    return {
      southwest: [32.0, -125.0], // Default US bounds
      northeast: [49.0, -65.0]
    };
  }

  const validAirports = airports.filter(airport => 
    isValidNum(airport.latitude) && isValidNum(airport.longitude)
  );

  if (validAirports.length === 0) {
    return {
      southwest: [32.0, -125.0],
      northeast: [49.0, -65.0]
    };
  }

  let minLat = validAirports[0].latitude;
  let maxLat = validAirports[0].latitude;
  let minLon = validAirports[0].longitude;
  let maxLon = validAirports[0].longitude;

  validAirports.forEach(airport => {
    minLat = Math.min(minLat, airport.latitude);
    maxLat = Math.max(maxLat, airport.latitude);
    minLon = Math.min(minLon, airport.longitude);
    maxLon = Math.max(maxLon, airport.longitude);
  });

  // Add padding with minimum padding for single airports
  const latSpan = maxLat - minLat;
  const lonSpan = maxLon - minLon;
  const latPadding = Math.max(latSpan * padding, 0.5); // Minimum 0.5 degree padding
  const lonPadding = Math.max(lonSpan * padding, 0.5); // Minimum 0.5 degree padding

  // Calculate bounds with safety limits
  const southwest = [
    Math.max(-90, minLat - latPadding),   // Clamp latitude to valid range
    Math.max(-180, minLon - lonPadding)   // Clamp longitude to valid range
  ];
  
  const northeast = [
    Math.min(90, maxLat + latPadding),    // Clamp latitude to valid range
    Math.min(180, maxLon + lonPadding)    // Clamp longitude to valid range
  ];

  // Validate bounds integrity
  if (southwest[0] >= northeast[0] || southwest[1] >= northeast[1]) {
    console.warn('Invalid map bounds calculated, using default bounds');
    return {
      southwest: [32.0, -125.0],
      northeast: [49.0, -65.0]
    };
  }

  return {
    southwest,
    northeast
  };
};

/**
 * Generate route line coordinates between airports
 * @param {Array} airports - Array of airport objects with lat/lon
 * @returns {Array} Array of [lat, lon] coordinate pairs
 */
export const generateRouteLineCoordinates = (airports) => {
  if (!airports || airports.length < 2) return [];

  return airports
    .filter(airport => isValidNum(airport.latitude) && isValidNum(airport.longitude))
    .map(airport => [airport.latitude, airport.longitude]);
};

/**
 * Convert SIGMET/ISIGMET polygon to Leaflet format with comprehensive error handling
 * @param {Object} sigmet - SIGMET object with coordinates
 * @returns {Array} Array of [lat, lon] coordinate pairs for polygon
 */
export const convertSigmetToPolygon = (sigmet) => {
  if (!sigmet) {
    console.warn('SIGMET conversion failed: null or undefined sigmet object');
    return [];
  }

  // Check for geometry object (GeoJSON format)
  let coordinates = null;
  
  if (sigmet.geometry && sigmet.geometry.coordinates) {
    coordinates = sigmet.geometry.coordinates;
  } else if (sigmet.coordinates) {
    coordinates = sigmet.coordinates;
  } else {
    console.warn('SIGMET conversion failed: no coordinate data found');
    return [];
  }

  if (!Array.isArray(coordinates)) {
    console.warn('SIGMET conversion failed: coordinates is not an array');
    return [];
  }

  try {
    const polygons = [];

    const processCoordinatePair = (coord) => {
      if (!Array.isArray(coord) || coord.length < 2) {
        if (coord && typeof coord === 'object') {
          const lat = coord.lat ?? coord.latitude;
          const lon = coord.lon ?? coord.lng ?? coord.longitude;
          if (Number.isFinite(lat) && Number.isFinite(lon)) {
            return validateAndConvertCoordinate(lat, lon);
          }
        }
        if (typeof coord === 'string') {
          return parseCoordinateString(coord);
        }
        return null;
      }

      const [first, second] = coord;
      // Determine if coordinates are [lat, lon] or [lon, lat]
      const looksLikeLatLon = Math.abs(first) <= 90 && Math.abs(second) <= 180;
      const looksLikeLonLat = Math.abs(second) <= 90 && Math.abs(first) <= 180;

      if (looksLikeLatLon && !looksLikeLonLat) {
        return validateAndConvertCoordinate(first, second);
      }

      if (looksLikeLonLat && !looksLikeLatLon) {
        return validateAndConvertCoordinate(second, first);
      }

      // When ambiguous, prefer treating as [lon, lat] (GeoJSON default)
      return validateAndConvertCoordinate(second, first);
    };

    const processRing = (ring) => {
      if (!Array.isArray(ring)) {
        return [];
      }

      const processed = ring
        .map(coord => processCoordinatePair(coord))
        .filter(Boolean);

      if (processed.length === 0) {
        return [];
      }

      return ensurePolygonClosure(processed);
    };

    const addPolygon = (candidate) => {
      if (!Array.isArray(candidate)) {
        return;
      }

      // Detect whether candidate already represents rings
      const firstElement = candidate[0];
      const looksLikeRingCollection = Array.isArray(firstElement) && Array.isArray(firstElement[0]);

      const ringsSource = looksLikeRingCollection ? candidate : [candidate];
      const processedRings = ringsSource
        .map(ring => processRing(ring))
        .filter(ring => ring.length >= 3);

      if (processedRings.length === 0) {
        return;
      }

      // Validate polygon area using the outer ring (first ring)
      if (!isValidPolygonArea(processedRings[0])) {
        console.warn('SIGMET polygon area validation failed - polygon may be too small or invalid');
        return;
      }

      polygons.push(processedRings);
    };

    if (sigmet.geometry && typeof sigmet.geometry.type === 'string') {
      const geometryType = sigmet.geometry.type;

      if (geometryType === 'Polygon') {
        addPolygon(coordinates);
      } else if (geometryType === 'MultiPolygon') {
        coordinates.forEach(poly => addPolygon(poly));
      } else {
        console.warn(`SIGMET geometry type ${geometryType} is not supported for polygon conversion`);
      }
    } else {
      // Fallback for non-GeoJSON coordinate formats
      if (typeof coordinates[0] === 'string') {
        addPolygon(coordinates);
      } else {
        addPolygon(coordinates);
      }
    }

    if (polygons.length === 0) {
      console.warn('SIGMET conversion produced no valid polygons');
    }

    return polygons;

  } catch (error) {
    console.error('Error parsing SIGMET coordinates:', error.message);
    return [];
  }
};

/**
 * Parse coordinate string in various formats
 * @private
 */
function parseCoordinateString(coordStr) {
  if (typeof coordStr !== 'string') return null;
  
  try {
    // Format: "45.5N 122.3W" or "N45.5 W122.3"
    const match1 = coordStr.match(/(\d+\.?\d*)[NS]\s+(\d+\.?\d*)[EW]/i);
    if (match1) {
      const lat = parseFloat(match1[1]);
      const lon = parseFloat(match1[2]);
      const finalLat = coordStr.toUpperCase().includes('S') ? -lat : lat;
      const finalLon = coordStr.toUpperCase().includes('W') ? -lon : lon;
      return validateAndConvertCoordinate(finalLat, finalLon);
    }

    // Format: "N45.5 W122.3"
    const match2 = coordStr.match(/[NS](\d+\.?\d*)\s+[EW](\d+\.?\d*)/i);
    if (match2) {
      const lat = parseFloat(match2[1]);
      const lon = parseFloat(match2[2]);
      const finalLat = coordStr.toUpperCase().startsWith('S') ? -lat : lat;
      const finalLon = coordStr.includes('W') || coordStr.includes('w') ? -lon : lon;
      return validateAndConvertCoordinate(finalLat, finalLon);
    }

    // Format: "45.5,-122.3" (decimal degrees)
    const match3 = coordStr.match(/(-?\d+\.?\d*),\s*(-?\d+\.?\d*)/);
    if (match3) {
      const lat = parseFloat(match3[1]);
      const lon = parseFloat(match3[2]);
      return validateAndConvertCoordinate(lat, lon);
    }

    console.warn(`Unable to parse coordinate string: ${coordStr}`);
    return null;
  } catch (error) {
    console.warn(`Error parsing coordinate string "${coordStr}":`, error.message);
    return null;
  }
}

/**
 * Validate and convert coordinate to [lat, lon] format
 * @private
 */
function validateAndConvertCoordinate(lat, lon) {
  const validation = validateCoordinates(lat, lon);
  if (!validation.isValid) {
    console.warn(`Invalid coordinate: ${validation.error}`);
    return null;
  }
  return [lat, lon];
}

/**
 * Ensure polygon is properly closed
 * @private
 */
function ensurePolygonClosure(coords) {
  if (coords.length < 3) return coords;
  
  const first = coords[0];
  const last = coords[coords.length - 1];
  
  // Check if polygon is already closed (first and last points are the same)
  const tolerance = 0.0001; // Approximately 10 meters
  const isAlreadyClosed = 
    Math.abs(first[0] - last[0]) < tolerance && 
    Math.abs(first[1] - last[1]) < tolerance;
  
  if (!isAlreadyClosed) {
    // Close the polygon by adding the first point at the end
    return [...coords, first];
  }
  
  return coords;
}

/**
 * Validate polygon area to prevent invalid or tiny polygons
 * @private
 */
function isValidPolygonArea(coords) {
  if (coords.length < 3) return false;
  
  // Calculate approximate polygon area using shoelace formula
  let area = 0;
  const n = coords.length;
  
  for (let i = 0; i < n - 1; i++) {
    const j = (i + 1) % n;
    area += coords[i][0] * coords[j][1];
    area -= coords[j][0] * coords[i][1];
  }
  
  area = Math.abs(area) / 2;
  
  // Minimum area threshold (approximately 0.01 square degrees)
  // This prevents invalid polygons while allowing reasonable SIGMET areas
  const minArea = 0.01;
  
  return area >= minArea;
}

/**
 * Get SIGMET/ISIGMET color based on phenomenon type
 * @param {string} phenomenon - Weather phenomenon type
 * @returns {string} Color code for map styling
 */
export const getSigmetColor = (phenomenon) => {
  if (!phenomenon) return '#6B7280'; // Gray for unknown

  const type = phenomenon.toUpperCase();
  
  if (type.includes('TURB') || type.includes('TURBULENCE')) return '#EF4444'; // Red
  if (type.includes('ICE') || type.includes('ICING')) return '#3B82F6'; // Blue
  if (type.includes('TS') || type.includes('THUNDERSTORM') || type.includes('CONVECTIVE')) return '#DC2626'; // Dark red
  if (type.includes('MT_OBSC') || type.includes('MOUNTAIN')) return '#78716C'; // Brown
  if (type.includes('IFR') || type.includes('VISIBILITY')) return '#F59E0B'; // Amber
  if (type.includes('VOLCANIC') || type.includes('ASH')) return '#7C2D12'; // Dark brown
  
  return '#6B7280'; // Default gray
};

/**
 * Get PIREP marker icon based on phenomenon type
 * @param {string} phenomenon - Weather phenomenon type
 * @param {string} severity - Severity level
 * @returns {Object} Icon configuration for map marker
 */
export const getPirepIcon = (phenomenon, severity) => {
  const baseIcon = {
    iconSize: [20, 20],
    iconAnchor: [10, 10],
    popupAnchor: [0, -10]
  };

  let color = '#22C55E'; // Default green
  let symbol = '●';

  // Determine color by severity
  if (severity) {
    const sev = severity.toUpperCase();
    if (sev.includes('SEVERE') || sev.includes('HEAVY')) color = '#DC2626';
    else if (sev.includes('MODERATE')) color = '#F59E0B';
    else if (sev.includes('LIGHT')) color = '#22C55E';
  }

  // Determine symbol by phenomenon
  const phen = Array.isArray(phenomenon) ? phenomenon.join(',') : (phenomenon || '');
  if (phen) {
    const phenom = phen.toUpperCase();
    if (phenom.includes('TURB')) symbol = '⚡';
    else if (phenom.includes('ICE')) symbol = '❄️';
    else if (phenom.includes('CLOUD')) symbol = '☁️';
    else if (phenom.includes('PRECIP') || phenom.includes('RAIN') || phenom.includes('SNOW')) symbol = '🌧️';
  }

  return {
    ...baseIcon,
    html: `<div style="color: ${color}; font-size: 16px; text-shadow: 1px 1px 2px rgba(0,0,0,0.7);">${symbol}</div>`
  };
};

/**
 * Calculate optimal zoom level for map bounds
 * @param {Object} bounds - Map bounds object
 * @param {Object} mapSize - Map container size {width, height}
 * @returns {number} Optimal zoom level
 */
export const calculateOptimalZoom = (bounds, mapSize) => {
  if (!bounds || !mapSize) return 6;

  const { southwest, northeast } = bounds;
  const latDiff = northeast[0] - southwest[0];
  const lonDiff = northeast[1] - southwest[1];

  // Simple zoom calculation based on coordinate span
  const maxDiff = Math.max(latDiff, lonDiff);
  
  if (maxDiff > 20) return 4;
  if (maxDiff > 10) return 5;
  if (maxDiff > 5) return 6;
  if (maxDiff > 2) return 7;
  if (maxDiff > 1) return 8;
  return 9;
};

/**
 * Format coordinates for display
 * @param {number} lat - Latitude
 * @param {number} lon - Longitude
 * @returns {string} Formatted coordinate string
 */
export const formatCoordinates = (lat, lon) => {
  if (!isValidNum(lat) || !isValidNum(lon)) return 'N/A';
  
  const latDir = lat >= 0 ? 'N' : 'S';
  const lonDir = lon >= 0 ? 'E' : 'W';
  
  const latDeg = Math.abs(lat).toFixed(4);
  const lonDeg = Math.abs(lon).toFixed(4);
  
  return `${latDeg}°${latDir}, ${lonDeg}°${lonDir}`;
};

/**
 * Check if a point is within a polygon (SIGMET area)
 * @param {Array} point - [lat, lon] coordinate
 * @param {Array} polygon - Array of [lat, lon] coordinates defining polygon
 * @returns {boolean} True if point is inside polygon
 */
export const isPointInPolygon = (point, polygon) => {
  if (!point || !polygon || polygon.length < 3) return false;

  const [x, y] = point;
  let inside = false;

  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    const [xi, yi] = polygon[i];
    const [xj, yj] = polygon[j];

    if (((yi > y) !== (yj > y)) && (x < (xj - xi) * (y - yi) / (yj - yi) + xi)) {
      inside = !inside;
    }
  }

  return inside;
};

/**
 * Get airport marker color based on flight category
 * @param {string} flightCategory - VFR, MVFR, IFR, LIFR
 * @returns {string} Color code for airport marker
 */
export const getAirportMarkerColor = (flightCategory) => {
  switch (flightCategory?.toUpperCase()) {
    case 'VFR': return '#22C55E';   // Green
    case 'MVFR': return '#EAB308';  // Yellow
    case 'IFR': return '#EF4444';   // Red
    case 'LIFR': return '#A855F7';  // Purple
    default: return '#6B7280';      // Gray
  }
};

export default {
  calculateDistance,
  calculateBearing,
  calculateBounds,
  generateRouteLineCoordinates,
  convertSigmetToPolygon,
  getSigmetColor,
  getPirepIcon,
  calculateOptimalZoom,
  formatCoordinates,
  isPointInPolygon,
  getAirportMarkerColor
};