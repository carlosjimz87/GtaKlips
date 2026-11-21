import type { Env } from "./auth";
import { getSelection, selectionClips, getCandidate } from "./inbox";
import { dateValid, categories } from "./model";
import { source } from "./source";
import { sensitiveSources } from "./enrichment";
import { enrichmentStatus } from "./enrichment";

interface Row {
  revision: number;
  draft: string;
  published: string | null;
}

/**
 * Quick-publish data: the existing draft (if any) plus the day's selection, with
 * sensible edition defaults. Nothing is stored; the client posts the final
 * edition to the validated /admin/publish endpoint.
 */
export async function quickData(env: Env, date: string) {
  if (!dateValid(date)) throw Error("Fecha no válida");
  const selection = await getSelection(env, date);
  const row = await env.DB.prepare(
    "SELECT revision,draft,published FROM editions WHERE date=?",
  )
    .bind(date)
    .first<Row>();
  const existing = row ? JSON.parse(row.draft) : null;
  const combined: Record<string, any>[] = [...(existing?.clips || [])];
  for (const c of await selectionClips(env, selection))
    if (!combined.some((old) => source(old.url).id === source(c.url).id))
      combined.push({
        url: c.url,
        title: c.title,
        streamer: c.streamer,
        creator: c.creator,
        text: c.text,
        category: c.category,
        orientation: c.orientation,
        thumbnail: c.thumbnail || undefined,
      });
  if (combined.length > 10)
    throw Error("Más de diez clips: ajusta la selección en la bandeja.");
  const flagged = await sensitiveSources(env);
  const clips = combined.map((c) => {
    const link = source(c.url);
    return {
      ...c,
      id: link.id,
      sensitive: flagged.has(link.provider + ":" + link.sourceId),
    };
  });
  return {
    enrichment: await Promise.all(
      clips.map(async (clip) => ({
        id: clip.id,
        candidate: await getCandidate(env, clip.id),
        job: await enrichmentStatus(env, clip.id),
      })),
    ),
    revision: row?.revision || 0,
    published: !!row?.published,
    categories,
    publishEnabled: env.X_PUBLISH_ENABLED === "true" && !!env.X_ACCESS_TOKEN,
    edition: {
      date,
      title: existing?.title || `GTAKlips · ${date}`,
      intro:
        existing?.intro ||
        "The best GTA VI moments of the day, hand-picked from the community.",
      hook: existing?.hook || "",
      featured: existing?.featured || clips[0]?.id || "",
      clips,
    },
  };
}

export const quickScript = `
const params = new URL(location.href).searchParams;
const date = params.get("date") || new Date().toISOString().slice(0, 10);
const $ = (s) => document.querySelector(s);
const status = $("#status");
let revision = 0, boxes = [], xInfo = {};
let finished = false, publishing = false, latest = null, pollTimer;
const fields = ["title", "streamer", "creator", "text", "category"];
const baseline = new Map();
const dirty = new Map();
function rememberEdits(box, id) {
  dirty.set(id, new Set());
  box.addEventListener("input", (event) => { if (fields.includes(event.target.name)) dirty.get(id).add(event.target.name); });
  box.addEventListener("change", (event) => { if (fields.includes(event.target.name)) dirty.get(id).add(event.target.name); });
}
function updates(data) {
  return boxes.flatMap(box => {
    const id = box.__clip.id;
    const old = baseline.get(id), next = data.enrichment.find(e => e.id === id)?.candidate;
    if (!old || !next) return [];
    return fields.filter(k => next[k] !== old[k] && next[k] && !dirty.get(id)?.has(k))
      .map(k => ({box, key:k, value:next[k]}));
  });
}
function showLive(data) {
  const ids = new Set(boxes.map(b => b.__clip.id));
  const pending = data.enrichment.filter(e => ids.has(e.id) && ["queued", "running"].includes(e.job?.status)).length;
  const failed = data.enrichment.filter(e => ids.has(e.id) && ["partial", "failed"].includes(e.job?.status)).length;
  const count = updates(data).length;
  $("#live-status").textContent = (pending ? pending + " vídeo(s) procesándose. " : "No hay análisis pendientes en estos vídeos. ") +
    (failed ? failed + " análisis parcial(es) o fallido(s). " : "") +
    (count ? "Hay datos nuevos disponibles. Tus cambios manuales se conservarán." : "Tus cambios manuales se conservan.");
  $("#apply-new").hidden = !count;
  if (data.revision !== revision) $("#live-status").textContent += " La edición ha cambiado en otra sesión; copia tus cambios antes de recargar.";
}
async function refreshLive() {
  const response = await fetch("/admin/quick/data?date=" + encodeURIComponent(date), {cache:"no-store"});
  if (!response.ok) throw Error("No se pudo comprobar el estado del análisis");
  latest = await response.json();
  showLive(latest);
  return latest;
}
async function pollLive() {
  if (finished) return;
  if (!publishing && !document.hidden) {
    try { await refreshLive(); }
    catch { $("#live-status").textContent = "No se puede comprobar el análisis. Tus cambios siguen en el formulario."; }
  }
  if (!finished) pollTimer = setTimeout(pollLive, 5000);
}

const say = (t) => (status.textContent = t);
async function api(path, payload) {
  const r = await fetch("/admin/" + path, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
  const j = await r.json();
  if (!r.ok) throw Error(j.error || "Error");
  return j;
}
function input(label, name, value, max, type) {
  const l = document.createElement("label");
  l.textContent = label;
  const i = document.createElement(type === "textarea" ? "textarea" : "input");
  i.name = name; i.value = value || ""; i.maxLength = max;
  i.required = name === "title" || name === "text";
  l.append(i);
  return l;
}
function card(c, featured, cats) {
  const box = document.createElement("fieldset");
  box.className = "clip-input";
  box.__clip = c;
  const legend = document.createElement("legend");
  legend.textContent = c.title || c.url;
  box.append(legend);
  if (c.sensitive) {
    const warn = document.createElement("strong");
    warn.textContent = "⚠ Contenido sensible (X): revisa antes de publicar";
    box.append(warn);
  }
  const link = document.createElement("a");
  link.href = c.url; link.target = "_blank"; link.rel = "noopener noreferrer";
  link.textContent = "Ver original ↗";
  box.append(link);
  box.append(
    input("Título", "title", c.title, 120),
    input("Streamer (Video of…)", "streamer", c.streamer, 80),
    input("Autor del post (Post of…, si no hay streamer)", "creator", c.creator, 80),
    input("Contexto", "text", c.text, 400, "textarea"),
  );
  const l = document.createElement("label");
  l.textContent = "Categoría";
  const s = document.createElement("select");
  s.name = "category"; s.required = true;
  s.add(new Option("Elige categoría", ""));
  for (const v of cats) s.add(new Option(v, v));
  s.value = c.category || "";
  l.append(s);
  box.append(l);
  const f = document.createElement("label");
  const radio = document.createElement("input");
  radio.type = "radio"; radio.name = "featured"; radio.value = c.id; radio.checked = c.id === featured;
  f.append(radio, "★ Destacado de la edición");
  box.append(f);
  const rm = document.createElement("button");
  rm.type = "button"; rm.textContent = "Quitar";
  rm.onclick = () => { box.remove(); boxes = boxes.filter((b) => b !== box); };
  box.append(rm);
  rememberEdits(box, c.id);
  boxes.push(box);
  return box;
}
function clipsPayload() {
  return boxes.map((box) => {
    const c = { ...box.__clip };
    delete c.id;
    delete c.sensitive;
    for (const k of ["title", "streamer", "creator", "text", "category"]) c[k] = box.querySelector("[name=" + k + "]").value;
    return c;
  });
}
function featuredId() {
  const r = document.querySelector("[name=featured]:checked");
  return r ? r.value : boxes[0]?.__clip.id;
}
async function publish() {
  try {
    if (publishing || finished) return;
    publishing = true;
    $("#publish").disabled = true;
    const fresh = await refreshLive();
    if (fresh.revision !== revision) throw Error("La edición ha cambiado. Copia tus cambios antes de recargar.");
    if (updates(fresh).length) throw Error("Hay datos nuevos. Pulsa Incorporar datos nuevos y revísalos antes de publicar.");
    if (fresh.enrichment.some(e => boxes.some(b => b.__clip.id === e.id) && ["queued", "running"].includes(e.job?.status)) &&
        !confirm("El análisis sigue trabajando. ¿Publicar los datos actuales sin esperar? Lo publicado no se actualizará automáticamente.")) return;
    if (!$("#quick").reportValidity()) return;
    if (!boxes.length) throw Error("Añade al menos un clip desde la bandeja");
    const clips = clipsPayload(), featured = featuredId();
    const top = boxes.find((b) => b.__clip.id === featured) || boxes[0];
    const edition = {
      date, demo: false, reviewed: true, featured,
      title: $("[name=etitle]").value, intro: $("[name=intro]").value,
      hook: $("[name=hook]").value || top.querySelector("[name=title]").value.slice(0, 160),
      clips,
    };
    const r = await api("publish", { edition, revision });
    revision = r.revision;
    finished = true;
    clearTimeout(pollTimer);
    say("Edición publicada en la web.");
    $("#step1").hidden = true;
    $("#step2").hidden = false;
    $("#public-link").href = "/dia/" + date;
    renderPicker(featured);
    await loadDraft();
  } catch (e) { say(e.message); }
  finally { publishing = false; $("#publish").disabled = false; }
}
function renderPicker(selected) {
  const box = $("#picker");
  box.replaceChildren();
  for (const b of boxes) {
    const l = document.createElement("label");
    const r = document.createElement("input");
    r.type = "radio"; r.name = "xclip"; r.value = b.__clip.id; r.checked = b.__clip.id === selected;
    r.onchange = loadDraft;
    l.append(r, " " + b.querySelector("[name=title]").value);
    box.append(l);
  }
}
let current = null;
async function loadDraft() {
  try {
    const id = document.querySelector("[name=xclip]:checked")?.value || "";
    const r = await fetch("/admin/x/drafts?date=" + encodeURIComponent(date) + "&clip=" + encodeURIComponent(id));
    const j = await r.json();
    if (!r.ok) throw Error(j.error);
    current = j.drafts.find((d) => d.kind === "top");
    xInfo = j;
    $("#xtext").value = current ? current.text : "";
    $("#xreply").value = current ? current.replyText : "";
    $("#xpublish").hidden = !j.publishEnabled;
    $("#xpublish").disabled = !current || current.state === "published";
    $("#xstate").textContent = current && current.state === "published" ? "Ya publicado en X." : j.publishEnabled ? "" : "La publicación en X no está activada: copia el post.";
  } catch (e) { say(e.message); }
}
async function copy(sel, label) {
  try { await navigator.clipboard.writeText($(sel).value); say(label + " copiado."); }
  catch { say("No se pudo acceder al portapapeles: selecciona y copia el texto."); }
}
$("#publish").onclick = publish;
$("#apply-new").onclick = () => {
  if (!latest || publishing || finished) return;
  for (const {box, key, value} of updates(latest)) box.querySelector("[name=" + key + "]").value = value;
  for (const e of latest.enrichment) if (e.candidate) baseline.set(e.id, {...e.candidate});
  showLive(latest);
  say("Datos nuevos incorporados. Revisa el resultado; tus campos editados no se han tocado.");
};
window.addEventListener("pagehide", () => { finished = true; clearTimeout(pollTimer); });
$("#copy-main").onclick = () => copy("#xtext", "Post");
$("#copy-reply").onclick = () => copy("#xreply", "Respuesta");
$("#xpublish").onclick = async () => {
  try {
    if (!current) return;
    if (!confirm("¿Publicar este post en la cuenta de X conectada?")) return;
    const clip = document.querySelector("[name=xclip]:checked")?.value;
    const r = await api("x/publish", { date, kind: current.kind, ref: current.ref, clip, text: $("#xtext").value, confirm: true });
    say(r.mode === "published" ? "Publicado en X." : "Simulación (dry-run): no se ha enviado nada. " + (r.reason || ""));
    await loadDraft();
  } catch (e) { say(e.message); }
};
$("#skip").onclick = () => say("Listo. La edición ya está publicada en la web.");
(async () => {
  try {
    const r = await fetch("/admin/quick/data?date=" + encodeURIComponent(date));
    const j = await r.json();
    if (!r.ok) throw Error(j.error);
    revision = j.revision;
    for (const e of j.enrichment) if (e.candidate) baseline.set(e.id, {...e.candidate});
    $("[name=etitle]").value = j.edition.title;
    $("[name=intro]").value = j.edition.intro;
    $("[name=hook]").value = j.edition.hook;
    $("#date").textContent = date;
    const list = $("#clips");
    for (const c of j.edition.clips) list.append(card(c, j.edition.featured, j.categories));
    latest = j; showLive(j); pollTimer = setTimeout(pollLive, 5000);
    if (!j.edition.clips.length) say("No hay clips: añade enlaces en la bandeja y vuelve.");
  } catch (e) { say(e.message); }
})();
`;

export function quickPage(): string {
  return `<section class="hero"><p class="eyebrow">Publicar · <span id="date"></span></p><h1>Últimos detalles.</h1><p class="lead">Los datos vienen autocompletados de las fuentes. Revisa, corrige lo que falte y publica.</p><a href="/admin/inbox">Bandeja</a> · <a href="/admin">Editor completo</a></section><div class="editor"><div id="step1"><p id="live-status" role="status" aria-live="polite"></p><button id="apply-new" type="button" hidden>Incorporar datos nuevos</button><form id="quick"><div id="clips"></div><details><summary>Detalles de la edición (opcional)</summary><label>Título de la edición<input name="etitle" maxlength="100" required></label><label>Entradilla<textarea name="intro" maxlength="400" required></textarea></label><label>Gancho (por defecto, el título del destacado)<input name="hook" maxlength="160"></label></details><p class="meta">Al publicar confirmas que has revisado fuentes, contexto y duplicados.</p><div class="toolbar"><button class="primary" type="button" id="publish">Publicar edición</button></div></form></div><section id="step2" hidden><h2>Atrae visitas desde X</h2><p class="meta">Elige un solo vídeo para el post. Puedes editar el mensaje.</p><div id="picker"></div><label>Post<textarea id="xtext" maxlength="600"></textarea></label><label>Respuesta con el enlace a la web<textarea id="xreply" readonly></textarea></label><p id="xstate" class="meta"></p><div class="toolbar"><button class="primary" id="xpublish" hidden>Publicar en X</button><button id="copy-main" type="button">Copiar post</button><button id="copy-reply" type="button">Copiar respuesta</button><button id="skip" type="button">Ahora no</button><a class="button" id="public-link">Abrir edición pública ↗</a></div></section><p id="status" role="status" aria-live="polite"></p></div><script src="/admin/quick.js" defer></script>`;
}
