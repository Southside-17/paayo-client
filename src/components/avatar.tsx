import { Image } from 'expo-image';
import { View } from 'react-native';

import { Text } from '@/components/ui/text';

type Props = {
    nickname: string;
    url?: string | null;
    size?: number;
};

/**
 * The picture on an account, or the initial standing in for one.
 */
export function Avatar({ nickname, url, size = 72 }: Props) {
    const initial = nickname.trim().charAt(0).toUpperCase() || '?';

    if (!url) {
        return <Initial initial={initial} size={size} />;
    }

    return (
        <Image
            testID="avatar-image"
            source={{ uri: url }}
            style={{ width: size, height: size, borderRadius: size / 2 }}
            contentFit="cover"
            placeholder={null}
            transition={120}
        />
    );
}

function Initial({ initial, size }: { initial: string; size: number }) {
    return (
        <View
            className="bg-brand-subtle items-center justify-center"
            style={{ width: size, height: size, borderRadius: size / 2 }}
        >
            <Text className="text-brand text-2xl font-bold">{initial}</Text>
        </View>
    );
}
