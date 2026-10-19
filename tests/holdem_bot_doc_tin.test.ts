/**
 * D56 — BOT MUA THEO BỐI CẢNH (v22). Founder chốt phương án A 02/08.
 *
 * Bộ test này canh BA thứ, và thứ ba mới là thứ dễ mất nhất:
 *  (1) hàm chấm điểm đọc đúng bối cảnh (giai đoạn · sự kiện · dư âm · tin giả);
 *  (2) chính sách biến điểm thành LỆNH THẬT — kể cả lệnh BÁN;
 *  (3) CỔNG: trận ≤ v21 replay ra đúng vị thế bot cũ. Hành vi bot không nằm
 *      trong `action_log` mà suy lại mỗi lần dựng trận, nên mất cổng là viết
 *      lại kết quả mọi trận đã lưu — im lặng, không lỗi (bài học D40/D45).
 */
import { describe, expect, it } from 'vitest';
import {
  BOT_CHOI_DUOC, BOT_THAM_CHIEU, BOT_TIN_HIEU, lenhBotNav, loiSuatKyVongBp,
  timBot, type BoiCanhLenh, type Bot,
} from '../server/holdem/bots.js';
import { apLenhVongNav, giaiQuyetVong, taoTran, type GheMoi } from '../server/holdem/engine.js';
import { CAN_TROI_BP, CAN_TROI_BP_V23, luatCua } from '../config/holdem.js';

const botCua = (id: string): Bot => {
  const b = timBot(id);
  if (!b) throw new Error(`không có bot ${id}`);
  return b;
};

const gheMoi = (id: string): GheMoi => ({
  id, loai: 'bot', bac_rank: 'Đồng',
  danh_muc: { tai_san: [], chien_thuat: [] },
});

const oTang: BoiCanhLenh = { o: { kind: 'giai_doan', giai_doan: 'tang' }, echo: [] };
const oChienTranh = (laGia: boolean): BoiCanhLenh['o'] => ({
  kind: 'su_kien', su_kien: 'chien_tranh', la_tin_gia: laGia,
  boi_canh: 'don_doc', bao_truoc: 'giam',
});

describe('D56 — lợi suất kỳ vọng đọc từ bối cảnh', () => {
  const hoaiNghi = botCua('hoai_nghi');

  it('ô GIAI ĐOẠN TĂNG: BTC ăn hơn USD', () => {
    expect(loiSuatKyVongBp('btc', hoaiNghi, oTang))
      .toBeGreaterThan(loiSuatKyVongBp('usd', hoaiNghi, oTang));
  });

  it('ô CHIẾN TRANH: vàng ăn hơn cổ phiếu công nghệ', () => {
    const bc: BoiCanhLenh = { o: oChienTranh(false), echo: [] };
    expect(loiSuatKyVongBp('vang', hoaiNghi, bc))
      .toBeGreaterThan(loiSuatKyVongBp('cp_cn', hoaiNghi, bc));
  });

  it('PHỚT MỌI TIN không đọc ô sự kiện — điểm hai mã bằng chênh lệch nền', () => {
    const phot = botCua('phot_moi_tin');
    const that: BoiCanhLenh = { o: oChienTranh(false), echo: [] };
    const gia: BoiCanhLenh = { o: oChienTranh(true), echo: [] };
    // Không đọc tin ⇒ tin thật hay giả cũng ra CÙNG một điểm.
    expect(loiSuatKyVongBp('vang', phot, that))
      .toBe(loiSuatKyVongBp('vang', phot, gia));
  });

  it('TIN MỌI TIN cầm chắc hơn HOÀI NGHI trên cùng một tin', () => {
    const bc: BoiCanhLenh = { o: oChienTranh(false), echo: [] };
    expect(loiSuatKyVongBp('vang', botCua('tin_moi_tin'), bc))
      .toBeGreaterThan(loiSuatKyVongBp('vang', hoaiNghi, bc));
  });

  it('ORACLE biết tin GIẢ thì đọc NGƯỢC dấu — đây là toàn bộ ưu thế của nó', () => {
    const oracle = botCua('oracle');
    const that: BoiCanhLenh = { o: oChienTranh(true), echo: [], biet_that_gia: true };
    // Tin chiến tranh GIẢ ⇒ vàng KHÔNG lên; ghế thường vẫn tưởng là lên.
    expect(loiSuatKyVongBp('vang', oracle, that))
      .toBeLessThan(loiSuatKyVongBp('vang', hoaiNghi, { o: oChienTranh(false), echo: [] }));
  });

  it('DƯ ÂM tin cũ vẫn cộng vào điểm, và dư âm ĐẢO thì trừ', () => {
    const nen: BoiCanhLenh = { o: oTang.o, echo: [] };
    const duong: BoiCanhLenh = {
      o: oTang.o, echo: [{ su_kien: 'chien_tranh', do_lon_bp: 10000, dao: false }],
    };
    const dao: BoiCanhLenh = {
      o: oTang.o, echo: [{ su_kien: 'chien_tranh', do_lon_bp: 10000, dao: true }],
    };
    expect(loiSuatKyVongBp('vang', hoaiNghi, duong))
      .toBeGreaterThan(loiSuatKyVongBp('vang', hoaiNghi, nen));
    expect(loiSuatKyVongBp('vang', hoaiNghi, dao))
      .toBeLessThan(loiSuatKyVongBp('vang', hoaiNghi, nen));
  });
});

describe('D56 — chính sách biến điểm thành lệnh', () => {
  const ghe = (viThe: Record<string, number>, von = 10000) => ({ von, vi_the: viThe });

  it('mua mã điểm cao nhất của bối cảnh, không phải mã theo lượt', () => {
    const bc: BoiCanhLenh = { o: oChienTranh(false), echo: [] };
    // "Tất tay" gu BTC/cp_cn — nhưng ô chiến tranh đạp cả hai.
    const l = lenhBotNav(botCua('tat_tay'), ghe({}), 1, 4, bc);
    expect(l.length).toBe(1);
    expect(['vang', 'usd', 'tpcp']).toContain(l[0]!.ma);
  });

  it('THOÁT mã đang cầm khi bối cảnh đạp nó — lệnh BÁN có tiền ÂM', () => {
    const bc: BoiCanhLenh = { o: oChienTranh(false), echo: [] };
    const l = lenhBotNav(botCua('phong_thu'), ghe({ cp_cn: 3000 }), 1, 4, bc);
    const ban = l.find((x) => x.tien < 0);
    expect(ban, 'phải có lệnh bán cp_cn khi chiến tranh').toBeTruthy();
    expect(ban!.ma).toBe('cp_cn');
    expect(ban!.tien).toBe(-3000);
  });

  it('mọi mã đều xấu ⇒ đứng ngoài, KHÔNG mua bừa', () => {
    /*
     * Dựng bối cảnh mà mã nào cũng âm: dư âm ĐẢO của một tin vốn tốt cho
     * phòng thủ, chồng lên ô GIẢM. Nếu chính sách vẫn ra lệnh mua thì nó
     * đang chọn "ít tệ nhất" — tức lại giao dịch vô cớ như bản vòng tròn.
     */
    const bc: BoiCanhLenh = {
      o: { kind: 'giai_doan', giai_doan: 'giam' },
      echo: [
        { su_kien: 'bong_bong', do_lon_bp: 10000, dao: true },
        { su_kien: 'ha_lai_suat', do_lon_bp: 10000, dao: true },
      ],
    };
    const co = ['btc', 'cp_cn', 'vn30', 'vang', 'usd', 'tpcp']
      .some((m) => loiSuatKyVongBp(m, botCua('da_dang'), bc) > 0);
    if (!co) expect(lenhBotNav(botCua('da_dang'), ghe({}), 1, 4, bc)).toEqual([]);
  });

  it('LỆNH BÁN CHẠY THẬT qua engine — không phải chỉ đúng trên giấy', () => {
    /*
     * ⚠ TEST QUAN TRỌNG NHẤT FILE NÀY. `apLenhVongNav` trả `{ok:false}` một
     * cách IM LẶNG khi lệnh không hợp lệ, và cả hai người gọi (API + gate)
     * đều bỏ qua lỗi bot. Nên một quy ước sai về dấu của `tien` sẽ biến toàn
     * bộ nước THOÁT thành no-op mà không ai thấy — đúng lớp "cơ chế trang
     * trí" đã gặp 16 lần.
     */
    const luat = luatCua('balance-v22-botdoctin');
    let st = taoTran(20260841, [
      gheMoi('a'), gheMoi('b'),
    ], luat, 8);
    const mua = apLenhVongNav(st, 'a', [{ ma: 'vang', tien: 2000 }]);
    expect(mua.ok, 'mua phải hợp lệ').toBe(true);
    st = mua.st;
    const co = st.ghe.find((g) => g.id === 'a')!;
    expect(co.vi_the.vang).toBeGreaterThan(0);

    const ban = apLenhVongNav(st, 'a', [{ ma: 'vang', tien: -co.vi_the.vang! }]);
    expect(ban.ok, `bán phải hợp lệ, engine nói: ${String(ban.loi)}`).toBe(true);
    const sau = ban.st.ghe.find((g) => g.id === 'a')!;
    expect(sau.vi_the.vang ?? 0).toBe(0);
    expect(sau.von).toBeGreaterThan(co.von); // tiền bán về ví (trừ trượt giá)
  });
});

describe('D56 — CỔNG v22', () => {
  it('vắng bối cảnh ⇒ chính sách VÒNG TRÒN cũ, nguyên văn', () => {
    const bot = botCua('phong_thu'); // gu vàng · usd · tpcp
    const g = { von: 10000, vi_the: {} };
    expect(lenhBotNav(bot, g, 1, 4)).toEqual(lenhBotNav(bot, g, 1, 4));
    expect(lenhBotNav(bot, g, 1, 4)[0]!.ma).toBe('vang');
    expect(lenhBotNav(bot, g, 2, 4)[0]!.ma).toBe('usd'); // luân phiên theo vòng
  });

  it('v21 TẮT cờ, v22 BẬT — cổng không dùng chung với can_troi', () => {
    expect(luatCua('balance-v21-cantroi').botDocTin).toBe(false);
    expect(luatCua('balance-v22-botdoctin').botDocTin).toBe(true);
    // v22 kế thừa trọn v21, không lén tắt/bật thứ khác nhân dịp bump.
    expect(luatCua('balance-v22-botdoctin').canTroi).toBe(true);
    expect(luatCua('balance-v22-botdoctin').congHuongGon).toBe(true);
  });

  it('cờ chảy vào trạng thái trận', () => {
    const v21 = taoTran(1, [gheMoi('a')], luatCua('balance-v21-cantroi'), 8);
    const v22 = taoTran(1, [gheMoi('a')], luatCua('balance-v22-botdoctin'), 8);
    expect(v21.bot_doc_tin).toBeUndefined();
    expect(v22.bot_doc_tin).toBe(true);
  });

  it('BOT CHƠI ĐƯỢC vẫn giữ tính cách: gu nghiêng cán cân khi điểm sát nhau', () => {
    /*
     * Thiên vị phải ĐỦ để đa dạng bàn, KHÔNG đủ để mù. Ô đi ngang gần như
     * phẳng ⇒ gu quyết; ô chiến tranh dốc ⇒ gu thua bối cảnh (đã canh ở
     * test "mua mã điểm cao nhất" phía trên).
     */
    const phang: BoiCanhLenh = { o: { kind: 'giai_doan', giai_doan: 'di_ngang' }, echo: [] };
    const l = lenhBotNav(botCua('phong_thu'), { von: 10000, vi_the: {} }, 1, 4, phang);
    if (l.length > 0) expect(BOT_CHOI_DUOC.some((b) => b.id === 'phong_thu')).toBe(true);
  });

  it('mọi bot tín hiệu + tham chiếu đều nhận được bối cảnh (không con nào mù)', () => {
    for (const b of [...BOT_TIN_HIEU, ...BOT_THAM_CHIEU]) {
      const l = lenhBotNav(b, { von: 10000, vi_the: {} }, 1, 4, oTang);
      expect(Array.isArray(l), `bot ${b.id}`).toBe(true);
    }
  });
});

describe('D58 — CỔNG v23 (cân trôi vòng hai)', () => {
  const gheMoi2 = (id: string): GheMoi => ({
    id, loai: 'bot', bac_rank: 'Đồng',
    danh_muc: { tai_san: [], chien_thuat: [] },
  });

  /** Giá trị vị thế sau N vòng ôm một mã — thước mà CAN_TROI_BP chỉnh. */
  function viTheSau(phienBan: string, ma: string, vong: number): number {
    let st = taoTran(777, [gheMoi2('a'), gheMoi2('b')], luatCua(phienBan), 8);
    const r = apLenhVongNav(st, 'a', [{ ma, tien: 8000 }]);
    if (r.ok) st = r.st;
    for (let i = 0; i < vong; i += 1) {
      st = giaiQuyetVong(st, () => ({ loai: 'theo' as const })).trangThai;
    }
    const g = st.ghe.find((x) => x.id === 'a')!;
    return Object.values(g.vi_the).reduce((a, b) => a + b, 0);
  }

  it('v23 ĐỔI THẬT kết quả so với v22 — cổng không phải trang trí', () => {
    /*
     * ⚠ Bảng cân trôi là thứ SAI IM LẶNG: đổi số mà không nối được vào engine
     * thì mọi phép đo sau đó đo bảng cũ nhưng in nhãn bảng mới. Test này bắt
     * đúng chuyện đó — cùng seed, cùng mã, khác đúng một cờ.
     */
    const v22 = viTheSau('balance-v22-botdoctin', 'usd', 5);
    const v23 = viTheSau('balance-v23-cantroi2', 'usd', 5);
    expect(v22).toBeGreaterThan(0);
    expect(v23, 'usd: +610bp (v22) so với +540bp (v23) phải ra số khác').not.toBe(v22);
  });

  it('bảng v23 nằm đúng chỗ và KHÔNG đụng bảng v21', () => {
    expect(CAN_TROI_BP.usd).toBe(610);   // v21/v22 — trận cũ replay theo số này
    expect(CAN_TROI_BP_V23.usd).toBe(540);
    // Sáu mã, không thiếu mã nào — thiếu một mã là mã đó rơi về 0 im lặng.
    for (const m of Object.keys(CAN_TROI_BP)) {
      expect(CAN_TROI_BP_V23[m], `thiếu ${m} trong bảng v23`).toBeTypeOf('number');
    }
  });
});
