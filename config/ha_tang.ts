/**
 * NGƯỠNG HẠ TẦNG — các con số nói về CHỖ CHỨA và SỨC CHỊU của hệ thống, không
 * nói về luật chơi, không nói về kinh tế token, không nói về một bảng cụ thể.
 *
 * ─── VÌ SAO CÓ FILE NÀY (D216, rà lại 03/09/2026) ────────────────────────────
 * Bản đầu của đợt D216 đặt `TRAN_KHO_LANH_MB` vào `config/telemetry.ts`, kèm
 * một khối chú thích dài giải thích vì sao một hằng số về bảng `events` lại
 * nằm trong file phục vụ bảng `telemetry`. Chính độ dài của lời giải thích đó
 * là dấu hiệu: **A9 dựng ranh giới `events` ↔ `telemetry` và nói thẳng "HAI
 * BẢNG, HAI VAI, KHÔNG TRỘN"** — đặt hằng số của bảng này vào file của bảng
 * kia là trộn đúng thứ A9 cấm, ở tầng cấu hình. Code phải xin lỗi dài về chỗ
 * nó đứng là code đứng sai chỗ.
 *
 * Ba file từng được cân nhắc và vì sao đều sai miền:
 *   · `config/telemetry.ts` — phục vụ bảng `telemetry` (xoá được, hạn 90 ngày).
 *     Ngưỡng ở đây nói về `events` (append-only vĩnh viễn). Ngược ranh A9.
 *   · `config/giai_doan.ts` — tự khai là TRỤC KHÁC: "một DÒNG DỮ LIỆU thuộc
 *     giai đoạn nào", suy từ `balance_version`. Không phải trục hạ tầng.
 *   · `config/economy.ts` — tham số KINH TẾ token (A4/A5), founder chốt, agent
 *     không tự đặt (A8.2). Một ngưỡng dung lượng đĩa không thuộc về đó.
 *
 * ⚠ FILE NÀY LÀ NHÀ CHUNG cho ngưỡng hạ tầng sắp tới, không phải file một-hằng-
 * số: đồng hồ của việc A2 (dung lượng DB · tuổi bản sao lưu · số người chơi mỗi
 * ngày · p95 `/rounds`) sẽ về đây, thay vì mỗi cái tản một nơi rồi không ai
 * tìm ra chúng cùng lúc.
 *
 * ⚠ KHÔNG chép trần của nhà cung cấp vào đây. Trần Supabase/Vercel/Cloudflare
 * có nhà riêng ở `docs/gioi-han-ha-tang.md` §2; file này chỉ giữ NGƯỠNG TA TỰ
 * ĐẶT trên các trần đó (D61 — một sự thật, một chỗ).
 */

/**
 * Dung lượng database mà tới đó thì BẮT ĐẦU cold-archive `events` theo THÁNG
 * (bậc `kho_lanh` ở `config/bac_thang.ts`).
 *
 * Đây là diễn giải A3.3 cho ca hết chỗ vật lý, founder chốt 03/09/2026 — luật
 * đầy đủ ở `docs/luat/04-du-lieu.md` §B1, gồm cả hai thứ VẪN BỊ CẤM kể cả khi
 * chạm ngưỡng này (xoá dòng · rút gọn `state_snapshot_json`).
 *
 * ⚠ Đây là điểm BẮT ĐẦU DỌN, không phải điểm vỡ: nó chừa ~200 MB trước trần
 * gói free (`docs/gioi-han-ha-tang.md` §2) để làm việc archive thong thả chứ
 * không phải giữa lúc cháy nhà. Đo bằng `pg_database_size(current_database())`
 * — câu SQL đã có sẵn ở `server/admin_thongke.ts` cho bảng `/admin`.
 * Mốc so sánh: prod ~38 MB ngày 03/09/2026.
 */
export const TRAN_KHO_LANH_MB = 300;

/* ══════════════════════════════════════════════════════════════════════════
 * MẪU SỐ KINH TẾ — "cân bằng T cho đúng số user app chịu được"
 * (founder 05/09/2026, D263)
 * ══════════════════════════════════════════════════════════════════════════ */

/**
 * ⚠ ĐỌC LUẬT Ở ĐẦU TỆP TRƯỚC: *"KHÔNG chép trần của nhà cung cấp vào đây."*
 * Khối này KHÔNG vi phạm luật đó, và ranh giới đáng ghi rõ: trần Vercel/Supabase
 * vẫn ở `docs/gioi-han-ha-tang.md` §2 và không được chép. Thứ nằm đây là
 * **MẪU SỐ TA CHỌN để cân bằng kinh tế** — một quyết định của ta, neo vào ước
 * tính §4 của tài liệu đó. Đúng vai mà đầu tệp đã hẹn: *"số người chơi mỗi ngày
 * sẽ về đây"*.
 *
 * ─── VÌ SAO CẦN NÓ ────────────────────────────────────────────────────────
 * Mọi bảng số kinh tế tới trước 05/09 đều chạy trên **1.000 người** — con số
 * không phải mốc C2 (5.000), không phải trần thật, và không ai biết từ đâu ra.
 * A11.1 nói thẳng: *mẫu số là MÙA NÀY, không phải C2*. Founder chốt mẫu số đó
 * là **sức chịu của hạ tầng**, tức một con số ĐO ĐƯỢC thay vì một con số ao ước.
 *
 * ─── ⚠⚠ ĐÂY LÀ MỘT DẢI, KHÔNG PHẢI MỘT ĐIỂM ──────────────────────────────
 * `gioi-han-ha-tang.md` §4 tự cảnh báo về chính con số của nó:
 *   *"Sai số rộng… Coi nó là BẬC ĐỘ LỚN — 'vài trăm', không phải '220'."*
 * Nên mọi kết luận kinh tế phải kiểm trên CẢ DẢI. Kết luận nào đổi dấu giữa
 * 150 và 250 thì nó không phải kết luận, nó là một sự trùng hợp.
 *
 * `tests/mau_so_ha_tang.test.ts` đọc thẳng tài liệu và so — sửa doc mà quên
 * sửa đây thì đỏ (D61).
 */
export const TRAN_HA_TANG = {
  /** Biên dưới của dải "~200-250" ở §1 — kịch bản thận trọng. */
  THAP: 200,
  /**
   * Con số §4 tự tính ra: `33.000 request/ngày ÷ ~150 request/người ≈ 220`.
   * **Không phải một phép đo chính xác.**
   */
  GIUA: 220,
  /** Biên trên của dải "~200–250" ở §1. */
  CAO: 250,
  /**
   * Trần ĐỒNG THỜI — ngưỡng TA TỰ ĐẶT ở cổng hàng chờ (`web/worker/cong.js`),
   * không phải trần platform. Khác hẳn ba số trên: đó là trần LƯỢNG THÁNG, đây
   * là số người trong phòng cùng lúc.
   *
   * ⚠ 150 → 300 ngày 05/09 sau phép đo trần kết nối (D271, cửa sổ khác). Con số
   * cũ nằm ở đây một đêm và bài canh trôi bắt được — đó đúng là việc của nó.
   */
  DONG_THOI: 300,
} as const;

/** Cả dải, để quét kết luận nào giữ được và kết luận nào không. */
export const DAI_MAU_SO: readonly number[] = [
  TRAN_HA_TANG.THAP, TRAN_HA_TANG.GIUA, TRAN_HA_TANG.CAO,
];

/**
 * Mốc C2 của hiến pháp — **để ĐỐI CHIẾU, không phải để cân bằng lên nó.**
 * Giữ ở đây để mọi bảng số nói rõ nó đang đứng cách mốc kia bao xa, thay vì im
 * lặng để người đọc tưởng hai con số là một.
 */
export const C2_DANG_KY = 5_000;

/* ══════════════════════════════════════════════════════════════════════════
 * CANH QUOTA VERCEL — ngưỡng TA đặt trên trần Hobby (D594, founder 11/10 "vượt 50 %")
 * ══════════════════════════════════════════════════════════════════════════ */

/**
 * Số lượt gọi Vercel trong một tháng UTC mà tới đó `GET /api/v1/canh` trả 500 mã `quota` (cron-job.org gửi mail).
 * = 50 % trần lượt gọi/tháng của Vercel Hobby — trần ở `docs/gioi-han-ha-tang.md` §2/§④, KHÔNG chép vào đây (luật
 * đầu tệp); đổi trần thì sửa số này bằng tay theo tài liệu. Vượt trần Hobby là sập tới hết chu kỳ, nên báo ở nửa
 * đường để còn thời gian bóp tải. Đếm: Worker (`web/worker/dem.js`) + `LUOT_NGOAI_WORKER_MOI_NGAY` × số ngày.
 * ⚠ Tháng UTC theo lịch, chưa chắc trùng chu kỳ tính tiền của tài khoản — chênh tối đa một tháng lệch pha; ngưỡng
 * 50 % là để chừa đúng khoảng đó.
 */
export const NGUONG_CANH_LUOT_THANG = 500_000;

/**
 * Lượt gọi Vercel mỗi ngày KHÔNG đi qua Worker nên Worker không đếm được — cộng thêm ở máy chủ. Suy từ lịch đã đặt:
 * cron-job.org `POST /internal/tick` mỗi phút (1.440) + UptimeRobot `/health` mỗi 5 phút (288) + Vercel cron backup (1)
 * = 1.729 (`docs/deploy_gd0.md` Bước 5 · 6 · 8). Đổi lịch nào thì sửa số này.
 */
export const LUOT_NGOAI_WORKER_MOI_NGAY = 1_729;
