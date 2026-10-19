/**
 * BẬC THANG GIAI ĐOẠN — MỘT sổ đăng ký mọi trigger ĐO ĐƯỢC cho câu "khi nào thì
 * đổi kiến trúc" (founder duyệt phương án A4-3, 03/09/2026).
 *
 * ─── VÌ SAO FILE NÀY TỒN TẠI ─────────────────────────────────────────────────
 * Trước file này, câu đó phải lắp lại từ nhiều chỗ rải rác: `CLAUDE.md` (C2 —
 * có số ĐÍCH, không có trigger) · `docs/gioi-han-ha-tang.md` §6 · `docs/luat/
 * 05-phap-ly.md` §2 · `docs/yeu-cau-ky-thuat/05b-pfm-kien-truc.md` §3.3 · trí
 * nhớ founder. Và §6 viết thẳng: *"Ba việc phải làm khi THẬT SỰ lên mốc đó"* —
 * mà "thật sự" không phải điều kiện đo được, nó là cảm tính. A11.15 cấm đúng
 * kiểu này: *"Hoãn thì ghi ĐIỀU KIỆN KÍCH HOẠT đo được, không ghi 'để sau'."*
 *
 * ─── VÌ SAO TRỎ, KHÔNG CHÉP (D61) ────────────────────────────────────────────
 * Mỗi `trigger` ở đây TRỎ tới nơi con số/mốc thật sự sống — một hằng số trong
 * code, một mục luật pháp lý, hoặc một câu hỏi đang chờ founder trả lời. File
 * này KHÔNG BAO GIỜ chép lại giá trị: bản sao thứ hai SẼ trôi (D61 — ca đắt
 * nhất là mục A10 cũ tóm tắt `hoi-luat-su.md`, chở một blocker đã tan suốt một
 * tháng vì bản gốc được sửa còn bản tóm thì không ai nhớ).
 *
 * `docs/giai-doan.md` là bản kể xuôi cho người đọc — nó cũng chỉ trỏ, không
 * chép. `tests/bac_thang.test.ts` canh cả hai chiều: cấu trúc từng bậc + mọi
 * con trỏ còn sống (file/hằng số được trỏ tới có thật không).
 *
 * ⚠ ĐỪNG NHẦM VỚI `config/giai_doan.ts` — file đó trả lời "MỘT DÒNG DỮ LIỆU
 * thuộc giai đoạn nào" (hien_tai/cu/khong_dung_lai_duoc, suy từ balance_version).
 * File NÀY trả lời "CẢ SẢN PHẨM đang ở bậc thang nào" (mùa 0.0 → đa quốc gia).
 * Hai trục khác hẳn nhau, tình cờ trùng nghĩa tiếng Việt — cố ý đặt tên khác
 * (`bac_thang` vs `giai_doan`) để khỏi lẫn.
 */

/** Bảy bậc, đúng thứ tự leo. Không phải mọi bậc đều leo tuần tự (D207 nói rõ
 *  bậc `c2_5000` KHÔNG cần chờ `cong_150` xong trước; `kho_lanh` cũng vậy —
 *  D216: dung lượng `events` đầy theo THỜI GIAN, không theo số người, nên có
 *  thể chạm trước hoặc sau bất kỳ bậc nào khác). */
export type TenBac =
  | 'mua_0_0'
  | 'cong_150'
  | 'kho_lanh'
  | 'dong_goi_app'
  | 'doanh_thu'
  | 'c2_5000'
  | 'da_quoc_gia';

/**
 * Trigger — LÝ DO file này tồn tại. Bốn kiểu, mỗi kiểu một cách trỏ:
 *  - `khong`   : chưa có trigger (đúng MỘT bậc mang kiểu này: mùa 0.0 hiện tại).
 *  - `hang_so` : một hằng số ĐÃ CÓ trong code — trỏ file + tên, KHÔNG chép giá trị.
 *  - `phap_ly` : một mốc pháp lý — trỏ doc luật + mục.
 *  - `cho`     : đang chờ founder trả lời — mã câu hỏi + nơi giữ câu đó.
 *  - `quyet_dinh`: một QUYẾT ĐỊNH của founder đã ghi ở doc — trỏ doc + mục.
 *                Không có con số nào để đo; ép nó thành hằng số là bịa đồng hồ.
 */
export type Trigger =
  | { readonly kieu: 'khong' }
  | { readonly kieu: 'hang_so'; readonly o: string; readonly ten: string }
  | { readonly kieu: 'phap_ly'; readonly o: string }
  | { readonly kieu: 'cho'; readonly cau: string; readonly o: string }
  | { readonly kieu: 'quyet_dinh'; readonly o: string };

export interface BacThang {
  readonly ten: TenBac;
  /** Nhãn người đọc, tiếng Việt. */
  readonly nhan: string;
  /** MỘT câu: kiến trúc đổi gì ở bậc này. */
  readonly doi_gi: string;
  readonly trigger: Trigger;
  /** Thứ gì ở bậc này là cửa một chiều — hoặc đúng chuỗi `'không'`. */
  readonly mot_chieu: string;
}

export const BAC_THANG: readonly BacThang[] = [
  {
    ten: 'mua_0_0',
    nhan: 'Mùa 0.0 — hiện tại',
    doi_gi: 'Vercel Hobby (một function) + Supabase Singapore free tier; cổng hàng chờ có sẵn nhưng đóng vì trần của nó cao hơn hẳn mẫu số thật hôm nay (D207/D64/A11.1)',
    trigger: { kieu: 'khong' },
    mot_chieu: 'không',
  },
  {
    ten: 'cong_150',
    nhan: 'Cổng chặn đồng thời',
    doi_gi: 'Bật cổng hàng chờ Cloudflare Worker — chặn ĐỒNG THỜI ở biên, đứng trước cả Vercel lẫn DB (D207)',
    trigger: { kieu: 'hang_so', o: 'web/worker/cong.js', ten: 'TRAN_TRONG' },
    mot_chieu: 'không — hai cửa fail-open có sẵn (thiếu secret `CONG_BI_MAT` hoặc thiếu binding `CUA` ⇒ cổng tự tắt)',
  },
  {
    ten: 'kho_lanh',
    nhan: 'Kho lạnh cho events',
    doi_gi: 'Cold-archive `events` theo THÁNG: detach partition cũ, chuyển ra kho lưu trữ ngoài, giữ khôi phục được — diễn giải A3.3 cho ca dung lượng (D216, `docs/luat/04-du-lieu.md` §B1); KHÔNG xoá dòng, KHÔNG rút gọn `state_snapshot_json`',
    trigger: { kieu: 'hang_so', o: 'config/ha_tang.ts', ten: 'TRAN_KHO_LANH_MB' },
    mot_chieu: 'không — detach + archive khôi phục được; cửa một chiều THẬT nằm ở chỗ khác: xoá dòng hoặc bỏ `state_snapshot_json` để né trần, cả hai đều bị cấm dù chạm bậc này (§B1)',
  },
  {
    ten: 'dong_goi_app',
    nhan: 'Đóng gói app (native, hoặc vượt trần Discord Activity)',
    doi_gi: 'Nền lưu cục bộ của `KhoPfm` đổi IndexedDB → SQLite, phiên đăng nhập đổi cookie → Bearer, thêm service worker',
    trigger: {
      kieu: 'cho',
      cau: 'A1',
      /*
       * Tờ câu hỏi A1 CHƯA có nhà trong repo — nó đang ở scratchpad của phiên
       * dựng file này, không phải một tài liệu đã tồn tại từ trước. Trỏ vào
       * mục lục nhật ký: entry D<n> của chính đợt A4-3 (mang nguyên văn câu A1)
       * xuất hiện ở đó ngay khi `npm run nk:index` chạy — không bịa một đường
       * dẫn tới thứ chưa có, và không cần sửa con trỏ này khi số D được cấp.
       */
      o: 'docs/nhat-ky/00-muc-luc.md',
    },
    mot_chieu: 'không — đổi nền lưu trữ (IndexedDB → SQLite) chạy song song/di trú được, chưa khoá gì',
  },
  {
    ten: 'doanh_thu',
    nhan: 'Có doanh thu',
    doi_gi: 'Rời Vercel Hobby (fair-use cấm dùng thương mại) + rời UptimeRobot free (ToS phi thương mại) + mở van bán cờ `PFM_COHORT_XUAT` (D148, đang tắt)',
    trigger: { kieu: 'phap_ly', o: 'docs/luat/05-phap-ly.md §2' },
    mot_chieu: 'consent/PDPD — dữ liệu đã hứa "chỉ phục vụ R&D" (A11.16) không hồi tố thành thương mại được, phải là một tập tách riêng',
  },
  {
    ten: 'c2_5000',
    nhan: 'C2 — mốc tải mục tiêu (xem `CLAUDE.md` A2)',
    doi_gi: 'Cloudflare Workers + Hyperdrive (đích chọn 03/09/2026) hoặc process thường trực cùng region, thay serverless mỗi-request-một-kết-nối; `events` chạm trần dung lượng của gói free Supabase',
    trigger: {
      kieu: 'cho',
      cau: 'A2',
      // §6 đã liệt kê BA việc phải làm, và `05b-pfm-kien-truc.md` §3.3 đã
      // liệt kê thêm các ngưỡng đo được riêng cho phần PFM của mốc này — số
      // cụ thể nằm ở hai tài liệu đó, KHÔNG chép lại ở đây. Nhưng CHỌN LÚC
      // NÀO BẤM NÚT cho toàn bộ kiến trúc vẫn là quyết định của founder, chưa
      // gộp thành một điều kiện bấm-nút duy nhất trong code.
      o: 'docs/gioi-han-ha-tang.md §6',
    },
    mot_chieu: 'không — chuyển hạ tầng tự nó làm được ngược; rủi ro là ghi bị DB từ chối nếu chạm trần dung lượng trước khi kịp chuyển',
  },
  {
    ten: 'da_quoc_gia',
    nhan: 'Đa quốc gia',
    doi_gi: 'Múi giờ/tiền tệ đổi từ hằng số toàn cục sang cột theo-user thật (đã nằm sẵn từ K15/D148), thêm chiều `quoc_gia` vào cửa tổng hợp cohort (K14), mở pháp lý riêng từng nước',
    trigger: {
      kieu: 'quyet_dinh',
      // K15 nói thẳng: trigger là "ngày founder quyết định mở nước thứ hai" —
      // một QUYẾT ĐỊNH, không phải con số. Bản đầu (A4-3) trỏ tạm vào
      // `SAN_MAU_COHORT` và tự khai "gần đúng nhất"; rà lại: một con trỏ gần
      // đúng trong file có mục đích là con-trỏ-đúng còn tệ hơn không có, nên
      // thêm kiểu `quyet_dinh` cho đúng bản chất (D213).
      o: 'docs/yeu-cau-ky-thuat/05b-pfm-kien-truc.md §K15',
    },
    mot_chieu: 'không — cột `mui_gio`/`tien_te` đã tồn tại từ hôm nay đúng để tránh cửa một chiều này (K15: ngày đã ghi theo múi giờ cũ thì không diễn giải lại được)',
  },
];
Object.freeze(BAC_THANG);

/**
 * Mã câu hỏi của mọi trigger kiểu `cho` — dùng ở `docs/giai-doan.md` (đếm) và
 * ở test (canh không rơi rớt). Suy từ registry, không chép tay (D61 — cùng lý
 * do `PHIEN_BAN_SONG` ở `config/giai_doan.ts` suy từ registry thay vì liệt kê).
 */
export function bacDangCho(): readonly string[] {
  return BAC_THANG
    .map((b) => b.trigger)
    .filter((t): t is Extract<Trigger, { kieu: 'cho' }> => t.kieu === 'cho')
    .map((t) => t.cau);
}
