import { render, screen } from '@testing-library/react-native';
import { Path } from 'react-native-svg';

import { AppLogo } from '@/components/app-logo';
import { LOGO_ASPECT, LOGO_SHAPES } from '@/lib/logo';

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

// The mark is one fixed thing in both themes; nothing may tint it.
it('draws the mark in the artwork colours', () => {
    render(<AppLogo />);

    expect(LOGO_SHAPES.map((shape) => shape.fill)).toEqual(['#00B14F', '#FEFEFE', '#F59E0C']);
});
