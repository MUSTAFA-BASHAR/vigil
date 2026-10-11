/* Discipline 2 - durable memory, one file per fact.
 *
 * A context window ends; the agent should not. Each fact is its own small file
 * with front matter, so memory survives a restart, can be read and corrected by
 * the human, and is recalled by relevance instead of being replayed whole.
 */
const fs = require('fs');
const path = require('path');

const TYPES = ['person', 'preference', 'constraint', 'commitment', 'reference'];

const slug = (s) => String(s).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 60) || 'fact';

const STOP = new Set(['the','a','an','and','or','of','to','in','is','it','for','on','at','with','my','his','her','their','this','that','he','she','they','i','you','be','as','by','from','not','no','do','does','if','when','what','who','how']);
const tokens = (s) => String(s).toLowerCase().match(/[a-z0-9\u0600-\u06ff]+/g) || [];
const keywords = (s) => tokens(s).filter((w) => w.length > 2 && !STOP.has(w));

class Memory {
  constructor({ dir } = {}) {
    this.dir = dir || path.join(__dirname, '..', 'data', 'memory');
    fs.mkdirSync(this.dir, { recursive: true });
  }

  write({ name, description, type = 'reference', body, why = '' }) {
    if (!TYPES.includes(type)) throw new Error('unknown memory type: ' + type);
    const n = slug(name);
    const file = path.join(this.dir, n + '.md');
    const front = [
      '---',
      'name: ' + n,
      'description: ' + String(description || '').replace(/\n/g, ' '),
      'type: ' + type,
      'written: ' + new Date().toISOString(),
      '---',
      '',
    ].join('\n');
    const text = front + String(body || description || '').trim() + (why ? '\n\n**Why:** ' + why : '') + '\n';
    fs.writeFileSync(file, text, 'utf8');
    return { name: n, file };
  }

  all() {
    return fs.readdirSync(this.dir).filter((f) => f.endsWith('.md')).map((f) => {
      const raw = fs.readFileSync(path.join(this.dir, f), 'utf8');
      const m = raw.match(/^---\n([\s\S]*?)\n---\n?([\s\S]*)$/);
      const meta = {};
      if (m) for (const line of m[1].split('\n')) {
        const i = line.indexOf(':');
        if (i > 0) meta[line.slice(0, i).trim()] = line.slice(i + 1).trim();
      }
      return { name: meta.name || f.replace(/\.md$/, ''), description: meta.description || '', type: meta.type || 'reference', written: meta.written || '', body: (m ? m[2] : raw).trim(), file: f };
    });
  }

  /* Recall by overlap between the query and each fact's words - deliberately
   * simple and inspectable. The human can see why a fact surfaced. */
  recall(query, limit = 5) {
    const q = new Set(keywords(query));
    if (!q.size) return [];
    return this.all().map((f) => {
      const words = new Set(keywords(f.name + ' ' + f.description + ' ' + f.body));
      let hits = 0;
      for (const w of q) if (words.has(w)) hits++;
      return { ...f, score: hits / q.size, hits };
    }).filter((f) => f.hits > 0).sort((a, b) => b.score - a.score).slice(0, limit);
  }

  forget(name) {
    const file = path.join(this.dir, slug(name) + '.md');
    if (!fs.existsSync(file)) return false;
    fs.unlinkSync(file);
    return true;
  }
}

module.exports = { Memory, TYPES, slug };
