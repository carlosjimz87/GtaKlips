import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { build } from "esbuild";
import { Miniflare, convertV4MiniflareOptions } from "miniflare";
import { thumbnail, validate } from "../src/model";
let runtime: Miniflare, dir: string;
const edition = {
  date: "2036-06-10",
  title: "Catálogo de prueba",
  intro: "Selección de demostración",
  hook: "Prueba de catálogo",
  demo: true,
  reviewed: false,
  featured: "Catalog2",
  clips: Array.from({ length: 5 }, (_, i) => ({
    id: `Catalog${i}`,
    url: `https://clips.twitch.tv/Catalog${i}`,
    streamer: `Creador ${i}`,
    title: `Momento ${i}`,
    text: `Contexto ${i}`,
    category: i === 2 ? "Jugadas" : "Detalles",
    thumbnail: `https://static-cdn.jtvnw.net/fixture/poster-${i}.jpg`,
    duration: 35 + i,
  })),
};
before(async () => {
  dir = await mkdtemp(join(tmpdir(), "gtaklips-catalog-"));
  await build({
    entryPoints: ["src/index.ts"],
    outfile: join(dir, "worker.js"),
    bundle: true,
    format: "esm",
    platform: "browser",
    target: "es2022",
  });
  runtime = new Miniflare(
    convertV4MiniflareOptions({
      modules: true,
      script: await readFile(join(dir, "worker.js"), "utf8"),
      compatibilityDate: "2026-11-01",
      d1Databases: ["DB"],
      bindings: { PUBLIC_ORIGIN: "https://example.com" },
    }),
  );
  const db = await runtime.getD1Database("DB");
  for (const file of [
    "0001_editions.sql",
    "0002_twitch.sql",
    "0003_candidate_thumbnails.sql",
  ])
    await db.exec(
      (await readFile("migrations/" + file, "utf8")).replace(/\n/g, " "),
    );
  await db
    .prepare("INSERT INTO editions(date,draft,published) VALUES(?,?,?)")
    .bind(edition.date, JSON.stringify(edition), JSON.stringify(edition))
    .run();
});
after(async () => {
  await runtime?.dispose();
  if (dir) await rm(dir, { recursive: true, force: true });
});
test("optional posters retain legacy editions and reject unsafe media URLs", () => {
  assert.equal(thumbnail(undefined), undefined);
  for (const value of [
    "http://static-cdn.jtvnw.net/x.jpg",
    "https://evil.example/x.jpg",
    "https://static-cdn.jtvnw.net.evil.example/x.jpg",
    "https://user@static-cdn.jtvnw.net/x.jpg",
    "https://static-cdn.jtvnw.net/x.svg",
    "https://static-cdn.jtvnw.net/x.jpg?token=secret",
    "javascript:alert(1)",
  ])
    assert.throws(() => thumbnail(value));
  assert.equal(
    validate(edition).clips[2].thumbnail,
    edition.clips[2].thumbnail,
  );
  assert.throws(() =>
    validate({
      ...edition,
      clips: [{ ...edition.clips[0], duration: -1 }],
      featured: "Catalog0",
    }),
  );
  const legacy = {
    ...edition,
    clips: edition.clips.map((c) => ({
      id: c.id,
      url: c.url,
      streamer: c.streamer,
      title: c.title,
      text: c.text,
      category: c.category,
    })),
  };
  assert.equal(validate(legacy).clips.length, 5);
});
test("public catalog exposes credited sources, real anchor targets and restricted image CSP", async () => {
  const response = await runtime.dispatchFetch(
    "https://example.com/dia/" + edition.date + "?utm_source=x#clip-Catalog2",
  );
  assert.equal(response.status, 200);
  const html = await response.text();
  assert.equal((html.match(/<article class=/g) || []).length, 5);
  assert.ok(html.includes('id="clip-Catalog2"'));
  assert.ok(html.includes("Play on Twitch"));
  assert.ok(html.includes("https://clips.twitch.tv/Catalog2"));
  assert.ok(html.includes("Creador 2"));
  assert.ok(html.includes("DEMO"));
  assert.ok(
    response.headers
      .get("Content-Security-Policy")
      ?.includes("img-src 'self' https://static-cdn.jtvnw.net"),
  );
  assert.ok(
    !response.headers.get("Content-Security-Policy")?.includes("img-src *"),
  );
  assert.equal(
    (await runtime.dispatchFetch("https://example.com/catalog.js")).status,
    200,
  );
});
test("search and categories combine without changing canonical or exposing unpublished content", async () => {
  let html = await (
    await runtime.dispatchFetch(
      "https://example.com/dia/" +
        edition.date +
        "?categoria=Jugadas&q=Creador%202",
    )
  ).text();
  assert.equal((html.match(/<article class=/g) || []).length, 1);
  assert.ok(html.includes('id="clip-Catalog2"'));
  assert.ok(html.includes(`href="https://example.com/dia/${edition.date}"`));
  html = await (
    await runtime.dispatchFetch(
      "https://example.com/dia/" + edition.date + "?q=%3Cscript%3E",
    )
  ).text();
  assert.ok(html.includes("No clips match that selection"));
  assert.ok(!html.includes("<script>"));
  const db = await runtime.getD1Database("DB");
  await db
    .prepare("UPDATE editions SET draft=? WHERE date=?")
    .bind(
      JSON.stringify({ ...edition, title: "PRIVATE CATALOG DRAFT" }),
      edition.date,
    )
    .run();
  assert.ok(
    !(
      await (await runtime.dispatchFetch("https://example.com/")).text()
    ).includes("PRIVATE CATALOG DRAFT"),
  );
});

test("preview embeds are deferred, escaped and confined to the official frame host", async () => {
  const response = await runtime.dispatchFetch(
    "https://example.com/dia/" + edition.date,
  );
  const html = await response.text();
  assert.ok(html.includes('data-preview="Catalog2"'));
  assert.ok(html.includes("data-preview-hero"));
  assert.ok(!html.includes("<iframe"));
  const csp = response.headers.get("Content-Security-Policy")!;
  assert.ok(csp.includes("frame-src https://clips.twitch.tv;"));
  assert.ok(csp.includes("script-src 'self';"));
  assert.ok(csp.includes("frame-ancestors 'none'"));
  assert.ok(!csp.includes("frame-src *"));
  assert.ok(
    response.headers
      .get("Permissions-Policy")
      ?.includes('autoplay=(self "https://clips.twitch.tv")'),
  );
});

test("credit label: Video of streamer, else Post of creator, else Anonymous", async () => {
  const { credit } = await import("../src/model");
  assert.equal(credit({ streamer: "Ana", creator: "@bob" }), "Video of Ana");
  assert.equal(credit({ streamer: " ", creator: "@bob" }), "Post of @bob");
  assert.equal(credit({ streamer: "", creator: "" }), "Anonymous");
  assert.equal(credit({}), "Anonymous");
});
