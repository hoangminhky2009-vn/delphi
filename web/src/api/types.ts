/**
 * DTO phản chiếu response THẬT của backend (server/app.ts + markets.ts +
 * subsidy.ts, version v0.4.0-gd4) — không bịa trường server chưa trả.
 * Hợp đồng chi tiết: docs/ui-ux/gd5_ui_technical_directives.md.
 * Danh mục demographic import thẳng từ config/auth.ts (alias @config) — một
 * nguồn chân lý (A8.9).
 */
import type { CuaPfm } from '@config/pfm_consent';
import type { AgeBand } from '@config/auth';
export type { AgeBand, Region, OccupationBand } from '@config/auth';
export { DEMOGRAPHIC } from '@config/auth';

/** Envelope lỗi chuẩn của server. */
export interface ApiErrorBody {
  error: string;
  message: string;
  field?: string;
}

// ============================= Auth (GĐ2) =============================

/**
 * D444 (28/09): `/api/v1/health` công khai chỉ còn hai khoá này — phần chi
 * tiết cũ (db_ok, heartbeats, tai, admin_allowlist…) giờ đòi header
 * `x-tick-secret`, mà client web KHÔNG BAO GIỜ có secret đó nên không đọc
 * được — không có lý do gõ kiểu chi tiết ở tầng client (server/app.ts giữ
 * đủ khoá cũ khi header khớp).
 */
export interface HealthResponse {
  status: 'ok' | 'degraded';
  ban_phat_hanh: string;
}

/** Hồ sơ user trong GET /auth/me (bankroll là INTEGER — C5). */
export interface UserProfile {
  user_id: string;
  handle: string;
  age_band: string;
  region: string;
  occupation_band: string;
  bankroll: number;
  role: 'user' | 'admin';
  /** Đồng ý nghiên cứu CÓ HIỆU LỰC (bật + đúng bản văn hiện hành — server quyết, 0079). */
  research_consent: boolean;
  /** Bản văn `nghien_cuu` người này đồng ý lần gần nhất; null = chưa từng có số. OPTIONAL: API cũ hơn bundle. */
  research_consent_phien_ban?: string | null;
  /** Bật từ trước khi có số bản ⇒ hỏi lại một lần (SPEC chan-truoc-beta). OPTIONAL: API cũ ⇒ không hỏi. */
  hoi_lai_nghien_cuu?: boolean;
  created_at: string;
  season_id: string;
  /**
   * Chuỗi diện mạo 19 ký tự (`config/avatar.ts`).
   *
   * OPTIONAL vì API và bundle deploy bằng hai lệnh riêng: "API cũ hơn bundle" là
   * trạng thái bình thường ở repo này. Thiếu thì `<Avatar>` vẽ lá mặc định — một
   * cái mặt đúng chuẩn, không phải ô vuông trắng.
   */
  dien_mao?: string;
  /**
   * GIỌNG HỒ SƠ (D106) — 'tu_dong' | 'tre' | 'vua' | 'chung'. OPTIONAL cùng lý do
   * `dien_mao`: API cũ hơn bundle là trạng thái bình thường; vắng ⇒ tự động.
   */
  giong_ho_so?: string;
  /**
   * HẠNG ĐẤU TRƯỜNG — id bậc (`BAC_THANG[].id` ở config/rank.ts: `tap_su` … `tao_song`), `null` khi CHƯA XẾP
   * BẬC. OPTIONAL cùng lý do `dien_mao`: máy chủ cũ không có trường này ⇒ client ẨN ô hạng, không vẽ bậc giả
   * (SPEC huy-hieu-hang-sticker, D62). Dùng với `<HuyHieuHang bac={user.bac} />` — `null`/vắng thì nó không vẽ gì.
   */
  bac?: string | null;
  /**
   * Tài khoản KHÁCH (0030) — vào chơi không cần đăng nhập.
   *
   * ⚠⚠ THIẾU TRƯỜNG NÀY LÀ LÝ DO NGƯỜI VÀO TỪ DISCORD KẸT LẠI Ở CHẾ ĐỘ KHÁCH
   * (founder 04/08). Client trước nay không có cách nào phân biệt khách với tài
   * khoản thật, nên Hub chỉ dám hiện nút đăng nhập khi `user === null` — mà khách
   * thì CÓ `user`. Kết quả: cửa duy nhất để thoát chế độ khách biến mất đúng với
   * người đang ở trong chế độ khách.
   *
   * OPTIONAL vì API và bundle deploy bằng hai lệnh riêng; vắng ⇒ coi như KHÔNG
   * phải khách, tức không mọc thêm lời mời đăng nhập cho người đã có tài khoản.
   */
  la_khach?: boolean;
}

/**
 * Khối `pfm` của GET /auth/me — CHỈ khác null khi có ít nhất MỘT cửa consent bật
 * (server/app.ts §`/auth/me`, D295). `null` ⇒ client hiểu là bốn cửa đều đóng; không có
 * hình dạng thứ ba.
 *
 * ⚠ `cua` OPTIONAL vì API và bundle deploy bằng hai lệnh riêng (cùng lý do `dien_mao`):
 * bản máy chủ cũ trong cache PWA trả `pfm` mà không có `cua`. Vắng ⇒ coi mọi cửa là
 * ĐÓNG (P7/D62: thiếu là vắng, không phải "bật") — hỏng về phía không gửi gì đi.
 * ⚠ Các trường tuần/chuỗi/token cố ý để `unknown` qua chữ ký chỉ mục: màn GƯƠNG đọc
 * chúng CÓ KIỂM ở `api/pfm.ts` §`useTrangThaiTuan`, không tin mù một hình khai sẵn.
 */
export interface MePfm {
  consent: true;
  bat_dau: string | null;
  cua?: Partial<Record<CuaPfm, boolean>>;
  [khac: string]: unknown;
}

/** GET /auth/me (200). 401 = chưa đăng nhập → client coi là khách. */
export interface MeResponse {
  email: string;
  email_verified: boolean;
  onboarded: boolean;
  user: UserProfile | null;
  /**
   * D396 — chỉ có khi CHƯA lập hồ sơ: nhóm tuổi server đã suy từ năm sinh lúc đăng ký. Có ⇒ màn hồ sơ chọn
   * sẵn và chỉ bày đúng nhóm ấy. Vắng/`null` (tài khoản cũ, bản máy chủ cũ) ⇒ chọn tay như trước.
   */
  nhom_tuoi_khai?: AgeBand | null;
  /** Xem `MePfm`. Vắng (bản máy chủ cũ) hay `null` đều là "bốn cửa đóng". */
  pfm?: MePfm | null;
  /**
   * D370 — CHẾ ĐỘ TESTER của buổi đo. `null` (hoặc vắng, bản máy chủ cũ trong cache PWA) = không
   * thuộc đợt đo nào ⇒ không vẽ dải. Rút đồng ý là thành `null` ngay lần đọc kế.
   *
   * `buoc`: 0 chưa nộp gì · 1 xong PHIẾU 1 · 2 xong Alpha Draft · 3 xong PHIẾU 2 · 4 xong PFM ·
   * 5 xong PHIẾU 3. Server CHỈ cho tiến (`GREATEST`), client không bao giờ tự suy ra số này.
   */
  buoi_do?: {
    ma: string | null; nhan: string | null; buoc: number;
    /**
     * D392 — mã BÀN buổi đo (5 ký tự) mà người này đã đồng ý; `undefined` ở API cũ. KHÁC `ma` (mã buổi
     * đo của người, 4 ký tự, điền vào phiếu) — dải dùng `ban` cho nút VÀO BÀN BUỔI ĐO.
     */
    ban?: string | null;
  } | null;
  /**
   * Có nên hỏi nhân khẩu bậc 1 ngay bây giờ không (D64 phương án B).
   *
   * ⚠ MÁY CHỦ QUYẾT (C4). Luật là "chưa khai · chưa từng hỏi · đã chơi ít nhất
   * một trận" — ba mảnh, và client tự ghép thì mỗi màn mới lại phải nhớ ghép
   * đúng. Ở đây chỉ đọc một boolean.
   * Vắng trường (bản máy chủ cũ trong cache PWA) ⇒ không hỏi, đúng phía an toàn.
   */
  hoi_nhan_khau?: boolean;
  /**
   * B5 (C8) — tài khoản chưa xác nhận đủ tuổi (khách · Discord chưa khai nhóm tuổi): MỌI cửa `requireOnboarded` trả 403
   * `chua_xac_nhan_tuoi` cho tới khi gửi năm sinh ở `POST /me/tuoi` — AppShell hiện tấm hỏi năm sinh. Máy chủ quyết (C4).
   * Vắng trường (máy chủ cũ) ⇒ không hỏi.
   */
  can_xac_nhan_tuoi?: boolean;
}

export interface LoginResponse {
  ok: true;
  onboarded: boolean;
  /**
   * Token phiên, mang bằng `Authorization: Bearer`.
   *
   * ⚠ BẮT BUỘC PHẢI DÙNG TRONG DISCORD: iframe của `{clientId}.discordsays.com`
   * là ngữ cảnh xuyên site, nên cookie `SameSite=Lax` không bao giờ được gửi —
   * không có token này thì đăng nhập bằng email "thành công" xong mọi request
   * vẫn 401. Trên web thì cookie `HttpOnly` vẫn là đường chính.
   * OPTIONAL: API cũ hơn bundle là trạng thái bình thường ở repo này.
   */
  token?: string;
}

export interface OkResponse {
  ok: true;
  message?: string;
}

export interface OnboardingResponse {
  ok: true;
  user_id: string;
  bankroll: number;
}

// ========================= Chợ kèo (GĐ3–GĐ4) =========================

export type Pool = 'macro' | 'life' | 'event';
export type MarketStatus = 'open' | 'locked' | 'resolved' | 'cancelled';

/** Một kèo trong GET /markets — CỐ Ý không có phân bố (A3.1, kể cả đã đặt). */
export interface MarketSummary {
  market_id: string;
  pool: Pool;
  question_text: string;
  resolution_source_name: string;
  resolution_source_url: string;
  open_ts: string;
  lock_ts: string;
  status: MarketStatus;
  seed_per_option: number;
  total_volume: number;
}

export interface MarketsResponse {
  markets: MarketSummary[];
}

export interface MarketOption {
  option_id: string;
  label: string;
  sort_order: number;
  range_low: string | null;
  range_high: string | null;
}

/**
 * Server tính sẵn (parimutuel.ts buildDistribution) — client hiển thị nguyên văn.
 * KHÔNG có tỷ lệ ăn ngụ ý và KHÔNG có số người: quyết định founder 19/07/2026
 * (sửa A3.1) — người chơi thấy TIỀN đang ở cửa nào, không thấy "tôi sẽ nhận bao
 * nhiêu" và không thấy bao nhiêu người đã đặt, để không tối ưu hoá theo phần
 * thưởng / theo đám đông. Ẩn ở tầng API — đừng thêm lại ở client.
 */
export interface DistributionEntry {
  option_id: string;
  /** Tổng token đang ở cửa (gồm seed). */
  volume: number;
  /** % pool — chỉ dùng vẽ thanh tỷ lệ. */
  pct: number;
}

export interface Allocation {
  option_id: string;
  amount: number;
}

/**
 * GET /markets/:id. LUẬT A3.1: key `distribution` VẮNG HẲN khi user chưa đặt —
 * UI rẽ nhánh bằng `'distribution' in data`, không phải check null/[].
 * Các trường resolved (outcome_option_id...) backend ship đầu GĐ5 (§2.5.1) —
 * optional để UI chịu được cả trước lẫn sau.
 */
export interface MarketDetail extends MarketSummary {
  resolve_deadline_ts: string;
  options: MarketOption[];
  seed_total: number;
  my_allocation: Allocation[];
  /** Số dư hiện tại — server trả kèm để UI khỏi gọi thêm /auth/me. */
  bankroll: number;
  /** Trần TỔNG phân bổ kèo này (A5.3) — server tính, hiển thị nguyên văn. */
  bet_cap: number;
  distribution?: DistributionEntry[];
  outcome_option_id?: string | null;
  resolution_note?: string | null;
  resolved_ts?: string | null;
}

/** GET /markets/:id/pool — payload nhẹ CHỈ để polling (403 pool_hidden khi chưa đặt). */
export interface PoolSnapshot {
  market_id: string;
  status: MarketStatus;
  lock_ts: string;
  total_volume: number;
  distribution: DistributionEntry[];
}

/** POST /markets/:id/bets — allocations là phân bổ MỚI TOÀN KÈO (declarative). */
export interface PlaceBetsRequest {
  allocations: Allocation[];
  idempotency_key: string;
}

export interface PlaceBetsResponse {
  ok: true;
  market_id: string;
  bankroll: number;
  my_allocation: Allocation[];
  bet_total_mine: number;
  bet_cap: number;
  total_volume: number;
  distribution: DistributionEntry[];
  /** true = server phát lại bản đã áp dụng (idempotency) — xử lý như 200 thường. */
  replayed?: boolean;
}

// ========================= Ví + trợ cấp (GĐ4) =========================

export type WalletReason =
  | 'signup_grant'
  | 'bet_place'
  | 'bet_adjust'
  | 'payout'
  | 'refund'
  | 'subsidy'
  | 'admin_adjust';

export interface WalletEntry {
  entry_id: number;
  delta: number;
  balance_after: number;
  reason: WalletReason;
  ref_market_id: string | null;
  created_at: string;
}

export interface WalletResponse {
  bankroll: number;
  entries: WalletEntry[];
  next_before: number | null;
}

export interface SubsidyClaimResponse {
  ok: true;
  amount: number;
  bankroll: number;
}

// ============== §2.5 — backend ship ĐẦU GĐ5 (code trước theo shape) ==============

export interface MyResultEntry {
  market_id: string;
  question_text: string;
  status: MarketStatus;
  outcome_option_id: string | null;
  my_total_bet: number;
  /** Tổng nhận về — SERVER tính (C4). */
  my_return: number;
  /** ± chênh lệch — SERVER tính, UI chỉ tô màu. */
  net: number;

  // ── THƯỞNG CHUỖI (founder duyệt 19/07) — backend CHƯA ship ──
  // Ba trường dưới đây là TOKEN THẬT nên BẮT BUỘC do server tính và ghi ledger
  // (chi từ Kho bạc, A3.4 cấm mint). Client tuyệt đối không tự tính.
  // UI đã dựng sẵn khung: có trường thì hiện khối lửa, không có thì ẩn.
  /** Số T thưởng chuỗi của câu hỏi này (bút toán riêng, reason `streak_bonus`). */
  streak_bonus?: number;
  /** Độ dài chuỗi đúng liên tiếp tính tới câu hỏi này. */
  streak_len?: number;
  /** Số pool KHÁC NHAU trong chuỗi (điều kiện hưởng thưởng). */
  streak_pools?: number;
  /** % thưởng đã áp (bp hoặc %) — hiện nguyên văn, không tự suy. */
  streak_rate_pct?: number;
}

export interface MyStats {
  markets_joined: number;
  resolved_count: number;
  correct_count: number;
  incorrect_count: number;
}

/**
 * ORACLE LEVEL + BẬC DỰ BÁO — `GET /me/progress`.
 *
 * Toàn bộ là CHỈ SỐ DẪN XUẤT: server tính lại từ bets/markets/holdem_results/
 * rank_snapshots mỗi request. Không có XP nào được lưu, không có gì tiêu được.
 * Công thức + ngưỡng ở `config/progression.ts`.
 */
export interface BacDuBaoEntry {
  pool: Pool;
  /** 'Vàng' | 'Bạc' | 'Đồng' | 'Chì' | 'Chưa xếp'. */
  bac: string;
  so_keo_da_tinh: number;
  /** Còn thiếu bao nhiêu kèo đã chốt nữa mới được xếp bậc. */
  con_thieu: number;
}

export interface ProgressResponse {
  level: number;
  level_toi_da: number;
  xp: number;
  xp_dau_cap: number;
  /** null = đã tối đa cấp. */
  xp_cap_sau: number | null;
  phan_tram: number;
  formula_version: string;
  nguon: {
    keo_tham_gia: number; keo_dung: number; tran_xong: number; tran_nhat: number;
  };
  dem: {
    keo_tham_gia: number; keo_dung: number; tran_xong: number; tran_nhat: number;
  };
  bac_du_bao: BacDuBaoEntry[];
}
