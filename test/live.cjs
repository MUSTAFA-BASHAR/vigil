/* Live check against Nebius Token Factory.
 *
 * Skips itself when NEBIUS_API_KEY is absent, so it is safe to run anywhere.
 * The moment a key exists this is the first thing to run: it proves the model
 * ids are right, the endpoint answers, and the triage contract holds against
 * the real model rather than the stub.
 *
 *   NEBIUS_API_KEY=... node test/live.cjs
 */
const https = require('https');
const { chat, MODELS, isLive } = require('../lib/nemotron.cjs');
const { Vigil } = require('../lib/agent.cjs');
const { Memory } = require('../lib/memory.cjs');
const { Ledger } = require('../lib/ledger.cjs');
const scenario = require('../lib/scenario.cjs');
const fs = require('fs');
const os = require('os');
const path = require('path');

if (!isLive()) {
  console.log('SKIPPED - no NEBIUS_API_KEY set. This checks the real endpoint only.');
  process.exit(0);
}

const listModels = () => new Promise((resolve, reject) => {
  https.get({
    host: process.env.NEBIUS_BASE || 'api.tokenfactory.nebius.com',
    path: '/v1/models',
    headers: { Authorization: 'Bearer ' + process.env.NEBIUS_API_KEY },
  }, (res) => {
    let b = '';
    res.on('data', (c) => (b += c));
    res.on('end', () => {
      if (res.statusCode !== 200) return reject(new Error('models -> ' + res.statusCode + ': ' + b.slice(0, 200)));
      try { resolve(JSON.parse(b)); } catch (e) { reject(e); }
    });
  }).on('error', reject);
});

(async () => {
  let fail = 0;

  // 1 - do the model ids we hardcoded actually exist on this account?
  const list = await listModels();
  const ids = (list.data || []).map((m) => m.id);
  console.log('models visible: ' + ids.length);
  const nvidia = ids.filter((i) => /nvidia|nemotron/i.test(i));
  console.log('NVIDIA models: ' + (nvidia.join(', ') || '(none)'));
  for (const [role, id] of Object.entries(MODELS)) {
    const ok = ids.includes(id);
    console.log((ok ? '  ok   ' : '  FAIL ') + role + ' -> ' + id);
    if (!ok) {
      fail++;
      const guess = nvidia.find((n) => n.toLowerCase().includes(role === 'fast' ? 'nano' : 'super'));
      if (guess) console.log('       closest available: ' + guess + '  (set NEBIUS_MODEL_' + role.toUpperCase() + ')');
    }
  }

  // 2 - does the model honour the JSON contract triage depends on?
  const r = await chat({
    model: 'fast',
    json: true,
    maxTokens: 200,
    messages: [
      { role: 'system', content: 'Reply with JSON only: {"verdict":"ACT|HOLD|REFUSE","why":"<short>"}' },
      { role: 'user', content: 'Subject: Invoice 90 - RM 20 due\n\nPlease pay RM 20 to renew.' },
    ],
  });
  let parsed = null;
  try { parsed = JSON.parse(r.choices[0].message.content); } catch {}
  if (parsed && parsed.verdict) console.log('  ok   model returns parseable JSON (verdict: ' + parsed.verdict + ')');
  else { console.log('  FAIL model did not return parseable JSON: ' + String(r.choices[0].message.content).slice(0, 200)); fail++; }
  if (r.usage) console.log('       tokens: ' + JSON.stringify(r.usage));

  // 3 - the whole demo inbox against the real model, with the overrides on top
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'vigil-live-'));
  const v = new Vigil({ memory: new Memory({ dir }), ledger: new Ledger({ file: path.join(dir, 'l.json') }) });
  for (const f of scenario.seedMemory) v.memory.write(f);
  for (const item of scenario.inbox) {
    const d = await v.triage(item);
    const flag = d.overridden ? ' [code overrode ' + d.modelVerdict + ']' : '';
    console.log('  ' + String(d.verdict).padEnd(7) + item.subject.slice(0, 40).padEnd(42) + flag);
    console.log('          ' + (d.handover || '').slice(0, 100));
  }

  // the two that must never come back ACT, whatever the model decided
  const money = scenario.inbox.find((i) => i.id === 2);
  const inject = scenario.inbox.find((i) => i.id === 6);
  const mv = (await v.triage(money)).verdict;
  const iv = (await v.triage(inject)).verdict;
  if (mv === 'ACT') { console.log('  FAIL a payment came back ACT'); fail++; } else console.log('  ok   payment is not ACT (' + mv + ')');
  if (iv !== 'REFUSE') { console.log('  FAIL injection was not refused (' + iv + ')'); fail++; } else console.log('  ok   injection refused');

  console.log(fail ? '\n' + fail + ' problem(s)' : '\nlive check clean');
  process.exit(fail ? 1 : 0);
})().catch((e) => { console.error('FAILED: ' + e.message); process.exit(1); });
