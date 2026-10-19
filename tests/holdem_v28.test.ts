/**
 * v28 — TIN CÓ GỐC, TIN GIẢ CÓ HẬU QUẢ (founder 08/08; một cổng `mapV28`).
 *
 * Bốn cơ chế, mỗi cơ chế một mục: tỷ lệ tin giả theo LOẠI sự kiện · bong bóng
 * có gốc tiền tệ (giả nhiều + gãy sớm khi không tiền rẻ) · tin giả lộ kéo
 * Sập sàn · phục hồi là cầu sang uptrend.
 *
 * ⚠⚠ BÀI ĐẮT NHẤT LÀ CỔNG REPLAY (mục I): v28 đổi `sinhMap` nên nếu cờ rò sang
 * bộ luật cũ thì mọi trận đã lưu replay ra MỘT MAP KHÁC — hỏng vĩnh viễn vì
 * `events` append-only (A3.3). Các mục sau là THỐNG KÊ trên hàng nghìn seed:
 * chúng khoá HÌNH DẠNG phân phối, không khoá một con số fixture (số đổi theo
 * tinh chỉnh A8.2, hình dạng thì không được phép đổi).
 */
import { describe, it, expect } from 'vitest';
import { sinhMap, type OSuKien } from '../server/holdem/map.js';
import {
  LAI_SUAT_NEN, MAP_V28, SU_KIEN, luatCua, moiTruongTienTe,
} from '../config/holdem.js';

const CO_V27 = {
  lich: true, quanTinh: true, sucCang: true, chuKy: true,
  duoiTelegraph: true, duoi5: false, laiSuatNen: true, bongBongChuoi: true,
} as const;
const CO_V28 = { ...CO_V27, mapV28: true } as const;

describe('I. ⭐ CỔNG REPLAY + bảng luật', () => {
  it('cờ tắt: dãy ô byte-hệt bản v27 — trận cũ không được nhúc nhích', () => {
    for (const seed of [1, 7, 20260373, 999_983]) {
      for (const size of [8, 12, 16]) {
        const a = sinhMap(seed, size, CO_V27);
        const b = sinhMap(seed, size, { ...CO_V27, mapV28: false });
        expect(JSON.stringify(a.o), `seed ${seed} cỡ ${size}`).toBe(JSON.stringify(b.o));
      }
    }
  });

  it('⭐ cờ BẬT phải đổi được map (không thì đây là cơ chế trang trí)', () => {
    const khac = [1, 7, 42, 99, 20260373, 123_457, 999_983].filter((seed) =>
      JSON.stringify(sinhMap(seed, 16, CO_V27).o)
        !== JSON.stringify(sinhMap(seed, 16, CO_V28).o));
    expect(khac.length, 'bật cờ mà map y hệt = cơ chế không chạy').toBeGreaterThan(0);
  });

  it('bảng luật: v28 = trọn v27 + mapV28; mọi bản cũ tắt cờ', () => {
    const v28 = luatCua('balance-v28-goc');
    const v27 = luatCua('balance-v27-bongbong');
    expect(v28.mapV28).toBe(true);
    expect(v27.mapV28).toBe(false);
    expect(luatCua('phien-ban-la').mapV28).toBe(false);
    // v28 không được lén bật/tắt cờ nào khác ngoài mapV28.
    const { mapV28: _a, ...conLai28 } = v28;
    const { mapV28: _b, ...conLai27 } = v27;
    expect(conLai28).toEqual(conLai27);
  });

  /*
   * D351 — GHIM TÍNH CHẤT, THÔI GHIM CHUỖI.
   *
   * Bản cũ ghim đúng chữ `'Sập sàn'`. Nhãn ấy đã đổi HAI lần ('Hack sàn' → v28 'Sập sàn' →
   * D351 'Sàn khoá rút tiền'), và cả hai lần bài này đỏ rồi người đổi tên sửa chuỗi cho khớp —
   * tức nó không canh được gì bền, chỉ thu một lệ phí gõ phím. Cái THẬT SỰ phải bất biến là
   * **id**: `events` và replay trỏ về id, nên đổi id là làm hỏng mọi trận đã ghi, còn đổi nhãn
   * thì không ai mất gì (chính lý lẽ founder chốt ở v28).
   * ⇒ Nay canh đúng ba tính chất đó, và canh thêm một thứ bản cũ bỏ sót: **nhãn không được
   * quay lại một tên đã nghỉ** — vì tên cũ còn nằm trong nhật ký và tài liệu, dùng lại là dựng
   * hai nghĩa dưới một tên.
   */
  const NHAN_DA_NGHI = ['Hack sàn', 'Sập sàn'] as const;

  it('hack_san: id BẤT BIẾN, nhãn đổi được nhưng không quay lại tên đã nghỉ', () => {
    const sk = SU_KIEN.find((x) => x.id === 'hack_san');
    expect(sk, 'id hack_san biến mất ⇒ mọi trận đã ghi hỏng replay').toBeDefined();
    expect(sk!.label.trim().length, 'nhãn rỗng').toBeGreaterThan(0);
    expect(NHAN_DA_NGHI as readonly string[], `nhãn quay lại tên đã nghỉ: ${sk!.label}`)
      .not.toContain(sk!.label);
  });
});

/** Duyệt mọi ô SỰ KIỆN không-lịch của N seed, kèm mức lãi TRƯỚC cú rút. */
function duyetSuKien(
  opts: typeof CO_V27 | typeof CO_V28, soSeed: number, size = 16,
): { sk: OSuKien; mucTruoc: number; truocDoGia: boolean }[] {
  const ra: { sk: OSuKien; mucTruoc: number; truocDoGia: boolean }[] = [];
  for (let seed = 1; seed <= soSeed; seed += 1) {
    const m = sinhMap(seed, size, opts);
    const tt = m.trang_thai!;
    let skTruoc: OSuKien | null = null;
    m.o.forEach((o, i) => {
      if (o.kind !== 'su_kien') return;
      if (!tt[i]!.o_lich) {
        ra.push({
          sk: o,
          mucTruoc: i === 0 ? LAI_SUAT_NEN.KHOI_DIEM : tt[i - 1]!.lai_suat_diem,
          truocDoGia: skTruoc?.la_tin_gia === true,
        });
      }
      skTruoc = o;
    });
  }
  return ra;
}

describe('II. Tỷ lệ tin giả theo LOẠI sự kiện', () => {
  it('⭐ tin chính sách khó dựng, đồn Sập sàn dựng rẻ nhất', () => {
    const ds = duyetSuKien(CO_V28, 3000);
    const tyLeGia = (loc: (x: OSuKien) => boolean) => {
      const nhom = ds.filter((d) => loc(d.sk));
      return {
        n: nhom.length,
        gia: nhom.filter((d) => d.sk.la_tin_gia).length / Math.max(1, nhom.length),
      };
    };
    const chinhSach = tyLeGia(
      (x) => x.su_kien === 'ha_lai_suat' || x.su_kien === 'tang_lai_suat');
    const sapSan = tyLeGia((x) => x.su_kien === 'hack_san');
    expect(chinhSach.n, 'không đủ mẫu lá chính sách').toBeGreaterThan(100);
    expect(sapSan.n, 'không đủ mẫu lá Sập sàn').toBeGreaterThan(100);
    // Nhân 0,4 vs 1,6 — khoảng cách phải RÕ, không phải nhích thống kê.
    expect(sapSan.gia, 'Sập sàn phải dễ là tin dựng hơn hẳn tin chính sách')
      .toBeGreaterThan(chinhSach.gia + 0.15);
  });

  it('kẹp sống: không loại nào giả 0% hay 100% (calibration còn thứ để đo)', () => {
    const ds = duyetSuKien(CO_V28, 3000);
    for (const id of ['ha_lai_suat', 'hack_san', 'bong_bong'] as const) {
      const nhom = ds.filter((d) => d.sk.su_kien === id);
      if (nhom.length < 50) continue;
      const gia = nhom.filter((d) => d.sk.la_tin_gia).length / nhom.length;
      expect(gia, `${id} toàn giả`).toBeLessThan(0.95);
      expect(gia, `${id} toàn thật`).toBeGreaterThan(0.05);
    }
  });
});

describe('III. Bong bóng có GỐC tiền tệ', () => {
  it('⭐ vế GIẢ: bong bóng lúc tiền rẻ phần lớn THẬT, ngoài tiền rẻ phần lớn GIẢ', () => {
    const ds = duyetSuKien(CO_V28, 4000).filter((d) => d.sk.su_kien === 'bong_bong');
    const chia = (re: boolean) => {
      const nhom = ds.filter((d) => (moiTruongTienTe(d.mucTruoc) === 're') === re);
      return {
        n: nhom.length,
        gia: nhom.filter((d) => d.sk.la_tin_gia).length / Math.max(1, nhom.length),
      };
    };
    const lucRe = chia(true);
    const khongRe = chia(false);
    expect(lucRe.n, 'không đủ mẫu bong bóng lúc tiền rẻ').toBeGreaterThan(80);
    expect(khongRe.n, 'không đủ mẫu bong bóng ngoài tiền rẻ').toBeGreaterThan(80);
    expect(lucRe.gia, 'tiền rẻ mà bong bóng vẫn toàn giả = gốc không chạy')
      .toBeLessThan(0.5);
    expect(khongRe.gia, 'không tiền rẻ phải thiên về GIẢ (founder 08/08)')
      .toBeGreaterThan(0.5);
    expect(khongRe.gia).toBeGreaterThan(lucRe.gia + 0.2);
  });

  /*
   * ⚠ VẾ GÃY SỚM PHẢI ĐO BẰNG TWIN v27↔v28 CÙNG NHÓM, không so chéo môi trường.
   * Hai bản đầu của bài này so "leo lúc rẻ vs leo ngoài rẻ" trong riêng v28 và
   * ĐỎ NGƯỢC — không phải cơ chế hỏng mà là nhiễu nền: môi trường rẻ sinh từ
   * chuỗi hạ lãi, tức nền quanh bong bóng lúc rẻ thường là GIẢM với quán tính
   * đang kéo xuống. Đo được ngay trong v27 thuần (tilt đồng nhất): leo rẻ 1,33
   * < leo trung tính 1,42. So twin cùng nhóm thì nhiễu nền triệt tiêu và cơ
   * chế hiện nguyên hình: trung tính 1,42 → 1,11 (co ×0,6), rẻ đứng yên.
   * (Kèm bẫy đo thứ nhất: ô lịch phải BỎ QUA chứ không dừng đếm — kỳ họp
   * không làm gãy chế độ bong bóng.)
   */
  it('vế GÃY SỚM (twin v27↔v28): leo ngoài tiền rẻ co lại, leo lúc rẻ đứng yên', () => {
    const doLeo = (opts: typeof CO_V27 | typeof CO_V28) => {
      const leo: Record<'re' | 'khac', number[]> = { re: [], khac: [] };
      for (let seed = 1; seed <= 6000; seed += 1) {
        const m = sinhMap(seed, 16, opts);
        const tt = m.trang_thai!;
        m.o.forEach((o, i) => {
          if (o.kind !== 'su_kien' || o.su_kien !== 'bong_bong'
            || o.la_tin_gia || tt[i]!.o_lich) return;
          const mucTruoc = i === 0 ? LAI_SUAT_NEN.KHOI_DIEM : tt[i - 1]!.lai_suat_diem;
          let dai = 0;
          for (let j = i + 1; j < m.o.length; j += 1) {
            if (tt[j]!.o_lich) continue;
            const oj = m.o[j]!;
            if (oj.kind === 'giai_doan' && oj.giai_doan === 'tang') dai += 1;
            else break;
          }
          leo[moiTruongTienTe(mucTruoc) === 're' ? 're' : 'khac'].push(dai);
        });
      }
      const tb = (xs: number[]) => xs.reduce((a, b) => a + b, 0) / Math.max(1, xs.length);
      return { re: tb(leo.re), khac: tb(leo.khac), nRe: leo.re.length, nKhac: leo.khac.length };
    };
    const cu = doLeo(CO_V27);
    const moi = doLeo(CO_V28);
    expect(cu.nKhac, 'không đủ mẫu leo ngoài rẻ (v27)').toBeGreaterThan(200);
    expect(moi.nKhac, 'không đủ mẫu leo ngoài rẻ (v28)').toBeGreaterThan(200);
    expect(moi.nRe, 'không đủ mẫu leo lúc rẻ (v28)').toBeGreaterThan(500);
    // Ngoài tiền rẻ: tilt co (×0,6 / ×0,35) ⇒ leo phải NGẮN đi rõ.
    expect(moi.khac, 'leo không gốc phải gãy sớm hơn v27').toBeLessThan(cu.khac - 0.15);
    // Lúc tiền rẻ: ×1,0 ⇒ không được xê dịch quá sai số.
    expect(Math.abs(moi.re - cu.re), 'leo có gốc không được đổi (×1,0)').toBeLessThan(0.15);
  });
});

describe('IV. Tin giả lộ ra → SẬP SÀN', () => {
  const phanSapSan = (opts: typeof CO_V27 | typeof CO_V28) => {
    const sau = duyetSuKien(opts, 4000).filter((d) => d.truocDoGia);
    return {
      n: sau.length,
      sap: sau.filter((d) => d.sk.su_kien === 'hack_san').length / Math.max(1, sau.length),
    };
  };

  it('⭐ v28: sự kiện KẾ TIẾP sau tin giả nghiêng áp đảo về Sập sàn', () => {
    const v28 = phanSapSan(CO_V28);
    expect(v28.n, 'không đủ mẫu sự-kiện-sau-tin-giả').toBeGreaterThan(200);
    expect(v28.sap, 'founder đòi "cực cao" — quá nửa số lần rút').toBeGreaterThan(0.5);
  });

  it('đối chứng v27: không có cú nghiêng đó (tin giả từng là nhiễu vô hại)', () => {
    const v27 = phanSapSan(CO_V27);
    expect(v27.n).toBeGreaterThan(200);
    expect(v27.sap, 'v27 mà cũng nghiêng thì bài trên đo nhầm thứ khác')
      .toBeLessThan(0.35);
  });
});

describe('V. Phục hồi là cây cầu', () => {
  /** P(pha kế = X | pha vừa lật = phục hồi), chỉ đếm cú rút TỰ DO. */
  const chuyenTiep = (opts: typeof CO_V27 | typeof CO_V28) => {
    let tang = 0; let giam = 0; let tong = 0;
    for (let seed = 1; seed <= 4000; seed += 1) {
      const m = sinhMap(seed, 16, opts);
      const tt = m.trang_thai!;
      let phaTruoc: string | null = null;
      m.o.forEach((o, i) => {
        if (o.kind !== 'giai_doan') return; // sự kiện không đổi phaCuoi
        const t = tt[i]!;
        // Bỏ ô lịch (GIỮ đội lốt đi ngang) và ô bị chuỗi ép (prior 10000):
        // cầu chỉ nghiêng được cú rút TỰ DO.
        if (!t.o_lich && t.face_prior_bp < 10000 && phaTruoc === 'phuc_hoi') {
          tong += 1;
          if (o.giai_doan === 'tang') tang += 1;
          if (o.giai_doan === 'giam') giam += 1;
        }
        phaTruoc = o.giai_doan;
      });
    }
    return { tang: tang / Math.max(1, tong), giam: giam / Math.max(1, tong), tong };
  };

  it('⭐ v28 so v27: sau phục hồi thì tăng NHIỀU LÊN, giảm ÍT ĐI rõ rệt', () => {
    const cu = chuyenTiep(CO_V27);
    const moi = chuyenTiep(CO_V28);
    expect(cu.tong, 'không đủ mẫu pha-sau-phục-hồi (v27)').toBeGreaterThan(300);
    expect(moi.tong, 'không đủ mẫu pha-sau-phục-hồi (v28)').toBeGreaterThan(300);
    expect(moi.tang, 'cầu không nghiêng về tăng').toBeGreaterThan(cu.tang + 0.1);
    expect(moi.giam, 'cầu không nén được giảm').toBeLessThan(cu.giam * 0.6);
    // Nhưng KHÔNG khoá hẳn: đáy hai lần vẫn phải tồn tại.
    expect(moi.giam, 'giảm tuyệt chủng = cầu thành công tắc đọc 100%')
      .toBeGreaterThan(0.005);
  });
});
