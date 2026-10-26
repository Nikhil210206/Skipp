/**
 * When the launch overlay starts to lift.
 *
 * `Splash` covers the first screen for about 1.3s on a cold start, so anything
 * that performs an entrance on that screen has to wait for it, or the whole
 * performance plays underneath the overlay and is simply THERE when it lifts.
 * The front door's hero is the screen this matters for.
 *
 * Module scope on purpose: it is one fact about the page load, not something a
 * component owns. A screen that mounts after the launch has gone hears about it
 * at once.
 */

let lifted = false;
const waiting = new Set<() => void>();

/** Called by the splash at the moment it begins to leave. */
export function markLaunchLifted(): void {
  if (lifted) return;
  lifted = true;
  waiting.forEach((cb) => cb());
  waiting.clear();
}

/**
 * Runs `cb` once the launch is lifting: straight away if it already has. A
 * fallback timer covers a page with no splash at all, so a missing overlay can
 * only make an entrance early, never stop it.
 */
export function onLaunchLifted(cb: () => void, fallbackMs = 1800): () => void {
  if (lifted) {
    cb();
    return () => {};
  }
  let fired = false;
  const run = () => {
    if (fired) return;
    fired = true;
    clearTimeout(timer);
    waiting.delete(run);
    cb();
  };
  waiting.add(run);
  const timer = setTimeout(run, fallbackMs);
  return () => {
    clearTimeout(timer);
    waiting.delete(run);
  };
}
