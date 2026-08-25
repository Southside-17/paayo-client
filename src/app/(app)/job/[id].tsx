import { Redirect, router, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { Pressable, ScrollView, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { BackButton } from '@/components/back-button';
import { WhenCard, WhereCard } from '@/components/booking-facts';
import { FormMessage } from '@/components/form-message';
import { HandoverNotice } from '@/components/handover-notice';
import { HoldNotice } from '@/components/hold-notice';
import { JobProgress } from '@/components/job-progress';
import { JobTimeline } from '@/components/job-timeline';
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
import { stopWatching, watchForArrival } from '@/lib/geofence';
import { accounting, nextStep } from '@/lib/jobs';
import { peso, priceRange, rateLine, workings } from '@/lib/money';
import { useSession } from '@/lib/session';
import type { Booking, ProviderStaff } from '@/lib/types';
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
    const {
        id,
        name,
        job: jobParam,
    } = useLocalSearchParams<{ id: string; name?: string; job?: string }>();
    const session = useSession();
    const { staff } = useWorkspace();
    const { busy, message, errorFor, submit } = useSubmit();
    const [job, setJob] = useState<Booking | null>(null);
    const [viewing, setViewing] = useState<Viewable | null>(null);
    // Seeded from the link and then read off every answer, because accepting is
    // what brings a work order into existence.
    const [work, setWork] = useState<string | null>(jobParam ?? null);
    const [crew, setCrew] = useState<ProviderStaff[] | null>(null);
    const [stepping, setStepping] = useState(false);
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

            // The job route, whenever there is a job. A technician deliberately
            // holds no booking:view, and everyone who can be on a job holds
            // job:work -- so this is the read that works for both.
            const path = work === null
                ? `/providers/${provider}/bookings/${id}`
                : `/providers/${provider}/jobs/${work}`;

            void authenticatedRequest<{ data: Booking }>(path)
                .then(({ data }) => {
                    setJob(data);
                    setWork((held) => data.job?.id ?? held);
                })
                .catch(() => setJob(null));
        }, [authenticatedRequest, id, provider, work]),
    );

    // Auto-arrival, armed while the crew are on the road and dropped the moment
    // they are not. Region monitoring rather than tracking: the phone's own
    // hardware watches the boundary and wakes the app once, and no coordinate
    // ever reaches the server. A refused permission does nothing at all -- the
    // button on screen is still the way through, which is why it stays.
    const enroute = job?.job?.status.value === 'enroute';
    const latitude = job?.latitude ?? null;
    const longitude = job?.longitude ?? null;
    const token = session.status === 'authenticated' ? (session.token ?? null) : null;

    useEffect(() => {
        if (!enroute || work === null || !provider || token === null) {
            return;
        }

        if (latitude === null || longitude === null) {
            return;
        }

        void watchForArrival({ provider, job: work, token }, { latitude, longitude });

        return () => {
            void stopWatching();
        };
    }, [enroute, work, provider, token, latitude, longitude]);

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

    const mayAssign = staff.permissions.includes('job:assign');
    const work_order = job?.job ?? null;
    const step = work_order === null ? null : nextStep(work_order);
    const lead = work_order?.crew?.find((member) => member.is_lead) ?? null;
    const onIt = work_order?.crew?.[0] ?? null;

    /** Take the next step on the job, whatever it happens to be. */
    const advance = (path: 'departure' | 'arrival' | 'start') =>
        submit(async () => {
            if (session.status !== 'authenticated' || !provider || work === null) {
                return;
            }

            const { data } = await session.authenticatedRequest<{ data: Booking }>(
                `/providers/${provider}/jobs/${work}/${path}`,
                { method: 'POST', body: {} },
            );

            setJob(data);
        });

    const put = (staffId: string, isLead: boolean) =>
        submit(async () => {
            if (session.status !== 'authenticated' || !provider || work === null) {
                return;
            }

            const { data } = await session.authenticatedRequest<{ data: Booking }>(
                `/providers/${provider}/jobs/${work}/assignments`,
                { method: 'POST', body: { staff_id: staffId, is_lead: isLead } },
            );

            setJob(data);
        });

    const take = (assignment: string) =>
        submit(async () => {
            if (session.status !== 'authenticated' || !provider || work === null) {
                return;
            }

            const { data } = await session.authenticatedRequest<{ data: Booking }>(
                `/providers/${provider}/jobs/${work}/assignments/${assignment}`,
                { method: 'DELETE' },
            );

            setJob(data);
        });

    /** The staff a dispatcher can put on this job, asked for only when they can. */
    const openPicker = () =>
        submit(async () => {
            if (session.status !== 'authenticated' || !provider) {
                return;
            }

            const { data } = await session.authenticatedRequest<{ data: ProviderStaff[] }>(
                `/providers/${provider}/staffs`,
            );

            setCrew(data);
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

                            {work_order ? (
                                <JobProgress
                                    job={work_order}
                                    audience="provider"
                                    crew={lead?.nickname ?? onIt?.nickname ?? null}
                                />
                            ) : null}

                            {work_order ? (
                                <Card className="gap-2">
                                    <Label>Who is going?</Label>

                                    {work_order.crew?.length ? (
                                        work_order.crew.map((member) => (
                                            <View
                                                key={member.id}
                                                className="flex-row items-center gap-2"
                                            >
                                                <Text className="flex-1 text-sm font-medium">
                                                    {member.nickname}
                                                </Text>
                                                {member.is_lead ? (
                                                    <StatusPill tone="brand">lead</StatusPill>
                                                ) : null}
                                                {mayAssign && !work_order.status.is_finished ? (
                                                    <Text
                                                        accessibilityRole="button"
                                                        className="text-muted-foreground text-xs"
                                                        onPress={() => void take(member.id)}
                                                    >
                                                        Take off
                                                    </Text>
                                                ) : null}
                                            </View>
                                        ))
                                    ) : (
                                        <Text className="text-muted-foreground text-sm">
                                            Nobody is on this yet.
                                        </Text>
                                    )}

                                    {mayAssign && !work_order.status.is_finished ? (
                                        <Button
                                            variant="outline"
                                            busy={busy}
                                            onPress={() => void openPicker()}
                                        >
                                            {work_order.crew?.length
                                                ? 'Put somebody else on it'
                                                : 'Put somebody on it'}
                                        </Button>
                                    ) : null}

                                    {crew !== null ? (
                                        <View className="gap-2">
                                            {crew
                                                .filter(
                                                    (member) =>
                                                        !work_order.crew?.some(
                                                            (on) => on.staff_id === member.id,
                                                        ),
                                                )
                                                .map((member) => (
                                                    <View
                                                        key={member.id}
                                                        className="border-border flex-row items-center gap-2 rounded-lg border p-3"
                                                    >
                                                        <View className="flex-1">
                                                            <Text className="text-sm font-medium">
                                                                {member.user.nickname}
                                                            </Text>
                                                            <Text className="text-muted-foreground text-xs">
                                                                {member.role_label}
                                                            </Text>
                                                        </View>
                                                        <Text
                                                            accessibilityRole="button"
                                                            className="text-brand text-xs font-semibold"
                                                            onPress={() =>
                                                                void put(member.id, lead === null)
                                                            }
                                                        >
                                                            {lead === null ? 'Send as lead' : 'Send'}
                                                        </Text>
                                                    </View>
                                                ))}
                                            <Button variant="ghost" onPress={() => setCrew(null)}>
                                                Close
                                            </Button>
                                        </View>
                                    ) : null}
                                </Card>
                            ) : null}

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

                            {work_order && work_order.lines.length > 0 ? (
                                <Card className="gap-2">
                                    <Label>What was done</Label>
                                    {work_order.lines.map((line) => (
                                        <View key={line.label} className="gap-0.5">
                                            <View className="flex-row items-baseline gap-2">
                                                <Text className="flex-1 text-sm">{line.label}</Text>
                                                <Text className="text-sm font-medium">
                                                    {line.total === null
                                                        ? 'Not accounted for'
                                                        : peso(line.total)}
                                                </Text>
                                            </View>
                                            {accounting(line) ? (
                                                <Text className="text-muted-foreground text-xs">
                                                    {accounting(line)}
                                                </Text>
                                            ) : null}
                                        </View>
                                    ))}
                                    {work_order.final_total !== null ? (
                                        <View className="border-border flex-row items-baseline gap-2 border-t pt-2">
                                            <Text className="flex-1 text-sm font-medium">Billed</Text>
                                            <Text className="font-bold">
                                                {peso(work_order.final_total)}
                                            </Text>
                                        </View>
                                    ) : null}
                                    {work_order.note ? (
                                        <Text className="text-muted-foreground text-sm">
                                            {work_order.note}
                                        </Text>
                                    ) : null}
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

                            {/* One button, for the one step this job is up to.
                                A row of four would be three wrong answers, and
                                the crew are reading this holding tools. */}
                            {step && !staff.provider.suspension ? (
                                <Button
                                    variant="brand"
                                    busy={busy}
                                    onPress={() => {
                                        if (step.confirm) {
                                            setStepping(true);

                                            return;
                                        }

                                        if (step.path !== null) {
                                            void advance(step.path);
                                        }
                                    }}
                                >
                                    {step.label}
                                </Button>
                            ) : null}

                            {step && staff.provider.suspension ? (
                                <HoldNotice suspension={staff.provider.suspension} />
                            ) : null}

                            {work_order ? (
                                <JobTimeline activities={work_order.activities ?? []} />
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
                        open={stepping}
                        title={step?.confirm?.title ?? ''}
                        body={step?.confirm?.body ?? ''}
                        confirm={step?.confirm?.button ?? 'Yes'}
                        dismiss="Not yet"
                        busy={busy}
                        onConfirm={() => {
                            setStepping(false);

                            router.push({
                                pathname: '/job/finish',
                                params: { id: work ?? id, name: name ?? job?.service.name ?? 'Job' },
                            });
                        }}
                        onDismiss={() => setStepping(false)}
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
