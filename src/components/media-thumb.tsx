import { Image } from 'expo-image';
import { getThumbnailAsync } from 'expo-video-thumbnails';
import Play from 'lucide-react-native/icons/play';
import { useEffect, useState } from 'react';
import { View } from 'react-native';

type Props = {
    uri: string;
    video: boolean;
    size?: number;
};

/** How far into a clip the still is taken from. */
const FRAME_AT = 600;

/** Stills already pulled, keyed by the clip they came from. */
const stills = new Map<string, string>();

/** Pulls in flight, so a re-render joins one rather than starting another. */
const pulling = new Map<string, Promise<string>>();

/**
 * What identifies a clip across fetches of the booking it hangs off.
 *
 * The address is signed and carries a fresh signature every time, so keying the
 * cache on the whole URL would miss on every re-focus and pull the entire clip
 * down again to draw one square. The path in front of the query does not move.
 */
function keyFor(uri: string): string {
    return uri.split('?')[0];
}

/**
 * The first usable frame of a clip, fetched at most once per clip.
 *
 * No headers: a stored clip is reached through a signed address that carries
 * its own permission, and a picked one is a local file that needs none.
 */
function stillFor(uri: string): Promise<string> {
    const key = keyFor(uri);
    const held = pulling.get(key);

    if (held) {
        return held;
    }

    const pull = getThumbnailAsync(uri, { time: FRAME_AT, quality: 0.6 })
        .then((still) => {
            stills.set(key, still.uri);

            return still.uri;
        })
        .catch((reason: unknown) => {
            pulling.delete(key);

            throw reason;
        });

    pulling.set(key, pull);

    return pull;
}

/**
 * One picked or stored file, as a square.
 */
export function MediaThumb({ uri, video, size = 88 }: Props) {
    const [still, setStill] = useState<string | null>(() => stills.get(keyFor(uri)) ?? null);
    const box = { width: size, height: size };

    useEffect(() => {
        if (!video || stills.has(keyFor(uri))) {
            return;
        }

        let watching = true;

        void stillFor(uri)
            .then((frame) => watching && setStill(frame))
            .catch(() => undefined);

        return () => {
            watching = false;
        };
    }, [uri, video]);

    if (!video) {
        return (
            <Image source={{ uri }} style={{ ...box, borderRadius: 12 }} contentFit="cover" />
        );
    }

    return (
        <View className="bg-muted border-border overflow-hidden rounded-xl border" style={box}>
            {still ? (
                <Image source={{ uri: still }} style={box} contentFit="cover" />
            ) : null}

            {/* Over the frame rather than instead of it: a still of a room is
                indistinguishable from a photo of the same room, and the two
                are attached for different reasons. */}
            <View className="absolute inset-0 items-center justify-center">
                <View className="h-8 w-8 items-center justify-center rounded-full bg-black/55">
                    <Play color="#ffffff" fill="#ffffff" size={15} />
                </View>
            </View>
        </View>
    );
}
