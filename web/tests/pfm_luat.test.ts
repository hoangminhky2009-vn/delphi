/**
 * PFM — LUẬT NẾU-THÌ (nhóm G, bậc 3 thang can thiệp). GĐ6.
 *
 * Bốn khối, xếp theo ĐỘ ĐẮT KHI HỎNG:
 *   §I   RANH RIÊNG TƯ — `suKienLuat` là cửa DUY NHẤT rời máy, và nó chỉ chở ba
 *        trường (K5 🔒). Hỏng ở đây là rò câu luật thật lên server.
 *   §II  TẠO/SỬA — điều kiện là TẬP ĐÓNG, không NLP tự do.
 *   §III BẮN + GIỮ/VỠ — không bắn chồng, không phạt khi vỡ (P17 — data, không phải tội).
 *   §IV  ĐÁNH GIÁ ĐIỀU KIỆN — vector chép tay cho cả ba loại (A5.2).
 *   §V   tyLeGiuLuat — gộp cho `dac_trung.ts`, không theo từng luật.
 */
import { describe, expect, it } from 'vitest';
import {
  taoLuatMoi, suaLuat, datBat, banLuat, ghiNhanGiuVo, dangChoDanhGia,
  suKienLuat, danhGiaDieuKien, tyLeGiuLuat, LoiLuat, DIEU_KIEN, HANH_DONG_LUAT,
  type Luat,
} from '../src/pfm/luat.js';
import { taoKhoan, type Khoan, type DauVaoKhoan } from '../src/pfm/so.js';
import { PFM } from '@config/pfm';

const LUC = '2026-08-31T10:00:00.000Z';
const moi = (v: Partial<Parameters<typeof taoLuatMoi>[0]> = {}, id = 'l1'): Luat =>
  taoLuatMoi({ loiNhac: 'Nếu hôm nay tiêu nhiều thì mai đợi rồi hẵng mua.', dieuKien: 'ngay_chi_lon', ...v }, LUC, id);

let demK = 0;
const k = (v: DauVaoKhoan): Khoan => taoKhoan(v, LUC, `k${demK++}`);
const chi = (d: number, nghin: number, v: Partial<DauVaoKhoan> = {}): Khoan =>
  k({ ngay: `2026-08-${String(d).padStart(2, '0')}`, soTien: nghin * 1000, ...v });
const thu = (d: number, nghin: number): Khoan => chi(d, nghin, { chieu: 'thu' });

/* ══════════════════════════════════════════════════════════════════════════════
 * §I — RANH RIÊNG TƯ (P2 🔒): suKienLuat là cửa DUY NHẤT rời máy
 * ════════════════════════════════════════════════════════════════════════════ */

describe('§I — suKienLuat: cửa DUY NHẤT rời máy, chỉ ba trường (K5 🔒)', () => {
  it('⭐ KHÔNG chở câu luật thật (loiNhac), kể cả khi câu đó "trông như dữ liệu"', () => {
    const l = moi({ loiNhac: 'Nếu thấy áo đẹp giá dưới 2 triệu 500 nghìn thì vẫn nhịn.' });
    const ev = suKienLuat(l, 'dat');
    const s = JSON.stringify(ev);
    expect(s).not.toContain('áo đẹp');
    expect(s).not.toContain('2 triệu');
    expect(ev).toEqual({
      loai: 'nhip', ma: 'pfm_luat',
      v: { luat_id: 'l1', mau_id: '', hanh_dong: 'dat' },
    });
  });

  it('⭐ KHÔNG chở thamSo (số tiền ngưỡng do user đặt) — kiểm đúng điều kiện có số', () => {
    const l = moi({ dieuKien: 'khoan_vuot_muc', thamSo: { nguong: 250_000 } });
    const s = JSON.stringify(suKienLuat(l, 'dat'));
    expect(s).not.toContain('250000');
    expect(s).not.toContain('250_000');
  });

  it('mau_id rỗng ("") khi không có mẫu — không phải null/undefined', () => {
    const l = moi();
    expect(suKienLuat(l, 'dat').v.mau_id).toBe('');
  });

  it('mau_id đúng ID mẫu khi luật tạo từ mẫu', () => {
    const l = moi({ mauId: 'mau_chi_bu_1' });
    expect(suKienLuat(l, 'dat').v.mau_id).toBe('mau_chi_bu_1');
  });

  it('Object.keys(v) ĐÚNG BA khoá — khớp K5 whitelist tuyệt đối, không thừa không thiếu', () => {
    const ev = suKienLuat(moi(), 'ban');
    expect(Object.keys(ev.v).sort()).toEqual(['hanh_dong', 'luat_id', 'mau_id']);
  });

  it('HANH_DONG_LUAT khớp CHÍNH XÁC enum đã chốt ở migration 0047 (không tự thêm/bớt)', () => {
    expect([...HANH_DONG_LUAT].sort()).toEqual(['ban', 'dat', 'giu', 'sua', 'vo', 'xoa']);
  });
});

/* ══════════════════════════════════════════════════════════════════════════════
 * §II — TẠO/SỬA: điều kiện là TẬP ĐÓNG
 * ════════════════════════════════════════════════════════════════════════════ */

describe('§II — tạo/sửa luật', () => {
  it('tạo thành công với điều kiện không cần tham số', () => {
    const l = moi({ dieuKien: 'tien_vua_ve' });
    expect(l.trangThai).toBe('bat');
    expect(l.lichSu).toEqual([{ ma: 'dat', luc: LUC }]);
  });

  it('⭐ lời nhắc RỖNG ⇒ từ chối — luật cần một câu, không có mặc định', () => {
    expect(() => moi({ loiNhac: '   ' })).toThrow(LoiLuat);
  });

  it('lời nhắc bị cắt độ dài, khoảng trắng thừa được gộp', () => {
    const l = moi({ loiNhac: `  Nếu   ${'x'.repeat(300)}  ` });
    expect(l.loiNhac.length).toBeLessThanOrEqual(200);
    expect(l.loiNhac.startsWith('Nếu x')).toBe(true);
  });

  it('điều kiện lạ (ngoài TẬP ĐÓNG) ⇒ từ chối — không NLP tự do nào cứu được', () => {
    expect(() => moi({ dieuKien: 'bat_ky_dieu_kien_gi' as any })).toThrow(LoiLuat);
  });

  it('⭐ "khoan_vuot_muc" THIẾU ngưỡng ⇒ từ chối (app không tự sáng tác số — P3 🔒)', () => {
    expect(() => moi({ dieuKien: 'khoan_vuot_muc' })).toThrow(/ngưỡng dương/);
    expect(() => moi({ dieuKien: 'khoan_vuot_muc', thamSo: { nguong: -5 } })).toThrow(LoiLuat);
    expect(() => moi({ dieuKien: 'khoan_vuot_muc', thamSo: { nguong: 0 } })).toThrow(LoiLuat);
  });

  it('sửa: đổi lời nhắc, giữ nguyên điều kiện — một dấu "sua" thêm vào lịch sử', () => {
    const l = moi();
    const ra = suaLuat(l, { loiNhac: 'Câu mới.' }, '2026-09-01T00:00:00.000Z');
    expect(ra.loiNhac).toBe('Câu mới.');
    expect(ra.dieuKien).toBe(l.dieuKien);
    expect(ra.lichSu).toEqual([...l.lichSu, { ma: 'sua', luc: '2026-09-01T00:00:00.000Z' }]);
  });

  it('sửa: đổi dieuKien SANG "khoan_vuot_muc" mà KHÔNG kèm thamSo ⇒ từ chối', () => {
    const l = moi({ dieuKien: 'ngay_chi_lon' });
    expect(() => suaLuat(l, { dieuKien: 'khoan_vuot_muc' }, LUC)).toThrow(/ngưỡng dương/);
  });

  it('sửa: đổi dieuKien SANG "khoan_vuot_muc" KÈM thamSo trong CÙNG một lần sửa ⇒ qua', () => {
    const l = moi({ dieuKien: 'ngay_chi_lon' });
    const ra = suaLuat(l, { dieuKien: 'khoan_vuot_muc', thamSo: { nguong: 100_000 } }, LUC);
    expect(ra.dieuKien).toBe('khoan_vuot_muc');
    expect(ra.thamSo).toEqual({ nguong: 100_000 });
  });

  it('sửa CHỈ thamSo (giữ nguyên dieuKien "khoan_vuot_muc") vẫn kiểm lại đúng ngưỡng mới', () => {
    const l = moi({ dieuKien: 'khoan_vuot_muc', thamSo: { nguong: 100_000 } });
    expect(() => suaLuat(l, { thamSo: { nguong: -1 } }, LUC)).toThrow(LoiLuat);
    const ra = suaLuat(l, { thamSo: { nguong: 500_000 } }, LUC);
    expect(ra.thamSo).toEqual({ nguong: 500_000 });
  });
});

describe('§II-b — bật/tắt: cấu hình cục bộ THUẦN, không sự kiện', () => {
  it('tắt rồi bật lại KHÔNG đụng lịch sử — không có hanh_dong "bat"/"tat" nào tồn tại', () => {
    const l = moi();
    const tat = datBat(l, false);
    expect(tat.trangThai).toBe('tat');
    expect(tat.lichSu).toEqual(l.lichSu);   // không thêm dấu nào
    const batLai = datBat(tat, true);
    expect(batLai.trangThai).toBe('bat');
    expect(batLai.lichSu).toEqual(l.lichSu);
  });
});

/* ══════════════════════════════════════════════════════════════════════════════
 * §III — BẮN + GIỮ/VỠ
 * ════════════════════════════════════════════════════════════════════════════ */

describe('§III — bắn điều kiện + đánh giá giữ/vỡ', () => {
  it('bắn lần đầu: lịch sử thêm "ban", dangChoDanhGia = true', () => {
    const l = banLuat(moi(), '2026-09-01T00:00:00.000Z');
    expect(dangChoDanhGia(l)).toBe(true);
    expect(l.lichSu.at(-1)).toEqual({ ma: 'ban', luc: '2026-09-01T00:00:00.000Z' });
  });

  it('⭐ KHÔNG bắn chồng lên một lần bắn CHƯA đánh giá', () => {
    const l = banLuat(moi(), LUC);
    expect(() => banLuat(l, LUC)).toThrow(LoiLuat);
  });

  it('đánh giá GIỮ: thêm "giu", hết chờ đánh giá, bắn lại được', () => {
    let l = banLuat(moi(), LUC);
    l = ghiNhanGiuVo(l, 'giu', '2026-09-02T00:00:00.000Z');
    expect(dangChoDanhGia(l)).toBe(false);
    expect(() => banLuat(l, LUC)).not.toThrow();
  });

  it('⭐ đánh giá VỠ không bị "phạt" gì ở tầng dữ liệu — chỉ thêm một dấu, không đổi trangThai/xoá gì', () => {
    let l = banLuat(moi(), LUC);
    const truoc = { ...l };
    l = ghiNhanGiuVo(l, 'vo', LUC);
    expect(l.trangThai).toBe(truoc.trangThai);
    expect(l.id).toBe(truoc.id);
    expect(l.lichSu.at(-1)?.ma).toBe('vo');
  });

  it('ghiNhanGiuVo khi KHÔNG có lần bắn nào đang chờ ⇒ từ chối', () => {
    expect(() => ghiNhanGiuVo(moi(), 'giu', LUC)).toThrow(LoiLuat);
    let l = banLuat(moi(), LUC);
    l = ghiNhanGiuVo(l, 'giu', LUC);
    expect(() => ghiNhanGiuVo(l, 'giu', LUC)).toThrow(LoiLuat);   // đã đánh giá rồi
  });
});

/* ══════════════════════════════════════════════════════════════════════════════
 * §IV — ĐÁNH GIÁ ĐIỀU KIỆN: vector chép tay
 * ════════════════════════════════════════════════════════════════════════════ */

describe('§IV — danhGiaDieuKien (hàm thuần, đọc sổ local)', () => {
  describe('ngay_chi_lon', () => {
    it('dùng ĐÚNG ngưỡng của guong.ts (chép lại vector chiBu đã chứng minh)', () => {
      // Cùng vector với pfm_guong.test.ts: nền=100k, ngưỡng=200k.
      const so = [
        chi(1, 100), chi(2, 400), chi(3, 100), chi(4, 50), chi(5, 400),
        chi(6, 300), chi(7, 100), chi(8, 400), chi(9, 20), chi(10, 100),
      ];
      const l = moi({ dieuKien: 'ngay_chi_lon' });
      expect(danhGiaDieuKien(l, so, '2026-08-02')).toEqual({ dung: true });   // 400k ≥ 200k
      expect(danhGiaDieuKien(l, so, '2026-08-01')).toEqual({ dung: false }); // 100k < 200k
    });

    it('dưới sàn ngày-có-chi ⇒ null (P7 — chưa đủ để nói, không phải "không lớn")', () => {
      const so = [chi(1, 100), chi(2, 100)];
      expect(danhGiaDieuKien(moi({ dieuKien: 'ngay_chi_lon' }), so, '2026-08-01').dung)
        .toBeNull();
    });
  });

  describe('khoan_vuot_muc', () => {
    const l = moi({ dieuKien: 'khoan_vuot_muc', thamSo: { nguong: 200_000 } });

    it('có khoản CHI trong ngày vượt ngưỡng ⇒ true', () => {
      const so = [chi(1, 250)];
      expect(danhGiaDieuKien(l, so, '2026-08-01')).toEqual({ dung: true });
    });

    it('đúng bằng ngưỡng ⇒ true (>=), thấp hơn ⇒ false', () => {
      expect(danhGiaDieuKien(l, [chi(1, 200)], '2026-08-01')).toEqual({ dung: true });
      expect(danhGiaDieuKien(l, [chi(1, 199)], '2026-08-01')).toEqual({ dung: false });
    });

    it('ngày không có khoản nào ⇒ false THẬT (một quan sát 0), không phải null', () => {
      expect(danhGiaDieuKien(l, [chi(2, 500)], '2026-08-01')).toEqual({ dung: false });
    });

    it('khoản THU lớn không tính — chỉ CHI mới kích điều kiện', () => {
      expect(danhGiaDieuKien(l, [thu(1, 500)], '2026-08-01')).toEqual({ dung: false });
    });
  });

  describe('tien_vua_ve', () => {
    const l = moi({ dieuKien: 'tien_vua_ve' });

    it('đúng ngày có thu ⇒ true', () => {
      expect(danhGiaDieuKien(l, [thu(5, 5000)], '2026-08-05')).toEqual({ dung: true });
    });

    it(`trong cửa sổ ${PFM.GUONG_CUA_SO_TIEN_VE} ngày SAU ngày thu ⇒ true`, () => {
      const ngayCuoiCuaSo = `2026-08-${String(5 + PFM.GUONG_CUA_SO_TIEN_VE - 1).padStart(2, '0')}`;
      expect(danhGiaDieuKien(l, [thu(5, 5000)], ngayCuoiCuaSo)).toEqual({ dung: true });
    });

    it('ngoài cửa sổ ⇒ false', () => {
      const ngoaiCuaSo = `2026-08-${String(5 + PFM.GUONG_CUA_SO_TIEN_VE + 5).padStart(2, '0')}`;
      expect(danhGiaDieuKien(l, [thu(5, 5000)], ngoaiCuaSo)).toEqual({ dung: false });
    });

    it('chưa từng có khoản thu nào ⇒ null (chưa đủ dữ liệu)', () => {
      expect(danhGiaDieuKien(l, [chi(1, 100)], '2026-08-01').dung).toBeNull();
    });
  });
});

/* ══════════════════════════════════════════════════════════════════════════════
 * §V — tyLeGiuLuat: gộp cho dac_trung.ts, không theo từng luật
 * ════════════════════════════════════════════════════════════════════════════ */

describe('§V — tyLeGiuLuat', () => {
  it('chưa có giu/vo nào (kể cả rỗng, kể cả luật chưa từng bắn) ⇒ null', () => {
    expect(tyLeGiuLuat([])).toBeNull();
    expect(tyLeGiuLuat([moi()])).toBeNull();
  });

  it('gộp ĐÚNG trên NHIỀU luật — không tách theo từng cái (registry: không theo_doi_tuong)', () => {
    let a = banLuat(moi({}, 'a'), LUC);
    a = ghiNhanGiuVo(a, 'giu', LUC);
    let b = banLuat(moi({}, 'b'), LUC);
    b = ghiNhanGiuVo(b, 'vo', LUC);
    let c = banLuat(moi({}, 'c'), LUC);
    c = ghiNhanGiuVo(c, 'giu', LUC);
    expect(tyLeGiuLuat([a, b, c])).toBeCloseTo(2 / 3, 10);
  });

  it('MỘT luật bắn nhiều lần đóng góp NHIỀU quan sát (không chỉ đếm 1/luật)', () => {
    let l = moi();
    l = ghiNhanGiuVo(banLuat(l, LUC), 'giu', LUC);
    l = ghiNhanGiuVo(banLuat(l, LUC), 'giu', LUC);
    l = ghiNhanGiuVo(banLuat(l, LUC), 'vo', LUC);
    expect(tyLeGiuLuat([l])).toBeCloseTo(2 / 3, 10);
  });
});

/* ══════════════════════════════════════════════════════════════════════════════
 * §VI — DIEU_KIEN là tập đóng thật (bài canh khỏi phình âm thầm)
 * ════════════════════════════════════════════════════════════════════════════ */

describe('§VI — DIEU_KIEN (tập đóng)', () => {
  it('đúng ba điều kiện v1, không hơn không kém', () => {
    expect([...DIEU_KIEN].sort()).toEqual(['khoan_vuot_muc', 'ngay_chi_lon', 'tien_vua_ve']);
  });
});
