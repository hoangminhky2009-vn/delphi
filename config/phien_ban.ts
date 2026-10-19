/**
 * SỔ ĐĂNG KÝ PHIÊN BẢN — MỘT chỗ khai mọi trục phiên bản đang chạy trong repo
 * (founder 31/08: *"tách bạch luôn rõ ràng các phần cập nhật/phiên bản… như cách
 * facebook hay các game khác làm khi cập nhật đi chứ bây giờ bị rối mù cả lên"*).
 *
 * ─── ĐO TRƯỚC KHI DỰNG (31/08) ──────────────────────────────────────────────
 * Repo có **14 định danh phiên bản trong 11 file, 7 định dạng khác nhau**, và
 * không chỗ nào liệt kê chúng. Ba ca tệ nhất:
 *   · `config/sandbox.ts` → `BALANCE_VERSION = 'balance-v2-D20'` — số QUYẾT ĐỊNH
 *     nhúng thẳng vào chuỗi PHIÊN BẢN. Hai trục khác nhau dính làm một chuỗi.
 *   · `package.json 0.1.0` ≠ `API_VERSION 'v0.4.0-gd4'` — hai "phiên bản app"
 *     nói hai số khác nhau, không cái nào sai, không cái nào biết cái kia.
 *   · `formula_version` là **TEXT** ở 2 bảng (`rank_snapshots`, `rank_ledger`)
 *     nhưng **SMALLINT** ở 4 bảng (`hanh_vi_vong`, `hanh_vi_tran`,
 *     `hanh_vi_tieu_dung`, `ho_so_goi`) — đo trên prod 31/08. Cùng một cái tên,
 *     hai kiểu, hai không gian giá trị.
 *
 * ⚠⚠ **KIẾN TRÚC CODE KHÔNG LẪN** — đo được: `server/pfm/*` import ĐÚNG 0 module
 * ngoài chính nó; `server/holdem/*` cũng vậy (trừ `sandbox/rng`). Nên file này
 * KHÔNG đi sửa code; nó chỉ đặt tên cho những trục vốn đã tách sẵn, để người đọc
 * thôi phải suy ra chúng từ 11 file rải rác.
 *
 * ─── HAI VAI, ĐỪNG TRỘN (đây là chẩn đoán chính) ────────────────────────────
 *   **D-số** = nhật ký QUYẾT ĐỊNH — *vì sao* chọn thế. Sống ở `CLAUDE.md`.
 *             Một D có thể chạm nhiều miền, có thể KHÔNG ship gì (D162 là kế
 *             hoạch), và một commit có thể gộp nhiều D (`D165-D167`).
 *   **Bản phát hành** = nhật ký ĐỔI GÌ — nhóm theo MIỀN, cho người đọc.
 *             Sống ở `docs/phat-hanh/`.
 * Trước 31/08 chỉ có vế đầu, và nó bị đọc như vế sau ⇒ "rối mù". Đo được: dãy D
 * có 4 chỗ số nhảy ngược, 2 chỗ ngày nhảy ngược, và 4 số khuyết — trong đó
 * **D183 và D187 là việc ĐÃ SHIP mà không có một dòng nào trong nhật ký**.
 *
 * ⚠ FILE NÀY MÔ TẢ, KHÔNG ÁP ĐẶT NGƯỢC. Phần lớn giá trị dưới đây **đã nằm
 * trong từng dòng dữ liệu prod** (`holdem_matches.balance_version`,
 * `hanh_vi_vong.formula_version`…). Đổi ĐỊNH DẠNG của chúng là làm mồ côi dữ
 * liệu cũ — cấm. Luật định dạng chỉ áp cho trục MỚI (xem `DANG_CHUAN`).
 */

/** Sáu miền sản phẩm. Đây là các nhóm mà patch note sẽ chia theo. */
export type MienSanPham =
  | 'dau_truong'   // engine + cân bằng + bot + map
  | 'pfm'          // quản lý tài chính cá nhân
  | 'giao_dien'    // UI · VFX · art · pixel
  | 'kinh_te'      // token T/Q · shop · nhiệm vụ · rank · trợ cấp
  | 'du_lieu'      // events · telemetry · hành vi · phân tích
  | 'ha_tang';     // API · DB · deploy · bảo mật

export const NHAN_MIEN: Readonly<Record<MienSanPham, string>> = {
  dau_truong: 'ĐẤU TRƯỜNG',
  pfm: 'QUẢN LÝ CHI TIÊU',
  giao_dien: 'GIAO DIỆN',
  kinh_te: 'KINH TẾ TRONG APP',
  du_lieu: 'DỮ LIỆU & PHÂN TÍCH',
  ha_tang: 'HẠ TẦNG',
};

export interface TrucPhienBan {
  /** Tên hằng số trong code. */
  ten: string;
  /** File khai nó. */
  o: string;
  mien: MienSanPham;
  /**
   * `luu_db` = giá trị này ĐƯỢC GHI VÀO TỪNG DÒNG DỮ LIỆU.
   * ⚠ Trục có cờ này thì **cấm đổi định dạng và cấm đổi giá trị cũ** — dòng cũ
   * mang chuỗi cũ, đổi là mồ côi. Muốn đổi luật thì THÊM giá trị mới (cổng), y
   * hệt cách `balance_version` vẫn làm.
   */
  luu_db: boolean;
  /** Một câu: nó đánh số cho CÁI GÌ. */
  gi: string;
}

/**
 * MỌI trục phiên bản đang chạy. Thêm một hằng `*VERSION*` mới mà quên khai ở
 * đây thì `tests/phien_ban.test.ts` đỏ — đó là toàn bộ lý do file này tồn tại
 * (bản đồ chép tay sẽ trôi: D169 đã trả giá đúng thế).
 */
export const SO_PHIEN_BAN: readonly TrucPhienBan[] = [
  { ten: 'API_VERSION', o: 'server/app.ts', mien: 'ha_tang', luu_db: false,
    gi: 'Bản của máy chủ, trả ra ở /health' },
  { ten: 'HOLDEM_VERSION', o: 'config/holdem.ts', mien: 'dau_truong', luu_db: true,
    gi: 'Bản ENGINE trận — đổi là replay trận cũ ra khác' },
  { ten: 'HOLDEM_BALANCE_VERSION', o: 'config/holdem.ts', mien: 'dau_truong', luu_db: true,
    gi: 'Bản LUẬT CÂN BẰNG đang mặc định (cổng balance)' },
  { ten: 'MINIGAME_DONG_GIA_VERSION', o: 'config/minigame.ts', mien: 'dau_truong', luu_db: true,
    gi: 'Bản DÒNG GIÁ của màn minigame (D466) — ghi vào từng dòng `holdem_minigame_man`; đổi là màn cũ dựng lại ra giá khác' },
  { ten: 'BO_LUAT_THEO_PHIEN_BAN', o: 'config/holdem_balance.ts', mien: 'dau_truong', luu_db: true,
    gi: 'Sổ mọi bộ luật cân bằng còn dựng lại được (tách khỏi holdem.ts ở D203)' },
  { ten: 'SANDBOX_VERSION', o: 'config/sandbox.ts', mien: 'dau_truong', luu_db: true,
    gi: '⚠ SẢN PHẨM ĐÃ CHẾT (trước pivot D24) — giữ để đọc dữ liệu cũ' },
  { ten: 'BALANCE_VERSION', o: 'config/sandbox.ts', mien: 'dau_truong', luu_db: true,
    gi: '⚠ SẢN PHẨM ĐÃ CHẾT · và là ca D-số-nhúng-vào-phiên-bản' },
  { ten: 'LEVEL_FORMULA_VERSION', o: 'config/progression.ts', mien: 'kinh_te', luu_db: true,
    gi: 'Công thức cấp độ' },
  { ten: 'NHIEM_VU_VERSION', o: 'config/progression.ts', mien: 'kinh_te', luu_db: true,
    gi: 'Bộ nhiệm vụ mùa' },
  { ten: 'RANK_FORMULA_VERSION', o: 'config/rank.ts', mien: 'kinh_te', luu_db: true,
    gi: 'Công thức điểm rank' },
  { ten: 'SCORING_VERSION', o: 'config/rank_dubao.ts', mien: 'kinh_te', luu_db: true,
    gi: 'Công thức chấm dự báo' },
  { ten: 'DIEN_MAO_PHIEN_BAN', o: 'config/avatar.ts', mien: 'giao_dien', luu_db: true,
    gi: 'Bản schema diện mạo avatar' },
  { ten: 'HANH_VI_FORMULA_VERSION', o: 'server/hanh_vi/trai.ts', mien: 'du_lieu', luu_db: true,
    gi: 'Công thức trải hành vi — đổi là dựng lại bảng phái sinh' },
  { ten: 'NANG_LUC_FORMULA_VERSION', o: 'config/nang_luc.ts', mien: 'du_lieu', luu_db: false,
    gi: 'Công thức chấm ba năng lực (D323) — chỉ trả trong DTO /me/nang-luc và /autopsy, không có cột DB riêng' },
  { ten: 'SCHEMA_VERSION', o: 'config/pfm_dac_trung.ts', mien: 'pfm', luu_db: true,
    gi: 'Bản sổ đăng ký đặc trưng PFM' },
  { ten: 'PHIEN_BAN_KHO', o: 'web/src/pfm/kho.ts', mien: 'pfm', luu_db: true,
    gi: 'Bản kho sổ ở máy người dùng' },
  { ten: 'PHIEN_BAN_KET', o: 'web/src/pfm/kho.ts', mien: 'pfm', luu_db: true,
    gi: 'Nhãn `schema_v` của gói két sao lưu lên máy chủ — tách khỏi PHIEN_BAN_KHO từ kho v3 (ngăn hũ con chỉ ở máy, hình dạng két không đổi)' },
  { ten: 'CONSENT_PHIEN_BAN', o: 'config/pfm_consent.ts', mien: 'pfm', luu_db: true,
    gi: 'Bản văn bản consent đã hiện cho user — ghi vào events cùng cú bật cờ (D250)' },
  { ten: 'CHINH_SACH_VERSION', o: 'config/chinh_sach.ts', mien: 'kinh_te', luu_db: false,
    gi: 'Bản LUẬT chính sách tiền tệ của Kho bạc — ⚠ luu_db thành true ngay khi treasury_ledger bắt đầu đóng dấu nó (D262 §5)' },
  { ten: 'RO_HANG_VERSION', o: 'config/chinh_sach.ts', mien: 'kinh_te', luu_db: false,
    gi: 'Bản RỔ HÀNG của chỉ số giá — đổi rổ là bắt đầu một chuỗi số MỚI, không nối vào chuỗi cũ' },
];

/* ══════════════════════════════════════════════════════════════════════════
 * BẢN PHÁT HÀNH
 * ══════════════════════════════════════════════════════════════════════════ */

/**
 * Số bản phát hành hiện tại: `MÙA.BẢN`.
 *
 * ⚠ CỐ Ý KHÔNG DÙNG SEMVER. Semver nói về TƯƠNG THÍCH API cho người tích hợp;
 * ở đây chưa có ai tích hợp, và cái người chơi cần biết là *"mùa nào, bản thứ
 * mấy"*. Dùng semver ở đây là mượn một lời hứa (major = breaking) mà ta không
 * giữ được và cũng không ai đòi.
 *
 * ⚠ Đây là số cho NGƯỜI ĐỌC, tách hẳn `API_VERSION` (số cho máy, ở /health) và
 * tách hẳn D-số (số cho quyết định). Ba số, ba vai — trộn lại là quay về đúng
 * chỗ rối 31/08.
 *
 * Bump khi: có một nhóm thay đổi ĐÃ LÊN PROD và đáng để founder đọc lại.
 * KHÔNG bump cho: kế hoạch chưa code, doc, refactor không đổi hành vi.
 */
export const MUA = '0.0';
/**
 * ⚠ BẮT ĐẦU TỪ `.1`, KHÔNG PHẢI `.5` — có chủ ý. App đã ship nhiều đợt trước
 * 31/08, nhưng KHÔNG đợt nào có ghi chép phát hành; đánh số lùi cho chúng là
 * bịa ra một lịch sử chưa từng được viết. `.1` là bản ĐẦU TIÊN CÓ GHI CHÉP, và
 * phần trước nó sống ở D-log (`CLAUDE.md`) — nói thẳng thế trong patch note.
 */
export const BAN_PHAT_HANH = `${MUA}.67`;

/**
 * Định dạng chuẩn cho trục phiên bản MỚI: `<miền>-v<N>-<biệt danh>`.
 * Ví dụ đang chạy đúng chuẩn: `balance-v36-regime`.
 *
 * ⚠ Ba điều CẤM, mỗi điều đều đã có ca thật trong repo:
 *   1. **Cấm nhúng D-số** (`balance-v2-D20`) — D-số là trục khác, và nó đổi
 *      nghĩa khi entry bị đổi số (đã xảy ra: D145→D146, D191→D192).
 *   2. **Cấm nhúng NGÀY** (`level-v1-2026-07-25`) — ngày đã có trong git.
 *   3. **Cấm nhúng TÊN MÙA** (`nv-v1-mua-0.0-2026-07-27`) — mùa là trục riêng
 *      (`MUA`), nhúng vào là hai thứ phải bump cùng lúc mà không ai nhớ.
 * Ba ca trên GIỮ NGUYÊN vì đã nằm trong dữ liệu prod; luật áp cho cái mới.
 */
// Miền được phép có gạch nối (`dubao-top-v1`); biệt danh thì không.
export const DANG_CHUAN = /^[a-z][a-z0-9-]*-v\d+(-[a-z][a-z0-9]*)?$/;
