/**
 * v56 (D447) — PHÍ MUA BÁN CỘNG DỒN CẢ VÒNG THEO TỪNG MÃ.
 *
 * Founder 28/09 chọn "cộng dồn cả vòng" sau số đo trên engine thật: bán hết 18.472 USDT trong MỘT lệnh trả 1.266 phí,
 * cùng lượng ấy chia năm lần KHỚP NGAY trong vòng trả 49 (vàng 2.592 so 120 · crypto 5.184 so 262). D346 định nghĩa phanh
 * "dồn hết" là *chi phí tăng theo lượng tiền đẩy vào chợ trong MỘT vòng*, nhưng mã đặt ngưỡng 4.000 chip cho MỖI lệnh — bot
 * đặt mỗi mã một lệnh nên bàn đo không thấy, người thì né được bằng mấy cú bấm.
 *
 *   §I   BẤT BIẾN ĐƯỜNG ĐI: trong một vòng, phí chỉ phụ thuộc TỔNG tiền đổi tay ở mỗi mã — một lệnh HẾT = năm lần khớp =
 *        một chuỗi nhiều lệnh trùng mã. Không có hệ số lửa/vai ⇒ bằng TUYỆT ĐỐI (tổng hiệu F(sau) − F(trước) rút gọn về
 *        F(tổng)); có hệ số ⇒ lệch tối đa một chip mỗi lệnh (floor của hệ số).
 *   §II  vế ngược: CÙNG các cú bấm ấy dưới v55 thì chia nhỏ vẫn rẻ — bài này đo đúng cờ, không đo điều luôn đúng.
 *   §III sổ sống MỘT vòng: sang vòng sau, lệnh đầu tính lại từ 0.
 *   §IV  cổng: v56 khác v55 đúng MỘT cờ, và là mặc định; bộ tham số server phát (`tuyChonLenhGhe`) mang sổ ấy cho bản
 *        xem trước (bài đối chiếu `web/tests/chip_xem_truoc_mot_nguon.test.tsx` phủ khoá này).
 */
import { describe, expect, it } from 'vitest';
import { HOLDEM_BALANCE_VERSION } from '../config/holdem.js';
import { luatCua } from '../config/holdem_balance.js';
import {
  apLenhMocNav, giaiQuyetVong, taoTran, tuyChonLenhGhe, type Ghe, type TrangThaiTran,
} from '../server/holdem/engine.js';
import { tienTuMoc, type LenhMoc } from '../server/holdem/nav.js';

const V56 = 'balance-v56-congdon';
const V55 = 'balance-v55-build';
const VI_THE = 18_472;

/** Ghế 'ban' cầm sẵn `VI_THE` chip của một mã, tiền mặt 0, giữa trận — đúng hình ảnh founder chụp (VÍ 0 → 17.206). */
function banCam(khoa: string, ma: string, them: Partial<Ghe> = {}): TrangThaiTran {
  const st = taoTran(4470, [
    { id: 'ban', loai: 'nguoi', bac_rank: 'Đồng', vai: 'ca_nhan', danh_muc: { tai_san: [], chien_thuat: [] } },
    { id: 'b1', loai: 'bot', bac_rank: 'Đồng', vai: 'ca_nhan', danh_muc: { tai_san: [], chien_thuat: [] } },
  ], luatCua(khoa), 16);
  const g: Ghe = { ...st.ghe[0]!, von: 0, vi_the: { [ma]: VI_THE }, danh_muc: { tai_san: [ma], chien_thuat: [] }, ...them };
  return { ...st, vong: 5, phi_giao_dich_vong: 0, ghe: [g, st.ghe[1]!] };
}
function chay(st: TrangThaiTran, cum: readonly (readonly LenhMoc[])[]): { st: TrangThaiTran; phi: number; tien: number } {
  let s = st;
  for (const lenh of cum) {
    const r = apLenhMocNav(s, 'ban', lenh);
    expect(r.ok, `bị bác: ${r.loi} · ${JSON.stringify(lenh)}`).toBe(true);
    s = r.st;
  }
  return { st: s, phi: s.phi_giao_dich_vong ?? 0, tien: s.ghe[0]!.von };
}
const ban = (ma: string, moc: number): LenhMoc => ({ ma, chieu: 'ban', moc_bp: moc });
/** Một lệnh HẾT · năm lần khớp (25 % ×4 rồi HẾT) · một chuỗi năm lệnh trùng mã. */
const MOT = (ma: string) => [[ban(ma, 10000)]];
const NAM_LAN = (ma: string) => [2500, 2500, 2500, 2500, 10000].map((m) => [ban(ma, m)]);
const MOT_CHUOI = (ma: string) => [[2500, 2500, 2500, 2500, 10000].map((m) => ban(ma, m))];

describe('§I — v56: phí chỉ phụ thuộc TỔNG tiền đổi tay mỗi mã trong vòng', () => {
  for (const ma of ['usd', 'vang', 'btc']) {
    it(`⭐ ${ma}: bán HẾT một lệnh = năm lần khớp = một chuỗi năm lệnh — phí và tiền về BẰNG TUYỆT ĐỐI`, () => {
      const a = chay(banCam(V56, ma), MOT(ma));
      const b = chay(banCam(V56, ma), NAM_LAN(ma));
      const c = chay(banCam(V56, ma), MOT_CHUOI(ma));
      expect(a.phi, 'phí một lệnh phải là phí bậc hai thật, không phải 0').toBeGreaterThan(0);
      expect(b.phi).toBe(a.phi);
      expect(c.phi).toBe(a.phi);
      expect(b.tien).toBe(a.tien);
      expect(c.tien).toBe(a.tien);
      expect(b.st.ghe[0]!.vi_the[ma] ?? 0).toBe(0);
    });
  }

  it('có hệ số riêng ghế (lửa nấc 3) ⇒ lệch tối đa một chip mỗi lệnh (floor của hệ số), không hơn', () => {
    const lua = { lua: { nac: 3 as const, chuoi: 0, bias: null } };
    const a = chay(banCam(V56, 'btc', lua), MOT('btc'));
    const b = chay(banCam(V56, 'btc', lua), NAM_LAN('btc'));
    expect(a.phi).toBeGreaterThan(0);
    expect(Math.abs(b.phi - a.phi)).toBeLessThanOrEqual(5);
  });

  it('mua cũng cộng dồn: mua 10.000 một lệnh = bốn lần 2.500 (mua 25 % của tiền còn lại thì khác tiền — so theo TIỀN)', () => {
    const mk = () => {
      const st = banCam(V56, 'vang');
      return { ...st, ghe: [{ ...st.ghe[0]!, von: 10_000, vi_the: {}, danh_muc: { tai_san: [], chien_thuat: [] } }, st.ghe[1]!] };
    };
    const a = chay(mk(), [[{ ma: 'vang', chieu: 'mua', moc_bp: 10000 }]]);
    // Bốn lệnh mua lần lượt 25 % · 33 % · 50 % · HẾT tiền còn lại — không có mốc 33 %, nên đi bằng tiền: cộng dồn từng mã
    // chỉ đọc |tiền| đã khớp, nên so tổng phí với phí của TỔNG tiền.
    const b = chay(mk(), [
      [{ ma: 'vang', chieu: 'mua', moc_bp: 2500 }], [{ ma: 'vang', chieu: 'mua', moc_bp: 2500 }],
      [{ ma: 'vang', chieu: 'mua', moc_bp: 5000 }], [{ ma: 'vang', chieu: 'mua', moc_bp: 10000 }],
    ]);
    expect(b.st.ghe[0]!.von).toBe(0);
    expect(a.st.ghe[0]!.von).toBe(0);
    expect(b.phi).toBe(a.phi);
  });
});

describe('§II — vế ngược: dưới v55 chia nhỏ vẫn rẻ (bài đo CỜ, không đo điều luôn đúng)', () => {
  it('⭐ v55: năm lần khớp rẻ hơn một lệnh HẾT hàng chục lần — đúng số đo founder xem (1.266 so 49 ở USDT)', () => {
    const a = chay(banCam(V55, 'usd'), MOT('usd'));
    const b = chay(banCam(V55, 'usd'), NAM_LAN('usd'));
    expect(a.phi).toBe(1266);
    expect(b.phi).toBe(49);
    // Và v56 lấy đúng số của một lệnh HẾT: phanh "dồn hết" giữ nguyên độ nặng, chỉ đường né bị bịt.
    expect(chay(banCam(V56, 'usd'), NAM_LAN('usd')).phi).toBe(1266);
  });
});

describe('§III — sổ đổi tay theo mã sống MỘT vòng', () => {
  it('sang vòng sau, lệnh đầu tính lại từ 0 (không mang tổng vòng trước)', () => {
    const r1 = chay(banCam(V56, 'usd'), [[ban('usd', 5000)]]);
    expect(r1.st.ghe[0]!.doi_ma_vong?.usd).toBe(tienTuMoc(5000, VI_THE));
    const sau = giaiQuyetVong(r1.st, () => ({ loai: 'theo' as const })).trangThai;
    const g = sau.ghe.find((x) => x.id === 'ban')!;
    expect(g.doi_ma_vong, 'sổ vòng trước còn sót sang vòng mới').toBeUndefined();
    expect(tuyChonLenhGhe(sau, g).daDoiMa).toEqual({});
  });
});

describe('§IV — cổng v56', () => {
  it('v56 khác v55 đúng MỘT cờ (`phiCongDonVong`), và khoá mặc định (v58 từ D525) vẫn mang cờ ấy', () => {
    const a = luatCua(V55) as unknown as Record<string, unknown>;
    const b = luatCua(V56) as unknown as Record<string, unknown>;
    const khac = [...new Set([...Object.keys(a), ...Object.keys(b)])].filter((k) => a[k] !== b[k]);
    expect(khac).toEqual(['phiCongDonVong']);
    expect(b.phiCongDonVong).toBe(true);
    // D525 — mặc định lật sang v58; ghim TÍNH CHẤT: khoá mặc định vẫn tính phí cộng dồn cả vòng.
    expect(luatCua(HOLDEM_BALANCE_VERSION).phiCongDonVong).toBe(true);
  });

  it('bộ tham số server phát mang sổ đổi tay — bản xem trước tính cùng phí cộng dồn', () => {
    const r = chay(banCam(V56, 'usd'), [[ban('usd', 2500)]]);
    const tc = tuyChonLenhGhe(r.st, r.st.ghe[0]!);
    expect(tc.daDoiMa).toEqual({ usd: tienTuMoc(2500, VI_THE) });
    // v55 không có khoá này ⇒ DTO trận cũ y như trước.
    const cu = chay(banCam(V55, 'usd'), [[ban('usd', 2500)]]);
    expect(tuyChonLenhGhe(cu.st, cu.st.ghe[0]!).daDoiMa).toBeUndefined();
  });
});
