/**
 * QUẢN TRỊ VỐN — Tái cơ cấu + Khoá nắm giữ.
 *
 * ⚠ BỐN CÂU HỎI Ở ĐÂY, VÀ CẢ BỐN ĐỀU LÀ CHỖ TÍNH NĂNG CHẾT TRONG IM LẶNG:
 *
 *  1. **CÓ ĐƯỜNG NÀO GỌI TỚI KHÔNG?** Bẫy số 1 của repo này là cơ chế trang trí:
 *     code có, test có, mà không đường chạy nào gọi (đã gặp sáu lần). Nên ca
 *     quan trọng nhất KHÔNG kiểm component rời — nó render TRỌN bàn đấu, bấm
 *     đúng những nút người chơi bấm, rồi soi `POST /rounds` xem `dao`/`khoa` có
 *     thật sự lên dây không. Kiểm chữ trên màn thì một panel không nối gì vẫn
 *     xanh.
 *  2. **GIÁ CÓ HIỆN TRƯỚC KHI BẤM KHÔNG?** Thu tiền mà không niêm yết giá là
 *     lừa. Và giá phải là số của SERVER, không phải hằng số gõ tay ở client —
 *     mọi số này đánh dấu `MC-TUNE`, tức còn đổi mỗi mùa.
 *  3. **PHÁ CAM KẾT CÓ BỊ CHẶN LẠI MỘT NHỊP KHÔNG?** Một cảnh báo chỉ để đọc là
 *     một cảnh báo bị lướt qua.
 *  4. **THIẾU BẢNG GIÁ THÌ CÓ IM KHÔNG?** API cũ hơn bundle là chuyện thường
 *     (deploy hai lệnh riêng). Thiếu giá mà vẫn cho bấm là niêm yết số bịa.
 */
import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, within } from '@testing-library/react';
import { QuanTriVon } from '../src/components/holdem/QuanTriVon';
import type { DaoDanhMucDTO, KhoaTaiSanDTO, TaiSanDTO } from '../src/api/holdem';
import { ME_ONBOARDED, renderAt, stubFetch, type RecordedCall } from './helpers';

// ══════════════════════════ Fixture chung ══════════════════════════

const MA: TaiSanDTO[] = [
  { id: 'btc', label: 'Crypto', icon: '◈', nhom: 'rui_ro', thanh_khoan: 'mong', bien_dong_bp: 400 },
  { id: 'vang', label: 'Vàng', icon: '🥇', nhom: 'phong_thu', thanh_khoan: 'vua', bien_dong_bp: 240 },
  { id: 'usd', label: 'Stablecoin', icon: '🪙', nhom: 'phong_thu', thanh_khoan: 'day', bien_dong_bp: 150 },
];

/*
 * SỐ CỐ Ý LỆCH KHỎI `config/holdem.ts` (100 / 600 / 150 / 5000).
 *
 * Nếu component lỡ gõ tay hằng số thì fixture trùng số sẽ làm test xanh vì lý do
 * sai — đúng bẫy số 7 ("test chép lại hằng số thì không kiểm gì"). Số lạ ở đây
 * biến mọi assertion thành phép kiểm "có ĐỌC TỪ SERVER không".
 */
const GIA_DAO: DaoDanhMucDTO = {
  TU_VONG: 2, PHI_CHUYEN_DOI_BP: 137, HE_SO_XEP_HANG_K: 25, NGUONG_XEP_HANG: 2,
};
const GIA_KHOA: KhoaTaiSanDTO = {
  SO_VONG: 2, TRUOT_GIA_CON_BP: 4200, THUONG_SONG_SOT_BP: 171,
  GIAI_DOAN_BAO: ['giam', 'bien_dong'], PHAT_BE_KEO_BP: 613, GIAM_VON_SO_VONG: 1,
};

type Props = Parameters<typeof QuanTriVon>[0];

function ve(p: Partial<Props> = {}) {
  const day: Props = {
    danhMuc: ['btc', 'vang'],
    moiMa: MA,
    maKhoaDuoc: ['btc', 'vang'],
    giaDao: GIA_DAO,
    giaKhoa: GIA_KHOA,
    nhanGiaiDoan: (id) => ({ giam: 'Giảm', bien_dong: 'Biến động mạnh' }[id] ?? id),
    khoa: null,
    daoDuoc: true,
    khoaDuoc: true,
    vonBiGiam: false,
    chonDao: null,
    chonKhoa: null,
    onChonDao: vi.fn(),
    onChonKhoa: vi.fn(),
    ...p,
  };
  return { ...render(<QuanTriVon {...day} />), props: day };
}

/*
 * HAI MỤC CHÀO CÙNG MỘT DANH SÁCH MÃ, nên mọi thao tác phải khoanh vùng.
 * `getByRole('button', {name: /Crypto/})` trên cả màn là mơ hồ — và mơ hồ ở đây
 * không phải chuyện test: nó đúng là lý do hai mục phải có ranh giới ngữ nghĩa
 * (`<section aria-label>`), cho cả trình đọc màn hình lẫn test.
 */
const oTaiCoCau = () => within(screen.getByRole('region', { name: 'TÁI CƠ CẤU' }));
const oKhoa = () => within(screen.getByRole('region', { name: 'KHOÁ NẮM GIỮ' }));

const bamDao = (ten: string | RegExp) =>
  fireEvent.click(oTaiCoCau().getByRole('button', { name: ten }));
const bamKhoa = (ten: string | RegExp) =>
  fireEvent.click(oKhoa().getByRole('button', { name: ten }));

// ══════════════════ 2. GIÁ HIỆN TRƯỚC KHI BẤM ══════════════════

describe('Niêm yết giá TRƯỚC khi bấm — và giá là số của SERVER', () => {
  it('tái cơ cấu: nói cả phí chuyển đổi LẪN hàng chờ khớp lệnh', () => {
    ve();
    const chu = document.body.textContent ?? '';
    expect(chu).toMatch(/137 bp/);              // phí, đúng số catalog
    expect(chu).toMatch(/xếp hàng khớp lệnh/i); // vế thứ hai, không được im
    // Ngưỡng hàng chờ cũng phải nói ra: dưới ngưỡng thì không mất gì thêm.
    expect(chu).toMatch(/2 người/);
  });

  it('khoá nắm giữ: nói ĐƯỢC gì và TRẢ gì, cả hai đều bằng số server', () => {
    ve();
    const chu = document.body.textContent ?? '';
    expect(chu).toMatch(/171 bp/);   // thưởng sống sót
    expect(chu).toMatch(/42%/);      // trượt giá còn lại (4200 bp)
    expect(chu).toMatch(/613 bp/);   // phạt phá cam kết
    expect(chu).toMatch(/giam 1 vòng/i);
    // Giai đoạn "bão" lấy nhãn từ catalog, không gõ tay id.
    expect(chu).toMatch(/Giảm \/ Biến động mạnh/);
  });

  it('không có bảng giá nào bị gõ tay: đổi số catalog thì màn đổi theo', () => {
    const { unmount } = ve();
    expect(document.body.textContent).toMatch(/613 bp/);
    unmount();
    ve({ giaKhoa: { ...GIA_KHOA, PHAT_BE_KEO_BP: 9001 } });
    expect(document.body.textContent).toMatch(/9001 bp/);
    expect(document.body.textContent).not.toMatch(/613 bp/);
  });
});

// ══════════════════ 1b. BẤM ĐƯỢC THẬT (mức component) ══════════════════

describe('Hai cần gạt BẤM ĐƯỢC, không phải bảng hiển thị', () => {
  it('tái cơ cấu là lệnh HAI VẾ: chọn bán rồi mới chào mã mua', () => {
    const { props } = ve();
    // Bước 1 chỉ chào mã ĐANG NẮM — bán thứ mình không có là lệnh vô nghĩa.
    expect(oTaiCoCau().getByRole('button', { name: /Crypto/ })).toBeInTheDocument();
    expect(oTaiCoCau().queryByRole('button', { name: /^Stablecoin$/ })).toBeNull();

    bamDao(/Crypto/);
    // Bước 2 chào MỌI mã trừ mã vừa bán.
    expect(oTaiCoCau().getByRole('button', { name: /^Stablecoin$/ })).toBeInTheDocument();
    expect(props.onChonDao).not.toHaveBeenCalled();   // chưa đủ hai vế

    bamDao(/^Stablecoin$/);
    expect(props.onChonDao).toHaveBeenCalledWith({ tu: 'btc', den: 'usd' });
  });

  it('khoá nắm giữ: một cú bấm là ra lệnh, và huỷ được', () => {
    const { props, unmount } = ve({ maKhoaDuoc: ['vang'] });
    bamKhoa(/^Vàng$/);
    expect(props.onChonKhoa).toHaveBeenCalledWith('vang');
    unmount();

    // Đã chọn rồi thì phải thấy lệnh + đường lui, không phải một danh sách câm.
    const { props: p2 } = ve({ chonKhoa: 'vang' });
    expect(document.body.textContent).toMatch(/Sẽ khoá Vàng/);
    bamKhoa(/HUỶ/);
    expect(p2.onChonKhoa).toHaveBeenCalledWith(null);
  });

  it('server nói KHÔNG ĐƯỢC thì nút tắt — client không tự suy điều kiện', () => {
    /*
     * ⚠ DỰNG VỚI MỘT VẾ CÒN MỞ. Từ 27/07 bảng thu gọn khi KHÔNG có gì bấm được
     * (xem test "thu gọn" ngay dưới), nên nếu tắt cả hai vế thì cả bảng biến mất
     * và không còn nút nào để kiểm — test sẽ đỏ vì một lý do chẳng liên quan.
     * Bất biến cần canh vẫn nguyên: nút tắt vì SERVER nói tắt, không phải vì
     * client tự suy từ danh mục.
     */
    ve({ daoDuoc: false, khoaDuoc: true });
    for (const b of oTaiCoCau().getAllByRole('button')) expect(b).toBeDisabled();
  });

  it('…và vế kia cũng vậy: khoá tắt khi server nói tắt', () => {
    // Tách thành hai `it` chứ không gọi `ve()` hai lần trong một test: Testing
    // Library chỉ dọn DOM GIỮA các test, nên hai lần dựng trong cùng một test là
    // hai bản chồng nhau và truy vấn sẽ tóm nhầm bản trước.
    ve({ daoDuoc: true, khoaDuoc: false });
    for (const b of oKhoa().getAllByRole('button')) expect(b).toBeDisabled();
  });

  /*
   * ── FOUNDER 27/07 ─────────────────────────────────────────────────────────
   * *"UI-UX thêm những phần thừa thãi mà chẳng để làm gì… QUẢN TRỊ VỐN / TÁI CƠ
   *  CẤU / mở từ vòng 2 / Giá: −100 bp… / Chưa nắm mã nào để bán… Đang bị lỗi và
   *  vô giá trị hiển thị."*
   *
   * Giá của một nước đi chỉ đáng chỗ trên màn hình khi nước đi đó BẤM ĐƯỢC. Bày
   * bảng giá cho thứ chưa mở là dạy người chơi bỏ qua vùng đó — rồi lúc nó mở
   * thật thì họ đã quen không đọc.
   */
  it('KHÔNG có gì bấm được ⇒ thu gọn còn một dòng, không đổ bảng giá', () => {
    ve({ danhMuc: [], maKhoaDuoc: [], daoDuoc: false, khoaDuoc: false });
    const chu = document.body.textContent ?? '';
    expect(chu, 'không được bày bảng giá cho nước đi chưa mở').not.toMatch(/Giá:/);
    expect(chu, 'không được đổ câu "chưa có gì" như một mục riêng')
      .not.toMatch(/Chưa nắm mã nào để bán/);
    expect(chu, 'vẫn phải nói khi nào nó mở').toMatch(/mở khi bạn đã nắm/);
    expect(screen.queryAllByRole('button'), 'không nút nào để bấm').toHaveLength(0);
  });

  it('CÓ mã nhưng chưa tới vòng ⇒ vẫn thu gọn, và nói rõ mở từ vòng mấy', () => {
    ve({ daoDuoc: false, khoaDuoc: false });
    const chu = document.body.textContent ?? '';
    expect(chu).not.toMatch(/Giá:/);
    expect(chu, 'phải nói mốc mở, không phải im lặng').toMatch(/mở từ vòng/);
  });

  it('CÓ HẬU QUẢ đang chạy thì KHÔNG thu gọn, dù không bấm được gì', () => {
    /*
     * Đây là ranh giới với D25/R1: thu gọn chỉ đúng khi không có gì ảnh hưởng tới
     * quyết định. `Vốn đang bị giam` là hậu quả ĐANG chạy — giấu nó là giấu đúng
     * thứ người chơi cần để hiểu vì sao nút khác đang tắt.
     */
    ve({ danhMuc: [], maKhoaDuoc: [], daoDuoc: false, khoaDuoc: false, vonBiGiam: true });
    expect(document.body.textContent ?? '').toMatch(/ĐANG BỊ GIAM/);
  });
});

// ══════════════════ 3. CỔNG PHÁ CAM KẾT ══════════════════

describe('Phá cam kết phải qua một cổng, không phải một dòng chữ', () => {
  const KHOA = {
    ma: 'btc', vong_bat_dau: 2, con_vong: 1, la_vong_chot: true,
    thuong_da_nhan_bp: 171,
  };

  it('chu kỳ đang chạy: hiện RÕ còn mấy vòng và mất gì nếu bỏ', () => {
    ve({ khoa: { ...KHOA, con_vong: 2, la_vong_chot: false } });
    const chu = document.body.textContent ?? '';
    expect(chu).toMatch(/CÒN 2 VÒNG/);
    expect(chu).toMatch(/613 bp/);
    expect(chu).toMatch(/thu hồi 171 bp/);
  });

  it('vòng chốt được gọi đúng tên — đây là vòng duy nhất bị phạt', () => {
    ve({ khoa: KHOA });
    expect(document.body.textContent).toMatch(/VÒNG CHỐT/);
  });

  it('bấm bán mã đang khoá KHÔNG ra lệnh ngay — phải xác nhận thêm một nhịp', () => {
    const { props } = ve({ khoa: KHOA, danhMuc: ['btc', 'vang'] });
    bamDao(/Crypto/);

    // Chưa nhận lệnh, và chưa sang bước chọn mã mua.
    expect(props.onChonDao).not.toHaveBeenCalled();
    expect(oTaiCoCau().queryByRole('button', { name: /^Stablecoin$/ })).toBeNull();
    expect(screen.getByRole('alert').textContent).toMatch(/613 bp/);

    // Đường lui phải có, và bấm nó thì mọi thứ về như cũ.
    bamDao(/GIỮ CAM KẾT/);
    expect(props.onChonDao).not.toHaveBeenCalled();
    expect(screen.queryByRole('alert')).toBeNull();

    // Xác nhận rồi mới được đi tiếp.
    bamDao(/Crypto/);
    bamDao(/^PHÁ CAM KẾT$/);
    bamDao(/^Stablecoin$/);
    expect(props.onChonDao).toHaveBeenCalledWith({ tu: 'btc', den: 'usd' });
  });

  it('còn bản sao thứ hai thì bán KHÔNG phá cam kết — đi thẳng, không hỏi', () => {
    /*
     * Engine chấm bẻ kèo bằng "mã khoá còn trong danh mục hay không", nên bán
     * một trong hai bản sao thì lời hứa vẫn nguyên. Hỏi ở đây là cảnh báo sai,
     * và cảnh báo sai đủ nhiều thì người chơi bấm qua mọi cảnh báo.
     */
    const { props } = ve({ khoa: KHOA, danhMuc: ['btc', 'btc', 'vang'] });
    bamDao(/Crypto/);
    expect(screen.queryByRole('alert')).toBeNull();
    bamDao(/^Stablecoin$/);
    expect(props.onChonDao).toHaveBeenCalledWith({ tu: 'btc', den: 'usd' });
  });

  it('vốn bị giam: nói ra hậu quả đang chạy, không để người chơi tự đoán', () => {
    ve({ vonBiGiam: true });
    expect(document.body.textContent).toMatch(/ĐANG BỊ GIAM/);
    expect(document.body.textContent).toMatch(/không Tăng cam kết/);
  });

  it('lệnh vòng trước bị từ chối thì NÓI RA, không im lặng', () => {
    ve({ loi: { dao: 'day_tai_san' } });
    expect(screen.getByRole('alert').textContent).toMatch(/Danh mục đã đầy/);
  });
});

// ══════════════════ 1. CHUỖI THẬT: bấm → POST /rounds ══════════════════

const CATALOG = {
  engine_version: 'holdem-test-1',
  balance_version: 'balance-v6-luatvon',
  luat: {
    SEATS: 5, START_VON: 10000, CAM_KET_NEN: 500, MAX_TAI_SAN: 4,
    MAX_CHIEN_THUAT: 2, SHOP_TAI_SAN: 3, SHOP_CHIEN_THUAT: 2,
    CHI_PHI_KHAO_SAT_LAI: 2, TRAN_TANG_CAM_KET_BP: 4000, PHI_BANG_DIEN_TU: 25,
  },
  nhip_chon_bai: ['tai_san', 'tai_san', 'chien_thuat', 'tai_san', 'tai_san',
    'chien_thuat', 'khong', 'khong'],
  cap_stack_bp: [10000, 16000, 20000],
  dao_danh_muc: GIA_DAO,
  khoa_tai_san: GIA_KHOA,
  quyet_dinh: { MAP_SIZE: 8, SHOWDOWN_MODEL: 'A' },
  tai_san: MA,
  chien_thuat: [],
  giai_doan: [
    { id: 'di_ngang', label: 'Đi ngang', icon: '➖' },
    { id: 'giam', label: 'Giảm', icon: '📉' },
    { id: 'bien_dong', label: 'Biến động mạnh', icon: '⚡' },
  ],
  su_kien: [],
  tu_dien: { tai_san: {}, chien_thuat: {} },
  khau_vi: [],
};

/** Trạng thái bàn đấu ở vòng 4 (vòng chọn tài sản), luật vốn BẬT. */
const tran = (patch: Record<string, unknown> = {}) => ({
  match_id: 'm-von',
  vong: 4,
  tong_vong: 8,
  ban: {
    von: 9000,
    luot_khao_sat: 1,
    danh_muc: { tai_san: ['btc', 'vang'], chien_thuat: [] },
    da_chay: false,
    tu_the: 'choi',
    vong_roi: null,
    so_lan_cat_lo: 0,
    con_lai_cat_lo: 1,
    khau_vi: 'can_bang',
    fx: 'binh_thuong',
    luat_von: true,
    khoa: null,
    dao_duoc: true,
    khoa_duoc: true,
    von_bi_giam: false,
    ...(patch.ban as Record<string, unknown> ?? {}),
  },
  doi_thu: [],
  so_nguoi_song: 1,
  o_hien_tai: { kind: 'giai_doan', giai_doan: 'di_ngang' },
  lich_su_o: [],
  telegraph: null,
  bo_bai_con_lai: { con_lai: 5, so_giai_doan: 3, so_su_kien: 2, tin_gia_ky_vong: 1 },
  quy_vong_hien_tai: 500,
  shop: null,
  loi_von: null,
});

function moBanDau(): RecordedCall[] {
  return stubFetch([
    ['/auth/me', { status: 200, body: ME_ONBOARDED }],
    ['/holdem/catalog', { status: 200, body: CATALOG }],
    ['/holdem/art', { status: 200, body: { version: 'holdem-test-1', art: {} } }],
    // Đặt TRƯỚC '/holdem/matches/m-von': bảng khớp theo thứ tự khai báo.
    ['/holdem/matches/m-von/luot',
      { status: 200, body: { cho_ban: null, xong_vong: true, nhat_ky: [] } }],
    ['/holdem/matches/m-von/rounds', {
      status: 200,
      body: {
        ...tran(),
        vong: 5,
        ket_qua_vong: {
          vong: 4,
          o: { kind: 'giai_doan', giai_doan: 'di_ngang' },
          tin_gia_lo: null, quy_vong: 500, ghe_thang: 'ban', chay_vong_nay: [],
          cua_ban: null, cua_doi_thu: [], phi_cua_ban: null, ty_le_cat_lo_bp: 0,
        },
      },
    }],
    ['/holdem/matches/m-von', { status: 200, body: tran() }],
  ]);
}

/*
 * Nộp vòng đúng đường người chơi đi.
 *
 * ⚠ 27/07 — nút đổi từ GIỮ sang CHỐT VÒNG. Hai nút poker (GIỮ/THEO và TĂNG CAM
 * KẾT) đã gỡ theo lệnh founder, nên đường nộp vòng nay là một nút duy nhất xác
 * nhận những gì đã mua ở shop. Không còn pha cược tuần tự chen giữa.
 */
async function chotPhien(calls: RecordedCall[]) {
  fireEvent.click(screen.getByRole('button', { name: /CHỐT VÒNG/ }));
  await vi.waitFor(() => {
    expect(calls.some((c) => c.method === 'POST' && c.url.includes('/rounds'))).toBe(true);
  }, { timeout: 5000 });
  return calls.find((c) => c.method === 'POST' && c.url.includes('/rounds'))!
    .body as Record<string, unknown>;
}

describe('CHUỖI THẬT — panel có nối vào lệnh nộp vòng không', () => {
  it('chọn tái cơ cấu trên bàn đấu → `dao` đi thật trong POST /rounds', async () => {
    const calls = moBanDau();
    renderAt('/arena/tran/m-von');
    await screen.findByText('QUẢN TRỊ VỐN');

    bamDao(/^Crypto$/);
    bamDao(/^Stablecoin$/);
    expect(screen.getByText(/Crypto → Stablecoin/)).toBeInTheDocument();

    const body = await chotPhien(calls);
    expect(body.dao).toEqual({ tu: 'btc', den: 'usd' });
    // Không chọn khoá thì trường phải VẮNG MẶT, không phải `undefined` tường
    // minh: server phân biệt hai thứ đó khi ghi `action_log`.
    expect('khoa' in body).toBe(false);
  });

  it('chọn khoá nắm giữ trên bàn đấu → `khoa` đi thật trong POST /rounds', async () => {
    const calls = moBanDau();
    renderAt('/arena/tran/m-von');
    await screen.findByText('QUẢN TRỊ VỐN');

    bamKhoa(/^Vàng$/);
    expect(screen.getByText(/Sẽ khoá Vàng/)).toBeInTheDocument();

    const body = await chotPhien(calls);
    expect(body.khoa).toBe('vang');
    expect('dao' in body).toBe(false);
  });

  it('trận chạy LUẬT CŨ (luat_von vắng) → panel không hiện, không nút nào', async () => {
    /*
     * Trận `balance-v5` không có hai cần gạt này. Hiện nút cho nó là mời người
     * chơi bấm một lệnh engine sẽ từ chối — đúng hình dạng "nút vẫn sáng, bấm
     * không có gì xảy ra" mà cả cụm này dựng lên để tránh.
     */
    stubFetch([
      ['/auth/me', { status: 200, body: ME_ONBOARDED }],
      ['/holdem/catalog', { status: 200, body: CATALOG }],
      ['/holdem/art', { status: 200, body: { version: 'holdem-test-1', art: {} } }],
      ['/holdem/matches/m-von', {
        status: 200,
        body: tran({ ban: { luat_von: false, dao_duoc: false, khoa_duoc: false } }),
      }],
    ]);
    renderAt('/arena/tran/m-von');
    await screen.findByText(/còn \d+ ô/);
    expect(screen.queryByText('QUẢN TRỊ VỐN')).toBeNull();
  });

  it('catalog THIẾU bảng giá → panel im, không bịa số để vẫn cho bấm', async () => {
    const { dao_danh_muc: _d, khoa_tai_san: _k, ...catalogCu } = CATALOG;
    stubFetch([
      ['/auth/me', { status: 200, body: ME_ONBOARDED }],
      ['/holdem/catalog', { status: 200, body: catalogCu }],
      ['/holdem/art', { status: 200, body: { version: 'holdem-test-1', art: {} } }],
      ['/holdem/matches/m-von', { status: 200, body: tran() }],
    ]);
    renderAt('/arena/tran/m-von');
    await screen.findByText(/còn \d+ ô/);
    expect(screen.queryByText('QUẢN TRỊ VỐN')).toBeNull();
  });
});

// ══════════════════ Cảnh báo ở sheet bỏ bài ══════════════════

describe('Bỏ vòng ở vòng chốt cũng là phá cam kết — sheet phải nói', () => {
  it('sheet bỏ bài hiện cảnh báo, và nó đứng trên CẢ BA nhánh', async () => {
    stubFetch([
      ['/auth/me', { status: 200, body: ME_ONBOARDED }],
      ['/holdem/catalog', { status: 200, body: CATALOG }],
      ['/holdem/art', { status: 200, body: { version: 'holdem-test-1', art: {} } }],
      ['/holdem/matches/m-von', {
        status: 200,
        body: tran({
          ban: {
            khoa: {
              ma: 'btc', vong_bat_dau: 3, con_vong: 1, la_vong_chot: true,
              thuong_da_nhan_bp: 171,
            },
          },
        }),
      }],
    ]);
    renderAt('/arena/tran/m-von');
    await screen.findByText('QUẢN TRỊ VỐN');

    fireEvent.click(screen.getByRole('button', { name: /^BỎ/ }));
    const sheet = await screen.findByRole('dialog', { name: 'Bỏ bài' });
    expect(sheet.textContent).toMatch(/PHÁ CAM KẾT/);
    expect(sheet.textContent).toMatch(/613 bp/);
    expect(sheet.textContent).toMatch(/Áp cho cả ba cách ra/);
  });
});
