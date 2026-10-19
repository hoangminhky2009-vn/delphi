/**
 * PFM — XỬ LÝ MỘT LÔ HỖN HỢP (`POST /pfm/dong-bo`, R8/D251).
 *
 * ⚠⚠ MỘT MÓN HỎNG KHÔNG ĐƯỢC KÉO CẢ LÔ XUỐNG, VÀ MỘT MÓN HỎNG CŨNG KHÔNG ĐƯỢC
 * NẰM LẠI MÃI. Hai câu đó nghe hiển nhiên nhưng chúng đối nhau, và bản dễ viết
 * (`ném lỗi đầu tiên → 400 cả lô`) thua cả hai: hàng đợi client giữ nguyên mọi món,
 * gửi lại, hỏng y hệt, **vĩnh viễn** — một dòng sai chặn đứng mọi thứ phía sau nó mà
 * không ai nhìn thấy. Nên ở đây mỗi món có kết quả RIÊNG, và mọi lý do từ chối đều
 * là TẤT ĐỊNH nên client được phép bỏ luôn (giao ước ở `config/pfm_dong_bo.ts`).
 *
 * ⚠⚠ VÌ SAO SAVEPOINT CHỨ KHÔNG PHẢI try/catch THƯỜNG: trong Postgres, một câu SQL
 * lỗi làm **cả transaction vào trạng thái abort** — mọi câu sau đó ăn `current
 * transaction is aborted` cho tới khi ROLLBACK. Nên "bắt lỗi món này rồi chạy tiếp
 * món kia" chỉ chạy được nếu lỗi là một `throw` của JS. Ràng buộc ở tầng DB thì
 * không (vd. CHECK `pg_column_size(gia_tri) <= 256`): nó nổ ở tầng SQL. SAVEPOINT là
 * thứ duy nhất cô lập được đúng một món.
 *
 * ⚠⚠ CHỐNG TRÙNG CHỈ ÁP CHO `nhip`, KHÔNG ÁP CHO `goi` — và bản đầu D251 làm sai đúng
 * chỗ này. Bảng `pfm_lo_da_nhan` (0056) sinh ra để bảo vệ ĐÚNG MỘT thứ: `events`
 * append-only, thứ nhân đôi rồi thì không xoá được. `goi` **không chạm `events`** — nó
 * UPSERT vào `pfm_dac_trung` theo khoá `(user_id, ky, lop, ma, doi_tuong)` nên gửi lại
 * là BẤT BIẾN, và đó là Ý ĐỒ.
 * ⇒ Áp chống trùng lên `goi` không chặn được bản sao nào (không có bản sao nào để chặn)
 * mà chỉ gây MẤT: khoá hàng đợi của gói là `goi:<ky>`, ổn định theo KỲ chứ không theo
 * nội dung, nên ảnh chụp thứ hai của cùng kỳ — thứ người dùng vừa sửa sổ xong — bị trả
 * `trung` rồi bị vứt, và đặc trưng kỳ đó đóng băng `NHO_MON_NGAY` ngày. Toàn bộ nhánh
 * UPSERT thành code chết. Xem `MonLo` ở `config/pfm_dong_bo.ts` cho hai vai của `id`.
 */
import type pg from 'pg';
import { PFM_LO } from '../../config/pfm.js';
import { kiemPhongBiMon, type MonLo, type KetMon } from '../../config/pfm_dong_bo.js';
import { laActionTypePfmHopLe, type PfmActionType } from '../../config/pfm_events.js';
import { napGoiDacTrung, DacTrungKhongHopLe, type DongDacTrungVao } from './dac_trung.js';
import { ghiEventPfm } from './su_kien.js';
import { thangSongCuaUser } from './ket.js';

export interface KetQuaLo {
  ket: KetMon[];
  /** Đếm nhanh cho phản hồi và cho log — client không phải tự cộng. */
  ghi: number;
  trung: number;
  bo: number;
}

/**
 * Dọn cơ hội bộ nhớ chống trùng CỦA RIÊNG USER NÀY.
 *
 * ⚠ Cố ý không dọn toàn bảng và cố ý không dựng cron: câu này luôn có `user_id = $1`
 * nên chi phí bị chặn theo số user ĐANG hoạt động, không theo tuổi hệ thống — và một
 * user ngừng dùng thì hàng của họ nằm yên, vô hại, cho tới khi họ quay lại hoặc xoá
 * tài khoản (ON DELETE CASCADE).
 */
async function donBoNho(client: pg.PoolClient, userId: string): Promise<void> {
  await client.query(
    `DELETE FROM pfm_lo_da_nhan
      WHERE user_id = $1 AND nhan_luc < now() - ($2 || ' days')::interval`,
    [userId, String(PFM_LO.NHO_MON_NGAY)]);
}

/**
 * Giành chỗ cho MỌI `mon_id` của lô trong ĐÚNG MỘT câu. Trả tập id **mới giành được**;
 * id không có trong tập ⇒ đã nhận từ trước ⇒ đây là một lần GỬI LẠI.
 *
 * ⚠ INSERT…ON CONFLICT DO NOTHING RETURNING, không phải SELECT-rồi-INSERT: hai cú gửi
 * song song của cùng một máy (bấm hai lần, hai tab) thì bản đọc-rồi-ghi để cả hai cùng
 * thấy "chưa có" và cùng ghi. Giành chỗ bằng MỘT câu ghi có điều kiện là khuôn T5.4 mà
 * `niemPhongTuan` đã dùng cho đúng ca này.
 *
 * ⚠ Gộp cả lô vào một câu (D256) thay vì một câu mỗi món: trước đây đây là vòng SQL
 * đông thứ hai của cả đường, chỉ sau chính cú ghi.
 */
async function gianhChoLo(
  client: pg.PoolClient, userId: string, monIds: readonly string[],
): Promise<Set<string>> {
  if (monIds.length === 0) return new Set();
  const { rows } = await client.query(
    `INSERT INTO pfm_lo_da_nhan (user_id, mon_id)
     SELECT $1, x FROM unnest($2::text[]) AS x
     ON CONFLICT (user_id, mon_id) DO NOTHING
     RETURNING mon_id`,
    [userId, [...new Set(monIds)]]);
  return new Set(rows.map((r) => r.mon_id as string));
}

/**
 * Nạp một lô. PHẢI GỌI TRONG TRANSACTION CỦA NGƯỜI GỌI (khuôn chung mọi hàm PFM).
 *
 * `mon` vào đây là `unknown[]` thật sự — nó tới thẳng từ HTTP. Phong bì kiểm ở đây,
 * nội dung kiểm bởi chính hai cửa đã có (`napGoiDacTrung` theo sổ đăng ký,
 * `ghiEventPfm` theo K5), không viết lại cửa nào.
 */
export async function napLo(
  client: pg.PoolClient, userId: string, mon: readonly unknown[],
): Promise<KetQuaLo> {
  await donBoNho(client, userId);

  /*
   * ⭐ HAI LƯỢT (D256). Lượt một soi phong bì — THUẦN, không chạm DB — nên sau nó ta
   * biết trọn danh sách nhịp và giành chỗ được cho tất cả trong MỘT câu. Bản một-lượt
   * cũ phải hỏi DB từng món vì lúc ấy chưa biết món kế tiếp là gì.
   */
  const ket: (KetMon | null)[] = Array.from({ length: mon.length }, () => null);
  const hopLe: { i: number; m: MonLo }[] = [];
  for (const [i, thoMon] of mon.entries()) {
    const loiPhongBi = kiemPhongBiMon(thoMon);
    if (loiPhongBi !== null) {
      /*
       * ⚠ Phong bì hỏng thì có thể CHƯA CÓ `id` để trả về. Dùng vị trí làm nhãn thay
       * — client ghép lại được theo thứ tự nó gửi, và nếu không ghép được thì nó vẫn
       * biết lô có món hỏng thay vì tưởng mình gửi sạch.
       */
      const o = thoMon as { id?: unknown };
      ket[i] = { id: typeof o?.id === 'string' ? o.id : `#${i}`, ket: 'bo', ly_do: loiPhongBi };
      continue;
    }
    hopLe.push({ i, m: thoMon as MonLo });
  }

  const moiGianh = await gianhChoLo(
    client, userId, hopLe.filter((x) => x.m.loai === 'nhip').map((x) => x.m.id));
  /*
   * ⚠ MỘT LÔ CÓ THỂ CHỞ CÙNG MỘT `id` HAI LẦN. Câu giành chỗ gộp trả id ấy đúng MỘT
   * lần, nên nếu chỉ hỏi `moiGianh.has(id)` thì CẢ HAI lần đều thấy "mới" và cùng ghi —
   * tức đúng cái nhân đôi mà bảng chống trùng dựng ra để chặn, lọt qua bằng cửa sau.
   * Bản một-lượt cũ không có lỗ này vì nó ghi ngay trong lúc giành.
   */
  const daGhi = new Set<string>();

  /** Tháng đang sống — hỏi ĐÚNG MỘT lần cho cả lô, và chỉ khi lô có gói. */
  let thangSong: string | null = null;

  for (const { i, m } of hopLe) {
    if (m.loai === 'nhip') {
      if (!moiGianh.has(m.id) || daGhi.has(m.id)) {
        ket[i] = { id: m.id, ket: 'trung' };
        continue;
      }
      /*
       * ⚠⚠ KHÔNG `SAVEPOINT` cho nhịp, và đây là quyết định CÓ ĐO chứ không phải cắt
       * bừa. `SAVEPOINT` tồn tại để cô lập một câu SQL CÓ THỂ HỎNG — mà một nhịp đã qua
       * `kiemPhongBiMon` thì không còn đường hỏng nào ở tầng SQL: `action_type` đã khớp
       * CHECK của DB (có bài canh đối chiếu hai danh sách), `value_json` bị K5 chặn mọi
       * field và mọi kích cỡ, `user_id` là người đang đăng nhập, và `events` không có
       * ràng buộc duy nhất nào. Giữ savepoint ở đây là trả hai vòng SQL mỗi món cho một
       * lỗi không tồn tại.
       * ⚠ `goi` thì NGƯỢC LẠI, và savepoint của nó ở dưới phải giữ: `napGoiDacTrung`
       * chạy nhiều câu, và `pfm_dac_trung` có CHECK `pg_column_size(gia_tri) <= 256`
       * nổ ở tầng SQL — đúng loại lỗi giết cả transaction.
       */
      if (!laActionTypePfmHopLe(m.ma)) throw new Error(`action_type lọt cửa: ${m.ma}`);
      const ma: PfmActionType = m.ma;
      await ghiEventPfm(client, userId, ma, m.v);
      daGhi.add(m.id);
      ket[i] = { id: m.id, ket: 'ghi' };
      continue;
    }

    await client.query('SAVEPOINT mon');
    try {
      thangSong ??= await thangSongCuaUser(client, userId);
      // KHÔNG giành chỗ: gói là ảnh chụp, gửi lại phải GHI ĐÈ. Xem đầu tệp.
      await napGoiDacTrung(client, userId, m.ky, m.dong as DongDacTrungVao[], thangSong);
      await client.query('RELEASE SAVEPOINT mon');
      ket[i] = { id: m.id, ket: 'ghi' };
    } catch (err) {
      await client.query('ROLLBACK TO SAVEPOINT mon');
      await client.query('RELEASE SAVEPOINT mon');
      /*
       * ⚠ CHỈ lỗi NGHIỆP VỤ mới thành `bo`. Lỗi lạ (mất kết nối, sai lập trình) phải ném
       * lên để cả lô 500 và client GIỮ hàng đợi — biến một sự cố hạ tầng thành "món này
       * hỏng vĩnh viễn, bỏ đi" là cách mất dữ liệu vì một lần DB nấc.
       */
      if (err instanceof DacTrungKhongHopLe) {
        ket[i] = { id: m.id, ket: 'bo', ly_do: err.message };
        continue;
      }
      throw err;
    }
  }

  const xong = ket.filter((k): k is KetMon => k !== null);
  if (xong.length !== mon.length) throw new Error('napLo: sót món không có kết quả');

  return {
    ket: xong,
    ghi: xong.filter((k) => k.ket === 'ghi').length,
    trung: xong.filter((k) => k.ket === 'trung').length,
    bo: xong.filter((k) => k.ket === 'bo').length,
  };
}
