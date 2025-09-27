import { render, screen } from '@testing-library/react';
import ForecastVsReality from '../../src/components/ForecastVsReality.jsx';

const createAirport = () => ({
  icao: 'KLAX',
  name: 'Los Angeles Intl',
  forecastComparison: {
    reliability: {
      rating: 'HIGH',
      score: 0.82
    },
    comparisons: {
      visibility: {
        forecast: 6,
        actual: 8
      },
      ceiling: {
        forecast: '1500',
        actual: '1800'
      },
      weather: {
        forecast: 'BKN015',
        actual: 'SCT020'
      },
      wind: {
        forecast: {
          direction: 220,
          speed: 12
        },
        actual: {
          direction: 210,
          speed: 10,
          gust: 18
        }
      },
      time: {
        forecast: '2024-02-12T12:00:00Z',
        actual: '2024-02-12T13:05:00Z'
      }
    }
  }
});

describe('ForecastVsReality', () => {
  it('renders comparison details for each airport', () => {
    const briefingData = {
      airports: [createAirport()]
    };

    render(<ForecastVsReality briefingData={briefingData} />);

    expect(screen.getByText('Forecast vs Reality')).toBeInTheDocument();
    expect(screen.getByText('KLAX')).toBeInTheDocument();
    expect(screen.getByText('Reliability:')).toBeInTheDocument();
    expect(screen.getByText('HIGH')).toBeInTheDocument();

    expect(screen.getByText('Visibility')).toBeInTheDocument();
    expect(screen.getByText('Ceiling')).toBeInTheDocument();
    expect(screen.getByText('Wind')).toBeInTheDocument();
    expect(screen.getByText('Timing')).toBeInTheDocument();
  expect(screen.getByText('8SM')).toBeInTheDocument();
  expect(screen.getByText('1,800 ft')).toBeInTheDocument();
    expect(screen.getByText('220° 12 kt')).toBeInTheDocument();
    expect(screen.getByText('210° 10 kt G18')).toBeInTheDocument();
    expect(screen.getByText('2024-02-12 12:00Z')).toBeInTheDocument();
    expect(screen.getByText('2024-02-12 13:05Z')).toBeInTheDocument();
  });

  it('returns null without briefing data', () => {
    const { container } = render(<ForecastVsReality briefingData={null} />);
    expect(container.firstChild).toBeNull();
  });

  it('shows N/A when data is missing', () => {
    const briefingData = {
      airports: [{
        icao: 'KSFO',
        forecastComparison: {
          comparisons: {}
        }
      }]
    };

    render(<ForecastVsReality briefingData={briefingData} />);

    expect(screen.getAllByText('N/A').length).toBeGreaterThan(0);
  });
});
