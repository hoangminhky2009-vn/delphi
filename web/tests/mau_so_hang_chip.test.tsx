/**
 * D375 — HÀNG CHIP PHẢI KHAI MẪU SỐ CỦA NÓ.
 *
 * ─── CA THẬT BÀI NÀY DỰNG LẠI ───────────────────────────────────────────────
 * Founder 21/09, ảnh vòng 9: ghế có **tiền mặt 2.234** và **Crypto 53.888** (NAV
 * 56.122), cầm lá Đòn Bẩy 2× gắn vào Trái phiếu Mỹ, bấm **ALL-IN** mua Trái phiếu
 * Mỹ. Lệnh vào đúng **2.234** — 4% số tiền họ đang có. Founder đọc ra là *"không
 * rút được hết"*, tức cơ chế hỏng.
 *
 * Đo bằng chính hàm server (`giaiLenhMoc`) thì cơ chế KHÔNG hỏng: chip MUA tính
 * trên TIỀN MẶT, luôn luôn thế, và "RÚT HẾT" vẫn bán được trọn 53.888. Cái hỏng là
 * hàng chip IM LẶNG về mẫu số — nên "ALL-IN" đọc ra là "tất tay" trong khi nó là
 * "tất tay phần tiền mặt", và người vừa all-in vòng trước thì phần ấy gần bằng 0.
 *
 * ⚠ ĐÂY LÀ LỚP LỖI ĐÃ CHỮA MỘT LẦN RỒI, CHỈ Ở MẶT KHÁC: D342 thêm "hạn mức khống
 * còn …" cho mặt KHỐNG với đúng lý lẽ ấy (*"thiếu con số này thì 100% là một nấc
 * không ai đọc ra được"*). Không ai mở rộng sang hai mặt kia, nên nó quay lại.
 * Bài này khoá cả BA mặt cùng lúc để không còn mặt nào bị bỏ quên.
 */
import { describe, expect, it } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { tienTuMoc } from '@server/holdem/nav';
import { HangChip } from '../src/components/holdem/HangChip';

const KHUNG = {
  onDoiMat: () => {},
  coBanKhong: false,
  coCocRut: true,
  buocMocBp: 2500,
  chipCam: null,
  onChamChip: () => {},
  chipVoHieu: false,
  allDangNhip: 0,
  lenh: [],
  tenMa: (m: string) => m,
  onXoa: () => {},
  lapDuoc: false,
};

/*
 * ⭐ D432 (founder 27/09: *"Quá nhiều thứ trên 1 màn hình"*) — mẫu số không còn là một DÒNG CHỮ trên hàng chip: mỗi chip in
 * số tiền NÓ sẽ đặt, tính bằng CHÍNH hàm server giải chip (`tienTuMoc`). Cha đưa CƠ SỞ của mặt đang bật (`coSo`).
 * Ca founder (tiền mặt 2.234) ⇒ chip ALL-IN in 2.234 — đọc là "tất tay phần tiền mặt" mà không cần câu nào.
 */
const ve = (mat: 'mua' | 'ban' | 'khong', coSo?: number | null) =>
  render(<HangChip {...KHUNG} mat={mat} {...(coSo !== undefined ? { coSo } : {})} />);
const soTren = (nhan: string): string | null => {
  const nut = [...document.querySelectorAll('[data-moc]')]
    .find((b) => b.querySelector('[data-nhan-moc]')?.textContent === nhan);
  return nut?.querySelector('[data-so-moc]')?.textContent ?? null;
};

describe('I. ⭐ mẫu số in ngay trên chip', () => {
  it('ca thật của founder: ALL-IN in 2.234, không đứng một mình', () => {
    ve('mua', 2234);
    // Nút vẫn là ALL-IN — luật chip KHÔNG đổi, chỉ thôi im lặng.
    expect(screen.getByRole('button', { name: 'ALL-IN' })).toBeTruthy();
    expect(soTren('ALL-IN')).toBe('2.234');
  });
  it('số trên chip = CHÍNH hàm server `tienTuMoc` cho mọi mốc (không phép nhân thứ hai)', () => {
    ve('mua', 7777);
    for (const [nhan, moc] of [['25%', 2500], ['50%', 5000], ['75%', 7500], ['ALL-IN', 10000]] as const) {
      expect(soTren(nhan), nhan).toBe(tienTuMoc(moc, 7777).toLocaleString('vi-VN'));
    }
  });
  it('(tiêm ngược) vắng `coSo` ⇒ KHÔNG chip nào in số — số thật sự do prop sinh ra', () => {
    ve('mua');
    expect(document.querySelector('[data-so-moc]')).toBeNull();
  });
  it('dòng mẫu số cũ ĐÃ GỠ', () => {
    ve('mua', 2234);
    expect(document.querySelector('[data-nen-chip]')).toBeNull();
  });
});

describe('II. ba mặt, ba cơ sở — không mặt nào được bỏ quên', () => {
  it('mặt RÚT: cơ sở là vị thế mã đang cầm ⇒ HẾT in trọn 53.888', () => {
    ve('ban', 53888);
    expect(soTren('HẾT')).toBe('53.888');
  });
  it('mặt RÚT chưa biết mã (`coSo` null) ⇒ chỉ in phần trăm, không bịa số', () => {
    ve('ban', null);
    expect(screen.getByRole('button', { name: 'HẾT' })).toBeTruthy();
    expect(document.querySelector('[data-so-moc]')).toBeNull();
  });
  it('mặt KHỐNG theo hạn mức (D342): 100% in đúng hạn mức còn', () => {
    ve('khong', 9000);
    expect(soTren('100%')).toBe('9.000');
  });
  it('nhãn chip theo mặt KHÔNG đổi: mua = ALL-IN · rút = HẾT · khống = 100%', () => {
    // Luật chip là thứ founder KHÔNG yêu cầu đổi; bài giữ nó lại để lần sau ai
    // định "sửa" mẫu số bằng cách đổi luật chip thì đỏ ở đây trước.
    ve('mua', 1);
    expect(screen.getByRole('button', { name: 'ALL-IN' })).toBeTruthy();
    ve('ban', 1);
    expect(screen.getByRole('button', { name: 'HẾT' })).toBeTruthy();
    ve('khong', 1);
    expect(screen.getAllByRole('button', { name: '100%' }).length).toBeGreaterThan(0);
  });
});

describe('III. ⭐ CHIA LỆNH: 20 nấc thì phải NÓI là có 20', () => {
  /*
   * Bước 500bp (lá Chia Lệnh) ⇒ 20 nấc ⇒ hàng chip chuyển sang cuộn ngang và CỐ Ý ẩn thanh
   * cuộn. Đo bằng chính CSS: 20 × 56px + 19 × 6px = 1.234px trong cột rộng 390–630px ⇒ thấy
   * 6–10 nấc trên 20. Không có dòng nhắc thì nấc 100% tồn tại mà không ai biết.
   */
  it('bước 500bp ⇒ có đủ 20 nấc VÀ có lời nhắc kéo ngang', () => {
    render(<HangChip {...KHUNG} mat="mua" buocMocBp={500} />);
    expect(screen.getByRole('button', { name: 'ALL-IN' }), 'nấc 100% phải tồn tại').toBeTruthy();
    expect(screen.getByRole('button', { name: '50%' })).toBeTruthy();
    const nhac = document.querySelector('[data-nhac-keo]');
    expect(nhac, 'hàng cuộn ngang mà không một chữ nào nói là còn nấc nữa').toBeTruthy();
    expect(nhac!.textContent).toMatch(/20 NẤC/);
  });
  it('(tiêm ngược) bước 2500bp — 4 nấc, vừa màn ⇒ KHÔNG nhắc, không rác chữ', () => {
    render(<HangChip {...KHUNG} mat="mua" buocMocBp={2500} />);
    expect(document.querySelector('[data-nhac-keo]')).toBeNull();
  });
});

describe('IV. số trên chip không cướp cú chạm của chip', () => {
  it('chạm chip vẫn báo đúng mốc khi chip mang số tiền', () => {
    const cham: number[] = [];
    render(<HangChip {...KHUNG} mat="mua" coSo={2234} onChamChip={(m) => cham.push(m)} />);
    fireEvent.click(screen.getByRole('button', { name: 'ALL-IN' }));
    expect(cham).toEqual([10000]);
  });
});

describe('V. D432 — PHÍ đứng đầu hàng lệnh, `!` mở tấm SAU LỆNH', () => {
  const LENH = [{ ma: 'btc', chieu: 'mua' as const, moc_bp: 2500 }];
  it('có phí ⇒ nút PHÍ 15 (neo coach `shop-xemtruoc`); chạm ⇒ gọi onXemSau', () => {
    let mo = 0;
    render(<HangChip {...KHUNG} mat="mua" lenh={LENH} phi={15} onXemSau={() => { mo += 1; }} />);
    const nut = document.querySelector('[data-tap="shop-xemtruoc"]') as HTMLButtonElement;
    expect(nut, 'không có nút PHÍ ở hàng lệnh').not.toBeNull();
    expect(nut.textContent).toMatch(/PHÍ\s*15/);
    fireEvent.click(nut);
    expect(mo).toBe(1);
  });
  it('(tiêm ngược) không có phí ⇒ không nút PHÍ', () => {
    render(<HangChip {...KHUNG} mat="mua" lenh={LENH} />);
    expect(document.querySelector('[data-tap="shop-xemtruoc"]')).toBeNull();
  });
});
