/**
 * v53 (D373) — BẢN ĐỒ KHI Ô CỦA VÒNG CÒN ÚP.
 *
 * Server giấu ô đi (`o_hien_tai: null` + cờ `up_o`); phần còn lại là việc của
 * bản đồ, và nó có đúng ba chỗ dễ sai — cả ba đều KHÔNG làm test cũ đỏ:
 *
 *   1. ĐÁNH SỐ LỆCH MỘT. Dãy ô úp ở luật cũ bắt đầu từ `vong + 1` (vì ô `vong`
 *      đang ngửa). Ở v53 nó phải bắt đầu từ chính `vong`. Sai chỗ này thì bản đồ
 *      vẽ thiếu đúng cái ô người chơi đang cược vào, và không ai nhận ra vì dãy
 *      vẫn liền mạch — chỉ ngắn đi một ô ở cuối.
 *   2. MẤT Ô ĐƯỢC LÀM NỔI. `hienTai` là null nên nếu không ai thế chỗ, cả bản đồ
 *      thành một dãy xám như nhau: tin mới nhất — thứ duy nhất người chơi có để
 *      cược — trông y hệt tin của sáu vòng trước.
 *   3. TELEGRAPH RỌI NHẦM Ô. Vạch "nghiêng về" phải nằm trên ô SẮP LẬT.
 *
 * ⚠ Mọi mục đều có vế LUẬT CŨ đi kèm: bài một chiều ở đây sẽ xanh vĩnh viễn kể
 * cả khi ai đó lỡ bật `upO` cho mọi trận (hoặc tắt hẳn). Vế cũ là mũi tiêm ngược
 * nằm sẵn trong bài.
 */
import { describe, expect, it } from 'vitest';
import { render } from '@testing-library/react';
import { MarketMap } from '../src/components/holdem/MarketMap';
import type { NhanDTO, ODTO } from '../src/api/holdem';

const CAT_GD: NhanDTO[] = [
  { id: 'tang', label: 'Đang lên', icon: '📈' },
  { id: 'di_ngang', label: 'Đứng im', icon: '➖' },
];
const CAT_SK: NhanDTO[] = [{ id: 'ha_lai_suat', label: 'Hạ lãi suất', icon: '📉' }];

const oGD = (gd: string): ODTO => ({ kind: 'giai_doan', giai_doan: gd } as ODTO);
const oSK = (): ODTO => ({
  kind: 'su_kien', su_kien: 'ha_lai_suat', bao_truoc: 'tang', tinh_chat: 'van_tien',
} as ODTO);

/**
 * Bàn 8 ô đang ở VÒNG 4. Ô 1–3 đã lật.
 * · luật cũ: ô 4 NGỬA (`hienTai`), còn úp 5 ô (5,6,7,8) ⇒ `conLai` = 8 − 4 = 4;
 * · v53:     ô 4 còn ÚP, `hienTai` null, `conLai` = 8 − 3 = 5.
 * Hai con số `conLai` khác nhau là CỐ Ý — chúng đúng bằng thứ server gửi ở mỗi
 * luật (`thanhPhanCongKhai(map, vongDaLat)`), và bài này phải ăn khớp với nó.
 */
const ve = (upO: boolean) => render(<MarketMap
  daLat={[oGD('tang'), oGD('tang'), oSK()]}
  hienTai={upO ? null : oGD('di_ngang')}
  vong={4}
  tongVong={8}
  conLai={upO ? 5 : 4}
  art={{}}
  giaiDoan={CAT_GD}
  suKien={CAT_SK}
  telegraph={{ tu_su_kien: 'ha_lai_suat', nghieng_ve: 'tang', keo_theo: [] }}
  upO={upO}
/>);

/** Số in trên từng ô, theo thứ tự trái → phải. */
const soCacO = (c: HTMLElement): string[] =>
  [...c.querySelectorAll('[class*="so"]')]
    .map((e) => (e.textContent ?? '').trim())
    .filter((t) => /^(⚖ )?\d+$/.test(t));

describe('I. ⭐ Ô SẮP LẬT phải có mặt, và mang đúng số của vòng', () => {
  it('v53: dãy ô bắt đầu từ 1 và chạy tới ô 4 — ô của vòng KHÔNG bị nuốt', () => {
    const { container } = ve(true);
    expect(soCacO(container)).toContain('4');
  });

  it('luật cũ (tiêm ngược): ô 4 vẫn có mặt, nhưng là ô NGỬA', () => {
    const { container, getByText } = ve(false);
    expect(soCacO(container)).toContain('4');
    expect(getByText('HIỆN TẠI ↗')).toBeTruthy();
  });

  it('v53: chân ô sắp lật ghi SẮP LẬT, và KHÔNG còn ô nào ghi HIỆN TẠI', () => {
    const { getByText, queryByText } = ve(true);
    expect(getByText('SẮP LẬT')).toBeTruthy();
    expect(queryByText('HIỆN TẠI ↗')).toBeNull();
  });

  it('luật cũ (tiêm ngược): không có ô nào ghi SẮP LẬT', () => {
    expect(ve(false).queryByText('SẮP LẬT')).toBeNull();
  });
});

describe('II. ⭐ Ô VỪA LẬT là ô được làm nổi thay cho ô ngửa', () => {
  it('v53: ô đã lật gần nhất ghi VỪA LẬT ✓', () => {
    expect(ve(true).getByText('VỪA LẬT ✓')).toBeTruthy();
  });

  it('v53: đúng MỘT ô mang dấu đang-lật (không phải cả dải cùng nhấp nháy)', () => {
    const { container } = ve(true);
    expect(container.querySelectorAll('[data-o-dang-lat]').length).toBe(1);
  });

  it('luật cũ (tiêm ngược): không ô nào ghi VỪA LẬT — ô nổi là ô ngửa', () => {
    expect(ve(false).queryByText('VỪA LẬT ✓')).toBeNull();
  });
});

describe('III. Telegraph rọi vào ô SẮP LẬT', () => {
  it('v53: vạch `data-nghieng` nằm trên ô úp ĐẦU DÃY, không phải ô kế nữa', () => {
    const { container } = ve(true);
    const nghieng = container.querySelectorAll('[data-nghieng]');
    expect(nghieng.length).toBe(1);
    // Ô mang vạch phải là ô số 4 — ô của vòng, thứ người chơi đang cược vào.
    const so = nghieng[0]?.querySelector('[class*="so"]')?.textContent?.trim();
    expect(so).toBe('4');
  });

  it('luật cũ (tiêm ngược): vạch nằm trên ô 5 (ô kế), vì ô 4 đang ngửa', () => {
    const { container } = ve(false);
    const nghieng = container.querySelectorAll('[data-nghieng]');
    expect(nghieng.length).toBe(1);
    const so = nghieng[0]?.querySelector('[class*="so"]')?.textContent?.trim();
    expect(so).toBe('5');
  });
});
describe('D380 — lá MỞ MÀN không được lật lần thứ hai', () => {
  /*
   * Founder: *"bị lỗi thẻ đầu tiên lật 2 lần"*. Ô vòng 1 luôn ngửa (D379) nên ở VÒNG 2
   * dãy ô-đã-lật vẫn chỉ có đúng lá mở màn — không có lá nào mới lật. Đánh dấu nó VỪA LẬT
   * là diễn lại một cú lật đã diễn rồi, và nó rơi đúng vào màn hướng dẫn.
   */
  /** Bản đồ ở VÒNG n với `upO`: đã lật đúng n−1 lá (lá mở màn + các lá sau). */
  const veVong = (vong: number) => render(<MarketMap
    daLat={Array.from({ length: vong - 1 }, () => oGD('tang'))}
    hienTai={null}
    vong={vong}
    tongVong={8}
    conLai={8 - (vong - 1)}
    art={{}}
    giaiDoan={CAT_GD}
    suKien={CAT_SK}
    telegraph={null}
    upO
  />);

  it('vòng 2: KHÔNG lá nào mang dấu VỪA LẬT', () => {
    const { container } = veVong(2);
    expect(/VỪA LẬT/.test(container.textContent ?? ''),
      'vòng 2 chỉ có lá mở màn — đánh dấu nó vừa lật là lật lần hai').toBe(false);
  });

  it('(tiêm ngược) vòng 3: CÓ lá vừa lật — cú sửa không được tắt luôn cả cơ chế', () => {
    const { container } = veVong(3);
    expect(/VỪA LẬT/.test(container.textContent ?? ''),
      'từ vòng 3 phải có lá vừa lật thật').toBe(true);
  });
});
