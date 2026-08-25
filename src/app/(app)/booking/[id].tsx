import { router, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { useCallback, useState } from 'react';
import { Pressable, ScrollView, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { BackButton } from '@/components/back-button';
import { WhenCard, WhereCard, WhoCard } from '@/components/booking-facts';
import { FormMessage } from '@/components/form-message';
import { JobProgress } from '@/components/job-progress';
import { JobTimeline } from '@/components/job-timeline';
import { MediaThumb } from '@/components/media-thumb';
import { MediaViewer, type Viewable } from '@/components/media-viewer';
import { PhoneNotice } from '@/components/phone-notice';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import { Label } from '@/components/ui/label';
import { ScreenHeader } from '@/components/ui/screen-header';
import { Skeleton } from '@/components/ui/skeleton';
import { StatusPill } from '@/components/ui/status-pill';
import { Text } from '@/components/ui/text';
import { accounting } from '@/lib/jobs';
import { peso, priceRange, rateLine, workings } from '@/lib/money';
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

    const job = booking?.job ?? null;
    const lead = job?.crew?.find((member) => member.is_lead) ?? job?.crew?.[0] ?? null;

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
                >
                    {booking ? (
                        <View className="max-w-[45%] items-end">
                            <Text className="text-brand text-right text-lg font-bold">
                                {booking.expected_total !== null
                                    ? peso(booking.expected_total)
                                    : priceRange(
                                          booking.price_min,
                                          booking.price_max,
                                          booking.pricing_method,
                                      )}
                            </Text>
                            {booking.lines.length === 1 ? (
                                <Text className="text-muted-foreground text-right text-[11px]">
                                    {workings(booking.lines[0], booking.lines[0].quantity) ??
                                        booking.lines[0].label}
                                </Text>
                            ) : null}
                            {booking.lines.length > 1 ? (
                                <Text className="text-muted-foreground text-right text-[11px]">
                                    {`${booking.lines.length} lines`}
                                </Text>
                            ) : null}
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
                        {booking.status.is_open && !session.user.phone_verified ? (
                            <PhoneNotice
                                onConfirm={() =>
                                    router.push(
                                        session.user.phone === null
                                            ? { pathname: '/profile/edit', params: { from: 'Booking' } }
                                            : { pathname: '/profile/phone', params: { from: 'Booking' } },
                                    )
                                }
                            />
                        ) : null}

                        <StatusPill tone={booking.status.tone}>{booking.status.wording}</StatusPill>

                        {booking.status.needs_another_provider ? (
                            <Card className="border-warning/40 bg-warning-subtle gap-3">
                                <Text className="font-semibold">
                                    {`${booking.provider.name} can't take this`}
                                </Text>
                                <Text className="text-muted-foreground text-sm">
                                    Ask somebody else and this becomes a new booking. Your
                                    photos, address and time carry over.
                                </Text>
                                <Button
                                    onPress={() =>
                                        router.push({
                                            pathname: '/service/[id]',
                                            params: {
                                                id: booking.service.id,
                                                name: booking.service.name,
                                                replaces: booking.id,
                                            },
                                        })
                                    }
                                >
                                    Ask someone else
                                </Button>
                            </Card>
                        ) : null}

                        {booking.status.needs_another_provider ? null : (
                            <WhoCard
                                provider={booking.provider.name}
                                note={lead ? `${lead.nickname} is doing the work.` : undefined}
                            />
                        )}

                        {job ? <JobProgress job={job} crew={lead?.nickname ?? null} /> : null}

                        <WhereCard
                            place={{
                                label: booking.address.label,
                                line: booking.address.line,
                                landmark: booking.address.landmark,
                                latitude: booking.latitude,
                                longitude: booking.longitude,
                            }}
                            // Null until live tracking lands. The map is the
                            // slot the crew's marker drops into; see PinMap.
                            crew={null}
                        />

                        <WhenCard scheduled={booking.scheduled_at} />

                        <Card className="gap-2">
                            <Label>What does it look like?</Label>

                            {booking.attachments?.length ? (
                                <View className="flex-row flex-wrap gap-2">
                                    {booking.attachments.map((attachment) => {
                                        const video = attachment.mime.startsWith('video/');
                                        const uri = attachment.url;

                                        if (!uri) {
                                            return null;
                                        }

                                        return (
                                            <Pressable
                                                key={attachment.id}
                                                accessibilityRole="button"
                                                accessibilityLabel={
                                                    video ? 'Play video' : 'View photo'
                                                }
                                                onPress={() => setViewing({ uri, video })}
                                            >
                                                <MediaThumb uri={uri} video={video} />
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
                            <Label>Why do you need them?</Label>
                            <Text className="text-sm">{booking.description}</Text>
                        </Card>

                        {booking.lines.length > 0 ? (
                            <Card className="gap-2">
                                <Label>What you asked for</Label>
                                {booking.lines.map((line) => (
                                    <View
                                        key={line.label}
                                        className="flex-row items-baseline gap-2"
                                    >
                                        <Text className="flex-1 text-sm">{line.label}</Text>
                                        <Text className="text-sm font-medium">
                                            {workings(line, line.quantity) ?? rateLine(line)}
                                        </Text>
                                    </View>
                                ))}
                                {booking.expected_total !== null ? (
                                    <View className="border-border flex-row items-baseline gap-2 border-t pt-2">
                                        <Text className="flex-1 text-sm font-medium">Total</Text>
                                        <Text className="font-bold">
                                            {peso(booking.expected_total)}
                                        </Text>
                                    </View>
                                ) : null}
                            </Card>
                        ) : null}

                        {booking.intake.length > 0 ? (
                            <Card className="gap-3">
                                <Label>What you told them</Label>
                                {booking.intake.map((asked) => (
                                    <View key={asked.question} className="gap-0.5">
                                        <Text className="text-muted-foreground text-sm">
                                            {asked.question}
                                        </Text>
                                        <Text className="text-sm">{asked.answer}</Text>
                                    </View>
                                ))}
                            </Card>
                        ) : null}

                        {job && job.lines.length > 0 ? (
                            <Card className="gap-2">
                                <Label>What they did</Label>
                                {job.lines.map((line) => (
                                    <View key={line.label} className="gap-0.5">
                                        <View className="flex-row items-baseline gap-2">
                                            <Text className="flex-1 text-sm">{line.label}</Text>
                                            <Text className="text-sm font-medium">
                                                {line.total === null
                                                    ? 'Not settled'
                                                    : peso(line.total)}
                                            </Text>
                                        </View>
                                        {/* The workings, so an hourly figure is
                                            checkable rather than asking to be
                                            trusted: 3h 10m → 4h. */}
                                        {accounting(line) ? (
                                            <Text className="text-muted-foreground text-xs">
                                                {accounting(line)}
                                            </Text>
                                        ) : null}
                                    </View>
                                ))}
                                {job.final_total !== null ? (
                                    <View className="border-border flex-row items-baseline gap-2 border-t pt-2">
                                        <Text className="flex-1 text-sm font-medium">
                                            What you owe
                                        </Text>
                                        <Text className="font-bold">{peso(job.final_total)}</Text>
                                    </View>
                                ) : null}
                                {job.note ? (
                                    <Text className="text-muted-foreground text-sm">
                                        {job.note}
                                    </Text>
                                ) : null}
                            </Card>
                        ) : null}

                        {job ? <JobTimeline activities={job.activities ?? []} /> : null}

                        {booking.status.is_open ? (
                            <Button variant="outline" onPress={() => setAsking(true)} busy={busy}>
                                Cancel this booking
                            </Button>
                        ) : null}
                    </>
                ) : null}

                <ConfirmDialog
                    open={asking}
                    title="Cancel this booking?"
                    body={
                        job?.status.is_underway
                            ? `${lead?.nickname ?? 'Somebody'} is already out on this. Calling it off now stops the work where it is, and you can book it again afterwards.`
                            : 'Nobody will be sent. You can book the same work again afterwards.'
                    }
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

                <MediaViewer item={viewing} onClose={() => setViewing(null)} />
            </ScrollView>
        </SafeAreaView>
    );
}
