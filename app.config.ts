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
    scheme: 'paayo',
    userInterfaceStyle: 'automatic',
    icon: './assets/images/icon.png',
    android: {
        package: 'com.paayo.ph',
        adaptiveIcon: {
            foregroundImage: './assets/images/android-icon-foreground.png',
            backgroundImage: './assets/images/android-icon-background.png',
            monochromeImage: './assets/images/android-icon-monochrome.png',
        },
    },
    ios: {
        bundleIdentifier: 'com.paayo.ph',
        supportsTablet: false,
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

/** Settings Xcode owns that a regenerated project would otherwise lose. */
function withIosBuildSettings(expoConfig: ExpoConfig): ExpoConfig {
    return withXcodeProject(expoConfig, (xcodeConfig) => {
        const configurations = xcodeConfig.modResults.pbxXCBuildConfigurationSection();

        for (const entry of Object.values(configurations)) {
            if (!isBuildConfiguration(entry)) {
                continue;
            }

            entry.buildSettings.ENABLE_USER_SCRIPT_SANDBOXING = 'NO';

            if (process.env.APPLE_TEAM_ID) {
                entry.buildSettings.DEVELOPMENT_TEAM = process.env.APPLE_TEAM_ID;
            }
        }

        return xcodeConfig;
    });
}

export default withIosSceneLifecycle(withIosBuildSettings(config));
