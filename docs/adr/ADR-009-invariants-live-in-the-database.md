# ADR-009 — The invariants live in the database, not only in the code

- **Status:** accepted — standing rule since the first migrations (July 2026) · **Source:** [`docs/luat/02-bat-bien.md`](../luat/02-bat-bien.md) (rules A3.3, A3.4, A3.10), migrations `0001`–`0002` and later, plus the trigger inventory below
- **Lens:** engineering · financial integrity

## Context

The product moves play money. Several rules are not matters of style; breaking one breaks the product:

- the event log is **append-only** and is the product's raw material (A3.3);
- tokens are **never minted** as prizes except one genesis entry; the treasury never goes negative (A3.4);
- **every balance change goes through a ledger** with a stated reason, and a balance must be recomputable from the ledger (A3.10).

Application code changes weekly and is written by many hands (and by AI assistants). A rule that exists only in code is a rule that the next change can silently break.

## Decision

Enforce each invariant **in the schema**, so that a bug in application code cannot violate it:

| invariant | mechanism (inventory taken from the generated schema, `docs/api/erd.md`) |
|---|---|
| append-only | a `forbid_mutation` trigger on `UPDATE`/`DELETE`, and a second one on `TRUNCATE`, for the event log and the ledgers — **11 tables** have the update/delete guard, 10 of them the truncate guard as well |
| balance never negative | `CHECK (balance_after >= 0)` on the wallet ledger |
| counters match their ledgers | **deferred** triggers that run at `COMMIT` and abort the transaction if a user's token or quest-point counter differs from the running balance on the ledger's last row (or if the counter changed with no ledger row at all). They re-read the counter at commit rather than trusting `NEW`, because a transaction may legitimately change it twice |
| ranking points only move, never appear | a zero-sum trigger on the rank ledger: after each insert, the entries of a match must sum to exactly 0 |
| collectibles are not tradable | `forbid_cosmetic_transfer` on every ownership table; a validity trigger on numbered items |
| 175 further `CHECK` constraints across 61 tables | shape of data at the lowest layer |
| row-level security on every table, with no policies | a second lock behind the application: the public (anon/authenticated) roles are revoked, and the vendor's auto-generated REST path with a public key is never used — the API is the only door |

Only then is the application layer allowed to be clever.

## Verification

- **19 test files** run `auditSupply` — a recomputation of supply from the ledgers — and assert it reports no problems *after real money operations* (placing bets, payouts, shop purchases, concurrent runs) on embedded PostgreSQL. This is why a one-off audit step is not wired into CI: against an empty database it would always balance and prove nothing (decision D283).
- The generated schema document ([`docs/api/erd.md`](../api/erd.md)) is compared with the migrations in a test, and a second test fails if a foreign key has no supporting index or a table has no primary key.

## Consequences and trade-off

Triggers make some operations awkward by design (for example, correcting a ledger entry means appending a compensating entry). That is the point; the cost is accepted. The first cold-archive route for the event log was written down as an **interpretation**, not a loosening: "append-only" means *no row and no field of a row is ever lost*, not "never touch the live table" — partitioning by month and detaching old partitions to external storage is allowed when physical space, not will, runs out (rule B1, trigger: database size ≥ 300 MB of the 500 MB free-tier ceiling).
