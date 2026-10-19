/**
 * PHẢN BIỆN — kiểm định nghĩa "cớ" của claim (ô1 ∈ {giam, bien_dong})
 * đối chiếu với cơ chế THẬT trong engine (SU_KIEN_THEO_GIAI_DOAN).
 * Đo trên BỘ LUẬT MẶC ĐỊNH qua luatCua + tuyChonSinhMap (bẫy D83/D127/D152).
 */
import { sinhMap } from '../server/holdem/map.js';
import { tuyChonSinhMap } from '../server/holdem/engine.js';
import { luatCua, HOLDEM_BALANCE_VERSION, SU_KIEN_THEO_GIAI_DOAN, LAI_SUAT_NEN } from '../config/holdem.js';

const VER = process.env.VER ?? HOLDEM_BALANCE_VERSION;
const tc = tuyChonSinhMap(luatCua(VER));
const N = Number(process.env.N ?? 40000);
console.log(`phiên bản ĐANG ĐO = ${VER} (mặc định repo = ${HOLDEM_BALANCE_VERSION}) · N=${N}`);
console.log('dòng T7 cho ha_lai_suat:', JSON.stringify(
  SU_KIEN_THEO_GIAI_DOAN.filter((r) => r.su_kien === 'ha_lai_suat')));
console.log('ha_lai_suat có trong NHAN_THAP_BP?', 'ha_lai_suat' in LAI_SUAT_NEN.NHAN_THAP_BP,
  '· NHAN_CAO_BP?', 'ha_lai_suat' in LAI_SUAT_NEN.NHAN_CAO_BP);

for (const size of [8, 12]) {
  const o1Mat = new Map<string, number>();          // phân bố mặt ô1
  const hlsTheoO1 = new Map<string, number>();       // ô2=hls theo mặt ô1
  const hlsThatTheoO1 = new Map<string, number>();   // ô2=hls THẬT theo mặt ô1
  const nenTheoO1 = new Map<string, number>();       // giai_doan_nen của ô2 khi hls THẬT
  const skTheoO1 = new Map<string, Map<string, number>>(); // mọi sự kiện ô2 theo ô1
  let laiSuatKhac400 = 0; let o1LaSuKien = 0; let o2sk = 0;

  for (let s = 0; s < N; s += 1) {
    const m = sinhMap(s, size, tc);
    const o1 = m.o[0]!; const o2 = m.o[1]!;
    if (o1.kind === 'su_kien') { o1LaSuKien += 1; continue; }
    const g = o1.giai_doan;
    o1Mat.set(g, (o1Mat.get(g) ?? 0) + 1);
    if (o2.kind !== 'su_kien') continue;
    o2sk += 1;
    const t2 = m.trang_thai?.[1] as { lai_suat_diem?: number; giai_doan_nen?: string } | undefined;
    if (t2?.lai_suat_diem !== LAI_SUAT_NEN.KHOI_DIEM) laiSuatKhac400 += 1;
    if (!skTheoO1.has(g)) skTheoO1.set(g, new Map());
    const mm = skTheoO1.get(g)!;
    mm.set(o2.su_kien, (mm.get(o2.su_kien) ?? 0) + 1);
    if (o2.su_kien === 'ha_lai_suat') {
      hlsTheoO1.set(g, (hlsTheoO1.get(g) ?? 0) + 1);
      if (!o2.la_tin_gia) {
        hlsThatTheoO1.set(g, (hlsThatTheoO1.get(g) ?? 0) + 1);
        const nen = t2?.giai_doan_nen ?? '?';
        nenTheoO1.set(nen, (nenTheoO1.get(nen) ?? 0) + 1);
      }
    }
  }

  const tongHls = [...hlsTheoO1.values()].reduce((a, b) => a + b, 0);
  const tongThat = [...hlsThatTheoO1.values()].reduce((a, b) => a + b, 0);
  console.log(`\n════════ MAP ${size} ════════`);
  console.log(`ô1 là sự kiện: ${o1LaSuKien} · ô2 lãi suất ≠ ${LAI_SUAT_NEN.KHOI_DIEM}: ${laiSuatKhac400}`);
  console.log(`ô2 = ha_lai_suat: ${tongHls} · trong đó THẬT: ${tongThat} (${(100*tongThat/tongHls).toFixed(1)}%)`);
  console.log('\n  mặt ô1        nền_ô1    ô2=hls   P(hls|ô1)   THẬT');
  for (const [g, n] of [...o1Mat].sort((a, b) => b[1] - a[1])) {
    const h = hlsTheoO1.get(g) ?? 0; const ht = hlsThatTheoO1.get(g) ?? 0;
    console.log(`  ${g.padEnd(12)} ${String(n).padStart(7)} ${String(h).padStart(8)} ${((100*h/n).toFixed(3)+'%').padStart(10)} ${String(ht).padStart(7)}`);
  }
  const giam = hlsThatTheoO1.get('giam') ?? 0;
  const bd = hlsThatTheoO1.get('bien_dong') ?? 0;
  console.log(`\n  ĐN CLAIM  (cớ = giam|bien_dong): THẬT-không-cớ = ${tongThat - giam - bd}/${tongHls} = ${(100*(tongThat-giam-bd)/tongHls).toFixed(1)}%  [claim: 26,4 / 29,8]`);
  console.log(`  ĐN ENGINE (cớ = giam duy nhất)  : THẬT-không-cớ = ${tongThat - giam}/${tongHls} = ${(100*(tongThat-giam)/tongHls).toFixed(1)}%`);
  console.log(`  ⇒ bien_dong bị claim tính là "có cớ": ${bd} ca = ${(100*bd/tongHls).toFixed(1)}% — engine cho hệ số ×1 (không có dòng T7)`);
  console.log(`  "có cớ" theo claim (mọi tin, thật+giả): ${(100*((hlsTheoO1.get('giam')??0)+(hlsTheoO1.get('bien_dong')??0))/tongHls).toFixed(1)}%  [claim nhắc 60,7%]`);
  console.log('  nền (giai_doan_nen) của ô2 khi hls THẬT:', [...nenTheoO1].sort((a,b)=>b[1]-a[1]).map(([k,v])=>`${k} ${(100*v/tongThat).toFixed(1)}%`).join(' · '));

  // các sự kiện KHÁC ở ô2 có "cớ" không — ha_lai_suat có đặc biệt không?
  console.log('\n  ── ô2: mọi mặt sự kiện, %ca mà ô1 KHÔNG phải pha cho nó hệ số T7 ──');
  const tongTheoMat = new Map<string, number>(); const khongCo = new Map<string, number>();
  for (const [g, mm] of skTheoO1) {
    for (const [sk, c] of mm) {
      tongTheoMat.set(sk, (tongTheoMat.get(sk) ?? 0) + c);
      const co = SU_KIEN_THEO_GIAI_DOAN.some((r) => r.su_kien === sk && r.sau_giai_doan === g && r.he_so_bp > 10000);
      if (!co) khongCo.set(sk, (khongCo.get(sk) ?? 0) + c);
    }
  }
  for (const [sk, tot] of [...tongTheoMat].sort((a, b) => b[1] - a[1])) {
    console.log(`  ${sk.padEnd(14)} ${String(tot).padStart(6)} ca · không-có-cớ-T7 ${((100*(khongCo.get(sk)??0)/tot).toFixed(1)+'%').padStart(7)}`);
  }
}
