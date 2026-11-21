---
name: gtaklips-ui
description: Modify GTAKlips public discovery UI while preserving official media adapters, compact mobile navigation and the project's visual system.
---

Read `DESIGN_SYSTEM.md` in the repository root before public UI changes.

- Public rendering: `src/catalog.ts` and the public branch of `page()` in `src/index.ts`.
  Scope visual rules to `.public-page`; do not restyle admin forms accidentally.
- Base CSS: `src/style.ts`; design refinements: `src/design-style.ts`.
- `src/preview.ts` owns the single active media session and provider lifecycle. Preserve
  its data attributes, focus handoff, fixed geometry, viewport cancellation and source fallback.
- Twitch requires a 400×300 player. Do not shrink its iframe into narrow cards or promise
  autoplay on mobile. X requires explicit interaction; no scraping or rehosting to bypass this.
- The edition contains at most ten clips: use existing row distribution, not virtualization.
  No invented popularity, live counters or trending badges without actual data.
- Keep creator credit, labels and full source URLs; do not encode sensitive state as color alone.
- Validate with typecheck/lint/build, existing preview/grid E2E and design discovery tests.
  Capture 320/390/768/1440px layouts and inspect actual screenshots. Report lab measurement
  conditions separately from live-provider/field performance.
