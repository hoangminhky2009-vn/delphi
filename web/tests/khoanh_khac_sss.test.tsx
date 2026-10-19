/**
 * KHOẢNH KHẮC HẠNG — lớp phủ toàn màn đổi chủ từ ALL-IN sang thang phong cách
 * (founder 22/08: *"thay bằng hiện toàn màn hình SSS khi player đạt điểm SSS.
 * Và nhớ là cho chữ nó sống động tý chứ ko phải text cứng"* → *"S và SS cũng
 * hiện nhé nhưng mà không dài, ngầu và nhiều hiệu ứng bằng SSS thôi"*).
 *
 * Canh những thứ là LUẬT chứ không phải gu:
 *   · CHẠM mới nổ, ĐANG Ở thì không — giữ hạng qua nhiều vòng không được che
 *     màn mỗi vòng (chính là cách ALL-IN cũ thành thuế);
 *   · chỉ ba mốc TRÒN S/SS/SSS, nấc ± không nổ;
 *   · chỉ nổ khi ĐI LÊN — tụt hạng mà ăn mừng là khen nhầm một cú thua;
 *   · ALL-IN không còn sinh khoảnh khắc nào, ở BẤT KỲ tỷ lệ cam kết nào;
 *   · ×2 vẫn sống, và nay KHÔNG còn bị nhánh all-in che (bản cũ dùng else-if
 *     nên ai all-in rồi nhân đôi thì cú nhân đôi im lặng);
 *   · chữ là GLYPH PIXEL vẽ tay (§XI), không phải font hệ thống — và phân bậc
 *     phải thấy được: số glyph tăng theo hạng.
 */
import { describe, expect, it, vi } from 'vitest';
import { render } from '@testing-library/react';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { MomentOverlay } from '../src/components/holdem/MomentOverlay';
import {
  HANG_DINH, MOC_CONG_BO, khoanhKhacHang, timKhoanhKhac, vuaChamMocCongBo,
  type KetQuaVongDTO, type KhoanhKhac,
} from '../src/api/holdem';

vi.mock('@/api/queries', () => ({ useMe: () => ({ data: { user: { dien_mao: null } } }) }));

describe('vuaChamMocCongBo — CHẠM mốc, đi LÊN, và chỉ ba mốc tròn', () => {
  it('leo tới từng mốc ⇒ nổ đúng mốc đó', () => {
    expect(vuaChamMocCongBo('S-', 'S')).toBe('S');
    expect(vuaChamMocCongBo('S+', 'SS')).toBe('SS');
    expect(vuaChamMocCongBo('SS', 'SSS')).toBe('SSS');
    expect(vuaChamMocCongBo(undefined, 'S')).toBe('S');
  });

  it('đang ở mốc và vẫn ở đó ⇒ KHÔNG nổ lại', () => {
    for (const m of MOC_CONG_BO) expect(vuaChamMocCongBo(m, m)).toBeNull();
  });

  it('nấc ± KHÔNG nổ — chỉ mốc tròn', () => {
    expect(vuaChamMocCongBo('S', 'S+')).toBeNull();
    expect(vuaChamMocCongBo('A+', 'S-')).toBeNull();
    expect(vuaChamMocCongBo('B', 'B+')).toBeNull();
  });

  it('TỤT hạng thì im — ăn mừng lúc thua là khen nhầm khoảnh khắc', () => {
    expect(vuaChamMocCongBo('SSS', 'SS')).toBeNull();
    expect(vuaChamMocCongBo('SS', 'S')).toBeNull();
    expect(vuaChamMocCongBo('SSS', undefined)).toBeNull();
  });

  it('⭐ hàm này CHỈ so với hạng NGAY TRƯỚC — cửa chặn "nổ ngược bậc" nằm ở caller', () => {
    /*
     * Ghi ra vì đây là ranh giới dễ hiểu nhầm nhất của cụm: `S` sau khi tụt từ
     * `SS` xuống `A` là một cú ĐI LÊN hợp lệ theo hàm này, và ĐÚNG như vậy —
     * hàm chỉ biết hai hạng nó được đưa. Thứ biết "đỉnh đã đạt" là màn trận.
     */
    expect(vuaChamMocCongBo('A', 'S')).toBe('S');
  });
});

describe('⭐ Không nổ NGƯỢC BẬC — chặn theo ĐỈNH đã công bố', () => {
  /*
   * Bản đầu của màn trận giữ một `Set` các mốc đã nổ, nên chuỗi
   *     SS (nổ) → tụt xuống A → leo lại S
   * cho ra mốc `S` hợp lệ và `Set` chưa có `S` ⇒ lớp phủ TOÀN MÀN ăn mừng một
   * mốc THẤP HƠN đỉnh vừa đạt. Người chơi vừa tụt khỏi SS mà màn hình chúc mừng
   * như một thành tựu mới — cùng lớp lỗi mà D113 đã chặn cho cú TỤT, chỉ khác
   * là nó lọt qua cửa này.
   *
   * Đây là bài THUẦN trên đúng luật caller đang chạy; phần nối dây khoá riêng ở
   * bài dưới bằng cách đọc mã nguồn.
   */
  const chuoi = (hangs: (string | undefined)[]) => {
    let dinh = -1;
    const no: string[] = [];
    for (let i = 1; i < hangs.length; i += 1) {
      const m = vuaChamMocCongBo(hangs[i - 1], hangs[i]);
      const bac = m ? MOC_CONG_BO.indexOf(m) : -1;
      if (m !== null && bac > dinh) { dinh = bac; no.push(m); }
    }
    return no;
  };

  it('leo thẳng S → SS → SSS ⇒ nổ cả ba', () => {
    expect(chuoi(['A+', 'S', 'S+', 'SS', 'SSS'])).toEqual(['S', 'SS', 'SSS']);
  });

  it('⭐ tụt khỏi SS rồi leo lại S ⇒ IM', () => {
    expect(chuoi(['S+', 'SS', 'A', 'A+', 'S'])).toEqual(['SS']);
  });

  it('tụt khỏi SSS rồi leo lại SS ⇒ IM, nhưng leo tiếp lên SSS thì KHÔNG', () => {
    expect(chuoi(['SS', 'SSS', 'A', 'S', 'SS'])).toEqual(['SSS']);
  });
});

describe('nối dây: màn trận chặn bằng ĐỈNH, không bằng TẬP', () => {
  it('⭐ không còn `Set` nào giữ mốc đã nổ', () => {
    const man = readFileSync(
      resolve(process.cwd(), 'src/screens/holdem/AlphaDraftMatch.tsx'), 'utf8',
    );
    expect(man, 'quay lại `Set` là dựng lại đúng cú nổ ngược bậc')
      .not.toMatch(/mocDaNo/);
    expect(man).toContain('dinhDaNo');
    expect(man).toMatch(/bacMoc > dinhDaNo\.current/);
    // Và nó phải được đặt lại khi đổi trận — xem chú thích tại chỗ.
    expect(man).toMatch(/dinhDaNo\.current = -1/);
  });
});

/** Ghế tối thiểu cho `timKhoanhKhac` — chỉ các trường hàm đó đọc. */
const ghe = (over: Partial<{
  von_truoc: number; von_sau: number; cam_ket: number; pnl_bp: number;
}> = {}) => ({
  ghe_id: 'ban', pnl_bp: 0, chain: [],
  von_truoc: 10_000, von_sau: 10_000, cam_ket: 0,
  ...over,
} as unknown as NonNullable<KetQuaVongDTO['cua_ban']>);

describe('timKhoanhKhac — ×2 đo bằng NAV, không bằng tiền mặt', () => {
  const kq = (cuaBan: NonNullable<KetQuaVongDTO['cua_ban']>) =>
    ({ cua_ban: cuaBan, cua_doi_thu: [] } as unknown as KetQuaVongDTO);

  it('cam kết 100% vốn ⇒ KHÔNG sinh khoảnh khắc nào (ALL-IN đã rời lớp phủ)', () => {
    expect(timKhoanhKhac(kq(ghe({ cam_ket: 10_000 })), [])).toEqual([]);
  });

  it('cam kết 99,7% (mốc từng lọt lưới so-bằng-tuyệt-đối) ⇒ vẫn KHÔNG sinh', () => {
    expect(timKhoanhKhac(kq(ghe({ cam_ket: 9_970 })), [])).toEqual([]);
  });

  it('NAV nhân đôi ⇒ sinh ×2', () => {
    expect(timKhoanhKhac(kq(ghe({ pnl_bp: 10_000 })), []).map((k) => k.chu))
      .toEqual(['×2']);
  });

  it('⭐⭐ TIỀN MẶT nhân đôi mà NAV thì không ⇒ IM', () => {
    /*
     * Đây là cách hỏng THẬT, và bài cũ khoá đúng chiều ngược lại nên nó giữ
     * nguyên cái sai. `von_truoc`/`von_sau` đều là TIỀN MẶT: cái trước chụp SAU
     * khi lệnh mua đã áp (tiền lẻ chưa tiêu), cái sau chụp SAU khi Quỹ vòng đổ
     * thẳng vào tiền mặt. Bot giữ đúng 500 tiền mặt, suất quỹ thường 1.000–4.000
     * ⇒ đo trên engine thật: nổ 1.208/14.394 ghế-vòng, và **0 lần** trong đó NAV
     * thật sự gấp đôi. 154 lần nổ ở vòng ĐANG LỖ.
     */
    const out = timKhoanhKhac(kq(ghe({ von_truoc: 500, von_sau: 5_087, pnl_bp: -1_550 })), []);
    expect(out, 'ăn mừng một vòng đang lỗ vì tiền mặt vừa được cộng suất quỹ')
      .toEqual([]);
  });

  it('vừa all-in VỪA nhân đôi NAV ⇒ ×2 hiện ra (bản cũ else-if nuốt mất)', () => {
    const out = timKhoanhKhac(kq(ghe({ cam_ket: 10_000, pnl_bp: 12_000 })), []);
    expect(out.map((k) => k.chu)).toEqual(['×2']);
  });

  it('⭐⭐ NHÃN PHẢI KHỚP NGƯỠNG — lãi to nhưng chưa gấp đôi thì KHÔNG được gọi là ×2', () => {
    /*
     * ⚠ BÀI NÀY ĐỔI TIỀN ĐỀ 24/08, KHÔNG PHẢI HỒI QUY. Bản cũ đòi `9_999 ⇒ im`
     * vì chỉ có MỘT bậc ở +100%. Founder: *"Đổi đi ko player lại bảo game lỗi"* —
     * đo trên bể bot THẬT (159.533 ghế-vòng) thì +100% nổ 0,06 lần/trận, tức MỘT
     * LẦN MỖI 17 TRẬN: một cú ăn mừng người chơi không bao giờ thấy thì đọc ra là
     * hỏng. Nay hai bậc, +50% ở 0,21 lần/trận (cùng nhịp lớp phủ ký quỹ).
     *
     * Thứ được canh KHÔNG đổi: cái nhãn phải ĐÚNG. Hạ ngưỡng mà giữ chữ "×2" là
     * để nhãn nói dối — D28 cấm, và nó sai IM LẶNG vì hoạt ảnh vẫn rất đẹp.
     */
    const gan = timKhoanhKhac(kq(ghe({ pnl_bp: 9_999 })), []);
    expect(gan.map((k) => k.chu), 'gần gấp đôi mà dán nhãn ×2 ⇒ nhãn nói dối')
      .toEqual(['+50%']);
    expect(timKhoanhKhac(kq(ghe({ pnl_bp: 10_000 })), []).map((k) => k.chu))
      .toEqual(['×2']);
  });

  it('⭐ dưới ngưỡng bậc VỪA ⇒ vẫn im hoàn toàn', () => {
    // Bậc dưới cùng vẫn phải có sàn, không thì mọi vòng lãi khá đều dừng bàn.
    expect(timKhoanhKhac(kq(ghe({ pnl_bp: 4_999 })), [])).toEqual([]);
  });

  it('⚠ hai bậc là LOẠI TRỪ NHAU — một vòng không sinh hai lớp phủ', () => {
    // `else if`: nhân đôi NAV thì chỉ nổ ×2, không kèm thêm một cú +50% nữa.
    expect(timKhoanhKhac(kq(ghe({ pnl_bp: 20_000 })), []).length).toBe(1);
  });
});

describe('MomentOverlay — chữ hạng là GLYPH PIXEL, và phân bậc thấy được', () => {
  // ⚠ Hàm này chỉ dựng ba nhánh CÓ CHỮ. Khoảnh khắc `KY_QUY` (24/08) vẽ một lá
  // gãy đôi chứ không vẽ chữ nào, nên nó có bộ bài riêng — xem `ky_quy.test.tsx`.
  const dung = (chu: Exclude<KhoanhKhac['chu'], 'KY_QUY' | '+50%'>) => {
    const kk: KhoanhKhac = chu === '×2'
      ? { chu, gheId: 'ban', ten: 'BẠN', bac: '', loai: 'nguoi' }
      : khoanhKhacHang(chu);
    return render(<MomentOverlay hangDoi={[kk]} onXong={() => {}} />);
  };

  /** Cụm chữ của một hạng — `role="img"` + nhãn, xem `ChuHang.tsx`. */
  const cum = (c: HTMLElement, hang: string) =>
    c.querySelector(`[aria-label="Hạng ${hang}"]`);

  it.each([['S', 1], ['SS', 2], ['SSS', 3]] as const)(
    'hạng %s ⇒ đúng %i glyph, mỗi glyph một pha riêng',
    (hang, soChu) => {
      const { container } = dung(hang);
      const vo = cum(container, hang);
      expect(vo).not.toBeNull();
      // Glyph = phần tử mang `--i` (pha riêng); vỏ và cụm không mang biến đó.
      const chu = [...vo!.querySelectorAll('span')]
        .filter((e) => (e as HTMLElement).style.getPropertyValue('--i') !== '') as HTMLElement[];
      expect(chu).toHaveLength(soChu);
      // Lệch pha: cùng `--i` thì cả cụm đáp xuống như một khối, mất hẳn cảm
      // giác "ba nhịp" — đó là điều kiện của cú công bố, không phải trang trí.
      expect(chu.map((e) => e.style.getPropertyValue('--i')))
        .toEqual(Array.from({ length: soChu }, (_, i) => String(i)));
    },
  );

  it('glyph vẽ bằng PIXEL (box-shadow), KHÔNG phải chữ trong font hệ thống', () => {
    const { container } = dung('SSS');
    const vo = cum(container, 'SSS')!;
    // Không một ký tự text nào trong cụm — có text nghĩa là ai đó quay lại font.
    expect(vo.textContent).toBe('');
    // Mỗi hàng pixel là một phần tử mang box-shadow dựng từ lưới glyph.
    const hang = [...vo.querySelectorAll('i')].filter((e) => e.style.boxShadow);
    expect(hang.length).toBeGreaterThan(10);
    expect(hang.some((e) => e.style.boxShadow.includes('currentColor'))).toBe(true);
  });

  it('đọc được không cần mắt: nhãn hạng + nhãn thành tích theo bậc', () => {
    expect(HANG_DINH).toBe('SSS');
    expect(dung('SSS').getByText('PHONG CÁCH ĐỈNH')).toBeTruthy();
    document.body.innerHTML = '';
    expect(dung('SS').getByText('PHONG CÁCH SIÊU HẠNG')).toBeTruthy();
    document.body.innerHTML = '';
    expect(dung('S').getByText('PHONG CÁCH HẠNG S')).toBeTruthy();
  });

  it('⭐⭐ ×2 nay VẼ BẰNG GLYPH PIXEL, không còn là text của font hệ điều hành', () => {
    /*
     * ⚠ BÀI NÀY LẬT CHIỀU 24/08. Bản cũ khoá *"×2 vẫn đi đường chữ cũ"* — mô tả
     * đúng hiện trạng lúc đó, nhưng hiện trạng đó là một chỗ §XI đang HỞ: chữ do
     * FONT HỆ ĐIỀU HÀNH vẽ nên người chơi thấy một màn khác màn người dựng kiểm.
     *
     * Hai lý do sửa cùng lượt với việc hạ ngưỡng, không phải tiện tay:
     *   · cả `×2` lẫn `+50%` vẽ được TRỌN VẸN bằng lưới sẵn có (`× 2 + 5 0 %`),
     *     nên đóng lỗ này không tốn một ô art nào;
     *   · bản cũ tô chữ bằng `background-clip: text` + gradient trên một phần tử
     *     ĐANG TRANSFORM — đúng thứ D113 ghi là VỠ TRÊN ANDROID. Nó chưa lộ vì
     *     cú này gần như không nổ; hạ ngưỡng là cho nó nổ gấp ~4 lần, tức biến
     *     một lỗi lý thuyết thành lỗi người chơi gặp.
     */
    const { container } = dung('×2');
    expect(cum(container, 'SSS'), 'không được nhầm sang cụm chữ HẠNG').toBeNull();
    const glyph = container.querySelector('[style*="--px"]');
    expect(glyph, '×2 vẫn là text — §XI vẫn hở ở đúng chỗ này').toBeTruthy();
    // `ChuPixel` vẽ từng ô, không đặt text ⇒ chuỗi không được nằm trong textContent.
    expect(glyph!.textContent, 'glyph pixel mà vẫn kèm text ⇒ hai bản vẽ chồng nhau')
      .toBe('');
    expect(glyph!.querySelectorAll(':scope > span').length,
      '`×2` phải ra đúng 2 glyph').toBe(2);
  });

  it('⭐ bậc +50% cũng đi đường glyph, và ra đủ 4 ô', () => {
    const kk: KhoanhKhac = { chu: '+50%', gheId: 'ban', ten: 'BẠN', bac: '', loai: 'nguoi' };
    const { container } = render(<MomentOverlay hangDoi={[kk]} onXong={() => {}} />);
    const glyph = container.querySelector('[style*="--px"]');
    expect(glyph, 'bậc +50% không dựng glyph').toBeTruthy();
    // `+ 5 0 %` = 4 glyph. Thiếu ⇒ có ký tự bị `ChuPixel` lọc IM LẶNG (bẫy D119).
    expect(glyph!.querySelectorAll(':scope > span').length,
      'một ký tự của "+50%" không có lưới và đã bị lọc im lặng').toBe(4);
  });
});
