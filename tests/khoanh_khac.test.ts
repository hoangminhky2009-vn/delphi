/**
 * KHOẢNH KHẮC ĐÃ CHẠM (16/08, tầng 1) — hàm thuần. Vector chép tay.
 *
 * Ba tính chất phải khoá, không phải ba con số: (1) HỒI CỐ — chỉ nhặt mắt xích
 * CÓ trong dây chuyền; (2) IM khi không có gì; (3) sự kiện (short/chặn lỗ/dây
 * chuyền) đáng tên vì ĐÃ XẢY RA, còn lại phải qua ngưỡng.
 */
import { describe, expect, it } from 'vitest';
import {
  KHOANH_KHAC_IDS, NGUONG_DANG_GOI_TEN_BP, SO_KHOANH_KHAC_TOI_DA,
  khoanhKhacCuaMatXich, khoanhKhacCuaTran, soTayKhaiNiem,
} from '../server/holdem/khoanh_khac.js';
import type { MatXich } from '../server/holdem/engine.js';

const TS = (delta_bp: number, them: Partial<Extract<MatXich, { kind: 'tai_san' }>> = {}): MatXich =>
  ({ kind: 'tai_san', id: 'btc', delta_bp, giai_doan: 'tang', cap: 1, ...them });

describe('khoanhKhacCuaMatXich — ánh xạ kind → khái niệm', () => {
  it('xep_hang → trượt giá · crowding → chen chúc · nhan → đòn bẩy · short → bán khống', () => {
    expect(khoanhKhacCuaMatXich({ kind: 'xep_hang', id: 'btc', so_vao: 3, delta_bp: -80 })).toBe('truot_gia');
    expect(khoanhKhacCuaMatXich({ kind: 'crowding', id: 'btc', so_nguoi_dong: 4, delta_bp: -60 })).toBe('chen_chuc');
    expect(khoanhKhacCuaMatXich({ kind: 'nhan', id: 'don_bay', he_so_bp: 20000, delta_bp: 300 })).toBe('don_bay');
    expect(khoanhKhacCuaMatXich({
      kind: 'short', ma: 'btc', vong_dat: 2, nghich_dao_bp: 400, phi_bp: 150, delta_bp: 250,
    })).toBe('ban_khong');
    // v49 (D342) — dòng giá của SỔ KHỐNG cũng là "đã chạm bán khống".
    expect(khoanhKhacCuaMatXich({ kind: 'khong_gia', id: 'btc', gia_bp: -900, delta_bp: 900 })).toBe('ban_khong');
    expect(khoanhKhacCuaMatXich({ kind: 'chan_lo_san', truoc_san_bp: -900, san_bp: -500, delta_bp: 400 })).toBe('chan_lo');
    expect(khoanhKhacCuaMatXich({ kind: 'day_chuyen', tu: 'a', den: 'b', dung: false, delta_bp: -100 })).toBe('day_chuyen');
  });

  it('echo CHỈ khi bị ĐẢO (tin giả lộ) — dư âm thường không có tên riêng', () => {
    expect(khoanhKhacCuaMatXich({ kind: 'echo', id: 'btc', su_kien: 'bong_bong', delta_bp: -200, dao: true }))
      .toBe('tin_gia');
    expect(khoanhKhacCuaMatXich({ kind: 'echo', id: 'btc', su_kien: 'bong_bong', delta_bp: -200 }))
      .toBeNull();
  });

  it('tai_san CHỈ khi dải RẤT CĂNG (2) và chiều XẤU — dải 1 là thời tiết', () => {
    expect(khoanhKhacCuaMatXich(TS(-500, { cang_dai: 2, cang_bp: 300 }))).toBe('suc_cang');
    expect(khoanhKhacCuaMatXich(TS(-500, { cang_dai: 1, cang_bp: 100 }))).toBeNull();
    expect(khoanhKhacCuaMatXich(TS(+500, { cang_dai: 2, cang_bp: 300 })), 'chiều tốt không phải "vỡ"').toBeNull();
    expect(khoanhKhacCuaMatXich(TS(-500))).toBeNull();
  });

  it('những kind KHÔNG phải khoảnh khắc: khẩu vị · dao_phi · thưởng đa dạng', () => {
    expect(khoanhKhacCuaMatXich({ kind: 'khau_vi', id: 'can_bang', he_so_bp: 10000, delta_bp: 0 })).toBeNull();
    expect(khoanhKhacCuaMatXich({ kind: 'dao_phi', tu: 'btc', den: 'vang', delta_bp: -30 })).toBeNull();
    expect(khoanhKhacCuaMatXich({ kind: 'da_dang', so_ma: 4, delta_bp: 40 })).toBeNull();
  });
});

describe('khoanhKhacCuaTran — gom qua các vòng', () => {
  it('⭐ IM khi không có gì — không bịa khoảnh khắc cho có', () => {
    expect(khoanhKhacCuaTran([])).toEqual([]);
    expect(khoanhKhacCuaTran([[TS(120)], [TS(-80)], []])).toEqual([]);
  });

  it('cú MẠNH NHẤT của mỗi khái niệm được giữ, kèm đúng VÒNG', () => {
    const kq = khoanhKhacCuaTran([
      [{ kind: 'crowding', id: 'btc', so_nguoi_dong: 3, delta_bp: -40 }],
      [{ kind: 'crowding', id: 'btc', so_nguoi_dong: 5, delta_bp: -120 }],
      [{ kind: 'crowding', id: 'vang', so_nguoi_dong: 2, delta_bp: -30 }],
    ]);
    expect(kq).toEqual([{ id: 'chen_chuc', vong: 2, delta_bp: -120 }]);
  });

  it('dưới NGƯỠNG thì không gọi tên (trừ khái niệm sự-kiện)', () => {
    const nho = NGUONG_DANG_GOI_TEN_BP - 1;
    expect(khoanhKhacCuaTran([[{ kind: 'xep_hang', id: 'btc', so_vao: 2, delta_bp: -nho }]]))
      .toEqual([]);
    // Bán khống hoà vốn (delta 0) VẪN đáng tên — lần đầu bán khống là một sự kiện.
    expect(khoanhKhacCuaTran([[{
      kind: 'short', ma: 'btc', vong_dat: 1, nghich_dao_bp: 0, phi_bp: 0, delta_bp: 0,
    }]])).toEqual([{ id: 'ban_khong', vong: 1, delta_bp: 0 }]);
  });

  it(`tối đa ${SO_KHOANH_KHAC_TOI_DA}, xếp theo |delta| giảm dần`, () => {
    const kq = khoanhKhacCuaTran([[
      { kind: 'xep_hang', id: 'btc', so_vao: 3, delta_bp: -90 },
      { kind: 'crowding', id: 'btc', so_nguoi_dong: 4, delta_bp: -60 },
      { kind: 'echo', id: 'btc', su_kien: 'bong_bong', delta_bp: -400, dao: true },
      { kind: 'nhan', id: 'don_bay', he_so_bp: 20000, delta_bp: 250 },
    ]]);
    expect(kq.map((k) => k.id)).toEqual(['tin_gia', 'don_bay', 'truot_gia']);
    expect(kq.length).toBe(SO_KHOANH_KHAC_TOI_DA);
  });

  it('delta không phải số (dữ liệu cũ hỏng) ⇒ bỏ qua, không nổ', () => {
    expect(khoanhKhacCuaTran([[{ kind: 'xep_hang', id: 'btc', so_vao: 1, delta_bp: NaN }]]))
      .toEqual([]);
  });

  it('mọi ID trong bảng đều là chuỗi id hợp lệ (bảng khai là nguồn cho client)', () => {
    expect(KHOANH_KHAC_IDS.length).toBeGreaterThanOrEqual(6);
    for (const id of KHOANH_KHAC_IDS) expect(id).toMatch(/^[a-z_]+$/);
  });
});

describe('soTayKhaiNiem — gom qua MỌI trận đã xong (tầng 3)', () => {
  const CROWD = (delta_bp: number): MatXich =>
    ({ kind: 'crowding', id: 'btc', so_nguoi_dong: 4, delta_bp });
  const SHORT = (delta_bp: number): MatXich =>
    ({ kind: 'short', ma: 'btc', vong_dat: 1, nghich_dao_bp: 0, phi_bp: 0, delta_bp });

  it('không trận ⇒ sổ trống; trận không mắt xích đáng tên ⇒ vẫn trống', () => {
    expect(soTayKhaiNiem([])).toEqual([]);
    expect(soTayKhaiNiem([{ luc: new Date('2026-08-01T00:00:00Z'), chains: [[TS(300)]] }]))
      .toEqual([]);
  });

  it('⭐ đếm SỐ TRẬN (không đếm số vòng), lần đầu = trận SỚM NHẤT, mạnh nhất qua mọi trận', () => {
    const so = soTayKhaiNiem([
      // trận 1: chen chúc ở hai vòng (chỉ tính MỘT trận), −40 rồi −120
      { luc: new Date('2026-08-01T00:00:00Z'), chains: [[CROWD(-40)], [CROWD(-120)]] },
      // trận 2: không có gì
      { luc: new Date('2026-08-02T00:00:00Z'), chains: [[TS(50)]] },
      // trận 3: chen chúc −90 + bán khống +30
      { luc: new Date('2026-08-03T00:00:00Z'), chains: [[CROWD(-90), SHORT(30)]] },
    ]);
    expect(so).toEqual([
      { id: 'chen_chuc', so_tran: 2, lan_dau: '2026-08-01T00:00:00.000Z',
        manh_nhat: { delta_bp: -120, vong: 2 } },
      { id: 'ban_khong', so_tran: 1, lan_dau: '2026-08-03T00:00:00.000Z',
        manh_nhat: { delta_bp: 30, vong: 1 } },
    ]);
  });

  it('cùng luật ngưỡng với màn kết — dưới ngưỡng không vào sổ (một hàm lọc, hai chỗ đọc)', () => {
    const nho = NGUONG_DANG_GOI_TEN_BP - 1;
    expect(soTayKhaiNiem([{ luc: null, chains: [[CROWD(-nho)]] }])).toEqual([]);
    // Khái niệm sự-kiện: vào sổ dù delta 0.
    expect(soTayKhaiNiem([{ luc: null, chains: [[SHORT(0)]] }])[0]).toMatchObject(
      { id: 'ban_khong', so_tran: 1, lan_dau: null });
  });

  it('xếp: nhiều trận nhất lên đầu, hoà thì cú nặng hơn', () => {
    const so = soTayKhaiNiem([
      { luc: null, chains: [[CROWD(-30), { kind: 'xep_hang', id: 'btc', so_vao: 3, delta_bp: -200 }]] },
    ]);
    expect(so.map((k) => k.id)).toEqual(['truot_gia', 'chen_chuc']);
  });
});
