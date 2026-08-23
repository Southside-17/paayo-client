import Mail from 'lucide-react-native/icons/mail';
import { useColorScheme } from 'nativewind';
import { Pressable, View } from 'react-native';

import { Avatar } from '@/components/avatar';
import { Card } from '@/components/ui/card';
import { Text } from '@/components/ui/text';
import type { Invitation, ProviderStaff } from '@/lib/types';
import { cn } from '@/lib/utils';
import palette from '@/theme/palette';

type Props = {
    people: ProviderStaff[];
    invitations?: Invitation[];
    /** Rows to draw before the rest become a single "and N more". */
    limit?: number;
    onPickPerson?: (staffMember: ProviderStaff) => void;
    onPickInvitation?: (invitation: Invitation) => void;
};

/**
 * Everyone on a staff, with the people invited but not joined among them.
 *
 * Twenty is what a roster looks like, so the whole list is drawn rather than
 * summarised behind a count. It is only probably bounded, though, so anything
 * past the limit collapses into one row instead of running off the screen.
 */
export function StaffList({
    people,
    invitations = [],
    limit,
    onPickPerson,
    onPickInvitation,
}: Props) {
    const { colorScheme } = useColorScheme();
    const colours = palette[colorScheme ?? 'light'];

    const rows = limit === undefined ? people : people.slice(0, limit);
    const hidden = people.length - rows.length;

    if (people.length === 0 && invitations.length === 0) {
        return (
            <Card>
                <Text className="text-muted-foreground text-sm">Nobody on the staff yet.</Text>
            </Card>
        );
    }

    return (
        <Card className="gap-0 py-1">
            {rows.map((staffMember, at) => (
                <Row key={staffMember.id} first={at === 0} onPress={onPickPerson && (() => onPickPerson(staffMember))}>
                    <Avatar
                        nickname={staffMember.user.nickname}
                        url={staffMember.user.avatar_url}
                        size={30}
                    />

                    <View className="min-w-0 flex-1">
                        <Text className="text-sm font-semibold" numberOfLines={1}>
                            {staffMember.user.nickname}
                            {staffMember.is_you ? (
                                <Text className="text-muted-foreground text-xs"> · you</Text>
                            ) : null}
                        </Text>
                        <Text
                            className={cn(
                                'text-xs',
                                staffMember.resignation_requested_at
                                    ? 'text-warning'
                                    : 'text-muted-foreground',
                            )}
                            numberOfLines={1}
                        >
                            {staffMember.resignation_requested_at
                                ? 'Wants to leave'
                                : staffMember.user.email}
                        </Text>
                    </View>

                    <RoleChip role={staffMember.role_label} owner={staffMember.role === 'owner'} />
                </Row>
            ))}

            {hidden > 0 ? (
                <Row first={rows.length === 0}>
                    <View className="flex-1">
                        <Text className="text-muted-foreground text-sm">{`and ${hidden} more`}</Text>
                    </View>
                </Row>
            ) : null}

            {invitations.map((invitation) => (
                <Row
                    key={invitation.id}
                    first={false}
                    onPress={onPickInvitation && (() => onPickInvitation(invitation))}
                >
                    <View className="bg-muted size-[30px] items-center justify-center rounded-full">
                        <Mail color={colours['muted-foreground']} size={14} />
                    </View>

                    <View className="min-w-0 flex-1">
                        <Text className="text-sm font-semibold" numberOfLines={1}>
                            {invitation.email}
                        </Text>
                        <Text className="text-muted-foreground text-xs" numberOfLines={1}>
                            {invitation.is_expired ? 'Invitation expired' : 'Invited, not joined'}
                        </Text>
                    </View>

                    <RoleChip role={invitation.role_label} owner={invitation.role === 'owner'} />
                </Row>
            ))}
        </Card>
    );
}

function Row({
    children,
    first,
    onPress,
}: {
    children: React.ReactNode;
    first: boolean;
    onPress?: () => void;
}) {
    return (
        <Pressable
            accessibilityRole={onPress ? 'button' : undefined}
            disabled={!onPress}
            onPress={onPress}
            className={cn(
                'flex-row items-center gap-3 py-2.5',
                first ? '' : 'border-border border-t',
            )}
        >
            {children}
        </Pressable>
    );
}

function RoleChip({ role, owner }: { role: string; owner: boolean }) {
    return (
        <View className={cn('rounded-full px-2 py-0.5', owner ? 'bg-brand-subtle' : 'bg-muted')}>
            <Text
                className={cn(
                    'text-[10px] font-bold uppercase',
                    owner ? 'text-brand' : 'text-muted-foreground',
                )}
            >
                {role}
            </Text>
        </View>
    );
}
