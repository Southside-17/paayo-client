import { Redirect, router, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { useCallback, useState } from 'react';
import { Pressable, ScrollView, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { BackButton } from '@/components/back-button';
import { WhenCard, WhereCard } from '@/components/booking-facts';
import { FormMessage } from '@/components/form-message';
import { HandoverNotice } from '@/components/handover-notice';
import { HoldNotice } from '@/components/hold-notice';
import { MediaThumb } from '@/components/media-thumb';
import { MediaViewer, type Viewable } from '@/components/media-viewer';
import { PriceSheet, type PricedLine } from '@/components/price-sheet';
import { QuotationCard } from '@/components/quotation-card';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import { Input } from '@/components/ui/input';
import { KeyboardAvoiding } from '@/components/ui/keyboard-avoiding';
import { Label } from '@/components/ui/label';
import { ScreenHeader } from '@/components/ui/screen-header';
import { Skeleton } from '@/components/ui/skeleton';
import { StatusPill } from '@/components/ui/status-pill';
import { Text } from '@/components/ui/text';
import { peso, priceRange, rateLine, workings } from '@/lib/money';
import { useSession } from '@/lib/session';
import type { Booking } from '@/lib/types';
import { useSubmit } from '@/lib/use-submit';
import { useWorkspace } from '@/lib/workspace';

/** The day and hour a visit is set for, short enough to sit in a header. */
function visitAt(scheduled: string): string {
    return new Date(scheduled).toLocaleString('en-PH', {
        weekday: 'short',
        day: 'numeric',
        month: 'short',
        hour: 'numeric',
        minute: '2-digit',
    });
}

/**
 * One job, as the business sees it: who asked, where, when and what for.
 */
export default function Job() {
    const { id, name } = useLocalSearchParams<{ id: string; name?: string }>();
    const session = useSession();
    const { staff } = useWorkspace();
    const { busy, message, errorFor, submit } = useSubmit();
    const [job, setJob] = useState<Booking | null>(null);
    const [viewing, setViewing] = useState<Viewable | null>(null);
    const [taking, setTaking] = useState(false);
    const [turningDown, setTurningDown] = useState(false);
    const [pricing, setPricing] = useState(false);
    const [refusing, setRefusing] = useState(false);
    const [note, setNote] = useState('');

    const authenticatedRequest =
        session.status === 'authenticated' ? session.authenticatedRequest : null;
    const provider = staff?.provider.id ?? null;

    useFocusEffect(
        useCallback(() => {
            if (!authenticatedRequest || !provider) {
                return;
            }

            void authenticatedRequest<{ data: Booking }>(`/providers/${provider}/bookings/${id}`)
                .then(({ data }) => setJob(data))
                .catch(() => setJob(null));
        }, [authenticatedRequest, id, provider]),
    );

    if (!staff) {
        return <Redirect href="/" />;
    }

    const price = (lines: PricedLine[], why: string | null) =>
        submit(async () => {
            if (session.status !== 'authenticated' || !provider) {
                return;
            }

            await session.authenticatedRequest(
                `/providers/${provider}/bookings/${id}/quotation`,
                { method: 'POST', body: { lines, note: why } },
            );

            const { data } = await session.authenticatedRequest<{ data: Booking }>(
                `/providers/${provider}/bookings/${id}`,
            );

            setJob(data);
            setPricing(false);
        });

    const withdrawPrice = () =>
        submit(async () => {
            if (session.status !== 'authenticated' || !provider) {
                return;
            }

            await session.authenticatedRequest(
                `/providers/${provider}/bookings/${id}/quotation`,
                { method: 'DELETE' },
            );

            const { data } = await session.authenticatedRequest<{ data: Booking }>(
                `/providers/${provider}/bookings/${id}`,
            );

            setJob(data);
        });

    const answer = (path: 'acceptance' | 'refusal', body?: Record<string, unknown>) =>
        submit(async () => {
            if (session.status !== 'authenticated') {
                return;
            }

            const { data } = await session.authenticatedRequest<{ data: Booking }>(
                `/providers/${staff.provider.id}/bookings/${id}/${path}`,
                { method: 'POST', body: body ?? {} },
            );

            setJob(data);
            setTurningDown(false);
            setNote('');
            router.back();
        });

    return (
        <SafeAreaView className="bg-background flex-1">
            <KeyboardAvoiding className="flex-1">
                <ScrollView
                    contentContainerClassName="gap-5 p-6"
                    keyboardShouldPersistTaps="handled"
                >
                    <BackButton label="Jobs" />

                    <ScreenHeader
                        eyebrow={job?.client?.nickname}
                        title={name ?? job?.service.name ?? 'Job'}
                    >
                        {job ? (
                            <View className="max-w-[45%] items-end">
                                <Text className="text-brand text-right text-lg font-bold">
                                    {job.expected_total !== null
                                        ? peso(job.expected_total)
                                        : priceRange(
                                              job.price_min,
                                              job.price_max,
                                              job.pricing_method,
                                          )}
                                </Text>
                                {job.lines.length === 1 ? (
                                    <Text className="text-muted-foreground text-right text-[11px]">
                                        {workings(job.lines[0], job.lines[0].quantity) ??
                                            job.lines[0].label}
                                    </Text>
                                ) : null}
                                {job.lines.length > 1 ? (
                                    <Text className="text-muted-foreground text-right text-[11px]">
                                        {`${job.lines.length} lines`}
                                    </Text>
                                ) : null}
                                <Text className="text-muted-foreground text-right text-[11px]">
                                    {visitAt(job.scheduled_at)}
                                </Text>
                                {job.surcharge ? (
                                    <Text className="text-muted-foreground text-right text-[11px]">
                                        plus {peso(job.surcharge)} trip charge
                                    </Text>
                                ) : null}
                            </View>
                        ) : null}
                    </ScreenHeader>

                    <FormMessage message={message ?? errorFor('status') ?? null} />

                    {job === null ? (
                        <>
                            <Skeleton className="h-7 w-40 rounded-full" />
                            <Card className="gap-3">
                                <Skeleton className="h-4 w-full" />
                                <Skeleton className="h-4 w-3/4" />
                            </Card>
                            <Card className="gap-2">
                                <Skeleton className="h-5 w-36" />
                                <Skeleton className="h-4 w-full" />
                            </Card>
                        </>
                    ) : null}

                    {job ? (
                        <>
                            <StatusPill tone={job.status.tone}>{job.status.wording}</StatusPill>

                            <HandoverNotice job={job} />

                            <Card className="gap-1">
                                <Label>Who asked?</Label>
                                <Text className="text-lg font-semibold">
                                    {job.client?.nickname ?? 'A client'}
                                </Text>
                                {job.client?.phone ? (
                                    <Text className="text-muted-foreground text-sm">
                                        {job.client.phone}
                                    </Text>
                                ) : (
                                    <Text className="text-muted-foreground text-sm">
                                        No phone number on this account.
                                    </Text>
                                )}
                            </Card>

                            <WhereCard
                                audience="provider"
                                radius={job.pin_radius}
                                place={{
                                    label: job.address.label,
                                    line: job.address.line,
                                    landmark: job.address.landmark,
                                    latitude: job.latitude,
                                    longitude: job.longitude,
                                }}
                            />

                            <WhenCard scheduled={job.scheduled_at} audience="provider" />

                            <Card className="gap-2">
                                <Label>What does it look like?</Label>

                                {job.attachments?.length ? (
                                    <View className="flex-row flex-wrap gap-2">
                                        {job.attachments.map((attachment) => {
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
                                <Label>Why do they need you?</Label>
                                <Text className="text-sm">{job.description}</Text>
                            </Card>

                            {job.lines.length > 0 ? (
                                <Card className="gap-2">
                                    <Label>What they asked for</Label>
                                    {job.lines.map((line) => (
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
                                    {job.expected_total !== null ? (
                                        <View className="border-border flex-row items-baseline gap-2 border-t pt-2">
                                            <Text className="flex-1 text-sm font-medium">Total</Text>
                                            <Text className="font-bold">
                                                {peso(job.expected_total)}
                                            </Text>
                                        </View>
                                    ) : null}
                                </Card>
                            ) : null}

                            {job.intake.length > 0 ? (
                                <Card className="gap-3">
                                    <Label>What they told you</Label>
                                    {job.intake.map((asked) => (
                                        <View key={asked.question} className="gap-0.5">
                                            <Text className="text-muted-foreground text-sm">
                                                {asked.question}
                                            </Text>
                                            <Text className="text-sm">{asked.answer}</Text>
                                        </View>
                                    ))}
                                </Card>
                            ) : null}

                            {job.quotation ? (
                                <QuotationCard quotation={job.quotation} />
                            ) : null}

                            {job.status.value === 'quoted' ? (
                                <Card className="gap-2">
                                    <Text className="font-semibold">Waiting on the client</Text>
                                    <Text className="text-muted-foreground text-sm">
                                        They have your price. The job is theirs to accept, and
                                        nothing is agreed until they do.
                                    </Text>
                                    <Button
                                        variant="ghost"
                                        disabled={busy}
                                        onPress={() => void withdrawPrice()}
                                    >
                                        Pull this price back
                                    </Button>
                                </Card>
                            ) : null}

                            {job.status.value === 'pending' && staff.provider.suspension ? (
                                <HoldNotice suspension={staff.provider.suspension} />
                            ) : null}

                            {job.status.value === 'pending' && !staff.provider.suspension ? (
                                <View className="gap-3">
                                    {turningDown ? (
                                        <View className="gap-2">
                                            <Label>Why not? (only we see this)</Label>
                                            <Input
                                                value={note}
                                                onChangeText={setNote}
                                                multiline
                                                textAlignVertical="top"
                                                className="h-20 py-3"
                                                placeholder="Fully booked, too far, wrong job."
                                                invalid={Boolean(errorFor('note'))}
                                            />
                                            <Button
                                                variant="outline"
                                                busy={busy}
                                                onPress={() => setRefusing(true)}
                                            >
                                                Turn it down
                                            </Button>
                                            <Button
                                                variant="ghost"
                                                onPress={() => setTurningDown(false)}
                                            >
                                                Keep it
                                            </Button>
                                        </View>
                                    ) : (
                                        <>
                                            <Button busy={busy} onPress={() => setTaking(true)}>
                                                Take this job
                                            </Button>
                                            {/* Pakyawan: the job is larger than the
                                                published rate covers, so it is priced
                                                as one job instead of taken at a rate
                                                that cannot hold it. */}
                                            <Button
                                                variant="outline"
                                                onPress={() => setPricing(true)}
                                            >
                                                Price it as one job
                                            </Button>
                                            <Button
                                                variant="ghost"
                                                onPress={() => setTurningDown(true)}
                                            >
                                                Can&apos;t take it
                                            </Button>
                                        </>
                                    )}
                                </View>
                            ) : null}
                        </>
                    ) : null}

                    <PriceSheet
                        open={pricing}
                        title="Price this as one job"
                        revising={job?.quotation !== null && job?.quotation !== undefined}
                        busy={busy}
                        errorFor={errorFor}
                        onSend={(lines, why) => void price(lines, why)}
                        onDismiss={() => setPricing(false)}
                    />

                    <ConfirmDialog
                        open={taking}
                        title="Take this job?"
                        body={
                            job
                                ? `You are saying you will be in ${job.address.line ?? 'the area'} on ${visitAt(job.scheduled_at)}. The street and ${job.client?.nickname ?? 'the client'}'s number arrive once you accept.`
                                : ''
                        }
                        confirm="Take the job"
                        dismiss="Not yet"
                        busy={busy}
                        onConfirm={() => {
                            setTaking(false);
                            void answer('acceptance');
                        }}
                        onDismiss={() => setTaking(false)}
                    />

                    <ConfirmDialog
                        open={refusing}
                        title="Turn down this job?"
                        body={
                            job
                                ? `${job.client?.nickname ?? 'The client'} will be asked to choose another business. You cannot take this job back afterwards.`
                                : ''
                        }
                        confirm="Turn it down"
                        dismiss="Keep it"
                        destructive
                        busy={busy}
                        onConfirm={() => {
                            setRefusing(false);
                            void answer('refusal', { note: note.trim() || null });
                        }}
                        onDismiss={() => setRefusing(false)}
                    />

                    <MediaViewer item={viewing} onClose={() => setViewing(null)} />
                </ScrollView>
            </KeyboardAvoiding>
        </SafeAreaView>
    );
}
