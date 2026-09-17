
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

// The native version is read from the app bundle, which jest has none of. A
// build well above any floor is the default, so the update gate stays out of
// every test that is not about it.
jest.mock('expo-application', () => ({ nativeApplicationVersion: '9.9.9' }));

// Passkeys are a platform capability and jest has no authenticator. Off by
// default so a screen renders the way it does on a device without one; a test
// that wants the button turns isSupported on for itself.
jest.mock('react-native-passkeys', () => ({
    isSupported: jest.fn(() => false),
    isAutoFillAvalilable: jest.fn(() => false),
    create: jest.fn(),
    get: jest.fn(),
}));

// Apple sign in is a platform sheet too, and jest has no Apple Account.
// Unavailable by default for the same reason as passkeys above, so a screen
// renders the way it does where the feature cannot be offered; a test that wants
// the button turns isAvailableAsync on for itself.
jest.mock('expo-apple-authentication', () => ({
    isAvailableAsync: jest.fn(async () => false),
    signInAsync: jest.fn(),
    AppleAuthenticationScope: { FULL_NAME: 0, EMAIL: 1 },
    AppleAuthenticationUserDetectionStatus: { UNSUPPORTED: 0, UNKNOWN: 1, LIKELY_REAL: 2 },
}));

// A fully provisioned build is the default the suite runs as: a passkey domain,
// and the paid Apple membership that lets iOS carry the entitlements. Tests
// that care about the unprovisioned cases reload the module with these cleared.
process.env.EXPO_PUBLIC_PASSKEY_DOMAIN = 'www.paayo.test';
process.env.EXPO_PUBLIC_APPLE_DEVELOPER_PROGRAM = '1';
// The suite runs as a fully provisioned build. Android reads the web client id
// rather than its own: Play Services knows the app by its signing certificate.
process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID = 'web.apps.googleusercontent.test';
process.env.EXPO_PUBLIC_GOOGLE_ANDROID_CLIENT_ID = 'android.apps.googleusercontent.test';
process.env.EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID = 'ios.apps.googleusercontent.test';
// One Entra app registration serves the app and the console alike, so the app
// carries its client id and no secret.
process.env.EXPO_PUBLIC_MICROSOFT_CLIENT_ID = 'paayo-entra-client-id.test';

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

// expo-notifications reaches the OS for permission and for a token, and warns
// on import about Expo Go. The stand-in denies by default, which is how a phone
// that has never been asked behaves; a test that wants a granted phone says so.
jest.mock('expo-notifications', () => ({
    getPermissionsAsync: jest.fn(async () => ({ granted: false, canAskAgain: true })),
    requestPermissionsAsync: jest.fn(async () => ({ granted: false, canAskAgain: true })),
    getDevicePushTokenAsync: jest.fn(async () => ({ data: 'device-token', type: 'android' })),
    setNotificationHandler: jest.fn(),
    setNotificationCategoryAsync: jest.fn(async () => undefined),
    addNotificationResponseReceivedListener: jest.fn(() => ({ remove: jest.fn() })),
}));

// Geofencing needs both of these, and neither exists off a device. The geofence
// test mocks them itself with handles it can assert on; this is the blanket so
// any screen importing src/lib/geofence.ts renders.
jest.mock('expo-task-manager', () => ({ defineTask: jest.fn() }));

jest.mock('expo-location', () => ({
    requestForegroundPermissionsAsync: jest.fn(async () => ({ granted: false })),
    requestBackgroundPermissionsAsync: jest.fn(async () => ({ granted: false })),
    getCurrentPositionAsync: jest.fn(async () => ({ coords: { latitude: 0, longitude: 0 } })),
    startGeofencingAsync: jest.fn(async () => undefined),
    stopGeofencingAsync: jest.fn(async () => undefined),
    hasStartedGeofencingAsync: jest.fn(async () => false),
    GeofencingEventType: { Enter: 1, Exit: 2 },
    Accuracy: { Balanced: 3 },
}));

// Android push needs no entitlement, so the suite runs as a build that can be
// notified on either platform. The iOS-without-membership case reloads the
// module.
process.env.EXPO_PUBLIC_APPLE_DEVELOPER_PROGRAM = '1';

// Reanimated boots worklets on import, and the worklets runtime is not
// transformed for jest -- requiring it throws before any screen holding a
// sheet can render. The stand-in lives in __mocks__/react-native-reanimated.js
// rather than inline here: NativeWind's babel plugin injects its interop
// helper into any file that creates an element, and jest refuses a mock
// factory that reaches an out-of-scope variable. A module file has no such
// limit, and jest picks it up for a node module without being asked.
jest.mock('react-native-reanimated');

// Neither is reachable in a test run: saving and sharing a QR both go through
// native modules, and the screens are asserted on what they say rather than on
// the file landing.
jest.mock('expo-sharing', () => ({
    isAvailableAsync: jest.fn(async () => true),
    shareAsync: jest.fn(async () => undefined),
}));

jest.mock('expo-media-library', () => ({
    requestPermissionsAsync: jest.fn(async () => ({ granted: true })),
    saveToLibraryAsync: jest.fn(async () => undefined),
}));

// Google's native picker. Unavailable by default, the way the passkey and Apple
// modules are: a test that wants the Android path mocks it for itself.
jest.mock('@react-native-google-signin/google-signin', () => ({
    GoogleSignin: {
        configure: jest.fn(),
        hasPlayServices: jest.fn(async () => true),
        signIn: jest.fn(async () => ({ type: 'cancelled', data: null })),
        signOut: jest.fn(async () => null),
        getTokens: jest.fn(async () => ({ idToken: null, accessToken: null })),
    },
    isSuccessResponse: (response) => response?.type === 'success',
    isErrorWithCode: (error) => typeof error?.code === 'string',
    statusCodes: {
        SIGN_IN_CANCELLED: '12501',
        IN_PROGRESS: '12502',
        PLAY_SERVICES_NOT_AVAILABLE: '12503',
        SIGN_IN_REQUIRED: '4',
        NULL_PRESENTER: 'NULL_PRESENTER',
    },
}));
