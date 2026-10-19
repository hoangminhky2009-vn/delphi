/**
 * AUDIT BẤT BIẾN REGIME (D169 — v36 R5, addendum §14 "auditability").
 *
 * `audit:supply` canh TIỀN cân; script này canh TRẠNG THÁI cân. Cùng triết lý:
 * một máy trạng thái mà không ai kiểm được thì mọi kết luận cân bằng đứng trên
 * niềm tin. Chạy trên N map thật của một phiên bản luật, kiểm SÁU bất biến —
 * mỗi cái là một câu đã tuyên ở đâu đó trong repo, nay có máy soát:
 *
 *   1. RUN KHỚP Ô — `run_dai`/`run_huong` trong `trang_thai` phải suy lại được
 *      từ chính dãy ô (không có chỗ nào ghi một đằng phát một nẻo).
 *   2. PHUC_HOI CÓ NGUYÊN NHÂN (chỉ máy tick) — mọi mặt `phuc_hoi` đứng ngay
 *      sau tin tốt THẬT. Đây là lời hứa trung tâm của v36 (D165).
 *   3. ĐÁY CẦN THỜI GIAN — nền XUỐNG không nhảy thẳng lên mặt `tang`.
 *   4. PRIOR HỢP LỆ — `face_prior_bp` trong [0, 10000]; nó là xác suất ex-ante
 *      bán cho người chơi qua cột calibration, âm/vượt trần là số vô nghĩa.
 *   5. SỨC CĂNG TRONG TRẦN — mọi mã trong [0, SUC_CANG.TRAN_BP].
 *   6. BONG BÓNG KHÔNG BẤT TỬ — không chuỗi `tang` liên tiếp nào dài quá
 *      `DAI_TOI_DA + biên`, tức chế độ v27 luôn gãy được.
 *
 * Dùng: `npx tsx scripts/audit_regime.ts [số_map] [cỡ_map] [phiên_bản]`
 * Mặc định 2000 map · cỡ 12 · `HOLDEM_BALANCE_VERSION`. Thoát 1 nếu có vi phạm.
 */
import {
  BONG_BONG_V27, BO_LUAT_THEO_PHIEN_BAN, HOLDEM_BALANCE_VERSION, QUAN_TINH,
  SUC_CANG, luatCua,
} from '../config/holdem.js';
import { sinhMap, HUONG_GIAI_DOAN, type OThiTruong } from '../server/holdem/map.js';
import { tuyChonSinhMap } from '../server/holdem/engine.js';

const SO_MAP = Number(process.argv[2] ?? 2000);
const CO_MAP = Number(process.argv[3] ?? 12);
const PHIEN_BAN = process.argv[4] ?? HOLDEM_BALANCE_VERSION;

if (!(PHIEN_BAN in BO_LUAT_THEO_PHIEN_BAN)) {
  console.error(`✗ phiên bản lạ: ${PHIEN_BAN}`);
  console.error(`  có: ${Object.keys(BO_LUAT_THEO_PHIEN_BAN).join(', ')}`);
  process.exit(1);
}
const LUAT = luatCua(PHIEN_BAN);
const TICK = LUAT.regimeTick === true;

const viPham: string[] = [];
const ghi = (msg: string): void => {
  if (viPham.length < 20) viPham.push(msg);
};

for (let seed = 1; seed <= SO_MAP; seed += 1) {
  const map = sinhMap(seed, CO_MAP, tuyChonSinhMap(LUAT));
  const tt = map.trang_thai ?? [];
  let h: -1 | 0 | 1 = 0;
  let dai = 0;
  let tangLienTiep = 0;
  let hTruoc = 0;
  /** Trạng thái của Ô PHA liền trước — máy tick kiểm nối tiếp trên chuỗi này. */
  let tTruoc: (typeof tt)[number] | undefined;

  map.o.forEach((o: OThiTruong, i: number) => {
    const t = tt[i];
    if (o.kind === 'giai_doan') {
      const hh = HUONG_GIAI_DOAN[o.giai_doan] ?? 0;
      if (hh === h) dai += 1;
      else { h = hh; dai = 1; }
      /*
       * 1. RUN TỰ NHẤT QUÁN.
       * ⚠ Hai luật KHÁC NHAU theo máy, và bản đầu của script này viết nhầm
       * luật cũ cho cả hai (⇒ 20 "vi phạm" giả trên v36):
       *  · máy RÚT cũ: nền = mặt, nên run suy lại được TỪ DÃY Ô;
       *  · máy TICK: nền SỐNG QUA MẶT NGHỈ có chủ đích (nền ≠ mặt — cả cuộc
       *    đập thẻ pha là để tách hai thứ đó), nên run KHÔNG suy từ mặt được.
       *    Thứ vẫn phải đúng là chuỗi `trang_thai` tự nhất quán: cùng hướng ⇒
       *    dài +1, đổi hướng ⇒ dài về 1.
       */
      if (t) {
        if (!TICK) {
          if (t.run_huong !== h || t.run_dai !== dai) {
            ghi(`[1] seed ${seed} ô ${i + 1}: run ghi (${t.run_huong},${t.run_dai}) `
              + `≠ suy từ ô (${h},${dai})`);
          }
        } else if (tTruoc) {
          const dung = t.run_huong === tTruoc.run_huong
            ? t.run_dai === tTruoc.run_dai + 1 : t.run_dai === 1;
          if (!dung) {
            ghi(`[1] seed ${seed} ô ${i + 1}: run (${t.run_huong},${t.run_dai}) `
              + `không nối tiếp (${tTruoc.run_huong},${tTruoc.run_dai})`);
          }
        }
        tTruoc = t;
      }
      // 2 + 3 — chỉ máy tick mới hứa hai điều này
      if (TICK) {
        const truoc = map.o[i - 1];
        if (o.giai_doan === 'phuc_hoi'
          && !(truoc?.kind === 'su_kien' && !truoc.la_tin_gia && truoc.bao_truoc === 'tang')) {
          ghi(`[2] seed ${seed} ô ${i + 1}: phuc_hoi KHÔNG có tin tốt thật đứng trước`);
        }
        // Ô do hàng đợi ép (prior 10000) đi đường cũ — không phải cú tick.
        if (hTruoc === -1 && o.giai_doan === 'tang' && t?.face_prior_bp !== 10000) {
          ghi(`[3] seed ${seed} ô ${i + 1}: mặt TĂNG mọc thẳng từ nền XUỐNG`);
        }
      }
      tangLienTiep = o.giai_doan === 'tang' ? tangLienTiep + 1 : 0;
      hTruoc = h;
    }
    if (!t) return;
    // 4. PRIOR HỢP LỆ
    if (!(t.face_prior_bp >= 0 && t.face_prior_bp <= 10000)) {
      ghi(`[4] seed ${seed} ô ${i + 1}: face_prior_bp = ${t.face_prior_bp} ngoài [0,10000]`);
    }
    // 5. SỨC CĂNG TRONG TRẦN
    t.suc_cang_bp.forEach((s, k) => {
      if (!(s >= 0 && s <= SUC_CANG.TRAN_BP)) {
        ghi(`[5] seed ${seed} ô ${i + 1} mã#${k}: sức căng ${s} ngoài [0,${SUC_CANG.TRAN_BP}]`);
      }
    });
    // 6. BONG BÓNG KHÔNG BẤT TỬ — trần v27 + biên cho chuỗi tăng thường.
    const tranTang = BONG_BONG_V27.DAI_TOI_DA + QUAN_TINH.NGUONG_CHUOI + 2;
    if (tangLienTiep > tranTang) {
      ghi(`[6] seed ${seed} ô ${i + 1}: chuỗi TĂNG dài ${tangLienTiep} > trần ${tranTang}`);
    }
  });
}

console.log(`AUDIT BẤT BIẾN REGIME — ${SO_MAP} map · cỡ ${CO_MAP} · ${PHIEN_BAN}`
  + `${TICK ? ' (máy TICK)' : ''}`);
if (viPham.length === 0) {
  console.log('✓ SẠCH — sáu bất biến regime đều đứng.');
  process.exit(0);
}
console.log(`✗ ${viPham.length}${viPham.length >= 20 ? '+' : ''} VI PHẠM:`);
for (const v of viPham) console.log('  ' + v);
process.exit(1);
