# Delphi

**A mobile game that measures how young people behave with money — built, tested and documented spec-first.**
Solo project by [hoangminhky2009-vn](https://github.com/hoangminhky2009-vn) · July–October 2026 · public beta since 12 Oct 2026.

- **Live:** [dubao.lastkiss4diu.workers.dev](https://dubao.lastkiss4diu.workers.dev) — public beta (sign-up, 16+, Vietnamese UI)
- **Try it without signing up:** [dubao-demo.lastkiss4diu.workers.dev](https://dubao-demo.lastkiss4diu.workers.dev) — the real server running in your browser, nothing stored (demo build 0.0.65)

<p align="center">
  <img src="docs/img/hub.png" width="240" alt="Hub screen of the demo">
  <img src="docs/img/pfm.png" width="240" alt="Personal-finance ledger (PFM) screen, sample data">
  <img src="docs/img/log.png" width="240" alt="The events table as the app writes it during one match">
</p>
<p align="center"><sub>1 · Hub (in-browser demo: the real server runs inside a Web Worker, no backend or login needed) · 2 · Spending ledger — approved design demo with sample data; the real vault stores ciphertext only · 3 · The append-only <code>events</code> rows one real match wrote on a throwaway database. Text is in Vietnamese, the product's language.</sub></p>

<p align="center">
  <img src="docs/img/erd.png" width="100%" alt="Data structure: 15 of the 70 tables grouped by role, with foreign-key arrows">
</p>
<p align="center"><sub>4 · Data structure — 15 of the 70 tables, grouped by role and generated from the migrations. Full diagram: <a href="docs/api/erd.md">docs/api/erd.md</a>.</sub></p>

## What it is

Three sources describe the same person and are compared with each other:

1. **An arena** — a turn-based investing game on a seeded, fully deterministic engine (every match can be replayed exactly; rule sets are versioned).
2. **A spending ledger** — personal-finance tracking whose contents are encrypted on the user's device (the server stores ciphertext and has no key).
3. **Self-report** — short questionnaires.

Where the three agree or disagree is the finding. The product is aimed at young adults (16–30) in Vietnam. It **describes** behaviour and never tells anyone to buy or sell an asset; tokens are play money with no cash value.

## What's in it

- **Measurement design.** Behaviour goes into an append-only `events` table (PostgreSQL triggers reject `UPDATE` and `DELETE`), separate from a `telemetry` table that expires after 90 days and keeps daily roll-ups. A one-line rule decides which table a record belongs in. Values that were not measured are stored as `NULL`, not `0`, and small samples are shown with a flag. → [Measurement design](docs/measurement-design.md)
- **Analysis and simulation.** SQL concentration analysis on the production tables (8 % of accounts produced 84 % of the matches and events); a Monte Carlo bench of 300 matches × 5 seats (22.5 % of rounds were edited by a mechanic nobody had recorded); a 600-match sweep that set the smoothing pseudo-count for small samples (K0 = 4). Twelve decision records give the numbers and the mistakes along the way, among them a "bug" that was a mis-measured note. → [ADRs](docs/adr/)
- **Security review.** One high and several medium findings. Fixes: an origin-bypass shared-secret gate, AES-256-GCM encrypted backups, pinned-CA TLS, `Origin` / `Sec-Fetch-Site` checks on cross-site writes, an age gate on every sign-up route. Each fix was checked by fault injection (`scripts/tiem.ts` re-injects the bug, runs the tests and restores the files byte for byte): 41 of 41 injected faults made a test fail. Authentication uses argon2id, hashed sessions and a TOTP implementation checked against the RFC 6238 vectors. → [SECURITY.md](SECURITY.md)
- **Integrity in the database.** Triggers (append-only, zero-sum, deferred ledger matching), `CHECK` constraints and row-level security. The ERD is generated from `pg_catalog`, and the build fails when it drifts. → [ERD](docs/api/erd.md)
- **Load testing.** A concurrency ladder up to 800 simultaneous requests (p50 / p95 / p99, pooler connection limits, `EMAXCONN` returned as `503` with a jittered `Retry-After`). The ceiling turned out to be function memory, not database connections; the document keeps the earlier, wrong estimate next to the correction. → [Infrastructure limits](docs/gioi-han-ha-tang.md)

> **Status: public beta since 12 Oct 2026, still a research prototype.** No claims are made about user numbers or scale; see [ADR-004](docs/adr/ADR-004-a-mapping-the-schema-does-not-state-is-a-hypothesis.md).

## By the numbers

| | | where it comes from |
|---|---|---|
| 7,994 tests in 569 files: 4,343 server and integration tests (318 files) and 3,651 frontend tests (251 files) | tests | `npm test` and `npm --prefix web test` — integration tests run against an embedded PostgreSQL. Full runs pass apart from one intermittent, seed-dependent minigame test per run, listed under [known debt](docs/architecture.md#known-debt) |
| 70 tables · 81 foreign keys · 30 integrity triggers · row-level security on every table | database | [`docs/api/erd.md`](docs/api/erd.md) is **generated** from the migrations by `npm run erd:ghi`; a test fails if it drifts |
| 148 HTTP routes, with their middleware | API | [`docs/api/danh-sach-route.md`](docs/api/danh-sach-route.md) is generated from the running app (`npm run route:ghi`); a test fails if it drifts |
| ~200k lines of TypeScript / CSS / SQL and ~126k lines of tests | size | counted over `server/`, `web/`, `config/`, `migrations/`, `scripts/`, `tests/` |
| 41 injected faults, each one caught by a failing test | process | [SECURITY.md](SECURITY.md), [ADR-011](docs/adr/ADR-011-acceptance-means-breaking-the-code-on-purpose.md), `scripts/tiem.ts` |
| $0 / month infrastructure (Cloudflare Workers + Vercel Hobby + Supabase free tier) — a constraint that holds only until there is revenue, because Vercel Hobby forbids commercial use ([ADR-008](docs/adr/ADR-008-a-ladder-of-measurable-triggers.md)) | cost | [`docs/gioi-han-ha-tang.md`](docs/gioi-han-ha-tang.md) lists every ceiling, the order they break in, and the load tests (up to 800 concurrent requests) that found them |

---

## Read it by role

| If you care about… | Read, in this order |
|---|---|
| **Data and measurement** | [Measurement design](docs/measurement-design.md) → [ADR-001](docs/adr/ADR-001-measure-before-you-fix.md) · [002](docs/adr/ADR-002-flag-the-rounds-the-crowd-edited.md) · [003](docs/adr/ADR-003-exclude-the-testers-from-the-analytics.md) · [005](docs/adr/ADR-005-a-rating-ladder-must-be-climbable.md) → [`docs/api/erd.md`](docs/api/erd.md) (generated schema diagrams) → [`analyses/`](analyses/) (SQL + Python on a synthetic cohort) |
| **Product / requirements** | [`docs/spec/bao-loi-nguoi-choi.md`](docs/spec/bao-loi-nguoi-choi.md) — one complete spec: user outcome, out-of-scope, machine-checkable acceptance criteria, injected-fault plan → its tests (`tests/bao_loi_nguoi_choi.test.ts`, `web/tests/bao_loi_bang.test.tsx`) → [design documents](docs/thiet-ke-da-chot/) |
| **Engineering** | [Architecture](docs/architecture.md) → [SECURITY.md](SECURITY.md) → [Infrastructure limits](docs/gioi-han-ha-tang.md) (measured; earlier estimates kept alongside the corrections) → [ADR-007](docs/adr/ADR-007-react-to-overload-do-not-guess-a-threshold.md) · [009](docs/adr/ADR-009-invariants-live-in-the-database.md) · [010](docs/adr/ADR-010-store-inputs-not-outcomes.md) · [011](docs/adr/ADR-011-acceptance-means-breaking-the-code-on-purpose.md) |

Most prose in `docs/` outside the files above is Vietnamese (the language of the product's domain and of its test users). [`docs/README.md`](docs/README.md) gives an English line for every document.

## Architecture in one picture

```mermaid
flowchart LR
  P[Player · React PWA] --> W[Cloudflare Worker<br/>static assets · queue gate · /api proxy]
  W -->|shared-secret header| V[Vercel Function<br/>Hono API · one function]
  V --> D[(PostgreSQL · Supabase<br/>RLS · triggers · ledgers)]
  V -.nightly encrypted backup.-> G[(Private Git repo)]
  S[pg_cron + external cron] --> V
  V -.errors only.-> E[Sentry]
```

Details, request path, trust boundaries and the list of known debt: [docs/architecture.md](docs/architecture.md).

## Run it

Prerequisites: Node.js ≥ 20. No Docker, no system PostgreSQL — a PostgreSQL binary is installed through npm.

```bash
npm ci && (cd web && npm ci)

npm run db:dev        # terminal 1 — embedded PostgreSQL on :5544
npm run migrate       # apply the migrations
npm run seed:dev      # sample data
npm run dev:api       # terminal 2 — API on :8787 (e-mails print to the console)
npm run web:dev       # terminal 3 — frontend on :5173

npm run typecheck     # server
npm test              # server + integration tests (embedded PostgreSQL per test file)
(cd web && npm test)  # frontend
npm run erd:ghi       # regenerate docs/api/erd.md
```

Copy `.env.example` to `.env` for anything beyond local defaults. Secrets are never committed.

## Repository map

| path | what is there |
|---|---|
| `server/` | Hono API. `app.ts` wires middleware and routes; `holdem/` is the deterministic arena engine; `pfm/` the encrypted-vault endpoints; `auth/` hashing, sessions, rate limits |
| `config/` | Single source of truth for every number the economy and the engine use. Code reads from here; documents point here instead of copying values |
| `migrations/` | Numbered SQL migrations (80+), one transaction each, shipped in the same commit as the code that needs them |
| `web/` | React PWA (`src/`), the Cloudflare Worker (`worker/`), and an in-browser demo mode that runs the real server inside a Web Worker (`src/demo/`) |
| `tests/`, `web/tests/` | Integration tests (embedded PostgreSQL), golden replays of real matches, and structural guards (generated docs, version registry, pool rules) |
| `scripts/` | Measurement harnesses (Monte Carlo balance gates, load tests), generators (routes, ERD), fault-injection runner, ops helpers |
| `analyses/` | Re-runnable SQL and Python analyses over a **synthetic** cohort: snapshot size per action type, and small-sample estimation with a pseudo-count. See [analyses/README.md](analyses/README.md) |
| `docs/` | Specs, design decisions, generated references, and ADRs — indexed in [docs/README.md](docs/README.md) |

## My role and how it was built

Solo project, spec-first, built with AI coding assistants.

- **What I did:** defined the product and its measurement design; wrote the invariants, the economy rules and their hand-computed test vectors; wrote the specs and acceptance criteria and kept the decision log; ran the analyses and simulations; reviewed security and decided what to fix; chose between the options the assistants proposed; decided what counts as done.
- **What the assistants did:** most of the implementation, in separate sessions working to those specs and constraints.
- **How it is checked:** by tests that must fail when the code is broken on purpose ([fault injection](docs/adr/ADR-011-acceptance-means-breaking-the-code-on-purpose.md)), by generated documents that fail the build when they drift, and by measuring before changing anything ([ADR-001](docs/adr/ADR-001-measure-before-you-fix.md)). I did not read every line.

## Reading the code and its comments

- Comments are mostly Vietnamese. Identifiers mix Vietnamese domain terms with English infrastructure terms; [docs/naming.md](docs/naming.md) is the glossary and [ADR-012](docs/adr/ADR-012-keep-vietnamese-as-the-domain-language.md) explains why they were not renamed.
- `D<n>` in a comment is an entry in a private decision log (about 600 entries). The ones that explain the most are rewritten as [ADRs](docs/adr/). `A<n>` / `C<n>` are numbered project rules; the data, economy and invariant rules are published in [`docs/luat/`](docs/luat/).
- Known weaknesses: [docs/architecture.md → Known debt](docs/architecture.md#known-debt).

## License

All rights reserved — published for evaluation as a portfolio. See [LICENSE](LICENSE).
