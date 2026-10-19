/**
 * B1 — SỔ VẬT: bài quét mã nguồn + bài chạy thật trên DB.
 *
 * Bài quét ở đây làm đúng việc mà bài quét cửa tiêu T (D253) làm ở phía tiền:
 * **một đường ghi vật phẩm mới không ra đời im lặng được**. Thêm một tệp ghi
 * `user_cosmetics`/`kho_sticker` mà chưa khai vào sổ đăng ký, hoặc khai rồi mà
 * không gọi cổng ⇒ đỏ, kèm đúng tên tệp.
 *
 * Vì sao cần: repo có NĂM đường ghi hai bảng đó. Rải logic ghi song song ra năm
 * chỗ nghĩa là đường thứ sáu sẽ quên, và lúc đó sổ lệch mà không có gì kêu.
 */
import { readdirSync, readFileSync, statSync } from 'node:fs';
import path from 'node:path';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';

/**
 * Cờ ghi song song, bật/tắt được TRONG TEST.
 *
 * ⚠ Dùng getter thay vì sửa API sản xuất: một tham số "cho phép ghi" thêm vào
 * `ducBanThe` chỉ để test bật/tắt được là để lộ hình dạng của test ra đường
 * chạy thật, và sớm muộn sẽ có route truyền nhầm nó.
 */
let coGhi = false;
vi.mock('../config/co_kinh_te.js', () => ({
  CO_KINH_TE: {
    get CHO_SO_VAT() { return coGhi; },
    CHO_SO_VAT_DOC: false,
  },
}));

const { ducBanThe, tieuBanThe, soVatDangGhi, SoVatError, SO_DANG_KY_GHI_KHO, SO_DANG_KY_CHI_DOC } =
  await import('../server/kinh_te/so_vat.js');
const { auditVat } = await import('../server/kinh_te/audit_vat.js');
const { startTestDb } = await import('./helpers/testdb.js');

// ══════════════════════════════════════════════════════════════════════════
// I. QUÉT MÃ NGUỒN — không có đường ghi nào ra đời im lặng
// ══════════════════════════════════════════════════════════════════════════

const GOC = process.cwd();
const BANG_CACHE = /\b(user_cosmetics|kho_sticker)\b/;

function moiTepServer(): string[] {
  const ra: string[] = [];
  const di = (d: string) => {
    for (const e of readdirSync(path.join(GOC, d))) {
      const p = `${d}/${e}`;
      if (statSync(path.join(GOC, p)).isDirectory()) di(p);
      else if (p.endsWith('.ts')) ra.push(p);
    }
  };
  di('server');
  return ra;
}

/** Bỏ chú thích trước khi quét — nếu không, chính đoạn văn giải thích luật bị bắt. */
function than(src: string): string {
  return src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/[^\n]*/g, '');
}

/**
 * Thân KHÔNG có dòng `import` — dùng cho bài "có gọi cổng không".
 *
 * ⚠⚠ BÀI ĐÓ TỪNG RỖNG. Bản đầu quét `ducBanThe` trên cả tệp, nên riêng dòng
 * `import { ducBanThe } …` đã đủ làm nó xanh: gỡ sạch lời gọi trong `shop.ts`
 * mà bài canh vẫn không kêu. Tiêm lỗi ngược lôi ra đúng chỗ đó — và nếu không
 * tiêm thì nó đã đi vào commit như một bài canh trông rất nghiêm.
 *
 * Giờ quét trên thân KHÔNG import, và đòi có DẤU MỞ NGOẶC: một cái tên không
 * phải một lời gọi.
 */
function thanKhongImport(src: string): string {
  return than(src).replace(/^\s*import\s[\s\S]*?;\s*$/gm, '');
}

describe('I. Quét: mọi đường ghi hai bảng đọc nhanh đều khai và đều qua cổng', () => {
  const chamBang = moiTepServer().filter((f) => BANG_CACHE.test(than(readFileSync(path.join(GOC, f), 'utf8'))));
  const daKhaiGhi = new Set(SO_DANG_KY_GHI_KHO.map((x) => x.tep));
  const daKhaiDoc = new Set(SO_DANG_KY_CHI_DOC.map((x) => x.tep));

  it('quét thật sự tìm thấy các tệp — bài canh không được rỗng', () => {
    // Một bài quét không tìm thấy gì là một bài quét XANH VÔ NGHĨA.
    expect(chamBang.length).toBeGreaterThanOrEqual(5);
  });

  it('⭐ mọi tệp chạm hai bảng đó đều có trong MỘT trong hai sổ đăng ký', () => {
    const thieu = chamBang.filter((f) => !daKhaiGhi.has(f) && !daKhaiDoc.has(f));
    expect(thieu, 'tệp chạm user_cosmetics/kho_sticker mà chưa khai ở so_vat.ts').toEqual([]);
  });

  it('⭐ mọi tệp trong sổ GHI đều thật sự gọi cổng — khai suông không tính', () => {
    const khongGoi = SO_DANG_KY_GHI_KHO
      .map((x) => x.tep)
      .filter((f) => !/\b(ducBanThe|tieuBanThe|chuyenBanTheVaoKho)\s*\(/
        .test(thanKhongImport(readFileSync(path.join(GOC, f), 'utf8'))));
    expect(khongGoi, 'khai vào sổ GHI mà không gọi ducBanThe/tieuBanThe/chuyenBanTheVaoKho').toEqual([]);
  });

  it('không có mục THỪA trong hai sổ — sổ phải tả đúng repo hôm nay', () => {
    const tatCa = new Set(chamBang);
    const thua = [...daKhaiGhi, ...daKhaiDoc].filter((f) => !tatCa.has(f));
    expect(thua, 'khai trong sổ mà tệp không còn chạm hai bảng đó').toEqual([]);
  });

  it('mỗi mục đều có `viSao` — một danh sách không lý do sẽ dài ra mãi', () => {
    for (const x of [...SO_DANG_KY_GHI_KHO, ...SO_DANG_KY_CHI_DOC]) {
      expect(x.viSao.length, `mục ${x.tep} thiếu lý do`).toBeGreaterThan(10);
    }
  });
});

// ══════════════════════════════════════════════════════════════════════════
// II. CHẠY THẬT — schema, trigger, cổng, audit
// ══════════════════════════════════════════════════════════════════════════

describe('II. Sổ vật trên DB thật', () => {
  let db: Awaited<ReturnType<typeof startTestDb>>;
  let userA = '';
  let userB = '';
  const MAU = 'nd_moc_neo_test';

  beforeAll(async () => {
    db = await startTestDb();
    const { rows } = await db.pool.query(
      `INSERT INTO users (handle, age_band, region, occupation_band, season_id)
       VALUES ('so_vat_a', '18-22', 'bac', 'hs_sv', 'test'),
              ('so_vat_b', '18-22', 'bac', 'hs_sv', 'test')
       RETURNING user_id`,
    );
    userA = rows[0].user_id;
    userB = rows[1].user_id;
    await db.pool.query(
      `INSERT INTO cosmetic_items (cosmetic_id, family, kind, label, rarity, nguon_cua)
       VALUES ($1, 'dien_mao', 'sticker', 'Nhãn thử', 'thuong', 'gacha_t')`,
      [MAU],
    );
  }, 120_000);

  afterAll(async () => { await db?.stop(); });

  it('cờ TẮT ⇒ cổng là no-op, không một dòng nào sinh ra', async () => {
    coGhi = false;
    expect(soVatDangGhi()).toBe(false);
    expect(await ducBanThe(db.pool, {
      mauId: MAU, chuSoHuu: userA, nguon: 'gacha', soLuong: 3,
    })).toEqual([]);
    const { rows } = await db.pool.query('SELECT count(*)::int AS n FROM vat_pham_ban_the');
    expect(rows[0].n).toBe(0);
  });

  it('cờ BẬT ⇒ đúc cấp seri liên tiếp và `da_phat` khớp COUNT', async () => {
    coGhi = true;
    expect(await ducBanThe(db.pool, {
      mauId: MAU, chuSoHuu: userA, nguon: 'gacha', soLuong: 3,
    })).toEqual([1, 2, 3]);
    expect(await ducBanThe(db.pool, {
      mauId: MAU, chuSoHuu: userB, nguon: 'gacha', soLuong: 2,
    })).toEqual([4, 5]);

    const { rows } = await db.pool.query(
      `SELECT d.da_phat, count(v.ban_the_id)::int AS n
         FROM dot_phat_hanh d LEFT JOIN vat_pham_ban_the v ON v.dot_id = d.dot_id
        WHERE d.mau_id = $1 GROUP BY d.da_phat`, [MAU]);
    expect(rows[0].da_phat).toBe(5);
    expect(rows[0].n).toBe(5);
  });

  it('⭐ mỗi mẫu chỉ MỘT đợt mở — chỉ số một phần chặn đợt thứ hai', async () => {
    await expect(db.pool.query(
      `INSERT INTO dot_phat_hanh (mau_id, han_muc, trang_thai) VALUES ($1, NULL, 'mo')`,
      [MAU],
    )).rejects.toThrow();
  });

  it('⭐ TRIGGER R1: không có đường user → user (Điều 57 K5)', async () => {
    await expect(db.pool.query(
      `UPDATE vat_pham_ban_the SET chu_so_huu = $1
        WHERE chu_so_huu = $2 AND seri = 1`, [userB, userA],
    )).rejects.toThrow(/user → user|Điều 57/);
  });

  it('TRIGGER R1: qua Hệ thống thì được — user → kho, rồi kho → user', async () => {
    await db.pool.query(
      `UPDATE vat_pham_ban_the SET chu_so_huu = NULL, kho = 'amm'
        WHERE chu_so_huu = $1 AND seri = 1`, [userA]);
    await db.pool.query(
      `UPDATE vat_pham_ban_the SET chu_so_huu = $1, kho = NULL WHERE seri = 1`, [userB]);
    const { rows } = await db.pool.query(
      'SELECT chu_so_huu::text AS c FROM vat_pham_ban_the WHERE seri = 1');
    expect(rows[0].c).toBe(userB);
  });

  it('TRIGGER R1: danh tính (dot_id/seri) không sửa được', async () => {
    await expect(db.pool.query(
      'UPDATE vat_pham_ban_the SET seri = 99 WHERE seri = 2',
    )).rejects.toThrow(/danh tính/);
  });

  it('CHECK: bản thể không được vô chủ, cũng không được hai chủ', async () => {
    await expect(db.pool.query(
      `UPDATE vat_pham_ban_the SET chu_so_huu = NULL, kho = NULL WHERE seri = 3`,
    )).rejects.toThrow();
    await expect(db.pool.query(
      `UPDATE vat_pham_ban_the SET kho = 'amm' WHERE seri = 3`,
    )).rejects.toThrow();
  });

  it('⭐ tiêu chọn bản CŨ NHẤT trước — seri thấp là thứ người chơi muốn giữ', async () => {
    const truoc = await db.pool.query(
      `SELECT ban_the_id FROM vat_pham_ban_the
        WHERE chu_so_huu = $1 AND trang_thai = 'tu_do' ORDER BY ban_the_id`, [userA]);
    const cuNhat = truoc.rows[0].ban_the_id;
    expect(await tieuBanThe(db.pool, { mauId: MAU, chuSoHuu: userA, soLuong: 1 })).toBe(1);
    const { rows } = await db.pool.query(
      'SELECT trang_thai FROM vat_pham_ban_the WHERE ban_the_id = $1', [cuNhat]);
    expect(rows[0].trang_thai).toBe('da_gan');
  });

  it('bản đã gắn thì không đổi chủ được nữa', async () => {
    await expect(db.pool.query(
      `UPDATE vat_pham_ban_the SET chu_so_huu = NULL, kho = 'amm'
        WHERE trang_thai = 'da_gan'`,
    )).rejects.toThrow(/đã gắn|đã tiêu/);
  });

  it('hạn mức đợt là ràng buộc DB, không phải một phép kiểm ở tầng ứng dụng', async () => {
    await db.pool.query(
      `INSERT INTO cosmetic_items (cosmetic_id, family, kind, label, rarity, nguon_cua)
       VALUES ('mau_han_muc', 'dien_mao', 'sticker', 'Có hạn', 'epic', 'gacha_t')`);
    await db.pool.query(
      `INSERT INTO dot_phat_hanh (mau_id, han_muc, trang_thai)
       VALUES ('mau_han_muc', 2, 'mo')`);
    await ducBanThe(db.pool, {
      mauId: 'mau_han_muc', chuSoHuu: userA, nguon: 'gacha', soLuong: 2,
    });
    await expect(ducBanThe(db.pool, {
      mauId: 'mau_han_muc', chuSoHuu: userA, nguon: 'gacha', soLuong: 1,
    })).rejects.toThrow();
  });

  it('mẫu đã đóng vĩnh viễn ⇒ FAIL RÕ, cổng KHÔNG tự mở lại một đợt', async () => {
    await db.pool.query(
      `INSERT INTO cosmetic_items (cosmetic_id, family, kind, label, rarity, nguon_cua)
       VALUES ('mau_da_dong', 'dien_mao', 'sticker', 'Đã đóng', 'epic', 'gacha_t')`);
    await db.pool.query(
      `INSERT INTO dot_phat_hanh (mau_id, han_muc, trang_thai, dong_luc)
       VALUES ('mau_da_dong', 5, 'dong_vinh_vien', now())`);
    await expect(ducBanThe(db.pool, {
      mauId: 'mau_da_dong', chuSoHuu: userA, nguon: 'gacha', soLuong: 1,
    })).rejects.toThrow(SoVatError);
  });

  it('⭐ `audit:cung` phát hiện lệch, và KHÔNG tự chữa', async () => {
    // Sổ có bản thể mà `kho_sticker` chưa có dòng nào ⇒ lệch, đúng như mong đợi
    // ở nhịp 2 khi hai đường chưa chạy song song trong cùng một luồng test.
    await db.pool.query(
      `INSERT INTO kho_sticker (user_id, sticker_id, so_luong, tong_nhan)
       VALUES ($1, $2, 99, 99)`, [userB, MAU]);
    const kq = await auditVat(db.pool);
    expect(kq.can).toBe(false);
    expect(kq.lech.some((l) => l.ma === 'kho_sticker_lech')).toBe(true);
    // Đọc xong, con số vẫn nguyên — audit không sửa gì.
    const { rows } = await db.pool.query(
      'SELECT so_luong FROM kho_sticker WHERE user_id = $1 AND sticker_id = $2',
      [userB, MAU]);
    expect(rows[0].so_luong).toBe(99);
  });

  it('audit nói rõ nó đang đo ở chế độ nào — số lệch không có ngữ cảnh là báo động sai', async () => {
    coGhi = true;
    expect((await auditVat(db.pool)).coGhiSongSong).toBe(true);
    coGhi = false;
    expect((await auditVat(db.pool)).coGhiSongSong).toBe(false);
  });
});
