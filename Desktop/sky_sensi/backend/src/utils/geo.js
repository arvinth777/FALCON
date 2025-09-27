function extractPoints(geometry) {
  if (!geometry || typeof geometry !== 'object') {
    return [];
  }

  const { type } = geometry;
  if (!type) {
    return [];
  }

  if (type === 'GeometryCollection') {
    const geometries = Array.isArray(geometry.geometries) ? geometry.geometries : [];
    return geometries.flatMap(extractPoints);
  }

  const coordinates = geometry.coordinates;
  if (coordinates === undefined || coordinates === null) {
    return [];
  }

  switch (type) {
    case 'Point':
      return Array.isArray(coordinates) ? [coordinates] : [];
    case 'MultiPoint':
    case 'LineString':
      return Array.isArray(coordinates) ? coordinates : [];
    case 'MultiLineString':
    case 'Polygon':
      return Array.isArray(coordinates)
        ? coordinates.flatMap(segment => extractPoints({ type: 'LineString', coordinates: segment }))
        : [];
    case 'MultiPolygon':
      return Array.isArray(coordinates)
        ? coordinates.flatMap(polygon => extractPoints({ type: 'Polygon', coordinates: polygon }))
        : [];
    default:
      return [];
  }
}

function isValidGeometry(geometry) {
  if (!geometry || typeof geometry !== 'object') {
    return false;
  }

  const flattened = extractPoints(geometry);
  if (!Array.isArray(flattened) || flattened.length === 0) {
    return false;
  }

  return flattened.every(point => {
    if (!Array.isArray(point) || point.length < 2) {
      return false;
    }

    const lon = Number(point[0]);
    const lat = Number(point[1]);
    return Number.isFinite(lon) && Number.isFinite(lat);
  });
}

module.exports = {
  isValidGeometry
};
