import React from 'react';
import Skeleton, { SkeletonTheme } from 'react-loading-skeleton';
import 'react-loading-skeleton/dist/skeleton.css';

const SkeletonLoader = ({ 
  type = 'default', 
  count = 1, 
  height = undefined,
  width = undefined,
  className = "",
  enableAnimation = true 
}) => {
  const baseColor = '#f3f4f6';
  const highlightColor = '#e5e7eb';

  const renderSkeleton = () => {
    switch (type) {
      case 'weather-card':
        return (
          <div className={`bg-white rounded-lg border border-gray-200 p-4 ${className}`}>
            <div className="flex items-start justify-between mb-3">
              <Skeleton height={20} width={120} />
              <Skeleton height={24} width={60} />
            </div>
            <Skeleton height={16} width="80%" className="mb-2" />
            <Skeleton height={16} width="60%" className="mb-3" />
            <div className="flex items-center space-x-4">
              <Skeleton height={14} width={80} />
              <Skeleton height={14} width={100} />
            </div>
          </div>
        );

      case 'airport-item':
        return (
          <div className={`flex items-center space-x-3 p-3 bg-gray-50 rounded-lg ${className}`}>
            <Skeleton circle height={32} width={32} />
            <div className="flex-grow">
              <Skeleton height={16} width={100} className="mb-1" />
              <Skeleton height={14} width={160} />
            </div>
            <Skeleton height={20} width={50} />
          </div>
        );

      case 'chat-message':
        return (
          <div className={`flex items-start space-x-3 ${className}`}>
            <Skeleton circle height={32} width={32} />
            <div className="flex-grow">
              <Skeleton height={14} width={80} className="mb-2" />
              <Skeleton height={16} width="90%" className="mb-1" />
              <Skeleton height={16} width="75%" className="mb-1" />
              <Skeleton height={16} width="60%" />
            </div>
          </div>
        );

      case 'map-placeholder':
        return (
          <div className={`relative bg-gray-100 rounded-lg overflow-hidden ${className}`}>
            <Skeleton height="100%" width="100%" />
            <div className="absolute inset-0 flex items-center justify-center">
              <div className="text-gray-400 text-center">
                <svg className="mx-auto h-12 w-12 mb-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-1.447-.894L15 4m0 13V4m0 0L9 7" />
                </svg>
                <p className="text-sm">Loading Map...</p>
              </div>
            </div>
          </div>
        );

      case 'chart-placeholder':
        return (
          <div className={`bg-white rounded-lg border border-gray-200 ${className}`}>
            <div className="p-4 border-b border-gray-200">
              <Skeleton height={20} width={150} className="mb-1" />
              <Skeleton height={14} width={200} />
            </div>
            <div className="p-4">
              <div className="relative h-64 bg-gray-50 rounded-lg overflow-hidden">
                <Skeleton height="100%" width="100%" />
                <div className="absolute inset-0 flex items-center justify-center">
                  <div className="text-gray-400 text-center">
                    <svg className="mx-auto h-10 w-10 mb-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                    </svg>
                    <p className="text-sm">Loading Chart...</p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        );

      case 'alert-item':
        return (
          <div className={`flex items-start space-x-3 p-3 border-l-4 border-gray-300 bg-gray-50 rounded-r-lg ${className}`}>
            <Skeleton circle height={20} width={20} />
            <div className="flex-grow">
              <div className="flex items-center space-x-2 mb-1">
                <Skeleton height={16} width={80} />
                <Skeleton height={14} width={60} />
              </div>
              <Skeleton height={14} width="90%" className="mb-1" />
              <Skeleton height={14} width="70%" />
            </div>
          </div>
        );

      case 'forecast-item':
        return (
          <div className={`bg-white rounded-lg border border-gray-200 p-4 ${className}`}>
            <div className="flex items-center justify-between mb-3">
              <Skeleton height={18} width={100} />
              <Skeleton height={16} width={80} />
            </div>
            <div className="grid grid-cols-2 gap-4 mb-3">
              <div>
                <Skeleton height={14} width={60} className="mb-1" />
                <Skeleton height={16} width={80} />
              </div>
              <div>
                <Skeleton height={14} width={70} className="mb-1" />
                <Skeleton height={16} width={90} />
              </div>
            </div>
            <Skeleton height={14} width="100%" />
          </div>
        );

      case 'altitude-band':
        return (
          <div className={`flex items-center space-x-3 p-3 bg-gray-50 rounded-lg ${className}`}>
            <div className="flex-shrink-0">
              <Skeleton height={14} width={40} className="mb-1" />
              <Skeleton height={12} width={40} />
            </div>
            <div className="flex-grow">
              <Skeleton height={16} width="100%" />
            </div>
            <div className="flex-shrink-0 flex space-x-1">
              <Skeleton circle height={12} width={12} />
              <Skeleton circle height={12} width={12} />
              <Skeleton circle height={12} width={12} />
            </div>
          </div>
        );

      case 'route-input':
        return (
          <div className={`bg-white rounded-lg border border-gray-200 p-4 ${className}`}>
            <Skeleton height={20} width={120} className="mb-3" />
            <div className="flex items-center space-x-2 mb-3">
              <Skeleton height={40} width="100%" />
              <Skeleton height={40} width={100} />
            </div>
            <div className="flex flex-wrap gap-2">
              <Skeleton height={32} width={80} />
              <Skeleton height={32} width={90} />
              <Skeleton height={32} width={85} />
            </div>
          </div>
        );

      case 'ai-summary':
        return (
          <div className={`bg-white rounded-lg border border-gray-200 ${className}`}>
            <div className="p-4 border-b border-gray-200">
              <div className="flex items-center justify-between">
                <Skeleton height={20} width={150} />
                <Skeleton height={32} width={100} />
              </div>
            </div>
            <div className="p-4">
              <Skeleton height={16} width="95%" className="mb-2" />
              <Skeleton height={16} width="88%" className="mb-2" />
              <Skeleton height={16} width="92%" className="mb-3" />
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Skeleton height={14} width={80} className="mb-2" />
                  <Skeleton height={12} width="100%" className="mb-1" />
                  <Skeleton height={12} width="80%" />
                </div>
                <div>
                  <Skeleton height={14} width={90} className="mb-2" />
                  <Skeleton height={12} width="100%" className="mb-1" />
                  <Skeleton height={12} width="70%" />
                </div>
              </div>
            </div>
          </div>
        );

      case 'table-row':
        return (
          <tr className={className}>
            <td className="px-4 py-3"><Skeleton height={14} width={80} /></td>
            <td className="px-4 py-3"><Skeleton height={14} width={60} /></td>
            <td className="px-4 py-3"><Skeleton height={14} width={100} /></td>
            <td className="px-4 py-3"><Skeleton height={14} width={40} /></td>
          </tr>
        );

      case 'button':
        return (
          <Skeleton 
            height={height || 40} 
            width={width || 120} 
            className={`rounded ${className}`}
          />
        );

      case 'avatar':
        return (
          <Skeleton 
            circle 
            height={height || 40} 
            width={width || 40} 
            className={className}
          />
        );

      case 'text':
        return (
          <Skeleton 
            height={height || 14} 
            width={width || "100%"} 
            className={className}
          />
        );

      case 'paragraph':
        return (
          <div className={className}>
            <Skeleton height={16} width="95%" className="mb-2" />
            <Skeleton height={16} width="88%" className="mb-2" />
            <Skeleton height={16} width="92%" />
          </div>
        );

      case 'grid':
        return (
          <div className={`grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 ${className}`}>
            {Array.from({ length: count || 6 }, (_, i) => (
              <div key={i} className="bg-white rounded-lg border border-gray-200 p-4">
                <Skeleton height={16} width="70%" className="mb-2" />
                <Skeleton height={14} width="100%" className="mb-1" />
                <Skeleton height={14} width="80%" />
              </div>
            ))}
          </div>
        );

      default:
        return (
          <Skeleton 
            count={count} 
            height={height} 
            width={width} 
            className={className}
          />
        );
    }
  };

  return (
    <SkeletonTheme 
      baseColor={baseColor} 
      highlightColor={highlightColor}
      enableAnimation={enableAnimation}
    >
      {renderSkeleton()}
    </SkeletonTheme>
  );
};

// Pre-built skeleton components for common use cases
export const WeatherCardSkeleton = ({ className = "" }) => (
  <SkeletonLoader type="weather-card" className={className} />
);

export const AirportItemSkeleton = ({ className = "" }) => (
  <SkeletonLoader type="airport-item" className={className} />
);

export const ChatMessageSkeleton = ({ className = "" }) => (
  <SkeletonLoader type="chat-message" className={className} />
);

export const MapSkeleton = ({ className = "", height = "400px" }) => (
  <SkeletonLoader type="map-placeholder" className={`${className}`} style={{ height }} />
);

export const ChartSkeleton = ({ className = "" }) => (
  <SkeletonLoader type="chart-placeholder" className={className} />
);

export const AlertSkeleton = ({ className = "" }) => (
  <SkeletonLoader type="alert-item" className={className} />
);

export const ForecastSkeleton = ({ className = "" }) => (
  <SkeletonLoader type="forecast-item" className={className} />
);

export const AltitudeBandSkeleton = ({ className = "" }) => (
  <SkeletonLoader type="altitude-band" className={className} />
);

export const RouteInputSkeleton = ({ className = "" }) => (
  <SkeletonLoader type="route-input" className={className} />
);

export const AISummarySkeleton = ({ className = "" }) => (
  <SkeletonLoader type="ai-summary" className={className} />
);

export const TableRowSkeleton = ({ className = "" }) => (
  <SkeletonLoader type="table-row" className={className} />
);

export const GridSkeleton = ({ count = 6, className = "" }) => (
  <SkeletonLoader type="grid" count={count} className={className} />
);

export default SkeletonLoader;