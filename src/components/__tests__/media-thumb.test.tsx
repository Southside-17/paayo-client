import { render, waitFor } from '@testing-library/react-native';
import { getThumbnailAsync } from 'expo-video-thumbnails';

import { MediaThumb } from '@/components/media-thumb';

beforeEach(() => (getThumbnailAsync as jest.Mock).mockClear());

// A blank square reads as a broken upload, and a play icon alone says nothing
// about which clip it is.
//
// Fetched with nothing attached: the address is signed and carries its own
// permission, and a store reads an Authorization header in preference to the
// signature and then fails to verify a token it was never issued.
it('pulls a still out of a clip, sending no headers of its own', async () => {
    render(<MediaThumb uri="https://store.paayo.test/one?X-Amz-Signature=abc" video />);

    await waitFor(() => expect(getThumbnailAsync).toHaveBeenCalled());

    const [uri, options] = (getThumbnailAsync as jest.Mock).mock.calls[0];

    expect(uri).toBe('https://store.paayo.test/one?X-Amz-Signature=abc');
    expect(options).not.toHaveProperty('headers');
});

it('asks for nothing when the file is a photo', () => {
    render(<MediaThumb uri="https://paayo.test/attachments/two" video={false} />);

    expect(getThumbnailAsync).not.toHaveBeenCalled();
});

// The booking screen and the booking it becomes both draw the same clip, and a
// still costs a download of the whole file.
it('pulls a clip once however many squares show it', async () => {
    const uri = 'https://store.paayo.test/three?X-Amz-Signature=abc';

    render(<MediaThumb uri={uri} video />);
    render(<MediaThumb uri={uri} video />);

    await waitFor(() => expect(getThumbnailAsync).toHaveBeenCalled());

    expect(getThumbnailAsync).toHaveBeenCalledTimes(1);
});

// A signed link carries a fresh signature every time the booking is loaded, so
// keying the cache on the whole address would pull the clip down again on every
// re-focus of the screen.
it('pulls a clip once across re-signings of the same address', async () => {
    render(<MediaThumb uri="https://store.paayo.test/four?X-Amz-Signature=first" video />);

    await waitFor(() => expect(getThumbnailAsync).toHaveBeenCalled());

    render(<MediaThumb uri="https://store.paayo.test/four?X-Amz-Signature=second" video />);

    expect(getThumbnailAsync).toHaveBeenCalledTimes(1);
});
