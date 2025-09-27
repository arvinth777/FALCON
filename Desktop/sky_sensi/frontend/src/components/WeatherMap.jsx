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
  onPirepClick
}) => {
  // Requires VITE_OWM_KEY defined in frontend/.env.local
  const owmKey = import.meta.env.VITE_OWM_KEY;
  const hasCloudLayer = Boolean(owmKey);

  const [selectedLayers, setSelectedLayers] = useState({
    airports: showAirports,
    sigmets: showSigmets,
    pireps: showPireps,
    route: true,
    clouds: false,
    precipitation: false,
    wind: false
  });

  // Debug logging for cloud layer
  console.log('Cloud layer debug:', {
    owmKey: owmKey ? `${owmKey.substring(0, 8)}...` : 'NOT_SET',
    hasCloudLayer,
    cloudsEnabled: selectedLayers.clouds
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
    stamen: {
      name: 'Stamen Terrain',
      url: 'https://stamen-tiles-{s}.a.ssl.fastly.net/terrain/{z}/{x}/{y}{r}.png',
      attribution: 'Map tiles by <a href="http://stamen.com">Stamen Design</a>, <a href="http://creativecommons.org/licenses/by/3.0">CC BY 3.0</a> &mdash; Map data &copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
      maxZoom: 18,
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

  // Handle layer toggle
  const toggleLayer = (layerType) => {
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
                checked={selectedLayers.pireps}
                onChange={() => toggleLayer('pireps')}
                className="rounded"
              />
              <span>PIREPs</span>
            </label>

            {hasCloudLayer ? (
              <>
                <label className="flex items-center space-x-2 text-xs text-gray-800">
                  <input
                    type="checkbox"
                    checked={selectedLayers.clouds}
                    onChange={() => toggleLayer('clouds')}
                    className="rounded"
                  />
                  <span>Cloud Coverage</span>
                </label>

                <label className="flex items-center space-x-2 text-xs text-gray-800">
                  <input
                    type="checkbox"
                    checked={selectedLayers.precipitation}
                    onChange={() => toggleLayer('precipitation')}
                    className="rounded"
                  />
                  <span>Precipitation</span>
                </label>

                <label className="flex items-center space-x-2 text-xs text-gray-800">
                  <input
                    type="checkbox"
                    checked={selectedLayers.wind}
                    onChange={() => toggleLayer('wind')}
                    className="rounded"
                  />
                  <span>Wind</span>
                </label>
              </>
            ) : (
              <div className="text-xs text-gray-400 italic">
                Cloud overlay unavailable (set VITE_OWM_KEY)
              </div>
            )}

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

        {hasCloudLayer && selectedLayers.clouds && (
          <TileLayer
            key={`owm-clouds-${owmKey}`}
            url={`https://tile.openweathermap.org/map/clouds_new/{z}/{x}/{y}.png?appid=${owmKey}`}
            opacity={0.6}
            className="owm-tiles"
            attribution="&copy; OpenWeatherMap"
            maxZoom={12}
            zIndex={600}
            eventHandlers={{
              loading: () => console.log('Loading cloud tiles...'),
              load: () => console.log('Cloud tiles loaded successfully'),
              tileerror: (error) => console.error('Cloud tile loading error:', error)
            }}
          />
        )}

        {hasCloudLayer && selectedLayers.precipitation && (
          <TileLayer
            key={`owm-precip-${owmKey}`}
            url={`https://tile.openweathermap.org/map/precipitation_new/{z}/{x}/{y}.png?appid=${owmKey}`}
            opacity={0.9}
            className="owm-tiles"
            attribution="&copy; OpenWeatherMap"
            maxZoom={12}
            zIndex={610}
          />
        )}

        {hasCloudLayer && selectedLayers.wind && (
          <TileLayer
            key={`owm-wind-${owmKey}`}
            url={`https://tile.openweathermap.org/map/wind_new/{z}/{x}/{y}.png?appid=${owmKey}`}
            opacity={0.9}
            className="owm-tiles"
            attribution="&copy; OpenWeatherMap"
            maxZoom={12}
            zIndex={620}
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