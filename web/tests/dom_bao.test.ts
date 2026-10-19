/**
 * ĐỐM BÁO — bài canh cho LUẬT CỨNG của cơ chế (`lib/dom_bao.ts`).
 *
 * ⚠⚠ Bài quan trọng nhất là §III: **đốm phải TẮT ĐƯỢC BẰNG CÁCH NHÌN**. Founder đặt đúng bài
 * toán khi giao việc: *"1 màn hình toàn đốm vàng tĩnh thì chẳng còn cái nào đặc biệt"*, và thứ
 * đẻ ra màn ấy luôn là một đốm gắn vào ĐIỀU KIỆN thay vì SỰ KIỆN. Không có bài canh thì cái
 * sai ấy vào repo mà không gì đỏ — nó "chạy đúng", chỉ là không bao giờ tắt.
 */
import { beforeEach, describe, expect, it } from 'vitest';
import {
  DOM_TOI_DA, MA_DOM, batDom, batTheoNgay, coDom, domDangHien, tatDom, tatTheoNgay,
} from '../src/lib/dom_bao';

beforeEach(() => { localStorage.clear(); });

describe('§I — bật / tắt', () => {
  it('chưa bật thì không có đốm nào', () => {
    expect(domDangHien()).toEqual([]);
    expect(coDom('hu_dau_tien')).toBe(false);
  });

  it('bật ⇒ có; tắt ⇒ hết', () => {
    batDom('hu_dau_tien', 1_000);
    expect(coDom('hu_dau_tien')).toBe(true);
    tatDom('hu_dau_tien');
    expect(coDom('hu_dau_tien')).toBe(false);
  });

  it('⭐ bật lại một đốm ĐANG SÁNG không làm nó trẻ ra', () => {
    /*
     * ⚠ Nếu mốc bị ghi đè, một nguồn ồn ào (vd token về liên tục) luôn trẻ nhất và đẩy mọi
     * đốm khác ra khỏi trần — một nguồn nuốt hết chỗ của các nguồn quan trọng hơn.
     */
    batDom('hu_dau_tien', 1_000);
    batDom('the_vua_no', 2_000);
    batDom('hu_dau_tien', 9_000);   // bật lại: KHÔNG được nhảy lên đầu
    expect(domDangHien()).toEqual(['the_vua_no', 'hu_dau_tien']);
  });
});

describe('§II — TRẦN: mới nhất thắng', () => {
  it(`⭐ quá ${DOM_TOI_DA} đốm thì bỏ đốm CŨ NHẤT`, () => {
    const ds = [...MA_DOM];
    expect(ds.length, 'bài này chỉ có nghĩa khi có nhiều mã hơn trần').toBeGreaterThan(DOM_TOI_DA);
    ds.forEach((m, i) => batDom(m, 1_000 + i));

    const hien = domDangHien();
    expect(hien).toHaveLength(DOM_TOI_DA);
    // Mới nhất trước, và đúng `DOM_TOI_DA` mã cuối của dãy vừa bật.
    expect(hien).toEqual([...ds].slice(-DOM_TOI_DA).reverse());
    expect(coDom(ds[0]!), 'đốm cũ nhất phải bị đẩy ra').toBe(false);
  });

  it('⭐ mọi chỗ vẽ phải đi qua `domDangHien` — `coDom` cũng chịu trần', () => {
    /* Nếu `coDom` đọc thẳng kho thì một màn tự miễn trừ khỏi trần, im lặng. */
    [...MA_DOM].forEach((m, i) => batDom(m, 1_000 + i));
    const soSang = MA_DOM.filter((m) => coDom(m)).length;
    expect(soSang).toBe(DOM_TOI_DA);
  });
});

describe('§III — ⭐⭐⭐ LUẬT CỨNG: đốm là SỰ KIỆN, tắt được bằng cách nhìn', () => {
  it('⭐⭐⭐ tắt rồi thì KHÔNG tự sáng lại — kể cả khi điều kiện gốc vẫn đúng', () => {
    /*
     * Dựng đúng cái bẫy: "người này vẫn chưa làm việc X" là một điều kiện đúng mãi. Nếu chỗ
     * gọi bật đốm theo điều kiện ấy thì tắt xong nó sáng lại ngay. Cơ chế phải làm việc bật
     * là một HÀNH ĐỘNG RỜI (`batDom` tại đúng lúc sự kiện xảy ra), nên sau khi tắt, KHÔNG có
     * đường nào để nó tự sáng lại mà không có một cú `batDom` mới.
     */
    batDom('hu_dau_tien', 1_000);
    tatDom('hu_dau_tien');
    expect(coDom('hu_dau_tien')).toBe(false);
    expect(domDangHien()).toEqual([]);
  });

  it('⭐⭐ đốm THEO NGÀY: cùng ngày thì tắt là tắt, sang ngày mới mới sáng lại', () => {
    batTheoNgay('2026-09-21', 1_000);
    expect(coDom('diem_danh_moi')).toBe(true);

    tatTheoNgay('2026-09-21');
    expect(coDom('diem_danh_moi')).toBe(false);

    /* ⚠ Vế quan trọng: gọi lại TRONG CÙNG NGÀY không được sáng lại. Thiếu chốt này thì đốm
       điểm danh bật lại ngay sau khi người dùng vừa nhìn — đúng "đốm tĩnh" founder bảo tránh. */
    batTheoNgay('2026-09-21', 2_000);
    expect(coDom('diem_danh_moi'), 'cùng ngày mà sáng lại ⇒ đốm không bao giờ tắt').toBe(false);

    batTheoNgay('2026-09-22', 3_000);
    expect(coDom('diem_danh_moi'), 'sang ngày mới thì phải sáng lại').toBe(true);
  });
});

describe('§IV — hỏng thì IM, không đoán', () => {
  it('kho rác ⇒ không đốm nào (thiếu đốm chỉ là lỡ lời mời; hiện nhầm là nói dối)', () => {
    localStorage.setItem('dom_bao_v1', '{{{ không phải json');
    expect(domDangHien()).toEqual([]);
  });

  it('mã lạ trong kho bị bỏ qua, không lọt ra ngoài', () => {
    localStorage.setItem('dom_bao_v1', JSON.stringify({ ma_khong_ton_tai: 5, hu_dau_tien: 9 }));
    expect(domDangHien()).toEqual(['hu_dau_tien']);
  });
});
