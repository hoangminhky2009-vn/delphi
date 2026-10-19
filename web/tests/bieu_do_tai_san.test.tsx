/**
 * CHART TÀI SẢN (founder 07/10) — nút cửa sổ ở chỗ Bảng điện tử cũ, bấm mở chart sáu mã qua các vòng đã chốt.
 *   §I   chỉ số dồn từ % từng vòng (hiển thị, không phải tiền) — +10 % rồi −10 % là −1 %, không phải 0
 *   §II  lớp phủ: mặc định mã đang cầm · bấm hàng đổi chart · chip từng vòng · chưa chốt vòng nào thì báo rỗng
 *   §III màn trận: trận không bán Bảng điện tử thì chỗ nút ấy là CHART, đọc `stBan` (không lộ vòng chưa diễn)
 */
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { cleanup, fireEvent, render } from '@testing-library/react';

import { BieuDoTaiSan, chuoiCuaMa } from '../src/components/holdem/BieuDoTaiSan';

afterEach(() => { cleanup(); });

const LS = [
  { vong: 1, thi_truong: [{ ma: 'btc', delta_bp: 1000 }, { ma: 'vang', delta_bp: -200 }] },
  { vong: 2, thi_truong: [{ ma: 'btc', delta_bp: -1000 }, { ma: 'vang', delta_bp: 300 }] },
];
const MA = [{ id: 'btc', ten: 'Bitcoin' }, { id: 'vang', ten: 'Vàng', dangCam: true }];

describe('§I — chuỗi chỉ số', () => {
  it('dồn theo tích, vòng thiếu mã = đứng giá', () => {
    const c = chuoiCuaMa(LS, 'btc');
    expect(c.map((x) => x.bp)).toEqual([1000, -1000]);
    expect(c[1]!.chiSo).toBeCloseTo(99, 6);
    expect(chuoiCuaMa(LS, 'khong_co').map((x) => x.chiSo)).toEqual([100, 100]);
  });
});

describe('§II — lớp phủ', () => {
  it('⭐ mở ra mã đang cầm; bấm hàng khác đổi chart; chip từng vòng', () => {
    const { getByRole, getAllByRole } = render(<BieuDoTaiSan lichSu={LS} ma={MA} oLich={[1]} />);
    fireEvent.click(getByRole('button', { name: /bảng điện tử/i }));
    const dlg = getByRole('dialog');
    expect(dlg.textContent).toContain('TỚI VÒNG 2');
    expect(dlg.querySelector('[class*="tenLon"]')!.textContent).toBe('Vàng');
    // vàng: −2 % rồi +3 % ⇒ 100 × 0,98 × 1,03 = 100,94 ⇒ +0,94 %
    expect(dlg.querySelector('[class*="tongLon"]')!.textContent).toBe('+0,94%');
    expect(dlg.textContent).toContain('V1');
    const hangBtc = getAllByRole('button').find((b) => b.textContent?.includes('Bitcoin'))!;
    fireEvent.click(hangBtc);
    expect(hangBtc.getAttribute('aria-pressed')).toBe('true');
    expect(dlg.querySelector('[class*="tenLon"]')!.textContent).toBe('Bitcoin');
    expect(dlg.querySelector('[class*="tongLon"]')!.textContent).toBe('-1,00%');
    expect(dlg.querySelectorAll('svg[role="img"] rect').length, 'một cây nến mỗi vòng').toBe(2);
  });

  it('D558 — có râu + khối lượng ⇒ mỗi vòng một râu, một cột khối lượng; cột trên trung bình sáng hơn', () => {
    const ls = [
      { vong: 1, thi_truong: [{ ma: 'btc', delta_bp: 500, cao_bp: 1200, thap_bp: -300, kl: 10 }] },
      { vong: 2, thi_truong: [{ ma: 'btc', delta_bp: -200, cao_bp: 100, thap_bp: -900, kl: 30 }] },
    ];
    const c = chuoiCuaMa(ls, 'btc');
    expect(c[0]!.cao).toBeCloseTo(112, 6);
    expect(c[1]!.thap).toBeCloseTo(105 * 0.91, 6);
    const { getByRole } = render(<BieuDoTaiSan lichSu={ls} ma={[{ id: 'btc', ten: 'Bitcoin' }]} />);
    fireEvent.click(getByRole('button', { name: /bảng điện tử/i }));
    const svg = getByRole('dialog').querySelector('svg[role="img"]')!;
    expect(svg.querySelectorAll('line[class*="rau"]').length).toBe(2);
    expect(svg.querySelectorAll('rect[class*="kl"]').length).toBe(2);
    expect(svg.querySelectorAll('rect[class*="klCao"]').length, 'chỉ vòng 2 trên trung bình').toBe(1);
  });

  it('chưa chốt vòng nào ⇒ câu báo rỗng, không vẽ chart', () => {
    const { getByRole } = render(<BieuDoTaiSan lichSu={[]} ma={MA} />);
    fireEvent.click(getByRole('button', { name: /bảng điện tử/i }));
    expect(getByRole('dialog').textContent).toContain('Chưa có vòng nào chốt');
    expect(getByRole('dialog').querySelector('svg[role="img"]')).toBeNull();
  });
});

describe('§III — màn trận', () => {
  const src = readFileSync(resolve(process.cwd(), 'src/screens/holdem/AlphaDraftMatch.tsx'), 'utf8');
  it('trận không bán Bảng điện tử ⇒ chỗ nút ấy là BieuDoTaiSan, đọc stBan', () => {
    const i = src.indexOf(': b.khong_bang_dien_tu ? (');
    expect(i).toBeGreaterThan(0);
    const khoi = src.slice(i, src.indexOf(') : undefined}', i));
    expect(khoi).toContain('<BieuDoTaiSan');
    expect(khoi).toContain('stBan.lich_su_thi_truong');
    expect(khoi).not.toMatch(/\bst\.lich_su_thi_truong/);
  });
});
