import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, readFile, rm, readdir } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { build } from "esbuild";
import {
  Miniflare,
  convertV4MiniflareOptions,
  Response as MFResponse,
} from "miniflare";
import { createEnrichmentRunner } from "../src/enrichment-runner";

const base = "http://127.0.0.1:8794",
  secret = "fixture-private-bridge-key-not-a-real-secret",
  owner = "00000000-0000-4000-8000-000000000001";
let runtime: Miniflare, production: Miniflare, dir: string, script: string;
const message = (text: string) => ({
  chat: { id: 101, type: "private" },
  from: { id: 102 },
  text,
});
const post = async (path: string, body: unknown, auth = true) =>
  runtime.dispatchFetch(base + path, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(path.startsWith("/admin")
        ? { Origin: base }
        : auth
          ? { Authorization: `Bearer ${secret}` }
          : {}),
    },
    body: JSON.stringify(body),
  });
const bridge = (action: string, v: Record<string, unknown> = {}) =>
  post("/internal/telegram/" + action, { owner, ...v });
const admin = (action: string, v: unknown) => post("/admin/inbox/" + action, v);
const update = (update_id: number, extra: Record<string, unknown>) =>
  bridge("update", { update: { update_id, ...extra } });
function localRuntime() {
  return new Miniflare(
    convertV4MiniflareOptions({
      modules: true,
      script,
      compatibilityDate: "2026-11-01",
      d1Databases: ["DB"],
      resourcePersistencePath: join(dir, "db"),
      bindings: {
        PUBLIC_ORIGIN: base,
        LOCAL_DEVELOPMENT: "explicit-loopback-only",
        LOCAL_BRIDGE_SECRET: secret,
        TELEGRAM_OWNER_CHAT_ID: "101",
        TELEGRAM_OWNER_USER_ID: "102",
      },
      outboundService: () => {
        return new MFResponse(
          JSON.stringify({
            provider_name: "YouTube",
            title: "The streamer Creador pulls off a maneuver",
            author_name: "Canal original",
          }),
          { headers: { "Content-Type": "application/json" } },
        );
      },
    }),
  );
}
before(async () => {
  dir = await mkdtemp(join(tmpdir(), "gtaklips-auto-"));
  for (const entry of ["local", "index"])
    await build({
      entryPoints: [`src/${entry}.ts`],
      outfile: join(dir, entry + ".js"),
      bundle: true,
      format: "esm",
      platform: "browser",
      target: "es2022",
    });
  script = await readFile(join(dir, "local.js"), "utf8");
  runtime = localRuntime();
  production = new Miniflare(
    convertV4MiniflareOptions({
      modules: true,
      script: await readFile(join(dir, "index.js"), "utf8"),
      compatibilityDate: "2026-11-01",
      d1Databases: ["DB"],
      bindings: {
        PUBLIC_ORIGIN: base,
        LOCAL_DEVELOPMENT: "explicit-loopback-only",
        LOCAL_BRIDGE_SECRET: secret,
      },
    }),
  );
  const db = await runtime.getD1Database("DB");
  for (const f of (await readdir("migrations")).sort())
    await db.exec(
      (await readFile("migrations/" + f, "utf8")).replace(/\n/g, " "),
    );
});
after(async () => {
  await runtime?.dispose();
  await production?.dispose();
  await rm(dir, { recursive: true, force: true });
});

let seq = 1000;
async function deliver(extra: Record<string, unknown>) {
  await bridge("lease");
  const id = seq++;
  const response = await update(id, extra);
  assert.equal(response.status, 200, await response.text());
  const db = await runtime.getD1Database("DB");
  const rows = await db
    .prepare(
      "SELECT payload FROM telegram_outbox WHERE update_id=? ORDER BY part",
    )
    .bind(id)
    .all<{ payload: string }>();
  const parts = rows.results.map((x) => JSON.parse(x.payload));
  return { ...parts.at(-1), text: parts.map((p) => p.text).join("\n"), parts };
}
const send = (text: string) => deliver({ message: message(text) });
const tap = (data: string) =>
  deliver({
    callback_query: {
      id: "test",
      from: { id: 102 },
      message: message("reply"),
      data,
    },
  });
const internal = (action: string, body: unknown = {}) =>
  post("/internal/enrichment/" + action, body);
async function complete(id: string) {
  const db = await runtime.getD1Database("DB");
  const c = await db
    .prepare("SELECT * FROM manual_candidates WHERE id=?")
    .bind(id)
    .first<any>();
  assert.equal(
    (
      await admin("edit", {
        id,
        revision: c.revision,
        title: "Título editorial",
        streamer: "Creador",
        text: "Contexto editorial revisado de la fuente.",
        category: "Jugadas",
      })
    ).status,
    200,
  );
  await db
    .prepare("UPDATE enrichment_jobs SET status='complete' WHERE candidate=?")
    .bind(id)
    .run();
}

test("capture automatically selects, persists a batch, queues all providers and never publishes", async () => {
  await send("/edicion 2040-01-01");
  await send(
    "https://clips.twitch.tv/AutoA https://youtu.be/abcdefghijk https://x.com/test/status/900",
  );
  const db = await runtime.getD1Database("DB");
  const s = await db
    .prepare("SELECT * FROM manual_selections WHERE date='2040-01-01'")
    .first<any>();
  assert.equal(JSON.parse(s.ids).length, 3);
  assert.equal(s.prepared, 1);
  assert.equal(
    await db.prepare("SELECT count(*) n FROM enrichment_jobs").first("n"),
    3,
  );
  assert.equal(
    await db.prepare("SELECT count(*) n FROM capture_members").first("n"),
    3,
  );
  assert.equal(
    await db.prepare("SELECT count(*) n FROM editions").first("n"),
    0,
  );
  const again = await send("https://clips.twitch.tv/AutoA");
  assert.match(again.text, /Duplicados: 1/);
  const reply = await send("/seleccion");
  assert.equal(reply.reply_markup.inline_keyboard.length, 4);
  assert.match(reply.text, /Categoría pendiente/);
});

test("metadata first, local inference fallback and automatic application retain provenance", async () => {
  const db = await runtime.getD1Database("DB");
  await db.prepare("UPDATE enrichment_jobs SET status='failed'").run();
  await send("/edicion 2040-01-02");
  await send("https://youtu.be/abcdefghijl");
  let models = 0;
  const fetcher: typeof fetch = async (url, opts) => {
    if (String(url).includes("/api/chat")) {
      models++;
      return Response.json({
        message: {
          content: JSON.stringify({
            title: "A maneuver by the creator",
            text: "The post describes a maneuver by the streamer.",
            streamer: "Creador",
            category: "Jugadas",
            evidence: {
              title: "maneuver",
              text: "maneuver",
              streamer: "The streamer Creador",
              category: "maneuver",
            },
          }),
        },
      });
    }
    return new Response(
      await (await runtime.dispatchFetch(String(url), opts as any)).text(),
      { headers: { "Content-Type": "application/json" } },
    );
  };
  await createEnrichmentRunner(
    { origin: base, secret, model: "fixture", comments: 0 },
    fetcher,
  ).cycle();
  const c = await db
    .prepare("SELECT * FROM manual_candidates WHERE id='youtube:abcdefghijl'")
    .first<any>();
  assert.equal(models, 1);
  assert.equal(c.title, "The streamer Creador pulls off a maneuver");
  assert.equal(c.category, "Jugadas");
  assert.match(c.text, /The post/);
  assert.equal(JSON.parse(c.field_sources).text, "enrich (propuesta)");
  assert.equal(c.state, "pending");
  assert.equal(
    await db.prepare("SELECT count(*) n FROM editions").first("n"),
    0,
  );
});

test("complete clips skip inference; manual clearing is not refilled automatically", async () => {
  await send("/edicion 2040-01-03");
  await send("https://clips.twitch.tv/AutoComplete");
  await complete("AutoComplete");
  const db = await runtime.getD1Database("DB");
  await db
    .prepare(
      "UPDATE enrichment_jobs SET status='queued',attempts=0 WHERE candidate='AutoComplete'",
    )
    .run();
  let models = 0;
  const fetcher: typeof fetch = async (url, opts) => {
    if (String(url).includes("/api/chat")) {
      models++;
      throw Error("should not infer");
    }
    const r = await runtime.dispatchFetch(String(url), opts as any);
    return new Response(await r.text(), {
      status: r.status,
      headers: { "Content-Type": "application/json" },
    });
  };
  await createEnrichmentRunner(
    { origin: base, secret, model: "fixture", comments: 0 },
    fetcher,
  ).cycle();
  assert.equal(models, 0);
  const c = await db
    .prepare("SELECT * FROM manual_candidates WHERE id='AutoComplete'")
    .first<any>();
  await admin("edit", { id: c.id, revision: c.revision, text: "" });
  await admin("analyze", { id: c.id });
  const claim = (await (await internal("claim")).json()) as any;
  const e = {
    provider: "twitch",
    postId: "AutoComplete",
    text: "The streamer Creador pulls off a maneuver",
    author: "",
    handle: "",
    tags: [],
    comments: [],
    commentsRequested: 0,
    commentsReason: "",
    width: 0,
    height: 0,
    dimensionSource: "unavailable",
    imageType: "unavailable",
  };
  const proposal = {
    extraction: e,
    suggestion: {
      title: "Título",
      text: "The post describes a maneuver.",
      streamer: "Creador",
      category: "Jugadas",
      evidence: {
        title: "maneuver",
        text: "maneuver",
        streamer: "Creador",
        category: "maneuver",
      },
    },
    thumbnail: "",
    modelStatus: "complete",
  };
  assert.equal(
    (await internal("finish", { ...claim.job, proposal })).status,
    200,
  );
  assert.equal(
    await db
      .prepare("SELECT text FROM manual_candidates WHERE id='AutoComplete'")
      .first("text"),
    "",
  );
});

test("final batch summary is durable once and incomplete sources cannot publish", async () => {
  const db = await runtime.getD1Database("DB");
  await db
    .prepare(
      "UPDATE enrichment_jobs SET status='partial',error='Datos no disponibles'",
    )
    .run();
  await bridge("outbox");
  const count = await db
    .prepare("SELECT count(*) n FROM telegram_outbox WHERE update_id<0")
    .first("n");
  assert.ok(Number(count) > 0);
  await bridge("outbox");
  assert.equal(
    await db
      .prepare("SELECT count(*) n FROM telegram_outbox WHERE update_id<0")
      .first("n"),
    count,
  );
  const preview = await send("/publicar");
  assert.match(preview.text, /No se puede publicar/);
  assert.equal(preview.reply_markup, undefined);
});

test("explicit publication uses full preview, preserves prior edition and fences double click and stale admin writes", async () => {
  await send("/edicion 2040-01-04");
  await send("https://clips.twitch.tv/PublishA");
  await complete("PublishA");
  let p = await send("/publicar");
  assert.match(p.text, /Contexto editorial revisado/);
  const old = p.reply_markup.inline_keyboard[0][0].callback_data;
  const db = await runtime.getD1Database("DB");
  const c = await db
    .prepare("SELECT * FROM manual_candidates WHERE id='PublishA'")
    .first<any>();
  await admin("edit", {
    id: c.id,
    revision: c.revision,
    title: "Título corregido",
  });
  assert.match((await tap(old)).text, /cambió/);
  assert.equal(
    await db.prepare("SELECT count(*) n FROM editions").first("n"),
    0,
  );
  p = await send("/publicar");
  const good = p.reply_markup.inline_keyboard[0][0].callback_data;
  const bad = await deliver({
    callback_query: {
      from: { id: 999 },
      message: message("reply"),
      data: good,
    },
  });
  assert.equal(bad.text, "");
  assert.match((await tap(good)).text, /publicada/);
  const before = await db
    .prepare("SELECT published,revision FROM editions WHERE date='2040-01-04'")
    .first<any>();
  assert.equal(JSON.parse(before.published).clips[0].title, "Título corregido");
  assert.match((await tap(good)).text, /caducado/);
  assert.equal(
    (
      await db
        .prepare("SELECT revision FROM editions WHERE date='2040-01-04'")
        .first<any>()
    ).revision,
    before.revision,
  );
  // A later selection must not replace an already published clip.
  await db
    .prepare(
      "UPDATE manual_selections SET ids='[]',revision=revision+1 WHERE date='2040-01-04'",
    )
    .run();
  await send("https://clips.twitch.tv/PublishB");
  await complete("PublishB");
  p = await send("/publicar");
  assert.match(p.text, /PublishA/);
  assert.match(p.text, /PublishB/);
  const button = p.reply_markup.inline_keyboard[0][0].callback_data;
  await tap(button);
  assert.equal(
    JSON.parse(
      (
        await db
          .prepare("SELECT published FROM editions WHERE date='2040-01-04'")
          .first<any>()
      ).published,
    ).clips.length,
    2,
  );
});

test("all preview content is delivered across parts and confirmation is only in the last part", async () => {
  await send("/edicion 2040-01-05");
  const urls = Array.from(
    { length: 10 },
    (_, i) => "https://clips.twitch.tv/Long" + i,
  );
  await send(urls.join(" "));
  const db = await runtime.getD1Database("DB");
  for (let i = 0; i < 10; i++) {
    await complete("Long" + i);
    const c = await db
      .prepare("SELECT revision FROM manual_candidates WHERE id=?")
      .bind("Long" + i)
      .first<any>();
    await admin("edit", {
      id: "Long" + i,
      revision: c.revision,
      text: "Contexto ".repeat(44),
    });
  }
  const p = await send("/publicar");
  assert.ok(p.parts.length > 1);
  assert.match(p.text, /Long9/);
  assert.ok(p.parts.slice(0, -1).every((x: any) => !x.reply_markup));
  assert.ok(p.parts.at(-1).reply_markup);
  const overflow = await send("https://clips.twitch.tv/Overflow");
  assert.match(overflow.text, /fuera de la selección/);
  assert.equal(
    JSON.parse(
      (
        await db
          .prepare("SELECT ids FROM manual_selections WHERE date='2040-01-05'")
          .first<any>()
      ).ids,
    ).length,
    10,
  );
});

test("later preview parts and confirmation are withheld when an earlier part fails delivery", async () => {
  const db = await runtime.getD1Database("DB");
  await db.prepare("UPDATE telegram_outbox SET delivered=1").run();
  const p = await send("/publicar");
  assert.ok(p.parts.length > 1);
  // Unrelated batch-completion notices may be queued concurrently; only the preview chain matters.
  const preview = async () =>
    ((await (await bridge("outbox")).json()) as any[]).filter((r) =>
      r.payload.includes("Vista previa de edición"),
    );
  const rows = await preview();
  assert.equal(rows.length, 1);
  await bridge("ack", { id: rows[0].id, ok: false, retryAfter: 30 });
  const chain = (
    await db
      .prepare(
        "SELECT id FROM telegram_outbox WHERE update_id=(SELECT update_id FROM telegram_outbox WHERE id=?) AND part>0 AND delivered=0",
      )
      .bind(rows[0].id)
      .all()
  ).results.map((r: any) => r.id);
  const visible = ((await (await bridge("outbox")).json()) as any[]).map(
    (r) => r.id,
  );
  assert.ok(
    chain.length > 0 && chain.every((id: number) => !visible.includes(id)),
  );
  assert.ok(!visible.includes(rows[0].id));
  await db
    .prepare("UPDATE telegram_outbox SET next_at=0 WHERE id=?")
    .bind(rows[0].id)
    .run();
  await bridge("ack", { id: rows[0].id, ok: true });
  const next = ((await (await bridge("outbox")).json()) as any[]).map(
    (r) => r.id,
  );
  assert.ok(next.includes(chain[0]));
  assert.ok(!next.includes(rows[0].id));
});
