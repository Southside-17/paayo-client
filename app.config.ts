import type { ExpoConfig } from 'expo/config';
import { withXcodeProject } from 'expo/config-plugins';

import { withIosPaidEntitlements } from './scripts/with-ios-paid-entitlements';
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
    // `fingerprint` rather than a hand-kept string: android/ and ios/ are
    // CNG-generated and never committed, so the only honest answer to "does this
    // JS bundle match this native build" is a hash of the native inputs. It moves
    // exactly when a rebuild is genuinely required, and an install only ever
    // accepts a manifest whose runtimeVersion equals its own.
    runtimeVersion: { policy: 'fingerprint' },
    updates: {
        url: 'https://ota.paayo.ph/manifest',
        // The certificate is committed and compiled into the binary; the matching
        // private key lives only on the update host. A manifest not signed by it
        // is refused by the client before a single asset is fetched.
        codeSigningCertificate: './certs/certificate.pem',
        codeSigningMetadata: { keyid: 'main', alg: 'rsa-v1_5-sha256' },
        fallbackToCacheTimeout: 0,
    },
    android: {
        package: 'com.paayo.ph',
        // Firebase Cloud Messaging reads the sender id out of this file. Without
        // it the app registers against no project and getDevicePushTokenAsync
        // rejects; there is no key to put in app.config.ts instead.
        googleServicesFile: process.env.GOOGLE_SERVICES_JSON ?? './google-services.json',
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
        // Pulled in by dependencies, used by nothing here. Google's Photo and
        // Video Permissions policy expects the narrowest set an app can work
        // with, and audio is not part of any feature -- there is no sound
        // anywhere in Paayo. SYSTEM_ALERT_WINDOW draws over other apps, which
        // is a debug-tooling permission and has no business in a release.
        blockedPermissions: [
            'android.permission.READ_MEDIA_AUDIO',
            'android.permission.RECORD_AUDIO',
            'android.permission.SYSTEM_ALERT_WINDOW',
        ],
    },
    ios: {
        bundleIdentifier: 'com.paayo.ph',
        supportsTablet: false,
        // A passkey is bound to a domain, and iOS will not let the app speak for
        // one until it has read https://{domain}/.well-known/
        // apple-app-site-association and found this bundle listed there.
        //
        // Gated on the membership flag as well as the domain, because Associated
        // Domains is a paid Apple Developer Program capability: a free Personal
        // Team cannot claim a domain, and asking it to fails the entire build
        // rather than only passkeys. Android needs none of this, so the domain
        // alone must not be what turns it on.
        associatedDomains:
            process.env.EXPO_PUBLIC_PASSKEY_DOMAIN && process.env.EXPO_PUBLIC_APPLE_DEVELOPER_PROGRAM
                ? [`webcredentials:${process.env.EXPO_PUBLIC_PASSKEY_DOMAIN}`]
                : undefined,
        // Push Notifications is the other paid capability behind the same flag:
        // a free Personal Team cannot hold the entitlement, and asking for it
        // fails the whole build, not only push.
        entitlements: process.env.EXPO_PUBLIC_APPLE_DEVELOPER_PROGRAM
            ? { 'aps-environment': 'development' }
            : undefined,
        infoPlist: {
            NSLocalNetworkUsageDescription:
                'Paayo reaches the development server running on your computer.',
            // Set here rather than through the expo-media-library plugin, which
            // reads its permission options and then throws them away: it calls
            // createPermissionsPlugin(...)(config, props) and discards the
            // returned config, so the mod is never registered. Verified against
            // 57.0.4 by finding no NSPhotoLibraryAddUsageDescription in the
            // generated Info.plist after a prebuild.
            //
            // Load bearing, not cosmetic: a missing usage description is a hard
            // crash on iOS rather than a refused permission, so saving a QR
            // would take the app down.
            NSPhotoLibraryAddUsageDescription:
                'Paayo saves the QR code clients pay you through to your photos.',
        },
    },
    web: {
        // 'single' rather than 'static'. Static rendering prerenders every route
        // in a Node bundle, and Expo runs that bundle with React's `react-server`
        // export condition on. `expo-router/vendor/react-helmet-async`, which
        // expo-router's own <Head> pulls in, is built on class components --
        // `class HelmetProvider extends React.Component`. The react-server build
        // of React exports no `Component`, so evaluating that module throws
        // "Class extends value undefined is not a constructor or null" and takes
        // down `expo start` the moment anything asks for the web bundle.
        //
        // Upstream bug in SDK 57, not ours, and nothing here needs prerendering:
        // Paayo ships to iOS and Android, and web only exists to be opened
        // occasionally in a browser. 'single' emits a plain SPA shell and skips
        // the Node render pass entirely.
        output: 'single',
        favicon: './assets/images/favicon.png',
    },
    plugins: [
        'expo-router',
        'expo-secure-store',
        '@react-native-community/datetimepicker',
        // Android's native account picker. Google offers no native picker on
        // iOS -- its SDK opens a browser sheet there too -- so iOS keeps the
        // expo-auth-session flow and only Android changes.
        '@react-native-google-signin/google-signin',
        [
            'expo-maps',
            {
                requestLocationPermission: true,
                locationPermission:
                    'Paayo uses your location to place the pin on a new address.',
            },
        ],
        [
            // Declared in its own right, not through expo-maps. Auto-arrival
            // watches a boundary with the app closed -- the crew are driving,
            // not reading a screen -- and that needs the background permission
            // and the foreground service, neither of which the maps plugin asks
            // for. Region monitoring, not tracking: the phone's own hardware
            // watches the boundary and wakes the app once.
            'expo-location',
            {
                isAndroidBackgroundLocationEnabled: true,
                isAndroidForegroundServiceEnabled: true,
                locationAlwaysAndWhenInUsePermission:
                    'Paayo marks you as arrived when you reach a job, so you do not have to stop and tap. Your location stays on this phone.',
                locationWhenInUsePermission:
                    'Paayo uses your location to place the pin on a new address and to know when you reach a job.',
            },
        ],
        'expo-sharing',
        // Listed for the native module and its Android manifest entry only. Its
        // permission options do nothing -- see NSPhotoLibraryAddUsageDescription
        // above -- so do not add them back expecting them to take effect.
        //
        // Write-only in use: Paayo saves a business's own QR so a client can be
        // sent it later and never reads the library, which the picker asks for
        // separately when a photo of the work is attached.
        'expo-media-library',
        [
            'expo-image-picker',
            {
                photosPermission: 'Paayo needs your photo library to set your picture and to send documents for verification.',
                cameraPermission: 'Paayo needs the camera to photograph documents for verification.',
                // The plugin adds RECORD_AUDIO by default. Nothing here records
                // anything, it is a sensitive permission a reviewer will ask
                // about, and the privacy policy says we do not use the
                // microphone -- which has to be true.
                microphonePermission: false,
            },
        ],
        [
            // Both off deliberately. Background playback claims the `audio`
            // UIBackgroundMode and picture in picture claims its own
            // entitlement; a clip attached to a booking is looked at once, on
            // screen, and needs neither.
            'expo-video',
            {
                supportsBackgroundPlayback: false,
                supportsPictureInPicture: false,
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

export default withIosPaidEntitlements(withIosSceneLifecycle(withIosBuildSettings(config)));
