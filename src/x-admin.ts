import type { Env } from "./auth";
import { dateValid, type Edition } from "./model";
import {
  creatorHuntDraft,
  publish,
  topDraft,
  type XDraft,
  type XKind,
} from "./x-social";

/** Drafts for a date: top (published featured clip) + creator hunts (pending candidates with no creator). */
export async function xDrafts(env: Env, date: string, origin: string) {
  if (!dateValid(date)) throw Error("Fecha no válida");
  const drafts: XDraft[] = [];
  const row = await env.DB.prepare(
    "SELECT published FROM editions WHERE date=?",
  )
    .bind(date)
    .first<{ published: string | null }>();
  if (row?.published) {
    const e: Edition = JSON.parse(row.published);
    const clip = e.clips.find((c) => c.id === e.featured) || e.clips[0];
    if (clip) drafts.push(topDraft(e, clip, origin));
  }
  const hunts = await env.DB.prepare(
    "SELECT id,url,title FROM manual_candidates WHERE captured_date=? AND state!='discarded' AND TRIM(streamer)='' ORDER BY created_at LIMIT 10",
  )
    .bind(date)
    .all<{ id: string; url: string; title: string }>();
  for (const c of hunts.results) drafts.push(creatorHuntDraft(c, origin));
  const sent = await env.DB.prepare("SELECT kind,ref,state FROM x_posts").all<{
    kind: string;
    ref: string;
    state: string;
  }>();
  const done = new Map(
    sent.results.map((r) => [`${r.kind}|${r.ref}`, r.state]),
  );
  return {
    publishEnabled: env.X_PUBLISH_ENABLED === "true" && !!env.X_ACCESS_TOKEN,
    drafts: drafts.map((d) => ({
      ...d,
      state: done.get(`${d.kind}|${d.ref}`) || "draft",
    })),
  };
}

/** Publishes one draft. Requires confirm:true; the stored draft is recomputed server-side. */
export async function xPublish(
  env: Env,
  v: { date?: string; kind?: XKind; ref?: string; confirm?: boolean },
  origin: string,
) {
  if (v.confirm !== true) throw Error("Falta confirmación explícita");
  const { drafts } = await xDrafts(env, String(v.date), origin);
  const draft = drafts.find((d) => d.kind === v.kind && d.ref === v.ref);
  if (!draft) throw Error("Borrador no encontrado");
  if (draft.state !== "draft" && draft.state !== "failed")
    throw Error("Ya publicado o en curso");
  if (env.X_PUBLISH_ENABLED !== "true" || !env.X_ACCESS_TOKEN)
    return publish(env, draft); // dry-run: nothing is recorded or sent
  // Claim first so a double click cannot post twice (failed rows may be retried).
  const claim = await env.DB.prepare(
    "INSERT INTO x_posts(kind,ref,text,reply_text,state,created_at) VALUES(?,?,?,?,'publishing',?) ON CONFLICT(kind,ref) DO UPDATE SET state='publishing',error=NULL WHERE x_posts.state='failed'",
  )
    .bind(
      draft.kind,
      draft.ref,
      draft.text,
      draft.replyText,
      new Date().toISOString(),
    )
    .run();
  if (!claim.meta.changes) throw Error("Ya publicado o en curso");
  try {
    const result = await publish(env, draft);
    if (result.mode === "published")
      await env.DB.prepare(
        "UPDATE x_posts SET state='published',tweet_id=? WHERE kind=? AND ref=?",
      )
        .bind(result.tweetId, draft.kind, draft.ref)
        .run();
    return result;
  } catch (error) {
    await env.DB.prepare(
      "UPDATE x_posts SET state='failed',error=? WHERE kind=? AND ref=?",
    )
      .bind(
        String((error as Error).message).slice(0, 200),
        draft.kind,
        draft.ref,
      )
      .run();
    throw error;
  }
}
