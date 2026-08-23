import { render, screen } from '@testing-library/react-native';

import { TradeIcon } from '@/components/trade-icon';
import { ICONS } from '@/lib/icons';

it('draws the glyph the server named', () => {
    render(<TradeIcon icon="air-conditioning" color="#d4a027" />);

    expect(screen.UNSAFE_getByType(ICONS['air-conditioning'])).toBeTruthy();
});

// A trade may be created before anyone picks a glyph, and the console can
// only offer names this map already holds -- but an old row could carry one
// that has since been dropped from the list.
it('stands in when a trade has no icon', () => {
    render(<TradeIcon icon={null} color="#d4a027" />);

    expect(screen.UNSAFE_getByType(ICONS.category)).toBeTruthy();
});

it('stands in for a name this build does not carry', () => {
    render(<TradeIcon icon="not-an-icon" color="#d4a027" />);

    expect(screen.UNSAFE_getByType(ICONS.category)).toBeTruthy();
});

it('carries every icon the console can offer', () => {
    expect(Object.keys(ICONS)).toHaveLength(120);
});
