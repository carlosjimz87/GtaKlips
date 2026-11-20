import { brandAssets } from "./brand-assets";

const decoded = new Map<string, Uint8Array<ArrayBuffer>>();

/** Serves /brand/<name> (logo, favicons, social image). Returns null if unknown. */
export function brandResponse(path: string): Response | null {
  const name = path.startsWith("/brand/") ? path.slice(7) : "";
  const asset = Object.hasOwn(brandAssets, name) ? brandAssets[name] : null;
  if (!asset) return null;
  let bytes = decoded.get(name);
  if (!bytes) {
    bytes = Uint8Array.from<string>(atob(asset.base64), (c) => c.charCodeAt(0));
    decoded.set(name, bytes);
  }
  return new Response(bytes, {
    headers: {
      "Content-Type": asset.type,
      "Cache-Control": "public, max-age=86400",
      "X-Content-Type-Options": "nosniff",
    },
  });
}

export const brandHead = (origin: string) =>
  `<link rel="icon" type="image/png" sizes="32x32" href="/brand/icon-32.png"><link rel="icon" type="image/png" sizes="192x192" href="/brand/icon-192.png"><link rel="apple-touch-icon" href="/brand/apple-touch-icon.png"><meta name="theme-color" content="#000000"><meta property="og:image" content="${origin}/brand/og.jpg"><meta property="og:image:width" content="1200"><meta property="og:image:height" content="630"><meta property="og:image:alt" content="GtaKlips: logotipo"><meta name="twitter:image" content="${origin}/brand/og.jpg">`;

export const brandMark =
  '<img class="brand-logo" src="/brand/logo-96.png" width="40" height="40" alt="" decoding="async">';
