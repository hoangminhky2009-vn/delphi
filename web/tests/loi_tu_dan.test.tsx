/**
 * ORACLE GIÚP 3 trên ĐƯỜNG THẬT — lời tự dặn lúc tiền vừa về (`LoiTuDan.tsx`, D365).
 *
 * ⚠ Bài đắt nhất là §II (**thẻ hiện NGUYÊN VĂN lời người dùng, không thêm chữ nào của
 * Oracle**): đây là bậc 3 của thang can thiệp — *"Bạn viết, Oracle chỉ nhắc lại đúng lời
 * bạn"*. Một câu khuyên lọt vào đây thì cả cơ chế đổi nghĩa, mà chữ vẫn đọc trôi chảy.
 */
import { describe, expect, it } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { LoiTuDan, luatDangVang } from '../src/components/pfm/LoiTuDan';
import { KhoProvider } from '../src/pfm/dung_kho';
import { KhoTrongBoNho } from '../src/pfm/kho.js';
import { taoLuatMoi, datBat, type Luat } from '../src/pfm/luat.js';
import { homNay } from '../src/pfm/thoi_gian.js';
import type { Khoan } from '../src/pfm/so.js';
import { tuTao, type Hu } from '../src/pfm/hu.js';
import { CHU_GIUP } from '../src/lib/pfm_chu';
import { tuKeDonTrong } from '../src/lib/khoanh_khac';

const LUC = '2026-09-21T06:00:00.000Z';
const LOI = 'Tiền vừa về thì để riêng 500k trước khi tiêu gì';

function luiNgay(n: number): string {
  const d = new Date(`${homNay()}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() - n);
  return d.toISOString().slice(0, 10);
}
let dem = 0;
function k(ngay: string, soTien: number, chieu: 'chi' | 'thu' = 'chi'): Khoan {
  dem += 1;
  return { id: `d${dem}`, ngay, soTien, chieu, nhan: null, huId: null, cachGhi: 'tay', viSale: null, taoLuc: LUC, suaLuc: LUC };
}
const luat = (loiNhac = LOI, id = 'l1'): Luat =>
  taoLuatMoi({ loiNhac, dieuKien: 'tien_vua_ve', thamSo: undefined, mauId: null }, LUC, id);

/** Tiền về HÔM NAY ⇒ trong cửa sổ "tiền vừa về". */
async function khoTienVua(l: Luat | null = luat()): Promise<KhoTrongBoNho> {
  const kho = new KhoTrongBoNho();
  const thu = k(homNay(), 3_000_000, 'thu');
  await kho.ghi('khoan', { id: thu.id, thang: thu.ngay.slice(0, 7), suaLuc: LUC, d: thu });
  if (l) await kho.ghi<Luat>('luat', { id: l.id, thang: LUC.slice(0, 7), suaLuc: LUC, d: l });
  return kho;
}

function ve(kho: KhoTrongBoNho) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={qc}>
      <MemoryRouter><KhoProvider kho={kho}><LoiTuDan /></KhoProvider></MemoryRouter>
    </QueryClientProvider>,
  );
}

async function choImLang(): Promise<void> {
  await waitFor(() => {
    expect(screen.getByTestId('dan-vung').getAttribute('aria-busy')).toBe('false');
  });
  expect(screen.queryByTestId('dan-the')).toBeNull();
}

describe('§I — chọn luật (hàm thuần)', () => {
  const so = [k(homNay(), 3_000_000, 'thu')];

  it('chỉ lấy luật ĐANG BẬT, điều kiện `tien_vua_ve`, và hôm nay điều kiện ĐÚNG', () => {
    expect(luatDangVang([luat()], so, homNay())?.loiNhac).toBe(LOI);
    expect(luatDangVang([datBat(luat(), false)], so, homNay()), 'luật đã TẮT').toBeNull();
    const khac = taoLuatMoi({ loiNhac: 'x', dieuKien: 'ngay_chi_lon', thamSo: undefined, mauId: null }, LUC, 'l9');
    expect(luatDangVang([khac], so, homNay()), 'điều kiện khác').toBeNull();
    expect(luatDangVang([luat()], [k(luiNgay(9), 3_000_000, 'thu')], homNay()), 'tiền về đã lâu').toBeNull();
  });

  it('⭐ nhiều luật cùng đúng ⇒ lấy luật TẠO SỚM NHẤT, tất định theo thứ tự mảng', () => {
    const cu: Luat = { ...luat('lời cũ', 'a'), taoLuc: '2026-01-01T00:00:00.000Z' };
    const moi: Luat = { ...luat('lời mới', 'b'), taoLuc: '2026-09-01T00:00:00.000Z' };
    expect(luatDangVang([moi, cu], so, homNay())?.loiNhac).toBe('lời cũ');
    expect(luatDangVang([cu, moi], so, homNay())?.loiNhac).toBe('lời cũ');
  });
});

describe('§II — thẻ trên đường thật', () => {
  it('⭐⭐⭐ hiện NGUYÊN VĂN lời người dùng, và lời dẫn của Oracle nói rõ mình chỉ đọc lại', async () => {
    ve(await khoTienVua());
    const loi = await screen.findByTestId('dan-loi');
    expect(loi.textContent).toContain(LOI);
    expect(screen.getByTestId('dan-the').textContent).toContain(CHU_GIUP.danDau);
    expect(CHU_GIUP.danDau, 'lời dẫn phải tự khai mình đang dẫn').toContain('đọc lại lời bạn');
  });

  it('⭐⭐ KHÔNG có luật nào ⇒ im (Oracle không tự nghĩ ra lời dặn hộ)', async () => {
    ve(await khoTienVua(null));
    await choImLang();
  });

  it('⭐⭐ tiền về đã QUÁ cửa sổ ⇒ im', async () => {
    const kho = new KhoTrongBoNho();
    const thu = k(luiNgay(9), 3_000_000, 'thu');
    await kho.ghi('khoan', { id: thu.id, thang: thu.ngay.slice(0, 7), suaLuc: LUC, d: thu });
    const l = luat();
    await kho.ghi<Luat>('luat', { id: l.id, thang: LUC.slice(0, 7), suaLuc: LUC, d: l });
    ve(kho);
    await choImLang();
  });

  it('không có hũ nào đặt mức ⇒ vẫn đọc lại lời dặn, chỉ vắng khối hũ', async () => {
    ve(await khoTienVua());
    await screen.findByTestId('dan-loi');
    expect(screen.queryByText(CHU_GIUP.danMoHu)).toBeNull();
  });

  it('⭐⭐ D421 — hũ TIÊU DÙNG (mức là trần tiêu một tháng, không phải đích) KHÔNG được đặt ra trước mặt', async () => {
    const kho = await khoTienVua();
    const ghiHu = async (h: Hu) => kho.ghi<Hu>('hu', { id: h.id, thang: LUC.slice(0, 7), suaLuc: LUC, d: h });
    await ghiHu(tuTao({ ten: 'Ăn uống', muc: 3_000_000, nhom: 'tieu_dung' }, LUC, 'h-an'));
    const r = ve(kho);
    await screen.findByTestId('dan-loi');
    expect(screen.queryByText(CHU_GIUP.danMoHu), 'chỉ có hũ tiêu dùng ⇒ vắng khối hũ').toBeNull();
    r.unmount();
    await ghiHu(tuTao({ ten: 'Xe máy', muc: 1_000_000 }, LUC, 'h-xe'));
    ve(kho);
    await screen.findByTestId('dan-loi');
    expect(await screen.findByText('Xe máy', { exact: false }), 'hũ tích lũy thì có').toBeInTheDocument();
    expect(screen.queryByText('Ăn uống', { exact: false })).toBeNull();
  });
});

describe('§III — quét TU_KE_DON', () => {
  it('⭐⭐ chữ của ORACLE sạch — và lời NGƯỜI DÙNG thì KHÔNG bị quét', async () => {
    /*
     * ⚠ A10 quét chữ của APP, không quét chữ người dùng tự viết: lời tự dặn gần như luôn có
     * "phải"/"đừng" ("đừng tiêu ngay") — đó là người ta tự dặn mình, không phải app kê đơn.
     * Bài này khoá đúng ranh giới ấy: quét lời dẫn, KHÔNG quét `dan-loi`.
     */
    ve(await khoTienVua(luat('Tiền vừa về thì phải để riêng 500k, đừng tiêu ngay')));
    await screen.findByTestId('dan-loi');
    expect(tuKeDonTrong(CHU_GIUP.danDau)).toEqual([]);
    expect(tuKeDonTrong(CHU_GIUP.danVi)).toEqual([]);
    expect(tuKeDonTrong(CHU_GIUP.danMoHu)).toEqual([]);
  });
});
