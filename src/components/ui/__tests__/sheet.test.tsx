import { render, screen } from '@testing-library/react-native';
import { KeyboardAvoidingView, ScrollView, Text } from 'react-native';

import { Sheet } from '@/components/ui/sheet';

/**
 * A sheet opens against the bottom edge, which is where the keyboard opens too.
 * Anything typed into one is covered unless the panel lifts, so the lift lives
 * here rather than in each sheet that happens to hold a field.
 */
describe('a sheet', () => {
    const open = () =>
        render(
            <Sheet open onDismiss={jest.fn()} label="Invite">
                <Text>Invite somebody</Text>
            </Sheet>,
        );

    it('lifts its panel clear of the keyboard', () => {
        open();

        const lift = screen.UNSAFE_getByType(KeyboardAvoidingView);

        expect(lift.findAllByProps({ accessibilityLabel: 'Invite' }).length).toBeGreaterThan(0);
    });

    it('scrolls its body, so a field is still reachable once the panel is capped', () => {
        open();

        const scroll = screen.UNSAFE_getByType(ScrollView);

        expect(scroll.props.keyboardShouldPersistTaps).toBe('handled');
        expect(screen.getByText('Invite somebody')).toBeOnTheScreen();
    });

    // The dim covers the whole screen. Lifting it with the panel would open an
    // undimmed strip behind the keyboard while it animates in.
    it('keeps the dim outside the lift', () => {
        open();

        const lift = screen.UNSAFE_getByType(KeyboardAvoidingView);

        expect(screen.getByLabelText('Dismiss')).toBeOnTheScreen();
        expect(lift.findAllByProps({ accessibilityLabel: 'Dismiss' })).toHaveLength(0);
    });
});
