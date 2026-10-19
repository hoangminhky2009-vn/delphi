/**
 * LUẬT MỐC TRÒN — mốc 15 và 30 phải trả thứ KHÔNG MUA ĐƯỢC (D68 §4).
 *
 * ═══════════════════════════════════════════════════════════════════════════
 * VÌ SAO LUẬT NÀY CẦN MỘT BÀI CANH, TRONG KHI NÓ NGHE NHƯ CHUYỆN THẨM MỸ
 *
 * `docs/thiet-ke-de-xuat/noi-dung/art-mua-1-vinh-danh-tester.md` §2 nói thẳng lý do, và
 * nó là lý do KINH TẾ chứ không phải gu: D64 chốt mùa reset gần hết mọi thứ TRỪ
 * danh tính và sở hữu. Nên thứ duy nhất còn chứng minh được "tôi đã cày mùa 1"
 * là một món cosmetic KHÔNG BAO GIỜ PHÁT LẠI và KHÔNG MUA ĐƯỢC. Tiền thì mùa
 * sau ai cũng có.
 *
 * ⇒ Nếu mốc 15 hay 30 trả một món mà shop cũng bán, nó thôi chứng minh được gì
 * — mà chứng minh chính là TOÀN BỘ công dụng của nó. Hỏng theo kiểu không ai
 * thấy: món vẫn trao, màn vẫn đẹp, chỉ là nó rỗng nghĩa.
 *
 * ⚠ BÀI NÀY CANH CHIỀU (như `GIA_BAN_SAO_THEM`): hôm nay hai mốc còn `mon_id:
 * null` (chờ art — `server/nhiem_vu.ts` fail-closed, để mốc MỞ chứ không ghi
 * "đã nhận"). Nên nó chưa cấm được gì. Nhưng NGÀY ART VỀ, người nối dây sẽ bị
 * bài này chặn nếu họ tiện tay trỏ vào một khung đang bán 250 Q ở quầy Q — và
 * đó đúng là cú tiện tay dễ xảy ra nhất.
 */
import { describe, expect, it } from 'vitest';
import { CHANG_LO_TRINH, MUA_0_0 } from '../config/progression.js';
import { AVATAR_NEN, KHUNG, NHAN_DAN } from '../config/avatar.js';
import { HOP_GACHA } from '../server/sandbox/ung_vien.js';

/** Mốc tròn = mốc giữa + mốc cuối. Suy từ số chặng, không gõ tay 15/30. */
const MOC_TRON = [Math.floor(MUA_0_0.SO_CHANG / 2), MUA_0_0.SO_CHANG];

/** Mọi id MUA ĐƯỢC bằng Q hoặc QUAY ĐƯỢC bằng T — tức "không chứng minh gì". */
const MUA_HOAC_QUAY_DUOC = new Set<string>([
  ...KHUNG.filter((k) => k.nguon === 'niem_yet_q').map((k) => k.id),
  ...AVATAR_NEN.filter((n) => n.nguon === 'niem_yet_q').map((n) => n.id),
  ...NHAN_DAN.filter((n) => n.nguon === 'niem_yet_q').map((n) => n.id),
  ...HOP_GACHA.map((m) => m.id),
]);

describe('Lộ trình mùa — luật mốc tròn (D68 §4)', () => {
  it('hai mốc tròn nằm đúng chỗ mong đợi của bản thiết kế (15 và 30)', () => {
    expect(MOC_TRON).toEqual([15, 30]);
  });

  it('⭐ mốc tròn KHÔNG được trả món mua được hay quay được', () => {
    for (const no of MOC_TRON) {
      const moc = CHANG_LO_TRINH.find((c) => c.chang_no === no);
      expect(moc, `thiếu chặng ${no}`).toBeDefined();
      if (moc!.mon_id === null) continue; // còn chờ art — fail-closed, hợp lệ
      expect(
        MUA_HOAC_QUAY_DUOC.has(moc!.mon_id),
        `chặng ${no} trả "${moc!.mon_id}" — món này MUA/QUAY được nên nó không `
        + 'chứng minh được ai đã cày. Mốc tròn phải trả thứ không lấy được bằng xu.',
      ).toBe(false);
    }
  });

  it('⭐ mốc tròn phải HỨA một món — nếu không, không có gì để chứng minh đã cày', () => {
    /*
     * `nhan` là lời hứa, và nó cũng là thứ giữ mốc MỞ khi chưa có art: nhánh
     * fail-closed ở `server/nhiem_vu.ts` hỏi `mon_id === null && nhan !== undefined`.
     *
     * ⚠ ĐIỀU KIỆN ĐÓ ĐƯỢC SỬA 04/08 VÌ BẢN CŨ ĐỂ LỌT CHẶNG 30. Cũ nó hỏi
     * `q === 0 && mon_id === null` — chặng 30 có `q: 60` nên vế trái sai, nhánh
     * không chạy, và mốc CUỐI (`doc_ban`, phần thưởng lớn nhất mùa) bị trao 60 Q
     * rồi ĐÓNG SỔ VĨNH VIỄN. Ngày art về thì lần rà sau thấy "đã nhận" và bỏ qua.
     * Không lỗi nào nổ. Bài này canh để điều kiện ấy không trôi ngược.
     */
    for (const no of MOC_TRON) {
      const moc = CHANG_LO_TRINH.find((c) => c.chang_no === no)!;
      expect(moc.nhan,
        `chặng ${no} là mốc tròn mà không hứa món nào — nó chỉ trả Q, mà Q thì `
        + 'mùa sau ai cũng có (D64: mùa reset gần hết mọi thứ trừ sở hữu).',
      ).toBeDefined();
    }
  });

  it('mốc LẺ được phép trả thứ tiêu hao (Q) — luật chỉ siết mốc tròn', () => {
    const le = CHANG_LO_TRINH.filter((c) => !MOC_TRON.includes(c.chang_no));
    expect(le.some((c) => c.q > 0), 'không mốc lẻ nào trả Q?').toBe(true);
  });

  it('mốc `doc_ban` phải là món KHÔNG mua được — cùng lý lẽ với mốc tròn', () => {
    for (const moc of CHANG_LO_TRINH.filter((c) => c.doc_ban === true)) {
      if (moc.mon_id === null) continue;
      expect(
        MUA_HOAC_QUAY_DUOC.has(moc.mon_id),
        `chặng ${moc.chang_no} khai độc bản mà trả món mua/quay được`,
      ).toBe(false);
    }
  });
});
