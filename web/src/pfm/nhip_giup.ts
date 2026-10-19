/**
 * PFM — CÂU TRẢ LỜI của người dùng cho thẻ "tiền đi tới ngày nào" (GIÚP 5, D365).
 *
 * ⚠ Cất ở ngăn `nhip`, cùng khuôn `docDaHienKy` (`oracle.ts`) và `docKhoaDaHoi`
 * (`khoan_lap.ts`). ⚠ P2 🔒 — CHỈ Ở LẠI MÁY: nó là ý kiến về một thẻ, không phải dữ liệu
 * hành vi tài chính, và chưa có mã nào trong sổ đăng ký cho nó.
 *
 * ⚠⚠ CHƯA NỐI VÀO THUẬT TOÁN CHỌN NÀO. Demo nói câu trả lời làm dòng này "có mặt mỗi tuần"
 * hay "thưa đi" — đó là GIAI ĐOẠN C (Thompson sampling, cần ≥ 30 người). Ở GĐ B nó chỉ được
 * GHI LẠI; đọc nó ra để đổi tần suất mà chưa có thuật toán là tự chế một luật chọn, và
 * A8.2 cấm đúng việc ấy.
 */
import { useQuery } from '@tanstack/react-query';
import { KHOA_PFM, useKhoNgu } from './dung_kho.js';
import type { KhoPfm } from './kho.js';

const ID_NHIP = 'tien_toi_ngay_phan_hoi';

interface BanPhanHoi { ich: boolean }

/** `null` = chưa trả lời (hoặc đã bấm ĐỔI để rút lại). */
export async function docPhanHoiNhip(kho: KhoPfm): Promise<boolean | null> {
  /*
   * ⚠ KHÔNG kiểm `daXoa` ở đây — `kho.doc` ĐÃ lọc bia mộ ở cả hai bản cài đặt (`kho.ts`
   *   và `kho_idb.ts`: `return b && !b.daXoa ? b : null`). Bản đầu của tệp này có thêm một
   *   phép kiểm nữa; tiêm lỗi ngược phát hiện nó là MÃ CHẾT (gỡ ra mà không bài nào đỏ).
   *   Giữ một lưới an toàn không bao giờ đỡ được gì thì tệ hơn không có: nó làm người sau
   *   thôi kiểm — đúng bài học `tienVeTieu` đã ghi về phép kẹp thừa.
   */
  const b = await kho.doc<BanPhanHoi>('nhip', ID_NHIP);
  return b === null ? null : b.d.ich;
}

/** `ich = null` ⇒ rút lại câu trả lời (đường `ĐỔI` — không ngõ cụt). */
export async function ghiPhanHoiNhip(
  kho: KhoPfm, ich: boolean | null, luc: string,
): Promise<void> {
  if (ich === null) {
    await kho.xoa('nhip', ID_NHIP, luc);
    return;
  }
  await kho.ghi<BanPhanHoi>('nhip', {
    // `thang` của bản ghi không thuộc tháng nào: lấy tháng của lượt ghi, đúng nếp `ghiHoSo`.
    id: ID_NHIP, thang: luc.slice(0, 7), suaLuc: luc, d: { ich },
  });
}

/** ⚠ Khoá truy vấn bắt đầu bằng `['pfm','nhip']` để `useGhiKho(['nhip'], …)` vô hiệu hoá được. */
export function usePhanHoiNhip(): { data: boolean | null; dangTai: boolean } {
  const { kho } = useKhoNgu();
  const r = useQuery({
    queryKey: [...KHOA_PFM.ngan('nhip'), ID_NHIP],
    enabled: kho !== null,
    staleTime: Infinity,
    gcTime: Infinity,
    queryFn: () => docPhanHoiNhip(kho!),
  });
  return { data: r.data ?? null, dangTai: r.isPending && kho !== null };
}
