/**
 * D342 — SHOP NÓI THẬT VỀ LỆNH KHỐNG (founder 16/09: *"Bán khống bị lỗi lúc đặt lệnh/ chia
 * chip ấy. Nó đ** được tính vào chip khống"*).
 *
 * Trận 20:52 dựng lại bằng `replay()` cho thấy chuỗi thật: xếp "KHỐNG … 100%" ⇒ khối DANH MỤC
 * SAU LỆNH biến mất im lặng (bản nháp hỏng) ⇒ bấm CHỐT ⇒ server bác CẢ chuỗi (`qua_tran_khong`)
 * ⇒ cọc khống không mọc, lệnh bán đi kèm cũng mất ⇒ không một chữ nào trên màn. Bốn vòng liền.
 *
 * Bài này khoá phần MÀN của bản vá (phần engine ở `tests/ban_khong_v49.test.ts` gốc):
 *   §I   bản nháp có dòng SỔ KHỐNG và nói hạn mức còn lại;
 *   §II  chuỗi sẽ bị bác thì NÓI TRƯỚC khi chốt, và khoá thêm tiền ra;
 *   §III hết hạn mức khống ⇒ chip KHỐNG tắt;
 *   §IV  lệnh vòng trước bị bác ⇒ nói ra;
 *   §V   bảng chữ lỗi: đủ mã, không mã thô, không kê đơn (A10);
 *   §VI  xem trước tính phí theo sổ của VAI như server;
 *   §VII dây nối ở màn trận — các cờ phải TỚI được shop (họ lỗi "cơ chế trang trí").
 */
import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { BAN_KHONG_LENH, NAV_V10 } from '@config/holdem';
import { apLenhGiaoDich, giaiLenhMoc, hanMucKhongCon } from '@server/holdem/nav';

vi.mock('@/lib/telemetry', () => ({ ghiDo: () => {} }));

import { ShopManHinh } from '../src/components/holdem/ShopManHinh';
import { CHU_LOI_LENH, LOI_LENH_BIET_CHAC, chuLoiLenh } from '../src/lib/loi_lenh';
import { xemTruocLenh } from '../src/lib/xemTruocLenh';

const TAI_SAN = [
  { id: 'btc', ten: 'Crypto', mau: ['#f7931a', 'rgba(247,147,26,.22)'] as const },
  { id: 'vang', ten: 'Vàng', mau: ['#fbbf24', 'rgba(251,191,36,.22)'] as const },
];
type Lenh = { ma: string; chieu: 'mua' | 'ban' | 'khong' | 'dong_khong'; moc_bp: number };
type Nav = NonNullable<Parameters<typeof ShopManHinh>[0]['nav']>;

type Them = Partial<Parameters<typeof ShopManHinh>[0]>;
function dung(nav: Partial<Nav>, them: Them = {}) {
  return render(
    <ShopManHinh
      vong={9} loaiVongNay="tai_san" vongMoTiepTheo={{ tai_san: null, chien_thuat: null }}
      taiSan={TAI_SAN} chienThuat={[]} chonTS={['btc']} chonCT={null}   /* D540 — phiếu lệnh mọc trên thẻ đang chọn */
      onChonTS={() => {}} onChonCT={() => {}}
      danhMuc={[]} sucChuaTaiSan={4} sucChuaChienThuat={3} art={{}}
      ganVao={null} onGan={() => {}} phamViThe={() => 'danh_muc'}
      doiGan={{}} onDoiGan={() => {}}
      chiPhiRoll={1} luotConLai={1} onRoll={() => {}} onDong={() => {}} onChotVong={() => {}}
      tuDien={{ tai_san: {}, chien_thuat: {}, muc: [] } as never}
      giaiDoanNhan={[]} suKienNhan={[]} moTaChienThuat={() => undefined}
      nav={{
        tienMat: 9868, viThe: {}, viKhong: { btc: 2421 }, coBanKhong: true,
        buocMocBp: NAV_V10.BUOC_MOC_THO_BP, lenh: [], onThem: () => {}, onXoa: () => {},
        startVon: 10000, lenhTruoc: [],
        ...nav,
      }}
      {...them}
    />,
  );
}
const KHONG_100: Lenh[] = [{ ma: 'btc', chieu: 'khong', moc_bp: 10000 }];
/** D432 — bảng DANH MỤC SAU LỆNH rời mặt nỉ vào tấm trượt, mở bằng nút PHÍ ở hàng lệnh. */
const moSauLenh = () => { fireEvent.click(document.querySelector('[data-tap="shop-xemtruoc"]')!); };

describe('I. bản nháp có SỔ KHỐNG (trận vòng 9: tiền 9.868, khống btc 2.421)', () => {
  it('⭐ v49: KHỐNG 100% ⇒ dòng "KHỐNG CRYPTO 2.421 → …" mọc lên, không có dòng lỗi', () => {
    dung({ khongTheoHanMuc: true, lenh: KHONG_100 });
    moSauLenh();
    const hang = screen.getByTestId('xt-khong-btc');
    expect(hang.textContent).toContain('KHỐNG CRYPTO');
    expect(hang.textContent).toContain('2.421');
    const sau = Number((hang.textContent ?? '').split('→')[1]!.replace(/\D/g, ''));
    expect(sau, 'ký quỹ sau lệnh phải lớn hơn trước').toBeGreaterThan(2421);
    // Không vượt trần: đúng hạn mức 1.265 trừ trượt giá.
    expect(sau).toBeLessThanOrEqual(2421 + 1265);
    expect(screen.queryByTestId('chuoi-loi')).toBeNull();
  });

  it('dòng hạn mức nói ĐÚNG số lõi server tính trên bản nháp', () => {
    dung({ khongTheoHanMuc: true, lenh: KHONG_100 });
    moSauLenh();
    const xt = xemTruocLenh({ tienMat: 9868, viThe: {}, viKhong: { btc: 2421 } },
      KHONG_100, NAV_V10.BUOC_MOC_THO_BP, true, false, 1, undefined, false, true)!;
    const mong = hanMucKhongCon({ von: xt.tienMatSau, vi_the: xt.viTheSau, vi_the_khong: xt.viKhongSau });
    expect(screen.getByTestId('han-muc-khong').textContent)
      .toBe(mong.toLocaleString('vi-VN'));
  });
});

describe('II. chuỗi sẽ bị bác ⇒ NÓI TRƯỚC khi chốt', () => {
  it('⭐ trận ≤ v48 (chip KHỐNG theo tiền mặt): 100% ⇒ dòng đỏ nói vượt trần, không im lặng', () => {
    dung({ khongTheoHanMuc: false, lenh: KHONG_100 });
    const loi = screen.getByTestId('chuoi-loi');
    expect(loi.getAttribute('data-loi')).toBe('qua_tran_khong');
    expect(loi.textContent).toContain(`${BAN_KHONG_LENH.TRAN_BP / 100}%`);
    expect(loi.textContent).toContain('TỪ CHỐI');
  });

  it('chuỗi hỏng ⇒ chip MUA/KHỐNG tắt (không chồng thêm lệnh lên một chuỗi sẽ bị bác)', () => {
    dung({ khongTheoHanMuc: false, lenh: KHONG_100 });
    const chip = document.querySelector('[data-phieu-lenh] [data-moc="2500"]') as HTMLButtonElement;
    expect(chip.disabled).toBe(true);
  });

  it('chuỗi hợp lệ ⇒ không có dòng lỗi', () => {
    dung({ khongTheoHanMuc: false, lenh: [{ ma: 'btc', chieu: 'mua', moc_bp: 2500 }] });
    expect(screen.queryByTestId('chuoi-loi')).toBeNull();
  });
});

describe('III. hết hạn mức khống ⇒ chip KHỐNG tắt', () => {
  it('sổ khống đã vượt trần vì giá chạy ⇒ mặt KHỐNG không bấm được chip nào', () => {
    dung({ khongTheoHanMuc: true, tienMat: 100, viKhong: { btc: 5000 } });
    fireEvent.click(screen.getByRole('button', { name: 'KHỐNG' }));
    const chips = [...document.querySelectorAll('[data-phieu-lenh] [data-moc]')] as HTMLButtonElement[];
    expect(chips.length).toBeGreaterThan(0);
    expect(chips.every((c) => c.disabled), 'hết hạn mức mà chip KHỐNG vẫn bấm được').toBe(true);
  });

  it('còn hạn mức ⇒ chip KHỐNG bấm được, và chip 100% in đúng hạn mức còn (D432: mẫu số in trên chip)', () => {
    dung({ khongTheoHanMuc: true });
    fireEvent.click(screen.getByRole('button', { name: 'KHỐNG' }));
    const chip = document.querySelector('[data-phieu-lenh] [data-moc="10000"]') as HTMLButtonElement;
    expect(chip.disabled).toBe(false);
    expect(chip.querySelector('[data-so-moc]')?.textContent).toBe('1.265');
  });
});

describe('IV. lệnh vòng trước bị bác ⇒ shop nói ra', () => {
  it('⭐ có `loiLenhVongTruoc` và chưa xếp lệnh mới ⇒ dòng báo với chữ của bảng lỗi', () => {
    dung({ loiLenhVongTruoc: 'qua_tran_khong' });
    const dong = screen.getByTestId('loi-lenh-vong-truoc');
    expect(dong.textContent).toContain(chuLoiLenh('qua_tran_khong'));
    expect(dong.textContent, 'in mã thô là chưa sửa').not.toContain('qua_tran_khong');
  });

  it('bắt đầu xếp lệnh mới ⇒ dòng của vòng trước lui, nhường dòng của chuỗi đang xếp', () => {
    dung({ loiLenhVongTruoc: 'qua_tran_khong', lenh: [{ ma: 'btc', chieu: 'mua', moc_bp: 2500 }] });
    expect(screen.queryByTestId('loi-lenh-vong-truoc')).toBeNull();
  });
});

describe('V. bảng chữ lỗi lệnh', () => {
  /** Mọi mã `LoiLenh` của lõi + ba mã của cửa engine — đọc từ nguồn, không gõ lại tay. */
  const maTuNguon = (() => {
    const nav = readFileSync(resolve(process.cwd(), '../server/holdem/nav.ts'), 'utf8');
    const khoi = /export type LoiLenh =([\s\S]*?);/.exec(nav)![1]!;
    return [...khoi.matchAll(/'([a-z_]+)'/g)].map((m) => m[1]!)
      .concat(['moc_khong_hop_le', 'nav_tat', 'khong_chon_bai_duoc']);
  })();

  it('mọi mã lõi có thể trả đều có câu (thêm mã mới mà quên câu ⇒ đỏ)', () => {
    expect(maTuNguon.length).toBeGreaterThan(8);
    for (const ma of maTuNguon) expect(CHU_LOI_LENH[ma], `thiếu câu cho ${ma}`).toBeTruthy();
  });

  it('không câu nào lộ mã thô, không câu nào kê đơn (A10)', () => {
    for (const [ma, cau] of Object.entries(CHU_LOI_LENH)) {
      expect(cau, `${ma}: câu còn mã thô`).not.toMatch(/\b[a-z]+_[a-z_]+\b/);
      expect(cau.toLowerCase(), `${ma}: câu kê đơn`).not.toMatch(/\b(nên|hãy|đừng|phải|cần|tránh)\b/);
    }
  });

  it('bộ "biết chắc" chỉ gồm mã có câu, và KHÔNG gồm các lỗi có thể giả trên bản nháp', () => {
    for (const ma of LOI_LENH_BIET_CHAC) expect(CHU_LOI_LENH[ma]).toBeTruthy();
    for (const gia of ['day_tai_san', 'can_la_ban_khong', 'moc_khong_hop_le']) {
      expect(LOI_LENH_BIET_CHAC.has(gia), `${gia} có thể là lỗi GIẢ trên bản nháp`).toBe(false);
    }
  });
});

describe('VI. xem trước tính phí theo sổ của VAI — đúng số server trừ', () => {
  it('⭐ vốn quy chiếu 30.000 (vai ×3): phí báo trước = phí lõi tính với cùng số', () => {
    const lenh: Lenh[] = [{ ma: 'btc', chieu: 'mua', moc_bp: 5000 }];
    const ghe = { tienMat: 30000, viThe: {}, viKhong: {} };
    const moi = xemTruocLenh(ghe, lenh, NAV_V10.BUOC_MOC_THO_BP, false, true, 1, undefined,
      false, false, 30000)!;
    const cu = xemTruocLenh(ghe, lenh, NAV_V10.BUOC_MOC_THO_BP, false, true, 1)!;
    const giai = giaiLenhMoc({ von: 30000, vi_the: {}, vi_the_khong: {} }, lenh, false,
      { voiVang: true, vonQuyChieu: 30000 });
    const that = apLenhGiaoDich({ von: 30000, vi_the: {}, vi_the_khong: {} }, giai.lenh,
      { voiVang: true, vonQuyChieu: 30000 });
    expect(moi.phi, 'phí báo trước lệch phí server').toBe(that.phi_quy);
    expect(cu.phi, 'không truyền vốn quy chiếu mà vẫn ra đúng số ⇒ bài không đo gì').not.toBe(that.phi_quy);
  });
});

describe('VII. dây nối ở màn trận — cờ phải TỚI được shop', () => {
  const man = readFileSync(resolve(process.cwd(), 'src/screens/holdem/AlphaDraftMatch.tsx'), 'utf8');

  it('bốn trường D342 đi từ DTO vào `nav` của shop', () => {
    expect(man).toMatch(/khongTheoMa:\s*b\.khong_theo_ma === true/);
    expect(man).toMatch(/khongTheoHanMuc:\s*b\.khong_theo_han_muc === true/);
    expect(man).toMatch(/vonQuyChieu:\s*b\.von_quy_chieu/);
    expect(man).toMatch(/loiLenhVongTruoc:\s*st\.loi_von\?\.lenh/);
  });

  it('tấm VÌ SAO vẽ `loi_von.lenh` bằng chữ của bảng lỗi', () => {
    expect(man).toMatch(/loi_von\?\.lenh\s*&&[\s\S]{0,200}data-testid="loi-lenh-vong"/);
    expect(man).toMatch(/chuLoiLenh\(ketQuaCho\.tt\.loi_von\.lenh\)/);
  });

  it('thanh TAY có cọc khống (đọc `vi_the_khong`, cờ `khong: true`)', () => {
    const khoi = /const maCamTay: MaCam\[\] = \[([\s\S]*?)\]\.sort/.exec(man)?.[1] ?? '';
    expect(khoi, 'thanh TAY không còn đọc sổ khống').toContain('b.vi_the_khong');
    expect(khoi).toContain('khong: true');
  });
});

describe('V. v55 (D425) — GÔNG CÙM · SỔ MỎNG: bản nháp kiểm cùng số server phát', () => {
  it('⭐ GÔNG CÙM: bán quá phần còn được ⇒ dòng đỏ `gong_cum` TRƯỚC khi chốt', () => {
    dung({ tienMat: 1000, viThe: { vang: 5000 }, viKhong: {}, tranBanCon: 2000, lenh: [{ ma: 'vang', chieu: 'ban', moc_bp: 10000 }] });
    const loi = screen.getByTestId('chuoi-loi');
    expect(loi.getAttribute('data-loi')).toBe('gong_cum');
    expect(loi.textContent).toContain('GÔNG CÙM');
  });
  it('bán trong phần còn được ⇒ không dòng lỗi', () => {
    dung({ tienMat: 1000, viThe: { vang: 5000 }, viKhong: {}, tranBanCon: 3000, lenh: [{ ma: 'vang', chieu: 'ban', moc_bp: 5000 }] });
    expect(screen.queryByTestId('chuoi-loi')).toBeNull();
  });
  it('⭐ SỔ MỎNG: "phí mua bán" gồm phí cố định và nói riêng phần ấy', () => {
    dung({ tienMat: 9868, viThe: {}, viKhong: {}, phiCoDinhLenh: 50, lenh: [{ ma: 'btc', chieu: 'mua', moc_bp: 2500 }] });
    moSauLenh();
    expect(screen.getByTestId('phi-co-dinh').textContent).toBe('50');
  });
  it('SỔ MỎNG: lệnh mua không đủ trả phí ⇒ dòng đỏ `so_mong`', () => {
    dung({ tienMat: 100, viThe: {}, viKhong: {}, phiCoDinhLenh: 50, lenh: [{ ma: 'btc', chieu: 'mua', moc_bp: 2500 }] });
    expect(screen.getByTestId('chuoi-loi').getAttribute('data-loi')).toBe('so_mong');
  });
  it('không mang lá ⇒ không có dòng phí cố định', () => {
    dung({ tienMat: 9868, viThe: {}, viKhong: {}, lenh: [{ ma: 'btc', chieu: 'mua', moc_bp: 2500 }] });
    moSauLenh();
    // tấm phải MỞ thật — không thì "không có dòng phí cố định" đúng vì chẳng có gì được vẽ (bài rỗng)
    expect(document.querySelector('[data-tam="sau"]'), 'tấm SAU LỆNH không mở').not.toBeNull();
    expect(screen.queryByTestId('phi-co-dinh')).toBeNull();
  });
});

describe('VI. khoá CHỐT của shop nhả khi màn nộp vòng từ chối (D430)', () => {
  /*
   * D432 — các ca "chợ đứng ở chỗ hàng lõi" / "nút đổi lại ở ô CHUNG BÀN" của D430 dời sang `shop_man_chon.test.tsx`:
   * lượt chọn lõi/trait nay là MÀN CHỌN riêng (founder 27/09, phương án B). Ca khoá CHỐT vẫn là của bàn cược — giữ ở đây.
   */
  it('⭐ CHỐT bị màn nộp vòng từ chối (trả false — trait lệch cân) ⇒ shop nhả khoá: bấm lần hai vẫn tới được', async () => {
    let goi = 0;
    dung({}, { onChotVong: () => { goi += 1; return false; } });
    const nut = () => document.querySelector('[data-tap="shop-chot"]') as HTMLButtonElement;
    fireEvent.click(nut());
    await new Promise((r) => setTimeout(r, 380));
    fireEvent.click(nut());
    await new Promise((r) => setTimeout(r, 380));
    expect(goi, 'khoá chốt không nhả sau cú chốt bị từ chối — nút CHỐT của shop chết').toBe(2);
    expect([...document.querySelectorAll('[data-tap="shop-taisan"] [data-card]')].some((e) => /laKhoa/.test(e.className)),
      'lá tài sản còn mang lớp khoá sau cú chốt bị từ chối').toBe(false);
  });
});
