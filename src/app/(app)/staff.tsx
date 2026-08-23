import { useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { ScrollView, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { BackButton } from '@/components/back-button';
import { FormMessage } from '@/components/form-message';
import { StaffList } from '@/components/staff-list';
import { Avatar } from '@/components/avatar';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { ScreenHeader } from '@/components/ui/screen-header';
import { Sheet } from '@/components/ui/sheet';
import { SheetAction } from '@/components/ui/sheet-action';
import { Skeleton } from '@/components/ui/skeleton';
import { Text } from '@/components/ui/text';
import { on } from '@/lib/dates';
import { useSession } from '@/lib/session';
import type { RequestMethod } from '@/lib/api';
import type { Invitation, ProviderStaff, StaffRole } from '@/lib/types';
import { cn } from '@/lib/utils';
import { useSubmit } from '@/lib/use-submit';
import { useWorkspace } from '@/lib/workspace';

const ROLES: { value: StaffRole; label: string; note: string }[] = [
    { value: 'owner', label: 'Owner', note: 'Everything' },
    { value: 'manager', label: 'Manager', note: 'Staff and jobs' },
    { value: 'technician', label: 'Technician', note: 'Nothing yet' },
];

const RANK: Record<StaffRole, number> = { owner: 3, manager: 2, technician: 1 };

/**
 * Who works here, and the two things that change it: a role, and an invitation.
 */
export default function Staff() {
    const session = useSession();
    const { staff } = useWorkspace();
    const [people, setPeople] = useState<ProviderStaff[] | null>(null);
    const [invited, setInvited] = useState<Invitation[]>([]);
    const [picked, setPicked] = useState<ProviderStaff | null>(null);
    const [cancelling, setCancelling] = useState<Invitation | null>(null);
    const [inviting, setInviting] = useState(false);
    const [email, setEmail] = useState('');
    const [role, setRole] = useState<StaffRole>('technician');
    const { busy, message, errorFor, submit } = useSubmit();

    const authenticatedRequest =
        session.status === 'authenticated' ? session.authenticatedRequest : null;
    const provider = staff?.provider.id ?? null;

    const load = useCallback(() => {
        if (!authenticatedRequest || !provider) {
            return;
        }

        void authenticatedRequest<{ data: ProviderStaff[] }>(`/providers/${provider}/staffs`)
            .then(({ data }) => setPeople(data))
            .catch(() => setPeople([]));

        void authenticatedRequest<{ data: Invitation[] }>(`/providers/${provider}/invitations`)
            .then(({ data }) => setInvited(data))
            .catch(() => setInvited([]));
    }, [authenticatedRequest, provider]);

    useFocusEffect(load);

    if (!staff) {
        return null;
    }

    const mine = RANK[staff.role];
    const owners = (people ?? []).filter((one) => one.role === 'owner').length;
    const waiting = (people ?? []).filter((one) => one.resignation_requested_at !== null);

    const act = (run: () => Promise<unknown>) =>
        submit(async () => {
            await run();

            setPicked(null);
            setCancelling(null);
            setInviting(false);

            load();

            if (session.status === 'authenticated') {
                await session.reload();
            }
        });

    const call = (path: string, method: RequestMethod, body?: Record<string, unknown>) =>
        authenticatedRequest?.(`/providers/${provider}${path}`, { method, body }) ??
        Promise.resolve();

    return (
        <SafeAreaView className="bg-background flex-1" edges={['top']}>
            <ScrollView contentContainerClassName="gap-4 p-6" keyboardShouldPersistTaps="handled">
                <BackButton label="Business" />

                <ScreenHeader title="Staff">
                    <Button
                        variant="outline"
                        className="h-9 px-3"
                        onPress={() => {
                            setEmail('');
                            setRole('technician');
                            setInviting(true);
                        }}
                    >
                        Invite
                    </Button>
                </ScreenHeader>

                <FormMessage message={message} />

                {waiting.map((one) => (
                    <Card key={one.id} className="border-warning/40 bg-warning-subtle gap-1">
                        <Text className="font-semibold">{`${one.user.nickname} wants to leave`}</Text>
                        <Text className="text-muted-foreground text-sm">
                            {one.resignation_lapses_at
                                ? `Asked ${on(one.resignation_requested_at ?? '')}. They stay on the staff until you answer, or until ${on(one.resignation_lapses_at)}.`
                                : `Asked ${on(one.resignation_requested_at ?? '')}.`}
                        </Text>
                    </Card>
                ))}

                {people === null ? (
                    <Card className="gap-3">
                        {[0, 1, 2].map((at) => (
                            <View key={at} className="flex-row items-center gap-3">
                                <Skeleton className="size-8 rounded-full" />
                                <Skeleton className="h-4 flex-1" />
                                <Skeleton className="h-4 w-16 rounded-full" />
                            </View>
                        ))}
                    </Card>
                ) : (
                    <StaffList
                        people={people}
                        invitations={invited}
                        onPickPerson={setPicked}
                        onPickInvitation={setCancelling}
                    />
                )}
            </ScrollView>

            <Sheet open={picked !== null} onDismiss={() => setPicked(null)} label="This person">
                {picked ? (
                    <>
                        <View className="flex-row items-center gap-3">
                            <Avatar
                                nickname={picked.user.nickname}
                                url={picked.user.avatar_url}
                                size={34}
                            />
                            <View className="min-w-0 flex-1">
                                <Text className="font-bold" numberOfLines={1}>
                                    {picked.user.nickname}
                                </Text>
                                <Text className="text-muted-foreground text-xs" numberOfLines={1}>
                                    {picked.joined_at
                                        ? `${picked.role_label} since ${on(picked.joined_at)}`
                                        : picked.role_label}
                                </Text>
                            </View>
                        </View>

                        {picked.resignation_requested_at ? (
                            <>
                                <Card className="border-warning/40 bg-warning-subtle gap-1">
                                    <Text className="text-sm font-bold">
                                        {`Asked to leave on ${on(picked.resignation_requested_at)}`}
                                    </Text>
                                    <Text className="text-muted-foreground text-xs">
                                        Approving takes them off the staff now.
                                    </Text>
                                </Card>

                                <View className="gap-2">
                                    <SheetAction
                                        tone="destructive"
                                        onPress={() =>
                                            void act(() =>
                                                call(
                                                    `/staffs/${picked.id}/resignation/approval`,
                                                    'POST',
                                                ),
                                            )
                                        }
                                    >
                                        {`Let ${picked.user.nickname} leave`}
                                    </SheetAction>
                                    <SheetAction
                                        onPress={() =>
                                            void act(() =>
                                                call(
                                                    `/staffs/${picked.id}/resignation/refusal`,
                                                    'POST',
                                                ),
                                            )
                                        }
                                    >
                                        Turn the request down
                                    </SheetAction>
                                </View>
                            </>
                        ) : null}

                        <Text className="text-muted-foreground pt-1 text-xs font-bold uppercase">
                            Role
                        </Text>

                        <FormMessage message={errorFor('role') ?? errorFor('staff') ?? null} />

                        <View className="gap-2">
                            {ROLES.map((option) => {
                                const beyond =
                                    RANK[option.value] > mine || RANK[picked.role] > mine;
                                const soleOwner =
                                    picked.role === 'owner' &&
                                    option.value !== 'owner' &&
                                    owners <= 1;

                                return (
                                    <SheetAction
                                        key={option.value}
                                        selected={picked.role === option.value}
                                        disabled={busy || beyond || soleOwner}
                                        trailing={
                                            <Text className="text-muted-foreground text-xs">
                                                {option.note}
                                            </Text>
                                        }
                                        onPress={
                                            picked.role === option.value
                                                ? undefined
                                                : () =>
                                                      void act(() =>
                                                          call(`/staffs/${picked.id}`, 'PATCH', {
                                                              role: option.value,
                                                          }),
                                                      )
                                        }
                                    >
                                        {option.label}
                                    </SheetAction>
                                );
                            })}

                            <SheetAction
                                tone="destructive"
                                disabled={
                                    busy ||
                                    picked.is_you ||
                                    RANK[picked.role] > mine ||
                                    (picked.role === 'owner' && owners <= 1)
                                }
                                onPress={() =>
                                    void act(() => call(`/staffs/${picked.id}`, 'DELETE'))
                                }
                            >
                                Remove from staff
                            </SheetAction>
                        </View>

                        {picked.role === 'owner' && owners <= 1 ? (
                            <Card className="border-warning/40 bg-warning-subtle gap-1">
                                <Text className="text-sm font-bold">
                                    {picked.is_you
                                        ? 'You are the only owner'
                                        : 'They are the only owner'}
                                </Text>
                                <Text className="text-muted-foreground text-xs">
                                    A business must keep at least one. Make somebody else an owner
                                    first.
                                </Text>
                            </Card>
                        ) : null}

                        {RANK[picked.role] > mine ? (
                            <Text className="text-muted-foreground text-xs">
                                Only an owner can change what an owner does.
                            </Text>
                        ) : null}
                    </>
                ) : null}
            </Sheet>

            <Sheet
                open={cancelling !== null}
                onDismiss={() => setCancelling(null)}
                label="This invitation"
            >
                {cancelling ? (
                    <>
                        <Text className="font-bold" numberOfLines={1}>
                            {cancelling.email}
                        </Text>
                        <Text className="text-muted-foreground text-sm">
                            {cancelling.is_expired
                                ? 'This invitation has expired and no longer works.'
                                : `Invited as a ${cancelling.role_label.toLowerCase()}. They have not accepted yet.`}
                        </Text>

                        <View className="gap-2">
                            <SheetAction
                                tone="destructive"
                                disabled={busy}
                                onPress={() =>
                                    void act(() =>
                                        call(`/invitations/${cancelling.id}`, 'DELETE'),
                                    )
                                }
                            >
                                Take the invitation back
                            </SheetAction>
                            <SheetAction tone="quiet" onPress={() => setCancelling(null)}>
                                Cancel
                            </SheetAction>
                        </View>
                    </>
                ) : null}
            </Sheet>

            <Sheet open={inviting} onDismiss={() => setInviting(false)} label="Invite somebody">
                <Text className="text-base font-bold">Invite somebody</Text>
                <Text className="text-muted-foreground text-sm">
                    They get an email with a link. Nothing changes here until they accept it.
                </Text>

                <View className="gap-1.5">
                    <Text className="text-xs font-semibold">Email</Text>
                    <Input
                        value={email}
                        onChangeText={setEmail}
                        placeholder="name@example.com"
                        autoCapitalize="none"
                        autoCorrect={false}
                        keyboardType="email-address"
                        invalid={errorFor('email') !== null}
                    />
                    <FormMessage message={errorFor('email') ?? null} />
                </View>

                <Text className="text-muted-foreground text-xs font-bold uppercase">Role</Text>

                <View className="bg-muted flex-row gap-1 rounded-xl p-1">
                    {ROLES.filter((option) => RANK[option.value] <= mine).map((option) => (
                        <Text
                            key={option.value}
                            accessibilityRole="button"
                            accessibilityState={{ selected: role === option.value }}
                            onPress={() => setRole(option.value)}
                            className={cn(
                                'flex-1 rounded-lg py-2 text-center text-xs font-bold',
                                role === option.value
                                    ? 'bg-card text-foreground'
                                    : 'text-muted-foreground',
                            )}
                        >
                            {option.label}
                        </Text>
                    ))}
                </View>

                <Text className="text-muted-foreground text-xs">{consequence(role)}</Text>

                <FormMessage message={errorFor('role') ?? null} />

                <Button
                    busy={busy}
                    onPress={() =>
                        void act(() => call('/invitations', 'POST', { email: email.trim(), role }))
                    }
                >
                    Send invite
                </Button>
            </Sheet>
        </SafeAreaView>
    );
}

/**
 * Say what the role lets somebody do, under the picker that sets it.
 */
function consequence(role: StaffRole): string {
    return {
        owner: 'An owner can do everything, including making other owners.',
        manager: 'A manager runs the staff and answers jobs, but cannot make an owner.',
        technician: 'A technician sees the business name and nothing else, for now.',
    }[role];
}
