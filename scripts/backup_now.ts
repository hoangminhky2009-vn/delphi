/**
 * Chạy backup bằng tay từ máy — kiểm tra pipeline không cần chờ Vercel cron.
 *
 *   npm run backup:now                 # DRY-RUN: dump DB (theo DATABASE_URL) ra
 *                                      # .local/backup-preview.json.gz, KHÔNG đẩy GitHub
 *   npx tsx --env-file=.env.prod scripts/backup_now.ts --push
 *                                      # đẩy THẬT lên GitHub (cần BACKUP_GH_TOKEN/REPO)
 *
 * Dry-run dùng để soi nội dung/kích thước; --push để nghiệm thu token+repo end-to-end.
 */
import 'dotenv/config';
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import pg from 'pg';
import { collectBackup, docKhoaBackup, maHoaBackup, pushToGitHub } from '../server/backup.js';
import { tuyChonSsl, urlChoPool } from '../server/db.js';

// C5: BIGINT → BigInt (giống server/db.ts) để token là số nguyên, không lẫn float.
pg.types.setTypeParser(20, (v: string) => BigInt(v));

async function main(): Promise<void> {
  const push = process.argv.includes('--push');
  const url = process.env.DATABASE_URL;
  if (!url) {
    console.error('Thiếu DATABASE_URL.');
    process.exit(1);
  }

  const pool = new pg.Pool({
    connectionString: urlChoPool(url),
    max: 2,
    ssl: tuyChonSsl(url), // B3 — ghim CA Supabase, không tắt kiểm chứng chỉ
  });

  try {
    const { path: filePath, buffer, rowCounts, jsonBytes } = await collectBackup(pool);
    console.log('Số dòng mỗi bảng:', rowCounts);
    console.log(`JSON ${jsonBytes} byte → gzip ${buffer.length} byte`);
    console.log('Tên file:', filePath);

    if (push) {
      const token = process.env.BACKUP_GH_TOKEN;
      const repo = process.env.BACKUP_GH_REPO;
      const khoa = docKhoaBackup(process.env.BACKUP_KHOA);
      if (!token || !repo || !khoa) {
        // B2 — không bao giờ đẩy bản trần lên GitHub, kể cả chạy tay.
        console.error('Thiếu BACKUP_GH_TOKEN / BACKUP_GH_REPO / BACKUP_KHOA (đặt trong .env.prod).');
        process.exit(1);
      }
      const duongMa = `${filePath}.enc`;
      await pushToGitHub(
        { token, repo, branch: process.env.BACKUP_GH_BRANCH ?? 'main' },
        duongMa,
        maHoaBackup(buffer, khoa),
        `chore(backup): ${duongMa} (chạy tay)`,
      );
      console.log(`✔ Đã đẩy lên GitHub (mã hoá): ${repo} · ${duongMa}`);
    } else {
      const out = path.join(process.cwd(), '.local', 'backup-preview.json.gz');
      await mkdir(path.dirname(out), { recursive: true });
      await writeFile(out, buffer);
      console.log(`✔ DRY-RUN — ghi ra ${out} (KHÔNG đẩy GitHub). Thêm --push để đẩy thật.`);
    }
  } finally {
    await pool.end();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
