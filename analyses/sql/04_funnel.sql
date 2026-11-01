-- New-account funnel: of the accounts created in a window, how many reached each step?
-- Standalone copy of pheuNguoiMoi() in server/admin_phan_tich.ts, the query behind the admin dashboard.
-- Definitions: docs/metrics.md#new-account-funnel
--
-- Rules carried over from the product query:
--   * The cohort is the EMAIL ACCOUNT (auth_accounts), not the profile: it is the one key that joins every step,
--     including accounts that never finished onboarding (user_id IS NULL).
--   * Admin and test accounts are excluded (ADR-003). `user_id IS NULL OR user_id NOT IN (...)` keeps accounts
--     with no profile: `NULL NOT IN (...)` is NULL, not TRUE, and would silently drop them.
--   * Practice-table matches and matches played with forced parameters are not real play and do not count.
--   * From "consented" on, every step is a subset of "consented", not of the step before it:
--     a player can enter a match without finishing the tutorial.
--   * The tutorial step reads raw telemetry, which expires after 90 days. If the window starts before the first
--     day with complete raw data, the step is NULL (unknown), not 0.
--   * Days are Vietnam calendar days (the product's display time zone, config/telemetry.ts); timestamps stay UTC.
--
-- Window: the last 30 days up to today, the dashboard's default.
-- :practice_seeds is a psql variable (psql -v practice_seeds=...). analyses/make_cohort.ts fills it from
-- SEED_MAN_TAP_MOI_THOI in config/holdem.ts, so the list is never copied by hand.
WITH params AS (
  SELECT (now() AT TIME ZONE 'Asia/Ho_Chi_Minh')::date      AS today,
         (now() AT TIME ZONE 'Asia/Ho_Chi_Minh')::date - 29 AS since
), raw_from AS (
  -- First day of complete raw telemetry: the later of "first row ever" and "today minus the 90-day retention".
  SELECT greatest(
           coalesce((SELECT (min(ts) AT TIME ZONE 'Asia/Ho_Chi_Minh')::date FROM telemetry), p.today),
           ((now() - interval '90 days') AT TIME ZONE 'Asia/Ho_Chi_Minh')::date + 1) AS d
    FROM params p
), real_match AS (
  SELECT m.match_id, m.owner_user_id
    FROM holdem_matches m
   WHERE NOT m.co_ep_tham_so
     AND m.seed NOT IN (:practice_seeds)
), cohort AS (
  SELECT a.user_id, a.email_verified_at
    FROM auth_accounts a, params p
   WHERE a.created_at >= (p.since::timestamp AT TIME ZONE 'Asia/Ho_Chi_Minh')
     AND a.created_at <  ((p.today + 1)::timestamp AT TIME ZONE 'Asia/Ho_Chi_Minh')
     AND (a.user_id IS NULL OR a.user_id NOT IN (
           SELECT user_id FROM users WHERE (role = 'admin' OR la_tester) AND deleted_at IS NULL))
     AND NOT EXISTS (SELECT 1 FROM users d WHERE d.user_id = a.user_id AND d.deleted_at IS NOT NULL)
), purged_guests AS (
  -- Abandoned guest accounts are deleted by a clean-up job and counted per day in khach_da_don_ngay.
  -- They are added back to "created" and "profile" so a clean-up never changes how many people signed up.
  SELECT coalesce(sum(k.so), 0) AS n
    FROM khach_da_don_ngay k, params p
   WHERE k.ngay BETWEEN p.since AND p.today
), consented AS (
  SELECT c.user_id FROM cohort c JOIN users u USING (user_id) WHERE u.research_consent
), steps AS (
  SELECT 1 AS step_order, 'account created' AS step,
         (SELECT count(*) FROM cohort) + (SELECT n FROM purged_guests) AS n
  UNION ALL
  SELECT 2, 'email verified', (SELECT count(*) FROM cohort WHERE email_verified_at IS NOT NULL)
  UNION ALL
  SELECT 3, 'profile created', (SELECT count(user_id) FROM cohort) + (SELECT n FROM purged_guests)
  UNION ALL
  SELECT 4, 'research consent on', (SELECT count(*) FROM consented)
  UNION ALL
  SELECT 5, 'tutorial finished',
         CASE WHEN (SELECT since FROM params) >= (SELECT d FROM raw_from) THEN
           (SELECT count(*) FROM consented c WHERE EXISTS (
              SELECT 1 FROM telemetry t
               WHERE t.user_id = c.user_id AND t.loai = 'huong_dan_buoc' AND t.chi_tiet->>'buoc' = 'het'))
         END
  UNION ALL
  SELECT 6, 'entered a match',
         (SELECT count(*) FROM consented c WHERE EXISTS (
            SELECT 1 FROM real_match m WHERE m.owner_user_id = c.user_id))
  UNION ALL
  SELECT 7, 'finished 3 matches',
         (SELECT count(*) FROM consented c WHERE (
            SELECT count(*) FROM holdem_results r JOIN real_match m USING (match_id)
             WHERE r.user_id = c.user_id) >= 3)
)
SELECT step_order,
       step,
       n,
       CASE WHEN step_order <= 4 THEN 'account created' ELSE 'research consent on' END AS base,
       round(100.0 * n / nullif(CASE WHEN step_order <= 4 THEN (SELECT n FROM steps WHERE step_order = 1)
                                     ELSE (SELECT n FROM steps WHERE step_order = 4) END, 0), 1) AS pct_of_base
  FROM steps
 ORDER BY step_order;
