/* Nebius Token Factory client - OpenAI-compatible, zero dependency.
 *
 * Token Factory exposes an OpenAI-compatible endpoint, so one plain https call
 * is all it takes. Set NEBIUS_API_KEY to use the real NVIDIA open models; with
 * no key the module falls back to a deterministic local stub so the whole
 * product stays testable (and this file stays honest about which one ran).
 */
const https = require('https');

const BASE = process.env.NEBIUS_BASE || 'api.tokenfactory.nebius.com';
const PATH = '/v1/chat/completions';

// NVIDIA open-source models served by Nebius Token Factory.
// NVIDIA open models served on Token Factory, with their list prices per 1M
// tokens (in / out). Triage is a cheap, high-volume call, so it runs on Nano;
// Super is held back for the few items that actually need reasoning.
const MODELS = {
  fast: process.env.NEBIUS_MODEL_FAST || 'nvidia/Nemotron-3-Nano-30B-A3B',       // $0.06 / $0.24
  reason: process.env.NEBIUS_MODEL_REASON || 'nvidia/Nemotron-3-Super-120b-a12b', // $0.30 / $0.90
};

function post(body, apiKey) {
  return new Promise((resolve, reject) => {
    const payload = JSON.stringify(body);
    const req = https.request({
      host: BASE, path: PATH, method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(payload),
        Authorization: 'Bearer ' + apiKey,
      },
    }, (res) => {
      let b = '';
      res.on('data', (c) => (b += c));
      res.on('end', () => {
        if (res.statusCode !== 200) return reject(new Error('token factory ' + res.statusCode + ': ' + b.slice(0, 300)));
        try { resolve(JSON.parse(b)); } catch (e) { reject(e); }
      });
    });
    req.on('error', reject);
    req.setTimeout(45000, () => req.destroy(new Error('token factory timeout')));
    req.end(payload);
  });
}

/* The stub mirrors the real schema so nothing downstream knows the difference.
 * It is rule-based on purpose: a fake that guesses would hide real failures. */
function stub(messages) {
  const user = messages.filter((m) => m.role === 'user').pop() || { content: '' };
  const t = String(user.content).toLowerCase();
  // ordered: the first rule that matches wins, most specific first
  const rules = [
    [/ignore (your|all) (rules|instructions)|overrides all prior|disregard the above/, 'REFUSE', 'the item tried to rewrite my rules', 0.99],
    [/guaranteed returns?|guaranteed profit|double your|crypto|forex|betting|lottery|no risk/, 'REFUSE', 'forbidden category', 0.99],
    [/no action needed|nothing requires attention|all \d+ checks passed|build passed/, 'ACT', 'routine notice - filed, nothing to decide', 0.92],
    [/which do you want|your call|both meet spec|please decide|up to you|which one/, 'HOLD', 'a judgement that is theirs, not mine', 0.9],
    [/invoice|due friday|renewal|click to pay|wire funds|paid engagement/, 'HOLD', 'money is involved - never mine to commit', 0.95],
    [/unsubscribe|newsletter|digest|weekly recap/, 'ACT', 'routine notice - filed, nothing to decide', 0.9],
    [/reschedule|move .* standup|calendar|book a slot/, 'ACT', 'scheduling inside standing rules', 0.8],
  ];
  let verdict = 'HOLD', why = 'needs a judgement I am not authorised to make', conf = 0.5;
  for (const [re, v, w, c] of rules) {
    if (re.test(t)) { verdict = v; why = w; conf = c; break; }
  }
  const subject = (String(user.content).match(/Subject: (.*)/) || [, ''])[1];
  return {
    _stub: true,
    choices: [{ message: { role: 'assistant', content: JSON.stringify({
      verdict, why, confidence: conf,
      handover: verdict === 'ACT' ? '' : subject + ' - ' + why,
      learned: '',
    }) } }],
    usage: { prompt_tokens: 0, completion_tokens: 0, total_tokens: 0 },
  };
}

async function chat({ messages, model = 'fast', temperature = 0.2, maxTokens = 400, json = false }) {
  const apiKey = process.env.NEBIUS_API_KEY;
  if (!apiKey) return { ...stub(messages), model: 'stub', live: false };
  const body = {
    model: MODELS[model] || model,
    messages,
    temperature,
    max_tokens: maxTokens,
  };
  if (json) body.response_format = { type: 'json_object' };
  const r = await post(body, apiKey);
  return { ...r, model: body.model, live: true };
}

const isLive = () => Boolean(process.env.NEBIUS_API_KEY);

module.exports = { chat, isLive, MODELS };
