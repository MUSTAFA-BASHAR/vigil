# Vigil

**An always-on personal agent that is not an always-on interruption.**

Built for the [Nebius × NVIDIA Global AI Hackathon](https://nebiusglobalaihackathon.devpost.com/) — Personal AI track.
Runs on **Nebius Token Factory** with **NVIDIA Nemotron** open models.

---

## The problem this actually solves

Most personal agents are built to do more. The thing that stops people leaving one
running is not that it does too little — it is that it does too much *to you*:
it pings at midnight, it spends money it should have asked about, and it forgets
on Tuesday what you told it on Monday.

Vigil is built around the three disciplines an agent needs before anyone will
leave it alone with their life:

| Discipline | What it means | Where it lives |
|---|---|---|
| **Attention windows** | Everything needing a decision is batched and handed over at fixed hours. Nothing reaches the human between 19:00 and 07:00 — urgency does not override it. | `lib/windows.cjs` |
| **Durable memory** | One file per fact. It survives a restart, the human can read and correct it, and recall is by relevance, not by replaying everything. | `lib/memory.cjs` |
| **A hard spending ceiling** | Every payment passes a gate that is arithmetic over a ledger, not a sentence in a prompt. A proposal without an expected return is refused. | `lib/ledger.cjs` |

These are not hypothetical requirements. They are the rules a real person set for
a real agent before being willing to let it run unattended, which is the whole
reason the project is shaped this way.

## How the model is used

For each inbound item, **Nemotron 3 Nano** on Token Factory returns one of three verdicts:

- **ACT** — covered by the standing rules, so the agent handles it and only mentions it in the next digest.
- **HOLD** — a judgement that belongs to the human. It waits for a window.
- **REFUSE** — a hard rule forbids it, and no rephrasing changes that.

Triage is a cheap, high-volume call, so it runs on **Nano** (`$0.06 / $0.24` per 1M tokens);
**Nemotron 3 Super** is held back for items that genuinely need reasoning. Token Factory's
OpenAI-compatible endpoint means the whole client is one plain HTTPS call — no SDK, no build step.

### The model decides; it does not get the last word

The verdict is re-checked in code afterwards (`Vigil.enforce`). The checks only ever move
a decision toward caution — `ACT → HOLD`, or anything → `REFUSE` — never the other way:

- anything touching money cannot be `ACT`, however routine it looks;
- forbidden categories are refused on sight;
- an item instructing the agent to ignore its rules is treated as data, and that attempt is
  itself the reason to refuse it.

An agent that can be argued past its own ceiling is not a safeguard. It is a suggestion.
This is why `test/run.cjs` asserts the override behaviour directly.

## Run it

```bash
git clone <this repo> && cd vigil
node server.cjs            # http://localhost:7817
```

No dependencies, no install step, no build. Node 18+ (uses `node:http` and the built-in fetch).

With no API key it runs a deterministic local stub so the full product works offline —
useful for review, and it keeps the demo honest about which path ran (the header says which).

For real inference:

```bash
export NEBIUS_API_KEY=...        # from https://tokenfactory.nebius.com
node server.cjs
```

Optional overrides: `NEBIUS_BASE`, `NEBIUS_MODEL_FAST`, `NEBIUS_MODEL_REASON`, `PORT`.

### Tests

```bash
node test/run.cjs            # 14 tests, no framework
```

They cover the parts that must hold when the model is wrong: night is absolute, the
ceiling is for the whole engagement rather than per payment, a spend cannot be recorded
without a human approver, memory survives a restart, and a prompt-injection attempt is refused.

## Trying the demo

The clock is the demo. Move it with the buttons in the strip:

1. Set **18:00**, press **Run the whole inbox**. Eight items, mixed on purpose — some the
   agent should clearly handle alone, some genuinely the human's call, two that must be refused.
2. Watch the **held** column fill. Nothing there has reached a human yet.
3. Press **Open the window** — all of it arrives as one batch, with one line each.
4. Set **22:00** and try again. The window will not open, and the queue stays intact.
5. Ask the **spending gate** for RM 20 with no expected return, then with one.

The day bar shows the quiet hours as hatched bands, the three windows as ticks, and
where "now" sits.

## Layout

```
server.cjs          zero-dependency HTTP server + JSON API
lib/nemotron.cjs    Token Factory client (OpenAI-compatible) + offline stub
lib/agent.cjs       the triage loop and the overrides the model cannot bypass
lib/windows.cjs     attention windows and the night rule
lib/memory.cjs      one file per fact, recall by relevance
lib/ledger.cjs      the spending gate
lib/scenario.cjs    demo inbox and seeded facts
public/             the interface (no framework, no build)
test/run.cjs        14 tests
```

## Licence

MIT — see [LICENSE](LICENSE).
