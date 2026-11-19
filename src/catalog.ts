import { previewScript } from "./preview";
import { categories, esc, type Clip, type Edition } from "./model";

const descriptions: Record<string, string> = {
  Fails: "Cuando el plan se rompe.",
  Jugadas: "Momentos que merecen el replay.",
  Detalles: "Lo pequeño también cuenta.",
  Reacciones: "El directo, sin filtro.",
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
  return `<article class="clip catalog-card ${c.id === e.featured ? "featured" : ""}" id="clip-${esc(c.id)}" data-preview="${esc(c.id)}" data-preview-title="${esc(c.title)}"><div class="preview-stage" hidden></div><a class="clip-link" data-source href="${esc(c.url)}" target="_blank" rel="noopener noreferrer" aria-label="Ver en Twitch: ${esc(c.title)} · ${esc(c.streamer)}"><div class="poster poster-${esc(c.category.toLowerCase())}"><span class="poster-placeholder" aria-hidden="true">GK<span>${esc(c.category)}</span></span>${poster(c)}<span class="card-rank" aria-label="Posición ${position}">${String(position).padStart(2, "0")}</span><span class="play-disc" aria-hidden="true">▶</span><span class="duration">${duration(c)}</span>${c.id === e.featured ? '<span class="featured-label">Destacado</span>' : ""}</div><div class="clip-info"><p class="eyebrow">${esc(c.category)}</p><h2>${esc(c.title)}</h2><p class="clip-caption">${esc(c.text)}</p><p class="creator">Por <strong>${esc(c.streamer)}</strong> · Twitch</p><span class="source">Ver en Twitch <span aria-hidden="true">▶</span></span></div></a><div class="preview-toolbar" hidden><button type="button" data-preview-toggle aria-pressed="false">Vista previa</button><span class="preview-status" role="status"></span></div></article>`;
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
      .toLocaleLowerCase("es");
  const filtered = e.clips.filter(
    (c) =>
      (!category || c.category === category) &&
      (!q ||
        normalize(`${c.title} ${c.streamer} ${c.text}`).includes(normalize(q))),
  );
  const featured = e.clips.find((c) => c.id === e.featured) || e.clips[0];
  const date = new Intl.DateTimeFormat("es-ES", {
    dateStyle: "long",
    timeZone: "UTC",
  }).format(new Date(e.date + "T12:00:00Z"));
  const demo = e.demo
    ? '<aside class="demo-banner"><strong>DEMOSTRACIÓN · Datos de prueba</strong><span>Selección para probar la web. Los enlaces pueden abrir clips reales; comprueba contexto y permisos antes de publicar una edición editorial.</span></aside>'
    : "";
  if (!featured)
    return `<section class="empty-state"><p class="eyebrow">GtaKlips · ${esc(date)}</p><h1>${esc(e.title)}</h1><p class="lead">No hay clips disponibles en esta selección.</p>${demo}<a class="button primary" href="/archivo">Explorar el archivo</a></section>`;
  return `<section class="billboard ${category || q ? "billboard-compact" : ""}" aria-label="El destacado"><div class="billboard-art"><div class="hero-placeholder" aria-hidden="true">GK</div>${poster(featured, true)}</div><div class="billboard-shade"></div><div class="billboard-content"><p class="eyebrow"><span class="live-mark" aria-hidden="true"></span>LA SELECCIÓN · <time datetime="${e.date}">${esc(date)}</time></p><div class="edition-tags"><span>Curación en español</span><span>${e.clips.length} clips</span><span>Fuente: Twitch</span></div><h1>${esc(e.title)}</h1><p class="billboard-description">${esc(e.intro)}</p><p class="featured-credit"><span>EL DESTACADO</span> ${esc(featured.title)} · ${esc(featured.streamer)}</p><div class="billboard-actions"><a class="button primary play-primary" data-source href="${esc(featured.url)}" target="_blank" rel="noopener noreferrer"><span aria-hidden="true">▶</span> Reproducir en Twitch</a><a class="button secondary" href="#seleccion">Explorar selección</a></div><p class="playback-note">Inicio sin sonido. Twitch puede pedir confirmación; siempre puedes abrir el original.</p></div><div class="hero-preview" data-preview="${esc(featured.id)}" data-preview-title="${esc(featured.title)}" data-preview-hero><div class="preview-stage">${poster(featured)}<span class="preview-placeholder">El destacado · Twitch</span></div><div class="preview-toolbar" hidden><button type="button" data-preview-toggle aria-pressed="false">Vista previa</button><span class="preview-status" role="status"></span></div><a class="preview-source" href="${esc(featured.url)}" target="_blank" rel="noopener noreferrer">Abrir original en Twitch</a></div><span class="billboard-index" aria-hidden="true">GTAKLIPS / SELECCIÓN DIARIA</span></section><div class="catalog-body">${demo}<section class="catalog-section" id="seleccion"><div class="section-heading"><div><p class="eyebrow">ELIGE TU PRÓXIMO MOMENTO</p><h2>${q ? "Resultados de búsqueda" : category ? esc(category) : "Los clips de hoy"}</h2></div><div class="rail-controls" hidden><button type="button" data-rail="clips-rail" data-direction="-1" aria-label="Clips anteriores">Anterior</button><button type="button" data-rail="clips-rail" data-direction="1" aria-label="Clips siguientes">Siguiente</button></div></div><nav class="filters" aria-label="Categorías">${["Todos", ...categories].map((c) => `<a href="${esc(editionURL(e, c === "Todos" ? undefined : c, q))}" ${(!category && c === "Todos") || category === c ? 'aria-current="page"' : ""}>${c}</a>`).join("")}</nav><form class="catalog-search" role="search" action="/dia/${e.date}" method="get"><label for="clip-search">Encuentra un clip o un creador</label><div><input id="clip-search" name="q" type="search" maxlength="80" placeholder="Buscar en esta selección" value="${esc(q)}">${category ? `<input type="hidden" name="categoria" value="${esc(category)}">` : ""}<button type="submit">Buscar</button></div></form><p class="result-count">${filtered.length} ${filtered.length === 1 ? "clip disponible" : "clips disponibles"}${q ? ` para «${esc(q)}»` : ""}</p>${filtered.length ? `<div class="catalog-rail" id="clips-rail" tabindex="0" aria-label="Clips de la selección">${filtered.map((c) => card(c, e)).join("")}</div>` : '<div class="empty-results"><h3>No hay clips con esa selección.</h3><p>Prueba otra búsqueda o vuelve a Todos.</p></div>'}</section>${
    !category && !q
      ? `<section class="catalog-section genre-section"><div class="section-heading"><div><p class="eyebrow">SIGUE TU CURIOSIDAD</p><h2>¿Qué te apetece ver?</h2></div><a class="text-link" href="/archivo">Todas las ediciones</a></div><div class="genre-grid">${categories
          .map((c) => {
            const sample = e.clips.find((clip) => clip.category === c);
            return `<a class="genre-card genre-${c.toLowerCase()}" href="${esc(editionURL(e, c))}">${sample ? poster(sample) : ""}<span><strong>${c}</strong><small>${descriptions[c]}</small></span></a>`;
          })
          .join("")}</div></section>`
      : ""
  }<p class="catalog-endnote">La selección termina aquí. El archivo tiene los demás días.</p></div>`;
}
export const emptyView = `<section class="empty-state"><p class="eyebrow">GTA VI · CURACIÓN EN ESPAÑOL</p><h1>Un buen momento.<br>Y otro después.</h1><p class="lead">Clips, contexto y sus creadores. La primera selección está en camino.</p><a class="button primary" href="/archivo">Explorar el archivo</a></section>`;
export const catalogScript =
  previewScript +
  `
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
