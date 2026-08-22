import type { ExpoConfig } from 'expo/config';
import { withXcodeProject } from 'expo/config-plugins';

import { withIosSceneLifecycle } from './scripts/with-ios-scene-lifecycle';
import palette from './src/theme/palette';

/**
 * Expo app configuration. Native android/ and ios/ projects are generated from
 * this file, so it is the only place platform settings are declared.
 */
const config: ExpoConfig = {
    name: 'Paayo',
    slug: 'paayo',
    version: '1.0.0',
    orientation: 'portrait',
    // Two schemes: 'paayo' for our own deep links, and the bundle identifier
    // because Google returns from sign in to `com.paayo.ph:/oauthredirect`.
    // Both are load bearing -- dropping the second one leaves prebuild with no
    // intent filter for it, and the browser then has nowhere to hand the
    // redirect back to. Verified by removing it and reading the manifest.
    //
    // A dev build logs "multiple possible URI schemes ... Ignoring:
    // com.paayo.ph, com.paayo.ph" because Expo's launcher appends the
    // application id at runtime for its own `expo-development-client` link.
    // That duplicate is not from here and does not appear in a release build.
    scheme: ['paayo', 'com.paayo.ph'],
    userInterfaceStyle: 'automatic',
    icon: './assets/images/icon.png',
    android: {
        package: 'com.paayo.ph',
        // expo-maps carries Google Maps on Android only; iOS renders Apple Maps
        // and needs no key. Restrict this one to Android apps, this package and
        // the signing SHA-1, with no API on it but Maps SDK for Android.
        config: {
            googleMaps: { apiKey: process.env.GOOGLE_MAPS_API_KEY },
        },
        adaptiveIcon: {
            foregroundImage: './assets/images/android-icon-foreground.png',
            backgroundImage: './assets/images/android-icon-background.png',
            monochromeImage: './assets/images/android-icon-monochrome.png',
        },
    },
    ios: {
        bundleIdentifier: 'com.paayo.ph',
        supportsTablet: false,
        // A passkey is bound to a domain, and iOS will not let the app speak for
        // one until it has read https://{domain}/.well-known/
        // apple-app-site-association and found this bundle listed there.
        //
        // Gated on its own flag and not on the domain alone, because Associated
        // Domains is a paid Apple Developer Program capability: a free Personal
        // Team cannot claim a domain, and asking it to fails the entire build
        // rather than only passkeys. Android needs none of this.
        associatedDomains:
            process.env.EXPO_PUBLIC_PASSKEY_RP_ID && process.env.EXPO_PUBLIC_PASSKEY_IOS
                ? [`webcredentials:${process.env.EXPO_PUBLIC_PASSKEY_RP_ID}`]
                : undefined,
        infoPlist: {
            NSLocalNetworkUsageDescription:
                'Paayo reaches the development server running on your computer.',
        },
    },
    web: {
        output: 'static',
        favicon: './assets/images/favicon.png',
    },
    plugins: [
        'expo-router',
        'expo-secure-store',
        [
            'expo-maps',
            {
                requestLocationPermission: true,
                locationPermission:
                    'Paayo uses your location to place the pin on a new address.',
            },
        ],
        [
            'expo-image-picker',
            {
                photosPermission: 'Paayo needs your photo library to set your picture and to send documents for verification.',
                cameraPermission: 'Paayo needs the camera to photograph documents for verification.',
            },
        ],
        [
            // Embedded rather than loaded with useFonts, so type is right at
            // first paint with no async gate. The two halves are not symmetric:
            // Android maps files to weights under one family, iOS lists paths
            // and reads the weight out of each file's own metadata.
            'expo-font',
            {
                android: {
                    fonts: [
                        {
                            fontFamily: 'Urbanist',
                            fontDefinitions: [
                                { path: './assets/fonts/Urbanist_400Regular.ttf', weight: 400 },
                                { path: './assets/fonts/Urbanist_500Medium.ttf', weight: 500 },
                                { path: './assets/fonts/Urbanist_600SemiBold.ttf', weight: 600 },
                                { path: './assets/fonts/Urbanist_700Bold.ttf', weight: 700 },
                            ],
                        },
                        {
                            fontFamily: 'JetBrains Mono',
                            fontDefinitions: [
                                { path: './assets/fonts/JetBrainsMono_400Regular.ttf', weight: 400 },
                            ],
                        },
                    ],
                },
                ios: {
                    fonts: [
                        './assets/fonts/Urbanist_400Regular.ttf',
                        './assets/fonts/Urbanist_500Medium.ttf',
                        './assets/fonts/Urbanist_600SemiBold.ttf',
                        './assets/fonts/Urbanist_700Bold.ttf',
                        './assets/fonts/JetBrainsMono_400Regular.ttf',
                    ],
                },
            },
        ],
        [
            'expo-splash-screen',
            {
                image: './assets/images/splash-icon.png',
                imageWidth: 96,
                resizeMode: 'contain',
                backgroundColor: palette.light.background,
                dark: { backgroundColor: palette.dark.background },
            },
        ],
    ],
    experiments: {
        typedRoutes: true,
        reactCompiler: true,
    },
};

/** A build configuration entry, as opposed to the comment strings beside it. */
type BuildConfiguration = { buildSettings: Record<string, string> };

function isBuildConfiguration(entry: unknown): entry is BuildConfiguration {
    return typeof entry === 'object' && entry !== null && 'buildSettings' in entry;
}

/**
 * Settings Xcode owns that a regenerated project would otherwise lose.
 *
 * The development team is deliberately left out. `expo run:ios` passes
 * -allowProvisioningUpdates only when it finds no team in the project, so
 * pinning one here stops it minting the profile a device build needs.
 */
function withIosBuildSettings(expoConfig: ExpoConfig): ExpoConfig {
    return withXcodeProject(expoConfig, (xcodeConfig) => {
        const configurations = xcodeConfig.modResults.pbxXCBuildConfigurationSection();

        for (const entry of Object.values(configurations)) {
            if (!isBuildConfiguration(entry)) {
                continue;
            }

            entry.buildSettings.ENABLE_USER_SCRIPT_SANDBOXING = 'NO';
        }

        return xcodeConfig;
    });
}

export default withIosSceneLifecycle(withIosBuildSettings(config));
