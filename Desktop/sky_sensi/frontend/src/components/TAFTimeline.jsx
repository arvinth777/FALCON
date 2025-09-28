import { useMemo, useState } from 'react';

const CATEGORY_COLORS = {
  VFR: '#16a34a',
  MVFR: '#2563eb',
  IFR: '#ef4444',
  LIFR: '#a21caf',
  UNKNOWN: '#64748b'
};

const formatTime = (timestamp) => {
  if (!timestamp) return '';
  const date = new Date(timestamp);
  return date.toLocaleString('en-US', {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    timeZone: 'UTC',
    timeZoneName: 'short'
  });
};

const formatWind = (wind) => {
  if (!wind || (wind.dir == null && wind.spd == null && wind.gst == null)) {
    return 'Wind: N/A';
  }

  const dir = wind.dir == null ? 'VRB' : `${wind.dir}°`;
  if (wind.spd == null) return `Wind: ${dir}`;
  if (wind.gst == null) return `Wind: ${dir} / ${wind.spd} kt`;
  return `Wind: ${dir} / ${wind.spd}G${wind.gst} kt`;
};

const normalizeData = (tafData) => {
  if (!Array.isArray(tafData)) return [];

  return tafData
    .filter(item => Array.isArray(item?.flightTimeline) && item.flightTimeline.length > 0)
    .map(airport => ({
      icao: airport.icao || airport.icaoCode || 'UNKNOWN',
      name: airport.name || airport.icao || airport.icaoCode || 'UNKNOWN',
      timeline: airport.flightTimeline
        .map(block => {
          const startMs = new Date(block.start || block.startTime).getTime();
          const endMs = new Date(block.end || block.endTime).getTime();

          if (!Number.isFinite(startMs) || !Number.isFinite(endMs) || endMs <= startMs) {
            return null;
          }

          return {
            ...block,
            startMs,
            endMs,
            category: (block.category || 'UNKNOWN').toUpperCase(),
            duration: endMs - startMs
          };
        })
        .filter(Boolean)
    }))
    .filter(airport => airport.timeline.length > 0);
};

const TAFTimeline = ({ tafData = [], className = '', height = 320 }) => {
  const [hovered, setHovered] = useState(null);

  const airports = useMemo(() => normalizeData(tafData), [tafData]);

  const timeExtent = useMemo(() => {
    if (airports.length === 0) return null;

    const allTimes = airports.flatMap(airport =>
      airport.timeline.flatMap(block => [block.startMs, block.endMs])
    );

    if (allTimes.length === 0) return null;

    return {
      start: Math.min(...allTimes),
      end: Math.max(...allTimes),
      duration: Math.max(...allTimes) - Math.min(...allTimes)
    };
  }, [airports]);

  if (!airports.length || !timeExtent) {
    return (
      <div className={`bg-gray-50 rounded-lg border-2 border-dashed border-gray-300 p-6 text-center ${className}`}>
        <div className="text-gray-600">
          <svg className="mx-auto h-8 w-8 text-gray-400 mb-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <p className="text-sm font-medium text-gray-900">No TAF blocks available</p>
          <p className="text-xs text-gray-500">Flight timelines will appear once forecasts are provided</p>
        </div>
      </div>
    );
  }

  const rowHeight = Math.min(60, Math.max(40, (height - 120) / airports.length));
  const chartWidth = 800; // Fixed width for calculations

  return (
    <div className={`bg-white rounded-lg border border-gray-200 ${className}`}>
      <div className="p-4 border-b border-gray-200 flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold text-gray-900">TAF Flight Timeline</h3>
          <p className="text-sm text-gray-600">Forecast flight categories per airport</p>
        </div>
      </div>

      <div className="p-4">
        {/* Summary statistics */}
        <div className="mb-4 grid grid-cols-3 gap-4 text-sm text-gray-700">
          <div>
            <span className="font-medium">Total Period:</span>{' '}
            <span>{Math.round(timeExtent.duration / (1000 * 60 * 60))}h</span>
          </div>
          <div>
            <span className="font-medium">Forecast Periods:</span>{' '}
            <span>{airports.reduce((total, airport) => total + airport.timeline.length, 0)}</span>
          </div>
          <div>
            <span className="font-medium">Changes:</span>{' '}
            <span>{Math.max(0, airports.reduce((total, airport) => total + airport.timeline.length - 1, 0))}</span>
          </div>
        </div>

        <div className="mb-4 flex flex-wrap items-center gap-4 text-xs text-gray-700">
          <span className="font-medium">Category legend:</span>
          {Object.entries(CATEGORY_COLORS).map(([category, color]) => (
            <div key={category} className="flex items-center space-x-2">
              <span className="inline-block w-3 h-3 rounded" style={{ backgroundColor: color }}></span>
              <span>{category}</span>
            </div>
          ))}
        </div>

        <div className="relative overflow-x-auto" style={{ height: `${height + 30}px` }}>
          <div className="flex">
            {/* Airport labels */}
            <div className="flex-shrink-0 w-24 bg-gray-50 border-r">
              {airports.map((airport, index) => (
                <div
                  key={airport.icao}
                  className="flex items-center justify-end px-2 text-xs font-medium text-gray-700 border-b border-gray-200"
                  style={{ height: `${rowHeight}px` }}
                >
                  {airport.icao}
                </div>
              ))}
              {/* Space for time axis */}
              <div style={{ height: '30px' }} className="bg-gray-50"></div>
            </div>

            {/* Timeline area */}
            <div className="flex-1 relative min-w-0">
              <svg width="100%" height="100%" className="block">
                {airports.map((airport, airportIndex) => {
                  const y = airportIndex * rowHeight;
                  const barHeight = rowHeight * 0.6;
                  const barY = y + (rowHeight - barHeight) / 2;

                  return (
                    <g key={airport.icao}>
                      {/* Row background */}
                      <rect
                        x={0}
                        y={y}
                        width="100%"
                        height={rowHeight}
                        fill={airportIndex % 2 === 0 ? '#f9fafb' : '#ffffff'}
                        stroke="#e5e7eb"
                        strokeWidth={0.5}
                      />

                      {/* Timeline blocks */}
                      {airport.timeline.map((block, blockIndex) => {
                        const startPercent = ((block.startMs - timeExtent.start) / timeExtent.duration) * 100;
                        const durationPercent = (block.duration / timeExtent.duration) * 100;
                        const color = CATEGORY_COLORS[block.category] || CATEGORY_COLORS.UNKNOWN;

                        return (
                          <rect
                            key={`${airportIndex}-${blockIndex}`}
                            x={`${startPercent}%`}
                            y={barY}
                            width={`${Math.max(0.5, durationPercent)}%`}
                            height={barHeight}
                            rx={3}
                            fill={color}
                            opacity={0.85}
                            stroke="#ffffff"
                            strokeWidth={1}
                            className="cursor-pointer hover:opacity-100"
                            onMouseEnter={() => setHovered({ airport, block })}
                            onMouseLeave={() => setHovered(null)}
                          />
                        );
                      })}
                    </g>
                  );
                })}

                {/* Time axis */}
                <g>
                  {[0, 25, 50, 75, 100].map(percent => {
                    const time = timeExtent.start + (timeExtent.duration * percent / 100);
                    const yPos = airports.length * rowHeight;
                    return (
                      <g key={percent}>
                        <line
                          x1={`${percent}%`}
                          y1={0}
                          x2={`${percent}%`}
                          y2={yPos}
                          stroke="#d1d5db"
                          strokeWidth={0.5}
                          strokeDasharray="2,2"
                        />
                        <text
                          x={`${percent}%`}
                          y={yPos + 15}
                          textAnchor="middle"
                          fontSize={10}
                          fill="#6b7280"
                        >
                          {formatTime(time)}
                        </text>
                      </g>
                    );
                  })}
                </g>
              </svg>
            </div>
          </div>

          {/* Hover tooltip */}
          {hovered && (
            <div className="absolute bottom-4 right-4 max-w-xs bg-white border border-gray-200 rounded-lg shadow-xl p-4 text-sm text-gray-800 z-10">
              <div className="font-semibold text-gray-900 mb-1">
                {hovered.airport.icao}
                {hovered.airport.name && hovered.airport.name !== hovered.airport.icao && (
                  <span className="text-gray-500 font-normal"> — {hovered.airport.name}</span>
                )}
              </div>
              <div className="text-xs uppercase tracking-wide text-gray-500 mb-2">{hovered.block.category}</div>
              <div className="space-y-1">
                <div>{formatTime(hovered.block.startMs)} → {formatTime(hovered.block.endMs)}</div>
                <div>{hovered.block.visibilitySM != null ? `Visibility: ${hovered.block.visibilitySM} SM` : 'Visibility: N/A'}</div>
                <div>{hovered.block.ceilingFT != null ? `Ceiling: ${hovered.block.ceilingFT} ft` : 'Ceiling: N/A'}</div>
                <div>{formatWind(hovered.block.wind)}</div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default TAFTimeline;