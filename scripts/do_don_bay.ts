/**
 * ⚠⚠ SCRIPT ĐO TẠM — KHÔNG PHẢI CẤU HÌNH, KHÔNG PHẢI GATE. XOÁ SAU KHI DÙNG.
 *
 * Câu hỏi duy nhất nó trả lời (founder 27/07): lá `don_bay` (Đòn Bẩy 2×) đang
 * MẠNH hay YẾU? Founder viết "có vẻ vẫn bá" — chữ "có vẻ" là lý do phải đo.
 *
 * CÁCH ĐO — CẶP SONG SINH, KHÔNG ĐO THEO TÊN BOT.
 * Bài học D1 (lặp lại ba lần, ghi trong bots.ts): "bot X mạnh" KHÔNG nói gì về
 * "cơ chế X mạnh", vì bot X còn cầm mấy thứ khác. Nên ở đây HAI GHẾ trên CÙNG
 * MỘT BÀN, CÙNG MỘT SEED, cùng ưu tiên tài sản, cùng độ hung hăng, cùng hàm
 * cam kết — khác đúng MỘT biến: một ghế được mua `don_bay`, ghế kia bị lọc lá
 * đó khỏi shop.
 *
 * Chạy: npx tsx scripts/do_don_bay_TAM.ts [số_trận] [số_ghế] [cỡ_map]
 */
import {
  daKetThuc, giaiQuyetVong, taoTran, xepHang, type Ghe,
} from '../server/holdem/engine.js';
import {
  BOT_CHOI_DUOC, botTaiCoCau, timBot, type BoiCanh, type Bot,
} from '../server/holdem/bots.js';
import { bayShop } from '../server/holdem/shop.js';
import { oCongKhai } from '../server/holdem/map.js';
import type { ChienThuatId } from '../config/holdem.js';
import { HOLDEM_BALANCE_VERSION, HOLDEM_DECISIONS } from '../config/holdem.js';

const SO_TRAN = Number(process.argv[2] ?? 12000);
const SO_GHE = Math.max(3, Number(process.argv[3] ?? 5) | 0);
const CO_MAP = Math.max(4, Number(process.argv[4] ?? HOLDEM_DECISIONS.MAP_SIZE) | 0);

/** Bot gốc, và bản sao bị CHẶN một lá — khác biệt duy nhất giữa hai ghế. */
function chan(base: Bot, id: string, label: string, cam: ChienThuatId): Bot {
  return {
    ...base,
    id,
    label,
    chonThe: (ctx) => base.chonThe({
      ...ctx,
      shop: { ...ctx.shop, chien_thuat: ctx.shop.chien_thuat.filter((c) => c !== cam) },
    }),
  };
}

/** Bản sao ĐỔI lá: chặn lá cũ, và nếu không còn gì để mua thì lấy lá thay thế. */
function doiThe(base: Bot, id: string, label: string, cam: ChienThuatId, thay: ChienThuatId): Bot {
  const b = chan(base, id, label, cam);
  return {
    ...b,
    chonThe: (ctx) => {
      const x = b.chonThe(ctx);
      if (x !== null) return x;
      const dm = ctx.ghe.danh_muc;
      if (dm.chien_thuat.length < 3 && ctx.shop.chien_thuat.includes(thay)
        && !dm.chien_thuat.includes(thay)) return thay;
      return null;
    },
  };
}

const goc = timBot('tat_tay')!;
const CO_DB = goc;                                        // ghế A — CÓ đòn bẩy
const KHONG_DB = chan(goc, 'tt_khong', 'Tất tay (không đòn bẩy)', 'don_bay');
const DOI_CHAN_LO = doiThe(goc, 'tt_chanlo', 'Tất tay (đổi sang Chặn Lỗ)', 'don_bay', 'chan_lo');

interface TK { tran: number; tongHang: number; nhat: number; chay: number; pho: number[] }
const tk = new Map<string, TK>();
function ghi(id: string, hang: number, chay: boolean): void {
  const t = tk.get(id) ?? { tran: 0, tongHang: 0, nhat: 0, chay: 0, pho: [] };
  t.tran += 1; t.tongHang += hang;
  t.pho[hang] = (t.pho[hang] ?? 0) + 1;
  if (hang === 1) t.nhat += 1;
  if (chay) t.chay += 1;
  tk.set(id, t);
}
/** Trọng số Quỹ vòng (CHIA_QUY_VONG.TRONG_SO) — 3 suất, phần thưởng THẬT. */
const TRONG_SO = [0, 5000, 3000, 2000];

function chayTran(seed: number, bots: readonly Bot[]): void {
  let st = taoTran(seed, bots.map((_, i) => ({
    id: `g${i}`, loai: 'bot' as const,
    bac_rank: ['Đồng', 'Bạc', 'Vàng'][(seed + i) % 3]!,
    danh_muc: { tai_san: [], chien_thuat: [] },
  })), {
    luatVon: true, dacQuyen: true,
    // Cần gạt kỹ năng của lá Đòn Bẩy (D37). Đặt DON_BAY_KY_QUY_CU=1 để đo mức CŨ
    // (chỉ nổ ở hack sàn) và so trước/sau bằng đúng một biến.
    kyQuyRong: process.env['DON_BAY_KY_QUY_CU'] !== '1',
  }, CO_MAP);

  let guard = 0;
  while (!daKetThuc(st) && guard < 40) {
    guard += 1;
    const o = st.map.o[st.vong - 1]!;
    const ctxCua = (g: Ghe): BoiCanh => ({
      seed, vong: st.vong, o: oCongKhai(o) as never, oThat: o,
      oTruoc: st.map.o[st.vong - 2], ghe: g,
      shop: bayShop(seed, st.vong, g.id, 0, g.danh_muc),
      soNguoiSong: st.ghe.filter((x) => !x.da_chay).length,
    });
    const ghe = st.ghe.map((g, i) => {
      if (g.da_chay) return g;
      const r = botTaiCoCau(bots[i]!, ctxCua(g));
      return { ...g, danh_muc: r.danh_muc, luot_khao_sat: r.luot_khao_sat };
    });
    st = { ...st, ghe };

    const daHoi = new Map<string, number>();
    st = giaiQuyetVong(st, (cuoc) => {
      const g = st.ghe.find((x) => x.id === cuoc.ghe_id)!;
      const bot = bots[st.ghe.indexOf(g)]!;
      const ctx = ctxCua(g);
      const soLan = daHoi.get(g.id) ?? 0;
      daHoi.set(g.id, soLan + 1);
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

  const hang = xepHang(st);
  for (let i = 0; i < hang.length; i += 1) {
    const g = st.ghe.find((x) => x.id === hang[i])!;
    ghi(bots[Number(g.id.slice(1))]!.id, i + 1, g.vong_chay !== null);
  }
}

// ── Chạy: ghế 0 và ghế 1 là cặp song sinh, còn lại là phông nền xoay vòng ──
const PHONG = BOT_CHOI_DUOC.filter((b) => b.id !== 'tat_tay');
function ban(seed: number, a: Bot, b: Bot): Bot[] {
  const out: Bot[] = [a, b];
  for (let i = 0; i < SO_GHE - 2; i += 1) out.push(PHONG[(seed + i) % PHONG.length]!);
  return out;
}

console.log(`ĐO ĐÒN BẨY — ${SO_TRAN} trận · bàn ${SO_GHE} · map ${CO_MAP} · balance=${HOLDEM_BALANCE_VERSION}`);

function chayCap(a: Bot, b: Bot, ten: string): void {
  tk.clear();
  for (let s = 1; s <= SO_TRAN; s += 1) {
    // Đổi chỗ hai ghế theo chẵn/lẻ: vị trí ghế ảnh hưởng thứ tự cược.
    chayTran(s, s % 2 === 0 ? ban(s, a, b) : ban(s, b, a));
  }
  console.log(`\n── ${ten} ──`);
  for (const id of [a.id, b.id]) {
    const t = tk.get(id)!;
    const thuong = TRONG_SO.reduce((s, w, i) => s + w * (t.pho[i] ?? 0), 0) / t.tran;
    console.log(`${id.padEnd(12)} hạng TB ${(t.tongHang / t.tran).toFixed(3)}`
      + ` · nhất ${(100 * t.nhat / t.tran).toFixed(1)}%`
      + ` · cháy ${(100 * t.chay / t.tran).toFixed(1)}%`
      + ` · thưởng TB ${thuong.toFixed(0)}`
      + ` · phổ ${t.pho.slice(1).map((x) => (100 * (x ?? 0) / t.tran).toFixed(0)).join('/')}`
      + `  (n=${t.tran})`);
  }
}

chayCap(CO_DB, KHONG_DB, 'CÓ đòn bẩy  vs  KHÔNG (ô trống)');
chayCap(CO_DB, DOI_CHAN_LO, 'CÓ đòn bẩy  vs  ĐỔI sang Chặn Lỗ');
