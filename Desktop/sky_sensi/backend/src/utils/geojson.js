// Enforce returning a proper FeatureCollection (never null/undefined)
function ensureFeatureCollection(fc) {
  if (fc && Array.isArray(fc.features)) return fc;
  return { type: 'FeatureCollection', features: [] };
}

module.exports = { ensureFeatureCollection };