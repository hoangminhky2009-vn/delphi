/**
 * BÁCH KHOA (D334) — phần luật server phát cho trang tra cứu.
 *
 * Canh bốn điều:
 *   §I   hạng ồn đọc biên nhiễu HIỆU DỤNG của bộ luật (v45), không đọc trường gốc `bien_dong_bp`;
 *   §II  MỨC, KHÔNG PHẢI SỐ — không một chữ số nào trong luật thẻ tin (founder 25/07);
 *   §III mặt tin còn sống + kéo theo + độ giả suy đúng từ config của CHÍNH bộ luật được hỏi;
 *   §IV  catalog thật sự chở `bach_khoa` (dựng hàm mà quên nối vào route là một bài canh rỗng).
 */
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { Hono } from 'hono';
import {
  BO_LUAT_THEO_PHIEN_BAN, HOLDEM_BALANCE_VERSION, MAP_V28, SU_KIEN, TAI_SAN, TINH_CHAT_NEN,
  luatCua, mtKeTiep, type SuKienId,
} from '../config/holdem.js';
import { dungBachKhoa } from '../server/holdem/bach_khoa.js';
import { createApp } from '../server/app.js';
import { CapturingMailer } from '../server/email.js';
import { startTestDb, type TestDb } from './helpers/testdb.js';
import { createTestUser, type TestUser } from './helpers/fixtures.js';

const bk = dungBachKhoa(HOLDEM_BALANCE_VERSION);

describe('§I hạng ồn của sáu mã', () => {
  it('đủ sáu mã, hạng 1…6 không trùng', () => {
    expect(Object.keys(bk.bien_dong_hang).sort()).toEqual(TAI_SAN.map((t) => t.id).sort());
    expect(Object.values(bk.bien_dong_hang).sort()).toEqual([1, 2, 3, 4, 5, 6]);
  });

  it('⭐ đọc biên nhiễu HIỆU DỤNG: ở bộ luật mặc định vàng êm hơn VN30, dù trường gốc nói ngược lại', () => {
    const goc = (id: string) => TAI_SAN.find((t) => t.id === id)!.bien_dong_bp;
    // Tiền đề của bài: trường gốc vẫn xếp vàng ồn hơn VN30. Nếu một ngày ai sửa trường gốc thì bài
    // này mất răng — đổi sang cặp khác chứ đừng xoá.
    expect(goc('vang')).toBeGreaterThan(goc('vn30'));
    expect(luatCua(HOLDEM_BALANCE_VERSION).bienDongV45).toBe(true);
    expect(bk.bien_dong_hang.vn30!).toBeLessThan(bk.bien_dong_hang.vang!);
    expect(bk.bien_dong_hang.btc).toBe(1);
    expect(bk.bien_dong_hang.usd).toBe(6);
  });
});

describe('§II mức, không phải số', () => {
  it('⭐⭐ luật thẻ tin không chở một chữ số nào', () => {
    const chu = JSON.stringify(bk.the_tin);
    expect(chu, 'bp/trọng số/hệ số rò ra client — F12 là có bảng tra').not.toMatch(/\d/);
  });

  it('mọi trường là giá trị trong tập đã khai', () => {
    for (const t of Object.values(bk.the_tin)) {
      expect(['van_tien', 'hung_phan', 'hoang_loan', 'lech_ma']).toContain(t!.tinh_chat);
      expect(['di_ngang', 'tang', 'giam', 'bien_dong', 'phuc_hoi']).toContain(t!.bao_truoc);
      expect(['hiem', 'it', 'vua', 'hoi_hay', 'hay', 'theo_lai_suat']).toContain(t!.do_gia);
      expect(t!.keo_theo.length).toBeLessThanOrEqual(2);
    }
  });
});

describe('§III suy đúng từ config của bộ luật được hỏi', () => {
  it('⭐ bộ luật mặc định (năm mặt đuôi bật): đủ 11 mặt, không còn Thiên nga đen', () => {
    expect(luatCua(HOLDEM_BALANCE_VERSION).duoi5).toBe(true);
    const ids = Object.keys(bk.the_tin).sort();
    expect(ids).toHaveLength(11);
    expect(ids).not.toContain('thien_nga_den');
    for (const id of ids) {
      expect(bk.the_tin[id as SuKienId]!.tinh_chat).toBe(TINH_CHAT_NEN[id as SuKienId]);
      expect(bk.the_tin[id as SuKienId]!.bao_truoc).toBe(SU_KIEN.find((x) => x.id === id)!.bao_truoc);
    }
  });

  it('⭐ kéo theo bắt đúng các cạnh chính, nặng nhất đứng trước, không trỏ vào mặt đã gỡ', () => {
    expect(bk.the_tin.lam_phat!.keo_theo[0]).toBe('tang_lai_suat');
    expect(bk.the_tin.ha_lai_suat!.keo_theo).toEqual(['bong_bong']);
    expect(bk.the_tin.dich_benh!.keo_theo).toEqual(['ha_lai_suat']);
    expect(bk.the_tin.chien_tranh!.keo_theo[0]).toBe('lam_phat');
    // Sập sàn chỉ có cạnh nhỏ (dưới một trọng số nền) ⇒ không gọi tên mặt nào.
    expect(bk.the_tin.hack_san!.keo_theo).toEqual([]);
    const bang = mtKeTiep(luatCua(HOLDEM_BALANCE_VERSION).chuoiMoRong);
    for (const [tu, t] of Object.entries(bk.the_tin)) {
      expect(t!.keo_theo).not.toContain('thien_nga_den');
      const w = t!.keo_theo.map((den) => bang[tu as SuKienId][den] ?? 0);
      expect(w).toEqual([...w].sort((a, b) => b - a));
    }
  });

  it('độ giả theo bảng MAP_V28: lãi suất hiếm · lạm phát ít · sập sàn hay · chiến tranh hơi hay · bong bóng theo lãi suất', () => {
    expect(MAP_V28.NHAN_TIN_GIA_SU_KIEN.ha_lai_suat).toBeLessThanOrEqual(5000);
    expect(bk.the_tin.ha_lai_suat!.do_gia).toBe('hiem');
    expect(bk.the_tin.tang_lai_suat!.do_gia).toBe('hiem');
    expect(bk.the_tin.lam_phat!.do_gia).toBe('it');
    expect(bk.the_tin.hack_san!.do_gia).toBe('hay');
    expect(bk.the_tin.chien_tranh!.do_gia).toBe('hoi_hay');
    expect(bk.the_tin.bong_bong!.do_gia).toBe('theo_lai_suat');
    expect(bk.the_tin.dich_benh!.do_gia).toBe('vua');
  });

  it('bộ luật cũ chưa có năm mặt đuôi: có Thiên nga đen, không có năm mặt đuôi, độ giả về mức chung', () => {
    const cu = Object.keys(BO_LUAT_THEO_PHIEN_BAN).find((k) => !luatCua(k).duoi5 && !luatCua(k).mapV28);
    expect(cu, 'không tìm được bộ luật cũ để đối chứng').toBeDefined();
    const b = dungBachKhoa(cu!);
    expect(Object.keys(b.the_tin)).toContain('thien_nga_den');
    expect(Object.keys(b.the_tin)).not.toContain('dich_benh');
    expect(Object.values(b.the_tin).every((t) => t!.do_gia === 'vua')).toBe(true);
  });
});

describe('§IV catalog chở bách khoa', () => {
  let db: TestDb;
  let app: Hono<any>;
  let U: TestUser;

  beforeAll(async () => {
    db = await startTestDb();
    app = createApp({
      pool: db.pool, mailer: new CapturingMailer(), appBaseUrl: 'https://dubao.test',
      tickSecret: 'tick-bk', secureCookie: false,
    }) as Hono<any>;
    U = await createTestUser(db.pool);
  }, 120_000);
  afterAll(async () => { await db?.stop(); });

  it('⭐ /holdem/catalog có `bach_khoa` khớp đúng hàm dựng, và vẫn không chở số', async () => {
    const r = await app.request('http://localhost/api/v1/holdem/catalog', { headers: { cookie: U.cookie } });
    expect(r.status).toBe(200);
    const c = (await r.json()) as { bach_khoa?: unknown };
    expect(c.bach_khoa).toEqual(bk);
    expect(JSON.stringify((c.bach_khoa as typeof bk).the_tin)).not.toMatch(/\d/);
  });
});
