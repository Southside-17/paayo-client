import { Image } from 'expo-image';
import { useVideoPlayer, VideoView } from 'expo-video';
import X from 'lucide-react-native/icons/x';
import { Modal, Pressable, View } from 'react-native';

export type Viewable = { uri: string; video: boolean };

type Props = {
    item: Viewable | null;
    headers?: Record<string, string>;
    onClose: () => void;
};

/**
 * One attachment at full size, played through if it is a clip.
 */
export function MediaViewer({ item, headers, onClose }: Props) {
    return (
        <Modal
            visible={item !== null}
            transparent
            animationType="fade"
            statusBarTranslucent
            onRequestClose={onClose}
        >
            <View className="flex-1 bg-black">
                {item?.video ? <Clip uri={item.uri} headers={headers} /> : null}

                {item && !item.video ? (
                    <Image
                        source={{ uri: item.uri, headers }}
                        style={{ flex: 1 }}
                        contentFit="contain"
                    />
                ) : null}

                <Pressable
                    accessibilityRole="button"
                    accessibilityLabel="Close"
                    onPress={onClose}
                    className="absolute right-5 top-14 h-10 w-10 items-center justify-center rounded-full bg-white/20"
                >
                    <X color="#ffffff" size={20} />
                </Pressable>
            </View>
        </Modal>
    );
}

/**
 * The player is built here rather than in the viewer so it is created when a
 * clip is opened and released when it is closed, instead of living on every
 * screen that can show one.
 */
function Clip({ uri, headers }: { uri: string; headers?: Record<string, string> }) {
    const player = useVideoPlayer({ uri, headers }, (ready) => {
        ready.loop = false;
        ready.play();
    });

    return (
        <VideoView player={player} style={{ flex: 1 }} contentFit="contain" nativeControls />
    );
}
