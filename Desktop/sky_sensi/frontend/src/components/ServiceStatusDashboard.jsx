import React, { useState, useEffect } from 'react';
import { checkHealth } from '../services/api';

/**
 * Real-time service status dashboard showing data source availability
 */
const ServiceStatusDashboard = ({ briefingData = null, className = '' }) => {
  const [serviceStatus, setServiceStatus] = useState({
    loading: true,
    services: {},
    lastCheck: null,
    error: null
  });
  const [isExpanded, setIsExpanded] = useState(false);

  // Check service status on mount and periodically
  useEffect(() => {
    let interval;

    const checkServices = async () => {
      try {
        const response = await fetch('/api/health/datasources');
        const data = await response.json();

        setServiceStatus({
          loading: false,
          services: data.sources || {},
          dataQuality: data.data_quality || {},
          lastCheck: new Date().toISOString(),
          error: null
        });
      } catch (error) {
        console.error('Service status check failed:', error);
        setServiceStatus(prev => ({
          ...prev,
          loading: false,
          error: error.message
        }));
      }
    };

    // Initial check
    checkServices();

    // Check every 30 seconds
    interval = setInterval(checkServices, 30000);

    return () => clearInterval(interval);
  }, []);

  // Extract service degradations from briefing data
  const serviceDegradations = briefingData?.serviceDegradations || null;

  // Determine overall status
  const getOverallStatus = () => {
    if (serviceStatus.loading) return 'loading';
    if (serviceStatus.error) return 'error';
    if (serviceDegradations?.hasCriticalFailures) return 'critical';

    const services = Object.values(serviceStatus.services);
    const criticalServices = services.filter(s => s.critical);
    const criticalAvailable = criticalServices.filter(s => s.available);

    if (criticalAvailable.length < criticalServices.length) return 'degraded';
    return 'healthy';
  };

  const overallStatus = getOverallStatus();

  // Status icon component
  const StatusIcon = ({ status }) => {
    const iconClass = "w-4 h-4";

    switch (status) {
      case 'healthy':
        return (
          <svg className={`${iconClass} text-green-500`} fill="currentColor" viewBox="0 0 20 20">
            <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
          </svg>
        );
      case 'degraded':
        return (
          <svg className={`${iconClass} text-yellow-500`} fill="currentColor" viewBox="0 0 20 20">
            <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
          </svg>
        );
      case 'critical':
      case 'error':
        return (
          <svg className={`${iconClass} text-red-500`} fill="currentColor" viewBox="0 0 20 20">
            <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
          </svg>
        );
      case 'loading':
        return (
          <svg className={`${iconClass} text-gray-500 animate-spin`} fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
          </svg>
        );
      default:
        return (
          <svg className={`${iconClass} text-gray-400`} fill="currentColor" viewBox="0 0 20 20">
            <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
          </svg>
        );
    }
  };

  // Get status color class
  const getStatusColor = (status) => {
    switch (status) {
      case 'healthy': return 'text-green-700 bg-green-50 border-green-200';
      case 'degraded': return 'text-yellow-700 bg-yellow-50 border-yellow-200';
      case 'critical':
      case 'error': return 'text-red-700 bg-red-50 border-red-200';
      default: return 'text-gray-700 bg-gray-50 border-gray-200';
    }
  };

  // Get status message
  const getStatusMessage = () => {
    if (serviceStatus.loading) return 'Checking services...';
    if (serviceStatus.error) return 'Unable to check service status';
    if (serviceDegradations?.hasCriticalFailures) return serviceDegradations.message;

    const dataQuality = serviceStatus.dataQuality;
    if (dataQuality?.overall === 'complete') return 'All essential services operational';
    if (dataQuality?.overall === 'partial') return 'Some services degraded - limited functionality';

    return 'Service status unknown';
  };

  return (
    <div className={`bg-white rounded-lg border ${getStatusColor(overallStatus)} ${className}`}>
      {/* Compact status bar */}
      <div
        className="px-4 py-3 cursor-pointer flex items-center justify-between"
        onClick={() => setIsExpanded(!isExpanded)}
      >
        <div className="flex items-center space-x-3">
          <StatusIcon status={overallStatus} />
          <div>
            <div className="text-sm font-medium">
              Data Sources
            </div>
            <div className="text-xs">
              {getStatusMessage()}
            </div>
          </div>
        </div>

        {/* Expand/collapse icon */}
        <svg
          className={`w-5 h-5 transition-transform duration-200 ${isExpanded ? 'transform rotate-180' : ''}`}
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </div>

      {/* Detailed status (expanded) */}
      {isExpanded && (
        <div className="border-t px-4 py-3">
          {/* Service degradations from briefing */}
          {serviceDegradations && serviceDegradations.count > 0 && (
            <div className="mb-4">
              <h4 className="text-sm font-medium text-red-900 mb-2">
                Service Issues Detected
              </h4>
              <div className="space-y-2">
                {serviceDegradations.services.map((degradation, index) => (
                  <div key={index} className={`p-2 rounded text-xs ${degradation.isCritical ? 'bg-red-100 text-red-800' : 'bg-yellow-100 text-yellow-800'}`}>
                    <div className="font-medium">{degradation.service}</div>
                    <div>{degradation.error}</div>
                    <div className="text-xs opacity-75">
                      {new Date(degradation.timestamp).toLocaleTimeString()}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Live service status */}
          {!serviceStatus.loading && !serviceStatus.error && (
            <div>
              <h4 className="text-sm font-medium mb-2">Data Source Status</h4>
              <div className="grid grid-cols-2 gap-2 text-xs">
                {Object.entries(serviceStatus.services).map(([source, status]) => (
                  <div key={source} className="flex items-center justify-between p-2 bg-gray-50 rounded">
                    <div className="flex items-center space-x-2">
                      <StatusIcon status={status.available ? 'healthy' : 'error'} />
                      <span className={`font-medium ${status.critical ? 'text-red-900' : 'text-gray-700'}`}>
                        {source.toUpperCase()}
                      </span>
                      {status.critical && (
                        <span className="text-xs text-red-600">(Critical)</span>
                      )}
                    </div>
                    <div className="text-xs text-gray-500">
                      {status.responseTime > 0 ? `${status.responseTime}ms` : 'N/A'}
                    </div>
                  </div>
                ))}
              </div>

              {serviceStatus.lastCheck && (
                <div className="text-xs text-gray-500 mt-2">
                  Last checked: {new Date(serviceStatus.lastCheck).toLocaleTimeString()}
                </div>
              )}
            </div>
          )}

          {serviceStatus.error && (
            <div className="text-xs text-red-600">
              Error: {serviceStatus.error}
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default ServiceStatusDashboard;