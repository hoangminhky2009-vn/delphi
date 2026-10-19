/**
 * PFM — LỜI ĐOÁN CỦA NGƯỜI DÙNG VỀ MỘT VỊ THẾ (tệp 15 lát 1) — VECTOR CHÉP TAY.
 *
 * Xếp theo ĐỘ ĐẮT KHI HỎNG:
 *   §I   KHOÁ LÚC ĐẶT (R2/R3) — đổi mức/reset/tắt luật khi lời đoán còn mở ⇒ khép, không xét.
 *        Hỏng ở đây là người dùng sửa câu đoán sau khi thấy đáp án — bẫy D385, phía người dùng.
 *   §II  XÉT BẰNG CÂU KHAI SỰ VIỆC (R1) — hũ theo nấc tháng hạn, luật theo chạm giữ/vỡ.
 *   §III "HOÀN CẢNH ĐỔI" LÀ NHÃN, KHÔNG PHẢI CỬA LOẠI MẪU (R4).
 *   §IV  ĐẶT — cần mức, một lời đoán sống một lúc, hạn tối thiểu, nhãn hạn suy từ ngày.
 *   §V   NGÀY THÁNG.
 *
 * Mốc dùng trong tệp (đã kiểm): 2026-09-25 thứ Sáu · luật đặt 25/09 ⇒ kỳ 2026-10.
 * Mọi `luc` đặt giữa trưa UTC — xa biên ngày ở mọi múi giờ, không phụ thuộc TZ máy chạy test.
 */
import { describe, expect, it } from 'vitest';
import {
  ghiKetQuaKy, ghiLyDoHu, moLoiDoan, quyetToan, resetGop, sua, tuMau, tuTao, doiTrangThai, LoiHu,
  type Hu,
} from '../src/pfm/hu.js';
import { MAU_HU } from '../src/pfm/hu_mau.js';
import {
  banLuat, datBat, ghiLyDoLuat, ghiNhanGiuVo, moLoiDoanLuat, taoLuatMoi, LoiLuat, type Luat,
} from '../src/pfm/luat.js';
import {
  demLuatTrongKy, hanHopLe, hanTuSoThang, loiDoanHuHienHanh, nhanHanTuNgay, tongLoiDoan, tronLuat,
  trangThaiLoiDoanHu, trangThaiLoiDoanLuat,
} from '../src/pfm/vi_the.js';

const LUC = '2026-09-25T05:00:00.000Z';
const HOM_NAY = '2026-09-25';
const coMuc = (muc = 6_000_000): Hu => tuTao({ ten: 'Laptop', muc }, LUC, 'h1');
/** Hũ có lời đoán "tới 25/03/2027, chắc vừa". */
const coLoiDoan = (): Hu => moLoiDoan(coMuc(), { han: '2027-03-25', chac: 'vua' }, LUC, HOM_NAY);
const luatMoi = (): Luat => taoLuatMoi({ loiNhac: 'Ngày chi lớn thì mai đợi.', dieuKien: 'ngay_chi_lon' }, LUC, 'l1');

/* ══════════════════════════════════════════════════════════════════════════════ */

describe('§I — ⭐⭐⭐ KHOÁ LÚC ĐẶT: đổi điều kiện khi còn mở ⇒ khép giữa chừng, KHÔNG xét', () => {
  it('⭐⭐⭐ đổi MỨC ⇒ lời đoán khép `doi_giua_chung`', () => {
    const h = sua(coLoiDoan(), { muc: 8_000_000 }, '2026-12-01T05:00:00.000Z');
    expect(h.loiDoan?.[0]?.khep).toEqual({ luc: '2026-12-01T05:00:00.000Z', ly: 'doi_giua_chung' });
    expect(trangThaiLoiDoanHu(h, h.loiDoan![0]!, '2027-04')).toBe('doi_giua_chung');
  });

  it('⭐ BỎ mức (gia hạn ở màn SỔ — `sua({muc:null})`) cũng là đổi điều kiện', () => {
    const h = sua(coLoiDoan(), { muc: null }, '2026-12-01T05:00:00.000Z');
    expect(h.loiDoan?.[0]?.khep?.ly).toBe('doi_giua_chung');
  });

  it('⭐ RESET (về 0 bằng dời mốc) cũng là đổi điều kiện', () => {
    expect(resetGop(coLoiDoan(), '2026-12-01T05:00:00.000Z').loiDoan?.[0]?.khep?.ly).toBe('doi_giua_chung');
  });

  it('đổi TÊN / nhãn loại / ghi chú KHÔNG khép — câu đã đặt vẫn nguyên nghĩa', () => {
    const h = sua(coLoiDoan(), { ten: 'Máy tính', loai: 'thiet_bi', ghiChu: 'x' }, '2026-12-01T05:00:00.000Z');
    expect(h.loiDoan?.[0]?.khep).toBeUndefined();
  });

  it('⭐⭐ lời đoán ĐÃ TỚI HẠN (chờ nấc) thì đổi mức hôm nay KHÔNG chạm tới nó', () => {
    // Hạn tháng 3, hôm nay 02/04 ⇒ `cho_hoi`. Người dùng nâng mức rồi mới trả lời thẻ tháng 3.
    let h = sua(coLoiDoan(), { muc: 9_000_000 }, '2027-04-02T05:00:00.000Z');
    expect(h.loiDoan?.[0]?.khep).toBeUndefined();
    h = ghiKetQuaKy(h, '2027-03', 'du');
    expect(trangThaiLoiDoanHu(h, h.loiDoan![0]!, '2027-04')).toBe('toi');
  });

  it('⭐⭐ TẮT luật khi lời đoán còn mở ⇒ khép (luật tắt thì "giữ trọn" thành tầm thường)', () => {
    const l = datBat(moLoiDoanLuat(luatMoi(), 'cao', LUC), false, '2026-10-10T05:00:00.000Z');
    expect(l.loiDoan?.[0]?.doiGiuaChung).toBe('2026-10-10T05:00:00.000Z');
    expect(trangThaiLoiDoanLuat(l, l.loiDoan![0]!, '2026-11')).toBe('doi_giua_chung');
  });

  it('datBat không kèm mốc (chỗ gọi cũ) giữ đúng hành vi cũ; BẬT không khép gì', () => {
    const l = moLoiDoanLuat(luatMoi(), 'cao', LUC);
    expect(datBat(l, false).loiDoan?.[0]?.doiGiuaChung).toBeUndefined();
    expect(datBat(l, true, '2026-10-10T05:00:00.000Z').loiDoan?.[0]?.doiGiuaChung).toBeUndefined();
  });
});

describe('§II — ⭐⭐ XÉT BẰNG CÂU KHAI SỰ VIỆC', () => {
  it('hũ: xét ở THÁNG HẠN bằng nấc thẻ CUỐI KỲ tháng ấy — chỉ `du` là tới', () => {
    const h = coLoiDoan();
    const ld = h.loiDoan![0]!;
    expect(trangThaiLoiDoanHu(h, ld, '2027-03')).toBe('mo');          // tháng hạn chưa khép
    expect(trangThaiLoiDoanHu(h, ld, '2027-04')).toBe('cho_hoi');      // vừa khép, chưa có nấc
    expect(trangThaiLoiDoanHu(ghiKetQuaKy(h, '2027-03', 'du'), ld, '2027-04')).toBe('toi');
    expect(trangThaiLoiDoanHu(ghiKetQuaKy(h, '2027-03', 'gan_du'), ld, '2027-04')).toBe('khong_toi');
    expect(trangThaiLoiDoanHu(h, ld, '2027-05')).toBe('bo_trong');     // quá một tháng, không bịa
  });

  it('⭐ nấc của THÁNG KHÁC không xét lời đoán này (nấc tháng 2 "đủ" không phải "tới 25/03 đủ")', () => {
    const h = ghiKetQuaKy(coLoiDoan(), '2027-02', 'du');
    expect(trangThaiLoiDoanHu(h, h.loiDoan![0]!, '2027-04')).toBe('cho_hoi');
  });

  it('⭐⭐ quyết toán SỚM khép bằng chính nấc chốt — và CẤT kết quả: mở lại rồi chốt lần nữa không đổi nó', () => {
    let h = quyetToan(coLoiDoan(), 'bo_do', 'xa', '2026-12-01T05:00:00.000Z');
    expect(h.loiDoan?.[0]?.khep).toEqual({ luc: '2026-12-01T05:00:00.000Z', ly: 'quyet_toan', kq: 'khong_toi' });
    h = doiTrangThai(h, 'dang_chay', '2027-01-05T05:00:00.000Z');
    h = quyetToan(h, 'xong', 'du', '2027-02-01T05:00:00.000Z');
    expect(h.ketQua).toBe('du');
    expect(trangThaiLoiDoanHu(h, h.loiDoan![0]!, '2027-04')).toBe('khong_toi');
  });

  it('quyết toán `xong` + `du` ⇒ tới; kèm nhãn vì sao nếu người dùng chọn', () => {
    const h = quyetToan(coLoiDoan(), 'xong', 'du', '2026-12-01T05:00:00.000Z', 'dung_nhu_nghi');
    expect(h.loiDoan?.[0]?.khep).toMatchObject({ ly: 'quyet_toan', kq: 'toi' });
    expect(h.loiDoan?.[0]?.lyDo).toBe('dung_nhu_nghi');
  });

  it('⭐ luật: ghép chạm giữ/vỡ với LẦN BẮN nó trả lời (bắn 31/10, đánh dấu 01/11 ⇒ của tháng 10)', () => {
    let l = moLoiDoanLuat(luatMoi(), 'cao', LUC);
    l = ghiNhanGiuVo(banLuat(l, '2026-10-05T05:00:00.000Z'), 'giu', '2026-10-05T06:00:00.000Z');
    l = ghiNhanGiuVo(banLuat(l, '2026-10-31T20:00:00.000Z'), 'vo', '2026-11-01T05:00:00.000Z');
    expect(demLuatTrongKy(l, '2026-10')).toEqual({ ban: 2, giu: 1, vo: 1, cho: 0 });
    expect(demLuatTrongKy(l, '2026-11')).toEqual({ ban: 0, giu: 0, vo: 0, cho: 0 });
    expect(trangThaiLoiDoanLuat(l, l.loiDoan![0]!, '2026-11')).toBe('khong_toi');
  });

  it('luật: giữ trọn ⇒ tới · còn lần bắn chờ đánh dấu ⇒ chờ hỏi, rồi hết chờ ⇒ bỏ trống', () => {
    let l = moLoiDoanLuat(luatMoi(), 'vua', LUC);
    l = ghiNhanGiuVo(banLuat(l, '2026-10-05T05:00:00.000Z'), 'giu', '2026-10-05T06:00:00.000Z');
    expect(trangThaiLoiDoanLuat(l, l.loiDoan![0]!, '2026-11')).toBe('toi');
    const cho = banLuat(l, '2026-10-20T05:00:00.000Z');
    expect(trangThaiLoiDoanLuat(cho, cho.loiDoan![0]!, '2026-11')).toBe('cho_hoi');
    expect(trangThaiLoiDoanLuat(cho, cho.loiDoan![0]!, '2026-12')).toBe('bo_trong');
  });

  it('⭐ luật KHÔNG BẮN lần nào trong kỳ ⇒ bỏ trống (giữ trọn một luật không bắn là "tới" giả)', () => {
    const l = moLoiDoanLuat(luatMoi(), 'cao', LUC);
    expect(trangThaiLoiDoanLuat(l, l.loiDoan![0]!, '2026-11')).toBe('bo_trong');
    expect(tronLuat({ ban: 0, giu: 0, vo: 0, cho: 0 })).toBeNull();
    expect(tronLuat({ ban: 3, giu: 3, vo: 0, cho: 0 })).toBe(true);
    expect(tronLuat({ ban: 3, giu: 2, vo: 1, cho: 0 })).toBe(false);
    expect(tronLuat({ ban: 2, giu: 1, vo: 0, cho: 1 })).toBeNull();
  });
});

describe('§III — ⭐⭐ "HOÀN CẢNH ĐỔI" LÀ NHÃN, ĐẾM NHƯ MỌI LƯỢT XÉT', () => {
  it('⭐⭐ ví dụ §1 tệp 15: hũ 70 % không tới (hoàn cảnh đổi) + luật 90 % không tới', () => {
    let h = ghiKetQuaKy(coLoiDoan(), '2027-03', 'gan_du');
    h = ghiLyDoHu(h, h.loiDoan![0]!.datLuc, 'hoan_canh_doi');
    let l = moLoiDoanLuat(luatMoi(), 'cao', LUC);
    l = ghiNhanGiuVo(banLuat(l, '2026-10-05T05:00:00.000Z'), 'vo', '2026-10-05T06:00:00.000Z');
    l = ghiLyDoLuat(l, '2026-10', 'danh_gia_sai');
    const t = tongLoiDoan([h], [l], '2027-04');
    expect(t.theoChac).toEqual([
      { chac: 'thap', n: 0, toi: 0 }, { chac: 'vua', n: 1, toi: 0 }, { chac: 'cao', n: 1, toi: 0 },
    ]);
    expect(t.hoanCanhDoi).toBe(1);
  });

  it('khép giữa chừng và bỏ trống đếm RIÊNG, không vào mẫu; còn mở đếm là "sống"', () => {
    const doi = sua(coLoiDoan(), { muc: 1 }, '2026-12-01T05:00:00.000Z');
    const moi = { ...coLoiDoan(), id: 'h2' };
    const t = tongLoiDoan([doi, moi], [], '2027-01');
    expect(t.doiGiuaChung).toBe(1);
    expect(t.song).toBe(1);
    expect(t.theoChac.every((x) => x.n === 0)).toBe(true);
  });

  it('nhãn vì sao: chạm lại thì đè; lời đoán khép giữa chừng không nhận nhãn', () => {
    let h = ghiKetQuaKy(coLoiDoan(), '2027-03', 'du');
    h = ghiLyDoHu(h, h.loiDoan![0]!.datLuc, 'danh_gia_sai');
    h = ghiLyDoHu(h, h.loiDoan![0]!.datLuc, 'dung_nhu_nghi');
    expect(h.loiDoan?.[0]?.lyDo).toBe('dung_nhu_nghi');
    const doi = sua(coLoiDoan(), { muc: 1 }, '2026-12-01T05:00:00.000Z');
    expect(() => ghiLyDoHu(doi, doi.loiDoan![0]!.datLuc, 'hoan_canh_doi')).toThrow(LoiHu);
  });
});

describe('§IV — ĐẶT LỜI ĐOÁN', () => {
  it('⭐ cần MỨC: hũ chưa có mức ⇒ ném (không mức thì "đủ" không có nghĩa)', () => {
    const h = tuTao({ ten: 'Chưa mức' }, LUC, 'h0');
    expect(() => moLoiDoan(h, { han: '2027-03-25', chac: 'vua' }, LUC, HOM_NAY)).toThrow(LoiHu);
  });

  it('⭐ R3: hạn gần hơn tối thiểu ⇒ ném; đúng mốc tối thiểu ⇒ nhận', () => {
    expect(() => moLoiDoan(coMuc(), { han: '2026-10-08', chac: 'vua' }, LUC, HOM_NAY)).toThrow(LoiHu);
    expect(moLoiDoan(coMuc(), { han: '2026-10-09', chac: 'vua' }, LUC, HOM_NAY).loiDoan).toHaveLength(1);
    expect(hanHopLe(HOM_NAY, '2026-10-9')).toBe(false);
  });

  it('⭐ một lời đoán sống một lúc: còn mở ⇒ ném; đã xét xong ⇒ đặt được lời đoán mới', () => {
    const h = coLoiDoan();
    expect(() => moLoiDoan(h, { han: '2027-06-01', chac: 'cao' }, LUC, HOM_NAY)).toThrow(LoiHu);
    const daXet = ghiKetQuaKy(h, '2027-03', 'du');
    const lan2 = moLoiDoan(daXet, { han: '2027-06-01', chac: 'cao' }, '2027-04-05T05:00:00.000Z', '2027-04-05');
    expect(lan2.loiDoan).toHaveLength(2);
    expect(loiDoanHuHienHanh(lan2, '2027-04')?.han).toBe('2027-06-01');
  });

  it('chụp MỨC lúc đặt; câu vì sao gộp khoảng trắng, rỗng thì không cất', () => {
    const h = moLoiDoan(coMuc(), { han: '2027-03-25', chac: 'cao', viSao: '  góp   1 triệu/tháng  ' }, LUC, HOM_NAY);
    expect(h.loiDoan?.[0]).toMatchObject({ muc: 6_000_000, han: '2027-03-25', chac: 'cao', viSao: 'góp 1 triệu/tháng' });
    expect(moLoiDoan(coMuc(), { han: '2027-03-25', chac: 'cao', viSao: '   ' }, LUC, HOM_NAY).loiDoan?.[0]?.viSao)
      .toBeUndefined();
  });

  it('⭐ nhãn hạn `han` SUY TỪ NGÀY; đổi nhãn đã có thì ghi dấu `doi_han`, từ trống thì không', () => {
    const tuTaoHu = coLoiDoan();
    expect(tuTaoHu.han).toBe('vua');
    expect(tuTaoHu.lichSu.map((d) => d.ma)).toEqual(['tao']);
    const mau = MAU_HU.find((m) => m.han !== 'dai')!;
    const hMau = sua(tuMau(mau, LUC, 'hm'), { muc: 2_000_000 }, LUC);
    const dat = moLoiDoan(hMau, { han: '2027-09-25', chac: 'thap' }, LUC, HOM_NAY);
    expect(dat.han).toBe('dai');
    expect(dat.lichSu.at(-1)?.ma).toBe('doi_han');
  });

  it('luật: kỳ = tháng LIỀN SAU lúc đặt; luật tắt ⇒ ném; còn mở ⇒ ném', () => {
    const l = moLoiDoanLuat(luatMoi(), 'vua', LUC);
    expect(l.loiDoan?.[0]).toMatchObject({ ky: '2026-10', chac: 'vua' });
    expect(() => moLoiDoanLuat(l, 'cao', LUC)).toThrow(LoiLuat);
    expect(() => moLoiDoanLuat(datBat(luatMoi(), false), 'cao', LUC)).toThrow(LoiLuat);
  });
});

describe('§V — NGÀY THÁNG', () => {
  it('cộng tháng, kẹp cuối tháng, qua năm', () => {
    expect(hanTuSoThang('2026-09-25', 6)).toBe('2027-03-25');
    expect(hanTuSoThang('2026-09-25', 12)).toBe('2027-09-25');
    expect(hanTuSoThang('2027-01-31', 1)).toBe('2027-02-28');
    expect(hanTuSoThang('2028-01-31', 1)).toBe('2028-02-29');
  });

  it('nhãn hạn đếm THÁNG TRỌN: <3 ngắn · 3–6 vừa · >6 dài', () => {
    expect(nhanHanTuNgay(HOM_NAY, '2026-10-25')).toBe('ngan');
    expect(nhanHanTuNgay(HOM_NAY, '2026-12-24')).toBe('ngan');
    expect(nhanHanTuNgay(HOM_NAY, '2026-12-25')).toBe('vua');
    expect(nhanHanTuNgay(HOM_NAY, '2027-03-25')).toBe('vua');
    expect(nhanHanTuNgay(HOM_NAY, '2027-04-25')).toBe('dai');
  });
});

/* ══════════════════════════════════════════════════════════════════════════════
 * §VI — VỊ THẾ & DANH MỤC (bản 2): cỡ quy ra đơn vị của người dùng, tính lúc đọc từ sổ
 * Mốc: 25/09/2026 → 25/03/2027 = 181 ngày (đã kiểm).
 * ════════════════════════════════════════════════════════════════════════════ */

import { coViThe, danhMuc, dongTienThang, lenhCua } from '../src/pfm/vi_the.js';
import { taoKhoan } from '../src/pfm/so.js';

const LENH = { tu: '2026-09-25', kyHan: '2027-03-25' };
const thu = (ngay: string, soTien: number, id: string) => taoKhoan({ ngay, soTien, chieu: 'thu' }, LUC, id);
const chi = (ngay: string, soTien: number, id: string) => taoKhoan({ ngay, soTien }, LUC, id);
const viThe = (ten: string, muc: number, id: string, loai: 'thiet_bi' | 'du_phong' = 'thiet_bi', lenh = LENH): Hu =>
  tuTao({ ten, muc, loai, lenh }, LUC, id);

describe('§VI — ⭐⭐ VỊ THẾ: cỡ · nhịp · dòng tiền · danh mục', () => {
  it('⭐ dòng tiền = tiền VÀO của tháng trọn gần nhất; chưa có thì tháng này; không có ⇒ null (không bịa mẫu số)', () => {
    expect(dongTienThang([thu('2026-08-05', 3_000_000, 't1'), chi('2026-08-06', 50_000, 'c1')], '2026-09'))
      .toEqual({ thang: '2026-08', so: 3_000_000 });
    expect(dongTienThang([thu('2026-09-05', 2_500_000, 't2')], '2026-09')).toEqual({ thang: '2026-09', so: 2_500_000 });
    expect(dongTienThang([chi('2026-09-05', 99_000, 'c2')], '2026-09')).toBeNull();
  });

  it('⭐⭐ cỡ: 6 triệu trong 181 ngày ⇒ 33.000/ngày · 994.000/tháng · 33% của 3 triệu · còn 181 ngày', () => {
    const co = coViThe(viThe('Laptop', 6_000_000, 'h1'), 0, '2026-09-25', { thang: '2026-08', so: 3_000_000 })!;
    expect(co.moiNgay).toBe(33_000);
    expect(co.moiThang).toBe(994_000);
    expect(co.phan).toBeCloseTo(0.3315, 3);
    expect(co.conNgay).toBe(181);
    expect(co.nhipKy, 'ngày vào lệnh chưa có gì để so').toBeNull();
  });

  it('⭐ nhịp: 60 ngày sau mới góp 1,2 triệu ⇒ chậm ~0,8 kỳ; góp đúng kế hoạch ⇒ ~0', () => {
    const h = viThe('Laptop', 6_000_000, 'h1');
    expect(coViThe(h, 1_200_000, '2026-11-24', null)!.nhipKy).toBeCloseTo(-0.793, 2);
    expect(coViThe(h, 1_988_950, '2026-11-24', null)!.nhipKy).toBeCloseTo(0, 2);
  });

  it('không mức hoặc chưa vào lệnh ⇒ không có cỡ; lời đoán còn sống (bản ghi cũ) cho điều khoản thay', () => {
    expect(coViThe(tuTao({ ten: 'Trống' }, LUC, 'h0'), 0, '2026-09-25', null)).toBeNull();
    expect(coViThe(coMuc(), 0, '2026-09-25', null), 'có mức mà chưa kỳ hạn').toBeNull();
    expect(lenhCua(coLoiDoan())).toEqual({ tu: '2026-09-25', kyHan: '2027-03-25' });
  });

  it('⭐⭐ vào lệnh: nhãn `han` SUY từ kỳ hạn; đổi kỳ hạn khi lời đoán còn mở ⇒ khép giữa chừng (R2)', () => {
    const h = moLoiDoan(viThe('Laptop', 6_000_000, 'h1'), { han: LENH.kyHan, chac: 'vua' }, LUC, HOM_NAY);
    expect(h.han).toBe('vua');
    const doi = sua(h, { lenh: { tu: '2026-12-01', kyHan: '2027-06-01' } }, '2026-12-01T05:00:00.000Z');
    expect(doi.loiDoan?.[0]?.khep?.ly).toBe('doi_giua_chung');
    expect(sua(h, { lenh: { ...LENH } }, '2026-12-01T05:00:00.000Z').loiDoan?.[0]?.khep, 'y nguyên thì không khép')
      .toBeUndefined();
    expect(() => tuTao({ ten: 'Gần', muc: 1, lenh: { tu: HOM_NAY, kyHan: '2026-09-30' } }, LUC, 'h9')).toThrow(LoiHu);
  });

  it('⭐⭐ danh mục: vị thế lớn đứng trước; một vị thế chiếm ≥ 60% phần đã cam kết ⇒ câu "tập trung"', () => {
    const so = [thu('2026-08-05', 3_000_000, 't1')];
    const dm = danhMuc([viThe('Tai nghe', 1_500_000, 'h2'), viThe('Laptop', 6_000_000, 'h1')], so, '2026-09-25', () => 0);
    expect(dm.dong.map((d) => d.hu.id)).toEqual(['h1', 'h2']);
    expect(dm.daCamKet).toBeCloseTo(0.414, 2);
    expect(dm.cau).toMatchObject({ ma: 'tap_trung', ten: 'Laptop' });
    expect(dm.cau!.phan).toBeCloseTo(0.8, 2);
  });

  it('⭐ Barnum: MỘT vị thế không nói "tập trung" (100% đúng với mọi người) — chỉ tả chưa có vị thế giữ-nguyên', () => {
    const dm = danhMuc([viThe('Laptop', 6_000_000, 'h1')], [], '2026-09-25', () => 0);
    expect(dm.cau).toEqual({ ma: 'chua_giu_nguyen', soTich: 1 });
    expect(dm.daCamKet, 'không khoản thu ⇒ không %').toBeNull();
    const coDem = danhMuc([viThe('Laptop', 6_000_000, 'h1'), viThe('Dự phòng', 6_000_000, 'h3', 'du_phong')], [], '2026-09-25', () => 0);
    expect(coDem.cau, 'có dự phòng + hai vị thế ngang nhau (50/50)').toBeNull();
  });

  it('⭐⭐ lệnh QUÁ KỲ HẠN (chờ kết toán) không còn cam kết dòng tiền: ngoài thanh chia, ngoài câu Oracle, đứng sau', () => {
    /* Laptop: 3 triệu, 01/07 → 20/08 (50 ngày ⇒ 1,8 triệu/tháng = 60% của 3 triệu) — hôm nay 25/09 đã quá hạn.
       Tính nó vào thì 60% + 33% + 8% = 101% ⇒ câu "vượt dòng tiền" GIẢ, do một lệnh đã hết kế hoạch. */
    const quaHan = tuTao({ ten: 'Laptop', muc: 3_000_000, lenh: { tu: '2026-07-01', kyHan: '2026-08-20' } }, LUC, 'h0');
    const lon = tuTao({ ten: 'Xe', muc: 6_000_000, lenh: LENH }, LUC, 'h1');
    const nho = tuTao({ ten: 'Tai nghe', muc: 1_500_000, lenh: LENH }, LUC, 'h2');
    const trong = tuTao({ ten: 'Quỹ' }, LUC, 'h3');
    const dm = danhMuc([trong, quaHan, nho, lon], [thu('2026-08-05', 3_000_000, 't1')], HOM_NAY, () => 0);
    expect(dm.dong.map((d) => d.hu.id), 'đang cam kết (lớn trước) → quá hạn → chưa điều khoản').toEqual(['h1', 'h2', 'h0', 'h3']);
    expect(dm.dong.map((d) => d.camKet)).toEqual([true, true, false, false]);
    expect(dm.daCamKet).toBeCloseTo(0.414, 2);
    expect(dm.cau?.ma, 'không "vượt" giả').toBe('tap_trung');
  });

  it('cam kết vượt dòng tiền ⇒ câu "vượt" đứng trước mọi câu khác', () => {
    const dm = danhMuc([viThe('Laptop', 6_000_000, 'h1'), viThe('Xe', 9_000_000, 'h2')], [thu('2026-08-05', 2_000_000, 't1')],
      '2026-09-25', () => 0);
    expect(dm.cau?.ma).toBe('vuot_dong_tien');
  });
});
