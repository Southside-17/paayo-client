import { AppleMaps, GoogleMaps } from 'expo-maps';
import { Platform, View } from 'react-native';

import { Text } from '@/components/ui/text';

type Props = {
    latitude: number | null;
    longitude: number | null;
    onMove: (latitude: number, longitude: number) => void;
};

/** Roughly the middle of the Philippines, for a map with nothing to centre on. */
const FALLBACK = { latitude: 12.8797, longitude: 121.774 };

/**
 * A map you tap to place the pin.
 *
 * expo-maps is two components rather than one -- AppleMaps on iOS, GoogleMaps on
 * Android -- and neither renders on the other platform, so the choice is made
 * here and every screen above stays platform blind.
 */
export function PinMap({ latitude, longitude, onMove }: Props) {
    const pinned = latitude !== null && longitude !== null;
    const centre = pinned ? { latitude, longitude } : FALLBACK;

    const camera = { coordinates: centre, zoom: pinned ? 16 : 5 };
    const markers = pinned ? [{ coordinates: { latitude, longitude } }] : [];

    const onMapClick = (event: { coordinates?: { latitude?: number; longitude?: number } }) => {
        const { latitude: tappedLatitude, longitude: tappedLongitude } = event.coordinates ?? {};

        if (typeof tappedLatitude === 'number' && typeof tappedLongitude === 'number') {
            onMove(tappedLatitude, tappedLongitude);
        }
    };

    if (Platform.OS !== 'ios' && Platform.OS !== 'android') {
        return (
            <View className="bg-muted h-56 items-center justify-center rounded-lg">
                <Text className="text-muted-foreground text-sm">
                    Maps are only drawn on a phone. Type the coordinates instead.
                </Text>
            </View>
        );
    }

    const View_ = Platform.OS === 'ios' ? AppleMaps.View : GoogleMaps.View;

    return (
        <View className="h-56 overflow-hidden rounded-lg">
            <View_
                style={{ flex: 1 }}
                cameraPosition={camera}
                markers={markers}
                onMapClick={onMapClick}
            />
        </View>
    );
}
