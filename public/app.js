/* Vigil front end - no framework, no build step. */

const $ = (s) => document.querySelector(s);
const el = (tag, cls, text) => {
  const n = document.createElement(tag);
  if (cls) n.className = cls;
  if (text !== undefined) n.textContent = text;
  return n;
};
const api = async (path, body) => {
  const res = await fetch(path, body
    ? { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) }
    : undefined);
  if (!res.ok) throw new Error(path + ' -> ' + res.status);
  return res.json();
};
const money = (sen) => 'RM ' + (sen / 100).toFixed(2);

let decided = new Map(); // itemId -> decision

/* ---------- the day bar: night band, window ticks, where "now" sits ---------- */
function paintDay(state) {
  const track = $('#dayTrack');
  track.textContent = '';
  const pct = (h) => (h / 24) * 100;

  // night runs 19:00 -> 07:00, so it wraps midnight and needs two bands
  for (const [a, b] of [[19, 24], [0, 7]]) {
    const band = el('div', 'night-band');
    band.style.left = pct(a) + '%';
    band.style.width = (pct(b) - pct(a)) + '%';
    track.appendChild(band);
  }
  for (const h of state.windows) {
    const tick = el('div', 'win');
    tick.style.left = pct(h) + '%';
    tick.title = String(h).padStart(2, '0') + ':00 window';
    track.appendChild(tick);
  }
  const now = new Date(state.now);
  const head = el('div', 'head');
  head.style.left = pct(now.getHours() + now.getMinutes() / 60) + '%';
  track.appendChild(head);
}

/* ---------- render ---------- */
function renderClock(state) {
  const now = new Date(state.now);
  $('#clockTime').textContent =
    String(now.getHours()).padStart(2, '0') + ':' + String(now.getMinutes()).padStart(2, '0');
  const st = $('#clockState');
  st.textContent = state.night ? 'quiet hours' : 'reachable';
  st.className = 'clock-state ' + (state.night ? 'night' : 'awake');
  $('#waitLabel').textContent = state.waitLabel;
  document.body.classList.toggle('night', state.night);
  $('#openWindow').disabled = state.night;
  $('#openWindow').textContent = state.night
    ? 'Night - nothing goes out'
    : 'Open the window now';
  paintDay(state);
}

function renderInbox(state) {
  const box = $('#inbox');
  box.textContent = '';
  $('#inboxCount').textContent = state.inbox.length;
  for (const item of state.inbox) {
    const d = decided.get(item.id);
    const card = el('div', 'item' + (d ? ' done ' + d.verdict : ''));
    card.appendChild(el('div', 'from', item.from));
    card.appendChild(el('div', 'subj', item.subject));
    card.appendChild(el('div', 'body', item.body));

    const row = el('div', 'row');
    if (d) {
      row.appendChild(el('span', 'verdict ' + d.verdict, d.verdict));
      if (d.overridden) row.appendChild(el('span', 'flag', 'code overrode the model'));
    } else {
      const b = el('button', null, 'Send to Vigil');
      b.onclick = () => triage(item.id, b);
      row.appendChild(b);
      row.appendChild(el('span', 'from', item.hint || ''));
    }
    card.appendChild(row);
    if (d) {
      card.appendChild(el('div', 'why', d.why));
      if (d.recalled && d.recalled.length) {
        card.appendChild(el('div', 'recall', 'recalled: ' + d.recalled.join(', ')));
      }
    }
    box.appendChild(card);
  }
}

function renderLog(state) {
  const box = $('#log');
  box.textContent = '';
  if (!state.log.length) {
    box.appendChild(el('div', 'empty', 'Nothing yet. Send an item in.'));
    return;
  }
  for (const e of [...state.log].reverse()) {
    const line = el('div', 'line');
    line.appendChild(el('span', 'k ' + e.kind, e.kind.toUpperCase()));
    line.appendChild(el('span', 't', e.text));
    box.appendChild(line);
  }
}

function renderQueue(state) {
  const box = $('#queue');
  box.textContent = '';
  $('#queueCount').textContent = state.queued;
  if (!state.queue.length) {
    box.appendChild(el('div', 'empty', 'Empty - nothing is waiting on a human.'));
    return;
  }
  for (const q of state.queue) {
    const card = el('div', 'item HOLD');
    card.appendChild(el('div', 'subj', q.subject));
    card.appendChild(el('div', 'why', q.decision.handover));
    card.appendChild(el('div', 'from', 'held since ' + new Date(q.queuedAt).toLocaleTimeString()));
    box.appendChild(card);
  }
}

function renderLedger(state) {
  const l = state.ledger;
  const used = l.ceiling ? Math.min(100, (l.spent / l.ceiling) * 100) : 0;
  $('#meterFill').style.width = used + '%';
  $('#spentLabel').textContent = money(l.spent);
  $('#ceilLabel').textContent = money(l.ceiling);
}

function renderMemory(state) {
  const box = $('#memory');
  box.textContent = '';
  $('#memCount').textContent = state.memory.length;
  for (const m of state.memory) {
    const card = el('div', 'm');
    card.appendChild(el('span', 'ty', m.type));
    card.appendChild(el('div', 'n', m.name));
    card.appendChild(el('div', 'd', m.description));
    box.appendChild(card);
  }
}

function render(state) {
  $('#model').textContent = (state.live ? 'live: ' : 'offline stub: ') + state.model;
  renderClock(state);
  renderInbox(state);
  renderLog(state);
  renderQueue(state);
  renderLedger(state);
  renderMemory(state);
}

/* ---------- actions ---------- */
async function triage(id, btn) {
  if (btn) { btn.disabled = true; btn.textContent = 'thinking...'; }
  const { decision, state } = await api('/api/triage', { id });
  decided.set(id, decision);
  render(state);
}

async function refresh() {
  render(await api('/api/state'));
}

$('#runAll').onclick = async (e) => {
  e.target.disabled = true;
  const state = await api('/api/state');
  for (const item of state.inbox) {
    if (!decided.has(item.id)) await triage(item.id);
  }
  e.target.disabled = false;
};

$('#openWindow').onclick = async () => {
  const { result, state } = await api('/api/window', {});
  const out = $('#windowResult');
  out.textContent = '';
  if (!result.opened) {
    out.appendChild(el('div', 'no', result.reason));
  } else if (!result.count) {
    out.appendChild(el('div', 'ok', 'Window opened with nothing to ask. That is the goal.'));
  } else {
    out.appendChild(el('div', 'ok', 'Handed over ' + result.count + ' item(s) in one batch:'));
    const ul = el('ul');
    for (const line of result.lines) ul.appendChild(el('li', null, line));
    out.appendChild(ul);
  }
  render(state);
};

for (const b of document.querySelectorAll('.clock-actions [data-hour]')) {
  b.onclick = async () => render((await api('/api/clock', { hour: Number(b.dataset.hour) })).state);
}
$('#clockReset').onclick = async () => render((await api('/api/clock', { reset: true })).state);

$('#spendForm').onsubmit = async (e) => {
  e.preventDefault();
  const f = new FormData(e.target);
  const payload = {
    amount: Number(f.get('amount')),
    purpose: String(f.get('purpose')),
    expectedReturn: f.get('expectedReturn') ? Number(f.get('expectedReturn')) : null,
  };
  const { gate, awaiting, state } = await api('/api/spend', payload);
  const out = $('#spendResult');
  out.textContent = '';
  if (gate.allowed) {
    out.appendChild(el('div', 'ok', 'The gate allows it - ' + money(gate.remaining) + ' would remain.'));
    out.appendChild(el('div', null, awaiting ? 'Still not paid: ' + awaiting + ' is required.' : ''));
  } else {
    out.appendChild(el('div', 'no', 'Refused:'));
    const ul = el('ul');
    for (const r of gate.reasons) ul.appendChild(el('li', null, r));
    out.appendChild(ul);
  }
  render(state);
};

refresh();
setInterval(async () => {
  // keep the clock honest without stomping on a render in flight
  try { render(await api('/api/state')); } catch {}
}, 20000);
