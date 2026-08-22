/**
 * Reading the Paayo artwork: parse it, measure it, flatten it.
 *
 * Shared by scripts/sync-logo.mjs, which needs the bounds, and
 * scripts/render-icons.mjs, which needs the outlines. Neither is worth its own
 * copy of the curve maths.
 *
 * The artwork uses absolute M/C/Z and nothing else. Anything further is a new
 * export shaped differently enough that measuring it quietly would be the
 * wrong answer, so this throws instead.
 */

/**
 * Which palette token each colour in the artwork stands for.
 *
 * The mark is drawn in green because that is what the designer sent, and the
 * app draws it in the brand's amber because that is what the brand is. So the
 * SVG is the source of the *geometry*, and the colour is ours -- see
 * .ai/rules/logo.md. Keying this on the artwork's own hex means a re-export in
 * new colours throws here rather than quietly picking a token for itself.
 */
const ROLES = {
    '#00B14F': 'brand',
    '#FEFEFE': 'brand-foreground',
    '#F59E0C': 'brand',
};

/** The palette token one of the artwork's fills stands for. */
export function roleOf(fill) {
    const role = ROLES[fill.toUpperCase()];

    if (!role) {
        throw new Error(
            `the artwork fills a path with ${fill}, which stands for no palette token. `
            + 'Decide what it means and add it to ROLES in scripts/lib/svg-mark.mjs.',
        );
    }

    return role;
}

/** Every filled path in the file, with its translate read off. */
export function readShapes(svg) {
    const found = [...svg.matchAll(
        /<path\s+d="(.*?)"\s+fill="(.*?)"\s+transform="translate\(\s*([-\d.]+)\s*,\s*([-\d.]+)\s*\)"/gs,
    )];

    if (found.length === 0) {
        throw new Error('found no <path> carrying both a fill and a translate');
    }

    return found.map(([, d, fill, dx, dy]) => ({
        d: d.trim(),
        fill,
        translate: [Number(dx), Number(dy)],
    }));
}

/**
 * One shape's closed subpaths, translate applied.
 *
 * Each subpath is a start point and the cubics that follow it; `Z` ends one,
 * and the closing straight line back to the start is implied.
 */
export function subpaths({ d, translate: [dx, dy] }) {
    const tokens = d.match(/[A-Za-z]|-?\d*\.?\d+(?:e-?\d+)?/g) ?? [];
    const paths = [];
    let current = null;
    let index = 0;

    const shift = (at) => [Number(tokens[at]) + dx, Number(tokens[at + 1]) + dy];

    while (index < tokens.length) {
        const command = tokens[index];

        if (command === 'M') {
            current = { start: shift(index + 1), curves: [] };
            paths.push(current);
            index += 3;
        } else if (command === 'C') {
            index += 1;
            const points = [];

            while (index < tokens.length && !/[A-Za-z]/.test(tokens[index])) {
                points.push(shift(index));
                index += 2;
            }

            for (let at = 0; at < points.length; at += 3) {
                current.curves.push(points.slice(at, at + 3));
            }
        } else if (command === 'Z' || command === 'z') {
            current = null;
            index += 1;
        } else {
            throw new Error(`unsupported path command "${command}"`);
        }
    }

    return paths;
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

/** The tight bounds of the ink across every shape. */
export function measure(shapes) {
    let left = Infinity;
    let top = Infinity;
    let right = -Infinity;
    let bottom = -Infinity;

    for (const shape of shapes) {
        for (const { start, curves } of subpaths(shape)) {
            let cursor = start;
            left = Math.min(left, cursor[0]);
            right = Math.max(right, cursor[0]);
            top = Math.min(top, cursor[1]);
            bottom = Math.max(bottom, cursor[1]);

            for (const curve of curves) {
                const [x0, x1] = span(cursor[0], curve[0][0], curve[1][0], curve[2][0]);
                const [y0, y1] = span(cursor[1], curve[0][1], curve[1][1], curve[2][1]);

                left = Math.min(left, x0);
                right = Math.max(right, x1);
                top = Math.min(top, y0);
                bottom = Math.max(bottom, y1);
                cursor = curve[2];
            }
        }
    }

    const round = (value) => Number(value.toFixed(2));

    return {
        left: round(left),
        top: round(top),
        width: round(right - left),
        height: round(bottom - top),
    };
}

/** How closely a flattened curve has to follow the real one, in device pixels. */
const FLATNESS = 0.2;

/**
 * One shape as closed polygons in device space.
 *
 * Segment count follows the control hull, so a curve is subdivided as finely
 * as the size being drawn needs and no finer.
 */
export function toPolygons(shape, scale, [ox, oy]) {
    const place = ([x, y]) => [x * scale + ox, y * scale + oy];

    return subpaths(shape).map(({ start, curves }) => {
        let cursor = place(start);
        const points = [cursor];

        for (const curve of curves) {
            const [p1, p2, p3] = curve.map(place);
            const hull = Math.hypot(p1[0] - cursor[0], p1[1] - cursor[1])
                + Math.hypot(p2[0] - p1[0], p2[1] - p1[1])
                + Math.hypot(p3[0] - p2[0], p3[1] - p2[1]);
            const steps = Math.max(2, Math.min(160, Math.ceil(Math.sqrt(hull / FLATNESS))));

            for (let step = 1; step <= steps; step += 1) {
                const t = step / steps;
                const m = 1 - t;

                points.push([
                    m ** 3 * cursor[0] + 3 * m * m * t * p1[0] + 3 * m * t * t * p2[0] + t ** 3 * p3[0],
                    m ** 3 * cursor[1] + 3 * m * m * t * p1[1] + 3 * m * t * t * p2[1] + t ** 3 * p3[1],
                ]);
            }

            cursor = p3;
        }

        points.push(points[0]);

        return points;
    });
}
