/**
 * PFM — TẤM HƯỚNG: lõi thuần `src/pfm/huong.ts` (HỌC · CHẤM · hồ sơ) + `src/pfm/huong_hu.ts` (MÔ HÌNH DEMO bản 6 — founder 11/10, câu B).
 *
 * ⭐⭐⭐ Canh sáu điều:
 *   (1) con số "học từ N quyết định" đếm CÚ BẤM định tiền, không đếm khoản chi thường, không đếm cú của quy tắc tự chia;
 *   (2) mỗi dòng học đứng trên phép đếm ĐÃ CÓ và vắng khi thiếu mẫu (P7) — "Tắt Gương" tắt đúng ba dòng nhịp hành vi; tấm bày tối đa HAI dòng;
 *   (3) HƯỚNG TUẦN TỚI = ba phương án sinh từ HŨ THẬT: hai hũ tiết kiệm đang chạy đầu tiên theo thứ tự màn HŨ + GIỮ NHƯ CŨ; "làm đúng k/n lần"
 *       đếm NGÀY chia tiền (thiếu mẫu ⇒ `null`, không 0/0);
 *   (4) CHẤM chỉ đọc bản ghi: mô hình mới đếm ngày hũ đã chọn nhận tiền; mô hình CŨ (D453) vẫn đọc được — dựng SAU lúc chọn mới tính, giữ/vỡ chỉ
 *       đếm trong tuần, dựng mà để không là CHƯA TỚI;
 *   (5) lựa chọn nằm trong hồ sơ, sống qua `locHoSo` (cả mã mới lẫn cũ), KHÔNG lọt vào `ctx_*` (P2);
 *   (6) bản ghi mô hình cũ KHÔNG bao giờ bị xoá/ghi đè khi thêm lựa chọn mới (chỉ nối thêm).
 *
 * ⚠ 11/10 — bài VIẾT LẠI vì SPEC đổi (A11.30): §III (`chonDongHoc` không còn nhận hướng) và §V (XẾP HƯỚNG theo bước dựng → PHƯƠNG ÁN theo hũ) thay thế;
 *   `xepHuong` · `luaChonTuGoiY` · gạt/lùi/"làm tới thì lên" không còn vì không còn ai sinh hướng bằng bước dựng.
 */
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { taoKhoan, type DauVaoKhoan, type Khoan } from '../src/pfm/so.js';
import { tuTao, type Hu } from '../src/pfm/hu.js';
import { taoKhoanPhanBo } from '../src/pfm/phan_bo.js';
import { datTuDong } from '../src/pfm/tu_dong.js';
import { banLuat, ghiNhanGiuVo, taoLuatMoi, type Luat } from '../src/pfm/luat.js';
import { congNgay, ngayCuaLuc } from '../src/pfm/thoi_gian.js';
import { lenhCua } from '../src/pfm/vi_the.js';
import { ctxCuaHoSo, locHoSo, type HoSo } from '../src/pfm/ho_so.js';
import {
  chamLuaChon, chonDongHoc, cuoiTuan, dauTuan, demQuyetDinh, hocTuQuyetDinh, huongTuan, lamToi,
  noiLuaChon, SAN_LAN_LUAT, SO_HOC_TREN_THE, SO_LUA_CHON_NHO, tuanDaChon, tuanVuaKhep,
  type DauVaoHoc, type LuaChonHuong,
} from '../src/pfm/huong.js';
import {
  huongMoiTuan, lanLamUuTien, luaChonTuPhuongAn, MA_GIU_NHU_CU, MA_UU_TIEN, phuongAnCuaLuaChon, phuongAnTuan,
} from '../src/pfm/huong_hu.js';

let dem = 0;
const id = (): string => `k${dem++}`;
const chi = (ngay: string, soTien: number, them: Partial<DauVaoKhoan> = {}): Khoan =>
  taoKhoan({ ngay, soTien, ...them }, `${ngay}T05:00:00.000Z`, id());
const thu = (ngay: string, soTien: number): Khoan =>
  taoKhoan({ ngay, soTien, chieu: 'thu' }, `${ngay}T02:00:00.000Z`, id());
const nap = (ngay: string, soTien: number, huId: string, phanBo: 'tay' | 'tu_dong' | 'gan' = 'tay'): Khoan =>
  taoKhoanPhanBo({ ngay, soTien, huId, phanBo }, `${ngay}T13:00:00.000Z`, id());

/** Thứ Hai 28/09/2026 — tuần "này" của mọi bài dưới. */
const HOM_NAY = '2026-09-30';
const TUAN = '2026-09-28';
const LUC = '2026-06-01T02:00:00.000Z';
const huTich = (idHu: string, ten: string, muc: number | null = 5_000_000, taoLuc = LUC): Hu =>
  tuTao({ ten, muc }, taoLuc, idHu);
const huTieu = (idHu: string, ten: string, taoLuc = LUC): Hu => tuTao({ ten, muc: null, nhom: 'tieu_dung' }, taoLuc, idHu);

const luatVoi = (idL: string, dk: Luat['dieuKien'], nhip: ('giu' | 'vo')[], batDau = '2026-09-01', taoLuc = LUC): Luat => {
  let l = taoLuatMoi({
    loiNhac: 'dừng lại một nhịp',
    dieuKien: dk,
    ...(dk === 'khoan_vuot_muc' ? { thamSo: { nguong: 200_000 } } : {}),
    mauId: null,
  }, taoLuc, idL);
  nhip.forEach((m, i) => {
    const d = congNgay(batDau, i);
    l = banLuat(l, `${d}T09:00:00.000Z`);
    // 12:00Z = 19:00 giờ VN — CÙNG ngày ở cả UTC lẫn giờ máy (T21:00Z là 04:00 SÁNG HÔM SAU giờ VN: fixture cũ chỉ đúng nhờ so ngày UTC — RÀ 12/10 C2)
    l = ghiNhanGiuVo(l, m, `${d}T12:00:00.000Z`);
  });
  return l;
};

const vao = (them: Partial<DauVaoHoc> = {}): DauVaoHoc => ({
  so: [], hu: [], luat: [], hoSo: {}, homNay: HOM_NAY, ...them,
});

/* ═══ §0 — TUẦN ═══════════════════════════════════════════════════════════════════════════════ */

describe('§0 — tuần bắt đầu từ thứ Hai', () => {
  it('thứ Tư 30/09 thuộc tuần 28/09 → 04/10; Chủ nhật 04/10 vẫn cùng tuần', () => {
    expect(dauTuan('2026-09-30')).toBe('2026-09-28');
    expect(dauTuan('2026-10-04')).toBe('2026-09-28');
    expect(dauTuan('2026-10-05')).toBe('2026-10-05');
    expect(cuoiTuan('2026-09-28')).toBe('2026-10-04');
  });
});

/* ═══ §I — ĐẾM QUYẾT ĐỊNH ══════════════════════════════════════════════════════════════════════ */

describe('§I — ⭐⭐⭐ "học từ N quyết định" đếm CÚ BẤM định tiền, không đếm khoản chi thường', () => {
  it('⭐⭐⭐ khoản chi thường và cú của QUY TẮC tự chia KHÔNG đếm; cú chia tay · rút · gán thì đếm', () => {
    const so = [
      chi('2026-09-01', 50_000), chi('2026-09-02', 60_000), thu('2026-09-05', 3_000_000),   // sổ: 0 quyết định
      nap('2026-09-05', 500_000, 'h1'),                   // chia tay: 1
      nap('2026-09-06', 50_000, 'h1', 'tu_dong'),         // quy tắc: 0
      nap('2026-09-07', 40_000, 'h2', 'gan'),             // gán chi tiêu: 1
      taoKhoanPhanBo({ ngay: '2026-09-08', soTien: 100_000, huId: 'h1', phanBo: 'tay', chieu: 'thu' } as never,
        '2026-09-08T13:00:00.000Z', id()),                // rút: 1
    ];
    expect(demQuyetDinh({ so, hu: [], luat: [], hoSo: {} })).toBe(3);
  });

  it('hũ: mở · mức · kỳ hạn · quy tắc · quyết toán — mỗi thứ một cú; luật: đặt + từng lần giữ/vỡ', () => {
    const h = datTuDong(huTich('h1', 'Quỹ', 5_000_000), { kieu: 'ngay', gt: 20_000 }, '2026-09-01');
    const khongMuc = huTich('h2', 'Chưa mức', null);
    const l = luatVoi('l1', 'ngay_chi_lon', ['giu', 'vo', 'giu']);
    // h: mở 1 + mức 1 + quy tắc 1 = 3 · h2: mở 1 · luật: đặt 1 + 3 lần = 4 · khung 1
    expect(demQuyetDinh({ so: [], hu: [h, khongMuc], luat: [l], hoSo: { khung: 'hu' } })).toBe(3 + 1 + 4 + 1);
  });

  it('mỗi lần chọn / gạt một hướng là một quyết định', () => {
    const lc: LuaChonHuong = { tuan: TUAN, khoa: 'a', ma: 'hu_tich_dau', kieu: 'theo', luc: `${TUAN}T08:00:00.000Z` };
    expect(demQuyetDinh({ so: [], hu: [], luat: [], hoSo: { huong: [lc, { ...lc, kieu: 'bo' }] } })).toBe(2);
  });
});

/* ═══ §II — DÒNG HỌC ═══════════════════════════════════════════════════════════════════════════ */

describe('§II — ⭐⭐⭐ dòng HỌC: đứng trên phép đếm đã có, vắng khi thiếu mẫu (P7)', () => {
  it(`⭐⭐ luật chỉ có dòng khi đủ ${SAN_LAN_LUAT} lần giữ/vỡ — và k/n đúng`, () => {
    const it1 = luatVoi('l1', 'ngay_chi_lon', ['giu']);
    const du = luatVoi('l2', 'tien_vua_ve', ['giu', 'vo', 'giu', 'giu']);
    const hoc = hocTuQuyetDinh(vao({ luat: [it1, du] }));
    expect(hoc.find((d) => d.khoa === 'luat_giu:l1')).toBeUndefined();
    const d = hoc.find((x) => x.khoa === 'luat_giu:l2')!;
    expect(d).toMatchObject({ ma: 'luat_giu', nguon: 'so', k: 3, n: 4, luatId: 'l2' });
  });

  it('⭐⭐ tiền về → chia vào hũ: đếm lần tiền về CÓ cú nạp trong cửa sổ; dưới hai lần tiền về thì vắng', () => {
    const so2 = [
      thu('2026-08-05', 3_000_000), nap('2026-08-05', 500_000, 'h1'),
      thu('2026-09-05', 3_000_000),                                     // lần này không chia
      thu('2026-09-20', 1_000_000), nap('2026-09-21', 200_000, 'h1'),
    ];
    const d = hocTuQuyetDinh(vao({ so: so2 })).find((x) => x.ma === 'tien_ve_cat')!;
    expect(d).toMatchObject({ k: 2, n: 3 });
    const mot = hocTuQuyetDinh(vao({ so: [thu('2026-09-05', 3_000_000), nap('2026-09-05', 1, 'h1')] }));
    expect(mot.find((x) => x.ma === 'tien_ve_cat')).toBeUndefined();
  });

  it('⭐⭐ "Tắt Gương" ⇒ ba dòng NHỊP hành vi vắng; dòng QUYẾT ĐỊNH vẫn còn', () => {
    // Cuối tuần tiêu gấp ba ngày thường suốt tám tuần ⇒ dòng `cuoi_tuan` đủ ngưỡng.
    const so: Khoan[] = [];
    for (let i = 0; i < 70; i++) {
      const d = congNgay('2026-07-22', i);
      const t = new Date(`${d}T12:00:00Z`).getUTCDay();
      so.push(chi(d, t === 0 || t === 6 ? 300_000 : 100_000));
    }
    const l = luatVoi('l1', 'ngay_chi_lon', ['giu', 'giu']);
    const mo = hocTuQuyetDinh(vao({ so, luat: [l] }));
    expect(mo.some((d) => d.ma === 'cuoi_tuan')).toBe(true);
    const tat = hocTuQuyetDinh(vao({ so, luat: [l], tatHanhVi: true }));
    expect(tat.some((d) => d.ma === 'cuoi_tuan' || d.ma === 'tien_ve_don' || d.ma === 'cuoi_thang')).toBe(false);
    expect(tat.some((d) => d.ma === 'luat_giu')).toBe(true);
  });

  it('⭐ LỜI KỂ chở NHÃN nguyên văn và mang nguồn BẠN NÓI — nói được từ ngày một, sổ trống', () => {
    const hoSo: HoSo = { lucTienVe: 'cất một phần đi', nhip: ['đi chơi cùng bạn', 'cuối tháng'], dauThang: 'đại khái' };
    const hoc = hocTuQuyetDinh(vao({ hoSo }));
    expect(hoc.map((d) => [d.ma, d.nguon, d.nhan])).toEqual([
      ['noi_tien_ve', 'ban_noi', 'cất một phần đi'],
      ['noi_nhip', 'ban_noi', 'đi chơi cùng bạn · cuối tháng'],
      ['noi_dau_thang', 'ban_noi', 'đại khái'],
    ]);
  });

  it('⭐⭐ thứ tự: QUYẾT ĐỊNH → nhịp sổ → lời kể', () => {
    const so: Khoan[] = [];
    for (let i = 0; i < 70; i++) {
      const d = congNgay('2026-07-22', i);
      const t = new Date(`${d}T12:00:00Z`).getUTCDay();
      so.push(chi(d, t === 0 || t === 6 ? 300_000 : 100_000));
    }
    const hoc = hocTuQuyetDinh(vao({
      so, luat: [luatVoi('l1', 'ngay_chi_lon', ['giu', 'vo'])], hoSo: { lucTienVe: 'cất một phần đi' },
    }));
    const iLuat = hoc.findIndex((d) => d.ma === 'luat_giu');
    const iTuan = hoc.findIndex((d) => d.ma === 'cuoi_tuan');
    const iNoi = hoc.findIndex((d) => d.ma === 'noi_tien_ve');
    expect(iLuat).toBeGreaterThanOrEqual(0);
    expect(iLuat).toBeLessThan(iTuan);
    expect(iTuan).toBeLessThan(iNoi);
  });

  it('P7 — chi chưa chia chỉ có dòng khi đủ cả hai ngưỡng (số tiền VÀ phần)', () => {
    const it1 = hocTuQuyetDinh(vao({ so: [chi('2026-09-02', 50_000)] }));
    expect(it1.some((d) => d.ma === 'chua_chia')).toBe(false);
    const du = hocTuQuyetDinh(vao({ so: [chi('2026-09-02', 400_000), chi('2026-09-03', 300_000)] }));
    expect(du.find((d) => d.ma === 'chua_chia')?.p).toBe(1);
  });
});

/* ═══ §III — CHỌN DÒNG CHO TẤM ════════════════════════════════════════════════════════════════ */

describe('§III — tấm bày HAI dòng học; SỔ trước, lời kể chỉ lấp chỗ', () => {
  const dong = (khoa: string, nguon: 'so' | 'ban_noi' = 'so') =>
    ({ ma: 'luat_giu' as const, nguon, khoa, manh: 1 });
  it(`⭐⭐ tối đa ${SO_HOC_TREN_THE} dòng (demo bản 6); SỔ trước BẠN NÓI; không trùng`, () => {
    expect(SO_HOC_TREN_THE).toBe(2);
    const hoc = [dong('a'), dong('n1', 'ban_noi'), dong('b'), dong('c'), dong('a')];
    expect(chonDongHoc(hoc).map((d) => d.khoa)).toEqual(['a', 'b']);
    expect(chonDongHoc([dong('a'), dong('n1', 'ban_noi')]).map((d) => d.khoa)).toEqual(['a', 'n1']);
    expect(chonDongHoc([dong('n1', 'ban_noi'), dong('n2', 'ban_noi'), dong('n3', 'ban_noi')]).map((d) => d.khoa)).toEqual(['n1', 'n2']);
    expect(chonDongHoc([])).toEqual([]);
  });
});

/* ═══ §IV — LỰA CHỌN TRONG TUẦN ═══════════════════════════════════════════════════════════════ */

describe('§IV — ⭐⭐ mỗi tuần MỘT hướng; lựa chọn chỉ nối thêm', () => {
  const lc = (khoa: string, kieu: LuaChonHuong['kieu'], tuan = TUAN, gio = '08'): LuaChonHuong =>
    ({ tuan, khoa, ma: 'hu_tich_dau', kieu, luc: `${tuan}T${gio}:00:00.000Z` });

  it('chọn khác = thay · THÔI = bỏ chọn · gạt đúng khoá đang theo = bỏ', () => {
    expect(huongTuan([lc('a', 'theo'), lc('b', 'theo')], TUAN)?.khoa).toBe('b');
    expect(huongTuan([lc('a', 'theo'), lc('a', 'thoi')], TUAN)).toBeNull();
    expect(huongTuan([lc('a', 'theo'), lc('a', 'bo')], TUAN)).toBeNull();
    expect(huongTuan([lc('a', 'theo'), lc('b', 'bo')], TUAN)?.khoa).toBe('a');
    expect(huongTuan([lc('a', 'theo', '2026-09-21')], TUAN)).toBeNull();
  });

  it('⭐ chạm lại đúng trạng thái đang có ⇒ null (không ghi, suaLuc không nhích); giữ tối đa N lần', () => {
    const h: HoSo = { huong: [lc('a', 'theo')] };
    expect(noiLuaChon(h, lc('a', 'theo', TUAN, '09'))).toBeNull();
    expect(noiLuaChon({}, lc('a', 'thoi'))).toBeNull();
    let x: HoSo = {};
    for (let i = 0; i < SO_LUA_CHON_NHO + 5; i++) x = noiLuaChon(x, lc(`k${i}`, 'bo'))!;
    expect(x.huong).toHaveLength(SO_LUA_CHON_NHO);
    expect(x.huong!.at(-1)!.khoa).toBe(`k${SO_LUA_CHON_NHO + 4}`);
  });

  it('tuần đã chọn: chỉ các tuần TRƯỚC tuần này, mới trước', () => {
    const ds = [lc('a', 'theo', '2026-09-14'), lc('b', 'theo', '2026-09-21'), lc('c', 'theo', TUAN)];
    expect(tuanDaChon(ds, TUAN).map((x) => x.khoa)).toEqual(['b', 'a']);
    expect(tuanVuaKhep(ds, HOM_NAY)?.khoa).toBe('b');
  });
});

/* ═══ §V — HƯỚNG TUẦN TỚI: PHƯƠNG ÁN SINH TỪ HŨ THẬT (huong_hu.ts) ═══════════════════════════════ */

describe('§V — ⭐⭐⭐ ba phương án: hai hũ tiết kiệm đang chạy đầu tiên theo thứ tự màn HŨ + GIỮ NHƯ CŨ', () => {
  it('⭐⭐⭐ hai hũ + giữ như cũ; hũ ƯU TIÊN CAO đứng trước hũ tạo sớm hơn; hũ chi, hũ đã xong/tạm dừng KHÔNG thành phương án', () => {
    const quy = huTich('h1', 'Quỹ', 2_000_000, '2026-06-01T02:00:00.000Z');
    const lap = { ...huTich('h2', 'Laptop', 5_000_000, '2026-06-02T02:00:00.000Z'), uuTien: 'cao' as const };
    const xe = huTich('h3', 'Xe', 9_000_000, '2026-06-03T02:00:00.000Z');
    const an = huTieu('h4', 'Ăn uống');
    const xong = { ...huTich('h5', 'Đã xong'), trangThai: 'xong' as const };
    const ds = phuongAnTuan([quy, lap, xe, an, xong], [], null);
    expect(ds.map((p) => p.khoa)).toEqual(['uu_tien_hu:h2', 'uu_tien_hu:h1', 'giu_nhu_cu']);
    expect(ds.map((p) => p.ma)).toEqual([MA_UU_TIEN, MA_UU_TIEN, MA_GIU_NHU_CU]);
  });

  it('⭐⭐ một hũ ⇒ hai nút; không hũ nào ⇒ chỉ GIỮ NHƯ CŨ (không bịa phương án)', () => {
    expect(phuongAnTuan([huTich('h1', 'Quỹ')], [], null).map((p) => p.khoa)).toEqual(['uu_tien_hu:h1', 'giu_nhu_cu']);
    expect(phuongAnTuan([], [], null).map((p) => p.khoa)).toEqual(['giu_nhu_cu']);
    expect(phuongAnTuan([huTieu('h4', 'Ăn uống')], [], null).map((p) => p.khoa)).toEqual(['giu_nhu_cu']);
  });

  it('⭐⭐ hướng ĐANG THEO là một hũ không còn nằm trong hai hũ đầu (vd đã xong) ⇒ vẫn đứng đầu danh sách — nút đã bấm không biến mất', () => {
    const h1 = huTich('h1', 'A', 1, '2026-06-01T02:00:00.000Z');
    const h2 = huTich('h2', 'B', 1, '2026-06-02T02:00:00.000Z');
    const h3 = huTich('h3', 'C', 1, '2026-06-03T02:00:00.000Z');
    const dang: LuaChonHuong = { tuan: TUAN, khoa: 'uu_tien_hu:hx', ma: 'uu_tien_hu', kieu: 'theo', luc: `${TUAN}T08:00:00.000Z`, huId: 'hx' };
    expect(phuongAnTuan([h1, h2, h3], [], dang).map((p) => p.khoa)).toEqual(['uu_tien_hu:hx', 'uu_tien_hu:h1', 'giu_nhu_cu']);
    // đang theo một hũ ĐÃ nằm trong hai hũ đầu ⇒ không nhân đôi
    expect(phuongAnTuan([h1, h2, h3], [], { ...dang, khoa: 'uu_tien_hu:h2', huId: 'h2' }).map((p) => p.khoa))
      .toEqual(['uu_tien_hu:h1', 'uu_tien_hu:h2', 'giu_nhu_cu']);
  });

  it('bản ghi lựa chọn: `luaChonTuPhuongAn` mang khoá + huId; dựng lại phương án từ bản ghi; bản ghi mô hình CŨ ⇒ null', () => {
    const ds = phuongAnTuan([huTich('h1', 'Quỹ')], [], null);
    const p1 = ds[0]!;
    const giu = ds[1]!;
    const lc = luaChonTuPhuongAn(p1, 'theo', TUAN, `${TUAN}T08:00:00.000Z`);
    expect(lc).toEqual({ tuan: TUAN, khoa: 'uu_tien_hu:h1', ma: 'uu_tien_hu', kieu: 'theo', luc: `${TUAN}T08:00:00.000Z`, huId: 'h1' });
    expect(phuongAnCuaLuaChon(lc)).toEqual({ khoa: 'uu_tien_hu:h1', ma: 'uu_tien_hu', huId: 'h1' });
    const gl = luaChonTuPhuongAn(giu, 'theo', TUAN, `${TUAN}T08:00:00.000Z`);
    expect(gl.huId).toBeUndefined();
    expect(phuongAnCuaLuaChon({ tuan: TUAN, khoa: 'hu_tich_dau', ma: 'hu_tich_dau', kieu: 'theo', luc: `${TUAN}T08:00:00.000Z` })).toBeNull();
  });
});

describe('§V-bis — ⭐⭐⭐ "làm đúng k/n lần": đếm NGÀY chia tiền, thiếu mẫu ⇒ null (không 0/0)', () => {
  const lc = (huId: string, luc = `${TUAN}T08:00:00.000Z`, tuan = TUAN): LuaChonHuong =>
    ({ tuan, khoa: `uu_tien_hu:${huId}`, ma: 'uu_tien_hu', kieu: 'theo', luc, huId });

  it('⭐⭐⭐ n = số NGÀY có chia vào hũ nào đó; k = số ngày hũ đã chọn nhận; hai cú cùng ngày chỉ một ngày', () => {
    const so = [
      nap('2026-09-28', 100_000, 'h1'), nap('2026-09-28', 50_000, 'h1'),
      nap('2026-09-29', 100_000, 'h2'),
      nap('2026-09-30', 100_000, 'h1'),
    ];
    expect(lanLamUuTien(lc('h1'), so, '2026-09-30')).toEqual({ k: 2, n: 3 });
    expect(lanLamUuTien(lc('h2'), so, '2026-09-30')).toEqual({ k: 1, n: 3 });
  });

  it('⭐⭐ chỉ đếm TỪ NGÀY CHỌN: ngày chia trước lúc chọn trong cùng tuần không tính; tới hết Chủ nhật của tuần chọn dù hôm nay đã sang tuần khác', () => {
    const so = [nap('2026-09-28', 100_000, 'h1'), nap('2026-09-30', 100_000, 'h1'), nap('2026-10-02', 100_000, 'h2'), nap('2026-10-06', 100_000, 'h2')];
    const chonThuTu = lc('h1', '2026-09-30T08:00:00.000Z');
    expect(lanLamUuTien(chonThuTu, so, '2026-10-03')).toEqual({ k: 1, n: 2 });   // 30/09 (h1) + 02/10 (h2); 28/09 trước lúc chọn
    expect(lanLamUuTien(chonThuTu, so, '2026-10-20')).toEqual({ k: 1, n: 2 });   // 06/10 là tuần sau — không tính
  });

  it('⭐⭐⭐ THIẾU MẪU ⇒ null: không ngày chia nào; RÚT hũ không phải "chia vào"; khoản chi thường không phải chia', () => {
    expect(lanLamUuTien(lc('h1'), [], '2026-09-30')).toBeNull();
    const rut = taoKhoanPhanBo({ ngay: '2026-09-29', soTien: 50_000, huId: 'h1', phanBo: 'tay', chieu: 'thu' }, '2026-09-29T13:00:00.000Z', id());
    expect(lanLamUuTien(lc('h1'), [rut, chi('2026-09-29', 40_000)], '2026-09-30')).toBeNull();
  });

  it('GIỮ NHƯ CŨ và bản ghi mô hình cũ ⇒ null (không có phép đếm này)', () => {
    const so = [nap('2026-09-29', 100_000, 'h1')];
    expect(lanLamUuTien({ tuan: TUAN, khoa: 'giu_nhu_cu', ma: 'giu_nhu_cu', kieu: 'theo', luc: `${TUAN}T08:00:00.000Z` }, so, '2026-09-30')).toBeNull();
    expect(lanLamUuTien({ tuan: TUAN, khoa: 'x', ma: 'hu_tich_dau', kieu: 'theo', luc: `${TUAN}T08:00:00.000Z`, huId: 'h1' }, so, '2026-09-30')).toBeNull();
  });

  it('⭐⭐⭐ `huongMoiTuan`: bản ghi mô hình CŨ của tuần này KHÔNG phải "đang theo" (không bịa); mô hình mới thì có; chọn mới SAU bản ghi cũ thì thắng', () => {
    const cu: LuaChonHuong = { tuan: TUAN, khoa: 'hu_tich_dau:tich_luy', ma: 'hu_tich_dau', kieu: 'theo', luc: `${TUAN}T07:00:00.000Z`, nhom: 'tich_luy' };
    expect(huongMoiTuan([cu], TUAN)).toBeNull();
    expect(huongMoiTuan([cu, lc('h1')], TUAN)?.khoa).toBe('uu_tien_hu:h1');
    expect(huongMoiTuan([lc('h1'), cu], TUAN)).toBeNull();            // bản cũ chọn SAU ⇒ hướng đang theo là bản cũ ⇒ không hiện
    expect(huongMoiTuan([lc('h1'), lc('h2', `${TUAN}T09:00:00.000Z`)], TUAN)?.huId).toBe('h2');
  });
});

/* ═══ §VI — CHẤM ═══════════════════════════════════════════════════════════════════════════════ */

describe('§VI — ⭐⭐⭐ CHẤM chỉ đọc bản ghi: dựng SAU lúc chọn, đếm TRONG tuần', () => {
  const chon = (ma: LuaChonHuong['ma'], them: Partial<LuaChonHuong> = {}): LuaChonHuong =>
    ({ tuan: '2026-09-21', khoa: ma, ma, kieu: 'theo', luc: '2026-09-21T08:00:00.000Z', ...them });
  const den = '2026-09-27';

  it('⭐⭐⭐ tạo hũ: hũ ĐÚNG LOẠI mở SAU lúc chọn mới tính; dựng mà không nạp đồng nào ⇒ CHƯA TỚI', () => {
    const lc = chon('hu_cho_chua_chia', { nhom: 'tieu_dung' });
    const cu = huTieu('hcu', 'Cũ', '2026-09-01T00:00:00.000Z');
    expect(chamLuaChon(lc, { so: [], hu: [cu], luat: [], hoSo: {} }, den).dung).toBe(false);
    const moiTich = huTich('ht', 'Tích', 1, '2026-09-22T00:00:00.000Z');
    expect(chamLuaChon(lc, { so: [], hu: [moiTich], luat: [], hoSo: {} }, den).dung).toBe(false);
    const moi = huTieu('hm', 'Ăn uống', '2026-09-22T00:00:00.000Z');
    const khongNap = chamLuaChon(lc, { so: [], hu: [moi], luat: [], hoSo: {} }, den);
    expect(khongNap).toMatchObject({ dung: true, nap: 0 });
    expect(lamToi(khongNap)).toBe(false);
    const coNap = chamLuaChon(lc, { so: [nap('2026-09-23', 40_000, 'hm', 'gan')], hu: [moi], luat: [], hoSo: {} }, den);
    expect(coNap.nap).toBe(1);
    expect(lamToi(coNap)).toBe(true);
    const ngoaiTuan = chamLuaChon(lc, { so: [nap('2026-09-29', 40_000, 'hm', 'gan')], hu: [moi], luat: [], hoSo: {} }, den);
    expect(ngoaiTuan.nap).toBe(0);
  });

  it('⭐⭐⭐ luật: giữ/vỡ chỉ đếm trong tuần; một lần vỡ ⇒ CHƯA TỚI', () => {
    const lc = chon('luat_ngay_dam', { dk: 'ngay_chi_lon' });
    const l = luatVoi('l1', 'ngay_chi_lon', ['giu', 'vo', 'giu'], '2026-09-26', '2026-09-21T09:00:00.000Z');
    const kq = chamLuaChon(lc, { so: [], hu: [], luat: [l], hoSo: {} }, den);
    expect(kq).toMatchObject({ dung: true, giu: 1, vo: 1 });     // 26, 27 trong tuần; 28 ngoài
    expect(lamToi(kq)).toBe(false);
    const truocKhiChon = luatVoi('l2', 'ngay_chi_lon', ['giu'], '2026-09-22', '2026-09-20T09:00:00.000Z');
    expect(chamLuaChon(lc, { so: [], hu: [], luat: [truocKhiChon], hoSo: {} }, den).dung).toBe(false);
  });

  it('⭐⭐ quy tắc tự chia: dựng khi quy tắc đặt từ NGÀY chọn trở đi; làm tới khi có tiền vào hũ trong tuần', () => {
    const lc = chon('tu_chia_tien_ve', { huId: 'h1', td: 'phan_tram' });
    const h0 = huTich('h1', 'Quỹ');
    expect(chamLuaChon(lc, { so: [], hu: [h0], luat: [], hoSo: {} }, den).dung).toBe(false);
    const h1 = datTuDong(h0, { kieu: 'phan_tram', gt: 10 }, '2026-09-22');
    const kq = chamLuaChon(lc, { so: [nap('2026-09-25', 300_000, 'h1', 'tu_dong')], hu: [h1], luat: [], hoSo: {} }, den);
    expect(kq).toMatchObject({ dung: true, nap: 1 });
    expect(lamToi(kq)).toBe(true);
  });

  it('chọn khung: dựng = hồ sơ đang ở đúng khung ấy', () => {
    const lc = chon('chon_khung', { khung: 'kakeibo' });
    expect(chamLuaChon(lc, { so: [], hu: [], luat: [], hoSo: { khung: 'hu' } }, den).dung).toBe(false);
    expect(lamToi(chamLuaChon(lc, { so: [], hu: [], luat: [], hoSo: { khung: 'kakeibo' } }, den))).toBe(true);
  });

  it('⭐⭐ dòng `huong_giu`: đếm TUẦN ĐÃ KHÉP có hướng; tuần này chưa tính', () => {
    const lcTruoc = chon('luat_ngay_dam', { dk: 'ngay_chi_lon' });
    const lcNay: LuaChonHuong = { ...lcTruoc, tuan: TUAN, luc: `${TUAN}T08:00:00.000Z` };
    const l = luatVoi('l1', 'ngay_chi_lon', ['giu', 'giu'], '2026-09-22', '2026-09-21T09:00:00.000Z');
    const d = hocTuQuyetDinh(vao({ luat: [l], hoSo: { huong: [lcTruoc, lcNay] } })).find((x) => x.ma === 'huong_giu')!;
    expect(d).toMatchObject({ k: 1, n: 1 });
  });

  it('⭐⭐⭐ MÔ HÌNH MỚI: ưu tiên một hũ — `nap` = số NGÀY hũ ấy nhận tiền; có ngày ⇒ LÀM TỚI, không ngày ⇒ CHƯA TỚI; hũ không còn ⇒ `dung` false', () => {
    const lc: LuaChonHuong = { tuan: '2026-09-21', khoa: 'uu_tien_hu:h1', ma: 'uu_tien_hu', kieu: 'theo', luc: '2026-09-21T08:00:00.000Z', huId: 'h1' };
    const h1 = huTich('h1', 'Quỹ');
    const co = chamLuaChon(lc, { so: [nap('2026-09-22', 1, 'h1'), nap('2026-09-23', 1, 'h1')], hu: [h1], luat: [], hoSo: {} }, den);
    expect(co).toMatchObject({ dung: true, nap: 2 });
    expect(lamToi(co)).toBe(true);
    const khong = chamLuaChon(lc, { so: [nap('2026-09-22', 1, 'h2')], hu: [h1], luat: [], hoSo: {} }, den);
    expect(khong).toMatchObject({ dung: true, nap: 0 });
    expect(lamToi(khong)).toBe(false);
    const mat = chamLuaChon(lc, { so: [], hu: [], luat: [], hoSo: {} }, den);
    expect(mat.dung).toBe(false);
    expect(lamToi(mat)).toBe(false);
  });

  it('⭐⭐ dòng `huong_giu` không đếm tuần GIỮ NHƯ CŨ (không có việc để "làm tới"), có đếm tuần ưu tiên một hũ', () => {
    const giu: LuaChonHuong = { tuan: '2026-09-14', khoa: 'giu_nhu_cu', ma: 'giu_nhu_cu', kieu: 'theo', luc: '2026-09-14T08:00:00.000Z' };
    const uu: LuaChonHuong = { tuan: '2026-09-21', khoa: 'uu_tien_hu:h1', ma: 'uu_tien_hu', kieu: 'theo', luc: '2026-09-21T08:00:00.000Z', huId: 'h1' };
    const d0 = hocTuQuyetDinh(vao({ hoSo: { huong: [giu] } })).find((x) => x.ma === 'huong_giu');
    expect(d0, 'chỉ có tuần GIỮ NHƯ CŨ ⇒ không dòng huong_giu').toBeUndefined();
    const d1 = hocTuQuyetDinh(vao({ so: [nap('2026-09-22', 1, 'h1')], hu: [huTich('h1', 'Quỹ')], hoSo: { huong: [giu, uu] } })).find((x) => x.ma === 'huong_giu')!;
    expect(d1).toMatchObject({ k: 1, n: 1 });
  });
});

/* ═══ §VII — HỒ SƠ ═════════════════════════════════════════════════════════════════════════════ */

describe('§VII — ⭐⭐⭐ lựa chọn sống qua `locHoSo`, không lọt vào `ctx_*` (P2)', () => {
  it('dòng đúng hình được giữ nguyên; dòng sai hình bị bỏ, không ném', () => {
    const tot: LuaChonHuong = {
      tuan: TUAN, khoa: 'tu_chia_tien_ve:h1:phan_tram', ma: 'tu_chia_tien_ve', kieu: 'theo',
      luc: `${TUAN}T08:00:00.000Z`, huId: 'h1', td: 'phan_tram',
    };
    const loc = locHoSo({ khung: 'hu', huong: [tot, { ...tot, kieu: 'la' }, { ...tot, tuan: 'W39' }, 5, null] });
    expect(loc.huong).toEqual([tot]);
  });

  it('⭐⭐⭐ mã MỚI (`uu_tien_hu` + huId · `giu_nhu_cu`) sống qua `locHoSo`; nối thêm KHÔNG đụng bản ghi mô hình cũ (chỉ nối thêm)', () => {
    const cu: LuaChonHuong = { tuan: '2026-09-21', khoa: 'luat_tien_ve:tien_vua_ve', ma: 'luat_tien_ve', kieu: 'theo', luc: '2026-09-21T08:00:00.000Z', dk: 'tien_vua_ve' };
    const uu: LuaChonHuong = { tuan: TUAN, khoa: 'uu_tien_hu:h1', ma: 'uu_tien_hu', kieu: 'theo', luc: `${TUAN}T08:00:00.000Z`, huId: 'h1' };
    const giu: LuaChonHuong = { tuan: TUAN, khoa: 'giu_nhu_cu', ma: 'giu_nhu_cu', kieu: 'theo', luc: `${TUAN}T09:00:00.000Z` };
    expect(locHoSo({ huong: [cu, uu, giu] }).huong).toEqual([cu, uu, giu]);
    const sau = noiLuaChon({ huong: [cu] }, uu)!;
    expect(sau.huong).toEqual([cu, uu]);
    expect(noiLuaChon(sau, uu), 'chạm lại đúng phương án đang chọn ⇒ không ghi').toBeNull();
    expect(noiLuaChon(sau, giu)!.huong).toEqual([cu, uu, giu]);
  });

  it('⭐⭐⭐ `ctxCuaHoSo` không chở gì của hướng', () => {
    const h = locHoSo({
      khung: 'hu', huong: [{ tuan: TUAN, khoa: 'a', ma: 'hu_tich_dau', kieu: 'theo', luc: `${TUAN}T08:00:00.000Z` }],
    });
    expect(h.huong).toHaveLength(1);
    expect(JSON.stringify(ctxCuaHoSo(h))).not.toContain('hu_tich_dau');
    expect(ctxCuaHoSo(h).map((d) => d.ma)).toEqual(['ctx_khung']);
  });
});

/* ═══ §VIII — MỐC `luc` (UTC) so với `Khoan.ngay` (giờ MÁY): chọn lúc 00:00–06:59 giờ VN không được đếm ngày hôm trước (RÀ 12/10, C2) ═══════ */

describe('§VIII — ⭐⭐⭐ ngày của một mốc ISO là ngày GIỜ MÁY (Asia/Ho_Chi_Minh), không phải ngày UTC', () => {
  let tzCu: string | undefined;
  beforeAll(() => { tzCu = process.env.TZ; process.env.TZ = 'Asia/Ho_Chi_Minh'; });
  afterAll(() => { if (tzCu === undefined) delete process.env.TZ; else process.env.TZ = tzCu; });

  /** 23:30Z 11/10 = 06:30 SÁNG 12/10 giờ VN — tuần bắt đầu thứ Hai 12/10. */
  const LUC_CHON = '2026-10-11T23:30:00.000Z';
  const TUAN_MOI = '2026-10-12';
  const lcUu = (huId: string): LuaChonHuong =>
    ({ tuan: TUAN_MOI, khoa: `uu_tien_hu:${huId}`, ma: 'uu_tien_hu', kieu: 'theo', luc: LUC_CHON, huId });

  it('`ngayCuaLuc`: 23:30Z → ngày kế tiếp giờ VN; 16:59Z vẫn cùng ngày; mốc hỏng không ném', () => {
    expect(ngayCuaLuc('2026-10-11T23:30:00.000Z')).toBe('2026-10-12');
    expect(ngayCuaLuc('2026-10-11T16:59:00.000Z')).toBe('2026-10-11');
    expect(ngayCuaLuc('khong-phai-ngay')).toBe('khong-phai');
  });

  it('⭐⭐⭐ "làm đúng k/n lần": ngày chia vào hũ KHÁC hôm 11/10 (trước lúc chọn theo giờ VN) KHÔNG được đếm ⇒ null ("chưa có lần chia nào"), không 0/1', () => {
    const so = [nap('2026-10-11', 100_000, 'h2')];
    expect(lanLamUuTien(lcUu('h1'), so, '2026-10-12')).toBeNull();
    // đối chứng dương: một cú ngày 12/10 vào hũ đã chọn thì đếm
    expect(lanLamUuTien(lcUu('h1'), [...so, nap('2026-10-12', 100_000, 'h1')], '2026-10-12')).toEqual({ k: 1, n: 1 });
  });

  it('⭐⭐ cùng lớp lỗi ở `vi_the.lenhCua`: lời đoán đặt 06:30 sáng 12/10 giờ VN (23:30Z 11/10) ⇒ ngày bắt đầu điều khoản là 12/10, không 11/10', () => {
    const h = { loiDoan: [{ datLuc: LUC_CHON, han: '2027-01-12' }] } as unknown as Hu;
    expect(lenhCua(h)).toEqual({ tu: '2026-10-12', kyHan: '2027-01-12' });
  });

  it('⭐⭐ CHẤM cùng mẫu: quy tắc tự chia đặt ngày 11/10 là TRƯỚC lúc chọn (06:30 12/10 VN) ⇒ chưa dựng; luật bắn lúc 03:00 VN 19/10 là tuần SAU ⇒ không đếm vào tuần này', () => {
    const lcQuyTac: LuaChonHuong = { tuan: TUAN_MOI, khoa: 'tu_chia_tien_ve:h1:phan_tram', ma: 'tu_chia_tien_ve', kieu: 'theo', luc: LUC_CHON, huId: 'h1', td: 'phan_tram' };
    const h = datTuDong(huTich('h1', 'Quỹ'), { kieu: 'phan_tram', gt: 10 }, '2026-10-11');
    expect(chamLuaChon(lcQuyTac, { so: [], hu: [h], luat: [], hoSo: {} }, '2026-10-18').dung).toBe(false);
    const lcLuat: LuaChonHuong = { tuan: TUAN_MOI, khoa: 'luat_ngay_dam:ngay_chi_lon', ma: 'luat_ngay_dam', kieu: 'theo', luc: LUC_CHON, dk: 'ngay_chi_lon' };
    let l = taoLuatMoi({ loiNhac: 'x', dieuKien: 'ngay_chi_lon', mauId: null }, '2026-10-12T02:00:00.000Z', 'lx');
    l = banLuat(l, '2026-10-18T20:00:00.000Z');                 // 03:00 VN 19/10
    l = ghiNhanGiuVo(l, 'giu', '2026-10-18T20:30:00.000Z');
    const kq = chamLuaChon(lcLuat, { so: [], hu: [], luat: [l], hoSo: {} }, '2026-10-18');
    expect(kq).toMatchObject({ dung: true, giu: 0, vo: 0 });
  });
});
