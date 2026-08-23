import ExternalLink from 'lucide-react-native/icons/external-link';
import { useColorScheme } from 'nativewind';
import { useState } from 'react';
import { Linking, Platform, Pressable, View } from 'react-native';

import { PinMap } from '@/components/pin-map';
import { Card } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Text } from '@/components/ui/text';
import { cn } from '@/lib/utils';
import palette from '@/theme/palette';

/**
 * Who is reading the card.
 *
 * One booking is read from both ends, and the words are not the same from both
 * ends: the client is waiting for somebody, the business is the somebody.
 */
export type Audience = 'client' | 'provider';

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
            <Label>Who is coming?</Label>
            <Text className="text-lg font-semibold">{provider}</Text>
            {note ? <Text className="text-muted-foreground text-sm">{note}</Text> : null}
        </Card>
    );
}

/**
 * The pin as whichever maps app the phone actually uses will take it.
 *
 * `geo:` hands Android's chooser the point, which is the whole reason to leave:
 * getting there is not this app's job, and the person already has the app they
 * navigate with. Apple has no equivalent scheme, so iOS gets the maps.apple.com
 * link, which opens the app rather than the browser.
 */
function mapsUrl(pin: { latitude: number; longitude: number }, name: string): string {
    const at = `${pin.latitude},${pin.longitude}`;
    const label = encodeURIComponent(name);

    return Platform.OS === 'ios'
        ? `http://maps.apple.com/?ll=${at}&q=${label}`
        : `geo:${at}?q=${at}(${label})`;
}

/**
 * Where the work happens. Also never a control.
 */
export function WhereCard({
    place,
    map = true,
    audience = 'client',
    approximate = false,
}: {
    place: Place;
    map?: boolean;
    audience?: Audience;
    /** The pin is the coarse one the server sends before a job is taken. */
    approximate?: boolean;
}) {
    const { colorScheme } = useColorScheme();
    const colours = palette[colorScheme ?? 'light'];
    const [unopened, setUnopened] = useState(false);
    const business = audience === 'provider';
    const pin =
        typeof place.latitude === 'number' && typeof place.longitude === 'number'
            ? { latitude: place.latitude, longitude: place.longitude }
            : null;

    return (
        <Card className="gap-2">
            <View className="flex-row items-center justify-between gap-3">
                <Label>{business ? 'Where is the job?' : 'Where is the trouble?'}</Label>

                {/* Our map is a picture. Directions belong to the app the
                    person already navigates with. */}
                {pin ? (
                    <Pressable
                        accessibilityRole="button"
                        onPress={() => {
                            setUnopened(false);

                            void Linking.openURL(
                                mapsUrl(pin, place.line ?? place.label ?? 'Paayo'),
                            ).catch(() => setUnopened(true));
                        }}
                        className="-mt-1.5 flex-row items-center gap-1 py-1"
                    >
                        <Text className="text-brand text-[13px] font-medium">Open in Maps</Text>
                        <ExternalLink color={colours.brand} size={14} />
                    </Pressable>
                ) : null}
            </View>

            {unopened ? (
                <Text className="text-warning text-sm">
                    No maps app on this phone answered.
                </Text>
            ) : null}

            <Text className="text-lg font-semibold">
                {place.label ?? (business ? "The client's address" : 'Your address')}
            </Text>

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

            {map && pin && approximate ? (
                <Text className="text-muted-foreground text-sm">
                    The pin is approximate until you take the job.
                </Text>
            ) : null}

            {map && !pin ? (
                <Text className="text-warning text-sm">
                    {business
                        ? 'This job has no pin, so there is no map to follow.'
                        : 'This address has no pin, so nobody can be matched to it.'}
                </Text>
            ) : null}
        </Card>
    );
}

/** The week reads Monday first, the way a wall calendar does here. */
const WEEKDAYS = ['M', 'T', 'W', 'T', 'F', 'S', 'S'];

/** The hour of a visit, short enough to sit inside a date square. */
function clock(at: Date): string {
    const minutes = at.getMinutes();
    const hour = at.getHours() % 12 || 12;
    const suffix = at.getHours() < 12 ? 'AM' : 'PM';

    return minutes === 0
        ? `${hour}${suffix}`
        : `${hour}:${String(minutes).padStart(2, '0')}${suffix}`;
}

/**
 * When someone is coming, drawn as the week the visit falls in.
 */
export function WhenCard({
    scheduled,
    audience = 'client',
}: {
    scheduled: string;
    audience?: Audience;
}) {
    const visit = new Date(scheduled);
    const monday = new Date(visit);

    monday.setHours(0, 0, 0, 0);
    monday.setDate(visit.getDate() - ((visit.getDay() + 6) % 7));

    const week = Array.from({ length: 7 }, (_, step) => {
        const day = new Date(monday);
        day.setDate(monday.getDate() + step);

        return day;
    });

    return (
        <Card className="gap-2">
            <Label>
                {audience === 'provider' ? 'When are you expected?' : 'When are they arriving?'}
            </Label>
            <Text className="text-lg font-semibold">
                {visit.toLocaleDateString('en-PH', {
                    weekday: 'long',
                    day: 'numeric',
                    month: 'long',
                })}
            </Text>

            <View className="mt-1 flex-row gap-1">
                {WEEKDAYS.map((letter, step) => (
                    <Text
                        key={step}
                        className="text-muted-foreground flex-1 text-center text-[11px] font-medium"
                    >
                        {letter}
                    </Text>
                ))}
            </View>

            <View className="flex-row gap-1">
                {week.map((day) => {
                    const chosen = day.toDateString() === visit.toDateString();

                    return (
                        <View
                            key={day.toISOString()}
                            className={cn(
                                'h-14 flex-1 items-center justify-center gap-0.5 rounded-lg border',
                                chosen ? 'border-brand bg-brand-subtle' : 'border-transparent',
                            )}
                        >
                            <Text
                                className={cn(
                                    'text-sm font-semibold',
                                    chosen ? 'text-brand' : 'text-muted-foreground',
                                )}
                            >
                                {day.getDate()}
                            </Text>

                            {chosen ? (
                                <Text className="text-brand text-[10px] font-medium">
                                    {clock(visit)}
                                </Text>
                            ) : null}
                        </View>
                    );
                })}
            </View>
        </Card>
    );
}
