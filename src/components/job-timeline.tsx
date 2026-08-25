import { View } from 'react-native';

import { Card } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Text } from '@/components/ui/text';
import type { Activity } from '@/lib/types';

/** When something happened, to the minute, on the day it happened. */
function moment(stamp: string): string {
    return new Date(stamp).toLocaleString('en-PH', {
        day: 'numeric',
        month: 'short',
        hour: 'numeric',
        minute: '2-digit',
    });
}

/**
 * Everything that has happened on a job, oldest first.
 *
 * One component for both audiences: the wording comes off the server, so the
 * client and the business read the same history rather than two paraphrases of
 * it. The gap between arriving and starting is left visible on purpose -- a
 * long one is real information about why a job ran late.
 */
export function JobTimeline({ activities }: { activities: Activity[] }) {
    if (activities.length === 0) {
        return null;
    }

    return (
        <Card className="gap-3">
            <Label>What has happened</Label>

            {activities.map((activity, index) => {
                const last = index === activities.length - 1;

                return (
                    <View key={activity.id} className="flex-row gap-3">
                        <View className="w-2 items-center">
                            <View className="bg-brand mt-1.5 h-2 w-2 rounded-full" />
                            {/* The rail stops at the last dot rather than trailing
                                off the bottom of the card. */}
                            {last ? null : <View className="bg-border w-0.5 flex-1" />}
                        </View>

                        <View className={last ? 'gap-0.5' : 'gap-0.5 pb-3'}>
                            <Text className="text-sm font-semibold">{activity.wording}</Text>
                            <Text className="text-muted-foreground text-xs">
                                {activity.by
                                    ? `${moment(activity.occurred_at)} · ${activity.by}`
                                    : moment(activity.occurred_at)}
                            </Text>
                        </View>
                    </View>
                );
            })}
        </Card>
    );
}
