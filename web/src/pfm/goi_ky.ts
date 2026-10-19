/**
 * PFM — XẾP GÓI ĐẶC TRƯNG THEO KỲ VÀO HÀNG ĐỢI (D325). Người gọi ĐẦU TIÊN của `dongGoiKy`.
 *
 * ⚠⚠ VÌ SAO TỆP NÀY TỒN TẠI: tới 13/09 `dongGoiKy` (dac_trung.ts) có đủ luật, đủ bài test,
 * server có cửa nhận (`POST /pfm/dong-bo`, D251), driver gửi lô chạy thật (D259/D264) — và
 * **không một dòng nào trong app gọi `dongGoiKy`**. Hàng đợi chỉ từng nhận "nhịp" (sự kiện
 * luật). Tức toàn bộ dữ liệu nghiên cứu theo tháng của sổ — ngữ cảnh tự khai, ý định từng hũ,
 * hành vi, kết quả — chưa bao giờ rời máy, dù cửa `dac_trung` bật. Đúng họ lỗi "luật rỗng"
 * (D291): có hằng số, có tài liệu, có test xanh, không đường chạy nào đọc.
 * Và nó chặn luôn D324: đường ghép tín hiệu game bám vào "gói kỳ đã ghi", nên không gói nào
 * thì không ghép gì.
 *
 * ─── HAI KỲ MỖI LƯỢT ─────────────────────────────────────────────────────────
 * Kỳ ĐANG SỐNG luôn xếp (gói đè theo kỳ — `khoaMon` — nên xếp lại mỗi lượt kích là ghi đè
 * ảnh chụp mới nhất, không phình hàng đợi). Kỳ TRƯỚC cũng xếp lại, vì server còn nhận nó
 * (`cuaSoKy`: tháng sống hoặc liền trước) và những ngày cuối tháng chỉ vào được gói nếu gói
 * được dựng lại sau khi tháng khép; kỳ trước TRỐNG (không khoản, không hũ) thì bỏ — gửi gói
 * rỗng cho một tháng chưa dùng app là bịa ra một kỳ quan sát.
 *
 * ─── ⚠⚠ KỲ CŨ PHẢI ĐƯỢC DỰNG LẠI, KHÔNG CHỤP HÔM NAY ─────────────────────────
 * Dựng lại gói tháng 8 vào ngày 20/09 bằng HŨ HÔM NAY là dán chuyện tháng 9 vào tháng 8: hũ
 * bỏ ngày 15/09 hiện `kq_bo_giua_chung = bo` trong gói tháng 8, lần tạm dừng tháng 9 được đếm
 * vào tháng 8 — và khi tháng 9 hết, gói tháng 8 ĐÓNG BĂNG với đúng những dòng sai ấy (server
 * thôi nhận kỳ đó). `GoiDacTrung` tự hứa *"Đặc trưng luôn thuộc về MỘT kỳ, không bao giờ 'tới
 * nay'"* — nên mọi hũ/luật đi vào gói qua hai phép dựng lại ở dưới (`huTrongKy` · `luatTrongKy`).
 * Kỳ đang sống cũng đi qua cùng phép ấy: một phép, hai kỳ, không có nhánh "kỳ này thì khỏi".
 *
 * ⚠ Mốc kỳ so theo UTC (`taoLuc`/`luc` là `toISOString()`), trong khi khoản xếp theo NGÀY MÁY
 * (`k.ngay`). Lệch ≤ 7 giờ ở biên tháng (VN) — chấp nhận, cùng lý lẽ `server/pfm/tin_hieu_ky.ts`.
 */
import type { KhoPfm } from './kho.js';
import { dongGoiKy } from './dac_trung.js';
import { xepHang } from './dong_bo.js';
import { docHoSo } from './ho_so.js';
import { locKhoanSo, type Khoan } from './so.js';
import { TRANG_THAI_SAU_DAU, laTichLuy, type Hu, type TrangThaiHu } from './hu.js';
import type { Luat } from './luat.js';
import { thangSauCua, thangTruocCua } from './thoi_gian.js';

/* ═══ MỐC KỲ ════════════════════════════════════════════════════════════════ */

/** Mốc mở kỳ và mốc mở kỳ SAU, dạng ISO UTC — so chuỗi được vì `bayGio()` ra đúng một định dạng. */
export function mocKy(ky: string): { dau: string; sau: string } {
  return { dau: `${ky}-01T00:00:00.000Z`, sau: `${thangSauCua(ky)}-01T00:00:00.000Z` };
}

/** Trạng thái của hũ ngay TRƯỚC một mốc — phát lại `lichSu` theo thứ tự thời gian. */
export function trangThaiTruoc(h: Hu, moc: string): TrangThaiHu {
  let t: TrangThaiHu = 'dang_chay';
  // ⚠ Sắp lại theo `luc`: `lichSu` ghi thêm theo thứ tự, nhưng một bản khôi phục từ két có thể
  // hoà hai máy — "dấu cuối cùng thắng" phải là cuối cùng theo GIỜ, không theo vị trí mảng.
  for (const d of [...h.lichSu].sort((a, b) => a.luc.localeCompare(b.luc))) {
    if (d.luc >= moc) break;
    const s = TRANG_THAI_SAU_DAU[d.ma];
    if (s !== undefined) t = s;
  }
  return t;
}

/* ═══ DỰNG LẠI TẠI KỲ ════════════════════════════════════════════════════════ */

/**
 * Hũ có thuộc kỳ không: tạo trước khi kỳ khép, VÀ (còn mở lúc kỳ bắt đầu HOẶC có dấu nào
 * trong kỳ). Hũ đã xong/bỏ từ tháng 6 mà không ai đụng lại thì KHÔNG vào gói tháng 9 — phát
 * lại `kq_bo_giua_chung = xong` của nó mỗi tháng là đếm một kết cục nhiều lần.
 */
export function huThuocKy(h: Hu, ky: string): boolean {
  const { dau, sau } = mocKy(ky);
  if (h.taoLuc >= sau) return false;
  if (h.lichSu.some((d) => d.luc >= dau && d.luc < sau)) return true;
  const t = trangThaiTruoc(h, dau);
  return t === 'dang_chay' || t === 'tam_dung';
}

/**
 * Hũ TẠI KỲ: trạng thái lúc kỳ khép · lịch sử TRONG kỳ · nấc quyết toán chỉ khi lần chốt
 * cuối cùng rơi vào kỳ. Nhãn ý định (`loai`/`han`/…) giữ bản hôm nay — hũ không lưu lịch sử
 * nhãn, và nhãn là thứ người dùng sửa cho ĐÚNG hơn, không phải một sự kiện của tháng.
 */
export function huTrongKy(h: Hu, ky: string): Hu {
  const { dau, sau } = mocKy(ky);
  const chot = h.lichSu
    .filter((d) => d.ma === 'xong' || d.ma === 'bo_do')
    .sort((a, b) => a.luc.localeCompare(b.luc))
    .at(-1);
  const chotTrongKy = chot !== undefined && chot.luc >= dau && chot.luc < sau;
  return {
    ...h,
    trangThai: trangThaiTruoc(h, sau),
    ketQua: chotTrongKy ? h.ketQua : null,
    lichSu: h.lichSu.filter((d) => d.luc >= dau && d.luc < sau),
  };
}

/** Luật thuộc kỳ: tạo trước khi kỳ khép và chưa xoá trước khi kỳ mở. */
export function luatThuocKy(l: Luat, ky: string): boolean {
  const { dau, sau } = mocKy(ky);
  return l.taoLuc < sau && !l.lichSu.some((d) => d.ma === 'xoa' && d.luc < dau);
}

/** Luật TẠI KỲ: chỉ nhịp trong kỳ — `kq_giu_luat` là tỷ lệ CỦA KỲ, không phải từ trước tới nay. */
export function luatTrongKy(l: Luat, ky: string): Luat {
  const { dau, sau } = mocKy(ky);
  return { ...l, lichSu: l.lichSu.filter((d) => d.luc >= dau && d.luc < sau) };
}

/* ═══ XẾP ════════════════════════════════════════════════════════════════════ */

/** Xếp gói của kỳ trước (nếu có gì) và kỳ đang sống. Trả các kỳ đã xếp. */
export async function xepGoiKy(kho: KhoPfm, thangSong: string, luc: string): Promise<string[]> {
  const tat = locKhoanSo((await kho.liet<Khoan>('khoan')).map((b) => b.d));
  const hu = (await kho.liet<Hu>('hu')).map((b) => b.d);
  const luat = (await kho.liet<Luat>('luat')).map((b) => b.d);
  const hoSo = await docHoSo(kho);
  const ra: string[] = [];
  for (const ky of [thangTruocCua(thangSong), thangSong]) {
    const so = tat.filter((k) => k.ngay.startsWith(ky));
    /*
     * ⚠⚠ D421 — CHỈ HŨ TÍCH LŨY vào gói. Đặc trưng hũ (`kq_dat_muc_tieu` · `kq_bo_giua_chung` · `hv_tam_dung_hu` · nhãn
     *   ý định) nói về hũ GOM TỚI MỨC; một hũ ăn uống lọt vào là một "mục tiêu" không ai đặt, đếm vào mẫu số mãi mãi
     *   (A11.1 — gói đã gửi không gỡ lại được). Hũ tiêu dùng ở lại máy trọn vẹn (P2).
     */
    const huKy = hu.filter((h) => laTichLuy(h) && huThuocKy(h, ky)).map((h) => huTrongKy(h, ky));
    const luatKy = luat.filter((l) => luatThuocKy(l, ky)).map((l) => luatTrongKy(l, ky));
    if (ky !== thangSong && so.length === 0 && huKy.length === 0) continue;
    const truoc = thangTruocCua(ky);
    const goi = dongGoiKy({
      ky, so, soKyTruoc: tat.filter((k) => k.ngay.startsWith(truoc)), hu: huKy, luat: luatKy, hoSo,
    });
    await xepHang(kho, { loai: 'goi', ky, goi }, luc, ky, ky);
    ra.push(ky);
  }
  return ra;
}
