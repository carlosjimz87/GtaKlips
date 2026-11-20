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

test("Twitch listing filters and X media suffixes normalize to the clean canonical URL", () => {
  const clip = "SincereMoldyGaragePartyTime-C2fuK1XJ2UtVfHel";
  const twitch = {
    provider: "twitch",
    sourceId: clip,
    id: clip,
    url: `https://clips.twitch.tv/${clip}`,
  };
  for (const url of [
    `https://www.twitch.tv/kaicenat/clip/${clip}?range=7d`,
    `https://www.twitch.tv/kaicenat/clip/${clip}?filter=clips&range=30d&sort=views`,
    `https://clips.twitch.tv/${clip}?range=24hr`,
  ])
    assert.deepEqual(source(url), twitch, url);

  const post = "https://x.com/Ladepresion__/status/2123515305930465701";
  for (const url of [
    `${post}/video/1?a=F1vLVatOyP5SQY_5ckQ&s=35`,
    `${post}/photo/2`,
    `${post}/video/1/`,
    `https://mobile.twitter.com/Ladepresion__/status/2123515305930465701/video/1?s=20`,
  ])
    assert.equal(source(url).url, post, url);
  assert.equal(source(`${post}/video/1`).id, "x:2123515305930465701");
});

test("relaxed link rules stay confined to their providers and exact shapes", () => {
  const clip = "SincereMoldyGaragePartyTime-C2fuK1XJ2UtVfHel";
  for (const url of [
    `https://www.twitch.tv/kaicenat/clip/${clip}?range=7d&redirect=https://evil.test`,
    `https://www.twitch.tv/kaicenat/clip/${clip}?range=7d&range=30d&next=x`,
    `https://www.twitch.tv/kaicenat?range=7d`,
    `https://www.twitch.tv/videos/123456789?range=7d`,
    "https://www.youtube.com/watch?v=abcdefghijk&range=7d",
    "https://x.com/demo/status/123?range=7d",
    "https://youtu.be/abcdefghijk?filter=clips",
    "https://clips.twitch.tv.evil.test/Demo?range=7d",
    "https://x.com/demo/status/123/video/0",
    "https://x.com/demo/status/123/video/5",
    "https://x.com/demo/status/123/video/1/extra",
    "https://x.com/demo/status/123/analytics",
    "https://x.com/demo/status/123/likes",
    "https://www.youtube.com/watch/video/1",
  ])
    assert.throws(() => source(url), url);
});
