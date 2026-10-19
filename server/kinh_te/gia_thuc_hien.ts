/**
 * GIÁ THỰC HIỆN — đọc giá NGƯỜI CHƠI THẬT SỰ TRẢ từ `events` (tầng T5, bước B7b).
 *
 * `chi_so_gia.ts` là hàm thuần và nhận vào một cái rổ; tệp này là thứ ĐI LẤY cái
 * rổ đó từ dữ liệu thật. Tách hai việc vì đúng một lý do: chỉ số phải test được
 * bằng số chép tay, còn phép đọc thì phải test được bằng DB — trộn lại thì
 * không làm được cái nào cho ra hồn.
 *
 * ═══════════════════════════════════════════════════════════════════════════
 * ⚠⚠ CHỈ ĐẾM `cho_mua`, KHÔNG ĐẾM `cho_ban` — VÀ ĐÂY KHÔNG PHẢI LƯỜI
 *
 * Hai chiều của chợ là hai mức giá khác nhau của cùng một món: `cho_ban` ghi giá
 * Hệ thống MUA VÀO (`gia_san`), `cho_mua` ghi giá Hệ thống BÁN RA (`gia_ban_ra`),
 * và giữa chúng luôn có spread 20%. Bình quân cả hai vào một con số thì chỉ số
 * sẽ **nhảy theo tỷ lệ mua/bán chứ không theo giá**: một ngày ai cũng bán thì
 * chỉ số tụt 20% dù không một mức giá nào đổi. Đó là "bid-ask bounce", và nó là
 * cách kinh điển để một chỉ số giá nói dối mà vẫn có vẻ có dữ liệu.
 *
 * Chọn `cho_mua` chứ không phải `cho_ban` cũng là bắt buộc, không phải tuỳ ý: kỳ
 * gốc của chỉ số là `giaGocRo()` = **giá bán ra** ở tồn kho tham chiếu. So một
 * chuỗi giá mua vào với một kỳ gốc giá bán ra là so hai thứ khác đơn vị, và tỷ
 * số sẽ vĩnh viễn quanh 83% mà không ai sai ở đâu cả.
 *
 * (Chuỗi giá mua vào có nghĩa riêng của nó — đo Hệ thống trả bao nhiêu cho người
 * chơi. Khi cần thì nó là một chỉ số THỨ HAI, có kỳ gốc riêng, không phải một
 * nửa của chỉ số này.)
 *
 * ═══════════════════════════════════════════════════════════════════════════
 * THIẾU MẪU LÀ `null`, KHÔNG PHẢI 0 (A11.2/D62)
 *
 * Một bậc không có giao dịch nào trong cửa sổ ⇒ `null` ⇒ `chiSoThucHien` trả
 * `null` cho CẢ chỉ số (nó cố ý không chia lại trọng số — xem chú thích ở
 * `chi_so_gia.ts`). Với 26 người thật và một mẫu epic duy nhất, trạng thái
 * thường ngày của chỉ số này SẼ là `null`, và đó là câu trả lời đúng: "chưa đủ
 * giao dịch để nói". Một con số bịa ở đây chảy thẳng vào `quyetDinhChinhSach`.
 *
 * ⚠ Cột thời gian của `events` là **`ts`**, không phải `created_at` — ba sổ tiền
 * dùng `created_at` nên chép câu WHERE từ bên đó sang là nổ ngay. Ghi ra vì nó
 * đã nổ một lần trong chính lượt viết tệp này.
 */
import type pg from 'pg';
import { BAC_TRONG_RO, type GiaThucHien } from './chi_so_gia.js';

type Q = {
  query: (text: string, values?: readonly unknown[]) => Promise<pg.QueryResult<any>>;
};

/** Số giao dịch tối thiểu của MỘT bậc để bình quân của bậc đó có nghĩa. */
export const TOI_THIEU_MOI_BAC = 1;

export interface TomTatGiaThucHien {
  ro: GiaThucHien;
  /** Số giao dịch `cho_mua` đã tính, theo bậc — để người đọc biết mẫu mỏng cỡ nào. */
  soGiaoDich: Readonly<Record<string, number>>;
  /** Tổng T người chơi đã trả trong cửa sổ. Vòng quay chợ, câu hỏi trung tâm của D263. */
  tongT: bigint;
  /**
   * TỔNG số lượt mua, kể cả bậc NGOÀI rổ. Khác `Σ soGiaoDich` một cách có chủ
   * ý: rổ là để so giá nên nó cố định ba bậc, còn "chợ chạy được bao nhiêu lượt"
   * thì bỏ sót một bậc là đếm sai. Suy `tongLuot` từ `soGiaoDich` là cái bẫy —
   * hai con số ấy được phép khác nhau.
   */
  tongLuot: number;
  /** Số giao dịch KHÔNG đóng một đồng phí nào (cả 3% lẫn 2% làm tròn về 0). */
  soGiaoDichPhiBang0: number;
}

/**
 * Đọc giá thực hiện bình quân theo bậc trong `soNgay` ngày gần nhất.
 *
 * Bình quân GIA QUYỀN THEO SỐ LƯỢNG (tổng T ÷ số giao dịch), không phải bình
 * quân của các bình quân — mỗi sự kiện là một món nên hai cách chỉ khác nhau khi
 * ai đó gộp sự kiện, và ngày đó tới thì cách này vẫn đúng.
 *
 * ⚠ `floor` một lần ở cuối (C5). Chia từng bước rồi cộng là hai lần làm tròn.
 */
export async function docGiaThucHien(
  client: Q, soNgay: number,
): Promise<TomTatGiaThucHien> {
  if (!Number.isInteger(soNgay) || soNgay <= 0) {
    throw new Error(`số ngày không hợp lệ: ${soNgay}`);
  }
  const { rows } = await client.query(
    `SELECT value_json->>'b' AS bac,
            count(*)::int    AS n,
            COALESCE(SUM(value_num), 0)::text AS tong,
            count(*) FILTER (
              WHERE COALESCE((value_json->>'pd')::int, 0) = 0
                AND COALESCE((value_json->>'pk')::int, 0) = 0)::int AS phi0
       FROM events
      WHERE action_type = 'cho_mua'
        AND ts > now() - make_interval(days => $1)
      GROUP BY value_json->>'b'`,
    [soNgay],
  );

  const theoBac: Record<string, bigint | null> = {};
  const soGiaoDich: Record<string, number> = {};
  let tongT = 0n;
  let phi0 = 0;
  let tongLuot = 0;

  const theoTen = new Map(rows.map((r) => [String(r.bac), r]));
  for (const bac of BAC_TRONG_RO) {
    const r = theoTen.get(bac);
    const n = r ? Number(r.n) : 0;
    soGiaoDich[bac] = n;
    theoBac[bac] = n >= TOI_THIEU_MOI_BAC ? BigInt(r!.tong) / BigInt(n) : null;
  }
  // Vòng quay + phí đếm trên MỌI giao dịch, kể cả bậc ngoài rổ: rổ là để so giá,
  // còn "chợ chạy được bao nhiêu T" thì không được bỏ sót cái nào.
  for (const r of rows) {
    tongT += BigInt(r.tong);
    phi0 += Number(r.phi0);
    tongLuot += Number(r.n);
  }

  return { ro: { theoBac }, soGiaoDich, tongT, tongLuot, soGiaoDichPhiBang0: phi0 };
}
