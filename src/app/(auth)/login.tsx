import { Link, router } from 'expo-router';
import { useState } from 'react';
import { View } from 'react-native';

import { AuthScreen } from '@/components/auth-screen';
import { FormMessage } from '@/components/form-message';
import { Button } from '@/components/ui/button';
import { FieldError } from '@/components/ui/field-error';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { PasswordInput } from '@/components/ui/password-input';
import { Text } from '@/components/ui/text';
import { useSession } from '@/lib/session';
import { isTwoFactorChallenge } from '@/lib/types';
import { useSubmit } from '@/lib/use-submit';

export default function Login() {
    const { login } = useSession();
    const { busy, message, errorFor, submit } = useSubmit();
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');

    const signIn = () =>
        submit(async () => {
            const result = await login(email.trim(), password);

            if (isTwoFactorChallenge(result)) {
                router.push({
                    pathname: '/two-factor',
                    params: { challenge: result.challenge_token },
                });
            }
        });

    return (
        <AuthScreen title="Log in to your account" subtitle="Enter your email and password to log in">
            <View className="gap-4">
                <FormMessage message={message} />

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

                <View>
                    <Label>Password</Label>
                    <PasswordInput
                        value={password}
                        onChangeText={setPassword}
                        autoComplete="current-password"
                        placeholder="Password"
                        invalid={Boolean(errorFor('password'))}
                    />
                    <FieldError message={errorFor('password')} />
                </View>

                <Link href="/forgot-password" className="self-end">
                    <Text className="text-brand text-sm font-medium">Forgot password?</Text>
                </Link>

                <Button onPress={signIn} busy={busy}>
                    Log in
                </Button>

                <View className="flex-row justify-center gap-1">
                    <Text className="text-muted-foreground text-sm">Don&apos;t have an account?</Text>
                    <Link href="/register">
                        <Text className="text-brand text-sm font-medium">Sign up</Text>
                    </Link>
                </View>
            </View>
        </AuthScreen>
    );
}
