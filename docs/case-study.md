# Case study: the analytics dashboard was measuring its author

> **In short.** A request to "hide admin noise" on the analytics dashboard turned into two findings. First, two admin accounts had produced 84 % of all matches, so the dashboard described the tester, not the players. Second, the accounts left after removing admins were not players either: all 26 production accounts were mine. **Result: n real users = 0.** The fix was a default filter, a visible "excluded" count, a schema column for test accounts, and a rule that no document may claim users it cannot show.

Written from two decision records: [ADR-003](adr/ADR-003-exclude-the-testers-from-the-analytics.md) (1 Sep 2026) and [ADR-004](adr/ADR-004-a-mapping-the-schema-does-not-state-is-a-hypothesis.md) (3 Sep 2026).

## 1. Problem

**The request:** "Stop showing my own admin activity on the analytics dashboard; it is noise."

**The question behind it:** can the numbers on this dashboard be read as a description of players? A filter is only the right answer if the remaining data is about players. So before designing the filter, I measured how much of the data the filter would remove.

## 2. Data

Production on 1 Sep 2026, share of rows owned by admin accounts:

| table | admin rows | all rows | admin share |
|---|---|---|---|
| `users` | 2 | 26 | 8 % |
| `holdem_matches` (arena matches) | 72 | 86 | 84 % |
| `events` (append-only behaviour log) | 1,074 | 1,292 | 83 % |
| `telemetry` (interface events) | 911 | 1,525 | 60 % |
| `ho_so_goi` (personality profiles) | 1 | 1 | 100 % |

Two admin accounts out of 26 produced 84 % of the matches. Without them, production held **14 matches (5 finished) and no personality profile at all**. The dashboard's charts were mostly a picture of one person testing the product.

## 3. Decision, part 1 — filter, and say what was filtered

The requirement was rewritten as four rules, each with a reason and each tested ([ADR-003](adr/ADR-003-exclude-the-testers-from-the-analytics.md)):

| rule | reason |
|---|---|
| Filter in the SQL on the server, not in the UI | a UI filter still ships the rows and drifts away from the query |
| Exclude by default, with a switch to include | the admin still needs to check that an own action produced an event; without the switch they would query by hand, with no filter at all |
| Always show how much was excluded (accounts, matches, events) | after filtering most panels were nearly empty, and an empty panel with no explanation reads as "the dashboard is broken" |
| Two views are deliberately not filtered: the raw-data card and the single-user page | filtering them would break what those views promise |

Acceptance was written as tests before the code: 12 tests, 8 of them red at the start. Then the filter was removed on purpose to check that the tests notice (fault injection, [ADR-011](adr/ADR-011-acceptance-means-breaking-the-code-on-purpose.md)). That step also exposed two of the new tests as vacuous: they could never fail.

## 4. Decision, part 2 — the remaining accounts were not players either

Two days later, an analysis needed to know which rule versions "outside players" had already played. The query used `role <> 'admin'` as the meaning of "outside player" and produced a tidy table with counts and dates. It looked like a measurement.

It was a guess. The schema had no column that said "this account is a real person", so the mapping existed only in my head, and the answer was: **every one of the 26 accounts is mine** (2 admin, 19 guest, 5 regular). The table was withdrawn.

What changed ([ADR-004](adr/ADR-004-a-mapping-the-schema-does-not-state-is-a-hypothesis.md)):

1. **A mapping the schema does not state is a hypothesis.** Ask before presenting a result that depends on it.
2. **Retract every statement that implied real players.** Four statements in three documents were corrected, among them "n ≈ 3 real people" → **n = 0**.
3. **Correct without rewriting.** The earlier decision record keeps its original text with a correction note, so the record still shows when the doubt was raised.
4. **Put the answer in the schema.** A column `users.la_tester` (migration 0052) now says whether an account is a test account. Until it existed, every "number of users" was a number of accounts.

## 5. Result

- **n real users = 0. Every account was mine.** No number in this repository describes a real player.
- The dashboard excludes admin and test accounts by default and says how much it excluded. The same filters are in the standalone queries of [`analyses/sql/`](../analyses/sql/).
- The question "is this a real player?" has a column, not an assumption.
- The README makes no claim about users or scale.

**Honest limit:** no automated check stops a fifth over-claiming sentence. The protection is the rule in [measurement-design.md](measurement-design.md#what-a-number-is-allowed-to-claim) and a manual review before anything is published.

## 6. What would be measured with real users

The metrics are defined and their SQL runs; only the people are missing. [metrics.md](metrics.md) defines the new-account funnel and week-2 return, including when a number is unknown and when a group is too small to show. The first real measurement is planned for the next game build.

## What this case shows

| skill | where |
|---|---|
| Turning a request into the question behind it | §1 |
| Measuring before designing | §2 |
| Writing requirements as testable rules with reasons | §3 |
| Treating an unstated mapping as a hypothesis | §4 |
| Correcting a published number, and keeping the trail | §4–5 |
