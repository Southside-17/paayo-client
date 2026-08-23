import { router, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { useCallback, useState } from 'react';
import { Pressable, ScrollView, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { BackButton } from '@/components/back-button';
import { Card } from '@/components/ui/card';
import { ScreenHeader } from '@/components/ui/screen-header';
import { Skeleton } from '@/components/ui/skeleton';
import { Text } from '@/components/ui/text';
import { useSession } from '@/lib/session';
import type { Service } from '@/lib/types';
import { useSelectedAddress } from '@/lib/use-selected-address';

/**
 * Go straight where the answer already is.
 *
 * The list carries the provider covering the address, so a tap knows whether it
 * is booking or choosing. Resolving it on the next screen instead is what put a
 * provider picker on screen for an instant before replacing itself.
 */
function open(service: Service, category: string) {
    if (service.covering) {
        router.push({
            pathname: '/book',
            params: {
                listing: service.covering.id,
                service: service.name,
                category,
                provider: service.covering.provider.name,
                covered: '1',
            },
        });

        return;
    }

    router.push({
        pathname: '/service/[id]',
        params: { id: service.id, name: service.name, category },
    });
}

/**
 * The work offered under one trade, near the address that will be worked at.
 */
export default function CategoryServices() {
    const { id, name } = useLocalSearchParams<{ id: string; name?: string }>();
    const session = useSession();
    const { address, ready } = useSelectedAddress();
    const addressId = address?.id;
    const [services, setServices] = useState<Service[] | null>(null);

    const authenticatedRequest =
        session.status === 'authenticated' ? session.authenticatedRequest : null;

    useFocusEffect(
        useCallback(() => {
            // Waiting on the address is what keeps the list from being drawn
            // unfiltered and then shrinking.
            if (!authenticatedRequest || !ready) {
                return;
            }

            const query = new URLSearchParams({ category: id });

            if (addressId) {
                query.set('address', addressId);
            }

            void authenticatedRequest<{ data: Service[] }>(`/services?${query.toString()}`)
                .then(({ data }) => setServices(data))
                .catch(() => setServices([]));
        }, [authenticatedRequest, addressId, ready, id]),
    );

    return (
        <SafeAreaView className="bg-background flex-1">
            <ScrollView contentContainerClassName="gap-5 p-6">
                <BackButton label="Home" />
                {/* The name is carried from the tile that was tapped, so the
                    title is right on the first frame rather than settling from
                    a placeholder once the services arrive. */}
                <ScreenHeader title={name ?? services?.[0]?.category?.name ?? 'Services'} />

                {services === null
                    ? [0, 1, 2].map((at) => (
                          <View
                              key={at}
                              className="border-border bg-card gap-2 rounded-xl border p-4"
                          >
                              <Skeleton className="h-5 w-40" />
                              <Skeleton className="h-4 w-full" />
                              <Skeleton className="h-3 w-20" />
                          </View>
                      ))
                    : null}

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
                    <Pressable
                        key={service.id}
                        accessibilityRole="button"
                        onPress={() => open(service, name ?? service.category?.name ?? 'Back')}
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
                ))}
            </ScrollView>
        </SafeAreaView>
    );
}
