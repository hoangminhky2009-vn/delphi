# Measurement design

How this project decides what to record, what a number is allowed to claim, and what it refuses to say. Most of the machinery described here is enforced by the schema or by tests, not by intention. Vietnamese sources: [`luat/04-du-lieu.md`](luat/04-du-lieu.md), [`dac-ta/03-thu-data.md`](dac-ta/03-thu-data.md).

## The measurement question

> Do three views of the same person — what they *do* in a seeded investing game, what they *spend*, and what they *say* about themselves — agree?

- **Do:** arena matches. Deterministic engine, rule sets versioned (`balance_version`), so a match is reproducible from `seed + action log` ([ADR-010](adr/ADR-010-store-inputs-not-outcomes.md)).
- **Spend:** a personal ledger encrypted on the user's device. The server stores ciphertext and receives only coded features (no absolute amounts, no free text) — [`yeu-cau-ky-thuat/05b-pfm-kien-truc.md`](yeu-cau-ky-thuat/05b-pfm-kien-truc.md).
- **Say:** short self-report questions.

Agreement and disagreement between the three are the finding. The product *describes*; it never recommends buying or selling anything.

## Two tables, two jobs

| | `events` | `telemetry` |
|---|---|---|
| holds | behaviour that carries **money or belief** (an order, a first look at a pool, a round commit) | **interface operation** (time on a screen, funnel steps, client errors) |
| rule | append-only, enforced by database triggers; no `UPDATE`/`DELETE`/`TRUNCATE` | deletable; raw rows expire after **90 days**, rolled up into daily aggregates |
| why | it is the product's raw material; losing a row loses future analysis | its value is in trends, not in single rows |
| when written | in the same transaction as the business action — never fire-and-forget | batched from the device; the server writes only for users who consented |

**The one-line test when in doubt:** *does this row contain money or belief?* Yes → `events`. No → `telemetry`. **The decision is one-way** — a row wrongly put in `events` stays forever — so the safe misclassification is `telemetry` (losing a trend), never "put everything in `events` to be sure".

Rolled-up telemetry tables are deliberately **not linked to users** (they aggregate by age band · region · occupation band, never by person). The raw table does have a nullable `user_id` and is only written for users who consented.

## What a number is allowed to claim

1. **The denominator is *this season's real people*, never infrastructure capacity.** (Rule A11.1.) A statement such as "supports 5,000 users" describes a limit, not an audience.
2. **Missing is `NULL`, never `0`.** (A11.2.) A zero says "we measured and found none".
3. **Small samples are shown with a flag, not hidden and not trusted.** Below a floor the number still appears but carries a "thin sample" marker: hiding it would blind the person who has to decide, and trusting it would turn noise into a finding. The floor is a tunable constant (`config/giai_doan.ts`), not an agent-chosen number.
4. **A mapping the schema does not state is a hypothesis.** "Account is a real person" was once inferred from `role`; it was wrong ([ADR-004](adr/ADR-004-a-mapping-the-schema-does-not-state-is-a-hypothesis.md)). It is now a column.
5. **Say how much was excluded.** Analytics exclude tester/admin activity by default and print what was removed ([ADR-003](adr/ADR-003-exclude-the-testers-from-the-analytics.md)).
6. **Quality flags are declared, not silently applied.** Rounds whose prompt was edited by a crowd mechanic are flagged and counted in the profile rather than dropped ([ADR-002](adr/ADR-002-flag-the-rounds-the-crowd-edited.md)).
7. **Rewards are recognition, not money, and are not given for self-report** — otherwise the questionnaire measures the incentive.

## Derived data is rebuildable

Per-match and per-round behaviour tables are *derived* from `events` and the deterministic engine. They can be wrong and be fixed by replay (`scripts/hanh_vi_dung_lai.ts`). The raw log cannot be fixed, which is why what enters it is decided so carefully.

## How big is an event? Measured, per type

One hand-estimated "≈300 bytes per event" rule was replaced by caps measured per action type ([ADR-006](adr/ADR-006-measure-event-size-per-action-type.md)); a test is red when a snapshot exceeds its declared cap. One type is intentionally large (≈1.7 KB) because it records the full social context at the moment of a decision.

## Consent and privacy

- Demographics are stored only as bands (`age_band`, `region`, `occupation_band`); an age gate of 16+ is a configurable floor that may be raised but not removed.
- Consent has **versions** and an append-only trail; research consent is separate from the terms of service, and a measurement session has its own withdrawable consent.
- Account deletion removes the account's rows; backups are encrypted and expire.

## What is deliberately not measured

Absolute spending amounts and free text from the spending vault; any conversion of play-money tokens into real value (they have none, and the two in-game currencies are firewalled from each other in both schema and code); and competitive indicators between people until enough real players return — the rule is to show none before then.
