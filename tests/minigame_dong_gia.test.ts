/**
 * D465 — DÒNG GIÁ server KHỚP TỪNG SỐ với demo đã chốt (A11.25). Bộ số `tests/fixtures/minigame_dong_gia_demo.json` xuất từ CHÍNH trang demo
 * (Chrome headless, 145 bối cảnh (D470: + nấc thanh khoản vòng): 5 seed × [ô tự chọn đủ 4 nhóm thẻ · NỔ · TRƯỚC · DƯ ÂM · sức căng ép RẤT CĂNG · Vàng/Trái phiếu (D467) · 6 cặp đặc thù + TRƯỚC ngược dấu pha (D469)]). Mỗi bối cảnh so: kịch bản thẻ
 * (nhóm · biên độ · nghiêng · giật) · hình bốc được · dải căng · xác suất quét · mã băm 80 nến mịn · mã băm 40 nến gộp. Hai bối cảnh còn so nguyên mảng.
 */
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { TAI_SAN, mtGiaiDoan, mtSuKien, type GiaiDoanId, type SuKienId } from '../config/holdem.js';
import type { NacThanhKhoan } from '../config/thanh_khoan_nam_nac.js';
import { nacHieuDung } from '../server/holdem/engine.js';
import type { OThiTruong } from '../server/holdem/map.js';
import { HO_HINH } from '../config/minigame.js';
import { HINH_CHUNG } from '../config/minigame_hinh.js';
import {
  cheDoCua, chonHinh, dungDongMin, gopHaiNen, giaTaiNhip, heSoLop, kichBanThe, xacSuatQuet,
  type CuDay, type DaiCang, type LopThe, type NenMin, type NhomThe,
} from '../server/holdem/minigame/dong_gia.js';

interface Ca {
  vao: { ma: string; o: NhomThe; seed: number; the?: SuKienId; lop?: LopThe; xa?: number; cang?: DaiCang | 'map'; tk?: NacThanhKhoan | 'auto' };
  nac: NacThanhKhoan;
  hinh: string; o: NhomThe; bien: number; nghieng: number; nhieuX: number; dai: DaiCang; q: number; troi: CuDay[];
  bamMin: string; bamGop: string; soMin: number; soGop: number; min?: number[][]; gop?: number[][];
}
const DL = JSON.parse(readFileSync(new URL('./fixtures/minigame_dong_gia_demo.json', import.meta.url), 'utf8')) as { ca: Ca[] };

// Cùng hàm băm + cùng cách xếp số với trang xuất (scratchpad/mc/xuat_dong.js).
const fnv = (s: string) => { let h = 0x811c9dc5; for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 0x01000193) >>> 0; } return h.toString(16).padStart(8, '0'); };
const nenSo = (c: NenMin) => [c.o, c.c, c.h, c.l, ...c.tick, c.v, c.iSong, c.rut, c.quet === 'sap' ? 1 : c.quet === 'rut' ? 2 : 0, c.trang ? 1 : 0, c.trangBan ? 1 : 0];

/** Quy ước của demo ở chế độ ô tự chọn (`DIEM_O`): điểm GIAI ĐOẠN v42 theo HƯỚNG CỦA MÃ — mã trú ẩn (điểm pha Tăng âm: USDT · Vàng · Trái phiếu) đi ngược thị trường. */
function diemOTuChon(ma: string, o: NhomThe): number {
  const gd = mtGiaiDoan('v42')[ma]!;
  if (gd.tang < 0) return o === 'giam' ? gd.tang : o === 'tang' ? gd.giam : o === 'ngang' ? gd.di_ngang : gd.bien_dong;
  return o === 'ngang' ? gd.di_ngang : gd[o];
}

function dung(ca: Ca) {
  const { ma, seed, the, xa } = ca.vao, lop = ca.vao.lop ?? 'no';
  const kb = the ? kichBanThe(ma, the, lop, xa ?? 1) : { o: ca.vao.o, bien: 1, nghieng: 0, nhieuX: 1 };
  const diem = the ? (mtSuKien('v42')[ma]?.[the] ?? 0) : diemOTuChon(ma, ca.vao.o);
  const cheDo = cheDoCua(ma, !!the);   // D468 — demo: phòng thủ + ô tự chọn ⇒ dưỡng sinh, phòng thủ + thẻ ⇒ cực đoan
  const hinh = chonHinh(seed, ma, kb.o, lop, cheDo, diem, the);
  const L = the ? heSoLop(lop, xa ?? 1) : 1;
  const cangEp = ca.vao.cang && ca.vao.cang !== 'map' ? ca.vao.cang : undefined;
  const { q, dai } = xacSuatQuet(seed, ma, diem, L, cangEp, cheDo);
  const min = dungDongMin({ seed, ma, hinh, bien: kb.bien, nghieng: kb.nghieng, nhieuX: kb.nhieuX, dai, q, troi: ca.troi, cheDo, nac: ca.nac });   // D470
  return { kb, hinh, q, dai, min };
}

describe('§I — 145 bối cảnh của demo: server ra ĐÚNG TỪNG SỐ', () => {
  it('bộ số đủ 145 bối cảnh, đủ sáu mã và bốn nhóm thẻ', () => {
    expect(DL.ca).toHaveLength(145);
    expect(DL.ca.filter((c) => c.nghieng !== 0).length, 'phải có bối cảnh TRƯỚC nghiêng thật').toBeGreaterThan(0);
    expect(new Set(DL.ca.map((c) => c.vao.ma))).toEqual(new Set(['btc', 'cp_cn', 'vn30', 'usd', 'vang', 'tpcp']));
    expect(new Set(DL.ca.map((c) => c.o))).toEqual(new Set(['giam', 'tang', 'ngang', 'bien_dong']));
  });
  for (const [i, ca] of DL.ca.entries()) {
    it(`#${i} ${ca.vao.ma} · ${ca.vao.the ?? 'ô ' + ca.vao.o}${ca.vao.lop ? ' · ' + ca.vao.lop : ''} · seed ${ca.vao.seed}`, () => {
      const r = dung(ca);
      expect({ o: r.kb.o, bien: r.kb.bien, nghieng: r.kb.nghieng, nhieuX: r.kb.nhieuX }).toEqual({ o: ca.o, bien: ca.bien, nghieng: ca.nghieng, nhieuX: ca.nhieuX });
      expect(r.hinh.id).toBe(ca.hinh);
      expect(r.dai).toBe(ca.dai);
      expect(r.q).toBe(ca.q);
      expect(r.min).toHaveLength(ca.soMin);
      if (ca.min) expect(r.min.map(nenSo)).toEqual(ca.min);
      expect(fnv(JSON.stringify(r.min.map(nenSo)))).toBe(ca.bamMin);
      const gop = gopHaiNen(r.min);
      expect(gop).toHaveLength(ca.soGop);
      if (ca.gop) expect(gop.map(nenSo)).toEqual(ca.gop);
      expect(fnv(JSON.stringify(gop.map(nenSo)))).toBe(ca.bamGop);
    });
  }
});

describe('§I.b — D470: nấc thanh khoản demo tự tính "theo thẻ" = nấc ENGINE tính (`nacHieuDung`, năm nấc, chưa tính lãi suất)', () => {
  // Ô tự chọn của demo = ô giai đoạn theo quy ước `DIEM_O` (mã trú ẩn đi ngược thị trường).
  const phaCuaO = (ma: string, o: NhomThe): GiaiDoanId => {
    const lat = (mtGiaiDoan('v42')[ma]!.tang < 0) ? { tang: 'giam', giam: 'tang' } as Record<string, GiaiDoanId> : {};
    return o === 'ngang' ? 'di_ngang' : lat[o] ?? (o as GiaiDoanId);
  };
  const tuDo = DL.ca.filter((c) => (c.vao.tk ?? 'auto') === 'auto' && (!c.vao.the || (c.vao.lop ?? 'no') === 'no'));
  it(`${tuDo.length} bối cảnh "theo thẻ" ở ô của vòng (NỔ hoặc ô tự chọn) — nấc khớp engine`, () => {
    expect(tuDo.length).toBeGreaterThan(40);
    for (const c of tuDo) {
      const ts = TAI_SAN.find((t) => t.id === c.vao.ma)!;
      const o: OThiTruong = c.vao.the
        ? { kind: 'su_kien', su_kien: c.vao.the, la_tin_gia: false, boi_canh: 'don_doc', bao_truoc: 'giam' } as OThiTruong
        : { kind: 'giai_doan', giai_doan: phaCuaO(c.vao.ma, c.vao.o) };
      expect(nacHieuDung({ id: ts.id, thanh_khoan: ts.thanh_khoan }, o, null, true), `${c.vao.ma} · ${c.vao.the ?? c.vao.o}`).toBe(c.nac);
    }
  });
});

describe('§II — tính chất', () => {
  it('TẤT ĐỊNH: cùng đầu vào ⇒ cùng 80 nến (gọi hai lần, không đọc đồng hồ)', () => {
    const a = dung(DL.ca[0]!).min, b = dung(DL.ca[0]!).min;
    expect(JSON.stringify(a)).toBe(JSON.stringify(b));
  });
  it('mọi hình của một nhóm thẻ nằm trong đúng MỘT họ của nhóm đó (như `__mc.kiemHo()` của demo)', () => {
    for (const [g, ho] of Object.entries(HO_HINH)) {
      const co = Object.values(ho).flat(), can = HINH_CHUNG.filter((h) => h.o.includes(g)).map((h) => h.id);
      expect([...co].sort(), g).toEqual([...can].sort());
      expect(new Set(co).size, g).toBe(co.length);
    }
  });
  it('giá theo NHỊP: 480 nhịp, nhịp 8j + 7 = giá đóng nến chạy thứ j; ngoài khoảng thì kẹp', () => {
    const min = dung(DL.ca[0]!).min, chay = min.slice(20);
    expect(chay).toHaveLength(60);
    for (const j of [0, 17, 59]) expect(giaTaiNhip(min, 8 * j + 7)).toBe(chay[j]!.c);
    expect(giaTaiNhip(min, -5)).toBe(chay[0]!.tick[0]);
    expect(giaTaiNhip(min, 10_000)).toBe(chay[59]!.c);
  });
});

describe('§III — BỐC HÌNH: 2.880 lượt bốc của demo (6 mã × 4 nhóm thẻ × NỔ/DƯ ÂM × 60 seed)', () => {
  // Bối cảnh ở §I chỉ có 5 seed ⇒ bắt lệch HỖN HỢP HỌ không chắc (tiêm 0,5 → 0,7 ở họ "thẳng" của thẻ giảm mà vẫn xanh). Bộ này bắt được.
  const BH = JSON.parse(readFileSync(new URL('./fixtures/minigame_chon_hinh_demo.json', import.meta.url), 'utf8')) as { chon: [string, NhomThe, LopThe, number, string][] };
  it('server bốc ĐÚNG hình demo bốc ở mọi lượt; bộ số phủ đủ 38 hình', () => {
    expect(BH.chon).toHaveLength(2880);
    expect(new Set(BH.chon.map((c) => c[4])).size).toBe(HINH_CHUNG.length);
    const lech = BH.chon.filter(([ma, o, lop, seed, id]) => chonHinh(seed, ma, o, lop, cheDoCua(ma, false), diemOTuChon(ma, o)).id !== id);
    expect(lech.slice(0, 5)).toEqual([]);
  });
});
