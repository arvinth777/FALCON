import React, { useState, useEffect } from 'react'
import { Search, MapPin, AlertCircle } from 'lucide-react'
import { validateIcaoCode, parseRoute } from '../utils/validation.js'
import SkeletonLoader from './SkeletonLoader'

const RouteInput = ({ onFetchBriefing, loading, currentRoute }) => {
  const [route, setRoute] = useState(currentRoute);
  const [validationErrors, setValidationErrors] = useState([]);
  const [isValid, setIsValid] = useState(false);

  // Sync local state when parent currentRoute changes
  useEffect(() => {
    setRoute(currentRoute || '');
  }, [currentRoute]);

  // Handle route input changes with real-time validation
  const handleRouteChange = (e) => {
    const value = e.target.value.toUpperCase();
    setRoute(value);
    
    // Real-time validation
    const errors = [];
    if (value.trim()) {
      const airports = parseRoute(value);
      
      if (airports.length === 0) {
        errors.push('Enter at least one airport code');
      } else {
        airports.forEach((airport, index) => {
          const validation = validateIcaoCode(airport);
          if (!validation.isValid) {
            errors.push(`${airport}: ${validation.error}`);
          }
        });
      }
    }
    
    setValidationErrors(errors);
    setIsValid(value.trim() !== '' && errors.length === 0);
  };

  // Handle form submission
  const handleSubmit = (e) => {
    e.preventDefault();
    if (isValid && !loading) {
      onFetchBriefing(route.trim());
    }
  };

  // Quick example routes
  const exampleRoutes = [
    { label: 'West Coast', route: 'KLAX, KSFO, KPDX' },
    { label: 'East Coast', route: 'KJFK, KDCA, KATL' },
    { label: 'Central', route: 'KORD, KDFW, KDEN' },
  ];

  return (
    <div className="bg-cockpit-panel rounded-lg p-6 border border-gray-600">
      <div className="mb-4">
        <h2 className="text-xl font-semibold text-white mb-2">Flight Route</h2>
        <p className="text-gray-400 text-sm">
          Enter ICAO airport codes separated by commas for your route
        </p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        {/* Route Input */}
        <div className="relative">
          <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
            <MapPin className="h-5 w-5 text-gray-400" />
          </div>
          
          <input
            type="text"
            value={route}
            onChange={handleRouteChange}
            placeholder="KLAX, KSFO, KPHX"
            className={`w-full pl-10 pr-4 py-3 bg-cockpit-bg border rounded-lg text-white placeholder-gray-500 focus:outline-none focus:ring-2 transition-colors ${
              validationErrors.length > 0 
                ? 'border-severity-high focus:ring-severity-high/50' 
                : 'border-gray-600 focus:ring-cockpit-accent/50 focus:border-cockpit-accent'
            }`}
            disabled={loading}
            autoComplete="off"
            spellCheck="false"
          />
        </div>

        {/* Validation Errors */}
        {validationErrors.length > 0 && (
          <div className="bg-severity-high/10 border border-severity-high/30 rounded-lg p-3">
            <div className="flex items-start space-x-2">
              <AlertCircle className="h-4 w-4 text-severity-high mt-0.5 flex-shrink-0" />
              <div className="text-sm">
                <div className="font-medium text-severity-high mb-1">Route Validation Errors:</div>
                <ul className="text-gray-300 space-y-1">
                  {validationErrors.map((error, index) => (
                    <li key={index}>• {error}</li>
                  ))}
                </ul>
              </div>
            </div>
          </div>
        )}

        {/* Example Routes */}
        <div className="flex flex-wrap gap-2">
          <span className="text-sm text-gray-400 self-center mr-2">Quick routes:</span>
          {exampleRoutes.map((example) => (
            <button
              key={example.label}
              type="button"
              onClick={() => {
                setRoute(example.route);
                handleRouteChange({ target: { value: example.route } });
              }}
              className="text-xs px-3 py-1 bg-gray-700 hover:bg-gray-600 text-gray-300 rounded-full transition-colors"
              disabled={loading}
            >
              {example.label}
            </button>
          ))}
        </div>

        {/* Submit Button */}
        <button
          type="submit"
          disabled={!isValid || loading}
          className={`w-full py-3 px-6 rounded-lg font-semibold flex items-center justify-center space-x-2 transition-colors ${
            isValid && !loading
              ? 'bg-cockpit-accent hover:bg-blue-600 text-white'
              : 'bg-gray-600 text-gray-400 cursor-not-allowed'
          }`}
        >
          {loading ? (
            <div className="flex items-center space-x-2">
              <SkeletonLoader type="default" width={20} height={20} />
              <span>Fetching Weather Briefing...</span>
            </div>
          ) : (
            <>
              <Search className="h-5 w-5" />
              <span>Get Weather Briefing</span>
            </>
          )}
        </button>
      </form>

      {/* Help Text */}
      <div className="mt-4 text-xs text-gray-500">
        <div className="grid grid-cols-2 gap-4">
          <div>
            <strong>Valid ICAO codes:</strong>
            <br />4-letter airport identifiers (KLAX, EGLL)
          </div>
          <div>
            <strong>Format:</strong>
            <br />Separate multiple airports with commas
          </div>
        </div>
      </div>
    </div>
  );
};

export default RouteInput;