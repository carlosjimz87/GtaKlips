import { test, before, after, mock } from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { Miniflare, convertV4MiniflareOptions } from "miniflare";
import type { Env } from "../src/auth";
import { xDrafts, xPublish } from "../src/x-admin";

let mf: Miniflare, db: Env["DB"];
const O = "https://g.example";
const edition = {
  date: "2026-11-20",
  clips: [
    {
      id: "c1",
      url: "https://clips.twitch.tv/Abc",
      streamer: "ibai",
      title: "Gran jugada",
      text: "Texto",
      category: "Jugadas",
    },
  ],
  featured: "c1",
};
before(async () => {
  mf = new Miniflare(
    convertV4MiniflareOptions({
      modules: true,
      script: "export default{fetch(){return new Response('')}}",
      compatibilityDate: "2026-11-01",
      d1Databases: ["DB"],
    }),
  );
  db = (await mf.getD1Database("DB")) as unknown as Env["DB"];
  const sql = (
    await Promise.all(
      [
        "0001_editions.sql",
        "0002_twitch.sql",
        "0003_candidate_thumbnails.sql",
        "0004_manual_inbox.sql",
        "0005_x_enrichment.sql",
        "0007_x_posts.sql",
      ].map((n) => readFile("migrations/" + n, "utf8")),
    )
  ).join("\n");
  await (db as any).exec(sql.replace(/\n/g, " "));
  await db
    .prepare(
      "INSERT INTO editions(date,draft,published,revision) VALUES(?,?,?,1)",
    )
    .bind(edition.date, "{}", JSON.stringify(edition))
    .run();
  await db
    .prepare(
      "INSERT INTO manual_candidates(id,provider,source_id,url,captured_date,created_at) VALUES('k1','youtube','abc','https://youtu.be/abc','2026-11-20','2026-11-20T10:00:00Z')",
    )
    .run();
});
after(() => mf?.dispose());

test("drafts: top for featured clip and a creator hunt for candidates with no creator", async () => {
  const r = await xDrafts({ DB: db, PUBLIC_ORIGIN: O }, edition.date, O);
  assert.equal(r.publishEnabled, false);
  assert.deepEqual(
    r.drafts.map((d) => [d.kind, d.ref, d.state]),
    [
      ["top", "2026-11-20:c1", "draft"],
      ["creator_hunt", "k1", "draft"],
    ],
  );
});

test("without credentials publishing is a dry-run and records nothing", async () => {
  const f = mock.method(globalThis, "fetch", async () => new Response("{}"));
  const env = { DB: db, PUBLIC_ORIGIN: O } as Env;
  const r = await xPublish(
    env,
    { date: edition.date, kind: "top", ref: "2026-11-20:c1", confirm: true },
    O,
  );
  assert.equal((r as any).mode, "dry-run");
  assert.equal(f.mock.callCount(), 0);
  await assert.rejects(
    xPublish(env, { date: edition.date, kind: "top", ref: "2026-11-20:c1" }, O),
    /confirmación/,
  );
  f.mock.restore();
});

test("enabled publish posts once, records it and rejects a second attempt", async () => {
  let n = 0;
  const f = mock.method(
    globalThis,
    "fetch",
    async () => new Response(JSON.stringify({ data: { id: String(++n) } })),
  );
  const env = {
    DB: db,
    PUBLIC_ORIGIN: O,
    X_ACCESS_TOKEN: "t",
    X_PUBLISH_ENABLED: "true",
  } as Env;
  const v = {
    date: edition.date,
    kind: "creator_hunt" as const,
    ref: "k1",
    confirm: true,
  };
  const r = await xPublish(env, v, O);
  assert.equal((r as any).mode, "published");
  assert.equal(f.mock.callCount(), 2); // post + self-reply
  await assert.rejects(xPublish(env, v, O), /Ya publicado/);
  assert.equal(f.mock.callCount(), 2);
  const after = await xDrafts(env, edition.date, O);
  assert.equal(after.drafts.find((d) => d.ref === "k1")!.state, "published");
  f.mock.restore();
});

test("a failed API call is recorded and can be retried", async () => {
  const f = mock.method(
    globalThis,
    "fetch",
    async () => new Response("no", { status: 500 }),
  );
  const env = {
    DB: db,
    PUBLIC_ORIGIN: O,
    X_ACCESS_TOKEN: "t",
    X_PUBLISH_ENABLED: "true",
  } as Env;
  const v = {
    date: edition.date,
    kind: "top" as const,
    ref: "2026-11-20:c1",
    confirm: true,
  };
  await assert.rejects(xPublish(env, v, O), /X API 500/);
  f.mock.restore();
  let n = 0;
  mock.method(
    globalThis,
    "fetch",
    async () => new Response(JSON.stringify({ data: { id: String(++n) } })),
  );
  assert.equal(((await xPublish(env, v, O)) as any).mode, "published");
  mock.restoreAll();
});

test("drafts: a chosen clip replaces the featured one", async () => {
  const two = {
    ...edition,
    date: "2026-11-22",
    clips: [
      ...edition.clips,
      { ...edition.clips[0], id: "c2", title: "Otra jugada" },
    ],
  };
  await db
    .prepare(
      "INSERT INTO editions(date,draft,published,revision) VALUES(?,?,?,1)",
    )
    .bind(two.date, "{}", JSON.stringify(two))
    .run();
  const r = await xDrafts({ DB: db, PUBLIC_ORIGIN: O }, two.date, O, "c2");
  const top = r.drafts.find((d) => d.kind === "top");
  assert.equal(top?.ref, "2026-11-22:c2");
  assert.match(top!.text, /Otra jugada/);
});

test("publish rejects an empty or over-long text override", async () => {
  const env = { DB: db, PUBLIC_ORIGIN: O } as Env;
  for (const text of ["  ", "x".repeat(400)])
    await assert.rejects(
      xPublish(
        env,
        {
          date: edition.date,
          kind: "top",
          ref: "2026-11-20:c1",
          text,
          confirm: true,
        },
        O,
      ),
      /Texto de X/,
    );
});
