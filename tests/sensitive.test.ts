import { test } from "node:test";
import assert from "node:assert/strict";
import { extraction, sensitiveText } from "../src/enrichment-contract";

const base = {
  postId: "123",
  text: "hi",
  author: "",
  handle: "",
  tags: [],
  comments: [],
  commentsRequested: 0,
  commentsReason: "",
  width: 0,
  height: 0,
  dimensionSource: "unavailable",
  imageType: "unavailable",
};
test("detects X sensitive-media warnings in English and Spanish", () => {
  assert.ok(
    sensitiveText(
      "The following media includes potentially sensitive content.",
    ),
  );
  assert.ok(sensitiveText("Este contenido sensible puede..."));
  assert.ok(sensitiveText("Contenido potencialmente sensible"));
  assert.ok(!sensitiveText("GTA 6 es sensible a la luz"));
  assert.ok(!sensitiveText("normal post about gameplay"));
});
test("extraction keeps the sensitive flag only when true", () => {
  assert.equal(extraction({ ...base, sensitive: true }).sensitive, true);
  assert.equal("sensitive" in extraction({ ...base }), false);
  assert.equal("sensitive" in extraction({ ...base, sensitive: "yes" }), false);
});
