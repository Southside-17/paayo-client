import Svg, { Path } from 'react-native-svg';

import { LOGO_ASPECT, LOGO_SHAPES, LOGO_VIEW_BOX } from '@/lib/logo';

type Props = { height?: number };

/**
 * The Paayo mark, sized by height because the pin is taller than it is wide.
 *
 * Every other icon here takes a square `size`; this one cannot, since holding
 * one side to it would squash the pin. The width follows from the artwork.
 */
export function AppLogo({ height = 40 }: Props) {
    return (
        <Svg
            width={Math.round(height * LOGO_ASPECT)}
            height={height}
            viewBox={LOGO_VIEW_BOX}
            accessibilityLabel="Paayo"
        >
            {LOGO_SHAPES.map((shape) => (
                <Path
                    key={shape.fill}
                    d={shape.d}
                    fill={shape.fill}
                    transform={shape.transform}
                />
            ))}
        </Svg>
    );
}
