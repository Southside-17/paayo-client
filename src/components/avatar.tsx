import { Image } from 'expo-image';
import { View } from 'react-native';

import { Text } from '@/components/ui/text';
import { API_URL } from '@/lib/api';

type Props = { nickname: string; token: string | null; version: number; size?: number };

/**
 * The picture on an account, or the initial standing in for one.
 *
 * The file is private, so it is fetched with the bearer token rather than from
 * a public URL. `version` is bumped after an upload: the URL never changes, so
 * nothing else would tell the image cache to look again.
 */
export function Avatar({ nickname, token, version, size = 72 }: Props) {
    const initial = nickname.trim().charAt(0).toUpperCase() || '?';

    if (token === null) {
        return <Initial initial={initial} size={size} />;
    }

    return (
        <Image
            source={{
                uri: `${API_URL}/api/v1/profile/avatar?v=${version}`,
                headers: { Authorization: `Bearer ${token}` },
            }}
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
