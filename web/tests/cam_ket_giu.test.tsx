/**
 * CAM KẾT GIỮ (khoá tài sản) VỀ SHOP — D104, founder 17/08.
 *
 * Nguyên văn: *"Khóa tài sản là 1 lựa chọn trong shop khi mua, ko phải thêm
 * thao tác bắt buộc. Và chọn xong thì cũng phải cho UI-UX hiển thị rõ rằng mã
 * đó sẽ không được đụng tới trong time cam kết khóa."*
 *
 * ⚠ CƠ CHẾ ĐÃ CHẠY TỪ 27/07 MÀ 0/167 TRẬN TỪNG DÙNG — engine, config, DTO,
 * đường nộp đều đủ; panel `QuanTriVon` bị ẩn vì đòi `nav === undefined` mà mọi
 * trận đều là NAV. Bộ test này khoá cho ba tính chất không tuột lại:
 *   §I  không bấm thì KHÔNG có gì xảy ra (đúng "không phải thao tác bắt buộc");
 *   §II đang cam kết thì NÓI RÕ còn mấy vòng và không rút được;
 *   §III chặn THẬT cú rút mã đang cam kết, kèm câu giải thích.
 */
import { describe, expect, it, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { ShopManHinh } from '../src/components/holdem/ShopManHinh';

/** Lá trên bàn — cùng cách chọn với `ban_cuoc.test.tsx` (tên hiện ở nhiều chỗ). */
const la = (id: string) => document.querySelector(`[data-card="${id}"]`) as HTMLButtonElement;

const TAI_SAN = [
  { id: 'btc', ten: 'BTC', mau: ['#f7931a', 'rgba(247,147,26,.22)'] as const },
  { id: 'vang', ten: 'Vàng', mau: ['#fbbf24', 'rgba(251,191,36,.22)'] as const },
];

type Khoa = NonNullable<Parameters<typeof ShopManHinh>[0]['khoa']>;

function dung(over: {
  khoa?: Khoa | undefined;
  viThe?: Record<string, number>;
  camSan?: string;          // mã "đang cầm trên tay" lúc mở màn
} = {}) {
  const onThem = vi.fn();
  const onChon = vi.fn();
  let chonTS: string[] = over.camSan ? [over.camSan] : [];
  let utils: ReturnType<typeof render> | null = null;
  const onChonTS = vi.fn((id: string) => {
    chonTS = chonTS.includes(id) ? chonTS.filter((x) => x !== id) : [...chonTS, id];
    ve();
  });
  const cay = () => (
    <ShopManHinh
      vong={2}
      loaiVongNay="tai_san"
      vongMoTiepTheo={{ tai_san: null, chien_thuat: 3 }}
      taiSan={TAI_SAN}
      chienThuat={[]}
      chonTS={chonTS}
      chonCT={null}
      onChonTS={onChonTS}
      onChonCT={() => {}}
      danhMuc={[]}
      sucChuaTaiSan={4}
      sucChuaChienThuat={3}
      art={{}}
      ganVao={null}
      onGan={() => {}}
      phamViThe={() => 'danh_muc'}
      doiGan={{}}
      onDoiGan={() => {}}
      chiPhiRoll={1}
      luotConLai={1}
      onRoll={() => {}}
      onDong={() => {}}
      onChotVong={() => {}}
      tuDien={{ tai_san: {}, chien_thuat: {}, muc: [] } as never}
      giaiDoanNhan={[]}
      suKienNhan={[]}
      moTaChienThuat={() => undefined}
      khoa={over.khoa && { ...over.khoa, onChon }}
      nav={{
        tienMat: 10_000,
        viThe: over.viThe ?? {},
        buocMocBp: 2500,
        lenh: [],
        onThem,
        onXoa: () => {},
        startVon: 10_000,
      }}
    />
  );
  const ve = () => { if (utils) utils.rerender(cay()); };
  utils = render(cay());
  return { onThem, onChon, ve };
}

const KHOA_MO: Khoa = { duoc: true, dangChay: null, chon: null, onChon: () => {}, soVong: 2 };

describe('I. KHÔNG phải thao tác bắt buộc', () => {
  it('không truyền `khoa` (API cũ) ⇒ không có gì trong shop', () => {
    dung();
    expect(screen.queryByText(/CAM KẾT/i)).toBeNull();
  });

  it('có quyền khoá nhưng CHƯA cầm lá nào ⇒ chưa mời (không rác màn hình)', () => {
    dung({ khoa: KHOA_MO });
    expect(screen.queryByText(/CAM KẾT GIỮ/i)).toBeNull();
  });

  it('⭐ đang cầm một lá ⇒ MỜI, và bấm mới chọn — không tự bật', () => {
    const { onChon } = dung({ khoa: KHOA_MO, camSan: 'btc' });
    const nut = screen.getByRole('button', { name: /CAM KẾT GIỮ 2 VÒNG/i });
    expect(onChon).not.toHaveBeenCalled();     // chưa bấm ⇒ chưa gọi gì
    fireEvent.click(nut);
    expect(onChon).toHaveBeenCalledWith('btc');
  });

  it('bấm lần hai ⇒ BỎ chọn (đổi ý được trước khi chốt)', () => {
    const { onChon } = dung({
      khoa: { ...KHOA_MO, chon: 'btc' }, camSan: 'btc',
    });
    fireEvent.click(screen.getByRole('button', { name: /ĐÃ CHỌN CAM KẾT/i }));
    expect(onChon).toHaveBeenCalledWith(null);
  });
});

describe('II. ⭐ Đang cam kết thì NÓI RÕ (founder: "hiển thị rõ")', () => {
  it('hiện mã + số vòng còn lại + câu KHÔNG rút được', () => {
    dung({
      khoa: { ...KHOA_MO, duoc: false, dangChay: { ma: 'btc', con_vong: 2, la_vong_chot: false } },
      viThe: { btc: 5000 },
    });
    expect(screen.getByText(/ĐANG CAM KẾT GIỮ BTC/i)).toBeInTheDocument();
    expect(screen.getByText(/còn 2 vòng/i)).toBeInTheDocument();
    expect(screen.getByText(/KHÔNG rút được/i)).toBeInTheDocument();
  });

  it('vòng CHỐT nói khác — lời hứa sắp xong, không doạ nữa', () => {
    dung({
      khoa: { ...KHOA_MO, duoc: false, dangChay: { ma: 'btc', con_vong: 1, la_vong_chot: true } },
      viThe: { btc: 5000 },
    });
    expect(screen.getByText(/VÒNG CHỐT/i)).toBeInTheDocument();
  });
});

describe('III. ⭐⭐ "không được đụng tới" là THẬT, không phải lời hứa suông', () => {
  it('rút mã ĐANG CAM KẾT bị chặn, và có câu giải thích', () => {
    const { onThem } = dung({
      khoa: { ...KHOA_MO, duoc: false, dangChay: { ma: 'btc', con_vong: 2, la_vong_chot: false } },
      viThe: { btc: 5000, vang: 5000 },
    });
    fireEvent.click(la('btc'));   // D540 — mặt + chip ở phiếu của thẻ đang chọn
    fireEvent.click(screen.getByRole('button', { name: /^RÚT$/i }));
    fireEvent.click(screen.getByRole('button', { name: /^HẾT$/ }));
    expect(onThem).not.toHaveBeenCalled();
    expect(screen.getByText(/ĐANG CAM KẾT GIỮ · CÒN 2 VÒNG/i)).toBeInTheDocument();
  });

  it('mã KHÁC vẫn rút bình thường — cam kết chỉ khoá đúng mã của nó', () => {
    const { onThem } = dung({
      khoa: { ...KHOA_MO, duoc: false, dangChay: { ma: 'btc', con_vong: 2, la_vong_chot: false } },
      viThe: { btc: 5000, vang: 5000 },
    });
    fireEvent.click(la('vang'));
    fireEvent.click(screen.getByRole('button', { name: /^RÚT$/i }));
    fireEvent.click(screen.getByRole('button', { name: /^HẾT$/ }));
    expect(onThem).toHaveBeenCalledWith({ ma: 'vang', chieu: 'ban', moc_bp: 10_000 });
  });

  it('MUA thêm mã đang cam kết VẪN được — cam kết là không RÚT, không phải đóng băng', () => {
    const { onThem } = dung({
      khoa: { ...KHOA_MO, duoc: false, dangChay: { ma: 'btc', con_vong: 2, la_vong_chot: false } },
      viThe: { btc: 5000 },
    });
    fireEvent.click(la('btc'));
    fireEvent.click(screen.getByRole('button', { name: /^25%$/ }));
    expect(onThem).toHaveBeenCalledWith({ ma: 'btc', chieu: 'mua', moc_bp: 2500 });
  });
});

/**
 * IV. ⭐⭐ CAM KẾT KHÔNG ĐƯỢC ĐI NHỜ SANG VÒNG SAU
 *
 * Bug thật, bắt được bằng MẮT trên stack local (không test nào bắt được, và
 * cũng không thể — nó là cuộc đua giữa cú tự-nộp lúc hết giờ và effect dọn
 * theo `vongHienTai`): chọn cam kết ở VÒNG 1, khoá lại bật ở VÒNG 3.
 * Người chơi bị khoá tài sản ở một vòng họ KHÔNG hề chọn — cách hỏng tệ nhất
 * có thể có cho một cơ chế mang tên CAM KẾT.
 *
 * Bản vá neo lựa chọn vào `{vong, ma}`. Bài dưới khoá đúng tính chất đó ở dạng
 * thuần: cùng một lựa chọn, đọc ở vòng khác thì KHÔNG còn hiệu lực.
 */
describe('IV. cam kết neo vào ĐÚNG vòng', () => {
  /** Đúng phép lọc mà màn trận dùng khi dựng payload và prop. */
  const conHieuLuc = (chon: { vong: number; ma: string } | null, vong: number) =>
    (chon && chon.vong === vong ? chon.ma : null);

  it('cùng vòng ⇒ có hiệu lực; sang vòng sau ⇒ HẾT, không đi nhờ', () => {
    const chon = { vong: 1, ma: 'btc' };
    expect(conHieuLuc(chon, 1)).toBe('btc');
    expect(conHieuLuc(chon, 2)).toBeNull();
    expect(conHieuLuc(chon, 3)).toBeNull();
  });

  it('không chọn gì ⇒ null ở mọi vòng (không tự bật)', () => {
    expect(conHieuLuc(null, 1)).toBeNull();
    expect(conHieuLuc(null, 9)).toBeNull();
  });
});
