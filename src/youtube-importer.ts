import type { Env } from "./auth";

/** Trend discovery from the YouTube Data API v3 (public data, API key only). */
export const ytLimits = {
  queries: ["GTA VI", "GTA 6"],
  windowHours: 48,
  perQuery: 50,
  minViews: 5000,
  minSeconds: 10,
  maxSeconds: 1200,
  top: 25,
  timeout: 8000,
};
export interface YtVideo {
  id: string;
  title: string;
  channel: string;
  publishedAt: string;
  views: number;
  seconds: number;
  live: boolean;
}
export interface YtRanked extends YtVideo {
  perHour: number;
}
export function seconds(iso: string): number {
  const m = /^P(?:(\d+)D)?T?(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?$/.exec(iso);
  if (!m) return 0;
  const [d, h, mi, s] = m.slice(1).map((x) => Number(x || 0));
  return d * 86400 + h * 3600 + mi * 60 + s;
}
/** Keeps real, short-to-medium, non-live videos and ranks them by views per hour. */
export function rank(videos: YtVideo[], now: number): YtRanked[] {
  const seen = new Set<string>();
  return videos
    .filter((v) => {
      if (seen.has(v.id)) return false;
      seen.add(v.id);
      return (
        /^[A-Za-z0-9_-]{11}$/.test(v.id) &&
        !v.live &&
        v.views >= ytLimits.minViews &&
        v.seconds >= ytLimits.minSeconds &&
        v.seconds <= ytLimits.maxSeconds &&
        Number.isFinite(Date.parse(v.publishedAt))
      );
    })
    .map((v) => ({
      ...v,
      perHour:
        v.views / Math.max((now - Date.parse(v.publishedAt)) / 3600000, 0.5),
    }))
    .sort((a, b) => b.perHour - a.perHour)
    .slice(0, ytLimits.top);
}
async function api(path: string, params: Record<string, string>, key: string) {
  const url = new URL("https://www.googleapis.com/youtube/v3/" + path);
  for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v);
  url.searchParams.set("key", key);
  const r = await fetch(url, {
    redirect: "manual",
    signal: AbortSignal.timeout(ytLimits.timeout),
  });
  if (!r.ok) {
    void r.body?.cancel();
    throw Error(
      r.status === 403 || r.status === 400
        ? "unauthorized"
        : r.status === 429
          ? "rate_limit"
          : "upstream",
    );
  }
  return (await r.json()) as any;
}
export async function importYouTube(env: Env, trigger: "manual" | "cron") {
  const run = {
    id: crypto.randomUUID(),
    started: new Date().toISOString(),
    found: 0,
    saved: 0,
    requests: 0,
  };
  let error: string | null = null;
  // Without a key YouTube discovery is simply off: no network, no run record.
  if (!env.YOUTUBE_API_KEY)
    return { ...run, status: "skipped" as const, error: "missing_config" };
  const now = Date.now();
  const after = new Date(now - ytLimits.windowHours * 3600000).toISOString();
  try {
    const ids = new Set<string>();
    for (const q of ytLimits.queries) {
      run.requests++;
      const r = await api(
        "search",
        {
          part: "id",
          q,
          type: "video",
          order: "viewCount",
          publishedAfter: after,
          maxResults: String(ytLimits.perQuery),
        },
        env.YOUTUBE_API_KEY,
      );
      for (const i of r.items ?? [])
        if (typeof i?.id?.videoId === "string") ids.add(i.id.videoId);
    }
    run.found = ids.size;
    const list = [...ids];
    const videos: YtVideo[] = [];
    for (let i = 0; i < list.length; i += 50) {
      run.requests++;
      const r = await api(
        "videos",
        {
          part: "snippet,statistics,contentDetails",
          id: list.slice(i, i + 50).join(","),
        },
        env.YOUTUBE_API_KEY,
      );
      for (const v of r.items ?? [])
        videos.push({
          id: String(v.id),
          title: String(v.snippet?.title ?? ""),
          channel: String(v.snippet?.channelTitle ?? ""),
          publishedAt: String(v.snippet?.publishedAt ?? ""),
          views: Number(v.statistics?.viewCount ?? 0),
          seconds: seconds(String(v.contentDetails?.duration ?? "")),
          live: (v.snippet?.liveBroadcastContent ?? "none") !== "none",
        });
    }
    const date = new Intl.DateTimeFormat("en-CA", {
      timeZone: "Europe/Madrid",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }).format(new Date());
    const fields = JSON.stringify({
      title: "YouTube API",
      streamer: "YouTube API",
    });
    const writes: D1PreparedStatement[] = [];
    for (const v of rank(videos, now)) {
      const id = `youtube:${v.id}`;
      const title =
        Array.from(v.title.trim()).slice(0, 120).join("") || v.channel;
      const channel = Array.from(v.channel.trim()).slice(0, 80).join("");
      if (!title || !channel) continue;
      writes.push(
        env.DB.prepare(
          `INSERT INTO manual_candidates(id,provider,source_id,url,captured_date,created_at,title,streamer,thumbnail,state,automatic,category,field_sources,capture_origin) VALUES(?,'youtube',?,?,?,?,?,?,NULL,'pending',1,'',?,'discovery') ON CONFLICT DO NOTHING`,
        ).bind(
          id,
          v.id,
          `https://www.youtube.com/watch?v=${v.id}`,
          date,
          new Date(v.publishedAt).toISOString(),
          title,
          channel,
          fields,
        ),
        env.DB.prepare(
          `INSERT INTO enrichment_jobs(candidate,updated_at) SELECT id,? FROM manual_candidates WHERE id=? AND state!='discarded' ON CONFLICT(candidate) DO NOTHING`,
        ).bind(Date.now(), id),
      );
      run.saved++;
    }
    if (writes.length) await env.DB.batch(writes);
  } catch (e) {
    error = e instanceof Error ? e.message : "upstream";
  }
  const status = error ? "error" : run.saved ? "success" : "empty";
  await env.DB.prepare(
    "INSERT INTO import_runs(id,trigger,status,started_at,finished_at,window_start,window_end,requests,pages,found,saved,game_id,game_name,error_code) VALUES(?,?,?,?,?,?,?,?,?,?,?,NULL,'YouTube',?)",
  )
    .bind(
      run.id,
      trigger,
      status,
      run.started,
      new Date().toISOString(),
      after,
      new Date(now).toISOString(),
      run.requests,
      run.requests ? 1 : 0,
      run.found,
      run.saved,
      error,
    )
    .run();
  return { ...run, status, error };
}
