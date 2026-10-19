/**
 * 28/07 — MÁY CƯỢC TẮT (`cuocTat`, balance-v10a).
 *
 * Bối cảnh: sau khi UI gỡ hai nút poker, CHỐT VÒNG nộp chuỗi cược RỖNG và replay
 * xử chuỗi cạn bằng fallback "mặc định THEO" — người chơi tay trắng bị kéo theo
 * mọi lệnh tố của bot. Founder đo trên prod: 10.000 → 2.886 trong MỘT vòng
 * không cầm lá nào. Bộ test này khoá đúng bất biến tiền đã vỡ hôm đó.
 */
import { describe, expect, it } from 'vitest';
import {
  choiVongCuoc, nenVongCua, taoTran, type GheMoi, type QuyetDinhCuoc,
} from '../server/holdem/engine.js';
import { HOLDEM_BALANCE_VERSION, HOLDEM_MATCH, luatCua } from '../config/holdem.js';

const ghe = (id: string): GheMoi => ({
  id, loai: 'bot', bac_rank: 'Đồng', danh_muc: { tai_san: [], chien_thuat: [] },
});

/** Bot hung hãn nhất có thể: tố kịch trần mỗi lần được hỏi. */
const toKichTran: QuyetDinhCuoc = (cuoc) =>
  cuoc.duoc.includes('to')
    ? { loai: 'to', them: cuoc.to_toi_da }
    : { loai: 'theo' };

describe('cuocTat — vòng cược chỉ thu nền, không ai kéo được ai', () => {
  it('phiên bản HIỆN HÀNH phải bật cuocTat — đây chính là bản vá lỗi tiền', () => {
    expect(luatCua(HOLDEM_BALANCE_VERSION).cuocTat).toBe(true);
  });

  // D584 — khoá mặc định (v68) trả giải bằng xu: nền 0. Bất biến "không ai bị kéo vượt nền" đo cả trên khoá prod còn nền 500 (v66).
  for (const khoa of [HOLDEM_BALANCE_VERSION, 'balance-v66-laiap']) {
    it(`bot tố kịch trần mà KHÔNG ghế nào mất quá nền của khoá — ${khoa}`, () => {
      const st = taoTran(2886, ['a', 'b', 'c', 'd', 'e'].map(ghe), luatCua(khoa));
      const tt = choiVongCuoc(st, toKichTran);
      for (const [id, gop] of tt.gop) {
        expect(gop, `ghế ${id} bị kéo vượt nền — máy cược chưa tắt thật`).toBe(nenVongCua(st));
      }
    });
  }
  it('khoá giải tiền (v66) thu đúng CAM_KET_NEN; khoá giải xu (mặc định v68) thu 0', () => {
    expect(nenVongCua(taoTran(2886, ['a', 'b'].map(ghe), luatCua('balance-v66-laiap')))).toBe(HOLDEM_MATCH.CAM_KET_NEN);
    expect(nenVongCua(taoTran(2886, ['a', 'b'].map(ghe), luatCua(HOLDEM_BALANCE_VERSION)))).toBe(0);
  });

  /*
   * ⚠ CHIỀU NGƯỢC — 'bo' PHẢI SỐNG. Bản đầu của bản vá ép thẳng 'theo' mà không
   * mời callback, và toàn bộ nhánh CẮT LỖ (phí, quota, giẫm đạp, rời pot) khoá
   * theo `daBo` ⇒ nút BỎ thành trang trí — bẫy số 1 của repo, lần thứ 10.
   * Test này canh cho lần thứ 11 không xảy ra.
   */
  it("nước 'bo' VẪN đi qua được — cắt lỗ không chết theo máy cược", () => {
    const st = taoTran(2886, ['a', 'b', 'c'].map(ghe), luatCua(HOLDEM_BALANCE_VERSION));
    const tt = choiVongCuoc(st, (cuoc) =>
      cuoc.ghe_id === 'a' && cuoc.duoc.includes('bo')
        ? { loai: 'bo' } : { loai: 'theo' });
    expect(tt.daBo.has('a'), "'bo' bị nuốt — nhánh cắt lỗ chết").toBe(true);
    expect(tt.daBo.size).toBe(1);
  });

  it('trận CŨ (v9) giữ nguyên máy cược — replay lịch sử không được đổi', () => {
    const st = taoTran(2886, ['a', 'b', 'c', 'd', 'e'].map(ghe),
      luatCua('balance-v9-tuongquan'));
    const tt = choiVongCuoc(st, toKichTran);
    const vuotNen = [...tt.gop.values()].some((g) => g > HOLDEM_MATCH.CAM_KET_NEN);
    expect(vuotNen, 'v9 mà không ai tố được nữa = luật cũ đã bị sửa lén').toBe(true);
  });

  it('quỹ vòng = nền × số ghế, không hơn không kém (khoá còn giải tiền — v66)', () => {
    const st = taoTran(7, ['a', 'b', 'c', 'd'].map(ghe), luatCua('balance-v66-laiap'));
    const tt = choiVongCuoc(st, toKichTran);
    let tong = 0;
    for (const v of tt.gop.values()) tong += v;
    expect(tong).toBe(HOLDEM_MATCH.CAM_KET_NEN * 4);
  });
});
