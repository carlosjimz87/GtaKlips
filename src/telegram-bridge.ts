import { autoUpdate, notifyBatches, outboxWrites } from "./auto-bot";
import {
  proposalGuard,
  enrichmentStatus,
  missingPatch,
  queueEnrichment,
} from "./enrichment";
import { source } from "./source";
import type { Env } from "./auth";
import { categories, dateValid } from "./model";
import {
  capturePlan,
  candidateWrite,
  clearGuard,
  getCandidate,
  getSelection,
  metadata,
  selectionClips,
  selectionGuard,
  selectionWrite,
  today,
  type ManualCandidate,
} from "./inbox";
import { extractURLs, ownerUpdate, retryDelay } from "./telegram";
export interface BridgeEnv extends Env {
  LOCAL_BRIDGE_SECRET?: string;
  TELEGRAM_OWNER_CHAT_ID?: string;
  TELEGRAM_OWNER_USER_ID?: string;
}
const reply = (v: unknown, status = 200) =>
  Response.json(v, { status, headers: { "Cache-Control": "no-store" } });
const leaseMs = 90000;
const help =
  "Envía hasta 10 enlaces Twitch, YouTube o X. Se guardan y procesan automáticamente en un borrador privado. /seleccion para editar, /estado para el avance, /publicar para revisar la edición y confirmar su publicación, /edicion YYYY-MM-DD para cambiar fecha y /cancelar para cancelar una entrada. La edición completa está en admin del ordenador. Nada se publica al enviar enlaces.";
async function processUpdate(
  env: BridgeEnv,
  update: any,
  receiver: any,
  owner: string,
) {
  if (!Number.isSafeInteger(update?.update_id) || update.update_id < 0)
    throw Error("update");
  const id = update.update_id;
  if (
    id < receiver.cursor ||
    (await env.DB.prepare(
      "SELECT update_id FROM telegram_updates WHERE update_id=?",
    )
      .bind(id)
      .first())
  )
    return { ok: true };
  const writes: D1PreparedStatement[] = [];
  let text = "",
    date = receiver.date || today(),
    pending: string | null = receiver.pending_candidate,
    pendingField: string | null = receiver.pending_field,
    pendingRevision: number | null = receiver.pending_revision;
  const keyboard: { text: string; callback_data: string }[][] = [];
  const buttons = async (c: ManualCandidate, selectionRevision: number) => {
    const row: { text: string; callback_data: string }[] = [];
    const position = keyboard.length / 2 + 1;
    const proposalRevision =
      c.provider === "x"
        ? (await env.DB.prepare(
            "SELECT created_at FROM enrichment_results WHERE candidate=?",
          )
            .bind(c.id)
            .first<number>("created_at")) || 0
        : 0;
    for (const [action, label] of [
      ["toggle", "Seleccionar/quitar"],
      ["category", "Categoría"],
      ["context", "Contexto"],
      ["discard", "Descartar"],
      ["up", "↑"],
      ["down", "↓"],
      ["metadata", "Propuesta / metadatos"],
      ...(c.provider === "x"
        ? [
            ["analyze", "Analizar"],
            ["apply-enrichment", "Aplicar vacíos"],
          ]
        : []),
    ]) {
      const token = crypto.randomUUID();
      writes.push(
        env.DB.prepare(
          "INSERT INTO telegram_buttons VALUES(?,?,?,?,?,?,?)",
        ).bind(
          token,
          c.id,
          action,
          date,
          selectionRevision,
          c.revision,
          Date.now() + 86400000,
        ),
      );
      if (action === "apply-enrichment")
        writes.push(
          env.DB.prepare("INSERT INTO enrichment_buttons VALUES(?,?)").bind(
            token,
            proposalRevision,
          ),
        );
      row.push({ text: `${position} · ${label}`, callback_data: token });
    }
    keyboard.push(row.slice(0, 3), row.slice(3));
  };
  const authorized = ownerUpdate(update, {
    chat: env.TELEGRAM_OWNER_CHAT_ID || "",
    user: env.TELEGRAM_OWNER_USER_ID || "",
  });
  const automatic = authorized ? await autoUpdate(env, update, date) : null;
  if (automatic) {
    writes.push(...automatic.writes);
    if (update.message?.text?.trim() === "/cancelar") {
      pending = pendingField = null;
      pendingRevision = null;
    }
    text = automatic.text;
    keyboard.push(...automatic.keyboard);
  } else if (authorized) {
    const message = update.message;
    const command =
      typeof message?.text === "string" ? message.text.trim() : "";
    if (update.edited_message)
      text =
        "No importo cambios de mensajes. Envía de nuevo el enlace como mensaje nuevo.";
    else if (update.callback_query) {
      const token = update.callback_query.data;
      const button =
        typeof token === "string" && token.length <= 64
          ? await env.DB.prepare(
              "SELECT * FROM telegram_buttons WHERE token=? AND expires_at>?",
            )
              .bind(token, Date.now())
              .first<any>()
          : null;
      const c = button ? await getCandidate(env, button.candidate) : null;
      const selection = await getSelection(env, date);
      if (
        !button ||
        !c ||
        button.date !== date ||
        button.selection_revision !== selection.revision ||
        button.candidate_revision !== c.revision
      )
        text =
          "Botón caducado o selección modificada. Usa /seleccion o reenvía el enlace para controles nuevos.";
      else {
        writes.push(
          env.DB.prepare(
            "INSERT INTO manual_write_guard VALUES(1,EXISTS(SELECT 1 FROM manual_candidates WHERE id=? AND revision=?))",
          ).bind(c.id, c.revision),
          clearGuard(env),
        );
        const ids: string[] = JSON.parse(selection.ids);
        const originalIds = JSON.stringify(ids);
        const index = ids.indexOf(c.id);
        const patch: Record<string, unknown> = {};
        if (button.action === "context") {
          pending = c.id;
          pendingField = "text";
          pendingRevision = c.revision;
          text =
            "Envía el contexto editorial (máximo 400 caracteres), o /cancelar. Compartir enlaces nuevos los guardará sin cancelar esta entrada.";
        } else {
          if (button.action === "toggle") {
            if (index >= 0) ids.splice(index, 1);
            else if (ids.length >= 10 || c.state === "discarded")
              text =
                "Máximo 10 fuentes; una fuente descartada debe recuperarse en la bandeja web.";
            else ids.push(c.id);
          } else if (button.action === "up" || button.action === "down") {
            const target = index + (button.action === "up" ? -1 : 1);
            if (index >= 0 && target >= 0 && target < ids.length)
              [ids[index], ids[target]] = [ids[target], ids[index]];
          } else if (button.action === "discard") {
            if (index >= 0) ids.splice(index, 1);
            patch.state = "discarded";
          } else if (button.action === "metadata") {
            if (c.provider === "x") {
              const result = await enrichmentStatus(env, c.id),
                p = result.proposal;
              text = `Análisis privado: ${(result.job as any)?.status || "sin iniciar"}.`;
              if (p) {
                const e = p.extraction,
                  s = p.suggestion;
                text += `\nAutor del post: ${e.author} ${e.handle} (no acredita al streamer).\nComentarios ${e.comments.length}/${e.commentsRequested}: ${e.commentsReason}\nOrientación detectada: ${p.orientation} ${e.width}×${e.height} (${e.dimensionSource}). Imagen: ${e.imageType} (poster no garantiza fotograma inicial).`;
                if (s)
                  text += `\nTítulo sugerido: ${s.title}\nStreamer: ${s.streamer || "desconocido (se usará el autor del post)"}\nContexto sugerido: ${s.text}\nCategoría sugerida: ${s.category}\nEvidencia de streamer: ${s.evidence.streamer || "no disponible"}`;
                else
                  text += e.text.trim()
                    ? "\nModelo local no disponible; extracción parcial."
                    : "\nPublicación sin texto: sólo se extraen medios, sin inventar metadatos editoriales.";
              }
              text +=
                "\nAplicar vacíos requiere tu botón explícito. No publica ni aprueba revisión. Consulta imagen/evidencia en la bandeja web.";
            } else {
              Object.assign(patch, await metadata(c));
              for (const key of ["title", "streamer", "thumbnail"] as const)
                if (c[key]) delete patch[key];
            }
          } else if (button.action === "analyze" && c.provider === "x") {
            writes.push(
              queueEnrichment(env, c.id),
              env.DB.prepare(
                "UPDATE enrichment_jobs SET status='queued',attempts=0,token=NULL,lease_until=0,next_at=0,error='',updated_at=? WHERE candidate=? AND status!='running'",
              ).bind(Date.now(), c.id),
            );
            text =
              "Solicitud de análisis recibida; si ya está ejecutándose, continúa. Consulta Propuesta después. No publica.";
          } else if (
            button.action === "apply-enrichment" &&
            c.provider === "x"
          ) {
            const result = await enrichmentStatus(env, c.id);
            const version = await env.DB.prepare(
              "SELECT proposal_revision FROM enrichment_buttons WHERE token=?",
            )
              .bind(token)
              .first<number>("proposal_revision");
            if (!result.proposal)
              text =
                "Todavía no hay una propuesta disponible. Consulta Propuesta después o analiza la fuente.";
            else if (version !== result.created_at)
              text =
                "La propuesta cambió. Consulta Propuesta y usa los controles nuevos antes de aplicar.";
            else {
              Object.assign(patch, missingPatch(c, result.proposal));
              writes.push(proposalGuard(env, c.id, version), clearGuard(env));
              text = Object.keys(patch).length
                ? "Propuesta aplicada sólo a campos vacíos. No aprueba ni publica una edición."
                : "No hay campos vacíos que completar. No se ha cambiado ni publicado nada.";
            }
          } else if (button.action === "category") {
            patch.category =
              categories[
                (categories.indexOf(c.category as any) + 1) % categories.length
              ];
          }
          if (!text)
            text =
              "Selección privada actualizada. Usa los controles nuevos de esta respuesta. No se ha guardado ni publicado una edición.";
        }
        const changedSelection = JSON.stringify(ids) !== originalIds;
        const changedCandidate = Object.keys(patch).length > 0;
        if (changedCandidate)
          writes.push(
            candidateWrite(
              env,
              c,
              patch,
              button.action === "metadata"
                ? c.provider + " metadata"
                : "manual",
            ),
          );
        // The guard fences the read snapshot even when only the candidate changed.
        writes.push(selectionGuard(env, selection));
        if (changedSelection) writes.push(selectionWrite(env, selection, ids));
        writes.push(clearGuard(env));

        // A batch capture is a board. Recover its members from the persisted reply,
        // so selecting its first source returns usable controls for the other nine.
        const previous = await env.DB.prepare(
          "SELECT payload FROM telegram_outbox WHERE instr(payload,?)>0 ORDER BY id DESC LIMIT 1",
        )
          .bind(token)
          .first<string>("payload");
        const tokens: string[] = previous
          ? JSON.parse(previous)
              .reply_markup?.inline_keyboard?.flat()
              .map((b: any) => b.callback_data)
              .filter((t: unknown) => typeof t === "string") || []
          : [];
        const members = tokens.length
          ? (
              await env.DB.prepare(
                "SELECT candidate FROM telegram_buttons WHERE token IN (" +
                  tokens.map(() => "?").join(",") +
                  ") ORDER BY rowid",
              )
                .bind(...tokens)
                .all<{ candidate: string }>()
            ).results.map((b) => b.candidate)
          : [c.id];
        const candidateIds = [...new Set(members)].slice(0, 10);
        for (const candidateId of candidateIds) {
          const current =
            candidateId === c.id
              ? ({
                  ...c,
                  ...patch,
                  revision: c.revision + Number(changedCandidate),
                } as ManualCandidate)
              : await getCandidate(env, candidateId);
          if (!current || current.state === "discarded") continue;
          text += `\n${keyboard.length / 2 + 1}. ${ids.includes(current.id) ? "✓ " : ""}${current.title || current.url} · ${current.category}`;
          await buttons(current, selection.revision + Number(changedSelection));
        }
      }
    } else if (command === "/cancelar") {
      pending = pendingField = null;
      pendingRevision = null;
      text =
        "Entrada pendiente cancelada. La selección guardada permanece privada.";
    } else if (command.startsWith("/edicion")) {
      const value = command.split(/\s+/)[1];
      if (!dateValid(value))
        text = "Usa /edicion YYYY-MM-DD con una fecha válida.";
      else {
        date = value;
        writes.push(env.DB.prepare("DELETE FROM auto_input"));
        pending = pendingField = null;
        pendingRevision = null;
        text = `Fecha editorial: ${date} (Madrid).`;
      }
    } else if (["/seleccion", "/preparar", "/estado"].includes(command)) {
      const selection = await getSelection(env, date);
      const ids: string[] = JSON.parse(selection.ids);
      if (command === "/preparar") {
        if (!ids.length)
          text = "Selecciona entre 1 y 10 fuentes antes de preparar.";
        else {
          try {
            await selectionClips(env, selection);
            writes.push(
              selectionGuard(env, selection),
              selectionWrite(env, selection, ids, true),
              clearGuard(env),
            );
            text = `Selección de ${date} preparada (${ids.length}). Ábrela desde la bandeja web en tu ordenador. Completa contexto, crédito y revisión; publica explícitamente allí.`;
          } catch {
            text =
              "Hay fuentes descartadas. Revisa la selección en la bandeja web.";
          }
        }
      } else {
        text = `${date} · ${ids.length}/10 seleccionados · ${selection.prepared ? "preparada" : "sin preparar"}\n`;
        for (const [index, candidateId] of ids.entries()) {
          const c = await getCandidate(env, candidateId);
          if (!c) continue;
          text += `${index + 1}. ${c.title || c.url} · ${c.category}\n`;
          if (command === "/seleccion") await buttons(c, selection.revision);
        }
        text += "Privado: no se ha publicado nada.";
      }
    } else if (command.startsWith("/")) text = help;
    else if (
      pending &&
      pendingField &&
      !extractURLs(message || {}).urls.some((url) => {
        try {
          source(url);
          return true;
        } catch {
          return false;
        }
      })
    ) {
      const c = await getCandidate(env, pending);
      if (!c || c.revision !== pendingRevision) {
        text = "La fuente cambió. Abre controles nuevos con /seleccion.";
        pending = pendingField = null;
        pendingRevision = null;
      } else if (!command || command.length > 400)
        text = "Envía texto de 1 a 400 caracteres o /cancelar.";
      else {
        writes.push(
          env.DB.prepare(
            "INSERT INTO manual_write_guard VALUES(1,EXISTS(SELECT 1 FROM manual_candidates WHERE id=? AND revision=?))",
          ).bind(c.id, c.revision),
          clearGuard(env),
          candidateWrite(env, c, { text: command }),
        );
        pending = pendingField = null;
        pendingRevision = null;
        text =
          "Contexto guardado en la bandeja privada; revisa antes de publicar.";
      }
    } else if (message) {
      const extracted = extractURLs(message);
      if (!extracted.urls.length) text = help;
      else {
        const capture = await capturePlan(env, extracted.urls, date);
        writes.push(...capture.statements);
        text = `Guardados: ${capture.saved.length}. Duplicados: ${capture.duplicate}. Rechazados: ${capture.rejected}. Exceso (no guardado): ${extracted.overflow}.\nRevisa autoría, contexto y disponibilidad en la bandeja. No se ha publicado nada.`;
        // Existing and just-created rows are read on the next resend or /seleccion.
        const selection = await getSelection(env, date);
        for (const url of extracted.urls) {
          try {
            const link = source(url);
            const c =
              (await getCandidate(env, link.id)) ||
              ({
                id: link.id,
                provider: link.provider,
                revision: 1,
              } as ManualCandidate);
            text += `\n${keyboard.length / 2 + 1}. ${link.url}`;
            await buttons(c, selection.revision);
          } catch {
            /* rejected URLs never produce buttons */
          }
        }
      }
    }
  }
  const now = Date.now();
  const guard = env.DB.prepare(
    "INSERT INTO manual_write_guard VALUES(1,EXISTS(SELECT 1 FROM telegram_receiver WHERE singleton=1 AND owner=? AND expires_at>? AND cursor=?))",
  ).bind(owner, now, receiver.cursor);
  await env.DB.batch([
    guard,
    clearGuard(env),
    env.DB.prepare("INSERT INTO telegram_updates VALUES(?,?)").bind(id, now),
    ...writes,
    ...(text ? outboxWrites(env, id, { text, keyboard, writes: [] }) : []),
    env.DB.prepare(
      "UPDATE telegram_receiver SET cursor=?,date=?,pending_candidate=?,pending_field=?,pending_revision=? WHERE singleton=1",
    ).bind(id + 1, date, pending, pendingField, pendingRevision),
    env.DB.prepare(
      "DELETE FROM enrichment_buttons WHERE token NOT IN (SELECT token FROM telegram_buttons WHERE expires_at>=?)",
    ).bind(now),
    env.DB.prepare("DELETE FROM telegram_buttons WHERE expires_at<?").bind(now),
    env.DB.prepare("DELETE FROM auto_buttons WHERE expires_at<=?").bind(now),
  ]);
  return { ok: true };
}
export async function bridge(
  request: Request,
  env: BridgeEnv,
): Promise<Response> {
  if (
    !env.LOCAL_BRIDGE_SECRET ||
    env.LOCAL_BRIDGE_SECRET.length < 32 ||
    request.headers.get("Authorization") !==
      `Bearer ${env.LOCAL_BRIDGE_SECRET}` ||
    request.headers.has("Origin")
  )
    return reply({ error: "Unauthorized" }, 401);
  try {
    if (
      request.method !== "POST" ||
      !request.headers.get("Content-Type")?.startsWith("application/json")
    )
      return reply({ error: "JSON POST required" }, 405);
    const reader = request.body?.getReader();
    if (!reader) return reply({}, 400);
    let size = 0,
      raw = "";
    const decoder = new TextDecoder();
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.length;
      if (size > 65536) {
        await reader.cancel();
        return reply({}, 413);
      }
      raw += decoder.decode(value, { stream: true });
    }
    const v = JSON.parse(raw + decoder.decode());
    if (typeof v.owner !== "string" || !/^[a-f0-9-]{36}$/.test(v.owner))
      return reply({}, 400);
    const action = new URL(request.url).pathname.slice(
        "/internal/telegram/".length,
      ),
      now = Date.now();
    if (action === "health") {
      const healthReceiver = await env.DB.prepare(
        "SELECT cursor,expires_at FROM telegram_receiver WHERE singleton=1",
      ).first<any>();
      const pending = await env.DB.prepare(
        "SELECT count(*) AS count FROM telegram_outbox WHERE delivered=0",
      ).first();
      const failed = await env.DB.prepare(
        "SELECT count(*) AS count FROM telegram_outbox WHERE delivered=-1",
      ).first();
      return reply({
        ok: true,
        cursor: healthReceiver.cursor,
        running: healthReceiver.expires_at > now,
        pending,
        failed,
        processing: await env.DB.prepare(
          "SELECT last_seen,model_configured FROM processing_health WHERE singleton=1",
        ).first(),
      });
    }
    if (action === "lease") {
      const acquired = await env.DB.prepare(
        "UPDATE telegram_receiver SET owner=?,expires_at=? WHERE singleton=1 AND (owner=? OR expires_at<=?) RETURNING cursor",
      )
        .bind(v.owner, now + leaseMs, v.owner, now)
        .first();
      return acquired
        ? reply(acquired)
        : reply({ error: "Receiver busy" }, 409);
    }
    const receiver = await env.DB.prepare(
      "SELECT * FROM telegram_receiver WHERE singleton=1 AND owner=? AND expires_at>?",
    )
      .bind(v.owner, now)
      .first<any>();
    if (!receiver) return reply({ error: "Lease expired" }, 409);
    if (action === "release") {
      await env.DB.prepare(
        "UPDATE telegram_receiver SET owner=NULL,expires_at=0 WHERE owner=?",
      )
        .bind(v.owner)
        .run();
      return reply({ ok: true });
    }
    if (action === "update")
      return reply(await processUpdate(env, v.update, receiver, v.owner));
    if (action === "outbox") {
      await notifyBatches(env);
      return reply(
        (
          await env.DB.prepare(
            "SELECT id,payload,attempts FROM telegram_outbox o WHERE delivered=0 AND next_at<=? AND NOT EXISTS(SELECT 1 FROM telegram_outbox prior WHERE prior.update_id=o.update_id AND prior.part<o.part AND prior.delivered!=1) ORDER BY id LIMIT 10",
          )
            .bind(now)
            .all()
        ).results,
      );
    }
    if (action === "ack") {
      if (!Number.isSafeInteger(v.id) || typeof v.ok !== "boolean")
        return reply({}, 400);
      const row = await env.DB.prepare(
        "SELECT attempts,update_id,part FROM telegram_outbox WHERE id=? AND delivered=0",
      )
        .bind(v.id)
        .first<any>();
      if (row) {
        const ack = env.DB.prepare(
          "UPDATE telegram_outbox SET delivered=?,attempts=attempts+1,next_at=? WHERE id=?",
        ).bind(
          v.ok ? 1 : row.attempts >= 7 ? -1 : 0,
          now +
            retryDelay(
              row.attempts,
              Number.isFinite(v.retryAfter) ? v.retryAfter : 0,
            ),
          v.id,
        );
        await env.DB.batch([
          ack,
          ...(!v.ok && row.attempts >= 7
            ? [
                env.DB.prepare(
                  "UPDATE telegram_outbox SET delivered=-1 WHERE update_id=? AND part>? AND delivered=0",
                ).bind(row.update_id, row.part),
              ]
            : []),
        ]);
      }
      return reply({ ok: true });
    }
    return reply({}, 404);
  } catch {
    return reply({ error: "Bridge operation failed; retry safely" }, 409);
  }
}
