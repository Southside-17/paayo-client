import type { ReactNode } from 'react';
import { useCallback, useEffect, useState } from 'react';
import { Modal, Pressable, ScrollView, View } from 'react-native';
import Animated, {
    Easing,
    runOnJS,
    useAnimatedStyle,
    useSharedValue,
    withTiming,
} from 'react-native-reanimated';
import { SafeAreaView } from 'react-native-safe-area-context';

import { KeyboardAvoiding } from '@/components/ui/keyboard-avoiding';
import { cn } from '@/lib/utils';

type Props = {
    open: boolean;
    onDismiss: () => void;
    children: ReactNode;
    /** Read out when the sheet opens. */
    label?: string;
    className?: string;
};

/**
 * Taller than any sheet in the app, so the first open still starts off-screen
 * before onLayout has reported the real height.
 */
const FALLBACK_HEIGHT = 640;

/**
 * A panel that rises from the bottom edge.
 *
 * The dim and the panel are siblings, and only the panel moves. Modal's own
 * animationType="slide" translates everything inside it -- the dim with it --
 * so the dim arrives as a hard-edged block riding up the screen with a visible
 * top edge. Fading one while sliding the other is the whole reason this is
 * done by hand.
 *
 * A sheet is pinned to the bottom edge, which is exactly where the keyboard
 * opens, so anything typed into one is covered by default. The panel rides
 * above the keyboard and its body scrolls; the dim stays outside that, full
 * screen, so no undimmed strip appears while the keyboard animates.
 */
export function Sheet({ open, onDismiss, children, label, className }: Props) {
    const dim = useSharedValue(0);
    const slide = useSharedValue(1);
    const [height, setHeight] = useState(FALLBACK_HEIGHT);
    const [settled, setSettled] = useState(!open);

    const rest = useCallback(() => setSettled(true), []);

    // Adjusted during render rather than in an effect: the exit animation needs
    // the panel still mounted after `open` has gone false, so the flag can only
    // be cleared before the next paint.
    if (open && settled) {
        setSettled(false);
    }

    useEffect(() => {
        if (open) {
            dim.value = withTiming(1, { duration: 180 });
            slide.value = withTiming(0, { duration: 240, easing: Easing.out(Easing.cubic) });

            return;
        }

        dim.value = withTiming(0, { duration: 160 });
        slide.value = withTiming(
            1,
            { duration: 200, easing: Easing.in(Easing.cubic) },
            (finished) => {
                if (finished) {
                    runOnJS(rest)();
                }
            },
        );
    }, [open, dim, slide, rest]);

    const scrim = useAnimatedStyle(() => ({ opacity: dim.value }));
    const panel = useAnimatedStyle(() => ({
        transform: [{ translateY: slide.value * height }],
    }));

    if (!open && settled) {
        return null;
    }

    return (
        <Modal
            visible
            transparent
            animationType="none"
            statusBarTranslucent
            onRequestClose={onDismiss}
        >
            <View className="flex-1">
                <Animated.View style={scrim} className="absolute inset-0">
                    <Pressable
                        accessibilityRole="button"
                        accessibilityLabel="Dismiss"
                        onPress={onDismiss}
                        className="flex-1 bg-black/60"
                    />
                </Animated.View>

                <KeyboardAvoiding className="flex-1 justify-end">
                    <Animated.View
                        accessibilityLabel={label}
                        style={panel}
                        onLayout={(event) => setHeight(event.nativeEvent.layout.height)}
                        className={cn(
                            'bg-card border-border max-h-[80%] rounded-t-2xl border-t',
                            className,
                        )}
                    >
                        <SafeAreaView edges={['bottom']} className="px-5 pb-5 pt-3">
                            <View className="bg-input h-1 w-9 self-center rounded-full" />

                            <ScrollView
                                className="shrink"
                                bounces={false}
                                keyboardShouldPersistTaps="handled"
                                showsVerticalScrollIndicator={false}
                                contentContainerClassName="gap-3 pt-3"
                            >
                                {children}
                            </ScrollView>
                        </SafeAreaView>
                    </Animated.View>
                </KeyboardAvoiding>
            </View>
        </Modal>
    );
}
