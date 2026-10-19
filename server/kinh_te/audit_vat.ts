/**
 * `audit:cung` — ĐỐI CHIẾU SỔ VẬT ↔ HAI BẢNG ĐỌC NHANH (bất biến E2).
 *
 * Đây là vế thứ hai của kỷ luật mà repo đã có ở phía tiền: `audit:supply`
 * recompute `bankroll` từ `wallet_ledger` và so. Không có phép so đó thì một sai
 * lệch **không phát hiện được**, và một con số đếm sai trông y hệt một con số
 * đếm đúng.
 *
 * ⚠ HÀM NÀY CHỈ ĐỌC. Không sửa, không "tự chữa cho cân". Một bản vá tự động ở
 * đây sẽ **giấu đi** đúng thứ nó được thuê để tìm: nếu ghi song song đang lệch
 * thì cái phải sửa là đường ghi, không phải con số.
 *
 * ⚠ CHẠY ĐƯỢC CẢ KHI CỜ TẮT. Lúc cờ tắt, sổ chỉ có hàng di trú và hai bảng đọc
 * nhanh vẫn chạy tiếp ⇒ **lệch là đúng, không phải lỗi**. Kết quả vì thế mang
 * theo `coGhiSongSong` để người đọc biết con số lệch có nghĩa gì — báo động sai
 * là cách nhanh nhất khiến người ta tắt chuông (D79/D125).
 */
import type pg from 'pg';
import { soVatDangGhi } from './so_vat.js';

type Q = {
  query: (text: string, values?: readonly unknown[]) => Promise<pg.QueryResult<any>>;
};

export interface LechSoVat {
  /** Mã ngắn để test và nhật ký bám vào, không phải câu chữ hiển thị (D26). */
  ma: 'kho_sticker_lech' | 'user_cosmetics_thieu' | 'da_phat_lech' | 'ban_the_vo_chu';
  /** Khoá của dòng lệch, đủ để đi tra. */
  khoa: string;
  /** Số theo bảng đọc nhanh. */
  theoCache: number;
  /** Số theo sổ vật. */
  theoSo: number;
}

export interface KetQuaAuditVat {
  coGhiSongSong: boolean;
  soDot: number;
  soBanThe: number;
  lech: LechSoVat[];
  can: boolean;
}

export async function auditVat(client: Q): Promise<KetQuaAuditVat> {
  const lech: LechSoVat[] = [];

  // (1) `kho_sticker.so_luong` phải bằng COUNT bản thể `tu_do` của (user, mẫu).
  const { rows: ks } = await client.query(
    `SELECT k.user_id::text AS user_id, k.sticker_id, k.so_luong,
            COALESCE(b.n, 0) AS n
       FROM kho_sticker k
       LEFT JOIN (
            SELECT d.mau_id, v.chu_so_huu, count(*) AS n
              FROM vat_pham_ban_the v
              JOIN dot_phat_hanh d ON d.dot_id = v.dot_id
             WHERE v.trang_thai = 'tu_do' AND v.chu_so_huu IS NOT NULL
             GROUP BY d.mau_id, v.chu_so_huu
       ) b ON b.mau_id = k.sticker_id AND b.chu_so_huu = k.user_id
      WHERE k.so_luong <> COALESCE(b.n, 0)`,
  );
  for (const r of ks) {
    lech.push({
      ma: 'kho_sticker_lech',
      khoa: `${r.user_id}/${r.sticker_id}`,
      theoCache: Number(r.so_luong),
      theoSo: Number(r.n),
    });
  }

  // (2) Mỗi dòng `user_cosmetics` phải có ít nhất một bản thể tương ứng.
  //     ⚠ Chiều ngược lại KHÔNG kiểm: một người có thể giữ nhiều bản của cùng
  //     một mẫu trong sổ, còn `user_cosmetics` chỉ biết "có hay không". Đòi hai
  //     bên bằng nhau ở đây là đòi bảng cache biết điều nó không biết.
  const { rows: uc } = await client.query(
    `SELECT u.user_id::text AS user_id, u.cosmetic_id
       FROM user_cosmetics u
      WHERE NOT EXISTS (
            SELECT 1 FROM vat_pham_ban_the v
              JOIN dot_phat_hanh d ON d.dot_id = v.dot_id
             WHERE d.mau_id = u.cosmetic_id AND v.chu_so_huu = u.user_id)`,
  );
  for (const r of uc) {
    lech.push({
      ma: 'user_cosmetics_thieu', khoa: `${r.user_id}/${r.cosmetic_id}`,
      theoCache: 1, theoSo: 0,
    });
  }

  // (3) Bộ đếm cấp seri phải khớp COUNT — y hệt bankroll ↔ wallet_ledger.
  const { rows: dp } = await client.query(
    `SELECT d.dot_id::text AS dot_id, d.mau_id, d.da_phat, count(v.ban_the_id) AS n
       FROM dot_phat_hanh d
       LEFT JOIN vat_pham_ban_the v ON v.dot_id = d.dot_id
      GROUP BY d.dot_id, d.mau_id, d.da_phat
     HAVING d.da_phat <> count(v.ban_the_id)`,
  );
  for (const r of dp) {
    lech.push({
      ma: 'da_phat_lech', khoa: `dot ${r.dot_id} (${r.mau_id})`,
      theoCache: Number(r.da_phat), theoSo: Number(r.n),
    });
  }

  // (4) Không bản thể nào vô chủ. CHECK ở DB đã chặn, nên dòng nào lọt tới đây
  //     nghĩa là ràng buộc đã bị gỡ — đáng kêu to hơn cả ba mục trên.
  const { rows: vc } = await client.query(
    `SELECT ban_the_id::text AS id FROM vat_pham_ban_the
      WHERE chu_so_huu IS NULL AND kho IS NULL`,
  );
  for (const r of vc) {
    lech.push({ ma: 'ban_the_vo_chu', khoa: `ban_the ${r.id}`, theoCache: 0, theoSo: 0 });
  }

  const { rows: dem } = await client.query(
    `SELECT (SELECT count(*) FROM dot_phat_hanh)      AS so_dot,
            (SELECT count(*) FROM vat_pham_ban_the)   AS so_ban_the`,
  );

  return {
    coGhiSongSong: soVatDangGhi(),
    soDot: Number(dem[0].so_dot),
    soBanThe: Number(dem[0].so_ban_the),
    lech,
    can: lech.length === 0,
  };
}
