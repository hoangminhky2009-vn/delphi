/**
 * ORACLE GIÚP 5 trên ĐƯỜNG THẬT — "tiền đi tới ngày nào" (`TienToiNgay.tsx`, D365).
 *
 * ⚠ Bài đắt nhất là §II (**câu luôn mang vế "giữ nhịp N ngày qua"**): bỏ vế ấy đi là biến
 * một phép chia trên sổ thành lời tiên tri, và không bài test nào khác bắt được — chữ vẫn
 * đọc trôi chảy, con số vẫn đúng.
 */
import { describe, expect, it } from 'vitest';
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { TienToiNgay, daiLich } from '../src/components/pfm/TienToiNgay';
import { KhoProvider } from '../src/pfm/dung_kho';
import { KhoTrongBoNho } from '../src/pfm/kho.js';
import { docPhanHoiNhip } from '../src/pfm/nhip_giup.js';
import { homNay } from '../src/pfm/thoi_gian.js';
import type { Khoan } from '../src/pfm/so.js';
import { CHU_GIUP } from '../src/lib/pfm_chu';
import { tuKeDonTrong } from '../src/lib/khoanh_khac';

const LUC = '2026-09-21T05:00:00.000Z';
function luiNgay(n: number): string {
  const d = new Date(`${homNay()}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() - n);
  return d.toISOString().slice(0, 10);
}
let dem = 0;
function k(ngay: string, soTien: number, chieu: 'chi' | 'thu' = 'chi'): Khoan {
  dem += 1;
  return {
    id: `n${dem}`, ngay, soTien, chieu, nhan: null, huId: null, cachGhi: 'tay',
    viSale: null, taoLuc: LUC, suaLuc: LUC,
  };
}

/** Tiền về 1.000.000 cách đây 4 ngày; chi 100k mỗi ngày từ đó ⇒ đã tiêu 50%, nhịp 100k. */
async function khoCoNhip(): Promise<KhoTrongBoNho> {
  const kho = new KhoTrongBoNho();
  const ds = [k(luiNgay(4), 1_000_000, 'thu'), ...[4, 3, 2, 1, 0].map((n) => k(luiNgay(n), 100_000))];
  for (const x of ds) await kho.ghi('khoan', { id: x.id, thang: x.ngay.slice(0, 7), suaLuc: LUC, d: x });
  return kho;
}

function ve(kho: KhoTrongBoNho) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={qc}>
      <KhoProvider kho={kho}><TienToiNgay /></KhoProvider>
    </QueryClientProvider>,
  );
}

async function choImLang(): Promise<void> {
  await waitFor(() => {
    expect(screen.getByTestId('nhip-vung').getAttribute('aria-busy')).toBe('false');
  });
  expect(screen.queryByTestId('nhip-the')).toBeNull();
}

describe('§I — dải lịch (hàm thuần)', () => {
  it('chép tay: ô tiền về · ô hôm nay · ô hết, và KẸP 21 ô cho màn hẹp', () => {
    const l = daiLich('2026-09-05', '2026-09-09', '2026-09-14');
    expect(l[0]).toEqual({ ngay: 5, loai: 've' });
    expect(l.find((o) => o.loai === 'nay')?.ngay).toBe(9);
    expect(l.find((o) => o.loai === 'het')?.ngay).toBe(14);
    expect(l.filter((o) => o.loai === 'qua').map((o) => o.ngay)).toEqual([6, 7, 8]);
    // ngày hết rất xa ⇒ vẫn chỉ 21 ô (không nong vùng cuộn — bài học D356)
    expect(daiLich('2026-09-05', '2026-09-09', '2027-03-01')).toHaveLength(21);
  });
});

describe('§II — thẻ trên đường thật', () => {
  it('⭐⭐⭐ câu LUÔN mang vế "giữ nhịp N ngày qua" — bỏ vế ấy là biến phép chia thành lời tiên tri', () => {
    // ⚠ A10 🔒. Không bài nào khác bắt được cú bỏ vế này: chữ vẫn trôi chảy, số vẫn đúng.
    expect(CHU_GIUP.nhipGiuPre).toContain('Giữ nhịp');
    expect(CHU_GIUP.nhipGiuHau).toContain('ngày qua');
    expect(CHU_GIUP.nhipVi).toContain('Tôi chỉ đoán nhịp');
  });

  it('⭐⭐ sổ có nhịp ⇒ hiện thẻ, nói đúng % đã tiêu và số ngày của nhịp', async () => {
    ve(await khoCoNhip());
    const the = await screen.findByTestId('nhip-the');
    const chu = the.textContent ?? '';
    expect(chu).toContain('50%');
    expect(chu).toContain(CHU_GIUP.nhipGiuPre);
    expect(chu).toContain(CHU_GIUP.nhipGiuHau);
    expect(chu).toContain(CHU_GIUP.nhipVi);
  });

  it('⭐⭐ CHƯA có lần tiền về ⇒ im (P7 — không bịa một ngày nào)', async () => {
    const kho = new KhoTrongBoNho();
    for (const x of [3, 2, 1, 0].map((n) => k(luiNgay(n), 100_000))) {
      await kho.ghi('khoan', { id: x.id, thang: x.ngay.slice(0, 7), suaLuc: LUC, d: x });
    }
    ve(kho);
    await choImLang();
  });

  it('⭐⭐⭐ ba ngày qua KHÔNG tiêu gì (nhịp 0) ⇒ im — không có ngày nào để nói', async () => {
    const kho = new KhoTrongBoNho();
    const ds = [k(luiNgay(10), 1_000_000, 'thu'), k(luiNgay(10), 100_000), k(luiNgay(9), 100_000)];
    for (const x of ds) await kho.ghi('khoan', { id: x.id, thang: x.ngay.slice(0, 7), suaLuc: LUC, d: x });
    ve(kho);
    await choImLang();
  });
});

describe('§III — ⭐⭐⭐ KHÔNG NGÕ CỤT: câu trả lời rút lại được', () => {
  it('CÓ ÍCH ⇒ cất trên máy + thu thành một dòng; ĐỔI ⇒ rút lại, hai nút hiện lại', async () => {
    const kho = await khoCoNhip();
    ve(kho);
    fireEvent.click(await screen.findByText(CHU_GIUP.nhipCoIch));
    const gon = await screen.findByTestId('nhip-da-dap');
    expect(gon.textContent).toContain(CHU_GIUP.nhipDaCoIch);
    await waitFor(async () => { expect(await docPhanHoiNhip(kho)).toBe(true); });

    fireEvent.click(within(gon).getByText(CHU_GIUP.lapDoi));
    expect(await screen.findByText(CHU_GIUP.nhipCoIch)).toBeInTheDocument();
    await waitFor(async () => { expect(await docPhanHoiNhip(kho)).toBeNull(); });
  });

  it('⭐⭐ KHÔNG cũng được cất — hai câu trả lời đều hợp lệ (P5/P6: không thưởng cái nào)', async () => {
    const kho = await khoCoNhip();
    ve(kho);
    fireEvent.click(await screen.findByText(CHU_GIUP.nhipKhong));
    await screen.findByTestId('nhip-da-dap');
    await waitFor(async () => { expect(await docPhanHoiNhip(kho)).toBe(false); });
  });

  it('⭐⭐ đã trả lời rồi ⇒ dựng lại màn KHÔNG hỏi lại (nhớ qua cả lần mở app sau)', async () => {
    const kho = await khoCoNhip();
    const r = ve(kho);
    fireEvent.click(await screen.findByText(CHU_GIUP.nhipCoIch));
    await screen.findByTestId('nhip-da-dap');
    r.unmount();

    ve(kho);
    expect(await screen.findByTestId('nhip-da-dap')).toBeInTheDocument();
    expect(screen.queryByText(CHU_GIUP.nhipCoIch)).toBeNull();
  });
});

describe('§IV — quét TU_KE_DON', () => {
  it('thẻ sạch (A10: tả + hỏi, không kê đơn)', async () => {
    ve(await khoCoNhip());
    const the = await screen.findByTestId('nhip-the');
    expect(tuKeDonTrong(the.textContent ?? '')).toEqual([]);
  });
});
