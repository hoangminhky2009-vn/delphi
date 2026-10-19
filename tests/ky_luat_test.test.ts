/**
 * KỶ LUẬT TEST — bài đỏ phải được điều tra, không được tắt cho êm (D562 · CLAUDE.md A11.30).
 *
 * Vì sao có bài này: agent fix mãi không xanh thì có ba lối tắt rẻ — `.skip`, comment bài test kèm câu
 * "không liên quan việc đang làm", hoặc nới khẳng định cho tới khi nó hiển nhiên. Hai lối đầu máy bắt được,
 * nên bắt ở đây; lối thứ ba để `npm run tiem` bắt (bài vẫn xanh khi mã bị tiêm lỗi = bài hiển nhiên).
 * Đo 09/10: 0 lối tắt trong 493 tệp test — bài này giữ con số đó, không dọn nợ cũ.
 *
 * Đường DUY NHẤT để một bài đỏ không chạy là sổ cách ly `tests/_cach_ly.json` (lý do · chủ · việc chữa · hạn)
 * — và sổ ấy KHÔNG nhận bài canh cửa một chiều (N5): tiền phải cân (`auditSupply`) · `events` · consent.
 * Bài tiền đỏ thì phải sửa, không được cất đi (stress A3 đỏ trên nhánh prod từ 03/10 là ví dụ).
 */
import { readFileSync, readdirSync, existsSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import { describe, expect, it } from 'vitest';

const GOC = process.cwd();
const TU_THAN = 'tests/ky_luat_test.test.ts';

function tepTest(thuMuc: string): string[] {
  const ra: string[] = [];
  const di = (d: string) => {
    if (!existsSync(d)) return;
    for (const ten of readdirSync(d)) {
      if (ten === 'node_modules') continue;
      const p = join(d, ten);
      if (statSync(p).isDirectory()) di(p);
      else if (/\.test\.tsx?$/.test(ten)) ra.push(relative(GOC, p).replace(/\\/g, '/'));
    }
  };
  di(join(GOC, thuMuc));
  return ra;
}

/** Lối tắt bị cấm — mỗi mẫu một tên để thông báo đỏ nói đúng điều gì. */
export const LOI_TAT: { ten: string; re: RegExp }[] = [
  { ten: '.skip/.only/.todo', re: /\b(?:it|test|describe|suite|bench)\.(?:skip|only|todo)\b/ },
  { ten: '.skipIf', re: /\b(?:it|test|describe|suite)\.skipIf\s*\(/ },
  { ten: 'xit/xdescribe/xtest', re: /(?<![\w.])(?:xit|xdescribe|xtest)\s*\(/ },
  { ten: 'bài test bị comment', re: /^\s*\/\/\s*(?:it|test|describe)(?:\.\w+)?\s*\(\s*['"`]/m },
];

/** Miễn trừ theo (tệp, dòng nguyên văn) — có founder gật mới thêm (feedback: miễn theo tên lọt). Đang rỗng. */
export const MIEN: { tep: string; dong: string; ly_do: string }[] = [];

export function quetLoiTat(tep: string, noiDung: string): string[] {
  const loi: string[] = [];
  noiDung.split('\n').forEach((dong, i) => {
    for (const { ten, re } of LOI_TAT) {
      if (!re.test(dong)) continue;
      if (MIEN.some((m) => m.tep === tep && m.dong === dong.trim())) continue;
      loi.push(`${tep}:${i + 1} — ${ten}: ${dong.trim().slice(0, 100)}`);
    }
  });
  return loi;
}

interface MucCachLy { tep: string; do_tu?: string; ly_do?: string; chu?: string; viec_chua?: string; het_han?: string }

/** Bài canh cửa một chiều — không bao giờ được cách ly. */
export function laCuaMotChieu(tep: string, noiDung: string): string | null {
  if (/\bauditSupply\b/.test(noiDung)) return 'gọi auditSupply (tiền phải cân)';
  if (/(^|[/_])(events?|consent)[_.]/i.test(tep.split('/').pop() ?? '')) return 'canh events/consent';
  return null;
}

describe('I. Không lối tắt trong bài test (A11.30)', () => {
  it('tự kiểm: mỗi mẫu bắt đúng ca nó canh, và không bắt câu thường', () => {
    expect(quetLoiTat('x', "  it.skip('a', () => {})")).toHaveLength(1);
    expect(quetLoiTat('x', "describe.only('a', () => {})")).toHaveLength(1);
    expect(quetLoiTat('x', "it.todo('viết sau')")).toHaveLength(1);
    expect(quetLoiTat('x', "it.skipIf(process.env.CI)('a', () => {})")).toHaveLength(1);
    expect(quetLoiTat('x', "xit('a', () => {})")).toHaveLength(1);
    expect(quetLoiTat('x', "  // it('bài này không liên quan, để sau', () => {")).toHaveLength(1);
    expect(quetLoiTat('x', "it('bỏ qua lượt (skip) khi hết giờ', () => {})")).toHaveLength(0);
    expect(quetLoiTat('x', "s.index('thang').getAll(IDBKeyRange.only(q.thang))")).toHaveLength(0);
    expect(quetLoiTat('x', '// test này chạy chậm vì dựng DB')).toHaveLength(0);
  });

  it('mọi tệp test ở tests/ · web/tests/ · web/src/ sạch lối tắt', () => {
    const tep = [...tepTest('tests'), ...tepTest('web/tests'), ...tepTest('web/src')].filter((t) => t !== TU_THAN);
    expect(tep.length, 'không thấy tệp test nào — đường quét đã trôi?').toBeGreaterThan(300);
    const loi = tep.flatMap((t) => quetLoiTat(t, readFileSync(join(GOC, t), 'utf8')));
    expect(loi, 'Bài đỏ thì điều tra (skill /bai-test), không tắt. Không chạy được thật ⇒ sổ cách ly có hạn.').toEqual([]);
  });
});

describe('II. Sổ cách ly là đường duy nhất, và có cửa một chiều (A11.30 · N5)', () => {
  const so = JSON.parse(readFileSync(join(GOC, 'tests/_cach_ly.json'), 'utf8')) as { goc: MucCachLy[]; web: MucCachLy[] };
  const muc = [...so.goc.map((m) => ({ ...m, goc: '' })), ...so.web.map((m) => ({ ...m, goc: 'web/' }))];

  it('mỗi mục đủ lý do · chủ · việc chữa · hạn ≤ 30 ngày kể từ lúc đỏ, và tệp có thật', () => {
    for (const m of muc) {
      for (const k of ['do_tu', 'ly_do', 'chu', 'viec_chua', 'het_han'] as const) {
        expect((m[k] ?? '').trim().length, `${m.tep}: thiếu "${k}"`).toBeGreaterThan(3);
      }
      const ngay = (Date.parse(m.het_han!) - Date.parse(m.do_tu!)) / 86_400_000;
      expect(ngay, `${m.tep}: hạn cách ly ${ngay} ngày — tối đa 30, gia hạn phải ghi lý do mới`).toBeLessThanOrEqual(30);
      expect(existsSync(join(GOC, m.goc + m.tep)), `${m.tep}: tệp không tồn tại — cách ly một bài đã xoá?`).toBe(true);
    }
  });

  it('không cách ly bài canh tiền · events · consent', () => {
    for (const m of muc) {
      const ly = laCuaMotChieu(m.tep, readFileSync(join(GOC, m.goc + m.tep), 'utf8'));
      expect(ly, `${m.tep} ${ly} — cửa một chiều, đỏ thì phải SỬA, không được cách ly`).toBeNull();
    }
    expect(laCuaMotChieu('tests/stress.test.ts', 'await auditSupply(pool)')).not.toBeNull();
    expect(laCuaMotChieu('tests/events_check_du_loai.test.ts', '')).not.toBeNull();
    expect(laCuaMotChieu('tests/o_up_v53.test.ts', 'luatCua(')).toBeNull();
  });
});
