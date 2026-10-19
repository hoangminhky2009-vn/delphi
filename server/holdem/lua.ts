/**
 * MÁY NGỌN LỬA ĐÀ (D409, cổng `lua` · `luaPhi` · `luaQuyetToan` · `luaMuaDuoi`). Số + lý lẽ ở `config/lua.ts`; ở đây chỉ có máy.
 *
 * Mọi hàm THUẦN, không tiêu RNG, không đọc DB. `chotPhien` gọi `capNhatLua` cho từng ghế SAU khi đã có NAV/lãi lỗ
 * của vòng; `apLenhGiaoDich` đọc `heSoTruotLua`; `dungChuoi` đọc `matXichLua`. Tắt cổng ⇒ không hàm nào được gọi
 * ⇒ trận cũ replay từng bit.
 */
import { LUA, type BiasLua, type LyDoDap, type NacLua } from '../../config/lua.js';
import { TAI_SAN } from '../../config/holdem.js';

export interface TrangThaiLua {
  nac: NacLua;
  /** Số vòng liên tiếp giữ cùng bias (đã cộng thưởng Mua Đuổi đúng lúc). */
  chuoi: number;
  bias: BiasLua;
  /** ≥ `LUA.LOI_MUA_DUOI_DAC_BIET` lõi Mua Đuổi — chỉ đổi HÌNH (xanh → tím). */
  dac_biet?: true;
}

export const LUA_TAN: TrangThaiLua = Object.freeze({ nac: 0, chuoi: 0, bias: null }) as TrangThaiLua;

/** Nấc theo chuỗi; ngưỡng nấc 3 hạ theo số lõi Mua Đuổi đang cầm (founder §1.3). */
export function nacTheoChuoi(chuoi: number, soLoiMuaDuoi: number): NacLua {
  const nguong3 = soLoiMuaDuoi >= 2
    ? LUA.VONG_LEN_NAC3_THEO_LOI_MUA_DUOI[2]!
    : soLoiMuaDuoi === 1 ? LUA.VONG_LEN_NAC3_THEO_LOI_MUA_DUOI[1]! : LUA.VONG_LEN_NAC[2];
  if (chuoi >= nguong3) return 3;
  if (chuoi >= LUA.VONG_LEN_NAC[1]) return 2;
  if (chuoi >= LUA.VONG_LEN_NAC[0]) return 1;
  return 0;
}

/** Chuỗi NHỎ NHẤT cho một nấc — dùng khi GIỮ NHIỆT hạ nấc thay vì tắt. */
export function chuoiToiThieuCuaNac(nac: NacLua, soLoiMuaDuoi: number): number {
  if (nac === 0) return 0;
  if (nac === 3) {
    return soLoiMuaDuoi >= 2
      ? LUA.VONG_LEN_NAC3_THEO_LOI_MUA_DUOI[2]!
      : soLoiMuaDuoi === 1 ? LUA.VONG_LEN_NAC3_THEO_LOI_MUA_DUOI[1]! : LUA.VONG_LEN_NAC[2];
  }
  return LUA.VONG_LEN_NAC[nac - 1]!;
}

/**
 * BIAS của một ghế từ vị thế (sau lệnh của vòng, trước định giá): nhóm chiếm phần lớn vị thế dài, `khong` khi sổ
 * khống lớn hơn cả hai nhóm, `null` khi tổng vị thế dưới `NGUONG_VI_THE_BP` của NAV (không tích, không dập).
 */
export function biasCua(
  g: { vi_the: Readonly<Record<string, number>>; vi_the_khong?: Readonly<Record<string, number>> },
  nav: number,
): BiasLua {
  let ruiRo = 0;
  let phongThu = 0;
  for (const [ma, v] of Object.entries(g.vi_the)) {
    const nhom = TAI_SAN.find((t) => t.id === ma)?.nhom;
    if (nhom === 'rui_ro') ruiRo += v;
    else if (nhom === 'phong_thu') phongThu += v;
  }
  const khong = Object.values(g.vi_the_khong ?? {}).reduce((a, b) => a + b, 0);
  const tong = ruiRo + phongThu + khong;
  if (nav <= 0 || tong * 10000 < nav * LUA.NGUONG_VI_THE_BP) return null;
  if (khong > ruiRo && khong > phongThu) return 'khong';
  return ruiRo >= phongThu ? 'rui_ro' : 'phong_thu';
}

export interface DauVaoLua {
  truoc: TrangThaiLua | undefined;
  biasMoi: BiasLua;
  /** Đổi tay trong vòng — `Ghe.doi_tay_vong` (tiền BÁN · MUA vào nhóm khác bias cũ · MUA vào rủi ro). */
  doiTay: { ban: number; mua_khac: number; mua_rui_ro: number; mua_tong?: number } | undefined;
  navDauVong: number;
  soLoiMuaDuoi: number;
  /** Cổng `luaMuaDuoi`: nhịp Mua Đuổi của vòng — `som` (đúng lúc) · `muon` (FOMO) · null. */
  muaDuoi: 'som' | 'muon' | null;
  /** Vòng này phần giá nhóm rủi ro của ghế lãi hay không — "đúng lúc" chỉ đếm thưởng khi thắng. */
  ruiRoLai: boolean;
  giuNhiet: boolean;
}

/**
 * Cập nhật lửa cuối vòng. Tích/dập THEO NGƯỜI CHƠI (founder 25/09 câu 1: A):
 *   · bias `null` ⇒ đứng yên (câu 2: A);
 *   · đổi bias hoặc đổi tay ≥ ngưỡng ⇒ DẬP (về 0, GIỮ NHIỆT thì hạ 1 nấc);
 *   · Mua Đuổi muộn ⇒ vòng này KHÔNG đếm chuỗi (không dập); đúng lúc và thắng ⇒ chuỗi +1 thêm;
 *   · còn lại ⇒ chuỗi +1.
 * `xu` = xu nhận theo nấc SAU (chưa gồm MÁY XU — caller cộng theo trait).
 */
export function capNhatLua(d: DauVaoLua): { sau: TrangThaiLua; dap: LyDoDap | null; xu: number } {
  const truoc = d.truoc ?? LUA_TAN;
  const dacBiet = d.soLoiMuaDuoi >= LUA.LOI_MUA_DUOI_DAC_BIET;
  const ketQua = (chuoi: number, bias: BiasLua, dap: LyDoDap | null) => {
    const nac = nacTheoChuoi(chuoi, d.soLoiMuaDuoi);
    const sau: TrangThaiLua = { nac, chuoi, bias, ...(dacBiet ? { dac_biet: true as const } : {}) };
    return { sau, dap, xu: LUA.XU_THEO_NAC[nac] };
  };
  const doiTayLon = d.doiTay !== undefined && d.navDauVong > 0
    && (d.doiTay.ban + d.doiTay.mua_khac) * 10000 >= d.navDauVong * LUA.NGUONG_DOI_TAY_BP;
  const dapVe = (dap: LyDoDap, bias: BiasLua) => {
    const nacSau: NacLua = d.giuNhiet ? (Math.max(0, truoc.nac - LUA.GIU_NHIET_HA_NAC) as NacLua) : 0;
    return ketQua(chuoiToiThieuCuaNac(nacSau, d.soLoiMuaDuoi), bias, dap);
  };
  if (d.biasMoi === null) {
    // Không có vị thế: đứng yên (không tích, không dập), xu theo nấc đang giữ — TRỪ khi chính vòng này đã đổi tay
    // lớn (bán sạch): đó là "phân bổ lại quá lớn" của founder, dập như thường; bias cũ giữ để nhớ phía đã đứng.
    if (doiTayLon) return dapVe('doi_tay', truoc.bias);
    return ketQua(truoc.chuoi, truoc.bias, null);
  }
  if (truoc.bias !== null && truoc.bias !== d.biasMoi) return dapVe('doi_bias', d.biasMoi);
  if (doiTayLon) return dapVe('doi_tay', d.biasMoi);
  if (d.muaDuoi === 'muon') return ketQua(truoc.chuoi, d.biasMoi, 'mua_duoi_muon');
  const thuong = d.muaDuoi === 'som' && d.ruiRoLai ? 1 : 0;
  return ketQua(truoc.chuoi + 1 + thuong, d.biasMoi, null);
}

/** Hệ số trượt giá theo nấc (10000 = ×1) — cổng `luaPhi`. */
export function heSoTruotLuaBp(nac: NacLua): number {
  return LUA.HE_SO_TRUOT_BP[nac];
}

/**
 * Mắt xích lửa THEO MÃ (cổng `luaQuyetToan`): phần giá của mã trong vòng (bp, đã qua đòn bẩy) lãi ⇒ cộng
 * `HE_SO_THUAN[nấc]`, lỗ ⇒ trừ thêm `HE_SO_DAO[nấc]` — trả về delta_bp từng mã (0 bị lược).
 * `khongPhatDao` (cổng `luaKhongPhatDao`, D422): vế lỗ không trừ thêm gì — lửa chỉ còn là phần thưởng của đà.
 */
export function matXichLua(
  phanTheoMa: Readonly<Record<string, number>>, nac: NacLua, khongPhatDao = false,
): { ma: string; thuan: boolean; he_so_bp: number; delta_bp: number }[] {
  if (nac <= 0) return [];
  const ra: { ma: string; thuan: boolean; he_so_bp: number; delta_bp: number }[] = [];
  for (const [ma, bp] of Object.entries(phanTheoMa)) {
    if (bp === 0) continue;
    const thuan = bp > 0;
    if (!thuan && khongPhatDao) continue;
    const heSo = thuan ? LUA.HE_SO_THUAN_BP[nac] : LUA.HE_SO_DAO_BP[nac];
    // Cả hai chiều cùng dấu với bp: lãi thêm lãi, lỗ thêm lỗ. Floor về phía âm vô cùng (đúng nếp floor của A5).
    const delta = Math.floor((bp * heSo) / 10000);
    if (delta !== 0) ra.push({ ma, thuan, he_so_bp: heSo, delta_bp: delta });
  }
  return ra;
}
