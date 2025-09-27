import { describe, expect, it } from 'vitest';
import {
  toTAFTimelineData,
  formatTimelineTooltip,
  sanitizeForecastData
} from '../../src/utils/chartUtils.js';

describe('chartUtils', () => {
  it('transforms TAF data into sorted timeline entries', () => {
    const forecasts = [
      {
        validFrom: '2024-02-12T18:00:00Z',
        validTo: '2024-02-12T21:00:00Z',
        visibility: 6,
        ceiling: 3500,
        airportCode: 'KSFO'
      },
      {
        validFrom: '2024-02-12T12:00:00Z',
        validTo: '2024-02-12T15:00:00Z',
        visibility: 4,
        ceiling: 1200,
        airportCode: 'KSFO'
      }
    ];

    const timeline = toTAFTimelineData(forecasts);

    expect(timeline).toHaveLength(2);
    expect(timeline[0].startTime).toBeLessThan(timeline[1].startTime);
    expect(timeline[0].flightCategory).toBeDefined();
  });

  it('formats tooltip data with details', () => {
    const timeline = toTAFTimelineData([
      {
        validFrom: '2024-02-12T12:00:00Z',
        validTo: '2024-02-12T14:00:00Z',
        visibility: 5,
        ceiling: 2000,
        weather: ['BR']
      }
    ]);

    const tooltip = formatTimelineTooltip(timeline[0]);

    expect(tooltip).not.toBeNull();
    expect(tooltip.title).toBeTruthy();
    expect(tooltip.items.find(item => item.label === 'Visibility')).toBeDefined();
  });

  it('sanitizes raw forecast data with defaults', () => {
    const sanitized = sanitizeForecastData({
      visibility: null,
      ceiling: null,
      windSpeed: '15',
      windDirection: '270'
    });

    expect(sanitized.visibility).toBeGreaterThanOrEqual(0);
    expect(sanitized.ceiling).toBeGreaterThanOrEqual(0);
    expect(sanitized.windDirection).toBeLessThanOrEqual(360);
  });
});
