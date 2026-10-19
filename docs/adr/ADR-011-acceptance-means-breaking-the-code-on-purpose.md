# ADR-011 — Acceptance means breaking the code on purpose

- **Status:** accepted — project rule A11.6, tooling in `scripts/tiem.ts` · **Source:** the tool's own header, decision-log entries D212, D269, D384, D614
- **Lens:** testing · how to trust code you did not write line by line

## Context

Most of this code was written by AI assistants under constraints the author set. Reading every line is not a viable review strategy, and **a green test suite proves little**: a test can pass because the thing it guards is not there. This happened to the author's own tests:

- one asserted `not.toContain(handle)` against a response that **never contains handles** — green before any filter existed (D212, see [ADR-003](ADR-003-exclude-the-testers-from-the-analytics.md));
- the title of D269 records "an empty guard exposed by fault injection"; the title of D384 records that two tests dismissed as flaky *turned out to be real bugs*.

So the project's definition of "done" is not "tests pass" but "**tests fail when I break the thing on purpose, and pass when I put it back**".

## Decision

**Acceptance = backward fault injection** (rule A11.6). Every fix and every new guard ships with a list of deliberate faults ("mutants") and the number of tests each one turns red. A mutant that turns **zero** tests red means the guard is empty or the mutation targeted dead code — and fails the acceptance.

The runner, `scripts/tiem.ts`, exists because six earlier hand-rolled injectors each damaged a file in a new way (an uncommitted work tree wiped by `git checkout --`; a replacement string that also matched elsewhere; an empty replacement inserted everywhere; a file truncated before being read). Its protocol, so that none of those can recur:

1. read the original into memory **first**, hold its SHA-256;
2. the old string must occur **exactly once**; the new string must be non-empty and not already present;
3. replace with a *function* (avoids the `$$` replacement-pattern trap);
4. run the tests and read the `Tests N failed | M passed` line (ANSI colour stripped);
5. restore by **rewriting the original bytes** (never by reverse-substitution) and compare hashes;
6. retry on a locked file (`Errno 22`), 10 × 1 s.

Exit codes: `0` every mutant red and restoration byte-identical · `2` at least one mutant stayed green (empty guard or dead-line mutation) · `1` restoration mismatch or injection impossible.

## Evidence

The first security package of October 2026 ([SECURITY.md](../../SECURITY.md)) was accepted with **17 mutants, all 17 red, restoration byte-for-byte** (the second package: 24 of 24), and with the full suites of the private repository (334 server test files, 251 web test files; this export keeps most of them) green. The same pattern applies to the database package ([ADR-009](ADR-009-invariants-live-in-the-database.md)): its guard tests inject a table without a primary key or a foreign key without an index, inside a rolled-back transaction, to prove the measurement catches each case.

## Consequences

- Writing a guard now starts with the question "**what is the cheapest way to break the thing it protects?**" — and a mutation proving that guard is written in the same change.
- The runner itself has tests (`tests/tiem.test.ts`).
- Cost: every change takes longer. Accepted deliberately; the alternative is a green suite that guards nothing.
