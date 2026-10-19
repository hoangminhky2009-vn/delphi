/**
 * ĐO CƠ CHẾ ĐI VỐN — GIỮ VỊ THẾ · CƯỢC · BỎ BÀI (chẩn đoán D35).
 *
 * Chạy: npx tsx scripts/holdem_divon.ts [số_trận] [số_ghế] [cỡ_map]
 *   env DIVON_BO_CAMKET=1 → BỎ nhánh `chonCamKet` ở harness (xem "PHÉP THỬ 0").
 *
 * ─── CÂU HỎI ĐANG TRẢ LỜI ──────────────────────────────────────────────────
 * Founder 27/07: "cơ chế đi vốn hiện chưa ảnh hưởng nhiều đến kết quả trận".
 * D35 chẩn đoán từ code: hạng TRONG VÒNG xếp theo `pnl_bp` (phần trăm), mà
 * phần trăm không phụ thuộc số vốn cam kết — nên cam kết chỉ quyết định TRANH
 * POT NÀO chứ không làm thắng dễ hơn.
 *
 * ⚠ D35 là chẩn đoán ĐỌC TỪ CODE, chưa từng được đo. Script này đo, và nếu số
 * đi ngược thì SỐ THẮNG.
 *
 * ─── VÌ SAO KHÔNG DÙNG `holdem_montecarlo.ts` ──────────────────────────────
 * Bể bot ở đó khác nhau ở chỗ CHỌN LÁ và dùng CHUNG một chính sách vốn. Đo cam
 * kết trên bể đó là đo một biến gần như hằng số — đúng lớp lỗi D2 (gate cắt lỗ
 * đo trên đàn bot chưa con nào hay bỏ) và D5 (thẻ không ai cầm). Script này
 * chạy trên `BOT_DI_VON`: sáu triết lý vốn khác nhau, DÙNG CHUNG một chính
 * sách chọn lá, nên chênh lệch đo được chỉ có thể đến từ cách đi vốn.
 *
 * ─── PHÉP THỬ 0: `chonCamKet` CÓ THẬT SỰ CHẠY KHÔNG ────────────────────────
 * `bots.ts` từng khai `chonCamKet` là CODE CHẾT (26/07). Đợt trước đã nối nó
 * vào Monte Carlo. Trước khi tin bất kỳ con số nào dưới đây, phải chứng minh
 * nhánh ấy CÓ HẬU QUẢ. Hai bằng chứng độc lập:
 *   (1) đếm số lượt mà quyết định của `chonCamKet` KHÁC quyết định mà
 *       `chonCuoc` sẽ đưa ra — in ở cuối;
 *   (2) chạy lại với `DIVON_BO_CAMKET=1`. Bảng GIỐNG HỆT = cơ chế trang trí
 *       (bẫy số 1 của repo, đã dính 6 lần).
 */
import {
  chiaQuyVong, daKetThuc, giaiQuyetVong, maxTaiSanCua, taoTran, xepHang, type Ghe,
} from '../server/holdem/engine.js';
import { BOT_DI_VON, botTaiCoCau, timBot, type BoiCanh } from '../server/holdem/bots.js';
import { bayShop } from '../server/holdem/shop.js';
import { oCongKhai } from '../server/holdem/map.js';
import {
  HOLDEM_BALANCE_VERSION, HOLDEM_DECISIONS, HOLDEM_MATCH, HOLDEM_VERSION,
} from '../config/holdem.js';

const SO_TRAN = Number(process.argv[2] ?? 12000);
const SO_GHE = Math.max(2, Number(process.argv[3] ?? 5) | 0);
const CO_MAP = Math.max(4, Number(process.argv[4] ?? 8) | 0);
const BO_CAMKET = process.env['DIVON_BO_CAMKET'] === '1';

/**
 * BẬT LUẬT v8 (cam kết = đòn bẩy) THẬT SỰ, thay vì ước lượng bậc một ở mục (e).
 *
 * Bản đầu của script này in `balance=balance-v8-donbay` ở dòng tiêu đề nhưng
 * `taoTran` lại KHÔNG nhận cờ `donBayCamKet` — nên bảng chính đo luật v7 trong
 * khi tiêu đề khai v8. Đọc lướt là kết luận ngược. Nay cờ đi qua đúng đường và
 * dòng tiêu đề in CHÍNH cờ đang chạy, không in hằng số phiên bản.
 */
const DON_BAY = process.env['DIVON_DON_BAY'] === '1';

const POOL = BOT_DI_VON;

// ── Kiểu dữ liệu thu thập ──────────────────────────────────────────────────

interface DongVong {
  ghe_id: string;
  cam_ket: number;
  pnl_bp: number;
  da_cat_lo: boolean;
}
interface MotTran {
  vong: DongVong[][];
  quy: number[];
  botCua: Map<string, string>;
  hang: readonly string[];
  vonCuoi: Map<string, number>;
}

interface ThongKe {
  tran: number; tongHang: number; nhat: number; chay: number;
  tongCamKet: number; tongVonCuoi: number;
  hangPhanThuc: number;   // hạng cộng dồn ở kịch bản đòn bẩy (câu e)
}
const tk = new Map<string, ThongKe>();
for (const b of POOL) {
  tk.set(b.id, {
    tran: 0, tongHang: 0, nhat: 0, chay: 0,
    tongCamKet: 0, tongVonCuoi: 0, hangPhanThuc: 0,
  });
}

/** Bằng chứng (1) cho PHÉP THỬ 0. */
let soLanHoiCamKet = 0;
let soLanCamKetDoiHanhDong = 0;

/** Cặp (tổng cam kết, hạng) để tính tương quan ở câu (a). */
const cap: { camKet: number; hang: number; von: number; zCamKet: number; zHang: number }[] = [];

// ── Chạy một trận ──────────────────────────────────────────────────────────

function chayTran(seed: number, botIds: readonly string[]): MotTran {
  const bots = botIds.map((id) => timBot(id)!);
  let st = taoTran(seed, botIds.map((id, i) => ({
    id: `g${i}`, loai: 'bot' as const,
    bac_rank: ['Đồng', 'Bạc', 'Vàng'][(seed + i) % 3]!,
    danh_muc: { tai_san: [], chien_thuat: [] },
  })), {
    luatVon: true, dacQuyen: true,
    donBayCamKet: DON_BAY, daDangHoaTranTaiSan: DON_BAY,
  }, CO_MAP);

  const vong: DongVong[][] = [];
  const quy: number[] = [];
  let guard = 0;

  while (!daKetThuc(st) && guard < 40) {
    guard += 1;
    const stVong = st;
    const o = stVong.map.o[stVong.vong - 1]!;
    const ctxCua = (g: Ghe): BoiCanh => ({
      seed, vong: stVong.vong, o: oCongKhai(o) as never, oThat: o,
      oTruoc: stVong.map.o[stVong.vong - 2], ghe: g,
      shop: bayShop(seed, stVong.vong, g.id, 0, g.danh_muc),
      soNguoiSong: stVong.ghe.filter((x) => !x.da_chay).length,
      // Bot phải được hưởng trần đã nới, không thì lá Đa Dạng Hoá không đo được.
      maxTaiSan: maxTaiSanCua(stVong, g),
    });

    // Nhịp 1 — tái cơ cấu.
    const ghe = stVong.ghe.map((g, i) => {
      if (g.da_chay) return g;
      const r = botTaiCoCau(bots[i]!, ctxCua(g));
      return { ...g, danh_muc: r.danh_muc, luot_khao_sat: r.luot_khao_sat };
    });
    st = { ...stVong, ghe };
    const stCuoc = st;

    /*
     * ⚠ HARNESS PHẢI GIỐNG HỆT `holdem_montecarlo.ts` và `replay()` của API:
     * lượt ĐẦU mỗi vòng là Ý ĐỊNH (`chonCamKet`), các lượt sau là PHẢN ỨNG
     * (`chonCuoc`) — D30. Lệch một chữ ở đây là đo một trò khác với trò người
     * chơi đang chơi, và đó là kiểu sai tệ nhất vì nó vẫn ra số đẹp.
     */
    const daHoiBot = new Map<string, number>();
    const buoc = giaiQuyetVong(stCuoc, (cuoc) => {
      const g = stCuoc.ghe.find((x) => x.id === cuoc.ghe_id)!;
      const bot = bots[stCuoc.ghe.indexOf(g)]!;
      const ctx = ctxCua(g);
      const soLan = daHoiBot.get(g.id) ?? 0;
      daHoiBot.set(g.id, soLan + 1);
      const mac = bot.chonCuoc(cuoc, ctx);

      if (soLan === 0 && !BO_CAMKET) {
        soLanHoiCamKet += 1;
        const yDinh = bot.chonCamKet(ctx);
        if (yDinh.hanh_dong === 'cat_lo') {
          if (mac.loai !== 'bo') soLanCamKetDoiHanhDong += 1;
          return { loai: 'bo' as const };
        }
        if (yDinh.hanh_dong === 'tang_cam_ket' && yDinh.them > 0
          && cuoc.duoc.includes('to')) {
          const them = Math.max(cuoc.con_thieu + 1, yDinh.them);
          if (mac.loai !== 'to' || mac.them !== them) soLanCamKetDoiHanhDong += 1;
          return { loai: 'to' as const, them };
        }
        if (mac.loai !== 'theo' && yDinh.hanh_dong === 'giu_vi_the') {
          // Ý định "giữ" KHÔNG ghi đè `chonCuoc` ở harness hiện hành — ghi nhận
          // để biết còn bao nhiêu ý định bị nuốt, đừng lẫn với số ở trên.
        }
      }
      return mac;
    });

    vong.push(buoc.ketQua.ket_qua.map((r) => ({
      ghe_id: r.ghe_id, cam_ket: r.cam_ket, pnl_bp: r.pnl_bp, da_cat_lo: r.da_cat_lo,
    })));
    quy.push(buoc.ketQua.quy_vong);
    st = buoc.trangThai;
  }

  const botCua = new Map<string, string>();
  const vonCuoi = new Map<string, number>();
  for (let i = 0; i < botIds.length; i += 1) botCua.set(`g${i}`, botIds[i]!);
  for (const g of st.ghe) vonCuoi.set(g.id, g.von);
  return { vong, quy, botCua, hang: xepHang(st), vonCuoi };
}

// ── PHẢN THỰC TẾ (câu e) — CAM KẾT = ĐÒN BẨY, tính TRÊN GIẤY ───────────────

/**
 * D35 hướng 1: cam kết càng lớn thì PnL% của CHÍNH MÌNH càng bị nhân lên.
 *
 * ⚠ ĐÂY LÀ ƯỚC LƯỢNG BẬC MỘT, KHÔNG PHẢI MÔ PHỎNG LẠI. Giữ NGUYÊN mọi hành
 * động bot đã chơi, nguyên Quỹ vòng, nguyên ai-tranh-pot; chỉ đổi DUY NHẤT
 * thứ tự chia Quỹ vòng: xếp theo `pnl_bp × đòn_bẩy` thay vì `pnl_bp`.
 *
 * Ba thứ CỐ Ý không mô hình hoá, khai rõ để không ai đọc quá số:
 *  · phản hồi hành vi — bot thật sẽ đi vốn khác hẳn khi biết cam kết = đòn bẩy;
 *  · cháy tài khoản đổi theo (đòn bẩy làm cháy sớm hơn, tức bảng thật sẽ GIÃN
 *    RỘNG HƠN số dưới đây, không hẹp hơn);
 *  · side pot — dùng xấp xỉ "ai còn cam kết và không cắt lỗ thì tranh cả quỹ".
 * Vì tính CHÊNH LỆCH so với nền dựng bằng CÙNG một xấp xỉ, phần sai số chung
 * triệt tiêu phần lớn. Con số ra là CẬN DƯỚI của độ giãn.
 */
const DON_BAY_TRAN = 4;   // kẹp trần: cam kết gấp ≥4 lần nền thì thôi nhân tiếp

function donBay(camKet: number): number {
  const r = camKet / HOLDEM_MATCH.CAM_KET_NEN;
  return Math.max(0.25, Math.min(DON_BAY_TRAN, r));
}

/** Chia lại Quỹ vòng theo một thứ tự cho trước, trả map ghe_id → phần nhận. */
function chia(quy: number, xep: readonly string[]): Map<string, number> {
  const phan = chiaQuyVong(quy, xep.length);
  const m = new Map<string, number>();
  for (let i = 0; i < xep.length; i += 1) m.set(xep[i]!, phan[i] ?? 0);
  return m;
}

/** Vốn cuối ở kịch bản đòn bẩy = vốn thật + tổng chênh lệch chia quỹ mỗi vòng. */
function vonPhanThuc(t: MotTran): Map<string, number> {
  const delta = new Map<string, number>();
  for (let v = 0; v < t.vong.length; v += 1) {
    const hang = t.vong[v]!;
    const quy = t.quy[v] ?? 0;
    if (quy <= 0) continue;
    const duTranh = hang.filter((r) => !r.da_cat_lo && r.cam_ket > 0);
    if (duTranh.length === 0) continue;

    const nen = [...duTranh].sort((a, b) => (b.pnl_bp - a.pnl_bp)
      || (a.ghe_id < b.ghe_id ? -1 : 1)).map((r) => r.ghe_id);
    const bay = [...duTranh].sort((a, b) =>
      (b.pnl_bp * donBay(b.cam_ket) - a.pnl_bp * donBay(a.cam_ket))
      || (a.ghe_id < b.ghe_id ? -1 : 1)).map((r) => r.ghe_id);

    const cNen = chia(quy, nen);
    const cBay = chia(quy, bay);
    for (const r of duTranh) {
      delta.set(r.ghe_id,
        (delta.get(r.ghe_id) ?? 0) + (cBay.get(r.ghe_id) ?? 0) - (cNen.get(r.ghe_id) ?? 0));
    }
  }
  const ra = new Map<string, number>();
  for (const [id, von] of t.vonCuoi) ra.set(id, von + (delta.get(id) ?? 0));
  return ra;
}

// ── Vòng chạy chính ────────────────────────────────────────────────────────

console.log(`ĐO CƠ CHẾ ĐI VỐN (D35) — ${SO_TRAN} trận`);
console.log(`engine=${HOLDEM_VERSION} balance=${HOLDEM_BALANCE_VERSION} `
  + `map=${CO_MAP} ô · bàn ${SO_GHE} ghế · bể ${POOL.length} bot đi vốn`);
console.log(`LUẬT ĐANG CHẠY: đòn bẩy cam kết = ${DON_BAY ? 'BẬT (v8)' : 'TẮT (nền v7)'}`
  + `  ·  đặt DIVON_DON_BAY=1 để bật`);
if (BO_CAMKET) console.log('⚠ DIVON_BO_CAMKET=1 — nhánh chonCamKet ĐÃ BỊ BỎ.');
console.log('');

for (let i = 0; i < SO_TRAN; i += 1) {
  const ids: string[] = [];
  // 6 bot / 5 ghế: mỗi trận vắng đúng một con, xoay vòng → tải đều tuyệt đối.
  for (let k = 0; k < SO_GHE; k += 1) ids.push(POOL[(i * SO_GHE + k) % POOL.length]!.id);

  const t = chayTran((i * 2654435761) >>> 0, ids);
  const vonBay = vonPhanThuc(t);

  // Hạng ở kịch bản đòn bẩy: xếp lại theo vốn phản thực. Người đã cháy giữ
  // nguyên vị trí đáy bảng (xepHang xếp cháy dưới người còn sống) — ở đây xấp
  // xỉ bằng cách chỉ xếp lại trong nhóm còn sống.
  const song = t.hang.filter((id) => (t.vonCuoi.get(id) ?? 0) > 0);
  const chay = t.hang.filter((id) => (t.vonCuoi.get(id) ?? 0) <= 0);
  const hangBay = [...song].sort((a, b) => (vonBay.get(b) ?? 0) - (vonBay.get(a) ?? 0))
    .concat(chay);

  const camKetTran = new Map<string, number>();
  for (const v of t.vong) {
    for (const r of v) camKetTran.set(r.ghe_id, (camKetTran.get(r.ghe_id) ?? 0) + r.cam_ket);
  }

  const mau: { camKet: number; hang: number; von: number }[] = [];
  for (let h = 0; h < t.hang.length; h += 1) {
    const gid = t.hang[h]!;
    const bid = t.botCua.get(gid)!;
    const s = tk.get(bid)!;
    s.tran += 1; s.tongHang += h + 1;
    if (h === 0) s.nhat += 1;
    const von = t.vonCuoi.get(gid) ?? 0;
    if (von <= 0) s.chay += 1;
    s.tongCamKet += camKetTran.get(gid) ?? 0;
    s.tongVonCuoi += von;
    s.hangPhanThuc += hangBay.indexOf(gid) + 1;
    mau.push({ camKet: camKetTran.get(gid) ?? 0, hang: h + 1, von });
  }

  // Chuẩn hoá TRONG TRẬN trước khi gộp: mỗi trận có mức quỹ và số vòng khác
  // nhau, nên tương quan thô sẽ lẫn hiệu ứng trận vào hiệu ứng chiến thuật.
  const tbC = mau.reduce((s, m) => s + m.camKet, 0) / mau.length;
  const tbH = mau.reduce((s, m) => s + m.hang, 0) / mau.length;
  const sdC = Math.sqrt(mau.reduce((s, m) => s + (m.camKet - tbC) ** 2, 0) / mau.length) || 1;
  const sdH = Math.sqrt(mau.reduce((s, m) => s + (m.hang - tbH) ** 2, 0) / mau.length) || 1;
  for (const m of mau) {
    cap.push({
      camKet: m.camKet, hang: m.hang, von: m.von,
      zCamKet: (m.camKet - tbC) / sdC, zHang: (m.hang - tbH) / sdH,
    });
  }
}

// ── Báo cáo ────────────────────────────────────────────────────────────────

function pearson(xs: readonly number[], ys: readonly number[]): number {
  const n = xs.length;
  const mx = xs.reduce((a, b) => a + b, 0) / n;
  const my = ys.reduce((a, b) => a + b, 0) / n;
  let sxy = 0; let sxx = 0; let syy = 0;
  for (let i = 0; i < n; i += 1) {
    const dx = xs[i]! - mx; const dy = ys[i]! - my;
    sxy += dx * dy; sxx += dx * dx; syy += dy * dy;
  }
  return sxy / (Math.sqrt(sxx * syy) || 1);
}

const bang = [...tk.entries()]
  .map(([id, s]) => ({
    id,
    label: POOL.find((b) => b.id === id)!.label,
    tran: s.tran,
    hangTB: s.tongHang / s.tran,
    hangBay: s.hangPhanThuc / s.tran,
    thang: (s.nhat / s.tran) * 100,
    chay: (s.chay / s.tran) * 100,
    camKet: s.tongCamKet / s.tran,
    von: s.tongVonCuoi / s.tran,
  }))
  .sort((a, b) => a.hangTB - b.hangTB);

console.log('BOT                 TRẬN   HẠNG TB   THẮNG%   CHÁY%   CAM KẾT TB   VỐN CUỐI TB');
for (const r of bang) {
  console.log(
    r.label.padEnd(20) + String(r.tran).padStart(5)
    + r.hangTB.toFixed(3).padStart(10) + r.thang.toFixed(1).padStart(9)
    + r.chay.toFixed(1).padStart(8) + Math.round(r.camKet).toLocaleString('en').padStart(13)
    + Math.round(r.von).toLocaleString('en').padStart(15));
}

const dai = bang[bang.length - 1]!.hangTB - bang[0]!.hangTB;
console.log(`\n(b) DẢI HẠNG giữa ${POOL.length} triết lý vốn: ${dai.toFixed(3)} hạng `
  + `(${bang[0]!.label} ${bang[0]!.hangTB.toFixed(3)} → `
  + `${bang[bang.length - 1]!.label} ${bang[bang.length - 1]!.hangTB.toFixed(3)})`);
console.log(`    Ngưỡng founder đặt: dải ≤0,15 hạng ⇒ ba nút giữ/cược/bỏ là TRANG TRÍ.`);

const viTriAllIn = bang.findIndex((b) => b.id === 'all_in_vo_nao') + 1;
console.log(`(c) all_in_vo_nao xếp thứ ${viTriAllIn}/${bang.length} `
  + `(hạng TB ${bang.find((b) => b.id === 'all_in_vo_nao')!.hangTB.toFixed(3)}, `
  + `cháy ${bang.find((b) => b.id === 'all_in_vo_nao')!.chay.toFixed(1)}%)`);

console.log('\n(a) TƯƠNG QUAN cam kết ↔ kết quả');
console.log(`    r(tổng cam kết, hạng cuối)      = `
  + pearson(cap.map((c) => c.camKet), cap.map((c) => c.hang)).toFixed(4)
  + '   (âm = cam kết nhiều thì hạng TỐT hơn)');
console.log(`    r(z-cam kết, z-hạng) trong trận = `
  + pearson(cap.map((c) => c.zCamKet), cap.map((c) => c.zHang)).toFixed(4));
console.log(`    r(tổng cam kết, vốn cuối)       = `
  + pearson(cap.map((c) => c.camKet), cap.map((c) => c.von)).toFixed(4));

console.log('\n(e) PHẢN THỰC TẾ — pnl_bp × đòn bẩy theo cam kết (ước lượng bậc một)');
const bangBay = [...bang].sort((a, b) => a.hangBay - b.hangBay);
console.log('BOT                 HẠNG TB NỀN   HẠNG TB ĐÒN BẨY   CHÊNH');
for (const r of bangBay) {
  const d = r.hangBay - r.hangTB;
  console.log(r.label.padEnd(20) + r.hangTB.toFixed(3).padStart(13)
    + r.hangBay.toFixed(3).padStart(18)
    + (d >= 0 ? '+' : '') + d.toFixed(3).padStart(8));
}
const daiBay = bangBay[bangBay.length - 1]!.hangBay - bangBay[0]!.hangBay;
console.log(`    DẢI HẠNG: nền ${dai.toFixed(3)} → đòn bẩy ${daiBay.toFixed(3)} `
  + `(×${(daiBay / (dai || 1)).toFixed(2)})`);

console.log('\n(PHÉP THỬ 0) chonCamKet có hậu quả không:');
console.log(`    số lượt hỏi chonCamKet          = ${soLanHoiCamKet.toLocaleString('en')}`);
console.log(`    số lượt nó ĐỔI hành động thật   = ${soLanCamKetDoiHanhDong.toLocaleString('en')}`
  + `  (${((soLanCamKetDoiHanhDong / (soLanHoiCamKet || 1)) * 100).toFixed(1)}%)`);
console.log('    Chạy lại với DIVON_BO_CAMKET=1: bảng GIỐNG HỆT = cơ chế trang trí.');
