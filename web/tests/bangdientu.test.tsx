/**
 * BẢNG ĐIỆN TỬ — pop-up trả phí.
 *
 * ⚠ TEST NÀY CỐ Ý ĐI QUA HOOK THẬT + `fetch` GIẢ, không mock component con.
 * Đã có tiền lệ trong repo: một test route xanh chỉ vì component crash trước khi
 * tới chỗ được khẳng định. Nên mỗi ca ở đây khẳng định CẢ chuỗi — bấm → POST đúng
 * đường dẫn → payload đủ hình dạng DTO → chữ đúng hiện ra màn.
 *
 * Bốn chỗ canh, đều là chỗ mất tiền hoặc mất niềm tin nếu trôi:
 *   1. GIÁ phải hiện TRƯỚC khi bấm (thu tiền không báo giá = lừa).
 *   2. Sự kiện vòng hiện tại phải ra "?" (LUẬT 1) và phải nói vì sao.
 *   3. Nhánh lỗi phải hiện LỖI, KHÔNG được rơi về skeleton — màn chỉ có "đang
 *      chờ" thì không phân biệt được chậm với chết.
 *   4. Mở lại trong cùng vòng KHÔNG được bắn POST lần hai.
 */
import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { QueryClientProvider } from '@tanstack/react-query';
import { makeQueryClient } from '@/api/queries';
import { BangDienTu, phiNiemYet } from '../src/components/holdem/BangDienTu';
import { PHI_BANG_DIEN_TU_MAC_DINH, type BangDienTuDTO } from '../src/api/holdem';
import { stubFetch, type RecordedCall } from './helpers';

/**
 * DTO ĐỦ HÌNH DẠNG — sáu thanh (hai mã sương mù) + ba trạng thái sổ cái.
 *
 * Fixture nghèo là cách rẻ nhất để có một test xanh rỗng: thiếu dòng `an` thì ca
 * "?" không kiểm được gì, thiếu mã sương mù thì nhánh biên độ không chạy lần nào.
 */
function dto(patch: Partial<BangDienTuDTO> = {}): BangDienTuDTO {
  return {
    vong: 4,
    phi: 25,
    thanh_khoan: [
      {
        tai_san_id: 'usd', label: 'Stablecoin', icon: '🪙', nac_nen: 'day', nac: 'day',
        vach: 3, tong_vach: 3, do_sau: 2400, suong_mu: false,
      },
      {
        tai_san_id: 'vn30', label: 'Blue-chip', icon: '📊', nac_nen: 'vua', nac: 'mong',
        vach: 1, tong_vach: 3, do_sau: 800, suong_mu: false,
      },
      {
        tai_san_id: 'tpcp', label: 'TPCP', icon: '🏛', nac_nen: 'day', nac: 'vua',
        vach: 2, tong_vach: 3, do_sau: 1600, suong_mu: false,
      },
      {
        tai_san_id: 'vang', label: 'Vàng', icon: '🥇', nac_nen: 'vua', nac: 'vua',
        vach: 2, tong_vach: 3, do_sau: 1600, suong_mu: false,
      },
      {
        tai_san_id: 'btc', label: 'Crypto', icon: '◈', nac_nen: 'mong', nac: null,
        vach: null, tong_vach: 3, do_sau: null, suong_mu: true,
        bien: ['mong', 'vua'], bien_vach: [1, 2],
      },
      {
        tai_san_id: 'cp_cn', label: 'Cổ tech', icon: '💻', nac_nen: 'vua',
        nac: null, vach: null, tong_vach: 3, do_sau: null, suong_mu: true,
        bien: ['vua', 'day'], bien_vach: [2, 3],
      },
    ],
    so_cai: [
      // A. ĐỦ SÁNG — vào tổng ròng.
      {
        vong: 1, su_kien: 'chien_tranh', label: 'Chiến tranh', icon: '⚔',
        do_lon_bp: 4000, con_vong: 1, dao: false, luc_bp: -400, an: false,
      },
      // A' — echo ĐẢO (tin giả đã lộ) và đang ở vòng hiệu lực cuối.
      {
        vong: 2, su_kien: 'bong_bong', label: 'Bong bóng', icon: '🫧',
        do_lon_bp: 2000, con_vong: 0, dao: true, luc_bp: 150, an: false,
      },
      // B. NỬA SÁNG — biết ĐỘ LỚN, chưa biết CHIỀU. KHÔNG vào tổng ròng.
      {
        vong: 3, su_kien: 'ha_lai_suat', label: 'Hạ lãi suất', icon: '📉',
        do_lon_bp: 3000, con_vong: 3, dao: null, luc_bp: null, an: false,
      },
      // C. "?" — LUẬT 1, ô vừa lật đầu vòng này.
      {
        vong: 4, su_kien: 'thien_nga_den', label: 'Thiên nga đen', icon: '🦢',
        do_lon_bp: null, con_vong: null, dao: null, luc_bp: null, an: true,
      },
    ],
    // −400 + 150. Hai dòng chưa rõ chiều KHÔNG được cộng vào — đó là cả điểm của
    // `so_dong_chua_ro`.
    tong_rong_bp: -250,
    so_dong_chua_ro: 2,
    gia_dinh_tin_that: true,
    ...patch,
  };
}

type Props = Parameters<typeof BangDienTu>[0];

/**
 * Render với MỘT query client dùng lại được ở `rerender` — client mới mỗi lần vẽ
 * thì trạng thái mutation bị dọn, và ca "sang vòng mới" sẽ xanh vì lý do sai.
 */
function ve(props: Partial<Props> = {}) {
  const qc = makeQueryClient();
  const boc = (p: Props) => (
    <QueryClientProvider client={qc}><BangDienTu {...p} /></QueryClientProvider>
  );
  const day: Props = { matchId: 'm1', vong: 4, von: 900, phi: 25, ...props };
  const r = render(boc(day));
  return { ...r, veLai: (p: Partial<Props>) => r.rerender(boc({ ...day, ...p })) };
}

const moBang = () => fireEvent.click(screen.getByRole('button', { name: /Bảng điện tử/ }));

describe('phiNiemYet — catalog thắng hằng số dự phòng', () => {
  it('có giá từ catalog thì dùng giá đó', () => {
    expect(phiNiemYet(40)).toBe(40);
    expect(phiNiemYet(0)).toBe(0);
  });

  it('thiếu / hỏng thì rơi về hằng số, không ra NaN', () => {
    expect(phiNiemYet(undefined)).toBe(PHI_BANG_DIEN_TU_MAC_DINH);
    expect(phiNiemYet(Number.NaN)).toBe(PHI_BANG_DIEN_TU_MAC_DINH);
    expect(phiNiemYet(-5)).toBe(PHI_BANG_DIEN_TU_MAC_DINH);
  });
});

describe('Nút mở — niêm yết giá TRƯỚC khi bấm', () => {
  it('🔴 hiện phí "25 Vốn" ngay trên nút, chưa gọi API lần nào', () => {
    const calls = stubFetch([['/bang-dien-tu', { status: 200, body: dto() }]]);
    ve();
    expect(screen.getByText('25 Vốn')).toBeInTheDocument();
    expect(calls, 'chưa bấm mà đã gọi API = đã trừ Vốn').toHaveLength(0);
  });

  it('giá lấy từ prop, không tự gõ hằng số trong nút', () => {
    stubFetch([['/bang-dien-tu', { status: 200, body: dto() }]]);
    ve({ phi: 40 });
    expect(screen.getByText('40 Vốn')).toBeInTheDocument();
  });
});

describe('Mở bảng — hai chỉ báo', () => {
  async function moVaCho(): Promise<RecordedCall[]> {
    const calls = stubFetch([['/bang-dien-tu', { status: 200, body: dto() }]]);
    ve();
    moBang();
    // 02/08 — sổ cái thu gọn sau <summary> "SỔ CÁI DƯ ÂM · N dòng"; bấm mở
    // để các test dưới đọc từng dòng đúng như người chơi thật sẽ làm.
    fireEvent.click(await screen.findByText(/SỔ CÁI DƯ ÂM/));
    return calls;
  }

  it('POST đúng đường dẫn kèm vòng — không phải GET (lần mở TRỪ VỐN)', async () => {
    const calls = await moVaCho();
    const c = calls.find((x) => x.url.includes('/bang-dien-tu'));
    expect(c?.method).toBe('POST');
    expect(c?.url).toContain('/holdem/matches/m1/bang-dien-tu');
    expect(c?.body).toEqual({ vong: 4 });
  });

  it('🔴 sự kiện vòng HIỆN TẠI ra "?" và nói rõ vì sao (LUẬT 1)', async () => {
    await moVaCho();
    // Tên sự kiện KHÔNG bị che — người chơi đã thấy ô lật rồi, chỉ SỐ bị che.
    expect(screen.getByText('Thiên nga đen')).toBeInTheDocument();
    expect(screen.getByText(/Báo cáo trễ một vòng/)).toBeInTheDocument();
    /*
     * HAI dấu "?": dòng bị độ trễ che (LUẬT 1) và dòng chưa lộ cờ tin giả. Hai
     * dòng đó khác nhau ở PHẦN CHÚ, không ở ô lực — cả hai đều thật sự chưa biết
     * chiều nên cả hai đều phải là "?", và cả hai đều đứng ngoài tổng ròng.
     */
    expect(screen.getAllByText('?')).toHaveLength(2);
  });

  it('dòng NỬA SÁNG hiện độ lớn nhưng nói rõ KHÔNG tính vào tổng ròng', async () => {
    await moVaCho();
    expect(screen.getByText('Hạ lãi suất')).toBeInTheDocument();
    expect(screen.getByText(/chưa rõ chiều/)).toBeInTheDocument();
    expect(screen.getByText(/không tính vào tổng ròng/)).toBeInTheDocument();
  });

  it('tổng ròng + số dòng chưa rõ đều hiện (thiếu cái sau là đọc nhầm cái trước)', async () => {
    await moVaCho();
    // Lực từng nguồn hiện riêng, tổng ròng hiện riêng — người chơi không phải
    // cộng nhẩm phần server đã chịu bán.
    expect(screen.getByText('−400 bp')).toBeInTheDocument();
    expect(screen.getByText('+150 bp')).toBeInTheDocument();
    expect(screen.getByText(/TỔNG LỰC KÉO RÒNG/)).toBeInTheDocument();
    expect(screen.getByText('−250 bp')).toBeInTheDocument();
    /*
     * D336 lượt 2 — cảnh báo thôi là hộp chữ, thành N ô gạch trên CHÍNH hàng tổng. Thứ canh vẫn là
     * THÔNG TIN: số dòng bị che phải có mặt ngay cạnh tổng, và câu "CHƯA ĐỦ" vẫn đọc được bằng tên.
     */
    const an = screen.getByRole('img', { name: /Còn 2 dòng chưa đọc được — tổng ròng CHƯA ĐỦ/ });
    expect(an.getAttribute('data-an')).toBe('2');
    expect(an.querySelectorAll('i')).toHaveLength(2);
    expect(an.closest('[class*="_tong_"]'), 'ô gạch phải nằm trên hàng TỔNG, không trôi đi chỗ khác')
      .not.toBeNull();
  });

  it('echo ĐẢO và vòng hiệu lực cuối đều gọi đúng tên', async () => {
    await moVaCho();
    expect(screen.getByText(/ĐẢO \(tin giả đã lộ\)/)).toBeInTheDocument();
    expect(screen.getByText(/vòng cuối/)).toBeInTheDocument();
  });

  it('🔴 mã sương mù nói rõ là ƯỚC LƯỢNG và nấc thật CÓ THỂ nằm ngoài', async () => {
    await moVaCho();
    // Hai mã đầu cơ, mỗi mã một nhãn ƯỚC LƯỢNG.
    expect(screen.getAllByText('ƯỚC LƯỢNG')).toHaveLength(2);
    expect(screen.getByText(/có thể nằm ngoài/)).toBeInTheDocument();
    // Sáu thanh, đủ mã — thiếu thanh nào là chỉ báo 1 vẽ hụt.
    expect(screen.getByText('Crypto')).toBeInTheDocument();
    expect(screen.getByText('Cổ tech')).toBeInTheDocument();
  });

  it('cờ gia_dinh_tin_that bật thì phải NÓI RA', async () => {
    await moVaCho();
    expect(screen.getByText(/giả định tin vòng này là THẬT/)).toBeInTheDocument();
  });

  it('KHÔNG render emoji của DTO — icon hệ điều hành cạnh art pixel là chỗ chỏi nhất', async () => {
    stubFetch([['/bang-dien-tu', { status: 200, body: dto() }]]);
    const { baseElement } = ve();
    moBang();
    await screen.findByText(/SỔ CÁI DƯ ÂM/);
    const txt = baseElement.textContent ?? '';
    for (const e of ['💵', '📊', '🏛', '🥇', '₿', '💻', '⚔', '📉', '🦢']) {
      expect(txt, `emoji ${e} lọt ra màn`).not.toContain(e);
    }
  });
});

describe('Ba trạng thái rời nhau', () => {
  it('🔴 nhánh LỖI hiện lỗi, KHÔNG rơi về skeleton', async () => {
    stubFetch([['/bang-dien-tu', {
      status: 500, body: { error: 'server_error', message: 'x' },
    }]]);
    ve();
    moBang();
    const loi = await screen.findByRole('alert');
    expect(loi).toHaveTextContent(/Không mở được Bảng điện tử/);
    expect(screen.getByRole('button', { name: /THỬ LẠI/ })).toBeInTheDocument();
    // Đây là chỗ dễ trôi nhất: skeleton còn nằm lại thì màn nói "đang chờ" trong
    // khi thật ra đã chết.
    expect(document.querySelector('[data-cho="bang-dien-tu"]')).toBeNull();
  });

  it('THỬ LẠI gọi lại API', async () => {
    let lan = 0;
    vi.stubGlobal('fetch', vi.fn(async () => {
      lan += 1;
      return lan === 1
        ? new Response(JSON.stringify({ error: 'x', message: 'x' }), { status: 500 })
        : new Response(JSON.stringify(dto()), {
          status: 200, headers: { 'content-type': 'application/json' },
        });
    }));
    ve();
    moBang();
    fireEvent.click(await screen.findByRole('button', { name: /THỬ LẠI/ }));
    await screen.findByText(/SỔ CÁI DƯ ÂM/);
    expect(lan).toBe(2);
  });

  it('🔴 KHÔNG đủ Vốn → nói thẳng, và KHÔNG gọi API (không trừ tiền hụt)', async () => {
    const calls = stubFetch([['/bang-dien-tu', { status: 200, body: dto() }]]);
    ve({ von: 10, phi: 25 });
    moBang();
    expect(screen.getByRole('status')).toHaveTextContent(/Không đủ/);
    // ⚠ PHẢI XẢ HÀNG ĐỢI TRƯỚC KHI KHẲNG ĐỊNH. `mutate` của react-query chạy
    // mutationFn trong microtask, nên khẳng định ngay sau `fireEvent` sẽ XANH kể
    // cả khi chốt chặn đã bị gỡ — đo được đúng thế bằng cách gỡ chốt rồi chạy lại.
    await new Promise((r) => { setTimeout(r, 0); });
    expect(calls.filter((c) => c.url.includes('/bang-dien-tu'))).toHaveLength(0);
    // Và giá trên nút phải cảnh báo TRƯỚC khi bấm, không phải sau.
    expect(screen.getByText('25 Vốn')).toBeInTheDocument();
  });

  it('đang tải thì có skeleton CÓ NHÃN, không phải ô trắng vô danh', async () => {
    stubFetch([['/bang-dien-tu', { status: 200, body: dto() }]]);
    ve();
    moBang();
    expect(document.querySelector('[data-cho="bang-dien-tu"]')).not.toBeNull();
    await screen.findByText(/SỔ CÁI DƯ ÂM/);
  });
});

describe('Bảo vệ Vốn — mở lại trong cùng vòng', () => {
  it('🔴 đóng rồi mở lại KHÔNG bắn POST lần hai', async () => {
    const calls = stubFetch([['/bang-dien-tu', { status: 200, body: dto() }]]);
    ve();
    moBang();
    await screen.findByText(/SỔ CÁI DƯ ÂM/);
    fireEvent.click(screen.getByRole('button', { name: 'Đóng' }));
    moBang();
    await screen.findByText(/SỔ CÁI DƯ ÂM/);
    expect(
      calls.filter((c) => c.url.includes('/bang-dien-tu')),
      'mở lại mà gọi API lần nữa = một dòng thừa trong action_log',
    ).toHaveLength(1);
    // Và nút nói rõ lần này miễn phí, không niêm yết lại 25.
    expect(screen.getByText('ĐÃ MỞ')).toBeInTheDocument();
  });

  it('Esc đóng lớp phủ — không bẫy người chơi trong bảng', async () => {
    stubFetch([['/bang-dien-tu', { status: 200, body: dto() }]]);
    ve();
    moBang();
    await screen.findByText(/SỔ CÁI DƯ ÂM/);
    fireEvent.keyDown(window, { key: 'Escape' });
    expect(screen.queryByText(/SỔ CÁI DƯ ÂM/)).toBeNull();
  });

  it('sang vòng MỚI thì lớp phủ đóng và giá niêm yết trở lại', async () => {
    stubFetch([['/bang-dien-tu', { status: 200, body: dto() }]]);
    const { veLai } = ve();
    moBang();
    await screen.findByText(/SỔ CÁI DƯ ÂM/);
    // Nội dung cũ nói về vòng cũ. Để nó nằm lại là bán số liệu sai cho một vòng
    // người chơi chưa trả tiền.
    veLai({ vong: 5 });
    await waitFor(() => expect(screen.queryByText(/SỔ CÁI DƯ ÂM/)).toBeNull());
    expect(screen.getByText('25 Vốn')).toBeInTheDocument();
  });
});

/**
 * LỆCH PHIÊN BẢN FRONTEND ↔ API. Hai lệnh deploy riêng nên "payload thiếu trường"
 * là trạng thái BÌNH THƯỜNG, không phải sự cố. Một pop-up tuỳ chọn KHÔNG được
 * phép ném lỗi lên ErrorBoundary của router và cuốn theo cả bàn đấu đang chơi.
 */
describe('Chịu được payload lệch phiên bản', () => {
  it('mã sương mù thiếu bien/bien_vach → vẫn vẽ, không ném lỗi', async () => {
    const thieu = dto({
      thanh_khoan: [{
        tai_san_id: 'btc', label: 'Crypto', icon: '◈', nac_nen: 'mong', nac: null,
        vach: null, tong_vach: 3, do_sau: null, suong_mu: true,
      }],
    });
    stubFetch([['/bang-dien-tu', { status: 200, body: thieu }]]);
    ve();
    moBang();
    expect(await screen.findByText('Crypto')).toBeInTheDocument();
    expect(screen.getByText('ƯỚC LƯỢNG')).toBeInTheDocument();
  });

  it('sổ cái rỗng → nói thẳng, không để trống lửng lơ', async () => {
    stubFetch([['/bang-dien-tu', {
      status: 200,
      body: dto({ so_cai: [], tong_rong_bp: 0, so_dong_chua_ro: 0 }),
    }]]);
    ve();
    moBang();
    expect(await screen.findByText(/Chưa có dư âm nào/)).toBeInTheDocument();
    expect(screen.getByRole('img', { name: /Không còn dòng nào bị che/ })).toBeInTheDocument();
  });
});

describe('⭐ Trực quan hoá: art dùng lại + chú giải thu sau dấu (!)', () => {
  /*
   * Founder 23/08: *"Phần bảng điện tử… quá nhiều text, hãy xóa những text
   * không cần thiết và thu gọn những text cần thiết lại thành icon chú thích
   * rồi trực quan hóa hình ảnh sao cho player không cần đọc quá nhiều"*.
   *
   * ⚠ VÌ SAO BÀI NÀY TỒN TẠI thay vì soi bằng mắt: khối DỰ BÁO chỉ mở ở hạng
   * +30 (cần Lướt Sóng), và khối XÁC THỰC chỉ mở ở CẤP 2. Săn đúng hai điều
   * kiện đó trên một trận sống là chuyện may rủi — soi bốn trận liền không gặp.
   * Dựng thẳng payload thì ca nào cũng chạy được, mỗi lần.
   */
  const ART = {
    usd: '<svg data-a="usd"/>', vn30: '<svg/>', tpcp: '<svg/>',
    vang: '<svg/>', btc: '<svg/>', cp_cn: '<svg/>',
    sk_hack_san: '<svg data-a="sk"/>', gd_tang: '<svg data-a="gd"/>',
  };

  it('hàng THANH KHOẢN mang hình của CHÍNH mã đó', () => {
    stubFetch([['/bang-dien-tu', { status: 200, body: dto() }]]);
    // D443 — lớp phủ bảng đi qua portal ra <body> ⇒ đọc trong baseElement, không trong container.
    const { baseElement: container } = ve({ art: ART });
    moBang();
    return screen.findByText(/THANH KHOẢN SỔ LỆNH/).then(() => {
      expect(container.querySelectorAll('[class*="_tkArt_"]').length,
        'sáu hàng thanh khoản phải có sáu hình').toBe(6);
    });
  });

  it('⭐ ô DỰ BÁO mang ĐÚNG hình sẽ lật trên bản đồ (sự kiện lẫn giai đoạn)', () => {
    /*
     * Cái lợi thật không phải bớt chữ mà là BỎ BƯỚC BẮC CẦU: trước bản này map
     * nói bằng art pixel còn bảng nói bằng một dòng chữ, nên người chơi phải tự
     * nối hai thứ bằng cách đọc tên. Nay cùng một hình.
     */
    stubFetch([['/bang-dien-tu', { status: 200, body: dto({
      du_bao: { vong: 5, so_ten_sai: 1, ten: [
        { kind: 'su_kien', id: 'hack_san', label: 'Sập sàn', icon: '' },
        { kind: 'giai_doan', id: 'tang', label: 'Tăng', icon: '' },
      ] },
    }) }]]);
    // D443 — lớp phủ bảng đi qua portal ra <body> ⇒ đọc trong baseElement, không trong container.
    const { baseElement: container } = ve({ art: ART });
    moBang();
    return screen.findByText(/DỰ BÁO Ô VÒNG/).then(() => {
      expect(container.querySelectorAll('[class*="_duBaoArt_"]').length,
        'ô dự báo chưa lấy art').toBe(2);
      // Vế "có N tên SAI" phải ở TIÊU ĐỀ — D33 gọi nó là toàn bộ điểm cân bằng
      // của đặc quyền, nên nó không được thu vào sau dấu (!).
      expect(container.querySelector('[class*="_mucCanh_"]')?.textContent)
        .toMatch(/1 SAI/);
    });
  });

  it('⭐ tin giả: số + THANH VẠCH, số vạch khớp phần trăm', () => {
    stubFetch([['/bang-dien-tu', { status: 200, body: dto({
      xac_thuc: { xac_suat_gia_bp: 3500, lo_som: null },
    }) }]]);
    // D443 — lớp phủ bảng đi qua portal ra <body> ⇒ đọc trong baseElement, không trong container.
    const { baseElement: container } = ve({ art: ART });
    moBang();
    return screen.findByText(/GIẢ 35%/).then(() => {
      const o = [...container.querySelectorAll('[class*="_tinGiaVach_"] i')];
      expect(o.length, 'thanh phải có 10 vạch').toBe(10);
      /*
       * ⚠ ĐẾM VẠCH ĐẦY BẰNG className KHÁC RỖNG, không bằng `i[class]`:
       * React vẫn đặt `class=""` khi ternary ra chuỗi rỗng, nên `i[class]` khớp
       * CẢ MƯỜI. Phép đo đầu của tôi trên stack đã báo "10/10 đầy" cho một con
       * số 8% và suýt thành một chẩn đoán sai.
       */
      const day = o.filter((e) => (e.className || '').trim() !== '').length;
      expect(day, '35% phải đầy ~4 vạch').toBe(4);
    });
  });

  it('chú giải dùng glyph `!` — `?` trong bảng này đang mang nghĩa "chưa biết"', () => {
    stubFetch([['/bang-dien-tu', { status: 200, body: dto() }]]);
    // D443 — lớp phủ bảng đi qua portal ra <body> ⇒ đọc trong baseElement, không trong container.
    const { baseElement: container } = ve({ art: ART });
    moBang();
    return screen.findByText(/THANH KHOẢN SỔ LỆNH/).then(() => {
      const nut = [...container.querySelectorAll('[class*="_chuGiaiNut_"]')];
      expect(nut.length, 'không có nút chú giải nào').toBeGreaterThan(0);
      for (const n of nut) expect(n.textContent).toBe('!');
    });
  });
});

describe('K4 (D164) — VỊ TRÍ TRONG CHUỖI VĨ MÔ', () => {
  it('⭐ có dữ liệu ⇒ hiện hướng · tuổi · môi trường (chữ từ ID server)', async () => {
    stubFetch([['/bang-dien-tu', {
      status: 200,
      body: dto({ chuoi_vi_mo: { huong: 'xuong', dai: 3, moi_truong: 'dat' } }),
    }]]);
    ve();
    moBang();
    // D336 lượt 2 — vẽ bằng vật: ba mũi tên xuống cho ba ô chuỗi, câu đầy đủ ở tên (aria-label).
    const dong = await screen.findByRole('img', { name: /Chuỗi vĩ mô/ });
    const ten = dong.getAttribute('aria-label') ?? '';
    expect(ten).toContain('GIẢM');
    expect(ten).toContain('3 ô');
    expect(ten).toContain('ĐẮT');
    expect(dong.textContent).toContain('▼▼▼');
    expect(dong.textContent).not.toContain('▼▼▼▼');
    expect(dong.textContent).toContain('TIỀN ĐẮT');
  });

  it('server cũ (vắng trường) hoặc null ⇒ không hàng, không vỡ', async () => {
    stubFetch([['/bang-dien-tu', { status: 200, body: dto() }]]);
    ve();
    moBang();
    await screen.findByText(/THANH KHOẢN SỔ LỆNH/);
    expect(screen.queryByRole('img', { name: /Chuỗi vĩ mô/ })).toBeNull();
  });
});

describe('D443 — nút xuống thanh đáy: lớp phủ bảng ra <body>, bản gọn vẫn in giá', () => {
  /*
   * Thanh đáy là `position: sticky; z-index: 45` ⇒ một ngữ cảnh xếp chồng riêng. Lớp phủ để trong đó thì `z-index: 85`
   * của nó chỉ có nghĩa BÊN TRONG thanh — menu chính (fixed, 50) đè lên bảng. Portal ra <body> là đường duy nhất.
   */
  it('⭐ mở bảng ⇒ hộp thoại là con trực tiếp của <body>, không nằm trong khung chứa nút', async () => {
    stubFetch([['/bang-dien-tu', { status: 200, body: dto() }]]);
    const { container } = ve({ gon: true });
    moBang();
    const hop = await screen.findByRole('dialog', { name: 'Bảng điện tử' });
    expect(hop.parentElement).toBe(document.body);
    expect(container.contains(hop)).toBe(false);
  });

  it('bản gọn: chữ "BẢNG", giá vẫn in thẳng trên nút', () => {
    stubFetch([['/bang-dien-tu', { status: 200, body: dto() }]]);
    ve({ gon: true });
    expect(screen.getByText('BẢNG')).toBeInTheDocument();
    expect(screen.getByText('25 Vốn')).toBeInTheDocument();
  });
});
