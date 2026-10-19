/**
 * ĐO SỨC DỰ BÁO THẬT CỦA TELEGRAPH (D373 · v53).
 *
 * ─── VÌ SAO CÓ TỆP NÀY ──────────────────────────────────────────────────────
 * Ở v53 ô của vòng còn ÚP, nên thứ DUY NHẤT bot (và người chơi) có để cược là lời
 * báo `bao_truoc` của lá tin vừa lật. Bot hiện cược theo lời báo ấy với trọng số
 * (1 − p_tin_giả) — tức "tin bao nhiêu phần thì lệch kỳ vọng bấy nhiêu phần".
 *
 * ⚠⚠ ĐÓ LÀ MỘT GIẢ ĐỊNH CHƯA AI ĐO. (1 − p) trả lời "tin này có thật không", KHÔNG
 * trả lời "tin THẬT thì lời báo ứng nghiệm bao nhiêu phần". Hai câu khác nhau, và
 * nếu câu thứ hai nhỏ hơn nhiều thì bot đang cược to trên một tín hiệu mỏng — đúng
 * hình dạng của triệu chứng gate D373 bắt được (oracle đọc tin HOÀN HẢO mà vẫn thua
 * nhóm chơi-được: chiến lược theo tín hiệu tự nó âm vì phí vào lệnh không đổi).
 *
 * Tệp này đo câu thứ hai, thuần từ `sinhMap` — không engine, không bot, không tiền:
 *   · P(ô kế THUẬN lời báo | tin THẬT)  vs  P(ô kế THUẬN | không có lời báo nào)
 *   · chênh hai số đó = ĐỘ NÂNG thật của telegraph, tính bằng điểm phần trăm;
 *   · quy về bp để cắm thẳng vào trọng số bot nếu founder chốt hướng ấy.
 *
 * "THUẬN" đo bằng `HUONG_GIAI_DOAN` chứ không so id pha: lời báo `tang` mà ra
 * `phuc_hoi` thì người cược theo nó VẪN ĂN (cả hai hướng +1). So id là đo sai cái
 * người chơi thật sự nhận.
 *
 * ⚠ Ô kế là Ô SỰ KIỆN ⇒ BỎ KHỎI MẪU, không tính là trượt: `sinhMap` cấm hai ô tin
 * liền nhau nên ca này chỉ xảy ra ở cuối map/biên; gộp nó vào mẫu số là bịa ra một
 * tỷ lệ trượt không có thật.
 *
 * CHẠY:  npx tsx scripts/do_telegraph.ts [số_map] [phiên_bản_luật]
 */
import { HUONG_GIAI_DOAN, sinhMap } from '../server/holdem/map.js';
import { tuyChonSinhMap } from '../server/holdem/engine.js';
import { HOLDEM_BALANCE_VERSION, NHA_CAI, luatCua } from '../config/holdem.js';

const VT = process.argv.slice(2).filter((x) => !x.startsWith('--'));
const N = Math.max(1, Number(VT[0] ?? 20000) | 0);
const PHIEN_BAN = VT[1] ?? HOLDEM_BALANCE_VERSION;
const LUAT = luatCua(PHIEN_BAN);
const TC = tuyChonSinhMap(LUAT);

console.log(`ĐO TELEGRAPH — ${N} map/cỡ · luật ${PHIEN_BAN}`);
console.log(`SUC_MANH_TELEGRAPH_BP = ${NHA_CAI.SUC_MANH_TELEGRAPH_BP}\n`);

/** Hướng của một ô: +1 / −1 / 0. Ô sự kiện trả null (không nằm trong mẫu). */
const huong = (o: { kind: string; giai_doan?: string }): number | null =>
  (o.kind === 'giai_doan' ? HUONG_GIAI_DOAN[o.giai_doan as 'tang'] ?? 0 : null);

for (const size of [8, 12, 16]) {
  // Mẫu A — ô ngay sau một tin THẬT có lời báo.
  let aTong = 0; let aThuan = 0;
  // Mẫu B — ô ngay sau một tin BỊA (lời báo vô giá trị: map không kéo gì).
  let bTong = 0; let bThuan = 0;
  // Mẫu C (đối chứng) — ô KHÔNG đứng sau tin nào. Đây là "đoán mò theo nền".
  let cTong = 0; let cThuan = 0;
  // D · tin THẬT, lời báo THUẬN nền.   N · tin THẬT, lời báo NGƯỢC nền.
  let dTong = 0; let dThuan = 0;
  let nTong = 0; let nThuan = 0; let nTheoNen = 0;
  // G · tin BỊA, lời báo NGƯỢC nền — đối chứng trực tiếp của N.
  let gnTong = 0; let gnThuan = 0; let gnTheoNen = 0;

  for (let s = 0; s < N; s += 1) {
    const m = sinhMap(s, size, TC);
    for (let i = 0; i + 1 < size; i += 1) {
      const o = m.o[i]!;
      const ke = huong(m.o[i + 1]!);
      if (ke === null) continue; // ô kế là tin — ngoài mẫu (xem docstring)
      if (o.kind === 'su_kien') {
        const h = HUONG_GIAI_DOAN[o.bao_truoc] ?? 0;
        if (h === 0) continue; // lời báo trung tính: không có gì để ứng nghiệm
        const nenO = m.trang_thai?.[i]?.run_huong ?? 0;
        if (o.la_tin_gia) {
          bTong += 1; if (ke === h) bThuan += 1;
          /*
           * ⭐⭐ CÂU HỎI QUYẾT ĐỊNH CỦA G4: lời báo của một tin BỊA có khác gì lời báo của
           * tin THẬT không, TRONG ca mà bot thật sự lệch (lời báo ngược nền)? Nếu không khác,
           * thì `la_tin_gia` thôi là thông tin đáng tiền ở v53 — và "hoài nghi" không còn gì
           * để hoài nghi, tức G4 KHÔNG THỂ xanh bằng cách chỉnh số.
           */
          if (nenO !== 0 && h !== nenO) {
            gnTong += 1;
            if (ke === h) gnThuan += 1;
            if (ke === nenO) gnTheoNen += 1;
          }
        }
        else {
          aTong += 1; if (ke === h) aThuan += 1;
          /*
           * ⭐ TÁCH THEO "LỜI BÁO CÓ THUẬN NỀN KHÔNG" — câu hỏi quyết định của bot v53.
           * Bot chỉ LỆCH kỳ vọng khi lời báo KHÁC nền: lời báo trùng nền thì `bt === nen`
           * nên lệch = 0. Vậy toàn bộ sức cược của nó dồn vào đúng một ca — và ca ấy có
           * đáng cược không thì chưa ai đo.
           */
          const nen = nenO;
          if (nen !== 0) {
            if (h === nen) { dTong += 1; if (ke === h) dThuan += 1; }
            else {
              nTong += 1;
              if (ke === h) nThuan += 1;      // lời báo ứng (bot thắng)
              if (ke === nen) nTheoNen += 1;  // nền thắng lời báo (bot lệch SAI)
            }
          }
        }
      } else {
        /*
         * Đối chứng phải hỏi CÙNG một câu: "ô kế có thuận một hướng đã định trước
         * không". Hướng định trước ở đây là hướng của chính ô đang đứng (nền chạy
         * tiếp) — đúng thứ bot v53 lấy làm kỳ vọng khi không có lời báo.
         */
        const h = huong(o)!;
        if (h === 0) continue;
        cTong += 1; if (ke === h) cThuan += 1;
      }
    }
  }

  const pc = (a: number, b: number) => (b === 0 ? 0 : (a * 100) / b);
  const pA = pc(aThuan, aTong);
  const pB = pc(bThuan, bTong);
  const pC = pc(cThuan, cTong);
  console.log(`map ${size}`);
  console.log(`  A · sau tin THẬT  : ${pA.toFixed(1)}%  (n=${aTong})`);
  console.log(`  B · sau tin BỊA   : ${pB.toFixed(1)}%  (n=${bTong})`);
  console.log(`  C · nền chạy tiếp : ${pC.toFixed(1)}%  (n=${cTong})  ← đối chứng`);
  console.log(`  ⇒ ĐỘ NÂNG của lời báo THẬT so với đoán theo nền: ${(pA - pC).toFixed(1)} điểm %`);
  console.log(`  ⇒ tin BỊA so với nền: ${(pB - pC).toFixed(1)} điểm % (≈0 là đúng luật: bịa không kéo gì)\n`);
  console.log('  ── tách tin THẬT theo lời báo có thuận nền không ──');
  console.log(`  D · lời báo THUẬN nền : ứng ${pc(dThuan, dTong).toFixed(1)}%  (n=${dTong})`);
  console.log(`  N · lời báo NGƯỢC nền : ứng ${pc(nThuan, nTong).toFixed(1)}%`
    + ` · nền vẫn thắng ${pc(nTheoNen, nTong).toFixed(1)}%  (n=${nTong})`);
  console.log(`  ⇒ ĐÂY là ca DUY NHẤT bot v53 lệch kỳ vọng — lệch có đáng không:`
    + ` ${(pc(nThuan, nTong) - pc(nTheoNen, nTong)).toFixed(1)} điểm % (âm = lệch là SAI)`);
  console.log(`  G · CÙNG ca đó nhưng tin BỊA : ứng ${pc(gnThuan, gnTong).toFixed(1)}%`
    + ` · nền vẫn thắng ${pc(gnTheoNen, gnTong).toFixed(1)}%  (n=${gnTong})`);
  console.log(`  ⇒ BIẾT THẬT/GIẢ đáng bao nhiêu ở v53:`
    + ` ${(pc(nThuan, nTong) - pc(gnThuan, gnTong)).toFixed(1)} điểm %`
    + ` (≈0 ⇒ G4 không thể xanh bằng cách chỉnh số)`);
}
