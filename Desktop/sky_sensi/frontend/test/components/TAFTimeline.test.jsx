import { render, screen } from '@testing-library/react';
import React from 'react';
import TAFTimeline from '../../src/components/TAFTimeline.jsx';

vi.mock('recharts', () => {
  const React = require('react');
  const passthrough = ({ children }) => <div>{children}</div>;
  return {
    ResponsiveContainer: passthrough,
    ComposedChart: passthrough,
    XAxis: () => null,
    YAxis: () => null,
    CartesianGrid: () => null,
    Tooltip: () => null,
    Brush: () => null,
    Customized: () => null
  };
});

describe('TAFTimeline', () => {
  it('renders fallback when no data is provided', () => {
    render(<TAFTimeline tafData={[]} />);
    expect(screen.getByText('No TAF blocks available')).toBeInTheDocument();
  });

  it('renders summary statistics when data is available', () => {
    const tafData = [
      {
        icao: 'KLAX',
        name: 'Los Angeles Intl',
        flightTimeline: [
          {
            start: '2024-02-12T12:00:00Z',
            end: '2024-02-12T15:00:00Z',
            category: 'VFR',
            visibilitySM: 6,
            ceilingFT: 3000,
            wind: { dir: 250, spd: 10, gst: null }
          },
          {
            start: '2024-02-12T15:00:00Z',
            end: '2024-02-12T18:00:00Z',
            category: 'MVFR',
            visibilitySM: 3,
            ceilingFT: 1000,
            wind: { dir: 270, spd: 15, gst: 20 }
          }
        ]
      }
    ];

    render(<TAFTimeline tafData={tafData} />);

    expect(screen.getByText('Total Period:')).toBeInTheDocument();
    expect(screen.getByText('6h')).toBeInTheDocument();
    expect(screen.getByText('Forecast Periods:')).toBeInTheDocument();
    expect(screen.getByText('2')).toBeInTheDocument();
    expect(screen.getByText('Changes:')).toBeInTheDocument();
  });

  it('gracefully handles invalid timestamps', () => {
    const tafData = [
      {
        icao: 'KJFK',
        name: 'John F. Kennedy Intl',
        flightTimeline: [
          {
            start: 'Not a date',
            end: 'Also not a date',
            category: 'VFR',
            visibilitySM: 10,
            ceilingFT: null,
            wind: { dir: null, spd: null, gst: null }
          }
        ]
      }
    ];

    expect(() => render(<TAFTimeline tafData={tafData} />)).not.toThrow();
    expect(screen.getByText('No TAF blocks available')).toBeInTheDocument();
  });
});
