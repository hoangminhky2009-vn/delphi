/**
 * D315 — LỚP TƯƠNG QUAN CỦA BỘ TÀI SẢN v2 (`balance-v44-tuongquan`).
 *
 * D311 suy lại ĐỘ LỚN ba hàng ma trận nhưng để nguyên TƯƠNG QUAN, nên bộ số và lời
 * giải thích của chính nó nói ngược nhau. Founder chỉ ra 09/09. Bài này khoá phần vá.
 *
 * ⚠ Bài KHÔNG chép lại bảng `BETA_V44` — chép là dựng bản sao thứ hai và bản sao sẽ
 * trôi (D61). Nó khoá QUAN HỆ: cờ tắt ⇒ y hệt trước; cờ bật ⇒ đúng ba tính chất mà
 * sổ nguồn v42 khai (USDT có rủi ro riêng, CTCK bám chỉ số chặt hơn và dao động rộng
 * hơn), và KHÔNG mã nào khác bị chạm.
 */
import { describe, expect, it } from 'vitest';
import {
  BETA_V44, betaCua, bienDongCua, BO_LUAT_THEO_PHIEN_BAN, HOLDEM_BALANCE_VERSION,
  luatCua, SU_KIEN, TAI_SAN, TUONG_QUAN,
} from '../config/holdem.js';

const V44 = 'balance-v44-tuongquan';
const soCua = (k: string) => Number(/^balance-v(\d+)/.exec(k)?.[1] ?? NaN);
const ts = (id: string) => TAI_SAN.find((t) => t.id === id)!;

// ═══════════════════════════════════════════════════════════════════════════
describe('I. Cờ TẮT ⇒ byte-hệt bộ máy cũ', () => {
  it('⭐ mọi mã × mọi mặt tin: β khi tắt cờ == β của bảng gốc', () => {
    for (const t of TAI_SAN) {
      expect(betaCua(t.id, t.nhom, null, false), `${t.id} nền`)
        .toBe(TUONG_QUAN.BETA_NEN[t.nhom]);
      for (const sk of SU_KIEN) {
        const bang = TUONG_QUAN.BETA_SU_KIEN[sk.id]!;
        const mong = Math.max(-9900, Math.min(9900, bang.rieng?.[t.id] ?? bang[t.nhom]));
        expect(betaCua(t.id, t.nhom, sk.id, false), `${t.id}@${sk.id}`).toBe(mong);
      }
    }
  });

  it('`bienDongCua` khi tắt cờ trả đúng `bien_dong_bp` của lá', () => {
    for (const t of TAI_SAN) expect(bienDongCua(t, false), t.id).toBe(t.bien_dong_bp);
  });
});

// ═══════════════════════════════════════════════════════════════════════════
describe('II. Cờ BẬT — ba tính chất sổ nguồn v42 đã khai mà D311 chưa nối', () => {
  it('⭐ USDT có RỦI RO RIÊNG ở ba mặt tin crypto — β THẤP hẳn so nhóm phòng thủ', () => {
    /*
     * Đây là điểm cả lớp này tồn tại vì nó. β cao = mã đi theo cú sốc CHUNG; β thấp =
     * nó có đường đi riêng. Một cú MẤT NEO (USDT 0,95 ngày 12/05/2022; USDC 0,878
     * tháng 3/2023) là chuyện của riêng nó — phần còn lại của chợ KHÔNG cùng rơi thế.
     */
    for (const sk of ['hack_san', 'phap_ly', 'pha_san']) {
      const nhom = TUONG_QUAN.BETA_SU_KIEN[sk]!.phong_thu;
      const sau = betaCua('usd', 'phong_thu', sk, true);
      expect(sau, `${sk}: USDT phải tách khỏi nhóm`).toBeLessThan(nhom);
      expect(betaCua('usd', 'phong_thu', sk, false), `${sk}: cờ tắt giữ nguyên`).toBe(nhom);
    }
  });

  it('⭐ CP Chứng khoán BÁM CHỈ SỐ chặt hơn ở vòng thường — β nền riêng, cao hơn nhóm', () => {
    const nhom = TUONG_QUAN.BETA_NEN.rui_ro;
    expect(betaCua('cp_cn', 'rui_ro', null, true)).toBeGreaterThan(nhom);
    expect(betaCua('cp_cn', 'rui_ro', null, false)).toBe(nhom);
  });

  it('⭐ CP Chứng khoán dao động RỘNG hơn — và phần dôi này KHÁC β, không trùng chỗ', () => {
    expect(bienDongCua(ts('cp_cn'), true)).toBeGreaterThan(ts('cp_cn').bien_dong_bp);
    // Lá khác không đổi một bp nào.
    for (const t of TAI_SAN.filter((x) => x.id !== 'cp_cn')) {
      expect(bienDongCua(t, true), t.id).toBe(t.bien_dong_bp);
    }
  });

  it('⭐ KHÔNG mã nào ngoài `usd` và `cp_cn` bị lớp này chạm', () => {
    const chamNen = Object.keys(BETA_V44.NEN_RIENG);
    const chamSk = new Set(Object.values(BETA_V44.SU_KIEN_RIENG).flatMap((x) => Object.keys(x)));
    expect(chamNen.sort()).toEqual(['cp_cn']);
    expect([...chamSk].sort()).toEqual(['usd']);
    expect(Object.keys(BETA_V44.BIEN_DONG_RIENG).sort()).toEqual(['cp_cn']);
  });

  it('mọi giá trị đè vẫn nằm trong dải kẹp — β = ±1 là mã mất hẳn nhiễu riêng', () => {
    for (const t of TAI_SAN) {
      expect(Math.abs(betaCua(t.id, t.nhom, null, true)), `${t.id} nền`).toBeLessThan(10000);
      for (const sk of SU_KIEN) {
        expect(Math.abs(betaCua(t.id, t.nhom, sk.id, true)), `${t.id}@${sk.id}`)
          .toBeLessThan(10000);
      }
    }
  });

  it('mọi mặt tin trong `SU_KIEN_RIENG` phải là mặt tin CÓ THẬT', () => {
    const that = new Set(SU_KIEN.map((x) => x.id));
    for (const sk of Object.keys(BETA_V44.SU_KIEN_RIENG)) {
      expect(that.has(sk as never), sk).toBe(true);
    }
  });
});

// ═══════════════════════════════════════════════════════════════════════════
describe('III. Bảng luật — cờ betaTaiSanV2', () => {
  it('⭐ MỌI khoá < v44 tắt cờ — v42 đang chạy PROD, không được đổi một bp', () => {
    for (const [ten, luat] of Object.entries(BO_LUAT_THEO_PHIEN_BAN)) {
      expect((luat as unknown as Record<string, boolean>).betaTaiSanV2, ten)
        .toBe(soCua(ten) >= 44);
    }
    expect(luatCua(null).betaTaiSanV2).toBe(false);
  });

  it('v44 khác v43 ĐÚNG một cờ', () => {
    const a = luatCua('balance-v43-nganhang') as unknown as Record<string, boolean>;
    const b = luatCua(V44) as unknown as Record<string, boolean>;
    expect(Object.keys(b).filter((x) => a[x] !== b[x])).toEqual(['betaTaiSanV2']);
  });

  it('⭐ v44 KHÔNG lật lẻ được — nó xếp chồng v43, bật nó là bật cả ngân hàng', () => {
    /*
     * Bản đầu khẳng định "CHƯA lật" và đỏ đúng lúc lật (D317). Vế đáng giữ không phải
     * trạng thái mà là QUAN HỆ XẾP CHỒNG: `betaTaiSanV2` bật mà `tietKiem` tắt nghĩa là
     * ai đó dựng một khoá v44 bỏ qua v43 — cả bảng gate v44 (G1–G5) đo trên bộ CÓ ngân
     * hàng, nên một bộ luật như thế chưa từng được đo một lần nào.
     */
    /*
     * D456 — NGOẠI LỆ CÓ CHỦ ĐÍCH: từ v57 (dòng minigame) sổ tiết kiệm bị BỎ, nên "β v2 bật mà ngân hàng tắt" là thiết kế chứ
     * không phải khoá dựng sai. Ngưỡng theo SỐ PHIÊN BẢN (không liệt tên khoá): khoá < v57 vẫn bị canh nguyên như cũ, và bộ
     * luật v57 được đo riêng bằng gate chạy trên chính khoá ấy (không phải bảng gate v44 có ngân hàng).
     */
    const TU_V57_BO_SO_TIET_KIEM = 57;
    for (const [ten, luat] of Object.entries(BO_LUAT_THEO_PHIEN_BAN)) {
      const l = luat as unknown as Record<string, boolean>;
      if (l.betaTaiSanV2 === true && soCua(ten) < TU_V57_BO_SO_TIET_KIEM) {
        expect(l.tietKiem, `${ten}: bật β v2 mà tắt ngân hàng — bộ luật chưa từng được đo`)
          .toBe(true);
      }
    }
    const md = luatCua(HOLDEM_BALANCE_VERSION) as unknown as Record<string, boolean>;
    if (md.betaTaiSanV2 === true && soCua(HOLDEM_BALANCE_VERSION) < TU_V57_BO_SO_TIET_KIEM) {
      expect(md.tietKiem, 'mặc định').toBe(true);
    }
  });
});
