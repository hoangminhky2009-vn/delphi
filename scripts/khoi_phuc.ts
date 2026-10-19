/**
 * KHÔI PHỤC BACKUP ĐÊM — nạp một tệp `delphi-*.json.gz` (server/backup.ts) vào một DB TRỐNG,
 * rồi đối chiếu số dòng · khoá ngoại · audit cung tiền, và in thời gian từng chặng.
 *
 *   npm run khoi-phuc -- <tệp.json.gz>            # Postgres NHÚNG tạm (mặc định) — không chạm mạng, xong là xoá
 *   npm run khoi-phuc -- <tệp.json.gz> --giu      # giữ DB nhúng lại để soi (in DATABASE_URL)
 *   npm run khoi-phuc -- <tệp.json.gz> --db <url> # DB khác (vd Supabase project 2) — PHẢI trống `events`
 *   npm run khoi-phuc -- <tệp.json.gz.enc>        # bản MÃ HOÁ (B2, từ 17/10) — cần BACKUP_KHOA trong .env
 *
 * ⚠ VÌ SAO CÓ TỆP NÀY (diễn tập 11/10, phiếu NGHIÊN CỨU → VẬN HÀNH): backup đêm chạy từ GĐ0 nhưng chưa ai thử
 * nạp ngược lại — `docs/backup.md` ghi "script restore để khi thật sự cần". Một bản sao lưu chưa từng khôi phục
 * là một giả thuyết, không phải một bản sao lưu. Ngày thật sự cần là ngày tệ nhất để viết script này lần đầu.
 *
 * Cách nạp (một transaction, hỏng là không còn gì dở dang):
 *   1. `session_replication_role = replica` — tắt trigger (kể cả `*_no_truncate` của bảng append-only) và kiểm
 *      khoá ngoại TRONG LÚC NẠP, để thứ tự bảng không phải đúng tuyệt đối. Bù lại bằng bước 5.
 *   2. TRUNCATE các bảng trong backup — xoá dòng mồi mà migration vừa gieo (genesis, cosmetic…), vì backup đã có
 *      bản thật của chúng.
 *   3. Nạp từng bảng theo đúng thứ tự `BACKUP_TABLES`, theo lô; json/jsonb → chuỗi, Buffer → bytea, bỏ cột sinh.
 *   4. Đặt lại sequence/identity về max(id) — không thì dòng mới đầu tiên sau khôi phục đụng khoá chính.
 *   5. Đối chiếu: số dòng từng bảng = `row_counts` của tệp; không dòng mồ côi khoá ngoại; `auditSupply` CÂN.
 *
 * KHÔNG BAO GIỜ nạp vào DB đang có `events` (A3.3 — sản phẩm thật): cổng ở `khoiPhuc` chứ không ở CLI, nên gọi
 * từ đâu cũng chặn, kể cả lỡ trỏ `--db` vào prod.
 */
import 'dotenv/config'; // BACKUP_KHOA từ .env để giải tệp .enc (B2)
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import zlib from 'node:zlib';
import { pathToFileURL } from 'node:url';
import pg from 'pg';
import { BACKUP_TABLES, docKhoaBackup, giaiMaBackup } from '../server/backup.js';

export interface TepBackup {
  meta: { generated_at: string; format: number };
  tables: Record<string, Record<string, unknown>[]>;
  row_counts: Record<string, number>;
}

export interface KetQuaKhoiPhuc {
  /** Số dòng đã nạp theo bảng. */
  daNap: Record<string, number>;
  /** Cột có trong tệp nhưng DB không có — schema đã bỏ cột; dữ liệu cột đó KHÔNG được nạp. */
  cotThua: { bang: string; cot: string }[];
  /** Bảng có trong tệp nhưng không có trong danh sách hiện tại (bỏ qua) — hoặc ngược lại (để trống). */
  bangLech: { bang: string; ly_do: 'khong_co_trong_db' | 'khong_co_trong_tep' }[];
  /** Ô bị ĐẶT LẠI khi nạp (`DAT_LAI_KHI_NAP`) — đếm số dòng có giá trị khác NULL bị xoá. */
  datLai: { bang: string; cot: string; so_dong: number }[];
}

export interface KetQuaDoiChieu {
  lechSoDong: { bang: string; tep: number; db: number }[];
  moCoi: { rang_buoc: string; bang: string; so_dong: number }[];
}

/**
 * Đọc tệp backup từ đĩa (gzip → JSON). Tệp `.json.gz.enc` (B2 — mã AES-256-GCM, dòng đầu `{"v":1,…}`) giải bằng
 * `BACKUP_KHOA` trước; nhận biết theo NỘI DUNG (gzip mở bằng 1f 8b, bản mã mở bằng `{`), không theo đuôi tên tệp —
 * tệp tải về bị đổi tên vẫn đọc đúng. Bản gzip trần cũ (trước B2) vẫn đọc được, không cần khoá.
 */
export async function docTep(
  duongDan: string,
  opts: { khoa?: Buffer | undefined } = { khoa: docKhoaBackup(process.env.BACKUP_KHOA) },
): Promise<TepBackup> {
  let tho: Buffer = await readFile(duongDan);
  if (tho[0] === 0x7b) {
    if (!opts.khoa) throw new Error('tệp backup đã mã hoá — đặt BACKUP_KHOA (32 byte base64) trong .env rồi chạy lại');
    tho = giaiMaBackup(tho, opts.khoa);
  }
  const doc = JSON.parse(zlib.gunzipSync(tho).toString('utf8')) as TepBackup;
  if (doc?.meta?.format !== 1) throw new Error(`định dạng backup lạ: meta.format=${String(doc?.meta?.format)} (chỉ biết 1)`);
  return doc;
}

const q = (ten: string): string => `"${ten.replace(/"/g, '""')}"`;

interface Cot { ten: string; kieu: string; sinh: boolean; identityLuon: boolean; tuTang: boolean }

async function cotCuaBang(c: pg.PoolClient, bang: string): Promise<Cot[]> {
  const { rows } = await c.query(
    `SELECT column_name, data_type, is_generated, identity_generation, is_identity, column_default
       FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = $1
      ORDER BY ordinal_position`, [bang]);
  return rows.map((r) => ({
    ten: r.column_name as string,
    kieu: r.data_type as string,
    sinh: r.is_generated === 'ALWAYS',
    identityLuon: r.identity_generation === 'ALWAYS',
    tuTang: r.is_identity === 'YES' || String(r.column_default ?? '').startsWith('nextval('),
  }));
}

/**
 * ⚠ CỘT PHẢI ĐẶT LẠI KHI NẠP — vì backup cố ý bỏ cột anh em của nó (`COT_CAM` ở server/backup.ts).
 *
 * Ca thật, diễn tập đầu 11/10 trên tệp prod 10/10: backup bỏ `totp_secret` (bí mật 2FA không được rời DB) nhưng giữ
 * `totp_confirmed_at`, nên một admin đã bật 2FA thành "đã xác nhận mà không có bí mật", đúng trạng thái CHECK
 * `auth_accounts_totp_chk` (0025) cấm. Cả transaction đổ. Hai quyết định đúng va nhau: không ai viết ĐƯỜNG cho đánh đổi
 * đã khai ("khôi phục thì admin ghi danh 2FA lại", server/backup.ts). Đây là đường đó: tài khoản về trạng thái chưa bật
 * 2FA, script in số tài khoản phải ghi danh lại.
 */
const DAT_LAI_KHI_NAP: Record<string, readonly string[]> = {
  auth_accounts: ['totp_confirmed_at', 'totp_buoc_cuoi'],
};

/** Giá trị JSON trong tệp → giá trị `pg` nạp đúng kiểu cột. */
function chuyen(v: unknown, kieu: string): unknown {
  if (v === null || v === undefined) return null;
  if (kieu === 'json' || kieu === 'jsonb') return JSON.stringify(v);
  if (kieu === 'bytea' && typeof v === 'object' && (v as { type?: string }).type === 'Buffer') {
    return Buffer.from((v as { data: number[] }).data);
  }
  return v;
}

/** Trần tham số của một câu Postgres là 65.535 — giữ xa trần. */
const TRAN_THAM_SO = 30_000;

/**
 * Nạp `doc` vào `pool`. Ném lỗi (và rollback trọn) nếu DB đích đang có `events`.
 * `pool` phải trỏ vào DB ĐÃ migrate (schema có sẵn); hàm không tự migrate.
 */
export async function khoiPhuc(pool: pg.Pool, doc: TepBackup): Promise<KetQuaKhoiPhuc> {
  const kq: KetQuaKhoiPhuc = { daNap: {}, cotThua: [], bangLech: [], datLai: [] };
  const c = await pool.connect();
  try {
    await c.query('BEGIN');
    const { rows: [ev] } = await c.query('SELECT count(*)::int AS n FROM events');
    if (ev.n > 0) {
      throw new Error(`DB đích đang có ${ev.n} dòng events — từ chối khôi phục đè (A3.3). Chỉ nạp vào DB trống.`);
    }
    await c.query(`SET LOCAL session_replication_role = replica`);

    const { rows: coTrongDb } = await c.query(
      `SELECT tablename FROM pg_tables WHERE schemaname = 'public'`);
    const bangDb = new Set(coTrongDb.map((r) => r.tablename as string));
    for (const t of Object.keys(doc.tables)) {
      if (!bangDb.has(t)) kq.bangLech.push({ bang: t, ly_do: 'khong_co_trong_db' });
    }
    const bangNap = BACKUP_TABLES.filter((t) => {
      if (!bangDb.has(t)) return false;
      if (!(t in doc.tables)) { kq.bangLech.push({ bang: t, ly_do: 'khong_co_trong_tep' }); return false; }
      return true;
    });
    if (bangNap.length > 0) await c.query(`TRUNCATE ${bangNap.map(q).join(', ')} CASCADE`);

    for (const t of bangNap) {
      const dong = doc.tables[t] ?? [];
      const cot = (await cotCuaBang(c, t)).filter((x) => !x.sinh);
      const theoTen = new Map(cot.map((x) => [x.ten, x]));
      const cotTep = new Set<string>();
      for (const r of dong) for (const k of Object.keys(r)) cotTep.add(k);
      for (const k of cotTep) if (!theoTen.has(k)) kq.cotThua.push({ bang: t, cot: k });
      const nap = cot.filter((x) => cotTep.has(x.ten));
      kq.daNap[t] = 0;
      if (dong.length === 0 || nap.length === 0) continue;

      const datLai = new Set(DAT_LAI_KHI_NAP[t] ?? []);
      for (const cotDat of datLai) {
        const n = dong.filter((r) => r[cotDat] !== null && r[cotDat] !== undefined).length;
        if (n > 0) kq.datLai.push({ bang: t, cot: cotDat, so_dong: n });
      }
      const vuot = nap.some((x) => x.identityLuon) ? ' OVERRIDING SYSTEM VALUE' : '';
      const moiLo = Math.max(1, Math.min(1000, Math.floor(TRAN_THAM_SO / nap.length)));
      for (let i = 0; i < dong.length; i += moiLo) {
        const lo = dong.slice(i, i + moiLo);
        const thamSo: unknown[] = [];
        const hang = lo.map((r) => `(${nap.map((x) => {
          thamSo.push(datLai.has(x.ten) ? null : chuyen(r[x.ten], x.kieu));
          return `$${thamSo.length}`;
        }).join(',')})`);
        await c.query(
          `INSERT INTO ${q(t)} (${nap.map((x) => q(x.ten)).join(',')})${vuot} VALUES ${hang.join(',')}`,
          thamSo);
      }
      kq.daNap[t] = dong.length;

      for (const x of cot.filter((y) => y.tuTang)) {
        await c.query(
          `SELECT setval(pg_get_serial_sequence($1, $2),
                         COALESCE((SELECT max(${q(x.ten)}) FROM ${q(t)}), 0) + 1, false)`,
          [t, x.ten]);
      }
    }
    await c.query('COMMIT');
  } catch (err) {
    await c.query('ROLLBACK').catch(() => {});
    throw err;
  } finally {
    c.release();
  }
  return kq;
}

/**
 * Đối chiếu DB vừa khôi phục với tệp: số dòng từng bảng + dòng mồ côi của MỌI khoá ngoại trong schema `public`
 * (bước nạp đã tắt kiểm khoá ngoại, nên đây là chỗ duy nhất bắt được một bảng nạp thiếu cha).
 */
export async function doiChieu(pool: pg.Pool, doc: TepBackup): Promise<KetQuaDoiChieu> {
  const kq: KetQuaDoiChieu = { lechSoDong: [], moCoi: [] };
  const { rows: coTrongDb } = await pool.query(`SELECT tablename FROM pg_tables WHERE schemaname = 'public'`);
  const bangDb = new Set(coTrongDb.map((r) => r.tablename as string));
  for (const t of BACKUP_TABLES) {
    const tep = doc.row_counts[t];
    if (!bangDb.has(t) || tep === undefined) continue;
    const { rows: [r] } = await pool.query(`SELECT count(*)::int AS n FROM ${q(t)}`);
    if (r.n !== tep) kq.lechSoDong.push({ bang: t, tep, db: r.n });
  }
  const { rows: fk } = await pool.query(
    `SELECT c.conname,
            cr.relname AS con, pr.relname AS cha,
            array(SELECT a.attname::text FROM unnest(c.conkey) WITH ORDINALITY k(n, i)
                    JOIN pg_attribute a ON a.attrelid = c.conrelid AND a.attnum = k.n ORDER BY k.i) AS cot_con,
            array(SELECT a.attname::text FROM unnest(c.confkey) WITH ORDINALITY k(n, i)
                    JOIN pg_attribute a ON a.attrelid = c.confrelid AND a.attnum = k.n ORDER BY k.i) AS cot_cha
       FROM pg_constraint c
       JOIN pg_class cr ON cr.oid = c.conrelid
       JOIN pg_class pr ON pr.oid = c.confrelid
      WHERE c.contype = 'f' AND c.connamespace = 'public'::regnamespace`);
  for (const f of fk) {
    const con = f.cot_con as string[];
    const cha = f.cot_cha as string[];
    // MATCH SIMPLE: một cột NULL là khoá ngoại không được kiểm — đếm đúng như Postgres kiểm.
    const duNull = con.map((x) => `x.${q(x)} IS NOT NULL`).join(' AND ');
    const khop = con.map((x, i) => `y.${q(cha[i]!)} = x.${q(x)}`).join(' AND ');
    const { rows: [r] } = await pool.query(
      `SELECT count(*)::int AS n FROM ${q(f.con)} x
        WHERE ${duNull} AND NOT EXISTS (SELECT 1 FROM ${q(f.cha)} y WHERE ${khop})`);
    if (r.n > 0) kq.moCoi.push({ rang_buoc: f.conname, bang: f.con, so_dong: r.n });
  }
  return kq;
}

// ─── CLI ─────────────────────────────────────────────────────────────────────

const laMain = process.argv[1] !== undefined
  && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href;

if (laMain) {
  const DO = '\x1b[31m', XANH = '\x1b[32m', MO = '\x1b[2m', HET = '\x1b[0m';
  const args = process.argv.slice(2);
  const tep = args.find((a) => !a.startsWith('--') && args[args.indexOf(a) - 1] !== '--db');
  const giu = args.includes('--giu');
  const iDb = args.indexOf('--db');
  const dbNgoai = iDb >= 0 ? args[iDb + 1] : undefined;
  if (!tep) {
    console.error('dùng: npm run khoi-phuc -- <tệp delphi-*.json.gz[.enc]> [--giu] [--db <url DB trống>]');
    process.exit(2);
  }

  // BigInt cho cột BIGINT (C5) — giống server/db.ts, để auditSupply so số nguyên chứ không float.
  pg.types.setTypeParser(20, (v: string) => BigInt(v));

  const moc: [string, number][] = [];
  const bam = (ten: string, t0: number): void => { moc.push([ten, Date.now() - t0]); };
  const tong0 = Date.now();
  let t0 = Date.now();

  const doc = await docTep(tep);
  bam('đọc + giải nén tệp', t0);
  const tongDongTep = Object.values(doc.row_counts).reduce((a, b) => a + b, 0);
  console.log(`tệp     : ${path.basename(tep)} · chụp lúc ${doc.meta.generated_at} · ${Object.keys(doc.tables).length} bảng · ${tongDongTep} dòng`);

  let dungDb: (() => Promise<void>) | undefined;
  let url = dbNgoai;
  t0 = Date.now();
  if (!url) {
    const { default: EmbeddedPostgres } = await import('embedded-postgres');
    const dataDir = await mkdtemp(path.join(os.tmpdir(), 'delphi-khoiphuc-'));
    const port = 24000 + Math.floor(Math.random() * 1000);
    const epg = new EmbeddedPostgres({
      databaseDir: dataDir, user: 'postgres', password: 'postgres', port, persistent: giu,
      initdbFlags: ['--encoding=UTF8', '--locale=C'], postgresFlags: ['-c', 'TimeZone=UTC'],
      onLog: () => {}, onError: () => {},
    });
    await epg.initialise();
    await epg.start();
    await epg.createDatabase('delphi_khoiphuc');
    url = `postgresql://postgres:postgres@127.0.0.1:${port}/delphi_khoiphuc`;
    dungDb = async () => {
      await epg.stop().catch(() => {});
      if (!giu) await rm(dataDir, { recursive: true, force: true }).catch(() => {});
      else console.log(`${MO}giữ DB: ${dataDir} — chạy lại bằng embedded-postgres cổng ${port}${HET}`);
    };
    bam('dựng Postgres nhúng', t0);
  }
  console.log(`DB đích : ${dbNgoai ? 'ngoài (--db)' : 'Postgres nhúng tạm'}${giu ? ` · ${url}` : ''}`);

  const pool = new pg.Pool({ connectionString: url, max: 3 });
  let rc = 0;
  try {
    t0 = Date.now();
    const { runMigrations } = await import('./migrate.js');
    await runMigrations(pool);
    bam('chạy migration', t0);

    t0 = Date.now();
    const kq = await khoiPhuc(pool, doc);
    bam('nạp dữ liệu', t0);

    t0 = Date.now();
    const dc = await doiChieu(pool, doc);
    bam('đối chiếu số dòng + khoá ngoại', t0);

    t0 = Date.now();
    const { auditSupply } = await import('../server/audit.js');
    const audit = await auditSupply(pool);
    bam('audit cung tiền', t0);

    console.log('');
    for (const [ten, ms] of moc) console.log(`  ${ten.padEnd(32)} ${(ms / 1000).toFixed(1).padStart(6)} s`);
    console.log(`  ${'TỔNG'.padEnd(32)} ${((Date.now() - tong0) / 1000).toFixed(1).padStart(6)} s`);
    console.log('');
    const tongNap = Object.values(kq.daNap).reduce((a, b) => a + b, 0);
    console.log(`đã nạp  : ${tongNap} dòng / ${Object.keys(kq.daNap).length} bảng`);
    for (const d of kq.datLai) console.log(`${MO}  đặt lại khi nạp: ${d.bang}.${d.cot} — ${d.so_dong} dòng${HET}`);
    const can2fa = kq.datLai.find((d) => d.cot === 'totp_confirmed_at')?.so_dong ?? 0;
    if (can2fa > 0) console.log(`  ⚠ ${can2fa} tài khoản phải ghi danh 2FA lại sau khôi phục (totp_secret cố ý không vào backup)`);
    for (const b of kq.bangLech) {
      // Bảng có ở schema mà không có trong tệp = migration MỚI HƠN bản chụp (vd chạy bản local mới hơn prod) — không phải lỗi.
      console.log(b.ly_do === 'khong_co_trong_tep'
        ? `${MO}  bảng mới hơn bản chụp (để trống): ${b.bang}${HET}`
        : `${DO}  ✖ bảng trong tệp mà schema không có (dữ liệu KHÔNG nạp): ${b.bang}${HET}`);
    }
    for (const x of kq.cotThua) console.log(`${DO}  cột thừa (không nạp): ${x.bang}.${x.cot}${HET}`);
    for (const l of dc.lechSoDong) console.log(`${DO}  ✖ lệch số dòng ${l.bang}: tệp ${l.tep} · DB ${l.db}${HET}`);
    for (const m of dc.moCoi) console.log(`${DO}  ✖ mồ côi ${m.rang_buoc} (${m.bang}): ${m.so_dong} dòng${HET}`);
    if (!audit.ok) for (const p of audit.problems) console.log(`${DO}  ✖ audit: ${p}${HET}`);
    const hong = dc.lechSoDong.length + dc.moCoi.length + (audit.ok ? 0 : 1) + kq.cotThua.length
      + kq.bangLech.filter((b) => b.ly_do === 'khong_co_trong_db').length;
    if (hong === 0) console.log(`${XANH}✔ KHÔI PHỤC ĐỌC ĐƯỢC — số dòng khớp · 0 mồ côi · audit CÂN${HET}`);
    else { console.log(`${DO}✖ KHÔI PHỤC CÓ ${hong} VẤN ĐỀ — xem các dòng đỏ ở trên${HET}`); rc = 1; }
  } catch (err) {
    console.error(`${DO}✖ khôi phục hỏng: ${(err as Error).message}${HET}`);
    rc = 1;
  } finally {
    await pool.end().catch(() => {});
    await dungDb?.();
  }
  process.exit(rc);
}
