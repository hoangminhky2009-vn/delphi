/**
 * PFM — MÀN HŨ (`screens/tai-chinh/Hu.tsx`), theo DEMO ĐÃ CHỐT (A11.25).
 *
 * ⚠ VIẾT LẠI 11/10 (TẦNG KHÔNG GIAN — SPEC `pfm-tang-khong-gian`, demo CHỐT bản 6, founder "A A A"): màn HŨ không cuộn nay là mặt BENTO
 *   (ô CHIA TIỀN · ô ★ hũ ưu tiên · hai nhóm TIẾT KIỆM/CHI với hũ mini và dấu + · ô DANH MỤC); danh sách lá, quyết toán, bảng tạo hũ ba bước,
 *   chi tiết hũ nằm ở LỚP TRƯỢT. Mọi LUẬT bên dưới GIỮ NGUYÊN (tên là thứ duy nhất bắt buộc · mức/nhãn ở lại `null` · sao là dấu của người
 *   dùng · hũ tiêu dùng không kỳ hạn không tự chia · "chưa đặt mức" là "—" chứ không "0%" · quyết toán do người dùng chọn · hũ xong đứng sau…);
 *   chỉ ĐƯỜNG TỚI chúng đổi: mở ô/lớp trước rồi mới thấy lá. Bảng tạo một-form thành TẠO HŨ BA BƯỚC (CHI chỉ hai bước).
 *
 * ⚠ Nhại `pfm_ban_tien.test.tsx`/`pfm_man_so.test.tsx`: `KhoTrongBoNho` + `QueryClientProvider`
 * + `KhoProvider`, đọc KHO làm nguồn sự thật (không chỉ đọc DOM).
 */
import { describe, expect, it } from 'vitest';
import { render, screen, waitFor, fireEvent, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { RuotHu } from '../src/screens/tai-chinh/Hu';
import { KhoProvider } from '../src/pfm/dung_kho';
import { KhoTrongBoNho, type KhoPfm } from '../src/pfm/kho.js';
import { khoanRaBanGhi, taoKhoan, type Khoan } from '../src/pfm/so.js';
import {
  tuTao, doiTrangThai, resetGop, chuyenDuoc, KET_QUA_HU, type Hu, type TrangThaiHu,
} from '../src/pfm/hu.js';
import { thangNay } from '../src/pfm/thoi_gian.js';
import { taoKhoanPhanBo } from '../src/pfm/phan_bo.js';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import {
  CHU_BENTO as CB, CHU_KET_QUA_HU, CHU_MAN_HU, CHU_NUT_HU, CHU_PHAN_BO as CP, CHU_PILL_HU, CHU_VI_THE, O_CHU_LOAI_CHI, moiChuoiPfm,
} from '../src/lib/pfm_chu';

const LUC = '2026-09-06T10:00:00.000Z';

function ve(kho: KhoPfm) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <MemoryRouter initialEntries={['/tai-chinh/hu']}>
      <QueryClientProvider client={qc}>
        <KhoProvider kho={kho}><RuotHu /></KhoProvider>
      </QueryClientProvider>
    </MemoryRouter>,
  );
}

interface HuSeed {
  id: string; ten: string; muc?: number; trangThai?: TrangThaiHu; nhom?: 'tich_luy' | 'tieu_dung';
}

/** Dựng kho có sẵn vài hũ + vài khoản sổ (nối bằng `huId`). */
async function khoCo(
  hus: HuSeed[],
  khoans: (Partial<Khoan> & { ngayTrongThang?: number })[] = [],
): Promise<KhoTrongBoNho> {
  const kho = new KhoTrongBoNho();
  const th = thangNay();
  for (const h of hus) {
    let d = tuTao({
      ten: h.ten, ...(h.muc !== undefined ? { muc: h.muc } : {}), ...(h.nhom !== undefined ? { nhom: h.nhom } : {}),
    }, LUC, h.id);
    if (h.trangThai && h.trangThai !== 'dang_chay') d = doiTrangThai(d, h.trangThai, LUC);
    await kho.ghi('hu', { id: h.id, thang: th, suaLuc: LUC, d });
  }
  for (const [i, k] of khoans.entries()) {
    const kh = taoKhoan({
      soTien: k.soTien ?? 100_000,
      chieu: k.chieu ?? 'chi',
      ngay: `${th}-${String(k.ngayTrongThang ?? 3).padStart(2, '0')}`,
      ...(k.huId != null ? { huId: k.huId } : {}),
    }, LUC, `k${i}`);
    await kho.ghi('khoan', khoanRaBanGhi(kh));
  }
  return kho;
}

/* ── ĐƯỜNG TỚI các lớp trượt (SPEC mục 4.2): chạm ô ⇒ lớp mở; lá hũ · quyết toán · bảng tạo… đều nằm trong lớp ── */
/** Mặt HŨ đã có số (hết "đang tải"). */
const choHuTai = (): Promise<void> => waitFor(() => {
  expect(screen.getByTestId('hu-chia-tong').textContent, 'hũ vẫn đang tải').not.toBe(CB.dangTai);
});
const oHu = (dau: string): Promise<HTMLElement> => waitFor(() => {
  const e = document.querySelector<HTMLElement>(`[data-o="${dau}"]`);
  expect(e, `ô ${dau}`).not.toBeNull();
  return e!;
});
/** Chạm ô ⇒ lớp trượt mở; trả hàm tìm TRONG lớp. */
const moO = async (dau: string) => {
  await choHuTai();
  fireEvent.click(await oHu(dau));
  return within(await screen.findByRole('dialog'));
};
/** Chạm hũ mini (hoặc ô ★) mang đúng TÊN ⇒ lớp chi tiết hũ ấy (đã bung thẻ — nút đổi trạng thái có sẵn). */
async function moHu(ten: string) {
  await choHuTai();
  const e = await waitFor(() => {
    const t = [...document.querySelectorAll<HTMLElement>('[data-o="hu-con-hu"], [data-o="hu-uu-tien"]')]
      .find((x) => (x.textContent ?? '').includes(ten));
    expect(t, `không thấy hũ "${ten}" trên mặt HŨ`).toBeTruthy();
    return t!;
  });
  fireEvent.click(e);
  return within(await screen.findByRole('dialog'));
}
/** Lá hũ (vị thế) trong lớp đang mở — theo tên đã VIẾT HOA. */
async function timLa(tenHoa: string): Promise<HTMLElement> {
  return waitFor(() => {
    const o = within(screen.getByRole('dialog')).getAllByText(tenHoa).find((e) => e.closest('[data-testid="la-vi-the"]') !== null);
    if (o === undefined) throw new Error(`không thấy lá ${tenHoa}`);
    return o;
  });
}
/** Hũ ĐÃ ĐÓNG (xong/bỏ) không có hũ mini — vào qua lớp DANH MỤC rồi chạm lá để bung. */
async function moHangTrongDanhMuc(tenHoa: string): Promise<void> {
  await moO('hu-danh-muc');
  fireEvent.click((await timLa(tenHoa)).closest('button')!);
}
/** Mở bảng TẠO HŨ (dấu + của nhóm TIẾT KIỆM / CHI) — bước 1/3. */
async function moTaoHu(nhom: 'tk' | 'chi' = 'tk') {
  await choHuTai();
  fireEvent.click(await oHu(nhom === 'tk' ? 'hu-tao-tk' : 'hu-tao-chi'));
  const lop = within(await screen.findByRole('dialog'));
  await lop.findByTestId('tao-buoc');
  return lop;
}
/** TIẾP (nút chính trễ một nhịp phụt hạt) rồi chờ bước sau hiện. */
async function tiep(buocSau: number): Promise<void> {
  fireEvent.click(await oHu('tao-tiep'));
  await screen.findByText(new RegExp(`${CB.huBuoc} ${buocSau} /`));
}
const taoXong = async (): Promise<void> => { fireEvent.click(await oHu('tao-xong')); };

describe('§I — ⭐⭐⭐ Tạo hũ từ MẪU: một chạm', () => {
  it('⭐⭐⭐ chạm một mẫu ⇒ ĐÚNG 1 bản ghi trong ngăn hu, và lối tự tạo hiện cạnh nó', async () => {
    const kho = await khoCo([]);
    ve(kho);
    await moTaoHu();

    // ⭐ luật `mauHopVoiHoSo`: "người gọi PHẢI hiện nút tự tạo cạnh mẫu" — cả hai lối cùng có mặt ở bước 1 (mẫu + nút TIẾP để tự đặt),
    // không phải hai màn con tách rời.
    expect(await oHu('tao-tiep')).toBeInTheDocument();
    const mauBtn = await screen.findByText('Quỹ dự phòng');
    fireEvent.click(mauBtn.closest('button')!);

    await waitFor(async () => expect(await kho.liet<Hu>('hu')).toHaveLength(1));
    const rec = (await kho.liet<Hu>('hu'))[0]!;
    expect(rec.d.tuMauId).toBe('du_phong');
    // Lớp đóng sau khi tạo — CHỜ, không đọc ngay: `useGhiKho` ghi kho rồi còn `await invalidateQueries` mới trả về cho `taoTuMau` đóng
    // lớp ⇒ bản ghi có trong kho TRƯỚC khi lớp đóng (CI 38028851407, 10/10: bảng còn mở).
    await waitFor(() => expect(screen.queryByTestId('tao-buoc')).toBeNull());
  });
});

describe('§II — ⭐⭐ Tạo hũ TỰ ĐẶT: tên là thứ duy nhất bắt buộc', () => {
  it('⭐⭐ thiếu tên ⇒ KHÔNG đi tiếp / không tạo được, ô nhập báo lỗi', async () => {
    const kho = await khoCo([]);
    ve(kho);
    await moTaoHu();
    await tiep(2);
    fireEvent.click(await oHu('tao-tiep'));   // bước 2 mà chưa có tên
    expect(await screen.findByPlaceholderText(CHU_MAN_HU.loiThieuTen)).toBeInTheDocument();
    expect(screen.getByText(new RegExp(`${CB.huBuoc} 2 /`)), 'vẫn ở bước 2').toBeInTheDocument();
    expect(await kho.liet('hu')).toHaveLength(0);
  });

  it('⭐⭐ có tên ⇒ tạo được dù BỎ TRỐNG nhãn + mức — mức ở lại `null` (P3 🔒)', async () => {
    const kho = await khoCo([]);
    ve(kho);
    await moTaoHu();
    await tiep(2);
    fireEvent.change(screen.getByPlaceholderText(CHU_MAN_HU.tenHuGiuCho), {
      target: { value: 'Mua tai nghe' },
    });
    await tiep(3);
    // Bước 3 (lời đoán) chưa đủ mức + hạn ⇒ nói "chưa đủ để đoán", KHÔNG bịa mức; TẠO HŨ vẫn bấm được.
    expect(screen.getByTestId('tao-chua-du')).toBeInTheDocument();
    await taoXong();

    await waitFor(async () => expect(await kho.liet<Hu>('hu')).toHaveLength(1));
    const rec = (await kho.liet<Hu>('hu'))[0]!;
    expect(rec.d.ten).toBe('Mua tai nghe');
    /*
     * ⚠⚠ App KHÔNG TỰ ĐIỀN MỨC — demo (`chotTaoHu`) có `muc||5000000`, một chỗ bịa số
     * cho hũ vừa tạo nếu user bỏ trống. Ràng buộc #2 của việc này cấm thẳng điều đó: bốn
     * nút 1/3/5/12 tr là phím tắt, không phải gợi ý. Bỏ trống thì `muc` phải Ở LẠI `null`.
     */
    expect(rec.d.muc).toBeNull();
    /*
     * ⚠⚠ VÀ NHÃN CŨNG Ở LẠI `null` — ĐÂY LÀ CHỖ ĐẮT NHẤT CỦA CẢ MÀN.
     *
     * Demo tô sẵn ô "KHÁC" (`nhanChon='KHÁC'`), nhưng `hu.ts` §`nhanNguNghia` viết thành
     * luật: *"'Chưa phân loại' và 'phân loại là khác' là hai chuyện khác nhau; gộp chúng
     * làm bẩn đúng cái cohort mà nhãn sinh ra để phục vụ (D62/P7)."* Form này là CỬA DUY
     * NHẤT tạo hũ tự đặt, nên một chữ `'khac'` mặc định ở đây xoá phân biệt ấy cho MỌI hũ
     * của MỌI người bỏ qua bước nhãn — không lỗi, không cảnh báo, và không sửa lại được
     * sau vì dữ liệu đã thu mất luôn chiều "chưa ai hỏi".
     */
    expect(rec.d.loai, 'bỏ qua bước nhãn ⇒ chưa phân loại, không phải "khac"').toBeNull();
  });

  it('⭐⭐ chạm lại ô nhãn ĐANG CHỌN là BỎ CHỌN — "bỏ qua cũng được" phải có lối ra', async () => {
    /*
     * Không có cú bỏ chọn thì câu "(bỏ qua cũng được)" chỉ đúng cho tới cú chạm đầu tiên;
     * sau đó nhãn thành BẮT BUỘC mà không ai nói ra. Người lỡ tay chạm rồi đổi ý chỉ còn
     * cách huỷ cả form.
     */
    const kho = await khoCo([]);
    ve(kho);
    await moTaoHu();
    await tiep(2);
    fireEvent.change(screen.getByPlaceholderText(CHU_MAN_HU.tenHuGiuCho), {
      target: { value: 'Doi y' },
    });
    const oAn = within(screen.getByTestId('tao-muc-tieu')).getByRole('button', { name: O_CHU_LOAI_CHI.an_uong });
    fireEvent.click(oAn);
    expect(oAn).toHaveAttribute('aria-pressed', 'true');
    fireEvent.click(oAn);
    expect(oAn).toHaveAttribute('aria-pressed', 'false');

    await tiep(3);
    await taoXong();
    await waitFor(async () => expect(await kho.liet<Hu>('hu')).toHaveLength(1));
    expect((await kho.liet<Hu>('hu'))[0]!.d.loai).toBeNull();
  });

  it('⭐⭐ SAO chỉ đeo cho ưu tiên CAO, và mẫu thì KHÔNG BAO GIỜ đeo', async () => {
    /*
     * ⚠ Sao là DẤU CỦA NGƯỜI DÙNG (D237 §4-ter — founder bác bản v11 vì app tự rải sao:
     * *"một cái dấu vẫn là lời khuyên dù nó không có chữ"*). Hai vế phải cùng đúng:
     *   · hũ user tự đánh dấu ưu tiên CAO  ⇒ có sao
     *   · hũ sinh từ MẪU, dù mẫu preset `uuTien:'cao'` ⇒ KHÔNG sao (app không rải)
     *   · ưu tiên THẤP cũng là "đã đặt ưu tiên" ⇒ vẫn KHÔNG sao
     */
    /* ⚠ Ghi thẳng vào kho, KHÔNG qua `khoCo`: helper ấy chỉ nhận `{id, ten, muc, trangThai}`
       rồi dựng lại bằng `tuTao`, nên nó NUỐT MẤT `uuTien`/`tuMauId` — đúng hai trường bài
       này canh. (Bản đầu của tôi đi qua helper và ra 0 sao, tưởng code sai.) */
    const kho = new KhoTrongBoNho();
    const th = thangNay();
    const dat = async (d: Hu) => kho.ghi('hu', { id: d.id, thang: th, suaLuc: LUC, d });
    await dat(tuTao({ ten: 'Tu dat', uuTien: 'cao' }, LUC, 'h-tay'));
    await dat(tuTao({ ten: 'Uu tien thap', uuTien: 'thap' }, LUC, 'h-thap'));
    await dat({ ...tuTao({ ten: 'Tu mau', uuTien: 'cao' }, LUC, 'h-mau'), tuMauId: 'du_phong' });
    ve(kho);
    await choHuTai();
    // Sao nay hiện ở dòng hũ trong lớp NHÓM TIẾT KIỆM ("★ tên") và ở ô ★ trên mặt — đếm ở lớp nhóm, nơi MỌI hũ cùng nằm một danh sách.
    fireEvent.click(document.querySelector<HTMLElement>('[data-o="hu-nhom-tk"] button')!);
    const lop = within(await screen.findByRole('dialog'));
    const hang = await waitFor(() => {
      const h = lop.getAllByTestId('nhom-hang-hu');
      expect(h).toHaveLength(3);
      return h;
    });
    const coSao = hang.filter((h) => (h.textContent ?? '').startsWith('★'));
    expect(coSao, 'đúng MỘT ngôi sao, của hũ user tự đánh dấu cao').toHaveLength(1);
    expect(coSao[0]!.textContent).toContain('Tu dat');
  });

  it('⭐ chọn mức nhanh (1/3/5/12 tr) ⇒ đúng con số đã bấm, không phải mặc định', async () => {
    const kho = await khoCo([]);
    ve(kho);
    await moTaoHu();
    await tiep(2);
    fireEvent.change(screen.getByPlaceholderText(CHU_MAN_HU.tenHuGiuCho), {
      target: { value: 'Chuyen di' },
    });
    fireEvent.click(screen.getByRole('button', { name: '3 tr' }));
    await tiep(3);
    await taoXong();
    await waitFor(async () => expect(await kho.liet<Hu>('hu')).toHaveLength(1));
    expect((await kho.liet<Hu>('hu'))[0]!.d.muc).toBe(3_000_000);
  });
});

describe('§III — ⭐⭐ Chưa đặt mức: hiện "—", KHÔNG BAO GIỜ hiện "0%"', () => {
  it('⭐⭐ hũ chưa đặt mức', async () => {
    const kho = await khoCo([{ id: 'h1', ten: 'Chua dat' }]);
    ve(kho);
    // Mặt HŨ: ô ★ nói "chưa đặt mức" và bình hiện "—" (không "0%").
    await choHuTai();
    const sao = await oHu('hu-uu-tien');
    expect(sao).toHaveTextContent(CB.huChuaMuc);
    expect(within(sao).getByText('—')).toBeInTheDocument();
    expect(screen.queryByText('0%')).not.toBeInTheDocument();
    // Lớp chi tiết (lá): cũng "—" và "/ chưa đặt mức", không 0%.
    const lop = await moHu('Chua dat');
    await timLa('CHUA DAT');
    expect(lop.getAllByText('—').length).toBeGreaterThan(0);
    expect(document.body.textContent ?? '').not.toContain('0%');
    // ⚠ "/ chưa đặt mức" là MỘT text node ("/" + chuỗi) — khớp theo chuỗi con, không exact.
    expect(lop.getByText((c) => c.includes(CHU_MAN_HU.chuaDatMuc))).toBeInTheDocument();
  });
});

describe('§ 13/09 — ⭐ chữ giải thích của màn nằm sau nút (?), không nằm sẵn', () => {
  it('⭐ "Đang gom" mang SỐ ở ngoài; hai câu giải thích chỉ hiện khi chạm (?) cạnh số', async () => {
    /* Founder 13/09: *"chữ thì chỉ dành cho bách khoa toàn thư"*. Tiêm lỗi: bỏ `moGiai &&` ⇒ đỏ. */
    const kho = await khoCo([{ id: 'h1', ten: 'Quy', muc: 1_000_000 }]);
    ve(kho);
    const lop = await moO('hu-danh-muc');
    await timLa('QUY');
    expect(lop.queryByText((c) => c.includes(CHU_MAN_HU.chuThichDangGom))).toBeNull();
    expect(lop.queryByText((c) => c.includes(CHU_MAN_HU.chuThichManHu))).toBeNull();
    fireEvent.click(lop.getByRole('button', { name: CHU_MAN_HU.dangGom }));
    expect(lop.getByText((c) => c.includes(CHU_MAN_HU.chuThichDangGom))).toBeInTheDocument();
    expect(lop.getByText((c) => c.includes(CHU_MAN_HU.chuThichManHu))).toBeInTheDocument();
  });
});

describe('§ D421 — ⭐⭐ hai loại hũ trên màn HŨ', () => {
  it('⭐⭐ "ĐANG GOM x / y" chỉ cộng hũ TÍCH LŨY — mức tháng của hũ tiêu dùng không thành "mức muốn gom"', async () => {
    const kho = await khoCo(
      [{ id: 'h1', ten: 'Quy', muc: 1_000_000 }, { id: 'h-an', ten: 'An uong', muc: 3_000_000, nhom: 'tieu_dung' }],
      [{ soTien: 200_000, huId: 'h1' }, { soTien: 45_000 }],
    );
    await kho.ghi('khoan', khoanRaBanGhi(taoKhoanPhanBo(
      { ngay: `${thangNay()}-03`, soTien: 45_000, huId: 'h-an', phanBo: 'gan' }, LUC, 'gan-an',
    )));
    ve(kho);
    const lop = await moO('hu-danh-muc');
    await timLa('QUY');
    const gom = lop.getByRole('button', { name: CHU_MAN_HU.dangGom }).parentElement!;
    expect(gom).toHaveTextContent('200.000');
    expect(gom).toHaveTextContent('/ 1.000.000 đ');
    expect(gom.textContent).not.toContain('4.000.000');
    expect(gom.textContent).not.toContain('245.000');
  });

  it('⭐⭐⭐ bảng tạo: chạm CHI ⇒ phần vị thế (kỳ hạn · tự chia · lời đoán) và mẫu gom biến khỏi bảng; tạo ⇒ hũ `tieu_dung` (hai bước)', async () => {
    const kho = await khoCo([]);
    ve(kho);
    const lop = await moTaoHu('tk');
    expect(await lop.findByText('Quỹ dự phòng'), 'chưa chọn loại CHI ⇒ mẫu gom còn đó').toBeInTheDocument();
    fireEvent.click(lop.getByRole('button', { name: new RegExp(`^${CB.huNhomChi}`) }));
    expect(lop.queryByText('Quỹ dự phòng'), 'mẫu là mục tiêu GOM').toBeNull();
    // Hũ CHI: đúng HAI bước (không bước lời đoán).
    expect(lop.getByText(new RegExp(`${CB.huBuoc} 1 / 2`))).toBeInTheDocument();
    await tiep(2);
    expect(screen.queryByText(CHU_VI_THE.kyHanHoi), 'hũ tiêu dùng không kỳ hạn').toBeNull();
    expect(screen.queryByText(CP.tuDongHoi), 'hũ tiêu dùng không nhận tiền ⇒ không tự chia').toBeNull();
    fireEvent.change(screen.getByPlaceholderText(CP.tenHuTieuGiuCho), { target: { value: 'An uong' } });
    await taoXong();
    await waitFor(async () => expect(await kho.liet<Hu>('hu')).toHaveLength(1));
    const h = (await kho.liet<Hu>('hu'))[0]!.d;
    expect(h.nhom).toBe('tieu_dung');
    expect(h.lenh).toBeUndefined();
    expect(h.tuDong).toBeUndefined();
  });

  it('⭐⭐ hũ tiêu dùng có LÁ riêng (đã tiêu tháng này / mức tháng — tổng khoản GÁN), không vào danh mục vị thế', async () => {
    const kho = await khoCo([{ id: 'h-an', ten: 'An uong', muc: 3_000_000, nhom: 'tieu_dung' }], [{ soTien: 90_000 }]);
    const ngay = `${thangNay()}-03`;
    for (const [id, soTien] of [['g1', 45_000], ['g2', 30_000]] as const) {
      await kho.ghi('khoan', khoanRaBanGhi(taoKhoanPhanBo({ ngay, soTien, huId: 'h-an', phanBo: 'gan' }, LUC, id)));
    }
    ve(kho);
    const lop = await moHu('An uong');
    const la = await lop.findByTestId('la-tieu-dung');
    expect(within(la).getByTestId('da-tieu')).toHaveTextContent('75.000');
    expect(la).toHaveTextContent('3.000.000');
    expect(screen.queryAllByTestId('la-vi-the'), 'không phải lá vị thế').toHaveLength(0);
  });
});

describe('§IV — ⭐⭐ Góp tiền cộng đúng — `daGop` luôn TÍNH từ sổ, không cất trên hũ', () => {
  it('⭐⭐ vài khoản nối `huId` ⇒ phần trăm đúng, khoản của hũ khác không tính vào', async () => {
    const kho = await khoCo(
      [{ id: 'h1', ten: 'Quy', muc: 1_000_000 }],
      [
        { soTien: 300_000, huId: 'h1', ngayTrongThang: 2 },
        { soTien: 200_000, huId: 'h1', ngayTrongThang: 20 },
        { soTien: 900_000, huId: 'khac-hu' },
      ],
    );
    ve(kho);
    // Mặt HŨ: bình ★ đọc 50% (300k + 200k trên 1tr); 900k của hũ khác KHÔNG tính vào. Số đầy đủ ở lớp chi tiết.
    await waitFor(() => expect(screen.getByText('50%')).toBeInTheDocument());
    expect((await oHu('hu-uu-tien')).textContent, 'ô ★ chỉ đếm khoản nối hũ này: 500k / 1tr').toContain('500k / 1tr');
    const lop = await moHu('Quy');
    await timLa('QUY');
    expect(lop.getAllByText('500.000').length).toBeGreaterThanOrEqual(1);
  });

  it('⭐ HŨ ĐẦY (100%, còn đang chạy): quầng + nhãn "HŨ ĐÃ ĐẦY" hiện ra', async () => {
    const kho = await khoCo(
      [{ id: 'h1', ten: 'Full', muc: 100_000 }],
      [{ soTien: 100_000, huId: 'h1' }],
    );
    ve(kho);
    const lop = await moHu('Full');
    await waitFor(() => expect(lop.getByText(`✓ ${CHU_MAN_HU.huDaDay}`)).toBeInTheDocument());
  });

  it('⭐⭐ hũ có MỐC RESET (`mocGop`) ⇒ thẻ · % · "Đang gom" đều chỉ đếm khoản ghi SAU mốc', async () => {
    /*
     * Màn HŨ đọc cùng `tongGopVaoHu` với màn SỔ nhưng gọi ở BA chỗ (số của thẻ · phần trăm
     * · tổng "Đang gom"). Quên đưa mốc ở MỘT chỗ là hai con số trên cùng một màn cãi nhau
     * — bài này ép cả ba nói cùng một số. Ghi thẳng vào kho (helper `khoCo` dựng lại bằng
     * `tuTao` nên nuốt mất `mocGop`, và ép mọi khoản chung một `taoLuc`).
     */
    const kho = new KhoTrongBoNho();
    const th = thangNay();
    const moc = '2026-09-06T12:00:00.000Z';
    await kho.ghi('hu', {
      id: 'h1', thang: th, suaLuc: LUC,
      d: resetGop(tuTao({ ten: 'Quy', muc: 1_000_000 }, LUC, 'h1'), moc),
    });
    const ghi = (id: string, soTien: number, taoLuc: string) => kho.ghi('khoan',
      khoanRaBanGhi(taoKhoan({ soTien, ngay: `${th}-03`, huId: 'h1' }, taoLuc, id)));
    await ghi('truoc', 300_000, '2026-09-06T10:00:00.000Z');
    await ghi('sau', 200_000, '2026-09-06T14:00:00.000Z');
    ve(kho);
    await waitFor(() => expect(screen.getByText('20%')).toBeInTheDocument());
    // "Đang gom" (lớp DANH MỤC, tổng mọi hũ) và số của lá đều là 200.000; không đâu còn 500.000 hay 50%.
    const lop = await moO('hu-danh-muc');
    await timLa('QUY');
    expect(lop.getAllByText('200.000').length).toBeGreaterThanOrEqual(2);
    expect(lop.queryByText('500.000')).not.toBeInTheDocument();
    expect(screen.queryByText('50%')).not.toBeInTheDocument();
  });
});

describe('§V — ⭐⭐⭐ Quyết toán (C7): MỘT câu, bốn nấc', () => {
  it('⭐⭐⭐ ĐÁNH DẤU XONG → chọn nấc ⇒ hũ có trangThai xong + ketQua đúng mã KET_QUA_HU', async () => {
    const kho = await khoCo([{ id: 'h1', ten: 'Laptop', muc: 1_000_000 }]);
    ve(kho);
    await moHu('Laptop');
    await timLa('LAPTOP');
    fireEvent.click(screen.getByRole('button', { name: CHU_NUT_HU.danhDauXong }));

    await screen.findByText(new RegExp(`${CHU_MAN_HU.hoiXongPre}LAPTOP`));
    fireEvent.click(screen.getByRole('button', { name: CHU_KET_QUA_HU.gan_du }));

    await waitFor(async () => {
      const rec = (await kho.liet<Hu>('hu'))[0]!;
      expect(rec.d.trangThai).toBe('xong');
      expect(rec.d.ketQua).toBe('gan_du');
      expect(KET_QUA_HU).toContain(rec.d.ketQua);
    });
  });

  it('⭐⭐ TẠM DỪNG → BỎ HŨ NÀY → chọn nấc ⇒ trangThai bo_do + ketQua đúng mã', async () => {
    const kho = await khoCo([{ id: 'h1', ten: 'Xe dap' }]);
    ve(kho);
    await moHu('Xe dap');
    await timLa('XE DAP');
    fireEvent.click(screen.getByRole('button', { name: CHU_NUT_HU.tamDung }));
    await waitFor(async () => expect((await kho.liet<Hu>('hu'))[0]!.d.trangThai).toBe('tam_dung'));

    // ⚠ Thẻ VẪN ĐANG MỞ (đổi trạng thái không tự đóng thẻ) — nút BỎ HŨ NÀY đã đổi vai
    // ngay tại chỗ, không cần chạm lại dòng tên (chạm lại sẽ ĐÓNG thẻ vì đang mở).
    await screen.findByRole('button', { name: CHU_NUT_HU.boHuNay });
    fireEvent.click(screen.getByRole('button', { name: CHU_NUT_HU.boHuNay }));
    await screen.findByText(new RegExp(`${CHU_MAN_HU.hoiBoDoPre}XE DAP`));
    fireEvent.click(screen.getByRole('button', { name: CHU_KET_QUA_HU.xa }));

    await waitFor(async () => {
      const rec = (await kho.liet<Hu>('hu'))[0]!;
      expect(rec.d.trangThai).toBe('bo_do');
      expect(rec.d.ketQua).toBe('xa');
    });
  });

  it('TIẾP TỤC / MỞ LẠI KHÔNG hỏi quyết toán — chuyển thẳng, không có `ketQua`', async () => {
    const kho = await khoCo([{ id: 'h1', ten: 'Dung tam', trangThai: 'tam_dung' }]);
    ve(kho);
    await moHu('Dung tam');
    await timLa('DUNG TAM');
    fireEvent.click(screen.getByRole('button', { name: CHU_NUT_HU.tiepTuc }));
    await waitFor(async () => {
      const rec = (await kho.liet<Hu>('hu'))[0]!;
      expect(rec.d.trangThai).toBe('dang_chay');
      expect(rec.d.ketQua).toBeNull();
    });
  });
});

describe('§VI — ⭐⭐ Nút hiện ra khớp `chuyenDuoc()` của hu.ts', () => {
  it('⭐⭐ mỗi nút UI ứng với một cú chuyển được máy trạng thái CHO PHÉP', () => {
    // Bảng nút cố định theo demo (đúng thứ tự đọc ở NỘI DUNG MÀN §5) — mỗi đích ở đây
    // phải là một chuyển tiếp HỢP LỆ theo chính `hu.ts`, không phải một bảng chép tay
    // thứ hai đứng cạnh nó.
    const banNut: Partial<Record<TrangThaiHu, TrangThaiHu[]>> = {
      dang_chay: ['tam_dung', 'xong'],
      tam_dung: ['dang_chay', 'bo_do'],
      bo_do: ['dang_chay'],
      xong: [],
    };
    for (const [tu, dich] of Object.entries(banNut) as [TrangThaiHu, TrangThaiHu[]][]) {
      for (const d of dich) {
        expect(chuyenDuoc(tu, d), `${tu} → ${d} phải hợp lệ theo chuyenDuoc()`).toBe(true);
      }
    }
  });

  it('⭐ hũ XONG mở ra: KHÔNG có nút đổi trạng thái nào, chỉ một câu giải thích', async () => {
    const kho = await khoCo([{ id: 'h1', ten: 'Da xong', trangThai: 'xong' }]);
    ve(kho);
    await moHangTrongDanhMuc('DA XONG');
    expect(await screen.findByText(CHU_MAN_HU.giaiHuXong)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: CHU_NUT_HU.tamDung })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: CHU_NUT_HU.danhDauXong })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: CHU_NUT_HU.moLai })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: CHU_NUT_HU.tiepTuc })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: CHU_NUT_HU.boHuNay })).not.toBeInTheDocument();
  });
});

describe('§VII — ⭐ Xếp thứ tự: HŨ ĐÃ HOÀN THÀNH đứng SAU, dưới đầu mục riêng', () => {
  it('⭐ hũ xong/bỏ đứng sau hũ đang chạy, ngăn bằng dòng "HŨ ĐÃ HOÀN THÀNH · N"', async () => {
    const kho = await khoCo([
      { id: 'a', ten: 'Xe may', trangThai: 'dang_chay' },
      { id: 'b', ten: 'Vali', trangThai: 'xong' },
    ]);
    ve(kho);
    const lop = await moO('hu-danh-muc');
    await timLa('XE MAY');
    expect(lop.getByText(`${CHU_MAN_HU.daHoanThanh} · 1`)).toBeInTheDocument();

    const chu = screen.getByRole('dialog').textContent ?? '';
    const iChay = chu.indexOf('XE MAY');
    const iDauMuc = chu.indexOf(CHU_MAN_HU.daHoanThanh);
    const iXong = chu.indexOf('VALI');
    expect(iChay).toBeGreaterThanOrEqual(0);
    expect(iChay).toBeLessThan(iDauMuc);
    expect(iDauMuc).toBeLessThan(iXong);
  });

  it('không hũ nào roi ⇒ KHÔNG có đầu mục "HŨ ĐÃ HOÀN THÀNH"', async () => {
    const kho = await khoCo([{ id: 'a', ten: 'Dang song' }]);
    ve(kho);
    const lop = await moO('hu-danh-muc');
    await timLa('DANG SONG');
    expect(lop.queryByText(/HŨ ĐÃ HOÀN THÀNH/)).not.toBeInTheDocument();
  });
});

describe('§VII-bis — ⭐⭐ thanh tiến độ: MỘT component, hai cỡ', () => {
  it('⭐⭐ màn HŨ đặt `--tt-cao`, và `ThanhTienDo` thật sự ĐỌC biến ấy', () => {
    /*
     * ⚠⚠ HAI ĐẦU DÂY, và không có gì trong TypeScript nối chúng. Demo dùng cùng thanh ở
     * hai cỡ (8px ở thẻ mini màn SỔ, 13px ở thẻ đầy đủ màn HŨ) — cách giữ MỘT component
     * là một biến CSS kế thừa xuống. Đổi tên biến ở một bên thì bên kia rơi về giá trị
     * dự phòng: thanh mảnh đi 5px, **không lỗi, không cảnh báo**, và ảnh chụp cũng khó
     * nói ra. Bài này là sợi dây.
     * ⚠ Fork một `ThanhTienDoLon` thì hết cần bài này — và cũng hết một nguồn (D61):
     *   bảng mốc + bảng màu sẽ có hai bản, và bản ít dùng hơn sẽ trôi.
     */
    const doc = (p: string) => readFileSync(resolve(__dirname, p), 'utf8');
    const cssHu = doc('../src/screens/tai-chinh/Hu.module.css');
    const cssThanh = doc('../src/components/pfm/ThanhTienDo.module.css');
    expect(cssHu, 'màn HŨ phải đặt --tt-cao').toMatch(/--tt-cao:\s*13px/);
    expect(cssThanh, 'thanh phải ĐỌC --tt-cao').toMatch(/height:\s*var\(--tt-cao/);
  });
});

describe('§VIII — ⭐⭐⭐ A10 🔒 bốn bảng mới phải NẰM TRONG tầm quét', () => {
  /*
   * ⚠⚠ KHÔNG chép lại phép quét `TU_KE_DON` ở đây — `pfm_chu.test.ts` §I đã quét
   * `moiChuoiPfm()` rồi, và bản sao thứ hai của cùng một phép kiểm sẽ trôi (D61).
   *
   * ⚠⚠ CHỖ HỞ THẬT nằm ở chỗ khác, và bài này canh đúng chỗ ấy: `moiChuoiPfm()` gom
   * bảng bằng cách LIỆT KÊ TAY. Thêm một bảng chữ mới mà quên nối vào hàm ấy thì §I
   * vẫn **xanh** — nó quét đủ mọi thứ nó biết, chỉ là nó không biết bảng mới. Bốn bảng
   * của màn HŨ chở đúng loại câu dễ trượt A10 nhất (giải thích, hỏi han), nên chúng
   * phải chứng minh được là đang bị soi.
   */
  it('⭐⭐⭐ mọi chuỗi của bốn bảng màn HŨ đều có mặt trong `moiChuoiPfm()`', () => {
    const quet = new Set(moiChuoiPfm());
    const bang = { CHU_PILL_HU, CHU_NUT_HU, CHU_KET_QUA_HU, CHU_MAN_HU };
    for (const [ten, b] of Object.entries(bang)) {
      for (const v of Object.values(b)) {
        expect(quet.has(v), `${ten}: "${v}" chưa nằm trong tầm quét A10`).toBe(true);
      }
    }
  });

  it('⭐ và chúng không rỗng — một bảng rỗng làm bài trên xanh mà chẳng chứng minh gì', () => {
    expect(Object.keys(CHU_MAN_HU).length).toBeGreaterThan(20);
  });
});

describe('⭐⭐ MỨC HŨ PHẢI GÕ ĐƯỢC SỐ CỦA MÌNH', () => {
  /*
   * Founder 21/09: *"Mức hũ muốn gom sao lại ko cho t tự nhập tiền à? nhỡ ko có lựa chọn phù
   * hợp thì sao?"* — bản cũ chỉ có mấy nút tròn (1tr/3tr/5tr/12tr) và con số nằm trong một
   * `<span>` CHỈ ĐỂ ĐỌC. Ngoài chỗ bí cho người dùng, nó còn ngược tinh thần P3: app
   * không được quyết số tiền hộ, mà chỉ đưa vài mức của mình rồi bắt chọn một thì cũng là quyết hộ.
   */
  it('⭐⭐ gõ được một số KHÔNG có trong mấy nút chọn nhanh, và xóa trắng thì về "chưa đặt"', async () => {
    const kho = await khoCo([]);
    ve(kho);
    await moTaoHu();
    await tiep(2);

    const o = await screen.findByLabelText(CHU_MAN_HU.mucOTen) as HTMLInputElement;
    expect(o.value, 'ô phải MỞ ĐẦU TRỐNG — app không điền số hộ (P3)').toBe('');

    /* 3.450.000 cố ý KHÔNG nằm trong `MUC_NHANH` — đúng ca "không có lựa chọn phù hợp". */
    fireEvent.change(o, { target: { value: '3450000' } });
    expect(o.value).toBe('3450000');
    expect(document.body.textContent, 'đọc lại phải có dấu phân nhóm').toContain('3.450.000');

    /* Chữ và ký tự lạ bị lọc, không làm hỏng số. */
    fireEvent.change(o, { target: { value: '12a3b' } });
    expect(o.value).toBe('123');

    /* Xóa trắng = "chưa đặt mức", không kẹt ở số cũ. */
    fireEvent.change(o, { target: { value: '' } });
    expect(o.value).toBe('');
  });
});
