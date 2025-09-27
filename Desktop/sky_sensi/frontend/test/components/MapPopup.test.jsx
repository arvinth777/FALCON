import { fireEvent, render, screen } from '@testing-library/react';
import MapPopup from '../../src/components/MapPopup.jsx';

describe('MapPopup', () => {
  it('renders airport details with parsed weather and toggles raw view', () => {
    const airport = {
      icaoCode: 'KLAX',
      name: 'Los Angeles Intl',
      latitude: 33.9416,
      longitude: -118.4085,
      flightCategory: 'VFR',
      metar: 'KLAX 121530Z 25008KT 10SM FEW020 18/09 A3005',
      taf: 'KLAX 121120Z 1212/1318 26006KT P6SM FEW020'
    };

    render(<MapPopup type="airport" airport={airport} />);

    expect(screen.getByText(/Los Angeles Intl/)).toBeInTheDocument();
    expect(screen.getByText('Flight Category:')).toBeInTheDocument();
    expect(screen.getByText('VFR')).toBeInTheDocument();

    const toggleButton = screen.getByRole('button', { name: /Raw/i });
    fireEvent.click(toggleButton);

    expect(screen.getByText(airport.metar)).toBeInTheDocument();
  });

  it('displays numeric altitude for PIREPs with plain altitude value', () => {
    const pirep = {
      latitude: 35.0,
      longitude: -120.5,
      altitude: 15000,
      severity: 'MODERATE',
      phenomenon: ['TURB'],
      rawText: 'UA /OV LAX180030/TM 1523/FL150/TP BE36/TB MOD'
    };

    render(<MapPopup type="pirep" pirep={pirep} />);

    expect(screen.getByText(/15,000 ft/)).toBeInTheDocument();
    expect(screen.getByText(/MODERATE/)).toBeInTheDocument();
  });
});
