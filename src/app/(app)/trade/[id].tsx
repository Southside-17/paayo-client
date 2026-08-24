import { router, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { useCallback, useState } from 'react';
import { Pressable, ScrollView, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { BackButton } from '@/components/back-button';
import { Card } from '@/components/ui/card';
import { ScreenHeader } from '@/components/ui/screen-header';
import { Skeleton } from '@/components/ui/skeleton';
import { Text } from '@/components/ui/text';
import { remember } from '@/lib/offers';
import { useSession } from '@/lib/session';
import type { Service, ServiceList } from '@/lib/types';
import { useSelectedAddress } from '@/lib/use-selected-address';

/**
 * Go straight to the offer when coverage has already picked one.
 *
 * Straight to the price, not straight to the date picker: who is coming is only
 * half the answer, and skipping the rate card is what made a booking possible
 * without ever seeing a figure.
 */
function open(service: Service, trade: string) {
    if (service.covering) {
        router.push({
            pathname: '/listing/[id]',
            params: {
                id: service.covering.id,
                serviceId: service.id,
                service: service.name,
                trade,
                covered: '1',
            },
        });

        return;
    }

    router.push({
        pathname: '/service/[id]',
        params: { id: service.id, name: service.name, trade },
    });
}

/**
 * The work offered under one trade, near the address that will be worked at.
 */
export default function TradeServices() {
    const { id, name } = useLocalSearchParams<{ id: string; name?: string }>();
    const session = useSession();
    const { address, ready } = useSelectedAddress();
    const addressId = address?.id;
    const [services, setServices] = useState<Service[] | null>(null);

    const authenticatedRequest =
        session.status === 'authenticated' ? session.authenticatedRequest : null;

    useFocusEffect(
        useCallback(() => {
            if (!authenticatedRequest || !ready) {
                return;
            }

            const query = new URLSearchParams({ trade: id });

            if (addressId) {
                query.set('address', addressId);
            }

            void authenticatedRequest<ServiceList>(`/services?${query.toString()}`)
                .then(({ data, market }) => {
                    remember(addressId ?? null, market, data);
                    setServices(data);
                })
                .catch(() => setServices([]));
        }, [authenticatedRequest, addressId, ready, id]),
    );

    return (
        <SafeAreaView className="bg-background flex-1">
            <ScrollView contentContainerClassName="gap-5 p-6">
                <BackButton label="Home" />
                <ScreenHeader title={name ?? services?.[0]?.trade?.name ?? 'Services'} />

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
                        onPress={() => open(service, name ?? service.trade?.name ?? 'Back')}
                        className="border-border bg-card gap-1 rounded-xl border p-4"
                    >
                        <Text className="font-semibold">{service.name}</Text>
                        {service.description ? (
                            <Text className="text-muted-foreground text-sm">
                                {service.description}
                            </Text>
                        ) : null}
                    </Pressable>
                ))}
            </ScrollView>
        </SafeAreaView>
    );
}
