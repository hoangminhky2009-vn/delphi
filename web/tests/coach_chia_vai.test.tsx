/**
 * COACH TRÊN MÀN CHIA VAI ĐÓNG BĂNG (12/09) — founder: *"màn tập thì cho nó đóng
 * băng ở cái lúc phân vai để giới thiệu và hướng dẫn đi đã"*.
 *
 * Bài canh chuỗi bước đầu theo `chaoVaiPha`/`chaoVaiXong`:
 *   chia → 'chia-vai' hiện · chạm (pha `toi`) → 'vai-cua-ban' hiện · đóng → 'vai' (dải ghế).
 * ⚠ Bug đã đo trên tab thật 12/09: `cho` của 'chia-vai' chỉ nhận pha `chia` nên khi
 * pha sang `toi` bước ẩn trước khi `tuXong` kịp chạy — coach kẹt vĩnh viễn. Bài 2
 * canh đúng ca ấy. Tiêm lỗi: bỏ `|| b.chaoVaiPha === 'toi'` trong `cho` ⇒ bài 2 đỏ.
 * ⚠ D336 (15/09): sau màn chào là DẢI GHẾ rồi mới "Chạm SHOP" — bản cũ bảo chạm SHOP rồi
 * bước kế đóng shop lại để nói về dải ghế.
 * Không có vai (trận cũ) ⇒ hai bước chào trôi, bước đầu là dải ghế (bài 3).
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, render, screen } from '@testing-library/react';
import { CoachTap, type BoiCanhTap } from '../src/components/holdem/CoachTap';

const NEN: BoiCanhTap = {
  vong: 1, shopMo: false, bangMo: false, shopChonMa: false, coKetQua: false,
  loaiVongNay: 'tai_san', xong: false, onMoShop: () => {},
};

/** Hai neo của màn chào vai có mặt trên trang (coach rọi vào chúng). */
function neo() {
  const a = document.createElement('div'); a.setAttribute('data-tap', 'chia-vai');
  const b = document.createElement('div'); b.setAttribute('data-tap', 'chao-vai');
  const c = document.createElement('div'); c.setAttribute('data-tap', 'doi-thu');
  document.body.append(a, b, c);
}
/** Chữ chạy 2 ký tự / 28 ms — tua hết để đọc trọn câu. */
const tuaChu = () => act(() => { vi.advanceTimersByTime(3000); });

beforeEach(() => { vi.useFakeTimers(); neo(); window.sessionStorage.clear(); });
afterEach(() => { cleanup(); vi.useRealTimers(); document.body.innerHTML = ''; });

describe('coach trên màn chia vai', () => {
  it('⭐ pha chia ⇒ bước đầu nói về việc chia vai, chờ tay (không nút TIẾP)', () => {
    render(<CoachTap {...NEN} chaoVaiXong={false} chaoVaiPha="chia" />);
    tuaChu();
    expect(screen.getByRole('dialog').textContent).toContain('Mỗi ghế bốc một vai');
    // D336 — Oracle tự giới thiệu ngay câu ĐẦU, không phải ở bước thứ ba.
    expect(screen.getByRole('dialog').textContent).toContain('Mình là Oracle');
    expect(screen.queryByText(/TIẾP ▸/)).toBeNull();
  });

  it('⭐⭐ chạm (pha toi) ⇒ sang "vai của bạn", KHÔNG kẹt ẩn; đóng ⇒ dải ghế', () => {
    const { rerender } = render(<CoachTap {...NEN} chaoVaiXong={false} chaoVaiPha="chia" />);
    tuaChu();
    rerender(<CoachTap {...NEN} chaoVaiXong={false} chaoVaiPha="toi" />);
    tuaChu();
    const the = screen.getByRole('dialog');
    expect(the.textContent).toContain('Đọc xong, chạm để vào bàn');
    rerender(<CoachTap {...NEN} chaoVaiXong chaoVaiPha={null} />);
    tuaChu();
    expect(screen.getByRole('dialog').textContent).toContain('Dải ghế cả bàn');
  });

  it('trận không vai (chaoVaiXong undefined) ⇒ hai bước chào trôi, bước đầu là dải ghế', () => {
    render(<CoachTap {...NEN} />);
    tuaChu();
    expect(screen.getByRole('dialog').textContent).toContain('Dải ghế cả bàn');
  });

  it('chạm hai lần rất nhanh (đóng trước khi coach kịp hiện vai của bạn) ⇒ vẫn tới dải ghế', () => {
    const { rerender } = render(<CoachTap {...NEN} chaoVaiXong={false} chaoVaiPha="chia" />);
    tuaChu();
    rerender(<CoachTap {...NEN} chaoVaiXong chaoVaiPha={null} />);
    tuaChu();
    expect(screen.getByRole('dialog').textContent).toContain('Dải ghế cả bàn');
  });
});

/*
 * ═══ NẠP LẠI TRANG GIỮA TRẬN ⇒ TRỢ LÝ KHÔNG ĐƯỢC CHẾT ══════════════════════
 *
 * Lỗi thật, đo trên tab thật 12/09: màn CHÀO VAI chỉ dựng ở VÒNG 1. Nạp lại
 * trang ở vòng 2 thì `daChaoVai` về false mà màn chào không hiện nữa ⇒
 * `chaoVaiXong === false` vĩnh viễn ⇒ bước `chia-vai` vừa KHÔNG hiện vừa KHÔNG trôi
 * ⇒ cả lớp phủ trợ lý biến mất, không một dấu vết, suốt phần còn lại của trận.
 * Bất biến canh ở đây: **ở bất kỳ bối cảnh hợp lệ nào của bàn tập, trợ lý phải hoặc
 * đang nói, hoặc đang chờ một mốc CÓ THỂ tới.**
 * Tiêm lỗi: bỏ `|| b.vong > 1` khỏi `troi` của `chia-vai` ⇒ ba bài dưới đỏ.
 */
describe('nạp lại giữa trận — trợ lý vẫn nói', () => {
  const NAP_LAI = { ...NEN, chaoVaiXong: false, chaoVaiPha: null } as BoiCanhTap;

  for (const vong of [2, 3, 5]) {
    it(`⭐⭐ nạp lại ở vòng ${vong} (màn chào vai không còn dựng) ⇒ trợ lý vẫn hiện một bước`, () => {
      render(<CoachTap {...NAP_LAI} vong={vong} coKetQua />);
      tuaChu();
      const d = screen.queryByRole('dialog');
      expect(d, 'trợ lý chết hẳn: bước ẩn mà không có đường trôi').not.toBeNull();
      expect(d!.textContent).not.toBe('');
    });
  }

  it('⭐ vòng 1 vẫn chờ màn chào vai — đường thoát không được ăn mất bước thật', () => {
    // Ngay trước khi `ChaoVai` báo pha (một khung hình), bước phải ĐỨNG YÊN chờ,
    // không được trôi mất: nếu trôi, người chơi vòng 1 không bao giờ thấy màn chia vai.
    const { rerender } = render(<CoachTap {...NAP_LAI} vong={1} />);
    tuaChu();
    rerender(<CoachTap {...NAP_LAI} vong={1} chaoVaiPha="chia" />);
    tuaChu();
    expect(screen.getByRole('dialog').textContent).toContain('Mỗi ghế bốc một vai');
  });

  /*
   * D336 — nạp lại KHÔNG bắt nghe lại: sổ đã-qua lưu theo trận (`khoaLuu`). Bản cũ là
   * một con trỏ về 0 mỗi lần nạp, nên các bước không có `troi` diễn lại từ đầu.
   * Tiêm lỗi: bỏ `ghiLuu` ⇒ bài này đỏ (lần dựng hai lại nói dải ghế).
   */
  it('⭐ nạp lại cùng trận ⇒ bước đã nghe không nói lại', () => {
    const { unmount } = render(<CoachTap {...NEN} khoaLuu="tran-a" />);
    tuaChu();
    expect(screen.getByRole('dialog').textContent).toContain('Dải ghế cả bàn');
    act(() => { screen.getByText('TIẾP ▸').click(); });
    tuaChu();
    unmount();
    render(<CoachTap {...NEN} khoaLuu="tran-a" />);
    tuaChu();
    expect(screen.getByRole('dialog').textContent).not.toContain('Dải ghế cả bàn');
  });
});
