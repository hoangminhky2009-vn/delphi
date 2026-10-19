/**
 * MẮT XÍCH CỦA LÁ — bộ nhận diện cho style nổi bật trong VÌ SAO (founder
 * 08/08 lần 2: bỏ mục riêng, dòng của lá ăn màu như dòng Đòn Bẩy).
 * Vector tay: thêm kind mới cho lá mà quên khai ở đây là dòng đó về màu
 * thường — bài này đỏ trước khi mắt người kịp thấy.
 */
import { describe, expect, it } from 'vitest';
import type { MatXichDTO } from '@/api/holdem';
import { laCuaMatXich } from '@/lib/tra_cong';

describe('laCuaMatXich', () => {
  it('⭐ mắt xích của lá trả đúng id lá — bảng chép tay đủ các kind', () => {
    const vector: Array<[MatXichDTO, string]> = [
      [{ kind: 'nhan', id: 'don_bay', he_so_bp: 20000, delta_bp: 1500 } as MatXichDTO, 'don_bay'],
      [{ kind: 'hoan_truot', id: 'btc', so_nguoi_dong: 3, delta_bp: 240 } as MatXichDTO, 'khop_nhanh'],
      [{ kind: 'dac_quyen', id: 'khop_nhanh', ly_do: 'xep_hang', delta_bp: 160 } as MatXichDTO, 'khop_nhanh'],
      [{ kind: 'phong_thu', id: 'phong_ho', an: false, delta_bp: -150 } as MatXichDTO, 'phong_ho'],
      [{ kind: 'day_chuyen', tu: 'bong_bong', den: 'btc', dung: true, delta_bp: 300 } as MatXichDTO, 'luot_song'],
      [{ kind: 'chan_lo_san', truoc_san_bp: -4000, san_bp: -2500, delta_bp: 1500 } as MatXichDTO, 'chan_lo'],
      [{ kind: 'short', ma: 'vang', vong_dat: 2, nghich_dao_bp: 700, phi_bp: 150, delta_bp: 550 } as MatXichDTO, 'phong_ho'],
      [{ kind: 'da_dang', so_ma: 4, delta_bp: 90 } as MatXichDTO, 'da_dang_hoa'],
    ];
    for (const [mx, la] of vector) expect(laCuaMatXich(mx)).toBe(la);
  });

  it('mắt xích CẶP trả cả hai tên — không gán bừa cho một lá', () => {
    const mx = { kind: 'cong_huong', cap: ['chan_lo', 'phong_ho'], delta_bp: 300 } as MatXichDTO;
    expect(laCuaMatXich(mx)).toEqual(['chan_lo', 'phong_ho']);
  });

  it('mắt xích thị trường/hệ thống ⇒ null (dòng giữ màu thắng/thua thường)', () => {
    const thiTruong = [
      { kind: 'tai_san', id: 'vang', delta_bp: -500, giai_doan: 'giam', cap: 1 },
      { kind: 'echo', id: 'btc', su_kien: 'bong_bong', delta_bp: 900 },
      { kind: 'crowding', id: 'vang', delta_bp: -120, so_nguoi_dong: 4 },
      { kind: 'khau_vi', id: 'can_bang', he_so_bp: 10000, delta_bp: 0 },
    ] as MatXichDTO[];
    for (const mx of thiTruong) expect(laCuaMatXich(mx)).toBeNull();
  });
});
