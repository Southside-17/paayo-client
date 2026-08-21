import Svg, { Path } from 'react-native-svg';

import type { Brand } from '@/lib/brands';

type Props = { brand: Brand; color: string; size?: number };

/**
 * One brand mark, drawn at the size the button beside it wants.
 *
 * Simple Icons draw on a 24x24 grid and carry no colour of their own, so the
 * fill is passed in the way every other icon here takes one -- there is no
 * currentColor to inherit on this platform.
 */
export function BrandIcon({ brand, color, size = 18 }: Props) {
    return (
        <Svg width={size} height={size} viewBox="0 0 24 24" accessibilityLabel={brand.title}>
            <Path d={brand.path} fill={color} />
        </Svg>
    );
}
