-- How big is the state snapshot stored with each event, per action type?
-- Sizes are computed in SQL with octet_length (UTF-8 bytes as stored), not in Node,
-- where .length counts UTF-16 code units. See ADR-006.
-- A NULL snapshot means "this action type stores none" and is counted separately:
-- it is not a zero-byte snapshot (measurement-design rule: NULL is not 0).
SELECT action_type,
       count(*)                                                        AS n_events,
       count(*) FILTER (WHERE state_snapshot_json IS NULL)             AS n_no_snapshot,
       percentile_cont(0.5)  WITHIN GROUP (ORDER BY octet_length(state_snapshot_json::text)) AS p50_bytes,
       percentile_cont(0.95) WITHIN GROUP (ORDER BY octet_length(state_snapshot_json::text)) AS p95_bytes,
       max(octet_length(state_snapshot_json::text))                    AS max_bytes
  FROM events
 GROUP BY action_type
 ORDER BY max_bytes DESC NULLS LAST, action_type;
