/** BẤT BIẾN HIỂN THỊ: tổng delta mắt xích trong chain == pnl_bp từng ghế. */
import { giaiQuyetVong, taoTran, type GheMoi } from '../server/holdem/engine.js';
import { HOLDEM_BALANCE_VERSION, luatCua } from '../config/holdem.js';

const ghe = (id: string, ts: string[], ct: string[] = []): GheMoi => ({
  id, loai: 'bot', bac_rank: 'Đồng',
  danh_muc: { tai_san: ts, chien_thuat: ct as never },
});
let sai = 0, kiem = 0;
const dem: Record<string, number> = {};
for (let seed = 1; seed <= 800; seed++) {
  let st = taoTran(seed, [
    ghe('a', ['btc', 'btc'], ['chan_lo']), ghe('b', ['vang'], ['phong_ho']),
    ghe('c', ['vn30', 'tpcp'], ['khop_nhanh']), ghe('d', ['cp_cn'], ['da_dang_hoa']),
    ghe('e', ['usd'], ['don_bay']),
  ], luatCua(HOLDEM_BALANCE_VERSION));
  for (let v = 0; v < st.map.o.length - 1; v++) {
    const r = giaiQuyetVong(st, (c) =>
      c.ghe_id === 'b' && c.duoc.includes('bo') && v === 2 ? { loai: 'bo' } : { loai: 'theo' });
    for (const k of r.ketQua.ket_qua) {
      kiem++;
      let tong = 0;
      for (const m of k.chain) { tong += m.delta_bp ?? 0; dem[m.kind] = (dem[m.kind] ?? 0) + 1; }
      if (tong !== k.pnl_bp) {
        sai++;
        if (sai <= 5) console.log(`seed ${seed} v${st.vong} ghế ${k.ghe_id}: Σchain=${tong} ≠ pnl=${k.pnl_bp} (lệch ${k.pnl_bp - tong})`);
      }
    }
    st = r.trangThai;
    if (st.ghe.filter((g) => !g.da_chay).length <= 1) break;
  }
}
console.log(`\nghế-vòng kiểm: ${kiem} · LỆCH: ${sai}`);
console.log('kind xuất hiện:', Object.entries(dem).sort((a, b) => b[1] - a[1]).map(([k, n]) => `${k}:${n}`).join(' '));
