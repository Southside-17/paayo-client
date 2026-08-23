const React = require('react');
const { View } = require('react-native');

/**
 * Renders as a plain View, so whatever a sheet holds is still on the screen.
 */
const Passthrough = React.forwardRef((props, ref) => React.createElement(View, { ...props, ref }));

Passthrough.displayName = 'MockAnimated';

const straight = (value) => value;

module.exports = {
    __esModule: true,
    default: { View: Passthrough, Text: Passthrough, ScrollView: Passthrough },
    Easing: { in: straight, out: straight, inOut: straight, cubic: straight },
    runOnJS: (callback) => callback,
    // Deliberately empty rather than the real style: a shared value never
    // re-renders, so the opening frame would keep opacity 0 and a transform
    // pushing the panel off-screen -- and Testing Library treats an element at
    // opacity 0 as hidden, so nothing inside a sheet could be found.
    useAnimatedStyle: () => ({}),
    useSharedValue: (value) => ({ value }),
    // Lands on the target and calls back at once, so a closing sheet is already
    // gone by the time a test looks for it.
    withTiming: (toValue, _config, callback) => {
        callback?.(true);

        return toValue;
    },
};
