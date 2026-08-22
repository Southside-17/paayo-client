import { Link, useFocusEffect } from 'expo-router';
import { useColorScheme } from 'nativewind';
import { useCallback, useState } from 'react';
import { Pressable, ScrollView, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Avatar } from '@/components/avatar';
import { CategoryIcon } from '@/components/category-icon';
import { Badge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';
import { ScreenHeader } from '@/components/ui/screen-header';
import { Skeleton } from '@/components/ui/skeleton';
import { Text } from '@/components/ui/text';
import { useSession } from '@/lib/session';
import type { Address, Category } from '@/lib/types';
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
    const [categories, setCategories] = useState<Category[] | null>(null);
    const [addresses, setAddresses] = useState<Address[] | null>(null);
    const [seen, setSeen] = useState(0);

    const authenticatedRequest =
        session.status === 'authenticated' ? session.authenticatedRequest : null;

    useFocusEffect(
        useCallback(() => {
            if (!authenticatedRequest) {
                return;
            }

            setSeen((count) => count + 1);

            void authenticatedRequest<{ data: Category[] }>('/categories')
                .then(({ data }) => setCategories(data))
                .catch(() => setCategories([]));

            void authenticatedRequest<{ data: Address[] }>('/addresses')
                .then(({ data }) => setAddresses(data))
                .catch(() => setAddresses([]));
        }, [authenticatedRequest]),
    );

    if (session.status !== 'authenticated') {
        return null;
    }

    const { user } = session;
    const primary = addresses?.find((address) => address.is_default) ?? addresses?.[0] ?? null;

    return (
        <SafeAreaView className="bg-background flex-1" edges={['top']}>
            <ScrollView contentContainerClassName="gap-5 p-6">
                <ScreenHeader eyebrow={greeting(new Date().getHours())} title={user.nickname}>
                    <Avatar
                        nickname={user.nickname}
                        avatar={user.avatar}
                        token={session.token}
                        version={seen}
                        size={44}
                    />
                </ScreenHeader>

                <Link href="/profile/addresses" asChild>
                    <Pressable className="border-border bg-card flex-row items-center gap-2 rounded-xl border px-4 py-3">
                        <View className="flex-1 gap-0.5">
                            <Text className="text-muted-foreground text-xs">Work happens at</Text>
                            {/* Nothing until it is known. Saying "Add an address"
                                first and correcting it a moment later reads as a
                                glitch, and it is one. */}
                            {addresses === null ? (
                                <Skeleton className="h-5 w-28" />
                            ) : primary ? (
                                <View className="flex-row items-center gap-2">
                                    <Text className="font-medium">{primary.label}</Text>
                                    {primary.latitude === null ? (
                                        <Badge tone="warning">No pin</Badge>
                                    ) : null}
                                </View>
                            ) : (
                                <Text className="font-medium">Add an address</Text>
                            )}
                        </View>
                        <Text className="text-brand text-sm font-semibold">Change</Text>
                    </Pressable>
                </Link>

                <View className="gap-3">
                    <Text className="font-semibold">What do you need done?</Text>

                    {categories === null ? (
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

                    {categories?.length === 0 ? (
                        <Card className="gap-2">
                            <Text className="font-semibold">Nothing on offer yet</Text>
                            <Text className="text-muted-foreground text-sm">
                                No trades have been opened for your area. This fills in as providers
                                are listed.
                            </Text>
                        </Card>
                    ) : null}

                    <View className="flex-row flex-wrap gap-3">
                        {categories?.map((category) => (
                            <Link
                                key={category.id}
                                href={{
                                    pathname: '/category/[id]',
                                    params: { id: category.id, name: category.name },
                                }}
                                asChild
                            >
                                <Pressable
                                    accessibilityRole="button"
                                    className="border-border bg-card grow basis-[30%] items-center gap-2 rounded-xl border px-2 py-4"
                                >
                                    <View className="bg-brand-subtle size-11 items-center justify-center rounded-xl">
                                        <CategoryIcon
                                            icon={category.icon}
                                            color={colours.brand}
                                            size={21}
                                        />
                                    </View>
                                    <Text className="text-center text-xs font-semibold">
                                        {category.name}
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
