-- 0043 — TẦNG CHUNG CHUYỂN HÀNH VI + HỒ SƠ THEO GÓI + GIỌNG HỒ SƠ (D106, 22/08).
--
-- Founder 22/08: *"Vấn đề hiện tại là ko có chỗ chung chuyển giữa event collector
-- và lưu trữ"* + *"phân tích chỉ bật khi có đủ pack data"*. Toàn văn thiết kế:
-- docs/thiet-ke-de-xuat/pfm-hanh-vi/duong-ong-hanh-vi.md.
--
-- ⚠⚠ HAI BẢNG `hanh_vi_*` LÀ PHÁI SINH, KHÔNG PHẢI SỰ THẬT.
-- Chúng dựng lại được 100% từ `events` (append-only, A3.3) + `holdem_matches` bằng
-- `scripts/hanh_vi_dung_lai.ts`. Nên: KHÔNG trigger append-only, TRUNCATE được, nằm
-- ở `BANG_PHU_DU` của backup. Chỗ này cố ý khác `events`: `events` là nơi sự thật
-- được ghi MỘT lần trong cùng transaction với nghiệp vụ (A7); bảng này là nơi sự
-- thật ấy được TRẢI SẴN và DÁN CỜ để mọi đường đọc gộp (tính cách, phong cách, admin,
-- xuất B2B sau này) đọc MỘT nguồn thay vì mỗi chỗ tự parse JSON một kiểu (D61).
--
-- ⚠ CỜ CHẤT LƯỢNG LÀ NHÃN, KHÔNG PHẢI BỘ LỌC XOÁ (D62/A9: phân loại sai kiểu an
-- toàn là giữ lại có nhãn). Ai đọc gộp tự quyết loại cờ nào.
--
-- `ho_so_goi` thì KHÁC: nó là ẢNH CHỤP thứ người chơi ĐÃ THẤY ở gói N với công
-- thức `formula_version` — đổi công thức là thêm dòng version mới, không ghi đè.
-- Dựng lại được về mặt toán nhưng giữ để so "gói 1 vs gói 3" không phụ thuộc
-- công thức hôm nay ⇒ vào BACKUP_TABLES.

CREATE TABLE hanh_vi_vong (
  user_id        UUID        NOT NULL REFERENCES users(user_id),
  match_id       UUID        NOT NULL REFERENCES holdem_matches(match_id),
  vong           INT         NOT NULL CHECK (vong >= 1),
  -- Lúc người chơi NỘP vòng (ts của hd_cam_ket) — trục thời gian của gói.
  ts             TIMESTAMPTZ NOT NULL,
  -- Đúng `VongInsight` (server/holdem/insight.ts) — trải sẵn, không parse lại.
  lenh_json      JSONB       NOT NULL DEFAULT '[]'::jsonb,
  pnl_bp         INT,
  brier          DOUBLE PRECISION,
  brier_v        SMALLINT,
  mo_bang        BOOLEAN     NOT NULL DEFAULT FALSE,
  o_su_kien      BOOLEAN     NOT NULL DEFAULT FALSE,
  la_tin_gia     BOOLEAN     NOT NULL DEFAULT FALSE,
  chuoi_tang     BOOLEAN     NOT NULL DEFAULT FALSE,
  tu_dong        BOOLEAN     NOT NULL DEFAULT FALSE,
  cho_bp         INT,
  -- KHẨU VỊ (D106) — từ replay (tất định theo seed+log), SAU khi chốt vòng:
  -- tiền mặt / NAV (bp), số mã đang giữ. NULL ở trận không NAV.
  tien_mat_bp    INT,
  so_ma          SMALLINT,
  -- Cờ chất lượng (nhãn — xem đầu file).
  tran_xong      BOOLEAN     NOT NULL DEFAULT FALSE,
  man_tap        BOOLEAN     NOT NULL DEFAULT FALSE,
  la_khach       BOOLEAN     NOT NULL DEFAULT FALSE,
  nghi_may       BOOLEAN     NOT NULL DEFAULT FALSE,
  formula_version SMALLINT   NOT NULL,
  cap_nhat_luc   TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (match_id, vong)
);
CREATE INDEX hanh_vi_vong_user_ts_idx ON hanh_vi_vong (user_id, ts);
ALTER TABLE hanh_vi_vong ENABLE ROW LEVEL SECURITY;

COMMENT ON TABLE hanh_vi_vong IS
  'PHÁI SINH từ events — dựng lại bằng scripts/hanh_vi_dung_lai.ts. Không phải sự thật gốc.';

-- DẤU "TRẬN NÀY ĐÃ DỰNG LÚC NÀO" — kể cả trận ra 0 dòng (bỏ dở ở vòng 1, không NAV).
-- Không có dấu thì mỗi lần đọc lại quét đúng những trận ấy (founder có ~100 trận
-- bỏ dở), mỗi trận một replay. Cập nhật tăng dần so `max(events.ts)` với dấu này.
CREATE TABLE hanh_vi_tran (
  match_id       UUID        PRIMARY KEY REFERENCES holdem_matches(match_id),
  so_dong        INT         NOT NULL DEFAULT 0,
  formula_version SMALLINT   NOT NULL,
  cap_nhat_luc   TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE hanh_vi_tran ENABLE ROW LEVEL SECURITY;

-- Hành động TIỀN ngoài trận (gacha · shop · trợ cấp · cược chợ) — D106 trục chính.
-- Mỗi dòng mang NGỮ CẢNH lúc chi: số dư, cách trận gần nhất bao lâu và trận đó
-- thắng/thua, cách lần nhận trợ cấp gần nhất bao lâu. Dựng lại được y như trên.
CREATE TABLE hanh_vi_tieu_dung (
  user_id         UUID        NOT NULL REFERENCES users(user_id),
  event_id        BIGINT      NOT NULL,
  ts              TIMESTAMPTZ NOT NULL,
  loai            TEXT        NOT NULL CHECK (loai IN
                    ('gacha', 'shop_q', 'shop_t', 'tro_cap', 'cuoc', 'khac')),
  action_type     TEXT        NOT NULL,
  so_tien         INT         NOT NULL DEFAULT 0,
  don_vi          TEXT        NOT NULL CHECK (don_vi IN ('T', 'Q')),
  so_du_truoc     INT,
  phut_sau_tran   INT,
  tran_truoc_thang BOOLEAN,
  phut_sau_tro_cap INT,
  formula_version SMALLINT    NOT NULL,
  cap_nhat_luc    TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (event_id)
);
CREATE INDEX hanh_vi_tieu_dung_user_ts_idx ON hanh_vi_tieu_dung (user_id, ts);
ALTER TABLE hanh_vi_tieu_dung ENABLE ROW LEVEL SECURITY;

COMMENT ON TABLE hanh_vi_tieu_dung IS
  'PHÁI SINH từ events + wallet_ledger — dựng lại bằng scripts/hanh_vi_dung_lai.ts.';

-- HỒ SƠ THEO GÓI — ảnh chụp gói đã đầy. Một dòng / (user, gói, công thức).
CREATE TABLE ho_so_goi (
  user_id          UUID        NOT NULL REFERENCES users(user_id),
  goi_so           INT         NOT NULL CHECK (goi_so >= 1),
  formula_version  SMALLINT    NOT NULL,
  -- Trận ĐẦU và CUỐI của gói (để tra lại, và để gói không trôi khi có trận mới).
  tran_dau         UUID        NOT NULL,
  tran_cuoi        UUID        NOT NULL,
  n_tran           INT         NOT NULL,
  n_vong_quyet     INT         NOT NULL,
  chi_so_json      JSONB       NOT NULL,
  tinh_cach        TEXT        NOT NULL,
  computed_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, goi_so, formula_version)
);
ALTER TABLE ho_so_goi ENABLE ROW LEVEL SECURITY;

-- GIỌNG HỒ SƠ (founder 22/08: *"tếu tếu và meme… dựa trên độ tuổi được chọn khi
-- đăng nhập tài khoản hoặc phần setting"*). `tu_dong` = suy từ age_band.
ALTER TABLE users ADD COLUMN IF NOT EXISTS giong_ho_so TEXT NOT NULL DEFAULT 'tu_dong'
  CHECK (giong_ho_so IN ('tu_dong', 'tre', 'vua', 'chung'));
