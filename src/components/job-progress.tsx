import { useColorScheme } from 'nativewind';
import { View } from 'react-native';

import { Card } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Text } from '@/components/ui/text';
import type { Job } from '@/lib/types';
import { cn } from '@/lib/utils';
import palette from '@/theme/palette';

type Props = {
    job: Job;
    /** The crew's name, when there is one to say. */
    crew?: string | null;
    audience?: 'client' | 'provider';
};

/** One rung of the trail, and the stamp that proves it happened. */
type Step = { label: string; at: string | null };

/** The hour something happened, short enough to sit under a step. */
function at(stamp: string | null): string | null {
    return stamp === null
        ? null
        : new Date(stamp).toLocaleTimeString('en-PH', { hour: 'numeric', minute: '2-digit' });
}

/**
 * The one line above the trail, in the tense the job is actually in.
 *
 * Written here rather than read off `status.wording`: that is a pill's label,
 * and this is a sentence about a named person at a named time.
 */
function sentence(job: Job, who: string): string {
    const you = who === 'You';

    if (job.status.value === 'cancelled') {
        return 'This was called off.';
    }

    if (job.completed_at !== null) {
        return `Finished at ${at(job.completed_at)}.`;
    }

    if (job.started_at !== null) {
        return `Working since ${at(job.started_at)}.`;
    }

    if (job.arrived_at !== null) {
        return `${who} arrived at ${at(job.arrived_at)}.`;
    }

    if (job.enroute_at !== null) {
        return you ? 'You set out.' : `${who} is on the way.`;
    }

    if (job.status.value === 'unassigned') {
        return 'Nobody is on this yet.';
    }

    return you ? 'You have not set out yet.' : `${who} has not set out yet.`;
}

/**
 * How far along the work is, and what is true right now.
 *
 * This is what actually answers "where is the crew" for a visit booked at an
 * hour, and it is honest: it says what is known rather than implying a
 * precision there isn't. A moving dot is deliberately not built, and a trail
 * with real timestamps is more use to somebody waiting in than a marker
 * refreshed every thirty seconds.
 */
export function JobProgress({ job, crew = null, audience = 'client' }: Props) {
    const { colorScheme } = useColorScheme();
    const colours = palette[colorScheme ?? 'light'];
    const who = crew ?? (audience === 'provider' ? 'You' : 'They');

    const steps: Step[] = [
        { label: 'On the way', at: job.enroute_at },
        { label: 'Arrived', at: job.arrived_at },
        { label: 'Working', at: job.started_at },
        { label: 'Done', at: job.completed_at },
    ];

    // The rung the job is standing on: the last one reached, or none yet.
    const standing = steps.reduce(
        (furthest, step, index) => (step.at !== null ? index : furthest),
        -1,
    );

    return (
        <Card className="gap-3">
            <Label>{audience === 'provider' ? 'Where this job is up to' : 'How it is going'}</Label>
            <Text className="text-lg font-semibold">{sentence(job, who)}</Text>

            <View className="mt-1 flex-row">
                {steps.map((step, index) => {
                    const reached = step.at !== null;
                    const active = index === standing;

                    return (
                        <View key={step.label} className="flex-1">
                            <View className="h-3 flex-row items-center">
                                {/* The rail is drawn in halves so neither end
                                    overhangs the first and last dots. */}
                                <View
                                    className={cn(
                                        'h-0.5 flex-1',
                                        index === 0
                                            ? 'bg-transparent'
                                            : reached
                                              ? 'bg-brand'
                                              : 'bg-border',
                                    )}
                                />
                                <View
                                    className={cn(
                                        'rounded-full',
                                        active ? 'h-3 w-3' : 'h-2 w-2',
                                        reached ? 'bg-brand' : 'bg-border',
                                    )}
                                    style={
                                        active
                                            ? { borderColor: colours['brand-subtle'], borderWidth: 3 }
                                            : undefined
                                    }
                                />
                                <View
                                    className={cn(
                                        'h-0.5 flex-1',
                                        index === steps.length - 1
                                            ? 'bg-transparent'
                                            : reached && !active
                                              ? 'bg-brand'
                                              : 'bg-border',
                                    )}
                                />
                            </View>

                            <Text
                                className={cn(
                                    'mt-1.5 text-center text-[11px] font-semibold',
                                    reached ? 'text-foreground' : 'text-muted-foreground',
                                )}
                            >
                                {step.label}
                            </Text>

                            {/* A fixed height, so a step gaining a stamp does not
                                shift the row it sits in. */}
                            <Text className="text-muted-foreground h-4 text-center text-[10px]">
                                {at(step.at) ?? ''}
                            </Text>
                        </View>
                    );
                })}
            </View>
        </Card>
    );
}
