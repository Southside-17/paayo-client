import { ScrollView, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { BusinessBar } from '@/components/business-bar';
import { HoldNotice } from '@/components/hold-notice';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { ScreenHeader } from '@/components/ui/screen-header';
import { StatusPill } from '@/components/ui/status-pill';
import { Text } from '@/components/ui/text';
import { useWorkspace } from '@/lib/workspace';

/**
 * The business itself: what it is, where it works, and where you stand in it.
 */
export default function Business() {
    const { staff, leave } = useWorkspace();

    if (!staff) {
        return null;
    }

    const { provider } = staff;

    return (
        <SafeAreaView className="bg-background flex-1" edges={['top']}>
            <ScrollView contentContainerClassName="gap-4 p-6">
                <BusinessBar from="Business" />

                <ScreenHeader eyebrow={staff.role_label} title={provider.name} />

                <HoldNotice suspension={provider.suspension} />

                <Card className="gap-1">
                    <Label>Where does it work?</Label>
                    {provider.market ? (
                        <>
                            <Text className="text-lg font-semibold">{provider.market.name}</Text>
                            <Text className="text-muted-foreground text-sm">
                                Work is only offered inside this market.
                            </Text>
                        </>
                    ) : (
                        <Text className="text-warning text-sm">
                            No market yet, so nothing can be booked. An administrator sets this.
                        </Text>
                    )}
                </Card>

                <Card className="gap-2">
                    <Label>Is it registered?</Label>
                    <View className="flex-row">
                        <StatusPill tone={provider.registration_verified ? 'success' : 'neutral'}>
                            {provider.registration_verified ? 'registered' : 'not registered'}
                        </StatusPill>
                    </View>
                    {provider.registration_verified ? null : (
                        <Text className="text-muted-foreground text-sm">
                            Papers are checked by Paayo. Clients are not shown this yet.
                        </Text>
                    )}
                </Card>

                <Button variant="outline" onPress={leave}>
                    Switch to personal
                </Button>
            </ScrollView>
        </SafeAreaView>
    );
}
