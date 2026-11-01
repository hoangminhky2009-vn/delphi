# Analyses

Small, re-runnable analyses over the project's own schema. **The data is synthetic**: a cohort of generated players who play real matches through the real application on an embedded PostgreSQL. It is not user data, and nothing here reports a finding about people. What it shows is the queries, the method and a check of the method.

The findings on production data (concentration of activity in test accounts, snapshot sizes, the sweep that chose K0) are written up in the [ADRs](../docs/adr/), with their numbers and their mistakes.

| file | question |
|---|---|
| [`sql/01_event_size_by_action_type.sql`](sql/01_event_size_by_action_type.sql) | How many bytes does each action type store? `NULL` snapshot is counted apart from a small one ([ADR-006](../docs/adr/ADR-006-measure-event-size-per-action-type.md)) |
| [`sql/02_player_action_counts.sql`](sql/02_player_action_counts.sql) | Rounds and loss cuts per player: the input to the small-sample estimate |
| [`sql/03_action_mix.sql`](sql/03_action_mix.sql) | Share of each round action across the cohort |
| [`sql/04_funnel.sql`](sql/04_funnel.sql) | New-account funnel: created → verified → profile → consent → tutorial → first match → 3 matches ([definitions](../docs/metrics.md#new-account-funnel)) |
| [`sql/05_week2_return.sql`](sql/05_week2_return.sql) | Week-2 return by signup week and by matches finished; groups under 5 people are hidden ([definitions](../docs/metrics.md#week-2-return)) |
| [`analyze.py`](analyze.py) | Error of a player's rate by rounds observed, raw vs shrunk with pseudo-count K0, and a K0 sweep; prints the funnel and week-2 tables |
| [`results/summary.md`](results/summary.md) | Output tables and charts |

Queries 04 and 05 are standalone copies of the queries behind the admin dashboard (`server/admin_phan_tich.ts`). The dashboard builds them from fragments; here each one is a single file you can read top to bottom and run in `psql`.

## Run

```bash
npm ci
npx tsx analyses/make_cohort.ts 150            # 5-10 minutes; writes analyses/results/*.csv
pip install -r analyses/requirements.txt
python analyses/analyze.py                     # writes summary.md and two PNG charts
```

Player behaviour is seeded, so the cohort is reproducible in distribution; match seeds are chosen by the server, so rerunning gives similar but not identical counts. Signup days are placed relative to the day you run it.

To run 04 or 05 against another database, pass the practice-table seeds (from `SEED_MAN_TAP_MOI_THOI` in `config/holdem.ts`) as a psql variable: `psql -v practice_seeds=1,2,3 -f analyses/sql/04_funnel.sql`.
