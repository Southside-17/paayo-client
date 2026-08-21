# Paayo Mobile — developer handoff

Production-ready React/TSX for the Paayo **client mobile** experience, written to drop
into the existing Laravel + Inertia app under `resources/js`. These compose the app's
**own** `@/components/ui/*` primitives (Button, Badge, StatusPill, Card,
VerticalTimeline, Input, Label) and `lucide-react` icons — no new design language, just
the mobile screens assembled from what the app already ships.

> **Files carry a trailing `.txt` (e.g. `live-tracking-card.tsx.txt`)** so this design-
> system project's in-browser bundler ignores them — they're code for the *other* repo,
> not components for this one. **Rename each back to `.tsx`** (drop the `.txt`) when you
> copy them into the app.

## What's here

```
handoff/paayo-mobile/
├── components/
│   ├── live-tracking-card.tsx.txt   → the "on the way" hero (green gradient, ETA, tech, actions)
│   ├── service-grid.tsx.txt         → 3-col quick-book service tiles
│   └── request-row.tsx.txt          → a service-request list row with StatusPill
├── pages/
│   ├── client/
│   │   ├── mobile-home.tsx.txt      → client home: greeting + live card + services + next visits
│   │   └── mobile-request-detail.tsx.txt → SR detail: status timeline + estimate + actions
│   └── auth/
│       └── mobile-login.tsx.txt     → social + email login (mobile layout)
└── README.md
```

## How to wire it

0. Drop the `.txt` suffix from each file so it's a real `.tsx` again.
1. Copy `components/*` into `resources/js/components/client/` (or wherever you keep
   client-specific components).
2. Copy the `pages/*` files into the matching `resources/js/pages/*` locations and hand
   them the Inertia props they expect (see each file's `Props` type). They already use the
   app's `ClientLayout` / `AuthLayout` conventions and `BottomNav` (`@/components/bottom-nav`).
3. Import paths use the app's `@/` alias and existing UI primitives — nothing new to install.

## Brand color

These screens are **token-driven** — they use `bg-brand`, `text-brand-strong`,
`bg-brand-soft`, `bg-card`, `text-muted-foreground`, etc. To match the **Paayo logo**
(green pin + orange dot) rather than the legacy teal, update `resources/css/app.css`:

```css
:root {
  --brand: #00b14f;          /* logo green — was teal #0e7c8a */
  --brand-soft: #e6f7ee;
  --brand-strong: #009444;
  --brand-deep: #00632d;
  --primary: #00b14f;
  --ring: #00b14f;
  /* new: the logo's orange "dot" accent used by live-tracking-card */
  --spark: #f59e0c;
  --spark-soft: #fef3e2;
}
```

(The full token set — light + dark — lives in the design system's `tokens/colors.css`.)
If you keep teal, the screens still work; they simply render teal.

## Notes / assumptions

- Data shapes (`ServiceRequest`, `TrackingStep`) are illustrative — align field names with
  your `ServiceRequestResource` / `WorkOrderResource` payloads.
- Money is formatted as PHP peso via `Intl.NumberFormat('en-PH')`.
- Icons: `lucide-react` (matches `components.json` → `"iconLibrary": "lucide"`).
- Touch targets are ≥44px; screens assume `pb-20` content padding to clear the `BottomNav`
  (already handled by `ClientLayout`).
