import assert from "node:assert/strict";
import test from "node:test";
import { idle, nextDelay, wakeEnrichment } from "../src/enrichment-wake";

test("backoff grows from 2s to a 30s cap", () => {
  assert.deepEqual(
    [0, 1, 2, 3, 4, 9].map(nextDelay),
    [2000, 4000, 8000, 16000, 30000, 30000],
  );
});

test("wake interrupts an idle wait", async () => {
  const started = Date.now();
  const waiting = idle(10000);
  wakeEnrichment();
  await waiting;
  assert.ok(Date.now() - started < 1000);
});

test("wake while busy skips the next wait", async () => {
  wakeEnrichment();
  const started = Date.now();
  await idle(10000);
  assert.ok(Date.now() - started < 1000);
});
