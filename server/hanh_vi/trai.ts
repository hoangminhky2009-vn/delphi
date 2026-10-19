/**
 * ═══════════════════════════════════════════════════════════════════════════
 * TRẢI HÀNH VI — hàm THUẦN dựng `hanh_vi_vong` từ events của MỘT trận (D106)
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * Trước 22/08 vòng lặp này sống bên trong `hoSoTinhCachCuaUser` (holdem_api.ts)
 * và chạy lại ở MỖI request; thanh phong cách thì gom một bản khác trong
 * `replay`. Hai đường trải cho cùng một vòng là hai đường sẽ trôi (D61). Nay
 * MỘT hàm, ba người đọc: tick dựng bảng · script dựng lại · test vector tay.
 *
 * ⚠ KHÔNG ĐỔI PHÉP TÍNH khi bê ra đây. Bài `hanh_vi_kho.test.ts` chơi thật qua
 * endpoint rồi so hồ sơ trước/sau bằng từng chữ số — đó là hợp đồng của việc
 * "chỉ dời chỗ, không dời nghĩa".
 *
 * Thuần + tất định: nhận map đã sinh + mảng event đã sắp theo ts + khẩu vị từ
 * replay; trả mảng dòng. Không DB, không RNG.
 */
import type { VongInsight } from '../holdem/insight.js';
import { TAI_SAN } from '../../config/holdem.js';

/** PHIÊN BẢN CÔNG THỨC TRẢI — đổi nghĩa một cột là tăng số này, dựng lại bảng. */
// D323 — 1 → 2: thêm cột so_nhom (đọc lại `TAI_SAN.nhom` cho mắt xích `hd_chot_phien.chain`,
// xem `demSoNhom`). Bump version ⇒ MỌI trận tự thành "cần dựng" ở lần đọc sau (kho.ts §tranCanDung).
// D327 — 2 → 3: thêm cột ms_quyet (mốc `hd_chot_phien.value_json.mo_luc` → ts của `hd_cam_ket`).
// D409 — 3 → 4: sáu cột lửa/xu/trait/thông tin riêng/cơ chế cắt lỗ (migration 0071), đọc từ `hd_chot_phien.value_json.lua`
// + `.trait` (ghi từ v55). Trận cũ: cả sáu NULL — null ≠ 0.
export const HANH_VI_FORMULA_VERSION = 4;

/** Một event thô như đọc từ `events` (chỉ phần trải cần). */
export interface EventTho {
  event_id?: number | string;
  ts: Date | string;
  action_type: string;
  /** `value_num::float` */
  num: number | null;
  value_json: unknown;
}

/** KHẨU VỊ một vòng — sản phẩm phụ của `replay` (xem `kvVong` ở holdem_api). */
export interface KhauViVong {
  vong: number;
  /** tiền mặt / NAV sau khi chốt vòng, bp (10_000 = toàn tiền mặt). */
  tien_mat_bp: number;
  /** số mã đang giữ (vị thế > 0) sau khi chốt vòng. */
  so_ma: number;
  /**
   * ⭐⭐ Ô CỦA VÒNG NÀY BỊ THAY VÌ HÀNH VI ĐÁM ĐÔNG (D206) — `null` nếu không.
   *
   * ⚠⚠ VÌ SAO CỜ NÀY PHẢI TỒN TẠI, và vì sao nó thuộc TẦNG ĐO chứ không phải
   * tầng chơi: hai máy phản-thân (D4) và bẻ-chuỗi-vốn (D160) THAY MẶT ô sắp
   * lật khi bàn dồn. Vòng đó người chơi vẫn ra quyết định như thường, nhưng
   * ĐỀ BÀI họ nhận đã bị chính đám đông sửa. Trộn nó với vòng bình thường rồi
   * kết luận "người này ưa rủi ro" là đọc HOÀN CẢNH thành TÍNH CÁCH — đúng lỗi
   * mà cả tầng D106 dựng ra để tránh, và là lỗi 0046 vừa vá cho (cỡ map × vai).
   *
   * ⚠ KHÔNG LỌC BỎ vòng bị thay — mùa này n≈3–5, lọc là còn 0 mẫu. Hồ sơ KHAI
   * RA tỷ lệ (như `lop_data` của D178), người đọc tự quyết.
   */
  thay_o_do: 'phan_than' | 'be_chuoi' | null;
  /**
   * D317 — TỶ TRỌNG NAV ĐANG KHOÁ TRONG SỔ TIẾT KIỆM sau khi chốt vòng (bp).
   *
   * ⚠⚠ `null` KHÁC HẲN `0`, và đây là chỗ dễ sai nhất của cột này (A11.2):
   *   · `0`    = trận CÓ cơ chế ngân hàng, người chơi không gửi đồng nào —
   *              một QUAN SÁT về khẩu vị.
   *   · `null` = trận chạy luật CHƯA CÓ cơ chế; nút ấy không tồn tại để bấm.
   * Điền 0 cho vế thứ hai là bịa ra hàng chục nghìn quan sát "người này không
   * thích gửi tiết kiệm" từ những trận không có sổ tiết kiệm.
   *
   * ⭐ ĐÂY LÀ NGUỒN DUY NHẤT quyết định NULL cho CẢ HAI cột ngân hàng: `traiTran`
   * đọc chính trường này để biết trận có cơ chế hay không, thay vì nhận thêm một
   * cờ riêng. Hai cờ nói cùng một điều là hai cờ sẽ trôi (D61).
   */
  tiet_kiem_bp?: number | null;
}

/** Ô map tối thiểu trải cần — tránh import kiểu engine vào tầng này. */
export interface OMapToiThieu {
  kind: string;
  la_tin_gia?: boolean;
}
export interface TrangThaiOToiThieu {
  run_huong: number;
  run_dai: number;
}

/** Cờ chất lượng cấp TRẬN — caller đọc từ DB rồi đưa vào (hàm này không hỏi DB). */
export interface CoTran {
  tran_xong: boolean;
  man_tap: boolean;
  la_khach: boolean;
  /**
   * D169 — ngưỡng "chuỗi ĐÃ XÁC NHẬN" của máy sinh map trận đó (2 với máy rút
   * cũ, 1 với máy tick v36). Vắng ⇒ 2, giữ nguyên mọi dòng đã trải.
   * ⚠ Đây là ĐỊNH NGHĨA thước tính cách #2 (đuổi giá theo chuỗi) — nó phải
   * khớp thứ người chơi NHÌN THẤY (`xu_huong` DTO), nếu không app đo một
   * chuỗi mà màn hình không hề nói có.
   */
  nguong_chuoi?: number;
  /**
   * D178 — HAI KHOÁ CẮT LỚP DATA: cỡ map + vai của GHẾ NÀY.
   *
   * ⚠ Không phải siêu dữ liệu cho đẹp: cùng một hành vi mang nghĩa khác nhau
   * tuỳ hoàn cảnh (map 8 ép thời gian · cá mập có vốn ×3 và bị ghim Đòn Bẩy),
   * nên mọi đường đọc gộp phải CẮT ĐƯỢC theo hai trục này. Ý nghĩa từng tổ hợp
   * ở `LOP_DATA` trong config — bảng chỉ chở dữ kiện thô.
   */
  so_o?: number | null;
  vai?: string | null;
  /** v55 (D409) — luật trận có cửa cắt lỗ bằng trait (`chanLoTrait`). Vắng ⇒ `co_che_cat_lo` = null. */
  chan_lo_trait?: boolean;
}

/** Một dòng `hanh_vi_vong` (chưa có user_id/match_id — caller gắn). */
export interface DongHanhViVong extends VongInsight {
  vong: number;
  ts: Date;
  brier_v: number | null;
  cho_bp: number | null;
  tien_mat_bp: number | null;
  so_ma: number | null;
  /** D206 — ô vòng này bị THAY vì đám đông (xem `KhauViVong.thay_o_do`). */
  thay_o_do: 'phan_than' | 'be_chuoi' | null;
  /** D317 — tỷ trọng NAV đang khoá trong sổ tiết kiệm (bp). `null` = luật trận chưa có cơ chế. */
  tiet_kiem_bp: number | null;
  /**
   * D317 — SỐ HỢP ĐỒNG BỊ HUỶ TRƯỚC HẠN trong vòng này (mất toàn bộ lãi treo).
   *
   * Thứ đắt nhất cả cơ chế cho tầng đo: một cam kết TỰ NGUYỆN bị bẻ dưới áp lực,
   * có giá tiền cụ thể, ghi đúng vòng nó xảy ra. Tách riêng khỏi `tiet_kiem_bp`
   * vì hai thứ khác bản chất — người giữ đều 40% suốt trận và người gửi 40% rồi
   * rút sạch ở vòng bão cho ra cùng một trung bình tỷ trọng.
   * `null` = luật trận chưa có cơ chế · `0` = có cửa mà không huỷ.
   */
  tk_huy_so: number | null;
  /**
   * D323 — SỐ NHÓM tài sản (rui_ro/phong_thu) khác nhau đang giữ SAU khi chốt
   * vòng, đọc từ mắt xích `kind === 'tai_san'` của `hd_chot_phien.chain` (xem
   * `demSoNhom`). `null` = không có chain để đếm (trận cũ trước formula v2,
   * hoặc trận không NAV) — KHÁC 0 = có chuỗi mà không cầm mã nào (0063 cùng nếp).
   */
  so_nhom: number | null;
  /**
   * D327 — MILI-GIÂY từ lúc vòng MỞ tới lúc nộp (`ts` của `hd_cam_ket` − `mo_luc` của
   * `hd_chot_phien`), cả hai là `now()` của Postgres nên không lệch đồng hồ máy.
   * `null` = không đo được: trận ghi trước D327 (không có `mo_luc`) · vòng `tu_dong` (hết
   * giờ — "không kịp bấm" không phải một thời gian quyết định) · hiệu âm hoặc vượt INT.
   * ⚠ Vòng 1 tính từ lúc TẠO trận — gồm cả pha chia vai, cùng mốc mà đồng hồ trận dùng.
   */
  ms_quyet: number | null;
  /** v55 (D409) — nấc lửa SAU vòng · lý do dập · xu · trait đang mang. null = luật chưa có lửa/trait. */
  lua_nac?: number | null;
  lua_dap?: 'doi_bias' | 'doi_tay' | 'mua_duoi_muon' | null;
  xu?: number | null;
  trait_json?: string[] | null;
  /** v55 (D409) — vòng có THÔNG TIN RIÊNG: bảng điện tử hoặc trait; thước đọc tin phải tách. null = không. */
  nguon_tin_rieng?: 'bang' | 'trait' | null;
  /** v55 (D409) — có cửa cắt lỗ bằng trait: true/false; null = luật không có cửa. */
  co_che_cat_lo?: boolean | null;
  tran_xong: boolean;
  man_tap: boolean;
  la_khach: boolean;
  nghi_may: boolean;
}

/** Trần cột `INT` của Postgres — một vòng mở quá ~24,8 ngày (trận bỏ dở) thì không ghi số. */
const TRAN_INT = 2_147_483_647;

const chieuHopLe = new Set(['mua', 'ban', 'khong', 'dong_khong']);

/**
 * D323 — đếm số NHÓM tài sản khác nhau trong mắt xích `tai_san` của một chain
 * `hd_chot_phien`. Không phải mảng ⇒ null (chưa từng có gì để đếm — KHÔNG phải
 * "đếm ra 0", xem docstring `so_nhom` ở `DongHanhViVong` và migration 0064).
 */
/** D327 — xem docstring `ms_quyet`. Mọi ca không đo được trả `null`, không trả 0. */
function msQuyet(tuDong: boolean, moLuc: number | null, ts: Date | null): number | null {
  if (tuDong || moLuc === null || ts === null) return null;
  const ms = ts.getTime() - moLuc;
  return ms >= 0 && ms <= TRAN_INT ? ms : null;
}

function demSoNhom(chain: unknown): number | null {
  if (!Array.isArray(chain)) return null;
  const nhom = new Set<string>();
  for (const mx of chain as Record<string, unknown>[]) {
    if (mx?.kind !== 'tai_san' || typeof mx.id !== 'string') continue;
    const ts = TAI_SAN.find((t) => t.id === mx.id);
    if (ts) nhom.add(ts.nhom);
  }
  return nhom.size;
}

/**
 * ⚠⚠ D388 — MỌI `action_type` MÀ `traiTran` ĐỌC, và là NGUỒN DUY NHẤT cho câu SQL nạp
 * event của `kho.ts` (`dungHanhViTran`).
 *
 * Trước D388 danh sách này sống RIÊNG ở `kho.ts` (`EVENT_TRAN`), chép tay, cách nhánh
 * đọc cả một tệp. D317 thêm nhánh `hd_tiet_kiem` vào hàm dưới mà bản chép ấy không được
 * thêm theo ⇒ trên ĐƯỜNG DB event đó không bao giờ tới hàm, `tk_huy_so` ra 0 ở mọi trận
 * có sổ tiết kiệm, và thẻ năng lực N1 (D323) chấm người huỷ sổ sớm thành `lam_duoc`.
 * Vector thuần gọi `traiTran` với event dựng tay nên xanh suốt — nhánh đúng, chỉ là
 * không ai đưa event tới nó.
 *
 * Thêm một nhánh `e.action_type === '…'` ở dưới thì PHẢI thêm ở đây — bài canh
 * `tests/hanh_vi_kho.test.ts` §V quét mã nguồn hàm dưới và đỏ nếu hai bên lệch.
 */
export const EVENT_TRAI_TRAN: readonly string[] = [
  'hd_cam_ket', 'hd_chot_phien', 'hd_brier_vong', 'hd_tiet_kiem', 'hd_mo_bang', 'hd_khop_lenh',
];

/**
 * Trải events của MỘT trận thành dòng theo vòng.
 *
 * Y NGUYÊN luật của `hoSoTinhCachCuaUser` (17/08):
 *  · `value_json.vong` là chìa gom; vòng ngoài [1, số ô] bỏ;
 *  · lệnh gom từ CẢ `hd_khop_lenh` lẫn `hd_cam_ket`, theo thứ tự ts (khớp giữa
 *    vòng đến trước cú nộp);
 *  · vòng KHÔNG có `hd_cam_ket` (chỉ đuôi khớp/mở bảng) chưa phải quyết định
 *    trọn ⇒ không thành dòng;
 *  · `tu_dong` đọc từ `hd_cam_ket.value_json.tu_dong === true`.
 * Thêm (D106): `ts` = ts của hd_cam_ket · `brier_v` · `cho_bp` · khẩu vị ·
 * cờ `nghi_may`. Thêm (D323): `so_nhom` từ chain của chính `hd_chot_phien`.
 */
export function traiTran(
  matchId: string,
  map: { o: readonly OMapToiThieu[]; trang_thai?: readonly TrangThaiOToiThieu[] },
  events: readonly EventTho[],
  khauVi: readonly KhauViVong[],
  co: CoTran,
): DongHanhViVong[] {
  const theoVong = new Map<number, {
    lenh: { chieu: VongInsight['lenh'][number]['chieu']; moc_bp: number }[];
    pnl: number | null; brier: number | null; brierV: number | null;
    moBang: boolean; tuDong: boolean; coCamKet: boolean; ts: Date | null;
    choBp: number | null; tkHuy: number; soNhom: number | null; moLuc: number | null;
    lua: { nac: number; dap: 'doi_bias' | 'doi_tay' | 'mua_duoi_muon' | null; xu: number } | null;
    trait: string[] | null;
    /** D409 — trait CÓ HIỆU LỰC TRONG vòng (`hd_chot_phien.trait_vong`); `trait` là danh sách SAU vòng. */
    traitVong: string[] | null;
  }>();
  const cua = (v: number) => {
    let o = theoVong.get(v);
    if (!o) {
      o = {
        lenh: [], pnl: null, brier: null, brierV: null, moBang: false,
        tuDong: false, coCamKet: false, ts: null, choBp: null, tkHuy: 0, soNhom: null,
        moLuc: null,
        lua: null, trait: null, traitVong: null,
      };
      theoVong.set(v, o);
    }
    return o;
  };
  for (const e of events) {
    const vj = (e.value_json ?? {}) as Record<string, unknown>;
    const v = Number(vj.vong);
    if (!Number.isInteger(v) || v < 1 || v > map.o.length) continue;
    const o = cua(v);
    if (e.action_type === 'hd_chot_phien') {
      o.pnl = Number(e.num ?? 0);
      const cb = vj.cho_bp;
      if (typeof cb === 'number' && Number.isFinite(cb)) o.choBp = Math.round(cb);
      o.soNhom = demSoNhom(vj.chain);
      // v55 (D409) — lửa/xu/trait ghi CỘNG THÊM vào hd_chot_phien từ v55; dòng cũ không có ⇒ null (không phải 0).
      const lua = vj.lua as { sau?: unknown; dap?: unknown; xu?: unknown } | undefined;
      if (lua && typeof lua === 'object' && typeof lua.sau === 'number') {
        const dap = lua.dap;
        o.lua = {
          nac: lua.sau,
          dap: dap === 'doi_bias' || dap === 'doi_tay' || dap === 'mua_duoi_muon' ? dap : null,
          xu: typeof lua.xu === 'number' ? lua.xu : 0,
        };
      }
      if (Array.isArray(vj.trait)) o.trait = vj.trait.filter((x): x is string => typeof x === 'string');
      if (Array.isArray(vj.trait_vong)) o.traitVong = vj.trait_vong.filter((x): x is string => typeof x === 'string');
      // D327 — chuỗi ISO lạ/hỏng ⇒ để null, không bịa mốc.
      if (typeof vj.mo_luc === 'string') {
        const ml = Date.parse(vj.mo_luc);
        if (Number.isFinite(ml)) o.moLuc = ml;
      }
    } else if (e.action_type === 'hd_brier_vong') {
      o.brier = Number(e.num ?? 0);
      // Thước cũ (trước D103) không có cờ ⇒ để null, KHÔNG bịa 1.
      o.brierV = typeof vj.brier_v === 'number' ? vj.brier_v : null;
    } else if (e.action_type === 'hd_tiet_kiem') {
      /*
       * D317 — chỉ đếm cú huỷ ĐÃ ĂN. Sổ này ghi cả lệnh BỊ TỪ CHỐI (`ok:false`,
       * ý định cũng là dữ liệu — nếp `hd_khoa_tai_san`), nhưng một lệnh huỷ bị
       * engine bác thì hợp đồng vẫn còn nguyên và người chơi KHÔNG mất đồng lãi
       * nào. Đếm nó vào đây là đếm ý định thành hành động, và cột này sinh ra để
       * đo đúng cái giá đã trả.
       */
      if (vj.ok === true && Array.isArray(vj.huy)) o.tkHuy += vj.huy.length;
    } else if (e.action_type === 'hd_mo_bang') {
      o.moBang = true;
    } else if (e.action_type === 'hd_khop_lenh' || e.action_type === 'hd_cam_ket') {
      const ds = Array.isArray(vj.lenh) ? vj.lenh as Record<string, unknown>[] : [];
      for (const l of ds) {
        const chieu = l.chieu;
        const moc = Number(l.moc_bp);
        if (typeof chieu === 'string' && chieuHopLe.has(chieu) && Number.isFinite(moc)) {
          o.lenh.push({ chieu: chieu as VongInsight['lenh'][number]['chieu'], moc_bp: moc });
        }
      }
      if (e.action_type === 'hd_cam_ket') {
        o.coCamKet = true;
        o.ts = e.ts instanceof Date ? e.ts : new Date(e.ts);
        if (vj.tu_dong === true) o.tuDong = true;
      }
    }
  }

  const kvTheoVong = new Map<number, KhauViVong>();
  for (const k of khauVi) kvTheoVong.set(k.vong, k);

  const dong: DongHanhViVong[] = [];
  for (const [v, o] of [...theoVong.entries()].sort((a, b) => a[0] - b[0])) {
    if (!o.coCamKet || o.ts === null) continue;
    const oMap = map.o[v - 1]!;
    const tt = map.trang_thai?.[v - 1];
    const kv = kvTheoVong.get(v);
    dong.push({
      match_id: matchId,
      vong: v,
      ts: o.ts,
      lenh: o.lenh,
      pnl_bp: o.pnl,
      brier: o.brier,
      brier_v: o.brierV,
      mo_bang: o.moBang,
      o_su_kien: oMap.kind === 'su_kien',
      la_tin_gia: oMap.kind === 'su_kien' && oMap.la_tin_gia === true,
      chuoi_tang: tt !== undefined && tt.run_huong === 1
        && tt.run_dai >= (co.nguong_chuoi ?? 2),
      tu_dong: o.tuDong,
      cho_bp: o.choBp,
      tien_mat_bp: kv?.tien_mat_bp ?? null,
      so_ma: kv?.so_ma ?? null,
      thay_o_do: kv?.thay_o_do ?? null,
      /*
       * D317 — MỘT NGUỒN quyết định NULL cho cả hai cột: `kv.tiet_kiem_bp`.
       * `replay` là chỗ DUY NHẤT biết trận này chạy luật có `tietKiem` hay không;
       * nó đã trả lời câu đó bằng cách để `null` hay một con số. Đọc lại chính
       * câu trả lời ấy cho `tk_huy_so` thay vì nhận thêm một cờ `co.ngan_hang` —
       * hai cờ nói cùng một điều là hai cờ sẽ trôi (D61), và cái trôi ở đây là
       * "0 cú huỷ" mọc lên ở những trận không hề có hợp đồng nào để huỷ.
       */
      tiet_kiem_bp: kv?.tiet_kiem_bp ?? null,
      tk_huy_so: (kv?.tiet_kiem_bp ?? null) === null ? null : o.tkHuy,
      // D323 — nguồn RIÊNG (chain của chính vòng này), không ăn theo null của
      // cặp ngân hàng: một trận không NAV thì cả ba cột cùng null, nhưng lý do
      // null của so_nhom là "không có chain", không phải "không có tietKiem".
      so_nhom: o.soNhom,
      ms_quyet: msQuyet(o.tuDong, o.moLuc, o.ts),
      lua_nac: o.lua?.nac ?? null,
      lua_dap: o.lua?.dap ?? null,
      xu: o.lua?.xu ?? null,
      trait_json: o.trait,
      /*
       * Hai cột NGỮ CẢNH đọc trait CÓ HIỆU LỰC TRONG vòng (`traitVong`), KHÔNG đọc danh sách SAU vòng: lá lấy ở vòng mốc chỉ
       * tính từ vòng kế — đọc nhầm là gán NỘI GIÁN / KỶ LUẬT cho đúng cái vòng người chơi chưa có nó (D409). `trait_json`
       * thì giữ nghĩa SAU vòng như migration 0071 khai. Thiếu `trait_vong` ở trận có cửa ⇒ NULL (không biết), không đoán.
       */
      nguon_tin_rieng: o.moBang ? 'bang' : (o.traitVong ?? []).some((t) => t === 'noi_gian' || t === 'ghim_luot_song') ? 'trait' : null,
      co_che_cat_lo: co.chan_lo_trait === true ? (o.traitVong === null ? null : o.traitVong.includes('ky_luat')) : null,
      so_o: co.so_o ?? null,
      vai: co.vai ?? null,
      tran_xong: co.tran_xong,
      man_tap: co.man_tap,
      la_khach: co.la_khach,
      nghi_may: false, // gán sau, cần nhìn CẢ trận — xem `danCoNghiMay`
    });
  }
  return danCoNghiMay(dong);
}

/**
 * NGHI MÁY — cờ cấp trận, nhìn cả trận mới biết: MỌI vòng đều `tu_dong` (không
 * ai bấm gì từ đầu tới cuối — mở trận rồi để đồng hồ chốt hộ tới hết). Chỉ là
 * NHÃN: phân tích tự quyết. Trận 1 vòng thì không đủ cơ sở ⇒ không gắn.
 *
 * ⚠ Bản đầu còn một nhánh "nộp cách nhau < 2 s đều tăm tắp ≥ 4 vòng" — bỏ ngay
 * trong ngày: nó dán cờ lên MỌI trận của bộ test (test là script thật), và độ
 * trễ ra quyết định là thứ CHỈ máy người chơi đo được (doc 04 §2.3 xếp nó vào
 * telemetry, không vào events). Đo ở đúng chỗ thì mới không phải đoán.
 */
export function danCoNghiMay(dong: DongHanhViVong[]): DongHanhViVong[] {
  if (dong.length < 2) return dong;
  if (!dong.every((d) => d.tu_dong)) return dong;
  return dong.map((d) => ({ ...d, nghi_may: true }));
}

/* ══════════════════════════════════════════════════════════════════════════
 * TIÊU DÙNG — hành động tiền NGOÀI trận (D106 trục chính)
 * ══════════════════════════════════════════════════════════════════════════ */

export type LoaiTieuDung = 'gacha' | 'shop_q' | 'shop_t' | 'tro_cap' | 'cuoc' | 'khac';

export interface DongTieuDung {
  event_id: number;
  ts: Date;
  loai: LoaiTieuDung;
  action_type: string;
  so_tien: number;
  don_vi: 'T' | 'Q';
  so_du_truoc: number | null;
  phut_sau_tran: number | null;
  tran_truoc_thang: boolean | null;
  phut_sau_tro_cap: number | null;
}

/** Mốc kết trận (để tính "mấy phút sau trận, trận đó thắng hay thua"). */
export interface MocTran {
  ts: Date;
  /** hạng 1 = thắng. null nếu không biết. */
  thang: boolean | null;
}

/** Bảng ánh xạ action_type → loại + đơn vị. Loại lạ ⇒ bỏ qua (không phải tiền). */
export const LOAI_TIEU_DUNG: Readonly<Record<string, { loai: LoaiTieuDung; don_vi: 'T' | 'Q' }>> = {
  gacha_t: { loai: 'gacha', don_vi: 'T' },
  gacha_burn: { loai: 'gacha', don_vi: 'T' },
  shop_q: { loai: 'shop_q', don_vi: 'Q' },
  shop_mua: { loai: 'shop_q', don_vi: 'Q' },
  checkin: { loai: 'tro_cap', don_vi: 'T' },
  subsidy_claim: { loai: 'tro_cap', don_vi: 'T' },
  bet_place: { loai: 'cuoc', don_vi: 'T' },
  bet_adjust: { loai: 'cuoc', don_vi: 'T' },
};

const phut = (a: Date, b: Date) => Math.floor((a.getTime() - b.getTime()) / 60_000);

/**
 * Trải event tiền ngoài trận thành dòng có NGỮ CẢNH.
 * `soDuTruoc(ts)` do caller cấp (đọc `wallet_ledger` — số dư ngay TRƯỚC ts).
 * `mocTran` và `mocTroCap` đã sắp tăng dần theo ts.
 */
export function traiTieuDung(
  events: readonly EventTho[],
  mocTran: readonly MocTran[],
  mocTroCap: readonly Date[],
  soDuTruoc: (ts: Date) => number | null,
): DongTieuDung[] {
  const ra: DongTieuDung[] = [];
  for (const e of events) {
    const loai = LOAI_TIEU_DUNG[e.action_type];
    if (!loai) continue;
    const ts = e.ts instanceof Date ? e.ts : new Date(e.ts);
    const vj = (e.value_json ?? {}) as Record<string, unknown>;
    // Số tiền: ưu tiên value_num; rơi về vài tên trường hay gặp; không có ⇒ 0.
    const soTien = Math.abs(Number(
      e.num ?? vj.so_tien ?? vj.gia ?? vj.amount ?? vj.cost ?? 0)) || 0;
    const tranTruoc = cuoiTruoc(mocTran, ts, (m) => m.ts);
    const troCapTruoc = cuoiTruoc(mocTroCap, ts, (d) => d);
    ra.push({
      event_id: Number(e.event_id),
      ts,
      loai: loai.loai,
      action_type: e.action_type,
      so_tien: Math.trunc(soTien),
      don_vi: loai.don_vi,
      so_du_truoc: soDuTruoc(ts),
      phut_sau_tran: tranTruoc ? phut(ts, tranTruoc.ts) : null,
      tran_truoc_thang: tranTruoc ? tranTruoc.thang : null,
      phut_sau_tro_cap: troCapTruoc ? phut(ts, troCapTruoc) : null,
    });
  }
  return ra;
}

function cuoiTruoc<T>(xs: readonly T[], ts: Date, lay: (x: T) => Date): T | null {
  let kq: T | null = null;
  for (const x of xs) {
    if (lay(x).getTime() <= ts.getTime()) kq = x; else break;
  }
  return kq;
}
