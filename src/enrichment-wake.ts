// In-process wake-up so the enrichment loop reacts immediately to new imports
// instead of polling aggressively. Safe to call when no loop is running.
let waiter: (() => void) | undefined;
let pending = false;
export function wakeEnrichment() {
  if (waiter) waiter();
  else pending = true; // loop is busy: skip the next idle wait
}
// Resolves after ms, or earlier when wakeEnrichment() is called.
export function idle(ms: number) {
  return new Promise<void>((resolve) => {
    if (pending || ms <= 0) {
      pending = false;
      return resolve();
    }
    const timer = setTimeout(done, ms);
    function done() {
      clearTimeout(timer);
      if (waiter === done) waiter = undefined;
      resolve();
    }
    waiter = done;
  });
}
// Backoff: stay responsive (2 s) right after work, relax to 30 s when idle.
export function nextDelay(idleCycles: number) {
  return Math.min(30000, 2000 * 2 ** Math.min(idleCycles, 4));
}
