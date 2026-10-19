/**
 * D3 — STRATEGY ATTACHMENT: thẻ chiến thuật GẮN vào một mã cụ thể.
 *
 * Docstring của `XUNG_DOT` đã viết "hai thẻ… trên CÙNG TÀI SẢN" từ ngày đầu — thiết
 * kế luôn là attachment, chỉ là cài đặt cũ không có chỗ nào để biết thẻ nhắm vào
 * đâu, nên đành kiểm danh sách phẳng. Cụm này làm cho câu đó thành sự thật.
 *
 * BA BẤT BIẾN:
 *   1. TƯƠNG THÍCH NGƯỢC — trận cũ (`ghe_json` không có bảng `gan`) phải cho ra
 *      ĐÚNG kết quả nó từng có. `events` append-only, không backfill được.
 *   2. GẮN KHÁC MÃ CHỈ GIẢM, KHÔNG THOÁT — nếu gắn khác mã là hết xung đột thì
 *      tránh nó tốn một cú bấm, và cơ chế dạy-bằng-nỗi-đau của D24 mục 16.5 biến
 *      mất. Đây là bất biến dễ vỡ nhất khi ai đó "đơn giản hoá" sau này.
 *   3. THẺ TOÀN DANH MỤC KHÔNG GẮN ĐƯỢC — `da_dang_hoa` đếm số mã khác nhau,
 *      `di_nguoc` xét cả danh mục. Ép chúng vào một mã là làm chúng vô nghĩa.
 */
import { describe, expect, it } from 'vitest';
import { dungChuoi, taoTran, type GheMoi } from '../server/holdem/engine.js';
import {
  CHIEN_THUAT, KHAC_MA_BP, PHAT_XUNG_DOT_BP, XUNG_DOT, type ChienThuatId,
} from '../config/holdem.js';

function ghe(
  id: string, ts: string[], ct: ChienThuatId[],
  gan?: Partial<Record<ChienThuatId, string>>,
): GheMoi {
  return {
    id, loai: 'bot', bac_rank: 'Đồng',
    danh_muc: { tai_san: ts, chien_thuat: ct, ...(gan ? { gan } : {}) },
  };
}

/** Tổng delta của mắt xích `kind` qua nhiều seed/vòng. */
function tong(dung: () => GheMoi, kind: string): number {
  let n = 0;
  for (let seed = 1; seed < 30; seed += 1) {
    const st = taoTran(seed, [dung(), ghe('b', ['usd'], [])]);
    for (let v = 1; v <= st.map.o.length; v += 1) {
      const { chain } = dungChuoi({ ...st, vong: v }, st.ghe[0]!, st.map.o[v - 1]!);
      for (const m of chain) if (m.kind === kind) n += m.delta_bp;
    }
  }
  return n;
}

const CAP = XUNG_DOT[0]!; // một cặp xung đột có thật

describe('D3 attachment — xung đột', () => {
  it('CHƯA GẮN (trận cũ) → phạt ĐỦ, y như trước khi có attachment', () => {
    const co = tong(() => ghe('a', ['btc', 'vang'], [...CAP]), 'xung_dot');
    expect(co, 'không nổ lần nào — test rỗng').toBeLessThan(0);
    // Mỗi lần nổ đúng bằng mức đầy đủ.
    // `Math.abs`: `-750 % 250` ra `-0`, mà `toBe(0)` dùng Object.is nên -0 ≠ 0.
    expect(Math.abs(co % PHAT_XUNG_DOT_BP)).toBe(0);
  });

  it('GẮN CÙNG MÃ → phạt ĐỦ', () => {
    const khongGan = tong(() => ghe('a', ['btc', 'vang'], [...CAP]), 'xung_dot');
    const cungMa = tong(
      () => ghe('a', ['btc', 'vang'], [...CAP], { [CAP[0]]: 'btc', [CAP[1]]: 'btc' }),
      'xung_dot');
    expect(cungMa).toBe(khongGan);
  });

  it('GẮN KHÁC MÃ → phạt NHẸ HƠN nhưng KHÔNG BẰNG 0', () => {
    const cungMa = tong(
      () => ghe('a', ['btc', 'vang'], [...CAP], { [CAP[0]]: 'btc', [CAP[1]]: 'btc' }),
      'xung_dot');
    const khacMa = tong(
      () => ghe('a', ['btc', 'vang'], [...CAP], { [CAP[0]]: 'btc', [CAP[1]]: 'vang' }),
      'xung_dot');

    expect(khacMa, 'gắn khác mã phải nhẹ hơn').toBeGreaterThan(cungMa);
    expect(khacMa, 'nhưng KHÔNG được thoát hẳn — nếu 0 thì tránh xung đột chỉ tốn '
      + 'một cú bấm và cơ chế dạy-bằng-nỗi-đau D24 §16.5 biến mất').toBeLessThan(0);
  });

  it('hệ số khác-mã đúng như config, không phải số bịa trong engine', () => {
    const cungMa = tong(
      () => ghe('a', ['btc', 'vang'], [...CAP], { [CAP[0]]: 'btc', [CAP[1]]: 'btc' }),
      'xung_dot');
    const khacMa = tong(
      () => ghe('a', ['btc', 'vang'], [...CAP], { [CAP[0]]: 'btc', [CAP[1]]: 'vang' }),
      'xung_dot');
    // Sai số ±1 mỗi lần nổ do floor — cho phép biên rộng theo số lần nổ.
    const soLanNo = Math.round(cungMa / -PHAT_XUNG_DOT_BP);
    const kyVong = cungMa * (KHAC_MA_BP / 10000);
    expect(Math.abs(khacMa - kyVong)).toBeLessThanOrEqual(soLanNo);
  });
});

describe('D3 attachment — phạm vi thẻ', () => {
  it('mọi thẻ đều KHAI phạm vi, không thẻ nào bỏ trống', () => {
    for (const c of CHIEN_THUAT) {
      expect(['tai_san', 'danh_muc'], `thẻ "${c.id}" khai phạm vi lạ`).toContain(c.pham_vi);
    }
  });

  it('ĐÚNG hai thẻ toàn danh mục, và đúng hai thẻ đó', () => {
    /*
     * Khoá danh sách: thêm một thẻ 'danh_muc' mới mà quên nghĩ là UI sẽ hỏi "gắn
     * vào đâu" cho một thẻ không có chỗ nào để gắn — hoặc tệ hơn, một thẻ toàn
     * danh mục bị đánh nhầm 'tai_san' rồi chỉ tính trên một mã và yếu đi lặng lẽ.
     */
    const toanDanhMuc = CHIEN_THUAT.filter((c) => c.pham_vi === 'danh_muc').map((c) => c.id);
    expect(toanDanhMuc.sort()).toEqual(['da_dang_hoa', 'di_nguoc']);
  });

  it('thẻ toàn danh mục KHÔNG đổi hành vi theo bảng gắn', () => {
    // Gắn bậy `da_dang_hoa` vào một mã — kết quả phải y hệt khi không gắn.
    const khong = tong(() => ghe('a', ['btc', 'vang', 'usd'], ['da_dang_hoa']), 'da_dang');
    const gan = tong(
      () => ghe('a', ['btc', 'vang', 'usd'], ['da_dang_hoa'], { da_dang_hoa: 'btc' }),
      'da_dang');
    expect(gan).toBe(khong);
  });
});

describe('D3 attachment — thu phạm vi tác động của thẻ', () => {
  it('ĐÒN BẨY gắn mã nào → delta ĐÚNG BẰNG phần đóng góp của mã đó', () => {
    /*
     * Trước D3, `don_bay` nhân đôi TOÀN BỘ PnL — gồm cả trượt giá, xung đột, cộng
     * hưởng, phản ứng tin. Gắn vào một mã thì nó chỉ được nhân phần mã đó đóng góp.
     *
     * ⚠ BẤT BIẾN ĐÚNG LÀ "BẰNG", KHÔNG PHẢI "NHỎ HƠN". Bản đầu của test này khẳng
     * định gắn-một-mã phải cho delta nhỏ hơn nhân-cả-vòng, và ĐỎ: 55.057 vs 36.818.
     * Vì nhân cả vòng là nhân cả phần ÂM (trượt giá, xung đột) nên delta của nó có
     * thể nhỏ hơn phần dương của riêng một mã. "Thu phạm vi" không đồng nghĩa với
     * "yếu đi" — nó có thể mạnh hơn khi mã được gắn đang gánh phần lãi.
     */
    const MAT_XICH_THEO_MA = ['tai_san', 'echo', 'crowding', 'hoan_truot'];
    let daKiem = 0;
    for (let seed = 1; seed < 30; seed += 1) {
      const st = taoTran(seed, [
        ghe('a', ['btc', 'vang'], ['don_bay'], { don_bay: 'btc' }),
        ghe('b', ['usd'], []),
      ]);
      for (let v = 1; v <= st.map.o.length; v += 1) {
        const { chain } = dungChuoi({ ...st, vong: v }, st.ghe[0]!, st.map.o[v - 1]!);
        const nhan = chain.find((m) => m.kind === 'nhan');
        if (!nhan) continue;
        const cuaBtc = chain.reduce((t, m) => (
          MAT_XICH_THEO_MA.includes(m.kind) && 'id' in m && m.id === 'btc'
            ? t + m.delta_bp : t), 0);
        daKiem += 1;
        expect(nhan.delta_bp, `seed ${seed} vòng ${v}`).toBe(cuaBtc);
      }
    }
    expect(daKiem, 'không quét được lần nhân nào — test rỗng').toBeGreaterThan(0);
  });

  it('CHIA LỆNH gắn mã nào chỉ che mã đó — mã khác vẫn chịu đủ trượt giá', () => {
    // Bàn 3 người cùng ôm btc và vang → cả hai mã đều bị phạt đám đông.
    const dungBan = (gan?: Partial<Record<ChienThuatId, string>>) => taoTran(5, [
      ghe('a', ['btc', 'vang'], ['chia_lenh'], gan),
      ghe('b', ['btc', 'vang'], []),
      ghe('c', ['btc', 'vang'], []),
    ]);
    const phat = (gan?: Partial<Record<ChienThuatId, string>>) => {
      let n = 0;
      const st = dungBan(gan);
      for (let v = 1; v <= st.map.o.length; v += 1) {
        const { chain } = dungChuoi({ ...st, vong: v }, st.ghe[0]!, st.map.o[v - 1]!);
        for (const m of chain) if (m.kind === 'crowding') n += m.delta_bp;
      }
      return n;
    };
    const cheCaHai = phat();                       // chưa gắn ⇒ che mọi mã (như cũ)
    const cheMotMa = phat({ chia_lenh: 'btc' });    // gắn btc ⇒ vang chịu đủ

    expect(cheCaHai, 'không có phạt đám đông nào — test rỗng').toBeLessThan(0);
    expect(cheMotMa, 'gắn một mã thì tổng phạt phải NẶNG hơn (mã kia hết được che)')
      .toBeLessThan(cheCaHai);
  });
});
