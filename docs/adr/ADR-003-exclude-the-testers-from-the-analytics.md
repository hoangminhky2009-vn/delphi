# ADR-003 — Exclude the testers from the analytics, say how much was excluded, keep one door open

- **Status:** accepted, 2026-09-01 · **Source:** private decision-log entry D212 (and its correction, [ADR-004](ADR-004-a-mapping-the-schema-does-not-state-is-a-hypothesis.md))
- **Lens:** data · analytics

## Context

The author asked that the analytics dashboard stop showing admin behaviour, to avoid noise. Before designing, production was measured:

| table | admin share | total | % |
|---|---|---|---|
| `users` | 2 | 26 | 8 % |
| `holdem_matches` | 72 | 86 | **84 %** |
| `events` | 1,074 | 1,292 | **83 %** |
| `telemetry` | 911 | 1,525 | 60 % |
| `hanh_vi_tran` (per-match behaviour) | 72 | 86 | 84 % |
| `ho_so_goi` (personality profiles) | 1 | 1 | **100 %** |

**8 % of the accounts produced 84 % of the behavioural data.** The analytics surface was not a portrait of players; it was a mirror held up to the person testing the product. After excluding admins, production had **14 matches (5 finished) and 0 personality profiles**: the real picture was "no meaningful player data yet", hidden by the testing activity.

## Decision — four boundaries, each with a reason

1. **Filter on the server, inside the SQL.** A filter in the UI still ships the data out of the server and drifts away from the query.
2. **Exclude by default, with a switch (`?gom_admin=1`) to include.** Admins legitimately need to check whether their own action produced an event; removing the path pushes them to ad-hoc SQL, where no filter exists at all.
3. **Always report how much was excluded** (`da_loai: {accounts, matches, events}` plus one line on the dashboard). After filtering, many panels are nearly empty, and *an empty panel with no explanation is read as "the dashboard is broken"*.
4. **Two doors are deliberately not filtered:** the raw-data store card (filtering would break its contract) and looking up a single user by id (the admin asked for exactly that person).

Implementation notes that carry a reason:
- The exclusion clause deliberately takes **no bind parameter**: it is a constant sub-select that can be dropped into any `WHERE` without shifting `$n` numbering. In a 1,200-line file with ~40 hand-numbered queries, a fence that needs one more `$n` breaks parameter alignment somewhere around the tenth — and that kind of break *does not crash, it returns wrong numbers*.
- `IS NULL OR` is required, not tidiness: `x NOT IN (…)` yields `NULL`, not `TRUE`, when `x` is `NULL`, silently dropping every row with no user (system events, anonymous telemetry).
- The sample-size gate for personality profiles is applied inside the single function that decides who enters the sample (`cuaGopHoSo`), so every surface that reuses it is filtered without remembering to be.

## Verification

Tests first: 12 tests, **8 red** at the start, driven to green — they pointed at exactly the endpoints that would have been forgotten. Three faults injected: disabling the exclusion (6 red), removing it from the sample gate (1), removing the `da_loai` block (2).

The decision entry also records that **two of the author's own tests were vacuous and green from the start** — one asserted `not.toContain(handle)` against a funnel that never returns handles. Injecting the fault is what exposed it. This is the reason [ADR-011](ADR-011-acceptance-means-breaking-the-code-on-purpose.md) exists.

## Consequences

The heuristic "admin ⇒ not a real player" is a guess. A first-class column (`users.la_tester`, migration 0052) was added so that the schema itself can answer "is this account a test account?" — see [ADR-004](ADR-004-a-mapping-the-schema-does-not-state-is-a-hypothesis.md) for why that mattered.
