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
import { recall } from '@/lib/offers';
import { useSession } from '@/lib/session';
import type { Booking, Listing, ServiceOffer } from '@/lib/types';
import { useSelectedAddress } from '@/lib/use-selected-address';
import { useSubmit } from '@/lib/use-submit';
import { cn } from '@/lib/utils';

/**
 * Who is coming, and only when that has to be asked.
 */
export default function ServiceOffers() {
    const { id, name, trade, repick } = useLocalSearchParams<{
        id: string;
        name?: string;
        trade?: string;
        /** A booking that was turned down, when this is the client re-picking. */
        repick?: string;
    }>();
    const session = useSession();
    const { address, ready } = useSelectedAddress();
    const addressId = address?.id;
    const [offer, setOffer] = useState<ServiceOffer | null>(() => {
        const known = recall(id, addressId ?? null);

        return known?.covering ? null : known;
    });
    const [failure, setFailure] = useState<string | null>(null);
    const [booking, setBooking] = useState<Booking | null>(null);
    const { busy, submit } = useSubmit();
    const choosing = Boolean(repick);
    const declined = booking?.declines.map((one) => one.listing_id) ?? [];

    const authenticatedRequest =
        session.status === 'authenticated' ? session.authenticatedRequest : null;

    const send = (listing: Listing) =>
        submit(async () => {
            if (session.status !== 'authenticated' || !repick) {
                return;
            }

            await session.authenticatedRequest<{ data: Booking }>(
                `/bookings/${repick}/provider`,
                { method: 'PUT', body: { listing_id: listing.id } },
            );

            await session.reload();

            router.back();
        });

    const book = useCallback(
        (listing: Listing, service: string, covered: boolean) =>
            router.replace({
                pathname: '/book',
                params: {
                    listing: listing.id,
                    service,
                    trade: trade ?? '',
                    provider: listing.provider.name,
                    covered: covered ? '1' : '',
                },
            }),
        [trade],
    );

    useFocusEffect(
        useCallback(() => {
            if (!authenticatedRequest || !ready) {
                return;
            }

            setFailure(null);

            if (choosing) {
                void authenticatedRequest<{ data: Booking }>(`/bookings/${repick}`)
                    .then(({ data }) => setBooking(data))
                    .catch(() => setBooking(null));

                void authenticatedRequest<ServiceOffer>(
                    `/services/${id}?choosing=1${addressId ? `&address=${addressId}` : ''}`,
                )
                    .then(setOffer)
                    .catch(() => setFailure('Could not reach Paayo. Try again.'));

                return;
            }

            const known = recall(id, addressId ?? null);

            if (known) {
                if (known.covering) {
                    book(known.covering, name ?? known.data.name, true);
                } else {
                    setOffer(known);
                }

                return;
            }

            const query = addressId ? `?address=${addressId}` : '';

            void authenticatedRequest<ServiceOffer>(`/services/${id}${query}`)
                .then((answer) => {
                    if (answer.covering) {
                        book(answer.covering, name ?? answer.data.name, true);

                        return;
                    }

                    setOffer(answer);
                })
                .catch((error: unknown) => {
                    setFailure(
                        error instanceof ApiError
                            ? (error.errorFor('address') ?? error.message)
                            : 'Could not reach Paayo. Check your connection and try again.',
                    );
                    setOffer(null);
                });
        }, [authenticatedRequest, addressId, ready, id, name, book, choosing, repick]),
    );

    const service = offer?.data ?? null;
    const alternatives = offer?.alternatives ?? [];

    return (
        <SafeAreaView className="bg-background flex-1">
            <ScrollView contentContainerClassName="gap-5 p-6">
                <BackButton label={choosing ? 'Booking' : (trade ?? service?.trade?.name ?? 'Back')} />
                <ScreenHeader
                    eyebrow={choosing ? 'Choose someone else' : undefined}
                    title={name ?? service?.name ?? 'Service'}
                />

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

                {offer && choosing && alternatives.length > 0 ? (
                    <Card className="gap-2">
                        <Text className="font-semibold">Everyone else who can come</Text>
                        <Text className="text-muted-foreground text-sm">
                            Your photos, address and description stay exactly as they are.
                            Only who is coming changes.
                        </Text>
                    </Card>
                ) : null}

                {offer && !choosing && alternatives.length > 0 ? (
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

                {alternatives.map((listing) => {
                    const refused = declined.includes(listing.id);

                    return (
                    <Pressable
                        key={listing.id}
                        accessibilityRole="button"
                        disabled={refused || busy}
                        onPress={() =>
                            choosing
                                ? void send(listing)
                                : book(listing, name ?? service?.name ?? 'Service', false)
                        }
                    >
                        <Card className={cn('gap-3', refused && 'opacity-50')}>
                            <View className="gap-1">
                                <View className="flex-row items-center gap-2">
                                    <Text className="flex-1 font-semibold">
                                        {listing.provider.name}
                                    </Text>
                                    {refused ? <Badge>turned this down</Badge> : null}
                                </View>
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
                    );
                })}
            </ScrollView>
        </SafeAreaView>
    );
}
