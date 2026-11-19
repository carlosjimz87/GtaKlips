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
import { source } from "../src/source";
import { validate } from "../src/model";
import { extractURLs, ownerUpdate, retryDelay } from "../src/telegram";
import { createRunner, runnerConfig } from "../src/telegram-runner";
const base = "http://127.0.0.1:8799",
  secret = "fixture-private-bridge-key-not-a-real-secret",
  owner = "00000000-0000-4000-8000-000000000001",
  other = "00000000-0000-4000-8000-000000000002";
let runtime: Miniflare, production: Miniflare, dir: string, script: string;
let providerCalls = 0;
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
        providerCalls++;
        return new MFResponse("unavailable", { status: 503 });
      },
    }),
  );
}
before(async () => {
  dir = await mkdtemp(join(tmpdir(), "gtaklips-multisource-"));
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
test("normalization is exact, tracking-safe, provider-namespaced and legacy-compatible", () => {
  assert.deepEqual(source("https://youtu.be/abcdefghijk?si=share"), {
    id: "youtube:abcdefghijk",
    provider: "youtube",
    sourceId: "abcdefghijk",
    url: "https://www.youtube.com/watch?v=abcdefghijk",
  });
  assert.equal(
    source("https://www.youtube.com/shorts/abcdefghijk").id,
    "youtube:abcdefghijk",
  );
  assert.equal(source("https://twitter.com/demo/status/123?s=20").id, "x:123");
  assert.equal(
    source("https://clips.twitch.tv/abcdefghijk?utm_source=telegram").id,
    "abcdefghijk",
  );
  assert.equal(source("https://www.twitch.tv/demo/clip/Legacy").id, "Legacy");
  for (const value of [
    "http://youtu.be/abcdefghijk",
    "https://youtu.be.evil.test/abcdefghijk",
    "https://youtu.be/abcdefghijk?redirect=https://evil.test",
    "https://u@x.com/a/status/1",
    "https://x.com/a/status/1#x",
    "https://t.co/example",
    "https://youtube.com/watch?v=abcdefghijk&v=abcdefghijl",
    "https://youtube.com/embed/abcdefghijk",
    "https://youtube.com/redirect?q=x",
    "https://127.0.0.1/a",
    "https://x.com/a/status/0",
    "https://x.com/a/status/1/video/1",
    "https://x.com:444/a/status/1",
    "https://x.com\\@evil.test/a/status/1",
  ])
    assert.throws(() => source(value), value);
  const urls = [
    "https://clips.twitch.tv/abcdefghijk",
    "https://youtu.be/abcdefghijk",
    "https://x.com/demo/status/123",
  ];
  const e = validate(
    {
      date: "2039-01-01",
      title: "Title",
      intro: "Intro",
      hook: "Hook",
      demo: false,
      reviewed: true,
      featured: "youtube:abcdefghijk",
      clips: urls.map((url) => ({
        url,
        title: "Title",
        streamer: "Creator",
        text: "Context",
        category: "Fails",
        orientation: "portrait",
      })),
    },
    true,
  );
  assert.equal(new Set(e.clips.map((c) => c.id)).size, 3);
  assert.equal(e.clips[0].id, "abcdefghijk");
});
test("entity, caption, forwarded text extraction is bounded; owner gate rejects groups and wrong senders", () => {
  const text = "😀 https://youtu.be/abcdefghijk";
  assert.deepEqual(
    extractURLs({ text, entities: [{ type: "url", offset: 3, length: 28 }] })
      .urls,
    ["https://youtu.be/abcdefghijk"],
  );
  assert.equal(
    extractURLs({
      caption: "hidden",
      caption_entities: [
        { type: "text_link", url: "https://x.com/demo/status/123" },
      ],
      forward_origin: { sender_user: { first_name: "not attribution" } },
    }).urls.length,
    1,
  );
  assert.equal(
    extractURLs({
      text: Array.from(
        { length: 12 },
        (_, i) => `https://clips.twitch.tv/Clip${i}`,
      ).join(" "),
    }).overflow,
    2,
  );
  assert.equal(
    ownerUpdate({ message: message("x") }, { chat: "101", user: "102" }),
    true,
  );
  for (const msg of [
    { ...message("x"), chat: { id: 101, type: "group" } },
    { ...message("x"), from: { id: 103 } },
    { ...message("x"), chat: { id: 103, type: "private" } },
  ])
    assert.equal(
      ownerUpdate({ message: msg }, { chat: "101", user: "102" }),
      false,
    );
  assert.equal(retryDelay(2, 9), 9000);
  assert.equal(retryDelay(20), 300000);
});
test("bridge is absent from production, secret protected, origin rejected and lease exclusive", async () => {
  assert.equal(
    (
      await production.dispatchFetch(base + "/internal/telegram/lease", {
        method: "POST",
        headers: { Authorization: `Bearer ${secret}` },
        body: "{}",
      })
    ).status,
    405,
  );
  assert.equal(
    (await post("/internal/telegram/lease", { owner }, false)).status,
    401,
  );
  assert.equal(
    (
      await runtime.dispatchFetch(base + "/internal/telegram/lease", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${secret}`,
          Origin: base,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ owner }),
      })
    ).status,
    401,
  );
  assert.equal((await bridge("lease")).status, 200);
  assert.equal((await bridge("lease", { owner: other })).status, 409);
  assert.equal(
    (await runtime.dispatchFetch("https://public.test/internal/telegram/lease"))
      .status,
    404,
  );
});
test("unauthorized updates persist only cursor bookkeeping and never reply or fetch metadata", async () => {
  const db = await runtime.getD1Database("DB");
  assert.equal(
    (
      await update(1, {
        message: {
          ...message("https://youtu.be/abcdefghijk"),
          from: { id: 999 },
        },
      })
    ).status,
    200,
  );
  assert.equal(
    await db
      .prepare("SELECT count(*) FROM manual_candidates")
      .first("count(*)"),
    0,
  );
  assert.equal(
    await db.prepare("SELECT count(*) FROM telegram_outbox").first("count(*)"),
    0,
  );
  assert.equal(providerCalls, 0);
});
test("five sources across three providers, duplicates, captions and forwarded URLs remain private", async () => {
  const urls = [
    "https://clips.twitch.tv/Five1",
    "https://clips.twitch.tv/Five2",
    "https://youtu.be/abcdefghijk",
    "https://www.youtube.com/shorts/abcdefghijl",
    "https://twitter.com/demo/status/123",
  ];
  assert.equal(
    (
      await update(2, {
        message: {
          ...message(urls.join("\n")),
          forward_origin: { sender_user: { first_name: "DO NOT ATTRIBUTE" } },
        },
      })
    ).status,
    200,
  );
  assert.equal(
    (await update(2, { message: message(urls.join("\n")) })).status,
    200,
  );
  assert.equal(
    (
      await update(3, {
        message: {
          ...message(""),
          caption: urls[0],
          caption_entities: [
            { type: "url", offset: 0, length: urls[0].length },
          ],
        },
      })
    ).status,
    200,
  );
  const db = await runtime.getD1Database("DB");
  assert.equal(
    await db
      .prepare("SELECT count(*) FROM manual_candidates")
      .first("count(*)"),
    5,
  );
  assert.equal(
    await db.prepare("SELECT count(*) FROM editions").first("count(*)"),
    0,
  );
  assert.equal(
    await db
      .prepare("SELECT count(*) FROM manual_candidates WHERE streamer<>''")
      .first("count(*)"),
    0,
  );
  const reply = await db
    .prepare("SELECT payload FROM telegram_outbox WHERE update_id=3")
    .first<string>("payload");
  assert.match(reply!, /Duplicados: 1/);
  assert.equal(providerCalls, 0);
});
test("edit/media guidance, max-ten bound and invalid URL rejection", async () => {
  await update(4, {
    edited_message: message("https://clips.twitch.tv/ShouldNotSave"),
  });
  await update(5, {
    message: { ...message(""), video: { file_id: "not-downloaded" } },
  });
  await update(6, { message: message("https://evil.test/private") });
  const db = await runtime.getD1Database("DB");
  assert.equal(
    await db
      .prepare("SELECT count(*) FROM manual_candidates")
      .first("count(*)"),
    5,
  );
  assert.match(
    (await db
      .prepare("SELECT payload FROM telegram_outbox WHERE update_id=4")
      .first<string>("payload"))!,
    /mensaje nuevo/,
  );
  assert.match(
    (await db
      .prepare("SELECT payload FROM telegram_outbox WHERE update_id=6")
      .first<string>("payload"))!,
    /Rechazados: 1/,
  );
});
test("callbacks select privately, stale revisions reject; context and date commands are durable", async () => {
  const db = await runtime.getD1Database("DB");
  const payload = JSON.parse(
    (await db
      .prepare("SELECT payload FROM telegram_outbox WHERE update_id=2")
      .first<string>("payload"))!,
  );
  const callback = (data: string) => ({
    callback_query: { from: { id: 102 }, message: message("bot reply"), data },
  });
  const toggle = payload.reply_markup.inline_keyboard[0][0].callback_data;
  assert.equal((await update(7, callback(toggle))).status, 200);
  await update(8, callback(toggle));
  assert.match(
    (await db
      .prepare("SELECT payload FROM telegram_outbox WHERE update_id=8")
      .first<string>("payload"))!,
    /caducado/,
  );
  await update(9, { message: message("/seleccion") });
  const selectionReply = JSON.parse(
    (await db
      .prepare("SELECT payload FROM telegram_outbox WHERE update_id=9")
      .first<string>("payload"))!,
  );
  await update(
    10,
    callback(selectionReply.reply_markup.inline_keyboard[0][2].callback_data),
  );
  await update(11, { message: message("Contexto propio revisable") });
  assert.equal(
    await db
      .prepare("SELECT text FROM manual_candidates WHERE id='Five1'")
      .first("text"),
    "Contexto propio revisable",
  );
  await update(12, { message: message("/edicion 2039-02-03") });
  assert.equal(
    await db.prepare("SELECT date FROM telegram_receiver").first("date"),
    "2039-02-03",
  );
  assert.equal(
    await db.prepare("SELECT count(*) FROM editions").first("count(*)"),
    0,
  );
});
test("capture deduplicates imported Twitch without overwriting its review or metadata", async () => {
  const db = await runtime.getD1Database("DB");
  await db
    .prepare(
      "INSERT INTO candidates(id,url,streamer,title,language,game_id,created_at,duration,views,observed_at,review_state) VALUES('ImportedSafe','https://clips.twitch.tv/ImportedSafe','Original','Title','es','1','2039-01-01',20,1,'2039-01-01','rejected')",
    )
    .run();
  const response = await admin("capture", {
    date: "2039-02-03",
    urls: ["https://clips.twitch.tv/ImportedSafe"],
  });
  assert.equal(((await response.json()) as any).duplicate, 1);
  assert.equal(
    await db
      .prepare("SELECT review_state FROM candidates WHERE id='ImportedSafe'")
      .first("review_state"),
    "rejected",
  );
  assert.equal(
    await db
      .prepare("SELECT state FROM manual_candidates WHERE id='ImportedSafe'")
      .first("state"),
    "discarded",
  );
});
test("metadata failure is nonfatal; candidate edits and selection revisions detect conflicts", async () => {
  let r = await admin("metadata", { id: "youtube:abcdefghijk", revision: 1 });
  assert.equal(r.status, 200);
  assert.equal(providerCalls, 1);
  r = await admin("edit", {
    id: "youtube:abcdefghijk",
    revision: 1,
    title: "Stale",
  });
  assert.equal(r.status, 400);
  r = await admin("edit", {
    id: "youtube:abcdefghijk",
    revision: 2,
    title: "Editorial",
    streamer: "Creator",
    text: "Context",
    orientation: "portrait",
    state: "reviewed",
  });
  assert.equal(r.status, 200);
  r = await admin("selection", {
    date: "2039-02-03",
    revision: 0,
    ids: ["youtube:abcdefghijk", "Five1", "x:123"],
    prepared: true,
  });
  assert.equal(r.status, 200);
  assert.equal(
    (
      await admin("selection", {
        date: "2039-02-03",
        revision: 0,
        ids: ["Five1"],
      })
    ).status,
    400,
  );
  assert.equal(
    (
      await admin("selection", {
        date: "2039-02-03",
        revision: 1,
        ids: Array(11).fill("Five1"),
      })
    ).status,
    400,
  );
});
test("prepared selection loads only into editor; merge requires confirmation and preserves public snapshot and revision", async () => {
  const load = (revision: number, confirm = false) =>
    post("/admin/selection/load", {
      date: "2039-02-03",
      selectionRevision: 1,
      revision,
      confirm,
    });
  let r = await load(0);
  assert.equal(r.status, 200);
  const j: any = await r.json();
  assert.equal(j.edition.clips[0].id, "youtube:abcdefghijk");
  assert.equal(j.edition.reviewed, false);
  const db = await runtime.getD1Database("DB");
  assert.equal(
    await db.prepare("SELECT count(*) FROM editions").first("count(*)"),
    0,
  );
  const e = {
    date: "2039-02-03",
    title: "Public title",
    intro: "Intro",
    hook: "Hook",
    demo: false,
    reviewed: true,
    featured: "LegacyAnchor",
    clips: [
      {
        url: "https://clips.twitch.tv/LegacyAnchor",
        title: "Legacy",
        streamer: "Creator",
        text: "Context",
        category: "Fails",
      },
    ],
  };
  assert.equal(
    (await post("/admin/publish", { edition: e, revision: 0 })).status,
    200,
  );
  assert.equal((await load(1)).status, 409);
  assert.equal((await load(0, true)).status, 409);
  r = await load(1, true);
  assert.equal(r.status, 200);
  const merged: any = await r.json();
  assert.equal(merged.edition.clips.length, 4);
  assert.equal(merged.edition.featured, "LegacyAnchor");
  const row = await db
    .prepare("SELECT * FROM editions WHERE date='2039-02-03'")
    .first<any>();
  assert.equal(row.revision, 1);
  assert.equal(JSON.parse(row.published).clips.length, 1);
  assert.match(
    await (await runtime.dispatchFetch(base + "/dia/2039-02-03")).text(),
    /clip-LegacyAnchor/,
  );
});
test("update transaction rolls back cursor and effects on storage failure; retry applies once", async () => {
  const db = await runtime.getD1Database("DB");
  await db.exec(
    "CREATE TRIGGER reject_reply BEFORE INSERT ON telegram_outbox BEGIN SELECT RAISE(ABORT,'fixture'); END;",
  );
  assert.equal(
    (
      await update(13, {
        message: message("https://clips.twitch.tv/AtomicCapture"),
      })
    ).status,
    409,
  );
  assert.equal(
    await db
      .prepare(
        "SELECT count(*) FROM manual_candidates WHERE id='AtomicCapture'",
      )
      .first("count(*)"),
    0,
  );
  assert.equal(
    await db.prepare("SELECT cursor FROM telegram_receiver").first("cursor"),
    13,
  );
  await db.exec("DROP TRIGGER reject_reply;");
  assert.equal(
    (
      await update(13, {
        message: message("https://clips.twitch.tv/AtomicCapture"),
      })
    ).status,
    200,
  );
});
test("outbox backoff, expired lease exclusion and persistent cursor survive Worker restart", async () => {
  const db = await runtime.getD1Database("DB");
  const queue: any = await (await bridge("outbox")).json();
  assert.ok(queue.length > 0);
  await bridge("ack", { id: queue[0].id, ok: false, retryAfter: 30 });
  assert.ok(
    (await db
      .prepare("SELECT next_at FROM telegram_outbox WHERE id=?")
      .bind(queue[0].id)
      .first<number>("next_at"))! >=
      Date.now() + 29000,
  );
  await db.prepare("UPDATE telegram_receiver SET expires_at=0").run();
  assert.equal(
    (
      await bridge("update", {
        update: { update_id: 14, message: message("/estado") },
      })
    ).status,
    409,
  );
  assert.equal((await bridge("lease", { owner: other })).status, 200);
  assert.equal((await bridge("lease")).status, 409);
  await runtime.dispose();
  runtime = localRuntime();
  const restored = await runtime.getD1Database("DB");
  assert.equal(
    await restored
      .prepare("SELECT cursor FROM telegram_receiver")
      .first("cursor"),
    14,
  );
  await restored.prepare("UPDATE telegram_receiver SET expires_at=0").run();
  await bridge("lease");
  assert.equal(
    (
      await update(13, {
        message: message("https://clips.twitch.tv/AtomicCapture"),
      })
    ).status,
    200,
  );
  assert.equal(
    await restored
      .prepare(
        "SELECT count(*) FROM manual_candidates WHERE id='AtomicCapture'",
      )
      .first("count(*)"),
    1,
  );
});
test("mocked Telegram runner only responds to authorized updates and resumes durable outbox", async () => {
  await bridge("release");
  const calls: { method: string; payload: any }[] = [];
  const config = runnerConfig({
    TELEGRAM_BOT_TOKEN: "123:fixture_token_only_not_real_12345",
    TELEGRAM_OWNER_CHAT_ID: "101",
    TELEGRAM_OWNER_USER_ID: "102",
    LOCAL_BRIDGE_SECRET: secret,
    LOCAL_BRIDGE_ORIGIN: base,
  });
  const runner = createRunner(config, (async (input: any, init: any) => {
    const url = String(input);
    if (url.startsWith(base)) {
      const r = await runtime.dispatchFetch(url, init);
      return new Response(await r.text(), {
        status: r.status,
        headers: { "Content-Type": "application/json" },
      });
    }
    assert.ok(url.startsWith("https://api.telegram.org/"));
    const method = new URL(url).pathname.split("/").pop()!,
      payload = JSON.parse(init.body);
    calls.push({ method, payload });
    if (method === "getUpdates")
      return Response.json({
        ok: true,
        result: [
          {
            update_id: 14,
            message: {
              ...message("https://clips.twitch.tv/Unauthorized"),
              from: { id: 999 },
            },
          },
          { update_id: 15, message: message("/estado") },
        ],
      });
    assert.equal(method, "sendMessage");
    assert.equal(payload.chat_id, "101");
    return Response.json({ ok: true, result: { message_id: 1 } });
  }) as typeof fetch);
  await runner.cycle();
  assert.equal(
    calls.find((c) => c.method === "getUpdates")!.payload.offset,
    14,
  );
  assert.ok(calls.some((c) => c.method === "sendMessage"));
  const db = await runtime.getD1Database("DB");
  assert.equal(
    await db
      .prepare("SELECT count(*) FROM manual_candidates WHERE id='Unauthorized'")
      .first("count(*)"),
    0,
  );
  assert.equal(
    await db.prepare("SELECT cursor FROM telegram_receiver").first("cursor"),
    16,
  );
  await runner.internal("release");
});

test("bot five-source selection, reordering, category, prepare and cancel never mutate editions", async () => {
  await bridge("lease");
  let sequence = 100;
  const db = await runtime.getD1Database("DB");
  const send = async (text: string) => {
    const id = sequence++;
    assert.equal((await update(id, { message: message(text) })).status, 200);
    return JSON.parse(
      (await db
        .prepare("SELECT payload FROM telegram_outbox WHERE update_id=?")
        .bind(id)
        .first<string>("payload"))!,
    );
  };
  const click = async (data: string) => {
    assert.equal(
      (
        await update(sequence++, {
          callback_query: {
            from: { id: 102 },
            message: message("reply"),
            data,
          },
        })
      ).status,
      200,
    );
  };
  await send("/edicion 2039-05-01");
  const urls = [
    "https://clips.twitch.tv/Five1",
    "https://clips.twitch.tv/Five2",
    "https://youtu.be/abcdefghijk",
    "https://youtu.be/abcdefghijl",
    "https://x.com/demo/status/123",
  ];
  for (const url of urls) {
    const r = await send(url);
    await click(r.reply_markup.inline_keyboard[0][0].callback_data);
  }
  let selected = JSON.parse(
    (await db
      .prepare("SELECT ids FROM manual_selections WHERE date='2039-05-01'")
      .first<string>("ids"))!,
  );
  assert.equal(selected.length, 5);
  let r = await send("/seleccion");
  await click(r.reply_markup.inline_keyboard[9][1].callback_data);
  selected = JSON.parse(
    (await db
      .prepare("SELECT ids FROM manual_selections WHERE date='2039-05-01'")
      .first<string>("ids"))!,
  );
  assert.equal(selected[3], "x:123");
  r = await send("/seleccion");
  await click(r.reply_markup.inline_keyboard[0][1].callback_data);
  assert.equal(
    await db
      .prepare("SELECT category FROM manual_candidates WHERE id='Five1'")
      .first("category"),
    "Jugadas",
  );
  r = await send("/seleccion");
  await click(r.reply_markup.inline_keyboard[0][2].callback_data);
  await send("/cancelar");
  assert.equal(
    await db
      .prepare("SELECT pending_candidate FROM telegram_receiver")
      .first("pending_candidate"),
    null,
  );
  await send("/preparar");
  assert.equal(
    await db
      .prepare("SELECT prepared FROM manual_selections WHERE date='2039-05-01'")
      .first("prepared"),
    1,
  );
  assert.equal(
    await db
      .prepare("SELECT count(*) FROM editions WHERE date='2039-05-01'")
      .first("count(*)"),
    0,
  );
  await bridge("release");
});

test("mocked Telegram rate limit defers durable reply; restart drains without repeated editorial effects", async () => {
  const db = await runtime.getD1Database("DB");
  await db.prepare("UPDATE telegram_outbox SET delivered=1").run();
  await bridge("lease");
  await update(200, { message: message("/estado") });
  await bridge("release");
  let sends = 0;
  const config = runnerConfig({
    TELEGRAM_BOT_TOKEN: "123:fixture_token_only_not_real_12345",
    TELEGRAM_OWNER_CHAT_ID: "101",
    TELEGRAM_OWNER_USER_ID: "102",
    LOCAL_BRIDGE_SECRET: secret,
    LOCAL_BRIDGE_ORIGIN: base,
  });
  const transport = (async (input: any, init: any) => {
    const url = String(input);
    if (url.startsWith(base)) {
      const r = await runtime.dispatchFetch(url, init);
      return new Response(await r.text(), {
        status: r.status,
        headers: { "Content-Type": "application/json" },
      });
    }
    sends++;
    return sends === 1
      ? Response.json(
          { ok: false, parameters: { retry_after: 40 } },
          { status: 429 },
        )
      : Response.json({ ok: true });
  }) as typeof fetch;
  let runner = createRunner(config, transport);
  await runner.cycle(false);
  assert.equal(sends, 1);
  await runner.cycle(false);
  assert.equal(sends, 1);
  const row = await db
    .prepare(
      "SELECT attempts,next_at,delivered FROM telegram_outbox WHERE update_id=200",
    )
    .first<any>();
  assert.equal(row.attempts, 1);
  assert.equal(row.delivered, 0);
  assert.ok(row.next_at > Date.now() + 39000);
  await runner.internal("release");
  await db
    .prepare("UPDATE telegram_outbox SET next_at=0 WHERE update_id=200")
    .run();
  runner = createRunner(config, transport);
  await runner.cycle(false);
  assert.equal(sends, 2);
  assert.equal(
    await db
      .prepare("SELECT delivered FROM telegram_outbox WHERE update_id=200")
      .first("delivered"),
    1,
  );
  await runner.internal("release");
});

test("private preview is available without publication; status is read-only even with another receiver", async () => {
  const response = await runtime.dispatchFetch(
    base + "/admin/inbox/preview?id=youtube%3Aabcdefghijk",
  );
  assert.equal(response.status, 200);
  assert.match(await response.text(), /data-provider="youtube"/);
  await bridge("lease");
  const status: any = await (await bridge("health", { owner: other })).json();
  assert.equal(status.running, true);
  assert.equal(status.cursor, 201);
  assert.equal((await bridge("lease", { owner: other })).status, 409);
  assert.equal(
    (
      await post("/internal/telegram/update", {
        owner,
        update: { update_id: 201 },
        padding: "x".repeat(65536),
      })
    ).status,
    413,
  );
  assert.equal(
    (await post("/internal/telegram/health", { owner }, false)).status,
    401,
  );
  await bridge("release");
});

test("one five-link message stays selectable through fresh batch controls and links do not swallow pending context", async () => {
  await bridge("lease");
  const db = await runtime.getD1Database("DB");
  let sequence = 300;
  const deliver = async (extra: Record<string, unknown>) => {
    const id = sequence++;
    assert.equal((await update(id, extra)).status, 200);
    return JSON.parse(
      (await db
        .prepare("SELECT payload FROM telegram_outbox WHERE update_id=?")
        .bind(id)
        .first<string>("payload"))!,
    );
  };
  const tap = (data: string) =>
    deliver({
      callback_query: { from: { id: 102 }, message: message("board"), data },
    });
  await deliver({ message: message("/edicion 2039-08-01") });
  const urls = [
    "https://clips.twitch.tv/BatchOne",
    "https://clips.twitch.tv/BatchTwo",
    "https://youtu.be/abcdefghijm",
    "https://youtu.be/abcdefghijn",
    "https://x.com/demo/status/987654321",
  ];
  let response = await deliver({ message: message(urls.join("\n")) });
  const stale = response.reply_markup.inline_keyboard[0][0].callback_data;
  for (let i = 0; i < 5; i++) {
    response = await tap(
      response.reply_markup.inline_keyboard[i * 2][0].callback_data,
    );
    assert.equal(response.reply_markup.inline_keyboard.length, 10);
    const stored = await db
      .prepare("SELECT ids FROM manual_selections WHERE date='2039-08-01'")
      .first<string>("ids");
    assert.equal(JSON.parse(stored!).length, i + 1);
  }
  const selection = await db
    .prepare("SELECT * FROM manual_selections WHERE date='2039-08-01'")
    .first<any>();
  assert.deepEqual(JSON.parse(selection.ids), [
    "BatchOne",
    "BatchTwo",
    "youtube:abcdefghijm",
    "youtube:abcdefghijn",
    "x:987654321",
  ]);
  // Candidate-only changes refresh every board member without invalidating the list.
  response = await tap(
    response.reply_markup.inline_keyboard[0][1].callback_data,
  );
  assert.equal(
    await db
      .prepare("SELECT revision FROM manual_selections WHERE date='2039-08-01'")
      .first("revision"),
    selection.revision,
  );
  const contextToken =
    response.reply_markup.inline_keyboard[0][2].callback_data;
  await tap(contextToken);
  const before = await db
    .prepare("SELECT text FROM manual_candidates WHERE id='BatchOne'")
    .first("text");
  await deliver({
    message: {
      ...message("https://clips.twitch.tv/BatchLater"),
      forward_origin: { type: "user" },
    },
  });
  assert.ok(
    await db
      .prepare("SELECT id FROM manual_candidates WHERE id='BatchLater'")
      .first(),
  );
  assert.equal(
    await db
      .prepare("SELECT pending_candidate FROM telegram_receiver")
      .first("pending_candidate"),
    "BatchOne",
  );
  assert.equal(
    await db
      .prepare("SELECT text FROM manual_candidates WHERE id='BatchOne'")
      .first("text"),
    before,
  );
  await deliver({
    message: message("El contexto sigue pendiente hasta este texto editorial"),
  });
  assert.equal(
    await db
      .prepare("SELECT text FROM manual_candidates WHERE id='BatchOne'")
      .first("text"),
    "El contexto sigue pendiente hasta este texto editorial",
  );
  assert.match((await tap(stale)).text, /caducado/);
  assert.equal(
    await db
      .prepare("SELECT count(*) FROM editions WHERE date='2039-08-01'")
      .first("count(*)"),
    0,
  );
  await bridge("release");
});

test("runner acknowledges only owner callbacks after durable processing even when acknowledgement fails", async () => {
  const db = await runtime.getD1Database("DB");
  const data = await db
    .prepare(
      "SELECT token FROM telegram_buttons WHERE candidate='BatchLater' AND action='toggle' ORDER BY rowid DESC LIMIT 1",
    )
    .first<string>("token");
  const config = runnerConfig({
    TELEGRAM_BOT_TOKEN: "123:fixture_token_only_not_real_12345",
    TELEGRAM_OWNER_CHAT_ID: "101",
    TELEGRAM_OWNER_USER_ID: "102",
    LOCAL_BRIDGE_SECRET: secret,
    LOCAL_BRIDGE_ORIGIN: base,
  });
  const calls: { method: string; payload: any }[] = [];
  const runner = createRunner(config, (async (input: any, init: any) => {
    const url = String(input);
    if (url.startsWith(base)) {
      const r = await runtime.dispatchFetch(url, init);
      return new Response(await r.text(), {
        status: r.status,
        headers: { "Content-Type": "application/json" },
      });
    }
    const method = new URL(url).pathname.split("/").pop()!,
      payload = JSON.parse(init.body);
    calls.push({ method, payload });
    if (method === "getUpdates")
      return Response.json({
        ok: true,
        result: [
          {
            update_id: 400,
            callback_query: {
              id: "unauthorized-callback",
              from: { id: 999 },
              message: message("board"),
              data,
            },
          },
          {
            update_id: 401,
            callback_query: {
              id: "owner-callback",
              from: { id: 102 },
              message: message("board"),
              data,
            },
          },
        ],
      });
    if (method === "answerCallbackQuery") {
      assert.equal(payload.callback_query_id, "owner-callback");
      assert.ok(
        await db
          .prepare("SELECT update_id FROM telegram_updates WHERE update_id=401")
          .first(),
      );
      throw Error("fixture acknowledgement unavailable");
    }
    assert.equal(method, "sendMessage");
    assert.equal(payload.chat_id, "101");
    return Response.json({ ok: true });
  }) as typeof fetch);
  await runner.cycle();
  assert.equal(
    calls.filter((c) => c.method === "answerCallbackQuery").length,
    1,
  );
  assert.equal(
    await db.prepare("SELECT cursor FROM telegram_receiver").first("cursor"),
    402,
  );
  assert.equal(
    await db
      .prepare("SELECT delivered FROM telegram_outbox WHERE update_id=401")
      .first("delivered"),
    1,
  );
  assert.equal(
    await db
      .prepare("SELECT count(*) FROM telegram_outbox WHERE update_id=400")
      .first("count(*)"),
    0,
  );
  await runner.internal("release");
});

test("committed replies drain before a failing poll and remain delivered", async () => {
  const db = await runtime.getD1Database("DB");
  await db.prepare("UPDATE telegram_outbox SET delivered=1").run();
  await bridge("lease");
  await update(500, { message: message("/estado") });
  await bridge("release");
  const config = runnerConfig({
    TELEGRAM_BOT_TOKEN: "123:fixture_token_only_not_real_12345",
    TELEGRAM_OWNER_CHAT_ID: "101",
    TELEGRAM_OWNER_USER_ID: "102",
    LOCAL_BRIDGE_SECRET: secret,
    LOCAL_BRIDGE_ORIGIN: base,
  });
  const calls: string[] = [];
  const runner = createRunner(config, (async (input: any, init: any) => {
    const url = String(input);
    if (url.startsWith(base)) {
      const r = await runtime.dispatchFetch(url, init);
      return new Response(await r.text(), {
        status: r.status,
        headers: { "Content-Type": "application/json" },
      });
    }
    const method = new URL(url).pathname.split("/").pop()!;
    calls.push(method);
    if (method === "getUpdates") throw Error("fixture polling unavailable");
    assert.equal(method, "sendMessage");
    return Response.json({ ok: true });
  }) as typeof fetch);
  await assert.rejects(runner.cycle());
  assert.deepEqual(calls, ["sendMessage", "getUpdates"]);
  assert.equal(
    await db
      .prepare("SELECT delivered FROM telegram_outbox WHERE update_id=500")
      .first("delivered"),
    1,
  );
  await runner.internal("release");
});
