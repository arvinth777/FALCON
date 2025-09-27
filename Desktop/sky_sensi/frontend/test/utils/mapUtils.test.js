import { describe, expect, it } from 'vitest';
import { calculateRouteDistance, convertSigmetToPolygon } from '../../src/utils/mapUtils.js';

describe('mapUtils', () => {
  it('calculates total route distance between waypoints', () => {
    const waypoints = [
      { latitude: 33.9416, longitude: -118.4085 },
      { latitude: 37.6213, longitude: -122.379 }
    ];

    const result = calculateRouteDistance(waypoints);

    expect(result.error).toBeNull();
    expect(result.totalDistance).toBeGreaterThan(250);
    expect(result.totalDistance).toBeLessThan(400);
    expect(result.legs).toHaveLength(1);
  });

  it('validates route distance input', () => {
    const waypoints = [{ latitude: 'invalid', longitude: 0 }];
    const result = calculateRouteDistance(waypoints);
    expect(result.error).toMatch(/Route requires at least 2 waypoints/);
  });

  it('converts SIGMET polygons into [lat, lon] coordinates', () => {
    const sigmet = {
      geometry: {
        type: 'Polygon',
        coordinates: [
          [
            [-123.0, 36.5],
            [-122.0, 37.0],
            [-121.5, 36.8],
            [-123.0, 36.5]
          ]
        ]
      }
    };

    const polygons = convertSigmetToPolygon(sigmet);

    expect(polygons).toHaveLength(1);
    expect(polygons[0]).toHaveLength(1);
    expect(polygons[0][0][0]).toEqual([36.5, -123.0]);
  });

  it('converts SIGMET multipolygons into multiple rings', () => {
    const sigmet = {
      geometry: {
        type: 'MultiPolygon',
        coordinates: [
          [
            [
              [-123.0, 36.5],
              [-122.0, 37.0],
              [-121.5, 36.8],
              [-123.0, 36.5]
            ]
          ],
          [
            [
              [-121.0, 35.5],
              [-120.0, 35.7],
              [-119.5, 35.2],
              [-121.0, 35.5]
            ]
          ]
        ]
      }
    };

    const polygons = convertSigmetToPolygon(sigmet);

    expect(polygons).toHaveLength(2);
    expect(polygons[0][0][0]).toEqual([36.5, -123.0]);
    expect(polygons[1][0][0]).toEqual([35.5, -121.0]);
  });
});
