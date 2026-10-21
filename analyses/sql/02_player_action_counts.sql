-- One row per player: how many round commitments, and how many of them were a loss cut.
-- This is the raw input for the small-sample estimate in analyze.py.
-- `user_id IS NULL OR ...` style exclusion of test accounts (ADR-003) is not needed here:
-- the cohort is synthetic and contains none.
SELECT u.handle,
       count(DISTINCT e.context_id)                                   AS n_matches,
       count(*)                                                       AS n_rounds,
       count(*) FILTER (WHERE e.value_json->>'hanh_dong' = 'cat_lo')  AS n_cut_loss
  FROM events e
  JOIN users  u USING (user_id)
 WHERE e.action_type = 'hd_cam_ket'
 GROUP BY u.handle
 ORDER BY u.handle;
