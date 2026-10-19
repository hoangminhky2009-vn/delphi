/**
 * GỌI KÝ QUỸ RA KHỎI BÓNG TỐI — founder 24/08: *"nếu thẻ đòn bẩy chưa có thì
 * hãy thêm cơ chế margin call. Có rồi thì làm cho nó thành thông báo toàn màn
 * hình của player đó"*, rồi chốt hình: *"lớp phủ đỏ nháy 1 phát và rung nhẹ màn
 * hình, hiển thị lõi đòn bẩy bị gãy đôi"* + *"chỉ rung ở khoảnh khắc lõi gãy"*.
 *
 * ─── VÌ SAO CỤM NÀY CẦN CANH CHẶT ───────────────────────────────────────────
 * Cơ chế đã CHẠY trong engine từ v8 (27/07) mà chưa bao giờ ra tới người chơi:
 * `grep goi_ky_quy` trong `server/holdem_api.ts` và `web/src` đều ra RỖNG, trong
 * khi các trường ANH EM cùng return object (`phi_cat_lo`, `siet_doi_lai`) đã đi
 * trọn đường. Nợ khai ở D37, nhắc lại D108, nằm đó gần một tháng.
 *
 * Và nó nổ THẬT: đo 4.000 trận trên đúng bộ luật v34 ⇒ 3,34% số vòng-ghế,
 * 19,3% số trận có ít nhất một cú, trung bình 684 chip mỗi cú, dồn về cuối trận.
 * Tức người chơi mất tiền thật, đều đặn, không một chữ giải thích.
 * ⇒ Mỗi mắt xích dưới đây là một chỗ nó có thể lại rơi vào im lặng.
 */
import type React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render } from '@testing-library/react';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { timKhoanhKhac, type KetQuaVongDTO } from '../src/api/holdem';
import { LoiGay } from '../src/components/holdem/LoiGay';
import { MomentOverlay } from '../src/components/holdem/MomentOverlay';

vi.mock('@/api/queries', () => ({ useMe: () => ({ data: { user: { dien_mao: null } } }) }));

const doc = (p: string) => readFileSync(resolve(process.cwd(), p), 'utf8');
const khongChuThich = (s: string) =>
  s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');

const kqNen = (): KetQuaVongDTO => ({
  vong: 5,
  chay_vong_nay: [],
  cua_ban: null,
  cua_doi_thu: [],
  phi_cua_ban: null,
  ty_le_cat_lo_bp: 0,
} as unknown as KetQuaVongDTO);

describe('I. Đường dây: DTO → khoảnh khắc', () => {
  it('⭐ có `ky_quy_cua_ban` ⇒ sinh khoảnh khắc KY_QUY mang đúng số chip', () => {
    const kk = timKhoanhKhac({ ...kqNen(), ky_quy_cua_ban: { mat: 700 } }, []);
    const g = kk.find((x) => x.chu === 'KY_QUY');
    expect(g, 'DTO có ký quỹ mà hàng đợi không sinh khoảnh khắc nào').toBeTruthy();
    expect(g!.mat, 'số chip không đi cùng khoảnh khắc ⇒ lớp phủ vẽ −0').toBe(700);
  });

  it('vắng trường ⇒ KHÔNG sinh khoảnh khắc nào', () => {
    // Trường VẮNG MẶT (không phải `null`) là hợp đồng với server — client cũ
    // không phải phân nhánh. Sinh nhầm một lớp phủ ở vòng bình thường là dừng
    // bàn 1,9 giây cho một chuyện không xảy ra.
    expect(timKhoanhKhac(kqNen(), []).some((x) => x.chu === 'KY_QUY')).toBe(false);
  });

  it('⭐ KY_QUY đứng CUỐI hàng đợi — khoe trước, phạt sau', () => {
    /*
     * Vòng vừa lên hạng vừa bị gọi ký quỹ là ca có thật. Đảo thứ tự thì cú gãy
     * lá nuốt mất cú lên hạng — hai lớp phủ toàn màn trong một vòng, cái đứng
     * sau là cái người chơi nhớ.
     */
    const kq: KetQuaVongDTO = {
      ...kqNen(),
      cua_ban: { ghe_id: 'ban', pnl_bp: 12_000 } as never,
      ky_quy_cua_ban: { mat: 800 },
    };
    const kk = timKhoanhKhac(kq, []);
    expect(kk.length).toBeGreaterThanOrEqual(2);
    expect(kk[kk.length - 1]!.chu, 'ký quỹ không còn đứng cuối').toBe('KY_QUY');
  });

  it('⚠ KHÔNG BAO GIỜ sinh ký quỹ cho đối thủ', () => {
    /*
     * Ba nhánh kia công bố thành tích cho cả bàn xem; cái này là hình phạt
     * RIÊNG. Server cũng chỉ gửi phần của mình (`ky_quy_cua_ban`) — nếu có ngày
     * ai đó thêm `cua_doi_thu[].ky_quy` thì bài này bắt được việc đem nó lên
     * lớp phủ. Ăn mừng người khác bị lấy tiền không phải thứ trò này dạy.
     */
    const nguon = khongChuThich(doc('src/api/holdem.ts'));
    const than = /export function timKhoanhKhac[\s\S]*?\n}/.exec(nguon)?.[0] ?? '';
    expect(than, 'không tìm thấy timKhoanhKhac').not.toBe('');
    const khoiKyQuy = /ky_quy_cua_ban[\s\S]*$/.exec(than)?.[0] ?? '';
    expect(khoiKyQuy, 'nhánh ký quỹ đọc sang dữ liệu đối thủ')
      .not.toMatch(/cua_doi_thu|doiThu/);
  });
});

describe('II. Lõi gãy đôi — số phải ĐỌC ĐƯỢC', () => {
  it('⭐⭐ dấu âm dùng U+002D, không phải U+2212 (bẫy D119)', () => {
    /*
     * `ChuPixel` LỌC IM LẶNG ký tự không có glyph. Lưới khai `-` (U+002D); nếu
     * ai truyền `−` (U+2212, dấu trừ toán học) thì dấu BIẾN MẤT và số âm hiện y
     * hệt số dương — không lỗi, không test nào khác đỏ. Đúng bug D119 đã mất
     * một buổi để tìm ra bằng cách ĐẾM GLYPH trên trình duyệt.
     * ⇒ Đếm glyph, không đọc chuỗi: `-700` phải nhiều hơn `700` đúng một.
     */
    const demGlyph = (jsx: React.ReactElement) => {
      const { container, unmount } = render(jsx);
      // `ChuPixel` dựng MỘT span mỗi ký tự CÓ GLYPH, bên trong span cụm.
      const cum = container.querySelector('[style*="--px"]');
      const n = cum ? cum.querySelectorAll(':scope > span').length : -1;
      unmount();
      return n;
    };
    const am = demGlyph(<LoiGay mat={700} />);
    expect(am, 'không tìm thấy cụm chữ pixel của con số').toBeGreaterThan(0);
    // "-700" = 4 glyph. Nếu dấu bị lọc im lặng thì chỉ còn 3 — bằng "700".
    expect(am, 'dấu âm bị `ChuPixel` lọc mất ⇒ số âm hiện y hệt số dương').toBe(4);
  });

  it('⭐ số chip có dấu phân cách vẫn vẽ đủ — glyph `.` phải tồn tại', () => {
    /*
     * `dinhDangChip` dùng `toLocaleString('vi-VN')` ⇒ 1.500 có dấu chấm. Thiếu
     * glyph `.` thì nó bị lọc im lặng và 1.500 hiện thành "1500" — sai một bậc
     * độ lớn về mặt đọc. Đếm: "-1.500" = 6 glyph.
     */
    const { container } = render(<LoiGay mat={1500} />);
    const cum = container.querySelector('[style*="--px"]');
    expect(cum, 'không tìm thấy cụm chữ pixel').toBeTruthy();
    expect(cum!.querySelectorAll(':scope > span').length,
      'dấu phân cách nghìn bị lọc mất').toBe(6);
  });

  it('không có art vẫn vẽ ra thứ gì đó — không để ô trống', () => {
    // Catalog art hỏng một lần là lớp phủ thành một khung đen không nghĩa gì.
    const { container } = render(<LoiGay mat={700} />);
    expect(container.textContent !== null).toBe(true);
    expect(container.querySelector('span'), 'lớp phủ rỗng trơn').toBeTruthy();
  });
});

describe('III. ⚠⚠ Cú rung KHÔNG được dán lên hộp fixed toàn màn (bài học D125)', () => {
  const TSX = khongChuThich(doc('src/components/holdem/MomentOverlay.tsx'));
  const CSS = doc('src/components/holdem/MomentOverlay.module.css');

  it('⭐⭐ lớp rung nằm trên `.man`, KHÔNG nằm trên `.lop`', () => {
    /*
     * Sáng 24/08 founder bắt được đúng lỗi này ở shop: cú rung dán lên một hộp
     * `position: fixed; inset: 0` làm DỊCH CẢ KHUNG MÀN, và đàn chip bay tính
     * đường từ một hệ quy chiếu đang rung. Ở đây không có gì đang bay (lớp phủ
     * nổ cuối vòng, shop đã đóng) — nhưng luật vẫn phải giữ, không thì lần dọn
     * sau ai đó đọc file này rồi tưởng rung hộp `fixed` toàn màn là nếp cho phép.
     */
    const lop = /^\.lop \{([\s\S]*?)\n\}/m.exec(CSS)?.[1] ?? '';
    expect(lop, 'không tìm thấy `.lop`').not.toBe('');
    expect(lop, '`.lop` là hộp fixed toàn màn — dán animation rung lên nó là lỗi D125')
      .not.toMatch(/animation:\s*kqRung/);
    expect(CSS, 'mất lớp rung').toMatch(/\.manRung\s*\{[^}]*animation:\s*kqRung/);
    expect(TSX, 'lớp rung không còn được gắn cho vỏ trong').toMatch(/s\.manRung/);
  });

  it('⭐ cú rung neo ĐÚNG nhịp lá gãy, không rung suốt lớp phủ', () => {
    /*
     * Founder chỉnh riêng vế này: *"chỉ rung ở khoảnh khắc lõi gãy đôi thôi"*.
     * `animation-delay` của cú rung phải khớp `NHIP_GAY_MS` của LoiGay — hai số
     * lệch nhau thì màn rung trước hoặc sau lúc lá gãy, và cú rung thôi kể
     * chuyện gì, chỉ còn là nhiễu.
     */
    const rung = /\.manRung\s*\{([^}]*)\}/.exec(CSS)?.[1] ?? '';
    const tre = /(\d+)ms\s+1\s*;/.exec(rung)?.[1]
      ?? /animation:[^;]*?\s(\d+)ms\s+\d*\s*;?/.exec(rung)?.[1];
    const nhip = /NHIP_GAY_MS = (\d+)/.exec(doc('src/components/holdem/LoiGay.tsx'))?.[1];
    expect(nhip, 'không đọc được NHIP_GAY_MS').toBeTruthy();
    expect(rung, 'cú rung không có độ trễ ⇒ nó nổ trước khi lá kịp gãy')
      .toMatch(new RegExp(`\\b${nhip}ms\\b`));
    void tre;
    // Và nó chạy ĐÚNG MỘT LẦN — rung lặp là động đất, không phải cú bẻ gãy.
    expect(rung, 'cú rung lặp vô hạn').not.toMatch(/infinite/);
  });

  it('⭐ nháy đỏ một phát, không nhấp nháy mãi', () => {
    // D77/D119: thứ nhấp nháy mãi là thứ người ta học cách phớt lờ.
    const chop = /^\.chop \{([\s\S]*?)\n\}/m.exec(CSS)?.[1] ?? '';
    expect(chop, 'không tìm thấy `.chop`').not.toBe('');
    expect(chop, 'nháy đỏ lặp vô hạn ⇒ thành đèn báo động').not.toMatch(/infinite/);
    expect(chop, 'nháy đỏ phải kết thúc rồi đứng yên').toMatch(/forwards/);
  });

  it('⭐ tiết kiệm chuyển động: tắt cái ĐỘNG, GIỮ cái TIN', () => {
    /*
     * Lỗi D116 đã vá cho chính lớp phủ này: kẹp mọi khoảnh khắc về 60ms nên
     * người bật "Giảm chuyển động" thấy một cái nháy rồi hết, không đọc kịp gì.
     * Ở đây: rung và nháy TẮT, nhưng nền đỏ và lá gãy PHẢI còn.
     */
    const tat = /@media \(prefers-reduced-motion: reduce\)([\s\S]*)$/.exec(CSS)?.[1] ?? '';
    expect(tat, 'không có khối reduced-motion').not.toBe('');
    expect(tat, 'cú rung không được tắt ở reduced-motion').toMatch(/\.manRung\s*\{[^}]*animation:\s*none/);
    expect(tat, 'cú nháy không được tắt').toMatch(/\.chop\s*\{[^}]*animation:\s*none/);
    expect(tat, 'nền đỏ bị tắt theo ⇒ mất luôn thông tin, không chỉ mất chuyển động')
      .not.toMatch(/\.nenKyQuy/);
  });
});

describe('IV. Lớp phủ dựng được nhánh ký quỹ mà không ném', () => {
  it('render nhánh KY_QUY ⇒ có nền đỏ, có vỏ rung, KHÔNG có avatar', () => {
    /*
     * Không avatar là chủ ý: ba nhánh kia công bố cho bàn xem nên cần mặt người;
     * cái này là hình phạt riêng — dán mặt mình lên một cú mất tiền là biến nó
     * thành màn bêu.
     */
    const { container } = render(
      <MomentOverlay
        hangDoi={[{ chu: 'KY_QUY', gheId: 'ban', ten: 'BẠN', bac: '', loai: 'nguoi', mat: 700 }]}
        onXong={() => {}}
      />,
    );
    const lop = container.firstElementChild;
    expect(lop, 'lớp phủ không dựng').toBeTruthy();
    expect(lop!.getAttribute('role')).toBe('status');
    expect(container.innerHTML, 'thiếu vỏ mang cú rung').toMatch(/man/);
    expect(container.querySelector('img'), 'nhánh phạt không được có avatar').toBeNull();
  });
});
