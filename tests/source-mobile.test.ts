import { test } from "node:test";
import assert from "node:assert/strict";
import { source } from "../src/source";
test("mobile share URLs normalize to the same source without accepting lookalikes", () => {
  for (const url of [
    "https://m.youtube.com/shorts/abcdefghijk?si=share",
    "https://m.youtube.com/watch?v=abcdefghijk",
  ])
    assert.equal(source(url).id, "youtube:abcdefghijk");
  for (const host of ["mobile.twitter.com", "m.twitter.com"])
    assert.equal(
      source(`https://${host}/demo/status/123?s=20`).url,
      "https://x.com/demo/status/123",
    );
  for (const host of [
    "m.youtube.com.evil.test",
    "mobile.twitter.com.evil.test",
  ])
    assert.throws(() => source(`https://${host}/demo/status/123`));
});
