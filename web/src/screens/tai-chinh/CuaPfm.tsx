/**
 * CỬA VÀO KHU TÀI CHÍNH — `/tai-chinh` KHÔNG còn vẽ màn nào, nó ĐIỀU PHỐI.
 *
 * Chỉ thị founder 07/09: *"phần xem thẻ tính cách này chỉ nên đập vào mắt lần đầu
 * hoặc khi chưa mở khoá tính cách, sau đó nên cho thành 1 nút thẻ. Ưu tiên hiển thị
 * màn hình khi bấm vào PFM là sổ hoặc hũ"*.
 *
 * Luật ba nhánh, theo đúng thứ tự:
 *   1. CHƯA MỞ KHOÁ (chưa gói nào đầy) → THẺ. Lúc này thẻ là thứ duy nhất có gì
 *      để nói: nó bày tiến độ "còn thiếu gì" — đúng thứ giữ người quay lại.
 *   2. ĐÃ MỞ KHOÁ MÀ CHƯA XEM LẦN NÀO → THẺ, đúng MỘT lần. Cú "nở" là khoảnh khắc
 *      đáng xem; bỏ lỡ nó thì tấm thẻ thành một tab người ta không bao giờ bấm.
 *   3. Còn lại → SỔ. Đây là màn dùng HÀNG NGÀY, và "tiện" nghĩa là mở ra thấy chỗ
 *      ghi tiền chứ không phải thấy một bức chân dung không đổi mỗi ngày.
 *
 * ⚠ ĐỢI `/me/tinh-cach` VỀ RỒI MỚI ĐIỀU HƯỚNG. Nhảy trước khi biết trạng thái thì
 * người CHƯA mở khoá bị ném vào SỔ và không bao giờ thấy đường tới thẻ — cùng lớp
 * lỗi với cổng `/` ở `AppShell` (đá lúc `isPending` là cướp phiên của chính mình).
 */
import { useEffect, useMemo } from 'react';
import { Navigate } from 'react-router-dom';
import { useTinhCach } from '@/api/tinh_cach';
import { useMe } from '@/api/queries';
import { daPhongVan, khoaTheoChu } from '@/pfm/da_phong_van';
import {
  ROUTE_TAI_CHINH_PHONG_VAN, ROUTE_TAI_CHINH_SO, ROUTE_TAI_CHINH_THE,
} from '@/lib/vocab';

/** Cờ "đã xem thẻ lần nào chưa" — chỉ là tiện nghi mỗi máy, hỏng thì rơi về THẺ. */
const KHOA_DA_XEM = 'pfm_da_xem_the';

function daXemThe(chu: string | null): boolean {
  if (!chu) return false;
  try {
    return localStorage.getItem(khoaTheoChu(KHOA_DA_XEM, chu)) === '1';
  } catch {
    /* chế độ riêng tư chặn lưu trữ → coi như chưa xem; tệ nhất là thấy thẻ thêm lần nữa */
    return false;
  }
}

export function CuaPfm(): React.ReactElement | null {
  const hs = useTinhCach(true);
  const me = useMe();
  /** D603 — hai cờ dưới đi THEO TÀI KHOẢN (`da_phong_van.ts`), nên phải biết là ai trước khi đọc. */
  const chu = me.data?.user?.user_id ?? null;

  /*
   * ⚠⚠ ĐỌC CỜ MỘT LẦN, THUẦN — ĐỪNG GHI TRONG LÚC RENDER.
   *
   * Bản đầu (07/09) `localStorage.setItem` ngay giữa thân render. StrictMode render
   * hai lượt: lượt đầu cắm cờ rồi trả `<Navigate>` sang THẺ, lượt sau đọc ra "đã
   * xem" nên trả SỔ — và React dùng kết quả lượt SAU. Kết quả: nhánh "lần đầu" chết
   * im lặng, không lỗi, không log; chỉ lộ ra vì mở màn ra nhìn (A11.6 — xanh một
   * mình không nói gì). Ghi thuộc về effect, render phải thuần.
   */
  // D603: đọc lại khi CHỦ đổi (`useMemo` theo `chu`) — vẫn thuần, vẫn chỉ đọc; ghi vẫn ở effect.
  const daXem = useMemo(() => daXemThe(chu), [chu]);
  /*
   * PHỎNG VẤN ĐỨNG TRƯỚC MỌI THỨ (chỉ thị founder 08/09: *"phần phỏng vấn hiện
   * ngay lần đầu tiên bấm PFM"*, và *"không cần nút bỏ"* — founder rút lại ý bỏ
   * qua ở lượt trước). Đọc một lần, thuần, cùng lý do với `daXem` ngay trên.
   *
   * ⚠ KHÔNG chờ `/me/tinh-cach`: phỏng vấn không cần thẻ (nó tự xử ca "thẻ chưa
   * nở"). Chờ ở đây là bắt người mới nhìn màn trắng suốt một nhịp mạng, đúng lúc
   * họ mới bấm vào lần đầu.
   */
  const chuaPv = useMemo(() => !daPhongVan(chu), [chu]);

  const chuaMoKhoa = !hs.data?.goi;
  const seHienThe = !chuaPv && !hs.isPending && !hs.isError && (chuaMoKhoa || !daXem);
  useEffect(() => {
    // Chỉ cắm cờ khi ĐÃ có thẻ để xem — xem chú thích ⚠ ở nhánh `chuaMoKhoa` dưới.
    if (!seHienThe || chuaMoKhoa) return;
    try {
      if (chu) localStorage.setItem(khoaTheoChu(KHOA_DA_XEM, chu), '1');
    } catch { /* không lưu được thì thôi — chỉ mất tính "đúng một lần" */ }
  }, [seHienThe, chuaMoKhoa, chu]);

  /*
   * ⚠⚠ MỌI NHÁNH THOÁT NẰM SAU MỌI HOOK. Bản đầu 08/09 đặt `return` của nhánh
   * phỏng vấn ngay dưới `useState` và TRÊN `useEffect` — tức số hook thay đổi
   * giữa các lần render, đúng thứ luật hook của React cấm. Nó không đỏ ở typecheck
   * và có thể chạy "được" một lúc trước khi vỡ; nên neo lại bằng chú thích này
   * thay vì chỉ sửa im.
   *
   * Phỏng vấn đi trước cả `isPending`: nó không cần biết thẻ nở hay chưa.
   */
  // Chưa biết là ai ⇒ chưa đọc được cờ nào cho đúng người — chờ, đừng đoán (đoán "chưa phỏng vấn" là hỏi lại người cũ).
  if (me.isPending) return null;
  if (chuaPv) return <Navigate to={ROUTE_TAI_CHINH_PHONG_VAN} replace />;

  if (hs.isPending) return null;

  /*
   * Lỗi mạng ⇒ về SỔ, KHÔNG về THẺ: sổ đọc kho trên máy nên vẫn dùng được khi
   * rớt mạng, còn thẻ thì không có gì để vẽ. Hỏng mạng mà vẫn ghi được tiền là
   * hành vi đúng của một app PFM.
   */
  if (hs.isError) return <Navigate to={ROUTE_TAI_CHINH_SO} replace />;

  /*
   * ⚠ CHƯA MỞ KHOÁ THÌ KHÔNG ĐƯỢC CẮM CỜ (luật ở effect trên). Cắm cả ở nhánh này
   * thì hậu quả im lặng đúng kiểu: người chưa mở khoá ghé một lần là cờ lên, tới
   * lúc thẻ THẬT SỰ nở thì họ bị đưa thẳng vào SỔ — mất đúng khoảnh khắc mà nhánh
   * "lần đầu" sinh ra để bảo vệ.
   */
  return <Navigate to={seHienThe ? ROUTE_TAI_CHINH_THE : ROUTE_TAI_CHINH_SO} replace />;
}
