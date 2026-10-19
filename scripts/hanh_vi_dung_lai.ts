/**
 * DỰNG LẠI TẦNG CHUNG CHUYỂN HÀNH VI từ `events` (D106).
 *
 * Dùng khi: tăng `HANH_VI_FORMULA_VERSION` · nghi bảng lệch · khôi phục sau thảm
 * hoạ (bảng nằm ở BANG_PHU_DU, backup không chở). Idempotent: chạy bao nhiêu lần
 * cũng ra một bảng.
 *
 *   npx tsx scripts/hanh_vi_dung_lai.ts            # DB theo .env (dev)
 *   npx tsx scripts/hanh_vi_dung_lai.ts --prod     # đọc .env.prod (GHI vào prod!)
 *   npx tsx scripts/hanh_vi_dung_lai.ts --user <uuid>
 *   npx tsx scripts/hanh_vi_dung_lai.ts --ban <mã bàn>   # D396 — chỉ trận của MỘT bàn (buổi đo)
 *
 * ⚠ Chỉ ghi vào ba bảng phái sinh; KHÔNG chạm `events`/`holdem_matches`.
 *
 * ⚠ D396 — TRẬN HỎNG BỊ BỎ QUA, KHÔNG LÀM DỪNG CẢ LƯỢT. Prod có 7 trận v53 mà replay nổ (*"Vòng 12 vượt
 * quá map 12 ô"*); bản trước dừng ở trận đầu tiên — tức bước "dựng lại trước khi xuất" của hướng dẫn
 * điều phối nổ ngay trên prod, và (trước D396) còn xoá mất dòng cũ của trận ấy. Nay mỗi trận hỏng in một
 * dòng, bảng của nó giữ nguyên, lượt chạy tiếp; thoát mã 1 để máy biết có trận không dựng được.
 */
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createPool } from '../server/db.js';
import { hanhViDeps } from '../server/holdem_api.js';
import { capNhatTieuDungCuaUser, dungLaiNhieuTran } from '../server/hanh_vi/kho.js';
import { HANH_VI_FORMULA_VERSION } from '../server/hanh_vi/trai.js';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const args = process.argv.slice(2);
const prod = args.includes('--prod');
const chiUser = args.includes('--user') ? args[args.indexOf('--user') + 1] : null;
const chiBan = args.includes('--ban') ? (args[args.indexOf('--ban') + 1] ?? '').trim().toLowerCase() || null : null;

async function docUrl(): Promise<string> {
  const f = prod ? '.env.prod' : '.env';
  const env = await readFile(path.join(ROOT, f), 'utf8');
  const m = env.match(/^DATABASE_URL="?([^"\r\n]+)"?/m);
  if (!m) throw new Error(`${f}: không thấy DATABASE_URL`);
  return m[1]!;
}

const pool = createPool(process.env.DATABASE_URL ?? await docUrl());
try {
  const tran = await pool.query(
    `SELECT match_id, owner_user_id FROM holdem_matches
      WHERE ($1::uuid IS NULL OR owner_user_id = $1)
        AND ($2::text IS NULL OR ban_ma = $2)
      ORDER BY started_at ASC`,
    [chiUser, chiBan]);
  console.log(`[hanh_vi] formula v${HANH_VI_FORMULA_VERSION} · ${tran.rowCount} trận`
    + `${chiBan ? ` · bàn ${chiBan}` : ''}${prod ? ' · PROD' : ''}`);
  const { dong, hong } = await dungLaiNhieuTran(pool, tran.rows.map((r) => String(r.match_id)), hanhViDeps);
  const users = new Set<string>(tran.rows.map((r) => String(r.owner_user_id)));
  let td = 0;
  for (const u of users) td += await capNhatTieuDungCuaUser(pool, u);
  console.log(`[hanh_vi] xong: ${dong} dòng vòng · ${td} dòng tiêu dùng · ${users.size} người`);
  if (hong.length > 0) {
    console.log(`⚠ ${hong.length} trận KHÔNG dựng được — đã bỏ qua, bảng của chúng giữ nguyên, các trận khác vẫn dựng:`);
    for (const h of hong) console.log(`   ${h.match_id.slice(0, 8)} · ${h.loi}`);
    process.exitCode = 1;
  }
} finally {
  await pool.end();
}
