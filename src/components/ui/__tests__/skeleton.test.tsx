import { render, screen } from '@testing-library/react-native';
import { AccessibilityInfo } from 'react-native';

import { Skeleton } from '@/components/ui/skeleton';

it('stands where its content will stand', () => {
    render(<Skeleton className="h-4 w-32" />);

    expect(screen.UNSAFE_getByType(Skeleton)).toBeTruthy();
});

// A placeholder that throbs is worse than no placeholder for anyone who asked
// the system to stop moving things.
it('asks whether motion should be reduced before it pulses', () => {
    const asked = jest.spyOn(AccessibilityInfo, 'isReduceMotionEnabled');

    render(<Skeleton className="h-4" />);

    expect(asked).toHaveBeenCalled();
});
