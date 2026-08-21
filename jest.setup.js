
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
