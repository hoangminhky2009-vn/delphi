/**
 * LINT ART PIXEL — canh §XI "Modern Pixel UI" ở tầng thẻ.
 *
 * Vì sao cần một lint riêng: art thẻ từng có 84 `feGaussianBlur` và 502 gradient,
 * tức đi ngược §XI suốt một thời gian dài mà không gì báo. Một quy ước phong cách
 * không có máy canh thì nó chỉ là một dòng trong tài liệu — và tôi đã tự chứng minh
 * điều đó: lần đầu founder nhắc "nhớ là pixel", tôi vừa thêm xong một art gradient
 * thứ 30.
 *
 * BỐN LUẬT KỸ THUẬT:
 *   1. KHÔNG BLUR / GRADIENT trong art. Neon và glass phải làm bằng ô pixel.
 *   2. Lưới đúng 80 × 60 (khớp viewBox 200×150 ở 2,5px/ô).
 *   3. Chỉ dùng ký tự có trong bảng màu (hoặc '.' trong suốt) — chữ lạ là ô mất tích
 *      im lặng, không phải lỗi biên dịch.
 *   4. MỌI thẻ/ô mà catalog công bố đều phải có lưới. Thiếu = ô vuông trắng trên
 *      màn hình người chơi, và không ai biết tới lúc mở trận.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * BA THƯỚC ĐO CHẤT LƯỢNG (thêm 26/07/2026) — LUẬT 5, 6, 7.
 *
 * Founder phàn nàn art xấu BA LẦN. Hai lần đầu tôi sửa bằng cách nâng độ phân
 * giải (40×30 → 80×60) và bỏ gradient; vẫn xấu. Chẩn đoán đúng ở lần ba: vấn đề
 * KHÔNG PHẢI ĐỘ PHÂN GIẢI — 80×60 là 4.800 ô, thừa sức vẽ chi tiết — mà là BỐ CỤC.
 * Lá BTC là ví dụ điển hình: một đồng xu to đặt chính giữa, xung quanh trống trơn,
 * không nền, không hậu cảnh, không tiền cảnh, không bóng đổ.
 *
 * Ba luật dưới đây tồn tại để biến "đẹp" thành thứ ĐO ĐƯỢC, vì "đẹp" thì cãi nhau
 * mãi còn số thì không. Mỗi luật chống ĐÚNG MỘT tật đã đo được trong bộ art cũ:
 *
 *   5. ĐỘ PHỦ ≥ 60%      — chống "vật thể giữa khung, xung quanh trống trơn".
 *                          Muốn đạt thì buộc phải có LỚP NỀN kín khung.
 *   6. ĐỘ PHONG PHÚ ≥ 12 ký tự màu — chống "khối đặc một màu". Muốn đủ 12 thì buộc
 *                          phải đổ bóng nhiều sắc độ trong cùng họ, tức có mặt cong,
 *                          và buộc phải có ≥3 lớp sâu chứ một chủ thể không đủ màu.
 *   7. PHÁT SÁNG ≤ 25% ô có màu — chống lá nào cũng chói loà. Neon mà rải khắp thì
 *                          không còn là điểm nhấn, và tương phản chết theo.
 *
 * ⚠ ĐỪNG HẠ NGƯỠNG CHO LINT XANH. Ba số này đặt theo tiêu chuẩn art MỚI, không
 * theo hiện trạng — bộ art cũ trượt gần hết là ĐÚNG DỰ KIẾN, đó là danh sách việc
 * cho hoạ sĩ. Ngưỡng vặn cho vừa khít hiện trạng thì không canh được gì cả.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * 24/09 (D393) — HAI PHONG CÁCH, HAI BỘ LUẬT.
 *
 * Bộ lá mới (`server/art/la_bai.ts`, founder duyệt D390) là lá TERMINAL: nét vẽ trên cửa
 * sổ tối, cố ý chừa trống. Bản 1 của chính đợt ấy vẽ kín khung kiểu cảnh và bị bác thẳng
 * (*"trông hơi trẻ con và ko khớp với đồ họa terminal"*). Nên luật 5–7 (phủ ≥ 60% · ≥ 12
 * màu) giờ CHỈ canh sáu lá cảnh cũ còn lại — đem chúng áp lên lá mới là ép vẽ lại đúng
 * phong cách vừa bị bác, không phải "giữ chuẩn". Đó KHÔNG phải hạ ngưỡng: ngưỡng của lá
 * cảnh giữ nguyên từng số.
 * Lá mới có luật RIÊNG, canh đúng thứ phong cách ấy sống nhờ:
 *   8. Lưới VUÔNG 48×48 (cặp lãi suất 40×40).
 *   9. Lớp NEON có thật: mọi chữ khai trong `neon` phải có ô trong lưới, và tổng ô neon
 *      ≥ NEON_MIN. Neon rỗng = lá mất hẳn hiệu ứng "sáng trên nét vẽ" mà không gì báo.
 *
 * Chạy: npx tsx scripts/lint_pixel_art.ts
 *       npx tsx scripts/lint_pixel_art.ts --bang   (in bảng số đo lá cảnh cũ, không chặn)
 */
import { CHIEN_THUAT, GIAI_DOAN, SU_KIEN, TAI_SAN } from '../config/holdem.js';
import { LA_BAI } from '../server/art/la_bai.js';
import { ART } from '../server/holdem_art.js';
import { LUOI_PIXEL } from '../server/holdem_art_grids.js';
import { BANG_MAU, O_CAO, O_PHAT_SANG, O_RONG } from '../server/holdem_art_pixel.js';

/** Luật 9 — sàn đo thật thấp nhất là 34 ô (bắt đáy, 24/09); dưới ~24 ô mắt không còn đọc ra nét sáng. */
const NEON_MIN = 24;
/** Luật 8 — cỡ lưới được phép của lá mới. */
const CO_LA_MOI: readonly number[] = [40, 48];

/** Ngưỡng chất lượng — một chỗ duy nhất, để đổi là đổi cả lint lẫn bảng báo cáo. */
export const NGUONG = {
  /** Tỷ lệ ô KHÔNG phải '.' trên tổng 4.800 ô. */
  DO_PHU_MIN: 0.60,
  /** Số ký tự màu KHÁC NHAU dùng trong một lưới. */
  SO_MAU_MIN: 12,
  /** Tỷ lệ ô phát sáng trên tổng ô CÓ MÀU (không tính ô trong suốt). */
  PHAT_SANG_MAX: 0.25,
} as const;

export interface DoLuoi {
  id: string;
  oCoMau: number;
  doPhu: number;
  soMau: number;
  oSang: number;
  tlSang: number;
}

/** Đo một lưới. Tách hàm để test và bảng báo cáo dùng chung đúng phép tính. */
export function doLuoi(id: string, luoi: readonly string[]): DoLuoi {
  const tong = O_RONG * O_CAO;
  const o = luoi.join('').split('').filter((c) => c !== '.');
  const oSang = o.filter((c) => O_PHAT_SANG.has(c)).length;
  return {
    id,
    oCoMau: o.length,
    doPhu: o.length / tong,
    soMau: new Set(o).size,
    oSang,
    tlSang: o.length === 0 ? 0 : oSang / o.length,
  };
}

const loi: string[] = [];

// ── LUẬT 1 — không blur/gradient ───────────────────────────────────────────
for (const [id, svg] of Object.entries(ART)) {
  for (const cam of ['feGaussianBlur', 'Gradient', 'filter=']) {
    if (svg.includes(cam)) {
      loi.push(`art "${id}" chứa "${cam}" — §XI đòi pixel, hiệu ứng phải làm bằng ô`);
    }
  }
  if (!svg.includes('crispEdges')) {
    loi.push(`art "${id}" thiếu shape-rendering="crispEdges" — mép sẽ bị làm mượt`);
  }
}

// ── LUẬT 2 + 3 — kích thước lưới và bảng màu ───────────────────────────────
for (const [id, luoi] of Object.entries(LUOI_PIXEL)) {
  if (luoi.length !== O_CAO) {
    loi.push(`lưới "${id}" có ${luoi.length} hàng, phải đúng ${O_CAO}`);
  }
  luoi.forEach((hang, y) => {
    if (hang.length !== O_RONG) {
      loi.push(`lưới "${id}" hàng ${y} dài ${hang.length}, phải đúng ${O_RONG}`);
    }
    for (const ch of hang) {
      if (ch !== '.' && !BANG_MAU[ch]) {
        loi.push(`lưới "${id}" hàng ${y} dùng ký tự "${ch}" không có trong bảng màu`);
        return;
      }
    }
  });
}

// ── LUẬT 8 + 9 (lá mới) — lưới vuông, chữ trong bảng màu, lớp neon có thật ──
for (const [id, la] of Object.entries(LA_BAI)) {
  const n = la.luoi.length;
  if (!CO_LA_MOI.includes(n)) loi.push(`lá mới "${id}" có ${n} hàng, phải là ${CO_LA_MOI.join(' hoặc ')}`);
  la.luoi.forEach((hang, y) => {
    if (hang.length !== n) loi.push(`lá mới "${id}" hàng ${y} dài ${hang.length}, phải đúng ${n} (lưới vuông)`);
    for (const ch of hang) {
      if (ch !== '.' && !BANG_MAU[ch]) {
        loi.push(`lá mới "${id}" hàng ${y} dùng ký tự "${ch}" không có trong bảng màu`);
        return;
      }
    }
  });
  const o = la.luoi.join('');
  for (const ch of la.neon) {
    if (!o.includes(ch)) loi.push(`lá mới "${id}" khai neon "${ch}" mà lưới không có ô nào màu ấy`);
  }
  const soNeon = o.split('').filter((c) => la.neon.includes(c)).length;
  if (soNeon < NEON_MIN) {
    loi.push(`lá mới "${id}" lớp neon chỉ ${soNeon} ô < ${NEON_MIN} — nét sáng không đọc ra được`);
  }
}

// ── LUẬT 4 — không thẻ nào thiếu art ───────────────────────────────────────
// Tra ART (sau khi gộp lá thiên nga), không tra lưới: bảy tin hoảng loạn mượn chung MỘT lưới.
const canCo = [
  ...TAI_SAN.map((t) => t.id),
  ...CHIEN_THUAT.map((c) => c.id),
  ...GIAI_DOAN.map((g) => `gd_${g.id}`),
  ...SU_KIEN.map((s) => `sk_${s.id}`),
];
for (const id of canCo) {
  if (!ART[id]) loi.push(`THIẾU art cho "${id}" — người chơi sẽ thấy ô trống`);
}
const thua = [...Object.keys(LUOI_PIXEL), ...Object.keys(LA_BAI)].filter((id) => !canCo.includes(id));
if (thua.length) {
  // Không phải lỗi chặn build, nhưng phải nói ra: lưới không ai dùng là art chết.
  console.log(`⚠ lưới không khớp thứ nào trong catalog: ${thua.join(', ')}`);
}

// ── LUẬT 5 + 6 + 7 — ba thước đo chất lượng ────────────────────────────────

/**
 * ⚠ BA LUẬT NÀY ĐANG *CẢNH BÁO*, CHƯA CHẶN BUILD — VÀ CÓ NGÀY CHẾT RÕ RÀNG.
 *
 * Ba thước đo (độ phủ ≥60% · ≥12 màu · phát sáng ≤25%) được thêm ngày 26/07 để
 * biến "art xấu" thành thứ ĐO ĐƯỢC, sau khi founder phàn nàn về art lần thứ ba.
 * Chúng đo đúng, và bộ art HIỆN TẠI trượt 68 lỗi trên 29 lá — độ phủ trung bình
 * chỉ 20,4%, tức tám phần mười mỗi lá là ô trong suốt.
 *
 * Đợt vẽ lại 29 lá ĐÃ CHẠY NHƯNG THẤT BẠI: cả 4 hoạ sĩ chết giữa đường vì hết
 * hạn mức phiên, nên art chưa đổi một lá nào. Nếu để ba luật này fail-closed thì
 * CI ĐỎ mọi lần push — và một CI đỏ thường trực sẽ bị người ta học cách phớt lờ,
 * lúc đó nó không còn canh được gì kể cả những luật ĐANG đúng (kích thước lưới,
 * ký tự lạ, thiếu art). Đó là cái giá thật, không phải chuyện tiện tay.
 *
 * ĐIỀU KIỆN GỠ (không phải "để sau" chung chung):
 *   Ngay khi 29 lá vẽ lại xong và `npm run art:bang` không còn dấu ✗ nào,
 *   đổi CHAN_BUILD thành true. Một dòng, không cần sửa gì khác.
 *   Cho tới lúc đó `npm run art:bang` là chỗ theo dõi tiến độ.
 *
 * KHÔNG hạ ngưỡng để cho nó xanh — hạ ngưỡng là bỏ luôn lý do ba luật này ra đời.
 */
const CHAN_BUILD = true;   // 27/07: 29/29 la sach -> dieu kien go da THOA (A8.9)

const soDo = Object.entries(LUOI_PIXEL).map(([id, luoi]) => doLuoi(id, luoi));
const canhBao: string[] = [];
const nhan = CHAN_BUILD ? loi : canhBao;

for (const d of soDo) {
  if (d.doPhu < NGUONG.DO_PHU_MIN) {
    nhan.push(`lưới "${d.id}" ĐỘ PHỦ ${(d.doPhu * 100).toFixed(1)}% < `
      + `${NGUONG.DO_PHU_MIN * 100}% — thiếu lớp nền, chủ thể lơ lửng giữa khung trống`);
  }
  if (d.soMau < NGUONG.SO_MAU_MIN) {
    nhan.push(`lưới "${d.id}" chỉ ${d.soMau} màu < ${NGUONG.SO_MAU_MIN} — `
      + `khối đặc một sắc độ, không có mặt cong / không đủ lớp sâu`);
  }
  if (d.tlSang > NGUONG.PHAT_SANG_MAX) {
    nhan.push(`lưới "${d.id}" PHÁT SÁNG ${(d.tlSang * 100).toFixed(1)}% > `
      + `${NGUONG.PHAT_SANG_MAX * 100}% ô có màu — chói loà, mất tương phản`);
  }
}

if (canhBao.length > 0) {
  console.log(`
⚠ ${canhBao.length} cảnh báo CHẤT LƯỢNG art (chưa chặn build — xem CHAN_BUILD):`);
  console.log(`  Chi tiết từng lá: npm run art:bang`);
}

// ── Bảng số đo — đường cơ sở cho hoạ sĩ ────────────────────────────────────
if (process.argv.includes('--bang')) {
  const dat = (ok: boolean) => (ok ? ' ' : '✗');
  console.log(`\n${'lá'.padEnd(18)}${'phủ%'.padStart(8)} ${''.padEnd(1)}`
    + `${'màu'.padStart(6)} ${''.padEnd(1)}${'sáng%'.padStart(8)} ${''.padEnd(1)}`
    + `${'ô có màu'.padStart(10)}`);
  console.log('─'.repeat(60));
  for (const d of soDo) {
    console.log(
      d.id.padEnd(18)
      + `${(d.doPhu * 100).toFixed(1).padStart(8)} ${dat(d.doPhu >= NGUONG.DO_PHU_MIN)}`
      + `${String(d.soMau).padStart(6)} ${dat(d.soMau >= NGUONG.SO_MAU_MIN)}`
      + `${(d.tlSang * 100).toFixed(1).padStart(8)} ${dat(d.tlSang <= NGUONG.PHAT_SANG_MAX)}`
      + `${String(d.oCoMau).padStart(10)}`,
    );
  }
  const tb = (f: (d: DoLuoi) => number) => (soDo.reduce((s, d) => s + f(d), 0) / soDo.length);
  console.log('─'.repeat(60));
  console.log(`${'TRUNG BÌNH'.padEnd(18)}${(tb((d) => d.doPhu) * 100).toFixed(1).padStart(8)}  `
    + `${tb((d) => d.soMau).toFixed(1).padStart(6)}  `
    + `${(tb((d) => d.tlSang) * 100).toFixed(1).padStart(8)}  `
    + `${tb((d) => d.oCoMau).toFixed(0).padStart(10)}\n`);
}

if (loi.length) {
  console.log(`✗ Lint art pixel: ${loi.length} lỗi\n`);
  for (const l of loi) console.log(`  - ${l}`);
  process.exitCode = 1;
} else {
  console.log(`✓ Lint art pixel: sạch (${Object.keys(LA_BAI).length} lá mới vuông có neon + `
    + `${Object.keys(LUOI_PIXEL).length} lưới cảnh ${O_RONG}×${O_CAO}, 0 blur/gradient, đủ art cho ${canCo.length} thẻ, `
    + `${canhBao.length === 0 ? 'mọi lá đạt phủ/màu/phát-sáng' : `CÒN ${canhBao.length} cảnh báo chất lượng chưa xử lý`})`);
}
