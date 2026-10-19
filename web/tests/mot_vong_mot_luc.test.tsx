/**
 * D376 — MÀN CHỈ ĐƯỢC NÓI VỀ MỘT VÒNG MỘT LÚC.
 *
 * ─── CA THẬT ────────────────────────────────────────────────────────────────
 * Founder, ba lần: *"Round này đoán kịch bản, thẻ round sau lật lên là biết mình
 * đoán đúng hay sai chứ sao lại hiện kết quả của round trước?"* Ảnh gửi kèm cho
 * thấy đúng cái làm nó khó chịu: **"ORACLE · VÒNG 5/12" nằm ngay cạnh "+29,7%"
 * của vòng 4.** Hai con số vòng trên một màn hình.
 *
 * Gốc: `apDung` gọi `setSt(tt)` và `setKetQuaCho(tt)` cùng một nhịp, mà `tt` đã là
 * trạng thái vòng SAU — nên mọi nhãn đọc `st.vong` nhảy trước khi người chơi kịp
 * đọc kết quả.
 *
 * ⚠ D374 đã chữa NHẦM CHỖ: thêm dòng "KẾT QUẢ VÒNG 4" lên tấm, tức viết chú thích
 * cho mâu thuẫn thay vì bỏ mâu thuẫn. Bài này canh cú chữa đúng.
 *
 * ─── VÌ SAO KHÔNG BỊA MỘT CỜ MỚI ────────────────────────────────────────────
 * Server ĐÃ có `pha='doc'` (M2/D90) — `XEM_KET_QUA_S` giây đầu của mọi vòng ≥ 2,
 * nghĩa đúng là *"đang đọc kết quả vòng trước"*. Quãng ấy nằm TRONG ngân sách giây
 * của vòng nên nó tự hết; một cờ client tự giữ thì phải tự dựng lưới an toàn, và
 * lưới ấy là chỗ để trượt. Bài này vì thế canh cả hai đầu: trong pha ĐỌC thì đóng
 * băng, hết pha ĐỌC thì thôi.
 */
import { describe, expect, it } from 'vitest';
import { screen } from '@testing-library/react';
import { ME_ONBOARDED, renderAt, stubFetch } from './helpers';

const CATALOG = {
  engine_version: 'holdem-test-v',
  balance_version: 'balance-test',
  /*
   * ⚠ `luat` + `quyet_dinh` + `nhip_chon_bai` KHÔNG PHẢI trang trí: màn trận đọc thẳng
   * `c.quyet_dinh.MAN_TAP_MIEN_GIO_DEN_VONG`, nên catalog thiếu chúng thì màn NỔ chứ không
   * phải render thiếu một nhãn — và ranh giới ấy rất dễ đọc nhầm thành "bài hỏng".
   */
  luat: {
    SEATS: 5, START_VON: 10000, CAM_KET_NEN: 500, MAX_TAI_SAN: 4, MAX_CHIEN_THUAT: 2,
    SHOP_TAI_SAN: 3, SHOP_CHIEN_THUAT: 2, CHI_PHI_KHAO_SAT_LAI: 2, TRAN_TANG_CAM_KET_BP: 4000,
    PHI_BANG_DIEN_TU: 25,
  },
  /*
   * ⚠ CỐ Ý cho vòng 4 và vòng 5 KHÁC loại (index 3 = `tai_san` ⇒ "CHỢ", index 4 =
   * `chien_thuat` ⇒ "LÕI"). Hai vòng trùng loại thì nhãn ra y hệt nhau dù đọc vòng
   * nào — vế I-d khi ấy xanh mà không đo gì, đúng kiểu bài rỗng.
   */
  nhip_chon_bai: ['tai_san', 'tai_san', 'chien_thuat', 'tai_san', 'chien_thuat', 'chien_thuat', 'khong', 'khong'],
  cap_stack_bp: [10000, 16000, 20000],
  quyet_dinh: { MAP_SIZE: 12, SHOWDOWN_MODEL: 'A', MAN_TAP_MIEN_GIO_DEN_VONG: 4 },
  tai_san: [{ id: 'btc', label: 'Crypto', icon: '◈', nhom: 'rui_ro', thanh_khoan: 'mong', bien_dong_bp: 400 }],
  chien_thuat: [],
  giai_doan: [{ id: 'di_ngang', label: 'Đứng im', icon: '➖' }],
  su_kien: [],
  tu_dien: { tai_san: {}, chien_thuat: {} },
  khau_vi: [],
};

/**
 * Trận ở VÒNG 5, mang kết quả của VÒNG 4 — đúng khoảnh khắc ảnh founder chụp.
 * `doc_s` = quãng ĐỌC; `con_lai_s` quyết định đang ở pha nào:
 *   · còn 21/25 ⇒ mới trôi 4 giây < doc_s 15 ⇒ pha ĐỌC;
 *   · còn  5/25 ⇒ đã trôi 20 giây > doc_s 15 ⇒ pha QUYẾT.
 */
const tran = (conLaiS: number) => ({
  match_id: 'm-v',
  vong: 5,
  tong_vong: 12,
  status: 'dang_choi',
  dong_ho: { con_lai_s: conLaiS, tong_s: 25, doc_s: 15, pha: 'doc', het_gio: false, an_han_s: 8 },
  ban: {
    von: 9000, luot_khao_sat: 1, danh_muc: { tai_san: [], chien_thuat: [] },
    da_chay: false, tu_the: 'choi', vong_roi: null,
    so_lan_cat_lo: 0, con_lai_cat_lo: 1, khau_vi: 'can_bang', fx: 'binh_thuong',
  },
  doi_thu: [],
  so_nguoi_song: 1,
  o_hien_tai: { kind: 'giai_doan', giai_doan: 'di_ngang' },
  lich_su_o: [{ kind: 'giai_doan', giai_doan: 'di_ngang' }],
  telegraph: null,
  bo_bai_con_lai: { con_lai: 8, so_giai_doan: 6, so_su_kien: 2, tin_gia_ky_vong: 1 },
  quy_vong_hien_tai: 500,
  shop: null,
  loi_von: null,
  ket_qua_vong: {
    vong: 4,
    /*
     * ⚠ `nav_truoc` là ĐIỀU KIỆN để màn dựng lại `ketQuaCho` sau khi nạp trang
     * (mẫu số đi kèm tử số — D123). Thiếu nó thì không có kết quả nào để đóng băng,
     * và bài sẽ đỏ vì một lý do chẳng liên quan gì tới D376.
     */
    nav_truoc: 9000,
    o: { kind: 'giai_doan', giai_doan: 'di_ngang' },
    tin_gia_lo: null, quy_vong: 500, ghe_thang: 'ban', chay_vong_nay: [],
    cua_ban: null, cua_doi_thu: [], phi_cua_ban: null, ty_le_cat_lo_bp: 0,
  },
});

/** Vào BÀN TẬP (`?tap=1`) — đó là nơi nhãn ORACLE·VÒNG tồn tại, và là nơi founder đang chơi. */
function moBanTap(conLaiS: number): void {
  stubFetch([
    ['/auth/me', { status: 200, body: ME_ONBOARDED }],
    ['/holdem/catalog', { status: 200, body: CATALOG }],
    ['/holdem/art', { status: 200, body: { version: 'holdem-test-v', art: {} } }],
    ['/holdem/matches/m-v/luot',
      { status: 200, body: { cho_ban: null, xong_vong: true, nhat_ky: [] } }],
    ['/holdem/matches/m-v', { status: 200, body: tran(conLaiS) }],
  ]);
  renderAt('/arena/tran/m-v?tap=1');
}

/** Nhãn Oracle: "ORACLE · VÒNG n/12". Trả n, hoặc null nếu không có nhãn. */
async function vongTrenNhan(): Promise<number | null> {
  /*
   * ⚠ timeout 4s như mọi bài coach khác: trợ lý gõ chữ 28ms/2 ký tự và chỉ dựng sau khi
   * catalog + art về. Dùng timeout mặc định 1s thì bài đỏ vì HỤT GIỜ chứ không vì sai —
   * đúng lớp "bài đỏ ở waitFor chưa phải chẩn đoán".
   */
  const el = await screen.findByText(
    (_, e) => /ORACLE · VÒNG \d+\/\d+/.test(e?.textContent ?? '') && e?.children.length === 0,
    {}, { timeout: 4000 });
  const m = /VÒNG (\d+)\//.exec(el.textContent ?? '');
  return m ? Number(m[1]) : null;
}

describe('I. ⭐⭐ trong pha ĐỌC, cả màn nói vòng VỪA ĐÓNG', () => {
  it('kết quả vòng 4 đang hiện ⇒ nhãn nói VÒNG 4, không nói VÒNG 5', async () => {
    moBanTap(21); // trôi 4s < doc_s 15 ⇒ pha ĐỌC
    expect(
      await vongTrenNhan(),
      'nhãn nhảy sang vòng kế trong khi tấm còn báo vòng trước ⇒ hai con số vòng trên một màn',
    ).toBe(4);
  });
});

describe('I-b. ⭐⭐ CON SỐ TO cạnh đồng hồ cũng phải theo — nó mới là thứ mắt đọc trước', () => {
  /*
   * Bản chốt của founder mở đầu bằng đúng dòng này: "VÒNG 4/12 ← đồng hồ". Sửa mỗi nhãn
   * Oracle thì màn VẪN nói hai con số vòng, chỉ là đổi chỗ cái mâu thuẫn — nên vế này
   * đứng riêng, không gộp vào vế nhãn.
   */
  it('trong pha ĐỌC, số vòng ở đầu bàn nói 4', async () => {
    moBanTap(21);
    await vongTrenNhan(); // chờ màn dựng xong
    const el = document.querySelector('[data-vong-man]');
    expect(el, 'không tìm thấy số vòng ở đầu bàn').toBeTruthy();
    expect(el!.textContent, 'số to nói vòng kế trong khi tấm báo vòng trước').toBe('4');
  });

  it('I-d ⭐ NHÃN LOẠI VÒNG cạnh số cũng theo — hai thứ nói hai vòng là tự cãi trong một hàng', async () => {
    /*
     * Chú thích ngay trên khối ấy trong mã nguồn đã tự nói: *"vòng mấy" và "vòng này làm gì"
     * là MỘT câu hỏi*. Để số nói 4 còn nhãn tả vòng 5 là tự cãi nhau trong đúng một hàng chữ.
     * Fixture cho vòng 4 = CHỢ, vòng 5 = LÕI nên hai vế phân biệt được (xem chú thích fixture).
     */
    moBanTap(21);
    await vongTrenNhan();
    const el = document.querySelector('[data-loai-vong]');
    expect(el, 'mất nhãn loại vòng').toBeTruthy();
    expect(el!.textContent, 'nhãn đang tả vòng 5 trong khi số nói vòng 4').toBe('CHỢ');
  });

  it('(tiêm ngược) sang pha QUYẾT ⇒ nhãn tả vòng 5', async () => {
    moBanTap(5);
    await vongTrenNhan();
    expect(document.querySelector('[data-loai-vong]')!.textContent).toBe('LÕI');
  });

  it('(tiêm ngược) sang pha QUYẾT thì số to nói 5', async () => {
    moBanTap(5);
    await vongTrenNhan();
    expect(document.querySelector('[data-vong-man]')!.textContent).toBe('5');
  });
});

describe('I-c. "VÒNG 4" chỉ TRUNG THỰC khi mặt đồng hồ đồng thời nói ĐỌC', () => {
  /*
   * ⚠⚠ ĐÂY LÀ VẾ GIỮ CHO CÚ SỬA NÀY KHÔNG THÀNH MỘT LỜI NÓI DỐI MỚI.
   * Giây đang đếm LÀ của vòng 5 — server mở đồng hồ vòng sau ngay lúc chốt
   * (`vong_mo_luc = now()`). Cái làm "VÒNG 4" đọc ra đúng là chữ ĐỌC ngay cạnh:
   * cặp "VÒNG 4 · ĐỌC" nghĩa là *đang đọc kết quả vòng 4*, không phải *vòng 4 còn 21 giây*.
   * Gỡ nhãn ĐỌC khỏi mặt đồng hồ (hoặc thôi truyền `pha`) mà giữ số đóng băng thì màn
   * quay lại nói dối, chỉ theo chiều ngược — nên vế này phải đứng cùng chỗ với vế số.
   */
  it('pha ĐỌC ⇒ số nói 4 VÀ mặt đồng hồ nói ĐỌC, cùng một màn', async () => {
    moBanTap(21);
    await vongTrenNhan();
    expect(document.querySelector('[data-vong-man]')!.textContent).toBe('4');
    expect(
      screen.getAllByText('ĐỌC').length,
      'số đóng băng ở vòng 4 mà mặt đồng hồ không khai đang ở pha ĐỌC ⇒ "VÒNG 4 còn 21 giây" là sai',
    ).toBeGreaterThan(0);
  });
});

describe('II. hết pha ĐỌC thì thôi đóng băng — tự hết, không cần bấm gì', () => {
  it('cùng trận ấy nhưng đã sang pha QUYẾT ⇒ nhãn nói VÒNG 5', async () => {
    moBanTap(5); // trôi 20s > doc_s 15 ⇒ pha QUYẾT
    expect(
      await vongTrenNhan(),
      'đóng băng mãi thì người chơi đang ở vòng 5 mà màn vẫn nói vòng 4 — đổi một lời nói dối lấy một lời nói dối',
    ).toBe(5);
  });
});

describe('III. (tiêm ngược) không có kết quả nào thì không có gì để đóng băng', () => {
  it('trận không mang `ket_qua_vong` ⇒ nhãn nói đúng vòng đang chơi', async () => {
    const t = tran(21) as Record<string, unknown>;
    delete t.ket_qua_vong;
    stubFetch([
      ['/auth/me', { status: 200, body: ME_ONBOARDED }],
      ['/holdem/catalog', { status: 200, body: CATALOG }],
      ['/holdem/art', { status: 200, body: { version: 'holdem-test-v', art: {} } }],
      ['/holdem/matches/m-v/luot',
        { status: 200, body: { cho_ban: null, xong_vong: true, nhat_ky: [] } }],
      ['/holdem/matches/m-v', { status: 200, body: t }],
    ]);
    renderAt('/arena/tran/m-v?tap=1');
    expect(await vongTrenNhan()).toBe(5);
  });
});
