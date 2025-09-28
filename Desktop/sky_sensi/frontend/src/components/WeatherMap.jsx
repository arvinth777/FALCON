import React, { useState, useEffect, useMemo } from 'react';
import { MapContainer, TileLayer, Marker, Popup, Polyline, Polygon, useMap } from 'react-leaflet';
import { divIcon } from 'leaflet';
import 'leaflet/dist/leaflet.css';
import 'leaflet-defaulticon-compatibility/dist/leaflet-defaulticon-compatibility.css';
import 'leaflet-defaulticon-compatibility';
import MapPopup from './MapPopup';
import { getFlightCategory } from '../utils/formatters';
import {
  calculateBounds,
  generateRouteLineCoordinates,
  convertSigmetToPolygon,
  getSigmetColor,
  getPirepIcon,
  getAirportMarkerColor,
  calculateRouteDistance
} from '../utils/mapUtils';
import { getEnv } from '../utils/env';

class MapErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, message: '' };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, message: error?.message || 'Map rendering error' };
  }

  componentDidCatch(error, info) {
    if (import.meta.env.VITE_ENABLE_DEBUG_LOGS === 'true') {
      console.error('WeatherMap rendering error:', error, info);
    }
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className={`bg-gray-100 rounded-lg border-2 border-dashed border-gray-300 p-8 text-center ${this.props.className || ''}`}>
          <div className="text-gray-600">
            <svg className="mx-auto h-12 w-12 text-gray-400 mb-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-1.447-.894L15 4m0 13V4m0 0L9 7" />
            </svg>
            <p className="text-lg font-medium text-gray-900">Map Rendering Issue</p>
            <p className="text-sm">{this.state.message || 'An unexpected error occurred while rendering the map.'}</p>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

// Component to handle map bounds updates
const MapBoundsHandler = ({ bounds }) => {
  const map = useMap();
  
  useEffect(() => {
    if (bounds && bounds.southwest && bounds.northeast) {
      try {
        map.fitBounds([bounds.southwest, bounds.northeast], {
          padding: [20, 20],
          maxZoom: 10
        });
      } catch (error) {
        console.warn('Error fitting map bounds:', error);
      }
    }
  }, [bounds, map]);
  
  return null;
};

const WeatherMap = ({
  airports = [],
  sigmets = [],
  pireps = [],
  metarsByIcao = {},
  tafsByIcao = {},
  openMeteoForecasts = {},
  className = "",
  showAirports = true,
  showSigmets = true,
  showPireps = true,
  onAirportClick,
  onSigmetClick,
  onPirepClick,
  // ⬇️ new
  isigmets: isigmetsProp,
}) => {
  // Requires VITE_OWM_KEY defined in frontend/.env.local
  const OWM_KEY = import.meta.env.VITE_OWM_KEY;
  const hasCloudLayer = Boolean(OWM_KEY);

  const [selectedLayers, setSelectedLayers] = useState({
    airports: showAirports,
    sigmets: showSigmets,
    isigmets: true,
    pireps: showPireps,
    route: true,
    clouds: hasCloudLayer,
    precipitation: false,
    wind: false,
    temperature: false,
    pressure: false
  });

  const [layerLoading, setLayerLoading] = useState({
    clouds: false,
    precipitation: false,
    wind: false,
    temperature: false,
    pressure: false
  });


  const [currentTileLayer, setCurrentTileLayer] = useState('openstreetmap');
  const [mapError, setMapError] = useState(null);
  const [tileLayerErrors, setTileLayerErrors] = useState(new Set());

  // Available tile layer options with fallback capabilities
  const TILE_LAYERS = {
    openstreetmap: {
      name: 'OpenStreetMap',
      url: 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
      maxZoom: 19,
      priority: 1
    },
    cartodb: {
      name: 'CartoDB Positron',
      url: 'https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png',
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>',
      maxZoom: 20,
      priority: 2
    },
    esri: {
      name: 'Esri World Imagery',
      url: 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
      attribution: 'Tiles &copy; Esri &mdash; Source: Esri, i-cubed, USDA, USGS, AEX, GeoEye, Getmapping, Aerogrid, IGN, IGP, UPR-EGP, and the GIS User Community',
      maxZoom: 18,
      priority: 3
    },
    opentopo: {
      name: 'OpenTopoMap',
      url: 'https://{s}.tile.opentopomap.org/{z}/{x}/{y}.png',
      attribution: '&copy; OpenTopoMap &copy; OpenStreetMap contributors',
      maxZoom: 17,
      priority: 4
    }
  };

  // Filter out airports without valid coordinates
  const validAirports = useMemo(() => {
    if (!Array.isArray(airports)) return [];
    return airports.filter(airport => 
      typeof airport.latitude === 'number' && Number.isFinite(airport.latitude) &&
      typeof airport.longitude === 'number' && Number.isFinite(airport.longitude)
    );
  }, [airports]);

  // Enrich airports with raw METAR/TAF data when available
  const enrichedAirports = useMemo(() => {
    return validAirports.map(airport => {
  const icaoCode = (airport.icao || airport.icaoCode || airport.identifier || '').toUpperCase();
  const metarSource = metarsByIcao?.[icaoCode];
  const tafSource = tafsByIcao?.[icaoCode];
  const openMeteoEntry = openMeteoForecasts?.[icaoCode];
  const openMeteo = openMeteoEntry?.forecast || openMeteoEntry || null;

      const tafSummary = typeof airport.taf === 'object' && airport.taf !== null
        ? airport.taf
        : null;

      const tafRawText = typeof airport.taf === 'string' && airport.taf.trim().length > 0
        ? airport.taf
        : (typeof airport.tafRaw === 'string' && airport.tafRaw.trim().length > 0
            ? airport.tafRaw
            : (typeof tafSummary?.rawTAF === 'string' && tafSummary.rawTAF.trim().length > 0
                ? tafSummary.rawTAF
                : (typeof tafSource?.rawTAF === 'string' ? tafSource.rawTAF : null)));

      return {
        ...airport,
        metar: airport.metar ?? metarSource?.rawText ?? null,
        metarRaw: airport.metarRaw ?? metarSource?.rawText ?? null,
        tafSummary,
        taf: tafRawText,
        tafRaw: tafRawText,
        openMeteo
      };
    });
  }, [validAirports, metarsByIcao, tafsByIcao, openMeteoForecasts]);


  // Calculate map bounds based on airports
  const mapBounds = useMemo(() => {
    try {
      return calculateBounds(enrichedAirports, 0.2);
    } catch (error) {
      console.warn('Error calculating map bounds:', error);
      return {
        southwest: [32.0, -125.0],
        northeast: [49.0, -65.0]
      };
    }
  }, [enrichedAirports]);

  // Generate route line coordinates
  const routeCoordinates = useMemo(() => {
    if (!selectedLayers.route || enrichedAirports.length < 2) return [];
    return generateRouteLineCoordinates(enrichedAirports);
  }, [enrichedAirports, selectedLayers.route]);

  // ISIGMET helper functions
  const coerceIsigmetFeatures = (src) => {
    if (!src) return [];
    if (Array.isArray(src)) return src;
    if (src.type === 'FeatureCollection' && Array.isArray(src.features)) return src.features;
    if (src.type === 'Feature') return [src];
    return [];
  };

  const lonLatToLatLng = ([lon, lat]) =>
    (Number.isFinite(lat) && Number.isFinite(lon) && Math.abs(lat) <= 90 && Math.abs(lon) <= 180)
      ? [lat, lon]
      : null;

  const normalizeRing = (ring) => Array.isArray(ring)
    ? ring.map(lonLatToLatLng).filter(Boolean)
    : [];

  const normalizePoly = (coords) =>
    Array.isArray(coords)
      ? coords.map(normalizeRing).filter(r => r.length >= 3)
      : [];

  // Build ISIGMET positions for rendering
  const normalizedIsigmetPolygons = useMemo(() => {
    if (!selectedLayers.isigmets) return [];
    const feats = coerceIsigmetFeatures(isigmetsProp);
    const out = [];
    for (const f of feats) {
      const g = f?.geometry;
      if (!g?.type || !g?.coordinates) continue;
      if (g.type === 'Polygon') {
        const poly = normalizePoly(g.coordinates);
        if (poly.length) out.push({ positions: poly, feature: f });
      } else if (g.type === 'MultiPolygon') {
        for (const part of g.coordinates) {
          const poly = normalizePoly(part);
          if (poly.length) out.push({ positions: poly, feature: f });
        }
      }
    }
    return out;
  }, [isigmetsProp, selectedLayers.isigmets]);

  // Debug logging for ISIGMET data flow
  useEffect(() => {
    if (import.meta.env?.VITE_ENABLE_DEBUG_LOGS === 'true') {
      const raw = coerceIsigmetFeatures(isigmetsProp);
      console.log('[ISIGMET] toggle:', selectedLayers.isigmets,
                  '| raw features:', raw.length,
                  '| polygons:', normalizedIsigmetPolygons.length);
    }
  }, [selectedLayers.isigmets, isigmetsProp, normalizedIsigmetPolygons]);

  const normalizePolygon = (polygon) => {
    if (!Array.isArray(polygon)) {
      return [];
    }

    const rings = Array.isArray(polygon[0]) && Array.isArray(polygon[0][0])
      ? polygon
      : [polygon];

    return rings
      .map((ring) => {
        if (!Array.isArray(ring)) return [];

        const normalizedRing = ring
          .map((coord) => {
            if (!Array.isArray(coord) || coord.length < 2) {
              return null;
            }

            const [first, second] = coord;
            let lat = first;
            let lon = second;

            // If the first value looks like longitude and second like latitude, swap them
            if ((Math.abs(first) > 90 && Math.abs(second) <= 90) || (Math.abs(first) <= 180 && Math.abs(second) > 90)) {
              lat = second;
              lon = first;
            }

            if (!Number.isFinite(lat) || !Number.isFinite(lon)) {
              return null;
            }

            if (Math.abs(lat) > 90 || Math.abs(lon) > 180) {
              return null;
            }

            return [lat, lon];
          })
          .filter(Boolean);

        return normalizedRing;
      })
      .filter(ring => ring.length >= 3);
  };

  const normalizedSigmetPolygons = useMemo(() => {
    if (!selectedLayers.sigmets || !Array.isArray(sigmets)) {
      return [];
    }

    const normalized = [];

    sigmets.forEach(sigmet => {
      try {
        const polygons = convertSigmetToPolygon(sigmet);
        polygons.forEach((polygon, polygonIndex) => {
          const coords = normalizePolygon(polygon);
          if (coords.length > 0) {
            normalized.push({
              sigmet,
              coordinates: coords,
              polygonIndex
            });
          }
        });
      } catch (error) {
        console.warn('Failed to convert SIGMET polygon:', error);
      }
    });

    return normalized;
  }, [sigmets, selectedLayers.sigmets]);


  const MAX_PIREPS_BEFORE_CLUSTER = 100;

  const aggregatedPireps = useMemo(() => {
    if (!Array.isArray(pireps)) return [];

    const validPireps = pireps.filter((pirep) => {
      const lat = pirep.latitude ?? pirep.lat;
      const lon = pirep.longitude ?? pirep.lon;
      return typeof lat === 'number' && Number.isFinite(lat) && typeof lon === 'number' && Number.isFinite(lon);
    });

    if (validPireps.length <= MAX_PIREPS_BEFORE_CLUSTER) {
      return validPireps.map(pirep => ({ ...pirep, __cluster: false }));
    }

    const buckets = new Map();
    const resolution = 0.5;

    validPireps.forEach((pirep) => {
      const lat = pirep.latitude ?? pirep.lat;
      const lon = pirep.longitude ?? pirep.lon;

      const bucketKey = `${Math.round(lat / resolution) * resolution}_${Math.round(lon / resolution) * resolution}`;
      if (!buckets.has(bucketKey)) {
        buckets.set(bucketKey, {
          pireps: [],
          latSum: 0,
          lonSum: 0
        });
      }

      const bucket = buckets.get(bucketKey);
      bucket.pireps.push(pirep);
      bucket.latSum += lat;
      bucket.lonSum += lon;
    });

    return Array.from(buckets.values()).map((bucket) => {
      const count = bucket.pireps.length;
      const representative = bucket.pireps[0];
      return {
        ...representative,
        latitude: bucket.latSum / count,
        longitude: bucket.lonSum / count,
        __cluster: true,
        __clusterSize: count,
        __clusterMembers: bucket.pireps
      };
    });
  }, [pireps]);

  // Create custom airport markers
  const createAirportMarker = (airport) => {
    const color = getAirportMarkerColor(airport.flightCategory);
    return divIcon({
      html: `
        <div class="airport-marker" style="
          width: 24px;
          height: 24px;
          border-radius: 50%;
          background-color: ${color};
          border: 3px solid white;
          box-shadow: 0 2px 4px rgba(0,0,0,0.3);
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 10px;
          font-weight: bold;
          color: white;
          text-shadow: 1px 1px 1px rgba(0,0,0,0.7);
        ">
          ${airport.icaoCode?.slice(-3) || '???'}
        </div>
      `,
      className: 'custom-div-icon',
      iconSize: [24, 24],
      iconAnchor: [12, 12],
      popupAnchor: [0, -12]
    });
  };

  // Create PIREP markers
  const createPirepMarker = (pirep) => {
    if (pirep.__cluster) {
      const severityClass = 'bg-indigo-600';
      return divIcon({
        html: `
          <div class="pirep-cluster ${severityClass}" style="
            width: 32px;
            height: 32px;
            border-radius: 50%;
            color: #fff;
            font-weight: 700;
            display: flex;
            align-items: center;
            justify-content: center;
            box-shadow: 0 2px 6px rgba(0,0,0,0.4);
          ">
            ${pirep.__clusterSize}
          </div>
        `,
        className: 'custom-div-icon',
        iconSize: [32, 32],
        iconAnchor: [16, 16],
        popupAnchor: [0, -16]
      });
    }

    const iconConfig = getPirepIcon(pirep.phenomenon, pirep.severity || pirep.intensity);
    return divIcon({
      html: iconConfig.html,
      className: 'custom-div-icon',
      iconSize: iconConfig.iconSize,
      iconAnchor: iconConfig.iconAnchor,
      popupAnchor: iconConfig.popupAnchor
    });
  };

  // Handle tile loading errors with automatic fallback
  const handleTileError = (error) => {
    console.error('Tile loading error:', error);
    
    // Add current layer to error set
    const newErrors = new Set(tileLayerErrors);
    newErrors.add(currentTileLayer);
    setTileLayerErrors(newErrors);
    
    // Try to find a working fallback layer
    const availableLayers = Object.keys(TILE_LAYERS)
      .filter(layer => !newErrors.has(layer))
      .sort((a, b) => TILE_LAYERS[a].priority - TILE_LAYERS[b].priority);
    
    if (availableLayers.length > 0) {
      const fallbackLayer = availableLayers[0];
      console.log(`Switching to fallback tile layer: ${TILE_LAYERS[fallbackLayer].name}`);
      setCurrentTileLayer(fallbackLayer);
    } else {
      console.error('All tile layers have failed');
      setMapError('Failed to load map tiles. Please check your internet connection.');
    }
  };

  // Handle layer toggle with intelligent management
  const toggleLayer = (layerType) => {
    // For weather layers, manage loading state
    if (['clouds', 'precipitation', 'wind', 'temperature', 'pressure'].includes(layerType)) {
      if (!selectedLayers[layerType]) {
        setLayerLoading(prev => ({ ...prev, [layerType]: true }));
        // Reset loading state after a brief delay
        setTimeout(() => {
          setLayerLoading(prev => ({ ...prev, [layerType]: false }));
        }, 1500);
      }
    }

    setSelectedLayers(prev => ({
      ...prev,
      [layerType]: !prev[layerType]
    }));
  };

  // Handle tile layer switching
  const switchTileLayer = (layerKey) => {
    if (TILE_LAYERS[layerKey] && !tileLayerErrors.has(layerKey)) {
      setCurrentTileLayer(layerKey);
    }
  };

  // Reset tile layer errors (retry mechanism)
  const resetTileErrors = () => {
    setTileLayerErrors(new Set());
    setMapError(null);
    setCurrentTileLayer('openstreetmap'); // Reset to default
  };

  if (mapError) {
    return (
      <div className={`bg-gray-100 rounded-lg border-2 border-dashed border-gray-300 p-8 text-center ${className}`}>
        <div className="text-gray-600">
          <svg className="mx-auto h-12 w-12 text-gray-400 mb-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-1.447-.894L15 4m0 13V4m0 0L9 7" />
          </svg>
          <p className="text-lg font-medium text-gray-900">Map Unavailable</p>
          <p className="text-sm">{mapError}</p>
        </div>
      </div>
    );
  }

  return (
    <MapErrorBoundary className={`relative ${className}`}>
      <div className={`relative ${className}`}>
      {/* Layer Controls */}
      <div className="absolute top-4 right-4 z-[1000] bg-white text-gray-900 rounded-lg shadow-lg p-3 space-y-3 max-w-xs">
        {/* Data Layers */}
        <div>
          <div className="text-xs font-semibold text-gray-700 mb-2">Data Layers</div>
          <div className="space-y-1">
            <label className="flex items-center space-x-2 text-xs text-gray-800">
              <input
                type="checkbox"
                checked={selectedLayers.route}
                onChange={() => toggleLayer('route')}
                className="rounded"
              />
              <span>Route Line</span>
            </label>

            <label className="flex items-center space-x-2 text-xs text-gray-800">
              <input
                type="checkbox"
                checked={selectedLayers.airports}
                onChange={() => toggleLayer('airports')}
                className="rounded"
              />
              <span>Airports</span>
            </label>
            
            <label className="flex items-center space-x-2 text-xs text-gray-800">
              <input
                type="checkbox"
                checked={selectedLayers.sigmets}
                onChange={() => toggleLayer('sigmets')}
                className="rounded"
              />
              <span>SIGMETs</span>
            </label>

            <label className="flex items-center space-x-2 text-xs text-gray-800">
              <input
                type="checkbox"
                checked={selectedLayers.isigmets}
                onChange={() => toggleLayer('isigmets')}
                className="rounded"
              />
              <span>ISIGMETs</span>
            </label>

            <label className="flex items-center space-x-2 text-xs text-gray-800">
              <input
                type="checkbox"
                checked={selectedLayers.pireps}
                onChange={() => toggleLayer('pireps')}
                className="rounded"
              />
              <span>PIREPs</span>
            </label>

            {/* Weather Overlays Subsection */}
            <div className="mt-3 pt-2 border-t border-gray-200">
              <div className="text-xs font-medium text-gray-600 mb-2">Weather Overlays</div>
              <div className="space-y-1 pl-2">
                <label className={`flex items-center space-x-2 text-xs ${hasCloudLayer ? 'text-gray-800' : 'text-gray-400'}`}>
                  <input
                    type="checkbox"
                    checked={selectedLayers.clouds && hasCloudLayer}
                    onChange={() => hasCloudLayer && toggleLayer('clouds')}
                    className="rounded"
                    disabled={!hasCloudLayer || layerLoading.clouds}
                  />
                  <span>Cloud Coverage{layerLoading.clouds ? ' (loading...)' : (!hasCloudLayer ? ' (unavailable: set VITE_OWM_KEY)' : '')}</span>
                </label>

                <label className={`flex items-center space-x-2 text-xs ${hasCloudLayer ? 'text-gray-800' : 'text-gray-400'}`}>
                  <input
                    type="checkbox"
                    checked={selectedLayers.precipitation && hasCloudLayer}
                    onChange={() => hasCloudLayer && toggleLayer('precipitation')}
                    className="rounded"
                    disabled={!hasCloudLayer || layerLoading.precipitation}
                  />
                  <span>Precipitation{layerLoading.precipitation ? ' (loading...)' : (!hasCloudLayer ? ' (unavailable: set VITE_OWM_KEY)' : '')}</span>
                </label>

                <label className={`flex items-center space-x-2 text-xs ${hasCloudLayer ? 'text-gray-800' : 'text-gray-400'}`}>
                  <input
                    type="checkbox"
                    checked={selectedLayers.wind && hasCloudLayer}
                    onChange={() => hasCloudLayer && toggleLayer('wind')}
                    className="rounded"
                    disabled={!hasCloudLayer || layerLoading.wind}
                  />
                  <span>Wind{layerLoading.wind ? ' (loading...)' : (!hasCloudLayer ? ' (unavailable: set VITE_OWM_KEY)' : '')}</span>
                </label>

                <label className={`flex items-center space-x-2 text-xs ${hasCloudLayer ? 'text-gray-800' : 'text-gray-400'}`}>
                  <input
                    type="checkbox"
                    checked={selectedLayers.temperature && hasCloudLayer}
                    onChange={() => hasCloudLayer && toggleLayer('temperature')}
                    className="rounded"
                    disabled={!hasCloudLayer || layerLoading.temperature}
                  />
                  <span>Temperature{layerLoading.temperature ? ' (loading...)' : (!hasCloudLayer ? ' (unavailable: set VITE_OWM_KEY)' : '')}</span>
                </label>

                <label className={`flex items-center space-x-2 text-xs ${hasCloudLayer ? 'text-gray-800' : 'text-gray-400'}`}>
                  <input
                    type="checkbox"
                    checked={selectedLayers.pressure && hasCloudLayer}
                    onChange={() => hasCloudLayer && toggleLayer('pressure')}
                    className="rounded"
                    disabled={!hasCloudLayer || layerLoading.pressure}
                  />
                  <span>Pressure{layerLoading.pressure ? ' (loading...)' : (!hasCloudLayer ? ' (unavailable: set VITE_OWM_KEY)' : '')}</span>
                </label>
              </div>
            </div>

          </div>
        </div>

        {/* Base Map Layer Selector */}
        <div className="border-t pt-2">
          <div className="text-xs font-semibold text-gray-700 mb-2">Base Map</div>
          <select 
            value={currentTileLayer}
            onChange={(e) => switchTileLayer(e.target.value)}
            className="text-xs w-full rounded border-gray-300 focus:border-blue-500 focus:ring-blue-500 text-gray-900"
          >
            {Object.entries(TILE_LAYERS).map(([key, layer]) => (
              <option 
                key={key} 
                value={key}
                disabled={tileLayerErrors.has(key)}
              >
                {layer.name} {tileLayerErrors.has(key) ? '(Failed)' : ''}
              </option>
            ))}
          </select>
          
          {tileLayerErrors.size > 0 && (
            <button
              onClick={resetTileErrors}
              className="mt-1 text-xs text-blue-600 hover:text-blue-800 underline"
            >
              Retry Failed Layers
            </button>
          )}
        </div>
      </div>

      {/* Map Legend */}
      <div className="absolute bottom-4 left-4 z-[1000] bg-white text-gray-900 rounded-lg shadow-lg p-3">
        <div className="text-xs font-semibold text-gray-700 mb-2">Flight Categories</div>
        <div className="space-y-1">
          <div className="flex items-center space-x-2">
            <div className="w-3 h-3 rounded-full bg-green-500"></div>
            <span className="text-xs text-gray-800">VFR (&gt;5 mi, &gt;3000 ft)</span>
          </div>
          <div className="flex items-center space-x-2">
            <div className="w-3 h-3 rounded-full bg-yellow-500"></div>
            <span className="text-xs text-gray-800">MVFR (3-5 mi, 1000-3000 ft)</span>
          </div>
          <div className="flex items-center space-x-2">
            <div className="w-3 h-3 rounded-full bg-red-500"></div>
            <span className="text-xs text-gray-800">IFR (1-3 mi, 500-1000 ft)</span>
          </div>
          <div className="flex items-center space-x-2">
            <div className="w-3 h-3 rounded-full bg-purple-500"></div>
            <span className="text-xs text-gray-800">LIFR (&lt;1 mi, &lt;500 ft)</span>
          </div>
        </div>
      </div>

      {/* Map Container */}
      <MapContainer
        center={[39.8283, -98.5795]} // Geographic center of US
        zoom={5}
        scrollWheelZoom={true}
        className="h-full w-full rounded-lg"
        style={{ minHeight: '400px' }}
        preferCanvas={true}
        updateWhenIdle={true}
        updateWhenZooming={false}
        fadeAnimation={true}
        zoomAnimation={true}
        markerZoomAnimation={true}
      >
        <TileLayer
          key={currentTileLayer} // Force re-render when tile layer changes
          attribution={TILE_LAYERS[currentTileLayer].attribution}
          url={TILE_LAYERS[currentTileLayer].url}
          maxZoom={TILE_LAYERS[currentTileLayer].maxZoom}
          eventHandlers={{
            tileerror: handleTileError,
            loading: () => console.log(`Loading ${TILE_LAYERS[currentTileLayer].name} tiles`),
            load: () => console.log(`${TILE_LAYERS[currentTileLayer].name} tiles loaded successfully`)
          }}
        />

        {OWM_KEY && selectedLayers.clouds && (
          <TileLayer
            key={`owm-clouds-${OWM_KEY}`}
            url={`https://tile.openweathermap.org/map/clouds_new/{z}/{x}/{y}.png?appid=${OWM_KEY}`}
            opacity={0.7}
            className="owm-cloud-tiles"
            attribution="Weather data &copy; OpenWeatherMap"
            maxZoom={12}
            zIndex={650}
            tileSize={256}
            updateWhenIdle={true}
            updateWhenZooming={false}
            keepBuffer={2}
            crossOrigin={true}
            eventHandlers={{
              loading: () => {
                setLayerLoading(prev => ({ ...prev, clouds: true }));
                console.log('Loading cloud tiles...');
              },
              load: () => {
                setLayerLoading(prev => ({ ...prev, clouds: false }));
                console.log('Cloud tiles loaded successfully');
              },
              tileerror: (error) => {
                setLayerLoading(prev => ({ ...prev, clouds: false }));
                console.error('Cloud tile loading error:', error);
              }
            }}
          />
        )}

        {OWM_KEY && selectedLayers.precipitation && (
          <TileLayer
            key={`owm-precip-${OWM_KEY}`}
            url={`https://tile.openweathermap.org/map/precipitation_new/{z}/{x}/{y}.png?appid=${OWM_KEY}`}
            opacity={0.7}
            className="owm-precip-tiles"
            attribution="Weather data &copy; OpenWeatherMap"
            maxZoom={12}
            zIndex={610}
            tileSize={256}
            updateWhenIdle={true}
            updateWhenZooming={false}
            keepBuffer={2}
            crossOrigin={true}
            eventHandlers={{
              loading: () => setLayerLoading(prev => ({ ...prev, precipitation: true })),
              load: () => setLayerLoading(prev => ({ ...prev, precipitation: false })),
              tileerror: () => setLayerLoading(prev => ({ ...prev, precipitation: false }))
            }}
          />
        )}

        {OWM_KEY && selectedLayers.wind && (
          <TileLayer
            key={`owm-wind-${OWM_KEY}`}
            url={`https://tile.openweathermap.org/map/wind_new/{z}/{x}/{y}.png?appid=${OWM_KEY}`}
            opacity={0.7}
            className="owm-wind-tiles"
            attribution="Weather data &copy; OpenWeatherMap"
            maxZoom={12}
            zIndex={620}
            tileSize={256}
            updateWhenIdle={true}
            updateWhenZooming={false}
            keepBuffer={2}
            crossOrigin={true}
            eventHandlers={{
              loading: () => setLayerLoading(prev => ({ ...prev, wind: true })),
              load: () => setLayerLoading(prev => ({ ...prev, wind: false })),
              tileerror: () => setLayerLoading(prev => ({ ...prev, wind: false }))
            }}
          />
        )}

        {OWM_KEY && selectedLayers.temperature && (
          <TileLayer
            key={`owm-temp-${OWM_KEY}`}
            url={`https://tile.openweathermap.org/map/temp_new/{z}/{x}/{y}.png?appid=${OWM_KEY}`}
            opacity={0.6}
            className="owm-temp-tiles"
            attribution="Weather data &copy; OpenWeatherMap"
            maxZoom={12}
            zIndex={605}
            tileSize={256}
            updateWhenIdle={true}
            updateWhenZooming={false}
            keepBuffer={2}
            crossOrigin={true}
            eventHandlers={{
              loading: () => {
                setLayerLoading(prev => ({ ...prev, temperature: true }));
                if (import.meta.env.VITE_ENABLE_DEBUG_LOGS === 'true') {
                  console.debug('[OWM] Temperature layer mounted');
                }
              },
              load: () => setLayerLoading(prev => ({ ...prev, temperature: false })),
              tileerror: () => setLayerLoading(prev => ({ ...prev, temperature: false }))
            }}
          />
        )}

        {OWM_KEY && selectedLayers.pressure && (
          <TileLayer
            key={`owm-pressure-${OWM_KEY}`}
            url={`https://tile.openweathermap.org/map/pressure_new/{z}/{x}/{y}.png?appid=${OWM_KEY}`}
            opacity={0.6}
            className="owm-pressure-tiles"
            attribution="Weather data &copy; OpenWeatherMap"
            maxZoom={12}
            zIndex={600}
            tileSize={256}
            updateWhenIdle={true}
            updateWhenZooming={false}
            keepBuffer={2}
            crossOrigin={true}
            eventHandlers={{
              loading: () => {
                setLayerLoading(prev => ({ ...prev, pressure: true }));
                if (import.meta.env.VITE_ENABLE_DEBUG_LOGS === 'true') {
                  console.debug('[OWM] Pressure layer mounted');
                }
              },
              load: () => setLayerLoading(prev => ({ ...prev, pressure: false })),
              tileerror: () => setLayerLoading(prev => ({ ...prev, pressure: false }))
            }}
          />
        )}
        
        {/* Handle map bounds */}
        <MapBoundsHandler bounds={mapBounds} />

        {/* Airport Markers */}
        {selectedLayers.airports && enrichedAirports.map((airport, index) => (
          <Marker
            key={`airport-${airport.icaoCode || airport.icao || index}`}
            position={[airport.latitude, airport.longitude]}
            icon={createAirportMarker(airport)}
            eventHandlers={{
              click: () => onAirportClick?.(airport)
            }}
          >
            <Popup>
              <MapPopup airport={airport} type="airport" />
            </Popup>
          </Marker>
        ))}

        {/* Route Line */}
        {selectedLayers.route && routeCoordinates.length > 1 && (
          <Polyline
            positions={routeCoordinates}
            pathOptions={{
              color: '#2563EB',
              weight: 3,
              opacity: 0.8,
              dashArray: '10, 5'
            }}
          >
            <Popup>
              <div className="text-sm">
                <div className="font-bold">Flight Route</div>
                {(() => {
                  const { totalDistance, legs, error } = calculateRouteDistance(enrichedAirports);
                  
                  if (error) {
                    return <div>Distance: Unable to calculate</div>;
                  }
                  
                  return (
                    <div>
                      <div>Total Distance: {totalDistance.toFixed(1)} NM</div>
                      {legs.length > 1 && (
                        <div className="mt-2">
                          <div className="text-xs font-medium text-gray-600 mb-1">Legs:</div>
                          {legs.map((leg, index) => (
                            <div key={index} className="text-xs text-gray-500">
                              {leg.from} → {leg.to}: {leg.distance.toFixed(1)} NM ({leg.bearing.toFixed(0)}°)
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  );
                })()}
              </div>
            </Popup>
          </Polyline>
        )}

        {/* SIGMET/ISIGMET Polygons */}
        {selectedLayers.sigmets && normalizedSigmetPolygons.map(({ sigmet, coordinates, polygonIndex }, index) => {
          const color = getSigmetColor(sigmet.phenomenon);

          if (coordinates.length === 0) {
            return null;
          }

          return (
            <Polygon
              key={`sigmet-${sigmet.id || index}-${polygonIndex}`}
              positions={coordinates}
              pathOptions={{
                color,
                weight: 2,
                opacity: 0.8,
                fillColor: color,
                fillOpacity: 0.2
              }}
              eventHandlers={{
                click: () => onSigmetClick?.(sigmet)
              }}
            >
              <Popup>
                <MapPopup sigmet={sigmet} type="sigmet" />
              </Popup>
            </Polygon>
          );
        })}

        {/* ISIGMET Polygons */}
        {selectedLayers.isigmets && normalizedIsigmetPolygons.map((item, idx) => (
          <Polygon
            key={`isigmet-${idx}`}
            positions={item.positions}
            pathOptions={{
              color: '#7c3aed',       // stroke
              weight: 2.5,
              opacity: 0.9,
              fillColor: '#7c3aed',   // fill
              fillOpacity: 0.22,
            }}
            pane="overlayPane"
            eventHandlers={{
              click: () => {
                const f = item.feature;
                console.log("ISIGMET clicked:", f);
                onSigmetClick?.(f);
              }
            }}
          >
            <Popup>
              <div className="text-sm">
                <div className="font-bold">{item.feature?.type || 'ISIGMET'}</div>
                {item.feature?.phenomenon && (
                  <div className="text-gray-600">Phenomenon: {item.feature.phenomenon}</div>
                )}
                {item.feature?.id && (
                  <div className="text-gray-600">ID: {item.feature.id}</div>
                )}
                {item.feature?.validTimeFrom && item.feature?.validTimeTo && (
                  <div className="text-gray-600">
                    Valid: {item.feature.validTimeFrom} → {item.feature.validTimeTo}
                  </div>
                )}
                {item.feature?.levelinfo && (
                  <div className="text-gray-600">Level: {item.feature.levelinfo}</div>
                )}
              </div>
            </Popup>
          </Polygon>
        ))}

        {/* PIREP Markers */}
        {selectedLayers.pireps && aggregatedPireps.map((pirep, index) => {
          const lat = pirep.latitude ?? pirep.lat;
          const lon = pirep.longitude ?? pirep.lon;

          if (typeof lat !== 'number' || !Number.isFinite(lat) || typeof lon !== 'number' || !Number.isFinite(lon)) {
            return null;
          }

          return (
            <Marker
              key={`pirep-${pirep.__cluster ? `cluster-${index}` : (pirep.id || index)}`}
              position={[lat, lon]}
              icon={createPirepMarker(pirep)}
              eventHandlers={{
                click: () => onPirepClick?.(pirep)
              }}
            >
              <Popup>
                <MapPopup pirep={pirep} type="pirep" />
              </Popup>
            </Marker>
          );
        })}
      </MapContainer>
      </div>
    </MapErrorBoundary>
  );
};

export default WeatherMap;