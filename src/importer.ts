import type { Env } from "./auth";
import { str, twitch, thumbnail } from "./model";

export const GAME_NAME = "Grand Theft Auto VI";
export const limits = {
  pages: 5,
  pageSize: 100,
  bytes: 1_048_576,
  timeout: 5000,
  lease: 60000,
};
type ErrorCode =
  | "missing_config"
  | "invalid_config"
  | "unauthorized"
  | "rate_limit"
  | "upstream"
  | "malformed"
  | "network"
  | "timeout"
  | "too_large"
  | "game_absent"
  | "game_mismatch"
  | "invalid_clip"
  | "page_limit"
  | "repeated_cursor"
  | "overlap"
  | "lease_expired"
  | "storage";
class ImportError extends Error {
  constructor(readonly code: ErrorCode) {
    super(code);
  }
}
export interface Candidate {
  thumbnail?: string | null;
  id: string;
  url: string;
  streamer: string;
  title: string;
  language: string;
  game_id: string;
  created_at: string;
  duration: number;
  views: number;
  observed_at: string;
  review_state: "pending" | "selected" | "rejected";
}
export interface ImportRun {
  id: string;
  trigger: "manual" | "cron";
  status: "running" | "success" | "empty" | "partial" | "error" | "skipped";
  started_at: string;
  finished_at: string | null;
  window_start: string;
  window_end: string;
  requests: number;
  pages: number;
  found: number;
  saved: number;
  game_id: string | null;
  game_name: string | null;
  error_code: ErrorCode | null;
}
function fail(code: ErrorCode): never {
  throw new ImportError(code);
}
const object = (v: any): v is Record<string, any> =>
  v !== null && typeof v === "object" && !Array.isArray(v);

// The timer covers headers AND streamed body. No redirects, retries or upstream diagnostics.
async function upstream(url: URL, init: RequestInit): Promise<any> {
  const controller = new AbortController();
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([
      (async () => {
        const r = await fetch(url, {
          ...init,
          redirect: "manual",
          signal: controller.signal,
        });
        if (!r.ok) {
          void r.body?.cancel();
          fail(
            r.status === 401 || r.status === 403
              ? "unauthorized"
              : r.status === 429
                ? "rate_limit"
                : "upstream",
          );
        }
        if (
          !r.headers
            .get("content-type")
            ?.toLowerCase()
            .includes("application/json")
        )
          fail("malformed");
        if (Number(r.headers.get("content-length")) > limits.bytes) {
          void r.body?.cancel();
          fail("too_large");
        }
        const reader = r.body?.getReader();
        if (!reader) fail("malformed");
        const chunks: Uint8Array[] = [];
        let size = 0;
        for (;;) {
          const { value, done } = await reader.read();
          if (done) break;
          size += value.length;
          if (size > limits.bytes) {
            void reader.cancel();
            fail("too_large");
          }
          chunks.push(value);
        }
        const bytes = new Uint8Array(size);
        let offset = 0;
        for (const chunk of chunks) {
          bytes.set(chunk, offset);
          offset += chunk.length;
        }
        try {
          return JSON.parse(new TextDecoder().decode(bytes));
        } catch {
          fail("malformed");
        }
      })(),
      new Promise((_, reject) => {
        timer = setTimeout(() => {
          reject(new ImportError("timeout"));
          controller.abort();
        }, limits.timeout);
      }),
    ]);
  } catch (e) {
    throw e instanceof ImportError ? e : new ImportError("network");
  } finally {
    clearTimeout(timer);
  }
}
function candidate(
  v: any,
  game: string,
  start: number,
  end: number,
): Omit<Candidate, "review_state"> {
  try {
    if (!object(v)) fail("invalid_clip");
    const link = twitch(v.url);
    if (
      link.id !== v.id ||
      v.game_id !== game ||
      typeof v.created_at !== "string" ||
      !/^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d(?:\.\d{1,3})?Z$/.test(v.created_at)
    )
      fail("invalid_clip");
    const created = Date.parse(v.created_at);
    if (
      !Number.isFinite(created) ||
      created < start ||
      created > end ||
      !Number.isSafeInteger(v.view_count) ||
      v.view_count < 0 ||
      typeof v.duration !== "number" ||
      !Number.isFinite(v.duration) ||
      v.duration <= 0 ||
      v.duration > 3600 ||
      typeof v.language !== "string" ||
      !(
        v.language === "other" ||
        /^[a-z]{2,3}(?:-[a-zA-Z]{2,4})?$/.test(v.language)
      )
    )
      fail("invalid_clip");
    // Reject normalized impossible calendar dates as well as out-of-window instants.
    if (
      new Date(created).toISOString().slice(0, 19) !== v.created_at.slice(0, 19)
    )
      fail("invalid_clip");
    let image: string | undefined;
    try {
      image = thumbnail(v.thumbnail_url);
    } catch {
      image = undefined;
    }
    return {
      ...link,
      thumbnail: image,
      streamer: str(v.broadcaster_name, 80),
      title: str(v.title, 120),
      language: v.language,
      game_id: game,
      created_at: new Date(created).toISOString(),
      duration: v.duration,
      views: v.view_count,
      observed_at: new Date().toISOString(),
    };
  } catch {
    return fail("invalid_clip");
  }
}
const owned =
  "EXISTS (SELECT 1 FROM import_lease WHERE name='twitch' AND owner=? AND expires_at>?)";
export async function importTwitch(
  env: Env,
  trigger: ImportRun["trigger"],
): Promise<ImportRun> {
  const now = Date.now();
  const run: ImportRun = {
    id: crypto.randomUUID(),
    trigger,
    status: "running",
    started_at: new Date(now).toISOString(),
    finished_at: null,
    window_start: new Date(now - 86400000).toISOString(),
    window_end: new Date(now).toISOString(),
    requests: 0,
    pages: 0,
    found: 0,
    saved: 0,
    game_id: null,
    game_name: null,
    error_code: null,
  };
  const insertRun = (
    status: ImportRun["status"],
    error: ErrorCode | null = null,
  ) =>
    env.DB.prepare(
      "INSERT INTO import_runs(id,trigger,status,started_at,finished_at,window_start,window_end,error_code) VALUES(?,?,?,?,?,?,?,?)",
    ).bind(
      run.id,
      trigger,
      status,
      run.started_at,
      status === "running" ? null : new Date().toISOString(),
      run.window_start,
      run.window_end,
      error,
    );
  const acquired = await env.DB.prepare(
    "INSERT INTO import_lease(name,owner,expires_at) VALUES('twitch',?,?) ON CONFLICT(name) DO UPDATE SET owner=excluded.owner,expires_at=excluded.expires_at WHERE import_lease.expires_at<=? RETURNING owner",
  )
    .bind(run.id, now + limits.lease, now)
    .first();
  if (!acquired) {
    run.status = "skipped";
    run.error_code = "overlap";
    run.finished_at = new Date().toISOString();
    await insertRun("skipped", "overlap").run();
    return run;
  }
  const checkpoint = (progress: ImportRun = run) =>
    env.DB.prepare(
      `UPDATE import_runs SET status=?,finished_at=?,requests=?,pages=?,found=?,saved=?,game_id=?,game_name=?,error_code=? WHERE id=? AND ${owned}`,
    ).bind(
      progress.status,
      progress.finished_at,
      progress.requests,
      progress.pages,
      progress.found,
      progress.saved,
      progress.game_id,
      progress.game_name,
      progress.error_code,
      run.id,
      run.id,
      Date.now(),
    );
  try {
    await env.DB.batch([
      env.DB.prepare(
        `UPDATE import_runs SET status=CASE WHEN pages>0 THEN 'partial' ELSE 'error' END, finished_at=?,error_code='lease_expired' WHERE status='running' AND id<>? AND ${owned}`,
      ).bind(new Date().toISOString(), run.id, run.id, Date.now()),
      insertRun("running"),
    ]);
    if (!env.TWITCH_CLIENT_ID || !env.TWITCH_CLIENT_SECRET)
      fail("missing_config");
    if (
      !/^[a-zA-Z0-9_-]{1,128}$/.test(env.TWITCH_CLIENT_ID) ||
      env.TWITCH_CLIENT_SECRET.length > 1024 ||
      (env.TWITCH_GAME_ID && !/^\d{1,30}$/.test(env.TWITCH_GAME_ID))
    )
      fail("invalid_config");
    const call = async (url: URL, init: RequestInit) => {
      run.requests++;
      return upstream(url, init);
    };
    const token = await call(new URL("https://id.twitch.tv/oauth2/token"), {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        client_id: env.TWITCH_CLIENT_ID,
        client_secret: env.TWITCH_CLIENT_SECRET,
        grant_type: "client_credentials",
      }).toString(),
    });
    if (
      !object(token) ||
      typeof token.access_token !== "string" ||
      !/^[a-zA-Z0-9_-]{1,2048}$/.test(token.access_token) ||
      typeof token.token_type !== "string" ||
      token.token_type.toLowerCase() !== "bearer" ||
      !Number.isSafeInteger(token.expires_in) ||
      token.expires_in <= 0
    )
      fail("malformed");
    const headers = {
      Authorization: `Bearer ${token.access_token}`,
      "Client-Id": env.TWITCH_CLIENT_ID,
    };
    const gamesURL = new URL("https://api.twitch.tv/helix/games");
    gamesURL.searchParams.set(
      env.TWITCH_GAME_ID ? "id" : "name",
      env.TWITCH_GAME_ID || GAME_NAME,
    );
    const games = await call(gamesURL, { headers });
    if (!object(games) || !Array.isArray(games.data)) fail("malformed");
    if (!games.data.length) fail("game_absent");
    if (
      games.data.length !== 1 ||
      !object(games.data[0]) ||
      games.data[0].name !== GAME_NAME ||
      !/^\d{1,30}$/.test(games.data[0].id) ||
      typeof games.data[0].id !== "string" ||
      (env.TWITCH_GAME_ID && games.data[0].id !== env.TWITCH_GAME_ID)
    )
      fail("game_mismatch");
    run.game_id = games.data[0].id;
    run.game_name = GAME_NAME;
    const cursors = new Set<string>(),
      ids = new Set<string>();
    let cursor = "";
    for (let page = 0; page < limits.pages; page++) {
      const clipsURL = new URL("https://api.twitch.tv/helix/clips");
      for (const [key, value] of Object.entries({
        game_id: run.game_id!,
        started_at: run.window_start,
        ended_at: run.window_end,
        first: String(limits.pageSize),
        ...(cursor ? { after: cursor } : {}),
      }))
        clipsURL.searchParams.set(key, value);
      const result = await call(clipsURL, { headers });
      if (
        !object(result) ||
        !Array.isArray(result.data) ||
        result.data.length > limits.pageSize ||
        !object(result.pagination)
      )
        fail("malformed");
      const next = result.pagination.cursor;
      if (
        next !== undefined &&
        (typeof next !== "string" ||
          !next.length ||
          next.length > 512 ||
          /[\u0000-\u0020]/.test(next))
      )
        fail("malformed");
      run.found += result.data.length;
      const clips: Omit<Candidate, "review_state">[] = result.data.map(
        (v: unknown) => candidate(v, run.game_id!, now - 86400000, now),
      );
      // A manually captured source already has a canonical private review record.
      // Do not create another candidate or revive a discarded manual source.
      // pageSize is fixed at 100: this query stays within D1's 100 bindings.
      const manual = clips.length
        ? await env.DB.prepare(
            `SELECT source_id FROM manual_candidates WHERE provider='twitch' AND source_id IN (${clips.map(() => "?").join(",")})`,
          )
            .bind(...clips.map((c) => c.id))
            .all<{ source_id: string }>()
        : { results: [] };
      const manualIds = new Set(manual.results.map((c) => c.source_id));
      const importedClips = clips.filter((c) => !manualIds.has(c.id));
      const nextIds = new Set(ids);
      for (const c of importedClips) nextIds.add(c.id);
      const progress = { ...run, pages: run.pages + 1, saved: nextIds.size };
      const writes = importedClips.map((c) =>
        env.DB.prepare(
          `INSERT INTO candidates(id,url,streamer,title,language,game_id,created_at,duration,views,observed_at,thumbnail) SELECT ?,?,?,?,?,?,?,?,?,?,? WHERE ${owned} ON CONFLICT(id) DO UPDATE SET url=excluded.url,streamer=excluded.streamer,title=excluded.title,language=excluded.language,game_id=excluded.game_id,created_at=excluded.created_at,duration=excluded.duration,views=excluded.views,observed_at=excluded.observed_at,thumbnail=COALESCE(excluded.thumbnail,candidates.thumbnail)`,
        ).bind(
          c.id,
          c.url,
          c.streamer,
          c.title,
          c.language,
          c.game_id,
          c.created_at,
          c.duration,
          c.views,
          c.observed_at,
          c.thumbnail || null,
          run.id,
          Date.now(),
        ),
      );
      const written = await env.DB.batch([...writes, checkpoint(progress)]);
      if (!written.at(-1)?.meta.changes) fail("lease_expired");
      // Only committed, ownership-fenced pages contribute to saved totals.
      run.pages = progress.pages;
      run.saved = progress.saved;
      for (const c of importedClips) ids.add(c.id);
      if (!next) break;
      if (cursors.has(next)) fail("repeated_cursor");
      cursors.add(next);
      cursor = next;
      if (page === limits.pages - 1) fail("page_limit");
    }
    run.status = run.saved ? "success" : "empty";
  } catch (e) {
    run.error_code = e instanceof ImportError ? e.code : "storage";
    run.status = run.pages
      ? "partial"
      : run.error_code === "missing_config"
        ? "skipped"
        : "error";
  }
  run.finished_at = new Date().toISOString();
  // Candidate writes, progress, completion and release are all ownership fenced.
  const finish = await env.DB.batch([
    checkpoint(),
    env.DB.prepare(
      "DELETE FROM import_lease WHERE name='twitch' AND owner=?",
    ).bind(run.id),
  ]);
  if (!finish[0].meta.changes) {
    // A successor owns recovery of the old record; never overwrite its run or lease.
    run.status = run.saved ? "partial" : "error";
    run.error_code = "lease_expired";
  }
  return run;
}
