/**
 * D397 — CHU KỲ CÓ TUỔI (v54, cổng `muaDinhHan` + `tinTheoMua`).
 *
 * Founder 24/09: *"chu kỳ có thể là tăng trưởng dài/ suy thoái… nhưng nó phải có tính liên kết rõ ràng chứ
 * không được ngẫu nhiên kiểu markov 100%"*. Đo trước cổng: mặt lá v54 không phân biệt được với markov bậc 1
 * cùng ma trận chuyển, biết lịch sử chỉ đoán lá sau tốt hơn +0,6 điểm, tin phá sản rơi vào mùa TĂNG 42%.
 *
 * ⚠ MỌI MỤC CÓ VẾ NGƯỢC: cùng v54, cùng seed, TẮT cổng — bài một chiều xanh vĩnh viễn khi cả hai cùng hỏng
 * (lớp "bài canh rỗng" D262 · D269 · D272). Ngưỡng đặt giữa hai phía, đo ở đúng cỡ mẫu này (3.000 bàn 16).
 */
import { describe, expect, it } from 'vitest';
import { BANH_XE_MUA } from '../config/banh_xe_mua.js';
import { LAI_SUAT_NEN, moiTruongTienTe } from '../config/holdem.js';
import { luatCua } from '../config/holdem_balance.js';
import { tuyChonSinhMap } from '../server/holdem/engine.js';
import { sinhMap, taoBanhXe, type HoldemMap, type OThiTruong } from '../server/holdem/map.js';

const V54 = 'balance-v54-ngare';
const HAT = (s: number): number => s * 7919 + 13;
const N = 3000;
const ban = (bat: boolean): HoldemMap[] => {
  // D399 — cô lập hai cờ D397: bộ luật từng lá (`luatLa`, cũng bật ở v54) có bài canh riêng (`bo_luat_la.test.ts`);
  // mọi ngưỡng dưới đây đo khi chưa có nó, và băm "tắt cổng" ghim đúng bánh xe D389.
  const tc = tuyChonSinhMap({ ...luatCua(V54), muaDinhHan: bat, tinTheoMua: bat, luatLa: false });
  return Array.from({ length: N }, (_, s) => sinhMap(HAT(s), 16, tc));
};
const BAT = ban(true);
const TAT = ban(false);

/** Các mùa ẩn TRỌN VẸN (bỏ khúc đầu/cuối bị bàn cắt), đếm trên ô pha. */
function khucMua(m: HoldemMap): { mua: string; dai: number }[] {
  const k: { mua: string; dai: number }[] = [];
  m.o.forEach((o, i) => {
    if (o.kind !== 'giai_doan') return;
    const t = m.trang_thai![i]!;
    const c = k[k.length - 1];
    if (c && c.mua === t.mua && (t.tuoi_mua ?? 0) > 1) c.dai += 1;
    else k.push({ mua: t.mua!, dai: 1 });
  });
  return k.slice(1, -1);
}

describe('I. Cổng', () => {
  it('v54 bật cả hai cờ; bảng số đúng hình', () => {
    expect([luatCua(V54).muaDinhHan, luatCua(V54).tinTheoMua]).toEqual([true, true]);
    for (const [m, [tu, den]] of Object.entries(BANH_XE_MUA.HAN)) {
      expect(tu >= 1 && den >= tu, m).toBe(true);
    }
  });

  it('⭐ TẮT cổng = đúng bánh xe D389 từng bit (băm 200 bàn ghim 24/09, sau khi khảo sát 6.000 bàn khớp đủ năm số D389)', () => {
    let h = 0x811c9dc5;
    const s = JSON.stringify(TAT.slice(0, 200));
    for (let i = 0; i < s.length; i += 1) { h ^= s.charCodeAt(i); h = Math.imul(h, 0x01000193) >>> 0; }
    expect(h.toString(16)).toBe('35eabed');
  });
});

describe('II. Mùa có tuổi — đợt tăng trưởng kéo dài thật và có điểm dừng', () => {
  const tang = (bs: HoldemMap[]) => bs.flatMap((m) => khucMua(m).filter((k) => k.mua === 'tang').map((k) => k.dai));

  it('⭐ đa số mùa TĂNG trọn vẹn kéo ≥ 4 ô (bật 63% · tắt 32%)', () => {
    const ty = (ds: number[]) => ds.filter((x) => x >= 4).length / ds.length;
    expect(ty(tang(BAT))).toBeGreaterThan(0.5);
    expect(ty(tang(TAT))).toBeLessThan(0.45);
  });

  it('⭐ không mùa TĂNG nào dài quá hạn trên — hết hạn là sang QUÁ NÓNG (tắt cổng: có đợt 13 ô)', () => {
    expect(Math.max(...tang(BAT))).toBeLessThanOrEqual(BANH_XE_MUA.HAN.tang[1]);
    expect(Math.max(...tang(TAT))).toBeGreaterThan(BANH_XE_MUA.HAN.tang[1]);
  });

  it('⭐ tin THẬT ngược mùa rút ngắn mùa: mỗi tin −1 ô, không cú sốc nào chen vào', () => {
    /*
     * Đi thẳng vào máy: cùng seed, cùng mùa TĂNG mở màn, lãi suất trung tính, không sức căng. Đường A không
     * tin; đường B mỗi ô có một tin THẬT báo QUÁ NÓNG (`bao_truoc: bien_dong` ⇒ hướng 0 ⇒ không kích cú sốc,
     * chỉ rút ngắn). B phải sang mùa sớm hơn A ở mọi seed còn ≥ 2 ô hạn. Bỏ phép rút ngắn ⇒ A = B ⇒ đỏ.
     */
    const LS = LAI_SUAT_NEN.KHOI_DIEM;
    expect(moiTruongTienTe(LS)).toBe('trung_tinh');
    const tin: OThiTruong = {
      kind: 'su_kien', su_kien: 'lam_phat', la_tin_gia: false, boi_canh: 'don_doc', bao_truoc: 'bien_dong',
    };
    const soOCon = (seed: number, coTin: boolean): number => {
      const bx = taoBanhXe(seed, true);
      for (let i = 0; i < 20; i += 1) {
        bx.quay(i, coTin ? tin : undefined, LS, null);
        if (bx.mua !== 'tang') return i;
      }
      return 20;
    };
    let so = 0;
    for (let seed = 1; seed < 4000 && so < 60; seed += 1) {
      const bx = taoBanhXe(seed, true);
      if (bx.mua !== 'tang' || bx.han - bx.tuoi < 2) continue;
      so += 1;
      expect(soOCon(seed, true), `seed ${seed}`).toBeLessThan(soOCon(seed, false));
    }
    expect(so).toBe(60);
  });
});

describe('III. Không còn là markov — lịch sử giúp đoán lá sau', () => {
  /*
   * Đoán HƯỚNG ô pha kế: (A) chỉ mặt hiện tại — đúng thứ một markov bậc 1 biết; (B) + khúc đã dài bao nhiêu
   * + khúc trước đi hướng nào. Học nửa đầu số bàn, chấm nửa sau. Markov bậc 1 ⇒ B − A ≈ 0.
   */
  const HUONG: Record<string, number> = { tang: 1, phuc_hoi: 1, bien_dong: 0, giam: -1, di_ngang: 0 };
  const loiNhoXa = (bs: HoldemMap[]): number => {
    const day = (m: HoldemMap) => m.o.flatMap((o) => (o.kind === 'giai_doan' && HUONG[o.giai_doan] !== 0
      ? [{ hu: HUONG[o.giai_doan]!, mat: o.giai_doan as string }] : []));
    type H = { hu: number; mat: string }[];
    const A = (h: H, i: number) => h[i]!.mat;
    const B = (h: H, i: number) => {
      let k = 1; while (i - k >= 0 && h[i - k]!.hu === h[i]!.hu) k += 1;
      return `${h[i]!.mat}|${Math.min(k, 5)}|${i - k >= 0 ? h[i - k]!.hu : 0}`;
    };
    const doan = (f: typeof A): number => {
      const bang = new Map<string, Map<number, number>>();
      for (const m of bs.slice(0, bs.length / 2)) {
        const h = day(m);
        for (let i = 0; i + 1 < h.length; i += 1) {
          const k = f(h, i); if (!bang.has(k)) bang.set(k, new Map());
          bang.get(k)!.set(h[i + 1]!.hu, (bang.get(k)!.get(h[i + 1]!.hu) ?? 0) + 1);
        }
      }
      let dung = 0; let tong = 0;
      for (const m of bs.slice(bs.length / 2)) {
        const h = day(m);
        for (let i = 0; i + 1 < h.length; i += 1) {
          const mp = bang.get(f(h, i));
          const du = mp ? [...mp].sort((a, b) => b[1] - a[1])[0]![0] : h[i]!.hu;
          tong += 1; if (du === h[i + 1]!.hu) dung += 1;
        }
      }
      return (dung * 100) / tong;
    };
    return doan(B) - doan(A);
  };

  it('⭐ biết lịch sử đoán lá sau tốt hơn ≥ 2 điểm (bật +3,3 · tắt +0,8 · markov giả +0,0)', () => {
    expect(loiNhoXa(BAT)).toBeGreaterThan(2);
    expect(loiNhoXa(TAT)).toBeLessThan(1.5);
  });
});

describe('IV. Tin nội sinh rơi đúng mùa, tin ngoại sinh giữ bất ngờ', () => {
  const tyTrong = (bs: HoldemMap[], ids: string[], mua: string[]): number => {
    let trong = 0; let tong = 0;
    for (const m of bs) {
      m.o.forEach((o, i) => {
        if (o.kind !== 'su_kien' || !ids.includes(o.su_kien)) return;
        tong += 1; if (mua.includes(m.trang_thai![i]!.mua!)) trong += 1;
      });
    }
    return trong / tong;
  };

  it('⭐ phá sản + cạn thanh khoản rơi vào SUY THOÁI/QUÁ NÓNG (bật 58% · tắt 42%)', () => {
    expect(tyTrong(BAT, ['pha_san', 'hack_san'], ['giam', 'bien_dong'])).toBeGreaterThan(0.5);
    expect(tyTrong(TAT, ['pha_san', 'hack_san'], ['giam', 'bien_dong'])).toBeLessThan(0.47);
  });

  it('⭐ hạ lãi suất rơi vào SUY THOÁI (bật 66% · tắt 55%)', () => {
    expect(tyTrong(BAT, ['ha_lai_suat'], ['giam'])).toBeGreaterThan(0.6);
    expect(tyTrong(TAT, ['ha_lai_suat'], ['giam'])).toBeLessThan(0.58);
  });

  it('nghiêng, không ép: không hệ số nào bằng 0; tin ngoại sinh không có dòng (×1)', () => {
    const NGOAI = ['chien_tranh', 'phap_ly', 'cam_van', 'tham_hoa', 'dich_benh', 'thien_nga_den'];
    for (const [mua, bang] of Object.entries(BANH_XE_MUA.TIN_THEO_MUA)) {
      for (const [id, hs] of Object.entries(bang)) {
        expect(hs, `${mua}.${id}`).toBeGreaterThan(0);
        expect(NGOAI.includes(id), `${mua}.${id} là tin ngoại sinh`).toBe(false);
      }
    }
  });
});
