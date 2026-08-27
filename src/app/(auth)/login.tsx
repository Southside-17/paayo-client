import { Link, router } from 'expo-router';
import KeyRound from 'lucide-react-native/icons/key-round';
import { useColorScheme } from 'nativewind';
import { useState } from 'react';
import { Platform, View } from 'react-native';

import { AuthScreen } from '@/components/auth-screen';
import { BrandIcon } from '@/components/brand-icon';
import { FormMessage } from '@/components/form-message';
import { openDocument } from '@/components/legal-consent';
import { Button } from '@/components/ui/button';
import { FieldError } from '@/components/ui/field-error';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { PasswordInput } from '@/components/ui/password-input';
import { Text } from '@/components/ui/text';
import { requestAppleAuthorization, useAppleSignIn } from '@/lib/apple';
import { useGoogleSignIn } from '@/lib/google';
import { useMicrosoftSignIn } from '@/lib/microsoft';
import { passkeysAreSupported } from '@/lib/passkey';
import { SOCIAL_PROVIDERS } from '@/lib/providers';
import { useSession } from '@/lib/session';
import { isTwoFactorChallenge, type LoginResult } from '@/lib/types';
import { useSubmit } from '@/lib/use-submit';
import palette from '@/theme/palette';

/** "Google", "Google or Apple", "Google, Apple or Microsoft". */
function nameList(names: string[]): string {
    if (names.length < 2) {
        return names.join('');
    }

    return `${names.slice(0, -1).join(', ')} or ${names[names.length - 1]}`;
}

export default function Login() {
    const {
        login,
        signInWithGoogle,
        signInWithApple,
        signInWithMicrosoft,
        redeemAppleCode,
        signInWithPasskey,
    } = useSession();
    const { busy, message, errorFor, submit } = useSubmit();
    const google = useGoogleSignIn();
    const apple = useAppleSignIn();
    const microsoft = useMicrosoftSignIn();
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

    const continueWithApple = () =>
        submit(async () => {
            // Android has no native sheet: the flow runs in a browser and comes
            // back with a code to redeem rather than a token to post.
            if (Platform.OS === 'android') {
                const granted = await requestAppleAuthorization();

                // Closing the tab is a decision, not a failure.
                if (granted === null) {
                    return;
                }

                challenge(await redeemAppleCode(granted.code, granted.verifier));

                return;
            }

            const credential = await apple.requestToken();

            // Backing out of the sheet is a decision, not a failure.
            if (credential === null) {
                return;
            }

            challenge(await signInWithApple(credential.token, credential.realUser));
        });

    const continueWithMicrosoft = () =>
        submit(async () => {
            const token = await microsoft.requestToken();

            // Closing the browser is a decision, not a failure.
            if (token === null) {
                return;
            }

            challenge(await signInWithMicrosoft(token));
        });

    // SOCIAL_PROVIDERS says which ways in exist and in what order; the hooks say
    // whether this build and this device can run each one. They are called
    // unconditionally above because hooks must be, and only the rendering below
    // is driven by the list.
    const presses: Record<string, { ready: boolean; onPress: () => void }> = {
        google: { ready: google.ready, onPress: continueWithGoogle },
        apple: { ready: apple.ready, onPress: continueWithApple },
        microsoft: { ready: microsoft.ready, onPress: continueWithMicrosoft },
    };

    const waysIn = SOCIAL_PROVIDERS.filter((provider) => presses[provider.key]?.ready);

    // Only the providers with a button below, so the notice never promises
    // agreement to something this build cannot offer.
    const consentProviders = nameList(waysIn.map((provider) => provider.label));

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

                <FieldError message={errorFor('credential')} />

                {waysIn.length > 0 ? (
                    <>
                        {waysIn.map((provider) => (
                            <Button
                                key={provider.key}
                                variant="outline"
                                onPress={presses[provider.key].onPress}
                                busy={busy}
                                icon={
                                    <BrandIcon
                                        brand={provider.brand}
                                        color={palette[colorScheme ?? 'light'].foreground}
                                    />
                                }
                            >
                                {`Sign in with ${provider.label}`}
                            </Button>
                        ))}

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

                {/* A provider opens an account when there is none, and the
                    server records that as agreement -- so this is where it is
                    said. The register form asks with a checkbox; this path has
                    no form to put one on. Named rather than generic, and only
                    shown when there is a button above to agree by pressing. */}
                {waysIn.length > 0 ? (
                <Text className="text-muted-foreground text-center text-xs leading-5">
                    By continuing with {consentProviders} you accept the{' '}
                    <Text
                        className="text-brand text-xs underline"
                        onPress={() => void openDocument('/privacy-policy')}
                    >
                        Privacy Policy
                    </Text>{' '}
                    and the{' '}
                    <Text
                        className="text-brand text-xs underline"
                        onPress={() => void openDocument('/user-agreement')}
                    >
                        User Agreement
                    </Text>
                    .
                </Text>
                ) : null}
            </View>
        </AuthScreen>
    );
}
