/**
 * GATE D4 — PHẢN THÂN: đám đông ngây thơ phải bị PHẠT bởi chính bong bóng mình thổi.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * VÌ SAO LÀ MỘT SCRIPT RIÊNG, KHÔNG NHỒI VÀO holdem_montecarlo.ts:
 *
 * Monte Carlo chính đo "một bot làm ăn thế nào giữa đàn trộn". D4 lại là cơ chế
 * phụ thuộc THÀNH PHẦN LOBBY — nó chỉ kích hoạt khi cả bàn dồn cùng một nhóm mã.
 * Trong bàn trộn thì nó gần như không nổ, nên chạy chung là đo được số 0 rồi kết
 * luận "đạt". Đúng lớp lỗi đã trả giá ở D2: gate đo một chiến lược không tồn tại
 * (chưa bot nào chơi kiểu hay-bỏ) nên phí bao nhiêu cũng ra cùng con số.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * CÁCH ĐO — CÙNG MỘT BÀN, BẬT vs TẮT PHẢN THÂN.
 *
 * ⚠ Bản đầu của script này so "bàn toàn đám đông" với "bàn solo trộn" và ra kết
 * quả NGƯỢC (đám đông giàu hơn solo: vốn 20.364 vs 14.145). Nhưng đó là phép đo
 * BỊ LẪN BIẾN: hai bàn có thành phần khác nhau nên dòng tiền đã khác sẵn — cả bàn
 * cùng hung hăng thì quỹ vòng và nhịp cược khác hẳn bàn có phe thủ, dù phản thân
 * có tồn tại hay không. Cùng lớp lỗi đã làm chẩn đoán sai ba lần ở D1.
 *
 * Phép đo sạch duy nhất: GIỮ NGUYÊN bàn, chỉ đổi MỘT biến — cờ `phanThan` trên
 * object luật (D155: cửa cô lập chuyển từ ENV vào cổng balance, vẫn tồn tại vì
 * đúng lý do này).
 *
 *   ĐÁM ĐÔNG (bật) vs ĐÁM ĐÔNG (tắt) → hiệu số CHÍNH LÀ tác dụng của phản thân.
 *   SOLO     (bật) vs SOLO     (tắt) → phải gần như không đổi, nếu không thì cơ
 *                                      chế đang đánh cả người không dồn theo ai.
 *
 * ⚠ KHÔNG dựng "bot đám đông ngây thơ" biết người khác đang ôm mã gì. `BoiCanh`
 * cố ý KHÔNG mang danh mục ghế khác, vì với NGƯỜI THẬT đó là thông tin ẩn (state
 * DTO chỉ gửi `so_the`, không gửi mã). Cấp cho bot thứ người chơi không thể có là
 * đo một chiến lược không ai chơi được — số đẹp mà vô nghĩa. Đám đông ở đây hình
 * thành bằng THÀNH PHẦN BÀN, nên bot vẫn chỉ dùng thông tin hợp pháp.
 *
 * Script tự gọi lại chính nó trong hai tiến trình con (PT_CHILD=1, cờ đi bằng
 * PT_BAT) rồi so hai bộ số — giữ khuôn hai-tiến-trình để hai lượt đo cô lập nhau.
 *
 * Chạy: npx tsx scripts/holdem_phanthan_gate.ts [soTran] [soGhe]
 */
import { execFileSync } from 'node:child_process';
import {
  BO_LUAT_THEO_PHIEN_BAN, HOLDEM_BALANCE_VERSION, HOLDEM_DECISIONS, HOLDEM_VERSION, luatCua,
} from '../config/holdem.js';
import {
  daKetThuc, giaiQuyetVong, taoTran, xepHang, type GheMoi, type TrangThaiTran,
} from '../server/holdem/engine.js';
import { botTaiCoCau, timBot, type Bot, type BoiCanh } from '../server/holdem/bots.js';
import { bayShop } from '../server/holdem/shop.js';
import { oCongKhai } from '../server/holdem/map.js';
import { apNhipLenhBotNav } from '../server/holdem/nhip_lenh_bot.js';
import { navCua } from '../server/holdem/nav.js';

const SO_TRAN = Number(process.argv[2] ?? 4000);
const SO_GHE = Math.max(3, Number(process.argv[3] ?? 5) | 0);

/*
 * ⚠⚠ ĐO TRÊN ĐÚNG BỘ LUẬT ĐANG CHẠY — sửa D155. Bản cũ gọi `taoTran(seed, ghe)`
 * TRẦN: mọi cờ luật tắt hết (mapV28, sức căng, quán tính, chu kỳ… đều không có),
 * tức gate này đã đo một TRÒ KHÁC với trò người chơi thật đang chơi — đúng bẫy
 * D83/D127 mà chính `holdem_montecarlo.ts` đã vá từ trước và ghi bằng chữ.
 * Bật/tắt phản thân nay đi bằng override cờ `phanThan` trên object luật (cửa cô
 * lập mà chú thích cũ của `PHAN_THAN.BAT` đòi giữ — vẫn còn, chỉ đổi khuôn),
 * KHÔNG còn qua ENV.
 */
const PHIEN_BAN_DO = process.env['PT_PHIEN_BAN'] ?? HOLDEM_BALANCE_VERSION;
if (!(PHIEN_BAN_DO in BO_LUAT_THEO_PHIEN_BAN)) {
  console.error(`✖ Phiên bản luật không có trong bảng: ${JSON.stringify(PHIEN_BAN_DO)}`);
  process.exit(1);
}
const PT_BAT = process.env['PT_BAT'] !== '0';
const LUAT_DO = { ...luatCua(PHIEN_BAN_DO), phanThan: PT_BAT };

/** Đàn nền cho bàn SOLO — trộn để không ai dồn cùng ai. */
const NEN = ['phong_thu', 'da_dang', 'bat_day', 'khac_che', 'ngoi_im', 'bam_bua'];

/** Chỉ đo archetype RISK-ON: chúng mới dồn vào nhóm mà phản thân trừng phạt. */
const DO = ['tat_tay', 'duoi_da'];

interface KQ {
  tran: number; tongHangChuan: number; tongVon: number; chay: number; soLanThay: number;
  /** Đếm sự kiện trên map CUỐI — để kiểm phân phối không thoái hoá (gate D4). */
  suKien: Record<string, number>;
}

/*
 * D156 — NỢ D155 ĐÃ TRẢ: ghế nay ĐẶT LỆNH NAV mỗi vòng qua `apNhipLenhBotNav`
 * (hàm dùng CHUNG với holdem_montecarlo — một nhịp, không bản sao, D61), nên ô
 * bị phản thân thay CHẠM THẬT vào vị thế. Thước D4b đổi từ TIỀN MẶT sang NAV:
 * dưới luật nav, của cải nằm ở vị thế còn tiền mặt chỉ là số lẻ chưa tiêu —
 * đo tiền mặt là đúng cái bẫy von_truoc/von_sau D116 đã gọi tên.
 */
function chayTran(seed: number, botIds: readonly string[]): {
  hang: readonly string[]; st: TrangThaiTran;
} {
  const bots: Bot[] = botIds.map((id) => timBot(id)!);
  const ghe: GheMoi[] = botIds.map((_id, i) => ({
    id: `g${i}`,
    loai: 'bot' as const,
    bac_rank: ['Đồng', 'Bạc', 'Vàng'][(seed + i) % 3]!,
    danh_muc: { tai_san: [], chien_thuat: [] },
  }));
  let st = taoTran(seed, ghe, LUAT_DO, HOLDEM_DECISIONS.MAP_SIZE);

  let canh = 0;
  while (!daKetThuc(st) && canh < 40) {
    canh += 1;
    const o = st.map.o[st.vong - 1]!;
    const stLuc = st;

    // Nhịp 1 — mọi ghế tái cơ cấu.
    const gheMoi = st.ghe.map((g, i) => {
      if (g.da_chay) return g;
      const ctx: BoiCanh = {
        seed, vong: stLuc.vong, o: oCongKhai(o) as never, oThat: o,
        oTruoc: stLuc.map.o[stLuc.vong - 2], ghe: g,
        shop: bayShop(seed, stLuc.vong, g.id, 0, g.danh_muc),
        soNguoiSong: stLuc.ghe.filter((x) => !x.da_chay).length,
      };
      const r = botTaiCoCau(bots[i]!, ctx);
      return { ...g, danh_muc: r.danh_muc, luot_khao_sat: r.luot_khao_sat };
    });
    st = { ...st, ghe: gheMoi };

    // Nhịp LỆNH NAV — cùng hàm với montecarlo; bàn này không có oracle.
    st = apNhipLenhBotNav(st, bots);


    // Nhịp 2+3 — vòng cược + chốt phiên.
    const stCuoc = st;
    st = giaiQuyetVong(st, (cuoc) => {
      const g = stCuoc.ghe.find((x) => x.id === cuoc.ghe_id)!;
      const bot = bots[stCuoc.ghe.indexOf(g)]!;
      const ctx: BoiCanh = {
        seed, vong: stCuoc.vong, o: oCongKhai(o) as never, oThat: o,
        oTruoc: stCuoc.map.o[stCuoc.vong - 2], ghe: g,
        shop: bayShop(seed, stCuoc.vong, g.id, 0, g.danh_muc),
        soNguoiSong: stCuoc.ghe.filter((x) => !x.da_chay).length,
      };
      return bot.chonCuoc(cuoc, ctx);
    }).trangThai;
  }
  return { hang: xepHang(st), st };
}

function do1(botId: string, damDong: boolean): KQ {
  const kq: KQ = {
    tran: 0, tongHangChuan: 0, tongVon: 0, chay: 0, soLanThay: 0, suKien: {},
  };
  for (let i = 0; i < SO_TRAN; i += 1) {
    const ids: string[] = damDong
      ? Array.from({ length: SO_GHE }, () => botId)
      : [botId, ...Array.from({ length: SO_GHE - 1 },
        (_, k) => NEN[(i + k * 3) % NEN.length]!)];
    // Seed KHÁC nhau giữa hai cấu hình bàn, nhưng GIỐNG nhau giữa bật/tắt —
    // nếu không thì hiệu số bật/tắt lẫn cả nhiễu seed.
    const seed = ((i * 2654435761) >>> 0) ^ (damDong ? 0x5bf03635 : 0);
    const { hang, st } = chayTran(seed, ids);

    // Ghế 0 luôn là archetype đang đo (bàn đám đông thì ghế nào cũng vậy).
    kq.tran += 1;
    kq.tongHangChuan += (hang.indexOf('g0') + 1) / (SO_GHE + 1);
    const g0 = st.ghe.find((g) => g.id === 'g0')!;
    kq.tongVon += navCua(g0);
    if (g0.da_chay) kq.chay += 1;
    kq.soLanThay += (st.phan_than ?? []).length;
    for (const o of st.map.o) {
      if (o.kind === 'su_kien') kq.suKien[o.su_kien] = (kq.suKien[o.su_kien] ?? 0) + 1;
    }
  }
  return kq;
}

type Bo = { bat: boolean; out: Record<string, { dong: KQ; solo: KQ }> };

// ── CHẾ ĐỘ CON: đo một lượt với cờ hiện tại, in JSON, thoát ────────────────
if (process.env.PT_CHILD === '1') {
  const out: Record<string, { dong: KQ; solo: KQ }> = {};
  for (const id of DO) out[id] = { dong: do1(id, true), solo: do1(id, false) };
  process.stdout.write(JSON.stringify({ bat: PT_BAT, out } satisfies Bo));
  process.exit(0);
}

// ── CHẾ ĐỘ CHA: gọi con hai lượt (bật / tắt) rồi so ────────────────────────
function goiCon(bat: boolean): Bo {
  const raw = execFileSync(process.execPath, [process.argv[1]!, String(SO_TRAN), String(SO_GHE)], {
    env: {
      ...process.env,
      PT_CHILD: '1',
      PT_BAT: bat ? '1' : '0',
      /*
       * Loader tsx phải đi qua NODE_OPTIONS, KHÔNG phải `execArgv` — tuỳ chọn đó
       * chỉ có ở `fork`, còn `execFileSync` bỏ qua nó (và TS bắt được). Thiếu
       * loader thì tiến trình con nạp `.ts` bằng Node thuần và chết ở
       * ERR_MODULE_NOT_FOUND config/holdem.js.
       */
      NODE_OPTIONS: `${process.env.NODE_OPTIONS ?? ''} --import tsx`.trim(),
    },
    encoding: 'utf8',
    maxBuffer: 32 * 1024 * 1024,
  });
  return JSON.parse(raw) as Bo;
}

console.log(`GATE D4 PHẢN THÂN — ${SO_TRAN} trận/cấu hình, bàn ${SO_GHE} ghế`);
/*
 * D161 — in PHIÊN BẢN ĐANG ĐO, không phải mặc định repo: bản cũ in
 * HOLDEM_BALANCE_VERSION nên lượt đo v35 đầu tiên mang header "balance=v34"
 * — phải soi số "12 loại sự kiện" mới chứng minh được env đã tới nơi.
 */
console.log(`engine=${HOLDEM_VERSION} balance=${PHIEN_BAN_DO}`
  + (PHIEN_BAN_DO !== HOLDEM_BALANCE_VERSION ? ' (≠ mặc định repo)' : '')
  + ` map=${HOLDEM_DECISIONS.MAP_SIZE} ô`);
console.log('Đo CÙNG MỘT BÀN, chỉ đổi cờ PHAN_THAN.BAT — xem docstring đầu file.\n');

const bat = goiCon(true);
const tat = goiCon(false);
if (bat.bat !== true || tat.bat !== false) {
  throw new Error('Cửa tắt PHAN_THAN.BAT không ăn — mọi số dưới đây vô nghĩa. '
    + `nhận bật=${bat.bat} tắt=${tat.bat}`);
}

const tb = (k: KQ) => ({
  hang: k.tongHangChuan / k.tran,
  von: k.tongVon / k.tran,
  chay: (k.chay / k.tran) * 100,
  thay: k.soLanThay / k.tran,
});

console.log('ARCHETYPE      BÀN        PT   HẠNG CHUẨN   VỐN TB   CHÁY%   THAY Ô/TRẬN');
for (const id of DO) {
  for (const ban of ['dong', 'solo'] as const) {
    for (const [ten, bo] of [['BẬT', bat], ['TẮT', tat]] as const) {
      const k = tb(bo.out[id]![ban]);
      console.log(
        (ban === 'dong' && ten === 'BẬT' ? timBot(id)!.label.padEnd(15) : ''.padEnd(15))
        + (ban === 'dong' ? 'ĐÁM ĐÔNG' : 'SOLO').padEnd(11)
        + ten.padEnd(5)
        + k.hang.toFixed(3).padStart(11)
        + Math.round(k.von).toString().padStart(9)
        + k.chay.toFixed(1).padStart(8)
        + k.thay.toFixed(2).padStart(14));
    }
  }
}

console.log('\n──────── GATE ────────');
const fail: string[] = [];

for (const id of DO) {
  const dongBat = tb(bat.out[id]!.dong);
  const dongTat = tb(tat.out[id]!.dong);
  const soloBat = tb(bat.out[id]!.solo);
  const soloTat = tb(tat.out[id]!.solo);

  // D4a — cơ chế PHẢI nổ ở bàn đám đông, và TẮT thì phải nổ 0 lần (cửa tắt thật).
  const coNo = dongBat.thay > 0.15 && tat.out[id]!.dong.soLanThay === 0;
  console.log(`D4a cơ chế CÓ nổ (${id}): ${coNo ? '✓' : '✗'} — `
    + `bật ${dongBat.thay.toFixed(2)} lần/trận, tắt ${dongTat.thay.toFixed(2)}`);
  if (!coNo) fail.push(`D4a ${id}: phản thân không nổ, hoặc cửa tắt không ăn`);

  // D4b — bật phản thân thì ĐÁM ĐÔNG NGHÈO ĐI so với chính nó khi tắt.
  const bipHut = dongBat.von < dongTat.von;
  console.log(`D4b đám đông bị phạt (${id}): ${bipHut ? '✓' : '✗'} — `
    + `vốn bật ${Math.round(dongBat.von)} vs tắt ${Math.round(dongTat.von)} `
    + `(${(((dongBat.von - dongTat.von) / dongTat.von) * 100).toFixed(1)}%)`);
  if (!bipHut) {
    fail.push(`D4b ${id}: dồn cả bàn KHÔNG bị phạt — bong bóng chưa cắn lại người thổi`);
  }

  /*
   * D4c — PHÂN PHỐI SỰ KIỆN KHÔNG ĐƯỢC THOÁI HOÁ (điều kiện thứ hai của gate D4).
   *
   * ⚠ Bản đầu tôi đặt D4c là "người KHÔNG dồn theo ai không được lãnh đòn thay",
   * đo bằng cách so bàn SOLO bật/tắt. Nhưng bàn đó KHÔNG hề solo: ở bàn 5 ghế,
   * ngưỡng 60% chỉ là 3 GHẾ, mà `duoi_da` + `da_dang` + `bat_day` đều ôm vn30 nên
   * nhánh risk-on nổ do TRÙNG LẶP TÌNH CỜ, không do ai đàn theo ai. Đo bằng một
   * bàn không phải control thì con số nói gì cũng không dùng được.
   *
   * Nay kiểm đúng thứ D4 viết: phản thân không được biến bộ bài thành một sự kiện.
   * 7 sự kiện, chia đều là ~14%; ngưỡng 45% cho chỗ trội nhất là rộng rãi nhưng
   * bắt được thoái hoá thật.
   */
  const dem = bat.out[id]!.dong.suKien;
  const tong = Object.values(dem).reduce((a, b) => a + b, 0);
  const [troiTen, troiSo] = Object.entries(dem).sort((a, b) => b[1] - a[1])[0] ?? ['—', 0];
  const troiPct = tong > 0 ? (troiSo / tong) * 100 : 0;
  const khongThoaiHoa = troiPct < 45;
  console.log(`D4c phân phối sự kiện không thoái hoá (${id}): `
    + `${khongThoaiHoa ? '✓' : '✗'} — trội nhất ${troiTen} ${troiPct.toFixed(1)}% `
    + `trên ${Object.keys(dem).length} loại`);
  if (!khongThoaiHoa) {
    fail.push(`D4c ${id}: bộ bài thoái hoá về ${troiTen} (${troiPct.toFixed(1)}%)`);
  }

  // Thông tin: phản thân dịch vốn của người KHÔNG chủ động dồn bao nhiêu.
  const lechSolo = ((soloBat.von - soloTat.von) / soloTat.von) * 100;
  console.log(`   (bổ trợ) bàn trộn: vốn lệch ${lechSolo.toFixed(1)}% khi bật phản thân`);
}

console.log('');
if (fail.length === 0) {
  console.log('✓ ĐẠT — đám đông ngây thơ bị chính bong bóng mình thổi trừng phạt.');
} else {
  console.log('✗ KHÔNG ĐẠT:');
  for (const f of fail) console.log(`  - ${f}`);
  process.exitCode = 1;
}
