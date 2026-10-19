/**
 * HÀNG CHỜ SUẤT TRẬN — phía người chơi (`api/suatTran.ts` + `components/HangChoSuatTran.tsx`; SPEC `tran-tran-ngay` mục 1, 4, 5).
 *
 * Khoá những lời hứa trên màn có mã đứng sau:
 *   · gặp 503 `hang_cho_tran` / `het_suat_ngay` ⇒ TỰ hỏi lại đúng nhịp server bảo, tới khi được trận — không bắt bấm lại
 *   · lỗi khác vẫn ném nguyên (màn gọi không học hình dạng lỗi mới)
 *   · RỜI HÀNG dừng vòng hỏi ngay
 *   · dải nói số thứ tự + giờ dự kiến GIỜ VN; hết ngày nói "mở lại 0:00"
 *   · tới lượt mà màn gốc đã đóng (người chơi đang ở Hub) ⇒ dải đưa vào trận
 */
import { act, render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ApiError } from '@/api/client';
import {
  MA_ROI_HANG, baoTranMoCoi, datLaiSuatTran, quaHangSuat, roiHangSuat, trangThaiSuat,
} from '@/api/suatTran';
import { HangChoSuatTran } from '@/components/HangChoSuatTran';

/** 20:40 giờ VN ngày 12/10/2026. */
const HAI_MUOI_GIO_40 = Date.UTC(2026, 9, 12, 13, 40);

const loiCho = (than: Record<string, unknown>, sau = 7) =>
  new ApiError(503, 'hang_cho_tran', 'x', undefined, sau, { error: 'hang_cho_tran', hang_cho_tran: than });

beforeEach(() => { vi.useFakeTimers(); });
afterEach(() => {
  datLaiSuatTran();
  vi.useRealTimers();
});

describe('quaHangSuat — tự hỏi lại', () => {
  it('503 hang_cho_tran ⇒ phát trạng thái, ngủ đúng Retry-After, gọi lại, trả trận', async () => {
    const goi = vi.fn()
      .mockRejectedValueOnce(loiCho({ vi_tri: 7, tong: 9, du_kien: HAI_MUOI_GIO_40, het_ngay: false }, 7))
      .mockResolvedValueOnce({ match_id: 'm1' });
    const p = quaHangSuat(goi);
    await vi.advanceTimersByTimeAsync(0);
    expect(trangThaiSuat()).toMatchObject({ vi_tri: 7, tong: 9, du_kien: HAI_MUOI_GIO_40 });
    await vi.advanceTimersByTimeAsync(6_900);
    expect(goi).toHaveBeenCalledTimes(1); // chưa tới nhịp server bảo
    await vi.advanceTimersByTimeAsync(200);
    await expect(p).resolves.toEqual({ match_id: 'm1' });
    expect(goi).toHaveBeenCalledTimes(2);
    expect(trangThaiSuat()).toBeNull();
  });

  it('503 het_suat_ngay (lưới server) ⇒ trạng thái hết ngày, vẫn tự thử lại', async () => {
    const goi = vi.fn()
      .mockRejectedValueOnce(new ApiError(503, 'het_suat_ngay', 'x', undefined, 300, { mo_lai_luc: 123 }))
      .mockResolvedValueOnce({ match_id: 'm2' });
    const p = quaHangSuat(goi);
    await vi.advanceTimersByTimeAsync(0);
    expect(trangThaiSuat()).toMatchObject({ het_ngay: true, vi_tri: null, mo_lai_luc: 123 });
    await vi.advanceTimersByTimeAsync(300_000);
    await expect(p).resolves.toEqual({ match_id: 'm2' });
  });

  it('lỗi khác ném nguyên, không dựng hàng chờ', async () => {
    const loi = new ApiError(409, 'ban_het_han', 'Bàn đã đóng');
    await expect(quaHangSuat(vi.fn().mockRejectedValue(loi))).rejects.toBe(loi);
    expect(trangThaiSuat()).toBeNull();
  });

  it('RỜI HÀNG ⇒ dừng vòng hỏi ngay, ném roi_hang_suat', async () => {
    const goi = vi.fn().mockRejectedValue(loiCho({ vi_tri: 2, tong: 2, du_kien: HAI_MUOI_GIO_40, het_ngay: false }, 60));
    const p = quaHangSuat(goi);
    const kq = expect(p).rejects.toMatchObject({ code: MA_ROI_HANG });
    await vi.advanceTimersByTimeAsync(0);
    roiHangSuat();
    await kq;
    await vi.advanceTimersByTimeAsync(120_000);
    expect(goi).toHaveBeenCalledTimes(1);
    expect(trangThaiSuat()).toBeNull();
  });
});

function ViTri() {
  return <div data-testid="vi-tri">{useLocation().pathname}{useLocation().search}</div>;
}

function veDai() {
  return render(
    <MemoryRouter initialEntries={['/hub']}>
      <HangChoSuatTran />
      <Routes><Route path="*" element={<ViTri />} /></Routes>
    </MemoryRouter>,
  );
}

describe('dải HangChoSuatTran', () => {
  it('nói số thứ tự + giờ dự kiến theo GIỜ VN; không xếp hàng thì không vẽ gì', async () => {
    vi.setSystemTime(HAI_MUOI_GIO_40 - 30 * 60_000);
    veDai();
    expect(screen.queryByTestId('hang-cho-suat-tran')).toBeNull();
    const p = quaHangSuat(vi.fn().mockRejectedValue(
      loiCho({ vi_tri: 7, tong: 9, du_kien: HAI_MUOI_GIO_40, het_ngay: false })));
    p.catch(() => undefined);
    await act(async () => { await vi.advanceTimersByTimeAsync(0); });
    expect(screen.getByTestId('hang-cho-suat-tran').textContent).toContain('BẠN THỨ');
    expect(screen.getByTestId('hang-cho-suat-tran').textContent).toContain('/ 9');
    expect(screen.getByTestId('hang-cho-suat-gio').textContent).toContain('20:40');
  });

  it('hết suất ngày ⇒ "mở lại 0:00", không số thứ tự giả', async () => {
    veDai();
    const p = quaHangSuat(vi.fn().mockRejectedValue(
      new ApiError(503, 'het_suat_ngay', 'x', undefined, 300, { mo_lai_luc: 1 })));
    p.catch(() => undefined);
    await act(async () => { await vi.advanceTimersByTimeAsync(0); });
    const dai = screen.getByTestId('hang-cho-suat-tran').textContent ?? '';
    expect(dai).toContain('HẾT SUẤT TRẬN HÔM NAY');
    expect(dai).toContain('0:00');
    expect(dai).not.toContain('BẠN THỨ');
    // Câu founder viết nguyên văn (12/10).
    expect(dai).toContain('Admin không có tiền host server xịn. Mong mọi người thông cảm (〒﹏〒) Còn không thông cảm thì donate 😈');
  });

  it('THU NHỎ ⇒ còn một viên (số thứ tự + giờ), không che Hub; chạm viên ⇒ mở lại dải đầy', async () => {
    vi.setSystemTime(HAI_MUOI_GIO_40 - 30 * 60_000);
    veDai();
    const p = quaHangSuat(vi.fn().mockRejectedValue(
      loiCho({ vi_tri: 7, tong: 9, du_kien: HAI_MUOI_GIO_40, het_ngay: false })));
    p.catch(() => undefined);
    await act(async () => { await vi.advanceTimersByTimeAsync(0); });
    await act(async () => { screen.getByTestId('hang-cho-suat-thu-nho').click(); });
    expect(screen.queryByTestId('hang-cho-suat-tran')).toBeNull();
    const vien = screen.getByTestId('hang-cho-suat-vien').textContent ?? '';
    expect(vien).toContain('#7');
    expect(vien).toContain('20:40');
    await act(async () => { screen.getByTestId('hang-cho-suat-vien').click(); });
    expect(screen.getByTestId('hang-cho-suat-tran')).toBeTruthy();
  });

  it('⭐ tới lượt mà màn gốc đã đóng ⇒ dải đưa người chơi vào trận (trận tập kèm ?tap=1)', async () => {
    veDai();
    expect(screen.getByTestId('vi-tri').textContent).toBe('/hub');
    await act(async () => { baoTranMoCoi({ matchId: 'abc', tap: true }); });
    expect(screen.getByTestId('vi-tri').textContent).toBe('/arena/tran/abc?tap=1');
  });
});
