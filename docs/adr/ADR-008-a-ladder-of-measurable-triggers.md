# ADR-008 — A ladder of measurable triggers for "when do we change the architecture"

- **Status:** accepted, 2026-09-03 · **Source:** private decision-log entry D213 (with D214 for the cost facts)
- **Lens:** product strategy · engineering

## Context

The question "when do we move off the free tier / change the architecture?" had four partial answers scattered across four documents, each saying something different:

- the constitution gave a *target* (support C2 scale) but no trigger;
- the infrastructure-limits document said *"do these three things when we **really** reach that milestone"* — and "really" is not a condition anyone can measure (the project's own rule forbids deferrals without a measurable trigger);
- the legal rules had a legal milestone not connected to the infrastructure milestone that shares its cause;
- the personal-finance design had a numeric threshold for its own part only.

Two facts re-confirmed on 2026-09-03 changed the plan:

1. Vercel's **Hobby** plan forbids commercial use. The free-infrastructure constraint therefore holds only until there is revenue.
2. Cloudflare **Hyperdrive is available on the free Workers plan**, which the repo had never mentioned. That changed the target for the 5,000-concurrent-users tier from "a long-lived process in the same region" to **Cloudflare Workers + Hyperdrive**.

## Decision

One registry, `config/bac_thang.ts`: six tiers — `mua_0_0 → cong_150 → dong_goi_app → doanh_thu → c2_5000 → da_quoc_gia`. Each tier carries a `Trigger` of one of four kinds:

| kind | meaning |
|---|---|
| `khong` | no trigger (the tier is a decision, not a measurement) |
| `hang_so` | a constant that lives elsewhere (a named export in code) |
| `phap_ly` | a legal milestone (points at a section of the legal rules) |
| `cho` | waiting for the author to choose (points at the open question) |

A trigger **points to where the real number lives; it never copies it** (one source of truth). Only a measurable trigger is allowed to start a migration. A prose document tells the story for readers who do not want to read TypeScript; it is explicitly allowed to drift and prints no thresholds.

Two questions were left open on purpose, recorded verbatim: the "package as a native app" tier has no natural measurement because its trigger is a *product decision* — three options were offered to the author rather than forcing a number.

## Verification

`tests/bac_thang.test.ts` — the shape of each tier matches its declared kind; **every pointer resolves** (a `hang_so` pointer requires that the file exists *and* contains the named constant); the prose document copies no threshold. (In this export, the check that four documents point back at the registry is omitted because those documents are not published.)

## Consequences

The decision "stay on free tiers until revenue, then pay the cheapest thing that works" is now a *tested* statement, not a mood. See [`docs/giai-doan.md`](../giai-doan.md) for the narrative and [`docs/gioi-han-ha-tang.md`](../gioi-han-ha-tang.md) for the ceilings behind each tier.
