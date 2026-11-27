import { source, providerName } from "./source";
import { previewScript } from "./preview";
import { discoveryScript } from "./discovery";
import {
  categories,
  categoryLabels,
  credit,
  esc,
  type Clip,
  type Edition,
} from "./model";

/**
 * Public grid layout. Tune here: number of carousel rows and clips per row.
 */
export const catalogConfig = {
  ROWS: 3,
  VIDEOS_PER_ROW: 6,
  // Editions hold at most 10 clips: never split into rows shorter than this.
  MIN_VIDEOS_PER_ROW: 3,
} as const;
/**
 * Splits clips (in order) over up to `rows` rows of about `perRow` clips each.
 * Rows are balanced (sizes differ by at most one) and, when there are enough
 * clips, split into up to `rows` rows of at least `minPerRow` clips. Clips beyond rows*perRow are
 * kept by growing the rows instead of being dropped.
 */
export function distributeRows<T>(
  clips: readonly T[],
  rows: number = catalogConfig.ROWS,
  perRow: number = catalogConfig.VIDEOS_PER_ROW,
  minPerRow: number = catalogConfig.MIN_VIDEOS_PER_ROW,
): T[][] {
  const maxRows = Math.max(1, Math.floor(rows)),
    size = Math.max(1, Math.floor(perRow));
  if (!clips.length) return [];
  const wanted = Math.max(
    Math.ceil(clips.length / size),
    Math.floor(clips.length / Math.max(1, Math.floor(minPerRow))),
  );
  const used = Math.min(maxRows, wanted);
  const base = Math.floor(clips.length / used),
    extra = clips.length % used;
  const out: T[][] = [];
  let at = 0;
  for (let r = 0; r < used; r++) {
    const n = base + (r < extra ? 1 : 0);
    out.push(clips.slice(at, at + n));
    at += n;
  }
  return out;
}
function poster(c: Clip, hero = false): string {
  return c.thumbnail
    ? `<img data-poster src="${esc(c.thumbnail)}" alt="" ${hero ? 'fetchpriority="high" loading="eager"' : 'loading="lazy"'} decoding="async" width="1280" height="720">`
    : "";
}
function attributes(c: Clip): string {
  const s = source(c.url);
  return `data-provider="${s.provider}" data-source-url="${esc(s.url)}" data-orientation="${esc(c.orientation || "auto")}" data-preview="${esc(s.sourceId)}" data-preview-title="${esc(c.title)}" data-preview-credit="${esc(credit(c))}" data-preview-context="${esc(c.text)}" data-preview-poster="${esc(c.thumbnail || "")}"`;
}
function editionURL(e: Edition, category = "", q = ""): string {
  const p = new URLSearchParams();
  if (category) p.set("categoria", category);
  if (q) p.set("q", q);
  return `/dia/${e.date}${p.size ? "?" + p : ""}#seleccion`;
}
function normalize(s: string): string {
  return s
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLocaleLowerCase("en");
}
function card(c: Clip, e: Edition, visible: boolean): string {
  const name = providerName(source(c.url).provider);
  const duration = c.duration
    ? `${Math.floor(c.duration / 60)}:${String(Math.floor(c.duration % 60)).padStart(2, "0")}`
    : "";
  return `<article class="clip catalog-card" id="clip-${esc(c.id)}" ${attributes(c)} data-category="${esc(c.category)}" data-search="${esc(normalize(`${c.title} ${c.streamer} ${c.creator || ""} ${c.text}`))}" data-order="${e.clips.indexOf(c)}" data-duration="${c.duration || 0}" ${visible ? "" : "hidden"}><a class="clip-link" data-source href="${esc(c.url)}" target="_blank" rel="noopener noreferrer"><div class="poster"><span class="poster-placeholder" aria-hidden="true">GtaKlips<small>${esc(categoryLabels[c.category] || c.category)}</small></span>${poster(c)}<span class="play-disc" aria-hidden="true">▶</span>${duration ? `<span class="duration">${duration}</span>` : ""}<span class="on-screen" hidden>On screen</span></div><div class="clip-info"><h2>${esc(c.title)}</h2><p class="creator"><strong>${esc(credit(c))}</strong><span>${name}</span></p><p class="clip-caption">${esc(c.text)}</p></div></a><div class="preview-toolbar" hidden><button type="button" data-preview-toggle aria-pressed="false">Play clip</button><span class="preview-status" role="status"></span></div></article>`;
}
export function editionView(
  e: Edition,
  category: string | null,
  query = "",
): string {
  const q = query.trim().slice(0, 80);
  const matches = (c: Clip) =>
    (!category || c.category === category) &&
    (!q ||
      normalize(
        `${c.title} ${c.streamer} ${c.creator || ""} ${c.text}`,
      ).includes(normalize(q)));
  const available = categories.filter((c) =>
    e.clips.some((clip) => clip.category === c),
  );
  const featured = e.clips.find((c) => c.id === e.featured) || e.clips[0];
  const date = new Intl.DateTimeFormat("en-US", {
    dateStyle: "long",
    timeZone: "UTC",
  }).format(new Date(e.date + "T12:00:00Z"));
  if (!featured)
    return `<section class="empty-state"><h1>${esc(e.title)}</h1><p>No clips in this edition yet.</p><a class="button primary" href="/archivo">Explore the archive</a></section>`;
  const name = providerName(source(featured.url).provider);
  const count = e.clips.filter(matches).length;
  return `<section class="cinema" aria-label="Clip player"><div class="cinema-intro"><p>GTA VI. The moments worth watching.</p><a href="/archivo"><time datetime="${e.date}">${esc(date)}</time></a></div><div class="hero-preview" ${attributes(featured)} data-preview-hero><div class="preview-stage">${poster(featured, true)}<span class="preview-placeholder">GtaKlips<small>${esc(featured.title)}</small></span></div><div class="cinema-details"><div class="cinema-copy"><h1 data-cinema-title>${esc(featured.title)}</h1><p class="featured-credit"><strong data-cinema-credit>${esc(credit(featured))}</strong><span data-cinema-provider>${name}</span></p><details class="cinema-context"><summary>About this clip</summary><p data-cinema-context>${esc(featured.text)}</p></details></div><div class="cinema-actions"><div class="preview-toolbar" hidden><button type="button" data-preview-toggle aria-pressed="false">Play clip</button><span class="preview-status" role="status"></span></div><a class="preview-source" data-source href="${esc(featured.url)}" target="_blank" rel="noopener noreferrer">Open on ${name}</a></div></div></div></section><div class="catalog-body">${e.demo ? '<aside class="demo-banner"><strong>DEMO · Test data</strong><span>A selection for testing the site. Links may open real clips; check context and permissions before publishing an editorial edition.</span></aside>' : ""}<section class="catalog-section" id="seleccion" data-discovery data-edition="${e.date}"><div class="section-heading"><div><h2>Explore the selection</h2><p class="section-intro">${esc(e.intro)}</p></div><div class="section-tools"><button class="share-edition" type="button" data-share-edition hidden>Share edition</button><span class="share-status" role="status"></span></div></div><div class="discovery-toolbar"><nav class="filters" aria-label="Categories">${["", ...available].map((c) => `<a data-category="${c}" href="${esc(editionURL(e, c, q))}" ${(!category && !c) || category === c ? 'aria-current="page"' : ""}>${c ? categoryLabels[c] : "All"}</a>`).join("")}</nav><form class="catalog-search" id="buscar" role="search" action="/dia/${e.date}" method="get"><label class="sr-only" for="clip-search">Find a clip or creator</label><input id="clip-search" name="q" type="search" maxlength="80" placeholder="Search clips or creators" value="${esc(q)}">${category ? `<input type="hidden" name="categoria" value="${esc(category)}">` : ""}<button type="submit" aria-label="Search clips">Search</button></form><label class="catalog-sort" hidden>Sort<select name="sort" aria-label="Sort clips"><option value="editorial">Editorial order</option><option value="title">Title A–Z</option><option value="duration">Shortest first</option></select></label></div><p class="result-count" role="status" aria-live="polite">${count} ${count === 1 ? "clip" : "clips"}</p><div class="catalog-grid catalog-rail" id="clips-rail">${e.clips.map((c) => card(c, e, matches(c))).join("")}</div><div class="empty-results" ${count ? "hidden" : ""}><h3>No clips found.</h3><p>Try a different title, creator or category.</p><a data-clear-filters href="${esc(editionURL(e))}">Clear filters</a></div></section><section class="archive-invitation"><div><h2>There’s always another moment.</h2><p>Discover earlier selections in the archive.</p></div><a class="button secondary" href="/archivo">Browse the archive</a></section></div>`;
}
export const emptyView = `<section class="empty-state"><h1>GTA VI. Worth watching.</h1><p class="lead">Clips, context and their creators. The first selection is on its way.</p><a class="button primary" href="/archivo">Explore the archive</a></section>`;
export const catalogScript = previewScript + discoveryScript;
