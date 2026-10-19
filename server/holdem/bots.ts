/**
 * MARKET HOLD'EM — BOT. Hàm thuần, tất định (rút số qua rngAt).
 *
 * Bot phục vụ HAI việc khác nhau, đừng lẫn:
 *
 *  (1) LẤP GHẾ trong trận người chơi — dùng nhóm 'choi_duoc'.
 *
 *  (2) LÀM THƯỚC ĐO cho Monte Carlo gate. Ba bot tín hiệu dưới đây tồn tại
 *      chỉ để trả lời một câu của D24 mục 17.6:
 *
 *        "đọc tin có phải KỸ NĂNG không, hay chỉ là tung đồng xu?"
 *
 *      Gate đòi: bot TIN MỌI TIN và bot PHỚT MỌI TIN phải CÙNG thua bot HOÀI
 *      NGHI HIỆU CHỈNH. Nếu tin-mọi-tin thắng → tỷ lệ tin giả quá thấp (tin
 *      nào cũng thật thì tin sạch quá, không có gì để hoài nghi). Nếu
 *      phớt-mọi-tin thắng → tín hiệu quá yếu hoặc tin giả quá nhiều, đọc tin
 *      thành vô ích. Cả hai trường hợp đều làm hỏng biến hành vi đắt nhất mà
 *      cơ chế này đẻ ra (17.4), nên đây là gate CHẶN DEPLOY chứ không phải
 *      chỉ số tham khảo.
 */
import {
  CAN_TROI_BP, CO_VI_THE, GIAI_DOAN, HOLDEM_MATCH, MT_CHIEN_THUAT_SU_KIEN,
  boMaTranCua, mtGiaiDoan, mtSuKien, NHA_CAI, REGIME_TICK, TAI_SAN, TIEN_MAT_SU_KIEN, lechTinhChatBp,
  TIET_KIEM,
  type BoMaTran,
  TY_LE_TIN_GIA_THEO_BOI_CANH,
  TELEGRAPH_V53, doThamSo,
  type ChienThuatId, type GiaiDoanId, type SuKienId,
} from '../../config/holdem.js';
import { tienTuMoc } from './nav.js';
import { TRAIT, type TraitId } from '../../config/trait.js';
import { applyBpInt, idiv, rngAt } from '../sandbox/rng.js';
import type { BoiCanhCuoc, DanhMuc, Ghe, HanhDongVong } from './engine.js';
import { heSoTinTheoNenThuan } from './engine.js';
import type { LoaiHanhDong } from './cuoc.js';
import type { OThiTruong } from './map.js';
import { bayShop, mua, xungDotVoi, type ShopVong } from './shop.js';

/**
 * 'di_von' — họ bot DỤNG CỤ ĐO cho chẩn đoán D35, xem `BOT_DI_VON`.
 *
 * Tách riêng khỏi 'tham_chieu' vì gate Monte Carlo tính `tbChoiDuoc` trên nhóm
 * 'choi_duoc' và đọc từng bot tham chiếu ĐÍCH DANH; một nhãn nhóm mới bảo đảm
 * họ này không bao giờ lọt vào một phép trung bình mà nó không thuộc về.
 */
export type NhomBot = 'tham_chieu' | 'tin_hieu' | 'choi_duoc' | 'di_von';

export interface BoiCanh {
  seed: number;
  vong: number;
  /** Ô vòng này, ĐÃ LỌC cờ tin giả (trừ oracle — xem `oThat`). */
  o: OThiTruong;
  /** Ô thật, KHÔNG lọc. Chỉ oracle được đọc. */
  oThat: OThiTruong;
  /** Ô trước, nếu là sự kiện thì nó telegraph cho vòng này. */
  oTruoc: OThiTruong | undefined;
  ghe: Ghe;
  shop: ShopVong;
  /** v33 — nhịp giãn (D90 M1): bot roll lại shop phải tra CÙNG bảng ghim với người. */
  gianLa?: boolean;
  /** D498 — Tổ Chức khung minigame không margin: quầy cuộn lại (khảo sát) cũng bỏ Đòn Bẩy. */
  camDonBay?: boolean;
  /** v54 (D389) — lõi gọn: bot roll lại shop trên CÙNG kệ đã bỏ năm lõi bị động như người. */
  loiGon?: boolean;
  soNguoiSong: number;
  /**
   * Trần SỐ MÃ giữ đồng thời của CHÍNH ghế này. Vắng ⇒ `HOLDEM_MATCH.MAX_TAI_SAN`.
   *
   * ⚠ TỒN TẠI VÌ ĐẶC QUYỀN ĐA DẠNG HOÁ NỚI TRẦN (v8). Trước đó ba nhánh chọn lá
   * dưới đây đọc thẳng hằng số, nên bot KHÔNG BAO GIỜ dùng tới ô thứ 5 — và hệ
   * quả không phải "bot chơi hơi dở" mà là ĐẶC QUYỀN KHÔNG ĐO ĐƯỢC: Monte Carlo
   * chấm một lá mà không con bot nào thật sự hưởng. Đúng bài học D5 ("thẻ không
   * ai cầm") và D2 (gate cắt lỗ đo trên đàn bot chưa con nào biết bỏ).
   *
   * TUỲ CHỌN chứ không bắt buộc: 7 chỗ dựng `BoiCanh` (2 trong API, 5 trong
   * script đo) và chỗ nào không truyền thì nhận đúng hằng số cũ ⇒ trận đã lưu
   * replay ra y nguyên. Ép bắt buộc là buộc mọi script đo phải sửa cùng lúc.
   */
  maxTaiSan?: number;
  /**
   * v28 — tỷ lệ tin giả HIỆU DỤNG (bp) của ô TRƯỚC (`oTruoc`), tức cái tin mà
   * bot hoài-nghi đang phải chiết khấu ở nhịp CHỌN LÁ.
   *
   * ⚠⚠ VÌ SAO CẦN (rà soát 11/08 — lỗi trong DỤNG CỤ ĐO). Bot hoài-nghi có
   * BA kênh dùng tỷ lệ tin giả: `heSoTin` (chấm điểm mã) đã đọc tỷ lệ hiệu
   * dụng v28 từ D71; còn `phanBoDuDoan` (chọn lá) và `heSoNiemTinDauBp` (cỡ
   * cam kết) vẫn dùng `NHA_CAI.TY_LE_TIN_GIA_BP` PHẲNG 35%. Mà từ v28 tỷ lệ
   * thật chạy 5%–80% theo loại sự kiện × môi trường tiền tệ.
   *
   * Hậu quả đúng vào G4 — gate đo "đọc tin có phải kỹ năng không": bot mang
   * tên HOÀI NGHI đang hoài nghi SAI MỨC ở hai trong ba kênh, nên gate chấm
   * một con bot không hoài nghi đúng thứ nó được đặt tên. Sửa THƯỚC trước,
   * đo lại, rồi mới chạm tham số (bài học D56 — chỉnh mù đốt cả một phiên).
   *
   * Vắng ⇒ 35% phẳng như v22–v27, trận cũ replay nguyên.
   */
  tyLeGiaTruocBp?: number;
  /**
   * Như trên nhưng cho ô của CHÍNH VÒNG NÀY (`o`). Hai trường riêng vì hai ô
   * có tỷ lệ khác nhau hẳn (loại sự kiện × môi trường tiền tệ đổi từng ô), và
   * gộp một trường là chiết khấu tin này bằng độ tin của tin kia.
   */
  tyLeGiaBp?: number;
  /**
   * v41 (D307) — LỚP VN: chọn bảng Tài sản×Giai đoạn / Tài sản×Sự kiện qua
   * `mtGiaiDoan`/`mtSuKien`. Vắng ⇒ bảng toàn cầu cũ, trận cũ replay nguyên.
   * Bài học `bangCanTroi`: engine đổi bảng mà bot đọc thẳng hằng số là gate
   * đo chênh lệch hai bảng chứ không đo kỹ năng — không lỗi, không tiếng động.
   */
  bo?: BoMaTran;
  /**
   * v49 (D342) — LÁ BÁN KHỐNG THUẦN QUYỀN: engine gỡ hàng T1 của lá (`MT_CHIEN_THUAT_SU_KIEN
   * .ban_khong`), nên bot chấm điểm lá cũng phải gỡ — không thì bot "Khắc chế" định giá một
   * hiệu ứng không còn tồn tại và gate đo lỗi kế toán chứ không đo kỹ năng (bài học
   * `bangCanTroi`). Vắng ⇒ bảng cũ, trận ≤ v48 replay nguyên.
   */
  banKhongThuanQuyen?: boolean;
  /** v55 (D409) — TÊ LIỆT: vòng này không mua lõi. D473: khung minigame cũng khoá ở vòng không có lượt lõi (`coLuotLoi`). */
  khoaLoi?: boolean;
  /** D473 — trần SỐ LÕI của ghế (`maxLoiCua`). Vắng ⇒ `HOLDEM_MATCH.MAX_CHIEN_THUAT`, trận cũ replay nguyên. */
  maxLoi?: number;
}

/** Trần số lõi của ghế trong bối cảnh này (D473; mặc định = hằng số toàn cục). */
function tranLoi(ctx: BoiCanh): number {
  return ctx.maxLoi ?? HOLDEM_MATCH.MAX_CHIEN_THUAT;
}

/** Trần số mã của ghế trong bối cảnh này (mặc định = hằng số toàn cục). */
function tranMa(ctx: BoiCanh): number {
  return ctx.maxTaiSan ?? HOLDEM_MATCH.MAX_TAI_SAN;
}

export interface Bot {
  id: string;
  label: string;
  nhom: NhomBot;
  /** v10 NAV — mã ưu tiên khi phân bổ tiền (bot cũ không khai thì dàn đều). */
  uu_tien?: readonly string[];
  /**
   * v22 — DANH TÍNH VỐN của bot DỤNG CỤ ĐO. Vắng = đọc bối cảnh như mọi ghế.
   *   'khong' — KHÔNG giao dịch bao giờ (mốc "ngồi im" của G3; nó phải thật
   *             sự ngồi im, không thì G3 đo một con bot đang chơi).
   *   'mu'    — giao dịch MÙ theo vòng (cái SÀN của G2; nó phải thật sự bừa,
   *             không thì sàn bò lên trên đầu nhóm chơi được).
   */
  von_khong_doc?: 'khong' | 'mu';
  /** Trả id thẻ muốn mua, hoặc null = Giữ nguyên (STAND). */
  chonThe(ctx: BoiCanh): string | null;
  chonCamKet(ctx: BoiCanh): HanhDongVong;
  /**
   * Quyết định khi TỚI LƯỢT trong vòng cược tuần tự.
   * Đây là chỗ pot odds và BỊP mới có nghĩa — bản cam-kết-đồng-thời cũ không
   * có lượt nên không con bot nào phải đối mặt với một cú tố.
   */
  chonCuoc(cuoc: BoiCanhCuoc, ctx: BoiCanh): { loai: LoaiHanhDong; them?: number };
  /**
   * v43 (D314) — NGÂN HÀNG: gửi / tất toán sớm ở vòng này. Vắng = bot không dùng ngân
   * hàng (mọi bot cũ, và mọi bot NGƯỜI CHƠI gặp ở mùa này — founder Q12).
   *
   * ⚠ Đây là bot ĐO, không phải bot lấp ghế. Sáu archetype `tk_*` sống ở
   * `BOT_NGAN_HANG` và CHỈ bàn đo mới trộn chúng vào — nhét vào `BOT_CHOI_DUOC` là đổi
   * dàn đối thủ của trận thật, tức đổi hành vi ngoài cổng luật (D80).
   */
  chonTietKiem?(ctx: BoiCanhTietKiem): {
    mo?: { moc_bp: number; so_vong: number }[];
    huy?: string[];
  } | null;
}

/**
 * v43 (D314) — bối cảnh bot cần để quyết gửi/huỷ. Cố ý HẸP: chỉ những gì một người chơi
 * cũng nhìn thấy trên màn. Cấp thêm (ví dụ ô thật của vòng sau) là phát cho bot một máy
 * bói, và mọi số G5 sau đó đo một trò khác.
 */
export interface BoiCanhTietKiem {
  vong: number;
  so_o: number;
  tien_mat: number;
  /** Mốc kỳ hạn còn kịp đáo hạn nếu mở ở vòng này (server tính, `mocKipCua`). */
  moc_kip: readonly number[];
  /** Hợp đồng đang giữ — id + số ô còn lại. */
  dang_giu: readonly { id: string; con_vong: number }[];
  /** Chỉ ORACLE: ô THẬT của vòng này. Dùng cho `tk_huy` — trần trên của quyền huỷ. */
  o_that_tot?: boolean;
}

// ---------------------------------------------------------------------------
// Trợ giúp chung
// ---------------------------------------------------------------------------

/** Danh mục hợp với giai đoạn này tới mức nào (bp, cộng dồn). */
export function diemHopGiaiDoan(dm: DanhMuc, gd: GiaiDoanId, bo: BoMaTran = 'v40'): number {
  let s = 0;
  for (const id of dm.tai_san) s += mtGiaiDoan(bo)[id]?.[gd] ?? 0;
  return s;
}

/**
 * PHÂN BỐ XÁC SUẤT giai đoạn kế (bp, tổng 10.000) — KHÔNG phải một dự đoán đơn.
 *
 * ⚠ Đây là chỗ sửa sau khi Monte Carlo 20/07 cho G4 trượt liên tiếp.
 * Bản đầu: cả `tin` lẫn `hieu_chinh` đều trả MỘT giai đoạn (`bao_truoc`), nên
 * hai bot BỐC THẺ GIỐNG HỆT NHAU và chỉ khác cỡ cược. Với tín hiệu đúng ~65%,
 * cược to hơn luôn tốt hơn ⇒ "hoài nghi" KHÔNG THỂ thắng "tin mù" bằng cách
 * cược nhỏ lại, và gate G4 không thể đạt bằng cách chỉnh tỷ lệ tin giả.
 *
 * Người hoài nghi thật không cược nhỏ hơn — họ DỰNG DANH MỤC SỐNG ĐƯỢC CẢ HAI
 * KỊCH BẢN. Nên bot phải suy nghĩ bằng phân bố, và né phương sai.
 */
type PhanBo = Partial<Record<GiaiDoanId, number>>;

function phanBoDuDoan(
  ctx: BoiCanh, kieu: 'tin' | 'phot' | 'hieu_chinh' | 'biet_that',
): PhanBo {
  const truoc = ctx.oTruoc;
  if (!truoc || truoc.kind !== 'su_kien') return { di_ngang: 10000 };

  // Cả bốn bot dùng CHUNG một cỗ máy, chỉ khác đúng một con số: xác suất tin
  // này là bịa. Xem `phanBoTheoNiemTin` để biết vì sao phải làm vậy.
  switch (kieu) {
    case 'phot': return { di_ngang: 10000 };
    case 'tin': return { [truoc.bao_truoc]: 10000 };
    case 'hieu_chinh': {
      // Tỷ lệ HIỆU DỤNG của chính tin đó nếu người dựng bối cảnh đưa vào —
      // xem `BoiCanh.tyLeGiaTruocBp`. Vắng ⇒ 35% phẳng (trận cũ).
      const f = ctx.tyLeGiaTruocBp ?? NHA_CAI.TY_LE_TIN_GIA_BP;
      return { [truoc.bao_truoc]: 10000 - f, di_ngang: f };
    }
    case 'biet_that':
      return truoc.la_tin_gia ? { di_ngang: 10000 } : { [truoc.bao_truoc]: 10000 };
  }
}

/*
 * ─── ĐO ĐƯỢC 20/07 — KẾT LUẬN ĐÃ SAI, GIỮ LẠI ĐỂ TRUY VẾT ──────────────────
 *
 * ⚠ ĐỌC MỤC NÀY CÙNG `laTinGiaThat` BÊN DƯỚI TRƯỚC KHI TIN BẤT KỲ SỐ NÀO Ở ĐÂY.
 * Toàn bộ số dưới đây đo bot "Biết trước" khi nó ĐANG MÙ: nó đọc `ctx.o` (ô đã
 * cắt cờ tin giả) thay vì `ctx.oThat`, nên trên ô tin đang nổ nó luôn kết luận
 * "tin thật" — hành xử đúng bằng bot "Tin mọi tin". Sửa ngày 26/07.
 *
 * Vậy nên câu chốt "tín hiệu yếu hơn nhiễu ~250 lần / BIẾT TRƯỚC KHÔNG ĐÁNG MỘT
 * ĐỒNG" KHÔNG đo giá trị của thông tin — nó đo một con bot không hề nhận được
 * thông tin. Và câu "gốc không nằm ở bot" thì ngược hẳn: gốc nằm đúng ở bot.
 * Ba lần sửa tầng bot trước đây thất bại vì cả ba đều sửa chỗ khác.
 *
 * Sau khi sửa (12.000 trận): oracle 2,87 → 2,84, thắng 22,4% → 23,2%. CÓ đổi,
 * nhưng còn xa mức G2 đòi (≤2,67). Tức lỗi này là THẬT và đã chặn mọi phép đo
 * trước đó, nhưng một mình nó không giải thích hết khoảng cách còn lại.
 *
 * ─── SỐ CŨ (đo trên bot mù, không dùng để kết luận) ────────────────────────
 *
 * Đã thử ba lần sửa ở tầng bot (sức mạnh tương đối thay vì tuyệt đối · cho cả
 * bốn bot cùng mức phòng hộ · cho oracle niềm tin đúng thay vì suy biến).
 * Oracle nhích đúng 3,07 → 2,99 hạng TB, tức KHÔNG ĐỔI GÌ, và bản niềm-tin
 * còn làm G4 vỡ theo. Nên gốc không nằm ở bot.
 *
 * Đo thẳng PnL thô mỗi vòng, 3.000 trận, bỏ qua thứ hạng:
 *
 *     oracle (biết thật/giả)   −116,6 bp/vòng   độ lệch 3.296
 *     phớt mọi tin             −116,8 bp/vòng   độ lệch 3.322
 *     hoài nghi                −129,5 bp/vòng   độ lệch 3.401
 *
 * Oracle hơn hoài nghi 12,9 bp trong khi nhiễu MỘT vòng là 3.296 bp — tín hiệu
 * yếu hơn nhiễu ~250 lần. Và "phớt mọi tin" ngang y hệt oracle: BIẾT TRƯỚC
 * KHÔNG ĐÁNG MỘT ĐỒNG. Không lớp bot nào sửa nổi điều đó, vì không có gì để
 * khai thác.
 *
 * Đây đúng bệnh CLAUDE.md đã ghi một lần (gate gradient kỹ năng, 19/07): "tin
 * tức chỉ tác động 50–110 bp trong khi nhiễu một tick đã ±132 bp, tức là ĐỌC
 * ĐÚNG TIN VÔ DỤNG" — lần đó chữa bằng tin ×3 và kéo dài 5 tick. Bệnh tái phát
 * ở engine Hold'em với biên độ tệ hơn nhiều.
 *
 * Chữa được thì phải đụng `bien_dong_bp` của tài sản hoặc độ lớn tin/echo —
 * THAM SỐ CÂN BẰNG, và nó đánh đổi trực tiếp với chỉ đạo đã ghi của founder
 * ("SPECTACLE + PHƯƠNG SAI", 19/07): giảm nhiễu là giảm đúng cái làm trận hồi
 * hộp. A8.2 cấm tự sửa → ĐANG CHỜ FOUNDER QUYẾT, không tự chỉnh.
 */

/** Kỳ vọng điểm hợp của một tài sản dưới phân bố (bp). */
function kyVongTaiSan(id: string, pb: PhanBo, bo: BoMaTran = 'v40'): number {
  let s = 0;
  const mt = mtGiaiDoan(bo);
  for (const [gd, w] of Object.entries(pb)) {
    s += applyBpInt(mt[id]?.[gd as GiaiDoanId] ?? 0, w ?? 0);
  }
  return s;
}

/**
 * RỦI RO của tài sản dưới một phân bố (bp) — độ lệch tuyệt đối bình quân so
 * với kỳ vọng, CÓ TRỌNG SỐ theo xác suất từng kịch bản.
 *
 * Dùng làm thước PHÒNG HỘ: tài sản +1200 ở kịch bản này và −1200 ở kịch bản
 * kia có kỳ vọng ~0 nhưng rủi ro cao; tài sản +600/+300 an toàn hơn nhiều.
 *
 * ⚠ Bản trước lấy max−min, tức BỎ QUA xác suất. Từ khi mọi bot đều nghĩ bằng
 * phân bố đủ 5 giai đoạn, max−min ra HẰNG SỐ cho mỗi tài sản — phòng hộ mất
 * hết liên hệ với niềm tin, và bot tin chắc cũng né rủi ro y như bot hoài
 * nghi. Có trọng số thì ai tin chắc mới dám ôm rủi ro, đúng như đời.
 */
function daoDongTaiSan(id: string, pb: PhanBo, bo: BoMaTran = 'v40'): number {
  const gds = Object.keys(pb) as GiaiDoanId[];
  if (gds.length < 2) return 0;
  const ky = kyVongTaiSan(id, pb, bo);
  let s = 0;
  const mt = mtGiaiDoan(bo);
  for (const gd of gds) {
    const v = mt[id]?.[gd] ?? 0;
    s += applyBpInt(Math.abs(v - ky), pb[gd] ?? 0);
  }
  return s;
}

/** Kỳ vọng điểm hợp của cả danh mục dưới phân bố (bp). */
export function kyVongDanhMuc(dm: DanhMuc, pb: PhanBo, bo: BoMaTran = 'v40'): number {
  let s = 0;
  for (const id of dm.tai_san) s += kyVongTaiSan(id, pb, bo);
  return s;
}

/**
 * Chọn thẻ tốt nhất dưới phân bố.
 * `nePhuongSaiBp` > 0 → trừ bớt điểm theo mức dao động giữa các kịch bản, tức
 * ưu tiên thẻ sống được ở nhiều kịch bản. Chỉ bot hiệu chỉnh dùng.
 */
function theTotNhat(ctx: BoiCanh, pb: PhanBo, nePhuongSaiBp = 0): string | null {
  const dm = ctx.ghe.danh_muc;
  let tot: string | null = null;
  let diem = -Infinity;

  // v41/v42 — BỘ MA TRẬN: lấy từ CHÍNH bối cảnh (ctx), không tự đoán — một cửa.
  const bo = ctx.bo ?? 'v40';
  if (dm.tai_san.length < tranMa(ctx)) {
    for (const id of ctx.shop.tai_san) {
      if (dm.tai_san.includes(id)) continue;
      const d = kyVongTaiSan(id, pb, bo)
        - applyBpInt(daoDongTaiSan(id, pb, bo), nePhuongSaiBp);
      if (d > diem) { diem = d; tot = id; }
    }
  }
  // Thẻ chiến thuật: chỉ lấy nếu KHÔNG xung đột — bot không tự bắn vào chân.
  if (dm.chien_thuat.length < tranLoi(ctx)) {
    for (const id of ctx.shop.chien_thuat) {
      if (xungDotVoi(id, dm)) continue;
      if (diem < 0) { diem = 0; tot = id; }
    }
  }
  return tot;
}

/**
 * Chia tỷ lệ hung hăng → cỡ cam kết.
 *
 * ⚠ Bản đầu viết `min(3500, hungHang * kyVongBp)` — SAI ĐƠN VỊ. `kyVongBp`
 * tính bằng bp (800 = 8%), nhân với hệ số 14 ra 11.200bp = 112% vốn, nên MỌI
 * bot đều đụng trần và cam kết y hệt nhau. Hậu quả không phải là "số hơi to":
 * độ tin vào tin tức MẤT KÊNH thể hiện, và gradient mà gate 17.6 đo
 * (tin-mọi-tin vs hoài-nghi vs phớt-tin) sập thành ba đường thẳng bằng nhau.
 * Test "Tin mọi tin cam kết mạnh nhất" bắt được đúng ca này.
 */
const CHIA_HUNG_HANG = 5;

/**
 * BIÊN ĐỘ LỢI THẾ — thang quy "lợi thế bp" về sức mạnh [0,1] trong `quyetDinhCuoc`:
 *
 *     manh = clamp((loiTheBp + BIEN_DO) / (2 × BIEN_DO), 0, 1)
 *
 * Trước 26/07 viết chết là 1.000. Đo bằng `scripts/holdem_domohinh.ts` trên
 * 12.000 bối cảnh: lợi thế thật có |trung bình| 1.130 bp (bot bịt tai) đến
 * 1.860 bp (oracle) — thang CŨ HẸP HƠN chính độ trải của thứ nó đo, và 58,9%
 * số lượt của oracle rơi ra ngoài thang.
 *
 * Hậu quả: `manh` thành công tắc bật/tắt. Oracle và bot bịt tai — hai mô hình
 * cách nhau 0,28 về độ khớp với engine — cho ra CÙNG một mức mạnh ở 70,4% số
 * lượt, trong đó 38,0% cùng bị đẩy về cực 0 hoặc 1. Mô hình làm đúng việc rồi
 * thông tin bị nén mất ở CỬA CUỐI.
 *
 * ─── VÀ ĐÂY LÀ CHỖ PHẢI ĐỌC KỸ: NỚI THANG LÀM GATE TỆ ĐI ───────────────────
 *
 * Nghe thì hiển nhiên là phải nới cho khớp phân bố. Đo 12.000 trận thì không:
 *
 *     biên độ   oracle   bấm bừa   phớt tin   kết luận gate
 *       1.000     2,82      3,29       2,58   G2 hỏng 1 điều kiện
 *       2.500     2,85      3,06       2,78   G2 hỏng CẢ HAI
 *       3.500     2,89      3,04       2,92   G2 hỏng cả hai + G4 thêm một
 *
 * Nới đúng là hạ được bot bịt tai (2,58 → 2,92 — xác nhận nó ĐANG hưởng lợi từ
 * chính sự nén). Nhưng nó cũng kéo BẤM BỪA lên (3,29 → 3,04), và "bấm bừa phải
 * kém rõ" là nửa còn lại của G2. Thang hẹp đang BÙ TRỪ: nó đẩy bot bấm bừa vào
 * hai cực sai nên trông tệ đi, và chính điều đó chống đỡ G2 lâu nay.
 *
 * NÊN GIỮ 1.000 — không phải vì nó đúng, mà vì bản sửa "đúng hơn" đo ra TỆ HƠN,
 * và tôi không ship một thay đổi làm hỏng gate chỉ vì nó nghe hợp lý. Giữ núm
 * lại (sweep được) để lần sau đo tiếp cùng lúc với việc chữa gốc, chứ không im
 * lặng xoá phát hiện đi.
 *
 * Sửa chỗ này KHÔNG chạm D22 — không đụng một dòng nào của động cơ giá.
 *
 * Sweep: HOLDEM_SWEEP=1 HOLDEM_BIEN_DO_LOI_THE_BP=...
 */
const BIEN_DO_LOI_THE_BP = doThamSo('BIEN_DO_LOI_THE_BP', 1000);

/**
 * Mức né phương sai của bot hiệu chỉnh (bp của khoảng dao động).
 * Monte Carlo chốt — không hand-tune ngoài gate.
 */
const NE_PHUONG_SAI_BP = 5000;

/**
 * Độ hung hăng DÙNG CHUNG cho 4 bot đo tín hiệu (3 bot tín hiệu + oracle).
 * Bắt buộc bằng nhau: nếu khác, gate đo nhầm sang độ hung hăng.
 */
const HUNG_HANG_DO_TIN = 10;

/**
 * KỲ VỌNG PnL CỦA VÒNG NÀY.
 *
 * ⚠ Sửa lỗi căn bản phát hiện 20/07 khi soi vì sao oracle luôn xếp gần bét:
 * bản trước cho bot dự đoán giai đoạn vòng này TỪ TELEGRAPH của ô trước —
 * trong khi ô vòng này ĐÃ LẬT, giai đoạn là thông tin công khai ai cũng thấy.
 * Telegraph là để đoán ô KẾ, không phải ô đang chơi. Hậu quả: mọi bot ra
 * quyết định trên căn cứ sai, và "biết trước" thành vô nghĩa → gate gradient
 * không bao giờ đạt dù chỉnh nhiễu hay tiền cửa thế nào.
 *
 * Thứ oracle thật sự biết mà người khác KHÔNG biết là: dư âm (echo) của tin
 * trước đang thuận hay đã ĐẢO vì đó là tin giả. Điều đó đổi PnL NGAY vòng này.
 * Nhận KIỂU ĐỌC TIN chứ không nhận sẵn một con số, để mỗi nguồn tin được tra
 * `la_tin_gia` của riêng nó — xem `niemTinTin`.
 *
 * XUẤT RA để `scripts/holdem_domohinh.ts` đối chiếu được dự đoán này với PnL
 * THẬT của engine. Không có đường nào khác để đo: đây chính là mô hình thế
 * giới của bot, và mọi kết luận về "kỹ năng" đều nằm hay chết theo độ khớp của
 * nó với engine. Chỉ script chẩn đoán đọc — không dùng ở đường chạy thật.
 */
export function kyVongVongNay(ctx: BoiCanh, dm: DanhMuc, kieu: KieuDocTin): number {
  // v41/v42 — BỘ MA TRẬN: lấy từ CHÍNH bối cảnh (ctx), một cửa — xem `BoiCanh.bo`.
  const bo = ctx.bo ?? 'v40';
  const gd: GiaiDoanId = ctx.o.kind === 'giai_doan' ? ctx.o.giai_doan : 'di_ngang';
  let s = 0;
  for (const id of dm.tai_san) s += mtGiaiDoan(bo)[id]?.[gd] ?? 0;

  // Ô sự kiện của chính vòng này + dư âm ô trước.
  const nguon: { sk: string; doLon: number; giaBp: number }[] = [];
  if (ctx.o.kind === 'su_kien') {
    nguon.push({
      sk: ctx.o.su_kien,
      doLon: 10000,
      // ⚠ `oThat`, KHÔNG phải `o` — xem docstring `niemTinTin`.
      giaBp: niemTinTin(kieu, laTinGiaThat(ctx), ctx.tyLeGiaBp),
    });
  }
  if (ctx.oTruoc?.kind === 'su_kien') {
    nguon.push({
      sk: ctx.oTruoc.su_kien,
      doLon: NHA_CAI.SUY_GIAM_ECHO_BP,
      // Niềm tin tra theo tin CỦA Ô TRƯỚC, không phải ô này — nên tỷ lệ hiệu
      // dụng cũng phải là của ô trước.
      giaBp: niemTinTin(kieu, ctx.oTruoc.la_tin_gia, ctx.tyLeGiaTruocBp),
    });
  }
  for (const n of nguon) {
    for (const id of dm.tai_san) {
      const goc = mtSuKien(bo)[id]?.[n.sk as never] ?? 0;
      s += applyBpInt(applyBpInt(goc, n.doLon), n.giaBp);
    }
  }

  /**
   * ⚠ CHIẾN THUẬT × SỰ KIỆN — thiếu khối này là G2 tự nhiễu.
   *
   * Trước 20/07 hàm này KHÔNG đọc `dm.chien_thuat` một dòng nào. Khi engine bắt
   * đầu cộng PnL từ chiến thuật (T1) mà bot vẫn định giá như không có, thì
   * "lợi thế riêng" (kỳ vọng riêng − mặt bằng) lệch CÓ HỆ THỐNG — bot cược sai
   * cỡ một cách nhất quán, và gate đo kỹ năng biến thành đo lỗi kế toán.
   *
   * Chỉ tính ở ô sự kiện của CHÍNH vòng này (echo của tin cũ không kích hoạt
   * MT_CHIEN_THUAT_SU_KIEN trong engine, nên tính vào đây là bot ảo tưởng).
   */
  if (ctx.o.kind === 'su_kien') {
    for (const ct of new Set(dm.chien_thuat)) {
      // v49 (D342) — cùng cổng với engine `dungChuoi` bước 4b.
      if (ct === 'ban_khong' && ctx.banKhongThuanQuyen === true) continue;
      s += MT_CHIEN_THUAT_SU_KIEN[ct]?.[ctx.o.su_kien] ?? 0;
    }
  }

  return s;
}

/**
 * MẶT BẰNG THỊ TRƯỜNG — kỳ vọng của một danh mục TRUNG BÌNH vòng này.
 *
 * ⚠ Đây là chỗ sửa lỗi khiến G2 trượt suốt (đo lại 20/07). Quỹ vòng chia theo
 * HẠNG, nhưng bot lại quyết định cược theo PnL TUYỆT ĐỐI. Hậu quả: giai đoạn
 * tăng thì ai cũng lãi to → mọi bot cùng thấy "tay mạnh" → cùng tố; giai đoạn
 * sập thì cả bàn cùng bỏ. Sức mạnh tuyệt đối gần như KHÔNG tương quan với việc
 * có hơn bàn hay không, nên thứ oracle biết (echo thật hay giả) không đổi
 * được quyết định của nó — "biết trước" thành vô dụng đúng như gate báo.
 *
 * Mặt bằng dựng bằng THÔNG TIN CÔNG KHAI: giai đoạn đang lật ai cũng thấy, và
 * niềm tin tin-tức mặc định của đám đông là hiệu chỉnh theo tỷ lệ tin giả công
 * bố. Nhờ vậy phần lệch giữa kỳ vọng riêng và mặt bằng CHÍNH LÀ lợi thế riêng
 * — chỗ duy nhất oracle được trả công cho cái nó biết thêm.
 */
function matBangThiTruong(ctx: BoiCanh, soTaiSan: number): number {
  if (soTaiSan <= 0) return 0;
  let tong = 0;
  for (const ts of TAI_SAN) {
    // Đám đông đọc tin kiểu 'hieu_chinh' — chiết khấu theo tỷ lệ tin giả CÔNG BỐ,
    // vì không ai ngoài oracle biết mẩu tin cụ thể này thật hay giả.
    tong += kyVongVongNay(ctx, { tai_san: [ts.id], chien_thuat: [] }, 'hieu_chinh');
  }
  return idiv(tong * soTaiSan, TAI_SAN.length);
}

/** Niềm tin vào chiều của echo, theo kiểu đọc tin. */
function tinEcho(ctx: BoiCanh, kieu: KieuDocTin): number {
  const laO = ctx.o.kind === 'su_kien';
  const nguon = ctx.o.kind === 'su_kien' ? ctx.o
    : (ctx.oTruoc?.kind === 'su_kien' ? ctx.oTruoc : null);
  if (!nguon) return 0;
  // Tỷ lệ hiệu dụng phải là của ĐÚNG ô đang tra — xem `BoiCanh.tyLeGiaBp`.
  return niemTinTin(kieu, nguon.la_tin_gia,
    laO ? ctx.tyLeGiaBp : ctx.tyLeGiaTruocBp);
}

/**
 * NIỀM TIN VÀO MỘT MẨU TIN CỤ THỂ — tra theo `laTinGia` của CHÍNH mẩu đó.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * ⚠ ĐÂY LÀ CHỖ SỬA LỖI KHIẾN G2 TRƯỢT SUỐT, tìm ra 26/07.
 *
 * Bản cũ: `tinEcho()` trả về ĐÚNG MỘT con số, rồi `kyVongVongNay` đem con số
 * đó nhân cho CẢ HAI nguồn tin — tin đang nổ ở ô này VÀ dư âm của tin ô trước.
 * Hai mẩu tin đó là hai mẩu KHÁC NHAU, thật/giả độc lập nhau.
 *
 * Hậu quả với oracle: nó tra `la_tin_gia` của ô hiện tại rồi áp luôn dấu đó
 * cho dư âm tin cũ. Tin nay thật mà tin trước giả (hoặc ngược lại) → oracle
 * đặt SAI DẤU lên dư âm. Với tỷ lệ tin giả 35%, hai ô lệch trạng thái nhau
 * 2×0,35×0,65 ≈ 45,5% số lần cả hai ô đều là tin.
 *
 * Và đó KHÔNG phải "oracle mất một phần lợi thế" — nó là "oracle tin chắc vào
 * điều sai", tệ hơn hẳn phớt lờ. Khớp chính xác với thứ đo được và từng bị
 * chẩn đoán nhầm thành "tín hiệu quá yếu": bot PHỚT MỌI TIN (2,64) xếp trên
 * bot BIẾT TRƯỚC (2,87). Một oracle thật thì không đời nào thua kẻ bịt tai;
 * chính dấu hiệu ngược đời đó mới là thứ chỉ ra đây là lỗi, không phải cân bằng.
 *
 * Ghi chú ngược lại một kết luận cũ: docstring "tín hiệu yếu hơn nhiễu 250 lần"
 * đo PnL của oracle khi nó ĐANG đặt sai dấu gần nửa số lần. Con số đó không đo
 * giá trị của thông tin, nó đo giá trị của thông tin bị dùng hỏng.
 */
/**
 * SỰ THẬT về ô đang chơi, lấy từ `oThat`.
 *
 * ⚠ LỖI GỐC KHIẾN G2/G4 TRƯỢT SUỐT, tìm ra 26/07 — và nó không nằm ở cân bằng.
 *
 * `BoiCanh` có HAI ô cho cùng một vòng: `o` đã CẮT cờ `la_tin_gia` (thứ người
 * chơi được thấy) và `oThat` giữ nguyên (thứ chỉ oracle được đọc). Cả hai cùng
 * kiểu `OThiTruong` nên TypeScript không hé một lời khi đọc nhầm.
 *
 * Và code đọc nhầm thật: mọi đường đều đọc `ctx.o.la_tin_gia` — trên ô đã cắt
 * thì thuộc tính đó là `undefined`, tức LUÔN falsy, tức oracle luôn kết luận
 * "tin thật". Trên ô tin đang nổ, bot "Biết trước" hành xử ĐÚNG BẰNG bot "Tin
 * mọi tin". `oThat` được nạp vào từ đầu mà KHÔNG MỘT DÒNG NÀO đọc tới.
 *
 * Nên "oracle không hơn ai" chưa bao giờ là kết luận về cân bằng — không có
 * oracle nào để mà đo. Ba lần chỉnh tầng bot và mọi vòng quét tham số trước
 * đây đều đo một bot mù tự xưng là sáng mắt; docstring "tín hiệu yếu hơn nhiễu
 * 250 lần" cũng là đo cùng con bot mù đó.
 *
 * Truyền cờ thật vào đây KHÔNG rò rỉ cho bot khác: chỉ nhánh `'biet_that'` đụng
 * đến nó, ba nhánh còn lại bỏ qua tham số. Đó chính là lý do tham số tồn tại.
 */
function laTinGiaThat(ctx: BoiCanh): boolean {
  return ctx.oThat.kind === 'su_kien' ? ctx.oThat.la_tin_gia : false;
}

function niemTinTin(
  kieu: KieuDocTin, laTinGia: boolean, tyLeGiaBp?: number,
): number {
  switch (kieu) {
    case 'phot': return 0;
    case 'tin': return 10000;
    /*
     * Kỳ vọng dấu: (1−f)(+1) + f(−1) = 1 − 2f.
     * `f` là tỷ lệ HIỆU DỤNG nếu người dựng bối cảnh đưa vào (v28: 5–80% theo
     * loại sự kiện × môi trường tiền tệ), không phải 35% phẳng — xem
     * `BoiCanh.tyLeGiaTruocBp`.
     */
    case 'hieu_chinh': return 10000 - 2 * (tyLeGiaBp ?? NHA_CAI.TY_LE_TIN_GIA_BP);
    case 'biet_that': return laTinGia ? -10000 : 10000;
  }
}

/** Cam kết theo mức kỳ vọng: tốt thì tăng, xấu thì cắt lỗ. */
/**
 * ⚠⚠ CODE CHẾT — KHÔNG ĐƯỜNG CHẠY NÀO GỌI TỚI (xác nhận 26/07).
 *
 * `Bot.chonCamKet` được khai trong interface, MỌI bot đều cài, và có 10 khẳng
 * định trong `tests/holdem_shop.test.ts` gọi thẳng vào nó — nên nhìn thì nó
 * sống. Nhưng quét cả repo: KHÔNG một đường chạy nào gọi `.chonCamKet(`.
 * Monte Carlo gọi `chonThe` + `chonCuoc`; trận thật (`holdem_api.ts`) cũng chỉ
 * gọi `chonCuoc`, rồi SUY RA hành động cam kết từ chính mức cược
 * (`cam_ket > CAM_KET_NEN` → tăng cam kết). Bot không tự quyết cam kết bao giờ.
 *
 * Test chính là thứ cho nó cái mạch giả: 10 khẳng định chạy xanh trên một hàm
 * không ai dùng. Đây là lý do phải phân biệt "có test" với "có chạy".
 *
 * Hệ quả cho gate G2: kênh DUY NHẤT để bot thể hiện lợi thế là `chonCuoc` và
 * `chonThe`. Mọi chỉnh sửa ở hàm dưới đây KHÔNG đổi một chữ số nào của Monte
 * Carlo — tôi đã sửa rồi đo và số giống hệt đến từng chữ số, đó là cách phát
 * hiện ra. Cần founder quyết: NỐI vào đường chạy, hay XOÁ hẳn. Để nguyên là
 * bẫy cho phiên sau, đúng thứ A8.9 cấm.
 *
 * (Phần sửa dưới đây vẫn giữ, vì nếu có ngày nối vào thì nó đã đúng sẵn.)
 *
 * ─── QUYẾT ĐỊNH THEO LỢI THẾ RIÊNG, KHÔNG THEO PnL TUYỆT ĐỐI ───────────────
 *
 * `matBangThiTruong` được viết ra chính để chữa lỗi này, và docstring của nó
 * nói rõ: Quỹ vòng chia theo HẠNG, nên "lãi to" không có nghĩa gì nếu cả bàn
 * cùng lãi to. Giai đoạn tăng thì mọi bot cùng thấy tay mạnh → cùng tăng cam
 * kết; giai đoạn sập thì cả bàn cùng cắt. Thứ oracle biết thêm bị nuốt chửng
 * trong biến động chung, nên "biết trước" không đổi nổi quyết định.
 *
 * NHƯNG bản vá đó chỉ được nối vào `quyetDinhCuoc`, KHÔNG nối vào hàm này —
 * mà đây mới là chỗ định đoạt bao nhiêu vốn vào bàn, tức nửa quan trọng hơn.
 * Nửa vá còn lại nằm im nhiều phiên: docstring mô tả bản sửa đầy đủ, code chỉ
 * làm một nửa.
 *
 * Đo bằng `scripts/holdem_domohinh.ts` (12.000 bối cảnh) trước khi sửa: mô hình
 * của oracle khớp engine 0,72 so với 0,44 của bot bịt tai, đoán đúng dấu 86,0%
 * so với 79,8%, và với MỘT QUY TẮC CAM KẾT TỐI GIẢN theo kỳ vọng thì oracle ăn
 * 520 bp/vòng so với 314. Tức thông tin CÓ giá trị và mô hình CÓ khớp — chỉ
 * riêng hàm quyết định thật là không lấy được giá trị đó ra.
 *
 * Hai ngưỡng −300/+150 giữ nguyên số nhưng nay đọc trên thang LỢI THẾ (lệch so
 * với mặt bằng) thay vì thang tuyệt đối. Đó là thay đổi CÓ Ý: "hơn mặt bằng
 * 150 bp thì tăng cam kết" là câu có nghĩa ở một trò chia thưởng theo hạng,
 * còn "lãi tuyệt đối 150 bp thì tăng" thì không.
 */
function camKetTheoKyVong(
  ctx: BoiCanh, kyVongBp: number, hungHang: number,
): HanhDongVong {
  const id = ctx.ghe.id;
  const loiTheBp = kyVongBp - matBangThiTruong(ctx, ctx.ghe.danh_muc.tai_san.length);
  if (loiTheBp < -300) return { ghe_id: id, hanh_dong: 'cat_lo', them: 0 };
  if (loiTheBp > 150) {
    // Không kẹp trần ở đây — trần là TRAN_TANG_CAM_KET_BP của engine, một
    // nguồn chân lý duy nhất (A4). Bot cứ đề xuất, engine cắt.
    const them = applyBpInt(ctx.ghe.von, idiv(hungHang * loiTheBp, CHIA_HUNG_HANG));
    return { ghe_id: id, hanh_dong: 'tang_cam_ket', them: Math.max(1, them) };
  }
  return { ghe_id: id, hanh_dong: 'giu_vi_the', them: 0 };
}

/**
 * QUYẾT ĐỊNH CƯỢC CHUNG — dùng cho mọi bot, khác nhau ở `kyVong` và `hungHang`.
 *
 * So SỨC MẠNH TAY với POT ODDS, đúng như poker:
 *   cần thắng ≥ con_thieu / (quỹ + con_thieu) thì theo mới có lãi.
 *
 * Ước lượng sức mạnh: kỳ vọng PnL của danh mục quy về thang 0–1, rồi chia cho
 * số người còn lại (càng đông càng khó nhất). Thô, nhưng đủ để bot không theo
 * mù và không bỏ bài khi đang cầm tay tốt.
 *
 * BỊP: một tỷ lệ nhỏ các lượt, bot tố dù tay yếu — tất định theo seed nên
 * replay ra y hệt. Không có bịp thì đọc bài trở nên tầm thường: cứ ai tố là
 * chắc chắn tay mạnh.
 */
function quyetDinhCuoc(
  cuoc: BoiCanhCuoc, ctx: BoiCanh, kyVongBp: number, hungHang: number,
): { loai: LoaiHanhDong; them?: number } {
  // Sức mạnh = LỢI THẾ so với mặt bằng, không phải lãi tuyệt đối. Xem chú
  // thích ở `matBangThiTruong` để biết vì sao phân biệt này quyết định gate G2.
  const loiTheBp = kyVongBp - matBangThiTruong(ctx, ctx.ghe.danh_muc.tai_san.length);
  // Thang quy về [0,1] — biên độ ở config, KHÔNG viết chết. Xem docstring
  // `BIEN_DO_LOI_THE_BP`: thang cũ 1.000 hẹp hơn chính độ trải của lợi thế nên
  // nén mất 70% chênh lệch giữa bot đọc tin giỏi và bot bịt tai.
  const bien = BIEN_DO_LOI_THE_BP;
  const manh = Math.max(0, Math.min(1, (loiTheBp + bien) / (2 * bien)));
  const equity = manh / Math.max(1, cuoc.so_nguoi_con - 1);
  const canThang = cuoc.con_thieu <= 0
    ? 0
    : cuoc.con_thieu / (cuoc.quy_hien_tai + cuoc.con_thieu);

  const rng = rngAt(ctx.seed, 'bot_cuoc', ctx.vong, ctx.ghe.id, cuoc.gia);
  const bip = rng.chanceBp(700);   // 7% số lượt là bịp

  // Được check (không nợ tiền): tay mạnh hoặc đang bịp thì tố, không thì check.
  if (cuoc.con_thieu <= 0) {
    if (cuoc.duoc.includes('to') && (manh > 0.62 || bip)) {
      const cuoc_them = Math.max(1, Math.min(
        cuoc.to_toi_da,
        applyBpInt(cuoc.quy_hien_tai, 3000 + hungHang * 150)));
      return { loai: 'to', them: cuoc_them };
    }
    return { loai: 'theo' };
  }

  // Đang nợ tiền: so equity với pot odds.
  if (equity < canThang * 0.85 && !bip) return { loai: 'bo' };

  // Tay rất mạnh → tố lại để moi thêm.
  if (cuoc.duoc.includes('to') && manh > 0.78 && cuoc.to_toi_da > cuoc.con_thieu * 2) {
    const cuoc_them = Math.max(cuoc.con_thieu + 1, Math.min(
      cuoc.to_toi_da,
      cuoc.con_thieu + applyBpInt(cuoc.quy_hien_tai, 2500 + hungHang * 120)));
    return { loai: 'to', them: cuoc_them };
  }
  return { loai: 'theo' };
}

/** Bốn cách đọc một mẩu tin: tin sạch · bịt tai · hiệu chỉnh theo tỷ lệ · biết thật. */
export type KieuDocTin = 'tin' | 'phot' | 'hieu_chinh' | 'biet_that';

/** Bot dựa trên một kiểu đọc tin — dùng cho cả 3 bot tín hiệu + oracle. */
function botTheoTin(
  id: string, label: string, nhom: NhomBot,
  kieu: KieuDocTin, hungHang = 8,
): Bot {
  // ⚠ Né phương sai phải DÙNG CHUNG cả bốn, cùng lý do với HUNG_HANG_DO_TIN.
  // Bản trước chỉ cho bot hiệu chỉnh phòng hộ. Nhưng Quỹ vòng chia theo HẠNG:
  // phải vào top 3 của 5, nên danh mục đều tay thắng danh mục bùng-hoặc-cháy
  // BẤT KỂ đọc tin giỏi cỡ nào. Đo ra: oracle cháy 5,9% và xếp 3,00 trong khi
  // hoài nghi 2,24 — chênh lệch đó là tiền phòng hộ, không phải tiền thông tin.
  // Hậu quả kép: G2 trượt oan, và G4 ĐẠT VÌ LÝ DO SAI (hoài nghi thắng nhờ
  // phòng hộ chứ chưa chắc nhờ hiệu chỉnh tin giả). Cho cả bốn cùng mức phòng
  // hộ thì phần chênh còn lại chỉ có thể đến từ NIỀM TIN VÀO TIN — đúng thứ
  // hai gate muốn đo.
  const nePhuongSai = kieu === 'hieu_chinh' ? NE_PHUONG_SAI_BP : 0;
  return {
    id, label, nhom,
    // BỐC THẺ nhìn về ô KẾ (danh mục còn dùng tiếp) → dùng telegraph.
    chonThe: (ctx) => theTotNhat(ctx, phanBoDuDoan(ctx, kieu), nePhuongSai),
    // CAM KẾT nhìn ô ĐANG CHƠI (đã lật, ai cũng thấy) → chỉ khác nhau ở niềm
    // tin vào chiều dư âm tin trước. Đó mới là thông tin oracle độc quyền.
    chonCamKet: (ctx) => camKetTheoKyVong(
      ctx, kyVongVongNay(ctx, ctx.ghe.danh_muc, kieu), hungHang),
    chonCuoc: (cuoc, ctx) => quyetDinhCuoc(
      cuoc, ctx, kyVongVongNay(ctx, ctx.ghe.danh_muc, kieu), hungHang),
  };
}

// ---------------------------------------------------------------------------
// Bộ bot
// ---------------------------------------------------------------------------

/** Ưu tiên tài sản theo tính cách — dùng cho các archetype chơi được. */
function botUuTien(
  id: string, label: string, uuTien: readonly string[],
  theMuon: readonly ChienThuatId[], hungHang: number,
): Bot {
  return {
    id, label, nhom: 'choi_duoc',
    uu_tien: uuTien,
    chonThe(ctx) {
      const dm = ctx.ghe.danh_muc;
      if (dm.tai_san.length < tranMa(ctx)) {
        for (const ts of uuTien) {
          if (ctx.shop.tai_san.includes(ts) && !dm.tai_san.includes(ts)) return ts;
        }
      }
      if (dm.chien_thuat.length < tranLoi(ctx)) {
        for (const ct of theMuon) {
          if (ctx.shop.chien_thuat.includes(ct) && !xungDotVoi(ct, dm)) return ct;
        }
      }
      return null;
    },
    chonCamKet: (ctx) => camKetTheoKyVong(
      ctx, kyVongVongNay(ctx, ctx.ghe.danh_muc, 'hieu_chinh'), hungHang),
    chonCuoc: (cuoc, ctx) => quyetDinhCuoc(
      cuoc, ctx, kyVongVongNay(ctx, ctx.ghe.danh_muc, 'hieu_chinh'), hungHang),
  };
}

export const BOT_THAM_CHIEU: readonly Bot[] = [
  {
    id: 'ngoi_im', label: 'Ngồi im', nhom: 'tham_chieu', von_khong_doc: 'khong',
    chonThe: () => null,
    chonCamKet: (ctx) => ({ ghe_id: ctx.ghe.id, hanh_dong: 'giu_vi_the', them: 0 }),
    // Ngồi im: luôn theo giá nền, không bao giờ tố, chỉ bỏ khi giá quá đắt.
    chonCuoc: (cuoc) => (cuoc.con_thieu > cuoc.quy_hien_tai
      ? { loai: 'bo' } : { loai: 'theo' }),
  },
  // ⚠ hungHang PHẢI bằng ba bot tín hiệu. Bản trước để 12 trong khi hoài-nghi
  // là 10 và phớt-tin là 8 → G2/G4 đo ĐỘ HUNG HĂNG chứ không đo CHẤT LƯỢNG
  // THÔNG TIN, và oracle luôn xếp bét vì cược quá tay chứ không phải vì đọc
  // sai. Cùng lớp lỗi D20 từng bắt (win-rate hệ là artifact do gán hệ và
  // archetype trên cùng chỉ số). Giữ 4 bot dưới đây CÙNG một hungHang.
  botTheoTin('oracle', 'Biết trước', 'tham_chieu', 'biet_that', HUNG_HANG_DO_TIN),
  {
    id: 'bam_bua', label: 'Bấm bừa', nhom: 'tham_chieu', von_khong_doc: 'mu',
    chonThe(ctx) {
      const r = rngAt(ctx.seed, 'bot_bua_the', ctx.vong, ctx.ghe.id);
      const tatCa = [...ctx.shop.tai_san, ...ctx.shop.chien_thuat];
      return r.chanceBp(5000) ? null : tatCa[r.below(tatCa.length)]!;
    },
    chonCamKet(ctx) {
      const r = rngAt(ctx.seed, 'bot_bua_cam', ctx.vong, ctx.ghe.id);
      const n = r.below(3);
      if (n === 0) return { ghe_id: ctx.ghe.id, hanh_dong: 'cat_lo', them: 0 };
      if (n === 1) return { ghe_id: ctx.ghe.id, hanh_dong: 'giu_vi_the', them: 0 };
      return {
        ghe_id: ctx.ghe.id, hanh_dong: 'tang_cam_ket',
        them: Math.max(1, applyBpInt(ctx.ghe.von, r.below(3000))),
      };
    },
    chonCuoc(cuoc, ctx) {
      const r = rngAt(ctx.seed, 'bot_bua_cuoc', ctx.vong, ctx.ghe.id, cuoc.gia);
      const n = r.below(3);
      if (n === 0) return { loai: 'bo' };
      if (n === 1 || !cuoc.duoc.includes('to')) return { loai: 'theo' };
      return { loai: 'to', them: Math.max(cuoc.con_thieu + 1,
        r.range(1, Math.max(2, cuoc.to_toi_da))) };
    },
  },
  /**
   * D2 — "CHẠY SỚM": bot luôn cắt lỗ khi được phép. THƯỚC ĐO, không phải đối thủ.
   *
   * ⚠ VÌ SAO PHẢI CÓ BOT NÀY: gate D2 đòi "Cắt lỗ có giá trị nhưng KHÔNG thành
   * meta thống trị". Trước khi thêm bot này, KHÔNG MỘT BOT NÀO trong đàn chơi
   * kiểu hay-bỏ — mọi bot chơi-được dùng chung một chính sách cược (equity so
   * pot odds), khác nhau ở chỗ chọn lá. Nghĩa là gate đó đo một chiến lược không
   * tồn tại: dù phí cắt lỗ đặt bằng 0 hay bằng 90%, con số Monte Carlo cũng gần
   * như không đổi, và tôi sẽ kết luận "đạt" từ một phép đo trống.
   *
   * Đây đúng lớp lỗi đã trả giá ở D1: ba lần đoán theo TÊN bot là ba lần đo sai
   * biến, và chỉ khi ĐỌC bots.ts mới thấy thủ phạm thật. Nên lần này dựng thước
   * trước, đo sau.
   *
   * CÁCH ĐỌC KẾT QUẢ:
   *   · `chay_som` mà bám sát hoặc vượt nhóm chơi-được → cắt lỗ ĐANG là bến an
   *     toàn quá rẻ, phí phải tăng.
   *   · `chay_som` mà bét hẳn (kiểu Bấm bừa) → phí ĐANG quá nặng, cắt lỗ thành
   *     bẫy và trò dạy sai bài học (D22). Cả hai phía đều là trượt gate.
   */
  {
    id: 'chay_som', label: 'Chạy sớm', nhom: 'tham_chieu',
    // Vẫn mua thẻ bình thường: nếu bot này không có danh mục thì nó thành bản
    // sao của "Ngồi im", và lại đo lẫn hai biến vào nhau.
    chonThe: (ctx) => ctx.shop.tai_san[0] ?? null,
    chonCamKet: (ctx) => ({ ghe_id: ctx.ghe.id, hanh_dong: 'cat_lo', them: 0 }),
    // Bỏ NGAY khi còn được bỏ. Hết quota thì buộc phải theo — chính là thứ luật
    // quota D2 nói, và bot này là nơi luật đó bị thử tới hạn mỗi trận.
    chonCuoc: (cuoc) => (cuoc.duoc.includes('bo') ? { loai: 'bo' } : { loai: 'theo' }),
  },
] as const;

/** Ba bot của gate 17.6 — thước đo "đọc tin có phải kỹ năng không". */
export const BOT_TIN_HIEU: readonly Bot[] = [
  botTheoTin('tin_moi_tin', 'Tin mọi tin', 'tin_hieu', 'tin', HUNG_HANG_DO_TIN),
  botTheoTin('phot_moi_tin', 'Phớt mọi tin', 'tin_hieu', 'phot', HUNG_HANG_DO_TIN),
  botTheoTin('hoai_nghi', 'Hoài nghi hiệu chỉnh', 'tin_hieu', 'hieu_chinh', HUNG_HANG_DO_TIN),
] as const;

/**
 * ĐÀN BOT "CHƠI ĐƯỢC" — đối thủ thật của người chơi.
 *
 * ⚠ THÊM/BỚT/ĐỔI THỨ TỰ Ở ĐÂY LÀ AN TOÀN, nhờ `BOT_V1_DONG_BANG` bên dưới.
 * Trước đó thì KHÔNG: `botCuaGhe` suy danh tính bằng `(seed + i) % độ_dài`, nên đổi
 * độ dài 6 → 7 là viết lại đối thủ của MỌI trận đã lưu mà không có `bot_id` — im
 * lặng, không lỗi, không cách nào biết.
 */
export const BOT_CHOI_DUOC: readonly Bot[] = [
  botUuTien('tat_tay', 'Tất tay', ['btc', 'cp_cn'], ['don_bay', 'luot_song'], 16),
  botUuTien('phong_thu', 'Phòng thủ', ['vang', 'usd', 'tpcp'], ['chan_lo', 'phong_ho'], 5),
  botUuTien('da_dang', 'Đa dạng hoá', ['vn30', 'vang', 'usd'], ['da_dang_hoa', 'chan_lo'], 6),
  botUuTien('duoi_da', 'Đuổi đà', ['btc', 'vn30'], ['mua_duoi', 'luot_song'], 12),
  botUuTien('bat_day', 'Bắt đáy', ['cp_cn', 'vn30'], ['bat_day', 'chia_lenh'], 9),
  botUuTien('khac_che', 'Khắc chế', ['vang', 'btc'], ['ban_khong', 'khop_nhanh'], 10),
  /*
   * D5 — NGƯỢC DÒNG: archetype DUY NHẤT cầm thẻ "Đi Ngược".
   *
   * Không có nó thì thẻ Đi Ngược tồn tại mà KHÔNG AI CHƠI, và Monte Carlo sẽ đo
   * một chiến lược không tồn tại rồi báo "không ảnh hưởng" — đúng lỗi đã mắc ở D2
   * (gate "cắt lỗ không được thành meta" đo trên đàn bot mà chưa con nào hay bỏ).
   * Thẻ khắc chế chỉ có nghĩa khi có người cầm nó.
   *
   * Ưu tiên mã TRÚ ẨN LẺ (tpcp) + rổ risk-on lẻ (cp_cn): cố ý chọn thứ ít trùng
   * với hai phe đông nhất, để thẻ Đi Ngược thật sự ở thế lệch đám.
   *
   * ⚠ `chia_lenh` TRONG LOADOUT LÀ CỐ Ý VÀ ĐÃ ĐO. Thử đổi sang `phong_ho`: bot tụt
   * 25,2% → 23,6% và gate G1 VỠ ngay (cách á quân 7,4 → 9,0, vượt ngưỡng 8 của D21).
   * Tức chính con bot này đang giữ đỉnh bảng khỏi chạy trốn. Cũng là xác nhận lại
   * chẩn đoán D1: khiên phẳng `chia_lenh` + mã sổ lệnh sâu là combo mạnh nhất bàn,
   * vì nó né được chi phí hệ thống DUY NHẤT trong trận.
   *
   * Và một bài học đo: hạ THUONG_BP của thẻ Đi Ngược 320 → 210 gần như KHÔNG đổi
   * gì (24,9% → 25,2%). Sức mạnh con bot này không đến từ thẻ mang tên nó — lại
   * suýt đoán theo TÊN, đúng lỗi đã trả giá ba lần ở D1.
   */
  botUuTien('nguoc_dong', 'Ngược dòng', ['tpcp', 'cp_cn'], ['di_nguoc', 'chia_lenh'], 8),
] as const;

/*
 * ═══ v43 (D314) — SÁU ARCHETYPE ĐO NGÂN HÀNG ═════════════════════════════════
 *
 * Chúng KHÔNG bao giờ ngồi ghế trận thật (founder Q12: mùa này chỉ bot đo). Bàn đo trộn
 * chúng vào khi và chỉ khi phiên bản đang đo có cờ `tietKiem`.
 *
 * Mỗi con trả lời MỘT câu của gate G5:
 *  · `tk_2/3/4`  — mốc nào đáng chọn? Ba con giống hệt nhau trừ kỳ hạn, nên chênh lệch
 *                  giữa chúng ĐO ĐÚNG bậc thang `THEM_KY_HAN_BP`, không lẫn thứ khác.
 *  · `tk_thang`  — chia bậc thang có hơn dồn một mốc không?
 *  · `tk_max`    — NHIỆT KẾ "BẾN AN TOÀN": gửi hết, kỳ hạn dài nhất, không bao giờ huỷ.
 *                  Nó mà dẫn đầu nhóm chơi được thì lãi đang quá cao và cả bàn thành
 *                  một trò gửi tiết kiệm. G5(a) canh đúng con này.
 *  · `tk_huy`    — TRẦN TRÊN của giá trị quyền huỷ: nó là ORACLE, huỷ đúng lúc tin tốt
 *                  thật sắp tới. Người thật không bao giờ chơi được hay hơn nó. Nếu nó
 *                  chỉ hơn `tk_4` một chút thì quyền huỷ gần như vô giá trị (phạt quá
 *                  nặng); nếu hơn nhiều thì phạt quá nhẹ. G5(c) canh khoảng đó.
 */

/** Bot đo ngân hàng: chơi như `phong_thu` ở phần chợ, khác nhau ở chính sách gửi. */
function botTietKiem(
  id: string, label: string,
  chinhSach: NonNullable<Bot['chonTietKiem']>,
): Bot {
  const nen = botUuTien(id, label, ['vang', 'usd', 'tpcp'], ['chan_lo', 'phong_ho'], 5);
  return { ...nen, chonTietKiem: chinhSach };
}

/** Gửi `moc_bp` vào mốc dài nhất còn kịp, nhưng không dài quá `tran`. */
const guiMoc = (tran: number, mocBp: number): NonNullable<Bot['chonTietKiem']> =>
  (ctx) => {
    const kip = ctx.moc_kip.filter((n) => n <= tran);
    if (kip.length === 0 || ctx.tien_mat < TIET_KIEM.GOC_TOI_THIEU * 2) return null;
    return { mo: [{ moc_bp: mocBp, so_vong: Math.max(...kip) }] };
  };

export const BOT_NGAN_HANG: readonly Bot[] = [
  botTietKiem('tk_2', 'Gửi 2 ô', guiMoc(2, 5000)),
  botTietKiem('tk_3', 'Gửi 3 ô', guiMoc(3, 5000)),
  botTietKiem('tk_4', 'Gửi 4 ô', guiMoc(4, 5000)),
  botTietKiem('tk_thang', 'Gửi bậc thang', (ctx) => {
    if (ctx.tien_mat < TIET_KIEM.GOC_TOI_THIEU * 4) return null;
    // 25% vào mỗi mốc còn kịp — áp tuần tự nên ba lệnh 25% ra 25/18,75/14 phần.
    const mo = ctx.moc_kip.map((n) => ({ moc_bp: 2500, so_vong: n }));
    return mo.length > 0 ? { mo } : null;
  }),
  botTietKiem('tk_max', 'Gửi hết', (ctx) => {
    if (ctx.moc_kip.length === 0 || ctx.tien_mat < TIET_KIEM.GOC_TOI_THIEU) return null;
    return { mo: [{ moc_bp: 10000, so_vong: Math.max(...ctx.moc_kip) }] };
  }),
  botTietKiem('tk_huy', 'Gửi rồi huỷ', (ctx) => {
    /*
     * ORACLE: ô này tốt thật ⇒ rút hết ra để có tiền mua. Ngược lại thì gửi tiếp.
     * ⚠ Con này CỐ Ý gian lận — nó là thước, không phải một lối chơi. Nếu nó không
     * tách khỏi `tk_4` thì quyền huỷ vô nghĩa; nếu nó bỏ xa thì phạt huỷ quá nhẹ.
     */
    if (ctx.o_that_tot === true && ctx.dang_giu.length > 0) {
      return { huy: ctx.dang_giu.map((h) => h.id) };
    }
    if (ctx.o_that_tot === true) return null;
    const kip = ctx.moc_kip;
    if (kip.length === 0 || ctx.tien_mat < TIET_KIEM.GOC_TOI_THIEU * 2) return null;
    return { mo: [{ moc_bp: 5000, so_vong: Math.max(...kip) }] };
  }),
] as const;

/**
 * ĐÀN BOT BẢN 1 — ĐÓNG BĂNG VĨNH VIỄN, chỉ dùng để dựng lại TRẬN CŨ.
 *
 * Trận tạo trước 25/07/2026 không lưu `bot_id` trong `ghe_json`, nên danh tính đối
 * thủ của chúng chỉ còn suy lại được bằng `(seed + i) % độ_dài` TRÊN ĐÚNG ĐÀN LÚC ẤY.
 * Nếu nhánh fallback dùng `BOT_CHOI_DUOC` đang sống thì mỗi lần thêm một archetype
 * là lịch sử mọi trận cũ bị viết lại — bảng xếp hạng, autopsy, event log đều lệch,
 * và `events` là append-only nên không dựng lại được.
 *
 * ⚠ CẤM SỬA MẢNG NÀY. Nó không phải cấu hình cân bằng, nó là DẤU VẾT LỊCH SỬ.
 * Thêm archetype mới thì thêm vào `BOT_CHOI_DUOC` ở trên.
 */
export const BOT_V1_DONG_BANG: readonly string[] = [
  'tat_tay', 'phong_thu', 'da_dang', 'duoi_da', 'bat_day', 'khac_che',
] as const;

// ---------------------------------------------------------------------------
// HỌ BOT ĐI VỐN — dụng cụ đo cho chẩn đoán D35 (27/07)
// ---------------------------------------------------------------------------

/*
 * ⚠⚠ HỌ NÀY NẰM NGOÀI `BOT_CHOI_DUOC` VÀ NGOÀI `BOT_V1_DONG_BANG` — CỐ Ý.
 *
 * `holdem_api.ts` gán đối thủ trận mới bằng `(seed + i) % BOT_CHOI_DUOC.length`,
 * và trận cũ không lưu `bot_id` thì suy lại bằng `BOT_V1_DONG_BANG`. Nhét sáu
 * con dưới đây vào một trong hai mảng ấy là đổi thành phần bàn của trận thật
 * (mảng 1) hoặc viết lại đối thủ của mọi trận đã lưu (mảng 2) — im lặng, không
 * lỗi. Chúng chỉ là THƯỚC ĐO, đúng vai của `oracle`/`bam_bua`.
 *
 * ─── VÌ SAO PHẢI DỰNG HỌ NÀY ───────────────────────────────────────────────
 * Founder 27/07: "cơ chế đi vốn GIỮ VỊ THẾ — CƯỢC — BỎ BÀI hiện chưa ảnh hưởng
 * nhiều đến kết quả", và D35 chẩn đoán nguyên nhân từ code. Nhưng cả đàn bot
 * hiện tại dùng CHUNG một chính sách vốn (`quyetDinhCuoc`: equity so pot odds),
 * chỉ khác nhau ở chỗ CHỌN LÁ. Đo cam kết trên đàn đó là đo một biến gần như
 * hằng số — đúng lớp lỗi đã trả giá ở D2 ("gate cắt lỗ đo trên đàn bot chưa con
 * nào hay bỏ") và ở D5 (thẻ Đi Ngược không ai cầm).
 *
 * ─── LUẬT THIẾT KẾ CỦA HỌ: CHỈ ĐƯỢC KHÁC NHAU Ở VỐN ────────────────────────
 * Cả sáu DÙNG CHUNG `chonTheDiVon` — cùng danh mục ưu tiên, cùng loadout chiến
 * thuật. Nếu để mỗi con một loadout thì chênh lệch hạng đo được sẽ trộn lẫn
 * "chiến thuật đi vốn" với "chọn lá giỏi", và bảng kết quả không trả lời được
 * câu hỏi nào cả.
 */

/** Danh mục dùng chung cho cả họ — trung tính, không thiên rủi ro hay trú ẩn. */
const DI_VON_TAI_SAN: readonly string[] = ['vn30', 'vang', 'btc', 'usd'];
const DI_VON_CHIEN_THUAT: readonly ChienThuatId[] =
  ['da_dang_hoa', 'chan_lo', 'khop_nhanh'];

function chonTheDiVon(ctx: BoiCanh): string | null {
  const dm = ctx.ghe.danh_muc;
  if (dm.tai_san.length < tranMa(ctx)) {
    for (const ts of DI_VON_TAI_SAN) {
      if (ctx.shop.tai_san.includes(ts) && !dm.tai_san.includes(ts)) return ts;
    }
  }
  if (dm.chien_thuat.length < tranLoi(ctx)) {
    for (const ct of DI_VON_CHIEN_THUAT) {
      if (ctx.shop.chien_thuat.includes(ct) && !xungDotVoi(ct, dm)) return ct;
    }
  }
  return null;
}

const giu = (ctx: BoiCanh): HanhDongVong =>
  ({ ghe_id: ctx.ghe.id, hanh_dong: 'giu_vi_the', them: 0 });
const tang = (ctx: BoiCanh, them: number): HanhDongVong =>
  ({ ghe_id: ctx.ghe.id, hanh_dong: 'tang_cam_ket', them: Math.max(1, them) });

/** Mức vào một lần rồi giữ của `giu_vi_the` (bp Vốn hiện có). */
const MUC_GIU_BP = 1500;
/** Bước leo mỗi vòng của `leo_thang` (bp Vốn hiện có, nhân số vòng). */
const LEO_BUOC_BP = 400;
/** `bo_bai_som` cắt khi Vốn tụt dưới mức này so với Vốn khởi điểm (bp). */
const NGUONG_BAO_TOAN_BP = 9200;
/** `bo_bai_som` bỏ khi phải theo nhiều hơn ngần này phần Vốn còn lại (bp). */
const NGUONG_THEO_DAT_BP = 1200;

export const BOT_DI_VON: readonly Bot[] = [
  /*
   * KEO KIỆT — chỉ đóng cam kết nền, không bao giờ vượt. Ai tố thì bỏ.
   * Đây là CẬN DƯỚI của trục vốn: nếu nó không thua rõ thì cam kết đúng là
   * nút không hậu quả, vì mua vé rẻ nhất mà vẫn ngồi cùng mâm.
   */
  {
    id: 'keo_kiet', label: 'Keo kiệt', nhom: 'di_von',
    chonThe: chonTheDiVon,
    chonCamKet: giu,
    chonCuoc: (cuoc) => (cuoc.con_thieu <= 0
      ? { loai: 'theo' }
      : (cuoc.duoc.includes('bo') ? { loai: 'bo' } : { loai: 'theo' })),
  },
  /*
   * GIỮ VỊ THẾ — vào MỘT mức ở vòng 1 rồi đứng yên cả trận: không tăng, không
   * bỏ, ai tố cũng theo. Đo riêng câu "vào sâu một lần có đáng không", tách
   * khỏi câu "phản ứng theo tình hình có đáng không".
   */
  {
    id: 'giu_vi_the', label: 'Giữ vị thế', nhom: 'di_von',
    chonThe: chonTheDiVon,
    chonCamKet: (ctx) => (ctx.vong === 1
      ? tang(ctx, applyBpInt(ctx.ghe.von, MUC_GIU_BP)) : giu(ctx)),
    chonCuoc: () => ({ loai: 'theo' }),
  },
  /*
   * LEO THANG — tăng đều theo vòng, BẤT KỂ tình hình. Cố ý mù thông tin: nó
   * tách được "cam kết nhiều có lợi không" khỏi "cam kết ĐÚNG LÚC có lợi
   * không". Hai câu đó khác nhau, và chỉ câu thứ hai mới là chiều đấu trí.
   */
  {
    id: 'leo_thang', label: 'Leo thang', nhom: 'di_von',
    chonThe: chonTheDiVon,
    chonCamKet: (ctx) => tang(ctx, applyBpInt(ctx.ghe.von, LEO_BUOC_BP * ctx.vong)),
    chonCuoc: () => ({ loai: 'theo' }),
  },
  /*
   * THEO THẺ — cam kết theo ĐỘ TIN vào danh mục vòng đó (lợi thế so mặt bằng).
   * Đây là con DUY NHẤT trong họ dùng thông tin, tức là cận trên hợp lý: nếu nó
   * cũng không tách khỏi năm con kia thì kênh vốn không truyền được kỹ năng.
   */
  {
    id: 'theo_the', label: 'Theo thẻ', nhom: 'di_von',
    chonThe: chonTheDiVon,
    chonCamKet: (ctx) => camKetTheoKyVong(
      ctx, kyVongVongNay(ctx, ctx.ghe.danh_muc, 'hieu_chinh'), HUNG_HANG_DO_TIN),
    chonCuoc: (cuoc, ctx) => quyetDinhCuoc(
      cuoc, ctx, kyVongVongNay(ctx, ctx.ghe.danh_muc, 'hieu_chinh'), HUNG_HANG_DO_TIN),
  },
  /*
   * BỎ SỚM — thấy Vốn tụt là cắt để bảo toàn.
   *
   * ⚠ Dùng VỐN CỦA CHÍNH MÌNH làm proxy cho "tụt hạng", không phải hạng thật:
   * `BoiCanh` cố tình không mang vốn của ghế khác, và nới nó ra thì phải sửa
   * `holdem_api.ts` — ngoài phạm vi đợt đo này. Vốn tụt là tín hiệu CÙNG CHIỀU
   * với tụt hạng (Quỹ vòng chia theo hạng, thua hạng thì vốn ra đi), chỉ chậm
   * hơn một nhịp. Khai rõ ở đây để không ai đọc bảng kết quả rồi tưởng con này
   * nhìn được bảng xếp hạng.
   */
  {
    id: 'bo_bai_som', label: 'Bỏ sớm', nhom: 'di_von',
    chonThe: chonTheDiVon,
    chonCamKet: (ctx) => (ctx.ghe.von < applyBpInt(HOLDEM_MATCH.START_VON, NGUONG_BAO_TOAN_BP)
      ? { ghe_id: ctx.ghe.id, hanh_dong: 'cat_lo', them: 0 }
      : giu(ctx)),
    chonCuoc: (cuoc, ctx) => {
      if (cuoc.con_thieu <= 0) return { loai: 'theo' };
      const dat = cuoc.con_thieu > applyBpInt(ctx.ghe.von, NGUONG_THEO_DAT_BP);
      return dat && cuoc.duoc.includes('bo') ? { loai: 'bo' } : { loai: 'theo' };
    },
  },
  /*
   * ALL-IN VÔ NÃO — ĐỐI CHỨNG, founder gọi thẳng tên ("đừng cho kiểu vô não
   * all-in"). Dồn hết ngay khi cổng D34 mở. Nếu con này KHÔNG bét thì cơ chế
   * đang thưởng cho việc bỏ suy nghĩ, và đó là bệnh chứ không phải kết quả.
   */
  {
    id: 'all_in_vo_nao', label: 'All-in vô não', nhom: 'di_von',
    chonThe: chonTheDiVon,
    // Engine mới là nơi kẹp trần (A4 — một nguồn chân lý); bot cứ đề xuất hết vốn.
    chonCamKet: (ctx) => tang(ctx, ctx.ghe.von),
    chonCuoc: (cuoc) => (cuoc.duoc.includes('to') && cuoc.to_toi_da > cuoc.con_thieu
      ? { loai: 'to', them: cuoc.to_toi_da }
      : { loai: 'theo' }),
  },
] as const;

export const TAT_CA_BOT: readonly Bot[] = [
  /*
   * ⚠ `BOT_NGAN_HANG` CÓ trong sổ tra (`timBot` phải thấy chúng để bàn đo dựng được),
   * nhưng KHÔNG có trong `BOT_CHOI_DUOC` — nơi trận thật bốc ghế máy. Hai danh sách
   * khác nhau là cố ý: thêm vào `BOT_CHOI_DUOC` là đổi dàn đối thủ của mọi trận đang
   * chạy, tức đổi hành vi bot ngoài cổng luật (D80).
   */
  ...BOT_THAM_CHIEU, ...BOT_TIN_HIEU, ...BOT_CHOI_DUOC, ...BOT_DI_VON, ...BOT_NGAN_HANG,
];

export function timBot(id: string): Bot | undefined {
  return TAT_CA_BOT.find((b) => b.id === id);
}

// ---------------------------------------------------------------------------
// Chạy nhịp 1 cho bot
// ---------------------------------------------------------------------------

/**
 * Bot chơi trọn nhịp 1: xem shop, quyết Tái cơ cấu hay Giữ nguyên, mua thẻ.
 * Bot chỉ khảo sát lại khi lượt đầu không có gì dùng được VÀ còn Lượt khảo sát
 * — không đốt tài nguyên vô cớ.
 */
export function botTaiCoCau(bot: Bot, ctx: BoiCanh): {
  danh_muc: DanhMuc; luot_khao_sat: number; da_mua: string | null;
} {
  let shop = ctx.shop;
  let luot = ctx.ghe.luot_khao_sat;
  if (ctx.khoaLoi === true) return { danh_muc: ctx.ghe.danh_muc, luot_khao_sat: luot, da_mua: null };

  for (let lan = 0; lan < 3; lan += 1) {
    const chon = bot.chonThe({ ...ctx, shop });
    if (chon) {
      const kq = muaAnToan(ctx.ghe.danh_muc, shop, chon, ctx.maxLoi);
      if (kq) return { danh_muc: kq, luot_khao_sat: luot, da_mua: chon };
    }
    const chiPhi = lan === 0 ? 0 : 2;
    if (luot < chiPhi + 2) break; // giữ lại chút Lượt khảo sát cho vòng sau
    luot -= chiPhi;
    shop = bayShop(ctx.seed, ctx.vong, ctx.ghe.id, lan + 1, ctx.ghe.danh_muc,
      { gianLa: ctx.gianLa === true, loiGon: ctx.loiGon === true });
    if (ctx.camDonBay) shop = { ...shop, chien_thuat: shop.chien_thuat.filter((id) => id !== 'don_bay') };   // D498
  }
  return { danh_muc: ctx.ghe.danh_muc, luot_khao_sat: luot, da_mua: null };
}

/**
 * Bot mua thẻ — GỌI THẲNG `mua` của shop.ts, không nhân bản luật.
 *
 * ⚠ Bản cũ chép lại luật sức chứa vào đây, viện lý do "import vòng". KHÔNG CÓ
 * import vòng nào cả: shop.ts không hề đụng bots.ts. Lý do đó sai, và bản sao
 * ấy đã TRÔI khỏi luật thật:
 *
 *   chép:  tài sản >= 3   ·  chiến thuật >= 3 ô  ·  >= 2 bản sao
 *   thật:  MAX_TAI_SAN 4  ·  MAX_CHIEN_THUAT 2   ·  MAX_BAN_SAO 3
 *
 * Hậu quả đo được: bot CHƯA BAO GIỜ cầm đủ 4 tài sản và CHƯA BAO GIỜ stack tới
 * cấp 3 — tức là mọi con số Monte Carlo tôi đã báo lên founder đều đo trên một
 * bàn bị chấp một ô danh mục, sau khi luật stack đã đổi.
 *
 * Đây đúng lớp lỗi A8.9 cấm: hai nguồn chân lý cho cùng một luật, rồi một bản
 * lặng lẽ lạc hậu. Cùng họ với lỗi `tu_the` hôm nay (ép kiểu che mất trường
 * thiếu). Nay chỉ còn MỘT nguồn.
 */
function muaAnToan(dm: DanhMuc, shop: ShopVong, theId: string, maxLoi?: number): DanhMuc | null {
  const kq = mua(dm, shop, theId, maxLoi === undefined ? undefined : { maxLoi });
  return kq.ok ? kq.danh_muc : null;
}

/** Nhãn tài sản — tiện cho log/Monte Carlo. */
export function nhanTaiSan(id: string): string {
  return TAI_SAN.find((t) => t.id === id)?.label ?? id;
}

/**
 * v10 NAV — CHÍNH SÁCH PHÂN BỔ CỦA BOT, tất định (không rng: suy từ vòng + ưu
 * tiên nên replay tự khớp). Đây là HÀNH VI BOT, không phải tham số kinh tế —
 * MC-tune khi đo lại gate trên v10 (D40: "mọi số cân bằng đo hôm nay phải đo
 * lại"). Bản 1 cố ý ĐƠN GIẢN: đủ để thị trường sống (có chen chúc, có phí nuôi
 * Quỹ vòng), chưa nhằm chơi hay.
 *
 * · mỗi vòng đầu tư 50% tiền mặt vào mã ưu tiên, luân phiên theo vòng;
 * · riêng `tat_tay` dồn 100% — đúng danh tính lá bài của nó;
 * · đầy trần mã thì mua thêm mã ĐANG giữ thay vì mở mã mới.
 */
/**
 * D56 — BỐI CẢNH MÀ BOT DÙNG ĐỂ QUYẾT MUA GÌ (founder chốt phương án A 02/08).
 *
 * ⚠ ĐÂY LÀ NƠI GRADIENT KỸ NĂNG SỐNG, KHÔNG PHẢI Ở CÔNG THỨC CHẤM ĐIỂM.
 * Mọi bot dùng CHUNG một hàm chấm điểm; khác nhau ở thứ được đưa vào:
 * oracle nhận ô THẬT (`biet_that_gia`), bot thường nhận ô đã lọc và phải tự
 * chiết khấu theo xác suất tin giả. Làm ngược lại — mỗi bot một công thức —
 * là tự bịt mắt gate: khi oracle thắng thì không biết nó thắng nhờ BIẾT
 * TRƯỚC hay nhờ được viết cho một chính sách khôn hơn.
 */
export interface BoiCanhLenh {
  /** v55 (D425) — GÔNG CÙM của chính bot: tiền BÁN (chip) còn được trong vòng — lệnh thoát kẹp về số này, mã tệ nhất trước. */
  tran_ban_con?: number;
  /** v55 (D425) — SỔ MỎNG của chính bot: phí cố định (chip) mỗi lệnh — lệnh MUA không quá hai lần phí thì bỏ. */
  phi_co_dinh_lenh?: number;
  /**
   * v24 — cấp vốn theo ĐỘ TIN thay vì mốc cứng (D58). Vắng ⇒ mốc cứng như
   * v22/v23, nên trận cũ replay không đổi một chip.
   */
  co_vi_the?: boolean;
  /** Ô vòng này theo ĐÚNG góc nhìn của bot (đã lọc `la_tin_gia`, trừ oracle). */
  o: OThiTruong;
  /** Dư âm tin cũ. Thật/giả ở đây đã LỘ từ vòng kế nên công bằng mọi ghế. */
  echo: readonly { su_kien: string; do_lon_bp: number; dao: boolean }[];
  /**
   * v28 — tỷ lệ tin giả HIỆU DỤNG (bp) của chính ô này theo luật CÔNG KHAI
   * (`tyLeTinGiaHieuDung`: bối cảnh × loại sự kiện × môi trường tiền tệ).
   * Vắng ⇒ chiết khấu theo bối cảnh như v22–v27 — trận cũ replay nguyên.
   * ⚠ Người dựng bối cảnh phải tính từ mức lãi TRƯỚC ô này (mức lúc rút),
   * không phải mức sau — mức sau nhúc nhích là lộ thật/giả (máy dò G4).
   */
  ty_le_gia_bp?: number;
  /**
   * BẢNG CÂN TRÔI ĐANG HIỆU LỰC — do người dựng bối cảnh cấp (`bangCanTroi`).
   *
   * ⚠⚠ VẮNG ⇒ rơi về `CAN_TROI_BP` (v21), và đó chính là LỖI vừa vá: từ v23
   * engine định giá bằng `CAN_TROI_BP_V23` trong khi bot chấm điểm mã bằng
   * bảng v21 — bot mua theo một bảng rồi bị chấm bằng bảng khác, nên gate
   * G1/G4 đo chênh lệch giữa hai bảng chứ không đo kỹ năng đọc bối cảnh.
   * Giữ đường lùi vì trận ĐÃ LƯU chạy luật cũ phải replay ra đúng vị thế bot
   * cũ (hành vi bot không nằm trong `action_log`, nó được SUY LẠI mỗi lần).
   */
  can_troi?: Readonly<Record<string, number>>;
  /**
   * v41 (D307) — LỚP VN, cùng lý do MỘT NGUỒN với `can_troi` ngay trên: chọn
   * bảng Tài sản×Giai đoạn / Tài sản×Sự kiện qua `mtGiaiDoan`/`mtSuKien`.
   * Vắng ⇒ bảng toàn cầu cũ, trận cũ replay nguyên.
   */
  lop_vn?: boolean;
  /** v42 (D311) — xem `TrangThaiTran.tai_san_v42`. Cùng cửa `boMaTranCua`. */
  tai_san_v42?: boolean;
  /** v64 (D560) — xem `TrangThaiTran.chu_ky_co_ngoi`. Cùng cửa `boMaTranCua` (đến qua `coV42ChoBot`). */
  chu_ky_co_ngoi?: boolean;
  /**
   * v42 (D311) — SUẤT COUPON mỗi ô (bp), do người dựng bối cảnh cấp từ `couponBpCua(st)`.
   *
   * ⚠⚠ VẮNG KHI ENGINE ĐANG TRẢ COUPON LÀ LỖI IM LẶNG — đúng lớp lỗi `can_troi` v21↔v23
   * và `nen` R3 ngay trên. Trái phiếu Mỹ ở v42 có hàng giá GIÁ-THUẦN (âm ở `tang` và
   * `phuc_hoi`), nên bot không biết coupon sẽ thấy nó là một mã dở toàn tập và KHÔNG BAO
   * GIỜ mua — trong khi engine vẫn trả lãi cho nó mỗi ô. Gate khi ấy đo "bot mù trái
   * phiếu", không đo kỹ năng. Vắng ⇒ 0, trận cũ replay nguyên.
   */
  coupon_bp?: number;
  /**
   * v42 (D311) — TIỀN MẶT có bị ăn ở vòng này không (cờ; độ lớn bot tự suy từ `o`/`echo`).
   * Vắng ⇒ bot đọc y như v41: giữ tiền mặt là miễn phí ngoài lạm phát nền.
   */
  tien_mat_su_kien?: boolean;
  /**
   * v36 R3 (D166) — NỀN REGIME đang chạy ở vòng này. Vắng ⇒ bot đọc y như
   * v35 (vòng tin = chỉ tin) và trận cũ replay nguyên.
   *
   * ⚠⚠ VẮNG KHI ENGINE ĐANG BẬT `gia_chong_nen` LÀ LỖI IM LẶNG (D152 xếp R3
   * vào nhóm "vỡ im lặng"): engine định giá vòng tin bằng NỀN + TIN, bot chấm
   * mã bằng TIN không — mọi số gate sau đó đo bot-mù chứ không đo kỹ năng.
   * Đúng lớp lỗi `can_troi` v21↔v23 ngay trên. `apNhipLenhBotNav` cấp trường
   * này từ CHÍNH `st` nên hai đường không thể lệch.
   */
  nen?: string;
  /** Chỉ oracle: `o` là ô THẬT, đọc thẳng `la_tin_gia` thay vì chiết khấu. */
  biet_that_gia?: boolean;
  /**
   * v53 (D373) — Ô CỦA VÒNG CÒN ÚP. Có trường này nghĩa là `o` KHÔNG phải ô thật của vòng:
   * nó là ô KỲ VỌNG (`kind: 'giai_doan'`, pha = chuỗi đang chạy tiếp), và khối này mang phần
   * tin tức để bot nghiêng kỳ vọng ấy.
   *
   * ⚠ VÌ SAO KHÔNG CẤP THẲNG Ô THẬT CHO BOT: úp với người mà không úp với bot là phát vốn
   * cho bot, và mọi số gate sau đó đo "ai nhiều thông tin hơn" chứ không đo kỹ năng (đúng
   * lớp lỗi `can_troi` v21↔v23 đã ghi ở trên, chỉ khác là lần này lệch về phía bot).
   *
   * ⚠ VÌ SAO `o` VẪN LÀ MỘT Ô PHA THẬT SỰ chứ không phải `null`: mọi người đọc `bc.o` khác
   * (`heSoTin` · `giaTienMatBp` · `boMaTranCua`) khi ấy tự động đọc ra "vòng này không có
   * tin" — đúng thứ bot ĐƯỢC PHÉP biết. Cho `null` thì mỗi chỗ phải tự phân nhánh, và chỗ
   * quên phân nhánh sẽ là chỗ rò.
   */
  up?: {
    /** Pha mà lá tin VỪA LẬT báo trước. `null` = ô vừa lật không phải tin ⇒ không có lời báo. */
    bao_truoc: GiaiDoanId | null;
    /** Tỷ lệ tin giả hiệu dụng (bp) của chính lá tin vừa lật. Vắng ⇒ rơi về 35% phẳng. */
    ty_le_gia_bp?: number;
    /** CHỈ oracle: lá tin vừa lật có THẬT không. Vắng ⇒ bot phải tự chiết khấu. */
    that?: boolean;
  };
  /**
   * v34 — MANDATE của vai TỔ CHỨC (bp của NAV, `mandateCua`). Có ⇒ bot RẢI vốn
   * vào các mã điểm dương theo thứ tự, mỗi mã ≤ trần. Không cấp thì bot tổ chức
   * dồn một mã, bị engine từ chối mọi lệnh và phép đo vai thành rỗng.
   */
  tran_ma_bp?: number;
}

/**
 * HỆ SỐ TIN vào ô SỰ KIỆN của vòng này. Đây là toàn bộ khác biệt giữa ba bot
 * tín hiệu — và nó là một phép toán, không phải một tính cách gán tay.
 *
 * Tin giả ĐẢO DẤU tác động, nên với xác suất tin giả p thì kỳ vọng của một
 * tin là (1−p)·X + p·(−X) = (1−2p)·X. Vậy:
 *   · hoài nghi hiệu chỉnh → đúng (1−2p): mức tin ĐÚNG về mặt toán;
 *   · tin mọi tin          → 1: cầm chắc quá tay đúng p phần;
 *   · phớt mọi tin         → 0: bỏ luôn tín hiệu, kể cả phần thật.
 * Bot chơi được dùng mức đúng — chúng là đối thủ, không phải dụng cụ đo.
 */
/**
 * v53 (D373) — BOT TIN LỜI BÁO TRƯỚC TỚI ĐÂU (bp, 0..10000).
 *
 * Khác `heSoTin` một chỗ QUAN TRỌNG: tin giả **không đảo** lời báo, nó chỉ **không kéo gì**
 * (`map.ts` — telegraph chỉ nghiêng ô kế khi `!la_tin_gia`). Nên mức tin ĐÚNG về mặt toán ở
 * đây là (1−p), không phải (1−2p) như khi tin đang nổ vào giá.
 *
 * Ba dụng cụ đo giữ nguyên danh tính, nên G4 vẫn có nghĩa — chỉ đổi thứ được đọc:
 *   · tin mọi tin → 1     (ăn trọn lời báo, sai đúng p phần)
 *   · phớt mọi tin → 0    (bỏ cả phần thật, chỉ đọc chuỗi)
 *   · hoài nghi   → 1−p   (mức đúng)
 *   · oracle      → 1 hoặc 0 theo `that`
 */
function trongSoBaoTruocBp(bot: Bot, up: NonNullable<BoiCanhLenh['up']>): number {
  const { THAT_BP: that, BIA_BP: bia } = TELEGRAPH_V53;
  // Oracle biết thật/giả ⇒ lệch trọn một trong hai phía. Đây là ĐỈNH thang kỹ năng ở v53.
  if (up.that !== undefined) return up.that ? that : -bia;
  if (bot.id === 'phot_moi_tin') return 0;
  // "Tin mọi tin" cược như thể mọi lời báo đều thật — sai đúng p phần, và p phần ấy lệch NGƯỢC.
  if (bot.id === 'tin_moi_tin') return that;
  /*
   * HOÀI NGHI HIỆU CHỈNH = kỳ vọng ĐÚNG: (1−p)·THẬT − p·BỊA.
   * ⚠ Vế trừ là chỗ bản đầu sai. Nó trả về `max(0, 10000 − p)`, tức coi lời báo của tin bịa
   *   là vô giá trị. Đo (`scripts/do_telegraph.ts`) nói nó ÂM: sau tin bịa, ô kế đi NGƯỢC lời
   *   báo nhiều hơn mức nền 10–19 điểm %. Bỏ vế trừ là để bot cược to gấp ba lần mức đáng cược.
   * ⚠ KHÔNG kẹp về 0: p đủ lớn thì mức tin ĐÚNG là ÂM — lệch ngược lời báo. Kẹp 0 là cấm bot
   *   đọc ra điều mà chính bảng đo đang nói.
   */
  const p = up.ty_le_gia_bp ?? 3500;
  return Math.round(((10000 - p) * that - p * bia) / 10000);
}

function heSoTin(bot: Bot, bc: BoiCanhLenh): number {
  if (bc.o.kind !== 'su_kien') return 0;
  if (bc.biet_that_gia === true) return bc.o.la_tin_gia ? -1 : 1;
  if (bot.id === 'phot_moi_tin') return 0;
  if (bot.id === 'tin_moi_tin') return 1;
  // v28: tỷ lệ hiệu dụng theo loại sự kiện nếu người dựng bối cảnh đưa vào —
  // bot hiệu chỉnh phải hiệu chỉnh theo luật ĐANG CHẠY, không theo luật cũ.
  const p = (bc.ty_le_gia_bp
    ?? TY_LE_TIN_GIA_THEO_BOI_CANH[bc.o.boi_canh] ?? 3500) / 10000;
  return 1 - 2 * p;
}

/**
 * LỢI SUẤT KỲ VỌNG (bp) của một mã ở vòng này, đọc từ ĐÚNG những thứ người
 * chơi nhìn thấy: ô đang lật + dư âm tin cũ + lệch nền của mã.
 *
 * CỐ Ý KHÔNG hoàn hảo. Nó bỏ qua sức căng, quán tính, chen chúc, xung đột lá
 * — tức bot đọc được HÌNH DẠNG thị trường chứ không giải ngược được engine.
 * Bot giải ngược engine thì gate đo "ai có nhiều thông tin hơn", trong khi
 * thứ cần đo là "ai đọc bối cảnh giỏi hơn" (A1).
 */
/**
 * v42 (D311) — lợi suất kỳ vọng của TIỀN MẶT ở vòng này (bp, thường âm).
 *
 * Cùng hàng `TIEN_MAT_SU_KIEN` engine dùng, nhưng đọc từ BỐI CẢNH CỦA BOT: ô của
 * `bc.o` đã bị che `la_tin_gia` (trừ oracle) và `bc.echo` là dư âm công khai. Đó là
 * đúng tập thông tin bot được phép có — dùng `st` thật ở đây là phát cho bot một máy
 * dò tin giả miễn phí, và phép đo G4 chết theo.
 */
function giaTienMatBp(bc: BoiCanhLenh): number {
  let bp = bc.o.kind === 'su_kien'
    ? (TIEN_MAT_SU_KIEN.MT[bc.o.su_kien as SuKienId] ?? 0) : 0;
  for (const e of bc.echo) {
    const x = TIEN_MAT_SU_KIEN.MT[e.su_kien as SuKienId] ?? 0;
    bp += Math.round((x * e.do_lon_bp) / 10000) * (e.dao ? -1 : 1);
  }
  return bp;
}

export function loiSuatKyVongBp(ma: string, bot: Bot, bc: BoiCanhLenh): number {
  // v41/v42 — BỘ MA TRẬN: suy từ CHÍNH bối cảnh lệnh (bc), một cửa `boMaTranCua`.
  const bo = boMaTranCua(bc);
  // CÙNG bảng mà engine định giá — xem `BoiCanhLenh.can_troi`.
  let bp = (bc.can_troi ?? CAN_TROI_BP)[ma] ?? 0;
  if (bc.o.kind === 'giai_doan') {
    // D560 — tính chất lá pha (khoá v64): CÙNG khoản lệch engine cộng (`TINH_CHAT_PHA_BP`), một cửa với bảng giá.
    const nen = (mtGiaiDoan(bo)[ma]?.[bc.o.giai_doan] ?? 0)
      + (bo === 'v64' && bc.o.tinh_chat ? lechTinhChatBp(bc.o.tinh_chat, ma) : 0);
    /*
     * v53 (D373) — Ô ÚP: điểm của mã là TRỘN giữa "chuỗi chạy tiếp" (nền) và "lời báo của lá
     * tin vừa lật", theo đúng mức bot tin lời báo ấy. Không có lời báo ⇒ chỉ còn nền.
     *
     * ⚠ CỐ Ý KHÔNG đoán ô kế có phải Ô TIN không (35% số ô, map 8 là 56%). Bot đọc HÌNH DẠNG
     * thị trường, không giải ngược máy sinh map — xem docstring hàm này. Cho bot rải xác suất
     * lên 12 loại tin là biến nó thành người biết luật rút bài, và gate lại đo nhầm thứ.
     */
    if (bc.up) {
      /*
       * ⚠⚠ TELEGRAPH CHỈ ĐỔI HƯỚNG ĐƯỢC KHI CHỢ ĐANG ĐI NGANG — đọc thẳng từ máy sinh map,
       * không phải một giả định cho tiện:
       *   · nền đang chạy (`run_huong ≠ 0`): `SUC_MANH_TELEGRAPH_BP` chỉ cộng vào trọng số
       *     của mặt THUẬN nền (`map.ts`, nhánh "NỀN SỐNG"). Lời báo ngược nền KHÔNG kéo được
       *     gì cả ⇒ bot đi theo nó là tự bỏ nền để đuổi một tín hiệu không tồn tại.
       *   · nền đi ngang: `NGANG_MO_TELEGRAPH_X_BP` nhân vào đúng cửa mở theo hướng được báo
       *     ⇒ đây mới là chỗ lời báo thật sự chỉ hướng.
       * ⚠ ĐÃ THỬ HẸP LẠI (chỉ cho lời báo đổi hướng khi nền ĐI NGANG) và gate 500 trận ra TỆ
       * HƠN (G1 đỏ thêm: 45,2 vs 40,3). Nên bản đang chạy là bản TRỘN THẲNG, và cái cần sửa
       * nằm chỗ khác: ở v53, oracle 3,22 TỆ HƠN nhóm chơi-được 2,87 — ngay cả người đọc tin
       * HOÀN HẢO cũng thua, tức chiến lược theo tín hiệu TỰ NÓ đang âm. Xem D373 §Nghiệm thu.
       */
      const bt = bc.up.bao_truoc !== null
        ? (mtGiaiDoan(bo)[ma]?.[bc.up.bao_truoc] ?? nen) : nen;
      const w = trongSoBaoTruocBp(bot, bc.up);
      bp += nen + Math.round(((bt - nen) * w) / 10000);
    } else bp += nen;
  } else {
    const tin = mtSuKien(bo)[ma]?.[bc.o.su_kien] ?? 0;
    /*
     * v36 R3 BẢN C (D172) — nền NHÂN vào lực tin, đọc CÙNG hàm engine dùng
     * (`heSoTinTheoNenThuan`). Bản cũ CỘNG nền vào điểm mã; nhân thì bot vẫn
     * chấm đúng thứ engine sắp tính. Một nguồn, hai người đọc (D61).
     */
    const tinTheoNen = bc.nen !== undefined
      ? applyBpInt(tin, heSoTinTheoNenThuan(bc.nen, bc.o.bao_truoc)) : tin;
    bp += Math.round(tinTheoNen * heSoTin(bot, bc));
  }
  for (const e of bc.echo) {
    const x = mtSuKien(bo)[ma]?.[e.su_kien as SuKienId] ?? 0;
    bp += Math.round((x * e.do_lon_bp) / 10000) * (e.dao ? -1 : 1);
  }
  /*
   * v42 (D311) — COUPON vào kỳ vọng của mã trả dòng tiền.
   *
   * Cộng THẲNG vào bp lợi suất kỳ vọng chứ không làm một kênh riêng: với người cầm,
   * 200 bp coupon và 200 bp giá lên là cùng một số tiền vào cuối vòng. Engine tính
   * chúng ở hai chỗ khác nhau (giá qua `apDinhGia`, coupon qua `apCoupon`) nhưng cả
   * hai đều rơi vào NAV — mà NAV là thứ bot bị chấm.
   * ⚠ Không trừ phần sổ khống: bot mùa này chưa từng mở khống (D80).
   */
  if ((bc.coupon_bp ?? 0) !== 0
    && TAI_SAN.find((t) => t.id === ma)?.dong_tien === 'coupon') {
    bp += bc.coupon_bp!;
  }
  /*
   * v42 (D311) — GIÁ CỦA VIỆC GIỮ TIỀN MẶT.
   *
   * Từ v42, ô lạm phát ăn thẳng vào tiền mặt tự do. Cái đó không làm mã nào tốt lên,
   * nhưng nó làm PHƯƠNG ÁN THAY THẾ (ngồi ôm tiền) xấu đi — nên thứ đúng để so là
   * LỢI SUẤT VƯỢT TRỘI so với tiền mặt, tức trừ đi lợi suất của tiền mặt. Trừ ĐỀU cho
   * mọi mã nên thứ hạng giữa các mã không đổi; cái đổi là ngưỡng "có đáng mua gì không".
   * Bot suy từ CHÍNH thông tin nó có (`bc.o` đã bị che `la_tin_gia`, `bc.echo`), không
   * đọc ô thật — cấp cho nó ô thật là phát miễn phí một máy dò tin giả (giết G4).
   */
  if (bc.tien_mat_su_kien === true) bp -= giaTienMatBp(bc);
  return bp;
}

export function lenhBotNav(
  bot: Bot, ghe: { von: number; vi_the: Record<string, number> },
  vong: number, maxTaiSan: number,
  /**
   * v22 — vắng ⇒ CHÍNH SÁCH VÒNG TRÒN CŨ, nguyên văn. Trận lưu ở version
   * ≤ v21 replay đúng vị thế bot nó từng có (xem `botDocTin`).
   */
  bc?: BoiCanhLenh,
): { ma: string; tien: number }[] {
  /*
   * ⚠ HAI DỤNG CỤ ĐO PHẢI GIỮ ĐÚNG DANH TÍNH CỦA CHÚNG (vá 02/08, bản đầu
   * của v22 đã hỏng đúng chỗ này). Cho MỌI bot dùng chung chính sách đọc bối
   * cảnh thì "Ngồi im" hoá ra có giao dịch và "Bấm bừa" hoá ra giao dịch
   * GIỎI (nó không có gu nên không bị gu kéo lệch) — G3 xanh trên một con bot
   * không hề ngồi im, còn G2 đỏ vì cái sàn của nó bò lên trên đầu nhóm chơi
   * được. Đúng lớp lỗi vừa bắt ở D55: thước không đo thứ mình tưởng.
   *
   * Nên danh tính khai ngay trên bot, và CHỈ áp khi có bối cảnh (v22+) để
   * trận cũ replay không đổi một chip.
   */
  if (bc) {
    if (bot.von_khong_doc === 'khong') return [];
    if (bot.von_khong_doc !== 'mu') return lenhTheoBoiCanh(bot, ghe, maxTaiSan, bc);
  }
  /*
   * CHỪA LẠI PHẦN NỀN: nhịp giao dịch chạy TRƯỚC vòng thu nền, bot dồn sạch
   * tiền mặt là không còn gì đóng vào Quỹ vòng — pot hụt đúng phần của nó
   * (test API bắt được: quỹ 1.704 thay vì ≥ 2.000). Nền là cơ chế TẠM
   * (spec 01 §6.2, chờ founder chốt cỡ Quỹ); khi nền chết thì bỏ dòng trừ này.
   */
  const coSo = Math.max(0, ghe.von - HOLDEM_MATCH.CAM_KET_NEN);
  if (coSo < 200) return [];
  const uuTien = bot.uu_tien && bot.uu_tien.length > 0
    ? bot.uu_tien : TAI_SAN.map((t) => t.id);
  const tien = tienTuMoc(bot.id === 'tat_tay' ? 10000 : 5000, coSo);
  if (tien <= 0) return [];
  const dang = Object.keys(ghe.vi_the);
  let ma = uuTien[(vong - 1) % uuTien.length]!;
  if (!dang.includes(ma) && dang.length >= maxTaiSan) {
    ma = dang[(vong - 1) % dang.length]!;
  }
  return [{ ma, tien }];
}

/**
 * v22 — CHÍNH SÁCH ĐỌC BỐI CẢNH. Hai nước, đúng thứ tự của nghề:
 *   1. THOÁT trước — bán sạch mã đang cầm mà bối cảnh đang đạp (điểm < 0).
 *      Bán trước mua vì tiền bán chính là tiền để mua, và vì cú thoát kịp
 *      lúc mới là chỗ hiểu biết biến thành tiền (không có nước này thì
 *      oracle biết trước cú sập mà vẫn ngồi chịu — G2 không đo được gì).
 *   2. VÀO mã điểm cao nhất, và CHỈ khi điểm dương. Không có mã nào đáng
 *      thì đứng ngoài: tiền mặt chịu lạm phát nhưng không chịu trượt giá.
 *
 * `uu_tien` GIỮ NGUYÊN vai trò nhưng đổi nghĩa: từ vòng quay mù nó thành
 * THIÊN VỊ TÍNH CÁCH (cộng điểm cho mã hợp gu). Nhờ vậy "Phòng thủ" vẫn
 * nghiêng về vàng/USD, "Tất tay" vẫn nghiêng BTC — bàn giữ được sự đa dạng
 * mà D21 nói là dấu hiệu cân bằng khoẻ — nhưng khi bối cảnh đủ xấu thì
 * chúng vẫn bỏ mã ruột. Thiên vị, không phải mù quáng.
 */
const THIEN_VI_GU_BP = doThamSo('BOT_THIEN_VI_GU_BP', 300);

function lenhTheoBoiCanh(
  bot: Bot, ghe: { von: number; vi_the: Record<string, number> },
  maxTaiSan: number, bc: BoiCanhLenh,
): { ma: string; tien: number }[] {
  const gu = new Set(bot.uu_tien ?? []);
  const diem = (ma: string): number =>
    loiSuatKyVongBp(ma, bot, bc) + (gu.has(ma) ? THIEN_VI_GU_BP : 0);

  const ra: { ma: string; tien: number }[] = [];
  const dang = Object.keys(ghe.vi_the);
  let tienMat = ghe.von;
  // v55 (D425) — SỔ MỎNG của chính bot: phí cố định mỗi lệnh (0 = không mang lá).
  const phiCoDinh = bc.phi_co_dinh_lenh ?? 0;
  // v55 (D425) — GÔNG CÙM: phần BÁN còn được của vòng; thoát mã điểm tệ nhất trước, lệnh cuối kẹp về phần còn lại.
  let banCon = bc.tran_ban_con ?? Number.POSITIVE_INFINITY;
  const thuTuThoat = bc.tran_ban_con === undefined ? dang : [...dang].sort((a, b) => diem(a) - diem(b));
  for (const ma of thuTuThoat) {
    const gt = ghe.vi_the[ma] ?? 0;
    if (gt > 0 && diem(ma) < 0) {
      const ban = Math.min(gt, banCon);
      if (ban <= 0) continue;
      ra.push({ ma, tien: -ban });
      banCon -= ban;
      // xấp xỉ: chưa trừ trượt giá, chỉ dùng để định cỡ lệnh mua — nhưng trừ phí cố định (biết chắc, không phải ước).
      tienMat += phiCoDinh > 0 ? Math.max(0, ban - phiCoDinh) : ban;
    }
  }
  // Mã còn cầm = chưa bán HẾT (GÔNG CÙM có thể chỉ bán được một phần). Không trần ⇒ lệnh thoát luôn trọn ⇒ y bản cũ.
  const conCam = dang.filter((m) => !ra.some((l) => l.ma === m && -l.tien >= (ghe.vi_the[m] ?? 0)));

  // Nền vẫn phải chừa — xem lý do ở `lenhBotNav`.
  const coSo = Math.max(0, tienMat - HOLDEM_MATCH.CAM_KET_NEN);
  if (coSo < 200) return ra;

  let ungVien = TAI_SAN.map((t) => t.id);
  if (conCam.length >= maxTaiSan) ungVien = conCam; // đầy trần ⇒ chỉ dồn thêm
  let tot = ungVien[0]!;
  for (const m of ungVien) if (diem(m) > diem(tot)) tot = m;
  if (diem(tot) <= 0) return ra;

  const tien = tienTuMoc(mocCua(bot, diem(tot), bc), coSo);
  // v55 (D425) — SỔ MỎNG: lệnh MUA không quá hai lần phí cố định thì bỏ (dưới) — engine bác lệnh không đủ trả phí, và một
  // lệnh bị bác là cả chuỗi của bot rơi (bot mất trọn vòng chứ không chỉ lệnh ấy).
  if (bc.tran_ma_bp !== undefined) {
    /*
     * v34 — TỔ CHỨC: rải ngân sách vào các mã điểm dương theo thứ tự điểm, mỗi
     * mã ≤ trần %NAV (ước NAV sau khi thoát; chừa 5% cho trượt giá làm NAV co —
     * engine kiểm trên NAV SAU lệnh nên sát trần là bị từ chối cả chuỗi).
     */
    // D425 — NAV ước = tiền mặt + mọi vị thế TRƯỚC khi thoát (bán chỉ đổi vị thế ra tiền; trượt bỏ qua như `tienMat`):
    // không trần bán thì đúng bằng số cũ, có GÔNG CÙM thì mã bán dở không bị đếm hai lần.
    const navUoc = ghe.von + dang.reduce((t, m) => t + (ghe.vi_the[m] ?? 0), 0);
    const tran = Math.floor((Math.floor((navUoc * bc.tran_ma_bp) / 10000) * 95) / 100);
    const xep = ungVien.filter((m) => diem(m) > 0).sort((x, y) => diem(y) - diem(x));
    let conTien = tien;
    let soMa = conCam.length;
    for (const m of xep) {
      if (conTien < 200) break;
      if (!conCam.includes(m) && soMa >= maxTaiSan) continue;
      const cho = Math.max(0, tran - (conCam.includes(m) ? (ghe.vi_the[m] ?? 0) : 0));
      const t = Math.min(conTien, cho);
      if (t < 200 || t <= 2 * phiCoDinh) continue;
      ra.push({ ma: m, tien: t });
      conTien -= t;
      if (!conCam.includes(m)) soMa += 1;
    }
    return ra;
  }
  if (tien > 0 && tien > 2 * phiCoDinh) ra.push({ ma: tot, tien });
  return ra;
}

/**
 * v24 — MỐC CẤP VỐN. Trước bản này là hằng số: 50% cho mọi bot, 100% cho
 * "Tất tay". Nghĩa là BIẾT NHIỀU HƠN không đổi được thành TIỀN NHIỀU HƠN —
 * và đó chính là lý do oracle xếp dưới hai bot chơi được ở v22/v23: nó vào
 * đúng mã nhưng vào bằng đúng số tiền như người đoán mò.
 *
 * ⚠ "Tất tay" GIỮ NGUYÊN 100% ở mọi nhánh. Đó là DANH TÍNH lá bài của nó
 * (một con bot dồn hết bất kể tin gì), và nó cũng là mốc so sánh cho câu hỏi
 * "cỡ lệnh có kỷ luật có thắng nổi dồn hết không". Cho nó biết điều tiết là
 * mất luôn cả hai vai — đúng lớp lỗi `von_khong_doc` vừa vá ở D56.
 */
function mocCua(bot: Bot, diem: number, bc: BoiCanhLenh): number {
  if (bot.id === 'tat_tay') return 10000;
  if (bc.co_vi_the !== true) return 5000;
  const { DIEM_DAY_DU_BP, MOC_SAN_BP, MOC_TRAN_BP } = CO_VI_THE;
  const t = Math.min(1, Math.max(0, diem / DIEM_DAY_DU_BP));
  const moc = MOC_SAN_BP + (MOC_TRAN_BP - MOC_SAN_BP) * t;
  return Math.min(10000, Math.max(0, Math.round(moc)));
}

/**
 * v55 (D409) — BOT CHỌN TRAIT ở mốc. Không có phần này thì gate G8 đo một trò chỉ NGƯỜI mới có trait (bẫy D55).
 * Chính sách cố định, tất định: bot tham chiếu (ngồi im · oracle · chạy sớm) KHÔNG lấy — mốc đối chứng; 'bấm bừa' lấy
 * ngẫu nhiên theo seed; bot chơi được/đi vốn/tín hiệu/ngân hàng ghép CẶP cùng điểm: TÀI theo thứ tự ưu tiên, TẬT theo
 * thứ tự 'ít hại' — tối đa hai cặp một mốc. Bot không cuộn (xu của bot vẫn đếm để G7 so với người).
 */
const UU_TIEN_TAI: readonly TraitId[] = ['giu_nhiet', 'ky_luat', 'kien_nhan', 'tam_rong', 'may_xu', 'lenh_min', 'noi_gian', 'sang_so', 'di_sau'];
/*
 * D422 — bot KHÔNG nhận MÙ TIN / SƯƠNG MÙ: hai tật ấy chỉ che thông tin trên màn người chơi, bot không đọc màn ⇒ với
 * bot chúng là điểm cho không (bảng đo trait-v2 §1). Muốn bot mang chúng thì phải che cả bối cảnh bot đọc trước.
 */
const IT_HAI_TAT: readonly TraitId[] = ['lo_lenh', 'mu_lua', 'nong_voi', 'so_mong', 'mot_gio', 'gong_cum', 'te_liet', 'mat_tri', 'chot_non'];
export function chonTraitBot(
  bot: Pick<Bot, 'id' | 'nhom'>, moi: readonly TraitId[], ctx: { seed: number; vong: number; gheId: string },
): TraitId[] {
  if (moi.length === 0) return [];
  if (bot.nhom === 'tham_chieu' && bot.id !== 'bam_bua') return [];
  const diem = (id: TraitId) => TRAIT.find((t) => t.id === id)!.diem;
  let tai = moi.filter((id) => TRAIT.find((t) => t.id === id)!.loai === 'tai');
  let tat = moi.filter((id) => TRAIT.find((t) => t.id === id)!.loai === 'tat');
  if (bot.id === 'bam_bua') {
    const rng = rngAt(ctx.seed, 'holdem_trait_bot', ctx.vong, ctx.gheId);
    const xao = <T,>(a: T[]): T[] => {
      for (let i = a.length - 1; i > 0; i -= 1) { const j = rng.below(i + 1); [a[i], a[j]] = [a[j]!, a[i]!]; }
      return a;
    };
    tai = xao([...tai]); tat = xao([...tat]);
  } else {
    tai = [...tai].sort((a, b) => UU_TIEN_TAI.indexOf(a) - UU_TIEN_TAI.indexOf(b));
    tat = [...tat].filter((id) => IT_HAI_TAT.includes(id)).sort((a, b) => IT_HAI_TAT.indexOf(a) - IT_HAI_TAT.indexOf(b));
  }
  const lay: TraitId[] = [];
  const daDung = new Set<TraitId>();
  for (const t of tai) {
    if (lay.length >= 4) break;
    const x = tat.find((u) => !daDung.has(u) && diem(u) === diem(t));
    if (!x) continue;
    lay.push(t, x); daDung.add(x);
  }
  return lay;
}

