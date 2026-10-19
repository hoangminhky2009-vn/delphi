/**
 * TÍNH CHẤT Ô SỰ KIỆN — ĐẦU SERVER (D152/K1).
 *
 * Bài web (`bon_ho_su_kien.test.tsx`) dựng ODTO tay nên KHÔNG đi qua
 * `oCongKhai` — tiêm lỗi "server thôi gửi tinh_chat" mà 10 bài web vẫn xanh.
 * Bài này khoá đúng mắt xích đó: server PHẢI tính và gửi, vì toàn bộ kiến trúc
 * (founder 29/08: *"1 thẻ với chuỗi sự kiện trước đó có thể có tính chất khác
 * nhau"*) đứng trên việc tính chất là thuộc-tính-của-Ô do server quyết.
 */
import { describe, expect, it } from 'vitest';
import { oCongKhai } from '../server/holdem/map.js';
import { SU_KIEN, TINH_CHAT_NEN } from '../config/holdem.js';
import type { OThiTruong } from '../server/holdem/map.js';

const oSK = (suKien: string, laTinGia: boolean): OThiTruong => ({
  kind: 'su_kien', su_kien: suKien, bao_truoc: 'tang', la_tin_gia: laTinGia,
} as unknown as OThiTruong);

describe('oCongKhai gửi tính chất — và không rò gì kèm theo', () => {
  it('⭐⭐ MỌI loại sự kiện đi qua oCongKhai đều mang tinh_chat đúng bảng nền', () => {
    for (const sk of SU_KIEN) {
      const ra = oCongKhai(oSK(sk.id, false)) as { tinh_chat?: string };
      expect(ra.tinh_chat, `${sk.id}: server không gửi tính chất — client câm`)
        .toBe(TINH_CHAT_NEN[sk.id]);
    }
  });

  it('⭐ tin GIẢ mang tính chất của tin nó GIẢ DẠNG — mặt chữ, không rò cờ', () => {
    /*
     * Hai vế cùng một bài vì chúng là một luật: tính chất đọc `su_kien` (mặt
     * chữ), và cú lột `la_tin_gia` không được vì trường mới mà hở ra. Tin giả
     * bong bóng phải hiện HƯNG PHẤN y hệt tin thật — người đọc huy hiệu giỏi
     * vẫn bị lừa, đó là răng của cơ chế tin giả (D149 §2).
     */
    const ra = oCongKhai(oSK('bong_bong', true)) as Record<string, unknown>;
    expect(ra['tinh_chat']).toBe('hung_phan');
    expect('la_tin_gia' in ra, 'trường mới làm hở cờ tin giả — A3.1 thủng').toBe(false);
  });

  it('ô GIAI ĐOẠN đi qua nguyên vẹn, không bị gắn tính chất', () => {
    const gd = { kind: 'giai_doan', giai_doan: 'tang' } as unknown as OThiTruong;
    const ra = oCongKhai(gd) as Record<string, unknown>;
    expect(ra['tinh_chat']).toBeUndefined();
    expect(ra['giai_doan']).toBe('tang');
  });
});
