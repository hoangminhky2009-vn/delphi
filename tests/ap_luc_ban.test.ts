/**
 * ÁP LỰC BÀN — v37 R6 (D181): hành vi gộp của bàn thôi là CÔNG TẮC NGƯỠNG mà
 * thành BIẾN LIÊN TỤC CÓ TRÍ NHỚ, đổi xác suất của cả hai máy thay ô.
 *
 *   §I   ĐO MỨC DỒN — có độ lớn, đọc cả hai thước (ghế + vốn), không có hướng.
 *   §II  ⭐⭐ TRÍ NHỚ — nạp + mòn; bàn dồn lâu khác bàn vừa dồn một vòng.
 *   §III ⭐⭐ PHÂN PHỐI LẠI, KHÔNG PHẢI VẶN TO — bàn chớm ngưỡng nổ ÍT HƠN v36.
 *   §IV  ⚠ TRẦN — bất khả thương lượng (addendum §3): chợ luôn còn cửa cãi lại.
 *   §V   CỔNG + REPLAY — cờ tắt ⇒ trận cũ ra đúng từng byte.
 */
import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import {
  AP_LUC_BAN, BE_CHUOI_VON, PHAN_THAN, luatCua, BO_LUAT_THEO_PHIEN_BAN,
} from '../config/holdem.js';
import {
  taoTran, mucDonVuotBp, napApLuc, xsCongApLuc, type TrangThaiTran,
} from '../server/holdem/engine.js';

const V37 = 'balance-v37-aplucban';
const V36 = 'balance-v36-regime';

/**
 * Bàn tối thiểu. `viThe` là vị thế từng ghế; helper đặt luôn `danh_muc.tai_san`
 * cho khớp — vế GHẾ đọc lá tài sản (`demTheoMa`) còn vế VỐN đọc `vi_the`, đặt
 * một bên thôi là dựng một bàn không tồn tại trong trận thật.
 * ⚠ `von` về 0 để tỷ lệ vốn-trên-NAV nói đúng điều nó định nói.
 */
function ban(viThe: Record<string, number>[], them: Partial<TrangThaiTran> = {},
  phienBan = V37, von = 9000) {
  const st = taoTran(20260001, viThe.map((_v, i) => ({
    id: `g${i}`, loai: 'bot' as const, bac_rank: 'Đồng',
    danh_muc: { tai_san: [], chien_thuat: [] },
  })), luatCua(phienBan), 12);
  return {
    ...st,
    ghe: st.ghe.map((g, i) => ({
      ...g,
      von,
      vi_the: { ...g.vi_the, ...viThe[i] },
      danh_muc: { ...g.danh_muc, tai_san: Object.keys(viThe[i] ?? {}) },
    })),
    ...them,
  } as TrangThaiTran;
}

describe('I. Đo mức dồn — độ lớn, hai thước, KHÔNG hướng', () => {
  it('bàn không dồn ⇒ 0; bàn dồn hết vào một phe ⇒ vượt lớn', () => {
    expect(mucDonVuotBp(ban([{}, {}, {}, {}, {}]))).toBe(0);
    const dayDu = ban([
      { btc: 9000 }, { btc: 9000 }, { btc: 9000 }, { btc: 9000 }, { btc: 9000 },
    ]);
    expect(mucDonVuotBp(dayDu)).toBeGreaterThan(3000);
  });

  it('⭐ CÓ ĐỘ LỚN — dồn 100% vượt nhiều hơn dồn vừa đủ ngưỡng (thứ công tắc cũ mù)', () => {
    /*
     * ⚠ Ghế trống phải CÒN TIỀN MẶT (`von` > 0) thì vế vốn mới nói được gì: với
     * von = 0 thì hễ một ghế cầm vị thế là phe đó chiếm 100% tổng NAV bàn, và
     * thước bão hoà — bài đầu tiên của tôi xanh/đỏ vì đúng chỗ đó, không vì cơ chế.
     */
    const vua = ban([{ btc: 9000 }, { btc: 9000 }, { btc: 9000 }, {}, {}]);
    const het = ban([
      { btc: 9000 }, { btc: 9000 }, { btc: 9000 }, { btc: 9000 }, { btc: 9000 },
    ]);
    expect(mucDonVuotBp(het)).toBeGreaterThan(mucDonVuotBp(vua));
  });

  it('⭐ KHÔNG CÓ HƯỚNG — dồn về phòng thủ cũng sinh áp lực như dồn về rủi ro', () => {
    const on = ban([{ btc: 9000 }, { btc: 9000 }, { btc: 9000 }, { btc: 9000 }, { btc: 9000 }]);
    const thu = ban([
      { vang: 9000 }, { vang: 9000 }, { vang: 9000 }, { vang: 9000 }, { vang: 9000 },
    ]);
    // ⚠ Chốt khác 0 TRƯỚC khi so bằng: hai vế cùng bằng 0 thì bài này xanh mà
    // không chứng minh gì (đúng bẫy "xanh vì lý do sai" đã dính ở lượt đầu).
    expect(mucDonVuotBp(on)).toBeGreaterThan(0);
    expect(mucDonVuotBp(thu)).toBe(mucDonVuotBp(on));
  });

  it('⭐ đọc CẢ HAI thước — bàn nặng VỐN mà ít ghế vẫn sinh áp lực', () => {
    /*
     * Hai ghế ôm gần trọn NAV vào risk-on, ba ghế trắng tay: vế GHẾ chỉ 40% (dưới
     * ngưỡng 60%), nhưng vế VỐN vượt. Công tắc phản thân cũ (chỉ đếm ghế) mù ca này.
     */
    const st = ban([{ btc: 20000 }, { btc: 20000 }, {}, {}, {}], {}, V37, 2000);
    const tyLeGhe = 2 / 5;
    expect(tyLeGhe * 10000).toBeLessThan(PHAN_THAN.NGUONG_LOBBY_BP);
    expect(mucDonVuotBp(st), 'vế VỐN không được đọc ⇒ mất hẳn ca cá mập')
      .toBeGreaterThan(0);
  });

  it('lấy MAX chứ không CỘNG hai vế — không đếm đúp một bàn vừa đông vừa nặng', () => {
    // `von = 0` ⇒ CẢ HAI vế cùng kịch 100% ⇒ đây là ca duy nhất phân biệt được
    // MAX với CỘNG (max 4000 vs cộng 8000).
    const st = ban([
      { btc: 9000 }, { btc: 9000 }, { btc: 9000 }, { btc: 9000 }, { btc: 9000 },
    ], {}, V37, 0);
    const gheVuot = 10000 - PHAN_THAN.NGUONG_LOBBY_BP;
    const vonVuot = 10000 - BE_CHUOI_VON.NGUONG_VON_BP;
    expect(gheVuot, 'ca dựng sai: vế ghế không dương').toBeGreaterThan(0);
    expect(vonVuot, 'ca dựng sai: vế vốn không dương').toBeGreaterThan(0);
    expect(mucDonVuotBp(st)).toBe(Math.max(gheVuot, vonVuot));
    expect(mucDonVuotBp(st)).toBeLessThan(gheVuot + vonVuot);
  });
});

describe('II. ⭐⭐ Trí nhớ — nạp và mòn', () => {
  const donManh = () => ban([
    { btc: 9000 }, { btc: 9000 }, { btc: 9000 }, { btc: 9000 }, { btc: 9000 },
  ], { ap_luc_ban: true });

  it('⭐⭐ bàn dồn NHIỀU VÒNG LIỀN có áp lực cao hơn bàn vừa dồn một vòng', () => {
    let st = donManh();
    const sau1 = napApLuc(st).ap_luc_bp ?? 0;
    st = napApLuc(napApLuc(napApLuc(st)));
    expect(st.ap_luc_bp ?? 0, 'không tích luỹ ⇒ đây vẫn là công tắc, không phải trí nhớ')
      .toBeGreaterThan(sau1);
  });

  it('⭐ áp lực MÒN khi bàn thôi dồn — không phải cái bẫy một chiều', () => {
    const cao = napApLuc(napApLuc(napApLuc(donManh())));
    const yen = { ...ban([{}, {}, {}, {}, {}], { ap_luc_ban: true }),
      ap_luc_bp: cao.ap_luc_bp } as TrangThaiTran;
    const sau = napApLuc(yen).ap_luc_bp ?? 0;
    expect(sau).toBeLessThan(cao.ap_luc_bp ?? 0);
    expect(sau, 'mòn về 0 ngay lập tức thì cũng là công tắc').toBeGreaterThan(0);
  });

  it('⚠ áp lực có TRẦN — dồn mãi không thành vô hạn', () => {
    let st = donManh();
    for (let i = 0; i < 40; i += 1) st = napApLuc(st);
    expect(st.ap_luc_bp).toBeLessThanOrEqual(AP_LUC_BAN.TRAN_BP);
  });
});

describe('III. ⭐⭐ Phân phối lại, không phải vặn to', () => {
  const stAp = (bp: number) => ({ ap_luc_ban: true, ap_luc_bp: bp } as TrangThaiTran);

  it('⭐⭐ bàn CHỚM ngưỡng nổ ÍT HƠN v36 — vế sàn là thứ làm R6 khác "phạt nặng hơn"', () => {
    expect(xsCongApLuc(stAp(0), PHAN_THAN.TANG_BP)).toBeLessThan(PHAN_THAN.TANG_BP);
  });

  it('⭐⭐ xác suất TĂNG ĐƠN ĐIỆU theo áp lực', () => {
    const day = [0, 2000, 4000, 6000, 8000, 10000]
      .map((a) => xsCongApLuc(stAp(a), PHAN_THAN.TANG_BP));
    for (let i = 1; i < day.length; i += 1) {
      expect(day[i]!, `áp lực tăng mà xác suất không tăng ở nấc ${i}`)
        .toBeGreaterThan(day[i - 1]!);
    }
  });

  it('bàn dồn LÌ vượt qua mức v36 — nếu không thì cơ chế chỉ biết giảm', () => {
    expect(xsCongApLuc(stAp(AP_LUC_BAN.TRAN_BP), PHAN_THAN.TANG_BP))
      .toBeGreaterThan(PHAN_THAN.TANG_BP);
  });

  it('⭐ giữ nguyên phần cộng của cá mập (bẻ-chuỗi) — sàn nhân vào xs GỐC, không thay nó', () => {
    const thap = xsCongApLuc(stAp(3000), 2000);
    const cao = xsCongApLuc(stAp(3000), 4000);
    expect(cao).toBeGreaterThan(thap);
  });
});

describe('IV. ⚠ Trần — chợ luôn còn cửa cãi lại đám đông (addendum §3)', () => {
  it('⭐⭐ dù áp lực kịch trần và xs gốc rất cao, xác suất vẫn ≤ XS_TRAN_BP', () => {
    const x = xsCongApLuc(
      { ap_luc_ban: true, ap_luc_bp: AP_LUC_BAN.TRAN_BP } as TrangThaiTran, 9999);
    expect(x).toBeLessThanOrEqual(AP_LUC_BAN.XS_TRAN_BP);
  });

  it('⚠ trần phải để lại ít nhất 25% cửa cho chợ đi ngược — bỏ vế này là đám đông ĐIỀU KHIỂN chợ', () => {
    expect(AP_LUC_BAN.XS_TRAN_BP).toBeLessThanOrEqual(7500);
  });
});

describe('V. Cổng + replay', () => {
  it('cờ TẮT ⇒ không nạp, không đổi xác suất (trận cũ replay nguyên)', () => {
    const st = ban(
      [{ btc: 9000 }, { btc: 9000 }, { btc: 9000 }, { btc: 9000 }, { btc: 9000 }],
      {}, V36);
    expect(st.ap_luc_ban, 'v36 không được bật cờ v37').not.toBe(true);
    expect(mucDonVuotBp(st), 'bàn phải THẬT SỰ đang dồn, không thì bài rỗng')
      .toBeGreaterThan(0);
    expect(napApLuc(st).ap_luc_bp).toBeUndefined();
    expect(xsCongApLuc(st, PHAN_THAN.TANG_BP)).toBe(PHAN_THAN.TANG_BP);
  });

  it('⭐ v37 khác v36 ĐÚNG MỘT cờ — cô lập được cần gạt khi đo', () => {
    const a = BO_LUAT_THEO_PHIEN_BAN[V37]! as unknown as Record<string, boolean>;
    const b = BO_LUAT_THEO_PHIEN_BAN[V36]! as unknown as Record<string, boolean>;
    const khac = Object.keys({ ...a, ...b }).filter((k) => a[k] !== b[k]);
    expect(khac).toEqual(['apLucBan']);
  });

  it('mọi phiên bản CŨ đều tắt cờ — không phiên bản nào bị đổi hồi tố', () => {
    for (const [ten, luat] of Object.entries(BO_LUAT_THEO_PHIEN_BAN)) {
      /*
       * ⚠ THƯỚC LÀ "KHÔNG BẬT HỒI TỐ", KHÔNG PHẢI "CHỈ MỘT PHIÊN BẢN" (D181).
       * Bản đầu bỏ qua đúng một tên, nên mỗi lần thêm phiên bản KẾ THỪA là bài
       * này đỏ dù không có gì hỏng — và bài đỏ vì lý do sai thì bị nới bừa (D79).
       * Điều phải giữ: phiên bản CŨ HƠN mốc không bao giờ được bật (đó mới là cú
       * đổi replay trận đã lưu); từ mốc trở đi thì phải bật.
       */
      const soCua = (t: string) => Number(/balance-v(\d+)/.exec(t)?.[1] ?? 0);
      const moc = soCua('balance-v37-aplucban');
      if (soCua(ten) < moc) {
        expect((luat as unknown as Record<string, boolean>)['apLucBan'],
          `phiên bản CŨ "${ten}" bật cờ ⇒ đổi trận đã lưu`).not.toBe(true);
      } else {
        // D389 — v54 cắt cụm đám đông đổi lá (bản đồ chỉ do seed quyết): từ v54 TẮT.
        expect((luat as unknown as Record<string, boolean>)['apLucBan'],
          `phiên bản "${ten}" từ mốc tới trước v54 bật, từ v54 tắt`).toBe(soCua(ten) < 54);
      }
    }
  });

  it('⭐ nạp áp lực nằm TRƯỚC hai máy thay ô ở điểm nối vòng', () => {
    /*
     * Thứ tự này là NGHĨA, không phải gu: áp lực của vòng vừa xong phải đổi xác
     * suất cho ô SẮP TỚI. Gọi sau hai máy thì hành vi trễ một nhịp so với chính
     * lời hứa của cơ chế, và không bài nào khác bắt được (kết quả vẫn "hợp lý").
     */
    const src = readFileSync(resolve(process.cwd(), 'server/holdem/engine.ts'), 'utf8');
    const i = src.indexOf('apBeChuoiVon(apPhanThan(');
    expect(i, 'không tìm thấy điểm nối vòng').toBeGreaterThan(0);
    expect(src.slice(i, i + 200)).toContain('napApLuc(');
  });

  it('⚠ cửa "không còn gì để thay" KHÔNG được mở lại bằng cú lan (đã đo, dưới 1 SE)', () => {
    const src = readFileSync(resolve(process.cwd(), 'server/holdem/engine.ts'), 'utf8');
    const sach = src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '');
    expect(sach, 'cú lan sang ô chưa lật đã bị gỡ vì +0,7pp trên n=709 — dưới 1 SE')
      .not.toMatch(/LAN_CUA_SO_O|LAN_NGUONG_BP/);
  });
});
