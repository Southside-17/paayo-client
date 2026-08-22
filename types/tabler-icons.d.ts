/**
 * Type the per-icon subpaths @tabler/icons-react-native fails to.
 *
 * Its exports map sends `./*` types to `./dist/icons/*.d.ts`, and the
 * declarations actually sit one directory deeper, at
 * `./dist/icons/icons/*.d.ts`. So every deep import resolves at runtime and
 * lands as an implicit any at build time. This is an upstream packaging bug in
 * 3.46.0, not a choice; delete this file the day it is fixed.
 *
 * No top-level import, or the file becomes a module and the wildcard turns
 * into an augmentation of a module that does not exist.
 */
declare module '@tabler/icons-react-native/*' {
    const glyph: import('@tabler/icons-react-native').Icon;

    export default glyph;
}
