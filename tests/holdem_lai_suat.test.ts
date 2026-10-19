/**
 * LÃI SUẤT NỀN CÔNG KHAI (v26; founder 04/08).
 *
 * *"cho nó tác động rõ ràng hơn tới xác suất thẻ sự kiện và thanh khoản"*.
 *
 * ⚠⚠ BÀI ĐẮT NHẤT FILE LÀ BÀI ĐẦU TIÊN — CỔNG REPLAY. Cơ chế này đổi `sinhMap`,
 * nên nếu cờ rò sang bộ luật cũ thì 137+ trận đã lưu replay ra MỘT MAP KHÁC:
 * người chơi mở lại trận cũ và thấy một trận chưa từng xảy ra. `events` là sản
 * phẩm (A1) và append-only (A3.3) — hỏng chỗ này là hỏng vĩnh viễn.
 */
import { describe, it, expect } from 'vitest';
import { sinhMap, type OThiTruong } from '../server/holdem/map.js';
import { nacHieuDung } from '../server/holdem/engine.js';
import {
  BONG_BONG_V27, LAI_SUAT_NEN, TAI_SAN, dichLaiSuat, moiTruongTienTe,
} from '../config/holdem.js';

const CO_CU = {
  lich: true, quanTinh: true, sucCang: true, chuKy: true,
  duoiTelegraph: true, duoi5: false,
} as const;
const CO_MOI = { ...CO_CU, laiSuatNen: true } as const;

describe('I. ⭐ CỔNG REPLAY — cờ tắt thì map KHÔNG được nhúc nhích', () => {
  it('cùng seed, cờ tắt: dãy ô byte-hệt bản chưa có cơ chế', () => {
    for (const seed of [1, 7, 20260841, 999_983]) {
      for (const size of [8, 12, 16]) {
        const a = sinhMap(seed, size, CO_CU);
        const b = sinhMap(seed, size, { ...CO_CU, laiSuatNen: false });
        expect(JSON.stringify(a.o), `seed ${seed} cỡ ${size}`).toBe(JSON.stringify(b.o));
      }
    }
  });

  it('cờ tắt ⇒ mức đứng yên ở khởi điểm suốt map', () => {
    const m = sinhMap(20260841, 16, CO_CU);
    for (const t of m.trang_thai!) expect(t.lai_suat_diem).toBe(LAI_SUAT_NEN.KHOI_DIEM);
  });

  /*
   * ⚠ Bài này canh CHIỀU NGƯỢC LẠI: cơ chế phải THẬT SỰ đổi được map. Không có
   * nó thì bài trên xanh một cách vô nghĩa — một cờ không làm gì cũng qua.
   */
  it('⭐ cờ BẬT ⇒ có seed cho ra map KHÁC (nếu không thì đây là cơ chế trang trí)', () => {
    const khac = [1, 7, 42, 99, 20260841, 123_457, 999_983].filter((seed) =>
      JSON.stringify(sinhMap(seed, 16, CO_CU).o)
        !== JSON.stringify(sinhMap(seed, 16, CO_MOI).o));
    expect(khac.length, 'bật cờ mà map y hệt = cơ chế không chạy').toBeGreaterThan(0);
  });
});

describe('II. Mức dịch theo chính sách', () => {
  it('kỳ họp dịch mức, và dịch theo hướng THỰC chứ không theo kỳ vọng', () => {
    let thay = 0;
    for (let seed = 1; seed <= 60; seed += 1) {
      const tt = sinhMap(seed, 16, CO_MOI).trang_thai!;
      for (let i = 0; i < tt.length; i += 1) {
        if (!tt[i]!.o_lich) continue;
        const truoc = i === 0 ? LAI_SUAT_NEN.KHOI_DIEM : tt[i - 1]!.lai_suat_diem;
        const mong = dichLaiSuat(truoc, tt[i]!.huong_cs_thuc!, LAI_SUAT_NEN.BUOC_KY_HOP);
        expect(tt[i]!.lai_suat_diem, `seed ${seed} ô ${i + 1}`).toBe(mong);
        thay += 1;
      }
    }
    expect(thay, 'không gặp ô lịch nào — bài này chưa kiểm gì cả').toBeGreaterThan(20);
  });

  it('mức luôn nằm trong [SÀN, TRẦN]', () => {
    for (let seed = 1; seed <= 40; seed += 1) {
      for (const t of sinhMap(seed, 16, CO_MOI).trang_thai!) {
        expect(t.lai_suat_diem).toBeGreaterThanOrEqual(LAI_SUAT_NEN.SAN);
        expect(t.lai_suat_diem).toBeLessThanOrEqual(LAI_SUAT_NEN.TRAN);
      }
    }
  });

  /*
   * ⚠⚠ TIN GIẢ KHÔNG ĐƯỢC DỊCH MỨC. Cho nó dịch là phát không cho người chơi
   * một máy dò tin giả — nhìn mức có nhúc nhích không là biết — và gate G4, cái
   * đo "đọc tin có phải kỹ năng không", chết ngay.
   */
  it('⭐ lá lãi suất GIẢ không dịch mức một điểm nào', () => {
    let gap = 0;
    for (let seed = 1; seed <= 120; seed += 1) {
      const m = sinhMap(seed, 16, CO_MOI);
      const tt = m.trang_thai!;
      m.o.forEach((o, i) => {
        if (o.kind !== 'su_kien' || !o.la_tin_gia) return;
        if (o.su_kien !== 'tang_lai_suat' && o.su_kien !== 'ha_lai_suat') return;
        if (tt[i]!.o_lich) return;
        const truoc = i === 0 ? LAI_SUAT_NEN.KHOI_DIEM : tt[i - 1]!.lai_suat_diem;
        expect(tt[i]!.lai_suat_diem, `seed ${seed} ô ${i + 1}`).toBe(truoc);
        gap += 1;
      });
    }
    expect(gap, 'không gặp lá lãi suất giả nào — bài chưa kiểm gì').toBeGreaterThan(0);
  });
});

describe('III. Tác động 1 — XÁC SUẤT THẺ SỰ KIỆN', () => {
  function demTheo(moiTruong: 're' | 'dat', soSeed = 600) {
    const dem: Record<string, number> = {};
    let tong = 0;
    for (let seed = 1; seed <= soSeed; seed += 1) {
      const m = sinhMap(seed, 16, CO_MOI);
      const tt = m.trang_thai!;
      m.o.forEach((o, i) => {
        if (o.kind !== 'su_kien' || tt[i]!.o_lich) return;
        // Môi trường TRƯỚC cú rút mới là thứ nghiêng trọng số.
        const truoc = i === 0 ? LAI_SUAT_NEN.KHOI_DIEM : tt[i - 1]!.lai_suat_diem;
        if (moiTruongTienTe(truoc) !== moiTruong) return;
        dem[o.su_kien] = (dem[o.su_kien] ?? 0) + 1;
        tong += 1;
      });
    }
    return { dem, tong };
  }

  it('⭐ tiền RẺ thổi bong bóng, tiền ĐẮT thì không', () => {
    const re = demTheo('re');
    const dat = demTheo('dat');
    expect(re.tong, 'không gặp môi trường tiền rẻ').toBeGreaterThan(20);
    expect(dat.tong, 'không gặp môi trường tiền đắt').toBeGreaterThan(20);

    const tyLe = (x: { dem: Record<string, number>; tong: number }, id: string) =>
      (x.dem[id] ?? 0) / x.tong;
    expect(tyLe(re, 'bong_bong'), 'tiền rẻ mà bong bóng không nhiều hơn = cơ chế không tới')
      .toBeGreaterThan(tyLe(dat, 'bong_bong'));
  });

  it('⭐ tiền ĐẮT đẩy sự kiện tín dụng xấu lên', () => {
    const re = demTheo('re');
    const dat = demTheo('dat');
    const xau = (x: { dem: Record<string, number>; tong: number }) =>
      ((x.dem.hack_san ?? 0) + (x.dem.pha_san ?? 0)) / x.tong;
    expect(xau(dat), 'tiền đắt mà tín dụng không xấu đi = ngưỡng vô nghĩa')
      .toBeGreaterThan(xau(re));
  });
});

describe('IV. Tác động 2 — THANH KHOẢN', () => {
  const oTrung: OThiTruong = { kind: 'giai_doan', giai_doan: 'di_ngang' };
  const NAC = ['mong', 'vua', 'day'];

  it('⭐ tiền đắt làm sổ MỎNG đi, tiền rẻ làm DÀY lên — với MỌI mã', () => {
    for (const ts of TAI_SAN) {
      const nen = NAC.indexOf(nacHieuDung(ts, oTrung, null));
      const dat = NAC.indexOf(nacHieuDung(ts, oTrung, LAI_SUAT_NEN.NGUONG_CAO));
      const re = NAC.indexOf(nacHieuDung(ts, oTrung, LAI_SUAT_NEN.NGUONG_THAP));
      expect(dat, `${ts.id} tiền đắt`).toBeLessThanOrEqual(nen);
      expect(re, `${ts.id} tiền rẻ`).toBeGreaterThanOrEqual(nen);
    }
    const coDich = TAI_SAN.some((ts) =>
      nacHieuDung(ts, oTrung, LAI_SUAT_NEN.NGUONG_CAO) !== nacHieuDung(ts, oTrung, null));
    expect(coDich, 'không mã nào dịch nấc = cơ chế trang trí').toBe(true);
  });

  it('mức trung tính KHÔNG đụng nấc nào', () => {
    const giua = Math.floor((LAI_SUAT_NEN.NGUONG_THAP + LAI_SUAT_NEN.NGUONG_CAO) / 2);
    for (const ts of TAI_SAN) {
      expect(nacHieuDung(ts, oTrung, giua)).toBe(nacHieuDung(ts, oTrung, null));
    }
  });

  it('`null` (trận bộ luật cũ) không đụng gì — cổng replay ở tầng thanh khoản', () => {
    for (const ts of TAI_SAN) {
      expect(nacHieuDung(ts, oTrung, null)).toBe(nacHieuDung(ts, oTrung));
    }
  });
});

/*
 * ══════════════════════════════════════════════════════════════════════════════
 * V. v27 — BONG BÓNG THÀNH CHUỖI GÃY ĐƯỢC (founder 04/08)
 * ══════════════════════════════════════════════════════════════════════════════
 *
 * *"từ thẻ bong bóng có xác suất sinh ra các thẻ uptrend sau đó cao hơn nhưng
 * chỉ cần 1 thẻ uptrend gãy thì sẽ thành sập sàn và bắt đầu rơi vào downtrend"*.
 *
 * ⚠ Bản cũ tung một đồng xu ngay tại ô bong bóng rồi ép cứng hai ô — chuỗi CÓ
 * chạy nhưng nó xảy ra SAU LƯNG người chơi, nên không có khoảnh khắc nào để đọc.
 * Đó là "chơi mãi mà không thấy mình tiến bộ".
 */
const CO_V27 = { ...CO_MOI, bongBongChuoi: true } as const;

/** Vị trí các ô bong bóng THẬT trong một map. */
function oBongBong(m: ReturnType<typeof sinhMap>): number[] {
  return m.o.flatMap((o, i) =>
    o.kind === 'su_kien' && o.su_kien === 'bong_bong' && !o.la_tin_gia ? [i] : []);
}

/**
 * Đo chuỗi sau một ô bong bóng: leo bao nhiêu ô `tang`, rồi rơi bao nhiêu ô `giam`.
 *
 * ⚠⚠ PHẢI BƯỚC QUA Ô KỲ HỌP, và bản đầu của chính bài này quên — nên nó đo ra
 * "leo 1 ô thì rơi 0,24 ô" và tôi suýt kết luận cơ chế hỏng. Thực tế kỳ họp
 * (`o_lich`) chen vào giữa chuỗi và đẩy ra một ô `di_ngang` khi hướng là GIỮ;
 * phép đếm dừng ở đó nên không bao giờ thấy cú rơi phía sau.
 * Kỳ họp KHÔNG bị chặn trong chế độ bong bóng, và đó là cố ý — "kỳ họp trumps
 * mọi thứ" (D43). Nên thứ phải sửa là phép đo, không phải cơ chế.
 */
function chuoiSauBongBong(m: ReturnType<typeof sinhMap>, i: number) {
  const tt = m.trang_thai!;
  const laLich = (k: number) => tt[k]!.o_lich;
  const laPha = (k: number, id: string) =>
    m.o[k]!.kind === 'giai_doan' && (m.o[k] as { giai_doan: string }).giai_doan === id;
  let j = i + 1;
  let leo = 0;
  while (j < m.o.length && (laLich(j) || laPha(j, 'tang'))) {
    if (!laLich(j)) leo += 1;
    j += 1;
  }
  let roi = 0;
  while (j < m.o.length && (laLich(j) || laPha(j, 'giam'))) {
    if (!laLich(j)) roi += 1;
    j += 1;
  }
  return { leo, roi };
}

describe('V. Bong bóng gãy được (v27)', () => {
  it('⭐ CỔNG REPLAY — cờ v27 tắt thì map byte-hệt bản v26', () => {
    for (const seed of [1, 7, 20260841, 999_983]) {
      for (const size of [8, 12, 16]) {
        expect(JSON.stringify(sinhMap(seed, size, CO_MOI).o), `seed ${seed}/${size}`)
          .toBe(JSON.stringify(sinhMap(seed, size, { ...CO_MOI, bongBongChuoi: false }).o));
      }
    }
  });

  it('⭐ bật cờ ⇒ map ĐỔI (nếu không thì cơ chế không chạy)', () => {
    const khac = [1, 7, 42, 99, 20260841].filter((s) =>
      JSON.stringify(sinhMap(s, 16, CO_MOI).o) !== JSON.stringify(sinhMap(s, 16, CO_V27).o));
    expect(khac.length).toBeGreaterThan(0);
  });

  /*
   * ⚠⚠ BÀI ĐẮT NHẤT: sau bong bóng phải có chuỗi TĂNG dài hơn hẳn nền, và cú
   * GÃY phải kéo theo chuỗi GIẢM. Không có hai vế đó thì "bong bóng" chỉ là một
   * cái tên dán lên một ô ngẫu nhiên.
   */
  it('⭐ sau bong bóng: chuỗi tăng dài hơn nền, và gãy thì rơi', () => {
    let soBb = 0, tongLeo = 0, coRoi = 0;
    for (let seed = 1; seed <= 800; seed += 1) {
      const m = sinhMap(seed, 16, CO_V27);
      for (const i of oBongBong(m)) {
        soBb += 1;
        const { leo, roi } = chuoiSauBongBong(m, i);
        tongLeo += leo;
        if (roi > 0) coRoi += 1;
      }
    }
    expect(soBb, 'không gặp bong bóng thật nào').toBeGreaterThan(100);
    // Đo được (3.000 seed, map 16): trung bình 1,32 ô. Mốc 0,9 là sàn an toàn
    // dưới số đo — canh HÌNH DẠNG, không khoá một con số sẽ đổi khi cân lại.
    expect(tongLeo / soBb, 'bong bóng không đẻ ra chuỗi tăng nào').toBeGreaterThan(0.9);
    expect(coRoi / soBb, 'gãy mà không rơi = mất nửa sau của câu chuyện')
      .toBeGreaterThan(0.6);
  });

  it('chuỗi phồng có TRẦN — không bong bóng nào chạy tới hết map', () => {
    for (let seed = 1; seed <= 300; seed += 1) {
      const m = sinhMap(seed, 16, CO_V27);
      for (const i of oBongBong(m)) {
        expect(chuoiSauBongBong(m, i).leo, `seed ${seed}`)
          .toBeLessThanOrEqual(BONG_BONG_V27.DAI_TOI_DA);
      }
    }
  });

  it('leo càng cao thì hố càng sâu (thắng đậm thua đau)', () => {
    const sau: Record<number, number[]> = {};
    for (let seed = 1; seed <= 600; seed += 1) {
      const m = sinhMap(seed, 16, CO_V27);
      for (const i of oBongBong(m)) {
        const { leo, roi } = chuoiSauBongBong(m, i);
        if (roi > 0) (sau[leo] ??= []).push(roi);
      }
    }
    const tb = (n: number) => {
      const a = sau[n] ?? [];
      return a.length ? a.reduce((x, y) => x + y, 0) / a.length : 0;
    };
    // Leo 0 ô và leo >=2 ô phải cho hố khác nhau rõ rệt.
    expect(tb(0), 'chưa gặp mẫu leo 0').toBeGreaterThan(0);
    const cao = [2, 3, 4].map(tb).filter((x) => x > 0);
    expect(cao.length, 'chưa gặp mẫu leo cao').toBeGreaterThan(0);
    expect(Math.max(...cao), 'leo cao mà hố không sâu hơn = mất vế "thua đau"')
      .toBeGreaterThan(tb(0));
  });
});
