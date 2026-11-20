// Self-contained so the editor and server execute exactly the same URL policy.
export function source(value: unknown): {
  id: string;
  provider: "twitch" | "youtube" | "x";
  sourceId: string;
  url: string;
} {
  if (typeof value !== "string" || value.length > 500 || /[\s\\]/.test(value))
    throw Error("URL de fuente no válida");
  const u = new URL(value);
  if (u.protocol !== "https:" || u.username || u.password || u.port || u.hash)
    throw Error("URL de fuente no válida");
  const xHosts = [
    "x.com",
    "www.x.com",
    "twitter.com",
    "www.twitter.com",
    "mobile.twitter.com",
    "m.twitter.com",
  ];
  const tracking = new Set([
    "si",
    "feature",
    "t",
    "s",
    "ref",
    "ref_src",
    "tt_content",
    "tt_medium",
    "utm_source",
    "utm_medium",
    "utm_campaign",
    "utm_content",
    "utm_term",
  ]);
  for (const key of u.searchParams.keys())
    if (
      !tracking.has(key) &&
      !(key === "a" && xHosts.includes(u.hostname)) &&
      // Twitch UI listing filters appended when a clip is opened from a list.
      !(
        ["range", "filter", "sort"].includes(key) &&
        ["clips.twitch.tv", "twitch.tv", "www.twitch.tv"].includes(u.hostname)
      ) &&
      !(
        key === "v" &&
        ["youtube.com", "www.youtube.com", "m.youtube.com"].includes(
          u.hostname,
        ) &&
        u.pathname === "/watch"
      )
    )
      throw Error("URL contiene parámetros no permitidos");
  let provider: "twitch" | "youtube" | "x", sourceId: string, url: string;
  let m: RegExpExecArray | null;
  if (
    u.hostname === "clips.twitch.tv" &&
    (m = /^\/([A-Za-z0-9_-]{1,100})\/?$/.exec(u.pathname))
  ) {
    provider = "twitch";
    sourceId = m[1];
    url = `https://clips.twitch.tv/${sourceId}`;
  } else if (
    ["twitch.tv", "www.twitch.tv"].includes(u.hostname) &&
    (m = /^\/[A-Za-z0-9_]{1,25}\/clip\/([A-Za-z0-9_-]{1,100})\/?$/.exec(
      u.pathname,
    ))
  ) {
    provider = "twitch";
    sourceId = m[1];
    url = `https://clips.twitch.tv/${sourceId}`;
  } else if (
    u.hostname === "youtu.be" &&
    (m = /^\/([A-Za-z0-9_-]{11})\/?$/.exec(u.pathname))
  ) {
    provider = "youtube";
    sourceId = m[1];
    url = `https://www.youtube.com/watch?v=${sourceId}`;
  } else if (
    ["youtube.com", "www.youtube.com", "m.youtube.com"].includes(u.hostname) &&
    ((m = /^\/shorts\/([A-Za-z0-9_-]{11})\/?$/.exec(u.pathname)) ||
      (u.pathname === "/watch" &&
        u.searchParams.getAll("v").length === 1 &&
        (m = /^([A-Za-z0-9_-]{11})$/.exec(u.searchParams.get("v") || ""))))
  ) {
    provider = "youtube";
    sourceId = m![1];
    url = `https://www.youtube.com/watch?v=${sourceId}`;
  } else if (
    xHosts.includes(u.hostname) &&
    (m =
      /^\/([A-Za-z0-9_]{1,15})\/status\/([1-9][0-9]{0,19})(?:\/(?:video|photo)\/[1-4])?\/?$/.exec(
        u.pathname,
      ))
  ) {
    provider = "x";
    sourceId = m[2];
    url = `https://x.com/${m[1]}/status/${sourceId}`;
  } else
    throw Error(
      "URL: usa un clip Twitch, vídeo YouTube o publicación X directa",
    );
  return {
    provider,
    sourceId,
    id: provider === "twitch" ? sourceId : `${provider}:${sourceId}`,
    url,
  };
}
export const providerName = (provider?: string) =>
  provider === "youtube" ? "YouTube" : provider === "x" ? "X" : "Twitch";
