/**
 * SINH ERD — sơ đồ quan hệ của DB, SINH RA từ chính migrations, không vẽ tay (D3, SPEC
 * `docs/spec/va-bao-mat-chuan-hoa-api-dot-1.md`).
 *
 * ─── VÌ SAO SINH, KHÔNG VẼ (D61 · A11.5) ─────────────────────────────────────
 * Mục A6 của `docs/luat/04-du-lieu.md` chép tay 11 bảng trong khi DB thật đã 56, trôi suốt 45 migration mà không
 * có gì báo. Một ERD vẽ tay đi đúng đường đó. Nên tệp này DỰNG Postgres nhúng (`startTestDb` — cùng đường mọi bài
 * test DB), chạy MỌI migration, rồi hỏi `pg_catalog`. Sai lệch duy nhất còn có thể xảy ra là migration không chạy
 * nổi — lúc đó cả bộ test đỏ chứ không âm thầm.
 *
 * ─── KHUÔN `sinh_route.ts` ───────────────────────────────────────────────────
 * `--ghi` sinh `docs/api/erd.md` · `--kiem` so tệp trên đĩa với bản sinh. `tests/erd.test.ts` canh cùng phép so,
 * nên thêm bảng/cột/FK mà quên `npm run erd:ghi` là CI đỏ. Mermaid `erDiagram` vì GitHub tự vẽ, không công cụ ngoài.
 *
 * Miền của bảng: `config/erd_mien.ts` (tiền tố + ngoại lệ). Hai phép đo `fkThieuChiMuc` · `bangThieuPk` cũng là
 * nguồn của bài canh `tests/khoa_ngoai_co_chi_muc.test.ts` — một câu SQL, hai chỗ đọc.
 */
import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import type pg from 'pg';
import { MIEN, NGOAI_LE } from '../config/erd_mien.js';
import { khopBoQuaDong } from './_chuan_dong.js';

const GOC = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
export const TEP = 'docs/api/erd.md';

type Truyvan = Pick<pg.Pool, 'query'>;

interface Cot {
  ten: string;
  kieu: string;
  khongNull: boolean;
}
interface Fk {
  ten: string;
  cot: string[];
  bangCha: string;
  cotCha: string[];
}
interface Bang {
  ten: string;
  mien: string;
  cot: Cot[];
  pk: string[];
  unique: string[][];
  fk: Fk[];
  trigger: string[];
  rls: boolean;
  soPolicy: number;
}

/** Miền của một bảng: ngoại lệ thắng; rồi tiền tố DÀI NHẤT khớp; không khớp ⇒ ném. */
export function mienCua(bang: string): string {
  const le = NGOAI_LE[bang];
  if (le !== undefined) return le;
  let tot: { ma: string; dai: number } | null = null;
  for (const m of MIEN) {
    for (const t of m.tienTo) {
      if (bang.startsWith(t) && (tot === null || t.length > tot.dai)) tot = { ma: m.ma, dai: t.length };
    }
  }
  if (tot === null) throw new Error(`sinh_erd: bảng \`${bang}\` không thuộc miền nào — khai ở config/erd_mien.ts`);
  return tot.ma;
}

/**
 * Kiểu cột cho mermaid: tên kiểu chỉ nhận chữ/số/gạch dưới, nên rút gọn tên Postgres nhiều từ và bỏ `(n,m)`.
 * Chỉ để ĐỌC — kiểu thật nằm ở migration.
 */
export function kieuGon(formatType: string): string {
  const doi: Record<string, string> = {
    'timestamp with time zone': 'timestamptz',
    'timestamp without time zone': 'timestamp',
    'time with time zone': 'timetz',
    'time without time zone': 'time',
    'character varying': 'varchar',
    'double precision': 'float8',
    character: 'char',
  };
  let k = formatType.replace(/\(.*?\)/g, '');
  const mang = k.endsWith('[]');
  if (mang) k = k.slice(0, -2);
  k = doi[k] ?? k;
  return `${k.replace(/[^A-Za-z0-9_]+/g, '_')}${mang ? '_array' : ''}`;
}

/** Tên cột của một mảng attnum, theo đúng thứ tự khoá. */
const COT_CUA = (bang: string, mang: string) => `ARRAY(
  SELECT a.attname::text FROM unnest(${mang}) WITH ORDINALITY kx(n, o)
  JOIN pg_attribute a ON a.attrelid = ${bang} AND a.attnum = kx.n ORDER BY kx.o)`;

const BANG_PUBLIC = `
  SELECT c.oid, c.relname FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
  WHERE n.nspname = 'public' AND c.relkind IN ('r', 'p') AND NOT c.relispartition`;

/**
 * Mọi FK mà KHÔNG có chỉ mục nào có các cột đầu đúng bằng tập cột FK.
 *
 * ⚠ Chỉ mục một phần (`WHERE …`) chỉ tính khi điều kiện ĐÚNG LÀ `<một cột FK> IS NOT NULL`: phép tra của FK luôn
 * là `cột = $1`, mà `=` kéo theo NOT NULL nên planner dùng được chỉ mục ấy. Điều kiện khác (`WHERE NOT is_seed`,
 * `WHERE trang_thai = 'cho'`) KHÔNG phủ hàng ngoài điều kiện ⇒ xoá/sửa dòng cha vẫn quét cả bảng con — kể cả khi
 * một CHECK làm hai điều kiện tương đương, vì planner không suy từ CHECK. `indkey::int2[]` đánh số từ 0 ⇒ lát
 * `[0 : n-1]` là n cột đầu.
 */
export async function fkThieuChiMuc(db: Truyvan): Promise<{ bang: string; cot: string[]; rang_buoc: string }[]> {
  const r = await db.query<{ bang: string; cot: string[]; rang_buoc: string }>(`
    WITH b AS (${BANG_PUBLIC})
    SELECT b.relname AS bang, ${COT_CUA('k.conrelid', 'k.conkey')} AS cot, k.conname::text AS rang_buoc
    FROM pg_constraint k JOIN b ON b.oid = k.conrelid
    WHERE k.contype = 'f' AND NOT EXISTS (
      SELECT 1 FROM pg_index i
      WHERE i.indrelid = k.conrelid
        AND (i.indkey::int2[])[0 : cardinality(k.conkey) - 1] @> k.conkey
        AND (i.indkey::int2[])[0 : cardinality(k.conkey) - 1] <@ k.conkey
        AND (i.indpred IS NULL OR pg_get_expr(i.indpred, i.indrelid) IN (
          SELECT '(' || quote_ident(a.attname) || ' IS NOT NULL)' FROM pg_attribute a
          WHERE a.attrelid = k.conrelid AND a.attnum = ANY (k.conkey))))
    ORDER BY 1, 3`);
  return r.rows;
}

/** Mọi bảng `public.*` không có PRIMARY KEY. */
export async function bangThieuPk(db: Truyvan): Promise<string[]> {
  const r = await db.query<{ relname: string }>(`
    WITH b AS (${BANG_PUBLIC})
    SELECT b.relname FROM b
    WHERE NOT EXISTS (SELECT 1 FROM pg_constraint k WHERE k.conrelid = b.oid AND k.contype = 'p')
    ORDER BY 1`);
  return r.rows.map((x) => x.relname);
}

async function docBang(db: Truyvan): Promise<Bang[]> {
  const bang = await db.query<{ oid: number; relname: string; rls: boolean; so_policy: string }>(`
    WITH b AS (${BANG_PUBLIC})
    SELECT b.oid, b.relname, c.relrowsecurity AS rls,
           (SELECT count(*) FROM pg_policy p WHERE p.polrelid = b.oid)::text AS so_policy
    FROM b JOIN pg_class c ON c.oid = b.oid ORDER BY b.relname`);
  const cot = await db.query<{ bang: string; ten: string; kieu: string; khong_null: boolean }>(`
    WITH b AS (${BANG_PUBLIC})
    SELECT b.relname AS bang, a.attname::text AS ten, format_type(a.atttypid, a.atttypmod) AS kieu,
           a.attnotnull AS khong_null
    FROM pg_attribute a JOIN b ON b.oid = a.attrelid
    WHERE a.attnum > 0 AND NOT a.attisdropped ORDER BY b.relname, a.attnum`);
  const rb = await db.query<{ bang: string; loai: string; ten: string; cot: string[]; cha: string | null; cot_cha: string[] }>(`
    WITH b AS (${BANG_PUBLIC})
    SELECT b.relname AS bang, k.contype::text AS loai, k.conname::text AS ten,
           ${COT_CUA('k.conrelid', 'k.conkey')} AS cot,
           cc.relname::text AS cha,
           CASE WHEN k.contype = 'f' THEN ${COT_CUA('k.confrelid', 'k.confkey')} ELSE '{}'::text[] END AS cot_cha
    FROM pg_constraint k JOIN b ON b.oid = k.conrelid LEFT JOIN pg_class cc ON cc.oid = k.confrelid
    WHERE k.contype IN ('p', 'u', 'f') ORDER BY b.relname, k.conname`);
  const tg = await db.query<{ bang: string; ten: string }>(`
    WITH b AS (${BANG_PUBLIC})
    SELECT b.relname AS bang, t.tgname::text AS ten
    FROM pg_trigger t JOIN b ON b.oid = t.tgrelid WHERE NOT t.tgisinternal ORDER BY 1, 2`);

  const theoTen = new Map<string, Bang>();
  for (const x of bang.rows) {
    theoTen.set(x.relname, {
      ten: x.relname, mien: mienCua(x.relname), cot: [], pk: [], unique: [], fk: [], trigger: [],
      rls: x.rls, soPolicy: Number(x.so_policy),
    });
  }
  const lay = (ten: string): Bang => {
    const b = theoTen.get(ten);
    if (b === undefined) throw new Error(`sinh_erd: không thấy bảng ${ten}`);
    return b;
  };
  for (const x of cot.rows) lay(x.bang).cot.push({ ten: x.ten, kieu: kieuGon(x.kieu), khongNull: x.khong_null });
  for (const x of rb.rows) {
    const b = lay(x.bang);
    if (x.loai === 'p') b.pk = x.cot;
    else if (x.loai === 'u') b.unique.push(x.cot);
    else b.fk.push({ ten: x.ten, cot: x.cot, bangCha: x.cha ?? '?', cotCha: x.cot_cha });
  }
  for (const x of tg.rows) lay(x.bang).trigger.push(x.ten);
  return [...theoTen.values()];
}

const cungTap = (a: readonly string[], b: readonly string[]) =>
  a.length === b.length && a.every((x) => b.includes(x));

/** Một đường quan hệ mermaid — đặt ở miền của bảng CON (bảng giữ FK). */
function duongQuanHe(b: Bang, f: Fk): string {
  const batBuoc = f.cot.every((c) => b.cot.find((x) => x.ten === c)?.khongNull === true);
  const motMot = cungTap(f.cot, b.pk) || b.unique.some((u) => cungTap(f.cot, u));
  return `  ${f.bangCha} ${batBuoc ? '||' : '|o'}--${motMot ? 'o|' : 'o{'} ${b.ten} : "${f.cot.join(', ')}"`;
}

function khoaCot(b: Bang, cot: string): string {
  const k: string[] = [];
  if (b.pk.includes(cot)) k.push('PK');
  if (b.fk.some((f) => f.cot.includes(cot))) k.push('FK');
  if (b.unique.some((u) => u.includes(cot))) k.push('UK');
  return k.length > 0 ? ` ${k.join(', ')}` : '';
}

export async function sinhErd(db: Truyvan): Promise<string> {
  const ds = await docBang(db);
  const thieuIdx = await fkThieuChiMuc(db);
  const thieuPk = await bangThieuPk(db);
  const cuoi = await db.query<{ name: string }>('SELECT name FROM schema_migrations ORDER BY name DESC LIMIT 1');

  const soFk = ds.reduce((s, b) => s + b.fk.length, 0);
  const soTg = ds.reduce((s, b) => s + b.trigger.length, 0);
  const soRls = ds.filter((b) => b.rls).length;
  const soPolicy = ds.reduce((s, b) => s + b.soPolicy, 0);
  const mienCuaBang = new Map(ds.map((b) => [b.ten, b.mien]));

  const dong: string[] = [
    '# ERD — SINH RA, ĐỪNG GÕ TAY',
    '',
    '<!-- Sinh bằng `npm run erd:ghi`. Sửa tay là mất ở lần sinh sau. -->',
    '',
    '> Nguồn chân lý là **chính migrations**: `scripts/sinh_erd.ts` dựng Postgres nhúng, chạy mọi tệp',
    '> `migrations/*.sql`, rồi hỏi `pg_catalog`. Thêm bảng/cột/FK mà quên `erd:ghi` ⇒ `tests/erd.test.ts` đỏ.',
    '> Miền theo tiền tố tên bảng, ngoại lệ ở `config/erd_mien.ts`. Quan hệ vẽ ở miền của bảng giữ FK;',
    '> bảng cha ở miền khác hiện như ô trống.',
    '',
    `**${ds.length}** bảng · **${soFk}** khoá ngoại · **${soTg}** trigger · RLS bật **${soRls}/${ds.length}** ·`
      + ` **${soPolicy}** policy · migration cuối \`${cuoi.rows[0]?.name ?? '?'}\`.`,
    '',
    '## Canh',
    '',
    '| phép đo | kết quả | bài canh |',
    '|---|---|---|',
    `| FK không có chỉ mục bắt đầu bằng cột FK | ${thieuIdx.length === 0 ? '_không có_' : thieuIdx.map((x) => `\`${x.bang}.${x.cot.join(',')}\``).join(' · ')} | \`tests/khoa_ngoai_co_chi_muc.test.ts\` |`,
    `| bảng \`public.*\` không PK | ${thieuPk.length === 0 ? '_không có_' : thieuPk.map((x) => `\`${x}\``).join(' · ')} | \`tests/khoa_ngoai_co_chi_muc.test.ts\` |`,
    '',
    '## Miền',
    '',
    '| miền | bảng | FK trong miền | FK sang miền khác |',
    '|---|---:|---:|---:|',
  ];
  for (const m of MIEN) {
    const bs = ds.filter((b) => b.mien === m.ma);
    const fks = bs.flatMap((b) => b.fk);
    const trong = fks.filter((f) => mienCuaBang.get(f.bangCha) === m.ma).length;
    dong.push(`| [${m.ten}](#${m.ma}) | ${bs.length} | ${trong} | ${fks.length - trong} |`);
  }
  dong.push('');

  for (const m of MIEN) {
    const bs = ds.filter((b) => b.mien === m.ma);
    if (bs.length === 0) continue;
    dong.push(`<a id="${m.ma}"></a>`, '', `## ${m.ten} — ${bs.length} bảng`, '', '```mermaid', 'erDiagram');
    for (const b of bs) {
      dong.push(`  ${b.ten} {`);
      for (const c of b.cot) dong.push(`    ${c.kieu} ${c.ten}${khoaCot(b, c.ten)}`);
      dong.push('  }');
    }
    for (const b of bs) for (const f of b.fk) dong.push(duongQuanHe(b, f));
    dong.push('```', '', '| bảng | cột | khoá ngoại → | trigger | RLS |', '|---|---:|---|---|---|');
    for (const b of bs) {
      const fk = b.fk.length === 0 ? '—'
        : b.fk.map((f) => `\`${f.cot.join(',')}\` → \`${f.bangCha}.${f.cotCha.join(',')}\``).join('<br>');
      const tg = b.trigger.length === 0 ? '—' : b.trigger.map((t) => `\`${t}\``).join('<br>');
      const rls = `${b.rls ? 'bật' : '**TẮT**'} · ${b.soPolicy} policy`;
      dong.push(`| \`${b.ten}\` | ${b.cot.length} | ${fk} | ${tg} | ${rls} |`);
    }
    dong.push('');
  }
  return `${dong.join('\n').trimEnd()}\n`;
}

async function main(): Promise<void> {
  const lenh = process.argv[2];
  if (lenh !== '--ghi' && lenh !== '--kiem') {
    console.error('Dùng: --ghi | --kiem');
    process.exit(1);
  }
  // Nạp trễ: bài test chỉ cần các hàm thuần ở trên, không kéo embedded-postgres hai lần.
  const { startTestDb } = await import('../tests/helpers/testdb.js');
  const db = await startTestDb();
  let noiDung: string;
  try {
    noiDung = await sinhErd(db.pool);
  } finally {
    await db.stop();
  }
  const duong = path.join(GOC, TEP);
  if (lenh === '--ghi') {
    await writeFile(duong, noiDung, 'utf8');
    console.log(`Đã ghi ${TEP}`);
    return;
  }
  const tren = await readFile(duong, 'utf8').catch(() => null);
  // So bỏ qua kiểu xuống dòng (D255, `_chuan_dong.ts`): bộ sinh ghi LF, checkout Windows trả CRLF.
  if (tren !== null && khopBoQuaDong(tren, noiDung)) {
    console.log(`✔ ${TEP} khớp với migrations.`);
    return;
  }
  console.error(`✖ ${TEP} đã trôi khỏi migrations. Chạy: npm run erd:ghi`);
  process.exit(1);
}

const LA_CLI =
  process.argv[1] !== undefined &&
  import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href;

if (LA_CLI) {
  await main();
}
