import { KeyboardAvoidingView, type ViewProps } from 'react-native';

type Props = ViewProps & { className?: string };

/**
 * A screen body that stays clear of the keyboard.
 */
export function KeyboardAvoiding({ className, children, ...props }: Props) {
    return (
        <KeyboardAvoidingView className={className} behavior="padding" {...props}>
            {children}
        </KeyboardAvoidingView>
    );
}
