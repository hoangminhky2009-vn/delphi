/**
 * ORACLE CHAT HEAD + CHẤM TAB MÙA (founder 22/08).
 *  · nổi ở màn thường, KHÔNG ở màn toàn tâm (bàn đấu) — cùng luật với BottomNav;
 *  · thu ✕ ⇒ về chat head, và ĐỔI TRANG VẪN THU (nhớ ở localStorage) — thứ làm
 *    nó "không cứng"; có câu mới thì hiện chấm chứ không tự bung;
 *  · tab MÙA có chấm khi chưa điểm danh / có mốc chờ nhận, hết thì thôi.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, screen } from '@testing-library/react';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { ME_ONBOARDED, renderAt, stubFetch } from './helpers';
import { coViecCho } from '../src/lib/viec_cho';
import type { LoTrinhDTO } from '../src/api/nhiem_vu';

/*
 * SPEC chan-truoc-beta — khu Tài chính đang KHOÁ trên web (`lib/pfm_mo.ts`). Tệp này đo khu ấy ở trạng thái MỞ — mã của trạng thái
 * mở vẫn còn nguyên cho ngày mở lại (điều kiện ở `pfm_mo.ts`), nên GHIM cờ bật thay vì bỏ bài. Trạng thái KHOÁ: `pfm_khoa_web.test.tsx`.
 */
vi.mock('@/lib/pfm_mo', () => ({ PFM_WEB_MO: true }));

const HS_CHUA_GOI = {
  tinh_cach: 'dang_dinh_hinh', khau_vi: null, net: null, bac_doc: 'chua',
  n_vong: 16, n_tran: 2, brier_chuoi: [],
  chi_so: { hieu_chinh: null, duoi_gia: null, theo_tin: null, chot_non: null, don_von: null, mua_tin: null, khau_vi: null },
  goi: null,
  tien_do: { tran: 6, vong_quyet: 42, vong_su_kien: 15, can: { tran: 10, vong_quyet: 40, vong_su_kien: 8 }, day: false },
  lich_su: [],
};
const LT = (o: Partial<LoTrinhDTO> = {}): LoTrinhDTO => ({
  mua_mo: true, tuan: 2, so_tuan: 8, chang: 7, so_chang: 30, quest_points: 0,
  viec: [], da_diem_danh_hom_nay: true,
  moc: [{ chang_no: 7, q: 60, nhan: null, doc_ban: false, da_nhan: true, cho_art: false }],
  ...o,
});

function stubApp() {
  return stubFetch([
    ['/auth/me', { status: 200, body: ME_ONBOARDED }],
    ['/holdem/me/tinh-cach', { status: 200, body: HS_CHUA_GOI }],
    ['/me/nhiem-vu', { status: 200, body: LT() }],
    ['/me/qua-beta', { status: 404, body: { error: 'not_found' } }],
    ['/me/dong-token', { status: 200, body: { dong: [] } }],
  ]);
}

beforeEach(() => {
  localStorage.clear();
  /*
   * ⚠ jsdom KHÔNG có class PointerEvent ⇒ fireEvent.pointerDown tạo Event thường
   * và `clientX` KHÔNG được gán ⇒ mọi phép tính toạ độ ra NaN, snap luôn rơi về
   * 'phai' mà không lỗi. Mượn MouseEvent (có clientX/clientY) cho đúng hình dạng.
   */
  if (!('PointerEvent' in window)) {
    vi.stubGlobal('PointerEvent', globalThis.MouseEvent);
  }
});

describe('Oracle chat head', () => {
  it('⭐ lần đầu vào app ở HUB (màn bento) ⇒ chỉ avatar nhỏ NẰM TRONG ô giữ sẵn, KHÔNG tự bung; chạm ⇒ bung lời; chạm lại ⇒ gập', async () => {
    /*
     * VIẾT LẠI 11/10 (mẹ quyết, SPEC `alpha-draft-tang-khong-gian` — bong bóng Oracle CHỒNG lên nút VÀO TRẬN ở Hub): Hub là màn bento không
     * cuộn, không còn chỗ trống cho một lớp phủ trôi nổi. Bản cũ ("lần đầu ⇒ MỞ sẵn" ở Hub) chính là thứ che nút chính; luật mới: màn dành
     * sẵn một ô `[data-oracle-cho]`, Oracle là avatar nhỏ trong đó, bấm mới bung lời. Bài canh đầy đủ (toạ độ, sảnh Alpha Draft, đổi route):
     * `oracle_khong_che.test.tsx`. Vế "mở sẵn lần đầu" vẫn đúng ở màn NGOÀI bento — xem bài dưới (`/vi`).
     */
    stubApp();
    renderAt('/');
    const head = await screen.findByTestId('oracle-head');
    expect(head.hasAttribute('data-neo-cho'), 'Hub phải neo ô giữ sẵn').toBe(true);
    expect(screen.queryByTestId('oracle-chat'), 'lần đầu cũng KHÔNG tự bung (đó là chỗ nó che VÀO TRẬN)').toBeNull();
    fireEvent.click(head);
    const chat = await screen.findByTestId('oracle-chat');
    expect(chat.getAttribute('data-loai')).toBe('giuc');
    expect(screen.getByLabelText(/^Oracle:/).getAttribute('aria-label')).toMatch(/4 trận|còn 4/i);
    fireEvent.click(screen.getByTestId('oracle-head'));
    await vi.waitFor(() => expect(screen.queryByTestId('oracle-chat')).toBeNull());
  });

  it('⭐⭐⭐ NGOÀI HUB: mờ, và KHÔNG tự bung dù trạng thái nhớ là "đang mở"', async () => {
    /*
     * ⚠⚠ Chỉ thị founder 06/09: *"oracle chỉ hiện ở hub thôi, còn lại sẽ ở trạng thái
     * mờ, bấm vào mới rõ/hiện."*
     * Vì sao thành luật: Oracle là lớp phủ `position:fixed` neo ĐÁY, mà màn nào cũng đặt
     * hành động chính của mình ở đáy (tầm ngón cái). Ở màn SỔ nó đè đúng hàng tờ
     * 1k/2k/5k của bàn tiền — che mất chỗ người ta đang định bấm.
     * ⚠ Bài này khoá cả vế KHÓ: trạng thái nhớ là `mo: true` mà ngoài Hub vẫn phải thu.
     */
    localStorage.setItem('delphi.oracle', JSON.stringify({ mo: true, cau_da_doc: '' }));
    stubApp();
    // VIẾT LẠI 11/10 (tầng không gian): bốn tab tài chính nay là màn bento có ô giữ sẵn — không còn là ví dụ "ngoài Hub" kiểu cũ. Màn `/vi` thì còn.
    renderAt('/vi');
    const dau = await screen.findByTestId('oracle-head');
    expect(dau.getAttribute('data-mo'), 'ngoài Hub ⇒ mờ').toBe('co');
    expect(screen.queryByTestId('oracle-chat'), 'và KHÔNG bung ra').toBeNull();
  });

  it('⭐⭐ BỐN TAB TÀI CHÍNH (bento không cuộn): Oracle KHÔNG mờ, KHÔNG bung dù nhớ "đang mở", và nằm TRONG ô giữ sẵn của dải tab', async () => {
    // Cùng logic với Hub/sảnh: màn không còn chỗ trống cho lớp phủ trôi nổi (nó che hàng tờ tiền của bàn tiền) ⇒ avatar nhỏ trong `[data-oracle-cho]`.
    for (const tab of ['so', 'hu', 'guong', 'the']) {
      localStorage.setItem('delphi.oracle', JSON.stringify({ mo: true, cau_da_doc: '' }));
      stubApp();
      const { container, unmount } = renderAt(`/tai-chinh/${tab}`);
      const dau = await screen.findByTestId('oracle-head');
      expect(dau.getAttribute('data-mo'), `${tab}: không mờ`).not.toBe('co');
      expect(screen.queryByTestId('oracle-chat'), `${tab}: không tự bung`).toBeNull();
      const cho = container.querySelector('[data-khung-pfm] [data-oracle-cho]');
      expect(cho, `${tab}: dải tab phải có ô giữ sẵn Oracle`).not.toBeNull();
      unmount();
    }
  });

  it('⭐⭐ Ở HUB thì KHÔNG mờ — nó vẫn là nhà của Oracle', async () => {
    localStorage.setItem('delphi.oracle', JSON.stringify({ mo: false, cau_da_doc: '' }));
    stubApp();
    renderAt('/');
    const head = await screen.findByTestId('oracle-head');
    // Hub là màn BENTO (neo ô giữ sẵn): không có `.mo` (mờ) — nó đứng trong chỗ riêng, không nhường chỗ cho ai.
    expect(head.getAttribute('data-mo')).not.toBe('co');
    expect(head.className).not.toMatch(/mo|_mo_/);
  });

  it('⭐⭐ ngoài Hub: CHẠM một cái là rõ và mở ra', async () => {
    localStorage.setItem('delphi.oracle', JSON.stringify({ mo: false, cau_da_doc: '' }));
    stubApp();
    renderAt('/vi');
    const dau = await screen.findByTestId('oracle-head');
    // Bàn phím chỉ bắn `click` với `detail === 0` — đúng đường người dùng bàn phím đi.
    fireEvent.click(dau, { detail: 0 });
    expect(await screen.findByTestId('oracle-chat')).toBeTruthy();
  });

  it('⭐ MỜ CHỨ KHÔNG TẮT: vẫn bấm được, vẫn có nhãn cho trình đọc màn hình', async () => {
    /*
     * Mờ là để MẮT biết Oracle đang nhường chỗ, không phải để tắt nó đi. Nên chỉ `opacity`
     * bị hạ — `pointer-events` và `aria-label` giữ nguyên, bằng không thì người dùng bàn
     * phím và trình đọc màn hình mất hẳn Oracle chứ không phải "thấy nó mờ".
     */
    localStorage.setItem('delphi.oracle', JSON.stringify({ mo: false, cau_da_doc: '' }));
    stubApp();
    renderAt('/vi');
    const dau = await screen.findByTestId('oracle-head');
    expect(dau.getAttribute('aria-label')).toBeTruthy();
    expect(dau.tagName, 'vẫn là NÚT, không phải một mảng trang trí').toBe('BUTTON');
  });

  it('⭐ đã thu thì ĐỔI TRANG VẪN THU — không tự bung lại (thứ làm nó "không cứng")', async () => {
    localStorage.setItem('delphi.oracle', JSON.stringify({ mo: false, cau_da_doc: '' }));
    stubApp();
    renderAt('/tai-chinh');
    expect(await screen.findByTestId('oracle-head')).toBeTruthy();
    expect(screen.queryByTestId('oracle-chat')).toBeNull();
    // Câu chưa đọc ⇒ chat head có chấm báo (mời xem, không ép xem).
    expect(screen.getByTestId('oracle-head').getAttribute('aria-label')).toMatch(/câu mới/i);
  });

  it('câu ĐÃ ĐỌC rồi thì chat head im — không chấm', async () => {
    // Câu của hồ sơ này ở giọng 18-22 (ME_ONBOARDED) — đọc bằng chính lõi thuần.
    const { loiOracle, hatTheoNgay } = await import('../src/lib/loi_oracle');
    const cau = loiOracle(HS_CHUA_GOI as never, 'tre', hatTheoNgay()).cau;
    localStorage.setItem('delphi.oracle', JSON.stringify({ mo: false, cau_da_doc: cau }));
    stubApp();
    renderAt('/');
    const head = await screen.findByTestId('oracle-head');
    expect(head.getAttribute('aria-label')).toBe('Mở lời Oracle');
  });

  it('⭐ KHÔNG hiện ở màn toàn tâm (bàn đấu) — cùng luật với BottomNav', async () => {
    stubFetch([
      ['/auth/me', { status: 200, body: ME_ONBOARDED }],
      ['/holdem/me/tinh-cach', { status: 200, body: HS_CHUA_GOI }],
      ['/me/nhiem-vu', { status: 200, body: LT() }],
      ['/holdem/matches/', { status: 404, body: { error: 'not_found', message: 'Không thấy trận này.' } }],
    ]);
    renderAt('/arena/tran/00000000-0000-0000-0000-000000000000');
    await vi.waitFor(() => expect(screen.queryByLabelText('Menu chính')).toBeNull());
    expect(screen.queryByTestId('oracle-chat')).toBeNull();
    expect(screen.queryByTestId('oracle-head')).toBeNull();
  });
});

describe('coViecCho — chấm tab MÙA (thuần)', () => {
  it('chưa điểm danh ⇒ chấm; có mốc đã tới chặng chưa nhận ⇒ chấm', () => {
    expect(coViecCho(LT({ da_diem_danh_hom_nay: false }))).toBe(true);
    expect(coViecCho(LT({
      moc: [{ chang_no: 5, q: 60, nhan: null, doc_ban: false, da_nhan: false, cho_art: false }],
    }))).toBe(true);
  });

  it('đã điểm danh + mốc kế CHƯA tới chặng ⇒ KHÔNG chấm (việc tuần chưa xong không phải "chờ bấm")', () => {
    expect(coViecCho(LT({
      viec: [{ nv_id: 'a', ten: 'x', muc: 4, da: 1, xong: false }],
      moc: [{ chang_no: 20, q: 60, nhan: null, doc_ban: false, da_nhan: false, cho_art: false }],
    }))).toBe(false);
  });

  it('mùa chưa mở / chưa có dữ liệu ⇒ không chấm', () => {
    expect(coViecCho(LT({ mua_mo: false, da_diem_danh_hom_nay: false }))).toBe(false);
    expect(coViecCho(undefined)).toBe(false);
  });
});

describe('BottomNav — chấm tab MÙA (đường chạy thật)', () => {
  it('chưa điểm danh ⇒ tab MÙA có chấm; đã điểm danh ⇒ hết chấm', async () => {
    stubFetch([
      ['/auth/me', { status: 200, body: ME_ONBOARDED }],
      ['/holdem/me/tinh-cach', { status: 200, body: HS_CHUA_GOI }],
      ['/me/nhiem-vu', { status: 200, body: LT({ da_diem_danh_hom_nay: false }) }],
    ]);
    renderAt('/');
    expect(await screen.findByLabelText('Có việc mùa để nhận')).toBeTruthy();
  });
});

describe('⚠ hai bug bắt được khi soi PROD 23/08 — canh để không tái phát', () => {
  it('⭐ CSS: .dau KHÔNG composes "nut" (nút có position:relative, ghi đè fixed — bẫy #5)', async () => {
    const { readFileSync } = await import('node:fs');
    const { join } = await import('node:path');
    const css = readFileSync(join(process.cwd(), 'src/components/OracleChat.module.css'), 'utf8')
      .replace(/\/\*[\s\S]*?\*\//g, '');
    const khoiDau = css.slice(css.indexOf('.dau {'), css.indexOf('}', css.indexOf('.dau {')));
    expect(khoiDau, 'chat head phải nổi — mượn `nut` là mượn cả position:relative')
      .not.toMatch(/composes:[^;]*\bnut\b/);
    // Và nó vẫn phải là khung pixel (vát góc, radius 0).
    expect(khoiDau).toMatch(/composes:[^;]*\bkhung\b/);
    expect(css).toMatch(/position:\s*fixed/);
  });

  it('⭐ đọc xong rồi THU trong cùng phiên ⇒ chat head KHÔNG còn báo "câu mới"', async () => {
    stubApp();
    renderAt('/');
    fireEvent.click(await screen.findByTestId('oracle-head'));
    await screen.findByTestId('oracle-chat');
    // Chờ chữ chạy hết (câu đã đọc chỉ được ghi khi chạy xong).
    await vi.waitFor(
      () => expect(screen.getByLabelText(/^Oracle:/).textContent).toMatch(/vào chơi|xem thẻ/i),
      { timeout: 4000 },
    );
    fireEvent.click(screen.getByTestId('oracle-head'));
    await vi.waitFor(() => expect(screen.queryByTestId('oracle-chat')).toBeNull());
    const head = await screen.findByTestId('oracle-head');
    expect(head.getAttribute('aria-label'), 'vừa đọc xong mà vẫn chấm đỏ là nói dối').toBe('Mở lời Oracle');
  });
});

/*
 * KÉO chỉ còn ở màn NGOÀI bento (Hub + sảnh Alpha Draft neo ô giữ sẵn, không kéo — 11/10). Các bài kéo/nhớ chỗ dưới chạy ở `/vi`.
 */
describe('KÉO ĐƯỢC như chat head Messenger (founder 23/08)', () => {
  it('snapViTri thuần: thả nửa trái ⇒ bám TRÁI, nửa phải ⇒ bám PHẢI, y kẹp trong 0..1', async () => {
    const { snapViTri, bottomTuY } = await import('../src/lib/oracle_nho');
    const man = { w: 375, h: 812 };
    expect(snapViTri(20, 400, man).canh).toBe('trai');
    expect(snapViTri(300, 400, man).canh).toBe('phai');
    // Tâm head quyết định, không phải mép trái: x=160 ⇒ tâm 182 < 187,5 ⇒ trái.
    expect(snapViTri(160, 400, man).canh).toBe('trai');
    expect(snapViTri(170, 400, man).canh).toBe('phai');
    // Kéo vọt lên trên header / xuống dưới nav ⇒ vẫn nằm trong vùng đứng được.
    expect(snapViTri(20, -500, man).y).toBe(0);
    expect(snapViTri(20, 9999, man).y).toBe(1);
    // bottom luôn ở giữa lề dưới và mép trên vùng đứng.
    expect(bottomTuY(1, man)).toBe(70);
    expect(bottomTuY(0, man)).toBe(70 + (812 - 56 - 70 - 44));
  });

  it('⭐ KÉO head sang trái ⇒ đổi cạnh, NHỚ vào localStorage, và KHÔNG mở bong bóng', async () => {
    localStorage.setItem('delphi.oracle', JSON.stringify({ mo: false, cau_da_doc: '', canh: 'phai', y: 0.8 }));
    stubApp();
    renderAt('/vi');
    const head = await screen.findByTestId('oracle-head');
    expect(head.getAttribute('data-canh')).toBe('phai');
    fireEvent.pointerDown(head, { clientX: 330, clientY: 700, pointerId: 1 });
    fireEvent.pointerMove(head, { clientX: 200, clientY: 400, pointerId: 1 });
    fireEvent.pointerMove(head, { clientX: 40, clientY: 300, pointerId: 1 });
    fireEvent.pointerUp(head, { clientX: 40, clientY: 300, pointerId: 1 });
    await vi.waitFor(() => expect(screen.getByTestId('oracle-head').getAttribute('data-canh')).toBe('trai'));
    // Kéo KHÔNG được tính là chạm — bong bóng phải vẫn thu.
    expect(screen.queryByTestId('oracle-chat')).toBeNull();
    const nho = JSON.parse(localStorage.getItem('delphi.oracle')!);
    expect(nho.canh, 'kéo xong phải nhớ chỗ vừa đặt').toBe('trai');
    expect(nho.y).toBeGreaterThanOrEqual(0);
    expect(nho.y).toBeLessThanOrEqual(1);
  });

  it('⭐ CHẠM (dịch dưới ngưỡng) vẫn MỞ được — kéo không được nuốt cú bấm', async () => {
    localStorage.setItem('delphi.oracle', JSON.stringify({ mo: false, cau_da_doc: '', canh: 'phai', y: 0.8 }));
    stubApp();
    renderAt('/vi');
    const head = await screen.findByTestId('oracle-head');
    fireEvent.pointerDown(head, { clientX: 330, clientY: 700, pointerId: 1 });
    fireEvent.pointerMove(head, { clientX: 332, clientY: 701, pointerId: 1 }); // run tay 2px
    fireEvent.pointerUp(head, { clientX: 332, clientY: 701, pointerId: 1 });
    expect(await screen.findByTestId('oracle-chat')).toBeTruthy();
  });

  it('bong bóng mở ra ở ĐÚNG cạnh head đang đứng', async () => {
    localStorage.setItem('delphi.oracle', JSON.stringify({ mo: true, cau_da_doc: '', canh: 'trai', y: 0.5 }));
    stubApp();
    renderAt('/vi');
    // Ngoài Hub oracle thu + mờ cho tới khi CHẠM (luật 06/09); chạm xong bong bóng mở ở đúng cạnh đã nhớ.
    fireEvent.click(await screen.findByTestId('oracle-head'), { detail: 0 });
    const chat = await screen.findByTestId('oracle-chat');
    expect(chat.getAttribute('data-canh')).toBe('trai');
    expect(chat.getAttribute('style')).toMatch(/left:\s*10px/);
  });
});

describe('bàn phím vẫn dùng được (pointer không được nuốt mất Enter)', () => {
  it('⭐ Enter trên chat head ⇒ MỞ; Enter trên tay cầm ⇒ THU', async () => {
    localStorage.setItem('delphi.oracle', JSON.stringify({ mo: false, cau_da_doc: '', canh: 'phai', y: 0.8 }));
    stubApp();
    renderAt('/vi');
    const head = await screen.findByTestId('oracle-head');
    // Click từ bàn phím: detail = 0 (chuột luôn ≥ 1).
    fireEvent.click(head, { detail: 0 });
    const chat = await screen.findByTestId('oracle-chat');
    expect(chat).toBeTruthy();
    fireEvent.click(screen.getByLabelText(/chạm để thu gọn Oracle/i), { detail: 0 });
    expect(await screen.findByTestId('oracle-head')).toBeTruthy();
  });
});

describe('⚠ hai cạnh phải KHÁC NHAU THẬT (luật ghi đè bằng giá trị cũ = luật không tồn tại)', () => {
  const css = () => readFileSync(
    join(process.cwd(), 'src/components/OracleChat.module.css'), 'utf8',
  ).replace(/\/\*[\s\S]*?\*\//g, '');

  /**
   * Giá trị CUỐI CÙNG của `thuoc` trong mọi rule có selector đúng bằng `chon`.
   * Cắt theo dấu ngoặc rồi so selector bằng CHUỖI — không regex hoá selector, vì
   * `.bong::before` đầy ký tự đặc biệt và một bộ escape sai sẽ khớp nhầm im lặng.
   */
  function giaTri(noi: string, chon: string, thuoc: string): string | null {
    let ra: string | null = null;
    for (const khoi of noi.split('}')) {
      const nga = khoi.indexOf('{');
      if (nga < 0) continue;
      if (khoi.slice(0, nga).trim() !== chon) continue;
      for (const dong of khoi.slice(nga + 1).split(';')) {
        const hai = dong.indexOf(':');
        if (hai > 0 && dong.slice(0, hai).trim() === thuoc) ra = dong.slice(hai + 1).trim();
      }
    }
    return ra;
  }

  it('⭐ linh vật đứng ĐÚNG cạnh đang bám — .benTrai phải ĐẢO chiều hàng', () => {
    const noi = css();
    const macDinh = giaTri(noi, '.hang', 'flex-direction');
    const trai = giaTri(noi, '.benTrai .hang', 'flex-direction');
    expect(macDinh, '.hang phải khai chiều hàng').not.toBeNull();
    expect(trai, '.benTrai .hang phải khai chiều hàng').not.toBeNull();
    expect(trai, 'bám trái và bám phải mà cùng một chiều thì luật kia không làm gì cả')
      .not.toBe(macDinh);
  });

  it('⭐ đuôi bong bóng quay về phía linh vật — hai cạnh không được cùng phía', () => {
    const noi = css();
    const phaiR = giaTri(noi, '.bong::before', 'right');
    const traiL = giaTri(noi, '.benTrai .bong::before', 'left');
    expect(phaiR, 'bám mép PHẢI thì đuôi phải thò sang phải').toMatch(/^-\d/);
    expect(traiL, 'bám mép TRÁI thì đuôi phải thò sang trái').toMatch(/^-\d/);
    expect(giaTri(noi, '.benTrai .bong::before', 'right'), 'cạnh trái phải HUỶ phía phải')
      .toBe('auto');
  });
});

describe('⚠ kéo phải bám ĐÚNG ngón tay ở CẢ HAI trạng thái (bug prod 24/08)', () => {
  /** jsdom trả rect toàn 0 ⇒ tự gán hộp cho từng phần tử để đo được độ lệch. */
  const donHop = (el: HTMLElement, left: number, top: number, w: number, h: number) => {
    el.getBoundingClientRect = () => ({
      x: left, y: top, left, top, right: left + w, bottom: top + h, width: w, height: h,
      toJSON: () => ({}),
    }) as DOMRect;
  };

  it('⭐ MỞ bong bóng: dx đo từ KHUNG NGOÀI, không phải từ tay cầm', async () => {
    localStorage.setItem('delphi.oracle', JSON.stringify({ mo: true, cau_da_doc: '', canh: 'phai', y: 0.8 }));
    stubApp();
    renderAt('/vi');
    // Ngoài bento: chạm một cái cho bong bóng mở (luật mờ 06/09) rồi đo cú kéo ở tay cầm.
    fireEvent.click(await screen.findByTestId('oracle-head'), { detail: 0 });
    const wrap = await screen.findByTestId('oracle-chat');
    const tay = screen.getByLabelText(/chạm để thu gọn Oracle/i);
    // Bám mép PHẢI: khung rộng 300 ở x=65, tay 44px nằm mép phải khung (x=321).
    donHop(wrap, 65, 500, 300, 58);
    donHop(tay, 321, 500, 44, 44);

    fireEvent.pointerDown(tay, { clientX: 343, clientY: 522, pointerId: 1 });
    fireEvent.pointerMove(tay, { clientX: 313, clientY: 492, pointerId: 1 });

    // Ngón dịch −30 ⇒ khung phải dịch −30, tức left = 65 − 30 = 35.
    // Lấy nhầm hộp TAY thì ra 313 − (343 − 321) = 291 ⇒ bong bóng văng khỏi màn.
    expect(wrap.style.left, 'khung phải bám ngón tay, không nhảy sang chỗ của tay cầm')
      .toBe('35px');
  });

  it('THU về chat head: khung CHÍNH LÀ nút, hai cách đo phải cho cùng kết quả', async () => {
    localStorage.setItem('delphi.oracle', JSON.stringify({ mo: false, cau_da_doc: '', canh: 'phai', y: 0.8 }));
    stubApp();
    renderAt('/vi');
    const head = await screen.findByTestId('oracle-head');
    donHop(head, 321, 500, 44, 44);
    fireEvent.pointerDown(head, { clientX: 343, clientY: 522, pointerId: 1 });
    fireEvent.pointerMove(head, { clientX: 313, clientY: 492, pointerId: 1 });
    expect(head.style.left).toBe('291px');
  });
});
