// Public-only refinement: admin forms and provider geometry retain their contracts.
export const designCss = `
.public-page {
  --bg: #0b0d12; --panel: #151923; --ink: #f5f6f8; --muted: #adb4c3;
  --line: #303642; --lime: #d5ff65; --radius-card: 16px;
  --space: clamp(16px,4.5vw,76px);
  background: var(--bg);
}
.public-page header { background: #0b0d12f2; border-color: #ffffff14; min-height: 76px; padding-block: 12px; }
@supports (backdrop-filter: blur(12px)) { .public-page header { background: #0b0d12df; backdrop-filter: blur(12px); } }
.public-page .brand { font-size: 28px; letter-spacing: -.06em; }
.public-page .brand-caption { color: #aab2c2; border-color: #3a414e; font-size: 10px; }
.public-page header nav { gap: 8px; }
.public-page header nav a { padding: 10px 16px; border-radius: 24px; min-height: 44px; }
.public-page header nav a[aria-current] { background: #d5ff6512; color: var(--lime); text-decoration: none; }
.public-page header nav .nav-search { border-radius: 24px; border-color: #434b59; color: var(--ink); }
.public-page .billboard { min-height: 560px; padding-block: 44px 56px; gap: clamp(24px,4vw,64px); border-color: #ffffff14; }
.billboard-art { background: #151923; }
.billboard-art img { opacity: .46; filter: saturate(.85); }
.billboard-shade { background: linear-gradient(90deg,#0b0d12f5,#0b0d12c9 45%,#0b0d1270),linear-gradient(0deg,#0b0d12,transparent 70%); }
.hero-placeholder { color: #aab2c210; background: radial-gradient(ellipse at 85% 10%,#54617b44,transparent 65%); }
.public-page .billboard h1 { font: 850 clamp(38px,4.7vw,70px)/1.04 system-ui,sans-serif; letter-spacing: -.055em; max-width: 17ch; margin: 20px 0; }
.billboard-description { color: #c6ccd8; font-size: 16px; max-width: 48ch; }
.edition-tags span { border-color: #ffffff25; background: #ffffff08; border-radius: 20px; color: #d9deea; }
.edition-signature { margin-top: 20px; }
.edition-signature > span { font-size: 40px; color: var(--lime); }
.edition-signature p { color: #acb5c5; }
.billboard-index { display: none; }
.public-page .button,.public-page button { border-radius: 10px; }
.public-page .secondary { background: #1a202c; border-color: #485365; color: #f0f3f9; }
.public-page .secondary:hover { background: #272f3d; border-color: #8b98aa; }
.public-page .share-edition { border: 0; background: transparent; color: #c6cedd; padding: 4px 0; font-weight: 500; font-size: 12px; }
.share-status { display: block; color: var(--lime); font-size: 12px; min-height: 20px; }
.hero-preview { background: #11151d; border-color: #ffffff29; border-radius: 18px; box-shadow: 0 24px 64px #0006; }
.preview-heading { background: #151a23; }
.preview-heading h2 { font-size: clamp(18px,1.7vw,24px); line-height: 1.25; }
.preview-stage:not(:has(img:not([hidden]))) { background: radial-gradient(ellipse at 70% 20%,#33405a66,transparent 70%),#10151f; }
.preview-stage:not(:has(img:not([hidden]))) .preview-placeholder { inset: 0; }
.preview-placeholder { display: grid; align-content: center; gap: 12px; padding: 24px; text-align: center; font-size: 22px; color: #d8deea; }
.preview-placeholder small { font: 600 10px/1.5 ui-monospace,monospace; letter-spacing: .12em; color: #acb7c9; }
.preview-source { color: #c8d2e5; }
.catalog-body { max-width: 1600px; margin-inline: auto; }
.catalog-section { padding-top: 40px; }
.section-heading h2 { font-size: clamp(28px,3vw,40px); letter-spacing: -.045em; }
.section-heading .eyebrow { color: #9faabd; font-size: 10px; letter-spacing: .16em; }
.discovery-toolbar { display: flex; flex-wrap: wrap; align-items: end; gap: 20px; justify-content: space-between; padding: 18px; background: #131720; border: 1px solid #ffffff14; border-radius: 16px; }
.public-page .filters { margin: 0; gap: 6px; }
.public-page .filters a { border-radius: 24px; background: transparent; border-color: transparent; color: #b8c1d0; min-height: 44px; }
.public-page .filters a[aria-current] { background: var(--lime); border-color: var(--lime); color: #18200e; }
.public-page .filters a:hover { border-color: #667087; }
.catalog-search { margin: 0; flex: 1 1 280px; max-width: 420px; }
.catalog-search label { color: #b8c1d0; font-size: 12px; margin-bottom: 6px; }
.catalog-search input { border-radius: 10px; background: #0b0e15; border-color: #414b5c; color: var(--ink); }
.public-page .catalog-search button { background: #252e3d; border-color: #536078; }
.result-count { color: #aab5c7; font-size: 12px; padding-block: 4px; }
.public-page .catalog-card { border-radius: var(--radius-card); background: #151923; border-color: #353e4d; }
.public-page .catalog-card.featured { background: #151923; border-color: #7c9454; }
.public-page .catalog-card:hover,.public-page .catalog-card:focus-within { border-color: #b5cc85; box-shadow: 0 12px 30px #0004; }
.catalog-card .poster { border-radius: 0; }
.catalog-card .card-heading { border-color: #ffffff15; }
.catalog-card .creator-badge { background: #d5ff651c; color: var(--lime); border: 1px solid #d5ff6538; }
.catalog-card .creator-text strong { color: #e8efdc; font-size: 14px; }
.catalog-card .creator-text small,.catalog-card .clip-caption { color: #b3bdce; }
.catalog-card .clip-info h2 { color: #f5f6f8; }
.public-page .catalog-card .source { color: #c6d6ab; }
.genre-card { border-radius: 14px; border-color: #394252; }
.empty-results { background: #151923; border: 1px dashed #536078; border-radius: 16px; padding: 32px; }
.catalog-endnote { color: #b4bece; border-color: #313b4b; }
.public-page footer { padding-top: 32px; background: #10141c; border-color: #303949; color: #b4bece; }
.footer-main { grid-template-columns: 1.2fr 1fr; padding-bottom: 24px; gap: 28px; }
.footer-credit { display: none; }
.footer-statement { font-size: 26px; margin: 16px 0 10px; }
.footer-caption { max-width: 50ch; }
.footer-main nav { justify-self: end; }
.footer-bottom { border-color: #313b4b; padding-top: 16px; }
#seleccion,#buscar { scroll-margin-top: 100px; }
@media (hover:none) { .public-page .catalog-card { height: calc(var(--card-h) + 52px); } }
@media (max-width:1050px) { .public-page .billboard { grid-template-columns: minmax(0,1fr); min-height: 0; } }
@media (max-width:650px) {
  .public-page header { flex-wrap: wrap; gap: 8px; padding-block: 10px; }
  .public-page .brand { font-size: 24px; }
  .public-page header nav { gap: 2px; }
  .public-page header nav a,.public-page header nav .nav-search { padding: 10px; font-size: 12px; }
  .public-page header .nav-selection { display: inline-flex; }
  .public-page .billboard { padding-block: 28px 32px; gap: 24px; }
  .public-page .billboard h1 { font-size: clamp(36px,9vw,52px); margin: 18px 0; }
  .edition-signature { display: none; }
  .billboard-actions { margin-top: 18px; }
  .discovery-toolbar { padding: 12px; gap: 14px; }
  .public-page .filters { flex-wrap: nowrap; overflow-x: auto; max-width: 100%; padding-bottom: 4px; }
  .public-page .filters a { flex-shrink: 0; padding-inline: 12px; }
  .catalog-search { max-width: none; flex-basis: 100%; }
  .footer-main { grid-template-columns: 1fr; }
  .footer-main nav { justify-self: start; }
}
@media (max-width:380px) {
  .public-page header nav { width: 100%; justify-content: space-between; }
  #seleccion,#buscar { scroll-margin-top: 144px; }
}
`;
