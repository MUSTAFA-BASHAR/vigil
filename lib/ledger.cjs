/* Discipline 3 - a hard spending ceiling.
 *
 * Every payment passes this gate. The ceiling is not advice the model can be
 * argued out of: it is arithmetic over a ledger on disk. An agent that can
 * persuade itself to spend more is an agent you cannot leave running.
 */
const fs = require('fs');
const path = require('path');

const FORBIDDEN = [
  'trading', 'forex', 'crypto', 'nft', 'betting', 'gambling',
  'mlm', 'pyramid', 'guaranteed return', 'guaranteed profit',
];

class Ledger {
  constructor({ file, ceiling = 6000, perTx = 2500, currency = 'MYR' } = {}) {
    this.file = file || path.join(__dirname, '..', 'data', 'ledger.json');
    this.ceiling = ceiling;   // minor units (cents), for the whole file - not per payment
    this.perTx = perTx;
    this.currency = currency;
    this.entries = [];
    this.load();
  }

  load() {
    try {
      const j = JSON.parse(fs.readFileSync(this.file, 'utf8'));
      this.entries = j.entries || [];
      if (typeof j.ceiling === 'number') this.ceiling = j.ceiling;
    } catch { this.entries = []; }
  }

  save() {
    fs.mkdirSync(path.dirname(this.file), { recursive: true });
    fs.writeFileSync(this.file, JSON.stringify({ ceiling: this.ceiling, currency: this.currency, entries: this.entries }, null, 2));
  }

  spent() { return this.entries.filter((e) => e.kind === 'spend').reduce((s, e) => s + e.amount, 0); }
  remaining() { return this.ceiling - this.spent(); }

  /* Returns a decision, never a side effect. Nothing is recorded by asking. */
  gate({ amount, purpose = '', expectedReturn = null }) {
    const reasons = [];
    if (!Number.isInteger(amount) || amount <= 0) reasons.push('amount must be a positive integer in minor units');
    const low = String(purpose).toLowerCase();
    const hit = FORBIDDEN.find((f) => low.includes(f));
    if (hit) reasons.push('forbidden category: ' + hit);
    if (amount > this.perTx) reasons.push('over the per-payment cap (' + this.perTx + ')');
    if (amount > this.remaining()) reasons.push('over the remaining ceiling (' + this.remaining() + ' of ' + this.ceiling + ')');
    if (expectedReturn === null) reasons.push('no expected return stated - a cost without a number to beat is not a proposal');
    return reasons.length
      ? { allowed: false, reasons, remaining: this.remaining() }
      : { allowed: true, reasons: [], remaining: this.remaining() - amount };
  }

  /* A spend is only recorded after the gate allowed it AND a human approved it.
   * Both flags are required here so the order cannot be fudged upstream. */
  record({ amount, purpose, expectedReturn, approvedBy }) {
    const g = this.gate({ amount, purpose, expectedReturn });
    if (!g.allowed) throw new Error('gate refused: ' + g.reasons.join('; '));
    if (!approvedBy) throw new Error('a spend needs a human approver');
    const e = { kind: 'spend', amount, purpose, expectedReturn, approvedBy, at: new Date().toISOString() };
    this.entries.push(e);
    this.save();
    return { entry: e, remaining: this.remaining() };
  }

  recordIncome({ amount, source }) {
    const e = { kind: 'income', amount, source, at: new Date().toISOString() };
    this.entries.push(e);
    this.save();
    return e;
  }

  income() { return this.entries.filter((e) => e.kind === 'income').reduce((s, e) => s + e.amount, 0); }
}

module.exports = { Ledger, FORBIDDEN };
