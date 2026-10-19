/**
 * PFM — DRIVER ĐỒNG BỘ (`dong_bo_chay.ts`, GĐ1): vòng `layLo → POST → xacNhanGui`.
 *
 * ⚠ Bài quan trọng nhất ở đây KHÔNG phải đường thuận. Nó là bốn đường HỎNG — vì luật
 * xương sống của cả PFM là *"bỏ món khỏi hàng đợi CHỈ KHI server đã trả lời về chính
 * món đó"*, và một luật như thế chỉ được chứng minh bằng các ca nó suýt bị vi phạm.
 */
import { describe, expect, it, vi, afterEach } from 'vitest';
import { dongBoMotLuot } from '../src/pfm/dong_bo_chay.js';
import { xepHang, type MonHangDoi } from '../src/pfm/dong_bo.js';
import { KhoTrongBoNho } from '../src/pfm/kho.js';
import { SCHEMA_VERSION, type MaDacTrung } from '@config/pfm_dac_trung';
import { PFM_LO } from '@config/pfm';

vi.mock('../src/lib/telemetry.js', () => ({
  ghiDo: vi.fn(),
  manCuaDuong: () => '/tai-chinh',
}));
const { ghiDo } = await import('../src/lib/telemetry.js');

const LUC = '2026-08-31T10:00:00.000Z';
const NGAY = '2026-08-31';
const THANG = '2026-08';

const nhip = (ma = 'pfm_hu'): MonHangDoi =>
  ({ loai: 'nhip', ma, v: { hu_id: 'h1', ma: 'tao' } });
const goi = (ky: string): MonHangDoi => ({
  loai: 'goi', ky,
  goi: { ky, schemaVersion: SCHEMA_VERSION, dong: [{ ma: 'hv_chi_bu' as MaDacTrung, giaTri: 0.25 }] },
});

/** Kho có sẵn `n` nhịp, trả kèm danh sách khoá theo đúng thứ tự xếp. */
async function khoCo(n: number): Promise<{ kho: KhoTrongBoNho; ids: string[] }> {
  const kho = new KhoTrongBoNho();
  const ids: string[] = [];
  for (let i = 0; i < n; i++) {
    await xepHang(kho, nhip(), LUC, `r${i}`, THANG);
    ids.push(`nhip:r${i}`);
  }
  return { kho, ids };
}

function traLoi(o: unknown, status = 200): void {
  vi.stubGlobal('fetch', () => Promise.resolve(new Response(
    JSON.stringify(o), { status, headers: { 'content-type': 'application/json' } })));
}

afterEach(() => { vi.unstubAllGlobals(); vi.mocked(ghiDo).mockClear(); });

describe('§I — đường thuận', () => {
  it('gửi, bỏ đúng món server đã nhận, ghi nhận một lượt trong ngày', async () => {
    const { kho, ids } = await khoCo(3);
    traLoi({ ok: true, ghi: 3, trung: 0, bo: 0, ket: ids.map((id) => ({ id, ket: 'ghi' })) });

    const kq = await dongBoMotLuot(kho, NGAY, LUC);
    expect(kq).toMatchObject({ daGui: true, ghi: 3, conLai: 0 });
    expect(await kho.dem('outbox')).toBe(0);
  });

  it('hàng đợi rỗng ⇒ KHÔNG gọi mạng một lần nào', async () => {
    const goi_ = vi.fn();
    vi.stubGlobal('fetch', goi_);
    const kq = await dongBoMotLuot(new KhoTrongBoNho(), NGAY, LUC);
    expect(kq.vuong).toBe('hang_doi_rong');
    expect(goi_).not.toHaveBeenCalled();
  });

  it('hết suất trong ngày ⇒ dừng trước khi gửi', async () => {
    const { kho } = await khoCo(1);
    for (let i = 0; i < PFM_LO.LO_MOI_NGAY; i++) {
      await (await import('../src/pfm/dong_bo.js')).ghiNhanGui(kho, NGAY, 'lo', LUC);
    }
    const goi_ = vi.fn();
    vi.stubGlobal('fetch', goi_);
    expect((await dongBoMotLuot(kho, NGAY, LUC)).vuong).toBe('het_suat_ngay');
    expect(goi_).not.toHaveBeenCalled();
  });
});

describe('§II — bốn đường HỎNG: hàng đợi phải còn nguyên', () => {
  it('⭐⭐⭐ MẤT MẠNG ⇒ không bỏ món nào', async () => {
    const { kho } = await khoCo(3);
    vi.stubGlobal('fetch', () => Promise.reject(new TypeError('Failed to fetch')));

    const kq = await dongBoMotLuot(kho, NGAY, LUC);
    expect(kq.vuong).toBe('chua_toi_may_chu');
    expect(kq.daGui).toBe(false);
    expect(await kho.dem('outbox'), 'chưa tới máy chủ ⇒ giữ NGUYÊN').toBe(3);
  });

  it('⭐⭐ MÁY CHỦ TỪ CHỐI CẢ LÔ (400) ⇒ vẫn không bỏ món nào', async () => {
    /*
     * Một lỗi CẢ LÔ không nói được món nào hỏng, nên bỏ theo nó là vứt cả món lành.
     * ⚠ Và hai nguyên nhân 400-cả-lô đã bị chặn TỪ TRƯỚC khi gửi (`layLo` cắt theo cả
     * trần món lẫn trần dòng), nên nhánh này không thể thành hàng đợi tắc vĩnh viễn.
     */
    const { kho } = await khoCo(2);
    traLoi({ error: 'lo_qua_lon', message: 'quá lớn' }, 400);

    const kq = await dongBoMotLuot(kho, NGAY, LUC);
    expect(kq.vuong).toBe('may_chu_tu_choi');
    expect(await kho.dem('outbox')).toBe(2);
  });

  it('⭐⭐⭐ PHẢN HỒI LỆCH (thiếu món) ⇒ KHÔNG xoá gì cả', async () => {
    /*
     * Lệch nghĩa là hai đầu dây đã trôi khỏi nhau — đúng loại lỗi sinh ra R8. Lúc đó thứ
     * duy nhất an toàn là không xoá gì: xoá theo một phản hồi mình không hiểu là mất dữ
     * liệu vĩnh viễn, còn giữ lại thì tệ nhất là gửi lại một lần nữa.
     */
    const { kho, ids } = await khoCo(3);
    traLoi({ ok: true, ghi: 2, trung: 0, bo: 0, ket: ids.slice(0, 2).map((id) => ({ id, ket: 'ghi' })) });

    expect((await dongBoMotLuot(kho, NGAY, LUC)).vuong).toBe('phan_hoi_lech');
    expect(await kho.dem('outbox')).toBe(3);
  });

  it('⭐⭐ PHẢN HỒI LỆCH (sai thứ tự id) ⇒ KHÔNG xoá gì cả', async () => {
    const { kho, ids } = await khoCo(2);
    const daoNguoc = [...ids].reverse();
    traLoi({ ok: true, ghi: 2, trung: 0, bo: 0, ket: daoNguoc.map((id) => ({ id, ket: 'ghi' })) });

    expect((await dongBoMotLuot(kho, NGAY, LUC)).vuong).toBe('phan_hoi_lech');
    expect(await kho.dem('outbox'), 'đúng số món nhưng sai chỗ vẫn là lệch').toBe(2);
  });
});

describe('§III — món BỎ: bỏ thì phải ĐẾM', () => {
  it('⭐⭐ mỗi món `bo` phát đúng một `pfm_lo_loi`, và món đó rời hàng đợi', async () => {
    /*
     * Giao ước bảo bỏ luôn món `bo` (giữ lại thì một dòng hỏng chặn mọi món phía sau,
     * vĩnh viễn, im lặng). Nhưng **bỏ mà không đếm là cách mất dữ liệu êm ái nhất tồn
     * tại** — bài này khoá cái đếm.
     */
    const kho = new KhoTrongBoNho();
    await xepHang(kho, nhip('pfm_hu'), LUC, 'a', THANG);
    await xepHang(kho, goi('2026-08'), LUC, 'b', THANG);
    /*
     * ⚠ Lấy THỨ TỰ THẬT từ `layLo` chứ đừng đoán. Bản đầu tôi viết tay ['nhip:a',
     * 'goi:2026-08'] và bài đỏ ở một chỗ chẳng liên quan (`bo` = 0) — vì driver thấy thứ
     * tự lệch nên trả `phan_hoi_lech`, đúng như nó phải làm. Chính cái rào tôi vừa viết
     * đã bắt bài test của tôi.
     */
    const truoc = await (await import('../src/pfm/dong_bo.js')).layLo(kho);
    traLoi({
      ok: true, ghi: 0, trung: 0, bo: 2,
      ket: truoc.ids.map((id) => ({ id, ket: 'bo', ly_do: 'thử' })),
    });
    const laNhipTruoc = truoc.than[0]!.loai === 'nhip';

    const kq = await dongBoMotLuot(kho, NGAY, LUC);
    expect(kq.bo).toBe(2);
    expect(await kho.dem('outbox'), 'bỏ là bỏ thật').toBe(0);

    expect(vi.mocked(ghiDo)).toHaveBeenCalledTimes(2);
    const nhipGoi = ['pfm_lo_loi', { chi_tiet: { loai: 'nhip', ma: 'pfm_hu' } }];
    const goiGoi = ['pfm_lo_loi', { chi_tiet: { loai: 'goi' } }];   // gói KHÔNG có `ma`
    const goi_ = vi.mocked(ghiDo).mock.calls;
    expect(goi_[0]).toEqual(laNhipTruoc ? nhipGoi : goiGoi);
    expect(goi_[1]).toEqual(laNhipTruoc ? goiGoi : nhipGoi);
  });

  it('món `ghi`/`trung` KHÔNG phát pfm_lo_loi', async () => {
    const { kho, ids } = await khoCo(2);
    traLoi({ ok: true, ghi: 1, trung: 1, bo: 0,
      ket: [{ id: ids[0], ket: 'ghi' }, { id: ids[1], ket: 'trung' }] });

    const kq = await dongBoMotLuot(kho, NGAY, LUC);
    expect(kq).toMatchObject({ ghi: 1, trung: 1, bo: 0, conLai: 0 });
    expect(vi.mocked(ghiDo)).not.toHaveBeenCalled();
  });
});
