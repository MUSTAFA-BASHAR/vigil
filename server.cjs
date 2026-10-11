/* Vigil - zero-dependency HTTP server (static files + a small JSON API).
 * Pure node:http so the demo deploys anywhere with a node runtime and no install.
 */
const http = require('http');
const fs = require('fs');
const path = require('path');
const { Vigil } = require('./lib/agent.cjs');
const { Memory } = require('./lib/memory.cjs');
const { Ledger } = require('./lib/ledger.cjs');
const { isLive, MODELS } = require('./lib/nemotron.cjs');
const W = require('./lib/windows.cjs');
const scenario = require('./lib/scenario.cjs');

const PORT = process.env.PORT || 7817;
const PUBLIC = path.join(__dirname, 'public');

/* A demo clock. The product uses the real clock; the demo needs to walk
 * through a whole day in three minutes, so the server keeps an offset and
 * labels it plainly in the UI. */
let offsetMs = 0;
const now = () => new Date(Date.now() + offsetMs);

const agent = new Vigil({
  memory: new Memory(),
  ledger: new Ledger({ ceiling: 6000, perTx: 2500, currency: 'MYR' }),
});

// seed the facts the agent was told once and should never be told again
for (const f of scenario.seedMemory) agent.memory.write(f);


/* Every endpoint returns the same shape. The UI renders from one state object,
 * so a partial payload from any single route would break it. */
const fullState = () => ({
  ...agent.state(now()),
  live: isLive(),
  model: isLive() ? MODELS.fast : 'local stub (no NEBIUS_API_KEY set)',
  offsetMinutes: Math.round(offsetMs / 60000),
  windows: W.hoursOf({}),
  inbox: scenario.inbox.map(({ id, from, subject, body, hint }) => ({ id, from, subject, body, hint })),
});

const TYPES = {
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8', '.svg': 'image/svg+xml', '.png': 'image/png',
  '.json': 'application/json; charset=utf-8', '.ico': 'image/x-icon',
};

const json = (res, code, obj) => {
  const b = Buffer.from(JSON.stringify(obj));
  res.writeHead(code, { 'Content-Type': 'application/json; charset=utf-8', 'Content-Length': b.length, 'Cache-Control': 'no-store' });
  res.end(b);
};

const readBody = (req) => new Promise((resolve) => {
  let b = '';
  req.on('data', (c) => { b += c; if (b.length > 1e6) req.destroy(); });
  req.on('end', () => { try { resolve(b ? JSON.parse(b) : {}); } catch { resolve({}); } });
});

function serveStatic(req, res) {
  const url = new URL(req.url, 'http://x');
  let p = decodeURIComponent(url.pathname);
  if (p === '/') p = '/index.html';
  const file = path.join(PUBLIC, path.normalize(p));
  if (!file.startsWith(PUBLIC) || !fs.existsSync(file) || fs.statSync(file).isDirectory()) {
    res.writeHead(404, { 'Content-Type': 'text/plain' });
    return res.end('not found');
  }
  const body = fs.readFileSync(file);
  res.writeHead(200, { 'Content-Type': TYPES[path.extname(file)] || 'application/octet-stream', 'Content-Length': body.length });
  res.end(body);
}

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, 'http://x');
  const p = url.pathname;

  try {
    if (p === '/api/state') {
      return json(res, 200, fullState());
    }

    if (p === '/api/triage' && req.method === 'POST') {
      const { id, item } = await readBody(req);
      const chosen = item || scenario.inbox.find((i) => i.id === id);
      if (!chosen) return json(res, 400, { error: 'no such item' });
      const decision = await agent.triage(chosen, now());
      return json(res, 200, { decision, state: fullState() });
    }

    if (p === '/api/window' && req.method === 'POST') {
      return json(res, 200, { result: agent.openWindow(now()), state: fullState() });
    }

    if (p === '/api/clock' && req.method === 'POST') {
      const { hour, minute = 0, reset } = await readBody(req);
      if (reset) offsetMs = 0;
      else {
        const target = new Date();
        target.setHours(Number(hour), Number(minute), 0, 0);
        offsetMs = target - new Date();
      }
      return json(res, 200, { state: fullState(), offsetMinutes: Math.round(offsetMs / 60000) });
    }

    if (p === '/api/spend' && req.method === 'POST') {
      const { amount, purpose, expectedReturn, approvedBy } = await readBody(req);
      const gate = agent.ledger.gate({ amount: Number(amount), purpose, expectedReturn: expectedReturn ?? null });
      if (!gate.allowed) {
        agent.note('gate', 'refused ' + amount + ': ' + gate.reasons.join('; '));
        return json(res, 200, { gate, recorded: null, state: fullState() });
      }
      if (!approvedBy) {
        agent.note('gate', 'passed the ceiling, now waiting for a human: ' + purpose);
        return json(res, 200, { gate, recorded: null, awaiting: 'human approval', state: fullState() });
      }
      const rec = agent.ledger.record({ amount: Number(amount), purpose, expectedReturn, approvedBy });
      agent.note('spend', purpose + ' - ' + amount + ' (approved by ' + approvedBy + ')');
      return json(res, 200, { gate, recorded: rec, state: fullState() });
    }

    if (p === '/api/reset' && req.method === 'POST') {
      agent.queue.length = 0; agent.log.length = 0; agent.delivered.length = 0;
      offsetMs = 0;
      return json(res, 200, { state: fullState() });
    }

    if (p === '/healthz') return json(res, 200, { ok: true, live: isLive() });

    return serveStatic(req, res);
  } catch (e) {
    return json(res, 500, { error: String(e.message || e) });
  }
});

server.listen(PORT, () => {
  console.log('Vigil on http://localhost:' + PORT);
  console.log('Token Factory: ' + (isLive() ? 'live (' + MODELS.fast + ')' : 'STUB - set NEBIUS_API_KEY for real inference'));
});
