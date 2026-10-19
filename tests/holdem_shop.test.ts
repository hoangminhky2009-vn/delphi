/**
 * MARKET HOLD'EM — nhịp 1 (shop / tái cơ cấu) + bot.
 *
 * Bất biến quan trọng nhất ở đây KHÔNG phải "shop bày đúng số thẻ" mà là:
 * 3 thẻ tài sản phải CHUNG cả bàn và KHÔNG né được bằng khảo sát lại. Mất
 * tính chất đó là mất luôn lớp crowding — căng thẳng trung tâm của thiết kế.
 */
import { describe, expect, it } from 'vitest';
import {
  bayShop, canhBaoXungDot, capThe, mua, xungDotVoi,
} from '../server/holdem/shop.js';
import {
  BOT_CHOI_DUOC, BOT_THAM_CHIEU, BOT_TIN_HIEU, botTaiCoCau, diemHopGiaiDoan,
  timBot, type BoiCanh,
} from '../server/holdem/bots.js';
import { taoTran, type DanhMuc, type Ghe } from '../server/holdem/engine.js';
import type { OSuKien } from '../server/holdem/map.js';
import { HOLDEM_MATCH, TAI_SAN } from '../config/holdem.js';

const RONG: DanhMuc = { tai_san: [], chien_thuat: [] };

function boiCanh(seed: number, vong: number, ghe: Ghe): BoiCanh {
  const st = taoTran(seed, [ghe]);
  return {
    seed, vong,
    o: st.map.o[vong - 1]!, oThat: st.map.o[vong - 1]!, oTruoc: st.map.o[vong - 2],
    ghe, shop: bayShop(seed, vong, ghe.id, 0, ghe.danh_muc), soNguoiSong: 5,
  };
}

function gheTest(id: string, dm: DanhMuc = RONG): Ghe {
  return {
    id, loai: 'bot', bac_rank: 'Đồng', von: 1000, luot_khao_sat: 4,
    danh_muc: dm, da_chay: false, vong_chay: null, tu_the: 'choi' as const, vong_roi: null, so_lan_cat_lo: 0, vi_the: {},
  };
}

describe('1. SHOP — 3 tài sản CHUNG cả bàn (nền của crowding)', () => {
  it('mọi ghế thấy CÙNG 3 thẻ tài sản trong cùng vòng', () => {
    const a = bayShop(99, 3, 'ghe_a', 0, RONG);
    const b = bayShop(99, 3, 'ghe_b', 0, RONG);
    const c = bayShop(99, 3, 'ghe_c', 0, RONG);
    expect(a.tai_san).toEqual(b.tai_san);
    expect(b.tai_san).toEqual(c.tai_san);
  });

  it('KHẢO SÁT LẠI KHÔNG đổi được tài sản — không né crowding bằng roll', () => {
    const l0 = bayShop(99, 3, 'ghe_a', 0, RONG);
    const l1 = bayShop(99, 3, 'ghe_a', 1, RONG);
    const l2 = bayShop(99, 3, 'ghe_a', 2, RONG);
    expect(l1.tai_san).toEqual(l0.tai_san);
    expect(l2.tai_san).toEqual(l0.tai_san);
  });

  it('nhưng ĐỔI thẻ chiến thuật (đó mới là thứ roll được)', () => {
    const l0 = bayShop(99, 3, 'ghe_a', 0, RONG);
    const l1 = bayShop(99, 3, 'ghe_a', 1, RONG);
    expect(l1.chien_thuat).not.toEqual(l0.chien_thuat);
  });

  it('thẻ chiến thuật RIÊNG từng ghế', () => {
    const a = bayShop(99, 3, 'ghe_a', 0, RONG);
    const b = bayShop(99, 3, 'ghe_b', 0, RONG);
    expect(a.chien_thuat).not.toEqual(b.chien_thuat);
  });

  it('bày đúng số ô và không trùng thẻ', () => {
    for (let v = 1; v <= 8; v += 1) {
      const s = bayShop(7, v, 'g', 0, RONG);
      expect(s.tai_san).toHaveLength(TAI_SAN.length);
      expect(s.chien_thuat).toHaveLength(HOLDEM_MATCH.SHOP_CHIEN_THUAT);
      expect(new Set(s.tai_san).size).toBe(s.tai_san.length);
      expect(new Set(s.chien_thuat).size).toBe(s.chien_thuat.length);
    }
  });

  it('tất định: cùng toạ độ → cùng shop', () => {
    expect(bayShop(5, 2, 'g', 1, RONG)).toEqual(bayShop(5, 2, 'g', 1, RONG));
  });

  it('lượt bày đầu MIỄN PHÍ, từ lần sau mới tốn', () => {
    expect(bayShop(5, 2, 'g', 0, RONG).chi_phi_lan_sau).toBe(0);
    expect(bayShop(5, 2, 'g', 1, RONG).chi_phi_lan_sau)
      .toBe(HOLDEM_MATCH.CHI_PHI_KHAO_SAT_LAI);
  });

  it('PITY: khảo sát ≥3 lần thì chỉ bày thẻ KHÔNG xung đột', () => {
    const dm: DanhMuc = { tai_san: ['btc'], chien_thuat: ['mua_duoi'] };
    for (let seed = 0; seed < 40; seed += 1) {
      const s = bayShop(seed, 4, 'g', 3, dm);
      for (const ct of s.chien_thuat) {
        expect(xungDotVoi(ct, dm), `seed ${seed}: ${ct} vẫn xung đột`).toBe(false);
      }
    }
  });
});

describe('2. MUA — sức chứa, cấp 2, cảnh báo xung đột', () => {
  it('mua tài sản vào danh mục', () => {
    const s = bayShop(1, 1, 'g', 0, RONG);
    const r = mua(RONG, s, s.tai_san[0]!);
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.danh_muc.tai_san).toContain(s.tai_san[0]);
  });

  it('đầy sức chứa tài sản thì từ chối', () => {
    const s = bayShop(1, 1, 'g', 0, RONG);
    // Lấy sức chứa TỪ CONFIG, không hard-code — MAX_TAI_SAN đổi 3→4 ngày 20/07
    // theo ảnh tham chiếu (danh mục 7/7 = 4 tài sản + 3 chiến thuật).
    const day: DanhMuc = {
      tai_san: Array.from({ length: HOLDEM_MATCH.MAX_TAI_SAN }, (_, i) => 'x' + i),
      chien_thuat: [],
    };
    const r = mua(day, s, s.tai_san[0]!);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.loi).toBe('day_tai_san');
  });

  it('bản sao thứ hai = CẤP 2, và không tốn thêm ô danh mục', () => {
    const s = bayShop(3, 1, 'g', 0, RONG);
    const ct = s.chien_thuat[0]!;
    const dm1 = { tai_san: [], chien_thuat: [ct, 'chan_lo', 'phong_ho'] } as DanhMuc;
    expect(capThe(dm1, ct)).toBe(1);
    const r = mua(dm1, s, ct);
    expect(r.ok, 'đầy 3 ô nhưng nâng cấp thì vẫn phải cho').toBe(true);
    if (r.ok) expect(capThe(r.danh_muc, ct)).toBe(2);
  });

  // Founder chốt 20/07: STACK tối đa 3 bản (×1 → ×1,6 → ×2,0), không phải 2.
  // Test cũ khoá trần cấp 2 — đó là luật đã bị thay, không phải bất biến.
  it('CẤP 3 được phép — stack tới 3 bản', () => {
    const s = bayShop(3, 1, 'g', 0, RONG);
    const ct = s.chien_thuat[0]!;
    const r = mua({ tai_san: [], chien_thuat: [ct, ct] }, s, ct);
    expect(r.ok, 'bản sao thứ ba phải được nhận').toBe(true);
    if (r.ok) expect(capThe(r.danh_muc, ct)).toBe(3);
  });

  it('nhưng KHÔNG có cấp 4 — trần là MAX_BAN_SAO', () => {
    const s = bayShop(3, 1, 'g', 0, RONG);
    const ct = s.chien_thuat[0]!;
    const r = mua({ tai_san: [], chien_thuat: [ct, ct, ct] }, s, ct);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.loi).toBe('da_toi_da_ban_sao');
  });

  it('🔴 TÀI SẢN trùng giờ NÂNG CẤP, không còn bị bỏ qua im lặng', () => {
    // Bản cũ trả ok:true với danh mục Y NGUYÊN — người chơi bấm mua lá thứ hai,
    // thấy "thành công", mà không có gì xảy ra. Lớp lỗi tệ nhất: im lặng.
    const s = bayShop(9, 1, 'g', 0, RONG);
    const ts = s.tai_san[0]!;
    const r = mua({ tai_san: [ts], chien_thuat: [] }, s, ts);
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.danh_muc.tai_san.filter((x) => x === ts)).toHaveLength(2);
  });

  it('bản sao KHÔNG tốn thêm ô danh mục', () => {
    const s = bayShop(9, 1, 'g', 0, RONG);
    const ts = s.tai_san[0]!;
    // Đã đầy 4 Ô tài sản bằng 4 mã khác nhau thì vẫn nâng cấp được mã đang có.
    const day = { tai_san: [ts, 'x1', 'x2', 'x3'], chien_thuat: [] };
    const r = mua(day, s, ts);
    expect(r.ok, 'đầy ô nhưng nâng cấp thì vẫn phải cho').toBe(true);
  });

  it('thẻ không có trong shop thì từ chối', () => {
    const s = bayShop(3, 1, 'g', 0, RONG);
    expect(mua(RONG, s, 'khong_ton_tai').ok).toBe(false);
  });

  it('CẢNH BÁO XUNG ĐỘT có nhãn đọc được — UI phải hiện TRƯỚC khi xác nhận', () => {
    const dm: DanhMuc = { tai_san: [], chien_thuat: ['mua_duoi'] };
    const cb = canhBaoXungDot('chan_lo', dm);
    expect(cb).not.toBeNull();
    expect(cb!.nhan).toBe('Chặn Lỗ');
    expect(cb!.nhan_xung_dot).toBe('Mua Đuổi');
  });

  it('không xung đột thì không cảnh báo (đừng doạ nhầm)', () => {
    expect(canhBaoXungDot('phong_ho', { tai_san: [], chien_thuat: ['chan_lo'] }))
      .toBeNull();
  });
});

describe('3. BOT — quyết định tất định, không tự bắn vào chân', () => {
  it('mọi bot đều tất định: cùng bối cảnh → cùng quyết định', () => {
    for (const bot of [...BOT_THAM_CHIEU, ...BOT_TIN_HIEU, ...BOT_CHOI_DUOC]) {
      const ctx = boiCanh(4242, 2, gheTest('g'));
      expect(bot.chonThe(ctx), bot.id).toEqual(bot.chonThe(ctx));
      expect(bot.chonCamKet(ctx), bot.id).toEqual(bot.chonCamKet(ctx));
    }
  });

  it('bot KHÔNG mua thẻ xung đột với thứ đang cầm', () => {
    const dm: DanhMuc = { tai_san: ['btc'], chien_thuat: ['mua_duoi'] };
    for (const bot of BOT_CHOI_DUOC) {
      for (let seed = 0; seed < 25; seed += 1) {
        const ctx = boiCanh(seed, 2, gheTest('g', dm));
        const chon = bot.chonThe(ctx);
        if (chon && ctx.shop.chien_thuat.includes(chon as never)) {
          expect(xungDotVoi(chon as never, dm), `${bot.id} seed ${seed}`).toBe(false);
        }
      }
    }
  });

  it('"Ngồi im" luôn Giữ nguyên và không bao giờ mua', () => {
    const bot = timBot('ngoi_im')!;
    for (let seed = 0; seed < 20; seed += 1) {
      const ctx = boiCanh(seed, 2, gheTest('g'));
      expect(bot.chonThe(ctx)).toBeNull();
      expect(bot.chonCamKet(ctx).hanh_dong).toBe('giu_vi_the');
    }
  });

  it('botTaiCoCau không bao giờ vượt sức chứa danh mục', () => {
    for (const bot of BOT_CHOI_DUOC) {
      let ghe = gheTest('g');
      for (let v = 1; v <= 8; v += 1) {
        const r = botTaiCoCau(bot, boiCanh(31337, v, ghe));
        ghe = { ...ghe, danh_muc: r.danh_muc, luot_khao_sat: r.luot_khao_sat };
        expect(ghe.danh_muc.tai_san.length, bot.id)
          .toBeLessThanOrEqual(HOLDEM_MATCH.MAX_TAI_SAN);
        expect(new Set(ghe.danh_muc.chien_thuat).size, bot.id)
          .toBeLessThanOrEqual(HOLDEM_MATCH.MAX_CHIEN_THUAT);
        expect(ghe.luot_khao_sat, `${bot.id} âm lượt khảo sát`).toBeGreaterThanOrEqual(0);
      }
    }
  });

  it('D473 — `maxLoi` của bối cảnh là trần lõi của bot (khung minigame: 2); vế ngược: vắng trần thì có bot lên 3', () => {
    let len3 = 0;
    // Bắt đầu từ ghế ĐÃ cầm hai lõi (ghim + lượt 1 trong khung) — chỗ trần mới thật sự cắn.
    const haiLoi: DanhMuc = { tai_san: [], chien_thuat: ['khop_nhanh', 'chia_lenh'] };
    for (const bot of BOT_CHOI_DUOC) {
      for (let seed = 0; seed < 30; seed += 1) {
        let a = gheTest('g', haiLoi); let b = gheTest('g', haiLoi);
        for (let v = 1; v <= 8; v += 1) {
          const ra = botTaiCoCau(bot, { ...boiCanh(seed, v, a), maxLoi: 2 });
          a = { ...a, danh_muc: ra.danh_muc, luot_khao_sat: ra.luot_khao_sat };
          expect(new Set(a.danh_muc.chien_thuat).size, `${bot.id} seed ${seed} vòng ${v}`).toBeLessThanOrEqual(2);
          const rb = botTaiCoCau(bot, boiCanh(seed, v, b));
          b = { ...b, danh_muc: rb.danh_muc, luot_khao_sat: rb.luot_khao_sat };
        }
        if (new Set(b.danh_muc.chien_thuat).size >= 3) len3 += 1;
      }
    }
    expect(len3, 'không bot nào lên 3 lõi khi vắng trần — bài trên đo điều luôn đúng').toBeGreaterThan(0);
  });
});

describe('4. BA BOT TÍN HIỆU — thước đo của gate 17.6', () => {
  const oTruocThat: OSuKien = {
    kind: 'su_kien', su_kien: 'ha_lai_suat', la_tin_gia: false, boi_canh: 'don_doc' as const, bao_truoc: 'tang',
  };
  const oTruocGia: OSuKien = { ...oTruocThat, la_tin_gia: true };

  function ctxVoi(oTruoc: OSuKien, dm: DanhMuc): BoiCanh {
    const ghe = gheTest('g', dm);
    return {
      seed: 1, vong: 2,
      o: { kind: 'giai_doan', giai_doan: 'tang' },
      oThat: { kind: 'giai_doan', giai_doan: 'tang' },
      oTruoc, ghe, shop: bayShop(1, 2, 'g', 0, dm), soNguoiSong: 5,
    };
  }

  const dmTang: DanhMuc = { tai_san: ['btc', 'cp_cn'], chien_thuat: [] };

  it('"Tin mọi tin" cam kết MẠNH NHẤT khi có telegraph', () => {
    const tin = timBot('tin_moi_tin')!.chonCamKet(ctxVoi(oTruocThat, dmTang));
    const hn = timBot('hoai_nghi')!.chonCamKet(ctxVoi(oTruocThat, dmTang));
    expect(tin.hanh_dong).toBe('tang_cam_ket');
    expect(hn.hanh_dong).toBe('tang_cam_ket');
    expect(tin.them, 'tin mù phải cam kết nhiều hơn hoài nghi').toBeGreaterThan(hn.them);
  });

  it('"Phớt mọi tin" ra quyết định GIỐNG HỆT dù tin thật hay giả', () => {
    // Ngữ nghĩa đúng: giai đoạn vòng này ĐÃ LẬT nên ai cũng thấy — phớt-tin
    // không bỏ qua điều đó. Thứ nó bỏ qua là DƯ ÂM của tin trước. Nên hai
    // kịch bản thật/giả phải cho cùng một quyết định.
    const bot = timBot('phot_moi_tin')!;
    expect(bot.chonCamKet(ctxVoi(oTruocThat, dmTang)))
      .toEqual(bot.chonCamKet(ctxVoi(oTruocGia, dmTang)));
  });

  it('ORACLE cam kết ÍT HƠN khi tin là giả — trần trên của kỹ năng', () => {
    // Tin giả làm dư âm ĐẢO chiều, nên kỳ vọng vòng này thấp hơn. Oracle biết
    // điều đó nên hạ cỡ cam kết. Không nhất thiết bỏ vòng — giai đoạn đang
    // hiện vẫn có thể tốt.
    const oracle = timBot('oracle')!;
    const that = oracle.chonCamKet(ctxVoi(oTruocThat, dmTang));
    const gia = oracle.chonCamKet(ctxVoi(oTruocGia, dmTang));
    expect(gia.them, 'biết tin giả mà vẫn cam kết y hệt = thông tin vô dụng')
      .toBeLessThan(that.them);
  });

  it('"Tin mọi tin" KHÔNG phân biệt được — đu cả tin giả (đó là điểm yếu của nó)', () => {
    const bot = timBot('tin_moi_tin')!;
    const that = bot.chonCamKet(ctxVoi(oTruocThat, dmTang));
    const gia = bot.chonCamKet(ctxVoi(oTruocGia, dmTang));
    expect(gia).toEqual(that);
  });

  it('điểm hợp giai đoạn: danh mục rủi ro hợp "Tăng", không hợp "Giảm"', () => {
    expect(diemHopGiaiDoan(dmTang, 'tang')).toBeGreaterThan(0);
    expect(diemHopGiaiDoan(dmTang, 'giam')).toBeLessThan(0);
  });
});
