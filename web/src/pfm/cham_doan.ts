/**
 * PFM — **APP TỰ CHẤM LỜI ĐOÁN CỦA CHÍNH NÓ** (D368).
 *
 * ⚠⚠ ĐÂY LÀ THỨ NGĂN CHÂN DUNG TRỞ THÀNH LÁ SỐ TỬ VI. Trước lượt này, mỗi chân dung kèm
 * một câu "TÔI ĐOÁN TUẦN ĐẦU" — hiện ra rồi thôi, **không chỗ nào chấm lại**. App phán mà
 * không bao giờ trả giá thì câu nào cũng đúng, và người dùng không có cách nào biết app có
 * thật sự đọc sổ của mình hay không. Founder 21/09: *"sao mà đơn giản thế? nó chỉ đơn giản
 * là nhắc lại câu user đã trả lời"* — đúng, và cổng chấm này là câu trả lời cho đúng chỗ ấy.
 *
 * ⚠⚠ LỜI ĐOÁN PHẢI NÓI ĐÚNG THỨ ĐƯỢC ĐO. Bốn câu cũ viết kiểu văn xuôi ("hai ngày tiêu nhiều
 * nhất của tuần") — nghe hay nhưng không có phép kiểm nào khớp chính xác với nó, nên chấm kiểu
 * gì cũng là diễn giải. Nay mỗi câu được viết lại cho khớp TỪNG CHỮ với hàm chấm dưới đây; chữ
 * ở `lib/pfm_chu.ts`, phép đo ở đây, và bài canh khoá hai bên với nhau.
 *
 * ⚠ A10 🔒 — KẾT QUẢ NÓI VỀ APP, KHÔNG NÓI VỀ NGƯỜI DÙNG. "Tôi trật" chứ không phải "bạn tiêu
 * sai"; không có chữ nào khen chê cách họ tiêu. Và P5/P6: trúng hay trật đều KHÔNG thưởng phạt
 * người dùng — đây là điểm của app, không phải điểm của họ.
 * ⚠ P7 — thiếu mẫu ⇒ `chua_du`, KHÔNG phải `trat`. Một lời đoán không kiểm được thì chưa sai.
 *
 * Hàm THUẦN: không đọc đồng hồ, không đọc kho, không chuỗi hiển thị (D26).
 */
import { PFM } from '@config/pfm';
import { chiTheoNgay, trungVi } from './guong.js';
import type { MaChanDung } from './chan_dung.js';
import { laChiTieu, laThu, type Khoan } from './so.js';

export type KetQuaDoan = 'trung' | 'trat' | 'chua_du';

/** Cửa sổ tự nhiên của từng lời đoán — tuần thì chấm cuối tuần, tháng thì chấm cuối tháng. */
export type CuaDoan = 'tuan' | 'thang';

export const CUA_CUA_DOAN: Record<MaChanDung, CuaDoan | null> = {
  tien_ve: 'tuan',
  ngay_te: 'tuan',
  ban_ru: 'tuan',
  cuoi_thang: 'thang',
  chua_ro: null,      // không đoán gì ⇒ không chấm gì (P7 — xem `chanDung`)
};

export interface ChamDoan {
  ma: MaChanDung;
  ketQua: KetQuaDoan;
  /**
   * Hai số đứng sau phán quyết, để câu chữ CHỈ RA được nó dựa vào đâu.
   * `null` khi `chua_du`. Ý nghĩa từng cặp ghi ở mỗi nhánh bên dưới.
   */
  so: { doDuoc: number; moc: number } | null;
}

function cachNgay(a: string, b: string): number {
  return Math.round((Date.parse(`${b}T00:00:00Z`) - Date.parse(`${a}T00:00:00Z`)) / 86_400_000);
}

const trong = (k: Khoan, tu: string, den: string): boolean => k.ngay >= tu && k.ngay <= den;

/** Ngày có tổng chi lớn nhất trong cửa sổ; `null` nếu không có ngày nào có chi. */
function ngayDamNhat(theoNgay: ReadonlyMap<string, number>): string | null {
  let ra: string | null = null;
  let max = -1;
  // Duyệt theo THỨ TỰ NGÀY (không theo thứ tự Map) để hoà thì lấy ngày SỚM hơn — tất định.
  for (const n of [...theoNgay.keys()].sort()) {
    const v = theoNgay.get(n)!;
    if (v > max) { max = v; ra = n; }
  }
  return ra;
}

/**
 * Chấm lời đoán của MỘT chân dung trên cửa sổ `[tu, den]` (gồm cả hai đầu).
 *
 * ⚠ Sàn mẫu dùng lại `GUONG_SAN_NGAY_CHI` (6 ngày có chi) — cùng sàn mà gương dùng để dám nói
 *   "ngày thường của bạn là bao nhiêu". Chấm một lời đoán trên ít ngày hơn thế là chấm bằng nhiễu.
 */
export function chamDoan(
  ma: MaChanDung, so: readonly Khoan[], tu: string, den: string,
): ChamDoan {
  const chua: ChamDoan = { ma, ketQua: 'chua_du', so: null };
  if (CUA_CUA_DOAN[ma] === null) return chua;

  const trongKy = so.filter((k) => trong(k, tu, den));
  const theoNgay = chiTheoNgay(trongKy);
  if (theoNgay.size < PFM.GUONG_SAN_NGAY_CHI) return chua;

  switch (ma) {
    /*
     * "Ngày tiêu đậm nhất sẽ rơi vào 48 giờ sau một lần tiền về."
     * đo = ngày đậm nhất · mốc = có nằm trong cửa sổ tiền về không.
     * ⚠ Không có lần tiền về nào trong kỳ ⇒ `chua_du`: lời đoán nói về cửa sổ ấy, không có cửa
     *   sổ thì nó chưa có cơ hội đúng hay sai.
     */
    case 'tien_ve': {
      const ngayThu = trongKy.filter(laThu).map((k) => k.ngay);
      if (ngayThu.length === 0) return chua;
      const cuaSo = new Set<string>();
      for (const t of ngayThu) {
        for (let i = 0; i < PFM.GUONG_CUA_SO_TIEN_VE; i++) {
          cuaSo.add(new Date(Date.parse(`${t}T00:00:00Z`) + i * 86_400_000).toISOString().slice(0, 10));
        }
      }
      const dam = ngayDamNhat(theoNgay);
      if (dam === null) return chua;
      return { ma, ketQua: cuaSo.has(dam) ? 'trung' : 'trat', so: { doDuoc: theoNgay.get(dam)!, moc: cuaSo.size } };
    }

    /*
     * "Ngay sau ngày tiêu đậm nhất, bạn sẽ tiêu trên mức thường ngày."
     * đo = chi của ngày kế tiếp · mốc = trung vị mức chi ngày của kỳ.
     * ⚠ Ngày đậm nhất là ngày CUỐI cửa sổ ⇒ `chua_du`: không có "ngày sau" để nhìn.
     */
    case 'ngay_te': {
      const dam = ngayDamNhat(theoNgay);
      if (dam === null || cachNgay(dam, den) < 1) return chua;
      const sau = new Date(Date.parse(`${dam}T00:00:00Z`) + 86_400_000).toISOString().slice(0, 10);
      const nen = trungVi([...theoNgay.values()])!;
      const chiSau = theoNgay.get(sau) ?? 0;
      return { ma, ketQua: chiSau > nen ? 'trung' : 'trat', so: { doDuoc: chiSau, moc: nen } };
    }

    /*
     * "Khoản lớn nhất kỳ này sẽ là khoản bạn gắn nhãn «vì sale / bạn rủ»."
     * đo = số tiền khoản lớn nhất · mốc = 1 nếu nó có nhãn, 0 nếu không.
     * ⚠ `viSale` là thứ NGƯỜI DÙNG tự gắn (P6 — tự khai). Chưa gắn nhãn khoản nào trong kỳ ⇒
     *   `chua_du`: im lặng của họ không phải là câu trả lời "không".
     */
    case 'ban_ru': {
      const chi = trongKy.filter(laChiTieu);
      if (chi.length === 0 || !chi.some((k) => k.viSale !== null)) return chua;
      const lon = chi.reduce((a, k) => (k.soTien > a.soTien ? k : a), chi[0]!);
      return { ma, ketQua: lon.viSale === true ? 'trung' : 'trat', so: { doDuoc: lon.soTien, moc: lon.viSale === true ? 1 : 0 } };
    }

    /*
     * "Nửa cuối kỳ bạn sẽ tiêu nhiều hơn nửa đầu."
     * đo = tổng chi nửa sau · mốc = tổng chi nửa đầu. Cắt đôi theo NGÀY LỊCH của cửa sổ, không
     * theo số ngày có chi — nửa tháng là nửa tháng dù có ghi hay không.
     */
    case 'cuoi_thang': {
      const soNgay = cachNgay(tu, den) + 1;
      if (soNgay < 2) return chua;
      const giua = Date.parse(`${tu}T00:00:00Z`) + Math.floor(soNgay / 2) * 86_400_000;
      let dau = 0;
      let cuoi = 0;
      for (const [n, v] of theoNgay) {
        if (Date.parse(`${n}T00:00:00Z`) < giua) dau += v; else cuoi += v;
      }
      if (dau === 0 && cuoi === 0) return chua;
      return { ma, ketQua: cuoi > dau ? 'trung' : 'trat', so: { doDuoc: cuoi, moc: dau } };
    }

    default:
      return chua;
  }
}

/* ══ SỔ THÀNH TÍCH CỦA APP — không phải của người dùng ═══════════════════════ */

export interface ThanhTichDoan { trung: number; trat: number }

/**
 * ⚠ Sổ này đếm APP đoán đúng mấy lần, và nó phải HIỆN RA cho người dùng thấy. Giấu đi thì
 * "app tự chấm" chỉ là một màn diễn: người ta không có cách nào biết tỷ lệ trúng có tệ không.
 * `chua_du` KHÔNG vào sổ — nó chưa phải một lượt đoán.
 */
export function congThanhTich(cu: ThanhTichDoan, kq: KetQuaDoan): ThanhTichDoan {
  if (kq === 'trung') return { ...cu, trung: cu.trung + 1 };
  if (kq === 'trat') return { ...cu, trat: cu.trat + 1 };
  return cu;
}
