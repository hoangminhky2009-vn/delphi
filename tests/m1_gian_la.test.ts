/**
 * M1 · GIÃN LỚP CHIẾN THUẬT Ở MAP NGẮN (D90, cổng v33 — founder 17/08 "làm hết").
 *
 * Map 8 trước đây chọn lá ở 2·3·4 — BA VÒNG LIỀN ngay sau vòng mua đầu, thứ TFT
 * không bao giờ làm. Nay 2·4·6: vòng 1·3·5 chỉ còn ĐÚNG MỘT việc (mua/bán/đọc).
 *
 * ⚠ ĐO ĐƯỢC, KHÔNG SUY: gate G1–G4 map 8 trên v32 và v33 ra số GIỐNG HỆT TỪNG
 * CHỮ SỐ (12.000 trận, 17/08) — vì bot lấy lá theo `shop.chien_thuat` chứ không
 * theo nhịp; nhịp chỉ quyết vòng nào UI bày quầy lá và vòng nào đồng hồ +12s.
 * Cổng version vẫn BẮT BUỘC: bàn tập ghim bộ lõi theo VÒNG, và trận đang lưu
 * phải replay ra đúng bộ nó từng bày.
 */
import { describe, expect, it } from 'vitest';
import {
  HOLDEM_BALANCE_VERSION, HOLDEM_DECISIONS, SO_THE_CHIEN_THUAT,
  giayChonBai, luatCua, nhipChonBai, vongChonChienThuat,
} from '../config/holdem.js';
import { bayShop } from '../server/holdem/shop.js';

describe('M1 — nhịp chọn lá', () => {
  it('⭐ map 8: 2·3·4 → 2·4·6; map 12/16 KHÔNG đổi một chữ số', () => {
    expect(vongChonChienThuat(8)).toEqual([2, 3, 4]);
    expect(vongChonChienThuat(8, true)).toEqual([2, 4, 6]);
    for (const so of [12, 16]) {
      expect(vongChonChienThuat(so, true)).toEqual(vongChonChienThuat(so));
    }
  });

  it('vẫn đủ 3 lượt chọn lá, và không lượt nào rơi vào khúc river không shop', () => {
    const nhip = nhipChonBai(8, false, true);
    expect(nhip.filter((x) => x === 'chien_thuat')).toHaveLength(SO_THE_CHIEN_THUAT);
    for (const v of vongChonChienThuat(8, true)) expect(nhip[v - 1]).toBe('chien_thuat');
    // Hai vòng cuối luôn khoá shop — giãn không được đẩy lá vào đó.
    expect(nhip[6]).toBe('khong');
    expect(nhip[7]).toBe('khong');
  });

  it('đồng hồ đi theo nhịp: +12s đúng ba vòng lá mới, TỔNG giây cả trận không đổi', () => {
    const cu = Array.from({ length: 8 }, (_, i) => giayChonBai(i + 1, 8));
    const moi = Array.from({ length: 8 }, (_, i) => giayChonBai(i + 1, 8, true));
    expect(moi.filter((x, i) => x > (i === 0 ? 45 : 40))).toHaveLength(SO_THE_CHIEN_THUAT);
    expect(moi[1]).toBe(cu[1]);          // vòng 2 vẫn là vòng lá ở cả hai nhịp
    expect(moi[3]).toBeGreaterThan(moi[2]!);  // vòng 4 nay là vòng lá
    expect(moi.reduce((a, b) => a + b, 0)).toBe(cu.reduce((a, b) => a + b, 0));
  });

  it('⭐ BÀN TẬP: bộ lõi ghim dời sang 2·4·6; bảng CŨ giữ nguyên cho trận đã lưu', () => {
    const seed = HOLDEM_DECISIONS.MAN_TAP_SEED;
    const dm = { tai_san: [], chien_thuat: [] } as never;
    // v33 — ghim theo bảng mới.
    expect(bayShop(seed, 2, 'ban', 0, dm, true).chien_thuat).toEqual(['luot_song', 'chan_lo']);
    expect(bayShop(seed, 4, 'ban', 0, dm, true).chien_thuat).toEqual(['don_bay', 'da_dang_hoa']);
    expect(bayShop(seed, 6, 'ban', 0, dm, true).chien_thuat).toEqual(['ban_khong', 'luot_song']);
    // Trận CŨ (cờ tắt) — y nguyên bảng cũ, không một khoá nào bị thêm.
    expect(bayShop(seed, 3, 'ban', 0, dm, false).chien_thuat).toEqual(['don_bay', 'da_dang_hoa']);
    expect(bayShop(seed, 6, 'ban', 0, dm, false).chien_thuat)
      .not.toEqual(['ban_khong', 'luot_song']);
  });

  it('cổng: v33 bật, mọi phiên bản cũ TẮT (trận đã lưu replay nguyên)', () => {
    expect(luatCua('balance-v33-gianla').gianLaMapNgan).toBe(true);
    expect(luatCua('balance-v32-bansac').gianLaMapNgan).toBe(false);
    expect(luatCua('balance-v10-nav').gianLaMapNgan).toBe(false);
    expect(luatCua(null).gianLaMapNgan).toBe(false);
    expect(luatCua(HOLDEM_BALANCE_VERSION).gianLaMapNgan).toBe(true);
  });
});
