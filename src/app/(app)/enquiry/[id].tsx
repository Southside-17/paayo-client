import { router, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { useCallback, useState } from 'react';
import { Pressable, ScrollView, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { BackButton } from '@/components/back-button';
import { WhereCard, WhoCard } from '@/components/booking-facts';
import { FormMessage } from '@/components/form-message';
import { MediaThumb } from '@/components/media-thumb';
import { MediaViewer, type Viewable } from '@/components/media-viewer';
import { QuotationCard } from '@/components/quotation-card';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import { FieldError } from '@/components/ui/field-error';
import { Label } from '@/components/ui/label';
import { ScreenHeader } from '@/components/ui/screen-header';
import { Skeleton } from '@/components/ui/skeleton';
import { StatusPill } from '@/components/ui/status-pill';
import { Text } from '@/components/ui/text';
import { when } from '@/lib/bookings';
import { useSession } from '@/lib/session';
import type { Booking, Enquiry } from '@/lib/types';
import { useSubmit } from '@/lib/use-submit';
import { cn } from '@/lib/utils';

/** The days offered when a price is accepted. Mirrors book.tsx. */
function days(): Date[] {
    const today = new Date();

    return Array.from({ length: 7 }, (_, at) => {
        const day = new Date(today);
        day.setDate(today.getDate() + at);

        return day;
    });
}

const HOURS = [8, 10, 13, 15, 17];

function hourLabel(hour: number): string {
    const suffix = hour < 12 ? 'AM' : 'PM';
    const shown = hour <= 12 ? hour : hour - 12;

    return `${shown}:00 ${suffix}`;
}

/**
 * One enquiry, and the price it earned.
 *
 * Accepting is the one place the client commits on this route: it carries the
 * quoted figure across and asks for a day, and the booking is written from both.
 * An enquiry never becomes the booking -- it stays here, answered.
 */
export default function EnquiryDetail() {
    const { id, name } = useLocalSearchParams<{ id: string; name?: string }>();
    const session = useSession();
    const { busy, message, errorFor, submit } = useSubmit();
    const [enquiry, setEnquiry] = useState<Enquiry | null>(null);
    const [viewing, setViewing] = useState<Viewable | null>(null);
    const [booking, setBooking] = useState(false);
    const [withdrawing, setWithdrawing] = useState(false);
    const [day, setDay] = useState(() => days()[1]);
    const [hour, setHour] = useState(HOURS[1]);

    const authenticatedRequest =
        session.status === 'authenticated' ? session.authenticatedRequest : null;

    useFocusEffect(
        useCallback(() => {
            if (!authenticatedRequest) {
                return;
            }

            void authenticatedRequest<{ data: Enquiry }>(`/enquiries/${id}`)
                .then(({ data }) => setEnquiry(data))
                .catch(() => setEnquiry(null));
        }, [authenticatedRequest, id]),
    );

    if (session.status !== 'authenticated') {
        return null;
    }

    const scheduledAt = () => {
        const scheduled = new Date(day);
        scheduled.setHours(hour, 0, 0, 0);

        return scheduled;
    };

    const accepting = [
        enquiry?.provider.name ?? 'They',
        'will be asked to come on',
        when(scheduledAt().toISOString()),
    ]
        .join(' ')
        .concat('.');

    const accept = () =>
        submit(async () => {
            const { data } = await session.authenticatedRequest<{ data: Booking }>(
                `/enquiries/${id}/quotation/acceptance`,
                { method: 'POST', body: { scheduled_at: scheduledAt().toISOString() } },
            );

            setBooking(false);

            router.replace({
                pathname: '/booking/[id]',
                params: { id: data.id, name: data.service.name, provider: data.provider.name },
            });
        });

    const decline = () =>
        submit(async () => {
            await session.authenticatedRequest(`/enquiries/${id}/quotation/refusal`, {
                method: 'POST',
            });

            const { data } = await session.authenticatedRequest<{ data: Enquiry }>(
                `/enquiries/${id}`,
            );

            setEnquiry(data);
        });

    const withdraw = () =>
        submit(async () => {
            const { data } = await session.authenticatedRequest<{ data: Enquiry }>(
                `/enquiries/${id}/withdrawal`,
                { method: 'POST' },
            );

            setEnquiry(data);
            setWithdrawing(false);
        });

    return (
        <SafeAreaView className="bg-background flex-1">
            <ScrollView contentContainerClassName="gap-4 p-6">
                <BackButton label="Enquiries" />
                <ScreenHeader eyebrow="Enquiry" title={name ?? enquiry?.service.name ?? 'Enquiry'} />

                <FormMessage message={message ?? errorFor('status') ?? null} />

                {enquiry === null ? (
                    <>
                        <Card className="gap-2">
                            <Skeleton className="h-6 w-32" />
                            <Skeleton className="h-4 w-full" />
                        </Card>
                        <Card className="gap-2">
                            <Skeleton className="h-4 w-24" />
                            <Skeleton className="h-4 w-3/4" />
                        </Card>
                    </>
                ) : (
                    <>
                        <StatusPill tone={enquiry.status.tone}>{enquiry.status.wording}</StatusPill>

                        {enquiry.quotation?.is_answerable ? (
                            <Card className="gap-3">
                                <Label>When should they come?</Label>
                                <View className="flex-row flex-wrap gap-2">
                                    {days().map((option) => (
                                        <Pressable
                                            key={option.toISOString()}
                                            accessibilityRole="button"
                                            accessibilityLabel={option.toDateString()}
                                            onPress={() => setDay(option)}
                                            className={cn(
                                                'rounded-full border px-3 py-2',
                                                option.toDateString() === day.toDateString()
                                                    ? 'border-brand bg-brand-subtle'
                                                    : 'border-border bg-card',
                                            )}
                                        >
                                            <Text className="text-sm font-medium">
                                                {option.toLocaleDateString('en-PH', {
                                                    weekday: 'short',
                                                    day: 'numeric',
                                                })}
                                            </Text>
                                        </Pressable>
                                    ))}
                                </View>
                                <View className="flex-row flex-wrap gap-2">
                                    {HOURS.map((option) => (
                                        <Pressable
                                            key={option}
                                            accessibilityRole="button"
                                            accessibilityLabel={hourLabel(option)}
                                            onPress={() => setHour(option)}
                                            className={cn(
                                                'rounded-full border px-3 py-2',
                                                option === hour
                                                    ? 'border-brand bg-brand-subtle'
                                                    : 'border-border bg-card',
                                            )}
                                        >
                                            <Text className="text-sm font-medium">
                                                {hourLabel(option)}
                                            </Text>
                                        </Pressable>
                                    ))}
                                </View>
                                <FieldError message={errorFor('scheduled_at')} />
                            </Card>
                        ) : null}

                        {enquiry.quotation ? (
                            <QuotationCard
                                quotation={enquiry.quotation}
                                busy={busy}
                                onAccept={() => setBooking(true)}
                                onDecline={() => void decline()}
                            />
                        ) : null}

                        {enquiry.status.is_awaiting_answer ? (
                            <Card className="gap-2">
                                <Text className="font-semibold">Waiting on their price</Text>
                                <Text className="text-muted-foreground text-sm">
                                    {`${enquiry.provider.name} has what you sent. Nothing is booked, and you can take this back at any time.`}
                                </Text>
                            </Card>
                        ) : null}

                        {enquiry.status.needs_another_provider ? (
                            <Card className="border-warning/40 bg-warning-subtle gap-3">
                                <Text className="font-semibold">
                                    {`${enquiry.provider.name} will not be quoting this`}
                                </Text>
                                <Text className="text-muted-foreground text-sm">
                                    Ask somebody else. An enquiry costs nothing, so nothing is
                                    lost by sending another.
                                </Text>
                                <Button
                                    onPress={() =>
                                        router.push({
                                            pathname: '/service/[id]',
                                            params: {
                                                id: enquiry.service.id,
                                                name: enquiry.service.name,
                                            },
                                        })
                                    }
                                >
                                    Ask someone else
                                </Button>
                            </Card>
                        ) : null}

                        <WhoCard provider={enquiry.provider.name} />

                        <Card className="gap-2">
                            <Label>What you asked about</Label>
                            <Text className="text-sm">{enquiry.description}</Text>
                        </Card>

                        <WhereCard
                            place={{
                                label: enquiry.address.label,
                                line: enquiry.address.line,
                                landmark: enquiry.address.landmark,
                                latitude: enquiry.latitude,
                                longitude: enquiry.longitude,
                            }}
                        />

                        {enquiry.attachments?.length ? (
                            <Card className="gap-2">
                                <Label>What you sent</Label>
                                <View className="flex-row flex-wrap gap-2">
                                    {enquiry.attachments.map((attachment) => {
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
                            </Card>
                        ) : null}

                        {enquiry.status.is_open ? (
                            <Button variant="ghost" onPress={() => setWithdrawing(true)}>
                                Take this back
                            </Button>
                        ) : null}
                    </>
                )}

                <ConfirmDialog
                    open={withdrawing}
                    title="Take this enquiry back?"
                    body="They will stop working on a price for it. Any price they have already sent goes with it."
                    confirm="Take it back"
                    dismiss="Keep it"
                    busy={busy}
                    onConfirm={() => void withdraw()}
                    onDismiss={() => setWithdrawing(false)}
                />

                <ConfirmDialog
                    open={booking}
                    title="Accept this price?"
                    body={accepting}
                    confirm="Accept and book"
                    dismiss="Not yet"
                    busy={busy}
                    onConfirm={() => void accept()}
                    onDismiss={() => setBooking(false)}
                />

                <MediaViewer item={viewing} onClose={() => setViewing(null)} />
            </ScrollView>
        </SafeAreaView>
    );
}
