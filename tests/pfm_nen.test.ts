/**
 * PFM — LỚP NỀN (migration 0047 + sổ đăng ký đặc trưng). D186.
 *
 * Đồ thật: PostgreSQL nhúng, không mock. Bốn nhóm bất biến, xếp theo ĐỘ ĐẮT KHI HỎNG:
 *
 *   §I  TƯỜNG LỬA BA CHIỀU (P4 🔒) — token PFM không có đường sang T/Q, ở tầng DB.
 *   §II VÍ PHẢI KHỚP SỔ (A3.10) + append-only CÓ ĐÚNG MỘT CỬA THOÁT (P9 🔒).
 *   §III CỬA MỘT CHIỀU (P2 🔒) — không bảng nào của PFM chở số tiền/chữ tự do được.
 *   §IV SỔ ĐĂNG KÝ — registry-driven, và LUẬT P19 "mỗi mã kèm một dòng vì-sao".
 *
 * ⚠ §IV đọc CHÍNH FILE NGUỒN. Nghe lạ, nhưng luật P19 của founder là luật về CÁCH
 * VIẾT, mà cách viết thì chỉ kiểm được bằng cách đọc chữ. Không có bài này thì "mỗi
 * mã phải trả lời được vì sao" là một câu trong doc, và câu trong doc thì trôi.
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { startTestDb, type TestDb } from './helpers/testdb.js';
import { createTestUser } from './helpers/fixtures.js';
import { SO_DANG_KY, SCHEMA_VERSION, laMaHopLe, kiemGiaTri, type MaDacTrung } from '../config/pfm_dac_trung.js';
import { PFM, PFM_LO } from '../config/pfm.js';
import { BACKUP_TABLES, BANG_PHU_DU } from '../server/backup.js';
import { K5_WHITELIST, laActionTypePfmHopLe, kiemValueJsonPfm } from '../config/pfm_events.js';
import { CUA_PFM, CUA_PFM_COT } from '../config/pfm_consent.js';

const GOC = path.dirname(fileURLToPath(import.meta.url));

let db: TestDb;
beforeAll(async () => { db = await startTestDb(); }, 180_000);
afterAll(async () => { await db?.stop(); });

const BANG_PFM = ['pfm_luu', 'pfm_ngay', 'pfm_tuan', 'pfm_token_ledger',
  'pfm_cup', 'pfm_dac_trung',
  // D251 — bộ nhớ chống trùng của POST /pfm/dong-bo (0056). Thêm vào đây là BẮT BUỘC:
  // bài 'mọi bảng PFM có RLS bật' quét pg_tables theo tiền tố 'pfm_%' và so số
  // lượng, nên danh sách này là thứ giữ cho một bảng mới không lặng lẽ ra đời
  // thiếu RLS hoặc thiếu chân trong xoaSachPfm (P9).
  'pfm_lo_da_nhan'] as const;

describe('§I — tường lửa ba chiều T ↔ Q ↔ token-PFM (P4 🔒)', () => {
  it('bảy bảng/cột PFM tồn tại đúng tên', async () => {
    for (const b of BANG_PFM) {
      const r = await db.pool.query(
        `SELECT 1 FROM information_schema.tables WHERE table_name = $1`, [b]);
      expect(r.rowCount, `thiếu bảng ${b}`).toBe(1);
    }
    // Bốn cột cửa (0061) đọc tên từ `CUA_PFM_COT` — đổi tên ở config mà quên migration
    // thì bài này đỏ, đúng chiều một-nguồn (D61).
    const cotCua = CUA_PFM.map((cua) => CUA_PFM_COT[cua]);
    const c = await db.pool.query(
      `SELECT column_name, data_type, column_default FROM information_schema.columns
        WHERE table_name = 'users'
          AND column_name = ANY($1::text[])`,
      [['pfm_consent', 'pfm_bat_dau', 'pfm_token', 'mui_gio', ...cotCua]]);
    expect(c.rowCount).toBe(4 + cotCua.length);
    for (const cot of cotCua) {
      const h = c.rows.find((r) => r.column_name === cot);
      expect(h?.data_type, `${cot} phải là boolean`).toBe('boolean');
      expect(h?.column_default, `${cot} phải mặc định FALSE — cửa mới sinh là cửa đóng`).toBe('false');
    }
    // BIGINT, không phải INT — cho khớp bankroll/quest_points (bẫy "Cannot mix BigInt").
    const tok = c.rows.find((r) => r.column_name === 'pfm_token');
    expect(tok?.data_type).toBe('bigint');
  });

  it('KHÔNG có khoá ngoại hay cột nào nối token PFM với ví T / điểm Q', async () => {
    const r = await db.pool.query(
      `SELECT c.column_name, t.table_name FROM information_schema.columns c
         JOIN information_schema.tables t ON t.table_name = c.table_name
        WHERE c.table_name LIKE 'pfm_%'
          AND (c.column_name ILIKE '%bankroll%' OR c.column_name ILIKE '%quest%'
               OR c.column_name = 'delta_t' OR c.column_name ILIKE '%treasury%')`);
    expect(r.rowCount, `cột bắc cầu sang T/Q: ${JSON.stringify(r.rows)}`).toBe(0);
  });

  it('mã nguồn: không file nào chuyển đổi giữa ba ví', () => {
    // Quét NGUỒN, không quét kết quả — một phép quy đổi viết ra là hỏng vĩnh viễn
    // (P4 🔒 nói "không đường quy đổi nào, ở schema LẪN code").
    const doc = (p: string) => fs.readFileSync(path.join(GOC, '..', p), 'utf8');
    for (const f of ['config/pfm.ts', 'config/pfm_dac_trung.ts']) {
      const s = doc(f).replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '');
      expect(s, `${f} nhắc bankroll/quest ngoài chú thích`).not.toMatch(/bankroll|quest_points/);
    }
  });
});

describe('§II — ví khớp sổ + append-only có đúng một cửa thoát', () => {
  it('đổi pfm_token mà không có dòng sổ ⇒ DB gào', async () => {
    const u = await createTestUser(db.pool);
    await expect(db.pool.query(
      `UPDATE users SET pfm_token = 5 WHERE user_id = $1`, [u.userId]),
    ).rejects.toThrow(/pfm_token đổi mà không có dòng/);
  });

  it('ghi sổ rồi đổi ví KHỚP số ⇒ qua; LỆCH số ⇒ chặn', async () => {
    const u = await createTestUser(db.pool);
    const c = await db.pool.connect();
    try {
      await c.query('BEGIN');
      await c.query(
        `INSERT INTO pfm_token_ledger (user_id, delta, balance_after, reason)
         VALUES ($1, 7, 7, 'moc_su_kien')`, [u.userId]);
      await c.query(`UPDATE users SET pfm_token = 7 WHERE user_id = $1`, [u.userId]);
      await c.query('COMMIT');
    } finally { c.release(); }
    const r = await db.pool.query(`SELECT pfm_token FROM users WHERE user_id = $1`, [u.userId]);
    expect(String(r.rows[0].pfm_token)).toBe('7');

    // Lệch: ví nói 99 trong khi sổ dừng ở 7.
    await expect(db.pool.query(
      `UPDATE users SET pfm_token = 99 WHERE user_id = $1`, [u.userId]),
    ).rejects.toThrow(/lệch dòng cuối/);
  });

  it('UPDATE sổ cái bị cấm TUYỆT ĐỐI — kể cả khi đã đặt cờ xoá', async () => {
    const u = await createTestUser(db.pool);
    await db.pool.query(
      `INSERT INTO pfm_token_ledger (user_id, delta, balance_after, reason)
       VALUES ($1, 3, 3, 'moc_su_kien')`, [u.userId]);
    const c = await db.pool.connect();
    try {
      await c.query('BEGIN');
      await c.query(`SELECT set_config('delphi.xoa_pfm', '1', true)`);
      await expect(
        c.query(`UPDATE pfm_token_ledger SET delta = 99 WHERE user_id = $1`, [u.userId]),
      ).rejects.toThrow(/append-only/);
      await c.query('ROLLBACK');
    } finally { c.release(); }
  });

  it('DELETE bị cấm khi KHÔNG có cờ, và CHO PHÉP khi có cờ (quyền xoá P9 🔒)', async () => {
    const u = await createTestUser(db.pool);
    await db.pool.query(
      `INSERT INTO pfm_token_ledger (user_id, delta, balance_after, reason)
       VALUES ($1, 3, 3, 'moc_su_kien')`, [u.userId]);

    await expect(db.pool.query(
      `DELETE FROM pfm_token_ledger WHERE user_id = $1`, [u.userId]),
    ).rejects.toThrow(/append-only/);

    const c = await db.pool.connect();
    try {
      await c.query('BEGIN');
      await c.query(`SELECT set_config('delphi.xoa_pfm', '1', true)`);
      const d = await c.query(`DELETE FROM pfm_token_ledger WHERE user_id = $1`, [u.userId]);
      expect(d.rowCount).toBe(1);
      await c.query('COMMIT');
    } finally { c.release(); }
  });

  it('cờ xoá là CỤC BỘ TRANSACTION — không rò sang kết nối/transaction khác', async () => {
    // Nếu cờ rò ra ngoài thì "cửa thoát tường minh" thành cửa mở toang.
    const u = await createTestUser(db.pool);
    await db.pool.query(
      `INSERT INTO pfm_token_ledger (user_id, delta, balance_after, reason)
       VALUES ($1, 1, 1, 'moc_su_kien')`, [u.userId]);
    const c = await db.pool.connect();
    try {
      await c.query('BEGIN');
      await c.query(`SELECT set_config('delphi.xoa_pfm', '1', true)`);
      await c.query('COMMIT');           // cờ `is_local` ⇒ hết hiệu lực khi commit
      await expect(
        c.query(`DELETE FROM pfm_token_ledger WHERE user_id = $1`, [u.userId]),
      ).rejects.toThrow(/append-only/);
    } finally { c.release(); }
  });
});

describe('§III — cửa một chiều: không ngăn nào của PFM chở tiền hay chữ tự do', () => {
  it('không bảng pfm_* nào có cột kiểu tiền tệ hay tên gợi số tiền', async () => {
    /*
     * ⚠ THƯỚC NÀY ĐÃ BÁO ĐỘNG GIẢ MỘT LẦN, ghi lại để không ai nới nó cho qua:
     * mẫu đầu có `gia_` và nó bắt nhầm `pfm_dac_trung.gia_tri` — "giá TRỊ", không
     * phải "giá TIỀN". Một bài đỏ vì lý do sai thì sẽ bị tắt đi (D79), nên phải sửa
     * THƯỚC cho đúng chứ không thêm ngoại lệ.
     */
    /*
     * ⚠ VÀ MỘT LẦN THỨ HAI: `pfm_token_ledger.balance_after` cũng bị bắt nhầm. Nó là
     * số dư TOKEN PFM — đồng tiền ảo thứ ba, mà A3.10 BẮT BUỘC phải có sổ cái với cột
     * số-dư-sau. Nó sống ở server đúng theo thiết kế (K4). Thứ bài này canh là TIỀN
     * THẬT CỦA USER (đồng VND trong sổ) — nên sổ cái token đứng ngoài phạm vi, có tên
     * và có lý do, chứ không phải một ngoại lệ nhét vào cho test xanh.
     */
    const r = await db.pool.query(
      `SELECT table_name, column_name, data_type FROM information_schema.columns
        WHERE table_name LIKE 'pfm_%'
          AND table_name <> 'pfm_token_ledger'
          AND (data_type IN ('money','numeric','double precision','real')
               OR column_name ~ '(so_tien|amount|tien_|_tien|gia_tien|don_gia|_vnd|balance)')`);
    expect(r.rowCount,
      `PFM không được chở tiền thật của user: ${JSON.stringify(r.rows)}`).toBe(0);
  });

  it('sổ cái token chở đúng TOKEN (số nguyên), không phải tiền tệ', async () => {
    const r = await db.pool.query(
      `SELECT column_name, data_type FROM information_schema.columns
        WHERE table_name = 'pfm_token_ledger'`);
    const kieu = Object.fromEntries(r.rows.map((x) => [x.column_name, x.data_type]));
    expect(kieu.delta).toBe('integer');
    expect(kieu.balance_after).toBe('bigint');
    // Không cột nào kiểu thập phân — token là số nguyên (C5 áp cho mọi ví).
    for (const [c, k] of Object.entries(kieu)) {
      expect(['money','numeric','double precision','real'], `${c} kiểu ${k}`).not.toContain(k);
    }
  });

  it('⭐ và cột JSONB `gia_tri` KHÔNG THỂ chở số tiền — chặn bằng sổ đăng ký, không bằng tên cột', () => {
    /*
     * Đây mới là bất biến thật. Tên cột chỉ là bề mặt; thứ quyết định là MIỀN mà sổ
     * đăng ký cho phép. Không kiểu nào của registry chở được một số tiền tuyệt đối:
     * nhãn (miền đóng) · tỷ lệ [0,1] hoặc [-1,1] · đếm có trần · phân bố khoá-đóng.
     */
    for (const [ma, d] of Object.entries(SO_DANG_KY)) {
      expect(['nhan', 'ty_le', 'dem', 'phan_bo'], `${ma}: kiểu lạ`).toContain(d.kieu);
      if (d.kieu === 'dem') {
        expect(d.max, `${ma}: đếm phải có trần (không trần là cửa cho số tiền)`)
          .toBeLessThanOrEqual(999);
      }
    }
    // Và một số tiền thật bị từ chối ở mọi kiểu:
    expect(kiemGiaTri('hv_chi_bu', 500_000)).toMatch(/ngoài/);
    expect(kiemGiaTri('hv_ngay_co_mat', 500_000)).toMatch(/ngoài/);
    expect(kiemGiaTri('y_loai', '500000')).toMatch(/ngoài miền/);
  });

  it('két chặn blob quá trần 32 KB ở tầng DB', async () => {
    const u = await createTestUser(db.pool);
    const to = Buffer.alloc(PFM.BLOB_MAX + 1, 7);
    await expect(db.pool.query(
      `INSERT INTO pfm_luu (user_id, thang, the_he, blob, schema_v)
       VALUES ($1, '2026-08-01', 1, $2, 1)`, [u.userId, to]),
    ).rejects.toThrow();

    const vua = Buffer.alloc(PFM.BLOB_MAX, 7);
    const ok = await db.pool.query(
      `INSERT INTO pfm_luu (user_id, thang, the_he, blob, schema_v)
       VALUES ($1, '2026-08-01', 1, $2, 1) RETURNING ver`, [u.userId, vua]);
    expect(ok.rows[0].ver).toBe(1);
  });

  it('điểm danh chỉ nhận đúng BỐN trạng thái (D140 — không được gộp)', async () => {
    const u = await createTestUser(db.pool);
    for (const [i, tt] of ['tron', 'khong_tieu', 'tieu_it', 'co_ghi'].entries()) {
      await db.pool.query(
        `INSERT INTO pfm_ngay (user_id, ngay, trang_thai)
         VALUES ($1, DATE '2026-08-01' + $2::int, $3)`, [u.userId, i, tt]);
    }
    await expect(db.pool.query(
      `INSERT INTO pfm_ngay (user_id, ngay, trang_thai)
       VALUES ($1, '2026-09-09', 'khong_tieu_gi_ca')`, [u.userId]),
    ).rejects.toThrow();
  });

  it('events nhận đủ bảy loại pfm_* và vẫn từ chối loại bịa', async () => {
    const r = await db.pool.query(
      `SELECT pg_get_constraintdef(oid) AS d FROM pg_constraint
        WHERE conname = 'events_action_type_check'`);
    const d = r.rows[0].d as string;
    for (const a of ['pfm_bat', 'pfm_tat', 'pfm_consent', 'pfm_diem_danh',
      'pfm_hu', 'pfm_luat', 'pfm_tuan_niem_phong']) {
      expect(d, `action_type thiếu ${a}`).toContain(a);
    }
    expect(d).not.toContain('pfm_bia_dat');
  });

  it('mọi bảng PFM có RLS bật', async () => {
    const r = await db.pool.query(
      `SELECT tablename, rowsecurity FROM pg_tables WHERE tablename LIKE 'pfm_%'`);
    expect(r.rowCount).toBe(BANG_PFM.length);
    for (const row of r.rows) expect(row.rowsecurity, `${row.tablename} chưa bật RLS`).toBe(true);
  });
});

describe('§IV — sổ đăng ký đặc trưng (registry-driven + luật P19)', () => {
  it('mọi mã có đủ bốn lớp C→I→B→O và lớp intervention', () => {
    const lop = new Set(Object.values(SO_DANG_KY).map((d) => d.lop));
    for (const l of ['context', 'intent', 'behavior', 'outcome', 'intervention']) {
      expect(lop.has(l as never), `thiếu hẳn lớp ${l}`).toBe(true);
    }
  });

  it('⭐ P19: MỖI mã kèm một dòng "// vì sao:" — không trả lời được thì không thêm', () => {
    const src = fs.readFileSync(path.join(GOC, '../config/pfm_dac_trung.ts'), 'utf8');
    const thieu: string[] = [];
    for (const ma of Object.keys(SO_DANG_KY)) {
      // Lấy đoạn từ khai báo mã tới mã kế tiếp, đòi trong đó có "vì sao:".
      const i = src.indexOf(`\n  ${ma}: `);
      expect(i, `không thấy khai báo ${ma}`).toBeGreaterThan(0);
      /*
       * ⚠ PHÉP RỖNG ĐÃ DÍNH Ở ĐÂY — tiêm lỗi mới lộ. Bản đầu tìm "khối kế tiếp" trên
       * chuỗi BẮT ĐẦU bằng chính khai báo đang xét, nên regex khớp ngay vị trí 0 ⇒
       * điều kiện > 0 sai ⇒ đoạn cắt ra ôm trọn cả các mã SAU nó (và "vì sao" của
       * chúng) ⇒ bài XANH kể cả khi mã này không có dòng vì-sao nào. Phải bỏ qua ký
       * tự đầu rồi mới tìm.
       */
      const sau = src.slice(i, i + 2000);
      const kt = sau.slice(1).search(/\n  [a-z_0-9]+: |\n\} as const/);
      const doan = kt > 0 ? sau.slice(0, kt + 1) : sau;
      if (!/\/\/ vì sao:/.test(doan)) thieu.push(ma);
    }
    expect(thieu, `mã thiếu dòng "// vì sao:" (P19): ${thieu.join(', ')}`).toEqual([]);
  });

  it('bốn nhãn KHÔNG-SỬA-ĐƯỢC-SAU phải có mặt từ commit đầu', () => {
    // Thiếu bất kỳ cái nào là mất dữ liệu VĨNH VIỄN, không phải "thêm sau cũng được":
    for (const ma of ['kq_bo_giua_chung', 'hv_tam_dung_hu', 'iv_duoc_chon', 'iv_bo_qua']) {
      expect(laMaHopLe(ma), `thiếu nhãn một-chiều ${ma}`).toBe(true);
    }
    // Và abandonment phải TÁCH khỏi "đạt tới đâu" — hai câu hỏi khác nhau.
    expect(SO_DANG_KY.kq_bo_giua_chung.lop).toBe('outcome');
    expect(SO_DANG_KY.kq_dat_muc_tieu.lop).toBe('outcome');
    expect(SO_DANG_KY.kq_bo_giua_chung).not.toEqual(SO_DANG_KY.kq_dat_muc_tieu);
  });

  it('phễu can thiệp đủ NĂM nấc tách bạch (founder D173: eligible ≠ assigned ≠ exposed)', () => {
    const nac = Object.entries(SO_DANG_KY)
      .filter(([, d]) => d.lop === 'intervention').map(([m]) => m);
    expect(nac.sort()).toEqual(
      ['iv_bo_qua', 'iv_du_dieu_kien', 'iv_duoc_chon', 'iv_phoi_nhiem', 'iv_tuong_tac']);
  });

  it('validate registry-driven: mã lạ bị từ chối, giá trị ngoài miền bị từ chối', () => {
    expect(laMaHopLe('ma_bia_dat')).toBe(false);
    expect(kiemGiaTri('y_han', 'ngan')).toBeNull();
    expect(kiemGiaTri('y_han', 'sieu_dai')).toMatch(/ngoài miền/);
    expect(kiemGiaTri('hv_ngay_co_mat', 12)).toBeNull();
    expect(kiemGiaTri('hv_ngay_co_mat', 99)).toMatch(/ngoài \[0,31\]/);
    expect(kiemGiaTri('hv_chi_bu', 0.42)).toBeNull();
    expect(kiemGiaTri('hv_chi_bu', -0.1)).toMatch(/ngoài \[0,1\]/);
    // Tỷ lệ ÂM hợp lệ ở đúng chỗ nó có nghĩa (đoán thiếu ≠ đoán thừa).
    expect(kiemGiaTri('hv_doan_lech', -0.3)).toBeNull();
    expect(kiemGiaTri('hv_cach_ghi', { tay: 0.5, dan_sms: 0.5 })).toBeNull();
    expect(kiemGiaTri('hv_cach_ghi', { tay: 0.5, bia_dat: 0.5 })).toMatch(/ngoài miền/);
  });

  it('bảng nhận đúng đặc trưng hợp lệ và chặn lớp bịa', async () => {
    const u = await createTestUser(db.pool);
    await db.pool.query(
      `INSERT INTO pfm_dac_trung (user_id, ky, lop, ma, gia_tri, schema_version)
       VALUES ($1, '2026-08-01', 'behavior', 'hv_ngay_co_mat', '12'::jsonb, $2)`,
      [u.userId, SCHEMA_VERSION]);
    await expect(db.pool.query(
      `INSERT INTO pfm_dac_trung (user_id, ky, lop, ma, gia_tri, schema_version)
       VALUES ($1, '2026-08-01', 'lop_bia', 'x', '1'::jsonb, 1)`, [u.userId]),
    ).rejects.toThrow();
  });
});

describe('§V — backup: két RA, năm bảng kia VÀO (K12)', () => {
  it('pfm_luu nằm trong BANG_PHU_DU, không nằm trong BACKUP_TABLES', () => {
    expect(BANG_PHU_DU as readonly string[]).toContain('pfm_luu');
    expect(BACKUP_TABLES as readonly string[]).not.toContain('pfm_luu');
  });
  it('năm bảng PFM còn lại được sao lưu (không dựng lại được nếu mất)', () => {
    for (const b of ['pfm_ngay', 'pfm_tuan', 'pfm_token_ledger', 'pfm_cup', 'pfm_dac_trung']) {
      expect(BACKUP_TABLES as readonly string[], `${b} phải được sao lưu`).toContain(b);
    }
  });
});

describe('§VI — hằng số: số nào là PLAYTEST-TUNE thì phải nói ra', () => {
  it('trần lô PFM chặt hơn hàng đợi telemetry (events không được phép mất dòng)', () => {
    expect(PFM_LO.SU_KIEN_MOI_LO).toBeLessThanOrEqual(50);
    expect(PFM_LO.THAN_TOI_DA).toBeLessThanOrEqual(64 * 1024);
  });
  it('trần blob khớp giữa config và CHECK ở DB', async () => {
    const r = await db.pool.query(
      `SELECT pg_get_constraintdef(oid) AS d FROM pg_constraint
        WHERE conrelid = 'pfm_luu'::regclass AND contype = 'c'
          AND pg_get_constraintdef(oid) LIKE '%octet_length%'`);
    expect(r.rows[0].d).toContain(String(PFM.BLOB_MAX));
  });
});

describe('§VII — K5 🔒: danh sách trắng value_json cho events.action_type họ pfm_*', () => {
  it('K5_WHITELIST có ĐỦ VÀ ĐÚNG bảy khoá khớp CHECK constraint ở DB', async () => {
    const r = await db.pool.query(
      `SELECT pg_get_constraintdef(oid) AS d FROM pg_constraint
        WHERE conname = 'events_action_type_check'`);
    const d = r.rows[0].d as string;
    const khoaWhitelist = Object.keys(K5_WHITELIST).sort();
    expect(khoaWhitelist).toEqual([
      'pfm_bat', 'pfm_consent', 'pfm_diem_danh', 'pfm_hu',
      'pfm_luat', 'pfm_tat', 'pfm_tuan_niem_phong',
    ]);
    for (const k of khoaWhitelist) expect(d, `CHECK thiếu ${k}`).toContain(k);
  });

  it('laActionTypePfmHopLe: đúng bảy loại, từ chối loại bịa', () => {
    for (const k of Object.keys(K5_WHITELIST)) expect(laActionTypePfmHopLe(k)).toBe(true);
    expect(laActionTypePfmHopLe('pfm_bia_dat')).toBe(false);
    expect(laActionTypePfmHopLe('pfm_diem_danh_v2')).toBe(false);
  });

  it('kiemValueJsonPfm: action_type lạ ⇒ từ chối, không xét tới field', () => {
    expect(kiemValueJsonPfm('pfm_bia_dat', {})).toMatch(/lạ/);
  });

  it('kiemValueJsonPfm: đúng field trong whitelist ⇒ null (hợp lệ)', () => {
    expect(kiemValueJsonPfm('pfm_bat', {})).toBeNull();
    expect(kiemValueJsonPfm('pfm_diem_danh', { trang_thai: 'co_ghi' })).toBeNull();
    expect(kiemValueJsonPfm('pfm_luat', { luat_id: 'x', mau_id: 'y', hanh_dong: 'giu' })).toBeNull();
    expect(kiemValueJsonPfm('pfm_tuan_niem_phong', { tuan: '2026-08-24', moc_ids: ['a'] })).toBeNull();
  });

  it('⭐ kiemValueJsonPfm: MỘT field lạ trong value_json ⇒ đỏ ngay, kể cả kèm field hợp lệ', () => {
    // Đây là bài chặn cụ thể K5 🔒: field lạ không được lọt qua chỉ vì đứng cạnh
    // field hợp lệ. Thử đúng loại field mà K5 cấm tuyệt đối — số tiền và chữ tự do.
    expect(kiemValueJsonPfm('pfm_diem_danh', { trang_thai: 'co_ghi', so_tien: 500_000 }))
      .toMatch(/ngoài whitelist/);
    expect(kiemValueJsonPfm('pfm_luat', { luat_id: 'x', mau_id: 'y', hanh_dong: 'giu', ghi_chu: 'text tự do' }))
      .toMatch(/ngoài whitelist/);
    expect(kiemValueJsonPfm('pfm_bat', { ly_do: 'test' })).toMatch(/ngoài whitelist/);
  });

  it('⭐⭐ R9 — THIẾU field bắt buộc ⇒ đỏ. `events` không xoá được, nên dòng rỗng ruột còn tệ hơn dòng vắng mặt', () => {
    /*
     * Bản trước chỉ chặn field LẠ, nên `{}` đi lọt: một dòng nói "có chuyện gì đó xảy
     * ra với một cái hũ nào đó" — vô dụng, và KHÔNG XOÁ ĐƯỢC (A3.3). Ở bảng append-only
     * thì dòng thiếu ruột chiếm chỗ và trông như dữ liệu.
     */
    expect(kiemValueJsonPfm('pfm_hu', {})).toMatch(/thiếu field bắt buộc/);
    expect(kiemValueJsonPfm('pfm_hu', { hu_id: 'h1' })).toMatch(/thiếu field bắt buộc "ma"/);
    expect(kiemValueJsonPfm('pfm_diem_danh', {})).toMatch(/thiếu field bắt buộc "trang_thai"/);
    expect(kiemValueJsonPfm('pfm_tuan_niem_phong', { tuan: '2026-08-24' }))
      .toMatch(/thiếu field bắt buộc "moc_ids"/);
    // `pfm_bat` KHÔNG mang gì thì `{}` vẫn là đúng.
    expect(kiemValueJsonPfm('pfm_bat', {})).toBeNull();
    /*
     * D295 — `pfm_tat` phải nói TẮT CỬA NÀO. Bản D250 là `{}` (một công tắc); nới thành
     * bốn cửa thì một vết rút-lại không tên cửa là vết vô nghĩa — và không xoá được.
     */
    expect(kiemValueJsonPfm('pfm_tat', {})).toMatch(/thiếu field bắt buộc "cua"/);
    for (const cua of CUA_PFM) expect(kiemValueJsonPfm('pfm_tat', { cua })).toBeNull();
    expect(kiemValueJsonPfm('pfm_tat', { cua: 'la' })).toMatch(/phải là một trong/);
    expect(kiemValueJsonPfm('pfm_tat', { cua: 'ket', ly_do: 'x' })).toMatch(/ngoài whitelist/);
  });

  it('⭐⭐ R9 — GIÁ TRỊ sai hình ⇒ đỏ, không chỉ tên field đúng là xong', () => {
    // enum ngoài miền
    expect(kiemValueJsonPfm('pfm_diem_danh', { trang_thai: 'bia_dat' })).toMatch(/phải là một trong/);
    expect(kiemValueJsonPfm('pfm_hu', { hu_id: 'h1', ma: 'bay_len' })).toMatch(/phải là một trong/);
    expect(kiemValueJsonPfm('pfm_luat', { luat_id: 'l', mau_id: '', hanh_dong: 'bat' }))
      .toMatch(/phải là một trong/);   // 'bat' cố ý KHÔNG nằm trong enum luật
    // id sai hình: ký tự lạ, quá dài, hoặc không phải chuỗi
    expect(kiemValueJsonPfm('pfm_hu', { hu_id: 'a b', ma: 'tao' })).toMatch(/id khớp/);
    expect(kiemValueJsonPfm('pfm_hu', { hu_id: 'x'.repeat(41), ma: 'tao' })).toMatch(/id khớp/);
    expect(kiemValueJsonPfm('pfm_hu', { hu_id: 123, ma: 'tao' })).toMatch(/id khớp/);
    // ngày sai dạng
    expect(kiemValueJsonPfm('pfm_tuan_niem_phong', { tuan: '24/08/2026', moc_ids: [] }))
      .toMatch(/YYYY-MM-DD/);
    // mảng id: quá dài, hoặc phần tử hỏng
    expect(kiemValueJsonPfm('pfm_tuan_niem_phong',
      { tuan: '2026-08-24', moc_ids: Array.from({ length: 21 }, (_, i) => `m${i}`) }))
      .toMatch(/tối đa 20/);
    expect(kiemValueJsonPfm('pfm_tuan_niem_phong', { tuan: '2026-08-24', moc_ids: ['ok', 'có dấu'] }))
      .toMatch(/\[1\]/);
  });

  it('⭐ R9 — `mau_id` rỗng được PHÉP, và đó là quyết định có chủ đích chứ không phải lỗ hổng', () => {
    /*
     * `''` là dấu "không có mẫu", đã khoá bằng test ở web/tests/pfm_luat.test.ts.
     * Nó KHÔNG phạm luật "thiếu mẫu = null, không phải 0" (A11.2/D62): luật ấy nói về ô
     * SỐ, nơi 0 là giá trị thật nên lẫn được với "trống". `''` không bao giờ là id thật.
     * ⚠ Và cái rỗng ấy chỉ được phép ở ĐÚNG field này.
     */
    expect(kiemValueJsonPfm('pfm_luat', { luat_id: 'l1', mau_id: '', hanh_dong: 'dat' })).toBeNull();
    expect(kiemValueJsonPfm('pfm_hu', { hu_id: '', ma: 'tao' })).toMatch(/id khớp/);
  });

  it('kiemValueJsonPfm: value_json không phải object (mảng, chuỗi, số) ⇒ từ chối', () => {
    expect(kiemValueJsonPfm('pfm_bat', [])).toMatch(/phải là object/);
    expect(kiemValueJsonPfm('pfm_bat', 'x')).toMatch(/phải là object/);
    expect(kiemValueJsonPfm('pfm_bat', null)).toMatch(/phải là object/);
  });
});

describe('§VIII — P6-by-construction (GĐ2): máy trả thưởng KHÔNG CÓ GÌ để đọc nếu muốn thưởng theo tiền/tự khai', () => {
  // Quét NGUỒN, không quét hành vi — một dòng import/đọc viết ra là hỏng vĩnh viễn,
  // đúng lý lẽ tường lửa T/Q ở §I ("không đường quy đổi nào, ở schema LẪN code").
  const BANG_CAM = ['pfm_dac_trung', 'pfm_luu', 'tu_khai'];
  const FILE_DUONG_THUONG = ['server/pfm/ngay.ts', 'server/pfm/token.ts', 'server/pfm/tuan.ts'];

  it('⭐ ba file trên đường phán thưởng KHÔNG nhắc pfm_dac_trung / pfm_luu / tu_khai', () => {
    for (const f of FILE_DUONG_THUONG) {
      const raw = fs.readFileSync(path.join(GOC, '..', f), 'utf8');
      // Bỏ comment trước khi quét — cùng khuôn §I, tránh báo động giả vì một dòng
      // chú thích nhắc tên bảng cấm để GIẢI THÍCH vì sao nó bị cấm.
      const s = raw.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '');
      for (const cam of BANG_CAM) {
        expect(s, `${f} nhắc "${cam}" ngoài chú thích — đường phán thưởng phải mù với nó`)
          .not.toContain(cam);
      }
    }
  });

  it('ba file trên chỉ import từ ./ngay.js, ./token.js, ./tuan.js và config/pfm.js — không import chéo sang dac_trung', () => {
    for (const f of FILE_DUONG_THUONG) {
      const raw = fs.readFileSync(path.join(GOC, '..', f), 'utf8');
      const imports = [...raw.matchAll(/^import .* from '([^']+)';?$/gm)].map((m) => m[1]);
      for (const i of imports) {
        expect(i, `${f} import "${i}" — nghi có đường sang tầng đặc trưng`)
          .not.toMatch(/dac_trung|pfm_luu|\.\.\/ket\.js/);
      }
    }
  });
});

describe('§IX — migration 0061: bốn cửa, backfill CÓ CHỦ Ý, idempotent (D295)', () => {
  /*
   * Chạy lại ĐÚNG TỆP migration trên DB đã áp nó — `runMigrations` bỏ qua tệp đã ghi ở
   * `schema_migrations`, nên "chạy hai lần" qua runner không chứng minh được gì về chính
   * câu SQL. Ở đây SQL đi thẳng, và cả hai vế được đo: có backfill, và không backfill quá tay.
   */
  const SQL_0061 = fs.readFileSync(path.join(GOC, '../migrations/0061_pfm_bon_cua.sql'), 'utf8');
  const docCua = async (userId: string) => (await db.pool.query(
    `SELECT pfm_consent, ${CUA_PFM.map((c) => `${CUA_PFM_COT[c]} AS ${c}`).join(', ')}
       FROM users WHERE user_id = $1`, [userId])).rows[0];

  it('⭐⭐ KHÔNG suy diễn consent: cờ gộp cũ ⇒ bốn cửa vẫn ĐÓNG và chính cờ gộp tắt theo', async () => {
    /*
     * Vì sao không bật ba cửa "vì họ đã đồng ý bản gộp": vết duy nhất một hàng như thế có
     * là `pfm_consent{pfm_dong_bo, v1}`, mà chữ của bản ấy không còn trong repo. Cửa suy
     * diễn = cửa không tra ngược được, đúng thứ bốn cửa sinh ra để xoá.
     */
    const u = await createTestUser(db.pool);
    // Trạng thái CHỈ dữ liệu trước 0061 mới có: cờ gộp bật mà bốn cửa đều đóng.
    await db.pool.query(`UPDATE users SET pfm_consent = TRUE WHERE user_id = $1`, [u.userId]);
    const truoc = await db.pool.query(
      `SELECT pfm_bat_dau FROM users WHERE user_id = $1`, [u.userId]);
    await db.pool.query(SQL_0061);
    expect(await docCua(u.userId)).toMatchObject(
      { pfm_consent: false, ket: false, dac_trung: false, thuong: false, noi_game: false });
    // Mốc "lần đầu chạm PFM" là lịch sử, không phải một quyền — migration không xoá nó.
    const sau = await db.pool.query(
      `SELECT pfm_bat_dau FROM users WHERE user_id = $1`, [u.userId]);
    expect(sau.rows[0].pfm_bat_dau).toEqual(truoc.rows[0].pfm_bat_dau);
  });

  it('⭐ idempotent: chạy lần hai không đổi gì — kể cả với người đã tự tắt bớt cửa SAU 0061', async () => {
    const u = await createTestUser(db.pool);
    // Sau 0061: bật rồi tắt bớt — còn MỘT cửa mở nên cờ gộp vẫn TRUE, và migration không
    // được đụng vào ai đang ở trạng thái hợp lệ ấy (kể cả không tắt cờ gộp của họ).
    await db.pool.query(
      `UPDATE users SET pfm_consent = TRUE, ${CUA_PFM_COT.thuong} = TRUE WHERE user_id = $1`, [u.userId]);
    await db.pool.query(SQL_0061);
    expect(await docCua(u.userId)).toMatchObject(
      { pfm_consent: true, ket: false, dac_trung: false, thuong: true, noi_game: false });

    // Người chưa bật gì thì vẫn không bật gì.
    const v = await createTestUser(db.pool);
    await db.pool.query(SQL_0061);
    for (const cua of CUA_PFM) expect((await docCua(v.userId))[cua]).toBe(false);
    expect((await docCua(v.userId)).pfm_consent).toBe(false);
  });
});
