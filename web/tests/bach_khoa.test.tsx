/**
 * BÁCH KHOA (D334) — canh nội dung + màn.
 *
 *   §I   toàn vẹn: id không trùng · mọi liên kết trỏ tới mục có thật · mọi icon vẽ ra pixel · mã/mặt/vai là id thật
 *   §II  A10 — mô tả, không kê đơn (quét MỌI chuỗi, kể cả chữ chưa vẽ ra DOM)
 *   §III MỘT NGUỒN CHO SỐ — tầng TRÊN BÀN không gõ tay một chữ số nào của luật; số đi qua `%{…}`
 *   §IV  với catalog dựng từ CHÍNH config, mọi `%{…}` đọc được — sai đường dẫn là dòng lặng lẽ biến mất
 *   §V   màn: danh sách · tìm không dấu · trang thẻ tin vẽ bảng đòn từ `tu_dien` · khách không thấy "chưa gặp"
 *   §VI  cửa vào: cuốn sách ở sảnh Đấu trường
 */
import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, within } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import {
  BANG_DIEN_TU, CHIEN_THUAT, DAC_QUYEN, GIAI_DOAN, HOLDEM_BALANCE_VERSION, KHAU_VI, MANDATE_TO_CHUC, NAV_V10,
  SUC_CANG, SU_KIEN, TAI_SAN, TIET_KIEM, giaMoBang, luatCua, boMaTranCua, CONG_HUONG_V20, XUNG_DOT_V19,
  LAI_VAY_DON_BAY, DONG_HO_MINIGAME,
} from '@config/holdem';
import { KY_QUY, MUC_DON_BAY, TO_CHUC_V57 } from '@config/minigame';
import { NGAN_HANG_DO_VO } from '@config/tiet_kiem_kinh_te';
import { VAI } from '@server/holdem/vai';
import { dungBachKhoa } from '@server/holdem/bach_khoa';
import { dungTuDien } from '@server/holdem/tu_dien';
import { daDangCua, vaiTheoLuat } from '@server/holdem/engine';
import { KHOANH_KHAC_IDS } from '@server/holdem/khoanh_khac_ids';
import type { CatalogBachKhoaDTO } from '@/api/bach_khoa';
import { PixelIcon, PixelLuoi } from '@/components/ui/PixelIcon';
import {
  DUONG_MAT_TIEN, LUOI_BACH_KHOA, MUC_BACH_KHOA, MUC_THEO_ID, NGUON_TINH, giaiSo, khopTim, moiChuoi, tachDoan,
} from '@/lib/bach_khoa';
import { tuKeDonTrong } from '@/lib/khoanh_khac';
import { CuaMatTien, dungNguon } from '@/screens/bach-khoa/BachKhoa';
import { TrangMuc } from '@/screens/bach-khoa/TrangMuc';

vi.setConfig({ testTimeout: 20_000 });

// Sảnh nằm sau AuthGate — bài §VI chỉ canh CÁI NÚT, không canh cổng đăng nhập (cổng có bài riêng).
vi.mock('@/components/AuthGate', () => ({ AuthGate: ({ children }: { children: React.ReactNode }) => children }));

/** Catalog y như server dựng (holdem_api.ts `/holdem/catalog`), đủ phần bách khoa đọc. */
/** Catalog server dựng cho một khoá (mặc định = khoá mặc định — đúng thứ người chơi đang thấy). D525: bài về luật CŨ truyền khoá cũ. */
function catalogThat(khoa: string = HOLDEM_BALANCE_VERSION): CatalogBachKhoaDTO {
  const luat = luatCua(khoa);
  return {
    tai_san: TAI_SAN.map((t) => ({ ...t })) as never,
    chien_thuat: CHIEN_THUAT.map((c) => ({ id: c.id, label: c.label })),
    giai_doan: GIAI_DOAN.map((g) => ({ ...g })),
    su_kien: SU_KIEN.map((x) => ({ id: x.id, label: x.label, icon: x.icon })),
    tu_dien: dungTuDien(TAI_SAN, CHIEN_THUAT.map((x) => x.id), XUNG_DOT_V19, CONG_HUONG_V20,
      boMaTranCua({ lop_vn: luat.lopVn, tai_san_v42: luat.taiSanV42 }), luat.couponTpcp, luat.khongTheoMa,
      luat.donBayTheoMa, luat.laiVayDonBay,
      // ⚠ BA CỜ NÀY TỪNG THIẾU (thêm 21/09, D371): fixture này là BẢN SAO THỨ HAI của catalog
      // server (`holdem_api.ts`), và nó đã trôi sau v49/v50 — tờ (!) dựng ở đây mang bộ số của
      // một bộ luật KHÔNG PHẢI bộ đang ship. Giữ khớp thứ tự với lời gọi bên server.
      luat.banKhongThuanQuyen, luat.phiLenhNhe, luat.daDangV52) as never,
    // D406 — CÙNG cửa với catalog server (`vaiTheoLuat` của khoá mặc định): fixture chép `VAI` thô là bản sao thứ hai
    // đã trôi — v54 vốn đều mà bài vẫn đọc ×3.
    vai: vaiTheoLuat(luat) as never,
    mandate_to_chuc: MANDATE_TO_CHUC,
    // v52 (D371) — cùng cửa engine mà catalog server dùng, không gõ hằng.
    da_dang_moi_vong: daDangCua({ da_dang_v52: luat.daDangV52 }),
    dac_quyen: DAC_QUYEN as never,
    gia_bang: { thuong: giaMoBang(false, false), luot_song: giaMoBang(true, false), luot_song_du_bao: giaMoBang(true, true) },
    luat: { PHI_BANG_DIEN_TU: BANG_DIEN_TU.PHI_MO, BUOC_MOC_BP: NAV_V10.BUOC_MOC_BP, BUOC_MOC_THO_BP: NAV_V10.BUOC_MOC_THO_BP, DAI_CANG_BP: SUC_CANG.DAI_CANG_BP, DAI_RAT_CANG_BP: SUC_CANG.DAI_RAT_CANG_BP },
    tiet_kiem: TIET_KIEM as never,
    // v46 (D338) — cùng điều kiện với catalog server: chỉ phát khi bộ luật mặc định có lãi vay.
    ...(luat.laiVayDonBay ? { lai_vay_don_bay: LAI_VAY_DON_BAY } : {}),
    // D406 — cùng điều kiện với catalog server: số đổ vỡ chỉ phát khi bộ luật mặc định bật cờ D405.
    ...(luat.nganHangDoVo ? {
      ngan_hang_do_vo: {
        BAO_HIEM_TOI_DA: NGAN_HANG_DO_VO.BAO_HIEM_TOI_DA, MAT_BP: NGAN_HANG_DO_VO.MAT_BP,
        SO_LA_XAU_TRUOC: NGAN_HANG_DO_VO.SO_LA_XAU_TRUOC,
      },
    } : {}),
    khau_vi: KHAU_VI as never,
    bach_khoa: dungBachKhoa(HOLDEM_BALANCE_VERSION) as never,
  };
}

const MAU_SO = /%\{[^}]+\}/g;

describe('§I toàn vẹn nội dung', () => {
  it('chống xanh rỗng: đủ chín nhóm, trên năm mươi mục', () => {
    expect(new Set(MUC_BACH_KHOA.map((m) => m.nhom)).size).toBe(9);
    expect(MUC_BACH_KHOA.length).toBeGreaterThan(50);
  });

  it('id không trùng', () => {
    expect(new Set(MUC_BACH_KHOA.map((m) => m.id)).size).toBe(MUC_BACH_KHOA.length);
  });

  it('⭐ mọi liên kết — trong câu lẫn LIÊN QUAN — trỏ tới một mục có thật', () => {
    const gay: string[] = [];
    for (const m of MUC_BACH_KHOA) {
      for (const id of m.lq) if (!MUC_THEO_ID.has(id)) gay.push(`${m.id} → lq ${id}`);
      for (const { s } of moiChuoi(m)) {
        for (const d of tachDoan(s.replace(MAU_SO, 'x'))) if (d.k === 'tu' && !MUC_THEO_ID.has(d.id)) gay.push(`${m.id} → {${d.id}}`);
      }
    }
    expect(gay).toEqual([]);
  });

  it('⭐ mọi icon vẽ ra pixel thật (lưới bách khoa hoặc PixelIcon)', () => {
    const rong: string[] = [];
    for (const m of MUC_BACH_KHOA) {
      const { container, unmount } = render(LUOI_BACH_KHOA[m.icon]
        ? <PixelLuoi luoi={LUOI_BACH_KHOA[m.icon]!} size={16} />
        : <PixelIcon name={m.icon as never} size={16} />);
      const bong = (container.querySelector('span > span') as HTMLElement | null)?.style.boxShadow ?? '';
      if (bong.trim() === '') rong.push(`${m.id}:${m.icon}`);
      unmount();
    }
    expect(rong).toEqual([]);
  });

  it('mã · mặt tin · vai · khái niệm gắn vào mục là id THẬT của server', () => {
    const ma = new Set(TAI_SAN.map((t) => t.id));
    const sk = new Set(SU_KIEN.map((x) => x.id));
    for (const m of MUC_BACH_KHOA) {
      if (m.ma) expect(ma, m.id).toContain(m.ma);
      if (m.suKien) expect(sk, m.id).toContain(m.suKien);
      if (m.vai) expect(Object.keys(VAI), m.id).toContain(m.vai);
      if (m.khoanhKhac) expect(KHOANH_KHAC_IDS, m.id).toContain(m.khoanhKhac);
      for (const c of m.doiBan) {
        if (!c.muc) continue;
        const r = c.muc;
        const dsMa = r.loai === 'sk_ma' ? r.ma : [r.ma];
        const dsSk = r.loai === 'sk_ma' ? [r.sk] : r.loai === 'ma_sk' ? r.sk : [];
        for (const x of dsMa) expect(ma, `${m.id} muc`).toContain(x);
        for (const x of dsSk) expect(sk, `${m.id} muc`).toContain(x);
      }
    }
    // Đủ 11 mặt tin đang sống có mục riêng, và đủ 8 khái niệm của sổ tay.
    const sống = Object.keys(dungBachKhoa(HOLDEM_BALANCE_VERSION).the_tin);
    for (const id of sống) expect(MUC_BACH_KHOA.some((m) => m.suKien === id), `thiếu mục cho mặt ${id}`).toBe(true);
    for (const id of KHOANH_KHAC_IDS) expect(MUC_BACH_KHOA.some((m) => m.khoanhKhac === id), `thiếu mục cho khái niệm ${id}`).toBe(true);
  });
});

describe('§II A10 — mô tả, không kê đơn', () => {
  it('⭐⭐ không chuỗi nào chứa từ kê đơn', () => {
    const vi: string[] = [];
    for (const m of MUC_BACH_KHOA) {
      for (const { s } of moiChuoi(m)) {
        const tu = tuKeDonTrong(s);
        if (tu.length > 0) vi.push(`${m.id}: [${tu.join(', ')}] ${s.slice(0, 70)}`);
      }
    }
    expect(vi).toEqual([]);
  });
});

describe('§III một nguồn cho số', () => {
  it('⭐⭐ tầng TRÊN BÀN không gõ tay chữ số nào — số của luật chỉ đi qua %{…}', () => {
    const vi: string[] = [];
    for (const m of MUC_BACH_KHOA) {
      for (const { tang, s } of moiChuoi(m)) {
        if (tang !== 'ban') continue;
        // Tên riêng có chữ số (VN30) không phải số của luật.
        const tron = s.replace(MAU_SO, '').replace(/\{[a-z_0-9]+\|/g, '{').replace(/VN30/g, 'VN');
        if (/\d/.test(tron)) vi.push(`${m.id}: ${s.slice(0, 80)}`);
      }
    }
    expect(vi).toEqual([]);
  });
});

describe('§IV với catalog thật, mọi chỗ đọc số đều đọc được', () => {
  /*
   * D406 — ẨN ĐÚNG theo luật mặc định, khoá theo (MỤC, ĐƯỜNG DẪN) chứ không theo đường dẫn trơn: v54 cắt lá Đa Dạng Hoá
   * (`loiGon`) ⇒ không vai nào ghim nó ⇒ câu "vai … ghim sẵn Đa Dạng Hoá" ở mục ĐA DẠNG HOÁ phải biến mất. Miễn chỉ
   * sống khi khoá mặc định thật sự cắt lá — lật về khoá còn lá thì dòng ấy lại phải đọc được.
   */
  /*
   * D525 — khoá mặc định v58 (khung minigame): vai thôi GHIM LÕI, đổi sang GHIM TRAIT (D482) ⇒ mọi dòng "vai X ghim sẵn lá này" của
   * mục lõi ẨN có chủ đích (số `%{ghim.*}` trả null). Không phải dòng hỏng.
   */
  const luatMacDinh = luatCua(HOLDEM_BALANCE_VERSION);
  const AN_DUNG: ReadonlySet<string> = new Set([
    ...(luatMacDinh.loiGon ? ['da_dang|%{ghim.da_dang_hoa'] : []),
    ...(luatMacDinh.traitGhimMinigame ? ['luot_song|%{ghim.luot_song', 'don_bay|%{ghim.don_bay', 'da_dang|%{ghim.da_dang_hoa'] : []),
    // v57+ bỏ sổ tiết kiệm (D456) ⇒ số đổ vỡ không phát ⇒ dòng đổ vỡ của mục TIẾT KIỆM ẩn (đúng thiết kế D406).
    ...(!luatMacDinh.nganHangDoVo ? ['tiet_kiem|%{nhdv.'] : []),
  ]);
  const anDung = (id: string, chuoi: string) => [...AN_DUNG].some((k) => {
    const [muc, dau] = k.split('|') as [string, string];
    return muc === id && chuoi.includes(dau);
  });

  it('⭐ không một `%{…}` nào hỏng — dòng hỏng là dòng lặng lẽ biến mất khỏi màn', () => {
    const nguon = dungNguon(catalogThat());
    const hong: string[] = [];
    for (const m of MUC_BACH_KHOA) {
      for (const { tang, s } of moiChuoi(m)) {
        if (tang === 'ban' && s.includes('%{') && giaiSo(s, nguon) === null && !anDung(m.id, s)) hong.push(`${m.id}: ${s.slice(0, 80)}`);
      }
    }
    expect(hong).toEqual([]);
  });

  it('⚠ bài này ĐỎ được: không catalog thì dòng có số trả null (ẩn), và đường dẫn bịa cũng null', () => {
    expect(giaiSo('Sàn %{dq.CHAN_LO.SAN_BP:pc}%', { ...NGUON_TINH })).toBeNull();
    expect(giaiSo('%{dq.KHONG_CO.X:pc}', dungNguon(catalogThat()))).toBeNull();
    expect(giaiSo('Sàn −%{dq.CHAN_LO.SAN_BP:pc}%', dungNguon(catalogThat()))).toBe(`Sàn −${DAC_QUYEN.CHAN_LO.SAN_BP / 100}%`);
  });

  it('⭐ D495 — số MÀN LÕI đọc từ catalog (một nguồn `config/minigame.ts`), không catalog thì ẩn', () => {
    const nguon = dungNguon(catalogThat());
    expect(giaiSo('×%{mg.muc_don_bay:ds}', nguon)).toBe(`×${MUC_DON_BAY.join(' · ')}`);
    expect(giaiSo('%{mg.goi_bp:pc}%', nguon)).toBe(`${KY_QUY.GOI * 100}%`);
    expect(giaiSo('%{mg.thanh_ly_bp:pc}%', nguon)).toBe(`${KY_QUY.THANH_LY * 100}%`);
    expect(giaiSo('%{mg.chay_s:n}', nguon)).toBe(String(DONG_HO_MINIGAME.CHAY_S));
    expect(giaiSo('%{mg.goi_bp:pc}%', { ...NGUON_TINH })).toBeNull();
    // D501 — Tổ Chức + Rải lệnh, cùng một nguồn `TO_CHUC_V57` / `RAI_LENH_NEN`.
    expect(giaiSo('%{mg.to_chuc_tran_bp:pc}%', nguon)).toBe(`${TO_CHUC_V57.TRAN_THUA_BP / 100}%`);
    expect(giaiSo('×%{mg.thoa_thuan:thuc}', nguon)).toBe(`×${String(TO_CHUC_V57.TRUOT_THOA_THUAN).replace('.', ',')}`);
    expect(giaiSo('%{mg.rai_nen:ds}', nguon)).toBe('2 · 3 · 5');
    for (const id of ['man_loi', 'bang_phu', 'san_thanh_ly', 'thanh_ly_day_chuyen']) expect(MUC_THEO_ID.get(id), id).toBeTruthy();
  });

  it('vai ghim đọc đúng tên từ bảng vai (không chép tay tên vai vào lá)', () => {
    // D525 — khoá còn GHIM LÕI (v56); khoá mặc định v58 ghim trait nên `ghim.*` trả null (bài AN_DUNG ở trên).
    const nguon = dungNguon(catalogThat('balance-v56-congdon'));
    expect(giaiSo('%{ghim.luot_song:vai}', nguon)).toBe(VAI.doi_lai.ten);
    expect(giaiSo('%{ghim.don_bay:vai}', nguon)).toBe(VAI.ca_map.ten);
  });
});

function veMuc(id: string, cat: CatalogBachKhoaDTO | undefined, soTay?: never) {
  const m = MUC_THEO_ID.get(id)!;
  return render(
    <MemoryRouter>
      <TrangMuc m={m} cat={cat} soTay={soTay} nguon={dungNguon(cat)} onMo={() => {}} onVe={() => {}} />
    </MemoryRouter>,
  );
}

describe('§V màn', () => {
  it('tìm không dấu: "lai suat" ra LÃI SUẤT', () => {
    expect(khopTim(MUC_THEO_ID.get('lai_suat')!, 'lai suat')).toBe(true);
    expect(khopTim(MUC_THEO_ID.get('crypto')!, 'lai suat')).toBe(false);
  });

  it('⭐ thẻ SẬP SÀN vẽ bảng đòn đủ sáu mã, mức lấy từ tu_dien — Crypto rất yếu, Vàng rất khoẻ', () => {
    veMuc('tb_sap_san', catalogThat());
    const bang = screen.getByTestId('bang-don');
    const chip = within(bang).getAllByText(/khoẻ|yếu|trung tính/);
    expect(chip).toHaveLength(6);
    const muc = (ten: string) => [...bang.querySelectorAll('[data-muc]')].find((e) => e.textContent?.startsWith(ten))?.getAttribute('data-muc');
    expect(muc('Crypto')).toBe('rat_xau');
    expect(muc('Vàng')).toBe('rat_tot');
    // Sập sàn không kéo mặt nào rõ rệt ⇒ cặp "hay kéo theo" (nếu có) ẩn; độ giả thì hiện.
    expect(screen.getByText(/thường hơn hẳn các thẻ khác/)).toBeTruthy();
  });

  it('⭐ không catalog (khách): chữ vẫn đủ, khối số và bảng đòn ẩn — không đoán số', () => {
    veMuc('chan_lo', undefined);
    expect(screen.getByText('NGOÀI ĐỜI')).toBeTruthy();
    expect(screen.queryByText('SỐ')).toBeNull();
    expect(document.body.textContent).not.toMatch(/%\{/);
  });

  it('có catalog: CHẶN LỖ in đúng sàn và phí của bộ luật đang chạy', () => {
    veMuc('chan_lo', catalogThat());
    const chu = document.body.textContent ?? '';
    expect(chu).toContain(`−${DAC_QUYEN.CHAN_LO.SAN_BP / 100}%`);
    expect(chu).toContain(`${String(DAC_QUYEN.CHAN_LO.PHI_MOI_VONG_BP / 100).replace('.', ',')}%`);
  });

  it('lá vai ĐỘI LÁI đọc quyền · giá · vốn từ bảng vai của server', () => {
    veMuc('doi_lai', catalogThat());
    const chu = document.body.textContent ?? '';
    // D525 — đọc từ bảng vai của KHOÁ ĐANG CHẠY (v58: trait ghim TUNG TIN), không từ `VAI` thô (bản luật v34).
    const bang = vaiTheoLuat(luatCua(HOLDEM_BALANCE_VERSION));
    expect(chu).toContain(bang.doi_lai.dac_quyen);
    expect(chu).toContain(bang.doi_lai.cai_gia);
    expect(chu).toContain(`×${vaiTheoLuat(luatCua(HOLDEM_BALANCE_VERSION)).doi_lai.he_so_von} so với vốn cơ bản`);
  });

  /*
   * D406 — sổ chịu nền kinh tế (D405) thành mặc định: mục TIẾT KIỆM nói đổ vỡ bằng SỐ của server, và dòng ấy phải
   * biến mất khi bộ luật mặc định không bật cờ (lật ngược mặc định thì Bách khoa tự thôi nói, không ai phải sửa chữ).
   */
  it('⭐ D406 — mục TIẾT KIỆM đọc hạn mức bảo hiểm + mức mất từ catalog; vắng cờ đổ vỡ ⇒ dòng ẩn', () => {
    // D525 — khoá mặc định v58 không còn sổ tiết kiệm ⇒ dựng catalog khoá v56 (còn đổ vỡ); vế "vắng cờ ⇒ ẩn" giữ nguyên dưới.
    const cat = catalogThat('balance-v56-congdon');
    expect(cat.ngan_hang_do_vo, 'bộ luật v56 bật cờ đổ vỡ (D406)').toBeDefined();
    const co = veMuc('tiet_kiem', cat);
    const chu = document.body.textContent ?? '';
    expect(chu).toContain(`${NGAN_HANG_DO_VO.SO_LA_XAU_TRUOC} lá tin xấu liền nhau`);
    expect(chu).toContain(`vượt ${NGAN_HANG_DO_VO.BAO_HIEM_TOI_DA} chip mất ${NGAN_HANG_DO_VO.MAT_BP / 100}%`);
    expect(chu).toContain(`tới ${NGAN_HANG_DO_VO.BAO_HIEM_TOI_DA} chip`);
    co.unmount();
    const { ngan_hang_do_vo: _bo, ...khongCo } = cat;
    veMuc('tiet_kiem', khongCo);
    const chu2 = document.body.textContent ?? '';
    // Chống xanh rỗng: trang vẫn vẽ (bảng số còn dòng tất toán) — chỉ riêng dòng đổ vỡ biến mất.
    expect(chu2).toContain('Tất toán sớm');
    expect(chu2).not.toContain('đổ vỡ');
    expect(chu2).not.toContain('Bảo hiểm tiền gửi');
  });
});

describe('§VI cửa vào: cuốn sách ở sảnh', () => {
  it('icon `sach` vẽ ra pixel thật', () => {
    const { container } = render(<PixelIcon name="sach" size={32} />);
    expect((container.querySelector('span > span') as HTMLElement).style.boxShadow.trim()).not.toBe('');
  });

  it('⭐ sảnh Đấu trường có nút BÁCH KHOA dẫn tới /bach-khoa', async () => {
    const { AlphaDraftLobby } = await import('@/screens/holdem/AlphaDraftLobby');
    const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    render(
      <QueryClientProvider client={qc}>
        <MemoryRouter initialEntries={['/arena']}>
          <Routes>
            <Route path="/arena" element={<AlphaDraftLobby />} />
            <Route path="/bach-khoa" element={<p>TRANG BÁCH KHOA</p>} />
          </Routes>
        </MemoryRouter>
      </QueryClientProvider>,
    );
    const nut = await screen.findByTestId('nut-bach-khoa');
    fireEvent.click(nut);
    expect(await screen.findByText('TRANG BÁCH KHOA')).toBeTruthy();
  });
});

/*
 * §VII — CỬA "CÁCH BẠN MẤT TIỀN" (D352).
 *
 * Cửa này CỐ Ý không chứa nội dung: nó chở id + một câu, còn định nghĩa và số ở mục gốc
 * (A11.5 — không dựng bản sao thứ hai). Cái giá của thiết kế ấy là một lớp lỗi mới: **id gõ
 * sai thì dòng biến mất KHÔNG một tiếng động** — màn lọc `if (!m) return null` nên trang vẫn
 * vẽ đẹp, chỉ thiếu một đường mất tiền, và không ai biết đường nào thiếu.
 * Ba bài dưới canh đúng ba thứ cửa này có thể hỏng một mình.
 */
describe('§VII cửa "cách bạn mất tiền"', () => {
  it('⭐⭐ mọi đường trỏ tới một mục CÓ THẬT — gõ sai id là dòng biến mất không tiếng động', () => {
    const hong = DUONG_MAT_TIEN.filter((d) => !MUC_THEO_ID.has(d.id)).map((d) => d.id);
    expect(hong, 'id không có mục tương ứng').toEqual([]);
  });

  it('không trùng đường, và mỗi đường có một câu thật', () => {
    const ids = DUONG_MAT_TIEN.map((d) => d.id);
    expect(new Set(ids).size, 'có id lặp').toBe(ids.length);
    for (const d of DUONG_MAT_TIEN) expect(d.cau.length, d.id).toBeGreaterThan(20);
  });

  it('⭐ A10 + không gõ số của luật — cửa này là tầng TRÊN BÀN', () => {
    for (const d of DUONG_MAT_TIEN) {
      expect(tuKeDonTrong(d.cau), `${d.id}: kê đơn`).toEqual([]);
      expect(/\d/.test(d.cau.replace(/VN30/g, 'VN')), `${d.id}: gõ tay số của luật`).toBe(false);
    }
  });

  it('⭐ màn: cửa hiện vô điều kiện, đủ mười dòng, và mỗi dòng gọi mở ĐÚNG mục của nó', () => {
    const daMo: string[] = [];
    render(
      <MemoryRouter>
        <CuaMatTien onMo={(id) => daMo.push(id)} />
      </MemoryRouter>,
    );
    const cua = screen.getByTestId('cua-mat-tien');
    for (const d of DUONG_MAT_TIEN) {
      expect(within(cua).getByTestId(`mat-tien-${d.id}`), `thiếu dòng ${d.id}`).toBeTruthy();
    }
    for (const d of DUONG_MAT_TIEN) fireEvent.click(within(cua).getByTestId(`mat-tien-${d.id}`));
    expect(daMo, 'dòng mở nhầm mục').toEqual(DUONG_MAT_TIEN.map((d) => d.id));
  });
});
