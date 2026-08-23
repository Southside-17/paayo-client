import { AppleMaps, GoogleMaps } from 'expo-maps';
import { useColorScheme } from 'nativewind';
import { useEffect, useRef, useState } from 'react';
import { Platform, View } from 'react-native';

import { Text } from '@/components/ui/text';
import { cn } from '@/lib/utils';
import palette from '@/theme/palette';

export type Pin = { latitude: number; longitude: number };

type Props = {
    pin: Pin | null;
    /** Where to aim the camera. A new object moves it; dropping a pin does not. */
    focus: Pin | null;
    /** Metres the real place can be from `pin`, drawn as a circle, not a marker. */
    radius?: number | null;
    /** Omitted for a preview: the map then shows the pin and takes no input. */
    onMove?: (pin: Pin) => void;
    className?: string;
};

/** Roughly the middle of the Philippines, for a map with nothing to centre on. */
const FALLBACK: Pin = { latitude: 12.8797, longitude: 121.774 };

const STREET_ZOOM = 16;
const AREA_ZOOM = 14;
const COUNTRY_ZOOM = 5;

/** The tile size Google Maps counts a zoom level in, in density-independent pixels. */
const TILE = 256;

/**
 * What Android must add to an iOS zoom to frame the same ground in this view.
 */
function mercatorOffset(height: number | null): number {
    return Platform.OS === 'android' && height !== null && height > 0
        ? Math.log2(height / TILE)
        : 0;
}

/**
 * A map you tap to place the pin.
 */
export function PinMap({ pin, focus, radius, onMove, className = 'h-56' }: Props) {
    const map = useRef<AppleMaps.MapView & GoogleMaps.MapView>(null);
    const { colorScheme } = useColorScheme();
    const colours = palette[colorScheme ?? 'light'];
    const area = typeof radius === 'number' && radius > 0;

    // Measured rather than assumed: the offset is a function of how tall the map
    // is, and PinMap is drawn at two heights.
    const [height, setHeight] = useState<number | null>(null);
    const reach = (area ? AREA_ZOOM : STREET_ZOOM) + mercatorOffset(height);

    // cameraPosition is the camera the view opens with, not one it keeps in step
    // with a prop. Recomputing it per render is what made every tap snap the map
    // back over the pin at full zoom, so it is settled once the height is known
    // and then left alone.
    const [openingCamera, setOpeningCamera] = useState<{ coordinates: Pin; zoom: number } | null>(
        null,
    );

    // Where the camera has already been sent, compared by value: callers build
    // `focus` inline, so a re-render hands over a new object for the same place.
    const aimed = useRef(focus ?? FALLBACK);
    const latitude = focus?.latitude ?? null;
    const longitude = focus?.longitude ?? null;

    // The camera moves only when something other than a tap asks it to: an
    // address arriving from the server, or a fix read off the device. Never on
    // mount -- cameraPosition has already put it there, and the native view has
    // not finished initialising, so the call is rejected.
    useEffect(() => {
        if (latitude === null || longitude === null) {
            return;
        }

        if (latitude === aimed.current.latitude && longitude === aimed.current.longitude) {
            return;
        }

        aimed.current = { latitude, longitude };

        Promise.resolve(
            map.current?.setCameraPosition({ coordinates: { latitude, longitude }, zoom: reach }),
        ).catch(() => {});
    }, [latitude, longitude, reach]);

    if (Platform.OS !== 'ios' && Platform.OS !== 'android') {
        return (
            <View className={cn('bg-muted items-center justify-center rounded-lg', className)}>
                <Text className="text-muted-foreground text-sm">
                    Maps are only drawn on a phone.
                </Text>
            </View>
        );
    }

    const MapView = Platform.OS === 'ios' ? AppleMaps.View : GoogleMaps.View;

    // A preview takes no input at all. pointerEvents rather than uiSettings:
    // AppleMapsUISettings has no gesture toggles, so the Google-shaped object
    // that would lock the map on Android does nothing on iOS. This holds on
    // both, and it keeps a scroll that begins on the map scrolling the screen.
    const interactive = onMove !== undefined;

    return (
        <View
            testID="map-frame"
            className={cn('overflow-hidden rounded-lg', className)}
            pointerEvents={interactive ? 'auto' : 'none'}
            onLayout={({ nativeEvent }) => {
                const measured = nativeEvent.layout.height;

                setHeight((known) => known ?? measured);
                setOpeningCamera(
                    (settled) =>
                        settled ?? {
                            coordinates: focus ?? FALLBACK,
                            zoom: focus
                                ? (area ? AREA_ZOOM : STREET_ZOOM) + mercatorOffset(measured)
                                : COUNTRY_ZOOM,
                        },
                );
            }}
        >
            {openingCamera === null ? null : (
            <MapView
                ref={map}
                style={{ flex: 1 }}
                cameraPosition={openingCamera}
                markers={pin === null || area ? [] : [{ coordinates: pin }]}
                circles={
                    pin === null || !area
                        ? []
                        : [
                              {
                                  center: pin,
                                  radius: radius as number,
                                  color: colours['brand-subtle'],
                                  lineColor: colours.brand,
                                  lineWidth: 2,
                              },
                          ]
                }
                onMapClick={({ coordinates }) => {
                    const { latitude, longitude } = coordinates ?? {};

                    if (typeof latitude === 'number' && typeof longitude === 'number') {
                        onMove?.({ latitude, longitude });
                    }
                }}
            />
            )}
        </View>
    );
}
