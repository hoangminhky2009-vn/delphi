/**
 * Helper test: dựng PostgreSQL embedded tạm (thư mục temp, port ngẫu nhiên),
 * chạy migrations, trả về pool. Mỗi lần chạy test là một DB trắng.
 */
import { mkdtemp, rm, stat } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import EmbeddedPostgres from 'embedded-postgres';
import pg from 'pg';
import { runMigrations } from '../../scripts/migrate.js';

// C5: BIGINT → BigInt (giống server/db.ts)
pg.types.setTypeParser(20, (value: string) => BigInt(value));

export interface TestDb {
  pool: pg.Pool;
  stop: () => Promise<void>;
}

/**
 * ⚠ `max` MẶC ĐỊNH 5, và con số đó CHE MỘT LỚP LỖI CỦA PROD.
 *
 * Prod mở pool `max: 1` (`api/index.ts` — mỗi instance serverless chỉ nên giữ một
 * kết nối thật qua transaction pooler). Code nào đang cầm `client` mà lại xin thêm
 * một kết nối từ `pool` thì ở đây CHẠY BÌNH THƯỜNG và trên prod BẾ TẮC.
 *
 * Vì sao `max ≥ 2` luôn thoát được: chỉ cần MỘT kết nối làm xong việc và nhả ra là
 * hàng đợi nhích, rồi cái vừa nhích lại nhả tiếp — cả đám drain. Với `max: 1` thì
 * kết nối duy nhất đang bị chính kẻ chờ nó nắm giữ, và không gì nhả nó ra.
 * Đó là lý do `tests/discord_cua.test.ts` chạy 10 lượt ghi danh song song vẫn xanh
 * trong khi cùng đoạn code ấy chết trên prod.
 *
 * ⇒ Muốn kiểm lớp đó thì truyền `{ max: 1 }` — xem `tests/pool_max1.test.ts`.
 */
/*
 * Port test ngẫu nhiên, KHÔNG kiểm trống: runner CI laptop + mọi worktree + các tệp vitest song song dựng Postgres cùng
 * máy ⇒ hai DB trùng port là tai nạn thật, postgres thứ hai chết "could not create any TCP/IP sockets" (D606). Gặp thì
 * dựng lại trên port khác — cùng thư mục, không initdb lại; hết `SO_LAN_THU_PORT` lần thì ném lỗi thật như mọi ca chết.
 */
const portNgauNhien = () => 21000 + Math.floor(Math.random() * 3000);
export const SO_LAN_THU_PORT = 3;
const TRUNG_PORT = /could not create any TCP\/IP sockets/;

export async function startTestDb(opts: { max?: number; chonPort?: () => number } = {}): Promise<TestDb> {
  const chonPort = opts.chonPort ?? portNgauNhien;
  const dataDir = await mkdtemp(path.join(os.tmpdir(), 'delphi-pgtest-'));
  let port = chonPort();
  const daThu: number[] = [];
  // Đuôi log Postgres — chỉ để in khi dựng chết (khối try dưới).
  const duoiLog: string[] = [];
  const ghiLog = (m: unknown) => {
    duoiLog.push(...String(m instanceof Error ? m.message : m).split(/\r?\n/).filter((d) => d.trim()));
    if (duoiLog.length > 30) duoiLog.splice(0, duoiLog.length - 30);
  };
  const taoEpg = (port: number) => new EmbeddedPostgres({
    databaseDir: dataDir,
    user: 'postgres',
    password: 'postgres',
    port,
    persistent: false,
    // Windows mặc định initdb theo locale hệ thống (WIN1252) → ép UTF-8
    initdbFlags: ['--encoding=UTF8', '--locale=C'],
    /*
     * ⚠⚠ MÚI GIỜ PHIÊN = UTC, GIỐNG PROD — KHÔNG phải giờ máy.
     *
     * embedded-postgres lấy múi giờ của máy: máy founder ở VN ⇒ phiên chạy
     * `Asia/Bangkok` (+07), TRÙNG ĐỘ LỆCH của giờ Việt Nam. Supabase thì chạy UTC.
     * Nên mọi câu SQL lỡ dùng `::date` trần / `date_trunc` không `AT TIME ZONE` ra
     * ĐÚNG ngày VN ở đây và LỆCH 7 TIẾNG trên prod — bài canh vẫn xanh.
     *
     * Không phải giả thuyết: D341 tiêm `min(started_at)::date` vào mặt PHIÊN BẢN,
     * bài "ngày đầu/cuối là NGÀY VIỆT NAM" vẫn XANH trên phiên +07 (mũi 14b).
     *
     * `PG_TEST_TZ` là đường dò, không phải nút tắt:
     *   `giu`          — để nguyên theo máy (dựng lại đúng hiện trường trước D364)
     *   `Etc/GMT-14`   — UTC+14, KHÁC ngày VN khi chạy 17–24h VN
     *   `Etc/GMT+12`   — UTC−12, KHÁC ngày VN khi chạy 00–19h VN
     * Hai múi dò tồn tại vì ép UTC KHÔNG đủ: phiên UTC chỉ khác ngày VN trong
     * khung 00–07h VN, nên lỗi kiểu "hôm nay" chạy ban ngày là vô hình. Lớp chặn
     * chính cho lớp lỗi ấy là `npm run lint:mui-gio`, không phải lưới này.
     */
    postgresFlags: (process.env.PG_TEST_TZ ?? 'UTC') === 'giu' ? [] : ['-c', `TimeZone=${process.env.PG_TEST_TZ ?? 'UTC'}`],
    onLog: ghiLog,
    onError: ghiLog,
  });
  let epg = taoEpg(port);
  /*
   * ⚠ DỰNG CHẾT PHẢI NÓI VÌ SAO. Postgres thoát sớm thì `epg.start()` gọi `reject()` KHÔNG đối số ⇒ vitest in
   * "Unknown Error: undefined" và cả tệp bị bỏ qua ở beforeAll, không ai biết vì sao (CI 12/10: run 38142814609,
   * 38181000602). Lý do thật nằm trong stderr của postgres mà onLog cũ nuốt. Bài canh: tests/testdb_loi_dung.test.ts.
   */
  let buoc = 'initdb';
  try {
    await epg.initialise();
    buoc = 'khởi động postgres';
    for (;;) {
      try { await epg.start(); break; } catch (e) {
        daThu.push(port);
        if (daThu.length >= SO_LAN_THU_PORT || !TRUNG_PORT.test(duoiLog.join('\n'))) throw e;
        duoiLog.length = 0;
        port = chonPort();
        epg = taoEpg(port);
      }
    }
    buoc = 'tạo database';
    await epg.createDatabase('delphi_test');
  } catch (e) {
    const coThuMuc = await stat(dataDir).then(() => 'còn', () => 'ĐÃ MẤT (bị xoá giữa chừng?)');
    // Chỉ dừng khi postgres CÒN chạy: start() reject đúng lúc tiến trình đã thoát, mà stop() thì chờ sự kiện thoát ⇒ treo mãi.
    if (buoc === 'tạo database') await epg.stop().catch(() => {});
    await rm(dataDir, { recursive: true, force: true }).catch(() => {});
    const goc = e instanceof Error ? e.message : e === undefined ? '(embedded-postgres reject không lý do — tiến trình postgres thoát sớm)' : String(e);
    throw new Error(
      `testdb: Postgres nhúng chết lúc ${buoc} — port ${port}${daThu.length > 1 ? ` (trùng port ${daThu.length} lần liền: ${daThu.join(', ')})` : ''} · thư mục ${dataDir} ${coThuMuc}\n  ${goc}`
      + `\n  --- log postgres cuối ---\n  ${duoiLog.length ? duoiLog.join('\n  ') : '(trống)'}`,
    );
  }

  const pool = new pg.Pool({
    connectionString: `postgresql://postgres:postgres@127.0.0.1:${port}/delphi_test`,
    max: opts.max ?? 5,
  });

  /*
   * ⚠ POOL PHẢI CÓ NGƯỜI NGHE `error` — nếu không, CI ĐỎ TRONG KHI MÁY LOCAL XANH.
   *
   * `pg.Pool` phát sự kiện `error` trên các client ĐANG RỖI. Không ai nghe thì Node
   * nâng nó thành unhandled exception, và vitest kết luận cả lần chạy là THẤT BẠI
   * dù mọi test đều xanh — đúng thứ đã xảy ra: CI in ra
   *     Test Files  54 passed  ·  Tests  1053 passed  ·  Errors  1 error
   * rồi `exit code 1`. Lỗi là `57P01 terminating connection due to administrator
   * command`, tức Postgres nhúng đã tắt trong khi còn client trong pool.
   *
   * Vì sao máy local không dính: đây là ĐUA lúc dọn dẹp. Local nhanh nên `pool.end()`
   * xong trước khi bất kỳ client rỗi nào kịp thấy cú tắt; CI chậm hơn nên thấy.
   * `tests/concurrency.test.ts` là chỗ hay nổ nhất vì nó cố ý giữ nhiều transaction
   * chồng nhau — đúng lúc teardown thì pool còn client bận.
   *
   * `server/db.ts:38` ĐÃ có đúng lá chắn này cho pool production từ lâu. Pool test
   * thì không — nên bản vá này chỉ là đưa hai bên về cùng một chuẩn.
   *
   * KHÔNG nuốt im lặng mọi lỗi: trước khi `stop()` được gọi, một lỗi pool là dấu hiệu
   * thật và phải in ra. Chỉ sau khi đã bắt đầu tắt thì mới lờ đi, vì lúc đó lỗi kết
   * nối là HỆ QUẢ MONG ĐỢI của việc tắt DB, không phải triệu chứng.
   */
  let dangDong = false;
  pool.on('error', (err) => {
    if (!dangDong) console.error('pool test lỗi khi đang chạy:', err.message);
  });

  /*
   * ⚠ ÉP XONG PHẢI HỎI LẠI. Một cờ gõ sai tên, hay embedded-postgres đổi cách nhận
   * `postgresFlags`, thì cần gạt trên kia chết câm và cả lưới này thành trang trí —
   * đúng lớp lỗi repo đã trả giá nhiều lần. Ném ngay ở đây thì không lượt nào chạy
   * dưới một múi giờ khác múi giờ nó tưởng.
   */
  const tzMuon = process.env.PG_TEST_TZ ?? 'UTC';
  if (tzMuon !== 'giu') {
    const tzPhien = (await pool.query("SELECT current_setting('TimeZone') AS tz")).rows[0].tz as string;
    if (tzPhien !== tzMuon) {
      throw new Error(`testdb: ép TimeZone=${tzMuon} mà phiên chạy ${tzPhien} — cần gạt không ăn.`);
    }
  }

  await runMigrations(pool);

  return {
    pool,
    stop: async () => {
      dangDong = true;
      await pool.end().catch(() => {});
      await epg.stop().catch(() => {});
      await rm(dataDir, { recursive: true, force: true }).catch(() => {});
    },
  };
}
