import assert from "node:assert/strict";
import test from "node:test";
import type { Edition } from "../src/model";
import {
  creatorHuntDraft,
  parseCreatorReply,
  publish,
  topDraft,
  weightedLength,
} from "../src/x-social";

const clip = {
  id: "c1",
  url: "https://clips.twitch.tv/Abc",
  streamer: "ibai",
  title: "Persecución imposible",
  text: "Escapa por los pelos de la policía.",
  category: "Jugadas",
};
const e = {
  date: "2026-11-20",
  clips: [clip],
  featured: "c1",
} as unknown as Edition;

test("top draft credits creator, fits 280 and keeps site link in reply with UTM", () => {
  const d = topDraft(e, clip, "https://gtaklips.example");
  assert.match(d.text, /@ibai/);
  assert.ok(weightedLength(d.text) <= 280);
  assert.ok(!d.text.includes("gtaklips.example"));
  assert.match(d.replyText, /utm_source=x.*#clip-c1/);
});

test("long text is trimmed within the weighted limit", () => {
  const d = topDraft(
    e,
    { ...clip, text: "x".repeat(600) },
    "https://g.example",
  );
  assert.ok(weightedLength(d.text) <= 280);
});

test("creator hunt asks for the creator and links the source", () => {
  const d = creatorHuntDraft(
    { id: "k1", url: "https://youtu.be/abc" },
    "https://g.example",
  );
  assert.match(d.text, /¿Quién es el creador/);
  assert.match(d.text, /youtu\.be\/abc/);
  assert.equal(d.kind, "creator_hunt");
});

test("parses handles and channel urls from replies, ignoring brand handles", () => {
  assert.deepEqual(
    parseCreatorReply("Es @Ibai_ y mira https://twitch.tv/auronplay @GtaKlips"),
    ["auronplay", "ibai_"],
  );
  assert.deepEqual(parseCreatorReply("a@b.com no"), []);
});

test("publish is a dry-run unless explicitly enabled and never calls the API", async () => {
  let calls = 0;
  const f = (async () => (calls++, new Response("{}"))) as typeof fetch;
  const d = topDraft(e, clip, "https://g.example");
  assert.equal((await publish({}, d, f)).mode, "dry-run");
  assert.equal(
    (await publish({ X_PUBLISH_ENABLED: "true" }, d, f)).mode,
    "dry-run",
  );
  assert.equal((await publish({ X_ACCESS_TOKEN: "t" }, d, f)).mode, "dry-run");
  assert.equal(calls, 0);
});

test("publish posts main tweet then self-reply; reply failure keeps main id", async () => {
  const bodies: any[] = [];
  let n = 0;
  const f = (async (_u: string, init: RequestInit) => {
    bodies.push(JSON.parse(init.body as string));
    n++;
    return n === 1
      ? new Response(JSON.stringify({ data: { id: "111" } }))
      : new Response("no", { status: 500 });
  }) as unknown as typeof fetch;
  const r = await publish(
    { X_PUBLISH_ENABLED: "true", X_ACCESS_TOKEN: "t" },
    topDraft(e, clip, "https://g.example"),
    f,
  );
  assert.deepEqual(r, { mode: "published", tweetId: "111" });
  assert.equal(bodies[1].reply.in_reply_to_tweet_id, "111");
});
