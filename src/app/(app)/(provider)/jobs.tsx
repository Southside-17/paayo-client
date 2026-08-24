import { Link, useFocusEffect } from 'expo-router';
import { useCallback, useMemo, useState } from 'react';
import { Pressable, ScrollView, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { BookingFilter } from '@/components/booking-filter';
import { BusinessChip } from '@/components/business-chip';
import { HoldNotice } from '@/components/hold-notice';
import { NotifyNotice } from '@/components/notify-notice';
import { Card } from '@/components/ui/card';
import { ScreenHeader } from '@/components/ui/screen-header';
import { Skeleton } from '@/components/ui/skeleton';
import { StatusPill } from '@/components/ui/status-pill';
import { Text } from '@/components/ui/text';
import { countByStatus, narrowTo, when } from '@/lib/bookings';
import { enablePush, pushIsReachable, pushIsSupported } from '@/lib/push';
import { useSession } from '@/lib/session';
import type { Booking, BookingFilter as Filter, Enquiry } from '@/lib/types';
import { cn } from '@/lib/utils';
import { useWorkspace } from '@/lib/workspace';

type Showing = 'jobs' | 'enquiries';

/**
 * The work booked against this business, and the prices asked of it.
 *
 * Two lists, because an enquiry has no visit to be sorted by: it is ordered
 * unanswered-first and then by age, and its row leads with the instruction
 * rather than a time and a place.
 */
export default function Jobs() {
    const session = useSession();
    const { staff } = useWorkspace();
    const [showing, setShowing] = useState<Showing>('jobs');
    const [jobs, setJobs] = useState<Booking[] | null>(null);
    const [enquiries, setEnquiries] = useState<Enquiry[] | null>(null);
    const [filters, setFilters] = useState<Filter[]>([]);
    const [enquiryFilters, setEnquiryFilters] = useState<Filter[]>([]);
    const [narrowed, setNarrowed] = useState<string | null>(null);
    const [reachable, setReachable] = useState(true);

    const authenticatedRequest =
        session.status === 'authenticated' ? session.authenticatedRequest : null;
    const provider = staff?.provider.id ?? null;

    useFocusEffect(
        useCallback(() => {
            if (!authenticatedRequest || !provider) {
                return;
            }

            void authenticatedRequest<{ data: Booking[]; meta?: { filters?: Filter[] } }>(
                `/providers/${provider}/bookings`,
            )
                .then(({ data, meta }) => {
                    setJobs(data);
                    setFilters(meta?.filters ?? []);
                })
                .catch(() => setJobs([]));

            void authenticatedRequest<{ data: Enquiry[]; meta?: { filters?: Filter[] } }>(
                `/providers/${provider}/enquiries`,
            )
                .then(({ data, meta }) => {
                    setEnquiries(data);
                    setEnquiryFilters(meta?.filters ?? []);
                })
                .catch(() => setEnquiries([]));

            void pushIsReachable().then(setReachable);
        }, [authenticatedRequest, provider]),
    );

    const onEnquiries = showing === 'enquiries';
    const counts = useMemo(
        () => countByStatus(onEnquiries ? (enquiries ?? []) : (jobs ?? [])),
        [jobs, enquiries, onEnquiries],
    );
    const listed = useMemo(() => narrowTo(jobs ?? [], narrowed), [jobs, narrowed]);
    const asked = useMemo(() => narrowTo(enquiries ?? [], narrowed), [enquiries, narrowed]);
    const chips = onEnquiries ? enquiryFilters : filters;
    const label = chips.find((filter) => filter.value === narrowed)?.label.toLowerCase();
    const rows = onEnquiries ? enquiries : jobs;

    if (!staff) {
        return null;
    }

    return (
        <SafeAreaView className="bg-background flex-1" edges={['top']}>
            <ScrollView contentContainerClassName="gap-4 p-6">
                <ScreenHeader title="Jobs">
                    <BusinessChip />
                </ScreenHeader>

                <HoldNotice suspension={staff.provider.suspension} />

                {pushIsSupported() && !reachable ? (
                    <NotifyNotice
                        onAsk={() => {
                            void (session.status === 'authenticated'
                                ? enablePush(session.token ?? '').then(setReachable)
                                : null);
                        }}
                    />
                ) : null}

                <View className="bg-muted flex-row gap-1 rounded-xl p-1">
                    {(['jobs', 'enquiries'] as const).map((option) => (
                        <Text
                            key={option}
                            accessibilityRole="button"
                            accessibilityState={{ selected: showing === option }}
                            onPress={() => {
                                setShowing(option);
                                setNarrowed(null);
                            }}
                            className={cn(
                                'flex-1 rounded-lg py-2 text-center text-sm font-bold capitalize',
                                showing === option
                                    ? 'bg-card text-foreground'
                                    : 'text-muted-foreground',
                            )}
                        >
                            {option}
                        </Text>
                    ))}
                </View>

                {rows === null ? null : (
                    <BookingFilter
                        filters={chips}
                        counts={counts}
                        total={rows.length}
                        chosen={narrowed}
                        onChoose={setNarrowed}
                    />
                )}

                {rows === null
                    ? [0, 1].map((at) => (
                          <View
                              key={at}
                              className="border-border bg-card gap-2 rounded-xl border p-4"
                          >
                              <View className="flex-row items-center justify-between gap-3">
                                  <Skeleton className="h-5 w-32" />
                                  <Skeleton className="h-6 w-28 rounded-full" />
                              </View>
                              <Skeleton className="h-4 w-40" />
                              <Skeleton className="h-3 w-36" />
                          </View>
                      ))
                    : null}

                {!onEnquiries && jobs?.length === 0 ? (
                    <Card className="gap-2">
                        <Text className="font-semibold">Nothing booked yet</Text>
                        <Text className="text-muted-foreground text-sm">
                            Work booked against this business turns up here, soonest visit first.
                        </Text>
                    </Card>
                ) : null}

                {onEnquiries && enquiries?.length === 0 ? (
                    <Card className="gap-2">
                        <Text className="font-semibold">Nobody has asked a price</Text>
                        <Text className="text-muted-foreground text-sm">
                            Clients can ask what work would cost on the services you price on
                            request. Those questions land here, and you answer with a price.
                        </Text>
                    </Card>
                ) : null}

                {(onEnquiries ? asked : listed).length === 0 && (rows?.length ?? 0) > 0 ? (
                    <Card className="gap-2">
                        <Text className="font-semibold">{`Nothing ${label ?? 'here'}`}</Text>
                        <Text className="text-muted-foreground text-sm">
                            {`The rest is still there under All.`}
                        </Text>
                    </Card>
                ) : null}

                {onEnquiries
                    ? asked.map((enquiry) => (
                          <Link
                              key={enquiry.id}
                              href={{
                                  pathname: '/quote/[id]',
                                  params: { id: enquiry.id, name: enquiry.service.name },
                              }}
                              asChild
                          >
                              <Pressable
                                  accessibilityRole="button"
                                  className="border-border bg-card gap-2 rounded-xl border p-4"
                              >
                                  <View className="flex-row items-center justify-between gap-3">
                                      <Text className="flex-1 font-semibold">
                                          {enquiry.service.name}
                                      </Text>
                                      <StatusPill tone={enquiry.status.tone}>
                                          {enquiry.status.wording}
                                      </StatusPill>
                                  </View>
                                  <Text className="text-muted-foreground text-sm">
                                      {enquiry.client?.nickname ?? 'A client'}
                                  </Text>
                                  {/* The instruction is the job here. There is no
                                      time and no price to lead with. */}
                                  <Text className="text-muted-foreground text-xs" numberOfLines={2}>
                                      {enquiry.description}
                                  </Text>
                              </Pressable>
                          </Link>
                      ))
                    : null}

                {onEnquiries ? null : listed.map((job) => (
                    <Link
                        key={job.id}
                        href={{
                            pathname: '/job/[id]',
                            params: { id: job.id, name: job.service.name },
                        }}
                        asChild
                    >
                        <Pressable
                            accessibilityRole="button"
                            className="border-border bg-card gap-2 rounded-xl border p-4"
                        >
                            <View className="flex-row items-center justify-between gap-3">
                                <Text className="flex-1 font-semibold">{job.service.name}</Text>
                                <StatusPill tone={job.status.tone}>{job.status.wording}</StatusPill>
                            </View>
                            <Text className="text-muted-foreground text-sm">
                                {job.client?.nickname ?? 'A client'}
                            </Text>
                            <Text className="text-muted-foreground text-xs">
                                {when(job.scheduled_at)}
                            </Text>
                            {job.address.line ? (
                                <Text className="text-muted-foreground text-xs" numberOfLines={1}>
                                    {job.address.line}
                                </Text>
                            ) : null}
                        </Pressable>
                    </Link>
                ))}
            </ScrollView>
        </SafeAreaView>
    );
}
