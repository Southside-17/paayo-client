import { ICONS } from '@/lib/icons';

type Props = { icon: string | null; color: string; size?: number };

/**
 * The glyph a category is drawn with, or a stand-in when it has none.
 */
export function CategoryIcon({ icon, color, size = 22 }: Props) {
    const Glyph = (icon === null ? undefined : ICONS[icon]) ?? ICONS.category;

    return <Glyph color={color} size={size} />;
}
