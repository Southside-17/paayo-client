import { AppleMaps, GoogleMaps } from 'expo-maps';
import { useEffect, useRef, useState } from 'react';
import { Platform, View } from 'react-native';

import { Text } from '@/components/ui/text';
import { cn } from '@/lib/utils';

export type Pin = { latitude: number; longitude: number };

type Props = {
    pin: Pin | null;
    /** Where to aim the camera. A new object moves it; dropping a pin does not. */
    focus: Pin | null;
    /** Omitted for a preview: the map then shows the pin and takes no input. */
    onMove?: (pin: Pin) => void;
    className?: string;
};

/** Roughly the middle of the Philippines, for a map with nothing to centre on. */
const FALLBACK: Pin = { latitude: 12.8797, longitude: 121.774 };

const STREET_ZOOM = 16;
const COUNTRY_ZOOM = 5;

/**
 * A map you tap to place the pin.
 *
 * expo-maps is two components rather than one -- AppleMaps on iOS, GoogleMaps on
 * Android -- and neither renders on the other platform, so the choice is made
 * here and every screen above stays platform blind.
 */
export function PinMap({ pin, focus, onMove, className = 'h-56' }: Props) {
    const map = useRef<AppleMaps.MapView & GoogleMaps.MapView>(null);

    // cameraPosition is the camera the view opens with, not one it keeps in step
    // with a prop. Recomputing it per render is what made every tap snap the map
    // back over the pin at full zoom, so it is read once and then left alone.
    const [openingCamera] = useState(() => ({
        coordinates: focus ?? FALLBACK,
        zoom: focus ? STREET_ZOOM : COUNTRY_ZOOM,
    }));

    // The camera moves only when something other than a tap asks it to: an
    // address arriving from the server, or a fix read off the device.
    useEffect(() => {
        if (focus !== null) {
            map.current?.setCameraPosition({ coordinates: focus, zoom: STREET_ZOOM });
        }
    }, [focus]);

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
            className={cn('overflow-hidden rounded-lg', className)}
            pointerEvents={interactive ? 'auto' : 'none'}
        >
            <MapView
                ref={map}
                style={{ flex: 1 }}
                cameraPosition={openingCamera}
                markers={pin === null ? [] : [{ coordinates: pin }]}
                onMapClick={({ coordinates }) => {
                    const { latitude, longitude } = coordinates ?? {};

                    if (typeof latitude === 'number' && typeof longitude === 'number') {
                        onMove?.({ latitude, longitude });
                    }
                }}
            />
        </View>
    );
}
