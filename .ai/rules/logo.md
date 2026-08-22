---
paths:
  - 'src/lib/logo.ts'
  - 'src/components/app-logo.tsx'
  - 'scripts/sync-logo.mjs'
  - 'assets/images/paayo-logo.svg'
---

# The Paayo mark

## `src/lib/logo.ts` is generated, never authored
`assets/images/paayo-logo.svg` is the artwork. The TypeScript beside it is
output from `scripts/sync-logo.mjs`; do not hand-edit it, and do not paste a
new export straight into it:

```sh
node scripts/sync-logo.mjs [path-to-svg]   # defaults to assets/images/paayo-logo.svg
```

The path data passes through untouched, so the two cannot disagree about the
drawing. What the script exists for is `LOGO_VIEW_BOX`: the mark is drawn on a
1000x1000 canvas it does not fill, and a caller asking for 56pt wants 56pt of
ink, not 56pt of mostly padding. Those bounds solve each curve's turning points
rather than boxing its control points, which sit outside the ink -- measuring
them by eye gives a mark that is quietly too small and slightly off-centre.

The script accepts absolute `M`/`C`/`Z` and throws on anything else. A new
export using other commands needs the walker taught them, not the check removed.

## The mark is green. The brand is not.
The artwork is `#00B14F` green with a `#F59E0C` dot; the live brand token is
signal amber, `212 126 29`. That is not an oversight to reconcile -- see
`.ai/rules/tokens.md`, where the same green was proposed as the brand colour and
was never adopted. Two consequences:

- **Do not re-token the palette from the artwork.** Colours come from the
  console's `app.css` through `sync-tokens.mjs`, and from nowhere else.
- **Do not tint the mark from the palette either.** It carries its own fills
  and is the same in both themes. The white counter is punched out of the green
  it sits inside, never seen against the page, so there is no dark variant to
  add and no `currentColor` to inherit -- `react-native-svg` has neither.

If the brand ever does move to the green, that is a change to the console's
tokens first, and this file follows.

## `AppLogo` takes a height, not a size
Every other icon here is square and takes `size`. The pin is roughly 0.7 as
wide as it is tall, so holding one side to a square squashes it. The width is
derived from `LOGO_ASPECT`; pass only the height.
