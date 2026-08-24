import { router, useFocusEffect } from 'expo-router';
import { useCallback, useMemo, useState } from 'react';
import { Pressable, ScrollView, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useColorScheme } from 'nativewind';

import { BusinessChip } from '@/components/business-chip';
import { HoldNotice } from '@/components/hold-notice';
import { TradeIcon } from '@/components/trade-icon';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { KeyboardAvoiding } from '@/components/ui/keyboard-avoiding';
import { ScreenHeader } from '@/components/ui/screen-header';
import { Skeleton } from '@/components/ui/skeleton';
import { StatusPill } from '@/components/ui/status-pill';
import { Text } from '@/components/ui/text';
import { priceRange } from '@/lib/money';
import { useSession } from '@/lib/session';
import type { ProviderListing, Service, Trade } from '@/lib/types';
import { cn } from '@/lib/utils';
import { useWorkspace } from '@/lib/workspace';
import palette from '@/theme/palette';

type Showing = 'offers' | 'catalog';

type Group = { trade: Trade | null; offers: ProviderListing[] };

/**
 * The offers, in the trade order the server sent them in.
 *
 * The rows already arrive sorted by trade and then by service, so a group ends
 * the moment the trade changes -- no lookup table, and no second sort that
 * could disagree with the one the server did.
 */
function byTrade(offers: ProviderListing[]): Group[] {
    return offers.reduce<Group[]>((groups, offer) => {
        const trade = offer.service.trade ?? null;
        const last = groups[groups.length - 1];

        if (last && last.trade?.id === trade?.id) {
            last.offers.push(offer);

            return groups;
        }

        return [...groups, { trade, offers: [offer] }];
    }, []);
}

/**
 * What this business sells, and what else Paayo publishes.
 */
export default function Services() {
    const session = useSession();
    const { staff } = useWorkspace();
    const { colorScheme } = useColorScheme();
    const colours = palette[colorScheme ?? 'light'];
    const [showing, setShowing] = useState<Showing>('offers');
    const [offers, setOffers] = useState<ProviderListing[] | null>(null);
    const [catalog, setCatalog] = useState<Trade[] | null>(null);
    const [failed, setFailed] = useState(false);
    const [search, setSearch] = useState('');

    const authenticatedRequest =
        session.status === 'authenticated' ? session.authenticatedRequest : null;
    const provider = staff?.provider.id ?? null;

    const load = useCallback(() => {
        if (!authenticatedRequest || !provider) {
            return;
        }

        setFailed(false);

        void Promise.all([
            authenticatedRequest<{ data: ProviderListing[] }>(`/providers/${provider}/listings`),
            authenticatedRequest<{ data: Trade[] }>('/trades'),
        ])
            .then(([sold, published]) => {
                setOffers(sold.data);
                setCatalog(published.data);
            })
            .catch(() => setFailed(true));
    }, [authenticatedRequest, provider]);

    useFocusEffect(load);

    /** The services this business already sells, by service id. */
    const sold = useMemo(
        () => new Map((offers ?? []).map((offer) => [offer.service.id, offer])),
        [offers],
    );

    const filtered = useMemo(() => {
        const term = search.trim().toLowerCase();

        if (term === '') {
            return catalog ?? [];
        }

        return (catalog ?? [])
            .map((trade) => ({
                ...trade,
                services: (trade.services ?? []).filter(
                    (service) =>
                        service.name.toLowerCase().includes(term) ||
                        trade.name.toLowerCase().includes(term),
                ),
            }))
            .filter((trade) => (trade.services ?? []).length > 0);
    }, [catalog, search]);

    const found = filtered.reduce((count, trade) => count + (trade.services?.length ?? 0), 0);

    if (!staff) {
        return null;
    }

    return (
        <SafeAreaView className="bg-background flex-1" edges={['top']}>
            <KeyboardAvoiding className="flex-1">
                <ScrollView
                    contentContainerClassName="gap-4 p-6"
                    keyboardShouldPersistTaps="handled"
                >
                    <ScreenHeader title="Services">
                        <BusinessChip />
                    </ScreenHeader>

                    <HoldNotice suspension={staff.provider.suspension} />

                    <View className="bg-muted flex-row gap-1 rounded-xl p-1">
                        {(['offers', 'catalog'] as const).map((option) => (
                            <Text
                                key={option}
                                accessibilityRole="button"
                                accessibilityState={{ selected: showing === option }}
                                onPress={() => setShowing(option)}
                                className={cn(
                                    'flex-1 rounded-lg py-2 text-center text-sm font-bold capitalize',
                                    showing === option
                                        ? 'bg-card text-foreground'
                                        : 'text-muted-foreground',
                                )}
                            >
                                {option}
                            </Text>
                        ))}
                    </View>

                    {failed ? (
                        <Card className="items-center gap-2 py-8">
                            <Text className="font-semibold">Could not reach Paayo</Text>
                            <Text className="text-muted-foreground text-center text-sm">
                                Check your connection. What you sell has not changed -- this screen just
                                could not load it.
                            </Text>
                            <Button variant="outline" className="mt-2 self-stretch" onPress={load}>
                                Try again
                            </Button>
                        </Card>
                    ) : null}

                    {!failed && offers === null
                        ? [0, 1, 2].map((at) => (
                              <View
                                  key={at}
                                  className="border-border bg-card gap-2 rounded-xl border p-4"
                              >
                                  <View className="flex-row items-center justify-between gap-3">
                                      <Skeleton className="h-4 w-32" />
                                      <Skeleton className="h-5 w-16 rounded-full" />
                                  </View>
                                  <Skeleton className="h-5 w-24" />
                              </View>
                          ))
                        : null}

                    {!failed && offers !== null && showing === 'offers' ? (
                        <Offers groups={byTrade(offers)} colours={colours} />
                    ) : null}

                    {!failed && catalog !== null && showing === 'catalog' ? (
                        <>
                            <Input
                                value={search}
                                onChangeText={setSearch}
                                placeholder={`Search ${catalog.reduce((count, trade) => count + (trade.services?.length ?? 0), 0)} services`}
                                autoCapitalize="none"
                                autoCorrect={false}
                            />

                            {search.trim() !== '' ? (
                                <Text className="text-muted-foreground text-sm">
                                    {found === 0
                                        ? `Nothing matches "${search.trim()}"`
                                        : `${found} service${found === 1 ? '' : 's'} in ${filtered.length} trade${filtered.length === 1 ? '' : 's'}`}
                                </Text>
                            ) : null}

                            {found === 0 && search.trim() !== '' ? (
                                <Card className="items-center gap-2 py-8">
                                    <Text className="font-semibold">{`Nothing matches "${search.trim()}"`}</Text>
                                    <Text className="text-muted-foreground text-center text-sm">
                                        Paayo does not publish a service by that name. If your trade needs
                                        one, tell them -- the catalog is theirs to add to.
                                    </Text>
                                    <Button
                                        variant="outline"
                                        className="mt-2 self-stretch"
                                        onPress={() => setSearch('')}
                                    >
                                        Clear the search
                                    </Button>
                                </Card>
                            ) : null}

                            {filtered.map((trade) => (
                                <View key={trade.id} className="gap-2">
                                    <View className="flex-row items-center gap-2 pt-1">
                                        <TradeIcon
                                            icon={trade.icon}
                                            color={colours['muted-foreground']}
                                            size={16}
                                        />
                                        <Text className="text-muted-foreground text-xs font-bold uppercase">
                                            {trade.name}
                                        </Text>
                                    </View>

                                    <Card className="gap-0 py-1">
                                        {(trade.services ?? []).map((service, at) => (
                                            <CatalogRow
                                                key={service.id}
                                                service={service}
                                                offer={sold.get(service.id)}
                                                first={at === 0}
                                            />
                                        ))}
                                    </Card>
                                </View>
                            ))}
                        </>
                    ) : null}
                </ScrollView>
            </KeyboardAvoiding>
        </SafeAreaView>
    );
}

/**
 * What this business sells, grouped by the trade it sits under.
 */
function Offers({ groups, colours }: { groups: Group[]; colours: Record<string, string> }) {
    if (groups.length === 0) {
        return (
            <Card className="gap-2">
                <Text className="font-semibold">Nothing to sell yet</Text>
                <Text className="text-muted-foreground text-sm">
                    Paayo sets up what a business sells and what it charges. Look through the catalog
                    and tell them which services you want.
                </Text>
            </Card>
        );
    }

    return (
        <>
            {groups.map((group) => (
                <View key={group.trade?.id ?? 'none'} className="gap-3">
                    <View className="flex-row items-center gap-2 pt-1">
                        <TradeIcon
                            icon={group.trade?.icon ?? null}
                            color={colours['muted-foreground']}
                            size={16}
                        />
                        <Text className="text-muted-foreground text-xs font-bold uppercase">
                            {group.trade?.name ?? 'Other'}
                        </Text>
                    </View>

                    {group.offers.map((offer) => (
                        <Pressable
                            key={offer.id}
                            accessibilityRole="button"
                            accessibilityLabel={`Edit ${offer.service.name}`}
                            onPress={() =>
                                router.push({
                                    pathname: '/offer/[id]',
                                    params: { id: offer.id, name: offer.service.name },
                                })
                            }
                        >
                        <Card className="gap-2">
                            <View className="flex-row items-start justify-between gap-3">
                                <Text className="flex-1 font-semibold">{offer.service.name}</Text>
                                <StatusPill tone={offer.standing.tone}>
                                    {offer.standing.wording}
                                </StatusPill>
                            </View>

                            <View className="flex-row items-baseline gap-2">
                                <Text className="flex-1 text-lg font-bold">
                                    {priceRange(
                                        offer.price_min,
                                        offer.price_max,
                                        offer.pricing_method,
                                    )}
                                </Text>
                                <Text className="text-muted-foreground text-xs">
                                    {[
                                        offer.rates.length === 1
                                            ? '1 price'
                                            : `${offer.rates.length} prices`,
                                        offer.intake.length > 0
                                            ? offer.intake.length === 1
                                                ? '1 question'
                                                : `${offer.intake.length} questions`
                                            : null,
                                    ]
                                        .filter(Boolean)
                                        .join(' · ')}
                                </Text>
                            </View>

                            {offer.description ? (
                                <Text className="text-muted-foreground text-sm">
                                    {offer.description}
                                </Text>
                            ) : null}

                            {offer.standing.wording === 'live' ? null : (
                                <Text className="text-muted-foreground text-xs">
                                    {offer.standing.reason}
                                </Text>
                            )}
                        </Card>
                        </Pressable>
                    ))}
                </View>
            ))}
        </>
    );
}

/**
 * One published service, and whether this business sells it.
 */
function CatalogRow({
    service,
    offer,
    first,
}: {
    service: Service;
    offer?: ProviderListing;
    first: boolean;
}) {
    const note = offer
        ? offer.standing.wording === 'live'
            ? `You sell this · ${priceRange(offer.price_min, offer.price_max, offer.pricing_method).toLowerCase()}`
            : `You sell this · ${offer.standing.wording}`
        : 'Not sold here';

    return (
        <View
            className={cn(
                'flex-row items-center gap-3 py-2.5',
                first ? '' : 'border-border border-t',
            )}
        >
            <View className="min-w-0 flex-1">
                <Text
                    className={cn('text-sm font-semibold', offer ? '' : 'text-muted-foreground')}
                    numberOfLines={1}
                >
                    {service.name}
                </Text>
                <Text className="text-muted-foreground text-xs" numberOfLines={1}>
                    {note}
                </Text>
            </View>

            {offer ? <Text className="text-brand text-sm font-bold">✓</Text> : null}
        </View>
    );
}
