import { Link, router, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { useCallback, useState } from 'react';
import { Pressable, ScrollView, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { ScreenHeader } from '@/components/ui/screen-header';
import { Text } from '@/components/ui/text';
import { useDefaultAddress } from '@/lib/use-default-address';
import { useSession } from '@/lib/session';
import type { Service } from '@/lib/types';

/**
 * The work offered under one trade, near the address that will be worked at.
 */
export default function CategoryServices() {
    const { id } = useLocalSearchParams<{ id: string }>();
    const session = useSession();
    const address = useDefaultAddress();
    const addressId = address?.id;
    const [services, setServices] = useState<Service[] | null>(null);

    const authenticatedRequest =
        session.status === 'authenticated' ? session.authenticatedRequest : null;

    useFocusEffect(
        useCallback(() => {
            if (!authenticatedRequest) {
                return;
            }

            const query = new URLSearchParams({ category: id });

            if (addressId) {
                query.set('address', addressId);
            }

            void authenticatedRequest<{ data: Service[] }>(`/services?${query.toString()}`)
                .then(({ data }) => setServices(data))
                .catch(() => setServices([]));
        }, [authenticatedRequest, addressId, id]),
    );

    const name = services?.[0]?.category?.name ?? 'Services';

    return (
        <SafeAreaView className="bg-background flex-1">
            <ScrollView contentContainerClassName="gap-5 p-6">
                <View className="flex-row items-center justify-between">
                    <ScreenHeader title={name} />
                    <Button variant="ghost" onPress={() => router.back()}>
                        Done
                    </Button>
                </View>

                {services?.length === 0 ? (
                    <Card className="gap-2">
                        <Text className="font-semibold">Nothing offered here yet</Text>
                        <Text className="text-muted-foreground text-sm">
                            {address
                                ? 'No provider covers this address for this trade yet.'
                                : 'Add an address with a pin to see who works near you.'}
                        </Text>
                    </Card>
                ) : null}

                {services?.map((service) => (
                    <Link key={service.id} href={`/service/${service.id}`} asChild>
                        <Pressable
                            accessibilityRole="button"
                            className="border-border bg-card gap-1 rounded-xl border p-4"
                        >
                            <Text className="font-semibold">{service.name}</Text>
                            {service.description ? (
                                <Text className="text-muted-foreground text-sm">
                                    {service.description}
                                </Text>
                            ) : null}
                            <Text className="text-brand text-xs font-medium">
                                {service.pricing_unit.label}
                            </Text>
                        </Pressable>
                    </Link>
                ))}
            </ScrollView>
        </SafeAreaView>
    );
}
