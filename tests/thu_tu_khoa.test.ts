/**
 * M3 — THỨ TỰ LẤY KHOÁ: bài canh cho chính cái lint.
 *
 * ⚠⚠ NỬA ĐẦU CỦA BÀI NÀY LÀ "LINT CÓ THẬT SỰ BẮT ĐƯỢC GÌ KHÔNG". Một lint quét
 * hụt cũng in ra chữ "sạch", và chữ "sạch" đó tệ hơn không có lint — nó mua lấy
 * sự yên tâm mà không trả gì. Ngày 05/09 repo dính đúng chuyện này hai lần
 * (D262: bài test chép một thước rộng hơn thước thật; D269: bài quét khớp cả
 * dòng `import` nên gỡ sạch lời gọi vẫn xanh).
 *
 * Nên ở đây lint bị **cho ăn mã nguồn hỏng có chủ ý** trước, rồi mới cho quét
 * repo thật.
 */
import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import {
  BAC_KHOA, demChoXepBac, quetNguon, quetRepo,
} from '../scripts/lint_thu_tu_khoa.js';

const T = (sql: string) => `async function f(client: Q) {\n${sql}\n}`;

describe('I. Lint có bắt được không — cho ăn mã hỏng trước', () => {
  it('⭐ NGƯỢC BẬC: khoá bản thể (4) rồi mới khoá ví (1) ⇒ đỏ', () => {
    const src = T(`
      await client.query('SELECT 1 FROM vat_pham_ban_the WHERE x = 1 FOR UPDATE');
      await client.query('SELECT 1 FROM users WHERE user_id = $1 FOR UPDATE');
    `);
    const loi = quetNguon(src, 'thu.ts');
    expect(loi.filter((l) => l.loai === 'thu_tu')).toHaveLength(1);
    expect(loi[0]!.chiTiet).toContain('bậc 1 sau khi đã lấy bậc 4');
  });

  it('ĐÚNG BẬC: ví (1) rồi bản thể (4) ⇒ sạch', () => {
    const src = T(`
      await client.query('SELECT 1 FROM users WHERE user_id = $1 FOR UPDATE');
      await client.query('SELECT 1 FROM vat_pham_ban_the WHERE x = 1 FOR UPDATE');
    `);
    expect(quetNguon(src, 'thu.ts')).toEqual([]);
  });

  it('⭐ MƠ HỒ: FOR UPDATE trần trong câu JOIN hai bảng có bậc ⇒ đỏ', () => {
    // Đây đúng là ca thật đã sửa ở `tieuBanThe`: một FOR UPDATE trần khoá dòng
    // của MỌI bảng trong FROM, tức lấy hai bậc trong một câu.
    const src = T(`
      await client.query('SELECT b.id FROM vat_pham_ban_the b '
        + 'JOIN dot_phat_hanh d ON d.dot_id = b.dot_id FOR UPDATE');
    `);
    const loi = quetNguon(src, 'thu.ts');
    expect(loi.filter((l) => l.loai === 'mo_ho')).toHaveLength(1);
    expect(loi[0]!.chiTiet).toContain('FOR UPDATE OF');
  });

  it('`FOR UPDATE OF <bí danh>` chỉ đích danh ⇒ sạch', () => {
    const src = T(`
      await client.query('SELECT b.id FROM vat_pham_ban_the b '
        + 'JOIN dot_phat_hanh d ON d.dot_id = b.dot_id FOR UPDATE OF b');
    `);
    expect(quetNguon(src, 'thu.ts')).toEqual([]);
  });

  it('⭐ ADVISORY NGƯỢC BẬC: quỹ chợ (6) rồi Kho bạc (5) ⇒ đỏ', () => {
    const src = T(`
      await client.query('SELECT pg_advisory_xact_lock($1)', [QUY_CHO_LOCK_KEY]);
      await client.query('SELECT pg_advisory_xact_lock($1)', [TREASURY_LOCK_KEY]);
    `);
    const loi = quetNguon(src, 'thu.ts');
    expect(loi.filter((l) => l.loai === 'thu_tu')).toHaveLength(1);
    expect(loi[0]!.chiTiet).toContain('bậc 5 sau khi đã lấy bậc 6');
  });

  it('ADVISORY ĐÚNG BẬC: ví (1) → Kho bạc (5) → quỹ chợ (6) ⇒ sạch', () => {
    const src = T(`
      await client.query('SELECT 1 FROM users WHERE user_id = $1 FOR UPDATE');
      await client.query('SELECT pg_advisory_xact_lock($1)', [TREASURY_LOCK_KEY]);
      await client.query('SELECT pg_advisory_xact_lock($1)', [QUY_CHO_LOCK_KEY]);
    `);
    expect(quetNguon(src, 'thu.ts')).toEqual([]);
  });

  it('khoá advisory NGOÀI chuỗi M3 (qua_beta) không xếp bậc — lint bỏ qua', () => {
    const src = T(`
      await client.query('SELECT pg_advisory_xact_lock($1)', [QUA_BETA_LOCK_KEY]);
      await client.query('SELECT 1 FROM users WHERE user_id = $1 FOR UPDATE');
    `);
    expect(quetNguon(src, 'thu.ts')).toEqual([]);
  });

  it('bảng ngoài danh sách bậc thì bỏ qua — lint không đoán bừa', () => {
    const src = T(`await client.query('SELECT 1 FROM markets WHERE id = 1 FOR UPDATE');`);
    expect(quetNguon(src, 'thu.ts')).toEqual([]);
  });

  it('⭐ HAI TRANSACTION trong một tệp: mỗi cái tự tăng dần ⇒ sạch (ca thật D286)', () => {
    /*
     * Ca đã làm lint báo sai: `server/cho.ts` thêm cửa MUA bên dưới cửa BÁN.
     * Khoá — cả FOR UPDATE lẫn advisory — nhả khi transaction kết thúc, nên
     * "đã lấy bậc 2" của cửa trên không ràng buộc gì cửa dưới.
     */
    const src = T(`
      await client.query('BEGIN');
      await client.query('SELECT 1 FROM users WHERE user_id = $1 FOR UPDATE');
      await client.query('SELECT 1 FROM cosmetic_items WHERE id = $1 FOR UPDATE');
      await client.query('COMMIT');
      await client.query('BEGIN');
      await client.query('SELECT 1 FROM users WHERE user_id = $1 FOR UPDATE');
      await client.query('SELECT 1 FROM cosmetic_items WHERE id = $1 FOR UPDATE');
      await client.query('COMMIT');
    `);
    expect(quetNguon(src, 'thu.ts')).toEqual([]);
  });

  it('⭐⭐ và ranh `BEGIN` KHÔNG làm lint yếu: lùi bậc TRONG một transaction vẫn đỏ', () => {
    // Không có bài này thì phép đặt lại mốc ở trên có thể được viết rộng tay
    // hơn (vd đặt lại ở mọi `query(`) mà không ai biết — lint vẫn in "sạch".
    const src = T(`
      await client.query('BEGIN');
      await client.query('SELECT 1 FROM cosmetic_items WHERE id = $1 FOR UPDATE');
      await client.query('SELECT 1 FROM users WHERE user_id = $1 FOR UPDATE');
      await client.query('COMMIT');
    `);
    const loi = quetNguon(src, 'thu.ts');
    expect(loi.filter((l) => l.loai === 'thu_tu')).toHaveLength(1);
    expect(loi[0]!.chiTiet).toContain('bậc 1 sau khi đã lấy bậc 2');
  });

  it('hàm phụ KHÔNG có BEGIN (chạy trong transaction của caller) vẫn cộng dồn', () => {
    const src = T(`
      await client.query('SELECT pg_advisory_xact_lock($1)', [TREASURY_LOCK_KEY]);
      await client.query('SELECT 1 FROM users WHERE user_id = $1 FOR UPDATE');
    `);
    expect(quetNguon(src, 'thu.ts').filter((l) => l.loai === 'thu_tu')).toHaveLength(1);
  });

  it('chú thích KHÔNG được tính là mã — nếu không, chính lời giải thích bị bắt', () => {
    const src = T(`
      // SELECT 1 FROM vat_pham_ban_the FOR UPDATE  ← chỉ là ví dụ trong chú thích
      await client.query('SELECT 1 FROM users WHERE user_id = $1 FOR UPDATE');
    `);
    expect(quetNguon(src, 'thu.ts')).toEqual([]);
  });
});

describe('II. Repo thật', () => {
  it('⭐ lint KHÔNG RỖNG — nó thật sự tìm thấy chỗ khoá để xếp bậc', () => {
    // Không có ngưỡng này thì một lint quét hụt vẫn in "sạch" mãi mãi.
    const tep = [
      'server/kinh_te/so_vat.ts', 'server/shop_kho.ts',
    ];
    const tong = tep.reduce(
      (n, f) => n + demChoXepBac(readFileSync(join(process.cwd(), f), 'utf8')), 0);
    expect(tong, 'lint không thấy chỗ khoá nào — nó đang quét hụt').toBeGreaterThanOrEqual(3);
  });

  it('toàn repo sạch: không ngược bậc, không FOR UPDATE mơ hồ', async () => {
    const loi = await quetRepo();
    expect(loi.map((l) => `${l.file}:${l.dong} [${l.loai}] ${l.chiTiet}`)).toEqual([]);
  });
});
