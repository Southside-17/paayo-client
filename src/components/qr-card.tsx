import { Image } from 'expo-image';
import Download from 'lucide-react-native/icons/download';
import Maximize2 from 'lucide-react-native/icons/maximize-2';
import Share2 from 'lucide-react-native/icons/share-2';
import { useColorScheme } from 'nativewind';
import { useState } from 'react';
import { Pressable, View } from 'react-native';

import { Text } from '@/components/ui/text';
import { destinationLine } from '@/lib/billing';
import { saveCode, shareCode } from '@/lib/codes';
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
    const [busy, setBusy] = useState(false);
    const [said, setSaid] = useState<string | null>(null);
    const code = destination.code_url ?? null;
    const filename = `${destination.institution.toLowerCase().replace(/[^a-z0-9]+/g, '-')}-qr.png`;

    const run = async (what: 'save' | 'share') => {
        setBusy(true);
        setSaid(null);

        try {
            const done =
                what === 'save'
                    ? await saveCode(code ?? '', filename)
                    : await shareCode(code ?? '', filename);

            // A refusal is not a failure. Somebody who said no to the photo
            // library made a choice, and telling them so plainly beats an error.
            setSaid(
                done
                    ? what === 'save'
                        ? 'Saved to your photos.'
                        : null
                    : what === 'save'
                      ? 'Paayo needs permission to save to your photos.'
                      : 'Sharing is not available on this phone.',
            );
        } catch {
            setSaid('Could not fetch the code. Try again.');
        } finally {
            setBusy(false);
        }
    };

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
                <View className="gap-1.5">
                    <View className="flex-row gap-2">
                        <Pressable
                            accessibilityRole="button"
                            accessibilityLabel={`Show the ${destination.institution} QR full screen`}
                            onPress={() => onOpen(code)}
                            className="border-border flex-1 flex-row items-center justify-center gap-1.5 rounded-xl border border-dashed py-2"
                        >
                            <Maximize2 color={colours['muted-foreground']} size={13} />
                            <Text className="text-xs font-semibold">Bigger</Text>
                        </Pressable>

                        {/* Sending the client the code before the visit is what a
                            business actually wants, and it saves the crew holding
                            a screen out at the door. */}
                        <Pressable
                            accessibilityRole="button"
                            accessibilityLabel={`Send the ${destination.institution} QR`}
                            disabled={busy}
                            onPress={() => void run('share')}
                            className="border-border flex-1 flex-row items-center justify-center gap-1.5 rounded-xl border border-dashed py-2"
                        >
                            <Share2 color={colours['muted-foreground']} size={13} />
                            <Text className="text-xs font-semibold">Send</Text>
                        </Pressable>

                        <Pressable
                            accessibilityRole="button"
                            accessibilityLabel={`Save the ${destination.institution} QR`}
                            disabled={busy}
                            onPress={() => void run('save')}
                            className="border-border flex-1 flex-row items-center justify-center gap-1.5 rounded-xl border border-dashed py-2"
                        >
                            <Download color={colours['muted-foreground']} size={13} />
                            <Text className="text-xs font-semibold">Save</Text>
                        </Pressable>
                    </View>

                    {said ? (
                        <Text className="text-muted-foreground text-xs">{said}</Text>
                    ) : null}
                </View>
            ) : null}
        </View>
    );
}
