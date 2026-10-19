/**
 * D432 — SHOP: LƯỢT CHỌN LÀ MỘT MÀN RIÊNG + BÀN CƯỢC GỌN (founder 27/09).
 *
 * Nguyên văn: *"phấn shop đang hơi rối mắt và khó thao tác, cải tiến đi"* → *"Quá nhiều thứ trên 1 màn hình"* → chọn
 * phương án B (gọn bàn cược + tách lượt chọn lõi/trait ra màn riêng) → *"Phần trống ra từ chỗ bỏ đi trong shop thì hiện
 * lõi đang nắm và trait đang giữ"*.
 *
 * Đo trên engine thật ở 375px trước khi sửa: vòng thường 21 chỗ bấm · 18 mẩu chữ; xếp MỘT lệnh 37 mẩu chữ · 102 từ (tiền
 * mặt in bốn lần, lệnh vừa đặt hiện bốn chỗ); vòng lõi 28 chỗ bấm.
 *
 * Bài khoá năm điều:
 *   §I   vòng LÕI mở vào MÀN CHỌN; chọn lõi vẫn một chạm (MUA) rồi tự sang bàn; không giấu (◆ quay lại một chạm);
 *   §II  vòng MỐC TRAIT: chợ ở màn chọn, nút chính đọc cái cân (lệch thì khoá + nói lệch bao nhiêu);
 *   §III bàn cược gọn: mỗi con số một chỗ đứng (VÍ →sau, lá trước→sau, PHÍ ở hàng lệnh, bảng sau lệnh vào tấm);
 *   §IV  TAY = lõi đang nắm + trait đang giữ — D569: luôn giữ chỗ, tay trắng nói một dòng;
 *   §V   dây nối ở màn trận (quét mã nguồn — họ lỗi "cơ chế trang trí");
 *   §VI  D569 — TÌNH HÌNH trên nỉ: thẻ vừa lật ▸ ô sắp lật · lăng kính danh mục trước → sau.
 */
import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { useState } from 'react';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { NAV_V10 } from '@config/holdem';

vi.mock('@/lib/telemetry', () => ({ ghiDo: () => {} }));

import { ShopManHinh } from '../src/components/holdem/ShopManHinh';
import { ChoTrait } from '../src/components/holdem/ChoTrait';
import { NHIP } from '../src/lib/nhip';

const TAI_SAN = [
  { id: 'btc', ten: 'Crypto', mau: ['#f7931a', 'rgba(247,147,26,.22)'] as const },
  { id: 'vang', ten: 'Vàng', mau: ['#fbbf24', 'rgba(251,191,36,.22)'] as const },
];
const LOI = [
  { id: 'luot_song', ten: 'Lướt Sóng', mau: ['#22d3ee', 'rgba(34,211,238,.22)'] as const },
  { id: 'mua_duoi', ten: 'Mua Đuổi', mau: ['#a78bfa', 'rgba(167,139,250,.22)'] as const },
];
type Props = Parameters<typeof ShopManHinh>[0];
type Nav = NonNullable<Props['nav']>;

/** Shop trên một bàn có STATE chọn lõi thật (cha giữ `chonCT` như màn trận). */
function Ban({ nav = {}, them = {} }: { nav?: Partial<Nav>; them?: Partial<Props> }) {
  const [chonCT, setChonCT] = useState<string | null>(null);
  const [chonTS, setChonTS] = useState<string[]>([]);   // D540 — phiếu lệnh mọc trên thẻ đang chọn
  return (
    <ShopManHinh
      vong={2} loaiVongNay="tai_san" vongMoTiepTheo={{ tai_san: null, chien_thuat: null }}
      taiSan={TAI_SAN} chienThuat={LOI} chonTS={chonTS} chonCT={chonCT}
      onChonTS={(id) => setChonTS((c) => (c.includes(id) ? c.filter((x) => x !== id) : [...c, id]))} onChonCT={(id) => setChonCT((c) => (c === id ? null : id))}
      danhMuc={[]} sucChuaTaiSan={4} sucChuaChienThuat={3} art={{}}
      ganVao={null} onGan={() => {}} phamViThe={() => 'danh_muc'}
      doiGan={{}} onDoiGan={() => {}}
      chiPhiRoll={0} luotConLai={2} onRoll={() => {}} onDong={() => {}} onChotVong={() => {}}
      tuDien={{ tai_san: {}, chien_thuat: {}, muc: [] } as never}
      giaiDoanNhan={[]} suKienNhan={[]} moTaChienThuat={() => undefined}
      nav={{
        tienMat: 10000, viThe: {}, buocMocBp: NAV_V10.BUOC_MOC_THO_BP, lenh: [],
        onThem: () => {}, onXoa: () => {}, startVon: 10000, lenhTruoc: [],
        ...nav,
      }}
      {...them}
    />
  );
}
const q = (sel: string) => document.querySelector(sel);

describe('I. vòng LÕI mở vào MÀN CHỌN', () => {
  it('⭐ màn chọn đứng trước: lá lõi, KHÔNG hàng chip, KHÔNG lưới tài sản — hai quyết định không tranh một khung hình', () => {
    render(<Ban them={{ loaiVongNay: 'chien_thuat' }} />);
    expect(q('[data-man="chon"]')).not.toBeNull();
    expect(q('[data-man="chon"] [data-tap="shop-loi"]')).not.toBeNull();
    expect(q('[data-hang-chip]'), 'hàng chip lọt sang màn chọn').toBeNull();
    expect(q('[data-tap="shop-taisan"]'), 'lưới tài sản lọt sang màn chọn').toBeNull();
  });

  it('⭐ D526 — "⟳ ĐỔI LÕI · FREE" nằm TRONG khung lõi, dưới hai lá (founder: "đổi lõi ở dưới 2 lõi"); đáy chỉ còn nút chính', () => {
    let roll = 0;
    render(<Ban them={{ loaiVongNay: 'chien_thuat', onRoll: () => { roll += 1; } }} />);
    expect(q('[data-day-chon] [data-tap="doi-loi"]'), 'nút đổi lõi còn ở đáy màn chọn').toBeNull();
    expect(q('[data-day-chon]')!.querySelectorAll('button')).toHaveLength(1);
    const doi = q('[data-tap="shop-loi"] [data-tap="doi-loi"]') as HTMLButtonElement;
    expect(doi, 'nút đổi lõi không nằm trong khung lõi').not.toBeNull();
    const laCuoi = [...q('[data-tap="shop-loi"]')!.querySelectorAll('[data-card]')].pop()!;
    expect(laCuoi.compareDocumentPosition(doi) & Node.DOCUMENT_POSITION_FOLLOWING, 'nút phải đứng DƯỚI hai lá').toBeTruthy();
    expect(doi.textContent).toMatch(/⟳ĐỔI LÕIMIỄN PHÍ/);
    fireEvent.click(doi);
    expect(roll).toBe(1);
    const nut = q('[data-tap="vao-ban"]') as HTMLButtonElement;
    expect(nut.textContent).toMatch(/BỎ QUA/);
    fireEvent.click(nut);
    expect(q('[data-man="chon"]')).toBeNull();
    expect(q('[data-hang-chip]')).not.toBeNull();
    expect(q('[data-tap="shop-taisan"]')).not.toBeNull();
  });

  it('⭐ D526 — đổi lõi MỘT lần: hết lượt (`doiLoiHet`) ⇒ nút khoá, nói "ĐÃ ĐỔI LÕI"', () => {
    let roll = 0;
    render(<Ban them={{ loaiVongNay: 'chien_thuat', doiLoiHet: true, onRoll: () => { roll += 1; } }} />);
    const doi = q('[data-tap="doi-loi"]') as HTMLButtonElement;
    expect(doi.disabled).toBe(true);
    expect(doi.textContent).toBe('ĐÃ ĐỔI LÕI');
    fireEvent.click(doi);
    expect(roll).toBe(0);
  });

  it('⭐ D526 — không còn nút MUA dưới lá lõi: chạm lá ⇒ tờ chú thích có ĐÓNG / LẤY LÕI NÀY (như tấm trait)', () => {
    render(<Ban them={{ loaiVongNay: 'chien_thuat' }} />);
    expect(screen.queryAllByRole('button', { name: 'MUA' }), 'nút MUA còn dưới lá lõi').toHaveLength(0);
    fireEvent.click(q('[data-tap="shop-loi"] [data-card="luot_song"]')!);
    expect(screen.getByRole('dialog', { name: /Giải thích Lướt Sóng/ })).toBeTruthy();
    expect(q('[data-tap="lay-loi"]')!.textContent).toBe('LẤY LÕI NÀY');
    fireEvent.click(q('[data-tap="khong-lay-loi"]')!);
    expect(screen.queryByRole('dialog', { name: /Giải thích/ }), 'ĐÓNG = không lấy, tờ phải đóng').toBeNull();
    expect(q('[data-card="luot_song"]')!.getAttribute('aria-pressed')).toBe('false');
  });

  it('⭐ chọn lõi = chạm lá → LẤY LÕI NÀY rồi tự sang bàn; ◆ ở đầu mục TÀI SẢN nói lõi đã lấy và quay lại được', async () => {
    render(<Ban them={{ loaiVongNay: 'chien_thuat' }} />);
    fireEvent.click(q('[data-tap="shop-loi"] [data-card="luot_song"]')!);
    fireEvent.click(q('[data-tap="lay-loi"]')!);
    await waitFor(() => expect(q('[data-man="chon"]')).toBeNull(), { timeout: NHIP.CHON_XONG_SANG_BAN + 1500 });
    const ve = q('[data-tap="shop-taisan"] header [data-tap="ve-chon"]') as HTMLButtonElement;
    expect(ve, 'bàn cược không có đường quay lại màn chọn — thành ngăn kéo giấu việc').not.toBeNull();
    expect(ve.textContent).toMatch(/◆ LƯỚT SÓNG/);
    fireEvent.click(ve);
    expect(q('[data-man="chon"]')).not.toBeNull();
  });

  it('(tiêm ngược) chưa lấy lõi nào thì KHÔNG tự sang bàn', async () => {
    render(<Ban them={{ loaiVongNay: 'chien_thuat' }} />);
    await new Promise((r) => setTimeout(r, NHIP.CHON_XONG_SANG_BAN + 150));
    expect(q('[data-man="chon"]')).not.toBeNull();
  });

  it('shop khoá vì ĐÃ ALL-IN ⇒ không màn chọn', () => {
    render(<Ban them={{ loaiVongNay: 'chien_thuat', daAllIn: true }} />);
    expect(q('[data-man="chon"]')).toBeNull();
  });
});

describe('II. vòng MỐC TRAIT — chợ ở màn chọn, nút chính đọc cái cân', () => {
  const CHO = <section data-testid="cho-trait-gia">chợ</section>;
  const CUON = <button type="button" data-tap="cuon-trait">⟳ ĐỔI TRAIT · 2 XU</button>;

  it('chợ đứng trên màn chọn; đáy chỉ còn nút chính (ĐỔI TRAIT ở đầu chợ, dưới XU — D526); bàn cược chưa hiện', () => {
    render(<Ban them={{ choTrait: CHO }} />);
    expect(screen.getByTestId('cho-trait-gia').closest('[data-man="chon"]')).not.toBeNull();
    expect(q('[data-day-chon]')!.querySelectorAll('button')).toHaveLength(1);
    expect(q('[data-hang-chip]')).toBeNull();
  });

  it('⭐ D526 — ChoTrait đặt nút ĐỔI TRAIT ngay DƯỚI ô XU ở đầu chợ (founder: "Đổi trait ở dưới xu")', () => {
    render(<ChoTrait moc={4} moi={[]} xu={10} lanCuon={0} chon={[]} onChon={() => {}} nutCuon={CUON} />);
    const vi = screen.getByLabelText('Ví xu 10');
    const nut = q('[data-tap="cuon-trait"]')!;
    expect(vi.parentElement, 'nút không cùng cột với ô XU').toBe(nut.parentElement);
    expect(vi.compareDocumentPosition(nut) & Node.DOCUMENT_POSITION_FOLLOWING, 'nút phải đứng dưới XU').toBeTruthy();
  });

  it('⭐ chưa lấy ⇒ BỎ QUA · lệch ⇒ khoá + nói lệch bao nhiêu · cân 0 ⇒ VÀO BÀN CƯỢC', () => {
    const { rerender } = render(<Ban them={{ choTrait: CHO, canTrait: { can: 0, soChon: 0 } }} />);
    const nut = () => q('[data-tap="vao-ban"]') as HTMLButtonElement;
    expect(nut().textContent).toMatch(/BỎ QUA/);
    expect(nut().disabled).toBe(false);
    rerender(<Ban them={{ choTrait: CHO, canTrait: { can: 2, soChon: 1 } }} />);
    expect(nut().disabled, 'lệch cân mà vẫn cho sang bàn').toBe(true);
    expect(nut().textContent).toMatch(/LỆCH \+2/);
    rerender(<Ban them={{ choTrait: CHO, canTrait: { can: 0, soChon: 2 } }} />);
    expect(nut().disabled).toBe(false);
    expect(nut().textContent).toMatch(/VÀO BÀN CƯỢC/);
  });

  it('◆ ở bàn cược nói cái cân: "LỆCH −2" tô đỏ; bấm ⇒ cha nhận bước "chon"', () => {
    const buoc: string[] = [];
    render(<Ban them={{
      choTrait: CHO, canTrait: { can: -2, soChon: 1 }, buocChon: 'ban', onBuocChon: (b) => { buoc.push(b); },
    }} />);
    expect(q('[data-man="chon"]'), 'cha nói bàn mà shop vẫn mở màn chọn').toBeNull();
    const ve = q('[data-tap="ve-chon"]') as HTMLButtonElement;
    expect(ve.textContent).toMatch(/◆ TRAIT · LỆCH −2/);
    expect(ve.className).toMatch(/nutVeChonLech/);
    fireEvent.click(ve);
    expect(buoc).toEqual(['chon']);
  });
});

describe('II-b. D526 nhịp xen kẽ — vòng có CẢ lượt lõi LẪN chợ trait: một màn chọn mang cả hai', () => {
  const CHO = <section data-testid="cho-trait-gia">chợ</section>;

  it('⭐ lá lõi ĐỨNG TRÊN chợ trait trong cùng màn chọn; ĐỔI LÕI trong khung lõi', () => {
    render(<Ban them={{ loaiVongNay: 'chien_thuat', choTrait: CHO }} />);
    const man = q('[data-man="chon"] [data-tap="man-chon"]')!;
    expect(man.getAttribute('data-luot')).toBe('ca_hai');
    const loi = man.querySelector('[data-tap="shop-loi"]');
    const cho = screen.getByTestId('cho-trait-gia');
    expect(loi, 'mất hàng lõi').not.toBeNull();
    expect(man.contains(cho)).toBe(true);
    expect(loi!.compareDocumentPosition(cho) & Node.DOCUMENT_POSITION_FOLLOWING, 'lõi phải đứng trên chợ').toBeTruthy();
    expect(q('[data-tap="shop-loi"] [data-tap="doi-loi"]')).not.toBeNull();
  });

  it('⭐ lấy lõi KHÔNG tự sang bàn (còn chợ trait phải cân); nút chính khoá theo cân của trait', async () => {
    const buoc: string[] = [];
    const { rerender } = render(<Ban them={{
      loaiVongNay: 'chien_thuat', choTrait: CHO, canTrait: { can: 0, soChon: 0 }, onBuocChon: (b) => { buoc.push(b); },
    }} />);
    fireEvent.click(q('[data-tap="shop-loi"] [data-card="luot_song"]')!);
    fireEvent.click(q('[data-tap="lay-loi"]')!);
    await new Promise((ok) => setTimeout(ok, NHIP.CHON_XONG_SANG_BAN + 80));
    expect(buoc, 'lấy lõi mà bị đẩy sang bàn, bỏ dở chợ trait').toEqual([]);
    const nut = () => q('[data-tap="vao-ban"]') as HTMLButtonElement;
    expect(nut().disabled).toBe(false);
    rerender(<Ban them={{ loaiVongNay: 'chien_thuat', choTrait: CHO, canTrait: { can: 1, soChon: 1 } }} />);
    expect(nut().disabled, 'trait lệch cân mà vẫn cho sang bàn').toBe(true);
  });
});

describe('III. bàn cược gọn — mỗi con số một chỗ đứng', () => {
  it('vòng thường: không màn chọn, không nhãn CHUNG BÀN, không phụ đề, không dòng hẹn khung đứt; ô phải = "◆ LÕI Ở VÒNG 8"', () => {
    render(<Ban them={{ vongMoTiepTheo: { tai_san: null, chien_thuat: 8 } }} />);
    expect(q('[data-man="chon"]')).toBeNull();
    const dau = q('[data-tap="shop-taisan"] header')!;
    expect(dau.textContent).not.toMatch(/CHUNG BÀN/);
    expect(dau.textContent).not.toMatch(/cả bàn thấy chung/);
    expect(q('[data-hen-loi]')?.textContent).toMatch(/◆ LÕI Ở VÒNG 8/);
    expect(document.body.textContent).not.toMatch(/LÕI CHIẾN THUẬT tiếp theo/);
  });

  it('tay không thì đầu màn im (không "CẦM CHIP", không dòng mời); chạm mã ⇒ phiếu + "CHẠM MỘT CHIP" (D540)', () => {
    render(<Ban />);
    expect(document.body.textContent).not.toMatch(/CẦM CHIP|cầm một chip/);
    fireEvent.click(document.querySelector('[data-card]') as HTMLElement);
    expect(document.body.textContent).toMatch(/CHẠM MỘT CHIP/);
  });

  it('⭐ xếp một lệnh: VÍ →sau, lá in trước→sau, PHÍ ở hàng lệnh; bảng DANH MỤC SAU LỆNH chỉ ở trong tấm', () => {
    render(<Ban nav={{ lenh: [{ ma: 'btc', chieu: 'mua', moc_bp: 2500 }] }} />);
    expect(q('[data-vi-sau]')?.textContent).toMatch(/→7\.500/);
    expect(q('[data-card="btc"] [data-sau-lenh]')?.textContent).toMatch(/^0→\d/);
    expect(document.body.textContent, 'bảng sau lệnh còn đứng trên nỉ').not.toMatch(/DANH MỤC SAU LỆNH/);
    fireEvent.click(q('[data-tap="shop-xemtruoc"]')!);
    expect(q('[data-tam="sau"]')?.textContent).toMatch(/DANH MỤC SAU LỆNH/);
  });

  it('(tiêm ngược) không có lệnh ⇒ không số sau lệnh, không PHÍ, không tấm', () => {
    render(<Ban />);
    expect(q('[data-vi-sau]')).toBeNull();
    expect(q('[data-sau-lenh]')).toBeNull();
    expect(q('[data-tap="shop-xemtruoc"]')).toBeNull();
  });
});

describe('IV. TAY = lõi đang nắm + trait đang giữ (founder 27/09)', () => {
  /*
   * D569 (founder 10/10: *"thu bớt diện tích để nơi hiển thị lõi/trait đang nắm"*) — thay luật 27/09 "không cầm gì ⇒ không có
   * khối TAY": chỗ của TAY được GIỮ từ vòng 1 (bàn tiền cố định), tay trắng nói MỘT dòng. Hộp chữ cũ vẫn không quay lại.
   */
  it('không cầm gì ⇒ TAY vẫn giữ chỗ, một dòng "chưa nắm lõi" (D569), không hộp "chưa cầm lá chiến thuật nào"', () => {
    render(<Ban />);
    const tay = screen.getByTestId('tay-gon');
    expect(tay.querySelector('[data-tay-trong]')?.textContent).toMatch(/^chưa nắm lõi nào$/);
    expect(document.body.textContent).not.toMatch(/chưa cầm lá chiến thuật/);
  });

  it('D569 — lõi tới ở vòng sau ⇒ dòng trống nói đúng vòng; đang có lõi thì không còn dòng trống', () => {
    const { unmount } = render(<Ban them={{ vongMoTiepTheo: { tai_san: null, chien_thuat: 5 }, traitDangGiu: [] }} />);
    expect(q('[data-tay-trong]')?.textContent).toBe('chưa nắm lõi — lõi tới ở vòng 5 · chưa giữ trait');
    unmount();
    render(<Ban them={{ danhMuc: [{ id: 'luot_song', ten: 'Lướt Sóng', mau: LOI[0]!.mau, cap: 1, loai: 'chien_thuat' }] }} />);
    expect(q('[data-tay-trong]')).toBeNull();
  });

  it('⭐ đang giữ trait ⇒ TAY hiện hàng trait, chạm để đọc', () => {
    render(<Ban them={{ traitDangGiu: ['ghim_don_bay'] }} />);
    expect(screen.getByTestId('tay-gon')).toBeTruthy();
    expect(q('[data-tay-trait] [data-trait="ghim_don_bay"]')).not.toBeNull();
  });

  it('đang nắm một lõi ⇒ TAY hiện lá lõi', () => {
    render(<Ban them={{ danhMuc: [{ id: 'luot_song', ten: 'Lướt Sóng', mau: LOI[0]!.mau, cap: 1, loai: 'chien_thuat' }] }} />);
    expect(screen.getByTestId('tay-gon').textContent).toMatch(/LƯỚT SÓNG/);
  });
});

describe('V. dây nối ở màn trận', () => {
  const man = readFileSync(resolve(process.cwd(), 'src/screens/holdem/AlphaDraftMatch.tsx'), 'utf8');

  it('bước màn chọn sống ở màn nộp vòng (qua đóng/mở shop), và TAY nhận trait đang giữ', () => {
    expect(man).toMatch(/buocChon=\{daQuaChon === st\.vong \? 'ban' : 'chon'\}/);
    expect(man).toMatch(/onBuocChon=\{\(buoc\) => setDaQuaChon\(buoc === 'ban' \? st\.vong : null\)\}/);
    expect(man).toMatch(/traitDangGiu=\{b\.trait\}/);
  });

  it('⭐ CHỐT bị chặn vì trait lệch cân ⇒ shop mở THẲNG vào chợ (màn chọn), đúng chỗ phải sửa', () => {
    const chan = /const chanTraitLech = \(\): void => \{([\s\S]*?)\n {2}\};/.exec(man)?.[1] ?? '';
    expect(chan, 'không thấy thân chanTraitLech').not.toBe('');
    expect(chan, 'chặn CHỐT mà không đưa người chơi về chợ').toContain('setDaQuaChon(null)');
    expect(chan).toContain('setShopMo(true)');
  });
});

describe('VI. D569 — TÌNH HÌNH trên nỉ bàn cược (founder 10/10)', () => {
  const TS_CAT = [
    { id: 'btc', label: 'Crypto', nhom: 'rui_ro' },
    { id: 'vang', label: 'Vàng', nhom: 'phong_thu' },
  ] as never;
  const THE_LAT = {
    vua: { svg: '<svg data-art-vua></svg>', ten: 'THIÊN NGA ĐEN', mau: '#ef4444' },
    sap: { so: 3, glyph: '⚖', nhan: 'KỲ HỌP' },
  };

  it('⭐ thẻ VỪA LẬT (art + tên) ▸ ô SẮP LẬT (số ô + chữ của bản đồ) đứng trên nỉ', () => {
    render(<Ban them={{ theLat: THE_LAT }} />);
    const vua = q('[data-tinh-hinh] [data-the-lat="vua"]')!;
    expect(vua.textContent).toBe('VỪA LẬTTHIÊN NGA ĐEN');
    expect(vua.querySelector('[data-art-vua]'), 'art của lá vừa lật không lên').not.toBeNull();
    expect(q('[data-the-lat="sap"]')!.textContent).toBe('⚖Ô 3KỲ HỌP');
  });

  it('lá vừa lật bị che / hết dãy ⇒ nói ra, không để ô trống câm', () => {
    render(<Ban them={{ theLat: { vua: undefined, sap: undefined } }} />);
    expect(q('[data-the-lat="vua"]')!.textContent).toBe('?VỪA LẬTĐANG ÚP');
    expect(q('[data-the-lat="sap"]')!.textContent).toBe('–HẾT DÃYKHÔNG CÒN Ô');
  });

  it('⭐ DANH MỤC đọc vị thế thật: 5.000 Crypto + 5.000 tiền ⇒ rủi ro 50 % · tiền mặt 50 %', () => {
    render(<Ban nav={{ viThe: { btc: 5000 }, tienMat: 5000 }} them={{ taiSanCat: TS_CAT }} />);
    const lk = q('[data-tinh-hinh] [data-tap="lang-kinh"]')!;
    expect(lk.textContent).toMatch(/RỦI RO 50%/);
    expect(lk.textContent).toMatch(/PHÒNG THỦ 0%/);
    expect(lk.textContent).toMatch(/TIỀN MẶT 50%/);
  });

  it('⭐ thứ tự trên nỉ: TÌNH HÌNH → TAY → sáu lá (chỗ cố định, lá không lấp cả nỉ nữa)', () => {
    render(<Ban them={{ theLat: THE_LAT, taiSanCat: TS_CAT }} />);
    const th = q('[data-tinh-hinh]')!;
    const tay = screen.getByTestId('tay-gon');
    const luoi = q('[data-tap="shop-taisan"]')!;
    expect(th.compareDocumentPosition(tay) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(tay.compareDocumentPosition(luoi) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });

  it('màn chọn lõi không mang khối tình hình (một quyết định một khung hình)', () => {
    render(<Ban them={{ loaiVongNay: 'chien_thuat', theLat: THE_LAT }} />);
    expect(q('[data-man="chon"]')).not.toBeNull();
    expect(q('[data-tinh-hinh]')).toBeNull();
  });

  it('⭐ CSS: sáu lá giữ tỉ lệ 3:4 và lưới thôi phình lấp nỉ (founder: "đang bị kéo dài theo chiều dọc")', () => {
    const css = readFileSync(resolve(process.cwd(), 'src/components/holdem/ShopManHinh.module.css'), 'utf8')
      .replace(/\/\*[\s\S]*?\*\//g, '');
    /** Khối CUỐI CÙNG của một bộ chọn — cùng độ ưu tiên thì khối sau thắng. */
    const khoiCuoi = (chon: string) => {
      const khoi = css.split('}').map((k) => k.split('{')).filter((k) => k.length === 2 && k[0]!.trim() === chon);
      expect(khoi.length, `không thấy khối ${chon}`).toBeGreaterThan(0);
      return khoi[khoi.length - 1]![1]!;
    };
    expect(khoiCuoi('.ni .luoiThe > * > button[data-card]')).toMatch(/aspect-ratio:\s*3\s*\/\s*4/);
    expect(khoiCuoi('.ni .luoiThe')).toMatch(/flex:\s*0 0 auto/);
    expect(khoiCuoi('.ni .mucCao')).toMatch(/flex:\s*0 0 auto/);
  });

  it('dây nối: màn trận dựng `theLat` từ đúng dữ liệu bản đồ (o_lich · loai_la_ke · con_lai)', () => {
    const man = readFileSync(resolve(process.cwd(), 'src/screens/holdem/AlphaDraftMatch.tsx'), 'utf8');
    const i = man.indexOf('theLat={');
    expect(i, 'màn trận không truyền theLat vào shop').toBeGreaterThan(0);
    const than = man.slice(i, i + 2200);
    for (const k of ['st.o_lich', 'loai_la_ke', 'bo_bai_con_lai.con_lai', 'matLa(']) expect(than).toContain(k);
  });
});
