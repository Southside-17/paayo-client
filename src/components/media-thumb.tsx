import { Image } from 'expo-image';
import { getThumbnailAsync } from 'expo-video-thumbnails';
import Play from 'lucide-react-native/icons/play';
import { useEffect, useState } from 'react';
import { View } from 'react-native';

type Props = {
    uri: string;
    video: boolean;
    size?: number;
    headers?: Record<string, string>;
};

/** How far into a clip the still is taken from. */
const FRAME_AT = 600;

/** Stills already pulled, keyed by the clip they came from. */
const stills = new Map<string, string>();

/** Pulls in flight, so a re-render joins one rather than starting another. */
const pulling = new Map<string, Promise<string>>();

/** The first usable frame of a clip, fetched at most once per clip. */
function stillFor(uri: string, headers?: Record<string, string>): Promise<string> {
    const held = pulling.get(uri);

    if (held) {
        return held;
    }

    const pull = getThumbnailAsync(uri, { time: FRAME_AT, quality: 0.6, headers })
        .then((still) => {
            stills.set(uri, still.uri);

            return still.uri;
        })
        .catch((reason: unknown) => {
            pulling.delete(uri);

            throw reason;
        });

    pulling.set(uri, pull);

    return pull;
}

/**
 * One picked or stored file, as a square.
 */
export function MediaThumb({ uri, video, size = 88, headers }: Props) {
    const [still, setStill] = useState<string | null>(() => stills.get(uri) ?? null);
    const box = { width: size, height: size };

    useEffect(() => {
        if (!video || stills.has(uri)) {
            return;
        }

        let watching = true;

        void stillFor(uri, headers)
            .then((frame) => watching && setStill(frame))
            .catch(() => undefined);

        return () => {
            watching = false;
        };
    }, [uri, video, headers]);

    if (!video) {
        return (
            <Image
                source={{ uri, headers }}
                style={{ ...box, borderRadius: 12 }}
                contentFit="cover"
            />
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
