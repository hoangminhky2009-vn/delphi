/**
 * BADGE BẬC ĐẤU TRƯỜNG — kiểm THỨ NGƯỜI CHƠI THẤY, không kiểm props.
 *
 * Ba lớp lỗi được nhắm, cả ba đều thuộc loại "không lỗi, không test đỏ":
 *   1. ICON VÔ HÌNH — `config/rank.ts` trỏ vào một tên lưới không có trong
 *      `PixelIcon.GRIDS`. Component render một ô rỗng, im lặng, mãi mãi.
 *   2. CỠ BỊ LÀM TRÒN IM LẶNG — `PixelIcon` suy px từ SỐ HÀNG lưới, nên `size`
 *      không phải bội số của 16 thì cỡ render KHÁC cỡ khai báo (đo được: 20 → 16,
 *      26 → 32). Mọi chỗ dùng badge phải đi qua phép kiểm này.
 *   3. HAI BẬC TRÔNG GIỐNG NHAU ở 16px — badge mất chức năng nhận dạng, mà nhận
 *      dạng chính là lý do nó tồn tại (D25: "đối thủ thấy mình là cái để mất").
 */
import { describe, expect, it } from 'vitest';
import { render } from '@testing-library/react';
import { BAC_THANG, dinhNghiaBac } from '@config/rank';
import { PixelIcon } from '@/components/ui/PixelIcon';

/** Chữ ký hình: chuỗi box-shadow đã dựng — đúng thứ trình duyệt vẽ ra. */
function hinh(name: string, size: number): string {
  const { container } = render(<PixelIcon name={name as never} size={size} />);
  const trong = container.querySelector('span > span') as HTMLElement | null;
  return trong?.style.boxShadow ?? '';
}

describe('icon bậc Đấu trường', () => {
  it('mọi bậc trong thang đều có lưới THẬT — không lá nào render rỗng', () => {
    for (const b of BAC_THANG) {
      expect(hinh(b.icon, 16).length, `icon ${b.icon} rỗng`).toBeGreaterThan(100);
      expect(hinh(b.icon_lon, 64).length, `icon_lon ${b.icon_lon} rỗng`).toBeGreaterThan(100);
    }
    // Trạng thái tạm "chưa xếp bậc" dùng lá `lock` đã có sẵn, không vẽ art mới.
    expect(hinh(dinhNghiaBac('chua_xep').icon, 16).length).toBeGreaterThan(100);
  });

  it('cỡ dùng thật là bội số của lưới → cỡ render đúng cỡ khai báo', () => {
    const icon = BAC_THANG[0]!.icon;
    for (const size of [16, 32, 48, 64, 96]) {
      const { container } = render(<PixelIcon name={icon as never} size={size} />);
      const ngoai = container.querySelector('span') as HTMLElement;
      // Nếu cỡ bị làm tròn thì bề rộng thật khác `size` — đây là chỗ bắt được.
      expect(ngoai.style.width).toBe(`${size}px`);
    }
  });

  it('bảy bậc ra bảy hình KHÁC NHAU ở 16px', () => {
    const chuKy = BAC_THANG.map((b) => hinh(b.icon, 16));
    expect(new Set(chuKy).size).toBe(7);
  });

  it('hai bậc apex có mép VÀNG, các bậc dưới thì không — luật nhiệt màu', () => {
    /*
     * Cá Mập và Cá Voi đều là "khối xám hình cá"; ở 16px hình không tách nổi
     * chúng khỏi Cá Heo. Mép vàng là thứ tách được, và nó không tốn ô nào.
     */
    const VANG = '#fde047';
    const apex = BAC_THANG.filter((b) => b.moc_duoi === null);
    expect(apex).toHaveLength(2);
    for (const b of apex) expect(hinh(b.icon, 16)).toContain(VANG);
    const caHeo = BAC_THANG.find((b) => b.id === 'giam_doc_dau_tu')!;
    expect(hinh(caHeo.icon, 16)).not.toContain(VANG);
  });

  it('mọi ô đều dùng màu CÓ TRONG PALETTE — ô lạ bị bỏ, tức mất ô không ai biết', () => {
    for (const b of BAC_THANG) {
      const s = hinh(b.icon, 16);
      // 16×16 = 256 ô; một lá đặc kín cũng không quá 256 entry.
      const soEntry = s.split(',').length;
      expect(soEntry).toBeGreaterThan(30);
      expect(soEntry).toBeLessThanOrEqual(256);
    }
  });
});

describe('vương miện là MỘT TRỤC KHÁC, không phải icon bậc (D298)', () => {
  /*
   * ⚠ HÀNG RÀO NÀY GIỮ MỘT CÁNH CỬA, KHÔNG CHẶN MỘT LỖI.
   *
   * `rank_ca_voi_vuong` nằm sẵn trong GRIDS và được đặt tên y như một icon bậc,
   * nên đường dễ đi nhất là gán nó vào `BAC_THANG` khi mở apex. Làm thế là DÍNH
   * ART VÀO LUẬT: từ đó mỗi lần founder đổi ngưỡng miện lại là một lần phải vẽ
   * lại lưới cho bậc mới — mà vẽ lưới là thứ chậm nhất trong repo này (§XI, vẽ
   * tay từng ô). Mỗi tổ hợp (bậc × miện) là một lưới, hai cỡ.
   *
   * Giữ hai trục rời nhau thì đổi luật chỉ còn là đổi MỘT SỐ:
   *     bậc  ← `apex_top` / `moc_duoi`  (BAC_THANG lo)
   *     miện ← một vị từ trên `hang`     (một cờ trên DTO, không phải icon)
   *
   * Bài này KHÔNG cấm lưới đội miện tồn tại — nó đã vẽ rồi, đang trên prod, và
   * là bản dự phòng nếu sau này founder chọn đường dính. Nó chỉ cấm việc NỐI
   * lưới đó vào thang bậc, vì đó là cú không lùi lại được mà không mất art.
   */
  it('không bậc nào lấy lưới đội miện làm icon', () => {
    for (const b of BAC_THANG) {
      for (const ten of [b.icon, b.icon_lon]) {
        expect(
          ten,
          `bậc ${b.id} đang trỏ vào lưới đội miện "${ten}". Miện KHÔNG phải icon `
          + 'bậc — xem D298. Muốn hiện miện thì thêm một cờ riêng trên DTO rank '
          + '(suy từ `hang`), đừng thay icon của bậc.',
        ).not.toMatch(/vuong/);
      }
    }
  });

  it('lưới đội miện vẫn còn và vẫn vẽ ra hình — art không được mục đi', () => {
    // Không ai gọi tới nó, nên không gì báo khi nó hỏng. Đây là thứ báo.
    // ⚠ Cỡ phải khớp SỐ HÀNG lưới (lỗi lớp 2 ở đầu tệp): bản 16 hàng đọc ở 16px,
    // bản 32 hàng ở 64px. Đọc sai cỡ thì `PixelIcon` cảnh báo và render cỡ khác.
    for (const [ten, cỡ] of [['rank_ca_voi_vuong', 16], ['rank_ca_voi_vuong_lon', 64]] as const) {
      expect(hinh(ten, cỡ).length, `lưới ${ten} rỗng`).toBeGreaterThan(100);
    }
  });
});
