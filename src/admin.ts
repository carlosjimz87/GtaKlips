export const adminScript = `
const form = document.querySelector("#editor"),
  list = document.querySelector("#clips"),
  status = document.querySelector("#status");
let revision = 0,
  activeDate = "",
  published = false;
const field = (label, name, value = "", type = "text") => {
  const l = document.createElement("label");
  l.textContent = label;
  const i = document.createElement(type === "textarea" ? "textarea" : "input");
  i.name = name;
  i.value = value;
  if (type !== "textarea") i.type = type;
  i.required = name !== "thumbnail";
  i.maxLength = { url: 300, thumbnail: 1500, streamer: 80, title: 120, text: 400 }[name] || 400;
  l.append(i);
  return l;
};
function add(c = {}) {
  const box = document.createElement("fieldset");
  box.className = "clip-input";
  if (Number.isFinite(c.duration)) box.dataset.duration = String(c.duration);
  const legend = document.createElement("legend");
  legend.textContent = "Clip";
  box.append(legend);
  box.append(
    field("URL del clip (Twitch, YouTube o X)", "url", c.url),
    field("Streamer · crédito", "streamer", c.streamer),
    field("Título del clip", "title", c.title),
    field("Contexto editorial en español", "text", c.text, "textarea"),
    field("Miniatura de Twitch / YouTube / X (opcional)", "thumbnail", c.thumbnail, "text"),
  );
  const l = document.createElement("label");
  l.textContent = "Categoría";
  const s = document.createElement("select");
  s.name = "category";
  ["Fails", "Jugadas", "Detalles", "Reacciones"].forEach((v) => {
    const o = new Option(v, v);
    s.add(o);
  });
  s.value = c.category || "Fails";
  l.append(s);
  box.append(l);
  const orientation = document.createElement("label"); orientation.textContent = "Orientación";
  const orientationInput = document.createElement("select"); orientationInput.name = "orientation";
  for (const value of ["auto", "landscape", "portrait", "square"]) orientationInput.add(new Option(value,value));
  orientationInput.value = c.orientation || "auto"; orientation.append(orientationInput); box.append(orientation);
  const featured = document.createElement("label");
  const radio = document.createElement("input");
  radio.type = "radio";
  radio.name = "featured";
  radio.checked = !!c.featured;
  featured.append(radio, "Destacado de la edición");
  box.append(featured);
  const bar = document.createElement("div");
  bar.className = "toolbar";
  for (const [label, action] of [
    [
      "Subir",
      () => {
        if (box.previousElementSibling)
          list.insertBefore(box, box.previousElementSibling);
      },
    ],
    [
      "Bajar",
      () => {
        if (box.nextElementSibling)
          list.insertBefore(box.nextElementSibling, box);
      },
    ],
    ["Quitar del borrador", () => box.remove()],
  ]) {
    const b = document.createElement("button");
    b.type = "button";
    b.textContent = label;
    b.onclick = action;
    bar.append(b);
  }
  box.append(bar);
  const sourceInput = box.querySelector('[name=url]');
  let linkedSource = sourceInput.value.trim();
  sourceInput.addEventListener('input', () => {
    const next = sourceInput.value.trim();
    if (next !== linkedSource) {
      box.querySelector('[name=thumbnail]').value = '';
      delete box.dataset.duration;
      linkedSource = next;
    }
  });
  list.append(box);
}
function data() {
  const clips = [...list.children].map((box) => {
    const c = {};
    ["url", "streamer", "title", "text", "category", "thumbnail", "orientation"].forEach(
      (k) => (c[k] = box.querySelector("[name=" + k + "]").value),
    );
    if (box.dataset.duration) c.duration = Number(box.dataset.duration);
    return c;
  });
  const selected = [...list.children].findIndex(
    (b) => b.querySelector("[type=radio]").checked,
  );
  const url = clips[selected]?.url || "";
  return {
    date: form.elements.date.value,
    title: form.querySelector("[name=title]").value,
    intro: form.elements.intro.value,
    hook: form.elements.hook.value,
    demo: form.elements.demo.checked,
    reviewed: form.elements.reviewed.checked,
    featured: normalizeSource(url).id,
    clips,
  };
}
async function api(action, payload) {
  const r = await fetch("/admin/" + action, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  const result = await r.json();
  if (!r.ok) throw Error(result.error || "No se pudo guardar");
  return result;
}
function message(s) {
  status.textContent = s;
}
async function save(action) {
  try {
    if (!form.reportValidity()) return;
    const edition = data();
    if (activeDate && edition.date !== activeDate)
      throw Error("Para otra fecha, abre Nueva edición.");
    const r = await api(action, { edition, revision });
    revision = r.revision;
    activeDate = edition.date;
    history.replaceState(
      {},
      "",
      "/admin?date=" + encodeURIComponent(activeDate),
    );
    published = action === "publish" || published;
    message(
      action === "publish"
        ? "Edición publicada. Ya puedes copiar el post."
        : "Borrador guardado. No cambia la edición pública.",
    );
    if (action === "publish") await showPost();
  } catch (e) {
    message(e.message);
  }
}
async function showPost() {
  const r = await fetch("/admin/post?date=" + encodeURIComponent(activeDate));
  const j = await r.json();
  if (!r.ok) throw Error(j.error);
  document.querySelector("#post").value = j.post;
  document.querySelector("#public-link").href = j.url;
  document.querySelector("#public-link").hidden = false;
  document.querySelector("#copy").disabled = false;
}
form.onsubmit = (e) => {
  e.preventDefault();
  save("save");
};
document.querySelector("#publish").onclick = () => save("publish");
document.querySelector("#add").onclick = () => {
  if (list.children.length < 10) add();
  else message("Máximo 10 clips por edición");
};
document.querySelector("#copy").onclick = async () => {
  try {
    await navigator.clipboard.writeText(document.querySelector("#post").value);
    message("Post copiado. Revísalo antes de publicarlo en X.");
  } catch {
    message(
      "No se pudo acceder al portapapeles. Selecciona y copia el texto del post.",
    );
  }
};
document.querySelector("#withdraw").onclick = async () => {
  try {
    const id = document.querySelector("#withdraw-id").value;
    if (!published || !id) throw Error("Elige un clip publicado");
    const r = await api("withdraw", { date: activeDate, id, revision });
    revision = r.revision;
    message(
      "Clip retirado de la edición pública. También se ha quitado del borrador.",
    );
    document.querySelector("#post").value = "";
    document.querySelector("#copy").disabled = true;
    document.querySelector("#public-link").hidden = true;
    await init();
  } catch (e) {
    message(e.message);
  }
};
async function init() {
  const selectionDate = new URL(location.href).searchParams.get("selection");
  if (selectionDate) {
    try {
      const response = await fetch("/admin/selection?date=" + encodeURIComponent(selectionDate));
      const info = await response.json(); if (!response.ok) throw Error(info.error);
      if (info.revision && !confirm("Ya existe un borrador para esta fecha. ¿Añadir la selección sin reemplazar los clips existentes? No se guardará ni publicará hasta que lo decidas.")) { message("Carga cancelada. El borrador no ha cambiado."); return; }
      const j = await api("selection/load",{date:selectionDate,selectionRevision:info.selection.revision,revision:info.revision,confirm:info.revision>0});
      revision=j.revision; activeDate=selectionDate; published=j.published;
      for (const k of ["date","title","intro","hook"]) form.querySelector("[name="+k+"]").value=j.edition[k];
      for (const k of ["demo","reviewed"]) form.elements[k].checked=j.edition[k];
      list.replaceChildren(); j.edition.clips.forEach(c=>add({...c,featured:c.id===j.edition.featured}));
      history.replaceState({},"","/admin?date="+encodeURIComponent(selectionDate));
      message("Selección cargada solo en este editor. Completa y revisa los campos. No se ha guardado ni publicado.");
    } catch(e) { message(e.message); }
    return;
  }
  const date = new URL(location.href).searchParams.get("date");
  if (!date) {
    const candidate = new URL(location.href).searchParams.get("candidate");
    if (candidate) {
      try {
        const r = await fetch("/admin/candidate?id=" + encodeURIComponent(candidate));
        const c = await r.json();
        if (!r.ok) throw Error(c.error);
        add({ url: c.url, streamer: c.streamer, title: c.title, thumbnail: c.thumbnail || "", duration: c.duration });
        message("Fuente importada. Escribe contexto original y revisa disponibilidad y derechos. No se ha guardado ni publicado.");
      } catch (e) { add(); message(e.message); }
    } else add();
    return;
  }
  try {
    const r = await fetch("/admin/data?date=" + encodeURIComponent(date));
    const j = await r.json();
    if (!r.ok) throw Error(j.error);
    revision = j.revision;
    activeDate = j.edition.date;
    published = j.published;
    for (const k of ["date", "title", "intro", "hook"])
      form.querySelector("[name=" + k + "]").value = j.edition[k];
    for (const k of ["demo", "reviewed"])
      form.elements[k].checked = j.edition[k];
    list.replaceChildren();
    j.edition.clips.forEach((c) =>
      add({ ...c, featured: c.id === j.edition.featured }),
    );
    if (published) await showPost();
  } catch (e) {
    message(e.message);
  }
}
init();
`;
export function editor(date: string): string {
  return `<section class="hero"><p class="eyebrow">Mesa de edición · acceso privado</p><h1>De buen clip a buena historia.</h1><p class="lead">Selecciona, da contexto y publica. Tú decides qué merece estar aquí.</p><a href="/admin">Nueva edición</a> · <a href="/admin/editions">Ediciones guardadas</a> · <a href="/admin/imports">Importaciones y candidatos</a> · <a href="/admin/inbox">Bandeja y selección</a></section><div class="editor"><form id="editor"><div class="fields"><label>Fecha editorial (Madrid)<input name="date" type="date" value="${date}" required></label><label>Título de la edición<input name="title" maxlength="100" required></label></div><label>Entradilla<textarea name="intro" maxlength="400" required></textarea></label><label>Gancho aprobado para X<input name="hook" maxlength="160" required></label><label><input name="demo" type="checkbox" checked>Datos de demostración · fuentes no verificadas</label><label><input name="reviewed" type="checkbox">He revisado las fuentes, el contexto, los spoilers y los duplicados</label><p class="meta">Entre 1 y 10 clips. El orden de las fichas es el orden publicado. Marca un único destacado. Las ediciones reales requieren revisión editorial.</p><div id="clips"></div><button type="button" id="add">Añadir clip</button><div class="toolbar"><button class="primary" type="submit">Guardar borrador</button><button type="button" id="publish">Publicar edición</button></div></form><section><h2>De la edición a X</h2><p class="meta">El post usa la versión publicada, nunca los cambios sin publicar. No se envía automáticamente.</p><label>Borrador de X<textarea id="post" readonly></textarea></label><div class="toolbar"><button id="copy" disabled>Copiar post</button><a class="button" id="public-link" hidden>Abrir edición pública ↗</a></div></section><section><h2>Retirar un clip publicado</h2><p class="meta">Pega la URL original o el ID de la ficha (Twitch conserva su ID; YouTube y X usan youtube:ID y x:ID). Se conserva el resto de la edición; si era el destacado se elige el primer clip restante. También se retira del borrador para evitar su republicación accidental.</p><label>ID del clip<input id="withdraw-id" maxlength="500"></label><button id="withdraw">Retirar clip</button></section><p id="status" role="status" aria-live="polite">Los borradores solo se ven en este panel.</p></div><script src="/admin/source.js" defer></script><script src="/admin/editor.js" defer></script>`;
}
