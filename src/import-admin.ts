import type { Env } from "./auth";
import { esc } from "./model";
import type { Candidate, ImportRun } from "./importer";
const summaries: Record<string, string> = {
  missing_config:
    "Falta configurar la aplicación Twitch en el entorno. No se ha consultado Twitch.",
  invalid_config: "Configuración Twitch no válida.",
  unauthorized:
    "Twitch rechazó las credenciales o el token. Revisa la aplicación antes de reintentar.",
  rate_limit: "Límite de Twitch alcanzado. Reintenta más tarde.",
  upstream: "Twitch no está disponible o rechazó la solicitud.",
  malformed: "Respuesta Twitch no válida.",
  network: "Fallo de conexión con Twitch.",
  timeout: "Twitch excedió el tiempo máximo de respuesta.",
  too_large: "Respuesta Twitch demasiado grande.",
  game_absent:
    "Twitch no devuelve la categoría exacta Grand Theft Auto VI. No se importó otra categoría.",
  game_mismatch:
    "La categoría devuelta no coincide exactamente con Grand Theft Auto VI y el ID solicitado.",
  invalid_clip:
    "Metadatos de clip no válidos. La página afectada no se guardó.",
  page_limit:
    "Se alcanzó el límite de páginas: resultados parciales, no exhaustivos.",
  repeated_cursor:
    "Twitch repitió un cursor: resultados parciales, no exhaustivos.",
  overlap: "Ya hay una importación en curso. No se inició otra.",
  lease_expired:
    "Importación interrumpida: venció su bloqueo. Se permite un nuevo intento.",
  storage: "No se pudo completar el almacenamiento.",
};
export async function importPage(
  env: Env,
  before: string | null,
): Promise<string> {
  const offset = before && /^\d{1,6}$/.test(before) ? Number(before) : 0;
  const [runs, candidates] = await Promise.all([
    env.DB.prepare(
      "SELECT * FROM import_runs ORDER BY started_at DESC,id DESC LIMIT 10",
    ).all<ImportRun>(),
    env.DB.prepare(
      "SELECT * FROM candidates ORDER BY created_at DESC,id LIMIT 21 OFFSET ?",
    )
      .bind(offset)
      .all<Candidate>(),
  ]);
  return `<section class="hero"><p class="eyebrow">Twitch · privado</p><h1>Importaciones y candidatos</h1><a href="/admin">Editor manual</a><p>Ventana fija de las últimas 24 horas. Hasta 5 páginas de 100 clips. Una importación nunca publica ni cambia ediciones.</p><button id="import">Importar / reintentar</button><p role="status" id="import-status">Revisa fuentes, disponibilidad y derechos antes de usar un clip.</p></section>
  <h2>Últimas ejecuciones</h2>${runs.results.length ? runs.results.map((r) => `<article class="clip import-run"><h3>${esc(r.status)} · ${esc(r.trigger)}</h3><p>${esc(r.started_at)} → ${esc(r.finished_at || "En curso; bloqueo máximo 60 s")}</p><p>Ventana UTC: ${esc(r.window_start)} → ${esc(r.window_end)}</p><p>${r.requests} solicitudes · ${r.pages} páginas · ${r.found} encontrados · ${r.saved} candidatos únicos guardados</p>${r.game_id ? `<p>Categoría confirmada en esta ejecución: ${esc(r.game_name)} · ID ${esc(r.game_id)}</p>` : "<p>Sin categoría confirmada en esta ejecución.</p>"}${r.error_code ? `<p class="notice">${esc(summaries[r.error_code] || "Importación no completada.")} (${esc(r.error_code)})</p>` : ""}${r.status === "partial" ? "<p>No es una lista exhaustiva.</p>" : ""}</article>`).join("") : "<p>Todavía no hay ejecuciones. La categoría no está verificada.</p>"}
  <h2>Candidatos privados</h2><p>20 por página · más recientes primero. Seleccionar no equivale a aprobar derechos ni publicar.</p><div class="grid">${candidates.results
    .slice(0, 20)
    .map(
      (c) =>
        `<article class="clip candidate"><h3>${esc(c.title)}</h3><p>Por ${esc(c.streamer)} · ${esc(c.language)} · ${esc(c.duration)} s</p><p>${c.views} vistas observadas · ${esc(c.observed_at)}</p><p>Creado: ${esc(c.created_at)} · Estado: <strong>${esc(c.review_state)}</strong></p><a href="${esc(c.url)}" target="_blank" rel="noopener noreferrer">Revisar en Twitch ↗</a><div class="toolbar">${[
          ["pending", "Pendiente"],
          ["selected", "Seleccionar"],
          ["rejected", "Rechazar"],
        ]
          .map(
            ([state, label]) =>
              `<button data-id="${esc(c.id)}" data-state="${state}">${label}</button>`,
          )
          .join(
            "",
          )}</div><a class="button" href="/admin?candidate=${encodeURIComponent(c.id)}">Usar en editor</a><p class="meta">Solo rellena fuente, autor y título. Añade tu contexto original y decide la publicación en el editor.</p></article>`,
    )
    .join(
      "",
    )}</div>${!candidates.results.length ? "<p>No hay candidatos en esta página.</p>" : ""}<nav aria-label="Páginas de candidatos">${offset ? '<a href="/admin/imports">Primeros candidatos</a>' : ""} ${candidates.results.length > 20 ? `<a href="/admin/imports?offset=${offset + 20}">Siguientes candidatos</a>` : ""}</nav><script src="/admin/imports.js" defer></script>`;
}
export const importScript = `
const status = document.querySelector('#import-status');
async function action(path, body) {
  const buttons = [...document.querySelectorAll('button')];
  buttons.forEach(b => b.disabled = true);
  status.textContent = 'Procesando…';
  try {
    const response = await fetch(path, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
    if (!response.ok) throw Error('No se pudo completar la acción. Recarga y comprueba tu acceso.');
    location.reload();
  } catch (e) { status.textContent = e.message; buttons.forEach(b => b.disabled = false); }
}
document.querySelector('#import').onclick = () => action('/admin/import', {});
document.querySelectorAll('[data-state]').forEach(b => b.onclick = () => action('/admin/candidates/review', { id: b.dataset.id, state: b.dataset.state }));
`;
