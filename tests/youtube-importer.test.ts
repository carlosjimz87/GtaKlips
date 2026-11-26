import assert from "node:assert/strict";
import test from "node:test";
import { rank, seconds, type YtVideo } from "../src/youtube-importer";

const now = Date.parse("2026-11-26T12:00:00Z");
const v = (over: Partial<YtVideo>): YtVideo => ({
  id: "abcdefghijk",
  title: "t",
  channel: "c",
  publishedAt: "2026-11-26T06:00:00Z",
  views: 60000,
  seconds: 30,
  live: false,
  ...over,
});
test("parses ISO durations including live (P0D) and days", () => {
  assert.equal(seconds("PT51S"), 51);
  assert.equal(seconds("PT1H2M3S"), 3723);
  assert.equal(seconds("P0D"), 0);
  assert.equal(seconds("P1DT1H"), 90000);
  assert.equal(seconds("garbage"), 0);
});
test("ranks by views per hour and drops live, long, short, low-view and duplicate videos", () => {
  const out = rank(
    [
      v({ id: "aaaaaaaaaaa", views: 60000 }), // 6h -> 10k/h
      v({
        id: "bbbbbbbbbbb",
        views: 30000,
        publishedAt: "2026-11-26T11:00:00Z",
      }), // 30k/h
      v({ id: "ccccccccccc", live: true }),
      v({ id: "ddddddddddd", seconds: 7200 }),
      v({ id: "eeeeeeeeeee", seconds: 3 }),
      v({ id: "fffffffffff", views: 100 }),
      v({ id: "aaaaaaaaaaa", views: 99999 }), // duplicate id
      v({ id: "bad id" }),
    ],
    now,
  );
  assert.deepEqual(
    out.map((x) => x.id),
    ["bbbbbbbbbbb", "aaaaaaaaaaa"],
  );
  assert.ok(out[0].perHour > out[1].perHour);
});
