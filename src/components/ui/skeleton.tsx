import { useEffect, useState } from 'react';
import { AccessibilityInfo, Animated, View } from 'react-native';

import { cn } from '@/lib/utils';

type Props = { className?: string };

/**
 * A placeholder shaped like the thing that has not arrived yet.
 *
 * Sized at the call site, so a skeleton stands where its content will stand
 * and nothing moves when the content lands. The pulse stops for anyone who has
 * asked the system to reduce motion.
 */
export function Skeleton({ className }: Props) {
    // Lazy state rather than a ref: reading ref.current during render is
    // exactly what the React Compiler refuses, and this value is created once
    // either way.
    const [opacity] = useState(() => new Animated.Value(0.5));
    const [still, setStill] = useState(false);

    useEffect(() => {
        let mounted = true;

        void AccessibilityInfo.isReduceMotionEnabled().then((reduced) => {
            if (mounted) {
                setStill(reduced);
            }
        });

        return () => {
            mounted = false;
        };
    }, []);

    useEffect(() => {
        if (still) {
            opacity.setValue(0.5);

            return;
        }

        const pulse = Animated.loop(
            Animated.sequence([
                Animated.timing(opacity, { toValue: 1, duration: 700, useNativeDriver: true }),
                Animated.timing(opacity, { toValue: 0.4, duration: 700, useNativeDriver: true }),
            ]),
        );

        pulse.start();

        return () => pulse.stop();
    }, [opacity, still]);

    return (
        <Animated.View style={{ opacity }}>
            <View className={cn('bg-muted rounded-md', className)} />
        </Animated.View>
    );
}
