import { Text } from './text';

/** Render a validation message beneath the input that caused it. */
export function FieldError({ message }: { message?: string }) {
    if (!message) {
        return null;
    }

    return <Text className="text-destructive mt-1.5 text-sm">{message}</Text>;
}
