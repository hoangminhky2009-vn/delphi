/**
 * PFM — DÙNG KHO TỪ REACT (`dung_kho.tsx`, GĐ1): provider + hook, mảnh khép GĐ1.
 *
 * ⚠ Hai bài đắt nhất ở đây đều canh những cú hỏng **vô hình trên màn hình**:
 *   · ghi xong mà không vô hiệu hoá đúng tiền tố ⇒ dòng vừa ghi không hiện ra, người dùng
 *     bấm lại, sổ có hai dòng;
 *   · xoá sạch mà không dọn cache ⇒ màn hình vẫn hiện đúng những dòng vừa xoá, và người
 *     dùng kết luận app không xoá thật (P9 🔒).
 */
import { describe, expect, it, beforeEach, vi } from 'vitest';
import { renderHook, waitFor, act } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { ReactNode } from 'react';
import {
  KHOA_PFM, KhoProvider, useGhiKho, useHoSo, useHu, useKhoNgu, useSoThang,
  useTinhTrangKho, useXoaSachKho, useDemNgan,
} from '../src/pfm/dung_kho';
import { KhoTrongBoNho, type KhoPfm } from '../src/pfm/kho.js';
import { taoKhoan, khoanRaBanGhi } from '../src/pfm/so.js';
import { tuTao } from '../src/pfm/hu.js';
import { ghiHoSo } from '../src/pfm/ho_so.js';

const LUC = '2026-09-05T10:00:00.000Z';
const THANG = '2026-09';

function boc(kho: KhoPfm) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const Boc = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={qc}>
      <KhoProvider kho={kho}>{children}</KhoProvider>
    </QueryClientProvider>
  );
  return { Boc, qc };
}

async function khoCoKhoan(n: number): Promise<KhoTrongBoNho> {
  const kho = new KhoTrongBoNho();
  for (let i = 0; i < n; i++) {
    const k = taoKhoan(
      { soTien: 35_000 + i, chieu: 'chi', ngay: `2026-09-0${i + 1}` }, LUC, `k${i}`);
    await kho.ghi('khoan', khoanRaBanGhi(k));
  }
  return kho;
}

beforeEach(() => { vi.unstubAllGlobals(); });

describe('§I — provider', () => {
  it('đọc được sổ của tháng', async () => {
    const { Boc } = boc(await khoCoKhoan(2));
    const { result } = renderHook(() => useSoThang(THANG), { wrapper: Boc });
    await waitFor(() => expect(result.current.data).toHaveLength(2));
  });

  it('⭐ đứng ngoài provider ⇒ NÉM, không trả sổ rỗng', () => {
    /*
     * ⚠ Trả `null`/`[]` ở đây là để một màn quên bọc provider hiện **sổ RỖNG** thay vì
     * hiện lỗi — mà sổ rỗng là một câu trả lời trông hoàn toàn hợp lý với người mới. Cú
     * hỏng ấy sẽ sống tới lúc có người thật hỏi "sổ của tôi đâu".
     */
    expect(() => renderHook(() => useKhoNgu())).toThrow(/KhoProvider/);
  });

  it('⭐⭐ `ben` đi ra tới màn hình khi rơi về kho tạm', async () => {
    /*
     * ⚠⚠ `kho.ts` bắt: *"Rơi về bản này là MẤT DỮ LIỆU KHI ĐÓNG APP, nên người gọi phải
     * được BÁO"*. Trước lượt này `ben` chỉ có trên hai LỚP cài đặt, không có trong giao
     * diện `KhoPfm` — nên lời hứa ấy không thực hiện được: người gọi cầm `KhoPfm`.
     */
    const { Boc } = boc(new KhoTrongBoNho());
    const { result } = renderHook(() => useTinhTrangKho(), { wrapper: Boc });
    await waitFor(() => expect(result.current.dangMo).toBe(false));
    expect(result.current.ben, 'kho trong bộ nhớ KHÔNG bền').toBe(false);
  });
});

describe('§II — ⭐⭐⭐ ghi rồi vô hiệu hoá theo TIỀN TỐ', () => {
  it('⭐⭐⭐ ghi khoản của THÁNG KHÁC vẫn làm màn tháng này đọc lại', async () => {
    /*
     * ⚠⚠ ĐÂY LÀ BÀI QUAN TRỌNG NHẤT CỦA TỆP. Ghi bù cho hôm qua — hoặc cho tháng trước —
     * là chuyện thường, và cú ghi ấy rơi vào một khoá KHÁC với khoá màn hình đang mở. Vô
     * hiệu hoá đúng-một-tháng thì dòng vừa ghi **không hiện ra**, người dùng bấm lại, và
     * sổ có hai dòng. Không có lỗi, không có log — chỉ có một sổ sai.
     */
    const kho = await khoCoKhoan(1);
    const { Boc } = boc(kho);
    const { result } = renderHook(() => ({
      thangNay: useSoThang(THANG),
      thangTruoc: useSoThang('2026-08'),
      ghi: useGhiKho(),
    }), { wrapper: Boc });

    await waitFor(() => expect(result.current.thangNay.data).toHaveLength(1));
    expect(result.current.thangTruoc.data).toHaveLength(0);

    // Ghi vào THÁNG TRƯỚC — khoá khác hẳn khoá đang mở.
    await act(async () => {
      await result.current.ghi(['khoan'], async (k) => {
        const bu = taoKhoan(
          { soTien: 12_000, chieu: 'chi', ngay: '2026-08-30' }, LUC, 'bu');
        await k.ghi('khoan', khoanRaBanGhi(bu));
      });
    });

    await waitFor(() => expect(result.current.thangTruoc.data).toHaveLength(1));
    expect(result.current.thangNay.data, 'tháng này không đổi, nhưng đã đọc lại')
      .toHaveLength(1);
  });

  it('⭐ khai NGĂN nào thì chỉ ngăn ấy đọc lại — không quét cả cache', async () => {
    const kho = await khoCoKhoan(1);
    await kho.ghi('hu', { id: 'h1', thang: THANG, suaLuc: LUC, d: tuTao({ ten: 'Dự phòng' }, LUC, 'h1') });
    const { Boc, qc } = boc(kho);
    const { result } = renderHook(() => ({ hu: useHu(), so: useSoThang(THANG), ghi: useGhiKho() }),
      { wrapper: Boc });
    await waitFor(() => expect(result.current.hu.data).toHaveLength(1));

    const spy = vi.spyOn(qc, 'invalidateQueries');
    await act(async () => { await result.current.ghi(['hu'], async () => {}); });
    expect(spy).toHaveBeenCalledTimes(1);
    expect(spy).toHaveBeenCalledWith({ queryKey: KHOA_PFM.ngan('hu') });
  });

  it('⭐ thao tác chạm HAI ngăn phải khai cả hai (góp hũ = khoản + hũ)', async () => {
    const kho = await khoCoKhoan(0);
    const { Boc, qc } = boc(kho);
    const { result } = renderHook(() => useGhiKho(), { wrapper: Boc });
    const spy = vi.spyOn(qc, 'invalidateQueries');
    await act(async () => { await result.current(['khoan', 'hu'], async () => {}); });
    expect(spy.mock.calls.map((c) => (c[0] as { queryKey: readonly unknown[] }).queryKey))
      .toEqual([KHOA_PFM.ngan('khoan'), KHOA_PFM.ngan('hu')]);
  });

  it('việc ghi NÉM ⇒ không vô hiệu hoá (cache cũ vẫn đúng hơn cache rỗng)', async () => {
    const { Boc, qc } = boc(await khoCoKhoan(1));
    const { result } = renderHook(() => useGhiKho(), { wrapper: Boc });
    const spy = vi.spyOn(qc, 'invalidateQueries');
    await expect(result.current(['khoan'], async () => { throw new Error('hỏng'); }))
      .rejects.toThrow('hỏng');
    expect(spy).not.toHaveBeenCalled();
  });
});

describe('§III — ⭐⭐⭐ XOÁ SẠCH (P9 🔒) phải dọn CẢ cache', () => {
  it('⭐⭐⭐ xoá xong thì màn hình KHÔNG còn hiện dòng cũ', async () => {
    /*
     * ⚠⚠ Với `staleTime: Infinity`, TanStack giữ mảng cũ trong bộ nhớ **vô thời hạn**.
     * Kho trống mà cache còn thì màn hình tiếp tục hiện đúng những dòng vừa được xoá, cho
     * tới khi tải lại trang. Với một nút mang nhãn "xoá sạch dữ liệu" thì đó không phải
     * lỗi hiển thị: người dùng kết luận app **không xoá thật** — đúng điều P9 tồn tại để
     * bảo đảm điều ngược lại.
     */
    const kho = await khoCoKhoan(3);
    const { Boc } = boc(kho);
    const { result } = renderHook(() => ({ so: useSoThang(THANG), xoa: useXoaSachKho() }),
      { wrapper: Boc });
    await waitFor(() => expect(result.current.so.data).toHaveLength(3));

    await act(async () => { await result.current.xoa(); });

    expect(await kho.dem('khoan'), 'kho đã trống thật').toBe(0);
    await waitFor(() => expect(result.current.so.data, 'và màn hình cũng phải trống')
      .toHaveLength(0));
  });
});

describe('§IV — hũ và hồ sơ', () => {
  it('⭐ hũ KHÔNG lọc theo tháng — hũ tạo tháng trước vẫn phải thấy', async () => {
    /*
     * Lọc hũ theo tháng là làm biến mất hũ tạo từ tháng trước — đúng cái bẫy mà
     * `KIEU_LAT.hu = 'song'` đã dựng ra để tránh, chỉ dịch lên tầng UI.
     */
    const kho = new KhoTrongBoNho();
    await kho.ghi('hu', {
      id: 'cu', thang: '2026-07', suaLuc: LUC, d: tuTao({ ten: 'Hũ cũ' }, LUC, 'cu'),
    });
    const { Boc } = boc(kho);
    const { result } = renderHook(() => useHu(), { wrapper: Boc });
    await waitFor(() => expect(result.current.data).toHaveLength(1));
  });

  it('hồ sơ chưa khai ⇒ `{}`; khai rồi ⇒ đọc lại được sau khi vô hiệu hoá', async () => {
    const kho = new KhoTrongBoNho();
    const { Boc } = boc(kho);
    const { result } = renderHook(() => ({ hs: useHoSo(), ghi: useGhiKho() }),
      { wrapper: Boc });
    await waitFor(() => expect(result.current.hs.dangTai).toBe(false));
    expect(result.current.hs.data).toEqual({});

    await act(async () => {
      await result.current.ghi(['meta'], (k) => ghiHoSo(k, { khung: 'kakeibo' }, LUC));
    });
    await waitFor(() => expect(result.current.hs.data).toEqual({ khung: 'kakeibo' }));
  });

  it('`useDemNgan` đếm không tải ruột', async () => {
    const { Boc } = boc(await khoCoKhoan(4));
    const { result } = renderHook(() => useDemNgan('khoan'), { wrapper: Boc });
    await waitFor(() => expect(result.current).toBe(4));
  });
});
