import React, { useState } from 'react';
import { Eye, EyeOff, MapPin, Wind, Cloud, Thermometer } from 'lucide-react';
import { formatCoordinates } from '../utils/mapUtils';
import { parseMetar, parseTaf, getFlightCategoryColor } from '../utils/formatters';

const ENABLE_DEBUG_LOGS = String(import.meta.env?.VITE_ENABLE_DEBUG_LOGS || '').toLowerCase() === 'true';

const MapPopup = ({ 
  airport, 
  sigmet = null, 
  pirep = null, 
  type = 'airport' // 'airport', 'sigmet', 'pirep'
}) => {
  const [showRaw, setShowRaw] = useState(false);

  // Airport popup content
  if (type === 'airport' && airport) {
    const metarText = typeof airport.metar === 'string'
      ? airport.metar
      : (typeof airport.metarRaw === 'string' ? airport.metarRaw : null);

    const tafSummary = airport.tafSummary || (typeof airport.taf === 'object' ? airport.taf : null);
    const tafText = typeof airport.taf === 'string'
      ? airport.taf
      : (typeof airport.tafRaw === 'string' ? airport.tafRaw : (typeof tafSummary?.rawTAF === 'string' ? tafSummary.rawTAF : null));

    const openMeteoForecast = airport.openMeteo || null;
    const openMeteoCurrent = openMeteoForecast?.current || null;
    const openMeteoTemperature = (() => {
      if (!openMeteoCurrent) {
        return null;
      }
      const source = openMeteoCurrent.temperature;
      if (typeof source === 'number' && Number.isFinite(source)) {
        return source;
      }
      if (source && typeof source === 'object') {
        const actual = source.actual ?? source.value ?? null;
        return Number.isFinite(actual) ? actual : null;
      }
      return null;
    })();

    const openMeteoWindSpeed = (() => {
      const wind = openMeteoCurrent?.wind;
      if (!wind || typeof wind !== 'object') {
        return null;
      }
      if (Number.isFinite(wind.speed)) return wind.speed;
      if (Number.isFinite(wind.speed_10m)) return wind.speed_10m;
      return null;
    })();

    const openMeteoWindDirection = (() => {
      const wind = openMeteoCurrent?.wind;
      if (!wind || typeof wind !== 'object') {
        return null;
      }
      if (Number.isFinite(wind.direction)) return wind.direction;
      if (Number.isFinite(wind.direction_10m)) return wind.direction_10m;
      return null;
    })();

    const openMeteoWindSummary = (openMeteoWindSpeed !== null && openMeteoWindDirection !== null)
      ? `${Math.round(openMeteoWindSpeed)} kn @ ${Math.round(openMeteoWindDirection)}°`
      : null;

    let parsedMetar = null;
    let parsedTaf = null;

    if (metarText) {
      try {
        parsedMetar = parseMetar(metarText);
      } catch (error) {
        if (ENABLE_DEBUG_LOGS) {
          console.warn('Failed to parse METAR in MapPopup:', {
            icao: airport?.icaoCode,
            error
          });
        }
        parsedMetar = null;
      }
    }

    if (tafText) {
      try {
        parsedTaf = parseTaf(tafText);
      } catch (error) {
        if (ENABLE_DEBUG_LOGS) {
          console.warn('Failed to parse TAF in MapPopup:', {
            icao: airport?.icaoCode,
            error
          });
        }
        parsedTaf = null;
      }
    }

    return (
      <div className="text-sm max-w-xs">
        <div className="font-bold text-base mb-2">
          {airport.icaoCode || 'Unknown'} - {airport.name || 'Unknown Airport'}
        </div>
        
        <div className="space-y-2">
          <div className="flex items-center space-x-2">
            <MapPin className="w-3 h-3 text-gray-500" />
            <span className="text-xs">{formatCoordinates(airport.latitude, airport.longitude)}</span>
          </div>
          
          {airport.flightCategory && (
            <div className="flex items-center space-x-2">
              <span className="text-xs text-gray-600">Flight Category:</span>
              <span className={`px-2 py-0.5 rounded text-xs font-medium ${getFlightCategoryColor(airport.flightCategory)}`}>
                {airport.flightCategory}
              </span>
            </div>
          )}

          {openMeteoCurrent && (
            <div className="border-t pt-2 space-y-1">
              <div className="font-semibold text-gray-700 text-xs uppercase tracking-wide">Open-Meteo Snapshot</div>
              <div className="grid grid-cols-2 gap-x-3 gap-y-1 text-xs text-gray-700">
                <span className="text-gray-500">Cloud cover</span>
                <span>{Number.isFinite(openMeteoCurrent.cloud_cover) ? `${Math.round(openMeteoCurrent.cloud_cover)}%` : 'N/A'}</span>
                <span className="text-gray-500">Temperature</span>
                <span>{Number.isFinite(openMeteoTemperature)
                  ? `${Math.round(openMeteoTemperature)}°C`
                  : 'N/A'}</span>
                <span className="text-gray-500">Wind</span>
                <span>{openMeteoWindSummary || 'N/A'}</span>
                <span className="text-gray-500">Conditions</span>
                <span>{openMeteoCurrent.weather?.description || 'N/A'}</span>
              </div>
            </div>
          )}

          {/* Current Weather (METAR) */}
          {metarText && (
            <div className="border-t pt-2">
              <div className="flex items-center justify-between mb-2">
                <span className="font-semibold text-gray-700">Current Conditions</span>
                <button
                  onClick={() => setShowRaw(!showRaw)}
                  className="text-xs text-blue-600 hover:text-blue-800 flex items-center space-x-1"
                >
                  {showRaw ? <EyeOff className="w-3 h-3" /> : <Eye className="w-3 h-3" />}
                  <span>{showRaw ? 'Parsed' : 'Raw'}</span>
                </button>
              </div>

              {showRaw ? (
                <div className="text-xs font-mono bg-gray-50 p-2 rounded max-h-20 overflow-y-auto">
                  {metarText || 'METAR unavailable'}
                </div>
              ) : parsedMetar ? (
                <div className="space-y-1 text-xs">
                  {parsedMetar.visibility && (
                    <div className="flex items-center space-x-2">
                      <Eye className="w-3 h-3 text-gray-500" />
                      <span>Visibility: {parsedMetar.visibility} SM</span>
                    </div>
                  )}
                  {parsedMetar.wind && (
                    <div className="flex items-center space-x-2">
                      <Wind className="w-3 h-3 text-gray-500" />
                      <span>Wind: {parsedMetar.wind}</span>
                    </div>
                  )}
                  {parsedMetar.temperature && (
                    <div className="flex items-center space-x-2">
                      <Thermometer className="w-3 h-3 text-gray-500" />
                      <span>Temp: {parsedMetar.temperature}°C</span>
                    </div>
                  )}
                  {parsedMetar.ceiling && (
                    <div className="flex items-center space-x-2">
                      <Cloud className="w-3 h-3 text-gray-500" />
                      <span>Ceiling: {parsedMetar.ceiling} ft</span>
                    </div>
                  )}
                  {parsedMetar.weather && parsedMetar.weather.length > 0 && (
                    <div className="text-xs">
                      <span className="font-medium">Weather: </span>
                      {parsedMetar.weather.join(', ')}
                    </div>
                  )}
                </div>
              ) : (
                <div className="text-xs font-mono bg-gray-50 p-2 rounded max-h-20 overflow-y-auto">
                  {metarText || 'METAR unavailable'}
                </div>
              )}
            </div>
          )}

          {/* Forecast (TAF) */}
          {tafText && (
            <div className="border-t pt-2">
              <div className="flex items-center justify-between mb-2">
                <span className="font-semibold text-gray-700">Forecast (TAF)</span>
              </div>

              {showRaw ? (
                <div className="text-xs font-mono bg-gray-50 p-2 rounded max-h-20 overflow-y-auto">
                  {tafText || 'TAF unavailable'}
                </div>
              ) : parsedTaf ? (
                <div className="space-y-1 text-xs">
                  {parsedTaf.validPeriod && (
                    <div className="text-xs text-gray-600">
                      Valid: {parsedTaf.validPeriod}
                    </div>
                  )}
                  {parsedTaf.conditions && parsedTaf.conditions.length > 0 && (
                    <div className="space-y-1">
                      {parsedTaf.conditions.slice(0, 2).map((condition, index) => (
                        <div key={index} className="bg-gray-50 p-2 rounded">
                          <div className="font-medium text-xs">{condition.time || 'Base Forecast'}</div>
                          <div className="text-xs space-y-0.5">
                            {condition.visibility && <div>Vis: {condition.visibility} SM</div>}
                            {condition.wind && <div>Wind: {condition.wind}</div>}
                            {condition.ceiling && <div>Ceiling: {condition.ceiling} ft</div>}
                            {condition.weather && condition.weather.length > 0 && (
                              <div>Weather: {condition.weather.join(', ')}</div>
                            )}
                          </div>
                        </div>
                      ))}
                      {parsedTaf.conditions.length > 2 && (
                        <div className="text-xs text-gray-500 italic">
                          +{parsedTaf.conditions.length - 2} more periods...
                        </div>
                      )}
                    </div>
                  )}
                </div>
              ) : (
                <div className="text-xs font-mono bg-gray-50 p-2 rounded max-h-20 overflow-y-auto">
                  {tafText || 'TAF unavailable'}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    );
  }

  // SIGMET/ISIGMET popup content
  if ((type === 'sigmet' || type === 'isigmet') && sigmet) {
    return (
      <div className="text-sm max-w-xs">
        <div className="font-bold text-base mb-2">
          {type === 'isigmet' ? 'ISIGMET' : (sigmet.type || 'SIGMET')} - {sigmet.phenomenon || 'Weather Advisory'}
        </div>
        
        <div className="space-y-1">
          {sigmet.validTime && (
            <div><strong>Valid:</strong> {sigmet.validTime}</div>
          )}
          
          {sigmet.altitudes && (
            <div><strong>Altitudes:</strong> {sigmet.altitudes}</div>
          )}
          
          {sigmet.intensity && (
            <div><strong>Intensity:</strong> {sigmet.intensity}</div>
          )}
          
          {sigmet.rawText && (
            <div className="border-t pt-2">
              <div className="flex items-center justify-between mb-2">
                <span className="font-semibold text-gray-700">Details</span>
                <button
                  onClick={() => setShowRaw(!showRaw)}
                  className="text-xs text-blue-600 hover:text-blue-800 flex items-center space-x-1"
                >
                  {showRaw ? <EyeOff className="w-3 h-3" /> : <Eye className="w-3 h-3" />}
                  <span>{showRaw ? 'Summary' : 'Raw'}</span>
                </button>
              </div>
              <div className="text-xs font-mono bg-gray-50 p-2 rounded max-h-20 overflow-y-auto">
                {sigmet.rawText}
              </div>
            </div>
          )}
        </div>
      </div>
    );
  }

  // PIREP popup content
  if (type === 'pirep' && pirep) {
    const latitude = pirep.latitude ?? pirep.lat;
    const longitude = pirep.longitude ?? pirep.lon;
    const altitudeFeet = typeof pirep.altitude === 'object'
      ? pirep.altitude.feet
      : (pirep.altitudeFt ?? (typeof pirep.altitude === 'number' ? pirep.altitude : null));
  const severityValue = (pirep.severity || pirep.intensity || 'UNKNOWN').toString().toUpperCase();
    const phenomenonLabel = Array.isArray(pirep.phenomenon)
      ? pirep.phenomenon.join(', ')
      : (pirep.phenomenonText || pirep.phenomenon || '');

    return (
      <div className="text-sm max-w-xs">
        <div className="font-bold text-base mb-2">
          PIREP - {phenomenonLabel || 'Weather Report'}
        </div>
        
        <div className="space-y-1">
          {(typeof latitude === 'number' && typeof longitude === 'number') && (
            <div><strong>Location:</strong> {formatCoordinates(latitude, longitude)}</div>
          )}
          
          {altitudeFeet !== null && (
            <div><strong>Altitude:</strong> {altitudeFeet.toLocaleString()} ft</div>
          )}
          
          {severityValue && (
            <div>
              <strong>Severity:</strong>
              <span className={`ml-1 px-2 py-0.5 rounded text-xs font-medium ${
                severityValue.includes('SEVERE') ? 'bg-red-100 text-red-800' :
                severityValue.includes('MODERATE') ? 'bg-yellow-100 text-yellow-800' :
                'bg-green-100 text-green-800'
              }`}>
                {severityValue}
              </span>
            </div>
          )}
          
          {pirep.reportTime && (
            <div><strong>Time:</strong> {pirep.reportTime}</div>
          )}
          
          {pirep.rawText && (
            <div className="border-t pt-2">
              <div className="flex items-center justify-between mb-2">
                <span className="font-semibold text-gray-700">Report</span>
                <button
                  onClick={() => setShowRaw(!showRaw)}
                  className="text-xs text-blue-600 hover:text-blue-800 flex items-center space-x-1"
                >
                  {showRaw ? <EyeOff className="w-3 h-3" /> : <Eye className="w-3 h-3" />}
                  <span>{showRaw ? 'Summary' : 'Raw'}</span>
                </button>
              </div>
              <div className="text-xs font-mono bg-gray-50 p-2 rounded max-h-20 overflow-y-auto">
                {pirep.rawText}
              </div>
            </div>
          )}
        </div>
      </div>
    );
  }

  // Fallback content
  return (
    <div className="text-sm">
      <div className="text-gray-500">No data available</div>
    </div>
  );
};

export default MapPopup;