import Svg, { Path } from 'react-native-svg';

import type { Brand } from '@/lib/brands';

type Props = { brand: Brand; color: string; size?: number };

/**
 * One brand mark, drawn at the size the button beside it wants.
 */
export function BrandIcon({ brand, color, size = 18 }: Props) {
    return (
        <Svg width={size} height={size} viewBox="0 0 24 24" accessibilityLabel={brand.title}>
            <Path d={brand.path} fill={color} />
        </Svg>
    );
}
