/**
 * 23/08 — SHOP QUAY LẠI Ở PHA QUYẾT (founder: *"Sửa đi"*).
 *
 * Trước bản này shop đóng khi vòng lật và KHÔNG BAO GIỜ trả lại: mỗi vòng người
 * chơi phải bấm SHOP lần nữa (8–16 lần một trận). Đóng lúc ô lật là ĐÚNG — shop
 * là lớp phủ toàn màn, che đúng khoảnh khắc đang kể — nên cái sửa là TRẢ LẠI, ở
 * đúng tín hiệu ngữ nghĩa của trò: pha đổi sang QUYẾT (D76/D90 M2 — vòng ≥2 có
 * ngân sách ĐỌC riêng trước khi tới lúc ra quyết định).
 *
 * ⚠⚠ Và §III là bài đắt nhất file: `pha` server phát là ẢNH CHỤP LÚC RESPONSE
 * (`daTroi < doc_s`), mà màn trận KHÔNG polling ⇒ đọc thô thì nó đứng yên ở
 * 'doc' cả vòng — nhãn ĐỌC/QUYẾT chết, và cần gạt này thành cơ chế trang trí.
 * `phaVong` suy lại từ giây ĐANG ĐẾM + `doc_s` của chính server.
 *
 * ⭐ D441 (founder 27/09: *"mỗi 1 màn thẻ lật xong, hiệu ứng chạy hết thì shop sẽ tự động mở"*) — §I viết lại: trận thật
 * mở shop NGAY khi nhịp kết quả diễn xong, cho MỌI người (không chỉ người đang ở trong shop lúc lật), không chờ pha QUYẾT.
 * Hai vế của luật cũ còn giữ: lá đang lật thì shop đóng (lời founder trước 23/08: shop che đúng khoảnh khắc lật); người đã
 * bấm CẤT thì vòng ấy không tự mở lại. Thêm: đang đọc VÌ SAO thì chờ. Bàn tập giữ nhịp 23/08 (Oracle kể ô trên mặt bàn).
 */
import { afterEach, describe, expect, it, vi } from 'vitest';
import { act, fireEvent, screen } from '@testing-library/react';
import { ME_ONBOARDED, renderAt, stubFetch } from './helpers';
import { phaVong } from '../src/components/holdem/DongHoVong';

const CATALOG = {
  engine_version: 'e-test', balance_version: 'b-test',
  luat: {
    SEATS: 5, START_VON: 10000, CAM_KET_NEN: 500, MAX_TAI_SAN: 4,
    MAX_CHIEN_THUAT: 2, SHOP_TAI_SAN: 3, SHOP_CHIEN_THUAT: 2,
    CHI_PHI_KHAO_SAT_LAI: 2, TRAN_TANG_CAM_KET_BP: 4000, PHI_BANG_DIEN_TU: 25,
    BUOC_MOC_THO_BP: 2500, BUOC_MOC_BP: 500,
  },
  nhip_chon_bai: ['tai_san', 'tai_san', 'tai_san', 'tai_san', 'tai_san', 'tai_san', 'khong', 'khong'],
  cap_stack_bp: [10000, 16000, 20000],
  quyet_dinh: { MAP_SIZE: 8, SHOWDOWN_MODEL: 'A' },
  tai_san: [{ id: 'btc', label: 'BTC', icon: '₿', nhom: 'rui_ro', thanh_khoan: 'mong', bien_dong_bp: 400 }],
  chien_thuat: [], giai_doan: [{ id: 'di_ngang', label: 'Đi ngang', icon: '➖' }],
  su_kien: [], tu_dien: { tai_san: {}, chien_thuat: {} }, khau_vi: [],
};

const ban = {
  von: 9000, tien_mat: 9000, vi_the: {}, luot_khao_sat: 1,
  danh_muc: { tai_san: [], chien_thuat: [] }, da_chay: false, tu_the: 'choi',
  vong_roi: null, so_lan_cat_lo: 0, con_lai_cat_lo: 1, khau_vi: 'can_bang',
  fx: 'binh_thuong', nav: 9000,
};

const tran = (vong: number, dh: Record<string, unknown>) => ({
  match_id: 'm-shop', vong, tong_vong: 8, status: 'dang_choi',
  dong_ho: { het_gio: false, an_han_s: 8, ...dh },
  ban, doi_thu: [], so_nguoi_song: 1,
  o_hien_tai: { kind: 'giai_doan', giai_doan: 'di_ngang' },
  lich_su_o: [], telegraph: null,
  bo_bai_con_lai: { con_lai: 5, so_giai_doan: 3, so_su_kien: 2, tin_gia_ky_vong: 1 },
  quy_vong_hien_tai: 500,
  shop: { tai_san: ['btc'], chien_thuat: [], chi_phi_lan_sau: 2 },
  loi_von: null,
});

/**
 * Bàn ở vòng 4 ĐÃ HẾT GIỜ (client sẽ tự nộp sau ~1s) — cú nộp trả về vòng 5
 * với đồng hồ ĐẦY, pha ĐỌC. Từ đó pha đổi theo giây trôi, không cần request nào.
 */
function moBan(dhVong5: Record<string, unknown> = { con_lai_s: 40, tong_s: 40, doc_s: 15, pha: 'doc' }) {
  return stubFetch([
    ['/auth/me', { status: 200, body: ME_ONBOARDED }],
    ['/holdem/catalog', { status: 200, body: CATALOG }],
    ['/holdem/art', { status: 200, body: { version: 'a', art: {} } }],
    ['/holdem/matches/m-shop/rounds', {
      status: 200,
      body: {
        ...tran(5, dhVong5), tu_dong: true,
        ket_qua_vong: {
          vong: 4, o: { kind: 'giai_doan', giai_doan: 'di_ngang' },
          tin_gia_lo: null, quy_vong: 500, ghe_thang: 'ban', chay_vong_nay: [],
          cua_ban: null, cua_doi_thu: [], phi_cua_ban: null, ty_le_cat_lo_bp: 0,
        },
      },
    }],
    ['/holdem/matches/m-shop', {
      status: 200,
      body: tran(4, { con_lai_s: 0, tong_s: 40, doc_s: 15, pha: 'quyet' }),
    }],
  ]);
}

const nutShop = () => document.querySelector('[data-tap="nut-shop"]') as HTMLButtonElement;
const shopDangMo = () => !!document.querySelector('[data-shop-pha]');
const tua = (ms: number) => act(async () => { await vi.advanceTimersByTimeAsync(ms); });

afterEach(() => { vi.useRealTimers(); vi.unstubAllGlobals(); });

async function vaoBan(dh?: Record<string, unknown>) {
  vi.useFakeTimers({ shouldAdvanceTime: true });
  moBan(dh);
  renderAt('/arena/tran/m-shop');
  await screen.findByText(/còn \d+ ô/);
}

const buocKq = () => document.querySelector('[data-buoc-kq]')?.getAttribute('data-buoc-kq') ?? null;
/** Tua tới khi nhịp kết quả diễn xong; trả số ms đã tua (bài đo "không chờ QUYẾT" đọc số này). */
async function choNhipXong(): Promise<number> {
  let ms = 0;
  while (buocKq() !== 'xong' && ms < 30_000) { await tua(250); ms += 250; }
  return ms;
}

describe('I. D441 — lá lật xong, hiệu ứng chạy hết ⇒ shop tự mở', () => {
  it('⭐ vòng trước KHÔNG mở shop ⇒ lá lật xong vẫn TỰ MỞ, và mở trong pha ĐỌC (không chờ QUYẾT)', async () => {
    await vaoBan();
    expect(shopDangMo()).toBe(false);
    await tua(2_500);                        // hết giờ ⇒ tự nộp ⇒ vòng 5 lật
    expect(buocKq(), 'tiền đề: nhịp kết quả phải đang diễn').not.toBe('xong');
    expect(shopDangMo(), 'shop không được che lá đang lật').toBe(false);
    const ms = await choNhipXong();
    expect(ms, 'nhịp kết quả phải xong trước mốc QUYẾT (15 s) thì bài mới đo được "không chờ QUYẾT"').toBeLessThan(12_000);
    await tua(300);
    expect(shopDangMo(), 'lật xong mà không tự mở = mỗi vòng bắt bấm SHOP một lần nữa').toBe(true);
  });

  it('đang mở shop lúc chốt ⇒ vòng lật thì ĐÓNG (nhường lá), nhịp xong thì MỞ lại', async () => {
    await vaoBan();
    fireEvent.click(nutShop());
    expect(shopDangMo(), 'bấm SHOP mà không mở thì cả bài này vô nghĩa').toBe(true);
    await tua(2_500);
    expect(shopDangMo(), 'shop phải nhường sân khấu cho ô đang lật').toBe(false);
    await choNhipXong();
    await tua(300);
    expect(shopDangMo()).toBe(true);
  });

  it('tự mở rồi bấm CẤT ⇒ vòng ấy KHÔNG tự mở lại (người chơi muốn xem bàn)', async () => {
    await vaoBan();
    await tua(2_500);
    await choNhipXong();
    await tua(300);
    expect(shopDangMo()).toBe(true);
    fireEvent.click(nutShop());
    expect(shopDangMo()).toBe(false);
    await tua(20_000);
    expect(shopDangMo(), 'đã cất tay rồi mà vẫn tự bung là cướp màn của người chơi').toBe(false);
  });

  it('đang đọc VÌ SAO lúc nhịp xong ⇒ CHỜ; đóng VÌ SAO ⇒ shop mở', async () => {
    await vaoBan();
    await tua(2_500);
    let ms = 0;
    while (!['lai_lo', 'phong_cach'].includes(buocKq() ?? '') && buocKq() !== 'xong' && ms < 20_000) { await tua(50); ms += 50; }
    expect(['lai_lo', 'phong_cach'], 'tiền đề: bắt được bước LÃI/LỖ trước khi nhịp xong').toContain(buocKq());
    const so = document.querySelector('[data-tap="vi-sao"] button') as HTMLButtonElement;
    expect(so, 'con số vòng (cửa VÌ SAO) phải có mặt').toBeTruthy();
    fireEvent.click(so);                     // mở VÌ SAO
    await choNhipXong();
    await tua(300);
    expect(shopDangMo(), 'shop bung lên che đúng tấm người ta đang đọc').toBe(false);
    fireEvent.click(so);                     // đóng VÌ SAO
    await tua(300);
    expect(shopDangMo(), 'đọc xong lý do thì tới lượt shop').toBe(true);
  });

  it('trận CŨ không phát `doc_s` ⇒ vẫn tự mở sau khi lật (luật D441 không đọc pha)', async () => {
    await vaoBan({ con_lai_s: 40, tong_s: 40 });
    await tua(2_500);
    await choNhipXong();
    await tua(300);
    expect(shopDangMo()).toBe(true);
  });

  it('bàn tập (?tap=1): vòng trước không mở shop ⇒ KHÔNG tự mở — Oracle kể ô vừa lật trên mặt bàn trống', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    moBan();
    renderAt('/arena/tran/m-shop?tap=1');
    await screen.findByText(/còn \d+ ô/);
    await tua(2_500);
    await choNhipXong();
    await tua(20_000);
    expect(shopDangMo()).toBe(false);
  });
});

describe('II. phaVong — suy pha từ giây ĐANG ĐẾM, không đọc ảnh chụp', () => {
  it('trong doc_s đầu ⇒ doc; sau đó ⇒ quyet (dù ảnh chụp server vẫn nói doc)', () => {
    expect(phaVong(40, 40, 15, 'doc')).toBe('doc');
    expect(phaVong(26, 40, 15, 'doc')).toBe('doc');
    expect(phaVong(25, 40, 15, 'doc')).toBe('quyet');
    expect(phaVong(1, 40, 15, 'doc')).toBe('quyet');
  });

  it('THẺ GIỜ cộng giây vào tong_s ⇒ mốc dịch theo, vì doc_s do server phát (không gõ hằng 15 ở client)', () => {
    // Vòng 52s (thẻ giờ +12): pha đọc vẫn đúng 15s đầu ⇒ đổi tại con = 37.
    expect(phaVong(38, 52, 15, 'doc')).toBe('doc');
    expect(phaVong(37, 52, 15, 'doc')).toBe('quyet');
  });

  it('vòng 1 (doc_s = 0) và trận cũ (không phát gì) ⇒ trả đúng thứ server nói, không bịa', () => {
    expect(phaVong(40, 40, 0, 'quyet')).toBe('quyet');
    expect(phaVong(40, 40, 0, undefined)).toBeUndefined();
    expect(phaVong(40, 0, 15, undefined)).toBeUndefined();
  });
});
