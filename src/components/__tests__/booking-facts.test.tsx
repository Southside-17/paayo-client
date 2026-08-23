import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import { Linking } from 'react-native';

import { WhenCard, WhereCard } from '@/components/booking-facts';

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

// The same booking is read from both ends. A business reading "when are they
// arriving?" about its own visit is being addressed as somebody else.
it('asks the client when someone is coming to them', () => {
    render(<WhenCard scheduled={visit.toISOString()} />);

    expect(screen.getByText('When are they arriving?')).toBeOnTheScreen();
});

it('asks the business when it is expected', () => {
    render(<WhenCard scheduled={visit.toISOString()} audience="provider" />);

    expect(screen.getByText('When are you expected?')).toBeOnTheScreen();
});

it("calls the address the client's, not the reader's, on the business side", () => {
    render(<WhereCard place={{ line: '12 Mabini Street' }} map={false} audience="provider" />);

    expect(screen.getByText('Where is the job?')).toBeOnTheScreen();
    expect(screen.getByText("The client's address")).toBeOnTheScreen();
});

it("keeps the trouble the client's own on their side", () => {
    render(<WhereCard place={{ line: '12 Mabini Street' }} map={false} />);

    expect(screen.getByText('Where is the trouble?')).toBeOnTheScreen();
    expect(screen.getByText('Your address')).toBeOnTheScreen();
});

/** Somewhere pinned, so the card has a point to hand over. */
const pinned = {
    label: 'Home',
    line: '12 Mabini Street, Poblacion',
    latitude: 7.07,
    longitude: 125.61,
};

// Our map is a picture. Getting there belongs to the app the person already
// navigates with, so the card hands the pin over rather than growing routing.
it('hands the pin to the maps app the phone already uses', async () => {
    const openURL = jest.spyOn(Linking, 'openURL').mockResolvedValue(true);

    render(<WhereCard place={pinned} map={false} />);
    fireEvent.press(screen.getByText('Open in Maps'));

    expect(openURL).toHaveBeenCalledWith(expect.stringContaining('7.07,125.61'));
    expect(openURL).toHaveBeenCalledWith(
        expect.stringContaining(encodeURIComponent('12 Mabini Street, Poblacion')),
    );

    await waitFor(() => expect(screen.queryByText(/No maps app/)).not.toBeOnTheScreen());
});

it('offers nothing to open when the address has no pin', () => {
    render(<WhereCard place={{ line: '12 Mabini Street' }} map={false} />);

    expect(screen.queryByText('Open in Maps')).not.toBeOnTheScreen();
});

// Neither maps URL can draw a circle, and both drop a marker on whatever point
// they are given -- so the handover would state the doorstep the card refuses to.
it('hands nothing over while the pin is only an area', () => {
    render(<WhereCard place={pinned} map={false} radius={300} audience="provider" />);

    expect(screen.queryByText('Open in Maps')).not.toBeOnTheScreen();
});

it('stops short of naming the place when the address is only an area', () => {
    render(
        <WhereCard
            place={{ line: 'Barangay 5, Davao City' }}
            map={false}
            radius={300}
            audience="provider"
        />,
    );

    expect(screen.getByText('Somewhere around here')).toBeOnTheScreen();
    expect(screen.getByText('Barangay 5, Davao City')).toBeOnTheScreen();
});

// A tap that does nothing at all reads as a broken button.
it('says so when nothing on the phone answers', async () => {
    jest.spyOn(Linking, 'openURL').mockRejectedValue(new Error('no handler'));

    render(<WhereCard place={pinned} map={false} />);
    fireEvent.press(screen.getByText('Open in Maps'));

    expect(await screen.findByText('No maps app on this phone answered.')).toBeOnTheScreen();
});
