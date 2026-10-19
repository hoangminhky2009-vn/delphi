/**
 * HUY HIỆU TÍNH CHẤT Ô SỰ KIỆN (D152/K1) — founder duyệt 29/08 rồi chỉnh lần
 * hai giữa lúc thi công: *"đ** phải huy hiệu HỌ lên ô sự kiện mà là huy hiệu
 * TÍNH CHẤT của ô — ở thiết kế mới, 1 thẻ với chuỗi sự kiện trước đó có thể có
 * tính chất khác nhau."*
 *
 * Cú chỉnh đó là KIẾN TRÚC, không phải chữ: tính chất phải là thuộc tính CỦA
 * TỪNG Ô do server tính (`o.tinh_chat` trong oCongKhai), KHÔNG phải bảng tra
 * theo loại sự kiện ở client — hôm nay hai đường cho cùng kết quả, nhưng khi
 * v35 thêm tương tác thẻ (cùng một tin, chuỗi trước khác ⇒ tính chất khác) thì
 * bảng tra theo loại sẽ NÓI DỐI, im lặng.
 *
 * Bốn thứ được khoá:
 *   §I  ĐẦY ĐỦ — mọi sự kiện có tính chất nền; mọi tính chất có icon + tên.
 *   §II NGUỒN LÀ Ô, KHÔNG PHẢI LOẠI — bài chịu lực: hai ô CÙNG loại tin mang
 *       `tinh_chat` khác nhau phải ra hai huy hiệu khác nhau.
 *   §III ĐÚNG CHỖ — chỉ ô sự kiện; ô đã qua vẫn có; ô pha không; ô ÚP tuyệt
 *       đối không (A3.1).
 *   §IV TÊN GÁNH NGHĨA + server cũ không vỡ.
 */
import { describe, expect, it } from 'vitest';
import { render } from '@testing-library/react';
import { SU_KIEN, TINH_CHAT_NEN } from '@config/holdem';
import { MarketMap, TC_ICON, TC_TEN } from '../src/components/holdem/MarketMap';
import type { NhanDTO, ODTO } from '../src/api/holdem';

const CAT_SK: NhanDTO[] = SU_KIEN.map((s) => ({ id: s.id, label: s.label, icon: s.icon }));
const CAT_GD: NhanDTO[] = [
  { id: 'tang', label: 'Đang lên', icon: '📈' },
  { id: 'di_ngang', label: 'Đứng im', icon: '➖' },
];

const oSK = (suKien: string, tinhChat?: string): ODTO => ({
  kind: 'su_kien', su_kien: suKien, bao_truoc: 'tang',
  ...(tinhChat !== undefined ? { tinh_chat: tinhChat } : {}),
} as ODTO);
const oGD = (gd: string): ODTO => ({ kind: 'giai_doan', giai_doan: gd } as ODTO);

const dungMap = (over: Partial<Parameters<typeof MarketMap>[0]> = {}) =>
  render(<MarketMap
    daLat={[]} hienTai={null} vong={1} tongVong={8} conLai={8}
    art={{}} giaiDoan={CAT_GD} suKien={CAT_SK} telegraph={null}
    {...over}
  />);

describe('I. Đầy đủ — bảng nào thiếu là ô "vô danh" lặng lẽ', () => {
  it('⭐⭐ mọi sự kiện có tính chất nền; mọi tính chất có icon + tên', () => {
    for (const sk of SU_KIEN) {
      const tc = TINH_CHAT_NEN[sk.id];
      expect(tc, `sự kiện ${sk.id} không có tính chất nền`).toBeTruthy();
      expect(TC_ICON[tc], `tính chất ${tc} không có icon — huy hiệu lặng lẽ vắng mặt`)
        .toBeTruthy();
      expect(TC_TEN[tc], `tính chất ${tc} không có tên — icon phải tự gánh nghĩa, D123 cấm`)
        .toBeTruthy();
    }
  });

  it('bốn tính chất nền, và bảng client không chứa ID mồ côi', () => {
    const nen = new Set(Object.values(TINH_CHAT_NEN));
    expect([...nen].sort())
      .toEqual(['hoang_loan', 'hung_phan', 'lech_ma', 'van_tien']);
    /*
     * ⚠ Chiều kiểm CÓ CHỦ ĐÍCH: mọi tính chất NỀN phải có trong bảng client
     * (trên đã kiểm), nhưng bảng client ĐƯỢC PHÉP rộng hơn — v35 sẽ thêm
     * tính chất NGỮ CẢNH (dung_thuoc, do_dau…) vào client TRƯỚC khi server
     * bắt đầu gửi chúng. Cấm chiều rộng hơn là tự chặn đúng lộ trình đã duyệt.
     */
    expect(Object.keys(TC_ICON).sort()).toEqual(Object.keys(TC_TEN).sort());
  });
});

describe('II. ⭐⭐ Nguồn là Ô, không phải LOẠI — lý do founder chỉnh', () => {
  it('hai ô CÙNG loại tin, khác `tinh_chat` ⇒ hai huy hiệu KHÁC nhau', () => {
    /*
     * Đây là bài chịu lực của cả kiến trúc. Nếu ai "dọn cho gọn" bằng cách
     * quay về tra catalog theo `su_kien`, hai ô dưới sẽ ra CÙNG một huy hiệu
     * và bài này đỏ — đúng cái nói-dối mà v35 sẽ tạo ra trên trận thật.
     * (Ca thật tương lai: `tang_lai_suat` nền = van_tien, nhưng nổ khi dư âm
     * lạm phát còn sống thì server sẽ gửi tính chất khác — ĐÚNG THUỐC.)
     */
    const a = dungMap({
      daLat: [oSK('tang_lai_suat', 'van_tien')],
      hienTai: oSK('tang_lai_suat', 'hoang_loan'), vong: 2, conLai: 5,
    });
    const em = [...a.container.querySelectorAll('[data-tinh-chat]')];
    expect(em.length).toBe(2);
    expect(em.map((e) => e.getAttribute('data-tinh-chat')).sort())
      .toEqual(['hoang_loan', 'van_tien']);
  });

  it('client KHÔNG tra tính chất từ catalog sự kiện', () => {
    // Ô có tinh_chat nhưng catalog RỖNG hoàn toàn ⇒ huy hiệu vẫn phải hiện —
    // chứng minh nguồn duy nhất là Ô.
    const { container } = dungMap({
      suKien: [], hienTai: oSK('bong_bong', 'hung_phan'), vong: 3, conLai: 5,
    });
    expect(container.querySelector('[data-tinh-chat]')?.getAttribute('data-tinh-chat'))
      .toBe('hung_phan');
  });
});

describe('III. Đúng chỗ', () => {
  it('ô ĐÃ QUA vẫn mang huy hiệu — tính chất là thứ để HỌC lại', () => {
    const { container } = dungMap({
      daLat: [oSK('chien_tranh', 'hoang_loan')], hienTai: oGD('tang'), vong: 2, conLai: 6,
    });
    expect(container.querySelector('[data-tinh-chat]')?.getAttribute('aria-label'))
      .toBe('Tính chất HOẢNG LOẠN');
  });

  it('ô GIAI ĐOẠN không có huy hiệu — tính chất là chuyện của TIN', () => {
    const { container } = dungMap({ hienTai: oGD('tang'), vong: 1, conLai: 7 });
    expect(container.querySelector('[data-tinh-chat]')).toBeNull();
  });

  it('⚠ ô ÚP tuyệt đối không — thứ tự ô úp là bí mật (A3.1)', () => {
    const { container } = dungMap({
      hienTai: oSK('lam_phat', 'lech_ma'), vong: 1, conLai: 8,
    });
    expect(container.querySelectorAll('[data-tinh-chat]').length,
      'nhiều hơn MỘT huy hiệu ⇒ ô úp đang rò').toBe(1);
  });
});

describe('IV. Tên gánh nghĩa · server cũ không vỡ', () => {
  it('title trùng aria, mang TÊN tính chất', () => {
    const { container } = dungMap({ hienTai: oSK('hack_san', 'lech_ma'), vong: 2, conLai: 4 });
    const em = container.querySelector('[data-tinh-chat]')!;
    expect(em.getAttribute('title')).toBe(em.getAttribute('aria-label'));
    expect(em.getAttribute('title')).toContain('LỆCH MÃ');
  });

  it('⭐ ô KHÔNG mang `tinh_chat` (server bản cũ) ⇒ không huy hiệu, không crash', () => {
    const { container } = dungMap({ hienTai: oSK('bong_bong'), vong: 3, conLai: 5 });
    expect(container.querySelector('[data-tinh-chat]')).toBeNull();
  });

  it('tính chất LẠ (v35 gửi trước khi client biết) ⇒ ẩn huy hiệu, không vỡ', () => {
    // Trường hợp triển khai lệch pha: server mới, client cũ. Thiếu icon thì
    // thà vắng mặt còn hơn vẽ một ô rỗng hay crash cả dải map.
    const { container } = dungMap({ hienTai: oSK('tang_lai_suat', 'dung_thuoc'), vong: 2, conLai: 4 });
    expect(container.querySelector('[data-tinh-chat]')).toBeNull();
  });
});
