import { test, before, after, mock } from "node:test";
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
import { importTwitch, type ImportRun } from "../src/importer";
import type { Env } from "../src/auth";
let mf: Miniflare,
  dir: string,
  token: string,
  db: Awaited<ReturnType<Miniflare["getD1Database"]>>;
const base = "https://example.com",
  issuer = "https://import-test.cloudflareaccess.com";
const secret = "fixture-secret-do-not-log",
  accessToken = "fixture-token-do-not-log";
let scenario = "normal",
  views = 10,
  clipPage = 0,
  calls: { url: URL; method: string; body: string; redirect: string }[] = [];
let entered: (() => void) | undefined, release: (() => void) | undefined;
const reply = (body: unknown, status = 200) =>
  new MFResponse(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
function clip(url: URL, id = "ImportDemo", patch = {}) {
  return {
    id,
    url: "https://clips.twitch.tv/" + id,
    broadcaster_name: "<script>Private creator</script>",
    title: "Private candidate <img src=x>",
    language: "es",
    game_id: "123456",
    created_at: new Date(
      Date.parse(url.searchParams.get("ended_at")!) - 1000,
    ).toISOString(),
    duration: 22.5,
    view_count: views,
    ...patch,
  };
}
async function request(path: string, payload?: unknown, headers = {}) {
  return mf.dispatchFetch(base + path, {
    method: payload ? "POST" : "GET",
    headers: {
      "Cf-Access-Jwt-Assertion": token,
      ...(payload ? { Origin: base, "Content-Type": "application/json" } : {}),
      ...headers,
    },
    body: payload ? JSON.stringify(payload) : undefined,
  });
}
async function run(mode = "normal") {
  scenario = mode;
  calls = [];
  clipPage = 0;
  const r = await request("/admin/import", {});
  assert.equal(r.status, 200);
  return (await r.json()) as ImportRun;
}
const legacy = {
  date: "2035-01-01",
  title: "Stage one preserved",
  intro: "Original",
  hook: "Original",
  demo: true,
  reviewed: false,
  featured: "LegacyDemo",
  clips: [
    {
      id: "LegacyDemo",
      url: "https://clips.twitch.tv/LegacyDemo",
      streamer: "Legacy",
      title: "Legacy",
      text: "Original context",
      category: "Fails",
    },
  ],
};
before(async () => {
  dir = await mkdtemp(join(tmpdir(), "gtaklips-import-"));
  await build({
    entryPoints: ["src/index.ts"],
    outfile: join(dir, "worker.js"),
    bundle: true,
    format: "esm",
    platform: "browser",
    target: "es2022",
  });
  const keys = await generateKeyPair("RS256");
  const jwk = {
    ...(await exportJWK(keys.publicKey)),
    kid: "import-test",
    alg: "RS256",
  };
  token = await new SignJWT({})
    .setProtectedHeader({ alg: "RS256", kid: "import-test" })
    .setIssuer(issuer)
    .setAudience("editor")
    .setSubject("editor")
    .setIssuedAt()
    .setExpirationTime("1h")
    .sign(keys.privateKey);
  mf = new Miniflare(
    convertV4MiniflareOptions({
      modules: true,
      script: await readFile(join(dir, "worker.js"), "utf8"),
      compatibilityDate: "2026-11-01",
      d1Databases: ["DB"],
      bindings: {
        PUBLIC_ORIGIN: base,
        ACCESS_ISSUER: issuer,
        ACCESS_AUDIENCE: "editor",
        TWITCH_CLIENT_ID: "fixture-client",
        TWITCH_CLIENT_SECRET: secret,
      },
      outboundService: async (req) => {
        const url = new URL(req.url);
        if (url.origin === issuer && url.pathname === "/cdn-cgi/access/certs")
          return reply({ keys: [jwk] });
        calls.push({
          url,
          method: req.method,
          body: await req.text(),
          redirect: req.redirect,
        });
        assert.ok(
          ["https://id.twitch.tv", "https://api.twitch.tv"].includes(
            url.origin,
          ),
        );
        if (url.hostname === "id.twitch.tv") {
          if (scenario === "oauth401") return reply({ message: secret }, 401);
          if (scenario === "redirect")
            return new MFResponse(null, {
              status: 302,
              headers: { Location: "https://evil.example/" + secret },
            });
          if (scenario === "tokenBadType")
            return reply({
              access_token: accessToken,
              token_type: 42,
              expires_in: 3600,
            });
          if (scenario === "tokenMalformed")
            return reply({ access_token: accessToken, expires_in: 0 });
          return reply({
            access_token: accessToken,
            token_type: "bearer",
            expires_in: 3600,
          });
        }
        assert.equal(req.headers.get("Authorization"), "Bearer " + accessToken);
        assert.equal(req.headers.get("Client-Id"), "fixture-client");
        if (url.pathname === "/helix/games") {
          if (scenario === "absent") return reply({ data: [] });
          if (scenario === "mismatch")
            return reply({ data: [{ id: "5", name: "Grand Theft Auto V" }] });
          if (scenario === "gamesMalformed") return reply({ data: {} });
          return reply({
            data: [{ id: "123456", name: "Grand Theft Auto VI" }],
          });
        }
        assert.equal(url.pathname, "/helix/clips");
        clipPage++;
        if (scenario === "hold" && clipPage === 1) {
          entered?.();
          await new Promise<void>((resolve) => {
            release = resolve;
          });
        }
        if (scenario === "timeout")
          await new Promise((resolve) => setTimeout(resolve, 5500));
        if (["401", "429", "500"].includes(scenario))
          return reply({ message: secret + accessToken }, Number(scenario));
        if (scenario === "partial429" && clipPage === 2) return reply({}, 429);
        if (scenario === "malformed")
          return reply({ data: null, pagination: {} });
        if (scenario === "badJson")
          return new MFResponse("{bad", {
            headers: { "Content-Type": "application/json" },
          });
        if (scenario === "tooLarge")
          return reply({ data: "x".repeat(1_048_577) });
        if (scenario === "empty") return reply({ data: [], pagination: {} });
        const patches: Record<string, object> = {
          wrongGame: { game_id: "5" },
          wrongURL: { url: "https://evil.example/ImportDemo" },
          wrongID: { id: "WrongID" },
          oldDate: { created_at: "2000-01-01T00:00:00Z" },
          futureDate: {
            created_at: new Date(
              Date.parse(url.searchParams.get("ended_at")!) + 1000,
            ).toISOString(),
          },
          badDate: { created_at: "not-a-date" },
          badViews: { view_count: -1 },
          badDuration: { duration: 0 },
          badLanguage: { language: "<script>" },
          otherLanguage: { language: "other" },
        };
        const more = [
          "pages",
          "repeat",
          "limit",
          "partial429",
          "storageFirst",
          "storageSecond",
        ].includes(scenario);
        return reply({
          data: [
            clip(
              url,
              scenario.startsWith("storage")
                ? "StoragePage" + clipPage
                : more
                  ? "PageDemo" + clipPage
                  : "ImportDemo",
              patches[scenario],
            ),
          ],
          pagination:
            more &&
            (!["pages", "storageFirst", "storageSecond"].includes(scenario) ||
              clipPage < 2)
              ? { cursor: scenario === "repeat" ? "same" : "cursor" + clipPage }
              : {},
        });
      },
    }),
  );
  db = await mf.getD1Database("DB");
  await db.exec(
    (await readFile("migrations/0001_editions.sql", "utf8")).replace(
      /\n/g,
      " ",
    ),
  );
  await db
    .prepare(
      "INSERT INTO editions(date,draft,published,published_at) VALUES(?,?,?,?)",
    )
    .bind(
      legacy.date,
      JSON.stringify(legacy),
      JSON.stringify(legacy),
      "2035-01-01T00:00:00Z",
    )
    .run();
  await db.exec(
    (await readFile("migrations/0002_twitch.sql", "utf8")).replace(/\n/g, " "),
  );
  await db.exec(
    (
      await readFile("migrations/0003_candidate_thumbnails.sql", "utf8")
    ).replace(/\n/g, " "),
  );
});
after(async () => {
  await mf?.dispose();
  if (dir) await rm(dir, { recursive: true, force: true });
});
test("migrates populated stage 1; fixed OAuth body, exact category, bounded last24h and metadata", async () => {
  const r = await run();
  assert.equal(r.status, "success", JSON.stringify(r));
  assert.equal(r.saved, 1);
  assert.equal(r.requests, 3);
  assert.equal(Date.parse(r.window_end) - Date.parse(r.window_start), 86400000);
  assert.equal(r.game_name, "Grand Theft Auto VI");
  assert.equal(calls[0].url.href, "https://id.twitch.tv/oauth2/token");
  assert.equal(calls[0].method, "POST");
  assert.equal(new URLSearchParams(calls[0].body).get("client_secret"), secret);
  assert.equal(
    new URLSearchParams(calls[0].body).get("grant_type"),
    "client_credentials",
  );
  assert.equal(calls[1].url.searchParams.get("name"), "Grand Theft Auto VI");
  assert.equal(calls[2].url.searchParams.get("game_id"), "123456");
  assert.equal(calls[2].url.searchParams.get("first"), "100");
  assert.equal(calls[2].url.searchParams.get("started_at"), r.window_start);
  const c = await db
    .prepare("SELECT * FROM candidates WHERE id='ImportDemo'")
    .first<any>();
  assert.equal(c.duration, 22.5);
  assert.equal(c.language, "es");
  assert.equal(c.review_state, "pending");
  assert.ok(c.observed_at);
  assert.ok(c.created_at);
  const old = await db.prepare("SELECT * FROM editions").first<any>();
  assert.equal(old.published, JSON.stringify(legacy));
  assert.equal(old.draft, JSON.stringify(legacy));
  assert.equal(old.revision, 1);
});
test("repeat imports update views/observation without duplicates and preserve selected AND rejected choices", async () => {
  for (const state of ["selected", "rejected"]) {
    assert.equal(
      (await request("/admin/candidates/review", { id: "ImportDemo", state }))
        .status,
      200,
    );
    const previous = await db
      .prepare("SELECT observed_at FROM candidates WHERE id='ImportDemo'")
      .first<any>();
    views += 20;
    assert.equal((await run()).status, "success");
    const rows = await db
      .prepare("SELECT * FROM candidates WHERE id='ImportDemo'")
      .all<any>();
    assert.equal(rows.results.length, 1);
    assert.equal(rows.results[0].review_state, state);
    assert.equal(rows.results[0].views, views);
    assert.ok(rows.results[0].observed_at >= previous.observed_at);
  }
});
test("all private routes/actions enforce Access and origin; candidate text escaped and never public", async () => {
  for (const path of [
    "/admin/imports",
    "/admin/imports.js",
    "/admin/candidate?id=ImportDemo",
  ])
    assert.equal(
      (await request(path, undefined, { "Cf-Access-Jwt-Assertion": "" }))
        .status,
      401,
    );
  for (const path of ["/admin/import", "/admin/candidates/review"]) {
    assert.equal(
      (await request(path, {}, { "Cf-Access-Jwt-Assertion": "" })).status,
      401,
    );
    for (const Origin of ["", "https://evil.example", "null"])
      assert.equal((await request(path, {}, { Origin })).status, 403);
    assert.equal(
      (await request(path, {}, { "Sec-Fetch-Site": "cross-site" })).status,
      403,
    );
    assert.equal(
      (await request(path, {}, { "Content-Type": "text/plain" })).status,
      400,
    );
  }
  assert.equal(
    (
      await request("/admin/candidates/review", {
        id: "ImportDemo",
        state: "published",
      })
    ).status,
    400,
  );
  const html = await (await request("/admin/imports")).text();
  assert.ok(html.includes("&lt;img src=x&gt;"));
  assert.ok(!html.includes("<img src=x>"));
  for (const path of ["/", "/archivo", "/sitemap.xml", "/dia/2035-01-01"]) {
    const publicHTML = await (await request(path)).text();
    assert.ok(!publicHTML.includes("Private candidate"));
    assert.ok(!publicHTML.includes("ImportDemo"));
    assert.ok(!publicHTML.includes("import_runs"));
  }
  assert.equal((await request("/candidates")).status, 404);
});
test("empty, auth/token, rate limit, upstream, schema, size, network and game failures are safe and preserve publication", async () => {
  const cases: Record<string, string | null> = {
    empty: null,
    oauth401: "unauthorized",
    "401": "unauthorized",
    "429": "rate_limit",
    "500": "upstream",
    malformed: "malformed",
    badJson: "malformed",
    tokenMalformed: "malformed",
    gamesMalformed: "malformed",
    tooLarge: "too_large",
    redirect: "upstream",
    absent: "game_absent",
    mismatch: "game_mismatch",
  };
  for (const [mode, code] of Object.entries(cases)) {
    const r = await run(mode);
    assert.equal(r.status, mode === "empty" ? "empty" : "error", mode);
    assert.equal(r.error_code, code, mode);
    assert.ok(r.finished_at);
    assert.ok(r.requests <= 3);
    assert.equal(
      (await db.prepare("SELECT published FROM editions").first<any>())
        .published,
      JSON.stringify(legacy),
    );
    const stored = JSON.stringify(
      await db.prepare("SELECT * FROM import_runs").all(),
    );
    for (const forbidden of [
      secret,
      accessToken,
      "evil.example",
      "https://api.twitch.tv",
    ])
      assert.ok(!stored.includes(forbidden));
  }
});
test("invalid URL, ID, category, date and numeric metadata cannot write a page", async () => {
  for (const mode of [
    "wrongGame",
    "wrongURL",
    "wrongID",
    "oldDate",
    "futureDate",
    "badDate",
    "badViews",
    "badDuration",
    "badLanguage",
  ]) {
    const before = await db
      .prepare("SELECT * FROM candidates ORDER BY id")
      .all();
    const r = await run(mode);
    assert.equal(r.error_code, "invalid_clip", mode);
    assert.equal(r.saved, 0);
    assert.deepEqual(
      await db
        .prepare("SELECT * FROM candidates ORDER BY id")
        .all()
        .then((r) => r.results),
      before.results,
    );
  }
});
test("pagination uses stable bounds/cursors; repeats, truncation and downstream failure are partial", async () => {
  let r = await run("pages");
  assert.equal(r.status, "success");
  assert.equal(r.pages, 2);
  assert.equal(r.saved, 2);
  assert.equal(calls[3].url.searchParams.get("after"), "cursor1");
  assert.equal(
    calls[2].url.searchParams.get("started_at"),
    calls[3].url.searchParams.get("started_at"),
  );
  for (const [mode, code, pages] of [
    ["repeat", "repeated_cursor", 2],
    ["limit", "page_limit", 5],
    ["partial429", "rate_limit", 1],
  ] as const) {
    r = await run(mode);
    assert.equal(r.status, "partial");
    assert.equal(r.error_code, code);
    assert.equal(r.pages, pages);
    assert.ok(r.requests <= 7);
    const stored = await db
      .prepare("SELECT * FROM import_runs WHERE id=?")
      .bind(r.id)
      .first<any>();
    assert.equal(stored.status, "partial");
  }
});
test("network deadline completes safely without retry or sleeps", async () => {
  const start = Date.now();
  const r = await run("timeout");
  assert.equal(r.error_code, "timeout");
  assert.equal(r.status, "error");
  assert.equal(r.requests, 3);
  assert.ok(Date.now() - start < 8000);
});
test("atomic overlapping imports skip; expired lease recovery fences stale page writes and completion", async () => {
  let signal!: () => void;
  const waiting = new Promise<void>((resolve) => {
    signal = resolve;
  });
  entered = signal;
  const first = run("hold");
  await waiting;
  const blocked = (await request("/admin/import", {}).then((r) =>
    r.json(),
  )) as ImportRun;
  assert.equal(blocked.status, "skipped");
  assert.equal(blocked.error_code, "overlap");
  const old = await db.prepare("SELECT owner FROM import_lease").first<any>();
  await db.prepare("UPDATE import_lease SET expires_at=0").run();
  views = 999;
  const successor = await run("normal");
  assert.equal(successor.status, "success");
  // A delayed old response must not overwrite the successor's observations.
  views = 1;
  release?.();
  const stale = await first;
  assert.equal(stale.error_code, "lease_expired");
  assert.equal(
    (
      await db
        .prepare("SELECT views FROM candidates WHERE id='ImportDemo'")
        .first<any>()
    ).views,
    999,
  );
  assert.equal(
    (
      await db
        .prepare("SELECT status FROM import_runs WHERE id=?")
        .bind(successor.id)
        .first<any>()
    ).status,
    "success",
  );
  const recovered = await db
    .prepare("SELECT * FROM import_runs WHERE id=?")
    .bind(old.owner)
    .first<any>();
  assert.equal(recovered.error_code, "lease_expired");
  assert.equal(recovered.status, "error");
  assert.equal(recovered.saved, 0);
  assert.equal(
    (await db.prepare("SELECT count(*) AS n FROM import_lease").first<any>()).n,
    0,
  );
});
test("actual production scheduled event calls the same importer and records cron run", async () => {
  scenario = "empty";
  calls = [];
  const r = await (await mf.getWorker()).scheduled({ cron: "0 6,18 * * *" });
  assert.equal(r.outcome, "ok");
  const cron = await db
    .prepare(
      "SELECT * FROM import_runs WHERE trigger='cron' ORDER BY started_at DESC LIMIT 1",
    )
    .first<any>();
  assert.ok(cron);
  assert.equal(cron.status, "empty");
  assert.equal(cron.requests, 3);
  assert.equal(
    Date.parse(cron.window_end) - Date.parse(cron.window_start),
    86400000,
  );
  assert.equal(calls[0].url.hostname, "id.twitch.tv");
});
test("missing config skips network; configured category is verified by ID, never blindly trusted", async () => {
  const script = await readFile(join(dir, "worker.js"), "utf8");
  for (const mode of ["missing", "valid", "wrong", "invalid"]) {
    let count = 0;
    const runtime = new Miniflare(
      convertV4MiniflareOptions({
        modules: true,
        script,
        compatibilityDate: "2026-11-01",
        d1Databases: ["DB"],
        bindings: {
          PUBLIC_ORIGIN: base,
          ...(mode === "missing"
            ? {}
            : {
                TWITCH_CLIENT_ID: "fixture-client",
                TWITCH_CLIENT_SECRET: secret,
                TWITCH_GAME_ID: mode === "invalid" ? "fake" : "123456",
              }),
        },
        outboundService: async (req) => {
          count++;
          const url = new URL(req.url);
          if (url.hostname === "id.twitch.tv")
            return reply({
              access_token: accessToken,
              token_type: "bearer",
              expires_in: 3600,
            });
          if (url.pathname === "/helix/games") {
            assert.equal(url.searchParams.get("id"), "123456");
            assert.equal(url.searchParams.has("name"), false);
            return reply({
              data: [
                {
                  id: mode === "wrong" ? "999" : "123456",
                  name: "Grand Theft Auto VI",
                },
              ],
            });
          }
          return reply({ data: [], pagination: {} });
        },
      }),
    );
    try {
      const database = await runtime.getD1Database("DB");
      for (const name of [
        "0001_editions.sql",
        "0002_twitch.sql",
        "0003_candidate_thumbnails.sql",
      ])
        await database.exec(
          (await readFile("migrations/" + name, "utf8")).replace(/\n/g, " "),
        );
      assert.equal(
        (await (await runtime.getWorker()).scheduled()).outcome,
        "ok",
      );
      const result = await database
        .prepare("SELECT * FROM import_runs")
        .first<any>();
      assert.equal(
        result.error_code,
        mode === "missing"
          ? "missing_config"
          : mode === "wrong"
            ? "game_mismatch"
            : mode === "invalid"
              ? "invalid_config"
              : null,
      );
      assert.equal(
        count,
        mode === "missing" || mode === "invalid" ? 0 : mode === "wrong" ? 2 : 3,
      );
    } finally {
      await runtime.dispose();
    }
  }
});

// Provider contract and actual SQLite failure regressions from independent review.
test("Twitch other-language metadata remains eligible for editorial review", async () => {
  const result = await run("otherLanguage");
  assert.equal(result.status, "success");
  assert.equal(
    (
      await db
        .prepare("SELECT language FROM candidates WHERE id='ImportDemo'")
        .first<any>()
    ).language,
    "other",
  );
});
test("wrong OAuth token type is malformed provider data, with sanitized diagnosis", async () => {
  const result = await run("tokenBadType");
  assert.equal(result.error_code, "malformed");
  assert.equal(result.saved, 0);
});
test("failed atomic page writes never inflate committed-page or saved-candidate counts", async () => {
  for (const [mode, failingId, committed] of [
    ["storageFirst", "StoragePage1", 0],
    ["storageSecond", "StoragePage2", 1],
  ] as const) {
    await db
      .prepare("DELETE FROM candidates WHERE id LIKE 'StoragePage%'")
      .run();
    await db.exec(
      `CREATE TRIGGER reject_test_page BEFORE INSERT ON candidates WHEN NEW.id='${failingId}' BEGIN SELECT RAISE(ABORT, 'private-upstream-error-not-for-display'); END;`,
    );
    try {
      const result = await run(mode);
      assert.equal(result.error_code, "storage");
      assert.equal(result.status, committed ? "partial" : "error");
      assert.equal(result.saved, committed);
      assert.equal(result.pages, committed);
      const stored = await db
        .prepare("SELECT * FROM import_runs WHERE id=?")
        .bind(result.id)
        .first<any>();
      assert.equal(stored.saved, committed);
      assert.equal(stored.pages, committed);
      assert.equal(
        (
          await db
            .prepare(
              "SELECT count(*) AS n FROM candidates WHERE id LIKE 'StoragePage%'",
            )
            .first<any>()
        ).n,
        committed,
      );
      assert.ok(
        !JSON.stringify(stored).includes(
          "private-upstream-error-not-for-display",
        ),
      );
    } finally {
      await db.exec("DROP TRIGGER reject_test_page;");
    }
  }
});

test("transport rejection is sanitized and does not change the public edition", async () => {
  const transport = mock.method(globalThis, "fetch", async () => {
    throw new TypeError("fixture-transport-secret-not-for-display");
  });
  try {
    const result = await importTwitch(
      {
        DB: db as unknown as Env["DB"],
        PUBLIC_ORIGIN: base,
        TWITCH_CLIENT_ID: "fixture-client",
        TWITCH_CLIENT_SECRET: secret,
      },
      "manual",
    );
    assert.equal(result.error_code, "network");
    assert.equal(result.saved, 0);
    assert.equal(result.requests, 1);
    const stored = await db
      .prepare("SELECT * FROM import_runs WHERE id=?")
      .bind(result.id)
      .first<any>();
    assert.ok(
      !JSON.stringify(stored).includes(
        "fixture-transport-secret-not-for-display",
      ),
    );
    assert.equal(
      (
        await db
          .prepare("SELECT published FROM editions WHERE date=?")
          .bind(legacy.date)
          .first<any>()
      ).published,
      JSON.stringify(legacy),
    );
  } finally {
    transport.mock.restore();
  }
});

test("valid optional Twitch posters persist and an invalid replacement preserves the last safe image", async () => {
  let image = "https://static-cdn.jtvnw.net/fixture/candidate.jpg";
  const transport = mock.method(globalThis, "fetch", async (input: any) => {
    const url = new URL(String(input));
    const json = (body: unknown) =>
      new Response(JSON.stringify(body), {
        headers: { "Content-Type": "application/json" },
      });
    if (url.hostname === "id.twitch.tv")
      return json({
        access_token: "fixture-poster-token",
        token_type: "bearer",
        expires_in: 3600,
      });
    if (url.pathname === "/helix/games")
      return json({ data: [{ id: "123456", name: "Grand Theft Auto VI" }] });
    return json({
      data: [
        {
          id: "PosterCandidate",
          url: "https://clips.twitch.tv/PosterCandidate",
          broadcaster_name: "Poster creator",
          title: "Poster test",
          language: "es",
          game_id: "123456",
          created_at: new Date(Date.now() - 1000).toISOString(),
          duration: 25,
          view_count: 10,
          thumbnail_url: image,
        },
      ],
      pagination: {},
    });
  });
  try {
    const env = {
      DB: db as unknown as Env["DB"],
      PUBLIC_ORIGIN: base,
      TWITCH_CLIENT_ID: "fixture-client",
      TWITCH_CLIENT_SECRET: secret,
    };
    assert.equal((await importTwitch(env, "manual")).status, "success");
    assert.equal(
      (
        await db
          .prepare(
            "SELECT thumbnail FROM candidates WHERE id='PosterCandidate'",
          )
          .first<any>()
      ).thumbnail,
      image,
    );
    image = "https://evil.example/stolen.jpg";
    assert.equal((await importTwitch(env, "manual")).status, "success");
    assert.equal(
      (
        await db
          .prepare(
            "SELECT thumbnail FROM candidates WHERE id='PosterCandidate'",
          )
          .first<any>()
      ).thumbnail,
      "https://static-cdn.jtvnw.net/fixture/candidate.jpg",
    );
  } finally {
    transport.mock.restore();
  }
});
