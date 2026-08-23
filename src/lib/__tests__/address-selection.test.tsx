import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import { useEffect } from 'react';
import type { ReactNode } from 'react';
import { Pressable, Text, View } from 'react-native';

import Home from '@/app/(app)/(tabs)/index';
import { AddressesProvider, useAddresses } from '@/lib/addresses';
import { useSession } from '@/lib/session';

jest.mock('@/lib/session', () => ({ useSession: jest.fn() }));
jest.mock('expo-router', () => ({
    Link: MockLink,
    useFocusEffect: MockUseFocusEffect,
    router: { push: jest.fn() },
}));

function MockLink({ children }: { href: unknown; children: ReactNode }) {
    return <View>{children}</View>;
}

function MockUseFocusEffect(callback: () => void) {
    useEffect(callback, [callback]);
}

const user = {
    id: 'u1',
    nickname: 'Mara',
    fullname: null,
    phone: null,
    avatar: false,
    email: 'mara@example.com',
    email_verified: true,
    identification_verified: false,
    two_factor_enabled: false,
    has_password: true,
    administrator: false,
    created_at: '2026-01-01T00:00:00.000000Z',
};

const place = (id: string, label: string, is_default: boolean, pinned: boolean) => ({
    id,
    label,
    unit: null,
    street: 'Quimpo Boulevard',
    subdivision: null,
    barangay: 'Poblacion',
    town: 'Davao City',
    province: 'Davao del Sur',
    postal_code: null,
    landmark: null,
    latitude: pinned ? 7.07 : null,
    longitude: pinned ? 125.61 : null,
    is_default,
    line: `${label} line`,
});

function signedIn(addresses: unknown[]) {
    const request = jest.fn(async (path: string) => {
        if (path === '/addresses') {
            return { data: addresses };
        }

        return { data: [] };
    });

    (useSession as jest.Mock).mockReturnValue({
        status: 'authenticated',
        user,
        token: 'a-token',
        authenticatedRequest: request,
        reload: jest.fn(),
    });

    return request;
}

function open() {
    return render(
        <AddressesProvider>
            <Home />
        </AddressesProvider>,
    );
}

beforeEach(() => jest.clearAllMocks());

it('sends work to the default address until another one is chosen', async () => {
    signedIn([place('a1', 'Home', true, true), place('a2', 'Office', false, true)]);

    open();

    await waitFor(() => expect(screen.getByText('Home')).toBeOnTheScreen());

    fireEvent.press(screen.getByText('Change'));
    fireEvent.press(screen.getByText('Office'));

    await waitFor(() => expect(screen.getByText('Office')).toBeOnTheScreen());
    expect(screen.queryByText('Home')).not.toBeOnTheScreen();
});

// Selection is a device concern, not a form: the sheet answers one question and
// the addresses screen keeps the rest.
it('offers nothing but the choice and the way to manage them', async () => {
    signedIn([place('a1', 'Home', true, true)]);

    open();

    await waitFor(() => expect(screen.getByText('Change')).toBeOnTheScreen());

    fireEvent.press(screen.getByText('Change'));

    expect(screen.getByText('Manage addresses')).toBeOnTheScreen();
    expect(screen.queryByText('Edit')).not.toBeOnTheScreen();
    expect(screen.queryByText('Remove')).not.toBeOnTheScreen();
    expect(screen.queryByText('Add an address')).not.toBeOnTheScreen();
});

// An unpinned address cannot be dispatched to, and choosing it would answer the
// catalog unfiltered -- every tap would then land on the picker reporting that
// nobody serves the area.
it('will not send work to an address with no pin, default or not', async () => {
    signedIn([place('a1', 'Lola', true, false), place('a2', 'Office', false, true)]);

    open();

    // Seeded past the default, because the default cannot be dispatched to.
    await waitFor(() => expect(screen.getByText('Office')).toBeOnTheScreen());

    fireEvent.press(screen.getByText('Change'));

    expect(screen.getByText('Needs a pin before anyone can be sent to it.')).toBeOnTheScreen();

    fireEvent.press(screen.getByText('Lola'));
    fireEvent.press(screen.getByLabelText('Dismiss'));

    expect(screen.getByText('Office')).toBeOnTheScreen();
});

it('says there is nowhere to send anyone when nothing is pinned', async () => {
    signedIn([place('a1', 'Lola', true, false)]);

    open();

    await waitFor(() => expect(screen.getByText('Drop a pin')).toBeOnTheScreen());
    expect(screen.getByText('No pin')).toBeOnTheScreen();
});

it('asks for an address when the account has none', async () => {
    signedIn([]);

    open();

    await waitFor(() => expect(screen.getByText('Add an address')).toBeOnTheScreen());
});

// The id is held and the record looked up, never the other way round, so an
// address that goes away takes the choice with it rather than leaving a stale
// copy of itself behind.
it('falls back to the default when the chosen address is removed', async () => {
    const held = [place('a1', 'Home', true, true), place('a2', 'Office', false, true)];

    (useSession as jest.Mock).mockReturnValue({
        status: 'authenticated',
        user,
        token: 'a-token',
        authenticatedRequest: jest.fn(async () => ({ data: held.slice() })),
        reload: jest.fn(),
    });

    render(
        <AddressesProvider>
            <Probe />
        </AddressesProvider>,
    );

    await waitFor(() => expect(screen.getByText('at Home')).toBeOnTheScreen());

    fireEvent.press(screen.getByText('choose Office'));

    expect(screen.getByText('at Office')).toBeOnTheScreen();

    held.pop();

    fireEvent.press(screen.getByText('reload'));

    await waitFor(() => expect(screen.getByText('at Home')).toBeOnTheScreen());
});

it('asks for the addresses once for the whole visit, not once per screen', async () => {
    const request = signedIn([place('a1', 'Home', true, true)]);

    open();

    await waitFor(() => expect(screen.getByText('Home')).toBeOnTheScreen());

    expect(request.mock.calls.filter(([path]) => path === '/addresses')).toHaveLength(1);
});

/** Reads and drives the provider directly, for what no screen can reach. */
function Probe() {
    const { addresses, address, reload, select } = useAddresses();
    const office = addresses.find((entry) => entry.label === 'Office');

    return (
        <View>
            <Text>{address ? `at ${address.label}` : 'nowhere'}</Text>
            <Pressable accessibilityRole="button" onPress={() => void reload()}>
                <Text>reload</Text>
            </Pressable>
            {office ? (
                <Pressable accessibilityRole="button" onPress={() => select(office)}>
                    <Text>choose Office</Text>
                </Pressable>
            ) : null}
        </View>
    );
}
