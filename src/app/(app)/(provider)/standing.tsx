import { useState } from 'react';
import { ScrollView, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { BusinessChip } from '@/components/business-chip';
import { BusinessGlyph } from '@/components/business-glyph';
import { FormMessage } from '@/components/form-message';
import { HoldNotice } from '@/components/hold-notice';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { ScreenHeader } from '@/components/ui/screen-header';
import { Sheet } from '@/components/ui/sheet';
import { SheetAction } from '@/components/ui/sheet-action';
import { StatusPill } from '@/components/ui/status-pill';
import { Text } from '@/components/ui/text';
import { on } from '@/lib/dates';
import { useSession } from '@/lib/session';
import { useSubmit } from '@/lib/use-submit';
import { useWorkspace } from '@/lib/workspace';

/**
 * What a technician sees of the business they work for.
 *
 * Nothing but its name and their place in it, because they hold no permission
 * that opens anything else. Said plainly, so it reads as a role that has not
 * been given work rather than an app that is broken.
 */
export default function Standing() {
    const session = useSession();
    const { staff } = useWorkspace();
    const [asking, setAsking] = useState(false);
    const { busy, message, submit } = useSubmit();

    if (!staff) {
        return null;
    }

    const { provider } = staff;
    const waiting = staff.resignation_requested_at !== null;

    const answer = (leaving: boolean) =>
        submit(async () => {
            if (session.status !== 'authenticated') {
                return;
            }

            await session.authenticatedRequest(`/providers/${provider.id}/resignation`, {
                method: leaving ? 'POST' : 'DELETE',
            });

            setAsking(false);

            await session.reload();
        });

    return (
        <SafeAreaView className="bg-background flex-1" edges={['top']}>
            <ScrollView contentContainerClassName="flex-grow gap-4 p-6">
                <ScreenHeader title="Business">
                    <BusinessChip />
                </ScreenHeader>

                <HoldNotice suspension={provider.suspension} />

                <FormMessage message={message} />

                <View className="flex-1 items-center justify-center gap-3">
                    <BusinessGlyph name={provider.name} size={56} />

                    <Text className="text-center text-xl font-bold">{provider.name}</Text>

                    <StatusPill tone="neutral">{staff.role_label}</StatusPill>

                    <Text className="text-muted-foreground max-w-[36ch] text-center text-sm">
                        There is nothing here for a technician yet. When Paayo adds job assignment,
                        the work sent to you turns up on this screen.
                    </Text>
                </View>

                {waiting ? (
                    <Card className="border-warning/40 bg-warning-subtle gap-2">
                        <Text className="font-semibold">
                            {`You asked to leave on ${on(staff.resignation_requested_at ?? '')}`}
                        </Text>
                        <Text className="text-muted-foreground text-sm">
                            {staff.resignation_lapses_at
                                ? `You are still on the staff until an owner or manager answers. If nobody does, you leave on ${on(staff.resignation_lapses_at)}.`
                                : 'You are still on the staff until an owner or manager answers.'}
                        </Text>
                    </Card>
                ) : null}

                <Button variant="outline" busy={busy} onPress={() => (waiting ? void answer(false) : setAsking(true))}>
                    {waiting ? 'Withdraw the request' : 'Ask to leave this business'}
                </Button>
            </ScrollView>

            <Sheet open={asking} onDismiss={() => setAsking(false)} label="Ask to leave">
                <Text className="text-base font-bold">{`Ask to leave ${provider.name}?`}</Text>
                <Text className="text-muted-foreground text-sm">
                    An owner or manager has to approve it. Until they do, nothing changes -- you stay
                    on the staff and keep whatever work you have.
                </Text>

                <View className="gap-2">
                    <SheetAction tone="destructive" onPress={() => void answer(true)}>
                        Ask to leave
                    </SheetAction>
                    <SheetAction tone="quiet" onPress={() => setAsking(false)}>
                        Cancel
                    </SheetAction>
                </View>
            </Sheet>
        </SafeAreaView>
    );
}
