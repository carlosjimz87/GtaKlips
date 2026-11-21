import { designCss } from "./design-style";
export const css =
  `
:root {
  color-scheme: dark;
  --bg: #101216;
  --panel: #1b1f26;
  --ink: #f6f4ed;
  --muted: #b3bac6;
  --lime: #d8ff65;
}
* {
  box-sizing: border-box;
}
body {
  margin: 0;
  background: var(--bg);
  color: var(--ink);
  font:
    16px/1.6 system-ui,
    sans-serif;
}
a {
  color: inherit;
}
header,
main,
footer {
  max-width: 1120px;
  margin: auto;
  padding: 24px;
}
header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  border-bottom: 1px solid #343942;
}
.brand {
  font-size: 25px;
  font-weight: 950;
  text-decoration: none;
  letter-spacing: -1px;
}
.brand span {
  color: var(--lime);
}
nav {
  display: flex;
  gap: 18px;
}
nav a {
  text-decoration: none;
}
h1 {
  font-size: clamp(36px, 7vw, 76px);
  line-height: 1.05;
  letter-spacing: -0.055em;
  max-width: 850px;
  margin: 22px 0;
}
h2 {
  line-height: 1.2;
  font-size: 26px;
}
.eyebrow {
  color: var(--lime);
  font-weight: 750;
  letter-spacing: 0.12em;
  text-transform: uppercase;
  font-size: 12px;
}
.lead {
  font-size: 20px;
  color: var(--muted);
  max-width: 700px;
}
.hero {
  padding: 36px 0;
}
.notice {
  background: #313724;
  border-left: 3px solid var(--lime);
  padding: 14px 18px;
  margin: 20px 0;
}
.filters {
  display: flex;
  gap: 10px;
  flex-wrap: wrap;
  margin: 26px 0;
}
.filters a,
.button,
button {
  border: 1px solid #46505b;
  background: var(--panel);
  border-radius: 8px;
  padding: 10px 16px;
  color: var(--ink);
  font: inherit;
  text-decoration: none;
  cursor: pointer;
}
.filters a[aria-current],
.primary {
  background: var(--lime);
  color: #101216;
  border-color: var(--lime);
}
.grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 20px;
}
.clip {
  position: relative;
  background: var(--panel);
  padding: 26px;
  border: 1px solid #343942;
  border-radius: 16px;
  scroll-margin-top: 20px;
  overflow-wrap: anywhere;
}
.clip.featured {
  border-color: var(--lime);
  grid-column: 1/-1;
  background: linear-gradient(120deg, #293021, #1b1f26);
}
.clip:target {
  outline: 3px solid var(--lime);
  outline-offset: 4px;
}
.rank {
  font: 900 42px/1 system-ui;
  color: #808c69;
}
.meta {
  color: var(--muted);
  font-size: 14px;
}
.source {
  display: inline-block;
  margin-top: 12px;
  color: var(--lime);
  font-weight: 700;
}
footer {
  color: var(--muted);
  font-size: 13px;
  border-top: 1px solid #343942;
  margin-top: 50px;
}
.editor {
  max-width: 850px;
}
.fields {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 16px;
}
label {
  display: block;
  font-size: 14px;
  margin: 12px 0;
}
input,
textarea,
select {
  display: block;
  width: 100%;
  padding: 12px;
  background: #101216;
  color: var(--ink);
  border: 1px solid #5a6470;
  border-radius: 6px;
  font: inherit;
  margin-top: 5px;
}
input[type="checkbox"],
input[type="radio"] {
  display: inline;
  width: auto;
  margin-right: 8px;
}
textarea {
  min-height: 90px;
  resize: vertical;
}
.toolbar {
  display: flex;
  gap: 10px;
  flex-wrap: wrap;
  margin: 20px 0;
}
fieldset {
  border: 1px solid #454d58;
  border-radius: 12px;
  padding: 18px;
  margin: 24px 0;
}
legend {
  color: var(--lime);
  font-weight: 700;
}
#status {
  position: sticky;
  bottom: 10px;
  background: #293021;
  padding: 12px;
  border-radius: 8px;
}
button:disabled {
  opacity: 0.4;
}
a:focus-visible,
button:focus-visible {
  outline: 3px solid var(--lime);
  outline-offset: 3px;
}
.archive {
  list-style: none;
  padding: 0;
}
.archive li {
  border-bottom: 1px solid #343942;
  padding: 20px 0;
}
.archive a {
  font-size: 23px;
}
@media (max-width: 650px) {
  header,
  main,
  footer {
    padding: 18px;
  }
  .grid,
  .fields {
    grid-template-columns: 1fr;
  }
  .hero {
    padding: 18px 0;
  }
  .clip {
    padding: 22px;
  }
  h1 {
    font-size: 44px;
  }
  nav {
    gap: 12px;
    font-size: 14px;
  }
  .toolbar button {
    flex: 1;
  }
  header .brand {
    font-size: 23px;
  }
}

.candidate .toolbar { display: flex; flex-wrap: wrap; }
.candidate .toolbar button { flex: 1 0 auto; white-space: nowrap; overflow-wrap: normal; }
.import-run { margin-bottom: 1rem; }

/* Public editorial catalog. Private editor styles remain above. */
[hidden] { display: none !important; }
.public-page {
  --bg: #090b0c; --panel: #15191a; --ink: #f3f4ed; --muted: #afb7b4;
  --line: #303735; --lime: #d5ff65; --space: clamp(20px,4.5vw,76px);
  background: var(--bg); color: var(--ink); font-size: 16px;
}
.public-page header {
  display: flex; justify-content: space-between; align-items: center; gap: 24px;
  position: sticky; top: 0; z-index: 10; max-width: none; min-height: 80px;
  padding: 18px var(--space); border-bottom: 1px solid var(--line); background: #090b0c;
}
.masthead { display: flex; align-items: center; gap: 24px; min-width: 0; }
.public-page .brand { font-size: 32px; font-weight: 950; letter-spacing: -.07em; line-height: 1; text-decoration: none; color: var(--ink); }
.public-page .brand span { color: var(--lime); }
.brand-caption { border-left: 1px solid #46503e; padding-left: 18px; color: #afb9ad; font: 600 11px/1.55 ui-monospace,monospace; letter-spacing: .09em; }
.public-page header nav { display: flex; align-items: center; gap: 28px; font-size: 14px; }
.public-page header nav a { color: #bac2bc; padding: 10px 0; text-decoration: none; transition: color .18s; }
.public-page header nav a[aria-current] { color: var(--ink); text-decoration: underline; text-underline-offset: 8px; text-decoration-color: var(--lime); }
.public-page header nav a:hover { color: var(--lime); }
.public-page header nav .nav-search { padding: 10px 16px; border: 1px solid #566244; border-radius: 4px; color: var(--lime); }
.skip-link { position: fixed; top: -100px; left: 20px; z-index: 30; background: var(--lime); color: #111; padding: 12px 18px; }
.skip-link:focus { top: 12px; }
.public-page main { padding: 0; max-width: none; min-width: 0; }
#contenido, #buscar { scroll-margin-top: 104px; }
.public-page .billboard {
  display: grid; grid-template-columns: minmax(340px,.9fr) minmax(402px,1.1fr);
  align-items: center; gap: clamp(32px,4vw,64px); position: relative; isolation: isolate;
  min-height: 650px; overflow: hidden; padding: 52px var(--space) 72px;
  border-bottom: 1px solid #343d2e;
}
.billboard-art,.billboard-shade { position: absolute; inset: 0; z-index: -1; }
.billboard-art { background: #17201a; }
.billboard-art img { position: absolute; inset: 0; width: 100%; height: 100%; object-fit: cover; object-position: 70% 35%; opacity: .36; filter: saturate(.65); }
.hero-placeholder { position: absolute; inset: 0; display: grid; place-items: center; font: 950 clamp(120px,35vw,480px)/1 system-ui; letter-spacing: -.12em; color: #677f3826; background: radial-gradient(at 75% 20%,#58713166,transparent 65%); }
.billboard-shade { background: linear-gradient(90deg,#090b0cf5 0%,#090b0cbb 40%,#090b0c55),linear-gradient(0deg,#090b0c,transparent 65%); }
.billboard-content { min-width: 0; padding: 0; }
.public-page .billboard h1 { font: 950 clamp(44px,5.4vw,82px)/.98 "Arial Black",system-ui,sans-serif; max-width: 15ch; letter-spacing: -.065em; margin: 24px 0; text-wrap: balance; overflow-wrap: anywhere; }
.billboard .eyebrow { display: flex; flex-wrap: wrap; gap: 8px; align-items: center; color: var(--lime); font: 650 12px/1.6 ui-monospace,monospace; letter-spacing: .08em; margin: 0 0 18px; }
.billboard .eyebrow time { color: #e3e7db; text-transform: none; letter-spacing: 0; }
.live-mark { display: inline-block; width: 20px; height: 3px; background: var(--lime); }
.edition-tags { display: flex; flex-wrap: wrap; gap: 8px; color: #b9c4b8; font-size: 12px; }
.edition-tags span { padding: 3px 9px; border: 1px solid #82956e55; border-radius: 3px; }
.billboard-description { color: #d0d6ca; font-size: 17px; line-height: 1.6; max-width: 44ch; }
.edition-signature { display: flex; align-items: center; gap: 14px; margin-top: 26px; }
.edition-signature > span { font: 500 44px/1 ui-monospace,monospace; letter-spacing: -.08em; color: var(--lime); }
.edition-signature p { margin: 0; font-size: 13px; line-height: 1.6; color: #c5ccbf; }
.featured-mobile { display: none; }
.billboard-actions { display: flex; flex-wrap: wrap; gap: 10px; margin-top: 28px; }
.public-page .button,.public-page button { border-radius: 4px; min-height: 44px; padding: 11px 18px; font-size: 14px; font-weight: 750; transition: background-color .18s,border-color .18s,color .18s; }
.public-page .primary { background: var(--lime); border-color: var(--lime); color: #111609; }
.public-page .primary:hover { background: #e4ff9c; border-color: #e4ff9c; }
.public-page .secondary { background: #191e18; border-color: #596348; color: #edf1e4; }
.public-page .secondary:hover { background: #2b3421; border-color: #9bae79; }
.play-primary span { margin-right: 8px; }
.playback-note { color: #b4bcad; font-size: 12px; line-height: 1.6; margin: 14px 0 0; max-width: 52ch; }
.billboard-index { position: absolute; right: var(--space); bottom: 20px; color: #919c85; font: 10px/1.4 ui-monospace,monospace; letter-spacing: .13em; }
.hero-preview { min-width: 0; border: 1px solid #75855966; background: #101510; border-radius: 8px; overflow: hidden; box-shadow: 0 26px 80px #0005; }
.preview-heading { padding: 22px 22px 18px; }
.preview-heading .eyebrow { justify-content: space-between; margin-bottom: 10px; font-size: 11px; }
.preview-heading .eyebrow span { color: #a3b18a; }
.preview-heading h2 { font-size: clamp(19px,1.8vw,27px); line-height: 1.2; letter-spacing: -.03em; margin: 0 0 8px; overflow-wrap: anywhere; }
.featured-credit { font-size: 13px; line-height: 1.5; color: #aebaa0; margin: 0; }
.featured-credit strong { color: #e6eadf; }
.preview-stage { position: relative; width: 100%; height: clamp(304px,25vw,420px); background: #090c0a; }
.preview-stage > img { width: 100%; height: 100%; object-fit: cover; }
.preview-placeholder { position: absolute; inset: auto 16px 16px; color: #fff; font-size: 14px; }
.preview-stage iframe { position: absolute; inset: 0; width: 100%; height: 100%; border: 0; }
.preview-stage:has(iframe) > img,.preview-stage:has(iframe) > .preview-placeholder { display: none; }
.preview-toolbar { display: flex; align-items: flex-start; flex-wrap: wrap; gap: 10px; padding: 12px; }
.public-page .preview-toolbar button { padding: 9px 12px; min-height: 42px; font-size: 14px; background: #26321b; border-color: #56683a; color: #e4f1ce; white-space: nowrap; }
.public-page .preview-toolbar button:hover { background: #354823; border-color: #9dbc66; }
.public-page .preview-toolbar button[aria-pressed=true] { background: #e3edce; color: #18210d; border-color: #e3edce; }
.preview-status { flex: 1 1 140px; font-size: 12px; line-height: 1.5; color: #b6c0ab; }
.preview-source { display: inline-block; padding: 0 12px 14px; font-size: 13px; color: #d7e5be; text-underline-offset: 4px; }
.catalog-body { padding: 0 var(--space) 44px; }
.demo-banner { display: flex; align-items: start; flex-wrap: wrap; gap: 6px 24px; border-bottom: 1px solid #30382a; padding: 16px 0; color: #acb69f; font-size: 12px; line-height: 1.6; }
.demo-banner strong { font-weight: 700; color: #d0dcbb; }
.demo-banner span { flex: 1 1 340px; }
.catalog-section { margin-top: 56px; scroll-margin-top: 105px; min-width: 0; }
.section-heading { display: flex; justify-content: space-between; align-items: end; gap: 20px; margin-bottom: 26px; }
.section-heading .eyebrow { color: #9fae91; font: 600 11px/1.6 ui-monospace,monospace; letter-spacing: .08em; margin: 0 0 10px; }
.section-heading h2 { font-size: clamp(27px,3vw,42px); font-weight: 850; letter-spacing: -.05em; line-height: 1.1; margin: 0; }
.rail-controls { display: flex; gap: 8px; }
.public-page .rail-controls button { font-size: 12px; padding: 8px 12px; min-height: 40px; border-color: #46503d; background: #151a12; }
.catalog-search { max-width: 540px; padding: 0; margin: 0 0 24px; border: 0; }
.catalog-search label { font-size: 14px; margin: 0 0 8px; color: #c0c9b9; }
.catalog-search > div { display: flex; gap: 8px; }
.catalog-search input { margin: 0; min-width: 0; min-height: 46px; background: #141a12; border-color: #4b5742; border-radius: 4px; padding: 10px 14px; }
.public-page .catalog-search button { background: #27311e; border-color: #64764b; padding-inline: 20px; }
.public-page .filters { gap: 8px; margin: 0 0 24px; }
.public-page .filters a { border-radius: 4px; padding: 9px 16px; font-size: 14px; min-height: 42px; display: inline-flex; align-items: center; border-color: #414b38; color: #c0c9b6; background: #12170f; transition: background-color .18s,color .18s; }
.public-page .filters a[aria-current] { background: #e7ecd9; border-color: #e7ecd9; color: #18200e; }
.public-page .filters a:hover { border-color: #b0c588; color: var(--ink); }
.public-page .filters a[aria-current]:hover { color: #18200e; }
.result-count { color: #a5af9a; font-size: 12px; margin: 0 0 14px; }
.catalog-rail { display: flex; align-items: flex-start; overflow-x: auto; gap: 20px; overscroll-behavior-inline: contain; padding: 4px 4px 22px; margin-inline: -4px; scroll-snap-type: x proximity; scroll-padding-inline: 4px; scrollbar-width: thin; scrollbar-color: #596442 #141a11; }
.public-page .catalog-card { flex: 0 0 clamp(272px,26vw,352px); display: flex; flex-direction: column; min-width: 0; padding: 0; border-radius: 6px; border-color: #39422f; background: #131910; scroll-snap-align: start; scroll-margin: 104px 20px; transition: border-color .2s,box-shadow .2s; }
.public-page .catalog-card.featured { grid-column: auto; background: #131910; border-color: #7d9951; }
.public-page .catalog-card:hover,.public-page .catalog-card:focus-within { border-color: #bedb85; box-shadow: 0 12px 35px #0004; }
.public-page .catalog-card:target { outline: 3px solid var(--lime); outline-offset: 2px; }
.public-page .catalog-card.previewing { border-color: var(--lime); }
.catalog-card .preview-toolbar { order: 0; align-items: flex-start; padding: 10px 12px; border-bottom: 1px solid #35402c; }
.catalog-card .clip-link { order: 2; }
.clip-link { display: block; height: auto; text-decoration: none; border-radius: inherit; overflow: hidden; }
.poster { position: relative; aspect-ratio: 16/9; overflow: hidden; background: #20291b; }
.poster::after { content: ''; position: absolute; inset: 55% 0 0; background: linear-gradient(transparent,#080d0699); pointer-events: none; }
.poster img { position: absolute; inset: 0; width: 100%; height: 100%; object-fit: cover; transition: transform .22s; }
.catalog-card:not(.previewing):hover .poster img { transform: scale(1.025); }

.poster-placeholder { position: absolute; inset: 0; display: flex; flex-direction: column; align-items: center; justify-content: center; font-size: 58px; font-weight: 950; color: #c8dc9e33; letter-spacing: -.08em; background: linear-gradient(130deg,#38472d,#141c10); }
.poster-placeholder > span { font: 12px/1.5 ui-monospace,monospace; color: #c7d9a477; letter-spacing: .15em; text-transform: uppercase; }
.poster-fails .poster-placeholder { background: linear-gradient(130deg,#63452e,#221b12); }
.poster-reacciones .poster-placeholder { background: linear-gradient(130deg,#4e3956,#1a1520); }
.poster-jugadas .poster-placeholder { background: linear-gradient(130deg,#294c47,#111e1a); }
.duration,.featured-label { position: absolute; z-index: 1; border-radius: 2px; padding: 4px 7px; font: 650 12px/1.3 ui-monospace,monospace; background: #090c07dc; }
.duration { right: 10px; bottom: 10px; }
.featured-label { left: 10px; top: 10px; background: var(--lime); color: #17200c; }
.play-disc { position: absolute; z-index: 2; width: 44px; height: 44px; display: grid; place-items: center; inset: 50% auto auto 50%; transform: translate(-50%,-50%); border-radius: 50%; background: #f3f5e9ed; color: #10160b; font-size: 18px; opacity: 0; transition: opacity .18s; }
.clip-link:hover .play-disc,.clip-link:focus-visible .play-disc { opacity: 1; }
.clip-info { padding: 18px 18px 22px; }
.card-heading { display: flex; align-items: center; gap: 16px; padding-bottom: 14px; margin-bottom: 16px; border-bottom: 1px solid #3d4733; }
.card-rank { font: 500 28px/1 ui-monospace,monospace; letter-spacing: -.08em; color: #dfebc8; white-space: nowrap; }
.card-rank small { color: #929e80; font-size: 12px; letter-spacing: 0; }
.clip-info .eyebrow { margin: 0; color: var(--lime); font-size: 12px; letter-spacing: .05em; }
.clip-info h2 { font-size: 21px; font-weight: 800; letter-spacing: -.03em; line-height: 1.2; margin: 0 0 12px; }
.clip-caption { font-size: 16px; line-height: 1.55; color: #bec8b0; margin: 0 0 18px; }
.creator { color: #b6c2a5; font-size: 13px; line-height: 1.6; margin: 0; }
.creator strong { color: #edf1e2; font-weight: 650; }
.public-page .source { display: inline-block; margin-top: 16px; color: #e8f4d0; font-size: 14px; font-weight: 700; }
.source span { color: var(--lime); margin-left: 6px; }
.genre-section { padding-top: 30px; border-top: 1px solid #39432d; }
.genre-grid { display: grid; grid-template-columns: repeat(4,minmax(0,1fr)); gap: 18px; }
.genre-card { position: relative; isolation: isolate; display: flex; align-items: end; min-width: 0; min-height: 190px; overflow: hidden; border: 1px solid #4b573c; border-radius: 4px; text-decoration: none; background: #26381e; }
.genre-card img { position: absolute; inset: 0; height: 100%; width: 100%; object-fit: cover; z-index: -2; opacity: .7; transition: transform .22s; }
.genre-card::after { content: ''; position: absolute; inset: 0; z-index: -1; background: linear-gradient(0deg,#080e06fa,#080e0620); }
.genre-card > span { display: grid; gap: 6px; padding: 24px; }
.genre-card strong { font-size: 27px; font-weight: 850; letter-spacing: -.04em; color: #f1f6e6; }
.genre-card small { font-size: 13px; line-height: 1.5; color: #c6d0b5; }
.genre-card:hover img { transform: scale(1.035); }
.genre-fails { background: #543d29; }.genre-jugadas { background: #23463f; }.genre-reacciones { background: #46344d; }
.text-link { font-size: 14px; color: #d4e5b9; text-decoration: underline; text-underline-offset: 5px; }
.catalog-endnote { text-align: center; color: #b3bda6; font-size: 14px; margin: 44px 0 0; }
.empty-results { border: 1px solid #4b583c; border-radius: 4px; padding: 28px; color: #d5ddca; }
.public-page .empty-state { padding: 80px var(--space); min-height: 65vh; background: radial-gradient(at 80% 20%,#3e552455,transparent 60%); }
.public-page main > .hero,.public-page main > .archive { max-width: 1280px; margin: auto; padding: 44px var(--space); }
.public-page footer { max-width: none; padding: 52px var(--space) 24px; margin-top: 0; border-color: #465239; color: #aebba1; background: #10160c; }
.footer-main { display: grid; grid-template-columns: 1.3fr .75fr 1fr; gap: 48px; padding-bottom: 42px; }
.footer-statement { color: #edf4df; font-size: clamp(28px,3vw,44px); font-weight: 850; line-height: 1.05; letter-spacing: -.055em; margin: 26px 0 16px; }
.footer-caption,.footer-credit > p:not(.eyebrow) { font-size: 14px; line-height: 1.7; max-width: 35ch; }
.footer-main .eyebrow { font: 600 11px/1.6 ui-monospace,monospace; color: #c7d9ac; letter-spacing: .06em; margin: 0 0 18px; }
.footer-main nav { display: flex; flex-direction: column; align-items: start; gap: 14px; }
.footer-main nav a { font-size: 16px; color: #e3edce; text-decoration: none; }
.footer-main nav a:hover { color: var(--lime); }
.footer-credit .button { display: inline-flex; margin-top: 8px; text-decoration: none; }
.footer-bottom { display: flex; justify-content: space-between; flex-wrap: wrap; gap: 16px 40px; border-top: 1px solid #3a472d; padding-top: 22px; font-size: 12px; line-height: 1.7; }
.footer-bottom > span { color: #d5e2bf; }
.footer-bottom p { flex: 1 1 420px; max-width: 76ch; margin: 0; }
.billboard-compact { min-height: 520px !important; }
.billboard-compact h1 { font-size: clamp(36px,4vw,60px) !important; }
.public-page a:focus-visible,.public-page button:focus-visible,.catalog-rail:focus-visible { outline: 3px solid var(--lime); outline-offset: 3px; }
@media (hover:none) { .play-disc { opacity: 1; } }
@media (max-width:1180px) {
 .public-page .billboard { grid-template-columns: minmax(0,1fr); min-height: 0; gap: 32px; padding-top: 36px; }
 .billboard-content { max-width: 820px; }.public-page .billboard h1 { font-size: clamp(44px,6.5vw,72px); max-width: 18ch; }
 .hero-preview { width: 100%; max-width: 820px; justify-self: center; }.preview-stage { height: 304px; }
 .edition-signature { margin-top: 20px; }.billboard-index { font-size: 9px; }.genre-grid { grid-template-columns: repeat(2,minmax(0,1fr)); }
 .footer-main { gap: 32px; grid-template-columns: 1.2fr 1fr; }.footer-credit { grid-column: 1/-1; border-top: 1px solid #3a472d; padding-top: 24px; }
}
@media (max-width:800px) { .brand-caption { display: none; }.public-page header nav { gap: 20px; }.public-page .billboard { padding-top: 30px; }.billboard-description { max-width: 55ch; } }
@media (max-width:650px) {
 .public-page { --space: 20px; }.public-page header { min-height: 70px; padding: 15px var(--space); gap: 16px; }.public-page .brand { font-size: 28px; }
 .public-page .billboard { padding: 32px var(--space) 48px; gap: 26px; }.public-page .billboard h1 { font-size: clamp(42px,10vw,62px); max-width: 16ch; margin: 22px 0; }
 .billboard-art img { opacity: .5; object-position: 65% 20%; }.billboard-shade { background: linear-gradient(0deg,#090b0c, #090b0cb8 60%,#090b0c66); }
 .billboard .eyebrow { font-size: 11px; }.edition-tags { font-size: 11px; }.billboard-description { font-size: 16px; }
 .edition-signature > span { font-size: 36px; }.edition-signature p { font-size: 12px; }.billboard-index { display: none; }
 .billboard-actions { gap: 8px; margin-top: 22px; }.public-page .billboard-actions .button { padding: 11px 14px; }
 .preview-heading { padding: 18px 16px; }.preview-heading h2 { font-size: 21px; }.preview-heading .eyebrow { font-size: 10px; }
 .demo-banner { font-size: 12px; }.catalog-section { margin-top: 36px; }.section-heading { align-items: start; gap: 12px; margin-bottom: 20px; }
 .section-heading h2 { font-size: 30px; }.section-heading .eyebrow { font-size: 10px; }.rail-controls { gap: 6px; }.public-page .rail-controls button { min-height: 40px; padding: 8px; font-size: 11px; }
 .public-page .catalog-card { flex-basis: min(82vw,320px); }.catalog-rail { gap: 14px; }
 .genre-grid { gap: 12px; }.genre-card { min-height: 160px; }.genre-card > span { padding: 16px; }.genre-card strong { font-size: clamp(16px,4.8vw,24px); }.genre-card small { font-size: 12px; }
 .clip-info { padding: 16px; }.clip-info h2 { font-size: 21px; }.clip-caption { font-size: 16px; }.text-link { max-width: 14ch; text-align: right; font-size: 13px; }
 .footer-main { grid-template-columns: 1fr; gap: 32px; }.footer-credit { grid-column: auto; }.public-page footer { padding-top: 38px; }.footer-statement { font-size: 36px; }
 .footer-bottom { gap: 12px; }.billboard-compact { min-height: 0 !important; }.billboard-compact h1 { font-size: 40px !important; }
}
@media (max-width:480px) { .public-page { --space: 16px; }.public-page header .nav-selection { display: none; }.public-page header nav { gap: 16px; font-size: 13px; }.public-page header nav .nav-search { padding: 8px 12px; }.section-heading { flex-wrap: wrap; }.rail-controls { margin-left: auto; }.genre-section .text-link { max-width: none; text-align: left; } }
@media (max-width:431px) { .hero-preview,.catalog-card .preview-toolbar { display: none; }.featured-mobile { display: block; margin-top: 24px; }.featured-mobile .eyebrow { margin-bottom: 8px; }.featured-mobile .featured-credit { font-size: 14px; } }
@media (prefers-contrast:more) { .catalog-rail { scrollbar-color: #f3f5e9 #000; } }
@media (prefers-reduced-motion:reduce) { .public-page *,.public-page *::before,.public-page *::after { animation: none !important; transition: none !important; scroll-behavior: auto !important; } }

/* The original card never changes size; only this viewport layer animates. */
.catalog-card .preview-status { position: absolute; width: 1px; height: 1px; padding: 0; margin: -1px; overflow: hidden; clip-path: inset(50%); white-space: nowrap; }
.card-preview-layer { position: fixed; z-index: 9; box-sizing: border-box; overflow: hidden; border: 1px solid #a4bb7a; border-radius: 8px; background: #11180d; color: var(--ink); box-shadow: 0 20px 70px #000b; transform-origin: center; }
.card-preview-layer[data-phase=closing] { pointer-events: none; }
.layer-heading { display: grid; grid-template-columns: minmax(0,1fr) auto; gap: 14px; align-items: start; padding: 16px; }
.layer-heading .eyebrow { font: 650 10px/1.5 ui-monospace,monospace; color: var(--lime); margin: 0 0 6px; letter-spacing: .08em; }
.layer-heading h2 { font-size: 20px; line-height: 1.2; letter-spacing: -.03em; margin: 0 0 8px; overflow-wrap: anywhere; display: -webkit-box; -webkit-box-orient: vertical; -webkit-line-clamp: 2; overflow: hidden; }
.layer-creator { color: #c3d0af; font-size: 13px; line-height: 1.5; margin: 0; overflow-wrap: anywhere; }
.public-page .layer-heading button { min-height: 40px; padding: 8px 10px; background: #26331b; color: #e6f0d4; border-color: #64794a; font-size: 12px; }
.card-preview-layer .preview-stage { height: 304px; }
.layer-footer { display: flex; align-items: center; gap: 12px; padding: 14px 16px; }
.layer-footer .button { flex: 0 0 auto; text-decoration: none; }
.layer-footer p { margin: 0; color: #b7c5a4; font-size: 12px; line-height: 1.5; }
@media (max-width:520px) { .layer-heading { gap: 10px; padding: 12px; }.layer-heading h2 { font-size: 18px; }.public-page .layer-heading button { max-width: 100px; }.layer-footer { padding: 12px; gap: 10px; } }

.preview-stage[data-provider=youtube] iframe { min-width: 200px; min-height: 200px; }
.preview-stage[data-orientation=portrait] > img { object-fit: contain; }
.preview-stage[data-provider=youtube][data-orientation=portrait] iframe { width: 200px; left: 50%; transform: translateX(-50%); }
.preview-stage[data-provider=x] { overflow: auto; }
.preview-stage[data-provider=x] iframe { position: static; min-height: 0; color-scheme: dark; }
.preview-stage[data-provider=x] > div { position: relative; z-index: 1; }
@media (max-width:431px) {
 .hero-preview[data-provider=youtube], .hero-preview[data-provider=x] { display: block; min-width: 0; }
 .catalog-card[data-provider=youtube] .preview-toolbar, .catalog-card[data-provider=x] .preview-toolbar { display: flex; }
 .card-preview-layer[data-provider=youtube] .preview-stage, .card-preview-layer[data-provider=x] .preview-stage { height: 240px; }
}

.preview-stage[data-orientation="square"]{aspect-ratio:1/1}
.brand { display: inline-flex; align-items: center; gap: .4em; }
.brand b { font-weight: inherit; }
.brand-logo { width: 1.5em; height: 1.5em; border-radius: 50%; flex: none; display: block; }
/* Grid redesign: equal-size cards in up to 3 rows, edge-scroll, no overlay buttons. */
.catalog-rows { display: grid; gap: 22px; }
.rail-row { position: relative; min-width: 0; }
.catalog-rail { gap: 16px; padding-block: 6px 12px; }
.public-page .catalog-card { flex: 0 0 var(--card-w); width: var(--card-w); height: var(--card-h); overflow: hidden; }
.public-page { --card-w: clamp(240px,21vw,300px); --card-h: 396px; }
.catalog-card .clip-link { display: flex; flex-direction: column; flex: 1; min-height: 0; height: auto; }
.catalog-card .poster { flex: none; }
.catalog-card .poster img { transition: transform .35s ease; }
.catalog-card .clip-info { flex: 1; min-height: 0; display: flex; flex-direction: column; padding: 12px 14px 14px; }
.catalog-card .clip-info > * { flex-shrink: 0; }
.catalog-card .card-heading { padding-bottom: 8px; margin-bottom: 10px; gap: 12px; }
.catalog-card .card-rank { font-size: 20px; }
.catalog-card .creator { display: flex; align-items: center; gap: 10px; margin: 0 0 8px; }
.creator-badge { flex: none; width: 30px; height: 30px; border-radius: 50%; display: grid; place-items: center; background: var(--lime); color: #17200c; font: 800 14px/1 system-ui; }
.creator-text { display: grid; min-width: 0; line-height: 1.25; }
.creator-text strong { font-size: 15px; font-weight: 800; color: var(--lime); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.creator-text small { color: #9fae91; font-size: 12px; }
.catalog-card .clip-info h2 { font-size: 16px; line-height: 1.3; margin: 0 0 6px; display: -webkit-box; -webkit-box-orient: vertical; -webkit-line-clamp: 2; line-clamp: 2; overflow: hidden; }
.catalog-card .clip-caption { font-size: 13px; line-height: 1.45; margin: 0; display: -webkit-box; -webkit-box-orient: vertical; -webkit-line-clamp: 2; line-clamp: 2; overflow: hidden; }
.public-page .catalog-card .source { margin-top: auto; padding-top: 8px; font-size: 12px; color: #c8dfa0; }
.catalog-card:not(.previewing):hover .poster img { transform: scale(1.04); }
.catalog-card.previewing .poster::after { background: linear-gradient(transparent,#0b100899); }
.card-preview-layer .fade-in, .hero-preview .fade-in { opacity: 0; transition: opacity .45s ease; }
.card-preview-layer .fade-in.is-ready, .hero-preview .fade-in.is-ready { opacity: 1; }
.rail-edge { position: absolute; top: 0; bottom: 18px; width: 56px; z-index: 5; display: none; opacity: 0; transition: opacity .25s; }
.rail-edge-prev { left: -4px; background: linear-gradient(90deg,#090b0ccc,transparent); }
.rail-edge-next { right: -4px; background: linear-gradient(270deg,#090b0ccc,transparent); }
.rail-row.can-prev .rail-edge-prev, .rail-row.can-next .rail-edge-next { display: block; }
.rail-row:hover .rail-edge { opacity: 1; }
/* Visually hidden controls stay in the tab order and show up on keyboard focus. */
.rail-sr, .catalog-card .preview-toolbar { position: absolute; width: 1px; height: 1px; margin: -1px; padding: 0; overflow: hidden; clip-path: inset(50%); white-space: nowrap; border: 0; }
.rail-sr { display: flex; gap: 6px; }
.rail-sr:focus-within { position: absolute; z-index: 6; width: auto; height: auto; margin: 0; overflow: visible; clip-path: none; top: -44px; right: 0; }
.catalog-card .preview-toolbar:focus-within { z-index: 6; left: 8px; top: 8px; width: auto; height: auto; margin: 0; overflow: visible; clip-path: none; background: #090c07ee; border: 1px solid var(--lime); border-radius: 4px; padding: 4px; }
@media (hover:none) {
  .rail-edge { display: none !important; }
  .catalog-card { height: calc(var(--card-h) + 52px); }
  .catalog-card .preview-toolbar, .catalog-card .preview-toolbar:focus-within { position: static; width: auto; height: auto; margin: 0; clip-path: none; overflow: visible; padding: 8px 12px; border: 0; border-top: 1px solid #35402c; border-radius: 0; background: none; order: 3; }
  .catalog-card .preview-toolbar button { min-height: 36px; padding: 6px 12px; font-size: 13px; }
}
@media (max-width:650px) { .public-page { --card-w: min(72vw,260px); } .catalog-rows { gap: 16px; } }
@media (prefers-reduced-motion:reduce) { .card-preview-layer .fade-in, .hero-preview .fade-in { opacity: 1; } }
` + designCss;
