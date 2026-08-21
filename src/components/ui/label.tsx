import { Text } from './text';

export function Label({ children }: { children: string }) {
    return <Text className="text-foreground mb-1.5 text-sm font-medium">{children}</Text>;
}
