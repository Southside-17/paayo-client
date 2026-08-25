import * as ImagePicker from 'expo-image-picker';
import Camera from 'lucide-react-native/icons/camera';
import ImageIcon from 'lucide-react-native/icons/image';
import { useColorScheme } from 'nativewind';
import { Image, Pressable, View } from 'react-native';

import { Sheet } from '@/components/ui/sheet';
import { SheetAction } from '@/components/ui/sheet-action';
import { Text } from '@/components/ui/text';
import { type Upload, preparePicture } from '@/lib/picture';
import { cn } from '@/lib/utils';
import palette from '@/theme/palette';
import { useState } from 'react';

/** The longest side a document or face is stored at. */
export const CAPTURE_SIZE = 1600;

type Props = {
    label: string;
    hint?: string;
    value: Upload | null;
    onChange: (upload: Upload | null) => void;
    /** Opens the front camera and skips the library, for photographing a face. */
    face?: boolean;
    disabled?: boolean;
    invalid?: boolean;
};

/**
 * One photograph a claim needs, with the two ways of producing it.
 */
export function CaptureCard({
    label,
    hint,
    value,
    onChange,
    face = false,
    disabled = false,
    invalid = false,
}: Props) {
    const [picking, setPicking] = useState(false);
    const { colorScheme } = useColorScheme();
    const colours = palette[colorScheme ?? 'light'];

    const take = async (fromCamera: boolean) => {
        setPicking(false);

        if (fromCamera) {
            const allowed = await ImagePicker.requestCameraPermissionsAsync();

            if (!allowed.granted) {
                return;
            }
        }

        const picked = fromCamera
            ? await ImagePicker.launchCameraAsync({
                  quality: 0.9,
                  cameraType: face
                      ? ImagePicker.CameraType.front
                      : ImagePicker.CameraType.back,
              })
            : await ImagePicker.launchImageLibraryAsync({
                  mediaTypes: ['images'],
                  quality: 0.9,
              });

        if (picked.canceled) {
            return;
        }

        onChange(await preparePicture(picked.assets[0], CAPTURE_SIZE, `${label}.jpg`));
    };

    return (
        <View className="gap-2">
            <Pressable
                accessibilityRole="button"
                accessibilityLabel={value ? `Replace the ${label}` : `Add the ${label}`}
                disabled={disabled}
                onPress={() => (face ? void take(true) : setPicking(true))}
                className={cn(
                    'border-input bg-card items-center justify-center overflow-hidden rounded-xl border border-dashed',
                    value ? 'h-44' : 'h-28',
                    invalid && 'border-destructive',
                    disabled && 'opacity-50',
                )}
            >
                {value ? (
                    <Image source={{ uri: value.uri }} className="h-full w-full" resizeMode="cover" />
                ) : (
                    <View className="items-center gap-1.5">
                        <Camera color={colours['muted-foreground']} size={22} />
                        <Text className="text-muted-foreground text-sm">{label}</Text>
                        {hint ? (
                            <Text className="text-muted-foreground text-xs">{hint}</Text>
                        ) : null}
                    </View>
                )}
            </Pressable>

            {value ? (
                <View className="flex-row gap-4">
                    <Text
                        className="text-brand text-sm"
                        onPress={() => (face ? void take(true) : setPicking(true))}
                    >
                        Retake
                    </Text>
                    <Text className="text-muted-foreground text-sm" onPress={() => onChange(null)}>
                        Remove
                    </Text>
                </View>
            ) : null}

            <Sheet open={picking} onDismiss={() => setPicking(false)} label={label}>
                <Text className="text-base font-bold">{label}</Text>

                <SheetAction icon={Camera} onPress={() => void take(true)}>
                    Take a photo
                </SheetAction>

                <SheetAction icon={ImageIcon} onPress={() => void take(false)}>
                    Choose from library
                </SheetAction>

                <SheetAction tone="quiet" onPress={() => setPicking(false)}>
                    Cancel
                </SheetAction>
            </Sheet>
        </View>
    );
}
