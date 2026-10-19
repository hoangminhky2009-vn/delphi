/**
 * ORACLE CHO BÀI "DỜI CHỖ KHÔNG DỜI NGHĨA" (D106) — đây là NGUYÊN VĂN
 * `hoSoTinhCachCuaUser` ở commit c8e9706 (HEAD trước khi dựng tầng
 * `hanh_vi_vong`), chỉ đổi tên và đường import. Nó parse `events` mỗi lần gọi,
 * đúng như bản cũ. Bài test chơi thật rồi đòi bản mới (đọc từ kho) ra KẾT QUẢ
 * GIỐNG TỪNG CHỮ SỐ với hàm này.
 *
 * ⚠ KHÔNG sửa file này cho "khớp bản mới" — nó là mốc. Nếu một ngày công thức
 * trải CỐ Ý đổi (tăng `HANH_VI_FORMULA_VERSION`), thì bài so sánh phải đổi cách
 * đọc (so từng cột đã khai là giữ nguyên), không phải sửa oracle.
 */
import type pg from 'pg';
import { HOLDEM_DECISIONS, QUAN_TINH, luatCua } from '../../config/holdem.js';
import { sinhMap } from '../../server/holdem/map.js';
import { tuyChonSinhMap } from '../../server/holdem/engine.js';
import { dungHoSo, type HoSoTinhCach, type VongInsight } from '../../server/holdem/insight.js';

export async function hoSoTinhCachCu(
  db: pg.Pool | pg.PoolClient, userId: string,
): Promise<HoSoTinhCach> {
  /*
   * 60 trận GẦN NHẤT nhưng trả theo chiều THỜI GIAN TĂNG — chỉ số "xu hướng"
   * (nửa sau − nửa đầu) chỉ có nghĩa khi mảng vòng đi đúng chiều đời người chơi.
   */
  const tran = await db.query(
    `SELECT match_id, seed, so_o, balance_version FROM (
       SELECT match_id, seed, so_o, balance_version, started_at
         FROM holdem_matches WHERE owner_user_id = $1
        ORDER BY started_at DESC LIMIT 60
     ) t ORDER BY started_at ASC`,
    [userId]);
  const nav = tran.rows.filter(
    (r) => luatCua(r.balance_version as string | null).nav);
  if (nav.length === 0) {
    return dungHoSo([], 0);
  }

  const ids = nav.map((r) => String(r.match_id));
  const ev = await db.query(
    `SELECT context_id, action_type, value_num::float AS num, value_json
       FROM events
      WHERE user_id = $1 AND context_type = 'holdem'
        AND action_type IN ('hd_cam_ket', 'hd_chot_phien', 'hd_brier_vong',
                            'hd_mo_bang', 'hd_khop_lenh')
        AND context_id = ANY($2::text[])
      ORDER BY ts ASC`,
    [userId, ids]);

  const vongs: VongInsight[] = [];
  for (const r of nav) {
    const matchId = String(r.match_id);
    const luat = luatCua(r.balance_version as string | null);
    const soO = (r.so_o as number | null) ?? HOLDEM_DECISIONS.MAP_SIZE;
    /*
     * ⚠ MỘT CỬA `tuyChonSinhMap` (D172) — chỗ này từng là BẢN SAO THỨ BA của
     * danh sách cờ (sau `taoTran` và `hanh_vi/kho.ts`), và nó cũng đã TRÔI:
     * dừng ở v32, thiếu cả bốn cờ v35/v36. Vì đây là ORACLE của bài "kho ≡ hàm
     * cũ", bản trôi làm bài đỏ với hai object trông giống hệt nhau — kiểu đỏ
     * tốn thời gian nhất. Oracle cũng phải đi qua cùng cửa.
     */
    const map = sinhMap(Number(r.seed), soO, tuyChonSinhMap(luat));
    /*
     * Gom event của TRẬN này theo vòng. `value_json.vong` là chìa — mọi loại
     * event trên đều ghi nó (kiểm bằng test API bên dưới, không tin trí nhớ).
     */
    const theoVong = new Map<number, {
      lenh: { chieu: VongInsight['lenh'][number]['chieu']; moc_bp: number }[];
      pnl: number | null; brier: number | null; moBang: boolean; tuDong: boolean;
      coCamKet: boolean;
    }>();
    const cua = (v: number) => {
      let o = theoVong.get(v);
      if (!o) {
        o = { lenh: [], pnl: null, brier: null, moBang: false, tuDong: false, coCamKet: false };
        theoVong.set(v, o);
      }
      return o;
    };
    for (const e of ev.rows) {
      if (String(e.context_id) !== matchId) continue;
      const vj = (e.value_json ?? {}) as Record<string, unknown>;
      const v = Number(vj.vong);
      if (!Number.isInteger(v) || v < 1 || v > map.o.length) continue;
      const o = cua(v);
      if (e.action_type === 'hd_chot_phien') o.pnl = Number(e.num ?? 0);
      else if (e.action_type === 'hd_brier_vong') o.brier = Number(e.num ?? 0);
      else if (e.action_type === 'hd_mo_bang') o.moBang = true;
      else if (e.action_type === 'hd_khop_lenh' || e.action_type === 'hd_cam_ket') {
        // Khớp giữa vòng đến TRƯỚC cú nộp theo ts — ORDER BY ts giữ đúng thứ tự áp.
        const ds = Array.isArray(vj.lenh) ? vj.lenh as Record<string, unknown>[] : [];
        for (const l of ds) {
          const chieu = l.chieu;
          const moc = Number(l.moc_bp);
          if ((chieu === 'mua' || chieu === 'ban' || chieu === 'khong'
            || chieu === 'dong_khong') && Number.isFinite(moc)) {
            o.lenh.push({ chieu, moc_bp: moc });
          }
        }
        if (e.action_type === 'hd_cam_ket') {
          o.coCamKet = true;
          if (vj.tu_dong === true) o.tuDong = true;
        }
      }
    }
    for (const [v, o] of [...theoVong.entries()].sort((a, b) => a[0] - b[0])) {
      // Vòng chưa NỘP (chỉ có đuôi khớp/mở bảng) chưa phải một quyết định trọn.
      if (!o.coCamKet) continue;
      const oMap = map.o[v - 1]!;
      const tt = map.trang_thai?.[v - 1];
      vongs.push({
        // ⚠ Chìa của phép chặn cặp-bắc-qua-ranh-giới-trận (D101) — xem VongInsight.
        match_id: matchId,
        lenh: o.lenh,
        pnl_bp: o.pnl,
        brier: o.brier,
        mo_bang: o.moBang,
        o_su_kien: oMap.kind === 'su_kien',
        la_tin_gia: oMap.kind === 'su_kien' && oMap.la_tin_gia,
        /*
         * ⚠⚠ NGƯỠNG CHUỖI THEO MÁY CỦA TRẬN — sửa 31/08 (D190), và đây là BẢN SAO
         * THỨ HAI ĐÃ TRÔI, đúng lớp lỗi mà chú thích ở đầu vòng lặp này vừa kể.
         *
         * Dòng cũ chốt cứng `>= 2`. D169 đổi định nghĩa: máy regime tick coi nền
         * sống NGAY Ô ĐẦU (ngưỡng 1), máy rút cũ mới đòi 2 ô — và `hanh_vi/kho.ts`
         * đã theo luật mới, oracle này thì không. Từ khi v36 thành mặc định, hai bên
         * áp HAI LUẬT KHÁC NHAU lên cùng một trận.
         *
         * Hậu quả đo được: bài §I đỏ ~50% số lượt — chỉ đỏ khi bản đồ ngẫu nhiên
         * sinh vừa đủ số ô `run_dai === 1` để đẩy mẫu `duoi_gia` qua sàn 4 ở một bên
         * mà không qua ở bên kia. Đỏ nửa số lượt còn tệ hơn không có bài nào: người
         * ta học cách phớt lờ, rồi ngày nó đỏ vì lý do THẬT sẽ không ai nhìn (D79).
         */
        chuoi_tang: tt !== undefined && tt.run_huong === 1
          && tt.run_dai >= (luat.regimeTick ? 1 : QUAN_TINH.NGUONG_CHUOI),
        tu_dong: o.tuDong,
      });
    }
  }
  return dungHoSo(vongs, nav.length);
}
