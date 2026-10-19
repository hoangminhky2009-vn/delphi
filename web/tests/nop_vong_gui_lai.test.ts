/**
 * Client GỬI LẠI cú nộp vòng khi chưa tới được máy chủ (SPEC chan-truoc-beta mục 6 — ≤ 2 lần, chỉ khi lỗi mạng/hết giờ chờ).
 * Phía server (`tests/nop_vong_gui_lai.test.ts`) bảo đảm gửi lại không ghi đôi; bài này canh phía client: gửi lại ĐÚNG lúc, không
 * gửi lại khi máy chủ đã trả lời (409/400 — gửi lại là nộp đôi một quyết định người chơi đã bị bác).
 */
import { describe, expect, it, vi } from 'vitest';
import { ApiError } from '@/api/client';
import { guiLaiKhiMatMang, SO_LAN_GUI_LAI_VONG } from '@/api/holdem';

const matMang = () => new ApiError(0, 'network', 'mất mạng');
const khongCho = () => Promise.resolve();
const offline = () => true;
const online = () => false;

describe('guiLaiKhiMatMang', () => {
  it('⭐ máy OFFLINE lúc hỏng ⇒ chờ mạng về rồi gửi lại và trả kết quả', async () => {
    const goi = vi.fn().mockRejectedValueOnce(matMang()).mockResolvedValueOnce({ vong: 2 });
    const choMang = vi.fn(khongCho);
    await expect(guiLaiKhiMatMang(goi, SO_LAN_GUI_LAI_VONG, choMang, offline)).resolves.toEqual({ vong: 2 });
    expect(goi).toHaveBeenCalledTimes(2);
    expect(choMang).toHaveBeenCalledTimes(1);
  });

  it('hết giờ chờ (timeout) cũng gửi lại', async () => {
    const goi = vi.fn().mockRejectedValueOnce(new ApiError(0, 'timeout', 'lâu')).mockResolvedValueOnce('ok');
    await expect(guiLaiKhiMatMang(goi, 2, khongCho, online)).resolves.toBe('ok');
  });

  it('⭐ lỗi mạng mà máy vẫn ONLINE (máy chủ không với tới) ⇒ KHÔNG gửi lại — để thang giãn D414 lo, không nhân ba POST (C2)', async () => {
    const goi = vi.fn().mockRejectedValue(matMang());
    await expect(guiLaiKhiMatMang(goi, 2, khongCho, online)).rejects.toMatchObject({ code: 'network' });
    expect(goi).toHaveBeenCalledTimes(1);
  });

  it('tối đa 2 lần gửi lại (3 lần gọi) rồi báo lỗi như cũ', async () => {
    const goi = vi.fn().mockRejectedValue(matMang());
    await expect(guiLaiKhiMatMang(goi, SO_LAN_GUI_LAI_VONG, khongCho, offline)).rejects.toMatchObject({ code: 'network' });
    expect(goi).toHaveBeenCalledTimes(SO_LAN_GUI_LAI_VONG + 1);
    expect(SO_LAN_GUI_LAI_VONG).toBe(2);
  });

  it('⭐ máy chủ ĐÃ trả lời (409) ⇒ không gửi lại', async () => {
    const goi = vi.fn().mockRejectedValue(new ApiError(409, 'sai_vong', 'sai vòng'));
    await expect(guiLaiKhiMatMang(goi, 2, khongCho, offline)).rejects.toMatchObject({ code: 'sai_vong' });
    expect(goi).toHaveBeenCalledTimes(1);
  });
});
