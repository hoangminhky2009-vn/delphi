/**
 * D527 — LỜI ORACLE TRÊN MÀN MINIGAME CỦA BÀN TẬP (khoá v58, màn sau vòng 2 · 4 · 5 — `NHIP_XEN_KE[6]`).
 *
 * Khung thoại của `CoachTap` đứng dưới lớp phủ màn minigame, nên lời dạy TRONG màn đi bằng một dải Oracle gọn ngay trong màn
 * (`ManMinigame` prop `tap`). Lời chép từ demo nhịp trận founder chốt 05/10 (`docs/ui-ux/demo/nhip-tran.html`: `M-2` · `M-4` ·
 * `M-5`), rẽ theo LÕI người chơi vừa chọn — demo giả định Bắt Đáy, bàn tập thật cho chọn Bắt Đáy hoặc Đòn Bẩy (quầy ghim).
 * Câu màn đầu viết rõ hơn bản đầu của demo ("màn cộng không" dễ đọc thành "khoản đứng im" — giữ suốt thì khoản VẪN chạy theo giá); demo
 * sửa theo cùng câu.
 * A10: tả cơ chế, không kê đơn — bài `coach_minigame.test.ts` quét từ cấm.
 */

/** Màn đầu tiên của bàn tập — dạy luật chung của màn, mọi lõi. */
export const LOI_MAN_DAU =
  'MÀN LÕI: mã bạn nắm nhiều nhất chạy 34 giây. Không bấm = giữ suốt, khoản đi đúng theo giá; bấm VÀO / THOÁT thì kết quả hơn '
  + 'hoặc kém cách giữ suốt.';

/** Lời theo lõi ở hai màn sau (vòng 4 · 5). Lõi không có trong bảng ⇒ không nói gì thêm. */
const THEO_LOI: Readonly<Record<string, readonly [string, string]>> = {
  bat_day: [
    'BẮT ĐÁY: dải dưới là ĐƯỜNG GIÁ TRỊ — giá dưới dải là đang rẻ hơn giá trị; dải dốc xuống là cả giá trị đang sụt.',
    'Nhãn QUÁ BÁN dưới nến đã đóng hay đúng ở cuối sóng giảm — đôi khi báo nhầm.',
  ],
  don_bay: [
    'ĐÒN BẨY: VÀO ×N nhân lãi lỗ lên N lần. Giá chạm ngưỡng GỌI thì NẠP thêm, hoặc bị thanh lý.',
    'Màn cuối. CHỐT đóng lệnh đòn bẩy ở giá đang chạy; không chốt thì màn tự đóng ở giá cuối.',
  ],
};

/**
 * Lời Oracle cho màn của vòng `vong` ở bàn tập, theo lõi `la` của màn (null khi chưa chọn lá). `null` = màn này không có lời.
 * Màn đầu (vòng 2) luôn nói luật chung; vòng 4 · 5 nói theo lõi.
 */
export function loiOracleMan(vong: number, la: string | null | undefined): string | null {
  if (vong <= 2) return LOI_MAN_DAU;
  const theoLoi = la ? THEO_LOI[la] : undefined;
  if (!theoLoi) return null;
  return vong === 4 ? theoLoi[0] : theoLoi[1];
}
