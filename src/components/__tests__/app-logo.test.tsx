import { render, screen } from '@testing-library/react-native';
import { useColorScheme } from 'nativewind';
import { Path } from 'react-native-svg';

import { AppLogo } from '@/components/app-logo';
import { LOGO_ASPECT, LOGO_SHAPES } from '@/lib/logo';
import palette from '@/theme/palette';

jest.mock('nativewind', () => ({ useColorScheme: jest.fn() }));

beforeEach(() => {
    jest.mocked(useColorScheme).mockReturnValue({ colorScheme: 'light' } as never);
});

it('draws every shape of the mark', () => {
    render(<AppLogo />);

    expect(screen.getByLabelText('Paayo')).toBeOnTheScreen();
    expect(screen.UNSAFE_getAllByType(Path)).toHaveLength(LOGO_SHAPES.length);
});

// A pin held to a square comes out squashed, which is the one way a logo is
// worse than no logo at all.
it.each([24, 56, 128])('keeps its proportions at %ipt tall', (height) => {
    render(<AppLogo height={height} />);

    const mark = screen.getByLabelText('Paayo');

    expect(mark.props.height).toBe(height);
    expect(mark.props.width / height).toBeCloseTo(LOGO_ASPECT, 1);
});

// The artwork is green and the brand is amber; the brand wins. Nothing may
// reach back to the SVG's own fills.
it.each(['light', 'dark'] as const)('draws the mark in the %s brand colours', (scheme) => {
    jest.mocked(useColorScheme).mockReturnValue({ colorScheme: scheme } as never);

    render(<AppLogo />);

    expect(screen.UNSAFE_getAllByType(Path).map((path) => path.props.fill)).toEqual(
        LOGO_SHAPES.map((shape) => palette[scheme][shape.role]),
    );
    expect(screen.UNSAFE_getAllByType(Path)[0].props.fill).toBe(palette[scheme].brand);
});
