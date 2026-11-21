import { candidateWrite, getCandidate, metadata, clearGuard } from "./inbox";
import { protectedPatch, missingFields } from "./auto-state";
import { twitchMetadata } from "./importer";
import type { Env } from "./auth";
import type { ManualCandidate } from "./inbox";
import {
  jpegDimensions,
  assetID,
  assetPath,
  proposal,
  type Proposal,
} from "./enrichment-contract";
export function queueEnrichment(env: Env, id: string) {
  return env.DB.prepare(
    "INSERT INTO enrichment_jobs(candidate,updated_at) SELECT id,? FROM manual_candidates WHERE id=? AND state!='discarded' ON CONFLICT(candidate) DO NOTHING",
  ).bind(Date.now(), id);
}
/** Source ids (per provider) whose analysis flagged X sensitive content. */
export async function sensitiveSources(env: Env): Promise<Set<string>> {
  const { results } = await env.DB.prepare(
    "SELECT c.provider,c.source_id FROM enrichment_results r JOIN manual_candidates c ON c.id=r.candidate WHERE json_extract(r.proposal,'$.extraction.sensitive')=1",
  ).all<{ provider: string; source_id: string }>();
  return new Set(results.map((r) => r.provider + ":" + r.source_id));
}
export async function enrichmentStatus(env: Env, id: string) {
  const job = await env.DB.prepare(
    "SELECT status,attempts,error,updated_at FROM enrichment_jobs WHERE candidate=?",
  )
    .bind(id)
    .first();
  const result = await env.DB.prepare(
    "SELECT proposal,created_at FROM enrichment_results WHERE candidate=?",
  )
    .bind(id)
    .first<{ proposal: string; created_at: number }>();
  return {
    candidate: await getCandidate(env, id),
    job,
    proposal: result ? proposal(JSON.parse(result.proposal)) : null,
    created_at: result?.created_at,
  };
}
export function proposalGuard(env: Env, id: string, version: number) {
  return env.DB.prepare(
    "INSERT INTO manual_write_guard VALUES(1,EXISTS(SELECT 1 FROM enrichment_results WHERE candidate=? AND created_at=?))",
  ).bind(id, version);
}
export async function retryEnrichment(env: Env, id: string) {
  await queueEnrichment(env, id).run();
  await env.DB.prepare(
    "UPDATE enrichment_jobs SET status='queued',attempts=0,token=NULL,lease_until=0,next_at=0,error='',updated_at=? WHERE candidate=? AND status!='running'",
  )
    .bind(Date.now(), id)
    .run();
}
export function missingPatch(c: ManualCandidate, p: Proposal) {
  const patch: Record<string, unknown> = {};
  if (p.suggestion) {
    for (const k of ["title", "streamer", "text"] as const)
      if (!c[k] && p.suggestion[k]) patch[k] = p.suggestion[k];
    // The post author is only a fallback credit («Post of»), never the streamer.
    const creator = (p.extraction.handle || p.extraction.author || "").trim();
    if (!c.creator && creator) patch.creator = creator;
    if (!c.category || (c.revision === 1 && c.category === "Fails"))
      patch.category = p.suggestion.category;
  }
  if (
    c.orientation === "auto" &&
    ["portrait", "landscape", "square"].includes(p.orientation)
  )
    patch.orientation = p.orientation;
  if (!c.thumbnail && p.thumbnail) patch.thumbnail = p.thumbnail;
  return patch;
}
export async function enrichmentAsset(
  env: Env,
  id: string,
  privateAccess = false,
) {
  if (!/^[a-f0-9]{64}$/.test(id))
    return new Response("Not found", { status: 404 });
  if (!privateAccess) {
    const visible = await env.DB.prepare(
      "SELECT 1 FROM editions,json_each(editions.published,'$.clips') AS clip WHERE editions.published IS NOT NULL AND json_extract(clip.value,'$.thumbnail')=? LIMIT 1",
    )
      .bind(assetPath(id))
      .first();
    if (!visible) return new Response("Not found", { status: 404 });
  }
  const row = await env.DB.prepare(
    "SELECT jpeg FROM enrichment_assets WHERE id=?",
  )
    .bind(id)
    .first<{ jpeg: ArrayBuffer | number[] }>();
  return row
    ? new Response(
        Array.isArray(row.jpeg) ? Uint8Array.from(row.jpeg) : row.jpeg,
        {
          headers: {
            "Content-Type": "image/jpeg",
            "Cache-Control": "no-store",
          },
        },
      )
    : new Response("Not found", { status: 404 });
}
export interface EnrichmentEnv extends Env {
  LOCAL_BRIDGE_SECRET?: string;
}
export async function enrichmentBridge(request: Request, env: EnrichmentEnv) {
  const reply = (v: unknown, status = 200) =>
    Response.json(v, { status, headers: { "Cache-Control": "no-store" } });
  if (
    !env.LOCAL_BRIDGE_SECRET ||
    env.LOCAL_BRIDGE_SECRET.length < 32 ||
    request.headers.get("Authorization") !==
      `Bearer ${env.LOCAL_BRIDGE_SECRET}` ||
    request.headers.has("Origin")
  )
    return reply({}, 401);
  if (
    request.method !== "POST" ||
    !request.headers.get("Content-Type")?.startsWith("application/json")
  )
    return reply({}, 405);
  try {
    const reader = request.body?.getReader();
    if (!reader) return reply({}, 400);
    let bytes = 0,
      raw = "";
    const decoder = new TextDecoder();
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      bytes += value.length;
      if (bytes > 1048576) {
        await reader.cancel();
        return reply({}, 413);
      }
      raw += decoder.decode(value, { stream: true });
    }
    const v = JSON.parse(raw + decoder.decode()),
      now = Date.now(),
      action = new URL(request.url).pathname.split("/").at(-1);
    if (action === "claim") {
      await env.DB.prepare(
        "INSERT INTO processing_health VALUES(1,?,?) ON CONFLICT(singleton) DO UPDATE SET last_seen=excluded.last_seen,model_configured=excluded.model_configured",
      )
        .bind(now, Number(v.modelConfigured === true))
        .run();
      await env.DB.prepare(
        "UPDATE enrichment_jobs SET status=CASE WHEN attempts>=3 THEN 'failed' ELSE 'queued' END,token=NULL,error='Proceso interrumpido o tiempo agotado',updated_at=? WHERE status='running' AND lease_until<=?",
      )
        .bind(now, now)
        .run();
      const job = await env.DB.prepare(
        "UPDATE enrichment_jobs SET status='running',attempts=attempts+1,token=?,lease_until=?,updated_at=? WHERE candidate=(SELECT candidate FROM enrichment_jobs WHERE status='queued' AND attempts<3 AND next_at<=? ORDER BY updated_at LIMIT 1) AND NOT EXISTS(SELECT 1 FROM enrichment_jobs WHERE status='running') RETURNING candidate,token",
      )
        .bind(crypto.randomUUID(), now + 180000, now, now)
        .first<{ candidate: string; token: string }>();
      if (!job) return reply({ job: null });
      const c = await env.DB.prepare(
        "SELECT * FROM manual_candidates WHERE id=?",
      )
        .bind(job.candidate)
        .first();
      return reply({ job: { ...job, ...c } });
    }
    if (
      !["finish", "fail", "metadata", "complete"].includes(action || "") ||
      typeof v.candidate !== "string" ||
      typeof v.token !== "string"
    )
      return reply({}, 400);
    const job = await env.DB.prepare(
      "SELECT attempts FROM enrichment_jobs WHERE candidate=? AND token=? AND status='running' AND lease_until>?",
    )
      .bind(v.candidate, v.token, now)
      .first<{ attempts: number }>();
    if (!job) return reply({ error: "Stale enrichment job" }, 409);
    const guard = env.DB.prepare(
      "INSERT INTO manual_write_guard VALUES(1,EXISTS(SELECT 1 FROM enrichment_jobs WHERE candidate=? AND token=? AND status='running' AND lease_until>?))",
    ).bind(v.candidate, v.token, now);
    if (action === "metadata") {
      const before = await getCandidate(env, v.candidate);
      if (!before) return reply({}, 404);
      const data =
        before.provider === "twitch"
          ? await twitchMetadata(env, before.source_id)
          : await metadata(before);
      const current = await getCandidate(env, v.candidate);
      if (!current) return reply({}, 404);
      const patch = protectedPatch(current, data);
      if (Object.keys(patch).length)
        await env.DB.batch([
          guard,
          clearGuard(env),
          candidateWrite(env, current, patch, current.provider + " metadata"),
        ]);
      return reply({
        candidate: await getCandidate(env, v.candidate),
        metadata: data,
      });
    }
    if (action === "complete") {
      const c = await getCandidate(env, v.candidate);
      if (!c || missingFields(c).length) return reply({}, 400);
      await env.DB.batch([
        guard,
        clearGuard(env),
        env.DB.prepare(
          "UPDATE enrichment_jobs SET status='complete',token=NULL,lease_until=0,error='',updated_at=? WHERE candidate=? AND token=?",
        ).bind(now, v.candidate, v.token),
      ]);
      return reply({ ok: true });
    }
    if (action === "fail") {
      await env.DB.batch([
        guard,
        env.DB.prepare("DELETE FROM manual_write_guard"),
        env.DB.prepare(
          "UPDATE enrichment_jobs SET status=?,token=NULL,lease_until=0,next_at=?,error='Análisis local no disponible; puedes reintentar o editar manualmente',updated_at=? WHERE candidate=? AND token=?",
        ).bind(
          job.attempts >= 3 ? "failed" : "queued",
          now + 30000 * job.attempts,
          now,
          v.candidate,
          v.token,
        ),
      ]);
      return reply({ ok: true });
    }
    const p = proposal(v.proposal),
      writes: D1PreparedStatement[] = [];
    const c = await env.DB.prepare("SELECT * FROM manual_candidates WHERE id=?")
      .bind(v.candidate)
      .first<ManualCandidate>();
    if (
      !c ||
      c.source_id !== p.extraction.postId ||
      c.provider !== (p.extraction.provider || "x")
    )
      return reply({}, 400);
    if (c.automatic && c.state !== "discarded") {
      const patch = protectedPatch(c, missingPatch(c, p));
      for (const k of ["title", "streamer", "text", "category"] as const)
        if (patch[k] && !p.suggestion?.evidence[k]) delete patch[k];
      if (Object.keys(patch).length)
        writes.push(candidateWrite(env, c, patch, "enrich (propuesta)"));
    }
    if (p.thumbnail) {
      if (
        typeof v.jpeg !== "string" ||
        v.jpeg.length > 409600 ||
        !/^[A-Za-z0-9+/]+={0,2}$/.test(v.jpeg)
      )
        return reply({}, 400);
      const image = Uint8Array.from(atob(v.jpeg), (c) => c.charCodeAt(0));
      jpegDimensions(image);
      const hash = Array.from(
        new Uint8Array(await crypto.subtle.digest("SHA-256", image)),
        (b) => b.toString(16).padStart(2, "0"),
      ).join("");
      if (hash !== assetID(p.thumbnail)) return reply({}, 400);
      writes.push(
        env.DB.prepare(
          "INSERT INTO enrichment_assets VALUES(?,?,?) ON CONFLICT(id) DO NOTHING",
        ).bind(hash, image.buffer, now),
      );
    } else if (v.jpeg) return reply({}, 400);
    writes.push(
      env.DB.prepare(
        "INSERT INTO enrichment_results VALUES(?,?,?) ON CONFLICT(candidate) DO UPDATE SET proposal=excluded.proposal,created_at=MAX(enrichment_results.created_at+1,excluded.created_at)",
      ).bind(v.candidate, JSON.stringify(p), now),
      env.DB.prepare(
        "UPDATE enrichment_jobs SET status=?,token=NULL,lease_until=0,error=?,updated_at=? WHERE candidate=? AND token=?",
      ).bind(
        p.modelStatus === "complete" ? "complete" : "partial",
        p.modelStatus === "complete"
          ? ""
          : p.extraction.text.trim()
            ? "Modelo local no disponible; extracción parcial"
            : "Publicación sin texto; medios extraídos sin inventar metadatos editoriales",
        now,
        v.candidate,
        v.token,
      ),
    );
    await env.DB.batch([
      guard,
      env.DB.prepare("DELETE FROM manual_write_guard"),
      ...writes,
    ]);
    return reply({ ok: true });
  } catch {
    return reply({ error: "Invalid enrichment operation" }, 400);
  }
}
