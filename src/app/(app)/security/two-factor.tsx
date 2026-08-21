import { router } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { ScrollView, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { SvgXml } from 'react-native-svg';

import { FormMessage } from '@/components/form-message';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { FieldError } from '@/components/ui/field-error';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Text } from '@/components/ui/text';
import { useSession } from '@/lib/session';
import type { QrCode } from '@/lib/types';
import { useSubmit } from '@/lib/use-submit';

/**
 * Enrol a second factor, or read the recovery codes of one already on.
 *
 * The server refuses to hand over enrolment material before `POST
 * /auth/two-factor` has generated a secret, so an account without one starts
 * that call on arrival.
 */
export default function TwoFactorSetup() {
    const session = useSession();
    const { busy, message, errorFor, submit } = useSubmit();
    const [qr, setQr] = useState<QrCode | null>(null);
    const [codes, setCodes] = useState<string[] | null>(null);
    const [code, setCode] = useState('');

    const enabled = session.status === 'authenticated' && session.user.two_factor_enabled;
    const authenticatedRequest = session.status === 'authenticated' ? session.authenticatedRequest : null;

    const begin = useCallback(async () => {
        if (!authenticatedRequest) {
            return;
        }

        if (!enabled) {
            await authenticatedRequest<void>('/auth/two-factor', { method: 'POST' });
            setQr(await authenticatedRequest<QrCode>('/auth/two-factor/qr-code'));
        }

        const { data } = await authenticatedRequest<{ data: string[] }>(
            '/auth/two-factor/recovery-codes',
        );

        setCodes(data);
    }, [authenticatedRequest, enabled]);

    useEffect(() => {
        void submit(begin);
    }, [begin, submit]);

    if (session.status !== 'authenticated') {
        return null;
    }

    const confirm = () =>
        submit(async () => {
            await session.authenticatedRequest<void>('/auth/two-factor/confirm', {
                method: 'POST',
                body: { code: code.trim() },
            });

            await session.reload();
            router.back();
        });

    const regenerate = () =>
        submit(async () => {
            const { data } = await session.authenticatedRequest<{ data: string[] }>(
                '/auth/two-factor/recovery-codes',
                { method: 'POST' },
            );

            setCodes(data);
        });

    return (
        <SafeAreaView className="bg-background flex-1">
            <ScrollView contentContainerClassName="gap-6 p-6">
                <View className="flex-row items-center justify-between">
                    <Text className="text-2xl font-bold">
                        {enabled ? 'Recovery codes' : 'Set up two factor'}
                    </Text>
                    <Button variant="ghost" onPress={() => router.back()}>
                        Close
                    </Button>
                </View>

                <FormMessage message={message} />

                {qr ? (
                    <Card className="items-center gap-3">
                        <Text className="text-muted-foreground text-center text-sm">
                            Scan this with your authenticator app.
                        </Text>
                        {/* Fortify draws dark modules on white, which a scanner needs; the
                            surface is white in either theme so that reads as deliberate. */}
                        <View className="rounded-lg bg-white p-3">
                            <SvgXml xml={qr.svg} width={200} height={200} />
                        </View>
                        <Text className="text-muted-foreground text-center text-xs">
                            Cannot scan? Enter this key instead: {qr.url}
                        </Text>
                    </Card>
                ) : null}

                {codes ? (
                    <Card className="gap-2">
                        <Text className="font-semibold">Recovery codes</Text>
                        <Text className="text-muted-foreground text-sm">
                            Save these somewhere safe. Each one works once, if you lose your
                            authenticator.
                        </Text>
                        {codes.map((recoveryCode) => (
                            <Text key={recoveryCode} className="font-mono text-sm">
                                {recoveryCode}
                            </Text>
                        ))}
                        {enabled ? (
                            <Button variant="outline" onPress={regenerate} busy={busy}>
                                Replace these codes
                            </Button>
                        ) : null}
                    </Card>
                ) : null}

                {enabled ? null : (
                    <Card className="gap-3">
                        <Label>Code from your app</Label>
                        <Input
                            value={code}
                            onChangeText={setCode}
                            keyboardType="number-pad"
                            placeholder="123456"
                            invalid={Boolean(errorFor('code'))}
                        />
                        <FieldError message={errorFor('code')} />
                        <Button onPress={confirm} busy={busy}>
                            Turn on two factor
                        </Button>
                    </Card>
                )}
            </ScrollView>
        </SafeAreaView>
    );
}
