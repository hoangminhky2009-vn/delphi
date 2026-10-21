-- Share of each round action across the whole cohort (sanity check on the generator
-- and a first look at the action vocabulary).
SELECT e.value_json->>'hanh_dong'                                   AS action,
       count(*)                                                     AS n_rounds,
       round(100.0 * count(*) / sum(count(*)) OVER (), 1)           AS pct
  FROM events e
 WHERE e.action_type = 'hd_cam_ket'
 GROUP BY 1
 ORDER BY n_rounds DESC;
