/**
 * D561 — DỰNG BẢNG XẾP HẠNG CÁCH E (`XEP_HANG_E`, config/holdem.ts): trận toàn bot trên một khoá (mặc định khoá mặc định), mọi ghế ghi % tăng trưởng
 * cuối trận (`tangTruongBp`), rồi theo vai lấy 21 điểm phân vị (p0, p5 … p100) của (% ghế − trung vị % mọi ghế cùng trận). In ra đúng khuôn để dán
 * vào config. Vòng trận chép `scripts/holdem_montecarlo.ts` + bước màn bot (`tinhMgCaBan` → `apMg`) như API.
 * Chạy: npx tsx scripts/bang_xep_hang_e.ts [soTran=20000] [khoa]   (~10–20 phút cho 20.000 trận bàn 14)
 * ⚠ A8.2 — bảng là tham số: đo → trình → founder chốt; đổi bảng = đổi `xepHang` của khoá ⇒ cùng commit với golden.
 */
import {
  daKetThuc, giaiQuyetVong, maxTaiSanCua, taoTran, tyLeCua, viKhaoSat, ghiViKhaoSat,
  coLuotLoi, maxLoiCua, tangTruongBp, type Ghe,
} from '../server/holdem/engine.js';
import { bocThamVaiXacSuat } from '../server/holdem/vai.js';
import { BOT_CHOI_DUOC, botTaiCoCau, type BoiCanh } from '../server/holdem/bots.js';
import { bayShop } from '../server/holdem/shop.js';
import { oCongKhai } from '../server/holdem/map.js';
import { apMocTraitCaBan, apNhipLenhBotNav } from '../server/holdem/nhip_lenh_bot.js';
import { RANG_BUOC_TRONG, rangBuocCua } from '../server/holdem/trait.js';
import { apMg, tinhMgCaBan } from '../server/holdem/minigame/quyet_toan.js';
import { coManMinigame, luatCua, soGheTuSeed, HOLDEM_BALANCE_VERSION } from '../config/holdem.js';
import { coBanGhim } from '../config/luoc_bo.js';

const SO_TRAN = Number(process.argv[2] ?? 20000);
const KHOA = process.argv[3] ?? HOLDEM_BALANCE_VERSION;
const LUAT = luatCua(KHOA);
const CO_MAP = coBanGhim(LUAT) ?? 8;   // D550 — cỡ ghim của khoá (v63 ⇒ 14)
type Dong = { seed: number; vai: string; tt_bp: number };
const ra: Dong[] = [];
const t0 = Date.now();
for (let k = 0; k < SO_TRAN; k += 1) {
  const seed = 1_000_003 + k * 7919;
  const soGhe = soGheTuSeed(seed);
  const bots = Array.from({ length: soGhe }, (_, i) => BOT_CHOI_DUOC[(seed + i) % BOT_CHOI_DUOC.length]!);
  const vai = bocThamVaiXacSuat(seed, soGhe);
  let st = taoTran(seed, bots.map((b, i) => ({
    id: `g${i}`, loai: 'bot' as const, bac_rank: 'Bạc', bot_id: b.id,
    danh_muc: { tai_san: [], chien_thuat: [] }, vai: vai[i]!,
  })) as never, LUAT, CO_MAP);
  let guard = 0;
  while (!daKetThuc(st) && guard < 40) {
    guard += 1;
    const o = st.map.o[st.vong - 1]!;
    const ctxCua = (g: Ghe): BoiCanh => ({
      seed, vong: st.vong, o: oCongKhai(o) as never, oThat: o, oTruoc: st.map.o[st.vong - 2], ghe: g,
      shop: bayShop(seed, st.vong, g.id, 0, g.danh_muc, { loiGon: st.loi_gon === true }),
      loiGon: st.loi_gon === true,
      ...((st.trait_bat === true ? rangBuocCua(st, g, st.vong) : RANG_BUOC_TRONG).teLiet || !coLuotLoi(st, g) ? { khoaLoi: true } : {}),
      ...(st.dong_ho_minigame === true ? { maxLoi: maxLoiCua(st, g) } : {}),
      soNguoiSong: st.ghe.filter((x) => !x.da_chay).length,
      maxTaiSan: maxTaiSanCua(st, g),
      ...(st.ban_khong_thuan_quyen === true ? { banKhongThuanQuyen: true } : {}),
      ...tyLeCua(st, st.vong),
    });
    st = { ...st, ghe: st.ghe.map((g, i) => {
      if (g.da_chay) return g;
      const r = botTaiCoCau(bots[i]!, { ...ctxCua(g), ghe: { ...g, luot_khao_sat: viKhaoSat(st, g) } });
      return { ...ghiViKhaoSat(st, g, r.luot_khao_sat), danh_muc: r.danh_muc };
    }) };
    st = apNhipLenhBotNav(st, bots, (b) => b.id === 'oracle');
    const daHoi = new Map<string, number>();
    const vongVua = st.vong;
    const r = giaiQuyetVong(st, (cuoc) => {
      const g = st.ghe.find((x) => x.id === cuoc.ghe_id)!;
      const bot = bots[st.ghe.indexOf(g)]!;
      const ctx = ctxCua(g);
      const n = daHoi.get(g.id) ?? 0; daHoi.set(g.id, n + 1);
      if (n === 0) {
        const y = bot.chonCamKet(ctx);
        if (y.hanh_dong === 'cat_lo') return { loai: 'bo' as const };
        if (y.hanh_dong === 'tang_cam_ket' && y.them > 0 && cuoc.duoc.includes('to')) return { loai: 'to' as const, them: Math.max(cuoc.con_thieu + 1, y.them) };
      }
      return bot.chonCuoc(cuoc, ctx);
    });
    st = r.trangThai;
    // Màn của vòng vừa chốt (bot giữ suốt / Bắt Đáy / Tâm lý yếu / trần thua Tổ Chức) — API áp ở đầu vòng kế.
    if (st.dong_ho_minigame === true && coManMinigame(vongVua, st.map.o.length, st.nhip_xen_ke === true)) {
      st = apMg(st, tinhMgCaBan(st, { seedTran: seed, vong: vongVua, loiSuat: r.loiSuatCong ?? null }).mg);
    }
    st = apMocTraitCaBan(st, seed, vongVua, new Map(), (id) => bots[Number(id.slice(1))]).st;
  }
  for (const g of st.ghe) ra.push({ seed, vai: g.vai ?? 'ca_nhan', tt_bp: tangTruongBp(st, g) });
}
const theoTran = new Map<number, Dong[]>();
for (const r of ra) theoTran.set(r.seed, [...(theoTran.get(r.seed) ?? []), r]);
const hieu: Record<string, number[]> = {};
for (const t of theoTran.values()) {
  const x = t.map((r) => r.tt_bp).sort((a, b) => a - b), n = x.length, giua = n % 2 ? x[(n - 1) / 2]! : (x[n / 2 - 1]! + x[n / 2]!) / 2;
  for (const r of t) (hieu[r.vai] ??= []).push(r.tt_bp - giua);
}
console.log(`khoá ${KHOA} · bàn ${CO_MAP} · ${SO_TRAN} trận · ${ra.length} ghế · ${Math.round((Date.now() - t0) / 1000)} s`);
for (const v of ['ca_nhan', 'doi_lai', 'ca_map', 'to_chuc']) {
  const xs = (hieu[v] ?? []).sort((a, b) => a - b), n = xs.length;
  if (!n) continue;
  const q = Array.from({ length: 21 }, (_, i) => Math.round(xs[Math.min(n - 1, Math.floor((i / 20) * (n - 1) + 0.5))]!));
  console.log(`  ${v}: [${q.join(', ')}],   // ${n} ghế`);
}
