import { fireEvent, render, screen } from '@testing-library/react-native';
import type React from 'react';
import { useImperativeHandle, useState, type Ref } from 'react';
import { Platform, View } from 'react-native';

import { PinMap, type Pin } from '@/components/pin-map';

const mockSetCameraPosition = jest.fn();

/**
 * Stands in for the native view, recording the props it is handed.
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

/** The height booking-facts draws the map at, in density-independent pixels. */
const CARD_HEIGHT = 160;

/**
 * Render and hand the frame a height, which is what a phone does on first paint.
 */
function draw(element: React.ReactElement, height = CARD_HEIGHT) {
    const result = render(element);

    fireEvent(screen.getByTestId('map-frame'), 'layout', {
        nativeEvent: { layout: { height, width: 336 } },
    });

    return result;
}

const tap = (latitude: number, longitude: number) =>
    fireEvent(screen.getByTestId('map'), 'mapClick', { coordinates: { latitude, longitude } });

it('drops the pin where the map was tapped', () => {
    draw(<Harness />);

    tap(7.0731, 125.6128);

    expect(screen.getByTestId('map').props.markers).toEqual([
        { coordinates: { latitude: 7.0731, longitude: 125.6128 } },
    ]);
});

it('opens over the country when there is nothing to centre on', () => {
    draw(<Harness />);

    expect(screen.getByTestId('map').props.cameraPosition).toEqual({
        coordinates: { latitude: 12.8797, longitude: 121.774 },
        zoom: 5,
    });
});

it('leaves the camera where it was when the pin moves', () => {
    draw(<Harness />);

    const opening = screen.getByTestId('map').props.cameraPosition;

    tap(7.0731, 125.6128);
    tap(14.5995, 120.9842);

    expect(screen.getByTestId('map').props.cameraPosition).toBe(opening);
    expect(mockSetCameraPosition).not.toHaveBeenCalled();
});

it('moves the camera when something other than a tap asks it to', () => {
    const { rerender } = draw(<Harness />);

    rerender(<Harness focus={{ latitude: 7.0731, longitude: 125.6128 }} />);

    expect(mockSetCameraPosition).toHaveBeenCalledWith({
        coordinates: { latitude: 7.0731, longitude: 125.6128 },
        zoom: 16,
    });
});

// Calling setCameraPosition on mount is rejected by the native view, whose
// cameraState is a lateinit property that is not ready yet -- it surfaced as an
// endless "Uncaught (in promise)" on every screen carrying a map.
it('never commands the camera on mount, since cameraPosition already placed it', () => {
    const pin = { latitude: 7.0731, longitude: 125.6128 };

    draw(<PinMap pin={pin} focus={pin} />);

    expect(screen.getByTestId('map').props.cameraPosition).toEqual({ coordinates: pin, zoom: 16 });
    expect(mockSetCameraPosition).not.toHaveBeenCalled();
});

// Every caller builds `focus` inline, so the object identity changes on each
// render while the place does not. Keying the effect on identity re-aimed the
// camera continuously.
it('ignores a re-render that hands over the same place in a new object', () => {
    const { rerender } = draw(<Harness />);

    rerender(<Harness focus={{ latitude: 7.0731, longitude: 125.6128 }} />);
    expect(mockSetCameraPosition).toHaveBeenCalledTimes(1);

    rerender(<Harness focus={{ latitude: 7.0731, longitude: 125.6128 }} />);
    rerender(<Harness focus={{ latitude: 7.0731, longitude: 125.6128 }} />);

    expect(mockSetCameraPosition).toHaveBeenCalledTimes(1);
});

it('still moves when the place itself changes', () => {
    const { rerender } = draw(<Harness />);

    rerender(<Harness focus={{ latitude: 7.0731, longitude: 125.6128 }} />);
    rerender(<Harness focus={{ latitude: 14.5995, longitude: 120.9842 }} />);

    expect(mockSetCameraPosition).toHaveBeenCalledTimes(2);
    expect(mockSetCameraPosition).toHaveBeenLastCalledWith({
        coordinates: { latitude: 14.5995, longitude: 120.9842 },
        zoom: 16,
    });
});

// A rejected call is a native view that is not ready, not a broken app.
it('swallows a rejection from a native view that is not ready', () => {
    mockSetCameraPosition.mockRejectedValueOnce(new Error('cameraState has not been initialized'));

    const { rerender } = draw(<Harness />);

    expect(() =>
        rerender(<Harness focus={{ latitude: 7.0731, longitude: 125.6128 }} />),
    ).not.toThrow();
});

// The two maps read `zoom` differently: expo-maps hands Apple a region spanning
// 360/2^zoom degrees, while Google shows 360 x width/(256 x 2^zoom). Sharing the
// number frames noticeably different amounts of ground on each platform.
it('frames the same ground on Android, which needs a shallower zoom', () => {
    const replaced = jest.replaceProperty(Platform, 'OS', 'android');
    const pin = { latitude: 7.0731, longitude: 125.6128 };

    draw(<PinMap pin={pin} focus={pin} />);

    // log2(160 / 256) = -0.678, so a 160dp map opens at 16 - 0.678.
    expect(screen.getByTestId('map').props.cameraPosition.zoom).toBeCloseTo(15.322, 3);

    replaced.restore();
});

it('leaves the iOS zoom alone, since it is the one being matched', () => {
    const pin = { latitude: 7.0731, longitude: 125.6128 };

    draw(<PinMap pin={pin} focus={pin} />);

    expect(screen.getByTestId('map').props.cameraPosition.zoom).toBe(16);
});

it('draws a circle and no marker when the pin carries a radius', () => {
    const pin = { latitude: 7.07, longitude: 125.61 };

    draw(<PinMap pin={pin} focus={pin} radius={300} />);

    const map = screen.getByTestId('map');

    expect(map.props.markers).toEqual([]);
    expect(map.props.circles).toEqual([
        expect.objectContaining({ center: pin, radius: 300 }),
    ]);
});

// A pin already on a grid line is left where it is, so the coarse pin and the
// real one are the same point. The circle is the only thing that says so.
it('still draws the circle where snapping moved the pin nowhere', () => {
    const onGrid = { latitude: 7.07, longitude: 125.61 };

    draw(<PinMap pin={onGrid} focus={onGrid} radius={300} />);

    expect(screen.getByTestId('map').props.circles).toHaveLength(1);
});

it('draws a marker and no circle once the radius is gone', () => {
    const pin = { latitude: 7.0731, longitude: 125.6128 };

    draw(<PinMap pin={pin} focus={pin} radius={null} />);

    const map = screen.getByTestId('map');

    expect(map.props.markers).toEqual([{ coordinates: pin }]);
    expect(map.props.circles).toEqual([]);
});
