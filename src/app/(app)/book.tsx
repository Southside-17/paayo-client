import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { Pressable, ScrollView, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { when } from '@/app/(app)/(tabs)/bookings';
import { BackButton } from '@/components/back-button';
import { WhereCard, WhoCard } from '@/components/booking-facts';
import { FormMessage } from '@/components/form-message';
import { MediaPicker, readyIds, stillSending, type MediaItem } from '@/components/media-picker';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import { FieldError } from '@/components/ui/field-error';
import { Input } from '@/components/ui/input';
import { KeyboardAvoiding } from '@/components/ui/keyboard-avoiding';
import { Label } from '@/components/ui/label';
import { ScreenHeader } from '@/components/ui/screen-header';
import { Skeleton } from '@/components/ui/skeleton';
import { Text } from '@/components/ui/text';
import { useSession } from '@/lib/session';
import type { Booking } from '@/lib/types';
import { useDefaultAddress } from '@/lib/use-default-address';
import { useSubmit } from '@/lib/use-submit';
import { cn } from '@/lib/utils';

/** The next seven days, as the chips a day is chosen from. */
function days(): Date[] {
    const today = new Date();

    return Array.from({ length: 7 }, (_, at) => {
        const day = new Date(today);
        day.setDate(today.getDate() + at);

        return day;
    });
}

/**
 * The hours work is offered at.
 *
 * Fixed slots rather than a clock: a technician's day is booked in blocks, and
 * a free-typed time invites 3:47 in the morning.
 */
const HOURS = [8, 10, 13, 15, 17];

function label(hour: number): string {
    const suffix = hour < 12 ? 'AM' : 'PM';
    const shown = hour <= 12 ? hour : hour - 12;

    return `${shown}:00 ${suffix}`;
}

/** The fields this screen refuses on its own, before the server is asked. */
type Missing = { description?: string; attachments?: string };

/**
 * Ask for the work at a time.
 *
 * Who and where are settled before this screen and are shown, not chosen. The
 * address decided which services were offered and which provider covers them,
 * so letting it change here would quietly invalidate both.
 */
export default function Book() {
    const { listing, service, category, provider, covered } = useLocalSearchParams<{
        listing: string;
        service?: string;
        category?: string;
        provider?: string;
        /** '1' when coverage chose them, absent when the client did. */
        covered?: string;
    }>();
    const session = useSession();
    const { address, ready } = useDefaultAddress();
    const { busy, message, errorFor, submit } = useSubmit();
    const [day, setDay] = useState(() => days()[1]);
    const [hour, setHour] = useState(HOURS[1]);
    const [description, setDescription] = useState('');
    const [media, setMedia] = useState<MediaItem[]>([]);
    const [missing, setMissing] = useState<Missing>({});
    const [asking, setAsking] = useState(false);

    if (session.status !== 'authenticated') {
        return null;
    }

    const scheduledAt = () => {
        const scheduled = new Date(day);
        scheduled.setHours(hour, 0, 0, 0);

        return scheduled;
    };

    const place = () =>
        submit(async () => {
            const { data } = await session.authenticatedRequest<{ data: Booking }>('/bookings', {
                method: 'POST',
                body: {
                    listing_id: listing,
                    address_id: address?.id,
                    scheduled_at: scheduledAt().toISOString(),
                    description,
                    attachments: readyIds(media),
                },
            });

            // Whatever is underneath -- the trade, and the picker when there was
            // one -- would lead back into booking the same work again. Clear it,
            // land on Bookings, then show the one just placed.
            if (router.canDismiss()) {
                router.dismissAll();
            }

            router.replace('/bookings');
            router.push({
                pathname: '/booking/[id]',
                params: {
                    id: data.id,
                    name: data.service.name,
                    provider: data.provider.name,
                },
            });
        });

    /** Everything the server would refuse, said before it is asked. */
    const ask = () => {
        const found: Missing = {};

        if (readyIds(media).length === 0) {
            found.attachments = stillSending(media)
                ? 'Wait for the upload to finish.'
                : 'Add a photo or a video of the issue.';
        }

        if (description.trim() === '') {
            found.description = 'Say what needs doing.';
        }

        setMissing(found);

        if (Object.keys(found).length > 0) {
            return;
        }

        setAsking(true);
    };

    /** What is wrong with a field: ours until the server has its own say. */
    const wrong = (field: keyof Missing) => missing[field] ?? errorFor(field);

    /** Clear a field's complaint the moment it is answered. */
    const answered = (field: keyof Missing) =>
        setMissing((held) => ({ ...held, [field]: undefined }));

    const asked = [provider, 'will be asked to come on', when(scheduledAt().toISOString())]
        .filter(Boolean)
        .join(' ')
        .concat('.');

    return (
        <SafeAreaView className="bg-background flex-1">
            <KeyboardAvoiding className="flex-1">
                <ScrollView
                    contentContainerClassName="gap-5 p-6"
                    keyboardShouldPersistTaps="handled"
                >
                    {/* Back names the trade this came from; the eyebrow names
                        the work. Between them the screen says what was chosen
                        to get here. */}
                    <BackButton label={category || service || 'Back'} />
                    <ScreenHeader eyebrow={service} title="Book" />

                    <FormMessage message={message ?? errorFor('listing_id') ?? null} />

                    {provider ? (
                        <WhoCard
                            provider={provider}
                            note={
                                covered === '1'
                                    ? 'They cover your area for this service.'
                                    : 'They work elsewhere in your area and may add a travel charge when they accept.'
                            }
                        />
                    ) : null}

                    {!ready ? (
                        <Card className="gap-2">
                            <Skeleton className="h-5 w-24" />
                            <Skeleton className="h-4 w-3/4" />
                        </Card>
                    ) : null}

                    {ready && address ? <WhereCard place={address} /> : null}

                    {ready && !address ? (
                        <Card className="gap-2">
                            <Label>Where is the work?</Label>
                            <Text className="text-warning text-sm">
                                No address on this account, so there is nowhere to send anyone.
                            </Text>
                        </Card>
                    ) : null}

                    <FieldError message={errorFor('address_id')} />

                    <Card className="gap-3">
                        <Label>When are they coming?</Label>
                        <View className="flex-row flex-wrap gap-2">
                            {days().map((option) => {
                                const chosen = option.toDateString() === day.toDateString();

                                return (
                                    <Pressable
                                        key={option.toISOString()}
                                        accessibilityRole="button"
                                        onPress={() => setDay(option)}
                                        className={cn(
                                            'rounded-full border px-3 py-2',
                                            chosen
                                                ? 'border-brand bg-brand-subtle'
                                                : 'border-border bg-card',
                                        )}
                                    >
                                        <Text
                                            className={cn(
                                                'text-sm font-medium',
                                                chosen && 'text-brand',
                                            )}
                                        >
                                            {option.toLocaleDateString('en-PH', {
                                                weekday: 'short',
                                                day: 'numeric',
                                                month: 'short',
                                            })}
                                        </Text>
                                    </Pressable>
                                );
                            })}
                        </View>

                        <View className="flex-row flex-wrap gap-2">
                            {HOURS.map((option) => (
                                <Pressable
                                    key={option}
                                    accessibilityRole="button"
                                    onPress={() => setHour(option)}
                                    className={cn(
                                        'rounded-full border px-3 py-2',
                                        option === hour
                                            ? 'border-brand bg-brand-subtle'
                                            : 'border-border bg-card',
                                    )}
                                >
                                    <Text
                                        className={cn(
                                            'text-sm font-medium',
                                            option === hour && 'text-brand',
                                        )}
                                    >
                                        {label(option)}
                                    </Text>
                                </Pressable>
                            ))}
                        </View>
                        <FieldError message={errorFor('scheduled_at')} />
                    </Card>

                    <Card className="gap-2">
                        <Label>What does it look like?</Label>
                        <MediaPicker
                            send={session.authenticatedRequest}
                            items={media}
                            onChange={(update) => {
                                setMedia(update);
                                answered('attachments');
                            }}
                            disabled={busy}
                            invalid={Boolean(wrong('attachments'))}
                        />
                        <Text className="text-muted-foreground text-sm">
                            A photo or a short video of the issue.
                        </Text>
                        <FieldError message={wrong('attachments')} />
                    </Card>

                    <Card className="gap-2">
                        <Label>Why are they coming?</Label>
                        <Input
                            value={description}
                            onChangeText={(value) => {
                                setDescription(value);
                                answered('description');
                            }}
                            placeholder="The unit drips and smells damp."
                            multiline
                            numberOfLines={4}
                            className="h-24"
                            invalid={Boolean(wrong('description'))}
                        />
                        <Text className="text-muted-foreground text-sm">
                            What is wrong, and anything they should know before they arrive.
                        </Text>
                        <FieldError message={wrong('description')} />
                    </Card>

                    <Button variant="brand" onPress={ask} busy={busy}>
                        Place booking
                    </Button>

                    <ConfirmDialog
                        open={asking}
                        title="Place this booking?"
                        body={asked}
                        confirm="Place booking"
                        dismiss="Not yet"
                        busy={busy}
                        onConfirm={() => {
                            setAsking(false);
                            void place();
                        }}
                        onDismiss={() => setAsking(false)}
                    />
                </ScrollView>
            </KeyboardAvoiding>
        </SafeAreaView>
    );
}
