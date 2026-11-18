// Development-only entry point. Production builds use index.ts, never this module.
import { handle } from "./index";
import { loopback, type Env } from "./auth";
export default {
  fetch(request: Request, env: Env) {
    const url = new URL(request.url);
    const enabled =
      env.LOCAL_DEVELOPMENT === "explicit-loopback-only" &&
      loopback(url.hostname) &&
      url.protocol === "http:" &&
      url.origin === env.PUBLIC_ORIGIN;
    return handle(request, env, enabled);
  },
};
