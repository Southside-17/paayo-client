#!/usr/bin/env node
/**
 * Build a release APK and/or IPA.
 *
 * The API base URL is resolved here and exported into the build, rather than
 * left to whichever .env file Expo decides to load. `EXPO_PUBLIC_*` is inlined
 * by Babel as the bundle is written, so the value in force at build time is the
 * only one the binary will ever have -- there is no runtime switch, and a
 * mis-pointed build looks identical to a correct one until it is installed.
 * A variable already in the environment outranks every dotenv file, so setting
 * it here is what makes the choice deterministic.
 *
 *   node scripts/build.mjs [--platform ios|android|all] [--local]
 *                          [--api-url <url>] [--no-prebuild] [--dry-run]
 */
import { spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { networkInterfaces } from 'node:os';
import { basename, join } from 'node:path';

import { announceAndroidEnv, resolveAndroidEnv } from './lib/android-env.mjs';

const ROOT = new URL('..', import.meta.url).pathname.replace(/\/$/, '');
const OUTPUT = join(ROOT, 'build');

/** The port `composer dev` serves Octane on. */
const SERVER_PORT = 8000;

/**
 * What differs in a release build, and nothing else.
 *
 * Here rather than in a .env.production, because that file would have to be
 * exempted from the blanket `.env*` gitignore rule to be shared at all -- and a
 * file named like a secrets file, carved out of the rule that keeps secrets out
 * of git, is a trap set for whoever adds the next value. These are a public URL
 * and a public domain; they belong in code.
 *
 * The keys are the contract: every one of them is set explicitly for every
 * build, so a --local build gets .env's value (or empty) rather than inheriting
 * production's. Adding a production-only setting is one line here.
 */
const PRODUCTION = new Map([
    ['EXPO_PUBLIC_API_URL', 'https://www.paayo.ph'],

    // Passkeys are a production-build feature: both platforms fetch a file from
    // this domain over HTTPS before they will let the app speak for it, and a
    // dev server has no domain to offer. iOS additionally needs
    // EXPO_PUBLIC_APPLE_DEVELOPER_PROGRAM, which is empty until the membership
    // exists -- so today this turns passkeys on for Android alone.
    ['EXPO_PUBLIC_PASSKEY_DOMAIN', 'www.paayo.ph'],
]);

/**
 * Read a dotenv file into a map.
 *
 * Deliberately minimal: these files hold bare `KEY=value` lines and comments,
 * and pulling in a parser to read two of them would be the only dependency this
 * script has. An empty value is kept as an empty string rather than dropped,
 * because "declared and empty" is how a feature is switched off.
 */
function readEnvFile(file) {
    const values = new Map();

    if (!existsSync(file)) {
        return values;
    }

    for (const line of readFileSync(file, 'utf8').split('\n')) {
        const match = /^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)$/.exec(line);

        if (match) {
            values.set(match[1], match[2].trim().replace(/^(['"])(.*)\1$/, '$2'));
        }
    }

    return values;
}

/** The value of one key, or null when it is absent or empty. */
function valueOf(values, key) {
    return values.get(key) || null;
}

/**
 * This machine's address on the LAN.
 *
 * `localhost` on a phone is the phone, so a build meant for a physical device
 * needs the address the device can actually route to. en0 first, because that
 * is Wi-Fi on a Mac and the phone is on Wi-Fi.
 */
function lanAddress() {
    const interfaces = networkInterfaces();
    const names = ['en0', ...Object.keys(interfaces).filter((name) => name !== 'en0')];

    for (const name of names) {
        for (const entry of interfaces[name] ?? []) {
            if (entry.family === 'IPv4' && !entry.internal) {
                return entry.address;
            }
        }
    }

    return null;
}

/** Run a command, inheriting stdio, and abort the build if it fails. */
function run(command, args, options = {}) {
    const result = spawnSync(command, args, { stdio: 'inherit', cwd: ROOT, ...options });

    if (result.status !== 0) {
        console.error(`\n${basename(command)} failed (${result.status ?? result.signal}).\n`);
        process.exit(result.status ?? 1);
    }
}

/** Parse argv into the three decisions this script makes. */
function parseArguments(argv) {
    const options = { platform: 'all', target: 'production', apiUrl: null, prebuild: true, dryRun: false };

    for (let index = 0; index < argv.length; index += 1) {
        const argument = argv[index];

        switch (argument) {
            case '--platform':
            case '-p':
                options.platform = argv[index += 1];
                break;
            case '--local':
                options.target = 'local';
                break;
            case '--api-url':
                options.apiUrl = argv[index += 1];
                options.target = 'custom';
                break;
            case '--no-prebuild':
                options.prebuild = false;
                break;
            case '--dry-run':
                options.dryRun = true;
                break;
            case '--help':
            case '-h':
                console.log(
                    [
                        '',
                        'Usage: node scripts/build.mjs [options]',
                        '',
                        '  --platform ios|android|all  what to build. Default: all',
                        '  --local                     point at this machine instead of production',
                        '  --api-url <url>             point at a specific server',
                        '  --no-prebuild               keep android/ and ios/ as they are',
                        '  --dry-run                   print what would be built, then stop',
                        '',
                    ].join('\n'),
                );
                process.exit(0);
                break;
            default:
                console.error(`Unknown option: ${argument}`);
                process.exit(1);
        }
    }

    if (!['ios', 'android', 'all'].includes(options.platform)) {
        console.error(`--platform must be ios, android or all. Got: ${options.platform}`);
        process.exit(1);
    }

    return options;
}

/** Work out which server this build will talk to, and say so out loud. */
function resolveApiUrl({ target, apiUrl }, production, local) {
    if (target === 'custom') {
        return apiUrl;
    }

    if (target === 'production') {
        const url = valueOf(production, 'EXPO_PUBLIC_API_URL');

        if (!url) {
            console.error(
                [
                    '',
                    'No EXPO_PUBLIC_API_URL in PRODUCTION, so there is nothing to point a',
                    'production build at. Set it at the top of this script, or pass --api-url.',
                    '',
                ].join('\n'),
            );
            process.exit(1);
        }

        return url;
    }

    // A device build against this machine. .env already holds the address when
    // someone has been running on a physical phone; fall back to whatever the
    // LAN says, which is right often enough to save the lookup.
    const configured = valueOf(local, 'EXPO_PUBLIC_API_URL');

    if (configured) {
        return configured;
    }

    const address = lanAddress();

    if (!address) {
        console.error(
            [
                '',
                'Found no LAN address to point a local build at, and .env sets no',
                'EXPO_PUBLIC_API_URL. Connect to a network, or pass --api-url.',
                '',
            ].join('\n'),
        );
        process.exit(1);
    }

    return `http://${address}:${SERVER_PORT}`;
}

/**
 * Regenerate the native projects when they are not there.
 *
 * android/ and ios/ are gitignored build products, so a fresh clone has
 * neither. An existing pair is left alone: prebuild --clean discards any
 * Xcode-side signing state with them, and a rebuild is slow enough to be worth
 * not doing twice.
 */
function ensureNativeProjects(platforms, wanted, env) {
    if (!wanted) {
        return;
    }

    const missing = platforms.filter((platform) => !existsSync(join(ROOT, platform)));

    if (missing.length === 0) {
        return;
    }

    // Prebuild is given the same EXPO_PUBLIC_* values the bundle will be built
    // with, because app.config.ts reads them to decide the entitlements -- and a
    // production build takes EXPO_PUBLIC_PASSKEY_DOMAIN from PRODUCTION above
    // rather than from .env, which is empty on purpose. Without this it
    // generated an ios/ with no associated domain and no way to know.
    //
    // NODE_ENV is deliberately withheld: prebuild may install packages, and
    // `production` there omits devDependencies. It buys nothing anyway, since
    // prebuild writes native projects and bundles no JS.
    const { NODE_ENV: _release, ...expoPublic } = env;

    console.log(`\nGenerating ${missing.join(' and ')}/ with expo prebuild.\n`);
    run('npx', ['expo', 'prebuild', '--platform', missing.length === 2 ? 'all' : missing[0]], {
        env: { ...process.env, ...expoPublic },
    });
}

/**
 * The entitlements plist prebuild generated, or null when there is no ios/.
 *
 * Found rather than assumed: Expo names it after the target, so a renamed app
 * would otherwise pass a check that silently read nothing.
 */
function iosEntitlements() {
    const ios = join(ROOT, 'ios');

    if (!existsSync(ios)) {
        return null;
    }

    for (const entry of readdirSync(ios, { withFileTypes: true })) {
        if (!entry.isDirectory()) {
            continue;
        }

        const directory = join(ios, entry.name);
        const name = readdirSync(directory).find((file) => file.endsWith('.entitlements'));

        if (name) {
            return { path: join(directory, name), contents: readFileSync(join(directory, name), 'utf8') };
        }
    }

    return null;
}

/**
 * Refuse an iOS build whose JS claims a paid capability the binary cannot hold.
 *
 * The two halves are decided at different moments by different environments, and
 * that is the whole problem. `EXPO_PUBLIC_*` is inlined into the bundle by the
 * xcodebuild run below, which is handed `env`; the entitlements were written
 * earlier by whatever environment `expo prebuild` happened to see. Prebuild by
 * hand without the production domain exported, and the result is a build that
 * shows passkey buttons over an entitlement that was never written.
 *
 * Invisible until a real device taps the sheet against production, which is the
 * most expensive place to find it -- so it is a hard stop here instead. Read as
 * text rather than parsed: the file is generated, tiny, and what matters is
 * whether one exact string Expo writes is in it.
 */
function assertIosCapabilities(env, membership) {
    const entitlements = iosEntitlements();

    // Nothing generated yet, so there is nothing to disagree with. A prebuild is
    // still to come, and ensureNativeProjects gives it the right environment.
    if (entitlements === null || !membership) {
        return;
    }

    const domain = env.EXPO_PUBLIC_PASSKEY_DOMAIN;
    const missing = [];

    if (!entitlements.contents.includes('aps-environment')) {
        missing.push('push  aps-environment');
    }

    if (domain && !entitlements.contents.includes(`webcredentials:${domain}`)) {
        missing.push(`passkeys  webcredentials:${domain}`);
    }

    if (missing.length === 0) {
        return;
    }

    const exports = [`EXPO_PUBLIC_APPLE_DEVELOPER_PROGRAM=${membership}`]
        .concat(domain ? [`EXPO_PUBLIC_PASSKEY_DOMAIN=${domain}`] : [])
        .join(' ');

    console.error(`\n  ${entitlements.path.replace(`${ROOT}/`, '')} is missing:\n`);

    for (const entry of missing) {
        console.error(`    ${entry}`);
    }

    console.error('\n  This bundle would claim capabilities the binary has no entitlement for.');
    console.error('  Regenerate the native project with the values this build uses:\n');
    console.error(`    ${exports} npm run prebuild\n`);

    process.exit(1);
}

function buildAndroid(env, label, version) {
    const android = resolveAndroidEnv();

    announceAndroidEnv(android);

    run('./gradlew', ['assembleRelease'], {
        cwd: join(ROOT, 'android'),
        env: { ...process.env, ...android.env, ...env },
    });

    const apk = join(ROOT, 'android/app/build/outputs/apk/release/app-release.apk');
    const destination = join(OUTPUT, `paayo-${version}-${label}.apk`);

    run('cp', [apk, destination]);

    return destination;
}

/**
 * Archive and export an IPA.
 *
 * Signed when APPLE_TEAM_ID names a team, which needs a paid Apple Developer
 * Program membership. Without one the archive is made unsigned and wrapped as
 * an IPA by hand -- Apple's own tooling will not export what it cannot sign,
 * and an unsigned IPA is what a sideloader re-signs anyway.
 */
function buildIos(env, label, version) {
    const workspace = existsSync(join(ROOT, 'ios'))
        ? readdirSync(join(ROOT, 'ios')).find((entry) => entry.endsWith('.xcworkspace'))
        : null;

    if (!workspace) {
        console.error('\nNo .xcworkspace in ios/. Run `npm run prebuild` and try again.\n');
        process.exit(1);
    }

    const scheme = basename(workspace, '.xcworkspace');
    const archive = join(OUTPUT, `${scheme}.xcarchive`);
    rmSync(archive, { recursive: true, force: true });

    const signing = team
        ? ['-allowProvisioningUpdates', `DEVELOPMENT_TEAM=${team}`]
        : ['CODE_SIGNING_ALLOWED=NO', 'CODE_SIGNING_REQUIRED=NO', 'CODE_SIGN_IDENTITY='];

    run(
        'xcodebuild',
        [
            'archive',
            // xcodebuild narrates every clang invocation in full otherwise,
            // which buries the one line that matters when a build fails.
            '-quiet',
            '-workspace', join(ROOT, 'ios', workspace),
            '-scheme', scheme,
            '-configuration', 'Release',
            '-destination', 'generic/platform=iOS',
            '-archivePath', archive,
            ...signing,
        ],
        { env: { ...process.env, ...env } },
    );

    const destination = join(OUTPUT, `paayo-${version}-${label}.ipa`);

    rmSync(destination, { force: true });

    if (team) {
        const plist = join(OUTPUT, 'ExportOptions.plist');

        writeFileSync(plist, exportOptions(team));

        run('xcodebuild', [
            '-exportArchive',
            '-quiet',
            '-archivePath', archive,
            '-exportPath', OUTPUT,
            '-exportOptionsPlist', plist,
            '-allowProvisioningUpdates',
        ]);

        run('mv', [join(OUTPUT, `${scheme}.ipa`), destination]);

        return destination;
    }

    // An IPA is a zip with the .app inside a Payload/ directory and nothing
    // else. exportArchive refuses to produce one without a signing identity, so
    // it is assembled here instead.
    const payload = join(OUTPUT, 'Payload');

    rmSync(payload, { recursive: true, force: true });
    mkdirSync(payload, { recursive: true });

    run('cp', ['-R', join(archive, 'Products/Applications', `${scheme}.app`), payload]);
    run('zip', ['-qry', destination, 'Payload'], { cwd: OUTPUT });
    rmSync(payload, { recursive: true, force: true });

    return destination;
}

function exportOptions(team) {
    return [
        '<?xml version="1.0" encoding="UTF-8"?>',
        '<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">',
        '<plist version="1.0">',
        '<dict>',
        '    <key>method</key><string>development</string>',
        `    <key>teamID</key><string>${team}</string>`,
        '    <key>signingStyle</key><string>automatic</string>',
        '    <key>compileBitcode</key><false/>',
        '    <key>stripSwiftSymbols</key><true/>',
        '</dict>',
        '</plist>',
        '',
    ].join('\n');
}

const options = parseArguments(process.argv.slice(2));
const production = PRODUCTION;
const local = readEnvFile(join(ROOT, '.env'));
const apiUrl = resolveApiUrl(options, production, local);
const label = options.target === 'custom' ? 'custom' : options.target;
const { version } = JSON.parse(readFileSync(join(ROOT, 'package.json'), 'utf8'));
const platforms = options.platform === 'all' ? ['android', 'ios'] : [options.platform];

// Not in PRODUCTION: the membership is a fact about the signing team rather than
// a release setting, so it reaches prebuild through .env the way Expo reads every
// other EXPO_PUBLIC_* value. Resolved here as well, so the banner can say which
// way it went and assertIosCapabilities knows what to expect -- with Expo's own
// precedence, the environment ahead of the file.
const membership =
    process.env.EXPO_PUBLIC_APPLE_DEVELOPER_PROGRAM?.trim() ||
    valueOf(local, 'EXPO_PUBLIC_APPLE_DEVELOPER_PROGRAM');

// Read from .env as well as the environment, the environment winning, like every
// other value here. process.env alone was wrong: nothing loads .env for this
// script -- Expo's CLI does that for its own commands, not for `node
// scripts/build.mjs` -- so a team named in .env was never seen and what looked
// like a signed build silently took the unsigned branch in buildIos.
const team = process.env.APPLE_TEAM_ID?.trim() || valueOf(local, 'APPLE_TEAM_ID');

// NODE_ENV=production is what makes this a release bundle. Every key PRODUCTION
// declares is then set explicitly: to its own value for a production build, and
// to .env's (or empty) otherwise, so a local build cannot inherit a production
// setting. A variable already in the environment outranks any dotenv file, which
// is what makes this the last word.
const env = { NODE_ENV: 'production' };

for (const key of production.keys()) {
    env[key] = options.target === 'production' ? production.get(key) : (local.get(key) ?? '');
}

env.EXPO_PUBLIC_API_URL = apiUrl;

console.log('');
console.log(`  Building  ${platforms.join(' + ')} ${version} (${label})`);
console.log(`  Server    ${apiUrl}`);

// Everything else PRODUCTION governs, so a build that quietly has passkeys off
// is visible here rather than only on the phone.
const governed = [...production.keys()].filter((key) => key !== 'EXPO_PUBLIC_API_URL');
const width = Math.max(10, ...governed.map((key) => key.replace('EXPO_PUBLIC_', '').length));

for (const key of governed) {
    console.log(`  ${key.replace('EXPO_PUBLIC_', '').padEnd(width)}  ${env[key] || '(off)'}`);
}

// The other half of every paid capability. With it off, passkeys and push are
// quietly absent rather than broken, which is exactly what needs saying here.
console.log(`  ${'MEMBERSHIP'.padEnd(width)}  ${membership ? 'paid team' : '(off)'}`);

// An unsigned IPA installs nowhere and honours no entitlement, and the branch
// that produces one looks just as successful as the branch that does not.
if (platforms.includes('ios')) {
    console.log(`  ${'SIGNING'.padEnd(width)}  ${team ?? '(unsigned)'}`);
}

console.log('');

if (options.dryRun) {
    // A dry run still reads what a previous prebuild wrote: "this would ship
    // passkeys with no entitlement" is worth knowing before a ten-minute
    // archive, and reading one file is not work.
    if (platforms.includes('ios')) {
        assertIosCapabilities(env, membership);
    }

    process.exit(0);
}

mkdirSync(OUTPUT, { recursive: true });
ensureNativeProjects(platforms, options.prebuild, env);

if (platforms.includes('ios')) {
    assertIosCapabilities(env, membership);
}

const artifacts = platforms.map((platform) =>
    platform === 'android' ? buildAndroid(env, label, version) : buildIos(env, label, version),
);

console.log('');

for (const artifact of artifacts) {
    console.log(`  ${artifact.replace(`${ROOT}/`, '')}`);
}

console.log(`\n  Pointed at ${apiUrl}\n`);
