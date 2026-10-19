# ADR-005 — A rating ladder must be climbable: discount small samples, and pick the constant by measurement

- **Status:** accepted, 2026-08-24 · **Source:** private decision-log entry D130
- **Lens:** product analytics · statistics

## Context

The arena shows a play-style rating from E up to SSS. An earlier note claimed *"sitting idle for the first three rounds still scores 974 = SSS"*, and proposed re-tuning the 20 thresholds. The assistant measured first.

## What was measured — and it contradicted the premise

600 matches by real bots (8-round map, rule set v34, rating computed after each round):

| grade | exploded in | of which at round ≤ 3 |
|---|---|---|
| S | 87 / 600 (14.5 %) | **35** (40 %) |
| SS | 42 / 600 (7.0 %) | **27** (64 %) |
| SSS | 5 / 600 (0.8 %) | 1 |

**SSS almost never fires early; S and SS do.** The old number was probably measured on a hand-built round sequence, not a real match; the assistant could reproduce 933 (= SS at round 1) only with a function fed a best-case sequence that never happens in play. *A note that states a number nobody re-measured is how the next person gets prioritised wrongly.*

**The root cause was not the 20 thresholds.** The score is a weighted *mean*, so one round and sixteen rounds give almost the same number (perfect sequence: round 1 → 933 = SS, round 3 → 975 = SSS, round 16 → 998). The ladder was not *climbable*: it started high, and a full-screen celebration fired for an achievement nobody had had time to earn. Moving thresholds only moves where 933 lands.

## Decision

Add `k` **pseudo-rounds at the neutral value 0.5**, with `k = max(0, K0 − n)` so the discount **decays**: early on the score is pulled toward the middle because the sample is too small to praise or blame; from round 4 `k = 0` and the score is **identical** to the old formula.

**K0 was chosen by measurement, not taste** (same 600 matches):

| K0 | S | SS | SSS | (…of which fired at round ≤ 3) |
|---|---|---|---|---|
| 0 (old) | 87 | 42 | 5 | 35 · 27 · 1 |
| 3 | 72 | 34 | 5 | 18 · 18 · 1 |
| **4** | 55 | 24 | 4 | **0 · 0 · 0** |
| 6 | 43 | 11 | 3 | 0 · 0 · 0 |

The end-of-match distribution (SSS 0.2 %, S+ 7.8 %) is **identical for every K0**. 4 is the smallest value that removes every early announcement; larger values only kill mid-match announcements without adding benefit. Pseudo-rounds sit at 0.5, not 0: pulling toward the middle means "not enough sample to praise or blame", pulling toward 0 would punish new players (a test covers the symmetric case: a bad sequence must be pulled *up*).

Two things deliberately **not** changed:
- This is not a balance parameter: the style score is computed at read time, is not stored with results, and feeds no rank.
- The "×2 in one round" achievement was **left alone**. Measured: 0/300 matches on the 8-round map, 27 per 19,137 seat-rounds on the 12-round map (about one per 7 matches). Three options (keep, remove, lower threshold) were weighed; lowering would make "×2" stop meaning ×2, removing would lose a celebration that still fires regularly on long maps.

## A measurement that almost fooled its author

A quick probe reported "×2 fires 0 / 132,000 seat-rounds on all map sizes", which sounds like grounds for removal. But the probe's bots **never traded** (empty portfolio), so profit was only cash inflation and could never reach +100 %. The empty probe was caught before it was reported as a finding; the usable numbers were the earlier ones.

## Verification

`tests/thang_hang_phai_leo_duoc.test.ts` — 5 tests (round 1 never yields S; score must rise with rounds; from round 4 it equals the old formula; floor < shortest map; pseudo-rounds symmetric around 0.5). Two injected faults: disabling the discount → 3 red; setting the floor to 12 (never decays) → 2 red.
