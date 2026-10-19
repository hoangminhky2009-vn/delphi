/**
 * ĐO ĐỘ KHỚP GIỮA MÔ HÌNH THẾ GIỚI CỦA BOT VÀ ENGINE THẬT.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * VÌ SAO CẦN SCRIPT NÀY
 *
 * Gate G2 (gradient kỹ năng) và G4 (tin tức đẻ ra kỹ năng) đỏ suốt nhiều phiên.
 * Mỗi lần đều bị chẩn đoán thành "tham số cân bằng sai" rồi đi quét tham số, và
 * lần nào cũng thất bại. Ngày 26/07 tìm ra bot "Biết trước" đọc nhầm ô đã bị
 * che nên KHÔNG HỀ biết trước — sửa xong gate vẫn đỏ.
 *
 * Dấu hiệu còn lại thì ngược đời và lặp lại ở MỌI cấu hình đã quét: bot PHỚT
 * MỌI TIN xếp trên mọi bot đọc tin khác, kể cả oracle đã sáng mắt. Nếu tín hiệu
 * chỉ đơn thuần YẾU thì hai bot phải NGANG nhau; đọc tin mà TỆ HƠN bịt tai thì
 * cái được cộng vào kỳ vọng đang có hại.
 *
 * Giả thuyết: mô hình `kyVongVongNay` của bot LỆCH so với `dungChuoi` của engine.
 * Engine cộng khoảng 12 nguồn; mô hình bot cộng 3. Cộng đúng một số hạng tin tức
 * lên một cái nền sai thì con số ra không đo được lợi thế riêng nữa.
 *
 * Script này KHÔNG sửa gì. Nó chỉ trả lời ba câu bằng số:
 *
 *   1. Dự đoán của bot có tương quan với PnL thật của engine không?
 *   2. Kiểu đọc tin nào khớp NHẤT? (nếu 'phot' khớp hơn 'biet_that' thì số hạng
 *      tin tức đang làm mô hình TỆ ĐI — chứng minh thẳng cho dấu hiệu ngược đời)
 *   3. Từng số hạng engine có mà bot thiếu đóng góp bao nhiêu?
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * ĐỌC KẾT QUẢ CHO ĐÚNG
 *
 * Nhiễu (`symmetricNoise`, ±150–400 bp mỗi mã mỗi vòng) nằm TRONG PnL thật và
 * KHÔNG thể dự đoán — không mô hình nào đạt tương quan 1,0, kể cả mô hình hoàn
 * hảo. Nên con số tuyệt đối không nói lên nhiều. Thứ có nghĩa là SO SÁNH giữa
 * các kiểu đọc tin trên CÙNG một tập bối cảnh, vì nhiễu y hệt nhau ở mọi kiểu.
 *
 * Chạy:  npx tsx scripts/holdem_domohinh.ts [số_trận]
 */
import {
  HOLDEM_BALANCE_VERSION, HOLDEM_DECISIONS, TAI_SAN, CHIEN_THUAT, NHA_CAI, luatCua, type ChienThuatId,
} from '../config/holdem.js';
import {
  taoTran, daKetThuc, dungChuoi, type TrangThaiTran, type Ghe,
} from '../server/holdem/engine.js';
import { kyVongVongNay, type BoiCanh, type KieuDocTin } from '../server/holdem/bots.js';
import { oCongKhai } from '../server/holdem/map.js';
import { rngAt } from '../server/sandbox/rng.js';

const SO_TRAN = Number(process.argv[2] ?? 3000);

/** Bốn kiểu đọc tin — cùng bối cảnh, cùng danh mục, chỉ khác niềm tin vào tin. */
const KIEU: readonly KieuDocTin[] = ['phot', 'tin', 'hieu_chinh', 'biet_that'];

interface Cap { duDoan: number; that: number }
const mau: Record<string, Cap[]> = Object.fromEntries(KIEU.map((k) => [k, []]));

/** Tương quan Pearson. Trả 0 nếu một vế không đổi (tránh chia 0). */
function tuongQuan(xs: number[], ys: number[]): number {
  const n = xs.length;
  if (n < 2) return 0;
  const mx = xs.reduce((a, b) => a + b, 0) / n;
  const my = ys.reduce((a, b) => a + b, 0) / n;
  let sxy = 0; let sxx = 0; let syy = 0;
  for (let i = 0; i < n; i += 1) {
    const dx = xs[i]! - mx; const dy = ys[i]! - my;
    sxy += dx * dy; sxx += dx * dx; syy += dy * dy;
  }
  return sxx === 0 || syy === 0 ? 0 : sxy / Math.sqrt(sxx * syy);
}

function tb(v: number[]): number {
  return v.length === 0 ? 0 : v.reduce((a, b) => a + b, 0) / v.length;
}

function doLech(v: number[]): number {
  const m = tb(v);
  return Math.sqrt(tb(v.map((x) => (x - m) ** 2)));
}

/*
 * Danh mục NGẪU NHIÊN chứ không lấy từ bot đang chơi. Cố ý: nếu lấy danh mục do
 * bot tự chọn thì tập mẫu bị chính mô hình sai lọc trước — bot tránh đúng những
 * danh mục mà nó định giá tệ nhất, nên phép đo sẽ tự khen mô hình. Rải đều mọi
 * danh mục mới đo được mô hình trên toàn miền.
 *
 * CÓ chèn danh mục xếp CHỒNG cùng một mã (2–3 bản sao) — đó là chỗ engine áp
 * `heSoStackBp` giảm dần (×1 → ×1,6 → ×2,0) còn mô hình bot cộng tuyến tính,
 * nên bỏ qua nhóm này là bỏ sót đúng chỗ lệch to nhất.
 */
function danhMucNgauNhien(seed: number, vong: number) {
  const r = rngAt(seed, 'domohinh_dm', vong);
  const so = r.range(1, 4);
  const taiSan: string[] = [];
  for (let i = 0; i < so; i += 1) {
    const ts = TAI_SAN[rngAt(seed, 'domohinh_ts', vong, i).range(0, TAI_SAN.length - 1)]!;
    taiSan.push(ts.id);
  }
  // 1/3 số mẫu ép xếp chồng để nhóm stack không bị thưa.
  if (rngAt(seed, 'domohinh_stack', vong).chanceBp(3300) && taiSan[0]) {
    taiSan.push(taiSan[0], taiSan[0]);
  }
  const chienThuat: ChienThuatId[] = [];
  if (rngAt(seed, 'domohinh_cthd', vong).chanceBp(5000)) {
    const ct = CHIEN_THUAT[rngAt(seed, 'domohinh_ct', vong).range(0, CHIEN_THUAT.length - 1)];
    if (ct) chienThuat.push(ct.id);
  }
  return { tai_san: taiSan, chien_thuat: chienThuat };
}

console.log(`Đo độ khớp mô hình bot ↔ engine — ${SO_TRAN} bối cảnh`);
console.log(`echo ${NHA_CAI.SO_VONG_ECHO} vòng · suy giảm ${NHA_CAI.SUY_GIAM_ECHO_BP} bp · tin giả ${NHA_CAI.TY_LE_TIN_GIA_BP} bp\n`);

let boQua = 0;
for (let seed = 1; seed <= SO_TRAN; seed += 1) {
  /*
   * BÀN 5 GHẾ chứ không phải 1. Bàn một ghế thì `daKetThuc` đúng NGAY từ vòng
   * đầu (còn mỗi một người thì trận xong rồi) nên vòng lặp không chạy lần nào
   * và script báo "0 bối cảnh" — bản đầu đã dính đúng vậy, mà phán quyết vẫn
   * nổ trên mẫu rỗng. Ghế g0 là ghế đo; bốn ghế kia chỉ để trận sống.
   */
  /*
   * ⚠ ĐO TRÊN ĐÚNG BỘ LUẬT ĐANG CHẠY — sửa D155. Bản cũ gọi `taoTran` TRẦN
   * (mọi cờ tắt) nên dụng cụ này đo một trò không có mapV28/sức căng/chu kỳ —
   * đúng bẫy D83/D127; mọi con số nó từng in ra trước D155 là số của trò khác.
   */
  let st: TrangThaiTran = taoTran(seed, [0, 1, 2, 3, 4].map((i) => ({
    id: `g${i}`, loai: 'bot' as const, bac_rank: 'Đồng',
    danh_muc: { tai_san: [], chien_thuat: [] },
  })), luatCua(HOLDEM_BALANCE_VERSION), HOLDEM_DECISIONS.MAP_SIZE);

  for (let guard = 0; !daKetThuc(st) && guard < 12; guard += 1) {
    const o = st.map.o[st.vong - 1];
    if (!o) break;
    const dm = danhMucNgauNhien(seed, st.vong);
    if (dm.tai_san.length === 0) { boQua += 1; st = { ...st, vong: st.vong + 1 }; continue; }

    const ghe: Ghe = { ...st.ghe[0]!, danh_muc: dm };
    const that = dungChuoi({ ...st, ghe: [ghe, ...st.ghe.slice(1)] }, ghe, o).pnl_bp;

    const ctx: BoiCanh = {
      seed, vong: st.vong, o: oCongKhai(o) as never, oThat: o,
      oTruoc: st.map.o[st.vong - 2], ghe,
      shop: { tai_san: [], chien_thuat: [] } as never,
      soNguoiSong: 1,
    };
    for (const k of KIEU) mau[k]!.push({ duDoan: kyVongVongNay(ctx, dm, k), that });

    st = { ...st, vong: st.vong + 1 };
  }
}

const n = mau.phot!.length;
console.log(`${n} bối cảnh đo được (bỏ qua ${boQua} vòng danh mục rỗng)\n`);

console.log('KIỂU ĐỌC TIN     TƯƠNG QUAN   SAI SỐ TB    |SAI SỐ| TB');
console.log('─'.repeat(56));
const bang: { k: string; r: number }[] = [];
for (const k of KIEU) {
  const xs = mau[k]!.map((c) => c.duDoan);
  const ys = mau[k]!.map((c) => c.that);
  const r = tuongQuan(xs, ys);
  const saiSo = mau[k]!.map((c) => c.duDoan - c.that);
  bang.push({ k, r });
  console.log(
    `${k.padEnd(16)} ${r.toFixed(4).padStart(10)} ${
      Math.round(tb(saiSo)).toString().padStart(11)} ${
      Math.round(tb(saiSo.map(Math.abs))).toString().padStart(13)}`,
  );
}

const that = mau.phot!.map((c) => c.that);
console.log(`\nPnL thật: trung bình ${Math.round(tb(that))} bp · độ lệch ${Math.round(doLech(that))} bp`);

/*
 * ─── TẦNG QUYẾT ĐỊNH ────────────────────────────────────────────────────────
 *
 * Bảng trên đo MÔ HÌNH. Bảng dưới đo thứ khác hẳn: DÙNG mô hình đó thì được gì.
 *
 * Cần tách hai thứ vì chúng có thể đi ngược nhau, và thực tế đang đi ngược:
 * Monte Carlo cho oracle xếp hạng THUA bot bịt tai, trong khi mô hình oracle
 * khớp engine tốt gần gấp đôi. Dự đoán giỏi hơn mà kết quả tệ hơn thì nút thắt
 * nằm ở chỗ biến dự đoán thành hành động.
 *
 * Quy tắc mô phỏng ở đây cố tình ĐƠN GIẢN NHẤT có thể — cam kết tỷ lệ thuận với
 * kỳ vọng, chặn hai đầu — chứ không gọi `camKetTheoKyVong` thật. Lý do: nếu
 * dùng hàm thật thì không phân biệt được "mô hình tồi" với "hàm quyết định
 * tồi". Quy tắc tối giản này gần như chắc chắn ĐÚNG (kỳ vọng cao thì đặt nhiều
 * hơn), nên nếu mô hình tốt mà nó vẫn ra kết quả tệ thì lỗi ở mô hình; còn nếu
 * nó ra kết quả tốt trong khi bot thật thì tệ, lỗi nằm ở hàm quyết định thật.
 */
console.log('');
console.log('──────── TẦNG QUYẾT ĐỊNH: dùng mô hình đó thì được gì ────────');
console.log('KIỂU ĐỌC TIN     PnL TB/vòng   ĐỘ LỆCH   PnL/rủi ro   % đoán đúng dấu');
console.log('─'.repeat(70));

for (const k of KIEU) {
  const cap = mau[k]!;
  /*
   * Cam kết trong [0,2; 1,0] theo kỳ vọng, bão hoà ở ±2.000 bp. Bão hoà là cố
   * ý: không bão hoà thì một dự đoán ngoại lai khổng lồ chi phối cả phép đo, và
   * đó là đo đuôi phân bố chứ không đo chất lượng mô hình.
   */
  const pnl = cap.map((c) => {
    const camKet = Math.max(0.2, Math.min(1, 0.2 + (0.8 * c.duDoan) / 2000));
    return c.that * camKet;
  });
  const m = tb(pnl);
  const sd = doLech(pnl);
  const dungDau = cap.filter((c) => c.duDoan !== 0 && Math.sign(c.duDoan) === Math.sign(c.that)).length;
  const coDau = cap.filter((c) => c.duDoan !== 0).length;
  console.log(
    `${k.padEnd(16)} ${Math.round(m).toString().padStart(11)} ${
      Math.round(sd).toString().padStart(9)} ${
      (sd === 0 ? 0 : m / sd).toFixed(4).padStart(12)} ${
      (coDau === 0 ? '—' : `${((100 * dungDau) / coDau).toFixed(1)}%`).padStart(16)}`,
  );
}

/*
 * ─── BÃO HOÀ CỦA `manh` ─────────────────────────────────────────────────────
 *
 * `quyetDinhCuoc` quy lợi thế về một con số [0,1]:
 *     manh = clamp((loiTheBp + 1000) / 2000, 0, 1)
 * tức nó BÃO HOÀ ngoài khoảng ±1.000 bp lợi thế. Ngoài khoảng đó, mọi lợi thế
 * đều đọc thành y hệt nhau: 0 hoặc 1.
 *
 * Nếu lợi thế thực tế thường LỚN HƠN 1.000 bp thì `manh` chỉ còn là công tắc
 * bật/tắt, và một mô hình chính xác hơn cũng bấm ra đúng cùng một nút — kỹ
 * năng bị NÉN MẤT ngay tại đây, sau khi mô hình đã làm đúng việc của nó.
 *
 * Ba ngưỡng quyết định trong hàm đó là 0,62 · 0,78 · và so equity với pot odds.
 * Đếm luôn xem có bao nhiêu lượt hai bot khác hẳn nhau về mô hình lại rơi vào
 * CÙNG một nhánh — đó mới là con số nói lên kỹ năng có đi tới hành động không.
 */
console.log('');
console.log('──────── BÃO HOÀ: lợi thế có tới được hành động không ────────');
console.log('KIỂU ĐỌC TIN     |lợi thế| TB   % BÃO HOÀ (|·|>1000)   manh TB');
console.log('─'.repeat(66));

const manhCua: Record<string, number[]> = {};
for (const k of KIEU) {
  const lt = mau[k]!.map((c) => c.duDoan - tb(mau[k]!.map((x) => x.duDoan)));
  const manh = lt.map((v) => Math.max(0, Math.min(1, (v + 1000) / 2000)));
  manhCua[k] = manh;
  const baoHoa = lt.filter((v) => Math.abs(v) > 1000).length;
  console.log(
    `${k.padEnd(16)} ${Math.round(tb(lt.map(Math.abs))).toString().padStart(12)} ${
      `${((100 * baoHoa) / lt.length).toFixed(1)}%`.padStart(21)} ${
      tb(manh).toFixed(3).padStart(9)}`,
  );
}

/*
 * Con số quyết định: bao nhiêu lượt mà oracle và bot bịt tai — hai mô hình
 * cách nhau 0,28 về độ khớp — lại cho ra CÙNG một `manh` sau khi bão hoà.
 * Mỗi lượt như vậy là một lượt thông tin bị vứt đi ở cửa cuối.
 */
const mPhot = manhCua.phot!;
const mThat = manhCua.biet_that!;
const giongNhau = mPhot.filter((v, i) => Math.abs(v - mThat[i]!) < 0.01).length;
const caHaiCuc = mPhot.filter((v, i) => (v === 0 || v === 1) && v === mThat[i]).length;
console.log('');
console.log(`Oracle và bịt-tai ra CÙNG mức mạnh: ${((100 * giongNhau) / mPhot.length).toFixed(1)}% số lượt`);
console.log(`  trong đó cùng bị ĐẨY VỀ CỰC (0 hoặc 1): ${((100 * caHaiCuc) / mPhot.length).toFixed(1)}%`);
console.log(`Vượt ngưỡng tố 0,62 — bịt tai ${((100 * mPhot.filter((v) => v > 0.62).length) / mPhot.length).toFixed(1)}% · oracle ${((100 * mThat.filter((v) => v > 0.62).length) / mThat.length).toFixed(1)}%`);

// ── PHÁN QUYẾT ──────────────────────────────────────────────────────────────
console.log('\n──────── PHÁN QUYẾT ────────');

const rPhot = bang.find((b) => b.k === 'phot')!.r;
const rThat = bang.find((b) => b.k === 'biet_that')!.r;

if (rThat <= rPhot) {
  console.log(`✗ SỐ HẠNG TIN TỨC ĐANG LÀM MÔ HÌNH TỆ ĐI.`);
  console.log(`  Biết thật ${rThat.toFixed(4)} ≤ phớt lờ ${rPhot.toFixed(4)}.`);
  console.log('  Cộng thông tin ĐÚNG vào mà dự đoán KÉM khớp hơn thì cái nền đang sai:');
  console.log('  bot đang định giá trên một thế giới khác với thế giới engine chạy.');
  console.log('  Đây KHÔNG phải vấn đề cân bằng — chỉnh tham số không chạm tới nó.');
} else {
  console.log(`✓ Biết thật khớp hơn phớt lờ (${rThat.toFixed(4)} > ${rPhot.toFixed(4)}),`);
  console.log(`  cách nhau ${(rThat - rPhot).toFixed(4)}. Số hạng tin tức có ích cho mô hình.`);
}

/*
 * Ngưỡng 0,30 không phải con số thiêng. Nó là mốc để phân biệt "mô hình có nắm
 * được hình dạng thế giới" với "mô hình gần như đoán mò": dưới mức đó thì phần
 * lệch giữa kỳ vọng riêng và mặt bằng — thứ DUY NHẤT trả công cho kỹ năng —
 * chủ yếu là sai số mô hình chứ không phải lợi thế thông tin.
 */
if (rThat < 0.30) {
  console.log(`\n⚠ Ngay cả mô hình TỐT NHẤT chỉ đạt tương quan ${rThat.toFixed(4)}.`);
  console.log('  Engine cộng ~12 nguồn, mô hình bot cộng 3. Thiếu (đọc từ dungChuoi):');
  console.log('   · GIA_CUA_THANH_KHOAN_BP — phần bù/phí thanh khoản, TẤT ĐỊNH, dễ bù nhất');
  console.log('   · heSoStackBp — bot cộng TUYẾN TÍNH khi xếp chồng (3 lá = ×3) còn engine');
  console.log('     giảm dần ×1 → ×1,6 → ×2,0. Chính docstring engine cảnh báo lỗi này.');
  console.log('   · nhanhHeQua — chuỗi hệ quả F1/F2, bot không mô hình một chút nào');
  console.log('   · echo cũ hơn 1 vòng — engine giữ 3 vòng, bot chỉ nhìn ô liền trước');
  console.log('   · trượt giá do đông (crowding) và các số hạng thẻ');
}
