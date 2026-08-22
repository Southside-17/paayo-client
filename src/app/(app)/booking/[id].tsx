import { useFocusEffect, useLocalSearchParams } from 'expo-router';
import { useCallback, useState } from 'react';
import { ScrollView, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { FormMessage } from '@/components/form-message';
import { BackButton } from '@/components/back-button';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import { ScreenHeader } from '@/components/ui/screen-header';
import { Skeleton } from '@/components/ui/skeleton';
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
    const { id, name, provider } = useLocalSearchParams<{
        id: string;
        name?: string;
        provider?: string;
    }>();
    const session = useSession();
    const { busy, message, errorFor, submit } = useSubmit();
    const [booking, setBooking] = useState<Booking | null>(null);
    const [asking, setAsking] = useState(false);

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
                <BackButton label="Bookings" />
                <ScreenHeader
                    eyebrow={provider ?? booking?.provider.name}
                    title={name ?? booking?.service.name ?? 'Booking'}
                />

                <FormMessage message={message ?? errorFor('status') ?? null} />

                {booking === null ? (
                    <>
                        <Skeleton className="h-7 w-40 rounded-full" />
                        <Card className="gap-3">
                            <Skeleton className="h-4 w-full" />
                            <Skeleton className="h-4 w-full" />
                            <Skeleton className="h-4 w-3/4" />
                        </Card>
                        <Card className="gap-2">
                            <Skeleton className="h-5 w-36" />
                            <Skeleton className="h-4 w-full" />
                        </Card>
                    </>
                ) : null}

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
                            <Button
                                variant="outline"
                                onPress={() => setAsking(true)}
                                busy={busy}
                            >
                                Cancel this booking
                            </Button>
                        ) : null}
                    </>
                ) : null}

                {/* "Keep it" rather than "Cancel": on a dialog about
                    cancelling, a button reading Cancel means both things. */}
                <ConfirmDialog
                    open={asking}
                    title="Cancel this booking?"
                    body="Nobody will be sent. You can book the same work again afterwards."
                    confirm="Cancel booking"
                    dismiss="Keep it"
                    destructive
                    busy={busy}
                    onConfirm={() => {
                        setAsking(false);
                        void cancel();
                    }}
                    onDismiss={() => setAsking(false)}
                />
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
