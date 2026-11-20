// Development-only entry point. Production builds use index.ts, never this module.
import { enrichmentBridge } from "./enrichment";
import { bridge, type BridgeEnv } from "./telegram-bridge";
import { handle } from "./index";
import { loopback } from "./auth";
export default {
  fetch(request: Request, env: BridgeEnv) {
    const url = new URL(request.url);
    const enabled =
      env.LOCAL_DEVELOPMENT === "explicit-loopback-only" &&
      loopback(url.hostname) &&
      url.protocol === "http:" &&
      url.origin === env.PUBLIC_ORIGIN;
    if (url.pathname.startsWith("/internal/enrichment/")) {
      if (!enabled) return new Response("Not found", { status: 404 });
      return enrichmentBridge(request, env);
    }
    if (url.pathname.startsWith("/internal/telegram/")) {
      if (!enabled) return new Response("Not found", { status: 404 });
      return bridge(request, env);
    }
    return handle(request, env, enabled);
  },
};
