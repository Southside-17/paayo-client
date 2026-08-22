import { Link, useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { Pressable, ScrollView, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Card } from '@/components/ui/card';
import { ScreenHeader } from '@/components/ui/screen-header';
import { Skeleton } from '@/components/ui/skeleton';
import { StatusPill } from '@/components/ui/status-pill';
import { Text } from '@/components/ui/text';
import { useSession } from '@/lib/session';
import type { Booking } from '@/lib/types';

/** The day and hour a visit is set for, as one line. */
export function when(scheduled: string): string {
    return new Date(scheduled).toLocaleString('en-PH', {
        weekday: 'short',
        day: 'numeric',
        month: 'short',
        hour: 'numeric',
        minute: '2-digit',
    });
}

/**
 * The work this account has asked for.
 */
export default function Bookings() {
    const session = useSession();
    const [bookings, setBookings] = useState<Booking[] | null>(null);

    const authenticatedRequest =
        session.status === 'authenticated' ? session.authenticatedRequest : null;

    useFocusEffect(
        useCallback(() => {
            if (!authenticatedRequest) {
                return;
            }

            void authenticatedRequest<{ data: Booking[] }>('/bookings')
                .then(({ data }) => setBookings(data))
                .catch(() => setBookings([]));
        }, [authenticatedRequest]),
    );

    return (
        <SafeAreaView className="bg-background flex-1" edges={['top']}>
            <ScrollView contentContainerClassName="gap-4 p-6">
                <ScreenHeader title="Bookings" />

                {bookings === null
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

                {bookings?.length === 0 ? (
                    <Card className="gap-2">
                        <Text className="font-semibold">Nothing booked yet</Text>
                        <Text className="text-muted-foreground text-sm">
                            Pick a trade on the home screen and the work you ask for is tracked
                            here.
                        </Text>
                    </Card>
                ) : null}

                {bookings?.map((booking) => (
                    <Link key={booking.id} href={`/booking/${booking.id}`} asChild>
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
