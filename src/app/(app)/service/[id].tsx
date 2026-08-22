import { Link, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { useCallback, useState } from 'react';
import { ScrollView, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Badge } from '@/components/ui/badge';
import { BackButton } from '@/components/back-button';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { ScreenHeader } from '@/components/ui/screen-header';
import { Skeleton } from '@/components/ui/skeleton';
import { Text } from '@/components/ui/text';
import { peso, priceRange } from '@/lib/money';
import { useDefaultAddress } from '@/lib/use-default-address';
import { useSession } from '@/lib/session';
import type { Service } from '@/lib/types';

/**
 * One service, and the providers who could actually be sent to the address.
 */
export default function ServiceOffers() {
    const { id } = useLocalSearchParams<{ id: string }>();
    const session = useSession();
    const { address, ready } = useDefaultAddress();
    const addressId = address?.id;
    const [service, setService] = useState<Service | null>(null);

    const authenticatedRequest =
        session.status === 'authenticated' ? session.authenticatedRequest : null;

    useFocusEffect(
        useCallback(() => {
            // Waiting on the address is what keeps the list from being drawn
            // unfiltered and then shrinking.
            if (!authenticatedRequest || !ready) {
                return;
            }

            const query = addressId ? `?address=${addressId}` : '';

            void authenticatedRequest<{ data: Service }>(`/services/${id}${query}`)
                .then(({ data }) => setService(data))
                .catch(() => setService(null));
        }, [authenticatedRequest, addressId, ready, id]),
    );

    const listings = service?.listings ?? [];

    return (
        <SafeAreaView className="bg-background flex-1">
            <ScrollView contentContainerClassName="gap-5 p-6">
                <BackButton label={service?.category?.name ?? 'Back'} />
                <ScreenHeader
                    eyebrow={service?.category?.name}
                    title={service?.name ?? 'Service'}
                />

                {service?.description ? (
                    <Text className="text-muted-foreground text-sm">{service.description}</Text>
                ) : null}

                {service === null
                    ? [0, 1].map((at) => (
                          <Card key={at} className="gap-3">
                              <Skeleton className="h-5 w-44" />
                              <Skeleton className="h-6 w-32" />
                              <Skeleton className="h-12 w-full rounded-lg" />
                          </Card>
                      ))
                    : null}

                {service && listings.length === 0 ? (
                    <Card className="gap-2">
                        <Text className="font-semibold">Nobody covers this yet</Text>
                        <Text className="text-muted-foreground text-sm">
                            {address
                                ? 'No provider offering this works at your address.'
                                : 'Add an address with a pin to see who works near you.'}
                        </Text>
                    </Card>
                ) : null}

                {listings.map((listing) => (
                    <Card key={listing.id} className="gap-3">
                        <View className="gap-1">
                            <Text className="font-semibold">{listing.provider.name}</Text>
                            {listing.description ? (
                                <Text className="text-muted-foreground text-sm">
                                    {listing.description}
                                </Text>
                            ) : null}
                        </View>

                        <View className="flex-row items-center gap-2">
                            <Text className="text-lg font-bold">
                                {service
                                    ? priceRange(
                                          listing.price_min,
                                          listing.price_max,
                                          service.pricing_unit,
                                      )
                                    : ''}
                            </Text>
                            {listing.surcharge ? (
                                <Badge tone="warning">{`+${peso(listing.surcharge)} trip`}</Badge>
                            ) : null}
                        </View>

                        <Link
                            href={{ pathname: '/book', params: { listing: listing.id } }}
                            asChild
                        >
                            <Button variant="brand">Book this provider</Button>
                        </Link>
                    </Card>
                ))}
            </ScrollView>
        </SafeAreaView>
    );
}
