/**
 * D530 — KHOÁ v60 `balance-v60-loiman`: LÕI CHỈ TÁC ĐỘNG TRONG MÀN (founder 06/10 chọn *"Chỉ tác động trong màn"*).
 *
 * Lỗi được sửa: engine vẫn chạy lõi kiểu cũ ở MỌI vòng, chồng lên màn minigame — Đòn Bẩy cầm 5.000 Crypto, vòng −10 %, VÀO ×2 trong màn
 * ⇒ engine −1.000 + màn −500 = ×3; vòng không màn vẫn ×2 im lặng; Bắt Đáy / Mua Đuổi ±14–18 % cả danh mục; Lướt Sóng ±10–15 % theo chuỗi tin.
 *
 * Khoá bằng TIỀN, không bằng mắt xích: hai ghế cầm ĐÚNG cùng vị thế, một ghế có lá lõi, một ghế không. v60 ⇒ NAV sau vòng bằng nhau TỪNG CHIP
 * ở mọi vòng (không canh nhịp, không ×2, không lãi vay, không gọi ký quỹ, không sóng). v59 ⇒ phải lệch ít nhất một lần — không thì bài rỗng.
 */
import { describe, expect, it } from 'vitest';
import {
  dichDonBayTheoMa, dungChuoi, giaiQuyetVong, taoTran, tuyChonLenhGhe,
  type GheMoi, type TrangThaiTran,
} from '../server/holdem/engine.js';
import { navCua } from '../server/holdem/nav.js';
import { HOLDEM_BALANCE_VERSION, type ChienThuatId } from '../config/holdem.js';
import { luatCua } from '../config/holdem_balance.js';
import { apMg, tinhMgCaBan } from '../server/holdem/minigame/quyet_toan.js';
import { LUA } from '../config/lua.js';

const V59 = luatCua('balance-v59-kelenh');
const V60 = luatCua('balance-v60-loiman');
const THEO = () => ({ loai: 'theo' }) as never;

const ghe = (id: string, ts: string[], ct: ChienThuatId[]): GheMoi => ({
  id, loai: 'bot', bac_rank: 'Đồng', danh_muc: { tai_san: ts, chien_thuat: ct },
});

/**
 * CÙNG ghế `a` trong hai lần chạy — một lần cầm lá lõi, một lần không; mọi thứ khác y hệt (nhiễu giá rút theo id ghế ⇒ so hai ghế KHÁC id
 * thì lệch sẵn, bài đối chứng xanh oan — lần viết đầu đã vấp đúng chỗ này). Trả số vòng đã so + số vòng NAV/tiền mặt của `a` lệch.
 */
function soCap(luat: typeof V59, loi: ChienThuatId, viThe: Record<string, number>) {
  let daSo = 0, lech = 0;
  const ma = Object.keys(viThe);
  const dung = (seed: number, v: number, ct: ChienThuatId[]) => {
    const goc = taoTran(seed, [ghe('a', ma, ct), ghe('b', ma, []), ghe('d', ['usd'], [])], luat, 8);
    const st: TrangThaiTran = { ...goc, vong: v, ghe: goc.ghe.map((g) => (g.id === 'd' ? g : { ...g, vi_the: { ...viThe }, von: 2000 })) };
    return giaiQuyetVong(st, THEO).trangThai.ghe.find((g) => g.id === 'a')!;
  };
  for (let seed = 1; seed <= 40; seed += 1) {
    const soO = taoTran(seed, [ghe('a', ma, [])], luat, 8).map.o.length;
    for (let v = 2; v <= soO - 1; v += 1) {
      const co = dung(seed, v, [loi]), khong = dung(seed, v, []);
      daSo += 1;
      if (navCua(co) !== navCua(khong) || co.von !== khong.von) lech += 1;
    }
  }
  return { daSo, lech };
}

describe('D530 — khoá v60 là v59 + đúng một cờ', () => {
  // D536 — mặc định lật sang v61: ghim TÍNH CHẤT (khoá mặc định ≥ v60 và còn cờ `loiChiTrongMan`), không ghim chuỗi — vế "không đổi lặng lẽ" golden canh.
  it('mặc định ≥ v60 và còn lõi chỉ trong màn', () => {
    expect(Number(/^balance-v(\d+)/.exec(HOLDEM_BALANCE_VERSION)?.[1])).toBeGreaterThanOrEqual(60);
    expect(luatCua(HOLDEM_BALANCE_VERSION).loiChiTrongMan).toBe(true);
  });
  it('v60 = v59 + loiChiTrongMan', () => {
    const { loiChiTrongMan, ...con } = V60 as typeof V60 & { loiChiTrongMan?: boolean };
    expect(loiChiTrongMan).toBe(true);
    expect(con).toEqual(V59);
  });
  it('cùng seed ⇒ cùng bản đồ (cờ không chạm bản đồ)', () => {
    for (const seed of [3, 77, 2024]) {
      const g = [ghe('a', ['btc'], []), ghe('b', ['usd'], [])];
      expect(taoTran(seed, g, V60, 8).map).toEqual(taoTran(seed, g, V59, 8).map);
    }
  });
});

describe('⭐ D530 — lõi không đổi một chip nào ngoài màn (v60) — và có đổi ở v59 (bài không rỗng)', () => {
  const CA: [ChienThuatId, Record<string, number>][] = [
    ['don_bay', { btc: 6000, vang: 2000 }],
    ['bat_day', { btc: 6000, vn30: 2000 }],
    ['mua_duoi', { btc: 6000, vn30: 2000 }],
    ['luot_song', { btc: 6000, vn30: 2000 }],
    ['ban_khong', { btc: 6000, vn30: 2000 }],
  ];
  for (const [loi, vt] of CA) {
    it(`${loi}: v60 NAV ghế có lõi ≡ ghế không lõi ở mọi vòng`, () => {
      const r = soCap(V60, loi, vt);
      expect(r.daSo).toBeGreaterThan(100);
      expect(r.lech).toBe(0);
    });
  }
  for (const [loi, vt] of CA.filter(([l]) => l !== 'ban_khong')) {   // Bán Khống thuần quyền từ v49 (không hàng T1) ⇒ v59 cũng không lệch qua đường này
    it(`${loi}: v59 có lệch (đối chứng — lõi từng tác động ngoài màn)`, () => {
      expect(soCap(V59, loi, vt).lech).toBeGreaterThan(0);
    });
  }
});

describe('D530 — từng cửa ngoài dây chuyền', () => {
  const ban = (luat: typeof V59) => taoTran(5, [ghe('a', ['btc'], ['don_bay', 'ban_khong']), ghe('d', ['usd'], [])], luat, 8);
  it('lãi vay Đòn Bẩy: đích nhân rỗng ở v60, có mã ở v59', () => {
    for (const [luat, coMa] of [[V59, true], [V60, false]] as const) {
      const st = { ...ban(luat), vong: 2 };
      const g = st.ghe[0]!, o = st.map.o[st.vong]!;
      const { chain } = dungChuoi(st, g, o);
      const chainCo = luat === V60 ? dungChuoi({ ...st, loi_chi_trong_man: false }, g, o).chain : chain;
      expect(dichDonBayTheoMa(st, g, chainCo).length > 0, luat === V60 ? 'v60' : 'v59').toBe(coMa);
    }
  });
  it('mở sổ khống bằng lá Bán Khống: tắt ở v60, bật ở v59', () => {
    expect(tuyChonLenhGhe(ban(V59), ban(V59).ghe[0]!).coBanKhong).toBe(true);
    expect(tuyChonLenhGhe(ban(V60), ban(V60).ghe[0]!).coBanKhong).toBe(false);
  });
  it('dây chuyền v60 không còn mắt xích nào của lõi (canh nhịp · nhân · sóng · hàng tin · cặp)', () => {
    let soVong = 0;
    for (let seed = 1; seed <= 30; seed += 1) {
      const st0 = taoTran(seed, [ghe('a', ['btc', 'vn30'], ['don_bay', 'bat_day', 'mua_duoi', 'luot_song'] as ChienThuatId[])], V60, 8);
      for (let v = 2; v < st0.map.o.length; v += 1) {
        const st = { ...st0, vong: v };
        const { chain } = dungChuoi(st, st.ghe[0]!, st.map.o[v]!);
        soVong += 1;
        expect(chain.filter((m) => ['canh_nhip', 'nhan', 'day_chuyen', 'ct_su_kien', 'cong_huong', 'xung_dot', 'song'].includes(m.kind))).toEqual([]);
      }
    }
    expect(soVong).toBeGreaterThan(100);
  });
});

/*
 * D530 — XU NHIỆM VỤ LÕI dời vào màn (founder 06/10: *"Tính theo lãi lỗ hơn giữ"*): v60 ⇒ ghế có lõi đang chơi mà màn hơn giữ suốt được
 * +XU_NHIEM_VU_LOI, ghi vào dòng màn (`MgGhe.xu`), `apMg` cộng vào ví. v59 không có (xu khi ấy đến từ mắt xích vòng).
 */
describe('D530 — xu nhiệm vụ lõi theo màn', () => {
  const gm = (id: string, loai: 'nguoi' | 'bot'): GheMoi => ({ id, loai, bac_rank: 'Đồng', danh_muc: { tai_san: [], chien_thuat: [] } });
  const banThu = (luat: typeof V59, seed: number): TrangThaiTran => {
    const st = taoTran(seed, [gm('ban', 'nguoi'), gm('g1', 'bot'), gm('g2', 'bot')], luat, 8);
    // g2: KHÔNG lõi, mang tật TÂM LÝ YẾU — khoản giữ có thể được bán cứu (loi > 0) mà không phải lõi chơi ⇒ không xu.
    return { ...st, vong: 3, ghe: st.ghe.map((g) => ({ ...g, vai: 'ca_nhan', trait: g.id === 'g2' ? ['tam_ly_yeu'] : [], vi_the: { btc: 5000 },
      danh_muc: { ...g.danh_muc, chien_thuat: (g.id === 'g2' ? [] : ['bat_day']) as never } })) } as TrangThaiTran;
  };
  /** Ghế cầm Bắt Đáy: bot g1 + người `ban` chưa mở màn (server tự chơi thay — D473, CÙNG luật với bot). g2 không lõi. */
  const quet = (luat: typeof V59, ls = 300) => {
    let duong = 0, am = 0, coXu = 0, sai = 0, g2Duong = 0;
    for (let seed = 1; seed <= 40; seed += 1) {
      const st = banThu(luat, seed);
      const { mg } = tinhMgCaBan(st, { seedTran: seed, vong: 2, loiSuat: { btc: ls }, ban: { lenh: [] } });
      for (const id of ['g1', 'ban'] as const) {
        const x = mg[id];
        if (!x) continue;
        if (x.loi > 0) duong += 1; else am += 1;
        if (x.xu) coXu += 1;
        if ((x.xu ?? 0) !== (luat === V60 && x.loi > 0 ? LUA.XU_NHIEM_VU_LOI : 0)) sai += 1;
      }
      if ((mg.g2?.loi ?? 0) > 0) g2Duong += 1;
      expect(mg.g2?.xu, 'không cầm lõi (Tâm lý yếu cứu khoản giữ) ⇒ không xu').toBeUndefined();
    }
    return { duong, am, coXu, sai, g2Duong };
  };
  it('⭐ v60: có xu ⇔ lõi đang chơi hơn giữ suốt (bot Bắt Đáy, 40 seed) — có cả màn lãi lẫn màn lỗ (bài không rỗng)', () => {
    const r = quet(V60);
    expect(r.duong, 'màn hơn giữ').toBeGreaterThan(0);
    expect(r.am, 'màn kém giữ').toBeGreaterThan(0);
    expect(r.sai).toBe(0);
    expect(r.coXu).toBe(r.duong);
  });
  it('v59: không bao giờ có xu trên dòng màn', () => { expect(quet(V59).coXu).toBe(0); });
  it('thị trường −20 %: Tâm lý yếu cứu khoản giữ của ghế không lõi (loi > 0) vẫn KHÔNG xu — bài không rỗng', () => {
    const r = quet(V60, -2000);
    expect(r.g2Duong, 'g2 phải có màn hơn giữ nhờ Tâm lý yếu').toBeGreaterThan(0);
    expect(r.sai).toBe(0);
  });
  it('apMg cộng xu vào ví; dòng không có trường ⇒ ví giữ nguyên', () => {
    const st = banThu(V60, 7), x0 = st.ghe.find((g) => g.id === 'g1')!.xu ?? 0;
    const co = apMg(st, { g1: { ma: 'btc', loi: 40, xu: 1 } }), khong = apMg(st, { g1: { ma: 'btc', loi: 40 } });
    expect(co.ghe.find((g) => g.id === 'g1')!.xu).toBe(x0 + 1);
    expect(khong.ghe.find((g) => g.id === 'g1')!.xu ?? 0).toBe(x0);
  });
});
