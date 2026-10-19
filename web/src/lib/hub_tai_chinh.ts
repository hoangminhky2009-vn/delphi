/**
 * Ô TÀI CHÍNH CỦA HUB — phần THUẦN: từ sổ + hũ trên MÁY ra những thứ ô cần vẽ. Không React, không IndexedDB, không đọc đồng hồ
 * (người gọi đưa `nay` vào) — nên test gọi thẳng, và Hub không kéo gói PFM nặng vào chỉ để import một hàm.
 *
 * ─── LUẬT (SPEC `ui-tang-khong-gian` 11/10) ──────────────────────────────────────────────────────────────────────
 * · Người chơi TỰ CHỌN nội dung ô: chi hôm nay · hũ ưu tiên · tiền tới ngày. MẶC ĐỊNH = hũ được đánh dấu SAO (ưu tiên cao,
 *   `laHuCoSao` — cùng cửa với màn HŨ); chưa hũ nào có sao ⇒ "chi hôm nay".
 * · Tiền của người dùng ở LẠI MÁY (P2): mọi số ở đây tính từ kho trên máy, không số nào đi lên mạng.
 * · Thiếu mẫu ⇒ `null`, không phải 0 (D62/P7): "chưa có sổ" khác "hôm nay chi 0 đồng". Ô khách / chưa có sổ không in số.
 * · Chi tiêu đếm qua `laChiTieu` (không đếm khoản CHUYỂN vào hũ — D420), đúng như SỔ và GƯƠNG.
 */
import { daTieuTrongThang, laChiTieu, tongGopVaoHu, type Khoan } from '@/pfm/so';
import { laHuCoSao, laTichLuy, laTieuDung, sapXep, tienDo, type Hu } from '@/pfm/hu';
import { tienToiNgay } from '@/pfm/tien_toi_ngay';
import { congNgay } from '@/pfm/thoi_gian';
import type { CheDoOTaiChinh } from './hub_che_do';

export interface NgayChi {
  ngay: string;
  /** Nhãn cột: T2…CN; cột cuối là hôm nay (người vẽ thay bằng chữ "NAY"). */
  thu: string;
  chi: number;
}

export interface HuSaoHub {
  id: string;
  ten: string;
  /** Tích lũy: đã góp · tiêu dùng: đã tiêu trong tháng. */
  daGop: number;
  muc: number | null;
  /** 0–1; `null` khi chưa đặt mức (không bịa 0). */
  tienDo: number | null;
  tieuDung: boolean;
}

export interface TienToiNgayHub {
  /** `YYYY-MM-DD`; `null` = phần còn lại đã hết. */
  ngayHet: string | null;
  tyLeDaTieu: number;
}

export interface TomTatHub {
  /** Máy này có ít nhất một khoản trong sổ. Chưa có sổ ⇒ ô không in số. */
  coSo: boolean;
  chiHomNay: number;
  /** 7 cột: 6 ngày trước + hôm nay (cột cuối). */
  chi7: NgayChi[];
  huSao: HuSaoHub | null;
  tienToiNgay: TienToiNgayHub | null;
}

const THU_VIET = ['CN', 'T2', 'T3', 'T4', 'T5', 'T6', 'T7'] as const;

/** Thứ của một ngày `YYYY-MM-DD` — toán trên chuỗi UTC, không phụ thuộc múi giờ máy. */
export function thuCuaNgay(ngay: string): string {
  return THU_VIET[new Date(`${ngay}T00:00:00Z`).getUTCDay()]!;
}

export function tomTatHub(tatCa: readonly Khoan[], hu: readonly Hu[], nay: string): TomTatHub {
  const chi7: NgayChi[] = [];
  for (let i = 6; i >= 0; i -= 1) {
    const ngay = congNgay(nay, -i);
    let chi = 0;
    for (const k of tatCa) if (k.ngay === ngay && laChiTieu(k)) chi += k.soTien;
    chi7.push({ ngay, thu: thuCuaNgay(ngay), chi });
  }

  const dangSong = hu.filter((h) => h.trangThai === 'dang_chay' || h.trangThai === 'tam_dung');
  const daGopCua = (h: Hu): number => (laTieuDung(h)
    ? daTieuTrongThang(tatCa, h.id, nay.slice(0, 7))
    : tongGopVaoHu(tatCa, h.id, h.mocGop));
  // `sapXep` đã đưa ưu tiên cao lên trước, rồi hũ sắp về đích — lấy hũ đeo sao đầu tiên theo đúng thứ tự màn HŨ.
  const dsSao = sapXep(dangSong.filter(laHuCoSao), (id) => {
    const h = dangSong.find((x) => x.id === id);
    return h === undefined ? 0 : daGopCua(h);
  });
  const h0 = dsSao[0];
  let huSao: HuSaoHub | null = null;
  if (h0 !== undefined) {
    const daGop = daGopCua(h0);
    huSao = {
      id: h0.id,
      ten: h0.ten,
      daGop,
      muc: h0.muc !== null && h0.muc > 0 ? h0.muc : null,
      // Tiêu dùng không "gom tới mức" nhưng tỉ lệ so mức tháng vẫn là con số thật; chưa đặt mức ⇒ null.
      tienDo: laTichLuy(h0) || h0.muc !== null ? tienDo(h0, daGop) : null,
      tieuDung: laTieuDung(h0),
    };
  }

  const t = tienToiNgay(tatCa, nay);
  return {
    coSo: tatCa.length > 0,
    chiHomNay: chi7[6]!.chi,
    chi7,
    huSao,
    tienToiNgay: t === null ? null : { ngayHet: t.ngayHet, tyLeDaTieu: t.tyLeDaTieu },
  };
}

/**
 * Cách ô SẼ hiện. `chon` = lựa chọn đã lưu của người chơi (`null` = chưa chọn ⇒ mặc định).
 * Chọn "hũ ưu tiên" mà nay không còn hũ sao nào ⇒ rơi về "chi hôm nay" (không để ô trống) — lựa chọn đã lưu vẫn còn, hũ có sao
 * trở lại thì ô tự quay lại hũ.
 */
export function cheDoHienThi(chon: CheDoOTaiChinh | null, t: TomTatHub): CheDoOTaiChinh {
  const mongMuon: CheDoOTaiChinh = chon ?? 'hu_sao';
  if (mongMuon === 'hu_sao') return t.huSao !== null ? 'hu_sao' : 'chi_hom_nay';
  return mongMuon;
}

/**
 * Số tiền gọn cho ô nhỏ: 850 ⇒ 850 đ · 85.000 ⇒ 85k · 5.500 ⇒ 5,5k · 1.250.000 ⇒ 1,3tr. Trả `{ so, don }` để ô vẽ đơn vị nhỏ
 * cạnh số lớn (demo). Làm tròn có chủ ý — đây là liếc nhanh; số đầy đủ ở màn SỔ.
 */
export function tienGon(dong: number): { so: string; don: string } {
  const n = Math.max(0, Math.round(dong));
  const lam = (v: number, ndp: number) => {
    const s = v.toFixed(ndp);
    return (ndp > 0 ? s.replace(/\.?0+$/, '') : s).replace('.', ',');
  };
  if (n >= 1_000_000) return { so: lam(n / 1_000_000, n >= 10_000_000 ? 0 : 1), don: 'tr' };
  if (n >= 1_000) return { so: lam(n / 1_000, n >= 10_000 ? 0 : 1), don: 'k' };
  return { so: String(n), don: 'đ' };
}

/** Chiều cao cột (%) — cột 0 vẫn có vạch 4 % để thấy "ngày này không chi" chứ không mất cột. */
export function chieuCaoCot(chi: number, max: number): number {
  if (max <= 0) return 4;
  return Math.max(4, Math.round((chi / max) * 100));
}
