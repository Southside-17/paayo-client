import { ScrollView } from 'react-native';

import { Text } from '@/components/ui/text';
import type { BookingFilter as Filter } from '@/lib/types';
import { cn } from '@/lib/utils';

type Props = {
    /** The statuses worth narrowing by, in the order the server sent them. */
    filters: Filter[];
    /** Every booking loaded, whatever its status. */
    counts: Record<string, number>;
    total: number;
    chosen: string | null;
    onChoose: (value: string | null) => void;
};

/**
 * Narrow a list of bookings to one status.
 *
 * Which statuses are worth narrowing by is the server's call -- it leaves out
 * cancelled, and would add a new case here without an app release. The counts
 * are the client's, because the list it holds is the whole list.
 */
export function BookingFilter({ filters, counts, total, chosen, onChoose }: Props) {
    if (total === 0) {
        return null;
    }

    return (
        <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerClassName="gap-2 pr-6"
            className="-mx-6 shrink-0 grow-0 px-6"
        >
            <Chip label="All" count={total} active={chosen === null} onPress={() => onChoose(null)} />

            {filters.map((filter) => (
                <Chip
                    key={filter.value}
                    label={filter.label}
                    count={counts[filter.value] ?? 0}
                    active={chosen === filter.value}
                    onPress={() => onChoose(chosen === filter.value ? null : filter.value)}
                />
            ))}
        </ScrollView>
    );
}

type ChipProps = { label: string; count: number; active: boolean; onPress: () => void };

/**
 * One status to narrow to, carrying how many are in it.
 *
 * An empty one stays tappable and is only dimmed. Removing it would make the
 * row rearrange itself as bookings are answered, and "none" is an answer worth
 * being able to ask for.
 */
function Chip({ label, count, active, onPress }: ChipProps) {
    return (
        <Text
            accessibilityRole="button"
            accessibilityLabel={`${label}, ${count}`}
            accessibilityState={{ selected: active }}
            onPress={onPress}
            className={cn(
                'rounded-full border px-3.5 py-1.5 text-xs font-bold',
                active
                    ? 'border-brand bg-brand-subtle text-brand'
                    : 'border-border text-muted-foreground',
                !active && count === 0 && 'opacity-50',
            )}
        >
            {`${label}  ${count}`}
        </Text>
    );
}
