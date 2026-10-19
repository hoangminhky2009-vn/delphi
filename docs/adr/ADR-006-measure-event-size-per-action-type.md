# ADR-006 — Measure event size per action type instead of guessing one number

- **Status:** accepted, 2026-09-03 · **Source:** private decision-log entry D222
- **Lens:** data engineering · measurement over estimation

## Context

The data rules said: *"a state snapshot must be lean — about 300 bytes per event"* — one number for every event type, **never measured**, only estimated by hand. In reality one event type (`hd_cam_ket`, a round commitment) embeds the full array of opponents (up to 7 seats on an 8-seat table) in its snapshot, every round; someone had once estimated "~600–700 bytes for a 5-seat table", a sentence nobody could re-run. The rule and the code disagreed, and nothing measured either.

The author chose between three options: **(a)** keep rich snapshots and change the rule to a cap *per action type*; (b) cut the opponent array to ~5 fields; (c) leave the contradiction. The author chose (a): behavioural data — the social context *at the exact moment of decision* — is worth more than the bytes saved.

## What was done

`scripts/do_co_snapshot.ts` drives the **real application** (`createApp`) over an embedded PostgreSQL, plays a match at the largest map size (16 rounds) on the largest table (8 seats — the seat count is a deterministic function of the seed, found by creating tables until one came up with 8), buys shop cards, opens the electronic board, submits orders the engine rejects ("an intent is data too"), plus an expired match and a subsidy check-in for non-arena samples. Sizes are computed **in SQL** with `octet_length(...)` and `percentile_cont` — not in Node, where `.length` counts UTF-16 code units, not the UTF-8 bytes the database stores.

Selected result (bytes, last of four independent runs; the biggest stayed the biggest in all four):

| action type | n | snapshot p50 | snapshot p95 | snapshot max |
|---|---|---|---|---|
| `hd_cam_ket` | 80 | 1,142 | 1,695 | **1,702** |
| `hd_chot_phien` | 80 | 313 | 371 | 375 |
| `hd_mo_bang` | 16 | 160 | 163 | 164 |
| `hd_dat_short`, `hd_khoa_tai_san`, `hd_dao_danh_muc` | 16 each | 114 | 118 | 119 |
| five other types | — | no snapshot column used (`NULL`) | | |

`config/su_kien.ts` now holds a cap per action type, derived by rule from the measurement (rounded up to 50 bytes, with a margin over the maximum seen and not below the measured p95, minimum 300); types nobody has measured fall back to the old 300-byte figure, which is demoted from "the rule" to "the floor for the unmeasured".

## Verification and consequences

`tests/co_snapshot.test.ts` is red when any snapshot exceeds its declared cap. The data rule was rewritten to point at the config instead of copying numbers (one source of truth).

A note left for the next reader: **`hd_cam_ket` being large is intentional**, not debt waiting to be tidied — do not shrink it without asking.
