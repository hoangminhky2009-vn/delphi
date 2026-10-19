-- GĐ0 — Cài scheduler LỚP 1 (pg_cron) — CHỈ chạy trên Supabase.
-- Cách chạy: Supabase Dashboard → SQL Editor → dán toàn bộ file này → Run.
-- Chạy lại an toàn: cron.schedule cùng tên job sẽ ghi đè lịch cũ.
--
-- pg_cron sống NGAY TRONG DB → kể cả Vercel/cron-job.org chết, heartbeat
-- (và từ GĐ4: job khóa kèo) vẫn chạy đúng ±60s (ràng buộc C3).
-- GĐ4 sẽ thêm job khóa kèo thật vào đây (open → locked khi tới lock_ts).

CREATE EXTENSION IF NOT EXISTS pg_cron;

SELECT cron.schedule(
    'delphi_heartbeat_pg_cron',   -- tên job, cố định
    '* * * * *',                  -- mỗi phút
    $$
    INSERT INTO public.scheduler_heartbeat (source) VALUES ('pg_cron');
    DELETE FROM public.scheduler_heartbeat WHERE beat_at < now() - interval '7 days';
    $$
);

-- GĐ4 — LỚP 1 khóa kèo NGAY TRONG DB (deadline-critical, C3): kể cả Vercel +
-- cron-job.org chết cùng lúc, kèo vẫn khóa đúng ±60s. Câu UPDATE nguyên tử,
-- idempotent — lớp 2 (/internal/tick) chạy trùng vô hại.
SELECT cron.schedule(
    'delphi_lock_markets',
    '* * * * *',
    $$
    UPDATE public.markets SET status = 'locked'
     WHERE status = 'open' AND lock_ts <= now();
    $$
);

-- ═══════════════════════════════════════════════════════════════════════════
-- DỌN SỔ CHẠY CỦA CHÍNH pg_cron (thêm 11/08 — rà soát)
-- ═══════════════════════════════════════════════════════════════════════════
--
-- ⚠⚠ ĐO ĐƯỢC TRÊN PROD: `cron.job_run_details` chiếm 20,5 / 38 MB — tức 54%
-- CẢ DATABASE, lớn hơn mọi bảng nghiệp vụ cộng lại.
--
-- Vì sao nó lớn: hai job trên chạy MỖI PHÚT từ GĐ0, và pg_cron ghi một dòng
-- kết quả cho MỖI lượt chạy. Hơn 70.000 lượt và chưa ai xoá dòng nào.
--
-- ⚠ VÀ VÌ SAO KHÔNG AI THẤY: panel "kho" của dashboard quản trị lọc
-- `nspname = 'public'`, mà bảng này nằm ở schema `cron` — nên cái lưới cảnh
-- báo sớm dựng ra để canh trần 500 MB (C1) KHÔNG BAO GIỜ nhìn thấy thứ đang
-- chiếm hơn nửa kho. Cùng lớp lỗi D61 mục 3: một chỉ số hụt thì nó ru ngủ.
--
-- Giữ 7 ngày — đủ để soi một sự cố scheduler (C3) và đủ ngắn để bảng đứng
-- yên ở cỡ vài trăm KB. Cùng hạn với `scheduler_heartbeat` ngay trên, cố ý:
-- hai sổ ghi cùng một chuyện thì đừng để chúng hết hạn lệch nhau.
SELECT cron.schedule(
    'delphi_don_cron_log',
    '17 3 * * *',                 -- 3h17 UTC mỗi ngày, tránh giờ cao điểm
    $$
    DELETE FROM cron.job_run_details WHERE end_time < now() - interval '7 days';
    $$
);

-- Kiểm tra: SELECT jobname, schedule, active FROM cron.job;
-- Xem heartbeat: SELECT * FROM scheduler_heartbeat ORDER BY id DESC LIMIT 5;
-- Cỡ sổ chạy: SELECT pg_size_pretty(pg_total_relation_size('cron.job_run_details'));
