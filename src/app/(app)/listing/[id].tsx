import { router, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { useCallback, useState } from 'react';
import { Pressable, ScrollView, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { BackButton } from '@/components/back-button';
import { FormMessage } from '@/components/form-message';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { KeyboardAvoiding } from '@/components/ui/keyboard-avoiding';
import { Label } from '@/components/ui/label';
import { ScreenHeader } from '@/components/ui/screen-header';
import { Skeleton } from '@/components/ui/skeleton';
import { Text } from '@/components/ui/text';
import { basket, peso, priceRange, rateLine, workings } from '@/lib/money';
import { carry, recall } from '@/lib/offers';
import { useSession } from '@/lib/session';
import type { BookedLine, Listing, RateLine, ServiceOffer } from '@/lib/types';
import { useSelectedAddress } from '@/lib/use-selected-address';
import { cn } from '@/lib/utils';

/**
 * Read the minutes on an hourly line back as something a person would say.
 */
function span(line: RateLine): string | null {
    if (line.estimated_minutes === null) {
        return null;
    }

    const hours = (minutes: number) =>
        minutes % 60 === 0 ? `${minutes / 60}` : (minutes / 60).toFixed(1);

    const usual = `Usually about ${hours(line.estimated_minutes)} hours`;

    return line.maximum_minutes === null
        ? `${usual}.`
        : `${usual}, and they stop at ${hours(line.maximum_minutes)}.`;
}

/**
 * Say why there is no figure yet, rather than leaving the line blank.
 *
 * An empty caption under a price band reads as something failing to load; each
 * of these is the actual reason, in the order the reasons apply.
 */
function footnote({
    booked,
    unsure,
    onRequest,
    priced,
}: {
    booked: BookedLine[];
    unsure: boolean;
    onRequest: boolean;
    priced: boolean;
}): string {
    if (onRequest) {
        return 'Nothing to pay until you have agreed a figure.';
    }

    if (unsure) {
        return priced
            ? 'Or pick from their prices above to see a figure.'
            : 'They will give you a figure before any work starts.';
    }

    if (booked.some((line) => line.unit === 'hour')) {
        return 'They count the hours when the work is done.';
    }

    const uncounted = booked.filter((line) => line.unit !== null && line.quantity === null);

    return uncounted.length > 0
        ? 'Say how many to see a figure, or leave it for them to measure.'
        : booked.map((line) => workings(line, line.quantity) ?? line.label).join('  +  ');
}

/**
 * What a provider charges for a service, before anybody commits to a date.
 */
export default function ListingDetail() {
    const { id, service, serviceId, trade, covered } = useLocalSearchParams<{
        id: string;
        service?: string;
        serviceId?: string;
        trade?: string;
        /** '1' when coverage chose them, absent when the client did. */
        covered?: string;
    }>();
    const session = useSession();
    const { address, ready } = useSelectedAddress();
    const addressId = address?.id;
    const [listing, setListing] = useState<Listing | null>(null);
    const [failure, setFailure] = useState<string | null>(null);
    const [picked, setPicked] = useState<Record<string, string>>({});
    const [answers, setAnswers] = useState<Record<string, string>>({});

    const authenticatedRequest =
        session.status === 'authenticated' ? session.authenticatedRequest : null;

    useFocusEffect(
        useCallback(() => {
            if (!authenticatedRequest || !ready || !serviceId) {
                return;
            }

            const known = recall(serviceId, addressId ?? null);
            const found =
                known?.covering?.id === id
                    ? known.covering
                    : (known?.alternatives?.find((one) => one.id === id) ?? null);

            if (found) {
                setListing(found);

                return;
            }

            const query = addressId ? `?address=${addressId}` : '';

            void authenticatedRequest<ServiceOffer>(`/services/${serviceId}${query}`)
                .then((answer) => {
                    const match =
                        answer.covering?.id === id
                            ? answer.covering
                            : (answer.alternatives?.find((one) => one.id === id) ?? null);

                    if (match === null) {
                        setFailure('This offer is no longer available.');

                        return;
                    }

                    setListing(match);
                })
                .catch(() => setFailure('Could not reach Paayo. Try again.'));
        }, [authenticatedRequest, addressId, ready, id, serviceId]),
    );

    const offered = listing?.rates.filter((line) => line.is_active) ?? [];
    const onRequest = listing?.pricing_method.is_on_request ?? false;
    const many = listing?.allows_many_lines ?? false;
    const chosen = offered.filter((line) => line.label in picked);
    const countOf = (label: string) => {
        const typed = picked[label] ?? '';

        return /^\d+$/.test(typed) ? Number(typed) : null;
    };
    const asksCount = (line: RateLine) => line.unit !== null && line.unit !== 'hour';
    const booked = chosen.map((line) => ({ ...line, quantity: countOf(line.label) }));
    const total = basket(booked);
    // Picking nothing IS letting them look: no separate flag to keep in step.
    const unsure = booked.length === 0;

    /**
     * Tapping a picked line clears it. On a single-pick card, tapping another
     * replaces it -- there is never a state a client cannot get out of.
     */
    const toggle = (label: string) => {
        setPicked((held) => {
            if (label in held) {
                const { [label]: gone, ...rest } = held;

                return rest;
            }

            return many ? { ...held, [label]: '' } : { [label]: '' };
        });
    };

    const proceed = () => {
        if (listing === null) {
            return;
        }

        router.push({
            pathname: '/book',
            params: {
                listing: listing.id,
                carried: carry(listing, answers, booked),
                service: service ?? '',
                trade: trade ?? '',
                provider: listing.provider.name,
                covered: covered ?? '',
            },
        });
    };

    return (
        <SafeAreaView className="bg-background flex-1">
            <KeyboardAvoiding className="flex-1">
                <ScrollView
                    contentContainerClassName="gap-5 p-6"
                    keyboardShouldPersistTaps="handled"
                >
                    <BackButton label={service || trade || 'Back'} />
                    <ScreenHeader
                        eyebrow={service}
                        title={listing?.provider.name ?? 'Provider'}
                    />

                    {failure !== null ? <FormMessage message={failure} /> : null}

                    {listing === null && failure === null ? (
                        <>
                            <Card className="gap-3">
                                <Skeleton className="h-5 w-40" />
                                <Skeleton className="h-4 w-3/4" />
                            </Card>
                            <Card className="gap-3">
                                <Skeleton className="h-12 w-full" />
                                <Skeleton className="h-12 w-full" />
                            </Card>
                        </>
                    ) : null}

                    {listing ? (
                        <>
                            <Card className="gap-2">
                                <Text className="text-muted-foreground text-sm">
                                    {covered === '1'
                                        ? 'They cover your area for this service.'
                                        : 'They work elsewhere in your area and may add a travel charge when they accept.'}
                                </Text>
                                {listing.description ? (
                                    <Text className="text-sm">{listing.description}</Text>
                                ) : null}
                                {listing.surcharge ? (
                                    <Badge tone="warning">
                                        {`+${peso(listing.surcharge)} trip charge`}
                                    </Badge>
                                ) : null}
                            </Card>

                            {onRequest ? (
                                <Card className="gap-2">
                                    <Label>They price this after seeing it</Label>
                                    <Text className="text-muted-foreground text-sm">
                                        This kind of work cannot be costed from a list.
                                        Answer what you can below and they will come back
                                        with a figure.
                                    </Text>
                                </Card>
                            ) : null}

                            {!onRequest && offered.length > 0 ? (
                                <Card className="gap-3">
                                    <Label>Which of these do you need?</Label>

                                    <Pressable
                                        accessibilityRole="button"
                                        accessibilityLabel="Let them assess it"
                                        accessibilityState={{ selected: unsure }}
                                        onPress={() => setPicked({})}
                                        className={cn(
                                            'rounded-lg border p-3',
                                            unsure
                                                ? 'border-brand bg-brand-subtle'
                                                : 'border-border bg-card',
                                        )}
                                    >
                                        <Text
                                            className={cn('font-medium', unsure && 'text-brand')}
                                        >
                                            Let them assess it
                                        </Text>
                                        <Text className="text-muted-foreground text-sm">
                                            They will price it when they see the job.
                                        </Text>
                                    </Pressable>

                                    {offered.map((line) => {
                                        const active = line.label in picked;
                                        const said = line.unit === 'hour' ? span(line) : null;

                                        return (
                                            <View key={line.label} className="gap-1.5">
                                                <Pressable
                                                    accessibilityRole="button"
                                                    accessibilityState={{ selected: active }}
                                                    onPress={() => toggle(line.label)}
                                                    className={cn(
                                                        'flex-row items-center gap-3 rounded-lg border p-3',
                                                        active
                                                            ? 'border-brand bg-brand-subtle'
                                                            : 'border-border bg-card',
                                                    )}
                                                >
                                                    <View className="flex-1 gap-0.5">
                                                        <Text
                                                            className={cn(
                                                                'font-medium',
                                                                active && 'text-brand',
                                                            )}
                                                        >
                                                            {line.label}
                                                        </Text>
                                                        {said ? (
                                                            <Text className="text-muted-foreground text-sm">
                                                                {said}
                                                            </Text>
                                                        ) : null}
                                                    </View>
                                                    <Text
                                                        className={cn(
                                                            'font-semibold',
                                                            active && 'text-brand',
                                                        )}
                                                    >
                                                        {rateLine(line)}
                                                    </Text>
                                                </Pressable>

                                                {active && asksCount(line) ? (
                                                    <View className="gap-1.5 pl-3">
                                                        <Input
                                                            value={picked[line.label] ?? ''}
                                                            onChangeText={(text) =>
                                                                setPicked((held) => ({
                                                                    ...held,
                                                                    [line.label]: text.replace(
                                                                        /[^0-9]/g,
                                                                        '',
                                                                    ),
                                                                }))
                                                            }
                                                            inputMode="numeric"
                                                            placeholder={`How many ${line.unit}?`}
                                                            accessibilityLabel={`How many ${line.label}`}
                                                        />
                                                        <Text className="text-muted-foreground text-sm">
                                                            {workings(line, countOf(line.label)) ??
                                                                'A rough number is fine. They measure on site.'}
                                                        </Text>
                                                    </View>
                                                ) : null}
                                            </View>
                                        );
                                    })}

                                    <Text className="text-muted-foreground text-sm">
                                        {many
                                            ? 'Pick as many as you know you need. Tap one again to remove it.'
                                            : 'Pick one if you know which. Tap it again to clear it.'}
                                    </Text>
                                </Card>
                            ) : null}

                            {!onRequest && offered.length === 0 ? (
                                <Card className="gap-2">
                                    <Label>No prices listed yet</Label>
                                    <Text className="text-muted-foreground text-sm">
                                        You can still ask them to come. They will give you a
                                        figure before any work starts.
                                    </Text>
                                </Card>
                            ) : null}

                            {listing.intake.length > 0 ? (
                                <Card className="gap-3">
                                    <Label>A few questions from them</Label>
                                    {listing.intake.map((question) => (
                                        <View key={question} className="gap-1.5">
                                            <Text className="text-sm font-medium">
                                                {question}
                                            </Text>
                                            <Input
                                                value={answers[question] ?? ''}
                                                onChangeText={(text) =>
                                                    setAnswers((held) => ({
                                                        ...held,
                                                        [question]: text,
                                                    }))
                                                }
                                                accessibilityLabel={question}
                                            />
                                        </View>
                                    ))}
                                    <Text className="text-muted-foreground text-sm">
                                        All optional. Anything you know helps them come
                                        prepared.
                                    </Text>
                                </Card>
                            ) : null}

                            <View className="gap-2">
                                <View className="gap-0.5">
                                    <Text className="text-xl font-bold">
                                        {total ??
                                            priceRange(
                                                listing.price_min,
                                                listing.price_max,
                                                listing.pricing_method,
                                            )}
                                    </Text>
                                    <Text className="text-muted-foreground text-sm">
                                        {footnote({
                                            booked,
                                            unsure,
                                            onRequest,
                                            priced: offered.length > 0,
                                        })}
                                    </Text>
                                </View>
                                <Button onPress={proceed}>Continue</Button>
                            </View>
                        </>
                    ) : null}
                </ScrollView>
            </KeyboardAvoiding>
        </SafeAreaView>
    );
}
