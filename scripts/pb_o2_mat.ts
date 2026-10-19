import { sinhMap } from '../server/holdem/map.js';
import { tuyChonSinhMap } from '../server/holdem/engine.js';
import { luatCua, HOLDEM_BALANCE_VERSION } from '../config/holdem.js';
const ver = process.env.VER ?? HOLDEM_BALANCE_VERSION;
const tc = tuyChonSinhMap(luatCua(ver));
const N = Number(process.env.N ?? 50000);
for (const size of [8, 12]) {
  const mat = new Map<string, number>();
  let sk2 = 0, hls = 0, hlsThat = 0;
  for (let s = 0; s < N; s += 1) {
    const o2 = sinhMap(s, size, tc).o[1]!;
    if (o2.kind !== 'su_kien') continue;
    sk2 += 1;
    mat.set(o2.su_kien, (mat.get(o2.su_kien) ?? 0) + 1);
    if (o2.su_kien === 'ha_lai_suat') { hls += 1; if (!o2.la_tin_gia) hlsThat += 1; }
  }
  console.log(`\n[${ver}] MAP ${size} N=${N}`);
  console.log(`  ô2 là sự kiện : ${(100*sk2/N).toFixed(2)}%`);
  console.log(`  ô2=ha_lai_suat: ${hls} = ${(100*hls/N).toFixed(2)}% mọi trận (THẬT ${hlsThat} = ${(100*hlsThat/N).toFixed(2)}%)`);
  console.log('  mặt ở ô2:', [...mat.entries()].sort((a,b)=>b[1]-a[1])
    .map(([k,v])=>`${k} ${(100*v/N).toFixed(2)}%`).join(' · '));
}
