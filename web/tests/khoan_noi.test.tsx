/**
 * D400 — LÃI/LỖ NỔI TỪNG KHOẢN (scrolling combat text) + TRƯỢT GIÁ THÀNH DÒNG RIÊNG MÀU CAM.
 *
 * Founder 24/09: *"… các text box chứa từng khoản "lãi/ lỗ" (Nhớ lưu ý màu sắc và số tiền lãi/lỗ phải trùng khớp với
 * phần lý do khi bấm vào xem chi tiết)"* và 23/09: *"slippage đang quá ẩn … Tách riêng dòng: Trượt giá: -X% (màu
 * đỏ/cam)"*. Bài canh ba điều: (1) hộp nổi và bảng VÌ SAO kể CÙNG danh sách, cùng màu, cùng số; (2) hàng hộp xếp
 * hàng đẩy nhau đúng nấc; (3) bước LÃI/LỖ của nhịp kết quả chờ đủ cho hàng hộp diễn xong mà cả chuỗi vẫn gọn
 * trong pha ĐỌC.
 */
import { afterEach, describe, expect, it, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { act, render } from '@testing-library/react';
import { ChainReveal } from '../src/components/holdem/ChainReveal';
import { KhoanNoi, NAC_KHOAN_NOI } from '../src/components/holdem/KhoanNoi';
import type { KetQuaVongDTO, MatXichDTO } from '../src/api/holdem';
import { khoanLaiLo, khoanNoiCuaVong } from '../src/lib/khoan_lai_lo';
import {
  KHOAN_NOI_TOI_DA, LAI_LO_KQ, lichKetQua, NHIP, thoiLuongKhoanNoi,
} from '../src/lib/nhip';

const TAI_SAN = [
  { id: 'btc', label: 'BTC', icon: '₿', nhom: 'rui_ro' as const, thanh_khoan: 'mong' as const, bien_dong_bp: 400 },
  { id: 'vang', label: 'Vàng', icon: '🥇', nhom: 'phong_thu' as const, thanh_khoan: 'vua' as const, bien_dong_bp: 240 },
];
const CHAIN: MatXichDTO[] = [
  { kind: 'tai_san', id: 'vang', delta_bp: 900, giai_doan: 'tang', cap: 1 },
  { kind: 'tai_san', id: 'btc', delta_bp: -1200, giai_doan: 'tang', cap: 1 },
];
const KQ: KetQuaVongDTO = {
  vong: 5, o: { kind: 'giai_doan', giai_doan: 'tang' }, tin_gia_lo: null, quy_vong: 2500,
  ghe_thang: 'ban', chay_vong_nay: [],
  cua_ban: {
    ghe_id: 'ban', pnl_bp: -300, da_cat_lo: false, cam_ket: 500, von_truoc: 6000, von_sau: 5400,
    chain: CHAIN, hanh_dong: 'giu_vi_the', da_hit: false,
    // Thứ tự khoá cố ý NGƯỢC thứ tự dây chuyền — bảng phải xếp theo dây chuyền (Vàng đáp trước).
    tien_theo_ma: { btc: -1234, vang: 870, 'khong:btc': 0 },
  },
  cua_doi_thu: [], phi_cua_ban: null, ty_le_cat_lo_bp: 0,
  cau_noi_nav: [{ id: 'phi_giao_dich', tien: -650 }, { id: 'nop_quy', tien: -500 }, { id: 'quy_vong', tien: 804 }],
};
const GOC = 10000;

afterEach(() => { vi.useRealTimers(); });

describe('I. Một nguồn danh sách khoản', () => {
  it('thứ tự = bảng VÌ SAO: mã theo dây chuyền, rồi cầu nối theo thứ tự server; trượt giá là loại riêng', () => {
    const ds = khoanLaiLo(KQ, TAI_SAN);
    expect(ds.map((k) => k.khoa)).toEqual(['vang', 'btc', 'khong:btc', 'cn:phi_giao_dich', 'cn:nop_quy', 'cn:quy_vong']);
    expect(ds.map((k) => k.loai)).toEqual(['lai', 'lo', 'lai', 'truot', 'lo', 'lai']);
    const truot = ds.find((k) => k.loai === 'truot')!;
    expect(truot.nhan).toMatch(/^Trượt giá/);
    expect(truot.nhanNgan).toBe('Trượt giá');
    expect(ds.every((k) => !/phi_giao_dich|nop_quy|quy_vong/.test(k.nhan + k.nhanNgan)), 'id thô lọt ra chữ').toBe(true);
  });

  it('nhãn ngắn dòng tiền mặt đi theo dấu (soi màn thật: "Tiền mặt −279" không nói tiền đi đâu)', () => {
    const kq = { ...KQ, cau_noi_nav: [{ id: 'trong_vong', tien: -279 }, { id: 'huy_so', tien: -40 }] };
    expect(khoanLaiLo(kq, TAI_SAN).find((k) => k.khoa === 'cn:trong_vong')!.nhanNgan).toBe('Lạm phát · phí giữ');
    const lai = { ...KQ, cau_noi_nav: [{ id: 'trong_vong', tien: 35 }] };
    expect(khoanLaiLo(lai, TAI_SAN).find((k) => k.khoa === 'cn:trong_vong')!.nhanNgan).toBe('Lãi tiền mặt');
  });

  it('hộp nổi: bỏ khoản 0; quá trần thì giữ khoản LỚN nhất theo thứ tự bảng + gộp đuôi, tổng đúng từng chip', () => {
    const ds = khoanLaiLo(KQ, TAI_SAN);
    expect(khoanNoiCuaVong(ds, 10).map((k) => k.khoa)).toEqual(['vang', 'btc', 'cn:phi_giao_dich', 'cn:nop_quy', 'cn:quy_vong']);
    // Trần 3 ⇒ giữ 2 khoản lớn nhất (BTC 1.234 · Vàng 870) theo thứ tự bảng, ba dòng cầu nối gộp thành "khác".
    const gon = khoanNoiCuaVong(ds, 3);
    expect(gon.map((k) => k.khoa)).toEqual(['vang', 'btc', 'khac']);
    expect(gon[2]!.tien).toBe(-650 - 500 + 804);
    const tong = (xs: readonly { tien: number }[]) => xs.reduce((a, k) => a + k.tien, 0);
    expect(tong(gon)).toBe(tong(ds));
  });
});

describe('II. Hộp nổi và bảng VÌ SAO nói CÙNG màu, CÙNG số (founder: "phải trùng khớp")', () => {
  it('⭐ mỗi hộp có đúng một dòng VÌ SAO cùng khoá · cùng loại màu · cùng chuỗi tiền', async () => {
    const { container: vs } = render(
      <ChainReveal kq={KQ} deltaVon={-600} nhip={{ delta: -710, goc: GOC }} taiSan={TAI_SAN} chienThuat={[]}
        giaiDoan={[{ id: 'tang', label: 'Tăng', icon: '📈' }]} suKien={[]} />,
    );
    vi.useFakeTimers();
    const khoan = khoanNoiCuaVong(khoanLaiLo(KQ, TAI_SAN), KHOAN_NOI_TOI_DA);
    const { container: noi } = render(<KhoanNoi khoan={khoan} goc={GOC} giamChuyenDong={false} />);
    act(() => { vi.advanceTimersByTime(NHIP.KHOAN_NOI_CACH * khoan.length); });
    const hop = [...noi.querySelectorAll('[data-khoan]')];
    expect(hop.length).toBe(khoan.length);
    for (const h of hop) {
      const dong = vs.querySelector(`[data-tien-theo-ma] [data-khoan="${h.getAttribute('data-khoan')}"]`);
      expect(dong, `bảng VÌ SAO thiếu dòng ${h.getAttribute('data-khoan')}`).not.toBeNull();
      expect(dong!.getAttribute('data-loai')).toBe(h.getAttribute('data-loai'));
      expect(dong!.querySelector('b')!.textContent).toBe(h.querySelector('b')!.textContent);
      // MÀU THẬT đi bằng lớp: hộp mang lớp đúng tên loại; dòng VÌ SAO mang lớp tương ứng (lãi pos · lỗ neg · trượt).
      const loai = h.getAttribute('data-loai')!;
      const coLop = (el: Element, ten: string) => el.className.split(' ').some((c) => c.startsWith(`_${ten}_`));
      expect(coLop(h, loai), `hộp ${h.getAttribute('data-khoan')} thiếu lớp ${loai}`).toBe(true);
      const lopDong = { lai: 'pos', lo: 'neg', truot: 'truot' }[loai as 'lai' | 'lo' | 'truot'];
      expect(coLop(dong!, lopDong), `dòng ${h.getAttribute('data-khoan')} thiếu lớp ${lopDong}`).toBe(true);
    }
  });

  it('⭐ dòng trượt giá: chữ "Trượt giá", loại cam, kèm % NAV trước vòng ở CẢ hai nơi', async () => {
    const { container: vs } = render(
      <ChainReveal kq={KQ} deltaVon={-600} nhip={{ delta: -710, goc: GOC }} taiSan={TAI_SAN} chienThuat={[]}
        giaiDoan={[{ id: 'tang', label: 'Tăng', icon: '📈' }]} suKien={[]} />,
    );
    const dong = vs.querySelector('[data-khoan="cn:phi_giao_dich"]')!;
    expect(dong.getAttribute('data-loai')).toBe('truot');
    expect(dong.textContent).toMatch(/Trượt giá.*6,5%/);
    vi.useFakeTimers();
    const { container: noi } = render(
      <KhoanNoi khoan={khoanLaiLo(KQ, TAI_SAN).filter((k) => k.loai === 'truot')} goc={GOC} giamChuyenDong={false} />,
    );
    expect(noi.querySelector('[data-loai="truot"]')!.textContent).toMatch(/Trượt giá.*-.*650.*6,5%/);
  });
});

describe('III. Hàng hộp: vào lần lượt, hộp mới ĐẨY hộp cũ lên một nấc', () => {
  it('⭐ đếm hộp theo nhịp `KHOAN_NOI_CACH`, nấc = vị trí tính từ hộp mới nhất', () => {
    vi.useFakeTimers();
    const khoan = khoanNoiCuaVong(khoanLaiLo(KQ, TAI_SAN), KHOAN_NOI_TOI_DA);
    const { container } = render(<KhoanNoi khoan={khoan} goc={GOC} giamChuyenDong={false} />);
    const o = () => [...container.querySelectorAll<HTMLElement>('[data-khoan]')].map((h) => h.parentElement!);
    expect(o().length).toBe(1);
    expect(o()[0]!.style.transform).toBe('translate3d(0, 0px, 0)');
    act(() => { vi.advanceTimersByTime(NHIP.KHOAN_NOI_CACH); });
    expect(o().length).toBe(2);
    expect(o()[0]!.style.transform).toBe(`translate3d(0, ${-NAC_KHOAN_NOI}px, 0)`);
    expect(o()[1]!.style.transform).toBe('translate3d(0, 0px, 0)');
    act(() => { vi.advanceTimersByTime(NHIP.KHOAN_NOI_CACH * 10); });
    expect(o().length).toBe(khoan.length);
    expect(o()[0]!.style.transform).toBe(`translate3d(0, ${-(khoan.length - 1) * NAC_KHOAN_NOI}px, 0)`);
  });

  it('giảm chuyển động: không diễn hộp nào (con số vòng + bảng VÌ SAO đã chở trọn tin)', () => {
    const { container } = render(
      <KhoanNoi khoan={khoanLaiLo(KQ, TAI_SAN)} goc={GOC} giamChuyenDong />,
    );
    expect(container.querySelector('[data-khoan]')).toBeNull();
  });
});

describe('IV. Nhịp kết quả: bước LÃI/LỖ chờ đủ hàng hộp, cả chuỗi vẫn gọn trong pha ĐỌC (A11.26)', () => {
  it('⭐ dây nối màn trận: lịch nhận `soKhoan` từ CÙNG danh sách, hộp chỉ dựng ở bước LÃI/LỖ', () => {
    const man = readFileSync(resolve(process.cwd(), 'src/screens/holdem/AlphaDraftMatch.tsx'), 'utf8');
    expect(man).toMatch(/const khoanVong = kq \? khoanNoiCuaVong\(khoanLaiLo\(kq,[^\n]*\n\s*const soKhoan = khoanVong\.length;/);
    expect(man).toMatch(/lichKetQua\(\{ soGheNop, coTin, giamChuyenDong: itMotion, soKhoan, doiMoiTruong, \.\.\.\(traGiai \? \{ traGiai \} : \{\}\) \}\)/);
    expect(man).toMatch(/buocKq === 'lai_lo' && ketQuaCho\?\.tt\.ket_qua_vong && \(\s*<KhoanNoi/);
    expect(man).toMatch(/khoan=\{khoanNoiCuaVong\(khoanLaiLo\(ketQuaCho\.tt\.ket_qua_vong,/);
  });

  const buoc = (l: ReturnType<typeof lichKetQua>, b: string) => l.find((x) => x.buoc === b)!;

  it('⭐ bước LÃI/LỖ = max(nhịp số cũ, thời lượng hàng hộp)', () => {
    expect(buoc(lichKetQua({ coTin: false, giamChuyenDong: false }), 'lai_lo').ms).toBe(LAI_LO_KQ);
    expect(buoc(lichKetQua({ coTin: false, giamChuyenDong: false, soKhoan: 1 }), 'lai_lo').ms)
      .toBe(Math.max(LAI_LO_KQ, thoiLuongKhoanNoi(1)));
    const l = lichKetQua({ coTin: false, giamChuyenDong: false, soKhoan: 5 });
    expect(buoc(l, 'lai_lo').ms).toBeGreaterThanOrEqual(thoiLuongKhoanNoi(5));
    expect(thoiLuongKhoanNoi(5)).toBe(4 * NHIP.KHOAN_NOI_CACH + NHIP.KHOAN_NOI_SONG);
    // Quá trần thì hộp đuôi đã gộp — thời lượng không mọc thêm.
    expect(thoiLuongKhoanNoi(40)).toBe(thoiLuongKhoanNoi(KHOAN_NOI_TOI_DA));
  });

  it('⭐ ca dài nhất (tin + chia quỹ + đủ trần hộp) vẫn dưới 15 s pha ĐỌC', () => {
    const l = lichKetQua({ soGheNop: 8, coTin: true, giamChuyenDong: false, soKhoan: 99 });
    const cuoi = l[l.length - 1]!;
    expect(cuoi.batDau + cuoi.ms).toBeLessThan(15_000);
  });

  it('giảm chuyển động: giữ thứ tự, mọi bước 0 ms (kể cả khi có hộp)', () => {
    expect(lichKetQua({ coTin: true, giamChuyenDong: true, soKhoan: 6 }).every((x) => x.ms === 0)).toBe(true);
  });
});
