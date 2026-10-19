/**
 * CHỮ HẠNG PIXEL — S · SS · SSS công bố toàn màn (founder 22/08).
 *
 * Founder bác bản đầu: *"cái SSS của m xấu và lệch tông quá. Phải là pixel và
 * màu sặc sỡ và chuyển động hoặc rung hoặc gì đó chứ, học hỏi mấy thiết kế SSS
 * của các game khác đi"* — bản đầu dùng `font-size` + font hệ thống, tức là
 * TEXT TÔ MÀU, lạc hẳn khỏi §XI (mọi thứ người chơi nhìn phải là pixel) và
 * lạc khỏi chính bộ icon của app.
 *
 * ─── GLYPH DÙNG CHUNG ─────────────────────────────────────────────────────
 * Chữ vẽ bởi `ChuPixel` — cùng bộ lưới với thanh chấm điểm và khối màn kết,
 * chỉ khác `px`. File này CHỈ còn phần HIỆU ỨNG của cú công bố toàn màn.
 *
 * Bật `theoHang`: mỗi hàng pixel là một phần tử riêng mang `color` của chính
 * nó, nhờ vậy dải màu chạy DỌC thân chữ (hàng trên đang hồng thì hàng dưới đã
 * sang lam) — thứ làm nó "sặc sỡ" thật, khác hẳn một khối chữ đổi màu đồng
 * loạt như đèn báo. Hai chỗ kia tắt cờ đó vì chúng không cần dải màu.
 *
 * ─── PHÂN BẬC S < SS < SSS ────────────────────────────────────────────────
 * Founder: *"S và SS cũng hiện nhé nhưng mà không dài, ngầu và nhiều hiệu ứng
 * bằng SSS thôi"*.
 *
 * Bốn quy luật rút từ đợt tra cứu (DMC · Muse Dash · Balatro · gacha HSR ·
 * Bayonetta · Hi-Fi Rush · Dead Cells) — ghi lại vì chúng quyết định từng dòng
 * CSS bên cạnh, và vì lần sau ai muốn "làm hoành tráng hơn" nên đọc trước:
 *
 * 1. BẬC CAO = THÊM MỘT TẦNG GIÁC QUAN, KHÔNG PHẢI CÙNG MỘT THỨ TO HƠN.
 *    DMC lên bậc thì NHẠC thêm lớp; Balatro thì cường độ rung tỷ lệ với độ lớn
 *    điểm. Nếu ba bậc chỉ khác nhau ở cỡ chữ, người chơi không thấy SSS "ngầu"
 *    — họ thấy nó "to". Ở đây mỗi bậc mở thêm một KÊNH: màu → rung → tia.
 * 2. CÙNG GLYPH, KHÁC CHẤT LIỆU (Muse Dash: SSS vàng · SS bạc · S thường).
 *    Neon trên nền tối không có "kim loại" (kim loại cần chuyển sắc mềm, mà
 *    pixel thì không), nên trục chất liệu dịch thành TRỤC SỐ MÀU:
 *        S   1 màu tĩnh · SS  2 màu chạy · SSS  4 màu chạy
 * 3. ĐỘ TRỄ MỚI LÀM NÊN HOÀNH TRÁNG, KHÔNG PHẢI HẠT BAY. Gacha cố tình làm
 *    CHẬM cú lộ và cho vật phẩm HẠ XUỐNG rồi thành hình. Nên chữ ở đây RƠI
 *    xuống (`chRoi`) chứ không bật ra, và bậc càng cao càng vào trễ hơn một
 *    nhịp — nền đã sáng màu bậc trước khi chữ tới, đúng kiểu "báo màu trước".
 * 4. Ở 375px, PHẦN HOÀNH TRÁNG CÒN THIẾU PHẢI BÙ BẰNG THỨ KHÔNG TỐN DIỆN TÍCH
 *    (thời lượng · rung · tầng màu), không bằng chữ to hơn — bài học ngược từ
 *    Dead Cells. Xem `PX` bên dưới.
 *
 * Bảng cuối, cộng dồn chứ không thay thế — thấy SS rồi thấy SSS phải nhận ra
 * "vẫn thứ đó, nhưng hơn":
 *        S    1 glyph · 1 màu tĩnh   · không rung · không tia · vào sớm nhất
 *        SS   2 glyph · 2 màu chạy   · rung nhẹ   · không tia
 *        SSS  3 glyph · 4 màu chạy   · rung mạnh  · TIA phóng · vào trễ nhất
 */
import type { CSSProperties } from 'react';
import { ChuPixel } from './ChuPixel';
import s from './ChuHang.module.css';

/** Hạng được công bố toàn màn. Thang đầy đủ ở `server/holdem/phong_cach.ts`. */
export type HangCongBo = 'S' | 'SS' | 'SSS';

/**
 * Cỡ ô pixel — MỘT SỐ DUY NHẤT CHO CẢ BA BẬC, và đó là một quyết định.
 *
 * ⚠ Bản đầu cho SSS ô to hơn (5/6/7px) — tức để KÍCH THƯỚC gánh việc phân bậc.
 * Hai nguồn cùng bác cách đó:
 * · Muse Dash phân ba bậc cao nhất bằng ĐÚNG MỘT glyph, khác nhau hoàn toàn ở
 *   chất liệu (SSS vàng · SS bạc · S thường) — bề ngang không đổi, nên bố cục
 *   không bao giờ vỡ và mắt đọc ra bậc bằng MÀU, không cần đọc chữ.
 * · Dead Cells là bài học ngược: cộng đồng phàn nàn UI chiếm mảng lớn màn hình
 *   — mà đó là màn PC. Ta có 375px, và chữ hạng còn phải nhường chỗ cho chính
 *   bảng số vừa chạy xong.
 * Ở 6px: S rộng 60px · SS 126px · SSS 192px = 51% bề ngang. Ba ký tự vẫn đọc
 * ra "SSS", mà chưa bậc nào chạm ngưỡng che màn.
 */
const PX = 6;

export function ChuHang({ hang }: { hang: HangCongBo }) {
  return (
    <div
      className={`${s.voc} ${s[hang]}`}
      role="img"
      aria-label={`Hạng ${hang}`}
      /* TIA của SSS vẽ bằng `::before/::after` của VỎ, mà chúng đo theo `--px`
         — biến đó do `ChuPixel` đặt trên cụm CON, nên vỏ phải tự khai lại. */
      style={{ '--px': `${PX}px` } as CSSProperties}
    >
      <ChuPixel
        chuoi={hang}
        px={PX}
        theoHang
        vien
        className={s.cum}
        lopChu={s.chu}
        lopHang={s.hang}
      />
    </div>
  );
}
