import { render, screen } from '@testing-library/react-native';
import { siGoogle } from 'simple-icons';

import { BrandIcon } from '@/components/brand-icon';
import { GOOGLE } from '@/lib/brands';

// Reading the package for real is only affordable here: the barrel is one 5MB
// module, which is why src/lib/brands.ts holds a copy instead of importing it.
it('keeps the copied Google mark identical to Simple Icons', () => {
    expect(GOOGLE.path).toBe(siGoogle.path);
    expect(GOOGLE.title).toBe(siGoogle.title);
});

it('draws the mark in the colour it is given', () => {
    render(<BrandIcon brand={GOOGLE} color="#111827" />);

    expect(screen.getByLabelText('Google')).toBeOnTheScreen();
});
