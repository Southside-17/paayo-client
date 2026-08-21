import { fireEvent, render, screen } from '@testing-library/react-native';
import { useImperativeHandle, useState, type Ref } from 'react';
import { View } from 'react-native';

import { PinMap, type Pin } from '@/components/pin-map';

const mockSetCameraPosition = jest.fn();

/**
 * Stands in for the native view, recording the props it is handed.
 *
 * A hoisted function declaration, because the factory below runs while this
 * module is still being required and nothing declared with const exists yet.
 * It also keeps the JSX out of the factory, where NativeWind's rewrites reach
 * for a module-scoped helper that a hoisted factory is not allowed to touch.
 */
function MockMapView({ ref, ...props }: { ref?: Ref<unknown> }) {
    useImperativeHandle(ref, () => ({ setCameraPosition: mockSetCameraPosition }));

    return <View testID="map" {...props} />;
}

jest.mock('expo-maps', () => ({
    AppleMaps: { View: MockMapView },
    GoogleMaps: { View: MockMapView },
}));

beforeEach(() => mockSetCameraPosition.mockClear());

/** The map wired to state the way the address screen wires it. */
function Harness({ focus = null }: { focus?: Pin | null }) {
    const [pin, setPin] = useState<Pin | null>(null);

    return <PinMap pin={pin} focus={focus} onMove={setPin} />;
}

const tap = (latitude: number, longitude: number) =>
    fireEvent(screen.getByTestId('map'), 'mapClick', { coordinates: { latitude, longitude } });

it('drops the pin where the map was tapped', () => {
    render(<Harness />);

    tap(7.0731, 125.6128);

    expect(screen.getByTestId('map').props.markers).toEqual([
        { coordinates: { latitude: 7.0731, longitude: 125.6128 } },
    ]);
});

it('opens over the country when there is nothing to centre on', () => {
    render(<Harness />);

    expect(screen.getByTestId('map').props.cameraPosition).toEqual({
        coordinates: { latitude: 12.8797, longitude: 121.774 },
        zoom: 5,
    });
});

it('leaves the camera where it was when the pin moves', () => {
    render(<Harness />);

    const opening = screen.getByTestId('map').props.cameraPosition;

    tap(7.0731, 125.6128);
    tap(14.5995, 120.9842);

    expect(screen.getByTestId('map').props.cameraPosition).toBe(opening);
    expect(mockSetCameraPosition).not.toHaveBeenCalled();
});

it('moves the camera when something other than a tap asks it to', () => {
    const { rerender } = render(<Harness />);

    rerender(<Harness focus={{ latitude: 7.0731, longitude: 125.6128 }} />);

    expect(mockSetCameraPosition).toHaveBeenCalledWith({
        coordinates: { latitude: 7.0731, longitude: 125.6128 },
        zoom: 16,
    });
});
