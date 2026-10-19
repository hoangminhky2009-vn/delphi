/** ĐỐI CHIẾU 3 NGUỒN: ma trận kỳ vọng × tờ (!) × β tương quan — tìm mâu thuẫn. */
import {
  MT_TAI_SAN_SU_KIEN, MT_TAI_SAN_GIAI_DOAN, TAI_SAN, SU_KIEN, GIAI_DOAN,
  betaCua, mucDinhTinh,
} from '../config/holdem.js';

console.log('═══ TÀI SẢN × SỰ KIỆN: bp kỳ vọng | mức (!) | β nhiễu ═══');
for (const ts of TAI_SAN) {
  const dong: string[] = [];
  for (const sk of SU_KIEN) {
    const bp = MT_TAI_SAN_SU_KIEN[ts.id]?.[sk.id as never] ?? 0;
    const muc = mucDinhTinh(bp, 'SU_KIEN');
    const beta = betaCua(ts.id, ts.nhom, sk.id);
    // Mâu thuẫn kiểu 1: (!) nói tốt mà bp âm, hoặc ngược lại.
    const mucSai = (bp > 0 && /xau/.test(muc)) || (bp < 0 && /tot/.test(muc));
    dong.push(`${sk.id}=${bp}${mucSai ? '⚠MUC!' : ''}(${muc},β${beta})`);
  }
  console.log(`${ts.id.padEnd(6)} ${dong.join(' ')}`);
}
console.log('\n═══ TÀI SẢN × GIAI ĐOẠN: bp ═══');
for (const ts of TAI_SAN) {
  const dong = GIAI_DOAN.map((gd) =>
    `${gd.id}=${MT_TAI_SAN_GIAI_DOAN[ts.id]?.[gd.id as never] ?? 0}`);
  console.log(`${ts.id.padEnd(6)} ${dong.join(' ')}`);
}
