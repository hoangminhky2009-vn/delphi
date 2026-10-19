/**
 * PFM — ORACLE: bậc 1 (gương) + bậc 2 (boost) + lời mời bậc 3 (luật). GĐ7.
 *
 *   §I   NỘI DUNG TĨNH — A10 🔒 bằng cấu trúc (quét TU_KE_DON, khuôn `pfm_hu.test.ts`).
 *   §II  CHỌN NỘI DUNG — vector chép tay, ưu tiên thứ tự, dedup theo kỳ.
 *   §III ⭐⭐ KHÔNG TỰ LEO BẬC — ranh cứng nhất của file.
 *   §IV  "ĐÃ HIỆN KỲ" — kho, idempotent.
 *   §V   ĐO — P10, đúng shape đã khai ở config/telemetry.ts.
 */
import { describe, expect, it, beforeEach } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import {
  NOI_DUNG, chonNoiDung, docDaHienKy, ghiDaHienKy, ghiHienThi, ghiTuongTac,
  BAC_CAN_THIEP, TUONG_TAC_ORACLE, type TinHieuChonNoiDung,
} from '../src/pfm/oracle.js';
import { TU_KE_DON } from '../src/lib/khoanh_khac.js';
import { KhoTrongBoNho } from '../src/pfm/kho.js';
import { CHI_TIET_CHO_PHEP } from '@config/telemetry';
import {
  _datLaiChoTest, _trangThaiChoTest, khoiDongDo,
} from '../src/lib/telemetry.js';
import { guongKy, type ChiBu } from '../src/pfm/guong.js';
import { taoKhoan, type Khoan } from '../src/pfm/so.js';
import { PFM } from '@config/pfm';

const LUC = '2026-08-31T10:00:00.000Z';

const guongRong = guongKy([]);

/** Một `ChiBu` dựng tay: `gt` trên `n` quan sát, mốc nền `nen`. */
const chiBu = (gt: number, n: number, nen: number | null): ChiBu =>
  ({ gt, n, nguong: 200_000, soNgayLon: n, nenNgauNhien: nen });

const tin = (v: Partial<TinHieuChonNoiDung> = {}): TinHieuChonNoiDung => ({
  homNay: '2026-08-15',
  guong: guongRong,
  soLuatDangBat: 1,        // mặc định: KHÔNG đủ điều kiện mời bậc 3, để test khác không bị nhiễu
  daHienKy: new Set(),
  ...v,
});

/* ══════════════════════════════════════════════════════════════════════════════
 * §I — NỘI DUNG TĨNH: A10 🔒 bằng cấu trúc
 * ════════════════════════════════════════════════════════════════════════════ */

describe('§I — NOI_DUNG (P13/P14: tĩnh, có id, có vì-sao)', () => {
  it('mỗi thẻ có id duy nhất, bậc hợp lệ, câu + vì-sao không rỗng', () => {
    const ids = new Set<string>();
    for (const nd of NOI_DUNG) {
      expect(ids.has(nd.id), `id trùng: ${nd.id}`).toBe(false);
      ids.add(nd.id);
      expect(BAC_CAN_THIEP).toContain(nd.bac);
      expect(nd.cau.length).toBeGreaterThan(10);
      expect(nd.viSao.length).toBeGreaterThan(10);
    }
  });

  it('⚠ KHÔNG một thẻ nào kê đơn — dùng lại TU_KE_DON dùng chung (D61)', () => {
    for (const nd of NOI_DUNG) {
      for (const tu of TU_KE_DON) {
        expect(nd.cau.toLowerCase().includes(tu), `${nd.id}.cau có từ kê đơn "${tu.trim()}"`)
          .toBe(false);
        expect(nd.viSao.toLowerCase().includes(tu), `${nd.id}.viSao có từ kê đơn "${tu.trim()}"`)
          .toBe(false);
      }
    }
  });

  it('có đủ nội dung cho cả ba bậc (không bậc nào trống)', () => {
    for (const b of BAC_CAN_THIEP) {
      expect(NOI_DUNG.some((nd) => nd.bac === b), `bậc ${b} không có thẻ nào`).toBe(true);
    }
  });
});

/* ══════════════════════════════════════════════════════════════════════════════
 * §II — CHỌN NỘI DUNG: vector chép tay
 * ════════════════════════════════════════════════════════════════════════════ */

describe('§II — chonNoiDung (hàm thuần, tất định)', () => {
  it('không gì đủ điều kiện ⇒ null (im lặng là kết quả hợp lệ)', () => {
    // Không đầu tháng, không tiền-về, không chi-bù, không vi-sale, đã có luật bật.
    expect(chonNoiDung(tin({ homNay: '2026-08-15' }))).toBeNull();
  });

  it('đầu tháng (ngày ≤ 3) ⇒ gương đầu tháng', () => {
    expect(chonNoiDung(tin({ homNay: '2026-09-01' }))?.id).toBe('guong_dau_thang');
    expect(chonNoiDung(tin({ homNay: '2026-09-03' }))?.id).toBe('guong_dau_thang');
    expect(chonNoiDung(tin({ homNay: '2026-09-04' }))).toBeNull();
  });

  it('có tỷ lệ tiền-về-tiêu tính được ⇒ gương tiền về', () => {
    const g = { ...guongRong, tien_ve_tieu: { gt: 0.6, n: 3 } };
    expect(chonNoiDung(tin({ guong: g }))?.id).toBe('guong_tien_ve');
  });

  it('⭐ chi-bù 5/5 trên mốc nền 0,5 ⇒ boost chi-bù (D354)', () => {
    // tiên nghiệm Beta(2,2) + 5 lần vượt ⇒ Beta(7,2); P(> 0,5) = 1 − P(Bin(8; ½) ≥ 7) = 1 − 9/256 = 0,9648 ≥ 0,9
    expect(chonNoiDung(tin({ guong: { ...guongRong, chi_bu: chiBu(1, 5, 0.5) } }))?.id).toBe('boost_chi_bu');
  });

  it('⭐⭐ CA BÁO NHẦM CỦA D353: 2/3 và 4/5 trên mốc nền 0,5 ⇒ IM, dù đều vượt ngưỡng 0,5', () => {
    // 2/3 ⇒ Beta(4,3): 1 − 22/64 = 0,656 · 4/5 ⇒ Beta(6,3): 1 − 37/256 = 0,8555 — cả hai < 0,9.
    // Luật cũ bắn cả hai; với người ghi đủ mọi ngày thì 2/3 xảy ra tình cờ một nửa số lần.
    expect(chonNoiDung(tin({ guong: { ...guongRong, chi_bu: chiBu(2 / 3, 3, 0.5) } }))).toBeNull();
    expect(chonNoiDung(tin({ guong: { ...guongRong, chi_bu: chiBu(0.8, 5, 0.5) } }))).toBeNull();
  });

  it('⭐⭐ CÙNG 4/5, mốc nền KHÁC ⇒ câu trả lời KHÁC — mốc là của TỪNG cuốn sổ, không phải hằng số', () => {
    // nền 0,25 (người ghi thưa): Beta(1,3) + 4 vượt, 1 không ⇒ Beta(5,4); 1 − P(Bin(8; ¼) ≥ 5) = 0,9727
    expect(chonNoiDung(tin({ guong: { ...guongRong, chi_bu: chiBu(0.8, 5, 0.25) } }))?.id).toBe('boost_chi_bu');
    expect(chonNoiDung(tin({ guong: { ...guongRong, chi_bu: chiBu(0.8, 5, 0.5) } }))).toBeNull();
  });

  it('ngưỡng cũ VẪN giữ: chắc chắn vượt mốc nền mà chưa quá nửa số lần ⇒ im (chữ "thường" của thẻ phải đúng)', () => {
    // 5/10 trên nền 0,1 là gấp năm mức tình cờ, nhưng `gt` = 0,5 không > ORACLE_NGUONG_CHI_BU.
    expect(chonNoiDung(tin({ guong: { ...guongRong, chi_bu: chiBu(0.5, 10, 0.1) } }))).toBeNull();
  });

  it('chưa có mốc nền (`null`) ⇒ im — không có gì để so thì không được nói', () => {
    expect(chonNoiDung(tin({ guong: { ...guongRong, chi_bu: chiBu(1, 5, null) } }))).toBeNull();
  });

  it('⭐ vì-sale: 1/3 và 2/4 ⇒ IM (luật cũ bắn cả hai) · 3/3 và 6/8 ⇒ boost vì-sale', () => {
    // Mốc 0,3 cho tham số không nguyên nên không cộng tay được; bốn xác suất do `xacSuatVuotMoc`
    // tính (hàm ấy có vector chép tay riêng ở pfm_do_chac.test.ts): 0,49 · 0,70 · 0,95 · 0,98.
    expect(chonNoiDung(tin({ guong: { ...guongRong, vi_sale: { gt: 1 / 3, n: 3 } } }))).toBeNull();
    expect(chonNoiDung(tin({ guong: { ...guongRong, vi_sale: { gt: 0.5, n: 4 } } }))).toBeNull();
    expect(chonNoiDung(tin({ guong: { ...guongRong, vi_sale: { gt: 1, n: 3 } } }))?.id).toBe('boost_vi_sale');
    expect(chonNoiDung(tin({ guong: { ...guongRong, vi_sale: { gt: 0.75, n: 8 } } }))?.id).toBe('boost_vi_sale');
  });

  it('chưa có luật nào bật ⇒ mời đặt luật (bậc 3) — KHÔNG gate theo tuổi sổ', () => {
    expect(chonNoiDung(tin({ soLuatDangBat: 0 }))?.id).toBe('moi_dat_luat');
  });

  it('⭐ THỨ TỰ ƯU TIÊN: gương/boost THẮNG lời mời đặt luật khi cùng đủ điều kiện (R13)', () => {
    /*
     * ⚠ ĐÂY LÀ BÀI ĐÃ ĐẢO CHIỀU CÓ CHỦ Ý. Bản cũ khoá `moi_dat_luat` đứng đầu, nên
     * hễ user chưa có luật nào thì Oracle LUÔN mời leo bậc 3 và che mất mọi tấm
     * gương đang đủ điều kiện — thẻ MỜI lấn át thẻ MÔ TẢ, đúng thứ thang can thiệp
     * cấm ("user leo thang theo lựa chọn của HỌ, không bị đẩy").
     * Gương tả thứ ĐÃ xảy ra trong sổ; lời mời chỉ là một cánh cửa. Cánh cửa nhường
     * chỗ cho tấm gương.
     */
    const g = {
      ...guongRong,
      chi_bu: chiBu(1, 5, 0.5),
      vi_sale: { gt: 1, n: 3 },
      tien_ve_tieu: { gt: 0.6, n: 3 },
    };
    const ket = chonNoiDung(tin({ guong: g, soLuatDangBat: 0, homNay: '2026-09-01' }));
    expect(ket?.id).toBe('boost_chi_bu');
    expect(ket?.id).not.toBe('moi_dat_luat');
  });

  it('⭐ lời mời đặt luật VẪN hiện khi KHÔNG còn thẻ mô tả nào — xuống cuối ≠ bị chôn', () => {
    // Đưa xuống cuối là đổi ƯU TIÊN, không phải tắt tính năng. Sổ chưa có gì để
    // soi mà user chưa có luật nào ⇒ cánh cửa bậc 3 phải mở ra.
    const ket = chonNoiDung(tin({ soLuatDangBat: 0, homNay: '2026-09-15' }));
    expect(ket?.id).toBe('moi_dat_luat');
  });

  it('⭐ ĐÃ HIỆN TRONG KỲ ⇒ không chọn lại, dù vẫn đủ điều kiện — nhảy xuống thẻ kế', () => {
    const g = { ...guongRong, chi_bu: chiBu(1, 5, 0.5) };
    expect(chonNoiDung(tin({ guong: g }))?.id, 'fixture phải ĐỦ điều kiện trước đã, không thì bài này rỗng')
      .toBe('boost_chi_bu');
    const ket = chonNoiDung(tin({ guong: g, daHienKy: new Set(['boost_chi_bu']) }));
    expect(ket).toBeNull();   // không còn thẻ nào khác đủ điều kiện trong kịch bản này
  });
});

/* ══════════════════════════════════════════════════════════════════════════════
 * §II-bis — ⭐⭐⭐ BÀI CANH TRÊN ĐƯỜNG CHÍNH (D354): sổ → guongKy → chonNoiDung
 * ════════════════════════════════════════════════════════════════════════════ */

describe('§II-bis — thẻ chi-bù KHÔNG báo nhầm trên sổ không có chi bù, và KHÔNG câm trên sổ có', () => {
  /*
   * ⚠ Các bài ở §II dựng `ChiBu` bằng tay, nên chúng không thấy được lỗi D353: lỗi ấy nằm ở chỗ
   * `gt` của một cuốn sổ THẬT trông ra sao khi không có gì xảy ra. Bài này đi đúng đường màn GƯƠNG
   * đi (D78 — đo trên đường chính): sinh sổ, gọi `guongKy`, gọi `chonNoiDung`, đếm.
   * Hạt giống cố định ⇒ tất định. Số đo đầy đủ (20.000 tháng mỗi dòng) ở docs/nhat-ky/D354.md.
   */
  const lcg = (hat: number) => {
    let s = hat >>> 0;
    return () => ((s = (s * 1664525 + 1013904223) >>> 0) / 2 ** 32);
  };
  /** `he` = hệ số nhân mức chi của ngày ngay sau một ngày lớn. `he` = 1 ⇒ KHÔNG có chi bù. */
  const thang = (r: () => number, he: number): Khoan[] => {
    const so: Khoan[] = [];
    let homQuaLon = false;
    for (let d = 1; d <= 30; d++) {
      let x = Math.exp(1.6 * (r() + r() + r() - 1.5));   // lệch phải, trung vị 1
      if (homQuaLon) x *= he;
      const soTien = Math.max(1000, Math.round(50_000 * x));
      homQuaLon = soTien >= 100_000;
      so.push(taoKhoan({ ngay: `2026-08-${String(d).padStart(2, '0')}`, soTien }, LUC, `m${d}`));
    }
    return so;
  };
  const tyLeBan = (he: number, soThang: number): number => {
    const r = lcg(20260920);
    let ban = 0;
    for (let i = 0; i < soThang; i++) {
      if (chonNoiDung(tin({ guong: guongKy(thang(r, he)) }))?.id === 'boost_chi_bu') ban++;
    }
    return ban / soThang;
  };

  it('⭐⭐⭐ sổ KHÔNG có chi bù (người ghi đủ 30 ngày): thẻ bắn < 8% số tháng — luật cũ: 37,5%', () => {
    expect(tyLeBan(1, 3000)).toBeLessThan(0.08);
  });

  it('⭐ sổ CÓ chi bù thật (hôm sau ngày lớn tiêu ×3): thẻ vẫn bắn > 25% số tháng — sửa ≠ bịt miệng', () => {
    // Chặn chiều ngược lại: ai đó vặn ORACLE_DO_CHAC lên 0,99 "cho chắc" là tắt luôn tính năng.
    expect(tyLeBan(3, 3000)).toBeGreaterThan(0.25);
  });

  it('hằng số founder chốt không bị ai lặng lẽ đổi: k = 4 (20/09/2026, D354)', () => {
    expect(PFM.TIEN_NGHIEM_K).toBe(4);
  });
});

/* ══════════════════════════════════════════════════════════════════════════════
 * §III — ⭐⭐ KHÔNG TỰ LEO BẬC
 * ════════════════════════════════════════════════════════════════════════════ */

describe('§III — KHÔNG TỰ LEO BẬC (ranh cứng)', () => {
  it('⭐⭐ oracle.ts KHÔNG import bất kỳ hàm TẠO/SỬA luật nào từ luat.ts', () => {
    // Quét NGUỒN, không quét hành vi — một dòng import viết ra là hỏng vĩnh viễn,
    // đúng lý lẽ tường lửa T/Q. Oracle chỉ được phép MỜI, không được phép TẠO.
    const raw = fs.readFileSync(path.resolve(__dirname, '../src/pfm/oracle.ts'), 'utf8');
    // Bỏ chú thích trước khi quét (khuôn tests/pfm_nen.test.ts §I) — chính dòng
    // GIẢI THÍCH "không được gọi taoLuatMoi" thì lại NHẮC TÊN nó, báo động giả.
    const ma = raw.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '');
    expect(ma).not.toMatch(/from ['"]\.\/luat\.js['"]/);
    const CAM = ['taoLuatMoi', 'suaLuat', 'banLuat', 'ghiNhanGiuVo', 'datBat', 'xoaLuat'];
    for (const ten of CAM) expect(ma, `oracle.ts nhắc "${ten}" ngoài chú thích`).not.toContain(ten);
  });

  it('chọn "moi_dat_luat" chỉ trả về NỘI DUNG để hiện — không phải một Luat, không có id luật nào', () => {
    const ket = chonNoiDung(tin({ soLuatDangBat: 0 }));
    expect(ket?.id).toBe('moi_dat_luat');
    // Đối tượng trả về là NoiDungOracle thuần — không có trường nào gợi ý một
    // luật ĐÃ được tạo (không lichSu, không trangThai, không dieuKien).
    expect(ket).not.toHaveProperty('lichSu');
    expect(ket).not.toHaveProperty('dieuKien');
    expect(ket).not.toHaveProperty('trangThai');
  });

  it('ghiTuongTac("chap_nhan_moi") chỉ ghi ĐO — không có tác dụng phụ nào khác quan sát được', () => {
    _datLaiChoTest();
    const nd = NOI_DUNG.find((n) => n.id === 'moi_dat_luat')!;
    expect(() => ghiTuongTac(nd, 'chap_nhan_moi')).not.toThrow();
    // Hàm trả `void` — không có Luat nào được tạo ra để mà trả về.
    const kq = ghiTuongTac(nd, 'chap_nhan_moi');
    expect(kq).toBeUndefined();
  });
});

/* ══════════════════════════════════════════════════════════════════════════════
 * §IV — "ĐÃ HIỆN KỲ": kho, idempotent
 * ════════════════════════════════════════════════════════════════════════════ */

describe('§IV — docDaHienKy / ghiDaHienKy', () => {
  it('chưa ghi gì ⇒ tập rỗng', async () => {
    const kho = new KhoTrongBoNho();
    expect(await docDaHienKy(kho, '2026-08')).toEqual(new Set());
  });

  it('ghi rồi đọc lại đúng; hai kỳ khác nhau KHÔNG lẫn vào nhau', async () => {
    const kho = new KhoTrongBoNho();
    await ghiDaHienKy(kho, '2026-08', 'guong_dau_thang', LUC);
    await ghiDaHienKy(kho, '2026-08', 'boost_chi_bu', LUC);
    await ghiDaHienKy(kho, '2026-09', 'guong_dau_thang', LUC);

    expect(await docDaHienKy(kho, '2026-08')).toEqual(new Set(['guong_dau_thang', 'boost_chi_bu']));
    expect(await docDaHienKy(kho, '2026-09')).toEqual(new Set(['guong_dau_thang']));
  });

  it('⭐ idempotent — ghi lại cùng id không nhân đôi, không đổi mốc sửa nếu đã có', async () => {
    const kho = new KhoTrongBoNho();
    await ghiDaHienKy(kho, '2026-08', 'guong_dau_thang', LUC);
    await ghiDaHienKy(kho, '2026-08', 'guong_dau_thang', '2026-08-31T23:00:00.000Z');
    const b = await kho.doc('nhip', 'oracle_hien_2026-08');
    expect((b?.d as { daHien: string[] }).daHien).toEqual(['guong_dau_thang']);
  });
});

/* ══════════════════════════════════════════════════════════════════════════════
 * §V — ĐO (P10): đúng shape đã khai ở config/telemetry.ts
 * ════════════════════════════════════════════════════════════════════════════ */

describe('§V — ghiHienThi / ghiTuongTac', () => {
  beforeEach(() => {
    _datLaiChoTest();
    khoiDongDo();
  });

  it('ghiHienThi xếp đúng loai + chi_tiet khớp CHI_TIET_CHO_PHEP', () => {
    const nd = NOI_DUNG[0]!;
    ghiHienThi(nd);
    const { hangDoi } = _trangThaiChoTest();
    const su = hangDoi.find((s) => s.loai === 'oracle_hien');
    expect(su).toBeDefined();
    expect(su?.chi_tiet).toEqual({ noi_dung: nd.id, bac: nd.bac });
    // Mọi khoá trong chi_tiet phải nằm trong whitelist — không tự phát field lạ.
    for (const k of Object.keys(su?.chi_tiet ?? {})) {
      expect(Object.keys(CHI_TIET_CHO_PHEP.oracle_hien)).toContain(k);
    }
  });

  it('ghiTuongTac xếp đúng loai + hanh_dong ∈ TUONG_TAC_ORACLE', () => {
    const nd = NOI_DUNG[0]!;
    for (const hd of TUONG_TAC_ORACLE) {
      _datLaiChoTest();
      khoiDongDo();
      ghiTuongTac(nd, hd);
      const { hangDoi } = _trangThaiChoTest();
      const su = hangDoi.find((s) => s.loai === 'oracle_tuong_tac');
      expect(su?.chi_tiet).toEqual({ noi_dung: nd.id, hanh_dong: hd });
    }
  });

  it('KHÔNG BAO GIỜ ném — đo hỏng không được kéo app hỏng theo (A9)', () => {
    expect(() => ghiHienThi(NOI_DUNG[0]!)).not.toThrow();
    expect(() => ghiTuongTac(NOI_DUNG[0]!, 'bo_qua')).not.toThrow();
  });
});
