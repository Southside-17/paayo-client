import { Image } from 'expo-image';
import { PlayIcon } from 'lucide-react-native';
import { View } from 'react-native';

import { Text } from '@/components/ui/text';
import { cn } from '@/lib/utils';

type Props = {
    uri: string;
    /** Video frames are not extractable without a native decoder here. */
    video: boolean;
    size?: number;
    headers?: Record<string, string>;
    className?: string;
};

/**
 * One picked or stored file, as a square.
 *
 * A video gets a drawn tile rather than a frame: pulling the first frame out of
 * a clip needs a native decoder, and nothing in this app carries one. A blank
 * square would read as a broken upload, so it says what it is instead.
 */
export function MediaThumb({ uri, video, size = 88, headers, className }: Props) {
    if (video) {
        return (
            <View
                className={cn(
                    'bg-muted border-border items-center justify-center gap-1 rounded-xl border',
                    className,
                )}
                style={{ width: size, height: size }}
            >
                <PlayIcon size={20} className="text-muted-foreground" />
                <Text className="text-muted-foreground text-[10px] font-medium">Video</Text>
            </View>
        );
    }

    return (
        <Image
            source={{ uri, headers }}
            style={{ width: size, height: size, borderRadius: 12 }}
            contentFit="cover"
        />
    );
}
