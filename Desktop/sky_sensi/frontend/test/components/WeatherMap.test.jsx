import { render, screen, fireEvent } from '@testing-library/react';
import React from 'react';
import WeatherMap from '../../src/components/WeatherMap.jsx';

vi.mock('leaflet', () => ({
  divIcon: () => ({})
}));

vi.mock('leaflet/dist/leaflet.css', () => ({}), { virtual: true });
vi.mock('leaflet-defaulticon-compatibility/dist/leaflet-defaulticon-compatibility.css', () => ({}), { virtual: true });
vi.mock('leaflet-defaulticon-compatibility', () => ({}), { virtual: true });

vi.mock('react-leaflet', () => {
  const React = require('react');
  const fitBounds = vi.fn();

  const LayersControl = ({ children }) => (
    <div data-testid="layers-control">{children}</div>
  );

  LayersControl.Overlay = ({ name, children }) => (
    <div data-testid="layers-control-overlay" data-name={name}>
      {children}
    </div>
  );

  return {
    MapContainer: ({ children }) => <div data-testid="map-container">{children}</div>,
    TileLayer: ({ url, children, ...props }) => (
      <div data-testid="tile-layer" data-url={url} data-props={JSON.stringify(props)}>
        {children}
      </div>
    ),
    Marker: ({ children }) => <div data-testid="marker">{children}</div>,
    Popup: ({ children }) => <div data-testid="popup">{children}</div>,
    Polyline: ({ children }) => <div data-testid="polyline">{children}</div>,
    Polygon: ({ children }) => <div data-testid="polygon">{children}</div>,
    LayersControl,
    useMap: () => ({ fitBounds })
  };
});

describe('WeatherMap', () => {
  const baseProps = {
    airports: [
      { icao: 'KLAX', icaoCode: 'KLAX', latitude: 33.9416, longitude: -118.4085 }
    ],
    sigmets: [],
    pireps: [],
    metarsByIcao: {},
    tafsByIcao: {}
  };

  afterEach(() => {
    vi.clearAllMocks();
    delete import.meta.env.VITE_OWM_KEY;
  });

  it('does not render cloud overlay when VITE_OWM_KEY is missing', () => {
    delete import.meta.env.VITE_OWM_KEY;

    render(<WeatherMap {...baseProps} />);

  expect(screen.getByText('Cloud overlay unavailable (set VITE_OWM_KEY)')).toBeInTheDocument();

    const tileLayers = screen.getAllByTestId('tile-layer');
    expect(
      tileLayers.some(layer => layer.getAttribute('data-url')?.includes('tile.openweathermap.org/map/clouds_new'))
    ).toBe(false);
  });

  it('renders OpenWeather cloud overlay when key is provided', () => {
    import.meta.env.VITE_OWM_KEY = 'abc123';

    render(<WeatherMap {...baseProps} />);

    fireEvent.click(screen.getByLabelText('Cloud Coverage'));
    fireEvent.click(screen.getByLabelText('Precipitation'));
    fireEvent.click(screen.getByLabelText('Wind'));

    const tileLayers = screen.getAllByTestId('tile-layer');
    expect(
      tileLayers.some(layer => layer.getAttribute('data-url') === 'https://tile.openweathermap.org/map/clouds_new/{z}/{x}/{y}.png?appid=abc123')
    ).toBe(true);
    expect(
      tileLayers.some(layer => layer.getAttribute('data-url') === 'https://tile.openweathermap.org/map/precipitation_new/{z}/{x}/{y}.png?appid=abc123')
    ).toBe(true);
    expect(
      tileLayers.some(layer => layer.getAttribute('data-url') === 'https://tile.openweathermap.org/map/wind_new/{z}/{x}/{y}.png?appid=abc123')
    ).toBe(true);
  });
});
