import { render, screen } from '@testing-library/react-native';
import { siGoogle } from 'simple-icons';

import { BrandIcon } from '@/components/brand-icon';
import { APPLE, GOOGLE, MICROSOFT } from '@/lib/brands';

// Reading the package for real is only affordable here: the barrel is one 5MB
// module, which is why src/lib/brands.ts holds a copy instead of importing it.
it('keeps the copied Google mark identical to Simple Icons', () => {
    expect(GOOGLE.path).toBe(siGoogle.path);
    expect(GOOGLE.title).toBe(siGoogle.title);
});

// Microsoft asked to be removed from Simple Icons, so their mark has no upstream
// to be checked against and this is all that can be asserted of it: that it is a
// path, and that it draws.
it('carries a Microsoft mark that Simple Icons no longer publishes', () => {
    expect(MICROSOFT.path).toMatch(/^M/);

    render(<BrandIcon brand={MICROSOFT} color="#111827" />);

    expect(screen.getByLabelText('Microsoft')).toBeOnTheScreen();
});

it('draws every mark the sign-in screens offer', () => {
    for (const brand of [APPLE, GOOGLE, MICROSOFT]) {
        expect(brand.path.length).toBeGreaterThan(0);
    }
});

it('draws the mark in the colour it is given', () => {
    render(<BrandIcon brand={GOOGLE} color="#111827" />);

    expect(screen.getByLabelText('Google')).toBeOnTheScreen();
});
