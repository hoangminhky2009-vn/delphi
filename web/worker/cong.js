/**
 * LUẬT CỔNG — hàng chờ vào app kiểu 2b2t (có SỐ THỨ TỰ, tự nhích).
 *
 * ─── VÌ SAO CÓ FILE NÀY ────────────────────────────────────────────────────
 * Đo 31/08: thứ gãy đầu tiên khi đông người KHÔNG phải quota tháng của Vercel
 * (cái đó mất vài ngày), mà là **kết nối DB — trong vài giây**. `api/index.ts`
 * mở pool `max: 1` mỗi function instance; Vercel bung nhiều instance thì mỗi
 * cái ôm một kết nối, trong khi transaction pooler của Supabase free trần
 * ~15. Người thứ 16 trở đi đợi `connectionTimeoutMillis: 10_000` rồi ăn lỗi.
 *
 * ⚠ VÀ BỘ CHẶN TẦN SUẤT HIỆN CÓ KHÔNG CỨU ĐƯỢC. `consumeLimit` chạy TRÊN DB
 * (BEGIN → pg_advisory_xact_lock → COUNT → INSERT → COMMIT), nên **từ chối
 * một request tốn gần bằng phục vụ nó**, và tốn đúng thứ đang cạn. Nó lại là
 * trần THEO NGƯỜI (`holdem:tao:<userId>`) — 3.000 người mỗi người trong hạn
 * mức riêng thì không ai bị chặn, mà tổng tải vẫn gấp 3.000 lần. Không có chỗ
 * nào trong hệ biết "tổng thể đang quá tải".
 *
 * ⇒ Cổng phải đứng TRƯỚC DB và không được đụng DB. Cloudflare Worker là chỗ
 * duy nhất thoả cả hai, và nó miễn phí (C1).
 *
 * ─── VÌ SAO HÀM THUẦN, TÁCH KHỎI WORKER ────────────────────────────────────
 * Cùng nếp `web/src/api/polling.ts`: luật ở hàm thuần thì test bằng vitest
 * thường, không cần dựng runtime Cloudflare, không cần mạng (A8.9 — mọi thứ
 * test được ở local). `cua.js` chỉ là cái kho; file này là cái luật.
 *
 * ─── MÔ HÌNH ───────────────────────────────────────────────────────────────
 *   TRONG   — đang được phục vụ. Giữ ghế bằng cách gia hạn đều đặn.
 *   CHỜ     — hàng FIFO. Có số thứ tự thật, nhích khi người trong nhả ghế.
 * Không gia hạn quá `HAN_GHE_MS` ⇒ tự nhả ghế (đóng tab, mất mạng, ngủ máy).
 * Đứng chờ mà im quá `HAN_CHO_MS` ⇒ tự rời hàng (không giữ chỗ ma).
 */

/**
 * ⚠ ĐÃ ĐO 05/09/2026 — trước đó mang nhãn PLAYTEST-TUNE suốt từ D207.
 *
 * `scripts/do_tai_dong_thoi.ts` bắn thang đồng thời qua ĐÚNG đường người dùng đi
 * (Cloudflare → Vercel → Supabase) vào `/api/v1/health`:
 *
 *   500 request đồng thời ⇒ 500/500 trả 200, p99 2,17s
 *   800 request đồng thời ⇒ 111/800 trả 500, lỗi thật đọc từ log Vercel:
 *     `(EMAXCONN) max client connections reached, limit: 200`
 *
 * ⇒ Trần THẬT là **200 client đồng thời của Supavisor** (mỗi instance Vercel giữ
 * một client vì pool `max: 1`), KHÔNG phải `default_pool_size` = 15 như giả
 * thuyết H2 ở §3① `docs/gioi-han-ha-tang.md` đoán: xếp hàng ở mức 15 chạy êm,
 * đo được `waiting` lên tới 17 mà không một lỗi nào. ⚠ Và nó gãy KHÔNG ÊM: ném
 * 500, không xuống cấp dần — trái với điều C2 đòi.
 *
 * ⚠ ĐỔI TỪ REQUEST SANG NGƯỜI trước khi dùng con số này. Một người chơi bắn ~1
 * request mỗi 5–10 giây và mỗi request giữ kết nối ~0,3s (p50 đo được), nên N
 * người ≈ N/20 kết nối đồng thời. Trần 200 kết nối ứng với HÀNG NGHÌN người ⇒
 * kết nối KHÔNG phải thứ chặn quy mô mùa này.
 *
 * ⇒ `TRAN_TRONG = 300` (từ 150 của D64). Nâng VẮA PHẢI chứ không kịch trần, vì
 * phép đo trên `/health` là TRẦN TRÊN: route có transaction giữ kết nối lâu hơn
 * nên chỉ có thể thấp hơn, mà nó thì CHƯA đo được — bắn tải vào `POST /rounds`
 * là bơm rác VĨNH VIỄN vào `events` append-only (cửa một chiều, A11.1/A3.3).
 * Muốn nâng tiếp: đo đường có transaction trên một DB KHÁC prod trước.
 *
 * ⚠ Thứ chặn quy mô thật vẫn là QUOTA THÁNG (1 triệu request Vercel ⇒ ~220 người
 * chơi đều mỗi ngày, §4). Cổng chặn ĐỒNG THỜI, không cứu quota tháng.
 */
export const CONG = {
  /** Bao nhiêu người được ở TRONG cùng lúc. */
  TRAN_TRONG: 300,
  /** Vé thông hành sống bao lâu (giây) — hết thì client phải gia hạn. */
  HAN_PASS_S: 60,
  /**
   * Không gia hạn quá lâu ⇒ nhả ghế. Phải LỚN HƠN `HAN_PASS_S` một khoảng ân
   * hạn: người chơi đang đọc bảng giá 60 giây không phải người đã bỏ đi, và
   * đá họ ra đúng lúc họ quay lại bấm là tệ hơn giữ thừa một ghế.
   */
  HAN_GHE_MS: 90_000,
  /** Đứng chờ mà im quá lâu ⇒ rời hàng (đóng tab thì đừng giữ chỗ). */
  HAN_CHO_MS: 120_000,
  /** Đang chờ thì bảo client hỏi lại sau bao lâu (giây). */
  NHIP_HOI_S: 5,
};

/**
 * Dọn ghế hết hạn + người chờ đã bỏ đi. Gọi TRƯỚC mọi phép đếm — đếm trên sổ
 * chưa dọn là đếm cả người đã rời phòng, và cổng sẽ khoá trong khi bên trong
 * trống.
 */
export function donDep(st, now, ch = CONG) {
  for (const [ve, hetHan] of st.trong) {
    if (hetHan <= now) st.trong.delete(ve);
  }
  st.cho = st.cho.filter((m) => m.hoiLuc + ch.HAN_CHO_MS > now);
}

/**
 * Kéo người đầu hàng vào cho tới khi hết ghế hoặc hết hàng.
 * Tách riêng vì nó phải chạy TRƯỚC khi xét người mới tới (xem `quyetDinh`).
 */
function nhichHang(st, now, ch) {
  while (st.trong.size < ch.TRAN_TRONG && st.cho.length > 0) {
    const m = st.cho.shift();
    st.trong.set(m.ve, now + ch.HAN_GHE_MS);
  }
}

/**
 * MỘT LƯỢT HỎI CỔNG. Trả về `{ vao }` hoặc `{ vao: false, vi_tri, tong }`.
 *
 * ⚠ THỨ TỰ BỐN BƯỚC LÀ MỘT PHẦN CỦA LUẬT, không phải chi tiết cài đặt:
 *   1. dọn   — nếu không, ghế của người đã đi vẫn tính là đang bận
 *   2. gia hạn người ĐANG TRONG — họ giữ ghế, không bao giờ phải xếp lại hàng
 *   3. nhích hàng — người chờ lâu nhất được ưu tiên hơn người vừa tới
 *   4. mới xét người mới
 * Đảo 3 với 4 là cho phép CHEN HÀNG: người mới tới lấp ghế vừa trống trong
 * khi người đã chờ 5 phút vẫn đứng đó. Đó đúng là thứ làm hàng chờ mất niềm
 * tin, và nó không lộ ra trong bất kỳ phép đo tải nào.
 *
 * @param st  {{ trong: Map<string, number>, cho: Array<{ve: string, hoiLuc: number}> }}
 * @param ve  mã vé của người hỏi (ngẫu nhiên, KHÔNG phải danh tính người dùng)
 * @param now mốc thời gian ms
 */
export function quyetDinh(st, ve, now, ch = CONG) {
  donDep(st, now, ch);

  // (2) Đang ở trong ⇒ gia hạn. Người đang chơi không bao giờ bị đá ra hàng.
  if (st.trong.has(ve)) {
    st.trong.set(ve, now + ch.HAN_GHE_MS);
    return { vao: true, han_s: ch.HAN_PASS_S };
  }

  // (3) Nhả ghế cho người chờ lâu nhất trước.
  nhichHang(st, now, ch);
  if (st.trong.has(ve)) {
    return { vao: true, han_s: ch.HAN_PASS_S };
  }

  // (4) Người mới: chỉ được vào thẳng khi KHÔNG có ai đang xếp hàng.
  if (st.trong.size < ch.TRAN_TRONG && st.cho.length === 0) {
    st.trong.set(ve, now + ch.HAN_GHE_MS);
    return { vao: true, han_s: ch.HAN_PASS_S };
  }

  // Vào hàng — hoặc cập nhật nhịp hỏi của người đã ở trong hàng (giữ NGUYÊN
  // vị trí; hỏi lại không phải lý do để tụt hạng).
  const i = st.cho.findIndex((m) => m.ve === ve);
  if (i >= 0) {
    st.cho[i].hoiLuc = now;
    return { vao: false, vi_tri: i + 1, tong: st.cho.length, hoi_lai_s: ch.NHIP_HOI_S };
  }
  st.cho.push({ ve, hoiLuc: now });
  return {
    vao: false, vi_tri: st.cho.length, tong: st.cho.length, hoi_lai_s: ch.NHIP_HOI_S,
  };
}

/** Sổ trống — dùng ở Durable Object lẫn test. */
export function soTrong() {
  return { trong: new Map(), cho: [] };
}
