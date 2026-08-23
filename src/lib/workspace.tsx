import { router } from 'expo-router';
import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from 'react';

import { useSession } from './session';
import type { Staff } from './types';

type WorkspaceValue = {
    /** The business being acted as, or null on the personal side. */
    staff: Staff | null;
    /** Every business this account may act as, ordered by name. */
    businesses: Staff[];
    enter: (staff: Staff) => void;
    leave: () => void;
};

const WorkspaceContext = createContext<WorkspaceValue | null>(null);

/**
 * Which side of the app is being used: the person's own, or one of their
 * businesses.
 */
export function WorkspaceProvider({ children }: { children: ReactNode }) {
    const session = useSession();
    const [id, setId] = useState<string | null>(null);

    // Read defensively rather than as the strict shape: the app ships on its
    // own schedule, and an older server that omits the field must leave the
    // person on the personal side rather than crashing the account screen.
    // Memoised so the empty case is one array rather than a new one per render.
    const held = session.status === 'authenticated' ? session.user.staffs : undefined;
    const businesses = useMemo(() => held ?? [], [held]);

    // The id is held and the record is looked up, never the other way round.
    // That keeps a suspension lifted mid-session from being read off a stale
    // copy, and it empties itself when someone is taken off the staff.
    const staff = businesses.find((one) => one.id === id) ?? null;

    // A technician holds no permissions at all, so there is no queue and no
    // service list to land on -- only the one screen that names the business.
    const enter = useCallback((chosen: Staff) => {
        setId(chosen.id);
        router.dismissAll();
        router.replace(chosen.permissions.includes('booking:view') ? '/jobs' : '/standing');
    }, []);

    const leave = useCallback(() => {
        setId(null);
        router.dismissAll();
        router.replace('/');
    }, []);

    const value = useMemo<WorkspaceValue>(
        () => ({ staff, businesses, enter, leave }),
        [businesses, enter, leave, staff],
    );

    return <WorkspaceContext.Provider value={value}>{children}</WorkspaceContext.Provider>;
}

export function useWorkspace(): WorkspaceValue {
    const workspace = useContext(WorkspaceContext);

    if (!workspace) {
        throw new Error('useWorkspace must be used inside a WorkspaceProvider.');
    }

    return workspace;
}
