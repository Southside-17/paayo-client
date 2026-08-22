import { Link, router } from 'expo-router';
import KeyRound from 'lucide-react-native/icons/key-round';
import { useColorScheme } from 'nativewind';
import { useState } from 'react';
import { View } from 'react-native';

import { AuthScreen } from '@/components/auth-screen';
import { BrandIcon } from '@/components/brand-icon';
import { FormMessage } from '@/components/form-message';
import { Button } from '@/components/ui/button';
import { FieldError } from '@/components/ui/field-error';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { PasswordInput } from '@/components/ui/password-input';
import { Text } from '@/components/ui/text';
import { GOOGLE } from '@/lib/brands';
import { useGoogleSignIn } from '@/lib/google';
import { passkeysAreSupported } from '@/lib/passkey';
import { useSession } from '@/lib/session';
import { isTwoFactorChallenge, type LoginResult } from '@/lib/types';
import { useSubmit } from '@/lib/use-submit';
import palette from '@/theme/palette';

export default function Login() {
    const { login, signInWithGoogle, signInWithPasskey } = useSession();
    const { busy, message, errorFor, submit } = useSubmit();
    const google = useGoogleSignIn();
    const { colorScheme } = useColorScheme();
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');

    const challenge = (result: LoginResult) => {
        if (isTwoFactorChallenge(result)) {
            router.push({
                pathname: '/two-factor',
                params: { challenge: result.challenge_token },
            });
        }
    };

    const signIn = () => submit(async () => challenge(await login(email.trim(), password)));

    const signInWithAPasskey = () =>
        submit(async () => {
            const result = await signInWithPasskey();

            // Dismissing the sheet is a decision, not a failure.
            if (result !== null) {
                challenge(result);
            }
        });

    const continueWithGoogle = () =>
        submit(async () => {
            const token = await google.requestToken();

            // Backing out of the sheet is a decision, not a failure.
            if (token === null) {
                return;
            }

            challenge(await signInWithGoogle(token));
        });

    return (
        <AuthScreen title="Log in to your account" subtitle="Enter your email and password to log in">
            <View className="gap-4">
                <FormMessage message={message} />

                {passkeysAreSupported() ? (
                    <Button
                        variant="outline"
                        onPress={signInWithAPasskey}
                        busy={busy}
                        icon={
                            <KeyRound size={18} color={palette[colorScheme ?? 'light'].foreground} />
                        }
                    >
                        Sign in with passkey
                    </Button>
                ) : null}

                {/* The server keys a refused passkey on `credential`, which no
                    input on this screen owns, so it is rendered here or nowhere. */}
                <FieldError message={errorFor('credential')} />

                {google.ready ? (
                    <>
                        <Button
                            variant="outline"
                            onPress={continueWithGoogle}
                            busy={busy}
                            icon={
                                <BrandIcon
                                    brand={GOOGLE}
                                    color={palette[colorScheme ?? 'light'].foreground}
                                />
                            }
                        >
                            Sign in with Google
                        </Button>

                        <View className="flex-row items-center gap-3">
                            <View className="bg-border h-px flex-1" />
                            <Text className="text-muted-foreground text-xs font-medium">
                                Or use email
                            </Text>
                            <View className="bg-border h-px flex-1" />
                        </View>
                    </>
                ) : null}

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

                <Link href="/forgot-password" push className="self-end">
                    <Text className="text-brand text-sm font-medium">Forgot password?</Text>
                </Link>

                <Button onPress={signIn} busy={busy}>
                    Log in
                </Button>

                <View className="flex-row justify-center gap-1">
                    <Text className="text-muted-foreground text-sm">Don&apos;t have an account?</Text>
                    <Link href="/register" push>
                        <Text className="text-brand text-sm font-medium">Sign up</Text>
                    </Link>
                </View>
            </View>
        </AuthScreen>
    );
}
