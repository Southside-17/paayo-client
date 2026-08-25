import { Image } from 'expo-image';
import Download from 'lucide-react-native/icons/download';
import Maximize2 from 'lucide-react-native/icons/maximize-2';
import * as WebBrowser from 'expo-web-browser';
import { useColorScheme } from 'nativewind';
import { Pressable, View } from 'react-native';

import { Text } from '@/components/ui/text';
import { destinationLine } from '@/lib/billing';
import type { Destination } from '@/lib/types';
import palette from '@/theme/palette';

type Props = {
    destination: Destination;
    /** Opens the code full screen, where it is big enough to scan. */
    onOpen: (uri: string) => void;
    /** Said above the code, because who is showing it to whom changes. */
    hint?: string;
};

/**
 * One account to send money to, with its QR if there is one.
 *
 * The account name leads. A code on its own is unverifiable by a person -- they
 * cannot tell whose wallet it opens -- so the name above it is the check, and the
 * QR is the convenience.
 */
export function QrCard({ destination, onOpen, hint }: Props) {
    const { colorScheme } = useColorScheme();
    const colours = palette[colorScheme ?? 'light'];
    const code = destination.code_url ?? null;

    return (
        <View className="gap-2">
            <View className="flex-row items-center gap-3">
                {code ? (
                    <Pressable
                        accessibilityRole="button"
                        accessibilityLabel={`Open the ${destination.institution} QR`}
                        onPress={() => onOpen(code)}
                        className="relative"
                    >
                        <Image
                            source={{ uri: code }}
                            style={{ width: 76, height: 76, borderRadius: 10 }}
                            contentFit="cover"
                            accessibilityLabel={`${destination.institution} QR`}
                        />
                        <View className="absolute bottom-1 right-1 rounded-md bg-black/55 p-1">
                            <Maximize2 color="#ffffff" size={11} />
                        </View>
                    </Pressable>
                ) : null}

                <View className="min-w-0 flex-1 gap-0.5">
                    <Text className="text-sm font-semibold">{destinationLine(destination)}</Text>
                    <Text className="text-muted-foreground font-mono text-xs">
                        {destination.handle}
                    </Text>
                    {hint ? (
                        <Text className="text-muted-foreground text-xs">{hint}</Text>
                    ) : null}
                </View>
            </View>

            {code ? (
                <View className="flex-row gap-2">
                    <Pressable
                        accessibilityRole="button"
                        accessibilityLabel={`Show the ${destination.institution} QR full screen`}
                        onPress={() => onOpen(code)}
                        className="border-border flex-1 flex-row items-center justify-center gap-1.5 rounded-xl border border-dashed py-2"
                    >
                        <Maximize2 color={colours['muted-foreground']} size={13} />
                        <Text className="text-xs font-semibold">Show it bigger</Text>
                    </Pressable>

                    {/* Opened in a browser rather than saved to the gallery: that
                        needs a native module this build does not carry, and the
                        browser's own save works today. */}
                    <Pressable
                        accessibilityRole="button"
                        accessibilityLabel={`Save the ${destination.institution} QR`}
                        onPress={() => void WebBrowser.openBrowserAsync(code)}
                        className="border-border flex-1 flex-row items-center justify-center gap-1.5 rounded-xl border border-dashed py-2"
                    >
                        <Download color={colours['muted-foreground']} size={13} />
                        <Text className="text-xs font-semibold">Save it</Text>
                    </Pressable>
                </View>
            ) : null}
        </View>
    );
}
