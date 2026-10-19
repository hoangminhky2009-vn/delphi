/**
 * MÀN LỖI — lưới an toàn cuối cùng của client (vá 03/08, đợt kiểm 02/08).
 *
 * ⚠ VÌ SAO CẦN: React huỷ TOÀN BỘ cây khi một component ném lỗi lúc render.
 * Không có ranh giới bắt lỗi thì hậu quả là MÀN HÌNH TRẮNG — không chữ, không
 * nút, không cách nào thoát ngoài việc tự đoán ra là phải tải lại trang. Với
 * một app mở trên điện thoại thì đó gần như là mất người chơi, và tệ nhất là
 * nó xảy ra đúng giữa một vòng chưa chốt: người ta không biết tiền của mình
 * còn hay mất.
 *
 * Màn này KHÔNG cố sửa lỗi. Nó làm ba việc, đúng ba việc:
 *   1. nói rõ có chuyện gì, bằng tiếng người, không phải stack trace;
 *   2. trấn an đúng chỗ đáng lo — vòng đấu nằm ở MÁY CHỦ, không mất theo màn;
 *   3. cho một đường ra bấm được (tải lại / về Hub).
 *
 * Chi tiết kỹ thuật vẫn hiện nhưng THU GỌN sau `<details>` — người chơi không
 * cần, còn founder thì cần khi chụp màn gửi lại.
 */
import { Component, useEffect, type ErrorInfo, type ReactElement, type ReactNode } from 'react';
import { useRouteError } from 'react-router-dom';
import { ghiDo, maLoi, manCuaDuong } from '@/lib/telemetry';
import { baoLoiAnDanh } from '@/lib/bao_loi_an_danh';
import { ghiLoiGanNhat } from '@/lib/loi_gan_nhat';
import { Mascot } from '../Mascot';
import s from './ManLoi.module.css';

function ThanManLoi({ loi }: { loi: unknown }): ReactElement {
  const mota = loi instanceof Error ? loi.message : String(loi ?? 'không rõ');
  return (
    <div className={s.boc} role="alert">
      <Mascot size={72} title="Oracle" />
      <h1 className={s.tieuDe}>MÀN HÌNH VỪA VẤP</h1>
      <p className={s.chinh}>
        Giao diện gặp lỗi và phải dừng lại. Đây là lỗi ở phần hiển thị, không
        phải ở tài khoản của bạn.
      </p>
      <p className={s.trandan}>
        Trận đấu và số dư nằm ở máy chủ, không nằm trong màn hình này — tải lại
        là thấy đúng trạng thái mới nhất.
      </p>
      <div className={s.nut}>
        <button type="button" className={s.chinhNut} onClick={() => window.location.reload()}>
          TẢI LẠI
        </button>
        <button
          type="button"
          className={s.phuNut}
          onClick={() => { window.location.href = '/'; }}
        >
          VỀ HUB
        </button>
      </div>
      <details className={s.chiTiet}>
        <summary>CHI TIẾT KỸ THUẬT</summary>
        <pre>{mota}</pre>
      </details>
    </div>
  );
}

/** Dùng cho `errorElement` của router — lỗi khi render/loader một route. */
export function ManLoiRoute(): ReactElement {
  const loi = useRouteError();
  /*
   * §2.3 `loi_client` — sức khoẻ kỹ thuật. Màn lỗi này đã tồn tại từ D57 nhưng
   * cho tới 03/08 nó chỉ NÓI với người đang gặp lỗi; không ai bên ngoài biết
   * lỗi có xảy ra hay không, bao nhiêu lần, ở đâu.
   * Chỉ gửi MÃ băm — thông điệp gốc vẫn nằm trong `<details>` và console.
   */
  useEffect(() => {
    const ma = maLoi('route', loi);
    ghiDo('loi_client', { chi_tiet: { ma } });
    ghiLoiGanNhat(ma);
    // SPEC bao-loi-nguoi-choi — mọi người, kể cả khách và người đã tắt nghiên cứu; cổng "đã xem thẻ" nằm trong hàm.
    baoLoiAnDanh(ma, manCuaDuong(window.location.pathname));
  }, [loi]);
  return <ThanManLoi loi={loi} />;
}

/**
 * Ranh giới bắt lỗi bao NGOÀI router. Cần cả hai: `errorElement` không bắt
 * được lỗi ném từ chính AppShell hay từ lúc router dựng — mà đó lại là chỗ
 * hỏng thì hỏng cả app chứ không riêng một trang.
 */
export class RanhGioiLoi extends Component<
  { children: ReactNode }, { loi: unknown | null }
> {
  constructor(props: { children: ReactNode }) {
    super(props);
    this.state = { loi: null };
  }

  static getDerivedStateFromError(loi: unknown): { loi: unknown } {
    return { loi };
  }

  override componentDidCatch(loi: Error, info: ErrorInfo): void {
    // Không SDK Sentry ở client: mã ẩn danh đi qua máy chủ (`baoLoiAnDanh`); thông điệp đầy đủ chỉ ở console.
    console.error('[DELPHI] lỗi render:', loi, info.componentStack);
    /*
     * ⚠ Ranh giới này bọc NGOÀI router, tức nó bắt cả những cú hỏng khiến app
     * không dựng nổi — đúng loại lỗi tệ nhất và cũng là loại KHÔNG BAO GIỜ có
     * ai báo lại, vì người gặp nó chỉ thấy app "không vào được".
     * `ghiDo` không bao giờ ném, nên gọi ở đây an toàn.
     */
    const ma = maLoi('goc', loi);
    ghiDo('loi_client', { chi_tiet: { ma } });
    ghiLoiGanNhat(ma);
    baoLoiAnDanh(ma, manCuaDuong(window.location.pathname));
  }

  override render(): ReactNode {
    if (this.state.loi !== null) return <ThanManLoi loi={this.state.loi} />;
    return this.props.children;
  }
}
