import { View } from 'react-native';

import { Text } from '@/components/ui/text';
import type { Booking } from '@/lib/types';

/**
 * What a business is not told about a job it has not answered yet.
 */
export function HandoverNotice({ job }: { job: Booking }) {
    if (job.status.value !== 'pending') {
        return null;
    }

    return (
        <View className="border-info bg-info-subtle rounded-xl border p-4">
            <Text className="text-sm">
                Exact address and phone number are hidden until you take this job.
            </Text>
        </View>
    );
}
