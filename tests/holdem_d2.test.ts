/**
 * D2 — CẮT LỖ VỀ CASH CÓ GIÁ.
 *
 * Vấn đề D2 sửa: trước cụm này, bỏ vòng là MIỄN PHÍ. Mất phần quỹ vòng, mà chưa
 * đặt gì thì cũng chẳng mất. Nên hễ ô sắp lật trông xấu là bỏ luôn — rủi ro 0,
 * chi phí 0. Một nước đi trội gần như tuyệt đối, và người chơi không phải CÂN gì.
 *
 * Gate của cụm đòi HAI PHÍA, và cả hai phía đều là lỗi thật:
 *   · nhẹ quá → cắt lỗ vẫn là meta thống trị (bệnh cũ);
 *   · nặng quá → cắt lỗ thành BẪY, và trò dạy sai bài học: ngoài đời cắt lỗ đúng
 *     lúc là kỷ luật, không phải thất bại. D22 đã chốt là không được dạy sai.
 * Nên ở đây khoá cả "phải mất tiền" lẫn "không được mất quá nhiều".
 */
import { describe, expect, it } from 'vitest';
import { giaiQuyetVong, taoTran, type GheMoi } from '../server/holdem/engine.js';
import { CAT_LO_VE_CASH, HOLDEM_MATCH, soLanCatLo } from '../config/holdem.js';

function ghe(id: string, taiSan: string[] = []): GheMoi {
  return { id, loai: 'bot', bac_rank: 'Đồng', danh_muc: { tai_san: taiSan, chien_thuat: [] } };
}

/** Mọi ghế trong `boId` bỏ, còn lại theo. */
const qd = (boId: string[]) => (c: { ghe_id: string }) =>
  (boId.includes(c.ghe_id) ? { loai: 'bo' as const } : { loai: 'theo' as const });

describe('D2 — phí cắt lỗ về Cash', () => {
  it('cắt lỗ MẤT TIỀN — không còn là nước đi miễn phí', () => {
    const st = taoTran(7, [ghe('a', ['btc']), ghe('b', ['vang']), ghe('c', ['usd'])]);
    const r = giaiQuyetVong(st, qd(['a']));
    const phi = r.ketQua.phi_cat_lo.find((x) => x.ghe_id === 'a');
    expect(phi, 'phải có bút toán phí cắt lỗ').toBeTruthy();
    expect(phi!.mat).toBeGreaterThan(0);
  });

  it('phí NHẸ HƠN một cú lỗ danh mục — cắt lỗ là kỷ luật, không phải bẫy', () => {
    /*
     * Chốt trần trên: tổng phí cắt lỗ phải nhỏ hơn 10% vốn. Nếu vượt, cắt lỗ đắt
     * hơn phần lớn cú lỗ mà nó dùng để tránh, và người chơi học được rằng thoát
     * lỗ là sai — đúng thứ D22 cấm (không dạy sai bài học tài chính).
     */
    const tong = CAT_LO_VE_CASH.PHI_LAM_PHAT_BP + CAT_LO_VE_CASH.PHI_RUT_KHAN_BP;
    expect(tong).toBeLessThan(1000);
    // Cả khi giẫm đạp nhân đôi thì cũng không được thành án tử.
    expect((tong * CAT_LO_VE_CASH.GIAM_DAP_BP) / 10000).toBeLessThan(2000);
  });

  it('GIẪM ĐẠP — từ 30% lobby cùng bỏ thì phí nhân đôi', () => {
    // 3/4 ghế cùng bỏ = 75% lobby, quá ngưỡng.
    const st = taoTran(11, [
      ghe('a', ['btc']), ghe('b', ['btc']), ghe('c', ['btc']), ghe('d', ['vang'])]);
    const r = giaiQuyetVong(st, qd(['a', 'b', 'c']));
    const phi = r.ketQua.phi_cat_lo;
    expect(phi.length).toBe(3);
    expect(phi.every((x) => x.giam_dap), 'cả ba phải bị tính giẫm đạp').toBe(true);
    expect(r.ketQua.ty_le_cat_lo_bp).toBeGreaterThanOrEqual(CAT_LO_VE_CASH.NGUONG_GIAM_DAP_BP);
  });

  it('MỘT người bỏ thì KHÔNG giẫm đạp — không ai tự giẫm đạp mình', () => {
    // Bàn 2 ghế, một người bỏ = 50% lobby → quá NGƯỠNG tỷ lệ, nhưng chỉ 1 người.
    const st = taoTran(11, [ghe('a', ['btc']), ghe('b', ['vang'])]);
    const r = giaiQuyetVong(st, qd(['a']));
    expect(r.ketQua.ty_le_cat_lo_bp).toBeGreaterThanOrEqual(CAT_LO_VE_CASH.NGUONG_GIAM_DAP_BP);
    expect(r.ketQua.phi_cat_lo[0]!.giam_dap, 'một người không thành đám đông').toBe(false);
  });

  it('giẫm đạp đo bằng TỶ LỆ → cùng hành vi thì cùng phán quyết ở mọi cỡ bàn', () => {
    // 1/4 = 25% (dưới ngưỡng) so với 2/8 = 25% (cũng dưới) — phải giống nhau.
    const ban4 = taoTran(3, ['a', 'b', 'c', 'd'].map((x) => ghe(x, ['vang'])));
    const ban8 = taoTran(3, ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h'].map((x) => ghe(x, ['vang'])));
    const r4 = giaiQuyetVong(ban4, qd(['a']));
    const r8 = giaiQuyetVong(ban8, qd(['a', 'b']));
    expect(r4.ketQua.ty_le_cat_lo_bp).toBe(r8.ketQua.ty_le_cat_lo_bp);
    expect(r4.ketQua.phi_cat_lo[0]!.giam_dap).toBe(r8.ketQua.phi_cat_lo[0]!.giam_dap);
  });

  it('HẾT LƯỢT CẮT LỖ thì phải chiến đấu, không bỏ được nữa', () => {
    let st = taoTran(5, [ghe('a', ['btc']), ghe('b', ['vang']), ghe('c', ['usd'])]);
    const quota = soLanCatLo(st.map.o.length);
    expect(quota).toBeGreaterThan(0);

    for (let i = 0; i < quota; i += 1) {
      const r = giaiQuyetVong(st, qd(['a']));
      st = r.trangThai;
      expect(r.ketQua.phi_cat_lo.some((x) => x.ghe_id === 'a')).toBe(true);
    }
    expect(st.ghe.find((g) => g.id === 'a')!.so_lan_cat_lo).toBe(quota);

    // Vòng kế: vẫn CHỌN bỏ, nhưng engine không cho — bị hạ về "theo".
    const sau = giaiQuyetVong(st, qd(['a']));
    expect(sau.ketQua.phi_cat_lo.some((x) => x.ghe_id === 'a'),
      'hết lượt thì không được cắt lỗ nữa').toBe(false);
    expect(sau.ketQua.ket_qua.find((k) => k.ghe_id === 'a')?.da_cat_lo).toBe(false);
  });

  it('nước bỏ bị GỠ khỏi danh sách được-làm khi hết quota (bot và UI cùng thấy)', () => {
    let st = taoTran(5, [ghe('a', ['btc']), ghe('b', ['vang']), ghe('c', ['usd'])]);
    const quota = soLanCatLo(st.map.o.length);
    for (let i = 0; i < quota; i += 1) st = giaiQuyetVong(st, qd(['a'])).trangThai;

    // Ghi lại danh sách `duoc` mà engine đưa cho ghế 'a' ở vòng kế.
    const thay: string[][] = [];
    giaiQuyetVong(st, (c) => {
      if (c.ghe_id === 'a') thay.push([...c.duoc]);
      return { loai: 'theo' as const };
    });
    expect(thay.length).toBeGreaterThan(0);
    // Danh sách này CHÍNH LÀ thứ API gửi ra cho UI vẽ nút — nên UI không thể
    // vẽ nút Cắt lỗ rồi mới báo lỗi lúc bấm.
    expect(thay.every((d) => !d.includes('bo'))).toBe(true);
  });

  it('người ĐỨNG NGOÀI không bị thu phí cắt lỗ (không thu hai lần một hành vi)', () => {
    let st = taoTran(9, [ghe('a', ['btc']), ghe('b', ['vang']), ghe('c', ['usd'])]);
    st = {
      ...st,
      ghe: st.ghe.map((g) => (g.id === 'a'
        ? { ...g, tu_the: 'dung_ngoai' as const, vong_roi: 1 } : g)),
    };
    const r = giaiQuyetVong(st, qd(['a']));
    expect(r.ketQua.phi_cat_lo.some((x) => x.ghe_id === 'a')).toBe(false);
    // Nhưng vẫn phải chịu phí ĐỨNG NGOÀI — đóng băng vốn không phải là an toàn.
    expect(r.ketQua.phi_dung_ngoai.some((x) => x.ghe_id === 'a')).toBe(true);
  });

  it('phí không bao giờ đẩy Vốn xuống dưới 0', () => {
    let st = taoTran(21, [ghe('a', ['btc']), ghe('b', ['vang']), ghe('c', ['usd'])]);
    st = { ...st, ghe: st.ghe.map((g) => (g.id === 'a' ? { ...g, von: 3 } : g)) };
    const r = giaiQuyetVong(st, qd(['a']));
    expect(r.trangThai.ghe.find((g) => g.id === 'a')!.von).toBeGreaterThanOrEqual(0);
  });

  it('map dài hơn thì được nhiều lượt cắt lỗ hơn', () => {
    // "Một lần" ở map 8 và map 16 là hai độ chặt hoàn toàn khác nhau.
    expect(soLanCatLo(16)).toBeGreaterThan(soLanCatLo(8));
    expect(soLanCatLo(8)).toBe(CAT_LO_VE_CASH.SO_LAN_THEO_MAP[8]);
    // Cỡ lạ vẫn có số, không undefined.
    expect(soLanCatLo(999)).toBe(CAT_LO_VE_CASH.SO_LAN_MAC_DINH);
  });

  it('tất định: cùng seed + cùng quyết định thì cùng phí, tới từng đồng', () => {
    const mk = () => giaiQuyetVong(
      taoTran(77, [ghe('a', ['btc']), ghe('b', ['btc']), ghe('c', ['vang'])]), qd(['a', 'b']));
    expect(JSON.stringify(mk().ketQua.phi_cat_lo)).toBe(JSON.stringify(mk().ketQua.phi_cat_lo));
  });

  it('vòng sau người cắt lỗ QUAY LẠI chơi (cash về, không bị loại)', () => {
    const st = taoTran(31, [ghe('a', ['btc']), ghe('b', ['vang']), ghe('c', ['usd'])]);
    const r = giaiQuyetVong(st, qd(['a']));
    const a = r.trangThai.ghe.find((g) => g.id === 'a')!;
    // Cắt lỗ là nước đi MỘT VÒNG, không phải rời trận — khác hẳn Đứng ngoài.
    expect(a.tu_the).toBe('choi');
    expect(a.da_chay).toBe(false);
    expect(a.von).toBeGreaterThan(0);
    expect(HOLDEM_MATCH.START_VON).toBeGreaterThan(a.von);
  });
});
