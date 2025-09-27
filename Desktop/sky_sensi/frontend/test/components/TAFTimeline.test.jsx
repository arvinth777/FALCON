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
    expect(screen.getByText('No TAF Timeline Data')).toBeInTheDocument();
  });

  it('renders summary statistics when data is available', () => {
    const tafData = [
      {
        validFrom: '2024-02-12T12:00:00Z',
        validTo: '2024-02-12T15:00:00Z',
        visibility: 6,
        ceiling: 3000,
        changeType: 'BASE',
        airportCode: 'KLAX',
        airportName: 'Los Angeles Intl'
      },
      {
        validFrom: '2024-02-12T15:00:00Z',
        validTo: '2024-02-12T18:00:00Z',
        visibility: 3,
        ceiling: 1000,
        changeType: 'TEMPO',
        airportCode: 'KLAX',
        airportName: 'Los Angeles Intl'
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
        validFrom: 'Not a date',
        validTo: 'Also not a date',
        airportCode: 'KJFK',
        airportName: 'John F. Kennedy Intl'
      }
    ];

    expect(() => render(<TAFTimeline tafData={tafData} />)).not.toThrow();
    expect(screen.getByText('TAF Gantt Timeline')).toBeInTheDocument();
  });
});
