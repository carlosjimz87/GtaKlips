import { editionWrite } from "./edition-store";
import { enrichmentAsset, enrichmentStatus } from "./enrichment";
import { source } from "./source";
import {
  inboxAction,
  getSelection,
  selectionClips,
  getCandidate,
} from "./inbox";
import { inboxPage, inboxScript } from "./inbox-admin";
import { editionView, emptyView, catalogScript } from "./catalog";
import { importTwitch, type Candidate } from "./importer";
import { importPage, importScript } from "./import-admin";
import { authorized, type Env } from "./auth";
import { dateValid, esc, post, type Edition } from "./model";
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
  route = new URL(canonical).pathname,
): Response {
  const selection = route === "/";
  const archive = route === "/archivo";
  const hasSearch = content.includes('id="buscar"');
  const canSearch =
    hasSearch || (archive && content.includes('<ul class="archive"><li>'));
  const search = hasSearch ? "#buscar" : "/#buscar";
  const header = privatePage
    ? '<header><a href="/" class="brand">Gta<span>Klips</span></a><nav aria-label="Principal"><a href="/">La selección</a><a href="/archivo">Archivo</a></nav></header>'
    : `<a class="skip-link" href="#contenido">Saltar al contenido</a><header><div class="masthead"><a href="/" class="brand" aria-label="GtaKlips · Inicio">Gta<span>Klips</span></a><span class="brand-caption">EL DIRECTO.<br>LOS BUENOS MOMENTOS.</span></div><nav aria-label="Principal"><a class="nav-selection" href="/#seleccion" ${selection ? 'aria-current="page"' : ""}>Selección</a><a href="/archivo" ${archive ? 'aria-current="page"' : ""}>Archivo</a>${canSearch ? `<a class="nav-search" href="${search}">Buscar</a>` : ""}</nav></header>`;
  const footer = privatePage
    ? "<footer>GtaKlips · Curación independiente en español. Sin afiliación con Rockstar Games ni Twitch.</footer>"
    : `<footer class="editorial-footer"><div class="footer-main"><div><a href="/" class="brand">Gta<span>Klips</span></a><p class="footer-statement">El directo pasa.<br>El momento se queda.</p><p class="footer-caption">Una selección con contexto y crédito a quienes la hacen posible.</p></div><nav aria-label="Más momentos"><p class="eyebrow">SIGUE EXPLORANDO</p><a href="/#seleccion">La selección actual</a><a href="/archivo">Ediciones anteriores</a></nav><div class="footer-credit"><p class="eyebrow">DE SUS CREADORES A TU PANTALLA</p><p>Cada clip conserva su autor y el acceso a la fuente original.</p><a class="button secondary" href="/archivo">Explorar archivo</a></div></div><div class="footer-bottom"><span>GtaKlips · Curación independiente en español.</span><p>Sin afiliación con Rockstar Games ni Twitch. Los vídeos y publicaciones se muestran mediante sus proveedores oficiales o en sus webs; no alojamos copias. Los proveedores pueden aplicar sus cookies y controles de contenido.</p></div></footer>`;
  return new Response(
    `<!doctype html><html lang="es"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>${esc(title)} · GtaKlips</title><meta name="description" content="${esc(description)}"><meta name="robots" content="${privatePage ? "noindex, nofollow" : "index, follow"}"><link rel="canonical" href="${esc(canonical)}"><meta property="og:type" content="website"><meta property="og:locale" content="es_ES"><meta property="og:site_name" content="GtaKlips"><meta property="og:title" content="${esc(title)}"><meta property="og:description" content="${esc(description)}"><meta property="og:url" content="${esc(canonical)}"><meta name="twitter:card" content="summary"><link rel="stylesheet" href="/style.css"></head><body class="${privatePage ? "admin-page" : "public-page"}">${header}<main id="contenido" tabindex="-1">${content}</main>${privatePage ? "" : '<script src="/catalog.js" defer></script>'}${footer}</body></html>`,
    {
      headers: {
        "Content-Type": "text/html; charset=utf-8",
        "X-Media-Providers": [
          content.includes('data-provider="youtube"') ? "youtube" : "",
          content.includes('data-provider="x"') ? "x" : "",
        ].join(","),
      },
    },
  );
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
      if (path.startsWith("/admin/inbox/"))
        return json(
          await inboxAction(env, path.slice("/admin/inbox/".length), v),
        );
      if (path === "/admin/selection/load") {
        const selection = await getSelection(env, v.date);
        const row = await env.DB.prepare("SELECT * FROM editions WHERE date=?")
          .bind(v.date)
          .first<Row>();
        if (
          !selection.prepared ||
          selection.revision !== v.selectionRevision ||
          (row?.revision || 0) !== v.revision ||
          (row && v.confirm !== true)
        )
          return json(
            {
              error:
                "Revisión cambió o falta confirmar añadir al borrador existente. Recarga.",
            },
            409,
          );
        const clips = await selectionClips(env, selection);
        const existing = row ? JSON.parse(row.draft) : null;
        const combined = [...(existing?.clips || [])];
        for (const c of clips)
          if (!combined.some((old: any) => source(old.url).id === c.id))
            combined.push({ ...c, sourceId: c.source_id });
        if (combined.length > 10)
          return json(
            {
              error:
                "Clips: el borrador combinado supera diez fuentes. Ajusta la selección.",
            },
            400,
          );
        return json({
          edition: {
            ...(existing || {
              date: v.date,
              title: "",
              intro: "",
              hook: "",
              demo: false,
              featured: combined[0]?.id,
            }),
            clips: combined,
            reviewed: false,
          },
          revision: row?.revision || 0,
          published: !!row?.published,
        });
      }
      if (path === "/admin/import")
        return json(await importTwitch(env, "manual"));
      if (path === "/admin/candidates/review") {
        if (
          typeof v.id !== "string" ||
          !/^[A-Za-z0-9_-]{1,100}$/.test(v.id) ||
          !["pending", "selected", "rejected"].includes(v.state)
        )
          return json({ error: "Revisión de candidato no válida" }, 400);
        const result = await env.DB.prepare(
          "UPDATE candidates SET review_state=? WHERE id=?",
        )
          .bind(v.state, v.id)
          .run();
        if (result.meta.changes)
          await env.DB.prepare(
            "UPDATE manual_candidates SET state=?,revision=revision+1 WHERE id=? AND capture_origin='discovery'",
          )
            .bind(v.state === "rejected" ? "discarded" : "pending", v.id)
            .run();
        return result.meta.changes
          ? json({ ok: true })
          : json({ error: "Candidato no encontrado" }, 404);
      }
      if (!Number.isSafeInteger(v.revision) || v.revision < 0)
        throw Error("Revisión no válida");
      if (path === "/admin/save" || path === "/admin/publish") {
        const statement = editionWrite(
          env,
          v.edition,
          v.revision,
          path.endsWith("publish"),
        );
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
        if (v.id.startsWith("https://")) v.id = source(v.id).id;
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
    if (/^\/admin\/enrichment-assets\/[a-f0-9]{64}\.jpg$/.test(path))
      return enrichmentAsset(env, path.split("/").at(-1)!.slice(0, -4), true);
    if (path === "/admin/inbox/enrichment")
      return json(
        await enrichmentStatus(env, url.searchParams.get("id") || ""),
      );
    if (path === "/admin/inbox/preview") {
      const candidate = await getCandidate(
        env,
        url.searchParams.get("id") || "",
      );
      if (!candidate) return json({ error: "Clip no encontrado" }, 404);
      const clip = {
        ...source(candidate.url),
        title: candidate.title || "Título pendiente",
        streamer: candidate.streamer || "Crédito pendiente",
        text: candidate.text || "Contexto pendiente de revisión",
        category: candidate.category,
        orientation: candidate.orientation as
          "auto" | "portrait" | "landscape" | "square",
        ...(candidate.thumbnail
          ? {
              thumbnail: candidate.thumbnail.replace(
                "/media/enrichment/",
                "/admin/enrichment-assets/",
              ),
            }
          : {}),
      };
      return page(
        "Revisión privada",
        '<a href="/admin/inbox">Volver a la bandeja</a><p>Vista privada: revisa disponibilidad, crédito y contexto. No se guarda ni publica.</p>' +
          editionView(
            {
              date: candidate.captured_date,
              title: "Revisión de fuente",
              intro: "Fuente privada pendiente de revisión editorial",
              hook: "",
              demo: false,
              reviewed: false,
              featured: clip.id,
              clips: [clip],
            },
            null,
          ) +
          '<script src="/catalog.js" defer></script>',
        base + path,
        undefined,
        true,
      );
    }
    if (path === "/admin/inbox")
      return page(
        "Bandeja privada",
        await inboxPage(env, url),
        base + path,
        undefined,
        true,
      );
    if (path === "/admin/inbox.js")
      return new Response(inboxScript, {
        headers: { "Content-Type": "text/javascript; charset=utf-8" },
      });
    if (path === "/admin/source.js")
      return new Response(
        "const normalizeSource = " + source.toString() + ";",
        { headers: { "Content-Type": "text/javascript; charset=utf-8" } },
      );
    if (path === "/admin/selection") {
      const date = url.searchParams.get("date") || "";
      const selection = await getSelection(env, date);
      const row = await env.DB.prepare(
        "SELECT revision FROM editions WHERE date=?",
      )
        .bind(date)
        .first<Row>();
      return json({ selection, revision: row?.revision || 0 });
    }
    if (path === "/admin/imports")
      return page(
        "Importaciones",
        await importPage(env, url.searchParams.get("offset")),
        base + path,
        undefined,
        true,
      );
    if (path === "/admin/imports.js")
      return new Response(importScript, {
        headers: { "Content-Type": "text/javascript; charset=utf-8" },
      });
    if (path === "/admin/candidate") {
      const candidate = await env.DB.prepare(
        "SELECT * FROM candidates WHERE id=?",
      )
        .bind(url.searchParams.get("id"))
        .first<Candidate>();
      return candidate
        ? json(candidate)
        : json({ error: "Candidato no encontrado" }, 404);
    }
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
  if (/^\/media\/enrichment\/[a-f0-9]{64}\.jpg$/.test(path))
    return enrichmentAsset(env, path.split("/").at(-1)!.slice(0, -4));
  if (path === "/catalog.js")
    return new Response(catalogScript, {
      headers: { "Content-Type": "text/javascript; charset=utf-8" },
    });
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
        editionView(
          e,
          url.searchParams.get("categoria"),
          url.searchParams.get("q") || "",
        ),
        base + "/dia/" + e.date,
        e.intro,
        false,
        path,
      );
    }
    if (path === "/")
      return page("El próximo gran momento", emptyView, base + "/");
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
  const media = headers.get("X-Media-Providers") || "";
  headers.delete("X-Media-Providers");
  headers.set(
    "Content-Security-Policy",
    "default-src 'none'; style-src 'self'; script-src 'self'; connect-src 'self'; img-src 'self' https://static-cdn.jtvnw.net https://clips-media-assets2.twitch.tv https://clips-media-assets.twitch.tv; frame-src https://clips.twitch.tv; base-uri 'none'; form-action 'self'; frame-ancestors 'none'",
  );
  headers.set(
    "Permissions-Policy",
    'camera=(), microphone=(), geolocation=(), autoplay=(self "https://clips.twitch.tv")',
  );
  if (media.includes("youtube") || media.includes("x")) {
    let csp = headers.get("Content-Security-Policy")!;
    const youtube = media.includes("youtube"),
      x = media.includes("x");
    csp = csp
      .replace(
        "script-src 'self'",
        "script-src 'self'" +
          (youtube
            ? " https://www.youtube.com/iframe_api https://www.youtube.com/s/player/"
            : "") +
          (x
            ? " https://platform.twitter.com/widgets.js https://platform.twitter.com/js/"
            : ""),
      )
      .replace(
        "connect-src 'self'",
        "connect-src 'self'" +
          (x
            ? " https://syndication.twitter.com https://cdn.syndication.twimg.com"
            : ""),
      )
      .replace(
        "frame-src https://clips.twitch.tv",
        "frame-src https://clips.twitch.tv" +
          (youtube ? " https://www.youtube.com" : "") +
          (x
            ? " https://platform.twitter.com https://syndication.twitter.com"
            : ""),
      );
    headers.set("Content-Security-Policy", csp);
    if (youtube)
      headers.set(
        "Permissions-Policy",
        'camera=(), microphone=(), geolocation=(), autoplay=(self "https://clips.twitch.tv" "https://www.youtube.com")',
      );
  }
  headers.set(
    "Content-Security-Policy",
    headers
      .get("Content-Security-Policy")!
      .replace(
        "https://clips-media-assets.twitch.tv;",
        "https://clips-media-assets.twitch.tv https://i.ytimg.com https://pbs.twimg.com;",
      ),
  );
  return new Response(request.method === "HEAD" ? null : response.body, {
    status: response.status,
    headers,
  });
}
export default {
  fetch: (request: Request, env: Env) => handle(request, env),
  async scheduled(
    _controller: ScheduledController,
    env: Env,
    ctx: ExecutionContext,
  ) {
    ctx.waitUntil(importTwitch(env, "cron"));
  },
};
