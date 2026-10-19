/**
 * D532 — TIN TRONG MÀN + LƯỚT SÓNG MUA TIN SỚM (demo `lapTin` · `themTinHinh` · `gaiTin` · `veTruocMan` · `nhanHanhVi`).
 */
import { describe, expect, it } from 'vitest';
import { K_MIN, NEN_LS, PHI_TIN_SOM_BP, SO_NHIP } from '../config/minigame.js';
import { HINH_TIN, SU_KIEN_KE_TIN } from '../config/minigame_tin.js';
import { HINH_CHUNG } from '../config/minigame_hinh.js';
import { dungDongMin, type NenMin } from '../server/holdem/minigame/dong_gia.js';
import { daMuaTin, ketQuaMan, type LenhMan } from '../server/holdem/minigame/khop.js';
import { lapTinMan, suKienTinCua, tinDayDu, tinGai, type TinMan } from '../server/holdem/minigame/tin.js';
import type { NguonMan } from '../server/holdem/minigame/man.js';
import { chuTin } from '../web/src/lib/tin_man.js';

const truoc = (the: string): NguonMan => ({ kind: 'su_kien', the: the as never, lop: 'truoc', xa: 1 });
const no = (the: string): NguonMan => ({ kind: 'su_kien', the: the as never, lop: 'no', xa: 1 });
const gd: NguonMan = { kind: 'giai_doan', giai_doan: 'tang' as never };

describe('D532 — bộ sinh tin (demo `lapTin`)', () => {
  it('⭐ lớp TRƯỚC: đúng MỘT tin rò rỉ thật về thẻ sắp lật + 0–2 tin lan (thật) + một cải chính (nhiễu) · tác động theo DẤU điểm của mã', () => {
    let soLan = 0;
    for (let seed = 1; seed <= 200; seed++) {
      const { tin, troi } = lapTinMan({ seed, nguon: truoc('tang_lai_suat'), diem: -1800 });
      const roRi = tin.filter((t) => t.that && !t.lan);
      expect(roRi, `seed ${seed}`).toHaveLength(1);
      expect(roRi[0]!.chu.startsWith('sk.tang_lai_suat.')).toBe(true);
      expect(roRi[0]!.huong).toBe(-1);
      const lan = tin.filter((t) => t.lan);
      soLan += lan.length;
      expect(lan.length).toBeLessThanOrEqual(2);
      expect(lan.every((t) => t.that && t.huong === -1)).toBe(true);
      expect(tin.filter((t) => t.caiChinh && !t.that)).toHaveLength(1);
      expect(troi).toHaveLength(1 + lan.length);
      expect(troi.every((x) => x.huong === -1)).toBe(true);
      const nhieu = tin.filter((t) => !t.that && !t.caiChinh);
      expect(nhieu.length).toBeGreaterThanOrEqual(3);
      expect(nhieu.length).toBeLessThanOrEqual(6);
      expect(tin.every((t) => t.ci >= 0 && t.ci < 60)).toBe(true);
      expect(tin.map((t) => t.id)).toEqual(tin.map((_, i) => i));
    }
    expect(soLan, 'có màn có tin lan').toBeGreaterThan(0);
  });
  it('lớp NỔ: đúng một tin CÔNG BỐ thật ở nến mịn 16 (nến gốc 8), độ mạnh = mag × góc × 0,5; mã điểm 0 ⇒ không đẩy giá', () => {
    const { tin, troi } = lapTinMan({ seed: 7, nguon: no('ha_lai_suat'), diem: 2400 });
    const cb = tin.filter((t) => t.congBo);
    expect(cb).toHaveLength(1);
    expect(cb[0]).toMatchObject({ ci: 16, that: true, huong: 1, chu: 'cb.ha_lai_suat' });
    expect(troi).toEqual([{ ci: 16, huong: 1, mag: +(SU_KIEN_KE_TIN.ha_lai_suat.mag * 2 * 0.5).toFixed(1) }]);
    expect(lapTinMan({ seed: 7, nguon: no('ha_lai_suat'), diem: 0 }).troi).toEqual([]);
  });
  it('tin HOẢNG LOẠN của engine (chiến tranh…) dùng chữ THIÊN NGA ĐEN (một lá, D390); ô giai đoạn: không tin thật, không đẩy giá', () => {
    expect(suKienTinCua('chien_tranh' as never)).toBe('thien_nga_den');
    expect(suKienTinCua('tang_lai_suat' as never)).toBe('tang_lai_suat');
    const r = lapTinMan({ seed: 3, nguon: truoc('chien_tranh'), diem: -2000 });
    expect(r.tin.some((t) => t.chu.startsWith('sk.thien_nga_den.'))).toBe(true);
    const g = lapTinMan({ seed: 3, nguon: gd, diem: 1200 });
    expect(g.tin.filter((t) => t.that)).toEqual([]);
    expect(g.troi).toEqual([]);
  });
  it('tất định theo seed (replay đọc lại bối cảnh, nhưng hàm cũng không được trôi)', () => {
    expect(lapTinMan({ seed: 99, nguon: truoc('lam_phat'), diem: 900 })).toEqual(lapTinMan({ seed: 99, nguon: truoc('lam_phat'), diem: 900 }));
  });
});

describe('D532 — chữ: mọi ID server sinh ra đều có chữ ở client · bảng hình khớp hình của server', () => {
  it('⭐ 300 màn × mọi lớp + mọi hình có tin + tin gài ⇒ không ID nào thiếu chữ', () => {
    const ids = new Set<string>();
    const theDs = ['tang_lai_suat', 'ha_lai_suat', 'lam_phat', 'hack_san', 'bong_bong', 'chien_tranh'];
    for (let seed = 1; seed <= 300; seed++) {
      const the = theDs[seed % theDs.length]!;
      for (const nguon of [truoc(the), no(the), { kind: 'su_kien', the: the as never, lop: 'du_am', xa: 1 } as NguonMan, gd]) {
        for (const t of lapTinMan({ seed, nguon, diem: (seed % 2 ? 1 : -1) * 1500 }).tin) ids.add(t.chu);
      }
    }
    for (const [h, bang] of Object.entries(HINH_TIN)) for (const c of Object.keys(bang)) ids.add(`hinh.${h}.${c}`);
    ids.add(tinGai(5, 1).chu); ids.add(tinGai(5, -1).chu);
    const thieu = [...ids].filter((id) => !chuTin(id));
    expect(thieu).toEqual([]);
    expect(ids.size).toBeGreaterThan(60);
  });
  it('mọi hình có bình luận đều là hình CÓ THẬT của server', () => {
    const coThat = new Set(HINH_CHUNG.map((h) => h.id));
    expect(Object.keys(HINH_TIN).filter((h) => !coThat.has(h))).toEqual([]);
  });
});

describe('D532 — tin thật ĐẨY giá (demo `dsTroi`)', () => {
  it('cùng seed, có tin thật ⇒ đường sau nến tin lệch theo hướng tin; trước nến tin y nguyên', () => {
    const hinh = HINH_CHUNG[0]!;
    const goc = { seed: 11, ma: 'btc', hinh, bien: 1, nghieng: 0, nhieuX: 1, dai: 'em' as const, q: 0, cheDo: 'thuong' as const };
    const a = dungDongMin({ ...goc, troi: [] }), b = dungDongMin({ ...goc, troi: [{ ci: 20, huong: 1, mag: 10 }] });
    const n0 = NEN_LS * K_MIN;
    expect(b[n0 + 10]!.c).toBeCloseTo(a[n0 + 10]!.c, 9);
    expect(b[n0 + 40]!.c).toBeGreaterThan(a[n0 + 40]!.c);
  });
});

/* ── mua tin sớm + nhãn ── */
function dong(gia: (k: number) => number): NenMin[] {
  const ra: NenMin[] = [];
  for (let i = 0; i < NEN_LS * K_MIN; i++) ra.push({ o: 100, c: 100, h: 100, l: 100, tick: Array(8).fill(100), v: 0, iSong: i, rut: 0, quet: null });
  let t0 = 100;
  for (let j = 0; j < SO_NHIP / 8; j++) {
    const tick = Array.from({ length: 8 }, (_, t) => gia(j * 8 + t));
    ra.push({ o: t0, c: tick[7]!, h: Math.max(t0, ...tick), l: Math.min(t0, ...tick), tick, v: 0, iSong: j, rut: 0, quet: null });
    t0 = tick[7]!;
  }
  return ra;
}
let seq = 0;
const L = (nhip: number, nut: string): LenhMan => ({ seq: ++seq, nhip, nut });
const MUA = () => L(-1, 'mua_tin');
const that = (ci: number, huong: 1 | -1): TinMan => ({ id: 0, ci, ng: 'bao', chu: 'sk.lam_phat.bao', noi: huong, huong, that: true, tang: 0 });

describe('D532 — MUA TIN SỚM (phí · cổng) + nhãn hành vi tin của Lướt Sóng', () => {
  const chay = (lenh: LenhMan[], p: { la?: string; luotSong?: boolean; muTin?: boolean; tin?: TinMan[] } = {}) =>
    ketQuaMan({ min: dong(() => 100), von: 1000, ma: 'cp_cn', la: p.la ?? 'luot_song', lenh, luotSong: p.luotSong ?? true,
      ...(p.muTin ? { muTin: true } : {}), ...(p.tin ? { tinMan: { tin: p.tin, hinh: 'khong_co', seed: 1 } } : {}) });
  it('⭐ đã mua ⇒ phí 2 % vốn trừ vào lãi lỗ màn kể cả không bấm gì (1000 × 200 bp = 20)', () => {
    expect(PHI_TIN_SOM_BP).toBe(200);
    const kq = chay([MUA()]);
    expect([kq.phiTin, kq.loi]).toEqual([20, -20]);
  });
  it('không tính phí: MÙ TIN · lá khác · khoá cũ · cú mua giữa màn (nhịp ≥ 0)', () => {
    expect(chay([MUA()], { muTin: true }).loi).toBe(0);
    expect(chay([MUA()], { la: 'bat_day' }).loi).toBe(0);
    expect(chay([MUA()], { luotSong: false }).loi).toBe(0);
    expect(chay([L(5, 'mua_tin')]).loi).toBe(0);
    expect(daMuaTin({ la: 'luot_song', luotSong: true, lenh: [MUA()] })).toBe(true);
  });
  it('⭐ nhãn: mua + giao dịch CÙNG hướng tin thật trong 3 nến xem sau tin ⇒ DÙNG THÔNG TIN; không ⇒ MUA RỒI BỎ; không mua ⇒ KHÔNG MUA TIN SỚM', () => {
    const tin = [that(10, -1)];   // tin xấu ở nến mịn 10 ⇒ cửa sổ nhịp 80 … 128
    expect(chay([MUA(), L(90, 'dao')], { tin }).nhan).toEqual(expect.arrayContaining(['mua_tin_som', 'dung_thong_tin']));
    expect(chay([MUA(), L(300, 'dao')], { tin }).nhan).toEqual(expect.arrayContaining(['mua_tin_som', 'mua_roi_bo']));
    expect(chay([L(90, 'dao')], { tin }).nhan).toContain('khong_mua_tin_som');
    expect(chay([MUA(), L(90, 'dao')], { tin: [] }).nhan).toContain('mua_khi_khong_co_tin_that');
  });
  it('tinDayDu: màn không có tin ⇒ rỗng; có tin ⇒ thêm tin gài (cùng nến với cú đẩy), đánh số lại theo nến', () => {
    expect(tinDayDu({ hinh: 'x', seed: 1 }, dong(() => 100), 0)).toEqual([]);
    const ds = tinDayDu({ tin: [that(50, 1)], hinh: 'khong_co', seed: 5 }, dong(() => 100), 1);
    expect(ds.map((t) => t.gai ?? false)).toContain(true);
    expect(ds.map((t) => t.ci)).toEqual([...ds.map((t) => t.ci)].sort((a, b) => a - b));
  });
});
