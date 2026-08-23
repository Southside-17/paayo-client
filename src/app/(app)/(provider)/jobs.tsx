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
import type { Booking, BookingFilter as Filter } from '@/lib/types';
import { useWorkspace } from '@/lib/workspace';

/**
 * The work booked against this business, soonest visit first.
 */
export default function Jobs() {
    const session = useSession();
    const { staff } = useWorkspace();
    const [jobs, setJobs] = useState<Booking[] | null>(null);
    const [filters, setFilters] = useState<Filter[]>([]);
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

            void pushIsReachable().then(setReachable);
        }, [authenticatedRequest, provider]),
    );

    const counts = useMemo(() => countByStatus(jobs ?? []), [jobs]);
    const showing = useMemo(() => narrowTo(jobs ?? [], narrowed), [jobs, narrowed]);
    const label = filters.find((filter) => filter.value === narrowed)?.label.toLowerCase();

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

                {jobs === null ? null : (
                    <BookingFilter
                        filters={filters}
                        counts={counts}
                        total={jobs.length}
                        chosen={narrowed}
                        onChoose={setNarrowed}
                    />
                )}

                {jobs === null
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

                {jobs?.length === 0 ? (
                    <Card className="gap-2">
                        <Text className="font-semibold">Nothing booked yet</Text>
                        <Text className="text-muted-foreground text-sm">
                            Work booked against this business turns up here, soonest visit first.
                        </Text>
                    </Card>
                ) : null}

                {jobs !== null && jobs.length > 0 && showing.length === 0 ? (
                    <Card className="gap-2">
                        <Text className="font-semibold">{`Nothing ${label ?? 'here'}`}</Text>
                        <Text className="text-muted-foreground text-sm">
                            The rest of the work booked here is still there under All.
                        </Text>
                    </Card>
                ) : null}

                {showing.map((job) => (
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
