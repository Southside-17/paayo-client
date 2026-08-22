import { Link, router, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { useCallback, useState } from 'react';
import { Pressable, ScrollView, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { ScreenHeader } from '@/components/ui/screen-header';
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
    const address = useDefaultAddress();
    const addressId = address?.id;
    const [service, setService] = useState<Service | null>(null);

    const authenticatedRequest =
        session.status === 'authenticated' ? session.authenticatedRequest : null;

    useFocusEffect(
        useCallback(() => {
            if (!authenticatedRequest) {
                return;
            }

            const query = addressId ? `?address=${addressId}` : '';

            void authenticatedRequest<{ data: Service }>(`/services/${id}${query}`)
                .then(({ data }) => setService(data))
                .catch(() => setService(null));
        }, [authenticatedRequest, addressId, id]),
    );

    const listings = service?.listings ?? [];

    return (
        <SafeAreaView className="bg-background flex-1">
            <ScrollView contentContainerClassName="gap-5 p-6">
                <View className="flex-row items-start justify-between">
                    <ScreenHeader
                        eyebrow={service?.category?.name}
                        title={service?.name ?? 'Service'}
                    />
                    <Button variant="ghost" onPress={() => router.back()}>
                        Done
                    </Button>
                </View>

                {service?.description ? (
                    <Text className="text-muted-foreground text-sm">{service.description}</Text>
                ) : null}

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
                            <Pressable>
                                <Button variant="brand">Book this provider</Button>
                            </Pressable>
                        </Link>
                    </Card>
                ))}
            </ScrollView>
        </SafeAreaView>
    );
}
