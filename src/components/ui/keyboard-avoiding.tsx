import { KeyboardAvoidingView, type ViewProps } from 'react-native';

type Props = ViewProps & { className?: string };

/**
 * A screen body that stays clear of the keyboard.
 *
 * `padding` on both platforms, which looks wrong for Android and is not: the app
 * is edge to edge, and an edge to edge window is never resized for the keyboard
 * however `adjustResize` is set in the manifest. Leaving the behaviour undefined
 * there -- the usual Android advice -- makes this component inert, and anything
 * low on the screen types underneath the keyboard.
 */
export function KeyboardAvoiding({ className, children, ...props }: Props) {
    return (
        <KeyboardAvoidingView className={className} behavior="padding" {...props}>
            {children}
        </KeyboardAvoidingView>
    );
}
