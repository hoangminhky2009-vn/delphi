/**
 * PFM — **SỬA MỘT BẢN GHI HŨ/LUẬT BẰNG PHÉP SỬA**, đọc bản ĐANG NẰM TRONG KHO, xếp hàng theo từng kho.
 *
 * Khuôn `ho_so.ts` §`suaHoSo` (D360) mở rộng sang hai ngăn `hu` · `luat`.
 *
 * ⚠⚠ VÌ SAO CÓ TỆP NÀY (tệp 15 lát 1). Lời đoán tạo ra những cú ghi NỐI TIẾP lên CÙNG một bản ghi: thẻ NHÌN
 * LẠI ghi nấc/"có tác dụng không" rồi ghi nhãn VÌ SAO; màn HŨ ghi mức rồi ghi lời đoán. Màn cầm bản ghi từ state
 * React — bản chụp TRƯỚC cú ghi thứ nhất — nên cú thứ hai dựng từ bản chụp ấy ghi ĐÈ mất cú thứ nhất, im lặng.
 * Bài `pfm_loi_doan_man.test.tsx` §II bắt đúng ca đó (câu "có tác dụng không" biến mất sau khi bấm VÌ SAO) —
 * nguyên văn họ lỗi "ghi đè từ state của màn" mà D358/D360 đã đóng cho hồ sơ.
 * ⚠ ĐỌC LẠI MỘT MÌNH KHÔNG ĐỦ — xếp hàng theo TỪNG KHO: lượt sau chỉ bắt đầu ĐỌC khi lượt trước đã GHI xong
 *   (lý lẽ đầy đủ ở `suaHoSo`). Lượt hỏng trả lỗi cho đúng người gọi của nó, không kéo sập hàng đợi.
 * ⚠ Bản ghi không còn (đã xoá giữa chừng) ⇒ `null`, không ghi gì — không dựng lại một bản ghi từ state cũ.
 *
 * D420 — cùng hàng đợi cho hai việc của màn HŨ đọc VÍ rồi mới ghi: NẠP một tờ (`napKhoanKho`) và CHẠY QUY TẮC TỰ CHIA
 * (`chayTuDongKho`). Cả hai phải thấy ví sau MỌI cú ghi trước nó, không phải ví trong state của màn.
 */
import type { KhoPfm } from './kho.js';
import { ganKhoan, type HuCon } from './hu_con.js';
import { laTichLuy, laTieuDung, type Hu } from './hu.js';
import { daTieuTrongThang, khoanRaBanGhi, laGanChi, soGan, tongGopVaoHu, type Khoan } from './so.js';
import { chiChuaChia, laRutHu, tienConLai } from './phan_bo.js';
import { chayQuyTac, denHan, type CachChay, type KetQuaChay } from './tu_dong.js';

const hangDoi = new WeakMap<KhoPfm, Promise<unknown>>();

/** Xếp `viec` sau mọi lượt trước trên CÙNG kho. Lượt hỏng trả lỗi cho người gọi của nó, hàng đợi đi tiếp. */
function xepHang<T>(kho: KhoPfm, viec: () => Promise<T>): Promise<T> {
  const truoc = hangDoi.get(kho) ?? Promise.resolve();
  const luot = truoc.then(viec);
  hangDoi.set(kho, luot.catch(() => undefined));
  return luot;
}

/**
 * @param f Nhận bản vừa đọc từ kho, trả bản sẽ ghi — hoặc `null` nếu không có gì để sửa (không ghi).
 * @param thang Lát tháng của bản ghi trong kho (tháng ĐANG SỐNG — nếp mọi cú ghi `hu`/`luat` ở các màn).
 * @returns Bản đã ghi, hoặc `null`.
 */
export function suaBanGhi<T>(
  kho: KhoPfm, ngan: 'hu' | 'luat', id: string, f: (cu: T) => T | null, luc: string, thang: string,
): Promise<T | null> {
  return xepHang(kho, async () => {
    const b = await kho.doc<T>(ngan, id);
    if (b === null) return null;
    const moi = f(b.d);
    if (moi !== null) await kho.ghi(ngan, { id, thang, suaLuc: luc, d: moi });
    return moi;
  });
}

/**
 * D420 — NẠP một khoản phân bổ (người dùng chạm tờ / gõ số ở khay màn HŨ); D421 — hoặc RÚT (khoản `thu`, hũ → ví).
 * Đọc ví / hũ TRONG KHO rồi mới ghi: hai cú chạm nhanh hơn lượt vẽ, hay một cú chạm trùng lúc quy tắc tự chia, không bao
 * giờ nạp quá ví đang có, cũng không rút quá hũ đang có (tính theo mốc RESET của hũ — `tongGopVaoHu`).
 * @returns Khoản đã ghi + VÍ SAU cú ghi (đọc từ kho — màn dùng nó để biết vừa chia HẾT, không đoán từ state có thể cũ
 *   khi chạm nhanh), hoặc `null` nếu không đủ (không ghi gì).
 */
export function napKhoanKho(kho: KhoPfm, k: Khoan): Promise<{ khoan: Khoan; conLai: number } | null> {
  return xepHang(kho, async () => {
    if (laGanChi(k)) return null;   // D424 — khoản gán đi đường `ganKhoanKho`, không phải tiền chuyển
    const so = (await kho.liet<Khoan>('khoan')).map((b) => b.d);
    const vi = tienConLai(so);
    const rut = laRutHu(k);
    if (!rut) {
      if (vi < k.soTien) return null;
    } else {
      const h = k.huId === null ? null : await kho.doc<Hu>('hu', k.huId);
      if (h === null || tongGopVaoHu(so, h.d.id, h.d.mocGop) < k.soTien) return null;
    }
    // D421 — tiền chỉ chuyển giữa ví và hũ TÍCH LŨY; hũ tiêu dùng không giữ tiền (nó nhận phiếu chi — `thaPhieuKho`).
    const dich = k.huId === null ? null : await kho.doc<Hu>('hu', k.huId);
    if (dich === null || !laTichLuy(dich.d)) return null;
    await kho.ghi('khoan', khoanRaBanGhi(k));
    return { khoan: k, conLai: rut ? vi + k.soTien : vi - k.soTien };
  });
}

/**
 * D420 — CHẠY QUY TẮC TỰ CHIA (`tu_dong.ts`) trên bản TRONG KHO.
 * `hoi` = lúc mở màn HŨ: chỉ chia khi KHỚP, còn lại trả `denHan` để màn HỎI · `du` · `ti_le` · `bo_qua` = câu trả lời.
 * ⚠⚠ MỐC TIẾN TRƯỚC, KHOẢN GHI SAU. Hai ngăn không chung một transaction; hỏng giữa hai cú ghi thì thứ mất là MỘT lượt
 *   chia (mốc đã tiến, khoản chưa có) — làm ngược lại thì lần mở sau chia HAI lần. Mất một lượt người dùng thấy và bù tay
 *   được; chia hai lần là app tự lấy tiền của họ.
 * ⚠ Lượt thứ hai (màn gắn lại, hai cú bấm) đọc thấy mốc đã tiến ⇒ không còn gì đến hạn ⇒ không ghi gì.
 * @param thang Lát tháng cho bản ghi hũ (tháng đang sống).
 */
/**
 * D424 — GÁN chi tiêu vào hũ tiêu dùng (khoản `phanBo: 'gan'`, xem `laGanChi`): CHIA VÀO (`chi`) không quá tiền chi CHƯA
 * CHIA của tháng ấy · GỠ RA (`thu`) không quá số hũ đã tiêu tháng ấy. Chỉ hũ tiêu dùng ĐANG CHẠY. Đọc TRONG KHO rồi mới ghi
 * (xếp hàng) — chạm nhanh hơn lượt vẽ không bao giờ chia quá phần chưa chia.
 * @returns Khoản đã ghi + tiền chi CHƯA CHIA sau cú ghi (màn dùng nó để biết vừa chia hết), hoặc `null`.
 */
export function ganKhoanKho(kho: KhoPfm, k: Khoan): Promise<{ khoan: Khoan; chiCon: number } | null> {
  return xepHang(kho, async () => {
    if (!laGanChi(k) || k.huId === null) return null;
    const h = await kho.doc<Hu>('hu', k.huId);
    if (h === null || !laTieuDung(h.d) || h.d.trangThai !== 'dang_chay') return null;
    const so = (await kho.liet<Khoan>('khoan')).map((b) => b.d);
    const thang = k.ngay.slice(0, 7);
    const con = chiChuaChia(so, thang);
    const chia = soGan(k) > 0;
    if (chia ? con < k.soTien : daTieuTrongThang(so, k.huId, thang) < k.soTien) return null;
    await kho.ghi('khoan', khoanRaBanGhi(k));
    return { khoan: k, chiCon: chia ? con - k.soTien : con + k.soTien };
  });
}

export function chayTuDongKho(
  kho: KhoPfm, homNay: string, luc: string, cach: 'hoi' | CachChay, sinhId: () => string, thang: string,
): Promise<KetQuaChay> {
  return xepHang(kho, async () => {
    const hu = (await kho.liet<Hu>('hu')).map((b) => b.d);
    const so = (await kho.liet<Khoan>('khoan')).map((b) => b.d);
    const d = denHan(hu, so, homNay);
    if (d.phan.length === 0 || (cach === 'hoi' && d.ketQua !== 'khop')) return { khoan: [], hu: [], denHan: d };
    const kq = chayQuyTac(hu, so, homNay, luc, cach === 'hoi' ? 'du' : cach, sinhId);
    for (const h of kq.hu) await kho.ghi('hu', { id: h.id, thang, suaLuc: luc, d: h });
    if (kq.khoan.length > 0) await kho.ghiLo('khoan', kq.khoan.map(khoanRaBanGhi));
    return kq;
  });
}

/**
 * HŨ CON (PFM tầng không gian, CHỈ Ở MÁY) — NẠP / CHIA một khoản vào hũ CHA rồi GÁN nó cho hũ con, trong CÙNG hàng đợi.
 * Khoản đi đúng đường cũ (`napKhoanKho` cho cha tích lũy · `ganKhoanKho` cho cha tiêu dùng) nên mọi kiểm tra ví / phần chưa chia /
 * mốc RESET vẫn là của đường cũ; chỉ khi khoản ĐÃ vào sổ mới ghi `khoanIds` của hũ con. Đường cũ trả `null` (không đủ) ⇒ hũ con
 * không đổi. Hũ con không còn / không thuộc cha ⇒ KHÔNG ghi khoản nào (kiểm TRƯỚC khi chạm sổ).
 * @returns `true` nếu đã ghi khoản và đã gán.
 */
export function napVaoConKho(kho: KhoPfm, con: HuCon, k: Khoan, tichLuy: boolean, luc: string, thang: string): Promise<boolean> {
  return (async () => {
    const hien = await kho.doc<HuCon>('hu_con', con.id);
    if (hien === null || hien.d.chaId !== k.huId) return false;
    const kq = tichLuy ? await napKhoanKho(kho, k) : await ganKhoanKho(kho, k);
    if (kq === null) return false;
    await xepHang(kho, async () => {
      const b = await kho.doc<HuCon>('hu_con', con.id);
      if (b === null) return;
      await kho.ghi('hu_con', { id: con.id, thang, suaLuc: luc, d: ganKhoan(b.d, k.id) });
    });
    return true;
  })();
}

/** Ghi (tạo / sửa) một hũ con — xếp hàng cùng kho, kiểm hũ cha còn nằm ở ngăn `hu` (một tầng). */
export function ghiHuConKho(kho: KhoPfm, con: HuCon, luc: string, thang: string): Promise<boolean> {
  return xepHang(kho, async () => {
    const cha = await kho.doc<Hu>('hu', con.chaId);
    if (cha === null) return false;
    await kho.ghi('hu_con', { id: con.id, thang, suaLuc: luc, d: con });
    return true;
  });
}
