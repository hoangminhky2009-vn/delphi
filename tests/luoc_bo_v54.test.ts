/**
 * v54 (D389) — LƯỢC BỎ: bài canh cho từng món founder chốt cắt ngày 23/09.
 *
 * Mỗi mục HAI CHIỀU: khoá mới (v54) đã cắt thật · khoá cũ (v53) vẫn nguyên. Vế v53 là mũi tiêm
 * ngược nằm sẵn — nếu ai đó lỡ cắt luôn ở khoá cũ (đổi replay trận đã lưu) hoặc cắt ở tầng sai
 * (cả hai cùng mất), bài đỏ.
 */
import { describe, expect, it } from 'vitest';
import { HOLDEM_MATCH, luatCua, nhipChonBai, laSeedManTap } from '../config/holdem.js';
import { LOI_BI_CAT } from '../config/luoc_bo.js';
import {
  choiVongCuoc, chotPhien, huongDonCuaLobby, loiGhimCua, taoTran, vaiTheoLuat, vonDauCua,
  tuyChonSinhMap, type GheMoi, type QuyetDinhCuoc,
} from '../server/holdem/engine.js';
import { bayShop, tuyChonShop } from '../server/holdem/shop.js';
import { sinhMap } from '../server/holdem/map.js';
import { VAI, type VaiId } from '../server/holdem/vai.js';

const V54 = 'balance-v54-ngare';
const V53 = 'balance-v53-upo';

const ghe = (id: string, vai?: VaiId): GheMoi => ({
  id, loai: 'bot', bac_rank: 'Đồng', danh_muc: { tai_san: [], chien_thuat: [] },
  ...(vai ? { vai } : {}),
});
const bonGhe: GheMoi[] = ['a', 'b', 'c', 'd'].map((id) => ghe(id));
const BON_VAI: GheMoi[] = [ghe('ban', 'ca_nhan'), ghe('b1', 'ca_map'), ghe('b2', 'doi_lai'), ghe('b3', 'to_chuc')];

describe('I. LÕI GỌN — sáu lõi rời shop (năm lõi bị động D389 + Chặn Lỗ D394)', () => {
  /** Mọi lá shop bày qua nhiều seed · vòng · lượt khảo sát lại · ghế. */
  const quet = (luat: string): Set<string> => {
    const st = taoTran(9001, BON_VAI, luatCua(luat), 16);
    const ra = new Set<string>();
    for (let s = 1; s <= 400; s += 1) {
      const seed = s * 104729;
      if (laSeedManTap(seed)) continue;
      for (const v of [1, 3, 5, 7, 9]) {
        for (const lan of [0, 1, 3]) {
          for (const x of bayShop(seed, v, `g${s % 5}`, lan, { tai_san: [], chien_thuat: [] }, tuyChonShop(st)).chien_thuat) {
            ra.add(x);
          }
        }
      }
    }
    return ra;
  };

  it('v54: không lá nào trong các lõi bị cắt được bày — năm lá hành động vẫn đủ, KHÔNG còn Chặn Lỗ', () => {
    const bay = quet(V54);
    expect([...bay].filter((x) => (LOI_BI_CAT as readonly string[]).includes(x))).toEqual([]);
    // Ghim ĐÍCH DANH: ai lỡ gỡ 'chan_lo' khỏi LOI_BI_CAT thì Chặn Lỗ quay lại kệ và dòng này đỏ (D394).
    expect([...bay].sort()).toEqual(['ban_khong', 'bat_day', 'don_bay', 'luot_song', 'mua_duoi']);
  });

  it('vế ngược — v53 vẫn bày đủ 11 lá (khoá cũ không bị cắt hồi tố)', () => {
    expect(quet(V53).size).toBe(11);
  });

  it('lõi ghim của vai: TỔ CHỨC thôi ghim Đa Dạng Hoá dưới v54; đội lái/cá mập giữ lõi', () => {
    const l54 = luatCua(V54);
    expect(loiGhimCua('to_chuc', l54)).toBeNull();
    expect(loiGhimCua('doi_lai', l54)).toBe('luot_song');
    expect(loiGhimCua('ca_map', l54)).toBe('don_bay');
    expect(loiGhimCua('to_chuc', luatCua(V53))).toBe('da_dang_hoa');
    const st = taoTran(4242, BON_VAI, l54, 16);
    expect(st.ghe.find((g) => g.id === 'b3')!.danh_muc.chien_thuat).toEqual([]);
    expect(st.ghe.find((g) => g.id === 'b1')!.danh_muc.chien_thuat).toEqual(['don_bay']);
    const st53 = taoTran(4242, BON_VAI, luatCua(V53), 16);
    expect(st53.ghe.find((g) => g.id === 'b3')!.danh_muc.chien_thuat).toEqual(['da_dang_hoa']);
  });
});

describe('II. VỐN ĐỀU — vai giữ răng, bỏ hệ số vốn', () => {
  it('v54: mọi ghế vào trận đúng START_VON và xếp hạng quy chiếu START_VON', () => {
    const st = taoTran(4242, BON_VAI, luatCua(V54), 16);
    for (const g of st.ghe) {
      expect(g.von, g.id).toBe(HOLDEM_MATCH.START_VON);
      expect(vonDauCua(st, g), g.id).toBe(HOLDEM_MATCH.START_VON);
    }
    // Răng khác của vai vẫn còn: cờ vai có răng bật nguyên.
    expect(st.vai_co_rang).toBe(true);
  });

  it('vế ngược — v53: cá mập vào ×3 vốn', () => {
    const st = taoTran(4242, BON_VAI, luatCua(V53), 16);
    expect(st.ghe.find((g) => g.id === 'b1')!.von).toBe(HOLDEM_MATCH.START_VON * VAI.ca_map.he_so_von);
  });

  it('catalog vai theo luật: v54 hệ số 1 + tổ chức không ghim; v53 đúng bảng VAI', () => {
    const b = vaiTheoLuat(luatCua(V54));
    expect(Object.values(b).every((v) => v.he_so_von === 1)).toBe(true);
    expect(b.to_chuc.loi_ghim).toBeNull();
    expect(vaiTheoLuat(luatCua(V53))).toEqual(VAI);
    // D406 — chữ theo luật: vốn đều ⇒ cá nhân thôi "vốn nhỏ nhất bàn"; tổ chức mất lõi ghim ⇒ thôi hứa Đa Dạng Hoá.
    expect(b.ca_nhan.cai_gia).not.toMatch(/vốn/i);
    expect(b.to_chuc.dac_quyen).not.toMatch(/Đa Dạng Hoá/);
    expect(b.to_chuc.dac_quyen).toContain('DÒNG TIỀN');
    // Vai không bị luật lược bỏ chạm tới giữ nguyên câu gốc — đè ĐÚNG trường sai, không viết lại cả vai.
    expect(b.doi_lai).toEqual({ ...VAI.doi_lai, he_so_von: 1 });
    expect(b.ca_map).toEqual({ ...VAI.ca_map, he_so_von: 1 });
    expect(b.to_chuc.cai_gia).toBe(VAI.to_chuc.cai_gia);
  });
});

describe('III. QUỸ VÒNG GIỮ — founder 23/09 tối, sau khi gate thử đỏ G1 lúc bỏ nó', () => {
  const theo: QuyetDinhCuoc = () => ({ loai: 'theo' });

  /*
   * D389 — bản đầu v54 tắt quỹ vòng; gate thử (4.000 trận bàn 16) cho "gửi hết vào ngân hàng" thắng
   * 40,9% (G1 đỏ), trả quỹ thì 31,3%. Founder: "Giữ quỹ vòng nhưng làm nó không còn khó hiểu".
   * Bài này canh v54 thu nền + đổ phí vào quỹ Y HỆT v53 — ai lén cắt lại là đỏ.
   */
  it('v54 thu nền và đổ phí vào quỹ y hệt v53', () => {
    const chot = (luat: string): number => {
      const st = { ...taoTran(7, bonGhe, luatCua(luat), 16), phi_giao_dich_vong: 300 };
      return chotPhien(st, choiVongCuoc(st, theo)).ketQua.quy_vong;
    };
    expect(chot(V54)).toBe(HOLDEM_MATCH.CAM_KET_NEN * 4 + 300);
    expect(chot(V54)).toBe(chot(V53));
  });
});

describe('IV. KỲ NGỘ · ĐIỀM BÁO ĐUÔI · ĐÁM ĐÔNG ĐỔI LÁ', () => {
  it('kỳ ngộ: v54 không có vòng kỳ ngộ, trận không mang cờ; v53 bàn 16 có', () => {
    const st = taoTran(4242, BON_VAI, luatCua(V54), 16);
    expect(st.ky_ngo).toBeUndefined();
    expect(nhipChonBai(16, st.ky_ngo === true)).not.toContain('ky_ngo');
    const st53 = taoTran(4242, BON_VAI, luatCua(V53), 16);
    expect(nhipChonBai(16, st53.ky_ngo === true)).toContain('ky_ngo');
  });

  it('điềm báo đuôi: v54 không còn ô lãi suất ngoài lịch mang điềm; v53 có', () => {
    const dem = (luat: string): number => {
      let n = 0;
      for (let s = 0; s < 800; s += 1) {
        const m = sinhMap(s * 7919 + 13, 16, tuyChonSinhMap(luatCua(luat)));
        n += m.trang_thai!.filter((t) => t.ngoai_lich === true).length;
      }
      return n;
    };
    expect(dem(V54)).toBe(0);
    expect(dem(V53)).toBeGreaterThan(0);
  });

  it('đám đông: bàn đang dồn cùng một mã — v54 phản thân CÂM, v53 phản thân sống', () => {
    const don = (luat: string) => {
      const st = taoTran(1, bonGhe, luatCua(luat), 16);
      return {
        ...st,
        ghe: st.ghe.map((g) => ({ ...g, vi_the: { btc: 1000 }, danh_muc: { ...g.danh_muc, tai_san: ['btc'] } })),
        dong_truoc: { btc: 4, cp_cn: 0, vn30: 0, vang: 0, usd: 0, tpcp: 0 },
      };
    };
    expect(huongDonCuaLobby(don(V54))).toBeNull();
    expect(huongDonCuaLobby(don(V53))).toBe('don');
    const st = taoTran(1, bonGhe, luatCua(V54), 16);
    expect(st.be_chuoi_von).toBeUndefined();
    expect(st.ap_luc_ban).toBeUndefined();
  });
});
