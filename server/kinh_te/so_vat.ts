/**
 * SỔ VẬT — CỔNG DÙNG CHUNG cho mọi đường đúc/tiêu vật phẩm (bước B1, nhịp 2).
 *
 * ─── ⭐ VÌ SAO MỘT CỔNG CHỨ KHÔNG PHẢI SỬA NĂM CHỖ ──────────────────────────
 * Repo có **năm** đường ghi vào hai bảng đọc nhanh (`user_cosmetics`,
 * `kho_sticker`): gacha, cửa Q, phần thưởng lộ trình, cấp cho tester, và dán
 * nhãn. Rải logic ghi song song ra năm chỗ nghĩa là **đường thứ sáu sẽ quên**,
 * và lúc đó sổ lệch mà không có gì kêu — đúng loại hỏng mà cả bước B1 sinh ra
 * để chặn.
 *
 * Nên bất biến sống ở ĐÂY, và `tests/so_vat.test.ts` có một bài **quét mã
 * nguồn** canh mọi đường ghi hai bảng kia đều đi qua cổng này. Cùng khuôn cổng
 * `cua_tieu.ts` của B2 (D253) — repo đã dùng nếp này một lần và nó bắt được lỗi.
 *
 * ─── TẮT CỜ LÀ QUAY VỀ NGUYÊN TRẠNG ────────────────────────────────────────
 * `CO_KINH_TE.CHO_SO_VAT = false` ⇒ mọi hàm ở đây là **no-op**, không một câu
 * SQL nào chạy. Đó là tính chất giữ cho nhịp 2 an toàn: hỏng thì tắt, không mất
 * dữ liệu, không phải revert migration.
 *
 * ⚠ TỆP NÀY KHÔNG ĐỔI MỘT DÒNG ĐƯỜNG ĐỌC NÀO. Đọc vẫn lấy từ hai bảng cũ cho
 * tới B4. Có sổ không có nghĩa là đã tin sổ.
 *
 * ─── THỨ TỰ KHOÁ (M3) ──────────────────────────────────────────────────────
 *   1. users  2. cosmetic_items  3. **dot_phat_hanh**  4. vat_pham_ban_the
 *   5. TREASURY_LOCK  6. QUY_CHO_LOCK
 * Cổng này lấy khoá ở bậc 3 (`FOR UPDATE` trên dòng đợt) rồi ghi ở bậc 4 — đúng
 * chiều tăng dần. Caller nào đã giữ khoá `users`/`cosmetic_items` trước khi gọi
 * vẫn hợp lệ; caller nào đã giữ khoá Kho bạc thì **không được** gọi vào đây.
 */
import type pg from 'pg';
import { CO_KINH_TE } from '../../config/co_kinh_te.js';

/** Chỉ cần `query` — nhận Pool lẫn PoolClient, và KHÔNG tự mở được transaction. */
type Q = {
  query: (text: string, values?: readonly unknown[]) => Promise<pg.QueryResult<any>>;
};

export type NguonBanThe = 'gacha' | 'mua_he_thong' | 'di_tru' | 'tang';

export class SoVatError extends Error {
  constructor(public readonly ma: string, msg?: string) {
    super(msg ?? ma);
    this.name = 'SoVatError';
  }
}

/** Cổng đang mở hay không. Đọc một chỗ, để test và route không tự đoán. */
export function soVatDangGhi(): boolean {
  return CO_KINH_TE.CHO_SO_VAT;
}

function kiemSoLuong(soLuong: number): void {
  if (!Number.isInteger(soLuong) || soLuong <= 0) {
    throw new SoVatError('so_luong_khong_hop_le', `số lượng không hợp lệ: ${soLuong}`);
  }
}

/**
 * Lấy đợt ĐANG MỞ của một mẫu, tạo nếu chưa có, và **khoá dòng đó**.
 *
 * ⚠ `FOR UPDATE` không phải để cho chắc: `da_phat` là bộ cấp seri, và cấp seri
 * mà không khoá thì hai transaction song song đọc cùng một số rồi cùng ghi —
 * `UNIQUE (dot_id, seri)` sẽ bắt được một trong hai, nhưng bằng cách làm hỏng
 * một giao dịch của người chơi thay vì xếp hàng họ lại. Chỉ số một phần
 * `dot_mo_duy_nhat_moi_mau` bảo đảm câu "đợt nào đang mở" có đúng một câu trả lời.
 */
async function dotMoDaKhoa(client: Q, mauId: string): Promise<{ dotId: string; daPhat: number }> {
  // ⚠⚠ CHỈ tự mở đợt khi mẫu này CHƯA TỪNG có đợt nào.
  //
  // Bản đầu viết `VALUES … ON CONFLICT DO NOTHING` và **tự mở lại một mẫu đã
  // đóng vĩnh viễn** — vì không có đợt MỞ nào thì INSERT thành công. Cổng G3
  // ("đợt đã đóng") lúc đó vô nghĩa: lượt đúc kế tiếp mở lại nó. Chú thích bên
  // dưới đã nói "fail rõ, không tự mở lại", nhưng mã thì làm ngược — bài test
  // là thứ bắt được khoảng cách đó.
  //
  // `NOT EXISTS (… mau_id = $1)` là điều kiện đúng: một đợt đã đóng chặn việc
  // tự mở, còn `ON CONFLICT` vẫn ở đó để hai lượt đúc song song của một mẫu
  // MỚI không đẻ ra hai đợt.
  await client.query(
    `INSERT INTO dot_phat_hanh (mau_id, han_muc, trang_thai)
     SELECT $1, NULL, 'mo'
      WHERE NOT EXISTS (SELECT 1 FROM dot_phat_hanh WHERE mau_id = $1)
     ON CONFLICT (mau_id) WHERE trang_thai = 'mo' DO NOTHING`,
    [mauId],
  );
  const { rows } = await client.query(
    `SELECT dot_id, da_phat, han_muc FROM dot_phat_hanh
      WHERE mau_id = $1 AND trang_thai = 'mo'
      FOR UPDATE`,
    [mauId],
  );
  if (rows.length !== 1) {
    // Không có đợt mở = mẫu đã đóng vĩnh viễn (cổng G3). Fail RÕ, không tự mở
    // lại một đợt — mở lại một đợt đã đóng là xoá đúng thứ khan hiếm vừa hứa.
    throw new SoVatError('dot_da_dong', `mẫu ${mauId} không có đợt nào đang mở`);
  }
  return { dotId: String(rows[0].dot_id), daPhat: Number(rows[0].da_phat) };
}

/**
 * ĐÚC `soLuong` bản thể cho một người. Trả về danh sách seri đã cấp (rỗng khi
 * cờ tắt).
 *
 * Seri liên tiếp trong đợt: `da_phat + 1 … da_phat + soLuong`. Ràng buộc
 * `dot_khong_vuot_han_muc` ở tầng DB là thứ chặn vượt hạn mức — không phải một
 * phép kiểm ở đây, vì phép kiểm ở đây chạy TRƯỚC lúc ghi và có thể lạc hậu.
 */
export async function ducBanThe(
  client: Q,
  d: { mauId: string; chuSoHuu: string; nguon: NguonBanThe; soLuong: number },
): Promise<number[]> {
  if (!soVatDangGhi()) return [];
  kiemSoLuong(d.soLuong);
  const { dotId, daPhat } = await dotMoDaKhoa(client, d.mauId);

  const seri = Array.from({ length: d.soLuong }, (_, i) => daPhat + 1 + i);
  await client.query(
    `INSERT INTO vat_pham_ban_the (dot_id, seri, chu_so_huu, kho, trang_thai, nguon)
     SELECT $1, s, $2, NULL, 'tu_do', $3 FROM unnest($4::int[]) AS s`,
    [dotId, d.chuSoHuu, d.nguon, seri],
  );
  await client.query(
    'UPDATE dot_phat_hanh SET da_phat = da_phat + $2 WHERE dot_id = $1',
    [dotId, d.soLuong],
  );
  return seri;
}

/**
 * TIÊU `soLuong` bản thể `tu_do` của một người (dán nhãn — D36).
 *
 * ⚠ Chọn bản CŨ NHẤT trước (`ban_the_id` tăng dần). Đây là một quyết định, không
 * phải một chi tiết: người chơi giữ bản seri thấp vì nó có ý nghĩa sưu tầm, nên
 * tiêu bản mới nhất trước là lấy đi đúng thứ họ muốn giữ. FIFO theo id là quy
 * ước rẻ và đoán được; đổi nó sau này là đổi một lời hứa ngầm.
 *
 * Trả về số bản thật sự tiêu được. Caller phải đối chiếu với `soLuong` — thiếu
 * nghĩa là sổ và bảng đọc nhanh đã lệch, và đó là tin phải nổ chứ không phải
 * làm ngơ.
 *
 * ⚠⚠ `FOR UPDATE OF b` — CHỮ `OF b` KHÔNG PHẢI CHI TIẾT. Một `FOR UPDATE` trần
 * trong câu có JOIN khoá dòng của **mọi** bảng trong FROM, tức nó vơ luôn
 * `dot_phat_hanh` (bậc 3) cùng lúc với `vat_pham_ban_the` (bậc 4) — hai bậc
 * khoá trong một câu, thứ tự do bộ lập kế hoạch quyết chứ không do ta. Ở đây
 * chỉ cần khoá bản thể; đợt chỉ đọc để lọc.
 *
 * (Chú thích này nằm NGOÀI chuỗi SQL có chủ ý: dấu ` trong một template literal
 * đóng luôn chuỗi đó — repo đã trả giá đúng lỗi này ở D253.)
 */
export async function tieuBanThe(
  client: Q,
  d: { mauId: string; chuSoHuu: string; soLuong: number },
): Promise<number> {
  if (!soVatDangGhi()) return 0;
  kiemSoLuong(d.soLuong);
  const { rowCount } = await client.query(
    `UPDATE vat_pham_ban_the SET trang_thai = 'da_gan'
      WHERE ban_the_id IN (
        SELECT b.ban_the_id FROM vat_pham_ban_the b
        JOIN dot_phat_hanh d ON d.dot_id = b.dot_id
        WHERE d.mau_id = $1 AND b.chu_so_huu = $2 AND b.trang_thai = 'tu_do'
        ORDER BY b.ban_the_id
        LIMIT $3
        FOR UPDATE OF b
      )`,
    [d.mauId, d.chuSoHuu, d.soLuong],
  );
  return rowCount ?? 0;
}

/**
 * CHUYỂN một bản thể `tu_do` của người chơi VÀO KHO Hệ thống (bán cho AMM, ký
 * gửi đấu giá…) — kèm trừ bảng đọc nhanh, cùng transaction.
 *
 * ⚠ KHÁC HAI HÀM TRÊN, HÀM NÀY KHÔNG NO-OP KHI CỜ TẮT — NÓ NÉM LỖI. Đúc và tiêu
 * có một biểu diễn ở bảng đọc nhanh (cộng/trừ `so_luong`), nên cờ tắt thì cache
 * vẫn tự đủ. "Bản này giờ thuộc Hệ thống" thì KHÔNG có chỗ nào ở cache để ghi —
 * `kho_sticker` không có dòng cho Hệ thống. Không có sổ thì phép chuyển vô nghĩa,
 * và một phép chuyển vô nghĩa mà lặng lẽ thành công là cách mất đồ sạch nhất.
 *
 * Kiểm chủ + trạng thái DƯỚI KHOÁ (bậc 4): hai tab cùng bán một bản thì tab sau
 * phải thấy nó đã đổi chủ. Cache không có dòng để trừ ⇒ sổ và cache đã lệch ⇒
 * ném `so_lech`, caller rollback cả giao dịch — để `audit:cung` chỉ đúng chỗ,
 * không bán bừa trên một cái kho sai.
 */
export async function chuyenBanTheVaoKho(
  client: Q,
  d: { banTheId: string; chuSoHuu: string; mauId: string; kho: 'amm' | 'dau_gia' | 'trung_bay' },
): Promise<void> {
  if (!soVatDangGhi()) {
    throw new SoVatError('so_vat_dang_tat', 'chuyển vào kho cần sổ vật đang ghi (CHO_SO_VAT)');
  }
  const { rows } = await client.query(
    `SELECT chu_so_huu::text AS chu, trang_thai FROM vat_pham_ban_the
      WHERE ban_the_id = $1 FOR UPDATE`, [d.banTheId]);
  if (rows[0]?.chu !== d.chuSoHuu || rows[0]?.trang_thai !== 'tu_do') {
    throw new SoVatError('khong_tu_do', 'bản này không còn là bản tự do của người này');
  }
  await client.query(
    `UPDATE vat_pham_ban_the SET chu_so_huu = NULL, kho = $2 WHERE ban_the_id = $1`,
    [d.banTheId, d.kho]);
  const tru = await client.query(
    `UPDATE kho_sticker SET so_luong = so_luong - 1
      WHERE user_id = $1 AND sticker_id = $2 AND so_luong > 0`, [d.chuSoHuu, d.mauId]);
  if (tru.rowCount !== 1) {
    throw new SoVatError('so_lech', 'sổ vật có bản này nhưng kho_sticker không có gì để trừ');
  }
}

/**
 * CHUYỂN một bản thể ĐANG NẰM TRONG KHO Hệ thống VỀ TAY một người chơi (mua ở
 * AMM, thắng phiên đấu giá…) — kèm cộng bảng đọc nhanh, cùng transaction.
 *
 * Đây là chiều ngược của `chuyenBanTheVaoKho`, và **không no-op khi cờ tắt** vì
 * đúng một lý do: nguồn hàng là kho Hệ thống, thứ chỉ tồn tại trong sổ vật. Cờ
 * tắt thì không có kho để lấy ra, nên một phép chuyển "thành công" lúc đó là
 * đúc ra một món từ hư không — tệ hơn hẳn một lỗi rõ ràng.
 *
 * ⚠⚠ CỘNG `so_luong`, TUYỆT ĐỐI KHÔNG CỘNG `tong_nhan`. `tong_nhan` là mẫu số
 * của cổng hữu hạn (`capMonHuuHan` đếm `SUM(tong_nhan)` để so với `gioi_han`),
 * nên nó phải đếm **số bản đã từng ĐÚC**, không phải số lần một bản đổi tay.
 * Cộng nó ở đây thì một món giới hạn 50 bản sẽ "hết hàng" sau 50 lượt mua đi
 * bán lại của cùng vài bản — nguồn cung không đổi một cái nào mà cổng vẫn đóng.
 * (Chiều kia cũng vậy: `chuyenBanTheVaoKho` chỉ trừ `so_luong`.)
 *
 * Kiểm "còn trong kho" DƯỚI KHOÁ (bậc 4): hai người cùng bấm mua một bản thì
 * người sau phải thấy nó đã có chủ. Đây là toàn bộ chỗ chống bán một món hai lần.
 */
export async function chuyenBanTheChoNguoi(
  client: Q,
  d: { banTheId: string; chuMoi: string; mauId: string; kho: 'amm' | 'dau_gia' | 'trung_bay' },
): Promise<void> {
  if (!soVatDangGhi()) {
    throw new SoVatError('so_vat_dang_tat', 'lấy hàng khỏi kho cần sổ vật đang ghi (CHO_SO_VAT)');
  }
  const { rows } = await client.query(
    `SELECT chu_so_huu::text AS chu, kho, trang_thai FROM vat_pham_ban_the
      WHERE ban_the_id = $1 FOR UPDATE`, [d.banTheId]);
  if (rows[0]?.chu !== null || rows[0]?.kho !== d.kho || rows[0]?.trang_thai !== 'tu_do') {
    throw new SoVatError('khong_con_trong_kho', 'bản này không còn nằm trong kho Hệ thống');
  }
  await client.query(
    `UPDATE vat_pham_ban_the SET chu_so_huu = $2, kho = NULL WHERE ban_the_id = $1`,
    [d.banTheId, d.chuMoi]);
  await client.query(
    `INSERT INTO kho_sticker (user_id, sticker_id, so_luong, tong_nhan)
     VALUES ($1, $2, 1, 0)
     ON CONFLICT (user_id, sticker_id) DO UPDATE
       SET so_luong = kho_sticker.so_luong + 1`,
    [d.chuMoi, d.mauId]);
}

/**
 * SỔ ĐĂNG KÝ ĐÓNG — những tệp được phép ghi thẳng vào hai bảng đọc nhanh.
 *
 * ⚠ Danh sách ĐÓNG, mỗi mục kèm `viSao`, và `tests/so_vat.test.ts` quét mã nguồn
 * đối chiếu. Thêm một tệp vào đây là một QUYẾT ĐỊNH (phải kèm gọi cổng), không
 * phải một cú sửa test cho hết đỏ. Cùng khuôn hai sổ đăng ký của `cua_tieu.ts`.
 */
export const SO_DANG_KY_GHI_KHO: ReadonlyArray<{ tep: string; viSao: string }> = [
  { tep: 'server/shop.ts', viSao: 'cửa Q: mua khung/skin ⇒ user_cosmetics' },
  { tep: 'server/shop_kho.ts', viSao: 'gacha + cấp món hữu hạn ⇒ kho_sticker' },
  { tep: 'server/avatar.ts', viSao: 'dán nhãn tiêu hao ⇒ kho_sticker giảm' },
  { tep: 'server/nhiem_vu.ts', viSao: 'phần thưởng lộ trình ⇒ user_cosmetics' },
  { tep: 'server/admin_tester.ts', viSao: 'cấp món cho tài khoản thử nghiệm' },
  /*
   * ⚠ `server/cho.ts` (B7a) CỐ Ý KHÔNG có ở đây. Nó bán một bản thể mà không
   * nhắc tên bảng nào — chỉ gọi `chuyenBanTheVaoKho`. Đó là TRẠNG THÁI ĐÍCH của
   * cả cổng này: một route mới không cần khai gì, vì nó không có gì để khai.
   * Bài quét vẫn bắt được nó nếu một ngày nó ghi tay hai bảng kia.
   */
];

/** Tệp được phép NHẮC tên hai bảng mà không phải ghi (đọc, backup, chú thích). */
export const SO_DANG_KY_CHI_DOC: ReadonlyArray<{ tep: string; viSao: string }> = [
  { tep: 'server/backup.ts', viSao: 'danh sách bảng cần sao lưu — không ghi' },
  { tep: 'server/kinh_te/so_vat.ts', viSao: 'chính cổng — nơi DUY NHẤT được ghi kho_sticker THAY cho người khác (chuyenBanTheVaoKho / chuyenBanTheChoNguoi)' },
  { tep: 'server/kinh_te/audit_vat.ts', viSao: 'đối chiếu sổ ↔ bảng đọc nhanh (E2)' },
];
