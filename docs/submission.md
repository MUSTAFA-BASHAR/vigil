# Devpost submission text — Vigil

> Draft. Everything here is already true of the built project except the two
> lines marked `[after key]`, which can only be filled once live inference has
> run. Nothing in this file claims a capability that is not in the repo.

---

## Elevator pitch (one line)

An always-on personal agent that is not an always-on interruption.

## Track

Personal AI

---

## Inspiration

Every personal-agent demo answers the same question: *how much more can it do?*
That is not the question stopping people from leaving one running.

The real blockers are mundane and all about restraint. An agent that pings you at
midnight gets muted. An agent that spends money without asking gets uninstalled.
An agent that forgets on Tuesday what you told it on Monday never gets trusted
with anything that matters.

Vigil was built the other way round. It starts from the three rules a person
actually imposes before handing an agent their life, and makes those rules the
product rather than the disclaimer.

## What it does

Vigil watches an inbound stream and sorts each item into exactly one of three outcomes:

- **ACT** — covered by the standing rules, so it handles the item itself and only
  mentions it in the next digest.
- **HOLD** — a judgement that belongs to the human. It waits.
- **REFUSE** — a hard rule forbids it, and no rephrasing changes that.

Around that loop sit the three disciplines:

**Attention windows.** Everything needing a decision is batched and delivered at
fixed hours — 07:00, 13:00, 19:00 — and *nothing* reaches the human between 19:00
and 07:00. Urgency does not override it, because an exception that can be claimed
is an exception that will be claimed. In the demo you can move the clock to 22:00
and watch the window refuse to open with the queue still intact.

**Durable memory.** One file per fact, with front matter. It survives a restart,
the human can read and correct it by hand, and recall is by relevance rather than
replaying everything into the context. When a stored preference changes a verdict,
the interface says which fact it used — so the memory is auditable, not magic.

**A hard spending ceiling.** Every payment passes a gate that is arithmetic over a
ledger on disk, not a sentence in a prompt. A proposal with no stated expected
return is refused outright: a cost with no number to beat is not a proposal. The
ceiling covers the whole engagement rather than each payment, so it cannot be
drained in slices.

## How we built it

The whole thing is **zero-dependency**: `node:http`, `node:fs` and one HTTPS call.
No framework, no build step, no `npm install`. Clone it and run `node server.cjs`.

**Nebius Token Factory** made that possible. Because the endpoint is
OpenAI-compatible, the entire model client is one plain `https.request` —
about forty lines in `lib/nemotron.cjs`, no SDK pulled in, nothing to keep in
sync. That is the difference between a demo that still runs in a year and one
that rots the first time a dependency moves.

**NVIDIA Nemotron** does the triage. Each item gets `Nemotron 3 Nano`
(`$0.06 / $0.24` per 1M tokens) because triage is a cheap, high-volume call and
Nano is quick enough that the interface feels instant; `Nemotron 3 Super` is held
in reserve for the minority of items that genuinely need reasoning. Routing by
difficulty rather than defaulting everything to the largest model is the thing
that makes an always-on agent affordable to actually leave on.

**The model decides, but it does not get the last word.** Every verdict is
re-checked in code afterwards, and the checks only ever move a decision toward
caution — `ACT → HOLD`, or anything → `REFUSE`, never the reverse:

- anything touching money cannot be `ACT`, however routine it looks;
- forbidden categories are refused on sight;
- an item instructing the agent to ignore its rules is treated as data, and that
  attempt is itself the reason to refuse it.

This is the part we would defend hardest. An agent that can be argued past its own
ceiling is not a safeguard, it is a suggestion — so `test/run.cjs` asserts the
override behaviour directly, including a prompt-injection attempt.

## Challenges we ran into

Writing the night rule honestly was harder than it sounds. Every sensible-looking
exception — "but this one is urgent", "but they are clearly awake" — reintroduces
exactly the behaviour that makes people mute an agent. We ended up making the
quiet hours absolute and testing that the queue survives a refused window, because
a rule with an escape hatch is a preference, not a rule.

The second was resisting feature creep in the opposite direction. Half the judging
weight here is design and the quality of the idea, and the temptation with an agent
is to add capabilities. The restraint *is* the feature, so the work went into making
three disciplines legible rather than ten features present.

## Accomplishments that we are proud of

- It runs with **no dependencies at all** — the honest version of "easy to run".
- 14 tests, no framework, covering the parts that must hold *when the model is wrong*.
- With no API key it falls back to a deterministic local stub, so a reviewer who
  clones the repo sees the real product immediately — and the header states plainly
  which path is running, so the demo never overstates itself.

## What we learned

Routing by difficulty is the whole economics of an always-on agent. An agent that
calls the biggest model for every trivial notice is one nobody can afford to leave
running, which means the restraint that makes it pleasant is the same restraint
that makes it viable. Nano for triage, Super for the few items that earn it.

## What's next for Vigil

Real adapters in place of the demo inbox — email, calendar, issue trackers — with
the same three disciplines wrapped around them. Then per-source learning: when an
item is held and the human answers the same way three times, that answer should
become a standing rule the agent applies alone, and the queue should get shorter
every week it runs.

## Built with

`node.js` · `nebius-token-factory` · `nvidia-nemotron` · `zero-dependencies` · `vanilla-js`

## Links

- Repository: `[after key]`
- Live demo: `[after key]`
- Video: `[after key]`

---

## Required-fields checklist

| # | Requirement | Status |
|---|---|---|
| 1 | Runs on Token Factory, uses an NVIDIA open model | client written; **needs the key to run live** |
| 2 | Working hosted demo URL | runs locally; hosting pending |
| 3 | Public repo + licence visible + README with setup | LICENSE (MIT) and README written |
| 4 | Public YouTube video under 3 minutes | recorder built and proven; **upload needs sign-in** |
| 5 | Description naming where Nemotron and Token Factory were used | this document |
| 6 | New, or significantly updated during the submission period | new, built 2026-10-11 onward |
