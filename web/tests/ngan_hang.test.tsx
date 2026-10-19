/**
 * NGÂN HÀNG — SỔ TIẾT KIỆM (v43, D317), theo DEMO ĐÃ CHỐT (A11.25):
 * `docs/ui-ux/demo/ngan-hang-so-tiet-kiem.html`.
 *
 * ⚠ VÌ SAO BÀI NÀY TỒN TẠI, và nó CỐ Ý không kiểm "component render không lỗi":
 * cơ chế trước nó — CAM KẾT GIỮ — chạy đủ ở engine từ 27/07 và **0/167 trận prod**
 * từng dùng, vì panel chứa nó không bao giờ hiện. Loại hỏng đó không làm đỏ một bài
 * nào: code đúng, test đơn vị xanh, chỉ là người chơi không có đường bấm. Nên bài này
 * canh đúng những chỗ ĐÃ hỏng theo cách đó:
 *
 *   §I  vùng phải HIỆN đúng lúc, và phải NÓI LÝ DO khi không bấm được (thay vì
 *       biến mất — biến mất thì không ai biết nó tồn tại để quay lại).
 *   §II con số niêm yết phải là con số ENGINE sẽ dùng, không phải một phép nhân
 *       thứ hai viết ở client (C4/D61).
 *   §III cổng huỷ phải CHẶN, không phải cảnh báo rồi vẫn cho đi thẳng.
 */
import { describe, expect, it, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { NganHang, type LenhMoTietKiem } from '../src/components/holdem/NganHang';
import { laiMoiO, TIET_KIEM } from '@config/holdem';

/*
 * Báo giá server gửi cho vòng này (lãi nền 400) — KHÔNG tính lại trong bài.
 * Quy đổi ra đời thật, 1 ô = 6 tháng: 5,0 / 5,5 / 5,5 %/năm cho 12 / 18 / 24 tháng.
 */
const BAO_GIA = [
  { so_vong: 2, lai_bp: 250 },
  { so_vong: 3, lai_bp: 275 },
  { so_vong: 4, lai_bp: 275 },
];

const HOP_DONG = [
  { id: 'tk1_0', goc: 3000, so_vong: 4, vong_mo: 1, lai_bp: 275, lai_don: 164, con_vong: 1 },
  { id: 'tk2_0', goc: 800, so_vong: 2, vong_mo: 2, lai_bp: 250, lai_don: 18, con_vong: 0 },
];

function ve(over: Partial<Parameters<typeof NganHang>[0]> = {}) {
  const onChonMo = vi.fn<(l: LenhMoTietKiem | null) => void>();
  const onChonHuy = vi.fn<(ids: string[]) => void>();
  render(
    <NganHang
      tienMat={6200}
      hopDong={[]}
      baoGia={BAO_GIA}
      guiDuoc
      gocToiThieu={TIET_KIEM.GOC_TOI_THIEU}
      buocMocBp={500}
      chonMo={null}
      chonHuy={[]}
      onChonMo={onChonMo}
      onChonHuy={onChonHuy}
      {...over}
    />,
  );
  return { onChonMo, onChonHuy };
}

/** Bản dựng CÓ sổ + mọi khối mở sẵn — dùng để quét ký tự trên toàn cây. */
function ve2() {
  const r = render(
    <NganHang
      tienMat={2400}
      hopDong={HOP_DONG}
      baoGia={BAO_GIA}
      guiDuoc
      gocToiThieu={TIET_KIEM.GOC_TOI_THIEU}
      buocMocBp={500}
      chonMo={null}
      chonHuy={[]}
      onChonMo={() => {}}
      onChonHuy={() => {}}
    />,
  );
  fireEvent.click(screen.getByRole('button', { name: /SỔ 4Ô/ }));
  fireEvent.click(screen.getByRole('button', { name: /huỷ sớm mất hết lãi/ }));
  return r;
}

// ═══════════════════════════════════════════════════════════════════════════
describe('I. Vùng phải TÌM RA ĐƯỢC — lớp hỏng đã giết CAM KẾT GIỮ', () => {
  it('gửi được ⇒ ba mốc kỳ hạn hiện ra kèm LÃI BÁO của chính vòng này', () => {
    ve();
    for (const b of BAO_GIA) {
      expect(screen.getByRole('button', { name: new RegExp(`${b.so_vong}Ô`) })).toBeTruthy();
    }
    /*
     * ⭐ LÃI PHẢI HIỆN NGAY, không nằm sau cú bấm nào — nó là thứ DUY NHẤT để so
     * giữa ba mốc, và giấu nó là giấu chính thứ cần để chọn. Founder 09/09 dặn
     * gọn lại nhưng "vẫn đủ chức năng"; đây là ranh của chữ "đủ".
     */
    expect(screen.getByText('+2,50%')).toBeTruthy();
    expect(screen.getAllByText('+2,75%')).toHaveLength(2);
  });

  it('⭐ ĐƠN VỊ LÀ % — không phải ‱, và đây là một lỗi ĐÃ XẢY RA', () => {
    /*
     * Bản đầu in `+275‱/ô`. Founder đọc ra "lãi 275%, điên à" trong hai giây, và
     * đọc thế là ĐÚNG: `‱` không xuất hiện ở bất kỳ màn nào khác của app, nên
     * người chơi đọc nó bằng ký hiệu gần nhất mà họ biết. 275 bp = 2,75%/ô.
     */
    const { container } = ve2();
    expect(container.textContent).not.toContain('‱');
  });

  it('⭐ hết cửa gửi + không sổ nào ⇒ KHÔNG biến mất, mà nói RÕ LÝ DO', () => {
    /*
     * Biến mất hẳn là cách CAM KẾT GIỮ đã chết: người chơi không bao giờ biết vùng
     * này tồn tại, nên lần nó mở thật họ cũng không quay lại nhìn.
     */
    ve({ guiDuoc: false, baoGia: [], hopDong: [] });
    expect(screen.getByText(/không kỳ hạn nào kịp đáo hạn/i)).toBeTruthy();
  });

  it('hết cửa gửi NHƯNG còn sổ đang chạy ⇒ vẫn thấy sổ (tiền của mình, phải thấy)', () => {
    ve({ guiDuoc: false, baoGia: [], hopDong: HOP_DONG });
    expect(screen.getByRole('button', { name: /SỔ 4Ô/ })).toBeTruthy();
    expect(screen.getByRole('button', { name: /SỔ 2Ô/ })).toBeTruthy();
    // Không được mời gửi tiếp khi server nói không gửi được.
    expect(screen.queryByRole('button', { name: /CHỜ CHỐT VÒNG/ })).toBeNull();
  });

  it('sổ đáo hạn vòng này được ĐÁNH DẤU khác sổ còn hạn', () => {
    ve({ hopDong: HOP_DONG });
    expect(screen.getByText('ĐÁO HẠN')).toBeTruthy();
    expect(screen.getByText('còn 1v')).toBeTruthy();
  });

  it('⭐ MỘT DÒNG mỗi sổ — gốc và lãi treo thấy ngay, KHÔNG phải bấm', () => {
    /*
     * Ranh của "tiết lộ khi tương tác": thứ nói TIỀN ĐANG Ở ĐÂU phải thấy ngay.
     * Thứ giải thích (lãi suất của hợp đồng, vòng mở) mới nằm sau cú bấm.
     */
    ve({ hopDong: HOP_DONG });
    expect(screen.getByText('3.000')).toBeTruthy();
    expect(screen.getByText('+164')).toBeTruthy();
    expect(screen.queryByText(/mở vòng/)).toBeNull();
  });
});

// ═══════════════════════════════════════════════════════════════════════════
describe('I-b. TIẾT LỘ KHI TƯƠNG TÁC (founder 09/09 — gọn trong một khung hình)', () => {
  it('⭐ bấm dòng sổ ⇒ hiện lãi suất hợp đồng + nút HUỶ SỚM', () => {
    ve({ hopDong: HOP_DONG });
    expect(screen.queryByRole('button', { name: 'HUỶ SỚM' })).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: /SỔ 4Ô/ }));
    expect(screen.getByText(/mở vòng 1/)).toBeTruthy();
    expect(screen.getByText('+2,75%/ô')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'HUỶ SỚM' })).toBeTruthy();
  });

  it('dòng ⓘ gộp mọi lời giải thích — nhưng vẫn nói CÁI GIÁ khi chưa mở', () => {
    ve();
    // Chưa mở: dòng thu gọn phải giữ vế đắt nhất, không thì người chưa bấm
    // không hề biết huỷ sớm là mất trắng lãi.
    expect(screen.getByRole('button', { name: /huỷ sớm mất hết lãi/ })).toBeTruthy();
    expect(screen.queryByText(/không bị lạm phát ăn/)).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: /huỷ sớm mất hết lãi/ }));
    expect(screen.getByText(/không bị lạm phát ăn/)).toBeTruthy();
    expect(screen.getByText(/đóng cửa về cuối bàn/)).toBeTruthy();
  });
});

// ═══════════════════════════════════════════════════════════════════════════
describe('II. Số niêm yết = số engine dùng (C4/D61)', () => {
  it('⭐ "lãi mỗi ô" khớp `laiMoiO` — cùng hàm `chotPhien` cộng, không phải phép nhân thứ hai', () => {
    /*
     * ⚠ Bài này KHÔNG gõ lại một con số kết quả nào. Nó khẳng định QUAN HỆ: thứ trên
     * màn == thứ hàm chung trả về. Gõ "137" vào đây thì lúc ai đó đổi cách làm tròn,
     * bài đỏ mà không nói được bên nào sai.
     */
    ve({ tienMat: 6200 });
    const goc = Math.floor((6200 * 2500) / 10000);   // thanh trượt mặc định 25%
    // Dòng kết quả gộp ba mảnh, nên khớp bằng regex trên chính chuỗi đó.
    expect(screen.getByText(`+${laiMoiO(goc, BAO_GIA[0]!.lai_bp).toLocaleString('vi-VN')}/ô`))
      .toBeTruthy();
  });

  it('⭐ mốc mặc định là mốc NGẮN NHẤT — app không đẩy người chơi khoá lâu hơn', () => {
    /*
     * Một quyết định thiết kế, khoá lại vì nó dễ bị "sửa cho tiện" về sau. Ba lựa
     * chọn từng cân nhắc:
     *   · mốc TỐT NHẤT theo đo (3 ô) — app đang chọn hộ, và làm hỏng đúng thứ cơ
     *     chế sinh ra để tạo: một cân nhắc thật giữa lãi và thanh khoản;
     *   · KHÔNG chọn sẵn gì — tóm tắt trống, người chơi không có gì để so;
     *   · ⭐ mốc NGẮN NHẤT — mặc định CAM KẾT ÍT NHẤT. Ai muốn khoá lâu hơn phải
     *     bấm, tức phải nhìn bảng lãi trước. Lỡ tay thì thiệt hại nhỏ nhất.
     */
    ve();
    const ngan = Math.min(...BAO_GIA.map((b) => b.so_vong));
    const nut = screen.getByRole('button', { name: new RegExp(`${ngan}Ô`) });
    expect(nut.getAttribute('aria-pressed')).toBe('true');
  });

  it('gốc dưới mức tối thiểu ⇒ nút GỬI bị khoá và nói vì sao', () => {
    ve({ tienMat: 200 });   // 25% của 200 = 50 < GOC_TOI_THIEU 100
    expect(screen.getByText(/Gốc tối thiểu/)).toBeTruthy();
    expect(screen.getByRole('button', { name: /CHỜ CHỐT VÒNG/ }))
      .toHaveProperty('disabled', true);
  });

  it('⭐ đã chọn gửi thì LUÔN bỏ chọn được, kể cả khi gốc tụt dưới tối thiểu', () => {
    /*
     * Bẫy đã suýt để lại: nút khoá theo `!duGoc` ở CẢ HAI trạng thái. Người chơi
     * chọn gửi, rồi mua thêm một mã làm tiền mặt tụt — và không bỏ chọn được nữa,
     * trong khi lệnh vẫn sẽ đi kèm cú nộp vòng. Đường LÙI không bao giờ được khoá
     * theo cùng điều kiện với đường TIẾN.
     */
    const { onChonMo } = ve({ tienMat: 200, chonMo: { moc_bp: 2500, so_vong: 2 } });
    const nut = screen.getByRole('button', { name: /BỎ CHỌN GỬI/ });
    expect(nut).toHaveProperty('disabled', false);
    fireEvent.click(nut);
    expect(onChonMo).toHaveBeenCalledWith(null);
  });

  it('chọn kỳ hạn báo LÊN TRÊN đúng hình dạng `NopVongInput.tiet_kiem.mo`', () => {
    const { onChonMo } = ve();
    fireEvent.click(screen.getByRole('button', { name: /4Ô \+2,75%/ }));
    expect(onChonMo).toHaveBeenCalledWith({ moc_bp: 2500, so_vong: 4 });
  });
});

// ═══════════════════════════════════════════════════════════════════════════
describe('III. Cổng huỷ CHẶN, không chỉ cảnh báo', () => {
  it('⭐ bấm HUỶ KHÔNG huỷ ngay — phải qua thêm một nút nữa', () => {
    const { onChonHuy } = ve({ hopDong: HOP_DONG });
    fireEvent.click(screen.getByRole('button', { name: /SỔ 4Ô/ }));
    fireEvent.click(screen.getByRole('button', { name: 'HUỶ SỚM' }));
    // Cảnh báo chỉ để đọc là cảnh báo bị lướt qua (nếp PHÁ CAM KẾT).
    expect(onChonHuy).not.toHaveBeenCalled();
    expect(screen.getByRole('alertdialog')).toBeTruthy();
    // Cổng phải tự khai đang huỷ sổ NÀO — nó thay chỗ dòng sổ, và hai hợp đồng
    // có gốc gần bằng nhau thì con số một mình không đủ nhận diện.
    expect(screen.getByText(/HUỶ SỔ 4 Ô/)).toBeTruthy();
    // Và phải nói CÁI GIÁ bằng con số, không bằng tính từ.
    expect(screen.getByText(/164/)).toBeTruthy();

    fireEvent.click(screen.getByRole('button', { name: 'HUỶ THẬT' }));
    expect(onChonHuy).toHaveBeenCalledWith(['tk1_0']);
  });

  it('bấm THÔI đóng cổng và KHÔNG chọn huỷ gì', () => {
    const { onChonHuy } = ve({ hopDong: HOP_DONG });
    fireEvent.click(screen.getByRole('button', { name: /SỔ 4Ô/ }));
    fireEvent.click(screen.getByRole('button', { name: 'HUỶ SỚM' }));
    fireEvent.click(screen.getByRole('button', { name: 'THÔI' }));
    expect(onChonHuy).not.toHaveBeenCalled();
    expect(screen.queryByRole('alertdialog')).toBeNull();
  });

  it('đã chọn huỷ ⇒ đổi được ý mà không phải qua cổng lần nữa', () => {
    const { onChonHuy } = ve({ hopDong: HOP_DONG, chonHuy: ['tk1_0'] });
    fireEvent.click(screen.getByRole('button', { name: /SỔ 4Ô/ }));
    fireEvent.click(screen.getByRole('button', { name: 'BỎ CHỌN HUỶ' }));
    expect(onChonHuy).toHaveBeenCalledWith([]);
  });
});

// ═══════════════════════════════════════════════════════════════════════════
describe('IV. v54 (D405) — LUẬT SỔ đổi theo cờ trận `tiet_kiem_kinh_te`', () => {
  const moLo = () => fireEvent.click(screen.getByRole('button', { name: /huỷ sớm mất hết lãi/ }));
  const KINH_TE = { lam_phat: true, tha_noi: true, do_vo: { bao_hiem_toi_da: 5000, mat_bp: 2000 } };

  it('⭐ cả ba cờ: lãi THẢ NỔI · sổ CŨNG bị lạm phát ăn · câu đổ vỡ mang SỐ của server (5.000 · 20%)', () => {
    ve({ kinhTe: KINH_TE });
    expect(screen.getByRole('button', { name: /lãi thả nổi · huỷ sớm mất hết lãi/ })).toBeTruthy();
    moLo();
    expect(document.querySelector('[data-luat-so="tha_noi"]')!.textContent).toMatch(/thả nổi theo lãi suất nền/);
    expect(document.querySelector('[data-luat-so="lam_phat"]')!.textContent).toMatch(/cũng bị lạm phát ăn/);
    expect(document.querySelector('[data-luat-so="do_vo"]')!.textContent).toMatch(/vượt 5\.000 mất\s*20%/);
    expect(screen.queryByText(/không bị lạm phát ăn/), 'câu cũ nói dối khi cờ lạm phát bật').toBeNull();
    expect(screen.queryByText(/chốt lúc gửi/), 'câu cũ nói dối khi cờ thả nổi bật').toBeNull();
    expect(screen.getByText(/gốc còn lại vẫn về ví/)).toBeTruthy();
  });

  it('từng cờ đổi ĐÚNG câu của nó: chỉ thả nổi ⇒ câu lạm phát giữ nguyên, không có câu đổ vỡ', () => {
    ve({ kinhTe: { lam_phat: false, tha_noi: true, do_vo: null } });
    moLo();
    expect(document.querySelector('[data-luat-so="tha_noi"]')).not.toBeNull();
    expect(screen.getByText(/không bị lạm phát ăn/)).toBeTruthy();
    expect(document.querySelector('[data-luat-so="do_vo"]')).toBeNull();
  });

  it('vế ngược — VẮNG cờ (trận v53 prod): bốn câu cũ nguyên văn, không câu mới nào', () => {
    ve();
    expect(screen.getByRole('button', { name: /lãi chốt lúc gửi · huỷ sớm mất hết lãi/ })).toBeTruthy();
    moLo();
    expect(screen.getByText(/không bị lạm phát ăn/)).toBeTruthy();
    expect(screen.getByText(/gốc vẫn về đủ/)).toBeTruthy();
    expect(document.querySelectorAll('[data-luat-so]').length).toBe(0);
  });
});

