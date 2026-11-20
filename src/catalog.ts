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
function card(c: Clip, e: Edition): string {
  const position = e.clips.indexOf(c) + 1;
  const link = source(c.url),
    name = providerName(link.provider);
  return `<article class="clip catalog-card ${c.id === e.featured ? "featured" : ""}" id="clip-${esc(c.id)}" data-provider="${link.provider}" data-source-url="${esc(link.url)}" data-orientation="${esc(c.orientation || "auto")}" data-preview="${esc(link.sourceId)}" data-preview-title="${esc(c.title)}"><a class="clip-link" data-source href="${esc(c.url)}" target="_blank" rel="noopener noreferrer" aria-label="Watch on ${name}: ${position} of ${e.clips.length} · ${esc(c.title)} · ${esc(credit(c))}"><div class="poster poster-${esc(c.category.toLowerCase())}"><span class="poster-placeholder" aria-hidden="true">GK<span>${esc(categoryLabels[c.category] || c.category)}</span></span>${poster(c)}<span class="play-disc" aria-hidden="true">▶</span><span class="duration">${duration(c)}</span>${c.id === e.featured ? '<span class="featured-label">Featured</span>' : ""}</div><div class="clip-info"><div class="card-heading"><span class="card-rank" aria-label="Position ${position} of ${e.clips.length}">${String(position).padStart(2, "0")}<small aria-hidden="true"> / ${String(e.clips.length).padStart(2, "0")}</small></span><p class="eyebrow">${esc(categoryLabels[c.category] || c.category)}</p></div><h2>${esc(c.title)}</h2><p class="clip-caption">${esc(c.text)}</p><p class="creator"><strong>${esc(credit(c))}</strong> · ${name}</p><span class="source">Watch on ${name} <span aria-hidden="true">▶</span></span></div></a><div class="preview-toolbar" hidden><button type="button" data-preview-toggle aria-pressed="false">Preview</button><span class="preview-status" role="status"></span></div></article>`;
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
  return `<section class="billboard ${category || q ? "billboard-compact" : ""}" aria-label="Featured clip"><div class="billboard-art"><div class="hero-placeholder" aria-hidden="true">GK</div>${poster(featured, true)}</div><div class="billboard-shade"></div><div class="billboard-content"><p class="eyebrow"><span class="live-mark" aria-hidden="true"></span>EDITION · <time datetime="${e.date}">${esc(date)}</time></p><div class="edition-tags"><span>GTA VI</span><span>${e.clips.length} ${e.clips.length === 1 ? "clip" : "clips"} with context</span><span>In English</span></div><h1>${esc(e.title)}</h1><p class="billboard-description">${esc(e.intro)}</p><div class="edition-signature"><span>${String(e.clips.length).padStart(2, "0")}</span><p>${e.clips.length === 1 ? "moment picked" : "moments picked"}.<br>With context and credit.</p></div><div class="featured-mobile"><p class="eyebrow">FEATURED</p><p class="featured-credit"><strong>${esc(featured.title)}</strong><br>${esc(credit(featured))} · ${name}</p></div><div class="billboard-actions"><a class="button primary play-primary" data-source href="${esc(featured.url)}" target="_blank" rel="noopener noreferrer"><span aria-hidden="true">▶</span> Play on ${name}</a><a class="button secondary" href="#seleccion">Explore selection</a></div><p class="playback-note">Starts muted. ${name} may ask for confirmation; you can always open the original.</p></div><div class="hero-preview" data-provider="${link.provider}" data-source-url="${esc(link.url)}" data-orientation="${esc(featured.orientation || "auto")}" data-preview="${esc(link.sourceId)}" data-preview-title="${esc(featured.title)}" data-preview-hero><div class="preview-heading"><p class="eyebrow">FEATURED <span>${String(e.clips.indexOf(featured) + 1).padStart(2, "0")} / ${String(e.clips.length).padStart(2, "0")}</span></p><h2>${esc(featured.title)}</h2><p class="featured-credit"><strong>${esc(credit(featured))}</strong> · ${name}</p></div><div class="preview-stage">${poster(featured)}<span class="preview-placeholder">Featured · ${name}</span></div><div class="preview-toolbar" hidden><button type="button" data-preview-toggle aria-pressed="false">Preview</button><span class="preview-status" role="status"></span></div><a class="preview-source" href="${esc(featured.url)}" target="_blank" rel="noopener noreferrer">Open original on ${name}</a></div><span class="billboard-index" aria-hidden="true">GTAKLIPS / LIVE, IN A FEW MOMENTS</span></section><div class="catalog-body">${demo}<section class="catalog-section" id="seleccion"><div class="section-heading"><div><p class="eyebrow">CLIPS WITH CONTEXT. CREATORS WITH NAMES.</p><h2>${q ? "Search results" : category ? esc(categoryLabels[category] || category) : "Hit the next moment."}</h2></div><div class="rail-controls" hidden><button type="button" data-rail="clips-rail" data-direction="-1" aria-label="Previous clips">Previous</button><button type="button" data-rail="clips-rail" data-direction="1" aria-label="Next clips">Next</button></div></div><nav class="filters" aria-label="Categories">${["Todos", ...categories].map((c) => `<a href="${esc(editionURL(e, c === "Todos" ? undefined : c, q))}" ${(!category && c === "Todos") || category === c ? 'aria-current="page"' : ""}>${c === "Todos" ? "All" : categoryLabels[c]}</a>`).join("")}</nav><form class="catalog-search" id="buscar" tabindex="-1" role="search" action="/dia/${e.date}" method="get"><label for="clip-search">Find a clip or a creator</label><div><input id="clip-search" name="q" type="search" maxlength="80" placeholder="Search this selection" value="${esc(q)}">${category ? `<input type="hidden" name="categoria" value="${esc(category)}">` : ""}<button type="submit">Search</button></div></form><p class="result-count">${filtered.length} ${filtered.length === 1 ? "clip available" : "clips available"}${q ? ` for “${esc(q)}”` : ""}</p>${filtered.length ? `<div class="catalog-rail" id="clips-rail" tabindex="0" aria-label="Clips in this selection">${filtered.map((c) => card(c, e)).join("")}</div>` : '<div class="empty-results"><h3>No clips match that selection.</h3><p>Try another search or go back to All.</p></div>'}</section>${
    !category && !q
      ? `<section class="catalog-section genre-section"><div class="section-heading"><div><p class="eyebrow">FOLLOW YOUR CURIOSITY</p><h2>What do you feel like watching?</h2></div><a class="text-link" href="/archivo">All editions</a></div><div class="genre-grid">${categories
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
for (const controls of document.querySelectorAll('.rail-controls')) {
  const buttons = [...controls.querySelectorAll('[data-rail]')];
  const rail = document.getElementById(buttons[0]?.dataset.rail);
  if (!rail) continue;
  controls.hidden = false;
  const update = () => { buttons[0].disabled = rail.scrollLeft <= 1; buttons[1].disabled = rail.scrollLeft + rail.clientWidth >= rail.scrollWidth - 2; };
  for (const button of buttons) button.addEventListener('click', () => rail.scrollBy({left: Number(button.dataset.direction) * rail.clientWidth * .8, behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth'}));
  rail.addEventListener('scroll', update, {passive: true});
  addEventListener('resize', update); update();
}
`;
