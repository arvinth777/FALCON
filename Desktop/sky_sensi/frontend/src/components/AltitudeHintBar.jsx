import { useMemo } from 'react';
import { TrendingUp, TrendingDown, AlertTriangle, Wind, Cloud, Zap, Snowflake } from 'lucide-react';

const AltitudeHintBar = ({ 
  pireps = [], 
  sigmets = [], 
  winds = [], 
  className = "",
  maxAltitude = 40000,
  minAltitude = 0,
  recommendedAltitude = null,
  recommendationNote = null
}) => {
  // Process altitude data and create risk bands
  const altitudeBands = useMemo(() => {
    const bands = [];
    const bandHeight = 2000; // 2000 ft per band
    const numBands = Math.ceil((maxAltitude - minAltitude) / bandHeight);

    const toNumber = (value) => {
      if (value === undefined || value === null) {
        return null;
      }
      if (typeof value === 'number') {
        return Number.isFinite(value) ? value : null;
      }
      const parsed = Number(value);
      return Number.isFinite(parsed) ? parsed : null;
    };

    const normalizeAltitude = (value) => {
      const numeric = toNumber(value);
      if (numeric === null) {
        return null;
      }
      if (numeric < minAltitude || numeric > maxAltitude) {
        return null;
      }
      return numeric;
    };

    const resolveAltitudeRange = (bottomCandidate, topCandidate) => {
      const rawBottom = toNumber(bottomCandidate);
      const rawTop = toNumber(topCandidate);
      const resolvedBottom = rawBottom === null ? minAltitude : rawBottom;
      const resolvedTop = rawTop === null ? maxAltitude : rawTop;
      const clampedBottom = Math.max(resolvedBottom, minAltitude);
      const clampedTop = Math.min(resolvedTop, maxAltitude);
      if (clampedBottom > clampedTop) {
        return null;
      }
      return { bottom: clampedBottom, top: clampedTop };
    };

    for (let i = 0; i < numBands; i++) {
      const bottomAlt = minAltitude + (i * bandHeight);
      const topAlt = Math.min(bottomAlt + bandHeight, maxAltitude);
      
      // Collect hazards for this altitude band
      const hazards = {
        turbulence: [],
        icing: [],
        convective: [],
        winds: [],
        other: []
      };

      // Process PIREPs in this altitude band
      pireps.forEach(pirep => {
        const pirepAltRaw = typeof pirep.altitude === 'object'
          ? pirep.altitude.feet
          : (typeof pirep.altitude === 'number' ? pirep.altitude : (pirep.altitudeFt ?? null));
        const pirepAlt = normalizeAltitude(pirepAltRaw);

        if (pirepAlt !== null && pirepAlt >= bottomAlt && pirepAlt < topAlt) {
          const phenStr = Array.isArray(pirep.phenomenon) ? pirep.phenomenon.join(',') : (pirep.phenomenon || '');
          const phenomenon = phenStr.toUpperCase();
          const severity = (pirep.severity || pirep.intensity || 'UNKNOWN').toUpperCase();
          
          if (phenomenon.includes('TURB')) {
            hazards.turbulence.push({ severity, report: pirep });
          } else if (phenomenon.includes('ICE')) {
            hazards.icing.push({ severity, report: pirep });
          } else if (phenomenon.includes('CONVECTIVE') || phenomenon.includes('TS')) {
            hazards.convective.push({ severity, report: pirep });
          } else {
            hazards.other.push({ severity, report: pirep });
          }
        }
      });

      // Process SIGMETs affecting this altitude band
      sigmets.forEach(sigmet => {
        const altitudeRange = resolveAltitudeRange(
          sigmet.altitudeLow ?? sigmet.altitudeBottom ?? sigmet.base,
          sigmet.altitudeHigh ?? sigmet.altitudeTop ?? sigmet.top
        );

        if (!altitudeRange) {
          return;
        }

        if (altitudeRange.bottom <= topAlt && altitudeRange.top >= bottomAlt) {
          const phenomenon = (sigmet.phenomenon || '').toUpperCase();
          const intensity = sigmet.intensity || 'UNKNOWN';
          
          if (phenomenon.includes('TURB')) {
            hazards.turbulence.push({ severity: intensity, report: sigmet });
          } else if (phenomenon.includes('ICE')) {
            hazards.icing.push({ severity: intensity, report: sigmet });
          } else if (phenomenon.includes('TS') || phenomenon.includes('CONVECTIVE')) {
            hazards.convective.push({ severity: intensity, report: sigmet });
          } else {
            hazards.other.push({ severity: intensity, report: sigmet });
          }
        }
      });

      // Process winds aloft data
      winds.forEach(wind => {
        const windAltitude = normalizeAltitude(wind.altitude ?? wind.altitudeFt ?? wind.altitudeFeet);
        if (windAltitude !== null && windAltitude >= bottomAlt && windAltitude < topAlt) {
          hazards.winds.push({ 
            severity: wind.speed > 50 ? 'STRONG' : wind.speed > 30 ? 'MODERATE' : 'LIGHT',
            report: wind 
          });
        }
      });

      // Calculate overall risk level for this band
      let riskLevel = 'LOW';
      let riskScore = 0;
      
      // Score turbulence
      hazards.turbulence.forEach(h => {
        if (h.severity.includes('SEVERE') || h.severity.includes('EXTREME')) riskScore += 3;
        else if (h.severity.includes('MODERATE')) riskScore += 2;
        else riskScore += 1;
      });
      
      // Score icing
      hazards.icing.forEach(h => {
        if (h.severity.includes('SEVERE') || h.severity.includes('HEAVY')) riskScore += 3;
        else if (h.severity.includes('MODERATE')) riskScore += 2;
        else riskScore += 1;
      });
      
      // Score convective activity
      hazards.convective.forEach(h => {
        riskScore += 3; // Always high risk
      });
      
      // Score winds
      hazards.winds.forEach(h => {
        if (h.severity === 'STRONG') riskScore += 2;
        else if (h.severity === 'MODERATE') riskScore += 1;
      });

      // Determine risk level
      if (riskScore >= 4) riskLevel = 'HIGH';
      else if (riskScore >= 2) riskLevel = 'MODERATE';
      else if (riskScore > 0) riskLevel = 'LOW';
      else riskLevel = 'MINIMAL';

      bands.push({
        bottomAlt,
        topAlt,
        centerAlt: bottomAlt + bandHeight / 2,
        hazards,
        riskLevel,
        riskScore,
        totalReports: Object.values(hazards).reduce((sum, arr) => sum + arr.length, 0)
      });
    }

    return bands;
  }, [pireps, sigmets, winds, maxAltitude, minAltitude]);

  // Calculate recommended altitude marker position
  const recommendedAltitudeInfo = useMemo(() => {
    if (!recommendedAltitude || recommendedAltitude < minAltitude || recommendedAltitude > maxAltitude) {
      return null;
    }

    // Find the band that contains the recommended altitude
    const bandIndex = altitudeBands.findIndex(band => 
      recommendedAltitude >= band.bottomAlt && recommendedAltitude < band.topAlt
    );

    if (bandIndex === -1) return null;

    const band = altitudeBands[bandIndex];
    const relativePosition = (recommendedAltitude - band.bottomAlt) / (band.topAlt - band.bottomAlt);

    return {
      bandIndex,
      band,
      relativePosition,
      flightLevel: Math.round(recommendedAltitude / 100)
    };
  }, [recommendedAltitude, altitudeBands, minAltitude, maxAltitude]);

  // Get risk level color
  const getRiskColor = (riskLevel) => {
    switch (riskLevel) {
      case 'HIGH': return 'bg-red-500';
      case 'MODERATE': return 'bg-yellow-500';
      case 'LOW': return 'bg-blue-500';
      case 'MINIMAL': return 'bg-green-500';
      default: return 'bg-gray-300';
    }
  };

  // Get risk level text color
  const getRiskTextColor = (riskLevel) => {
    switch (riskLevel) {
      case 'HIGH': return 'text-red-700';
      case 'MODERATE': return 'text-yellow-700';
      case 'LOW': return 'text-blue-700';
      case 'MINIMAL': return 'text-green-700';
      default: return 'text-gray-700';
    }
  };

  // Format altitude for display
  const formatAltitude = (alt) => {
    if (alt >= 1000) {
      return `${Math.round(alt / 1000)}k`;
    }
    return alt.toString();
  };

  // Get hazard icon
  const getHazardIcon = (hazardType, count) => {
    if (count === 0) return null;
    
    const iconProps = { className: "w-3 h-3", strokeWidth: 2 };
    
    switch (hazardType) {
      case 'turbulence': return <Zap {...iconProps} className="w-3 h-3 text-yellow-600" />;
      case 'icing': return <Snowflake {...iconProps} className="w-3 h-3 text-blue-600" />;
      case 'convective': return <AlertTriangle {...iconProps} className="w-3 h-3 text-red-600" />;
      case 'winds': return <Wind {...iconProps} className="w-3 h-3 text-purple-600" />;
      default: return <Cloud {...iconProps} className="w-3 h-3 text-gray-600" />;
    }
  };

  if (altitudeBands.length === 0) {
    return (
      <div className={`bg-gray-50 rounded-lg border-2 border-dashed border-gray-300 p-4 text-center ${className}`}>
        <div className="text-gray-600">
          <TrendingUp className="mx-auto h-6 w-6 text-gray-400 mb-2" />
          <p className="text-sm font-medium text-gray-900">No Altitude Data</p>
          <p className="text-xs text-gray-500">Altitude risk information will appear here</p>
        </div>
      </div>
    );
  }

  return (
    <div className={`bg-white rounded-lg border border-gray-200 ${className}`}>
      <div className="p-4 border-b border-gray-200">
        <h3 className="text-lg font-semibold text-gray-900 flex items-center">
          <TrendingUp className="w-5 h-5 mr-2 text-blue-600" />
          Altitude Risk Assessment
        </h3>
        <p className="text-sm text-gray-600">Weather hazards by altitude band</p>
      </div>

      <div className="p-4">
        {/* Risk Legend */}
        <div className="mb-4 flex flex-wrap items-center space-x-4 text-xs">
          <span className="text-gray-700 font-medium">Risk Levels:</span>
          <div className="flex items-center space-x-1">
            <div className="w-3 h-3 bg-green-500 rounded"></div>
            <span>Minimal</span>
          </div>
          <div className="flex items-center space-x-1">
            <div className="w-3 h-3 bg-blue-500 rounded"></div>
            <span>Low</span>
          </div>
          <div className="flex items-center space-x-1">
            <div className="w-3 h-3 bg-yellow-500 rounded"></div>
            <span>Moderate</span>
          </div>
          <div className="flex items-center space-x-1">
            <div className="w-3 h-3 bg-red-500 rounded"></div>
            <span>High</span>
          </div>
        </div>

        {/* Altitude Bands */}
        <div className="space-y-2">
          {altitudeBands.map((band, index) => (
            <div
              key={index}
              className="flex items-center space-x-3 p-3 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors"
            >
              {/* Altitude Range */}
              <div className="flex-shrink-0 w-20 text-right">
                <div className="text-sm font-medium text-gray-900">
                  {formatAltitude(band.topAlt)}
                </div>
                <div className="text-xs text-gray-500">
                  {formatAltitude(band.bottomAlt)}
                </div>
              </div>

              {/* Risk Bar */}
              <div className="flex-grow">
                <div className="flex items-center space-x-2">
                  <div className="flex-grow bg-gray-200 rounded-full h-4 relative overflow-hidden">
                    <div
                      className={`h-full ${getRiskColor(band.riskLevel)} transition-all duration-300`}
                      style={{ width: `${Math.min(100, (band.riskScore / 6) * 100)}%` }}
                    ></div>
                    {band.totalReports > 0 && (
                      <div className="absolute inset-0 flex items-center justify-center">
                        <span className="text-xs font-medium text-white drop-shadow">
                          {band.totalReports}
                        </span>
                      </div>
                    )}
                    
                    {/* AI Recommendation Marker */}
                    {recommendedAltitudeInfo && recommendedAltitudeInfo.bandIndex === index && (
                      <div 
                        className="absolute top-0 w-0.5 bg-blue-600 h-full z-10"
                        style={{ left: `${recommendedAltitudeInfo.relativePosition * 100}%` }}
                        title={recommendationNote || `AI Recommended: FL${recommendedAltitudeInfo.flightLevel}`}
                        aria-label={`AI recommended altitude: ${recommendedAltitude} feet. ${recommendationNote || ''}`}
                      >
                        {/* Marker badge */}
                        <div className="absolute -top-1 -left-6 bg-blue-600 text-white text-xs font-bold px-1.5 py-0.5 rounded shadow-lg whitespace-nowrap">
                          AI: FL{recommendedAltitudeInfo.flightLevel}
                        </div>
                      </div>
                    )}
                  </div>
                  
                  <div className={`text-xs font-medium ${getRiskTextColor(band.riskLevel)} w-16`}>
                    {band.riskLevel}
                  </div>
                </div>
              </div>

              {/* Hazard Icons */}
              <div className="flex-shrink-0 flex items-center space-x-1">
                {getHazardIcon('turbulence', band.hazards.turbulence.length)}
                {getHazardIcon('icing', band.hazards.icing.length)}
                {getHazardIcon('convective', band.hazards.convective.length)}
                {getHazardIcon('winds', band.hazards.winds.length)}
              </div>

              {/* Details Button */}
              {band.totalReports > 0 && (
                <div className="flex-shrink-0">
                  <button
                    className="text-xs text-blue-600 hover:text-blue-800 font-medium"
                    title="View Details"
                  >
                    Details
                  </button>
                </div>
              )}
            </div>
          ))}
        </div>

        {/* Summary */}
        <div className="mt-4 p-3 bg-blue-50 rounded-lg">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
            <div>
              <span className="text-blue-700 font-medium">High Risk Bands:</span>
              <div className="text-blue-900 font-semibold">
                {altitudeBands.filter(band => band.riskLevel === 'HIGH').length}
              </div>
            </div>
            
            <div>
              <span className="text-blue-700 font-medium">Total Reports:</span>
              <div className="text-blue-900 font-semibold">
                {altitudeBands.reduce((sum, band) => sum + band.totalReports, 0)}
              </div>
            </div>
            
            <div>
              <span className="text-blue-700 font-medium">Safest Range:</span>
              <div className="text-blue-900 font-semibold">
                {(() => {
                  const safestBand = altitudeBands
                    .filter(band => band.riskLevel === 'MINIMAL' || band.riskLevel === 'LOW')
                    .sort((a, b) => a.riskScore - b.riskScore)[0];
                  
                  if (safestBand) {
                    return `${formatAltitude(safestBand.bottomAlt)}-${formatAltitude(safestBand.topAlt)}`;
                  }
                  return 'None';
                })()}
              </div>
            </div>
            
            <div>
              <span className="text-blue-700 font-medium">Avoid Above:</span>
              <div className="text-blue-900 font-semibold">
                {(() => {
                  const highRiskBands = altitudeBands.filter(band => band.riskLevel === 'HIGH');
                  if (highRiskBands.length > 0) {
                    const lowestHighRisk = Math.min(...highRiskBands.map(band => band.bottomAlt));
                    return formatAltitude(lowestHighRisk);
                  }
                  return 'N/A';
                })()}
              </div>
            </div>
          </div>
        </div>

        {/* Hazard Legend */}
        <div className="mt-4 pt-3 border-t border-gray-200">
          <div className="text-xs text-gray-600 mb-2 font-medium">Hazard Types:</div>
          <div className="flex flex-wrap items-center space-x-4 text-xs">
            <div className="flex items-center space-x-1">
              <Zap className="w-3 h-3 text-yellow-600" />
              <span>Turbulence</span>
            </div>
            <div className="flex items-center space-x-1">
              <Snowflake className="w-3 h-3 text-blue-600" />
              <span>Icing</span>
            </div>
            <div className="flex items-center space-x-1">
              <AlertTriangle className="w-3 h-3 text-red-600" />
              <span>Convective</span>
            </div>
            <div className="flex items-center space-x-1">
              <Wind className="w-3 h-3 text-purple-600" />
              <span>High Winds</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default AltitudeHintBar;