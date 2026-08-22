import { render, screen } from '@testing-library/react-native';

import { ScreenHeader } from '@/components/ui/screen-header';
import { Text } from '@/components/ui/text';

it('opens a screen with its title', () => {
    render(<ScreenHeader title="Account" />);

    expect(screen.getByText('Account')).toBeOnTheScreen();
});

it('sets the eyebrow above the title', () => {
    render(<ScreenHeader eyebrow="Good morning" title="Mara" />);

    expect(screen.getByText('Good morning')).toBeOnTheScreen();
    expect(screen.getByText('Mara')).toBeOnTheScreen();
});

it('holds the one control that belongs beside the title', () => {
    render(
        <ScreenHeader title="Home">
            <Text>JM</Text>
        </ScreenHeader>,
    );

    expect(screen.getByText('JM')).toBeOnTheScreen();
});
