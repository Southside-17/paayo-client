import type { ExpoConfig } from 'expo/config';

/**
 * Expo app configuration. Native android/ and ios/ projects are generated from
 * this file, so it is the only place platform settings are declared.
 */
const config: ExpoConfig = {
    name: 'Paayo',
    slug: 'paayo',
    version: '1.0.0',
    orientation: 'portrait',
    scheme: 'paayo',
    userInterfaceStyle: 'automatic',
    icon: './assets/images/icon.png',
    newArchEnabled: true,
    android: {
        package: 'com.paayo.mobile',
        adaptiveIcon: {
            foregroundImage: './assets/images/android-icon-foreground.png',
            backgroundImage: './assets/images/android-icon-background.png',
            monochromeImage: './assets/images/android-icon-monochrome.png',
        },
    },
    ios: {
        bundleIdentifier: 'com.paayo.mobile',
        supportsTablet: false,
    },
    web: {
        output: 'static',
        favicon: './assets/images/favicon.png',
    },
    plugins: [
        'expo-router',
        'expo-secure-store',
        [
            'expo-splash-screen',
            {
                image: './assets/images/splash-icon.png',
                imageWidth: 96,
                resizeMode: 'contain',
            },
        ],
    ],
    experiments: {
        typedRoutes: true,
        reactCompiler: true,
    },
};

export default config;
