import * as ImagePicker from 'expo-image-picker';
import ImagePlus from 'lucide-react-native/icons/image-plus';
import X from 'lucide-react-native/icons/x';
import { useColorScheme } from 'nativewind';
import { useState, type Dispatch, type SetStateAction } from 'react';
import { Pressable, View } from 'react-native';

import { MediaThumb } from '@/components/media-thumb';
import { Text } from '@/components/ui/text';
import { preparePicture } from '@/lib/picture';
import { discardAttachment, uploadAttachment, type Picked } from '@/lib/upload';
import { cn } from '@/lib/utils';
import palette from '@/theme/palette';

/** The longest side a photo of the work is stored at. */
const PHOTO_SIZE = 1600;

/** How long a clip may run. Long enough to show a fault, short enough to send. */
const VIDEO_SECONDS = 20;

/** The most that can be attached to one booking. */
export const MAX_MEDIA = 6;

type Send = Parameters<typeof uploadAttachment>[0];

export type MediaItem = {
    /** Local while it uploads; the server's id once it lands. */
    key: string;
    uri: string;
    video: boolean;
    /** 0 to 1 while sending, then null. */
    progress: number | null;
    id: string | null;
    failed: boolean;
    asset: Picked;
};

type Props = {
    send: Send;
    items: MediaItem[];
    /**
     * Takes an updater, not a list. Uploads run concurrently and report
     * progress as they go, so anything that closed over the list it was handed
     * would overwrite whatever landed while it was in flight.
     */
    onChange: Dispatch<SetStateAction<MediaItem[]>>;
    disabled?: boolean;
    /** Outlines the add tile the way an unfilled input is outlined. */
    invalid?: boolean;
};

/**
 * Take photos and video of the job, sending each one as it is chosen.
 *
 * Uploading on pick rather than on submit is what keeps Book instant: by the
 * time the button is pressed the bytes are already on the server, and a failure
 * shows up next to the thumbnail that caused it instead of after the person
 * thought they were finished.
 */
export function MediaPicker({ send, items, onChange, disabled = false, invalid = false }: Props) {
    const { colorScheme } = useColorScheme();
    const colours = palette[colorScheme ?? 'light'];
    const [busy, setBusy] = useState(false);

    const patch = (key: string, change: Partial<MediaItem>) =>
        onChange((current) =>
            current.map((item) => (item.key === key ? { ...item, ...change } : item)),
        );

    const upload = async (item: MediaItem) => {
        try {
            const attachment = await uploadAttachment(send, item.asset, (fraction) =>
                patch(item.key, { progress: fraction }),
            );

            patch(item.key, { id: attachment.id, progress: null, failed: false });
        } catch {
            patch(item.key, { progress: null, failed: true });
        }
    };

    const pick = async () => {
        const room = MAX_MEDIA - items.length;

        if (room <= 0) {
            return;
        }

        setBusy(true);

        try {
            const picked = await ImagePicker.launchImageLibraryAsync({
                mediaTypes: ['images', 'videos'],
                allowsMultipleSelection: true,
                selectionLimit: room,
                videoMaxDuration: VIDEO_SECONDS,
                quality: 0.8,
            });

            if (picked.canceled) {
                return;
            }

            const chosen: MediaItem[] = [];

            for (const asset of picked.assets) {
                const video = (asset.mimeType ?? '').startsWith('video/') || asset.type === 'video';

                // A camera photo is megabytes of resolution nobody will look at;
                // a video is left alone, because re-encoding it here would cost
                // more than sending it.
                const prepared: Picked = video
                    ? { uri: asset.uri, mimeType: asset.mimeType, fileName: asset.fileName }
                    : await preparePicture(asset, PHOTO_SIZE, 'photo.jpg');

                chosen.push({
                    key: `${asset.assetId ?? asset.uri}-${chosen.length}`,
                    uri: asset.uri,
                    video,
                    progress: 0,
                    id: null,
                    failed: false,
                    asset: prepared,
                });
            }

            onChange((current) => [...current, ...chosen]);

            await Promise.all(chosen.map((item) => upload(item)));
        } finally {
            setBusy(false);
        }
    };

    const remove = async (item: MediaItem) => {
        onChange((current) => current.filter((each) => each.key !== item.key));

        if (item.id) {
            await discardAttachment(send, item.id).catch(() => undefined);
        }
    };

    return (
        <View className="flex-row flex-wrap gap-2">
            {items.map((item) => (
                <View key={item.key} className="relative">
                    <MediaThumb uri={item.uri} video={item.video} />

                    {item.progress !== null ? (
                        <View className="absolute inset-x-1 bottom-1 h-1.5 overflow-hidden rounded-full bg-black/40">
                            <View
                                className="bg-brand h-full"
                                style={{ width: `${Math.round(item.progress * 100)}%` }}
                            />
                        </View>
                    ) : null}

                    {item.failed ? (
                        <Pressable
                            accessibilityRole="button"
                            onPress={() => void upload(item)}
                            className="bg-destructive/90 absolute inset-0 items-center justify-center rounded-xl"
                        >
                            <Text className="text-destructive-foreground text-xs font-semibold">
                                Retry
                            </Text>
                        </Pressable>
                    ) : null}

                    <Pressable
                        accessibilityRole="button"
                        accessibilityLabel="Remove"
                        onPress={() => void remove(item)}
                        className="bg-background border-border absolute -right-1 -top-1 h-6 w-6 items-center justify-center rounded-full border"
                    >
                        <X color={colours.foreground} size={14} />
                    </Pressable>
                </View>
            ))}

            {items.length < MAX_MEDIA ? (
                <Pressable
                    accessibilityRole="button"
                    accessibilityLabel="Add a photo or video"
                    onPress={() => void pick()}
                    disabled={disabled || busy}
                    className={cn(
                        'bg-card items-center justify-center rounded-xl border border-dashed',
                        invalid ? 'border-destructive' : 'border-border',
                        (disabled || busy) && 'opacity-50',
                    )}
                    style={{ width: 88, height: 88 }}
                >
                    <ImagePlus color={colours['muted-foreground']} size={22} />
                </Pressable>
            ) : null}
        </View>
    );
}

/** The uploads that finished, in the shape the booking request wants. */
export function readyIds(items: MediaItem[]): string[] {
    return items.map((item) => item.id).filter((id): id is string => id !== null);
}

/** Whether anything is still moving, so Book can wait for it. */
export function stillSending(items: MediaItem[]): boolean {
    return items.some((item) => item.progress !== null);
}
