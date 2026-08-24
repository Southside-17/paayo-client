import { Link, useFocusEffect } from 'expo-router';
import { useCallback, useMemo, useState } from 'react';
import { Pressable, ScrollView, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { BookingFilter } from '@/components/booking-filter';
import { Card } from '@/components/ui/card';
import { ScreenHeader } from '@/components/ui/screen-header';
import { Skeleton } from '@/components/ui/skeleton';
import { StatusPill } from '@/components/ui/status-pill';
import { Text } from '@/components/ui/text';
import { countByStatus, narrowTo, when } from '@/lib/bookings';
import { useSession } from '@/lib/session';
import type { Booking, BookingFilter as Filter, Enquiry } from '@/lib/types';
import { cn } from '@/lib/utils';

type Showing = 'bookings' | 'enquiries';

/**
 * The work this account has asked for, and the prices it has asked about.
 *
 * Two lists rather than one, because an enquiry has no date: it cannot be sorted
 * by when work is happening, and its filters are about who owes an answer. The
 * segmented control is the idiom `(provider)/services.tsx` uses for the same
 * reason -- it keeps the tab bar stable.
 */
export default function Bookings() {
    const session = useSession();
    const [showing, setShowing] = useState<Showing>('bookings');
    const [bookings, setBookings] = useState<Booking[] | null>(null);
    const [enquiries, setEnquiries] = useState<Enquiry[] | null>(null);
    const [filters, setFilters] = useState<Filter[]>([]);
    const [enquiryFilters, setEnquiryFilters] = useState<Filter[]>([]);
    const [narrowed, setNarrowed] = useState<string | null>(null);

    const authenticatedRequest =
        session.status === 'authenticated' ? session.authenticatedRequest : null;

    useFocusEffect(
        useCallback(() => {
            if (!authenticatedRequest) {
                return;
            }

            void authenticatedRequest<{ data: Booking[]; meta?: { filters?: Filter[] } }>(
                '/bookings',
            )
                .then(({ data, meta }) => {
                    setBookings(data);
                    setFilters(meta?.filters ?? []);
                })
                .catch(() => setBookings([]));

            void authenticatedRequest<{ data: Enquiry[]; meta?: { filters?: Filter[] } }>(
                '/enquiries',
            )
                .then(({ data, meta }) => {
                    setEnquiries(data);
                    setEnquiryFilters(meta?.filters ?? []);
                })
                .catch(() => setEnquiries([]));
        }, [authenticatedRequest]),
    );

    const onEnquiries = showing === 'enquiries';
    const counts = useMemo(
        () => countByStatus(onEnquiries ? (enquiries ?? []) : (bookings ?? [])),
        [bookings, enquiries, onEnquiries],
    );
    const listed = useMemo(
        () => narrowTo(bookings ?? [], narrowed),
        [bookings, narrowed],
    );
    const asked = useMemo(
        () => narrowTo(enquiries ?? [], narrowed),
        [enquiries, narrowed],
    );
    const chips = onEnquiries ? enquiryFilters : filters;
    const label = chips.find((filter) => filter.value === narrowed)?.label.toLowerCase();

    return (
        <SafeAreaView className="bg-background flex-1" edges={['top']}>
            <ScrollView contentContainerClassName="gap-4 p-6">
                <ScreenHeader title="Bookings" />

                <View className="bg-muted flex-row gap-1 rounded-xl p-1">
                    {(['bookings', 'enquiries'] as const).map((option) => (
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

                {(onEnquiries ? enquiries : bookings) === null ? null : (
                    <BookingFilter
                        filters={chips}
                        counts={counts}
                        total={(onEnquiries ? enquiries : bookings)?.length ?? 0}
                        chosen={narrowed}
                        onChoose={setNarrowed}
                    />
                )}

                {(onEnquiries ? enquiries : bookings) === null
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

                {!onEnquiries && bookings?.length === 0 ? (
                    <Card className="gap-2">
                        <Text className="font-semibold">Nothing booked yet</Text>
                        <Text className="text-muted-foreground text-sm">
                            Pick a trade on the home screen and the work you ask for is tracked
                            here.
                        </Text>
                    </Card>
                ) : null}

                {onEnquiries && enquiries?.length === 0 ? (
                    <Card className="gap-2">
                        <Text className="font-semibold">No prices asked</Text>
                        <Text className="text-muted-foreground text-sm">
                            When a provider does not publish a price, you can ask them for one
                            without booking anything. Those questions land here.
                        </Text>
                    </Card>
                ) : null}

                {(onEnquiries ? asked : listed).length === 0 &&
                ((onEnquiries ? enquiries : bookings)?.length ?? 0) > 0 ? (
                    <Card className="gap-2">
                        <Text className="font-semibold">{`Nothing ${label ?? 'here'}`}</Text>
                        <Text className="text-muted-foreground text-sm">
                            {`The rest of your ${onEnquiries ? 'enquiries' : 'bookings'} are still there under All.`}
                        </Text>
                    </Card>
                ) : null}

                {onEnquiries
                    ? asked.map((enquiry) => (
                          <Link
                              key={enquiry.id}
                              href={{
                                  pathname: '/enquiry/[id]',
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
                                      {enquiry.provider.name}
                                  </Text>
                                  {/* The instruction, not a date -- there isn't one. */}
                                  <Text className="text-muted-foreground text-xs" numberOfLines={1}>
                                      {enquiry.description}
                                  </Text>
                              </Pressable>
                          </Link>
                      ))
                    : null}

                {onEnquiries ? null : listed.map((booking) => (
                    <Link
                        key={booking.id}
                        href={{
                            pathname: '/booking/[id]',
                            params: {
                                id: booking.id,
                                name: booking.service.name,
                                provider: booking.provider.name,
                            },
                        }}
                        asChild
                    >
                        <Pressable
                            accessibilityRole="button"
                            className="border-border bg-card gap-2 rounded-xl border p-4"
                        >
                            <View className="flex-row items-center justify-between gap-3">
                                <Text className="flex-1 font-semibold">
                                    {booking.service.name}
                                </Text>
                                <StatusPill tone={booking.status.tone}>
                                    {booking.status.wording}
                                </StatusPill>
                            </View>
                            <Text className="text-muted-foreground text-sm">
                                {booking.provider.name}
                            </Text>
                            <Text className="text-muted-foreground text-xs">
                                {when(booking.scheduled_at)}
                            </Text>
                        </Pressable>
                    </Link>
                ))}
            </ScrollView>
        </SafeAreaView>
    );
}
