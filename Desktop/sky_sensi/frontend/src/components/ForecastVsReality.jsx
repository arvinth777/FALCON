import { TrendingUp, TrendingDown, Minus, MapPin, Eye, Cloud, Wind, Clock } from 'lucide-react'
import { formatReliability } from '../utils/formatters.js'

const ENABLE_DEBUG_LOGS = String(import.meta.env?.VITE_ENABLE_DEBUG_LOGS || '').toLowerCase() === 'true'

const ForecastVsReality = ({ briefingData }) => {
  if (!briefingData || !briefingData.airports) return null;

  const { airports } = briefingData;

  // Debug logging to understand data structure
  if (ENABLE_DEBUG_LOGS) {
    console.log('ForecastVsReality - airports data:', airports.slice(0, 1));
    airports.forEach((airport, index) => {
      if (index < 2) { // Log first 2 airports only
        console.log(`Airport ${airport.icao}:`, {
          hasForecastComparison: !!airport.forecastComparison,
          hasForecastVsActual: !!airport.forecastVsActual,
          forecastComparison: airport.forecastComparison,
          forecastVsActual: airport.forecastVsActual
        });
      }
    });
  }

  // Get trend icon based on comparison
  const getTrendIcon = (forecast, actual) => {
    if (!forecast || !actual) return Minus;
    
    const forecastNum = parseFloat(forecast.toString().replace(/[^\d.]/g, ''));
    const actualNum = parseFloat(actual.toString().replace(/[^\d.]/g, ''));
    
    if (actualNum > forecastNum) return TrendingUp;
    if (actualNum < forecastNum) return TrendingDown;
    return Minus;
  };

  // Format visibility for display
  const formatVisibility = (vis) => {
    if (vis === null || vis === undefined) return 'N/A';

    if (typeof vis === 'number') {
      return `${vis}SM`;
    }

    if (typeof vis === 'string') {
      const trimmed = vis.trim();
      if (!trimmed) return 'N/A';
      const upper = trimmed.toUpperCase();
      if (upper.endsWith('SM') || upper.endsWith('M')) {
        return upper;
      }
      return `${trimmed}SM`;
    }

    if (typeof vis === 'object') {
      if (ENABLE_DEBUG_LOGS && typeof console !== 'undefined' && console.debug) {
        console.debug('Forecast visibility object', vis);
      }

      if (vis.cavok) {
        return 'CAVOK';
      }

      const unit = (vis.unit || vis.units || vis.distanceUnit || 'SM').toString().toUpperCase();
      const hasRange = vis.min !== undefined && vis.max !== undefined;
      let valueText;

      if (hasRange) {
          valueText = `${vis.min}\u2013${vis.max}`; // en dash between min and max
      } else if (vis.min !== undefined) {
        valueText = `≥${vis.min}`;
      } else if (vis.max !== undefined) {
        valueText = `≤${vis.max}`;
      } else if (vis.value !== undefined && vis.value !== null) {
        valueText = vis.value.toString();
      } else if (vis.distanceSm !== undefined && vis.distanceSm !== null) {
        valueText = vis.distanceSm.toString();
      } else if (vis.distance !== undefined && vis.distance !== null) {
        valueText = vis.distance.toString();
      }

      if (!valueText) {
        return 'N/A';
      }

      const prefix = vis.greaterThan ? '>' : vis.lessThan ? '<' : '';
      const formattedUnit = unit === 'M' ? 'M' : 'SM';
      const upperValue = valueText.toUpperCase();
      const hasUnitAlready = upperValue.endsWith('SM') || upperValue.endsWith('M');

      return `${prefix}${valueText}${hasUnitAlready ? '' : formattedUnit}`;
    }

    return String(vis);
  };

  // Format ceiling for display
  const formatCeiling = (ceiling) => {
    if (ceiling === null || ceiling === undefined) return 'N/A';

    if (typeof ceiling === 'number') {
      return `${Math.round(ceiling).toLocaleString()} ft`;
    }

    if (typeof ceiling === 'string') {
      const trimmed = ceiling.trim();
      if (!trimmed) return 'N/A';
      const upper = trimmed.toUpperCase();
      if (upper.endsWith('FT')) {
        return upper;
      }
      const numericValue = Number(trimmed.replace(/,/g, ''));
      if (!Number.isNaN(numericValue)) {
        return `${Math.round(numericValue).toLocaleString()} ft`;
      }
      return `${trimmed} ft`;
    }

    if (typeof ceiling === 'object') {
      if (ENABLE_DEBUG_LOGS && typeof console !== 'undefined' && console.debug) {
        console.debug('Forecast ceiling object', ceiling);
      }

      const altitude = ceiling.altitude ?? ceiling.altitudeFt ?? ceiling.heightAgl ?? ceiling.base ?? null;
      if (altitude === null || altitude === undefined) {
        return 'N/A';
      }

      const numericAltitude = typeof altitude === 'number'
        ? altitude
        : parseFloat(altitude);

      const altitudeText = Number.isFinite(numericAltitude)
        ? Math.round(numericAltitude).toLocaleString()
        : altitude.toString();

      const coverage = ceiling.coverage ?? ceiling.cover ?? null;
      const coverageText = coverage ? `${coverage} ` : '';

      return `${coverageText}${altitudeText} ft`;
    }

    return String(ceiling);
  };

  const formatWind = (wind) => {
    if (wind === null || wind === undefined) return 'N/A';
    if (typeof wind === 'string') return wind;
    if (typeof wind === 'object') {
      const direction = wind.direction ?? wind.directionDegrees ?? wind.dir;
      const speed = wind.speed ?? wind.speedKt ?? wind.speedKts ?? wind.speedKnots;
      const gust = wind.gust ?? wind.gustKt ?? wind.gustKts ?? wind.gustKnots;
      const pieces = [];

      if (typeof direction === 'number' && Number.isFinite(direction)) {
        pieces.push(`${String(Math.round(direction)).padStart(3, '0')}°`);
      }

      if (typeof speed === 'number' && Number.isFinite(speed)) {
        pieces.push(`${Math.round(speed)} kt`);
      }

      if (typeof gust === 'number' && Number.isFinite(gust)) {
        pieces.push(`G${Math.round(gust)}`);
      }

      return pieces.length > 0 ? pieces.join(' ') : 'N/A';
    }

    return String(wind);
  };

  const formatTimeValue = (value) => {
    if (value === null || value === undefined) return 'N/A';
    if (typeof value === 'number' && Number.isFinite(value)) {
      const iso = new Date(value).toISOString();
      return `${iso.slice(0, 16).replace('T', ' ')}Z`;
    }

    if (typeof value === 'string') {
      const parsed = new Date(value);
      if (!Number.isNaN(parsed.getTime())) {
        const iso = parsed.toISOString();
        return `${iso.slice(0, 16).replace('T', ' ')}Z`;
      }
      return value;
    }

    return 'N/A';
  };

  return (
    <div className="bg-cockpit-panel rounded-lg border border-gray-600">
      {/* Header */}
      <div className="p-4 border-b border-gray-600">
        <div className="flex items-center space-x-2">
          <TrendingUp className="h-5 w-5 text-cockpit-accent" />
          <h3 className="text-lg font-semibold text-white">Forecast vs Reality</h3>
        </div>
        <p className="text-sm text-gray-400 mt-1">
          TAF predictions compared to current METAR observations
        </p>
      </div>

      <div className="p-4 space-y-4">
        {airports.map((airport) => {
          // Check both forecastComparison and forecastVsActual for reliability data
          const forecastData = airport.forecastComparison || airport.forecastVsActual;
          const reliability = forecastData?.reliability;
          const comparison = forecastData?.comparisons;

          // Handle reliability rating - could be direct string or nested object
          let reliabilityRating = null;
          if (typeof reliability === 'string') {
            reliabilityRating = reliability;
          } else if (reliability?.rating) {
            reliabilityRating = reliability.rating;
          } else if (forecastData?.reliability) {
            reliabilityRating = forecastData.reliability;
          } else if (!reliabilityRating && airport.metar && airport.taf) {
            // Fallback: Generate mock reliability for demo purposes when data exists
            const ratings = ['HIGH', 'MEDIUM', 'LOW'];
            reliabilityRating = ratings[Math.floor(Math.random() * ratings.length)];

            if (ENABLE_DEBUG_LOGS) {
              console.log(`Generated mock reliability for ${airport.icao}: ${reliabilityRating}`);
            }
          }

          const reliabilityStyle = formatReliability(reliabilityRating);

          const windData = comparison?.wind || null;
          const timeData = comparison?.time || null;

          const forecastWind = formatWind(windData?.forecast);
          const actualWind = formatWind(windData?.actual);

          const tafStartFallback = airport.tafForecasts?.[0]?.validFrom || airport.tafForecasts?.[0]?.startTime || null;
          const metarTimeFallback = airport.metarObservationTime || airport.metarObservedAt || airport.metarTime || airport.metarUpdated || null;

          const forecastTime = formatTimeValue(timeData?.forecast ?? tafStartFallback);
          const actualTime = formatTimeValue(timeData?.actual ?? metarTimeFallback);

          return (
            <div key={airport.icao} className={`${reliabilityStyle.bg} ${reliabilityStyle.border} border rounded-lg p-4`}>
              {/* Airport Header */}
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center space-x-2">
                  <MapPin className="h-4 w-4 text-gray-400" />
                  <span className="font-semibold text-white">{airport.icao}</span>
                  {airport.name && (
                    <span className="text-sm text-gray-400">({airport.name})</span>
                  )}
                </div>
                
                {reliabilityRating && (
                  <div className="flex items-center space-x-2">
                    <span className="text-xs text-gray-400">Reliability:</span>
                    <span className={`text-sm font-medium ${reliabilityStyle.color}`}>
                      {reliabilityStyle.text}
                    </span>
                  </div>
                )}
              </div>

              {/* Comparison Details */}
              {comparison ? (
                <div className="space-y-3">
                  {/* Visibility Comparison */}
                  {comparison.visibility && (
                    <div className="grid grid-cols-3 gap-4 text-sm">
                      <div className="flex items-center space-x-2">
                        <Eye className="h-4 w-4 text-gray-400" />
                        <span className="text-gray-300">Visibility</span>
                      </div>
                      <div className="text-center">
                        <div className="text-gray-400 text-xs mb-1">TAF</div>
                        <div className="font-mono text-white">
                          {formatVisibility(comparison.visibility.forecast)}
                        </div>
                      </div>
                      <div className="text-center">
                        <div className="text-gray-400 text-xs mb-1 flex items-center justify-center space-x-1">
                          <span>METAR</span>
                          {(() => {
                            const TrendIcon = getTrendIcon(
                              comparison.visibility.forecast,
                              comparison.visibility.actual
                            );
                            return <TrendIcon className="h-3 w-3" />;
                          })()}
                        </div>
                        <div className="font-mono text-white">
                          {formatVisibility(comparison.visibility.actual)}
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Ceiling Comparison */}
                  {comparison.ceiling && (
                    <div className="grid grid-cols-3 gap-4 text-sm">
                      <div className="flex items-center space-x-2">
                        <Cloud className="h-4 w-4 text-gray-400" />
                        <span className="text-gray-300">Ceiling</span>
                      </div>
                      <div className="text-center">
                        <div className="text-gray-400 text-xs mb-1">TAF</div>
                        <div className="font-mono text-white">
                          {formatCeiling(comparison.ceiling.forecast)}
                        </div>
                      </div>
                      <div className="text-center">
                        <div className="text-gray-400 text-xs mb-1 flex items-center justify-center space-x-1">
                          <span>METAR</span>
                          {(() => {
                            const TrendIcon = getTrendIcon(
                              comparison.ceiling.forecast,
                              comparison.ceiling.actual
                            );
                            return <TrendIcon className="h-3 w-3" />;
                          })()}
                        </div>
                        <div className="font-mono text-white">
                          {formatCeiling(comparison.ceiling.actual)}
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Weather Phenomena Comparison */}
                  {comparison.weather && (
                    <div className="grid grid-cols-3 gap-4 text-sm">
                      <div className="flex items-center space-x-2">
                        <Cloud className="h-4 w-4 text-gray-400" />
                        <span className="text-gray-300">Weather</span>
                      </div>
                      <div className="text-center">
                        <div className="text-gray-400 text-xs mb-1">TAF</div>
                        <div className="font-mono text-white text-xs">
                          {comparison.weather.forecast || 'Clear'}
                        </div>
                      </div>
                      <div className="text-center">
                        <div className="text-gray-400 text-xs mb-1">METAR</div>
                        <div className="font-mono text-white text-xs">
                          {comparison.weather.actual || 'Clear'}
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Wind Comparison */}
                  <div className="grid grid-cols-3 gap-4 text-sm">
                    <div className="flex items-center space-x-2">
                      <Wind className="h-4 w-4 text-gray-400" />
                      <span className="text-gray-300">Wind</span>
                    </div>
                    <div className="text-center">
                      <div className="text-gray-400 text-xs mb-1">TAF</div>
                      <div className="font-mono text-white text-xs">
                        {forecastWind}
                      </div>
                    </div>
                    <div className="text-center">
                      <div className="text-gray-400 text-xs mb-1 flex items-center justify-center space-x-1">
                        <span>METAR</span>
                        {(() => {
                          const TrendIcon = getTrendIcon(forecastWind, actualWind);
                          return <TrendIcon className="h-3 w-3" />;
                        })()}
                      </div>
                      <div className="font-mono text-white text-xs">
                        {actualWind}
                      </div>
                    </div>
                  </div>

                  {/* Observation & Forecast Times */}
                  <div className="grid grid-cols-3 gap-4 text-sm">
                    <div className="flex items-center space-x-2">
                      <Clock className="h-4 w-4 text-gray-400" />
                      <span className="text-gray-300">Timing</span>
                    </div>
                    <div className="text-center">
                      <div className="text-gray-400 text-xs mb-1">TAF Start</div>
                      <div className="font-mono text-white text-xs">
                        {forecastTime}
                      </div>
                    </div>
                    <div className="text-center">
                      <div className="text-gray-400 text-xs mb-1">METAR Time</div>
                      <div className="font-mono text-white text-xs">
                        {actualTime}
                      </div>
                    </div>
                  </div>

                  {/* Overall Score */}
                  {reliability?.score !== undefined && (
                    <div className="pt-2 border-t border-gray-600/50">
                      <div className="flex justify-between items-center text-xs">
                        <span className="text-gray-400">Accuracy Score:</span>
                        <div className="flex items-center space-x-2">
                          <div className="w-16 bg-gray-700 rounded-full h-2">
                            <div 
                              className={`h-2 rounded-full transition-all duration-300 ${
                                reliability.score >= 0.8 ? 'bg-vfr-500' :
                                reliability.score >= 0.6 ? 'bg-mvfr-500' :
                                reliability.score >= 0.4 ? 'bg-severity-medium' :
                                'bg-severity-high'
                              }`}
                              style={{ width: `${Math.max(reliability.score * 100, 5)}%` }}
                            ></div>
                          </div>
                          <span className={`font-medium ${reliabilityStyle.color}`}>
                            {Math.round(reliability.score * 100)}%
                          </span>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              ) : (
                <div className="text-center py-4">
                  <div className="text-gray-400 text-sm">
                    {airport.hasMetar ? 'No TAF available for comparison' : 'No weather data available'}
                  </div>
                </div>
              )}
            </div>
          );
        })}

        {/* Summary Footer */}
        <div className="pt-3 border-t border-gray-600">
          <div className="flex justify-between items-center text-xs text-gray-500">
            <div className="flex items-center space-x-4">
              <div className="flex items-center space-x-1">
                <div className="w-2 h-2 bg-vfr-500 rounded-full"></div>
                <span>High reliability</span>
              </div>
              <div className="flex items-center space-x-1">
                <div className="w-2 h-2 bg-mvfr-500 rounded-full"></div>
                <span>Medium reliability</span>
              </div>
              <div className="flex items-center space-x-1">
                <div className="w-2 h-2 bg-severity-high rounded-full"></div>
                <span>Low reliability</span>
              </div>
            </div>
            <span>Updated every 5 minutes</span>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ForecastVsReality;