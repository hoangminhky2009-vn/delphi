/**
 * PFM — KHỐI CÀI ĐẶT (`components/pfm/CaiDatPfm.tsx`), theo DEMO ĐÃ CHỐT (A11.25, D295).
 *
 * ⚠ Nhại `pfm_man_hu.test.tsx`: `KhoTrongBoNho` + `QueryClientProvider` + `KhoProvider`, đọc
 * KHO làm nguồn sự thật. `/me` và `/pfm/*` đi qua `stubFetch` (contract thật của server).
 * ⚠ Hai driver két/lô stub ở tầng MODULE (chúng có máy chủ giả riêng, 35+ bài); ở đây đo
 *   *"màn gọi driver với gì, và nói ra cái gì"*. Chìa thì RÈN THẬT (PBKDF2 600k vòng, ~1 s
 *   mỗi lượt — chậm là chậm thật): `CryptoKey` không stub được bằng một object.
 * ⚠ D294: dấu hiệu đo phải là thứ CHỈ hành vi cần đo mới tạo ra — đọc kho, đếm request,
 *   đọc `body.dataset`, không dò chuỗi trong `textContent` của cả màn.
 */
import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor, fireEvent, within } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { StrictMode } from 'react';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { CaiDatPfm } from '../src/components/pfm/CaiDatPfm';
import { ID_CAI_DAT_MAY, type CaiDatMay } from '../src/pfm/cai_dat_may.js';
import { KhoProvider } from '../src/pfm/dung_kho';
import { KhoTrongBoNho, type KhoPfm } from '../src/pfm/kho.js';
import { ID_KHOA_KET, catChia, docChia } from '../src/pfm/ket_may.js';
import { latDeKhoiPhuc } from '../src/pfm/ket_chay.js';
import { DAI_MA, taoMaKhoiPhuc, mocMa } from '../src/pfm/ket.js';
import { quenKichChoTest } from '../src/pfm/dong_bo_kich';
import { quenThaoTac } from '../src/lib/thao_tac';
import { homNay, thangNay } from '../src/pfm/thoi_gian.js';
import { CHU_CAI_DAT, CHU_CONSENT_KHOI, CHU_VUONG, VAN_BAN_CONSENT } from '../src/lib/pfm_chu';
import { CONSENT_PHIEN_BAN, CUA_PFM, vanBanCua, type CuaPfm } from '@config/pfm_consent';
import { ME_ONBOARDED, stubFetch, type RecordedCall } from './helpers';
import type { MeResponse } from '../src/api/types';

vi.mock('../src/pfm/dong_bo_chay.js', () => ({ dongBoMotLuot: vi.fn() }));
vi.mock('../src/pfm/ket_chay.js', async (goc) => ({
  ...(await goc<typeof import('../src/pfm/ket_chay.js')>()),
  saoLuuMotLuot: vi.fn(),
  khoiPhucTuKet: vi.fn(),
}));
const { dongBoMotLuot } = await import('../src/pfm/dong_bo_chay.js');
const { saoLuuMotLuot, khoiPhucTuKet } = await import('../src/pfm/ket_chay.js');

const LUC = '2026-09-06T10:00:00.000Z';
const BON_TAT: Record<CuaPfm, boolean> = { ket: false, dac_trung: false, thuong: false, noi_game: false };
/** Nhịp rút ngắn CHỈ cho test — không đổi pixel nào (LED/giữ là hằng của demo). */
const NHIP = { ledMs: 40, giuMs: 120 };

function meVoi(cua: Partial<Record<CuaPfm, boolean>> | null): MeResponse {
  return cua === null
    ? { ...ME_ONBOARDED, pfm: null }
    : { ...ME_ONBOARDED, pfm: { consent: true, bat_dau: LUC, cua: { ...BON_TAT, ...cua } } };
}

const okConsent = (cua: CuaPfm, bat: boolean) =>
  ({ status: 200, body: { ok: true, doi: true, cua: { ...BON_TAT, [cua]: bat }, pfm_consent: bat, pfm_bat_dau: LUC } });

/*
 * ⚠⚠ BỌC `<StrictMode>` NHƯ `main.tsx`. Bản đầu không bọc, và một cờ `useRef(true)` bị
 * cleanup của StrictMode đặt `false` vĩnh viễn (mount → cleanup → mount, ref không khởi tạo
 * lại) đã lọt qua 22 bài xanh — LED không hiện, con dấu xoá không hiện, chỉ lộ khi soi
 * trình duyệt thật. Test không chạy cùng chế độ với app là test một app khác.
 */
function ve(kho: KhoPfm) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <StrictMode>
      <QueryClientProvider client={qc}>
        <KhoProvider kho={kho}><CaiDatPfm nhip={NHIP} /></KhoProvider>
      </QueryClientProvider>
    </StrictMode>,
  );
}

async function chiaGia(): Promise<CryptoKey> {
  return crypto.subtle.generateKey({ name: 'AES-GCM', length: 256 }, false, ['encrypt', 'decrypt']);
}

const goiConsent = (calls: RecordedCall[]) =>
  calls.filter((c) => c.url.includes('/pfm/consent') && c.method === 'POST');
const goiMe = (calls: RecordedCall[]) => calls.filter((c) => c.url.includes('/auth/me'));

beforeEach(() => {
  quenKichChoTest();
  quenThaoTac();
  vi.mocked(dongBoMotLuot).mockReset().mockResolvedValue({ daGui: false, ghi: 0, trung: 0, bo: 0, conLai: 0 });
  vi.mocked(saoLuuMotLuot).mockReset().mockResolvedValue({ daLuu: ['2026-09', 'song'], thangDong: 0, quaLon: 0, conBan: 0 });
  vi.mocked(khoiPhucTuKet).mockReset();
});
afterEach(() => { vi.unstubAllGlobals(); });

/* ═══ §I — ① BỐN CỬA + CÔNG TẮC CHUNG ═══════════════════════════════════════ */

describe('§I — ⭐⭐⭐ bốn cửa', () => {
  it('⭐⭐ dòng RỜI MÁY của CẢ BỐN cửa có mặt ngay khi chưa bấm `?`; hai dòng còn lại thì chưa', async () => {
    stubFetch([['/auth/me', { status: 200, body: meVoi(null) }]]);
    ve(new KhoTrongBoNho());
    for (const c of CUA_PFM) {
      const vb = VAN_BAN_CONSENT[vanBanCua(c)];
      const dong = screen.getByTestId(`roimay-${c}`);
      expect(dong.textContent).toContain(vb.roiMay);
      expect(dong.textContent).toContain(CHU_CONSENT_KHOI.nhanRoiMay);
      expect(screen.queryByText(vb.mayChuKhongDoc)).toBeNull();
      expect(screen.queryByText(vb.chot)).toBeNull();
    }
    // Vắng `pfm` ⇒ bốn tắt, không cửa nào "bật" bừa.
    for (const c of CUA_PFM) expect(screen.getByTestId(`ct-${c}`)).toHaveAttribute('aria-checked', 'false');
  });

  it('⭐ `?` mở hai dòng còn lại; mở hàng này tự đóng hàng kia; nhãn vế hai KHÔNG chứa "ở lại"', () => {
    stubFetch([['/auth/me', { status: 200, body: meVoi(null) }]]);
    ve(new KhoTrongBoNho());
    expect(CHU_CONSENT_KHOI.nhanKhongDoc.toLowerCase()).not.toContain('ở lại');

    fireEvent.click(screen.getByTestId('chitiet-ket'));
    const ket = VAN_BAN_CONSENT.pfm_ket;
    expect(screen.getByText(ket.chot)).toBeInTheDocument();
    const veHai = screen.getByText(ket.mayChuKhongDoc).closest('p')!;
    expect(veHai.textContent).toContain(CHU_CONSENT_KHOI.nhanKhongDoc);
    expect(veHai.textContent!.toLowerCase()).not.toContain('ở lại');

    fireEvent.click(screen.getByTestId('chitiet-thuong'));
    expect(screen.queryByText(ket.chot), 'mở hàng này phải đóng hàng kia').toBeNull();
    expect(screen.getByText(VAN_BAN_CONSENT.pfm_thuong.chot)).toBeInTheDocument();
    expect(screen.getByTestId('chitiet-ket')).toHaveAttribute('aria-expanded', 'false');
    expect(screen.getByTestId('chitiet-thuong')).toHaveAttribute('aria-expanded', 'true');
  });

  it('⭐⭐⭐ bật MỘT cửa ⇒ đúng MỘT POST với văn bản CỦA CỬA ẤY + phiên bản từ config; rồi làm tươi /me', async () => {
    const calls = stubFetch([
      ['/pfm/consent', okConsent('thuong', true)],
      ['/auth/me', { status: 200, body: meVoi(null) }],
    ]);
    ve(new KhoTrongBoNho());
    await waitFor(() => expect(screen.getByTestId('ct-thuong')).not.toBeDisabled());
    const meTruoc = goiMe(calls).length;

    fireEvent.click(screen.getByTestId('ct-thuong'));
    await waitFor(() => expect(goiConsent(calls)).toHaveLength(1));
    expect(goiConsent(calls)[0]!.body).toEqual({
      cua: 'thuong', bat: true, van_ban_id: vanBanCua('thuong'),
      phien_ban: CONSENT_PHIEN_BAN[vanBanCua('thuong')],
    });
    await waitFor(() => expect(goiMe(calls).length, 'phải hỏi lại /me sau cú đổi').toBeGreaterThan(meTruoc));
  });

  it('⭐⭐ tắt một cửa đang bật ⇒ POST {cua, bat:false} — KHÔNG kèm văn bản', async () => {
    const calls = stubFetch([
      ['/pfm/consent', okConsent('ket', false)],
      ['/auth/me', { status: 200, body: meVoi({ ket: true }) }],
    ]);
    ve(new KhoTrongBoNho());
    await waitFor(() => expect(screen.getByTestId('ct-ket')).toHaveAttribute('aria-checked', 'true'));
    // Vết của cửa đang bật mang phiên bản văn bản; cửa tắt thì "đang tắt".
    expect(screen.getByTestId('vet-ket').textContent).toContain(CONSENT_PHIEN_BAN.pfm_ket);
    expect(screen.getByTestId('vet-thuong').textContent).toBe(CHU_CONSENT_KHOI.daTat);

    fireEvent.click(screen.getByTestId('ct-ket'));
    await waitFor(() => expect(goiConsent(calls)).toHaveLength(1));
    expect(goiConsent(calls)[0]!.body).toEqual({ cua: 'ket', bat: false });
  });

  it('⭐⭐⭐ công tắc chung ⇒ BỐN POST, đúng thứ tự `CUA_PFM`, mỗi cái mang văn bản của mình', async () => {
    const calls = stubFetch([
      ['/pfm/consent', { status: 200, body: { ok: true, doi: true, cua: BON_TAT, pfm_consent: true, pfm_bat_dau: LUC } }],
      ['/auth/me', { status: 200, body: meVoi(null) }],
    ]);
    ve(new KhoTrongBoNho());
    await waitFor(() => expect(screen.getByTestId('ct-chung')).not.toBeDisabled());
    expect(screen.getByText(CHU_CONSENT_KHOI.congTacChung)).toBeInTheDocument();

    fireEvent.click(screen.getByTestId('ct-chung'));
    await waitFor(() => expect(goiConsent(calls)).toHaveLength(4));
    expect(goiConsent(calls).map((c) => (c.body as { cua: string }).cua)).toEqual([...CUA_PFM]);
    for (const c of goiConsent(calls)) {
      const b = c.body as { cua: CuaPfm; bat: boolean; van_ban_id: string; phien_ban: string };
      expect(b.bat).toBe(true);
      expect(b.van_ban_id).toBe(vanBanCua(b.cua));
      expect(b.phien_ban).toBe(CONSENT_PHIEN_BAN[vanBanCua(b.cua)]);
    }
  });

  it('⭐⭐ công tắc chung khi MỘT cửa đã bật ⇒ chỉ BA POST — cửa đã đúng trạng thái thì không gọi', async () => {
    /*
     * Server trả `doi:false` cho một cú thừa, nhưng đó vẫn là một request trong ngân sách
     * 1M/tháng, và là một cú bấm mà màn tự bịa ra thay người dùng.
     */
    const calls = stubFetch([
      ['/pfm/consent', { status: 200, body: { ok: true, doi: true, cua: BON_TAT, pfm_consent: true, pfm_bat_dau: LUC } }],
      ['/auth/me', { status: 200, body: meVoi({ ket: true }) }],
    ]);
    ve(new KhoTrongBoNho());
    await waitFor(() => expect(screen.getByTestId('ct-ket')).toHaveAttribute('aria-checked', 'true'));
    fireEvent.click(screen.getByTestId('ct-chung'));
    await waitFor(() => expect(goiConsent(calls)).toHaveLength(3));
    await new Promise((r) => setTimeout(r, 30));
    expect(goiConsent(calls).map((c) => (c.body as { cua: string }).cua)).toEqual(['dac_trung', 'thuong', 'noi_game']);
  });

  it('⭐⭐ công tắc chung khi cả bốn ĐANG bật ⇒ nhãn "TẮT CẢ BỐN", bấm ⇒ bốn POST tắt', async () => {
    const calls = stubFetch([
      ['/pfm/consent', { status: 200, body: { ok: true, doi: true, cua: BON_TAT, pfm_consent: false, pfm_bat_dau: LUC } }],
      ['/auth/me', { status: 200, body: meVoi({ ket: true, dac_trung: true, thuong: true, noi_game: true }) }],
    ]);
    ve(new KhoTrongBoNho());
    await waitFor(() => expect(screen.getByTestId('ct-chung')).toHaveAttribute('aria-checked', 'true'));
    expect(screen.getByText(CHU_CONSENT_KHOI.congTacChungTat)).toBeInTheDocument();
    fireEvent.click(screen.getByTestId('ct-chung'));
    await waitFor(() => expect(goiConsent(calls)).toHaveLength(4));
    for (const c of goiConsent(calls)) expect(c.body).toEqual({ cua: expect.any(String), bat: false });
  });

  it('⭐⭐ công tắc chung DỪNG ở lỗi đầu tiên và nói ra (không đi tiếp ba cửa còn lại)', async () => {
    const calls = stubFetch([
      ['/pfm/consent', { status: 500, body: { error: 'loi_may_chu', message: 'x' }, failFirst: 1 }],
      ['/auth/me', { status: 200, body: meVoi(null) }],
    ]);
    ve(new KhoTrongBoNho());
    await waitFor(() => expect(screen.getByTestId('ct-chung')).not.toBeDisabled());
    fireEvent.click(screen.getByTestId('ct-chung'));
    const loi = await screen.findByRole('alert');
    // Cửa đầu tiên của `CUA_PFM` là `ket` — lỗi phải nêu đúng tên cửa ấy.
    expect(loi.textContent).toContain(VAN_BAN_CONSENT.pfm_ket.tieuDe);
    await new Promise((r) => setTimeout(r, 30));
    expect(goiConsent(calls), 'dừng ở cửa đầu — không được thử tiếp').toHaveLength(1);
  });

  it('khách ⇒ bốn công tắc + công tắc chung bị khoá, có câu mời đăng nhập', async () => {
    // fetch mặc định của setup.ts: 401 ⇒ `/me` null.
    ve(new KhoTrongBoNho());
    expect(await screen.findByText(CHU_CAI_DAT.dangNhapDe)).toBeInTheDocument();
    for (const c of CUA_PFM) expect(screen.getByTestId(`ct-${c}`)).toBeDisabled();
    expect(screen.getByTestId('ct-chung')).toBeDisabled();
  });
});

/* ═══ §II — ② LỄ MÃ · ③ KHOÁ HAI NẤC ══════════════════════════════════════ */

describe('§II — ⭐⭐⭐ lễ mã khôi phục', () => {
  it('⭐ khối ②③④ khoá khi cửa két TẮT; ⑤ thì không bao giờ', async () => {
    stubFetch([['/auth/me', { status: 200, body: meVoi({ dac_trung: true }) }]]);
    ve(new KhoTrongBoNho());
    await waitFor(() => expect(screen.getByTestId('ct-dac_trung')).toHaveAttribute('aria-checked', 'true'));
    for (const id of ['khoi-ma', 'khoi-sao-luu', 'khoi-khoi-phuc']) {
      const k = screen.getByTestId(id);
      expect(k.className, id).toMatch(/khoa/);
      expect(within(k).getByText(CHU_CAI_DAT.khoaTheoKet)).toBeInTheDocument();
    }
    expect(screen.getByTestId('khoi-xoa').className).not.toMatch(/khoa/);
    expect(screen.getByTestId('bt-xoa')).not.toBeDisabled();
  });

  it('⭐⭐⭐ XONG khoá tới khi tích; sau XONG kho có `meta/khoa_ket` là CryptoKey THẬT, và ③ mở khoá', async () => {
    stubFetch([['/auth/me', { status: 200, body: meVoi({ ket: true }) }]]);
    const kho = new KhoTrongBoNho();
    ve(kho);
    await waitFor(() => expect(screen.getByTestId('khoi-ma').className).not.toMatch(/khoa/));

    // ③ khoá vì THIẾU CHÌA dù cửa két đã bật — nhãn khoá phải nói đúng lý do.
    const k3 = screen.getByTestId('khoi-sao-luu');
    expect(k3.className).toMatch(/khoa/);
    expect(within(k3).getByText(CHU_CAI_DAT.khoaTheoChia)).toBeInTheDocument();

    // Mã hiện đúng hình 4-4-4 từ bảng chữ không có I L O U.
    const ma = screen.getByTestId('ma-hien').textContent!;
    expect(ma).toMatch(/^[0-9A-HJKMNP-TV-Z]{4}-[0-9A-HJKMNP-TV-Z]{4}-[0-9A-HJKMNP-TV-Z]{4}$/);
    expect(screen.getByText(CHU_CAI_DAT.canhMa)).toBeInTheDocument();

    const xong = screen.getByTestId('bt-xong-ma');
    expect(xong, 'chưa tích thì chưa bấm được').toBeDisabled();
    fireEvent.click(xong);
    expect(await docChia(kho), 'bấm nút khoá không được rèn gì').toBeNull();

    fireEvent.click(screen.getByTestId('tick-ma'));
    expect(xong).not.toBeDisabled();
    fireEvent.click(xong);
    await waitFor(async () => {
      expect(await docChia(kho)).toBeInstanceOf(CryptoKey);
    }, { timeout: 8000 });
    const b = await kho.doc<CryptoKey>('meta', ID_KHOA_KET);
    expect(b!.d.extractable, 'chìa không trích được (P2)').toBe(false);
    await screen.findByTestId('chia-xong');
    // ③ mở theo KHO, không theo một cờ riêng của màn.
    await waitFor(() => expect(screen.getByTestId('khoi-sao-luu').className).not.toMatch(/khoa/));
    expect(screen.getByTestId('bt-sao-luu')).not.toBeDisabled();
    expect(xong, 'đã có chìa ⇒ XONG khoá lại (rèn đè là mất két cũ)').toBeDisabled();
  }, 15000);

  it('⭐ đã có chìa từ trước ⇒ không bày mã mới không dùng được; XONG khoá', async () => {
    stubFetch([['/auth/me', { status: 200, body: meVoi({ ket: true }) }]]);
    const kho = new KhoTrongBoNho();
    await catChia(kho, await chiaGia(), LUC);
    ve(kho);
    await waitFor(() => expect(screen.getByTestId('ma-hien').textContent).toBe(CHU_CAI_DAT.maTrong));
    fireEvent.click(screen.getByTestId('tick-ma'));
    expect(screen.getByTestId('bt-xong-ma')).toBeDisabled();
  });
});

/* ═══ §III — ③ SAO LƯU NGAY ═════════════════════════════════════════════════ */

describe('§III — ⭐⭐ sao lưu ngay', () => {
  it('⭐⭐ bấm ⇒ driver két chạy với (kho, hôm nay, …, tháng này) và màn nói "vừa xong · N lát"', async () => {
    stubFetch([['/auth/me', { status: 200, body: meVoi({ ket: true }) }]]);
    const kho = new KhoTrongBoNho();
    await catChia(kho, await chiaGia(), LUC);
    ve(kho);
    const nut = await screen.findByTestId('bt-sao-luu');
    await waitFor(() => expect(nut).not.toBeDisabled());
    expect(screen.getByTestId('trang-thai-luu').textContent).toBe(CHU_CAI_DAT.chuaLuu);

    fireEvent.click(nut);
    await waitFor(() => expect(screen.getByTestId('trang-thai-luu').textContent)
      .toBe(`${CHU_CAI_DAT.vuaXongPre}2${CHU_CAI_DAT.vuaXongHau}`));
    const goi = vi.mocked(saoLuuMotLuot).mock.calls.at(-1)!;
    expect(goi[0]).toBe(kho);
    expect(goi[1]).toBe(homNay());
    expect(goi[3]).toBe(thangNay());
  });

  it('⭐ `vuong` ⇒ nói bằng câu tự điển, KHÔNG lộ mã lỗi trần', async () => {
    stubFetch([['/auth/me', { status: 200, body: meVoi({ ket: true }) }]]);
    const kho = new KhoTrongBoNho();
    await catChia(kho, await chiaGia(), LUC);
    vi.mocked(saoLuuMotLuot).mockResolvedValue({ daLuu: [], thangDong: 0, quaLon: 0, conBan: 1, vuong: 'het_suat_ngay' });
    ve(kho);
    const nut = await screen.findByTestId('bt-sao-luu');
    await waitFor(() => expect(nut).not.toBeDisabled());
    fireEvent.click(nut);
    await waitFor(() => expect(screen.getByTestId('trang-thai-luu').textContent).toBe(CHU_VUONG.het_suat_ngay));
    expect(screen.getByTestId('trang-thai-luu').textContent).not.toContain('het_suat_ngay');
  });
});

/* ═══ §IV — ④ KHÔI PHỤC ═════════════════════════════════════════════════════ */

describe('§IV — ⭐⭐⭐ khôi phục', () => {
  it('⭐ mã sai độ dài ⇒ KHÔNG gọi driver, câu lỗi mang đúng hai con số', async () => {
    stubFetch([['/auth/me', { status: 200, body: meVoi({ ket: true }) }]]);
    ve(new KhoTrongBoNho());
    const nut = await screen.findByTestId('bt-khoi-phuc');
    await waitFor(() => expect(nut).not.toBeDisabled());
    fireEvent.change(screen.getByTestId('o-ma-kp'), { target: { value: 'abc-1' } });
    fireEvent.click(nut);
    const loi = await screen.findByRole('alert');
    expect(loi.textContent).toBe(
      `${CHU_CAI_DAT.loiDoDaiPre}${DAI_MA}${CHU_CAI_DAT.loiDoDaiGiua}4${CHU_CAI_DAT.loiDoDaiHau}`);
    expect(khoiPhucTuKet).not.toHaveBeenCalled();
  });

  it('⭐⭐⭐ mã đúng ⇒ driver nhận (kho, chìa, lát 12 tháng, mốc) · hoá đơn THÊM/GIỮ/CẤN · chìa được cất · cache pfm tươi', async () => {
    stubFetch([['/auth/me', { status: 200, body: meVoi({ ket: true }) }]]);
    const kho = new KhoTrongBoNho();
    vi.mocked(khoiPhucTuKet).mockResolvedValue({ lat: ['song'], them: 42, thay: 0, giu: 3, can: ['k9'], hong: 2 });
    ve(kho);
    const nut = await screen.findByTestId('bt-khoi-phuc');
    await waitFor(() => expect(nut).not.toBeDisabled());
    // Gõ tay có gạch nối + chữ thường — `chuanMa` lo phần chuẩn hoá.
    fireEvent.change(screen.getByTestId('o-ma-kp'), { target: { value: mocMa(taoMaKhoiPhuc()).toLowerCase() } });
    fireEvent.click(nut);

    await screen.findByTestId('hoa-don', {}, { timeout: 8000 });
    expect(screen.getByTestId('hd-them').textContent).toBe('42');
    expect(screen.getByTestId('hd-giu').textContent).toBe('3');
    expect(screen.getByTestId('hd-can').textContent).toBe('1');
    expect(screen.getByText(`${CHU_CAI_DAT.hongPre}2${CHU_CAI_DAT.hongHau}`)).toBeInTheDocument();

    const goi = vi.mocked(khoiPhucTuKet).mock.calls[0]!;
    expect(goi[0]).toBe(kho);
    expect(goi[1]).toBeInstanceOf(CryptoKey);
    expect(goi[2]).toEqual(latDeKhoiPhuc(thangNay()));
    expect(await docChia(kho), 'chìa rèn từ mã người gõ được cất — ③ mở được sau đó').toBeInstanceOf(CryptoKey);

    // `?` giải thích "cấn" — chỉ hiện sau khi có hoá đơn.
    fireEvent.click(within(screen.getByTestId('khoi-khoi-phuc')).getByRole('button', { name: '?' }));
    expect(screen.getByText(CHU_CAI_DAT.giaiHoaDon)).toBeInTheDocument();
  }, 15000);

  it('⭐⭐⭐ `khong_mo_duoc` ⇒ chìa đang có GIỮ NGUYÊN — mã gõ sai không được đè lên chìa thật', async () => {
    /*
     * `khoiPhucChia` (ket_may) cất ngay khi rèn; màn cố ý KHÔNG dùng nó: một mã sai
     * đè lên chìa đang có là két cũ không mở được nữa, im lặng.
     */
    stubFetch([['/auth/me', { status: 200, body: meVoi({ ket: true }) }]]);
    const kho = new KhoTrongBoNho();
    const chiaCu = await chiaGia();
    await catChia(kho, chiaCu, LUC);
    vi.mocked(khoiPhucTuKet).mockResolvedValue({ lat: [], them: 0, thay: 0, giu: 0, can: [], hong: 3, vuong: 'khong_mo_duoc' });
    ve(kho);
    const nut = await screen.findByTestId('bt-khoi-phuc');
    await waitFor(() => expect(nut).not.toBeDisabled());
    fireEvent.change(screen.getByTestId('o-ma-kp'), { target: { value: taoMaKhoiPhuc() } });
    fireEvent.click(nut);
    await screen.findByText(CHU_VUONG.khong_mo_duoc, {}, { timeout: 8000 });
    expect(await docChia(kho), 'chìa cũ phải còn nguyên').toBe(chiaCu);
  }, 15000);
});

/* ═══ §V — ⑤ XOÁ SẠCH — GIỮ 2 GIÂY ═════════════════════════════════════════ */

describe('§V — ⭐⭐⭐ xoá sạch', () => {
  async function khoCoDo(): Promise<KhoTrongBoNho> {
    const kho = new KhoTrongBoNho();
    await kho.ghi('khoan', { id: 'k1', thang: thangNay(), suaLuc: LUC, d: { soTien: 1 } });
    await kho.ghi('hu', { id: 'h1', thang: thangNay(), suaLuc: LUC, d: { ten: 'x' } });
    return kho;
  }

  it('⭐⭐ nhả sớm ⇒ KHÔNG gọi /pfm/xoa, kho còn nguyên', async () => {
    const calls = stubFetch([
      ['/pfm/xoa', { status: 200, body: { ok: true, da_xoa: {} } }],
      ['/auth/me', { status: 200, body: meVoi(null) }],
    ]);
    const kho = await khoCoDo();
    ve(kho);
    const nut = await screen.findByTestId('bt-xoa');
    await waitFor(() => expect(nut).not.toBeDisabled());

    fireEvent.pointerDown(nut, { pointerId: 1 });
    await new Promise((r) => setTimeout(r, 40));       // chưa tới 120 ms
    fireEvent.pointerUp(nut, { pointerId: 1 });
    await new Promise((r) => setTimeout(r, 150));
    expect(calls.filter((c) => c.url.includes('/pfm/xoa'))).toHaveLength(0);
    expect(await kho.dem('khoan')).toBe(1);
    expect(screen.queryByTestId('dau-xoa')).toBeNull();
  });

  it('⭐⭐ CẢ MÀN khai "đang thao tác" — Oracle không được đứng đè cột công tắc', async () => {
    /*
     * ⚠ Bài này ĐỔI Ý so với bản đầu (nó từng đòi cờ TẮT khi nhả nút giữ). Rà đối kháng
     * đo được: mascot Oracle là một nút `position: fixed` 44×44 ở mép phải-dưới, đúng chỗ
     * CỘT công tắc và nút `?` của màn này xếp dọc — chạm mép phải một công tắc dừng trong
     * dải ấy mở chat thay vì gạt. Founder 06/09: *"những lúc cần thao tác cho nó mất hẳn
     * cũng được"*, và cả màn Cài đặt là một chuỗi thao tác.
     * ⇒ Cờ bật suốt thời gian màn sống, và phải NHẢ khi màn rời đi — cờ kẹt thì Oracle
     * biến mất vĩnh viễn ở mọi màn khác, im lặng.
     */
    stubFetch([['/auth/me', { status: 200, body: meVoi(null) }]]);
    expect(document.body.dataset.dangThaoTac).toBeUndefined();
    const { unmount } = ve(await khoCoDo());
    await screen.findByTestId('bt-xoa');
    expect(document.body.dataset.dangThaoTac, 'Oracle nhường chỗ suốt màn Cài đặt').toBe('co');
    unmount();
    await waitFor(() => expect(document.body.dataset.dangThaoTac).toBeUndefined());
  });

  it('⭐⭐⭐ giữ đủ ⇒ POST /pfm/xoa · kho RỖNG · /me hỏi lại · con dấu ĐÃ XOÁ SẠCH', async () => {
    const calls = stubFetch([
      ['/pfm/xoa', { status: 200, body: { ok: true, da_xoa: {} } }],
      ['/auth/me', { status: 200, body: meVoi({ ket: true }) }],
    ]);
    const kho = await khoCoDo();
    await catChia(kho, await chiaGia(), LUC);
    ve(kho);
    const nut = await screen.findByTestId('bt-xoa');
    await waitFor(() => expect(nut).not.toBeDisabled());
    const meTruoc = goiMe(calls).length;

    fireEvent.pointerDown(nut, { pointerId: 1 });
    await screen.findByTestId('dau-xoa', {}, { timeout: 4000 });
    expect(calls.filter((c) => c.url.includes('/pfm/xoa') && c.method === 'POST')).toHaveLength(1);
    expect(await kho.dem('khoan')).toBe(0);
    expect(await kho.dem('hu')).toBe(0);
    expect(await docChia(kho), 'chìa cũng đi — xoá sạch là sạch').toBeNull();
    expect(goiMe(calls).length).toBeGreaterThan(meTruoc);
    expect(screen.getByText(CHU_CAI_DAT.ketQuaXoa)).toBeInTheDocument();
    // ② về trạng thái đầu: mã mới, chưa tích.
    expect((screen.getByTestId('tick-ma') as HTMLInputElement).checked).toBe(false);
  });

  it('⭐⭐ máy chủ hỏng ⇒ KHÔNG xoá gì trên máy, nói ra — xoá nửa vời là nói dối (P9)', async () => {
    stubFetch([
      ['/pfm/xoa', { status: 500, body: { error: 'loi', message: 'x' } }],
      ['/auth/me', { status: 200, body: meVoi(null) }],
    ]);
    const kho = await khoCoDo();
    ve(kho);
    const nut = await screen.findByTestId('bt-xoa');
    await waitFor(() => expect(nut).not.toBeDisabled());
    fireEvent.pointerDown(nut, { pointerId: 1 });
    await screen.findByText(CHU_CAI_DAT.loiXoa, {}, { timeout: 4000 });
    expect(await kho.dem('khoan'), 'máy này chưa xoá gì').toBe(1);
    expect(screen.queryByTestId('dau-xoa')).toBeNull();
  });
});

/* ═══ §VI — ⑥ KHÁC: cục bộ ở `meta` ═══════════════════════════════════════ */

describe('§VI — ⭐ tắt Gương / tắt nhắc là cài đặt CỤC BỘ trong kho', () => {
  it('bật công tắc ⇒ `meta/cai_dat_may` đổi; không request nào đi', async () => {
    const calls = stubFetch([['/auth/me', { status: 200, body: meVoi(null) }]]);
    const kho = new KhoTrongBoNho();
    ve(kho);
    const ct = await screen.findByTestId('ct-guong');
    await waitFor(() => expect(ct).not.toBeDisabled());
    expect(ct).toHaveAttribute('aria-checked', 'false');
    fireEvent.click(ct);
    await waitFor(async () => {
      const b = await kho.doc<CaiDatMay>('meta', ID_CAI_DAT_MAY);
      expect(b?.d).toEqual({ guongTat: true, nhacTat: false });
    });
    await waitFor(() => expect(ct).toHaveAttribute('aria-checked', 'true'));
    expect(calls.filter((c) => c.method === 'POST')).toHaveLength(0);
  });
});

/* ═══ §VII — hai đầu dây CSS ═══════════════════════════════════════════════ */

describe('§VII — ⭐ CSS: không đè nút của cả app; giảm chuyển động có mặt', () => {
  const css = readFileSync(resolve(__dirname, '../src/components/pfm/CaiDatPfm.module.css'), 'utf8');

  it('⭐⭐ KHÔNG có bộ chọn `button {}` trần — trong module CSS nó là toàn cục', () => {
    /*
     * Demo có `button{…}` toàn cục vì demo là một trang đứng một mình. Chép nguyên vào
     * `*.module.css` là đè lên MỌI nút của app ngay khi module được nạp — không lỗi,
     * không cảnh báo, chỉ là nút ở màn khác mất viền.
     */
    expect(css).not.toMatch(/^\s*button\s*\{/m);
    /*
     * ⚠ Và KHÔNG được là `.man button` (0,1,1): nó thắng mọi lớp nút một-class của chính
     * tệp này, tức reset xoá luôn viền/nền/màu của những nút nó vừa reset (đo được trên
     * trình duyệt: nút giữ-để-xoá mất cả viền lẫn màu `--lose`). `:where(.man)` giữ phạm vi
     * ở (0,0,1) — bằng đúng `button{}` của demo. Bản đầu của bài này ĐÒI `.man button` nên
     * nó khoá cứng lỗi thay vì bắt lỗi.
     */
    expect(css).toMatch(/:where\(\.man\)\s+button\s*\{/);
    expect(css).not.toMatch(/(^|[^:])\.man\s+button\s*[{:]/m);
    /* Chữ của khối khai lại ở `.man` — không kế thừa 12,5px/1.55 của ScreenFrame (xem CSS). */
    expect(css).toMatch(/\.man\s*\{[^}]*font-size:\s*16px/);
    expect(css).toMatch(/\.man\s*\{[^}]*line-height:\s*normal/);
  });

  it('mọi `animation` mới có mặt trong khối `prefers-reduced-motion` (A11.18)', () => {
    const khoi = css.slice(css.indexOf('prefers-reduced-motion'));
    for (const lop of ['.ledNhan', '.dauXoa', '.led i', '.congTac .nut']) {
      expect(khoi, lop).toContain(lop);
    }
  });
});
