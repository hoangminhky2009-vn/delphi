/**
 * MARKET HOLD'EM — engine lát 1.
 *
 * Ba nhóm bất biến, theo đúng thứ tự quan trọng:
 *   1. TẤT ĐỊNH — mất cái này là mất replay, mất chống gian lận, mất Monte Carlo.
 *   2. CẤU TRÚC DÂY CHUYỀN — `chain` phải đúng thứ tự chips→mult, vì nó vừa là
 *      bảng "vì sao" (feedback-clarity) vừa là kịch bản hoạt hình.
 *   3. LUẬT THIẾT KẾ — van casual, tin giả đảo echo, crowding phạt lá mỏng nặng hơn.
 */
import { describe, expect, it } from 'vitest';
import {
  daKetThuc, dungChuoi, giaiQuyetVong, taoTran, xepHang,
  type Ghe, type TrangThaiTran, type GheMoi,
} from '../server/holdem/engine.js';
import { sinhMap, thanhPhanCongKhai, oCongKhai } from '../server/holdem/map.js';
import {
  CAT_LO_VE_CASH, HOLDEM_DECISIONS, HOLDEM_MATCH, NHA_CAI,
} from '../config/holdem.js';

function ghe(id: string, taiSan: string[], chienThuat: string[] = []): GheMoi {
  return {
    id, loai: 'bot', bac_rank: 'Đồng',
    danh_muc: { tai_san: taiSan, chien_thuat: chienThuat as never },
  };
}

/** Chính sách "ai cũng theo giá nền, không ai tố" — dùng cho phần lớn test. */
const THEO_HET = () => ({ loai: 'theo' as const });

describe('1. TẤT ĐỊNH — nền móng của replay và Monte Carlo', () => {
  it('cùng seed → map giống hệt từng ô, kể cả cờ tin giả', () => {
    const a = sinhMap(12345, 8);
    const b = sinhMap(12345, 8);
    expect(a.o).toEqual(b.o);
  });

  it('seed khác → map khác (không phải hằng số trá hình)', () => {
    const a = sinhMap(1, 8);
    const b = sinhMap(2, 8);
    expect(a.o).not.toEqual(b.o);
  });

  it('cùng seed + cùng hành động → PnL giống hệt từng bp', () => {
    const mk = () => taoTran(777, [ghe('a', ['btc']), ghe('b', ['vang'])]);
    const r1 = giaiQuyetVong(mk(), THEO_HET);
    const r2 = giaiQuyetVong(mk(), THEO_HET);
    expect(r1.ketQua.ket_qua).toEqual(r2.ketQua.ket_qua);
  });

  it('THÊM ghế không làm xê dịch nhiễu của ghế cũ (dòng địa chỉ hoá)', () => {
    // Đây là lớp phòng thủ chính chống bug replay: với dòng tuần tự, thêm một
    // người vào bàn sẽ đẩy lệch toàn bộ nhiễu phía sau.
    const it2 = taoTran(999, [ghe('a', ['btc'])]);
    const it3 = taoTran(999, [ghe('a', ['btc']), ghe('z', ['usd'])]);
    const c2 = dungChuoi(it2, it2.ghe[0]!, it2.map.o[0]!);
    const c3 = dungChuoi(it3, it3.ghe[0]!, it3.map.o[0]!);
    const taiSan2 = c2.chain.filter((m) => m.kind === 'tai_san');
    const taiSan3 = c3.chain.filter((m) => m.kind === 'tai_san');
    expect(taiSan3).toEqual(taiSan2);
  });

  it('mọi delta là SỐ NGUYÊN (C5 — cấm float trong tính toán)', () => {
    const st = taoTran(4242, [ghe('a', ['btc', 'vang'], ['don_bay'])]);
    const { chain, pnl_bp } = dungChuoi(st, st.ghe[0]!, st.map.o[0]!);
    expect(Number.isInteger(pnl_bp)).toBe(true);
    for (const m of chain) expect(Number.isInteger(m.delta_bp), JSON.stringify(m)).toBe(true);
  });
});

describe('2. DÂY CHUYỀN — chips × mult, đúng thứ tự diễn', () => {
  it('mắt xích NHÂN luôn đứng CUỐI (đỉnh của dây chuyền)', () => {
    const st = taoTran(31337, [ghe('a', ['btc', 'cp_cn'], ['don_bay'])]);
    const { chain } = dungChuoi(st, st.ghe[0]!, st.map.o[0]!);
    const iNhan = chain.findIndex((m) => m.kind === 'nhan');
    expect(iNhan, 'phải có mắt xích nhân').toBeGreaterThanOrEqual(0);
    expect(iNhan).toBe(chain.length - 1);
  });

  it('tài sản đứng TRƯỚC crowding (cộng dồn trước, bào sau)', () => {
    const st = taoTran(555, [
      ghe('a', ['btc']), ghe('b', ['btc']), ghe('c', ['btc']),
    ]);
    const { chain } = dungChuoi(st, st.ghe[0]!, st.map.o[0]!);
    const iTS = chain.findIndex((m) => m.kind === 'tai_san');
    const iCrowd = chain.findIndex((m) => m.kind === 'crowding');
    expect(iCrowd, 'phải có crowding khi 3 người cùng nắm').toBeGreaterThan(-1);
    expect(iTS).toBeLessThan(iCrowd);
  });

  it('Đòn Bẩy nhân ĐÔI kết quả cộng dồn — cả lãi lẫn lỗ', () => {
    const khong = taoTran(8080, [ghe('a', ['btc'])]);
    const co = taoTran(8080, [ghe('a', ['btc'], ['don_bay'])]);
    const p1 = dungChuoi(khong, khong.ghe[0]!, khong.map.o[0]!).pnl_bp;
    const p2 = dungChuoi(co, co.ghe[0]!, co.map.o[0]!).pnl_bp;
    expect(p2).toBe(p1 * 2);
  });

  it('tổng các mắt xích cộng dồn khớp PnL khi KHÔNG có thẻ nhân', () => {
    const st = taoTran(246, [ghe('a', ['btc', 'vang', 'usd'])]);
    const { chain, pnl_bp } = dungChuoi(st, st.ghe[0]!, st.map.o[0]!);
    const tong = chain.reduce((s, m) => s + m.delta_bp, 0);
    expect(tong).toBe(pnl_bp);
  });

  it('chain KHÔNG rỗng — người chơi luôn có cái để đọc "vì sao"', () => {
    const st = taoTran(13, [ghe('a', ['vn30'])]);
    expect(dungChuoi(st, st.ghe[0]!, st.map.o[0]!).chain.length).toBeGreaterThan(0);
  });
});

describe('3. CROWDING — thanh khoản quyết định mức phạt', () => {
  it('lá MỎNG (BTC) bị phạt nặng hơn lá DÀY (VN30) khi cùng số người dồn', () => {
    const mong = taoTran(1, [ghe('a', ['btc']), ghe('b', ['btc']), ghe('c', ['btc'])]);
    const day = taoTran(1, [ghe('a', ['vn30']), ghe('b', ['vn30']), ghe('c', ['vn30'])]);
    const pMong = mong.map.o[0]! && dungChuoi(mong, mong.ghe[0]!, mong.map.o[0]!)
      .chain.find((m) => m.kind === 'crowding')!.delta_bp;
    const pDay = dungChuoi(day, day.ghe[0]!, day.map.o[0]!)
      .chain.find((m) => m.kind === 'crowding')!.delta_bp;
    expect(Math.abs(pMong)).toBeGreaterThan(Math.abs(pDay));
  });

  it('một mình nắm → KHÔNG bị trượt giá', () => {
    const st = taoTran(2, [ghe('a', ['btc']), ghe('b', ['vang'])]);
    const chain = dungChuoi(st, st.ghe[0]!, st.map.o[0]!).chain;
    expect(chain.some((m) => m.kind === 'crowding')).toBe(false);
  });

  it('Khớp Nhanh giảm được trượt giá RÒNG (khắc chế herding)', () => {
    // T4 (20/07): Khớp Nhanh KHÔNG còn giảm thẳng mắt xích crowding nữa — nó
    // hoàn lại một phần khoản phạt ĐÃ chịu, thành mắt xích `hoan_truot` riêng.
    // Nên phải đo TỔNG hai mắt xích, không đo mỗi crowding.
    const thuong = taoTran(3, [ghe('a', ['btc']), ghe('b', ['btc']), ghe('c', ['btc'])]);
    const nhanh = taoTran(3, [ghe('a', ['btc'], ['khop_nhanh']), ghe('b', ['btc']), ghe('c', ['btc'])]);
    const rong = (st: TrangThaiTran) => dungChuoi(st, st.ghe[0]!, st.map.o[0]!)
      .chain.filter((m) => m.kind === 'crowding' || m.kind === 'hoan_truot')
      .reduce((x, m) => x + m.delta_bp, 0);
    expect(Math.abs(rong(nhanh))).toBeLessThan(Math.abs(rong(thuong)));
  });

  it('T4 — hoàn CÀNG NHIỀU khi CÀNG ĐÔNG người dồn', () => {
    // Mô tả thẻ hứa "vô dụng khi vắng người". Trước đây engine áp giảm phạt
    // PHẲNG bất kể 2 hay 5 người — lời hứa suông. Nay phải đúng lời.
    /*
     * ⚠ BÀN LUÔN 5 GHẾ, chỉ đổi BAO NHIÊU NGƯỜI TRONG BÀN dồn vào btc.
     *
     * Bản đầu (trước D3) dựng bàn n ghế và cho CẢ n người nắm btc, nên nó không
     * hề đo "càng đông càng hoàn" — nó đo CỠ BÀN, còn mức dồn thì luôn 100%.
     * Hai biến bị lẫn vào nhau, và chỉ lộ ra khi D3 đổi đơn vị đo sang tỷ lệ
     * lobby: 2/2 ghế là bàn dồn HẾT, hoàn max mới đúng. Cùng lớp lỗi đo đã làm
     * tôi chẩn đoán sai ba lần khi cân bằng D1 — giữ nguyên ghi chú này.
     */
    const dung = (nNam: number) => {
      const ghes = Array.from({ length: 5 }, (_, i) => (i === 0
        ? ghe('a', ['btc'], ['khop_nhanh'])
        : ghe(`b${i}`, i < nNam ? ['btc'] : ['vang'])));
      const st = taoTran(3, ghes);
      return dungChuoi(st, st.ghe[0]!, st.map.o[0]!)
        .chain.find((m) => m.kind === 'hoan_truot')?.delta_bp ?? 0;
    };
    expect(dung(2), '2/5 bàn thì KHÔNG hoàn — đông mới có gì để vượt').toBe(0);
    expect(dung(5)).toBeGreaterThan(dung(3));
  });

  it('T4 — hoàn KHÔNG BAO GIỜ vượt phạt (thanh khoản giữ nguyên răng)', () => {
    for (const ts of ['btc', 'cp_cn', 'vn30', 'vang', 'usd', 'tpcp']) {
      for (const n of [2, 3, 4, 5]) {
        const ghes = Array.from({ length: n }, (_, i) => (i === 0
          ? ghe('a', [ts], ['khop_nhanh']) : ghe(`b${i}`, [ts])));
        const st = taoTran(11, ghes);
        const c = dungChuoi(st, st.ghe[0]!, st.map.o[0]!).chain;
        const phat = Math.abs(c.find((m) => m.kind === 'crowding')?.delta_bp ?? 0);
        const hoan = c.find((m) => m.kind === 'hoan_truot')?.delta_bp ?? 0;
        expect(hoan, `${ts} ${n} người: hoàn ${hoan} > phạt ${phat}`)
          .toBeLessThanOrEqual(phat);
      }
    }
  });
});

describe('4. NHÀ CÁI — telegraph, tin giả, trí nhớ giá', () => {
  it('không có Sự kiện ở vòng đầu (người chơi chưa cam kết gì)', () => {
    for (let seed = 0; seed < 60; seed += 1) {
      const m = sinhMap(seed, 8);
      for (let i = 0; i + 1 < NHA_CAI.KHONG_SU_KIEN_TRUOC_VONG; i += 1) {
        expect(m.o[i]!.kind, `seed ${seed} ô ${i}`).toBe('giai_doan');
      }
    }
  });

  it('không có hai ô Sự kiện liền nhau — telegraph phải có chỗ ứng nghiệm', () => {
    for (let seed = 0; seed < 60; seed += 1) {
      const m = sinhMap(seed, 8);
      for (let i = 1; i < m.o.length; i += 1) {
        if (m.o[i]!.kind === 'su_kien') expect(m.o[i - 1]!.kind).toBe('giai_doan');
      }
    }
  });

  it('TELEGRAPH có tác dụng: tin THẬT kéo ô kế về giai đoạn được báo', () => {
    let khop = 0, tong = 0;
    for (let seed = 0; seed < 400; seed += 1) {
      const m = sinhMap(seed, 8);
      for (let i = 0; i + 1 < m.o.length; i += 1) {
        const o = m.o[i]!;
        if (o.kind !== 'su_kien' || o.la_tin_gia) continue;
        const ke = m.o[i + 1]!;
        if (ke.kind !== 'giai_doan') continue;
        tong += 1;
        if (ke.giai_doan === o.bao_truoc) khop += 1;
      }
    }
    expect(tong, 'phải có mẫu để đo').toBeGreaterThan(50);
    // Không telegraph thì mỗi giai đoạn ~1/5. Có telegraph phải trội rõ.
    expect(khop / tong).toBeGreaterThan(0.45);
  });

  it('TIN GIẢ đảo dấu echo — kẻ vào lệnh theo tin đồn bị whipsaw', () => {
    // Dựng thủ công hai map: cùng sự kiện, khác cờ thật/giả.
    const mkSt = (laGia: boolean): TrangThaiTran => ({
      seed: 5, vong: 2,
      map: { seed: 5, o: [
        { kind: 'su_kien', su_kien: 'hack_san', la_tin_gia: laGia, boi_canh: 'don_doc' as const, bao_truoc: 'giam' },
        { kind: 'giai_doan', giai_doan: 'di_ngang' },
      ] },
      ghe: [{ ...ghe('a', ['vang']), von: 1000, luot_khao_sat: 2, da_chay: false, vong_chay: null, tu_the: 'choi' as const, vong_roi: null, so_lan_cat_lo: 0, vi_the: {} }],
    });
    const that = mkSt(false);
    const gia = mkSt(true);
    const eThat = dungChuoi(that, that.ghe[0]!, that.map.o[1]!).chain.find((m) => m.kind === 'echo')!;
    const eGia = dungChuoi(gia, gia.ghe[0]!, gia.map.o[1]!).chain.find((m) => m.kind === 'echo')!;
    // Hack sàn đẩy Vàng LÊN (trú ẩn). Tin giả → đảo lại thành xuống.
    expect(eThat.delta_bp).toBeGreaterThan(0);
    expect(eGia.delta_bp).toBe(-eThat.delta_bp);
  });

  it('echo SUY GIẢM theo thời gian, không phải blip một vòng', () => {
    const mk = (vong: number): TrangThaiTran => ({
      seed: 6, vong,
      map: { seed: 6, o: [
        { kind: 'su_kien', su_kien: 'hack_san', la_tin_gia: false, boi_canh: 'don_doc' as const, bao_truoc: 'giam' },
        { kind: 'giai_doan', giai_doan: 'di_ngang' },
        { kind: 'giai_doan', giai_doan: 'di_ngang' },
      ] },
      ghe: [{ ...ghe('a', ['vang']), von: 1000, luot_khao_sat: 2, da_chay: false, vong_chay: null, tu_the: 'choi' as const, vong_roi: null, so_lan_cat_lo: 0, vi_the: {} }],
    });
    const v2 = mk(2); const v3 = mk(3);
    const e2 = dungChuoi(v2, v2.ghe[0]!, v2.map.o[1]!).chain.find((m) => m.kind === 'echo')!;
    const e3 = dungChuoi(v3, v3.ghe[0]!, v3.map.o[2]!).chain.find((m) => m.kind === 'echo')!;
    expect(e3.delta_bp).toBeLessThan(e2.delta_bp);
    expect(e3.delta_bp).toBeGreaterThan(0);
  });

  it('thành phần công khai KHÔNG lộ thứ tự và KHÔNG lộ tin nào giả', () => {
    const m = sinhMap(42, 8);
    const tp = thanhPhanCongKhai(m, 3);
    expect(tp.con_lai).toBe(5);
    expect(tp.so_giai_doan + tp.so_su_kien).toBe(5);
    expect(JSON.stringify(tp)).not.toContain('la_tin_gia');
  });

  it('oCongKhai() cắt cờ tin giả — F12 không moi ra được', () => {
    const o = { kind: 'su_kien', su_kien: 'hack_san', la_tin_gia: true, boi_canh: 'don_doc' as const, bao_truoc: 'giam' } as const;
    expect(JSON.stringify(oCongKhai(o))).not.toContain('la_tin_gia');
  });
});

describe('5. LUẬT THIẾT KẾ — van casual, cắt lỗ, cháy tài khoản', () => {
  /**
   * ⚠ Test này phải là BÀN 5 GHẾ, không phải 2.
   * Từ khi Quỹ vòng chia theo hạng (5000/3000/2000 — chỉ ba hạng đầu có phần),
   * bàn 2 người thì AI CŨNG ăn lại một ít → không ai về 0 → van casual không
   * bao giờ được kích. Muốn thấy vốn chạm 0 phải có ≥4 người tranh cùng pot.
   * Ghế 'a' chỉ còn 5 chip: nó all-in ngay ở tiền cửa và vẫn được tranh pot
   * chính (đúng luật poker), nhưng xếp bét thì ra về trắng tay.
   */
  it('VAN CASUAL: không ai bị loại trước vòng N, chạm sàn thay vì cháy', () => {
    let st = taoTran(3, [
      ghe('a', ['btc']), ghe('b', ['vang']), ghe('c', ['usd']),
      ghe('d', ['vn30']), ghe('e', ['cp_cn']),
    ]);
    st = { ...st, ghe: st.ghe.map((g) => g.id === 'a' ? { ...g, von: 5 } : g) };
    const r = giaiQuyetVong(st, THEO_HET);
    const a = r.trangThai.ghe.find((g) => g.id === 'a')!;
    expect(a.da_chay, 'van còn hiệu lực ở vòng 1').toBe(false);
    expect(a.von).toBe(HOLDEM_DECISIONS.CASUAL_VALVE_FLOOR);
  });

  it('sau vòng N thì cháy thật', () => {
    // Seed đổi theo mỗi lần map đổi luật (1 → 4 → 8, cùng ngày 20/07): thêm lá
    // bài mới, thêm dây chuyền, thêm độ tin theo bối cảnh — mỗi thứ đều làm
    // các lần rút xê dịch, nên seed cũ không còn dựng đúng tình huống.
    // Test này đo LUẬT (quá vòng van thì cháy thật), không đo seed cụ thể.
    let st = taoTran(8, [
      ghe('a', ['btc']), ghe('b', ['vang']), ghe('c', ['usd']),
      ghe('d', ['vn30']), ghe('e', ['cp_cn']),
    ]);
    st = {
      ...st,
      vong: HOLDEM_DECISIONS.CASUAL_VALVE_UNTIL_ROUND!,
      ghe: st.ghe.map((g) => g.id === 'a' ? { ...g, von: 5 } : g),
    };
    const r = giaiQuyetVong(st, THEO_HET);
    const a = r.trangThai.ghe.find((g) => g.id === 'a')!;
    expect(a.da_chay).toBe(true);
    expect(a.von).toBe(0);
    expect(a.vong_chay).toBe(HOLDEM_DECISIONS.CASUAL_VALVE_UNTIL_ROUND);
  });

  it('CẮT LỖ mất phần đã đặt, giữ phần còn lại', () => {
    const st = taoTran(13, [ghe('a', ['btc']), ghe('b', ['vang'])]);
    const r = giaiQuyetVong(st, (c) => (c.ghe_id === 'a' ? { loai: 'bo' as const } : { loai: 'theo' as const }));
    const a = r.trangThai.ghe.find((g) => g.id === 'a')!;
    /*
     * D2 (25/07) — bỏ ở lượt đầu KHÔNG còn miễn phí.
     *
     * Trước D2 test này khẳng định "chỉ mất tiền cửa". Đúng với engine lúc đó,
     * nhưng chính đó là lỗ hổng: ô sắp lật trông xấu thì bỏ luôn — rủi ro 0,
     * chi phí 0, một nước đi trội gần như tuyệt đối. Nay còn phí cắt lỗ (lạm
     * phát vòng + rút khẩn), tính trên vốn CÒN LẠI sau tiền cửa.
     */
    const conLai = HOLDEM_MATCH.START_VON - HOLDEM_MATCH.CAM_KET_NEN;
    const phi = Math.floor(
      (conLai * (CAT_LO_VE_CASH.PHI_LAM_PHAT_BP + CAT_LO_VE_CASH.PHI_RUT_KHAN_BP)) / 10000);
    expect(phi).toBeGreaterThan(0);
    // MỘT người bỏ thì KHÔNG phải giẫm đạp — cần từ hai người cùng chạy một cửa.
    expect(r.ketQua.phi_cat_lo.find((x) => x.ghe_id === 'a')?.giam_dap).toBe(false);
    expect(a.von).toBe(conLai - phi);
    expect(r.ketQua.ket_qua.find((k) => k.ghe_id === 'a')!.da_cat_lo).toBe(true);
  });

  it('người đã CẮT LỖ không bao giờ ăn Quỹ vòng', () => {
    for (let seed = 0; seed < 40; seed += 1) {
      const st = taoTran(seed, [ghe('a', ['btc']), ghe('b', ['vang'])]);
      const r = giaiQuyetVong(st, (c) => (c.ghe_id === 'a' ? { loai: 'bo' as const } : { loai: 'theo' as const }));
      expect(r.ketQua.ghe_thang).not.toBe('a');
    }
  });

  it('Quỹ vòng bảo toàn: tổng vốn cả bàn không tự sinh ra hay mất đi', () => {
    // Chip ảo là hệ kín trong trận — thắng của người này là thua của người kia.
    let st = taoTran(21, [ghe('a', ['btc']), ghe('b', ['vang']), ghe('c', ['usd'])]);
    const truoc = st.ghe.reduce((s, g) => s + g.von, 0);
    const r = giaiQuyetVong(st, THEO_HET);
    const sau = r.trangThai.ghe.reduce((s, g) => s + g.von, 0);
    expect(sau).toBe(truoc);
  });

  it('trần Tăng cam kết chặn được dồn quá tay', () => {
    const st = taoTran(22, [ghe('a', ['btc']), ghe('b', ['vang'])]);
    const r = giaiQuyetVong(st, (c) => (c.ghe_id === 'a' && c.duoc.includes('to')
        ? { loai: 'to' as const, them: c.to_toi_da } : { loai: 'theo' as const }));
    expect(r.trangThai.ghe.find((g) => g.id === 'a')!.von).toBeGreaterThanOrEqual(0);
  });
});

describe('6. TRẬN ĐẦY ĐỦ — chạy hết map không nổ', () => {
  it('chơi trọn map, có xếp hạng, mọi vốn ≥ 0', () => {
    let st = taoTran(31337, [
      ghe('a', ['btc'], ['don_bay']),
      ghe('b', ['vang', 'usd'], ['chan_lo', 'phong_ho']),
      ghe('c', ['vn30'], ['da_dang_hoa']),
      ghe('d', ['cp_cn'], ['mua_duoi', 'chan_lo']),
      ghe('e', ['tpcp'], []),
    ]);
    let buoc = 0;
    while (!daKetThuc(st) && buoc < 50) {
      st = giaiQuyetVong(st, THEO_HET).trangThai;
      buoc += 1;
    }
    expect(buoc).toBe(HOLDEM_DECISIONS.MAP_SIZE);
    for (const g of st.ghe) expect(g.von, g.id).toBeGreaterThanOrEqual(0);
    expect(xepHang(st)).toHaveLength(5);
  });

  it('xung đột thẻ bị phạt — Mua Đuổi + Chặn Lỗ là whipsaw', () => {
    const st = taoTran(41, [ghe('a', ['btc'], ['mua_duoi', 'chan_lo'])]);
    const chain = dungChuoi(st, st.ghe[0]!, st.map.o[0]!).chain;
    expect(chain.some((m) => m.kind === 'xung_dot')).toBe(true);
  });

  it('cộng hưởng Chặn Lỗ + Phòng Hộ được thưởng', () => {
    const st = taoTran(42, [ghe('a', ['vang'], ['chan_lo', 'phong_ho'])]);
    const chain = dungChuoi(st, st.ghe[0]!, st.map.o[0]!).chain;
    expect(chain.some((m) => m.kind === 'cong_huong')).toBe(true);
  });
});
