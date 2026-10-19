/**
 * DIỆN MẠO — hợp đồng chung của tầng avatar (nền · khung viền · nhãn dán).
 *
 * Thi công theo **D36 (founder 27/07)**, thay cho bản khe-neo trước đó. Ba điểm
 * D36 đảo, ghi ở đây vì chúng quyết định TOÀN BỘ hình dạng dữ liệu bên dưới:
 *
 *   1. CHỈ HAI AVATAR MIỄN PHÍ (ĐỘI MŨ · BÚI TÓC). Áo trùm đầu chuyển thành hàng
 *      bán ở shop, bản Beta Access.
 *   2. NHÃN DÁN DÁN TỰ DO TOÀN KHUNG, không giới hạn số lượng (phương án B).
 *      Hệ KHE NEO của bản trước bị gỡ bỏ hoàn toàn.
 *   3. DÁN LÀ TIÊU VĨNH VIỄN. Không gỡ, không hoàn. Mỗi avatar dán xong là MỘT
 *      TÁC PHẨM RIÊNG; muốn làm tác phẩm mới thì phải có thêm một avatar nền.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * BA LUẬT CẤU TẠO — chúng làm cho các lỗi thường gặp KHÔNG BIỂU DIỄN ĐƯỢC, chứ
 * không phải "phải nhớ tránh".
 *
 * 1. KHÔNG CÓ SỐ THỰC NÀO TRONG ĐƯỜNG DỮ LIỆU. Đơn vị duy nhất là Ô của lưới
 *    32×32 (nguyên, 0..31). Không cột DB / trường JSON / tham số API nào nhận px.
 *    Cỡ hiển thị hợp lệ = 32·k. Nên "lệch nửa ô" không phải thứ phải cẩn thận —
 *    nó không viết ra được.
 *
 * 2. TOẠ ĐỘ LÀ Ô, KHÔNG PHẢI TỶ LỆ. `x`,`y` là chỉ số ô của góc TRÊN-TRÁI lưới
 *    nhãn dán, base36 một ký tự ('0'..'v' = 0..31). Nên "dán ở 41,3% chiều rộng"
 *    không tồn tại, và hai máy khác nhau không bao giờ dựng ra hai hình khác nhau
 *    từ cùng một chuỗi.
 *
 * 3. THỨ TỰ CHỒNG LỚP = THỨ TỰ DÁN, và thứ tự dán là APPEND-ONLY ở tầng DB
 *    (`avatar_dan`, xem `migrations/0013_avatar.sql`). Dán sau đè lên dán trước;
 *    không có trường z để ai đó "sắp xếp lại" — sắp xếp lại được thì "vĩnh viễn"
 *    chỉ còn là một lời hứa.
 *
 * ⚠ CHỖ CẮM KIỂM DUYỆT, ĐỪNG BỊT (D36 khai rủi ro: dán tự do thì soạn được hình
 * khiêu khích, mà app hiện mặt cho NGƯỜI LẠ). Founder chấp nhận đánh đổi và KHÔNG
 * muốn blocklist bây giờ. Ba chỗ cắm đã chừa sẵn, đừng gỡ khi dọn code:
 *   · `avatar_so_huu.an` — ẩn một tác phẩm mà KHÔNG xoá dòng sở hữu (xoá = mất
 *     lịch sử; hoàn = mint, phạm A3.4).
 *   · `avatar_dan` ghi ĐỦ ai · dán gì · ở đâu · lúc nào → truy được sau.
 *   · `chuoiTranTrui()` — dựng lại chuỗi CHỈ CÒN NỀN, dùng khi tác phẩm bị ẩn.
 */

/** Cạnh lưới. Mọi thứ trong tầng diện mạo đều là 32×32 ô. */
export const O_LUOI = 32;

/**
 * Cỡ hiển thị HỢP LỆ — bội số nguyên của 32, không có cỡ nào khác.
 *
 * ⚠ 26px KHÔNG TỒN TẠI dù có khai. Luật render pixel của repo là
 * `px = round(size / cells)`; với 32 hàng thì `round(26/32) = 1` → ra đúng 32px.
 * Nên "giữ 26px" không phải một lựa chọn, nó là 32px mà không biết.
 */
export const CO_AVATAR = [32, 64, 96, 128] as const;
export type CoAvatar = (typeof CO_AVATAR)[number];

/**
 * Vùng hình học còn lại sau khi gỡ khe neo.
 *
 * Chỉ còn MỘT hằng số, và nó không phải quy ước cho gọn: vành 2 ô là chỗ KHUNG
 * VIỀN đứng. Ba lá nền để vành đó chỉ chứa ký tự nền, nên khung thay thế vành chứ
 * không cộng vào nó — ô gạch không bao giờ to ra, dải 8 ghế không nhảy theo việc
 * đối thủ mua gì (đúng lớp lỗi bố cục D27 vừa phải chữa).
 *
 * ⚠ NHÃN DÁN KHÔNG BỊ CHẶN Ở VÀNH NÀY. D36 chốt dán tự do TOÀN KHUNG; dán đè lên
 * vành là quyền của người chơi, và khung (nếu có) vẽ SAU CÙNG nên vẫn thắng.
 */
export const VANH_KHUNG = 2;

// ─────────────────────────── AVATAR NỀN ────────────────────────────────────

export type NguonMon =
  | 'tang_khoi_dau' | 'niem_yet_q' | 'gacha_t' | 'merit' | 'bp' | 'quest';

export interface AvatarNen {
  readonly ma: string;
  readonly id: string;
  readonly ten: string;
  readonly mo_ta: string;
  readonly nguon: NguonMon;
  /** Bậc hiếm — CHỈ lá ra từ gacha mới có. Vắng = không nằm trong hộp. */
  readonly hiem?: 'thuong' | 'hiem' | 'epic';
  /** Mỗi người ĐÚNG MỘT bản (founder 04/08). Vắng = quay bao nhiêu lần cũng được. */
  readonly doc_ban?: boolean;
  /** Chỉ món `niem_yet_q` mới có giá. Giá lấy NGUYÊN từ D16 (A8.2). */
  readonly gia_q: number | null;
  /** Nhãn bản phát hành, hiện cho người chơi. `null` = bản thường. */
  readonly phien_ban: string | null;
}

/**
 * BA LÁ TẶNG + MỘT LÁ PHẢI CÀY.
 *
 * ⚠ D41 SỬA D36 (founder 27/07 tối). Giữ nguyên văn cả hai để truy vết:
 *   D36 (sáng): hai lá tặng (ĐỘI MŨ · BÚI TÓC) + ÁO TRÙM ĐẦU **bán shop 600 Q**.
 *   D41 (tối):  BA lá tặng (thêm **ẨN DANH**) + ÁO TRÙM ĐẦU **thưởng lộ trình mùa**.
 *
 * `NEN_TANG` lọc theo `nguon === 'tang_khoi_dau'` nên nó TỰ ĐỘNG thành ba lá — đừng
 * gõ cứng con số 2 hay 3 ở bất kỳ đâu, và đừng viết test `toBe(2)` cho nó.
 *
 * Vì sao vẫn đặt tên theo ĐỒ ĐỘI chứ không theo NGƯỜI: "Đội mũ" là thứ bạn đội,
 * "Người săn sóng" là thứ bạn *là*. Cái thứ hai là một lời tuyên bố về bản thân mà
 * app PHÁT KHÔNG — trong khi cả hệ danh dự dựng trên nguyên tắc ngược (Họ 2 chỉ
 * merit, không xu nào chạm được). Một nhãn tính cách phát miễn phí lúc đăng ký là
 * HỌ 2 GIẢ. Nặng hơn: nhãn chiến lược trên mặt người chơi sẽ bị đối thủ đọc TRƯỚC
 * KHI mình đi nước nào — bơm nhiễu tự khai vào đúng cột khẩu vị rủi ro mà D25 dựng
 * cả một bộ luật để khử nhiễu.
 *
 * ⚠ GIÁ 600 Q CỦA LÁ C LÀ GIÁ **SKIN** ĐÃ DUYỆT Ở D16, KHÔNG PHẢI SỐ MỚI (A8.2).
 * Avatar nền đúng là một skin theo phân loại D16 (Họ 1 Diện mạo, quầy Phong cách,
 * niêm yết Q). Cái CHƯA CÓ GIÁ là **bản sao thứ hai trở đi của một avatar nền** —
 * D36 biến avatar nền thành VẬT TIÊU HAO, mà D16 định giá cho món mua-một-lần.
 * Số đó nằm ở `GIA_BAN_SAO_THEM = null` bên dưới và phải do founder chốt.
 */
export const AVATAR_NEN: readonly AvatarNen[] = [
  {
    ma: 'A', id: 'av_doi_mu', ten: 'ĐỘI MŨ',
    mo_ta: 'Người xem bảng giá giữa đường',
    nguon: 'tang_khoi_dau', gia_q: null, phien_ban: null,
  },
  {
    ma: 'B', id: 'av_bui_toc', ten: 'BÚI TÓC',
    mo_ta: 'Người xem bảng giá ở bàn làm việc',
    nguon: 'tang_khoi_dau', gia_q: null, phien_ban: null,
  },
  {
    /*
     * ⚠ D41 ĐỔI NGUỒN: D36 để lá này BÁN Ở SHOP 600 Q. Founder 27/07 tối chuyển nó
     * thành PHẦN THƯỞNG LỘ TRÌNH MÙA — *"miễn phí nhưng phải cày"*.
     *
     * Vì sao đổi có lý về KINH TẾ chứ không chỉ thẩm mỹ: 600 Q là giá **skin** của
     * D16, dành cho món MUA MỘT LẦN. Nhưng D36 lại biến avatar nền thành VẬT TIÊU
     * HAO (mỗi tác phẩm sticker mới cần một nền mới), nên định giá nó bằng giá
     * mua-một-lần là định giá một thứ chưa biết sẽ dùng bao nhiêu lần — mà
     * `GIA_BAN_SAO_THEM` thì đang còn `null`.
     * Chuyển sang lộ trình thì nó RỜI KHỎI cán cân Q hoàn toàn: không phát Q, không
     * thu Q, nên không đụng tỷ lệ sink/phát 0,82 mà D16 đang canh.
     *
     * `phien_ban` GIỮ 'Beta Access' — nó vẫn là lá của mùa 0.0, chỉ đổi cách lấy.
     */
    ma: 'C', id: 'av_ao_trum_dau', ten: 'ÁO TRÙM ĐẦU',
    mo_ta: 'Người xem bảng giá lúc nửa đêm',
    nguon: 'bp', gia_q: null, phien_ban: 'Beta Access',
  },
  {
    /*
     * D41 — LÁ ẨN DANH. Founder: *"avatar ẩn danh như trên facebook nhưng là pixel"*.
     *
     * ⚠ ĐÂY LÀ QUYỀN, KHÔNG PHẢI MỘT LỰA CHỌN THẨM MỸ. App hiện mặt cho NGƯỜI LẠ
     * (D25), mà trước D41 ai không thích hai lá kia thì vẫn BUỘC phải đeo một trong
     * hai. Lá này là quyền KHÔNG LỘ DIỆN — nên nó phải `tang_khoi_dau`: biến "được
     * giấu mặt" thành thứ phải trả tiền là bán một thứ đáng ra không được bán.
     *
     * ⚠⚠ NHƯNG NÓ KHÔNG ĐƯỢC LÀ MẶC ĐỊNH KHI CHƯA CHỌN. `avatar_chon` bắt buộc ở màn
     * onboard tồn tại để ĐO GU (A1) — một mặc định vô danh sẽ nuốt phép đo đó, vì
     * mọi người lười sẽ rơi vào cùng một ô và cột dữ liệu thành hằng số.
     * `web/tests/auth.test.tsx` ("chưa chọn ảnh đại diện → nút nhận vốn còn khoá")
     * là thứ canh điều này — nó phải luôn xanh.
     */
    ma: 'D', id: 'av_an_danh', ten: 'ẨN DANH',
    mo_ta: 'Người không muốn ai nhớ mặt mình',
    nguon: 'tang_khoi_dau', gia_q: null, phien_ban: null,
  },
  /*
   * HAI LÁ TRADER (founder 04/08) — MỘT CÂU CHUYỆN, HAI NỬA.
   *
   * `hiem` khai ngay tại đây vì hai lá này ra từ GACHA, mà bậc hiếm là thứ
   * quyết định chúng rơi vào cửa nào của bảng 70/25/5. Chúng thay đúng chỗ
   * `st_niem_beta` để lại (1 `hiem` + 1 `epic`) ⇒ bảng tỷ lệ không phải đụng.
   *
   * ⚠ MỖI NGƯỜI ĐÚNG MỘT CÁI (`doc_ban`), khác hẳn sticker vốn quay bao nhiêu
   * lần cũng được. Hệ quả PHẢI xử ở tầng server: `ungVien()` hiện lọc theo TỒN
   * KHO TOÀN HỆ, nên với người đã đủ bộ thì cửa hiếm/epic rỗng RIÊNG cho họ
   * trong khi màn vẫn dán 70/25/5 — `haBac()` sẽ lặng lẽ hạ xuống đồ thường và
   * KHÔNG NỔ. Founder chốt: trùng ⇒ HOÀN T (D68a).
   */
  {
    ma: 'E', id: 'av_trader_1', ten: 'TRADER #1',
    mo_ta: 'Nửa trên của câu chuyện',
    nguon: 'gacha_t', gia_q: null, phien_ban: null,
    hiem: 'hiem', doc_ban: true,
  },
  {
    ma: 'F', id: 'av_trader_2', ten: 'TRADER #2',
    mo_ta: 'Nửa còn lại của câu chuyện',
    nguon: 'gacha_t', gia_q: null, phien_ban: null,
    hiem: 'epic', doc_ban: true,
  },
];

export type MaGoc = string;

/** Hai lá TẶNG lúc bắt đầu — đây là danh sách màn onboard được phép hiện. */
export const NEN_TANG: readonly AvatarNen[] =
  AVATAR_NEN.filter((n) => n.nguon === 'tang_khoi_dau');

export const MA_NEN: readonly string[] = AVATAR_NEN.map((n) => n.ma);

export function nenTheoMa(ma: string): AvatarNen | null {
  return AVATAR_NEN.find((n) => n.ma === ma) ?? null;
}

export function nenTheoId(id: string): AvatarNen | null {
  return AVATAR_NEN.find((n) => n.id === id) ?? null;
}

/**
 * GIÁ BẢN SAO THÊM — **CỐ Ý `null`, CHỜ FOUNDER (A8.2)**.
 *
 * D36 biến avatar nền thành vật tiêu hao: mỗi tác phẩm mới cần một avatar nền mới.
 * Đó là một sink Q LẶP LẠI, mà D16 chỉ định giá cho món mua-một-lần — nên đây là
 * một THAM SỐ KINH TẾ MỚI, agent không được tự đặt.
 *
 * Số để founder cân (tính từ chính sim D16, 1.000 user × 90 ngày):
 *   Q phát/mùa = 3,20M · Q tiêu/mùa = 2,62M · tỷ lệ 0,82 (dải lành mạnh 0,55–0,85,
 *   guardrail đỏ ở 0,90).
 *   Dư địa sink tới mốc 0,90 = 0,90×3,20M − 2,62M = **260.000 Q/1.000 user/mùa**.
 *     · giá 600 Q → 433 lượt mua thêm/1.000 user/mùa mới chạm mốc
 *     · giá 250 Q → 1.040 lượt
 *   Nghĩa là ở giá 600 Q, chưa tới một nửa dân số mua nổi MỘT tác phẩm thứ hai mỗi
 *   mùa trước khi guardrail đỏ. Muốn "ai cũng làm được vài tác phẩm" thì giá phải
 *   thấp hơn, hoặc phải mở thêm faucet Q — hai việc khác nhau, founder chọn.
 *
 * Chừng nào còn `null` thì đường mua bản sao KHÔNG TỒN TẠI ở tầng API (server trả
 * 409 `chua_dinh_gia`), chứ không phải chạy với một con số tạm.
 */
/*
 * ── D42 (founder 27/07 tối) — BÁN BẢN SAO CỦA CẢ BA LÁ TẶNG ────────────────
 *
 * Câu hỏi đặt ra: "bán bản sao của một lá TẶNG có phải là bán lại thứ đã cho không?"
 * Founder trả lời, và câu trả lời sửa một lỗi hiểu bản chất của chính agent:
 *   *"Cả 3 lá tặng nhưng chỉ 1 cái. Bạn quên sau khi custom với phụ kiện/sticker
 *    nghĩa là mỗi cái avatar đều độc bản à? Vẫn bán được tốt."*
 *
 * ⚠ THỨ ĐEM BÁN LÀ TẤM NỀN TRẮNG, KHÔNG PHẢI MẪU THIẾT KẾ. Mẫu vẫn cho không và
 * cho vĩnh viễn. Sau khi dán sticker (DÁN LÀ TIÊU VĨNH VIỄN — D36), mỗi tấm thành
 * MỘT TÁC PHẨM ĐỘC BẢN, nên tấm thứ hai của cùng một mẫu không phải bản sao của
 * thứ gì cả — nó là một khung tranh trắng khác. Người ta trả tiền cho KHUNG, không
 * trả cho BỨC TRANH.
 * ⇒ Lo ngại "bán lại thứ đã cho" là SAI, và nó sai vì lẫn giữa MẪU và VẬT.
 *
 * Quà khởi đầu = ĐÚNG MỘT tấm mỗi lá tặng (`capBoKhoiDau` lặp `NEN_TANG`, seri 1).
 * Từ tấm thứ hai trở đi thì mua — với BẤT KỲ lá nào đang sở hữu.
 *
 * ⚠ GIÁ VẪN CHƯA CHỐT (A8.2) — founder mới quyết PHẠM VI, chưa quyết SỐ.
 * Số để cân, tính từ những gì đã xây: lộ trình mùa 0.0 phát trần **1.200 Q/user/mùa**.
 *     P = 600 ⇒ 2 tấm/mùa · P = 300 ⇒ 4 · P = 200 ⇒ 6 · P = 150 ⇒ 8
 * ⭐ Khuyến nghị **200–300**. Lý do không nằm ở cán cân Q mà ở chỗ AI NÊN LÀ NÚT
 * THẮT: sticker phải mua/quay bằng T (D36), nên sticker mới là thứ khan hiếm và là
 * thứ đáng khoe. Nếu KHUNG đắt hơn MỰC thì người ta ngừng sáng tác vì hết khung —
 * giết đúng "tính lan toả" mà D36 nói là lý do chọn phương án dán tự do.
 *
 * Chừng nào còn `null` thì đường mua bản sao KHÔNG TỒN TẠI ở tầng API (409
 * `chua_dinh_gia`), chứ không phải chạy với một số tạm.
 */
export const GIA_BAN_SAO_THEM: number | null = null;

// ─────────────────────────── NHÃN DÁN & KHUNG ──────────────────────────────

export type Hiem = 'thuong' | 'hiem' | 'epic';

export interface MonDienMao {
  readonly id: string;
  readonly ten: string;
  readonly hiem: Hiem;
  readonly nguon: NguonMon;
  /** Chỉ món `niem_yet_q` mới có giá; giá lấy nguyên từ D16, KHÔNG đặt số mới. */
  readonly gia_q: number | null;
  /**
   * Tổng số bản được phát hành, `null` = không giới hạn.
   *
   * D36: "sticker độc quyền — SỐ LƯỢNG CỰC ÍT, cực hiếm". Con số cụ thể là tham số
   * kinh tế nên để `null` ở đây và nêu thành đề xuất; cột `gioi_han` trong DB đã
   * có sẵn nên chốt số là một dòng UPDATE, không phải một migration.
   */
  readonly gioi_han: number | null;
  /** Đặc điểm THẬT ngoài đời (D28) — không kể tác dụng trong game. */
  readonly ghi_chu: string;
}

/**
 * KHUNG VIỀN — vành 2 ô, THAY THẾ vành mặc định chứ không cộng vào nó.
 *
 * Khung KHÔNG bị tiêu hao: nó là ĐỒ ĐEO, tháo ra lắp vào tuỳ ý, khác hẳn nhãn dán.
 * Ranh giới đó không phải cho tiện — nó là chỗ người chơi còn ĐƯỜNG LÙI. Nếu cả
 * khung lẫn nhãn dán đều một-đi-không-trở-lại thì mỗi lần chạm vào diện mạo là một
 * lần sợ, và người ta sẽ không chạm.
 *
 * ⚠ CẤM ngôn ngữ hình của Hệ A trong khung Họ 1: không sinh vật biển, không cặp
 * VÀNG-TRÊN-BẠC (mép sáng đổi từ bạc sang vàng là luật apex của bậc 6–7). Một khung
 * MUA BẰNG Q trông như vành apex là Họ 2 giả — tiền vừa mua được cái mà D16 tuyên
 * bố "không một xu T/Q nào chạm được".
 */
export const KHUNG: readonly MonDienMao[] = [
  {
    id: 'kh_manh_cyan', ten: 'Khung mảnh cyan', hiem: 'thuong',
    nguon: 'niem_yet_q', gia_q: 250, gioi_han: null,
    ghi_chu: 'Nét mảnh một hàng — kiểu viền của bảng điện tử sân bay.',
  },
  {
    id: 'kh_kep_violet', ten: 'Khung kép violet', hiem: 'thuong',
    nguon: 'niem_yet_q', gia_q: 250, gioi_han: null,
    ghi_chu: 'Hai đường song song — lối đóng khung của giấy tờ có giá.',
  },
  {
    id: 'kh_moc_neo', ten: 'Khung móc neo', hiem: 'thuong',
    nguon: 'niem_yet_q', gia_q: 250, gioi_han: null,
    ghi_chu: 'Móc neo giữ tàu bằng SỨC NẶNG của dây, không phải bằng mũi neo cắm đáy.',
  },
];

/**
 * NHÃN DÁN — hai cửa: CỬA GACHA T (không món nào bán bằng Q) và MERIT (sáu sticker vinh danh hạng ở cuối mảng —
 * chỉ có từ việc lên bậc Đấu trường, không giá, không hộp; xem chú thích ngay trên mục đầu của chúng).
 *
 * Hai lý do, và lý do thứ hai là lý do cứng:
 *
 *   · D36: "sticker phải MUA hoặc QUAY, như CS:GO. Không phát miễn phí."
 *   · **MỖI MÓN ĐÚNG MỘT CỬA.** D16 cấm tiêu Q vào thứ ngẫu nhiên nhưng không cấm
 *     MỘT MÓN đứng ở cả hai cửa — đó là một lỗ: nếu nhãn X vừa bán 100 Q vừa rơi ra
 *     từ hộp 100 T thì quay hộp T mà trúng X = tiết kiệm 100 Q, tức một lượt tiêu T
 *     vừa trả ra GIÁ TRỊ TÍNH BẰNG Q — mà Q chạm voucher thật. Hộp T vừa thành hộp
 *     có giá trị thật, đúng cửa chết pháp lý mà luật ngẫu nhiên D16 dựng để tránh.
 *
 * ⚠ VÌ SAO KHÔNG CÓ NHÃN DÁN NÀO NIÊM YẾT Q Ở LÁT NÀY: D16 chỉ duyệt ba giá cho Họ
 * 1 (gacha 100 T · skin 600 Q · khung 250 Q). "Nhãn dán 100 Q" là một con số CHƯA
 * AI DUYỆT — bản trước của file này tự đặt nó và ghi chú là "lấy từ D16", điều đó
 * không đúng. Cần quầy Q cho nhãn dán thì founder chốt giá trước (A8.2).
 */
export const NHAN_DAN: readonly MonDienMao[] = [
  {
    id: 'st_kinh_ram', ten: 'Kính râm', hiem: 'hiem',
    nguon: 'gacha_t', gia_q: null, gioi_han: null,
    ghi_chu: 'Tròng sẫm cắt bớt ánh sáng chứ không lọc tia UV — chống UV là lớp phủ riêng.',
  },
  {
    id: 'st_ria_mep', ten: 'Ria mép', hiem: 'thuong',
    nguon: 'gacha_t', gia_q: null, gioi_han: null,
    ghi_chu: 'Râu mọc nhanh nhất ở tuổi 20–30 rồi chậm dần, không nhanh mãi.',
  },
  {
    id: 'st_khau_trang', ten: 'Khẩu trang', hiem: 'thuong',
    nguon: 'gacha_t', gia_q: null, gioi_han: null,
    ghi_chu: 'Lọc được hạt nhỏ nhờ tĩnh điện của lớp giữa; giặt một lần là mất lớp đó.',
  },
  {
    id: 'st_mui_ten_len', ten: 'Mũi tên tăng', hiem: 'thuong',
    nguon: 'gacha_t', gia_q: null, gioi_han: null,
    ghi_chu: 'Bảng giá châu Á tô ĐỎ cho tăng, xanh cho giảm — ngược hẳn phương Tây.',
  },
  {
    id: 'st_xu_vang', ten: 'Đồng xu', hiem: 'thuong',
    nguon: 'gacha_t', gia_q: null, gioi_han: null,
    ghi_chu: 'Cạnh xu khía răng cưa để lộ ra ngay khi có ai mài trộm bớt kim loại quý.',
  },
  {
    id: 'st_canh_bao', ten: 'Biển cảnh báo', hiem: 'hiem',
    nguon: 'gacha_t', gia_q: null, gioi_han: null,
    ghi_chu: 'Tam giác vàng viền đỏ là chuẩn biển báo nguy hiểm của Công ước Vienna 1968.',
  },
  {
    /*
     * MÓN ĐỘC QUYỀN (D36: "số lượng CỰC ÍT, cực hiếm").
     *
     * `gioi_han` để `null` vì con số là tham số kinh tế — xem đề xuất trong báo cáo.
     * Cột `gioi_han` đã có trong DB nên chốt số là một dòng UPDATE, và server đã
     * kiểm tồn kho theo cột đó (`capMon`), nên bật giới hạn KHÔNG cần code mới.
     */
    id: 'st_niem_beta', ten: 'Dấu niêm Beta', hiem: 'epic',
    nguon: 'gacha_t', gia_q: null, gioi_han: null,
    ghi_chu: 'Dấu niêm sáp thời trung cổ vỡ khi mở — bằng chứng thư CHƯA từng bị đọc.',
  },
  /*
   * STICKER VINH DANH HẠNG (SPEC huy-hieu-hang-sticker, founder 11/10) — SÁU MÓN MERIT, nguồn `merit`.
   *
   * ⚠ KHÔNG ở cửa Q, KHÔNG ở cửa gacha: `HOP_GACHA` lọc `nguon === 'gacha_t'` nên chúng không bao giờ vào
   * hộp; không `gia_q` nên không lên quầy. Cửa DUY NHẤT là leo bậc Đấu trường (`server/huy_hieu.ts`,
   * khớp 1-1 với `BAC_THANG[].sticker` ở config/rank.ts). Tiền không mua được dáng vẻ merit
   * (design_sticker_shop Q7/Q8) — cùng tinh thần cấm cặp vàng-trên-bạc ở khung Họ 1.
   *
   * ⚠ GHI THÊM Ở CUỐI MẢNG, KHÔNG CHÈN GIỮA: chỉ số trong NHAN_DAN là mã 2 ký tự trong chuỗi diện mạo
   * (`vietDienMao`). Chèn giữa là đổi nghĩa mọi avatar đã dán.
   * `hiem` chỉ để UI xếp màu viền: Đồng/Bạc thường · Vàng/Bạch Kim hiếm · Kim Cương/Elite epic.
   * Ghi chú = đặc điểm NGOÀI ĐỜI (D28), không kể tác dụng trong game.
   */
  {
    id: 'st_hh_tom', ten: 'Tôm · hạng Đồng', hiem: 'thuong',
    nguon: 'merit', gia_q: null, gioi_han: null,
    ghi_chu: 'Tôm thoát hiểm bằng cú búng đuôi, bật lùi nhanh hơn nhiều so với lúc bơi tới.',
  },
  {
    id: 'st_hh_cua', ten: 'Cua · hạng Bạc', hiem: 'thuong',
    nguon: 'merit', gia_q: null, gioi_han: null,
    ghi_chu: 'Cua đi ngang vì khớp chân gập sang hai bên thân, không gập về trước được.',
  },
  {
    id: 'st_hh_ca_ngua', ten: 'Cá Ngựa · hạng Vàng', hiem: 'hiem',
    nguon: 'merit', gia_q: null, gioi_han: null,
    ghi_chu: 'Ở cá ngựa, con đực mang thai: con cái gửi trứng vào túi ấp trên bụng con đực.',
  },
  {
    id: 'st_hh_ca_duoi', ten: 'Cá Đuối · hạng Bạch Kim', hiem: 'hiem',
    nguon: 'merit', gia_q: null, gioi_han: null,
    ghi_chu: 'Cá đuối bơi bằng cách vỗ hai vây ngực rộng như đôi cánh.',
  },
  {
    id: 'st_hh_ca_map', ten: 'Cá Mập · hạng Kim Cương', hiem: 'epic',
    nguon: 'merit', gia_q: null, gioi_han: null,
    ghi_chu: 'Cá mập thay răng liên tục suốt đời: răng cũ rụng, hàng răng sau tiến lên thế chỗ.',
  },
  {
    id: 'st_hh_ca_voi', ten: 'Cá Voi · hạng Elite', hiem: 'epic',
    nguon: 'merit', gia_q: null, gioi_han: null,
    ghi_chu: 'Cá voi là động vật có vú: thở bằng phổi, phải nổi lên mặt nước để lấy hơi và nuôi con bằng sữa.',
  },
];

export const CATALOG_DIEN_MAO: readonly MonDienMao[] = [...KHUNG, ...NHAN_DAN];

export function khungTheoId(id: string): MonDienMao | null {
  return KHUNG.find((k) => k.id === id) ?? null;
}

export function nhanDanTheoId(id: string): MonDienMao | null {
  return NHAN_DAN.find((n) => n.id === id) ?? null;
}

// ───────────────────────── CHUỖI DIỆN MẠO (v2) ─────────────────────────────

/*
 * DẠNG:  vị trí 0    = phiên bản '2'
 *        vị trí 1    = mã nền A|B|C
 *        vị trí 2    = bảng màu (base36; '0' = bảng gốc — chưa dùng, xem art)
 *        vị trí 3–4  = khung ('--' = không khung) hoặc 2 ký tự base36
 *        sau đó      = N NHÓM 5 KÝ TỰ, theo ĐÚNG THỨ TỰ DÁN:
 *                      [ID nhãn dán base36 ×2][x base36][y base36][lật '0'|'1']
 *
 * ⚠ PHIÊN BẢN NHẢY 1 → 2 LÀ BẮT BUỘC, không phải cho đẹp. Chuỗi v1 dài đúng 19 ký
 * tự và 14 ký tự cuối là 7 khe neo; đọc nó bằng luật v2 sẽ ra 2–3 nhãn dán ở toạ độ
 * rác. Ký tự đầu khác nhau nên `docDienMao` nhận ra ngay và rơi về mặc định thay vì
 * vẽ bậy. (Không có dữ liệu v1 trên prod: migration 0013 chưa từng chạy ở đó.)
 *
 * Vì sao CHUỖI chứ không phải object lồng: payload ghế bị poll theo bậc thang
 * 30s/10s/5s (D11, ngân sách 1M request/tháng). Một avatar trần tốn 5 byte, mỗi
 * nhãn dán thêm 5 byte — bàn 8 ghế với 3 nhãn/người là 160 byte. Object lồng cùng
 * thông tin tốn ~1,5 KB. Và chuỗi lọt trong ngân sách ~300 byte/event của A7 ngay
 * cả khi một ngày nào đó phải log, object lồng thì không.
 */

export const DIEN_MAO_PHIEN_BAN = '2';
/** Nền A, bảng màu gốc, không khung, chưa dán gì. */
export const DIEN_MAO_MAC_DINH = '2A0--';
/** Độ dài phần đầu (phiên bản + nền + bảng màu + khung). */
export const DIEN_MAO_DAU_DAI = 5;
/** Độ dài một nhóm nhãn dán. */
export const NHOM_DAN_DAI = 5;

/**
 * TRẦN SỐ NHÃN DÁN TRONG **MỘT CHUỖI** — 64.
 *
 * ⚠ ĐÂY LÀ TRẦN VẬT LÝ CỦA PAYLOAD, KHÔNG PHẢI LUẬT CHƠI. D36 chốt "không giới hạn
 * số lượng" và con số này không mâu thuẫn với điều đó theo bất kỳ nghĩa thực dụng
 * nào: canvas chỉ có 1.024 ô, nhãn dán nhỏ nhất trong catalog đã 5×5 = 25 ô, nên 64
 * nhãn phủ 1.600 ô — gấp rưỡi cả tấm hình. Ai chạm trần này thì tác phẩm của họ đã
 * là một mảng bùn đặc từ lâu.
 *
 * Cái nó thật sự chặn là payload: 64 × 5 = 320 byte/ghế, 8 ghế = 2,6 KB cho ca xấu
 * nhất tuyệt đối. Không có trần thì một dòng DB bẩn đủ sức thổi payload trận lên
 * megabyte, và đó là thứ D11 không gánh nổi.
 */
export const DAN_TOI_DA = 64;

/**
 * Regex NÀY PHẢI KHỚP TỪNG KÝ TỰ với CHECK trong `migrations/0013_avatar.sql`.
 * Hai bản là cố ý: DB không tin tầng app (một endpoint mới quên validate là dữ liệu
 * bẩn vĩnh viễn), app không đợi DB (báo lỗi cho người chơi thì phải biết trước khi
 * gửi). Test `avatar.test.ts` đọc cả hai file và so.
 *
 * `[0-9a-v]` cho toạ độ: base36 tới 'v' là 31 — ô cuối cùng của lưới. Ký tự 'w'..'z'
 * là toạ độ 32..35, tức NGOÀI lưới, nên chúng bị chặn ở tầng dạng chứ không phải bị
 * "clip lúc vẽ" — clip lúc vẽ thì dữ liệu bẩn vẫn nằm trong DB mãi mãi.
 */
/*
 * ⚠ DẢI MÃ NỀN LÀ `[A-Z]`, KHÔNG PHẢI ĐÚNG SỐ LÁ ĐANG CÓ. Bản đầu ghim `[A-C]` và
 * D41 (thêm lá `D` — ẨN DANH) đã cắn đúng chỗ đó: regex từ chối chuỗi hợp lệ, rồi
 * `docDienMao` lặng lẽ rơi về `DIEN_MAO_MAC_DINH` — nên lá mới render ra **hình của
 * lá A** thay vì báo lỗi. Đó là lỗi tệ nhất: không nổ, chỉ hiện sai.
 *
 * Regex này là LƯỚI CHẶN RÁC (đúng hình dạng chuỗi), không phải danh sách lá hợp lệ.
 * Câu "mã này có lá thật không" do `nenTheoMa()` trả lời, đọc thẳng `AVATAR_NEN` —
 * một nguồn chân lý duy nhất, và `docDienMao` đã kiểm tiếp bằng `MA_NEN.includes`.
 * Migration `0021_avatar_ma_nen.sql` nới hai CHECK tương ứng ở tầng DB, cùng lý do.
 */
export const DIEN_MAO_REGEX =
  /^2[A-Z][0-9a-z]([0-9a-z]{2}|--)([0-9a-z]{2}[0-9a-v]{2}[01]){0,64}$/;

const BASE36 = '0123456789abcdefghijklmnopqrstuvwxyz';

function maSo(n: number): string {
  return BASE36[n] ?? '0';
}

/** Số → 2 ký tự base36 (0..1295). Dùng cho ID món trong chuỗi. */
function maSo2(n: number): string {
  return `${maSo(Math.floor(n / 36))}${maSo(n % 36)}`;
}

function doSo2(s: string): number {
  const a = BASE36.indexOf(s[0] ?? '');
  const b = BASE36.indexOf(s[1] ?? '');
  return a < 0 || b < 0 ? -1 : a * 36 + b;
}

export interface DanTrenAvatar {
  readonly mon: MonDienMao;
  /** Ô trên-trái của lưới nhãn dán, 0..31. */
  readonly x: number;
  readonly y: number;
  readonly lat: boolean;
}

export interface DienMao {
  readonly goc: string;
  readonly bang_mau: string;
  readonly khung: MonDienMao | null;
  /** Theo ĐÚNG thứ tự dán — dán sau đè lên dán trước. */
  readonly dan: readonly DanTrenAvatar[];
}

/**
 * Đọc chuỗi → diện mạo. KHÔNG BAO GIỜ NÉM.
 *
 * Chuỗi hỏng / món đã rút khỏi catalog → bỏ đúng phần hỏng, giữ phần còn đọc được.
 * Một ô vuông trắng giữa bàn đấu tệ hơn một cái mặt thiếu một nhãn dán, và 500 giữa
 * trận thì tệ hơn cả hai.
 */
export function docDienMao(chuoi: string | null | undefined): DienMao {
  const s = chuoi && DIEN_MAO_REGEX.test(chuoi) ? chuoi : DIEN_MAO_MAC_DINH;
  const goc = MA_NEN.includes(s[1] ?? '') ? s[1]! : 'A';
  const maKhung = s.slice(3, 5);
  const khung = maKhung === '--' ? null : (KHUNG[doSo2(maKhung) - 1] ?? null);

  const dan: DanTrenAvatar[] = [];
  for (let i = DIEN_MAO_DAU_DAI; i + NHOM_DAN_DAI <= s.length; i += NHOM_DAN_DAI) {
    const mon = NHAN_DAN[doSo2(s.slice(i, i + 2)) - 1];
    if (!mon) continue;   // món đã rút khỏi catalog → bỏ đúng nhãn đó, giữ phần còn lại
    dan.push({
      mon,
      x: BASE36.indexOf(s[i + 2]!),
      y: BASE36.indexOf(s[i + 3]!),
      lat: s[i + 4] === '1',
    });
  }

  return { goc, bang_mau: s[2]!, khung, dan };
}

/** Diện mạo → chuỗi. Nghịch đảo của `docDienMao` với mọi giá trị hợp lệ. */
export function vietDienMao(dm: {
  goc: string;
  bang_mau?: string;
  khung?: string | null;
  dan?: readonly { mon: string; x: number; y: number; lat?: boolean }[];
}): string {
  const iKhung = KHUNG.findIndex((k) => k.id === dm.khung);
  const khung = iKhung < 0 ? '--' : maSo2(iKhung + 1);
  const dan = (dm.dan ?? []).slice(0, DAN_TOI_DA).map((d) => {
    const i = NHAN_DAN.findIndex((m) => m.id === d.mon);
    if (i < 0) return '';
    // Kẹp toạ độ về lưới ở ĐÂY, không ở chỗ vẽ: chuỗi là thứ đi vào DB và đi ra
    // payload, nên nó phải hợp lệ TRƯỚC khi rời hàm này.
    const x = Math.min(Math.max(Math.round(d.x), 0), O_LUOI - 1);
    const y = Math.min(Math.max(Math.round(d.y), 0), O_LUOI - 1);
    return `${maSo2(i + 1)}${maSo(x)}${maSo(y)}${d.lat ? '1' : '0'}`;
  }).join('');
  const goc = MA_NEN.includes(dm.goc) ? dm.goc : 'A';
  return `${DIEN_MAO_PHIEN_BAN}${goc}${dm.bang_mau ?? '0'}${khung}${dan}`;
}

/**
 * Chuỗi CHỈ CÒN NỀN — dùng khi một tác phẩm bị ẩn vì kiểm duyệt.
 *
 * Vì sao ẩn NHÃN DÁN mà giữ NỀN, thay vì thay bằng một avatar mặc định: người chơi
 * vẫn còn một khuôn mặt để nhận ra, mà thứ gây vấn đề (tổ hợp nhãn dán) thì biến
 * mất. Thay sạch bằng lá mặc định là phạt nặng hơn mức cần, và nó xoá luôn tín hiệu
 * nhận dạng mà D25 dựa vào.
 */
export function chuoiTranTrui(chuoi: string | null | undefined): string {
  const dm = docDienMao(chuoi);
  return vietDienMao({ goc: dm.goc, bang_mau: dm.bang_mau, khung: dm.khung?.id ?? null });
}

/**
 * Món phải KIỂM SỞ HỮU khi trang bị chuỗi này.
 *
 * ⚠ NHÃN DÁN **KHÔNG** NẰM TRONG DANH SÁCH NÀY, và đó là hệ quả trực tiếp của D36:
 * dán là TIÊU. Sau khi dán, nhãn dán không còn là thứ "đang sở hữu" nữa — nó là một
 * nét vẽ trên tác phẩm. Kiểm sở hữu nhãn dán ở đây thì một người dán xong sẽ không
 * đeo nổi chính tác phẩm của mình.
 *
 * Chỗ kiểm nhãn dán là lúc DÁN, đối chiếu `kho_sticker` và trừ đi trong CÙNG một
 * transaction (xem `server/avatar.ts`).
 */
export function monPhaiSoHuu(chuoi: string): string[] {
  const dm = docDienMao(chuoi);
  return dm.khung ? [dm.khung.id] : [];
}

/** Số nhãn dán đã dán trên chuỗi — dùng cho nhãn "tác phẩm" ở bộ sưu tập. */
export function soDan(chuoi: string | null | undefined): number {
  return docDienMao(chuoi).dan.length;
}
