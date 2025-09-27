import { useState } from 'react'
import { AlertTriangle, Zap, CloudSnow, Wind, Eye, ChevronDown, ChevronUp, Plane } from 'lucide-react'
import { formatSeverity } from '../utils/formatters.js'

const AlertsDisplay = ({ briefingData, filterByType, compact = false }) => {
  const [expandedAlert, setExpandedAlert] = useState(null);

  if (!briefingData) {
    return (
      <div className="bg-cockpit-panel rounded-lg border border-gray-600">
        <div className="p-4 border-b border-gray-600">
          <div className="flex items-center space-x-2">
            <AlertTriangle className="h-5 w-5 text-severity-medium" />
            <h3 className="text-lg font-semibold text-white">Weather Alerts</h3>
          </div>
        </div>
        <div className="p-4">
          <div className="text-center py-6">
            <AlertTriangle className="h-12 w-12 text-gray-600 mx-auto mb-3" />
            <p className="text-gray-400">Enter a route to view weather alerts</p>
            <p className="text-sm text-gray-500 mt-1">Weather analysis will appear here</p>
          </div>
        </div>
      </div>
    );
  }

  // Extract alerts from the correct location in the response
  const aiSummary = briefingData.aiSummary || {};
  const alerts = aiSummary.alerts || [];
  const altitudeRecommendation = aiSummary.altitudeRecommendation;

  const filteredAlerts = (() => {
    if (!Array.isArray(filterByType) || filterByType.length === 0) {
      return alerts;
    }
    const allowedTypes = filterByType.map(type => type?.toUpperCase()).filter(Boolean);
    if (allowedTypes.length === 0) {
      return alerts;
    }
    return alerts.filter(alert => allowedTypes.includes((alert.type || '').toUpperCase()));
  })();

  // Get alert type icon
  const getAlertIcon = (type) => {
    switch (type?.toUpperCase()) {
      case 'TURBULENCE': return Wind;
      case 'ICING': return CloudSnow;
      case 'CONVECTIVE': return Zap;
      case 'IFR': return Eye;
      default: return AlertTriangle;
    }
  };

  // Toggle alert expansion
  const toggleAlert = (index) => {
    setExpandedAlert(expandedAlert === index ? null : index);
  };

  return (
    <div className="bg-cockpit-panel rounded-lg border border-gray-600">
      {/* Header */}
      <div className="p-4 border-b border-gray-600">
        <div className="flex items-center space-x-2">
          <AlertTriangle className="h-5 w-5 text-severity-medium" />
          <h3 className="text-lg font-semibold text-white">Weather Alerts</h3>
          {filteredAlerts.length > 0 && (
            <span className="bg-severity-medium/20 text-severity-medium px-2 py-1 rounded-full text-xs font-medium">
              {filteredAlerts.length} Alert{filteredAlerts.length !== 1 ? 's' : ''}
            </span>
          )}
        </div>
      </div>

      <div className="p-4 space-y-4">
        {/* Altitude Recommendation */}
        <div className="bg-cockpit-accent/10 border border-cockpit-accent/30 rounded-lg p-4">
          <div className="flex items-center space-x-2 mb-3">
            <Plane className="h-5 w-5 text-cockpit-accent" />
            <h4 className="font-semibold text-white">Recommended Altitude</h4>
          </div>

          {altitudeRecommendation ? (
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-gray-300">Primary:</span>
                <span className="font-semibold text-cockpit-accent">
                  {altitudeRecommendation.recommendedAltitude?.toLocaleString() ||
                   altitudeRecommendation.recommended} ft
                </span>
              </div>

              {(altitudeRecommendation.alternativeAltitudes || altitudeRecommendation.alternatives) && (
                <div className="flex items-center justify-between">
                  <span className="text-gray-300">Alternatives:</span>
                  <span className="text-gray-300">
                    {(altitudeRecommendation.alternativeAltitudes || altitudeRecommendation.alternatives || []).map(alt =>
                      typeof alt === 'string' ? alt : alt.toLocaleString()
                    ).join(', ')} ft
                  </span>
                </div>
              )}

              {altitudeRecommendation.confidence && (
                <div className="flex items-center justify-between">
                  <span className="text-gray-300">Confidence:</span>
                  <span className={`font-medium ${
                    altitudeRecommendation.confidence === 'HIGH' ? 'text-vfr-500' :
                    altitudeRecommendation.confidence === 'MEDIUM' ? 'text-mvfr-500' :
                    'text-severity-high'
                  }`}>
                    {altitudeRecommendation.confidence}
                  </span>
                </div>
              )}

              {altitudeRecommendation.rationale && (
                <div className="mt-3 pt-3 border-t border-cockpit-accent/20">
                  <p className="text-sm text-gray-300">
                    {altitudeRecommendation.rationale}
                  </p>
                </div>
              )}
            </div>
          ) : (
            <div className="text-center py-4">
              <p className="text-gray-400">Enter a route to get altitude recommendations</p>
              <p className="text-sm text-gray-500 mt-1">AI analysis will suggest optimal flight levels</p>
            </div>
          )}
        </div>

        {/* Weather Alerts */}
        {filteredAlerts.length > 0 ? (
          <div className="space-y-3">
            {filteredAlerts.slice(0, 3).map((alert, index) => {
              const severity = formatSeverity(alert.severity);
              const AlertIcon = getAlertIcon(alert.type);
              const isExpanded = expandedAlert === index;

              return (
                <div key={index} className={`${severity.bg} ${severity.border} border rounded-lg`}>
                  <div 
                    className="p-3 cursor-pointer hover:bg-white/5 transition-colors"
                    onClick={() => toggleAlert(index)}
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex items-start space-x-3 flex-1">
                        <AlertIcon className={`h-5 w-5 ${severity.color} mt-0.5 flex-shrink-0`} />
                        <div className="flex-1">
                          <div className="flex items-center space-x-2 mb-1">
                            <span className={`font-semibold ${severity.color}`}>
                              {alert.severity}
                            </span>
                            {alert.type && (
                              <>
                                <span className="text-gray-500">•</span>
                                <span className="text-gray-300 text-sm">
                                  {alert.type}
                                </span>
                              </>
                            )}
                          </div>
                          <p className="text-gray-300 text-sm">
                            {alert.message}
                          </p>
                          
                          {alert.affectedArea && (
                            <p className="text-gray-400 text-xs mt-1">
                              Area: {alert.affectedArea}
                            </p>
                          )}
                        </div>
                      </div>
                      
                      <div className="ml-2">
                        {isExpanded ? (
                          <ChevronUp className="h-4 w-4 text-gray-400" />
                        ) : (
                          <ChevronDown className="h-4 w-4 text-gray-400" />
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Expanded Details */}
                  {isExpanded && (
                    <div className="px-3 pb-3 border-t border-gray-600/50">
                      <div className="pt-3 space-y-2 text-sm">
                        {alert.rationale && (
                          <div>
                            <span className="font-medium text-gray-300">Rationale:</span>
                            <p className="text-gray-400 mt-1">{alert.rationale}</p>
                          </div>
                        )}
                        
                        {alert.altitudeRange && (
                          <div>
                            <span className="font-medium text-gray-300">Altitude Range:</span>
                            <span className="text-gray-400 ml-2">{alert.altitudeRange}</span>
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        ) : (
          <div className="text-center py-6">
            <AlertTriangle className="h-12 w-12 text-gray-600 mx-auto mb-3" />
            <p className="text-gray-400">No weather alerts for this route</p>
            <p className="text-sm text-gray-500 mt-1">
              {briefingData?.aiSummary?.overallConditions === 'MARGINAL' ?
                'Marginal conditions noted - check detailed forecast' :
                'Conditions appear favorable'
              }
            </p>
            {briefingData?.hazards?.sigmets?.total > 0 && (
              <p className="text-sm text-severity-medium mt-2">
                ⚠️ {briefingData.hazards.sigmets.total} SIGMET(s) active along route
              </p>
            )}
          </div>
        )}

        {/* Alert Summary */}
        {filteredAlerts.length > 0 && (
          <div className="pt-3 border-t border-gray-600">
            <div className="flex justify-between items-center text-xs text-gray-500">
              <div className="flex space-x-4">
                {['HIGH', 'MEDIUM', 'LOW'].map(level => {
                  const count = filteredAlerts.filter(a => a.severity === level).length;
                  if (count === 0) return null;
                  return (
                    <span key={level} className="flex items-center space-x-1">
                      <div className={`w-2 h-2 rounded-full ${
                        level === 'HIGH' ? 'bg-severity-high' :
                        level === 'MEDIUM' ? 'bg-severity-medium' :
                        'bg-severity-low'
                      }`}></div>
                      <span>{count} {level.toLowerCase()}</span>
                    </span>
                  );
                })}
              </div>
              <span>Click alerts for details</span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default AlertsDisplay;