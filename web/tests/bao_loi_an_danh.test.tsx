/**
 * LỖI CLIENT ẨN DANH + THẺ "ĐIỀU KHOẢN VỪA ĐỔI" (SPEC `docs/spec/bao-loi-nguoi-choi.md` mục 5 — test web).
 *
 * Hai bài canh của cửa một chiều (A11.17):
 *   · THỨ TỰ — máy chưa bấm thẻ T9 thì `baoLoiAnDanh()` không gọi mạng; bấm rồi thì đúng một lần mỗi mã mỗi phiên.
 *   · CHỮ ↔ HÀNH VI — danh sách trường client gửi (`TRUONG_BAO_LOI_AN_DANH`) khớp đúng thứ đoạn điều khoản kể ra; thêm một
 *     trường mà không sửa điều khoản ⇒ đỏ.
 */
import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import { act, fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom';
import { TRUONG_BAO_LOI_AN_DANH, type TruongBaoLoiAnDanh } from '@config/bao_loi';
import { BAN_PHAT_HANH } from '@config/phien_ban';
import {
  baoLoiAnDanh,
  daXemTheDieuKhoan,
  danhDauDaXemTheDieuKhoan,
  NGAY_THE_DIEU_KHOAN,
  URL_LOI_CLIENT,
  _datLaiBaoLoiAnDanhChoTest,
} from '../src/lib/bao_loi_an_danh';
import { MUC, TOM_TAT } from '../src/content/dieuKhoan';
import { CHU_THE_DIEU_KHOAN } from '../src/content/baoLoi';
import { TheDieuKhoanDoi } from '../src/components/TheDieuKhoanDoi';
import { RanhGioiLoi } from '../src/components/ui/ManLoi';
import { _datLaiChoTest } from '../src/lib/telemetry';

let fetchGia: ReturnType<typeof vi.fn>;

beforeEach(() => {
  _datLaiBaoLoiAnDanhChoTest();
  _datLaiChoTest();
  fetchGia = vi.fn(async () => new Response(null, { status: 202 }));
  vi.stubGlobal('fetch', fetchGia);
});

afterEach(() => {
  _datLaiBaoLoiAnDanhChoTest();
  _datLaiChoTest();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

const goiLoiClient = () => fetchGia.mock.calls.filter(([url]) => url === URL_LOI_CLIENT);

describe('bài canh THỨ TỰ — chưa xem thẻ thì chưa gửi', () => {
  it('chưa có cờ "đã xem thẻ" ⇒ baoLoiAnDanh không gọi mạng', () => {
    expect(daXemTheDieuKhoan()).toBe(false);
    baoLoiAnDanh('route:typeerror:1f3kq2', '/arena');
    expect(goiLoiClient()).toHaveLength(0);
  });

  it('có cờ ⇒ gọi đúng một lần cho mỗi mã mỗi phiên; mã khác thì gọi thêm', () => {
    danhDauDaXemTheDieuKhoan();
    baoLoiAnDanh('route:typeerror:1f3kq2', '/arena');
    baoLoiAnDanh('route:typeerror:1f3kq2', '/arena');
    baoLoiAnDanh('route:typeerror:1f3kq2', '/hub');
    expect(goiLoiClient()).toHaveLength(1);
    baoLoiAnDanh('goc:referenceerror:9zz', '/hub');
    expect(goiLoiClient()).toHaveLength(2);
  });

  it('gói đi: đúng các trường TRUONG_BAO_LOI_AN_DANH, số bản app, KHÔNG cookie (credentials omit)', () => {
    danhDauDaXemTheDieuKhoan();
    baoLoiAnDanh('route:typeerror:1f3kq2', '/arena');
    const [, init] = goiLoiClient()[0]! as [string, RequestInit];
    expect(init.method).toBe('POST');
    expect(init.credentials).toBe('omit');
    const than = JSON.parse(String(init.body)) as Record<string, string>;
    expect(Object.keys(than)).toEqual([...TRUONG_BAO_LOI_AN_DANH]);
    expect(than).toEqual({ ma: 'route:typeerror:1f3kq2', man: '/arena', ban: BAN_PHAT_HANH });
  });

  it('fetch ném (mất mạng) ⇒ baoLoiAnDanh không ném', () => {
    danhDauDaXemTheDieuKhoan();
    vi.stubGlobal('fetch', vi.fn(() => { throw new Error('offline'); }));
    expect(() => baoLoiAnDanh('route:typeerror:x', '/arena')).not.toThrow();
  });

  it('ranh giới lỗi gốc: app vỡ trên máy CHƯA xem thẻ ⇒ không gửi; ĐÃ xem ⇒ gửi một gói mang mã goc:*', () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    const No = (): never => { throw new TypeError('bùm'); };
    const { unmount } = render(<RanhGioiLoi><No /></RanhGioiLoi>);
    expect(goiLoiClient()).toHaveLength(0);
    unmount();

    danhDauDaXemTheDieuKhoan();
    render(<RanhGioiLoi><No /></RanhGioiLoi>);
    expect(goiLoiClient()).toHaveLength(1);
    const than = JSON.parse(String((goiLoiClient()[0]! as [string, RequestInit])[1].body)) as Record<string, string>;
    expect(than.ma).toMatch(/^goc:typeerror:[a-z0-9]+$/);
    // Không chở thông điệp lỗi gốc (C7).
    expect(JSON.stringify(than)).not.toContain('bùm');
  });
});

describe('bài canh CHỮ ↔ HÀNH VI — điều khoản kể đúng thứ client gửi', () => {
  /** Mỗi trường client gửi ⇄ cụm chữ đoạn T4 dùng để kể nó. Thêm trường mà không thêm dòng ở đây ⇒ đỏ ngay bài đầu. */
  const CUM_CHU: Record<TruongBaoLoiAnDanh, { t4: string; t1: string; the: string }> = {
    ma: { t4: '**một mã lỗi**', t1: 'mã lỗi', the: 'mã lỗi' },
    man: { t4: '**tên màn**', t1: 'tên màn', the: 'tên màn' },
    ban: { t4: '**số bản app**', t1: 'số bản', the: 'số bản' },
  };
  const SO_CHU = ['không', 'một', 'hai', 'ba', 'bốn', 'năm', 'sáu'];
  const doanDuLieu = MUC.find((m) => m.id === 'du-lieu')!.doan;
  const t4 = doanDuLieu.find((d) => d.startsWith('**Báo lỗi ẩn danh'))!;
  const t1 = TOM_TAT.find((d) => d.includes('một mã lỗi không gắn với bạn'))!;

  it('mọi trường đều có cụm chữ, và không cụm chữ nào thừa', () => {
    expect(Object.keys(CUM_CHU).sort()).toEqual([...TRUONG_BAO_LOI_AN_DANH].sort());
  });

  it('T4 (mục Dữ liệu) nói "đúng N thứ" với N = số trường, và kể từng trường theo đúng thứ tự gửi', () => {
    expect(t4).toBeDefined();
    expect(t4).toContain(`đúng ${SO_CHU[TRUONG_BAO_LOI_AN_DANH.length]} thứ`);
    let viTri = -1;
    for (const k of TRUONG_BAO_LOI_AN_DANH) {
      const i = t4.indexOf(CUM_CHU[k].t4);
      expect(i, `T4 thiếu "${CUM_CHU[k].t4}"`).toBeGreaterThan(viTri);
      viTri = i;
    }
    // Lời hứa phủ định — phải còn nguyên.
    expect(t4).toContain('Không mã tài khoản, không email, không chữ bạn gõ');
  });

  it('T1 (tóm tắt) và thẻ T9 kể cùng ba thứ', () => {
    expect(t1).toBeDefined();
    for (const k of TRUONG_BAO_LOI_AN_DANH) {
      expect(t1).toContain(CUM_CHU[k].t1);
      expect(CHU_THE_DIEU_KHOAN.than).toContain(CUM_CHU[k].the);
    }
  });
});

describe('thẻ T9 "Điều khoản vừa đổi"', () => {
  const ViTri = (): React.ReactElement => {
    const l = useLocation();
    return <p data-testid="vi-tri">{l.pathname}{l.hash}</p>;
  };
  const dung = () => render(
    <MemoryRouter initialEntries={['/hub']}>
      <TheDieuKhoanDoi />
      <Routes><Route path="*" element={<ViTri />} /></Routes>
    </MemoryRouter>,
  );

  it('máy chưa xem ⇒ hiện tiêu đề kèm ngày + thân chữ; "Đã hiểu" ⇒ ẩn, cờ bật, lần dựng sau không hiện nữa', () => {
    const { unmount } = dung();
    expect(screen.getByText(`${CHU_THE_DIEU_KHOAN.tieuDe} · ${NGAY_THE_DIEU_KHOAN}`)).toBeTruthy();
    expect(screen.getByText(CHU_THE_DIEU_KHOAN.than)).toBeTruthy();
    act(() => { fireEvent.click(screen.getByText(CHU_THE_DIEU_KHOAN.daHieu)); });
    expect(screen.queryByText(CHU_THE_DIEU_KHOAN.than)).toBeNull();
    expect(daXemTheDieuKhoan()).toBe(true);
    unmount();
    dung();
    expect(screen.queryByText(CHU_THE_DIEU_KHOAN.than)).toBeNull();
  });

  it('"Xem chỗ đổi" cũng tính là đã xem, và đưa tới /dieu-khoan#du-lieu', () => {
    dung();
    act(() => { fireEvent.click(screen.getByText(CHU_THE_DIEU_KHOAN.xem)); });
    expect(daXemTheDieuKhoan()).toBe(true);
    expect(screen.getByTestId('vi-tri').textContent).toBe('/dieu-khoan#du-lieu');
  });
});
