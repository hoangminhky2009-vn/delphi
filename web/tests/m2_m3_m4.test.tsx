/**
 * D90 M2 · M3 · M4 (thi công 17/08) — ba món "giảm thứ phải quyết mỗi vòng"
 * mà KHÔNG giảm thứ có trong trò (thang "nhập môn" đã bị founder bác).
 *   · M2 đồng hồ hai pha: nhãn ĐỌC → QUYẾT do SERVER phát (`pha`), TỔNG GIÂY
 *     KHÔNG ĐỔI — client không tự trừ `tong_s - 15` (THẺ GIỜ v32 làm phép trừ
 *     đó sai với người có đặc quyền); API cũ không có `pha` ⇒ mặt số như trước;
 *   · M3 lăng kính: ba trục cộng ĐÚNG 100 (99 là mất tin ngay), MÔ TẢ không kê
 *     đơn (A10), và "trước → sau" trong xem-trước;
 *   · M4 lịch vòng: nói CẤU TRÚC (chợ/lá/kỳ ngộ), không nói NỘI DUNG ô nào lật.
 */
import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import { DongHoVong } from '../src/components/holdem/DongHoVong';
import { LangKinh, LichVong, loaiVong, phanBoNav } from '../src/components/holdem/LangKinh';
import { TU_KE_DON } from '../src/lib/khoanh_khac';

const TS = [
  { id: 'btc', label: 'BTC', icon: '', nhom: 'rui_ro', thanh_khoan: 'mong', bien_dong_bp: 400 },
  { id: 'vang', label: 'Vàng', icon: '', nhom: 'phong_thu', thanh_khoan: 'sau', bien_dong_bp: 120 },
] as never;

describe('M3 · lăng kính', () => {
  it('⭐ ba trục luôn cộng đúng 100, kể cả khi chia lẻ', () => {
    expect(phanBoNav({ btc: 5000 }, 5000, TS)).toEqual({ rui_ro: 50, phong_thu: 0, tien_mat: 50 });
    // 33,33 / 33,33 / 33,34 ⇒ dư 1 điểm dồn vào trục LỚN NHẤT (tiền mặt).
    expect(phanBoNav({ btc: 3333, vang: 3333 }, 3334, TS)).toEqual({ rui_ro: 33, phong_thu: 33, tien_mat: 34 });
    const p = phanBoNav({ btc: 1, vang: 1 }, 1, TS);
    expect(p.rui_ro + p.phong_thu + p.tien_mat).toBe(100);
    // Toàn tiền mặt / trắng tay ⇒ 100% tiền mặt, không chia 0/0.
    expect(phanBoNav({}, 10_000, TS)).toEqual({ rui_ro: 0, phong_thu: 0, tien_mat: 100 });
    expect(phanBoNav({}, 0, TS)).toEqual({ rui_ro: 0, phong_thu: 0, tien_mat: 100 });
    // Mã lạ (catalog thiếu) tính vào RỦI RO — không im lặng bỏ tiền ra khỏi tổng.
    const la = phanBoNav({ zzz: 5000 }, 5000, TS);
    expect(la.rui_ro + la.phong_thu + la.tien_mat).toBe(100);
    expect(la.rui_ro).toBe(50);
  });

  it('vẽ nhãn ba trục, có "trước → sau"; KHÔNG câu kê đơn (A10)', () => {
    const { container } = render(
      <LangKinh nhan pb={{ rui_ro: 75, phong_thu: 5, tien_mat: 20 }} truoc={{ rui_ro: 40, phong_thu: 5, tien_mat: 55 }} />,
    );
    expect(screen.getByText('40→75%')).toBeInTheDocument();
    expect(screen.getByText('55→20%')).toBeInTheDocument();
    expect(screen.getByText('5%')).toBeInTheDocument();      // không đổi ⇒ một số
    const chu = (container.textContent ?? '').toLowerCase();
    for (const tu of TU_KE_DON) expect(chu).not.toContain(tu);
  });
});

describe('M4 · lịch vòng', () => {
  it('mỗi vòng một VẠCH; vòng NÀY nổi lên; kỳ ngộ có màu riêng; KHÔNG lộ nội dung ô', () => {
    /*
     * 23/08 — dải thu còn VẠCH MÀU, không chữ (founder khoanh đỏ cụm đầu bàn):
     * 19px một hàng cho một thứ vẫn phải giải mã, ở map 12/16 thì mỗi ô chưa
     * tới 25px nên chữ càng khó đọc. Nhịp nay đọc bằng MÀU, còn "vòng NÀY là
     * loại gì" dời lên hàng ROUND (`loaiVong`) — xem bài dưới.
     */
    const { container } = render(
      <LichVong nhip={['tai_san', 'tai_san', 'chien_thuat', 'khong']} vong={2} vongKyNgo={[3]} />,
    );
    const o = container.querySelectorAll('[data-tap="lich-vong"] > span');
    expect(o).toHaveLength(4);
    expect(o[1]!.className, 'vòng đang chơi phải nổi lên').toMatch(/oNay/);
    expect(o[2]!.className, 'kỳ ngộ ĐÈ nhịp lá').toMatch(/o_ky/);
    expect(o[0]!.className, 'vòng đã qua phải mờ đi').toMatch(/oQua/);
    // Không còn chữ nào trong dải — mọi thứ đi bằng màu.
    expect(container.textContent).toBe('');
    // …nhưng trình đọc màn hình vẫn phải nghe được cả lịch.
    const dai = container.querySelector('[data-tap="lich-vong"]')!;
    expect(dai.getAttribute('aria-label')).toMatch(/1 CHỢ.*3 KỲ NGỘ.*4 KHOÁ/);
    for (const cam of ['BTC', 'bong bóng', 'tin giả', 'thiên nga']) {
      expect(dai.getAttribute('aria-label')).not.toContain(cam);
    }
  });

  it('⭐ "vòng này là loại gì" KHÔNG bị mất — nó dời sang `loaiVong`', () => {
    /*
     * Thu gọn mà làm rơi mất tin thì không phải thu gọn. Bài này khoá đúng chỗ
     * cái tin đó đi tới, và khoá MỘT NGUỒN: `loaiVong` và dải lịch đọc chung
     * bảng `LOAI_VONG`, nên không có bản chữ thứ hai để trôi (D61).
     */
    const nhip = ['tai_san', 'tai_san', 'chien_thuat', 'khong'];
    expect(loaiVong(nhip, 2)).toBe('CHỢ');
    expect(loaiVong(nhip, 3)).toBe('LÕI');
    expect(loaiVong(nhip, 4)).toBe('KHOÁ');
    expect(loaiVong(nhip, 3, [3]), 'kỳ ngộ đè nhịp lá').toBe('KỲ NGỘ');
  });

  it('nhịp rỗng ⇒ không vẽ gì (không khung trống)', () => {
    const { container } = render(<LichVong nhip={[]} vong={1} />);
    expect(container.querySelector('[data-tap="lich-vong"]')).toBeNull();
  });
});

describe('M2 · đồng hồ hai pha', () => {
  const nhan = () => screen.getByLabelText(/Còn \d+ giây|hết giờ/i).textContent ?? '';

  it('⭐ pha ĐỌC ⇒ nhãn ĐỌC; pha QUYẾT ⇒ nhãn QUYẾT; tổng giây KHÔNG đổi', () => {
    const { rerender } = render(
      <DongHoVong conLaiS={38} tongS={40} hetGio={false} pha="doc" docS={15} nhanLuc={Date.now()} />,
    );
    expect(nhan()).toMatch(/^ĐỌC/);
    expect(nhan()).toMatch(/38s/);
    rerender(<DongHoVong conLaiS={20} tongS={40} hetGio={false} pha="quyet" docS={15} nhanLuc={Date.now()} />);
    expect(nhan()).toMatch(/^QUYẾT/);
    expect(nhan()).toMatch(/20s/);
  });

  it('API cũ (không có pha) ⇒ mặt số như trước, nhãn CÒN', () => {
    render(<DongHoVong conLaiS={25} tongS={25} hetGio={false} nhanLuc={Date.now()} />);
    expect(nhan()).toMatch(/^CÒN/);
  });

  it('hết giờ ⇒ HẾT GIỜ (pha không cướp mất câu đó)', () => {
    render(<DongHoVong conLaiS={0} tongS={40} hetGio pha="quyet" docS={15} nhanLuc={Date.now()} />);
    expect(screen.getByLabelText(/hết giờ/i).textContent).toMatch(/HẾT GIỜ/);
  });

  it('vạch chia chỉ vẽ khi CÓ pha đọc (vòng 1 không có)', () => {
    const { container, rerender } = render(
      <DongHoVong conLaiS={30} tongS={40} hetGio={false} pha="doc" docS={15} nhanLuc={Date.now()} />,
    );
    const vach = () => container.querySelector('[class*="vach"]') as HTMLElement | null;
    expect(vach()).not.toBeNull();
    // 15/40 = 37,5% ⇒ 38%
    expect(vach()!.style.left).toBe('38%');
    rerender(<DongHoVong conLaiS={45} tongS={45} hetGio={false} pha="quyet" docS={0} nhanLuc={Date.now()} />);
    expect(vach()).toBeNull();
  });
});
