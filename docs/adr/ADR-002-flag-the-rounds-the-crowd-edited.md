# ADR-002 — Flag the rounds the crowd edited, instead of silently mixing them in

- **Status:** accepted, 2026-08-31 · **Source:** private decision-log entry D206
- **Lens:** data quality · instrumentation

## Context

A scored architecture review that the author brought in raised a data-cleanliness weakness: when two mechanics ("mirror" and "streak-breaker") trigger, the card a player is dealt for a round is *replaced*, so those rounds are "dirtier", and there was no tag to separate behaviour under a natural prompt from behaviour under a crowd-edited prompt.

The claim was checked in code before accepting it. All three parts were true, and the last was worse than stated: the ledger of edits never left the engine — not in the API response, not in `events`, not in any column of the derived behaviour table, which had four quality flags (`match_finished`, `practice`, `guest`, `suspected_bot`) and none for this.

## What was measured

Using the project's own simulation bench (300 matches × 5 seats, rule set v36):

| bot pool | % of **rounds** whose prompt was edited | % of **matches** with at least one edited round |
|---|---|---|
| mixed table (the common case) | **22.5 %** | **85 %** |
| all-in table (3 × extreme bots) | 22.8 % | 85 % |

The reviewer had presented this as an edge case. It is **nearly a quarter of all behavioural data and 85 % of matches**, and it happens at an ordinary mixed table — the normal running mode, not a rare one.

Why it matters: a round with an edited prompt is not bad data — the player still decides — but pooling it with ordinary rounds and then concluding about *personality* reads **circumstance as character**, the very error the personality layer was built to avoid.

## Decision

- Add one quality flag, `thay_o_do` (`'phan_than' | 'be_chuoi' | null`), carried end to end: the engine's replay sets it, the store writes it (a new nullable column with a partial index, since most rows are `NULL`), the profile **declares** the count of edited rounds.
- **Declare, don't filter.** With a handful of real players, filtering would leave zero samples. The reader decides whether to discount — but must *know*.
- Do **not** put it into `events`. The behaviour table is **derived** and the engine is **deterministic**, so replaying stored matches rebuilds the flag for every historical match (`scripts/hanh_vi_dung_lai.ts`). Had the flag been required in the append-only log, every earlier match would have been permanently untaggable.

## Verification

`tests/thay_o_lam_ban_data.test.ts` — 8 tests in three groups (replay → store → profile; declared-not-filtered; why it is not a one-way door), including a guard for the "yield" rule: streak-breaker defers when mirror already edited that round, so the two ledgers never both claim a round (otherwise one force is counted twice).

## Consequences and an honest warning

A new column means every historical row is `NULL` until the rebuild script runs. **Reading a profile before running it would report 0 edited rounds for a sample that is really 22.5 % edited — a quality flag that lies is worse than none.** The decision entry records that the rebuild had not yet been run against production when this was written.
