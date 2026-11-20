import type { Env } from "./auth";
import { categories, dateValid, str, thumbnail } from "./model";
import { source } from "./source";
export interface ManualCandidate {
  id: string;
  provider: string;
  source_id: string;
  url: string;
  captured_date: string;
  created_at: string;
  state: string;
  title: string;
  streamer: string;
  text: string;
  category: string;
  orientation: string;
  thumbnail: string | null;
  revision: number;
}
export interface Selection {
  date: string;
  revision: number;
  ids: string;
  prepared: number;
}
export const today = () =>
  new Intl.DateTimeFormat("en-CA", {
    timeZone: "Europe/Madrid",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
export const getSelection = async (
  env: Env,
  date: string,
): Promise<Selection> => {
  if (!dateValid(date)) throw Error("Fecha no válida");
  return (
    (await env.DB.prepare("SELECT * FROM manual_selections WHERE date=?")
      .bind(date)
      .first<Selection>()) || { date, revision: 0, ids: "[]", prepared: 0 }
  );
};
export const getCandidate = (env: Env, id: string) =>
  env.DB.prepare("SELECT * FROM manual_candidates WHERE id=?")
    .bind(id)
    .first<ManualCandidate>();
export function selectionWrite(
  env: Env,
  previous: Selection,
  ids: string[],
  prepared = false,
) {
  if (
    ids.length > 10 ||
    new Set(ids).size !== ids.length ||
    (prepared && !ids.length)
  )
    throw Error("Clips: selecciona entre 1 y 10 fuentes únicas");
  return env.DB.prepare(
    "INSERT INTO manual_selections(date,ids,prepared) VALUES(?,?,?) ON CONFLICT(date) DO UPDATE SET ids=excluded.ids,prepared=excluded.prepared,revision=manual_selections.revision+1 WHERE manual_selections.revision=?",
  ).bind(
    previous.date,
    JSON.stringify(ids),
    Number(prepared),
    previous.revision,
  );
}
export function selectionGuard(env: Env, previous: Selection) {
  return env.DB.prepare(
    "INSERT INTO manual_write_guard VALUES(1, COALESCE((SELECT revision FROM manual_selections WHERE date=?),0)=?)",
  ).bind(previous.date, previous.revision);
}
export const clearGuard = (env: Env) =>
  env.DB.prepare("DELETE FROM manual_write_guard");
export async function capturePlan(env: Env, urls: string[], date: string) {
  if (!dateValid(date) || urls.length > 10)
    throw Error("Fecha o cantidad de URLs no válida");
  const statements: D1PreparedStatement[] = [],
    saved: string[] = [];
  let duplicate = 0,
    rejected = 0;
  const seen = new Set<string>();
  for (const raw of urls) {
    let link;
    try {
      link = source(raw);
    } catch {
      rejected++;
      continue;
    }
    const existing = await getCandidate(env, link.id);
    if (seen.has(link.id) || existing) {
      duplicate++;
      continue;
    }
    seen.add(link.id);
    // Imported Twitch candidates retain their editorial review and known metadata.
    const imported =
      link.provider === "twitch"
        ? await env.DB.prepare("SELECT * FROM candidates WHERE id=?")
            .bind(link.sourceId)
            .first<any>()
        : null;
    if (imported) duplicate++;
    else saved.push(link.id);
    statements.push(
      env.DB.prepare(
        "INSERT INTO manual_candidates(id,provider,source_id,url,captured_date,created_at,title,streamer,thumbnail,state) VALUES(?,?,?,?,?,?,?,?,?,?) ON CONFLICT(id) DO NOTHING",
      ).bind(
        link.id,
        link.provider,
        link.sourceId,
        link.url,
        date,
        new Date().toISOString(),
        imported?.title || "",
        imported?.streamer || "",
        imported?.thumbnail || null,
        imported?.review_state === "rejected" ? "discarded" : "pending",
      ),
    );
  }
  return { statements, saved, duplicate, rejected };
}
export function candidateWrite(env: Env, c: ManualCandidate, patch: any) {
  const value = { ...c };
  for (const [name, max] of [
    ["title", 120],
    ["streamer", 80],
    ["text", 400],
  ] as const)
    if (patch[name] !== undefined)
      value[name] = patch[name] === "" ? "" : str(patch[name], max);
  if (patch.category !== undefined) {
    if (!categories.includes(patch.category))
      throw Error("Categoría no válida");
    value.category = patch.category;
  }
  if (patch.state !== undefined) {
    if (!["pending", "reviewed", "discarded"].includes(patch.state))
      throw Error("Revisión no válida");
    value.state = patch.state;
  }
  if (patch.orientation !== undefined) {
    if (!["auto", "portrait", "landscape"].includes(patch.orientation))
      throw Error("URL: orientación no válida");
    value.orientation = patch.orientation;
  }
  if (patch.thumbnail !== undefined)
    value.thumbnail = thumbnail(patch.thumbnail) || null;
  return env.DB.prepare(
    "UPDATE manual_candidates SET title=?,streamer=?,text=?,category=?,state=?,orientation=?,thumbnail=?,revision=revision+1 WHERE id=? AND revision=?",
  ).bind(
    value.title,
    value.streamer,
    value.text,
    value.category,
    value.state,
    value.orientation,
    value.thumbnail,
    c.id,
    c.revision,
  );
}
export async function selectionClips(env: Env, s: Selection) {
  const clips: ManualCandidate[] = [];
  for (const id of JSON.parse(s.ids)) {
    const c = await getCandidate(env, id);
    if (!c || c.state === "discarded")
      throw Error(
        "Clips: selección contiene una fuente descartada; revisa la selección",
      );
    clips.push(c);
  }
  return clips;
}
// Optional enrichment never executes HTML, follows redirects or fetches the submitted URL.
export async function metadata(
  c: ManualCandidate,
): Promise<Record<string, string>> {
  if (c.provider !== "youtube") return {};
  const link = source(c.url);
  const url = new URL("https://www.youtube.com/oembed");
  url.searchParams.set("url", link.url);
  url.searchParams.set("format", "json");
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 4000);
  try {
    const r = await fetch(url, {
      redirect: "manual",
      signal: controller.signal,
    });
    if (!r.ok || !r.headers.get("Content-Type")?.includes("application/json")) {
      await r.body?.cancel();
      return {};
    }
    const reader = r.body?.getReader();
    if (!reader) return {};
    const decoder = new TextDecoder();
    let data = "",
      bytes = 0;
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      bytes += value.length;
      if (bytes > 32768) {
        await reader.cancel();
        return {};
      }
      data += decoder.decode(value, { stream: true });
    }
    const v = JSON.parse(data + decoder.decode());
    if (v.provider_name !== "YouTube") return {};
    const title = str(v.title, 120),
      streamer = str(v.author_name, 80);
    return {
      title,
      streamer,
      thumbnail: `https://i.ytimg.com/vi/${link.sourceId}/hqdefault.jpg`,
    };
  } catch {
    return {};
  } finally {
    clearTimeout(timer);
  }
}
export async function inboxAction(env: Env, action: string, v: any) {
  if (action === "capture") {
    if (
      !Array.isArray(v.urls) ||
      !v.urls.every((s: unknown) => typeof s === "string")
    )
      throw Error("URL no válida");
    const result = await capturePlan(env, v.urls, v.date || today());
    if (result.statements.length) await env.DB.batch(result.statements);
    return {
      saved: result.saved,
      duplicate: result.duplicate,
      rejected: result.rejected,
    };
  }
  if (action === "edit" || action === "metadata") {
    const c = await getCandidate(env, String(v.id));
    if (!c || c.revision !== v.revision)
      throw Error("Revisión cambió. Recarga.");
    const patch = action === "edit" ? v : await metadata(c);
    // Optional metadata only fills blanks; editorial work always wins.
    if (action === "metadata")
      for (const key of ["title", "streamer", "thumbnail"] as const)
        if (c[key]) delete patch[key];
    const result = await candidateWrite(env, c, patch).run();
    if (!result.meta.changes) throw Error("Revisión cambió. Recarga.");
    return { ok: true, enriched: Object.keys(patch).length > 0 };
  }
  if (action === "selection") {
    const previous = await getSelection(env, v.date);
    if (v.revision !== previous.revision)
      throw Error("Revisión cambió. Recarga.");
    if (
      !Array.isArray(v.ids) ||
      !v.ids.every((id: unknown) => typeof id === "string") ||
      v.ids.length > 10
    )
      throw Error("Clips no válidos");
    await selectionClips(env, { ...previous, ids: JSON.stringify(v.ids) });
    await env.DB.batch([
      selectionGuard(env, previous),
      selectionWrite(env, previous, v.ids, v.prepared === true),
      clearGuard(env),
    ]);
    return { revision: previous.revision + 1 };
  }
  throw Error("Contenido: acción desconocida");
}
