/**
 * D375 — CA THẬT CỦA FOUNDER, DỰNG LẠI TRÊN ĐƯỜNG CHÍNH (`ShopManHinh`).
 *
 * `mau_so_hang_chip.test.tsx` canh `HangChip` khi ĐƯỢC TRUYỀN mẫu số. Bài đó một mình
 * là RỖNG với bug thật: bug nằm ở chỗ shop KHÔNG truyền gì cả. Nên bài này dựng đúng
 * ván founder gửi và hỏi câu của người chơi — *"bấm ALL-IN thì vào bao nhiêu?"* — qua
 * cây component thật, không qua prop tự đặt.
 *
 * Ván vòng 9, ảnh 21/09: tiền mặt **2.234**, Crypto **53.888**, NAV 56.122.
 * Bấm ALL-IN mua Trái phiếu Mỹ ⇒ engine giải ra đúng 2.234 (đã đo bằng `giaiLenhMoc`).
 */
import { describe, expect, it, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { ShopManHinh } from '../src/components/holdem/ShopManHinh';

const TAI_SAN = [
  { id: 'btc', ten: 'Crypto', mau: ['#f7931a', 'rgba(247,147,26,.22)'] as const },
  { id: 'tpcp', ten: 'Trái phiếu', mau: ['#60a5fa', 'rgba(96,165,250,.22)'] as const },
];

/** Ván của founder: đã all-in Crypto vòng trước, tiền mặt còn lại gần như không có. */
function vanCuaFounder(over: { viThe?: Record<string, number>; tienMat?: number; chonTS?: string[] } = {}) {
  const onThem = vi.fn();
  render(
    <ShopManHinh
      vong={9}
      loaiVongNay="tai_san"
      vongMoTiepTheo={{ tai_san: null, chien_thuat: 10 }}
      taiSan={TAI_SAN}
      chienThuat={[]}
      chonTS={over.chonTS ?? []}
      chonCT={null}
      onChonTS={() => {}}
      onChonCT={() => {}}
      danhMuc={[]}
      sucChuaTaiSan={4}
      sucChuaChienThuat={3}
      art={{}}
      ganVao={null}
      onGan={() => {}}
      phamViThe={() => 'danh_muc'}
      doiGan={{}}
      onDoiGan={() => {}}
      chiPhiRoll={1}
      luotConLai={1}
      onRoll={() => {}}
      onDong={() => {}}
      onChotVong={() => {}}
      tuDien={{ tai_san: {}, chien_thuat: {}, muc: [] } as never}
      giaiDoanNhan={[]}
      suKienNhan={[]}
      moTaChienThuat={() => undefined}
      nav={{
        tienMat: over.tienMat ?? 2234,
        viThe: over.viThe ?? { btc: 53888 },
        buocMocBp: 2500,
        lenh: [],
        onThem,
        onXoa: () => {},
        startVon: 10_000,
      }}
    />,
  );
  return { onThem };
}

const soTren = (nhan: string): string | null => {
  const nut = [...document.querySelectorAll('[data-phieu-lenh] [data-moc]')]   // D540 — chip ở PHIẾU LỆNH của thẻ đang chọn
    .find((b) => b.querySelector('[data-nhan-moc]')?.textContent === nhan);
  return nut?.querySelector('[data-so-moc]')?.textContent ?? null;
};

/*
 * ⭐ D432 (founder 27/09: *"Quá nhiều thứ trên 1 màn hình"*) — dòng "CHIP TÍNH TRÊN TIỀN MẶT · 2.234 · 53.888 ĐANG NẰM Ở
 * VỊ THẾ" là bản thứ tư của cùng con số tiền mặt trên màn. Mẫu số nay in lên CHÍNH chip (số tiền chip ấy đặt, bằng hàm
 * server `tienTuMoc`), còn phần đang nằm ở vị thế đọc ở NAV đầu màn. Câu hỏi của người chơi không đổi — *"bấm ALL-IN thì
 * vào bao nhiêu?"* — bài vẫn hỏi nó qua cây component thật.
 */
describe('I. ⭐⭐ ALL-IN không còn đứng một mình — con số đứng NGAY TRÊN chip', () => {
  it('chip ALL-IN in 2.234 — mẫu số thật của nút, không phải NAV', () => {
    vanCuaFounder({ chonTS: ['tpcp'] });
    expect(soTren('ALL-IN'), 'chip ALL-IN không in số tiền nào').toBe('2.234');
  });

  it('⭐ phần tiền đang nằm ở vị thế đọc được ngay đầu màn: VÍ 2.234 · NAV 56.122', () => {
    vanCuaFounder();
    const vi = document.querySelector('[data-tap="shop-vi"]')?.textContent ?? '';
    expect(vi).toMatch(/2\.234/);
    expect(vi, 'không thấy NAV thì "ALL-IN 2.234" không nói được tiền còn lại nằm đâu').toMatch(/56\.122/);
  });

  it('dòng mẫu số cũ ĐÃ GỠ — con số chỉ có một chỗ đứng', () => {
    vanCuaFounder();
    expect(document.querySelector('[data-nen-chip]')).toBeNull();
    expect(document.body.textContent).not.toMatch(/CHIP TÍNH TRÊN/);
  });

  it('nút vẫn tên ALL-IN, và bấm vẫn ra mốc 100% — luật chip KHÔNG đổi', () => {
    vanCuaFounder({ chonTS: ['tpcp'] });
    expect(screen.getByRole('button', { name: 'ALL-IN' })).toBeTruthy();
  });
});

describe('II. bốn chip in như nhau (luật data D85 §1.2)', () => {
  it('ghế toàn tiền mặt 10.000 ⇒ 2.500 · 5.000 · 7.500 · 10.000 — không chip nào là chip duy nhất mang số', () => {
    vanCuaFounder({ viThe: {}, tienMat: 10_000, chonTS: ['tpcp'] });
    expect(['25%', '50%', '75%', 'ALL-IN'].map(soTren)).toEqual(['2.500', '5.000', '7.500', '10.000']);
  });
});

describe('III. đổi sang mặt RÚT thì mẫu số đổi theo', () => {
  it('D540 — chưa cầm lá nào ⇒ KHÔNG có chip nào để in số (phiếu chỉ mọc khi chạm một mã — không có chip RÚT "không biết rút mã nào")', () => {
    vanCuaFounder();
    expect(document.querySelector('[data-moc]')).toBeNull();
    expect(screen.queryByText('RÚT')).toBeNull();
  });
  it('Crypto đang trên tay ⇒ chip HẾT in đúng 53.888 (vị thế của chính mã ấy)', () => {
    vanCuaFounder({ chonTS: ['btc'] });
    fireEvent.click(screen.getByText('RÚT'));
    expect(soTren('HẾT')).toBe('53.888');
  });
});
