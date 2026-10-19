/**
 * PFM — XẾP GÓI KỲ (D325). Trước D325 `dongGoiKy` không có người gọi: hàng đợi chỉ từng
 * nhận nhịp, dữ liệu nghiên cứu theo tháng chưa bao giờ rời máy. Sáu câu:
 *  §I  `xepGoiKy` xếp gói kỳ đang sống; kỳ trước trống thì bỏ, có khoản thì xếp;
 *  §II xếp lại là ĐÈ theo kỳ — hàng đợi không phình qua các lượt kích;
 *  §III hũ tạo SAU một kỳ không vào gói của kỳ ấy;
 *  §IV ⭐ `kichDongBo` THẬT SỰ xếp gói trước khi gửi khi cửa `dac_trung` mở — và không xếp khi đóng;
 *  §V  ⭐⭐ kỳ cũ được DỰNG LẠI, không chụp hôm nay — chuyện tháng 9 không lọt vào gói tháng 8;
 *  §VI câu trả lời CUỐI KỲ vào đúng kỳ, đúng đối tượng, không phát đôi với nấc quyết toán.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { KhoTrongBoNho } from '../src/pfm/kho.js';
import { khoanRaBanGhi, taoKhoan } from '../src/pfm/so.js';
import {
  CHUYEN_TIEP, TRANG_THAI_HU, chuyenDuoc, doiTrangThai, ghiKetQuaKy, quyetToan, tuTao, TRANG_THAI_SAU_DAU,
  type Hu,
} from '../src/pfm/hu.js';
import { banLuat, ghiHieuQuaKy, ghiNhanGiuVo, taoLuatMoi } from '../src/pfm/luat.js';
import { dongGoiKy } from '../src/pfm/dac_trung.js';
import { huThuocKy, huTrongKy, luatTrongKy, xepGoiKy } from '../src/pfm/goi_ky.js';
import { thangSauCua, thangTruocCua } from '../src/pfm/thoi_gian.js';
import type { MonHangDoi } from '../src/pfm/dong_bo.js';

vi.mock('../src/pfm/dong_bo_chay.js', () => ({ dongBoMotLuot: vi.fn() }));
vi.mock('../src/lib/telemetry.js', () => ({ ghiDo: vi.fn(), manCuaDuong: () => '/tai-chinh/so' }));
const { dongBoMotLuot } = await import('../src/pfm/dong_bo_chay.js');
const { kichDongBo, quenKichChoTest } = await import('../src/pfm/dong_bo_kich.js');

const LUC = '2026-09-12T10:00:00.000Z';
const BON_TAT = { ket: false, dac_trung: false, thuong: false, noi_game: false };

beforeEach(() => {
  quenKichChoTest();
  vi.mocked(dongBoMotLuot).mockReset().mockResolvedValue({ daGui: false, ghi: 0, trung: 0, bo: 0, conLai: 0 } as never);
});

async function khoCoKhoan(ngays: string[]): Promise<KhoTrongBoNho> {
  const kho = new KhoTrongBoNho();
  for (const [i, ngay] of ngays.entries()) {
    const k = taoKhoan({ ngay, soTien: 50_000, chieu: 'chi' }, LUC, `k${i}`);
    await kho.ghi('khoan', khoanRaBanGhi(k));
  }
  return kho;
}

const goiTrongHangDoi = async (kho: KhoTrongBoNho) =>
  (await kho.liet<MonHangDoi>('outbox')).filter((b) => b.d.loai === 'goi').map((b) => b.id).sort();

const dongCua = async (kho: KhoTrongBoNho, ky: string) => {
  const m = (await kho.doc<MonHangDoi>('outbox', `goi:${ky}`))!.d;
  return m.loai === 'goi' ? m.goi.dong : [];
};

describe('§I — kỳ đang sống luôn xếp, kỳ trước chỉ khi có gì', () => {
  it('thangTruocCua lùi năm ở tháng Giêng; thangSauCua tiến năm ở tháng Chạp', () => {
    expect(thangTruocCua('2026-01')).toBe('2025-12');
    expect(thangTruocCua('2026-09')).toBe('2026-08');
    expect(thangSauCua('2025-12')).toBe('2026-01');
    expect(thangSauCua('2026-08')).toBe('2026-09');
  });

  it('⭐ chỉ có khoản tháng này ⇒ đúng một gói goi:2026-09; kỳ trước trống bị bỏ', async () => {
    const kho = await khoCoKhoan(['2026-09-03', '2026-09-10']);
    expect(await xepGoiKy(kho, '2026-09', LUC)).toEqual(['2026-09']);
    expect(await goiTrongHangDoi(kho)).toEqual(['goi:2026-09']);
    const mon = (await kho.doc<MonHangDoi>('outbox', 'goi:2026-09'))!.d;
    expect(mon.loai === 'goi' && mon.goi.dong.length).toBeGreaterThan(0);
  });

  it('có khoản tháng trước ⇒ xếp cả hai kỳ', async () => {
    const kho = await khoCoKhoan(['2026-08-28', '2026-09-03']);
    expect(await xepGoiKy(kho, '2026-09', LUC)).toEqual(['2026-08', '2026-09']);
  });
});

describe('§II — xếp lại là đè theo kỳ', () => {
  it('⭐ ba lượt kích liền nhau ⇒ vẫn đúng hai gói, không phình', async () => {
    const kho = await khoCoKhoan(['2026-08-28', '2026-09-03']);
    for (let i = 0; i < 3; i++) await xepGoiKy(kho, '2026-09', LUC);
    expect(await goiTrongHangDoi(kho)).toEqual(['goi:2026-08', 'goi:2026-09']);
  });
});

describe('§III — hũ tạo sau một kỳ không vào gói của kỳ ấy', () => {
  it('hũ tạo tháng 9 ⇒ có mặt trong gói tháng 9, vắng trong gói tháng 8', async () => {
    const kho = await khoCoKhoan(['2026-08-28', '2026-09-03']);
    const h: Hu = tuTao({ ten: 'Dự phòng', loai: 'du_phong' }, '2026-09-05T02:00:00.000Z', 'h1');
    await kho.ghi('hu', { id: 'h1', thang: '2026-09', suaLuc: LUC, d: h });
    await xepGoiKy(kho, '2026-09', LUC);
    expect((await dongCua(kho, '2026-09')).some((d) => d.doiTuong === 'h1')).toBe(true);
    expect((await dongCua(kho, '2026-08')).some((d) => d.doiTuong === 'h1')).toBe(false);
  });
});

describe('§IV — kichDongBo thật sự xếp gói trước khi gửi', () => {
  it('⭐ cửa dac_trung MỞ ⇒ sau cú kích có gói kỳ đang sống trong hàng đợi, và lượt gửi vẫn chạy', async () => {
    const kho = await khoCoKhoan(['2026-09-03']);
    await kichDongBo(kho, { ...BON_TAT, dac_trung: true }, { ngay: '2026-09-12', luc: LUC, thangSong: '2026-09' });
    expect(await goiTrongHangDoi(kho)).toEqual(['goi:2026-09']);
    expect(dongBoMotLuot).toHaveBeenCalledTimes(1);
  });

  it('cửa dac_trung ĐÓNG ⇒ không xếp gói, không gửi', async () => {
    const kho = await khoCoKhoan(['2026-09-03']);
    await kichDongBo(kho, { ...BON_TAT, ket: true }, { ngay: '2026-09-12', luc: LUC, thangSong: '2026-09' });
    expect(await goiTrongHangDoi(kho)).toEqual([]);
    expect(dongBoMotLuot).not.toHaveBeenCalled();
  });
});

/* ═══ §V — DỰNG LẠI TẠI KỲ ════════════════════════════════════════════════════ */

/** Hũ tạo 10/08, tạm dừng 20/08, BỎ 15/09 — đủ ba mốc để thấy chuyện tháng 9 có lọt không. */
function huBaMoc(): Hu {
  let h = tuTao({ ten: 'Máy', loai: 'thiet_bi', han: 'vua' }, '2026-08-10T03:00:00.000Z', 'h9');
  h = doiTrangThai(h, 'tam_dung', '2026-08-20T03:00:00.000Z');
  h = quyetToan(h, 'bo_do', 'xa', '2026-09-15T03:00:00.000Z');
  return h;
}

describe('§V — ⭐⭐ kỳ cũ dựng lại, không chụp hôm nay', () => {
  it('⭐ hũ bỏ 15/09: gói tháng 8 nói "con_theo", KHÔNG có nấc quyết toán; gói tháng 9 nói "bo" + nấc', async () => {
    const kho = await khoCoKhoan(['2026-08-28', '2026-09-03']);
    await kho.ghi('hu', { id: 'h9', thang: '2026-09', suaLuc: LUC, d: huBaMoc() });
    await xepGoiKy(kho, '2026-09', LUC);
    const t8 = (await dongCua(kho, '2026-08')).filter((d) => d.doiTuong === 'h9');
    const t9 = (await dongCua(kho, '2026-09')).filter((d) => d.doiTuong === 'h9');
    expect(t8.find((d) => d.ma === 'kq_bo_giua_chung')?.giaTri).toBe('con_theo');
    expect(t8.some((d) => d.ma === 'kq_dat_muc_tieu')).toBe(false);
    expect(t8.find((d) => d.ma === 'hv_tam_dung_hu')?.giaTri).toBe(1);
    expect(t9.find((d) => d.ma === 'kq_bo_giua_chung')?.giaTri).toBe('bo');
    expect(t9.find((d) => d.ma === 'kq_dat_muc_tieu')?.giaTri).toBe('xa');
    // lần tạm dừng thuộc tháng 8 — tháng 9 không đếm lại
    expect(t9.find((d) => d.ma === 'hv_tam_dung_hu')?.giaTri).toBe(0);
  });

  it('hũ đã bỏ từ tháng 6 và không ai đụng lại ⇒ không thuộc tháng 8 (không đếm một kết cục nhiều lần)', () => {
    let h = tuTao({ ten: 'Cũ' }, '2026-05-02T03:00:00.000Z', 'h6');
    h = quyetToan(h, 'bo_do', 'xa', '2026-06-10T03:00:00.000Z');
    expect(huThuocKy(h, '2026-06')).toBe(true);
    expect(huThuocKy(h, '2026-08')).toBe(false);
    // mở lại trong tháng 8 ⇒ lại thuộc tháng 8
    expect(huThuocKy(doiTrangThai(h, 'dang_chay', '2026-08-03T03:00:00.000Z'), '2026-08')).toBe(true);
  });

  it('⭐ bảng ngược khớp bảng xuôi: MỌI cú chuyển được phép dựng lại đúng đích từ dấu nó để lại', () => {
    /*
     * Đi xuôi bằng CHÍNH `doiTrangThai` qua MỌI cặp (từ, đến) mà `chuyenDuoc` cho phép, dựng
     * ngược bằng `TRANG_THAI_SAU_DAU` qua `huTrongKy`. ⚠ Bản đầu chỉ đi một đường về
     * `dang_chay` (tạm dừng → tiếp tục) nên tiêm `mo_lai: 'bo_do'` KHÔNG đỏ — mở lại sau khi
     * bỏ là đường thứ hai về cùng trạng thái, và nó để lại một dấu khác.
     */
    const vao = (den: Hu['trangThai']): Hu => {
      const h = tuTao({ ten: 'x' }, '2026-08-01T01:00:00.000Z', `h-${den}`);
      return den === 'dang_chay' ? h : doiTrangThai(h, den, '2026-08-02T01:00:00.000Z');
    };
    let soCap = 0;
    for (const tu of TRANG_THAI_HU) {
      for (const den of TRANG_THAI_HU) {
        if (!chuyenDuoc(tu, den)) continue;
        const sau = doiTrangThai(vao(tu), den, '2026-08-03T01:00:00.000Z');
        expect(huTrongKy(sau, '2026-08').trangThai, `${tu} → ${den}`).toBe(den);
        soCap++;
      }
    }
    expect(soCap).toBeGreaterThanOrEqual(7);
    for (const ma of Object.keys(TRANG_THAI_SAU_DAU)) expect(CHUYEN_TIEP as readonly string[]).toContain(ma);
  });

  it('kq_giu_luat là tỷ lệ CỦA KỲ: nhịp tháng 7 không vào gói tháng 8', () => {
    let l = taoLuatMoi({ loiNhac: 'x', dieuKien: 'ngay_chi_lon' }, '2026-07-01T01:00:00.000Z', 'l1');
    l = ghiNhanGiuVo(banLuat(l, '2026-07-05T01:00:00.000Z'), 'vo', '2026-07-05T02:00:00.000Z');
    l = ghiNhanGiuVo(banLuat(l, '2026-08-05T01:00:00.000Z'), 'giu', '2026-08-05T02:00:00.000Z');
    const g = dongGoiKy({ ky: '2026-08', so: [], hu: [], luat: [luatTrongKy(l, '2026-08')] });
    expect(g.dong.find((d) => d.ma === 'kq_giu_luat')?.giaTri).toBe(1);
  });
});

/* ═══ §VI — CÂU TRẢ LỜI CUỐI KỲ ═══════════════════════════════════════════════ */

describe('§VI — nấc cuối kỳ + đánh giá luật vào đúng kỳ, đúng đối tượng', () => {
  it('⭐ ketQuaKy["2026-08"] ⇒ kq_dat_muc_tieu trong gói tháng 8, vắng trong gói tháng 9', () => {
    const h = ghiKetQuaKy(tuTao({ ten: 'Đi' }, '2026-08-01T01:00:00.000Z', 'h1'), '2026-08', 'gan_du');
    const g8 = dongGoiKy({ ky: '2026-08', so: [], hu: [huTrongKy(h, '2026-08')] });
    const g9 = dongGoiKy({ ky: '2026-09', so: [], hu: [huTrongKy(h, '2026-09')] });
    expect(g8.dong.filter((d) => d.ma === 'kq_dat_muc_tieu')).toEqual([
      { ma: 'kq_dat_muc_tieu', giaTri: 'gan_du', doiTuong: 'h1' },
    ]);
    expect(g9.dong.some((d) => d.ma === 'kq_dat_muc_tieu')).toBe(false);
  });

  it('⭐ quyết toán trong kỳ + nấc cuối kỳ cùng kỳ ⇒ ĐÚNG MỘT dòng, nấc quyết toán thắng', () => {
    let h = tuTao({ ten: 'Đi' }, '2026-08-01T01:00:00.000Z', 'h1');
    h = ghiKetQuaKy(h, '2026-08', 'xa');
    h = quyetToan(h, 'xong', 'du', '2026-08-20T01:00:00.000Z');
    const g = dongGoiKy({ ky: '2026-08', so: [], hu: [huTrongKy(h, '2026-08')] });
    expect(g.dong.filter((d) => d.ma === 'kq_dat_muc_tieu').map((d) => d.giaTri)).toEqual(['du']);
  });

  it('⭐ hieuQuaKy ⇒ kq_rule_hieu_qua theo id luật; chưa trả lời ⇒ không dòng nào', () => {
    const l1 = ghiHieuQuaKy(taoLuatMoi({ loiNhac: 'a', dieuKien: 'ngay_chi_lon' }, LUC, 'l1'), '2026-08', 'chua_ro');
    const l2 = taoLuatMoi({ loiNhac: 'b', dieuKien: 'tien_vua_ve' }, LUC, 'l2');
    const g = dongGoiKy({ ky: '2026-08', so: [], hu: [], luat: [l1, l2] });
    expect(g.dong.filter((d) => d.ma === 'kq_rule_hieu_qua')).toEqual([
      { ma: 'kq_rule_hieu_qua', giaTri: 'chua_ro', doiTuong: 'l1' },
    ]);
  });

  it('cửa ghi từ chối mã kỳ sai hình và nấc ngoài miền', () => {
    const h = tuTao({ ten: 'x' }, LUC, 'h1');
    expect(() => ghiKetQuaKy(h, '2026-8', 'du')).toThrow();
    expect(() => ghiKetQuaKy(h, '2026-08', 'tot' as never)).toThrow();
    const l = taoLuatMoi({ loiNhac: 'a', dieuKien: 'ngay_chi_lon' }, LUC, 'l1');
    expect(() => ghiHieuQuaKy(l, '2026-08', 'co_le' as never)).toThrow();
  });
});
