/**
 * audit_supply — vỏ CLI của kiểm toán tổng cung (GĐ1 việc 5, luật A3.10).
 * Logic thật ở server/audit.ts (dùng chung với dashboard admin GĐ4 — deploy
 * chỉ đóng gói api/server/config nên logic runtime KHÔNG được nằm trong scripts/).
 */
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { createPool } from '../server/db.js';
import { auditSupply, type AuditReport } from '../server/audit.js';

export { auditSupply, type AuditReport };

const RED = '\x1b[31m';
const GREEN = '\x1b[32m';
const RESET = '\x1b[0m';

const isMain =
  process.argv[1] !== undefined &&
  import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href;

if (isMain) {
  const { chanEnvFileBiNuot, inDb } = await import('./moi_truong.js');
  const nuot = chanEnvFileBiNuot(process.env, 'audit_supply');
  if (nuot !== null) {
    console.error(`${RED}${nuot}${RESET}`);
    process.exit(2);
  }
  inDb('AUDIT CUNG TIỀN');
  const pool = createPool();
  try {
    const report = await auditSupply(pool);
    console.log('=== AUDIT TỔNG CUNG TOKEN T ===');
    for (const [label, value] of Object.entries(report.numbers)) {
      console.log(`  ${label}: ${value} T`);
    }
    if (report.ok) {
      console.log(`${GREEN}✔ CÂN — mọi bất biến cung đều khớp.${RESET}`);
    } else {
      for (const p of report.problems) console.error(`${RED}✖ ${p}${RESET}`);
      console.error(`${RED}✖ KHÔNG CÂN — ${report.problems.length} lỗi. DỪNG và điều tra ngay.${RESET}`);
      process.exit(1);
    }
  } finally {
    await pool.end();
  }
}
