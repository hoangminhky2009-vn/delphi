/**
 * BÀN CƯỢC — shop trận nav (16/08, thiết kế 07, founder chốt "làm y nguyên").
 *
 * Canh những thứ là LUẬT chứ không phải gu:
 *   · bốn chip BẰNG NHAU lúc yên (D85 §1.2) — không chip nào cầm sẵn, ALL-IN
 *     không có lớp "đang" khi chưa bấm;
 *   · hai đường CHIP→LÁ và LÁ→CHIP ra CÙNG một lệnh `{ma, chieu, moc_bp}`;
 *   · chip KHÔNG dính tay — sau lệnh thả cả chip lẫn lá;
 *   · mặt RÚT chỉ mở khi có cọc, mặt KHỐNG chỉ khi cầm Bán Khống;
 *   · Chia Lệnh (bước 500) ⇒ 20 nấc, vẫn cách đều (mọi chip cùng lớp);
 *   · Đòn Bẩy CẦM rồi CHẠM ⇒ onGan / onDoiGan đúng đường cũ;
 *   · nhãn cách nhập lệnh đi vào telemetry `cham_nut` với ĐÚNG id;
 *   · LẶP xếp lại lá vòng trước qua đúng onThem; ĐÓNG KHỐNG y đường cũ;
 *   · cọc: đếm chip theo mốc/đơn vị, chạm cọc lật sang RÚT.
 * Không đo pixel hay hoạt ảnh — jsdom không có Element.animate; bayChip tự im.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, within } from '@testing-library/react';

const ghiDo = vi.fn();
vi.mock('@/lib/telemetry', () => ({ ghiDo: (...a: unknown[]) => ghiDo(...a) }));

import { ShopManHinh } from '../src/components/holdem/ShopManHinh';
import { chipTheoMoc, demChip, TRAN_CHIP } from '../src/components/holdem/CocChip';
import { cacMocTuBuoc, nhanChip } from '../src/components/holdem/HangChip';

const TAI_SAN = [
  { id: 'btc', ten: 'Crypto', mau: ['#f7931a', 'rgba(247,147,26,.22)'] as const },
  { id: 'vang', ten: 'Vàng', mau: ['#fbbf24', 'rgba(251,191,36,.22)'] as const },
  { id: 'usd', ten: 'Stablecoin', mau: ['#4ade80', 'rgba(74,222,128,.2)'] as const },
];

type Lenh = { ma: string; chieu: 'mua' | 'ban' | 'khong' | 'dong_khong'; moc_bp: number };

/** Dựng shop nav với state chọn mã sống thật (chonTS là của cha). */
function dungBanCuoc(over: Partial<{
  viThe: Record<string, number>; viKhong: Record<string, number>; tienMat: number;
  coBanKhong: boolean; buocMocBp: number; lenh: Lenh[]; lenhTruoc: Lenh[];
  chonCT: string | null; ganVao: string | null; ganHienTai: Record<string, string>;
  chienThuat: { id: string; ten: string; mau: readonly [string, string] }[];
  danhMuc: { id: string; ten: string; mau: readonly [string, string]; cap: number; loai: 'tai_san' | 'chien_thuat' }[];
  phamViThe: (id: string) => 'tai_san' | 'danh_muc';
  /** v54 (D403) — trận không còn BỎ ⇒ shop có BÁN SẠCH. */
  banSach: boolean;
  khoaDangChay: { ma: string; con_vong: number; la_vong_chot: boolean };
}> = {}) {
  const onThem = vi.fn();
  const onXoa = vi.fn();
  const onGan = vi.fn();
  const onDoiGan = vi.fn();
  const onChotVong = vi.fn();
  let chonTS: string[] = [];
  const onChonTS = vi.fn((id: string) => {
    chonTS = chonTS.includes(id) ? chonTS.filter((x) => x !== id) : [...chonTS, id];
    ve();
  });
  let utils: ReturnType<typeof render> | null = null;
  const cay = () => (
    <ShopManHinh
      vong={2}
      loaiVongNay="tai_san"
      vongMoTiepTheo={{ tai_san: null, chien_thuat: 3 }}
      taiSan={TAI_SAN}
      chienThuat={over.chienThuat ?? (over.chonCT ? [{ id: over.chonCT, ten: 'Đòn Bẩy 2×', mau: ['#a855f7', 'rgba(0,0,0,.2)'] }] : [])}
      chonTS={chonTS}
      chonCT={over.chonCT ?? null}
      onChonTS={onChonTS}
      onChonCT={() => {}}
      danhMuc={over.danhMuc ?? []}
      sucChuaTaiSan={4}
      sucChuaChienThuat={3}
      art={{}}
      ganVao={over.ganVao ?? null}
      onGan={onGan}
      phamViThe={over.phamViThe ?? (() => 'danh_muc')}
      ganHienTai={over.ganHienTai}
      doiGan={{}}
      onDoiGan={onDoiGan}
      chiPhiRoll={1}
      luotConLai={1}
      onRoll={() => {}}
      onDong={() => {}}
      onChotVong={onChotVong}
      tuDien={{ tai_san: {}, chien_thuat: {}, muc: [] } as never}
      giaiDoanNhan={[]}
      suKienNhan={[]}
      moTaChienThuat={() => undefined}
      {...(over.khoaDangChay
        ? { khoa: { duoc: false, dangChay: over.khoaDangChay, chon: null, onChon: () => {}, soVong: 2 } }
        : {})}
      nav={{
        tienMat: over.tienMat ?? 10000,
        viThe: over.viThe ?? {},
        viKhong: over.viKhong ?? {},
        coBanKhong: over.coBanKhong ?? false,
        buocMocBp: over.buocMocBp ?? 2500,
        lenh: over.lenh ?? [],
        onThem, onXoa,
        startVon: 10000,
        lenhTruoc: over.lenhTruoc ?? [],
        ...(over.banSach ? { banSach: true } : {}),
      }}
    />
  );
  const ve = () => { if (utils) utils.rerender(cay()); };
  utils = render(cay());
  return { onThem, onXoa, onGan, onDoiGan, onChotVong, onChonTS, ve, chon: () => chonTS };
}

const chip = (nhan: string) => screen.getByRole('button', { name: nhan });
const la = (id: string) => document.querySelector(`[data-card="${id}"]`) as HTMLButtonElement;

beforeEach(() => { ghiDo.mockClear(); });

describe('Bàn cược — bốn chip bằng nhau lúc yên (D85 §1.2)', () => {
  it('bốn chip cùng lớp gốc, không chip nào cầm sẵn, ALL-IN không sáng sẵn', () => {
    dungBanCuoc();
    fireEvent.click(la('btc'));   // D540 — chip mọc trên PHIẾU của thẻ vừa chạm
    const hang = document.querySelector('[data-tap="shop-lenh"]')!;
    const nut = within(hang as HTMLElement).getAllByRole('button');
    // D432 — nút chip mang thêm SỐ TIỀN (mẫu số in trên vật); nhãn mốc đọc ở `[data-nhan-moc]`.
    expect(nut.map((b) => b.querySelector('[data-nhan-moc]')?.textContent)).toEqual(['25%', '50%', '75%', 'ALL-IN']);
    for (const b of nut) {
      // Cùng lớp nutMoc; ALL-IN chỉ thêm lớp chữ đậm, KHÔNG lớp "đang".
      expect(b.className).toMatch(/nutMoc/);
      expect(b.className).not.toMatch(/allDang|\bcam\b/);
    }
  });

  it('Chia Lệnh (bước 500) ⇒ 20 nấc, tất cả cùng lớp — vẫn cách đều', () => {
    dungBanCuoc({ buocMocBp: 500 });
    fireEvent.click(la('btc'));
    const hang = document.querySelector('[data-tap="shop-lenh"]')!;
    const nut = within(hang as HTMLElement).getAllByRole('button');
    expect(nut).toHaveLength(20);
    expect(nut[0]!.querySelector('[data-nhan-moc]')?.textContent).toBe('5%');
    expect(nut[19]!.querySelector('[data-nhan-moc]')?.textContent).toBe('ALL-IN');
    expect(new Set(nut.map((b) => b.className.split(' ').filter((c) => !/nutMocAll|allDang/.test(c)).join(' '))).size).toBe(1);
  });

  it('cacMocTuBuoc / nhanChip — nguồn nấc và nhãn của cả ba mặt', () => {
    expect(cacMocTuBuoc(2500)).toEqual([2500, 5000, 7500, 10000]);
    expect(cacMocTuBuoc(500)).toHaveLength(20);
    expect(nhanChip('mua', 10000)).toBe('ALL-IN');
    expect(nhanChip('ban', 10000)).toBe('HẾT');
    expect(nhanChip('khong', 10000)).toBe('100%');
    expect(nhanChip('mua', 2500)).toBe('25%');
  });
});

describe('Bàn cược — CẦM rồi CHẠM: hai đường, một lệnh, chip không dính tay', () => {
  it('⭐ D540 — PHIẾU LỆNH: chưa chạm mã thì KHÔNG có chip (bỏ lối cầm chip trước); chạm mã ⇒ phiếu mọc trong lưới; chạm lại / ✕ ⇒ đóng', () => {
    const t = dungBanCuoc();
    expect(document.querySelector('[data-tap="shop-lenh"]')).toBeNull();
    expect(screen.queryByRole('button', { name: '50%' })).toBeNull();
    fireEvent.click(la('btc'));
    const phieu = screen.getByRole('group', { name: 'Phiếu lệnh Crypto' });
    expect(phieu.closest('[data-tap="shop-taisan"]'), 'phiếu nằm TRONG lưới tài sản (vùng rọi của bàn tập)').not.toBeNull();
    expect(within(phieu).getByRole('button', { name: '50%' })).toBeTruthy();
    fireEvent.click(la('btc'));
    expect(screen.queryByRole('group', { name: /Phiếu lệnh/ })).toBeNull();
    fireEvent.click(la('vang'));
    fireEvent.click(screen.getByRole('button', { name: 'Đóng phiếu lệnh' }));
    expect(screen.queryByRole('group', { name: /Phiếu lệnh/ })).toBeNull();
    expect(t.chon()).toEqual([]);
  });

  it('LÁ trước → CHIP: chạm VÀNG (nhấc lên tay), chạm 25% ⇒ cùng một lệnh; lá thả; nhãn la-truoc', () => {
    const t = dungBanCuoc();
    fireEvent.click(la('vang'));
    expect(t.chon()).toEqual(['vang']);
    expect(la('vang').getAttribute('aria-pressed')).toBe('true');
    fireEvent.click(chip('25%'));
    expect(t.onThem).toHaveBeenCalledWith({ ma: 'vang', chieu: 'mua', moc_bp: 2500 });
    expect(t.chon()).toEqual([]);
    expect(ghiDo).toHaveBeenCalledWith('cham_nut', { chi_tiet: { nut: 'shop-la-truoc' } });
  });

  it('chạm lá thứ hai khi đang cầm lá thứ nhất ⇒ ĐỔI lá (một tay chỉ cầm một lá)', () => {
    const t = dungBanCuoc();
    fireEvent.click(la('vang'));
    fireEvent.click(la('btc'));
    expect(t.chon()).toEqual(['btc']);
  });

  /*
   * ⭐ ALL-IN 22/08 — TOÀN BỘ hiệu ứng nằm trên CÁI NÚT, không một pixel nào ra
   * ngoài nó (founder: *"xóa hiệu ứng all in đi, chỉ cải tiến hiệu ứng khi bấm
   * nút all in thôi, không còn hiện all in toàn màn hình nữa"*).
   *
   * Ba bài dưới đây thay cho ba bài cũ từng khoá hành vi NGƯỢC LẠI (dấu chữ
   * ALL-IN + loé vàng nổ ở cú CHỐT/KHỚP NGAY, và cú chốt phải chờ 700ms cho dấu
   * diễn xong). Giữ nguyên tên lớp trong phép kiểm — `dauAll`/`loe` — để nếu ai
   * dựng lại cụm đó thì ba bài này đỏ ngay, chứ không im lặng sống chung.
   */
  it('ALL-IN bấm ⇒ lệnh mốc 10000 + nút bật (allDang), không dấu/loé toàn màn', () => {
    const t = dungBanCuoc();
    fireEvent.click(la('btc'));
    fireEvent.click(chip('ALL-IN'));
    expect(t.onThem).toHaveBeenCalledWith({ ma: 'btc', chieu: 'mua', moc_bp: 10000 });
    // D540 — lệnh xếp xong thì lá thả ⇒ phiếu đóng (nhịp ALL-IN của nút đi cùng chip bay lên lá).
    expect(screen.queryByRole('group', { name: /Phiếu lệnh/ })).toBeNull();
    expect(document.querySelector('[class*="dauAll"]')).toBeNull();
    expect(document.querySelector('[class*="loe"]')).toBeNull();
  });

  it('CHỐT VÒNG có ALL-IN ⇒ KHÔNG dấu toàn màn, và chờ đúng 300ms như mọi cú chốt', () => {
    vi.useFakeTimers();
    try {
      const t = dungBanCuoc({ lenh: [{ ma: 'btc', chieu: 'mua', moc_bp: 10000 }] });
      fireEvent.click(screen.getByRole('button', { name: 'CHỐT VÒNG' }));
      expect(document.querySelector('[class*="dauAll"]')).toBeNull();
      expect(document.querySelector('[class*="loe"]')).toBeNull();
      expect(t.onChotVong).not.toHaveBeenCalled();
      // 300ms — nhịp khoá cọc dùng chung. Bản cũ giữ shop 700ms cho dấu ALL-IN
      // đóng xong: 400ms độ trễ thêm ở đúng giây người chơi vừa cam kết.
      vi.advanceTimersByTime(300);
      expect(t.onChotVong).toHaveBeenCalledTimes(1);
    } finally { vi.useRealTimers(); }
    document.body.innerHTML = '';
    vi.useFakeTimers();
    try {
      const t2 = dungBanCuoc({ lenh: [{ ma: 'btc', chieu: 'mua', moc_bp: 5000 }] });
      fireEvent.click(screen.getByRole('button', { name: 'CHỐT VÒNG' }));
      vi.advanceTimersByTime(300);
      expect(t2.onChotVong).toHaveBeenCalledTimes(1);
    } finally { vi.useRealTimers(); }
  });

  it('D447 — KHỚP NGAY đã bỏ: hàng lệnh chỉ còn lá đã xếp, lệnh đi lúc CHỐT VÒNG', () => {
    // Phí cộng dồn cả vòng (v56) ⇒ khớp sớm không còn khác khớp lúc chốt; một nút, một khái niệm.
    dungBanCuoc({ lenh: [{ ma: 'vang', chieu: 'mua', moc_bp: 10000 }] });
    expect(screen.queryByRole('button', { name: /KHỚP NGAY|ĐANG KHỚP/ })).toBeNull();
    expect(screen.getByRole('button', { name: 'CHỐT VÒNG' })).toBeTruthy();
  });

  it('hết tiền mặt ⇒ chip mặt MUA vô hiệu, không nạp lệnh', () => {
    const t = dungBanCuoc({ tienMat: 0 });
    fireEvent.click(la('btc'));
    expect(chip('25%')).toBeDisabled();
    fireEvent.click(chip('25%'));
    expect(t.onThem).not.toHaveBeenCalled();
  });
});

describe('Bàn cược — ba mặt', () => {
  it('chưa giữ mã nào ⇒ KHÔNG có nút RÚT (và không có cụm mặt); KHỐNG chỉ hiện khi cầm Bán Khống', () => {
    /*
     * D321 (13/09) — trước đây RÚT đứng thường trực nhưng xám 0,4 từ vòng 1.
     * Founder gọi shop là "buồng lái máy bay": một nút không bấm được, có mặt chỉ
     * để hứa "sẽ có lúc bấm được", là đúng loại nút ấy. Nay mặt chỉ vẽ khi có TỪ
     * HAI lựa chọn — chưa giữ gì thì không RÚT, và thôi luôn cả nút MUA (một lựa
     * chọn không phải lựa chọn). Có cọc thì cụm hiện lại y cũ — bài ngay dưới canh.
     * Tiêm lỗi: đổi `coCocRut &&` thành `true &&` trong HangChip ⇒ đỏ.
     */
    dungBanCuoc();
    expect(screen.queryByRole('button', { name: 'RÚT' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'MUA' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'KHỐNG' })).toBeNull();
    // D432 — tay không thì KHÔNG còn dòng mời thường trực (founder 27/09: *"Quá nhiều thứ trên 1 màn hình"*); cầm chip thì
    // đầu màn nói bước kế tiếp.
    expect(document.body.textContent).not.toMatch(/cầm một chip/i);
    // D540 — chạm mã ⇒ phiếu (vẫn không cụm mặt khi chỉ có MUA) và đầu màn nói bước kế.
    fireEvent.click(la('btc'));
    expect(screen.queryByRole('button', { name: 'RÚT' })).toBeNull();
    expect(document.body.textContent).toMatch(/CHẠM MỘT CHIP/);
  });

  it('có cọc: chạm CỌC trên lá ⇒ mặt RÚT bật + lá lên tay; chạm 50% ⇒ lệnh BÁN 5000', () => {
    const t = dungBanCuoc({ viThe: { btc: 4000 } });
    const coc = la('btc').querySelector('[data-coc]')!;
    expect(coc.getAttribute('role')).toBe('button');
    fireEvent.click(coc);
    expect(screen.getByRole('button', { name: 'RÚT' }).getAttribute('aria-pressed')).toBe('true');
    expect(t.chon()).toEqual(['btc']);
    // Chạm cọc KHÔNG được thành chạm lá (stopPropagation): lá vẫn đang chọn.
    expect(chip('50%').querySelector('[data-nhan-moc]')?.textContent).toBe('50%');
    fireEvent.click(chip('50%'));
    expect(t.onThem).toHaveBeenCalledWith({ ma: 'btc', chieu: 'ban', moc_bp: 5000 });
  });

  it('mặt RÚT: nút cuối ghi HẾT; mặt KHỐNG chỉ nấc ¼ và nút cuối 100%', () => {
    dungBanCuoc({ viThe: { btc: 4000 }, coBanKhong: true, buocMocBp: 500 });
    fireEvent.click(la('btc'));
    fireEvent.click(screen.getByRole('button', { name: 'RÚT' }));
    expect(chip('HẾT')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'KHỐNG' }));
    const hang = document.querySelector('[data-tap="shop-lenh"]')!;
    const nut = within(hang as HTMLElement).getAllByRole('button');
    expect(nut.map((b) => b.querySelector('[data-nhan-moc]')?.textContent)).toEqual(['25%', '50%', '75%', '100%']);
  });

  it('mặt KHỐNG: chạm lá, lật mặt KHỐNG trên phiếu, chạm chip ⇒ lệnh chieu khong', () => {
    const t = dungBanCuoc({ coBanKhong: true });
    fireEvent.click(la('usd'));
    fireEvent.click(screen.getByRole('button', { name: 'KHỐNG' }));
    fireEvent.click(chip('25%'));
    expect(t.onThem).toHaveBeenCalledWith({ ma: 'usd', chieu: 'khong', moc_bp: 2500 });
  });

  it('cọc khống đang mở ⇒ TAY có nút ĐÓNG ⇒ dong_khong 10000 (y đường cũ)', () => {
    const t = dungBanCuoc({ viKhong: { usd: 1200 } });
    fireEvent.click(screen.getByRole('button', { name: /KHỐNG STABLECOIN 1\.200 · ĐÓNG/ }));
    expect(t.onThem).toHaveBeenCalledWith({ ma: 'usd', chieu: 'dong_khong', moc_bp: 10000 });
  });
});

describe('Bàn cược — cọc chip trên lá', () => {
  it('demChip / chipTheoMoc: theo đơn vị ¼ vốn, tối thiểu 1, trần 8', () => {
    expect(demChip(0, 2500)).toBe(0);
    expect(demChip(100, 2500)).toBe(1);
    expect(demChip(5000, 2500)).toBe(2);
    expect(demChip(99999, 2500)).toBe(TRAN_CHIP);
    expect(chipTheoMoc(2500)).toBe(1);
    expect(chipTheoMoc(10000)).toBe(4);
    expect(chipTheoMoc(500)).toBe(1);
  });

  it('lá đang giữ 5.000 + lệnh MUA 25% đang xếp ⇒ 2 chip giữ + 1 chip chờ; giá trị in trên lá', () => {
    dungBanCuoc({ viThe: { btc: 5000 }, lenh: [{ ma: 'btc', chieu: 'mua', moc_bp: 2500 }] });
    const coc = la('btc').querySelector('[data-coc]')!;
    expect(coc.querySelectorAll('i')).toHaveLength(3);
    expect(la('btc').textContent).toContain('5.000');
    // Lá không có gì ⇒ không có cọc.
    expect(la('usd').querySelector('[data-coc]')).toBeNull();
  });

  it('lá đã xếp: tag đúng chữ RÚT/KHỐNG (không còn "BÁN" cho khống), bấm tag ⇒ onXoa(i)', () => {
    const t = dungBanCuoc({
      viThe: { btc: 5000 },
      lenh: [
        { ma: 'btc', chieu: 'ban', moc_bp: 5000 },
        { ma: 'usd', chieu: 'khong', moc_bp: 2500 },
        { ma: 'vang', chieu: 'mua', moc_bp: 10000 },
      ],
    });
    expect(screen.getByRole('button', { name: /RÚT CRYPTO 50%/ })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /KHỐNG STABLECOIN 25%/ })).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /MUA VÀNG ALL-IN/ }));
    expect(t.onXoa).toHaveBeenCalledWith(2);
  });
});

describe('Bàn cược — TAY: Đòn Bẩy cầm rồi chạm; LẶP; CHỐT', () => {
  const ghim = (id: string) => (id === 'don_bay' ? 'tai_san' : 'danh_muc') as 'tai_san' | 'danh_muc';

  it('Đòn Bẩy VỪA CHỌN: chạm lá ở tay rồi chạm Crypto (đang giữ) ⇒ onGan("btc"); chạm lại ⇒ null', () => {
    const t = dungBanCuoc({ chonCT: 'don_bay', phamViThe: ghim, viThe: { btc: 3000 } });
    const tay = screen.getByRole('button', { name: /ĐÒN BẨY 2×/ });
    fireEvent.click(tay);
    expect(tay.getAttribute('aria-pressed')).toBe('true');
    fireEvent.click(la('btc'));
    expect(t.onGan).toHaveBeenCalledWith('btc');
    // Cầm lại đúng lá, chạm mã đang là đích ⇒ bỏ nhắm.
    t.ve();
  });

  it('Đòn Bẩy ĐANG CẦM (trong tay): cầm rồi chạm ⇒ onDoiGan(the, ma) — đúng đường ĐỔI ĐÍCH cũ', () => {
    const t = dungBanCuoc({
      phamViThe: ghim, viThe: { vang: 2000 },
      danhMuc: [{ id: 'don_bay', ten: 'Đòn Bẩy 2×', mau: ['#a855f7', 'rgba(0,0,0,.2)'], cap: 1, loai: 'chien_thuat' }],
      ganHienTai: { don_bay: 'btc' },
    });
    fireEvent.click(screen.getByRole('button', { name: /ĐÒN BẨY 2×/ }));
    fireEvent.click(la('vang'));
    expect(t.onDoiGan).toHaveBeenCalledWith('don_bay', 'vang');
    // Đích hiện tại vẽ badge ×2 lên đúng lá.
    expect(la('btc').textContent).toContain('×2');
  });

  it('cầm Đòn Bẩy mà chạm mã KHÔNG giữ ⇒ không gắn, nhắn "gắn vào đâu"', () => {
    const t = dungBanCuoc({ chonCT: 'don_bay', phamViThe: ghim, viThe: {} });
    /*
     * ⚠ Neo `^` — từ 24/08 lá GHIM có thêm một nút (!) RIÊNG bên cạnh
     * (aria-label "Giải thích Đòn Bẩy 2×") vì cú chạm của lá đã dành cho việc
     * nhắm đích. `/ĐÒN BẨY/i` trần nay khớp CẢ HAI và `getByRole` ném.
     */
    fireEvent.click(screen.getByRole('button', { name: /^ĐÒN BẨY/i }));
    fireEvent.click(la('btc'));
    expect(t.onGan).not.toHaveBeenCalled();
    expect(screen.getByRole('status').textContent).toMatch(/GẮN VÀO ĐÂU/);
  });

  it('LẶP chỉ hiện khi hàng đợi rỗng và có lá vòng trước; bấm ⇒ onThem từng lá', () => {
    const t = dungBanCuoc({
      lenhTruoc: [{ ma: 'btc', chieu: 'mua', moc_bp: 2500 }, { ma: 'usd', chieu: 'mua', moc_bp: 5000 }],
    });
    fireEvent.click(screen.getByRole('button', { name: /LẶP/ }));
    expect(t.onThem).toHaveBeenNthCalledWith(1, { ma: 'btc', chieu: 'mua', moc_bp: 2500 });
    expect(t.onThem).toHaveBeenNthCalledWith(2, { ma: 'usd', chieu: 'mua', moc_bp: 5000 });
    // LẶP không phải một cách nhập mới — không ghi nhãn telemetry.
    expect(ghiDo).not.toHaveBeenCalled();
  });

  it('có lệnh đang xếp ⇒ KHÔNG hiện LẶP (xếp thêm y vòng trước lên hàng đang có là nhân đôi)', () => {
    dungBanCuoc({ lenh: [{ ma: 'btc', chieu: 'mua', moc_bp: 2500 }], lenhTruoc: [{ ma: 'btc', chieu: 'mua', moc_bp: 2500 }] });
    expect(screen.queryByRole('button', { name: /LẶP/ })).toBeNull();
  });

  it('CHỐT VÒNG có hoạt ảnh khoá; reduced-motion ⇒ gọi cha ngay', () => {
    vi.stubGlobal('matchMedia', (q: string) => ({
      matches: q.includes('prefers-reduced-motion'), media: q,
      addEventListener: () => {}, removeEventListener: () => {},
      addListener: () => {}, removeListener: () => {}, dispatchEvent: () => false, onchange: null,
    }));
    const t = dungBanCuoc();
    fireEvent.click(screen.getByRole('button', { name: 'CHỐT VÒNG' }));
    expect(t.onChotVong).toHaveBeenCalledTimes(1);
    vi.unstubAllGlobals();
  });
});

describe('⭐ Hàng đợi MUA soi tiền mặt SAU hàng đợi, không phải tiền mặt server', () => {
  /*
   * Founder 23/08 (kèm ảnh): *"sao t đặt được lắm lệnh all in thế?"* — hàng đợi
   * có `MUA USDT 75%` + BA lệnh ALL-IN. Server giải lệnh TUẦN TỰ trên số dư đang
   * chạy, nên ALL-IN thứ hai lấy 100% CỦA 0 ⇒ hai lệnh cuối là LỆNH CHẾT: vẫn
   * hiện tag, vẫn có nút ✕, không làm gì cả. Đúng ảnh: USDT 7.257 · TPCP 2.425 ·
   * VÀNG và CP CÔNG NGHỆ vắng mặt khỏi DANH MỤC SAU LỆNH.
   *
   * Cửa cũ hỏi `tienMat > 0` = số dư SERVER, chỉ đổi lúc CHỐT VÒNG ⇒ luôn mở.
   */
  it('ALL-IN rồi thì mọi chip MUA đóng lại — không xếp thêm được lệnh chết', () => {
    const { onThem } = dungBanCuoc({ tienMat: 10000, lenh: [{ ma: 'usd', chieu: 'mua', moc_bp: 10000 }] });
    fireEvent.click(la('vang'));
    for (const nhan of ['25%', '50%', '75%', 'ALL-IN']) {
      expect(chip(nhan), `chip ${nhan} còn bấm được sau ALL-IN`).toBeDisabled();
      fireEvent.click(chip(nhan));
    }
    expect(onThem, 'phiếu vẫn xếp được lệnh chết').not.toHaveBeenCalled();
  });

  it('75% rồi thì ALL-IN VẪN mở (còn 25% tiền) — không siết quá tay', () => {
    /*
     * Vế đối chứng, và nó là vế dễ hỏng nhất: siết bằng "đã có lệnh mua thì
     * thôi" sẽ giết luôn ca hợp lệ này. ALL-IN ở đây nghĩa là "dồn nốt chỗ còn
     * lại", đúng nghĩa và server khớp thật.
     */
    const { onThem } = dungBanCuoc({ tienMat: 10000, lenh: [{ ma: 'usd', chieu: 'mua', moc_bp: 7500 }] });
    fireEvent.click(la('vang'));
    expect(chip('ALL-IN')).not.toBeDisabled();
    fireEvent.click(chip('ALL-IN'));
    expect(onThem).toHaveBeenCalledWith({ ma: 'vang', chieu: 'mua', moc_bp: 10000 });
  });

  it('RÚT trong hàng đợi trả tiền về ⇒ MUA mở lại (phép chiếu tính cả lệnh bán)', () => {
    /*
     * Server sắp BÁN trước MUA (nav.ts, founder 01/08) nên tiền bán về kịp cho
     * lệnh mua cùng vòng. Cửa này phải đọc ĐÚNG phép chiếu ấy — nếu tự chế một
     * phép trừ riêng thì nó sẽ chặn nhầm và người chơi "đ** mua được".
     */
    const { onThem } = dungBanCuoc({
      tienMat: 0,
      viThe: { btc: 6000 },
      lenh: [{ ma: 'btc', chieu: 'ban', moc_bp: 10000 }],
    });
    fireEvent.click(la('vang'));
    expect(chip('50%')).not.toBeDisabled();
    fireEvent.click(chip('50%'));
    expect(onThem).toHaveBeenCalledWith({ ma: 'vang', chieu: 'mua', moc_bp: 5000 });
  });
});

describe('⭐ Lá lõi ĐÃ CẦM đọc lại được tác dụng', () => {
  /*
   * Founder 23/08: *"sau khi pick lõi t cũng không có cách nào đọc lại tác dụng
   * của lõi đó"*.
   *
   * Truy ra thì founder KHÔNG bỏ sót — đường ấy chưa từng tồn tại. Nút (!) chỉ
   * sống trên `GameCard` trong QUẦY, mà mục quầy chỉ render ở vòng CHỌN LÕI; hết
   * ba vòng chọn là cả mục biến mất cùng cái (!). Tệ hơn, trang HƯỚNG DẪN đang
   * HỨA đúng cái nút đó — founder làm theo lời hướng dẫn rồi không tìm ra.
   *
   * ⚠ Không bài nào canh vùng này: `thegiaithich.test.tsx` chỉ kiểm (!) trên
   * `GameCard` RỜI, không bài nào hỏi "lá ĐÃ CẦM có đường tới tờ không". Đúng
   * lớp D62/D66 — test xanh mãi mà chưa từng chạm thứ đang hỏng.
   */
  const CAM = (id: string, ten: string) => ({
    danhMuc: [{ id, ten, mau: ['#a855f7', 'rgba(0,0,0,.2)'] as const, cap: 1, loai: 'chien_thuat' as const }],
  });

  it('lá KHÔNG ghim: chính lá là nút, bấm ⇒ mở tờ giải thích', () => {
    dungBanCuoc({ ...CAM('chan_lo', 'Chặn Lỗ'), phamViThe: () => 'danh_muc' });
    const la = document.querySelector('[class*="_tayLa_"]') as HTMLElement;
    expect(la, 'không tìm thấy lá trong khối TAY').toBeTruthy();
    expect(la.tagName, 'lá đã cầm vẫn không bấm được').toBe('BUTTON');
    expect(la.getAttribute('aria-label')).toMatch(/Giải thích/);
  });

  it('⚠ lá GHIM giữ cú chạm cho việc NHẮM ĐÍCH, nên có nút (!) RIÊNG', () => {
    /*
     * Đòn Bẩy dùng cú chạm để nhắm mã ×2. Gộp hai việc vào một cú chạm là mất
     * một trong hai. ⚠ Nút (!) phải là SIBLING, không lồng trong nút lá: button
     * lồng button là HTML không hợp lệ và cú chạm bị nuốt thành "nhắm đích".
     */
    dungBanCuoc({ ...CAM('don_bay', 'Đòn Bẩy 2×'), phamViThe: () => 'tai_san' });
    const la = document.querySelector('[class*="_tayLa_"]') as HTMLElement;
    expect(la.getAttribute('title')).toMatch(/nhắm/);
    const hoi = [...document.querySelectorAll('button')]
      .find((b) => /Giải thích/.test(b.getAttribute('aria-label') ?? ''));
    expect(hoi, 'lá ghim mất luôn đường đọc lại').toBeTruthy();
    expect(hoi!.closest('button') === hoi, '(!) đang LỒNG trong nút lá').toBe(true);
  });

  it('⚠ KHÔNG dùng `title` làm đường đọc — tooltip hover chết trên màn chạm', () => {
    /*
     * Bản cũ đặt `title={moTaChienThuat(id)}` lên lá tĩnh. Hai lỗi cùng lúc:
     * `title` không bao giờ hiện trên màn chạm (C6 mobile-first), và nội dung nó
     * là `mo_ta` D28 = ĐẶC ĐIỂM NGOÀI ĐỜI, cố ý cấm nhắc tác dụng game — tức kể
     * cả rê được chuột cũng không đọc ra thứ đang hỏi.
     */
    dungBanCuoc({ ...CAM('chan_lo', 'Chặn Lỗ'), phamViThe: () => 'danh_muc' });
    const la = document.querySelector('[class*="_tayLa_"]') as HTMLElement;
    expect(la.getAttribute('title')).toBe('Lá này làm gì?');
  });
});

describe('⭐ v54 (D403) — BÁN SẠCH thay nút BỎ: một chạm xếp lệnh đưa cả danh mục về tiền mặt', () => {
  const nutBanSach = () => screen.queryByRole('button', { name: /^BÁN SẠCH/ });

  it('vế ngược — trận còn BỎ (không cờ): KHÔNG có nút BÁN SẠCH dù đang cầm mã', () => {
    dungBanCuoc({ viThe: { btc: 5000 } });
    expect(nutBanSach()).toBeNull();
  });

  it('có cờ mà chưa cầm gì (cả thường lẫn khống) ⇒ không vẽ nút', () => {
    dungBanCuoc({ banSach: true });
    expect(nutBanSach()).toBeNull();
  });

  it('⭐ bấm ⇒ GỠ mọi lá đang xếp (từ cuối lên) rồi RÚT HẾT từng mã cầm + ĐÓNG KHỐNG từng cọc khống — qua đúng onXoa/onThem', () => {
    const { onThem, onXoa } = dungBanCuoc({
      banSach: true, viThe: { btc: 5000, vang: 2500 }, viKhong: { usd: 1000 },
      lenh: [{ ma: 'usd', chieu: 'mua', moc_bp: 2500 }, { ma: 'btc', chieu: 'mua', moc_bp: 5000 }],
    });
    fireEvent.click(nutBanSach()!);
    expect(onXoa.mock.calls.map((c) => c[0])).toEqual([1, 0]);
    expect(onThem.mock.calls.map((c) => c[0])).toEqual([
      { ma: 'btc', chieu: 'ban', moc_bp: 10000 },
      { ma: 'vang', chieu: 'ban', moc_bp: 10000 },
      { ma: 'usd', chieu: 'dong_khong', moc_bp: 10000 },
    ]);
  });

  it('chỉ có cọc KHỐNG (không cọc thường) ⇒ nút vẫn có, bấm ⇒ chỉ ĐÓNG KHỐNG', () => {
    const { onThem } = dungBanCuoc({ banSach: true, viKhong: { vang: 2500 } });
    fireEvent.click(nutBanSach()!);
    expect(onThem.mock.calls.map((c) => c[0])).toEqual([{ ma: 'vang', chieu: 'dong_khong', moc_bp: 10000 }]);
  });

  it('⚠ mã đang CAM KẾT GIỮ được CHỪA lại (cùng luật cú RÚT lẻ) — chỉ mã còn lại vào lệnh', () => {
    const { onThem } = dungBanCuoc({
      banSach: true, viThe: { btc: 5000, vang: 2500 },
      khoaDangChay: { ma: 'btc', con_vong: 2, la_vong_chot: false },
    });
    fireEvent.click(nutBanSach()!);
    expect(onThem.mock.calls.map((c) => c[0])).toEqual([{ ma: 'vang', chieu: 'ban', moc_bp: 10000 }]);
  });

  it('nút là HÀNH ĐỘNG, không phải MẶT: không aria-pressed, và bấm không đổi mặt đang chọn', () => {
    dungBanCuoc({ banSach: true, viThe: { btc: 5000 } });
    const nut = nutBanSach()!;
    expect(nut.hasAttribute('aria-pressed')).toBe(false);
    fireEvent.click(la('btc'));   // D540 — mặt nằm trên phiếu của thẻ đang chọn
    const mua = screen.getByRole('button', { name: 'MUA' });
    expect(mua.getAttribute('aria-pressed')).toBe('true');
    fireEvent.click(nut);
    if (!screen.queryByRole('button', { name: 'MUA' })) fireEvent.click(la('btc'));   // BÁN SẠCH thả lá ⇒ mở lại phiếu để đọc mặt
    expect(screen.getByRole('button', { name: 'MUA' }).getAttribute('aria-pressed')).toBe('true');
  });
});
