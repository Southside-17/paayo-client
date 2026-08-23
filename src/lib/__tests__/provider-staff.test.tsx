import { fireEvent, render, screen, waitFor, within } from '@testing-library/react-native';
import { useEffect, type ReactNode } from 'react';
import { View } from 'react-native';

import Staff from '@/app/(app)/staff';
import { ApiError } from '@/lib/api';
import Standing from '@/app/(app)/(provider)/standing';
import { useSession } from '@/lib/session';
import type { Invitation, ProviderStaff, Staff as StaffRecord, StaffRole } from '@/lib/types';
import { useWorkspace } from '@/lib/workspace';

jest.mock('@/lib/session', () => ({ useSession: jest.fn() }));
jest.mock('@/lib/workspace', () => ({ useWorkspace: jest.fn() }));
jest.mock('expo-router', () => ({
    Link: MockLink,
    useFocusEffect: MockUseFocusEffect,
    router: { back: jest.fn(), dismissAll: jest.fn(), replace: jest.fn() },
}));

function MockLink({ href, children }: { href: unknown; children: ReactNode }) {
    return <View accessibilityLabel={`to ${String(href)}`}>{children}</View>;
}

function MockUseFocusEffect(callback: () => void) {
    useEffect(callback, [callback]);
}

function person(over: Partial<ProviderStaff> = {}): ProviderStaff {
    return {
        id: 'st1',
        role: 'owner',
        role_label: 'Owner',
        joined_at: '2026-02-03T00:00:00.000000Z',
        resignation_requested_at: null,
        resignation_lapses_at: null,
        is_you: true,
        user: { id: 'u1', nickname: 'Mara', email: 'mara@example.com' },
        ...over,
    };
}

const ramon = person({
    id: 'st2',
    role: 'manager',
    role_label: 'Manager',
    is_you: false,
    user: { id: 'u2', nickname: 'Ramon', email: 'ramon@example.com' },
});

const invitation: Invitation = {
    id: 'inv1',
    email: 'bea@example.com',
    role: 'technician',
    role_label: 'Technician',
    is_expired: false,
    expires_at: '2026-09-10T00:00:00.000000Z',
    created_at: '2026-09-03T00:00:00.000000Z',
};

function acting(role: StaffRole = 'owner', over: Partial<StaffRecord> = {}) {
    (useWorkspace as jest.Mock).mockReturnValue({
        staff: {
            id: 's1',
            role,
            role_label: role === 'owner' ? 'Owner' : role === 'manager' ? 'Manager' : 'Technician',
            permissions: role === 'technician' ? [] : ['staff:view', 'staff:update', 'staff:remove'],
            resignation_requested_at: null,
            resignation_lapses_at: null,
            provider: {
                id: 'p1',
                name: 'Matina Cooling Works',
                slug: 'matina',
                market: { id: 'm1', name: 'Davao City' },
                registration_verified: true,
                suspension: null,
            },
            ...over,
        } as StaffRecord,
        businesses: [],
        enter: jest.fn(),
        leave: jest.fn(),
    });
}

function answering(people: ProviderStaff[], invitations: Invitation[] = []) {
    return jest.fn(async (path: string) =>
        path.includes('/invitations') ? { data: invitations } : { data: people },
    );
}

function signedIn(authenticatedRequest: jest.Mock) {
    (useSession as jest.Mock).mockReturnValue({
        status: 'authenticated',
        user: { id: 'u1', nickname: 'Mara', staffs: [] },
        token: 'a-token',
        authenticatedRequest,
        reload: jest.fn(),
        logout: jest.fn(),
    });
}

beforeEach(() => jest.clearAllMocks());

describe('the roster', () => {
    // Joined and invited are one list because they are one question -- who is
    // coming to work here -- but they never look the same.
    it('shows the people and the ones invited but not joined', async () => {
        acting();
        signedIn(answering([person(), ramon], [invitation]));

        render(<Staff />);

        expect(await screen.findByText('Ramon')).toBeOnTheScreen();
        expect(screen.getByText('bea@example.com')).toBeOnTheScreen();
        expect(screen.getByText('Invited, not joined')).toBeOnTheScreen();
    });

    it('names anybody waiting on an answer, and when it goes through on its own', async () => {
        acting();
        signedIn(
            answering([
                person(),
                person({
                    id: 'st3',
                    is_you: false,
                    role: 'technician',
                    role_label: 'Technician',
                    resignation_requested_at: '2026-09-03T00:00:00.000000Z',
                    resignation_lapses_at: '2026-09-10T00:00:00.000000Z',
                    user: { id: 'u3', nickname: 'Jun', email: 'jun@example.com' },
                }),
            ]),
        );

        render(<Staff />);

        expect(await screen.findByText('Jun wants to leave')).toBeOnTheScreen();
        expect(screen.getByText(/They stay on the staff until you answer, or until/)).toBeOnTheScreen();
    });
});

describe('changing somebody', () => {
    it('sends the new role to the business being acted as', async () => {
        acting();
        const request = answering([person(), ramon]);
        signedIn(request);

        render(<Staff />);

        fireEvent.press(await screen.findByText('Ramon'));
        fireEvent.press(screen.getByText('Technician'));

        await waitFor(() =>
            expect(request).toHaveBeenCalledWith('/providers/p1/staffs/st2', {
                method: 'PATCH',
                body: { role: 'technician' },
            }),
        );
    });

    // The rule is visible before the tap, not a 422 after it.
    it('will not let a manager reach the owner role', async () => {
        acting('manager');
        const request = answering([person(), ramon]);
        signedIn(request);

        render(<Staff />);

        fireEvent.press(await screen.findByText('Ramon'));

        // Disabled before the tap: a manager may hand out its own role and
        // below, never above.
        fireEvent.press(screen.getByText('Everything'));

        await waitFor(() => expect(screen.getByText('Technician')).toBeOnTheScreen());
        expect(request).not.toHaveBeenCalledWith(
            '/providers/p1/staffs/st2',
            expect.objectContaining({ body: { role: 'owner' } }),
        );
    });

    it('refuses to move the only owner, and says what to do first', async () => {
        acting();
        signedIn(answering([person()]));

        render(<Staff />);

        fireEvent.press(await screen.findByText(/Mara/));

        expect(screen.getByText('You are the only owner')).toBeOnTheScreen();
        expect(screen.getByText(/Make somebody else an owner first/)).toBeOnTheScreen();
    });

    it('answers a request to leave from the same sheet the role lives in', async () => {
        acting();
        const leaving = person({
            id: 'st4',
            is_you: false,
            role: 'technician',
            role_label: 'Technician',
            resignation_requested_at: '2026-09-03T00:00:00.000000Z',
            resignation_lapses_at: '2026-09-10T00:00:00.000000Z',
            user: { id: 'u4', nickname: 'Jun', email: 'jun@example.com' },
        });
        const request = answering([person(), leaving]);
        signedIn(request);

        render(<Staff />);

        fireEvent.press(await screen.findByText('Jun'));
        fireEvent.press(screen.getByText('Let Jun leave'));

        await waitFor(() =>
            expect(request).toHaveBeenCalledWith(
                '/providers/p1/staffs/st4/resignation/approval',
                { method: 'POST', body: undefined },
            ),
        );
    });
});

describe('inviting somebody', () => {
    it('sends the address and the role, and says what the role can do', async () => {
        acting();
        const request = answering([person()]);
        signedIn(request);

        render(<Staff />);

        fireEvent.press(await screen.findByText('Invite'));

        expect(screen.getByText(/A technician sees the business name/)).toBeOnTheScreen();

        fireEvent.changeText(screen.getByPlaceholderText('name@example.com'), 'bea@example.com');
        fireEvent.press(screen.getByText('Send invite'));

        await waitFor(() =>
            expect(request).toHaveBeenCalledWith('/providers/p1/invitations', {
                method: 'POST',
                body: { email: 'bea@example.com', role: 'technician' },
            }),
        );
    });

    // Clearing on dismiss is watched happening: the error blinks out under the
    // field while the panel is still sliding down.
    it('holds the refusal on screen until the sheet has gone, then drops it', async () => {
        acting();
        const request = jest.fn(async (path: string) => {
            if (path.endsWith('/invitations') === false) {
                return { data: [person()] };
            }

            throw new ApiError(422, 'Unprocessable', {
                email: ['Somebody with that address is already on the staff.'],
            });
        });
        signedIn(request as unknown as jest.Mock);

        render(<Staff />);

        fireEvent.press(await screen.findByText('Invite'));
        fireEvent.changeText(screen.getByPlaceholderText('name@example.com'), 'mara@example.com');
        fireEvent.press(screen.getByText('Send invite'));

        expect(await screen.findByText(/already on the staff/)).toBeOnTheScreen();

        fireEvent.press(screen.getByLabelText('Dismiss'));

        await waitFor(() => expect(screen.queryByLabelText('Invite somebody')).toBeNull());

        fireEvent.press(screen.getByText('Invite'));

        expect(screen.queryByText(/already on the staff/)).not.toBeOnTheScreen();
        expect(screen.getByPlaceholderText('name@example.com').props.value).toBe('');
    });

    it('does not offer a manager the owner role', async () => {
        acting('manager');
        signedIn(answering([person()]));

        render(<Staff />);

        fireEvent.press(await screen.findByText('Invite'));

        const sheet = screen.getByLabelText('Invite somebody');

        expect(within(sheet).getByText('Manager')).toBeOnTheScreen();
        expect(within(sheet).queryByText('Owner')).not.toBeOnTheScreen();
    });
});

describe('the technician', () => {
    it('is told there is nothing here yet rather than shown an empty screen', () => {
        acting('technician');
        signedIn(jest.fn());

        render(<Standing />);

        expect(screen.getByText('Matina Cooling Works')).toBeOnTheScreen();
        expect(screen.getByText('Technician')).toBeOnTheScreen();
        expect(screen.getByText(/There is nothing here for a technician yet/)).toBeOnTheScreen();
    });

    it('asks to leave rather than leaving, and says who answers', async () => {
        acting('technician');
        const request = jest.fn().mockResolvedValue({ data: {} });
        signedIn(request);

        render(<Standing />);

        fireEvent.press(screen.getByText('Ask to leave this business'));

        expect(screen.getByText(/An owner or manager has to approve it/)).toBeOnTheScreen();

        fireEvent.press(screen.getByText('Ask to leave'));

        await waitFor(() =>
            expect(request).toHaveBeenCalledWith('/providers/p1/resignation', { method: 'POST' }),
        );
    });

    it('can take the request back, and is told when it goes through on its own', () => {
        acting('technician', {
            resignation_requested_at: '2026-09-03T00:00:00.000000Z',
            resignation_lapses_at: '2026-09-10T00:00:00.000000Z',
        });
        signedIn(jest.fn());

        render(<Standing />);

        expect(screen.getByText(/If nobody does, you leave on/)).toBeOnTheScreen();
        expect(screen.getByText('Withdraw the request')).toBeOnTheScreen();
    });
});
