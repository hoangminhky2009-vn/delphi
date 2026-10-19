/**
 * TRỢ LÝ MÀN TẬP v4 — ORACLE LUÔN CÓ MẶT · CHỌN BƯỚC HAI LÀN (D336, 15/09).
 *
 * Founder 02/08 dựng v3: đèn rọi theo `[data-tap]`, linh vật Oracle đậu trên khung
 * thoại, chữ chạy như đang nói, kể chuyện đúng từng ô của bàn tập ghim seed.
 *
 * ⚠⚠ 15/09 — VÌ SAO CÓ v4. Tự chơi trọn bàn tập trên dev, ghi vết 250 ms và đọc
 * thẳng state React: 35 bước, Oracle nói 23, **câm từ vòng 8 tới vòng 11 ở MỌI
 * lượt**. Bản v3 là MỘT CON TRỎ đi tới: bước nào chờ một thứ không tới thì cả hàng
 * phía sau đứng im tới khi nó hết hạn. Ba cú cụ thể:
 *   1. `dam-dong-be-o` (D326) chờ đám đông bẻ ô — mà bàn tập TẮT bẻ ô từ D302
 *      (`laSeedManTapCoDinh`). `troi: vong > 11` ⇒ nuốt trượt giá · tăng lãi ·
 *      ngân hàng · chọn kỳ hạn · vỡ. Bài canh cũ mục X hỏi "có `troi` không" — có,
 *      nó trôi ở vòng 12.
 *   2. `mo-bang` đọc `bangMo` ở CẢ `troi` lẫn `tuXong`: mở bảng là hai effect cùng
 *      `setI(x + 1)` trong một commit ⇒ nhảy HAI bước, bước SỔ không bao giờ hiện.
 *   3. `hien` đòi `!xong` ⇒ lời chào chỉ sống trước cú chốt vòng 12.
 * Founder 15/09 chốt thêm: *"delphi phải luôn xuất hiện chứ đ** phải biến mất luôn"*.
 *
 * ⇒ v4, ba thay đổi cấu trúc (không phải vá từng ca):
 *   · `chonBuoc` — MỘT hàm thuần chọn bước từ SỔ ĐÃ QUA (tập id), không từ một con
 *     trỏ. Hai làn: MẠCH KỂ (theo thứ tự, mỗi bước chỉ chờ trong vòng của nó) và
 *     KHI XẢY RA (`lan: 'khi'` — nổ một lần lúc mạch kể rảnh, không bao giờ chặn ai).
 *     Hoàn tất ghi ĐÍCH DANH id vào sổ ⇒ nhảy hai bước là không thể theo cấu trúc.
 *   · Không bước nào hiện ⇒ Oracle THU GỌN thành một dòng gợi ý ở chỗ không che nút
 *     (`goiY`), chứ không biến mất.
 *   · Bước màn kết (`ket: true`) chạy trên chính màn kết.
 * Bài canh dòng thời gian: `web/tests/coach_dong_thoi_gian.test.ts` — chạy kịch bản
 * dọc 12 vòng với ba kiểu người chơi và đòi mọi bước phải tới lượt.
 *
 * ⚠ Kịch bản viết cho bàn tập ghim `HOLDEM_DECISIONS.MAN_TAP_BALANCE_VERSION` (D433: v54; D445: seed
 * `MAN_TAP_SEED_MAU_BAN`, 12 ô; D448 đổi lá mở màn). Chuỗi ô thật: ô 1 GIẢM (lá mở màn) trên nền ĐỎ · ô 2 giảm ·
 * ô 3 đi ngang (đình trệ) · ô 4 ⚖ HẠ LÃI · ô 5–6 PHỤC HỒI · ô 7 BONG BÓNG · ô 8 tăng · ô 9 ⚖ TĂNG LÃI ·
 * ô 10–12 giảm. Màu bàn theo vòng: đỏ · đỏ · xám ×3 · xanh ×4 · xám · đỏ. Đổi seed hoặc luật sinh map
 * ⇒ rà mọi bước có `keO` / `keMau` cùng commit; `web/tests/coach_ban_tap.test.ts` khoá lời ↔ ô thật ↔ màu bàn thật.
 * ⚠⚠ v54 là Ô ÚP (D373/D382): ô 1 là LÁ MỞ MÀN (ngửa, không tính tiền), vòng K quyết toán bằng
 * ô K+1 đang úp ("SẮP LẬT") ⇒ 12 ô = 11 vòng. Ở vòng K, ô 1..K đã ngửa (ô K VỪA LẬT — chính là
 * kết quả vòng K−1). Nên bước KỂ ô K vẫn chạy ở vòng K; bước nói về ô mà cú CHỐT vòng này sẽ lật
 * chạy ở vòng K−1 và khai `keO.duBao` (`coach_dong_thoi_gian.test.ts` canh cả hai chiều).
 *
 * ⚠ C4: component CHỈ ĐỌC trạng thái + các cửa dàn cảnh (đóng/mở shop, tấm VÌ SAO,
 * tấm trượt) — không đụng đường tính tiền nào.
 */
import { useEffect, useRef, useState, type CSSProperties } from 'react';
import type { LoaiTheVong, MucDinhTinhDTO } from '@/api/holdem';
import { Mascot } from '@/components/Mascot';
import { useReducedMotion } from '@/lib/hooks';
import { danhDauQuaManTap } from '@/lib/man_tap_dau';
import { MUC_DINH_TINH } from '@/lib/muc_dinh_tinh';
import { ghiDo } from '@/lib/telemetry';
import s from './CoachTap.module.css';
import { htmlTinh } from '@/lib/html_tinh';

export interface BoiCanhTap {
  vong: number;
  /**
   * D376 — vòng để IN RA NHÃN, tách khỏi `vong` (thứ lái bước dạy). Vắng ⇒ dùng `vong`.
   * Có mặt khi người chơi đang đọc kết quả: cả màn nói vòng VỪA ĐÓNG, không nói vòng kế.
   */
  vongNhan?: number;
  /** Tổng số vòng của trận (12 ở bàn tập). Vắng ⇒ nhãn không in vòng. */
  tongVong?: number;
  shopMo: boolean;
  /** Người chơi ĐÃ TỪNG mở Bảng điện tử trong trận này (mốc, không phải trạng thái). */
  bangMo: boolean;
  /** Bảng điện tử ĐANG mở (lớp phủ z-index 85, nằm TRÊN trợ lý). */
  bangDangMo?: boolean;
  /** Người chơi đang chọn đúng một mã trong shop (panel lệnh mốc đang mở). */
  shopChonMa: boolean;
  /** Đã xếp ít nhất một lệnh ⇒ khối "DANH MỤC SAU LỆNH" đang render. */
  shopCoLenh?: boolean;
  /** Đang hiện kết quả vòng (con số % + VÌ SAO) và sân khấu đã yên. */
  coKetQua: boolean;
  /**
   * Sân khấu đang diễn: ô đang lật hoặc lớp phủ khoảnh khắc. Trợ lý đứng ngoài cả
   * hai dạng (khung thoại lẫn dòng thu gọn) — cú lật là màn trình diễn của trò.
   */
  sanKhau?: boolean;
  /** Ô VỪA LẬT mang dấu "ĐÃ ĐỔI ↺" — đám đông vừa bẻ ô. Bàn tập tắt bẻ ô (D302). */
  oVuaDoi?: boolean;
  /** Chuỗi lý do vòng vừa rồi có mắt xích chen chúc / trượt giá. */
  coChenChuc?: boolean;
  /** Có tin trước đang nghiêng cửa cho ô kế (telegraph). */
  coTinTruoc?: boolean;
  /** Kết quả vòng vừa rồi LỘ một tin giả (`ket_qua_vong.tin_gia_lo`). */
  tinGiaLo?: boolean;
  loaiVongNay: LoaiTheVong;
  xong: boolean;
  onMoShop: (mo: boolean) => void;
  /**
   * Vòng cuối màn tập còn TẠM DỪNG đồng hồ (D53), đọc từ catalog
   * `MAN_TAP_MIEN_GIO_DEN_VONG` — coach nói đúng đồng hồ đang hiện, không gõ số tay.
   */
  vongTamDungDen?: number;
  /** Đang mở tấm VÌ SAO của kết quả vòng. */
  moLyDo?: boolean;
  /** Cửa đóng/mở tấm VÌ SAO cho trợ lý dàn cảnh (xem `Buoc.lyDo`). */
  onMoLyDo?: (mo: boolean) => void;
  /** Đã chọn một lõi chiến thuật ở vòng lõi. */
  chonLoi?: boolean;
  /** D321 — tấm trượt đang mở trong shop (`'bank'` = ngân hàng, null = không). */
  tamMo?: string | null;
  onMoTam?: (tam: string | null) => void;
  /** Đã TỪNG mở tờ (!) giải thích một lá trong trận này (mốc). */
  daDocTo?: boolean;
  /** Tờ (!) ĐANG mở — trợ lý nhường chỗ (tờ sống trong ngữ cảnh xếp lớp của shop). */
  toMo?: boolean;
  /** Đã mở chip 🏦 lãi suất. */
  moLaiSuat?: boolean;
  /** Màn CHÀO VAI đã xong. `undefined` = trận không có vai ⇒ không chờ gì. */
  chaoVaiXong?: boolean;
  /** Pha của màn chào vai: `chia` · `toi` · null (không hiện). */
  chaoVaiPha?: 'chia' | 'toi' | null;
  /** Server vừa mời kỳ ngộ ở vòng này (`st.ky_ngo?.moi` không rỗng). */
  kyNgoMoi?: boolean;
  /** Lớp phủ kỳ ngộ ĐANG mở. */
  kyNgoMo?: boolean;
  /** Lớp phủ kỳ ngộ ĐÃ tự mở ở vòng này (để biết cú đóng là người chơi đóng). */
  kyNgoDaMo?: boolean;
  /** Người chơi đã CHỌN một con đường kỳ ngộ. */
  kyNgoDaChon?: boolean;
  /**
   * v43 (D319) — server BÁO gửi tiết kiệm được ở vòng này. Đọc cờ server, không tự
   * suy (C4). `undefined` = trận không có ngân hàng.
   */
  nganHangMo?: boolean;
  /** Người chơi đã chọn một kỳ hạn để gửi. */
  chonGui?: boolean;
  /**
   * Khoá lưu sổ đã-qua theo trận (thường là `matchId`). Nạp lại trang giữa trận
   * không bắt người chơi nghe lại bước đã nghe. Vắng ⇒ không lưu.
   */
  khoaLuu?: string | null;
  /**
   * D336 lượt 2 — sáu mã cho DẢI HAI PHE trong khung thoại (`Buoc.hinh`): tên · phe · art từ catalog
   * + lưới art màn trận đã nạp. Vắng ⇒ bước vẫn nói, chỉ không vẽ dải.
   */
  taiSanTap?: readonly { id: string; label: string; nhom: 'rui_ro' | 'phong_thu'; svg?: string | undefined }[];
  /**
   * Tờ (!) của sáu mã (`catalog.tu_dien.tai_san`) — MỨC định tính mỗi mã khi một tin lật. Dải hai phe
   * vẽ đúng thang của tờ (!) (server đã cắt bp), không một con số nào ở client (C4, founder 25/07).
   */
  tuDienTap?: Readonly<Record<string, { su_kien?: readonly (readonly [string, MucDinhTinhDTO])[] } | undefined>>;
  /**
   * D527 — bàn tập chạy KHUNG MINIGAME (cờ server `dong_ho_minigame`) ⇒ kịch bản `KICH_BAN_MINIGAME` thay `KICH_BAN`. Đọc cờ trận, không
   * đọc hằng `MAN_TAP_BALANCE_VERSION`: trận tập v54 còn dở vẫn nghe đúng kịch bản của nó.
   */
  minigame?: boolean;
  /** D527 — vòng này có chợ trait đang mở (màn chọn của shop mang chợ). */
  coChoTrait?: boolean;
}

/**
 * VÒNG DẠY NGÂN HÀNG — D433 (v54): vòng 8, vòng người chơi cược vào ô ⚖ TĂNG LÃI còn úp. Sổ v54
 * lãi THẢ NỔI theo lãi suất nền (`tietKiemThaNoi`), nên mở sổ TRƯỚC kỳ họp là lúc cơ chế ấy nhìn
 * thấy được: kỳ họp lật TĂNG thì sổ lên theo. ⚠ D566: "ngay ô đó" (vòng mà kỳ họp quyết toán) chỉ đúng từ khoá v66; ở v53–v65
 * (gồm bàn tập v62) lãi mới áp từ vòng SAU — câu dạy chỉ được nói về các vòng tới, không về vòng kỳ họp.
 * Bàn tập v62 có 5 vòng nên bước dạy vòng 8 này không chạy.
 * Vòng 8 cũng là vòng CUỐI mà cả ba mốc 2/3/4 ô còn đáo hạn trong 11 VÒNG của bàn 12 ô ô úp
 * (8+4−1 = 11) — `coach_ban_tap.test.ts` mục VI canh bằng số VÒNG, không phải số ô.
 * ⚠ Ở vòng 9 (chỗ của bản v52) mốc 4 ô đáo hạn ở "vòng 12" không tồn tại: engine vẫn cho mở
 * (`kipDaoHanTietKiem` đếm số Ô) rồi tất toán như huỷ lúc đóng trận — mất sạch lãi.
 */
export const VONG_DAY_NGAN_HANG = 8;

export interface Buoc {
  id: string;
  /** `data-tap` của phần tử được rọi sáng. null = khung thoại đứng giữa màn. */
  muc: string | null;
  /**
   * `'khi'` = làn KHI XẢY RA: không nằm trong mạch kể, nổ tối đa một lần khi `cho`
   * đúng VÀ mạch kể đang rảnh. Dành cho bước chờ thứ PHỤ THUỘC CÁCH CHƠI (tin trước,
   * trượt giá, bẻ ô) — thứ không được phép chặn bài của vòng sau (bài học 15/09).
   * ⚠ Bước làn này KHÔNG dàn cảnh shop (không `shop`/`giuShop`): nó nổ vào lúc bất
   * kỳ, giành shop khỏi tay người đang đặt lệnh là tệ. Muốn nó rọi mặt bàn thì `cho`
   * đòi `!b.shopMo`.
   */
  lan?: 'khi';
  /** Bước của MÀN KẾT — chỉ chạy khi trận đã xong; bước giữa trận thì ngược lại. */
  ket?: true;
  /** Bước cần shop đóng/mở — trợ lý dàn cảnh lúc bước hiện. */
  shop?: boolean;
  /**
   * GIỮ shop đúng trạng thái `shop` SUỐT bước (người chơi lỡ cất shop giữa bước lấy
   * shop làm sân khấu). ⚠ Đừng bật ở bước mà đóng shop là cách xong bước (`chot`).
   */
  giuShop?: boolean;
  /** Tấm VÌ SAO phải đóng/mở theo bước (tấm `fixed` che thanh tay cầm). */
  lyDo?: boolean;
  /** D321 — tấm trượt trong shop: `'bank'` mở ngân hàng, `null` đóng mọi tấm. */
  tam?: string | null;
  /**
   * Sân khấu của bước đã sẵn chưa. Mạch kể CHỜ ở bước này (không đi tắt qua), nên
   * mọi `cho` của mạch kể phải đúng được TRONG VÒNG của bước — kèm `troi` đúng hạn.
   */
  cho?: (b: BoiCanhTap) => boolean;
  /** Bối cảnh đã TRÔI QUA ⇒ bỏ bước. Mạch kể: mọi bước đều phải có. */
  troi?: (b: BoiCanhTap) => boolean;
  /**
   * Người chơi làm đúng việc được yêu cầu ⇒ bước xong. Được hỏi cả khi bước đang
   * chờ `cho`: cú bấm làm tắt sân khấu (đóng tấm, đóng lớp phủ) vẫn là xong việc —
   * bản v3 chỉ hỏi khi bước đang hiện và tự khoá ba lần vì thế.
   */
  tuXong?: (b: BoiCanhTap) => boolean;
  /** Bước có `tuXong` mà vẫn cho nút TIẾP (bước đọc tự xong khi người chơi đóng tấm). */
  tiep?: true;
  /** Chuỗi, hoặc hàm của bối cảnh khi cùng một bước phải nói khác nhau (đồng hồ). */
  loi: string | ((b: BoiCanhTap) => string);
  /**
   * Bước này KỂ CHUYỆN về ĐÚNG ô nào của bàn tập — test khoá thoại ↔ bàn thật
   * (`web/tests/coach_ban_tap.test.ts`). Vắng = bước không kể một ô cụ thể.
   * `anTen`: lời CỐ Ý không gọi tên ô (founder chốt nguyên câu) — bài khoá thay vì đòi từ khoá
   * thì đòi lời KHÔNG gọi nhầm tên ô nào khác.
   * `duBao` (D433, luật ô úp): bước nói về ô CÒN ÚP mà cú CHỐT vòng này sẽ lật ⇒ phải chạy đúng vòng
   * `vong − 1`. Bước không khai `duBao` chỉ được chạy khi ô đã NGỬA (vòng ≥ `vong`).
   */
  keO?: { vong: number; su_kien?: string; giai_doan?: string; la_tin_gia?: boolean; anTen?: true; duBao?: true };
  /**
   * D445 — bước này nói MÀU BÀN lúc vào vòng `vong` (nền dải thẻ, D442 — đi theo `xu_huong` công khai của ô vừa lật):
   * `xuong` đỏ · `len` xanh · `ngang` xám. Test dựng lại màu từ `trang_thai` thật của bàn tập
   * (`web/tests/coach_ban_tap.test.ts`) — lời nói "bàn đang ĐỎ" mà bàn xám là đỏ bài.
   */
  keMau?: { vong: number; mau: 'len' | 'xuong' | 'ngang' };
  /**
   * D336 lượt 2 — DẢI HAI PHE trong khung thoại: sáu mã chia RỦI RO | PHÒNG THỦ; `su_kien` thì dưới
   * mỗi mã có mũi tên MỨC của tờ (!) khi tin ấy lật. Founder 15/09: *"chẳng có chỗ nào giải thích tài
   * sản nào sẽ hưởng lợi/ bị giảm hay vì sao"* — chữ nói VÌ SAO, dải nói AI.
   */
  hinh?: { loai: 'phe' } | { loai: 'su_kien'; id: string };
  /**
   * Lời nói phe/mã nào LÊN, phe/mã nào XUỐNG — khai ra để bài canh đối chiếu với MA TRẬN ĐANG CHẠY
   * (`coach_ban_tap.test.ts` XI). Lời kể tính chất tài sản mà không khai là lời không ai canh; đổi
   * ma trận ở một cổng `balance_version` sau này thì bài đỏ trước khi Oracle nói sai.
   * `len`/`xuong`: `'rui_ro'` · `'phong_thu'` (cả phe) hoặc id một mã.
   */
  noiChieu?: readonly { su_kien?: string; giai_doan?: string; len?: readonly string[]; xuong?: readonly string[] }[];
}

/** Lời của một bước trong bối cảnh này — MỘT chỗ giải, cho cả render lẫn test. */
export function loiCuaBuoc(buoc: Pick<Buoc, 'loi'>, b: BoiCanhTap): string {
  return typeof buoc.loi === 'function' ? buoc.loi(b) : buoc.loi;
}

/**
 * Câu tả ĐỒNG HỒ ở bước `dong-ho` — rẽ theo thứ đang hiện trên mặt số:
 * (a) màn tập, các vòng đầu: TẠM DỪNG (D53) — nói vậy và báo từ vòng nào chạy;
 * (b) còn lại: đồng hồ đang chạy. Hai nhánh cùng kết bằng luật hết-giờ.
 */
export function cauDongHo(b: BoiCanhTap): string {
  const luat = 'hết giờ máy chốt hộ, danh mục giữ nguyên.';
  const den = b.vongTamDungDen;
  if (den && b.vong <= den) {
    return `Đồng hồ TẠM DỪNG cho ${den} vòng dắt tay đầu; từ vòng ${den + 1} nó chạy — ${luat}`;
  }
  return `Từ giờ đồng hồ chạy — ${luat}`;
}

const vongMoDongHo = (b: BoiCanhTap) => (b.vongTamDungDen ?? 4) + 1;
/** D433 — vòng CUỐI đọc từ trận (`tong_vong`): bàn 12 ô chạy 11 vòng ở luật ô úp (`soVong`, D382). */
const vongCuoi = (b: BoiCanhTap) => b.tongVong ?? 12;

export const KICH_BAN: readonly Buoc[] = [
  /*
   * ═══ VÒNG 1 — màn chia vai đóng băng rồi tour mặt bàn → shop → chốt ═══════════
   * Luật lời (16/08, "hướng dẫn ít chữ"): một bước một câu, ưu tiên chờ tay
   * (`tuXong`) hơn đọc suông; tên trong lời là ĐÚNG chữ đang in trên màn.
   * ⚠ Id bước là PHỄU (`huong_dan_buoc`) — `BUOC_HUONG_DAN` (config/telemetry.ts)
   * phải bằng đúng thứ tự `id:` trong tệp này (`quantri.test.tsx` XI).
   */
  {
    /*
     * 12/09 — màn CHIA VAI đứng lại ở bàn tập (`dongBang`), coach nói trên chính màn.
     * 15/09 — Oracle tự giới thiệu Ở ĐÂY: bản v3 chào ở bước 3, sau khi đã nói hai bước.
     * `|| b.vong > 1`: nạp lại trang ở vòng 2 thì màn chào không dựng lại nữa.
     */
    id: 'chia-vai', muc: 'chia-vai', shop: false,
    cho: (b) => b.chaoVaiPha === 'chia' || b.chaoVaiPha === 'toi',
    troi: (b) => b.chaoVaiXong !== false || b.vong > 1,
    tuXong: (b) => b.chaoVaiPha === 'toi',
    loi: 'Mình là Oracle, dắt bạn trọn bàn tập. Mỗi ghế bốc một vai — chạm để xem vai bạn.',
  },
  {
    id: 'vai-cua-ban', muc: 'chao-vai', shop: false,
    cho: (b) => b.chaoVaiPha === 'toi',
    troi: (b) => b.chaoVaiXong === undefined || b.vong > 1,
    tuXong: (b) => b.chaoVaiXong === true,
    // D433 — v54 `vonDeu`: mọi ghế vào trận với cùng một vốn; vai chỉ còn quyết LUẬT RIÊNG.
    loi: 'Vai quyết luật riêng của bạn; vốn đầu thì ghế nào cũng bằng nhau. Đọc xong, chạm để vào bàn.',
  },
  {
    /*
     * 15/09 — DẢI VAI ĐỨNG TRƯỚC "CHẠM SHOP". Bản v3 bảo chạm SHOP rồi bước ngay sau
     * (`shop: false`) đóng shop lại để nói về dải ghế: cú chạm đầu tiên trong trận
     * trông như một nút hỏng.
     */
    id: 'vai', muc: 'doi-thu', shop: false, lyDo: false,
    cho: (b) => b.chaoVaiXong !== false || b.vong > 1,
    troi: (b) => b.vong > 1,
    loi: 'Dải ghế cả bàn — chạm một ghế để xem vai của họ.',
  },
  {
    /*
     * 15/09 — MỤC TIÊU TRẬN. Bản v3 không có câu nào nói trận này để làm gì trước
     * lệnh đầu tiên. Xếp hạng cuối đo % tăng NAV so với vốn đầu CỦA VAI MÌNH
     * (`vonDauCua` — engine.ts), nên câu nói "% nhất", không nói "nhiều tiền nhất".
     */
    id: 'muc-tieu', muc: 'map', shop: false,
    cho: (b) => b.chaoVaiXong !== false || b.vong > 1,
    troi: (b) => b.vong > 1,
    // D433 — v54 ô úp: người chơi cược vào ô SẮP LẬT (nhãn in dưới ô úp đầu dãy — MarketMap).
    loi: 'Mỗi vòng bạn cược vào ô SẮP LẬT — chốt xong nó mới lật. Hết bàn, ai tăng NAV nhiều % nhất thì đứng đầu.',
  },
  /*
   * ═══ D445 → D448 — ĐỌC LÁ ĐANG LẬT ⇒ ĐOÁN HƯỚNG LÁ KẾ (founder 28/09). D445 dạy bằng tỷ lệ của bánh xe ("8 lần trong 10")
   * trên lá mở màn ĐI NGANG; founder bác: lá đầu phải là lá XU HƯỚNG / SỰ KIỆN, và Oracle *"ko nói xác suất cụ thể, dễ dính
   * đòn (giáo dục ko thực tiễn) chỉ dự đoán xu hướng dựa trên lá đang được lật thôi"*. Nên: lá mở màn GIẢM trên bàn ĐỎ
   * (seed `MAN_TAP_SEED_MAU_BAN`), Oracle nói mùa đang đi đâu và ô kế NGHIÊNG về đâu — bằng lời, không bằng số. Chỉ TẢ + nói
   * phe nào hay rơi — không bảo mua bán gì (A10). Bài canh "không số": `coach_ban_tap.test.ts` §XII.
   */
  {
    id: 'la-mo-man', muc: 'map', shop: false,
    cho: (b) => b.chaoVaiXong !== false || b.vong > 1,
    troi: (b) => b.vong > 1,
    keO: { vong: 1, giai_doan: 'giam' },
    keMau: { vong: 1, mau: 'xuong' },
    loi: 'Đọc lá vừa lật trước tiên. Lá mở màn là GIẢM, bàn đang ĐỎ: chợ đang trong mùa đi xuống. MÀU BÀN kể mùa của '
      + 'chợ — ĐỎ là đi xuống, XANH đi lên, XÁM chưa rõ hướng.',
  },
  {
    id: 'doan-la-ke', muc: 'map', shop: false,
    cho: (b) => b.chaoVaiXong !== false || b.vong > 1,
    troi: (b) => b.vong > 1,
    keO: { vong: 2, giai_doan: 'giam', duBao: true },
    noiChieu: [{ giai_doan: 'giam', xuong: ['rui_ro'], len: ['phong_thu'] }],
    loi: 'Mùa đi xuống thường chưa dứt ngay sau một lá, nên ô SẮP LẬT nghiêng về GIẢM tiếp. Chợ GIẢM thì phe RỦI RO '
      + 'rơi mạnh, phe PHÒNG THỦ đỡ hơn.',
  },
  {
    id: 'mo-shop', muc: 'nut-shop', shop: false, lyDo: false,
    cho: (b) => b.chaoVaiXong !== false || b.vong > 1,
    troi: (b) => b.vong > 1,
    tuXong: (b) => b.shopMo,
    loi: 'Chạm SHOP để chia tiền vào sáu mã.',
  },
  {
    /*
     * D336 lượt 2 — HAI PHE TRƯỚC LỆNH ĐẦU TIÊN. Founder 15/09: *"chơi xong hết màn hướng dẫn mà vẫn
     * chưa biết tính chất của các loại tài sản … phải giải thích mấy cái cơ bản này user mới chơi
     * game được chứ"*. Sáu mã vốn chia hai phe trong catalog (`TAI_SAN.nhom`) và bảy chỗ trong app
     * đọc phe ấy, nhưng chưa một câu nào nói phe là gì. Dải hình vẽ chính sáu mã chia hai phe.
     * Mỗi tin lớn về sau (hạ lãi · bong bóng · tăng lãi · vỡ) nói lại phe nào lên, phe nào xuống.
     */
    id: 'hai-phe', muc: 'shop-taisan', shop: true, giuShop: true, tam: null,
    troi: (b) => b.vong > 1,
    hinh: { loai: 'phe' },
    noiChieu: [
      { giai_doan: 'tang', len: ['rui_ro'] },
      { giai_doan: 'giam', xuong: ['rui_ro'], len: ['phong_thu'] },
    ],
    loi: 'Sáu mã chia hai phe. RỦI RO: chợ tốt lên mạnh, chợ xấu rơi mạnh. PHÒNG THỦ: chợ xấu, tiền thường chạy vào.',
  },
  {
    // BÀN CƯỢC (D92): người đi đường chip-trước không có nhịp "đang chọn mã".
    id: 'taisan', muc: 'shop-taisan', shop: true, giuShop: true, tam: null,
    troi: (b) => b.vong > 1,
    tuXong: (b) => b.shopChonMa || b.shopCoLenh === true,
    /*
     * D351 — MÃ VỠ LÒNG LÀ VN30, KHÔNG PHẢI CRYPTO (teammate 19/09).
     * Bản cũ bảo "Chạm Crypto" — mã ỒN NHẤT bàn (biến động nền hạng 1) và sổ lệnh MỎNG nhất,
     * tức lệnh đầu đời của người mới vừa nhảy mạnh nhất vừa chịu phí nặng nhất. Hai teammate
     * chơi thử đúng đường đó rồi hỏi *"tại sao phí mua bán 65"*.
     * VN30 sổ lệnh DÀY ⇒ lệnh đầu rẻ, và để dành chênh lệch làm bài học ở vòng 2 (`mo-bang`).
     * ⚠ Đây là lời thoại thuần — `tuXong` không hỏi mã nào, nên đổi chữ không đụng logic.
     * ⚠ Thứ KHÔNG đổi được bằng lời: ô nào rơi vào vòng nào (seed ghim). Vòng 2 vẫn là SẬP SÀN.
     */
    // D445 — thôi gọi đích danh VN30: ngay trước đó Oracle vừa tả bàn ĐỎ (phe rủi ro hay rơi); chọn mã là việc của người chơi.
    loi: 'Sáu mã, cả bàn cùng thấy. Chạm một mã để cầm lên.',
  },
  {
    id: 'shop-lenh', muc: 'shop-lenh', shop: true, giuShop: true, tam: null,
    troi: (b) => b.vong > 1,
    tuXong: (b) => b.shopCoLenh === true,
    loi: 'Bốn chip là 25% · 50% · 75% · toàn bộ tiền mặt. Chạm 25%.',
  },
  {
    /*
     * D319 — khối xếp lệnh xong mới sinh ra. 15/09: gọi đúng TÊN IN TRÊN KHỐI — bản
     * v3 nói "khối XEM TRƯỚC" trong khi màn ghi "DANH MỤC SAU LỆNH".
     * D432 — bảng ấy rời mặt nỉ: số sau lệnh in lên lá + VÍ, PHÍ đứng đầu hàng lệnh (neo `shop-xemtruoc` nay là nút
     * PHÍ, `!` của nó mở tấm SAU LỆNH). Lời nói đúng cái đang nhìn thấy.
     */
    id: 'xem-truoc', muc: 'shop-xemtruoc', shop: true, giuShop: true, tam: null,
    cho: (b) => b.shopCoLenh === true,
    troi: (b) => b.vong > 1,
    loi: 'Số trên lá và VÍ trên đầu là sau lệnh. PHÍ là tiền mua bán trừ khi chốt — chạm để xem cả danh mục.',
  },
  {
    /*
     * 15/09 — câu nói ĐÚNG NHÂN QUẢ của cú chốt: giá chạy theo ô HIỆN TẠI, rồi ô kế
     * mới lật. Bản v3 bảo "Cọc xanh = chưa chốt" trong khi đèn không rọi cọc nào, và
     * bước sau đó còn nói "ô MỚI lật kéo cả bàn" — ngược thứ tự thật.
     * D433 — nhân quả của luật ô úp (v54): cú chốt LẬT ô đang úp và giá chạy theo CHÍNH ô ấy.
     */
    id: 'chot', muc: 'shop-chot', shop: true, tam: null,
    troi: (b) => b.vong > 1,
    tuXong: (b) => b.coKetQua || !b.shopMo,
    loi: 'Bấm CHỐT VÒNG: ô SẮP LẬT lật lên và giá chạy theo nó.',
  },

  /*
   * ═══ VÒNG 2 — đọc kết quả vòng 1, ô SẬP SÀN, quầy lõi chiến thuật ═════════════
   * ⭐ shop:false + giuShop:true ở ba bước sau chốt: `shopMoLucLat` (AlphaDraftMatch)
   * mở lại shop khi pha QUYẾT bắt đầu — một phát, SAU khi bước đã vào.
   * `coach_ban_tap` mục VIII canh.
   */
  {
    id: 'thi-truong', muc: 'thi-truong', shop: false, giuShop: true,
    cho: (b) => b.coKetQua, troi: (b) => b.vong > 2,
    loi: 'Sáu mã vừa chạy theo ô bạn vừa chốt — kể cả mã bạn không cầm.',
  },
  {
    id: 'ketqua', muc: 'vi-sao', shop: false, giuShop: true,
    cho: (b) => b.coKetQua, troi: (b) => b.vong > 2,
    tuXong: (b) => b.moLyDo === true,
    loi: 'Số % neon là cả ví bạn ở vòng vừa rồi. Chạm nó để xem vì sao.',
  },
  {
    /*
     * 15/09 — tự xong khi người chơi ĐÓNG tấm. Bản v3 để bước đọc này chờ `moLyDo`
     * mà không có đường xong nào khác ngoài TIẾP: đóng tấm trước khi bấm TIẾP là mạch
     * kể đứng im hết vòng 2 (nuốt SẬP SÀN và cả quầy lõi).
     */
    id: 'vi-sao', muc: 'ketqua', shop: false, giuShop: true, tiep: true,
    cho: (b) => b.moLyDo === true, troi: (b) => b.vong > 2,
    tuXong: (b) => b.moLyDo !== true,
    /*
     * D351 — MẮT XÍCH 1/4 CỦA MẠCH PHÍ. Bản cũ gọi tên khoản "phí" rồi bỏ đó, nên người chơi
     * đọc được CON SỐ mà không có cách nào biết vì sao nó là con số ấy. Câu này nối phí với
     * SỔ LỆNH; ba mắt xích sau là `mo-bang` (nhìn ở đâu) → `doc-loi` → `loi-chien-thuat`
     * (Lướt Sóng làm bảng sạch).
     */
    loi: 'Số to là cả ví. PHẦN TIỀN kể từng mã; chênh còn lại là phí mua bán, Quỹ vòng, lạm phát. '
      + 'Phí nặng hay nhẹ tuỳ SỔ LỆNH của mã — ít người mua bán thì lệnh của bạn tự đẩy giá.',
  },
  {
    /*
     * 15/09 — TÊN Ô ĐỌC ĐÚNG NHÃN TRÊN THẺ: "Sàn khoá rút tiền" (D351; trước đó "Sập sàn" v28, "Hack sàn" v0).
     * ⚠ D336 lượt 2 — lời cũ là NGUYÊN CÂU founder chốt 15/09: *"Thi thoảng thị trường có sự kiện
     * bất ngờ như này, ảnh hưởng hay không thì đợi mới biết."* Nó cố ý không gọi tên ô và không
     * nói THẬT/GIẢ, vì "đợi mới biết" chính là bài học.
     *
     * ⚠⚠ D351 — VIẾT LẠI, founder duyệt 19/09 sau khi hai teammate dừng ĐÚNG ở bước này
     * (*"giới thiệu hướng dẫn phần oracle vòng 2 không hiểu"*). Ý đồ giữ nguyên; cái hỏng là câu
     * chở ý đồ ấy **không chở gì cả**: người mới đọc ra thành "hướng dẫn cũng không biết".
     * Câu mới giữ đủ ba vế và thêm vế thứ tư mà bản cũ thiếu: nói ra CÁI GIÁ của việc tin sớm.
     * Một bài học không cho người ta thấy hậu quả thì ở vòng 2 nó chỉ là một cái nhún vai.
     * ⚠ Vẫn KHÔNG gọi tên ô (thẻ đang được rọi đã in tên) ⇒ `anTen` giữ nguyên.
     * D433 (v54 ô úp) — tin này lật ở ĐẦU vòng 2 (nó quyết toán vòng 1) và lộ thật/giả ở kết quả vòng 2:
     * từng vế của câu vẫn đúng, nên câu founder duyệt giữ nguyên.
     *
     * ⚠⚠ A10 — TẢ, KHÔNG KÊ ĐƠN. Bản nháp đầu của D351 viết *"chưa biết thì ĐỪNG dồn hết theo
     * nó"* và bài §IV-b bắt ngay ("đừng " nằm trong danh sách cấm). Đúng luật: Oracle tả hậu quả
     * và để người chơi tự chọn. Sửa thành câu tả — ai dồn hết thì đặt cược vào đâu, hết.
     */
    /*
     * D445 — lá ô 2 vừa lật đúng như màu bàn báo, rồi CHUỖI NHÂN QUẢ một câu (bàn tập đi trọn chuỗi này). Bài tin giả
     * của seed 77004 (ô 2 SÀN KHOÁ RÚT TIỀN giả) không còn: seed dạy màu bàn không có tin giả trước ô 9.
     */
    id: 'chuyen-v2', muc: 'map', shop: false, lyDo: false,
    cho: (b) => b.vong === 2, troi: (b) => b.vong > 2,
    keO: { vong: 2, giai_doan: 'giam' },
    keMau: { vong: 2, mau: 'xuong' },
    // D448 — bỏ "2–3 ô" (hạn mùa của bánh xe): Oracle không nói độ dài mùa bằng số (founder 28/09).
    loi: 'GIẢM tiếp, bàn vẫn ĐỎ — đúng hướng lá trước báo. Mùa đi xuống đã chạy từ trước khi bạn vào bàn, nên nó không '
      + 'còn trẻ. '
      + 'Chuỗi nhân quả: SUY THOÁI → HẠ LÃI → PHỤC HỒI → TĂNG → QUÁ NÓNG → TĂNG LÃI → GIẢM.',
  },
  {
    /*
     * ⭐ D351 — MẮT XÍCH 2/4, DỜI TỪ VÒNG 3 LÊN VÒNG 2.
     *
     * Bản cũ dạy Bảng điện tử ở vòng 3, trong khi phí mua bán đập vào mặt người chơi từ vòng 1
     * và tấm VÌ SAO gọi tên nó ở vòng 2. Tức mắt xích "nhìn sổ lệnh ở đâu" tới SAU hai vòng kể
     * từ lúc người chơi cần nó — và hai teammate 19/09 dừng ở vòng 2 mà chưa từng nghe tới bảng.
     * Nay: đau ở vòng 1 → gọi tên ở `vi-sao` → chỉ chỗ nhìn ở đây → vòng này cũng là vòng CHỌN
     * LÕI, nên `loi-chien-thuat` khép mạch bằng Lướt Sóng. Bốn nhịp, một vòng, một mạch.
     *
     * ⚠ SỬA MỘT CHỖ NÓI SAI: lời cũ ghi bảng "tốn ít Vốn". Phí mở là `BANG_DIEN_TU.PHI_MO`
     * = 1% vốn đầu trận, và con số ấy được chọn CỐ Ý để bắt người chơi đắn đo (bảng giá số cũ
     * 25 bị bác vì "không ai cân nhắc một giây, cơ chế thành trang trí"). Dạy nó là "tốn ít"
     * là dạy ngược đúng cái giằng co mà cơ chế dựng lên.
     * ⚠ Không in con số ra lời: nút đã in phí, và số thì đổi theo tham số (`doThamSo`).
     */
    id: 'mo-bang', muc: 'bang', shop: false,
    cho: (b) => b.vong === 2, troi: (b) => b.vong > 2,
    tuXong: (b) => b.bangMo,
    loi: 'Muốn biết mã nào đang mỏng thì mở BẢNG ĐIỆN TỬ — nó còn cho xem DƯ ÂM của tin cũ trên từng mã. '
      + 'Tốn Vốn mỗi lần mở, nên phải đáng. Chạm mở.',
  },
  {
    // 12/09 — chờ tay mở shop (rọi đúng nút SHOP); không `shop` ⇒ không tự khoá.
    id: 'mo-shop-loi', muc: 'nut-shop', lyDo: false,
    cho: (b) => b.loaiVongNay === 'chien_thuat',
    troi: (b) => b.vong > 2 || b.chonLoi === true,
    tuXong: (b) => b.shopMo,
    loi: 'Vòng này mở quầy LÕI CHIẾN THUẬT. Chạm SHOP để xem.',
  },
  {
    /*
     * D312 / 12/09 — dạy ĐỌC trước khi CHỌN. 15/09: câu cũ nói (!) "không phải tác
     * dụng trong trận" — sai: tờ (!) có hẳn mục ĐẶC QUYỀN — thứ bạn nhận được.
     */
    id: 'doc-loi', muc: 'shop-loi', shop: true, giuShop: true, tam: null,
    cho: (b) => b.loaiVongNay === 'chien_thuat' && b.chonLoi !== true,
    troi: (b) => b.vong > 2 || b.chonLoi === true,
    tuXong: (b) => b.daDocTo === true,
    loi: 'Chạm dấu (!) trên một lõi: nó kể lõi ấy ngoài đời và ĐẶC QUYỀN bạn nhận.',
  },
  {
    /*
     * ⭐ D351 — MẮT XÍCH 4/4: KHÉP MẠCH PHÍ BẰNG LÕI.
     * Bản cũ chỉ nói "bấm MUA một lõi", nên cú mua đầu tiên là một cú bấm ngẫu nhiên. Nay nó là
     * câu trả lời cho đúng vấn đề vừa dựng: bảng trễ một vòng + che mờ hai mã, Lướt Sóng gỡ cả hai
     * và hạ phí mở.
     * ⚠ GỌI ĐÍCH DANH "LƯỚT SÓNG" ĐƯỢC vì quầy vòng 2 ghim sẵn nó
     * (`HOLDEM_DECISIONS.MAN_TAP_LOI[2]` = `['luot_song','chan_lo']`). Chính chú thích của bảng
     * ấy đã ghi ý đồ: V2 phát một lá THÔNG TIN, rồi V4 chào lại Lướt Sóng để dạy nâng **CẤP 2**.
     * Bản cũ không nói ra ý đồ đó ở đâu cả, nên người chơi mua lá ở V2 bằng một cú bấm ngẫu
     * nhiên rồi tới V4 không hiểu vì sao lại thấy "ĐANG CẦM ×1 → LẤY = CẤP 2".
     * ⚠ Đổi bảng quầy ⇒ câu này thành lời nói dối — chú thích của bảng đã dặn "đổi bảng = đổi
     * lời Oracle cùng commit".
     * ⚠ Không in số (phí mở giảm bao nhiêu, che mờ mã nào) — tờ (!) của lõi đã in, và số đổi
     * theo tham số.
     */
    id: 'loi-chien-thuat', muc: 'shop-loi', shop: true, giuShop: true, tam: null,
    cho: (b) => b.loaiVongNay === 'chien_thuat', troi: (b) => b.vong > 2,
    tuXong: (b) => b.chonLoi === true,
    // D526 — lá lõi thôi có nút MUA: chạm lá mở tờ chú thích, LẤY ở chân tờ.
    loi: 'Chạm MỘT lá lõi để đọc, rồi LẤY — miễn phí, giữ vĩnh viễn. LƯỚT SÓNG làm bảng rẻ hơn, hết trễ một vòng, '
      + 'hết che mờ hai mã đầu cơ.',
  },

  /*
   * ═══ VÒNG 3 — cọc chip · SỔ · tin trước ══════════════════════════════════════
   * ⚠ D351 dời `mo-bang` sang vòng 2 (mạch phí) và dời `danh-muc` xuống đây, để vòng 2 vẫn
   * đúng 8 bước — thêm một mắt xích thì phải trả một bước, không cộng dồn.
   */
  {
    // D445 — mùa suy thoái hết hạn; ô 3 là mùa ĐI NGANG (đình trệ — ngã rẽ `DINH_TRE_BP` của bánh xe).
    id: 'chuyen-v3', muc: 'map', shop: false, lyDo: false,
    cho: (b) => b.vong === 3, troi: (b) => b.vong > 3,
    keO: { vong: 3, giai_doan: 'di_ngang' },
    keMau: { vong: 3, mau: 'ngang' },
    loi: 'Bàn chuyển XÁM: mùa suy thoái đã hết. Lá ĐI NGANG trên bàn xám — chợ ngừng rơi nhưng chưa đi lên. Suy thoái '
      + 'có khi nghỉ vài ô như thế rồi mới phục hồi.',
  },
  {
    // D321 — cọc chip nằm ngay trên lá mã đang giữ; bước rọi vào chính lưới ô.
    id: 'danh-muc', muc: 'shop-taisan', shop: true, giuShop: true, tam: null,
    cho: (b) => b.vong >= 3, troi: (b) => b.vong > 3,
    loi: 'Lá mã bạn đang giữ có cọc chip và số tiền ở góc dưới.',
  },
  {
    /*
     * Chờ bảng ĐÓNG: nút SỔ nằm dưới lớp phủ bảng (z-index 85), rọi lúc bảng mở là rọi vào thứ bị che.
     * D336 lượt 2 — lời thành MỘT LỜI NHẮC chỗ đọc sâu (founder 15/09: *"chỉ nên là 1 lời nhắc kiểu
     * 'Nếu bạn muốn hiểu sâu hơn thì...'"*). Người vào màn tập lần đầu có sổ gần như trống.
     */
    id: 'so-lien-he', muc: 'so-lien-he', shop: false,
    cho: (b) => b.vong === 3 && b.bangDangMo !== true, troi: (b) => b.vong > 3,
    loi: 'Muốn hiểu sâu hơn thì mở SỔ: nó ghi tin nào từng kéo mã nào đi đâu, qua mọi trận bạn chơi.',
  },
  {
    /*
     * ⭐ D433 — BÀI Ô ÚP ĐẦU TIÊN: DỰ BÁO KỲ HỌP. Ở vòng 3 người chơi cược vào ô 4 ⚖ còn úp: LỊCH họp là
     * công khai (MarketMap in ⚖ + "KỲ HỌP" cả trên ô úp), HƯỚNG thì úp. Câu nói đúng hàm phản ứng công khai
     * (bánh xe v54, `BanhXe.kyVong`: suy thoái ⇒ HẠ · quá nóng ⇒ TĂNG) và "hay" chừa chỗ cho kỳ họp đi
     * ngược; không nói mua bán gì (A11.10). `keO.duBao`: ô 4 phải là ô SẮP LẬT của đúng vòng này.
     */
    id: 'du-bao-ky-hop', muc: 'map', shop: false, lyDo: false,
    cho: (b) => b.vong === 3, troi: (b) => b.vong > 3,
    keO: { vong: 4, su_kien: 'ha_lai_suat', la_tin_gia: false, duBao: true },
    loi: 'Ô SẮP LẬT mang dấu ⚖: KỲ HỌP — lịch họp công khai, hướng thì úp. Chợ vừa GIẢM rồi chững thì ngân hàng hay '
      + 'HẠ LÃI để kéo chợ dậy.',
  },
  {
    /*
     * KHI XẢY RA — gạch màu dưới ô ÚP. `telegraph` chỉ có khi ô ngay trước là một ô
     * sự kiện (bàn tập: vòng 3 · 5 · 8 · 10). 15/09: bản v3 xếp nó giữa mạch kể nên
     * tới muộn vòng 5 là đứng chờ tới vòng 8, nuốt PHỤC HỒI, KỲ NGỘ, BONG BÓNG.
     */
    id: 'tin-truoc', muc: 'map', lan: 'khi',
    cho: (b) => b.coTinTruoc === true && !b.shopMo, troi: (b) => b.vong > 10,
    loi: 'Gạch màu dưới ô còn ÚP: tin vừa lật đang nghiêng ô đó về một phía.',
  },
  {
    /*
     * KHI XẢY RA — trượt giá chỉ nổ khi lệnh đủ to so với thanh khoản; neo ở cụm VÌ SAO.
     * ⚠ D336 lượt 2 — founder 15/09: *"khi t bấm vào lý do để xem thì oracle ko ẩn đi ngay mà phải ấn
     * vào nút vàng tiếp tục"*. Bước bảo đi XEM mà không nhận cú mở tấm là xong ⇒ khung thoại đứng đè
     * lên đúng tấm vừa mở. Nay mở VÌ SAO là xong bước (sau khi bước đã hiện — luật `daHien`).
     */
    id: 'truot-gia', muc: 'vi-sao', lan: 'khi',
    cho: (b) => b.coChenChuc === true && b.coKetQua && !b.shopMo, troi: (b) => b.vong > 11,
    tuXong: (b) => b.moLyDo === true,
    loi: 'Lệnh to khớp lệch giá; cả bàn cùng mua một mã thì lệch thêm. Chạm số % để xem dòng Chen chúc.',
  },

  /*
   * ═══ VÒNG 4 — ⚖ HẠ LÃI · lộ tin giả ═══════════════════════════════════════════
   */
  {
    /*
     * 15/09 — neo riêng vào CHIP 🏦 (`lai-suat`), không rọi cả khối bản đồ nữa.
     * Founder 15/09: *"ko nói qua về việc vì sao lãi suất tăng"* ⇒ mỗi kỳ họp nói VÌ SAO theo
     * đúng hàm phản ứng CÔNG KHAI (`huongChinhSachKyVong`, server/holdem/map.ts): chợ đang GIẢM
     * (hoặc biến động / có cú sập thật) ⇒ HẠ; có lạm phát/chiến tranh thật, hoặc bong bóng thật,
     * trong 4 ô gần nhất ⇒ TĂNG. Chỉ đạo founder 29/08: luật ấy "dạy ở HƯỚNG DẪN, không dán
     * nhãn lên ô".
     */
    id: 'chuyen-v4', muc: 'lai-suat', shop: false, lyDo: false,
    cho: (b) => b.vong === 4, troi: (b) => b.vong > 4,
    tuXong: (b) => b.moLaiSuat === true,
    keO: { vong: 4, su_kien: 'ha_lai_suat', la_tin_gia: false },
    loi: 'Ô ⚖ KỲ HỌP vừa lật: chợ vừa GIẢM nên ngân hàng HẠ LÃI để đỡ chợ. Chạm chip 🏦 xem lãi suất mới.',
  },
  {
    // D336 lượt 2 — nói luôn PHE nào hưởng tiền rẻ; dải vẽ mức của tờ (!) khi tin "Hạ lãi suất" lật.
    id: 'lai-suat', muc: 'map', shop: false,
    cho: (b) => b.moLaiSuat === true && b.vong === 4, troi: (b) => b.vong > 4,
    hinh: { loai: 'su_kien', id: 'ha_lai_suat' },
    noiChieu: [{ su_kien: 'ha_lai_suat', len: ['rui_ro', 'tpcp'] }],
    loi: 'TIỀN RẺ: vay dễ nên tiền đổ vào phe RỦI RO, trái phiếu cũ lên giá — và bong bóng dễ thành THẬT.',
  },
  {
    /*
     * D336 lượt 2 — LÕI THỨ HAI CỦA BÀN TẬP LÀ ĐÒN BẨY (`MAN_TAP_LOI_GIAN[4]`; D433 v54: `MAN_TAP_LOI_GON[4]`; XI khoá).
     * Founder 15/09: *"cho oracle gợi ý user chọn đòn bẩy ở lõi 2 đi vì tiền đang rẻ (Không phải kiểu
     * khuyến khích mà là kiểu giải thích rằng tiền đang rẻ thì xu hướng dễ đi dài)"*. Câu tả HAI vế của
     * cùng một lá — xu hướng dài VÀ nhân đôi cả lỗ — không nói lấy hay không (A11.10).
     * Đúng với máy: chuỗi TĂNG mở giữa tiền rẻ là nguồn LÌ (`MARKOV_NGUON.NGUON_LI`, D159).
     */
    /*
     * ⚠ CHỜ NGƯỜI CHƠI TỰ MỞ SHOP (không `shop: true`): vòng 4 còn bài "lộ tin giả" ở làn khi-xảy-ra,
     * và làn ấy chỉ nổ khi shop ĐÓNG. Bước này tự mở shop là nuốt bài ấy — kết quả vòng 3 đổi ngay khi
     * chốt vòng 4 (bài dòng thời gian bắt). Dòng thu gọn đã nói "Vòng lõi: mở SHOP để chọn một lõi".
     * ⚠ `chonLoi` chỉ tính ở CHÍNH vòng 4: cờ ấy cũng bật khi chọn lõi ở vòng 2, và `troi` đọc nó lúc
     * đó là ghi bước này vào sổ đã-qua hai vòng trước khi nó kịp nói (bài dòng thời gian bắt).
     */
    id: 'loi-don-bay', muc: 'shop-loi', tam: null,
    cho: (b) => b.vong === 4 && b.loaiVongNay === 'chien_thuat' && b.chonLoi !== true && b.shopMo,
    troi: (b) => b.vong > 4 || (b.vong === 4 && b.chonLoi === true),
    loi: 'Tiền rẻ thì xu hướng tăng hay chạy DÀI, và vay cũng rẻ. ĐÒN BẨY nhân đôi lãi lẫn lỗ mọi mã bạn cầm, mỗi ô trả lãi vay.',
  },
  {
    /*
     * KHI XẢY RA — 15/09, trả nợ lời gieo ở vòng 2 ("vòng sau mới lộ THẬT hay GIẢ"):
     * băng TIN GIẢ trong kết quả vòng 3 chưa từng được chỉ vào. Viết chung cho mọi
     * tin giả, không gọi tên — cách lộ là ở chính băng trong tấm VÌ SAO.
     */
    id: 'tin-gia-lo', muc: 'vi-sao', lan: 'khi',
    cho: (b) => b.tinGiaLo === true && b.coKetQua && !b.shopMo, troi: (b) => b.vong > 11,
    tuXong: (b) => b.moLyDo === true,
    loi: 'Lộ rồi: một tin vòng trước là GIẢ, dư âm đảo chiều. Chạm số % để xem.',
  },

  /*
   * ═══ VÒNG 5 — PHỤC HỒI · khối tay ═══════════════════════════════════════════
   */
  {
    id: 'chuyen-v5', muc: 'map', shop: false,
    cho: (b) => b.vong === 5, troi: (b) => b.vong > 5,
    keO: { vong: 5, giai_doan: 'phuc_hoi' },
    keMau: { vong: 5, mau: 'ngang' },
    loi: 'RECOVERY — PHỤC HỒI có gốc: lãi hạ THẬT vừa kéo chợ khỏi đáy. Bàn còn XÁM vì mùa mới chạy chưa đủ hai ô.',
  },
  {
    id: 'tay', muc: 'tay', shop: false,
    cho: (b) => b.vong >= 5, troi: (b) => b.vong > 5,
    // D443 — thanh đáy chỉ còn thứ BẤM được; mã đang cầm lên khung NAV (neo `dang-cam`).
    loi: 'Khối đáy màn là chỗ BẤM: lãi suất, SỔ, số % vòng trước (chạm xem VÌ SAO), SHOP, BẢNG và CHỐT VÒNG. '
      + 'Mã bạn đang cầm nằm ngay dưới NAV.',
  },
  {
    // D445 — mùa phục hồi đủ hai ô ⇒ `xu_huong` công khai hiện ⇒ bàn XANH lần đầu.
    id: 'mau-xanh', muc: 'map', shop: false, lyDo: false,
    cho: (b) => b.vong === 6, troi: (b) => b.vong > 6,
    keO: { vong: 6, giai_doan: 'phuc_hoi' },
    keMau: { vong: 6, mau: 'len' },
    loi: 'Bàn chuyển XANH: mùa đi lên đã đủ hai ô. Lá pha lúc này nghiêng về PHỤC HỒI và TĂNG; lá TIN vẫn có thể '
      + 'chen vào và đổi hướng.',
  },

  /*
   * ═══ VÒNG 7 — BONG BÓNG · BÁO TRƯỚC KỲ HỌP ══════════════════════════════════
   * D433 — bước `ky-ngo` NGHỈ: v54 tắt kỳ ngộ (`kyNgo`), và một bước mạch kể chờ lời mời không bao giờ
   * tới là chặn cả vòng 7 (đúng lớp "kẹt đầu hàng" 15/09). `coach_ban_tap` IV canh vế này.
   */
  {
    id: 'chuyen-v7', muc: 'map', shop: false,
    cho: (b) => b.vong === 7 && b.kyNgoMo !== true, troi: (b) => b.vong > 7,
    keO: { vong: 7, su_kien: 'bong_bong', la_tin_gia: false },
    hinh: { loai: 'su_kien', id: 'bong_bong' },
    noiChieu: [{ su_kien: 'bong_bong', len: ['rui_ro'], xuong: ['phong_thu'] }],
    loi: 'BONG BÓNG THẬT — tiền rẻ nên bóng có gốc: phe RỦI RO leo nhanh, phe PHÒNG THỦ bị bỏ lại.',
  },
  {
    /*
     * ═══ BÁO TRƯỚC KỲ HỌP (15/09, D336) ══════════════════════════════════════════
     * D433 — dời vòng 8 → 7: ở luật ô úp, ô 9 quyết toán vòng 8, nên "báo trước một vòng" là vòng 7.
     * Founder 15/09: *"màn hướng dẫn đang hơi hiếp dâm người chơi quá — auto thua vì phần
     * hướng dẫn chả cảnh báo hoặc điều hướng pivot gì khi tăng lãi suất xảy ra"*. Lượt tự
     * chơi 15/09: NAV +83% ở vòng 9 rồi kết −37%, không một lời. Câu này nói LUẬT công khai
     * trước khi ô 9 lật — tả cơ chế, không bảo mua bán gì (A11.10).
     */
    id: 'bao-ky-hop', muc: 'map', shop: false, lyDo: false,
    cho: (b) => b.vong === 7, troi: (b) => b.vong > 7,
    loi: 'Ô 9 là KỲ HỌP. Tiền vay rẻ đổ vào chợ lâu ngày thì giá tài sản lẫn giá hàng hoá cùng leo — kinh tế QUÁ NÓNG.',
  },
  {
    /*
     * D336 lượt 2 — founder 15/09: *"nói rằng bong bóng thật ngân hàng tăng lãi suất để hạ nhiệt là hơi
     * phiến diện, cần giải thích rõ hơn và sát ngoài đời hơn"*. Sát đời ở chỗ: ngân hàng trung ương
     * không nhắm GIÁ CỔ PHIẾU, họ nhắm LẠM PHÁT; bong bóng thành cớ tăng lãi khi nó đi cùng tín dụng rẻ
     * và giá cả leo — kinh tế quá nóng. Hai lần có thật, kiểm nguồn 15/09: Nhật — BoJ nâng lãi chiết
     * khấu 2,5% (5/1989) → 6% (8/1990), Nikkei đỉnh 12/1989 rồi sập; Việt Nam — sau cơn sốt chứng khoán,
     * nhà đất 2007 và lạm phát trên 20%, lãi suất cơ bản lên 14% (6/2008).
     * Máy (`huongChinhSachKyVong`, map.ts) đọc bong bóng THẬT trong bốn ô gần nhất là cớ TĂNG — đúng cái
     * luật công khai bước này kể, và "hay" chừa chỗ cho ~15% kỳ họp đi ngược mà luật ấy có.
     */
    id: 'vi-sao-tang-lai', muc: 'map', shop: false, lyDo: false,
    cho: (b) => b.vong === 7, troi: (b) => b.vong > 7,
    loi: 'Ngân hàng trung ương canh LẠM PHÁT chứ không canh giá cổ phiếu — nóng tới mức ấy thì họ hay TĂNG LÃI. Nhật 1989, Việt Nam 2008 đều vậy.',
  },
  {
    /*
     * KHI XẢY RA — ĐÁM ĐÔNG BẺ Ô. ⚠ Bàn tập TẮT bẻ ô (D302 `laSeedManTapCoDinh`), nên ở
     * bàn tập bước này KHÔNG BAO GIỜ nổ — nó ở đây cho bàn có coach mà không cố định.
     * Người chơi bàn tập nghe về bẻ ô ở câu chốt màn kết. (D326 đo "bẻ ở vòng 7·11·12"
     * bằng replay không đi qua `luatChoTran` — đúng cái bẫy docstring hàm ấy cảnh báo.)
     */
    id: 'dam-dong-be-o', muc: 'map', lan: 'khi',
    cho: (b) => b.oVuaDoi === true && !b.shopMo, troi: (b) => b.vong > 11,
    loi: 'Ô này bị BẺ: cả bàn dồn một phía nên chợ lật thứ khác. Chân ô ghi ĐÃ ĐỔI ↺.',
  },

  /*
   * ═══ VÒNG 8 — CƯỢC VÀO Ô ⚖ ĐANG ÚP · NGÂN HÀNG (v43, D319; D433 dời từ vòng 9) ══
   * Luật ô úp: ô 9 (TĂNG LÃI) quyết toán vòng 8 ⇒ hệ quả lúc chốt + công cụ đổi danh mục + ngân hàng phải
   * nói ở vòng 8; vòng 9 chỉ còn kể ô vừa lật (`chuyen-v9`).
   */
  {
    /*
     * 15/09 (D336) — HỆ QUẢ lúc CHỐT + một câu HỎI, không kê đơn (A11.10). Ô 9 tính giá lúc chốt
     * vòng này, nên đây là lúc cuối còn đổi được danh mục trước cú ấy.
     * ⚠ D336 lượt 2 — chiều từng mã dời lên `chuyen-v9` (có dải + `noiChieu` canh bằng ma trận; con số
     * chép tay trong chú thích bản trước còn SAI bảng: trận v45 đọc ma trận V42). Câu này nói vế ĐÒN
     * BẨY: lõi lấy ở vòng 4 nhân đôi cả cú rơi — lượt founder tự chơi 15/09 mất −152,8% vì đúng nó.
     */
    // D443 — hỏi "Bạn đang cầm gì?" thì rọi đúng hàng MÃ ĐANG CẦM (đã lên khung NAV), không rọi thanh đáy.
    id: 'rui-ro-ky-hop', muc: 'dang-cam', shop: false,
    cho: (b) => b.vong === 8, troi: (b) => b.vong > 8,
    // D433 — ô 9 còn ÚP ở vòng này: câu thành DỰ BÁO có điều kiện ("nó mà…"), không khẳng định hướng.
    keO: { vong: 9, su_kien: 'tang_lai_suat', la_tin_gia: false, duBao: true },
    loi: 'Ô 9 SẮP LẬT, tính giá khi bạn CHỐT. Nó mà TĂNG LÃI thì đang cầm ĐÒN BẨY là cú rơi nhân đôi, và vay đắt lên từ đó. Bạn đang cầm gì?',
  },
  {
    /*
     * Chỉ CÔNG CỤ đổi danh mục (mặt RÚT), không chỉ nên đổi hay không. Neo `shop-mat` — hàng
     * mặt MUA/RÚT chỉ hiện khi đang cầm mã; không cầm gì thì không có gì để rút, và lưới neo
     * vắng chỉ nhuộm đều màn (bước này vốn có nút TIẾP).
     */
    id: 'rut', muc: 'shop-mat', shop: true, giuShop: true, tam: null,
    cho: (b) => b.vong === 8, troi: (b) => b.vong > 8,
    loi: 'Hàng mặt này đổi danh mục: RÚT bán bớt mã đang cầm, MUA thêm mã khác — hoặc giữ nguyên.',
  },
  {
    // ⚠ `cho` đọc CỜ SERVER (`nganHangMo`): vòng đúng mà server không cho gửi thì panel mờ.
    id: 'ngan-hang', muc: 'ngan-hang', shop: true, giuShop: true, tam: 'bank',
    cho: (b) => b.vong === VONG_DAY_NGAN_HANG && b.nganHangMo === true,
    troi: (b) => b.vong > VONG_DAY_NGAN_HANG,
    // D433 — v54 (D405): lãi sổ THẢ NỔI theo lãi nền mỗi ô, lạm phát ăn cả gốc. Câu cũ "lãi cố định" thành sai.
    loi: 'NGÂN HÀNG: lãi sổ THẢ NỔI theo lãi suất nền — kỳ họp tăng lãi thì sổ lên theo. Lạm phát ăn cả gốc như tiền mặt.',
  },
  {
    // A10 — tả đánh đổi, không nói nên chọn kỳ nào.
    id: 'ngan-hang-ky', muc: 'ngan-hang-ky', shop: true, giuShop: true, tam: 'bank',
    cho: (b) => b.vong === VONG_DAY_NGAN_HANG && b.nganHangMo === true,
    troi: (b) => b.vong > VONG_DAY_NGAN_HANG,
    tuXong: (b) => b.chonGui === true,
    loi: 'Kỳ dài lãi cao hơn, huỷ giữa chừng mất sạch lãi. Chọn một kỳ — gửi thật khi CHỐT.',
  },

  /*
   * ═══ VÒNG 9 — ⚖ TĂNG LÃI VỪA LẬT ══════════════════════════════════════════
   */
  {
    id: 'chuyen-v9', muc: 'map', shop: false,
    cho: (b) => b.vong === 9, troi: (b) => b.vong > 9,
    keO: { vong: 9, su_kien: 'tang_lai_suat', la_tin_gia: false },
    hinh: { loai: 'su_kien', id: 'tang_lai_suat' },
    noiChieu: [{ su_kien: 'tang_lai_suat', xuong: ['rui_ro', 'tpcp'], len: ['usd'] }],
    loi: 'KỲ HỌP TĂNG LÃI: vay đắt lên nên tiền rút khỏi phe RỦI RO; trái phiếu cũ mất giá, Stablecoin (đô la) mạnh lên.',
  },

  /*
   * ═══ VÒNG 10–12 — đồng hồ chạy · VỠ · phong cách · tổng kết ═══════════════════
   */
  {
    // Đồng hồ nói ĐÚNG LÚC nó bắt đầu chạy (vòng đầu sau `vongTamDungDen`).
    id: 'dong-ho', muc: 'dong-ho', shop: false,
    cho: (b) => b.vong === vongMoDongHo(b), troi: (b) => b.vong > vongMoDongHo(b),
    loi: (b) => cauDongHo(b),
  },
  {
    /*
     * D336 lượt 2 — vế đối xứng của câu vòng 4 ("tiền rẻ thì xu hướng tăng thường chạy dài"): chuỗi
     * GIẢM mở bằng một cú tăng lãi THẬT cũng là nguồn LÌ (`MARKOV_NGUON.NGUON_LI` có
     * `chinh_sach_that`). Phe phòng thủ đứng vững hơn ở pha giảm — `noiChieu` canh bằng ma trận pha.
     */
    id: 'chuyen-v10', muc: 'map', shop: false,
    cho: (b) => b.vong === 10, troi: (b) => b.vong > 10,
    keO: { vong: 10, giai_doan: 'giam' },
    noiChieu: [{ giai_doan: 'giam', xuong: ['rui_ro'], len: ['phong_thu'] }],
    loi: 'VỠ: bong bóng xì — phe RỦI RO rơi, phe PHÒNG THỦ đứng vững hơn. Chuỗi GIẢM mở bằng tăng lãi thật thường kéo dài.',
  },
  {
    /*
     * A10 + §1.2: tả thanh này ĐỌC LẠI cách chơi, không gợi ý phong cách nào tốt
     * hơn. D337 (15/09) — hạng nay khoá theo thứ hạng cuối cùng (trần theo vị trí
     * + gộp PAV, `phongCachCaBan`/`holdem/phong_cach.ts`): xếp dưới ai thì không
     * còn cao hơn người đó, nên câu ở đây phải nói đúng luật mới, không phải câu
     * cũ "không có kiểu nào đúng" — hạng giờ có SO SÁNH giữa các ghế.
     */
    id: 'phong-cach', muc: 'phong-cach', shop: false,
    cho: (b) => b.vong >= 11, troi: (b) => b.vong > 11,
    loi: 'Thanh này chấm cách bạn chơi, nhưng không vượt được thứ hạng: xếp dưới ai thì không cao hơn người đó.',
  },
  {
    // D433 — "vòng cuối" đọc từ trận: bàn tập v54 chạy 11 vòng (id giữ nguyên cho phễu).
    id: 'chuyen-v12', muc: 'map', shop: false,
    cho: (b) => b.vong === vongCuoi(b), troi: (b) => b.vong > vongCuoi(b),
    // D445 — chuỗi của seed dạy màu bàn (không còn "tin đồn" của seed cũ); màu bàn khép vòng về ĐỎ.
    keMau: { vong: 11, mau: 'xuong' },
    loi: 'Vòng cuối. Cả chu kỳ vừa đi: suy thoái, chững, hạ lãi, phục hồi, bong bóng, tăng lãi, vỡ — và màu bàn đi '
      + 'theo mùa: ĐỎ, XÁM, XANH, rồi ĐỎ lại.',
  },
  {
    /*
     * MÀN KẾT — 15/09: chạy trên chính màn kết. Bản v3 đặt lời chào ở vòng 12 trước cú
     * chốt, nên chốt vòng 12 — việc tự nhiên nhất — là mất nó. Nói trước điều trận thật
     * có mà bàn tập không (D302: bàn tập cố định, không bẻ ô). D337: bàn tập chấm hạng
     * phong cách bằng thang nới đỉnh — nói ra, để SSS ở đây không thành lời hứa cho trận thật.
     */
    id: 'het', muc: null, ket: true,
    // D433 — v54 tắt bẻ ô (`phanThan`) ở MỌI trận; điều trận thật có mà bàn tập không nay là bàn 16 ô không lặp.
    loi: 'Xong bàn tập! Trận thật có đồng hồ từ vòng 1, bàn 16 ô mỗi trận một khác, và hạng phong cách chấm khắt khe hơn.',
  },
];

/*
 * ═══ D527 — KỊCH BẢN BÀN TẬP MINIGAME (khoá v58, 6 ô · 5 vòng, nhịp T · M · T · M · M) ═══════════════════════════════════════════
 * Lời CHÉP từ demo nhịp trận founder chốt 05/10 (`docs/ui-ux/demo/nhip-tran.html`, khối `ORACLE`). Câu màn đầu viết rõ hơn bản đầu của
 * demo ("không bấm = giữ suốt, màn cộng không" dễ đọc thành "khoản đứng im"); demo đã sửa theo cùng câu. Câu màn sống ở
 * `lib/coach_minigame.ts` (`loiOracleMan`) vì nó nói TRÊN màn minigame, không qua khung thoại.
 * Seed `MAN_TAP_SEED_XEN_KE` (3823): tăng → ⚡ DỊCH BỆNH → giảm → giảm → phục hồi → phục hồi; quầy lõi vòng 1 ghim BẮT ĐÁY + ĐÒN BẨY.
 * ⭐ D545 (khoá v62, seed `MAN_TAP_SEED_KY_HOP` 29949): GIẢM → GIẢM → ⚖ HẠ LÃI SUẤT → PHỤC HỒI → 🎈 BONG BÓNG → TĂNG. Founder 06/10: *"chỉ nên hướng
 * dẫn đến khi user đủ kiến thức để tự chơi/ tự đọc chú thích. Sau đó delphi chỉ đóng vai trò giải thích cái gì đang xảy ra"* + bàn tập thiếu thẻ kỳ
 * họp, người mới không hiểu "vì sao" chợ đi như vậy. Vòng 1–2 dắt tay như cũ; từ vòng 3 Oracle chỉ còn KỂ ô vừa lật (là gì · vì sao · phe nào lên
 * xuống — `noiChieu` khoá vào ma trận đang chạy, `keO` khoá vào ô thật của seed).
 * Luật lời như `KICH_BAN`: một bước một câu, chờ tay hơn đọc suông, TẢ không KÊ ĐƠN (A10). Mỗi bước mạch kể đều có `troi`.
 */
export const KICH_BAN_MINIGAME: readonly Buoc[] = [
  {
    id: 'mg-chia-vai', muc: 'chia-vai', shop: false,
    cho: (b) => b.chaoVaiPha === 'chia' || b.chaoVaiPha === 'toi',
    troi: (b) => b.chaoVaiXong !== false || b.vong > 1,
    tuXong: (b) => b.chaoVaiPha === 'toi',
    loi: 'Mình là Oracle, dắt bạn trọn bàn tập 6 ô. Mỗi ghế bốc một vai: bạn biết bàn có bao nhiêu tay to, không biết ai — chạm để xem vai bạn.',
  },
  {
    id: 'mg-vai-cua-ban', muc: 'chao-vai', shop: false,
    cho: (b) => b.chaoVaiPha === 'toi',
    troi: (b) => b.chaoVaiXong === undefined || b.vong > 1,
    tuXong: (b) => b.chaoVaiXong === true,
    // v57 — vốn đầu theo vai (`vonVaiV57`); xếp hạng theo % trên vốn đầu của CHÍNH ghế.
    loi: 'Vai quyết VỐN ĐẦU và luật riêng. Hết bàn, ai tăng nhiều % nhất trên vốn đầu của mình thì đứng đầu.',
  },
  {
    id: 'mg-nhip', muc: 'map', shop: false,
    cho: (b) => b.chaoVaiXong !== false || b.vong > 1,
    troi: (b) => b.vong > 1,
    loi: 'Mỗi lần CHỐT lật một ô, rồi tới MỘT chặng: MÀN LÕI hoặc CHỢ TRAIT. Bàn tập 6 ô, năm lần chốt.',
  },
  {
    id: 'mg-mo-shop', muc: 'nut-shop', shop: false, lyDo: false,
    cho: (b) => b.chaoVaiXong !== false || b.vong > 1,
    troi: (b) => b.vong > 1,
    tuXong: (b) => b.shopMo,
    loi: 'Chạm SHOP.',
  },
  {
    // Demo `lenh-1`, vế đầu. Hai lõi trên quầy ghim (`MAN_TAP_LOI_XEN_KE[1]`) ⇒ gọi được tên.
    id: 'mg-loi', muc: 'shop-loi', shop: true, giuShop: true, tam: null,
    cho: (b) => b.loaiVongNay === 'chien_thuat', troi: (b) => b.vong > 1,
    tuXong: (b) => b.chonLoi === true,
    loi: 'Vòng đầu: chọn LÕI — cách bạn giao dịch trong các màn. BẮT ĐÁY chờ giá rơi quá đà; ĐÒN BẨY nhân lãi lỗ, có ký quỹ. '
      + 'Chạm một lá để đọc, rồi LẤY.',
  },
  {
    // Demo `lenh-1`, vế sau.
    id: 'mg-lenh', muc: 'shop-taisan', shop: true, giuShop: true, tam: null,
    troi: (b) => b.vong > 1,
    tuXong: (b) => b.shopCoLenh === true,
    loi: 'Rồi đặt danh mục bằng mốc phần trăm vốn: chạm một mã, rồi một chip.',
  },
  {
    id: 'mg-chot', muc: 'shop-chot', shop: true, tam: null,
    troi: (b) => b.vong > 1,
    tuXong: (b) => b.coKetQua || !b.shopMo,
    loi: 'Bấm CHỐT VÒNG: ô SẮP LẬT lật lên và giá chạy theo nó.',
  },
  {
    // Demo `lat`.
    id: 'mg-lat', muc: 'thi-truong', shop: false, giuShop: true,
    cho: (b) => b.coKetQua, troi: (b) => b.vong > 2,
    keO: { vong: 2, giai_doan: 'giam' },
    noiChieu: [{ giai_doan: 'giam', xuong: ['rui_ro'], len: ['phong_thu'] }],
    loi: 'Ô 2 lật GIẢM — lần thứ hai liền: chợ hay đi thành CHUỖI, đã giảm thì ô kế dễ giảm tiếp. Mọi mã đi theo phần trăm của thẻ (phe '
      + 'RỦI RO rơi, phe PHÒNG THỦ nhích lên) và khoản của bạn đổi theo đúng phần trăm đó.',
  },
  {
    /*
     * D545 — ô 3 còn ÚP mang ⚖: lịch họp công khai, hướng úp. Đứng TRƯỚC chợ trait (shop còn đóng — map không bị che). `duBao`: ô 3 là ô sắp
     * lật của vòng 2. D546 (founder 07/10): *"đừng dạy user là thị trường giảm thì ngân hàng hạ lãi … phản ứng mang tính kích cầu từ phía chính
     * sách … chứ không phải là một quy luật tự động"* ⇒ câu nói chợ giảm PHẢN ÁNH kinh tế yếu, hạ lãi là một LỰA CHỌN chính sách.
     */
    id: 'mg-du-bao-ky-hop', muc: 'map', shop: false, lyDo: false,
    cho: (b) => b.vong === 2, troi: (b) => b.vong > 2,
    keO: { vong: 3, su_kien: 'ha_lai_suat', la_tin_gia: false, duBao: true },
    loi: 'Ô SẮP LẬT mang dấu ⚖: KỲ HỌP của ngân hàng trung ương — lịch họp công khai, quyết định thì úp. Chợ giảm kéo dài phản ánh kinh '
      + 'tế yếu: sản xuất chững lại, doanh nghiệp thiếu đơn hàng. Để kích cầu, ngân hàng thường cân nhắc HẠ LÃI — một lựa chọn chính sách, '
      + 'chứ chẳng tự động xảy ra.',
  },
  {
    // Demo `T-1`. Chợ nằm ở MÀN CHỌN của shop (D430/D432) ⇒ trợ lý mở shop và rọi chợ.
    id: 'mg-trait', muc: 'cho-trait', shop: true, giuShop: true, tam: null, tiep: true,
    cho: (b) => b.coChoTrait === true, troi: (b) => b.vong > 2,
    loi: 'CHỢ TRAIT: ba TÀI, ba TRAIT. Tài cộng điểm, trait trừ điểm — phần lấy về đúng CÂN 0 mới chốt được. '
      + 'Xu dùng để đổi chợ. Chạm một lá để đọc luật.',
  },
  {
    /*
     * D545 — ⚖ KỲ HỌP vừa lật: HẠ LÃI SUẤT. AI hưởng: ma trận đang chạy (`noiChieu`, bài V canh) — rủi ro lên, trái phiếu đang cầm lên giá.
     * D546 (founder 07/10): *"Phần hạ lãi phải nói là tiền chảy vào nền kinh tế"* — và hạ lãi là kích cầu, không phải phản xạ tự động.
     */
    id: 'mg-ky-hop', muc: 'lai-suat', shop: false, lyDo: false,
    cho: (b) => b.vong === 3, troi: (b) => b.vong > 3,
    keO: { vong: 3, su_kien: 'ha_lai_suat', la_tin_gia: false },
    hinh: { loai: 'su_kien', id: 'ha_lai_suat' },
    noiChieu: [{ su_kien: 'ha_lai_suat', len: ['rui_ro', 'tpcp'] }],
    loi: '⚖ KỲ HỌP vừa lật: HẠ LÃI SUẤT — ngân hàng chọn kích cầu. Vay rẻ đi, gửi tiết kiệm lãi ít đi: TIỀN CHẢY VÀO NỀN KINH TẾ, một '
      + 'phần chảy sang phe RỦI RO, và Trái phiếu đang lưu hành lên giá. Chip 🏦 ghi mức lãi mới.',
  },
  {
    /*
     * ⭐ D454 — founder 29/09: *"trước khi oracle dừng hướng dẫn ở trong màn chơi (sau khi thẻ hạ lãi mở) thì cũng nên cảnh báo user là tiền
     * rẻ sẽ tạo ra lạm phát và ngân hàng sẽ cân bằng lại trước khi nó đi quá xa, tiền không thể rẻ mãi"*. Vế đối của `mg-ky-hop` ngay trên,
     * đứng TRƯỚC `mg-tu-choi` (chỗ Oracle thôi dắt). Câu giữ nguyên chữ founder (10/10 chọn, không làm mềm theo D546); khớp `mg-bong-bong`
     * ("ngân hàng TĂNG lãi để dập"). Không nói tỷ lệ, không nói mua bán gì (A11.10). Không kèm hình lá: bàn tập không có lá LẠM PHÁT.
     */
    id: 'mg-tien-khong-re-mai', muc: 'lai-suat', shop: false, lyDo: false,
    cho: (b) => b.vong === 3, troi: (b) => b.vong > 3,
    loi: 'Nhưng tiền không rẻ mãi: vay dễ lâu ngày thì giá cả leo — LẠM PHÁT. Ngân hàng sẽ cân bằng lại, nâng lãi '
      + 'trước khi nó đi quá xa.',
  },
  {
    /*
     * D545 — HẾT DẮT TAY (founder: "chỉ nên hướng dẫn đến khi user đủ kiến thức để tự chơi … sau đó delphi chỉ đóng vai trò giải thích cái gì
     * đang xảy ra"). Từ đây mỗi bước chỉ còn kể ô vừa lật.
     */
    id: 'mg-tu-choi', muc: null, shop: false, lyDo: false,
    cho: (b) => b.vong === 3, troi: (b) => b.vong > 3,
    loi: 'Từ vòng này bạn tự chơi. Mình chỉ lên tiếng khi một ô lật — nói nó là gì và vì sao chợ đi như vậy. Gặp chữ lạ thì mở '
      + 'BÁCH KHOA ở sảnh.',
  },
  {
    // Sau màn đầu (vòng 2): kết quả vòng đã gồm phần màn.
    id: 'mg-vi-sao', muc: 'vi-sao', shop: false, giuShop: true,
    cho: (b) => b.coKetQua && b.vong === 3, troi: (b) => b.vong > 3,
    tuXong: (b) => b.moLyDo === true,
    loi: 'Số % neon đã gồm phần MÀN LÕI. Chạm nó để xem VÌ SAO — phần của màn đứng riêng một dòng.',
  },
  {
    // D545 — ô 4 PHỤC HỒI: tiền rẻ của kỳ họp kéo chợ dậy (ma trận: rủi ro lên, phòng thủ lùi).
    id: 'mg-phuc-hoi', muc: 'thi-truong', shop: false, lyDo: false,
    cho: (b) => b.vong === 4 && b.coKetQua, troi: (b) => b.vong > 4,
    keO: { vong: 4, giai_doan: 'phuc_hoi' },
    noiChieu: [{ giai_doan: 'phuc_hoi', len: ['rui_ro'], xuong: ['phong_thu'] }],
    loi: 'Ô 4 lật: PHỤC HỒI. Tiền rẻ từ kỳ họp kéo chợ dậy — phục hồi là chợ lấy lại phần đã mất sau chuỗi giảm: phe RỦI RO lên, phe '
      + 'PHÒNG THỦ lùi.',
  },
  {
    // Demo `T-3`.
    id: 'mg-trait-2', muc: 'cho-trait', shop: true, giuShop: true, tam: null, tiep: true,
    cho: (b) => b.coChoTrait === true && b.vong === 4, troi: (b) => b.vong > 4,
    loi: 'Chợ thứ hai. Trait mang tới hết trận — chúng đổi cách bạn chơi màn.',
  },
  {
    /*
     * D545 — ô 5 BONG BÓNG: tiền rẻ kéo dài ⇒ vay để mua ⇒ giá bị thổi quá giá trị. D546 (founder 07/10: *"giải thích nốt ô bong bóng"*) — lời
     * khớp engine: đám đông vay mua dày lên trong ô bong bóng (`muc_minigame.ts` — sàn thanh lý chồng nhau); ô sau bong bóng kéo hai đường vỡ
     * cân nhau: cú sốc (`MT_SU_KIEN_KE_TIEP.bong_bong` — thiên nga đen, hack sàn…) hoặc ngân hàng TĂNG lãi để dập (`MT_KE_TIEP_MO_RONG`).
     */
    id: 'mg-bong-bong', muc: 'thi-truong', shop: false, lyDo: false,
    cho: (b) => b.vong === 5 && b.coKetQua, troi: (b) => b.vong > 5,
    keO: { vong: 5, su_kien: 'bong_bong' },
    hinh: { loai: 'su_kien', id: 'bong_bong' },
    noiChieu: [{ su_kien: 'bong_bong', len: ['rui_ro'], xuong: ['phong_thu'] }],
    loi: 'BONG BÓNG vừa lật: tiền rẻ kéo dài, người ta vay để mua chỉ vì giá đang lên — giá phe RỦI RO bị thổi quá giá trị thật, phe '
      + 'PHÒNG THỦ bị bỏ lại. Càng nhiều người vay mua, giá quay đầu là lệnh thanh lý nổ dây chuyền. Bong bóng chưa vỡ thì còn phồng; vỡ '
      + 'vì một cú sốc, hoặc vì ngân hàng TĂNG lãi để dập.',
  },
  {
    id: 'mg-cuoi', muc: 'map', shop: false, lyDo: false,
    cho: (b) => b.vong === 5, troi: (b) => b.vong > 5,
    loi: 'Vòng cuối: chốt xong là màn lõi cuối, rồi tới bảng xếp hạng.',
  },
  {
    // Demo `het`.
    id: 'mg-het', muc: null, ket: true,
    // D550 — trận thật 14 ô (khoá v63).
    loi: 'Hết bàn tập. Trận thật dài 14 ô, cùng nhịp này: màn lõi xen chợ trait, và có đồng hồ từ vòng 1. Về sảnh, mình chỉ bạn chỗ tra cứu.',
  },
];

/* ═══════════════════════════ CHỌN BƯỚC — HÀM THUẦN ═══════════════════════════ */

export interface KetQuaChon {
  /** Bước đang tới lượt. null = không bước nào ⇒ Oracle đứng ở dạng thu gọn. */
  buoc: Buoc | null;
  /** Id cần ghi vào sổ đã-qua ở bối cảnh này (hết hạn, hoặc người chơi đã làm xong). */
  ghi: string[];
}

/**
 * CHỌN BƯỚC — đọc sổ đã-qua + bối cảnh, trả bước tới lượt. Không state, không hiệu
 * ứng: component và bài canh dòng thời gian gọi CÙNG một hàm.
 *
 * Luật:
 *  · Bước trong sổ ⇒ bỏ. Bước `ket` chỉ chạy khi trận xong; bước giữa trận hết hạn khi trận xong.
 *  · `troi` đúng ⇒ hết hạn.
 *  · MẠCH KỂ: bước đầu tiên chưa qua. `tuXong` đúng ⇒ xong luôn (kể cả khi `cho` đang
 *    sai — cú bấm tắt sân khấu vẫn là xong việc) và xét bước kế. `cho` sai ⇒ mạch kể
 *    CHỜ ở đây: không bước sau nào của mạch được vượt lên.
 *    ⚠ Bước KỂ CHUYỆN theo ô (`keO`) chỉ được `tuXong` sau khi ĐÃ HIỆN (`daHien`): người
 *    tự mở chip 🏦 từ vòng 1 không được mất luôn câu "ngân hàng HẠ LÃI" ở vòng 4 (bài
 *    dòng thời gian, kiểu "làm trước khi được bảo", bắt ca này).
 *  · KHI XẢY RA: bước đầu tiên chưa qua có `cho` đúng; chỉ được hiện khi mạch kể rảnh.
 *    `tuXong` của làn này cũng chỉ tính sau khi ĐÃ HIỆN (D336 lượt 2): bước kể chuyện vừa xảy ra
 *    mà việc đã làm sẵn thì vẫn phải nói, không được xoá im. Và tấm VÌ SAO đang mở thì làn này chỉ
 *    được XONG, không được HIỆN — không đè khung thoại lên thứ người chơi vừa mở để đọc.
 *  ⚠⚠ `daHien` = bước đã hiện LÚC VIỆC CỦA NÓ CHƯA XONG — không phải "đã hiện" trơn. Bước hiện ra
 *    khi việc đã xong sẵn mà tính là đã hiện thì lượt chọn kế tiếp xoá nó ngay: khung thoại nháy một
 *    khung hình rồi biến (D336 lượt 2). Bước ấy đứng lại với nút TIẾP.
 */
export function chonBuoc(
  kichBan: readonly Buoc[], daQua: ReadonlySet<string>, b: BoiCanhTap,
  daHien: ReadonlySet<string> = new Set(),
): KetQuaChon {
  const ghi: string[] = [];
  let chinh: Buoc | null = null;
  let chinhDung = false;
  let khi: Buoc | null = null;
  for (const buoc of kichBan) {
    if (daQua.has(buoc.id)) continue;
    if ((buoc.ket === true) !== (b.xong === true)) {
      if (b.xong === true) ghi.push(buoc.id);
      continue;
    }
    if (buoc.troi?.(b)) { ghi.push(buoc.id); continue; }
    if (buoc.lan === 'khi') {
      // ⚠ `tuXong` của làn này chỉ tính khi chuyện ĐÃ XẢY RA (`cho` đúng) VÀ bước đã hiện: mở tấm
      // VÌ SAO ở vòng 2 không được xoá bước "lộ tin giả" của vòng 4, và tấm đang mở sẵn lúc trượt giá
      // nổ không được nuốt câu trượt giá.
      if (khi || !(buoc.cho?.(b) ?? true)) continue;
      if (daHien.has(buoc.id) && buoc.tuXong?.(b)) { ghi.push(buoc.id); continue; }
      /*
       * ⚠ D336 lượt 2 — KHÔNG ĐỨNG ĐÈ LÊN TẤM NGƯỜI CHƠI VỪA MỞ ĐỂ ĐỌC. Đo trên dev vòng 4: mở VÌ SAO là
       * xong bước trượt giá, và ngay khung hình sau bước "lộ tin giả" (cũng làn này) bật lên đè đúng tấm
       * ấy — với người chơi, Oracle vẫn "không ẩn". Tấm mở thì làn này chỉ được XONG, không được HIỆN;
       * tấm đóng thì bước còn dở quay lại.
       */
      if (b.moLyDo === true) continue;
      khi = buoc;
      continue;
    }
    if (chinh || chinhDung) continue;
    if ((buoc.keO === undefined || daHien.has(buoc.id)) && buoc.tuXong?.(b)) { ghi.push(buoc.id); continue; }
    if (buoc.cho?.(b) ?? true) chinh = buoc;
    else chinhDung = true;
  }
  return { buoc: chinh ?? khi, ghi };
}

/**
 * GỢI Ý THU GỌN — dòng Oracle nói khi không bước nào tới lượt. Chỉ tả CHỖ BẤM và
 * VIỆC CỦA MÀN (A10: không nói nên mua gì, không nói nên chốt hay giữ).
 */
export function goiY(b: BoiCanhTap): string {
  if (b.xong) return 'Bàn tập xong — về sảnh, mình chỉ bạn chỗ tra cứu.';
  if (b.toMo) return 'Đọc xong thì đóng tờ bằng ✕.';
  // Bước `mo-bang` hứa "xem DƯ ÂM" — chỗ ấy là SỔ CÁI DƯ ÂM ở tận cuối bảng (bấm mở).
  if (b.bangDangMo) return 'DƯ ÂM nằm ở SỔ CÁI cuối bảng. Đọc xong thì đóng ✕.';
  if (b.kyNgoMo) return 'Chọn một con đường, hoặc BỎ QUA.';
  if (b.moLyDo) return 'Đọc xong thì bấm ẨN LÝ DO để cất.';
  if (b.tamMo === 'bank') {
    return b.chonGui ? 'Đã chọn kỳ — tiền chỉ vào sổ khi bạn CHỐT VÒNG.' : 'Chọn kỳ hạn, hoặc đóng ngân hàng.';
  }
  const vongLoi = b.loaiVongNay === 'chien_thuat' && b.chonLoi !== true;
  if (b.shopMo) {
    if (vongLoi) return 'Vòng lõi: chạm một lá lõi rồi LẤY, xong thì CHỐT VÒNG.';
    if (b.shopCoLenh) return 'Còn đổi được lệnh. Xong thì CHỐT VÒNG.';
    return 'Chạm một mã rồi một chip — hoặc CHỐT để giữ nguyên.';
  }
  if (vongLoi) return 'Vòng lõi: mở SHOP để chọn một lõi.';
  if (b.vongTamDungDen !== undefined && b.vong > b.vongTamDungDen) {
    return 'Đồng hồ đang chạy — mở SHOP hoặc CHỐT VÒNG.';
  }
  return 'Mở SHOP để đặt lệnh, hoặc CHỐT VÒNG.';
}

/* ═══════════════════════════ SỔ ĐÃ-QUA — lưu theo trận ═══════════════════════ */

interface SoLuu { daQua: string[]; tat: boolean }
const tenLuu = (khoa: string) => `delphi:coach:${khoa}`;
function docLuu(khoa?: string | null): SoLuu | null {
  if (!khoa) return null;
  try {
    const raw = window.sessionStorage.getItem(tenLuu(khoa));
    const v = raw ? JSON.parse(raw) as Partial<SoLuu> : null;
    return v && Array.isArray(v.daQua) ? { daQua: v.daQua.filter((x) => typeof x === 'string'), tat: v.tat === true } : null;
  } catch { return null; }
}
function ghiLuu(khoa: string | null | undefined, so: SoLuu): void {
  if (!khoa) return;
  try { window.sessionStorage.setItem(tenLuu(khoa), JSON.stringify(so)); } catch { /* chế độ riêng tư */ }
}

/** Chữ chạy như đang nói — chạm khung là hiện trọn câu (bấm để tua). */
function useChuChay(chuoi: string, tatHieuUng: boolean) {
  const [n, setN] = useState(0);
  useEffect(() => {
    if (tatHieuUng || chuoi.length === 0) { setN(chuoi.length); return undefined; }
    setN(0);
    /*
     * ⚠ 15/09 — DỪNG khi đã gõ xong. Bản v3 để interval 28 ms chạy mãi: ở vòng 10 bộ
     * đếm đọc ra 3.466 cho một câu ~80 ký tự ⇒ trợ lý vẽ lại ~36 lần/giây suốt trận,
     * kể cả lúc ẩn.
     */
    const t = setInterval(() => {
      setN((x) => {
        const y = x + 2;
        if (y >= chuoi.length) clearInterval(t);
        return y;
      });
    }, 28);
    return () => clearInterval(t);
  }, [chuoi, tatHieuUng]);
  const xong = n >= chuoi.length;
  return { chu: xong ? chuoi : chuoi.slice(0, n), xong, tua: () => setN(chuoi.length) };
}

/** Neo nằm ngoài khung nhìn (trên hoặc dưới) — phải cuộn lại, không đặt thẻ theo nó. */
const ngoaiKhung = (r: DOMRect) => r.bottom < 0 || r.top > window.innerHeight;

const TEN_PHE = { rui_ro: 'RỦI RO', phong_thu: 'PHÒNG THỦ' } as const;

/**
 * DẢI HAI PHE (D336 lượt 2) — sáu mã chia hai phe; có `suKien` thì dưới mỗi mã là mũi tên MỨC của tờ
 * (!) khi tin ấy lật (▲▲ rất khoẻ … ▼▼ rất yếu — `MUC_DINH_TINH`, cùng thang tờ (!) và bách khoa).
 * Hình trước chữ: người chơi nhận mã bằng art đã thấy trên quầy, không phải đọc sáu cái tên.
 * ⚠ Không số (founder 25/07: "+/- bao nhiêu % thì game sẽ bị dễ đoán") và không tự suy: mức đọc từ
 * `tu_dien` server đã cắt bp. Mã thiếu mức ⇒ "trung tính" — đúng nghĩa ô ma trận bằng 0.
 */
function DaiHaiPhe({ la, suKien, tuDien }: {
  la: NonNullable<BoiCanhTap['taiSanTap']>;
  suKien: string | null;
  tuDien: BoiCanhTap['tuDienTap'];
}) {
  const mucCua = (ma: string): MucDinhTinhDTO => (
    tuDien?.[ma]?.su_kien?.find((c) => c[0] === suKien)?.[1] ?? 'trung_tinh'
  );
  return (
    <div className={s.haiPhe} data-hinh={suKien ?? 'phe'}>
      {(['rui_ro', 'phong_thu'] as const).map((phe) => (
        <div key={phe} className={s.phe} data-phe={phe}>
          <span className={s.pheTen}>{TEN_PHE[phe]}</span>
          <span className={s.pheHang}>
            {la.filter((t) => t.nhom === phe).map((t) => {
              const m = suKien ? MUC_DINH_TINH[mucCua(t.id)] : null;
              const ten = m ? `${t.label}: ${m.chu}` : t.label;
              return (
                <span key={t.id} className={s.pheLa} role="img" aria-label={ten} title={ten} data-ma={t.id}>
                  {/* eslint-disable-next-line react/no-danger -- SVG hằng số trong repo (`/holdem/art`) */}
                  <span className={s.pheHinh} dangerouslySetInnerHTML={htmlTinh(t.svg ?? '')} />
                  {m && <b className={`${s.pheMuc} ${s[`muc_${m.lop}`] ?? ''}`}>{m.dau}</b>}
                </span>
              );
            })}
          </span>
        </div>
      ))}
    </div>
  );
}

export function CoachTap(b: BoiCanhTap) {
  const itMotion = useReducedMotion();
  const [so, setSo] = useState<SoLuu>(() => docLuu(b.khoaLuu) ?? { daQua: [], tat: false });
  const daQua = new Set(so.daQua);
  /** Bước đã từng hiện trong phiên này — xem luật `keO` của `chonBuoc`. */
  const [daHien, setDaHien] = useState<ReadonlySet<string>>(() => new Set());
  // D527 — trận tập khung minigame nghe kịch bản minigame; trận tập v54 còn dở nghe kịch bản cũ.
  const { buoc, ghi } = chonBuoc(b.minigame ? KICH_BAN_MINIGAME : KICH_BAN, daQua, b, daHien);
  const ghiKey = ghi.join('|');

  /* Ghi ĐÍCH DANH vào sổ — không `x + 1`, nên hai hiệu ứng cùng chạy cũng không nhảy hai bước. */
  useEffect(() => {
    if (ghi.length === 0) return;
    setSo((cu) => {
      const moi = ghi.filter((id) => !cu.daQua.includes(id));
      return moi.length === 0 ? cu : { ...cu, daQua: [...cu.daQua, ...moi] };
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ghiKey]);
  useEffect(() => { ghiLuu(b.khoaLuu, so); }, [so, b.khoaLuu]);

  const xongBuoc = (id: string) => setSo((cu) => (cu.daQua.includes(id) ? cu : { ...cu, daQua: [...cu.daQua, id] }));

  /*
   * HIỆN KHUNG THOẠI khi có bước và sân khấu cho phép. Tờ (!) mở ⇒ nhường chỗ (tờ nằm
   * trong ngữ cảnh xếp lớp của shop, z-index không cứu được — 12/09). Bảng điện tử
   * (z-index 85) nằm trên trợ lý ⇒ cũng nhường.
   */
  const choPhepThe = !so.tat && !b.sanKhau && b.toMo !== true && b.bangDangMo !== true;
  const hienThe = !!buoc && choPhepThe;
  /*
   * Dạng thu gọn: mọi lúc còn lại, trừ lúc sân khấu diễn, lúc màn chia vai đang dựng
   * (khung hình trước khi nó báo pha — không để một dòng gợi ý lóe lên đè màn ấy), và
   * sau lời chào màn kết.
   */
  const hienDock = !hienThe && !b.sanKhau && !(b.xong && daQua.has('het'))
    && !(b.chaoVaiXong === false && b.vong === 1);

  const goi = useChuChay(hienThe && buoc ? loiCuaBuoc(buoc, b) : '', itMotion);

  /*
   * ĐO LƯỜNG (§2.3 `huong_dan_buoc`) — ghi lúc VÀO từng bước, mỗi bước một lần.
   * `daHien` chỉ nhận bước hiện LÚC VIỆC CHƯA XONG (xem `chonBuoc`): việc đã xong sẵn thì bước đứng
   * lại với nút TIẾP; người chơi cất việc ấy đi (đóng tấm) thì lúc đó mới tính là đã hiện.
   */
  const daGhiDo = useRef<Set<string>>(new Set());
  const viecDaXong = !!(hienThe && buoc?.tuXong?.(b));
  useEffect(() => {
    if (!hienThe || !buoc) return;
    if (!daGhiDo.current.has(buoc.id)) {
      daGhiDo.current.add(buoc.id);
      ghiDo('huong_dan_buoc', { chi_tiet: { buoc: buoc.id } });
    }
    if (!viecDaXong) setDaHien((cu) => (cu.has(buoc.id) ? cu : new Set([...cu, buoc.id])));
  }, [hienThe, buoc, viecDaXong]);

  /* Dàn cảnh shop — lúc vào bước; bước `giuShop` giữ suốt bước (deps có `shopMo`). */
  const { onMoShop } = b;
  useEffect(() => {
    if (!hienThe || buoc?.shop === undefined) return;
    if (buoc.shop !== b.shopMo) onMoShop(buoc.shop);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [buoc?.id, hienThe, buoc?.giuShop === true ? b.shopMo : null]);

  /* Dàn cảnh TẤM VÌ SAO — enforce suốt bước. */
  const { onMoLyDo } = b;
  useEffect(() => {
    if (!hienThe || buoc?.lyDo === undefined || onMoLyDo === undefined) return;
    if (buoc.lyDo !== (b.moLyDo === true)) onMoLyDo(buoc.lyDo);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [buoc?.id, hienThe, b.moLyDo]);

  /* D321 — dàn cảnh TẤM TRƯỢT trong shop. */
  const { onMoTam } = b;
  useEffect(() => {
    if (!hienThe || buoc?.tam === undefined || onMoTam === undefined) return;
    if ((b.tamMo ?? null) !== buoc.tam) onMoTam(buoc.tam);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [buoc?.id, hienThe, b.tamMo]);

  /*
   * ĐO KHUNG phần tử đích theo nhịp 300 ms (màn trận có hoạt hình + cuộn + shop trượt,
   * liệt kê đủ nguồn dịch chuyển là không thể — polling rẻ và không sót).
   *
   * LƯỚI CHỐNG KẸT (12/09): neo vắng hoặc bị che hai nhịp liền ⇒ mở nút đi tiếp.
   * ⚠ 15/09 — "bị che" không tính chính trợ lý: thẻ thoại bấm được (`pointer-events:
   * auto`), đậu đè lên neo là `elementFromPoint` trả về nó, và lưới mời người chơi bỏ
   * đúng thao tác đang dạy (đo được ở bước chip 25%).
   */
  const mucHienTai = hienThe ? buoc?.muc ?? null : null;
  const [khung, setKhung] = useState<DOMRect | null>(null);
  const [neoMat, setNeoMat] = useState(false);
  const demMat = useRef(0);
  useEffect(() => {
    demMat.current = 0;
    setNeoMat(false);
    if (!mucHienTai) { setKhung(null); return undefined; }
    let soLanCuon = 0;
    const do_ = () => {
      const el = document.querySelector(`[data-tap="${mucHienTai}"]`);
      if (!el) {
        setKhung(null);
        demMat.current += 1;
        if (demMat.current >= 2) setNeoMat(true);
        return;
      }
      const r = el.getBoundingClientRect();
      // Neo ngoài khung nhìn ⇒ cuộn lại (cả khi nó trôi ra SAU lần cuộn đầu — màn trận có
      // đường tự cuộn riêng tới khối kết quả; 15/09 đo được thẻ thoại đặt ở −53 px). Có trần:
      // neo nằm trong khối cố định trượt khỏi màn thì cuộn trang không cứu được.
      if (soLanCuon === 0 || (ngoaiKhung(r) && soLanCuon < 4)) {
        soLanCuon += 1;
        el.scrollIntoView?.({ block: 'center', behavior: itMotion ? 'auto' : 'smooth' });
      }
      const tren = typeof document.elementFromPoint === 'function' && r.width > 0 && r.height > 0
        && !ngoaiKhung(r)
        ? document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2)
        : null;
      const biChe = tren !== null && tren !== el && !el.contains(tren) && !tren.contains(el)
        && !(tren as Element).closest?.('[data-coach]');
      if (biChe) {
        demMat.current += 1;
        if (demMat.current >= 2) setNeoMat(true);
      } else {
        demMat.current = 0;
        setNeoMat(false);
      }
      setKhung(ngoaiKhung(r) ? null : r);
    };
    do_();
    const t = setInterval(do_, 300);
    return () => clearInterval(t);
  }, [mucHienTai, itMotion]);

  /* Vị trí dạng thu gọn — đo cụm nút đáy màn, đặt ở chỗ không chắn tay. */
  const [dockViTri, setDockViTri] = useState<CSSProperties>({ bottom: 12 });
  const dockLenTren = b.toMo === true || b.moLyDo === true || b.bangDangMo === true || b.tamMo === 'bank' || b.shopMo === true;   // D540 — shop: neo trên
  useEffect(() => {
    if (!hienDock) return undefined;
    const CAO_DOCK = 52;
    const do_ = () => {
      if (dockLenTren) { setDockViTri({ top: 10 }); return; }
      const cum = document.querySelector(
        b.shopMo ? '[data-tap="shop-lenh"], [data-tap="shop-chot"]' : '[data-tap="tay"]',
      );
      if (!cum) { setDockViTri({ bottom: 12 }); return; }
      const r = cum.getBoundingClientRect();
      const duoi = window.innerHeight - r.bottom;
      setDockViTri(!b.shopMo && duoi >= CAO_DOCK + 16
        ? { top: Math.round(r.bottom + 8) }
        : { bottom: Math.round(window.innerHeight - r.top + 8) });
    };
    do_();
    const t = setInterval(do_, 400);
    return () => clearInterval(t);
  }, [hienDock, dockLenTren, b.shopMo]);

  /*
   * D376 — nhãn đọc `vongNhan` nếu nơi gọi có truyền: lúc người chơi đang đọc kết quả, cả màn
   * phải nói CÙNG một vòng (vòng vừa đóng), chứ không phải tấm báo vòng 4 còn nhãn báo vòng 5.
   * ⚠ `b.vong` KHÔNG đổi — nó lái bước dạy. Trộn hai vai là bước dạy chạy lại.
   */
  const vongNhan = b.vongNhan ?? b.vong;
  const nhan = b.tongVong ? `ORACLE · VÒNG ${Math.min(vongNhan, b.tongVong)}/${b.tongVong}` : 'ORACLE';
  // Bảng điện tử (z-index 85) nằm trên lớp phủ gốc (80) — dạng thu gọn phải nổi lên trên nó.
  const zGoc: CSSProperties | undefined = b.bangDangMo ? { zIndex: 86 } : undefined;

  if (hienDock) {
    return (
      <div className={s.phuTap} style={zGoc} data-coach aria-live="polite">
        <div className={s.dock} style={dockViTri} data-dock={dockLenTren ? 'tren' : 'duoi'}>
          <span className={s.dockLinhVat} aria-hidden>
            <Mascot size={30} glow bay={!itMotion} />
          </span>
          <span className={s.dockChu}>
            <span className={s.nhan}>{nhan}</span>
            <span className={s.dockLoi}>{so.tat ? 'Oracle đang ngồi yên.' : goiY(b)}</span>
          </span>
          {so.tat && !b.xong && (
            <button type="button" className={s.dockNut} onClick={() => setSo((cu) => ({ ...cu, tat: false }))}>
              DẮT TIẾP ▸
            </button>
          )}
        </div>
      </div>
    );
  }

  if (!hienThe || !buoc) return null;

  const coLo = buoc.muc !== null && khung !== null;
  /*
   * KHUNG THOẠI BÁM SÁT Ô ĐANG RỌI (12/09) — thứ quyết định là KHOẢNG TRỐNG hai bên,
   * không phải tâm lỗ (bài học 03/08). Ô quá cao ⇒ về mép màn, bên rộng hơn.
   * ⚠ `KHE_DUOI` rộng hơn `KHE_TREN` vì Oracle nhô 30px khỏi mép thẻ.
   * ⚠ 15/09 — KẸP TRONG KHUNG NHÌN: thẻ đặt `top` thì không cao hơn `MEP_TREN` (chừa
   * đầu cho linh vật), đặt `bottom` thì không thấp hơn mép dưới.
   */
  // Dải hai phe cao thêm ~56px — đo trên 390px (D336 lượt 2). Đặt thấp hơn thật là thẻ đè lên ô rọi.
  const coHinh = !!buoc.hinh && (b.taiSanTap?.length ?? 0) > 0;
  const CAO_THOAI = coHinh ? 250 : 190;
  const KHE_DUOI = 34;
  const KHE_TREN = 12;
  const MEP_TREN = 40;
  const tren = coLo ? khung!.top : 0;
  const duoi = coLo ? window.innerHeight - (khung!.top + khung!.height) : 0;
  // D540 (founder 06/10: "Delphi luôn neo phía trên khung") — shop mở ⇒ thẻ thoại KHÔNG BAO GIỜ đậu dưới: đáy shop là chỗ của tay (lệnh đã
  // xếp · CHỐT), và phiếu lệnh mọc trong lưới giữa màn. Đậu dưới từng che đúng hàng chip (bàn tập vòng 1, máy founder).
  const trongShop = b.shopMo === true;
  const duDuoi = !trongShop && coLo && duoi >= CAO_THOAI + KHE_DUOI;
  const duTren = !trongShop && coLo && tren >= CAO_THOAI + KHE_TREN + MEP_TREN;   // D540 — shop: luôn dải gọn ở mép trên (`theShop`)
  const viTri: CSSProperties | undefined = duDuoi
    ? { top: Math.max(MEP_TREN, Math.round(khung!.top + khung!.height + KHE_DUOI)) }
    : duTren
      ? { bottom: Math.max(8, Math.round(window.innerHeight - khung!.top + KHE_TREN)) }
      : undefined;
  const chuDuoi = !trongShop && (!coLo || duoi >= tren);
  // Việc đã xong sẵn lúc bước hiện (chỉ bước `keO`/làn khi-xảy-ra còn đứng được ở đó) ⇒ không còn cú
  // bấm nào làm bước tự xong nữa, nên phải có TIẾP — không thì kẹt.
  const coNutTiep = !buoc.tuXong || buoc.tiep === true || neoMat || viecDaXong;
  const laCuoi = buoc.id === 'het';

  return (
    <div className={s.phuTap} data-coach aria-live="polite">
      {coLo ? (
        <div
          className={s.lo}
          style={{
            left: khung!.left - 4, top: khung!.top - 4,
            width: khung!.width + 8, height: khung!.height + 8,
          }}
          aria-hidden
        />
      ) : (
        <div className={s.mangToan} aria-hidden />
      )}

      {/* Khung TRÒ CHUYỆN — bấm vào khung để TUA hết câu (chuẩn hộp thoại game). */}
      <div
        className={`${s.the} ${trongShop ? s.theShop : viTri ? s.theBam : (chuDuoi ? s.theDuoi : s.theTren)}`}
        {...(viTri ? { style: viTri } : {})}
        data-bam={viTri ? (duDuoi ? 'duoi' : 'tren') : 'mep'}
        data-buoc={buoc.id}
        role="dialog"
        onClick={() => { if (!goi.xong) goi.tua(); }}
      >
        <span className={s.linhVat} aria-hidden>
          <Mascot size={44} glow bay={!itMotion} />
        </span>
        <div className={s.dauThe}>
          <span className={s.nhan}>{nhan}</span>
          <button
            type="button"
            className={s.tatNut}
            onClick={(e) => {
              e.stopPropagation();
              // Tắt CHỦ ĐỘNG khác hẳn "đi mất" — cùng một chỗ dừng, hai ý định.
              ghiDo('huong_dan_buoc', { chi_tiet: { buoc: 'tat-tro-ly' } });
              // D336 lượt 2 — BỎ QUA là bỏ qua màn tập: vào Đấu trường lần sau không bị dắt vào đây nữa.
              danhDauQuaManTap('bo_qua');
              setSo((cu) => ({ ...cu, tat: true }));
            }}
          >
            BỎ QUA ✕
          </button>
        </div>
        <p className={s.loiChu}>
          {goi.chu}
          {!goi.xong && <span className={s.conTro} aria-hidden>▌</span>}
        </p>
        {coHinh && buoc.hinh && (
          <DaiHaiPhe
            la={b.taiSanTap!}
            suKien={buoc.hinh.loai === 'su_kien' ? buoc.hinh.id : null}
            tuDien={b.tuDienTap}
          />
        )}
        {coNutTiep && (
          <button
            type="button"
            className={s.tiep}
            onClick={(e) => {
              e.stopPropagation();
              if (!goi.xong) { goi.tua(); return; }
              xongBuoc(buoc.id);
            }}
          >
            {!goi.xong ? 'TUA ▸▸' : laCuoi ? 'XONG ▸'
              : neoMat && buoc.tuXong && buoc.tiep !== true && !viecDaXong ? 'BỎ QUA BƯỚC NÀY ▸' : 'TIẾP ▸'}
          </button>
        )}
      </div>
    </div>
  );
}
