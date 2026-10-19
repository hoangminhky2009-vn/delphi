/**
 * D43 — ĐƯỜNG ĐỌC CỦA MÁY TRẠNG THÁI trên bản đồ thị trường (bất biến 8.4).
 *
 * Render TRỌN bàn đấu qua route thật (bẫy "component đẹp nhưng không ai
 * render" — đã gặp 9 lần): kỳ họp phải NÓI TRƯỚC ở ô úp, cặp kỳ vọng/thực
 * phải hiện khi ô lịch ngửa, và chuỗi xu hướng phải có mặt vô điều kiện
 * (D26/R1 — không accordion, không tooltip).
 */
import { describe, expect, it } from 'vitest';
import { screen } from '@testing-library/react';
import { ME_ONBOARDED, renderAt, stubFetch } from './helpers';

const CATALOG = {
  engine_version: 'holdem-test-lich',
  luat: {
    SEATS: 5, START_VON: 10000, CAM_KET_NEN: 500, MAX_TAI_SAN: 4,
    MAX_CHIEN_THUAT: 2, SHOP_TAI_SAN: 3, SHOP_CHIEN_THUAT: 2,
    CHI_PHI_KHAO_SAT_LAI: 2, TRAN_TANG_CAM_KET_BP: 4000, PHI_BANG_DIEN_TU: 25,
  },
  nhip_chon_bai: ['tai_san', 'tai_san', 'chien_thuat', 'tai_san', 'tai_san',
    'chien_thuat', 'khong', 'khong'],
  cap_stack_bp: [10000, 16000, 20000],
  quyet_dinh: { MAP_SIZE: 8, SHOWDOWN_MODEL: 'A' },
  tai_san: [
    { id: 'btc', label: 'BTC', icon: '₿', nhom: 'rui_ro', thanh_khoan: 'mong', bien_dong_bp: 400 },
  ],
  chien_thuat: [],
  giai_doan: [{ id: 'di_ngang', label: 'Đi ngang', icon: '➖' }],
  su_kien: [],
  tu_dien: { tai_san: {}, chien_thuat: {} },
  khau_vi: [],
};

const tran = (patch: Record<string, unknown> = {}) => ({
  match_id: 'm-lich',
  vong: 4,
  tong_vong: 8,
  status: 'dang_choi',
  dong_ho: { con_lai_s: 21, tong_s: 25, het_gio: false, an_han_s: 8 },
  ban: {
    von: 9000, luot_khao_sat: 1,
    danh_muc: { tai_san: ['btc'], chien_thuat: [] },
    da_chay: false, tu_the: 'choi', vong_roi: null,
    so_lan_cat_lo: 0, con_lai_cat_lo: 1, khau_vi: 'can_bang', fx: 'binh_thuong',
  },
  doi_thu: [],
  so_nguoi_song: 1,
  o_hien_tai: { kind: 'giai_doan', giai_doan: 'di_ngang' },
  lich_su_o: [],
  telegraph: null,
  bo_bai_con_lai: { con_lai: 4, so_giai_doan: 3, so_su_kien: 1, tin_gia_ky_vong: 0 },
  quy_vong_hien_tai: 500,
  shop: null,
  loi_von: null,
  ...patch,
});

function moBan(patch: Record<string, unknown>): void {
  stubFetch([
    ['/auth/me', { status: 200, body: ME_ONBOARDED }],
    ['/holdem/catalog', { status: 200, body: CATALOG }],
    ['/holdem/art', { status: 200, body: { version: 'holdem-test-lich', art: {} } }],
    ['/holdem/matches/m-lich/luot',
      { status: 200, body: { cho_ban: null, xong_vong: true, nhat_ky: [] } }],
    ['/holdem/matches/m-lich', { status: 200, body: tran(patch) }],
  ]);
}

describe('bản đồ thị trường — đường đọc D43 qua route thật', () => {
  it('ô ÚP là kỳ họp → NÓI TRƯỚC "KỲ HỌP"; chuỗi xu hướng lên CHÍNH Ô, không còn hộp chữ', async () => {
    moBan({
      vong: 2,
      bo_bai_con_lai: { con_lai: 6, so_giai_doan: 4, so_su_kien: 2, tin_gia_ky_vong: 1 },
      o_lich: [4],
      xu_huong: { huong: 1, dai: 3 },
    });
    renderAt('/arena/tran/m-lich');
    await screen.findByText(/còn \d+ ô/);
    // Ô 4 còn úp nhưng lịch họp là luật công khai — phải thấy từ vòng 2.
    expect(await screen.findByText('KỲ HỌP')).toBeInTheDocument();
    /*
     * 13/09 — hộp "Chuỗi ĐI LÊN ×3 đang chạy…" ĐÃ BỎ (founder: "thừa thãi" — dãy ô
     * đã lật tự kể chuỗi). Chiều chuỗi nay là thuộc tính trên khung bản đồ, CSS
     * vẽ gạch màu ở chân ô đang lật. Bài này canh dữ liệu vẫn tới đúng chỗ, và
     * chữ cũ không quay lại.
     */
    expect(document.querySelector('[data-xu-huong]')?.getAttribute('data-xu-huong')).toBe('len');
    expect(screen.queryByText(/quán tính/)).toBeNull();
  });

  /*
   * 13/09 tối — CẶP KỲ VỌNG/THỰC RỜI HỘP CHỮ, LÊN CHÍNH Ô. Founder: *"đừng thêm mấy
   * phần chú thích trực tiếp ra màn hình như thế"* (cùng lệnh đã gỡ hộp chuỗi xu hướng
   * và hộp telegraph hồi chiều). Hợp đồng mới: ô kỳ họp mang `data-chinh-sach`, hai nhãn
   * ngắn KỲ VỌNG ▸ THỰC nằm trên ô, còn câu dài ở `title`/`aria-label` — đọc khi muốn.
   * Bài vẫn canh ĐÚNG thông tin cũ, chỉ đổi chỗ nó phải có mặt.
   */
  it('ô lịch đang ngửa → cặp kỳ vọng/thực NẰM TRÊN Ô; lệch thì ô mang dấu, câu dài ở title', async () => {
    moBan({
      o_lich: [4],
      chinh_sach: { ky_vong: 'ha', thuc: 'giu' },
    });
    renderAt('/arena/tran/m-lich');
    // Số ô mang dấu kỳ họp ngay trên timeline.
    expect(await screen.findByText('⚖ 4')).toBeInTheDocument();
    const o = document.querySelector('[data-chinh-sach]');
    expect(o, 'ô kỳ họp không mang dấu chính sách').not.toBeNull();
    expect(o!.getAttribute('data-chinh-sach')).toBe('lech');
    // Hai nhãn ngắn nằm TRONG ô, không phải một hộp chữ riêng dưới bản đồ.
    expect(o!.textContent).toContain('HẠ');
    expect(o!.textContent).toContain('GIỮ');
    expect(o!.getAttribute('title')).toMatch(/HẠ LÃI SUẤT/);
    expect(o!.getAttribute('title')).toMatch(/GIỮ NGUYÊN/);
    expect(o!.getAttribute('title')).toMatch(/sai lầm chính sách/);
    // ⚠ Và câu ấy KHÔNG được quay lại thành chữ trần trên màn.
    expect(screen.queryByText(/công thức phản ứng/)).toBeNull();
  });

  /*
   * D302 — ĐÁM ĐÔNG ĐỔI Ô lộ ex-post trên bản đồ (luật 03 §3). Ô đã lật mang
   * `doi` thì chân ô nói ĐÃ ĐỔI ↺ và tooltip kể ô đáng lẽ là gì; ô đang mở KHÔNG
   * BAO GIỜ mang dấu — dù cùng pha với ô vừa bị đổi.
   */
  it('ô đã lật từng bị đám đông đổi: chân ô ĐÃ ĐỔI ↺ + tooltip kể ô cũ; ô đang mở thì không', async () => {
    moBan({
      vong: 3,
      lich_su_o: [
        { kind: 'giai_doan', giai_doan: 'di_ngang' },
        {
          kind: 'giai_doan', giai_doan: 'giam',
          doi: { boi: 'phan_than', tu: 'di_ngang', den: 'giam', vi: 'don' },
        },
      ],
      o_hien_tai: { kind: 'giai_doan', giai_doan: 'giam' },
    });
    renderAt('/arena/tran/m-lich');
    expect(await screen.findByText('ĐÃ ĐỔI ↺')).toBeInTheDocument();
    expect(screen.getAllByText('ĐÃ QUA ✓')).toHaveLength(1);
    const oDoi = document.querySelectorAll('[data-doi]');
    expect(oDoi).toHaveLength(1);
    expect(oDoi[0]!.getAttribute('data-doi')).toBe('phan_than');
    expect(oDoi[0]!.getAttribute('title')).toMatch(/đáng lẽ là "Đi ngang"/);
    expect(oDoi[0]!.getAttribute('title')).toMatch(/dồn vào rủi ro hai vòng liền/);
    expect(screen.getByText('HIỆN TẠI ↗').closest('[data-doi]')).toBeNull();
  });
});
