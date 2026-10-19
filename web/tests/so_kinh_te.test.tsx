/**
 * v54 (D405) — SỔ TIẾT KIỆM CHỊU NỀN KINH TẾ ở MÀN: hai loại dòng mới server trả (`lam_phat` · `do_vo`) PHẢI có dòng
 * giải thích trong bảng kết quả vòng. Không có thì sổ tụt mà không ai nói vì sao — đúng lớp lỗi dòng HUỶ SỔ (D317) và
 * gọi ký quỹ (nằm im trong engine một tháng, `ky_quy.test.tsx`).
 *
 * Canh bằng QUÉT MÃ (đường dây DTO → dòng), vì hai dòng chỉ hiện khi nhịp kết quả đã tới bước lãi/lỗ VÀ bảng VÌ SAO mở
 * — dựng trọn màn trận tới đó là bài nặng mà không canh thêm gì. Chữ quét luật "mô tả được, kê đơn không" (A11.10).
 */
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { TU_KE_DON } from '../src/lib/khoanh_khac';

const MAN = readFileSync(resolve(process.cwd(), 'src/screens/holdem/AlphaDraftMatch.tsx'), 'utf8')
  .replace(/\/\*[\s\S]*?\*\//g, '');
const API = readFileSync(resolve(process.cwd(), 'src/api/holdem.ts'), 'utf8');

/** Khối JSX của một dòng sổ: từ điều kiện `x.loai === '<loai>'` tới hết `</div>` của nó. */
const khoiDong = (loai: string): string => {
  const i = MAN.indexOf(`x.loai === '${loai}') && `);
  expect(i, `màn không có dòng nào gắn loại '${loai}'`).toBeGreaterThan(-1);
  const j = MAN.indexOf('</div>', i);
  return MAN.slice(i, j);
};

describe('D405 — hai dòng sổ mới trong bảng kết quả vòng', () => {
  it('⭐ kiểu DTO client có đủ hai loại mới + trường `mat`', () => {
    expect(API).toMatch(/loai: 'lai' \| 'dao_han' \| 'huy' \| 'lam_phat' \| 'do_vo';/);
    expect(API).toMatch(/lai_mat\?: number; mat\?: number;/);
  });

  it('⭐ LẠM PHÁT ĂN SỔ: gắn đúng loại `lam_phat`, cộng `mat`, có dấu theo chiều (tin giả lộ trả ngược ⇒ cộng)', () => {
    const k = khoiDong('lam_phat');
    expect(k).toContain('LẠM PHÁT ĂN SỔ');
    expect(k).toMatch(/filter\(\(x\) => x\.loai === 'lam_phat'\)\.reduce\(\(t, x\) => t \+ \(x\.mat \?\? 0\), 0\)/);
    expect(k).toMatch(/mat >= 0 \? '−' : '\+'/);
  });

  it('⭐ NGÂN HÀNG ĐỔ VỠ: gắn đúng loại `do_vo`, cộng `mat`', () => {
    const k = khoiDong('do_vo');
    expect(k).toContain('NGÂN HÀNG ĐỔ VỠ');
    expect(k).toMatch(/filter\(\(x\) => x\.loai === 'do_vo'\)\.reduce\(\(t, x\) => t \+ \(x\.mat \?\? 0\), 0\)/);
  });

  it('chữ hai dòng: mô tả, không kê đơn (không "nên/hãy/phải/cần…")', () => {
    for (const loai of ['lam_phat', 'do_vo']) {
      const chu = [...khoiDong(loai).matchAll(/>([^<>{}]+)</g)].map((m) => m[1]!).join(' ').toLowerCase();
      for (const tu of TU_KE_DON) expect(chu, `dòng ${loai} dùng từ kê đơn "${tu.trim()}"`).not.toContain(tu);
    }
  });
});
