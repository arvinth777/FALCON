import React from 'react';
import { formatDistanceToNow, parseISO, isValid } from 'date-fns';

/**
 * Data Quality Indicator showing confidence levels and data staleness
 */
const DataQualityIndicator = ({
  briefingData,
  showDetails = false,
  className = ''
}) => {
  if (!briefingData) {
    return null;
  }

  // Calculate data staleness for different sources
  const calculateStaleness = (timestamp) => {
    if (!timestamp) return { isStale: true, age: 'Unknown', severity: 'error' };

    try {
      const date = typeof timestamp === 'string' ? parseISO(timestamp) : new Date(timestamp);
      if (!isValid(date)) {
        return { isStale: true, age: 'Invalid timestamp', severity: 'error' };
      }

      const now = new Date();
      const ageMinutes = (now - date) / (1000 * 60);

      let severity = 'good';
      let isStale = false;

      // Determine staleness based on data type
      if (ageMinutes > 60) { // More than 1 hour
        severity = 'warning';
        isStale = true;
      }
      if (ageMinutes > 180) { // More than 3 hours
        severity = 'error';
        isStale = true;
      }

      return {
        isStale,
        age: formatDistanceToNow(date, { addSuffix: true }),
        ageMinutes: Math.round(ageMinutes),
        severity
      };
    } catch (error) {
      return { isStale: true, age: 'Parse error', severity: 'error' };
    }
  };

  // Analyze briefing data quality
  const analyzeDataQuality = () => {
    const analysis = {
      overall: 'good',
      confidence: 'high',
      issues: [],
      dataSources: {},
      coverage: {
        airports: briefingData.airports?.length || 0,
        withMetar: briefingData.airports?.filter(a => a.hasMetar)?.length || 0,
        withTaf: briefingData.airports?.filter(a => a.hasTaf)?.length || 0
      }
    };

    // Check service degradations
    if (briefingData.serviceDegradations) {
      const { hasCriticalFailures, critical, count, message } = briefingData.serviceDegradations;

      if (hasCriticalFailures) {
        analysis.overall = 'critical';
        analysis.confidence = 'low';
        analysis.issues.push({
          type: 'critical_service_failure',
          message: `${critical} critical services unavailable`,
          severity: 'error'
        });
      } else if (count > 0) {
        analysis.overall = 'degraded';
        analysis.confidence = 'medium';
        analysis.issues.push({
          type: 'service_degradation',
          message: `${count} services degraded`,
          severity: 'warning'
        });
      }
    }

    // Check data coverage
    const coveragePercent = analysis.coverage.airports > 0
      ? Math.round((analysis.coverage.withMetar / analysis.coverage.airports) * 100)
      : 0;

    if (coveragePercent < 50) {
      analysis.overall = analysis.overall === 'good' ? 'degraded' : analysis.overall;
      analysis.confidence = 'low';
      analysis.issues.push({
        type: 'poor_coverage',
        message: `Only ${coveragePercent}% of airports have current weather data`,
        severity: 'warning'
      });
    }

    // Check AI availability
    if (briefingData.aiSummary?.error) {
      analysis.issues.push({
        type: 'ai_unavailable',
        message: 'AI analysis unavailable',
        severity: 'info'
      });
    }

    // Analyze data staleness for key sources
    if (briefingData.airports) {
      briefingData.airports.forEach((airport, index) => {
        // Check METAR staleness
        const metarData = briefingData.metarsByIcao?.[airport.icao];
        if (metarData?.observationTime) {
          const staleness = calculateStaleness(metarData.observationTime);
          analysis.dataSources[`metar_${airport.icao}`] = {
            type: 'METAR',
            airport: airport.icao,
            ...staleness
          };

          if (staleness.isStale && staleness.severity === 'error') {
            analysis.overall = analysis.overall === 'good' ? 'degraded' : analysis.overall;
            analysis.issues.push({
              type: 'stale_data',
              message: `${airport.icao} METAR data is ${staleness.age}`,
              severity: 'warning'
            });
          }
        }

        // Check TAF staleness
        const tafData = briefingData.tafsByIcao?.[airport.icao];
        if (tafData?.issueTime) {
          const staleness = calculateStaleness(tafData.issueTime);
          analysis.dataSources[`taf_${airport.icao}`] = {
            type: 'TAF',
            airport: airport.icao,
            ...staleness
          };
        }
      });
    }

    return analysis;
  };

  const dataQuality = analyzeDataQuality();

  // Get quality color and icon
  const getQualityDisplay = (quality) => {
    switch (quality) {
      case 'good':
        return {
          color: 'text-green-700 bg-green-50 border-green-200',
          icon: (
            <svg className="w-5 h-5 text-green-500" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
            </svg>
          ),
          label: 'Good',
          description: 'All essential data available and current'
        };
      case 'degraded':
        return {
          color: 'text-yellow-700 bg-yellow-50 border-yellow-200',
          icon: (
            <svg className="w-5 h-5 text-yellow-500" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
            </svg>
          ),
          label: 'Partial',
          description: 'Some data sources unavailable or stale'
        };
      case 'critical':
        return {
          color: 'text-red-700 bg-red-50 border-red-200',
          icon: (
            <svg className="w-5 h-5 text-red-500" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
            </svg>
          ),
          label: 'Limited',
          description: 'Critical data sources unavailable'
        };
      default:
        return {
          color: 'text-gray-700 bg-gray-50 border-gray-200',
          icon: (
            <svg className="w-5 h-5 text-gray-500" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
            </svg>
          ),
          label: 'Unknown',
          description: 'Data quality cannot be determined'
        };
    }
  };

  const qualityDisplay = getQualityDisplay(dataQuality.overall);

  if (!showDetails) {
    // Compact indicator
    return (
      <div className={`inline-flex items-center space-x-2 px-3 py-1 rounded-full border text-sm ${qualityDisplay.color} ${className}`}>
        {qualityDisplay.icon}
        <span className="font-medium">Data Quality: {qualityDisplay.label}</span>
      </div>
    );
  }

  // Detailed view
  return (
    <div className={`rounded-lg border p-4 ${qualityDisplay.color} ${className}`}>
      {/* Header */}
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center space-x-2">
          {qualityDisplay.icon}
          <h3 className="text-lg font-medium">
            Data Quality: {qualityDisplay.label}
          </h3>
        </div>
        <div className="text-sm">
          Confidence: {dataQuality.confidence.charAt(0).toUpperCase() + dataQuality.confidence.slice(1)}
        </div>
      </div>

      {/* Description */}
      <p className="text-sm mb-4">{qualityDisplay.description}</p>

      {/* Coverage statistics */}
      <div className="grid grid-cols-3 gap-4 mb-4 text-sm">
        <div>
          <div className="font-medium">Airports</div>
          <div>{dataQuality.coverage.airports}</div>
        </div>
        <div>
          <div className="font-medium">With METAR</div>
          <div>{dataQuality.coverage.withMetar} ({dataQuality.coverage.airports > 0 ? Math.round((dataQuality.coverage.withMetar / dataQuality.coverage.airports) * 100) : 0}%)</div>
        </div>
        <div>
          <div className="font-medium">With TAF</div>
          <div>{dataQuality.coverage.withTaf} ({dataQuality.coverage.airports > 0 ? Math.round((dataQuality.coverage.withTaf / dataQuality.coverage.airports) * 100) : 0}%)</div>
        </div>
      </div>

      {/* Issues */}
      {dataQuality.issues.length > 0 && (
        <div className="mb-4">
          <h4 className="text-sm font-medium mb-2">Issues Detected:</h4>
          <ul className="text-sm space-y-1">
            {dataQuality.issues.map((issue, index) => (
              <li key={index} className="flex items-start space-x-2">
                <span className="text-xs">•</span>
                <span>{issue.message}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Data staleness details */}
      {Object.keys(dataQuality.dataSources).length > 0 && (
        <details className="text-sm">
          <summary className="cursor-pointer font-medium mb-2">
            Data Source Details
          </summary>
          <div className="space-y-2 pl-4">
            {Object.entries(dataQuality.dataSources).map(([key, source]) => (
              <div key={key} className="flex justify-between items-center">
                <span>{source.type} ({source.airport})</span>
                <span className={`text-xs px-2 py-1 rounded ${
                  source.severity === 'good' ? 'bg-green-100 text-green-800' :
                  source.severity === 'warning' ? 'bg-yellow-100 text-yellow-800' :
                  'bg-red-100 text-red-800'
                }`}>
                  {source.age}
                </span>
              </div>
            ))}
          </div>
        </details>
      )}

      {/* Generated timestamp */}
      {briefingData.generatedAt && (
        <div className="text-xs mt-4 pt-3 border-t border-current border-opacity-20">
          Briefing generated {calculateStaleness(briefingData.generatedAt).age}
        </div>
      )}
    </div>
  );
};

export default DataQualityIndicator;