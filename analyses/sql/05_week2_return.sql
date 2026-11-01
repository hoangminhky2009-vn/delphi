-- Week-2 return: of the people who signed up, how many opened the app again 7-13 days after their signup day?
-- Standalone copy of quayLaiCua(), gomGiuChan() and gomChia() in server/admin_phan_tich.ts.
-- Definitions: docs/metrics.md#week-2-return
--
-- Rules carried over from the product query:
--   * Only people with research consent on: without consent there is no telemetry, so "did not return"
--     could not be told apart from "was not recorded".
--   * Week 2 is days [signup + 7, signup + 13] counted from each person's own signup day (Vietnam calendar),
--     not a calendar week.
--   * A person is MEASURABLE only when their week 2 has fully passed and still lies inside the 90 days of raw
--     telemetry. Not yet passed = unknown, not "did not return"; expired = unknown too.
--   * A group under 5 people (SAN in server/admin_phan_tich.ts) shows no numbers: n_signed_up, n_measurable and
--     n_returned are NULL. An empty group shows n_signed_up = 0, because "nobody here" is a fact,
--     while "1 to 4 people here" would point at individuals.
--
-- Three splits in one result:
--   all              — everyone who signed up in the last 56 days
--   signup_week      — 8 blocks of 7 days, counted back from today (as on the retention table of the dashboard)
--   age_band         — the five age bands of the sign-up form (DEMOGRAPHIC.AGE_BANDS in config/auth.ts)
WITH params AS (
  SELECT (now() AT TIME ZONE 'Asia/Ho_Chi_Minh')::date AS today
), raw_from AS (
  SELECT greatest(
           coalesce((SELECT (min(ts) AT TIME ZONE 'Asia/Ho_Chi_Minh')::date FROM telemetry), p.today),
           ((now() - interval '90 days') AT TIME ZONE 'Asia/Ho_Chi_Minh')::date + 1) AS d
    FROM params p
), person AS (
  SELECT u.user_id, u.age_band,
         (u.created_at AT TIME ZONE 'Asia/Ho_Chi_Minh')::date AS signup_day
    FROM users u, params p
   WHERE u.deleted_at IS NULL
     AND NOT (u.role = 'admin' OR u.la_tester)
     AND u.research_consent
     AND u.created_at >= ((p.today - 55)::timestamp AT TIME ZONE 'Asia/Ho_Chi_Minh')
     AND u.created_at <  ((p.today + 1)::timestamp AT TIME ZONE 'Asia/Ho_Chi_Minh')
), scored AS (
  SELECT pe.user_id,
         pe.age_band,
         pe.signup_day,
         (p.today - pe.signup_day) / 7 AS weeks_ago,
         pe.signup_day + 13 <= p.today AND pe.signup_day + 7 >= r.d AS measurable,
         EXISTS (SELECT 1 FROM telemetry t
                  WHERE t.user_id = pe.user_id AND t.loai = 'phien_mo'
                    AND t.ts >= ((pe.signup_day + 7)::timestamp AT TIME ZONE 'Asia/Ho_Chi_Minh')
                    AND t.ts <  ((pe.signup_day + 14)::timestamp AT TIME ZONE 'Asia/Ho_Chi_Minh')) AS returned
    FROM person pe, params p, raw_from r
), grouped AS (
  SELECT 'all' AS split, 0 AS bucket_order, 'last 56 days' AS bucket, s.* FROM scored s
  UNION ALL
  SELECT 'signup_week', s.weeks_ago,
         to_char(p.today - 7 * s.weeks_ago - 6, 'YYYY-MM-DD') || ' to ' || to_char(p.today - 7 * s.weeks_ago, 'YYYY-MM-DD'),
         s.*
    FROM scored s, params p
  UNION ALL
  SELECT 'age_band', array_position(ARRAY['16-17', '18-22', '23-30', '31-45', '46+'], s.age_band), s.age_band, s.*
    FROM scored s
), buckets AS (
  -- Every bucket appears even when empty, so "no group" and "a hidden group" look different.
  SELECT 'all' AS split, 0 AS bucket_order, 'last 56 days' AS bucket
  UNION ALL
  SELECT 'signup_week', w, to_char(p.today - 7 * w - 6, 'YYYY-MM-DD') || ' to ' || to_char(p.today - 7 * w, 'YYYY-MM-DD')
    FROM generate_series(0, 7) w, params p
  UNION ALL
  SELECT 'age_band', o, b FROM unnest(ARRAY['16-17', '18-22', '23-30', '31-45', '46+']) WITH ORDINALITY v(b, o)
), counted AS (
  SELECT b.split, b.bucket_order, b.bucket,
         count(g.user_id)                              AS n,
         count(g.user_id) FILTER (WHERE g.measurable)  AS m,
         count(g.user_id) FILTER (WHERE g.measurable AND g.returned) AS r,
         bool_or(g.signup_day + 13 > p.today)          AS some_not_closed
    FROM buckets b
    LEFT JOIN grouped g ON g.split = b.split AND g.bucket_order = b.bucket_order
    CROSS JOIN params p
   GROUP BY b.split, b.bucket_order, b.bucket
)
SELECT split,
       bucket,
       CASE WHEN n = 0 THEN 0 WHEN n < 5 THEN NULL ELSE n END              AS n_signed_up,
       CASE WHEN n < 5 OR m < 5 THEN NULL ELSE m END                        AS n_measurable,
       CASE WHEN n < 5 OR m < 5 THEN NULL ELSE r END                        AS n_returned,
       CASE WHEN n < 5 OR m < 5 THEN NULL ELSE round(100.0 * r / m, 1) END  AS return_pct,
       CASE WHEN n = 0                 THEN 'empty'
            WHEN n < 5                 THEN 'hidden: under 5 people'
            WHEN m >= 5                THEN 'measured'
            WHEN m = 0 AND some_not_closed THEN 'week 2 not over yet'
            WHEN m = 0                 THEN 'raw telemetry expired'
            ELSE 'hidden: under 5 measurable' END                          AS status
  FROM counted
 ORDER BY CASE split WHEN 'all' THEN 0 WHEN 'signup_week' THEN 1 ELSE 2 END, bucket_order;
