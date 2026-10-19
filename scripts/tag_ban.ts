/**
 * TAG BẢN PHÁT HÀNH — `git tag 0.0.N <SHA đã lên prod>` + đẩy lên origin (founder 10/10 "A", giao qua cửa sổ minigame-v57).
 * Trước đó repo không có tag nào cho 0.0.x: lùi bản phải đọc patch note lấy SHA. Nay `phat-hanh -- day --that` tự gắn sau khi
 * khói xanh; `phat-hanh -- tag-bu [--that]` gắn bù cho mọi bản mà patch note ghi "Đã lên prod … từ `<sha>`".
 * Tag CÓ CHÚ THÍCH (`-a`) — mang ngày + người gắn. Không bao giờ dời tag đã có (trỏ commit khác ⇒ từ chối, báo).
 * Bài canh: tests/tag_ban.test.ts.
 */
import { spawnSync } from 'node:child_process';

function git(args: string[], cwd: string): { rc: number; out: string } {
  const r = spawnSync('git', args, { cwd, encoding: 'utf8' });
  return { rc: r.status ?? -1, out: `${r.stdout ?? ''}${r.stderr ?? ''}`.trim() };
}

/** Thuần: SHA ghi ở dòng "Đã lên prod … từ `<sha>`" trong mục `## <bản>` của patch note (null nếu không ghi). */
export function shaTuPatchNote(mu: string, ban: string): string | null {
  const dau = mu.indexOf(`## ${ban} `);
  if (dau < 0) return null;
  const sau = mu.indexOf('\n## ', dau + 1);
  const muc = mu.slice(dau, sau < 0 ? undefined : sau);
  return /Đã lên prod[^\n`]*từ `([0-9a-f]{7,40})`/i.exec(muc)?.[1] ?? null;
}

/** Thuần: mọi bản có mục `## 0.0.N` trong patch note, mới trước. */
export function cacBan(mu: string): string[] {
  return [...mu.matchAll(/^## (\d+\.\d+\.\d+) /gm)].map((m) => m[1]!);
}

export type KetQuaTag = { ok: true; daCo: boolean; sha: string } | { ok: false; loi: string };

/** Gắn tag `ban` vào `sha` (rút gọn được) và đẩy lên origin. Đã có tag cùng commit ⇒ ok (daCo); khác commit ⇒ từ chối. */
export function tagBan(cwd: string, ban: string, sha: string, day = true): KetQuaTag {
  const day_ = git(['rev-parse', '--verify', '--quiet', `${sha}^{commit}`], cwd);
  if (day_.rc !== 0) return { ok: false, loi: `không có commit ${sha} trong repo` };
  const full = day_.out;
  const cu = git(['rev-parse', '--verify', '--quiet', `refs/tags/${ban}^{commit}`], cwd);
  if (cu.rc === 0) {
    if (cu.out !== full) return { ok: false, loi: `tag ${ban} đã có, trỏ ${cu.out.slice(0, 8)} ≠ ${full.slice(0, 8)} — không dời tag; kiểm tay` };
  } else {
    const t = git(['tag', '-a', ban, full, '-m', `Phát hành ${ban}`], cwd);
    if (t.rc !== 0) return { ok: false, loi: `git tag hỏng: ${t.out}` };
  }
  if (day) {
    const p = git(['push', '-q', 'origin', `refs/tags/${ban}`], cwd);
    if (p.rc !== 0) return { ok: false, loi: `đẩy tag ${ban} hỏng: ${p.out.split('\n').slice(-1)[0]}` };
  }
  return { ok: true, daCo: cu.rc === 0, sha: full };
}

/** `tag-bu`: mọi bản có SHA trong patch note mà chưa có tag. `that` ⇒ gắn + đẩy; không ⇒ chỉ in kế hoạch. */
export function tagBu(cwd: string, mu: string, that: boolean): number {
  let loi = 0;
  for (const ban of cacBan(mu)) {
    const sha = shaTuPatchNote(mu, ban);
    if (!sha) { console.log(`· ${ban}: patch note không ghi SHA prod — bỏ qua`); continue; }
    if (!that) { console.log(`· ${ban} → ${sha}`); continue; }
    const kq = tagBan(cwd, ban, sha);
    if (kq.ok) console.log(`✔ ${ban} → ${kq.sha.slice(0, 8)}${kq.daCo ? ' (đã có)' : ' (gắn + đẩy)'}`);
    else { console.error(`✗ ${ban}: ${kq.loi}`); loi++; }
  }
  if (!that) console.log('Thêm --that để gắn + đẩy tag lên origin.');
  return loi ? 1 : 0;
}
