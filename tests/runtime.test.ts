import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { readFile, mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { build } from "esbuild";
import {
  Miniflare,
  convertV4MiniflareOptions,
  Response as MFResponse,
} from "miniflare";
import { generateKeyPair, exportJWK, SignJWT } from "jose";
import { validate, twitch } from "../src/model";
let mf: Miniflare, local: Miniflare, dir: string, key: CryptoKey, token: string;
const issuer = "https://test-team.cloudflareaccess.com",
  base = "https://example.com";
const edition = (date = "2035-01-01") => ({
  date,
  title: "Demo editorial",
  intro: "Prueba <script>alert(1)</script>",
  hook: "Cinco momentos de prueba",
  demo: true,
  reviewed: false,
  featured: "Demo0",
  clips: Array.from({ length: 5 }, (_, i) => ({
    url: `https://clips.twitch.tv/Demo${i}`,
    streamer: `Demo ${i}`,
    title: `Clip ${i}`,
    text: "Contexto de demostración",
    category: "Fails",
  })),
});
async function jwt(overrides: Record<string, unknown> = {}, signKey = key) {
  return new SignJWT({
    iss: issuer,
    aud: "aud-test",
    sub: "test-editor",
    iat: Math.floor(Date.now() / 1000),
    exp: Math.floor(Date.now() / 1000) + 600,
    ...overrides,
  })
    .setProtectedHeader({ alg: "RS256", kid: "test-key" })
    .sign(signKey);
}
async function request(
  path: string,
  body?: unknown,
  headers: Record<string, string> = {},
) {
  return mf.dispatchFetch(base + path, {
    method: body ? "POST" : "GET",
    headers: {
      "Cf-Access-Jwt-Assertion": token,
      ...(body ? { "Content-Type": "application/json", Origin: base } : {}),
      ...headers,
    },
    body: body ? JSON.stringify(body) : undefined,
  });
}
before(async () => {
  dir = await mkdtemp(join(tmpdir(), "gtaklips-test-"));
  const pair = await generateKeyPair("RS256");
  key = pair.privateKey;
  const jwk = {
    ...(await exportJWK(pair.publicKey)),
    kid: "test-key",
    alg: "RS256",
  };
  token = await jwt();
  for (const entry of ["index", "local"])
    await build({
      entryPoints: [`src/${entry}.ts`],
      outfile: join(dir, `${entry}.js`),
      bundle: true,
      format: "esm",
      platform: "browser",
      target: "es2022",
    });
  mf = new Miniflare(
    convertV4MiniflareOptions({
      modules: true,
      script: await readFile(join(dir, "index.js"), "utf8"),
      compatibilityDate: "2026-11-01",
      d1Databases: ["DB"],
      resourcePersistencePath: join(dir, "db"),
      bindings: {
        PUBLIC_ORIGIN: base,
        ACCESS_ISSUER: issuer,
        ACCESS_AUDIENCE: "aud-test",
        LOCAL_DEVELOPMENT: "explicit-loopback-only",
      },
      outboundService: () =>
        new MFResponse(JSON.stringify({ keys: [jwk] }), {
          headers: { "Content-Type": "application/json" },
        }),
    }),
  );
  local = new Miniflare(
    convertV4MiniflareOptions({
      modules: true,
      script: await readFile(join(dir, "local.js"), "utf8"),
      compatibilityDate: "2026-11-01",
      d1Databases: ["DB"],
      bindings: {
        PUBLIC_ORIGIN: "http://127.0.0.1:8787",
        LOCAL_DEVELOPMENT: "explicit-loopback-only",
      },
    }),
  );
  const sql = (
    await Promise.all(
      [
        "0001_editions.sql",
        "0002_twitch.sql",
        "0003_candidate_thumbnails.sql",
      ].map((name) => readFile("migrations/" + name, "utf8")),
    )
  ).join("\n");
  for (const runtime of [mf, local])
    await (await runtime.getD1Database("DB")).exec(sql.replace(/\n/g, " "));
});
after(async () => {
  await mf?.dispose();
  await local?.dispose();
  if (dir) await rm(dir, { recursive: true, force: true });
});
test("strict URL and input validation", () => {
  for (const url of [
    "http://clips.twitch.tv/abc",
    "https://clips.twitch.tv.evil.org/abc",
    "https://user@clips.twitch.tv/abc",
    "https://clips.twitch.tv/abc?x=1",
    "https://www.twitch.tv/a",
    "https://clips.twitch.tv/a/b",
    "javascript:alert(1)",
    "https://clips.twitch.tv/a#x",
  ])
    assert.throws(() => twitch(url));
  assert.equal(
    twitch("https://www.twitch.tv/demo/clip/Safe_123").id,
    "Safe_123",
  );
  for (const patch of [
    { date: "2035-02-30" },
    { featured: "missing" },
    { clips: [] },
    { title: "x".repeat(101) },
    { demo: "true" },
    { clips: [edition().clips[0], edition().clips[0]] },
  ])
    assert.throws(() => validate({ ...edition(), ...patch }));
  assert.throws(() => validate({ ...edition(), demo: false }, true));
  assert.doesNotThrow(() =>
    validate({ ...edition(), demo: false, reviewed: true }, true),
  );
});
test("Access signature, issuer, audience, expiry and fail-closed production", async () => {
  assert.equal((await request("/admin")).status, 200);
  for (const value of [
    "",
    "forged",
    await jwt({ iss: "https://evil.example" }),
    await jwt({ aud: "wrong" }),
    await jwt({ exp: 1 }),
    await jwt({ nbf: Math.floor(Date.now() / 1000) + 600 }),
    await jwt({}, (await generateKeyPair("RS256")).privateKey),
  ]) {
    for (const path of [
      "/admin",
      "/admin/data?date=2035-01-01",
      "/admin/editor.js",
      "/admin/post?date=2035-01-01",
      "/admin/editions",
    ])
      assert.equal(
        (await request(path, undefined, { "Cf-Access-Jwt-Assertion": value }))
          .status,
        401,
      );
    for (const path of ["/admin/save", "/admin/publish", "/admin/withdraw"])
      assert.equal(
        (await request(path, {}, { "Cf-Access-Jwt-Assertion": value })).status,
        401,
      );
  }
  assert.equal(
    (await mf.dispatchFetch("http://127.0.0.1:8787/admin")).status,
    401,
  );
  assert.equal(
    (await local.dispatchFetch("http://127.0.0.1:8787/admin")).status,
    200,
  );
  assert.equal(
    (await local.dispatchFetch("https://public.example/admin")).status,
    401,
  );
  assert.equal(
    (await local.dispatchFetch("http://127.0.0.1.evil.example/admin")).status,
    401,
  );
});
test("D1 migration, private drafts, atomic publish, concurrency, snapshot separation and withdrawal", async () => {
  const e = edition();
  let r = await request("/admin/save", { edition: e, revision: 0 });
  assert.equal(r.status, 200);
  assert.deepEqual(await r.json(), { revision: 1 });
  assert.equal((await request("/dia/" + e.date)).status, 404);
  for (const path of ["/", "/archivo", "/sitemap.xml"])
    assert.ok(!(await (await request(path)).text()).includes(e.date));
  assert.equal((await request("/admin/post?date=" + e.date)).status, 409);
  assert.equal(
    (await request("/admin/publish", { edition: e, revision: 0 })).status,
    409,
  );
  assert.equal(
    (
      await request("/admin/publish", {
        edition: { ...e, featured: "missing" },
        revision: 1,
      })
    ).status,
    400,
  );
  assert.equal((await request("/dia/" + e.date)).status, 404);
  const concurrent = await Promise.all([
    request("/admin/publish", { edition: e, revision: 1 }),
    request("/admin/publish", { edition: e, revision: 1 }),
  ]);
  assert.deepEqual(concurrent.map((r) => r.status).sort(), [200, 409]);
  const html = await (await request("/dia/" + e.date + "?utm_source=x")).text();
  assert.ok(html.includes("&lt;script&gt;"));
  assert.ok(!html.includes("<script>alert"));
  assert.ok(html.includes(`href="${base}/dia/${e.date}"`));
  assert.ok(html.includes("DEMO"));
  assert.ok((await (await request("/sitemap.xml")).text()).includes(e.date));
  r = await request("/admin/save", {
    edition: { ...e, title: "PRIVATE DRAFT CHANGE" },
    revision: 2,
  });
  assert.equal(r.status, 200);
  assert.ok(
    !(await (await request("/dia/" + e.date)).text()).includes(
      "PRIVATE DRAFT CHANGE",
    ),
  );
  const social: any = await (
    await request("/admin/post?date=" + e.date)
  ).json();
  assert.ok(social.post.includes("5 clips"));
  assert.ok(social.url.endsWith("#clip-Demo0"));
  assert.ok(social.url.includes("utm_source=x"));
  r = await request("/admin/withdraw", {
    date: e.date,
    id: "Demo0",
    revision: 3,
  });
  assert.equal(r.status, 200);
  const removed = await (await request("/dia/" + e.date)).text();
  assert.ok(!removed.includes('id="clip-Demo0"'));
  assert.ok(removed.includes('id="clip-Demo1"'));
  assert.ok(removed.includes("4 clips"));
  assert.equal(
    (
      await request("/admin/withdraw", {
        date: e.date,
        id: "Demo1",
        revision: 3,
      })
    ).status,
    409,
  );
  for (let i = 1; i < 5; i++)
    assert.equal(
      (
        await request("/admin/withdraw", {
          date: e.date,
          id: "Demo" + i,
          revision: 3 + i,
        })
      ).status,
      200,
    );
  assert.equal((await request("/admin/post?date=" + e.date)).status, 409);
  assert.equal((await request("/dia/" + e.date)).status, 200);
  const db = await mf.getD1Database("DB");
  assert.equal(
    (await db.prepare("SELECT count(*) AS n FROM editions").first<any>()).n,
    1,
  );
});
test("write guards and bounded payloads reject CSRF and invalid content", async () => {
  const payload = { edition: edition("2035-01-02"), revision: 0 };
  for (const Origin of ["https://evil.example", "null", ""])
    assert.equal(
      (await request("/admin/save", payload, { Origin })).status,
      403,
    );
  assert.equal(
    (await request("/admin/save", payload, { "Sec-Fetch-Site": "cross-site" }))
      .status,
    403,
  );
  assert.equal(
    (await request("/admin/save", payload, { "Content-Type": "text/plain" }))
      .status,
    400,
  );
  assert.equal(
    (await request("/admin/save", { ...payload, padding: "a".repeat(25000) }))
      .status,
    400,
  );
  assert.equal(
    (
      await request("/admin/save", {
        ...payload,
        edition: { ...payload.edition, title: "a".repeat(101) },
      })
    ).status,
    400,
  );
  assert.equal(
    (
      await request("/admin/save", {
        ...payload,
        edition: {
          ...payload.edition,
          clips: [
            { ...payload.edition.clips[0], url: "https://evil.example/clip" },
          ],
        },
      })
    ).status,
    400,
  );
  assert.equal(
    (await request("/admin/save", { ...payload, revision: -1 })).status,
    400,
  );
});
test("D1 persists across runtime restarts; missing production Access config stays closed", async () => {
  await mf.dispose();
  mf = new Miniflare(
    convertV4MiniflareOptions({
      modules: true,
      script: await readFile(join(dir, "index.js"), "utf8"),
      compatibilityDate: "2026-11-01",
      d1Databases: ["DB"],
      resourcePersistencePath: join(dir, "db"),
      bindings: {
        PUBLIC_ORIGIN: base,
        LOCAL_DEVELOPMENT: "explicit-loopback-only",
      },
    }),
  );
  assert.equal((await mf.dispatchFetch(base + "/dia/2035-01-01")).status, 200);
  assert.equal((await mf.dispatchFetch(base + "/admin")).status, 401);
  const row = await (
    await mf.getD1Database("DB")
  )
    .prepare("SELECT draft, published FROM editions WHERE date=?")
    .bind("2035-01-01")
    .first<any>();
  assert.equal(JSON.parse(row.draft).clips.length, 0);
  assert.equal(JSON.parse(row.published).clips.length, 0);
});
