# ADR-004 — A mapping the schema does not state is a hypothesis, not a measurement

- **Status:** accepted, 2026-09-03 · **Source:** private decision-log entry D223
- **Lens:** data integrity · honesty about numbers

## Context

While reviewing the rule for removing old rule-set versions, the assistant measured production and presented a list of six rule sets as "frozen" — not removable, because outside players had already played them. The table had match counts, account counts and dates, and looked exactly like a measurement.

It rested on an assumption the assistant had made without asking: **`role <> 'admin'` means "an outside player".**

The author's answer: *every account in production is mine — I have only ever played against myself.* All 26 accounts (2 admins, 19 guests, 5 regular accounts) were the author's. The list of frozen rule sets was **withdrawn**; none was frozen.

The query was right and the numbers were right. The mapping from `role` to "outside person" was invented — and presented in the format of evidence.

## Decision

1. **When a query needs a mapping the schema does not declare, that mapping is a hypothesis. Ask before presenting the result as fact.** Here the schema had no column saying "this account is a real person", so the answer existed only in one person's head.
2. **Retract every statement that implied real players.** Four statements across three documents were corrected: "n ≈ 3 real people" (twice) → **n = 0**; "66 of 90 abandoned matches…, self-testing caveat remains" → the caveat is now confirmed (100 % the author); a sentence about "renaming a real person" → no such person exists, the handle is the author's own test account.
3. **Correct the record without rewriting it.** The earlier analytics decision ([ADR-003](ADR-003-exclude-the-testers-from-the-analytics.md)) had described 19 guest accounts as "real people who touched the app", while leaving itself an explicit escape ("if most guests turn out to be the founder's own test devices, that is a different decision"). The body was left untouched and a correction note added: the escape hatch is exactly what turned out to matter, and editing the body would have erased the evidence that the doubt was raised at the right time.
4. Closest structural fix: a column `users.la_tester` (migration 0052) so the question "is this a real player?" has an answer **in the schema**. Until it was applied to production, every "number of users" was a number of *accounts*.

This is the same family as the project's denominator rule: *the denominator is this season's real people, not the capacity of the infrastructure* (rule A11.1).

## Honest limits

No mechanical guard prevents a repeat; the decision records that four sentences were fixed and no tool was built that would catch a fifth. A repo-wide scan for statements implying real players had only covered part of the documentation.

## Consequences

This is why the README makes no claim about users or scale.
