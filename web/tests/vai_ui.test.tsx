/**
 * VAI CHO NGƯỜI — UI (founder 22/08: "cho player cầm đủ các vai").
 *
 * Ba thứ người chơi PHẢI thấy trước khi xếp chip, toàn bộ chữ/cờ từ server:
 *   §I  thẻ VAI CỦA BẠN (tên · quyền · giá) — vắng `vai` ⇒ không có khối;
 *   §II tổ chức: cảnh báo MANDATE khi chuỗi sẽ bị từ chối, và nhãn DÒNG TIỀN;
 *   §III cá mập cấp 2: chạm mã thứ hai khi đang cầm Đòn Bẩy ⇒ đích PHỤ.
 * Không một luật nào tính lại ở client: mandate đi qua chính `apLenhGiaoDich`.
 */
import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, within } from '@testing-library/react';

vi.mock('@/lib/telemetry', () => ({ ghiDo: () => {} }));

import { ShopManHinh } from '../src/components/holdem/ShopManHinh';

const TAI_SAN = [
  { id: 'btc', ten: 'BTC', mau: ['#f7931a', 'rgba(247,147,26,.22)'] as const },
  { id: 'vang', ten: 'Vàng', mau: ['#fbbf24', 'rgba(251,191,36,.22)'] as const },
];
type Lenh = { ma: string; chieu: 'mua' | 'ban' | 'khong' | 'dong_khong'; moc_bp: number };
type Vai = NonNullable<Parameters<typeof ShopManHinh>[0]['vai']>;

function dung(vai: Vai | undefined, over: Partial<{
  lenh: Lenh[]; viThe: Record<string, number>;
  danhMuc: { id: string; ten: string; mau: readonly [string, string]; cap: number; loai: 'tai_san' | 'chien_thuat' }[];
  ganHienTai: Record<string, string>;
  dongHo: { conLai: number; hetGio: boolean; tamDung: boolean };
  dongLenh: Record<string, number>;
  chonCT: string | null; loaiVongNay: string; buocChon: 'chon' | 'ban';
}> = {}) {
  const onDoiGan = vi.fn();
  const onGan = vi.fn();
  render(
    <ShopManHinh
      vong={3} loaiVongNay={(over.loaiVongNay ?? 'tai_san') as never} vongMoTiepTheo={{ tai_san: null, chien_thuat: 4 }}
      taiSan={TAI_SAN} chienThuat={[]} chonTS={[]} chonCT={over.chonCT ?? null}
      onChonTS={() => {}} onChonCT={() => {}}
      danhMuc={over.danhMuc ?? []} sucChuaTaiSan={4} sucChuaChienThuat={3} art={{}}
      ganVao={null} onGan={onGan}
      phamViThe={(id) => (id === 'don_bay' ? 'tai_san' : 'danh_muc')}
      ganHienTai={over.ganHienTai} doiGan={{}} onDoiGan={onDoiGan}
      chiPhiRoll={1} luotConLai={1} onRoll={() => {}} onDong={() => {}} onChotVong={() => {}}
      tuDien={{ tai_san: {}, chien_thuat: {}, muc: [] } as never}
      giaiDoanNhan={[]} suKienNhan={[]} moTaChienThuat={() => undefined}
      {...(vai ? { vai } : {})}
      {...(over.dongHo ? { dongHo: over.dongHo } : {})}
      {...(over.dongLenh ? { dongLenh: over.dongLenh } : {})}
      {...(over.buocChon ? { buocChon: over.buocChon } : {})}
      nav={{
        tienMat: 20000, viThe: over.viThe ?? {}, viKhong: {}, coBanKhong: false,
        buocMocBp: 2500, lenh: over.lenh ?? [], onThem: () => {}, onXoa: () => {},
        startVon: 10000, lenhTruoc: [],
      }}
    />,
  );
  return { onDoiGan, onGan };
}

const TO_CHUC: Vai = {
  id: 'to_chuc', ten: 'TỔ CHỨC',
  dacQuyen: 'Đa Dạng Hoá ghim sẵn; thấy DÒNG TIỀN cả bàn',
  caiGia: 'Mandate: không mua mã nào quá 40% NAV; không được Bán Khống',
  mandate: { tran_ma_bp: 4000, cam_khong: true },
  dongTien: { btc: 'dong', vang: 'vang' },
};

describe('I. thẻ VAI CỦA BẠN', () => {
  it('⭐ THU CÒN MỘT NÚT: tên hiện sẵn, QUYỀN/GIÁ chỉ mở khi CHỦ ĐỘNG chạm', () => {
    /*
     * Founder 23/08: *"vào trận thì thu nhỏ nó lại chỉ còn 1 icon pixel ở trong
     * chợ … nếu quên chức năng/role thì có thể bấm vào để đọc"*.
     * Khối cũ bày đủ QUYỀN + GIÁ thường trực, ăn ~140px MỖI LẦN mở chợ suốt cả
     * trận — để nói một điều chỉ đổi đúng một lần (vai bốc lúc tạo bàn, D107).
     * Bài này khoá cả hai vế: đóng thì phải GỌN THẬT, mở thì phải ĐỦ CHỮ SERVER.
     */
    dung(TO_CHUC);
    const khoi = screen.getByTestId('vai-cua-ban');
    expect(khoi.getAttribute('data-vai')).toBe('to_chuc');
    // Đóng: chỉ còn tên. Không được rò quyền/giá ra ngoài.
    expect(khoi.textContent).toContain('TỔ CHỨC');
    expect(khoi.textContent, 'đóng mà vẫn in QUYỀN là chưa thu gọn')
      .not.toContain(TO_CHUC.dacQuyen);
    expect(khoi.textContent).not.toContain(TO_CHUC.caiGia);

    // Mở: đủ chữ server phát, không gõ lại ở client (D61).
    fireEvent.click(within(khoi).getByRole('button'));
    expect(khoi.textContent).toContain(TO_CHUC.dacQuyen);
    expect(khoi.textContent).toContain(TO_CHUC.caiGia);

    // Bấm lại thì cụp — nó là chỗ đọc lại một lần, không phải một tuỳ chọn.
    fireEvent.click(within(khoi).getByRole('button'));
    expect(khoi.textContent).not.toContain(TO_CHUC.dacQuyen);
  });
  it('trận không vai (map 8 / trận cũ) ⇒ không khối, không cảnh báo', () => {
    dung(undefined, { lenh: [{ ma: 'btc', chieu: 'mua', moc_bp: 10000 }] });
    expect(screen.queryByTestId('vai-cua-ban')).toBeNull();
    expect(screen.queryByTestId('mandate-loi')).toBeNull();
  });
});

describe('II. tổ chức — mandate nói TRƯỚC khi bấm, dòng tiền thô trên lá', () => {
  it('ALL-IN một mã dưới mandate ⇒ cảnh báo mandate (chuỗi này sẽ bị từ chối); 25% ⇒ im', () => {
    dung(TO_CHUC, { lenh: [{ ma: 'btc', chieu: 'mua', moc_bp: 10000 }] });
    const loi = screen.getByTestId('mandate-loi');
    expect(loi.textContent).toContain('40%');
    expect(loi.textContent).toContain('MANDATE');
  });
  it('25% một mã ⇒ không cảnh báo', () => {
    dung(TO_CHUC, { lenh: [{ ma: 'btc', chieu: 'mua', moc_bp: 2500 }] });
    expect(screen.queryByTestId('mandate-loi')).toBeNull();
  });
  it('cùng chuỗi ALL-IN mà KHÔNG phải tổ chức ⇒ không cảnh báo (mandate là của vai, không của bàn)', () => {
    dung({ ...TO_CHUC, id: 'ca_nhan', ten: 'CÁ NHÂN', mandate: undefined, dongTien: undefined } as Vai,
      { lenh: [{ ma: 'btc', chieu: 'mua', moc_bp: 10000 }] });
    expect(screen.queryByTestId('mandate-loi')).toBeNull();
  });
  it('nhãn dòng tiền: ĐÔNG / VẮNG theo mã, không có số', () => {
    dung(TO_CHUC);
    expect(screen.getByTestId('dong-tien-btc').textContent).toBe('ĐÔNG');
    expect(screen.getByTestId('dong-tien-vang').textContent).toBe('VẮNG');
    expect(screen.getByTestId('dong-tien-btc').textContent).not.toMatch(/\d/);
  });
});

describe('II-b. ĐI SAU (trait v55, D422) — cả bàn đang mua/bán mã nào, mũi tên trên lá, không số', () => {
  it('mức +3 ⇒ ba ▲ xanh · −1 ⇒ một ▼ · 0 ⇒ "—"; không mang lá (vắng prop) ⇒ không huy hiệu nào (vế ngược)', () => {
    dung(undefined, { dongLenh: { btc: 3, vang: -1 } });
    const btc = document.querySelector('[data-dong-lenh="3"]');
    const vang = document.querySelector('[data-dong-lenh="-1"]');
    expect(btc?.textContent).toBe('▲▲▲');
    expect(vang?.textContent).toBe('▼');
    expect(btc?.className).toMatch(/lenhMua/);
    expect(vang?.className).toMatch(/lenhBan/);
    expect(btc?.getAttribute('title')).toContain('MUA');
    expect(btc?.textContent).not.toMatch(/\d/);
  });
  it('vắng prop ⇒ không mũi tên', () => {
    dung(undefined);
    expect(document.querySelector('[data-dong-lenh]')).toBeNull();
  });
});

describe('III. cá mập cấp 2 — đích phụ Đòn Bẩy', () => {
  const CA_MAP: Vai = {
    id: 'ca_map', ten: 'CÁ MẬP', dacQuyen: 'Đòn Bẩy ghim sẵn; cấp 2 nhắm được HAI mã', caiGia: 'x1,5',
    ganPhuDuoc: true, ganPhuHienTai: undefined, doiGanPhu: null, onDoiGanPhu: vi.fn(),
  };
  const danhMuc = [{ id: 'don_bay', ten: 'Đòn Bẩy 2×', mau: ['#a855f7', 'rgba(0,0,0,.2)'] as const, cap: 2, loai: 'chien_thuat' as const }];

  it('cầm Đòn Bẩy (đã nhắm btc) rồi chạm VÀNG ⇒ gọi onDoiGanPhu("vang"), KHÔNG đổi đích chính', () => {
    const { onDoiGan } = dung(CA_MAP, { danhMuc, ganHienTai: { don_bay: 'btc' }, viThe: { btc: 5000, vang: 5000 } });
    fireEvent.click(screen.getByRole('button', { name: /ĐÒN BẨY 2×/ }));
    fireEvent.click(document.querySelector('[data-card="vang"]')!);
    expect(CA_MAP.onDoiGanPhu).toHaveBeenCalledWith('vang');
    expect(onDoiGan).not.toHaveBeenCalled();
  });
  it('không có cờ ganPhuDuoc (cấp 1) ⇒ chạm mã khác là ĐỔI đích chính như cũ', () => {
    const vai1: Vai = { ...CA_MAP, ganPhuDuoc: undefined, onDoiGanPhu: vi.fn() };
    const { onDoiGan } = dung(vai1, { danhMuc: [{ ...danhMuc[0]!, cap: 1 }], ganHienTai: { don_bay: 'btc' }, viThe: { btc: 5000, vang: 5000 } });
    fireEvent.click(screen.getByRole('button', { name: /ĐÒN BẨY 2×/ }));
    fireEvent.click(document.querySelector('[data-card="vang"]')!);
    expect(onDoiGan).toHaveBeenCalledWith('don_bay', 'vang');
    expect(vai1.onDoiGanPhu).not.toHaveBeenCalled();
  });

  /*
   * D435 — founder 27/09: *"Đòn bẩy lv 2 đ** cho gán đòn bẩy 2 mã"*. Đúng vòng lấy lá thứ hai: server khai `gan_phu_khi_mua`
   * (cầm đúng một lá), người chơi đang chọn Đòn Bẩy ở quầy. Bản trước bày "VỪA CHỌN · MỌI MÃ" (mất đích cũ) và chạm mã thứ
   * hai chỉ gắn lại đích chính. Tiêm lỗi: đổi `ganPhuMo` về chỉ đọc `ganPhuDuoc` ⇒ bài đầu đỏ.
   */
  it('D435 — vòng MUA lá thứ hai: ô "LÊN CẤP 2" giữ đích cũ, chạm mã khác ⇒ đích PHỤ (không đổi đích chính)', () => {
    const vai2: Vai = { ...CA_MAP, ganPhuDuoc: undefined, ganPhuKhiMua: true, onDoiGanPhu: vi.fn() };
    const { onDoiGan, onGan } = dung(vai2, {
      danhMuc: [{ ...danhMuc[0]!, cap: 1 }], ganHienTai: { don_bay: 'btc' }, viThe: { btc: 5000, vang: 5000 },
      chonCT: 'don_bay', loaiVongNay: 'chien_thuat', buocChon: 'ban',
    });
    // Vòng lõi còn nút ◆ quay lại màn chọn cùng tên lá ⇒ lấy đúng nút trong khối TAY.
    const la = within(screen.getByTestId('tay-gon')).getByRole('button', { name: /ĐÒN BẨY 2×/ });
    expect(la.textContent).toMatch(/LÊN CẤP 2/);
    expect(la.textContent).toMatch(/→ BTC/);
    expect(la.textContent).toMatch(/chạm mã 2/);
    fireEvent.click(la);
    fireEvent.click(document.querySelector('[data-card="vang"]')!);
    expect(vai2.onDoiGanPhu).toHaveBeenCalledWith('vang');
    expect(onGan).not.toHaveBeenCalled();
    expect(onDoiGan).not.toHaveBeenCalled();
  });
  it('D435 vế ngược — cùng vòng mua mà server KHÔNG khai cờ ⇒ chạm mã khác vẫn là gắn đích chính của lượt mua', () => {
    const vai0: Vai = { ...CA_MAP, ganPhuDuoc: undefined, ganPhuKhiMua: undefined, onDoiGanPhu: vi.fn() };
    const { onGan } = dung(vai0, {
      danhMuc: [{ ...danhMuc[0]!, cap: 1 }], ganHienTai: { don_bay: 'btc' }, viThe: { btc: 5000, vang: 5000 },
      chonCT: 'don_bay', loaiVongNay: 'chien_thuat', buocChon: 'ban',
    });
    fireEvent.click(within(screen.getByTestId('tay-gon')).getByRole('button', { name: /ĐÒN BẨY 2×/ }));
    fireEvent.click(document.querySelector('[data-card="vang"]')!);
    expect(onGan).toHaveBeenCalledWith('vang');
    expect(vai0.onDoiGanPhu).not.toHaveBeenCalled();
  });
});

describe('IV. 22/08 — đồng hồ NGAY TRÊN SHOP (shop che mặt đồng hồ chính)', () => {
  it('hiện số giây; ≤ 8s đổi lớp gấp; ≤ 3s lớp khẩn; HẾT GIỜ khi server tuyên; màn tập tạm dừng thì ẩn', () => {
    const { unmount } = (() => { dung(undefined, { dongHo: { conLai: 20, hetGio: false, tamDung: false } }); return { unmount: () => {} }; })();
    const dh = screen.getByTestId('shop-dong-ho');
    expect(dh.textContent).toBe('20s');
    expect(dh.className).not.toMatch(/Gap|Khan/);
    unmount();
  });
  it('≤ 8s ⇒ lớp gấp', () => {
    dung(undefined, { dongHo: { conLai: 6, hetGio: false, tamDung: false } });
    expect(screen.getByTestId('shop-dong-ho').className).toMatch(/dauGioGap/);
  });
  it('≤ 3s ⇒ lớp khẩn', () => {
    dung(undefined, { dongHo: { conLai: 2, hetGio: false, tamDung: false } });
    expect(screen.getByTestId('shop-dong-ho').className).toMatch(/dauGioKhan/);
  });
  it('server tuyên hết giờ ⇒ chữ HẾT GIỜ', () => {
    dung(undefined, { dongHo: { conLai: 0, hetGio: true, tamDung: false } });
    expect(screen.getByTestId('shop-dong-ho').textContent).toBe('HẾT GIỜ');
  });
  it('màn tập tạm dừng ⇒ không đồng hồ (giục người đang đọc Oracle là nói dối, D53)', () => {
    dung(undefined, { dongHo: { conLai: 30, hetGio: false, tamDung: true } });
    expect(screen.queryByTestId('shop-dong-ho')).toBeNull();
  });
});
