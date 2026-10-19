/**
 * LƯỚI AN TOÀN CHO CHUNK NẠP TRỄ CỦA HUB (SPEC 5b.2 — mất mạng giữa chừng).
 *
 * `lazy(() => import(...))` mà mạng đứt (hoặc tệp chunk đã bị bản mới thay tên) thì lời hứa BỊ TỪ CHỐI và React ném lỗi lúc render.
 * Không có biên ở đây, lỗi đi lên tới `errorElement` của AppShell và CẢ HUB biến thành màn lỗi — chỉ vì một banner trang trí hay
 * một con số hũ không tải được. Biên này khoanh lỗi trong đúng vùng nạp trễ: Hub vẫn sống, ô vẫn bấm được, vùng hỏng nói rõ
 * "KHÔNG TẢI ĐƯỢC" và có nút TẢI LẠI.
 *
 * ⚠ TẢI LẠI = `location.reload()`, không "dựng lại cây": `React.lazy` NHỚ lời hứa đã bị từ chối, nên dựng lại cùng một `lazy` chỉ ném
 *   lại đúng lỗi cũ; còn tải lại trang thì lấy luôn bản app mới (service worker) — đúng thứ chữa được lỗi tên chunk đổi.
 * ⚠ Chỉ bắt lỗi của CHÍNH vùng nạp trễ; không nuốt lỗi logic ở nơi khác (biên không bọc phần còn lại của Hub).
 */
import { Component, type ErrorInfo, type ReactNode } from 'react';
import { ghiDo } from '@/lib/telemetry';

interface Props {
  /** Vùng hỏng hiện gì — nhận hàm tải lại trang. */
  fallback: (taiLai: () => void) => ReactNode;
  children: ReactNode;
}

export class ChunkBoundary extends Component<Props, { hong: boolean }> {
  override state = { hong: false };

  static getDerivedStateFromError(): { hong: boolean } {
    return { hong: true };
  }

  override componentDidCatch(_e: Error, _info: ErrorInfo): void {
    // Đếm, không kể chi tiết: lỗi nạp chunk là tín hiệu hạ tầng (A9), không mang dữ liệu người chơi.
    ghiDo('loi_api', { chi_tiet: { ma: 'hub_chunk' } });
  }

  override render(): ReactNode {
    if (this.state.hong) return this.props.fallback(() => { window.location.reload(); });
    return this.props.children;
  }
}
