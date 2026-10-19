/**
 * ĐO LƯỜNG VẬN HÀNH — tham số (A9; bản yêu cầu `docs/yeu-cau-ky-thuat/01-…` §2).
 *
 * ⚠ ĐÂY KHÔNG PHẢI THAM SỐ KINH TẾ (A4/A8.2). Không một T hay Q nào đổi chủ vì
 * mấy con số dưới đây — chúng chỉ quyết định app GHI LẠI BAO NHIÊU về chính nó.
 * Sửa được mà không cần founder duyệt; nhưng sửa `LOAI` hay `CHI_TIET_CHO_PHEP`
 * thì phải viết được nó trả lời CÂU HỎI GÌ (quy tắc vàng A7).
 *
 * ─── VÌ SAO MỌI THỨ Ở ĐÂY ĐỀU CÓ TRẦN ────────────────────────────────────────
 * Ba trần thật đang treo trên đầu (A9): Supabase free 500 MB · Vercel free
 * 1 triệu request/tháng · pool 5 kết nối (C1). Ghi thô (từng cú chạm + nhịp tim
 * 30 giây) đo ra ~200 MB/tháng, ghi gọn ~30 MB/tháng — chênh MƯỜI LẦN mà trả lời
 * được y hệt các câu hỏi. Nên mỗi hằng số dưới đây là một cái van, không phải
 * một con số tuỳ hứng.
 */

/* ══════════════════════════════════════════════════════════════════════════
 * 1. DANH MỤC `loai` — mỗi dòng trả lời MỘT câu hỏi cụ thể của founder
 * ══════════════════════════════════════════════════════════════════════════ */

export const LOAI = [
  /** Thời gian từng giai đoạn · thời gian mỗi tương tác. `ms` trên `man_ra`. */
  'man_vao',
  'man_ra',
  /** Chơi trong mấy giờ · có quay lại thường xuyên không. `ms` trên `phien_dong`. */
  'phien_mo',
  'phien_dong',
  /** Đăng nhập xong CÓ CHƠI KHÔNG (trước 03/08 không có cách nào biết). */
  'dang_nhap',
  /** Phễu: đăng ký → xác minh email → onboard → nhận vốn → trận đầu. */
  'dang_ky_buoc',
  /** Bỏ màn hướng dẫn ở bước nào (CoachTap trước nay là trạng thái client thuần). */
  'huong_dan_buoc',
  /** Thoát trận giữa chừng ở giai đoạn nào. */
  'tran_thoat',
  /** Sức khoẻ kỹ thuật; nối với `RanhGioiLoi` + `errorElement` đã có (D57.5). */
  'loi_client',
  /**
   * §4.2 mục 12 — tỷ lệ lỗi API mà NGƯỜI DÙNG THẬT gặp (founder chốt 03/08).
   *
   * ⚠ VÌ SAO KHÔNG ĐỌC LOG MÁY CHỦ CHO XONG: có hai lớp lỗi máy chủ KHÔNG THỂ
   * thấy được, về nguyên tắc chứ không phải vì thiếu công cụ —
   *   · `timeout` — request tới nơi, xử lý xong, trả lời không về kịp. Máy chủ
   *     ghi nhận 200 THÀNH CÔNG.
   *   · `network` — request chưa từng tới. Máy chủ không có gì để ghi.
   * Đúng lớp lỗi D57 vừa đặt tên ("trận trông như chết"), và là lớp tệ nhất với
   * người chơi vì họ không biết nên đợi hay tải lại.
   *
   * ⚠ CHỈ GHI KHI LỖI, không ghi khi thành công ⇒ app khoẻ thì gần như 0 dòng.
   * Hệ quả: đây là TỬ SỐ, không phải tỷ lệ — mẫu số (tổng request, phân bố
   * status phía máy chủ) đọc ở bảng điều khiển Vercel, miễn phí, 0 byte kho.
   */
  'loi_api',
  /** ⚠ CHỈ cho nút đang nghi ngờ — xem `CHAM_NUT_BAT`, hiện RỖNG. */
  'cham_nut',
  /**
   * PFM/Oracle (GĐ7, P10 🔒): "gương/boost/lời-mời hiển thị → telemetry" — không
   * nhãn thì câu "can thiệp có hiệu quả không" vĩnh viễn không trả lời được
   * (bài học D85). CHỈ lượt hiển thị vận hành — không tiền, không niềm tin nên
   * đây là `telemetry`, không phải `events` (ranh A9); nhịp có niềm tin thật
   * của luật (đặt/bắn/giữ/vỡ) đã đi `events` qua K5 ở `luat.ts`/`pfm_luat`.
   */
  'oracle_hien',
  /** Cùng lý do `oracle_hien` — nấc TƯƠNG TÁC của phễu 5 nấc (T7.5), đo thô. */
  'oracle_tuong_tac',
  /**
   * MỘT MÓN BỊ SERVER TỪ CHỐI VĨNH VIỄN ở `/pfm/dong-bo` (D259).
   *
   * ⚠⚠ VÌ SAO PHẢI CÓ: giao ước xác nhận bảo client BỎ luôn món `bo` khỏi hàng đợi —
   * giữ lại thì một dòng hỏng chặn đứng mọi món phía sau, vĩnh viễn, im lặng. Nhưng
   * **bỏ mà không đếm là cách mất dữ liệu êm ái nhất tồn tại**: không lỗi, không log,
   * chỉ là vài dòng không bao giờ tới. Dòng này là cái đếm đó.
   * ⚠ CHỈ thêm vào danh mục ở lượt CÓ chỗ phát nó. D251 cố ý hoãn đúng dòng này vì lúc
   * ấy driver chưa tồn tại — một tên không có gì đứng sau là lời hứa bằng chú thích.
   */
  'pfm_lo_loi',
  /**
   * R5 — GIÁ CỦA K10, ĐO CHỨ KHÔNG CÃI. K10 nói *"tháng đã qua thì đóng băng"*, nên
   * một khoản ghi bù cho tháng trước KHÔNG BAO GIỜ sao lưu được: lát ấy bẩn vĩnh
   * viễn và server từ chối vĩnh viễn. Ta cố ý KHÔNG nới luật (nới là mở lại đúng chỗ
   * K10 sinh ra để đóng) — ta đếm, rồi bàn trên con số thật.
   * ⚠ Cùng luật với `pfm_lo_loi`: chỉ thêm vào danh mục ở lượt CÓ chỗ phát nó. Chỗ
   *   đó là driver két (`web/src/pfm/ket_chay.ts`), có từ lượt này.
   */
  'pfm_ket_thang_dong',
  /**
   * Một lát két vượt `PFM.BLOB_MAX` ⇒ **không cách nào gửi đi được**, mãi mãi. Khác
   * `pfm_ket_thang_dong` (đó là giá của K10, một luật ta chọn); đây là một con số —
   * 32 KB đặt từ D146 trên một phép đo *"lát dày nhất 5,2 KB"*, và câu hỏi là con số
   * ấy còn đúng với người ghi dày nhất không. `kb` = cỡ thật của phong bì, nên đọc
   * xong là biết phải nâng trần lên bao nhiêu hay phải cắt lát nhỏ ra.
   */
  'pfm_ket_qua_lon',
  /**
   * ⭐ CÁCH người dùng nhập một khoản Ở TẦNG GIAO DIỆN: chạm tờ · gõ số · lặp khoản cũ.
   *
   * ⚠⚠ KHÁC HẲN `hv_cach_ghi` CỦA SỔ ĐĂNG KÝ, và sự khác ấy là cả lý do dòng này tồn
   * tại. `hv_cach_ghi` là ĐẶC TRƯNG nghiên cứu (`tay | mau_lap | dan_sms`) — nhập bằng
   * tờ hay bằng bàn phím thì **đều là `tay`**, và thêm giá trị vào đó là đổi sổ đăng ký,
   * tức phải tăng `SCHEMA_VERSION` và làm gãy so sánh với mọi kỳ cũ.
   * ⚠ Câu hỏi nó trả lời: *"chọn tờ cho tiện có kéo người ta LÀM TRÒN số không?"* — bàn
   *   tiền cố ý đặt gõ tay ngang hàng với chạm tờ, và đây là chỗ đo xem cân ấy có đúng.
   */
  'pfm_ghi',
  /**
   * D603 — KHO PFM CÓ ĐƯỢC TRÌNH DUYỆT GIỮ LÂU DÀI KHÔNG (`navigator.storage.persist()`, `web/src/pfm/giu_ben.ts`).
   * ⚠ Câu hỏi nó trả lời: *"sổ trên máy người dùng có đang ở chế độ dọn-được-khi-cần không"* — sổ PFM chỉ nằm trên máy,
   *   nên `khong` nhiều tức là cần đẩy mạnh lời mời cài app (bản cài thường được giữ). Một dòng mỗi trang mở kho.
   */
  'pfm_kho_ben',
  /**
   * D429 — KHỐI ĐỊNH HƯỚNG đầu GƯƠNG (bản tin phân tích + khung app gợi ý): lượt HIỂN THỊ. Cùng lý do `oracle_hien`
   * (P10 🔒 — "gương/boost/lời-mời hiển thị → telemetry"): gợi ý khung là BOOST bậc 2, không nhãn thì câu "người ta
   * có đổi khung vì gợi ý không" vĩnh viễn không trả lời được. Không tiền, không chữ — chỉ mã khung + đếm dòng.
   */
  'dinh_huong_hien',
  /** D429 — nấc TƯƠNG TÁC của cùng khối: xem khung khác · chọn khung · bấm một bước dựng. */
  'dinh_huong_tuong_tac',
] as const;

export type LoaiTelemetry = (typeof LOAI)[number];

const LOAI_SET: ReadonlySet<string> = new Set(LOAI);

export function laLoaiHopLe(x: unknown): x is LoaiTelemetry {
  return typeof x === 'string' && LOAI_SET.has(x);
}

/* ══════════════════════════════════════════════════════════════════════════
 * 2. `chi_tiet` — DANH SÁCH TRẮNG KHOÁ, KHÔNG NHẬN JSON TUỲ Ý
 * ══════════════════════════════════════════════════════════════════════════
 *
 * ⚠⚠ ĐÂY LÀ CHỖ DỄ RÒ PII NHẤT TRONG CẢ HỆ (founder chỉ ra 03/08, và đúng).
 * Một event "lỗi client" rất tự nhiên sẽ kèm thông điệp lỗi, mà thông điệp lỗi
 * rất tự nhiên sẽ kèm email hoặc handle. C7 chỉ cho thu demographic DẠNG KHOẢNG
 * — một cái email nằm trong bảng này là vi phạm THẬT, không phải rủi ro lý thuyết.
 *
 * Nên `chi_tiet` KHÔNG phải "JSONB tuỳ ý ≤ 200 byte". Nó là một bản ghi có
 * SCHEMA: khoá phải nằm trong bảng dưới, và giá trị phải đúng một trong hai
 * hình dạng hẹp:
 *   · `'so'` — số nguyên, kẹp trong [0, SO_TOI_DA].
 *   · `'ma'` — MÃ, không phải câu chữ: `^[a-z0-9][a-z0-9_.:-]{0,39}$`.
 *              Ký tự `@` và dấu cách KHÔNG lọt qua ⇒ một địa chỉ email không
 *              thể sống sót qua cửa này dù ai đó lỡ nhét vào.
 * Khoá lạ → bỏ IM LẶNG (cùng cách xử lý với `loai` lạ: client cũ sau khi deploy
 * vẫn còn gửi đồ cũ, không được làm hỏng phiên của họ).
 *
 * ⚠ `loi_client.ma` là MÃ LỖI, KHÔNG PHẢI THÔNG ĐIỆP LỖI. Muốn có thông điệp
 * thì đọc Sentry (D11), đừng nới cửa này.
 */
export type KieuTruong = 'so' | 'ma';

export const CHI_TIET_CHO_PHEP: Readonly<
  Record<LoaiTelemetry, Readonly<Record<string, KieuTruong>>>
> = {
  man_vao: {},
  man_ra: {},
  /*
   * D603 — `display_mode` = `standalone` (mở từ bản đã cài) · `browser` (tab trình duyệt) · `nhung` (trình duyệt nhúng
   * Zalo/Facebook/Messenger/TikTok, iframe Discord). Câu hỏi: *"bao nhiêu người đang dùng bản cài"* — trước D603 không đo.
   */
  phien_mo: { display_mode: 'ma' },
  phien_dong: {},
  dang_nhap: {},
  dang_ky_buoc: { buoc: 'ma' },
  huong_dan_buoc: { buoc: 'ma' },
  /*
   * `giay` = đã ở trong trận bao nhiêu giây lúc rời đi (founder hỏi 03/08:
   * *"bỏ vào phút thứ mấy"*).
   * ⚠ VÒNG KHÔNG THAY ĐƯỢC PHÚT: một vòng dài ngắn tuỳ người đọc bảng, tuỳ có
   * mở shop hay không, và bàn 8/12/16 ô thì cùng "vòng 3" ở những thời điểm
   * khác hẳn nhau. Muốn biết người ta chán ở PHÚT thứ mấy thì phải đo phút.
   */
  tran_thoat: { vong: 'so', giay: 'so' },
  loi_client: { ma: 'ma' },
  // `ma` = `ApiError.code` (đã là slug sẵn: timeout · network · rate_limited…);
  // `man` mang route người dùng đang đứng. CỐ Ý KHÔNG có đường dẫn endpoint:
  // nó chứa id kèo/trận nên sẽ thổi cardinality đúng như `man` thô (§3 bước 1).
  loi_api: { ma: 'ma' },
  cham_nut: { nut: 'ma' },
  // `noi_dung` = id tĩnh trong `web/src/pfm/oracle.ts` (NOI_DUNG); `bac` = 1/2/3
  // của thang can thiệp — cả hai đều KHÔNG mang tiền, không mang chữ tự do.
  oracle_hien: { noi_dung: 'ma', bac: 'so' },
  // `hanh_dong` ∈ TUONG_TAC_ORACLE ('xem_them'|'bo_qua'|'chap_nhan_moi') — chấp
  // nhận lời mời bậc 3 KHÔNG PHẢI đã đặt luật xong, chỉ là đi sang màn đặt luật.
  oracle_tuong_tac: { noi_dung: 'ma', hanh_dong: 'ma' },
  /*
   * `loai` ∈ 'goi'|'nhip'; `ma` = `action_type` của nhịp (vắng với gói).
   * ⚠ CỐ Ý KHÔNG mang `ly_do` của server: nó là CÂU CHỮ tiếng Việt ("dong[0] thiếu
   * gia_tri"), không phải MÃ — nó không lọt qua hình `'ma'`, và nếu nới cửa cho nó lọt
   * thì ta vừa mở đúng con đường mà §2 dựng ra để chặn (một câu lỗi rất tự nhiên sẽ
   * kèm dữ liệu người dùng). Muốn biết lý do thì đọc phản hồi ở client; ở đây chỉ ĐẾM.
   */
  pfm_lo_loi: { loai: 'ma', ma: 'ma' },
  /*
   * `lui` = số tháng lùi so với tháng đang sống (1 = tháng liền trước). Đó chính là
   * câu hỏi cần trả lời: nếu gần như mọi ca đều là `lui = 1` thì việc nới K10 cho
   * ĐÚNG tháng vừa đóng là một thay đổi nhỏ và đáng; nếu chúng rải đều thì không.
   * ⚠ Cố ý KHÔNG mang mã tháng (`'2026-08'`): nó là một trục thời gian có thật, ghép
   *   với các dòng khác của cùng người là thu hẹp được danh tính (§3).
   */
  pfm_ket_thang_dong: { lui: 'so' },
  pfm_ket_qua_lon: { kb: 'so' },
  // `cach` = 'to' (chạm tờ) · 'go' (bàn phím) · 'lap' (lặp khoản cũ). KHÔNG mang số tiền:
  // đây là telemetry, và số tiền của người dùng không rời máy (P2 🔒).
  pfm_ghi: { cach: 'ma' },
  // `ket_qua` ∈ `da_ben` · `duoc` · `khong` · `khong_ho_tro` · `loi` (`giu_ben.ts`). Không mang gì khác.
  pfm_kho_ben: { ket_qua: 'ma' },
  /*
   * D429 — `khung` = mã khung đang xem (`hu` · `50_30_20` · `kakeibo`) hoặc `khong` (chưa đủ dấu hiệu để xếp);
   * `dau_hieu` = số dấu hiệu của khung ấy · `so_bo` = 1 khi gợi ý còn sơ bộ · `chu_y`/`du_phong` = số dòng bản tin.
   * KHÔNG mang dấu hiệu nào cụ thể hay số tiền: mã khung + đếm là đủ để nối với cú chọn khung (`ctx_khung`).
   */
  dinh_huong_hien: { khung: 'ma', dau_hieu: 'so', so_bo: 'so', chu_y: 'so', du_phong: 'so' },
  // `hanh_dong` ∈ `xem` (xem khung khác) · `dung` (chọn khung) · `buoc:<mã bước>` (bấm một bước dựng — đi sang màn khác,
  // KHÔNG phải đã làm xong bước ấy; cùng nếp `chap_nhan_moi` của `oracle_tuong_tac`).
  dinh_huong_tuong_tac: { khung: 'ma', hanh_dong: 'ma' },
};

/**
 * Trần độ dài của một giá trị kiểu `'ma'`.
 *
 * ⚠ Khai thành HẰNG SỐ chứ không chôn trong regex, vì phía client phải CẮT theo
 * đúng con số này. Bản 04/08 cắt lý do lỗi ở 48 ký tự rồi ghép thêm tiền tố
 * `discord:authorize:` ⇒ có thể ra 66, mà máy chủ thì **bỏ IM LẶNG** cả trường
 * khi sai hình dạng. Nó chỉ lọt vì lý do hôm đó ngắn tũn — tức đúng lúc thông
 * điệp lỗi dài và có ích thì nó biến mất.
 */
export const MA_TOI_DA = 40;

/** Hình dạng của một giá trị kiểu `'ma'`. Không dấu cách, không `@`, không hoa. */
export const MAU_MA = new RegExp(`^[a-z0-9][a-z0-9_.:-]{0,${MA_TOI_DA - 1}}$`);

/**
 * PHỄU ĐĂNG KÝ — các mốc của `dang_ky_buoc.buoc`, ĐÚNG THỨ TỰ.
 *
 * Khai ở đây chứ không rải chuỗi trong màn: dashboard vẽ phễu theo mảng này,
 * nên thứ tự VÀ chính tả phải có một nguồn duy nhất. Gõ lệch một dấu gạch là
 * mất một bậc phễu mà không có gì báo.
 *
 * §4.2 điểm 7 khai nghi phạm rò rỉ số một là bước `xac-minh-email` — chính là
 * lý do bước đó phải là một mốc riêng chứ không gộp vào `nhan-von`.
 */
/**
 * ⚠ RÚT TỪ NĂM BƯỚC XUỐNG HAI (03/08, sau đợt kiểm) — ĐỌC LÝ DO TRƯỚC KHI THÊM LẠI.
 *
 * Ba bước bị gỡ (`xac-minh-email`, `nhan-von`, `tran-dau`) đo được CHÍNH XÁC HƠN
 * từ trạng thái bền: `auth_accounts.email_verified_at`, `auth_accounts.user_id`,
 * và `holdem_matches`. Nguồn bền hơn ở ba mặt cùng lúc — không mất khi đóng tab,
 * nối được bằng khoá thật, và đọc được LÙI VỀ QUÁ KHỨ (8 tài khoản có sẵn hôm
 * nay, thay vì chờ telemetry đầy dần).
 *
 * Và bước `xac-minh-email` KHÔNG BAO GIỜ ghép được với các bước kia bằng
 * telemetry: nó mở từ LINK TRONG EMAIL, tức một lần nạp trang khác, thường là
 * trình duyệt khác. Phễu dựng trên đó đo ra "% còn lại" 400% — một phễu có tỷ lệ
 * sống sót vượt 100%.
 *
 * Hai bước CÒN LẠI ở đây vì chúng xảy ra TRONG CÙNG MỘT LẦN NẠP TRANG (màn đăng
 * ký), nên mã phiên ghép được, và chúng trả lời đúng một câu mà trạng thái bền
 * không bao giờ trả lời được: *bao nhiêu người mở màn đăng ký rồi không gửi?*
 * Trạng thái bền chỉ biết những người ĐÃ THÀNH CÔNG.
 */
export const BUOC_DANG_KY = ['mo-dang-ky', 'gui-dang-ky'] as const;
export type BuocDangKy = (typeof BUOC_DANG_KY)[number];

/**
 * MÀN HƯỚNG DẪN — 15 bước CoachTap (16/08, ít chữ), ĐÚNG THỨ TỰ xuất hiện.
 *
 * ⚠ 21 → 14 (03/08, founder chơi thử): *"21 bước là QUÁ DÀI. Người chơi lướt
 * tới bước 8-9 là ngón tay bắt đầu bấm TUA vô thức rồi"*. Xem lý lẽ gộp ở đầu
 * mảng `BUOC` trong `CoachTap.tsx`.
 *
 * ⚠ MỐC ĐỔI ĐỊNH NGHĨA: dòng `huong_dan_buoc` ghi TRƯỚC 03/08 dùng bộ id cũ
 * (`pnl`, `dong-ho`, `tu-dien`, `chon-ma`, `shop-danhmuc`, `chuyen-v3`,
 * `bang-dien-tu`, `chuyen-v5`, `chuyen-v7`). Phễu bắc qua mốc này là bắc qua
 * HAI bộ bước khác nhau — id cũ nay rơi vào `khac`, không lẫn vào bước mới, và
 * telemetry có hạn lưu 90 ngày nên nó tự hết.
 *
 * Ở đây chứ không chỉ trong `CoachTap.tsx` vì dashboard cần THỨ TỰ để vẽ phễu
 * "rơi ở bước nào" — một danh sách đếm không có thứ tự thì không nói được ai
 * bỏ sớm hơn ai. Có test khoá hai bên khớp nhau (`web/tests/quantri.test.tsx`),
 * nên thêm/bớt bước trong CoachTap mà quên ở đây thì test đỏ, không phải phễu
 * lặng lẽ sai thứ tự.
 */
export const BUOC_HUONG_DAN = [
  // 28/09 (D445 → D448) — bàn tập đọc lá + màu bàn: `la-mo-man` · `doan-la-ke` (vòng 1) · `chuyen-v3` · `mau-xanh`.
  // 16/08 — hướng dẫn ÍT CHỮ (docs/thiet-ke-de-xuat/gameplay/huong-dan-it-chu.md).
  // Bốn id cũ giữ nguyên để phễu đọc xuyên các bản: mo-shop · taisan · shop-lenh · chot.
  // 07/09 (D300) — bàn tập 12 ô: thêm `vai` · `chuyen-v5` (PHỤC HỒI) · `ky-ngo` · `chuyen-v7/v9/v10/v12`;
  // `chuyen-v6`/`chuyen-v8` của bàn 8 ô nghỉ. Phễu của trận tập cũ vẫn đọc được (id không đổi nghĩa).
  // 09/09 (D319) — sáu bước mới, và ĐÚNG BÀI CANH NÀY bắt được cú thêm: sửa
  // kịch bản mà quên phễu thì dashboard vẫn vẽ, chỉ là vẽ một cái phễu thiếu
  // sáu bậc và không ai biết. `xem-truoc` · `danh-muc` · `tay` · `ngan-hang` ·
  // `ngan-hang-ky` · `phong-cach`.
  // ⚠ Thứ tự phải bằng ĐÚNG thứ tự trong KICH_BAN — phễu đọc theo bậc, đảo hai
  // bậc là đọc ra một chỗ bỏ cuộc không có thật.
  // 12/09 — `chia-vai` · `vai-cua-ban`: màn chào vai ĐÓNG BĂNG ở bàn tập, coach nói
  // trên chính màn đó (founder 12/09). Đứng trước `mo-shop` vì màn ấy hiện trước mọi thứ.
  // 12/09 (Q3) — `thi-truong`: dải sáu mã cùng nhích sau chốt (`DaiThiTruong`),
  // đứng TRƯỚC `ketqua` vì cú nhích xảy ra ngay khi ô lật xong, trước cú bấm VÌ SAO.
  // ⚠⚠ 15/09 (D336) — KỊCH BẢN SẮP LẠI THEO VÒNG, và có HAI LÀN. `vai` lên trước
  // `mo-shop` (hết cú chạm SHOP rồi bị đóng shop), thêm `muc-tieu` (câu mục tiêu trận)
  // và `tin-gia-lo` (làn khi-xảy-ra: băng TIN GIẢ ở vòng 4). Bốn bậc làn khi-xảy-ra
  // (`tin-truoc` · `truot-gia` · `tin-gia-lo` · `dam-dong-be-o`) KHÔNG phải bậc phễu:
  // chúng nổ theo cách chơi, vắng mặt ở một người không có nghĩa là người đó bỏ cuộc.
  // Trước D336 ba trong số đó đứng giữa mạch và CHẶN mạch — phễu cũ đọc "bỏ ở ngân
  // hàng" cho những người mà trợ lý không hề nói tới ngân hàng.
  'chia-vai', 'vai-cua-ban',
  // D336 lượt 2 — `hai-phe` (vòng 1, trước lệnh đầu): sáu mã chia phe RỦI RO | PHÒNG THỦ. Founder 15/09:
  // xong màn tập "vẫn chưa biết tính chất của các loại tài sản".
  'vai', 'muc-tieu', 'la-mo-man', 'doan-la-ke', 'mo-shop', 'hai-phe', 'taisan', 'shop-lenh', 'xem-truoc', 'chot', 'thi-truong', 'ketqua', 'vi-sao',
  // 08/09 (D312) — `doc-loi`: dạy ĐỌC chú thích lá (dấu `!` = chuyện ngoài đời,
  // không phải tác dụng trong trận — D28). Founder hỏi thẳng "cách xem chú thích
  // các lõi chưa?" và câu trả lời lúc ấy là chưa.
  // 12/09 (Q3) — `so-lien-he`: nút SỔ LIÊN HỆ (vòng 3, sau khi đã mở bảng điện tử).
  // 12/09 — vòng lá tách ba nhịp (founder: thiếu bước chỉ vào SHOP, và phải dạy
  // ĐỌC lá trước khi CHỌN): `mo-shop-loi` (chờ tay mở shop) → `doc-loi` (đọc dấu
  // (!)) → `loi-chien-thuat` (chọn). `doc-loi` vì thế đứng TRƯỚC `loi-chien-thuat`.
  // ⚠⚠ 19/09 (D351) — VÒNG 2 SẮP LẠI THÀNH MỘT MẠCH VỀ PHÍ, nên phễu phải đi theo:
  // `mo-bang` lên vòng 2 (ngay sau `vi-sao` — chỉ chỗ nhìn sổ lệnh, thứ quyết định phí),
  // `danh-muc` xuống vòng 3 để vòng 2 vẫn đúng 8 bậc.
  // ⭐ ĐÚNG BÀI CANH NÀY bắt được cú đảo: tôi sửa kịch bản mà quên phễu, và nếu lọt thì
  // dashboard vẫn vẽ một cái phễu trông bình thường — chỉ là nó đọc ra "người này bỏ ở
  // bảng điện tử" cho những người thật ra đã đi qua bảng từ vòng trước. Đúng lớp lỗi mà
  // chú thích D319 ở trên đã tả, lặp lại lần thứ hai.
  'chuyen-v2', 'mo-bang', 'mo-shop-loi', 'doc-loi', 'loi-chien-thuat', 'chuyen-v3', 'danh-muc', 'so-lien-he',
  // D433 — bàn tập v54 (ô úp): `du-bao-ky-hop` (vòng 3 — cược vào ô ⚖ còn úp). `ky-ngo` NGHỈ (v54 tắt kỳ ngộ).
  // `bao-ky-hop`/`vi-sao-tang-lai` lên vòng 7; `rui-ro-ky-hop`/`rut`/ngân hàng lên vòng 8; `chuyen-v9` đứng sau
  // ngân hàng (vòng 9 — ô vừa lật). Id không đổi nghĩa (vẫn kể đúng ô ấy) nên phễu cũ vẫn đọc được.
  'du-bao-ky-hop',
  // 13/09 — ba bậc DẠY ĐÚNG LÚC (đám đông bẻ ô · trượt giá · tin trước). D336: sang làn
  // khi-xảy-ra, xếp ở vòng sớm nhất chúng có thể nổ trên bàn tập.
  'tin-truoc', 'truot-gia',
  // D336 lượt 2 — `loi-don-bay` (vòng 4, quầy lõi thứ hai): tiền rẻ ⇒ xu hướng dài; Đòn Bẩy nhân cả hai chiều.
  'chuyen-v4', 'lai-suat', 'loi-don-bay', 'tin-gia-lo',
  'chuyen-v5', 'tay', 'mau-xanh', 'chuyen-v7',
  // D336 — founder 15/09: màn tập "auto thua" vì không ai báo trước cú tăng lãi. `bao-ky-hop`
  // (vòng 8, luật công khai của kỳ họp) · `rui-ro-ky-hop` + `rut` (vòng 9, hệ quả + công cụ đổi
  // danh mục, không kê đơn).
  // D336 lượt 2 — `vi-sao-tang-lai` (vòng 8): ngân hàng trung ương canh lạm phát, kinh tế quá nóng thì tăng lãi.
  'bao-ky-hop', 'vi-sao-tang-lai', 'dam-dong-be-o', 'rui-ro-ky-hop', 'rut',
  // NGÂN HÀNG (v43) — hai bậc: thấy panel, rồi chọn kỳ hạn. Tách đôi vì câu hỏi
  // đáng tiền là "họ dừng ở chỗ NHÌN THẤY hay chỗ PHẢI CHỌN".
  'ngan-hang', 'ngan-hang-ky', 'chuyen-v9',
  // D336 — `dong-ho` dời xuống vòng 10: bàn tập miễn giờ tới hết vòng 9 (founder chọn A).
  'dong-ho', 'chuyen-v10', 'phong-cach', 'chuyen-v12', 'het',
  // D527 — bàn tập minigame (v58, 6 ô): kịch bản riêng `KICH_BAN_MINIGAME`, khai SAU `KICH_BAN` trong cùng tệp ⇒ phễu nối đuôi.
  // Trận tập v54 đi bậc trên, trận tập v58 đi bậc dưới — không người nào đi cả hai.
  // D545 — bàn tập v62 thêm năm bước kể (báo trước kỳ họp · kỳ họp · tự chơi · phục hồi · bong bóng); trận tập v58–v61 bỏ qua chúng.
  'mg-chia-vai', 'mg-vai-cua-ban', 'mg-nhip', 'mg-mo-shop', 'mg-loi', 'mg-lenh', 'mg-chot', 'mg-lat', 'mg-du-bao-ky-hop', 'mg-trait',
  // D454 — `mg-tien-khong-re-mai` (vòng 3, sau kỳ họp hạ lãi, trước `mg-tu-choi`): tiền rẻ nuôi lạm phát, ngân hàng sẽ nâng lãi lại.
  'mg-ky-hop', 'mg-tien-khong-re-mai', 'mg-tu-choi', 'mg-vi-sao', 'mg-phuc-hoi', 'mg-trait-2', 'mg-bong-bong', 'mg-cuoi', 'mg-het',
] as const;

/**
 * D527 — bậc "ĐI HẾT HƯỚNG DẪN" của từng kịch bản (`het` — bàn tập v54 · `mg-het` — bàn tập minigame v58). Dashboard đếm người học
 * xong theo danh sách này, không theo một id gõ tay — thêm kịch bản thứ ba thì thêm đúng một chỗ.
 */
export const BUOC_HUONG_DAN_XONG = ['het', 'mg-het'] as const;

/** Không phải một bước — dấu người chơi CHỦ ĐỘNG tắt trợ lý (khác "đi mất"). */
export const BUOC_TAT_TRO_LY = 'tat-tro-ly';

/* ══════════════════════════════════════════════════════════════════════════
 * 3. `man` — MẪU ROUTE, KHÔNG PHẢI URL CỤ THỂ
 * ══════════════════════════════════════════════════════════════════════════
 *
 * ⚠ BẪY DUNG LƯỢNG HỎNG ÂM THẦM (founder chỉ ra 03/08). Ghi `/keo/abc-123-def`
 * thì `telemetry_ngay` — bảng được chọn CHÍNH VÌ nó nhỏ vĩnh viễn — đẻ một dòng
 * cho mỗi kèo mỗi ngày, và nó phình theo số kèo chứ không theo số câu hỏi. Không
 * có gì báo lỗi: bảng vẫn chạy, chỉ là mỗi tháng một chậm hơn.
 *
 * Nên `man` phải là MẪU (`/keo/:marketId`). Client chuẩn hoá (`lib/telemetry.ts`),
 * và SERVER kiểm lại — client là thứ không tin được (C4 cùng tinh thần).
 *
 * ⚠ DANH SÁCH NÀY PHẢI BẰNG ĐÚNG tập `path` trong `web/src/app/routes.tsx`.
 * Có test khoá đẳng thức đó (`web/tests/telemetry.test.tsx`) — thêm route mà
 * quên thêm ở đây thì test đỏ, không phải dashboard sai lặng lẽ.
 */
export const MAN_HOP_LE = [
  '/',
  // Predict Market
  '/du-bao',
  '/ket-qua',
  '/keo/:marketId',
  '/keo/:marketId/ket-qua',
  // Đấu trường
  '/arena',
  '/arena/huong-dan',
  // 16/08 — link mời bàn chung (0040): mẫu, không phải mã cụ thể (cardinality).
  '/arena/ban/:banMa',
  '/arena/tran/:matchId',
  '/arena/tran',
  '/alpha-draft',
  '/alpha-draft/tran',
  /*
   * D333 — màn điều phối buổi đo: lưu lượng của người TỔ CHỨC không phải hành vi người chơi, nên nó cần một
   * danh tính riêng để lọc ra khỏi mọi phép đo. (Mặt quản trị từng có một dòng ở đây vì cùng lý do; D335 tách
   * nó thành trang riêng KHÔNG gửi telemetry, nên không còn gì để lọc.)
   */
  '/buoi-do',
  /*
   * D334 — bách khoa. Mẫu `:mucId` chứ không từng mục: tập mục là hữu hạn nhưng đổi theo nội dung, còn danh
   * tính màn thì phải đứng yên để so được giữa các bản.
   */
  '/bach-khoa',
  '/bach-khoa/:mucId',
  /*
   * Điều khoản — CÔNG KHAI, xem được khi chưa đăng nhập. Đáng khai riêng vì nó
   * trả lời một câu không hỏi được ở đâu khác: có ai thật sự mở nó ra đọc
   * không, và đọc bao lâu. Nếu con số ấy là 0 thì cái ô đồng ý ở màn onboarding
   * đang được tích mà không ai biết mình tích gì.
   */
  '/dieu-khoan',
  // Tab
  '/vi',
  '/shop',
  '/hanh-trinh',
  '/ho-so',
  /* 21/09 — THẺ ĐO TỪ TRẬN về ở với hồ sơ. Trước đó nó là `/tai-chinh/the`, tức thẻ của
     Đấu trường nằm trong thanh tab PFM (chỉ thị founder: thẻ alpha draft để trên profile,
     thẻ PFM để riêng). Ranh giới là NGUỒN BẰNG CHỨNG — xem `vocab.ts` §`ROUTE_PROFILE_THE`. */
  '/ho-so/the',
  '/tai-chinh',
  // 07/09 — thẻ có địa chỉ riêng; `/tai-chinh` thành cửa điều phối.
  // 21/09 — địa chỉ này ĐỔI CHỦ: nay là CHÂN DUNG PFM (hành tinh từ phỏng vấn).
  '/tai-chinh/the',
  '/tai-chinh/phong-van',
  '/tai-chinh/lo-trinh',
  '/tai-chinh/cam-ket',
  // D358 (thiết kế D355/D356) — NGÀY ĐẦU: chân dung + ba việc, đích mới sau phỏng vấn. ⚠ Web ship TRƯỚC API thì
  // lượt xem màn này rơi vào thùng `khac` của `chuanHoaMan` (mất TÊN màn, không hỏng gì) ⇒ deploy API cùng đợt.
  '/tai-chinh/ngay-dau',
  '/tai-chinh/so',
  '/tai-chinh/hu',
  '/tai-chinh/guong',
  '/cai-dat',
  // Auth + đích link email
  '/onboard',
  '/onboard/dang-ky',
  '/onboard/quen-mat-khau',
  '/onboard/ho-so',
  '/verify-email',
  '/reset-password',
  // Màn 404 (route splat) — giữ nguyên ký tự `*` để danh sách này BẰNG ĐÚNG
  // tập path của router, nhờ vậy test drift là một phép so bằng, không phải
  // một danh sách ngoại lệ phải bảo trì.
  '*',
] as const;

const MAN_SET: ReadonlySet<string> = new Set(MAN_HOP_LE);

/**
 * Thùng chứa mọi `man` không nhận ra. KHÔNG dùng NULL cho việc này: NULL đã có
 * nghĩa riêng là "sự kiện không thuộc màn nào" (`phien_mo`, `dang_nhap`). Gộp
 * hai thứ vào một là mất khả năng phân biệt "không có màn" với "màn lạ".
 */
export const MAN_KHAC = 'khac';

/** Chuẩn hoá phía SERVER: mẫu hợp lệ giữ nguyên · vắng → null · lạ → `khac`. */
export function chuanHoaMan(x: unknown): string | null {
  if (x === undefined || x === null || x === '') return null;
  if (typeof x !== 'string') return MAN_KHAC;
  return MAN_SET.has(x) ? x : MAN_KHAC;
}

/* ══════════════════════════════════════════════════════════════════════════
 * 4. TRẦN + HẠN LƯU
 * ══════════════════════════════════════════════════════════════════════════ */

export const TELEMETRY = {
  /* ── Đường vào (server) ────────────────────────────────────────────── */

  /**
   * Trần sự kiện mỗi request. Vercel free 1 triệu request/tháng ⇒ GỘP LÔ LÀ
   * RÀNG BUỘC, không phải tối ưu: gửi từng cái một thì riêng telemetry ăn hơn
   * nửa hạn mức. Vượt trần → CẮT phần dư, không 4xx.
   */
  LO_TOI_DA: 50,

  /**
   * Kẹp `ms`. Đồng hồ máy người dùng sai hoặc bị sửa tay là chuyện thường, và
   * một `ms` âm hay 10 tiếng sẽ kéo lệch p50/p90 của cả ngày.
   */
  MS_TOI_DA: 30 * 60 * 1000,

  /** Kẹp giá trị kiểu `'so'` trong `chi_tiet` (vd `tran_thoat.vong`). */
  SO_TOI_DA: 100_000,

  /**
   * Trần CỨNG cho `chi_tiet` sau khi đã lọc danh sách trắng, đo bằng byte UTF-8
   * của chuỗi JSON.
   *
   * ⚠ VÌ SAO VẪN CẦN dù đã có danh sách trắng (founder chỉ ra 03/08): "≤ ~200
   * byte" trong bản yêu cầu là MỤC TIÊU, không có gì thi hành nó. Trần "50 sự
   * kiện" không chặn 50 sự kiện mỗi cái 50 KB. Danh sách trắng đã chặn phần
   * lớn, nhưng đây là lớp cuối đo đúng thứ cần đo — KÍCH CỠ.
   * Vượt trần → bỏ nguyên `chi_tiet` (im lặng), giữ lại dòng: biết "có xảy ra"
   * vẫn hơn mất cả dòng.
   */
  CHI_TIET_TOI_DA_BYTE: 200,

  /* ── Rate limit ───────────────────────────────────────────────────────
   *
   * ⚠ KHÔNG dùng `consumeLimit` cho user đã đăng nhập. `consumeLimit` ghi MỘT
   * DÒNG `auth_attempts` mỗi lần gọi; ở cận trên (500 người online liên tục,
   * gộp lô 30 giây, hai khoá) là ~2,9 triệu dòng/ngày ≈ 175 MB thường trực —
   * CÁI ĐẾM TỐN GẤP NĂM LẦN CÁI ĐƯỢC ĐẾM, trên đúng cái trần 500 MB mà toàn
   * bộ A9 sinh ra để bảo vệ. (Founder chỉnh cho chính xác sổ sách: 500 là số
   * ĐĂNG KÝ, online đồng thời thực tế vài chục ⇒ số thật gần 15–20 MB. Kết
   * luận không đổi, và cách dưới đây không tốn byte nào.)
   *
   * Nên: user đã đăng nhập được đếm bằng CHÍNH DỮ LIỆU CỦA HỌ trong
   * `telemetry` (index `telemetry_user_ts_idx` sẵn có, 0 byte lưu thêm).
   * Khách chưa đăng nhập mới dùng `consumeLimit` theo IP — khách chỉ tồn tại ở
   * mấy màn auth nên lưu lượng nhỏ, `auth_attempts` chịu được.
   *
   * ⚠ KHAI THẲNG: phép đếm này có TOCTOU, vài request song song lọt cùng lúc.
   * Chấp nhận được vì đây là VAN AN TOÀN, không phải sổ tiền (bài học D55: gọi
   * tên cuộc đua thay vì giả vờ nó không có). Thiệt hại tối đa là dư vài lô
   * của một tài khoản ĐÃ ĐỊNH DANH.
   */

  /** Trần dòng telemetry một user ghi được trong `TRAN_CUA_SO_PHUT`. */
  TRAN_MOI_USER: 600,
  TRAN_CUA_SO_PHUT: 1,

  /** Khách chưa đăng nhập: trần request (không phải dòng) theo IP. */
  KHACH_TRAN_MOI_IP: 60,
  KHACH_CUA_SO_PHUT: 10,

  /* ── Hạn lưu ──────────────────────────────────────────────────────────
   * §8.3 founder chốt: thô giữ 90 ngày. Đủ dài để soi một mùa (mùa = 3 tháng,
   * A4) và so hai đợt beta liền nhau; đủ ngắn để kho không phình. Bản cuộn ngày
   * giữ VĨNH VIỄN nên xu hướng dài hạn không mất gì.
   * ⚠ Số 90 chỉ được viết ở ĐÂY, không rải trong SQL (§8.3).
   */
  GIU_THO_NGAY: 90,

  /** TTL chống-gửi-lại của lô (cùng cỡ `bet_intents`, cũng dọn trong tick). */
  GIU_LO_GIO: 24,

  /**
   * Trần số ngày cuộn trong MỘT tick. Bình thường là 0 hoặc 1; con số này chỉ
   * có tác dụng sau một đợt ngừng dài, để lần chạy lại đầu tiên không biến
   * thành một tick khổng lồ ôm cả quý trên pool 5 kết nối (C1). Tick chạy mỗi
   * phút nên phần còn lại được đuổi kịp ngay sau đó.
   */
  CUON_TOI_DA_NGAY_MOI_TICK: 30,

  /**
   * Cắt ngày theo giờ Việt Nam, KHÔNG theo UTC.
   * ⚠ Cắt theo UTC thì "một ngày" bắt đầu lúc 7 giờ sáng — hỏng đúng câu hỏi
   * *"chơi mấy giờ · có quay lại không"* mà bảng cuộn sinh ra để trả lời (A8.8).
   */
  MUI_GIO: 'Asia/Ho_Chi_Minh',

  /* ── Hàng đợi phía client ─────────────────────────────────────────────
   * ⚠ MÁY NGƯỜI CHƠI = HỘP THƯ ĐI, KHÔNG PHẢI KHO (A9). Hàng đợi chỉ để gộp lô
   * và sống sót lúc mất mạng; xoá app là mất, trình duyệt thu hồi bộ nhớ bất kỳ
   * lúc nào, và dữ liệu rải trên 500 điện thoại thì không phân tích được.
   */
  GOM_SO: 20,
  GOM_MS: 30_000,
  /** Tràn thì bỏ CÁI CŨ NHẤT — dữ liệu mới đáng hơn dữ liệu cũ chưa gửi được. */
  HANG_DOI_TRAN: 200,
  KHOA_LUU: 'delphi.telemetry.v1',

  /* ── §8.4 founder chốt: CƠ CHẾ XÂY SẴN, DANH SÁCH GẦN RỖNG ────────────
   * `cham_nut` là cái bẫy dung lượng: ghi mọi cú chạm là đường thẳng tới 200
   * MB/tháng. Muốn bật một nút thì phải viết được nó TRẢ LỜI CÂU HỎI GÌ (A7) —
   * không có câu hỏi thì không có dữ liệu.
   * ⚠ Bật nút nào cũng phải kèm NGÀY RÀ LẠI (A8.9: không đường tắt vô hạn định).
   *
   * 16/08 — HAI NHÃN ĐẦU TIÊN, cùng một câu hỏi (thiết kế 07 §5, bàn cược):
   *   `shop-chip-truoc` — lệnh đặt theo đường CẦM CHIP rồi chạm lá
   *   `shop-la-truoc`   — lệnh đặt theo đường CHẠM LÁ rồi chạm chip
   * Câu hỏi: *"hai đường nhập có ra hai PHÂN BỐ CỠ LỆNH khác nhau không?"* —
   * nếu có thì UI đang bẻ trục khẩu vị rủi ro bằng ma sát, phải sửa UI (D85
   * §1.2). Mỗi lệnh đúng một dòng, không phải mọi cú chạm.
   * ⚠ NGÀY RÀ: 30/09/2026 — đọc telemetry, trả lời câu hỏi, rồi hoặc GỠ hai
   * nhãn (đã có câu trả lời) hoặc ghi ngày rà mới kèm lý do.
   *
   * 12/09 (Q3 — LIÊN KẾT NHÌN THẤY, C4 "hỏi là đo") — HAI NHÃN NỮA, một câu hỏi:
   *   `vi-sao`     — MỞ tấm VÌ SAO (chỉ lúc mở, không lúc đóng)
   *   `so-lien-he` — MỞ SỔ LIÊN HỆ trong trận
   * Câu hỏi: *"tỷ lệ tự hỏi 'vì sao' theo vòng có đi xuống khi dải sáu mã đã
   * cho thấy liên hệ không, và người mở SỔ có đứng cùng phía cái kéo sớm hơn
   * người không mở không?"* — tín hiệu học duy nhất `events` chưa có (Q2 câu 2:
   * mọi thứ khác tính ngược được từ `ts`). Mỗi cú mở đúng một dòng.
   * ⚠ NGÀY RÀ: cùng mốc 30/09/2026 với hai nhãn trên — sau buổi đo 20 người.
   */
  CHAM_NUT_BAT: ['shop-chip-truoc', 'shop-la-truoc', 'vi-sao', 'so-lien-he'] as readonly string[],
  CHAM_NUT_NGAY_RA: '2026-09-30',
} as const;
