#!/usr/bin/env node
/**
 * Run an Android command with the toolchain Gradle needs pointed at.
 *
 * `npm run android` goes through this rather than calling `expo run:android`
 * directly, because Gradle without ANDROID_HOME reports only "SDK location not
 * found" -- which reads like a broken machine and is only a missing variable.
 * See scripts/lib/android-env.mjs for why each half is needed.
 */
import { spawn } from 'node:child_process';

import { announceAndroidEnv, resolveAndroidEnv } from './lib/android-env.mjs';

const [command, ...args] = process.argv.slice(2);

if (!command) {
    console.error('with-android-env: nothing to run.');
    process.exit(1);
}

const android = resolveAndroidEnv();

announceAndroidEnv(android);

const child = spawn(command, args, {
    stdio: 'inherit',
    env: { ...process.env, ...android.env },
});

child.on('exit', (code) => process.exit(code ?? 1));
