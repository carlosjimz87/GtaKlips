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

test("X mobile share parameter a is stripped only on recognized X post hosts", () => {
  const canonical = "https://x.com/LaTwitchance/status/2123221655715500442";
  assert.deepEqual(
    source(
      "https://x.com/LaTwitchance/status/2123221655715500442?a=mT-Cem3lEJP2T577VF0&s=35",
    ),
    {
      provider: "x",
      sourceId: "2123221655715500442",
      id: "x:2123221655715500442",
      url: canonical,
    },
  );
  assert.equal(source(canonical).id, source(canonical + "?a=shared&s=35").id);
  assert.equal(
    source(
      "https://mobile.twitter.com/LaTwitchance/status/2123221655715500442?a=shared&s=35",
    ).url,
    canonical,
  );
  for (const url of [
    canonical + "?a=shared&redirect=https://evil.test",
    "https://x.com.evil.test/LaTwitchance/status/2123221655715500442?a=shared",
    "https://youtu.be/abcdefghijk?a=shared",
    "https://clips.twitch.tv/Demo?a=shared",
  ])
    assert.throws(() => source(url));
});
