/**
 * PFM — SỔ ĐĂNG KÝ VĂN BẢN CONSENT (05c §2.1 rào 1) — BỐN CỬA RIÊNG (D295, founder 06/09).
 *
 * ⚠⚠ VÌ SAO PHẢI CÓ VẾT VĂN BẢN, chứ không chỉ một cờ `pfm_consent = TRUE`:
 * một cờ boolean chỉ nói *"người này từng đồng ý"*. Nó KHÔNG nói **đồng ý với điều
 * gì**. Khi văn bản đổi — mà nó sẽ đổi — thì mọi cờ cũ trở thành lời khai không kiểm
 * chứng được: không ai dựng lại được người dùng đã đọc bản nào. Với dữ liệu tài chính
 * cá nhân thì đó đúng là thứ phải chứng minh, không phải thứ để tin nhau.
 * ⇒ Ghi ID + PHIÊN BẢN của bản đã hiện, vào `events` append-only, trong CÙNG transaction
 * với cú bật cờ. Cùng transaction là điều kiện bắt buộc: cờ bật mà vết ghi hỏng thì ta
 * có đúng cái tình trạng đang muốn tránh.
 *
 * ⭐ BỐN CỬA, KHÔNG PHẢI MỘT CÔNG TẮC (founder 06/09: *"4 công tắc riêng và 1 công tắc
 * chung cho cả 4 nếu muốn bật tắt nhanh"*). Bản đầu (D250) gộp ba dòng dữ liệu khác hẳn
 * nhau — đặc trưng nghiên cứu · dấu vết thao tác · két sao lưu — dưới MỘT văn bản
 * `pfm_dong_bo`. Đặc tả 05c §2.1 vốn đã đòi *"mỗi cửa một câu ngắn"* và *"cài đặt có bảng
 * granular"*. Nay mỗi cửa là MỘT văn bản, MỘT cột, MỘT vết. "Công tắc chung" chỉ là
 * chuyện của màn hình: nó bấm bốn cửa, mỗi cửa vẫn ghi vết riêng.
 *
 * ⚠ `pfm_dong_bo` v1 ĐÃ NGHỈ nhưng vẫn nằm trong `CONSENT_LICH_SU`: **chưa từng có ai đồng
 * ý bản ấy** (không có màn hình nào bật được nó; bảng `pfm_*` trên prod rỗng — đo 06/09),
 * nên không có vết nào trỏ về nó. Giữ lại trong lịch sử để `laConsentHienHanh` từ chối nó
 * và để ai tra ngược cũng biết nó đã tồn tại. Chữ của nó không cần giữ: chưa ai đọc.
 *
 * ⚠ SERVER CHỈ GIỮ ID + PHIÊN BẢN — câu chữ nằm ở tự điển client (D26/A11.9). Nhét
 * nguyên văn vào đây là dựng bản thứ hai của một thứ đã có chủ, và bản thứ hai sẽ trôi
 * (A11.5/D61). Bảng này chỉ trả lời đúng một câu: *"cặp (id, phiên bản) này có phải là
 * bản ĐANG HIỆU LỰC không?"*
 *
 * ⚠ Đổi câu chữ mà giữ nguyên `phien_ban` là làm hỏng chính cơ chế này: vết cũ và vết
 * mới trỏ về hai nội dung khác nhau dưới cùng một tên. **Sửa một chữ trong văn bản ⇒
 * tăng phiên bản.** Bản cũ KHÔNG xoá khỏi bảng — vết đã ghi phải tra ngược được mãi.
 */

/**
 * BỐN CỬA — mỗi cửa là một dòng dữ liệu RIÊNG rời máy (hoặc một quyền dùng riêng).
 *
 * ⚠ THỨ TỰ LÀ THỨ TỰ HIỆN TRÊN MÀN: từ "rời máy nhiều nhất" xuống "không gửi thêm gì".
 * Người ta đọc từ trên xuống, và thứ nặng nhất phải gặp mắt trước.
 */
export const CUA_PFM = ['ket', 'dac_trung', 'thuong', 'noi_game'] as const;
export type CuaPfm = (typeof CUA_PFM)[number];

/**
 * Cột trong `users` của từng cửa — MỘT NGUỒN cho tên cột. Migration `0061` tạo đúng bốn
 * cột này; SQL phía server ghép tên từ đây, không gõ tay (D61: gõ tay ở hai chỗ là hai
 * chỗ sẽ trôi). Đổi tên cửa ⇒ đổi ở đây ⇒ tsc + test kéo mọi chỗ khác theo.
 */
export const CUA_PFM_COT = {
  ket: 'pfm_cua_ket',
  dac_trung: 'pfm_cua_dac_trung',
  thuong: 'pfm_cua_thuong',
  noi_game: 'pfm_cua_noi_game',
} as const satisfies Record<CuaPfm, string>;

/**
 * Cửa nào canh endpoint nào — để bảng này là chỗ DUY NHẤT trả lời câu "muốn gọi X thì
 * phải bật cửa nào". `noi_game` không canh endpoint nào: nó là QUYỀN DÙNG (ghép nhãn sổ
 * với thẻ tính cách trong nghiên cứu, và sau này sổ đọc thẻ), không phải một đường dữ
 * liệu mới rời máy — xem văn bản của nó ở `pfm_chu.ts`.
 */
export const CUA_CANH_DUONG = {
  ket: ['POST /api/v1/pfm/luu'],
  dac_trung: ['POST /api/v1/pfm/dong-bo'],
  thuong: ['POST /api/v1/pfm/diem-danh', 'POST /api/v1/pfm/tuan'],
  noi_game: [],
} as const satisfies Record<CuaPfm, readonly string[]>;

/** Văn bản của một cửa: `pfm_<cửa>`. Một không gian tên cho cả cửa lẫn văn bản. */
export type VanBanPfmId = `pfm_${CuaPfm}`;
/**
 * Mọi văn bản consent có phiên bản. ⭐ D329 thêm `buoi_do` — văn bản của BÀN BUỔI ĐO.
 * ⚠⚠ `buoi_do` KHÔNG PHẢI MỘT CỬA PFM: không cột `users`, không trong `CUA_PFM`, không mở được cửa nào
 * của sổ (route `/pfm/consent` đòi `van_ban_id === pfm_<cửa>`). Nó ở chung sổ này vì sổ này trả lời
 * đúng một câu cho MỌI văn bản: *"cặp (id, phiên bản) có phải bản đang hiệu lực không"*.
 * Vết của nó ghi ở `events` với `hd_dong_y_buoi_do` (0066), theo (người, bàn).
 */
/**
 * ⭐ `nghien_cuu` (SPEC chan-truoc-beta, 0079) — văn bản của ô ĐỒNG Ý NGHIÊN CỨU (`users.research_consent`): ghi lại cách dùng app
 * (`telemetry`) + cửa xếp hạng. KHÔNG phải cửa PFM (không trong `CUA_PFM`). Trước 0079 ô này là một boolean trần — không ai dựng lại
 * được người dùng đã đọc chữ nào. Nay mỗi lần bật/tắt ghi vết `nghien_cuu_dong_y`/`nghien_cuu_rut` {van_ban_id, phien_ban} và cột
 * `users.research_consent_phien_ban`; bản lưu ≠ bản hiện hành ⇒ server coi như TẮT và hỏi lại (founder 11/10).
 */
export type VanBanConsentId = VanBanPfmId | 'buoi_do' | 'nghien_cuu';
export function vanBanCua(cua: CuaPfm): VanBanPfmId {
  return `pfm_${cua}`;
}

/**
 * Bản ĐANG HIỆU LỰC của từng văn bản. Khoá = `van_ban_id` gửi lên trong body.
 *
 * ⚠ TÊN CÓ `PHIEN_BAN` LÀ CỐ Ý. Giá trị ở đây đi thẳng vào `events.value_json.phien_ban`
 * — tức nó là một TRỤC PHIÊN BẢN nằm trong dữ liệu prod, và phải khai ở
 * `config/phien_ban.ts` (D196). Bộ canh `tests/phien_ban.test.ts` quét theo TÊN, nên đặt
 * tên để nó nhìn thấy là hợp tác với cái canh, không phải chiều nó.
 * ⚠⚠ Bản đầu tôi đặt `CONSENT_HIEN_HANH` — cái THẬT SỰ là trục thì bộ quét không thấy,
 * còn danh sách lịch sử (`…MOI_PHIEN_BAN`) lại bị bắt. Một bộ dò theo TÊN chỉ đúng khi
 * tên nói đúng VAI.
 */
export const CONSENT_PHIEN_BAN = {
  pfm_ket: 'v1',
  pfm_dac_trung: 'v1',
  pfm_thuong: 'v1',
  /*
   * v2 (13/09, founder chọn A): chữ v1 chỉ hứa ghép với THẺ TÍNH CÁCH, còn dây D324 ghép năm mã `gm_*`
   * theo kỳ và Gương hiện ba dấu kỹ năng — rộng hơn chữ đã hứa (A11.17: consent là cửa không dẻo).
   * ⚠ Cổng là cột boolean, phiên bản chỉ kiểm lúc BẬT ⇒ người đã bật ở v1 không bị hỏi lại. Trước khi
   * v2 lên prod phải đếm `users.pfm_cua_noi_game = true` (D324 ghi n = 0).
   */
  pfm_noi_game: 'v2',
  /*
   * v2 (20/09, D361 — founder: *"Bỏ cái V1 đi, tôi cần kiểm tra chi tiết từng người làm báo cáo"*).
   * V1 hứa *"không có dòng nào nói về một người"* trong khi đợt tester này nhóm làm app ĐỌC dòng từng
   * người — giữ v1 mà vẫn đọc là lách chữ mình tự viết (A11.17, cửa không dẻo). Lý do đầy đủ + hai lời
   * hứa còn đứng vững: `web/src/lib/buoi_do_chu.ts`.
   * ⚠ ĐO TRƯỚC KHI ĐỔI (`npm run do:consent:prod`, 20/09): **0 vết đồng ý, 0 bàn `buoi_do`** trên prod ⇒
   *   thay thẳng, không ai phải hỏi lại. Đây là cách kiểm đúng — chú thích "chưa ai đồng ý" của D329 đã
   *   đi qua 11 bản lên prod mà không ai đọc lại (D61: chú thích thì trôi, câu SQL thì không).
   * v3 (24/09, D392): v2 tả sai dòng dữ liệu sau D370 — "bài giấy" (nay là ba Google Form), "nối bằng mã
   *   tham gia" (nay mã buổi đo), "số tiền trên giấy ở lại trên giấy" (phiếu hỏi khoảng chi tiêu, câu trả
   *   lời vào bảng tính của nhóm làm app). Đo prod 23/09: 0 vết đồng ý buổi đo ⇒ không ai phải hỏi lại.
   */
  buoi_do: 'v3',
  /*
   * v1 (11/10, SPEC chan-truoc-beta) — bản đầu có số. Mọi người bật ô trước bản này (phiên bản NULL) được hỏi lại một lần.
   * ⚠ Lên v2 ⇒ ai đang ở v1 lại bị coi như TẮT tới khi trả lời — đúng ý: đồng ý là đồng ý với MỘT nội dung.
   */
  nghien_cuu: 'v1',
} as const satisfies Record<VanBanConsentId, string>;

/**
 * Mọi phiên bản ĐÃ TỪNG hiệu lực, kể cả bản cũ — để tra ngược một vết đã ghi.
 * ⚠ Chỉ THÊM vào, không bao giờ bớt: một dòng `events` trỏ tới bản v1 vẫn phải đọc
 * được sau khi v2 ra đời (A3.3 — events bất biến).
 * ⚠ `pfm_dong_bo` là văn bản gộp của D250 — đã nghỉ ở D295, chưa ai từng đồng ý (xem đầu tệp).
 */
export const CONSENT_LICH_SU: Record<string, readonly string[]> = {
  pfm_dong_bo: ['v1'],
  pfm_ket: ['v1'],
  pfm_dac_trung: ['v1'],
  pfm_thuong: ['v1'],
  pfm_noi_game: ['v1', 'v2'],
  buoi_do: ['v1', 'v2', 'v3'],
  nghien_cuu: ['v1'],
};

/** Có phải một cửa hợp lệ không (server dùng trước khi ghép tên cột). */
export function laCuaPfm(cua: unknown): cua is CuaPfm {
  return typeof cua === 'string' && (CUA_PFM as readonly string[]).includes(cua);
}

/** Cặp (id, phiên bản) có phải bản ĐANG hiệu lực không — dùng khi user BẬT một cửa. */
export function laConsentHienHanh(vanBanId: unknown, phienBan: unknown): boolean {
  if (typeof vanBanId !== 'string' || typeof phienBan !== 'string') return false;
  return Object.prototype.hasOwnProperty.call(CONSENT_PHIEN_BAN, vanBanId)
    && CONSENT_PHIEN_BAN[vanBanId as VanBanConsentId] === phienBan;
}
