import { Link } from 'expo-router';
import { useState } from 'react';
import { View } from 'react-native';

import { AuthScreen } from '@/components/auth-screen';
import { FormMessage } from '@/components/form-message';
import { Button } from '@/components/ui/button';
import { FieldError } from '@/components/ui/field-error';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Text } from '@/components/ui/text';
import { request } from '@/lib/api';
import type { MessageResponse } from '@/lib/types';
import { useSubmit } from '@/lib/use-submit';

/**
 * Ask for a reset link. The reset itself is finished in a browser: the server
 * reuses Laravel's password broker and renders its own confirmation, so there
 * is no API endpoint to complete one from here.
 */
export default function ForgotPassword() {
    const { busy, message, errorFor, submit } = useSubmit();
    const [email, setEmail] = useState('');
    const [sent, setSent] = useState<string | null>(null);

    const send = () =>
        submit(async () => {
            const response = await request<MessageResponse>('/auth/password/forgot', {
                method: 'POST',
                body: { email: email.trim() },
            });

            setSent(response.message);
        });

    return (
        <AuthScreen
            title="Forgot your password?"
            subtitle="We will email you a link to set a new one"
        >
            <View className="gap-4">
                <FormMessage message={sent} tone="success" />
                <FormMessage message={message} />

                {sent ? null : (
                    <>
                        <View>
                            <Label>Email address</Label>
                            <Input
                                value={email}
                                onChangeText={setEmail}
                                autoCapitalize="none"
                                autoComplete="email"
                                keyboardType="email-address"
                                placeholder="email@example.com"
                                invalid={Boolean(errorFor('email'))}
                            />
                            <FieldError message={errorFor('email')} />
                        </View>

                        <Button onPress={send} busy={busy}>
                            Email a reset link
                        </Button>
                    </>
                )}

                <Link href="/login" dismissTo className="self-center">
                    <Text className="text-brand text-sm font-medium">Back to log in</Text>
                </Link>
            </View>
        </AuthScreen>
    );
}
