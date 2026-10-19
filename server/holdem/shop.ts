/**
 * MARKET HOLD'EM — NHỊP 1: SHOP + TÁI CƠ CẤU (D24 mục 16.9).
 *
 * Hàm thuần, tất định. Không chạm đường tiền (tường lửa D24 luật số một).
 *
 * ─── VÌ SAO 3 THẺ TÀI SẢN PHẢI CHUNG CẢ BÀN ────────────────────────────────
 * Đây là chi tiết quyết định toàn bộ lớp crowding. Nếu mỗi người thấy một bộ
 * tài sản riêng thì không bao giờ có chuyện "cả bàn cùng dồn vào BTC", và
 * trượt giá do đông — căng thẳng trung tâm của thiết kế (16.7) — biến mất.
 * Nên chúng chỉ được phụ thuộc (seed, vòng), TUYỆT ĐỐI không phụ thuộc
 * người chơi hay số lần khảo sát lại.
 *
 * Ngược lại 2 thẻ chiến thuật là RIÊNG mỗi người, và khảo sát lại chỉ đổi
 * chúng — giữ nguyên 3 tài sản. Nếu khảo sát lại đổi được cả tài sản thì
 * người chơi né được crowding bằng cách roll, và lớp căng thẳng lại mất.
 *
 * ─── BUỘC MUA ≥1 KHÔNG PHẢI HÀO PHÓNG, LÀ RỦI RO ───────────────────────────
 * Tái cơ cấu ép mua ít nhất một thẻ. Bốc phải thẻ xung đột với thẻ đang có
 * (Mua Đuổi + Chặn Lỗ cùng danh mục → whipsaw) là cơ chế dạy-bằng-nỗi-đau mô
 * phỏng overfitting, và là engine cháy tài khoản chính. `canhBaoXungDot()`
 * tồn tại để UI cho thấy TRƯỚC khi xác nhận — nếu không thì đó là gài bẫy
 * chứ không phải dạy.
 */
import {
  CHIEN_THUAT, HOLDEM_DECISIONS, HOLDEM_MATCH, MAX_BAN_SAO, TAI_SAN, XUNG_DOT,
  loaiTheVong,
  type ChienThuatId,
  laSeedManTap,
} from '../../config/holdem.js';
import { LOI_BI_CAT } from '../../config/luoc_bo.js';
import { rngAt, type Rng } from '../sandbox/rng.js';
import type { DanhMuc } from './engine.js';

const DOMAIN = 'holdem_shop';

/**
 * Cổng luật của shop — MỘT OBJECT thay cho các boolean đứng cạnh nhau (bài học `taoTran`/
 * `replay`: hai boolean cùng kiểu truyền nhầm thứ tự là trình biên dịch im lặng).
 * · `gianLa` — v33 nhịp giãn ở map ngắn (D90 M1).
 * · `loiGon` — v54 (D389 · D394): các lõi trong `LOI_BI_CAT` không còn lên kệ.
 */
export interface TuyChonShop { gianLa?: boolean; loiGon?: boolean }

/** Đọc cổng shop từ CỜ TRẬN — một cửa cho mọi người gọi có `st` (đường thật · bàn đo). */
export function tuyChonShop(st: { gian_la?: boolean; loi_gon?: boolean }): TuyChonShop {
  return { gianLa: st.gian_la === true, loiGon: st.loi_gon === true };
}

export interface ShopVong {
  /** 3 thẻ tài sản — GIỐNG NHAU cho mọi ghế trong vòng này. */
  tai_san: readonly string[];
  /** 2 thẻ chiến thuật — riêng từng ghế, đổi khi khảo sát lại. */
  chien_thuat: readonly ChienThuatId[];
  /** Lần khảo sát lại thứ mấy (0 = lượt đầu, miễn phí). */
  lan_khao_sat: number;
  /** Chi phí để khảo sát lại lần nữa (Lượt khảo sát). */
  chi_phi_lan_sau: number;
}

/** Rút n phần tử khác nhau — tất định, không lệch. */
function rutKhongLap<T>(nguon: readonly T[], n: number, rng: Rng): T[] {
  const con = [...nguon];
  const out: T[] = [];
  for (let i = 0; i < n && con.length > 0; i += 1) {
    out.push(con.splice(rng.below(con.length), 1)[0]!);
  }
  return out;
}

/**
 * Shop của một ghế ở một vòng.
 *
 * `lanKhaoSat` = 0 là lượt bày đầu tiên (miễn phí). Mỗi lần khảo sát lại tăng
 * 1 và CHỈ đổi 2 thẻ chiến thuật.
 *
 * PITY (16.9): khảo sát 3 lần mà chưa ra thẻ thuộc nhóm mình đang thiếu →
 * lần thứ 4 nghiêng hẳn về nhóm đó. Chống chuỗi xui dài làm người chơi bỏ bàn.
 */
export function bayShop(
  seed: number, vong: number, gheId: string, lanKhaoSat: number, dangCo: DanhMuc,
  /**
   * v33 — nhịp GIÃN ở map ngắn (D90 M1): bàn tập ghim bộ lõi ở 2·4·6 thay vì
   * 2·3·4. Cờ của TRẬN (`st.gian_la`), không phải hằng số toàn cục — trận cũ
   * replay ra đúng bộ nó từng bày.
   * v54 — nhận thêm dạng object `TuyChonShop` (kèm `loiGon`); boolean trần = chỉ `gianLa`,
   * nên mọi người gọi cũ giữ nguyên nghĩa.
   */
  tuyChon: boolean | TuyChonShop = false,
): ShopVong {
  const gianLa = typeof tuyChon === 'boolean' ? tuyChon : tuyChon.gianLa === true;
  const loiGon = typeof tuyChon === 'object' && tuyChon.loiGon === true;
  /*
   * ⚠ CẢ 6 MÃ, KHÔNG RÚT THĂM NỮA — founder chốt 27/07 (spec 01 §4):
   * *"đ** phải là chọn 1 trong 3 tài sản 1 vòng mà là cả 6 tài sản hiển thị 1
   * lúc cho người chơi phân bổ vốn"*.
   *
   * Bản cũ rút `SHOP_TAI_SAN` mã bằng `rngAt(seed, ..., vong)` — cố ý không có
   * gheId/lanKhaoSat trong toạ độ để cả bàn thấy chung và không né được bằng
   * khảo sát lại. **Tính chất đó KHÔNG mất**: cả 6 mã thì đương nhiên cả bàn
   * thấy như nhau, và không có gì để né. Chỉ có phần NGẪU NHIÊN chết.
   *
   * Vì sao bỏ rút thăm là đúng chứ không chỉ là chiều lòng: ngoài đời không ai
   * phải chờ vàng "xuất hiện trong cửa hàng". Rút thăm biến quyết định phân bổ
   * vốn — quyết định thật của nghề này — thành một ván may rủi xem hôm nay được
   * chào mã nào, đúng thứ A3.9 cấm ("không trò thuần may rủi").
   *
   * ⚠ Thứ tự PHẢI ổn định (theo `TAI_SAN` trong config) chứ không xáo mỗi vòng:
   * người chơi cần nhớ được vị trí để so sánh nhanh giữa các vòng, và một bảng
   * giá nhảy chỗ mỗi vòng là bảng giá không đọc được.
   */
  const taiSan = TAI_SAN.map((t) => t.id);

  const rng = rngAt(seed, `${DOMAIN}_ct`, vong, gheId, lanKhaoSat);
  // v54 — LÕI GỌN: lọc TRƯỚC cú rút (kệ nhỏ hơn thì rút trên kệ nhỏ). Cờ tắt ⇒ kệ đủ 11, y hệt.
  let nguon: readonly ChienThuatId[] = CHIEN_THUAT.map((c) => c.id)
    .filter((id) => !loiGon || !LOI_BI_CAT.includes(id));

  // Pity: đã khảo sát ≥3 lần mà danh mục vẫn trống thẻ chiến thuật → chỉ bày
  // thẻ KHÔNG xung đột với thứ đang có, để lần này chắc chắn dùng được.
  if (lanKhaoSat >= 3) {
    const khongXungDot = nguon.filter((id) => !xungDotVoi(id, dangCo));
    if (khongXungDot.length >= HOLDEM_MATCH.SHOP_CHIEN_THUAT) nguon = khongXungDot;
  }

  const chienThuat = rutKhongLap(nguon, HOLDEM_MATCH.SHOP_CHIEN_THUAT, rng);

  /*
   * MÀN TẬP — BỘ LÕI GHIM (founder 02/08: "làm chiến thuật cố định riêng cho
   * vòng này luôn để hướng dẫn chứ không ngẫu nhiên"). Tra theo seed nên hàm
   * vẫn THUẦN + TẤT ĐỊNH: replay, mọi ghế, mọi lượt khảo sát lại đều ra đúng
   * bộ này — Oracle mới gọi tên được từng lá. Trận thường (seed khác) không
   * đổi một bit. Xác suất seed ngẫu nhiên trùng hằng số: 1/2^32 — chấp nhận.
   */
  // D433 — lõi gọn (v54) có bảng ghim riêng: bảng giãn chào CHẶN LỖ · ĐA DẠNG HOÁ, hai lá đã rời kệ.
  const bangGhim = loiGon ? HOLDEM_DECISIONS.MAN_TAP_LOI_GON
    : gianLa ? HOLDEM_DECISIONS.MAN_TAP_LOI_GIAN : HOLDEM_DECISIONS.MAN_TAP_LOI;
  // D527 — bàn tập nhịp xen kẽ ghim theo ĐÚNG seed của nó (bảng riêng, đứng trước bảng chung của mọi seed tập).
  const loiGhim = seed === HOLDEM_DECISIONS.MAN_TAP_SEED_XEN_KE || seed === HOLDEM_DECISIONS.MAN_TAP_SEED_KY_HOP   // D545 — cùng quầy lõi
    ? (HOLDEM_DECISIONS.MAN_TAP_LOI_XEN_KE[vong] as readonly ChienThuatId[] | undefined)
    : laSeedManTap(seed)
      ? (bangGhim[vong] as readonly ChienThuatId[] | undefined)
      : undefined;

  return {
    tai_san: taiSan,
    chien_thuat: loiGhim ?? chienThuat,
    lan_khao_sat: lanKhaoSat,
    chi_phi_lan_sau: lanKhaoSat === 0 ? 0 : HOLDEM_MATCH.CHI_PHI_KHAO_SAT_LAI,
  };
}

/** Thẻ `id` có xung đột với thẻ nào đang cầm không? */
export function xungDotVoi(id: ChienThuatId, dangCo: DanhMuc): boolean {
  return XUNG_DOT.some(
    ([a, b]) => (a === id && dangCo.chien_thuat.includes(b))
             || (b === id && dangCo.chien_thuat.includes(a)),
  );
}

export interface CanhBao {
  the: ChienThuatId;
  nhan: string;
  xung_dot_voi: ChienThuatId;
  nhan_xung_dot: string;
}

/**
 * Cảnh báo xung đột — UI PHẢI hiện cái này TRƯỚC khi người chơi xác nhận mua.
 * Không hiện = gài bẫy. Hiện = dạy học.
 */
export function canhBaoXungDot(
  the: ChienThuatId, dangCo: DanhMuc,
  /**
   * v19 — bảng xung đột theo LUẬT HIỆN HÀNH (founder 02/08: cảnh báo khắc
   * chế thừa cho lá đã đổi chức năng). Mặc định bảng cũ để test đơn vị cũ
   * giữ nghĩa; endpoint thật truyền bảng của `HOLDEM_BALANCE_VERSION`.
   */
  bang: readonly (readonly [ChienThuatId, ChienThuatId])[] = XUNG_DOT,
): CanhBao | null {
  for (const [a, b] of bang) {
    const doi = a === the ? b : b === the ? a : null;
    if (doi && dangCo.chien_thuat.includes(doi)) {
      return {
        the,
        nhan: CHIEN_THUAT.find((c) => c.id === the)?.label ?? the,
        xung_dot_voi: doi,
        nhan_xung_dot: CHIEN_THUAT.find((c) => c.id === doi)?.label ?? doi,
      };
    }
  }
  return null;
}

export type LoiMua =
  | 'khong_co_trong_shop' | 'day_tai_san' | 'day_chien_thuat' | 'da_toi_da_ban_sao'
  | 'sai_nhip_vong' | 'da_all_in';

/** Đếm số bản sao của một thẻ trong danh mục. */
export function soBanSao(dm: DanhMuc, theId: string): number {
  const a = dm.tai_san.filter((x) => x === theId).length;
  const b = dm.chien_thuat.filter((x) => x === theId).length;
  return a + b;
}

/** Số Ô danh mục một loại đang chiếm (bản sao KHÔNG tốn thêm ô). */
function soO(ds: readonly string[]): number {
  return new Set(ds).size;
}

/**
 * Mua một thẻ. Trả danh mục MỚI (không sửa tại chỗ) hoặc lỗi.
 *
 * BA LUẬT, cả ba đều do founder chốt 20/07:
 *
 * 1. STACK — mua trùng là NÂNG CẤP, tối đa `MAX_BAN_SAO` bản, và bản sao
 *    KHÔNG tốn thêm ô danh mục. Trước đó tài sản trùng bị BỎ QUA IM LẶNG:
 *    hàm trả `ok: true` với danh mục y nguyên, nên UI báo "mua thành công" mà
 *    không có gì xảy ra. Nay trùng là nâng cấp thật, và quá số bản thì báo lỗi
 *    rõ ràng thay vì im lặng.
 * 2. NHỊP VÒNG — vòng nào chỉ lấy được loại thẻ của vòng đó, vòng 7–8 không có
 *    shop. Enforce ở đây chứ không phải ở UI: client không bao giờ là chân lý.
 * 3. ALL IN KHOÁ BÀI — đã dồn hết vốn thì không chọn bài nữa, lật tới cuối.
 */
export function mua(
  dangCo: DanhMuc, shop: ShopVong, theId: string,
  /**
   * Bối cảnh luật. Bỏ trống = bỏ qua kiểm nhịp/all-in (dùng cho test đơn vị).
   *
   * ⚠ `soO` (số ô của map) KHÔNG phải trang trí: từ D34 nhịp chọn bài CO THEO
   * CỠ MAP, nên bỏ trống là âm thầm dùng nhịp của cỡ map mặc định. Người gọi ở
   * đường chạy thật PHẢI truyền `st.map.o.length`.
   */
  boiCanh?: {
    vong?: number; soO?: number; daAllIn?: boolean;
    /** v33 — nhịp giãn ở map ngắn (D90 M1). Cùng cờ với `st.gian_la`. */
    gianLa?: boolean;
    /**
     * Trần SỐ MÃ giữ đồng thời. Bỏ trống = `HOLDEM_MATCH.MAX_TAI_SAN`.
     *
     * ⚠ TÍNH SẴN RỒI TRUYỀN VÀO, không để hàm này tự suy: trần phụ thuộc cổng
     * `da_dang_tran_tai_san` của TRẬN và thẻ Đa Dạng Hoá của GHẾ, mà `mua()` chỉ
     * nhận danh mục — nó không có state để hỏi. Nguồn chân lý là
     * `maxTaiSanCua()` bên engine; đây chỉ là chỗ nhận.
     */
    maxTaiSan?: number;
    /** D473 — trần SỐ LÕI theo ghế (khung minigame: 2, khẩu vị đa dạng 3). Bỏ trống = `HOLDEM_MATCH.MAX_CHIEN_THUAT`. */
    maxLoi?: number;
  },
): { ok: true; danh_muc: DanhMuc } | { ok: false; loi: LoiMua } {
  if (boiCanh?.daAllIn) return { ok: false, loi: 'da_all_in' };

  const laTaiSan = shop.tai_san.includes(theId);
  const laChienThuat = shop.chien_thuat.includes(theId as ChienThuatId);
  if (!laTaiSan && !laChienThuat) return { ok: false, loi: 'khong_co_trong_shop' };

  /*
   * ⚠ NHỊP VÒNG NAY CHỈ GÁC THẺ CHIẾN THUẬT — chợ TÀI SẢN mở ở MỌI vòng.
   * Founder chốt 27/07 (spec 01 §7).
   *
   * Vì sao phải đổi cùng đợt chợ-6-mã chứ không để sau: đợt rà 27/07
   * (`docs/thiet-ke-da-chot/00-ra-co-che-27-07.md` §4) đo trên map THẬT (8 ô) ra
   *
   *     v1 tài sản · v2·v3·v4 chiến thuật · v5·v6 tài sản · v7·v8 KHÔNG CÓ GÌ
   *
   * tức chỉ 3/8 vòng đụng được tài sản. Đó chính là thứ founder than —
   * *"chọn mã xong và thẻ tiếp theo lật thì đ** có gì xảy ra?"* — và nó KHÔNG
   * phải bug: ở 5 trong 8 vòng thì đúng là không có gì để làm. Bày đủ 6 mã mà
   * vẫn khoá theo nhịp thì hai vòng cuối vẫn chết y nguyên.
   *
   * `loaiTheVong` KHÔNG chết: nhịp D34 (map 8 → vòng 2·3·4) vẫn quyết vòng nào
   * bày thẻ chiến thuật, và All-in vẫn mở sau khi chốt đủ ba thẻ.
   */
  if (boiCanh?.vong !== undefined && laChienThuat) {
    if (loaiTheVong(boiCanh.vong, boiCanh.soO, boiCanh.gianLa) !== 'chien_thuat') {
      return { ok: false, loi: 'sai_nhip_vong' };
    }
  }

  const daCo = soBanSao(dangCo, theId);
  if (daCo >= MAX_BAN_SAO) return { ok: false, loi: 'da_toi_da_ban_sao' };

  if (laTaiSan) {
    // Ô mới chỉ tốn khi đây là lá ĐẦU TIÊN của mã đó.
    const tranMa = boiCanh?.maxTaiSan ?? HOLDEM_MATCH.MAX_TAI_SAN;
    if (daCo === 0 && soO(dangCo.tai_san) >= tranMa) {
      return { ok: false, loi: 'day_tai_san' };
    }
    return { ok: true, danh_muc: { ...dangCo, tai_san: [...dangCo.tai_san, theId] } };
  }

  const ct = theId as ChienThuatId;
  if (daCo === 0 && soO(dangCo.chien_thuat) >= (boiCanh?.maxLoi ?? HOLDEM_MATCH.MAX_CHIEN_THUAT)) {
    return { ok: false, loi: 'day_chien_thuat' };
  }
  return { ok: true, danh_muc: { ...dangCo, chien_thuat: [...dangCo.chien_thuat, ct] } };
}

/**
 * TRẦN SỐ THẺ LẤY ĐƯỢC TRONG MỘT VÒNG, theo loại.
 *
 * ⚠ ĐÂY LÀ CÁI "1" MÀ ĐẶC QUYỀN ĐA DẠNG HOÁ NỚI RA (D33: "được chọn 2 tài sản
 * một vòng thay vì 1"). Trước D33 con số đó KHÔNG tồn tại ở server: `replay`
 * gọi `mua()` cho mọi phần tử của `h.mua`, và trần duy nhất là `length ≤ 2` ở
 * tầng nhận — một con số đếm TỔNG, không phân biệt loại. Nên "thay vì 1" là một
 * lời hứa không có gì để nới.
 */
export interface TranMoiVong {
  tai_san: number;
  chien_thuat: number;
}

/**
 * Trần của trận CŨ (trước cổng `dac_quyen`): KHÔNG có trần theo loại.
 *
 * ⚠ Tồn tại để trận đã lưu replay ra ĐÚNG kết quả cũ. Đừng "dọn dẹp" nó thành
 * `{tai_san: 1, chien_thuat: 1}` cho gọn: log của trận cũ có thể chứa hai thẻ
 * cùng loại trong một vòng (tầng nhận chỉ chặn tổng > 2), và siết ngược là viết
 * lại lịch sử — im lặng, không lỗi.
 */
export const KHONG_TRAN: TranMoiVong = {
  tai_san: Number.POSITIVE_INFINITY,
  chien_thuat: Number.POSITIVE_INFINITY,
};

export interface KetQuaMuaVong {
  danh_muc: DanhMuc;
  da_mua: string[];
  /** Thẻ bị bỏ qua và VÌ SAO — `qua_tran` là trần mỗi vòng, phần còn lại từ `mua`. */
  bo_qua: { the: string; loi: LoiMua | 'qua_tran' }[];
}

/**
 * Mua CẢ MỘT LƯỢT của một vòng, có trần theo loại thẻ.
 *
 * Tách ra khỏi `replay()` vì hai lý do, và lý do thứ hai mới là lý do thật:
 *   1. `replay` không xuất ra ngoài được nên mọi luật nằm trong nó chỉ kiểm
 *      được qua HTTP + DB — đắt tới mức trên thực tế là không kiểm.
 *   2. Trần mỗi vòng là LUẬT TIỀN (nó quyết định danh mục, danh mục quyết định
 *      PnL). A8.3 đòi phần đụng tiền phải có test đi trước, mà "test đi trước"
 *      chỉ làm được nếu có một hàm thuần để gọi.
 *
 * Thẻ vượt trần bị BỎ QUA chứ không làm hỏng cả lượt: người chơi gửi thừa một
 * lá thì hai lá kia vẫn phải vào — từ chối cả lượt là phạt họ vì một cú bấm.
 */
export function muaCaVong(
  dangCo: DanhMuc, shop: ShopVong, danhSach: readonly string[],
  tran: TranMoiVong,
  boiCanh?: {
    vong?: number; soO?: number; daAllIn?: boolean; maxTaiSan?: number; maxLoi?: number;
  },
): KetQuaMuaVong {
  let dm = dangCo;
  const daMua: string[] = [];
  const boQua: { the: string; loi: LoiMua | 'qua_tran' }[] = [];
  let nTaiSan = 0;
  let nChienThuat = 0;

  for (const theId of danhSach) {
    // Loại suy từ SHOP, không từ danh mục: thẻ lạ để `mua` từ chối cho có lý do.
    const laTaiSan = shop.tai_san.includes(theId);
    const dem = laTaiSan ? nTaiSan : nChienThuat;
    const gioiHan = laTaiSan ? tran.tai_san : tran.chien_thuat;
    if (shop.chien_thuat.includes(theId as ChienThuatId) || laTaiSan) {
      if (dem >= gioiHan) { boQua.push({ the: theId, loi: 'qua_tran' }); continue; }
    }
    const kq = mua(dm, shop, theId, boiCanh);
    if (!kq.ok) { boQua.push({ the: theId, loi: kq.loi }); continue; }
    dm = kq.danh_muc;
    daMua.push(theId);
    if (laTaiSan) nTaiSan += 1; else nChienThuat += 1;
  }
  return { danh_muc: dm, da_mua: daMua, bo_qua: boQua };
}

/**
 * CẤP của một thẻ trong danh mục: 0 = không có, 1..MAX_BAN_SAO = số bản sao.
 *
 * Nhận cả tài sản lẫn chiến thuật — từ 20/07 tài sản cũng stack được, nên hàm
 * này không còn là chuyện riêng của lớp chiến thuật nữa. Trần cứng ở
 * `MAX_BAN_SAO` để không bao giờ trả ra cấp mà `heSoStackBp` chưa định nghĩa.
 */
export function capThe(danhMuc: DanhMuc, id: string): number {
  return Math.min(soBanSao(danhMuc, id), MAX_BAN_SAO);
}
