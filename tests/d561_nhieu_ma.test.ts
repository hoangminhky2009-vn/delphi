/**
 * D561 — ĐÁNH MÀN TRÊN NHIỀU MÃ (khoá v65 `nhieuMa`, founder 08/10: "cả khoản, đo rồi mới thêm cần gạt"). Mỗi khoản có dòng giá một màn con
 * (vốn = cả khoản, cùng đồng hồ, cùng lõi); lệnh mang `ma` (vắng = mã chính). Bot vẫn một mã. Vector chép tay: kết quả mỗi mã = đúng `ketQuaMan`
 * của màn con ấy với lệnh của riêng nó; tổng áp vào đúng từng khoản.
 */
import { describe, expect, it } from 'vitest';
import { luatCua } from '../config/holdem.js';
import { coManMinigame } from '../config/holdem.js';
import { taoTran, type Ghe, type TrangThaiTran } from '../server/holdem/engine.js';
import { soDoGhe } from '../server/holdem_api.js';
import { apMg, boiCanhNguoi, dungDongManKhop, thamSoKhop, tinhMgCaBan } from '../server/holdem/minigame/quyet_toan.js';
import { ketQuaMan, laCuaMan, type LenhMan } from '../server/holdem/minigame/khop.js';
import { bcCuaMa, lenhCuaMa, type BoiCanhMan } from '../server/holdem/minigame/man.js';

const V64 = 'balance-v64-congoi', V65 = 'balance-v65-thangkynang';
const VT = { btc: 3000, vang: 1000, cp_cn: 600 };

function ban(khoa: string, seed: number): { st: TrangThaiTran; v: number } | null {
  const goc = taoTran(seed, soDoGhe(seed, 'u') as never, luatCua(khoa), 14);
  const v = [2, 3, 4, 5, 6].find((x) => coManMinigame(x, goc.map.o.length, goc.nhip_xen_ke === true));
  if (!v) return null;
  const st: TrangThaiTran = { ...goc, vong: v, ghe: goc.ghe.map((g): Ghe => (g.id === 'ban'
    ? { ...g, von: 200, vi_the: { ...VT }, danh_muc: { ...g.danh_muc, chien_thuat: ['bat_day'] as never } } : g)) };
  return { st, v };
}
const nguoi = (st: TrangThaiTran) => st.ghe.find((g) => g.id === 'ban')!;

describe('D561 nhiều mã — bối cảnh', () => {
  it('khoá v65: mã chính = khoản lớn nhất, mỗi khoản khác một màn con vốn = cả khoản; nạp chỉ từ tiền mặt; màn con không Tâm lý yếu', () => {
    const b = ban(V65, 6_100_001)!;
    const bc = boiCanhNguoi(b.st, 6_100_001, b.v, nguoi(b.st), null) as BoiCanhMan;
    expect(bc.ma).toBe('btc');
    expect(bc.von).toBe(3000);
    expect((bc.nhieu ?? []).map((x) => [x.ma, x.von]).sort()).toEqual([['cp_cn', 600], ['vang', 1000]]);
    expect(Object.keys(bc.nap_tu ?? {})).toEqual(['tien']);
    for (const x of bc.nhieu ?? []) {
      expect(x.nap_tu).toBeUndefined();
      expect(x.tam_ly_yeu).toBeUndefined();
      expect(x.tung_tin).toBeUndefined();
    }
    expect(bcCuaMa(bc, 'vang')?.ma).toBe('vang');
    expect(bcCuaMa(bc, undefined)).toBe(bc);
    expect(bcCuaMa(bc, 'usd')).toBeNull();
  });
  it('khoá v64: một mã như cũ (không màn con)', () => {
    const b = ban(V64, 6_100_001)!;
    const bc = boiCanhNguoi(b.st, 6_100_001, b.v, nguoi(b.st), null) as BoiCanhMan;
    expect(bc.nhieu).toBeUndefined();
    expect(Object.keys(bc.nap_tu ?? {}).sort()).toEqual(['cp_cn', 'tien', 'vang']);
  });
  it('lenhCuaMa: lệnh không `ma` thuộc mã chính', () => {
    const bc = { ma: 'btc' } as BoiCanhMan;
    const l: LenhMan[] = [{ seq: 1, nhip: 5, nut: 'vao_het' }, { seq: 2, nhip: 9, nut: 'vao_het', ma: 'vang' }, { seq: 3, nhip: 9, nut: 'thoat', ma: 'btc' }];
    expect(lenhCuaMa(bc, l, 'btc').map((x) => x.seq)).toEqual([1, 3]);
    expect(lenhCuaMa(bc, l, 'vang').map((x) => x.seq)).toEqual([2]);
  });
});

describe('D561 nhiều mã — quyết toán', () => {
  it('⭐ lệnh trên mã phụ: kết quả mã ấy = ketQuaMan của màn con với lệnh riêng; mã chính không đổi; apMg cộng đúng khoản', () => {
    let soLan = 0, coLoi = 0;
    for (let s = 0; s < 40; s++) {
      const seed = 6_200_003 + s * 7919;
      const b = ban(V65, seed);
      if (!b) continue;
      const g = nguoi(b.st);
      const bc = boiCanhNguoi(b.st, seed, b.v, g, null);
      if ('loi' in bc || !bc.nhieu?.length) continue;
      const lenh: LenhMan[] = [{ seq: 1, nhip: 40, nut: 'ban_bot', ma: 'vang' }, { seq: 2, nhip: 200, nut: 'vao_het', ma: 'vang' }];
      const r = tinhMgCaBan(b.st, { seedTran: seed, vong: b.v, loiSuat: null, ban: { lenh, bc } });
      const sub = bcCuaMa(bc, 'vang')!;
      const la = laCuaMan(['bat_day'], lenh);
      const tay = ketQuaMan({ min: dungDongManKhop(sub, lenhCuaMa(bc, lenh, 'vang')), ...thamSoKhop(sub), la, lenh: lenhCuaMa(bc, lenh, 'vang') });
      const chinh = ketQuaMan({ min: dungDongManKhop(bc, []), ...thamSoKhop(bc), la, lenh: [] });
      const mg = r.mg['ban'];
      const vang = mg?.them?.find((x) => x.ma === 'vang')?.loi ?? 0;
      expect(vang).toBe(tay.loi);
      expect(mg?.ma ?? 'btc').toBe('btc');
      expect(mg?.loi ?? 0).toBe(chinh.loi);
      expect(r.nhieu?.find((x) => x.ma === 'vang')?.loi).toBe(tay.loi);
      const sau = nguoi(apMg(b.st, r.mg));
      expect(sau.vi_the.vang).toBe(Math.max(0, VT.vang + vang));
      expect(sau.vi_the.btc).toBe(Math.max(0, VT.btc + (mg?.loi ?? 0)));
      soLan += 1;
      if (tay.loi !== 0) coLoi += 1;
    }
    expect(soLan).toBeGreaterThan(10);
    expect(coLoi).toBeGreaterThan(5);   // bài không rỗng: lệnh thật sự đổi kết quả
  });
  it('không bấm gì: mọi màn con giữ suốt (lãi/lỗ so với giữ ≈ 0, không tự chơi thay)', () => {
    for (let s = 0; s < 15; s++) {
      const seed = 6_300_007 + s * 7919;
      const b = ban(V65, seed);
      if (!b) continue;
      const r = tinhMgCaBan(b.st, { seedTran: seed, vong: b.v, loiSuat: null, ban: { lenh: [] } });
      for (const x of r.nhieu ?? []) expect(x.tuDong).toBe(true);
    }
  });
  it('khoá v64: lệnh mang `ma` lạ không chạm khoản nào ngoài mã chính', () => {
    const seed = 6_200_003, b = ban(V64, seed)!;
    const r = tinhMgCaBan(b.st, { seedTran: seed, vong: b.v, loiSuat: null, ban: { lenh: [{ seq: 1, nhip: 200, nut: 'vao_het', ma: 'vang' }] } });
    expect(r.mg['ban']?.them).toBeUndefined();
    expect(r.nhieu).toBeUndefined();
  });
});
