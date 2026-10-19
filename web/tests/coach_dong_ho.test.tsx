/**
 * COACH NÓI ĐÚNG ĐỒNG HỒ ĐANG HIỆN (16/08 — founder: "Sửa và cho khớp").
 *
 * Trước đây bước `hud` tả một đồng hồ đang chạy trong khi mặt số ghi TẠM DỪNG
 * (D53). Lời phải RẼ theo trạng thái thật, số đọc từ catalog — không gõ tay.
 * (Nhánh "trận làm quen KHÔNG TÍNH GIỜ" từng có ở đây sáng 16/08 — founder bác
 * cùng chiều: miễn giờ CHỈ ở màn tập. Bài test của nhánh đó gỡ theo.)
 */
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { cleanup, fireEvent, screen } from '@testing-library/react';
import { cauDongHo, loiCuaBuoc, type BoiCanhTap } from '../src/components/holdem/CoachTap';
import { ME_ONBOARDED, renderAt, stubFetch } from './helpers';

afterEach(() => cleanup());

const NEN: BoiCanhTap = {
  vong: 1, shopMo: false, bangMo: false, shopChonMa: false, coKetQua: false,
  loaiVongNay: 'tai_san', xong: false, onMoShop: () => {},
};

describe('cauDongHo — hai nhánh, cùng kết bằng luật hết-giờ', () => {
  it('⭐ màn tập vòng ≤ 4 ⇒ nói TẠM DỪNG + "từ vòng 5" (D53), số từ catalog', () => {
    const c = cauDongHo({ ...NEN, vongTamDungDen: 4, vong: 1 });
    expect(c).toContain('TẠM DỪNG');
    expect(c).toContain('4 vòng dắt tay đầu');
    expect(c).toContain('từ vòng 5');
    expect(c).toContain('hết giờ máy chốt hộ');
  });

  it('không cờ nào (catalog cũ) ⇒ câu cũ: đồng hồ đang chạy — không bịa số', () => {
    const c = cauDongHo({ ...NEN });
    // 16/08 (ít chữ): câu ngắn lại, vẫn kết bằng luật hết-giờ, vẫn không bịa số.
    expect(c).toMatch(/^Từ giờ đồng hồ chạy — hết giờ/);
    expect(c).not.toMatch(/\d vòng/);
  });

  it('KHÔNG còn nhánh "KHÔNG TÍNH GIỜ" — luật 2 trận đã bị bác', () => {
    for (const vong of [1, 5]) {
      expect(cauDongHo({ ...NEN, vong, vongTamDungDen: 4 })).not.toContain('KHÔNG TÍNH GIỜ');
    }
  });
});

describe('loiCuaBuoc — chuỗi hay hàm đều giải về một chuỗi', () => {
  it('hàm nhận bối cảnh; chuỗi trả nguyên', () => {
    const b: BoiCanhTap = { ...NEN, vongTamDungDen: 4 };
    expect(loiCuaBuoc({ loi: (x) => `v${x.vong}` }, b)).toBe('v1');
    expect(loiCuaBuoc({ loi: 'chuỗi tĩnh' }, b)).toBe('chuỗi tĩnh');
  });
});

describe('trang HƯỚNG DẪN — câu đồng hồ tĩnh, khớp D53', () => {
  // D527 — bàn tập nhịp xen kẽ chỉ 5 vòng, nằm trọn trong ngưỡng miễn giờ ⇒ câu nói "bàn tập không chạy đồng hồ".
  it('nói "mỗi vòng có đồng hồ", BÀN TẬP không chạy đồng hồ; KHÔNG hứa trận nào miễn giờ', async () => {
    stubFetch([
      ['/auth/me', { status: 200, body: ME_ONBOARDED }],
    ]);
    renderAt('/arena/huong-dan');
    // Trang thu 10 mục vào <details>; nội dung vẫn nằm trong DOM.
    expect(await screen.findByText(/Mỗi vòng có đồng hồ/)).toBeInTheDocument();
    expect(screen.getByText(/Bàn tập\s+không chạy đồng hồ/)).toBeInTheDocument();
    expect(screen.queryByText(/trận đầu của bạn không tính giờ/)).toBeNull();
  });
});

describe('ĐƯỜNG CHẠY THẬT — bàn đấu ?tap=1, bước hud nói đúng đồng hồ', () => {
  /*
   * 11/10 — bài này đo THỨ TỰ BƯỚC và "bước cuối chờ tay", không đo tốc độ gõ (D416). Chữ chạy 28 ms / 2 chữ × năm bước nối nhau vẫn
   * vượt hạn chờ khi máy tải nặng (CI lô lo/20261011-1718 đỏ dù đã thử lại; chạy riêng trên master trần đỏ 2/3 lượt lúc các cửa sổ khác
   * cùng chạy). Bật GIẢM CHUYỂN ĐỘNG cho riêng khối này: CoachTap (`useChuChay(…, itMotion)`) hiện trọn lời ngay, giữ nguyên thứ tự
   * bước — mọi khẳng định bên dưới không đổi một chữ. Lối gõ chữ có chuyển động được canh ở bài CoachTap riêng.
   */
  let mmGoc: typeof window.matchMedia;
  beforeEach(() => {
    mmGoc = window.matchMedia;
    window.matchMedia = ((q: string) => ({ ...mmGoc(q), matches: q.includes('prefers-reduced-motion') })) as typeof window.matchMedia;
  });
  afterEach(() => { window.matchMedia = mmGoc; });
  const CATALOG = {
    engine_version: 'x', balance_version: 'x',
    luat: {
      SEATS: 5, START_VON: 10000, CAM_KET_NEN: 500, MAX_TAI_SAN: 4, MAX_CHIEN_THUAT: 2,
      SHOP_TAI_SAN: 3, SHOP_CHIEN_THUAT: 2, CHI_PHI_KHAO_SAT_LAI: 2, TRAN_TANG_CAM_KET_BP: 4000,
      PHI_BANG_DIEN_TU: 25,
    },
    nhip_chon_bai: ['tai_san', 'tai_san', 'chien_thuat', 'tai_san', 'tai_san', 'chien_thuat', 'khong', 'khong'],
    cap_stack_bp: [10000, 16000, 20000],
    quyet_dinh: { MAP_SIZE: 8, SHOWDOWN_MODEL: 'A', MAN_TAP_MIEN_GIO_DEN_VONG: 4 },
    tai_san: [{ id: 'btc', label: 'BTC', icon: '₿', nhom: 'rui_ro', thanh_khoan: 'mong', bien_dong_bp: 400 }],
    chien_thuat: [], giai_doan: [{ id: 'di_ngang', label: 'Đi ngang', icon: '➖' }], su_kien: [],
    tu_dien: { tai_san: {}, chien_thuat: {} }, khau_vi: [],
  };
  const tran = (dong_ho: Record<string, unknown>) => ({
    match_id: 'm-coach', vong: 1, tong_vong: 8, status: 'dang_choi', dong_ho,
    ban: {
      von: 10000, luot_khao_sat: 1, danh_muc: { tai_san: [], chien_thuat: [] }, da_chay: false,
      tu_the: 'choi', vong_roi: null, so_lan_cat_lo: 0, con_lai_cat_lo: 1, khau_vi: 'can_bang',
      fx: 'binh_thuong',
    },
    doi_thu: [], so_nguoi_song: 1, o_hien_tai: { kind: 'giai_doan', giai_doan: 'di_ngang' },
    lich_su_o: [], telegraph: null,
    bo_bai_con_lai: { con_lai: 7, so_giai_doan: 3, so_su_kien: 2, tin_gia_ky_vong: 1 },
    quy_vong_hien_tai: 500, shop: null, loi_von: null,
  });
  const moBan = (dong_ho: Record<string, unknown>) => stubFetch([
    ['/auth/me', { status: 200, body: ME_ONBOARDED }],
    ['/holdem/catalog', { status: 200, body: CATALOG }],
    ['/holdem/art', { status: 200, body: { version: 'x', art: {} } }],
    ['/holdem/matches/m-coach', { status: 200, body: tran(dong_ho) }],
  ]);
  /** Chờ lời coach chứa mẫu — TUA trước (lời dài gõ 28ms/2 chữ), đọc thẳng <p>. */
  const choLoi = async (mau: RegExp) => {
    const tua = screen.queryByText('TUA ▸▸');
    if (tua) fireEvent.click(tua);
    return screen.findByText(
      (_, el) => el?.tagName === 'P' && mau.test(el.textContent ?? ''), {}, { timeout: 4000 });
  };

  /*
   * 16/08 — HƯỚNG DẪN ÍT CHỮ: không còn bước `hud` ở vòng 1 (mặt số đang ghi TẠM
   * DỪNG ∞ tự nói đủ). Câu đồng hồ dời sang bước `dong-ho`, bắn đúng vòng đồng hồ bắt
   * đầu chạy (unit test `cauDongHo` ở trên khoá nội dung).
   * D336 (15/09) — trên bàn, dải ghế + mục tiêu trận nói TRƯỚC (hai bước đọc, có TIẾP),
   * rồi mới tới MỆNH LỆNH ngắn "Chạm SHOP" — bước ấy vẫn ≤ 12 từ và CHỜ TAY.
   */
  it('⭐ màn tập: dải ghế → mục tiêu → "Chạm SHOP" ngắn, chờ tay; không hứa miễn giờ trận nào', async () => {
    moBan({ con_lai_s: 25, tong_s: 25, het_gio: false, an_han_s: 8, tam_dung: true, ly_do: 'man_tap' });
    renderAt('/arena/tran/m-coach?tap=1');
    const tiep = async () => {
      /*
       * D416 — TUA trước khi chờ TIẾP. `choLoi` trả ngay khi chữ chạy mới gõ tới câu cần tìm, nên lúc tới đây câu có
       * thể CHƯA gõ xong — nút vẫn là "TUA ▸▸", "TIẾP ▸" chỉ hiện khi gõ hết (28 ms / 2 chữ). Dưới tải cả bộ, gõ một câu
       * dài vượt 4 s ⇒ đỏ "Unable to find TIẾP ▸" dù luồng bước đúng (đo 26/09: đỏ hai lượt cả bộ liền, 3,5 s khi chạy
       * riêng). Bài đo THỨ TỰ BƯỚC và "bước cuối chờ tay", không đo tốc độ gõ chữ.
       */
      const tua = screen.queryByText('TUA ▸▸');
      if (tua) fireEvent.click(tua);
      fireEvent.click(await screen.findByText('TIẾP ▸', {}, { timeout: 4000 }));
    };
    expect(await choLoi(/Dải ghế cả bàn/)).toBeInTheDocument();
    await tiep();
    expect(await choLoi(/tăng NAV nhiều % nhất/)).toBeInTheDocument();
    await tiep();
    // D445 → D448 — hai bước đọc lá mở màn + màu bàn ⇒ hướng lá kế chen giữa mục tiêu và SHOP (đều là bước đọc, có TIẾP).
    expect(await choLoi(/Đọc lá vừa lật trước tiên/)).toBeInTheDocument();
    await tiep();
    expect(await choLoi(/ô SẮP LẬT nghiêng về GIẢM/)).toBeInTheDocument();
    await tiep();
    const loi = await choLoi(/Chạm SHOP/);
    // Lời ≤ 12 từ (luật ít chữ) — đo trên chính chuỗi hiện ra.
    expect((loi.textContent ?? '').replace('▌', '').trim().split(/\s+/).length).toBeLessThanOrEqual(12);
    expect(screen.queryByText(/TIẾP ▸/)).toBeNull();
    expect(screen.queryByText(/KHÔNG TÍNH GIỜ/)).toBeNull();
    // Năm bước chữ chạy nối nhau (D445 thêm hai): chạy riêng ~3 s, dưới tải cả bộ vượt trần 5 s mặc định.
  }, 30000);
});
