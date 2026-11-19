import { source } from "./source";
export const categories = [
  "Fails",
  "Jugadas",
  "Detalles",
  "Reacciones",
] as const;
export interface Clip {
  provider?: "twitch" | "youtube" | "x";
  sourceId?: string;
  orientation?: "auto" | "landscape" | "portrait";
  thumbnail?: string;
  duration?: number;
  id: string;
  url: string;
  streamer: string;
  title: string;
  text: string;
  category: string;
}
export interface Edition {
  date: string;
  title: string;
  intro: string;
  hook: string;
  demo: boolean;
  reviewed: boolean;
  featured: string;
  clips: Clip[];
}
export function str(v: unknown, max: number): string {
  if (
    typeof v !== "string" ||
    !v.trim() ||
    v.length > max ||
    /[\u0000-\u0008]/.test(v)
  )
    throw Error("Texto vacío o demasiado largo");
  return v.trim();
}
export function twitch(v: unknown): { id: string; url: string } {
  const raw = str(v, 300);
  const u = new URL(raw);
  if (
    u.protocol !== "https:" ||
    u.username ||
    u.password ||
    u.port ||
    u.search ||
    u.hash
  )
    throw Error("URL de Twitch no válida");
  const match =
    u.hostname === "clips.twitch.tv"
      ? /^\/([A-Za-z0-9_-]{1,100})$/.exec(u.pathname)
      : u.hostname === "www.twitch.tv"
        ? /^\/[A-Za-z0-9_]{1,25}\/clip\/([A-Za-z0-9_-]{1,100})$/.exec(
            u.pathname,
          )
        : null;
  if (!match) throw Error("Usa un enlace directo HTTPS a un clip de Twitch");
  return { id: match[1], url: `https://clips.twitch.tv/${match[1]}` };
}
export function thumbnail(value: unknown): string | undefined {
  if (value === undefined || value === null || value === "") return undefined;
  const u = new URL(str(value, 1500));
  if (
    u.protocol !== "https:" ||
    u.username ||
    u.password ||
    u.port ||
    u.hash ||
    u.search ||
    ![
      "static-cdn.jtvnw.net",
      "clips-media-assets2.twitch.tv",
      "clips-media-assets.twitch.tv",
      "i.ytimg.com",
      "pbs.twimg.com",
    ].includes(u.hostname) ||
    !/\.(?:jpg|jpeg|png|webp)$/i.test(u.pathname)
  )
    throw Error("Miniatura de Twitch no válida");
  return u.href;
}
export function dateValid(v: unknown): v is string {
  return (
    typeof v === "string" &&
    /^20\d\d-\d\d-\d\d$/.test(v) &&
    !isNaN(Date.parse(v)) &&
    new Date(v).toISOString().slice(0, 10) === v
  );
}
export function validate(v: any, publish = false): Edition {
  if (
    !v ||
    !dateValid(v.date) ||
    !Array.isArray(v.clips) ||
    v.clips.length < 1 ||
    v.clips.length > 10 ||
    typeof v.demo !== "boolean" ||
    typeof v.reviewed !== "boolean"
  )
    throw Error("Fecha o selección no válida (1–10 clips)");
  const clips: Clip[] = v.clips.map((c: any) => {
    const link = source(c.url);
    if (
      c.orientation !== undefined &&
      !["auto", "landscape", "portrait"].includes(c.orientation)
    )
      throw Error("URL: orientación no válida");
    const image = thumbnail(c.thumbnail);
    if (
      c.duration !== undefined &&
      (typeof c.duration !== "number" ||
        !Number.isFinite(c.duration) ||
        c.duration <= 0 ||
        c.duration > 3600)
    )
      throw Error("Duración no válida");
    if (!categories.includes(c.category)) throw Error("Categoría no válida");
    return {
      ...link,
      ...(c.orientation ? { orientation: c.orientation } : {}),
      ...(image ? { thumbnail: image } : {}),
      ...(c.duration !== undefined ? { duration: c.duration } : {}),
      streamer: str(c.streamer, 80),
      title: str(c.title, 120),
      text: str(c.text, 400),
      category: c.category,
    };
  });
  if (
    new Set(clips.map((c) => c.id)).size !== clips.length ||
    !clips.some((c) => c.id === v.featured)
  )
    throw Error("Clips duplicados o destacado no válido");
  if (publish && !v.demo && !v.reviewed)
    throw Error(
      "Confirma la revisión de fuentes, contexto, spoilers y duplicados",
    );
  return {
    date: v.date,
    title: str(v.title, 100),
    intro: str(v.intro, 400),
    hook: str(v.hook, 160),
    demo: v.demo,
    reviewed: v.reviewed,
    featured: v.featured,
    clips,
  };
}
export const esc = (s: unknown) =>
  String(s).replace(
    /[&<>"']/g,
    (c) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
        c
      ]!,
  );
export function post(e: Edition, origin: string): string {
  return `${e.demo ? "[DEMOSTRACIÓN · fuentes no verificadas] " : ""}${e.hook}\n${e.clips.length} clips en GtaKlips. #gtavi\n${origin}/dia/${e.date}?utm_source=x&utm_medium=organic_social&utm_campaign=estreno_gtavi&utm_content=destacado#clip-${e.featured}`;
}
