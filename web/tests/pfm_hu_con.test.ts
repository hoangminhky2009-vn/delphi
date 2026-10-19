/**
 * PFM — HŨ CON (SPEC `pfm-tang-khong-gian` câu 3 = A: LÀM, một tầng, CHỈ Ở MÁY, tổng cha = tổng con).
 *
 *   §I    TỔNG CHA = TỔNG CON — đẳng thức `tongCon + chuaChia = tongCha` đúng trong mọi trạng thái; nạp qua hũ con không để lại "chưa chia".
 *   §II   LUẬT TẠO — một tầng · mức nguyên dương · không vượt mức cha · không thêm vào hũ đã đóng.
 *   §III  KHÔNG CẤT SỐ TIỀN — xoá khoản ⇒ hũ con tự rớt khoản ấy (tính, không cất).
 *   §IV   CHỈ Ở MÁY — `KIEU_LAT.hu_con = 'khong'`, két không gom, tệp logic không chạm mạng/telemetry.
 *   §V    NÂNG KHO v2 → v3 KHÔNG MẤT HŨ CŨ — dựng DB v2 đóng băng có hũ thật, mở bằng `moKho`.
 *   §VI   ĐƯỜNG GHI — `napVaoConKho`: đi đường cũ của hũ cha, gán khoản cho hũ con, không đủ ví thì không ghi gì.
 */
import 'fake-indexeddb/auto';
import fs from 'node:fs';
import path from 'node:path';
import { beforeEach, describe, expect, it } from 'vitest';
import {
  LoiHuCon, conCua, daGopCon, daTieuCon, ganKhoan, taoHuCon, tongHopCha, type HuCon,
} from '../src/pfm/hu_con.js';
import { tuTao, type Hu } from '../src/pfm/hu.js';
import { khoanRaBanGhi, taoKhoan, type Khoan } from '../src/pfm/so.js';
import { taoKhoanPhanBo } from '../src/pfm/phan_bo.js';
import { napVaoConKho, ghiHuConKho } from '../src/pfm/sua_ban_ghi.js';
import { KhoTrongBoNho, NGAN, PHIEN_BAN_KET, PHIEN_BAN_KHO } from '../src/pfm/kho.js';
import { moKho } from '../src/pfm/kho_idb.js';
import { KIEU_LAT, gomLat, nganCuaLat } from '../src/pfm/ket.js';

const LUC = '2026-10-05T10:00:00.000Z';
const THANG = '2026-10';
const NGAY = '2026-10-11';

const cha = (id = 'h1', o: Partial<Parameters<typeof tuTao>[0]> = {}): Hu => tuTao({ ten: 'Đà Lạt', muc: 3_000_000, ...o }, LUC, id);
const nap = (id: string, huId: string, so: number, luc = LUC): Khoan =>
  taoKhoanPhanBo({ ngay: NGAY, soTien: so, huId, phanBo: 'tay' }, luc, id);
const gan = (id: string, huId: string, so: number, ngay = NGAY): Khoan =>
  taoKhoanPhanBo({ ngay, soTien: so, huId, phanBo: 'gan' }, LUC, id);
const con = (id: string, chaId: string, ten: string, muc: number, ids: string[] = []): HuCon =>
  ({ id, chaId, ten, muc, khoanIds: ids, taoLuc: `${LUC}${id}` });

describe('§I — ⭐⭐ TỔNG CHA = TỔNG CON', () => {
  it('⭐ cha có con, mọi khoản nạp đi qua con ⇒ tổng con = tổng cha, chưa chia = 0', () => {
    const h = cha();
    const so = [nap('a', 'h1', 300_000), nap('b', 'h1', 400_000), nap('c', 'h1', 200_000)];
    const cons = [con('c1', 'h1', 'Vé xe', 600_000, ['a']), con('c2', 'h1', 'Ở', 1_600_000, ['b']), con('c3', 'h1', 'Ăn chơi', 800_000, ['c'])];
    const t = tongHopCha(h, cons, so, THANG);
    expect(t.tongCha).toBe(900_000);
    expect(t.tongCon).toBe(900_000);
    expect(t.chuaChia, 'không còn phần nào chưa gán cho hũ con').toBe(0);
    expect(t.tongCon + t.chuaChia).toBe(t.tongCha);
    expect(t.hang.map((r) => r.so)).toEqual([300_000, 400_000, 200_000]);
  });

  it('⭐ đẳng thức `tongCon + chuaChia = tongCha` ĐÚNG KỂ CẢ khi còn tiền nạp thẳng vào cha (hàng "chưa chia" nói thật)', () => {
    const h = cha();
    const so = [nap('a', 'h1', 300_000), nap('thang', 'h1', 500_000)];   // 500k nạp thẳng vào cha, không gán cho con
    const t = tongHopCha(h, [con('c1', 'h1', 'Vé xe', 600_000, ['a'])], so, THANG);
    expect(t.tongCha).toBe(800_000);
    expect(t.tongCon).toBe(300_000);
    expect(t.chuaChia).toBe(500_000);
    expect(t.tongCon + t.chuaChia).toBe(t.tongCha);
  });

  it('rút ra khỏi cha ⇒ `chuaChia` có thể ÂM — không kẹp về 0 (nói thật, cùng lý lẽ `tongGopVaoHu`)', () => {
    const h = cha();
    const rut = taoKhoanPhanBo({ ngay: NGAY, soTien: 100_000, huId: 'h1', phanBo: 'tay', chieu: 'thu' }, LUC, 'r');
    const t = tongHopCha(h, [con('c1', 'h1', 'Vé', 600_000, ['a'])], [nap('a', 'h1', 300_000), rut], THANG);
    expect(t.tongCha).toBe(200_000);
    expect(t.tongCon, 'hũ con vẫn giữ phần ĐÃ GÁN (300k): khoản rút `r` không gán cho con nào').toBe(300_000);
    expect(t.chuaChia, 'phần rút làm `chuaChia` ÂM — nói thật, không kẹp').toBe(-100_000);
    expect(t.tongCon + t.chuaChia).toBe(t.tongCha);
  });

  it('hũ cha KHÔNG có con ⇒ bảng rỗng, tổng cha giữ nguyên, `chuaChia` = tổng cha', () => {
    const t = tongHopCha(cha(), [], [nap('a', 'h1', 123_000)], THANG);
    expect(t.hang).toEqual([]);
    expect(t.tongCha).toBe(123_000);
    expect(t.chuaChia).toBe(123_000);
  });

  it('con của hũ KHÁC không lọt vào bảng (một tầng, một cha)', () => {
    const t = tongHopCha(cha('h1'), [con('x', 'h2', 'Của hũ khác', 100_000, ['a'])], [nap('a', 'h1', 50_000)], THANG);
    expect(t.hang).toEqual([]);
  });
});

describe('§II — LUẬT TẠO', () => {
  it('⭐ MỨC con vượt phần cha còn nhận ⇒ ném `LoiHuCon` (cha đã đặt mức)', () => {
    const h = cha();
    const da = [con('c1', 'h1', 'Ở', 2_500_000)];
    expect(() => taoHuCon({ ten: 'Ăn', muc: 600_000 }, h, da, LUC, 'c2')).toThrow(LoiHuCon);
    expect(() => taoHuCon({ ten: 'Ăn', muc: 500_000 }, h, da, LUC, 'c2'), 'vừa khít thì được').not.toThrow();
  });

  it('cha CHƯA đặt mức ⇒ không có trần (`conNhan` null) — app không tự điền mức cho ai (P3)', () => {
    const h = cha('h1', { muc: null as unknown as number });
    expect(() => taoHuCon({ ten: 'Ăn', muc: 9_000_000 }, h, [], LUC, 'c')).not.toThrow();
    expect(tongHopCha({ ...h, muc: null }, [], [], THANG).conNhan).toBeNull();
  });

  it('tên rỗng · mức không nguyên · mức ≤ 0 · cha đã xong/bỏ ⇒ ném', () => {
    const h = cha();
    expect(() => taoHuCon({ ten: '   ', muc: 1000 }, h, [], LUC, 'c')).toThrow(LoiHuCon);
    expect(() => taoHuCon({ ten: 'A', muc: 1000.5 }, h, [], LUC, 'c')).toThrow(LoiHuCon);
    expect(() => taoHuCon({ ten: 'A', muc: 0 }, h, [], LUC, 'c')).toThrow(LoiHuCon);
    expect(() => taoHuCon({ ten: 'A', muc: -5 }, h, [], LUC, 'c')).toThrow(LoiHuCon);
    expect(() => taoHuCon({ ten: 'A', muc: 1000 }, { ...h, trangThai: 'xong' }, [], LUC, 'c')).toThrow(LoiHuCon);
    expect(() => taoHuCon({ ten: 'A', muc: 1000 }, { ...h, trangThai: 'bo_do' }, [], LUC, 'c')).toThrow(LoiHuCon);
  });

  it('hũ con mới KHÔNG có khoản nào và nối đúng hũ cha; tên được chuẩn hoá', () => {
    const c = taoHuCon({ ten: '  Vé   xe  ', muc: 600_000 }, cha(), [], LUC, 'c1');
    expect(c).toMatchObject({ id: 'c1', chaId: 'h1', ten: 'Vé xe', muc: 600_000, khoanIds: [] });
  });

  it('⭐ MỘT TẦNG: bản ghi hũ con không có trường nào để một hũ con làm cha của hũ con khác', () => {
    const c = taoHuCon({ ten: 'A', muc: 1000 }, cha(), [], LUC, 'c1');
    expect(Object.keys(c).sort()).toEqual(['chaId', 'id', 'khoanIds', 'muc', 'ten', 'taoLuc'].sort());
    // `taoHuCon` nhận một `Hu` (ngăn `hu`), không nhận `HuCon` — kiểm ở mức kiểu; ở mức chạy: đếm con của một con luôn rỗng.
    expect(conCua([c], 'c1'), 'không hũ nào là con của một hũ con').toEqual([]);
  });

  it('`ganKhoan` idempotent — gán hai lần cùng một khoản không đếm hai lần', () => {
    const c0 = con('c1', 'h1', 'A', 1000);
    const c1 = ganKhoan(ganKhoan(c0, 'k1'), 'k1');
    expect(c1.khoanIds).toEqual(['k1']);
  });
});

describe('§III — ⭐ KHÔNG CẤT SỐ TIỀN: xoá khoản ⇒ hũ con tự rớt', () => {
  it('khoản bị xoá khỏi sổ (hoàn tác) thì `daGopCon` giảm đúng bằng ấy — không số cũ nào kẹt lại trên hũ con', () => {
    const h = cha();
    const c = con('c1', 'h1', 'Vé', 600_000, ['a', 'b']);
    const day = [nap('a', 'h1', 300_000), nap('b', 'h1', 200_000)];
    expect(daGopCon(c, h, day)).toBe(500_000);
    expect(daGopCon(c, h, [day[0]!])).toBe(300_000);
  });

  it('khoản chưa được gán cho hũ con thì KHÔNG tính vào nó (dù cùng hũ cha)', () => {
    expect(daGopCon(con('c1', 'h1', 'Vé', 1000, ['a']), cha(), [nap('a', 'h1', 10_000), nap('z', 'h1', 77_000)])).toBe(10_000);
  });

  it('cha RESET (mốc góp) ⇒ hũ con cũng đếm sau mốc — cùng luật `laGopVaoHu`', () => {
    const h = { ...cha(), mocGop: '2026-10-08T00:00:00.000Z' };
    const truoc = nap('a', 'h1', 300_000, '2026-10-05T00:00:00.000Z');
    const sau = nap('b', 'h1', 100_000, '2026-10-09T00:00:00.000Z');
    expect(daGopCon(con('c1', 'h1', 'Vé', 1000, ['a', 'b']), h, [truoc, sau])).toBe(100_000);
  });

  it('hũ cha TIÊU DÙNG: hũ con đếm khoản GÁN trong tháng, chia vào (+) gỡ ra (−), tháng khác không tính', () => {
    const h = tuTao({ ten: 'Ăn uống', muc: 1_500_000, nhom: 'tieu_dung' }, LUC, 'h4');
    const g1 = gan('g1', 'h4', 100_000);
    const g2 = gan('g2', 'h4', 40_000);
    const go = taoKhoanPhanBo({ ngay: NGAY, soTien: 30_000, huId: 'h4', phanBo: 'gan', chieu: 'thu' }, LUC, 'g3');
    const thangKhac = gan('g4', 'h4', 999_000, '2026-09-20');
    const c = con('c1', 'h4', 'Cơm trưa', 800_000, ['g1', 'g2', 'g3', 'g4']);
    expect(daTieuCon(c, h, [g1, g2, go, thangKhac], THANG)).toBe(110_000);
    expect(tongHopCha(h, [c], [g1, g2, go, thangKhac], THANG).tongCha).toBe(110_000);
  });
});

describe('§IV — ⭐⭐ CHỈ Ở MÁY (SPEC: không đổi dữ liệu rời máy)', () => {
  it('ngăn `hu_con` có trong kho và KHÔNG vào két (không lát tháng, không lát sống)', () => {
    expect(NGAN).toContain('hu_con');
    expect(KIEU_LAT.hu_con).toBe('khong');
    expect(nganCuaLat('thang')).not.toContain('hu_con');
    expect(nganCuaLat('song')).not.toContain('hu_con');
  });

  it('⭐ gói lát SỐNG dựng từ kho có hũ con ⇒ KHÔNG chứa một byte của hũ con', () => {
    const b = { id: 'c1', thang: THANG, suaLuc: LUC, d: con('c1', 'h1', 'Bí mật', 600_000) };
    const lat = gomLat('song', { hu_con: [b], hu: [] });
    expect(Object.keys(lat)).not.toContain('hu_con');
    expect(JSON.stringify(lat)).not.toContain('Bí mật');
  });

  it('nhãn schema của két giữ NGUYÊN (2) dù kho IndexedDB nâng lên 3 — hình dạng gói két không đổi', () => {
    expect(PHIEN_BAN_KHO).toBe(3);
    expect(PHIEN_BAN_KET).toBe(2);
  });

  it('⭐ tệp logic hũ con không import mạng · telemetry · đồng bộ · két', () => {
    const ma = fs.readFileSync(path.join(process.cwd(), 'src/pfm/hu_con.ts'), 'utf8')
      .replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');
    const imports = [...ma.matchAll(/from\s+'([^']+)'/g)].map((m) => m[1]);
    for (const i of imports) {
      expect(i, `hu_con.ts nhập "${i}"`).not.toMatch(/dong_bo|telemetry|api|ket|fetch|client/);
    }
  });
});

describe('§V — ⭐⭐ NÂNG KHO v2 → v3 KHÔNG MẤT HŨ CŨ', () => {
  const TEN_DB = 'delphi_pfm_u1';   // D603: tên kho mang user_id — `tenKho('u1')`
  /** Đúng hình dạng v2 ĐÓNG BĂNG — KHÔNG đọc từ `NGAN` hiện tại (đó là cả điểm của bài này). */
  const NGAN_V2 = ['khoan', 'hu', 'luat', 'mau_lap', 'nhip', 'outbox', 'meta'] as const;

  beforeEach(async () => {
    await new Promise<void>((ok) => {
      const r = indexedDB.deleteDatabase(TEN_DB);
      r.onsuccess = () => ok(); r.onerror = () => ok(); r.onblocked = () => ok();
    });
  });

  it('⭐ dựng DB ở v2 (như trước PFM tầng không gian) có hũ + khoản thật — mở bằng `moKho` (v3): còn nguyên, ngăn mới dùng được ngay', async () => {
    await new Promise<void>((ok, loi) => {
      const yc = indexedDB.open(TEN_DB, 2);
      yc.onupgradeneeded = () => {
        for (const n of NGAN_V2) {
          const s = yc.result.createObjectStore(n, { keyPath: 'id' });
          s.createIndex('thang', 'thang', { unique: false });
          s.createIndex('suaLuc', 'suaLuc', { unique: false });
        }
      };
      yc.onsuccess = () => {
        const tx = yc.result.transaction(['hu', 'khoan'], 'readwrite');
        tx.objectStore('hu').put({ id: 'hu-cu', thang: '2026-08', suaLuc: '2026-08-01T00:00:00.000Z', d: { ten: 'Du lịch' } });
        tx.objectStore('khoan').put({ id: 'k-cu', thang: '2026-08', suaLuc: '2026-08-02T00:00:00.000Z', d: { soTien: 45_000 } });
        tx.oncomplete = () => { yc.result.close(); ok(); };
        tx.onerror = () => loi(tx.error);
      };
      yc.onerror = () => loi(yc.error);
    });

    const k3 = await moKho('u1');
    expect((await k3.doc<{ ten: string }>('hu', 'hu-cu'))?.d.ten, 'hũ cũ phải còn').toBe('Du lịch');
    expect((await k3.doc<{ soTien: number }>('khoan', 'k-cu'))?.d.soTien, 'khoản cũ phải còn').toBe(45_000);
    // Ngăn MỚI có mặt và dùng được ngay — không cần bước nào thêm.
    await k3.ghi('hu_con', { id: 'c-moi', thang: '2026-10', suaLuc: '2026-10-11T00:00:00.000Z', d: { ten: 'Vé xe' } });
    expect((await k3.doc<{ ten: string }>('hu_con', 'c-moi'))?.d.ten).toBe('Vé xe');
    expect(await k3.dem('hu_con')).toBe(1);
    k3.dong();
  });

  it('mở kho v3 lần hai (đã có hũ con) không mất hũ con', async () => {
    const a = await moKho('u1');
    await a.ghi('hu_con', { id: 'c1', thang: '2026-10', suaLuc: '2026-10-11T00:00:00.000Z', d: { ten: 'Ở' } });
    a.dong();
    const b = await moKho('u1');
    expect((await b.doc<{ ten: string }>('hu_con', 'c1'))?.d.ten).toBe('Ở');
    b.dong();
  });

  it('`xoaSach` (P9) xoá cả hũ con — quyền xoá không bỏ sót ngăn mới', async () => {
    const k = new KhoTrongBoNho();
    await k.ghi('hu_con', { id: 'c1', thang: '2026-10', suaLuc: LUC, d: { ten: 'Ở' } });
    await k.xoaSach();
    expect(await k.liet('hu_con', { keCaDaXoa: true })).toEqual([]);
  });
});

describe('§VI — ĐƯỜNG GHI `napVaoConKho`', () => {
  async function dung(vi: number): Promise<{ kho: KhoTrongBoNho; h: Hu }> {
    const kho = new KhoTrongBoNho();
    const h = cha();
    await kho.ghi('hu', { id: h.id, thang: THANG, suaLuc: LUC, d: h });
    if (vi > 0) await kho.ghi('khoan', khoanRaBanGhi(taoKhoan({ soTien: vi, chieu: 'thu', ngay: NGAY }, LUC, 'luong')));
    expect(await ghiHuConKho(kho, con('c1', 'h1', 'Vé xe', 600_000), LUC, THANG)).toBe(true);
    return { kho, h };
  }

  it('⭐ nạp 200k qua hũ con: khoản vào sổ ở HŨ CHA, hũ con ghi nhớ khoản, tổng cha = tổng con', async () => {
    const { kho, h } = await dung(1_000_000);
    const c = (await kho.doc<HuCon>('hu_con', 'c1'))!.d;
    const k = nap('n1', 'h1', 200_000);
    expect(await napVaoConKho(kho, c, k, true, LUC, THANG)).toBe(true);
    const so = (await kho.liet<Khoan>('khoan')).map((b) => b.d);
    expect(so.find((x) => x.id === 'n1')?.huId, 'khoản nối vào hũ CHA').toBe('h1');
    const c2 = (await kho.doc<HuCon>('hu_con', 'c1'))!.d;
    expect(c2.khoanIds).toEqual(['n1']);
    const t = tongHopCha(h, [c2], so, THANG);
    expect(t.tongCha).toBe(200_000);
    expect(t.tongCon + t.chuaChia).toBe(t.tongCha);
    expect(t.chuaChia).toBe(0);
  });

  it('⭐ ví KHÔNG đủ ⇒ không ghi gì (không khoản, không gán) — đường cũ của hũ cha vẫn canh ví', async () => {
    const { kho } = await dung(50_000);
    const c = (await kho.doc<HuCon>('hu_con', 'c1'))!.d;
    expect(await napVaoConKho(kho, c, nap('n1', 'h1', 200_000), true, LUC, THANG)).toBe(false);
    expect((await kho.liet<Khoan>('khoan')).some((b) => b.id === 'n1')).toBe(false);
    expect((await kho.doc<HuCon>('hu_con', 'c1'))!.d.khoanIds).toEqual([]);
  });

  it('hũ con thuộc hũ KHÁC (hoặc đã xoá) ⇒ không ghi khoản nào — kiểm TRƯỚC khi chạm sổ', async () => {
    const { kho } = await dung(1_000_000);
    const c = (await kho.doc<HuCon>('hu_con', 'c1'))!.d;
    expect(await napVaoConKho(kho, c, nap('n1', 'h-khac', 10_000), true, LUC, THANG)).toBe(false);
    await kho.xoa('hu_con', 'c1', LUC);
    expect(await napVaoConKho(kho, c, nap('n2', 'h1', 10_000), true, LUC, THANG)).toBe(false);
    expect((await kho.liet<Khoan>('khoan')).filter((b) => b.d.phanBo !== undefined)).toEqual([]);
  });

  it('`ghiHuConKho` từ chối hũ con của một hũ cha KHÔNG có trong kho (một tầng, cha phải là một Hu)', async () => {
    const kho = new KhoTrongBoNho();
    expect(await ghiHuConKho(kho, con('c1', 'khong-co', 'A', 1000), LUC, THANG)).toBe(false);
    expect(await kho.dem('hu_con')).toBe(0);
  });
});
