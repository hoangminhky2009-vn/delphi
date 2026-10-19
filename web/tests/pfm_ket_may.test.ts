/**
 * PFM — KÉT TRÊN MÁY (`ket_may.ts`, R12/GĐ1): muối suy ra, chìa cất trong kho, phong bì dây.
 *
 * ⚠ Bài đắt nhất ở đây là §III: **khôi phục trên MÁY MỚI**. Đó là thứ R12 mở khoá — trước
 * nó, `suyKhoa` đòi một tham số (`muoi`) mà cả hệ thống không sinh ra được, nên đường
 * khôi phục là BẤT KHẢ một cách im lặng và chỉ lộ ra khi có người thật mất máy.
 *
 * ⚠ PBKDF2 600k vòng nên mỗi lượt rèn chìa tốn cỡ một giây. Các bài dưới cố ý **dùng lại
 * chìa** thay vì rèn lại cho tiện — chậm là chậm thật, không phải chậm vì viết ẩu.
 */
import { describe, expect, it, beforeAll } from 'vitest';
import {
  muoiCuaUser, taoVaLuuChia, khoiPhucChia, docChia, catChia, ID_KHOA_KET,
  raByte, tuByte, latQuaLon,
} from '../src/pfm/ket_may.js';
import { dongLat, moLat, DAI_MUOI, DAI_IV, DINH_DANG_KET, LoiKet } from '../src/pfm/ket.js';
import { KhoTrongBoNho } from '../src/pfm/kho.js';
import { PFM } from '@config/pfm';

const LUC = '2026-09-05T10:00:00.000Z';
const U1 = '11111111-1111-1111-1111-111111111111';
const U2 = '22222222-2222-2222-2222-222222222222';
const RUOT = { hu: [{ id: 'h1', thang: '2026-09', suaLuc: LUC, d: { ten: 'Quỹ dự phòng' } }] };

describe('§I — muối suy ra từ user_id', () => {
  it('đúng DAI_MUOI byte, và TẤT ĐỊNH', async () => {
    const a = await muoiCuaUser(U1);
    const b = await muoiCuaUser(U1);
    expect(a).toHaveLength(DAI_MUOI);
    expect([...a]).toEqual([...b]);
  });

  it('⭐ hai user ⇒ hai muối khác nhau (đó là TOÀN BỘ vai của muối)', async () => {
    expect([...await muoiCuaUser(U1)]).not.toEqual([...await muoiCuaUser(U2)]);
  });

  it('user_id rỗng ⇒ ném, không trả một muối "mặc định"', async () => {
    await expect(muoiCuaUser('')).rejects.toBeInstanceOf(LoiKet);
  });

  it('⭐⭐⭐ VECTOR CHÉP TAY — đổi cách suy muối là làm MỌI két cũ không mở được nữa', async () => {
    /*
     * ⚠⚠ ĐÂY LÀ MỘT CỬA MỘT CHIỀU KHÔNG CÓ TÊN. `TIEN_TO_MUOI` không phải trục phiên bản
     * nên nó không nằm trong `config/phien_ban.ts`, và nó chỉ là một chuỗi hằng trông vô
     * hại giữa một tệp — nhưng đổi nó (hoặc đổi thuật toán băm, hoặc đổi số byte cắt) làm
     * MỌI két đã ghi trở nên không mở được, vĩnh viễn, và **không một bài test nào khác
     * trong repo đỏ** vì tất cả đều dựng muối rồi dùng lại chính nó.
     * ⇒ Vector chép tay là thứ duy nhất bắt được. Bài này đỏ ⇒ DỪNG: hoặc là hoàn nguyên,
     * hoặc là chấp nhận rằng người dùng cũ mất sổ và phải có đường di trú trước đã.
     * (Sinh bằng: SHA-256('delphi-pfm-muoi:' + user_id), lấy 16 byte đầu.)
     */
    expect([...await muoiCuaUser(U1)]).toEqual(
      [189, 38, 243, 18, 188, 78, 112, 214, 170, 169, 1, 121, 152, 188, 246, 221]);
  });
});

describe('§II — chìa: rèn, cất, đọc lại', () => {
  it('⭐⭐ cất được CryptoKey vào kho và đọc lại dùng được, mà KHÔNG trích được ra byte',
    async () => {
      /*
       * Đây là lý do `suyKhoa` tạo khoá `extractable = false`: structured clone chép được
       * một khoá không-trích-được, còn JavaScript thì không đọc nổi byte của nó. Chìa sống
       * qua các phiên mà không có lúc nào nằm dưới dạng byte trong bộ nhớ ta kiểm soát.
       */
      const kho = new KhoTrongBoNho();
      const { khoa } = await taoVaLuuChia(kho, U1, LUC);
      expect(khoa.extractable, 'khoá PHẢI không trích được').toBe(false);
      await expect(crypto.subtle.exportKey('raw', khoa)).rejects.toThrow();

      const doc = await docChia(kho);
      expect(doc).not.toBeNull();
      // Dùng được thật: đóng một lát bằng chìa đọc lại từ kho.
      const lat = await dongLat('2026-09', RUOT, doc!);
      expect(await moLat(lat, doc!)).toEqual(RUOT);
    });

  it('kho chưa có chìa ⇒ docChia trả null, không ném', async () => {
    expect(await docChia(new KhoTrongBoNho())).toBeNull();
  });

  it('⭐ mã trả ra MỘT LẦN và KHÔNG được cất cạnh chìa', async () => {
    /*
     * Cất mã cạnh chìa là xoá sạch ý nghĩa của việc có mã: ai mở được máy thì đọc được
     * cả hai. Bài này quét toàn bộ ngăn `meta` để chắc rằng mã không lọt vào đâu.
     */
    const kho = new KhoTrongBoNho();
    const { ma } = await taoVaLuuChia(kho, U1, LUC);
    const tat = await kho.liet<unknown>('meta');
    const chuoi = JSON.stringify(tat.map((b) => ({ id: b.id, d: b.d })));
    expect(chuoi).not.toContain(ma);
    expect(tat.map((b) => b.id)).toEqual([ID_KHOA_KET]);
  });
});

describe('§III — ⭐⭐⭐ KHÔI PHỤC TRÊN MÁY MỚI (thứ R12 mở khoá)', () => {
  let ma = '';
  let latByte: Uint8Array = new Uint8Array();

  beforeAll(async () => {
    // MÁY CŨ: tạo mã, khoá sổ, gửi phong bì lên server.
    const cu = new KhoTrongBoNho();
    const le = await taoVaLuuChia(cu, U1, LUC);
    ma = le.ma;
    latByte = raByte(await dongLat('2026-09', RUOT, le.khoa));
  }, 60_000);

  it('cùng user + đúng mã ⇒ mở được sổ đã khoá bởi MÁY KHÁC', async () => {
    const moi = new KhoTrongBoNho();                 // máy mới, kho trống trơn
    const khoa = await khoiPhucChia(moi, U1, ma, LUC);
    expect(await moLat(tuByte('2026-09', latByte), khoa)).toEqual(RUOT);
  }, 60_000);

  it('⭐ mã người dùng gõ LỘN XỘN vẫn khôi phục được (chuanMa chạy trước khi suy khoá)',
    async () => {
      /*
       * Người gõ tay sẽ có dấu cách, chữ thường, và `O`/`I` gõ nhầm từ `0`/`1`. Không gọi
       * `chuanMa` là biến một cú gõ hợp lý thành "mã sai" không giải thích được — và người
       * dùng thì không có đường nào khác để vào lại sổ của chính họ.
       */
      const bua = `  ${ma.toLowerCase().replace(/0/g, 'o').replace(/1/g, 'l')}  `;
      const khoa = await khoiPhucChia(new KhoTrongBoNho(), U1, bua, LUC);
      expect(await moLat(tuByte('2026-09', latByte), khoa)).toEqual(RUOT);
    }, 60_000);

  it('⭐⭐ SAI mã ⇒ KHÔNG mở được (không có oracle nào rẻ hơn PBKDF2 để dò)', async () => {
    const khoa = await khoiPhucChia(new KhoTrongBoNho(), U1, 'ZZZZZZZZZZZZ', LUC);
    await expect(moLat(tuByte('2026-09', latByte), khoa)).rejects.toThrow();
  }, 60_000);

  it('⭐⭐ ĐÚNG mã nhưng KHÁC user ⇒ KHÔNG mở được (muối tách không gian khoá)', async () => {
    const khoa = await khoiPhucChia(new KhoTrongBoNho(), U2, ma, LUC);
    await expect(moLat(tuByte('2026-09', latByte), khoa)).rejects.toThrow();
  }, 60_000);
});

describe('§IV — phong bì dây [1B dinhDang][12B iv][goi]', () => {
  const latGia = {
    lat: '2026-09',
    dinhDang: DINH_DANG_KET,
    iv: new Uint8Array(DAI_IV).fill(7),
    goi: new Uint8Array([1, 2, 3, 4]),
  };

  it('⭐ byte đầu là ĐỊNH DẠNG — phong bì tự mô tả, đọc được trước cả khi giải mã', () => {
    const b = raByte(latGia);
    expect(b[0]).toBe(DINH_DANG_KET);
    expect(b).toHaveLength(1 + DAI_IV + 4);
  });

  it('ra rồi vào lại ⇒ y nguyên', () => {
    const lai = tuByte('2026-09', raByte(latGia));
    expect(lai.dinhDang).toBe(latGia.dinhDang);
    expect([...lai.iv]).toEqual([...latGia.iv]);
    expect([...lai.goi]).toEqual([...latGia.goi]);
  });

  it('⭐ `lat` KHÔNG nằm trong phong bì — nó là tham số truy vấn, một nguồn thôi', () => {
    const b = raByte({ ...latGia, lat: '2026-01' });
    // Cùng ruột, khác `lat` ⇒ byte PHẢI giống hệt.
    expect([...b]).toEqual([...raByte(latGia)]);
  });

  it('⭐ phong bì CỤT ⇒ ném sớm, nói rõ — không đẩy sang moLat rồi ra lỗi mật mã chung chung',
    () => {
      expect(() => tuByte('2026-09', new Uint8Array(DAI_IV))).toThrow(/cụt/);
      expect(() => tuByte('2026-09', new Uint8Array(1 + DAI_IV)), 'có IV nhưng rỗng ruột')
        .toThrow(/cụt/);
    });

  it('IV sai độ dài ⇒ ném khi ra dây', () => {
    expect(() => raByte({ ...latGia, iv: new Uint8Array(5) })).toThrow(/IV phải/);
  });

  it('latQuaLon so với TRẦN THẬT của server, không phải một số gõ tay', () => {
    expect(latQuaLon(new Uint8Array(PFM.BLOB_MAX))).toBe(false);
    expect(latQuaLon(new Uint8Array(PFM.BLOB_MAX + 1))).toBe(true);
  });
});

describe('§V — catChia ghi đúng ngăn/khoá', () => {
  it('ghi vào `meta` dưới ID_KHOA_KET', async () => {
    const kho = new KhoTrongBoNho();
    const khoa = await crypto.subtle.generateKey(
      { name: 'AES-GCM', length: 256 }, false, ['encrypt', 'decrypt']);
    await catChia(kho, khoa, LUC);
    expect(await kho.doc('meta', ID_KHOA_KET)).not.toBeNull();
  }, 30_000);
});
