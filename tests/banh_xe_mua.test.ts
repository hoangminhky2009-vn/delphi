/**
 * v54 (D389) — BÁNH XE MÙA CÓ NGÃ RẼ: bài canh cho máy sinh bàn mới.
 *
 * Founder 23/09 chốt "ngã rẽ, 80%" SAU KHI xem số đo trên 6.000 bàn 16 (bàn thấy trọn một vòng
 * mùa 6% → 28%, sau suy thoái là phục hồi 46% → 81%). Bài này canh để bộ máy thật giữ đúng
 * những tính chất founder đã duyệt, và để những ai sửa sau không lặng lẽ đẩy nó về "một đống
 * ngẫu nhiên" hay về "bánh xe thẳng đoán được" (bản founder đã bác).
 *
 * ⚠ MỌI MỤC CÓ VẾ NGƯỢC trên khoá cũ (v53) — bài một chiều xanh vĩnh viễn khi cả hai phiên
 * bản cùng hỏng (lớp "bài canh rỗng" D262 · D269 · D272).
 */
import { describe, expect, it } from 'vitest';
import { BO_LUAT_THEO_PHIEN_BAN, luatCua } from '../config/holdem_balance.js';
import type { GiaiDoanId } from '../config/holdem.js';
import {
  boiCanhUpCua, taoTran, tuyChonSinhMap, type GheMoi, type TrangThaiTran,
} from '../server/holdem/engine.js';
import { sinhMap, type HoldemMap, type OThiTruong, type TrangThaiO } from '../server/holdem/map.js';

const V54 = 'balance-v54-ngare';
const V53 = 'balance-v53-upo';
const HAT = (s: number): number => s * 7919 + 13;
const N = 1500;

const sinh = (khoa: string, s: number): HoldemMap =>
  sinhMap(HAT(s), 16, tuyChonSinhMap(luatCua(khoa)));
const BAN_54 = Array.from({ length: N }, (_, s) => sinh(V54, s));
const BAN_53 = Array.from({ length: N }, (_, s) => sinh(V53, s));

describe('I. Cổng — v54 = v53 + đúng các cờ đã khai', () => {
  it('v54 đổi ĐÚNG 18 cờ so với v53, không lén bật/tắt thứ khác (quỹ vòng: chỉ trần hạng 1 — nút BỎ GIỮ)', () => {
    const a = BO_LUAT_THEO_PHIEN_BAN[V53]! as unknown as Record<string, boolean>;
    const b = BO_LUAT_THEO_PHIEN_BAN[V54]! as unknown as Record<string, boolean>;
    const doi = Object.keys(b).filter((k) => a[k] !== b[k]).sort();
    // D395 khai thêm `thanhKhoanNamNac` (thanh khoản năm nấc) — cờ thứ 11, bài này bắt được nó trước khi được khai.
    // D397 khai thêm `muaDinhHan` + `tinTheoMua` (chu kỳ có tuổi) — cờ 12 · 13, cũng bị bắt trước khi khai.
    // D399 khai thêm `luatLa` (bộ luật từng lá) — cờ 14.
    // D406 (lật mặc định) bật `quyTranHang1` (D403) + ba cờ sổ chịu nền kinh tế (D405) — cờ 15–18. `boBaiTat` ·
    // `quyTheoCoBan` VẪN tắt: gỡ BỎ làm "gửi hết" thắng 38–51% (D403/D405).
    expect(doi).toEqual([
      'apLucBan', 'banhXe', 'beChuoiVon', 'chiBan16', 'duoiTelegraph', 'khauViTat',
      'kyNgo', 'loiGon', 'luatLa', 'muaDinhHan', 'nganHangDoVo', 'phanThan', 'quyTranHang1', 'thanhKhoanNamNac',
      'tietKiemLamPhat', 'tietKiemThaNoi', 'tinTheoMua', 'vonDeu',
    ]);
  });

  it('các cờ mới của v54 TẮT ở mọi khoá khác — trận đã lưu replay nguyên', () => {
    const MOI = [
      'banhXe', 'khauViTat', 'vonDeu', 'chiBan16', 'loiGon', 'thanhKhoanNamNac', 'muaDinhHan', 'tinTheoMua', 'luatLa',
      // D406 — bốn cờ bật lúc lật: trận v53 trở xuống đã lưu phải replay nguyên.
      'quyTranHang1', 'tietKiemLamPhat', 'tietKiemThaNoi', 'nganHangDoVo',
    ] as const;
    // v55 (D409) và MỌI khoá sau kế thừa v54 nên mang đủ cờ v54 — khoá KẾ THỪA không phải 'khoá khác'; bài canh riêng ở
    // tests/lua_trait.test.ts §I. ⚠ Ghim theo SỐ phiên bản, không liệt kê tay: lần lật v56 (D447) làm đỏ đúng dòng liệt kê
    // `['balance-v55-build']` — nếp "ghim tính chất, không ghim chuỗi" của mọi lần lật trước.
    const soCua = (k: string): number => Number(/^balance-v(\d+)/.exec(k)?.[1] ?? 0);
    for (const [khoa, luat] of Object.entries(BO_LUAT_THEO_PHIEN_BAN)) {
      if (khoa === V54 || soCua(khoa) > 54) continue;
      for (const c of MOI) expect(luat[c], `${khoa}.${c}`).toBe(false);
    }
  });

  it('map v53 KHÔNG mang trường mùa; map v54 mang ở mọi ô', () => {
    expect(BAN_53.every((m) => m.trang_thai!.every((t) => t.mua === undefined))).toBe(true);
    expect(BAN_54.every((m) => m.trang_thai!.every((t) => t.mua !== undefined
      && typeof t.tuoi_mua === 'number'))).toBe(true);
  });

  it('tất định: cùng seed ⇒ cùng bàn, từng ô, kể cả mùa ẩn', () => {
    for (let s = 0; s < 50; s += 1) expect(sinh(V54, s)).toEqual(BAN_54[s]);
  });
});

/** Cạnh mùa HỢP LỆ: đường chính · ngã rẽ · sốc · bong bóng (vào QUÁ NÓNG; vỡ về SUY THOÁI). */
const CANH_HOP_LE = new Set([
  'phuc_hoi>tang', 'tang>bien_dong', 'bien_dong>giam', 'giam>phuc_hoi', // đường chính
  'phuc_hoi>giam', 'bien_dong>tang', 'giam>di_ngang', 'di_ngang>phuc_hoi', // ngã rẽ
  'tang>giam', // sốc (phuc_hoi>giam đã có)
  'phuc_hoi>bien_dong', // bong bóng thật giữa phục hồi
  'di_ngang>giam', // bong bóng vỡ giữa đình trệ (mọi mùa khác → giam đã có)
]);

describe('II. Bánh xe quay đúng luật', () => {
  it('mùa chỉ chuyển theo cạnh hợp lệ — KHÔNG bao giờ đi lùi (vd SUY THOÁI nhảy thẳng lên TĂNG)', () => {
    const gap = new Map<string, number>();
    for (const m of BAN_54) {
      const mua = m.trang_thai!.map((t) => t.mua!);
      for (let i = 1; i < mua.length; i += 1) {
        if (mua[i] !== mua[i - 1]) {
          const k = `${mua[i - 1]}>${mua[i]}`;
          gap.set(k, (gap.get(k) ?? 0) + 1);
        }
      }
    }
    const la = [...gap.keys()].filter((k) => !CANH_HOP_LE.has(k));
    expect(la, `cạnh lạ: ${la.join(', ')}`).toEqual([]);
    // Và mọi ngã rẽ đều THẬT SỰ xảy ra (bảng hợp lệ không phải bảng rỗng nghĩa).
    for (const k of ['bien_dong>tang', 'phuc_hoi>giam', 'giam>di_ngang', 'tang>giam']) {
      expect(gap.get(k) ?? 0, k).toBeGreaterThan(20);
    }
  });

  it('ô TIN đóng băng bánh xe: mùa và tuổi mùa đứng yên qua ô tin', () => {
    for (const m of BAN_54) {
      const tt = m.trang_thai!;
      for (let i = 1; i < m.o.length; i += 1) {
        if (m.o[i]!.kind !== 'su_kien') continue;
        expect([tt[i]!.mua, tt[i]!.tuoi_mua]).toEqual([tt[i - 1]!.mua, tt[i - 1]!.tuoi_mua]);
      }
    }
  });

  it('lá pha hiện đúng mùa ~80% (founder chốt 80%, không phải 100% hay ngẫu nhiên)', () => {
    let dung = 0; let tong = 0;
    for (const m of BAN_54) {
      m.o.forEach((o, i) => {
        if (o.kind !== 'giai_doan') return;
        tong += 1;
        if (o.giai_doan === m.trang_thai![i]!.mua) dung += 1;
      });
    }
    const ty = dung / tong;
    expect(ty).toBeGreaterThan(0.74);
    expect(ty).toBeLessThan(0.84);
  });
});

describe('III. Kỳ họp theo mùa', () => {
  const hop = (khoa: string) => (khoa === V54 ? BAN_54 : BAN_53).flatMap((m) =>
    m.o.flatMap((o, i) => (m.trang_thai![i]!.o_lich ? [{ m, o, i, t: m.trang_thai![i]! }] : [])));

  it('kỳ họp GIỮ lật mặt của mùa (thôi lật cứng "đi ngang") — v53 vẫn lật cứng', () => {
    const giu54 = hop(V54).filter((x) => x.t.huong_cs_thuc === 'giu');
    const giu53 = hop(V53).filter((x) => x.t.huong_cs_thuc === 'giu');
    expect(giu54.length).toBeGreaterThan(50);
    expect(giu54.some((x) => x.o.kind === 'giai_doan' && x.o.giai_doan !== 'di_ngang')).toBe(true);
    expect(giu53.every((x) => x.o.kind === 'giai_doan' && x.o.giai_doan === 'di_ngang')).toBe(true);
  });

  it('SUY THOÁI/ĐÌNH TRỆ ⇒ kỳ vọng HẠ; QUÁ NÓNG (không có cú sập) ⇒ kỳ vọng TĂNG', () => {
    const sapThat = (o: OThiTruong): boolean => o.kind === 'su_kien' && !o.la_tin_gia
      && ['hack_san', 'thien_nga_den', 'phap_ly', 'pha_san', 'cam_van', 'tham_hoa', 'dich_benh']
        .includes(o.su_kien);
    let xuong = 0; let nong = 0;
    for (const { m, i, t } of hop(V54)) {
      const muaTruoc = m.trang_thai![i - 1]!.mua!;
      if (muaTruoc === 'giam' || muaTruoc === 'di_ngang') {
        expect(t.huong_cs_ky_vong).toBe('ha'); xuong += 1;
      } else if (muaTruoc === 'bien_dong' && !m.o.slice(Math.max(0, i - 4), i).some(sapThat)) {
        expect(t.huong_cs_ky_vong).toBe('tang'); nong += 1;
      }
    }
    expect(xuong).toBeGreaterThan(50);
    expect(nong).toBeGreaterThan(50);
  });
});

describe('IV. Chu kỳ ĐỌC ĐƯỢC — số founder đã duyệt (6.000 bàn: 28% · 81%)', () => {
  /** Khúc mặt THẤY ĐƯỢC: gộp mặt liền nhau, bỏ ĐI NGANG, TĂNG/PHỤC HỒI = LÊN. */
  const khucLen = (m: HoldemMap): string[] => {
    const pha = m.o.flatMap((o) => (o.kind === 'giai_doan' ? [o.giai_doan] : []));
    const k: string[] = [];
    for (const p of pha) {
      if (p === 'di_ngang') continue;
      const x = p === 'tang' || p === 'phuc_hoi' ? 'LEN' : p;
      if (k[k.length - 1] !== x) k.push(x);
    }
    return k;
  };
  const vongTron = (m: HoldemMap): boolean => {
    const k = khucLen(m);
    return k.some((_, j) => k.slice(j, j + 4).join('>') === 'LEN>bien_dong>giam>LEN');
  };

  it('bàn hiện trọn một vòng LÊN → QUÁ NÓNG → SUY THOÁI → LÊN: v54 22–35%, v53 dưới 10%', () => {
    const ty54 = BAN_54.filter(vongTron).length / N;
    const ty53 = BAN_53.filter(vongTron).length / N;
    expect(ty54).toBeGreaterThan(0.22);
    expect(ty54).toBeLessThan(0.35);
    expect(ty53).toBeLessThan(0.10);
  });

  it('đủ năm kiểu bàn — không kiểu nào nuốt hết (ngã rẽ là để mỗi bàn một chuyện)', () => {
    const co = (m: HoldemMap, a: GiaiDoanId, b: GiaiDoanId): boolean => {
      const mua = m.trang_thai!.map((t) => t.mua!);
      return mua.some((x, k) => k > 0 && mua[k - 1] === a && x === b);
    };
    const ty = (f: (m: HoldemMap) => boolean): number => BAN_54.filter(f).length / N;
    const kieu = {
      haCanhMem: ty((m) => co(m, 'bien_dong', 'tang')),
      dayKep: ty((m) => co(m, 'phuc_hoi', 'giam')),
      dinhTre: ty((m) => co(m, 'giam', 'di_ngang')),
      sap: ty((m) => co(m, 'tang', 'giam')),
      khongSuy: ty((m) => !m.trang_thai!.some((t) => t.mua === 'giam')),
    };
    for (const [k, v] of Object.entries(kieu)) {
      expect(v, k).toBeGreaterThan(0.05);
      expect(v, k).toBeLessThan(0.45);
    }
  });
});

describe('V. Bot đoán lá úp theo MÙA — chỉ từ thông tin công khai', () => {
  const GHE: readonly GheMoi[] = [
    { id: 'ban', loai: 'nguoi', bac_rank: 'Đồng', danh_muc: { tai_san: [], chien_thuat: [] } },
    { id: 'b1', loai: 'bot', bac_rank: 'Đồng', danh_muc: { tai_san: [], chien_thuat: [] } },
  ];
  const gd = (g: GiaiDoanId): OThiTruong => ({ kind: 'giai_doan', giai_doan: g });
  const tt = (run: -1 | 0 | 1, mua: GiaiDoanId): TrangThaiO => ({
    giai_doan_nen: mua, run_huong: run, run_dai: 2, face_prior_bp: 5000,
    suc_cang_bp: [0, 0, 0, 0, 0, 0], o_lich: false, lai_suat_diem: 400, tail_face: null,
    mua, tuoi_mua: 2,
  });
  /** Vòng 1: lá mở màn `o[0]` đã ngửa, lá úp `o[1]` là ô pha (bot không được đọc nó). */
  const ban = (khoa: string, lat: GiaiDoanId, run: -1 | 0 | 1, muaAn: GiaiDoanId): TrangThaiTran => {
    const st = taoTran(4242, GHE, luatCua(khoa), 16);
    return {
      ...st,
      map: { ...st.map, o: [gd(lat), gd('giam'), gd('giam')], trang_thai: [tt(run, muaAn), tt(run, muaAn), tt(run, muaAn)] },
      vong: 1,
    };
  };
  const doan = (st: TrangThaiTran): GiaiDoanId | undefined => {
    const bc = boiCanhUpCua(st);
    return bc?.o.kind === 'giai_doan' ? bc.o.giai_doan : undefined;
  };

  it('mùa hướng 0: bot đọc MẶT vừa lật (QUÁ NÓNG/ĐÌNH TRỆ), mặt lệch thì mặc định QUÁ NÓNG', () => {
    expect(doan(ban(V54, 'bien_dong', 0, 'bien_dong'))).toBe('bien_dong');
    expect(doan(ban(V54, 'di_ngang', 0, 'di_ngang'))).toBe('di_ngang');
    expect(doan(ban(V54, 'tang', 0, 'bien_dong'))).toBe('bien_dong');
  });

  it('mùa có hướng: LÊN ⇒ tang · XUỐNG ⇒ giam', () => {
    expect(doan(ban(V54, 'di_ngang', 1, 'phuc_hoi'))).toBe('tang');
    expect(doan(ban(V54, 'di_ngang', -1, 'giam'))).toBe('giam');
  });

  it('⭐ bot KHÔNG đọc mùa ẩn: mặt nói QUÁ NÓNG, mùa ẩn nói ĐÌNH TRỆ ⇒ bot theo mặt', () => {
    expect(doan(ban(V54, 'bien_dong', 0, 'di_ngang'))).toBe('bien_dong');
  });

  it('vế ngược — v53 giữ luật cũ: hướng 0 ⇒ ĐI NGANG dù mặt vừa lật là BIẾN ĐỘNG', () => {
    expect(doan(ban(V53, 'bien_dong', 0, 'bien_dong'))).toBe('di_ngang');
  });
});
