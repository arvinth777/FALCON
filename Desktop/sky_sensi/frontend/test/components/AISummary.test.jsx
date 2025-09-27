import { render, screen } from '@testing-library/react';
import AISummary from '../../src/components/AISummary.jsx';

const baseBriefing = {
  route: 'KLAX,KSFO',
  generatedAt: '2024-02-12T15:30:00Z',
  aiSummary: {
    routeSummary: 'Smooth flight expected.',
    keyFindings: ['Sample finding'],
    overallConditions: 'FAVORABLE',
    confidence: 'HIGH'
  },
  airports: [
    { icao: 'KLAX', name: 'Los Angeles Intl' },
    { icao: 'KSFO', name: 'San Francisco Intl' }
  ]
};

describe('AISummary', () => {
  it('renders raw data from both rawData and root fallbacks', () => {
    const briefingData = {
      ...baseBriefing,
      metarsByIcao: {
        KSFO: { rawText: 'ROOT KSFO METAR' }
      },
      tafsByIcao: {
        KSFO: { rawTAF: 'ROOT KSFO TAF' }
      },
      rawData: {
        metarsByIcao: {
          KLAX: { rawText: 'RAW KLAX METAR' }
        },
        tafsByIcao: {
          KLAX: { rawTAF: 'RAW KLAX TAF' }
        }
      }
    };

    render(
      <AISummary
        briefingData={briefingData}
        showRawData
        onToggleRawData={() => {}}
      />
    );

  expect(screen.getByText(text => text.includes('=== CURRENT WEATHER (METAR) ==='))).toBeInTheDocument();
  expect(screen.getByText(text => text.includes('KLAX: RAW KLAX METAR'))).toBeInTheDocument();
  expect(screen.getByText(text => text.includes('KSFO: ROOT KSFO METAR'))).toBeInTheDocument();

  expect(screen.getByText(text => text.includes('=== FORECASTS (TAF) ==='))).toBeInTheDocument();
  expect(screen.getByText(text => text.includes('KLAX: RAW KLAX TAF'))).toBeInTheDocument();
  expect(screen.getByText(text => text.includes('KSFO: ROOT KSFO TAF'))).toBeInTheDocument();
  });

  it('renders nothing when briefing data is missing', () => {
    const { container } = render(
      <AISummary briefingData={null} showRawData={false} onToggleRawData={() => {}} />
    );
    expect(container.firstChild).toBeNull();
  });

  it('shows Open-Meteo snapshot when forecast data is available', () => {
    const briefingData = {
      ...baseBriefing,
      openMeteoForecasts: {
        KLAX: {
          forecast: {
            current: {
              cloud_cover: 68,
              temperature: { actual: 19.4 },
              wind: { speed: 12.2, direction: 245 },
              visibility: 16093,
              weather: { description: 'Partly cloudy' }
            }
          }
        }
      }
    };

    render(
      <AISummary
        briefingData={briefingData}
        showRawData={false}
        onToggleRawData={() => {}}
      />
    );

    expect(screen.getByText('Open-Meteo Snapshot')).toBeInTheDocument();
    expect(screen.getByText('KLAX')).toBeInTheDocument();
    expect(screen.getByText(/68% cover/)).toBeInTheDocument();
    expect(screen.getByText(/19°C/)).toBeInTheDocument();
    expect(screen.getByText(/245° @ 12 kt/)).toBeInTheDocument();
    expect(screen.getByText(/10 mi vis/)).toBeInTheDocument();
  });
});
