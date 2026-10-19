/**
 * SỔ TAY KHÁI NIỆM (16/08, tầng 3) — trang Tài chính cá nhân.
 *
 * Ba câu: (1) CÓ ĐƯỜNG CHẠY TỚI KHÔNG — render qua route thật `/tai-chinh`
 * với `/holdem/me/so-tay` stub; (2) IM khi chưa xong trận nào; (3) chưa chạm
 * thì vẽ MỜ chứ không ẩn, và không một chữ kê đơn (tự điển đã có bài quét
 * riêng ở khoanh_khac.test.tsx — đây chỉ canh chữ RIÊNG của khối).
 * (4) 13/09 — ALBUM: mặc định chỉ tám ô, không một đoạn văn; chữ (ngoài đời · số trận · chú
 * thích) nằm sau MỘT cú chạm, và tấm chi tiết mở dưới đúng HÀNG của ô vừa chạm.
 */
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, screen, render } from '@testing-library/react';
import { ME_ONBOARDED, renderAt, stubFetch } from './helpers';
import { CHU_SO_TAY, SoTayKhaiNiem } from '../src/components/SoTayKhaiNiem';
import { KHOANH_KHAC_IDS } from '@server/holdem/khoanh_khac_ids';
import { THE_KHOANH_KHAC, TU_KE_DON } from '../src/lib/khoanh_khac';

afterEach(() => { cleanup(); vi.unstubAllGlobals(); });

const HO_SO_TRONG = {
  tinh_cach: 'dang_dinh_hinh', n_vong: 0, n_tran: 0, brier_chuoi: [],
  chi_so: {
    hieu_chinh: { brier_tb: null, xu_huong: null, n: 0 },
    duoi_gia: { ty_le: null, n: 0 }, theo_tin: { ty_le: null, phan_tin_gia: null, n: 0 },
    chot_non: { lech: null, n: 0 }, don_von: { nen_bp: null, sau_thang_x: null, sau_thua_x: null, n: 0 },
    mua_tin: { ty_le: null, n: 0 },
  },
};

const SO_TAY = {
  so_tran: 4,
  khai_niem: [
    { id: 'tin_gia', so_tran: 3, lan_dau: '2026-08-10T03:00:00.000Z',
      manh_nhat: { delta_bp: -3120, vong: 6 } },
    { id: 'chen_chuc', so_tran: 2, lan_dau: '2026-08-11T03:00:00.000Z',
      manh_nhat: { delta_bp: -720, vong: 3 } },
  ],
};

describe('trang /tai-chinh có sổ tay (đường chạy thật)', () => {
  it('⭐ đã chạm 2/8 ⇒ khối hiện, đếm đúng, khái niệm chưa chạm vẽ MỜ chứ không ẩn', async () => {
    stubFetch([
      ['/auth/me', { status: 200, body: ME_ONBOARDED }],
      ['/holdem/me/tinh-cach', { status: 200, body: HO_SO_TRONG }],
      ['/holdem/me/so-tay', { status: 200, body: SO_TAY }],
      ['/me/dong-token', { status: 200, body: { dong: [] } }],
    ]);
    renderAt('/ho-so/the');
    expect(await screen.findByText('SỔ TAY KHÁI NIỆM')).toBeInTheDocument();
    expect(screen.getByTestId('dem-khai-niem').textContent).toBe(`2/${KHOANH_KHAC_IDS.length} đã chạm`);
    // Ô đã chạm mang cú nặng nhất ngay trên mặt ô.
    expect(screen.getByText('−31,2%')).toBeInTheDocument();
    // Chưa chạm: VẪN có mặt (ô mờ, có tên) — không ẩn.
    expect(document.querySelectorAll('[data-cham="0"]').length).toBe(KHOANH_KHAC_IDS.length - 2);
    expect(screen.getByText('BÁN KHỐNG')).toBeInTheDocument();
    // Số trận + lần đầu (dd/mm) nằm trong tấm chi tiết — chạm ô mới mở.
    fireEvent.click(screen.getByTestId('kn-tin_gia'));
    expect(screen.getByText(/3 trận · lần đầu 10\/08 · nặng nhất/)).toBeInTheDocument();
  });

  it('⭐ 12/09 — SỔ LIÊN HỆ là chỗ đọc thứ hai: có `lien_he` + catalog ⇒ hàng đã gặp có chấm, hàng chưa gặp mờ', async () => {
    stubFetch([
      ['/auth/me', { status: 200, body: ME_ONBOARDED }],
      ['/holdem/me/tinh-cach', { status: 200, body: HO_SO_TRONG }],
      ['/holdem/me/so-tay', {
        status: 200,
        body: {
          ...SO_TAY,
          lien_he: [{
            id: 'cam_van', tinh_chat: 'hoang_loan', so_lan: 2, so_lan_gia: 0,
            lan_dau: '2026-09-12T02:00:00.000Z',
            dau: [
              { ma: 'btc', dau: -1 }, { ma: 'cp_cn', dau: -1 }, { ma: 'vn30', dau: -1 },
              { ma: 'vang', dau: 1 }, { ma: 'usd', dau: 1 }, { ma: 'tpcp', dau: -1 },
            ],
          }],
        },
      }],
      ['/holdem/catalog', {
        status: 200,
        body: {
          su_kien: [{ id: 'cam_van', label: 'Cấm vận', icon: '⛓' }, { id: 'bong_bong', label: 'Bong bóng', icon: '🫧' }],
          tai_san: [
            { id: 'btc', label: 'Crypto' }, { id: 'cp_cn', label: 'Cổ tech' }, { id: 'vn30', label: 'Blue-chip' },
            { id: 'vang', label: 'Vàng' }, { id: 'usd', label: 'Stablecoin' }, { id: 'tpcp', label: 'Trái phiếu' },
          ],
        },
      }],
      ['/me/dong-token', { status: 200, body: { dong: [] } }],
    ]);
    renderAt('/ho-so/the');
    expect(await screen.findByText('SỔ LIÊN HỆ')).toBeInTheDocument();
    expect(screen.getByText('đã gặp 1/2 · quen 0'.replace(' · quen 0', ''))).toBeInTheDocument();
    const hang = document.querySelector<HTMLElement>('[data-mat="cam_van"]')!;
    expect(hang.dataset['bac']).toBe('2');
    expect(hang.textContent).toContain('×2');
    const chua = document.querySelector<HTMLElement>('[data-mat="bong_bong"]')!;
    expect(chua.textContent).toContain('chưa gặp');
    expect(chua.querySelectorAll('i').length).toBe(0);
  });

  it('⭐ chưa xong trận nào ⇒ khối IM (không sổ trống toàn "chưa chạm")', async () => {
    stubFetch([
      ['/auth/me', { status: 200, body: ME_ONBOARDED }],
      ['/holdem/me/tinh-cach', { status: 200, body: HO_SO_TRONG }],
      ['/holdem/me/so-tay', { status: 200, body: { so_tran: 0, khai_niem: [] } }],
      ['/me/dong-token', { status: 200, body: { dong: [] } }],
    ]);
    renderAt('/ho-so/the');
    await screen.findByText(/không phải lời khuyên cho/);
    expect(screen.queryByText('SỔ TAY KHÁI NIỆM')).toBeNull();
    expect(screen.queryByText('chưa chạm')).toBeNull();
  });

  it('API cũ chưa có endpoint (404) ⇒ trang vẫn dựng, không khối, không nổ', async () => {
    stubFetch([
      ['/auth/me', { status: 200, body: ME_ONBOARDED }],
      ['/holdem/me/tinh-cach', { status: 200, body: HO_SO_TRONG }],
      ['/holdem/me/so-tay', { status: 404, body: { error: 'not_found' } }],
      ['/me/dong-token', { status: 200, body: { dong: [] } }],
    ]);
    renderAt('/ho-so/the');
    await screen.findByText(/không phải lời khuyên cho/);
    expect(screen.queryByText('SỔ TAY KHÁI NIỆM')).toBeNull();
  });
});

describe('<SoTayKhaiNiem> — chữ riêng của khối', () => {
  it('KHÔNG KÊ ĐƠN: mọi chữ trong khối (kể cả chú thích và nhãn) không có từ khuyên bảo', () => {
    const { container } = render(<SoTayKhaiNiem so={SO_TAY as never} />);
    // Chữ sau `!` không có trong DOM khi đóng ⇒ quét cả bảng chữ của khối, không chỉ DOM.
    const chu = ` ${[container.textContent ?? '', ...Object.values(CHU_SO_TAY)].join(' ').toLowerCase()} `;
    for (const tu of TU_KE_DON) {
      expect(chu.includes(tu), `khối chứa từ kê đơn "${tu.trim()}"`).toBe(false);
    }
  });

  it('ID lạ từ API mới hơn ⇒ bỏ qua, không nổ; đếm chỉ tính ID có trong tự điển', () => {
    render(<SoTayKhaiNiem so={{
      so_tran: 1,
      khai_niem: [{ id: 'khai_niem_moi', so_tran: 1, lan_dau: null, manh_nhat: { delta_bp: 1, vong: 1 } }],
    } as never} />);
    expect(screen.getByTestId('dem-khai-niem').textContent).toBe(`0/${KHOANH_KHAC_IDS.length} đã chạm`);
    expect(screen.queryByText(/khai_niem_moi/)).toBeNull();
  });

  it('lần đầu null (trận không mốc) ⇒ không vẽ "lần đầu", vẫn vẽ số trận và cú nặng nhất', () => {
    render(<SoTayKhaiNiem so={{
      so_tran: 1,
      khai_niem: [{ id: 'ban_khong', so_tran: 1, lan_dau: null, manh_nhat: { delta_bp: 250, vong: 2 } }],
    } as never} />);
    expect(screen.getByText('2,5%')).toBeInTheDocument();
    fireEvent.click(screen.getByTestId('kn-ban_khong'));
    expect(screen.getByText(/1 trận · nặng nhất/)).toBeInTheDocument();
    expect(screen.queryByText(/lần đầu/)).toBeNull();
  });
});

describe('<SoTayKhaiNiem> — 13/09 album: nhìn trước, chữ sau một cú chạm', () => {
  it('⭐ mặc định KHÔNG một đoạn văn: không câu ngoài đời nào, không chú thích — chỉ tám ô', () => {
    const { container } = render(<SoTayKhaiNiem so={SO_TAY as never} />);
    expect(container.querySelectorAll('[data-testid^="kn-"]')).toHaveLength(KHOANH_KHAC_IDS.length);
    for (const id of KHOANH_KHAC_IDS) {
      expect(container.textContent, id).not.toContain(THE_KHOANH_KHAC[id].ngoai_doi);
    }
    expect(container.textContent).not.toContain(CHU_SO_TAY.giai);
    expect(screen.queryByTestId('giai-khai-niem')).toBeNull();
  });

  it('⭐ chạm ô ⇒ MỘT tấm ngay dưới HÀNG của ô ấy; chạm ô hàng khác ⇒ tấm dời theo; chạm lại ⇒ đóng', () => {
    const { container } = render(<SoTayKhaiNiem so={SO_TAY as never} />);
    const luoi = container.querySelector('ul')!;
    const o = [...container.querySelectorAll<HTMLElement>('[data-testid^="kn-"]')].map((b) => b.dataset['testid']);
    const sauHang = (id: string) => Math.min(o.length, (Math.floor(o.indexOf(`kn-${id}`) / 4) + 1) * 4);

    fireEvent.click(screen.getByTestId('kn-tin_gia'));
    let tam = screen.getByTestId('giai-khai-niem');
    expect([...luoi.children].indexOf(tam)).toBe(sauHang('tin_gia'));
    expect(tam.textContent).toContain(THE_KHOANH_KHAC.tin_gia.ngoai_doi);

    expect(o.indexOf('kn-ban_khong')).toBeGreaterThanOrEqual(4); // hàng thứ hai — bài này đo được cú dời
    fireEvent.click(screen.getByTestId('kn-ban_khong'));
    expect(screen.getAllByTestId('giai-khai-niem')).toHaveLength(1);
    tam = screen.getByTestId('giai-khai-niem');
    expect([...luoi.children].indexOf(tam)).toBe(sauHang('ban_khong'));
    expect(tam.textContent).toContain(CHU_SO_TAY.chuaCham);
    expect(tam.textContent).toContain(THE_KHOANH_KHAC.ban_khong.ngoai_doi);

    fireEvent.click(screen.getByTestId('kn-ban_khong'));
    expect(screen.queryByTestId('giai-khai-niem')).toBeNull();
  });

  it('`!` ở nhãn ⇒ chú thích của sổ hiện; bấm lại ⇒ ẩn', () => {
    render(<SoTayKhaiNiem so={SO_TAY as never} />);
    fireEvent.click(screen.getByRole('button', { name: CHU_SO_TAY.hoi }));
    expect(screen.getByText(CHU_SO_TAY.giai)).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: CHU_SO_TAY.hoi }));
    expect(screen.queryByText(CHU_SO_TAY.giai)).toBeNull();
  });
});
