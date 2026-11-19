export const css = `
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

/* Public catalog. The private editor keeps its existing layout and controls. */
[hidden] { display: none !important; }
.public-page { --bg: #090a0d; --panel: #15171d; background: var(--bg); }
.public-page header { max-width: none; padding: 20px clamp(20px, 4.5vw, 80px); border: 0; background: linear-gradient(#090a0df5,#090a0de6); position: sticky; top: 0; z-index: 10; min-height: 78px; }
.public-page .brand { font-size: 30px; letter-spacing: -1.4px; }
.public-page header nav { align-items: center; gap: 28px; font-size: 14px; }
.public-page header nav a { color: #c1c2cb; padding: 8px 0; }
.public-page header nav a:hover { color: white; }
.public-page main { padding: 0; max-width: none; }
.public-page .billboard { position: relative; min-height: 580px; display: flex; align-items: center; isolation: isolate; overflow: hidden; }
.billboard-art, .billboard-shade { position: absolute; inset: 0; z-index: -1; }
.billboard-art { background: #111a19; }
.billboard-art img { position: absolute; inset: 0; width: 100%; height: 100%; object-fit: cover; object-position: 70% 40%; }
.hero-placeholder { position: absolute; inset: 0; display: grid; place-items: center; font: 950 clamp(120px,35vw,480px)/1 system-ui; letter-spacing: -.12em; color: #6c84442b; background: radial-gradient(ellipse at 75% 20%,#59733055,transparent 65%),repeating-linear-gradient(135deg,transparent 0 60px,#ffffff02 60px 61px); }
.billboard-shade { background: linear-gradient(90deg,#090a0df5 0%,#090a0dd9 30%,#090a0d4d 65%,#090a0d1a),linear-gradient(0deg,#090a0d 0%,transparent 32%,#090a0d22); }
.billboard-content { width: 100%; padding: 48px clamp(20px,4.5vw,80px) 76px; max-width: 920px; }
.public-page .billboard h1 { font-size: clamp(46px,5.2vw,82px); max-width: 15ch; line-height: 1.02; letter-spacing: -.055em; margin: 20px 0; text-wrap: balance; overflow-wrap: anywhere; }
.billboard .eyebrow { font-size: 12px; letter-spacing: .14em; margin-bottom: 16px; }
.billboard .eyebrow time { color: #d4d5dc; letter-spacing: .02em; text-transform: none; }
.live-mark { display: inline-block; width: 18px; height: 3px; background: var(--lime); vertical-align: middle; margin-right: 8px; }
.edition-tags { display: flex; flex-wrap: wrap; gap: 8px; font-size: 12px; color: #e1e2e8; }
.edition-tags span { border: 1px solid #ffffff35; padding: 2px 8px; border-radius: 3px; background: #0a0b0e50; }
.billboard-description { font-size: 18px; line-height: 1.55; max-width: 53ch; color: #e1e2e8; }
.featured-credit { color: #b8bbc6; font-size: 14px; max-width: 65ch; }
.featured-credit span { display: block; font-size: 12px; color: var(--lime); letter-spacing: .12em; font-weight: 800; margin: 20px 0 4px; }
.billboard-actions { display: flex; flex-wrap: wrap; gap: 12px; margin-top: 24px; }
.public-page .button, .public-page button { border-radius: 5px; font-weight: 700; padding: 12px 22px; }
.public-page .primary { background: var(--lime); color: #0a0b0e; border-color: var(--lime); }
.play-primary span { display: inline-block; margin-right: 8px; }
.public-page .secondary { background: #ffffff16; border-color: #ffffff30; backdrop-filter: blur(8px); }
.public-page .button:hover { filter: brightness(1.12); }
.playback-note { color: #b1b4bf; font-size: 12px; margin-top: 15px; }
.billboard-index { position: absolute; right: 5%; bottom: 36px; color: #dedee76b; font-size: 12px; letter-spacing: .18em; }
.catalog-body { padding: 0 clamp(20px,4.5vw,80px) 28px; }
.demo-banner { display: flex; align-items: start; flex-wrap: wrap; gap: 8px 20px; border-left: 3px solid #d8ff6566; background: #d8ff6508; padding: 10px 16px; color: #aeb1bd; font-size: 12px; line-height: 1.5; }
.demo-banner strong { color: #c7d2ad; font-weight: 650; }
.demo-banner span { flex: 1 1 320px; }
.catalog-section { margin-top: 44px; scroll-margin-top: 100px; min-width: 0; }
.section-heading { display: flex; gap: 20px; justify-content: space-between; align-items: end; margin-bottom: 20px; }
.section-heading .eyebrow { font-size: 12px; margin: 0 0 8px; color: #9daca0; }
.section-heading h2 { font-size: clamp(25px,2.6vw,34px); letter-spacing: -.035em; margin: 0; }
.rail-controls { display: flex; gap: 8px; }
.public-page .rail-controls button { padding: 7px 12px; background: #14161b; border-color: #33363f; font-size: 12px; }
.public-page .filters { gap: 8px; margin: 0 0 22px; }
.public-page .filters a { border-radius: 30px; padding: 7px 18px; font-size: 14px; background: transparent; border-color: #35373f; color: #bfc1cc; }
.public-page .filters a[aria-current] { background: #f5f5f0; border-color: #f5f5f0; color: #131418; }
.catalog-search { max-width: 490px; margin-bottom: 12px; }
.catalog-search label { font-size: 14px; color: #aeb1be; margin: 0 0 6px; }
.catalog-search > div { display: flex; gap: 8px; }
.catalog-search input { margin: 0; min-width: 0; border-color: #30333d; padding: 10px 14px; background: #111319; }
.public-page .catalog-search button { padding: 8px 16px; font-size: 14px; background: #23262f; border-color: #333641; }
.result-count { margin: 0 0 10px; color: #858b9a; font-size: 12px; }
.catalog-rail { display: grid; grid-auto-flow: column; grid-auto-columns: clamp(255px,24vw,340px); overflow-x: auto; overscroll-behavior-inline: contain; gap: 18px; padding: 8px 4px 20px; margin-inline: -4px; scroll-snap-type: x proximity; scrollbar-width: thin; scrollbar-color: #3c414c #101116; scroll-padding-inline: 4px; }
.public-page .catalog-card { padding: 0; border-radius: 7px; background: #14161c; border-color: #292d36; scroll-snap-align: start; scroll-margin: 100px 24px; transition: border-color .2s,transform .2s,box-shadow .2s; min-width: 0; }
.public-page .catalog-card.featured { grid-column: auto; background: #14161c; border-color: #829b3b; }
.public-page .catalog-card:hover, .public-page .catalog-card:focus-within { transform: translateY(-4px); border-color: #96b347; box-shadow: 0 10px 35px #0006; }
.public-page .catalog-card:target { outline: 3px solid var(--lime); outline-offset: 2px; }
.clip-link { display: block; height: 100%; text-decoration: none; border-radius: inherit; overflow: hidden; }
.poster { position: relative; aspect-ratio: 16/9; overflow: hidden; background: #252c36; }
.poster::after { content: ''; position: absolute; inset: 50% 0 0; background: linear-gradient(transparent,#090a0d99); pointer-events: none; }
.poster img { position: absolute; inset: 0; width: 100%; height: 100%; object-fit: cover; }
.poster-placeholder { position: absolute; inset: 0; display: flex; flex-direction: column; justify-content: center; align-items: center; font-size: 58px; font-weight: 950; color: #ffffff2b; letter-spacing: -.08em; background: linear-gradient(130deg,#303c4d,#161c25); }
.poster-placeholder > span { font-size: 12px; letter-spacing: .2em; text-transform: uppercase; font-weight: 700; color: #ffffff6b; }
.poster-fails .poster-placeholder { background: linear-gradient(130deg,#5a382e,#191b25); }
.poster-detalles .poster-placeholder { background: linear-gradient(130deg,#285447,#141d20); }
.poster-reacciones .poster-placeholder { background: linear-gradient(130deg,#4f365b,#1a1b28); }
.card-rank, .duration, .featured-label { position: absolute; z-index: 1; background: #090a0dcc; border-radius: 3px; padding: 3px 7px; font-size: 12px; font-weight: 750; line-height: 1.4; }
.card-rank { left: 10px; top: 10px; }
.duration { right: 10px; bottom: 10px; }
.featured-label { right: 10px; top: 10px; background: var(--lime); color: #13150c; }
.play-disc { position: absolute; z-index: 2; width: 48px; height: 48px; display: grid; place-items: center; top: 50%; left: 50%; transform: translate(-50%,-50%); border-radius: 50%; background: #f6f5eff2; color: #0a0a0e; font-size: 19px; padding-left: 3px; opacity: 0; transition: opacity .2s; }
.clip-link:hover .play-disc, .clip-link:focus-visible .play-disc { opacity: 1; }
.clip-info { padding: 16px 18px 20px; }
.clip-info .eyebrow { font-size: 12px; margin: 0 0 8px; letter-spacing: .1em; }
.clip-info h2 { font-size: 19px; margin: 0 0 10px; line-height: 1.25; letter-spacing: -.02em; }
.clip-caption { font-size: 14px; color: #b0b4c1; line-height: 1.5; margin: 0 0 14px; }
.creator { color: #9197a6; font-size: 12px; margin: 0; }
.creator strong { color: #c3c7d0; font-weight: 600; }
.public-page .source { margin: 14px 0 0; font-size: 14px; color: #e2e7d7; font-weight: 700; }
.source span { color: var(--lime); margin-left: 4px; font-size: 12px; }
.genre-section { margin-top: 40px; }
.genre-grid { display: grid; grid-template-columns: repeat(4,minmax(0,1fr)); gap: 18px; }
.genre-card { position: relative; min-height: 170px; overflow: hidden; border: 1px solid #ffffff1a; border-radius: 6px; text-decoration: none; background: #1f3030; isolation: isolate; display: flex; align-items: end; }
.genre-card img { position: absolute; inset: 0; height: 100%; width: 100%; object-fit: cover; z-index: -2; filter: saturate(.75); transition: transform .3s; }
.genre-card::after { content: ''; position: absolute; inset: 0; z-index: -1; background: linear-gradient(0deg,#080a0ef0, #080a0e33); }
.genre-fails { background: #563730; }.genre-jugadas { background: #303f57; }.genre-detalles { background: #285042; }.genre-reacciones { background: #4e3657; }
.genre-card > span { display: grid; padding: 22px; }
.genre-card strong { font-size: 25px; font-weight: 800; letter-spacing: -.03em; }
.genre-card small { color: #c3c5ce; font-size: 12px; }
.genre-card:hover img { transform: scale(1.05); }
.text-link { color: #bfc5b4; text-decoration: none; font-size: 14px; white-space: nowrap; }
.catalog-endnote { color: #797f8f; text-align: center; margin: 50px 0 10px; font-size: 14px; }
.empty-results { border: 1px solid #292d36; padding: 28px; border-radius: 7px; color: #bfc3cf; }
.public-page .empty-state { padding: 80px clamp(20px,8vw,140px); min-height: 65vh; background: radial-gradient(at 80% 20%,#3d532f55,transparent 60%); }
.public-page main > .hero, .public-page main > .archive { margin: auto; max-width: 1280px; padding: 30px clamp(20px,4vw,60px); }
.public-page footer { max-width: none; padding: 36px clamp(20px,4.5vw,80px); margin-top: 0; border-color: #252830; color: #797f8d; background: #090a0d; }
.billboard-compact { min-height: 370px !important; }.billboard-compact h1 { font-size: clamp(34px,4vw,58px) !important; }
.public-page a:focus-visible, .public-page button:focus-visible, .catalog-rail:focus-visible { outline: 3px solid var(--lime); outline-offset: 3px; }
@media (hover:none) { .play-disc { opacity: 1; width: 38px; height: 38px; font-size: 15px; } }
@media (max-width:900px) { .genre-grid { grid-template-columns: repeat(2,minmax(0,1fr)); } .billboard-index { display: none; } }
@media (max-width:650px) {
 .public-page header { padding: 14px 20px; min-height: 68px; }.public-page .brand { font-size: 26px; }.public-page header nav { gap: 16px; }
 .public-page .billboard { min-height: 570px; align-items: end; }.billboard-art img { object-position: 65% 15%; height: 75%; }
 .billboard-shade { background: linear-gradient(0deg,#090a0d 0%,#090a0df2 28%,#090a0db3 55%,#090a0d26 90%); }
 .billboard-content { padding: 125px 20px 30px; }.public-page .billboard h1 { font-size: clamp(38px,10vw,54px); max-width: 16ch; }
 .billboard-description { font-size: 16px; }.featured-credit { font-size: 12px; }.billboard .eyebrow { font-size: 12px; }
 .edition-tags { font-size: 12px; }.billboard-actions { gap: 10px; }.public-page .billboard-actions .button { padding: 11px 16px; font-size: 14px; }
 .playback-note { font-size: 12px; }.catalog-body { padding: 0 20px 22px; }.demo-banner { padding: 10px 12px; }
 .catalog-section { margin-top: 32px; scroll-margin-top: 85px; }.section-heading { gap: 8px; }.section-heading h2 { font-size: 26px; }
 .section-heading .eyebrow { font-size: 12px; }.rail-controls { gap: 4px; }.public-page .rail-controls button { padding: 6px 8px; font-size: 12px; }
 .public-page .filters a { padding: 6px 13px; }.catalog-rail { grid-auto-columns: min(78vw,310px); gap: 14px; }
 .genre-grid { gap: 12px; }.genre-card { min-height: 150px; }.genre-card > span { padding: 16px; }.genre-card strong { font-size: 23px; }
 .text-link { font-size: 12px; white-space: normal; text-align: right; }.genre-section .section-heading { align-items: end; }
 .billboard-compact { min-height: 430px !important; }.billboard-compact .billboard-content { padding-top: 40px; }
}
@media (prefers-reduced-motion:reduce) { .catalog-card,.play-disc,.genre-card img { transition: none !important; } html { scroll-behavior: auto; } }

/* Official clip players occupy their own unobscured space. */

.public-page .billboard { flex-wrap: wrap; gap: 24px; padding-right: clamp(20px,4.5vw,80px); }
.billboard-content { flex: 1 1 480px; width: auto; max-width: 820px; }
.hero-preview { flex: 1 1 420px; min-width: 0; max-width: 640px; margin: 32px 0 60px; border: 1px solid #343b42; border-radius: 8px; background: #11151b; overflow: hidden; }
.preview-stage { position: relative; width: 100%; height: max(300px,22vw); max-height: 360px; background: #0b0e13; }
.preview-stage > img { width: 100%; height: 100%; object-fit: cover; }
.preview-placeholder { position: absolute; inset: auto 16px 16px; color: #fff; font-size: 14px; }
.preview-stage iframe { position: absolute; inset: 0; width: 100%; height: 100%; border: 0; }
.preview-stage:has(iframe) > img, .preview-stage:has(iframe) > .preview-placeholder { display: none; }
.preview-toolbar { display: flex; align-items: center; flex-wrap: wrap; gap: 10px; padding: 12px; }
.preview-toolbar[hidden], .preview-stage[hidden] { display: none; }
.public-page .preview-toolbar button { font-size: 14px; padding: 9px 12px; border-color: #566344; background: #263321; color: #ecf5df; }
.preview-status { font-size: 12px; line-height: 1.5; color: #b8bfcb; flex: 1 1 140px; }
.preview-source { display: block; padding: 0 12px 12px; font-size: 14px; color: #e8f2d4; }
.catalog-rail { display: flex; align-items: flex-start; }
.public-page .catalog-card { flex: 0 0 clamp(255px,24vw,340px); }
.clip-link { height: auto; }
.public-page .catalog-card.previewing { flex-basis: 432px; }
.catalog-card .preview-stage { height: 300px; }
.public-page .catalog-card { display: flex; flex-direction: column; }
.catalog-card .preview-toolbar { order: 0; align-items: flex-start; }
.catalog-card .preview-stage { order: 1; }
.catalog-card .clip-link { order: 2; }

.catalog-card.previewing .clip-link .poster { display: none; }
@media (max-width:1100px) { .hero-preview { flex-basis: 100%; margin: 0 0 40px clamp(20px,4.5vw,80px); }.billboard-content { max-width: none; padding-bottom: 12px; } }
@media (max-width:650px) { .public-page .catalog-card { flex-basis: min(78vw,310px); }.hero-preview { margin: 0 0 24px 20px; }.public-page .billboard { gap: 16px; }.billboard-content { flex-basis: 100%; } }
@media (max-width:431px) { .hero-preview { display: none; }.catalog-card .preview-toolbar { display: none; } }
`;
