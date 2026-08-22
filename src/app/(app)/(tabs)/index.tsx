import { Link, useFocusEffect } from 'expo-router';
import type { ReactNode } from 'react';
import { useCallback, useState } from 'react';
import { ScrollView, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Avatar } from '@/components/avatar';
import { SocialCard } from '@/components/social-card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { ScreenHeader } from '@/components/ui/screen-header';
import { StatusPill } from '@/components/ui/status-pill';
import { Text } from '@/components/ui/text';
import { passkeysAreSupported } from '@/lib/passkey';
import { enabledSocialProviders } from '@/lib/providers';
import { useSession } from '@/lib/session';
import type { Address, Passkey, Social } from '@/lib/types';

/** The greeting the header opens with, by the reader's own clock. */
function greeting(hour: number): string {
    if (hour < 12) {
        return 'Good morning';
    }

    return hour < 18 ? 'Good afternoon' : 'Good evening';
}

/**
 * Where the account stands, and where its work would happen.
 */
export default function Home() {
    const session = useSession();
    const [addresses, setAddresses] = useState<Address[] | null>(null);
    const [passkeys, setPasskeys] = useState<Passkey[] | null>(null);
    const [socials, setSocials] = useState<Social[] | null>(null);
    // The picture is changed on another screen and the route it is served from
    // never changes, so nothing else would tell the image cache to look again.
    const [seen, setSeen] = useState(0);

    const authenticatedRequest =
        session.status === 'authenticated' ? session.authenticatedRequest : null;

    // All three are edited on other screens, so focus is the only signal that
    // any of them has moved. A failure leaves its own row empty rather than
    // taking the screen down with it.
    useFocusEffect(
        useCallback(() => {
            if (!authenticatedRequest) {
                return;
            }

            setSeen((count) => count + 1);

            void authenticatedRequest<{ data: Address[] }>('/addresses')
                .then(({ data }) => setAddresses(data))
                .catch(() => setAddresses([]));

            void authenticatedRequest<{ data: Passkey[] }>('/auth/passkeys')
                .then(({ data }) => setPasskeys(data))
                .catch(() => setPasskeys([]));

            void authenticatedRequest<{ data: Social[] }>('/auth/socials')
                .then(({ data }) => setSocials(data))
                .catch(() => setSocials([]));
        }, [authenticatedRequest]),
    );

    if (session.status !== 'authenticated') {
        return null;
    }

    const { user } = session;
    const primary = addresses?.find((address) => address.is_default) ?? addresses?.[0] ?? null;
    const providers = enabledSocialProviders();

    return (
        <SafeAreaView className="bg-background flex-1" edges={['top']}>
            <ScrollView contentContainerClassName="gap-5 p-6">
                <ScreenHeader eyebrow={greeting(new Date().getHours())} title={user.nickname}>
                    <Avatar
                        nickname={user.nickname}
                        avatar={user.avatar}
                        token={session.token}
                        version={seen}
                        size={44}
                    />
                </ScreenHeader>

                <Card className="gap-3">
                    <Text className="font-semibold">Your account</Text>

                    <Standing label="Email">
                        <StatusPill tone={user.email_verified ? 'success' : 'warning'}>
                            {user.email_verified ? 'confirmed' : 'unconfirmed'}
                        </StatusPill>
                    </Standing>

                    <Standing label="Identification">
                        <StatusPill tone={user.identification_verified ? 'success' : 'neutral'}>
                            {user.identification_verified ? 'verified' : 'not verified'}
                        </StatusPill>
                    </Standing>

                    <Standing label="Two-factor">
                        <StatusPill tone={user.two_factor_enabled ? 'success' : 'neutral'}>
                            {user.two_factor_enabled ? 'on' : 'off'}
                        </StatusPill>
                    </Standing>

                    {/* A device with no authenticator can hold none, so the row
                        would report a lack the person cannot act on. */}
                    {passkeysAreSupported() ? (
                        <Standing label="Passkeys">
                            <StatusPill tone={passkeys?.length ? 'success' : 'neutral'}>
                                {passkeys?.length ? `${passkeys.length} saved` : 'none saved'}
                            </StatusPill>
                        </Standing>
                    ) : null}

                    <Link href="/security" asChild>
                        <Button variant="outline">Security</Button>
                    </Link>
                </Card>

                {providers.length > 0 ? (
                    <View className="gap-3">
                        <Text className="font-semibold">Ways in</Text>

                        {providers.map((provider) => (
                            <SocialCard
                                key={provider.key}
                                provider={provider}
                                social={
                                    socials?.find((social) => social.provider === provider.key) ??
                                    null
                                }
                            />
                        ))}

                        <Link href="/profile/socials" asChild>
                            <Button variant="outline">Manage linked accounts</Button>
                        </Link>
                    </View>
                ) : null}

                <Card className="gap-3">
                    <Text className="font-semibold">Where work happens</Text>

                    {primary ? (
                        <View className="gap-1">
                            <View className="flex-row items-center gap-2">
                                <Text className="font-medium">{primary.label}</Text>
                                {primary.is_default ? <Badge tone="brand">Default</Badge> : null}
                                {primary.latitude !== null ? (
                                    <Badge tone="success">Pinned</Badge>
                                ) : null}
                            </View>
                            <Text className="text-muted-foreground text-sm">{primary.line}</Text>
                        </View>
                    ) : (
                        <Text className="text-muted-foreground text-sm">
                            No address saved yet. A technician has nowhere to be sent until one is.
                        </Text>
                    )}

                    <Link href="/profile/addresses" asChild>
                        <Button variant="outline">
                            {primary ? 'Manage addresses' : 'Add an address'}
                        </Button>
                    </Link>
                </Card>
            </ScrollView>
        </SafeAreaView>
    );
}

function Standing({ label, children }: { label: string; children: ReactNode }) {
    return (
        <View className="flex-row items-center justify-between gap-3">
            <Text className="text-muted-foreground text-sm">{label}</Text>
            {children}
        </View>
    );
}
