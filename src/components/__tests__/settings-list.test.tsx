import { render, screen } from '@testing-library/react-native';
import MapPin from 'lucide-react-native/icons/map-pin';
import Pencil from 'lucide-react-native/icons/pencil';
import type { ReactNode } from 'react';
import { View } from 'react-native';

import { SettingsList, type SettingsRow } from '@/components/settings-list';

// A jest.mock factory cannot build JSX in this repo, so the stand-in is a
// hoisted function declaration the factory hands back. See .ai/rules/general.md.
jest.mock('expo-router', () => ({ Link: MockLink }));

function MockLink({ href, children }: { href: string; children: ReactNode }) {
    return <View accessibilityLabel={`to ${href}`}>{children}</View>;
}

const rows: SettingsRow[] = [
    { icon: Pencil, label: 'Profile details', note: 'Nickname, email, phone', href: '/profile/edit' },
    { icon: MapPin, label: 'Saved addresses', href: '/profile/addresses' },
];

it('lists every section it is given', () => {
    render(<SettingsList rows={rows} />);

    expect(screen.getByText('Profile details')).toBeOnTheScreen();
    expect(screen.getByText('Saved addresses')).toBeOnTheScreen();
});

it('carries the note under the label where a row has one', () => {
    render(<SettingsList rows={rows} />);

    expect(screen.getByText('Nickname, email, phone')).toBeOnTheScreen();
});

it('points each row at its own screen', () => {
    render(<SettingsList rows={rows} />);

    expect(screen.getByLabelText('to /profile/edit')).toBeOnTheScreen();
    expect(screen.getByLabelText('to /profile/addresses')).toBeOnTheScreen();
});
