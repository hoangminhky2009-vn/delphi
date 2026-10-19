# ADR-010 — Store inputs, not outcomes: a deterministic engine whose replay *is* the match

- **Status:** accepted — foundation of the arena since July 2026 · **Source:** [`docs/dac-ta/01-gameplay.md`](../dac-ta/01-gameplay.md) §B, the schema comments, and the replay-regression test header
- **Lens:** engineering · data

## Context

The arena is a turn-based investing game over generated markets. The product needs, at the same time:

1. matches that can be **replayed exactly** (to rebuild derived data, to audit, to debug a player's report);
2. a **small, cheap database** on a free tier;
3. **rule changes** over time without silently rewriting history.

## Decision

A match is `taoTran(seed, seats, rules, board)`. Everything — the map, the bots, the cards on offer — is derived from the **seed** plus the **action log**. The database stores *inputs* (seed, rule-set version, action log) and **not** the unfolding of the game; each request rebuilds the state by replaying the log.

Consequences that are accepted and made explicit:

- **`replay(seed, action_log, rules)` defines the identity of a match.** Whatever it returns today *is* the stored result. Therefore **changing any calculation rewrites the result of every stored match** — this is a one-way door.
- The door has a gate: every rule change ships as a new **`balance_version`**, with a Monte Carlo gate (G1–G4 measurements over thousands of simulated matches) and golden regression; old versions must keep matching their old results. A change that makes an old version stop matching is not "adding a version", it is "rewriting history", which the gate exists to prevent.
- Derived tables (behaviour per match, per round) are **rebuildable by replay** and are therefore allowed to be wrong and fixed (see [ADR-002](ADR-002-flag-the-rounds-the-crowd-edited.md)); the append-only event log is not.

## Verification

The replay-regression test replays a corpus of matches — including real ones recorded from production play — and compares the entire output to a fixture. Its header states the rule in capitals: *change the code to make the test green, never the fixture*; the fixture may only be replaced when a **new** `balance_version` deliberately changes behaviour **and** its measurement gate passes, and the previous versions must still match. A second guard reads the live matrix generator so the corpus cannot be quietly shrunk.

## Trade-offs

- Replaying the log on every request costs CPU (measured in the load tests, see [`docs/gioi-han-ha-tang.md`](../gioi-han-ha-tang.md)); an optimisation that removed one of two full replays per round was done *behind* the golden test, not before it.
- Debugging needs the seed and the log, not a snapshot — a deliberate preference for reproducibility over convenience.
