import Check from 'lucide-react-native/icons/check';
import ChevronsUpDown from 'lucide-react-native/icons/chevrons-up-down';
import { useColorScheme } from 'nativewind';
import { useState } from 'react';
import { Pressable, View } from 'react-native';

import { Avatar } from '@/components/avatar';
import { BusinessGlyph } from '@/components/business-glyph';
import { Sheet } from '@/components/ui/sheet';
import { StatusPill } from '@/components/ui/status-pill';
import { Text } from '@/components/ui/text';
import { useSession } from '@/lib/session';
import type { Staff } from '@/lib/types';
import { cn } from '@/lib/utils';
import { useWorkspace } from '@/lib/workspace';
import palette from '@/theme/palette';

/**
 * Which side of the app you are acting on, and the way to the other one.
 *
 * Sits in the header rather than in a list: switching changes every screen
 * underneath it, which is a shell decision, not a setting. An account on no
 * staff never sees it.
 */
export function BusinessChip() {
    const session = useSession();
    const { staff, businesses, enter, leave } = useWorkspace();
    const [open, setOpen] = useState(false);
    const { colorScheme } = useColorScheme();
    const colours = palette[colorScheme ?? 'light'];

    if (session.status !== 'authenticated' || businesses.length === 0) {
        return null;
    }

    const { user } = session;
    const only = businesses.length === 1 ? businesses[0] : null;

    // One business is the common case, so it switches straight across. The
    // sheet only earns its tap when there is actually a choice to make.
    const press = () => {
        if (only === null) {
            setOpen(true);

            return;
        }

        if (staff === null) {
            enter(only);

            return;
        }

        leave();
    };

    const choose = (chosen: Staff | null) => {
        setOpen(false);

        if (chosen === null) {
            leave();

            return;
        }

        enter(chosen);
    };

    return (
        <>
            <Pressable
                accessibilityRole="button"
                accessibilityLabel={`Acting as ${staff?.provider.name ?? user.nickname}. Switch.`}
                onPress={press}
                className="border-border bg-card max-w-[46%] shrink flex-row items-center gap-1.5 rounded-full border py-1 pl-1 pr-2.5"
            >
                {staff ? (
                    <BusinessGlyph name={staff.provider.name} size={20} />
                ) : (
                    <Avatar nickname={user.nickname} url={user.avatar_url} size={20} />
                )}

                <Text className="shrink text-xs font-bold" numberOfLines={1}>
                    {staff?.provider.name ?? user.nickname}
                </Text>

                <ChevronsUpDown color={colours['muted-foreground']} size={13} />
            </Pressable>

            <Sheet open={open} onDismiss={() => setOpen(false)} label="Act as">
                <Text className="text-base font-bold">Act as</Text>

                <Choice
                    glyph={<Avatar nickname={user.nickname} url={user.avatar_url} size={30} />}
                    name={user.nickname}
                    note="Personal"
                    active={staff === null}
                    onPress={() => choose(null)}
                />

                {businesses.map((one) => (
                    <Choice
                        key={one.id}
                        glyph={<BusinessGlyph name={one.provider.name} />}
                        name={one.provider.name}
                        note={one.role_label}
                        held={one.provider.suspension !== null}
                        active={staff?.id === one.id}
                        onPress={() => choose(one)}
                    />
                ))}
            </Sheet>
        </>
    );
}

type ChoiceProps = {
    glyph: React.ReactNode;
    name: string;
    note: string;
    held?: boolean;
    active: boolean;
    onPress: () => void;
};

/**
 * One side of the app to move to. Every row is the same height whatever it
 * carries: the hold sits inline before the check rather than under the role,
 * the check keeps its column even when empty, and a long name truncates.
 */
function Choice({ glyph, name, note, held = false, active, onPress }: ChoiceProps) {
    const { colorScheme } = useColorScheme();
    const colours = palette[colorScheme ?? 'light'];

    return (
        <Pressable
            accessibilityRole="button"
            accessibilityState={{ selected: active }}
            onPress={onPress}
            className={cn(
                'min-h-14 flex-row items-center gap-2.5 rounded-xl border p-3',
                active ? 'border-brand bg-brand-subtle' : 'border-border',
            )}
        >
            {glyph}

            <View className="min-w-0 flex-1 gap-0.5">
                <Text className="text-sm font-bold" numberOfLines={1}>
                    {name}
                </Text>
                <Text className="text-muted-foreground text-xs" numberOfLines={1}>
                    {note}
                </Text>
            </View>

            {held ? <StatusPill tone="warning">on hold</StatusPill> : null}

            <View className="w-4 items-center">
                {active ? <Check color={colours.brand} size={16} /> : null}
            </View>
        </Pressable>
    );
}
