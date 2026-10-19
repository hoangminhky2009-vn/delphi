/**
 * MÁY TRAIT — TÀI & TẬT (D409, cổng `trait` · `traitVai` · `chanLoTrait`). Bảng + điểm + số ở `config/trait.ts`; ở đây chỉ có máy.
 *
 * Mọi hàm THUẦN. Cú rút dùng RNG domain riêng `holdem_trait*` ⇒ không xê dịch một cú rút nào của map/shop cũ
 * (luật `rngAt`: domain mới không đổi cú rút cũ). Tắt cổng ⇒ không hàm nào được gọi ⇒ trận cũ replay từng bit.
 *
 * Ranh giới (founder §6): trait chỉ đổi ĐIỀU KIỆN BIÊN. Mọi hiệu ứng đi qua MỘT struct `RangBuoc` mà các chỗ cắm
 * trong engine/API đọc — không chỗ nào tự dò `g.trait.includes(...)` (một nguồn, A11.5).
 */
import {
  CHO_TRAIT, KHO_TRAIT_HEP, KHO_TRAIT_V59, MOC_TRAIT, MOC_TRAIT_MINIGAME, THAM_SO, TRAIT, TRAIT_VAI, TRAIT_VAI_MINIGAME, TRAIT_VAI_V59, diemCoDau, type Trait, type TraitId,
} from '../../config/trait.js';
import { NHIP_XEN_KE } from '../../config/holdem.js';
import { rngAt } from '../sandbox/rng.js';
import type { VaiId } from './vai.js';

const DOMAIN = 'holdem_trait';

export function traitCua(id: TraitId): Trait {
  const t = TRAIT.find((x) => x.id === id);
  if (!t) throw new Error(`trait lạ: ${id}`);
  return t;
}

/**
 * Vòng `vong` có mở chợ trait không (theo cỡ bàn). D457 — `st` (tùy chọn): trận mang cờ `khoTraitHep` đọc bảng mốc của KHUNG MINIGAME
 * (`MOC_TRAIT_MINIGAME`) trước, rơi về bảng chung. Vắng `st` hoặc không cờ ⇒ y như trước (bàn 12 của khoá cũ KHÔNG có chợ).
 */
export function laMocTrait(vong: number, soO: number, st?: { trait_kho_hep?: boolean; nhip_xen_ke?: boolean }): boolean {
  // D526 — nhịp xen kẽ: chợ là chặng thay màn, lịch ở `NHIP_XEN_KE` (đọc TRƯỚC mọi bảng mốc khác).
  const bang = (st?.nhip_xen_ke === true ? NHIP_XEN_KE[soO]?.trait : undefined)
    ?? (st?.trait_kho_hep === true ? MOC_TRAIT_MINIGAME[soO] : undefined) ?? MOC_TRAIT[soO] ?? [];
  return bang.includes(vong);
}

export function tongDiem(ids: readonly TraitId[]): number {
  return ids.reduce((s, id) => s + diemCoDau(traitCua(id)), 0);
}

/** Cán cân: phần LẤY phải có tổng điểm ĐÚNG BẰNG 0 (founder 25/09). Lấy không gì cũng hợp lệ. */
export function canHopLe(lay: readonly TraitId[]): boolean {
  return new Set(lay).size === lay.length && tongDiem(lay) === CHO_TRAIT.TONG_DIEM_MOI;
}

/** Tổng xu phải trả để đứng ở lần cuộn thứ `lanCuon` (0 = lượt mời đầu, miễn phí). */
export function giaCuon(lanCuon: number): number {
  let t = 0;
  for (let k = 0; k < Math.min(lanCuon, CHO_TRAIT.CUON_TOI_DA); k += 1) t += CHO_TRAIT.GIA_CUON_XU[k] ?? 0;
  return t;
}

function xaoTron<T>(ds: readonly T[], rng: { below: (n: number) => number }): T[] {
  const a = [...ds];
  for (let i = a.length - 1; i > 0; i -= 1) {
    const j = rng.below(i + 1);
    [a[i], a[j]] = [a[j]!, a[i]!];
  }
  return a;
}

/** Bộ ba theo thứ tự từ điển của chỉ số (đủ tất định). */
function* boBa<T>(ds: readonly T[]): Generator<readonly [T, T, T]> {
  for (let i = 0; i < ds.length; i += 1) {
    for (let j = i + 1; j < ds.length; j += 1) {
      for (let k = j + 1; k < ds.length; k += 1) yield [ds[i]!, ds[j]!, ds[k]!] as const;
    }
  }
}

/**
 * LƯỢT MỜI tại mốc: 3 TÀI + 3 TẬT của KHO CHUNG (không cặp vai, không trait đang mang), tổng điểm đúng
 * `CHO_TRAIT.TONG_DIEM_MOI`. Kho cạn (mốc muộn, mang nhiều) thì lượt mời ngắn hơn nhưng vẫn cân. Tất định theo
 * (seed · ghế · mốc · lần cuộn): API trả cùng lượt cho mọi lần hỏi; replay dựng lại y hệt.
 */
export function bayTrait(
  seed: number, gheId: string, moc: number, lanCuon: number, dangMang: readonly TraitId[],
  /**
   * D457 — KHO HẸP (cờ `khoTraitHep`, qua `khoTraitCua`): chỉ chào trait nằm trong danh sách này. Vắng = cả kho chung, và lượt
   * mời PHẢI ra byte-hệt như trước (cùng danh sách ⇒ cùng cú xáo ⇒ cùng cú rút — trận ≤ v56 replay không đổi).
   */
  kho?: readonly TraitId[],
  /** D498 — vai của ghế: trait ĐỘC QUYỀN (`chiVai`) chỉ chào cho vai trong danh sách. Vắng ⇒ không chào trait độc quyền nào. */
  vai?: VaiId,
): TraitId[] {
  const rng = rngAt(seed, DOMAIN, moc, gheId, lanCuon);
  const mang = new Set(dangMang);
  // D498 — HỌ đang mang ⇒ thôi chào cả họ. Trait độc quyền chỉ ở kho hẹp (kho chung của khoá cũ không bao giờ thấy ⇒ cú xáo byte-hệt).
  const hoDangMang = new Set(TRAIT.filter((t) => t.ho && mang.has(t.id)).map((t) => t.ho));
  const duoc = (t: Trait): boolean => !t.vai && !mang.has(t.id) && (kho === undefined ? !t.chiKhoHep : kho.includes(t.id))   // D528 — lá khoá mới không vào kho chung
    && (!t.chiVai || (kho !== undefined && vai !== undefined && t.chiVai.includes(vai))) && !(t.ho && hoDangMang.has(t.ho));
  // Một lượt mời tối đa một lá mỗi họ: giữ lá ĐẦU của họ sau cú xáo (cấp nào ra là ngẫu nhiên theo seed).
  const motMoiHo = (xs: Trait[]) => xs.filter((t, i) => !t.ho || xs.findIndex((y) => y.ho === t.ho) === i);
  const tai = motMoiHo(xaoTron(TRAIT.filter((t) => t.loai === 'tai' && duoc(t)), rng));
  const tat = xaoTron(TRAIT.filter((t) => t.loai === 'tat' && duoc(t)), rng);
  const tong = (xs: readonly Trait[]) => xs.reduce((s, t) => s + t.diem, 0);
  for (const bt of boBa(tai)) {
    const s = tong(bt);
    for (const bx of boBa(tat)) {
      if (tong(bx) === s) return [...bt.map((t) => t.id), ...bx.map((t) => t.id)];
    }
  }
  // Kho cạn: thử cặp đôi, rồi cặp đơn, rồi rỗng — vẫn cân 0.
  for (let n = 2; n >= 1; n -= 1) {
    for (let i = 0; i + n <= tai.length; i += 1) {
      const bt = tai.slice(i, i + n);
      const s = tong(bt);
      for (let j = 0; j + n <= tat.length; j += 1) {
        const bx = tat.slice(j, j + n);
        if (tong(bx) === s) return [...bt.map((t) => t.id), ...bx.map((t) => t.id)];
      }
    }
  }
  return [];
}

/**
 * D457 — kho trait của TRẬN NÀY: cờ `khoTraitHep` ⇒ danh sách hẹp (`KHO_TRAIT_HEP`), không ⇒ `undefined` (cả kho chung).
 * MỘT cửa cho mọi chỗ gọi `bayTrait` / `apMocTrait` — bốn chỗ API + bot + engine dùng chung, không ai tự dò cờ.
 */
export function khoTraitCua(st: { trait_kho_hep?: boolean; ke_lenh_v59?: boolean }): readonly TraitId[] | undefined {
  if (st.ke_lenh_v59 === true) return KHO_TRAIT_V59;   // D528 — khoá v59
  return st.trait_kho_hep === true ? KHO_TRAIT_HEP : undefined;
}

/** Cặp cố định của vai (chỉ khi `trait_vai`). D482 — cờ `trait_ghim_minigame` ⇒ cặp của khung minigame (trait ghim thay lõi ghim). */
export function traitVaiCua(vai: VaiId | undefined, ghimMinigame = false, v59 = false): readonly TraitId[] {
  return vai ? (v59 ? TRAIT_VAI_V59 : ghimMinigame ? TRAIT_VAI_MINIGAME : TRAIT_VAI)[vai] : [];
}

/** MỌI trait đang có hiệu lực trên ghế: cặp vai (nếu cổng) rồi trait đã nhận. */
export function traitHieuLuc(
  st: { trait_bat?: boolean; trait_vai?: boolean; trait_ghim_minigame?: boolean; ke_lenh_v59?: boolean }, g: { vai?: VaiId; trait?: readonly TraitId[] },
): TraitId[] {
  if (st.trait_bat !== true) return [];
  return [...(st.trait_vai === true ? traitVaiCua(g.vai, st.trait_ghim_minigame === true, st.ke_lenh_v59 === true) : []), ...(g.trait ?? [])];
}

/** MỘT struct gom mọi ràng buộc đang mang — các chỗ cắm chỉ đọc cái này. */
export interface RangBuoc {
  /** Mốc lệnh được thêm ngoài bước thô (LỆNH MỊN: 10%). */
  mocThem: readonly number[];
  /** Trần tiền BÁN (bán dài + đóng khống) cộng dồn trong một vòng, bp NAV (GÔNG CÙM, D425) — null = không trần. */
  tranBanVongBp: number | null;
  /** Nới trần số mã (TẦM RỘNG). */
  themMa: number;
  /** Trần số mã cứng (MỘT GIỎ) — null = không. */
  toiDaMa: number | null;
  /** Phí CỐ ĐỊNH mỗi lệnh, bp vốn khởi điểm của ghế (SỔ MỎNG, D425) — 0 = không. */
  phiLenhBp: number;
  giuNhiet: boolean;
  /** MÙ LỬA — lửa của ghế luôn tắt (không giảm trượt, không thưởng đà, không phạt đảo), +2 xu mỗi vòng. */
  muLua: boolean;
  mayXu: boolean;
  /** KỶ LUẬT — sàn lỗ (máy `chan_lo_san`; khoá `kyLuatSauDonBay` đặt sàn sau Đòn Bẩy). */
  chanLo: boolean;
  /** CHỐT NON — trần lãi (khoá `kyLuatSauDonBay` đặt trần sau Đòn Bẩy). */
  chotNon: boolean;
  /** NỘI GIÁN — số lá kế được biết LOẠI. 0 = không. */
  noiGian: number;
  /** MÙ TIN — lá TIN lật ra bị che với riêng ghế (server lột nội dung khỏi DTO), chỉ còn mã tăng/giảm. */
  muTin: boolean;
  /** SƯƠNG MÙ — lá PHA mới lật hiện HAI mặt (một thật, một mồi) với riêng ghế tới vòng sau. */
  suongMu: boolean;
  sangSo: boolean;
  /** KIÊN NHẪN — mã giữ liền ≥ `KIEN_NHAN_VONG` vòng: phần lãi của mã cộng thêm. */
  kienNhan: boolean;
  /** NÓNG VỘI — mã giữ liền quá `NONG_VOI_VONG` vòng: phần lãi của mã trong vòng bị cắt (gương KIÊN NHẪN). */
  nongVoi: boolean;
  /** ĐI SAU — thấy dòng lệnh VÒNG NÀY của cả bàn trước khi chốt (server tính, chỉ DTO). */
  diSau: boolean;
  /** LỘ LỆNH — chen chúc của riêng ghế × `LO_LENH_CHEN_X_BP`. */
  loLenh: boolean;
  /** TÊ LIỆT đang khoá lõi ở vòng này. */
  teLiet: boolean;
}

export const RANG_BUOC_TRONG: RangBuoc = Object.freeze({
  mocThem: [], tranBanVongBp: null, themMa: 0, toiDaMa: null, phiLenhBp: 0,
  giuNhiet: false, muLua: false, mayXu: false, chanLo: false, chotNon: false, noiGian: 0, muTin: false,
  suongMu: false, sangSo: false, kienNhan: false, nongVoi: false, diSau: false, loLenh: false, teLiet: false,
}) as RangBuoc;

/**
 * Ràng buộc của một ghế ở vòng `vong`. Cặp vai KHÔNG vào đây: luật của chúng vẫn chạy qua `vaiCoRang`
 * (mandate · tác động giá · siết · ghim lõi) — gọi tên ở DTO, không viết lại cơ chế.
 */
export function rangBuocCua(
  st: { trait_bat?: boolean; trait_vai?: boolean; dong_ho_minigame?: boolean },
  g: { vai?: VaiId; trait?: readonly TraitId[]; te_liet_den_vong?: number },
  vong: number,
): RangBuoc {
  if (st.trait_bat !== true || !g.trait || g.trait.length === 0) {
    return g.te_liet_den_vong !== undefined && vong <= g.te_liet_den_vong && st.trait_bat === true
      ? { ...RANG_BUOC_TRONG, teLiet: true } : RANG_BUOC_TRONG;
  }
  const co = new Set(g.trait);
  return {
    mocThem: co.has('lenh_min') ? [THAM_SO.LENH_MIN_MOC_BP] : [],
    tranBanVongBp: co.has('gong_cum') ? THAM_SO.GONG_CUM_TRAN_BAN_VONG_BP : null,
    themMa: co.has('tam_rong') ? THAM_SO.TAM_RONG_THEM_MA : 0,
    toiDaMa: co.has('mot_gio') ? THAM_SO.MOT_GIO_TOI_DA_MA : null,
    phiLenhBp: co.has('so_mong') ? THAM_SO.SO_MONG_PHI_LENH_BP : 0,
    giuNhiet: co.has('giu_nhiet'),
    muLua: co.has('mu_lua'),
    mayXu: co.has('may_xu'),
    chanLo: co.has('ky_luat'),
    chotNon: co.has('chot_non'),
    noiGian: co.has('noi_gian') ? THAM_SO.NOI_GIAN_SO_LA : 0,
    muTin: co.has('mu_tin'),
    suongMu: co.has('suong_mu'),
    sangSo: co.has('sang_so'),
    // D486 — khung minigame: KIÊN NHẪN / NÓNG VỘI sống TRONG MÀN (`cuaSoTrait`), tác dụng theo vòng tắt — lãi lỗ đã dồn vào màn (D479).
    kienNhan: co.has('kien_nhan') && st.dong_ho_minigame !== true,
    nongVoi: co.has('nong_voi') && st.dong_ho_minigame !== true,
    diSau: co.has('di_sau'),
    loLenh: co.has('lo_lenh'),
    teLiet: g.te_liet_den_vong !== undefined && vong <= g.te_liet_den_vong,
  };
}

export interface LuaChonTrait { lay: readonly TraitId[]; cuon: number }

export interface SuKienMocTrait {
  ghe_id: string;
  moc: number;
  moi: readonly TraitId[];
  lay: readonly TraitId[];
  cuon: number;
  xu_truoc: number;
  xu_sau: number;
  /** MẤT TRÍ đã xoá TÀI nào ở mốc này (null = không). */
  mat_tri: TraitId | null;
  /** Lựa chọn gửi lên KHÔNG hợp lệ (ngoài lượt mời · lệch cân · thiếu xu) ⇒ coi như không lấy. */
  bo_qua: boolean;
}

/**
 * Xử lý một MỐC cho một ghế: kiểm lượt mời + cân + xu, nhận trait, khoá TÊ LIỆT, MẤT TRÍ xoá TÀI. Hàm thuần:
 * trả ghế mới + sự kiện (API ghi `hd_chon_trait` từ đây; kho hành vi đọc lại).
 * ⚠ Không ném khi lựa chọn sai — replay của trận đã lưu không được nổ; API đã chặn từ trước khi ghi log.
 */
export function apMocTrait(
  seed: number, vong: number,
  g: { id: string; trait?: readonly TraitId[]; xu?: number; te_liet_den_vong?: number;
    trait_tu_vong?: Readonly<Partial<Record<TraitId, number>>>; vai?: VaiId },
  luaChon: LuaChonTrait | undefined,
  /** D457 — kho hẹp của trận (`khoTraitCua`). Vắng = cả kho chung. */
  kho?: readonly TraitId[],
): {
  trait: TraitId[]; xu: number; te_liet_den_vong?: number; trait_tu_vong: Partial<Record<TraitId, number>>;
  su_kien: SuKienMocTrait;
} {
  const dang = [...(g.trait ?? [])];
  const xuTruoc = g.xu ?? 0;
  const cuon = Math.max(0, Math.min(CHO_TRAIT.CUON_TOI_DA, Math.floor(luaChon?.cuon ?? 0)));
  const moi = bayTrait(seed, g.id, vong, cuon, dang, kho, g.vai);
  const lay = luaChon?.lay ?? [];
  const gia = giaCuon(cuon);
  const hopLe = lay.every((id) => moi.includes(id)) && canHopLe(lay) && gia <= xuTruoc;
  const layThat = hopLe ? [...lay] : [];
  const xuSau = hopLe ? xuTruoc - gia : xuTruoc;
  // MẤT TRÍ — mang từ MỐC TRƯỚC: ở mốc này mất ngẫu nhiên một TÀI kho chung (trước khi nhận lá mới).
  let matTri: TraitId | null = null;
  let sau = dang;
  if (dang.includes('mat_tri')) {
    const taiDang = dang.filter((id) => traitCua(id).loai === 'tai' && !traitCua(id).vai);
    if (taiDang.length > 0) {
      const k = rngAt(seed, `${DOMAIN}_mattri`, vong, g.id).below(taiDang.length);
      matTri = taiDang[k]!;
      const i = sau.indexOf(matTri);
      sau = [...sau.slice(0, i), ...sau.slice(i + 1)];
    }
  }
  sau = [...sau, ...layThat];
  const teLiet = layThat.includes('te_liet')
    ? vong + THAM_SO.TE_LIET_SO_VONG : g.te_liet_den_vong;
  // D422 — lá nhận ở mốc này có hiệu lực từ vòng KẾ; ghi lại để lớp che thông tin biết lá nào lật ra khi đã mang tật.
  const tuVong: Partial<Record<TraitId, number>> = { ...(g.trait_tu_vong ?? {}) };
  for (const id of layThat) tuVong[id] = vong + 1;
  return {
    trait: sau,
    xu: xuSau,
    ...(teLiet !== undefined ? { te_liet_den_vong: teLiet } : {}),
    trait_tu_vong: tuVong,
    su_kien: {
      ghe_id: g.id, moc: vong, moi, lay: layThat, cuon: hopLe ? cuon : 0,
      xu_truoc: xuTruoc, xu_sau: xuSau, mat_tri: matTri, bo_qua: !hopLe && (lay.length > 0 || cuon > 0),
    },
  };
}
