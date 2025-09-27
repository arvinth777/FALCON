import { Brain, Eye, EyeOff, Sparkles, Cloud, Wind, Thermometer } from 'lucide-react'

const AISummary = ({ briefingData, showRawData, onToggleRawData }) => {
  if (!briefingData) return null;

  const { aiSummary, rawData, metarsByIcao, tafsByIcao, openMeteoForecasts, airports } = briefingData;

  // Get confidence level styling
  const getConfidenceColor = (confidence) => {
    switch (confidence?.toUpperCase()) {
      case 'HIGH': return 'text-vfr-500';
      case 'MEDIUM': return 'text-mvfr-500';
      case 'LOW': return 'text-severity-high';
      default: return 'text-gray-400';
    }
  };

  // Format raw METAR/TAF data for display
  const formatRawData = () => {
    const sections = [];
    const metars = {
      ...(metarsByIcao || {}),
      ...(rawData?.metarsByIcao || {})
    };
    const tafs = {
      ...(tafsByIcao || {}),
      ...(rawData?.tafsByIcao || {})
    };
    
    // METAR data
    const metarEntries = Object.entries(metars);
    if (metarEntries.length > 0) {
      sections.push('=== CURRENT WEATHER (METAR) ===');
      metarEntries.forEach(([icao, metar]) => {
        const metarText = typeof metar === 'string' ? metar : metar?.rawText;
        sections.push(`${icao}: ${metarText || 'No METAR available'}`);
      });
      sections.push('');
    }

    // TAF data
    const tafEntries = Object.entries(tafs);
    if (tafEntries.length > 0) {
      sections.push('=== FORECASTS (TAF) ===');
      tafEntries.forEach(([icao, taf]) => {
        const tafText = typeof taf === 'string' ? taf : taf?.rawTAF;
        sections.push(`${icao}: ${tafText || 'No TAF available'}`);
      });
      sections.push('');
    }

    return sections.join('\n');
  };

  const normalizeOpenMeteoSnapshot = (icao, name) => {
    if (!icao || !openMeteoForecasts) {
      return null;
    }

    const forecastEntry = openMeteoForecasts[icao];
    const current = forecastEntry?.forecast?.current || forecastEntry?.current || null;

    if (!current || typeof current !== 'object') {
      return null;
    }

    const temperatureSource = current.temperature;
    const temperature = typeof temperatureSource === 'number'
      ? temperatureSource
      : (temperatureSource && typeof temperatureSource === 'object'
          ? (Number.isFinite(temperatureSource.actual)
              ? temperatureSource.actual
              : Number.isFinite(temperatureSource.value)
                ? temperatureSource.value
                : null)
          : null);

    const wind = current.wind && typeof current.wind === 'object' ? current.wind : null;
    const windSpeed = wind && Number.isFinite(wind.speed)
      ? wind.speed
      : (wind && Number.isFinite(wind.speed_10m) ? wind.speed_10m : null);
    const windDirection = wind && Number.isFinite(wind.direction)
      ? wind.direction
      : (wind && Number.isFinite(wind.direction_10m) ? wind.direction_10m : null);

    const cloudCoverValue = Number.isFinite(current.cloud_cover) ? current.cloud_cover : null;
    const visibilityMeters = Number.isFinite(current.visibility) ? current.visibility : null;
    const weatherDescription = current.weather?.description || null;

    if (cloudCoverValue === null && temperature === null && windSpeed === null && !weatherDescription) {
      return null;
    }

    return {
      icao,
      name,
      cloudCover: cloudCoverValue !== null ? Math.round(cloudCoverValue) : null,
      temperature: temperature !== null ? Math.round(temperature) : null,
      wind: windSpeed !== null && windDirection !== null
        ? {
            speed: Math.round(windSpeed),
            direction: Math.round(windDirection)
          }
        : null,
      visibility: visibilityMeters !== null
        ? Math.round(visibilityMeters / 1609.34) // convert meters to miles
        : null,
      conditions: weatherDescription
    };
  };

  const openMeteoSnapshots = Array.isArray(airports)
    ? airports
        .map((airport) => {
          const icao = (airport?.icao || airport?.icaoCode || '').toUpperCase();
          const name = airport?.name || icao || 'Unknown Airport';
          return normalizeOpenMeteoSnapshot(icao, name);
        })
        .filter(Boolean)
    : [];

  return (
    <div className="bg-cockpit-panel rounded-lg border border-gray-600">
      {/* Header */}
      <div className="p-4 border-b border-gray-600">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <Brain className="h-5 w-5 text-cockpit-accent" />
            <h3 className="text-lg font-semibold text-white">AI Weather Briefing</h3>
          </div>
          
          <button
            onClick={onToggleRawData}
            className="flex items-center space-x-2 text-sm text-gray-400 hover:text-cockpit-accent transition-colors"
          >
            {showRawData ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
            <span>{showRawData ? 'Hide' : 'Show'} Raw Data</span>
          </button>
        </div>
      </div>

      {/* AI Summary Content */}
      <div className="p-4">
        {aiSummary ? (
          <div className="space-y-4">
            {/* Route Summary */}
            <div className="bg-cockpit-bg rounded-lg p-4">
              <div className="flex items-start space-x-2 mb-3">
                <Sparkles className="h-5 w-5 text-cockpit-accent mt-0.5 flex-shrink-0" />
                <div className="flex-1">
                  <h4 className="font-semibold text-white mb-2">Route Assessment</h4>
                  <p className="text-gray-300 leading-relaxed">
                    {aiSummary.routeSummary || 'AI summary not available'}
                  </p>
                </div>
              </div>

              {/* Confidence and Conditions */}
              <div className="flex justify-between items-center text-sm pt-3 border-t border-gray-700">
                <div className="flex items-center space-x-4">
                  <span className="text-gray-400">Overall:</span>
                  <span className={`font-medium ${
                    aiSummary.overallConditions === 'FAVORABLE' ? 'text-vfr-500' :
                    aiSummary.overallConditions === 'MARGINAL' ? 'text-mvfr-500' :
                    aiSummary.overallConditions === 'CHALLENGING' ? 'text-severity-high' :
                    'text-gray-400'
                  }`}>
                    {aiSummary.overallConditions || 'Unknown'}
                  </span>
                </div>
                
                <div className="flex items-center space-x-2">
                  <span className="text-gray-400">Confidence:</span>
                  <span className={`font-medium ${getConfidenceColor(aiSummary.confidence)}`}>
                    {aiSummary.confidence || 'Unknown'}
                  </span>
                </div>
              </div>
            </div>

            {/* Key Findings */}
            {aiSummary.keyFindings && aiSummary.keyFindings.length > 0 && (
              <div className="space-y-2">
                <h4 className="font-semibold text-white text-sm">Key Findings:</h4>
                <ul className="space-y-2">
                  {aiSummary.keyFindings.map((finding, index) => (
                    <li key={index} className="flex items-start space-x-2 text-sm">
                      <div className="w-1.5 h-1.5 bg-cockpit-accent rounded-full mt-2 flex-shrink-0"></div>
                      <span className="text-gray-300">{finding}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {openMeteoSnapshots.length > 0 && (
              <div className="space-y-3">
                <h4 className="font-semibold text-white text-sm">Open-Meteo Snapshot</h4>
                <div className="space-y-2">
                  {openMeteoSnapshots.slice(0, 4).map((snapshot) => (
                    <div
                      key={snapshot.icao}
                      className="bg-cockpit-bg/80 border border-gray-700 rounded-lg p-3 text-sm text-gray-300"
                    >
                      <div className="flex items-center justify-between mb-2">
                        <div>
                          <span className="font-semibold text-white">{snapshot.icao}</span>
                          <span className="text-xs text-gray-400 ml-2">{snapshot.name}</span>
                        </div>
                        {snapshot.conditions && (
                          <span className="text-xs text-gray-400 italic">{snapshot.conditions}</span>
                        )}
                      </div>

                      <div className="grid grid-cols-2 gap-3">
                        <div className="flex items-center space-x-2">
                          <Cloud className="w-3.5 h-3.5 text-gray-500" />
                          <span>
                            {snapshot.cloudCover !== null ? `${snapshot.cloudCover}% cover` : 'Clouds N/A'}
                          </span>
                        </div>
                        <div className="flex items-center space-x-2">
                          <Thermometer className="w-3.5 h-3.5 text-gray-500" />
                          <span>
                            {snapshot.temperature !== null ? `${snapshot.temperature}°C` : 'Temp N/A'}
                          </span>
                        </div>
                        <div className="flex items-center space-x-2">
                          <Wind className="w-3.5 h-3.5 text-gray-500" />
                          <span>
                            {snapshot.wind
                              ? `${snapshot.wind.direction.toString().padStart(3, '0')}° @ ${snapshot.wind.speed} kt`
                              : 'Wind N/A'}
                          </span>
                        </div>
                        <div className="flex items-center space-x-2">
                          <Eye className="w-3.5 h-3.5 text-gray-500" />
                          <span>
                            {snapshot.visibility !== null ? `${snapshot.visibility} mi vis` : 'Visibility N/A'}
                          </span>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        ) : (
          <div className="text-center py-6">
            <Brain className="h-12 w-12 text-gray-600 mx-auto mb-3" />
            <p className="text-gray-400">AI briefing not available</p>
            <p className="text-sm text-gray-500 mt-1">Using fallback weather data</p>
          </div>
        )}

        {/* Raw Data Section */}
        {showRawData && (
          <div className="mt-6 pt-4 border-t border-gray-600">
            <h4 className="font-semibold text-white mb-3 text-sm">Raw Weather Data</h4>
            <div className="bg-cockpit-bg rounded-lg p-4">
              <pre className="text-xs text-gray-300 font-mono whitespace-pre-wrap overflow-auto max-h-96">
                {formatRawData()}
              </pre>
            </div>
          </div>
        )}
      </div>

      {/* AI Status Indicator */}
      <div className="px-4 pb-4">
        <div className="flex items-center justify-between text-xs text-gray-500">
          <div className="flex items-center space-x-2">
            <div className={`w-2 h-2 rounded-full ${aiSummary ? 'bg-vfr-500' : 'bg-severity-high'}`}></div>
            <span>AI Status: {aiSummary ? 'Active' : 'Unavailable'}</span>
          </div>
          <span>Powered by Gemini AI</span>
        </div>
      </div>
    </div>
  );
};

export default AISummary;