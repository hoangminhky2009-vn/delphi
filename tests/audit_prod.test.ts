/**
 * BÀI CANH audit gói prod có ngoại lệ (founder 01/11 B — lô 31/10 đỏ vì GHSA-mrhx-c7xc-m3w5 ở zod 3.x qua SDK Discord).
 *
 * Thứ gãy được: ngoại lệ nuốt cả cảnh báo KHÁC cùng gói · nuốt cảnh báo ở thư mục khác · gói phụ thuộc (via chuỗi) bị tính
 * thành lỗ thứ hai · ngoại lệ ở lại mãi sau khi hết cần · audit lỗi mạng mà coi là xanh.
 */
import { describe, expect, it } from 'vitest';
// @ts-expect-error — .mjs thuần
import { danhGia, NGOAI_LE } from '../scripts/audit_prod.mjs';

const via = (ghsa: string, severity: string, name = 'zod') => ({ source: 1, name, title: `lỗ ${ghsa}`, url: `https://github.com/advisories/${ghsa}`, severity, range: '<9' });
const bao = (vulns: Record<string, { via: unknown[] }>) => ({ auditReportVersion: 2, vulnerabilities: vulns, metadata: {} });
const LE = [{ thu_muc: 'web', ghsa: 'GHSA-aaaa-bbbb-cccc', goi: 'zod', ly_do: 'thử', go_khi: 'thử' }];

describe('audit_prod — ngoại lệ có hạn', () => {
  it('ca thật 31/10: zod high có ngoại lệ + SDK Discord phụ thuộc (via chuỗi) + react-router moderate ⇒ không chặn', () => {
    const kq = danhGia(bao({
      zod: { via: [via('GHSA-mrhx-c7xc-m3w5', 'high')] },
      '@discord/embedded-app-sdk': { via: ['zod'] },
      'react-router': { via: [via('GHSA-wrjc-x8rr-h8h6', 'moderate', 'react-router')] },
    }), 'web');
    expect(kq.chan).toEqual([]);
    expect(kq.thua).toEqual([]);
    expect(kq.boQua.map((b: { ghsa: string }) => b.ghsa)).toEqual(['GHSA-mrhx-c7xc-m3w5']);
  });

  it('cảnh báo high KHÁC ở cùng gói vẫn chặn; critical ở gói khác chặn', () => {
    const kq = danhGia(bao({
      zod: { via: [via('GHSA-aaaa-bbbb-cccc', 'high'), via('GHSA-zzzz-zzzz-zzzz', 'high')] },
      nodemailer: { via: [via('GHSA-nnnn-nnnn-nnnn', 'critical', 'nodemailer')] },
    }), 'web', LE);
    expect(kq.chan.map((c: { ghsa: string }) => c.ghsa)).toEqual(['GHSA-zzzz-zzzz-zzzz', 'GHSA-nnnn-nnnn-nnnn']);
  });

  it('cùng GHSA nhưng gói khác, hoặc thư mục khác ⇒ không được miễn', () => {
    expect(danhGia(bao({ khac: { via: [via('GHSA-aaaa-bbbb-cccc', 'high', 'khac')] } }), 'web', LE).chan).toHaveLength(1);
    expect(danhGia(bao({ zod: { via: [via('GHSA-aaaa-bbbb-cccc', 'high')] } }), 'goc', LE).chan).toHaveLength(1);
  });

  it('ngoại lệ không còn cảnh báo nào khớp ⇒ THỪA (điều kiện gỡ tới — bước CI đỏ)', () => {
    const kq = danhGia(bao({}), 'web', LE);
    expect(kq.thua.map((t: { ghsa: string }) => t.ghsa)).toEqual(['GHSA-aaaa-bbbb-cccc']);
    expect(danhGia(bao({}), 'goc', LE).thua).toEqual([]);
  });

  it('npm audit không trả báo cáo (lỗi mạng, JSON rỗng) ⇒ ném, không coi là xanh', () => {
    expect(() => danhGia(null, 'web')).toThrow();
    expect(() => danhGia({ error: { code: 'ENOTFOUND' } }, 'web')).toThrow(/ENOTFOUND/);
  });

  it('mỗi ngoại lệ đang có đều nêu lý do và điều kiện gỡ', () => {
    for (const n of NGOAI_LE) {
      expect(n.ly_do.length).toBeGreaterThan(20);
      expect(n.go_khi.length).toBeGreaterThan(20);
      expect(n.ghsa).toMatch(/^GHSA-[\w]{4}-[\w]{4}-[\w]{4}$/);
    }
  });
});
