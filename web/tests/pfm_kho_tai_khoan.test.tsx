/**
 * ⭐⭐ KHO PFM THEO TÀI KHOẢN — hai người, một trình duyệt (D603 · SPEC `cai-app-pfm-trong-ban-cai` mục 4.3 + 5).
 *
 * Trước D603 kho mang một tên cố định `delphi_pfm` cho mọi tài khoản ⇒ lớp học dùng chung máy thì người sau mở ra thấy
 * sổ của người trước. Bài này canh HAI tầng, vì chỉ đổi tên kho là CHƯA ĐỦ:
 *   · tầng IndexedDB — mỗi `user_id` một kho (`kho_idb.ts`);
 *   · tầng cache react-query — query PFM để `gcTime: Infinity` và nút đăng xuất không dọn cache, nên người B có thể đọc
 *     sổ người A thẳng từ bộ nhớ mà không chạm IndexedDB (`dung_kho.tsx` — `chuCache`).
 * Cộng cờ localStorage của PFM (đã phỏng vấn) cũng theo người, và nút XOÁ SẠCH xoá luôn kho chung cũ.
 */
import 'fake-indexeddb/auto';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import React from 'react';
import { act, cleanup, render, screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { moKho, tenKho, TEN_DB_CHUNG_CU, xoaKhoChungCu } from '../src/pfm/kho_idb';
import { KhoProvider, quenLuotMo, useSoThang } from '../src/pfm/dung_kho';
import { taoKhoan, khoanRaBanGhi } from '../src/pfm/so';
import { daPhongVan, danhDauDaPhongVan } from '../src/pfm/da_phong_van';
import { queryKeys, useMe } from '../src/api/queries';
import type { MeResponse } from '../src/api/types';
import { ME_ONBOARDED, stubFetch } from './helpers';

const THANG = '2026-08';
const meCua = (id: string): MeResponse => ({ ...ME_ONBOARDED, user: { ...ME_ONBOARDED.user!, user_id: id } });

async function xoaDb(ten: string): Promise<void> {
  await new Promise<void>((ok) => {
    const r = indexedDB.deleteDatabase(ten);
    r.onsuccess = () => ok(); r.onerror = () => ok(); r.onblocked = () => ok();
  });
}

async function ghiMotKhoan(chu: string, soTien: number, id: string): Promise<void> {
  const k = await moKho(chu);
  await k.ghi('khoan', khoanRaBanGhi(taoKhoan({ ngay: `${THANG}-05`, soTien }, `${THANG}-05T09:00:00.000Z`, id)));
  k.dong();
}

beforeEach(async () => {
  quenLuotMo();
  localStorage.clear();
  for (const t of [tenKho('A'), tenKho('B'), TEN_DB_CHUNG_CU]) await xoaDb(t);
});
afterEach(() => { cleanup(); quenLuotMo(); });

describe('I. Tầng IndexedDB — mỗi tài khoản một kho', () => {
  it('tên kho mang user_id; chủ rỗng/lạ bị từ chối (tên kho là tên một CSDL trên máy)', () => {
    expect(tenKho('A')).toBe('delphi_pfm_A');
    expect(() => tenKho('')).toThrow();
    expect(() => tenKho('../x')).toThrow();
  });

  it('⭐ A ghi một khoản ⇒ kho của B KHÔNG thấy dòng nào', async () => {
    await ghiMotKhoan('A', 50_000, 'k-a');
    const b = await moKho('B');
    expect(await b.liet('khoan')).toHaveLength(0);
    b.dong();
    const a = await moKho('A');
    expect((await a.liet('khoan')).map((x) => x.id)).toEqual(['k-a']);
    a.dong();
  });

  it('hàng chờ đồng bộ (`outbox`) cũng nằm trong kho của đúng người', async () => {
    const a = await moKho('A');
    await a.ghi('outbox', { id: 'o-a', thang: THANG, suaLuc: `${THANG}-05T09:00:00.000Z`, d: { loai: 'x' } });
    a.dong();
    const b = await moKho('B');
    expect(await b.liet('outbox')).toHaveLength(0);
    b.dong();
  });

  it('XOÁ SẠCH xoá được kho CHUNG cũ (trước D603) mà không mở nó', async () => {
    await new Promise<void>((ok, loi) => {
      const r = indexedDB.open(TEN_DB_CHUNG_CU, 1);
      r.onupgradeneeded = () => { r.result.createObjectStore('khoan', { keyPath: 'id' }); };
      r.onsuccess = () => { r.result.close(); ok(); };
      r.onerror = () => loi(r.error);
    });
    expect((await indexedDB.databases()).map((d) => d.name)).toContain(TEN_DB_CHUNG_CU);
    await xoaKhoChungCu();
    expect((await indexedDB.databases()).map((d) => d.name)).not.toContain(TEN_DB_CHUNG_CU);
  });
});

/**
 * Màn con: in danh sách id khoản của tháng — VÀ ghi lại mỗi lần vẽ "đang là ai · đang hiện gì". Bất biến cần canh nằm ở
 * cặp ấy, không ở thời điểm: react-query báo `/me` đổi qua một nhịp lên lịch, nên "ngay sau khi B đăng nhập" là một mốc
 * trôi theo tải máy (bản đầu đọc màn ngay sau `act` — xanh khi chạy riêng, đỏ khi chạy cả bộ 12/10).
 */
const nhatKy: [string | null, string][] = [];
function SoKhoan(): React.ReactElement {
  const chu = useMe().data?.user?.user_id ?? null;
  const { data, sanSang } = useSoThang(THANG);
  const chu_ = sanSang ? data.map((k) => k.id).join(',') || 'rong' : 'cho';
  nhatKy.push([chu, chu_]);
  return <p data-testid="so">{chu_}</p>;
}

describe('II. ⭐⭐ Tầng cache — B đăng nhập sau A trên CÙNG tab không thấy sổ A', () => {
  it('đổi người ⇒ không lần vẽ nào của B hiện dòng của A, rồi hiện đúng sổ B', async () => {
    nhatKy.length = 0;
    await ghiMotKhoan('A', 50_000, 'k-a');
    await ghiMotKhoan('B', 70_000, 'k-b');
    stubFetch([['/auth/me', { status: 200, body: meCua('A') }]]);
    const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    render(
      <QueryClientProvider client={qc}>
        <KhoProvider><SoKhoan /></KhoProvider>
      </QueryClientProvider>,
    );
    await waitFor(() => expect(screen.getByTestId('so').textContent).toBe('k-a'));

    // A đăng xuất, B đăng nhập — nút đăng xuất KHÔNG dọn cache (`Profile.tsx`), chỉ làm tươi `/me`.
    await act(async () => { qc.setQueryData(queryKeys.me, meCua('B')); });
    await waitFor(() => expect(screen.getByTestId('so').textContent).toBe('k-b'));

    const loLot = nhatKy.filter(([chu, hien]) => chu === 'B' && hien.includes('k-a'));
    expect(loLot, 'màn đã biết là B mà vẫn vẽ sổ của A (cache react-query của người trước)').toEqual([]);
    expect(nhatKy.some(([chu]) => chu === 'B'), 'bài rỗng: màn con chưa từng vẽ dưới tên B').toBe(true);
  });

  it('không có phiên ⇒ không mở kho nào (không có kho "tạm chung")', async () => {
    await ghiMotKhoan('A', 50_000, 'k-a');
    stubFetch([]);   // `/auth/me` 401 ⇒ `useMe` = null
    const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    render(
      <QueryClientProvider client={qc}>
        <KhoProvider><SoKhoan /></KhoProvider>
      </QueryClientProvider>,
    );
    await new Promise((r) => setTimeout(r, 60));
    expect(screen.getByTestId('so').textContent).not.toContain('k-a');
  });
});

describe('III. Cờ PFM trên máy cũng theo người', () => {
  it('A đã phỏng vấn ⇒ B vẫn CHƯA (B phải được hỏi, kho B chưa có lời khai nào)', () => {
    danhDauDaPhongVan('A');
    expect(daPhongVan('A')).toBe(true);
    expect(daPhongVan('B')).toBe(false);
    expect(daPhongVan(null), 'chưa biết là ai ⇒ không coi là đã phỏng vấn').toBe(false);
  });

  it('khoá cũ không mang chủ (trước D603) KHÔNG được đọc — bỏ cùng kho chung cũ', () => {
    localStorage.setItem('pfm_da_phong_van', '1');
    expect(daPhongVan('A')).toBe(false);
  });
});
