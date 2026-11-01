/**
 * D609 — hộp "LÕI CHO MÀN" (founder 13/10: "chọn lõi là bắt buộc … màn hình tự hiện"). Hộp chỉ là TRÌNH BÀY + một cú chạm: lõi nào được chọn, lõi nào là
 * mặc định (server cũng chốt đúng lõi ấy khi hết giờ — `laCuaMan`), cú chạm gửi id ra ngoài. Cổng "khi nào hộp hiện" là hàm thuần ở `lib/loi_bat_buoc.ts` — canh ở bài dưới.
 */
import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { ChonLoiMan } from '@/components/holdem/ChonLoiMan';
import { canHoiLoiCuaMan, laLuotLoiBatBuoc, loiMoiChuaCam } from '@/lib/loi_bat_buoc';

const ten = (id: string) => id;
const dung = (over: Partial<Parameters<typeof ChonLoiMan>[0]> = {}) => {
  const onChon = vi.fn(), onDong = vi.fn();
  render(<ChonLoiMan ds={['bat_day', 'mua_duoi']} macDinh="bat_day" art={{}} ten={ten} onChon={onChon} onDong={onDong} {...over} />);
  return { onChon, onDong };
};

describe('ChonLoiMan', () => {
  it('⭐ mỗi lõi đang cầm một lá; DUY NHẤT lõi mặc định mang nhãn MẶC ĐỊNH', () => {
    dung();
    expect(screen.getByRole('button', { name: /Chọn lõi Bắt Đáy/ })).toBeTruthy();
    expect(screen.getByRole('button', { name: /Chọn lõi Mua Đuổi/ })).toBeTruthy();
    expect(screen.getAllByText('MẶC ĐỊNH')).toHaveLength(1);
    expect(screen.getByRole('button', { name: /Chọn lõi Bắt Đáy/ }).textContent).toContain('MẶC ĐỊNH');
    expect(screen.getByRole('button', { name: /Chọn lõi Mua Đuổi/ }).textContent).not.toContain('MẶC ĐỊNH');
  });

  it('⭐ chạm lá thứ hai gửi ĐÚNG id đó (không phải lõi mặc định)', () => {
    const { onChon } = dung();
    fireEvent.click(screen.getByRole('button', { name: /Chọn lõi Mua Đuổi/ }));
    expect(onChon).toHaveBeenCalledTimes(1);
    expect(onChon).toHaveBeenCalledWith('mua_duoi');
  });

  it('ĐỂ SAU đóng hộp mà không chọn gì', () => {
    const { onChon, onDong } = dung();
    fireEvent.click(screen.getByRole('button', { name: 'ĐỂ SAU' }));
    expect(onDong).toHaveBeenCalledTimes(1);
    expect(onChon).not.toHaveBeenCalled();
  });

  it('đang gửi ⇒ mọi nút khoá (không nộp hai lần)', () => {
    const { onChon } = dung({ dangGui: true });
    fireEvent.click(screen.getByRole('button', { name: /Chọn lõi Mua Đuổi/ }));
    expect(onChon).not.toHaveBeenCalled();
    expect((screen.getByRole('button', { name: 'ĐỂ SAU' }) as HTMLButtonElement).disabled).toBe(true);
  });

  it('có giây còn lại thì hiện; vắng thì không in "undefineds"', () => {
    dung({ conGiay: 7 });
    expect(screen.getByText('7s')).toBeTruthy();
  });
});

describe('cổng lõi bắt buộc (`lib/loi_bat_buoc`)', () => {
  const co = { tap: false, loiChonTruoc: true, loaiVong: 'chien_thuat', daChonVongNay: false, loiMoi: 'bat_day' };

  it('⭐ lá đầu quầy CHƯA cầm: bỏ qua lá đã cầm; quầy trống / cầm hết ⇒ undefined (khớp `loiChonHo` ở server)', () => {
    expect(loiMoiChuaCam(['ban_khong', 'don_bay'], [])).toBe('ban_khong');
    expect(loiMoiChuaCam(['ban_khong', 'don_bay'], ['ban_khong'])).toBe('don_bay');
    expect(loiMoiChuaCam(['ban_khong'], ['ban_khong'])).toBeUndefined();
    expect(loiMoiChuaCam([], [])).toBeUndefined();
    expect(loiMoiChuaCam(undefined, [])).toBeUndefined();
  });

  it('⭐ lượt lõi bắt buộc: bật khi lượt lõi + chưa chọn + còn lá mới; vế ngược từng điều kiện đều tắt', () => {
    expect(laLuotLoiBatBuoc(co)).toBe(true);
    expect(laLuotLoiBatBuoc({ ...co, tap: true }), 'bàn tập có Oracle dẫn').toBe(false);
    expect(laLuotLoiBatBuoc({ ...co, loiChonTruoc: false }), 'khoá cũ').toBe(false);
    expect(laLuotLoiBatBuoc({ ...co, loaiVong: 'tai_san' }), 'không phải lượt lõi').toBe(false);
    expect(laLuotLoiBatBuoc({ ...co, daChonVongNay: true }), 'đã chọn').toBe(false);
    expect(laLuotLoiBatBuoc({ ...co, loiMoi: undefined }), 'đủ lõi / quầy hết lá mới').toBe(false);
  });

  it('⭐ hỏi lõi cho màn: chỉ khi vòng có màn + ≥ 2 lõi + chưa nói rõ', () => {
    const m = { tap: false, loiChonTruoc: true, lichMan: [1, 2, 3], vong: 2, soLoiCoThe: 2, daNoiRo: false };
    expect(canHoiLoiCuaMan(m)).toBe(true);
    expect(canHoiLoiCuaMan({ ...m, vong: 4 }), 'vòng không có màn').toBe(false);
    expect(canHoiLoiCuaMan({ ...m, soLoiCoThe: 1 }), 'một lõi thì không có gì để chọn').toBe(false);
    expect(canHoiLoiCuaMan({ ...m, daNoiRo: true })).toBe(false);
    expect(canHoiLoiCuaMan({ ...m, tap: true })).toBe(false);
    expect(canHoiLoiCuaMan({ ...m, loiChonTruoc: false })).toBe(false);
  });
});
