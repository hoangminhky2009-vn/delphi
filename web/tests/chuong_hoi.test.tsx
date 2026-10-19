import { describe, expect, it } from 'vitest';
import { render } from '@testing-library/react';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { chuongHoi } from '../src/lib/chuong_hoi';
import { ChuongHoi } from '../src/components/holdem/ChuongHoi';
import type { ODTO } from '../src/api/holdem';

/*
 * CHƯƠNG HỒI — món 1 của cụm D85/D86 (doc 06 §2).
 *
 * Bài khoá bốn thứ, mỗi thứ một lớp lỗi đã từng xảy ra ở repo này:
 *   1. LUẬT SUY: từng hồi ra đúng nhãn, và THỨ TỰ ƯU TIÊN đúng (hồi cố gần
 *      thắng hồi cố xa — [sập sàn, phục hồi] là GẦY DỰNG LẠI, không phải
 *      SÓNG GIÓ).
 *   2. NHIỄU KHÔNG LẬT NHÃN: một ô đỏ lẻ giữa dải xanh không được thành
 *      "SÓNG GIÓ" — nhãn nhảy theo từng ô thì người chơi học cách phớt lờ.
 *   3. ⚠⚠ KHÔNG RÒ THÔNG TIN ẨN: nguồn của lib bị quét — nó mà đọc
 *      `suc_cang_dai` hay sự thật tin giả thì chương hồi thành lá Lướt Sóng
 *      phát không, giết đặc quyền người khác trả tiền mua.
 *   4. DÂY NỐI: component render ra nhãn, và màn trận THẬT SỰ mount nó —
 *      bẫy "cơ chế trang trí" đã dính 19 lần.
 */

const gd = (giai_doan: string): ODTO => ({ kind: 'giai_doan', giai_doan });
const sk = (su_kien: string, bao_truoc: string): ODTO => ({ kind: 'su_kien', su_kien, bao_truoc });

describe('luật suy chương', () => {
  it('≤1 ô thấy được → MỞ MÀN (một ô chưa phải một câu chuyện)', () => {
    expect(chuongHoi([], null, null, 'trung_tinh').id).toBe('mo_man');
    expect(chuongHoi([], gd('tang'), null, 're').id).toBe('mo_man');
  });

  it('phục hồi trong 2 ô gần nhất → GẦY DỰNG LẠI', () => {
    expect(chuongHoi([sk('hack_san', 'giam')], gd('phuc_hoi'), null, 'trung_tinh').id)
      .toBe('gay_dung');
  });

  it('⭐ ưu tiên: [sập sàn, phục hồi] là GẦY DỰNG LẠI — cú rơi là chuyện hồi trước', () => {
    const ch = chuongHoi([gd('giam'), sk('hack_san', 'giam')], gd('phuc_hoi'), null, 'trung_tinh');
    expect(ch.id).toBe('gay_dung');
  });

  it('≥2/3 ô gần nhất nghiêng xuống/hỗn loạn → SÓNG GIÓ (đọc bao_truoc, không cần danh sách id)', () => {
    expect(chuongHoi([gd('tang'), gd('giam')], sk('thien_nga_den', 'bien_dong'), null, 'trung_tinh').id)
      .toBe('song_gio');
  });

  it('⭐ nhiễu KHÔNG lật nhãn: một ô đỏ lẻ giữa dải xanh không phải SÓNG GIÓ', () => {
    const ch = chuongHoi([gd('tang'), gd('tang')], gd('giam'), { huong: 0, dai: 0 }, 'trung_tinh');
    expect(ch.id).not.toBe('song_gio');
  });

  it('chuỗi tăng đã xác nhận ≥2 + tiền rẻ → BONG BÓNG PHỒNG', () => {
    expect(chuongHoi([gd('tang'), gd('tang')], gd('tang'), { huong: 1, dai: 2 }, 're').id)
      .toBe('bong_bong');
  });

  it('chuỗi tăng ≥3 tự nó là BONG BÓNG PHỒNG, không cần mồi', () => {
    expect(chuongHoi([gd('tang'), gd('tang'), gd('tang')], gd('tang'), { huong: 1, dai: 3 }, 'dat').id)
      .toBe('bong_bong');
  });

  it('chuỗi GIẢM dài không bao giờ thành BONG BÓNG (dấu của hướng có nghĩa)', () => {
    // 2 ô cuối nghiêng xuống ⇒ SÓNG GIÓ chặn trước — nhưng kể cả đường suy
    // bong bóng cũng phải chết vì huong < 0. Ép qua cửa sổ toàn đi ngang:
    const ch = chuongHoi([gd('di_ngang'), gd('di_ngang')], gd('di_ngang'), { huong: -1, dai: 4 }, 'trung_tinh');
    expect(ch.id).not.toBe('bong_bong');
  });

  it('không kịch → nền lãi suất kể nốt: rẻ / đắt / trung tính', () => {
    const yen = [gd('di_ngang'), gd('di_ngang')];
    expect(chuongHoi(yen, gd('di_ngang'), null, 're').id).toBe('tien_re');
    expect(chuongHoi(yen, gd('di_ngang'), null, 'dat').id).toBe('tien_dat');
    expect(chuongHoi(yen, gd('di_ngang'), null, 'trung_tinh').id).toBe('giu_nhip');
  });
});

describe('không rò thông tin ẩn + A10', () => {
  const nguon = readFileSync(resolve(process.cwd(), 'src/lib/chuong_hoi.ts'), 'utf8')
    // Bỏ chú thích trước khi quét — lời văn được phép NHẮC TÊN thứ bị cấm để
    // giải thích vì sao cấm (bài học báo động giả của header_bao_mat).
    .replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');

  it('⚠⚠ lib KHÔNG đọc sức căng / sự thật tin giả (đặc quyền trả phí)', () => {
    for (const cam of ['suc_cang', 'la_tin_gia', 'tin_gia_ky_vong', 'du_bao']) {
      expect(nguon.includes(cam), `lib đang đọc "${cam}" — rò đặc quyền trả phí`).toBe(false);
    }
  });

  it('A10: câu phụ MÔ TẢ, không kê đơn — không chữ "hãy/nên/đừng"', () => {
    for (const c of ['hãy ', 'nên ', 'đừng ', 'phải ']) {
      expect(nguon.toLowerCase().includes(c), `câu phụ chứa "${c.trim()}" — đang kê đơn`).toBe(false);
    }
  });
});

describe('dây nối', () => {
  it('component vẽ ra tên hồi + câu phụ', () => {
    const { container } = render(
      <ChuongHoi
        lichSuO={[gd('tang'), gd('giam')]}
        oHienTai={sk('thien_nga_den', 'bien_dong')}
        xuHuong={null}
        moiTruong="trung_tinh"
      />,
    );
    expect(container.textContent).toContain('SÓNG GIÓ');
    expect(container.textContent).toContain('Tin xấu dồn dập');
    expect(container.querySelector('[data-chuong="song_gio"]')).toBeTruthy();
  });

  it('⭐ màn trận THẬT SỰ mount nó — không phải một component mồ côi', () => {
    const man = readFileSync(
      resolve(process.cwd(), 'src/screens/holdem/AlphaDraftMatch.tsx'), 'utf8',
    );
    expect(man.includes('<ChuongHoi'), 'AlphaDraftMatch không render ChuongHoi — cơ chế trang trí thứ 20')
      .toBe(true);
  });
});
