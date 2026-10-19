/**
 * D361 — XUẤT CHI TIẾT TỪNG NGƯỜI CỦA MỘT BÀN BUỔI ĐO (`scripts/xuat_buoi_do.ts`).
 *
 * ⚠⚠ BÀI NÀY CANH MỘT HÀNG RÀO RIÊNG TƯ, KHÔNG PHẢI MỘT TÍNH NĂNG. Lệnh xuất tồn tại vì founder cần đọc
 * dòng từng người để sửa app và viết báo cáo — và đúng vì thế nó phải **không bao giờ** xuất dòng của người
 * đã bấm văn bản `buoi_do` **v1**, bản hứa ngược lại (*"không có dòng nào nói về một người"*). Một lỗi ở
 * đây không làm test nào khác đỏ và không ai nhìn thấy: CSV vẫn ra, vẫn đẹp, chỉ là có thêm một người
 * không đồng ý điều đó.
 *
 * Ba lớp được canh, theo thứ tự quan trọng:
 *   §I  AI ĐƯỢC XUẤT — v2 vào · v1 ra · đã rút ra · rút-rồi-đồng-ý-lại VÀO (vết mới nhất thắng)
 *   §II KHÔNG CÓ CỘT DANH TÍNH — quét tên cột lẫn giá trị ô, không chỉ tên cột
 *   §III LỖI CÓ MÃ — bàn lạ · bàn không phải buổi đo · không ai v2 · chưa dựng hành vi
 *
 * ⚠ `ma_tham_gia` phải BẰNG ĐÚNG `maThamGia(match_id)` — nếu lệch thì bài giấy ghép vào nhầm người, và đó
 *   là lỗi tệ nhất có thể có ở đây: nó không báo gì, chỉ trộn hai người vào nhau trong bản báo cáo.
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import pg from 'pg';
import { startTestDb, type TestDb } from './helpers/testdb.js';
import { createTestUser, ensureGenesis, type TestUser } from './helpers/fixtures.js';
import { docDotThu, locPhanTich, lyDoLoai, LoiDotThu, oCsv } from '../server/dot_thu.js';
import { maThamGia } from '../server/holdem_api.js';
import { chamNangLucTran, type DongNangLuc } from '../server/holdem/nang_luc.js';
import { HOLDEM_BALANCE_VERSION, SEED_MAN_TAP_MOI_THOI } from '../config/holdem.js';
import { deCua } from '../config/holdem_de.js';
import { CONSENT_PHIEN_BAN } from '../config/pfm_consent.js';

/** Bản đồng ý HIỆN HÀNH (D392: v3) — đọc từ config, không gõ tay, để lần lên bản sau bài không trôi. */
const HIEN = CONSENT_PHIEN_BAN.buoi_do;

let db: TestDb;
let pool: pg.Pool;
const U: Record<string, TestUser> = {};
const M: Record<string, string> = {};

const BAN = 'bd001';
const BAN_NGAY = 'bd002';
const BAN_TRONG = 'bd003';
const BAN_CHUA = 'bd004';

async function taoBan(ma: string, chu: TestUser, loai: 'buoi_do' | 'ngay'): Promise<void> {
  await pool.query(
    `INSERT INTO holdem_ban (ma, seed, so_o, chu_user_id, loai, het_han, de_id, nhan, balance_version, ngay)
     VALUES ($1, 3485517718, 12, $2, $3, now() + interval '7 days', $4, $5, $6, $7)`,
    [ma, chu.userId, loai,
      loai === 'buoi_do' ? 'de-a' : null,
      loai === 'buoi_do' ? 'lop-thu' : null,
      loai === 'buoi_do' ? HOLDEM_BALANCE_VERSION : null,
      loai === 'ngay' ? '2026-09-20' : null]);
}

/** Ghi một vết đồng ý/rút — đúng hình `holdem_api.ts` ghi. */
async function vet(u: TestUser, ban: string, loai: 'dong_y' | 'rut', phienBan?: string): Promise<void> {
  await pool.query(
    `INSERT INTO events (user_id, context_type, context_id, action_type, value_json)
     VALUES ($1, 'holdem', $2, $3, $4)`,
    [u.userId, ban, loai === 'dong_y' ? 'hd_dong_y_buoi_do' : 'hd_rut_buoi_do',
      JSON.stringify(loai === 'dong_y'
        ? { ban_ma: ban, van_ban_id: 'buoi_do', phien_ban: phienBan } : { ban_ma: ban })]);
}

async function tran(u: TestUser, ban: string, o: {
  st: 'xong' | 'bo_dở'; hang?: number; soVong?: number; dung?: boolean;
}): Promise<string> {
  const { rows } = await pool.query(
    `INSERT INTO holdem_matches
       (owner_user_id, seed, status, vong_hien_tai, action_log, ghe_json, engine_version, balance_version,
        season_id, started_at, ended_at, so_o, che_do, ban_ma)
     VALUES ($1, 3485517718, $2, 6, '[]'::jsonb, '[]'::jsonb, 'e', $3, '2026Q3', now(), $4, 12, 'tu_do', $5)
     RETURNING match_id::text AS id`,
    [u.userId, o.st, HOLDEM_BALANCE_VERSION, o.st === 'xong' ? new Date() : null, ban]);
  const id = rows[0].id as string;
  if (o.hang !== undefined) {
    await pool.query(
      `INSERT INTO holdem_results (match_id, user_id, ghe_id, loai, bac_rank, hang, von_cuoi, vong_chay, danh_muc_json, created_at)
       VALUES ($1, $2, 'ban', 'nguoi', 'tom', $3, 10500, 6, '{}'::jsonb, now())`, [id, u.userId, o.hang]);
  }
  if (o.dung !== false) {
    await pool.query(`INSERT INTO hanh_vi_tran (match_id, so_dong, formula_version) VALUES ($1, $2, 1)`,
      [id, o.soVong ?? 0]);
    for (let v = 1; v <= (o.soVong ?? 0); v++) {
      /*
       * D404 — vòng 1 GỬI sổ (1.500 bp), vòng 2 trở đi RÚT SỚM mỗi vòng một lần ⇒ với trận 3 vòng:
       * max(tk_huy_so) = 1 nhưng TỔNG = 2 — đúng chỗ cột cũ đọc nhầm. `so_nhom` · `vai` · `so_o` có giá trị
       * để bậc thẻ và cột vai/cỡ bàn có gì mà so.
       */
      // `ms_quyet` NULL ở vòng máy chốt hộ (v === 3), có số ở vòng người bấm — đúng hình `trai.ts` ghi.
      await pool.query(
        `INSERT INTO hanh_vi_vong
           (user_id, match_id, vong, ts, lenh_json, pnl_bp, brier, mo_bang, o_su_kien, la_tin_gia,
            tu_dong, tien_mat_bp, so_ma, tran_xong, man_tap, nghi_may, formula_version,
            so_nhom, tiet_kiem_bp, tk_huy_so, vai, so_o, ms_quyet)
         VALUES ($1, $2, $3, now(), '[]'::jsonb, 10, 0.5, false, $4, false, $5, 4000, 2, $6, false, false, 1,
                 2, $7, $8, 'ca_nhan', 12, $9)`,
        [u.userId, id, v, v === 2, v === 3, o.st === 'xong', v === 1 ? 1500 : 0, v >= 2 ? 1 : 0,
          v === 3 ? null : 2000 + v * 500]);
    }
  }
  return id;
}

beforeAll(async () => {
  db = await startTestDb();
  pool = new pg.Pool({ connectionString: (db.pool as unknown as { options: { connectionString: string } }).options.connectionString, max: 5 });
  pool.on('error', () => {});
  await ensureGenesis(pool);

  for (const t of ['chu', 'v2a', 'v2b', 'v1', 'rut', 'lai', 'trong', 'chua']) {
    U[t] = await createTestUser(pool);
  }
  await taoBan(BAN, U.chu!, 'buoi_do');
  await taoBan(BAN_NGAY, U.chu!, 'ngay');
  await taoBan(BAN_TRONG, U.chu!, 'buoi_do');
  await taoBan(BAN_CHUA, U.chu!, 'buoi_do');

  await vet(U.v2a!, BAN, 'dong_y', HIEN);
  await vet(U.v2b!, BAN, 'dong_y', HIEN);
  await vet(U.v1!, BAN, 'dong_y', 'v1');          // ⚠ phải bị LOẠI
  await vet(U.rut!, BAN, 'dong_y', HIEN);
  await vet(U.rut!, BAN, 'rut');                   // ⚠ phải bị LOẠI
  await vet(U.lai!, BAN, 'dong_y', HIEN);
  await vet(U.lai!, BAN, 'rut');
  await vet(U.lai!, BAN, 'dong_y', HIEN);          // ⭐ vết MỚI NHẤT là đồng ý ⇒ VÀO

  M.v2a = await tran(U.v2a!, BAN, { st: 'xong', hang: 2, soVong: 3 });
  M.v2b = await tran(U.v2b!, BAN, { st: 'bo_dở', soVong: 1 });
  M.v1 = await tran(U.v1!, BAN, { st: 'xong', hang: 1, soVong: 3 });
  M.rut = await tran(U.rut!, BAN, { st: 'xong', hang: 3, soVong: 3 });
  M.lai = await tran(U.lai!, BAN, { st: 'xong', hang: 4, soVong: 2 });

  // Bàn chỉ có người bấm v1 ⇒ `khong_ai_v2`.
  await vet(U.trong!, BAN_TRONG, 'dong_y', 'v1');
  // Bàn có người v2 + trận, nhưng CHƯA dựng hành vi ⇒ `chua_dung_hanh_vi`.
  await vet(U.chua!, BAN_CHUA, 'dong_y', HIEN);
  await tran(U.chua!, BAN_CHUA, { st: 'xong', hang: 1, dung: false });

  // D392 — mã buổi đo (cột MÃ BUỔI ĐO của ba Google Form), cấp lúc đồng ý; ở đây đặt tay cho người có trận.
  for (const [t, ma] of [['v2a', 'mbd1'], ['v2b', 'mbd2'], ['lai', 'mbd3'], ['v1', 'mbd4'], ['rut', 'mbd5']] as const) {
    await pool.query(`UPDATE users SET ma_buoi_do = $2 WHERE user_id = $1`, [U[t]!.userId, ma]);
  }
  // D404 — v2a đã nộp Phiếu 2 (bước 3), có mốc đồng ý, và đã chơi XONG một bàn tập (seed màn tập, không ban_ma).
  await pool.query(`UPDATE users SET buoi_do_buoc = 3, thu_chi_tiet_luc = now() WHERE user_id = $1`, [U.v2a!.userId]);
  await pool.query(
    `INSERT INTO holdem_matches
       (owner_user_id, seed, status, vong_hien_tai, action_log, ghe_json, engine_version, balance_version,
        season_id, started_at, ended_at, so_o, che_do, ban_ma)
     VALUES ($1, $2, 'xong', 12, '[]'::jsonb, '[]'::jsonb, 'e', $3, '2026Q3', now(), now(), 12, 'tu_do', NULL)`,
    [U.v2a!.userId, SEED_MAN_TAP_MOI_THOI[0], HOLDEM_BALANCE_VERSION]);
}, 180_000);

afterAll(async () => {
  await pool?.end().catch(() => {});
  await db?.stop();
});

describe('D361 — xuất chi tiết bàn buổi đo', () => {
  it('§I ⭐ chỉ người đang đồng ý ở bản HIỆN HÀNH — v1 ra, đã rút ra, rút-rồi-đồng-ý-lại VÀO', async () => {
    const kq = await docDotThu(pool, { kieu: 'ban', ma: BAN });
    const ma = kq.hangNguoi.map((h) => h.ma_tham_gia).sort();
    expect(ma).toEqual([M.v2a!, M.v2b!, M.lai!].map((id) => maThamGia(id)).sort());
    expect(ma, 'người bấm v1 lọt vào bản xuất theo người').not.toContain(maThamGia(M.v1!));
    expect(ma, 'người đã rút lọt vào bản xuất').not.toContain(maThamGia(M.rut!));
    expect(kq.thongKe.loai_ban_cu).toBe(1);
    expect(kq.thongKe.da_rut).toBe(1);
    expect(kq.thongKe.tran).toBe(3);
    expect(kq.thongKe.tran_da_dung).toBe(3);
  });

  it('§I mã tham gia khớp ĐÚNG maThamGia(match_id) — lệch là ghép bài giấy vào nhầm người', async () => {
    const kq = await docDotThu(pool, { kieu: 'ban', ma: BAN });
    const cua = (id: string) => kq.hangNguoi.find((h) => h.ma_tham_gia === maThamGia(id));
    expect(cua(M.v2a!)?.hang).toBe(2);
    expect(cua(M.lai!)?.hang).toBe(4);
    expect(cua(M.v2b!)?.trang_thai_tran).toBe('bo_dở');
    for (const h of kq.hangNguoi) expect(String(h.ma_tham_gia)).toHaveLength(4);
    // Ba người, ba mã khác nhau — trùng mã là hai người bị gộp làm một trong báo cáo.
    expect(new Set(kq.hangNguoi.map((h) => h.ma_tham_gia)).size).toBe(3);
  });

  it('§I bảng VÒNG: đúng số dòng, khoá bằng mã tham gia, không dòng của người bị loại', async () => {
    const kq = await docDotThu(pool, { kieu: 'ban', ma: BAN });
    expect(kq.hangVong).toHaveLength(3 + 1 + 2);   // v2a 3 · v2b 1 · lai 2
    const ma = new Set(kq.hangVong.map((r) => r.ma_tham_gia));
    expect(ma).toEqual(new Set([M.v2a!, M.v2b!, M.lai!].map((id) => maThamGia(id))));
  });

  it('⭐⭐ D392 — khoá GHÉP PHIẾU là `ma_buoi_do`: cột ĐẦU, đúng mã của người ấy, có ở cả dòng vòng', async () => {
    const kq = await docDotThu(pool, { kieu: 'ban', ma: BAN });
    for (const h of kq.hangNguoi) expect(Object.keys(h)[0], 'cột đầu của dòng người').toBe('ma_buoi_do');
    for (const r of kq.hangVong) expect(Object.keys(r)[0], 'cột đầu của dòng vòng').toBe('ma_buoi_do');
    const theoTran = (id: string) => kq.hangNguoi.find((h) => h.ma_tham_gia === maThamGia(id));
    expect(theoTran(M.v2a!)?.ma_buoi_do).toBe('mbd1');
    expect(theoTran(M.v2b!)?.ma_buoi_do).toBe('mbd2');
    expect(theoTran(M.lai!)?.ma_buoi_do).toBe('mbd3');
    // Dòng vòng mang ĐÚNG mã của chủ trận — ghép phiếu với từng vòng không cần qua bảng người.
    const maVong = new Map(kq.hangVong.map((r) => [r.ma_tham_gia, r.ma_buoi_do]));
    expect(maVong.get(maThamGia(M.v2a!))).toBe('mbd1');
    expect(maVong.get(maThamGia(M.lai!))).toBe('mbd3');
    // Người bị loại (v1 · đã rút) không lọt qua cột mới.
    const tatCa = JSON.stringify(kq, (_k, v) => (typeof v === 'bigint' ? String(v) : v));
    expect(tatCa).not.toContain('mbd4');
    expect(tatCa).not.toContain('mbd5');
  });

  it('⭐ D396 — ô CSV: mốc giờ ra ISO-8601 UTC (không phải chữ theo múi giờ máy chạy lệnh)', async () => {
    const kq = await docDotThu(pool, { kieu: 'ban', ma: BAN });
    const ts = kq.hangVong[0]!.ts;
    expect(ts, 'tiền đề: cột ts của dòng vòng là mốc giờ').toBeInstanceOf(Date);
    expect(oCsv(ts)).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/);
    expect(oCsv(new Date('2026-09-24T06:35:38.000Z'))).toBe('2026-09-24T06:35:38.000Z');
    // Luật cũ của ô giữ nguyên: số lẻ làm tròn 4 chữ số, ô có dấu phẩy được bọc, null là ô trống.
    expect(oCsv(1.23456789)).toBe('1.2346');
    expect(oCsv('a,b')).toBe('"a,b"');
    expect(oCsv(null)).toBe('');
  });

  it('§II ⭐⭐ KHÔNG cột danh tính — quét cả TÊN CỘT lẫn GIÁ TRỊ Ô', async () => {
    const kq = await docDotThu(pool, { kieu: 'ban', ma: BAN });
    const cam = /user_id|owner|handle|email|@/i;
    for (const bang of [kq.hangNguoi, kq.hangVong]) {
      for (const h of bang) {
        for (const [k, v] of Object.entries(h)) {
          expect(k, `cột "${k}" mang danh tính`).not.toMatch(cam);
          // ⚠ Quét cả GIÁ TRỊ: một cột tên vô hại vẫn chở được uuid nếu ai đó lỡ SELECT nhầm.
          if (typeof v === 'string') {
            expect(v, `ô "${k}" chở giá trị trông như danh tính: ${v}`)
              .not.toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-/i);
            expect(v, `ô "${k}" chở email`).not.toMatch(/@/);
          }
        }
      }
    }
    /*
     * Và handle của chính những người trong bàn không được xuất hiện ở bất kỳ đâu.
     * ⚠ Replacer BigInt là BẮT BUỘC: `pg` trả `bigint` cho cột `bigint` không ép `::text` (ở đây là
     * `holdem_ban.seed`), và `JSON.stringify` NÉM trên BigInt. Không có replacer thì bài này đỏ vì lý do
     * chẳng liên quan gì tới danh tính — tức mất luôn phép canh thật.
     */
    const text = JSON.stringify(kq, (_k, v) => (typeof v === 'bigint' ? String(v) : v));
    for (const t of ['v2a', 'v2b', 'lai']) expect(text).not.toContain(U[t]!.handle);
  });

  /*
   * ⭐⭐ D404 — CỘT GHÉP THÊM. Mỗi cột dưới đây là một câu phiếu có chỗ đối chứng: bước tester · đề và chữ ký đề ·
   * vai/cỡ bàn · mốc giờ trận · TỔNG rút sớm (không phải max) · bậc ba năng lực của đúng trận · bàn tập · nhóm tuổi ·
   * cờ telemetry. Và hai cột không bao giờ có số phải BIẾN MẤT.
   */
  it('⭐⭐ D404 — dòng người mang bước · đề · vai · mốc giờ · tổng rút sớm · bậc · bàn tập · nhóm tuổi · cờ telemetry', async () => {
    const kq = await docDotThu(pool, { kieu: 'ban', ma: BAN });
    const cua = (id: string) => kq.hangNguoi.find((h) => h.ma_tham_gia === maThamGia(id))!;
    const a = cua(M.v2a!);
    const b = cua(M.v2b!);

    expect(a.buoc).toBe(3);
    expect(b.buoc).toBe(0);
    expect(a.dong_y_luc, 'mốc đồng ý (thu_chi_tiet_luc) phải ra tệp').toBeInstanceOf(Date);
    expect(a.de_id).toBe('de-a');
    expect(a.de_chu_ky, 'chữ ký đề đọc từ config, không gõ tay').toBe(deCua('de-a')!.chu_ky.join('|'));
    expect(a.vai).toBe('ca_nhan');
    expect(a.so_o).toBe(12);
    expect(a.bat_dau_luc).toBeInstanceOf(Date);
    expect(a.ket_thuc_luc, 'trận xong phải có giờ kết').toBeInstanceOf(Date);
    expect(b.ket_thuc_luc, 'trận bỏ dở chưa có giờ kết — null, không phải 0').toBeNull();

    // ⭐ Cột cũ `tk_huy_so` là MAX theo vòng — vẫn 1 dù rút sớm hai lần. Cột mới đếm đủ.
    expect(a.tk_huy_so).toBe(1);
    expect(a.tk_huy_so_tong).toBe(2);

    // Bậc của ĐÚNG trận này, chấm bằng cùng hàm thuần `/autopsy` dùng — không phải một cách chấm thứ hai.
    const { rows } = await pool.query(
      `SELECT vong, brier, o_su_kien, la_tin_gia, tu_dong, so_ma, tien_mat_bp, tiet_kiem_bp, tk_huy_so, so_nhom,
              tran_xong, man_tap, nghi_may FROM hanh_vi_vong WHERE match_id = $1 ORDER BY vong`, [M.v2a]);
    const the = chamNangLucTran(rows as DongNangLuc[]);
    expect(a.the_tinh_vao).toBe(true);
    expect(a.the_ly_do_khong_tinh).toBeNull();
    expect(a.bac_cam_ket_tiet_kiem, 'gửi rồi rút sớm ⇒ chưa vững').toBe('gap_chua_vung');
    for (const n of the.nang_luc) expect(a[`bac_${n.id}`], `bậc ${n.id} lệch hàm chấm`).toBe(n.bac);
    expect(b.the_tinh_vao, 'trận bỏ dở không vào thẻ').toBe(false);
    expect(b.the_ly_do_khong_tinh).toBe('chua_xong');

    expect(a.ban_tap_xong).toBe(true);
    expect(b.ban_tap_xong).toBe(false);

    const { rows: u } = await pool.query(
      `SELECT age_band, region, occupation_band, research_consent FROM users WHERE user_id = $1`, [U.v2a!.userId]);
    expect(a.nhom_tuoi).toBe(u[0].age_band);
    expect(a.vung).toBe(u[0].region);
    expect(a.nghe).toBe(u[0].occupation_band);
    expect(a.ghi_telemetry).toBe(u[0].research_consent);

    /*
     * ⭐ D404 lượt soi mắt — CỘT TRUNG BÌNH PHẢI LÀ SỐ, KHÔNG PHẢI CHUỖI. `avg()` trên cột INT trả `numeric`,
     * và `pg` chở `numeric` về dạng CHUỖI ("0.6167"); khu TESTER kiểm `typeof v === 'number'` nên in "—" cho
     * PHƠI NHIỄM · MS QUYẾT dù trận có số — đúng lỗi lớp D335 (xanh 38 bài, soi mắt mới thấy). `brier` là double
     * nên không dính; ba cột int/smallint thì dính. Ép `::float8` ở SQL để cả JSON lẫn CSV cùng mang số.
     */
    for (const k of ['phoi_nhiem_tb', 'ms_quyet_tb', 'so_ma_tb', 'so_nhom_tb', 'brier_tb'] as const) {
      expect(typeof a[k], `${k} phải là number (avg trên INT ra numeric → pg trả chuỗi)`).toBe('number');
    }
    expect(a.phoi_nhiem_tb as number).toBeCloseTo(0.6, 5);   // tiền mặt 4000 bp mọi vòng ⇒ phơi nhiễm 0,6

    // Hai cột không có chỗ phát ⇒ không được đứng trong tệp (một cột luôn trống là một lời hứa rỗng).
    for (const h of kq.hangNguoi) {
      expect(Object.keys(h)).not.toContain('hv_doan_lech');
      expect(Object.keys(h)).not.toContain('kq_con_dung_so');
    }
    // Dòng vòng mang đủ đầu vào của hàm chấm, để người đọc CSV chấm lại được bằng tay.
    for (const r of kq.hangVong) {
      for (const k of ['tran_xong', 'man_tap', 'nghi_may']) expect(Object.keys(r)).toContain(k);
    }
  });

  it('§III lỗi có mã: bàn lạ · không phải buổi đo · không ai v2 · chưa dựng hành vi', async () => {
    await expect(docDotThu(pool, { kieu: 'ban', ma: 'zzzzz' })).rejects.toMatchObject({ ma: 'ban_khong_co' });
    await expect(docDotThu(pool, { kieu: 'ban', ma: BAN_NGAY })).rejects.toMatchObject({ ma: 'khong_phai_buoi_do' });
    await expect(docDotThu(pool, { kieu: 'ban', ma: BAN_TRONG })).rejects.toMatchObject({ ma: 'khong_ai_dong_y' });
    await expect(docDotThu(pool, { kieu: 'ban', ma: BAN_CHUA })).rejects.toMatchObject({ ma: 'chua_dung_hanh_vi' });
    await expect(docDotThu(pool, { kieu: 'ban', ma: BAN_TRONG })).rejects.toBeInstanceOf(LoiDotThu);
  });

  /*
   * D436 — trận chạy luật có hệ trait (v55: `trait_json` khác null) KHÔNG vào LỌC TIN, kể cả ở tệp xuất: SELECT phải chở
   * `hv.trait_json` tới hàm chấm. Tiền đề KHÔNG rỗng: cùng những dòng ấy khi trait_json null phải ra bậc KHÁC chua_gap —
   * không thì bài xanh cả khi SELECT bỏ cột. Bàn riêng (bd005) để không đổi số dòng của các bài phía trên.
   */
  it('⭐ D436 — trận có hệ trait ⇒ bac_doc_tin tách (chua_gap) ở tệp xuất; GIỮ SỔ · CHIA giữ nguyên', async () => {
    const BAN_TRAIT = 'bd005';
    await taoBan(BAN_TRAIT, U.chu!, 'buoi_do');
    const u = await createTestUser(pool);
    await vet(u, BAN_TRAIT, 'dong_y', HIEN);
    const id = await tran(u, BAN_TRAIT, { st: 'xong', hang: 1, soVong: 6 });
    // Đủ mẫu cho thẻ đọc tin (≥ 4 Brier, ≥ 2 vòng sự kiện) để tiền đề có bậc thật.
    await pool.query(`UPDATE hanh_vi_vong SET o_su_kien = true WHERE match_id = $1 AND vong IN (2, 4)`, [id]);
    const dong = async () => (await docDotThu(pool, { kieu: 'ban', ma: BAN_TRAIT })).hangNguoi
      .find((h) => h.ma_tham_gia === maThamGia(id))!;
    const truoc = await dong();
    expect(truoc.bac_doc_tin, 'tiền đề: trận luật cũ đủ mẫu phải có bậc đọc tin thật').not.toBe('chua_gap');
    await pool.query(`UPDATE hanh_vi_vong SET trait_json = '[]'::jsonb WHERE match_id = $1`, [id]);
    const sau = await dong();
    expect(sau.bac_doc_tin, 'trận có hệ trait không vào LỌC TIN').toBe('chua_gap');
    expect(sau.bac_cam_ket_tiet_kiem).toBe(truoc.bac_cam_ket_tiet_kiem);
    expect(sau.bac_phan_tan).toBe(truoc.bac_phan_tan);
  });
});

/*
 * D437 — LỚP v55 (lửa · xu · trait) TRONG TỆP XUẤT. Buổi đo 30/09 chạy `balance-v55-build`; app ghi đủ lớp này (0070 ·
 * 0071) nhưng tới D437 tệp xuất không lấy cột nào. Canh bốn điều:
 *   · dòng vòng mang sáu cột 0071 + `trait_trong_vong` — đọc `hd_chot_phien.trait_vong`, KHÔNG phải `trait_json` (SAU vòng);
 *   · dòng người: tổng lửa · xu · trait · chợ đúng số; `brier_tb_sach` bỏ vòng có tin riêng VÀ vòng mang trait trục thông
 *     tin CÓ HIỆU LỰC — nhưng giữ vòng mốc, vì lá vừa lấy ở mốc chỉ hiệu lực từ vòng kế;
 *   · A11.2 — trận chạy luật chưa có lửa/trait, hoặc dòng dựng bằng công thức < 4 ⇒ ô TRỐNG, không phải 0;
 *   · tệp lượt chợ trait: một dòng mỗi lượt, danh sách nối "|", khoá mã buổi đo, không cột danh tính.
 */
describe('D437 — lớp v55 trong tệp xuất', () => {
  // ⚠ 'bd007', không 'bd005': bài D436 phía trên đã dùng bd005 — gộp 0.0.49 đặt hai bàn trùng mã cạnh nhau (khoá chính).
  const BAN_V55 = 'bd007';
  let mV55 = '';
  let mV52 = '';

  async function tranV(u: TestUser, luat: string, vong: ReadonlyArray<{
    v: number; brier: number; nguon: 'bang' | 'trait' | null; lua: number | null; dap: string | null; xu: number | null;
    sau: string[] | null; trong: string[] | null;
  }>): Promise<string> {
    const { rows } = await pool.query(
      `INSERT INTO holdem_matches (owner_user_id, seed, status, vong_hien_tai, action_log, ghe_json, engine_version,
          balance_version, season_id, started_at, ended_at, so_o, che_do, ban_ma)
       VALUES ($1, 1234567, 'xong', $2, '[]'::jsonb, '[]'::jsonb, 'e', $3, '2026Q3', now(), now(), 16, 'tu_do', $4)
       RETURNING match_id::text AS id`, [u.userId, vong.length, luat, BAN_V55]);
    const id = rows[0].id as string;
    await pool.query(`INSERT INTO hanh_vi_tran (match_id, so_dong, formula_version) VALUES ($1, $2, 4)`, [id, vong.length]);
    for (const d of vong) {
      await pool.query(
        `INSERT INTO hanh_vi_vong (user_id, match_id, vong, ts, lenh_json, pnl_bp, brier, mo_bang, o_su_kien, la_tin_gia,
            tu_dong, tien_mat_bp, so_ma, tran_xong, man_tap, nghi_may, formula_version, so_nhom, vai, so_o,
            lua_nac, lua_dap, xu, trait_json, nguon_tin_rieng, co_che_cat_lo)
         VALUES ($1, $2, $3, now(), '[]'::jsonb, 0, $4, $5, false, false, false, 5000, 2, true, false, false, 4, 2,
                 'ca_nhan', 16, $6, $7, $8, $9::jsonb, $10, $11)`,
        [u.userId, id, d.v, d.brier, d.nguon === 'bang', d.lua, d.dap, d.xu,
          d.sau === null ? null : JSON.stringify(d.sau), d.nguon, d.sau === null ? null : false]);
      if (d.trong !== null) {
        await pool.query(
          `INSERT INTO events (user_id, context_type, context_id, action_type, value_num, value_json)
           VALUES ($1, 'holdem', $2, 'hd_chot_phien', 0, $3)`,
          [u.userId, id, JSON.stringify({ vong: d.v, trait: d.sau, trait_vong: d.trong })]);
      }
    }
    return id;
  }

  beforeAll(async () => {
    U.v55 = await createTestUser(pool);
    U.v52 = await createTestUser(pool);
    await pool.query(
      `INSERT INTO holdem_ban (ma, seed, so_o, chu_user_id, loai, het_han, de_id, nhan, balance_version)
       VALUES ($1, 1234567, 16, $2, 'buoi_do', now() + interval '7 days', 'de-c', 'lop-v55', 'balance-v55-build')`,
      [BAN_V55, U.chu!.userId]);
    for (const [t, ma] of [['v55', 'mbd6'], ['v52', 'mbd7']] as const) {
      await vet(U[t]!, BAN_V55, 'dong_y', HIEN);
      await pool.query(`UPDATE users SET ma_buoi_do = $2 WHERE user_id = $1`, [U[t]!.userId, ma]);
    }
    // Vòng 1 lấy SÁNG SỔ + SƯƠNG MÙ ở mốc ⇒ `trait_json` SAU vòng 1 đã có hai lá, nhưng chúng chỉ hiệu lực từ vòng 2:
    // vòng 1 SẠCH. Vòng 2 mang hai lá trục thông tin (nguon_tin_rieng vẫn NULL — nó chỉ cờ NỘI GIÁN/THÍNH TIN). Vòng 3 mở Bảng.
    const HAI = ['sang_so', 'suong_mu'];
    mV55 = await tranV(U.v55!, 'balance-v55-build', [
      { v: 1, brier: 0.5, nguon: null, lua: 1, dap: null, xu: 2, sau: HAI, trong: [] },
      { v: 2, brier: 0.1, nguon: null, lua: 2, dap: null, xu: 3, sau: HAI, trong: HAI },
      { v: 3, brier: 0.3, nguon: 'bang', lua: 0, dap: 'mua_duoi_muon', xu: 1, sau: HAI, trong: HAI },
    ]);
    // Hai lượt chợ: mốc 1 lấy hai lá (cân 0) · lượt sau cuộn 1 lần rồi chọn sai luật ⇒ bỏ qua, xu giữ nguyên.
    for (const c of [
      { vong: 1, moc: 1, moi: ['sang_so', 'lenh_min', 'may_xu', 'suong_mu', 'so_mong', 'mot_gio'], lay: HAI, cuon: 0,
        xu_truoc: 2, xu_sau: 2, bo_qua: false },
      { vong: 3, moc: 6, moi: ['kien_nhan', 'noi_gian', 'giu_nhiet', 'mu_tin', 'gong_cum', 'te_liet'], lay: [], cuon: 1,
        xu_truoc: 3, xu_sau: 3, bo_qua: true },
    ]) {
      await pool.query(
        `INSERT INTO events (user_id, context_type, context_id, action_type, value_num, value_json)
         VALUES ($1, 'holdem', $2, 'hd_chon_trait', $3, $4)`,
        [U.v55!.userId, mV55, c.lay.length, JSON.stringify({ ...c, mat_tri: null, dang_mang: HAI })]);
    }
    // Trận LUẬT CŨ (v52) dựng bằng công thức 4: không lửa, không trait — ô v55 phải TRỐNG; tin riêng vẫn đếm được.
    mV52 = await tranV(U.v52!, 'balance-v52-dadang', [
      { v: 1, brier: 0.4, nguon: null, lua: null, dap: null, xu: null, sau: null, trong: null },
      { v: 2, brier: 0.8, nguon: 'bang', lua: null, dap: null, xu: null, sau: null, trong: null },
    ]);
  }, 60_000);

  it('⭐ dòng VÒNG: sáu cột 0071 + trait CÓ HIỆU LỰC TRONG vòng (không phải danh sách SAU vòng)', async () => {
    const kq = await docDotThu(pool, { kieu: 'ban', ma: BAN_V55 });
    const vong = kq.hangVong.filter((r) => r.ma_tham_gia === maThamGia(mV55))
      .sort((a, b) => Number(a.vong) - Number(b.vong));
    expect(vong.map((r) => r.vong)).toEqual([1, 2, 3]);
    expect(vong.map((r) => r.lua_nac)).toEqual([1, 2, 0]);
    expect(vong.map((r) => r.lua_dap)).toEqual([null, null, 'mua_duoi_muon']);
    expect(vong.map((r) => r.xu)).toEqual([2, 3, 1]);
    expect(vong.map((r) => r.nguon_tin_rieng)).toEqual([null, null, 'bang']);
    expect(vong.map((r) => r.co_che_cat_lo)).toEqual([false, false, false]);
    expect(vong.map((r) => r.trait_json)).toEqual(['sang_so|suong_mu', 'sang_so|suong_mu', 'sang_so|suong_mu']);
    expect(vong.map((r) => r.trait_trong_vong), 'vòng 1 chưa mang gì — lá lấy ở mốc hiệu lực từ vòng 2')
      .toEqual(['', 'sang_so|suong_mu', 'sang_so|suong_mu']);
    // Trận luật cũ: không có hệ trait ⇒ ô trống (null), không phải "không mang lá nào" ('').
    const cu = kq.hangVong.filter((r) => r.ma_tham_gia === maThamGia(mV52));
    expect(cu.length).toBe(2);
    for (const r of cu) {
      expect(r.trait_trong_vong).toBeNull();
      expect(r.trait_json).toBeNull();
      expect(r.lua_nac).toBeNull();
    }
  });

  it('⭐ dòng NGƯỜI: tổng lửa · xu · trait · chợ; Brier sạch bỏ vòng tin riêng + vòng mang trait thông tin, GIỮ vòng mốc', async () => {
    const kq = await docDotThu(pool, { kieu: 'ban', ma: BAN_V55 });
    const h = kq.hangNguoi.find((r) => r.ma_tham_gia === maThamGia(mV55))!;
    expect(h.luat).toBe('balance-v55-build');
    expect(h.lua_nac_max).toBe(2);
    expect(h.so_vong_lua_dap).toBe(1);
    expect(h.so_vong_mua_duoi_muon).toBe(1);
    expect(h.xu_cuoi).toBe(1);
    expect(h.trait_cuoi).toBe('sang_so|suong_mu');
    expect(h.so_trait_cuoi).toBe(2);
    expect(h.so_vong_tin_rieng).toBe(1);
    expect(h.so_moc_trait).toBe(2);
    expect(h.so_trait_lay).toBe(2);
    expect(h.so_lan_cuon).toBe(1);
    expect(h.so_moc_bo_qua).toBe(1);
    // Chỉ vòng 1 sạch: vòng 2 mang SÁNG SỔ + SƯƠNG MÙ (nguon_tin_rieng NULL — hai lá ấy nó không cờ), vòng 3 mở Bảng.
    expect(h.so_vong_brier_sach).toBe(1);
    expect(Number(h.brier_tb_sach)).toBeCloseTo(0.5, 10);
  });

  it('⭐ A11.2 — luật chưa có lửa/trait ⇒ ô v55 TRỐNG (con đếm chợ cũng trống, không phải 0); tin riêng vẫn đếm', async () => {
    const kq = await docDotThu(pool, { kieu: 'ban', ma: BAN_V55 });
    const h = kq.hangNguoi.find((r) => r.ma_tham_gia === maThamGia(mV52))!;
    for (const k of ['lua_nac_max', 'so_vong_lua_dap', 'so_vong_mua_duoi_muon', 'xu_cuoi', 'trait_cuoi', 'so_trait_cuoi',
      'so_moc_trait', 'so_trait_lay', 'so_lan_cuon', 'so_moc_bo_qua']) {
      expect(h[k], `${k} của trận v52 phải trống`).toBeNull();
    }
    expect(h.so_vong_tin_rieng).toBe(1);
    expect(h.so_vong_brier_sach).toBe(1);
    expect(Number(h.brier_tb_sach)).toBeCloseTo(0.4, 10);
  });

  it('⭐ A11.2 — dòng dựng bằng công thức < 4 (chưa có lớp v55) ⇒ ô từ hành vi TRỐNG, kể cả ở trận luật v55', async () => {
    const kq = await docDotThu(pool, { kieu: 'ban', ma: BAN });
    const h = kq.hangNguoi.find((r) => r.ma_tham_gia === maThamGia(M.v2a!))!;
    for (const k of ['lua_nac_max', 'so_vong_lua_dap', 'so_vong_mua_duoi_muon', 'xu_cuoi', 'trait_cuoi', 'so_trait_cuoi',
      'so_vong_tin_rieng', 'brier_tb_sach', 'so_vong_brier_sach']) {
      expect(h[k], `${k} phải trống khi hành vi chưa dựng lại`).toBeNull();
    }
  });

  it('⭐ tệp lượt chợ trait: một dòng mỗi lượt, danh sách nối "|", khoá mã buổi đo, không cột danh tính', async () => {
    const kq = await docDotThu(pool, { kieu: 'ban', ma: BAN_V55 });
    const t = kq.hangTrait.filter((r) => r.ma_tham_gia === maThamGia(mV55));
    expect(t.length).toBe(2);
    expect(t[0]).toMatchObject({
      ma_buoi_do: 'mbd6', vong: 1, moc: 1, lay: 'sang_so|suong_mu', so_lay: 2, cuon: 0, xu_truoc: 2, xu_sau: 2,
      bo_qua: false, mat_tri: null, tu_dong: false, dang_mang: 'sang_so|suong_mu',
    });
    expect(String(t[0]!.moi).split('|')).toHaveLength(6);
    expect(t[1]).toMatchObject({ vong: 3, moc: 6, lay: '', so_lay: 0, cuon: 1, bo_qua: true });
    expect(kq.hangTrait.filter((r) => r.ma_tham_gia === maThamGia(mV52)), 'trận v52 không có lượt chợ').toEqual([]);
    for (const r of kq.hangTrait) {
      for (const [k, v] of Object.entries(r)) {
        expect(k).not.toMatch(/email|handle|user_?id|ho_ten|dien_thoai/i);
        for (const u of [U.v55!, U.v52!]) {
          expect(String(v)).not.toContain(u.userId);
          expect(String(v)).not.toContain(u.handle);
        }
      }
    }
  });
});

/*
 * D440 — LỌC NHIỄU CHO PHÂN TÍCH (founder 27/09). Dữ liệu thô không bỏ gì (events chỉ ghi thêm); tệp xuất chỉ giữ lượt đo
 * TRỌN VẸN. Canh: (1) đúng ba lý do loại — trận dở · đầu hàng · treo máy cả trận — mỗi lý do đếm đúng; (2) ba tệp (người ·
 * vòng · lượt chợ) lọc CÙNG một tập trận — lọt một dòng vòng của người bị loại là nhiễu quay lại qua cửa sau; (3) bản đủ
 * (khu TESTER, theo dõi trong buổi) KHÔNG bị lọc.
 */
describe('D440 — tệp phân tích chỉ giữ lượt đo trọn vẹn', () => {
  const BAN_LOC = 'bd006';

  async function tranLoc(u: TestUser, ma: string, o: { st: 'xong' | 'bo_dở'; dauHang?: boolean; treoMay?: boolean },
    ban: string = BAN_LOC): Promise<string> {
    await vet(u, ban, 'dong_y', HIEN);
    await pool.query(`UPDATE users SET ma_buoi_do = $2 WHERE user_id = $1`, [u.userId, ma]);
    const { rows } = await pool.query(
      `INSERT INTO holdem_matches (owner_user_id, seed, status, vong_hien_tai, action_log, ghe_json, engine_version,
          balance_version, season_id, started_at, ended_at, so_o, che_do, ban_ma)
       VALUES ($1, 1234567, $2, 3, '[]'::jsonb, '[]'::jsonb, 'e', 'balance-v55-build', '2026Q3', now(), $3, 16, 'tu_do', $4)
       RETURNING match_id::text AS id`, [u.userId, o.st, o.st === 'xong' ? new Date() : null, ban]);
    const id = rows[0].id as string;
    if (o.st === 'xong') {
      await pool.query(
        `INSERT INTO holdem_results (match_id, user_id, ghe_id, loai, bac_rank, hang, von_cuoi, vong_chay, danh_muc_json,
            created_at, dau_hang)
         VALUES ($1, $2, 'ban', 'nguoi', 'tom', 3, 10000, 3, '{}'::jsonb, now(), $3)`, [id, u.userId, o.dauHang === true]);
    }
    await pool.query(`INSERT INTO hanh_vi_tran (match_id, so_dong, formula_version) VALUES ($1, 3, 4)`, [id]);
    for (let v = 1; v <= 3; v++) {
      const tuDong = o.treoMay === true || v === 3;
      await pool.query(
        `INSERT INTO hanh_vi_vong (user_id, match_id, vong, ts, lenh_json, pnl_bp, brier, mo_bang, o_su_kien, la_tin_gia,
            tu_dong, tien_mat_bp, so_ma, tran_xong, man_tap, nghi_may, formula_version, so_nhom, vai, so_o)
         VALUES ($1, $2, $3, now(), '[]'::jsonb, 0, 0.5, false, false, false, $4, 5000, 2, $5, false, $6, 4, 2, 'ca_nhan', 16)`,
        [u.userId, id, v, tuDong, o.st === 'xong', o.treoMay === true]);
    }
    await pool.query(
      `INSERT INTO events (user_id, context_type, context_id, action_type, value_num, value_json)
       VALUES ($1, 'holdem', $2, 'hd_chon_trait', 0, $3)`,
      [u.userId, id, JSON.stringify({ vong: 1, moc: 1, moi: [], lay: [], cuon: 0, xu_truoc: 0, xu_sau: 0, mat_tri: null,
        bo_qua: false, dang_mang: [] })]);
    return id;
  }

  const M4: Record<string, string> = {};
  beforeAll(async () => {
    await pool.query(
      `INSERT INTO holdem_ban (ma, seed, so_o, chu_user_id, loai, het_han, de_id, nhan, balance_version)
       VALUES ($1, 1234567, 16, $2, 'buoi_do', now() + interval '7 days', 'de-e', 'lop-loc', 'balance-v55-build')`,
      [BAN_LOC, U.chu!.userId]);
    for (const [t, ma, o] of [
      ['tron', 'mbl1', { st: 'xong' }],
      ['dau', 'mbl2', { st: 'xong', dauHang: true }],
      ['may', 'mbl3', { st: 'xong', treoMay: true }],
      ['do', 'mbl4', { st: 'bo_dở' }],
    ] as const) {
      U[`loc_${t}`] = await createTestUser(pool);
      M4[t] = await tranLoc(U[`loc_${t}`]!, ma, o);
    }
    // Lượt 1 của 'do' bỏ dở (coi như sự cố) ⇒ lượt 2 trên BÀN PHỤ cùng đề E, cùng nhãn nhóm.
    await pool.query(
      `INSERT INTO holdem_ban (ma, seed, so_o, chu_user_id, loai, het_han, de_id, nhan, balance_version)
       VALUES ('bd008', 1234567, 16, $1, 'buoi_do', now() + interval '7 days', 'de-e', 'lop-loc', 'balance-v55-build')`,
      [U.chu!.userId]);
    M4.do2 = await tranLoc(U.loc_do!, 'mbl4', { st: 'xong' }, 'bd008');
    // 'dau' bật ghi dấu vết và có một lỗi máy chủ được ghi ⇒ co_loi_ghi_nhan = true; người khác không bật ⇒ null.
    await pool.query(`UPDATE users SET research_consent = true WHERE user_id = $1`, [U.loc_dau!.userId]);
    // 'may' TẮT ghi (tài khoản test mặc định bật) ⇒ ca "không biết" của co_loi_ghi_nhan.
    await pool.query(`UPDATE users SET research_consent = false WHERE user_id = $1`, [U.loc_may!.userId]);
    await pool.query(`INSERT INTO telemetry (user_id, loai) VALUES ($1, 'loi_api')`, [U.loc_dau!.userId]);
  }, 60_000);

  it('⭐ bản ĐỦ (khu TESTER) còn cả bốn người — lọc chỉ ở tệp phân tích', async () => {
    const du = await docDotThu(pool, { kieu: 'ban', ma: BAN_LOC });
    expect(du.hangNguoi.map((h) => h.ma_buoi_do).sort()).toEqual(['mbl1', 'mbl2', 'mbl3', 'mbl4']);
    expect(du.hangNguoi.find((h) => h.ma_buoi_do === 'mbl2')!.dau_hang).toBe(true);
  });

  it('⭐⭐ tệp phân tích giữ đúng MỘT lượt trọn vẹn; đếm đúng từng lý do loại', async () => {
    const { kq, loai } = locPhanTich(await docDotThu(pool, { kieu: 'ban', ma: BAN_LOC }));
    expect(kq.hangNguoi.map((h) => h.ma_buoi_do)).toEqual(['mbl1']);
    expect(loai).toEqual({ chua_xong: 1, dau_hang: 1, nghi_may: 1 });
  });

  it('⭐ ba tệp lọc CÙNG một tập trận — không dòng vòng / lượt chợ nào của người bị loại lọt lại', async () => {
    const du = await docDotThu(pool, { kieu: 'ban', ma: BAN_LOC });
    expect(du.hangVong.length).toBe(12);
    expect(du.hangTrait.length).toBe(4);
    const { kq } = locPhanTich(du);
    expect(new Set(kq.hangVong.map((r) => r.ma_buoi_do))).toEqual(new Set(['mbl1']));
    expect(kq.hangVong.length).toBe(3);
    expect(kq.hangTrait.map((r) => r.ma_buoi_do)).toEqual(['mbl1']);
  });

  it('lý do theo thứ tự: dở trước đầu hàng trước treo máy', () => {
    expect(lyDoLoai({ trang_thai_tran: 'bo_dở', dau_hang: true, nghi_may: true })).toBe('chua_xong');
    expect(lyDoLoai({ trang_thai_tran: 'xong', dau_hang: true, nghi_may: true })).toBe('dau_hang');
    expect(lyDoLoai({ trang_thai_tran: 'xong', dau_hang: false, nghi_may: true })).toBe('nghi_may');
    expect(lyDoLoai({ trang_thai_tran: 'xong', dau_hang: false, nghi_may: false })).toBeNull();
  });

  it('⭐⭐ lượt bị loại KHÔNG vứt: mỗi lượt một dòng, đúng lý do; lỗi ghi nhận = true / trống khi không bật ghi', async () => {
    const { hangLoai } = locPhanTich(await docDotThu(pool, { kieu: 'ban', ma: BAN_LOC }));
    const theo = new Map(hangLoai.map((h) => [h.ma_buoi_do, h]));
    expect([...theo.keys()].sort()).toEqual(['mbl2', 'mbl3', 'mbl4']);
    expect(theo.get('mbl2')!.ly_do_loai).toBe('dau_hang');
    expect(theo.get('mbl3')!.ly_do_loai).toBe('nghi_may');
    expect(theo.get('mbl4')!.ly_do_loai).toBe('chua_xong');
    expect(theo.get('mbl2')!.co_loi_ghi_nhan, 'bật ghi + có lỗi máy chủ').toBe(true);
    expect(theo.get('mbl3')!.co_loi_ghi_nhan, 'không bật ghi ⇒ không biết, không phải "không lỗi"').toBeNull();
    // Dòng loại mang đủ cột để đọc sự cố: dừng ở vòng mấy, lúc nào, mã lượt.
    expect(theo.get('mbl4')).toMatchObject({ trang_thai_tran: 'bo_dở', ma_tham_gia: maThamGia(M4.do!) });
  });

  it('⭐⭐ mã theo LƯỢT, giữ mã người: lượt 2 trên bàn phụ cùng đề ⇒ lan_thu 2, trỏ về mã lượt 1', async () => {
    const dau = (await docDotThu(pool, { kieu: 'ban', ma: BAN_LOC })).hangNguoi.find((h) => h.ma_buoi_do === 'mbl4')!;
    expect(dau).toMatchObject({ lan_thu: 1, luot_truoc: null, ma_tham_gia: maThamGia(M4.do!) });
    const phu = await docDotThu(pool, { kieu: 'ban', ma: 'bd008' });
    const lai = phu.hangNguoi.find((h) => h.ma_buoi_do === 'mbl4')!;
    expect(lai).toMatchObject({ lan_thu: 2, luot_truoc: maThamGia(M4.do!), ma_tham_gia: maThamGia(M4.do2!) });
    expect(lai.ma_tham_gia).not.toBe(dau.ma_tham_gia);
    // Lượt 2 trọn vẹn ⇒ vào tệp phân tích của bàn phụ; người khác trên bàn gốc vẫn là lượt 1.
    expect(locPhanTich(phu).kq.hangNguoi.map((h) => h.ma_buoi_do)).toEqual(['mbl4']);
    const goc = (await docDotThu(pool, { kieu: 'ban', ma: BAN_LOC })).hangNguoi.filter((h) => h.ma_buoi_do !== 'mbl4');
    for (const h of goc) expect(h.lan_thu, String(h.ma_buoi_do)).toBe(1);
  });
});
