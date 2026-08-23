import { fireEvent, render, screen } from '@testing-library/react-native';
import { router } from 'expo-router';
import { Pressable, Text, View } from 'react-native';

import { useSession } from '@/lib/session';
import type { Staff } from '@/lib/types';
import { useWorkspace, WorkspaceProvider } from '@/lib/workspace';

jest.mock('@/lib/session', () => ({ useSession: jest.fn() }));
jest.mock('expo-router', () => ({
    router: { dismissAll: jest.fn(), replace: jest.fn() },
}));

function staffAt(id: string, name: string): Staff {
    return {
        id,
        role: 'owner',
        role_label: 'Owner',
        permissions: ['booking:view'],
        resignation_requested_at: null,
        resignation_lapses_at: null,
        provider: {
            id: `p-${id}`,
            name,
            slug: name.toLowerCase().replace(' ', '-'),
            market: null,
            registration_verified: true,
            suspension: null,
        },
    };
}

/** Reads the workspace out and offers the two ways to change it. */
function Probe() {
    const { staff, businesses, enter, leave } = useWorkspace();

    return (
        <View>
            <Text>{staff ? staff.provider.name : 'personal'}</Text>
            <Text>{`count:${businesses.length}`}</Text>
            {businesses.map((one) => (
                <Pressable key={one.id} accessibilityLabel={`enter ${one.id}`} onPress={() => enter(one)}>
                    <Text>{one.provider.name}</Text>
                </Pressable>
            ))}
            <Pressable accessibilityLabel="leave" onPress={leave}>
                <Text>leave</Text>
            </Pressable>
        </View>
    );
}

function signedInWith(staffs: Staff[] | undefined) {
    (useSession as jest.Mock).mockReturnValue({
        status: 'authenticated',
        user: { nickname: 'Mara', staffs },
    });
}

function mount() {
    return render(
        <WorkspaceProvider>
            <Probe />
        </WorkspaceProvider>,
    );
}

beforeEach(() => jest.clearAllMocks());

it('opens on the personal side', () => {
    signedInWith([staffAt('s1', 'Bright Electric')]);

    mount();

    expect(screen.getByText('personal')).toBeOnTheScreen();
});

it('carries every business the account is staff at', () => {
    signedInWith([staffAt('s1', 'Bright Electric'), staffAt('s2', 'Zamora Aircon')]);

    mount();

    expect(screen.getByText('count:2')).toBeOnTheScreen();
});

it('enters a business and lands on its jobs, with nothing left underneath', () => {
    signedInWith([staffAt('s1', 'Bright Electric')]);

    mount();

    fireEvent.press(screen.getByLabelText('enter s1'));

    expect(screen.queryByText('personal')).not.toBeOnTheScreen();
    expect(router.dismissAll).toHaveBeenCalled();
    expect(router.replace).toHaveBeenCalledWith('/jobs');
});

// The id is held and the record looked up, so a staff record that stops
// arriving in the account empties the workspace without anything noticing.
it('lets go of a business the account is no longer staff at', () => {
    signedInWith([staffAt('s1', 'Bright Electric')]);

    const view = mount();

    fireEvent.press(screen.getByLabelText('enter s1'));

    expect(screen.queryByText('personal')).not.toBeOnTheScreen();

    signedInWith([]);
    view.rerender(
        <WorkspaceProvider>
            <Probe />
        </WorkspaceProvider>,
    );

    expect(screen.getByText('personal')).toBeOnTheScreen();
});

// The app ships on its own schedule. An older server sends no staffs at all,
// and that must read as "no businesses" rather than take the screen down.
it('treats a server that sends no businesses as an account with none', () => {
    signedInWith(undefined);

    mount();

    expect(screen.getByText('count:0')).toBeOnTheScreen();
    expect(screen.getByText('personal')).toBeOnTheScreen();
});
