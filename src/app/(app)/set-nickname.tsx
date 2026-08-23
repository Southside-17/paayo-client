import { useState } from 'react';
import { View } from 'react-native';

import { AuthScreen } from '@/components/auth-screen';
import { FormMessage } from '@/components/form-message';
import { Button } from '@/components/ui/button';
import { FieldError } from '@/components/ui/field-error';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Text } from '@/components/ui/text';
import { useSession } from '@/lib/session';
import type { MessageResponse } from '@/lib/types';
import { useSubmit } from '@/lib/use-submit';

/**
 * The gate an account with no nickname sits behind.
 *
 * Signing in with a provider opens an account without asking for a name, and
 * the name the provider gave is refused when it impersonates the platform,
 * carries a banned word, or is not shaped like a name at all. Nothing is wrong
 * with the account -- it just owes one.
 */
export default function SetNickname() {
    const session = useSession();
    const { busy, message, errorFor, submit } = useSubmit();
    const [nickname, setNickname] = useState('');

    if (session.status !== 'authenticated') {
        return null;
    }

    const save = () =>
        submit(async () => {
            await session.authenticatedRequest<MessageResponse>('/auth/nickname', {
                method: 'PUT',
                body: { nickname: nickname.trim() },
            });

            await session.reload();
        });

    return (
        <AuthScreen
            title="Choose a nickname"
            subtitle="It is what other people on Paayo will see."
        >
            <View className="gap-4">
                <FormMessage message={message} />

                <View>
                    <Label>Nickname</Label>
                    <Input
                        value={nickname}
                        onChangeText={setNickname}
                        autoComplete="nickname"
                        autoFocus
                        placeholder="What you go by"
                        maxLength={12}
                        invalid={Boolean(errorFor('nickname'))}
                    />
                    <FieldError message={errorFor('nickname')} />
                    <Text className="text-muted-foreground mt-1.5 text-sm">
                        Your legal name comes from a verified identification and cannot be typed
                        here.
                    </Text>
                </View>

                <Button onPress={save} busy={busy}>
                    Save and carry on
                </Button>
            </View>
        </AuthScreen>
    );
}
