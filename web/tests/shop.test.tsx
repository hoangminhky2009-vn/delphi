/**
 * TAB SHOP — hai quầy THẬT, và những gì màn tuyệt đối không được làm.
 *
 * Bản trước của file này canh một màn CHƯA BÁN GÌ (backend còn 403 cứng). Nay cửa
 * đã mở nên phần lớn test đổi hướng: không còn canh "đừng mọc ra nút mua" mà canh
 * BỐN THỨ D25/R1 buộc phải hiện vô điều kiện, và canh việc mọi con số đến TỪ SERVER.
 *
 * ⚠ Vì sao đo bằng `data-*` chứ không bám class: CSS Modules băm tên class, nên một
 * assertion bám class là một assertion sẽ đỏ vào ngày ai đó đổi tên biến — chứ không
 * phải vào ngày hành vi sai.
 */
import { describe, expect, it } from 'vitest';
import { fireEvent, screen, waitFor } from '@testing-library/react';
import { ME_ONBOARDED, renderAt, stubFetch } from './helpers';

const CATALOG = {
  bankroll: 1000,
  quest_points: 850,
  ban_q: [
    {
      id: 'av_ao_trum_dau', ten: 'ÁO TRÙM ĐẦU', loai: 'nen', gia: 600, ma: 'C',
      da_so_huu: false, mua_lai_duoc: true, phien_ban: 'Beta Access', song: true,
    },
    {
      id: 'kh_manh_cyan', ten: 'Khung mảnh cyan', loai: 'khung', gia: 250, ma: null,
      da_so_huu: false, mua_lai_duoc: false, phien_ban: null, song: true,
    },
    {
      id: 'kh_kep_violet', ten: 'Khung kép violet', loai: 'khung', gia: null, ma: null,
      da_so_huu: true, mua_lai_duoc: false, phien_ban: null, song: true,
    },
  ],
  hop: {
    gia_t: 100,
    can_du_t: 600,
    rate_bp: { thuong: 7000, hiem: 2500, epic: 500 },
    pity: 20,
    tu_epic: 7,
    tong_luot: 12,
    mo_duoc: true,
    mon: [
      {
        id: 'st_ria_mep', ten: 'Ria mép', hiem: 'thuong',
        ghi_chu: 'Râu mọc nhanh nhất ở tuổi 20–30.', con_lai: null, song: true,
      },
      {
        id: 'st_niem_beta', ten: 'Dấu niêm Beta', hiem: 'epic',
        ghi_chu: 'Dấu niêm sáp vỡ khi mở.', con_lai: 3, song: true,
      },
    ],
  },
  gia_ban_sao_them: null,
};

const KET_QUA_HOP = {
  ok: true,
  bac: 'hiem', bac_goc: 'hiem', ha_bac: false, tu_pity: false,
  mon: { id: 'st_kinh_ram', ten: 'Kính râm', con_lai: null },
  bankroll: 900, tu_epic: 8, hat: 123456,
};

/**
 * Chờ tới khi phần tử XUẤT HIỆN. `waitFor(() => document.querySelector(x)!)` KHÔNG
 * chờ: callback trả `null` mà không ném, nên waitFor coi như đã xong ngay nhịp đầu
 * và assertion sau đó nổ trên null. Phải NÉM thì waitFor mới thử lại.
 */
async function timO(sel: string): Promise<HTMLElement> {
  return waitFor(() => {
    const el = document.querySelector(sel);
    if (!el) throw new Error(`chưa thấy ${sel}`);
    return el as HTMLElement;
  });
}

/** Nút mở hộp chỉ bật sau khi catalog về — click lúc còn khoá là click vào hư không. */
async function nutMoHop(): Promise<HTMLElement> {
  return waitFor(() => {
    const b = screen.getByRole('button', { name: 'MỞ HỘP' });
    expect(b).toBeEnabled();
    return b;
  });
}

function stub(extra: [string, { status: number; body: unknown }][] = []) {
  return stubFetch([
    ...extra,
    ['/auth/me', { status: 200, body: ME_ONBOARDED }],
    ['/shop/catalog', { status: 200, body: CATALOG }],
  ]);
}

describe('Shop — hai quầy, hai loại xu', () => {
  it('hiện SỐ DƯ CẢ HAI LOẠI XU từ server (C4), không tự tính', async () => {
    stub();
    renderAt('/shop');
    await waitFor(() => {
      expect(document.querySelector('[data-so-du-q]')!.textContent).toBe('850 Q');
    });
    // "1.000 T" cũng có ở chip ví trên header → phải khoanh vào ô của màn Shop.
    expect(document.querySelector('[data-so-du]')!.textContent).toBe('1.000 T');
  });

  it('nói thẳng KHÔNG có đường quy đổi giữa hai xu (A3.5, nhìn từ người chơi)', async () => {
    stub();
    renderAt('/shop');
    expect(await screen.findByText(/không có đường quy đổi/)).toBeInTheDocument();
  });

  it('quầy niêm yết hiện GIÁ SERVER TRẢ, không phải giá gõ trong màn', async () => {
    stub();
    renderAt('/shop');
    const o = await timO('[data-mon="kh_manh_cyan"]');
    expect(o.querySelector('[data-gia]')!.textContent).toBe('250 Q');
  });

  /*
   * Ba trạng thái phải PHÂN BIỆT ĐƯỢC. "Đã có" và "chưa mở bán" là hai chuyện khác
   * hẳn nhau: một cái kết thúc, một cái đang chờ founder chốt giá (A8.2). Gộp thành
   * một ổ khoá trơn là bắt người chơi đoán, và họ sẽ đoán "sắp có".
   */
  it('món đã sở hữu KHÔNG có nút đổi, và nói rõ vì sao', async () => {
    stub();
    renderAt('/shop');
    const o = await timO('[data-mon="kh_kep_violet"]');
    expect(o.querySelector('button')).toBeNull();
    expect(o.textContent).toMatch(/Đã có trong bộ sưu tập/);
  });

  it('bấm ĐỔI gửi ĐÚNG mon_id lên server, không gửi giá (C4)', async () => {
    const calls = stub([['/shop/mua', {
      status: 200,
      body: { ok: true, mon_id: 'kh_manh_cyan', gia_q: 250, quest_points: 600 },
    }]]);
    renderAt('/shop');
    const o = await timO('[data-mon="kh_manh_cyan"]');
    fireEvent.click(o.querySelector('button')!);

    await waitFor(() => {
      const mua = calls.filter((c) => c.url.includes('/shop/mua'));
      expect(mua.length).toBe(1);
      expect(mua[0]!.body).toEqual({ mon_id: 'kh_manh_cyan' });
    });
  });

  it('lỗi từ server hiện NGUYÊN VĂN, không nuốt thành im lặng', async () => {
    stub([['/shop/mua', {
      status: 409,
      body: { error: 'chua_dinh_gia', message: 'Bản thứ hai của ảnh đại diện này chưa mở bán.' },
    }]]);
    renderAt('/shop');
    const o = await timO('[data-mon="kh_manh_cyan"]');
    fireEvent.click(o.querySelector('button')!);
    expect(await screen.findByRole('alert')).toHaveTextContent(/chưa mở bán/);
  });
});

describe('Hộp phong cách — bốn thứ D25/R1 buộc phải hiện', () => {
  it('TỶ LỆ từng bậc hiện cạnh nút mở, không thu gọn', async () => {
    stub();
    renderAt('/shop');
    const rate = await timO('[data-rate]');
    // Tỷ lệ suy từ bp server trả (7000 → 70%), không phải hằng số trong màn.
    expect(rate.textContent).toMatch(/70%/);
    expect(rate.textContent).toMatch(/25%/);
    expect(rate.textContent).toMatch(/5%/);
  });

  it('MỐC BẢO HIỂM hiện đang ở đâu — nó là lý do người ta bấm lượt tiếp', async () => {
    stub();
    renderAt('/shop');
    const pity = await timO('[data-pity]');
    expect(pity.textContent).toBe('7/20');
  });

  it('SỐ BẢN CÒN LẠI của món hữu hạn hiện rõ; món không giới hạn thì không bịa số',
    async () => {
      stub();
      renderAt('/shop');
      await waitFor(() => {
        expect(document.querySelector('[data-con-lai="st_niem_beta"]')!.textContent)
          .toMatch(/còn 3 bản/);
      });
      // Món không giới hạn KHÔNG được hiện một con số tồn kho giả.
      expect(document.querySelector('[data-con-lai="st_ria_mep"]')).toBeNull();
    });

  it('điều kiện số dư tối thiểu là số SERVER chặn, không phải phép cộng ở client',
    async () => {
      stub();
      renderAt('/shop');
      // can_du_t = 600 trong stub; màn phải in đúng nó.
      expect(await screen.findByText(/600 T/)).toBeInTheDocument();
    });

  it('mở hộp: hiện món rơi + SỐ DƯ SAU LƯỢT (chính con số event ghi lại)', async () => {
    stub([['/shop/hop', { status: 200, body: KET_QUA_HOP }]]);
    renderAt('/shop');
    fireEvent.click(await nutMoHop());

    const kq = await timO('[data-ket-qua]');
    expect(kq.textContent).toMatch(/Kính râm/);
    expect(document.querySelector('[data-du-sau]')!.textContent).toMatch(/900 T/);
    // Và nói thẳng hệ quả không thu hồi được của việc DÁN (D36).
    expect(kq.textContent).toMatch(/tiêu vĩnh viễn/);
  });

  it('mốc bảo hiểm nổ thì NÓI RA, không để người chơi tưởng mình may', async () => {
    stub([['/shop/hop', {
      status: 200,
      body: { ...KET_QUA_HOP, bac: 'epic', bac_goc: 'epic', tu_pity: true, tu_epic: 0 },
    }]]);
    renderAt('/shop');
    fireEvent.click(await nutMoHop());
    expect(await screen.findByText(/mốc bảo hiểm, không phải vì may/)).toBeInTheDocument();
  });

  it('HẠ BẬC vì hết bản phát hành thì nói rõ — tỷ lệ công khai không được là nửa sự thật',
    async () => {
      stub([['/shop/hop', {
        status: 200,
        body: { ...KET_QUA_HOP, bac: 'hiem', bac_goc: 'epic', ha_bac: true },
      }]]);
      renderAt('/shop');
      fireEvent.click(await nutMoHop());
      expect(await screen.findByText(/đã hết bản phát hành/)).toBeInTheDocument();
    });

  it('cờ tắt (mo_duoc=false) thì nút KHOÁ, không phải bấm vào rồi mới báo lỗi', async () => {
    stubFetch([
      ['/auth/me', { status: 200, body: ME_ONBOARDED }],
      ['/shop/catalog', {
        status: 200,
        body: { ...CATALOG, hop: { ...CATALOG.hop, mo_duoc: false } },
      }],
    ]);
    renderAt('/shop');
    expect(await screen.findByRole('button', { name: 'MỞ HỘP' })).toBeDisabled();
  });

  it('nói thẳng cosmetic KHÔNG tăng sức mạnh (D16: cấm pay-to-win)', async () => {
    stub();
    renderAt('/shop');
    expect(await screen.findByText(/không món nào tăng sức mạnh/)).toBeInTheDocument();
  });
});

describe('Token tab — ô Q là vỏ khoá, không phải số 0', () => {
  it('hiện nhãn Q + câu "không có đường quy đổi", KHÔNG in số 0 Q', async () => {
    stubFetch([
      ['/auth/me', { status: 200, body: ME_ONBOARDED }],
      ['/wallet', { status: 200, body: { bankroll: 1000, entries: [], next_before: null } }],
    ]);
    renderAt('/vi');
    expect(await screen.findByText('ĐIỂM QUEST (Q)')).toBeInTheDocument();
    expect(screen.getByText(/không có đường quy đổi/)).toBeInTheDocument();
    // In "0 Q" là bịa một loại tiền đang tồn tại — Q chưa có nguồn phát nào.
    expect(document.querySelector('main')!.textContent).not.toMatch(/\b0\s?Q\b/);
  });
});
