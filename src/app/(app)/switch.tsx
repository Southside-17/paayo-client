import { useLocalSearchParams } from 'expo-router';
import Check from 'lucide-react-native/icons/check';
import CircleUser from 'lucide-react-native/icons/circle-user';
import Store from 'lucide-react-native/icons/store';
import { useColorScheme } from 'nativewind';
import type { ComponentType } from 'react';
import { Pressable, ScrollView, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { BackButton } from '@/components/back-button';
import { ScreenHeader } from '@/components/ui/screen-header';
import { StatusPill } from '@/components/ui/status-pill';
import { Text } from '@/components/ui/text';
import { useWorkspace } from '@/lib/workspace';
import palette from '@/theme/palette';

type Glyph = ComponentType<{ color: string; size: number }>;

type Props = {
    icon: Glyph;
    name: string;
    note: string;
    held: string | null;
    active: boolean;
    onPress: () => void;
};

/**
 * One side of the app to move to, personal or a business.
 */
function Choice({ icon: Icon, name, note, held, active, onPress }: Props) {
    const { colorScheme } = useColorScheme();
    const colours = palette[colorScheme ?? 'light'];

    return (
        <Pressable
            accessibilityRole="button"
            onPress={onPress}
            className="border-border bg-card flex-row items-center gap-3.5 rounded-xl border p-4"
        >
            <Icon color={colours.brand} size={22} />

            <View className="flex-1 gap-1">
                <Text className="font-semibold">{name}</Text>
                <Text className="text-muted-foreground text-xs">{note}</Text>
                {held ? <StatusPill tone="warning">{held}</StatusPill> : null}
            </View>

            {active ? <Check color={colours.brand} size={20} /> : null}
        </Pressable>
    );
}

/**
 * Which side of the app to use.
 */
export default function Switch() {
    const { from } = useLocalSearchParams<{ from?: string }>();
    const { staff, businesses, enter, leave } = useWorkspace();

    return (
        <SafeAreaView className="bg-background flex-1">
            <ScrollView contentContainerClassName="gap-4 p-6">
                <BackButton label={from ?? 'Account'} />

                <ScreenHeader title="Switch" />

                <Choice
                    icon={CircleUser}
                    name="Personal"
                    note="Book work for yourself"
                    held={null}
                    active={staff === null}
                    onPress={leave}
                />

                {businesses.map((one) => (
                    <Choice
                        key={one.id}
                        icon={Store}
                        name={one.provider.name}
                        note={one.role_label}
                        held={one.provider.suspension ? 'suspended' : null}
                        active={staff?.id === one.id}
                        onPress={() => enter(one)}
                    />
                ))}

                {businesses.length === 0 ? (
                    <Text className="text-muted-foreground text-sm">
                        You are not on any business&apos;s staff yet.
                    </Text>
                ) : null}
            </ScrollView>
        </SafeAreaView>
    );
}
