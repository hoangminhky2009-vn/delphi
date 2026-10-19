/**
 * ĐỒNG HỒ VÒNG (D38) — phía client.
 *
 * BA CÂU HỎI, và cả ba đều là chỗ tính năng chết hoặc phản tác dụng trong im lặng:
 *
 *  1. **CÓ ĐƯỜNG NÀO GỌI TỚI KHÔNG?** Bẫy số 1 của repo: component đẹp, test
 *     component xanh, mà bàn đấu không render nó lần nào (đã gặp 9 lần). Nên ca
 *     quan trọng nhất KHÔNG kiểm component rời — nó render TRỌN bàn đấu qua route
 *     thật rồi tìm đồng hồ trên màn.
 *  2. **HIỆN VÔ ĐIỀU KIỆN CHƯA (D25/R1)?** Đồng hồ là một trong những thứ nặng
 *     nhất lên quyết định — còn 4 giây thì người ta chọn khác hẳn lúc còn 40. Giấu
 *     nó là log ra một quyết định "dưới sức ép" mà người chơi không thấy sức ép.
 *  3. **CÓ TỰ Ý LÀM CHÂN LÝ KHÔNG (C4)?** Đồng hồ client chạy nhanh hơn server thì
 *     người chơi mất lượt oan. Nên client về 0 mà server chưa nói hết giờ thì nút
 *     chốt phiên PHẢI còn bấm được, và request PHẢI còn gửi được.
 */
import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it, vi } from 'vitest';
import { act, fireEvent, render, screen } from '@testing-library/react';
import { DongHoVong } from '../src/components/holdem/DongHoVong';

/*
 * Đọc CHÍNH file CSS nguồn. Hai đường vì test chạy được từ `web/` lẫn từ gốc
 * repo; `?raw` KHÔNG dùng được ở đây — vitest chặn `.module.css` và trả về bảng
 * tên lớp, không phải chuỗi (mất mười phút mới lòi ra, ghi để khỏi thử lại).
 */
const DUONG_CSS = 'src/components/holdem/DongHoVong.module.css';
const cssDongHo = readFileSync(
  [DUONG_CSS, `web/${DUONG_CSS}`]
    .map((p) => resolve(process.cwd(), p)).find((p) => existsSync(p))!,
  'utf8');
import { ME_ONBOARDED, renderAt, stubFetch, type RecordedCall } from './helpers';

// ══════════════════════════ Fixture bàn đấu ══════════════════════════

const CATALOG = {
  engine_version: 'holdem-test-dh',
  balance_version: 'balance-test',
  luat: {
    SEATS: 5, START_VON: 10000, CAM_KET_NEN: 500, MAX_TAI_SAN: 4,
    MAX_CHIEN_THUAT: 2, SHOP_TAI_SAN: 3, SHOP_CHIEN_THUAT: 2,
    CHI_PHI_KHAO_SAT_LAI: 2, TRAN_TANG_CAM_KET_BP: 4000, PHI_BANG_DIEN_TU: 25,
  },
  nhip_chon_bai: ['tai_san', 'tai_san', 'chien_thuat', 'tai_san', 'tai_san',
    'chien_thuat', 'khong', 'khong'],
  cap_stack_bp: [10000, 16000, 20000],
  quyet_dinh: { MAP_SIZE: 8, SHOWDOWN_MODEL: 'A' },
  tai_san: [
    { id: 'btc', label: 'BTC', icon: '₿', nhom: 'rui_ro', thanh_khoan: 'mong', bien_dong_bp: 400 },
  ],
  chien_thuat: [],
  giai_doan: [{ id: 'di_ngang', label: 'Đi ngang', icon: '➖' }],
  su_kien: [],
  tu_dien: { tai_san: {}, chien_thuat: {} },
  khau_vi: [],
};

const tran = (patch: Record<string, unknown> = {}) => ({
  match_id: 'm-dh',
  vong: 4,
  tong_vong: 8,
  status: 'dang_choi',
  dong_ho: { con_lai_s: 21, tong_s: 25, het_gio: false, an_han_s: 8 },
  ban: {
    von: 9000,
    luot_khao_sat: 1,
    danh_muc: { tai_san: ['btc'], chien_thuat: [] },
    da_chay: false,
    tu_the: 'choi',
    vong_roi: null,
    so_lan_cat_lo: 0,
    con_lai_cat_lo: 1,
    khau_vi: 'can_bang',
    fx: 'binh_thuong',
  },
  doi_thu: [],
  so_nguoi_song: 1,
  o_hien_tai: { kind: 'giai_doan', giai_doan: 'di_ngang' },
  lich_su_o: [],
  telegraph: null,
  bo_bai_con_lai: { con_lai: 5, so_giai_doan: 3, so_su_kien: 2, tin_gia_ky_vong: 1 },
  quy_vong_hien_tai: 500,
  shop: null,
  loi_von: null,
  ...patch,
});

function moBan(patch: Record<string, unknown> = {}): RecordedCall[] {
  return stubFetch([
    ['/auth/me', { status: 200, body: ME_ONBOARDED }],
    ['/holdem/catalog', { status: 200, body: CATALOG }],
    ['/holdem/art', { status: 200, body: { version: 'holdem-test-dh', art: {} } }],
    // Đặt TRƯỚC '/holdem/matches/m-dh': stubFetch khớp theo thứ tự khai báo.
    ['/holdem/matches/m-dh/luot',
      { status: 200, body: { cho_ban: null, xong_vong: true, nhat_ky: [] } }],
    ['/holdem/matches/m-dh/rounds', {
      status: 200,
      body: {
        ...tran(), vong: 5, tu_dong: true,
        ket_qua_vong: {
          vong: 4,
          o: { kind: 'giai_doan', giai_doan: 'di_ngang' },
          tin_gia_lo: null, quy_vong: 500, ghe_thang: 'ban', chay_vong_nay: [],
          cua_ban: null, cua_doi_thu: [], phi_cua_ban: null, ty_le_cat_lo_bp: 0,
        },
      },
    }],
    ['/holdem/matches/m-dh', { status: 200, body: tran(patch) }],
  ]);
}

// ══════════════════════════ 1 + 2 — có nối, và luôn hiện ══════════════════

describe('BÀN ĐẤU THẬT — đồng hồ có được render không (D25/R1)', () => {
  it('vào bàn ⇒ thấy số giây còn lại ngay, không phải bấm gì để mở ra', async () => {
    /*
     * Đồng hồ client trừ theo `Date.now()` kể từ lúc NHẬN response (`useDemNguocVong`): máy bận vẽ màn chậm hơn 1 s là nhãn
     * đã thành "Còn 20 giây" ⇒ khẳng định 21 đua với giờ thật (11/10: đỏ khi hai lượt cả bộ web chạy song song). Đồng hồ do
     * bài cầm, đứng yên ⇒ số hiện ra đúng bằng số server gửi, runner nhanh hay chậm như nhau.
     */
    const dongHo = Date.now();
    const gio = vi.spyOn(Date, 'now').mockImplementation(() => dongHo);
    try {
      moBan();
      renderAt('/arena/tran/m-dh');
      await screen.findByText(/còn \d+ ô/);
      /*
       * Tìm bằng NHÃN TRỢ NĂNG chứ không bằng class: class đổi tên theo hash của
       * CSS Modules, còn nhãn này chính là thứ trình đọc màn hình đọc lên — nếu nó
       * mất thì người dùng trình đọc màn hình mất luôn đồng hồ.
       */
      expect(screen.getByLabelText(/Còn 21 giây để quyết định/)).toBeInTheDocument();
    } finally { gio.mockRestore(); }
  });

  it('server nói HẾT GIỜ ⇒ màn hình nói HẾT GIỜ, không vẽ một con số đang đếm', async () => {
    moBan({ dong_ho: { con_lai_s: 0, tong_s: 25, het_gio: true, an_han_s: 8 } });
    renderAt('/arena/tran/m-dh');
    await screen.findByText(/còn \d+ ô/);
    expect(screen.getByText('HẾT GIỜ')).toBeInTheDocument();
  });

  /*
   * `ly_do = tran_lam_quen` — DI SẢN sáng 16/08 (luật "hai trận đầu không giờ",
   * founder bác cùng chiều): chỉ hai trận prod đã tạo dưới luật đó còn mang nó.
   * Client vẫn phải vẽ đúng nhãn cho chúng ("tạm dừng" hứa lát nữa chạy lại,
   * ở đó không có lát nữa nào), và không tự suy (C4).
   */
  it('trận DI SẢN (ly_do=tran_lam_quen) ⇒ "KHÔNG TÍNH GIỜ", không phải "TẠM DỪNG"', async () => {
    moBan({ dong_ho: {
      con_lai_s: 25, tong_s: 25, het_gio: false, an_han_s: 8,
      tam_dung: true, ly_do: 'tran_lam_quen',
    } });
    renderAt('/arena/tran/m-dh');
    await screen.findByText(/còn \d+ ô/);
    expect(screen.getByText('KHÔNG TÍNH GIỜ')).toBeInTheDocument();
    expect(screen.queryByText('TẠM DỪNG')).toBeNull();
    expect(screen.getByLabelText(/Trận làm quen — không tính giờ/)).toBeInTheDocument();
  });

  it('màn tập (ly_do=man_tap, hoặc API cũ không gửi ly_do) ⇒ vẫn "TẠM DỪNG" như D53', async () => {
    moBan({ dong_ho: { con_lai_s: 25, tong_s: 25, het_gio: false, an_han_s: 8, tam_dung: true } });
    renderAt('/arena/tran/m-dh');
    await screen.findByText(/còn \d+ ô/);
    expect(screen.getByText('TẠM DỪNG')).toBeInTheDocument();
    expect(screen.queryByText('KHÔNG TÍNH GIỜ')).toBeNull();
  });

  it('API KHÔNG gửi đồng hồ (trận cũ / bundle mới hơn API) ⇒ IM, không vẽ số 0',
    async () => {
      /*
       * Vẽ "0s" cho một trận không có hạn là nói dối theo hướng tệ nhất: người chơi
       * tưởng mình sắp mất lượt trong khi thật ra không có hạn nào. Thiếu dữ liệu
       * thì im — đúng nếp `luat_von`/`dac_quyen` đã đặt.
       */
      moBan({ dong_ho: undefined });
      renderAt('/arena/tran/m-dh');
      await screen.findByText(/còn \d+ ô/);
      expect(screen.queryByText('HẾT GIỜ')).not.toBeInTheDocument();
      expect(screen.queryByLabelText(/giây để quyết định/)).not.toBeInTheDocument();
    });

  it("trận 'bo_dở' ⇒ MÀN RIÊNG nói vì sao, không vẽ bàn đấu mà mọi nút đều 409",
    async () => {
      moBan({ status: 'bo_dở' });
      renderAt('/arena/tran/m-dh');
      expect(await screen.findByText(/đã đóng vì để quá lâu không có nước đi/))
        .toBeInTheDocument();
      expect(screen.getByText(/Kết quả không được tính/)).toBeInTheDocument();
      expect(screen.queryByText(/còn \d+ ô/), 'bàn đấu không được render nữa')
        .not.toBeInTheDocument();
    });

  it('vòng bị chốt hộ ⇒ màn kết quả NÓI RA, không im lặng', async () => {
    const calls = moBan();
    renderAt('/arena/tran/m-dh');
    await screen.findByText(/còn \d+ ô/);
    fireEvent.click(screen.getByRole('button', { name: /CHỐT VÒNG/ }));
    await vi.waitFor(() => {
      expect(calls.some((c) => c.method === 'POST' && c.url.includes('/rounds'))).toBe(true);
    }, { timeout: 5000 });
    /*
     * Người chơi vừa mất một lượt quyết định. Im lặng thì họ chỉ thấy "sao chẳng có
     * gì xảy ra" — một hình phạt nạn nhân không nhận ra chỉ gây bực chứ không dạy.
     *
     * ⚠ 23/08 — ĐƯỜNG ĐI ĐỔI, TIN THÌ KHÔNG. Founder thu cả khối kết quả về một
     * con số, nên `tu_dong` thôi TỰ BUNG cả bảng; đổi lại con số mang mức mời
     * chạm GẮT (`moiGap`: nhấp nhanh gấp đôi + viền) để nó khác hẳn một vòng
     * thường. Bài này vì thế khoá HAI vế — có tín hiệu, và chạm vào thì tới nơi.
     * Bỏ vế nào cũng hở: chỉ có tín hiệu mà bấm không ra gì thì là quấy; chỉ có
     * nội dung mà không tín hiệu thì không ai biết đường mà bấm.
     */
    const so = await screen.findByRole(
      'button', { name: /Vòng vừa rồi/ }, { timeout: 5000 },
    );
    expect(so.className, 'vòng bị chốt hộ phải mời chạm gắt hơn vòng thường')
      .toMatch(/moiGap/);
    fireEvent.click(so);
    expect(await screen.findByText('GIỮ NGUYÊN', {}, { timeout: 5000 }))
      .toBeInTheDocument();
  });
});

// ══════════════════════════ 3 — client KHÔNG phải chân lý ══════════════════

describe('C4 — đồng hồ client chỉ để VẼ', () => {
  it('client đếm về 0 mà server chưa nói hết giờ ⇒ VẪN nộp vòng được', async () => {
    /*
     * Đây là ca đắt nhất trong file. `AN_HAN_S` tồn tại đúng để cú "app chạy nền 10
     * giây" không giết một vòng; nếu client tự khoá nút khi số về 0 thì ân hạn đó
     * biến mất ở đúng những người cần nó nhất, và server không có cách nào biết.
     */
    const calls = moBan({
      dong_ho: { con_lai_s: 0, tong_s: 25, het_gio: false, an_han_s: 8 },
    });
    renderAt('/arena/tran/m-dh');
    await screen.findByText(/còn \d+ ô/);

    const nut = screen.getByRole('button', { name: /CHỐT VÒNG/ });
    expect(nut, 'client hết giờ KHÔNG được khoá nút — server còn ân hạn')
      .not.toBeDisabled();
    fireEvent.click(nut);
    await vi.waitFor(() => {
      expect(calls.some((c) => c.method === 'POST' && c.url.includes('/rounds'))).toBe(true);
    }, { timeout: 5000 });
  });

  it('cờ `het_gio` của SERVER thắng con số client đang đếm', async () => {
    // 20 giây còn lại theo con số, nhưng server bảo hết ⇒ hiện HẾT GIỜ.
    // Ngược lại là client tự quyết, tức C4 chỉ còn nằm trong comment.
    render(<DongHoVong conLaiS={20} tongS={25} hetGio nhanLuc={Date.now()} />);
    expect(screen.getByText('HẾT GIỜ')).toBeInTheDocument();
    expect(screen.queryByText('20s')).not.toBeInTheDocument();
  });

  it('đếm lùi theo thời gian trôi, và KHÔNG BAO GIỜ âm', () => {
    vi.useFakeTimers();
    try {
      render(<DongHoVong conLaiS={3} tongS={25} hetGio={false} nhanLuc={Date.now()} />);
      expect(screen.getByText('3s')).toBeInTheDocument();
      // `act` bắt buộc: setState nằm trong callback của `setInterval`, React không
      // flush nó nếu đồng hồ được đẩy ngoài act — test sẽ đỏ vì lý do sai hoàn toàn.
      act(() => { vi.advanceTimersByTime(2000); });
      expect(screen.getByText('1s')).toBeInTheDocument();
      act(() => { vi.advanceTimersByTime(30_000); });
      expect(screen.queryByText(/-\d+s/), 'số âm sẽ hiện ra màn hình dưới dạng "-12s"')
        .not.toBeInTheDocument();
      expect(screen.getByText('HẾT GIỜ')).toBeInTheDocument();
    } finally {
      vi.useRealTimers();
    }
  });
});

// ════════ VIỀN CẢNH BÁO SẮP HẾT GIỜ (founder 09/08) ══════════════════════

describe('viền màn hình nháy đỏ khi sắp hết giờ', () => {
  /*
   * Đồng hồ nằm ở dải TRÊN CÙNG, tay người chơi ở SHOP dưới đáy — lúc cân mốc
   * lệnh thì mắt không rời bảng giá. Viền là tín hiệu ngoại vi.
   *
   * Cả bốn ca dưới đây là lỗi HIỆN SAI LÚC — không ném lỗi, không làm test nào
   * khác đỏ, chỉ âm thầm giục sai người hoặc im lúc cần nói.
   */
  const timVien = () => document.querySelector('[class*="vienGap"]');

  it('⭐ còn ÍT giây ⇒ viền hiện; còn NHIỀU ⇒ không', async () => {
    moBan({ dong_ho: { con_lai_s: 5, tong_s: 40, het_gio: false, an_han_s: 8 } });
    renderAt('/arena/tran/m-dh');
    await screen.findByText(/còn \d+ ô/);
    expect(timVien(), 'còn 5 giây mà không cảnh báo gì thì viền này vô dụng')
      .toBeTruthy();
  });

  it('còn nhiều giờ ⇒ IM — nháy đỏ cả vòng thì nó thôi là cảnh báo', async () => {
    moBan({ dong_ho: { con_lai_s: 30, tong_s: 40, het_gio: false, an_han_s: 8 } });
    renderAt('/arena/tran/m-dh');
    await screen.findByText(/còn \d+ ô/);
    expect(timVien()).toBeNull();
  });

  it('MÀN TẬP đang "TẠM DỪNG ∞" ⇒ IM, dù số nhỏ (D53 — giục là nói dối)', async () => {
    moBan({
      dong_ho: { con_lai_s: 3, tong_s: 40, het_gio: false, an_han_s: 8, tam_dung: true },
    });
    renderAt('/arena/tran/m-dh');
    await screen.findByText(/còn \d+ ô/);
    expect(timVien(), 'màn hứa TẠM DỪNG mà viền giục là hai lời trái nhau')
      .toBeNull();
  });

  it('server đã nói HẾT GIỜ ⇒ IM — nhắc mãi một chuyện đã xong', async () => {
    moBan({ dong_ho: { con_lai_s: 0, tong_s: 40, het_gio: true, an_han_s: 8 } });
    renderAt('/arena/tran/m-dh');
    await screen.findByText(/còn \d+ ô/);
    expect(timVien()).toBeNull();
  });

  it('trận CŨ không có đồng hồ ⇒ IM (không bịa hạn — nếp D38)', async () => {
    moBan({ dong_ho: undefined });
    renderAt('/arena/tran/m-dh');
    await screen.findByText(/còn \d+ ô/);
    expect(timVien()).toBeNull();
  });

  it('⭐ HAI NẤC: còn 6s ⇒ nấc nhẹ; còn 2s ⇒ nấc KHẨN (dày + gấp nhịp)', async () => {
    /*
     * Nấc hai làm viền CHỞ THÔNG TIN thay vì chỉ báo động — liếc một cái là
     * biết "còn kịp cân nhắc" hay "bấm ngay đi". Mất phân biệt này thì suốt 8
     * giây đều gào như nhau và người chơi học cách phớt lờ.
     */
    moBan({ dong_ho: { con_lai_s: 6, tong_s: 40, het_gio: false, an_han_s: 8 } });
    renderAt('/arena/tran/m-dh');
    await screen.findByText(/còn \d+ ô/);
    const v = timVien();
    expect(v, 'còn 6 giây thì viền phải hiện').toBeTruthy();
    expect(String(v!.className), 'còn 6 giây CHƯA phải nấc khẩn')
      .not.toMatch(/vienKhan/);
  });

  it('còn 2s ⇒ đeo thêm lớp nấc KHẨN', async () => {
    moBan({ dong_ho: { con_lai_s: 2, tong_s: 40, het_gio: false, an_han_s: 8 } });
    renderAt('/arena/tran/m-dh');
    await screen.findByText(/còn \d+ ô/);
    expect(String(timVien()!.className)).toMatch(/vienKhan/);
  });

  it('⚠ NHỊP NHÁY DƯỚI TRẦN AN TOÀN 3 Hz — trần sức khoẻ, không phải gu', () => {
    /*
     * Ngưỡng quốc tế cho nội dung nhấp nháy là DƯỚI 3 lần/giây; nhanh hơn là
     * rủi ro co giật ánh sáng. Đây là chỗ dễ bị vặn nhất ("nháy gấp hơn cho
     * nó gấp"), nên khoá bằng test chứ không bằng một dòng ghi chú.
     *
     * Khoá TÍNH CHẤT (chu kỳ ≥ 1/3 giây) chứ không khoá con số 0.5 — chỉnh
     * nhịp trong vùng an toàn vẫn phải xanh.
     */
    const chuKy = (lop: string): number => {
      const dau = cssDongHo.indexOf(`.${lop} {`);
      expect(dau, `không thấy khối .${lop}`).toBeGreaterThan(-1);
      const than = cssDongHo.slice(dau, cssDongHo.indexOf('}', dau));
      const m = than.match(/animation:[^;]*?([\d.]+)s/);
      expect(m, `.${lop} phải khai thời lượng animation`).toBeTruthy();
      return Number(m![1]);
    };
    const nhe = chuKy('vienGap');
    const khan = chuKy('vienKhan');
    expect(khan, 'nháy nhanh hơn 3 Hz là rủi ro co giật ánh sáng')
      .toBeGreaterThanOrEqual(1 / 3);
    expect(nhe).toBeGreaterThanOrEqual(1 / 3);
    expect(khan, 'nấc khẩn phải nháy GẤP hơn nấc nhẹ, nếu không thì hai nấc '
      + 'không phân biệt được bằng nhịp').toBeLessThan(nhe);
  });

  it('⚠ viền KHÔNG ĐƯỢC CHẶN THAO TÁC — pointer-events: none là ràng buộc cứng',
    () => {
      /*
       * Nó phủ toàn màn ở z-index 60, tức nằm TRÊN mọi nút. Thiếu dòng
       * `pointer-events: none` là cảnh báo "nhanh lên" khoá đúng cái nút cần
       * bấm — hỏng theo kiểu tệ nhất: người chơi thấy nút, bấm, và không có gì
       * xảy ra. jsdom không dựng CSS Modules nên đọc THẲNG file nguồn.
       *
       * ⚠ Cắt bằng chỉ số chuỗi chứ không bằng regex `\{([^{}]*)\}`: bộ tách
       * kiểu đó không bao giờ đi vào trong `@media`, và một bài test như thế
       * đã từng XANH VĨNH VIỄN trên đoạn code đã hỏng (D66).
       */
      const dau = cssDongHo.indexOf('.vienGap {');
      expect(dau, 'không tìm thấy khối .vienGap — đổi tên lớp thì sửa cả test này')
        .toBeGreaterThan(-1);
      const than = cssDongHo.slice(dau, cssDongHo.indexOf('}', dau));
      expect(than).toContain('pointer-events: none');
      expect(than, 'không fixed thì nó cuộn mất khỏi màn').toContain('position: fixed');
    });
});

// ═══════════ RÀ ĐỒNG HỒ 08/08 — mốc NHẬN, không phải mốc ÁP ═══════════════

describe('22/08 — viền nháy phải nằm TRÊN lớp phủ shop', () => {
  it('z-index .vienGap > z-index .phu của ShopManHinh (founder: "mở shop đ** thấy nháy gì")', () => {
    const DUONG_SHOP = 'src/components/holdem/ShopManHinh.module.css';
    const cssShop = readFileSync(
      [DUONG_SHOP, `web/${DUONG_SHOP}`].map((p) => resolve(process.cwd(), p)).find((p) => existsSync(p))!, 'utf8');
    const zCua = (css: string, lop: string): number => {
      const i = css.indexOf(`${lop} {`);
      expect(i, `không thấy khối ${lop}`).toBeGreaterThanOrEqual(0);
      const khoi = css.slice(i, css.indexOf('}', i));
      const m = khoi.match(/z-index:\s*(\d+)/);
      expect(m, `${lop} không khai z-index`).toBeTruthy();
      return Number(m![1]);
    };
    const vien = zCua(cssDongHo, '.vienGap');
    const shop = zCua(cssShop, '.phu');
    expect(vien, `viền ${vien} phải trên shop ${shop} — shop là fixed full-screen, dưới nó là mất`).toBeGreaterThan(shop);
    // và viền KHÔNG được chặn chạm — đè lên shop mà ăn click là khoá đúng nút cần bấm.
    const khoi = cssDongHo.slice(cssDongHo.indexOf('.vienGap {'), cssDongHo.indexOf('}', cssDongHo.indexOf('.vienGap {')));
    expect(khoi).toMatch(/pointer-events:\s*none/);
  });
});

describe('đồng hồ neo tại thời điểm NHẬN response (đo prod: 2 vòng tu_dong/trận)', () => {
  it('⭐ response bị áp TRỄ (overlay khoảnh khắc) ⇒ đồng hồ vẫn trừ phần đã trôi', () => {
    /*
     * Kịch bản prod 08/08: POST /rounds trả đồng hồ ĐẦY (25s) nhưng state bị
     * giữ 9 giây cho overlay diễn. Bản cũ lấy mốc lúc effect chạy ⇒ hiện 25s
     * trong khi server chỉ còn 16 — người chơi tin con số đó và mất lượt.
     * `nhanLuc` là lúc NHẬN, nên dù render muộn 9s vẫn phải hiện 16s.
     */
    render(<DongHoVong conLaiS={25} tongS={25} hetGio={false}
      nhanLuc={Date.now() - 9_000} />);
    expect(screen.getByText('16s')).toBeInTheDocument();
    expect(screen.queryByText('25s'), 'hiện số ĐẦY là nói dối lên 9 giây')
      .not.toBeInTheDocument();
  });

  it('hai vòng liên tiếp CÙNG thời lượng ⇒ mốc mới vẫn reset đếm (bẫy 27/07)', () => {
    /*
     * Bẫy cũ: dep `[conLaiS]` không đổi khi 25s → 25s nên đồng hồ đứng chết ở
     * HẾT GIỜ của vòng trước — từng phải vá bằng `key={st.vong}` ở nơi gọi.
     * Nay `nhanLuc` đổi theo TỪNG response nên effect buộc chạy lại. Test này
     * canh đúng chỗ đó: gỡ `nhanLuc` khỏi dep của effect là đỏ ngay.
     */
    vi.useFakeTimers();
    try {
      const { rerender } = render(
        <DongHoVong conLaiS={25} tongS={25} hetGio={false} nhanLuc={Date.now()} />);
      act(() => { vi.advanceTimersByTime(24_000); });
      expect(screen.getByText('1s')).toBeInTheDocument();
      // Vòng mới, cùng thời lượng: chỉ khác mốc nhận.
      rerender(
        <DongHoVong conLaiS={25} tongS={25} hetGio={false} nhanLuc={Date.now()} />);
      act(() => { vi.advanceTimersByTime(300); });
      expect(screen.getByText('25s'), 'mốc mới mà không reset = đồng hồ vòng cũ')
        .toBeInTheDocument();
    } finally {
      vi.useRealTimers();
    }
  });
});

// ══════════════════════════ D38 — TỰ NỘP KHI QUÁ HẠN ══════════════════════

describe('D38 — tự nộp khi quá hạn (đấu bot không ai đẩy trận hộ)', () => {
  /*
   * Lỗi founder gặp trên prod 27/07: *"hết vòng 1 nó đ** thèm tự lật"*. Server
   * chỉ cưỡng chế hạn KHI CÓ REQUEST TỚI (C4) — đấu bot thì không ai khác gửi
   * request hộ, nên client phải bấm chuông sau khi đồng hồ chạm 0.
   *
   * Hai vế cùng quan trọng:
   *  · TRƯỚC mốc 0 + ân hạn: KHÔNG được tự nộp — nộp sớm là server áp body như
   *    một lượt thường, mất cờ `tu_dong`, log ghi "cố ý giữ" cho người hết giờ
   *    (điểm chạm A1 của D38, events append-only không sửa lại được).
   *  · SAU mốc đó: PHẢI nộp — không thì trận đứng im vĩnh viễn.
   */
  /*
   * 22/08 — ĐẢO VẾ THỨ NHẤT (founder: *"đếm xong không lật bài tiếp theo"*). Đo
   * trên stack: HẾT GIỜ ở giây 50, vòng mới ở giây 60 — mười giây đứng im mỗi
   * vòng vì client tự chờ hết ân hạn. Nay client nộp NGAY sau mốc 0 kèm cờ
   * `tu_dong: true`, và SERVER là bên quyết (soi đồng hồ của nó: qua mốc ⇒ dán
   * cờ hết giờ, chưa ⇒ 409 `chua_het_gio`). Cờ dữ liệu A1 vẫn do server đặt.
   */
  it('chạm 0 ⇒ client TỰ POST /rounds trong ~1s, thân mang `tu_dong: true` và KHÔNG mang lệnh', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    try {
      const calls = moBan({
        dong_ho: { con_lai_s: 0, tong_s: 25, het_gio: false, an_han_s: 8 },
      });
      renderAt('/arena/tran/m-dh');
      await screen.findByText(/còn \d+ ô/);

      const cuNop = () => calls.find((c) => c.method === 'POST' && c.url.includes('/rounds'));
      await act(async () => { await vi.advanceTimersByTimeAsync(2_500); });
      const nop = cuNop();
      expect(nop, 'chạm 0 mà còn bắt chờ 10s là màn đứng im "HẾT GIỜ" — lỗi 22/08').toBeTruthy();
      const body = nop!.body as Record<string, unknown>;
      expect(body.tu_dong, 'không có cờ thì server áp thân như lượt thường trong ân hạn — mất cờ hết giờ (A1)').toBe(true);
      expect(body.lenh ?? []).toEqual([]);
      expect(body.hanh_dong).toBe('giu_vi_the');
    } finally {
      vi.useRealTimers();
    }
  });

  it('còn 5s ⇒ KHÔNG nộp trước mốc 0 (tự nộp sớm là cướp lượt đang cân nhắc)', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    try {
      const calls = moBan({
        dong_ho: { con_lai_s: 5, tong_s: 25, het_gio: false, an_han_s: 8 },
      });
      renderAt('/arena/tran/m-dh');
      await screen.findByText(/còn \d+ ô/);
      const daNop = () => calls.some((c) => c.method === 'POST' && c.url.includes('/rounds'));
      await act(async () => { await vi.advanceTimersByTimeAsync(3_000); });
      expect(daNop()).toBe(false);
      await act(async () => { await vi.advanceTimersByTimeAsync(4_000); });
      expect(daNop(), 'qua mốc 0 + 1s đệm mà chưa nộp thì trận đứng im').toBe(true);
    } finally {
      vi.useRealTimers();
    }
  });

  it('trận KHÔNG có đồng hồ (trận cũ) ⇒ không bao giờ tự nộp', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    try {
      const calls = moBan({ dong_ho: undefined });
      renderAt('/arena/tran/m-dh');
      await screen.findByText(/còn \d+ ô/);
      await act(async () => { await vi.advanceTimersByTimeAsync(60_000); });
      // Bịa hạn cho trận không có hạn là tự ý chốt vòng của người ta.
      expect(calls.some((c) => c.method === 'POST' && c.url.includes('/rounds')))
        .toBe(false);
    } finally {
      vi.useRealTimers();
    }
  });
});

// ══════════════════ CHỐNG CỨNG ĐƠ — 409 phải có đường về ══════════════════

describe('nộp lỗi → đồng bộ lại từ server (founder báo cứng đơ 28/07)', () => {
  /*
   * ⚠ D412 — hạn RIÊNG 15 s cho bài này: `waitFor` bên dưới chờ 5 s, đúng bằng hạn mặc định của vitest, nên khi bài đỏ
   * thì hạn của BÀI hết trước ⇒ chỉ còn câu "Test timed out in 5000ms" và ba thông điệp chẩn đoán trong `waitFor` không
   * bao giờ hiện ra. Đỏ 22/09 → 26/09 đúng như thế: câu thật là "nút CHỐT VÒNG vẫn mờ" (khoá D379 không nhả).
   * (D416 nâng hạn mặc định cả bộ web lên 15 s; hạn riêng ở đây giữ lại để bài không phụ thuộc cấu hình chung.)
   */
  it('POST /rounds 409 sai_vong ⇒ màn TỰ nhảy về vòng server đang đứng, nút sống lại', { timeout: 15_000 }, async () => {
    /*
     * Ca đơ tái hiện được: cú TỰ NỘP hết giờ và cú bấm tay đua nhau — kẻ thua
     * nhận 409 `sai_vong`. Trước bản vá, client kẹt ở vòng cũ và MỌI cú nộp
     * sau đều 409 vĩnh viễn: trận tiến ở server, màn đứng im. Lối về duy nhất
     * đúng C4 là hỏi lại server.
     *
     * stubFetch khớp theo THỨ TỰ KHAI BÁO và path GET của trận là TIỀN TỐ của
     * path POST /rounds — nên /rounds phải khai TRƯỚC. GET trả VÒNG 4 (server
     * đã tiến), khác vòng 3 client đang đứng.
     */
    const calls = stubFetch([
      ['/auth/me', { status: 200, body: ME_ONBOARDED }],
      ['/holdem/catalog', { status: 200, body: CATALOG }],
      ['/holdem/art', { status: 200, body: { version: 'holdem-test-dh', art: {} } }],
      ['/holdem/matches/m-dh/luot',
        { status: 200, body: { cho_ban: null, xong_vong: true, nhat_ky: [] } }],
      ['/holdem/matches/m-dh/rounds', {
        status: 409,
        body: { error: 'sai_vong', message: 'Vòng này đã chốt rồi.' },
      }],
      ['/holdem/matches/m-dh', {
        status: 200,
        body: tran({ vong: 4, dong_ho: { con_lai_s: 25, tong_s: 25, het_gio: false, an_han_s: 8 } }),
      }],
    ]);
    renderAt('/arena/tran/m-dh');
    await screen.findByText(/còn \d+ ô/);

    const nut = screen.getByRole('button', { name: /CHỐT VÒNG/ });
    fireEvent.click(nut);

    /*
     * Assertion PHÂN BIỆT ĐƯỢC: bản cũ (không onError) cũng cho nút sống lại
     * (isPending tự tắt) — cái nó KHÔNG làm là hỏi lại server. Nên phải chứng
     * minh có một cú GET trạng thái ĐỨNG SAU cú POST bị 409 trong dòng request.
     */
    await vi.waitFor(() => {
      const viTriPost = calls.findIndex(
        (c) => c.method === 'POST' && c.url.includes('/rounds'));
      expect(viTriPost, 'phải có cú POST bị 409').toBeGreaterThanOrEqual(0);
      const getSau = calls.slice(viTriPost + 1).some(
        (c) => c.method === 'GET' && /\/holdem\/matches\/m-dh$/.test(c.url));
      expect(getSau, '409 mà không hỏi lại server = kẹt vòng cũ vĩnh viễn').toBe(true);
      expect(screen.getByRole('button', { name: /CHỐT VÒNG/ }),
        'D412 — cú nộp hỏng mà khoá D379 không nhả ⇒ nút mờ vĩnh viễn, bàn đứng im').not.toBeDisabled();
    }, { timeout: 5000 });
  });
});

/*
 * ═════ D379 · D412 — MỘT VÒNG CHỐT ĐÚNG MỘT LẦN, và cú HỎNG không được khoá vòng ═════
 *
 * D412 đổi vòng đời khoá `vongDaChot` (nhả khi nộp HỎNG). Bài 409 ngay trên và `su_co_khai.test.tsx` canh vế "hỏng
 * thì nhả"; bài này canh vế còn lại — khoá vẫn đặt CỨNG ở tay cầm, TRƯỚC `mutate` (D379), trước khi có bất kỳ response nào. Hai cú bấm liền nhau là
 * đúng ca founder báo 22/09 (*"được chốt vòng tận 2 lần"*, nút trên bàn VÀ nút trong shop). Bài đo được KHOÁ chứ không
 * đo nút mờ: react-query báo `isPending` qua `setTimeout(0)`, nên giữa hai `fireEvent.click` đồng bộ màn CHƯA vẽ lại,
 * nút vẫn sáng, và thứ duy nhất chặn cú thứ hai là dòng `if (vongDaChot.current === st.vong) return`.
 */
describe('D379 · D412 — khoá chốt-một-lần', () => {
  // Hạn riêng 15 s — cùng lý do bài 409 ở trên: `waitFor` 5 s không được trùng hạn bài.
  it('bấm CHỐT VÒNG hai lần liền ⇒ đúng MỘT cú POST /rounds', { timeout: 15_000 }, async () => {
    const calls = moBan();
    renderAt('/arena/tran/m-dh');
    await screen.findByText(/còn \d+ ô/);
    const post = () => calls.filter((c) => c.method === 'POST' && c.url.includes('/rounds')).length;
    const nut = screen.getByRole('button', { name: /CHỐT VÒNG/ });
    fireEvent.click(nut);
    fireEvent.click(nut);
    await vi.waitFor(() => expect(post()).toBeGreaterThanOrEqual(1), { timeout: 5000 });
    // Cho cú thứ hai (nếu có) đủ chỗ rời máy rồi mới đếm.
    await act(async () => { await new Promise((r) => setTimeout(r, 300)); });
    expect(post(), 'vòng chốt hai lần — khoá D379 không còn chặn ở tay cầm').toBe(1);
  });
});
