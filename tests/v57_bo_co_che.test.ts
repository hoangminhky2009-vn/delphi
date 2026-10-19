/**
 * v57 (D456) — KHOÁ MINIGAME · BƯỚC 1: BỎ CƠ CHẾ.
 *
 * Kế hoạch: `docs/thiet-ke-de-xuat/gameplay/kien-truc-minigame.md` §7. Khoá `balance-v57-minigame` kế thừa v56 và TẮT tám
 * cơ chế: sổ tiết kiệm (4 cờ) · Lướt Sóng chốt lời trong ô · lửa riêng của Mua Đuổi · Bảng điện tử (cờ mới) · tin giả trên
 * thẻ (cờ mới). KHÔNG đổi lửa · xu · trait (founder 03/10: *"giữ lửa và xu"*).
 *
 * Mỗi bài dưới đây có MỘT VẾ NGƯỢC (cùng phép đo trên v56) — bài chỉ xanh vì "chưa ai bật" thì vế ngược sẽ đỏ (A11.23).
 *
 *   §I   CỔNG       v57 khác v56 ĐÚNG mười lăm cờ (bước 1: tám · bước 2: năm · D470: một · D482: một) · không khoá cũ nào mang hai cờ mới · v57 chưa là mặc định
 *   §II  THẺ THẬT   mọi ô sự kiện của map v57 là THẬT; bot / thống kê bộ bài đọc tỷ lệ giả = 0
 *   §III TRẠNG THÁI taoTran v57: không sổ tiết kiệm, không chốt lời, không lửa Mua Đuổi; lửa · xu · trait còn nguyên
 *   §IV  ĐƯỜNG THẬT qua HTTP + DB: Bảng điện tử bị chặn và KHÔNG thu phí · DTO báo web ẩn nút · sổ tiết kiệm không mở được
 */
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { Hono } from 'hono';
import type pg from 'pg';
import { createApp } from '../server/app.js';
import { CapturingMailer } from '../server/email.js';
import { startTestDb, type TestDb } from './helpers/testdb.js';
import { createTestUser, type TestUser } from './helpers/fixtures.js';
import { HOLDEM_BALANCE_VERSION, giayManMinigame } from '../config/holdem.js';
import { BO_LUAT_THEO_PHIEN_BAN, luatCua } from '../config/holdem_balance.js';
import { taoTran, tuyChonSinhMap, tyLeCua, type TrangThaiTran } from '../server/holdem/engine.js';
import { sinhMap, thanhPhanCongKhai } from '../server/holdem/map.js';

const V56 = 'balance-v56-congdon';
const V57 = 'balance-v57-minigame';

/** Bước 2 (D457) thêm năm cờ vào v57: ba cờ MỚI + `chiBan16` và `vonDeu` đổi chiều. Bài canh riêng của chúng: `v57_khung_tran.test.ts`. */
const NAM_CO_BUOC_2 = ['chiBan12', 'chiBan16', 'dongHoMinigame', 'khoTraitHep', 'vonDeu'];
/** D470 — CẠN THANH KHOẢN chỉ sau hoảng loạn/chuỗi giảm, mọi mùa. Bài canh riêng: `v57_can_thanh_khoan.test.ts`. */
const CO_D470 = ['canSauKhung'];
/** D482 — TRAIT GHIM thay lõi ghim của vai. Bài canh riêng: `minigame_vai.test.ts`. */
const CO_D482 = ['traitGhimMinigame'];
/** D498 — Tổ Chức khung minigame + chia vai mới + Rải lệnh độc quyền. */
const CO_D498 = ['toChucV57'];
/** D506 — vốn vai ×10 · ×20 · ×50 (`HE_SO_VON_V57`). Bài canh riêng: `v57_khung_tran.test.ts` §IV. */
const CO_D506 = ['vonVaiV57'];
/** D516 — phí hai bậc theo độ sâu của ghế (vai vốn to). */
const CO_D516 = ['phiSauVaiV57'];
/** D517 — bầy Cá nhân trong màn. */
const CO_D517 = ['bayCaNhanV57'];

const TAM_CO = [
  'tietKiem', 'tietKiemLamPhat', 'tietKiemThaNoi', 'nganHangDoVo', 'luotSongMoi', 'luaMuaDuoi',
  'khongBangDienTu', 'theLuonThat',
].sort();

const GHE = [
  { id: 'ban', loai: 'nguoi' as const, bac_rank: 'Đồng', vai: 'ca_nhan' as const, danh_muc: { tai_san: [], chien_thuat: [] } },
  { id: 'b1', loai: 'bot' as const, bac_rank: 'Đồng', vai: 'ca_nhan' as const, danh_muc: { tai_san: [], chien_thuat: [] } },
];
const tran = (khoa: string, seed = 4470): TrangThaiTran => taoTran(seed, GHE, luatCua(khoa), 16);

/** Đếm ô sự kiện thật/giả của một map dựng theo luật `khoa`, trên cả dải seed. */
function demTin(khoa: string, soSeed: number, soO: number): { suKien: number; gia: number } {
  let suKien = 0; let gia = 0;
  for (let seed = 1; seed <= soSeed; seed += 1) {
    const map = sinhMap(seed * 7919, soO, tuyChonSinhMap(luatCua(khoa)));
    for (const o of map.o) {
      if (o.kind !== 'su_kien') continue;
      suKien += 1;
      if (o.la_tin_gia) gia += 1;
    }
  }
  return { suKien, gia };
}

describe('§I — cổng v57', () => {
  it('⭐ v57 khác v56 ĐÚNG mười chín cờ — bước 1: sáu cờ tắt + hai cờ mới; bước 2: năm cờ khung trận; D470: cạn thanh khoản có ngòi; D482: trait ghim; D498: Tổ Chức; D506: vốn vai; D516: phí theo độ sâu ghế; D517: bầy Cá nhân', () => {
    const a = luatCua(V56) as unknown as Record<string, unknown>;
    const b = luatCua(V57) as unknown as Record<string, unknown>;
    const khac = [...new Set([...Object.keys(a), ...Object.keys(b)])].filter((k) => (a[k] ?? false) !== (b[k] ?? false)).sort();
    expect(khac).toEqual([...TAM_CO, ...NAM_CO_BUOC_2, ...CO_D470, ...CO_D482, ...CO_D498, ...CO_D506, ...CO_D516, ...CO_D517].sort());
    for (const k of ['tietKiem', 'tietKiemLamPhat', 'tietKiemThaNoi', 'nganHangDoVo', 'luotSongMoi', 'luaMuaDuoi']) {
      expect(a[k], `${k} phải BẬT ở v56 (vế ngược)`).toBe(true);
      expect(b[k], `${k} phải TẮT ở v57`).toBe(false);
    }
    expect(b.khongBangDienTu).toBe(true);
    expect(b.theLuonThat).toBe(true);
  });

  it('lửa · xu · trait · bánh xe mùa giữ NGUYÊN v56 (founder 03/10: "giữ lửa và xu"; `muaDinhHan` không phải sổ tiết kiệm)', () => {
    const a = luatCua(V56) as unknown as Record<string, unknown>;
    const b = luatCua(V57) as unknown as Record<string, unknown>;
    for (const k of ['lua', 'luaPhi', 'luaQuyetToan', 'nhiemVuLoi', 'luaKhongPhatDao', 'gopXu', 'trait', 'traitVai',
      'chanLoTrait', 'kyLuatSauDonBay', 'muaDinhHan', 'banhXe', 'tinTheoMua', 'luatLa', 'loiGon']) {
      expect(b[k], k).toBe(a[k]);
    }
    expect(b.lua).toBe(true);
    expect(b.trait).toBe(true);
    expect(b.gopXu).toBe(true);
    expect(b.muaDinhHan).toBe(true);
  });

  it('không khoá cũ nào mang hai cờ mới — replay mọi trận đã lưu giữ nguyên, kể cả v56', () => {
    for (const [khoa, luat] of Object.entries(BO_LUAT_THEO_PHIEN_BAN)) {
      // D526 — v58 (nhịp xen kẽ) KẾ THỪA v57 nguyên bộ cờ; "khoá cũ" là mọi khoá TRƯỚC v57. Bài `v58_nhip_xen_ke` khoá v58 ≡ v57 ± hai cờ.
      if (khoa === V57 || (luat as { nhipXenKe?: boolean }).nhipXenKe === true) continue;   // D528 → D530 — mọi khoá kế thừa v58: ghim tính chất
      const l = luat as unknown as Record<string, unknown>;
      expect(l.khongBangDienTu, `${khoa}.khongBangDienTu`).toBeFalsy();
      expect(l.theLuonThat, `${khoa}.theLuonThat`).toBeFalsy();
    }
    // Khoá lạ (tắt hết) cũng không được mang chúng.
    expect(luatCua('balance-khong-ton-tai-d456').theLuonThat).toBeFalsy();
  });

  it('D525 — v57 KHÔNG BAO GIỜ là mặc định: lật thẳng v56 → v58 (kế thừa v57 + nhịp xen kẽ), cùng commit với golden', () => {
    // D528 — ghim TÍNH CHẤT, không chuỗi: mặc định (nay v59) mang nhịp xen kẽ + đủ cờ v57.
    expect(luatCua(HOLDEM_BALANCE_VERSION).nhipXenKe).toBe(true);
    expect(luatCua(HOLDEM_BALANCE_VERSION).khongBangDienTu).toBe(true);
    expect(HOLDEM_BALANCE_VERSION).not.toBe(V57);
    expect(HOLDEM_BALANCE_VERSION).not.toBe(V56);
  });
});

describe('§II — thẻ sự kiện LUÔN THẬT', () => {
  for (const soO of [12, 16]) {
    it(`⭐ bàn ${soO} ô, 120 seed: không ô sự kiện nào của map v57 là tin giả`, () => {
      const v57 = demTin(V57, 120, soO);
      expect(v57.suKien, 'không có ô sự kiện nào thì bài này không đo gì').toBeGreaterThan(100);
      expect(v57.gia).toBe(0);
    });

    it(`vế ngược — bàn ${soO} ô: CÙNG dải seed dưới v56 có tin giả (không thì bài trên đo điều luôn đúng)`, () => {
      const v56 = demTin(V56, 120, soO);
      expect(v56.gia).toBeGreaterThan(0);
      expect(v56.gia / v56.suKien, 'tỷ lệ giả v56 phải ở cỡ vài chục %').toBeGreaterThan(0.1);
    });
  }

  it('bot hoài nghi đọc tỷ lệ giả = 0 ở v57 (chiết khấu 1−2p = 1) — và > 0 ở v56', () => {
    let nVoiTin = 0;
    for (let seed = 1; seed <= 40; seed += 1) {
      const s57 = tran(V57, seed * 31);
      const s56 = tran(V56, seed * 31);
      for (let vong = 1; vong <= 16; vong += 1) {
        const o57 = s57.map.o[vong - 1];
        if (o57?.kind !== 'su_kien') continue;
        nVoiTin += 1;
        expect(tyLeCua(s57, vong).tyLeGiaBp, `seed ${seed} vòng ${vong}`).toBe(0);
        if (s56.map.o[vong - 1]?.kind === 'su_kien') {
          expect(tyLeCua(s56, vong).tyLeGiaBp, 'v56 vẫn phải có tỷ lệ giả thật').toBeGreaterThan(0);
        }
      }
    }
    expect(nVoiTin).toBeGreaterThan(30);
  });

  it('thống kê bộ bài công khai: "kỳ vọng tin giả" = 0 ở v57, > 0 ở v56', () => {
    const s57 = tran(V57); const s56 = tran(V56);
    expect(thanhPhanCongKhai(s57.map, 0, true).tin_gia_ky_vong).toBe(0);
    expect(thanhPhanCongKhai(s57.map, 0, true).the_luon_that, 'web cần cờ này để ẩn "~N giả"').toBe(true);
    expect(thanhPhanCongKhai(s56.map, 0).tin_gia_ky_vong).toBeGreaterThan(0);
    expect(thanhPhanCongKhai(s56.map, 0).the_luon_that).toBeUndefined();
    // Chữ ký cũ (hai tham số) y như trước: người gọi chưa biết cờ vẫn ra con số cũ.
    expect(thanhPhanCongKhai(s57.map, 0).tin_gia_ky_vong).toBeGreaterThan(0);
  });
});

describe('§III — trạng thái trận dựng bằng luật v57', () => {
  it('⭐ không sổ tiết kiệm · không chốt lời trong ô · không lửa Mua Đuổi — và v56 CÓ cả ba (vế ngược)', () => {
    const a = tran(V57); const b = tran(V56);
    expect(a.ngan_hang).toBeUndefined();
    expect(a.tiet_kiem_lam_phat).toBeUndefined();
    expect(a.tiet_kiem_tha_noi).toBeUndefined();
    expect(a.ngan_hang_do_vo).toBeUndefined();
    expect(a.luot_song_moi).toBeUndefined();
    expect(a.lua_mua_duoi).toBeUndefined();
    expect(b.ngan_hang).toBe(true);
    expect(b.luot_song_moi).toBe(true);
    expect(b.lua_mua_duoi).toBe(true);
    expect(b.khong_bang_dien_tu).toBeUndefined();
    expect(b.the_luon_that).toBeUndefined();
  });

  it('hai cờ mới có mặt trên trạng thái v57; lửa · xu · trait còn nguyên', () => {
    const a = tran(V57);
    expect(a.khong_bang_dien_tu).toBe(true);
    expect(a.the_luon_that).toBe(true);
    expect(a.lua).toBe(true);
    expect(a.trait_bat).toBe(true);
    expect(a.gop_xu).toBe(true);
  });
});

describe('§IV — đường thật qua HTTP + DB', () => {
  let db: TestDb;
  let pool: pg.Pool;
  let app: Hono<any>;
  let user: TestUser;

  beforeAll(async () => {
    db = await startTestDb();
    pool = db.pool;
    app = createApp({
      pool, mailer: new CapturingMailer(), appBaseUrl: 'https://dubao.test', secureCookie: false,
    }) as Hono<any>;
    user = await createTestUser(pool);
  }, 120_000);
  afterAll(async () => { await db?.stop(); });

  const req = (path: string, init: RequestInit = {}) => app.request(`http://localhost${path}`, {
    ...init,
    headers: { 'content-type': 'application/json', cookie: user.cookie, ...(init.headers ?? {}) },
  });
  const json = async (path: string, init: RequestInit = {}): Promise<any> => (await req(path, init)).json();
  const taoTranHttp = (khoa: string) => json('/api/v1/holdem/matches', {
    method: 'POST', body: JSON.stringify({ ep_balance: khoa }),
  });
  const xem = (id: string) => json(`/api/v1/holdem/matches/${id}`);
  const moBang = (id: string, vong: number) => req(`/api/v1/holdem/matches/${id}/bang-dien-tu`, {
    method: 'POST', body: JSON.stringify({ vong }),
  });
  /** D475 — từ vòng 3 trận v57 chưa nộp được khi màn vòng trước còn chạy ⇒ lùi mốc mở vòng qua hết phần màn (nếp `v57_khung_tran`). */
  const nopVong = async (id: string, vong: number, them: Record<string, unknown> = {}) => {
    if (vong >= 3) {
      await pool.query(
        `UPDATE holdem_matches SET vong_mo_luc = now() - make_interval(secs => $2)
          WHERE match_id = $1 AND balance_version = 'balance-v57-minigame'`, [id, giayManMinigame() + 1]);
    }
    return json(`/api/v1/holdem/matches/${id}/rounds`, {
      method: 'POST',
      body: JSON.stringify({ vong, khao_sat_lai: 0, mua: null, hanh_dong: 'giu_vi_the', them: 0, ...them }),
    });
  };
  const docLog = async (id: string): Promise<unknown[]> =>
    ((await pool.query('SELECT action_log FROM holdem_matches WHERE match_id = $1', [id])).rows[0]!.action_log ?? []) as unknown[];

  it('⭐ Bảng điện tử: v57 trả 403 `luat_tat`, KHÔNG thu phí, KHÔNG ghi vào nhật ký trận', async () => {
    const t = await taoTranHttp(V57);
    const vonTruoc = t.ban.von as number;
    const logTruoc = (await docLog(t.match_id)).length;
    const r = await moBang(t.match_id, 1);
    expect(r.status).toBe(403);
    expect((await r.json() as { error: string }).error).toBe('luat_tat');
    const sau = await xem(t.match_id);
    expect(sau.ban.von, 'bị chặn mà vẫn mất tiền').toBe(vonTruoc);
    expect((await docLog(t.match_id)).length).toBe(logTruoc);
  });

  it('vế ngược — cùng cú bấm dưới v56: bảng mở được và thu phí (không thì bài trên đo điều luôn đúng)', async () => {
    const t = await taoTranHttp(V56);
    const vonTruoc = t.ban.von as number;
    const r = await moBang(t.match_id, 1);
    expect(r.status).toBe(200);
    const sau = await xem(t.match_id);
    expect(sau.ban.von).toBeLessThan(vonTruoc);
  });

  it('⭐ DTO: v57 báo web ẩn Bảng điện tử + không có báo giá sổ tiết kiệm; v56 thì ngược lại', async () => {
    const a = await taoTranHttp(V57);
    expect(a.ban.khong_bang_dien_tu).toBe(true);
    expect(a.ban.tiet_kiem_bao_gia, 'v57 không được báo giá sổ tiết kiệm').toBeUndefined();
    expect(a.ban.tiet_kiem_duoc).not.toBe(true);
    expect(a.bo_bai_con_lai?.tin_gia_ky_vong ?? 0, 'v57 không có kỳ vọng tin giả').toBe(0);
    expect(a.bo_bai_con_lai.the_luon_that).toBe(true);
    const b = await taoTranHttp(V56);
    expect(b.ban.khong_bang_dien_tu).toBeUndefined();
    expect(b.ban.tiet_kiem_bao_gia).toBeDefined();
    expect(b.bo_bai_con_lai.tin_gia_ky_vong).toBeGreaterThan(0);
    expect(b.bo_bai_con_lai.the_luon_that).toBeUndefined();
  });

  it('⭐ sổ tiết kiệm: gửi `tiet_kiem.mo` dưới v57 KHÔNG tạo hợp đồng; dưới v56 thì tạo (vế ngược)', async () => {
    const b = await taoTranHttp(V56);
    const moc = b.ban.tiet_kiem_bao_gia[0] as { so_vong: number };
    await nopVong(b.match_id, 1, { tiet_kiem: { mo: [{ moc_bp: 5000, so_vong: moc.so_vong }] } });
    expect(((await xem(b.match_id)).ban.tiet_kiem ?? []) as unknown[], 'v56 phải mở được hợp đồng').toHaveLength(1);

    const a = await taoTranHttp(V57);
    await nopVong(a.match_id, 1, { tiet_kiem: { mo: [{ moc_bp: 5000, so_vong: moc.so_vong }] } });
    expect(((await xem(a.match_id)).ban.tiet_kiem ?? []) as unknown[]).toHaveLength(0);
  });

  it('⭐ một trận v57 chơi TRỌN cả trận qua đường chính: mọi vòng nộp được, trận khép, không vòng nào có sổ tiết kiệm / bảng / tin giả', async () => {
    const t = await taoTranHttp(V57);
    const t56 = await taoTranHttp(V56);
    // D457 — bước 2: v57 chạy bàn 12 ô = 11 vòng (ô đầu là ô mở màn lật sẵn); v56 vẫn bàn 16 ô = 15 vòng.
    expect(t.tong_vong, 'v57 là bàn 12 ô').toBe(11);
    expect(t56.tong_vong, 'v56 vẫn bàn 16 ô').toBe(15);
    let xong = false;
    let soVongNop = 0;
    for (let v = 1; v <= t.tong_vong && !xong; v += 1) {
      const r = await nopVong(t.match_id, v);
      expect(r.error, `vòng ${v}: ${JSON.stringify(r).slice(0, 200)}`).toBeUndefined();
      soVongNop += 1;
      expect(r.ban?.tiet_kiem_bao_gia, `vòng ${v} lại báo giá sổ tiết kiệm`).toBeUndefined();
      expect(r.ban?.khong_bang_dien_tu ?? true, `vòng ${v} mất cờ ẩn bảng`).toBe(true);
      xong = r.xong === true;
    }
    expect(soVongNop, 'trận khép sớm quá ⇒ bài này không đi hết đường').toBeGreaterThanOrEqual(8);
    const st = await xem(t.match_id);
    expect(st.ban.khong_bang_dien_tu).toBe(true);
    // Mọi ô sự kiện ĐÃ LẬT mà server cho thấy đều thật (cờ giả chỉ lộ ở ô đã lật — nếu có thì phải false).
    for (const o of (st.lich_su_o ?? []) as { kind: string; la_tin_gia?: boolean }[]) {
      if (o.kind === 'su_kien') expect(o.la_tin_gia ?? false).toBe(false);
    }
  }, 120_000);
});
