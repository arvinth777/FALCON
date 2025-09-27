import { useMemo, useState } from 'react';
import { ResponsiveContainer, ComposedChart, CartesianGrid, XAxis, YAxis, Customized } from 'recharts';

const CATEGORY_COLORS = {
  VFR: '#16a34a',
  MVFR: '#2563eb',
  IFR: '#ef4444',
  LIFR: '#a21caf',
  UNKNOWN: '#64748b'
};

const toMillis = (value) => {
  if (!value) return NaN;
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? NaN : parsed.getTime();
};

const ensureCategory = (category) => {
  const normalized = typeof category === 'string' ? category.toUpperCase() : '';
  return CATEGORY_COLORS[normalized] ? normalized : 'UNKNOWN';
};

const formatTick = (timestamp) => {
  if (!Number.isFinite(timestamp)) return '';
  const date = new Date(timestamp);
  return `${date.toUTCString().slice(5, 16)} ${date.toUTCString().slice(17, 22)}Z`;
};

const formatTimeRange = (startMs, endMs) => {
  if (!Number.isFinite(startMs) || !Number.isFinite(endMs)) return 'Unknown period';
  const start = new Date(startMs).toISOString().replace('T', ' ').replace('Z', 'Z');
  const end = new Date(endMs).toISOString().replace('T', ' ').replace('Z', 'Z');
  return `${start} → ${end}`;
};

const formatWind = (wind) => {
  if (!wind || (wind.dir == null && wind.spd == null && wind.gst == null)) {
    return 'Wind: N/A';
  }

  const dir = wind.dir == null ? 'VRB' : `${wind.dir}°`;
  if (wind.spd == null) {
    return `Wind: ${dir}`;
  }

  if (wind.gst == null) {
    return `Wind: ${dir} / ${wind.spd} kt`;
  }

  return `Wind: ${dir} / ${wind.spd}G${wind.gst} kt`;
};

const normalizeAirports = (tafData) => {
  if (!Array.isArray(tafData)) {
    return [];
  }

  // Convert ISO strings to ms numbers for the chart
  const parseMs = iso => (iso ? new Date(iso).getTime() : null);

  const looksLikeAirport = tafData.some(item => Array.isArray(item?.flightTimeline));

  if (looksLikeAirport) {
    return tafData
      .filter(item => Array.isArray(item?.flightTimeline))
      .map(item => {
        const icao = item.icao || item.icaoCode || item.identifier || item.code || 'UNKNOWN';
        const name = item.name || item.airportName || icao;
        const timeline = item.flightTimeline
          .map(block => {
            const startMs = parseMs(block.start) || toMillis(block.start ?? block.startTime);
            const endMs = parseMs(block.end) || toMillis(block.end ?? block.endTime);
            if (!Number.isFinite(startMs) || !Number.isFinite(endMs) || endMs <= startMs) {
              return null;
            }
            return {
              ...block,
              startMs,
              endMs,
              category: ensureCategory(block.category),
              visibilitySM: Number.isFinite(block.visibilitySM) ? block.visibilitySM : null,
              ceilingFT: Number.isFinite(block.ceilingFT) ? block.ceilingFT : null,
              wind: block.wind || { dir: null, spd: null, gst: null }
            };
          })
          .filter(Boolean);

        return {
          icao,
          name,
          timeline
        };
      })
      .filter(item => item.timeline.length > 0);
  }

  const grouped = new Map();

  tafData.forEach(entry => {
    const icao = entry?.airportCode || entry?.icao || entry?.icaoCode || 'UNKNOWN';
    const startMs = parseMs(entry?.start) || toMillis(entry?.start ?? entry?.startTime ?? entry?.validFrom);
    const endMs = parseMs(entry?.end) || toMillis(entry?.end ?? entry?.endTime ?? entry?.validTo);
    if (!Number.isFinite(startMs) || !Number.isFinite(endMs) || endMs <= startMs) {
      return;
    }

    if (!grouped.has(icao)) {
      grouped.set(icao, {
        icao,
        name: entry?.airportName || icao,
        timeline: []
      });
    }

    const bucket = grouped.get(icao);
    bucket.timeline.push({
      start: entry.start ?? entry.startTime ?? entry.validFrom,
      end: entry.end ?? entry.endTime ?? entry.validTo,
      startMs,
      endMs,
      category: ensureCategory(entry.category ?? entry.flightCategory),
      visibilitySM: Number.isFinite(entry.visibilitySM ?? entry.visibility) ? (entry.visibilitySM ?? entry.visibility) : null,
      ceilingFT: Number.isFinite(entry.ceilingFT ?? entry.ceiling) ? (entry.ceilingFT ?? entry.ceiling) : null,
      wind: entry.wind || { dir: entry.windDirection ?? null, spd: entry.windSpeed ?? null, gst: entry.windGust ?? null }
    });
  });

  return Array.from(grouped.values()).filter(item => item.timeline.length > 0);
};

const TAFTimeline = ({ tafData = [], className = '', height = 320 }) => {
  const [hovered, setHovered] = useState(null);

  // Debug logging
  console.log('TAFTimeline received data:', {
    tafDataLength: tafData.length,
    tafData: tafData.slice(0, 2) // Log first 2 items
  });

  const airports = useMemo(() => {
    const normalized = normalizeAirports(tafData);
    console.log('TAFTimeline normalized airports:', {
      airportsLength: normalized.length,
      airports: normalized.map(a => ({
        icao: a.icao,
        timelineLength: a.timeline.length,
        firstBlock: a.timeline[0]
      }))
    });
    return normalized;
  }, [tafData]);

  const timeDomain = useMemo(() => {
    if (airports.length === 0) {
      // If empty, use a 6-hour window around now to avoid 1970/1984 axes
      const now = Date.now();
      const sixHours = 6 * 60 * 60 * 1000;
      return [now - sixHours/2, now + sixHours/2];
    }

    const times = airports.flatMap(airport =>
      airport.timeline.flatMap(block => [block.startMs, block.endMs])
    ).filter(Number.isFinite);

    if (times.length === 0) {
      // If no valid times, use a 6-hour window around now
      const now = Date.now();
      const sixHours = 6 * 60 * 60 * 1000;
      return [now - sixHours/2, now + sixHours/2];
    }

    const min = Math.min(...times);
    const max = Math.max(...times);

    if (min === max) {
      const padding = 60 * 60 * 1000; // 1 hour
      return [min - padding, max + padding];
    }

    return [min, max];
  }, [airports]);

  const chartRows = useMemo(() => (
    airports.map(airport => ({ name: airport.icao }))
  ), [airports]);

  const renderBars = ({ xAxisMap, yAxisMap }) => {
    if (!xAxisMap || !yAxisMap) {
      return null;
    }

    const xScale = xAxisMap.x?.scale;
    const yScale = yAxisMap.y?.scale;
    const bandwidth = typeof yAxisMap.y?.bandwidth === 'function'
      ? yAxisMap.y.bandwidth()
      : 40;

    if (!xScale || !yScale) {
      return null;
    }

    return (
      <g>
        {airports.map((airport, airportIndex) => {
          const rowTop = yScale(airport.icao);
          const barHeight = Math.min(bandwidth * 0.7, 26);
          const offsetY = rowTop + (bandwidth - barHeight) / 2;

          return airport.timeline.map((block, blockIndex) => {
            const startX = xScale(block.startMs);
            const endX = xScale(block.endMs);
            const width = endX - startX;

            if (!Number.isFinite(width) || width <= 0) {
              return null;
            }

            const color = CATEGORY_COLORS[block.category] || CATEGORY_COLORS.UNKNOWN;

            return (
              <g key={`${airportIndex}-${blockIndex}`}>
                <rect
                  x={startX}
                  y={offsetY}
                  width={Math.max(2, width)}
                  height={barHeight}
                  rx={3}
                  fill={color}
                  opacity={0.85}
                  stroke="#ffffff"
                  strokeWidth={1}
                  onMouseEnter={() => setHovered({ airport, block })}
                  onMouseLeave={() => setHovered(null)}
                />
                {width > 48 && (
                  <text
                    x={startX + width / 2}
                    y={offsetY + barHeight / 2}
                    fill="#fff"
                    fontSize={9}
                    fontWeight="600"
                    textAnchor="middle"
                    dominantBaseline="middle"
                    pointerEvents="none"
                    style={{ textShadow: '0 1px 2px rgba(15, 23, 42, 0.5)' }}
                  >
                    {block.category}
                  </text>
                )}
              </g>
            );
          });
        })}
      </g>
    );
  };

  const SafeCustomized = (props) => {
    try {
      return renderBars(props);
    } catch (error) {
      if (import.meta?.env?.VITE_ENABLE_DEBUG_LOGS === 'true') {
        console.error('TAFTimeline render error:', error);
      }
      return null;
    }
  };

  if (!airports.length || !timeDomain) {
    console.log('TAFTimeline: No data to display', {
      airportsLength: airports.length,
      timeDomain,
      tafDataLength: tafData.length
    });
    return (
      <div className={`bg-gray-50 rounded-lg border-2 border-dashed border-gray-300 p-6 text-center ${className}`}>
        <div className="text-gray-600">
          <svg className="mx-auto h-8 w-8 text-gray-400 mb-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <p className="text-sm font-medium text-gray-900">No TAF blocks available</p>
          <p className="text-xs text-gray-500">Flight timelines will appear once forecasts are provided</p>
          <p className="text-xs text-red-500 mt-2">Debug: {airports.length} airports, {tafData.length} TAF entries</p>
        </div>
      </div>
    );
  }

  return (
    <div className={`bg-white rounded-lg border border-gray-200 ${className}`}>
      <div className="p-4 border-b border-gray-200 flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold text-gray-900">
            TAF Flight Timeline
          </h3>
          <p className="text-sm text-gray-600">Forecast flight categories per airport with contiguous time ranges</p>
        </div>
      </div>

      <div className="p-4">
        <div className="mb-4 flex flex-wrap items-center gap-4 text-xs text-gray-700">
          <span className="font-medium">Category legend:</span>
          {Object.entries(CATEGORY_COLORS).map(([category, color]) => (
            <div key={category} className="flex items-center space-x-2">
              <span className="inline-block w-3 h-3 rounded" style={{ backgroundColor: color }}></span>
              <span>{category}</span>
            </div>
          ))}
        </div>

        <div className="relative" style={{ height: `${height}px` }}>
          <ResponsiveContainer width="100%" height="100%">
            <ComposedChart data={chartRows} margin={{ top: 20, right: 24, left: 96, bottom: 32 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
              <XAxis
                type="number"
                domain={timeDomain}
                tickFormatter={formatTick}
                tick={{ fontSize: 10 }}
                interval={0}
                angle={-35}
                textAnchor="end"
                height={60}
              />
              <YAxis
                type="category"
                dataKey="name"
                tick={{ fontSize: 11 }}
                width={80}
              />
              <Customized component={SafeCustomized} />
            </ComposedChart>
          </ResponsiveContainer>

          {hovered && (
            <div className="absolute bottom-4 right-4 max-w-xs bg-white border border-gray-200 rounded-lg shadow-xl p-4 text-sm text-gray-800">
              <div className="font-semibold text-gray-900 mb-1">
                {hovered.airport.icao}
                {hovered.airport.name && hovered.airport.name !== hovered.airport.icao && (
                  <span className="text-gray-500 font-normal"> — {hovered.airport.name}</span>
                )}
              </div>
              <div className="text-xs uppercase tracking-wide text-gray-500 mb-2">{hovered.block.category}</div>
              <div className="space-y-1">
                <div>{formatTimeRange(hovered.block.startMs, hovered.block.endMs)}</div>
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