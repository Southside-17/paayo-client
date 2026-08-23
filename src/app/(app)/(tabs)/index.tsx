import { Link, useFocusEffect } from 'expo-router';
import { useColorScheme } from 'nativewind';
import { useCallback, useState } from 'react';
import { Pressable, ScrollView, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { AddressSheet } from '@/components/address-sheet';
import { Avatar } from '@/components/avatar';
import { TradeIcon } from '@/components/trade-icon';
import { Badge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';
import { ScreenHeader } from '@/components/ui/screen-header';
import { Skeleton } from '@/components/ui/skeleton';
import { Text } from '@/components/ui/text';
import { useAddresses } from '@/lib/addresses';
import { useSession } from '@/lib/session';
import type { Trade } from '@/lib/types';
import palette from '@/theme/palette';

/** The greeting the header opens with, by the reader's own clock. */
function greeting(hour: number): string {
    if (hour < 12) {
        return 'Good morning';
    }

    return hour < 18 ? 'Good afternoon' : 'Good evening';
}

/**
 * What can be booked, and where it would happen.
 */
export default function Home() {
    const session = useSession();
    const { colorScheme } = useColorScheme();
    const colours = palette[colorScheme ?? 'light'];
    const [trades, setTrades] = useState<Trade[] | null>(null);
    const [choosing, setChoosing] = useState(false);
    const { addresses, address, ready, select } = useAddresses();

    const authenticatedRequest =
        session.status === 'authenticated' ? session.authenticatedRequest : null;

    useFocusEffect(
        useCallback(() => {
            if (!authenticatedRequest) {
                return;
            }

            void authenticatedRequest<{ data: Trade[] }>('/trades')
                .then(({ data }) => setTrades(data))
                .catch(() => setTrades([]));
        }, [authenticatedRequest]),
    );

    if (session.status !== 'authenticated') {
        return null;
    }

    const { user } = session;

    return (
        <SafeAreaView className="bg-background flex-1" edges={['top']}>
            <ScrollView contentContainerClassName="gap-5 p-6">
                <ScreenHeader eyebrow={greeting(new Date().getHours())} title={user.nickname}>
                    <Avatar nickname={user.nickname} url={user.avatar_url} size={44} />
                </ScreenHeader>

                <Pressable
                    accessibilityRole="button"
                    onPress={() => setChoosing(true)}
                    className="border-border bg-card flex-row items-center gap-2 rounded-xl border px-4 py-3"
                >
                    <View className="flex-1 gap-0.5">
                        <Text className="text-muted-foreground text-xs">Work happens at</Text>
                        {!ready ? (
                            <Skeleton className="h-5 w-28" />
                        ) : address ? (
                            <Text className="font-medium">{address.label}</Text>
                        ) : (
                            <View className="flex-row items-center gap-2">
                                <Text className="font-medium">
                                    {addresses.length === 0 ? 'Add an address' : 'Drop a pin'}
                                </Text>
                                {addresses.length === 0 ? null : (
                                    <Badge tone="warning">No pin</Badge>
                                )}
                            </View>
                        )}
                    </View>
                    <Text className="text-brand text-sm font-semibold">Change</Text>
                </Pressable>

                <AddressSheet
                    open={choosing}
                    addresses={addresses}
                    selected={address}
                    onSelect={(chosen) => {
                        select(chosen);
                        setChoosing(false);
                    }}
                    onDismiss={() => setChoosing(false)}
                />

                <View className="gap-3">
                    <Text className="font-semibold">What do you need done?</Text>

                    {trades === null ? (
                        <View className="flex-row flex-wrap gap-3">
                            {[0, 1, 2].map((at) => (
                                <View
                                    key={at}
                                    className="border-border bg-card grow basis-[30%] items-center gap-2 rounded-xl border px-2 py-4"
                                >
                                    <Skeleton className="size-11 rounded-xl" />
                                    <Skeleton className="h-3 w-16 rounded-full" />
                                </View>
                            ))}
                        </View>
                    ) : null}

                    {trades?.length === 0 ? (
                        <Card className="gap-2">
                            <Text className="font-semibold">Nothing on offer yet</Text>
                            <Text className="text-muted-foreground text-sm">
                                No trades have been opened for your area. This fills in as providers
                                are listed.
                            </Text>
                        </Card>
                    ) : null}

                    <View className="flex-row flex-wrap gap-3">
                        {trades?.map((trade) => (
                            <Link
                                key={trade.id}
                                href={{
                                    pathname: '/trade/[id]',
                                    params: { id: trade.id, name: trade.name },
                                }}
                                asChild
                            >
                                <Pressable
                                    accessibilityRole="button"
                                    className="border-border bg-card grow basis-[30%] items-center gap-2 rounded-xl border px-2 py-4"
                                >
                                    <View className="bg-brand-subtle size-11 items-center justify-center rounded-xl">
                                        <TradeIcon
                                            icon={trade.icon}
                                            color={colours.brand}
                                            size={21}
                                        />
                                    </View>
                                    <Text className="text-center text-xs font-semibold">
                                        {trade.name}
                                    </Text>
                                </Pressable>
                            </Link>
                        ))}
                    </View>
                </View>
            </ScrollView>
        </SafeAreaView>
    );
}
