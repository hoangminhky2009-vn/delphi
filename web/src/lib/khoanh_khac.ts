/**
 * "HÔM NAY BẠN VỪA CHẠM" — tự điển CÂU CHỮ cho khối khoảnh khắc ở màn kết
 * (founder 16/08, "vá lối chơi" tầng 1). Server (`server/holdem/khoanh_khac.ts`)
 * chỉ trả ID + vòng + số; mọi chữ nằm ở đây để lint từ vựng D26 quét được —
 * cùng kiến trúc với tự điển (!) và thẻ tính cách.
 *
 * ─── VÌ SAO KHỐI NÀY TỒN TẠI ──────────────────────────────────────────────
 * Người được bạn rủ, chưa có nền, chơi xong một trận mang về được gì? Một
 * con số và một thứ hạng. Không có CÁI TÊN nào để kể lại ("hôm nay tao dính
 * TIN GIẢ") — mà tên là thứ duy nhất người ta nhớ và lan truyền. Chuỗi VÌ SAO
 * đã gọi tên đủ mọi thứ mỗi vòng nhưng chảy qua rồi trôi; khối này GOM lại
 * đúng ba cái tên đau/sướng nhất của CHÍNH bạn.
 *
 * ─── LUẬT VIẾT, KHOÁ BẰNG TEST (`web/tests/khoanh_khac.test.tsx`) ─────────
 * · Mỗi mục: TÊN (viết hoa, ≤3 từ) + một câu NGOÀI ĐỜI nó là gì (D28: đặc
 *   điểm thật, không phải cơ chế game) + một câu HỒI CỐ về thứ đã xảy ra với
 *   bạn trong trận (dựng từ số server gửi).
 * · MÔ TẢ, KHÔNG KÊ ĐƠN (A10). Cấm mọi động từ khuyên bảo: nên · hãy · đừng ·
 *   phải · lần sau · nhớ · tránh · cần. Trò dạy bằng phản hồi, không dạy bằng
 *   lời khuyên (D67) — và lời khuyên tài chính là thứ A10 cấm dù nó đúng.
 * · Không nói về tiền thật, không nói "ngoài đời bạn sẽ…". Chỉ nói NÓ LÀ GÌ.
 * · Giọng D52: dễ hiểu, hài nhẹ, đùa phải chở thông tin.
 */
import type { PixelIconName } from '@/components/ui';
import type { KhoanhKhacId } from '@server/holdem/khoanh_khac_ids';

export interface TheKhoanhKhac {
  /** Tên khái niệm — thứ người ta kể lại. */
  ten: string;
  /** Ngoài đời nó là gì — một câu, không thuật ngữ chưa dịch. */
  ngoai_doi: string;
  /**
   * Câu hồi cố về CHÍNH cú chạm — nhận vòng + delta để tự nói "vòng 3, −4,2%".
   * `am` = delta âm (bạn mất), `duong` = delta dương (bạn được).
   */
  hoi_co: (ctx: { vong: number; pct: string; am: boolean }) => string;
}

/**
 * ICON CHO TỪNG KHÁI NIỆM — founder 23/08: *"phần 'Hôm nay bạn vừa chạm' cũng
 * trực quan hóa bằng hình ảnh và các icon pixel, giảm chữ xuống"*.
 *
 * ⚠ CHỈ DÙNG LẠI LƯỚI ĐÃ CÓ trong `PixelIcon` — không vẽ lưới mới. Chính
 * docstring của `PixelIcon` đã cảnh báo: *"icon 16px sống bằng silhouette,
 * không bằng chi tiết — thêm một lưới chỉ để dùng một lần là đổi một tệp ô
 * vuông lấy một thứ không ai đọc ra"*.
 *
 * ⚠⚠ KHAI THẲNG ĐỘ KHỚP, vì đây là chỗ dễ tự lừa nhất: bộ lưới sẵn có được vẽ
 * cho điều hướng (ví · shop · sảnh), không cho tám khái niệm tài chính. BA cái
 * khớp CHẶT, năm cái là ẨN DỤ GẦN:
 *      tin_gia    → `news`   ⭐ chặt — chính lưới ấy đã được vẽ cho nhánh tin giả
 *      chan_lo    → `shield` ⭐ chặt — sàn chống lỗ đúng nghĩa cái khiên
 *      don_bay    → `bolt`   ⭐ chặt — khuếch đại
 *      truot_gia  → `candle`   gần — giá chạy khỏi chỗ mình vừa nhìn
 *      chen_chuc  → `arena`    gần — một chỗ đông người; không có lưới "đám đông"
 *      suc_cang   → `flame`    gần — nhiệt tích lại rồi bung
 *      ban_khong  → `target`   gần — nhắm vào cú rơi
 *      day_chuyen → `chart`    gần — một cú kéo cả bảng đi theo
 * Năm cái "gần" chấp nhận được vì TÊN luôn đứng ngay cạnh icon: icon làm việc
 * nhận-ra-từ-xa, tên làm việc gọi-đúng-tên. Icon một mình mà phải gánh nghĩa
 * thì mới cần lưới riêng — và lúc đó là nợ art, phải xin founder.
 */
export const ICON_KHOANH_KHAC: Record<KhoanhKhacId, PixelIconName> = {
  truot_gia: 'candle',
  chen_chuc: 'arena',
  tin_gia: 'news',
  suc_cang: 'flame',
  don_bay: 'bolt',
  ban_khong: 'target',
  chan_lo: 'shield',
  day_chuyen: 'chart',
};

export const THE_KHOANH_KHAC: Record<KhoanhKhacId, TheKhoanhKhac> = {
  truot_gia: {
    ten: 'TRƯỢT GIÁ',
    ngoai_doi: 'Nhiều tiền cùng đổ vào một mã trong cùng một nhịp — ai vào sau '
      + 'khớp giá xấu hơn con số trên bảng. Chợ đông thì mua đắt.',
    hoi_co: ({ vong, pct }) => `Vòng ${vong}: bạn đứng trong hàng đó và trả ${pct} cho vé xếp hàng.`,
  },
  chen_chuc: {
    ten: 'CHEN CHÚC',
    ngoai_doi: 'Cả bàn ôm cùng một món thì món đó không còn chỗ để lên — giá đã '
      + 'chạy trước khi bạn tới, và lúc mọi người cùng bán thì cửa ra rất hẹp.',
    hoi_co: ({ vong, pct }) => `Vòng ${vong}: bạn ngồi đúng chỗ đông nhất bàn, phần chen chúc là ${pct}.`,
  },
  tin_gia: {
    ten: 'TIN GIẢ',
    ngoai_doi: 'Một tin nghe rất thật, thị trường phản ứng, rồi lộ ra là bịa — '
      + 'và mọi thứ đảo chiều đúng bằng đoạn nó vừa đi.',
    hoi_co: ({ vong, pct, am }) => (am
      ? `Vòng ${vong}: bạn đứng ở phía tin bịa lúc nó lộ, cú đảo lấy ${pct}.`
      : `Vòng ${vong}: bạn đứng ở phía ngược với tin bịa lúc nó lộ, cú đảo trả ${pct}.`),
  },
  suc_cang: {
    ten: 'SỨC CĂNG',
    ngoai_doi: 'Chợ tăng lâu mà không ai bán thì tích căng như dây kéo — cú rơi '
      + 'lúc đó chẳng còn là một bước lùi, nó bung.',
    hoi_co: ({ vong, pct }) => `Vòng ${vong}: dây bung đúng lúc bạn đang cầm, phần khuếch đại là ${pct}.`,
  },
  don_bay: {
    ten: 'ĐÒN BẨY',
    ngoai_doi: 'Vay thêm để đặt to hơn: ăn thì nhân đôi, thua cũng nhân đôi. Nó '
      + 'không đổi cửa thắng, nó đổi CỠ của mọi kết quả.',
    hoi_co: ({ vong, pct, am }) => (am
      ? `Vòng ${vong}: đòn bẩy cắn ${pct} — đúng bằng phần nó hứa sẽ nhân.`
      : `Vòng ${vong}: đòn bẩy trả ${pct} — phần nhân thêm trên cửa bạn đọc đúng.`),
  },
  ban_khong: {
    ten: 'BÁN KHỐNG',
    ngoai_doi: 'Mượn món chưa có để bán trước, mua trả sau: giá xuống thì lời, '
      + 'giá lên thì lỗ — và lỗ của kiểu này không có đáy.',
    hoi_co: ({ vong, pct, am }) => (am
      ? `Vòng ${vong}: lệnh khống khớp ngược chiều, mất ${pct}.`
      : `Vòng ${vong}: lệnh khống khớp đúng chiều, ăn ${pct} khi giá xuống.`),
  },
  chan_lo: {
    ten: 'CHẶN LỖ',
    ngoai_doi: 'Một mức sàn đặt sẵn: rơi tới đó là ra, không hỏi cảm xúc. Nó '
      + 'không cứu được cú đầu, nó cứu phần còn lại.',
    hoi_co: ({ vong, pct }) => `Vòng ${vong}: sàn đỡ được ${pct} của cú sụt — phần dưới sàn không chạm tới bạn.`,
  },
  day_chuyen: {
    ten: 'DÂY CHUYỀN',
    ngoai_doi: 'Sự kiện này kéo sự kiện kia: lãi rẻ thổi bong bóng, bong bóng gọi '
      + 'siết, siết đẻ sập. Đọc được mắt xích kế là đi trước một nhịp.',
    hoi_co: ({ vong, pct, am }) => (am
      ? `Vòng ${vong}: bạn bám nhầm dây, mắt xích kế đi hướng khác — ${pct}.`
      : `Vòng ${vong}: bạn bám đúng dây, mắt xích kế tới đúng như đọc — ${pct}.`),
  },
};

/**
 * Định dạng delta_bp thành "−4,2%" (dấu trừ Unicode, phẩy thập phân, không
 * dấu cộng). Số nhỏ tới một chữ số lẻ — đây là chữ để KỂ LẠI, không phải sổ.
 */
export function pctCuaBp(bp: number): string {
  // Không dùng toLocaleString: kết quả tuỳ ICU của máy — cùng một số ra hai
  // chuỗi khác nhau giữa test và trình duyệt là bài test không canh được gì.
  const s = (Math.abs(bp) / 100).toFixed(1).replace('.', ',');
  return `${bp < 0 ? '−' : ''}${s}%`;
}

/** Danh sách các từ KHUYÊN BẢO bị cấm trong tự điển này — test quét. */
export const TU_KE_DON = ['nên ', 'hãy ', 'đừng ', 'phải ', 'lần sau', 'nhớ ', 'tránh ', 'cần '] as const;

/**
 * ⭐⭐⭐ "phải" LÀM HAI VIỆC TRONG TIẾNG VIỆT, và bộ quét thô chỉ biết một.
 *
 * `'phải '` trong `TU_KE_DON` nhắm động từ MỆNH LỆNH — *"bạn phải ghi"*, *"phải bớt"*.
 * Nhưng cùng chữ ấy còn là **hệ từ phủ định/nghi vấn**: *"không phải"*, *"có phải"*,
 * *"chẳng phải"*. Đó là ngữ pháp, không phải chính sách — và câu phủ định gần như luôn
 * là câu ta MUỐN có, vì nó nói app KHÔNG làm gì.
 *
 * ⚠⚠ VÌ SAO PHẢI VÁ, chứ không "viết tránh đi": ca thật đã xảy ra 06/09 ở màn HŨ. Bộ quét
 * bắt ba câu, và cách chữa lúc ấy là **sửa câu cho lọt bộ quét**:
 *   *"Sao là dấu của bạn, không phải xếp hạng của app"* → *"…khác xếp hạng của app"*.
 * Câu gốc là một lời phủ nhận DỨT KHOÁT đúng tinh thần A10; bản sửa thì mờ đi. Tức bộ
 * canh A10 vừa ép người viết làm **yếu** một câu A10. Cái giá của một chốt quá thô không
 * phải là phiền — nó là thứ nó đẻ ra để né nó.
 *
 * ⚠ VÁ HẸP, KHÔNG NỚI: chỉ những cụm dưới đây bị che, và che bằng một ký tự ngăn (không
 * phải khoảng trắng) nên hai từ hai bên KHÔNG dính vào nhau thành một cụm mới lọt lưới.
 * Mọi từ khác trong `TU_KE_DON` không đổi một li.
 */
export const HE_TU_PHAI = [
  'không phải', 'chẳng phải', 'đâu phải', 'có phải', 'phải không', 'phải chăng',
  /*
   * `'chưa phải'` thêm 21/09 — cùng họ hệ từ phủ định, khác mỗi ở thì.
   * Ca thật: màn chân dung khai thẳng hạng bằng chứng của chính nó — *"Dựng từ câu bạn vừa
   * trả lời, CHƯA PHẢI từ sổ"*. Đó là một câu A10 MẠNH (nói ra rằng đây là tự khai, không
   * phải đo), và viết tránh đi để lọt bộ quét sẽ làm nó mờ đúng chỗ nó cần rõ — nguyên văn
   * cái bẫy D292 mà khối chú thích trên vừa kể.
   */
  'chưa phải',
] as const;

/**
 * ⭐ CỤM MÀ MỘT TỪ CẤM KHÔNG CÒN LÀ MỆNH LỆNH — ca thứ hai của cùng một họ.
 *
 * `'nhớ '` trong `TU_KE_DON` nhắm *"nhớ ghi lại nhé"*. Nhưng **"bộ nhớ tạm"**
 * (clipboard) cũng chứa đúng chuỗi ấy, và ở đó `nhớ` là DANH TỪ.
 *
 * ⚠ Vì sao thêm vào đây thay vì viết tránh đi: đó chính là bài học đã trả giá ở D292 —
 * lần trước bộ quét ép đổi *"không phải xếp hạng của app"* thành *"khác xếp hạng"*, tức
 * bộ canh A10 làm YẾU một câu A10. Bẻ câu chữ cho lọt bộ quét là để cái chốt định nghĩa
 * lại tiếng Việt; vá chốt thì rẻ hơn và trung thực hơn.
 * ⚠ Vá HẸP: chỉ che đúng cụm, và che bằng ký tự ngăn nên một mệnh lệnh nấp ngay sau nó
 * vẫn bị bắt.
 */
export const CUM_KHONG_MENH_LENH = ['bộ nhớ'] as const;

/**
 * Trả về những từ kê đơn CÓ THẬT trong `chuoi` (rỗng = sạch).
 *
 * ⚠ Dùng chung `TU_KE_DON` — MỘT danh sách từ, hai mức chặt (D61: không đẻ bản sao thứ
 * hai của danh sách). Chỗ nào quét chữ tiếng Việt tự nhiên thì gọi hàm này; chỗ nào chỉ
 * quét nhãn ngắn thì dùng thẳng `TU_KE_DON` vẫn đúng.
 */
export function tuKeDonTrong(chuoi: string): string[] {
  let sach = chuoi.toLowerCase();
  for (const h of HE_TU_PHAI) sach = sach.split(h).join('·');
  for (const c of CUM_KHONG_MENH_LENH) sach = sach.split(c).join('·');
  return TU_KE_DON.filter((t) => sach.includes(t));
}
