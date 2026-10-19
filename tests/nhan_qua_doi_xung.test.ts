/**
 * NHÂN QUẢ ĐỐI XỨNG — v38 (D185).
 *
 * Bảng `SU_KIEN_THEO_GIAI_DOAN` chỉ có vế THÚC ("chợ sập ⇒ nới tay", "chợ nóng ⇒
 * siết tiền") và không có vế GHÌM, nên chợ đang TĂNG vẫn rút ra "hạ lãi suất"
 * với trọng số nền. Đo (v36, 6.000 seed map 8): 28,4% số cú hạ-lãi-THẬT ở ô 2 có
 * ô 1 đang tăng — không một cớ kinh tế nào.
 *
 *   §I   BẢNG — đối xứng thật, và cố ý KHÔNG về 0.
 *   §II  MỘT CỬA + CỔNG — cờ tắt trả CHÍNH bảng cũ (so `===`).
 *   §III ⭐⭐ HIỆU LỰC — cơ chế phải ĐỔI SỐ, không phải chạy cho có.
 */
import { describe, expect, it } from 'vitest';
import {
  BO_LUAT_THEO_PHIEN_BAN, SU_KIEN_THEO_GIAI_DOAN, SU_KIEN_THEO_GIAI_DOAN_GHIM,
  luatCua, suKienTheoGiaiDoan,
} from '../config/holdem.js';
import { tuyChonSinhMap } from '../server/holdem/engine.js';
import { sinhMap } from '../server/holdem/map.js';

const V38 = 'balance-v38-doixung';
const V37 = 'balance-v37-aplucban';

describe('I. Bảng ghìm', () => {
  it('⭐⭐ mỗi vế THÚC của lãi suất có một vế GHÌM đối xứng', () => {
    const thuc = SU_KIEN_THEO_GIAI_DOAN
      .filter((r) => r.su_kien === 'ha_lai_suat' || r.su_kien === 'tang_lai_suat');
    expect(thuc.length, 'bảng thúc đổi hình — xem lại vế ghìm').toBe(2);
    for (const t of thuc) {
      const nguoc = t.sau_giai_doan === 'giam' ? 'tang' : 'giam';
      const g = SU_KIEN_THEO_GIAI_DOAN_GHIM
        .find((r) => r.su_kien === t.su_kien && r.sau_giai_doan === nguoc);
      expect(g, `thiếu vế ghìm cho ${t.su_kien} sau ${nguoc}`).toBeTruthy();
      expect(g!.he_so_bp, 'vế ghìm phải < 10000 (ghìm, không thúc)').toBeLessThan(10000);
    }
  });

  it('⚠ KHÔNG về 0 — chính sách bất ngờ ngoài lịch có thật ngoài đời', () => {
    for (const g of SU_KIEN_THEO_GIAI_DOAN_GHIM) {
      expect(g.he_so_bp, `${g.su_kien} bị khoá tuyệt đối`).toBeGreaterThan(0);
    }
  });

  it('KHÔNG ghìm sau `phuc_hoi` — hạ lãi lúc đang hồi phục là kích thích có lý', () => {
    expect(SU_KIEN_THEO_GIAI_DOAN_GHIM
      .some((r) => r.sau_giai_doan === 'phuc_hoi')).toBe(false);
  });
});

describe('II. Một cửa + cổng', () => {
  it('⭐ cờ TẮT trả CHÍNH bảng cũ — bằng chứng cấu trúc là trận cũ không trôi', () => {
    expect(suKienTheoGiaiDoan(false)).toBe(SU_KIEN_THEO_GIAI_DOAN);
  });

  it('cờ BẬT = bảng cũ CỘNG vế ghìm, không ghi đè dòng nào', () => {
    const b = suKienTheoGiaiDoan(true);
    expect(b.length).toBe(SU_KIEN_THEO_GIAI_DOAN.length + SU_KIEN_THEO_GIAI_DOAN_GHIM.length);
    for (const r of SU_KIEN_THEO_GIAI_DOAN) expect(b).toContain(r);
  });

  it('⭐ v38 khác v37 ĐÚNG MỘT cờ', () => {
    const a = BO_LUAT_THEO_PHIEN_BAN[V38]! as unknown as Record<string, boolean>;
    const c = BO_LUAT_THEO_PHIEN_BAN[V37]! as unknown as Record<string, boolean>;
    expect(Object.keys({ ...a, ...c }).filter((k) => a[k] !== c[k])).toEqual(['nhanQuaDoiXung']);
  });

  it('mọi phiên bản CŨ đều tắt cờ — không đổi map trận đã lưu', () => {
    for (const [ten, luat] of Object.entries(BO_LUAT_THEO_PHIEN_BAN)) {
      /*
       * ⚠ THƯỚC LÀ "KHÔNG BẬT HỒI TỐ", KHÔNG PHẢI "CHỈ MỘT PHIÊN BẢN" (D181).
       * Bản đầu bỏ qua đúng một tên, nên mỗi lần thêm phiên bản KẾ THỪA là bài
       * này đỏ dù không có gì hỏng — và bài đỏ vì lý do sai thì bị nới bừa (D79).
       * Điều phải giữ: phiên bản CŨ HƠN mốc không bao giờ được bật (đó mới là cú
       * đổi replay trận đã lưu); từ mốc trở đi thì phải bật.
       */
      const soCua = (t: string) => Number(/balance-v(\d+)/.exec(t)?.[1] ?? 0);
      const moc = soCua('balance-v38-doixung');
      if (soCua(ten) < moc) {
        expect((luat as unknown as Record<string, boolean>)['nhanQuaDoiXung'],
          `phiên bản CŨ "${ten}" bật cờ ⇒ đổi trận đã lưu`).not.toBe(true);
      } else {
        expect((luat as unknown as Record<string, boolean>)['nhanQuaDoiXung'],
          `phiên bản "${ten}" từ mốc trở đi phải bật`).toBe(true);
      }
    }
  });

  it('⭐ v38 TẮT cờ ⇒ map GIỐNG TỪNG BYTE v37 (không xê dịch một cú rút nào)', () => {
    const ky = (seed: number, luat: Parameters<typeof tuyChonSinhMap>[0]) =>
      JSON.stringify(sinhMap(seed, 12, tuyChonSinhMap(luat)));
    const tat = { ...luatCua(V38), nhanQuaDoiXung: false };
    for (const seed of [1, 7, 42, 99, 1234]) {
      expect(ky(seed, tat)).toBe(ky(seed, luatCua(V37)));
    }
  });
});

describe('III. ⭐⭐ Hiệu lực — cơ chế phải ĐỔI SỐ', () => {
  /** Đếm cú hạ-lãi-THẬT ở ô 2 mà ô 1 đang TĂNG (phi lý), trên N seed. */
  const demPhiLy = (phienBan: string, N: number) => {
    const luat = luatCua(phienBan);
    let ha = 0; let phiLy = 0;
    for (let s = 0; s < N; s += 1) {
      const m = sinhMap(60260000 + s, 8, tuyChonSinhMap(luat));
      const o1 = m.o[0]!; const o2 = m.o[1]!;
      if (o2.kind !== 'su_kien' || o2.su_kien !== 'ha_lai_suat' || o2.la_tin_gia) continue;
      ha += 1;
      if (o1.kind === 'giai_doan' && (o1.giai_doan === 'tang' || o1.giai_doan === 'phuc_hoi')) {
        phiLy += 1;
      }
    }
    return { ha, phiLy };
  };

  it('⭐⭐ v38 sinh ÍT cú hạ-lãi phi lý hơn v37 rõ rệt (không phải cơ chế trang trí)', () => {
    const N = 4000;
    const cu = demPhiLy(V37, N);
    const moi = demPhiLy(V38, N);
    expect(cu.ha, 'mẫu rỗng — bài không đo được gì').toBeGreaterThan(30);
    expect(moi.phiLy, `v37 ${moi.phiLy} vs ${cu.phiLy} — vế ghìm không đổi số nào`)
      .toBeLessThan(cu.phiLy);
    // Giảm ít nhất một phần ba: dưới mức đó thì hệ số đang quá nhẹ để có nghĩa.
    expect(moi.phiLy).toBeLessThanOrEqual(Math.floor(cu.phiLy * 0.67));
  });

  it('⚠ nhưng KHÔNG diệt hẳn — cú hạ bất ngờ vẫn phải còn cửa', () => {
    expect(demPhiLy(V38, 4000).phiLy).toBeGreaterThan(0);
  });
});
