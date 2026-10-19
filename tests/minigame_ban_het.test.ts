/**
 * D507 — BÁN HẾT DỒN KÝ QUỸ · TIỀN MẶT NẠP ĐƯỢC · CÚ BÁN CỦA VAI LỚN ĐÈ LÊN GHẾ KHÁC. TEST VECTOR CHÉP TAY, viết TRƯỚC code (A8.3).
 * Founder 04/10: *"Làm như ngoài đời. Bán vào để đỡ đòn bẩy nhưng nếu vẫn ko cắt lỗ thì margin call và mất phần vay + lãi"* · *"Bán hết khớp ở giá
 * tương đương trên 2 biểu đồ kia"* · *"BÁN HẾT dồn cả Tiền mặt"* · *"Những người chơi đang chơi và cả bot ở bàn tài sản kia (chỉ lệnh lớn của các
 * role)"* · *"round sau hiển thị đúng là ko còn chip nào ở các tài sản kia nữa"*.
 *   BÁN HẾT (chỉ khi đang bị gọi): MỌI khoản nguồn còn lại (kể cả Tiền mặt) bán TRỌN ở giá biểu đồ của chính nó:
 *     giá trị = floor(khoản × tỷ lệ giá)    tỷ lệ = giá bảng phụ ở nhịp k / giá cuối màn của nó (khoản đã gồm % cả vòng) · Tiền mặt: tỷ lệ 1
 *     phí = floor(giá trị × (trượt mã + 20)/10⁴) · Tiền mặt: 0 ·  ký quỹ nhận = giá trị − phí · khoản nguồn mất TRỌN (vòng sau 0 chip)
 *     vị thế VẪN MỞ; trần lỗ = −(vốn + Σ nhận) ⇒ thanh lý về sau là mất cả phần dồn vào.
 *   NẠP TIỀN MẶT (`nap_tien`): như nạp khoản khác (min(floor(V × 0,2), còn)) nhưng phí 0; quyết toán trừ vào tiền mặt.
 *   VAI LỚN (có hệ số tự đẩy): cú bán của BÁN HẾT trên mã X: mag = −0,0014 × vai × thanh khoản X × √(giá trị / 10.000) (D506) — Tiền mặt không đẩy.
 *   Cú đẩy của người (tự đẩy mã chính + cú bán BÁN HẾT) ĐÈ lên đường giá của ghế KHÁC đang chơi màn trên đúng mã đó (quyết toán cả bàn).
 * Mã thử: CP Chứng khoán (trượt 50 bp). V = 1.000, VÀO ×10 ở 100 (khớp 100,5); giá 95 ở nhịp 16–31 (bị gọi), 91 ở 32, 92 ở 48, còn lại 100.
 */
import { describe, expect, it } from 'vitest';
import { K_MIN, NEN_LS, SO_NHIP, TU_DAY } from '../config/minigame.js';
import { luatCua } from '../config/holdem_balance.js';
import type { NenMin } from '../server/holdem/minigame/dong_gia.js';
import { apXungBan, ketQuaMan, lenhBotBatDay, type LenhMan } from '../server/holdem/minigame/khop.js';
import { apMg, boiCanhCuaGhe, tinhMgCaBan } from '../server/holdem/minigame/quyet_toan.js';
import { dungDongMan } from '../server/holdem/minigame/man.js';
import { taoTran, type GheMoi, type TrangThaiTran } from '../server/holdem/engine.js';

function dong(gia: (k: number) => number): NenMin[] {
  const ra: NenMin[] = [];
  for (let i = 0; i < NEN_LS * K_MIN; i++) ra.push({ o: 100, c: 100, h: 100, l: 100, tick: Array(8).fill(100), v: 0, iSong: i, rut: 0, quet: null });
  let truoc = 100;
  for (let j = 0; j < SO_NHIP / 8; j++) {
    const tick = Array.from({ length: 8 }, (_, t) => gia(j * 8 + t));
    ra.push({ o: truoc, c: tick[7]!, h: Math.max(truoc, ...tick), l: Math.min(truoc, ...tick), tick, v: 0, iSong: j, rut: 0, quet: null });
    truoc = tick[7]!;
  }
  return ra;
}
const duong = (them: Record<number, number> = {}) => dong((k) => them[k] ?? (k >= 16 && k < 32 ? 95 : k === 32 ? 91 : k === 48 ? 92 : 100));
let seq = 0;
const L = (nhip: number, nut: string): LenhMan => ({ seq: ++seq, nhip, nut });
const NGUON = { vang: 3000, tien: 500 };
const giaKhoan = (ma: string) => (ma === 'vang' ? 0.99 : 1);
const chay = (min: NenMin[], lenh: LenhMan[], p: Partial<Parameters<typeof ketQuaMan>[0]> = {}) =>
  ketQuaMan({ min, von: 1000, ma: 'cp_cn', la: 'don_bay', lenh, laiVayPct: 9, napTu: NGUON, giaKhoan, ...p });

describe('§I — Tiền mặt nạp được', () => {
  it('⭐ bị gọi ⇒ NẠP TIỀN MẶT 200 (min(floor(1000 × 0,2), 500)), phí 0, nhận 200', () => {
    const kq = chay(duong(), [L(0, 'vao_x10'), L(20, 'nap_tien')]);
    expect(kq.db!.nap).toEqual([{ ma: 'tien', lay: 200, phi: 0, nhan: 200, nhip: 20, luc: 'goi' }]);
    expect(kq.db!.napNhan).toBe(200);
  });
});

describe('§II — BÁN HẾT dồn ký quỹ (vector chép tay)', () => {
  it('⭐ bị gọi ở 95 ⇒ BÁN HẾT nhịp 20: Vàng floor(3000 × 0,99) = 2.970 · phí floor(2970 × 70/10⁴) = 20 · nhận 2.950; Tiền mặt 500 nhận 500 ⇒ ký quỹ 4.450, vị thế VẪN MỞ', () => {
    const kq = chay(duong(), [L(0, 'vao_x10'), L(20, 'ban_het'), L(48, 'chot')]);
    expect(kq.db!.nap).toEqual([
      { ma: 'vang', lay: 3000, phi: 20, nhan: 2950, nhip: 20, luc: 'ban_het' },
      { ma: 'tien', lay: 500, phi: 0, nhan: 500, nhip: 20, luc: 'ban_het' },
    ]);
    expect(kq.db!.napNhan).toBe(3450);
    // giá 91 ở nhịp 32 KHÔNG thanh lý nữa (sàn lùi xuống ~60,6); CHỐT ở 92: floor(10000 × (91,126 − 100,5)/100,5) − 8 vay = −941
    expect(kq.db!.thanhLy).toBeNull();
    expect(kq.ra).toHaveLength(1);
    expect(kq.ra[0]!.nhip).toBe(48);
    expect(kq.ra[0]!.lai).toBe(-941);
    expect(kq.theoLenh).toBe(-941);
    expect(kq.loi).toBe(-941 + 3450);
    expect(kq.nhan).toContain('ban_het_vao_ky_quy');
    expect(kq.nhan).not.toContain('cat_khi_goi');
  });

  it('⭐ BÁN HẾT rồi giá sập 50 (nhịp 40) ⇒ thanh lý: lãi thô −5.103 ⇒ trần −(1.000 + 3.450) = −4.450 ⇒ khoản chính −1.000; mất cả phần dồn vào', () => {
    const kq = chay(duong({ 40: 50 }), [L(0, 'vao_x10'), L(20, 'ban_het')]);
    expect(kq.db!.thanhLy).toEqual({ nhip: 40, gia: 50 });
    expect(kq.ra[0]!.lai).toBe(-5103);
    expect(kq.theoLenh).toBe(-4450);
    expect(kq.loi).toBe(-1000);
    expect(kq.nhan).toEqual(expect.arrayContaining(['ban_het_vao_ky_quy', 'nap_roi_van_mat']));
  });

  it('⭐ quyết toán: khoản chính + lãi lỗ màn, Vàng về 0 chip (kể cả khi lúc áp khoản đã lên 3.240), Tiền mặt trừ 500 — vòng sau không còn chip ở khoản đã bán', () => {
    const st = { ghe: [{ id: 'ban', da_chay: false, von: 2000, vi_the: { cp_cn: 1000, vang: 3240 } }] } as unknown as TrangThaiTran;
    const sau = apMg(st, { ban: { ma: 'cp_cn', loi: 2509, nap: { vang: 3000, tien: 500 }, het: ['vang'] } });
    expect(sau.ghe[0]!.vi_the).toEqual({ cp_cn: 3509, vang: 0 });
    expect(sau.ghe[0]!.von).toBe(1500);
  });

  it('vế ngược: chưa bị gọi (giá 100) ⇒ BÁN HẾT bị bỏ, không khoản nào bị bán · không còn gì để bán ⇒ không đổi', () => {
    expect(chay(duong(), [L(0, 'vao_x10'), L(8, 'ban_het')]).db!.nap).toEqual([]);
    const rong = chay(duong(), [L(0, 'vao_x10'), L(20, 'ban_het')], { napTu: {} });
    expect(rong.db!.nap).toEqual([]);
    expect(rong.nhan).not.toContain('ban_het_vao_ky_quy');
  });
});

describe('§III — cú bán của VAI LỚN', () => {
  it('⭐ vai lớn (vai 1,5) BÁN HẾT: cú bán trên Vàng mag = −0,0014 × 1,5 × 1,5 × √0,297 = −0,0017167; Tiền mặt không đẩy', () => {
    const kq = chay(duong(), [L(0, 'vao_x10'), L(20, 'ban_het')], { tuDay: 0.01, tuDayVai: 1.5 });
    expect(TU_DAY.CO_SO).toBe(0.0014);
    expect(kq.db!.xungKhoan).toEqual({ vang: [{ nhip: 20, mag: expect.closeTo(-0.0017167, 7), trai: 0 }] });
  });
  it('vế ngược: Cá nhân (không hệ số đẩy) ⇒ không cú bán nào', () => {
    expect(chay(duong(), [L(0, 'vao_x10'), L(20, 'ban_het')]).db!.xungKhoan).toEqual({});
  });
});

describe('§IV — cú đẩy của người đè lên ghế khác cùng mã (quyết toán cả bàn)', () => {
  const ghe = (id: string, loai: 'nguoi' | 'bot', vai: 'ca_map' | 'ca_nhan'): GheMoi =>
    ({ id, loai, bac_rank: 'Đồng', vai, danh_muc: { tai_san: [], chien_thuat: [] } }) as GheMoi;
  /** Trận v57 bàn 12 đầu vòng 3: người (vai `vai`) và bot g1 cùng cầm BTC + Bắt Đáy. */
  const banThu = (seed: number, vai: 'ca_map' | 'ca_nhan'): TrangThaiTran => {
    const st = taoTran(seed, [ghe('ban', 'nguoi', vai), ghe('g1', 'bot', 'ca_nhan'), ghe('g2', 'bot', 'ca_nhan')], luatCua('balance-v57-minigame'), 12);
    // v57 bốc thăm vai theo cỡ bàn ⇒ gán thẳng vai cần thử lên trạng thái.
    return { ...st, vong: 3, ghe: st.ghe.map((g) => ({ ...g, vai: g.id === 'ban' ? vai : 'ca_nhan', trait: [], vi_the: { btc: 100000 },
      danh_muc: { ...g.danh_muc, chien_thuat: ['bat_day'] as never } })) } as TrangThaiTran;
  };
  const LS = { btc: 300 };
  const lenhNguoi = [L(60, 'vao_het'), L(220, 'thoat')];

  it('⭐ người Cá Mập VÀO HẾT/THOÁT ⇒ bot g1 (Bắt Đáy, cùng BTC) chơi trên đường ĐÃ bị đè: đúng = khớp của bot trên apXungBan(đường gốc, cú đẩy của người)', () => {
    let khac = 0;
    for (const seed of [11, 22, 33, 44]) {
      const st = banThu(seed, 'ca_map');
      const { mg, ban } = tinhMgCaBan(st, { seedTran: seed, vong: 2, loiSuat: LS, ban: { lenh: lenhNguoi } });
      expect(ban!.xungBan.length, 'Cá Mập phải tự đẩy').toBeGreaterThan(0);
      const bcBot = boiCanhCuaGhe(st, seed, 2, st.ghe.find((g) => g.id === 'g1')!, LS);
      if ('loi' in bcBot) throw new Error(bcBot.loi);
      const minBot = apXungBan(dungDongMan(bcBot), ban!.xungBan);
      const mong = ketQuaMan({ min: minBot, von: bcBot.von, ma: bcBot.ma, ...(bcBot.nac ? { nac: bcBot.nac } : {}), la: 'bat_day', lenh: lenhBotBatDay(minBot) });
      expect(mg.g1?.loi ?? 0, `seed ${seed}`).toBe(mong.loi);
      const goc = tinhMgCaBan(banThu(seed, 'ca_nhan'), { seedTran: seed, vong: 2, loiSuat: LS, ban: { lenh: lenhNguoi } });
      if ((goc.mg.g1?.loi ?? 0) !== (mg.g1?.loi ?? 0)) khac += 1;
    }
    expect(khac, 'cú đẩy của người không đổi kết quả bot ở seed nào thì bài này không đo gì').toBeGreaterThan(0);
  });

  it('vế ngược: người Cá nhân (không đẩy) ⇒ bot chơi đúng đường gốc', () => {
    const st = banThu(11, 'ca_nhan');
    const { mg, ban } = tinhMgCaBan(st, { seedTran: 11, vong: 2, loiSuat: LS, ban: { lenh: lenhNguoi } });
    expect(ban!.xungBan).toEqual([]);
    const bcBot = boiCanhCuaGhe(st, 11, 2, st.ghe.find((g) => g.id === 'g1')!, LS);
    if ('loi' in bcBot) throw new Error(bcBot.loi);
    const min = dungDongMan(bcBot);
    expect(mg.g1?.loi ?? 0).toBe(ketQuaMan({ min, von: bcBot.von, ma: bcBot.ma, ...(bcBot.nac ? { nac: bcBot.nac } : {}), la: 'bat_day', lenh: lenhBotBatDay(min) }).loi);
  });
});
