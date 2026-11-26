/** Public cinema system. Admin styling remains in style.ts. */
export const designCss = `
.public-page {
 --bg:#111419; --panel:#1a1e25; --ink:#f5f6f3; --muted:#aab2be; --lime:#d8ff65;
 --space:clamp(18px,4vw,64px); --motion-fast:180ms; --motion-layout:260ms;
 background:var(--bg); font-family:system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;
}
.public-page [hidden] { display:none !important; }
.public-page header { position:relative; min-height:76px; padding:16px var(--space); border:0; background:var(--bg); }
.public-page .brand { font-size:27px; letter-spacing:-1.2px; }
.public-page .brand-caption { border:0; padding-left:12px; color:var(--muted); letter-spacing:0; font:12px/1.4 system-ui,sans-serif; }
.public-page header nav { gap:8px; }
.public-page header nav a { min-height:44px; padding:10px 14px; color:#bdc4cc; border:0; border-radius:5px; }
.public-page header nav a:hover,.public-page header nav a[aria-current] { color:var(--ink); background:#ffffff08; }
.public-page header .nav-search { border:0; border-radius:5px; }
.public-page main { max-width:none; padding:0; }
.public-page .cinema,.public-page .catalog-body { max-width:1536px; margin:auto; padding-inline:var(--space); }
.cinema-intro { display:flex; align-items:center; justify-content:space-between; gap:20px; min-height:52px; font-size:13px; color:var(--muted); }
.cinema-intro p { margin:0; }
.cinema-intro a { text-decoration:none; color:inherit; }
.public-page .hero-preview { display:block; width:100%; max-width:none; border:0; border-radius:0; background:none; box-shadow:none; overflow:visible; }
.public-page .hero-preview .preview-stage { position:relative; width:100%; height:clamp(240px,43vw,580px); min-height:200px; max-height:none; aspect-ratio:auto; overflow:hidden; background:#050607; border-radius:6px; isolation:isolate; }
.public-page .hero-preview .preview-stage > img { position:absolute; inset:0; width:100%; height:100%; object-fit:cover; z-index:1; }
.public-page .hero-preview .preview-stage iframe { position:absolute; inset:0; width:100%; height:100%; border:0; z-index:2; }
.public-page .hero-preview .preview-stage[data-provider=youtube][data-orientation=portrait] iframe { width:100%; height:100%; left:0; transform:none; }
.public-page .hero-preview .preview-stage[data-orientation=portrait],.public-page .hero-preview .preview-stage[data-orientation=square] { height:clamp(320px,50vw,620px); }
.public-page .hero-preview .preview-stage[data-provider=x] { height:auto; min-height:240px; max-height:none; overflow:visible; padding:0; display:grid; justify-items:center; }
.public-page .hero-preview .preview-stage[data-provider=x] iframe { position:static; background:transparent; max-width:550px; }
.public-page .hero-preview .preview-stage[data-provider=x] > div { width:100%; max-width:550px; }
.public-page .hero-preview .preview-stage[data-provider=x]:not(:has(iframe)) { min-height:340px; }
.public-page .preview-placeholder { position:absolute; inset:0; z-index:0; display:flex; flex-direction:column; justify-content:center; align-items:center; gap:16px; padding:28px; font-size:clamp(40px,8vw,94px); font-weight:850; letter-spacing:-.07em; color:#7d8997; background:#171e28; }
.public-page .preview-placeholder small { max-width:44ch; font:400 16px/1.5 system-ui,sans-serif; letter-spacing:0; color:#b6c0ce; text-align:center; }
.public-page .preview-stage:has(img:not([hidden])) .preview-placeholder { visibility:hidden; }
.cinema-details { display:flex; justify-content:space-between; align-items:flex-start; gap:32px; padding-block:22px 12px; }
.cinema-copy { min-width:0; max-width:900px; }
.public-page .cinema h1 { font-size:clamp(25px,2.7vw,42px); font-weight:760; letter-spacing:-.045em; line-height:1.13; margin:0 0 12px; max-width:32ch; text-wrap:balance; }
.public-page .featured-credit { display:flex; flex-wrap:wrap; gap:8px 18px; font-size:14px; color:var(--muted); margin:0; }
.public-page .featured-credit strong { color:var(--ink); font-weight:550; }
.cinema-context { margin-top:12px; font-size:14px; color:var(--muted); }
.cinema-context summary { width:fit-content; cursor:pointer; min-height:30px; }
.cinema-context p { max-width:72ch; margin:6px 0; }
.cinema-actions { flex-shrink:0; display:flex; flex-direction:column; align-items:flex-end; gap:8px; max-width:280px; }
.public-page .hero-preview .preview-toolbar { padding:0; border:0; background:none; display:flex; flex-direction:column; align-items:flex-end; gap:8px; }
.public-page .hero-preview [data-preview-toggle] { background:var(--lime); color:#18200b; font-weight:750; border:0; border-radius:5px; min-width:132px; min-height:46px; padding:12px 24px; }
.public-page .preview-status { flex:0 0 auto; min-height:0; font:12px/1.5 system-ui,sans-serif; color:var(--muted); }
.public-page .preview-source { padding:0; margin:0; background:none; font-size:13px; color:#c0c6d0; min-height:32px; display:flex; align-items:center; }
.public-page .catalog-section { padding:0; margin-top:38px; }
.public-page .section-heading { display:flex; justify-content:space-between; align-items:center; gap:20px; margin-bottom:20px; }
.public-page .section-heading h2 { font-size:clamp(23px,2.4vw,30px); margin:0; letter-spacing:-.035em; }
.public-page .section-intro { font-size:14px; color:var(--muted); margin:7px 0 0; max-width:70ch; }
.public-page .share-edition { font-size:13px; font-weight:500; border:0; background:none; padding:10px; white-space:nowrap; }
.share-status { color:var(--muted); font-size:12px; }
.public-page .discovery-toolbar { display:flex; flex-wrap:wrap; align-items:center; gap:12px 18px; padding:0; background:none; border:0; }
.public-page .filters { display:flex; flex:1 1 auto; flex-wrap:wrap; gap:4px; margin:0; }
.public-page .filters a { padding:10px 13px; border:0; border-radius:5px; background:none; color:var(--muted); min-height:44px; font-size:14px; }
.public-page .filters a[aria-current] { background:#293024; color:var(--lime); }
.public-page .filters a:hover { background:#ffffff08; color:var(--ink); }
.public-page .catalog-search { display:flex; gap:0; margin:0; flex:0 1 290px; max-width:none; }
.public-page .catalog-search input { width:100%; min-width:0; border:1px solid #424851; background:#171b21; border-radius:5px 0 0 5px; padding:10px 12px; color:var(--ink); min-height:44px; }
.public-page .catalog-search button { border:1px solid #424851; border-left:0; border-radius:0 5px 5px 0; padding:8px 10px; background:#20262e; font-size:12px; }
.catalog-sort { display:flex; align-items:center; gap:8px; color:var(--muted); font-size:12px; margin:0; }
.catalog-sort select { width:auto; min-height:44px; padding:8px; background:#171b21; color:var(--ink); border:1px solid #424851; border-radius:5px; margin:0; font-size:12px; }
.result-count { color:var(--muted); font-size:12px; margin:14px 0; min-height:20px; }
.public-page .catalog-grid { display:grid; grid-template-columns:repeat(3,minmax(0,1fr)); gap:28px 24px; overflow:visible; margin:0; padding:0; scroll-snap-type:none; align-items:start; }
.public-page .catalog-card,.public-page .catalog-card.featured { position:relative; display:block; width:auto; height:auto; min-width:0; border:0; padding:0; background:none; border-radius:0; box-shadow:none; overflow:visible; scroll-margin:20px; }
.public-page .catalog-card:hover,.public-page .catalog-card:focus-within,.public-page .catalog-card.previewing { border:0; background:none; box-shadow:none; }
.public-page .catalog-card .clip-link { display:block; position:relative; height:auto; opacity:1; text-decoration:none; }
.public-page .catalog-card .poster { position:relative; width:100%; height:auto; aspect-ratio:16/9; border-radius:5px; overflow:hidden; background:#171e28; transition:transform var(--motion-fast) ease; }
.public-page .catalog-card .poster::after { background:none; }
.public-page .catalog-card .poster img { object-fit:cover; opacity:1; filter:none; }
.public-page .catalog-card[data-orientation=portrait] .poster img,.public-page .catalog-card[data-orientation=square] .poster img { object-fit:contain; }
.public-page .poster-placeholder { background:#1a2430; color:#748397; letter-spacing:-.06em; font:750 clamp(28px,4vw,54px)/1 system-ui,sans-serif; }
.public-page .poster-placeholder small { margin-top:14px; color:#aeb9c8; letter-spacing:0; font:400 13px/1.4 system-ui,sans-serif; }
.public-page .catalog-card .duration { top:auto; bottom:9px; right:9px; padding:2px 6px; border-radius:3px; background:#000b; color:white; font:500 12px/1.5 system-ui,sans-serif; }
.public-page .catalog-card .play-disc { display:grid; place-items:center; position:absolute; left:50%; top:50%; transform:translate(-50%,-50%); width:46px; height:46px; background:#0009; border:1px solid #ffffff65; border-radius:50%; color:white; opacity:0; transition:opacity var(--motion-fast); }
.public-page .catalog-card .clip-info { position:relative; display:block; padding:12px 0 0; background:none; height:auto; }
.public-page .catalog-card .clip-info h2 { color:var(--ink); margin:0 0 6px; font-size:17px; font-weight:650; line-height:1.35; letter-spacing:-.02em; display:-webkit-box; -webkit-line-clamp:2; -webkit-box-orient:vertical; overflow:hidden; }
.public-page .catalog-card .creator { display:flex; flex-wrap:wrap; gap:4px 12px; font:12px/1.5 system-ui,sans-serif; color:var(--muted); margin:0; }
.public-page .catalog-card .creator strong { font-weight:450; color:#c2c8d1; }
.public-page .catalog-card .clip-caption { position:absolute; inset:100% 0 auto; z-index:4; padding:12px; background:#202630; border-radius:4px; font-size:12px; opacity:0; visibility:hidden; transition:opacity var(--motion-fast); pointer-events:none; display:-webkit-box; -webkit-line-clamp:3; -webkit-box-orient:vertical; overflow:hidden; }
.public-page .catalog-card .preview-toolbar:not(:focus-within) { position:absolute; width:1px; height:1px; overflow:hidden; clip-path:inset(50%); padding:0; border:0; }
.public-page .catalog-card.is-selected .poster { outline:2px solid var(--lime); outline-offset:3px; }
.on-screen { position:absolute; top:9px; left:9px; background:#000c; color:var(--lime); padding:3px 7px; font-size:11px; border-radius:3px; }
.public-page .catalog-card.is-selected .on-screen { display:block !important; }
@media(hover:hover) and (pointer:fine) { .public-page .catalog-card:hover .poster { transform:translateY(-3px); }.public-page .catalog-card:hover .play-disc { opacity:1; }.public-page .catalog-card:hover .clip-caption { opacity:1; visibility:visible; transition-delay:300ms; } }
.public-page .catalog-card:focus-within .play-disc { opacity:1; }
.public-page .catalog-card:not(.previewing):hover .poster img { transform:none; }
.public-page .empty-results { padding:32px 0; border:0; background:none; }
.archive-invitation { display:flex; justify-content:space-between; align-items:center; gap:24px; padding:48px 0 56px; margin-top:36px; border-top:1px solid #ffffff14; }
.archive-invitation h2 { font-size:24px; letter-spacing:-.035em; margin:0 0 8px; }
.archive-invitation p { font-size:14px; color:var(--muted); margin:0; }
.public-page .button,.public-page button { border-radius:5px; }
.public-page footer { background:#0d1014; border-color:#ffffff14; padding-top:28px; }
.public-page .footer-main { grid-template-columns:1fr 1fr; gap:24px; padding-bottom:20px; }
.public-page .footer-statement { font-size:22px; }
.public-page .footer-credit { display:none; }
.public-page .footer-bottom { border-color:#ffffff14; }
.public-page .sr-only { position:absolute; width:1px; height:1px; margin:-1px; padding:0; overflow:hidden; clip-path:inset(50%); }
.public-page #seleccion,.public-page #buscar { scroll-margin-top:20px; }
.public-page :is(a,button,input,select,summary):focus-visible { outline:3px solid var(--lime); outline-offset:4px; }
@media(min-width:1600px) { .public-page .catalog-grid { grid-template-columns:repeat(4,minmax(0,1fr)); } }
@media(max-width:1050px) { .public-page .catalog-grid { grid-template-columns:repeat(2,minmax(0,1fr)); }.public-page .catalog-search { flex:1 1 250px; }.public-page .hero-preview .preview-stage { height:clamp(240px,48vw,500px); } }
@media(max-width:650px) {
 .public-page header { min-height:64px; padding-block:10px; gap:10px; flex-wrap:wrap; }
 .public-page .brand { font-size:23px; }.public-page .brand-caption { display:none; }
 .public-page header nav { gap:0; }.public-page header nav a { padding:10px; font-size:12px; }.public-page header .nav-selection { display:inline-flex; }
 .cinema-intro { font-size:11px; gap:12px; min-height:46px; }.cinema-intro a { text-align:right; }
 .public-page .hero-preview .preview-stage { height:auto; aspect-ratio:16/9; min-height:200px; border-radius:3px; }
 .public-page .hero-preview .preview-stage[data-provider=x] { aspect-ratio:auto; }
 .public-page .hero-preview .preview-stage[data-orientation=portrait] { height:min(110vw,540px); aspect-ratio:auto; }
 .cinema-details { flex-direction:column; gap:14px; padding-block:18px 0; }
 .public-page .cinema h1 { font-size:27px; max-width:none; }.public-page .featured-credit { font-size:12px; }
 .cinema-actions { width:100%; max-width:none; flex-direction:row; align-items:start; justify-content:space-between; gap:16px; }
 .public-page .hero-preview .preview-toolbar { align-items:start; max-width:60%; }
 .public-page .catalog-section { margin-top:32px; }.public-page .section-heading { gap:10px; align-items:start; }.public-page .section-heading h2 { font-size:23px; }.public-page .section-intro { font-size:12px; }
 .public-page .discovery-toolbar { gap:10px; }.public-page .filters { flex-basis:100%; flex-wrap:nowrap; overflow-x:auto; padding-block:3px; }.public-page .filters a { white-space:nowrap; padding-inline:12px; }
 .public-page .catalog-search { flex:1 1 190px; }.catalog-sort { flex:1 1 auto; }.catalog-sort select { flex:1; }
 .public-page .catalog-grid { gap:25px 14px; }.public-page .catalog-card .clip-info h2 { font-size:15px; }.public-page .catalog-card .creator { font-size:11px; }
 .public-page .catalog-card .play-disc { opacity:1; width:34px; height:34px; font-size:12px; }
 .archive-invitation { align-items:start; flex-direction:column; padding-block:32px; margin-top:28px; }.archive-invitation h2 { font-size:22px; }
 .public-page .footer-main { grid-template-columns:1fr; }
}
@media(max-width:480px) { .public-page .catalog-grid { grid-template-columns:minmax(0,1fr); }.public-page .catalog-card .clip-info h2 { font-size:17px; }.public-page .catalog-card .creator { font-size:12px; }.public-page .catalog-search { flex-basis:100%; }.public-page header nav a { padding-inline:8px; } }
.public-page .cinema { position:relative; isolation:isolate; }
.public-page .cinema::before { content:""; position:absolute; inset:0 0 auto; height:min(80%,620px); z-index:-1; pointer-events:none; background:radial-gradient(40% 55% at 20% 30%,#d8ff6526,transparent 70%),radial-gradient(35% 50% at 80% 20%,#5b8cff22,transparent 70%),radial-gradient(45% 60% at 55% 80%,#ff5bd01a,transparent 70%); background-size:140% 140%; animation:aurora 24s ease-in-out infinite alternate; -webkit-mask-image:linear-gradient(#000 40%,transparent); mask-image:linear-gradient(#000 40%,transparent); }
html[data-calm] .public-page .cinema::before { animation:none; }
@keyframes aurora { from { background-position:0% 0%; } to { background-position:100% 60%; } }
.public-page .catalog-grid.js-reveal .catalog-card:not(.revealed) { opacity:0; transform:translateY(18px); }
.public-page .catalog-grid.js-reveal .catalog-card { transition:opacity 480ms ease,transform 480ms cubic-bezier(.2,.7,.2,1); transition-delay:calc(var(--reveal-i,0)*45ms); }
@media(prefers-reduced-motion:reduce) { .public-page *, .public-page *::before,.public-page *::after { scroll-behavior:auto !important; transition:none !important; animation:none !important; }.public-page .catalog-card:hover .poster { transform:none; }.public-page .cinema::before { animation:none; }.public-page .catalog-grid.js-reveal .catalog-card:not(.revealed) { opacity:1; transform:none; } }
`;
