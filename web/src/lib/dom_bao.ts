/**
 * ĐỐM BÁO — chấm vàng nhỏ ở góc một lối vào, kiểu thông báo "có việc vừa xong, vào xem nốt"
 * của game/app. Chỉ thị founder 21/09.
 *
 * ⚠⚠⚠ LUẬT CỨNG CỦA CẢ CƠ CHẾ — ĐỌC TRƯỚC KHI THÊM BẤT KỲ MÃ NÀO:
 *
 *   **ĐỐM ĐÁNH DẤU MỘT SỰ KIỆN VỪA XẢY RA, KHÔNG ĐÁNH DẤU MỘT TRẠNG THÁI ĐANG ĐÚNG.**
 *
 * Founder đặt đúng bài toán: *"Cân đối thế nào cho đừng rối quá nhé chứ 1 màn hình toàn đốm
 * vàng tĩnh thì chẳng còn cái nào đặc biệt hay tạo flow nữa"*. Và thủ phạm của "toàn đốm tĩnh"
 * luôn là cùng một sai lầm: gắn đốm vào một ĐIỀU KIỆN thay vì một CÚ CHUYỂN.
 *
 *   · "bạn chưa có hũ nào"        → điều kiện, đúng mãi ⇒ đốm KHÔNG BAO GIỜ TẮT ⇒ thành đồ trang trí
 *   · "bạn vừa tạo hũ đầu tiên"   → sự kiện, xảy ra một lần ⇒ bật, và TẮT khi người ta nhìn
 *
 * Một đốm không tắt được bằng cách nhìn thì không phải đốm báo, nó là một lời nhắc dai — và
 * người dùng học cách phớt lờ nó trong đúng hai ngày. Lúc ấy cả cơ chế chết, kể cả những đốm
 * thật sự quan trọng sau này.
 *
 * ⚠ TRẦN `DOM_TOI_DA` là lưới an toàn thứ hai, không phải lưới thứ nhất. Luật sự-kiện ở trên
 *   mới là thứ giữ màn sạch; trần chỉ chặn ca mà nhiều sự kiện dồn vào cùng một lúc.
 * ⚠ P2 — chỉ nằm trên máy, không đi ra ngoài, không phải dữ liệu nghiên cứu. Hỏng thì coi như
 *   KHÔNG có đốm nào: thiếu một đốm chỉ là lỡ một lời mời; hiện nhầm đốm là nói dối.
 */

/**
 * Mã đốm. Thêm mã mới ⇒ phải là một SỰ KIỆN (xem luật cứng ở đầu tệp).
 *
 * ⚠⚠ TRẠNG THÁI NỐI DÂY, 21/09 — đọc trước khi tưởng cái nào đang chạy:
 *   ✔ `hu_dau_tien`  — ĐÃ NỐI TRỌN: bật ở cả hai đường tạo hũ (`Hu.tsx`), hiện ở tab THẺ
 *                      (`TabTaiChinh`) + nút "việc đầu tiên", tắt khi tới màn chân dung.
 *   ✖ bốn mã còn lại — MỚI KHAI, CHƯA CÓ CHỖ BẬT. Chúng vô hại (không ai gọi `batDom` thì
 *                      không đốm nào sáng), nhưng đừng đọc chúng thành "đã chạy".
 * Điều kiện gỡ dòng cảnh báo này: mỗi mã có đúng ba chỗ — BẬT (lúc sự kiện xảy ra) · HIỆN
 * (lối vào) · TẮT (khi tới nơi). Thiếu chỗ TẮT thì tuyệt đối không nối, vì đó chính là ca
 * "đốm tĩnh" mà cả cơ chế này sinh ra để tránh.
 */
export const MA_DOM = [
  /** Vừa tạo xong hũ đầu tiên qua đường hướng dẫn — founder đặt hàng đích danh. */
  'hu_dau_tien',
  /** Thẻ tính cách vừa NỞ (đủ số trận) — cú chuyển "chưa có → có". */
  'the_vua_no',
  /** Vừa nhận token từ một nhiệm vụ — mời ghé shop xem tiêu được gì. */
  'token_vua_ve',
  /** Sang ngày mới và điểm danh hôm nay chưa bấm — sự kiện THEO NGÀY, xem `batTheoNgay`. */
  'diem_danh_moi',
  /** Bách khoa vừa mở khoá mục mới. */
  'bach_khoa_moi',
] as const;
export type MaDom = (typeof MA_DOM)[number];

/**
 * TRẦN SỐ ĐỐM HIỆN CÙNG LÚC.
 *
 * ⚠ 3 là con số có lý lẽ, không phải số đẹp: quá 3 chấm vàng trên một khung thì mắt thôi đọc
 *   chúng như "cái này mới" và bắt đầu đọc như hoa văn. Vượt trần thì bỏ đốm CŨ NHẤT — sự
 *   kiện mới nhất là thứ đang tạo dòng chảy, cái cũ đã có cơ hội của nó rồi.
 * ⏳ PLAYTEST-TUNE (A8.2) — chưa ai đo.
 */
export const DOM_TOI_DA = 3;

const KHOA = 'dom_bao_v1';

type So = Partial<Record<MaDom, number>>;

function doc(): So {
  try {
    const t = localStorage.getItem(KHOA);
    if (t === null) return {};
    const v = JSON.parse(t) as unknown;
    if (v === null || typeof v !== 'object') return {};
    const ra: So = {};
    for (const m of MA_DOM) {
      const x = (v as Record<string, unknown>)[m];
      if (typeof x === 'number' && Number.isFinite(x)) ra[m] = x;
    }
    return ra;
  } catch {
    /* Riêng tư chặn lưu trữ, hoặc JSON hỏng ⇒ KHÔNG đốm nào. Xem chú thích đầu tệp. */
    return {};
  }
}

/**
 * ⚠⚠ PHẢI BÁO CHO MÀN ĐANG MỞ. `localStorage` KHÔNG bắn `storage` trong chính tab đã ghi, nên
 * một dải tab đã dựng sẵn sẽ không bao giờ biết có đốm mới — tạo hũ xong, chấm chỉ hiện ra
 * sau khi người dùng rời màn rồi quay lại. Đã tự vấp đúng ca ấy khi dựng chạy thật 21/09:
 * kho có `hu_dau_tien`, tab vẫn trống, và không gì đỏ.
 */
export const SU_KIEN_DOM = 'dom-bao-doi';

function ghi(s: So): void {
  try {
    localStorage.setItem(KHOA, JSON.stringify(s));
  } catch { /* không lưu được thì thôi — đốm là tiện nghi, không phải dữ liệu */ }
  try {
    window.dispatchEvent(new CustomEvent(SU_KIEN_DOM));
  } catch { /* môi trường không có window (test thuần) — bỏ qua */ }
}

/**
 * Bật một đốm. `luc` là mốc thời gian gọi (ms) — truyền vào để hàm THUẦN với đồng hồ,
 * và để bài canh dựng được thứ tự cũ/mới mà không phải chờ thật.
 *
 * ⚠ BẬT LẠI MỘT ĐỐM ĐANG SÁNG KHÔNG LÀM NÓ MỚI HƠN. Nếu không giữ mốc cũ thì một sự kiện lặp
 *   (vd token về liên tục) sẽ luôn trẻ nhất và đẩy mọi đốm khác ra khỏi trần — tức một nguồn
 *   ồn ào nuốt hết chỗ của các nguồn quan trọng hơn.
 */
export function batDom(ma: MaDom, luc: number): void {
  const s = doc();
  if (s[ma] !== undefined) return;
  s[ma] = luc;
  ghi(s);
}

/** Tắt đốm — gọi khi người dùng ĐÃ TỚI nơi đốm mời tới. */
export function tatDom(ma: MaDom): void {
  const s = doc();
  if (s[ma] === undefined) return;
  delete s[ma];
  ghi(s);
}

/**
 * Đốm ĐANG ĐƯỢC PHÉP HIỆN, mới nhất trước, tối đa `DOM_TOI_DA`.
 *
 * ⚠ Mọi chỗ vẽ phải hỏi qua đây, KHÔNG đọc thẳng kho: trần chỉ có nghĩa khi nó nằm ở một cửa
 *   duy nhất. Một màn đọc thẳng kho là một màn tự miễn trừ khỏi trần, im lặng.
 */
export function domDangHien(): readonly MaDom[] {
  const s = doc();
  return (Object.keys(s) as MaDom[])
    .filter((m) => MA_DOM.includes(m))
    .sort((a, b) => s[b]! - s[a]!)
    .slice(0, DOM_TOI_DA);
}

export function coDom(ma: MaDom): boolean {
  return domDangHien().includes(ma);
}

/**
 * Bật một đốm THEO NGÀY (điểm danh): chỉ bật lại khi đã sang ngày khác so với lần tắt gần nhất.
 *
 * ⚠⚠ ĐÂY LÀ NGOẠI LỆ DUY NHẤT ĐƯỢC PHÉP, và nó vẫn là SỰ KIỆN chứ không phải trạng thái: sự
 * kiện là *"sang ngày mới"*, xảy ra đúng một lần mỗi ngày. Không có hàm này thì một cách làm
 * ngây thơ ("chưa điểm danh hôm nay ⇒ bật") sẽ bật lại ngay sau khi người dùng vừa tắt nó bằng
 * cách nhìn — đốm không bao giờ tắt được, đúng thứ founder bảo đừng để xảy ra.
 *
 * ⚠ Ngày tính theo LỊCH NGƯỜI DÙNG (`ngayDiaPhuong`), không theo UTC: "hôm nay" của người ở
 *   VN mà cắt theo UTC thì đốm nhảy lúc 7 giờ sáng, giữa ngày của họ.
 */
const KHOA_NGAY = 'dom_bao_ngay_v1';

export function batTheoNgay(ngayDiaPhuong: string, luc: number): void {
  try {
    if (localStorage.getItem(KHOA_NGAY) === ngayDiaPhuong) return;
  } catch { return; }
  batDom('diem_danh_moi', luc);
}

export function tatTheoNgay(ngayDiaPhuong: string): void {
  tatDom('diem_danh_moi');
  try {
    localStorage.setItem(KHOA_NGAY, ngayDiaPhuong);
  } catch { /* xem chú thích `ghi` */ }
}
