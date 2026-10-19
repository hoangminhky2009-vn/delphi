/**
 * v54 (D395) — THANH KHOẢN NĂM NẤC co giãn theo lá vừa lật (founder 24/09).
 *
 * Canh ba thứ, mỗi thứ hai chiều (khoá mới đổi thật · khoá cũ nguyên — vế cũ là mũi tiêm ngược nằm sẵn):
 *   §I  bảng số: năm nấc, ba nấc giữa ĐỌC `DO_SAU_L` (một nguồn), hai nấc mới nằm ngoài hai đầu;
 *   §II luật dịch nấc khớp tên lá: CẠN THANH KHOẢN co, cả bảy loại thiên nga co như nhau, mã ở đầu
 *       thang cũ nay co/giãn được (BTC xuống CẠN, VN30 lên RẤT DÀY); tin GIẢ không dịch nấc;
 *   §III đường thật: trận v54 mang cờ, v53 không; Bảng điện tử + thước dải 6 mã đọc năm vạch ở v54,
 *       ba vạch ở v53; thước miễn phí coi tin là thật như bảng (không lộ cờ giả sớm một vòng).
 */
import { describe, expect, it } from 'vitest';
import {
  DO_SAU_L, LAI_SUAT_NEN, luatCua, SU_KIEN, TAI_SAN, TINH_CHAT_NEN,
} from '../config/holdem.js';
import { DICH_NAC_NAM, DO_SAU_L_NAM, NAC_NAM } from '../config/thanh_khoan_nam_nac.js';
import {
  dungChuoi, NAC_THANH_KHOAN, nacHieuDung, taoTran, vongDaLat, type GheMoi, type TrangThaiTran,
} from '../server/holdem/engine.js';
import { dungBangDienTu, thanhKhoanCongKhai } from '../server/holdem/bang_dien_tu.js';
import type { HoldemMap, OThiTruong } from '../server/holdem/map.js';

const V54 = 'balance-v54-ngare';
const V53 = 'balance-v53-upo';
const ma = (id: string) => TAI_SAN.find((t) => t.id === id)!;
const gd = (id: string): OThiTruong => ({ kind: 'giai_doan', giai_doan: id as never });
const sk = (id: string, laTinGia = false): OThiTruong => ({
  kind: 'su_kien', su_kien: id as never, la_tin_gia: laTinGia, boi_canh: 'don_doc', bao_truoc: 'giam',
});
/** Mức lãi suất rơi đúng vào môi trường muốn thử. */
const RE = LAI_SUAT_NEN.NGUONG_THAP;
const DAT = LAI_SUAT_NEN.NGUONG_CAO;
const nam = (id: string, o: OThiTruong, ls: number | null = null) => nacHieuDung(ma(id), o, ls, true);
const ba = (id: string, o: OThiTruong, ls: number | null = null) => nacHieuDung(ma(id), o, ls, false);

describe('§I. Bảng số năm nấc', () => {
  it('năm nấc, ba nấc giữa đúng ba nấc cũ và đúng thứ tự', () => {
    expect(NAC_NAM).toEqual(['can', ...NAC_THANH_KHOAN, 'rat_day']);
  });
  it('ba nấc giữa ĐỌC `DO_SAU_L` — mã không bị lá nào chạm thì trượt giá y hệt v53', () => {
    for (const n of NAC_THANH_KHOAN) expect(DO_SAU_L_NAM[n]).toBe(DO_SAU_L[n]);
  });
  it('độ sâu tăng ngặt từ CẠN tới RẤT DÀY', () => {
    const d = NAC_NAM.map((n) => DO_SAU_L_NAM[n]);
    for (let i = 1; i < d.length; i += 1) expect(d[i]!).toBeGreaterThan(d[i - 1]!);
  });
  it('nấc NỀN của sáu mã nằm ở ba nấc giữa ⇒ mã nào cũng còn chỗ co và chỗ giãn', () => {
    for (const t of TAI_SAN) {
      const i = NAC_NAM.indexOf(t.thanh_khoan);
      expect(i, t.id).toBeGreaterThan(0);
      expect(i, t.id).toBeLessThan(NAC_NAM.length - 1);
    }
  });
});

describe('§II. Luật dịch nấc khớp tên lá', () => {
  it('⭐ CẠN THANH KHOẢN co sổ MỌI mã — ba nấc cũ thì không mã nào đổi (lỗi lá hứa một đằng)', () => {
    expect(nam('vn30', sk('hack_san'))).toBe('mong');       // dày −2
    expect(nam('usd', sk('hack_san'))).toBe('mong');
    expect(nam('cp_cn', sk('hack_san'))).toBe('can');       // vừa −2
    expect(nam('btc', sk('hack_san'))).toBe('can');         // mỏng −2 ⇒ kẹp ở CẠN
    for (const t of TAI_SAN) expect(ba(t.id, sk('hack_san')), t.id).toBe(t.thanh_khoan);
  });

  it('⭐ bảy loại thiên nga đen co NHƯ NHAU (một lá, một luật) — suy từ TINH_CHAT_NEN', () => {
    const hoangLoan = SU_KIEN.filter((s) => TINH_CHAT_NEN[s.id] === 'hoang_loan').map((s) => s.id);
    expect(hoangLoan.length).toBeGreaterThanOrEqual(7);
    for (const id of hoangLoan) {
      expect(DICH_NAC_NAM.SU_KIEN[id], id).toBe(-1);
      expect(nam('vn30', sk(id)), id).toBe('vua');
      expect(nam('btc', sk(id)), id).toBe('can');           // BTC nay mỏng thêm được
    }
    // ba nấc cũ: dịch bệnh không làm mỏng gì — đúng chỗ lệch founder bắt
    expect(ba('vn30', sk('dich_benh'))).toBe('day');
  });

  it('⭐ mã ở đầu thang cũ nay giãn được: tiền rẻ đưa VN30/USDT lên RẤT DÀY', () => {
    expect(nam('vn30', gd('di_ngang'), RE)).toBe('rat_day');
    expect(nam('usd', gd('di_ngang'), RE)).toBe('rat_day');
    expect(ba('vn30', gd('di_ngang'), RE)).toBe('day');      // ba nấc: kẹt trần
  });

  it('⭐ QUÁ NÓNG làm DÀY sổ (+1) ở thang năm nấc — ba nấc cũ vẫn làm mỏng (nhánh D1 không đổi)', () => {
    // v54: `bien_dong` là mùa quá nóng của bánh xe — tiền tràn vào; gate D395 đo chiều này kéo cân bằng về.
    expect(nam('vang', gd('bien_dong'))).toBe('day');
    expect(nam('vn30', gd('bien_dong'))).toBe('rat_day');
    expect(ba('vang', gd('bien_dong'))).toBe('mong');
  });

  it('giữ nguyên các nhánh cũ: bong bóng +1 chỉ nhóm risk-on · tiền đắt −1', () => {
    expect(nam('btc', sk('bong_bong'))).toBe('vua');
    expect(nam('vn30', sk('bong_bong'))).toBe('day');
    expect(nam('vang', gd('di_ngang'), DAT)).toBe('mong');
  });

  it('chồng nhau thì cộng rồi KẸP: cạn thanh khoản trong tiền đắt ⇒ VN30 xuống CẠN, không tràn', () => {
    expect(nam('vn30', sk('hack_san'), DAT)).toBe('can');   // dày −2 −1
    expect(nam('btc', sk('hack_san'), DAT)).toBe('can');    // −3 ⇒ kẹp
  });

  it('⚠ tin GIẢ không dịch nấc ở cả hai thang (thanh khoản là dòng tiền thật)', () => {
    for (const t of TAI_SAN) {
      expect(nam(t.id, sk('hack_san', true)), t.id).toBe(t.thanh_khoan);
      expect(nam(t.id, sk('chien_tranh', true)), t.id).toBe(t.thanh_khoan);
    }
  });
});

describe('§III. Đường thật — cờ trận, Bảng điện tử, thước dải 6 mã', () => {
  const ghe = (id: string): GheMoi => ({
    id, loai: id === 'ban' ? 'nguoi' : 'bot', bac_rank: 'Đồng', danh_muc: { tai_san: [], chien_thuat: [] },
  });
  /**
   * Trận v53/v54 với map ghép tay, đang ở vòng 3; `o` nằm ĐÚNG ô "vừa lật" (`vongDaLat − 1`). Tính chỗ
   * đặt từ engine chứ không gõ số: từ D382 có lá mở màn nên vòng N đã lật N lá — gõ tay "ô đầu" là thử
   * nhầm ô (bài này đã đỏ đúng lỗi ấy lần chạy đầu).
   */
  const tran = (luat: string, o: OThiTruong): TrangThaiTran => {
    const st0 = taoTran(4242, [ghe('ban'), ghe('b1')], luatCua(luat), 16);
    const st1: TrangThaiTran = { ...st0, vong: 3 };
    const oMap: OThiTruong[] = Array.from({ length: 8 }, () => gd('di_ngang'));
    oMap[vongDaLat(st1) - 1] = o;
    const map: HoldemMap = { seed: 4242, o: oMap };
    return { ...st1, map };
  };

  it('⭐⭐ CHỖ TIỀN BỊ TRỪ: trượt giá do đông dưới CẠN THANH KHOẢN đọc độ sâu năm nấc (VN30 14.000 → 2.500)', () => {
    /*
     * Ba ghế cùng cầm VN30 ⇒ mắt xích `crowding`. Cùng một trận v54, chỉ bật/tắt cờ trên trạng thái: bật thì
     * sổ VN30 xuống MỎNG (2.500) nên phạt nặng hơn đúng tỷ lệ độ sâu (14.000 / 2.500 ≈ 5,6). Canh CẢ lời gọi
     * ở `dungChuoi` — thiếu cờ ở chỗ gọi là gate đo một bản tắt mà không ai biết.
     */
    const g3 = (id: string): GheMoi => ({
      id, loai: id === 'a' ? 'nguoi' : 'bot', bac_rank: 'Đồng', danh_muc: { tai_san: ['vn30'], chien_thuat: [] },
    });
    const st = taoTran(4243, [g3('a'), g3('b'), g3('c')], luatCua(V54), 16);
    const phat = (s: TrangThaiTran) => dungChuoi(s, s.ghe[0]!, sk('hack_san')).chain
      .find((m) => m.kind === 'crowding' && m.id === 'vn30')?.delta_bp ?? 0;
    const bat = phat(st);
    const tat = phat({ ...st, thanh_khoan_nam_nac: false });
    expect(tat).toBeLessThan(0);
    expect(bat).toBeLessThan(tat);
    expect(bat / tat).toBeGreaterThan(5);
    expect(bat / tat).toBeLessThan(6.2);
  });

  it('⭐ cờ vào trận đúng khoá: v54 có, v53 không (vế v53 = mũi tiêm ngược nằm sẵn)', () => {
    expect(tran(V54, gd('tang')).thanh_khoan_nam_nac).toBe(true);
    expect(tran(V53, gd('tang')).thanh_khoan_nam_nac).toBeUndefined();
  });

  it('⭐ Bảng điện tử ở v54: năm vạch, nấc đọc CẠN THANH KHOẢN; v53 vẫn ba vạch, nấc nền', () => {
    const b54 = dungBangDienTu(tran(V54, sk('hack_san'))).thanh_khoan.find((t) => t.tai_san_id === 'vn30')!;
    expect([b54.tong_vach, b54.nac, b54.vach, b54.vach_nen]).toEqual([5, 'mong', 2, 4]);
    const b53 = dungBangDienTu(tran(V53, sk('hack_san'))).thanh_khoan.find((t) => t.tai_san_id === 'vn30')!;
    expect([b53.tong_vach, b53.nac, b53.vach, b53.vach_nen]).toEqual([3, 'day', 3, 3]);
  });

  it('⭐ thước miễn phí = đúng phép tính của bảng, mã đầu cơ chỉ có BIÊN ĐỘ (luật 2 không thủng)', () => {
    const st = tran(V54, sk('chien_tranh'));
    const mien = thanhKhoanCongKhai(st).thanh_khoan;
    expect(mien).toEqual(dungBangDienTu(st).thanh_khoan);
    for (const t of mien) {
      if (t.tai_san_id === 'btc' || t.tai_san_id === 'cp_cn') {
        expect(t.suong_mu, t.tai_san_id).toBe(true);
        expect(t.vach, t.tai_san_id).toBeNull();
      }
    }
  });

  it('⚠ thước miễn phí coi tin là THẬT: lá giả và lá thật cho CÙNG một thước (không lộ cờ giả sớm)', () => {
    const that = thanhKhoanCongKhai(tran(V54, sk('hack_san'))).thanh_khoan;
    const gia = thanhKhoanCongKhai(tran(V54, sk('hack_san', true))).thanh_khoan;
    expect(gia).toEqual(that);
  });
});
