import { Link, router } from 'expo-router';
import { useState } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { FormMessage } from '@/components/form-message';
import { PasskeyCard } from '@/components/passkey-card';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { FieldError } from '@/components/ui/field-error';
import { Label } from '@/components/ui/label';
import { PasswordInput } from '@/components/ui/password-input';
import { Text } from '@/components/ui/text';
import { useSession } from '@/lib/session';
import type { MessageResponse } from '@/lib/types';
import { useSubmit } from '@/lib/use-submit';

export default function Security() {
    const session = useSession();
    const password = useSubmit();
    const twoFactor = useSubmit();
    const [current, setCurrent] = useState('');
    const [next, setNext] = useState('');
    const [confirmation, setConfirmation] = useState('');
    const [changed, setChanged] = useState<string | null>(null);

    if (session.status !== 'authenticated') {
        return null;
    }

    const enabled = session.user.two_factor_enabled;

    const changePassword = () =>
        password.submit(async () => {
            const response = await session.authenticatedRequest<MessageResponse>('/auth/password', {
                method: 'PUT',
                body: {
                    current_password: current,
                    password: next,
                    password_confirmation: confirmation,
                },
            });

            setCurrent('');
            setNext('');
            setConfirmation('');
            setChanged(response.message);
        });

    const disable = () =>
        twoFactor.submit(async () => {
            await session.authenticatedRequest<void>('/auth/two-factor', { method: 'DELETE' });
            await session.reload();
        });

    return (
        <SafeAreaView className="bg-background flex-1">
            <KeyboardAvoidingView
                className="flex-1"
                behavior={Platform.OS === 'ios' ? 'padding' : undefined}
            >
                <ScrollView
                    contentContainerClassName="gap-6 p-6"
                    keyboardShouldPersistTaps="handled"
                >
                    <View className="flex-row items-center justify-between">
                        <Text className="text-2xl font-bold">Security</Text>
                        <Button variant="ghost" onPress={() => router.back()}>
                            Done
                        </Button>
                    </View>

                    <PasskeyCard />

                    <Card className="gap-3">
                        <Text className="font-semibold">Two factor authentication</Text>
                        <Text className="text-muted-foreground text-sm">
                            {enabled
                                ? 'A code from your authenticator app is required at every sign in.'
                                : 'Add a second step at sign in, using an authenticator app.'}
                        </Text>

                        <FormMessage message={twoFactor.message} />

                        {enabled ? (
                            <View className="gap-2">
                                <Link href="/security/two-factor" asChild>
                                    <Button variant="outline">View recovery codes</Button>
                                </Link>
                                <Button variant="ghost" onPress={disable} busy={twoFactor.busy}>
                                    Turn off
                                </Button>
                            </View>
                        ) : (
                            <Link href="/security/two-factor" asChild>
                                <Button variant="brand">Turn on</Button>
                            </Link>
                        )}
                    </Card>

                    <Card className="gap-3">
                        <Text className="font-semibold">Change password</Text>
                        <Text className="text-muted-foreground text-sm">
                            Your other devices are signed out. This one stays signed in.
                        </Text>

                        <FormMessage message={changed} tone="success" />
                        <FormMessage message={password.message} />

                        <View>
                            <Label>Current password</Label>
                            <PasswordInput
                                value={current}
                                onChangeText={setCurrent}
                                autoComplete="current-password"
                                invalid={Boolean(password.errorFor('current_password'))}
                            />
                            <FieldError message={password.errorFor('current_password')} />
                        </View>

                        <View>
                            <Label>New password</Label>
                            <PasswordInput
                                value={next}
                                onChangeText={setNext}
                                autoComplete="new-password"
                                invalid={Boolean(password.errorFor('password'))}
                            />
                            <FieldError message={password.errorFor('password')} />
                        </View>

                        <View>
                            <Label>Confirm new password</Label>
                            <PasswordInput
                                value={confirmation}
                                onChangeText={setConfirmation}
                                autoComplete="new-password"
                            />
                        </View>

                        <Button onPress={changePassword} busy={password.busy}>
                            Change password
                        </Button>
                    </Card>
                </ScrollView>
            </KeyboardAvoidingView>
        </SafeAreaView>
    );
}
