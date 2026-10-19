/**
 * HIỆU CHUẨN PHÂN PHỐI NULL CHO SÁU CHỈ SỐ TÍNH CÁCH (D101 Q6b · D106 bước 4).
 *
 * Câu hỏi: một con bot KHÔNG CÓ CẢM XÚC — tái cân bằng thuần, đuổi đà thuần,
 * ngồi im, bấm bừa… — khi đưa qua `tinhChiSo` thì ra số bao nhiêu? Nếu bot tái
 * cân bằng kỷ luật có `sau_thua_x ≥ 1,5` THUẦN CƠ HỌC (sau vòng thua NAV tụt ⇒
 * mua lại cùng số tiền là % tiền mặt lớn hơn) thì ngưỡng 🌋 "gỡ gạc" đang dán
 * nhãn cảm xúc lên một phép chia. Phải biết cái nền trước khi tin ngưỡng.
 *
 *   npx tsx scripts/hieu_chuan_null.ts [số_người_mỗi_bot=40] [trận_mỗi_người=10] [cỡ_map=8]
 *
 * Vòng lặp trận mượn NGUYÊN của `holdem_montecarlo.ts` (bot lấy lệnh bằng đúng
 * `lenhBotNav` holdem_api dùng) — không tự chế chính sách. Thu `VongInsight` của
 * TỪNG ghế mỗi vòng, gom K trận liên tiếp của cùng bot thành một "người", rồi
 * chạy đúng `tinhChiSo` + `xepTinhCach` sản phẩm đang dùng.
 *
 * Đầu ra: bảng phân vị (p50 · p90) từng chỉ số theo bot + phân bố thẻ. Chỉ ĐỌC,
 * không ghi DB. Kết quả ghi vào docs khi chốt ngưỡng (A8.2 — agent trình số,
 * founder chốt).
 */
import {
  apLenhVongNav, daKetThuc, echoCua, giaiQuyetVong, maxTaiSanCua, taoTran,
  tyLeCua, type Ghe,
} from '../server/holdem/engine.js';
import {
  BOT_CHOI_DUOC, BOT_DI_VON, BOT_THAM_CHIEU, BOT_TIN_HIEU, botTaiCoCau, lenhBotNav,
  timBot, type BoiCanh,
} from '../server/holdem/bots.js';
import { bayShop } from '../server/holdem/shop.js';
import { oCongKhai } from '../server/holdem/map.js';
import { navCua } from '../server/holdem/nav.js';
import { boiCanhLenhVong } from '../server/holdem/nhip_lenh_bot.js';
import {
  HOLDEM_BALANCE_VERSION, luatCua,
} from '../config/holdem.js';
import {
  NGUONG_TINH_CACH, tinhChiSo, xepTinhCach, type SauChiSo, type VongInsight,
} from '../server/holdem/insight.js';

const VT = process.argv.slice(2).filter((x) => !x.startsWith('--'));
const NGUOI_MOI_BOT = Math.max(4, Number(VT[0] ?? 40) | 0);
const TRAN_MOI_NGUOI = Math.max(2, Number(VT[1] ?? 10) | 0);
const CO_MAP = Math.max(4, Number(VT[2] ?? 8) | 0);
const LUAT = luatCua(HOLDEM_BALANCE_VERSION);
if (!LUAT.nav) throw new Error('Bộ luật đang ship không phải NAV — script này vô nghĩa.');

/** Bot làm "người" — mỗi con một tính cách máy; ghế còn lại bốc ngẫu nhiên. */
const BOT_NGUOI = [
  ...BOT_THAM_CHIEU, ...BOT_TIN_HIEU, ...BOT_CHOI_DUOC, ...BOT_DI_VON,
].map((b) => b.id).filter((id, i, a) => a.indexOf(id) === i);
const BOT_DOI_THU = [...BOT_CHOI_DUOC, ...BOT_TIN_HIEU].map((b) => b.id);

function rngCua(seed: number) {
  let x = seed >>> 0 || 1;
  return () => { x ^= x << 13; x >>>= 0; x ^= x >>> 17; x ^= x << 5; x >>>= 0; return x / 4294967296; };
}

/** Một trận; trả VongInsight của ghế 0 (bot "người"). */
function chayTran(seed: number, botIds: readonly string[]): VongInsight[] {
  const bots = botIds.map((id) => timBot(id)!);
  let st = taoTran(seed, botIds.map((id, i) => ({
    id: `g${i}`, loai: 'bot' as const,
    bac_rank: ['Đồng', 'Bạc', 'Vàng'][(seed + i) % 3]!,
    danh_muc: { tai_san: [], chien_thuat: [] },
  })), LUAT, CO_MAP);
  const ra: VongInsight[] = [];
  let guard = 0;
  while (!daKetThuc(st) && guard < 40) {
    guard += 1;
    const vong = st.vong;
    const o = st.map.o[vong - 1]!;
    const ctxCua = (g: Ghe): BoiCanh => ({
      seed, vong, o: oCongKhai(o) as never, oThat: o, oTruoc: st.map.o[vong - 2], ghe: g,
      shop: bayShop(seed, vong, g.id, 0, g.danh_muc),
      soNguoiSong: st.ghe.filter((x) => !x.da_chay).length,
      maxTaiSan: maxTaiSanCua(st, g),
      ...tyLeCua(st, vong),
    });
    const ghe = st.ghe.map((g, i) => {
      if (g.da_chay) return g;
      const r = botTaiCoCau(bots[i]!, ctxCua(g));
      return { ...g, danh_muc: r.danh_muc, luot_khao_sat: r.luot_khao_sat };
    });
    st = { ...st, ghe };

    /*
     * D386 — BỐI CẢNH DỰNG BẰNG HÀM CHUNG, không gõ tay nữa.
     *
     * ⚠ Bản gõ tay ở đây đã trôi XA NHẤT trong ba bản: thiếu `nen` (v36 R3) như
     * `holdem_api.ts`, và thiếu luôn `lop_vn` (v41) lẫn cả ba cờ v42 — tức nó
     * chấm mã bằng bộ ma trận v40 trong khi engine định giá bằng v52, và trái
     * phiếu Mỹ thì mù coupon hoàn toàn. Ngưỡng null của 9 thẻ tính cách hiệu
     * chuẩn TRƯỚC D386 do đó đo một con bot không tồn tại ở bàn nào.
     */
    const bcThuong = boiCanhLenhVong(st);
    const bcOracle = boiCanhLenhVong(st, true);
    let lenhGhe0: VongInsight['lenh'] = [];
    for (let i = 0; i < st.ghe.length; i += 1) {
      const g = st.ghe[i]!;
      if (g.da_chay) continue;
      const bot = bots[i]!;
      const bc = bot.id === 'oracle' ? bcOracle : bcThuong;
      const lenh = lenhBotNav(bot, g, vong, maxTaiSanCua(st, g), bc);
      if (lenh.length === 0) continue;
      /*
       * Bot đặt lệnh bằng TIỀN TUYỆT ĐỐI (`{ma, tien}`, tien < 0 = bán); người chơi
       * đặt bằng MỐC % (`{chieu, moc_bp}` — % tiền mặt khi mua, % vị thế khi bán).
       * Quy về mốc đúng như insight đọc: mua = tien / tiền mặt TRƯỚC lệnh; bán =
       * |tien| / giá trị vị thế mã TRƯỚC lệnh. Tính TRƯỚC khi áp (đúng mẫu số).
       */
      const quy = lenh.map((l) => {
        const chieu = l.tien >= 0 ? 'mua' as const : 'ban' as const;
        const mau = chieu === 'mua' ? g.von : (g.vi_the[l.ma] ?? 0);
        const moc = mau > 0 ? Math.min(10_000, Math.round((Math.abs(l.tien) / mau) * 10_000)) : 0;
        return { chieu, moc_bp: moc };
      });
      const r = apLenhVongNav(st, g.id, lenh);
      if (r.ok) {
        st = r.st;
        if (i === 0) lenhGhe0 = quy;
      }
    }
    const daHoiBot = new Map<string, number>();
    const kq = giaiQuyetVong(st, (cuoc) => {
      const g = st.ghe.find((x) => x.id === cuoc.ghe_id)!;
      const bot = bots[st.ghe.indexOf(g)]!;
      const ctx = ctxCua(g);
      const soLan = daHoiBot.get(g.id) ?? 0;
      daHoiBot.set(g.id, soLan + 1);
      if (soLan === 0) {
        const yDinh = bot.chonCamKet(ctx);
        if (yDinh.hanh_dong === 'cat_lo') return { loai: 'bo' as const };
        if (yDinh.hanh_dong === 'tang_cam_ket' && yDinh.them > 0 && cuoc.duoc.includes('to')) {
          return { loai: 'to' as const, them: Math.max(cuoc.con_thieu + 1, yDinh.them) };
        }
      }
      return bot.chonCuoc(cuoc, ctx);
    });
    const cuaBan = kq.ketQua.ket_qua.find((x) => x.ghe_id === 'g0');
    const tt = st.map.trang_thai?.[vong - 1];
    const g0 = kq.trangThai.ghe[0]!;
    const nav0 = navCua(g0);
    ra.push({
      tien_mat_bp: nav0 > 0 ? Math.round((g0.von / nav0) * 10_000) : 10_000,
      so_ma: Object.values(g0.vi_the ?? {}).filter((x) => x > 0).length,
      match_id: `s${seed}`,
      lenh: lenhGhe0,
      pnl_bp: cuaBan ? cuaBan.pnl_bp : null,
      brier: cuaBan?.brier ?? null,
      mo_bang: false,
      o_su_kien: o.kind === 'su_kien',
      la_tin_gia: o.kind === 'su_kien' && o.la_tin_gia,
      chuoi_tang: tt !== undefined && tt.run_huong === 1 && tt.run_dai >= 2,
      tu_dong: false,
    });
    st = kq.trangThai;
    if (st.ghe[0]!.da_chay) break;
  }
  return ra;
}

// ── Chạy ───────────────────────────────────────────────────────────────────
const pct = (xs: number[], p: number): number | null => {
  if (xs.length === 0) return null;
  const s = [...xs].sort((a, b) => a - b);
  return s[Math.min(s.length - 1, Math.floor(p * s.length))]!;
};
const f = (x: number | null) => (x === null ? '   —  ' : x.toFixed(2).padStart(6));

console.log(`Hiệu chuẩn null — balance=${HOLDEM_BALANCE_VERSION} · map ${CO_MAP} · `
  + `${NGUOI_MOI_BOT} người/bot × ${TRAN_MOI_NGUOI} trận`);
console.log(`Ngưỡng đang dùng: ${JSON.stringify(NGUONG_TINH_CACH)}\n`);
console.log('bot'.padEnd(16) + ' n  | brier p50/p90 | đuổiLệch p50/p90 | tinLệch p50/p90 | tinGiảLệch p50/p90 | chốtNon p50/p90 | sauThua p50/p90 | sauThắng p50/p90 | thẻ');

let seed = 7_000_001;
for (const botId of BOT_NGUOI) {
  const chiSo: SauChiSo[] = [];
  const the = new Map<string, number>();
  for (let n = 0; n < NGUOI_MOI_BOT; n += 1) {
    const vongs: VongInsight[] = [];
    for (let t = 0; t < TRAN_MOI_NGUOI; t += 1) {
      seed += 1;
      const rng = rngCua(seed);
      const doiThu = Array.from({ length: 4 }, () => BOT_DOI_THU[Math.floor(rng() * BOT_DOI_THU.length)]!);
      vongs.push(...chayTran(seed, [botId, ...doiThu]));
    }
    const cs = tinhChiSo(vongs);
    chiSo.push(cs);
    const t = xepTinhCach(cs, vongs.length);
    the.set(t, (the.get(t) ?? 0) + 1);
  }
  const lay = (g: (c: SauChiSo) => number | null | undefined) =>
    chiSo.map(g).filter((x): x is number => typeof x === 'number');
  const cot = (g: (c: SauChiSo) => number | null | undefined) => {
    const xs = lay(g);
    return `${f(pct(xs, 0.5))}/${f(pct(xs, 0.9))}`;
  };
  const theStr = [...the.entries()].sort((a, b) => b[1] - a[1])
    .map(([k, v]) => `${k}:${Math.round((100 * v) / NGUOI_MOI_BOT)}%`).join(' ');
  console.log(
    botId.padEnd(16) + String(NGUOI_MOI_BOT).padStart(3) + ' | '
    + cot((c) => c.hieu_chinh?.brier_tb) + ' | '
    + cot((c) => c.duoi_gia?.lech) + ' | '
    + cot((c) => c.theo_tin?.lech) + ' | '
    + cot((c) => c.theo_tin?.lech_tin_gia) + ' | '
    + cot((c) => c.chot_non?.lech) + ' | '
    + cot((c) => c.don_von?.sau_thua_x) + ' | '
    + cot((c) => c.don_von?.sau_thang_x) + ' | ' + theStr,
  );
}
