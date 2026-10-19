/**
 * ĐO GIÁ TRỊ CỦA `BoiCanhLenh.nen` — ĐƯỜNG TÁI LẬP SỐ CỦA D386.
 *
 * ⚠ VÌ SAO SCRIPT NÀY NẰM TRONG REPO: D386 chốt một điều NGƯỢC trực giác — cấp
 * `nen` cho bot KHÔNG làm nó mạnh lên, và riêng `da_dang` thì tệ đi rõ rệt. Một
 * kết luận ngược như thế mà không có đường chạy lại thì lần sau sẽ có người
 * "sửa" nó bằng cảm giác. D57 đã trả giá đúng chỗ này: `config/holdem.ts` trỏ
 * tới một script đo `CAN_TROI_BP` chưa ai từng viết, nên bảng số ấy không tái
 * lập được.
 *
 * ⚠⚠ THIẾT KẾ GHÉP CẶP, KHÔNG PHẢI HAI LẦN CHẠY RIÊNG. Chạy một bàn toàn-có-nền
 * rồi so với một bàn toàn-không-nền thì mọi ghế cùng đổi một lúc, mà THỨ HẠNG là
 * đại lượng TƯƠNG ĐỐI nên chênh lệch triệt tiêu — phép đo sẽ ra "không khác gì"
 * dù cần gạt mạnh tới đâu (đúng lớp phép RỖNG của D58). Nên: CÙNG một bàn, 3 cặp
 * × 2 ghế, mỗi cặp CÙNG archetype, ghế chẵn có nền ghế lẻ không. Chênh lệch NAV
 * trong cặp khi đó chỉ còn đúng một nguồn.
 *
 * Chạy:  npx tsx scripts/do_nen_bot.ts [SO_TRAN] [CO_MAP]
 */
import { boMaTranCua, HOLDEM_BALANCE_VERSION, luatCua } from '../config/holdem.js';
import {
  apLenhVongNav, daKetThuc, giaiQuyetVong, mandateCua, maxTaiSanCua, taoTran, tyLeCua,
} from '../server/holdem/engine.js';
import { BOT_CHOI_DUOC, botTaiCoCau, lenhBotNav } from '../server/holdem/bots.js';
import { boiCanhLenhVong } from '../server/holdem/nhip_lenh_bot.js';
import { bayShop } from '../server/holdem/shop.js';
import { oCongKhai } from '../server/holdem/map.js';
import { navCua } from '../server/holdem/nav.js';

const SO_TRAN = Math.max(50, Number(process.argv[2] ?? 2000) | 0);
const CO_MAP = Math.max(4, Number(process.argv[3] ?? 12) | 0);
/*
 * Đo trên phiên bản CÓ `botDocNen` — cần gạt phải SỐNG thì phép đo mới nói được
 * gì. Đo trên v52 thì hai ghế trong cặp nhận bối cảnh y hệt nhau, chênh lệch 0,
 * và "không ảnh hưởng" khi ấy là phép RỖNG chứ không phải kết luận (D58).
 */
/*
 * D386 — KHÔNG gõ cứng một khoá thử nghiệm nữa (khoá `balance-v53-botdocnen` không mang sang khi
 * gộp). Dựng từ MẶC ĐỊNH ĐANG CHẠY, ép ô-ngửa + bật cờ: cờ chỉ có nghĩa ở luật ô-ngửa (ở v53 bối
 * cảnh bot đi nhánh ô kỳ vọng, không mang `nen`). Khoá lạ thì `luatCua` tắt hết cờ ⇒ hai ghế
 * trong cặp nhận bối cảnh y hệt nhau ⇒ script in "không ảnh hưởng" mà vẫn chạy trơn — phép RỖNG.
 */
const LUAT = { ...luatCua(HOLDEM_BALANCE_VERSION), oUp: false, botDocNen: true };
if (!LUAT.giaChongNen) {
  console.error(`✖ ${HOLDEM_BALANCE_VERSION} không bật giaChongNen ⇒ \`nen\` vô nghĩa, phép đo sẽ RỖNG.`);
  process.exit(1);
}
const ARCH = [BOT_CHOI_DUOC[0]!, BOT_CHOI_DUOC[1]!, BOT_CHOI_DUOC[2]!];

const theoArch = new Map<string, number[]>();
const tatCa: number[] = [];
let navCo = 0; let navKhong = 0; let thangCo = 0; let thangKhong = 0; let hoa = 0;

for (let seed = 1; seed <= SO_TRAN; seed += 1) {
  // Ghế 2a = CÓ nền, ghế 2a+1 = KHÔNG — cùng archetype, cùng bàn, cùng map.
  const arch = (id: string) => ARCH[Math.floor(Number(id.slice(1)) / 2)]!;
  const coNen = (id: string) => Number(id.slice(1)) % 2 === 0;

  let st = taoTran(seed, [0, 1, 2, 3, 4, 5].map((i) => ({
    id: `g${i}`, loai: 'bot' as const, bac_rank: 'Đồng',
    danh_muc: { tai_san: [], chien_thuat: [] }, bot_id: ARCH[Math.floor(i / 2)]!.id,
  })), LUAT, CO_MAP);

  const ctxBot = (g: (typeof st)['ghe'][number]) => ({
    seed, vong: st.vong, o: oCongKhai(st.map.o[st.vong - 1]!) as never,
    oThat: st.map.o[st.vong - 1]!, oTruoc: st.map.o[st.vong - 2], ghe: g,
    shop: st.nav === true
      ? { ...bayShop(seed, st.vong, g.id, 0, g.danh_muc, st.gian_la === true), tai_san: [] }
      : bayShop(seed, st.vong, g.id, 0, g.danh_muc, st.gian_la === true),
    gianLa: st.gian_la === true,
    soNguoiSong: st.ghe.filter((x) => !x.da_chay).length,
    maxTaiSan: maxTaiSanCua(st, g), bo: boMaTranCua(st),
    ...(st.ban_khong_thuan_quyen === true ? { banKhongThuanQuyen: true } : {}),
    ...tyLeCua(st, st.vong),
  }) as never;

  let guard = 0;
  while (!daKetThuc(st) && guard < 40) {
    guard += 1;
    if (!st.map.o[st.vong - 1]) break;

    st = {
      ...st,
      ghe: st.ghe.map((g) => {
        if (g.da_chay) return g;
        const r = botTaiCoCau(arch(g.id), ctxBot(g));
        return { ...g, danh_muc: r.danh_muc, luot_khao_sat: r.luot_khao_sat };
      }),
    };

    // MỘT bối cảnh đầy đủ; ghế "không nền" nhận đúng bản ấy TRỪ `nen`.
    const bcDu = boiCanhLenhVong(st);
    for (const g of st.ghe) {
      if (g.da_chay) continue;
      let bc = bcDu;
      if (bc && !coNen(g.id) && 'nen' in bc) {
        const { nen: _bo, ...conLai } = bc as typeof bc & { nen?: string };
        bc = conLai;
      }
      const md = bc ? mandateCua(st, g) : undefined;
      const bcG = bc && md ? { ...bc, tran_ma_bp: md.tranMaBp } : bc;
      const lb = lenhBotNav(arch(g.id), g, st.vong, maxTaiSanCua(st, g), bcG);
      if (lb.length > 0) {
        const r = apLenhVongNav(st, g.id, lb);
        if (r.ok) st = r.st;
      }
    }

    const daHoi = new Map<string, number>();
    st = giaiQuyetVong(st, (cuoc) => {
      const g = st.ghe.find((x) => x.id === cuoc.ghe_id)!;
      const bot = arch(g.id); const ctx = ctxBot(g);
      const soLan = daHoi.get(g.id) ?? 0; daHoi.set(g.id, soLan + 1);
      if (soLan === 0) {
        const y = bot.chonCamKet(ctx);
        if (y.hanh_dong === 'cat_lo') return { loai: 'bo' as const };
        if (y.hanh_dong === 'tang_cam_ket' && y.them > 0 && cuoc.duoc.includes('to')) {
          return { loai: 'to' as const, them: Math.max(cuoc.con_thieu + 1, y.them) };
        }
      }
      return bot.chonCuoc(cuoc, ctx);
    }).trangThai;
  }

  for (let a = 0; a < 3; a += 1) {
    const nCo = navCua(st.ghe.find((g) => g.id === `g${a * 2}`)!);
    const nKh = navCua(st.ghe.find((g) => g.id === `g${a * 2 + 1}`)!);
    navCo += nCo; navKhong += nKh;
    if (nCo > nKh) thangCo += 1; else if (nKh > nCo) thangKhong += 1; else hoa += 1;
    const d = theoArch.get(ARCH[a]!.id) ?? [];
    d.push(nCo - nKh); theoArch.set(ARCH[a]!.id, d);
    tatCa.push(nCo - nKh);
  }
}

/** TB + sai số chuẩn của chênh lệch THEO CẶP (paired ⇒ SE nhỏ hơn hẳn so sánh rời). */
function tk(d: readonly number[]) {
  const n = d.length;
  const m = d.reduce((a, b) => a + b, 0) / n;
  const v = d.reduce((a, b) => a + (b - m) ** 2, 0) / (n - 1);
  const se = Math.sqrt(v / n);
  return { m, se, t: m / se, n };
}
const dong = (ten: string, r: ReturnType<typeof tk>) => `  ${ten.padEnd(10)}`
  + ` m=${r.m.toFixed(0).padStart(6)}  SE=${r.se.toFixed(0).padStart(5)}`
  + `  t=${r.t.toFixed(2).padStart(6)}  n=${String(r.n).padStart(5)}`
  + `   KTC95 [${(r.m - 1.96 * r.se).toFixed(0)}, ${(r.m + 1.96 * r.se).toFixed(0)}]`
  + `${Math.abs(r.t) >= 1.96 ? '  ***' : ''}`;

const cap = thangCo + thangKhong + hoa;
console.log('');
console.log('ĐO BoiCanhLenh.nen — ghép cặp cùng archetype, cùng bàn');
console.log(`luật đo = ${HOLDEM_BALANCE_VERSION} + oUp:false + botDocNen (cờ chỉ có nghĩa ở luật ô-ngửa)`);
console.log(`map ${CO_MAP} · ${SO_TRAN} trận · bàn 6 = 3 cặp`);
console.log('');
console.log('CHÊNH LỆCH NAV THEO CẶP  (ghế CÓ nền − ghế KHÔNG nền)');
console.log(dong('GỘP', tk(tatCa)));
for (const [id, d] of theoArch) console.log(dong(id, tk(d)));
const p = thangCo / (thangCo + thangKhong);
const sep = Math.sqrt(0.25 / (thangCo + thangKhong));
console.log('');
console.log(`NAV TB: có nền ${(navCo / cap).toFixed(0)} · không nền ${(navKhong / cap).toFixed(0)}`);
console.log(`thắng cặp: có ${thangCo} · không ${thangKhong} · hoà ${hoa}`);
console.log(`tỷ lệ có-nền thắng ${(p * 100).toFixed(1)}%`
  + ` · SE ${(sep * 100).toFixed(1)}pp · t=${((p - 0.5) / sep).toFixed(2)}`);
console.log('');
console.log('⚠ `***` = lệch khỏi 0 có ý nghĩa ở mức 95%. GỘP không có sao ⇒ cấp');
console.log('  `nen` KHÔNG làm đàn bot mạnh lên. Đọc D386 trước khi hiểu số này');
console.log('  thành "cần gạt vô dụng": nó là bản vá ĐÚNG-SAI, không phải SỨC MẠNH.');
