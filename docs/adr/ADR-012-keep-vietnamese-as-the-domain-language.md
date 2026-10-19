# ADR-012 — Keep Vietnamese as the domain language; fix the API surface, not the vocabulary

- **Status:** accepted, 2026-10-17 (the author) · **Source:** a naming inventory run on the repository the same day; no earlier decision exists
- **Lens:** engineering judgement · cost/benefit with numbers

## Context

Before this repository was prepared for publication, the question was asked: *should the whole architecture be renamed to English?* The honest starting point is that **no decision had ever chosen Vietnamese names** (a search of the decision log found only a lesson about homophones in unaccented Vietnamese). It happened by drift:

| period | new server files |
|---|---|
| 17–19 July 2026 | 18 English · 0 Vietnamese |
| 20–31 July | 15 English · 6 Vietnamese · 2 mixed |
| August | 5 English · 17 Vietnamese · 7 mixed |
| September | 2 English · 30 Vietnamese · 8 mixed |
| October | 0 English · 12 Vietnamese · 3 mixed |

The original core (markets, auth, sessions, the wallet) was named in English from a starting prompt; later features took the language of the domain and of the people testing it.

## What the inventory measured

| layer | Vietnamese | English | mixed |
|---|---|---|---|
| server file names (131) | 50 % | 31 % | 15 % |
| exported server identifiers (840) | 73 % | 9 % | 17 % |
| web component names (220) | 65 % | 21 % | 14 % |
| config constants (578) | 67 % | 12 % | 20 % |
| database tables created by migrations (69) | 26 % | 48 % | 26 % |
| API routes (148, counted by whole route) | 14 | 54 | **80 mix both languages in one path** |

**Cost of a rename** (measured, not estimated): the ten most-used Vietnamese exports alone have 258 import statements touching **187 files**; **552** SQL references to Vietnamese-named tables across 86 files plus 287 mentions across 37 migrations (migrations are immutable history); **544** literal Vietnamese API paths across 70 test files.

## Decision

**Do not rename.** A mass rename is a very large, high-risk diff that teaches nothing, ships no capability, and touches immutable migrations and a deterministic engine whose replay must stay bit-identical. Instead:

1. Keep Vietnamese as the **domain language** (the product's terms, and the language of the people it is tested with); keep **English for infrastructure vocabulary** (auth, session, ledger, middleware).
2. Publish [`docs/naming.md`](../naming.md): a glossary of the domain terms.
3. Fix what actually hurts a reader — **the API surface** — not the vocabulary: one error shape `{ error, message }`, one set of error codes, middleware instead of hand-written guards in handlers. Paths stay.
4. If an external integrator ever appears, introduce `/api/v2` with English paths and keep v1 as an alias, rather than renaming v1 in place.

## Consequences

A reader who does not read Vietnamese needs the glossary and the English summaries in `docs/`. That is a real cost, accepted, and the reason the README and the architecture notes are written in English.
