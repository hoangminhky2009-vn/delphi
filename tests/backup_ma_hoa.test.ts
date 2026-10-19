/**
 * B2 (SPEC va-bao-mat-chuan-hoa-api-dot-1, Q3 = A) — BẢN SAO LƯU RỜI MÁY CHỦ ĐÃ MÃ HOÁ, VÀ KHÔNG SỐNG QUÁ 30 NGÀY.
 *
 * Hành vi đổi: trước bản vá, mỗi đêm `auth_accounts.email` + `password_hash` lên repo GitHub dạng gzip trần (`COT_CAM`
 * chỉ loại `totp_secret`). Nay: AES-256-GCM (`node:crypto`) bằng `BACKUP_KHOA` sau gzip ⇒ tệp `.json.gz.enc`; thiếu
 * khoá ⇒ KHÔNG dựng runner ⇒ `/internal/backup` 501, không bao giờ đẩy trần; mỗi lượt xoá tệp > 30 ngày (D2 pháp lý:
 * bản sao lưu hết đọc được ≤ 30 ngày); `npm run khoi-phuc` đọc được bản mã.
 *
 * ⚠ VÌ SAO KHÔNG CHỈ QUÉT BYTE TÌM EMAIL: gzip đã mã hoá Huffman nên email gần như không bao giờ hiện nguyên chữ trong
 * bản gzip trần — bài chỉ quét byte sẽ XANH cả khi bỏ mã hoá (bài hiển nhiên). Khẳng định chịu lực là "không mở được
 * bằng gunzip" + "giải mã đúng khoá ra đúng JSON" + "sai khoá thì GCM từ chối".
 *
 * Tiêm ngược: bỏ `maHoaBackup` trong runner ⇒ ca ⭐ đầu đỏ (gunzip mở được); bỏ nhánh thiếu khoá ⇒ ca 501 đỏ;
 * đổi 30 → 3650 ngày ⇒ ca dọn đỏ.
 */
import { describe, it, expect, beforeAll, afterAll, afterEach, vi } from 'vitest';
import zlib from 'node:zlib';
import { randomBytes } from 'node:crypto';
import { mkdtemp, writeFile, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import type { Hono } from 'hono';
import { startTestDb, type TestDb } from './helpers/testdb.js';
import { createTestUser } from './helpers/fixtures.js';
import { createApp } from '../server/app.js';
import { CapturingMailer } from '../server/email.js';
import {
  BACKUP_GIU_NGAY, docKhoaBackup, giaiMaBackup, makeGithubBackupRunner, maHoaBackup, taoBackupRunnerTuEnv, xoaBanCu,
} from '../server/backup.js';
import { docTep } from '../scripts/khoi_phuc.js';

const EMAIL = 'nguoi-that-b2@dubao.test';
const KHOA = randomBytes(32);
const CFG = { token: 'gh-token-gia', repo: 'chu/delphi-backups', branch: 'main' };

let db: TestDb;

beforeAll(async () => {
  db = await startTestDb();
  const u = await createTestUser(db.pool);
  await db.pool.query(`UPDATE auth_accounts SET email = $1 WHERE user_id = $2`, [EMAIL, u.userId]);
}, 120_000);

afterAll(async () => { await db?.stop(); });
afterEach(() => { vi.unstubAllGlobals(); });

interface GoiGia { method: string; url: string; body?: any }

/** GitHub giả: ghi lại mọi lời gọi; liệt kê thư mục theo `cay` (đường dẫn → danh sách mục). */
function githubGia(cay: Record<string, { name: string; type: 'file' | 'dir'; sha?: string }[]> = {}): GoiGia[] {
  const goi: GoiGia[] = [];
  vi.stubGlobal('fetch', vi.fn(async (url: string, init: RequestInit = {}) => {
    const method = init.method ?? 'GET';
    goi.push({ method, url, ...(init.body ? { body: JSON.parse(String(init.body)) } : {}) });
    if (method === 'GET') {
      const duong = decodeURIComponent(new URL(url).pathname.split('/contents/')[1] ?? '');
      const muc = cay[duong];
      if (!muc) return new Response('{"message":"Not Found"}', { status: 404 });
      return Response.json(muc.map((m) => ({ ...m, path: `${duong}/${m.name}`, sha: m.sha ?? `sha-${m.name}` })));
    }
    return new Response('{}', { status: method === 'PUT' ? 201 : 200 });
  }));
  return goi;
}

describe('B2 — tệp đẩy lên GitHub đã mã hoá', () => {
  it('⭐ buffer đẩy đi: không gunzip được, không chứa email; giải mã đúng khoá ⇒ đúng JSON', async () => {
    const goi = githubGia();
    const runner = makeGithubBackupRunner({ ...CFG, khoa: KHOA });
    const kq = await runner(db.pool);
    const put = goi.find((g) => g.method === 'PUT')!;
    expect(put.url).toMatch(/\.json\.gz\.enc$/);
    expect(kq.path).toMatch(/\.json\.gz\.enc$/);
    const tho = Buffer.from(put.body.content, 'base64');
    expect(tho.includes(Buffer.from(EMAIL))).toBe(false);
    expect(() => zlib.gunzipSync(tho)).toThrow();
    const json = zlib.gunzipSync(giaiMaBackup(tho, KHOA)).toString('utf8');
    expect(json).toContain(EMAIL);
    expect(JSON.parse(json).meta.format).toBe(1);
  });

  it('sai khoá ⇒ GCM từ chối (không ra rác lặng lẽ)', () => {
    const ma = maHoaBackup(Buffer.from('xin chao'), KHOA);
    expect(() => giaiMaBackup(ma, randomBytes(32))).toThrow();
    const sua = Buffer.from(ma); sua[sua.length - 1] = sua[sua.length - 1]! ^ 1;
    expect(() => giaiMaBackup(sua, KHOA)).toThrow();
  });

  it('đầu tệp tự khai {v, iv, tag} — đọc được bằng mắt, đủ để giải mã', () => {
    const ma = maHoaBackup(Buffer.from('x'), KHOA);
    const dau = JSON.parse(ma.subarray(0, ma.indexOf(0x0a)).toString('utf8'));
    expect(dau).toMatchObject({ v: 1, alg: 'aes-256-gcm' });
    expect(Buffer.from(dau.iv, 'base64')).toHaveLength(12);
    expect(Buffer.from(dau.tag, 'base64')).toHaveLength(16);
  });

  it('npm run khoi-phuc (docTep) đọc được bản mã bằng BACKUP_KHOA', async () => {
    const goi = githubGia();
    await makeGithubBackupRunner({ ...CFG, khoa: KHOA })(db.pool);
    const tho = Buffer.from(goi.find((g) => g.method === 'PUT')!.body.content, 'base64');
    const thu = await mkdtemp(path.join(os.tmpdir(), 'delphi-b2-'));
    try {
      const tep = path.join(thu, 'delphi-x.json.gz.enc');
      await writeFile(tep, tho);
      const doc = await docTep(tep, { khoa: KHOA });
      expect(doc.row_counts.auth_accounts).toBeGreaterThan(0);
      await expect(docTep(tep, {})).rejects.toThrow(/BACKUP_KHOA/);
    } finally {
      await rm(thu, { recursive: true, force: true });
    }
  });
});

describe('B2 — thiếu khoá thì không đẩy', () => {
  it('docKhoaBackup: base64 32 byte ⇒ Buffer; sai độ dài ⇒ ném; vắng ⇒ undefined', () => {
    expect(docKhoaBackup(KHOA.toString('base64'))).toEqual(KHOA);
    expect(() => docKhoaBackup(randomBytes(16).toString('base64'))).toThrow(/32/);
    expect(docKhoaBackup(undefined)).toBeUndefined();
    expect(docKhoaBackup('')).toBeUndefined();
  });

  it('⭐ đủ token + repo nhưng thiếu BACKUP_KHOA (APP_ENV=production) ⇒ không runner ⇒ /internal/backup 501', async () => {
    const runner = taoBackupRunnerTuEnv({ BACKUP_GH_TOKEN: 't', BACKUP_GH_REPO: 'a/b', APP_ENV: 'production' });
    expect(runner).toBeUndefined();
    const app = createApp({
      pool: db.pool, mailer: new CapturingMailer(), appBaseUrl: 'https://dubao.test', secureCookie: false,
      backupSecret: 'cron-secret-thu', runBackup: runner,
    }) as Hono<any>;
    const r = await app.request('/api/v1/internal/backup', { headers: { 'x-cron-secret': 'cron-secret-thu' } });
    expect(r.status).toBe(501);
    expect(((await r.json()) as any).message).toContain('BACKUP_KHOA');
  });

  it('khoá hỏng (không phải 32 byte) ⇒ cũng không runner — không bao giờ rơi về bản trần', () => {
    const loi = vi.spyOn(console, 'error').mockImplementation(() => {});
    expect(taoBackupRunnerTuEnv({ BACKUP_GH_TOKEN: 't', BACKUP_GH_REPO: 'a/b', BACKUP_KHOA: 'ngan' })).toBeUndefined();
    loi.mockRestore();
  });

  it('đủ ba biến ⇒ có runner', () => {
    expect(taoBackupRunnerTuEnv({ BACKUP_GH_TOKEN: 't', BACKUP_GH_REPO: 'a/b', BACKUP_KHOA: KHOA.toString('base64') }))
      .toBeTypeOf('function');
  });
});

describe('B2 — dọn tệp quá 30 ngày (D2 pháp lý)', () => {
  it('giữ đúng 30 ngày', () => { expect(BACKUP_GIU_NGAY).toBe(30); });

  it('⭐ ngày > 30 ngày trước ⇒ DELETE từng tệp (kèm sha); ngày còn hạn ⇒ không đụng', async () => {
    const goi = githubGia({
      backups: [{ name: '2026', type: 'dir' }],
      'backups/2026': [{ name: '08', type: 'dir' }, { name: '10', type: 'dir' }],
      'backups/2026/08': [{ name: '01', type: 'dir' }],
      'backups/2026/08/01': [{ name: 'delphi-20260801T190000Z.json.gz', type: 'file' }],
      'backups/2026/10': [{ name: '15', type: 'dir' }],
      'backups/2026/10/15': [{ name: 'delphi-20261015T190000Z.json.gz.enc', type: 'file' }],
    });
    const kq = await xoaBanCu(CFG, new Date('2026-10-17T19:00:00Z'));
    const xoa = goi.filter((g) => g.method === 'DELETE');
    expect(xoa.map((g) => decodeURIComponent(g.url.split('/contents/')[1]!))).toEqual([
      'backups/2026/08/01/delphi-20260801T190000Z.json.gz',
    ]);
    expect(xoa[0]!.body).toMatchObject({ sha: 'sha-delphi-20260801T190000Z.json.gz', branch: 'main' });
    expect(kq.da_xoa).toBe(1);
  });

  it('runner gọi dọn sau khi đẩy — lỗi dọn KHÔNG làm hỏng bản vừa đẩy', async () => {
    const goi = githubGia();
    vi.spyOn(console, 'error').mockImplementation(() => {});
    const kq = await makeGithubBackupRunner({ ...CFG, khoa: KHOA })(db.pool);
    expect(kq.pushed).toBe(true);
    expect(goi.some((g) => g.method === 'GET' && g.url.includes('/contents/backups?'))).toBe(true);
  });
});
