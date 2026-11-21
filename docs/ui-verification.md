# UI refinement verification — 2026-11-21

Scope: public UI from the owner's local DESIGN_PLAN.md. No admin/business API rewrite,
no new application dependencies, no external assets or automatic production deployment.

## Verified locally

- TypeScript and ESLint: pass.
- Unit/integration suite: 99 pass.
- Build: Cloudflare dry-run passes.
- Browser suite: 28 scenarios, including 320/390/768/1440 layouts, copy-link, empty-search
  recovery, keyboard search focus, card geometry and official player mock regressions.
- Screenshots inspected at those four widths, including missing-poster fallback.
- Independent visual/code review: no blockers; requested stopping active edge scroll
  on reduced-motion change. Implemented and browser regression added.
- Skill validation: `quick_validate.py` passes using an ephemeral PyYAML environment.

## Lighthouse 13.6.0

Mobile lab run against local production Worker entry (ephemeral D1, synthetic edition),
Playwright Chromium in headless mode, Lighthouse default mobile simulation.

| Metric              |      Result |
| ------------------- | ----------: |
| Performance         |         100 |
| Accessibility       |         100 |
| Best practices      |         100 |
| SEO                 |         100 |
| LCP                 | 0.8 seconds |
| CLS                 |       0.015 |
| Total blocking time |        0 ms |

This is **not live-provider QA**, field Core Web Vitals, an INP measurement, or proof of
all-device accessibility. Synthetic Twitch clips had no external posters; mobile playback
uses the original-source fallback. No before/after lab speed improvement is claimed.
Lighthouse's card visible-label mismatch was corrected by retaining the natural link name.
Remaining advisory opportunities include legacy logo image compression and render-blocking
CSS; public no-store behavior remains unchanged (no cache/auth scope expansion).

Approximate source CSS gzip budget: 7,284 → 8,660 bytes (+1,376 bytes), measured over base
style source versus base + refinement module. This is a source-budget comparison, not a
network-transfer measurement. No font, animation framework or 3D runtime added.

## Artifacts

Screenshots are generated under ignored `test-results/design-*/design-{width}.png`.
Raw local Lighthouse JSON: `/tmp/gtaklips-design-lighthouse-final.json` (ephemeral).
CI uploads Playwright reports as usual. Re-run with `npm run test:e2e`.

## Owner QA after merge

Check actual posters and legibility, X click-to-load, Twitch/YouTube preview, keyboard,
and touch on a real mobile device. Review with authentic content before public deployment.
