import { render, screen } from '@testing-library/react-native';

import { WhenCard } from '@/components/booking-facts';

/** Tuesday, 1 September 2026 at half past two, built locally so no zone shifts it. */
const visit = new Date(2026, 8, 1, 14, 30);

it('draws the week the visit falls in, Monday first', () => {
    render(<WhenCard scheduled={visit.toISOString()} />);

    // Monday is 31 August and Sunday is 6 September, so the strip spans months
    // rather than resetting at the first.
    expect(screen.getByText('31')).toBeOnTheScreen();
    expect(screen.getByText('6')).toBeOnTheScreen();
});

// The hour is the part a calendar strip usually loses, and it is the half of
// the answer that decides whether someone is home.
it('puts the time inside the square of the day itself', () => {
    render(<WhenCard scheduled={visit.toISOString()} />);

    expect(screen.getByText('2:30PM')).toBeOnTheScreen();
});

it('drops the minutes from an hour that has none', () => {
    render(<WhenCard scheduled={new Date(2026, 8, 1, 8, 0).toISOString()} />);

    expect(screen.getByText('8AM')).toBeOnTheScreen();
});
