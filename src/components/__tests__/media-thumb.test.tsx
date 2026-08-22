import { render, waitFor } from '@testing-library/react-native';
import { getThumbnailAsync } from 'expo-video-thumbnails';

import { MediaThumb } from '@/components/media-thumb';

beforeEach(() => (getThumbnailAsync as jest.Mock).mockClear());

// A blank square reads as a broken upload, and a play icon alone says nothing
// about which clip it is.
it('pulls a still out of a clip, carrying the token it is served with', async () => {
    render(
        <MediaThumb
            uri="https://paayo.test/attachments/one"
            video
            headers={{ Authorization: 'Bearer a-token' }}
        />,
    );

    await waitFor(() => expect(getThumbnailAsync).toHaveBeenCalled());

    expect(getThumbnailAsync).toHaveBeenCalledWith(
        'https://paayo.test/attachments/one',
        expect.objectContaining({ headers: { Authorization: 'Bearer a-token' } }),
    );
});

it('asks for nothing when the file is a photo', () => {
    render(<MediaThumb uri="https://paayo.test/attachments/two" video={false} />);

    expect(getThumbnailAsync).not.toHaveBeenCalled();
});

// The booking screen and the booking it becomes both draw the same clip, and a
// still costs a download of the whole file.
it('pulls a clip once however many squares show it', async () => {
    const uri = 'https://paayo.test/attachments/three';

    render(<MediaThumb uri={uri} video />);
    render(<MediaThumb uri={uri} video />);

    await waitFor(() => expect(getThumbnailAsync).toHaveBeenCalled());

    expect(getThumbnailAsync).toHaveBeenCalledTimes(1);
});
