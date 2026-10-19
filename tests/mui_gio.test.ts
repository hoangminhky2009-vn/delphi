/**
 * MÚI GIỜ PHIÊN DB (D364) — hai lớp bảo vệ, canh riêng từng lớp.
 *
 * Prod (Supabase) chạy phiên **UTC**; Postgres nhúng lấy múi giờ máy nên trước D364 nó
 * chạy **Asia/Bangkok (+07)**, trùng đúng độ lệch của giờ VN. Hệ quả đo được:
 *   · D341 tiêm `min(started_at)::date` — bài canh "ngày VN" vẫn XANH (mũi 14b).
 *   · 16/09 chạy cả suite gốc với phiên ép UTC: 0 bài đỏ, kể cả ở commit còn mang lỗi ấy.
 * ⇒ Ép UTC là điều kiện CẦN (§II), còn thứ bắt được lúc VIẾT là LINT (§I). Bỏ lớp nào
 * cũng hở, y như cặp `lint:pool-lock` + `pool_max1.test.ts`.
 */
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type pg from 'pg';
import { startTestDb, type TestDb } from './helpers/testdb.js';
import { lintMuiGio, quet, tuocChuThich, dongMienTru } from '../scripts/lint_mui_gio.js';

const ten = (src: string, tep = 'server/x.ts') => quet(src, tep).map((v) => v.luat);

describe('§I — lint múi giờ: BẮT đúng những hình dạng đã gây lỗi thật', () => {
  it('ca D341: `min(started_at)::date` trần', () => {
    expect(ten('const q = `SELECT min(m.started_at)::date AS tu FROM holdem_matches m`;'))
      .toEqual(['ep-kieu-tran']);
  });

  it('ca D364: so cột timestamptz với một giá trị KIỂU NGÀY', () => {
    expect(ten("const q = `SELECT 1 FROM hanh_vi_vong WHERE ts >= ($2 || '-01')::date`;"))
      .toEqual(['so-voi-kieu-ngay']);
  });

  it('`date_trunc` hai tham số · `CURRENT_DATE` · `now()::date`', () => {
    expect(ten("const q = `SELECT date_trunc('month', created_at) FROM wallet_ledger`;"))
      .toEqual(['date_trunc-khong-tz']);
    expect(ten('const q = `SELECT * FROM t WHERE ngay = CURRENT_DATE`;')).toEqual(['hang-theo-phien']);
    expect(ten('const q = `SELECT now()::date`;')).toEqual(['ep-kieu-tran']);
  });

  it('`to_char` và `extract` trên cột thời điểm (trừ `epoch`)', () => {
    expect(ten("const q = `SELECT to_char(t.ts, 'YYYY-MM') FROM telemetry t`;"))
      .toEqual(['to_char-khong-tz']);
    expect(ten('const q = `SELECT extract(hour FROM t.ts) FROM telemetry t`;'))
      .toEqual(['extract-khong-tz']);
    // hiệu hai mốc không có "ngày" để mà lệch — phải cho qua, không thì lint hoá báo động giả
    expect(ten('const q = `SELECT EXTRACT(epoch FROM m.ended_at - m.started_at) FROM holdem_matches m`;'))
      .toEqual([]);
  });

  it('CHO QUA khi múi giờ được nói rõ, và khi cột vốn là kiểu `date`', () => {
    expect(ten("const q = `SELECT (m.started_at AT TIME ZONE 'Asia/Ho_Chi_Minh')::date`;")).toEqual([]);
    expect(ten("const q = `SELECT date_trunc('month', created_at AT TIME ZONE $2)`;")).toEqual([]);
    expect(ten("const q = `SELECT to_char(b.ngay, 'YYYY-MM-DD') FROM holdem_ban b`;")).toEqual([]);
    expect(ten("const q = `SELECT $1::date, 'epoch'::date`;")).toEqual([]);
    expect(ten("const q = `SELECT 1 WHERE ngay >= $2::date AND ngay < $2::date + 7`;")).toEqual([]);
  });

  it('⭐ đọc XUYÊN DÒNG: `AT TIME ZONE` ở dòng kế vẫn tính là đã nói rõ', () => {
    // Đúng hình dạng bản vá D364 — bản lint đầu chỉ đọc hết dòng nên báo động giả ở đây.
    const src = 'const q = `SELECT 1 FROM hanh_vi_vong\n'
      + "      WHERE ts >= ((($2 || '-01')::date)::timestamp\n"
      + '                    AT TIME ZONE (SELECT mui_gio FROM users WHERE user_id = $1))\n'
      + '        AND vong = 1`;';
    expect(ten(src)).toEqual([]);
  });

  it('CHO QUA lời gọi khuôn dùng chung `dauNgay()` (bên trong đã có AT TIME ZONE)', () => {
    expect(ten("const q = `SELECT 1 FROM telemetry t WHERE t.ts >= ${dauNgay('$1::date + 1')}`;"))
      .toEqual([]);
  });

  it('⚠ TƯỚC CHÚ THÍCH trước khi quét — ví dụ sai trong chú thích không được tính', () => {
    const src = '// ví dụ SAI: min(m.started_at)::date\n/* cũng sai: CURRENT_DATE */\nconst ok = 1;';
    expect(ten(src)).toEqual([]);
    expect(tuocChuThich(src).split('\n')).toHaveLength(3); // giữ nguyên số dòng
    // nhưng SQL trong chuỗi thì vẫn phải thấy
    expect(ten(`${src}\nconst q = \`SELECT now()::date\`;`)).toEqual(['ep-kieu-tran']);
  });

  it('miễn trừ ăn ĐÚNG dòng có dấu và dòng ngay sau, không ăn cả tệp', () => {
    const co = 'const a = 1;\n// mui-gio-ok: bảng này là lịch UTC thật\nconst q = `SELECT now()::date`;\n'
      + 'const r = `SELECT now()::date`;';
    expect(ten(co)).toEqual(['ep-kieu-tran']); // dòng 3 được miễn, dòng 4 thì không
    expect([...dongMienTru(co)]).toEqual([2, 3]);
    // dấu rỗng không phải là miễn trừ
    expect(ten('// mui-gio-ok:\nconst q = `SELECT now()::date`;')).toEqual(['ep-kieu-tran']);
  });

  it('giờ MÁY: bắt trong server/, KHÔNG bắt trong scripts/ (script chạy ở máy founder)', () => {
    const src = 'const gio = new Date().getHours();';
    expect(ten(src, 'server/x.ts')).toEqual(['gio-may']);
    expect(ten(src, 'scripts/x.ts')).toEqual([]);
  });

  it('⭐ CẢ LỚP: toàn repo hiện sạch — code mới vi phạm là bài này đỏ', async () => {
    const xau = await lintMuiGio();
    expect(xau.map((v) => `${v.tep}:${v.dong} ${v.luat}`)).toEqual([]);
  });
});

describe('§II — phiên Postgres của test phải là UTC, giống prod', () => {
  let db: TestDb;
  let pool: pg.Pool;
  beforeAll(async () => { db = await startTestDb(); pool = db.pool; }, 120_000);
  afterAll(async () => { await db?.stop(); });

  it('current_setting(TimeZone) = UTC', async () => {
    const { rows } = await pool.query("SELECT current_setting('TimeZone') AS tz");
    expect(rows[0].tz).toBe('UTC');
  });

  it('⭐ và vì thế `::date` trần KHÁC ngày VN — đúng lớp lỗi prod đang có', async () => {
    /*
     * 00:30 sáng giờ VN ngày 16/09 = 17:30 ngày 15/09 theo UTC. Trên phiên +07 (trước
     * D364) hai vế dưới BẰNG NHAU, nên một câu `::date` trần trông vẫn đúng — đó chính
     * là lý do mũi tiêm 14b của D341 không làm bài nào đỏ.
     */
    const { rows } = await pool.query(
      `SELECT ('2026-09-16 00:30+07'::timestamptz)::date::text AS theo_phien,
              ('2026-09-16 00:30+07'::timestamptz AT TIME ZONE 'Asia/Ho_Chi_Minh')::date::text AS theo_vn`);
    expect(rows[0].theo_vn).toBe('2026-09-16');
    expect(rows[0].theo_phien).toBe('2026-09-15');
  });
});
