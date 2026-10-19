/**
 * B5 — QUỸ CHỢ: sổ tiền thứ tư, và cái audit phải nhìn thấy nó.
 *
 * Ba thứ phải đúng, theo thứ tự nguy hiểm giảm dần:
 *   1. rót vốn là CHUYỂN, không phải mint — tổng cung không đổi (A3.4, E1);
 *   2. thiếu MỘT trong hai bút toán đối ứng thì audit ĐỎ (bất biến E) — đây là
 *      chỗ tiêm lỗi ngược;
 *   3. sổ append-only, quỹ không âm, khoá theo bậc 5 → 6.
 */
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { auditSupply } from '../server/audit.js';
import { treasuryAppend, TREASURY_LOCK_KEY } from '../server/treasury.js';
import {
  QUY_CHO_LOCK_KEY, QuyChoError, napQuyChoTuKhoBac, quyChoAppend, soDuQuyCho,
} from '../server/kinh_te/quy_cho.js';
import { startTestDb } from './helpers/testdb.js';

describe('B5 — quỹ chợ', () => {
  let db: Awaited<ReturnType<typeof startTestDb>>;

  beforeAll(async () => {
    db = await startTestDb();
    // Kho bạc cần vốn để rót: một bút toán genesis như D10 làm.
    const c = await db.pool.connect();
    try {
      await c.query('BEGIN');
      await treasuryAppend(c, 20_000n, 'genesis_grant');
      await c.query('COMMIT');
    } finally { c.release(); }
  }, 120_000);

  afterAll(async () => { await db?.stop(); });

  it('sổ mới tạo: số dư 0 — cửa mua vào ĐÓNG, không phải một số tạm', async () => {
    expect(await soDuQuyCho(db.pool)).toBe(0n);
  });

  it('khoá quỹ chợ khác khoá Kho bạc, và đứng SAU nó (bậc 6 > 5)', () => {
    expect(QUY_CHO_LOCK_KEY).not.toBe(TREASURY_LOCK_KEY);
    expect(QUY_CHO_LOCK_KEY).toBeGreaterThan(TREASURY_LOCK_KEY);
  });

  it('⭐ rót vốn là CHUYỂN: Kho bạc −x, quỹ +x, và audit:supply CÂN', async () => {
    const truoc = await auditSupply(db.pool);
    expect(truoc.ok, truoc.problems.join(' | ')).toBe(true);

    const c = await db.pool.connect();
    try {
      await c.query('BEGIN');
      const kq = await napQuyChoTuKhoBac(c, 3_000n);
      await c.query('COMMIT');
      expect(kq.khoBacSau).toBe(17_000n);
      expect(kq.quyChoSau).toBe(3_000n);
    } finally { c.release(); }

    const sau = await auditSupply(db.pool);
    expect(sau.ok, sau.problems.join(' | ')).toBe(true);
    expect(sau.numbers['Quỹ chợ (B5)']).toBe('3000');
  });

  it('⭐ TIÊM LỖI NGƯỢC: ghi một đầu mà quên đầu kia ⇒ bất biến E đỏ, nói rõ số', async () => {
    // Giả một lỗi code: ghi quỹ chợ "nạp" mà không trừ Kho bạc — tức mint đội lốt chuyển.
    const c = await db.pool.connect();
    try {
      await c.query('BEGIN');
      await quyChoAppend(c, 500n, 'nap_tu_kho_bac');
      await c.query('COMMIT');
    } finally { c.release(); }
    const a = await auditSupply(db.pool);
    expect(a.ok).toBe(false);
    expect(a.problems.some((p) => p.startsWith('Bất biến E'))).toBe(true);
    expect(a.problems.some((p) => p.startsWith('Bất biến A'))).toBe(true);
    // Sổ append-only nên KHÔNG dọn được bút toán giả — cân lại bằng vế đối ứng.
    const c2 = await db.pool.connect();
    try {
      await c2.query('BEGIN');
      await treasuryAppend(c2, -500n, 'quy_cho_out');
      await c2.query('COMMIT');
    } finally { c2.release(); }
    const b = await auditSupply(db.pool);
    expect(b.ok, b.problems.join(' | ')).toBe(true);
  });

  it('chi vượt quỹ ⇒ lỗi RÕ trước khi DB nổ, và không ghi gì', async () => {
    const c = await db.pool.connect();
    try {
      await c.query('BEGIN');
      await expect(quyChoAppend(c, -999_999n, 'mua_vao')).rejects.toThrow(QuyChoError);
      await c.query('ROLLBACK');
    } finally { c.release(); }
    expect(await soDuQuyCho(db.pool)).toBe(3_500n);
  });

  it('Kho bạc không đủ ⇒ rót thất bại TRƯỚC khi quỹ chợ ghi gì', async () => {
    const c = await db.pool.connect();
    try {
      await c.query('BEGIN');
      await expect(napQuyChoTuKhoBac(c, 1_000_000n)).rejects.toThrow(/Kho bạc không đủ/);
      await c.query('ROLLBACK');
    } finally { c.release(); }
    expect(await soDuQuyCho(db.pool)).toBe(3_500n);
  });

  it('sổ là append-only: UPDATE/DELETE bị trigger chặn', async () => {
    await expect(db.pool.query('UPDATE quy_cho_ledger SET delta = 1 WHERE entry_id = 1')).rejects.toThrow(/append-only/);
    await expect(db.pool.query('DELETE FROM quy_cho_ledger WHERE entry_id = 1')).rejects.toThrow(/append-only/);
  });

  it('từ chối bút toán 0 và số nạp không dương', async () => {
    const c = await db.pool.connect();
    try {
      await expect(quyChoAppend(c, 0n, 'phi_in')).rejects.toThrow(QuyChoError);
      await expect(napQuyChoTuKhoBac(c, 0n)).rejects.toThrow(QuyChoError);
      await expect(napQuyChoTuKhoBac(c, -1n)).rejects.toThrow(QuyChoError);
    } finally { c.release(); }
  });
});
