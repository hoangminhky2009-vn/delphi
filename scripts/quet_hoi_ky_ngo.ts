/**
 * QUÉT PHÂN BỐ HỒI TẠI VÒNG KỲ NGỘ (D88 §11.3) — đường tái lập của bảng
 * `KY_NGO.LOAI_THEO_HOI`.
 *
 * Chạy:  npx tsx scripts/quet_hoi_ky_ngo.ts [số_seed]
 *
 * ⚠⚠ BẢNG LOAI_THEO_HOI KHÔNG ĐƯỢC ĐỔI MÀ KHÔNG CHẠY LẠI SCRIPT NÀY. Rủi ro
 * nó canh (doc 06 §11.3): nếu một hồi hay rơi đúng vòng kỳ ngộ thì nhiệm vụ bị
 * hồi đó loại sẽ hiếm được mời — cột data của nhiệm vụ đó mỏng đi, mà với ~150
 * người thì mỏng là chết. Tiêu chí đọc kết quả: KHÔNG nhiệm vụ nào có tỷ lệ
 * được-mời dưới ~50% số lần kỳ ngộ (mỗi hồi chỉ loại một món, nên món tệ nhất
 * bị loại đúng bằng tần suất của hồi loại nó).
 *
 * ⚠ Đo trên ĐÚNG bộ luật sắp ship (v32) và ĐÚNG hàm sản phẩm dùng
 * (`hoiTaiTran` — cùng hàm mà replay dùng để sinh lời mời). Tự chế một phép
 * suy hồi thứ hai ở đây là đo một trò khác (bài học D83, ba lần).
 */
import { taoTran, type GheMoi } from '../server/holdem/engine.js';
import { hoiTaiTran } from '../server/holdem_api.js';
import { KY_NGO, NHIEM_VU_KY_NGO, boNhiemVuTheoHoi, luatCua } from '../config/holdem.js';

const SO_SEED = Math.max(100, Number(process.argv[2] ?? 4000) | 0);
const PHIEN_BAN = 'balance-v32-bansac';
const LUAT = luatCua(PHIEN_BAN);

const GHE: GheMoi[] = [{
  id: 'ban', loai: 'nguoi', bac_rank: 'chua_xep',
  danh_muc: { tai_san: [], chien_thuat: [] },
}];

console.log(`Quét ${SO_SEED} seed/cỡ · phiên bản ${PHIEN_BAN}\n`);

for (const soO of [12, 16]) {
  for (const vong of KY_NGO.VONG[soO] ?? []) {
    const demHoi = new Map<string, number>();
    const demMoi = new Map<string, number>();
    for (let i = 0; i < SO_SEED; i += 1) {
      const seed = 20260000 + i;
      const st = taoTran(seed, GHE, LUAT, soO);
      const hoi = hoiTaiTran({ ...st, vong }).id;
      demHoi.set(hoi, (demHoi.get(hoi) ?? 0) + 1);
      for (const m of boNhiemVuTheoHoi(seed, vong, hoi)) {
        demMoi.set(m, (demMoi.get(m) ?? 0) + 1);
      }
    }
    console.log(`── map ${soO} · kỳ ngộ v${vong} ──`);
    for (const [hoi, n] of [...demHoi].sort((a, b) => b[1] - a[1])) {
      const loai = KY_NGO.LOAI_THEO_HOI[hoi] ?? '(xoay cũ)';
      console.log(`  hồi ${hoi.padEnd(10)} ${String(n).padStart(5)}`
        + `  (${((n * 100) / SO_SEED).toFixed(1)}%)  loại: ${loai}`);
    }
    console.log('  — tỷ lệ ĐƯỢC MỜI từng nhiệm vụ:');
    for (const nv of NHIEM_VU_KY_NGO) {
      const n = demMoi.get(nv.id) ?? 0;
      const pct = (n * 100) / SO_SEED;
      const canh = pct < 50 ? '  ⚠⚠ DƯỚI 50% — BẢNG PHẢI XÉT LẠI' : '';
      console.log(`  ${nv.id.padEnd(10)} ${pct.toFixed(1)}%${canh}`);
    }
    console.log('');
  }
}
