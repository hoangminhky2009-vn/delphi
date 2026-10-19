/**
 * PFM — MẶT API CỦA CLIENT (`api/pfm.ts`) + đường NHỊ PHÂN của `api/client.ts`. GĐ1.
 *
 *   §I   chốt `kiemVaoApi` — và nó có THẬT SỰ được gọi không.
 *   §II  thân nhị phân đi thẳng, không qua JSON.
 *   §III phản hồi nhị phân đọc đúng, lỗi vẫn là JSON.
 *   §IV  bảy đường ghép đúng chữ ký server.
 */
import { describe, expect, it, vi, afterEach } from 'vitest';
import { api, kiemVaoApi, ApiError } from '../src/api/client';
import { batCua, tatCua, cuaTuMe, diemDanh, luuKet, docKet, guiLo } from '../src/api/pfm';
import { CONSENT_PHIEN_BAN, CUA_PFM, vanBanCua } from '@config/pfm_consent';

afterEach(() => { vi.unstubAllGlobals(); });

/** Bắt lấy lời gọi fetch cuối cùng và trả một phản hồi dựng sẵn. */
function batFetch(tra: () => Response): { lan: () => { url: string; init: RequestInit } } {
  let cuoi: { url: string; init: RequestInit } | null = null;
  vi.stubGlobal('fetch', (u: string, init: RequestInit) => {
    cuoi = { url: u, init };
    return Promise.resolve(tra());
  });
  return {
    lan: () => {
      if (!cuoi) throw new Error('fetch chưa được gọi');
      return cuoi;
    },
  };
}

const jsonOk = (o: unknown) => () =>
  new Response(JSON.stringify(o), { status: 200, headers: { 'content-type': 'application/json' } });

describe('§I — chốt kiemVaoApi, và nó CÓ ĐƯỢC GỌI không', () => {
  it('vừa `than` vừa `body` ⇒ từ chối', () => {
    expect(kiemVaoApi({ method: 'POST', than: new Uint8Array(1), body: { a: 1 } }))
      .toMatch(/chọn một/);
  });

  it('`than` với GET ⇒ từ chối', () => {
    expect(kiemVaoApi({ than: new Uint8Array(1) })).toMatch(/chỉ đi với POST/);
  });

  it('dùng đúng ⇒ null', () => {
    expect(kiemVaoApi({ method: 'POST', than: new Uint8Array(1) })).toBeNull();
    expect(kiemVaoApi({ method: 'POST', body: { a: 1 } })).toBeNull();
    expect(kiemVaoApi({})).toBeNull();
  });

  it('⭐⭐ `api()` THẬT SỰ gọi chốt — không chỉ khai nó', async () => {
    /*
     * ⚠ ĐÂY LÀ BÀI CHỐNG ĐÚNG CÁI BẪY D242: một hàm kiểm viết ra mà không ai gọi trông
     * y hệt một hàm kiểm đang chạy, và nó còn tệ hơn không có — nó làm người đọc yên
     * tâm. Ba bài §I ở trên gọi `kiemVaoApi` TRỰC TIẾP nên chúng xanh kể cả khi `api()`
     * không hề gọi nó. Bài này là bài duy nhất phân biệt được.
     */
    batFetch(jsonOk({ ok: true }));
    await expect(
      api('/thu', { method: 'POST', than: new Uint8Array(1), body: { a: 1 } }),
    ).rejects.toThrow(/chọn một/);
  });
});

describe('§II — thân nhị phân đi THẲNG, không qua JSON', () => {
  it('⭐ body giữ nguyên byte, content-type là octet-stream', async () => {
    const f = batFetch(jsonOk({ ok: true, ver: 3 }));
    const byte = new Uint8Array([1, 2, 250, 0, 255]);
    await luuKet('2026-09-01', 4, 2, byte);

    const { init } = f.lan();
    expect(init.body, 'phải là chính mảng byte, không phải chuỗi JSON').toBe(byte);
    expect((init.headers as Record<string, string>)['content-type'])
      .toBe('application/octet-stream');
    expect((init.headers as Record<string, string>)['content-length'],
      'content-length là forbidden header — trình duyệt tự điền, ta KHÔNG đặt').toBeUndefined();
  });

  it('⭐ đường JSON không đổi một byte nào (hồi quy)', async () => {
    const f = batFetch(jsonOk({ ok: true }));
    await tatCua('ket');
    const { init } = f.lan();
    expect(init.body).toBe(JSON.stringify({ cua: 'ket', bat: false }));
    expect((init.headers as Record<string, string>)['content-type']).toBe('application/json');
  });
});

describe('§III — phản hồi nhị phân', () => {
  it('⭐ đọc đúng byte trả về', async () => {
    const goc = new Uint8Array([9, 8, 7]);
    vi.stubGlobal('fetch', () => Promise.resolve(new Response(goc, { status: 200 })));
    const ra = await docKet('2026-09-01');
    expect(ra).not.toBeNull();
    expect([...new Uint8Array(ra!.than)]).toEqual([9, 8, 7]);
  });

  it('⭐⭐ nhặt `ver` từ `X-Pfm-Ver` — số DUY NHẤT cho máy vừa khôi phục biết mình cầm bản nào',
    async () => {
      /*
       * Server đã cố ý đặt header này từ D251; trước lượt này client vứt nó đi. Hậu quả
       * không phải mất dữ liệu mà là một cú 409 chắc chắn ngay sau khi khôi phục — máy
       * hoàn toàn khoẻ mà màn hình báo lỗi.
       */
      vi.stubGlobal('fetch', () => Promise.resolve(new Response(new Uint8Array([1]), {
        status: 200, headers: { 'X-Pfm-Ver': '7', 'X-Pfm-Schema-V': '2' },
      })));
      expect(await docKet('2026-09-01')).toMatchObject({ ver: 7, schemaV: 2 });
    });

  it('thiếu/hỏng header ⇒ ver 0, KHÔNG phải NaN', async () => {
    // `NaN` đi tiếp thành `?ver=NaN` và ăn 400 vô nghĩa; `0` đi vào đúng đường 409 đã có.
    vi.stubGlobal('fetch', () => Promise.resolve(new Response(new Uint8Array([1]), {
      status: 200, headers: { 'X-Pfm-Ver': 'xin-chao' },
    })));
    expect((await docKet('2026-09-01'))!.ver).toBe(0);
  });

  it('⭐ 404 ⇒ null, KHÔNG ném — "chưa từng sao lưu" là trạng thái bình thường', async () => {
    vi.stubGlobal('fetch', () => Promise.resolve(new Response(
      JSON.stringify({ error: 'khong_thay' }), { status: 404 })));
    expect(await docKet('2026-09-01')).toBeNull();
  });

  it('⭐⭐ lỗi KHÁC vẫn là ApiError đọc từ JSON — route nhị phân không đẻ hình lỗi thứ hai',
    async () => {
      vi.stubGlobal('fetch', () => Promise.resolve(new Response(
        JSON.stringify({ error: 'ver_cu', message: 'bản cũ', ver: 7 }), { status: 409 })));
      await expect(docKet('2026-09-01')).rejects.toBeInstanceOf(ApiError);
      await expect(docKet('2026-09-01')).rejects.toMatchObject({ status: 409, code: 'ver_cu' });
    });
});

describe('§IV — ghép đúng chữ ký server', () => {
  it('⭐⭐ batCua: MỖI cửa gửi văn bản CỦA ĐÚNG CỬA ẤY, phiên bản từ SỔ ĐĂNG KÝ', async () => {
    /*
     * Server chỉ nhận cặp (văn bản của đúng cửa, bản ĐANG hiệu lực) — D295. Một chuỗi gõ
     * tay ở màn hình là một cú 400 chờ sẵn ngày văn bản đổi phiên bản; và gửi `pfm_ket`
     * để mở `thuong` là ghi ra một vết "chứng minh" điều không xảy ra.
     */
    for (const cua of CUA_PFM) {
      const f = batFetch(jsonOk({ ok: true, doi: true }));
      await batCua(cua);
      const vb = vanBanCua(cua);
      expect(JSON.parse(f.lan().init.body as string), cua).toEqual({
        cua, bat: true, van_ban_id: vb, phien_ban: CONSENT_PHIEN_BAN[vb],
      });
    }
  });

  it('⭐ TẮT không kèm vết — rút lại thì không được dựng thêm rào; nhưng PHẢI nói rõ cửa nào', async () => {
    const f = batFetch(jsonOk({ ok: true, doi: true }));
    await tatCua('thuong');
    expect(JSON.parse(f.lan().init.body as string)).toEqual({ cua: 'thuong', bat: false });
  });

  it('⭐⭐ cuaTuMe: null khi chưa biết/bốn cửa đóng; `pfm` thiếu `cua` ⇒ bốn ĐÓNG, không bịa bật', () => {
    /*
     * ⚠ Bản máy chủ cũ trong cache PWA trả `pfm` mà không có `cua` — coi là ĐÓNG (P7/D62:
     * thiếu là vắng), hỏng về phía không gửi gì đi. Driver kích cổng bằng chính hàm này.
     */
    expect(cuaTuMe(null)).toBeNull();
    expect(cuaTuMe(undefined)).toBeNull();
    const me = { email: 'a', email_verified: true, onboarded: true, user: null };
    expect(cuaTuMe({ ...me, pfm: null })).toBeNull();
    expect(cuaTuMe({ ...me, pfm: { consent: true, bat_dau: null } }))
      .toEqual({ ket: false, dac_trung: false, thuong: false, noi_game: false });
    expect(cuaTuMe({ ...me, pfm: { consent: true, bat_dau: null, cua: { ket: true } } }))
      .toEqual({ ket: true, dac_trung: false, thuong: false, noi_game: false });
  });

  it('luuKet ghép đủ ba tham số truy vấn', async () => {
    const f = batFetch(jsonOk({ ok: true, ver: 1 }));
    await luuKet('1970-01-01', 4, 0, new Uint8Array(1));
    const u = new URL(f.lan().url, 'http://x');
    expect(u.pathname).toBe('/api/v1/pfm/luu');
    expect(u.searchParams.get('thang')).toBe('1970-01-01');
    expect(u.searchParams.get('schema_v')).toBe('4');
    expect(u.searchParams.get('ver')).toBe('0');
  });

  it('docKet không gửi `the_he` khi không nêu; có gửi khi nêu', async () => {
    const f = batFetch(() => new Response(new Uint8Array(1), { status: 200 }));
    await docKet('2026-09-01');
    expect(new URL(f.lan().url, 'http://x').searchParams.has('the_he')).toBe(false);
    await docKet('2026-09-01', 2);
    expect(new URL(f.lan().url, 'http://x').searchParams.get('the_he')).toBe('2');
  });

  it('guiLo bọc lô trong `{mon}` đúng như server đọc', async () => {
    const f = batFetch(jsonOk({ ok: true, ket: [], ghi: 0, trung: 0, bo: 0 }));
    await guiLo([{ id: 'nhip:a', loai: 'nhip', ma: 'pfm_hu', v: { hu_id: 'h', ma: 'tao' } }]);
    const than = JSON.parse(f.lan().init.body as string);
    expect(Object.keys(than)).toEqual(['mon']);
    expect(than.mon[0].id).toBe('nhip:a');
  });

  it('diemDanh KHÔNG gửi `ngay` — đồng hồ là của server (K7)', async () => {
    const f = batFetch(jsonOk({ ngay: '2026-09-05', trang_thai: 'co_ghi' }));
    await diemDanh('co_ghi');
    const than = JSON.parse(f.lan().init.body as string);
    expect(Object.keys(than)).toEqual(['trang_thai']);
  });
});
