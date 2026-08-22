import { render, screen } from '@testing-library/react-native';

import { Badge } from '@/components/ui/badge';
import { StatusPill } from '@/components/ui/status-pill';

it('says where a thing stands', () => {
    render(<StatusPill tone="success">verified</StatusPill>);

    expect(screen.getByText('verified')).toBeOnTheScreen();
});

// The dot is the reason a pill passes WCAG-AA: someone who cannot separate the
// tones still has a shape to read. Losing it would look like a tidier pill.
it('carries the dot beside the label, in every tone', () => {
    const tones = ['brand', 'success', 'warning', 'info', 'neutral'] as const;

    for (const tone of tones) {
        const { unmount } = render(<StatusPill tone={tone}>on the way</StatusPill>);

        expect(screen.getByTestId('status-dot')).toBeOnTheScreen();

        unmount();
    }
});

it('states a fact on a row without a dot', () => {
    render(<Badge tone="brand">Default</Badge>);

    expect(screen.getByText('Default')).toBeOnTheScreen();
    expect(screen.queryByTestId('badge-dot')).toBeNull();
});

it('takes a dot when it is asked for one', () => {
    render(
        <Badge tone="brand" dot>
            Default
        </Badge>,
    );

    expect(screen.getByTestId('badge-dot')).toBeOnTheScreen();
});
