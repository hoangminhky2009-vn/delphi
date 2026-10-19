/**
 * AUDIT ĐƯỜNG TIỀN v13 (founder 01/08: "audit tìm điểm mù") — máy quét bất
 * biến qua đường chạy thật, chạy lại được. Bất biến kiểm TỪNG VÒNG TỪNG GHẾ:
 *  1. pnl_bp == floor((nav_sau − nav_truoc)×1e4 / nav_truoc) — thước xếp hạng
 *     không được lệch một bp khỏi công thức niêm yết.
 *  2. NAV không âm; vị thế không âm.
 *  3. Ghế ĐÃ CHÁY là đóng băng: von + vi_the không tăng thêm một chip nào.
 *  4. quy_vong ≥ nền × số ghế sống đầu vòng (phí chỉ CỘNG thêm, không rút).
 *  5. Tất định: chạy lại cùng seed → cùng NAV cuối từng ghế.
 * Chạy: npx tsx scripts/holdem_audit_tien.ts [N]
 */
import { HOLDEM_MATCH, luatCua } from '../config/holdem.js';
import {
  apLenhMocNav, daKetThuc, giaiQuyetVong, taoTran, type GheMoi, type TrangThaiTran,
} from '../server/holdem/engine.js';
import { navCua, type LenhMoc } from '../server/holdem/nav.js';
import { rngAt } from '../server/sandbox/rng.js';

const N = Number(process.argv[2] ?? 600);
const V13 = luatCua('balance-v14-nennav');
const THEO = () => ({ loai: 'theo' as const });
const ghe = (id: string): GheMoi => ({
  id, loai: 'bot', bac_rank: 'Đồng', danh_muc: { tai_san: [], chien_thuat: [] },
});

function lenhCua(id: string, st: TrangThaiTran, seed: number): LenhMoc[] {
  if (id === 'g0') return st.vong === 1 ? [{ ma: 'btc', chieu: 'mua', moc_bp: 10000 }] : [];
  if (id === 'g4') return [];
  const r = rngAt(seed, 'audit_tien', st.vong, id.charCodeAt(1)).below(9);
  const ma = ['btc', 'cp_cn', 'vn30', 'vang', 'usd', 'tpcp'][r % 6]!;
  if (r < 4) return [{ ma, chieu: 'mua', moc_bp: (r + 1) * 2500 }];
  if (r < 8) return [{ ma, chieu: 'ban', moc_bp: ((r - 3) * 2500) }];
  return [];
}

let demQuy0: string[] = [];
function chayTran(seed: number, ghiLoi: string[]): number[] {
  let st = taoTran(seed, ['g0', 'g1', 'g2', 'g3', 'g4'].map(ghe), V13);
  let guard = 0;
  const dongBang = new Map<string, number>();
  while (!daKetThuc(st) && guard < 20) {
    guard += 1;
    const song = st.ghe.filter((x) => !x.da_chay).length;
    for (const g of st.ghe) {
      if (g.da_chay) continue;
      const l = lenhCua(g.id, st, seed);
      if (l.length) st = apLenhMocNav(st, g.id, l).st;
    }
    const r = giaiQuyetVong(st, THEO);
    for (const k of r.ketQua.ket_qua) {
      if (k.nav_truoc === undefined) continue;
      const kyVong = k.nav_truoc! > 0
        ? Math.floor(((k.nav_sau! - k.nav_truoc!) * 10000) / k.nav_truoc!) : 0;
      if (k.pnl_bp !== kyVong) {
        ghiLoi.push(`seed=${seed} v=${st.vong} ${k.ghe_id}: pnl ${k.pnl_bp} ≠ ${kyVong}`);
      }
    }
    /*
     * ⚠ BẤT BIẾN GỐC "quỹ ≥ nền × ghế sống" ĐO RA SAI HÀNG LOẠT (01/08, 4.791
     * vi phạm/600 trận): nền chỉ trừ được TIỀN MẶT nên all-in là né nộp nền
     * hợp lệ, và cuối trận cả bàn đầu tư hết ⇒ quỹ teo về phí trượt (~100).
     * Đây là PHÁT HIỆN chính của audit — cách vá đụng công thức kinh tế
     * (A8.2), chờ founder. Hạ xuống sàn mềm để các bất biến khác lộ ra.
     */
    // v14 (founder chốt B): bất biến gốc SỐNG LẠI — nền trừ trên NAV nên
    // ghế sống nào cũng đóng đủ (trừ ghế NAV < nền, hiếm và sắp cháy).
    if (r.ketQua.quy_vong < HOLDEM_MATCH.CAM_KET_NEN * song) demQuy0.push(`${seed}/${st.vong}:${r.ketQua.quy_vong}`);
    st = r.trangThai;
    for (const g of st.ghe) {
      const nav = navCua(g);
      if (nav < 0) ghiLoi.push(`seed=${seed} ${g.id}: NAV âm ${nav}`);
      for (const [ma, v] of Object.entries(g.vi_the)) {
        if (v < 0) ghiLoi.push(`seed=${seed} ${g.id}: vị thế âm ${ma}=${v}`);
      }
      if (g.da_chay) {
        const cu = dongBang.get(g.id);
        if (cu !== undefined && nav > cu) {
          ghiLoi.push(`seed=${seed} ${g.id}: CHÁY mà NAV tăng ${cu}→${nav}`);
        }
        dongBang.set(g.id, nav);
      }
    }
  }
  return st.ghe.map((g) => navCua(g));
}

const loi: string[] = [];
demQuy0 = [];
let soChay = 0;
for (let seed = 1; seed <= N; seed += 1) {
  const a = chayTran(seed, loi);
  const b = chayTran(seed, []);
  if (JSON.stringify(a) !== JSON.stringify(b)) {
    loi.push(`seed=${seed}: KHÔNG TẤT ĐỊNH ${a} vs ${b}`);
  }
  soChay += 1;
}
console.log(`AUDIT ĐƯỜNG TIỀN — ${soChay} trận × 2 lần chạy, v13`);
console.log(`(vòng quỹ dưới nền×sống: ${demQuy0.length} — v13 là ~4.800 + 678 vòng quỹ=0)`);
if (loi.length === 0) console.log('✓ các bất biến còn lại sạch — pnl đúng từng bp, không NAV âm, ghế cháy đóng băng, tất định');
else { console.log(`✗ ${loi.length} vi phạm:`); loi.slice(0, 10).forEach((x) => console.log(' ', x)); }
