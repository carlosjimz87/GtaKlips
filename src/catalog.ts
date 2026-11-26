import { source, providerName } from "./source";
import { previewScript } from "./preview";
import {
  categories,
  categoryLabels,
  credit,
  esc,
  type Clip,
  type Edition,
} from "./model";

const descriptions: Record<string, string> = {
  Fails: "When the plan falls apart.",
  Jugadas: "Moments worth a replay.",
  Detalles: "The small things count too.",
  Reacciones: "Live, unfiltered.",
};
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
    ? `<img data-poster src="${esc(c.thumbnail)}" alt="${hero ? "" : esc(c.title)}" ${hero ? 'fetchpriority="high" loading="eager"' : 'loading="lazy"'} decoding="async" width="${hero ? 1920 : 480}" height="${hero ? 1080 : 270}">`
    : "";
}
function duration(c: Clip): string {
  return c.duration
    ? `${Math.floor(c.duration / 60)}:${String(Math.floor(c.duration % 60)).padStart(2, "0")}`
    : "Clip";
}
function editionURL(e: Edition, category?: string, q = ""): string {
  const p = new URLSearchParams();
  if (category) p.set("categoria", category);
  if (q) p.set("q", q);
  return `/dia/${e.date}${p.size ? "?" + p : ""}#seleccion`;
}
function initial(c: Clip): string {
  const who = (c.streamer || c.creator || "").replace(/^[@\s]+/, "");
  return who ? Array.from(who)[0].toUpperCase() : "?";
}
function card(c: Clip, e: Edition): string {
  const position = e.clips.indexOf(c) + 1;
  const link = source(c.url),
    name = providerName(link.provider);
  return `<article class="clip catalog-card ${c.id === e.featured ? "featured" : ""}" id="clip-${esc(c.id)}" data-provider="${link.provider}" data-source-url="${esc(link.url)}" data-orientation="${esc(c.orientation || "auto")}" data-preview="${esc(link.sourceId)}" data-preview-title="${esc(c.title)}"><a class="clip-link" data-source href="${esc(c.url)}" target="_blank" rel="noopener noreferrer"><div class="poster poster-${esc(c.category.toLowerCase())}"><span class="poster-placeholder" aria-hidden="true">GK<span>${esc(categoryLabels[c.category] || c.category)}</span></span>${poster(c)}<span class="play-disc" aria-hidden="true">▶</span><span class="duration">${duration(c)}</span>${c.id === e.featured ? '<span class="featured-label">Featured</span>' : ""}</div><div class="clip-info"><div class="card-heading"><span class="card-rank" aria-label="Position ${position} of ${e.clips.length}">${String(position).padStart(2, "0")}<small aria-hidden="true"> / ${String(e.clips.length).padStart(2, "0")}</small></span><p class="eyebrow">${esc(categoryLabels[c.category] || c.category)}</p></div><p class="creator"><span class="creator-badge" aria-hidden="true">${esc(initial(c))}</span><span class="creator-text"><strong>${esc(credit(c))}</strong><small>${name}</small></span></p><h2>${esc(c.title)}</h2><p class="clip-caption">${esc(c.text)}</p><span class="source">Watch on ${name} <span aria-hidden="true">▶</span></span></div></a><div class="preview-toolbar" hidden><button type="button" data-preview-toggle aria-pressed="false">Preview</button><span class="preview-status" role="status"></span></div></article>`;
}
function rail(clips: Clip[], e: Edition, i: number, total: number): string {
  const id = i ? `clips-rail-${i + 1}` : "clips-rail",
    label = total > 1 ? ` (row ${i + 1} of ${total})` : "";
  return `<div class="rail-row" data-rail-row><div class="rail-controls rail-sr" hidden><button type="button" data-rail="${id}" data-direction="-1" aria-label="Previous clips${label}"><span aria-hidden="true">‹</span></button><button type="button" data-rail="${id}" data-direction="1" aria-label="Next clips${label}"><span aria-hidden="true">›</span></button></div><div class="catalog-rail" id="${id}" tabindex="0" aria-label="Clips in this selection${label}">${clips.map((c) => card(c, e)).join("")}</div></div>`;
}
export function editionView(
  e: Edition,
  category: string | null,
  query = "",
): string {
  const q = query.trim().slice(0, 80);
  const normalize = (s: string) =>
    s
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .toLocaleLowerCase("en");
  const filtered = e.clips.filter(
    (c) =>
      (!category || c.category === category) &&
      (!q ||
        normalize(
          `${c.title} ${c.streamer} ${c.creator || ""} ${c.text}`,
        ).includes(normalize(q))),
  );
  const rows = distributeRows(filtered);
  // Empty categories are dead ends: only offer those that have clips (plus the active one).
  const available = categories.filter(
    (c) => e.clips.some((clip) => clip.category === c) || c === category,
  );
  const featured = e.clips.find((c) => c.id === e.featured) || e.clips[0];
  const date = new Intl.DateTimeFormat("en-US", {
    dateStyle: "long",
    timeZone: "UTC",
  }).format(new Date(e.date + "T12:00:00Z"));
  const demo = e.demo
    ? '<aside class="demo-banner"><strong>DEMO · Test data</strong><span>A selection for testing the site. Links may open real clips; check context and permissions before publishing an editorial edition.</span></aside>'
    : "";
  if (!featured)
    return `<section class="empty-state"><p class="eyebrow">GtaKlips · ${esc(date)}</p><h1>${esc(e.title)}</h1><p class="lead">No clips are available in this selection.</p>${demo}<a class="button primary" href="/archivo">Explore the archive</a></section>`;
  const link = source(featured.url),
    name = providerName(link.provider);
  return `<section class="billboard ${category || q ? "billboard-compact" : ""}" aria-label="Featured clip"><div class="billboard-art"><div class="hero-placeholder" aria-hidden="true">GK</div>${poster(featured, true)}</div><div class="billboard-shade"></div><div class="billboard-content"><p class="eyebrow"><span class="live-mark" aria-hidden="true"></span>EDITION · <time datetime="${e.date}">${esc(date)}</time> · ${esc(e.title)}</p><div class="edition-tags"><span>GTA VI</span><span>${e.clips.length} ${e.clips.length === 1 ? "clip" : "clips"} with context</span><span>Curated in English</span></div><h1>${esc(featured.title)}</h1><p class="billboard-description">${esc(featured.text)}</p><div class="featured-mobile"><p class="eyebrow">FEATURED</p><p class="featured-credit"><strong>${esc(featured.title)}</strong><br>${esc(credit(featured))} · ${name}</p></div><div class="billboard-actions"><a class="button primary play-primary" data-source href="${esc(featured.url)}" target="_blank" rel="noopener noreferrer"><span aria-hidden="true">▶</span> Play on ${name}</a><a class="text-link" href="#seleccion">Explore selection</a></div></div><div class="hero-preview" data-provider="${link.provider}" data-source-url="${esc(link.url)}" data-orientation="${esc(featured.orientation || "auto")}" data-preview="${esc(link.sourceId)}" data-preview-title="${esc(featured.title)}" data-preview-hero><div class="preview-heading"><p class="eyebrow">FEATURED <span>${String(e.clips.indexOf(featured) + 1).padStart(2, "0")} / ${String(e.clips.length).padStart(2, "0")}</span></p><h2>${esc(featured.title)}</h2><p class="featured-credit"><strong>${esc(credit(featured))}</strong> · ${name}</p></div><div class="preview-stage">${poster(featured)}<span class="preview-placeholder">${esc(featured.title)}<small>FEATURED ON ${name.toUpperCase()}</small></span></div><div class="preview-toolbar" hidden><button type="button" data-preview-toggle aria-pressed="false">Preview</button><span class="preview-status" role="status"></span></div><a class="preview-source" href="${esc(featured.url)}" target="_blank" rel="noopener noreferrer">Open original on ${name}</a></div><span class="billboard-index" aria-hidden="true">GTAKLIPS / LIVE, IN A FEW MOMENTS</span></section><div class="catalog-body">${demo}<section class="catalog-section" id="seleccion"><div class="section-heading"><div><p class="eyebrow">THE SELECTION / ${String(e.clips.length).padStart(2, "0")} MOMENTS</p><h2>${q ? "Search results" : category ? esc(categoryLabels[category] || category) : "Hit the next moment."}</h2>${!q && !category ? `<p class="section-intro">${esc(e.intro)}</p>` : ""}</div><div class="section-tools"><button class="share-edition" type="button" data-share-edition hidden>Copy edition link <span aria-hidden="true">↗</span></button><span class="share-status" role="status" aria-live="polite"></span></div></div><div class="discovery-toolbar"><nav class="filters" aria-label="Categories">${["Todos", ...available].map((c) => `<a href="${esc(editionURL(e, c === "Todos" ? undefined : c, q))}" ${(!category && c === "Todos") || category === c ? 'aria-current="page"' : ""}>${c === "Todos" ? "All" : categoryLabels[c]}</a>`).join("")}</nav><form class="catalog-search" id="buscar" tabindex="-1" role="search" action="/dia/${e.date}" method="get"><label for="clip-search">Find a clip or a creator</label><div><input id="clip-search" name="q" type="search" maxlength="80" placeholder="Search this selection" value="${esc(q)}">${category ? `<input type="hidden" name="categoria" value="${esc(category)}">` : ""}<button type="submit">Search</button></div></form></div><p class="result-count">${filtered.length} ${filtered.length === 1 ? "clip available" : "clips available"}${q ? ` for “${esc(q)}”` : ""}</p>${filtered.length ? `<div class="catalog-rows">${rows.map((row, i) => rail(row, e, i, rows.length)).join("")}</div>` : `<div class="empty-results"><span class="eyebrow">TRY A DIFFERENT ANGLE</span><h3>No clips match that selection.</h3><p>Try another search or explore the full edition.</p><a class="button secondary" href="${esc(editionURL(e))}">Clear filters</a></div>`}</section>${
    !category && !q
      ? `<section class="catalog-section genre-section"><div class="section-heading"><div><p class="eyebrow">FOLLOW YOUR CURIOSITY</p><h2>What do you feel like watching?</h2></div><a class="text-link" href="/archivo">All editions</a></div><div class="genre-grid">${categories
          .filter((c) => e.clips.some((clip) => clip.category === c))
          .map((c) => {
            const sample = e.clips.find((clip) => clip.category === c);
            return `<a class="genre-card genre-${c.toLowerCase()}" href="${esc(editionURL(e, c))}">${sample ? poster(sample) : ""}<span><strong>${categoryLabels[c]}</strong><small>${descriptions[c]}</small></span></a>`;
          })
          .join("")}</div></section>`
      : ""
  }<p class="catalog-endnote">End of this edition. There are more moments in the archive.</p></div>`;
}
export const emptyView = `<section class="empty-state"><p class="eyebrow">GTA VI · CURATED IN ENGLISH</p><h1>One good moment.<br>Then another.</h1><p class="lead">Clips, context and their creators. The first selection is on its way.</p><a class="button primary" href="/archivo">Explore the archive</a></section>`;
export const catalogScript =
  previewScript +
  `
const shareEdition = document.querySelector('[data-share-edition]');
if (shareEdition && navigator.clipboard?.writeText) {
  shareEdition.hidden = false;
  shareEdition.addEventListener('click', async () => {
    const status = document.querySelector('.share-status');
    const canonical = document.querySelector('link[rel=canonical]')?.href || location.href;
    try { await navigator.clipboard.writeText(canonical); status.textContent = 'Edition link copied.'; }
    catch { status.textContent = 'Copy the address from your browser to share this edition.'; }
  });
}
const searchInput = document.querySelector('#buscar input[type=search]');
if (searchInput) {
  for (const link of document.querySelectorAll('a[href="#buscar"]')) link.addEventListener('click', () => setTimeout(() => searchInput.focus({preventScroll: true}), 0));
  const focusSearch = () => { if (location.hash === '#buscar') searchInput.focus({preventScroll: true}); };
  addEventListener('hashchange', focusSearch);
  addEventListener('pageshow', () => requestAnimationFrame(focusSearch));
}
for (const img of document.querySelectorAll('img[data-poster]')) {
  const fallback = () => { img.hidden = true; img.parentElement.classList.add('image-unavailable'); };
  img.addEventListener('error', fallback);
  if (img.complete && !img.naturalWidth) fallback();
}
const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)');
document.querySelectorAll('[data-rail-row]').forEach(row => {
  const rail = row.querySelector('.catalog-rail');
  const controls = row.querySelector('.rail-controls');
  const buttons = [...controls.querySelectorAll('[data-rail]')];
  controls.hidden = false;
  const max = () => rail.scrollWidth - rail.clientWidth;
  const update = () => { buttons[0].disabled = rail.scrollLeft <= 1; buttons[1].disabled = rail.scrollLeft >= max() - 2; row.classList.toggle('can-prev', rail.scrollLeft > 1); row.classList.toggle('can-next', rail.scrollLeft < max() - 2); };
  for (const button of buttons) button.addEventListener('click', () => rail.scrollBy({left: Number(button.dataset.direction) * rail.clientWidth * .8, behavior: reducedMotion.matches ? 'auto' : 'smooth'}));
  rail.addEventListener('scroll', update, {passive: true});
  addEventListener('resize', update);
  update();
});
`;
