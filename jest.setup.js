
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
