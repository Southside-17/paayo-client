import { useColorScheme } from 'nativewind';
import Svg, { Path } from 'react-native-svg';

import { LOGO_ASPECT, LOGO_SHAPES, LOGO_VIEW_BOX } from '@/lib/logo';
import palette from '@/theme/palette';

type Props = { height?: number };

/**
 * The Paayo mark, sized by height because the pin is taller than it is wide.
 */
export function AppLogo({ height = 40 }: Props) {
    const { colorScheme } = useColorScheme();
    const colours = palette[colorScheme ?? 'light'];

    return (
        <Svg
            width={Math.round(height * LOGO_ASPECT)}
            height={height}
            viewBox={LOGO_VIEW_BOX}
            accessibilityLabel="Paayo"
        >
            {LOGO_SHAPES.map((shape, at) => (
                <Path
                    key={at}
                    d={shape.d}
                    fill={colours[shape.role]}
                    transform={shape.transform}
                />
            ))}
        </Svg>
    );
}
