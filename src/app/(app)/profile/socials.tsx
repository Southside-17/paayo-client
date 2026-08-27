import { BackButton } from '@/components/back-button';
import { ScreenHeader } from '@/components/ui/screen-header';
import { router } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { Platform, ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { FormMessage } from '@/components/form-message';
import { SocialCard } from '@/components/social-card';
import { Button } from '@/components/ui/button';
import { Text } from '@/components/ui/text';
import { useAppleSignIn } from '@/lib/apple';
import { useGoogleSignIn } from '@/lib/google';
import { useMicrosoftSignIn } from '@/lib/microsoft';
import { SOCIAL_PROVIDERS } from '@/lib/providers';
import { useSession } from '@/lib/session';
import type { Social } from '@/lib/types';
import { useSubmit } from '@/lib/use-submit';

/** What a provider needs to offer linking here: a token, on demand. */
type Linker = { ready: boolean; requestToken: () => Promise<string | null> };

/**
 * The providers that can open this account, and the last way in.
 */
export default function LinkedAccounts() {
    const session = useSession();
    const { busy, message, submit } = useSubmit();
    const google = useGoogleSignIn();
    const apple = useAppleSignIn();
    const microsoft = useMicrosoftSignIn();
    const [linked, setLinked] = useState<Social[] | null>(null);

    const authenticatedRequest =
        session.status === 'authenticated' ? session.authenticatedRequest : null;

    const load = useCallback(async () => {
        if (!authenticatedRequest) {
            return;
        }

        const { data } = await authenticatedRequest<{ data: Social[] }>('/auth/socials');

        setLinked(data);
    }, [authenticatedRequest]);

    useEffect(() => {
        void submit(load);
    }, [load, submit]);

    // Declared before the early return, because hooks must be. What varies is
    // the list drawn below, never how many hooks ran.
    const link = useCallback(
        (key: string, linker: Linker) =>
            submit(async () => {
                const token = await linker.requestToken();

                // Backing out is a decision, not a failure.
                if (token === null) {
                    return;
                }

                await session.authenticatedRequest<unknown>(`/auth/socials/${key}/link`, {
                    method: 'POST',
                    body: { token },
                });

                await load();
            }),
        [load, session, submit],
    );

    const unlink = useCallback(
        (key: string) =>
            submit(async () => {
                await session.authenticatedRequest<void>(`/auth/socials/${key}`, {
                    method: 'DELETE',
                });

                await session.reload();
                await load();
            }),
        [load, session, submit],
    );

    if (session.status !== 'authenticated') {
        return null;
    }

    const linkers: Record<string, Linker | null> = {
        google,
        // Apple links from the native sheet alone. Android's Apple flow runs
        // through the server's browser leg, which begins at a route that says
        // `login` and knows no other intent -- so there is nothing here to press.
        apple:
            Platform.OS === 'ios'
                ? {
                      ready: apple.ready,
                      requestToken: async () => (await apple.requestToken())?.token ?? null,
                  }
                : null,
        microsoft,
    };

    // A provider this build cannot reach still belongs on the screen once it is
    // linked: otherwise the only way out of it would be a build that has its
    // credentials back.
    const providers = SOCIAL_PROVIDERS.filter(
        (provider) =>
            provider.isConfigured() ||
            (linked?.some((social) => social.provider === provider.key) ?? false),
    );

    // Counted across every provider, not within one. UnlinkSocial refuses to
    // remove the last way in when there is no password, so a screen counting
    // only the card it is drawing would offer a button that always fails.
    const lastWayIn = (linked?.length ?? 0) === 1 && !session.user.has_password;

    return (
        <SafeAreaView className="bg-background flex-1">
            <ScrollView contentContainerClassName="gap-6 p-6">
                <BackButton label="Account" />
                <ScreenHeader title="Linked accounts" />

                <FormMessage message={message} />

                {providers.map((provider) => {
                    const social = linked?.find((entry) => entry.provider === provider.key) ?? null;
                    const linker = linkers[provider.key];

                    return (
                        <SocialCard key={provider.key} provider={provider} social={social}>
                            {social !== null && lastWayIn ? (
                                <>
                                    <Text className="text-muted-foreground text-sm">
                                        This is the only way into your account. Set a password
                                        before unlinking it.
                                    </Text>
                                    <Button
                                        variant="outline"
                                        onPress={() => router.push('/security')}
                                    >
                                        Set a password
                                    </Button>
                                </>
                            ) : social !== null ? (
                                <Button
                                    variant="ghost"
                                    onPress={() => unlink(provider.key)}
                                    busy={busy}
                                >
                                    Unlink
                                </Button>
                            ) : linker?.ready ? (
                                <Button
                                    variant="outline"
                                    onPress={() => link(provider.key, linker)}
                                    busy={busy}
                                >
                                    {`Link ${provider.label}`}
                                </Button>
                            ) : (
                                <Text className="text-muted-foreground text-sm">
                                    {linker === null
                                        ? `${provider.label} can only be linked on iOS.`
                                        : `This build cannot reach ${provider.label}.`}
                                </Text>
                            )}
                        </SocialCard>
                    );
                })}
            </ScrollView>
        </SafeAreaView>
    );
}
