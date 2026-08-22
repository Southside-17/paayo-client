#!/usr/bin/env node
/**
 * Run an Android build command with the toolchain Gradle needs pointed at.
 *
 * Both halves exist because the failure without them reads like a code fault
 * rather than a missing path, and because android/ is regenerated -- anything
 * written into local.properties is discarded by the next prebuild.
 */
import { execFileSync, spawn, spawnSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { homedir } from 'node:os';

const SUPPORTED = [21, 17];

/**
 * Where an Android SDK is usually unpacked, in the order worth trying.
 *
 * Android Studio installs to the first; the others are what CI images use.
 */
const SDK_CANDIDATES = [
    `${homedir()}/Library/Android/sdk`,
    `${homedir()}/Android/Sdk`,
    '/usr/local/lib/android/sdk',
];

/**
 * Find the Android SDK.
 *
 * Gradle reads ANDROID_HOME or android/local.properties and, finding neither,
 * says only "SDK location not found" -- true, unhelpful, and identical whether
 * the SDK is missing or merely unannounced. Studio writes local.properties when
 * it opens a project; prebuild then throws it away with the rest of android/.
 * A directory only counts if it holds platform-tools, so a stale variable
 * pointing at nothing is treated as unset rather than passed on to fail later.
 */
function locateSdk() {
    const candidates = [process.env.ANDROID_HOME, process.env.ANDROID_SDK_ROOT, ...SDK_CANDIDATES];

    return candidates.find((path) => path && existsSync(`${path}/platform-tools`)) ?? null;
}


/** Read a JDK's major version, or null when the path holds no usable JDK. */
function majorVersionOf(home) {
    if (!home || !existsSync(`${home}/bin/java`)) {
        return null;
    }

    // `java -version` writes to stderr, so both streams have to be read.
    const result = spawnSync(`${home}/bin/java`, ['-version'], { encoding: 'utf8' });
    const match = /version "(\d+)/.exec(`${result.stdout ?? ''}${result.stderr ?? ''}`);

    return match ? Number(match[1]) : null;
}

/** Ask macOS for a specific JDK it has registered. */
function systemJavaHome(version) {
    try {
        return execFileSync('/usr/libexec/java_home', ['-v', String(version)], {
            encoding: 'utf8',
            stdio: ['ignore', 'pipe', 'ignore'],
        }).trim();
    } catch {
        return null;
    }
}

/**
 * Find a JDK that AGP actually supports.
 *
 * React Native's native modules go through AGP's CMake configure step, which
 * still calls restricted JNI methods. JDK 25 made that fatal (JEP 472), so a
 * build on 25 dies with an opaque `configureCMakeDebug ... restricted method`
 * error that reads like a code fault.
 *
 * This half goes away once React Native supports JDK 25. The SDK half does not.
 */
function locateJdk() {
    const candidates = [
        process.env.JAVA_HOME,
        ...SUPPORTED.map(systemJavaHome),
        ...SUPPORTED.map((v) => `/opt/homebrew/opt/openjdk@${v}/libexec/openjdk.jdk/Contents/Home`),
        ...SUPPORTED.map((v) => `/usr/local/opt/openjdk@${v}/libexec/openjdk.jdk/Contents/Home`),
    ];

    for (const home of candidates) {
        const major = majorVersionOf(home);

        if (major !== null && SUPPORTED.includes(major)) {
            return { home, major };
        }
    }

    return null;
}

const sdk = locateSdk();

if (!sdk) {
    console.error(
        [
            '',
            'Android builds need the SDK. Looked at ANDROID_HOME, ANDROID_SDK_ROOT',
            `and ${SDK_CANDIDATES.join(', ')}, and found no platform-tools in any.`,
            '',
            'Install it through Android Studio, or point ANDROID_HOME at an existing',
            'copy and try again.',
            '',
        ].join('\n'),
    );
    process.exit(1);
}

const jdk = locateJdk();

if (!jdk) {
    const found = majorVersionOf(process.env.JAVA_HOME) ?? 'none';

    console.error(
        [
            '',
            `Android builds need JDK ${SUPPORTED.join(' or ')}. Found: ${found}.`,
            '',
            'React Native cannot build on JDK 25 yet -- JEP 472 made its CMake step',
            'fail. Install a supported JDK and try again:',
            '',
            '  brew install openjdk@21',
            '',
        ].join('\n'),
    );
    process.exit(1);
}

const [command, ...args] = process.argv.slice(2);

if (!command) {
    console.error('with-android-env: nothing to run.');
    process.exit(1);
}

console.log(`Building with JDK ${jdk.major} (${jdk.home})`);
console.log(`Android SDK at ${sdk}`);

const child = spawn(command, args, {
    stdio: 'inherit',
    env: {
        ...process.env,
        JAVA_HOME: jdk.home,
        ANDROID_HOME: sdk,
        ANDROID_SDK_ROOT: sdk,
        PATH: `${jdk.home}/bin:${sdk}/platform-tools:${process.env.PATH}`,
    },
});

child.on('exit', (code) => process.exit(code ?? 1));
