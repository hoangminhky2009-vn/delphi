/**
 * ĐO ENTROPY Ô KẾ — cổng bắt buộc TRƯỚC khi cài dự báo 3 tên (D33/D34).
 *
 * Chạy: npx tsx scripts/holdem_entropy_o_ke.ts [số_map] [cỡ_map]
 *
 * ─── VÌ SAO PHẢI ĐO, KHÔNG ĐƯỢC ĐOÁN ───────────────────────────────────────
 * D33 ghi thẳng: "SỨC MẠNH CỦA '3 THẺ' LÀ HỆ QUẢ CỦA ENTROPY MAP, KHÔNG PHẢI
 * LỰA CHỌN THIẾT KẾ". Hệ có 12 loại ô (7 sự kiện + 5 giai đoạn), nhưng
 * `MT_SU_KIEN_KE_TIEP`, `SU_KIEN_THEO_GIAI_DOAN`, telegraph và chuỗi ép của
 * Bong bóng đã ràng buộc sẵn ô kế. Nếu tập ứng viên THẬT chỉ còn 3 thì "3 tên
 * có 1 sai" = "2 tên đúng trong 3 ứng viên" — quá mạnh, và không tinh chỉnh
 * được vì đặc quyền là NHỊ PHÂN.
 *
 * ─── ĐO CÁI GÌ ─────────────────────────────────────────────────────────────
 * Điều kiện hoá theo ĐÚNG thứ người chơi nhìn thấy (không phải theo trạng thái
 * ẩn của bộ sinh): hai ô công khai gần nhất — kind + id, KHÔNG có `la_tin_gia`.
 * Đó là bối cảnh mà một người chơi giỏi có thể tự dựng lại; entropy đo trên đó
 * mới là "còn bao nhiêu điều chưa biết" thật sự của họ.
 *
 * Ba con số báo về:
 *   · PERPLEXITY = 2^H — SỐ ỨNG VIÊN HIỆU DỤNG. Đây là con số D33 hỏi.
 *   · KHỐI LƯỢNG TOP-3 — xác suất ô kế nằm trong 3 tên nhiều khả năng nhất.
 *     Tiệm cận 1,0 nghĩa là top-3 GẦN BẰNG đáp án.
 *   · SỐ KẾT CỤC KHÁC NHAU quan sát được trong mỗi bối cảnh.
 *
 * ⚠ Chỉ đếm bối cảnh có ≥ MAU_TOI_THIEU mẫu. Bối cảnh hiếm cho entropy thấp
 * GIẢ (một mẫu thì H = 0), và trung bình sẽ tụt xuống theo cái giả đó.
 */
import { sinhMap, type OThiTruong } from '../server/holdem/map.js';
import { HOLDEM_DECISIONS } from '../config/holdem.js';

const SO_MAP = Math.max(2000, Number(process.argv[2] ?? 20000) | 0);
const CO_MAP = Math.max(4, Number(process.argv[3] ?? HOLDEM_DECISIONS.MAP_SIZE) | 0);
/** Dưới ngưỡng này thì mẫu quá mỏng để nói gì về phân bố. */
const MAU_TOI_THIEU = 200;

/** Tên CÔNG KHAI của một ô — đúng thứ người chơi thấy, không có cờ tin giả. */
const ten = (o: OThiTruong): string =>
  (o.kind === 'su_kien' ? `sk:${o.su_kien}` : `gd:${o.giai_doan}`);

/** Bối cảnh = hai ô công khai gần nhất (ô đầu map thì thiếu thì để trống). */
function boiCanh(o: readonly OThiTruong[], i: number): string {
  const a = o[i]!; const b = o[i - 1];
  return `${b ? ten(b) : '∅'}|${ten(a)}`;
}

const dem = new Map<string, Map<string, number>>();
let tongCap = 0;

for (let m = 0; m < SO_MAP; m += 1) {
  const map = sinhMap((m * 2654435761) >>> 0, CO_MAP);
  for (let i = 0; i + 1 < map.o.length; i += 1) {
    const k = boiCanh(map.o, i);
    const v = ten(map.o[i + 1]!);
    const bang = dem.get(k) ?? new Map<string, number>();
    bang.set(v, (bang.get(v) ?? 0) + 1);
    dem.set(k, bang);
    tongCap += 1;
  }
}

interface Dong {
  bc: string; n: number; H: number; pp: number; top3: number; loai: number;
}
const dong: Dong[] = [];
for (const [bc, bang] of dem) {
  let n = 0;
  for (const c of bang.values()) n += c;
  if (n < MAU_TOI_THIEU) continue;
  const p = [...bang.values()].map((c) => c / n).sort((a, b) => b - a);
  const H = -p.reduce((s, x) => s + (x > 0 ? x * Math.log2(x) : 0), 0);
  dong.push({
    bc, n, H, pp: 2 ** H,
    top3: p.slice(0, 3).reduce((s, x) => s + x, 0),
    loai: p.length,
  });
}
dong.sort((a, b) => a.pp - b.pp);

const tongN = dong.reduce((s, d) => s + d.n, 0);
const w = (f: (d: Dong) => number) =>
  dong.reduce((s, d) => s + f(d) * d.n, 0) / tongN;

console.log(`ENTROPY Ô KẾ — ${SO_MAP} map × ${CO_MAP} ô = ${tongCap} cặp (ô i → ô i+1)`);
console.log(`Bối cảnh ≥${MAU_TOI_THIEU} mẫu: ${dong.length}/${dem.size} `
  + `(phủ ${((tongN / tongCap) * 100).toFixed(1)}% số cặp)\n`);

console.log('BỐI CẢNH (ô i-1 | ô i)                 MẪU     H   ỨNG VIÊN  TOP-3  LOẠI');
for (const d of dong) {
  console.log(
    d.bc.padEnd(38) + String(d.n).padStart(6)
    + d.H.toFixed(2).padStart(6) + d.pp.toFixed(2).padStart(10)
    + (d.top3 * 100).toFixed(1).padStart(7) + String(d.loai).padStart(6));
}

console.log(`\nTRUNG BÌNH CÓ TRỌNG SỐ (theo số mẫu):`);
console.log(`  entropy H            = ${w((d) => d.H).toFixed(3)} bit`);
console.log(`  ỨNG VIÊN HIỆU DỤNG   = ${w((d) => d.pp).toFixed(2)}  (2^H)`);
console.log(`  khối lượng TOP-3     = ${(w((d) => d.top3) * 100).toFixed(1)}%`);
console.log(`  số loại quan sát được= ${w((d) => d.loai).toFixed(2)}`);
console.log(`  bối cảnh CHẶT NHẤT   = ${dong[0]!.bc} → ${dong[0]!.pp.toFixed(2)} ứng viên, `
  + `top-3 ${(dong[0]!.top3 * 100).toFixed(1)}%`);

/*
 * PHÁN QUYẾT — ngưỡng đọc theo đúng câu hỏi D33 đặt ra, không phải một chuẩn
 * bịa: "nếu tập ứng viên thật chỉ còn 3 thì 3 tên có 1 sai vẫn quá mạnh".
 */
const pp = w((d) => d.pp);
const top3 = w((d) => d.top3);
console.log('');
if (pp <= 3.0 || top3 >= 0.90) {
  console.log(`✗ QUÁ HẸP — top-3 gần bằng đáp án. Không cài dự báo 3 tên như hiện trạng.`);
} else {
  console.log(`✓ ĐỦ RỘNG — top-3 chỉ phủ ${(top3 * 100).toFixed(1)}% và còn `
    + `${pp.toFixed(2)} ứng viên hiệu dụng, nên "3 tên có 1 sai" KHÔNG tiệm cận đáp án.`);
}
