/** Test: con số 26,4% có dùng được làm "thước đo bản vá" không — độ nhạy theo hệ số T7. */
import { sinhMap } from '../server/holdem/map.js';
import { tuyChonSinhMap } from '../server/holdem/engine.js';
import { luatCua, HOLDEM_BALANCE_VERSION, SU_KIEN_THEO_GIAI_DOAN } from '../config/holdem.js';
const tc = tuyChonSinhMap(luatCua(HOLDEM_BALANCE_VERSION));
const N = Number(process.env.N ?? 40000);
const bang = SU_KIEN_THEO_GIAI_DOAN as unknown as { su_kien: string; sau_giai_doan: string; he_so_bp: number }[];
const dongGiam = bang.find((r) => r.su_kien === 'ha_lai_suat' && r.sau_giai_doan === 'giam')!;
const goc = dongGiam.he_so_bp;

function do8() {
  let tong = 0, that = 0, thatGiam = 0, moiTinGiam = 0;
  for (let s = 0; s < N; s += 1) {
    const m = sinhMap(s, 8, tc); const o1 = m.o[0]!; const o2 = m.o[1]!;
    if (o2.kind !== 'su_kien' || o2.su_kien !== 'ha_lai_suat') continue;
    tong += 1;
    const laGiam = o1.kind === 'giai_doan' && o1.giai_doan === 'giam';
    if (laGiam) moiTinGiam += 1;
    if (!o2.la_tin_gia) { that += 1; if (laGiam) thatGiam += 1; }
  }
  return { tong, that, thatGiam, moiTinGiam };
}
console.log('MAP 8 · N=' + N + ' — độ nhạy của "THẬT-không-cớ" theo hệ số T7 (cớ = giam, ĐN engine)');
console.log('hệ_số  ô2=hls  có-cớ(mọi tin)  THẬT-không-cớ   %không-cớ');
for (const hs of [10000, 20000, 40000, 80000, 200000]) {
  dongGiam.he_so_bp = hs;
  const a = do8();
  console.log(`×${(hs/10000).toFixed(0).padStart(2)}   ${String(a.tong).padStart(5)}   ${String(a.moiTinGiam).padStart(6)} (${(100*a.moiTinGiam/a.tong).toFixed(1)}%)   ${String(a.that-a.thatGiam).padStart(8)}      ${(100*(a.that-a.thatGiam)/a.tong).toFixed(1)}%${hs===goc?'   ← HIỆN HÀNH':''}`);
}
// thử thêm dòng CHẶN sau pha tăng
dongGiam.he_so_bp = goc;
bang.push({ su_kien: 'ha_lai_suat', sau_giai_doan: 'tang', he_so_bp: 0 });
const b = do8();
console.log(`\n+ dòng CHẶN "ha_lai_suat sau tang = ×0": ô2=hls ${b.tong} (từ 1261, −${(100*(1261-b.tong)/1261).toFixed(0)}%) · THẬT-không-cớ ${b.that-b.thatGiam} = ${(100*(b.that-b.thatGiam)/b.tong).toFixed(1)}%`);
