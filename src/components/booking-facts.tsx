import { View } from 'react-native';

import { PinMap } from '@/components/pin-map';
import { Card } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Text } from '@/components/ui/text';

/** The parts of an address worth reading back before someone is sent to it. */
export type Place = {
    label?: string | null;
    line?: string | null;
    landmark?: string | null;
    latitude?: number | null;
    longitude?: number | null;
};

/**
 * Who is coming. Never a control.
 *
 * Coverage decides this, and a client who could change it could pick somebody
 * who does not work where the job is -- which is the whole thing the zones
 * exist to prevent.
 */
export function WhoCard({ provider, note }: { provider: string; note?: string }) {
    return (
        <Card className="gap-1">
            <Label>Who is coming</Label>
            <Text className="text-lg font-semibold">{provider}</Text>
            {note ? <Text className="text-muted-foreground text-sm">{note}</Text> : null}
        </Card>
    );
}

/**
 * Where the work happens. Also never a control.
 *
 * The address is settled before a service is even chosen, because it is what
 * decided which services and which provider were offered. Changing it here
 * would quietly invalidate both.
 */
export function WhereCard({ place, map = true }: { place: Place; map?: boolean }) {
    const pin =
        typeof place.latitude === 'number' && typeof place.longitude === 'number'
            ? { latitude: place.latitude, longitude: place.longitude }
            : null;

    return (
        <Card className="gap-2">
            <Label>Where</Label>
            <Text className="text-lg font-semibold">{place.label ?? 'Your address'}</Text>

            {place.line ? (
                <Text className="text-muted-foreground text-sm">{place.line}</Text>
            ) : null}

            {place.landmark ? (
                <View className="flex-row gap-1.5">
                    <Text className="text-muted-foreground text-sm">Landmark:</Text>
                    <Text className="flex-1 text-sm">{place.landmark}</Text>
                </View>
            ) : null}

            {map && pin ? <PinMap pin={pin} focus={pin} className="mt-1 h-40" /> : null}

            {map && !pin ? (
                <Text className="text-warning text-sm">
                    This address has no pin, so nobody can be matched to it.
                </Text>
            ) : null}
        </Card>
    );
}
