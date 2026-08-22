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
 *
 * The address is signed by the server and fetched with no headers of its own.
 * It also carries a fresh signature every time the account is loaded, so a
 * replaced picture appears without anything having to tell the image cache to
 * look again -- which is what the version counter here used to be for.
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
