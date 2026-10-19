/**
 * PFM — KÉT SAO LƯU (K1–K3 · K8 · K10). D198.
 *
 *   §I   HAI LOẠI LÁT — phủ kín hai chiều, và `outbox` cố ý ở ngoài.
 *   §II  MÃ KHÔI PHỤC — entropy, ký tự dễ nhầm, chuẩn hoá.
 *   §III ĐÓNG/MỞ — vòng tròn khép kín, IV không lặp, sai mã hỏng TO.
 *   §IV  HOÀ GIẢI (K8) — bốn luật, và luật "vắng mặt ≠ xoá" là luật đắt nhất.
 */
import { describe, expect, it } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import {
  KIEU_LAT, LAT_SONG, nganCuaLat, taoMaKhoiPhuc, mocMa, chuanMa, suyKhoa,
  dongLat, moLat, gomLat, kiemTran, hoaGiai, LoiKet,
  BANG_MA, DAI_MA, DAI_MUOI, DAI_IV, DINH_DANG_KET, SO_VONG_PBKDF2,
  type RuotLat,
} from '../src/pfm/ket.js';
import { NGAN, type BanGhi } from '../src/pfm/kho.js';
import { PFM } from '@config/pfm';

const MUOI = new Uint8Array(DAI_MUOI).fill(7);
const MA = 'ABCDEFGHJKMN'.slice(0, DAI_MA);
const khoa = () => suyKhoa(MA, MUOI);
const b = (id: string, suaLuc: string, thang = '2026-08', d: unknown = { x: 1 }):
BanGhi<unknown> => ({ id, thang, suaLuc, d });

/* ══════════════════════════════════════════════════════════════════════════════
 * §I — HAI LOẠI LÁT
 * ════════════════════════════════════════════════════════════════════════════ */

describe('§I — hai loại lát (K10)', () => {
  it('⭐ MỌI ngăn của kho phải được PHÂN LOẠI — không ngăn nào rơi ra ngoài im lặng', () => {
    /*
     * Phủ kín hai chiều: thêm một ngăn vào `kho.ts` mà quên quyết định nó vào lát nào
     * thì bài này đỏ NGAY, thay vì dữ liệu ngăn đó lặng lẽ không bao giờ được sao lưu —
     * và người ta chỉ phát hiện vào đúng ngày cần khôi phục.
     */
    for (const n of NGAN) {
      expect(KIEU_LAT[n], `ngăn "${n}" chưa được phân loại lát`).toBeDefined();
    }
    expect(Object.keys(KIEU_LAT).sort()).toEqual([...NGAN].sort());
  });

  it('⭐ `outbox` CỐ Ý không vào két — sao lưu hàng đợi là gửi lại thứ đã gửi', () => {
    // Khôi phục một outbox cũ = bắn lại toàn bộ số đo đã bắn ⇒ nhân đôi dữ liệu đo,
    // im lặng. Nó là hàng đợi, không phải dữ liệu.
    expect(KIEU_LAT.outbox).toBe('khong');
    expect(nganCuaLat('thang')).not.toContain('outbox');
    expect(nganCuaLat('song')).not.toContain('outbox');
  });

  it('⭐ HŨ nằm ở lát SỐNG, không ở lát tháng', () => {
    /*
     * Một cái hũ sống xuyên tháng. Xếp nó vào lát của tháng TẠO thì sửa hũ vào tháng 12
     * sẽ làm bẩn lát tháng 8 ĐÃ NIÊM PHONG — "đóng băng" thành lời hứa suông và ta mất
     * đúng phần tiết kiệm 55–60% mà D146 đo được.
     */
    expect(KIEU_LAT.hu).toBe('song');
    expect(KIEU_LAT.mau_lap).toBe('song');
    expect(KIEU_LAT.khoan, 'khoản CÓ ngày ⇒ đóng băng được').toBe('thang');
    expect(KIEU_LAT.nhip).toBe('thang');
  });

  it('LUẬT NẾU-THÌ (GĐ5/GĐ6) cũng ở lát SỐNG — sống xuyên tháng như hũ', () => {
    expect(KIEU_LAT.luat).toBe('song');
    expect(nganCuaLat('song')).toContain('luat');
  });

  it('gom lát tháng chỉ lấy đúng tháng đó; lát sống lấy hết', () => {
    const tat = {
      khoan: [b('k1', 'T1', '2026-08'), b('k2', 'T2', '2026-07')],
      hu: [b('h1', 'T1', '2026-05'), b('h2', 'T2', '2026-08')],
    };
    expect(gomLat('thang', tat, '2026-08').khoan!.map((x) => x.id)).toEqual(['k1']);
    expect(gomLat('song', tat).hu!.map((x) => x.id)).toEqual(['h1', 'h2']);
    expect(gomLat('song', tat).khoan, 'lát sống không ôm khoản').toBeUndefined();
  });

  it('⭐ gom lát MANG THEO BIA MỘ — đây là chỗ duy nhất cần chúng', () => {
    // Không mang bia mộ đi thì khôi phục trên máy khác sẽ thấy bản ghi đã xoá SỐNG LẠI.
    const tat = { khoan: [{ ...b('k1', 'T9'), daXoa: true as const }] };
    expect(gomLat('thang', tat, '2026-08').khoan).toHaveLength(1);
    expect(gomLat('thang', tat, '2026-08').khoan![0]!.daXoa).toBe(true);
  });

  it('lát tháng mà không nói tháng nào là LỖI, không phải "lấy hết"', () => {
    expect(() => gomLat('thang', {})).toThrow(LoiKet);
  });
});

/* ══════════════════════════════════════════════════════════════════════════════
 * §II — MÃ KHÔI PHỤC
 * ════════════════════════════════════════════════════════════════════════════ */

describe('§II — mã khôi phục', () => {
  it('⭐⭐ độ dài và số vòng ĐỌC TỪ CONFIG — không có bản khai thứ hai (D61/A8.9)', () => {
    /*
     * Bản đầu của `ket.ts` tự khai `DAI_MA = 24` + `210_000` vòng trong khi
     * `config/pfm.ts` đã có `MA_KHOI_PHUC_KY_TU = 12` + `PBKDF2_VONG = 600_000`. Hai
     * bản, ĐÃ LỆCH NGAY TỪ LÚC SINH — và cú lệch này không hỏng to: nó chỉ làm mã sinh
     * ở một chỗ không mở được két đóng ở chỗ kia, tức MẤT SỔ, im lặng, phát hiện vào
     * đúng ngày cần khôi phục. `vite.config.ts` dựng alias `@config` đúng để tránh nó.
     */
    expect(DAI_MA).toBe(PFM.MA_KHOI_PHUC_KY_TU);
    expect(SO_VONG_PBKDF2).toBe(PFM.PBKDF2_VONG);
  });

  it('⭐ entropy đủ, và bảng chữ BỎ ký tự dễ nhầm', () => {
    /*
     * Người ta CHÉP TAY mã này lên giấy. Một chữ O đọc thành 0 là mất sổ vĩnh viễn, và
     * lỗi đó chỉ lộ vào đúng ngày cần khôi phục — nên độ dài ngắn (chép được) đáng giá
     * ngang entropy, miễn còn đủ: 60 bit qua PBKDF2 600k tốn ~1,2 triệu phép băm mỗi
     * lần đoán ⇒ quét cạn 2^60 mất hàng triệu năm-GPU.
     */
    expect(BANG_MA.length).toBe(32);
    expect(new Set(BANG_MA).size, 'không ký tự nào lặp').toBe(32);
    for (const c of 'ILOU') expect(BANG_MA, `bảng còn ký tự dễ nhầm "${c}"`).not.toContain(c);
    expect(DAI_MA * 5, 'bit entropy').toBeGreaterThanOrEqual(60);
  });

  it('mã sinh ra đúng độ dài và chỉ dùng ký tự trong bảng', () => {
    for (let i = 0; i < 20; i++) {
      const m = taoMaKhoiPhuc();
      expect(m).toHaveLength(DAI_MA);
      for (const c of m) expect(BANG_MA).toContain(c);
    }
  });

  it('hai lần sinh ra hai mã khác nhau', () => {
    expect(taoMaKhoiPhuc()).not.toBe(taoMaKhoiPhuc());
  });

  it('mọi giá trị byte đều ánh xạ được (không lệch phân phối)', () => {
    // 256 chia hết 32 nên phép `% 32` không thiên lệch. Đổi bảng sang độ dài không chia
    // hết 256 thì phải viết lại bằng rejection sampling — bài này canh đúng tiền đề đó.
    expect(256 % BANG_MA.length).toBe(0);
    const day = taoMaKhoiPhuc(() => Uint8Array.from({ length: DAI_MA }, (_, i) => i * 8));
    expect(new Set(day).size).toBeGreaterThan(1);
  });

  it('⭐⭐ CHUẨN HOÁ: gạch nối, chữ thường, và ba cặp nhầm lẫn kinh điển', () => {
    /*
     * Thiếu bước này là app báo "sai mã" cho một cái mã ĐÚNG — user chép có gạch nối,
     * gõ lại chữ thường, gõ O thay 0. Đó là bug giết người dùng ở đúng khoảnh khắc họ
     * hoảng nhất.
     */
    const m = MA;
    expect(chuanMa(mocMa(m)), 'có gạch nối').toBe(m);
    expect(chuanMa(m.toLowerCase()), 'chữ thường').toBe(m);
    expect(chuanMa(`  ${mocMa(m).replace(/-/g, ' ')}  `), 'khoảng trắng').toBe(m);
    // O→0, I/L→1: ba ký tự này KHÔNG có trong bảng nên quy đổi không va vào mã hợp lệ nào
    const duoi = '0'.repeat(DAI_MA - 1);
    expect(chuanMa(`O${duoi}`)).toBe(`0${duoi}`);
    expect(chuanMa(`I${duoi}`)).toBe(`1${duoi}`);
    expect(chuanMa(`L${duoi}`)).toBe(`1${duoi}`);
  });

  it('mã sai độ dài / ký tự lạ bị chặn NGAY, không đem đi suy khoá', () => {
    expect(() => chuanMa('0123')).toThrow(LoiKet);
    expect(() => chuanMa('$'.repeat(DAI_MA))).toThrow(LoiKet);   // lọc sạch ⇒ rỗng ⇒ sai dài
    expect(() => chuanMa('0'.repeat(DAI_MA + 1))).toThrow(LoiKet);
  });

  it('mọi mã sinh ra đều tự chuẩn hoá về CHÍNH NÓ (vòng tròn khép kín)', () => {
    for (let i = 0; i < 20; i++) {
      const m = taoMaKhoiPhuc();
      expect(chuanMa(mocMa(m))).toBe(m);
    }
  });
});

/* ══════════════════════════════════════════════════════════════════════════════
 * §III — ĐÓNG / MỞ
 * ════════════════════════════════════════════════════════════════════════════ */

describe('§III — đóng và mở két', () => {
  const ruot: RuotLat = {
    khoan: [b('k1', 'T1', '2026-08', { soTien: 50_000, ghiChu: 'Cà phê với Hường' })],
  };

  it('đóng rồi mở ra ĐÚNG nội dung cũ', async () => {
    const k = await khoa();
    const lat = await dongLat('2026-08', ruot, k);
    expect(lat.lat).toBe('2026-08');
    expect(lat.dinhDang).toBe(DINH_DANG_KET);
    expect(lat.iv).toHaveLength(DAI_IV);
    expect(await moLat(lat, k)).toEqual(ruot);
  });

  it('⭐ gói KHÔNG chứa bản rõ — chữ tự do lẫn số tiền đều không đọc được', async () => {
    const lat = await dongLat('2026-08', ruot, await khoa());
    const tho = new TextDecoder('utf-8', { fatal: false }).decode(lat.goi);
    expect(tho).not.toContain('Hường');
    expect(tho).not.toContain('50000');
    expect(tho).not.toContain('soTien');
  });

  it('⭐⭐ IV KHÔNG BAO GIỜ LẶP — hai lần đóng CÙNG nội dung ra hai gói khác nhau', async () => {
    /*
     * Với AES-GCM, lặp IV trên cùng một khoá không chỉ làm lộ hiệu XOR của hai bản rõ mà
     * còn làm lộ khoá xác thực ⇒ kẻ tấn công GIẢ MẠO được két. Đây là cách hỏng thầm
     * lặng nhất của GCM: mọi thứ vẫn chạy, không ai thấy gì.
     */
    const k = await khoa();
    const a = await dongLat('2026-08', ruot, k);
    const c = await dongLat('2026-08', ruot, k);
    expect(Buffer.from(a.iv).toString('hex')).not.toBe(Buffer.from(c.iv).toString('hex'));
    expect(Buffer.from(a.goi).toString('hex')).not.toBe(Buffer.from(c.goi).toString('hex'));
    // và cả hai vẫn mở ra cùng một nội dung
    expect(await moLat(a, k)).toEqual(await moLat(c, k));
  });

  it('⭐ SAI MÃ ⇒ hỏng TO, không bao giờ trả rác hay `{}`', async () => {
    // "Két rỗng" và "sai chìa" là hai chuyện khác hẳn — gộp chúng khiến user tưởng mình
    // đã mất sổ.
    const lat = await dongLat('2026-08', ruot, await khoa());
    const khoaKhac = await suyKhoa('Z'.repeat(DAI_MA), MUOI);
    await expect(moLat(lat, khoaKhac)).rejects.toThrow(LoiKet);
  });

  it('⭐ SỬA MỘT BYTE của gói ⇒ mở không được (thẻ xác thực GCM làm việc)', async () => {
    const k = await khoa();
    const lat = await dongLat('2026-08', ruot, k);
    const hong = { ...lat, goi: Uint8Array.from(lat.goi) };
    hong.goi[0] = hong.goi[0]! ^ 0xff;
    await expect(moLat(hong, k)).rejects.toThrow(LoiKet);
  });

  it('MUỐI khác ⇒ khoá khác, dù cùng một mã', async () => {
    const lat = await dongLat('2026-08', ruot, await khoa());
    const muoiKhac = await suyKhoa(MA, new Uint8Array(DAI_MUOI).fill(9));
    await expect(moLat(lat, muoiKhac)).rejects.toThrow(LoiKet);
  });

  it('định dạng lạ ⇒ nói thẳng, không đoán', async () => {
    const lat = await dongLat('2026-08', ruot, await khoa());
    await expect(moLat({ ...lat, dinhDang: 99 }, await khoa()))
      .rejects.toThrow(/[Đđ]ịnh dạng/);
  });

  it('muối sai độ dài bị chặn ở cửa', async () => {
    await expect(suyKhoa(MA, new Uint8Array(4)))
      .rejects.toThrow(LoiKet);
  });

  it('⭐ NÉN TRƯỚC MÃ HOÁ — nội dung lặp lại phải co lại rõ rệt', async () => {
    /*
     * Ciphertext là dãy byte ngẫu nhiên nên KHÔNG nén được (D146 đo: nén lại ciphertext
     * còn phình 0,1%). Nếu ai đảo thứ tự thành mã-hoá-trước thì gói của 400 khoản gần
     * giống nhau sẽ KHÔNG co lại — bài này bắt đúng cú đảo đó.
     */
    const nhieu: RuotLat = {
      khoan: Array.from({ length: 400 }, (_, i) =>
        b(`k${i}`, 'T1', '2026-08', { soTien: 50_000, ghiChu: 'Cà phê sáng như mọi hôm' })),
    };
    const tho = new TextEncoder().encode(JSON.stringify(nhieu)).length;
    const lat = await dongLat('2026-08', nhieu, await khoa());
    expect(tho).toBeGreaterThan(30_000);
    expect(lat.goi.length, 'gói phải nhỏ hơn 1/5 bản thô').toBeLessThan(tho / 5);
  });

  it('⭐ một lát tháng THẬT nằm xa trần 32 KB (biên D146 ~6 lần)', async () => {
    // 5 khoản/ngày × 31 ngày, 80% có ghi chú — đúng hồ sơ "dày nhất" D146 đã đo.
    const day: RuotLat = {
      khoan: Array.from({ length: 155 }, (_, i) => b(`k${i}`, `T${i}`, '2026-08', {
        ngay: `2026-08-${String((i % 31) + 1).padStart(2, '0')}`,
        soTien: 20_000 + i * 137, chieu: 'chi', nhan: 'an_uong', huId: null,
        cachGhi: 'tay', viSale: null,
        ...(i % 5 ? { ghiChu: `Khoản số ${i} mua ở quán quen gần nhà` } : {}),
      })),
    };
    const lat = await dongLat('2026-08', day, await khoa());
    expect(() => kiemTran(lat, PFM.BLOB_MAX)).not.toThrow();
    expect(lat.goi.length, 'còn xa trần').toBeLessThan(PFM.BLOB_MAX / 2);
  });

  it('quá trần thì NÓI RA kèm tên lát, không lặng lẽ thôi gửi', async () => {
    // Bom hẹn giờ của bản 64 KB cũ nổ IM LẶNG (sao lưu lặng lẽ thôi gửi được) — D146.
    const lat = await dongLat('2026-08', ruot, await khoa());
    expect(() => kiemTran(lat, 8)).toThrow(/2026-08/);
  });

  it('lát SỐNG dùng chung đường đóng/mở với lát tháng', async () => {
    const k = await khoa();
    const r: RuotLat = { hu: [b('h1', 'T1', '2026-05', { ten: 'Quỹ dự phòng' })] };
    expect(await moLat(await dongLat(LAT_SONG, r, k), k)).toEqual(r);
  });

  it('số vòng PBKDF2 không bị hạ xuống mức trang trí', () => {
    // Entropy 120 bit của mã mới là hàng rào chính, nhưng đây là phòng thủ chiều sâu và
    // hạ nó xuống vài nghìn là bỏ luôn lớp đó.
    expect(SO_VONG_PBKDF2).toBeGreaterThanOrEqual(100_000);
  });
});

/* ══════════════════════════════════════════════════════════════════════════════
 * §IV — HOÀ GIẢI (K8)
 * ════════════════════════════════════════════════════════════════════════════ */

describe('§IV — hoà giải khi khôi phục (K8)', () => {
  it('chỉ có trong KÉT ⇒ thêm', () => {
    const kq = hoaGiai([], [b('k1', 'T1')]);
    expect(kq.them).toBe(1);
    expect(kq.ra.map((x) => x.id)).toEqual(['k1']);
  });

  it('⭐⭐ chỉ có ở MÁY ⇒ GIỮ — vắng mặt trong két KHÔNG PHẢI lệnh xoá', () => {
    /*
     * Luật đắt nhất của cả file. Két là ẢNH CHỤP của một khoảnh khắc; coi "không có
     * trong ảnh" là "đã bị xoá" thì khôi phục một bản sao lưu tháng trước sẽ XOÁ SẠCH
     * mọi thứ ghi từ đó tới nay — mất dữ liệu thật, im lặng, không hoàn tác được.
     * Cú xoá chỉ lan được qua BIA MỘ.
     */
    const kq = hoaGiai([b('moi', 'T9'), b('cu', 'T1')], [b('cu', 'T1')]);
    expect(kq.ra.map((x) => x.id).sort()).toEqual(['cu', 'moi']);
    expect(kq.them).toBe(0);
    expect(kq.thay).toBe(0);
  });

  it('có ở cả hai ⇒ bản MỚI HƠN thắng, cả hai chiều', () => {
    const cuHon = hoaGiai([b('k', 'T5', '2026-08', { v: 'may' })],
      [b('k', 'T1', '2026-08', { v: 'ket' })]);
    expect(cuHon.ra[0]!.d).toEqual({ v: 'may' });
    expect(cuHon.giu).toBe(1);

    const moiHon = hoaGiai([b('k', 'T1', '2026-08', { v: 'may' })],
      [b('k', 'T5', '2026-08', { v: 'ket' })]);
    expect(moiHon.ra[0]!.d).toEqual({ v: 'ket' });
    expect(moiHon.thay).toBe(1);
  });

  it('⭐ BIA MỘ mới hơn ⇒ cú xoá LAN được sang máy này', () => {
    const kq = hoaGiai([b('k', 'T1')], [{ ...b('k', 'T9'), daXoa: true as const }]);
    expect(kq.ra[0]!.daXoa).toBe(true);
    expect(kq.thay).toBe(1);
  });

  it('⭐ SỬA mới hơn thắng BIA MỘ cũ — user xoá máy A rồi đổi ý sửa ở máy B', () => {
    const kq = hoaGiai([b('k', 'T9', '2026-08', { v: 'sua lai' })],
      [{ ...b('k', 'T1'), daXoa: true as const }]);
    expect(kq.ra[0]!.daXoa).toBeUndefined();
    expect(kq.ra[0]!.d).toEqual({ v: 'sua lai' });
  });

  it('⭐ TRÙNG mốc mà khác nội dung ⇒ giữ bản ở máy VÀ BÁO RA', () => {
    // Không âm thầm chọn hộ: chỉ user biết bản nào thật.
    const kq = hoaGiai([b('k', 'T5', '2026-08', { v: 'may' })],
      [b('k', 'T5', '2026-08', { v: 'ket' })]);
    expect(kq.ra[0]!.d, 'bản đang có thắng').toEqual({ v: 'may' });
    expect(kq.can).toEqual(['k']);
  });

  it('trùng mốc VÀ trùng nội dung thì KHÔNG phải cấn (đừng doạ user vô cớ)', () => {
    const kq = hoaGiai([b('k', 'T5')], [b('k', 'T5')]);
    expect(kq.can).toEqual([]);
    expect(kq.giu).toBe(1);
  });

  it('hàm THUẦN — không đụng hai mảng đầu vào', () => {
    const may = [b('a', 'T1')]; const ket = [b('b', 'T2')];
    hoaGiai(may, ket);
    expect(may).toHaveLength(1);
    expect(ket).toHaveLength(1);
  });

  it('⭐ khôi phục một két CŨ lên sổ đang dùng: không mất một dòng nào', () => {
    // Kịch bản thật: mất máy, cài lại app, ghi vài khoản rồi mới nhớ ra là có sao lưu.
    const dangCo = [b('moi1', 'T90'), b('moi2', 'T91'), b('chung', 'T92')];
    const tuKet = [b('cu1', 'T10'), b('cu2', 'T11'), b('chung', 'T12')];
    const kq = hoaGiai(dangCo, tuKet);
    expect(kq.ra).toHaveLength(5);
    expect(kq.ra.find((x) => x.id === 'chung')!.suaLuc, 'bản mới hơn ở máy thắng')
      .toBe('T92');
    expect(kq).toMatchObject({ them: 2, thay: 0, giu: 1, can: [] });
  });
});

/* ══════════════════════════════════════════════════════════════════════════════
 * §V — QUÉT MÃ NGUỒN
 * ════════════════════════════════════════════════════════════════════════════ */

describe('§V — ràng buộc cấu trúc', () => {
  const nguon = fs.readFileSync(path.resolve(__dirname, '../src/pfm/ket.ts'), 'utf8');
  const ma = nguon.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '');

  it('⭐ NÉN TRƯỚC, MÃ HOÁ SAU — thứ tự bất khả đảo', () => {
    const iNen = ma.indexOf('await gzip(');
    const iMa = ma.indexOf('crypto.subtle.encrypt');
    expect(iNen).toBeGreaterThan(0);
    expect(iMa, 'mã hoá phải nằm SAU nén').toBeGreaterThan(iNen);
  });

  it('không tự `new Date()` — mốc thời gian do người gọi đưa', () => {
    // Khôi phục một lát tháng cũ mà tự dán mốc hôm nay là hỏng đúng phép hoà giải K8.
    expect(ma).not.toContain('new Date(');
    expect(ma).not.toContain('Date.now(');
  });

  it('⭐ khoá KHÔNG TRÍCH XUẤT ĐƯỢC — canh bằng HÀNH VI, không bằng chuỗi', async () => {
    /*
     * Bản đầu của bài này canh `ma.toContain('false,')` — một phép rỗng: chuỗi đó xuất
     * hiện ở cả chục chỗ vô can, nên nó xanh dù khoá có trích xuất được. Cách canh đúng
     * là HỎI THẲNG Web Crypto: khoá khai `extractable = false` thì `exportKey` phải ném.
     * Vì sao đáng canh: một khoá trích xuất được là một khoá có thể vô tình bị log, bị
     * ghi vào kho, hoặc bị gửi kèm gói lên server — và lúc đó lời hứa "server không đọc
     * được" thành câu nói dối mà không ai thấy.
     */
    const k = await suyKhoa(MA, MUOI);
    expect(k.extractable).toBe(false);
    await expect(crypto.subtle.exportKey('raw', k)).rejects.toThrow();
    expect(ma, 'và không có đường trích xuất nào trong file').not.toContain('exportKey');
  });

  it('không có `fetch` — két là hàm thuần, việc gửi là của `dong_bo/`', () => {
    expect(ma).not.toContain('fetch(');
  });
});
