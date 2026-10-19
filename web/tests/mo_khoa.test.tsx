/**
 * MỞ KHOÁ THEO TRẬN XONG — phía client (D86; thi công 17/08) — VIẾT LẠI 11/10 cho sảnh BENTO (SPEC `alpha-draft-tang-khong-gian` mục 6).
 *   · nút cỡ bàn chưa mở: KHÔNG ẩn — nhưng D307 (08/09) đã bỏ khoá cỡ bàn ⇒ mọi cỡ bấm được, không chữ "còn N trận";
 *   · ⚠ KHẨU VỊ RỦI RO ĐÃ BỊ FOUNDER XOÁ (11/10, SPEC mục 6: *"thi công KHÔNG đưa khẩu vị vào lớp trượt chế độ"*) ⇒ các bài D307 về khẩu vị
 *     (khoá "còn N trận", nút Quyết liệt, mô tả khẩu vị) đổi thành bài NGƯỢC: dù catalog còn trả danh sách `khau_vi` và tiến độ nói "chưa mở",
 *     sảnh KHÔNG vẽ khối KHẨU VỊ nào. Bài canh cũ canh một UI nay không còn — giữ nguyên nó là đòi sảnh vẽ lại thứ founder vừa xoá;
 *   · đã mở ⇒ không còn chữ "còn … trận";
 *   · API chưa trả lời (đang tải / API cũ) ⇒ MỞ HẾT, không khoá nhầm.
 * Cài đặt nay nằm trong LỚP TRƯỢT mở bằng ô ĐẤU VỚI MÁY (không còn xổ dưới thẻ).
 */
import { describe, expect, it } from 'vitest';
import { screen, waitFor } from '@testing-library/react';
import { ME_ONBOARDED, renderAt, stubFetch } from './helpers';

const CATALOG = {
  engine_version: 'x', balance_version: 'x',
  luat: { SEATS: 5, START_VON: 10000, MAX_TAI_SAN: 4, MAX_CHIEN_THUAT: 2 },
  nhip_chon_bai: [], cap_stack_bp: [10000],
  quyet_dinh: { MAP_SIZE: 8, CO_MAP_CHON: [8, 12, 16], MO_KHOA: { CO_MAP: { 12: 3, 16: 8 }, KHAU_VI: 5 } },
  tai_san: [], chien_thuat: [], giai_doan: [], su_kien: [], tu_dien: { tai_san: {}, chien_thuat: {} },
  khau_vi: [
    { id: 'can_bang', label: 'Cân bằng', he_so_bp: 10000, mo_ta: 'mô tả cân bằng' },
    { id: 'quyet_liet', label: 'Quyết liệt', he_so_bp: 13000, mo_ta: 'mô tả quyết liệt' },
  ],
};
const NEN = (tienDo: unknown) => [
  ['/auth/me', { status: 200, body: ME_ONBOARDED }],
  ['/holdem/catalog', { status: 200, body: CATALOG }],
  ['/holdem/me/matches', { status: 200, body: { tran: [] } }],
  ['/holdem/me/tien-do', tienDo],
  ['/holdem/ngay', { status: 200, body: {
    ma: 'q7p2z', so_o: 12, het_han: '2026-08-18T17:00:00Z', created_at: 'x', loai: 'ngay',
    chu: 'DELPHI', la_chu: false, so_nguoi: 0, toi: null, toi_da_xong: false, doi: [],
    thu_thach: { ngay: '2026-08-17', so_nguoi_vao: 0, so_nguoi_xong: 0 },
  } }],
] as [string, any][];

const nutCoBan = (ten: RegExp) => screen.getAllByRole('button').find((b) => ten.test(b.textContent ?? ''));
/** Mở lớp cài đặt ĐẤU VỚI MÁY (ô đầu tiên trong bốn ô chế độ). */
const moLopMay = async () => { (await screen.findByText(/ĐẤU VỚI MÁY/)).click(); };

describe('sảnh — mở khoá theo trận xong', () => {
  it('D307 — người mới (0 trận): KHÔNG cỡ bàn nào khoá; ⚠ và KHÔNG khối khẩu vị (founder xoá 11/10) dù catalog còn danh sách', async () => {
    stubFetch(NEN({ status: 200, body: { so_tran_xong: 0, co_map: [8, 12, 16], khau_vi: false, con_thieu: { khau_vi: 3 } } }));
    renderAt('/arena');
    await moLopMay();
    await waitFor(() => expect(nutCoBan(/NHANH/)).toBeTruthy());
    for (const co of [/NHANH/, /CHUẨN/, /DÀI/]) expect(nutCoBan(co)).not.toBeDisabled();
    // Không nút cỡ bàn nào còn đếm ngược trận.
    expect(nutCoBan(/CHUẨN/)!.textContent).not.toMatch(/còn \d+ trận/);
    expect(nutCoBan(/DÀI/)!.textContent).not.toMatch(/còn \d+ trận/);
    // Khẩu vị: không khối, không nút, không câu "chơi xong N trận nữa là mở chọn".
    expect(screen.queryByText(/KHẨU VỊ RỦI RO/)).toBeNull();
    expect(nutCoBan(/Quyết liệt/)).toBeUndefined();
    expect(nutCoBan(/^Cân bằng/)).toBeUndefined();
    expect(screen.queryByText(/chơi xong \d+ trận nữa là mở chọn/)).toBeNull();
    expect(screen.queryByText(/Năm trận đầu/)).toBeNull();
  });

  it('đã mở hết (xong 12 trận): không nút nào khoá, không chữ "còn … trận", vẫn không khẩu vị', async () => {
    stubFetch(NEN({ status: 200, body: { so_tran_xong: 12, co_map: [8, 12, 16], khau_vi: true, con_thieu: {} } }));
    renderAt('/arena');
    await moLopMay();
    await waitFor(() => expect(nutCoBan(/DÀI/)).toBeTruthy());
    expect(nutCoBan(/DÀI/)).not.toBeDisabled();
    expect(screen.queryByText(/còn \d+ trận/)).toBeNull();
    expect(screen.queryByText(/KHẨU VỊ RỦI RO/)).toBeNull();
    expect(screen.queryByText('mô tả cân bằng')).toBeNull();
  });

  /*
   * D406 — v54 mặc định: server phát `CO_MAP_CHON = [16]` + `khau_vi_tat` ⇒ sảnh KHÔNG vẽ khối cỡ bàn (một lựa chọn không phải lựa chọn).
   * Nút VÀO BÀN vẫn dựng đúng bàn 16 server phát. (Bảng `khau_vi` VẪN có trong catalog — Bách khoa đọc.)
   */
  it('⭐ D406 — catalog v54 (một cỡ + khẩu vị tắt): không khối CỠ BÀN, vào bàn ra bàn 16', async () => {
    const v54 = {
      ...CATALOG,
      quyet_dinh: { ...CATALOG.quyet_dinh, CO_MAP_CHON: [16], MAP_MAC_DINH_SANH: 16 },
      khau_vi_tat: true,
    };
    stubFetch([
      ...NEN({ status: 200, body: { so_tran_xong: 0, co_map: [8, 12, 16], khau_vi: false, con_thieu: { khau_vi: 3 } } })
        .filter(([u]) => u !== '/holdem/catalog'),
      ['/holdem/catalog', { status: 200, body: v54 }],
    ]);
    renderAt('/arena');
    await moLopMay();
    const vao = await screen.findByRole('button', { name: /^▶ VÀO BÀN$/ });
    expect(screen.queryByText(/CỠ BÀN/)).toBeNull();
    expect(screen.queryByText(/KHẨU VỊ RỦI RO/)).toBeNull();
    expect(nutCoBan(/Quyết liệt/)).toBeUndefined();
    expect(screen.queryByText(/còn \d+ trận/)).toBeNull();
    vao.click();
    expect(await screen.findByText(/· 16 ô/)).toBeInTheDocument();
  });

  it('⚠ D406 vế ngược — catalog CÒN nhiều cỡ: khối CỠ BÀN vẫn vẽ (bài trên không xanh vì sảnh gãy); khẩu vị thì KHÔNG (đã xoá)', async () => {
    stubFetch(NEN({ status: 200, body: { so_tran_xong: 3, co_map: [8, 12, 16], khau_vi: true, con_thieu: {} } }));
    renderAt('/arena');
    await moLopMay();
    expect(await screen.findByText(/CỠ BÀN/)).toBeInTheDocument();
    expect(screen.queryByText(/KHẨU VỊ RỦI RO/)).toBeNull();
  });

  it('⚠ API tiến độ hỏng ⇒ MỞ HẾT (thà ăn 403 có câu tử tế còn hơn khoá nhầm)', async () => {
    stubFetch(NEN({ status: 500, body: { error: 'x', message: 'x' } }));
    renderAt('/arena');
    await moLopMay();
    await waitFor(() => expect(nutCoBan(/DÀI/)).toBeTruthy());
    expect(nutCoBan(/DÀI/)).not.toBeDisabled();
  });
});
