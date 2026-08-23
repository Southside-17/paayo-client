import { useState } from 'react';
import { View } from 'react-native';

import { AuthScreen } from '@/components/auth-screen';
import { FormMessage } from '@/components/form-message';
import { Button } from '@/components/ui/button';
import { Text } from '@/components/ui/text';
import { useSession } from '@/lib/session';
import type { MessageResponse } from '@/lib/types';
import { useSubmit } from '@/lib/use-submit';

/**
 * The gate an unconfirmed address sits behind.
 */
export default function VerifyEmail() {
    const session = useSession();
    const { busy, message, submit } = useSubmit();
    const [sent, setSent] = useState<string | null>(null);
    const [stillWaiting, setStillWaiting] = useState(false);

    if (session.status !== 'authenticated') {
        return null;
    }

    const resend = () =>
        submit(async () => {
            const response = await session.authenticatedRequest<MessageResponse>(
                '/auth/email-verification/send',
                { method: 'POST' },
            );

            setStillWaiting(false);
            setSent(response.message);
        });

    const check = () =>
        submit(async () => {
            setSent(null);

            const user = await session.reload();

            setStillWaiting(user !== null && !user.email_verified);
        });

    return (
        <AuthScreen title="Confirm your email" subtitle={`We sent a link to ${session.user.email}`}>
            <View className="gap-4">
                <FormMessage message={sent} tone="success" />
                <FormMessage
                    message={
                        stillWaiting
                            ? 'This address is still unconfirmed. Open the link in the email, then try again.'
                            : null
                    }
                    tone="warning"
                />
                <FormMessage message={message} />

                <Text className="text-muted-foreground text-center text-sm">
                    Open the link on any device, then come back and continue.
                </Text>

                <Button onPress={check} busy={busy}>
                    I have confirmed it
                </Button>

                <Button onPress={resend} variant="outline" busy={busy}>
                    Send another email
                </Button>

                <Button onPress={() => void session.logout()} variant="ghost">
                    Log out
                </Button>
            </View>
        </AuthScreen>
    );
}
