import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { Pressable, ScrollView, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { FormMessage } from '@/components/form-message';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { FieldError } from '@/components/ui/field-error';
import { Input } from '@/components/ui/input';
import { KeyboardAvoiding } from '@/components/ui/keyboard-avoiding';
import { Label } from '@/components/ui/label';
import { ScreenHeader } from '@/components/ui/screen-header';
import { Text } from '@/components/ui/text';
import { useSession } from '@/lib/session';
import type { Address, Booking } from '@/lib/types';
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

/**
 * Ask for a provider's work at a time and a place.
 */
export default function Book() {
    const { listing } = useLocalSearchParams<{ listing: string }>();
    const session = useSession();
    const { busy, message, errorFor, submit } = useSubmit();
    const [addresses, setAddresses] = useState<Address[] | null>(null);
    const [addressId, setAddressId] = useState('');
    const [day, setDay] = useState(() => days()[1]);
    const [hour, setHour] = useState(HOURS[1]);
    const [description, setDescription] = useState('');

    const authenticatedRequest =
        session.status === 'authenticated' ? session.authenticatedRequest : null;

    useEffect(() => {
        if (!authenticatedRequest) {
            return;
        }

        void authenticatedRequest<{ data: Address[] }>('/addresses')
            .then(({ data }) => {
                setAddresses(data);
                setAddressId((data.find((address) => address.is_default) ?? data[0])?.id ?? '');
            })
            .catch(() => setAddresses([]));
    }, [authenticatedRequest]);

    if (session.status !== 'authenticated') {
        return null;
    }

    const place = () =>
        submit(async () => {
            const scheduled = new Date(day);
            scheduled.setHours(hour, 0, 0, 0);

            const { data } = await session.authenticatedRequest<{ data: Booking }>('/bookings', {
                method: 'POST',
                body: {
                    listing_id: listing,
                    address_id: addressId,
                    scheduled_at: scheduled.toISOString(),
                    description,
                },
            });

            router.replace(`/booking/${data.id}`);
        });

    return (
        <SafeAreaView className="bg-background flex-1">
            <KeyboardAvoiding className="flex-1">
                <ScrollView
                    contentContainerClassName="gap-5 p-6"
                    keyboardShouldPersistTaps="handled"
                >
                    <View className="flex-row items-center justify-between">
                        <ScreenHeader title="Book" />
                        <Button variant="ghost" onPress={() => router.back()}>
                            Cancel
                        </Button>
                    </View>

                    <FormMessage message={message ?? errorFor('listing_id') ?? null} />

                    <Card className="gap-3">
                        <Label>Where</Label>
                        <View className="flex-row flex-wrap gap-2">
                            {addresses?.map((address) => (
                                <Pressable
                                    key={address.id}
                                    accessibilityRole="button"
                                    onPress={() => setAddressId(address.id)}
                                    className={cn(
                                        'rounded-full border px-3 py-2',
                                        address.id === addressId
                                            ? 'border-brand bg-brand-subtle'
                                            : 'border-border bg-card',
                                    )}
                                >
                                    <Text
                                        className={cn(
                                            'text-sm font-medium',
                                            address.id === addressId && 'text-brand',
                                        )}
                                    >
                                        {address.label}
                                    </Text>
                                </Pressable>
                            ))}
                        </View>
                        {addresses?.length === 0 ? (
                            <Text className="text-muted-foreground text-sm">
                                Add an address before booking.
                            </Text>
                        ) : null}
                        <FieldError message={errorFor('address_id')} />
                    </Card>

                    <Card className="gap-3">
                        <Label>When</Label>
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
                        <Label>What needs doing</Label>
                        <Input
                            value={description}
                            onChangeText={setDescription}
                            placeholder="The unit drips and smells damp."
                            multiline
                            numberOfLines={4}
                            className="h-24"
                            invalid={Boolean(errorFor('description'))}
                        />
                        <FieldError message={errorFor('description')} />
                    </Card>

                    <Button variant="brand" onPress={place} busy={busy}>
                        Place booking
                    </Button>
                </ScrollView>
            </KeyboardAvoiding>
        </SafeAreaView>
    );
}
