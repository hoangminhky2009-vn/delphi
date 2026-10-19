# ADR-001 — Measure before you fix: three numbers, three roles

- **Status:** accepted, 2026-08-31 · **Source:** private decision-log entry D196
- **Lens:** product · data · engineering

## Context

The author complained that the codebase felt "mixed up": the personal-finance feature leaking into the game, the game into the UI, the UI into the in-app economy, and release numbers that no one could read. The proposed cure was a restructuring. Before touching anything, the claim was measured.

## What the measurement said — the question split in two

| Claim | Measured | Verdict |
|---|---|---|
| "The features are entangled in code" | `server/pfm/*` imports **0** modules from outside itself; `server/holdem/*` the same (apart from one RNG helper). Personal finance ↔ game ↔ economy have **no cross imports**. | **False.** The architecture is clean. |
| "Versions and changes are a mess" | 14 version identifiers in 11 files in **7 formats**; `package.json` says `0.1.0` while the API says `v0.4.0-gd4`; `formula_version` is `TEXT` in 2 tables and `SMALLINT` in 4; **0** changelog files; the decision log had 4 backward number jumps, 2 backward dates, 4 missing numbers. Two shipped changes (one touching ~40 CSS call sites) had no log entry at all. | **True.** The mess was in the labels, not the code. |

The case that compressed the whole problem into one line: a constant `BALANCE_VERSION = 'balance-v2-D20'` — a *decision* number embedded in a *version* string.

## Decision

A decision number had been doing two jobs: *why* something changed and *what* shipped. Split them into **three numbers, three roles**:

1. **`D<n>`** — the decision log: *why*.
2. **Technical version** — `config/phien_ban.ts`, a registry of 14 version axes, each declaring its domain and what it numbers. New axes follow `<domain>-v<N>[-nickname]`; embedding a decision number or a date in a version string is forbidden.
3. **Release version** — game-style patch notes that say *what changed* first and point to the decision second.

Deliberate non-decisions, recorded so nobody "fixes" them later:
- **No retroactive numbering.** Earlier releases had no notes; inventing `0.0.1…0.0.4` for them would fabricate a history. `0.0.1` is the first release *with* notes, and says so.
- **No semver for the release number.** Semver promises API compatibility to integrators; there are none. A promise that cannot be kept becomes one more number nobody trusts.
- **The registry describes; it does not rewrite.** Most values already live in production rows (`balance_version`, `formula_version`), so changing their format would orphan data. The rule applies to new axes only.

## Verification

`tests/phien_ban.test.ts` checks that the registry covers every version constant in both directions and that formats comply. Three faults were injected: an unregistered axis, a version string embedding a decision number, and a release bump without a note — each turned the suite red (the last check reads private patch notes and is not part of this export). The guard itself was wrong twice on its first run — its scan regex required a character *before* the keyword, so constants *starting* with it slipped through silently; and its format rule rejected hyphenated domains — and was fixed before it shipped.

## Consequences

- The fix touched **no product code**; it was a labelling fix because the measurement said the code was fine.
- Known fragment left on record: 13 files depend on `server/sandbox/rng.js`, a module in a directory named after a product that no longer exists. The name is misleading; the engine is real. (A later, separate rule: *measure usage before deleting code that looks dead.*)
