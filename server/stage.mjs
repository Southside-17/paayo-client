#!/usr/bin/env node
import { execFileSync } from 'node:child_process';
import { cpSync, existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { randomUUID } from 'node:crypto';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const project = join(here, '..');

const source = process.argv[2] ?? '/export';
const target = process.argv[3] ?? '/srv/updates';

const PLATFORMS = ['ios', 'android'];

/** Ask expo-updates for the runtime fingerprint of one platform. */
function fingerprint(platform) {
    const out = execFileSync(
        'npx',
        ['expo-updates', 'fingerprint:generate', '--platform', platform],
        { cwd: project, encoding: 'utf8', stdio: ['ignore', 'pipe', 'inherit'] },
    );

    const parsed = JSON.parse(out.slice(out.indexOf('{'), out.lastIndexOf('}') + 1));

    if (!parsed.hash) {
        throw new Error(`no fingerprint came back for ${platform}`);
    }

    return parsed.hash;
}

// Anything carried forward from an earlier image lands first, so this export can
// only ever add to it. Runtime versions are pruned by editing that directory,
// never by a build silently dropping one.
const carried = join(here, 'bundles');
const releases = [];

if (existsSync(join(carried, 'index.json'))) {
    releases.push(...JSON.parse(readFileSync(join(carried, 'index.json'), 'utf8')).releases);
    cpSync(join(carried, 'exports'), join(target, 'exports'), { recursive: true });
}

const id = new Date().toISOString().replace(/[-:.]/g, '').slice(0, 15);
mkdirSync(join(target, 'exports'), { recursive: true });
cpSync(source, join(target, 'exports', id), { recursive: true });

const createdAt = new Date().toISOString();

for (const platform of PLATFORMS) {
    releases.push({
        id: randomUUID(),
        createdAt,
        platform,
        runtimeVersion: fingerprint(platform),
        export: id,
        rollBackToEmbedded: false,
    });
}

writeFileSync(
    join(target, 'index.json'),
    JSON.stringify(
        {
            minimum: JSON.parse(readFileSync(join(here, 'minimum.json'), 'utf8')),
            releases,
        },
        null,
        2,
    ),
);

console.log(`staged export ${id} for ${PLATFORMS.join(', ')} (${releases.length} releases total)`);
