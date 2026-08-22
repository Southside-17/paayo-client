import { ImageManipulator } from 'expo-image-manipulator';

import { preparePicture } from '@/lib/picture';

jest.mock('expo-image-manipulator', () => ({
    ImageManipulator: { manipulate: jest.fn() },
    SaveFormat: { JPEG: 'jpeg', PNG: 'png', WEBP: 'webp' },
}));

const saveAsync = jest.fn();
const resize = jest.fn();

function context() {
    const chain = {
        resize: resize.mockReturnValue(undefined as never),
        renderAsync: jest.fn(async () => ({ saveAsync })),
    };

    chain.resize.mockReturnValue(chain as never);

    return chain;
}

beforeEach(() => {
    jest.clearAllMocks();
    saveAsync.mockResolvedValue({ uri: 'file:///small.jpg', width: 512, height: 512 });
    jest.mocked(ImageManipulator.manipulate).mockReturnValue(context() as never);
});

it('brings a picture larger than the target down to it', async () => {
    await preparePicture({ uri: 'file:///huge.jpg', width: 3024 }, 512, 'avatar.jpg');

    expect(resize).toHaveBeenCalledWith({ width: 512 });
});

// Scaling up spends bytes to add blur, and the picker's crop already returns
// small squares when the chosen region is small.
it('leaves a picture smaller than the target alone', async () => {
    await preparePicture({ uri: 'file:///tiny.jpg', width: 340 }, 512, 'avatar.jpg');

    expect(resize).not.toHaveBeenCalled();
});

it('hands back a part the server can match against its mimes rule', async () => {
    const part = await preparePicture({ uri: 'file:///huge.jpg', width: 3024 }, 512, 'avatar.jpg');

    expect(saveAsync).toHaveBeenCalledWith({ compress: 0.8, format: 'jpeg' });
    expect(part).toEqual({ uri: 'file:///small.jpg', name: 'avatar.jpg', type: 'image/jpeg' });
});
