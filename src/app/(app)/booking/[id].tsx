import { router, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { useCallback, useState } from 'react';
import { ScrollView, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { FormMessage } from '@/components/form-message';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { ScreenHeader } from '@/components/ui/screen-header';
import { StatusPill } from '@/components/ui/status-pill';
import { Text } from '@/components/ui/text';
import { when } from '@/app/(app)/(tabs)/bookings';
import { priceRange } from '@/lib/money';
import { useSession } from '@/lib/session';
import type { Booking } from '@/lib/types';
import { useSubmit } from '@/lib/use-submit';

/**
 * One booking: what was asked for, where it goes, and what it costs.
 */
export default function BookingDetail() {
    const { id } = useLocalSearchParams<{ id: string }>();
    const session = useSession();
    const { busy, message, errorFor, submit } = useSubmit();
    const [booking, setBooking] = useState<Booking | null>(null);

    const authenticatedRequest =
        session.status === 'authenticated' ? session.authenticatedRequest : null;

    useFocusEffect(
        useCallback(() => {
            if (!authenticatedRequest) {
                return;
            }

            void authenticatedRequest<{ data: Booking }>(`/bookings/${id}`)
                .then(({ data }) => setBooking(data))
                .catch(() => setBooking(null));
        }, [authenticatedRequest, id]),
    );

    if (session.status !== 'authenticated') {
        return null;
    }

    const cancel = () =>
        submit(async () => {
            const { data } = await session.authenticatedRequest<{ data: Booking }>(
                `/bookings/${id}/cancellation`,
                { method: 'POST' },
            );

            setBooking(data);
        });

    return (
        <SafeAreaView className="bg-background flex-1">
            <ScrollView contentContainerClassName="gap-5 p-6">
                <View className="flex-row items-start justify-between">
                    <ScreenHeader
                        eyebrow={booking?.provider.name}
                        title={booking?.service.name ?? 'Booking'}
                    />
                    <Button variant="ghost" onPress={() => router.back()}>
                        Done
                    </Button>
                </View>

                <FormMessage message={message ?? errorFor('status') ?? null} />

                {booking ? (
                    <>
                        <StatusPill tone={booking.status.tone}>{booking.status.wording}</StatusPill>

                        <Card className="gap-3">
                            <Detail label="When" value={when(booking.scheduled_at)} />
                            <Detail
                                label="Where"
                                value={String(booking.address.line ?? booking.address.label ?? '')}
                            />
                            <Detail
                                label="Price"
                                value={priceRange(
                                    booking.price_min,
                                    booking.price_max,
                                    booking.service.pricing_unit,
                                )}
                            />
                        </Card>

                        <Card className="gap-2">
                            <Text className="font-semibold">What you asked for</Text>
                            <Text className="text-muted-foreground text-sm">
                                {booking.description}
                            </Text>
                        </Card>

                        {booking.status.is_open ? (
                            <Button variant="outline" onPress={cancel} busy={busy}>
                                Cancel this booking
                            </Button>
                        ) : null}
                    </>
                ) : null}
            </ScrollView>
        </SafeAreaView>
    );
}

function Detail({ label, value }: { label: string; value: string }) {
    return (
        <View className="flex-row items-start justify-between gap-3">
            <Text className="text-muted-foreground shrink-0 text-sm">{label}</Text>
            <Text className="flex-1 text-right text-sm font-medium">{value}</Text>
        </View>
    );
}
