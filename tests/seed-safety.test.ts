import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { build } from "esbuild";
import { Miniflare, convertV4MiniflareOptions } from "miniflare";
test("seed, withdraw, seed refuses to revive removed clips and preserves the changed D1 edition", async () => {
  const { demoNeedsWrite } = await import(
    new URL("../scripts/demo-policy.mjs", import.meta.url).href
  );
  const dir = await mkdtemp(join(tmpdir(), "gtaklips-seed-safety-"));
  let runtime: Miniflare | undefined;
  try {
    await build({
      entryPoints: ["src/local.ts"],
      outfile: join(dir, "worker.js"),
      bundle: true,
      format: "esm",
      platform: "browser",
      target: "es2022",
    });
    const base = "http://127.0.0.1:8788";
    runtime = new Miniflare(
      convertV4MiniflareOptions({
        modules: true,
        script: await readFile(join(dir, "worker.js"), "utf8"),
        compatibilityDate: "2026-11-01",
        d1Databases: ["DB"],
        bindings: {
          PUBLIC_ORIGIN: base,
          LOCAL_DEVELOPMENT: "explicit-loopback-only",
        },
      }),
    );
    const db = await runtime.getD1Database("DB");
    for (const name of [
      "0001_editions.sql",
      "0002_twitch.sql",
      "0003_candidate_thumbnails.sql",
    ])
      await db.exec(
        (await readFile("migrations/" + name, "utf8")).replace(/\n/g, " "),
      );
    const edition = {
      demoSeed: "catalog-v1",
      date: "2037-02-03",
      title: "Seed regression",
      intro: "Test",
      hook: "Test",
      demo: true,
      reviewed: false,
      featured: "SeedSafety0",
      clips: Array.from({ length: 5 }, (_, i) => ({
        id: "SeedSafety" + i,
        url: "https://clips.twitch.tv/SeedSafety" + i,
        streamer: "Fixture",
        title: "Test " + i,
        text: "Contexto de prueba",
        category: "Fails",
      })),
    };
    const json = JSON.stringify(edition);
    assert.equal(demoNeedsWrite(undefined, json), true);
    await db
      .prepare("INSERT INTO editions(date,draft,published) VALUES(?,?,?)")
      .bind(edition.date, json, json)
      .run();
    assert.equal(
      demoNeedsWrite(
        await db
          .prepare("SELECT * FROM editions WHERE date=?")
          .bind(edition.date)
          .first(),
        json,
      ),
      false,
    );
    const withdrawal = await runtime.dispatchFetch(base + "/admin/withdraw", {
      method: "POST",
      headers: { Origin: base, "Content-Type": "application/json" },
      body: JSON.stringify({
        date: edition.date,
        id: "SeedSafety0",
        revision: 1,
      }),
    });
    assert.equal(withdrawal.status, 200);
    const row = await db
      .prepare("SELECT * FROM editions WHERE date=?")
      .bind(edition.date)
      .first<any>();
    assert.equal(JSON.parse(row.draft).demoSeed, "catalog-v1");
    assert.equal(JSON.parse(row.published).clips.length, 4);
    assert.throws(() => demoNeedsWrite(row, json), /modificada/);
    const after = await db
      .prepare("SELECT * FROM editions WHERE date=?")
      .bind(edition.date)
      .first<any>();
    assert.deepEqual(after, row);
    assert.ok(
      !JSON.parse(after.published).clips.some(
        (c: any) => c.id === "SeedSafety0",
      ),
    );
  } finally {
    await runtime?.dispose();
    await rm(dir, { recursive: true, force: true });
  }
});

test("the actual seed CLI rejects remote or extra arguments before any database operation", () => {
  const cli = fileURLToPath(
    new URL("../scripts/seed-demo.mjs", import.meta.url),
  );
  const result = spawnSync(process.execPath, [cli, "--remote"], {
    encoding: "utf8",
  });
  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /solo admite ejecución local sin argumentos/);
});
