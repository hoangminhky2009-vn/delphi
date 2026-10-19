/**
 * BỐI CẢNH DÀI HẠN — MÁY (D574, cổng `boiCanhDaiHan`). Số + nguồn ở `config/boi_canh_dai_han.ts`; ở đây chỉ có MÁY.
 *
 * MỘT NGUỒN cho engine (nghiêng giá mỗi ô) · bánh xe mùa (độ dài / rẽ) · kỳ họp (nghiêng hạ/tăng, chuyển nợ) · tin vĩ mô trong màn.
 * Tất định theo seed: rút một lần, RNG domain riêng (`holdem_bcdh`) ⇒ không xê dịch một cú rút nào của map khoá cũ.
 * ⚠ LATENT — không gửi client, không lật khi hết trận (founder 10/10 "Không lật."). Server suy lại được từ seed bất cứ lúc nào.
 */
import {
  BOI_CANH_CUA, BOI_CANH_DAI_HAN, SO_MAU_VI_MO,
  type BoiCanhId, type PhaNo, type SongCongNghe, type TrangThaiLop,
} from '../../config/boi_canh_dai_han.js';
import { rngAt } from '../sandbox/rng.js';
import { doThamSo } from '../../config/holdem.js';

const DOMAIN = 'holdem_bcdh';

export interface BoiCanhDaiHan {
  song: SongCongNghe;
  /** Pha nợ MỞ MÀN. */
  no: PhaNo;
  /** Ô (1-based, cùng quy ước `LICH_CHINH_SACH.O_THEO_MAP`) của kỳ họp chuyển Nới → Căng. Vắng = không chuyển. */
  chuyen_no?: number;
}

/**
 * Bối cảnh dài hạn của trận `seed`. `oLich` = các ô kỳ họp của bàn (1-based) — chuyển nợ chỉ rơi vào một trong số đó; bàn không
 * có kỳ họp thì không chuyển.
 */
export function boiCanhDaiHan(seed: number, oLich: readonly number[]): BoiCanhDaiHan {
  const B = BOI_CANH_DAI_HAN;
  const song: SongCongNghe = rngAt(seed, DOMAIN, 0).chanceBp(B.SONG_LEN_BP) ? 'len' : 'bao_hoa';
  const no: PhaNo = rngAt(seed, DOMAIN, 1).chanceBp(B.NO_NOI_BP) ? 'noi' : 'cang';
  if (no !== 'noi' || oLich.length === 0 || !rngAt(seed, DOMAIN, 2).chanceBp(doThamSo('BCDH_CHUYEN_NO_BP', B.CHUYEN_NO_BP))) return { song, no };
  return { song, no, chuyen_no: oLich[rngAt(seed, DOMAIN, 3).below(oLich.length)]! };
}

export function idBoiCanh(song: SongCongNghe, no: PhaNo): BoiCanhId {
  return BOI_CANH_CUA[song][no];
}

export function songCua(id: BoiCanhId): SongCongNghe {
  return id === 'sieu_bo' || id === 'len_cang' ? 'len' : 'bao_hoa';
}

export function noCua(id: BoiCanhId): PhaNo {
  return id === 'sieu_bo' || id === 'bay_gia_tri' ? 'noi' : 'cang';
}

/**
 * Kỳ họp nghiêng theo pha nợ (không áp cho kỳ họp chuyển nợ — kỳ đó luôn TĂNG). Nới: giữ ⇒ hạ · tăng ⇒ giữ; Căng: giữ ⇒ tăng · hạ ⇒ giữ.
 * `r` = một cú rút riêng của kỳ họp (domain mới của `sinhMap`).
 */
export function nghiengKyHop(
  kyVong: 'tang' | 'ha' | 'giu', no: PhaNo, r: { below(n: number): number },
): 'tang' | 'ha' | 'giu' {
  // Núm ĐO (HOLDEM_SWEEP=1): `HOLDEM_BCDH_KH_GIU_BP` · `HOLDEM_BCDH_KH_NGUOC_BP` — mặc định = config.
  const K = { GIU_THANH_HUONG_BP: doThamSo('BCDH_KH_GIU_BP', BOI_CANH_DAI_HAN.KY_HOP.GIU_THANH_HUONG_BP),
    NGUOC_THANH_GIU_BP: doThamSo('BCDH_KH_NGUOC_BP', BOI_CANH_DAI_HAN.KY_HOP.NGUOC_THANH_GIU_BP) };
  const huong = no === 'noi' ? 'ha' : 'tang';
  const x = r.below(10000);
  if (kyVong === 'giu') return x < K.GIU_THANH_HUONG_BP ? huong : 'giu';
  if (kyVong !== huong) return x < K.NGUOC_THANH_GIU_BP ? 'giu' : kyVong;
  return kyVong;
}

/** Một dòng tin vĩ mô: lớp nó nói · trạng thái nó nói · có đúng không · chỉ số mẫu chữ. */
export interface TinViMo {
  lop: 'song' | 'no';
  noi: TrangThaiLop;
  dung: boolean;
  mau: number;
  /** Nến (0–11, cộng 3 ở màn) mà dòng tin hiện — cùng mọi ghế. */
  nen: number;
}

const NGUOC: Readonly<Record<TrangThaiLop, TrangThaiLop>> = { len: 'bao_hoa', bao_hoa: 'len', noi: 'cang', cang: 'noi' };

/**
 * Tin vĩ mô của vòng `vong` (null = vòng này không có). Cùng một dòng cho MỌI ghế ở cùng vòng — tin vĩ mô là của cả chợ.
 * `hienTai` = bối cảnh ĐANG CHẠY ở ô của màn (sau chuyển nợ thì là bối cảnh mới). Tất định theo (seed, vòng).
 */
export function tinViMoVong(seed: number, vong: number, hienTai: BoiCanhId): TinViMo | null {
  const T = BOI_CANH_DAI_HAN.TIN_VI_MO;
  const r = rngAt(seed, `${DOMAIN}_tin`, vong);
  if (!r.chanceBp(T.TY_LE_MAN_BP)) return null;
  const lop = r.chanceBp(T.LOP_SONG_BP) ? 'song' : 'no';
  const dung = r.chanceBp(T.DUNG_BP);
  const that: TrangThaiLop = lop === 'song' ? songCua(hienTai) : noCua(hienTai);
  return { lop, noi: dung ? that : NGUOC[that], dung, mau: r.below(SO_MAU_VI_MO), nen: r.below(12) };
}

/** ID chữ của dòng tin vĩ mô (client tra `chuTin`, D26): `vm.<trạng thái>.<mẫu>`. */
export function chuTinViMo(t: Pick<TinViMo, 'noi' | 'mau'>): string {
  return `vm.${t.noi}.${t.mau}`;
}

/**
 * Núm ĐO (chỉ sống khi HOLDEM_SWEEP=1 — `doThamSo`; mặc định không tắt gì): `HOLDEM_BCDH_TAT` = mặt nạ bit các PHẦN của bối cảnh bị tắt, để
 * tách phần nào đẩy gate (A8.2: đo trước khi trình). 1 nghiêng giá · 2 bánh xe theo bối cảnh · 4 nghiêng kỳ họp · 8 nhân lá bong bóng/hoảng loạn ·
 * 16 chuyển nợ (kỳ họp ép tăng · ngòi · đổ đèo).
 */
export const PHAN_BCDH = { NGHIENG: 1, BANH_XE: 2, KY_HOP: 4, TIN: 8, CHUYEN: 16 } as const;
export function phanBcdhBat(bit: number): boolean {
  return (doThamSo('BCDH_TAT', 0) & bit) === 0;
}
