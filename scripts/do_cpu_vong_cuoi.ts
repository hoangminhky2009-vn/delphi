/**
 * ĐO CPU MỖI VÒNG NỘP — bước 0 của task A3 (03/09/2026, phương án A3-1).
 *
 * Chạy: npx tsx scripts/do_cpu_vong_cuoi.ts
 *
 * ─── VÌ SAO ĐO CÁI NÀY ──────────────────────────────────────────────────────
 * Đích bậc thang kế tiếp (`config/bac_thang.ts` → `doanh_thu` rồi `c2_5000`) là
 * Cloudflare Workers, và Workers free chỉ cho **10ms CPU/lượt gọi**. `POST
 * /rounds` là endpoint tốn nhất: nó KHÔNG giữ state giữa các request — mỗi lần
 * gọi dựng lại toàn bộ trận từ `action_log` (docstring đầu `server/holdem_api.ts`
 * tự khai: "Đắt hơn giữ RAM một chút nhưng loại hẳn hai lớp bug"). Cụ thể, nó gọi
 * hàm `replay()` HAI LẦN — một lần cho trạng thái TRƯỚC vòng (dòng ~3910, biến
 * `truoc`), một lần cho trạng thái SAU khi vòng vừa nộp được thêm vào log (dòng
 * ~3976, biến `sau`) — và MỖI lần `replay()` phát lại TOÀN BỘ log từ vòng 1, kể
 * cả những vòng đã nộp từ trước. Nghĩa là chi phí một request TĂNG THEO SỐ VÒNG
 * ĐÃ QUA, và vòng CUỐI của một map là trường hợp XẤU NHẤT trong cả trận.
 *
 * Đo TRỰC TIẾP hàm `replay()` thật (mới thêm `export`, xem docstring tại chỗ
 * export trong `server/holdem_api.ts`) thay vì dựng lại một bản mô phỏng CPU thứ
 * hai — bản thứ hai chắc chắn trôi khỏi hành vi thật (D61), và trôi ở đúng chỗ
 * đang cần con số THẬT nhất.
 *
 * ─── CÁCH DỰNG MỘT TRẬN ĐỂ ĐO ───────────────────────────────────────────────
 * Sơ đồ ghế: `soDoGhe(seed, '', 8)` — ĐÚNG hàm production dùng lúc tạo trận (D3:
 * lobby 4–8 ghế; ở đây luôn ép 8 — TRẦN GHẾ, cùng hướng "xấu nhất" với TRẦN VÒNG).
 * Map ≥12 thì bốc VAI y hệt đoạn `POST /matches` thật (xem `server/holdem_api.ts`,
 * quanh chỗ gọi `bocThamVai` sau khi dựng `ghe`) — thiếu bước này là đo "một bộ
 * luật có răng trên một bàn không ai cắn" (bài học D83, nhắc lại trong
 * `scripts/holdem_montecarlo.ts`).
 *
 * Ghế `'ban'` (người chơi) mỗi vòng: GIỮ VỊ THẾ (`hanh_dong: 'giu_vi_the'`), và
 * mua 1 thẻ CHIẾN THUẬT nếu shop có (thẻ Tài sản từ v10 mua bằng LỆNH NAV có
 * mốc/bp riêng — không mô phỏng ở đây, xem GIỚI HẠN cuối file). Bảy ghế bot còn
 * lại KHÔNG bị giả lập ở đây — `replay()` tự quyết định chúng y hệt trận thật,
 * bằng đúng các hàm `botTaiCoCau`/`chonCuoc`/`chonCamKet` mà `holdem_montecarlo.ts`
 * cũng gọi cho các bàn đo khác.
 *
 * ─── ĐO — HAI ĐỒNG HỒ, KHÔNG PHẢI MỘT (phát hiện giữa chừng, ghi lại) ────────
 * Đề bài xin `process.cpuUsage()`. Chạy thử trên máy Windows này thì số ra TOÀN
 * bội số của ~15,6ms (15/32/47/62…) — đúng dấu hiệu kinh điển của
 * `GetProcessTimes` trên Windows chỉ có độ phân giải ~64Hz (~15,6ms/nấc), KHÔNG
 * phải CPU thật của khối đo nhảy bậc như vậy. Tin số đó là tin sai một cách có
 * hệ thống — sai LỆCH LÊN, không phải nhiễu ngẫu nhiên.
 *
 * ⇒ Đo THÊM đồng hồ tường bằng `process.hrtime.bigint()` (độ phân giải ns) làm
 * đối chứng. Khối đo (replay TRƯỚC → dựng dòng log → replay SAU) hoàn toàn ĐỒNG
 * BỘ — không một `await` nào bên trong — nên trong tiến trình Node đơn luồng
 * này, KHÔNG có chỗ nào để I/O hay lịch hện xen vào giữa: đồng hồ tường ≈ CPU
 * thật cho đúng khối này. Bảng dưới in CẢ HAI cột; cột tường là số nên tin, cột
 * cpuUsage giữ lại để đúng những gì đề bài xin và để LỘ RÕ cái bẫy đo lường này
 * cho người đọc sau — xem GIỚI HẠN cuối file, mục 1.
 */
import {
  replay, soDoGhe,
} from '../server/holdem_api.js';
import { bocThamVai } from '../server/holdem/vai.js';
import { bayShop } from '../server/holdem/shop.js';
import { conTrongTran } from '../server/holdem/engine.js';
import { HOLDEM_BALANCE_VERSION, HOLDEM_VERSION, luatCua } from '../config/holdem.js';

type LogVong = Parameters<typeof replay>[1][number];

/** D3: lobby 4–8 ghế — ở đây luôn TRẦN TRÊN (8), cùng hướng "xấu nhất" với map. */
const SO_GHE = 8;
/** `config/holdem.ts` — `CO_MAP_CHON: [8, 12, 16]` (dòng ~257). */
const CO_MAP_CHON = [8, 12, 16] as const;
/** ≥20 theo yêu cầu — G4 của montecarlo dạy bài học "N nhỏ nuốt tín hiệu". */
const SO_SEED = 20;
/** Trần CPU/lượt gọi của Cloudflare Workers free (developers.cloudflare.com/workers/platform/pricing). */
const TRAN_WORKERS_MS = 10;

const LUAT = luatCua(HOLDEM_BALANCE_VERSION);

/** Seed TẤT ĐỊNH — không Math.random (nghiệm thu phải tái lập được). */
function seedCho(coMap: number, i: number): number {
  return ((i + 1) * 2654435761 + coMap * 97) >>> 0;
}

function msTuCpu(d: { user: number; system: number }): number {
  return (d.user + d.system) / 1000; // micro giây → mili giây
}

interface DoVong { cpuMs: number; tuongMs: number; }
interface KetQuaTran {
  seed: number;
  doMoiVong: DoVong[]; // chỉ số 0 = vòng 1
  vongDatDuoc: number; // có thể < coMap nếu trận kết thúc sớm (≤1 ghế còn trong trận)
}

/** Chơi hết MỘT trận, đo quanh cặp replay() của TỪNG vòng. */
function chayMotTran(seed: number, coMap: number): KetQuaTran {
  const ghe = soDoGhe(seed, '', SO_GHE);
  // Y HỆT đoạn `POST /matches` thật — xem docstring đầu file.
  if (coMap >= 12) {
    const vai = bocThamVai(seed, ghe.length);
    for (const [i, g] of ghe.entries()) {
      const v = vai[i];
      if (v) g.vai = v;
    }
  }

  let log: LogVong[] = [];
  const doMoiVong: DoVong[] = [];
  let vongDatDuoc = 0;

  for (let vong = 1; vong <= coMap; vong += 1) {
    const cpu0 = process.cpuUsage();
    const t0 = process.hrtime.bigint();

    // ── dòng ~3910 thật: trạng thái TRƯỚC vòng (log chưa có dòng của vòng này) ──
    const truoc = replay(seed, log, false, ghe, LUAT, 0, false, coMap);

    // Hành động của 'ban': giữ vị thế + mua 1 thẻ chiến thuật nếu shop có.
    const banTruoc = truoc.st.ghe.find((g) => g.id === 'ban')!;
    const shop = bayShop(seed, vong, 'ban', 0, banTruoc.danh_muc, truoc.st.gian_la === true);
    const mua: string[] = shop.chien_thuat[0] ? [shop.chien_thuat[0]] : [];

    log = [...log, { vong, khao_sat_lai: 0, mua, hanh_dong: 'giu_vi_the', them: 0 } as LogVong];

    // ── dòng ~3976 thật: trạng thái SAU khi vòng vừa nộp được thêm vào log ──
    const sau = replay(seed, log, false, ghe, LUAT, 0, false, coMap);

    const cpu1 = process.cpuUsage(cpu0);
    const t1 = process.hrtime.bigint();
    doMoiVong.push({ cpuMs: msTuCpu(cpu1), tuongMs: Number(t1 - t0) / 1e6 });
    vongDatDuoc = vong;

    const conSong = sau.st.ghe.filter((g) => conTrongTran(g)).length;
    if (conSong <= 1) break; // trận kết thúc sớm — daKetThuc() cũng dừng ở đây
  }

  return { seed, doMoiVong, vongDatDuoc };
}

function phanVi(xs: readonly number[], p: number): number {
  if (xs.length === 0) return NaN;
  const s = [...xs].sort((a, b) => a - b);
  const idx = (s.length - 1) * p;
  const lo = Math.floor(idx), hi = Math.ceil(idx);
  if (lo === hi) return s[lo]!;
  return s[lo]! + (s[hi]! - s[lo]!) * (idx - lo);
}

console.log(`ĐO CPU/VÒNG NỘP — engine=${HOLDEM_VERSION} balance=${HOLDEM_BALANCE_VERSION} `
  + `bàn ${SO_GHE} ghế · ${SO_SEED} seed/map · trần Workers free = ${TRAN_WORKERS_MS}ms CPU/lượt`);
console.log('');

const bangTong: {
  coMap: number; ketThucSomSoLan: number;
  cuoiP50Tuong: number; cuoiP95Tuong: number; cuoiMaxTuong: number;
  cuoiMaxCpu: number;
  toanBoMaxTuong: number; toanBoMaxTuongVong: number;
}[] = [];

for (const coMap of CO_MAP_CHON) {
  const tranMoiSeed: KetQuaTran[] = [];
  for (let i = 0; i < SO_SEED; i += 1) {
    tranMoiSeed.push(chayMotTran(seedCho(coMap, i), coMap));
  }

  const ketThucSom = tranMoiSeed.filter((t) => t.vongDatDuoc < coMap);
  // Chỉ số liệu VÒNG CUỐI của trận nào ĐI HẾT map mới có nghĩa (so sánh cùng độ dài log).
  const diHetMap = tranMoiSeed.filter((t) => t.vongDatDuoc === coMap);
  const tuongVongCuoi = diHetMap.map((t) => t.doMoiVong[t.doMoiVong.length - 1]!.tuongMs);
  const cpuVongCuoi = diHetMap.map((t) => t.doMoiVong[t.doMoiVong.length - 1]!.cpuMs);

  let toanBoMaxTuong = -Infinity, toanBoMaxTuongVong = -1;
  for (const t of tranMoiSeed) {
    for (let v = 0; v < t.doMoiVong.length; v += 1) {
      if (t.doMoiVong[v]!.tuongMs > toanBoMaxTuong) {
        toanBoMaxTuong = t.doMoiVong[v]!.tuongMs; toanBoMaxTuongVong = v + 1;
      }
    }
  }

  bangTong.push({
    coMap,
    ketThucSomSoLan: ketThucSom.length,
    cuoiP50Tuong: phanVi(tuongVongCuoi, 0.5),
    cuoiP95Tuong: phanVi(tuongVongCuoi, 0.95),
    cuoiMaxTuong: tuongVongCuoi.length ? Math.max(...tuongVongCuoi) : NaN,
    cuoiMaxCpu: cpuVongCuoi.length ? Math.max(...cpuVongCuoi) : NaN,
    toanBoMaxTuong,
    toanBoMaxTuongVong,
  });

  if (ketThucSom.length > 0) {
    console.log(`⚠ map ${coMap}: ${ketThucSom.length}/${SO_SEED} trận kết thúc SỚM `
      + `(≤1 ghế còn trong trận) — không tính vào thống kê VÒNG CUỐI. `
      + `Vòng đạt được: ${ketThucSom.map((t) => t.vongDatDuoc).join(', ')}`);
  }
}

console.log('## Vòng CUỐI mỗi map — p50/p95/max (ms), gộp cả cặp replay TRƯỚC+SAU');
console.log('');
console.log('| map (ô) | seed đi hết map | p50 tường (ms) | p95 tường (ms) | max tường (ms) | '
  + 'max cpuUsage (ms) | max tường/trần10ms |');
console.log('|---|---|---|---|---|---|---|');
for (const r of bangTong) {
  const diHet = SO_SEED - r.ketThucSomSoLan;
  console.log(`| ${r.coMap} | ${diHet}/${SO_SEED} | ${r.cuoiP50Tuong.toFixed(3)} | `
    + `${r.cuoiP95Tuong.toFixed(3)} | ${r.cuoiMaxTuong.toFixed(3)} | ${r.cuoiMaxCpu.toFixed(3)} | `
    + `${(r.cuoiMaxTuong / TRAN_WORKERS_MS).toFixed(3)}× |`);
}
console.log('');
console.log('## Max TUYỆT ĐỐI trên toàn trận (mọi vòng, mọi seed) mỗi map — đồng hồ tường');
console.log('');
console.log('| map (ô) | max (ms) | ở vòng | max/trần10ms |');
console.log('|---|---|---|---|');
for (const r of bangTong) {
  console.log(`| ${r.coMap} | ${r.toanBoMaxTuong.toFixed(3)} | ${r.toanBoMaxTuongVong} | `
    + `${(r.toanBoMaxTuong / TRAN_WORKERS_MS).toFixed(3)}× |`);
}
console.log('');

const dinhMax = Math.max(...bangTong.map((r) => r.toanBoMaxTuong));
if (dinhMax > TRAN_WORKERS_MS) {
  console.log(`✗ VƯỢT trần 10ms Workers free ở ít nhất một vòng (đỉnh đo được ${dinhMax.toFixed(3)}ms, đồng hồ tường).`);
} else {
  console.log(`✓ Dưới trần 10ms Workers free ở mọi vòng đo được (đỉnh ${dinhMax.toFixed(3)}ms, đồng hồ tường).`);
}

console.log('');
console.log('⚠⚠ GIỚI HẠN CỦA PHÉP ĐO NÀY (đọc trước khi trích số ra ngoài):');
console.log('  1. Máy đo là máy dev cục bộ (Windows), KHÔNG PHẢI isolate V8 của Cloudflare');
console.log('     Workers. Và trên MÁY NÀY, process.cpuUsage() lượng tử hoá theo bậc ~15,6ms');
console.log('     (GetProcessTimes độ phân giải thấp) — cột "max cpuUsage" ở bảng trên vì vậy');
console.log('     THỔI PHỒNG có hệ thống, không dùng được. Cột "tường" (hrtime, đồng bộ nên');
console.log('     ≈ CPU thật của khối này) đáng tin hơn NHIỀU LẦN, nhưng vẫn là máy dev, không');
console.log('     phải Workers isolate — chỉ dùng để so TƯƠNG ĐỐI (map/vòng nào nặng hơn bao');
console.log('     nhiêu lần), không phải số tuyệt đối sẽ thấy trên Workers thật.');
console.log("  2. Ghế 'ban' GIỮ VỊ THẾ + mua 1 thẻ CHIẾN THUẬT mỗi vòng — KHÔNG mô phỏng");
console.log('     lệnh NAV (mua Tài sản bằng tiền, có mốc/bp), đảo danh mục, khoá, bán khống,');
console.log('     hay chuỗi cược nhiều bước. Đây là một hành động THẬT nhưng KHÔNG PHẢI xấu');
console.log('     nhất có thể — số đo được là cận dưới của chi phí CPU, không phải trần tuyệt đối.');
console.log('  3. moBangCho/duBaoCho/khopCho đều để mặc định (0/false/[]) — không đo phí');
console.log('     "mở Bảng điện tử" (LUẬT 3) hay khớp lệnh giữa vòng.');
console.log('');
console.log('(Đây là script ĐO, không phải GATE — thoát 0 dù số có vượt trần hay không;');
console.log(' người đọc bảng ở trên quyết định, script không tự phán.)');
process.exit(0);
