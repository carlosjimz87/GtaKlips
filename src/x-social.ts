import type { Clip, Edition } from "./model";

/** Weighted X length: every URL counts as 23 chars (t.co), the rest 1 each. */
export const X_LIMIT = 280;
export function weightedLength(text: string): number {
  return text.replace(/https?:\/\/\S+/g, "x".repeat(23)).length;
}

export type XKind = "top" | "creator_hunt";
export interface XDraft {
  kind: XKind;
  ref: string;
  text: string;
  /** Posted as a self-reply: keeps the site link out of the main post (better reach). */
  replyText: string;
}

const utm = (content: string, campaign: string) =>
  `utm_source=x&utm_medium=organic_social&utm_campaign=${campaign}&utm_content=${content}`;

function fit(lines: string[], budget = X_LIMIT): string {
  let text = lines.join("\n");
  // Drop optional trailing lines first, then trim the first line.
  while (weightedLength(text) > budget && lines.length > 1) {
    lines = lines.slice(0, -1);
    text = lines.join("\n");
  }
  if (weightedLength(text) > budget)
    text = text.slice(0, budget - 1).trimEnd() + "…";
  return text;
}

const handle = (s: string) => (/^[A-Za-z0-9_]{1,15}$/.test(s) ? `@${s}` : s);

/** Top clip: credits the creator, shows the source (card/embed), site link in reply. */
export function topDraft(e: Edition, clip: Clip, origin: string): XDraft {
  const lines = [
    `🔥 ${clip.title}`,
    `🎥 ${handle(clip.streamer)}`,
    clip.text,
    `▶ ${clip.url}`,
    "#GTAVI",
  ].filter(Boolean);
  return {
    kind: "top",
    ref: `${e.date}:${clip.id}`,
    text: fit(lines),
    replyText: `Más momentos del día en GtaKlips 👇\n${origin}/dia/${e.date}?${utm("top", "x_top")}#clip-${clip.id}`,
  };
}

/** Clip without a known creator: asks readers to reply with the creator. */
export function creatorHuntDraft(
  c: { id: string; url: string; title?: string },
  origin: string,
): XDraft {
  const lines = [
    "🕵️ ¿Quién es el creador de este clip?",
    "Responde con su @usuario o el enlace de su canal y lo acreditamos en GtaKlips.",
    `▶ ${c.url}`,
    "#GTAVI",
  ];
  return {
    kind: "creator_hunt",
    ref: c.id,
    text: fit(lines),
    replyText: `Cada crédito mejora el archivo: ${origin}/archivo?${utm("quien_es", "x_creator_hunt")}`,
  };
}

/** Extracts creator hints from a reply: @handles and twitch/youtube channel URLs. */
export function parseCreatorReply(text: string): string[] {
  const out = new Set<string>();
  for (const m of text.matchAll(
    /https?:\/\/(?:www\.)?(?:twitch\.tv\/|youtube\.com\/(?:@|c\/|channel\/)|x\.com\/|twitter\.com\/)([A-Za-z0-9_-]{2,40})/gi,
  ))
    out.add(m[1].toLowerCase());
  for (const m of text.matchAll(/(?<![\w/])@([A-Za-z0-9_]{1,15})\b/g))
    out.add(m[1].toLowerCase());
  for (const bad of ["gtaklips", "twitch", "youtube", "x", "i"])
    out.delete(bad);
  return [...out];
}

export interface XConfig {
  X_ACCESS_TOKEN?: string;
  X_PUBLISH_ENABLED?: string;
}
export type XResult =
  | { mode: "dry-run"; reason: string; draft: XDraft }
  | { mode: "published"; tweetId: string; replyId?: string };

/** Publishing is off unless X_PUBLISH_ENABLED=true AND a user-context token exists. */
export async function publish(
  cfg: XConfig,
  draft: XDraft,
  fetcher: typeof fetch = fetch,
): Promise<XResult> {
  if (cfg.X_PUBLISH_ENABLED !== "true")
    return { mode: "dry-run", reason: "X_PUBLISH_ENABLED no es true", draft };
  if (!cfg.X_ACCESS_TOKEN)
    return { mode: "dry-run", reason: "Falta X_ACCESS_TOKEN", draft };
  const tweet = async (text: string, replyTo?: string) => {
    const res = await fetcher("https://api.x.com/2/tweets", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${cfg.X_ACCESS_TOKEN}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(
        replyTo ? { text, reply: { in_reply_to_tweet_id: replyTo } } : { text },
      ),
    });
    if (!res.ok) throw Error(`X API ${res.status}`);
    const j = (await res.json()) as { data?: { id?: string } };
    if (!j.data?.id) throw Error("Respuesta de X sin id");
    return j.data.id;
  };
  const tweetId = await tweet(draft.text);
  try {
    return {
      mode: "published",
      tweetId,
      replyId: await tweet(draft.replyText, tweetId),
    };
  } catch {
    return { mode: "published", tweetId };
  }
}
