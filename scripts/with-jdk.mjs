#!/usr/bin/env node
/**
 * Run an Android build command with a JDK that AGP actually supports.
 *
 * React Native's native modules go through AGP's CMake configure step, which
 * still calls restricted JNI methods. JDK 25 made that fatal (JEP 472), so a
 * build on 25 dies with an opaque `configureCMakeDebug ... restricted method`
 * error that reads like a code fault. This resolves a 17 or 21 instead and
 * fails loudly when it cannot, rather than letting Gradle produce that trace.
 *
 * Delete this once React Native supports JDK 25.
 */
import { execFileSync, spawn, spawnSync } from 'node:child_process';
import { existsSync } from 'node:fs';

const SUPPORTED = [21, 17];

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
    console.error('with-jdk: nothing to run.');
    process.exit(1);
}

console.log(`Building with JDK ${jdk.major} (${jdk.home})`);

const child = spawn(command, args, {
    stdio: 'inherit',
    env: { ...process.env, JAVA_HOME: jdk.home, PATH: `${jdk.home}/bin:${process.env.PATH}` },
});

child.on('exit', (code) => process.exit(code ?? 1));
