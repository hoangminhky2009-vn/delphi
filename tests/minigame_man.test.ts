/**
 * D466 — MÀN MINIGAME, phần thuần: bối cảnh màn từ trận thật · giờ ⇒ nhịp · cửa sổ lệnh · lô của dòng phát.
 * Đường HTTP + DB ở `tests/minigame_api.test.ts`.
 */
import { describe, expect, it } from 'vitest';
import { SUC_CANG, mtGiaiDoan, type GiaiDoanId } from '../config/holdem.js';
import { CUA_SO_LENH_MS, DAC_THU, HO_DUONG_SINH, MA_MINIGAME, QUET, SO_NHIP } from '../config/minigame.js';
import { HINH_CHUNG } from '../config/minigame_hinh.js';
import type { SuKienId } from '../config/holdem.js';
import type { HoldemMap, OThiTruong } from '../server/holdem/map.js';
import { THU_TU_MA_SUC_CANG } from '../server/holdem/map.js';
import { chonHinh, giaTaiNhip, kichBanThe } from '../server/holdem/minigame/dong_gia.js';
import {
  CUA_SO_NHIP, DEM_MS, CHAY_MS, boiCanhMan, daiCangTaiO, dungDongMan, kiemNhipLenh, lichSuMan, loNhip, maNamNhieuNhat,
  nguonCuaO, nhipMay, seedMan, type BoiCanhMan,
} from '../server/holdem/minigame/man.js';

const gd = (g: GiaiDoanId): OThiTruong => ({ kind: 'giai_doan', giai_doan: g });
const sk = (id: 'tang_lai_suat' | 'thien_nga_den'): OThiTruong =>
  ({ kind: 'su_kien', su_kien: id, la_tin_gia: false, boi_canh: 'don_doc', bao_truoc: 'giam' } as OThiTruong);
const map = (o: OThiTruong[], cang?: number[][]): HoldemMap => ({
  seed: 1, o,
  ...(cang ? { trang_thai: cang.map((s) => ({ suc_cang_bp: s }) as any) } : {}),
});
const la = (x: ReturnType<typeof boiCanhMan>): BoiCanhMan => {
  if ('loi' in x) throw new Error(x.loi);
  return x;
};

describe('§I — chọn mã và lá của vòng', () => {
  it('mã nắm nhiều nhất theo giá trị; hoà theo thứ tự mã cố định; không nắm gì ⇒ null', () => {
    expect(maNamNhieuNhat({ cp_cn: 500, btc: 900 })).toBe('btc');
    const [a, b] = THU_TU_MA_SUC_CANG;
    expect(maNamNhieuNhat({ [b!]: 700, [a!]: 700 })).toBe(a);
    expect(maNamNhieuNhat({ btc: 0 })).toBeNull();
    expect(maNamNhieuNhat({})).toBeNull();
  });
  it('NỔ ở ô sự kiện · DƯ ÂM 1–3 ô sau (gần nhất) · TRƯỚC 1–2 ô trước · còn lại là giai đoạn của ô', () => {
    const m = map([gd('tang'), sk('tang_lai_suat'), gd('giam'), gd('giam'), gd('giam'), gd('giam'), gd('tang'), gd('tang'), sk('thien_nga_den')]);
    expect(nguonCuaO(m, 1)).toEqual({ kind: 'su_kien', the: 'tang_lai_suat', lop: 'no', xa: 1 });
    expect(nguonCuaO(m, 2)).toEqual({ kind: 'su_kien', the: 'tang_lai_suat', lop: 'du_am', xa: 1 });
    expect(nguonCuaO(m, 4)).toEqual({ kind: 'su_kien', the: 'tang_lai_suat', lop: 'du_am', xa: 3 });
    expect(nguonCuaO(m, 5)).toEqual({ kind: 'giai_doan', giai_doan: 'giam' });
    expect(nguonCuaO(m, 6)).toEqual({ kind: 'su_kien', the: 'thien_nga_den', lop: 'truoc', xa: 2 });
    expect(nguonCuaO(m, 7)).toEqual({ kind: 'su_kien', the: 'thien_nga_den', lop: 'truoc', xa: 1 });
    expect(nguonCuaO(m, 0)).toEqual({ kind: 'su_kien', the: 'tang_lai_suat', lop: 'truoc', xa: 1 });
    expect(nguonCuaO(m, 9)).toBeNull();
  });
  it('DƯ ÂM thắng TRƯỚC khi ô nằm giữa hai thẻ', () => {
    const m = map([sk('tang_lai_suat'), gd('giam'), sk('thien_nga_den')]);
    expect(nguonCuaO(m, 1)).toMatchObject({ lop: 'du_am', the: 'tang_lai_suat' });
  });
  it('dải sức căng đọc đúng ranh của SUC_CANG (2.000 / 4.000 bp)', () => {
    const iBtc = THU_TU_MA_SUC_CANG.indexOf('btc');
    const s = (v: number) => { const a = THU_TU_MA_SUC_CANG.map(() => 0); a[iBtc] = v; return a; };
    const m = map([gd('tang'), gd('tang'), gd('tang')], [s(SUC_CANG.DAI_CANG_BP - 1), s(SUC_CANG.DAI_CANG_BP), s(SUC_CANG.DAI_RAT_CANG_BP)]);
    expect([0, 1, 2].map((i) => daiCangTaiO(m, i, 'btc', 7))).toEqual(['em', 'cang', 'rat']);
  });
});

describe('§II — bối cảnh màn', () => {
  const m = map([gd('tang'), gd('tang'), sk('tang_lai_suat'), gd('giam'), gd('di_ngang'), gd('bien_dong'), gd('giam'), gd('di_ngang'), gd('tang')]);
  it('không nắm mã nào ⇒ không có màn; nắm nhiều Vàng nhất ⇒ màn chạy trên Vàng (D467 — đủ sáu mã)', () => {
    expect(boiCanhMan({ seedTran: 5, vong: 2, map: m, oUp: true, viThe: {} })).toEqual({ loi: 'khong_co_ma' });
    expect(la(boiCanhMan({ seedTran: 5, vong: 2, map: m, oUp: true, viThe: { vang: 900, btc: 100 } })).ma).toBe('vang');
  });
  it('⭐ MỌI mã của engine có dòng giá (tham số giá · nền quét · dải căng) — thêm mã mới mà quên ⇒ đỏ, không chờ người chơi gặp `ma_chua_co_dong_gia`', () => {
    for (const ma of THU_TU_MA_SUC_CANG) {
      expect(MA_MINIGAME[ma], ma).toBeDefined();
      expect(QUET.Q0[ma], ma).toBeGreaterThan(0);
      expect(QUET.DAI_MAP[ma], ma).toHaveLength(3);
    }
  });
  it('vòng v đọc ô v khi có ô mở màn (D382), ô v−1 khi không', () => {
    expect(la(boiCanhMan({ seedTran: 5, vong: 2, map: m, oUp: true, viThe: { btc: 800 } })).nguon).toMatchObject({ lop: 'no' });
    expect(la(boiCanhMan({ seedTran: 5, vong: 3, map: m, oUp: false, viThe: { btc: 800 } })).nguon).toMatchObject({ lop: 'no' });
  });
  it('NỔ: kịch bản + hình đúng các hàm đã khớp demo (D465), vốn = giá trị vị thế mã', () => {
    const bc = la(boiCanhMan({ seedTran: 5, vong: 2, map: m, oUp: true, viThe: { btc: 800, cp_cn: 300 } }));
    expect(bc.ma).toBe('btc');
    expect(bc.von).toBe(800);
    expect(bc.kb).toEqual(kichBanThe('btc', 'tang_lai_suat', 'no', 1));
    expect(bc.hinh).toBe(chonHinh(bc.seed, 'btc', bc.kb.o, 'no').id);
    expect(bc.seed).toBe(seedMan(5, 2, 'btc'));
  });
  it('ô GIAI ĐOẠN ⇒ mã rủi ro: nhóm theo quy ước ô tự chọn của demo; mã PHÒNG THỦ: dưỡng sinh theo DẤU điểm (D468)', () => {
    const nhomDemo = (ma: string, g: GiaiDoanId) => {   // mã trú ẩn (điểm pha Tăng âm) đi ngược thị trường — `DIEM_O` của demo
      const lat = mtGiaiDoan('v42')[ma]!.tang < 0 ? { tang: 'giam', giam: 'tang' } as Record<string, string> : {};
      return g === 'di_ngang' ? 'ngang' : lat[g] ?? g;
    };
    for (const ma of THU_TU_MA_SUC_CANG) {
      for (const g of ['tang', 'giam', 'di_ngang', 'bien_dong'] as GiaiDoanId[]) {
        const mm = map([gd('di_ngang'), gd(g), gd('di_ngang'), gd('di_ngang'), gd('di_ngang')]);
        const bc = la(boiCanhMan({ seedTran: 9, vong: 1, map: mm, oUp: true, viThe: { [ma]: 1000 } }));
        const d = mtGiaiDoan('v42')[ma]![g]!, phongThu = ['usd', 'vang', 'tpcp'].includes(ma);
        expect(bc.kb.o, `${ma} · ${g} (điểm ${d})`).toBe(phongThu ? (d >= 300 ? 'tang' : d <= -300 ? 'giam' : 'ngang') : nhomDemo(ma, g));
        expect(bc.che_do).toBe(phongThu ? 'duong_sinh' : 'thuong');
        expect(bc.diem).toBe(mtGiaiDoan('v42')[ma]![g]);
      }
    }
  });
  it('⭐ D468 — chế độ: phòng thủ ở ô giai đoạn = DƯỠNG SINH (hình đi đều, không cú quét, không rút chân); ở thẻ sự kiện = CỰC ĐOAN (nền quét riêng); mã rủi ro không đổi', () => {
    const ds = la(boiCanhMan({ seedTran: 5, vong: 6, map: m, oUp: true, viThe: { vang: 900 } }));   // ô 6 = Giảm, cách thẻ 4 ô (ngoài dư âm)
    expect(ds.nguon.kind).toBe('giai_doan');
    expect(ds.che_do).toBe('duong_sinh');
    expect(ds.q).toBe(0);
    expect(Object.values(HO_DUONG_SINH).flat()).toContain(ds.hinh);
    const min = dungDongMan(ds);
    expect(min.filter((c) => c.rut !== 0 || c.quet !== null)).toEqual([]);
    const cd = la(boiCanhMan({ seedTran: 5, vong: 2, map: m, oUp: true, viThe: { vang: 900 } }));   // ô 2 = NỔ Tăng lãi suất
    expect(cd.che_do).toBe('cuc_doan');
    expect(cd.q).toBeGreaterThan(QUET.Q0.vang!);   // nền cực đoan 2 % > nền thường 1,1 %
    expect(la(boiCanhMan({ seedTran: 5, vong: 6, map: m, oUp: true, viThe: { btc: 900 } })).che_do).toBe('thuong');
  });
  it('⭐ D469 — kịch bản đặc thù: Vàng ở lá NỔ Thiên nga đen LUÔN là "bán tháo rồi bật chữ V" (Covid 2020), mọi seed; lá TRƯỚC thì không', () => {
    const mm = map([gd('tang'), gd('tang'), sk('thien_nga_den'), gd('giam'), gd('giam'), gd('giam')]);
    for (const seedTran of [1, 2, 3, 4, 5, 99]) {
      expect(la(boiCanhMan({ seedTran, vong: 2, map: mm, oUp: true, viThe: { vang: 500 } })).hinh).toBe(DAC_THU['thien_nga_den|vang']);
    }
    for (const [cap, id] of Object.entries(DAC_THU)) {
      const h = HINH_CHUNG.find((x) => x.id === id);
      expect(h, cap).toBeDefined();
      const [the, ma] = cap.split('|') as [SuKienId, string];
      expect(h!.o, `${cap}: hình phải thuộc đúng nhóm thẻ của mã`).toContain(kichBanThe(ma, the, 'no').o);
    }
    expect(la(boiCanhMan({ seedTran: 1, vong: 1, map: mm, oUp: true, viThe: { vang: 500 } })).nguon).toMatchObject({ lop: 'truoc' });   // ô 1 = TRƯỚC: không ép hình
  });
  it('⭐ D469 — lớp TRƯỚC nghiêng theo DẤU CỦA MÃ: trước Tăng lãi suất, USDT (+1.200) nghiêng LÊN, Crypto (−1.800) nghiêng XUỐNG; mã trung tính đi ngang', () => {
    expect(kichBanThe('usd', 'tang_lai_suat', 'truoc').nghieng).toBeGreaterThan(0);
    expect(kichBanThe('btc', 'tang_lai_suat', 'truoc').nghieng).toBeLessThan(0);
    expect(kichBanThe('vn30', 'hack_san', 'truoc')).toMatchObject({ o: 'ngang', nghieng: 0, nhieuX: 1 });
    expect(kichBanThe('btc', 'thien_nga_den', 'truoc')).toMatchObject({ o: 'bien_dong', nghieng: 0 });   // thẻ báo pha biến động: không nghiêng, giật hơn
  });
  it('⭐ D470 — bối cảnh màn ghi NẤC THANH KHOẢN của vòng đúng như engine: Crypto ở lá NỔ Cạn thanh khoản = CẠN (mỏng −2, kẹp đáy); ô thường = nấc nền', () => {
    const mm = map([gd('tang'), gd('tang'), sk('hack_san' as never), gd('tang'), gd('tang'), gd('tang'), gd('tang')]);
    expect(la(boiCanhMan({ seedTran: 5, vong: 2, map: mm, oUp: true, viThe: { btc: 900 }, namNac: true })).nac).toBe('can');
    expect(la(boiCanhMan({ seedTran: 5, vong: 2, map: mm, oUp: true, viThe: { vn30: 900 }, namNac: true })).nac).toBe('mong');   // dày −2
    expect(la(boiCanhMan({ seedTran: 5, vong: 6, map: mm, oUp: true, viThe: { btc: 900 }, namNac: true })).nac).toBe('mong');    // nền
  });
  it('cùng đầu vào ⇒ cùng 80 nến; khác vòng ⇒ khác seed', () => {
    const p = { seedTran: 5, vong: 4, map: m, oUp: true, viThe: { cp_cn: 600 } };
    expect(JSON.stringify(dungDongMan(la(boiCanhMan(p))))).toBe(JSON.stringify(dungDongMan(la(boiCanhMan(p)))));
    expect(seedMan(5, 4, 'cp_cn')).not.toBe(seedMan(5, 5, 'cp_cn'));
    expect(seedMan(5, 4, 'cp_cn')).not.toBe(seedMan(5, 4, 'vn30'));
  });
});

describe('§III — giờ ⇒ nhịp, cửa sổ lệnh', () => {
  const t0 = 1_000_000;
  it('đếm 4 s: nhịp −1; nhịp 0 lộ sau 34 s / 480; giây 38 lộ đúng nhịp 479', () => {
    expect(DEM_MS).toBe(4000);
    expect(CHAY_MS).toBe(34000);
    expect(SO_NHIP).toBe(480);
    expect(nhipMay(t0, t0)).toBeLessThan(0);
    expect(nhipMay(t0, t0 + DEM_MS)).toBe(-1);
    expect(nhipMay(t0, t0 + DEM_MS + Math.ceil(CHAY_MS / SO_NHIP))).toBe(0);
    expect(nhipMay(t0, t0 + DEM_MS + CHAY_MS)).toBe(SO_NHIP - 1);
  });
  it('cửa sổ 2.000 ms = 28 nhịp; ranh trong nhận, ranh ngoài từ chối', () => {
    expect(CUA_SO_LENH_MS).toBe(2000);
    expect(CUA_SO_NHIP).toBe(28);
    expect(kiemNhipLenh(100, 128)).toBe('ok');
    expect(kiemNhipLenh(100, 129)).toBe('qua_cu');
    expect(kiemNhipLenh(100, 99)).toBe('tuong_lai');
    expect(kiemNhipLenh(0, -1)).toBe('chua_chay');
  });
  it('bấm ở nhịp cuối vẫn được nhận trong 2 s sau khi màn hết; sau đó thì không', () => {
    expect(kiemNhipLenh(479, 479 + 28)).toBe('ok');
    expect(kiemNhipLenh(479, 479 + 29)).toBe('qua_cu');
  });
  it('nhịp ngoài màn hay không phải số nguyên ⇒ ngoai_man', () => {
    for (const n of [-1, 480, 1.5, Number.NaN]) expect(kiemNhipLenh(n, 300)).toBe('ngoai_man');
  });
});

describe('§IV — lô của dòng phát', () => {
  const bc = la(boiCanhMan({ seedTran: 77, vong: 2, map: map([gd('tang'), gd('tang'), gd('giam')]), oUp: true, viThe: { btc: 1 } }));
  const min = dungDongMan(bc);
  it('lịch sử = 20 nến mịn trước màn, [mở, cao, thấp, đóng]', () => {
    const ls = lichSuMan(min);
    expect(ls).toHaveLength(20);
    expect(ls[19]![3]).toBeCloseTo(min[19]!.c, 4);
  });
  it('giá của lô = giá nhịp của dòng giá (làm tròn 4 số lẻ); KHÔNG có nhịp nào sau `den`', () => {
    const lo = loNhip(min, 10, 40);
    expect(lo.gia).toHaveLength(31);
    lo.gia.forEach((g, i) => expect(g).toBeCloseTo(giaTaiNhip(min, 10 + i), 4));
  });
  it('D475 — cờ trắng đi lúc NẾN GỘP MỞ (nhịp 16J), cho cả hai nến mịn của cặp, đúng cờ của từng nến', () => {
    expect(loNhip(min, 0, 0).nen.map((x) => x[0])).toEqual([0, 1]);
    expect(loNhip(min, 1, 15).nen).toEqual([]);
    expect(loNhip(min, 8, 23).nen.map((x) => x[0])).toEqual([2, 3]);
    const chay = min.slice(20);
    for (const [j, a, b] of loNhip(min, 0, 479).nen) expect([a, b], `nến ${j}`).toEqual([chay[j]!.trang ? 1 : 0, chay[j]!.trangBan ? 1 : 0]);
    expect(loNhip(min, 0, 479).nen).toHaveLength(60);
  });
  it('kẹp đầu/cuối: lô vượt màn chỉ trả tới nhịp 479', () => {
    expect(loNhip(min, 470, 600).gia).toHaveLength(10);
    expect(loNhip(min, -5, 3)).toMatchObject({ tu: 0 });
  });
});
