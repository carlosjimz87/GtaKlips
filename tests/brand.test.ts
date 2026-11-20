import assert from "node:assert/strict";
import test from "node:test";
import { brandHead, brandResponse } from "../src/brand";

test("serves brand assets with correct types and valid magic bytes", async () => {
  const png = brandResponse("/brand/icon-32.png")!;
  assert.equal(png.headers.get("content-type"), "image/png");
  const b = new Uint8Array(await png.arrayBuffer());
  assert.deepEqual([...b.slice(0, 4)], [0x89, 0x50, 0x4e, 0x47]);
  const og = brandResponse("/brand/og.jpg")!;
  assert.equal(og.headers.get("content-type"), "image/jpeg");
  const j = new Uint8Array(await og.arrayBuffer());
  assert.deepEqual([...j.slice(0, 2)], [0xff, 0xd8]);
});

test("unknown or traversal brand paths are not served", () => {
  for (const p of [
    "/brand/",
    "/brand/nope.png",
    "/brand/__proto__",
    "/brand/../x",
    "/other",
  ])
    assert.equal(brandResponse(p), null);
});

test("head advertises favicon and social image on the public origin", () => {
  const h = brandHead("https://example.com");
  assert.match(h, /rel="icon"/);
  assert.match(h, /rel="apple-touch-icon"/);
  assert.match(h, /og:image" content="https:\/\/example.com\/brand\/og.jpg"/);
  assert.match(h, /twitter:image/);
});
