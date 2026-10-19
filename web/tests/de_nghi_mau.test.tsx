/**
 * ORACLE GIÚP 2 trên ĐƯỜNG THẬT — thẻ đề nghị lưu mẫu một chạm (`DeNghiMau.tsx`, D365).
 *
 * ⚠ Bài đắt nhất là §III (**ĐỔI Ý**) và §IV (**hỏi một lần, qua cả lần mở app sau**): cái đầu
 * là luật "không ngõ cụt" của founder; cái sau là chỗ một thẻ "giúp" biến thành thứ hỏi mãi
 * một câu — và cả hai đều XANH nếu chỉ thử "bấm LƯU rồi xem có mẫu không".
 */
import { describe, expect, it } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { DeNghiMau } from '../src/components/pfm/DeNghiMau';
import { KhoProvider } from '../src/pfm/dung_kho';
import { KhoTrongBoNho } from '../src/pfm/kho.js';
import { docKhoaDaHoi } from '../src/pfm/khoan_lap.js';
import { homNay } from '../src/pfm/thoi_gian.js';
import type { Khoan, MauLap } from '../src/pfm/so.js';
import { CHU_GIUP } from '../src/lib/pfm_chu';
import { tuKeDonTrong } from '../src/lib/khoanh_khac';

const LUC = '2026-09-21T03:00:00.000Z';

/** N ngày trước hôm nay — bài không được ghim ngày cứng, cửa sổ đếm lùi từ đồng hồ thật. */
function luiNgay(n: number): string {
  const d = new Date(`${homNay()}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() - n);
  return d.toISOString().slice(0, 10);
}

function khoan(i: number, ngay: string, soTien: number, ghiChu?: string): Khoan {
  return {
    id: `k${i}`, ngay, soTien, chieu: 'chi', nhan: null, huId: null, cachGhi: 'tay',
    viSale: null, taoLuc: LUC, suaLuc: LUC, ...(ghiChu === undefined ? {} : { ghiChu }),
  };
}

/** Ba lần "cà phê 25.000" trong 14 ngày ⇒ đủ ngưỡng khoá-có-ghi-chú. */
async function khoBaLan(): Promise<KhoTrongBoNho> {
  const kho = new KhoTrongBoNho();
  const ds = [khoan(1, luiNgay(9), 25_000, 'cà phê'), khoan(2, luiNgay(4), 25_000, 'Cà Phê'), khoan(3, luiNgay(0), 25_000, 'cà  phê')];
  for (const k of ds) await kho.ghi('khoan', { id: k.id, thang: k.ngay.slice(0, 7), suaLuc: LUC, d: k });
  return kho;
}

function ve(kho: KhoTrongBoNho) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={qc}>
      <KhoProvider kho={kho}><DeNghiMau /></KhoProvider>
    </QueryClientProvider>,
  );
}

const mauTrongKho = async (kho: KhoTrongBoNho): Promise<MauLap[]> =>
  (await kho.liet<MauLap>('mau_lap')).map((b) => b.d);

/**
 * ⚠⚠ CHỜ ĐÚNG MỐC "ĐÃ NẠP XONG MÀ VẪN IM". `waitFor(… queryByTestId(…) toBeNull())` là một
 * khẳng định RỖNG ở đây: lúc kho chưa nạp xong thì DOM cũng trống, nên nó xanh tức khắc.
 * Hai mũi tiêm (ĐỔI không gỡ khoá · khoá của mẫu dựng sai) đều KHÔNG đỏ cho tới khi bài
 * chờ nhịp `aria-busy` của vùng im lặng.
 */
async function choImLang(): Promise<void> {
  await waitFor(() => {
    expect(screen.getByTestId('lap-vung').getAttribute('aria-busy')).toBe('false');
  });
  expect(screen.queryByTestId('lap-de-nghi')).toBeNull();
}

describe('§I — khi nào thẻ hiện', () => {
  it('⭐ ba lần cùng khoá trong 14 ngày ⇒ hiện thẻ, nói đúng SỐ LẦN và số tiền', async () => {
    ve(await khoBaLan());
    const the = await screen.findByTestId('lap-de-nghi');
    expect(the.textContent).toContain('3');
    expect(the.textContent).toContain('25.000');
    expect(the.textContent).toContain('cà phê');
  });

  it('sổ chưa đủ ngưỡng ⇒ không vẽ gì cả (im lặng là kết quả hợp lệ)', async () => {
    const kho = new KhoTrongBoNho();
    for (const k of [khoan(1, luiNgay(3), 25_000, 'cà phê'), khoan(2, luiNgay(1), 25_000, 'cà phê')]) {
      await kho.ghi('khoan', { id: k.id, thang: k.ngay.slice(0, 7), suaLuc: LUC, d: k });
    }
    ve(kho);
    await choImLang();
    expect(screen.queryByTestId('lap-da-tra-loi')).toBeNull();
  });
});

describe('§II — LƯU MẪU', () => {
  it('⭐⭐ bấm LƯU ⇒ mẫu vào kho ĐÚNG tên + số tiền, và thẻ thu thành một dòng', async () => {
    const kho = await khoBaLan();
    ve(kho);
    fireEvent.click(await screen.findByText(CHU_GIUP.lapLuu));
    await screen.findByTestId('lap-da-tra-loi');
    const mau = await mauTrongKho(kho);
    expect(mau).toHaveLength(1);
    expect([mau[0]!.ten, mau[0]!.soTien, mau[0]!.chieu]).toEqual(['cà phê', 25_000, 'chi']);
    expect(screen.getByTestId('lap-da-tra-loi').textContent).toContain(CHU_GIUP.lapDaLuu);
  });

  it('⭐⭐⭐ mẫu vừa lưu KHOÁ luôn câu hỏi ấy — dựng lại màn không hỏi lại lần nữa', async () => {
    /*
     * ⚠ Hai đường cùng phải đúng: khoá vào "đã hỏi", VÀ khoá của mẫu khớp khoá đã đếm ra nó.
     * Nếu `khoaCuaMau` dựng từ một trường khác (mẫu không có `ghiChu`, chỉ có `ten`) thì người
     * dùng lưu mẫu xong vẫn bị hỏi đúng câu ấy ở lần mở app sau.
     */
    const kho = await khoBaLan();
    const r = ve(kho);
    fireEvent.click(await screen.findByText(CHU_GIUP.lapLuu));
    await screen.findByTestId('lap-da-tra-loi');
    r.unmount();

    ve(kho);
    await choImLang();
    expect(await docKhoaDaHoi(kho)).toContain('25000|cà phê');
  });
});

describe('§II-bis — mẫu ĐÃ CÓ SẴN trong kho (lưu từ đường khác) cũng khoá câu hỏi', () => {
  it('⭐⭐ khoá của MẪU phải khớp khoá đếm ra nó — mẫu dựng từ `ten`, khoản dựng từ `ghiChu`', async () => {
    /*
     * ⚠ `MauLap` KHÔNG có trường `ghiChu`; `ten` của nó mới là thứ đi vào `ghiChu` của khoản
     * (`tuMauLap`). Dựng khoá của mẫu từ nhầm trường thì người dùng đã có mẫu vẫn bị hỏi mãi —
     * và danh sách "đã hỏi" không cứu được, vì đường lưu mẫu ở màn khác không ghi vào đó.
     */
    const kho = await khoBaLan();
    const m: MauLap = { id: 'msan', ten: 'Cà Phê', soTien: 25_000, chieu: 'chi', nhan: null, huId: null, taoLuc: LUC };
    await kho.ghi<MauLap>('mau_lap', { id: m.id, thang: '2026-09', suaLuc: LUC, d: m });
    ve(kho);
    await choImLang();
  });
});
describe('§III — ⭐⭐⭐ KHÔNG NGÕ CỤT: đổi ý sau khi đã trả lời', () => {
  it('LƯU rồi ĐỔI ⇒ mẫu bị xoá, khoá được gỡ, thẻ hiện lại nguyên trạng', async () => {
    const kho = await khoBaLan();
    ve(kho);
    fireEvent.click(await screen.findByText(CHU_GIUP.lapLuu));
    await screen.findByTestId('lap-da-tra-loi');

    fireEvent.click(screen.getByText(CHU_GIUP.lapDoi));
    expect(await screen.findByTestId('lap-de-nghi')).toBeInTheDocument();
    await waitFor(async () => { expect(await mauTrongKho(kho)).toHaveLength(0); });
    expect(await docKhoaDaHoi(kho)).not.toContain('25000|cà phê');
  });

  it('KHÔNG rồi ĐỔI ⇒ cũng quay lại được (nhánh không tạo mẫu)', async () => {
    const kho = await khoBaLan();
    ve(kho);
    fireEvent.click(await screen.findByText(CHU_GIUP.lapThoi));
    const gon = await screen.findByTestId('lap-da-tra-loi');
    expect(gon.textContent).toContain(CHU_GIUP.lapDaThoi);
    expect(await mauTrongKho(kho), 'nói KHÔNG thì không có mẫu nào ra đời').toHaveLength(0);

    fireEvent.click(screen.getByText(CHU_GIUP.lapDoi));
    expect(await screen.findByTestId('lap-de-nghi')).toBeInTheDocument();
  });
});

describe('§IV — hỏi MỘT lần: nói KHÔNG thì thôi hẳn', () => {
  it('⭐⭐ bấm KHÔNG rồi dựng lại màn ⇒ im, không hỏi lại câu ấy', async () => {
    const kho = await khoBaLan();
    const r = ve(kho);
    fireEvent.click(await screen.findByText(CHU_GIUP.lapThoi));
    await screen.findByTestId('lap-da-tra-loi');
    r.unmount();

    ve(kho);
    await choImLang();
  });
});

describe('§V — quét TU_KE_DON trên mọi chữ mới', () => {
  it('thẻ đề nghị sạch (A10: tả + hỏi, không kê đơn)', async () => {
    ve(await khoBaLan());
    const the = await screen.findByTestId('lap-de-nghi');
    expect(tuKeDonTrong(the.textContent ?? '')).toEqual([]);
  });
});
