/**
 * ═══════════════════════════════════════════════════════════════════════════
 * CỬA CHẶN CHO MỌI ĐƯỜNG ĐỌC GỘP (D101 — bàn tròn 5 vai tìm ra, 17/08)
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * ⚠⚠ LỖ ĐÃ SỐNG: `/admin/tk/tinh-cach` gom `SELECT DISTINCT owner_user_id FROM
 * holdem_matches ... LIMIT 300` rồi chạy hồ sơ từng người — KHÔNG lọc
 * `research_consent`, KHÔNG sàn cỡ ô. Tức bảng phân bố 9 tính cách + trung bình
 * sáu chỉ số đang gộp cả người CHƯA đồng ý nghiên cứu. Hôm nay thiệt hại bằng 0
 * vì mùa 0.0 không bán gì cho ai (A1) — và đó CHÍNH LÀ lý do sửa bây giờ rẻ.
 *
 * Repo đã có nguyên tắc đúng và đã viết thành lý lẽ ở `holdem_api.ts` (*"ép
 * đồng ý để được chơi thì đồng ý không còn là đồng ý"*); đây là chỗ nguyên tắc
 * ấy chưa được thi hành.
 *
 * ⭐ CỔNG ĐẶT Ở TẦNG ĐỌC, KHÔNG Ở TẦNG GHI — và đó là lựa chọn có lý do:
 * `events` APPEND-ONLY (A3.3) nên người rút đồng ý KHÔNG xoá được dòng đã ghi.
 * Chặn ở tầng đọc là cách DUY NHẤT để lời hứa "rút lại được" là thật trên một
 * kho không xoá được.
 *
 * ⚠ `/me/*` KHÔNG đi qua đây, có chủ ý: người xem hồ sơ CỦA CHÍNH MÌNH không
 * cần đồng ý gì cả — đồng ý là để người khác đọc, không phải để mình đọc mình.
 */
import type pg from 'pg';
import { TELEMETRY } from '../config/telemetry.js';

/**
 * Tham số riêng tư — PLAYTEST-TUNE, MỘT chỗ.
 *
 * ⚠ `SAN_O` ở đây là sàn cho BẢNG ADMIN NỘI BỘ, KHÔNG phải sàn cho bản phát
 * hành ra ngoài. Hai con số khác nhau về bản chất: bảng admin chỉ founder đọc
 * (người vốn đã xem được từng dòng dữ liệu qua DB), còn bản phát hành thì đi
 * tới người lạ và phải chịu sàn cao hơn hẳn. Bàn tròn đề xuất 50 người/ô cho
 * bản phát hành — **con số đó CHỜ FOUNDER (A8.2)**, và phải đi kèm biên bin
 * đăng ký trước, nhịp phát hành cố định, chỉ phát hành TÍCH LUỸ (không phát
 * hành chênh lệch hai kỳ — chặn tấn công hiệu số), cấm tuyệt đối bảng
 * "mỗi người một dòng" kể cả với id đã băm.
 *
 * Vì sao vẫn cần sàn cho bảng nội bộ: SÁU CHỈ SỐ LIÊN TỤC TRÊN MỘT NGƯỜI LÀ
 * MỘT DẤU VÂN TAY. Một ô có đúng 1 người thì "trung bình của ô" chính là số
 * của người đó, và bảng nội bộ là nguồn của mọi bản xuất về sau — quen tay đọc
 * ô-một-người ở đây thì bản xuất sau cũng sẽ có nó.
 */
export const RIENG_TU = {
  /** Ô phân bố dưới ngần này người thì gộp vào `_it_hon_san`, không lộ số. */
  SAN_O: 3,
  /** Trần số người quét mỗi lần gọi (giữ nguyên hành vi cũ). */
  TRAN_QUET: 300,
} as const;

export interface CuaGop {
  /** Id những người ĐÃ đồng ý nghiên cứu và có dữ liệu trận. */
  user_ids: string[];
  /** Số người có dữ liệu nhưng CHƯA đồng ý ⇒ bị loại. Hiện lên màn admin để
   *  cỡ mẫu tụt không bị đọc nhầm thành "app hỏng". */
  bo_qua_chua_dong_y: number;
}

/**
 * MỘT cửa cho mọi truy vấn GỘP trên hồ sơ người chơi. Thêm bảng gộp mới thì
 * gọi hàm này — `tests/rieng_tu.test.ts` canh CẢ LỚP theo khuôn D79/D93: nó
 * đọc chính mã nguồn và bắt mọi lời gọi `hoSoTinhCachCuaUser` trong tầng admin
 * phải đứng sau `cuaGopHoSo`, nên quên là ĐỎ chứ không im lặng.
 */
export async function cuaGopHoSo(
  db: pg.Pool | pg.PoolClient,
  opts: {
    gomAdmin?: boolean; gomTester?: boolean;
    /**
     * D341 — chỉ lấy người có ÍT NHẤT MỘT TRẬN BẮT ĐẦU trong khoảng (ngày VN, hai đầu đều lấy). Hồ sơ của họ vẫn
     * dựng trên cả lịch sử: một gói cần ≥10 trận liên tiếp, cắt theo ngày thì khoảng ngắn không còn hồ sơ nào
     * (founder chốt 16/09). Thiếu ⇒ mọi người có trận, như trước.
     */
    khoang?: { tu: string; den: string };
  } = {},
): Promise<CuaGop> {
  /*
   * ⚠ LOẠI ADMIN KHỎI CỠ MẪU (D212). Đo prod 01/09: **100% hồ sơ tính cách là
   * của admin** — tức bảng "phân bố tính cách người chơi" đang mô tả đúng một
   * người, và người đó là founder đi test. Gộp vào là dựng chân dung của thợ
   * sửa thay vì của khách.
   *
   * Cửa này lọc ở ĐÂY chứ không ở route vì nó là chỗ DUY NHẤT quyết định ai vào
   * cỡ mẫu — lọc ở route thì lần sau ai thêm một mặt khác dùng lại hàm này sẽ
   * lặng lẽ gộp admin trở lại.
   */
  const boAdmin = opts.gomAdmin ? '' : `AND u.role <> 'admin'`;
  /*
   * ⚠ LOẠI TESTER (0052) — LỚP THỨ BA, ĐỘC LẬP VỚI LỚP TRÊN, KHÔNG THAY THẾ NÓ.
   * `role='admin'` và `la_tester` là hai trục khác nhau (một tài khoản uỷ
   * quyền qua D208 có thể KHÔNG phải tester; một tester tương lai không nhất
   * thiết phải là admin — cột `la_tester` chỉ bật bằng SQL tay, không ràng
   * buộc `role`). Giữ hai điều kiện TÁCH RỜI trong WHERE (không gộp vào một
   * biểu thức) để mai sau ai đọc lại còn thấy rõ đây là hai LÝ DO loại trừ
   * khác nhau, đúng khuôn "ba lớp ba vai, đừng gộp" của migrations/0052.
   */
  const boTester = opts.gomTester ? '' : `AND NOT u.la_tester`;
  // Mốc đổi ra timestamptz ở SQL theo múi giờ config — cùng luật 1 của `admin_phan_tich.ts`, không so ngày UTC.
  const tz = TELEMETRY.MUI_GIO;
  const trongKhoang = opts.khoang
    ? `AND m.started_at >= (($2)::date)::timestamp AT TIME ZONE '${tz}'
       AND m.started_at <  (($3)::date + 1)::timestamp AT TIME ZONE '${tz}'`
    : '';
  const r = await db.query(
    `SELECT u.user_id,
            COALESCE(u.research_consent, false) AS dong_y
       FROM users u
      WHERE EXISTS (SELECT 1 FROM holdem_matches m WHERE m.owner_user_id = u.user_id ${trongKhoang})
        ${boAdmin} ${boTester}
      ORDER BY u.created_at ASC
      LIMIT $1`,
    opts.khoang ? [RIENG_TU.TRAN_QUET, opts.khoang.tu, opts.khoang.den] : [RIENG_TU.TRAN_QUET]);
  const ids: string[] = []; let bo = 0;
  for (const row of r.rows) {
    if (row.dong_y === true) ids.push(String(row.user_id)); else bo += 1;
  }
  return { user_ids: ids, bo_qua_chua_dong_y: bo };
}

/**
 * Áp sàn cỡ ô lên một bảng đếm: ô mỏng gộp vào `_it_hon_san`.
 * Gộp chứ KHÔNG vứt — vứt thì tổng không còn khớp `n_nguoi` và người đọc sẽ
 * tự cộng ra một cỡ mẫu sai.
 */
export function sanO(dem: Record<string, number>, san = RIENG_TU.SAN_O): Record<string, number> {
  const ra: Record<string, number> = {}; let mong = 0;
  for (const [k, v] of Object.entries(dem)) {
    if (v >= san) ra[k] = v; else mong += v;
  }
  if (mong > 0) ra._it_hon_san = mong;
  return ra;
}
