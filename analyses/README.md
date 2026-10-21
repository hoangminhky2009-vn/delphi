# Analyses

Small, re-runnable analyses over the project's own schema. **The data is synthetic**: a cohort of generated players who play real matches through the real application on an embedded PostgreSQL. It is not user data, and nothing here reports a finding about people. What it shows is the queries, the method and a check of the method.

The findings on production data (concentration of activity in test accounts, snapshot sizes, the sweep that chose K0) are written up in the [ADRs](../docs/adr/), with their numbers and their mistakes.

| file | question |
|---|---|
| [`sql/01_event_size_by_action_type.sql`](sql/01_event_size_by_action_type.sql) | How many bytes does each action type store? `NULL` snapshot is counted apart from a small one ([ADR-006](../docs/adr/ADR-006-measure-event-size-per-action-type.md)) |
| [`sql/02_player_action_counts.sql`](sql/02_player_action_counts.sql) | Rounds and loss cuts per player: the input to the small-sample estimate |
| [`sql/03_action_mix.sql`](sql/03_action_mix.sql) | Share of each round action across the cohort |
| [`analyze.py`](analyze.py) | Error of a player's rate by rounds observed, raw vs shrunk with pseudo-count K0, and a K0 sweep. Uses `pandas`, `numpy`, `matplotlib` |
| [`results/summary.md`](results/summary.md) | Output tables and charts |

## Run

```bash
npm ci
npx tsx analyses/make_cohort.ts 150      # ~ minutes; writes analyses/results/*.csv
python analyses/analyze.py               # writes summary.md and two PNG charts
```

Player behaviour is seeded, so the cohort is reproducible in distribution; match seeds are chosen by the server, so rerunning gives similar but not identical counts.
