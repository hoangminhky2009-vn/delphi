/**
 * MỘT VÒNG, MỘT CON SỐ (D114) — bịt đúng những lỗ mà đợt rà 23/08 tìm ra.
 *
 * ⚠ VÌ SAO FILE NÀY TỒN TẠI: sau khi D114 lên, `grep` toàn bộ `web/tests/` ra
 * **0 dòng** chạm `SoNhipVong` / `nhipVong` / `moLyDo`. Suite 626 bài vẫn xanh
 * trong khi con số đầu màn đang nói SAI DẤU ở 15–40% số vòng và nút "VÌ SAO"
 * thì chết ở đúng ba ca quan trọng nhất. Một vùng không có bài test nào là một
 * vùng không ai canh — và nó im lặng đúng bằng số bài xanh của phần còn lại.
 *
 * Hai tầng, vì hai lớp lỗi khác nhau:
 *   §I  ĐƠN VỊ — hành vi của chính con số (ba trạng thái, nhãn, không % kèm).
 *   §II CANH CẢ LỚP — đọc thẳng mã nguồn màn trận, vì phần hỏng nặng nhất nằm ở
 *       chỗ NỐI DÂY chứ không nằm trong component nào (lặp lại bài học D93/D103:
 *       hàm đúng, docstring đúng, caller cấp sai đầu vào).
 */
import { describe, it, expect, vi } from 'vitest';
import { act, render, screen, fireEvent } from '@testing-library/react';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { SoNhipVong } from '@/components/holdem/SoNhipVong';
import { TayBai } from '@/components/holdem/TayBai';

const doc = (p: string) => readFileSync(resolve(process.cwd(), p), 'utf8');
const MAN = doc('src/screens/holdem/AlphaDraftMatch.tsx');

/**
 * Bóc chú thích trước khi quét MÃ.
 *
 * ⚠ Không phải dọn dẹp cho đẹp: bài "cấm đọc `nav_sau`" bắt ngay chính đoạn chú
 * thích GIẢI THÍCH vì sao cấm — tức nó đỏ với bản ĐÚNG. Một bài báo động giả sẽ
 * bị người sau tắt đi, và lúc đó nó thôi canh gì (D79). Cùng tiền lệ với
 * `gate_dung_map` của D87.
 */
const bocChuThich = (s: string) =>
  s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');

describe('I. Con số — ba trạng thái, không phải hai', () => {
  const dung = (delta: number) =>
    render(<SoNhipVong delta={delta} goc={10000} vong={3} dangMo={false} onCham={() => {}} />);

  it('lãi ⇒ nhãn nói "lãi" kèm % (mẫu số 10.000)', () => {
    dung(704);
    expect(screen.getByRole('button').getAttribute('aria-label')).toMatch(/lãi 7\.0%/);
  });

  it('lỗ ⇒ nhãn nói "lỗ" kèm %', () => {
    dung(-770);
    expect(screen.getByRole('button').getAttribute('aria-label')).toMatch(/lỗ 7\.7%/);
  });

  it('⭐ HOÀ là trạng thái RIÊNG — không được đọc thành lãi', () => {
    /*
     * Bản đầu viết `delta >= 0` nên vòng huề vốn ra "▲ 0" kèm quầng xanh ăn
     * mừng, trong khi thanh lăng kính — đọc CÙNG một nguồn — đứng im. Hai chỗ
     * cùng nguồn nói hai điều là đúng thứ chú thích "MỘT NGUỒN" dựng ra để chặn.
     */
    const { container } = dung(0);
    const nut = screen.getByRole('button');
    expect(nut.getAttribute('aria-label')).toMatch(/hoà/i);
    expect(nut.getAttribute('aria-label')).not.toMatch(/lãi|lỗ/);
    expect(container.textContent).not.toContain('▲');
    expect(container.textContent).not.toContain('▼');
  });

  it('⭐ % suy từ ĐÚNG mẫu số của tử số, KHÔNG phải `pnl_bp`', () => {
    /*
     * ⚠ 24/08 — BÀI NÀY ĐỔI THƯỚC, KHÔNG ĐỔI ĐIỀU ĐƯỢC CANH.
     *
     * Bản trước cấm ký tự `%` xuất hiện cạnh con số chip, vì lúc ấy nguồn %
     * DUY NHẤT là `pnl_bp` — thước XẾP HẠNG, chốt TRƯỚC khi chia Quỹ vòng, lệch
     * DẤU với cú đổi ví ở 22–41% số vòng (đo trên engine thật). Hai mẫu số một
     * chỗ chính là bệnh D114 dỡ đi.
     * Founder 23/08 chốt con số ĐỔI HẲN sang %. Thứ nguy hiểm không phải ký tự
     * `%` mà là MẪU SỐ, nên bài canh đúng cái mẫu số: % phải là `delta/goc`,
     * với `goc` do cha truyền xuống cùng tử số — cùng một đại lượng, theo cấu
     * trúc chứ không phải theo hai bản cài đặt trông nhau (D61).
     */
    const nguon = doc('src/components/holdem/SoNhipVong.tsx');
    expect(nguon, 'con số lại đọc thước xếp hạng').not.toMatch(/pnl_bp|pctBp/);
    expect(bocChuThich(nguon), '% không suy từ `goc` cha truyền')
      .toMatch(/delta\s*\/\s*goc/);

    // Và số hiện ra phải KHỚP phép chia đó, không phải một con số gần đúng.
    const { container } = render(
      <SoNhipVong delta={-1523} goc={10000} vong={3} dangMo={false} onCham={() => {}} />,
    );
    expect(screen.getByRole('button').getAttribute('aria-label')).toMatch(/lỗ 15\.2%/);
    // D443 — số đi bằng font app: đọc được thẳng trong textContent, đúng phép chia.
    expect(container.textContent).toBe('-15,2%');
  });

  it('⚠ mẫu số 0 (ghế cháy sạch) ⇒ không in Infinity/NaN', () => {
    render(<SoNhipVong delta={-500} goc={0} vong={3} dangMo={false} onCham={() => {}} />);
    const nhan = screen.getByRole('button').getAttribute('aria-label') ?? '';
    expect(nhan).not.toMatch(/Infinity|NaN/);
  });
});

describe('I bis. Con số là PIXEL, và nó MỜI CHẠM cho tới khi được chạm', () => {
  const dung = (over: Partial<{ delta: number; gap: boolean; vong: number }> = {}) =>
    render(
      <SoNhipVong
        delta={over.delta ?? 704}
        goc={10000}
        vong={over.vong ?? 3}
        dangMo={false}
        onCham={() => {}}
        {...(over.gap ? { gap: true } : {})}
      />,
    );

  it('⭐ D443 — số đi bằng FONT APP (một font cho cả màn), không vẽ lại bằng lưới `ChuPixel`', () => {
    /*
     * Founder 23/08 *"đổi số thành pixel"* là lúc chữ app còn là font VECTOR; từ D182 font app là Handjet (pixel, tự
     * host) nên "pixel" đã có sẵn trong chữ. Founder 28/09: *"phải đồng bộ font chữ đi chứ bro. nhìn thiếu chuyên
     * nghiệp quá"* — cùng một màn có hai kiểu chữ số. Vẫn cấm ▲▼ (ký tự mũi tên, không phải chữ số).
     */
    const { container } = dung({ delta: 1244 });
    expect(container.textContent).toBe('+12,4%');
    expect(container.querySelectorAll('span[style*="width"]').length, 'còn glyph ChuPixel').toBe(0);
  });

  it('⭐⭐ DẤU ÂM phải VẼ RA — `ChuPixel` lọc im lặng ký tự không có glyph', () => {
    /*
     * Bug thật, chỉ lộ khi đếm glyph trên trình duyệt: bản đầu truyền `−`
     * (U+2212, dấu trừ toán học) trong khi lưới khai `-` (U+002D). `ChuPixel`
     * lọc ký tự không có glyph, nên dấu BIẾN MẤT — số âm hiện y hệt số dương và
     * chỉ còn MÀU để phân biệt. Không lỗi, không test đỏ.
     * ⇒ Đếm glyph: `-581` phải nhiều hơn `581` đúng một ô, và số âm với số dương
     * cùng độ dài phải ra bằng nhau.
     */
    // D443 — số là text: dấu âm phải CÓ MẶT trong chữ (cùng độ dài với số dương, khác dấu).
    const doc = (delta: number) => {
      const { container, unmount } = dung({ delta });
      const t = container.textContent ?? '';
      unmount();
      return t;
    };
    expect(doc(-581), 'số âm mất dấu ⇒ đọc y hệt số dương').toBe('-5,8%');
    expect(doc(581)).toBe('+5,8%');
    expect(doc(0)).toBe('0,0%');
  });

  it('⭐ LẤP LÁY khi chưa ai chạm, và THÔI lấp láy sau khi chạm', () => {
    /*
     * Founder: *"nó sẽ cứ lấp láy nhẹ ở đó nếu không được bấm vào"*. Vế thứ hai
     * cũng là luật: nhấp nháy tiếp sau khi người ta đã đọc là quấy, và họ sẽ học
     * cách phớt lờ (bài học D77 — thứ gào suốt thì không còn ai nghe).
     */
    const { container } = dung();
    const nut = () => container.querySelector('button')!;
    expect(nut().className).toMatch(/moi/);
    fireEvent.click(nut());
    expect(nut().className, 'chạm rồi mà vẫn nháy là quấy').not.toMatch(/_moi_|moiGap/);
  });

  it('⭐ vòng có tin KHÔNG suy được từ con số ⇒ mời chạm mức GẮT', () => {
    // Trước 23/08 hai ca này tự bung cả khối; nay chúng đi bằng CƯỜNG ĐỘ.
    expect(dung({ gap: true }).container.querySelector('button')!.className)
      .toMatch(/moiGap/);
  });

  it('sang vòng mới ⇒ lời mời SỐNG LẠI (mỗi vòng là một tin mới)', () => {
    const { container, rerender } = dung({ vong: 3 });
    fireEvent.click(container.querySelector('button')!);
    expect(container.querySelector('button')!.className).not.toMatch(/_moi_/);
    rerender(<SoNhipVong delta={704} goc={10000} vong={4} dangMo={false} onCham={() => {}} />);
    expect(container.querySelector('button')!.className).toMatch(/moi/);
  });
});

describe('I ter. TIN GIẢ LỘ = thông báo TOÀN MAP, không nằm im trong bảng lý do', () => {
  it('⭐ băng-rôn bắn cả khi ô vừa lật KHÔNG phải sự kiện', () => {
    /*
     * Founder 23/08: *"khi có tin giả lộ ra thì làm 1 cái thông báo sự kiện
     * toàn map ấy chứ đừng chỉ hiện ở phần lý do"*.
     * ⚠ Bản cũ chỉ bắn khi `kq.o.kind === 'su_kien'`, mà `tin_gia_lo` nói về
     * một ô ở vòng TRƯỚC — nên cú bóc tin giả thường rơi đúng vào nhánh KHÔNG
     * bắn, và người chơi chỉ biết mình vừa bị lừa nếu tự đi mở bảng VÌ SAO.
     */
    const than = bocChuThich(MAN);
    // D398 — nhánh bắn băng-rôn nay nằm trong bước 'tin' của nhịp kết quả, viết một dòng (không ngoặc).
    expect(than).toMatch(/if \(kq\?\.tin_gia_lo\)\s*\{?[\s\S]{0,200}?setSuKienNo\(/);
    // …và nó phải ĐỨNG TRƯỚC nhánh ô-sự-kiện, không phải nằm trong đó.
    const iGia = than.indexOf('kq?.tin_gia_lo');
    const iO = than.indexOf("kq?.o.kind === 'su_kien'");
    expect(iGia).toBeGreaterThan(-1);
    expect(iGia, 'tin giả phải được ưu tiên: nó đảo nghĩa của chính con số vòng này')
      .toBeLessThan(iO);
  });

  it('⭐ KHỐI CHI TIẾT thôi tự mở — không còn ngoại lệ nào', () => {
    /*
     * ⚠ 24/08 — khoá theo HÀNH VI của cái cổng, không theo hình dạng câu lệnh.
     * Bản trước đòi nguyên văn `… && moLyDo ?` (dấu `?` của toán tử ba ngôi), nên
     * khi khối chi tiết chuyển sang TẤM TRƯỢT và cổng đổi từ `? :` sang `&&`,
     * bài đỏ trong khi điều nó canh — "chỉ mở vì `moLyDo`" — vẫn đúng nguyên.
     * Một bài đỏ vì bản ĐÚNG là bài sẽ bị nới cho qua (D79).
     */
    const than = bocChuThich(MAN);
    // D398 — cổng "lá đã lật xong" nay là bước LÃI/LỖ của nhịp kết quả (cờ `dangLat` riêng đã gỡ).
    const cong = /ketQuaCho\?\.tt\.ket_qua_vong && !choDienXong && daToiBuoc\(buocKq, 'lai_lo'\) && moLyDo/
      .exec(than);
    expect(cong, 'không tìm thấy cổng mở khối chi tiết').not.toBeNull();
    // Không cờ ngoại lệ nào được phép mở hộ — chúng đã có đường đi riêng.
    for (const co of ['tu_dong', 'tin_gia_lo', 'siet_cua_ban']) {
      expect(than, `${co} lại tự mở khối chi tiết`)
        .not.toMatch(new RegExp(`moLyDo\\s*\\|\\|[^\\n]*${co}`));
    }
  });
});

describe('II. Chỗ nối ở màn trận — canh CẢ LỚP', () => {
  it('⭐⭐ con số đo bằng ẢNH CHỤP NAV HEADLINE, không bằng `nav_sau` của engine', () => {
    /*
     * Lỗi nặng nhất đợt rà. `cua_ban.nav_sau` được engine chụp TRƯỚC khi chia
     * Quỹ vòng, trước gọi ký quỹ và trước SIẾT PHÁP LÝ ⇒ lệch với NAV headline ở
     * **100% số vòng có lệnh** và ĐỔI DẤU ở **15–40%** (đo bằng engine thật,
     * v34, bàn 5, 120 seed × 6 vòng). Người chơi đọc "vừa mất 77" trong khi tài
     * sản vừa TĂNG 704.
     * ⚠ Không sửa được ở engine: `nav_sau` nuôi xếp hạng và nằm trên đường
     * replay — đổi nó là viết lại kết quả mọi trận đã lưu.
     */
    const than = bocChuThich(
      /const nhipVong = \(\(\) => \{([\s\S]*?)\n  \}\)\(\);/.exec(MAN)?.[1] ?? '',
    );
    expect(than, 'không tìm thấy khối `nhipVong` — bài này mất hiệu lực').not.toBe('');
    expect(than).toContain('ketQuaCho.navTruoc');
    expect(than).toContain('ketQuaCho.tt.ban.nav');
    /*
     * ⚠ Cấm theo HÀNH VI, không theo tên biến. Bản đầu của bài này viết
     * `.not.toMatch(/cb\.nav_sau/)` và mũi tiêm LỌT chỉ vì nó đặt tên biến khác
     * — một bài khoá tên biến thì người sửa sau chỉ cần đổi tên là đi qua được.
     * Ở đây `nav_sau`/`nav_truoc` là hai trường CHỈ engine phát ra, nên cấm cả
     * chuỗi trong khối này là cấm đúng thứ cần cấm.
     */
    expect(than, 'đọc `nav_sau`/`nav_truoc` của engine là dựng lại đúng bug')
      .not.toMatch(/nav_sau|nav_truoc/);
  });

  it('`navTruoc` chụp NGAY TRƯỚC khi nộp, cùng khoảnh khắc với `vonTruoc`', () => {
    expect(MAN).toMatch(/const vonTruoc = st\.ban\.von;\s*[\s\S]{0,400}?const navTruoc = st\.ban\.nav \?\? st\.ban\.von;/);
  });

  it('⭐ trận cũ / ghế đã cháy vẫn RA một con số — cửa vào VÌ SAO không được chôn', () => {
    /*
     * Trận dựng dưới `balance-v10a` trở về trước không có `nav`, và ghế đã CHÁY
     * bị engine bỏ khỏi `ket_qua` ⇒ `cua_ban` null. Bản đầu `return null` cụt
     * cho cả hai ca, mà `SoNhipVong` là chỗ DUY NHẤT còn bật được `moLyDo` ⇒
     * người chơi mất luôn lãi/lỗ vòng, ĐỘ CHUẨN, PHÍ, và VÌ SAO. D26 §18.5 cho
     * thu gọn, không cho chôn mất.
     */
    const than = bocChuThich(
      /const nhipVong = \(\(\) => \{([\s\S]*?)\n  \}\)\(\);/.exec(MAN)?.[1] ?? '',
    );
    expect(than).toContain('ketQuaCho.tt.ban.von - ketQuaCho.vonTruoc');
  });

  it('⭐⭐ ra nền rồi quay lại KHÔNG xoá con số khi server chưa tiến vòng nào', () => {
    /*
     * `visibilitychange` → `dongBoLaiTuServer` → `setKetQuaCho(null)`. Cửa duy
     * nhất là `if (tuoi.vong < vongMoiNhat.current) return`, và nó KHÔNG đỡ ca
     * thường: sau khi nộp vòng N thì `vongMoiNhat` = N+1 và GET cũng trả N+1 ⇒
     * so sánh sai ⇒ rơi thẳng xuống dòng xoá. Liếc thông báo 5 giây rồi quay
     * lại là mất con số, mất luôn cái NÚT, nên mất luôn đường tới VÌ SAO — và
     * ba ca TỰ MỞ cũng câm theo.
     * ⚠ `ket_qua_vong` chỉ do `POST /rounds` phát; GET không mang. Xoá ở đây là
     * xoá thứ không lấy lại được trong phiên.
     */
    const than = bocChuThich(
      /const dongBoLaiTuServer = useCallback\(async \(\) => \{([\s\S]*?)\n  \}/.exec(MAN)?.[1] ?? '',
    );
    expect(than, 'không tìm thấy `dongBoLaiTuServer`').not.toBe('');
    expect(than, 'xoá vô điều kiện là dựng lại đúng bug').not.toMatch(/^\s*setKetQuaCho\(null\);/m);
    expect(than).toMatch(/daTien/);
    expect(than).toMatch(/if \(daTien\) setKetQuaCho\(null\)/);
  });

  it('⭐ nút VÌ SAO là TOGGLE — nó chết ở đúng ba ca tự mở nếu chỉ biết đóng', () => {
    /*
     * Khối bung ra do `tu_dong || tin_gia_lo || siet_cua_ban` chứ không do
     * `moLyDo`, nên với nút gán cứng `setMoLyDo(false)`: danh sách VÌ SAO vẫn
     * ĐÓNG, nhãn ghi "ẨN LÝ DO" (nói ngược), `aria-expanded` báo sai, và bấm thì
     * không có gì xảy ra. Ba ca đó chính là ba ca được khai là quan trọng nhất.
     */
    const nut = /<button[\s\S]{0,200}?className=\{s\.nutLyDo\}[\s\S]{0,300}?<\/button>/.exec(MAN)?.[0] ?? '';
    expect(nut, 'không tìm thấy nút VÌ SAO').not.toBe('');
    expect(nut).toContain('setMoLyDo((x) => !x)');
    expect(nut, 'nhãn cứng nghĩa là nút không biết mình đang mở hay đóng')
      .toMatch(/moLyDo \? 'ẨN LÝ DO' : 'VÌ SAO'\}<i className=\{`\$\{s\.mui\} \$\{moLyDo \? s\.muiLen : ''\}`\}/);
  });
});

describe('III. Trình đọc màn hình vẫn nghe được kết quả vòng', () => {
  it('⭐ vùng LIVE nay ở khối TAY — và KHÔNG remount mỗi vòng', () => {
    /*
     * Trước D114 vai này ở headline kết quả vòng (`role="status"`); thu gọn khối
     * làm rơi mất nó và không ai thấy, vì thứ mất đi chỉ nghe được bằng AT.
     * D184 gỡ LĂNG KÍNH khỏi màn trận ⇒ vùng live đi theo con số sang khối TAY.
     * Bài canh đúng HAI điều còn giá trị, không canh chỗ đứng cũ:
     *   (a) có một vùng live chở được con số;
     *   (b) nó KHÔNG mang `key` theo vòng — vùng vừa-sinh-vừa-có-ruột thì trình
     *       đọc màn hình xướng không đáng tin (đó là lý do nó không nằm trên
     *       chính con số, vốn remount mỗi vòng).
     */
    render(
      <TayBai
        nhipPhai={<span>lãi 704</span>}
        shopMo={false}
        onShop={() => {}}
        soTheChon={0}
        onChotVong={() => {}}
        onBo={() => {}}
      />,
    );
    expect(screen.getByRole('status').textContent).toContain('704');

    const TAY = readFileSync(
      resolve(process.cwd(), 'src/components/holdem/TayBai.tsx'), 'utf8');
    // D443 — con số dời lên hàng công cụ cùng ô bọc của nó (mã đang cầm lên khung NAV); ô bọc giữ vai vùng live.
    const hang = /<span className=\{s\.oKetQua\}([^>]*)>/.exec(TAY)?.[1] ?? '';
    expect(hang, 'hàng TAY thiếu role=status ⇒ AT thôi nghe được kết quả vòng')
      .toContain('role="status"');
    expect(hang, 'vùng live mang key ⇒ remount mỗi vòng ⇒ AT xướng không đáng tin')
      .not.toMatch(/\bkey=/);

    // Màn trận phải TRUYỀN con số vào đúng khối đó, không thì vùng live rỗng.
    expect(MAN, 'màn trận không nối SoNhipVong vào TayBai')
      .toMatch(/<TayBai[\s\S]*?nhipPhai=/);
  });
});

describe('IV. Tiết kiệm chuyển động ≠ không cho đọc', () => {
  it('⭐ lớp phủ khoảnh khắc KHÔNG bị kẹp còn 60ms', () => {
    /*
     * Bản đầu kẹp MỌI hẹn giờ về `min(ms, 60)`, nên với người bật "Giảm chuyển
     * động" thì lớp phủ nháy 60ms rồi biến mất — không kịp đọc glyph nào, và cả
     * nhánh CSS reduced-motion viết riêng cho `ChuHang` thành mã không ai quan
     * sát được. Tắt cái NHÁY, không tắt cái TIN.
     */
    const src = doc('src/components/holdem/MomentOverlay.tsx');
    expect(src, 'kẹp chung một trần là dựng lại đúng bug').not.toContain('Math.min(ms, 60)');
    expect(src).toContain('DOC_IT_MOTION_MS');
    // Hai mốc phải TÁCH: kẹp chung một số thì `dangTat` và `setI` nổ cùng lúc.
    expect(src).toMatch(/hien \+ \(itMotion \? 0 : TAT_MS\)/);
  });

  it('bốn lớp của lớp phủ nằm trong lưới prefers-reduced-motion', () => {
    const css = doc('src/styles/motion.module.css');
    const khoi = /@media \(prefers-reduced-motion: reduce\)\s*\{([\s\S]*)$/.exec(css)?.[1] ?? '';
    for (const lop of ['.adNenBung', '.adChuBung', '.adAiDo', '.adTat']) {
      expect(khoi, `${lop} chạy tiếp khi người ta đã tắt chuyển động`).toContain(lop);
    }
  });
});

describe('V. Màu hạng — MỘT nguồn cho cả thanh lẫn màn kết', () => {
  it('⭐ màn kết thôi giữ bảng màu riêng', () => {
    /*
     * Bảng 5 bậc ở `PhongCachKet.module.css` từng TRÙNG từng mã hex với thanh
     * trong trận. D115 chuyển thanh sang thang nội suy liên tục và chỉ sửa một
     * bên ⇒ bản sao còn lại trôi ngay trong cùng một màn hình: hạng SSS ra chữ
     * pixel HỒNG đứng cạnh cái thanh VÀNG. Đúng lớp D61 — bản thứ hai không sai
     * lúc viết, nó sai lúc bên kia đổi.
     */
    const css = doc('src/components/holdem/PhongCachKet.module.css');
    expect(css, 'bảng hex riêng quay lại là bản sao sẽ trôi lần nữa')
      .not.toMatch(/\.(thap|giua|kha)\s*\{[^}]*--pc-mau/);
    expect(doc('src/components/holdem/PhongCachKet.tsx')).toContain('mauTheoDiem(pc.diem)');
  });
});

describe('V. Cú NỔ mỗi vòng — hiệu ứng SỰ KIỆN, không phải hiệu ứng nhàn rỗi', () => {
  /*
   * Founder 30/08: *"lãi lỗ do bị ẩn nên chẳng có tý cảm giác nào… đáng ra nó
   * phải giữ nguyên hiệu ứng của lãi lỗ TO qua mỗi vòng mà ko cần bấm vào. Bấm
   * vào chỉ để xem nguyên nhân thôi chứ đ** phải để xem hiệu ứng."*
   *
   * D114 có `snLai`/`snLo` — nổ một phát mỗi vòng. D119 thay bằng `snMoi` lấp
   * láy vô hạn chờ được chạm. Đây là khôi phục vế SỰ KIỆN, giữ nguyên vế mời chạm.
   */
  const CSS = doc('src/components/holdem/SoNhipVong.module.css');

  const dungNo = (delta: number) =>
    render(
      <SoNhipVong delta={delta} goc={10000} vong={4} dangMo={false} onCham={() => {}} />,
    );

  it('⭐ cú nổ nằm trên PHẦN TỬ RIÊNG, không dán chung với nhịp lấp láy', () => {
    /*
     * ⚠ Đây là bài chịu lực của cả mục. `animation` KHÔNG cộng dồn — dán cú nổ
     * lên chính cái nút (nơi `.moi` đang sống) thì một trong hai chết IM LẶNG:
     * CSS hợp lệ, tsc xanh, lint xanh, devtools vẫn thấy lớp trên DOM. Đó đúng
     * là cơ chế đã giết mười hoạt ảnh ở D122.
     */
    const { container } = dungNo(704);
    const nut = container.querySelector('button');
    const boc = container.querySelector('button > span');
    expect(nut, 'phải còn là NÚT — con số là cửa duy nhất vào bảng VÌ SAO').toBeTruthy();
    expect(boc, 'thiếu lớp bọc riêng cho cú nổ').toBeTruthy();
    // D443 — số là chữ font app: con số phải nằm TRONG lớp bọc (cú nổ đè lên chính nó).
    expect(boc!.textContent, 'con số phải nằm TRONG lớp bọc').toBe('+7,0%');
    expect(
      boc!.className,
      'lớp bọc mang class riêng, không dùng lại class của nút',
    ).not.toBe(nut!.className);

    /*
     * ⚠⚠ VẾ CHỊU LỰC — thêm sau khi TIÊM LỖI cho thấy bài này hụt.
     * Bản đầu chỉ canh CẤU TRÚC (có span con, khác class), nên mũi tiêm "dời
     * `animation: snNo` sang một selector khác" ĐI LỌT: span vẫn tồn tại, vẫn
     * khác class, mà cú nổ thì đã chết. Phải canh đúng thứ mình muốn bảo vệ —
     * CÚ NỔ NẰM TRÊN SELECTOR NÀO, và nó KHÔNG nằm chung với nhịp lấp láy.
     */
    /*
     * ⚠ BÓC CHÚ THÍCH TRƯỚC KHI CẮT. Bản đầu của chính bài này đỏ oan vì chú
     * thích trong file có chuỗi `key={nhip-<vòng>}` — một dấu `}` nằm trong lời
     * văn, và bộ cắt selector vớ phải nó. Cùng họ với bẫy "bóc comment trước khi
     * quét" mà `pixelui.test.tsx` đã trả giá.
     */
    const SACH = CSS.replace(/\/\*[\s\S]*?\*\//g, '');
    const luat = (ten: string) => {
      const i = SACH.indexOf(`animation: ${ten} `);
      if (i < 0) return null;
      const mo = SACH.lastIndexOf('{', i);
      return SACH.slice(SACH.lastIndexOf('}', mo) + 1, mo).trim();
    };
    expect(luat('snNo'), 'cú nổ phải nằm trên `.no`').toBe('.no');
    expect(luat('snNoManh'), 'cú nổ mạnh phải nằm trên `.noManh`').toBe('.noManh');
    expect(luat('snMoi'), 'nhịp lấp láy phải ở nút `.moi` — khác phần tử').toBe('.moi');
    // Và lớp bọc trong TSX phải thật sự dùng `.no`, không phải một span trần.
    expect(
      doc('src/components/holdem/SoNhipVong.tsx'),
      'lớp bọc không gắn `s.no` ⇒ cú nổ không bao giờ chạy',
    ).toContain('s.no');
  });

  it('vòng ĐỘNG MẠNH (≥10%) nổ mạnh hơn vòng thường — cú lớn phải cảm thấy khác', () => {
    // 704/10000 = 7,04% ⇒ thường · 1244/10000 = 12,44% ⇒ mạnh
    const nhe = dungNo(704).container.querySelector('button > span')!;
    const manh = dungNo(1244).container.querySelector('button > span')!;
    const dem = (e: Element) => e.className.split(' ').filter(Boolean).length;
    expect(dem(manh), 'vòng mạnh phải có thêm một lớp').toBe(dem(nhe) + 1);
  });

  it('cú nổ chạy ĐÚNG MỘT LƯỢT và theo nấc — không vô hạn, không cubic-bezier', () => {
    /*
     * Vô hạn thì nó thành hiệu ứng nhàn rỗi thứ hai, tức quay lại đúng bệnh
     * D119. `steps()` vì đây là VẬT pixel (§XI luật 3, ranh file trong
     * docs/ui-ux/01-vfx-game-feel.md §2.3-1).
     */
    for (const ten of ['snNo', 'snNoManh']) {
      // Cắt bằng chuỗi thuần, KHÔNG dựng regex từ template literal: `\s` trong
      // template literal là escape của chữ `s`, nên regex ghép động rất dễ câm.
      const dau = CSS.indexOf(`animation: ${ten} `);
      const rule = dau < 0 ? undefined : CSS.slice(dau, CSS.indexOf(';', dau) + 1);
      expect(rule, `thiếu khai báo animation cho ${ten}`).toBeTruthy();
      expect(rule, `${ten} phải chạy hữu hạn`).not.toContain('infinite');
      expect(rule, `${ten} phải dùng steps()`).toContain('steps(');
      expect(rule, `${ten} không được dùng cubic-bezier ở tầng pixel`).not.toContain('cubic-bezier');
      expect(rule, `${ten} phải khai rõ 1 lượt`).toMatch(/\b1\b\s*;/);
    }
  });

  it('cú nổ chỉ động transform/opacity — hàng này còn chở cọc chip và tổng tài sản', () => {
    const than = CSS.slice(CSS.indexOf('@keyframes snNo'));
    const cam = than.match(/^\s*(width|height|margin|padding|top|left|font-size)\s*:/gm);
    expect(cam, `keyframes cú nổ đụng thuộc tính BỐ CỤC: ${cam?.join(', ')}`).toBeNull();
  });

  it('tiết kiệm chuyển động: tắt cú NỔ nhưng giữ con số', () => {
    const khoi = CSS.slice(CSS.indexOf('prefers-reduced-motion'));
    for (const c of ['.no', '.noManh']) {
      expect(khoi, `${c} chưa được tắt ở nhánh reduced-motion`).toContain(c);
    }
  });

  it('⭐ tấm trượt VÌ SAO phải TỰ ĐÓNG khi sang vòng mới', () => {
    /*
     * BUG ĐÃ VÁ (D185): `moLyDo` chỉ tắt bởi hành động người chơi, không có
     * reset theo vòng. Chạm một lần ở vòng 3 thì từ vòng 4 tấm 70vh TỰ BUNG mỗi
     * vòng và màn chắn bắt hết cú chạm — che đúng khoảnh khắc kết quả.
     * Quét mã nguồn vì jsdom không dựng được cả màn trận.
     */
    const co = /useEffect\(\s*\(\)\s*=>\s*\{\s*setMoLyDo\(false\);\s*\}\s*,\s*\[\s*vongHienTai\s*\]\s*\)/
      .test(MAN.replace(/\s+/g, ' ').replace(/ \}/g, '}').replace(/\{ /g, '{'));
    expect(
      co || /setMoLyDo\(false\)[^]{0,80}\[vongHienTai\]/.test(MAN.replace(/\s+/g, ' ')),
      'thiếu cú reset `moLyDo` theo vòng ⇒ tấm trượt sẽ tự bung lại mỗi vòng',
    ).toBe(true);
  });
});

/*
 * D435 (founder 27/09) — CON SỐ VÒNG Ở MÀN CHÍNH bước theo từng hộp khoản nổi (`KhoanNoi`, 420 ms một hộp), nhún mỗi
 * bước, rồi RUNG và KHỚP về đúng tổng. Tiêm lỗi: bỏ nhánh `dangBuoc` (luôn hiện tổng) ⇒ bài đầu đỏ ở bước 1.
 */
describe('D435 — con số vòng bước theo từng khoản rồi khớp tổng', () => {
  const docSo = (c: HTMLElement) => c.querySelector('[data-so-hien]')?.getAttribute('data-so-hien');

  it('ba khoản +100 · +200 · −50 (gốc 10.000) ⇒ +1,0% → +3,0% → +2,5%, rồi rung và khớp đúng tổng +2,6%', () => {
    vi.useFakeTimers();
    try {
      const { container } = render(
        <SoNhipVong delta={260} goc={10000} vong={4} dangMo={false} onCham={() => {}} khoan={[100, 200, -50]} dienKhoan />,
      );
      // Mỗi bước HAI nhịp: tới mốc hẹn (hộp vào — state đổi, effect đếm dựng SAU act) rồi cho bộ đếm chạy xong (4 × 34 ms).
      const toi = (ms: number) => { act(() => { vi.advanceTimersByTime(ms); }); act(() => { vi.advanceTimersByTime(200); }); };
      toi(0);     // t = 0 — hộp 1
      expect(docSo(container)).toBe('+1,0%');
      toi(220);   // t = 420 — hộp 2
      expect(docSo(container)).toBe('+3,0%');
      toi(220);   // t = 840 — hộp 3
      expect(docSo(container)).toBe('+2,5%');
      expect(container.querySelector('[data-khop]')).toBeNull();
      toi(220);   // t = 1260 — khớp tổng
      expect(docSo(container)).toBe('+2,6%');
      expect(container.querySelector('[data-khop]')).not.toBeNull();
    } finally {
      vi.useRealTimers();
    }
  });

  it('vế ngược — bước LÃI/LỖ không diễn (dienKhoan tắt) ⇒ đứng ngay ở tổng, không rung', () => {
    const { container } = render(
      <SoNhipVong delta={260} goc={10000} vong={4} dangMo={false} onCham={() => {}} khoan={[100, 200, -50]} />,
    );
    expect(docSo(container)).toBe('+2,6%');
    expect(container.querySelector('[data-khop]')).toBeNull();
  });
});
