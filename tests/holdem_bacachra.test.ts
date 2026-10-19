/**
 * BA CÁCH RA PHẢI THỰC SỰ XẢY RA.
 *
 * ─────────────────────────────────────────────────────────────────────────
 * Lỗi gốc (phát hiện 25/07/2026 khi chơi thật trên stack local):
 *
 * Sheet "bỏ bài" có hai nhánh, nhưng CẢ HAI gửi lên server cùng một thứ — bỏ
 * MỘT vòng. Nên `tu_the` của ghế không bao giờ rời `'choi'`, và ba cơ chế trở
 * thành CODE CHẾT dù mỗi cái đều có test riêng và test nào cũng xanh:
 *
 *   1. `PHI_DUNG_NGOAI` — lạm phát bào vốn người đứng ngoài mỗi vòng. Không ghế
 *      nào có tư thế đó nên khoản phí này chưa từng bị thu một lần.
 *   2. `xepHang` đẩy người ĐẦU HÀNG xuống dưới cả người cháy. Nút "Đầu hàng"
 *      chỉ `navigate` về sảnh, không gọi server — nên trận vẫn mở, và từ khi bàn
 *      đấu có địa chỉ `/arena/tran/:id` thì người chơi đi thẳng lại vào được.
 *   3. Phí + quota Cắt lỗ của D2 — chỉ BOT đi qua nhánh đó, người chơi không có
 *      cửa vào nào cả.
 *
 * Nhãn nút thì hứa "ngồi xem tới hết trận" và "tính là THUA". Đây là dạng lỗi
 * tệ nhất: không crash, không log, test xanh, mà cơ chế không tồn tại.
 *
 * VÌ SAO TEST CŨ KHÔNG BẮT ĐƯỢC: chúng gọi `doiTuThe`/`chotPhien` với một state
 * đã ĐƯỢC DỰNG SẴN ở tư thế `dung_ngoai`. Tức là kiểm "nếu ở tư thế đó thì luật
 * đúng", chưa bao giờ kiểm "có đường nào ĐẾN được tư thế đó". File này kiểm đúng
 * cái thứ hai.
 */
import { describe, expect, it } from 'vitest';
import {
  doiTuThe, giaiQuyetVong, taoTran, xepHang, type GheMoi,
} from '../server/holdem/engine.js';
import { PHI_DUNG_NGOAI } from '../config/holdem.js';

function ghe(id: string, taiSan: string[] = []): GheMoi {
  return { id, loai: 'bot', bac_rank: 'Đồng', danh_muc: { tai_san: taiSan, chien_thuat: [] } };
}
const THEO = () => ({ loai: 'theo' as const });

describe('doiTuThe — cửa vào của hai tư thế từng không ai gán được', () => {
  it('đặt tư thế VÀ ghi vong_roi (thiếu vong_roi là tie-break âm thầm dùng 0)', () => {
    const st = taoTran(5, [ghe('a'), ghe('b')]);
    const sau = doiTuThe(st, 'a', 'dung_ngoai', 3);
    const a = sau.ghe.find((g) => g.id === 'a')!;
    expect(a.tu_the).toBe('dung_ngoai');
    expect(a.vong_roi).toBe(3);
    // Ghế khác không bị đụng tới.
    expect(sau.ghe.find((g) => g.id === 'b')!.tu_the).toBe('choi');
  });

  it('hàm THUẦN — không sửa state cũ (replay dựng lại từ log phải ra y hệt)', () => {
    const st = taoTran(5, [ghe('a'), ghe('b')]);
    doiTuThe(st, 'a', 'dau_hang', 2);
    expect(st.ghe.find((g) => g.id === 'a')!.tu_the).toBe('choi');
  });

  it('KHÔNG ghi đè tư thế đã rời — đứng ngoài rồi thì không "đầu hàng lại"', () => {
    let st = taoTran(5, [ghe('a'), ghe('b')]);
    st = doiTuThe(st, 'a', 'dung_ngoai', 2);
    st = doiTuThe(st, 'a', 'dau_hang', 5);
    const a = st.ghe.find((g) => g.id === 'a')!;
    expect(a.tu_the).toBe('dung_ngoai');
    expect(a.vong_roi, 'vong_roi cũng không được đổi theo').toBe(2);
  });
});

describe('ĐỨNG NGOÀI — phí lạm phát thực sự bị thu', () => {
  it('sau khi đổi tư thế, mỗi vòng CÓ bút toán phí đứng ngoài', () => {
    let st = taoTran(13, [ghe('a', ['btc']), ghe('b', ['vang']), ghe('c', ['usd'])]);
    st = doiTuThe(st, 'a', 'dung_ngoai', 1);
    const vonTruoc = st.ghe.find((g) => g.id === 'a')!.von;

    const r = giaiQuyetVong(st, THEO);
    const phi = r.ketQua.phi_dung_ngoai.find((x) => x.ghe_id === 'a');
    expect(phi, 'PHI_DUNG_NGOAI phải được thu — đây là khoản từng chưa bao giờ chạy')
      .toBeTruthy();
    expect(phi!.mat).toBeGreaterThan(0);
    expect(r.trangThai.ghe.find((g) => g.id === 'a')!.von).toBe(vonTruoc - phi!.mat);
  });

  it('phí đứng ngoài KHÔNG thu trùng với phí cắt lỗ (một hành vi, một khoản)', () => {
    let st = taoTran(13, [ghe('a', ['btc']), ghe('b', ['vang']), ghe('c', ['usd'])]);
    st = doiTuThe(st, 'a', 'dung_ngoai', 1);
    const r = giaiQuyetVong(st, THEO);
    expect(r.ketQua.phi_dung_ngoai.some((x) => x.ghe_id === 'a')).toBe(true);
    expect(r.ketQua.phi_cat_lo.some((x) => x.ghe_id === 'a')).toBe(false);
  });

  it('vốn đóng băng vẫn CHẢY MÁU nhiều vòng liền — không phải bến an toàn', () => {
    let st = taoTran(13, [ghe('a', ['btc']), ghe('b', ['vang']), ghe('c', ['usd'])]);
    st = doiTuThe(st, 'a', 'dung_ngoai', 1);
    const dau = st.ghe.find((g) => g.id === 'a')!.von;
    for (let i = 0; i < 3; i += 1) st = giaiQuyetVong(st, THEO).trangThai;
    expect(st.ghe.find((g) => g.id === 'a')!.von).toBeLessThan(dau);
  });

  it('phí nền phải KHÁC 0, nếu không cả cơ chế là trang trí', () => {
    expect(PHI_DUNG_NGOAI.NEN_BP).toBeGreaterThan(0);
  });
});

describe('ĐẦU HÀNG — xếp bét bảng, dưới cả người cháy', () => {
  it('người đầu hàng xếp SAU người cháy tài khoản', () => {
    let st = taoTran(17, [ghe('a'), ghe('b'), ghe('c')]);
    st = doiTuThe(st, 'a', 'dau_hang', 2);
    // 'b' cháy: vốn 0 + cờ cháy.
    st = {
      ...st,
      ghe: st.ghe.map((g) => (g.id === 'b'
        ? { ...g, von: 0, da_chay: true, vong_chay: 3 } : g)),
    };
    const hang = xepHang(st);
    expect(hang[hang.length - 1], 'đầu hàng phải bét bảng').toBe('a');
    expect(hang.indexOf('b')).toBeLessThan(hang.indexOf('a'));
  });

  it('đang DẪN ĐẦU mà đầu hàng vẫn bét — chặn lỗ hổng ăn non thứ hạng', () => {
    let st = taoTran(17, [ghe('a'), ghe('b')]);
    st = { ...st, ghe: st.ghe.map((g) => (g.id === 'a' ? { ...g, von: 99999 } : g)) };
    st = doiTuThe(st, 'a', 'dau_hang', 2);
    expect(xepHang(st)[0], 'người còn chơi phải trên người đã thoát').toBe('b');
  });

  it('nhiều người đầu hàng: ai bỏ SỚM hơn xếp dưới', () => {
    let st = taoTran(17, [ghe('a'), ghe('b'), ghe('c')]);
    st = doiTuThe(st, 'a', 'dau_hang', 2);   // bỏ sớm
    st = doiTuThe(st, 'b', 'dau_hang', 6);   // bỏ muộn
    const hang = xepHang(st);
    expect(hang.indexOf('b')).toBeLessThan(hang.indexOf('a'));
  });

  it('người đầu hàng KHÔNG bị thu tiếp phí nào — họ đã rời trận', () => {
    let st = taoTran(19, [ghe('a', ['btc']), ghe('b', ['vang']), ghe('c', ['usd'])]);
    st = doiTuThe(st, 'a', 'dau_hang', 1);
    const r = giaiQuyetVong(st, THEO);
    expect(r.ketQua.phi_dung_ngoai.some((x) => x.ghe_id === 'a')).toBe(false);
    expect(r.ketQua.phi_cat_lo.some((x) => x.ghe_id === 'a')).toBe(false);
  });
});

describe('BA CÁCH RA khác nhau thật, không phải ba nhãn của một thứ', () => {
  it('cắt lỗ → còn chơi; đứng ngoài → rời; đầu hàng → rời và bét bảng', () => {
    const mk = () => taoTran(23, [ghe('a', ['btc']), ghe('b', ['vang']), ghe('c', ['usd'])]);

    // 1. CẮT LỖ: bỏ vòng qua vòng cược, tư thế GIỮ NGUYÊN 'choi'.
    const catLo = giaiQuyetVong(mk(), (c) =>
      (c.ghe_id === 'a' ? { loai: 'bo' as const } : { loai: 'theo' as const }));
    expect(catLo.trangThai.ghe.find((g) => g.id === 'a')!.tu_the).toBe('choi');
    expect(catLo.ketQua.phi_cat_lo.some((x) => x.ghe_id === 'a')).toBe(true);

    // 2. ĐỨNG NGOÀI: tư thế đổi, bị thu phí đứng ngoài thay vì phí cắt lỗ.
    const dungNgoai = giaiQuyetVong(doiTuThe(mk(), 'a', 'dung_ngoai', 1), THEO);
    expect(dungNgoai.trangThai.ghe.find((g) => g.id === 'a')!.tu_the).toBe('dung_ngoai');
    expect(dungNgoai.ketQua.phi_dung_ngoai.some((x) => x.ghe_id === 'a')).toBe(true);

    // 3. ĐẦU HÀNG: tư thế đổi, và thứ hạng khác hẳn hai nhánh trên.
    const dauHang = doiTuThe(mk(), 'a', 'dau_hang', 1);
    expect(xepHang(dauHang)[xepHang(dauHang).length - 1]).toBe('a');
  });
});
