import { Link, useFocusEffect } from 'expo-router';
import ChevronRight from 'lucide-react-native/icons/chevron-right';
import { useColorScheme } from 'nativewind';
import { useCallback, useState } from 'react';
import { Pressable, ScrollView, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { BusinessChip } from '@/components/business-chip';
import { BusinessGlyph } from '@/components/business-glyph';
import { HoldNotice } from '@/components/hold-notice';
import { StaffList } from '@/components/staff-list';
import { Card } from '@/components/ui/card';
import { ScreenHeader } from '@/components/ui/screen-header';
import { Skeleton } from '@/components/ui/skeleton';
import { StatusPill } from '@/components/ui/status-pill';
import { Text } from '@/components/ui/text';
import { on } from '@/lib/dates';
import { useSession } from '@/lib/session';
import type { Invitation, ProviderStaff } from '@/lib/types';
import { useWorkspace } from '@/lib/workspace';
import palette from '@/theme/palette';

/**
 * The business itself: who works here, and whether anything stops work reaching
 * it.
 *
 * Staff leads because it is the only thing on this screen anybody can change.
 * The market and the papers are Paayo's, and they say so.
 */
export default function Business() {
    const session = useSession();
    const { staff } = useWorkspace();
    const { colorScheme } = useColorScheme();
    const colours = palette[colorScheme ?? 'light'];
    const [people, setPeople] = useState<ProviderStaff[] | null>(null);
    const [invited, setInvited] = useState<Invitation[]>([]);

    const authenticatedRequest =
        session.status === 'authenticated' ? session.authenticatedRequest : null;
    const provider = staff?.provider.id ?? null;
    const mayReadStaff = staff?.permissions.includes('staff:view') ?? false;
    const mayBePaid = staff?.permissions.includes('provider:update') ?? false;

    useFocusEffect(
        useCallback(() => {
            if (!authenticatedRequest || !provider) {
                return;
            }

            if (mayReadStaff) {
                void authenticatedRequest<{ data: ProviderStaff[] }>(`/providers/${provider}/staffs`)
                    .then(({ data }) => setPeople(data))
                    .catch(() => setPeople([]));

                void authenticatedRequest<{ data: Invitation[] }>(
                    `/providers/${provider}/invitations`,
                )
                    .then(({ data }) => setInvited(data))
                    .catch(() => setInvited([]));
            }
        }, [authenticatedRequest, provider, mayReadStaff]),
    );

    if (!staff) {
        return null;
    }

    const { provider: business } = staff;

    return (
        <SafeAreaView className="bg-background flex-1" edges={['top']}>
            <ScrollView contentContainerClassName="gap-4 p-6">
                <ScreenHeader title="Business">
                    <BusinessChip />
                </ScreenHeader>

                <View className="flex-row items-center gap-3">
                    <BusinessGlyph name={business.name} size={46} />

                    <View className="min-w-0 flex-1 gap-0.5">
                        <Text className="text-lg font-bold" numberOfLines={2}>
                            {business.name}
                        </Text>
                        <Text className="text-muted-foreground text-sm" numberOfLines={1}>
                            {`${business.market?.name ?? 'No market yet'} · ${staff.role_label}`}
                        </Text>
                    </View>

                    <StatusPill tone={business.registration_verified ? 'success' : 'neutral'}>
                        {business.registration_verified ? 'registered' : 'no papers'}
                    </StatusPill>
                </View>

                <HoldNotice suspension={business.suspension} />

                {mayReadStaff ? (
                    <>
                        <Text className="text-muted-foreground pt-1 text-xs font-bold uppercase">
                            Who works here
                        </Text>

                        {people === null ? (
                            <Card className="gap-3">
                                {[0, 1].map((at) => (
                                    <View key={at} className="flex-row items-center gap-3">
                                        <Skeleton className="size-8 rounded-full" />
                                        <Skeleton className="h-4 flex-1" />
                                        <Skeleton className="h-4 w-16 rounded-full" />
                                    </View>
                                ))}
                            </Card>
                        ) : (
                            <StaffList people={people} invitations={invited} limit={6} />
                        )}

                        <Link href="/staff" asChild>
                            <Pressable
                                accessibilityRole="button"
                                className="border-border flex-row items-center justify-center gap-2 rounded-xl border border-dashed p-3"
                            >
                                <Text className="text-sm font-semibold">Manage staff</Text>
                                <ChevronRight color={colours['muted-foreground']} size={15} />
                            </Pressable>
                        </Link>
                    </>
                ) : null}

                {mayBePaid ? (
                    <>
                        <Text className="text-muted-foreground pt-1 text-xs font-bold uppercase">
                            Getting paid
                        </Text>

                        {/* Owner only. Changing where money arrives is how a
                            taken-over account becomes cash, so this sits behind
                            the narrowest permission there is. */}
                        <Link href="/destinations" asChild>
                            <Pressable
                                accessibilityRole="button"
                                className="border-border flex-row items-center justify-center gap-2 rounded-xl border border-dashed p-3"
                            >
                                <Text className="text-sm font-semibold">
                                    Where clients send money
                                </Text>
                                <ChevronRight color={colours['muted-foreground']} size={15} />
                            </Pressable>
                        </Link>
                    </>
                ) : null}

                <Text className="text-muted-foreground pt-1 text-xs font-bold uppercase">
                    Set by Paayo
                </Text>

                <Card className="flex-row items-start justify-between gap-4">
                    <View className="min-w-0 flex-1 gap-0.5">
                        <Text className="text-muted-foreground text-xs">Market</Text>
                        <Text className="font-semibold" numberOfLines={1}>
                            {business.market?.name ?? 'Not set'}
                        </Text>
                    </View>

                    <View className="min-w-0 flex-1 gap-0.5">
                        <Text className="text-muted-foreground text-right text-xs">Papers</Text>
                        <Text
                            className={`text-right font-semibold ${business.registration_verified ? '' : 'text-warning'}`}
                            numberOfLines={1}
                        >
                            {business.registration_verified ? 'Checked' : 'Not checked'}
                        </Text>
                    </View>
                </Card>

                {business.market ? null : (
                    <Text className="text-warning text-sm">
                        No market yet, so nothing can be booked. An administrator sets this.
                    </Text>
                )}

                {staff.resignation_requested_at ? (
                    <Card className="border-warning/40 bg-warning-subtle gap-1">
                        <Text className="font-semibold">
                            {`You asked to leave on ${on(staff.resignation_requested_at)}`}
                        </Text>
                        <Text className="text-muted-foreground text-sm">
                            {staff.resignation_lapses_at
                                ? `Still on the staff until somebody answers, or until ${on(staff.resignation_lapses_at)}.`
                                : 'Still on the staff until somebody answers.'}
                        </Text>
                    </Card>
                ) : null}
            </ScrollView>
        </SafeAreaView>
    );
}
