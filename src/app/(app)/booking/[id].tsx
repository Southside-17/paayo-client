import { useFocusEffect, useLocalSearchParams } from 'expo-router';
import { useCallback, useState } from 'react';
import { Pressable, ScrollView, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { BackButton } from '@/components/back-button';
import { WhenCard, WhereCard, WhoCard } from '@/components/booking-facts';
import { FormMessage } from '@/components/form-message';
import { MediaThumb } from '@/components/media-thumb';
import { MediaViewer, type Viewable } from '@/components/media-viewer';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import { Label } from '@/components/ui/label';
import { ScreenHeader } from '@/components/ui/screen-header';
import { Skeleton } from '@/components/ui/skeleton';
import { StatusPill } from '@/components/ui/status-pill';
import { Text } from '@/components/ui/text';
import { attachmentUrl } from '@/lib/api';
import { peso, priceRange } from '@/lib/money';
import { useSession } from '@/lib/session';
import type { Booking } from '@/lib/types';
import { useSubmit } from '@/lib/use-submit';

/**
 * One booking: what it costs, who is coming, where, when, and what was sent.
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
    const [viewing, setViewing] = useState<Viewable | null>(null);

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

    const bearing = { Authorization: `Bearer ${session.token}` };

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

                {/* The price sits beside the service rather than buried in a
                    row of details: it is the first thing anyone opening a
                    booking looks for. */}
                <ScreenHeader
                    eyebrow={provider ?? booking?.provider.name}
                    title={name ?? booking?.service.name ?? 'Booking'}
                >
                    {booking ? (
                        <View className="max-w-[45%] items-end">
                            <Text className="text-brand text-right text-lg font-bold">
                                {priceRange(
                                    booking.price_min,
                                    booking.price_max,
                                    booking.service.pricing_unit,
                                )}
                            </Text>
                            {booking.surcharge ? (
                                <Text className="text-muted-foreground text-right text-[11px]">
                                    plus {peso(booking.surcharge)} trip charge
                                </Text>
                            ) : null}
                        </View>
                    ) : null}
                </ScreenHeader>

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

                        <WhoCard provider={booking.provider.name} />

                        {/* The snapshot, not the live address: this is where the
                            work was actually asked for, whatever has been edited
                            since. */}
                        <WhereCard
                            place={{
                                label: booking.address.label,
                                line: booking.address.line,
                                landmark: booking.address.landmark,
                                latitude: booking.latitude,
                                longitude: booking.longitude,
                            }}
                        />

                        <WhenCard scheduled={booking.scheduled_at} />

                        <Card className="gap-2">
                            <Label>What</Label>

                            {booking.attachments?.length ? (
                                <View className="flex-row flex-wrap gap-2">
                                    {booking.attachments.map((attachment) => {
                                        const video = attachment.mime.startsWith('video/');
                                        const uri = attachmentUrl(attachment.id);

                                        return (
                                            <Pressable
                                                key={attachment.id}
                                                accessibilityRole="button"
                                                accessibilityLabel={
                                                    video ? 'Play video' : 'View photo'
                                                }
                                                onPress={() => setViewing({ uri, video })}
                                            >
                                                <MediaThumb
                                                    uri={uri}
                                                    video={video}
                                                    headers={bearing}
                                                />
                                            </Pressable>
                                        );
                                    })}
                                </View>
                            ) : (
                                <Text className="text-muted-foreground text-sm">
                                    Nothing was attached to this booking.
                                </Text>
                            )}
                        </Card>

                        <Card className="gap-2">
                            <Label>Why</Label>
                            <Text className="text-sm">{booking.description}</Text>
                        </Card>

                        {booking.status.is_open ? (
                            <Button variant="outline" onPress={() => setAsking(true)} busy={busy}>
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

                <MediaViewer
                    item={viewing}
                    headers={bearing}
                    onClose={() => setViewing(null)}
                />
            </ScrollView>
        </SafeAreaView>
    );
}
