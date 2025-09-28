const bi = require("@turf/boolean-intersects").default || require("@turf/boolean-intersects");
const buffer = require("@turf/buffer").default || require("@turf/buffer");
const { lineString, featureCollection } = require("@turf/helpers");

function safeFeatureId(f, idx) {
  return (
    f?.id ||
    f?.properties?.id ||
    f?.properties?.sigmet_id ||
    f?.properties?.uuid ||
    `${f?.properties?.issuing_unit || "isigmet"}-${f?.properties?.issueTime || f?.properties?.validTimeFrom || "t"}-${idx}`
  );
}

function coerceGeometry(feature) {
  const g = feature?.geometry;
  if (!g || !g.type) return null;
  if (g.type === "Polygon" || g.type === "MultiPolygon" || g.type === "LineString") return feature;
  if (g.type === "GeometryCollection") {
    const pick = (g.geometries || []).find(gg => ["Polygon","MultiPolygon","LineString"].includes(gg.type));
    return pick ? { ...feature, geometry: pick } : null;
  }
  return null;
}

/** Normalize ISIGMET FeatureCollection:
 *  • ensure id
 *  • drop unsupported/null geometries
 *  • buffer LineString by ~10 km so we can area-intersect and display
 */
function normalizeISIGMET(fc, { bufferKmForLines = 10 } = {}) {
  if (!fc || !Array.isArray(fc.features)) return featureCollection([]);
  const kept = [];
  let dropped = 0;

  fc.features.forEach((f, idx) => {
    try {
      const withGeom = coerceGeometry(f);
      if (!withGeom) { dropped++; return; }
      const id = safeFeatureId(withGeom, idx);
      const props = withGeom.properties || {};
      const geom = withGeom.geometry;

      if (geom.type === "LineString") {
        const ls = lineString(geom.coordinates);
        const poly = buffer(ls, bufferKmForLines, { units: "kilometers" });
        if (!poly) { dropped++; return; }
        kept.push({ type: "Feature", id, properties: { ...props, _bufferedFrom: "LineString" }, geometry: poly.geometry });
      } else {
        kept.push({ type: "Feature", id, properties: props, geometry: geom });
      }
    } catch {
      dropped++;
    }
  });

  const out = featureCollection(kept);
  out._dropped = dropped;
  return out;
}

module.exports = { normalizeISIGMET };