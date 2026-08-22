#!/usr/bin/env node
/**
 * Rasterise the Paayo artwork into the app's PNG icons.
 *
 * No SVG rasteriser is installed and none is being added for six files, so
 * this fills the artwork's outlines directly: flatten each curve to a
 * polyline, scanline the result four times per output row, and take exact
 * coverage across x. That is supersampling vertically and analytic
 * antialiasing horizontally, which is ample for shapes this smooth.
 *
 * Run it after changing the artwork, then `expo prebuild` and rebuild -- icons
 * are native resources and no Metro reload will pick them up.
 *
 * Usage: node scripts/render-icons.mjs [path-to-svg]
 */
import { deflateSync } from 'node:zlib';
import { readFileSync, writeFileSync } from 'node:fs';

import palette from '../src/theme/palette.js';
import { measure, readShapes, roleOf, toPolygons } from './lib/svg-mark.mjs';

const SOURCE = process.argv[2] ?? 'assets/images/paayo-logo.svg';
const OUT = 'assets/images/';

const WHITE = [255, 255, 255];
const BLACK = [0, 0, 0];
const SUBSAMPLES = 4;

const shapes = readShapes(readFileSync(SOURCE, 'utf8'));
const ink = measure(shapes);

/** Coverage in 0..1 per pixel for one shape, nonzero winding. */
function coverage(shape, size, scale, offset) {
    const cover = new Float32Array(size * size);
    const edges = [];

    for (const ring of toPolygons(shape, scale, offset)) {
        for (let i = 0; i < ring.length - 1; i += 1) {
            if (ring[i][1] !== ring[i + 1][1]) {
                edges.push([ring[i], ring[i + 1]]);
            }
        }
    }

    if (edges.length === 0) {
        return cover;
    }

    const weight = 1 / SUBSAMPLES;
    let first = Infinity;
    let last = -Infinity;

    for (const [a, b] of edges) {
        first = Math.min(first, a[1], b[1]);
        last = Math.max(last, a[1], b[1]);
    }

    for (let py = Math.max(0, Math.floor(first)); py < Math.min(size, Math.ceil(last)); py += 1) {
        const row = py * size;

        for (let s = 0; s < SUBSAMPLES; s += 1) {
            const y = py + (s + 0.5) / SUBSAMPLES;
            const crossings = [];

            for (const [[x0, y0], [x1, y1]] of edges) {
                if ((y0 <= y && y < y1) || (y1 <= y && y < y0)) {
                    const t = (y - y0) / (y1 - y0);
                    crossings.push([x0 + t * (x1 - x0), y1 > y0 ? 1 : -1]);
                }
            }

            if (crossings.length === 0) {
                continue;
            }

            crossings.sort((a, b) => a[0] - b[0]);

            let winding = 0;
            let start = 0;

            for (const [x, direction] of crossings) {
                if (winding === 0) {
                    start = x;
                }

                winding += direction;

                if (winding === 0) {
                    span(cover, row, size, start, x, weight);
                }
            }
        }
    }

    return cover;
}

/** Add one horizontal run, its two end pixels covered only fractionally. */
function span(cover, row, size, from, to, weight) {
    const left = Math.max(0, from);
    const right = Math.min(size, to);

    if (right <= left) {
        return;
    }

    const first = Math.floor(left);
    const last = Math.floor(right);

    if (first === last) {
        cover[row + first] += (right - left) * weight;

        return;
    }

    cover[row + first] += (first + 1 - left) * weight;

    for (let x = first + 1; x < last; x += 1) {
        cover[row + x] += weight;
    }

    if (last < size) {
        cover[row + last] += (right - last) * weight;
    }
}

/** Paint one colour through its coverage, source-over. */
function paint(canvas, cover, [r, g, b]) {
    for (let i = 0; i < cover.length; i += 1) {
        const a = Math.min(1, cover[i]);

        if (a <= 0) {
            continue;
        }

        const at = i * 4;
        const rest = 1 - a;

        canvas[at] = Math.round(r * a + canvas[at] * rest);
        canvas[at + 1] = Math.round(g * a + canvas[at + 1] * rest);
        canvas[at + 2] = Math.round(b * a + canvas[at + 2] * rest);
        canvas[at + 3] = Math.round(255 * a + canvas[at + 3] * rest);
    }
}

/** Punch coverage back out of what is already painted. */
function erase(canvas, cover) {
    for (let i = 0; i < cover.length; i += 1) {
        const a = Math.min(1, cover[i]);

        if (a > 0) {
            canvas[i * 4 + 3] = Math.round(canvas[i * 4 + 3] * (1 - a));
        }
    }
}

/** A fully opaque square of one colour. */
function solid(size, [r, g, b]) {
    const canvas = new Uint8Array(size * size * 4);

    for (let i = 0; i < size * size; i += 1) {
        canvas.set([r, g, b, 255], i * 4);
    }

    return canvas;
}

/**
 * Draw the mark at `fraction` of the canvas height, centred on a square.
 *
 * `mono` is Android's themed icon: one flat silhouette it tints itself, so the
 * counter is punched back out for the P to still read and the dot returned to
 * the middle of the hole.
 */
function render(size, fraction, background, mono = false) {
    const scale = (size * fraction) / ink.height;
    const offset = [
        size / 2 - (ink.left + ink.width / 2) * scale,
        size / 2 - (ink.top + ink.height / 2) * scale,
    ];
    const canvas = background ? solid(size, background) : new Uint8Array(size * size * 4);
    const cover = (shape) => coverage(shape, size, scale, offset);

    if (!mono) {
        for (const shape of shapes) {
            paint(canvas, cover(shape), brand(shape));
        }

        return canvas;
    }

    const [pin, counter, dot] = shapes;

    paint(canvas, cover(pin), BLACK);
    erase(canvas, cover(counter));
    paint(canvas, cover(dot), BLACK);

    return canvas;
}

/**
 * The colour one shape is drawn in, from the light palette.
 *
 * A launcher icon is one file with no theme to follow, and it sits on the
 * white ground below, so it takes the light values in both. Android's themed
 * icon is the dark case and it is handled separately, as a silhouette.
 */
function brand(shape) {
    const colour = palette.light[roleOf(shape.fill)];

    return [1, 3, 5].map((at) => parseInt(colour.slice(at, at + 2), 16));
}

const CRC = Int32Array.from({ length: 256 }, (_, n) => {
    let c = n;

    for (let k = 0; k < 8; k += 1) {
        c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    }

    return c;
});

function crc32(buffer) {
    let c = -1;

    for (const byte of buffer) {
        c = CRC[(c ^ byte) & 0xff] ^ (c >>> 8);
    }

    return (c ^ -1) >>> 0;
}

function chunk(kind, data) {
    const body = Buffer.concat([Buffer.from(kind, 'ascii'), Buffer.from(data)]);
    const length = Buffer.alloc(4);
    const check = Buffer.alloc(4);

    length.writeUInt32BE(data.length);
    check.writeUInt32BE(crc32(body));

    return Buffer.concat([length, body, check]);
}

function writePng(path, canvas, size) {
    const stride = size * 4;
    const raw = Buffer.alloc(size * (stride + 1));

    for (let y = 0; y < size; y += 1) {
        raw[y * (stride + 1)] = 0;
        Buffer.from(canvas.buffer, y * stride, stride).copy(raw, y * (stride + 1) + 1);
    }

    const header = Buffer.alloc(13);
    header.writeUInt32BE(size, 0);
    header.writeUInt32BE(size, 4);
    header.set([8, 6, 0, 0, 0], 8);

    writeFileSync(path, Buffer.concat([
        Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
        chunk('IHDR', header),
        chunk('IDAT', deflateSync(raw, { level: 9 })),
        chunk('IEND', Buffer.alloc(0)),
    ]));
}

/*
 * An iOS icon may carry no transparency, so it gets the ground the mark was
 * drawn for. Android's adaptive icon supplies its own and crops both layers to
 * a circle 66/108 of the canvas across, so a mark this tall has to be small
 * enough that its diagonal fits inside that circle -- hence 0.48, where the
 * square icon takes 0.76.
 */
const ICONS = [
    ['icon.png', 1024, () => render(1024, 0.76, WHITE)],
    ['android-icon-foreground.png', 512, () => render(512, 0.48, null)],
    ['android-icon-background.png', 512, () => solid(512, WHITE)],
    ['android-icon-monochrome.png', 432, () => render(432, 0.48, null, true)],
    ['splash-icon.png', 512, () => render(512, 0.88, null)],
    ['favicon.png', 64, () => render(64, 0.86, null)],
];

for (const [name, size, build] of ICONS) {
    writePng(OUT + name, build(), size);
    console.log(`Wrote ${OUT}${name}: ${size}x${size}.`);
}
