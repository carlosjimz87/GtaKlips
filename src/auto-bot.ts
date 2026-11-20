import type { Env } from "./auth";
import {
  capturePlan,
  candidateWrite,
  clearGuard,
  getCandidate,
  getSelection,
  selectionGuard,
  selectionWrite,
  type ManualCandidate,
} from "./inbox";
import { missingFields } from "./auto-state";
import { categories, validate, type Edition } from "./model";
import { editionWrite } from "./edition-store";
import { extractURLs } from "./telegram";
import { queueEnrichment } from "./enrichment";

type Key = { text: string; callback_data: string };
export interface AutoReply {
  text: string;
  keyboard: Key[][];
  writes: D1PreparedStatement[];
}
const result = (): AutoReply => ({ text: "", keyboard: [], writes: [] });
function button(
  env: Env,
  r: AutoReply,
  date: string,
  action: string,
  payload: unknown,
  label: string,
) {
  const token = crypto.randomUUID();
  r.writes.push(
    env.DB.prepare("INSERT INTO auto_buttons VALUES(?,?,?,?,?)").bind(
      token,
      date,
      action,
      JSON.stringify(payload),
      Date.now() + 3600000,
    ),
  );
  return { text: label, callback_data: "a:" + token };
}
function fenceCandidate(env: Env, c: ManualCandidate) {
  return env.DB.prepare(
    "INSERT INTO manual_write_guard VALUES(1,EXISTS(SELECT 1 FROM manual_candidates WHERE id=? AND revision=?))",
  ).bind(c.id, c.revision);
}
function editionGuard(env: Env, date: string, revision: number) {
  return env.DB.prepare(
    "INSERT INTO manual_write_guard VALUES(1,COALESCE((SELECT revision FROM editions WHERE date=?),0)=?)",
  ).bind(date, revision);
}
export function outboxWrites(env: Env, id: number, r: AutoReply) {
  const chunks: string[] = [];
  let rest = r.text;
  while (rest.length > 3500) {
    let end = rest.lastIndexOf("\n", 3500);
    if (end < 1) end = 3500;
    chunks.push(rest.slice(0, end));
    rest = rest.slice(end).replace(/^\n/, "");
  }
  chunks.push(rest);
  return chunks.map((text, part) =>
    env.DB.prepare(
      "INSERT INTO telegram_outbox(update_id,payload,part) VALUES(?,?,?)",
    ).bind(
      id,
      JSON.stringify({
        text,
        ...(part === chunks.length - 1 && r.keyboard.length
          ? { reply_markup: { inline_keyboard: r.keyboard } }
          : {}),
      }),
      part,
    ),
  );
}
async function board(env: Env, date: string, ids: string[], r: AutoReply) {
  for (const [i, id] of [...new Set(ids)].slice(0, 10).entries()) {
    const c = await getCandidate(env, id);
    if (!c) continue;
    const job = await env.DB.prepare(
      "SELECT status,error,updated_at FROM enrichment_jobs WHERE candidate=?",
    )
      .bind(id)
      .first<any>();
    const missing = missingFields(c);
    const busy = job && ["queued", "running"].includes(job.status);
    const state =
      c.state === "discarded"
        ? "Excluido"
        : busy
          ? "Procesando"
          : missing.length
            ? "Falta: " + missing.join(", ")
            : "Completo; revisa antes de publicar";
    r.text += `\n${i + 1}. ${c.title || c.url}\n${c.streamer || "Crédito pendiente"} · ${c.category || "Categoría pendiente"}\n${c.text ? c.text.slice(0, 130) : "Contexto pendiente"}\n${state}${job?.error ? " · " + job.error : ""}${busy && Date.now() - job.updated_at > 180000 ? " · Comprueba que el procesador local esté activo" : ""}\n`;
    r.keyboard.push([
      button(
        env,
        r,
        date,
        "edit",
        { id, revision: c.revision },
        `${i + 1} · Editar`,
      ),
      button(
        env,
        r,
        date,
        "exclude",
        { id, revision: c.revision },
        `${i + 1} · Excluir`,
      ),
    ]);
  }
  r.text +=
    "\nBorrador privado. Los datos automáticos son propuestas, no hechos verificados.";
  r.keyboard.push([
    button(env, r, date, "preview", {}, "Ver edición para publicar"),
  ]);
}
async function preview(env: Env, date: string, r: AutoReply) {
  const selection = await getSelection(env, date);
  const row = await env.DB.prepare(
    "SELECT draft,published,revision FROM editions WHERE date=?",
  )
    .bind(date)
    .first<any>();
  const published: Edition | null = row?.published
    ? JSON.parse(row.published)
    : null;
  const draft: Edition | null = row?.draft ? JSON.parse(row.draft) : null;
  const base = draft || published;
  const clips = [...(base?.clips || [])];
  const versions: { id: string; revision: number }[] = [];
  const issues: string[] = [];
  for (const id of JSON.parse(selection.ids)) {
    const c = await getCandidate(env, id);
    if (!c || c.state === "discarded") {
      issues.push("Fuente excluida: " + id);
      continue;
    }
    versions.push({ id, revision: c.revision });
    const missing = missingFields(c);
    if (missing.length)
      issues.push((c.title || c.url) + ": " + missing.join(", "));
    const at = clips.findIndex((x) => x.id === id);
    const prior = at >= 0 ? clips[at] : undefined;
    const clip = {
      ...prior,
      ...c,
      provider: c.provider as any,
      orientation: (c.orientation !== "auto"
        ? c.orientation
        : prior?.orientation || "auto") as any,
      thumbnail: c.thumbnail || prior?.thumbnail || undefined,
    };
    if (at >= 0) clips[at] = clip;
    else clips.push(clip);
  }
  const edition = {
    date,
    title: base?.title || `Selección de clips · ${date}`,
    intro:
      base?.intro ||
      "Una selección de enlaces con contexto atribuido a sus fuentes. Revisa cada original antes de compartir.",
    hook: base?.hook || `Selección de clips del ${date}`,
    demo: base?.demo || false,
    reviewed: false,
    featured: base?.featured || clips[0]?.id || "",
    clips,
  };
  r.text = `Vista previa de edición · ${date}\n${row?.published ? "Actualiza la edición existente desde el borrador actual. Revisa todos los cambios mostrados." : "Nueva edición."}\nTítulo: ${edition.title}\nIntroducción: ${edition.intro}\nTexto para compartir: ${edition.hook}\nDestacado: ${edition.featured}\nModo: ${edition.demo ? "demostración" : "editorial"}\n`;
  const removed = (published?.clips || []).filter(
    (c) => !clips.some((x) => x.id === c.id),
  );
  if (removed.length)
    r.text +=
      "Se retirarán según el borrador admin: " +
      removed.map((c) => c.title || c.id).join(", ") +
      "\n";
  for (const [i, c] of clips.entries())
    r.text += `\n${i + 1}. ${c.title}\n${c.url}\nCrédito: ${c.streamer}\nCategoría: ${c.category}\nContexto: ${c.text}\nOrientación: ${c.orientation || "auto"} · Duración: ${c.duration ? c.duration + " s" : "no indicada"}\nMiniatura: ${c.thumbnail || "no indicada"}\n`;
  try {
    validate({ ...edition, reviewed: true }, true);
  } catch (e) {
    issues.push((e as Error).message);
  }
  if (issues.length)
    r.text +=
      "\nNo se puede publicar:\n" +
      issues.join("\n") +
      "\nCorrige en /seleccion o admin; excluye los pendientes deliberadamente.";
  else {
    r.text +=
      "\nAl confirmar declaras haber revisado fuentes, contexto, spoilers y duplicados. Se publica en esta instalación de GtaKlips, no en redes sociales.";
    r.keyboard.push([
      button(
        env,
        r,
        date,
        "publish",
        { edition, revision: row?.revision || 0, selection, versions },
        `Confirmar revisión y publicar · ${clips.length} clips`,
      ),
    ]);
  }
  r.text +=
    "\nEdición completa (orden, destacado y textos generales): admin en el ordenador.";
}
export async function autoUpdate(
  env: Env,
  update: any,
  date: string,
): Promise<AutoReply | null> {
  const command =
    typeof update.message?.text === "string" ? update.message.text.trim() : "";
  const token = update.callback_query?.data;
  const r = result();
  if (typeof token === "string" && token.startsWith("a:")) {
    const b = await env.DB.prepare(
      "SELECT * FROM auto_buttons WHERE token=? AND expires_at>?",
    )
      .bind(token.slice(2), Date.now())
      .first<any>();
    if (!b || b.date !== date) {
      r.text = "Botón caducado o fecha distinta. Usa /seleccion o /publicar.";
      return r;
    }
    const p = JSON.parse(b.payload);
    if (b.action === "preview") {
      await preview(env, date, r);
      return r;
    }
    if (b.action === "publish") {
      const selection = await getSelection(env, date);
      const current = await env.DB.prepare(
        "SELECT revision FROM editions WHERE date=?",
      )
        .bind(date)
        .first<any>();
      let valid =
        (current?.revision || 0) === p.revision &&
        selection.revision === p.selection.revision;
      for (const v of p.versions) {
        const c = await getCandidate(env, v.id);
        if (!c || c.revision !== v.revision || c.state === "discarded")
          valid = false;
      }
      if (!valid) {
        r.text =
          "La edición cambió. Revisa una vista previa nueva con /publicar.";
        return r;
      }
      r.writes.push(
        editionGuard(env, date, p.revision),
        clearGuard(env),
        selectionGuard(env, selection),
        clearGuard(env),
      );
      for (const v of p.versions)
        r.writes.push(
          fenceCandidate(env, {
            id: v.id,
            revision: v.revision,
          } as ManualCandidate),
          clearGuard(env),
        );
      // Consuming the token and publishing share the receiver's atomic transaction.
      r.writes.push(
        env.DB.prepare(
          "INSERT INTO manual_write_guard VALUES(1,EXISTS(SELECT 1 FROM auto_buttons WHERE token=? AND expires_at>?))",
        ).bind(token.slice(2), Date.now()),
        clearGuard(env),
        editionWrite(env, { ...p.edition, reviewed: true }, p.revision, true),
        env.DB.prepare("DELETE FROM auto_buttons WHERE token=?").bind(
          token.slice(2),
        ),
      );
      r.text = `Edición ${date} publicada (${p.edition.clips.length} clips) en esta instalación de GtaKlips. No se ha publicado en redes sociales.`;
      return r;
    }
    const c = await getCandidate(env, p.id);
    if (!c || c.revision !== p.revision) {
      r.text =
        "El clip cambió. Usa /seleccion para ver datos y controles actuales.";
      return r;
    }
    r.writes.push(fenceCandidate(env, c), clearGuard(env));
    if (b.action === "edit") {
      r.text = `${c.title || c.url}\nCrédito: ${c.streamer || "pendiente"}\nContexto: ${c.text || "pendiente"}\nCategoría: ${c.category || "pendiente"}\nOrigen de campos: ${c.field_sources || "{}"}\nElige qué editar. Orden, destacado y textos de edición: admin.`;
      for (const [field, label] of [
        ["title", "Título"],
        ["streamer", "Crédito"],
        ["text", "Contexto"],
      ])
        r.keyboard.push([
          button(
            env,
            r,
            date,
            "input",
            { id: c.id, revision: c.revision, field },
            label,
          ),
        ]);
      r.keyboard.push(
        categories.map((category) =>
          button(
            env,
            r,
            date,
            "category",
            { id: c.id, revision: c.revision, category },
            category,
          ),
        ),
      );
      r.keyboard.push([
        button(
          env,
          r,
          date,
          "retry",
          { id: c.id, revision: c.revision },
          "Reintentar análisis",
        ),
      ]);
    } else if (b.action === "input") {
      r.writes.push(
        env.DB.prepare(
          "INSERT INTO auto_input VALUES(1,?,?,?,?) ON CONFLICT(singleton) DO UPDATE SET candidate=excluded.candidate,field=excluded.field,revision=excluded.revision,date=excluded.date",
        ).bind(c.id, p.field, c.revision, date),
      );
      r.text = `Escribe ${p.field === "text" ? "contexto (máximo 400)" : p.field === "title" ? "título (máximo 120)" : "crédito (máximo 80)"} o /cancelar.`;
    } else if (b.action === "category") {
      r.writes.push(candidateWrite(env, c, { category: p.category }));
      r.text =
        "Categoría guardada. /seleccion muestra el borrador actualizado.";
    } else if (b.action === "exclude") {
      const selection = await getSelection(env, date),
        ids: string[] = JSON.parse(selection.ids);
      r.writes.push(
        selectionGuard(env, selection),
        clearGuard(env),
        selectionWrite(
          env,
          selection,
          ids.filter((id) => id !== c.id),
        ),
        candidateWrite(env, c, { state: "discarded" }),
      );
      r.text =
        "Clip excluido del borrador. No modifica una publicación existente; para retirarlo de ella usa admin. /seleccion";
    } else if (b.action === "retry") {
      if (c.state === "discarded") {
        r.text = "Recupera el clip en admin antes de analizarlo.";
        return r;
      }
      r.writes.push(
        queueEnrichment(env, c.id),
        env.DB.prepare(
          "UPDATE enrichment_jobs SET status='queued',attempts=0,token=NULL,lease_until=0,next_at=0,error='',updated_at=? WHERE candidate=? AND status!='running'",
        ).bind(Date.now(), c.id),
      );
      r.text =
        "Análisis solicitado; se conservarán tus correcciones. Consulta /estado.";
    }
    return r;
  }
  if (["/seleccion", "/estado"].includes(command)) {
    const s = await getSelection(env, date);
    r.text = `Borrador ${date} · ${JSON.parse(s.ids).length}/10 clips\n`;
    await board(env, date, JSON.parse(s.ids), r);
    if (command === "/estado") {
      const health = await env.DB.prepare(
        "SELECT * FROM processing_health WHERE singleton=1",
      ).first<any>();
      r.text +=
        "\nProcesador local: " +
        (health && Date.now() - health.last_seen < 180000
          ? "activo"
          : "sin actividad reciente; comprueba npm run bot") +
        ".";
      if (health && !health.model_configured)
        r.text +=
          " Modelo no configurado: se conservan los metadatos y podrás completar a mano.";
    }
    return r;
  }
  if (["/publicar", "/preparar"].includes(command)) {
    await preview(env, date, r);
    return r;
  }
  if (command === "/ayuda" || command === "/start") {
    r.text =
      "Envía hasta 10 enlaces Twitch, YouTube o X. Se guardan y procesan automáticamente en un borrador privado.\n/seleccion · editar clips\n/estado · consultar procesamiento\n/publicar · revisar la edición antes de confirmar\n/edicion YYYY-MM-DD · cambiar fecha\n/cancelar · cancelar edición de texto\nLa edición completa está en admin del ordenador. Nada se publica al enviar enlaces.";
    return r;
  }
  if (command === "/cancelar") {
    r.writes.push(env.DB.prepare("DELETE FROM auto_input"));
    r.text = "Entrada pendiente cancelada; el borrador permanece.";
    return r;
  }
  if (command.startsWith("/")) return null;
  if (update.message) {
    const extracted = extractURLs(update.message);
    if (extracted.urls.length) {
      const cap = await capturePlan(
        env,
        extracted.urls,
        date,
        true,
        extracted.overflow,
      );
      r.writes.push(...cap.statements);
      r.text = `Recibidos ${extracted.urls.length} enlaces. Guardados: ${cap.saved.length}. Duplicados: ${cap.duplicate}. Rechazados: ${cap.rejected}. Exceso de entrada: ${extracted.overflow}.\nProcesando automáticamente. Recibirás el resumen al terminar; /estado muestra el avance. Nada publicado.`;
      if (cap.excess.length)
        r.text += `\n${cap.excess.length} fuentes guardadas en bandeja, fuera de la selección (máximo 10).`;
      return r;
    }
    const pending = await env.DB.prepare(
      "SELECT * FROM auto_input WHERE singleton=1",
    ).first<any>();
    if (pending) {
      const c = await getCandidate(env, pending.candidate);
      if (!c || c.revision !== pending.revision || pending.date !== date) {
        r.text =
          "El clip o la fecha cambió. Abre Editar de nuevo en /seleccion.";
        r.writes.push(env.DB.prepare("DELETE FROM auto_input"));
        return r;
      }
      const max =
        pending.field === "text" ? 400 : pending.field === "title" ? 120 : 80;
      if (!command || command.length > max) {
        r.text = `Escribe entre 1 y ${max} caracteres o /cancelar.`;
        return r;
      }
      r.writes.push(
        fenceCandidate(env, c),
        clearGuard(env),
        candidateWrite(env, c, { [pending.field]: command }),
        env.DB.prepare("DELETE FROM auto_input"),
      );
      r.text =
        "Cambio guardado. /seleccion para revisar o /publicar para ver la edición completa.";
      return r;
    }
  }
  return null;
}
export async function notifyBatches(env: Env) {
  const batches = await env.DB.prepare(
    "SELECT * FROM capture_batches b WHERE notify=1 AND notified=0 AND NOT EXISTS(SELECT 1 FROM capture_members m JOIN enrichment_jobs j ON j.candidate=m.candidate WHERE m.batch=b.id AND j.status IN ('queued','running')) ORDER BY created_at LIMIT 10",
  ).all<any>();
  for (const b of batches.results) {
    const members = await env.DB.prepare(
      "SELECT candidate FROM capture_members WHERE batch=?",
    )
      .bind(b.id)
      .all<{ candidate: string }>();
    const waiting = await env.DB.prepare(
      "SELECT 1 FROM capture_members m JOIN enrichment_jobs j ON j.candidate=m.candidate WHERE m.batch=? AND j.status IN ('queued','running') LIMIT 1",
    )
      .bind(b.id)
      .first();
    if (waiting) continue;
    const r = result();
    r.text = `Importación ${b.date} terminada · ${b.saved} nuevos, ${b.duplicates} duplicados, ${b.rejected} rechazados, ${b.overflow} fuera del lote o selección.\n`;
    await board(
      env,
      b.date,
      members.results.map((m) => m.candidate),
      r,
    );
    const id = -Number.parseInt(
      crypto.randomUUID().replaceAll("-", "").slice(0, 12),
      16,
    );
    try {
      await env.DB.batch([
        env.DB.prepare(
          "INSERT INTO manual_write_guard VALUES(1,EXISTS(SELECT 1 FROM capture_batches WHERE id=? AND notified=0))",
        ).bind(b.id),
        clearGuard(env),
        env.DB.prepare("UPDATE capture_batches SET notified=1 WHERE id=?").bind(
          b.id,
        ),
        env.DB.prepare("INSERT INTO telegram_updates VALUES(?,?)").bind(
          id,
          Date.now(),
        ),
        ...r.writes,
        ...outboxWrites(env, id, r),
      ]);
    } catch {
      /* Another receiver cycle may have committed this notification. */
    }
  }
}
