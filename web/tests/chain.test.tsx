/**
 * DÂY CHUYỀN "VÌ SAO" — mỗi loại mắt xích phải nói ĐÚNG cơ chế của nó.
 *
 * ─────────────────────────────────────────────────────────────────────────
 * VÌ SAO CÓ FILE NÀY
 *
 * Engine sinh 12 loại mắt xích; DTO client chỉ khai 6. Sáu cơ chế T1/T2/T4/T8
 * rơi hết vào nhánh `default` và bị dán nhãn "🏋️ … khuếch đại ×2" — tức là mục
 * "VÌ SAO" nói SAI một nửa số dòng, đúng vào chỗ founder báo "chốt phiên chưa
 * rõ ràng". TypeScript im lặng vì union thiếu nhánh vẫn hợp lệ khi có `default`.
 *
 * Test này là thứ duy nhất bắt được lớp lỗi đó: nó đi qua TỪNG kind và đòi nhãn
 * phải phân biệt được. Thêm kind mới ở engine mà quên nhãn → đỏ ở đây.
 */
import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import { ChainReveal } from '../src/components/holdem/ChainReveal';
import type { KetQuaVongDTO, MatXichDTO } from '../src/api/holdem';

const TAI_SAN = [
  { id: 'btc', label: 'BTC', icon: '₿', nhom: 'rui_ro' as const, thanh_khoan: 'mong' as const, bien_dong_bp: 400 },
  { id: 'vang', label: 'Vàng', icon: '🥇', nhom: 'phong_thu' as const, thanh_khoan: 'vua' as const, bien_dong_bp: 240 },
];
const CHIEN_THUAT = [
  { id: 'ban_khong', label: 'Bán Khống', icon: '📉', mo_ta: '', pham_vi: 'tai_san' as const },
  { id: 'luot_song', label: 'Lướt Sóng', icon: '🌊', mo_ta: '', pham_vi: 'tai_san' as const },
  { id: 'khop_nhanh', label: 'Khớp Nhanh', icon: '⚡', mo_ta: '', pham_vi: 'tai_san' as const },
  { id: 'bat_day', label: 'Bắt Đáy', icon: '🩸', mo_ta: '', pham_vi: 'tai_san' as const },
  { id: 'chan_lo', label: 'Chặn Lỗ', icon: '🛡', mo_ta: '', pham_vi: 'tai_san' as const },
  { id: 'don_bay', label: 'Đòn Bẩy 2×', icon: '🏋️', mo_ta: '', pham_vi: 'tai_san' as const },
  { id: 'da_dang_hoa', label: 'Đa Dạng Hóa', icon: '🎯', mo_ta: '', pham_vi: 'tai_san' as const },
];
const GIAI_DOAN = [{ id: 'giam', label: 'Giảm', icon: '📉' }];
const SU_KIEN = [
  { id: 'chien_tranh', label: 'Chiến tranh', icon: '⚔' },
  { id: 'lam_phat', label: 'Lạm phát nóng', icon: '🔥' },
];

function veChuoi(chain: MatXichDTO[]) {
  const kq: KetQuaVongDTO = {
    vong: 3,
    o: { kind: 'giai_doan', giai_doan: 'giam' },
    tin_gia_lo: null,
    quy_vong: 4000,
    ghe_thang: 'ban',
    chay_vong_nay: [],
    cua_ban: {
      ghe_id: 'ban', pnl_bp: 500, da_cat_lo: false, cam_ket: 500,
      von_truoc: 10000, von_sau: 10500, chain, hanh_dong: 'giu_vi_the', da_hit: false,
    },
    cua_doi_thu: [],
  phi_cua_ban: null,
  ty_le_cat_lo_bp: 0,
  };
  return render(
    <ChainReveal
      kq={kq}
      deltaVon={500}
      taiSan={TAI_SAN}
      chienThuat={CHIEN_THUAT}
      giaiDoan={GIAI_DOAN}
      suKien={SU_KIEN}
    />,
  );
}

/** 12 kind của engine + đoạn chữ PHẢI xuất hiện ở nhãn. */
const CA: Array<{ ten: string; mx: MatXichDTO; phai: RegExp }> = [
  {
    ten: 'tai_san',
    mx: { kind: 'tai_san', id: 'btc', delta_bp: -300, giai_doan: 'giam', cap: 1 },
    // D393: mắt xích gọi tên LÁ trên ô (GIẢM), không còn tên tiếng Anh UPTREND/DOWNTREND.
    phai: /BTC.*khớp GIẢM/,
  },
  {
    ten: 'tai_san có chồng lá (cap>1)',
    mx: { kind: 'tai_san', id: 'btc', delta_bp: -600, giai_doan: 'giam', cap: 3 },
    phai: /×3 lá/,
  },
  {
    ten: 'echo',
    mx: { kind: 'echo', id: 'vang', su_kien: 'chien_tranh', delta_bp: 240 },
    phai: /dư âm Chiến tranh/,
  },
  {
    ten: 'crowding',
    mx: { kind: 'crowding', id: 'btc', delta_bp: -120, so_nguoi_dong: 3 },
    phai: /Chen chúc.*3 người/,
  },
  {
    ten: 'xung_dot',
    mx: { kind: 'xung_dot', cap: ['ban_khong', 'luot_song'], delta_bp: -250 },
    phai: /Bán Khống xung đột Lướt Sóng/,
  },
  {
    ten: 'cong_huong',
    mx: { kind: 'cong_huong', cap: ['chan_lo', 'da_dang_hoa'], delta_bp: 120 },
    phai: /Cộng hưởng/,
  },
  {
    ten: 'nhan (Đòn Bẩy)',
    mx: { kind: 'nhan', id: 'don_bay', he_so_bp: 20000, delta_bp: 800 },
    phai: /khuếch đại ×2/,
  },
  // ── Sáu kind từng bị dán nhãn sai ────────────────────────────────────
  {
    ten: 'T1 ct_su_kien',
    mx: { kind: 'ct_su_kien', id: 'ban_khong', su_kien: 'chien_tranh', delta_bp: 400 },
    phai: /Bán Khống ăn tin Chiến tranh/,
  },
  {
    ten: 'T2 day_chuyen bám ĐÚNG',
    mx: { kind: 'day_chuyen', tu: 'chien_tranh', den: 'lam_phat', dung: true, delta_bp: 300 },
    phai: /Bám ĐÚNG dây chuyền Chiến tranh → Lạm phát nóng/,
  },
  {
    ten: 'T2 day_chuyen bám NHẦM',
    mx: { kind: 'day_chuyen', tu: 'chien_tranh', den: 'lam_phat', dung: false, delta_bp: -200 },
    phai: /Bám NHẦM dây chuyền/,
  },
  {
    ten: 'T4 hoan_truot',
    mx: { kind: 'hoan_truot', id: 'btc', so_nguoi_dong: 4, delta_bp: 500 },
    phai: /Khớp Nhanh hoàn trượt giá BTC/,
  },
  {
    ten: 'T8 canh_nhip TRÚNG',
    mx: { kind: 'canh_nhip', id: 'bat_day', trung: true, delta_bp: 600 },
    phai: /Bắt Đáy bắt TRÚNG nhịp/,
  },
  {
    ten: 'T8 canh_nhip TRƯỢT',
    mx: { kind: 'canh_nhip', id: 'bat_day', trung: false, delta_bp: -900 },
    phai: /Bắt Đáy bắt TRƯỢT nhịp/,
  },
  {
    ten: 'T8 da_dang',
    mx: { kind: 'da_dang', so_ma: 4, delta_bp: 1040 },
    phai: /Đa Dạng Hóa · 4 mã/,
  },
  {
    ten: 'T8 phong_thu ĂN',
    mx: { kind: 'phong_thu', id: 'chan_lo', an: true, delta_bp: 400 },
    phai: /Chặn Lỗ che được cú này/,
  },
  {
    ten: 'T8 phong_thu TỐN PHÍ',
    mx: { kind: 'phong_thu', id: 'chan_lo', an: false, delta_bp: -150 },
    phai: /Chặn Lỗ · phí giữ bảo hiểm/,
  },
];

/*
 * ⚠ Dây chuyền diễn THEO NHỊP (lib/nhip.ts, ~340ms/mắt xích) — assert ngay sau
 * render thì danh sách còn rỗng và test xanh/đỏ vì lý do sai. Nên dùng
 * `findByText` (có retry) chứ không `textContent` đồng bộ.
 */
describe('Nhãn "VÌ SAO" phủ đủ 12 loại mắt xích', () => {
  for (const { ten, mx, phai } of CA) {
    it(`${ten} → nói đúng cơ chế`, async () => {
      const { unmount } = veChuoi([mx]);
      expect(
        await screen.findByText(phai),
        `nhãn sai cho kind ${mx.kind}`,
      ).toBeInTheDocument();
      unmount();
    });
  }

  /*
   * Bảo vệ chính lỗi đã xảy ra: sáu cơ chế mới bị gán nhãn của Đòn Bẩy. Chỉ
   * đúng MỘT kind được nói "khuếch đại ×2".
   *
   * Chạy dưới reduced-motion để cả chuỗi hiện NGAY (ChainReveal bỏ nhịp khi
   * reduced-motion). Vòng lặp 15 lần × ~400ms nhịp thật là >5s → timeout, và
   * timeout không phải phát hiện gì về nhãn cả. Đổi lại còn được thêm một bảo
   * đảm thật: nhánh reduced-motion vẫn render ĐỦ mắt xích, không cắt bớt.
   */
  it('🔴 chỉ `nhan` được nói "khuếch đại ×2" — các kind kia KHÔNG', () => {
    const goc = window.matchMedia;
    window.matchMedia = ((q: string) => ({
      matches: q.includes('prefers-reduced-motion'),
      media: q,
      addEventListener: () => {}, removeEventListener: () => {},
      addListener: () => {}, removeListener: () => {},
      dispatchEvent: () => false, onchange: null,
    })) as unknown as typeof window.matchMedia;
    try {
      const khac = CA.filter((x) => x.mx.kind !== 'nhan');
      const { unmount } = veChuoi(khac.map((c) => c.mx));
      // Đủ mắt xích: reduced-motion không được cắt bớt dòng nào.
      // getAllBy* vì render CHUNG một chuỗi: hai ca `tai_san` (cap 1 và cap 3)
      // đều khớp /BTC.*khớp GIẢM/, getBy* sẽ đỏ vì "nhiều element".
      for (const c of khac) {
        expect(screen.getAllByText(c.phai).length, `thiếu mắt xích ${c.mx.kind}`)
          .toBeGreaterThan(0);
      }
      expect(
        document.body.textContent,
        'có kind bị dán nhãn Đòn Bẩy — đúng lỗi đã sửa 25/07',
      ).not.toMatch(/khuếch đại/);
      unmount();
    } finally {
      window.matchMedia = goc;
    }
  });

  it('kind lạ → nói THẬT là chưa có nhãn, không đoán bừa một cái tên sai', async () => {
    veChuoi([{ kind: 'co_che_tuong_lai', delta_bp: 100 } as unknown as MatXichDTO]);
    expect(await screen.findByText(/chưa có nhãn/)).toBeInTheDocument();
  });
});

/*
 * SKIP — doc §6 (design_style_terminal_neon) BẮT BUỘC: "Luôn cho phép skip:
 * chạm màn hình khi đang chạy → nhảy thẳng trạng thái cuối."
 *
 * Nợ tôi tự tạo hôm 25/07: nới nhịp diễn rộng ra để "kịp cảm nhận" mà không có
 * đường thoát. Trận 8 vòng thua 5–6 lần là bình thường; chậm + không skip =
 * trừng phạt người chơi lần thứ hai sau khi họ vừa thua.
 */
/*
 * D435 (founder 27/09) — VÌ SAO là tấm ĐỌC: *"vì sao chỉ để xem tổng kết và lí do thôi"*. Đủ mắt xích ngay khi mở, số tổng
 * đứng đúng đích, không còn nút "chạm để xem ngay" (không còn gì để bỏ qua). Nhịp đổi-theo-từng-khoản dời ra con số vòng
 * ở màn chính (`mot_con_so.test.tsx` §D435). Tiêm lỗi: trả `useState(0)` + interval cũ ⇒ bài đầu đỏ.
 */
describe('D435 — VÌ SAO tĩnh: đủ mắt xích ngay khi mở', () => {
  const CHUOI: MatXichDTO[] = [
    { kind: 'tai_san', id: 'btc', delta_bp: -300, giai_doan: 'giam', cap: 1 },
    { kind: 'echo', id: 'vang', su_kien: 'chien_tranh', delta_bp: 240 },
    { kind: 'crowding', id: 'btc', delta_bp: -120, so_nguoi_dong: 3 },
    { kind: 'nhan', id: 'don_bay', he_so_bp: 20000, delta_bp: 800 },
  ];

  it('cả 4 mắt xích có mặt NGAY lần vẽ đầu — không đợi nhịp, không chạm', () => {
    veChuoi(CHUOI);
    expect(screen.getByText(/BTC.*khớp GIẢM/)).toBeInTheDocument();
    expect(screen.getByText(/dư âm Chiến tranh/)).toBeInTheDocument();
    expect(screen.getByText(/Chen chúc/)).toBeInTheDocument();
    expect(screen.getByText(/khuếch đại ×2/)).toBeInTheDocument();
  });

  it('không nút "chạm để xem ngay", số tổng không nhún', () => {
    const { container } = veChuoi(CHUOI);
    expect(screen.queryByRole('button', { name: /chạm để xem ngay/ })).toBeNull();
    expect(container.querySelector('[data-so-to]')!.className).not.toMatch(/tongNhay/);
  });
});

/*
 * ═══ D336 — SỐ TO TRONG TẤM LÀ % CẢ VÍ, KHÔNG PHẢI TỔNG CÁC DÒNG ════════════════
 * Ảnh prod founder gửi 15/09: ngoài bàn −38%, mở tấm VÌ SAO ra −123,47%. Số to từng là tổng
 * `delta_bp` các dòng, mà từ v10 NAV mỗi dòng là % GIÁ của một mã — cộng hai mã không ra %
 * của ai. Ca dưới dựng lại đúng hình dạng ảnh ấy: hai mã rơi mạnh nhưng chỉ chiếm một phần ví.
 * Tiêm lỗi: trả `soTo` về `pctBp(tongChay)` ⇒ bài đầu đỏ; bỏ khối PHẦN TIỀN ⇒ bài hai đỏ.
 */
describe('Tấm VÌ SAO nói CÙNG một con số với ngoài bàn (D336)', () => {
  const HAI_MA: MatXichDTO[] = [
    { kind: 'tai_san', id: 'btc', delta_bp: -3857, giai_doan: 'giam', cap: 1 },
    { kind: 'tai_san', id: 'vang', delta_bp: -4241, giai_doan: 'giam', cap: 1 },
    { kind: 'echo', id: 'btc', su_kien: 'chien_tranh', delta_bp: -2184 },
    { kind: 'echo', id: 'vang', su_kien: 'chien_tranh', delta_bp: -2885 },
  ];
  const ve = (
    nhip: { delta: number; goc: number } | null, tien?: Record<string, number>,
    cauNoi?: { id: string; tien: number }[],
  ) => {
    const kq: KetQuaVongDTO = {
      vong: 11, o: { kind: 'giai_doan', giai_doan: 'giam' }, tin_gia_lo: null, quy_vong: 4000,
      ghe_thang: 'bot_1', chay_vong_nay: [],
      cua_ban: {
        ghe_id: 'ban', pnl_bp: -3800, da_cat_lo: false, cam_ket: 500, von_truoc: 6000, von_sau: 5400,
        chain: HAI_MA, hanh_dong: 'giu_vi_the', da_hit: false,
        ...(tien ? { tien_theo_ma: tien } : {}),
      },
      cua_doi_thu: [], phi_cua_ban: null, ty_le_cat_lo_bp: 0,
      ...(cauNoi ? { cau_noi_nav: cauNoi } : {}),
    };
    return render(
      <ChainReveal kq={kq} deltaVon={-600} nhip={nhip} taiSan={TAI_SAN} chienThuat={CHIEN_THUAT}
        giaiDoan={GIAI_DOAN} suKien={[...SU_KIEN]} />,
    );
  };

  it('⭐⭐ có `nhip` ⇒ số to = % cả ví (−38,0%), không phải tổng các dòng (−131,67%)', async () => {
    const { container } = ve({ delta: -3800, goc: 10000 });
    const so = container.querySelector('[data-so-to]')!;
    expect(so.getAttribute('data-so-to')).toBe('ca-vi');
    expect(so.textContent).toBe('-38,0%');
    expect(container.textContent).not.toContain('131,67');
    // Chân tấm nói CHÊNH NAV, không nói chênh tiền mặt.
    expect(container.textContent).toMatch(/▼ 3\.800 NAV/);
    expect(container.textContent).not.toMatch(/600 VỐN/);
  });

  it('⭐ phần tiền theo mã đọc số server (`tien_theo_ma`), kể cả sổ khống', async () => {
    const { container } = ve({ delta: -3800, goc: 10000 }, { btc: -1234, vang: -2345, 'khong:vang': 120 });
    const khoi = container.querySelector('[data-tien-theo-ma]');
    expect(khoi, 'thiếu khối PHẦN TIỀN CỦA BẠN').not.toBeNull();
    expect(khoi!.textContent).toMatch(/BTC-1\.234/);
    expect(khoi!.textContent).toMatch(/Vàng-2\.345/);
    expect(khoi!.textContent).toMatch(/Vàng · khống\+120/);
  });

  it('⭐ D342 — cầu nối NAV: phí mua bán · nộp quỹ · chia quỹ hiện cạnh phần tiền theo mã (ảnh founder vòng 2)', async () => {
    const { container } = ve({ delta: -1855, goc: 8121 }, { btc: 89 }, [
      { id: 'phi_giao_dich', tien: -1832 }, { id: 'nop_quy', tien: -500 }, { id: 'quy_vong', tien: 388 },
    ]);
    const khoi = container.querySelector('[data-tien-theo-ma]')!;
    // D400 — dòng này đổi chữ thành "Trượt giá…" (founder 23/09) + loại cam; ghim TÍNH CHẤT: đúng dòng, đúng số.
    expect(khoi.querySelector('[data-cau-noi="phi_giao_dich"]')!.getAttribute('data-loai')).toBe('truot');
    expect(khoi.textContent).toMatch(/Trượt giá[^+-]*-1\.832/);
    /*
     * D374 — chữ ĐỔI (founder 21/09: *"Nộp quỹ vòng và chia quỹ vòng là gì?"*). Bài giữ
     * nguyên việc nó canh: đúng dòng, đúng dấu, đúng số. Nhưng thôi ghim CẢ CÂU — ghim câu
     * là mỗi lần sửa chữ cho dễ hiểu hơn lại phải sửa bài, và người sửa sẽ học cách sửa bài
     * thay vì sửa chữ. Ghim TÍNH CHẤT: dòng nộp là một khoản TRỪ 500, dòng chia là CỘNG 388,
     * và cả hai phải nói được "tiền cược" bằng tiếng người.
     */
    expect(khoi.textContent).toMatch(/[Tt]iền cược[^+-]*-500/);
    expect(khoi.textContent).toMatch(/[^+-]*tiền cược[^+-]*\+388/);
    expect(khoi.textContent, 'id thô lọt ra màn').not.toMatch(/phi_giao_dich|nop_quy|quy_vong/);
  });

  it('trận cũ không NAV (không `nhip`) ⇒ giữ hành vi cũ: tổng dây chuyền + tiền mặt', async () => {
    const { container } = ve(null);
    expect(container.querySelector('[data-so-to]')!.getAttribute('data-so-to')).toBe('tong-chuoi');
    expect(container.textContent).toMatch(/600 VỐN/);
  });
});
