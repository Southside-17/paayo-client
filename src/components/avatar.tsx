import { Image } from 'expo-image';
import { View } from 'react-native';

import { Text } from '@/components/ui/text';
import { API_URL } from '@/lib/api';

type Props = {
    nickname: string;
    avatar: boolean;
    token: string | null;
    version: number;
    size?: number;
};

/**
 * The picture on an account, or the initial standing in for one.
 *
 * The file is private, so it is fetched with the bearer token rather than from
 * a public URL. `version` is bumped after an upload: the URL never changes, so
 * nothing else would tell the image cache to look again.
 */
export function Avatar({ nickname, avatar, token, version, size = 72 }: Props) {
    const initial = nickname.trim().charAt(0).toUpperCase() || '?';

    // The route answers 404 for an account holding no picture, so `avatar` is
    // read first rather than asking and letting the request fail.
    if (!avatar || token === null) {
        return <Initial initial={initial} size={size} />;
    }

    return (
        <Image
            testID="avatar-image"
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
