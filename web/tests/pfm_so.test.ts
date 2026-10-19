/**
 * PFM — SỔ TÀI CHÍNH (nhóm B). D195.
 *
 *   §I   KHÔNG CÓ CỬA RA — sổ là vùng riêng tư tuyệt đối (P2 🔒). Quét mã nguồn.
 *   §II  GHI/SỬA — hai ô bắt buộc, tiền là số nguyên, và PROVENANCE tụt khi sửa số.
 *   §III TÌM + CỘNG.
 *   §IV  DÁN SMS (B5) — bản nháp, không bao giờ ghi thẳng.
 */
import { describe, expect, it } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import {
  taoKhoan, suaKhoan, khoanRaBanGhi, locKhoanSo, congSo, tuMauLap,
  bocSms, xacNhanSms, tongGopVaoHu, bangGopHu, LoiSo, NHAN_KHOAN, CACH_GHI, CAT_GHI_CHU,
  type Khoan, type MauLap,
} from '../src/pfm/so.js';
import { LOAI_HU } from '../src/pfm/hu.js';

const LUC = '2026-08-31T10:00:00.000Z';
const k = (v: Partial<Parameters<typeof taoKhoan>[0]> = {}, id = 'k1'): Khoan =>
  taoKhoan({ ngay: '2026-08-15', soTien: 50_000, ...v }, LUC, id);

/* ══════════════════════════════════════════════════════════════════════════════
 * §I — SỔ KHÔNG CÓ CỬA RA
 * ════════════════════════════════════════════════════════════════════════════ */

describe('§I — sổ là vùng riêng tư tuyệt đối (P2 🔒)', () => {
  const nguon = fs.readFileSync(path.resolve(__dirname, '../src/pfm/so.ts'), 'utf8');
  const ma = nguon.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '');

  it('⭐ KHÔNG import sổ đăng ký đặc trưng — sổ không biết mã `hv_*` nào tồn tại', () => {
    /*
     * `hu.ts` có cửa ra vì một cái hũ mang nhãn Intent được phép lên server. Một DÒNG SỔ
     * thì không: nó là số tiền + chữ tự do + giờ giấc. Thứ rời máy từ vùng này chỉ có
     * số liệu GỘP theo kỳ (`dac_trung/`) và két đã khoá (`ket/`). Một `import` từ
     * registry vào đây là mở một cửa mà kiến trúc không có chỗ cho nó — và nó sẽ được
     * mở "cho tiện", không phải bằng một quyết định.
     */
    expect(ma).not.toContain('pfm_dac_trung');
    expect(ma).not.toContain('SO_DANG_KY');
  });

  it('không có `fetch`/`XMLHttpRequest` — ghi khoản phải xong ở chế độ máy bay (B8)', () => {
    expect(ma).not.toContain('fetch(');
    expect(ma).not.toContain('XMLHttpRequest');
  });

  it('không cất chuỗi SMS gốc (nó chứa số dư + số tài khoản)', () => {
    // Cất lại là để nó trôi vào két rồi lên server — dữ liệu ta không nên có, kể cả ở
    // dạng đã mã hoá.
    expect(Object.keys(k())).not.toContain('smsGoc');
    const n = bocSms('SD TK 0123456789 -50,000VND. So du 1,234,567VND');
    expect(JSON.stringify(n)).not.toContain('0123456789');
    expect(JSON.stringify(n), 'số DƯ không được lọt vào bản nháp').not.toContain('1234567');
  });
});

/* ══════════════════════════════════════════════════════════════════════════════
 * §II — GHI / SỬA
 * ════════════════════════════════════════════════════════════════════════════ */

describe('§II — ghi & sửa', () => {
  it('⭐ ĐÚNG HAI Ô BẮT BUỘC: ngày và số tiền', () => {
    // Cùng lý lẽ founder bác ở D193: bắt phân loại mới cho ghi là dựng cổng thu phí
    // bằng ma sát của user để lấy nhãn cho dataset (P19/P16).
    const x = k();
    expect(x.nhan).toBeNull();
    expect(x.huId).toBeNull();
    expect(x.viSale, 'chưa hỏi ⇒ null, KHÔNG phải false (P7)').toBeNull();
    expect(x.chieu, 'mặc định là CHI — thứ user ghi nhiều nhất').toBe('chi');
    expect(x.cachGhi).toBe('tay');
  });

  it('tiền phải là SỐ NGUYÊN dương (C5 — float cho tiền là nợ không trả được)', () => {
    expect(() => k({ soTien: 50_000.5 })).toThrow(LoiSo);
    expect(() => k({ soTien: 0 })).toThrow(LoiSo);
    expect(() => k({ soTien: -1000 })).toThrow(LoiSo);
  });

  it('ngày phải đúng dạng và có thật trên lịch tháng', () => {
    expect(() => k({ ngay: '2026-8-15' })).toThrow(LoiSo);
    expect(() => k({ ngay: '2026-13-01' })).toThrow(LoiSo);
    expect(() => k({ ngay: '2026-08-32' })).toThrow(LoiSo);
  });

  it('nhãn sai bị chặn; nhãn TRỐNG thì không', () => {
    expect(() => k({ nhan: 'bia_dat' as never })).toThrow(LoiSo);
    expect(k({ nhan: null }).nhan).toBeNull();
    expect(k({ nhan: 'an_uong' }).nhan).toBe('an_uong');
  });

  it('miền nhãn khoản DÙNG CHUNG với loại hũ (một nguồn — D61)', () => {
    // Hai bản khai là "hũ Ăn uống không nhận khoản Ăn uống", và nó im lặng.
    expect([...NHAN_KHOAN]).toEqual([...LOAI_HU]);
  });

  it('ghi chú bị cắt, không bị từ chối', () => {
    const x = k({ ghiChu: 'a'.repeat(500) });
    expect(x.ghiChu!.length).toBe(CAT_GHI_CHU);
  });

  it('⭐⭐ SỬA SỐ TIỀN của dòng dán-SMS ⇒ provenance TỤT VỀ `tay`', () => {
    /*
     * Cả giá trị của cờ `dan_sms` nằm ở câu "con số này do MÁY đọc ra". User sửa số là
     * câu đó hết đúng. Giữ nguyên cờ là để một dòng gõ tay đội lốt dòng máy đọc, và nó
     * làm bẩn đúng phép calibration mà cờ này sinh ra để phục vụ.
     */
    const x = k({ cachGhi: 'dan_sms' });
    expect(suaKhoan(x, { soTien: 60_000 }, LUC).cachGhi).toBe('tay');
  });

  it('sửa NHÃN / GHI CHÚ thì provenance KHÔNG đụng (chúng chưa bao giờ do máy đọc)', () => {
    const x = k({ cachGhi: 'dan_sms' });
    expect(suaKhoan(x, { nhan: 'di_lai' }, LUC).cachGhi).toBe('dan_sms');
    expect(suaKhoan(x, { ghiChu: 'ghi thêm' }, LUC).cachGhi).toBe('dan_sms');
  });

  it('sửa số tiền về ĐÚNG GIÁ TRỊ CŨ không tính là sửa', () => {
    // Không có vế này thì mở form rồi bấm lưu là mất provenance, dù không đổi gì.
    const x = k({ cachGhi: 'dan_sms' });
    expect(suaKhoan(x, { soTien: 50_000 }, LUC).cachGhi).toBe('dan_sms');
  });

  it('sửa cập nhật `suaLuc` nhưng KHÔNG đụng `taoLuc`', () => {
    const x = suaKhoan(k(), { nhan: 'choi' }, '2026-09-01T00:00:00.000Z');
    expect(x.taoLuc).toBe(LUC);
    expect(x.suaLuc).toBe('2026-09-01T00:00:00.000Z');
  });

  it('xoá ghi chú bằng chuỗi rỗng thì trường biến mất hẳn', () => {
    const x = suaKhoan(k({ ghiChu: 'cũ' }), { ghiChu: '' }, LUC);
    expect(x).not.toHaveProperty('ghiChu');
  });

  it('⭐ vào kho theo THÁNG CỦA KHOẢN, không phải tháng hôm nay', () => {
    // Ghi bù khoản tháng trước phải rơi đúng lát tháng trước, nếu không nó biến mất
    // khỏi mọi phép tính của tháng đó (K10).
    const b = khoanRaBanGhi(k({ ngay: '2026-07-03' }));
    expect(b.thang).toBe('2026-07');
    expect(b.id).toBe('k1');
  });

  it('mọi mã `cachGhi` đều dùng được (không có mã chết trong miền)', () => {
    for (const c of CACH_GHI) expect(k({ cachGhi: c }, `k-${c}`).cachGhi).toBe(c);
  });
});

/* ══════════════════════════════════════════════════════════════════════════════
 * §III — TÌM + CỘNG
 * ════════════════════════════════════════════════════════════════════════════ */

describe('§III — tìm và cộng', () => {
  const so: Khoan[] = [
    k({ ngay: '2026-08-01', soTien: 20_000, nhan: 'an_uong', ghiChu: 'Cà phê Sáng' }, 'a'),
    k({ ngay: '2026-08-20', soTien: 30_000, nhan: 'di_lai' }, 'b'),
    k({ ngay: '2026-07-30', soTien: 90_000, nhan: 'an_uong' }, 'c'),
    k({ ngay: '2026-08-10', soTien: 5_000_000, chieu: 'thu' }, 'd'),
  ];

  it('mới nhất lên trước', () => {
    expect(locKhoanSo(so, { thang: '2026-08' }).map((x) => x.id)).toEqual(['b', 'd', 'a']);
  });

  it('lọc theo tháng / chiều / nhãn', () => {
    expect(locKhoanSo(so, { thang: '2026-07' }).map((x) => x.id)).toEqual(['c']);
    expect(locKhoanSo(so, { chieu: 'thu' }).map((x) => x.id)).toEqual(['d']);
    expect(locKhoanSo(so, { nhan: 'an_uong' }).map((x) => x.id)).toEqual(['a', 'c']);
  });

  it('⭐ lọc `nhan: null` ra đúng khoản CHƯA phân loại (không phải "mọi khoản")', () => {
    // `undefined` = không lọc, `null` = lọc lấy khoản trống nhãn. Trộn hai cái thì màn
    // "khoản chưa phân loại" hiện cả sổ.
    expect(locKhoanSo(so, { nhan: null }).map((x) => x.id)).toEqual(['d']);
    expect(locKhoanSo(so, {}).length).toBe(4);
  });

  it('tìm theo từ khoá: không phân biệt hoa thường, ở LẠI MÁY', () => {
    expect(locKhoanSo(so, { tuKhoa: 'cà phê' }).map((x) => x.id)).toEqual(['a']);
    expect(locKhoanSo(so, { tuKhoa: '  CÀ   PHÊ ' }).map((x) => x.id)).toEqual(['a']);
    expect(locKhoanSo(so, { tuKhoa: 'không có' })).toEqual([]);
  });

  it('thứ tự TẤT ĐỊNH khi trùng ngày lẫn mốc tạo', () => {
    // Bấm nhanh hai lần là chuyện thường; thiếu vế kẹp `id` thì sổ tự xáo giữa hai lần
    // render và người dùng đọc ra "app hỏng".
    const x = [k({ ngay: '2026-08-05' }, 'z'), k({ ngay: '2026-08-05' }, 'a')];
    expect(locKhoanSo(x).map((y) => y.id)).toEqual(['a', 'z']);
  });

  it('`locKhoanSo` là hàm THUẦN — không xáo mảng gốc', () => {
    const truoc = so.map((x) => x.id);
    locKhoanSo(so);
    expect(so.map((x) => x.id)).toEqual(truoc);
  });

  it('cộng: chi / thu / ròng', () => {
    expect(congSo(so)).toEqual({ chi: 140_000, thu: 5_000_000, rong: 4_860_000 });
    expect(congSo([]), 'sổ rỗng ra 0 THẬT, không phải null').toEqual(
      { chi: 0, thu: 0, rong: 0 });
  });

  it('⚠ `congSo` chỉ CỘNG — không trả về một phán xét nào', () => {
    // Ranh giới với `guong/`: mọi con số có DIỄN GIẢI thuộc về bên kia. Một hàm tên là
    // "cộng sổ" mà trả về một lời khuyên là thứ không ai đi đọc lại.
    expect(Object.keys(congSo(so)).sort()).toEqual(['chi', 'rong', 'thu']);
  });
});

/* ══════════════════════════════════════════════════════════════════════════════
 * §IIIb — NỐI KHOẢN ↔ HŨ (B6)
 * ════════════════════════════════════════════════════════════════════════════ */

describe('§IIIb — đã góp vào hũ: LUÔN TÍNH, không bao giờ CẤT', () => {
  const so: Khoan[] = [
    k({ ngay: '2026-08-01', soTien: 500_000, huId: 'hu-A' }, 'a'),
    k({ ngay: '2026-08-10', soTien: 300_000, huId: 'hu-A' }, 'b'),
    k({ ngay: '2026-08-12', soTien: 100_000, huId: 'hu-A', chieu: 'thu' }, 'c'),
    k({ ngay: '2026-08-15', soTien: 250_000, huId: 'hu-B' }, 'd'),
    k({ ngay: '2026-08-20', soTien: 40_000 }, 'e'),   // khoản thường, không hũ
  ];

  it('⭐ với HŨ: `chi` là GÓP VÀO, `thu` là RÚT RA', () => {
    // Nhìn từ ví thì ngược đời, nhưng cái người dùng đang xem là cái HŨ.
    expect(tongGopVaoHu(so, 'hu-A')).toBe(700_000);   // 500 + 300 − 100
    expect(tongGopVaoHu(so, 'hu-B')).toBe(250_000);
    expect(tongGopVaoHu(so, 'hu-chua-co')).toBe(0);
  });

  it('⭐ KHÔNG kẹp về 0 — rút nhiều hơn góp là trạng thái CÓ THẬT', () => {
    // Kẹp ở đây là giấu nó đi. `tienDo()` mới là chỗ kẹp, và nó kẹp để thanh không vẽ
    // âm, không phải để phủ nhận con số.
    const x = [k({ soTien: 100_000, huId: 'h' }, 'p'),
      k({ soTien: 300_000, huId: 'h', chieu: 'thu' }, 'q')];
    expect(tongGopVaoHu(x, 'h')).toBe(-200_000);
  });

  it('bảng tra cho cả danh sách — một lượt duyệt, và là `Map`', () => {
    const m = bangGopHu(so);
    expect(m.get('hu-A')).toBe(700_000);
    expect(m.get('hu-B')).toBe(250_000);
    expect(m.size, 'khoản không nối hũ không tạo dòng').toBe(2);
    // `Map` chứ không phải object: id hũ do máy sinh, một id trùng tên thuộc tính có
    // sẵn của Object.prototype là lớp bug mất cả buổi để tìm.
    expect(m).toBeInstanceOf(Map);
    expect(bangGopHu([k({ huId: 'constructor' }, 'z')]).get('constructor')).toBe(50_000);
  });

  it('⭐ xoá/sửa một khoản là ĐỦ — không có con số thứ hai phải nhớ cập nhật', () => {
    // Đây chính là lý do `daGop` không được cất trên hũ.
    const bot = so.filter((x) => x.id !== 'b');
    expect(tongGopVaoHu(bot, 'hu-A')).toBe(400_000);
    const sua = so.map((x) => (x.id === 'a' ? suaKhoan(x, { soTien: 900_000 }, LUC) : x));
    expect(tongGopVaoHu(sua, 'hu-A')).toBe(1_100_000);
  });

  /* ── MỐC RESET (`Hu.mocGop`, phương án A — D292 §Còn nợ) ── */

  it('⭐⭐⭐ có MỐC ⇒ chỉ đếm khoản ghi SAU mốc; khoản cũ VẪN trong sổ, chỉ thôi được đếm', () => {
    /*
     * "Về 0" làm bằng mốc, không cất tổng, không cắt `huId`. Nên phép cộng phải biết mốc —
     * và chỉ MỘT phép cộng này biết (D61). Khoản trước mốc không bị đụng một trường nào.
     */
    const truoc = k({ ngay: '2026-08-01', soTien: 500_000, huId: 'h' }, 'a');   // taoLuc = LUC
    const sau = { ...k({ ngay: '2026-08-02', soTien: 200_000, huId: 'h' }, 'b'),
      taoLuc: '2026-09-01T00:00:00.000Z' };
    const so2 = [truoc, sau];
    expect(tongGopVaoHu(so2, 'h', '2026-08-31T12:00:00.000Z')).toBe(200_000);
    expect(tongGopVaoHu(so2, 'h', null), '`null` = từ đầu').toBe(700_000);
    expect(tongGopVaoHu(so2, 'h', undefined), 'hũ cũ chưa có khoá `mocGop` ⇒ từ đầu').toBe(700_000);
    expect(tongGopVaoHu(so2, 'h'), 'không đưa mốc = từ đầu').toBe(700_000);
    expect(truoc.huId, 'khoản cũ vẫn nối hũ — RESET không cắt dây').toBe('h');
  });

  it('⭐⭐ MỌI chỗ gọi trong `web/src` đều truyền mốc — quét NGUỒN, vì tsc không bắt được', () => {
    /*
     * ⚠ Tham số mốc là TUỲ CHỌN (hũ cũ trong kho chưa có khoá `mocGop` ⇒ `undefined` ⇒ từ
     * đầu), nên quên nó KHÔNG đỏ ở tsc và KHÔNG đỏ ở bất kỳ bài nào — nó chỉ hiện ra khi
     * một người dùng bấm RESET rồi mở đúng cái màn đã quên. Rà đối kháng bắt được đúng ca
     * ấy ở lưới đích của bàn tiền: Sổ/Hũ/Gương nói 0, bàn tiền vẫn đánh ✓ "đầy".
     * ⇒ Bài canh phải đọc NGUỒN. Nới tham số thành bắt buộc thì hỏng chiều ngược lại (bài
     * đo hàm thuần và hũ cũ mất đường gọi hai tham số), nên chốt ở đây là đúng chỗ.
     */
    const goc = path.resolve(__dirname, '..', 'src');
    const tep: string[] = [];
    const duyet = (d: string): void => {
      for (const e of fs.readdirSync(d, { withFileTypes: true })) {
        const duong = path.join(d, e.name);
        if (e.isDirectory()) duyet(duong);
        else if (/\.tsx?$/.test(e.name)) tep.push(duong);
      }
    };
    duyet(goc);

    const thieu: string[] = [];
    for (const t of tep) {
      const nguon = fs.readFileSync(t, 'utf8');
      if (t.endsWith(`${path.sep}so.ts`)) continue;          // chính nơi khai hàm
      for (const m of nguon.matchAll(/tongGopVaoHu\(([^)]*)\)/g)) {
        if (m[1]!.split(',').length < 3) thieu.push(`${t.slice(goc.length + 1)}: ${m[0]}`);
      }
    }
    expect(thieu, 'chỗ gọi quên mốc RESET (tham số thứ ba)').toEqual([]);
  });

  it('⭐ so bằng `taoLuc` (thời điểm ghi), KHÔNG bằng `ngay`: ghi bù sau reset vẫn là góp', () => {
    // Khoản đề ngày CŨ nhưng ghi SAU mốc ⇒ đếm. Khoản đề ngày MỚI nhưng ghi TRƯỚC mốc ⇒ không.
    const moc = '2026-08-15T00:00:00.000Z';
    const ghiBu = { ...k({ ngay: '2026-08-01', soTien: 100_000, huId: 'h' }, 'p'),
      taoLuc: '2026-08-20T00:00:00.000Z' };
    const ghiTruoc = { ...k({ ngay: '2026-08-30', soTien: 999_000, huId: 'h' }, 'q'),
      taoLuc: '2026-08-10T00:00:00.000Z' };
    expect(tongGopVaoHu([ghiBu, ghiTruoc], 'h', moc)).toBe(100_000);
  });

  it('biên: khoản ghi ĐÚNG mili-giây reset thuộc lượt cũ (`>` chặt) — và rút sau mốc vẫn trừ', () => {
    const moc = '2026-08-15T00:00:00.000Z';
    const dung = { ...k({ soTien: 50_000, huId: 'h' }, 'x'), taoLuc: moc };
    expect(tongGopVaoHu([dung], 'h', moc)).toBe(0);
    const rut = { ...k({ soTien: 30_000, huId: 'h', chieu: 'thu' }, 'y'),
      taoLuc: '2026-08-16T00:00:00.000Z' };
    expect(tongGopVaoHu([dung, rut], 'h', moc), 'không kẹp — rút sau reset là số âm thật').toBe(-30_000);
  });

  it('`bangGopHu` cùng MỘT luật mốc — không phải bản cộng thứ hai', () => {
    const truoc = k({ soTien: 500_000, huId: 'h' }, 'a');
    const sau = { ...k({ soTien: 200_000, huId: 'h' }, 'b'), taoLuc: '2026-09-01T00:00:00.000Z' };
    const khac = k({ soTien: 70_000, huId: 'g' }, 'c');
    const m = bangGopHu([truoc, sau, khac], (id) => (id === 'h' ? '2026-08-31T12:00:00.000Z' : null));
    expect(m.get('h')).toBe(200_000);
    expect(m.get('g'), 'hũ không có mốc vẫn cộng từ đầu').toBe(70_000);
    expect(bangGopHu([truoc, sau]).get('h'), 'không đưa mốc = từ đầu').toBe(700_000);
  });
});

/* ══════════════════════════════════════════════════════════════════════════════
 * §IV — MẪU LẶP + DÁN SMS
 * ════════════════════════════════════════════════════════════════════════════ */

describe('§IV — mẫu lặp (B3) và dán SMS (B5)', () => {
  const mau: MauLap = {
    id: 'm1', ten: 'Cà phê sáng', soTien: 25_000, chieu: 'chi',
    nhan: 'an_uong', huId: null, taoLuc: LUC,
  };

  it('mẫu lặp điền sẵn và dán đúng cờ `mau_lap`', () => {
    const x = tuMauLap(mau, '2026-08-31', LUC, 'k9');
    expect(x.soTien).toBe(25_000);
    expect(x.nhan).toBe('an_uong');
    expect(x.cachGhi).toBe('mau_lap');
    expect(x.ghiChu).toBe('Cà phê sáng');
  });

  it('mẫu chưa có số tiền thì HỎI USER, không đoán 0', () => {
    expect(() => tuMauLap({ ...mau, soTien: null }, '2026-08-31', LUC, 'k9'))
      .toThrow(LoiSo);
  });

  it('⭐ bóc SMS: số tiền phải ĐI KÈM ĐƠN VỊ, không vơ số tài khoản', () => {
    /*
     * Tin nhắn bank đầy số không phải tiền — số tài khoản, mã giao dịch, ngày giờ. Không
     * neo vào đơn vị thì bộ bóc tự tin trả về bốn chữ số cuối của số tài khoản, và user
     * KHÔNG BIẾT MÀ SỬA. Bóc sai tệ hơn bóc trượt gấp bội.
     */
    expect(bocSms('TK 0123456789 GD -55,000VND luc 10:30').soTien).toBe(55_000);
    expect(bocSms('Ma giao dich 987654321 luc 12:00 ngay 31/08').soTien).toBeNull();
  });

  it('bóc chiều: dấu +/- thắng, rồi mới tới từ khoá', () => {
    expect(bocSms('TK GD -55.000 VND').chieu).toBe('chi');
    expect(bocSms('TK GD +2.000.000 VND').chieu).toBe('thu');
    expect(bocSms('Thanh toan 55.000d tai cua hang').chieu).toBe('chi');
    expect(bocSms('Nhan tien 500.000d').chieu).toBe('thu');
  });

  it('⭐ bóc không ra thì NÓI RA, không đoán bừa', () => {
    const n = bocSms('Tin nhắn quảng cáo không có gì');
    expect(n.soTien).toBeNull();
    expect(n.chieu).toBeNull();
    expect([...n.thieu].sort()).toEqual(['chieu', 'soTien']);
  });

  it('bóc nội dung chuyển khoản làm ghi chú gợi ý', () => {
    expect(bocSms('GD -100.000VND\nND: tien tro thang 8').moTa).toBe('tien tro thang 8');
    expect(bocSms('GD -55.000VND ND: an trua').moTa, 'cùng dòng cũng phải ra')
      .toBe('an trua');
  });

  it('⭐ "VND" CHỨA "ND" — nhãn nội dung không được khớp bên trong đơn vị tiền', () => {
    /*
     * Bẫy thật, và một bài test KHÁC bắt được nó chứ không phải mắt tôi: bản đầu của
     * `bocMoTa` khớp ngay trong chữ "VND" nên MỌI tin nhắn đều "bóc ra" phần đuôi kể từ
     * sau số tiền. Ghi lại thành bài riêng vì nó sẽ mọc lại ngay lần đầu ai đó nới regex
     * cho một định dạng ngân hàng mới.
     */
    expect(bocSms('GD -100.000VND').moTa).toBeNull();
    expect(bocSms('TK 123 GD -100.000VND luc 10:30').moTa).toBeNull();
    expect(bocSms('Nhan 500.000VND tu NGUYEN VAN A').moTa).toBeNull();
  });

  it('⭐⭐ xác nhận ĐÚNG số máy bóc ⇒ giữ `dan_sms`; user sửa số ⇒ tụt về `tay`', () => {
    const n = bocSms('GD -55.000VND ND: an trua');
    const giu = xacNhanSms(n, { ngay: '2026-08-31', soTien: 55_000, chieu: 'chi' }, LUC, 'k1');
    expect(giu.cachGhi).toBe('dan_sms');
    expect(giu.ghiChu).toBe('an trua');

    const sua = xacNhanSms(n, { ngay: '2026-08-31', soTien: 60_000, chieu: 'chi' }, LUC, 'k2');
    expect(sua.cachGhi, 'số do người chốt, không phải do máy đọc').toBe('tay');
  });

  it('bản nháp bóc trượt mà user tự điền ⇒ `tay`, không mượn danh SMS', () => {
    const n = bocSms('Tin nhắn không đọc được');
    const x = xacNhanSms(n, { ngay: '2026-08-31', soTien: 30_000, chieu: 'chi' }, LUC, 'k3');
    expect(x.cachGhi).toBe('tay');
  });

  it('⭐ `bocSms` KHÔNG trả về một `Khoan` — không có đường ghi thẳng', () => {
    // Bóc sai rồi tự ghi là làm hỏng sổ của user bằng máy, và người ta chỉ phát hiện
    // lúc đối chiếu cuối tháng.
    const n = bocSms('GD -55.000VND');
    expect(n).not.toHaveProperty('id');
    expect(n).not.toHaveProperty('ngay');
    expect(n).not.toHaveProperty('cachGhi');
  });
});
