/**
 * PFM — TẦNG NGHIỆP VỤ: điểm danh · chuỗi · token · xoá sạch. D188.
 *
 * Đồ thật: PostgreSQL nhúng. Chuỗi ngày tính bằng VECTOR CHÉP TAY (nếp A5.2) vì nó là
 * hàm thuần — và vì "bảo hiểm 1 ngày/tuần" là loại luật mà đọc code thì thấy đúng, đo
 * bằng vector mới biết nó đúng ở đâu và sai ở đâu.
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import fs from 'node:fs';
import { startTestDb, type TestDb } from './helpers/testdb.js';
import { createTestUser } from './helpers/fixtures.js';
import {
  tinhChuoi, napCapDuoc, ghiDiemDanh, docChuoi, homNayCuaUser, type TrangThaiNgay,
} from '../server/pfm/ngay.js';
import { capToken, docViToken } from '../server/pfm/token.js';
import { xoaSachPfm } from '../server/pfm/xoa.js';
import {
  niemPhongTuan, docTrangThaiTuan, tuanNiemPhongCuaUser, tuanNiemPhongTuNgay,
  ngayCuoiTuan,
} from '../server/pfm/tuan.js';
import {
  napGoiDacTrung, kiemDongDacTrung, cuaSoKy, DacTrungKhongHopLe, type DongDacTrungVao,
} from '../server/pfm/dac_trung.js';
import { thangSongCuaUser } from '../server/pfm/ket.js';
import { PFM } from '../config/pfm.js';
import { CUA_PFM, CUA_PFM_COT } from '../config/pfm_consent.js';

let db: TestDb;
beforeAll(async () => { db = await startTestDb(); }, 180_000);
afterAll(async () => { await db?.stop(); });

/** Tiện: chạy một khối trong transaction thật. */
async function trongTx<T>(fn: (c: any) => Promise<T>): Promise<T> {
  const c = await db.pool.connect();
  try {
    await c.query('BEGIN');
    const r = await fn(c);
    await c.query('COMMIT');
    return r;
  } catch (e) { await c.query('ROLLBACK').catch(() => {}); throw e; } finally { c.release(); }
}

describe('§I — CHUỖI: vector chép tay (hàm thuần)', () => {
  const S = (...ngay: string[]) => new Set(ngay);

  it('ba ngày liền, hôm nay đã điểm danh ⇒ chuỗi 3', () => {
    const r = tinhChuoi(S('2026-08-29', '2026-08-30', '2026-08-31'), '2026-08-31');
    expect(r.chuoi).toBe(3);
    expect(r.homNayXong).toBe(true);
    expect(r.daDungBaoHiem).toBe(0);
  });

  it('⭐ HÔM NAY CHƯA ĐIỂM DANH KHÔNG PHẢI LÀ GÃY — vẫn đếm từ hôm qua', () => {
    // Không có luật này thì mỗi sáng mở app ai cũng thấy chuỗi về 0 cho tới lúc bấm —
    // đúng kiểu "app n** n**" founder đã bác (D139).
    const r = tinhChuoi(S('2026-08-29', '2026-08-30'), '2026-08-31');
    expect(r.chuoi).toBe(2);
    expect(r.homNayXong).toBe(false);
    expect(r.daDungBaoHiem).toBe(0);
  });

  it('lỡ ĐÚNG MỘT ngày ⇒ bảo hiểm tha, mạch không đứt, ngày lỡ KHÔNG tính là có mặt', () => {
    // có: 28, 29, (lỡ 30), 31
    const r = tinhChuoi(S('2026-08-28', '2026-08-29', '2026-08-31'), '2026-08-31');
    expect(r.chuoi).toBe(3);          // 31, 29, 28 — ba ngày CÓ MẶT
    expect(r.daDungBaoHiem).toBe(1);
  });

  it('lỡ HAI ngày trong cùng cửa sổ 7 ngày ⇒ mạch đứt ở ngày lỡ thứ hai', () => {
    // có: 27, (lỡ 28), (lỡ 29), 30, 31
    const r = tinhChuoi(S('2026-08-27', '2026-08-30', '2026-08-31'), '2026-08-31');
    expect(r.chuoi).toBe(2);          // chỉ 31 và 30
    /*
     * ⚠ 0 CHỨ KHÔNG PHẢI 1 — và đây là chỗ vector chép tay dạy lại chính tôi.
     * Suất bảo hiểm CÓ bị tiêu ở ngày 29, nhưng nó không bắc cầu tới đâu cả: ngày 28
     * cũng vắng nên mạch đứt ngay sau đó. Con số này để UI nói "còn mấy suất trong
     * mạch ĐANG SỐNG"; một suất tiêu trong mạch đã chết thì không có gì để báo.
     */
    expect(r.daDungBaoHiem).toBe(0);
  });

  it('hai ngày lỡ CÁCH NHAU HƠN 7 NGÀY ⇒ mỗi cửa sổ một suất, mạch vẫn sống', () => {
    const co = new Set<string>();
    // 2026-08-01 .. 2026-08-31, bỏ 30 và 20
    for (let d = 1; d <= 31; d++) {
      if (d === 30 || d === 20) continue;
      co.add(`2026-08-${String(d).padStart(2, '0')}`);
    }
    const r = tinhChuoi(co, '2026-08-31');
    expect(r.chuoi).toBe(29);         // 31 ngày − 2 ngày lỡ
    expect(r.daDungBaoHiem).toBe(2);
  });

  it('sổ rỗng ⇒ chuỗi 0, và không ném', () => {
    expect(tinhChuoi(new Set(), '2026-08-31')).toEqual(
      { chuoi: 0, daDungBaoHiem: 0, homNayXong: false });
  });

  it('bỏ bẵng một tháng ⇒ chuỗi 0', () => {
    const r = tinhChuoi(S('2026-07-01', '2026-07-02'), '2026-08-31');
    expect(r.chuoi).toBe(0);
  });

  it('ngày sai định dạng ⇒ ném rõ ràng, không trả số bịa', () => {
    expect(() => tinhChuoi(new Set(), 'hom-nay')).toThrow(/không hợp lệ/);
  });
});

describe('§II — NÂNG CẤP MỘT CHIỀU của trạng thái ngày (D140)', () => {
  it('lên bậc được, cùng bậc sửa được, TỤT thì không', () => {
    expect(napCapDuoc(null, 'tron')).toBe(true);
    expect(napCapDuoc('tron', 'khong_tieu')).toBe(true);
    expect(napCapDuoc('khong_tieu', 'co_ghi')).toBe(true);
    // cùng bậc: user tự sửa lời khai trong ngày — hợp lệ (P1), cú sửa là data (P17)
    expect(napCapDuoc('khong_tieu', 'tieu_it')).toBe(true);
    expect(napCapDuoc('tieu_it', 'khong_tieu')).toBe(true);
    // TỤT về "chưa nói gì" là xoá bằng chứng, không phải sửa
    expect(napCapDuoc('khong_tieu', 'tron')).toBe(false);
    expect(napCapDuoc('co_ghi', 'tron')).toBe(false);
    expect(napCapDuoc('co_ghi', 'khong_tieu')).toBe(false);
  });

  it('ghi thật: trơn → có_ghi nâng cấp; có_ghi → trơn bị bỏ qua, KHÔNG ghi đè', async () => {
    const u = await createTestUser(db.pool);
    const a = await trongTx((c) => ghiDiemDanh(c, u.userId, 'tron'));
    expect(a.moi).toBe(true);
    const b = await trongTx((c) => ghiDiemDanh(c, u.userId, 'co_ghi'));
    expect(b.moi).toBe(false);
    expect(b.boQua).toBe(false);
    const x = await trongTx((c) => ghiDiemDanh(c, u.userId, 'tron'));
    expect(x.boQua).toBe(true);
    expect(x.trangThai).toBe('co_ghi');   // giữ nguyên trạng thái cao hơn

    const r = await db.pool.query(
      `SELECT trang_thai FROM pfm_ngay WHERE user_id = $1`, [u.userId]);
    expect(r.rowCount).toBe(1);           // vẫn ĐÚNG MỘT dòng cho hôm nay
    expect(r.rows[0].trang_thai).toBe('co_ghi');
  });

  it('điểm danh hai lần trong ngày không tạo dòng thứ hai', async () => {
    const u = await createTestUser(db.pool);
    await trongTx((c) => ghiDiemDanh(c, u.userId, 'khong_tieu'));
    await trongTx((c) => ghiDiemDanh(c, u.userId, 'khong_tieu'));
    const r = await db.pool.query(
      `SELECT count(*)::int AS n FROM pfm_ngay WHERE user_id = $1`, [u.userId]);
    expect(r.rows[0].n).toBe(1);
  });

  it('docChuoi đọc đúng sau khi điểm danh hôm nay', async () => {
    const u = await createTestUser(db.pool);
    const truoc = await docChuoi(db.pool, u.userId);
    expect(truoc.chuoi).toBe(0);
    expect(truoc.homNayXong).toBe(false);
    await trongTx((c) => ghiDiemDanh(c, u.userId, 'co_ghi'));
    const sau = await docChuoi(db.pool, u.userId);
    expect(sau.chuoi).toBe(1);
    expect(sau.homNayXong).toBe(true);
    expect(sau.ngay).toBe(await homNayCuaUser(db.pool, u.userId));
  });
});

describe('§III — TOKEN: trần ngày, ví khớp sổ, không âm', () => {
  it('cấp token ghi sổ và ví khớp từng đơn vị', async () => {
    const u = await createTestUser(db.pool);
    const r = await trongTx((c) => capToken(c, u.userId, 5, 'moc_su_kien', 'moc:x'));
    expect(r.cap).toBe(true);
    expect(r.soDu).toBe(5);
    const vi = await docViToken(db.pool, u.userId);
    expect(vi.soDu).toBe(5);
    expect(vi.daPhatHomNay).toBe(5);
  });

  it('⭐ TRẦN NGÀY chặn đúng chỗ, và cú bị chặn KHÔNG ghi gì', async () => {
    const u = await createTestUser(db.pool);
    await trongTx((c) => capToken(c, u.userId, PFM.TRAN_TOKEN_NGAY, 'phan_quyet_tuan'));
    const r = await trongTx((c) => capToken(c, u.userId, 1, 'moc_su_kien'));
    expect(r.cap).toBe(false);
    expect(r.lyDoTuChoi).toBe('tran_ngay');
    const vi = await docViToken(db.pool, u.userId);
    expect(vi.soDu).toBe(PFM.TRAN_TOKEN_NGAY);      // không nhích một đơn vị
    const n = await db.pool.query(
      `SELECT count(*)::int AS n FROM pfm_token_ledger WHERE user_id = $1`, [u.userId]);
    expect(n.rows[0].n).toBe(1);                     // đúng một dòng, không có dòng ma
  });

  it('TIÊU token KHÔNG bị trần ngày chặn (trần giới hạn IN tiền, không cản tiêu đồ)', async () => {
    const u = await createTestUser(db.pool);
    await trongTx((c) => capToken(c, u.userId, PFM.TRAN_TOKEN_NGAY, 'phan_quyet_tuan'));
    const r = await trongTx((c) => capToken(c, u.userId, -4, 'mua_shop', 'skin:1'));
    expect(r.cap).toBe(true);
    expect(r.soDu).toBe(PFM.TRAN_TOKEN_NGAY - 4);
  });

  it('tiêu quá số dư ⇒ từ chối, ví không âm', async () => {
    const u = await createTestUser(db.pool);
    await trongTx((c) => capToken(c, u.userId, 3, 'moc_su_kien'));
    const r = await trongTx((c) => capToken(c, u.userId, -10, 'mua_shop'));
    expect(r.cap).toBe(false);
    expect(r.lyDoTuChoi).toBe('am_vi');
    expect((await docViToken(db.pool, u.userId)).soDu).toBe(3);
  });

  it('delta 0 hoặc không nguyên ⇒ ném (không im lặng ghi một dòng vô nghĩa)', async () => {
    const u = await createTestUser(db.pool);
    await expect(trongTx((c) => capToken(c, u.userId, 0, 'moc_su_kien'))).rejects.toThrow();
    await expect(trongTx((c) => capToken(c, u.userId, 1.5, 'moc_su_kien'))).rejects.toThrow();
  });

  it('⭐ HAI CÚ PHÁT SONG SONG không vượt được trần (chống TOCTOU)', async () => {
    const u = await createTestUser(db.pool);
    const nua = Math.floor(PFM.TRAN_TOKEN_NGAY / 2) + 1;   // hai cú này cộng lại > trần
    const [a, b] = await Promise.all([
      trongTx((c) => capToken(c, u.userId, nua, 'moc_su_kien')),
      trongTx((c) => capToken(c, u.userId, nua, 'moc_su_kien')),
    ]);
    const qua = [a, b].filter((x) => x.cap).length;
    expect(qua, 'chỉ một trong hai cú được qua').toBe(1);
    expect((await docViToken(db.pool, u.userId)).soDu).toBe(nua);
  });
});

describe('§IV — XOÁ SẠCH (P9 🔒): một hàm, và nó xoá THẬT', () => {
  async function dungDayDu(userId: string) {
    await trongTx(async (c) => {
      await ghiDiemDanh(c, userId, 'co_ghi');
      await capToken(c, userId, 6, 'moc_su_kien');
      await c.query(
        `INSERT INTO pfm_tuan (user_id, tuan, token_thuong) VALUES ($1, '2026-08-24', 3)`,
        [userId]);
      await c.query(
        `INSERT INTO pfm_cup (user_id, cup_id) VALUES ($1, 'nhip_7')`, [userId]);
      await c.query(
        `INSERT INTO pfm_dac_trung (user_id, ky, lop, ma, gia_tri, schema_version)
         VALUES ($1, '2026-08-01', 'behavior', 'hv_ngay_co_mat', '9'::jsonb, 1)`, [userId]);
      await c.query(
        `INSERT INTO pfm_luu (user_id, thang, the_he, blob, schema_v)
         VALUES ($1, '2026-08-01', 1, $2, 1)`, [userId, Buffer.from('xxx')]);
      // Bật CẢ BỐN cửa (0061) — tên cột từ config, để bài xoá chứng minh nó đóng đủ bốn.
      await c.query(
        `UPDATE users SET pfm_consent = TRUE, pfm_bat_dau = now(),
                ${CUA_PFM.map((cua) => `${CUA_PFM_COT[cua]} = TRUE`).join(', ')}
          WHERE user_id = $1`,
        [userId]);
    });
  }

  it('xoá sạch cả SÁU bảng + trả ví/consent về mặc định', async () => {
    const u = await createTestUser(db.pool);
    await dungDayDu(u.userId);

    const tk = await trongTx((c) => xoaSachPfm(c, u.userId));
    expect(tk.pfm_ngay).toBe(1);
    expect(tk.pfm_token_ledger).toBe(1);
    expect(tk.pfm_tuan).toBe(1);
    expect(tk.pfm_cup).toBe(1);
    expect(tk.pfm_dac_trung).toBe(1);
    expect(tk.pfm_luu).toBe(1);

    for (const b of ['pfm_ngay', 'pfm_tuan', 'pfm_token_ledger', 'pfm_cup',
      'pfm_dac_trung', 'pfm_luu']) {
      const r = await db.pool.query(
        `SELECT count(*)::int AS n FROM ${b} WHERE user_id = $1`, [u.userId]);
      expect(r.rows[0].n, `${b} còn sót dòng`).toBe(0);
    }
    const us = await db.pool.query(
      `SELECT pfm_token, pfm_consent, pfm_bat_dau,
              ${CUA_PFM.map((cua) => `${CUA_PFM_COT[cua]} AS ${cua}`).join(', ')}
         FROM users WHERE user_id = $1`, [u.userId]);
    expect(Number(us.rows[0].pfm_token)).toBe(0);
    expect(us.rows[0].pfm_consent).toBe(false);
    expect(us.rows[0].pfm_bat_dau).toBeNull();
    // Xoá sạch mà để một cửa còn mở là để một đường dữ liệu mở cho người vừa rút lại tất cả.
    for (const cua of CUA_PFM) expect(us.rows[0][cua], `cửa ${cua} phải đóng sau xoá`).toBe(false);
  });

  it('⭐⭐ xoá sạch ghi VẾT RÚT LẠI `pfm_tat{cua}` cho ĐÚNG những cửa đang mở', async () => {
    /*
     * `POST /pfm/consent` ghi vết cho mỗi cửa tắt tay; đường rút lại MẠNH NHẤT — xoá sạch,
     * và `/account/delete` cũng đi qua đây — từng im lặng. Ai dựng lại lịch sử đồng ý từ
     * `events` sẽ thấy bốn cửa vẫn "đang đồng ý" sau khi người ta đã xoá tất cả.
     */
    const u = await createTestUser(db.pool);
    await dungDayDu(u.userId);                       // bật CẢ BỐN cửa
    await trongTx((c) => c.query(
      `UPDATE users SET ${CUA_PFM_COT.noi_game} = FALSE WHERE user_id = $1`, [u.userId]));

    await trongTx((c) => xoaSachPfm(c, u.userId));

    const vet = await db.pool.query(
      `SELECT value_json->>'cua' AS cua FROM events
        WHERE user_id = $1 AND action_type = 'pfm_tat' ORDER BY 1`, [u.userId]);
    expect(vet.rows.map((r) => r.cua).sort())
      .toEqual(CUA_PFM.filter((c) => c !== 'noi_game').slice().sort());

    // Người chưa bật cửa nào ⇒ không có vết rút lại nào để ghi.
    const v = await createTestUser(db.pool);
    await trongTx((c) => xoaSachPfm(c, v.userId));
    const khong = await db.pool.query(
      `SELECT count(*)::int AS n FROM events WHERE user_id = $1 AND action_type = 'pfm_tat'`,
      [v.userId]);
    expect(khong.rows[0].n).toBe(0);
  });

  it('xoá xong vẫn dùng lại được từ đầu (không để lại trạng thái kẹt)', async () => {
    const u = await createTestUser(db.pool);
    await dungDayDu(u.userId);
    await trongTx((c) => xoaSachPfm(c, u.userId));
    const r = await trongTx((c) => capToken(c, u.userId, 2, 'moc_su_kien'));
    expect(r.cap).toBe(true);
    expect(r.soDu).toBe(2);
  });

  it('⚠ KHÔNG đụng events — nhịp PFM ở đó là xác số học vô danh (K5)', async () => {
    const u = await createTestUser(db.pool);
    await db.pool.query(
      `INSERT INTO events (user_id, context_type, context_id, action_type, value_json)
       VALUES ($1::uuid, 'pfm', $2::uuid, 'pfm_diem_danh', '{"trang_thai":"co_ghi"}'::jsonb)`,
      [u.userId, u.userId]);
    await trongTx((c) => xoaSachPfm(c, u.userId));
    const r = await db.pool.query(
      `SELECT count(*)::int AS n FROM events WHERE user_id = $1`, [u.userId]);
    expect(r.rows[0].n, 'events là append-only, xoá PFM không được đụng').toBe(1);
  });

  it('⭐ ĐƯỜNG XOÁ TÀI KHOẢN cũng gọi cùng hàm này — không phải hai bản cài đặt', () => {
    /*
     * Bài này đọc MÃ NGUỒN, và nó cố ý như vậy. Lỗ ban đầu không phải một hàm sai —
     * nó là một hàm ĐÚNG mà KHÔNG AI GỌI ở đường thứ hai: `/account/delete` chỉ ẩn
     * danh hoá `users` rồi đi tiếp, để nguyên mọi bảng `pfm_*`. Không bài test nào
     * dựng-rồi-đo bắt được kiểu lỗ đó, vì thứ thiếu là một LỜI GỌI.
     */
    const app = fs.readFileSync(new URL('../server/app.ts', import.meta.url), 'utf8');
    const i = app.indexOf("'/api/v1/account/delete'");
    expect(i, 'không thấy route xoá tài khoản').toBeGreaterThan(0);
    const than = app.slice(i, i + 4000);
    expect(than, 'route xoá tài khoản phải gọi xoaSachPfm (P9 🔒)')
      .toContain('xoaSachPfm(client, actor.userId)');
    // và phải gọi TRƯỚC khi ẩn danh hoá — sau đó thì user_id vẫn còn nhưng ý nghĩa đã đổi
    expect(than.indexOf('xoaSachPfm'), 'phải xoá PFM trước khi ẩn danh hoá')
      .toBeLessThan(than.indexOf("'da_xoa_'"));
  });
});

describe('§V — NIÊM PHONG TUẦN (K7, GĐ2): idempotent + công thức placeholder', () => {
  /*
   * ⚠⚠ NGÀY CỐ ĐỊNH, KHÔNG DÙNG ĐỒNG HỒ THẬT — và đây là bài học phải trả giá thật.
   *
   * Rào Chủ nhật (`chua_diem_danh_hom_nay`) làm hành vi phụ thuộc THỨ TRONG TUẦN: khi
   * "hôm nay" đúng là ngày cuối của tuần được niêm phong, cú niêm phong bị từ chối nếu
   * hôm ấy chưa điểm danh. Bộ test cũ đọc đồng hồ thật ⇒ **xanh sáu ngày, đỏ vào Chủ
   * nhật** — và nó đã đỏ thật, đúng vào hôm mã vừa lên prod, làm cả nhóm tưởng prod hỏng.
   * (Prod không hỏng: rào bắn đúng như founder đã chốt 05/09.)
   *
   * ⇒ `NGAY_THU` là một thứ TƯ, nên tuần được niêm phong là tuần TRƯỚC nó và ngày cuối
   *   tuần ấy KHÔNG phải hôm nay ⇒ rào không bắn. Ca "đúng ngày cuối tuần" có bài riêng
   *   ở dưới, cũng bằng ngày cố định.
   */
  const NGAY_THU = '2026-09-09';                    // thứ Tư
  const TUAN_THU = tuanNiemPhongTuNgay(NGAY_THU);   // ⇒ 2026-08-31 (thứ Hai tuần trước)

  async function diemDanhNgay(userId: string, offsetNgay: number) {
    // Ghi thẳng vào pfm_ngay (không qua ghiDiemDanh) để đặt được NGÀY CỤ THỂ trong
    // tuần đang xét — ghiDiemDanh luôn dùng "hôm nay" thật, không nhận ngày giả.
    await db.pool.query(
      `INSERT INTO pfm_ngay (user_id, ngay, trang_thai)
       VALUES ($1, $2::date + $3::int, 'co_ghi')
       ON CONFLICT (user_id, ngay) DO NOTHING`,
      [userId, TUAN_THU, offsetNgay]);
  }

  /*
   * ⚠⚠ RÀO CHỦ NHẬT, ĐO TẤT ĐỊNH — trước lượt này nó chỉ được kiểm bằng một nhánh `if`
   * chạy đúng vào Chủ nhật, tức sáu ngày trong tuần nó KHÔNG kiểm gì cả. Với seam ngày
   * cố định thì cả hai nhánh chạy mọi lúc.
   */
  const NGAY_CN = '2026-09-06';                   // Chủ nhật
  const TUAN_CN = tuanNiemPhongTuNgay(NGAY_CN);   // CN ⇒ TUẦN NÀY (2026-08-31)

  it('⭐⭐ CN + CHƯA điểm danh hôm nay ⇒ TỪ CHỐI, và không giành chỗ', async () => {
    const u = await createTestUser(db.pool);
    // có mặt thứ Hai, nhưng KHÔNG có mặt Chủ nhật (hôm nay)
    await db.pool.query(
      `INSERT INTO pfm_ngay (user_id, ngay, trang_thai) VALUES ($1, $2::date, 'co_ghi')`,
      [u.userId, TUAN_CN]);

    const kq = await trongTx((c) => niemPhongTuan(c, u.userId, NGAY_CN));
    expect(kq.lyDoTuChoi).toBe('chua_diem_danh_hom_nay');
    expect(kq.moi, 'từ chối KHÁC "đã niêm phong rồi"').toBe(false);
    const co = await db.pool.query(
      `SELECT count(*)::int AS n FROM pfm_tuan WHERE user_id = $1`, [u.userId]);
    expect(co.rows[0].n, 'bị chặn thì KHÔNG được giành chỗ').toBe(0);
  });

  it('⭐⭐ CN + ĐÃ điểm danh hôm nay ⇒ niêm phong được, đếm cả ngày hôm nay', async () => {
    const u = await createTestUser(db.pool);
    for (const off of [0, 6]) {                   // thứ Hai và CHÍNH Chủ nhật
      await db.pool.query(
        `INSERT INTO pfm_ngay (user_id, ngay, trang_thai)
         VALUES ($1, $2::date + $3::int, 'co_ghi')`, [u.userId, TUAN_CN, off]);
    }
    const kq = await trongTx((c) => niemPhongTuan(c, u.userId, NGAY_CN));
    expect(kq.lyDoTuChoi).toBeUndefined();
    expect(kq.moi).toBe(true);
    expect(kq.tokenThuong, 'hai ngày có mặt').toBe(2 * PFM.TOKEN_MOC_VI_MO);
  });

  it('⭐ T2 niêm phong ĐÚNG tuần vừa qua ⇒ chờ tới T2 không bỏ mất tuần nào', () => {
    // Đây là vế "không mất gì" của rào: chưa điểm danh CN thì chờ T2, mà T2 vẫn niêm
    // phong đúng cái tuần ấy.
    expect(tuanNiemPhongTuNgay('2026-09-07')).toBe(TUAN_CN);
  });

  it('0 ngày có mặt ⇒ niêm phong vẫn thành công, token 0', async () => {
    const u = await createTestUser(db.pool);
    const kq = await trongTx((c) => niemPhongTuan(c, u.userId, NGAY_THU));
    expect(kq.moi).toBe(true);
    expect(kq.tokenThuong).toBe(0);
    expect(kq.soNgayCoMat).toBe(0);
  });

  it('N ngày có mặt ⇒ token = N × TOKEN_MOC_VI_MO (chưa chạm trần tuần)', async () => {
    const u = await createTestUser(db.pool);
    for (let i = 0; i < 3; i++) await diemDanhNgay(u.userId, i);
    const kq = await trongTx((c) => niemPhongTuan(c, u.userId, NGAY_THU));
    expect(kq.soNgayCoMat).toBe(3);
    expect(kq.tokenThuong).toBe(3 * PFM.TOKEN_MOC_VI_MO);
    expect((await docViToken(db.pool, u.userId)).soDu).toBe(3 * PFM.TOKEN_MOC_VI_MO);
  });

  it('⭐ token KẸP đúng ở TOKEN_TUAN_TOI_DA, không vượt dù có mặt đủ 7 ngày', async () => {
    const u = await createTestUser(db.pool);
    for (let i = 0; i < 7; i++) await diemDanhNgay(u.userId, i);
    const kq = await trongTx((c) => niemPhongTuan(c, u.userId, NGAY_THU));
    expect(kq.soNgayCoMat).toBe(7);
    const kyVong = Math.min(7 * PFM.TOKEN_MOC_VI_MO, PFM.TOKEN_TUAN_TOI_DA);
    expect(kq.tokenThuong).toBe(kyVong);
    if (7 * PFM.TOKEN_MOC_VI_MO > PFM.TOKEN_TUAN_TOI_DA) {
      expect(kq.tokenThuong).toBe(PFM.TOKEN_TUAN_TOI_DA);   // xác nhận có kẹp thật, không tình cờ khớp
    }
  });

  it('⭐ NIÊM PHONG LẦN HAI cùng tuần: moi=false, token GIỮ NGUYÊN, KHÔNG phát đúp', async () => {
    const u = await createTestUser(db.pool);
    await diemDanhNgay(u.userId, 0);
    await diemDanhNgay(u.userId, 1);
    const a = await trongTx((c) => niemPhongTuan(c, u.userId, NGAY_THU));
    expect(a.moi).toBe(true);

    // Thêm ngày có mặt SAU khi đã niêm phong — không được tính lại.
    await diemDanhNgay(u.userId, 2);
    const b = await trongTx((c) => niemPhongTuan(c, u.userId, NGAY_THU));
    expect(b.moi).toBe(false);
    expect(b.tokenThuong).toBe(a.tokenThuong);

    const n = await db.pool.query(
      `SELECT count(*)::int AS n FROM pfm_token_ledger WHERE user_id = $1 AND reason = 'phan_quyet_tuan'`,
      [u.userId]);
    expect(n.rows[0].n, 'chỉ đúng MỘT dòng sổ cái cho một tuần').toBe(1);
    expect((await docViToken(db.pool, u.userId)).soDu).toBe(a.tokenThuong);   // không tăng thêm
  });

  it('chạm TRẦN NGÀY (do mốc khác đã ăn hết suất) ⇒ vẫn niêm phong (moi=true), token=0', async () => {
    const u = await createTestUser(db.pool);
    await diemDanhNgay(u.userId, 0);
    // Lấp đầy trần/ngày bằng một mốc KHÁC trước khi niêm phong.
    await trongTx((c) => capToken(c, u.userId, PFM.TRAN_TOKEN_NGAY, 'moc_su_kien'));

    const kq = await trongTx((c) => niemPhongTuan(c, u.userId, NGAY_THU));
    expect(kq.moi, 'ritual và kinh tế là hai trục tách nhau — ritual không được ăn theo trần').toBe(true);
    expect(kq.tokenThuong).toBe(0);

    const r = await db.pool.query(`SELECT count(*)::int AS n FROM pfm_tuan WHERE user_id = $1`, [u.userId]);
    expect(r.rows[0].n).toBe(1);   // niêm phong vẫn ghi, chỉ token = 0
  });

  it('⭐ HAI CÚ NIÊM PHONG SONG SONG cùng tuần: chỉ MỘT được token thật (chống đua)', async () => {
    const u = await createTestUser(db.pool);
    await diemDanhNgay(u.userId, 0);
    await diemDanhNgay(u.userId, 1);
    const [a, b] = await Promise.all([
      trongTx((c) => niemPhongTuan(c, u.userId, NGAY_THU)),
      trongTx((c) => niemPhongTuan(c, u.userId, NGAY_THU)),
    ]);
    const moiCount = [a, b].filter((x) => x.moi).length;
    expect(moiCount, 'chỉ một trong hai cú được coi là niêm phong THẬT').toBe(1);

    const n = await db.pool.query(
      `SELECT count(*)::int AS n FROM pfm_token_ledger WHERE user_id = $1 AND reason = 'phan_quyet_tuan'`,
      [u.userId]);
    expect(n.rows[0].n, 'không được có hai dòng sổ cái cho cùng một tuần').toBe(1);
  });

  it('docTrangThaiTuan đọc đúng trước/sau niêm phong, không mở transaction', async () => {
    const u = await createTestUser(db.pool);
    // D327 — ép CÙNG ngày với cú niêm phong: không ép thì bài so tuần của NGAY_THU với tuần
    // của đồng hồ thật, và đỏ chắc chắn mọi ngày ngoài tuần kế tiếp của NGAY_THU.
    const truoc = await docTrangThaiTuan(db.pool, u.userId, NGAY_THU);
    expect(truoc.daNiemPhong).toBe(false);
    expect(truoc.tokenThuong).toBe(0);

    await diemDanhNgay(u.userId, 0);
    await trongTx((c) => niemPhongTuan(c, u.userId, NGAY_THU));
    const sau = await docTrangThaiTuan(db.pool, u.userId, NGAY_THU);
    expect(sau.daNiemPhong).toBe(true);
    expect(sau.tokenThuong).toBe(PFM.TOKEN_MOC_VI_MO);
    expect(sau.tuan).toBe(tuanNiemPhongTuNgay(NGAY_THU));
    expect(sau.soNgayCoMat).toBe(1);
  });
});

describe('§V-bis — tuanNiemPhongTuNgay (R4, D251): tuần gần nhất ĐÃ KẾT THÚC', () => {
  /*
   * ⚠ VECTOR CHÉP TAY, không sinh bằng chính công thức đang test (A5.2/A11.6).
   * Tuần ISO 2026-08-31 (T2) … 2026-09-06 (CN). Bảy ngày của tuần KẾ TIẾP phải
   * ra cùng một đáp án — trừ đúng Chủ nhật, ngày mà tuần hiện tại vừa đóng.
   */
  const NEO = '2026-08-31';   // thứ Hai của tuần đã kết thúc CN 06/09
  it.each([
    ['2026-09-07', 'T2', NEO],
    ['2026-09-08', 'T3', NEO],
    ['2026-09-09', 'T4', NEO],
    ['2026-09-10', 'T5', NEO],
    ['2026-09-11', 'T6', NEO],
    ['2026-09-12', 'T7', NEO],
    ['2026-09-13', 'CN', '2026-09-07'],   // CN ⇒ tuần NÀY, vì hôm nay là ngày cuối của nó
  ])('%s (%s) ⇒ niêm phong tuần %s', (ngay, _thu, mong) => {
    expect(tuanNiemPhongTuNgay(ngay)).toBe(mong);
  });

  it('Chủ nhật 06/09 ⇒ chính tuần 31/08, không phải tuần trước', () => {
    expect(tuanNiemPhongTuNgay('2026-09-06')).toBe(NEO);
  });

});

describe('§VI — kiemDongDacTrung (hàm thuần, GĐ4): registry-driven, không cần DB', () => {
  it('dòng context hợp lệ (không doi_tuong) ⇒ null', () => {
    expect(kiemDongDacTrung({ ma: 'ctx_tu_lap', gia_tri: 'tu_lap' })).toBeNull();
  });

  it('dòng intent hợp lệ VỚI doi_tuong (theo_doi_tuong=true) ⇒ null', () => {
    expect(kiemDongDacTrung({ ma: 'y_loai', doi_tuong: 'hu_1', gia_tri: 'giao_duc' })).toBeNull();
  });

  it('⭐ theo_doi_tuong=true mà THIẾU doi_tuong ⇒ từ chối', () => {
    expect(kiemDongDacTrung({ ma: 'y_loai', gia_tri: 'giao_duc' })).toMatch(/bắt buộc doi_tuong/);
  });

  it('⭐ theo_doi_tuong không đặt (mặc định false) mà CÓ doi_tuong ⇒ từ chối', () => {
    expect(kiemDongDacTrung({ ma: 'ctx_tu_lap', doi_tuong: 'hu_1', gia_tri: 'tu_lap' }))
      .toMatch(/không nhận doi_tuong/);
  });

  it('mã lạ ⇒ từ chối', () => {
    expect(kiemDongDacTrung({ ma: 'ma_bia_dat', gia_tri: 1 })).toMatch(/mã lạ/);
  });

  it('⭐ lớp intervention bị chặn ở cửa client dù mã hợp lệ trong registry', () => {
    expect(kiemDongDacTrung({ ma: 'iv_du_dieu_kien', doi_tuong: 'oracle_1', gia_tri: 1 }))
      .toMatch(/intervention không nhận qua cửa client/);
  });

  it('giá trị ngoài miền ⇒ uỷ quyền đúng cho kiemGiaTri (không viết lại kiểm)', () => {
    expect(kiemDongDacTrung({ ma: 'hv_ngay_co_mat', gia_tri: 99 })).toMatch(/ngoài \[0,31\]/);
  });

  it('nguon ngoài tu_khai/xac_minh ⇒ từ chối', () => {
    expect(kiemDongDacTrung({ ma: 'ctx_tu_lap', gia_tri: 'tu_lap', nguon: 'bia_dat' as any }))
      .toMatch(/tu_khai hoặc xac_minh/);
  });

  it('phần tử không phải object (vào từ HTTP, unknown thật) ⇒ từ chối, không ném', () => {
    expect(kiemDongDacTrung(null as any)).toMatch(/phải là object/);
    expect(kiemDongDacTrung('x' as any)).toMatch(/phải là object/);
  });
});

describe('§VII — napGoiDacTrung (GĐ4 + R7/D251): kỳ do client nêu trong cửa sổ server mở', () => {
  /*
   * ⚠ `kySong` tính từ CHÍNH DB, không từ đồng hồ máy chạy test: `thangSongCuaUser`
   * đọc `users.mui_gio`, nên một máy CI ở múi giờ khác sẽ lệch tháng đúng vào ngày
   * cuối/đầu tháng — loại lỗi chỉ đỏ hai ngày một tháng và không ai dựng lại được.
   */
  let kySong = '';
  beforeAll(async () => {
    const u = await createTestUser(db.pool);
    kySong = (await thangSongCuaUser(db.pool, u.userId)).slice(0, 7);
  });

  it('gói rỗng ⇒ không ghi gì, vẫn trả ky đúng', async () => {
    const u = await createTestUser(db.pool);
    const kq = await trongTx((c) => napGoiDacTrung(c, u.userId, kySong, []));
    expect(kq.soDong).toBe(0);
    expect(kq.ky).toBe(await thangSongCuaUser(db.pool, u.userId));
  });

  it('ghi đúng lớp/giá trị; ky do SERVER tính — client không có cách nào gửi ky', async () => {
    const u = await createTestUser(db.pool);
    await trongTx((c) => napGoiDacTrung(c, u.userId, kySong, [
      { ma: 'ctx_tu_lap', gia_tri: 'tu_lap' },
      { ma: 'y_loai', doi_tuong: 'hu_1', gia_tri: 'giao_duc' },
    ]));
    const r = await db.pool.query(
      // ⚠ ĐỊNH DẠNG NGAY TRONG SQL — `pg` parse cột DATE thành `Date` ở NỬA ĐÊM GIỜ
      // ĐỊA PHƯƠNG của máy chạy test (không phải UTC); gọi `.toISOString()` trên
      // đó rồi so chuỗi sẽ lệch một ngày tuỳ múi giờ hệ điều hành. `to_char` né
      // hẳn việc đi qua JS Date cho phép so sánh.
      `SELECT to_char(ky, 'YYYY-MM-DD') AS ky, lop, ma, doi_tuong, gia_tri FROM pfm_dac_trung
        WHERE user_id = $1 ORDER BY ma`, [u.userId]);
    expect(r.rowCount).toBe(2);
    const ky = await thangSongCuaUser(db.pool, u.userId);
    for (const row of r.rows) expect(row.ky).toBe(ky);
    expect(r.rows.find((x) => x.ma === 'ctx_tu_lap')?.lop).toBe('context');
    expect(r.rows.find((x) => x.ma === 'y_loai')?.doi_tuong).toBe('hu_1');
  });

  it('⭐ GỬI LẠI cùng khoá (user, ky, lop, ma, doi_tuong) ⇒ UPSERT ghi đè, KHÔNG cộng dòng', async () => {
    const u = await createTestUser(db.pool);
    await trongTx((c) => napGoiDacTrung(c, u.userId, kySong, [{ ma: 'ctx_tu_lap', gia_tri: 'phu_thuoc' }]));
    await trongTx((c) => napGoiDacTrung(c, u.userId, kySong, [{ ma: 'ctx_tu_lap', gia_tri: 'tu_lap' }]));
    const r = await db.pool.query(
      `SELECT gia_tri FROM pfm_dac_trung WHERE user_id = $1 AND ma = 'ctx_tu_lap'`, [u.userId]);
    expect(r.rowCount, 'UPSERT — vẫn đúng MỘT dòng, không phải hai').toBe(1);
    expect(r.rows[0].gia_tri).toBe('tu_lap');   // giá trị MỚI thắng
  });

  it('gửi lại MỘT ma/doi_tuong khác trong cùng kỳ KHÔNG đụng các dòng khác của kỳ đó', async () => {
    const u = await createTestUser(db.pool);
    await trongTx((c) => napGoiDacTrung(c, u.userId, kySong, [{ ma: 'ctx_tu_lap', gia_tri: 'tu_lap' }]));
    await trongTx((c) => napGoiDacTrung(c, u.userId, kySong,
      [{ ma: 'y_loai', doi_tuong: 'hu_1', gia_tri: 'du_lich' }]));
    const r = await db.pool.query(
      `SELECT count(*)::int AS n FROM pfm_dac_trung WHERE user_id = $1`, [u.userId]);
    expect(r.rows[0].n).toBe(2);   // cả hai dòng còn nguyên, không cái nào bị ghi đè bởi cái kia
  });

  it('⭐ VƯỢT TRẦN doi_tuong/kỳ ⇒ từ chối CẢ GÓI, không ghi nửa vời', async () => {
    const u = await createTestUser(db.pool);
    const dongLap: DongDacTrungVao[] = Array.from({ length: PFM.TRAN_DOI_TUONG_KY + 1 },
      (_, i) => ({ ma: 'y_loai' as const, doi_tuong: `hu_${i}`, gia_tri: 'khac' }));
    await expect(trongTx((c) => napGoiDacTrung(c, u.userId, kySong, dongLap)))
      .rejects.toThrow(DacTrungKhongHopLe);
    const r = await db.pool.query(
      `SELECT count(*)::int AS n FROM pfm_dac_trung WHERE user_id = $1`, [u.userId]);
    expect(r.rows[0].n, 'từ chối cả gói — không ghi nửa vời').toBe(0);
  });

  it('trần TÍNH TRÊN TỔNG hợp với dữ liệu ĐÃ CÓ, không chỉ gói vừa gửi', async () => {
    const u = await createTestUser(db.pool);
    // Lấp gần đầy trần bằng NHIỀU LẦN GỬI (mỗi lần dưới trần lô).
    for (let i = 0; i < PFM.TRAN_DOI_TUONG_KY; i++) {
      await trongTx((c) => napGoiDacTrung(c, u.userId, kySong,
        [{ ma: 'y_loai', doi_tuong: `hu_${i}`, gia_tri: 'khac' }]));
    }
    await expect(trongTx((c) => napGoiDacTrung(c, u.userId, kySong,
      [{ ma: 'y_loai', doi_tuong: 'hu_moi', gia_tri: 'khac' }])))
      .rejects.toThrow(/vượt trần/);
  });

  it('gửi lại doi_tuong ĐÃ CÓ (không phải mới) không bị tính vào trần dù đã đầy', async () => {
    const u = await createTestUser(db.pool);
    for (let i = 0; i < PFM.TRAN_DOI_TUONG_KY; i++) {
      await trongTx((c) => napGoiDacTrung(c, u.userId, kySong,
        [{ ma: 'y_loai', doi_tuong: `hu_${i}`, gia_tri: 'khac' }]));
    }
    // Gửi lại một doi_tuong ĐÃ TỒN TẠI (hu_0) — không phải đối tượng mới, không vỡ trần.
    await expect(trongTx((c) => napGoiDacTrung(c, u.userId, kySong,
      [{ ma: 'y_uu_tien', doi_tuong: 'hu_0', gia_tri: 'cao' }]))).resolves.not.toThrow();
  });

  it('dòng sai NGAY GIỮA gói ⇒ từ chối cả gói, dòng ĐÚNG trước đó không lọt qua', async () => {
    const u = await createTestUser(db.pool);
    await expect(trongTx((c) => napGoiDacTrung(c, u.userId, kySong, [
      { ma: 'ctx_tu_lap', gia_tri: 'tu_lap' },
      { ma: 'ma_bia_dat', gia_tri: 1 },
    ]))).rejects.toThrow(DacTrungKhongHopLe);
    const r = await db.pool.query(
      `SELECT count(*)::int AS n FROM pfm_dac_trung WHERE user_id = $1`, [u.userId]);
    expect(r.rows[0].n, 'cả gói bị từ chối — dòng đầu hợp lệ cũng không được lọt qua').toBe(0);
  });
});


describe('§VII-bis — R7 cửa sổ kỳ (D251): client nêu ngăn, server giữ đồng hồ', () => {
  /*
   * ⚠⚠ KHỐI NÀY SUÝT KHÔNG TỒN TẠI. Bản đầu D251 tôi chèn nó bằng `str.replace()` với
   * một cái neo KHÔNG CÓ trong tệp, và `replace` khi không khớp thì **im lặng trả lại
   * chuỗi cũ** — không lỗi, không cảnh báo. `tsc` cũng im vì `cuaSoKy` chỉ là một
   * import không dùng. Bản rà mới lộ ra: hàm cửa sổ kỳ, kể cả nhánh vắt qua NĂM, có
   * ĐÚNG 0 bài test.
   * ⇒ Luật: mọi bản vá bằng script phải ASSERT SỐ LẦN KHỚP trước khi ghi. Một phép
   * thay thế không khớp là một thay đổi đã mất, và nó trông y hệt thành công.
   */
  it('⭐ cuaSoKy trả đúng [tháng trước, tháng sống] — kể cả vắt qua mốc NĂM', () => {
    expect(cuaSoKy('2026-09-01')).toEqual(['2026-08-01', '2026-09-01']);
    expect(cuaSoKy('2026-01-01'), 'tháng 1 phải lùi sang tháng 12 NĂM TRƯỚC')
      .toEqual(['2025-12-01', '2026-01-01']);
    expect(cuaSoKy('2026-03-01'), 'tháng 3 lùi về tháng 2 (28/29 ngày)')
      .toEqual(['2026-02-01', '2026-03-01']);
  });

  it('cuaSoKy: mọi tháng trong hai năm đều trả về hai ngày MÙNG 1 liền kề', () => {
    for (let y = 2025; y <= 2026; y++) {
      for (let m = 1; m <= 12; m++) {
        const song = `${y}-${String(m).padStart(2, '0')}-01`;
        const [truoc, nay] = cuaSoKy(song);
        expect(nay).toBe(song);
        expect(truoc.endsWith('-01'), `${song} ⇒ ${truoc}`).toBe(true);
        // Liền kề: cộng một tháng vào `truoc` phải ra `song`.
        const ty = Number(truoc.slice(0, 4));
        const tm = Number(truoc.slice(5, 7));
        expect(new Date(Date.UTC(ty, tm, 1)).toISOString().slice(0, 10)).toBe(song);
      }
    }
  });

  it('⭐ kỳ HAI tháng trước bị từ chối, và KHÔNG ghi dòng nào', async () => {
    const u = await createTestUser(db.pool);
    const cu = (await db.pool.query(
      `SELECT to_char((now() AT TIME ZONE mui_gio) - interval '2 months', 'YYYY-MM') AS k
         FROM users WHERE user_id = $1`, [u.userId])).rows[0].k as string;
    await expect(trongTx((c) => napGoiDacTrung(c, u.userId, cu,
      [{ ma: 'ctx_tu_lap', gia_tri: 'tu_lap' }])))
      .rejects.toThrow(/ngoài cửa sổ/);
    const n = await db.pool.query(
      `SELECT count(*)::int AS n FROM pfm_dac_trung WHERE user_id = $1`, [u.userId]);
    expect(n.rows[0].n).toBe(0);
  });

  it('⭐ gói RỖNG mang kỳ sai VẪN bị từ chối — im lặng cho qua là mất tín hiệu client lệch giờ',
    async () => {
      const u = await createTestUser(db.pool);
      await expect(trongTx((c) => napGoiDacTrung(c, u.userId, '2020-01', [])))
        .rejects.toThrow(/ngoài cửa sổ/);
    });
});

describe('§VII-ter — trần doi_tuong (D251): ô chữ tự do cuối cùng còn hở', () => {
  it('⭐ doi_tuong dài quá trần ⇒ từ chối, có nói rõ trần', () => {
    const loi = kiemDongDacTrung({
      ma: 'y_loai', doi_tuong: 'x'.repeat(PFM.DOI_TUONG_TOI_DA + 1), gia_tri: 'giao_duc',
    } as DongDacTrungVao);
    expect(loi).toMatch(/doi_tuong dài/);
  });

  it('doi_tuong đúng bằng trần ⇒ nhận (trần là ≤, không phải <)', () => {
    expect(kiemDongDacTrung({
      ma: 'y_loai', doi_tuong: 'x'.repeat(PFM.DOI_TUONG_TOI_DA), gia_tri: 'giao_duc',
    } as DongDacTrungVao)).toBeNull();
  });
});

describe('§VII-quater — tuanNiemPhongTuNgay + ngayCuoiTuan (R4/D251)', () => {
  it('⭐ ngayCuoiTuan luôn là Chủ nhật, và cách thứ Hai đúng 6 ngày', () => {
    // ⚠ MỌI phần tử phải LÀ thứ Hai — `ngayCuoiTuan` nhận đầu vào là thứ Hai. Bản đầu
    // tôi để '2026-01-01' (thứ Năm) và bài đỏ ngay: vector chép tay vẫn phải chép ĐÚNG.
    // '2025-12-29' và '2026-12-28' là hai tuần vắt qua mốc NĂM, ở hai đầu.
    for (const t of ['2026-08-31', '2025-12-29', '2026-02-23', '2026-12-28']) {
      const cn = ngayCuoiTuan(t);
      const d = new Date(`${cn}T00:00:00Z`);
      expect(d.getUTCDay(), `${t} ⇒ ${cn}`).toBe(0);
      expect((d.getTime() - new Date(`${t}T00:00:00Z`).getTime()) / 86400_000).toBe(6);
    }
  });

  it('⭐ ngayCuoiTuan(tuanNiemPhong(d)) <= d LUÔN, và == d ĐÚNG vào Chủ nhật', () => {
    /*
     * ⚠ Đây là bài mà bản trước THIẾU: bài quét 366 ngày cũ chỉ khẳng định "kết quả là
     * thứ Hai" và "ở quá khứ" — cả hai vẫn đúng với một hàm lùi THÊM một tuần nữa.
     * Khẳng định `== d đúng vào Chủ nhật` mới ghim được ĐÚNG một hàm.
     */
    for (let i = 0; i < 366; i++) {
      const d = new Date(Date.UTC(2026, 0, 1 + i)).toISOString().slice(0, 10);
      const cn = ngayCuoiTuan(tuanNiemPhongTuNgay(d));
      const laCN = new Date(`${d}T00:00:00Z`).getUTCDay() === 0;
      expect(cn <= d, `${d} ⇒ tuần kết thúc ${cn}`).toBe(true);
      expect(cn === d, `${d}: CN=${laCN} mà tuần kết thúc ${cn}`).toBe(laCN);
    }
  });
});
