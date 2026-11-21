# GTAKlips visual system

## Direction

Cinematic discovery, not a dashboard. Graphite surfaces, restrained lime accents,
large editorial titles, consistent poster-led cards and prominent creator credit.
Keep content first: no fabricated view counts, trending badges or popularity.

## Tokens and composition

Public tokens live in `src/design-style.ts`; this layer follows `src/style.ts`.

- Canvas `#0b0d12`; surface `#151923`; text `#f5f6f8`; secondary `#adb4c3`.
- Accent `#d5ff65`: primary actions, active filters and focus rings.
- Card radius 16px, player 18px, controls 10px, navigation/filter pills 24px.
- System typography (no external font requests): title 38–70px desktop, 36–52px mobile;
  body 16px; metadata 12px. Avoid oversized marketing copy pushing clips down.
- Content gutters 16–76px fluid; header sticky with translucent fallback and bounded blur.
- Preserve provider player dimensions: Twitch needs at least 400×300; its mobile source
  fallback remains deliberate. YouTube and X have their own responsive adapters.

## Components

- Public header retains selection/archive/search at 320px; two rows if needed.
- Hero has edition title, truthful clip count, featured creator/platform, clear original
  source action, preview where supported, and copy-link feedback.
- Search and category filters share a surface. Filter links remain server-rendered,
  functional without JS, with a clear recovery link for no results.
- Equal cards keep two-line title/context and creator badge. Keep complete accessible
  source labels and full original content available at the source; do not alter editorial data.
- Compact footer keeps original-source/privacy explanation and archive navigation.
- Empty/missing images use the existing branded fallback, not a broken-image icon.

## Motion and playback

Reuse existing official adapters, visibility observers and single-active-player logic.
Desktop preview is muted where supported; X remains click-to-load, not promised autoplay.
Respect reduced-motion and Save-Data. Do not introduce animation loops or remote libraries
for decoration. Disable automatic edge scrolling under reduced-motion; keyboard buttons
and native touch scroll remain available. Pause carousel animation while the page is hidden.

## Accessibility and performance

Maintain visible focus, real button/link semantics, labelled search, live status feedback,
44px primary interaction targets and no horizontal document overflow at 320px.
Reserve poster/player geometry; lazy-load card posters and prioritize the hero image.
No extra runtime packages, remote fonts, assets or scripts. No virtualization for ≤10 clips.
Use real-browser regression tests, screenshots at 320/390/768/1440px and Lighthouse.
Lab audits of synthetic content are not field Core Web Vitals or proof of live embed performance.

## References and licensing

DESIGN_PLAN.md supplied by the owner is the brief (kept local/untracked in the original checkout).
Navbar Gallery and Supahero were consulted as navigation/hero reference catalogs, not as
copied code or assets. Their text extraction is not a visual audit of all examples.
All implementation here is original CSS/HTML using existing project branding. No third-party
asset licenses or paid component subscriptions added.

## Immersive card refinement

The resting card is full-bleed: its poster fills the surface, with creator/title/context
on a dark gradient and a progressively masked blur. The original source remains a link.
Desktop hover morphs into an anchored player surface without reflowing the rail. Landscape
width grows by at most 128px (Twitch may require 402px outer width); portrait width grows
by at most 24px, height by at most 120px, capped at 560px and the available viewport.
Square metadata gets a square surface. Unknown orientation uses the landscape fallback;
we do not infer video orientation from an arbitrary social thumbnail.

The active card's original content is visually hidden to avoid duplicated labels under
the player. Neighbours remain reachable. The player has only a close control and one
original-source link; YouTube's extra play action appears only after a blocked-start delay.
YouTube PLAYING fades the text overlay out; pause/end restore it. Twitch clips have no
playback-state API here, so their overlay fades on iframe load, not verified playback.
Official provider controls remain intact, and X loads its complete scrollable post only
on explicit action. We do not crop the X post or promise X autoplay. Real embedded video
may still letterbox according to the provider and available orientation metadata.
