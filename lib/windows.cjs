/* Discipline 1 - attention windows.
 *
 * The agent works continuously but is allowed to reach the human only at fixed
 * hours, and never at night. Everything it cannot decide alone waits in a queue
 * and is handed over in one batch when a window opens. This is the whole point
 * of the product: an always-on agent that is not an always-on interruption.
 */
const DEFAULT_WINDOWS = [7, 13, 19]; // hours, local to the human
const NIGHT_FROM = 19;               // after the 19:00 handover, silence
const NIGHT_UNTIL = 7;

function hoursOf(cfg) {
  const h = (cfg && cfg.windows) || DEFAULT_WINDOWS;
  return [...new Set(h)].sort((a, b) => a - b);
}

/* Night is the closed interval [19:00, 07:00). The 19:00 window itself is the
 * last delivery of the day - it opens exactly as the quiet period begins. */
function isNight(d, cfg = {}) {
  const from = cfg.nightFrom ?? NIGHT_FROM;
  const until = cfg.nightUntil ?? NIGHT_UNTIL;
  const h = d.getHours();
  const m = d.getMinutes();
  if (h === from && m === 0) return false; // the handover moment is not night
  return from > until ? (h >= from || h < until) : (h >= from && h < until);
}

function nextWindow(now = new Date(), cfg = {}) {
  const hs = hoursOf(cfg);
  for (const h of hs) {
    const c = new Date(now);
    c.setHours(h, 0, 0, 0);
    if (c > now) return c;
  }
  const t = new Date(now);
  t.setDate(t.getDate() + 1);
  t.setHours(hs[0], 0, 0, 0);
  return t;
}

/* True only in the minute a window opens - the queue drains then. */
function isWindowOpen(now = new Date(), cfg = {}) {
  return hoursOf(cfg).includes(now.getHours()) && now.getMinutes() === 0;
}

function msUntilNextWindow(now = new Date(), cfg = {}) {
  return nextWindow(now, cfg) - now;
}

function describeWait(ms) {
  const m = Math.round(ms / 60000);
  if (m < 60) return m + ' min';
  const h = Math.floor(m / 60);
  return h + 'h ' + (m % 60) + 'm';
}

module.exports = { DEFAULT_WINDOWS, isNight, nextWindow, isWindowOpen, msUntilNextWindow, describeWait, hoursOf };
