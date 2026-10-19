/**
 * CHIP LÀ NGÔN NGỮ — D184.
 *
 * Luật nền: **mỗi mốc đặt lệnh phải ra một hình dạng cọc KHÁC NHAU.** Không nấc
 * nào vẽ giống nấc nào — đó là điều kiện để cọc chip nói được điều gì.
 *
 *   §I  DÀY + MẢNH — phép tách, và ca "làm tròn nuốt thông tin" của bản cũ.
 *   §II ⭐⭐ CHIA LỆNH LỘ RA Ở BÀN — không có lá thì không bao giờ có mảnh.
 *   §III VẼ — mảnh phải THẤP hơn, không chỉ mờ hơn.
 */
import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { CocChip, chipTuMoc, chipTuTien, BP_CHIP_DAY, BP_CHIP_MANH } from '../src/components/holdem/CocChip';
import { render } from '@testing-library/react';

/** Bước mốc thật của server: thô 25% khi không có Chia Lệnh, mịn 5% khi có. */
const THO = 2500;
const MIN = 500;
const mocs = (buoc: number) => {
  const ds: number[] = [];
  for (let m = buoc; m < 10000; m += buoc) ds.push(m);
  ds.push(10000);
  return ds;
};

describe('I. Tách DÀY + MẢNH', () => {
  it('bội 25% ra chip dày tròn, không mảnh', () => {
    expect(chipTuMoc(2500)).toEqual({ day: 1, manh: 0 });
    expect(chipTuMoc(5000)).toEqual({ day: 2, manh: 0 });
    expect(chipTuMoc(7500)).toEqual({ day: 3, manh: 0 });
    expect(chipTuMoc(10000)).toEqual({ day: 4, manh: 0 });
  });

  it('⭐⭐ mốc lẻ ra MẢNH — đây là thông tin bản cũ làm tròn mất', () => {
    expect(chipTuMoc(3500)).toEqual({ day: 1, manh: 2 });   // 25% + 2×5%
    expect(chipTuMoc(1500)).toEqual({ day: 0, manh: 3 });
    expect(chipTuMoc(9500)).toEqual({ day: 3, manh: 4 });
  });

  it('⭐⭐ MỌI mốc mịn cho ra hình dạng cọc KHÁC NHAU (bản cũ gộp 25% với 35%)', () => {
    const hinh = new Set(mocs(MIN).map((m) => {
      const c = chipTuMoc(m);
      return `${c.day}:${c.manh}`;
    }));
    expect(hinh.size, 'có hai mốc vẽ ra cùng một cọc ⇒ cọc lại thành nhãn làm tròn')
      .toBe(mocs(MIN).length);
  });

  it('lệnh có thật thì cọc phải nói — mốc nhỏ hơn một mảnh vẫn hiện', () => {
    expect(chipTuMoc(100).day + chipTuMoc(100).manh).toBeGreaterThan(0);
    expect(chipTuMoc(0)).toEqual({ day: 0, manh: 0 });
  });

  it('hằng số khớp bước mốc thật của server', () => {
    expect(BP_CHIP_DAY).toBe(THO);
    expect(BP_CHIP_MANH).toBe(MIN);
  });
});

describe('II. ⭐⭐ Chia Lệnh lộ ra ngay trên bàn', () => {
  it('⭐⭐ KHÔNG có Chia Lệnh ⇒ không bao giờ có chip mảnh', () => {
    for (const m of mocs(THO)) {
      expect(chipTuMoc(m).manh, `mốc ${m} sinh mảnh dù không cầm Chia Lệnh`).toBe(0);
    }
  });

  it('⭐⭐ CÓ Chia Lệnh ⇒ đa số mốc sinh mảnh (dấu hiệu đọc được từ xa)', () => {
    const coManh = mocs(MIN).filter((m) => chipTuMoc(m).manh > 0).length;
    expect(coManh).toBeGreaterThan(mocs(MIN).length / 2);
  });

  it('tổng giá trị cọc đúng bằng mốc — chip không được nói sai số tiền', () => {
    for (const m of mocs(MIN)) {
      const c = chipTuMoc(m);
      expect(c.day * BP_CHIP_DAY + c.manh * BP_CHIP_MANH, `mốc ${m}`).toBe(m);
    }
  });
});

describe('III. Vẽ — mảnh THẤP hơn, không chỉ mờ hơn', () => {
  const css = readFileSync(
    resolve(process.cwd(), 'src/components/holdem/CocChip.module.css'), 'utf8');
  const cao = (lop: string) => {
    const kh = new RegExp(`\\.${lop}\\s*\\{([^}]*)\\}`).exec(css)?.[1] ?? '';
    return Number(/height:\s*(\d+)px/.exec(kh)?.[1] ?? NaN);
  };

  it('⭐ mảnh thấp hơn dày — mắt đọc CHIỀU CAO cọc, mờ hơn thì không đủ', () => {
    expect(cao('manh')).toBeLessThan(cao('chip'));
  });

  it('mảnh vẫn nhìn thấy được (không phải 0px)', () => {
    expect(cao('manh')).toBeGreaterThan(0);
  });
});

/*
 * D435 — founder 27/09 (ảnh ALL-IN khi ví còn 1.330): *"chip vàng đây này trong khi đã tiêu hết tiền?"*. Cọc đang xếp
 * MUA đếm theo TIỀN của lệnh (bản nháp server), cùng đơn vị chip với cọc đang giữ; ALL-IN thôi tô vàng.
 * Tiêm lỗi: bỏ nhánh `choTien` trong CocChip ⇒ bài render đỏ (ra 4 chip dày như ALL-IN 10.000).
 */
describe('D435 — cọc chip đang xếp đếm theo TIỀN', () => {
  it('chipTuTien: dày = một đơn vị, mảnh = 1/5; làm tròn mảnh lên đủ 5 thì thành một dày; lệnh có thật ít nhất một mảnh', () => {
    expect(chipTuTien(2500, 2500)).toEqual({ day: 1, manh: 0 });
    expect(chipTuTien(10000, 2500)).toEqual({ day: 4, manh: 0 });
    expect(chipTuTien(1326, 2500)).toEqual({ day: 0, manh: 3 });
    expect(chipTuTien(2400, 2500)).toEqual({ day: 1, manh: 0 });
    expect(chipTuTien(60, 2500)).toEqual({ day: 0, manh: 1 });
    expect(chipTuTien(0, 2500)).toEqual({ day: 0, manh: 0 });
  });
  it('ALL-IN chỉ mang 1.326 ⇒ cọc chờ 3 mảnh (không phải 4 chip dày), và không chip vàng', () => {
    const { container } = render(
      <CocChip giu={0} khong={0} cho={[{ chieu: 'mua', moc_bp: 10000 }]} choTien={1326} donVi={2500} />,
    );
    const chips = [...container.querySelectorAll('i')];
    expect(chips).toHaveLength(3);
    expect(chips.every((c) => /manh/.test(c.className))).toBe(true);
    expect(chips.some((c) => /vang/.test(c.className))).toBe(false);
  });
  it('vế ngược — chưa có bản nháp (vắng choTien) ⇒ về mốc như cũ: ALL-IN = 4 chip dày', () => {
    const { container } = render(<CocChip giu={0} khong={0} cho={[{ chieu: 'mua', moc_bp: 10000 }]} donVi={2500} />);
    const chips = [...container.querySelectorAll('i')];
    expect(chips).toHaveLength(4);
    expect(chips.some((c) => /manh/.test(c.className))).toBe(false);
  });
});
