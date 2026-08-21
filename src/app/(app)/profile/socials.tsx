import { router } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { ScrollView, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { FormMessage } from '@/components/form-message';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Text } from '@/components/ui/text';
import { useGoogleSignIn } from '@/lib/google';
import { useSession } from '@/lib/session';
import type { Social } from '@/lib/types';
import { useSubmit } from '@/lib/use-submit';

/**
 * The providers that can open this account, and the last way in.
 */
export default function LinkedAccounts() {
    const session = useSession();
    const { busy, message, submit } = useSubmit();
    const google = useGoogleSignIn();
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

    if (session.status !== 'authenticated') {
        return null;
    }

    const isLinked = linked?.some((social) => social.provider === 'google') ?? false;

    // Unlinking the only way in is refused by the server. Say so before the tap
    // rather than after, and point at the screen that fixes it.
    const onlyWayIn = isLinked && (linked?.length ?? 0) === 1 && !session.user.has_password;

    const link = () =>
        submit(async () => {
            const token = await google.requestToken();

            if (token === null) {
                return;
            }

            await session.authenticatedRequest<unknown>('/auth/socials/google/link', {
                method: 'POST',
                body: { token },
            });

            await load();
        });

    const unlink = () =>
        submit(async () => {
            await session.authenticatedRequest<void>('/auth/socials/google', { method: 'DELETE' });

            await session.reload();
            await load();
        });

    return (
        <SafeAreaView className="bg-background flex-1">
            <ScrollView contentContainerClassName="gap-6 p-6">
                <View className="flex-row items-center justify-between">
                    <Text className="text-2xl font-bold">Linked accounts</Text>
                    <Button variant="ghost" onPress={() => router.back()}>
                        Done
                    </Button>
                </View>

                <FormMessage message={message} />

                <Card className="gap-3">
                    <View className="flex-row items-center justify-between">
                        <Text className="font-semibold">Google</Text>
                        <Text
                            className={
                                isLinked
                                    ? 'text-success text-sm font-medium'
                                    : 'text-muted-foreground text-sm font-medium'
                            }
                        >
                            {isLinked ? 'Linked' : 'Not linked'}
                        </Text>
                    </View>

                    {linked?.find((social) => social.provider === 'google')?.email ? (
                        <Text className="text-muted-foreground text-sm">
                            {linked.find((social) => social.provider === 'google')?.email}
                        </Text>
                    ) : null}

                    {onlyWayIn ? (
                        <>
                            <Text className="text-muted-foreground text-sm">
                                This is the only way into your account. Set a password before
                                unlinking it.
                            </Text>
                            <Button variant="outline" onPress={() => router.push('/security')}>
                                Set a password
                            </Button>
                        </>
                    ) : isLinked ? (
                        <Button variant="ghost" onPress={unlink} busy={busy}>
                            Unlink
                        </Button>
                    ) : google.ready ? (
                        <Button variant="outline" onPress={link} busy={busy}>
                            Link Google
                        </Button>
                    ) : (
                        <Text className="text-muted-foreground text-sm">
                            This build cannot reach Google.
                        </Text>
                    )}
                </Card>
            </ScrollView>
        </SafeAreaView>
    );
}
