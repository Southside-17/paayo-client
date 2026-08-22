import { ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Card } from '@/components/ui/card';
import { ScreenHeader } from '@/components/ui/screen-header';
import { Text } from '@/components/ui/text';

/**
 * The work booked on this account.
 *
 * Nothing can stand here yet: the server has no booking side, so the tab says
 * so plainly rather than showing an invented request.
 */
export default function Requests() {
    return (
        <SafeAreaView className="bg-background flex-1" edges={['top']}>
            <ScrollView contentContainerClassName="gap-5 p-6">
                <ScreenHeader title="Requests" />

                <Card className="gap-2">
                    <Text className="font-semibold">Nothing booked yet</Text>
                    <Text className="text-muted-foreground text-sm">
                        Booking opens once providers are listed for your area. Every request you
                        make will be tracked here, from the quote through to the visit.
                    </Text>
                </Card>
            </ScrollView>
        </SafeAreaView>
    );
}
