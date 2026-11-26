import { createRemoteJWKSet, jwtVerify } from "jose";
export interface Env {
  DB: D1Database;
  TWITCH_CLIENT_ID?: string;
  TWITCH_CLIENT_SECRET?: string;
  TWITCH_GAME_ID?: string;
  YOUTUBE_API_KEY?: string;
  PUBLIC_ORIGIN: string;
  ACCESS_ISSUER?: string;
  ACCESS_AUDIENCE?: string;
  LOCAL_DEVELOPMENT?: string;
  X_ACCESS_TOKEN?: string;
  X_PUBLISH_ENABLED?: string;
}
export const loopback = (host: string) =>
  ["127.0.0.1", "localhost", "[::1]"].includes(host);
const resolvers = new Map<string, ReturnType<typeof createRemoteJWKSet>>();
export async function authorized(request: Request, env: Env): Promise<boolean> {
  try {
    if (!env.ACCESS_ISSUER || !env.ACCESS_AUDIENCE) return false;
    const issuer = new URL(env.ACCESS_ISSUER);
    if (
      issuer.protocol !== "https:" ||
      !/^[a-z0-9-]+\.cloudflareaccess\.com$/.test(issuer.hostname) ||
      issuer.origin !== env.ACCESS_ISSUER
    )
      return false;
    let jwks = resolvers.get(issuer.origin);
    if (!jwks) {
      jwks = createRemoteJWKSet(new URL("/cdn-cgi/access/certs", issuer));
      resolvers.set(issuer.origin, jwks);
    }
    await jwtVerify(
      request.headers.get("Cf-Access-Jwt-Assertion") || "",
      jwks,
      {
        issuer: issuer.origin,
        audience: env.ACCESS_AUDIENCE,
        algorithms: ["RS256"],
        requiredClaims: ["exp", "iat", "sub"],
      },
    );
    return true;
  } catch {
    return false;
  }
}
