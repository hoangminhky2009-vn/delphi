/**
 * ORACLE NÓI — lõi thuần + gắn lên Hub.
 *  · ưu tiên: mời → giục đúng thứ thiếu → khen/khịa từ chỉ số;
 *  · A10: không kê đơn ở mọi giọng, mọi hạt;
 *  · §1.2: khen/khịa KHÔNG chạm khẩu vị (dồn/rải/để dành/tiền mặt);
 *  · Hub render câu đúng loại, bấm lần 1 tua, lần 2 đi đúng đích.
 */
import { describe, expect, it, vi } from 'vitest';
import { fireEvent, screen } from '@testing-library/react';
import type { HoSoGoi } from '@server/hanh_vi/goi';
import { loiOracle, type LoaiLoi } from '../src/lib/loi_oracle';
import { TU_KE_DON } from '../src/lib/khoanh_khac';
import { ME_ONBOARDED, renderAt, stubFetch } from './helpers';

const GIONG = ['tre', 'vua', 'chung'] as const;
const RONG: HoSoGoi['chi_so'] = {
  hieu_chinh: null, duoi_gia: null, theo_tin: null, chot_non: null, don_von: null, mua_tin: null, khau_vi: null,
};
const td = (tran: number, vong_quyet: number, vong_su_kien: number) => ({
  tran, vong_quyet, vong_su_kien, can: { tran: 10, vong_quyet: 40, vong_su_kien: 8 },
  day: tran >= 10 && vong_quyet >= 40 && vong_su_kien >= 8,
});
const HS = (o: Partial<HoSoGoi> = {}): HoSoGoi => ({
  chi_so: RONG, tinh_cach: 'dang_dinh_hinh', khau_vi: null, net: null, bac_doc: 'chua',
  brier_chuoi: [], n_vong: 0, n_tran: 0, goi: null, tien_do: td(0, 0, 0), lich_su: [],
  lop_data: [], n_vong_thay_o: 0, ...o,
});
const CO_GOI = (o: Partial<HoSoGoi> = {}): HoSoGoi => HS({
  goi: { so: 1, tong: 1 }, tinh_cach: 'don_lanh', khau_vi: 'don', net: 'lanh', bac_doc: 'doc_duoc',
  n_vong: 80, n_tran: 10, tien_do: td(2, 10, 1),
  lich_su: [{ goi_so: 1, tinh_cach: 'don_lanh', n_tran: 10, computed_at: '2026-08-22T00:00:00Z' }],
  chi_so: { ...RONG, hieu_chinh: { brier_tb: 0.6, xu_huong: 0, n: 80 } },
  ...o,
});

describe('loiOracle — ưu tiên', () => {
  it('chưa có hồ sơ ⇒ MỜI, đích = chơi', () => {
    const l = loiOracle(null, 'tre', 0);
    expect(l.loai).toBe('moi'); expect(l.dich).toBe('choi'); expect(l.cau).toMatch(/bro/i);
  });
  it('chưa chơi gì ⇒ MỜI; mở trận rồi bỏ (n_vong>0, 0 trận xong) ⇒ GIỤC "chơi hết mới tính"', () => {
    expect(loiOracle(HS(), 'vua', 0).loai).toBe('moi');
    const l = loiOracle(HS({ n_vong: 5 }), 'vua', 0);
    expect(l.loai).toBe('giuc'); expect(l.cau).toMatch(/HẾT mới tính/);
  });
  it('6/10 trận ⇒ giục "còn 4 trận" (cả hai câu xoay theo hạt đều nói 4)', () => {
    const hs = HS({ n_vong: 48, tien_do: td(6, 42, 15) });
    for (const hat of [0, 1, 2]) {
      const l = loiOracle(hs, 'chung', hat);
      expect(l.loai).toBe('giuc'); expect(l.cau).toMatch(/4 ván|4 trận|còn 4/i); expect(l.dich).toBe('choi');
    }
  });
  it('đủ trận, thiếu vòng quyết ⇒ nói đồng hồ chốt hộ; đủ cả hai, thiếu sự kiện ⇒ nói vòng có tin', () => {
    expect(loiOracle(HS({ n_vong: 80, tien_do: td(10, 30, 9) }), 'vua', 0).cau).toMatch(/thiếu 10 vòng có quyết định/);
    expect(loiOracle(HS({ n_vong: 80, tien_do: td(10, 45, 5) }), 'vua', 0).cau).toMatch(/Thiếu 3 vòng có tin/);
  });
  it('có gói ⇒ khen/khịa từ chỉ số, đích = thẻ', () => {
    const lanh = loiOracle(CO_GOI(), 'tre', 0);
    expect(['khen', 'khia', 'ghi_nhan']).toContain(lanh.loai); expect(lanh.dich).toBe('the');
    // Bậc mắt thần ⇒ có câu khen ở hạt nào đó; đoán mò ⇒ có câu khịa.
    const khen = [0, 1, 2].map((h) => loiOracle(CO_GOI({ bac_doc: 'mat_than' }), 'vua', h));
    expect(khen.some((l) => l.loai === 'khen' && /tin nhắn/.test(l.cau))).toBe(true);
    const khia = [0, 1, 2].map((h) => loiOracle(CO_GOI({ bac_doc: 'doan_mo', net: 'ket_qua',
      chi_so: { ...RONG, don_von: { nen_bp: 2000, sau_thang_x: 1, sau_thua_x: 1.8, n: 10 } } }), 'vua', h));
    expect(khia.some((l) => /tung đồng xu/.test(l.cau))).toBe(true);
    expect(khia.some((l) => /gấp 1\.8/.test(l.cau)), 'khịa phải nói đúng số đã đo').toBe(true);
    const ngoai = loiOracle(CO_GOI({ net: 'ben_ngoai', bac_doc: 'chua' }), 'chung', 0);
    expect(ngoai.loai).toBe('khia'); expect(ngoai.cau).toMatch(/tin tức|đà giá/);
  });
  it('đổi thẻ giữa hai gói ⇒ ghi nhận, đọc tên cả hai thẻ', () => {
    const hs = CO_GOI({ bac_doc: 'chua', net: 'lanh', lich_su: [
      { goi_so: 1, tinh_cach: 'rai_ben_ngoai', n_tran: 10, computed_at: 'a' },
      { goi_so: 2, tinh_cach: 'don_lanh', n_tran: 10, computed_at: 'b' },
    ] });
    const ls = [0, 1, 2, 3].map((h) => loiOracle(hs, 'tre', h));
    expect(ls.some((l) => l.loai === 'ghi_nhan' && /ĂNG-TEN/.test(l.cau) && /MỘT PHÁT/.test(l.cau))).toBe(true);
  });
});

describe('loiOracle — luật chữ', () => {
  const cacHoSo: (HoSoGoi | null)[] = [
    null, HS(), HS({ n_vong: 3 }), HS({ n_vong: 48, tien_do: td(6, 42, 15) }),
    HS({ n_vong: 80, tien_do: td(10, 30, 9) }), HS({ n_vong: 80, tien_do: td(10, 45, 5) }),
    CO_GOI(), CO_GOI({ bac_doc: 'mat_than' }), CO_GOI({ bac_doc: 'doan_mo' }),
    CO_GOI({ chi_so: { ...RONG, hieu_chinh: { brier_tb: 0.7, xu_huong: -0.2, n: 80 } } }),
    CO_GOI({ chi_so: { ...RONG, hieu_chinh: { brier_tb: 0.7, xu_huong: 0.2, n: 80 } } }),
    CO_GOI({ net: 'ket_qua', chi_so: { ...RONG, don_von: { nen_bp: 2000, sau_thang_x: 1.7, sau_thua_x: 1.9, n: 10 }, chot_non: { lech: 0.4, ban_sau_xanh: 0.6, ban_sau_do: 0.2, n: 10 } } }),
    CO_GOI({ net: 'ket_qua' }), CO_GOI({ net: 'ben_ngoai' }),
    CO_GOI({ lich_su: [{ goi_so: 1, tinh_cach: 'de_danh_ket_qua', n_tran: 10, computed_at: 'a' }, { goi_so: 2, tinh_cach: 'rai_lanh', n_tran: 10, computed_at: 'b' }] }),
  ];
  const moiCau = (): { loai: LoaiLoi; cau: string }[] => {
    const ra: { loai: LoaiLoi; cau: string }[] = [];
    for (const hs of cacHoSo) for (const g of GIONG) for (let hat = 0; hat < 6; hat += 1) ra.push(loiOracle(hs, g, hat));
    return ra;
  };

  it('⭐ A10: không một câu nào kê đơn (mọi hồ sơ × 3 giọng × 6 hạt)', () => {
    for (const { cau } of moiCau()) {
      const th = ` ${cau.toLowerCase()} `;
      for (const tu of TU_KE_DON) expect(th.includes(tu), `"${cau}" có "${tu.trim()}"`).toBe(false);
    }
  });

  it('⭐ §1.2: khen/khịa KHÔNG chạm khẩu vị — không "dồn/rải/để dành/tiền mặt" trong câu khen/khịa', () => {
    for (const { loai, cau } of moiCau()) {
      if (loai !== 'khen' && loai !== 'khia') continue;
      expect(/dồn|rải|để dành|tiền mặt/i.test(cau), `"${cau}" chạm khẩu vị`).toBe(false);
    }
  });

  it('giọng trẻ có bro/meme ở mọi câu; giọng chững không "bro"', () => {
    for (const hs of cacHoSo) for (let hat = 0; hat < 3; hat += 1) {
      expect(/bro|🗿|💀|🙏|👀|🫡|🧠|📈|📉|🧊|🌋|🎈|🥒|📡|🎢|📶|🤔|🪙|👓/i.test(loiOracle(hs, 'tre', hat).cau)).toBe(true);
      expect(/\bbro\b/i.test(loiOracle(hs, 'chung', hat).cau)).toBe(false);
    }
  });
});

describe('Hub — Oracle nói (bong bóng nổi)', () => {
  it('6/10 trận ⇒ câu GIỤC giọng trẻ; bấm lần 1 tua hết, lần 2 sang Đấu trường', async () => {
    stubFetch([
      ['/auth/me', { status: 200, body: ME_ONBOARDED }],
      ['/holdem/me/tinh-cach', { status: 200, body: HS({ n_vong: 48, tien_do: td(6, 42, 15) }) }],
      ['/nhiem-vu', { status: 200, body: { lo_trinh: null, nhiem_vu: [] } }],
    ]);
    renderAt('/');
    // 11/10: Hub là màn bento — Oracle chỉ là avatar nhỏ trong ô giữ sẵn, BẤM mới bung lời (không còn tự bung đè nút VÀO TRẬN).
    fireEvent.click(await screen.findByTestId('oracle-head'));
    const chat = await screen.findByTestId('oracle-chat');
    expect(chat.getAttribute('data-loai')).toBe('giuc');
    const nut = screen.getByLabelText(/^Oracle:/);
    expect(nut.getAttribute('aria-label')).toMatch(/4 trận/);
    fireEvent.click(nut); // tua
    await vi.waitFor(() => expect(nut.textContent).toMatch(/vào chơi/i));
    fireEvent.click(nut); // đi — sang sảnh Đấu trường (Oracle NỔI nên vẫn còn đó)
    await vi.waitFor(() => expect(screen.queryAllByText(/ĐẤU VỚI MÁY|THỬ THÁCH HÔM NAY|MÀN TẬP/i).length).toBeGreaterThan(0));
  });
});
