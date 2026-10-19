# Architecture decision records

The project kept a private decision log of about 600 entries — each in the form *hypothesis → change → numbers → verdict*, with mistakes left visible. These twelve records are English rewrites of the entries and rules that explain the most about how the project thinks. Each names its source (`D<n>` is an entry in the private log).

**Data and measurement**

| # | decision | one line |
|---|---|---|
| [001](ADR-001-measure-before-you-fix.md) | Measure before you fix | The measurement said the code was clean and the labels were the mess — so only labels were fixed |
| [002](ADR-002-flag-the-rounds-the-crowd-edited.md) | Flag edited rounds | 22.5 % of rounds (85 % of matches) were affected by a mechanic nobody was recording |
| [003](ADR-003-exclude-the-testers-from-the-analytics.md) | Exclude testers from analytics | 8 % of accounts produced 84 % of the data; the dashboard was a mirror |
| [004](ADR-004-a-mapping-the-schema-does-not-state-is-a-hypothesis.md) | An unstated mapping is a hypothesis | A correct query answered a question nobody had verified |
| [005](ADR-005-a-rating-ladder-must-be-climbable.md) | Discount small samples | 600 simulated matches picked the constant; the "obvious" bug was a mis-measured note |
| [006](ADR-006-measure-event-size-per-action-type.md) | Measure event size | A single hand-estimated cap replaced by measured caps per event type |

**Engineering**

| # | decision | one line |
|---|---|---|
| [007](ADR-007-react-to-overload-do-not-guess-a-threshold.md) | React to overload | Serverless has no shared memory; a threshold valve would be a blind guess |
| [008](ADR-008-a-ladder-of-measurable-triggers.md) | A ladder of triggers | "When do we change architecture" became a tested registry |
| [009](ADR-009-invariants-live-in-the-database.md) | Invariants in the database | Append-only logs, ledgers and zero-sum rules enforced by triggers |
| [010](ADR-010-store-inputs-not-outcomes.md) | Store inputs, not outcomes | Deterministic engine; replay *is* the match |
| [011](ADR-011-acceptance-means-breaking-the-code-on-purpose.md) | Break it on purpose | Acceptance = every fault injected turns a test red |
| [012](ADR-012-keep-vietnamese-as-the-domain-language.md) | Keep Vietnamese names | A rename costs 187+ files and teaches nothing; fix the API surface instead |

Format: Status · Source · Context · Decision · Verification · Consequences. Numbers are quoted from the entry they come from; where the entry corrected itself, the correction is kept.
