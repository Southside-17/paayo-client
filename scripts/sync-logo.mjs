#!/usr/bin/env node
/**
 * Regenerate src/lib/logo.ts from the Paayo artwork.
 *
 * The path data is copied through untouched, so a new export from the designer
 * needs no conversion. What has to be computed is the view box: the mark is
 * drawn on a 1000x1000 canvas it does not fill, and a logo asked for at 56pt
 * should be 56pt of ink rather than 56pt of mostly padding. Measuring that by
 * hand is how a copy rots, which is why this is a script and not a comment.
 *
 * Usage: node scripts/sync-logo.mjs [path-to-svg]
 */
import { readFileSync, writeFileSync } from 'node:fs';

const SOURCE = process.argv[2] ?? 'assets/images/paayo-logo.svg';
const OUTPUT = 'src/lib/logo.ts';

/** Split path data into commands and numbers, dropping the separators. */
function tokenize(data) {
    return data.match(/[A-Za-z]|-?\d*\.?\d+(?:e-?\d+)?/g) ?? [];
}

/**
 * Walk one path's absolute M/C/Z commands, applying its translate.
 *
 * The artwork uses no other command. Anything else is a new export shaped
 * differently enough that measuring it silently would be the wrong answer.
 */
function segments(data, [dx, dy]) {
    const tokens = tokenize(data);
    const drawn = [];
    let index = 0;
    let cursor = [0, 0];
    let start = [0, 0];

    while (index < tokens.length) {
        const command = tokens[index];

        if (command === 'M') {
            cursor = [Number(tokens[index + 1]) + dx, Number(tokens[index + 2]) + dy];
            start = cursor;
            drawn.push({ from: cursor, points: [] });
            index += 3;
        } else if (command === 'C') {
            index += 1;
            const points = [];

            while (index < tokens.length && !/[A-Za-z]/.test(tokens[index])) {
                points.push([Number(tokens[index]) + dx, Number(tokens[index + 1]) + dy]);
                index += 2;
            }

            for (let at = 0; at < points.length; at += 3) {
                const curve = points.slice(at, at + 3);
                drawn.push({ from: cursor, points: curve });
                cursor = curve[2];
            }
        } else if (command === 'Z' || command === 'z') {
            cursor = start;
            index += 1;
        } else {
            throw new Error(`${SOURCE}: unsupported path command "${command}"`);
        }
    }

    return drawn;
}

/**
 * The span one cubic covers on one axis.
 *
 * Its control points are not on the curve, so a box drawn around them is
 * looser than the ink. The turning points are the roots of the derivative.
 */
function span(p0, p1, p2, p3) {
    const values = [p0, p3];
    const a = -3 * p0 + 9 * p1 - 9 * p2 + 3 * p3;
    const b = 6 * p0 - 12 * p1 + 6 * p2;
    const c = -3 * p0 + 3 * p1;
    const roots = [];

    if (Math.abs(a) < 1e-12) {
        if (Math.abs(b) > 1e-12) {
            roots.push(-c / b);
        }
    } else {
        const discriminant = b * b - 4 * a * c;

        if (discriminant >= 0) {
            const root = Math.sqrt(discriminant);
            roots.push((-b + root) / (2 * a), (-b - root) / (2 * a));
        }
    }

    for (const t of roots) {
        if (t > 0 && t < 1) {
            const m = 1 - t;
            values.push(m ** 3 * p0 + 3 * m * m * t * p1 + 3 * m * t * t * p2 + t ** 3 * p3);
        }
    }

    return [Math.min(...values), Math.max(...values)];
}

const svg = readFileSync(SOURCE, 'utf8');
const shapes = [...svg.matchAll(/<path\s+d="(.*?)"\s+fill="(.*?)"\s+transform="translate\(([-\d.]+),\s*([-\d.]+)\)"/gs)].map(
    ([, d, fill, dx, dy]) => ({ d: d.trim(), fill, translate: [Number(dx), Number(dy)] }),
);

if (shapes.length === 0) {
    throw new Error(`${SOURCE}: found no <path> with a fill and a translate.`);
}

const bounds = { left: Infinity, top: Infinity, right: -Infinity, bottom: -Infinity };

for (const shape of shapes) {
    for (const { from, points } of segments(shape.d, shape.translate)) {
        if (points.length === 0) {
            bounds.left = Math.min(bounds.left, from[0]);
            bounds.right = Math.max(bounds.right, from[0]);
            bounds.top = Math.min(bounds.top, from[1]);
            bounds.bottom = Math.max(bounds.bottom, from[1]);
            continue;
        }

        const [left, right] = span(from[0], points[0][0], points[1][0], points[2][0]);
        const [top, bottom] = span(from[1], points[0][1], points[1][1], points[2][1]);

        bounds.left = Math.min(bounds.left, left);
        bounds.right = Math.max(bounds.right, right);
        bounds.top = Math.min(bounds.top, top);
        bounds.bottom = Math.max(bounds.bottom, bottom);
    }
}

const round = (value) => Number(value.toFixed(2));
const left = round(bounds.left);
const top = round(bounds.top);
const width = round(bounds.right - bounds.left);
const height = round(bounds.bottom - bounds.top);

const literals = shapes
    .map(({ d, fill, translate }) =>
        `    { d: '${d}', fill: '${fill}', transform: 'translate(${translate[0]},${translate[1]})' },`)
    .join('\n');

writeFileSync(OUTPUT, `/*
 * GENERATED by scripts/sync-logo.mjs from ${SOURCE}. Do not edit by hand.
 */

/** The tight bounds of the ink, so a height asked for is a height drawn. */
export const LOGO_VIEW_BOX = '${left} ${top} ${width} ${height}';

/** How much narrower than tall the mark is, from those same bounds. */
export const LOGO_ASPECT = ${width} / ${height};

/** One filled path of the mark, painted in the order they are listed. */
export type LogoShape = { d: string; fill: string; transform: string };

/**
 * The mark carries its own colours rather than taking them from the palette.
 * It is one fixed thing in both themes: the white counter sits against the
 * green it is punched out of, never against the page, so it needs no dark
 * variant. See .ai/rules/logo.md before reaching for a token here.
 */
export const LOGO_SHAPES: LogoShape[] = [
${literals}
];
`);

console.log(`Wrote ${OUTPUT}: ${shapes.length} paths, view box ${left} ${top} ${width} ${height}.`);
