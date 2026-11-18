import { authorized, type Env } from "./auth";
import {
  categories,
  dateValid,
  esc,
  post,
  validate,
  type Edition,
} from "./model";
import { css } from "./style";
import { adminScript, editor } from "./admin";
interface Row {
  date: string;
  revision: number;
  draft: string;
  published: string | null;
}
const json = (v: unknown, status = 200) =>
  new Response(JSON.stringify(v), {
    status,
    headers: { "Content-Type": "application/json" },
  });
function origin(env: Env): string {
  const u = new URL(env.PUBLIC_ORIGIN);
  if (
    !["https:", "http:"].includes(u.protocol) ||
    u.username ||
    u.password ||
    u.pathname !== "/" ||
    u.search ||
    u.hash ||
    (u.protocol === "http:" &&
      !["localhost", "127.0.0.1", "[::1]"].includes(u.hostname))
  )
    throw Error("Origen público no configurado");
  return u.origin;
}
function page(
  title: string,
  content: string,
  canonical: string,
  description = "Una selección editorial de clips de GTA VI, con contexto en español y crédito a sus creadores.",
  privatePage = false,
): Response {
  return new Response(
    `<!doctype html><html lang="es"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>${esc(title)} · GtaKlips</title><meta name="description" content="${esc(description)}"><meta name="robots" content="${privatePage ? "noindex, nofollow" : "index, follow"}"><link rel="canonical" href="${esc(canonical)}"><meta property="og:type" content="website"><meta property="og:locale" content="es_ES"><meta property="og:site_name" content="GtaKlips"><meta property="og:title" content="${esc(title)}"><meta property="og:description" content="${esc(description)}"><meta property="og:url" content="${esc(canonical)}"><meta name="twitter:card" content="summary"><link rel="stylesheet" href="/style.css"></head><body><header><a href="/" class="brand">Gta<span>Klips</span><span aria-hidden="true"> ↗</span></a><nav aria-label="Principal"><a href="/">La selección</a><a href="/archivo">Archivo</a></nav></header><main>${content}</main><footer>GtaKlips · Curación independiente en español. Sin afiliación con Rockstar Games ni Twitch.<br>Los clips se abren en Twitch; aquí no alojamos vídeos ni usamos seguimiento publicitario.</footer></body></html>`,
    { headers: { "Content-Type": "text/html; charset=utf-8" } },
  );
}
function editionView(e: Edition, category: string | null): string {
  const filtered = e.clips.filter((c) => !category || c.category === category);
  return `<section class="hero"><p class="eyebrow">La selección / <time>${esc(e.date)}</time></p><h1>${esc(e.title)}</h1><p class="lead">${esc(e.intro)}</p><p class="meta">${e.clips.length} clips · Contexto en español · Crédito a cada creador</p>${e.demo ? '<aside class="notice">DEMOSTRACIÓN · Datos de prueba. Estos clips no son metraje real verificado ni una selección editorial aprobada.</aside>' : ""}</section><nav class="filters" aria-label="Categorías">${["Todos", ...categories].map((c) => `<a href="/dia/${e.date}${c === "Todos" ? "" : "?categoria=" + encodeURIComponent(c)}" ${(!category && c === "Todos") || category === c ? 'aria-current="page"' : ""}>${c}</a>`).join("")}</nav><div class="grid">${filtered.map((c) => `<article class="clip ${c.id === e.featured ? "featured" : ""}" id="clip-${esc(c.id)}"><p class="eyebrow">${esc(c.category)}${c.id === e.featured ? " · El destacado" : ""}</p><span class="rank">${String(e.clips.indexOf(c) + 1).padStart(2, "0")}</span><h2>${esc(c.title)}</h2><p>${esc(c.text)}</p><p class="meta">Por <strong>${esc(c.streamer)}</strong> · Fuente: Twitch</p><a class="source" href="${esc(c.url)}" target="_blank" rel="noopener noreferrer">Ver en Twitch ↗<span class="meta"> · ${esc(c.streamer)}</span></a></article>`).join("")}</div>${!filtered.length ? '<p class="notice">No hay clips disponibles en esta selección. Consulta el archivo para descubrir otra edición.</p>' : ""}`;
}
async function body(request: Request): Promise<any> {
  if (!request.headers.get("Content-Type")?.startsWith("application/json"))
    throw Error("Se requiere JSON");
  const reader = request.body?.getReader();
  if (!reader) throw Error("Falta contenido");
  let size = 0;
  const chunks: Uint8Array[] = [];
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    size += value.length;
    if (size > 24000) {
      await reader.cancel();
      throw Error("Contenido demasiado grande");
    }
    chunks.push(value);
  }
  const out = new Uint8Array(size);
  let offset = 0;
  for (const c of chunks) {
    out.set(c, offset);
    offset += c.length;
  }
  return JSON.parse(new TextDecoder().decode(out));
}
async function route(
  request: Request,
  env: Env,
  localAuthorized: boolean,
): Promise<Response> {
  const url = new URL(request.url),
    path = url.pathname,
    base = origin(env);
  if (path === "/admin" || path.startsWith("/admin/")) {
    if (!localAuthorized && !(await authorized(request, env)))
      return json({ error: "Acceso no autorizado" }, 401);
    if (request.method === "POST") {
      if (
        request.headers.get("Origin") !== base ||
        url.origin !== base ||
        request.headers.get("Sec-Fetch-Site") === "cross-site"
      )
        return json({ error: "Origen no permitido" }, 403);
      const v = await body(request);
      if (!Number.isSafeInteger(v.revision) || v.revision < 0)
        throw Error("Revisión no válida");
      if (path === "/admin/save" || path === "/admin/publish") {
        const e = validate(v.edition, path.endsWith("publish")),
          serialized = JSON.stringify(e);
        let statement: D1PreparedStatement;
        if (v.revision === 0) {
          statement = env.DB.prepare(
            "INSERT INTO editions(date,draft,published,published_at) VALUES(?,?,?,?) ON CONFLICT(date) DO NOTHING RETURNING revision",
          ).bind(
            e.date,
            serialized,
            path.endsWith("publish") ? serialized : null,
            path.endsWith("publish") ? new Date().toISOString() : null,
          );
        } else {
          statement = env.DB.prepare(
            path.endsWith("publish")
              ? "UPDATE editions SET draft=?, published=?, published_at=?, revision=revision+1 WHERE date=? AND revision=? RETURNING revision"
              : "UPDATE editions SET draft=?, revision=revision+1 WHERE date=? AND revision=? RETURNING revision",
          ).bind(
            ...(path.endsWith("publish")
              ? [
                  serialized,
                  serialized,
                  new Date().toISOString(),
                  e.date,
                  v.revision,
                ]
              : [serialized, e.date, v.revision]),
          );
        }
        // A complete ordered snapshot is committed in one D1 transaction.
        const [write] = await env.DB.batch<{ revision: number }>([statement]);
        const result = write.results[0];
        return result
          ? json(result)
          : json(
              {
                error:
                  "Otra sesión cambió esta edición. Recarga antes de guardar.",
              },
              409,
            );
      }
      if (path === "/admin/withdraw") {
        if (!dateValid(v.date) || typeof v.id !== "string")
          throw Error("Retirada no válida");
        const row = await env.DB.prepare("SELECT * FROM editions WHERE date=?")
          .bind(v.date)
          .first<Row>();
        if (!row?.published)
          return json({ error: "Edición no publicada" }, 404);
        const e: Edition = JSON.parse(row.published);
        if (!e.clips.some((c) => c.id === v.id))
          throw Error("Clip no encontrado");
        e.clips = e.clips.filter((c) => c.id !== v.id);
        if (e.featured === v.id) e.featured = e.clips[0]?.id || "";
        const draft: Edition = JSON.parse(row.draft);
        draft.clips = draft.clips.filter((c) => c.id !== v.id);
        if (draft.featured === v.id) draft.featured = draft.clips[0]?.id || "";
        const result = await env.DB.prepare(
          "UPDATE editions SET published=?,draft=?,revision=revision+1 WHERE date=? AND revision=?",
        )
          .bind(JSON.stringify(e), JSON.stringify(draft), v.date, v.revision)
          .run();
        return result.meta.changes
          ? json({ revision: v.revision + 1 })
          : json({ error: "Conflicto de revisión. Recarga." }, 409);
      }
      return json({ error: "Acción desconocida" }, 404);
    }
    if (request.method !== "GET")
      return json({ error: "Método no permitido" }, 405);
    if (path === "/admin/editor.js")
      return new Response(adminScript, {
        headers: { "Content-Type": "text/javascript; charset=utf-8" },
      });
    if (path === "/admin/data" || path === "/admin/post") {
      const row = await env.DB.prepare("SELECT * FROM editions WHERE date=?")
        .bind(url.searchParams.get("date"))
        .first<Row>();
      if (!row) return json({ error: "Edición no encontrada" }, 404);
      if (path.endsWith("data"))
        return json({
          edition: JSON.parse(row.draft),
          revision: row.revision,
          published: !!row.published,
        });
      if (!row.published)
        return json({ error: "Publica antes de generar el post" }, 409);
      const e: Edition = JSON.parse(row.published);
      if (!e.clips.length)
        return json(
          { error: "No quedan clips: no se puede generar un post" },
          409,
        );
      return json({
        post: post(e, base),
        url: post(e, base).split("\n").at(-1),
      });
    }
    if (path === "/admin/editions") {
      const rows = await env.DB.prepare(
        "SELECT date,published IS NOT NULL AS public FROM editions ORDER BY date DESC",
      ).all<{ date: string; public: number }>();
      return page(
        "Ediciones guardadas",
        `<h1>Tu mesa de edición.</h1><a href="/admin">Nueva edición</a><ul class="archive">${rows.results.map((r) => `<li><a href="/admin?date=${r.date}">${r.date}</a> · ${r.public ? "Publicada + borrador" : "Borrador privado"}</li>`).join("")}</ul>`,
        base + "/admin",
        undefined,
        true,
      );
    }
    if (path === "/admin")
      return page(
        "Editor",
        editor(
          new Intl.DateTimeFormat("en-CA", {
            timeZone: "Europe/Madrid",
            year: "numeric",
            month: "2-digit",
            day: "2-digit",
          }).format(new Date()),
        ),
        base + "/admin",
        undefined,
        true,
      );
    return json({ error: "No encontrado" }, 404);
  }
  if (request.method !== "GET" && request.method !== "HEAD")
    return json({ error: "Método no permitido" }, 405);
  if (path === "/style.css")
    return new Response(css, {
      headers: { "Content-Type": "text/css; charset=utf-8" },
    });
  if (path === "/robots.txt")
    return new Response(
      `User-agent: *\nDisallow: /admin\nSitemap: ${base}/sitemap.xml`,
    );
  if (path === "/sitemap.xml" || path === "/archivo") {
    const rows = await env.DB.prepare(
      "SELECT date,published FROM editions WHERE published IS NOT NULL ORDER BY date DESC",
    ).all<Row>();
    if (path === "/sitemap.xml")
      return new Response(
        `<?xml version="1.0" encoding="UTF-8"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">${["/", "/archivo", ...rows.results.map((r) => "/dia/" + r.date)].map((p) => `<url><loc>${esc(base + p)}</loc></url>`).join("")}</urlset>`,
        { headers: { "Content-Type": "application/xml" } },
      );
    return page(
      "Archivo",
      `<section class="hero"><p class="eyebrow">Buenas historias, sin caducidad</p><h1>El archivo.</h1><p class="lead">Cada selección en su fecha. Vuelve a un momento que merecía la pena.</p></section><ul class="archive">${rows.results.map((r) => `<li><time class="meta">${r.date}</time><br><a href="/dia/${r.date}">${esc(JSON.parse(r.published!).title)}</a></li>`).join("")}</ul>${!rows.results.length ? "<p>La primera edición está en camino.</p>" : ""}`,
      base + path,
    );
  }
  if (path === "/" || /^\/dia\/20\d\d-\d\d-\d\d$/.test(path)) {
    const row =
      path === "/"
        ? await env.DB.prepare(
            "SELECT published FROM editions WHERE published IS NOT NULL ORDER BY date DESC LIMIT 1",
          ).first<Row>()
        : await env.DB.prepare(
            "SELECT published FROM editions WHERE date=? AND published IS NOT NULL",
          )
            .bind(path.slice(5))
            .first<Row>();
    if (row?.published) {
      const e: Edition = JSON.parse(row.published);
      return page(
        e.title,
        editionView(e, url.searchParams.get("categoria")),
        base + "/dia/" + e.date,
        e.intro,
      );
    }
    if (path === "/")
      return page(
        "El próximo gran momento",
        `<section class="hero"><p class="eyebrow">GTA VI · Curación en español</p><h1>Menos ruido.<br>Mejores momentos.</h1><p class="lead">Fails, jugadas, detalles y reacciones. Los clips que merecen tu tiempo, con contexto y crédito a quien los crea.</p><aside class="notice">La primera selección está en camino. Solo publicamos cuando hay algo que merece la pena.</aside><a class="button" href="/archivo">Explorar el archivo ↗</a></section>`,
        base + "/",
      );
  }
  return new Response("Edición no encontrada", { status: 404 });
}
export async function handle(
  request: Request,
  env: Env,
  localAuthorized = false,
): Promise<Response> {
  let response: Response;
  try {
    response = await route(request, env, localAuthorized);
  } catch (e) {
    response = json(
      {
        error:
          e instanceof Error &&
          /Texto|URL|Twitch|Fecha|Categor|Clips|Confirma|JSON|contenido|Contenido|Revisi|Retirada|Clip no/.test(
            e.message,
          )
            ? e.message
            : "Solicitud no válida",
      },
      400,
    );
  }
  const headers = new Headers(response.headers);
  headers.set("Cache-Control", "no-store");
  headers.set("X-Content-Type-Options", "nosniff");
  headers.set("Referrer-Policy", "strict-origin-when-cross-origin");
  headers.set(
    "Content-Security-Policy",
    "default-src 'none'; style-src 'self'; script-src 'self'; connect-src 'self'; base-uri 'none'; form-action 'self'; frame-ancestors 'none'",
  );
  headers.set("Permissions-Policy", "camera=(), microphone=(), geolocation=()");
  return new Response(request.method === "HEAD" ? null : response.body, {
    status: response.status,
    headers,
  });
}
export default { fetch: (request: Request, env: Env) => handle(request, env) };
