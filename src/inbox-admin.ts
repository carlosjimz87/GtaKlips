import type { Env } from "./auth";
import { esc, categories } from "./model";
import { getSelection, today, type ManualCandidate } from "./inbox";
export async function inboxPage(env: Env, url: URL) {
  const date = url.searchParams.get("date") || today(),
    platform = url.searchParams.get("platform") || "",
    state = url.searchParams.get("state") || "";
  const selection = await getSelection(env, date),
    ids: string[] = JSON.parse(selection.ids);
  const offset = Math.max(
    0,
    Math.min(100000, Number(url.searchParams.get("offset")) || 0),
  );
  const rows = await env.DB.prepare(
    "SELECT * FROM manual_candidates WHERE (?='' OR provider=?) AND (?='' OR state=?) AND (?='' OR captured_date=?) ORDER BY created_at DESC,id LIMIT 21 OFFSET ?",
  )
    .bind(
      platform,
      platform,
      state,
      state,
      url.searchParams.get("captured") || "",
      url.searchParams.get("captured") || "",
      offset,
    )
    .all<ManualCandidate>();
  return `<h1>Bandeja privada</h1><a href="/admin">Editor</a> · <a href="/admin/imports">Importaciones Twitch</a><p>Capturar, seleccionar y preparar no guarda ni publica ediciones. Los metadatos son opcionales y deben revisarse.</p>
<form method="get"><label>Fecha de selección<input type="date" name="date" value="${esc(date)}" required></label><label>Plataforma<select name="platform">${["", "twitch", "youtube", "x"].map((p) => `<option value="${p}" ${p === platform ? "selected" : ""}>${p || "Todas"}</option>`).join("")}</select></label><label>Estado<select name="state">${["", "pending", "reviewed", "discarded"].map((p) => `<option value="${p}" ${p === state ? "selected" : ""}>${p || "Todos"}</option>`).join("")}</select></label><label>Capturado en fecha<input type="date" name="captured" value="${esc(url.searchParams.get("captured") || "")}"></label><button>Filtrar</button></form>
<form id="capture"><label>Enlaces (uno por línea, máximo diez)<textarea name="urls" required maxlength="5000"></textarea></label><button>Guardar fuentes</button></form>
<section id="selection" data-date="${esc(date)}" data-revision="${selection.revision}" data-ids="${esc(selection.ids)}"><h2>Selección · ${ids.length}/10 · ${selection.prepared ? "Preparada" : "Sin preparar"}</h2><ol>${ids.map((id) => `<li>${esc(id)} <button data-selection="up" data-id="${esc(id)}">Subir</button><button data-selection="down" data-id="${esc(id)}">Bajar</button><button data-selection="remove" data-id="${esc(id)}">Quitar</button></li>`).join("")}</ol><button id="prepare">Preparar selección</button>${selection.prepared ? `<a href="/admin?selection=${esc(date)}">Cargar selección en editor</a>` : ""}</section>
<div class="grid">${rows.results
    .slice(0, 20)
    .map(
      (c) =>
        `<article class="clip"><form data-candidate="${esc(c.id)}" data-revision="${c.revision}"><h2>${esc(c.title || "Fuente pendiente de completar")}</h2><p>${esc(c.provider)} · ${esc(c.captured_date)}</p><a href="${esc(c.url)}" target="_blank" rel="noopener noreferrer">Revisar original ↗</a> · <a href="/admin/inbox/preview?id=${encodeURIComponent(c.id)}">Vista previa privada</a>${["title", "streamer", "text"].map((name) => `<label>${({ title: "Título", streamer: "Crédito del creador", text: "Contexto editorial" } as any)[name]}<input name="${name}" maxlength="${name === "text" ? 400 : name === "title" ? 120 : 80}" value="${esc((c as any)[name])}"></label>`).join("")}<label>Categoría<select name="category">${categories.map((cat) => `<option ${cat === c.category ? "selected" : ""}>${cat}</option>`).join("")}</select></label><label>Orientación<select name="orientation">${["auto", "landscape", "portrait"].map((o) => `<option ${o === c.orientation ? "selected" : ""}>${o}</option>`).join("")}</select></label><label>Revisión<select name="state">${["pending", "reviewed", "discarded"].map((s) => `<option ${s === c.state ? "selected" : ""}>${s}</option>`).join("")}</select></label><button>Guardar revisión</button><button type="button" data-metadata>Consultar metadatos opcionales</button><button type="button" data-selection="toggle" data-id="${esc(c.id)}">${ids.includes(c.id) ? "Quitar de selección" : "Seleccionar"}</button></form></article>`,
    )
    .join(
      "",
    )}</div>${rows.results.length > 20 ? `<a href="${esc(url.pathname + "?" + new URLSearchParams({ ...Object.fromEntries(url.searchParams), offset: String(offset + 20) }))}">Siguiente página</a>` : ""}<p id="inbox-status" role="status"></p><script src="/admin/inbox.js" defer></script>`;
}
export const inboxScript = `
const selection=document.querySelector('#selection'), date=selection.dataset.date, revision=Number(selection.dataset.revision), ids=JSON.parse(selection.dataset.ids), status=document.querySelector('#inbox-status');
async function act(action,payload){
  document.querySelectorAll('button').forEach(b=>b.disabled=true);
  try{const r=await fetch('/admin/inbox/'+action,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(payload)});const j=await r.json();if(!r.ok)throw Error(j.error||'No se pudo guardar. Recarga.'); if(action==='capture') sessionStorage.setItem('inbox-result','Guardados: '+j.saved.length+' · duplicados: '+j.duplicate+' · rechazados: '+j.rejected); if(action==='metadata')sessionStorage.setItem('inbox-result',j.enriched?'Metadatos completados; revisa la fuente.':'Metadatos no disponibles o campos ya completos. Puedes editar manualmente.');location.reload();}catch(e){status.textContent=e.message;document.querySelectorAll('button').forEach(b=>b.disabled=false);}
}
status.textContent=sessionStorage.getItem('inbox-result')||'';sessionStorage.removeItem('inbox-result');
document.querySelector('#capture').onsubmit=e=>{e.preventDefault();act('capture',{date,urls:e.target.elements.urls.value.trim().split(/\\s+/)});};
for(const form of document.querySelectorAll('[data-candidate]')){
 form.onsubmit=e=>{e.preventDefault();act('edit',{...Object.fromEntries(new FormData(form)),id:form.dataset.candidate,revision:Number(form.dataset.revision)});};
 form.querySelector('[data-metadata]').onclick=()=>act('metadata',{id:form.dataset.candidate,revision:Number(form.dataset.revision)});
}
for(const button of document.querySelectorAll('[data-selection]'))button.onclick=()=>{const next=[...ids],index=next.indexOf(button.dataset.id),action=button.dataset.selection;if(action==='toggle'){if(index<0)next.push(button.dataset.id);else next.splice(index,1);}if(action==='remove'&&index>=0)next.splice(index,1);const target=index+(action==='up'?-1:1);if(['up','down'].includes(action)&&index>=0&&target>=0&&target<next.length)[next[index],next[target]]=[next[target],next[index]];act('selection',{date,revision,ids:next});};
document.querySelector('#prepare').onclick=()=>act('selection',{date,revision,ids,prepared:true});
`;
