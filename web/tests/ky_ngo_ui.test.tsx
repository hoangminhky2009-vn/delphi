import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { KyNgoChip, KyNgoChon, KyNgoPhu, KyNgoThanh } from '../src/components/holdem/KyNgo';
import type { NhiemVuKyNgoDTO } from '../src/api/holdem';

/*
 * KỲ NGỘ — LỚP GIAO DIỆN (D85/D86 §1, doc 06 §1.4 + §1.5).
 *
 * Bốn thứ được khoá, mỗi thứ một lớp lỗi repo này đã dính:
 *   1. DÂY NỐI — màn trận THẬT SỰ mount cả hai component ("cơ chế trang trí",
 *      đã dính 19 lần: hàm có, test có, đường chạy không).
 *   2. ⚠⚠ CHE — client TUYỆT ĐỐI không tự suy điều kiện lộ icon. Luật A3.1
 *      nằm ở SERVER; một bản kiểm thứ hai ở client sẽ trôi, và cú trôi này lộ
 *      lựa chọn của người khác TRƯỚC khi mình chọn — đúng thứ luật sinh ra để
 *      chặn.
 *   3. KHÔNG CHÉP CÂU CHỮ — bảng bốn nhiệm vụ đến từ catalog; chép sang client
 *      là bản sao thứ hai sẽ trôi (D61).
 *   4. A10 — mô tả MÔ TẢ, không kê đơn; và không emoji (D47).
 */

const nv = (id: string, icon: string): NhiemVuKyNgoDTO => ({
  id: id as NhiemVuKyNgoDTO['id'],
  ten: `TÊN ${id}`,
  icon,
  mo_ta: `mô tả ${id}`,
  dac_quyen: 'the_gio',
  ten_dac_quyen: `QUÀ ${id}`,
  mo_ta_dac_quyen: `tác dụng ${id}`,
});

const BANG = [nv('la_ban', 'target'), nv('tay_can', 'chart'),
  nv('ve_song', 'bolt'), nv('bat_nhip', 'candle')];
const td0 = { xong: true, dat: 4, can: 4, vongCoViThe: 3, canCoViThe: 3 };

describe('màn chọn', () => {
  it('vẽ ĐÚNG bộ được mời — không tự thêm món thứ tư', () => {
    const { container } = render(
      <KyNgoChon moi={['la_ban', 'tay_can', 've_song']} bang={BANG}
        dangChon={null} onChon={() => {}} />,
    );
    expect(container.textContent).toContain('TÊN la_ban');
    expect(container.textContent).toContain('TÊN ve_song');
    expect(container.textContent,
      'món KHÔNG được mời mà hiện ra là client tự nới luật "3 trong 4"')
      .not.toContain('TÊN bat_nhip');
  });

  it('⭐ ĐẶC QUYỀN hiện NGAY trên lá — chọn mù thì không phải là chọn (D25/R1)', () => {
    const { container } = render(
      <KyNgoChon moi={['la_ban']} bang={BANG} dangChon={null} onChon={() => {}} />,
    );
    expect(container.textContent).toContain('QUÀ la_ban');
    expect(container.textContent).toContain('tác dụng la_ban');
  });

  it('nói thẳng "bỏ qua cũng được" — không phạt là một phần của luật', () => {
    const { container } = render(
      <KyNgoChon moi={['la_ban']} bang={BANG} dangChon={null} onChon={() => {}} />,
    );
    expect(container.textContent?.toLowerCase()).toContain('không mất gì');
  });

  it('catalog cũ (thiếu bảng) ⇒ lá không vẽ, KHÔNG đoán câu chữ', () => {
    const { container } = render(
      <KyNgoChon moi={['la_ban']} bang={[]} dangChon={null} onChon={() => {}} />,
    );
    expect(container.textContent).toBe('');
  });

  it('lá đang chọn khai `aria-pressed` — trạng thái phải đọc được, không chỉ đổi màu', () => {
    const { container } = render(
      <KyNgoChon moi={['la_ban', 'tay_can']} bang={BANG}
        dangChon="tay_can" onChon={() => {}} />,
    );
    const nut = container.querySelectorAll('button');
    expect(nut[0]!.getAttribute('aria-pressed')).toBe('false');
    expect(nut[1]!.getAttribute('aria-pressed')).toBe('true');
  });
});

describe('chip tiến độ', () => {
  const td = (dat: number, can: number, co: number, canCo: number) =>
    ({ xong: false, dat, can, vongCoViThe: co, canCoViThe: canCo });

  it('vẽ tử/mẫu của nhiệm vụ', () => {
    const { container } = render(
      <KyNgoChip nv={BANG[0]} tienDo={td(2, 4, 3, 3)} xong={false} tenDacQuyen="QUÀ" />,
    );
    expect(container.textContent).toContain('2/4');
  });

  it('⭐ vế CHỐNG LÁCH hiện khi còn thiếu — đủ "4/4" mà vẫn chưa xong thì phải nói vì sao', () => {
    const { container } = render(
      <KyNgoChip nv={BANG[0]} tienDo={td(4, 4, 1, 3)} xong={false} tenDacQuyen="QUÀ" />,
    );
    expect(container.textContent).toContain('1/3');
  });

  it('đủ vế chống lách rồi thì thôi hiện — hiện mãi là tiếng ồn nền', () => {
    const { container } = render(
      <KyNgoChip nv={BANG[0]} tienDo={td(1, 4, 3, 3)} xong={false} tenDacQuyen="QUÀ" />,
    );
    expect(container.textContent).not.toContain('3/3');
  });

  it('xong ⇒ khoe ĐẶC QUYỀN thay cho tử/mẫu', () => {
    const { container } = render(
      <KyNgoChip nv={BANG[0]} tienDo={td(4, 4, 3, 3)} xong tenDacQuyen="THẺ GIỜ" />,
    );
    expect(container.textContent).toContain('THẺ GIỜ');
    expect(container.textContent).toContain('ĐANG CÓ');
  });
});

describe('nguồn — không chép luật, không emoji', () => {
  const nguon = readFileSync(
    resolve(process.cwd(), 'src/components/holdem/KyNgo.tsx'), 'utf8');

  it('⚠⚠ client KHÔNG tự suy điều kiện lộ icon (luật A3.1 nằm ở SERVER)', () => {
    for (const c of ['da_chon', 'daChon &&', 'xong_o_vong >']) {
      expect(nguon.includes(c), `KyNgo.tsx tự suy luật che qua "${c}"`).toBe(false);
    }
  });

  it('không chép TÊN bốn nhiệm vụ — câu chữ đến từ catalog', () => {
    for (const c of ['LA BÀN', 'TAY CÂN', 'KẺ VƯỢT SÓNG', 'KẺ BẮT NHỊP']) {
      expect(nguon.includes(c), `chép "${c}" sang client — bản sao thứ hai sẽ trôi (D61)`)
        .toBe(false);
    }
  });

  it('không emoji trong màn trận (D47) — đo CHỮ ĐÃ RENDER, không đo chú thích', () => {
    /*
     * ⚠ Quét nguyên file là báo động giả: chú thích của repo này dùng "⚠", mà
     * `⚠` khớp `Extended_Pictographic`. Một bài test báo động giả sẽ bị tắt đi,
     * và lúc đó nó không còn canh gì (bài học D79). Nên đo đúng thứ người chơi
     * NHÌN THẤY: chuỗi đã render.
     */
    const a = render(
      <KyNgoChon moi={['la_ban', 'tay_can']} bang={BANG}
        dangChon={null} onChon={() => {}} />).container.textContent ?? '';
    const b = render(
      <KyNgoChip nv={BANG[0]} tienDo={td0} xong tenDacQuyen="THẺ GIỜ" />)
      .container.textContent ?? '';
    expect(/\p{Extended_Pictographic}/u.test(a + b)).toBe(false);
  });
});

describe('dây nối — màn trận thật sự mount', () => {
  const man = readFileSync(
    resolve(process.cwd(), 'src/screens/holdem/AlphaDraftMatch.tsx'), 'utf8');
  const dai = readFileSync(
    resolve(process.cwd(), 'src/components/holdem/DoiThuStrip.tsx'), 'utf8');

  it('⭐ AlphaDraftMatch render CẢ HAI component, không phải component mồ côi', () => {
    // 16/08 (doc 06 §12): màn chọn là LỚP PHỦ `KyNgoPhu` + thanh gọn `KyNgoThanh`
    // (thay panel `KyNgoChon` inline). Cả hai phải được mount ở màn trận.
    expect(man.includes('<KyNgoPhu'), 'lớp phủ chọn con đường không được mount').toBe(true);
    expect(man.includes('<KyNgoThanh'), 'thanh gọn mở lại kỳ ngộ không được mount').toBe(true);
    expect(man.includes('<KyNgoChip'), 'chip tiến độ không được mount').toBe(true);
  });

  it('⭐ cú nộp vòng THẬT SỰ mang `ky_ngo` lên server', () => {
    expect(man.includes('ky_ngo: chonKyNgo'),
      'chọn xong mà payload không mang đi thì cả cơ chế là trang trí').toBe(true);
  });

  it('⭐ dải ghế vẽ icon con đường, và ĐỌC THẲNG cờ server gửi', () => {
    expect(dai.includes('d.ky_ngo_icon'), 'DoiThuStrip không vẽ icon con đường')
      .toBe(true);
    // Client chỉ hỏi "server có gửi không", KHÔNG hỏi "mình đã chọn chưa".
    expect(dai.includes('lan.') || dai.includes('da_chon'),
      'DoiThuStrip tự suy luật che — phải để server quyết (khuôn A3.1)').toBe(false);
  });

  it('màn kết lật ngửa con đường của MỌI ghế (doc 06 §1.4)', () => {
    // 11/10: màn kết tách sang `ManKet.tsx` (bento) — dây nối nằm ở đó; `AlphaDraftMatch` chỉ còn mount `<ManKet`.
    const ket = readFileSync(resolve(process.cwd(), 'src/screens/holdem/ManKet.tsx'), 'utf8');
    expect(man.includes('<ManKet'), 'màn trận không dựng màn kết').toBe(true);
    expect(ket.includes('h.ky_ngo_icon'), 'màn kết không lật bài con đường').toBe(true);
  });
});

describe('D88 — ống kính con đường ở client', () => {
  const man = readFileSync(
    resolve(process.cwd(), 'src/components/holdem/ChainReveal.tsx'), 'utf8');

  it('⭐ ChainReveal đọc `kq.ong_kinh` — dây nối có thật', () => {
    expect(man.includes('kq.ong_kinh'), 'server gửi mà client vứt = trang trí')
      .toBe(true);
  });

  it('⭐ số null vẽ — , không vẽ số âm/0 (chốt §1.2 của D88)', () => {
    // Khoá bằng nguồn: mọi nhánh null của okSo phải trả về '—'.
    const okSo = man.slice(man.indexOf('function okSo'), man.indexOf('export function ChainReveal'));
    expect((okSo.match(/=== null \? '—'/g) ?? []).length,
      'ba nhánh số (la_ban · tay_can · ve_song) đều phải có đường null → —')
      .toBeGreaterThanOrEqual(3);
  });
});

/*
 * 16/08 — LỚP PHỦ KỲ NGỘ (doc 06 §12): khoảnh khắc, không phải panel.
 * Ba luật trình bày: (1) tên HỒI hiện — hồi quyết định bộ mời; (2) chạm lần một
 * chỉ LẬT (mặt đặc quyền), chạm lần hai mới CHỌN — chọn mù thì không phải chọn;
 * (3) BỎ QUA là nút thật. Không đổi luật server nào.
 */
describe('KyNgoPhu — lớp phủ chọn con đường', () => {
  it('hiện tên HỒI + đồng hồ; chạm một lần = LẬT (chưa gọi onChon), chạm hai lần = CHỌN', () => {
    const onChon = vi.fn();
    render(
      <KyNgoPhu moi={['la_ban', 'tay_can', 've_song']} bang={BANG} dangChon={null}
        onChon={onChon} tenHoi="Sóng gió" dongHo="CÒN 31s" onDong={() => {}} />,
    );
    expect(screen.getByText(/HỒI · SÓNG GIÓ/)).toBeInTheDocument();
    expect(screen.getByText('CÒN 31s')).toBeInTheDocument();
    const la = document.querySelector('[data-ky-ngo-la="la_ban"]') as HTMLButtonElement;
    // Mặt trước: mô tả nhiệm vụ; chưa lộ đặc quyền.
    expect(la.textContent).not.toContain('QUÀ la_ban');
    fireEvent.click(la);
    expect(onChon).not.toHaveBeenCalled();
    expect(la.textContent).toContain('QUÀ la_ban');
    fireEvent.click(la);
    expect(onChon).toHaveBeenCalledWith('la_ban');
  });

  it('BỎ QUA là nút thật ⇒ onDong; đã chọn thì nút thành XONG', () => {
    const onDong = vi.fn();
    const { rerender } = render(
      <KyNgoPhu moi={['la_ban']} bang={BANG} dangChon={null} onChon={() => {}}
        tenHoi="Tiền rẻ" onDong={onDong} />,
    );
    fireEvent.click(screen.getByRole('button', { name: /BỎ QUA/ }));
    expect(onDong).toHaveBeenCalledTimes(1);
    rerender(
      <KyNgoPhu moi={['la_ban']} bang={BANG} dangChon="la_ban" onChon={() => {}}
        tenHoi="Tiền rẻ" onDong={onDong} />,
    );
    expect(screen.getByRole('button', { name: /XONG/ })).toBeInTheDocument();
  });

  it('thanh gọn: nói đang đi con đường nào, bấm ⇒ onMo', () => {
    const onMo = vi.fn();
    render(<KyNgoThanh dangChon="la_ban" bang={BANG} onMo={onMo} />);
    expect(screen.getByText(/đang đi/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button'));
    expect(onMo).toHaveBeenCalledTimes(1);
  });
});
