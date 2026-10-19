/**
 * TÍN HIỆU GAME CHO PFM (D324) — THUẦN (không DB).
 * §I  lọc dòng bằng đúng `vaoGoi`; chỉ số thiếu mẫu là null, không 0.
 * §II tiết kiệm: null khi không cơ chế ≠ 0 khi có cửa mà không gửi; tỷ lệ giữ đủ kỳ.
 * §III `dongGameCuaKy`: null ⇒ KHÔNG phát dòng; giá trị qua được `kiemGiaTri` của sổ đăng ký.
 * §IV cửa đồng bộ của client KHÔNG nhận mã `chi_server`, đường server thì nhận.
 */
import { describe, expect, it } from 'vitest';
import { tinhTinHieu, dongGameCuaKy, type DongTinHieu } from '../server/hanh_vi/tin_hieu.js';
import { kiemDongDacTrung } from '../server/pfm/dac_trung.js';
import { SO_DANG_KY, kiemGiaTri, type MaDacTrung } from '../config/pfm_dac_trung.js';

const dong = (o: Partial<DongTinHieu> = {}): DongTinHieu => ({
  match_id: 'm1', lenh: [], pnl_bp: 0, brier: null, mo_bang: false, o_su_kien: false,
  la_tin_gia: false, chuoi_tang: false, tu_dong: false, tien_mat_bp: 5000, so_ma: 1,
  tiet_kiem_bp: null, tk_huy_so: null, tran_xong: true, man_tap: false, nghi_may: false, ...o,
});

describe('§I — lọc dòng + null khi thiếu mẫu', () => {
  it('⭐ màn tập, trận chưa xong, nghi máy đều bị loại khỏi n_tran/n_vong', () => {
    const t = tinhTinHieu([
      dong({ match_id: 'a' }), dong({ match_id: 'a', vong: 2 } as Partial<DongTinHieu>),
      dong({ match_id: 'tap', man_tap: true }),
      dong({ match_id: 'do', tran_xong: false }),
      dong({ match_id: 'may', nghi_may: true }),
    ]);
    expect(t.n_tran).toBe(1);
    expect(t.n_vong).toBe(2);
    expect(t.hieu_chuan).toBe('chua');
  });
  it('không dòng nào ⇒ n = 0, mọi chỉ số null (không phải 0), tiết kiệm null', () => {
    const t = tinhTinHieu([]);
    expect(t.n_tran).toBe(0);
    expect(t.chi_so.hieu_chinh).toBeNull();
    expect(t.chi_so.khau_vi).toBeNull();
    expect(t.tiet_kiem).toBeNull();
  });
});

describe('§II — tiết kiệm: null ≠ 0', () => {
  it('⭐ luật không có ngân hàng (tiet_kiem_bp toàn null) ⇒ tiet_kiem null', () => {
    expect(tinhTinHieu([dong(), dong()]).tiet_kiem).toBeNull();
  });
  it('⭐ có cửa mà không gửi ⇒ object với n_tran_gui 0 và tỷ lệ giữ null (không phải 0)', () => {
    const t = tinhTinHieu([dong({ tiet_kiem_bp: 0, tk_huy_so: 0 })]);
    expect(t.tiet_kiem).toEqual({
      n_tran_co_co_che: 1, n_tran_gui: 0, so_huy_tong: 0, ty_trong_tb_bp: null, ty_le_tran_giu_du: null,
    });
  });
  it('hai trận gửi, một trận huỷ ⇒ giữ đủ kỳ 0,5; tỷ trọng TB chỉ tính vòng đang gửi', () => {
    const t = tinhTinHieu([
      dong({ match_id: 'a', tiet_kiem_bp: 4000, tk_huy_so: 0 }),
      dong({ match_id: 'a', tiet_kiem_bp: 0, tk_huy_so: 0 }),
      dong({ match_id: 'b', tiet_kiem_bp: 2000, tk_huy_so: 1 }),
    ]);
    expect(t.tiet_kiem).toEqual({
      n_tran_co_co_che: 2, n_tran_gui: 2, so_huy_tong: 1, ty_trong_tb_bp: 3000, ty_le_tran_giu_du: 0.5,
    });
  });
});

describe('§III — dongGameCuaKy', () => {
  it('⭐ chỉ số null ⇒ KHÔNG phát dòng; gm_n_tran luôn phát (0 trận là quan sát thật)', () => {
    const ra = dongGameCuaKy(tinhTinHieu([]));
    expect(ra).toEqual([{ ma: 'gm_n_tran', gia_tri: 0 }]);
  });
  it('mọi dòng phát ra qua được kiểm giá trị của sổ đăng ký và là mã chi_server', () => {
    // ⚠ 8 vòng: khẩu vị (`insight.ts`) cần ≥ 8 vòng quyết định — ít hơn thì phơi nhiễm null
    // và mã ấy (đúng luật) không được phát.
    const rows = Array.from({ length: 8 }, (_, i) => dong({
      match_id: i < 4 ? 'a' : 'b', brier: 0.6, tien_mat_bp: 2000, so_ma: 2,
      tiet_kiem_bp: 3000, tk_huy_so: i === 7 ? 1 : 0,
    }));
    const ra = dongGameCuaKy(tinhTinHieu(rows));
    expect(ra.map((d) => d.ma).sort()).toEqual(['gm_brier_tb', 'gm_n_tran', 'gm_phoi_nhiem', 'gm_tk_giu', 'gm_tk_huy']);
    for (const d of ra) {
      expect(kiemGiaTri(d.ma as MaDacTrung, d.gia_tri), d.ma).toBeNull();
      expect((SO_DANG_KY[d.ma as MaDacTrung] as { chi_server?: boolean }).chi_server, d.ma).toBe(true);
    }
    expect(ra.find((d) => d.ma === 'gm_brier_tb')!.gia_tri).toBe(0.3);
  });
});

describe('§IV — mã chi_server ở cửa client', () => {
  it('⭐ client gửi gm_* ⇒ từ chối, lý do nói rõ; đường server ⇒ nhận', () => {
    const d = { ma: 'gm_tk_giu', gia_tri: 0.5 };
    expect(kiemDongDacTrung(d)).toMatch(/server tính/);
    expect(kiemDongDacTrung(d, true)).toBeNull();
  });
  it('mã thường vẫn đi cửa client như cũ', () => {
    expect(kiemDongDacTrung({ ma: 'hv_chi_bu', gia_tri: 0.2 })).toBeNull();
  });
});
