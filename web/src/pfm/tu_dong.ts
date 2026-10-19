/**
 * PFM — QUY TẮC TỰ CHIA VÀO HŨ (D420, founder 26/09).
 *
 * Founder: *"thêm luôn chức năng 'Tự động phân bổ' để user tự thiết lập số tiền sẽ được chia vào quỹ nào / ngày và nếu
 * thiếu hoặc thừa thì app sẽ hỏi chứ ko tự phân bổ. Cho phép chia theo % hoặc tiền cố định."* Hỏi lại bằng câu đóng:
 * khớp thì *"Tự chia + HOÀN TÁC"*; về %: *"Bỏ chia % cũng được hoặc thiết kế cho những thứ phù hợp"*.
 *
 * ⭐ HAI KIỂU, mỗi kiểu ở đúng chỗ nó có nghĩa:
 *   · `ngay` — X đồng MỖI NGÀY. Ngày chưa chạy thì dồn (mở app sau ba ngày ⇒ ba phần), vì lời hứa là "mỗi ngày".
 *   · `phan_tram` — Y % MỖI KHOẢN TIỀN VÀO. % chỉ có nghĩa trên tiền vào: chia 10 % một bữa trưa, hay 10 % "cả ví" mỗi tối
 *     (ví để càng lâu càng bị cắt lại), đều vô nghĩa — nên không có hai kiểu ấy.
 * ⭐ MỞ MÀN HŨ ⇒ `denHan` xếp một trong bốn:
 *   · KHỚP — ví đủ cho mọi phần đến hạn, và không đồng tiền vào mới nào nằm ngoài quy tắc % ⇒ TỰ CHIA, có hoàn tác.
 *   · THIẾU — ví không đủ ⇒ HỎI (chia theo tỉ lệ số đang có · bỏ qua lần này). Không tự chia.
 *   · THỪA — có tiền vào mới mà quy tắc % không chia hết ⇒ HỎI (chia theo quy tắc, phần còn lại ở ví · bỏ qua).
 *     ⚠ "Thừa" CHỈ đo trên tiền VÀO MỚI, không trên cả ví: ví lúc nào cũng còn tiền tiêu, đo trên cả ví là hỏi mỗi tối.
 *   · KHÔNG — chẳng có gì đến hạn, chẳng có tiền vào mới ⇒ im.
 * ⚠ P3 🔒 — con số là của người dùng (họ tự đặt quy tắc); app chỉ nhân/chia trên số ấy, không gợi ý mức nào. Chip "THEO
 *   CỠ LÁ" ở bảng tạo hũ chỉ chép lại cỡ mỗi ngày của CHÍNH vị thế họ đặt (mức ÷ kỳ hạn — `vi_the.ts`).
 * ⚠ Tiền là số nguyên, làm tròn XUỐNG tới nghìn (C5); phép nhân có thể lớn đi qua BigInt.
 * ⚠ Hũ TẠM DỪNG: phần của nó là 0 nhưng mốc VẪN tiến — không thì mở lại hũ là dồn trả cả quãng dừng.
 * ⚠ Hàm thuần, không đọc đồng hồ. Ghi vào kho ở `sua_ban_ghi.ts` §`chayTuDongKho` (xếp hàng; mốc tiến TRƯỚC khoản).
 */
import { KIEU_TU_DONG, laTichLuy, laTieuDung, type Hu, type KieuTuDong, type QuyTacTuDong } from './hu.js';
import { laThu, type Khoan } from './so.js';
import { taoKhoanPhanBo, tienConLai } from './phan_bo.js';
import { congNgay, soNgayGiua } from './thoi_gian.js';

export class LoiTuDong extends Error {}

/** Thứ người dùng đặt ở bảng tạo hũ. */
export interface DatTuDong {
  kieu: KieuTuDong;
  gt: number;
}

export function kiemTuDong(d: DatTuDong): void {
  if (!KIEU_TU_DONG.includes(d.kieu)) throw new LoiTuDong(`Kiểu quy tắc không hợp lệ: ${String(d.kieu)}`);
  if (!Number.isSafeInteger(d.gt) || d.gt <= 0) throw new LoiTuDong(`Số của quy tắc phải là số nguyên dương: ${d.gt}`);
  if (d.kieu === 'phan_tram' && d.gt > 100) throw new LoiTuDong(`Phần trăm quá 100: ${d.gt}`);
}

/**
 * Đặt · đổi · gỡ (`null`) quy tắc của một hũ.
 * ⚠ Đổi SỐ mà giữ kiểu ⇒ giữ mốc: ngày đã chạy không chạy lại. Đặt mới hoặc đổi KIỂU ⇒ tính từ hôm nay.
 */
export function datTuDong(h: Hu, d: DatTuDong | null, homNay: string): Hu {
  if (d === null) {
    if (h.tuDong === undefined) return h;
    const ra = { ...h };
    delete ra.tuDong;
    return ra;
  }
  // D421 — quy tắc CHIA TIỀN vào hũ; hũ tiêu dùng không nhận tiền (nó nhận phiếu chi).
  if (laTieuDung(h)) throw new LoiTuDong('Hũ chi không nhận tiền — không có quy tắc tự chia.');
  kiemTuDong(d);
  const cu = h.tuDong;
  if (cu !== undefined && cu.kieu === d.kieu) return { ...h, tuDong: { ...cu, gt: d.gt } };
  return { ...h, tuDong: { kieu: d.kieu, gt: d.gt, tu: homNay, chayToi: null, moc: null } };
}

/** Tiền vào THẬT cho quy tắc: tiền vào của sổ (`laThu` — không phải rút hũ ở màn HŨ) và không nối hũ nào (rút kiểu cũ). */
function laTienVao(k: Khoan): boolean {
  return laThu(k) && k.huId === null;
}

/** Khoản tiền vào này MỚI với quy tắc `q`: ghi sau lần chạy trước; chưa chạy lần nào ⇒ đề từ ngày đặt quy tắc. */
function moiVoi(k: Khoan, q: QuyTacTuDong): boolean {
  return q.moc === null ? k.ngay >= q.tu : k.taoLuc > q.moc;
}

export interface PhanDenHan {
  huId: string;
  kieu: KieuTuDong;
  /** Đồng đến hạn lần này (0 nếu hũ đang tạm dừng). */
  soTien: number;
  /** `ngay`: số ngày được tính · `phan_tram`: `null`. */
  soNgay: number | null;
  /** `phan_tram`: tiền vào mới được tính · `ngay`: `null`. */
  tienVao: number | null;
}

export type KetQuaTuDong = 'khong' | 'khop' | 'thieu' | 'thua';

export interface DenHan {
  /** Mọi quy tắc của hũ đang chạy / tạm dừng — kể cả phần 0 đồng (mốc của chúng vẫn phải tiến). */
  phan: PhanDenHan[];
  tong: number;
  /** Ví lúc này (`tienConLai`). */
  conLai: number;
  /** Tiền vào mới với ít nhất một quy tắc của hũ đang chạy. */
  tienVaoMoi: number;
  /** Phần tiền vào mới mà quy tắc % không chia (≥ 1.000 ⇒ THỪA — dưới nghìn là phần làm tròn, không hỏi). */
  thua: number;
  /** Ví thiếu bao nhiêu cho `tong` (> 0 ⇒ THIẾU). */
  thieu: number;
  ketQua: KetQuaTuDong;
}

const NGHIN = 1000;
const xuongNghin = (n: number): number => n - (n % NGHIN);

/** Phần đến hạn của mọi quy tắc + xếp loại khớp / thiếu / thừa (xem đầu tệp). */
export function denHan(hu: readonly Hu[], so: readonly Khoan[], homNay: string): DenHan {
  const conLai = tienConLai(so);
  const vao = so.filter(laTienVao);
  const coQuyTac = hu.filter(
    (h) => h.tuDong !== undefined && laTichLuy(h) && (h.trangThai === 'dang_chay' || h.trangThai === 'tam_dung'),
  );
  const phan: PhanDenHan[] = coQuyTac.map((h) => {
    const q = h.tuDong!;
    const chay = h.trangThai === 'dang_chay';
    if (q.kieu === 'ngay') {
      const tuNgay = q.chayToi === null ? q.tu : congNgay(q.chayToi, 1);
      const soNgay = Math.max(0, soNgayGiua(tuNgay, homNay) + 1);
      return { huId: h.id, kieu: q.kieu, soTien: chay ? q.gt * soNgay : 0, soNgay, tienVao: null };
    }
    const tienVao = vao.reduce((a, k) => (moiVoi(k, q) ? a + k.soTien : a), 0);
    const soTien = chay ? xuongNghin(Number((BigInt(tienVao) * BigInt(q.gt)) / 100n)) : 0;
    return { huId: h.id, kieu: q.kieu, soTien, soNgay: null, tienVao };
  });
  const tong = phan.reduce((a, p) => a + p.soTien, 0);

  const dangChay = coQuyTac.filter((h) => h.trangThai === 'dang_chay');
  const tienVaoMoi = vao.reduce((a, k) => (dangChay.some((h) => moiVoi(k, h.tuDong!)) ? a + k.soTien : a), 0);
  /* Phần % chia CHÍNH XÁC (chưa làm tròn), tính bằng phần trăm đồng — để phần lẻ do làm tròn không bị đọc thành "thừa". */
  let daChiaX100 = 0n;
  for (const h of dangChay) {
    const q = h.tuDong!;
    if (q.kieu !== 'phan_tram') continue;
    const p = phan.find((x) => x.huId === h.id)!;
    daChiaX100 += BigInt(p.tienVao ?? 0) * BigInt(q.gt);
  }
  const conX100 = BigInt(tienVaoMoi) * 100n - daChiaX100;
  const thua = conX100 > 0n ? Number(conX100 / 100n) : 0;
  const thieu = Math.max(0, tong - conLai);
  const ketQua: KetQuaTuDong = thieu > 0 ? 'thieu' : thua >= NGHIN ? 'thua' : tong > 0 ? 'khop' : 'khong';
  return { phan, tong, conLai, tienVaoMoi, thua, thieu, ketQua };
}

/**
 * Phần của từng quy tắc khi CHIA THEO TỈ LỆ ví đang có (THIẾU): phần × ví ÷ tổng, làm tròn xuống nghìn — tổng không
 * bao giờ vượt ví. Ví đủ ⇒ đúng các phần đến hạn. MỘT chỗ cho cả nút "CHIA … THEO TỈ LỆ" lẫn cú chia thật.
 */
export function phanTiLe(d: DenHan): number[] {
  if (d.tong <= d.conLai) return d.phan.map((p) => p.soTien);
  return d.phan.map((p) => xuongNghin(Number((BigInt(p.soTien) * BigInt(d.conLai)) / BigInt(d.tong))));
}

/** `du` = chia đủ (khớp, hoặc người dùng chọn chia theo quy tắc khi thừa) · `ti_le` = thiếu, chia theo tỉ lệ ví · `bo_qua`. */
export type CachChay = 'du' | 'ti_le' | 'bo_qua';

export interface KetQuaChay {
  /** Khoản phân bổ vừa tạo — rỗng khi bỏ qua hoặc chẳng gì đến hạn. */
  khoan: Khoan[];
  /** Hũ có quy tắc, mốc đã tiến tới hôm nay (kể cả khi bỏ qua: bỏ qua là QUYẾT ĐỊNH, không hỏi lại). */
  hu: Hu[];
  denHan: DenHan;
}

/**
 * Chạy quy tắc một lần. ⚠ `du` khi ví THIẾU là lỗi của nơi gọi — thiếu phải hỏi người dùng, không được chia đủ bằng
 * tiền không có (ví âm = khoản phân bổ bịa ra tiền).
 */
export function chayQuyTac(
  hu: readonly Hu[], so: readonly Khoan[], homNay: string, luc: string, cach: CachChay, sinhId: () => string,
): KetQuaChay {
  const d = denHan(hu, so, homNay);
  if (cach === 'du' && d.thieu > 0) throw new LoiTuDong('Ví không đủ cho quy tắc: phải hỏi người dùng (THIẾU).');
  const khoan: Khoan[] = [];
  if (cach !== 'bo_qua') {
    const soTien = cach === 'ti_le' ? phanTiLe(d) : d.phan.map((p) => p.soTien);
    d.phan.forEach((p, i) => {
      if (soTien[i]! > 0) {
        khoan.push(taoKhoanPhanBo({ ngay: homNay, soTien: soTien[i]!, huId: p.huId, phanBo: 'tu_dong' }, luc, sinhId()));
      }
    });
  }
  const coPhan = new Set(d.phan.map((p) => p.huId));
  const huMoi = hu
    .filter((h) => coPhan.has(h.id))
    .map((h) => ({ ...h, tuDong: { ...h.tuDong!, chayToi: homNay, moc: luc } }));
  return { khoan, hu: huMoi, denHan: d };
}
