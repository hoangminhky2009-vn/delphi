/**
 * BÀI CANH tag bản phát hành (founder 10/10 "A"): `phat-hanh day` gắn `0.0.N` vào commit vừa lên prod + đẩy; `tag-bu` gắn bù
 * theo dòng "Đã lên prod … từ `<sha>`" của patch note. Thứ gãy được: đọc nhầm SHA của mục bản khác · dời tag đã có sang commit
 * khác (lùi bản về sai chỗ) · gắn mà không đẩy (máy khác không thấy) · gắn lại báo lỗi (không chạy lại được).
 */
import { execFileSync } from 'node:child_process';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterAll, describe, expect, it } from 'vitest';
import { cacBan, shaTuPatchNote, tagBan } from '../scripts/tag_ban.js';

const MU = [
  '# Mùa 0.0', '',
  '## 0.0.64 — 10/10/2026 · A', '', '**Đã lên prod 10/10/2026** từ `615e08e3` (master) — API x', '',
  '## 0.0.63 — 10/10/2026 · B', '', 'chưa ghi', '',
  '## 0.0.62 — 08/10/2026 · C', '', '**Đã lên prod 08/10/2026** từ `e2cbb0d3` — API y', '',
].join('\n');

const don: string[] = [];
afterAll(() => { for (const d of don) rmSync(d, { recursive: true, force: true }); });

describe('tag bản phát hành', () => {
  it('đọc SHA đúng mục; mục không ghi ⇒ null (không mượn SHA của mục kế)', () => {
    expect(cacBan(MU)).toEqual(['0.0.64', '0.0.63', '0.0.62']);
    expect(shaTuPatchNote(MU, '0.0.64')).toBe('615e08e3');
    expect(shaTuPatchNote(MU, '0.0.63')).toBeNull();
    expect(shaTuPatchNote(MU, '0.0.62')).toBe('e2cbb0d3');
    expect(shaTuPatchNote(MU, '0.0.99')).toBeNull();
  });

  it('gắn + đẩy origin; gắn lại cùng commit ⇒ ok; tag đã trỏ commit khác ⇒ từ chối, không dời', () => {
    const goc = mkdtempSync(path.join(os.tmpdir(), 'delphi-tag-')); don.push(goc);
    const bare = mkdtempSync(path.join(os.tmpdir(), 'delphi-tag-origin-')); don.push(bare);
    const git = (a: string[], c = goc): string => execFileSync('git', a, { cwd: c, encoding: 'utf8' }).trim();
    git(['init', '-q', '--bare', '-b', 'master'], bare);
    git(['init', '-q', '-b', 'master']); git(['config', 'user.email', 't@t']); git(['config', 'user.name', 't']);
    writeFileSync(path.join(goc, 'a.txt'), '1\n'); git(['add', '.']); git(['commit', '-q', '-m', 'một']);
    const mot = git(['rev-parse', 'HEAD']);
    writeFileSync(path.join(goc, 'a.txt'), '2\n'); git(['commit', '-q', '-am', 'hai']);
    const hai = git(['rev-parse', 'HEAD']);
    git(['remote', 'add', 'origin', bare]); git(['push', '-q', 'origin', 'master']);

    const kq = tagBan(goc, '0.0.9', mot.slice(0, 8));
    expect(kq).toMatchObject({ ok: true, daCo: false, sha: mot });
    expect(git(['ls-remote', '--tags', 'origin', 'refs/tags/0.0.9^{}']).split('\t')[0]).toBe(mot);
    expect(tagBan(goc, '0.0.9', mot)).toMatchObject({ ok: true, daCo: true });
    const sai = tagBan(goc, '0.0.9', hai);
    expect(sai.ok).toBe(false);
    expect(git(['rev-parse', '0.0.9^{commit}'])).toBe(mot);
    expect(tagBan(goc, '0.0.10', 'deadbeef').ok).toBe(false);
  }, 60_000);
});
