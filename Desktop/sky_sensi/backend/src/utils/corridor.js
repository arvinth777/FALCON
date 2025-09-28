const { lineString, point, featureCollection } = require('@turf/helpers');
const along = require('@turf/along').default;
const buffer = require('@turf/buffer').default;
const booleanIntersects = require('@turf/boolean-intersects').default || require('@turf/boolean-intersects');
const length = require('@turf/length').default;

/**
 * Build a route corridor polygon from airports
 * @param {Array} airports - Array of airport objects with lat/lon
 * @param {Object} options - { widthNm: number, sampleNm: number }
 * @returns {Object} GeoJSON Polygon feature
 */
function buildRouteCorridor(airports, { widthNm = 100, sampleNm = 20 } = {}) {
  if (!airports || airports.length < 2) {
    throw new Error('At least 2 airports required for route corridor');
  }

  // Create coordinates array from airports
  const coordinates = airports.map(airport => [airport.lon, airport.lat]);

  // Create LineString through all airports
  const route = lineString(coordinates);

  // Calculate total length of the route
  const totalLength = length(route, { units: 'nauticalmiles' });

  // Sample points along the route
  const samplePoints = [];
  for (let distance = 0; distance <= totalLength; distance += sampleNm) {
    const point = along(route, distance, { units: 'nauticalmiles' });
    samplePoints.push(point.geometry.coordinates);
  }

  // Ensure we have the final point if not already included
  if (samplePoints.length > 0) {
    const lastPoint = samplePoints[samplePoints.length - 1];
    const finalPoint = coordinates[coordinates.length - 1];
    if (lastPoint[0] !== finalPoint[0] || lastPoint[1] !== finalPoint[1]) {
      samplePoints.push(finalPoint);
    }
  }

  // Create new LineString from sampled points
  const sampledRoute = lineString(samplePoints);

  // Convert nautical miles to kilometers for buffer
  const widthKm = widthNm * 1.852;

  // Create buffer around the route
  const corridor = buffer(sampledRoute, widthKm, { units: 'kilometers' });

  return corridor;
}

/**
 * Filter GeoJSON features to only those that intersect with the polygon
 * @param {Object} geojson - GeoJSON FeatureCollection
 * @param {Object} polygon - GeoJSON Polygon to test intersection
 * @returns {Object} Filtered GeoJSON FeatureCollection
 */
function filterGeoJSONByPolygon(geojson, polygon) {
  if (!geojson || !Array.isArray(geojson.features)) return featureCollection([]);
  const kept = [];
  for (const f of geojson.features) {
    try {
      if (booleanIntersects(f, polygon)) kept.push(f);
    } catch {
      // ignore unknown/odd geometry instead of throwing
    }
  }
  return featureCollection(kept);
}

module.exports = {
  buildRouteCorridor,
  filterGeoJSONByPolygon
};