/**
 * PFM — XOÁ SẠCH (P9 🔒).
 *
 * ⚠⚠ MỘT HÀM, HAI LỐI VÀO. Đây là bản vá cho một lỗi thật của bản kiến trúc đầu:
 * `DELETE /pfm` được thiết kế như một route riêng, mà **người vừa xoá tài khoản thì
 * không còn cửa nào gọi nó** — nên đường xoá tài khoản (`/account/delete`) chỉ ẩn danh
 * hoá `users` và để nguyên mọi bảng `pfm_*`. Cả hai lối vào nay gọi CÙNG hàm này; hai
 * bản cài đặt của cùng một việc là bản thứ hai sẽ trôi (D61), và ở đây "trôi" nghĩa là
 * dữ liệu tài chính của một người đã yêu cầu xoá vẫn nằm lại.
 *
 * ⚠ VÌ SAO CẦN CỜ `delphi.xoa_pfm`: `pfm_token_ledger` là append-only ở tầng DB
 * (A3.10). Hai luật 🔒 cắn nhau — A3.10 đòi sổ cái bất biến, P9 🔒 đòi xoá tài khoản là
 * sạch. Quyền xoá của user (nghĩa vụ pháp lý) THẮNG quy ước kế toán nội bộ, nhưng phải
 * thắng TƯỜNG MINH: cờ này là cửa thoát DUY NHẤT, đặt ở ĐÚNG một chỗ (file này), nên
 * nó grep được và có test canh. UPDATE thì vẫn cấm tuyệt đối, không cửa nào.
 */
import type pg from 'pg';
import { CUA_PFM, CUA_PFM_COT } from '../../config/pfm_consent.js';
import { ghiEventPfm } from './su_kien.js';

/**
 * Bốn cửa consent (D295) về FALSE — ghép tên cột từ `CUA_PFM_COT`, không gõ tay (D61).
 * Xoá sạch mà để một cửa còn mở là để một đường dữ liệu mở cho người vừa rút lại tất cả.
 */
const DONG_BON_CUA = CUA_PFM.map((cua) => `${CUA_PFM_COT[cua]} = FALSE`).join(', ');

/** Thứ tự xoá: con trước, cha sau. Không bảng nào tham chiếu bảng nào nên thứ tự chỉ để đọc. */
export const BANG = [
  'pfm_dac_trung',
  // Bộ nhớ chống trùng của `/pfm/dong-bo` (0056). Nó CHỈ chứa id món do client đặt, không
  // chứa tiền — nhưng P9 🔒 là "xoá tài khoản là sạch", không phải "sạch những thứ
  // tôi thấy nhạy cảm". Một bảng khoá theo `user_id` mà không có trong danh sách này
  // là một chỗ dữ liệu nằm lại sau khi người ta đã yêu cầu xoá.
  'pfm_lo_da_nhan',
  'pfm_cup',
  'pfm_tuan',
  'pfm_ngay',
  'pfm_token_ledger',
  'pfm_luu',
] as const;

export type ThongKeXoa = Record<(typeof BANG)[number] | 'users_reset', number>;

/**
 * Xoá sạch mọi dấu vết PFM của một user.
 *
 * ⚠ PHẢI GỌI TRONG TRANSACTION CỦA NGƯỜI GỌI — nửa vời còn tệ hơn không xoá: một cú
 * xoá đứt giữa chừng để lại ví token có số dư mà sổ cái đã trống, tức trạng thái mà
 * chính trigger khớp-sổ tồn tại để chặn.
 *
 * ⚠ KHÔNG đụng `events`. Nhịp PFM ở đó CHỈ mang id + enum (K5) — sau khi tài khoản
 * được ẩn danh hoá, phần còn lại là xác số học vô chủ, không đọc ra được gì về tiền.
 * Đó chính là lý do K5 cấm số tiền và chữ tự do ngay từ đầu.
 */
export async function xoaSachPfm(
  client: pg.PoolClient, userId: string,
): Promise<ThongKeXoa> {
  // Cờ CỤC BỘ TRANSACTION (`is_local = true`): hết hiệu lực ngay khi commit/rollback,
  // nên không có đường nào để nó rò sang request khác.
  await client.query(`SELECT set_config('delphi.xoa_pfm', '1', true)`);

  const tk = {} as ThongKeXoa;
  for (const b of BANG) {
    const r = await client.query(`DELETE FROM ${b} WHERE user_id = $1`, [userId]);
    tk[b] = r.rowCount ?? 0;
  }

  /*
   * ⚠⚠ VẾT RÚT LẠI TỪNG CỬA, TRƯỚC KHI ĐÓNG. `POST /pfm/consent` ghi `pfm_tat{cua}` cho
   * mỗi cửa người dùng tắt tay — nhưng đường rút lại MẠNH NHẤT (xoá sạch, và
   * `/account/delete` cũng đi qua đây) lại từng im lặng. Hậu quả không thấy được từ trong
   * app: ai dựng lại lịch sử đồng ý từ `events` — thứ `config/pfm_consent.ts` mở đầu bằng
   * cách gọi tên là BẰNG CHỨNG — sẽ thấy bốn cửa vẫn "đang đồng ý" sau khi người ta đã
   * xoá tất cả. Với `/account/delete` thì vết cuối cùng của một người vừa rời đi là
   * "đã đồng ý", và họ không còn ở đây để cải chính.
   * ⚠ Đọc `FOR UPDATE` trong cùng transaction: hai cú xoá song song mà đọc ngoài khoá thì
   * cả hai cùng thấy cửa mở và ghi hai lần vết cho một lần rút.
   */
  const cuaTruoc = await client.query(
    `SELECT ${CUA_PFM.map((cua) => `${CUA_PFM_COT[cua]} AS ${cua}`).join(', ')}
       FROM users WHERE user_id = $1 FOR UPDATE`, [userId]);
  for (const cua of CUA_PFM) {
    if (cuaTruoc.rows[0]?.[cua] === true) {
      await ghiEventPfm(client, userId, 'pfm_tat', { cua });
    }
  }

  /*
   * Trả ví + consent về mặc định. Phải làm SAU khi sổ cái đã trống, và phải nằm trong
   * cùng transaction — trigger khớp-sổ là DEFERRED nên nó kiểm lúc COMMIT, lúc đó cả
   * hai vế đều đã ở trạng thái cuối.
   */
  const u = await client.query(
    `UPDATE users
        SET pfm_token = 0, pfm_consent = FALSE, pfm_bat_dau = NULL, ${DONG_BON_CUA}
      WHERE user_id = $1`, [userId]);
  tk.users_reset = u.rowCount ?? 0;
  return tk;
}
