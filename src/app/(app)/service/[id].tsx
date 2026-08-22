import { router, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { useCallback, useState } from 'react';
import { Pressable, ScrollView, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { BackButton } from '@/components/back-button';
import { FormMessage } from '@/components/form-message';
import { Badge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';
import { ScreenHeader } from '@/components/ui/screen-header';
import { Skeleton } from '@/components/ui/skeleton';
import { Text } from '@/components/ui/text';
import { ApiError } from '@/lib/api';
import { peso, priceRange } from '@/lib/money';
import { useSession } from '@/lib/session';
import type { Listing, ServiceOffer } from '@/lib/types';
import { useDefaultAddress } from '@/lib/use-default-address';

/**
 * Who is coming, and only when that has to be asked.
 *
 * A provider covering the address is chosen without asking and this screen
 * hands straight over to booking. The list below is the other case: nobody
 * covers that zone for this service, so the client picks from the market.
 */
export default function ServiceOffers() {
    const { id, name, category } = useLocalSearchParams<{
        id: string;
        name?: string;
        category?: string;
    }>();
    const session = useSession();
    const { address, ready } = useDefaultAddress();
    const addressId = address?.id;
    const [offer, setOffer] = useState<ServiceOffer | null>(null);
    const [failure, setFailure] = useState<string | null>(null);

    const authenticatedRequest =
        session.status === 'authenticated' ? session.authenticatedRequest : null;

    const book = useCallback(
        (listing: Listing, service: string, covered: boolean) =>
            router.replace({
                pathname: '/book',
                params: {
                    listing: listing.id,
                    service,
                    category: category ?? '',
                    provider: listing.provider.name,
                    covered: covered ? '1' : '',
                },
            }),
        [category],
    );

    useFocusEffect(
        useCallback(() => {
            // Waiting on the address is what keeps the list from being drawn
            // unfiltered and then shrinking.
            if (!authenticatedRequest || !ready) {
                return;
            }

            const query = addressId ? `?address=${addressId}` : '';

            setFailure(null);

            void authenticatedRequest<ServiceOffer>(`/services/${id}${query}`)
                .then((answer) => {
                    // Covered ground: there is nothing to choose, so this screen
                    // never becomes a step the client sees.
                    if (answer.covering) {
                        book(answer.covering, name ?? answer.data.name, true);

                        return;
                    }

                    setOffer(answer);
                })
                .catch((error: unknown) => {
                    // Never silent. A refusal that explains itself -- an address
                    // with no pin, most often -- has to reach the screen, or
                    // this sits on a skeleton forever and says nothing.
                    setFailure(
                        error instanceof ApiError
                            ? (error.errorFor('address') ?? error.message)
                            : 'Could not reach Paayo. Check your connection and try again.',
                    );
                    setOffer(null);
                });
        }, [authenticatedRequest, addressId, ready, id, name, book]),
    );

    const service = offer?.data ?? null;
    const alternatives = offer?.alternatives ?? [];

    return (
        <SafeAreaView className="bg-background flex-1">
            <ScrollView contentContainerClassName="gap-5 p-6">
                {/* Both names travel with the link. The row that was tapped
                    already knew them, so nothing here settles from a
                    placeholder once the providers arrive. */}
                <BackButton label={category ?? service?.category?.name ?? 'Back'} />
                <ScreenHeader title={name ?? service?.name ?? 'Service'} />

                {failure !== null ? <FormMessage message={failure} /> : null}

                {offer === null && failure === null ? (
                    <>
                        <Skeleton className="h-4 w-3/4" />
                        {[0, 1].map((at) => (
                            <Card key={at} className="gap-3">
                                <Skeleton className="h-5 w-44" />
                                <Skeleton className="h-6 w-32" />
                            </Card>
                        ))}
                    </>
                ) : null}

                {offer && alternatives.length > 0 ? (
                    <Card className="border-warning/40 bg-warning-subtle gap-2">
                        <Text className="font-semibold">
                            {`No one covers your area for ${name ?? service?.name ?? 'this'}`}
                        </Text>
                        <Text className="text-muted-foreground text-sm">
                            {`These providers offer it elsewhere in ${offer.market?.name ?? 'your area'} and can still take the job, but they may add a travel charge when they accept.`}
                        </Text>
                    </Card>
                ) : null}

                {offer && alternatives.length === 0 && address && !address.latitude ? (
                    <Card className="gap-2">
                        <Text className="font-semibold">{address.label} has no pin</Text>
                        <Text className="text-muted-foreground text-sm">
                            Nobody can be matched to it. Open the address and drop a pin on
                            the map.
                        </Text>
                    </Card>
                ) : null}

                {offer && alternatives.length === 0 && (!address || address.latitude) ? (
                    <Card className="gap-2">
                        <Text className="font-semibold">Nobody offers this yet</Text>
                        <Text className="text-muted-foreground text-sm">
                            {`No provider working ${offer.market?.name ?? 'your area'} offers this service.`}
                        </Text>
                    </Card>
                ) : null}

                {alternatives.map((listing) => (
                    <Pressable
                        key={listing.id}
                        accessibilityRole="button"
                        onPress={() => book(listing, name ?? service?.name ?? 'Service', false)}
                    >
                        <Card className="gap-3">
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
                        </Card>
                    </Pressable>
                ))}
            </ScrollView>
        </SafeAreaView>
    );
}
