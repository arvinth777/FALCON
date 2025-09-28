import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { act } from 'react-dom/test-utils';
import React from 'react';
import WeatherMap from '../../src/components/WeatherMap.jsx';

// Mock the env utility
const { getEnvMock } = vi.hoisted(() => ({
  getEnvMock: vi.fn()
}));

vi.mock('../../src/utils/env.js', () => ({
  __esModule: true,
  getEnv: getEnvMock
}));

vi.mock('leaflet', () => ({
  divIcon: () => ({})
}));

vi.mock('leaflet/dist/leaflet.css', () => ({}), { virtual: true });
vi.mock('leaflet-defaulticon-compatibility/dist/leaflet-defaulticon-compatibility.css', () => ({}), { virtual: true });
vi.mock('leaflet-defaulticon-compatibility', () => ({}), { virtual: true });

const tileLayerInstances = [];

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
    TileLayer: ({ url, children, ...props }) => {
      tileLayerInstances.push({ url, props });
      return (
        <div
          data-testid="tile-layer"
          data-url={url}
          data-has-tileerror={props.eventHandlers?.tileerror ? 'true' : 'false'}
        >
          {children}
        </div>
      );
    },
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

  beforeEach(() => {
    tileLayerInstances.length = 0;
    // Mock console methods to avoid noise in tests
    vi.spyOn(console, 'log').mockImplementation(() => {});
    vi.spyOn(console, 'error').mockImplementation(() => {});
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    global.fetch = vi.fn(() => Promise.resolve({ ok: true, status: 200 }));
    getEnvMock.mockReset();
  });

  afterEach(() => {
    vi.clearAllMocks();
    vi.restoreAllMocks();
    delete global.fetch;
    import.meta.env.VITE_ENABLE_DEBUG_LOGS = 'false';
    tileLayerInstances.length = 0;
  });

  it('does not render weather overlays when VITE_OWM_KEY is missing', () => {
  getEnvMock.mockReturnValue(null);

    render(<WeatherMap {...baseProps} />);

    expect(screen.getByText('Weather overlays unavailable - OpenWeatherMap API key required (VITE_OWM_KEY)')).toBeInTheDocument();

    const tileLayers = screen.getAllByTestId('tile-layer');
    expect(
      tileLayers.some(layer => layer.getAttribute('data-url')?.includes('tile.openweathermap.org'))
    ).toBe(false);
  });

  it('does not render weather overlays when VITE_OWM_KEY is too short', () => {
  getEnvMock.mockReturnValue('short');

    render(<WeatherMap {...baseProps} />);

    expect(screen.getByText('Weather overlays unavailable - OpenWeatherMap API key required (VITE_OWM_KEY)')).toBeInTheDocument();

    const tileLayers = screen.getAllByTestId('tile-layer');
    expect(
      tileLayers.some(layer => layer.getAttribute('data-url')?.includes('tile.openweathermap.org'))
    ).toBe(false);
  });

  it('renders weather layer checkboxes when valid VITE_OWM_KEY is provided', () => {
  getEnvMock.mockReturnValue('abcdefghijklmnopqrstuvwxyz123456'); // 32 character key

    render(<WeatherMap {...baseProps} />);

    // Check that all weather layer checkboxes are present
    expect(screen.getByLabelText('Cloud Coverage')).toBeInTheDocument();
    expect(screen.getByLabelText('Precipitation')).toBeInTheDocument();
    expect(screen.getByLabelText('Wind Speed')).toBeInTheDocument();
    expect(screen.getByLabelText('Temperature')).toBeInTheDocument();
    expect(screen.getByLabelText('Pressure')).toBeInTheDocument();
    expect(screen.getByLabelText('Snow')).toBeInTheDocument();

    // Verify no weather overlays are rendered by default (all unchecked)
    const tileLayers = screen.getAllByTestId('tile-layer');
    expect(
      tileLayers.some(layer => layer.getAttribute('data-url')?.includes('tile.openweathermap.org'))
    ).toBe(false);
  });

  it('renders OpenWeather tile layers when weather checkboxes are selected', async () => {
    const testKey = 'abcdefghijklmnopqrstuvwxyz123456';
    getEnvMock.mockReturnValue(testKey);

    render(<WeatherMap {...baseProps} />);

    // Enable cloud coverage
    const cloudCheckbox = screen.getByLabelText('Cloud Coverage');
    fireEvent.click(cloudCheckbox);
    await waitFor(() => expect(cloudCheckbox).toBeChecked());

    // Enable precipitation
    const precipCheckbox = screen.getByLabelText('Precipitation');
    fireEvent.click(precipCheckbox);
    await waitFor(() => expect(precipCheckbox).toBeChecked());

    await waitFor(() => {
      const tileLayers = screen.getAllByTestId('tile-layer');

      expect(
        tileLayers.some(layer => 
          layer.getAttribute('data-url') === `https://tile.openweathermap.org/map/clouds_new/{z}/{x}/{y}.png?appid=${testKey}`
        )
      ).toBe(true);

      expect(
        tileLayers.some(layer => 
          layer.getAttribute('data-url') === `https://tile.openweathermap.org/map/precipitation_new/{z}/{x}/{y}.png?appid=${testKey}`
        )
      ).toBe(true);
    });

    const tileLayersAfter = screen.getAllByTestId('tile-layer');
    expect(
      tileLayersAfter.some(layer => 
        layer.getAttribute('data-url')?.includes('wind_new')
      )
    ).toBe(false);
  });

  it('logs debug information when VITE_ENABLE_DEBUG_LOGS is true', () => {
    const testKey = 'abcdefghijklmnopqrstuvwxyz123456';
    
    // Mock getEnv to return different values based on the key
    getEnvMock.mockImplementation((key) => {
      if (key === 'VITE_OWM_KEY') return testKey;
      if (key === 'VITE_ENABLE_DEBUG_LOGS') return 'true';
      return null;
    });

    render(<WeatherMap {...baseProps} />);

    // Verify console.log was called with key status
    expect(console.log).toHaveBeenCalledWith('OWM Key status:', {
      rawEnvValue: testKey,
      owmKeyDirect: testKey,
      normalizedKey: testKey,
      hasKey: true,
      keyLength: 32,
      isValidFormat: true
    });
  });

  it('handles all weather layer types correctly', async () => {
    const testKey = 'abcdefghijklmnopqrstuvwxyz123456';
    getEnvMock.mockReturnValue(testKey);

    render(<WeatherMap {...baseProps} />);

    // Test all weather layer types
    const weatherLayers = [
      { label: 'Cloud Coverage', owmLayer: 'clouds_new' },
      { label: 'Precipitation', owmLayer: 'precipitation_new' },
      { label: 'Wind Speed', owmLayer: 'wind_new' },
      { label: 'Temperature', owmLayer: 'temp_new' },
      { label: 'Pressure', owmLayer: 'pressure_new' },
      { label: 'Snow', owmLayer: 'snow' }
    ];

    for (const { label, owmLayer } of weatherLayers) {
      const checkbox = screen.getByLabelText(label);
      expect(checkbox).toBeInTheDocument();
      expect(checkbox).not.toBeChecked();

      // Enable the layer
      fireEvent.click(checkbox);
      await waitFor(() => expect(checkbox).toBeChecked());

      await waitFor(() => {
        const tileLayers = screen.getAllByTestId('tile-layer');
        expect(
          tileLayers.some(layer => 
            layer.getAttribute('data-url') === `https://tile.openweathermap.org/map/${owmLayer}/{z}/{x}/{y}.png?appid=${testKey}`
          )
        ).toBe(true);
      });

      // Disable the layer
      fireEvent.click(checkbox);
      await waitFor(() => expect(checkbox).not.toBeChecked());
    }
  });

  it('validates OWM key length correctly', () => {
    // Test with 24 character key (minimum valid)
    getEnvMock.mockReturnValue('abcdefghijklmnopqrstuvwx'); // 24 chars
    const { rerender } = render(<WeatherMap {...baseProps} />);
    expect(screen.getByLabelText('Cloud Coverage')).toBeInTheDocument();

    // Test with 23 character key (invalid)
    getEnvMock.mockReturnValue('abcdefghijklmnopqrstuvw'); // 23 chars
    rerender(<WeatherMap {...baseProps} />);
    expect(screen.getByText('Weather overlays unavailable - OpenWeatherMap API key required (VITE_OWM_KEY)')).toBeInTheDocument();
  });

  it('handles tile error events correctly', async () => {
    const testKey = 'abcdefghijklmnopqrstuvwxyz123456';
    getEnvMock.mockReturnValue(testKey);
    
    // Enable debug logging to test error logging
    import.meta.env.VITE_ENABLE_DEBUG_LOGS = 'true';

    render(<WeatherMap {...baseProps} />);

    const cloudCheckbox = screen.getByLabelText('Cloud Coverage');
    fireEvent.click(cloudCheckbox);
    await waitFor(() => expect(cloudCheckbox).toBeChecked());

    const cloudLayerInstance = [...tileLayerInstances]
      .reverse()
      .find(instance => instance.url.includes('clouds_new'));

    expect(cloudLayerInstance).toBeDefined();
    expect(cloudLayerInstance.props.eventHandlers).toBeDefined();

    act(() => {
      cloudLayerInstance.props.eventHandlers.tileerror(new Error('Mock tile failure'));
    });

    await waitFor(() => expect(cloudCheckbox).not.toBeChecked());
    await waitFor(() => expect(screen.getByText('Tiles failed to load. Retry in a moment.')).toBeInTheDocument());
    const retryButton = screen.getByRole('button', { name: 'Retry' });
    expect(retryButton).toBeInTheDocument();

    fireEvent.click(retryButton);

    await waitFor(() => expect(cloudCheckbox).toBeChecked());
    await waitFor(() => {
      expect(screen.queryByText('Tiles failed to load. Retry in a moment.')).not.toBeInTheDocument();
    });
  });

  it('surfaces preflight failures before enabling weather overlays', async () => {
    const testKey = 'abcdefghijklmnopqrstuvwxyz123456';
    getEnvMock.mockReturnValue(testKey);

    global.fetch
      .mockResolvedValueOnce({ ok: false, status: 401 })
      .mockResolvedValue({ ok: true, status: 200 });

    render(<WeatherMap {...baseProps} />);

    const cloudCheckbox = screen.getByLabelText('Cloud Coverage');
    fireEvent.click(cloudCheckbox);

    await waitFor(() => expect(cloudCheckbox).not.toBeChecked());
    await waitFor(() => expect(screen.getByText('Unauthorized tile access. Check your API key.')).toBeInTheDocument());

    const retryButton = screen.getByRole('button', { name: 'Retry' });
    fireEvent.click(retryButton);

    await waitFor(() => expect(cloudCheckbox).toBeChecked());
  });
});
