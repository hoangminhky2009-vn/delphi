/**
 * SHOP — BỐN NGHIỆP VỤ NGUYÊN TỬ: chi Q · đốt T · cấp phát hàng hữu hạn · đọc tồn.
 *
 * Tách khỏi `server/shop.ts` (tầng route) vì đây là chỗ DUY NHẤT trong shop chạm
 * vào số dư và tồn kho. Route chỉ được phép gọi bốn hàm dưới đây; hàm nào cũng
 * nhận `client` đang trong transaction của người gọi và KHÔNG tự mở transaction —
 * cùng kỷ luật `server/avatar.ts` dùng, và cùng lý do (A7: nghiệp vụ + event phải
 * cùng một transaction, không có trạng thái "đã trừ mà chưa trao").
 *
 * ═══════════════════════════════════════════════════════════════════════════
 * TƯỜNG LỬA T↔Q Ở TẦNG HÀM (A3.5)
 *
 * `chiQ()` KHÔNG BAO GIỜ đọc/ghi `bankroll`, `wallet_ledger`, `burn_ledger`.
 * `dotT()` KHÔNG BAO GIỜ đọc/ghi `quest_points`, `quest_ledger`.
 *
 * Hai hàm cố ý không có tham số nào chung ngoài `userId`, nên "một giao dịch trừ
 * cả hai loại xu" không viết ra được bằng cách gọi hàm — muốn làm phải viết SQL
 * tay, và `tests/shop.test.ts` quét mã nguồn file này để chặn đúng chuyện đó.
 *
 * ═══════════════════════════════════════════════════════════════════════════
 * VÌ SAO `capMonHuuHan` KHOÁ TRƯỚC RỒI MỚI ĐẾM — VÀ VÌ SAO ĐÓ LÀ HAI CÂU LỆNH
 *
 * D36 chốt món độc quyền "số lượng cực ít". Hữu hạn + nhiều người bấm cùng lúc =
 * đua điều kiện, và đây là chỗ dễ vỡ nhất của cả đợt. Cách SAI mà trông rất đúng:
 *
 *     SELECT gioi_han, (SELECT SUM(tong_nhan) FROM kho_sticker WHERE …) AS da_phat
 *       FROM cosmetic_items WHERE cosmetic_id = $1 FOR UPDATE       -- ⚠ HỎNG
 *
 * Ở READ COMMITTED, khi câu này BỊ CHẶN bởi khoá của giao dịch khác rồi được đánh
 * thức, Postgres kiểm lại điều kiện WHERE trên bản ghi mới nhưng **subquery trong
 * danh sách chọn vẫn dùng snapshot cũ** của câu lệnh. Nên hai người mua song song
 * cùng đọc `da_phat = 0`, người sau nối tiếp người trước và cả hai đều được cấp:
 * số lượng hữu hạn bị vượt, mà không có lỗi nào nổ ra.
 *
 * Cách đúng là TÁCH LÀM HAI CÂU: câu 1 chỉ lấy khoá; câu 2 đếm. Câu 2 là một câu
 * lệnh MỚI nên nó có snapshot MỚI, chụp sau khi khoá đã về tay — nó thấy đúng
 * những gì người trước vừa commit. Không cần SERIALIZABLE, không cần retry.
 */
import type pg from 'pg';
import { AVATAR_NEN } from '../config/avatar.js';
import { ECONOMY } from '../config/economy.js';
import { conTrenLuoiSauKhiChi, lyDoTuChoiTieuT } from './kinh_te/cua_tieu.js';
import { ducBanThe, type NguonBanThe } from './kinh_te/so_vat.js';
import { currentSeasonId } from './season.js';

/** Chỉ cần `query` — nhận Pool lẫn PoolClient, và KHÔNG tự mở được transaction. */
type Q = {
  query: (text: string, values?: readonly unknown[]) => Promise<pg.QueryResult<any>>;
};

export class ShopError extends Error {
  constructor(public readonly code: string, public readonly httpCode = 409, msg?: string) {
    super(msg ?? code);
  }
}

// ───────────────────────────── CỬA Q (niêm yết) ─────────────────────────────

/**
 * Trừ Q theo giá NIÊM YẾT + ghi `quest_ledger`. Trả số dư Q sau khi trừ.
 *
 * Khoá dòng `users` trước khi đọc số dư: hai lệnh mua song song của CÙNG một người
 * (bấm hai lần, hai tab) nếu không khoá thì cả hai đọc cùng số dư và tiêu quá số có.
 * `quest_points >= 0` ở tầng DB là chốt cuối, nhưng chốt cuối cho ra lỗi 500 còn
 * khoá cho ra lỗi TỬ TẾ.
 *
 * ⚠ SỔ Q THUỘC `0016_nhiem_vu` (bên PHÁT Q định nghĩa sổ) và nó đã chừa `reason =
 * 'shop_q'` cho đúng cửa này. Ràng buộc kèm theo: `kiem_quest_points_khop_so` đòi
 * `users.quest_points` khớp DÒNG CUỐI của sổ tại lúc COMMIT. Nên hai câu lệnh dưới
 * đây là một cặp bất khả phân — trừ mà không ghi sổ, hay ghi sổ mà không trừ, đều
 * nổ lúc COMMIT thay vì âm thầm lệch tới đêm audit.
 */
export async function chiQ(
  client: Q, userId: string, gia: number, refItem: string,
): Promise<number> {
  if (!Number.isInteger(gia) || gia <= 0) throw new ShopError('gia_sai', 500);

  const { rows } = await client.query(
    'SELECT quest_points FROM users WHERE user_id = $1 FOR UPDATE', [userId]);
  if (!rows[0]) throw new ShopError('khong_co_ho_so', 404);

  const truoc = BigInt(rows[0].quest_points);
  const can = BigInt(gia);
  if (truoc < can) {
    throw new ShopError('khong_du_q', 409,
      `Cần ${gia} Q, bạn đang có ${truoc.toString()} Q.`);
  }
  const sau = truoc - can;

  await client.query('UPDATE users SET quest_points = $1 WHERE user_id = $2',
    [sau.toString(), userId]);
  await client.query(
    `INSERT INTO quest_ledger (user_id, delta, balance_after, reason, ref_id, season_id)
     VALUES ($1, $2, $3, 'shop_q', $4, $5)`,
    [userId, (-can).toString(), sau.toString(), refItem, currentSeasonId()],
  );
  return Number(sau);
}

// ───────────────────────────── CỬA T (quay hộp) ─────────────────────────────

/**
 * Điều kiện được mở hộp, tính bằng số ĐÃ DUYỆT — không có hằng số mới nào ở đây.
 *
 * ⚠ CHẶT HƠN `GACHA.MIN_BANKROLL_T` MỘT BẬC, VÀ ĐÓ LÀ CHỦ ĐÍCH (đề nghị (A) của
 * docs/ui-ux/design_sticker_shop.md §6.6, đang chờ founder phê — xem báo cáo).
 *
 * Lỗ mà nó bịt, bằng số:
 *   chặn cũ = bankroll ≤ 500 mới cấm;  SUBSIDY_THRESHOLD = 500 (A4)
 *   ví 599 T → quay hợp lệ → còn 499 T → DƯỚI ngưỡng → nhận 50 T/ngày TỪ KHO BẠC
 *   → quay tiếp. Trần trợ cấp 1.000 T/tháng = 30 lượt quay/mùa/người, 1.000 người
 *   là tối đa 3.000.000 T rút ra, trong khi Kho bạc chỉ có ~31.647 T (D16).
 * Kho bạc có CHECK ≥ 0 (D10) nên nó không sai số — nó sẽ TỪ CHỐI TRỢ CẤP CHO
 * NGƯỜI THẬT khi cạn, mà trợ cấp là cái sàn giữ "kiệt quệ 0%".
 *
 * Điều kiện mới: sau khi đốt vẫn phải ở TRÊN ngưỡng trợ cấp. Nó không đặt số mới
 * (500 + 100, cả hai đã duyệt) và chỉ làm cửa này KHẮT KHE HƠN, nên hướng sai của
 * nó là "ít người quay được", không phải "kho bạc cạn".
 */
/**
 * ⚠ B2 (05/09, D252): PHÉP TÍNH ĐÃ DỜI sang `server/kinh_te/cua_tieu.ts`, vì nó
 * không phải luật của gacha mà là luật của **cả họ cửa tiêu T không hoàn**. Tên
 * cũ giữ lại làm vỏ mỏng để không phải sửa mọi lời gọi trong một commit đang lo
 * việc khác — hành vi KHÔNG đổi một chút nào (test gacha cũ canh điều đó).
 *
 * Cửa tiêu T MỚI thì gọi thẳng `conTrenLuoiSauKhiChi`, đừng gọi tên này: cái tên
 * "mở hộp" sẽ khiến người viết cửa sau tưởng luật chỉ dành cho gacha.
 */
export function duDieuKienMoHop(bankrollT: bigint, giaT: number): boolean {
  // Hôm nay khả dụng == bankroll (chưa có `khoa_t` — xem chú thích ở cua_tieu.ts).
  return conTrenLuoiSauKhiChi(bankrollT, BigInt(giaT));
}

/**
 * Đốt T: ví −giá, `burn_ledger` +giá. HAI dòng, cùng transaction.
 *
 * Thiếu dòng `burn_ledger` thì bất biến A của `server/audit.ts`
 * (`mint − đốt == Σ ví + pool + kho bạc`) lệch đúng bằng số T đã tiêu, và audit
 * đêm sẽ báo đỏ mà không nói được vì sao. Không có đường nào cho T này vào Kho bạc:
 * D16 nói gacha đốt 100%, nên hộp không phải một vòi tiếp Kho bạc.
 */
/**
 * KHOÁ VÍ + KIỂM ĐIỀU KIỆN, **KHÔNG TRỪ GÌ**.
 *
 * ═══════════════════════════════════════════════════════════════════════════
 * VÌ SAO TÁCH KHỎI `dotT` (D68a, 04/08) — ĐÂY LÀ MỘT RÀNG BUỘC A3.4
 *
 * Founder chốt: quay trúng lá đã sở hữu thì HOÀN T. Nhưng `dotT` ghi
 * `burn_ledger`, mà sổ đốt là APPEND-ONLY và có `CHECK amount > 0` — không có
 * bút toán nào gỡ được một dòng đốt. Nên "đốt rồi hoàn" = **mint**, phạm thẳng
 * A3.4 ("không bao giờ mint T", ngoại lệ duy nhất là `genesis_grant`).
 *
 * Đường ra không phải bỏ ý founder mà là ĐỔI THỨ TỰ: đốt SAU khi đã biết trao
 * được gì. Lúc đó "hoàn" biến thành "không trừ" — cùng một kết quả cho người
 * chơi, và không có đồng T nào được sinh ra.
 *
 * ⚠ NHƯNG ĐỔI THỨ TỰ ĐỐT KHÔNG ĐƯỢC PHÉP ĐỔI THỨ TỰ KHOÁ. Cả repo khoá theo
 * chiều `users → cosmetic_items` (xem đầu `server/shop.ts`); nếu route chạm
 * `cosmetic_items` trước rồi mới khoá `users` thì nó đi ngược chiều với mọi
 * đường ghi khác và mở cửa cho deadlock chéo. Hàm này giữ chiều đó: khoá ví ở
 * ĐÚNG CHỖ CŨ, chỉ dời phép TRỪ xuống sau.
 *
 * Trả về số dư đang có để `pull()` chấm điều kiện trên cùng con số mà `dotT`
 * sẽ trừ — hai bước phải nhìn cùng một ví, nếu không thì ngưỡng chặn và số bị
 * trừ nói về hai thời điểm khác nhau.
 */
export async function khoaVaKiemVi(
  client: Q, userId: string, giaT: number,
): Promise<bigint> {
  const { rows } = await client.query(
    'SELECT bankroll FROM users WHERE user_id = $1 FOR UPDATE', [userId]);
  if (!rows[0]) throw new ShopError('khong_co_ho_so', 404);

  const truoc = rows[0].bankroll as bigint;
  if (!duDieuKienMoHop(truoc, giaT)) {
    throw new ShopError('von_qua_thap', 409, lyDoTuChoiTieuT(BigInt(giaT)));
  }
  return truoc;
}

export async function dotT(
  client: Q, userId: string, giaT: number,
): Promise<{ truoc: bigint; sau: bigint }> {
  // Khoá lại lần nữa là CHỦ Ý, không thừa: hàm này vẫn phải đứng một mình được
  // (đường cũ gọi thẳng nó). Khoá đã cầm thì lần lấy thứ hai không tốn gì.
  const truoc = await khoaVaKiemVi(client, userId, giaT);
  const sau = truoc - BigInt(giaT);

  await client.query('UPDATE users SET bankroll = $1 WHERE user_id = $2',
    [sau.toString(), userId]);
  await client.query(
    `INSERT INTO wallet_ledger (user_id, delta, balance_after, reason)
     VALUES ($1, $2, $3, 'gacha_burn')`,
    [userId, (-BigInt(giaT)).toString(), sau.toString()],
  );
  await client.query(
    `INSERT INTO burn_ledger (amount, reason) VALUES ($1, 'gacha_burn')`, [giaT]);

  return { truoc, sau };
}

// ─────────────────────────────── TỒN KHO ────────────────────────────────────

export interface TonKho {
  readonly id: string;
  /** `null` = phát hành không giới hạn. */
  readonly gioiHan: number | null;
  readonly daPhat: number;
  /** `null` = không giới hạn. 0 = hết hàng. */
  readonly conLai: number | null;
  readonly song: boolean;
}

/**
 * Tồn kho của mọi nhãn dán — MỘT câu truy vấn, không N+1.
 *
 * Đọc-để-hiển-thị nên KHÔNG khoá: con số có thể cũ vài trăm ms và điều đó không sao.
 * Chỗ không được phép cũ là lúc CẤP PHÁT, và ở đó `capMonHuuHan` đếm lại dưới khoá.
 * Hiện tồn kho cho người chơi là bắt buộc chứ không phải trang trí: hạ bậc lặng lẽ
 * khi bậc epic cạn thì rate công khai thành nửa sự thật.
 */
export async function docTonKho(client: Q): Promise<Map<string, TonKho>> {
  /*
   * ⚠ HAI HỌ MÓN, HAI BẢNG ĐẾM — nới từ 04/08 (D68a).
   *
   * Bản trước chỉ đọc `kind = 'sticker'`, nên hai lá nền `av_trader_1/2` (cửa
   * gacha từ 04/08) không có mặt trong tồn kho ⇒ công tắc `trang_thai` của
   * chúng KHÔNG có tác dụng: ẩn một lá đi mà hộp vẫn trả ra.
   *
   * Đếm "đã phát" khác nhau vì hai họ ở hai bảng:
   *   sticker    → `kho_sticker.tong_nhan`  (một dòng/người, cộng dồn)
   *   avatar nền → `avatar_so_huu`          (một dòng/tấm), khớp theo MÃ nền
   *                 chứ không theo id — `avatar_so_huu.nen` giữ 'E'/'F'.
   *
   * Ánh xạ id→mã lấy từ `config/avatar.ts` (nguồn chân lý), truyền vào SQL dưới
   * dạng hai mảng song song. Gõ tay bảng ánh xạ ở đây là nguồn chân lý thứ hai,
   * và nó sẽ lệch đúng vào mùa thêm lá.
   */
  const nenGacha = AVATAR_NEN.filter((n) => n.nguon === 'gacha_t');
  const { rows } = await client.query(
    `SELECT ci.cosmetic_id, ci.gioi_han, ci.trang_thai,
            COALESCE((SELECT SUM(k.tong_nhan) FROM kho_sticker k
                       WHERE k.sticker_id = ci.cosmetic_id), 0) AS da_phat
       FROM cosmetic_items ci
      WHERE ci.kind = 'sticker'
     UNION ALL
     SELECT ci.cosmetic_id, ci.gioi_han, ci.trang_thai,
            COALESCE((SELECT COUNT(*) FROM avatar_so_huu a
                       WHERE a.nen = m.ma), 0) AS da_phat
       FROM cosmetic_items ci
       JOIN unnest($1::text[], $2::text[]) AS m(id, ma) ON m.id = ci.cosmetic_id
      WHERE ci.kind = 'avatar_nen'`,
    [nenGacha.map((n) => n.id), nenGacha.map((n) => n.ma)],
  );
  const m = new Map<string, TonKho>();
  for (const r of rows) {
    const gioiHan = r.gioi_han === null ? null : Number(r.gioi_han);
    const daPhat = Number(r.da_phat);
    m.set(r.cosmetic_id as string, {
      id: r.cosmetic_id as string,
      gioiHan,
      daPhat,
      conLai: gioiHan === null ? null : Math.max(0, gioiHan - daPhat),
      song: r.trang_thai === 'song',
    });
  }
  return m;
}

/**
 * CẤP PHÁT MỘT NHÃN DÁN, có tôn trọng số lượng phát hành hữu hạn.
 *
 * Khoá trước — đếm sau — rồi mới ghi. Xem khối đầu file để biết vì sao ba bước này
 * KHÔNG được gộp thành một câu lệnh.
 *
 * ⚠ Khoá được lấy trên dòng `cosmetic_items` của CHÍNH món đó, nên hai người mua
 * hai món khác nhau không chờ nhau (không phải một khoá toàn shop), còn hai người
 * mua CÙNG món thì xếp hàng — đúng chỗ cần xếp hàng.
 */
export async function capMonHuuHan(
  client: Q, userId: string, stickerId: string, soLuong = 1,
  nguon: NguonBanThe = 'gacha',
): Promise<{ conLai: number | null }> {
  if (!Number.isInteger(soLuong) || soLuong < 1) throw new ShopError('so_luong_sai', 400);

  // Bước 1 — CHỈ lấy khoá. Không đọc con số đếm ở đây: đọc ở đây là đọc bằng
  // snapshot cũ, và đó chính là lỗi đã mô tả ở đầu file.
  const { rows: ciRows } = await client.query(
    `SELECT cosmetic_id, gioi_han, trang_thai, kind FROM cosmetic_items
      WHERE cosmetic_id = $1 FOR UPDATE`,
    [stickerId],
  );
  const ci = ciRows[0];
  if (!ci) throw new ShopError('mon_khong_ton_tai', 400);
  if (ci.kind !== 'sticker') throw new ShopError('mon_khong_phai_nhan_dan', 400);
  if (ci.trang_thai !== 'song') throw new ShopError('mon_ngung_phat_hanh', 409);

  const gioiHan = ci.gioi_han === null ? null : Number(ci.gioi_han);

  // Bước 2 — CÂU LỆNH MỚI ⇒ SNAPSHOT MỚI. Đây là toàn bộ lý do hàm này không phải
  // một câu SQL cho gọn.
  if (gioiHan !== null) {
    const { rows: dRows } = await client.query(
      `SELECT COALESCE(SUM(tong_nhan), 0) AS da_phat FROM kho_sticker
        WHERE sticker_id = $1`,
      [stickerId],
    );
    const daPhat = Number(dRows[0].da_phat);
    if (daPhat + soLuong > gioiHan) {
      throw new ShopError('het_ban_phat_hanh', 409,
        `Món này chỉ phát hành ${gioiHan} bản và đã hết.`);
    }
  }

  // Bước 3 — ghi. `tong_nhan` chỉ tăng, nên nó là mẫu số của phép đếm ở bước 2 kể
  // cả sau khi người ta đã DÁN hết nhãn (dán làm `so_luong` về 0 — D36).
  await client.query(
    `INSERT INTO kho_sticker (user_id, sticker_id, so_luong, tong_nhan)
     VALUES ($1, $2, $3, $3)
     ON CONFLICT (user_id, sticker_id) DO UPDATE
       SET so_luong = kho_sticker.so_luong + EXCLUDED.so_luong,
           tong_nhan = kho_sticker.tong_nhan + EXCLUDED.tong_nhan`,
    [userId, stickerId, soLuong],
  );

  // GHI SONG SONG vào sổ vật (B1 nhịp 2) — CÙNG transaction với câu trên, nên
  // hai sổ không bao giờ ở hai trạng thái khác nhau. No-op khi cờ tắt.
  await ducBanThe(client, { mauId: stickerId, chuSoHuu: userId, nguon, soLuong });

  if (gioiHan === null) return { conLai: null };
  const { rows: sau } = await client.query(
    `SELECT COALESCE(SUM(tong_nhan), 0) AS da_phat FROM kho_sticker
      WHERE sticker_id = $1`,
    [stickerId],
  );
  return { conLai: Math.max(0, gioiHan - Number(sau[0].da_phat)) };
}
