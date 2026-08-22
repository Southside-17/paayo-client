
// The token store is Keychain/Keystore backed; tests use an in-memory stand-in.
jest.mock('expo-secure-store', () => {
    const store = new Map();

    return {
        getItemAsync: jest.fn(async (key) => store.get(key) ?? null),
        setItemAsync: jest.fn(async (key, value) => void store.set(key, value)),
        deleteItemAsync: jest.fn(async (key) => void store.delete(key)),
        __store: store,
    };
});

jest.mock('expo-constants', () => ({ deviceName: 'Test Device' }));

// Passkeys are a platform capability and jest has no authenticator. Off by
// default so a screen renders the way it does on a device without one; a test
// that wants the button turns isSupported on for itself.
jest.mock('react-native-passkeys', () => ({
    isSupported: jest.fn(() => false),
    isAutoFillAvalilable: jest.fn(() => false),
    create: jest.fn(),
    get: jest.fn(),
}));

// A configured build is the default the suite runs as: a relying party domain,
// and the iOS entitlement a paid Apple team can carry. Tests that care about
// the unconfigured cases reload the module with these cleared.
process.env.EXPO_PUBLIC_PASSKEY_RP_ID = 'www.paayo.test';
process.env.EXPO_PUBLIC_PASSKEY_IOS = '1';

// expo-maps is a native view with no JS fallback, so requiring it under jest
// throws before a screen that draws a map can render at all. The stand-in keeps
// the platform split in pin-map.tsx honest -- both halves still exist -- while
// rendering nothing.
jest.mock('expo-maps', () => {
    const React = require('react');

    // Renders nothing and imports nothing from react-native: NativeWind's babel
    // plugin rewrites any View in here into an interop call, and a mock factory
    // may not reference an out-of-scope variable. The imperative handle is the
    // part that matters -- pin-map aims the camera through the ref, and a bare
    // View would throw on a method it does not have.
    const MapView = React.forwardRef((props, ref) => {
        React.useImperativeHandle(ref, () => ({ setCameraPosition: () => {} }));

        return null;
    });

    MapView.displayName = 'MockMapView';

    return { AppleMaps: { View: MapView }, GoogleMaps: { View: MapView } };
});

// expo-video-thumbnails reaches a native decoder. The stand-in answers with a
// file that exists nowhere, which is all MediaThumb does with it.
jest.mock('expo-video-thumbnails', () => ({
    getThumbnailAsync: jest.fn(async () => ({
        uri: 'file:///still.jpg',
        width: 320,
        height: 180,
    })),
}));

// expo-video is a native view and a native player object. Both are stood in
// for: the view renders nothing, and the player carries only what the viewer
// touches, so a test can assert what was handed to it and that it was started.
jest.mock('expo-video', () => {
    const play = jest.fn();

    function MockVideoView() {
        return null;
    }

    return {
        useVideoPlayer: jest.fn((source, setup) => {
            const player = { loop: true, play };

            setup?.(player);

            return player;
        }),
        VideoView: MockVideoView,
        __play: play,
    };
});
