import { fireEvent, render, screen } from '@testing-library/react-native';
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

    // Anything a sheet clears on the way out -- a validation error, a typed
    // field -- is watched happening if it clears while the panel is still in
    // view. onDismiss is the request to go; onClosed is having gone.
    describe('on the way out', () => {
        it('does not call onClosed while the panel is still on screen', () => {
            const onClosed = jest.fn();

            render(
                <Sheet open onDismiss={jest.fn()} onClosed={onClosed} label="Invite">
                    <Text>Invite somebody</Text>
                </Sheet>,
            );

            fireEvent.press(screen.getByLabelText('Dismiss'));

            expect(onClosed).not.toHaveBeenCalled();
        });

        it('calls onClosed once the panel has left', () => {
            const onClosed = jest.fn();

            const { rerender } = render(
                <Sheet open onDismiss={jest.fn()} onClosed={onClosed} label="Invite">
                    <Text>Invite somebody</Text>
                </Sheet>,
            );

            rerender(
                <Sheet open={false} onDismiss={jest.fn()} onClosed={onClosed} label="Invite">
                    <Text>Invite somebody</Text>
                </Sheet>,
            );

            expect(onClosed).toHaveBeenCalledTimes(1);
        });

        // Otherwise every sheet on a screen clears its own form the moment the
        // screen mounts, before anybody has opened one.
        it('does not call onClosed for a sheet that never opened', () => {
            const onClosed = jest.fn();

            render(
                <Sheet open={false} onDismiss={jest.fn()} onClosed={onClosed} label="Invite">
                    <Text>Invite somebody</Text>
                </Sheet>,
            );

            expect(onClosed).not.toHaveBeenCalled();
        });
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
