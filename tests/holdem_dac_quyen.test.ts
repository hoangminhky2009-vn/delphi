/**
 * ĐẶC QUYỀN THẺ CHIẾN THUẬT (D33) + NHỊP CHỌN THẺ CO THEO ĐƯỜNG CONG (D34).
 *
 * Mọi khẳng định ở đây là KHOẢNG hoặc QUAN HỆ, không phải `toBe(hằng_số)`: chép
 * hằng số vào test thì test chỉ nhắc lại config chứ không kiểm gì (bẫy 7).
 *
 * ─── SÁU BẤT BIẾN, mất cái nào là hỏng một thứ khác hẳn ────────────────────
 *
 * 1. CỔNG PHIÊN BẢN THẬT. `dac_quyen` tắt ⇒ dây chuyền chấm điểm giống hệt bản
 *    trước D33 tới từng bp, KỂ CẢ khi ghế đang cầm đúng năm lá đó. Mất cái này
 *    là mọi trận đã lưu replay ra kết quả khác — im lặng, không lỗi.
 *
 * 2. ĐẶC QUYỀN PHẢI CHẠY THẬT. Bẫy số 1 của repo là cơ chế trang trí: code có,
 *    test có, không đường chạy nào gọi. Nên mỗi lá phải chứng minh bằng ĐO —
 *    bật/tắt cổng cho ra hai con số KHÁC NHAU trên cùng một bàn.
 *
 * 3. ĐẶC QUYỀN CÓ GIÁ LẶP LẠI (D33). Không có vế đó thì Chặn Lỗ là thẻ-phải-lấy
 *    và bốn lá kia không bao giờ được chọn. Nên phí phải thu KỂ CẢ vòng sàn
 *    không chạm.
 *
 * 4. SÀN CHẶN LỖ KHÔNG PHẢI SÀN CỦA TỔNG. Founder: "chưa tính trượt giá và kẹt
 *    thanh khoản". Kết quả cuối PHẢI thủng sàn được, nếu không thì (a) nó hứa
 *    một thứ thị trường thật không hứa và (b) nó nén phương sai — cỗ máy vỡ G3.
 *
 * 5. SHORT PHẢI TRỄ MỘT VÒNG. Khớp ngay = biết kết quả rồi mới đặt = quyền chọn
 *    miễn phí, và mất luôn tín hiệu "dám cược TRƯỚC khi biết" mà A1 muốn đo.
 *
 * 6. DỰ BÁO LÀ "BIẾT HẸP HƠN", KHÔNG PHẢI "BIẾT TRƯỚC" (phương án A). Ba tên
 *    LUÔN chứa `SO_TEN_SAI` tên bảo đảm sai, nên tỷ lệ trúng của danh sách phải
 *    THẤP HƠN HẲN tỷ lệ trúng của top-3 thô. Bằng nhau nghĩa là chỗ chèn tên sai
 *    không chạy — và đó đúng là kiểu hỏng im lặng nhất của cả cụm.
 */
import { describe, expect, it } from 'vitest';
import {
  allInMoCho, apDatShort, chotPhien, choiVongCuoc, coDacQuyen, dungChuoi,
  giaiQuyetVong, shortKhopO, soOChienThuat, taoTran,
  type Ghe, type GheMoi, type MatXich, type TrangThaiTran,
} from '../server/holdem/engine.js';
import {
  dungBangDienTu, dungDuBao, hangBangCua, phiMoBang, xepHangUngVien,
  HANG_BANG_THUONG,
} from '../server/holdem/bang_dien_tu.js';
import { bayShop, muaCaVong, KHONG_TRAN } from '../server/holdem/shop.js';
import { sinhMap, type OThiTruong } from '../server/holdem/map.js';
import {
  BANG_DIEN_TU, CAT_LO_VE_CASH, DAC_QUYEN, HOLDEM_DECISIONS, SO_THE_CHIEN_THUAT,
  SU_KIEN, allInDaMo, giaMoBang, luatCua,
  type ChienThuatId, type GiaiDoanId, type SuKienId,
} from '../config/holdem.js';

// ---------------------------------------------------------------------------
// Đồ nghề
// ---------------------------------------------------------------------------

function ghe(id: string, taiSan: string[], chienThuat: ChienThuatId[] = []): GheMoi {
  return {
    id, loai: 'bot', bac_rank: 'Đồng',
    danh_muc: { tai_san: taiSan, chien_thuat: chienThuat },
  };
}

const gd = (id: GiaiDoanId): OThiTruong => ({ kind: 'giai_doan', giai_doan: id });
/** `bao_truoc` đọc từ config, không gõ tay: dàn map sai nhãn là đo nhầm telegraph. */
const sk = (id: SuKienId, giaMao = false): OThiTruong => ({
  kind: 'su_kien', su_kien: id, la_tin_gia: giaMao, boi_canh: 'don_doc',
  bao_truoc: SU_KIEN.find((x) => x.id === id)!.bao_truoc,
});

/**
 * Bàn có MAP DÀN SẴN — mọi phép đo cân bằng phải cô lập được ô đang lật, nếu
 * không thì chênh lệch đến từ ô ngẫu nhiên chứ không từ cơ chế đang đo.
 */
function ban(
  ghes: readonly GheMoi[],
  o: readonly OThiTruong[],
  opt: { vong?: number; dacQuyen?: boolean; truoc?: Record<string, string[]> } = {},
): TrangThaiTran {
  const st = taoTran(4242, ghes, {
    luatVon: true, dacQuyen: opt.dacQuyen ?? true,
  });
  return {
    ...st,
    map: { ...st.map, o },
    vong: opt.vong ?? 1,
    ...(opt.truoc ? { tai_san_truoc: opt.truoc } : {}),
  };
}

const oCua = (st: TrangThaiTran) => st.map.o[st.vong - 1]!;
const gheCua = (st: TrangThaiTran, id: string): Ghe => st.ghe.find((g) => g.id === id)!;
const co = (chain: readonly MatXich[], kind: MatXich['kind']) =>
  chain.some((m) => m.kind === kind);
const tong = (chain: readonly MatXich[], kind: MatXich['kind']) =>
  chain.filter((m) => m.kind === kind).reduce((s, m) => s + m.delta_bp, 0);
const THEO = () => ({ loai: 'theo' as const });

// ---------------------------------------------------------------------------
// 0. CỔNG PHIÊN BẢN — bất biến 1
// ---------------------------------------------------------------------------

describe('0. CỔNG — trận cũ phải replay ra ĐÚNG kết quả cũ', () => {
  it('bảng tra biết phiên bản nào bật đặc quyền, phiên bản nào không', () => {
    expect(luatCua('balance-v5-D30-camket').dacQuyen).toBe(false);
    expect(luatCua('balance-v6-luatvon').dacQuyen).toBe(false);
    expect(luatCua('balance-v7-dacquyen').dacQuyen).toBe(true);
    // Bản cũ KHÔNG được mất cần gạt của chính nó chỉ vì có bản mới ra đời.
    expect(luatCua('balance-v6-luatvon').luatVon).toBe(true);
  });

  it('phiên bản lạ / thiếu ⇒ tắt hết, không đoán bừa', () => {
    expect(luatCua(undefined).dacQuyen).toBe(false);
    expect(luatCua('balance-v0-khong-ton-tai').dacQuyen).toBe(false);
  });

  it('cổng TẮT ⇒ chuỗi chấm điểm giống hệt bản cũ, dù ghế cầm đủ năm lá', () => {
    const nam: ChienThuatId[] = [
      'chan_lo', 'khop_nhanh', 'da_dang_hoa', 'phong_ho', 'luot_song',
    ];
    const o = [gd('giam'), gd('giam')];
    const lam = (bat: boolean) => {
      const st = ban([ghe('a', ['btc'], nam)], o, { dacQuyen: bat });
      return dungChuoi(st, gheCua(st, 'a'), oCua(st));
    };
    const tat = lam(false);
    // Không có mắt xích nào của cụm D33 lọt vào khi cổng đóng.
    expect(co(tat.chain, 'chan_lo_san')).toBe(false);
    expect(co(tat.chain, 'dac_quyen')).toBe(false);
    expect(co(tat.chain, 'short')).toBe(false);
    // …và bật lên thì PHẢI khác — nếu bằng nhau thì cổng không điều khiển gì.
    expect(lam(true).pnl_bp).not.toBe(tat.pnl_bp);
  });

  it('`coDacQuyen` là cửa DUY NHẤT: cổng tắt thì cầm thẻ cũng không có quyền', () => {
    const tat = ban([ghe('a', ['btc'], ['chan_lo'])], [gd('giam')], { dacQuyen: false });
    const bat = ban([ghe('a', ['btc'], ['chan_lo'])], [gd('giam')]);
    expect(coDacQuyen(tat, gheCua(tat, 'a'), 'chan_lo')).toBe(false);
    expect(coDacQuyen(bat, gheCua(bat, 'a'), 'chan_lo')).toBe(true);
    // Không cầm thẻ thì cổng bật cũng không có quyền.
    const khong = ban([ghe('a', ['btc'])], [gd('giam')]);
    expect(coDacQuyen(khong, gheCua(khong, 'a'), 'chan_lo')).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// 1. CHẶN LỖ — bất biến 3 và 4
// ---------------------------------------------------------------------------

describe('1. CHẶN LỖ — sàn của phần LÕI, phí thu mỗi vòng', () => {
  /**
   * Ô đủ xấu để phần lõi thủng sàn: Tăng lãi suất đánh cả ba mã risk-on, ĐO Ở
   * VÒNG 2, giai đoạn Giảm.
   *
   * ⚠ BA CHI TIẾT, thiếu cái nào thì test xanh mà không đo gì:
   *   · phải ba mã — một mã một sự kiện chỉ ra quanh −20%, chưa chạm sàn;
   *   · phải vòng SAU vòng tin — `echoDangCo` chỉ tính sự kiện của các vòng
   *     TRƯỚC, nên đo ngay tại vòng tin nổ thì cú đánh chưa vào giá;
   *   · phải chọn tin có NHÁNH HỆ QUẢ CÙNG CHIỀU. Thiên nga đen kéo theo
   *     `ha_lai_suat` + `bong_bong` — hai nhánh DƯƠNG cho risk-on — nên nó tự
   *     bù mất gần hết cú đánh. Tăng lãi suất kéo theo `hack_san`, cùng chiều.
   */
  const oXau = [sk('tang_lai_suat'), gd('giam'), gd('giam')];
  const VONG_DO = 2;
  const RISK = ['btc', 'cp_cn', 'vn30'];

  it('vòng lỗ nặng: có sàn thì lỗ NHẸ HƠN hẳn — và mắt xích nói ra đã cứu bao nhiêu', () => {
    const st = ban([ghe('a', RISK, ['chan_lo'])], oXau, { vong: VONG_DO });
    const stKhong = ban([ghe('a', RISK)], oXau, { vong: VONG_DO });
    const cA = dungChuoi(st, gheCua(st, 'a'), oCua(st));
    const cB = dungChuoi(stKhong, gheCua(stKhong, 'a'), oCua(stKhong));

    expect(cA.pnl_bp).toBeGreaterThan(cB.pnl_bp);
    const san = cA.chain.find((m) => m.kind === 'chan_lo_san');
    expect(san, 'sàn phải hiện thành MẮT XÍCH — bằng chứng cho người chơi').toBeTruthy();
    if (san?.kind === 'chan_lo_san') {
      expect(san.truoc_san_bp).toBeLessThan(san.san_bp);
      expect(san.delta_bp).toBeGreaterThan(0);
    }
  });

  it('phí bảo hiểm thu MỖI vòng, kể cả vòng sàn KHÔNG chạm (giá lặp lại — D33)', () => {
    // Ô êm: lõi không thủng sàn, nên chỉ còn đúng khoản phí.
    const oEm = [gd('tang'), gd('tang')];
    const st = ban([ghe('a', ['vn30'], ['chan_lo'])], oEm);
    const c = dungChuoi(st, gheCua(st, 'a'), oCua(st));
    expect(co(c.chain, 'chan_lo_san'), 'ô êm thì sàn không được chạm').toBe(false);
    const phi = c.chain.filter(
      (m) => m.kind === 'dac_quyen' && m.ly_do === 'phi_bao_hiem');
    expect(phi).toHaveLength(1);
    expect(phi[0]!.delta_bp).toBeLessThan(0);
  });

  it('SÀN KHÔNG PHẢI SÀN CỦA TỔNG — trượt giá cộng sau vẫn thủng được', () => {
    /*
     * Bàn đông cùng dồn một mã sổ lệnh MỎNG ⇒ khoản crowding đủ to để kéo tổng
     * xuống dưới sàn. Nếu ai đó "sửa" sàn thành kẹp lên tổng cuối thì test này
     * đỏ — và đó chính là ý muốn: kẹp tổng là nén phương sai, cỗ máy vỡ G3.
     */
    const ghes = ['a', 'b', 'c', 'd', 'e'].map((id) => (
      id === 'a' ? ghe(id, RISK, ['chan_lo']) : ghe(id, RISK)));
    const st = ban(ghes, oXau, { vong: VONG_DO });
    const c = dungChuoi(st, gheCua(st, 'a'), oCua(st));
    expect(co(c.chain, 'chan_lo_san'), 'lõi phải chạm sàn ở ca này').toBe(true);
    expect(c.pnl_bp, 'tổng cuối PHẢI thủng sàn được').toBeLessThan(-DAC_QUYEN.CHAN_LO.SAN_BP);
  });
});

// ---------------------------------------------------------------------------
// 2. KHỚP NHANH — ba khoản trượt giá, bất biến 2
// ---------------------------------------------------------------------------

describe('2. KHỚP NHANH — che ĐÚNG họ trượt giá, không che chi phí giữ tiền', () => {
  it('hoàn một phần HÀNG CHỜ khớp lệnh của mã vừa vào', () => {
    // Ba ghế cùng nhảy vào `btc` trong đúng vòng này ⇒ có hàng chờ để mà hoàn.
    const truoc = { a: ['vang'], b: ['vang'], c: ['vang'] };
    const ghes = [ghe('a', ['btc'], ['khop_nhanh']), ghe('b', ['btc']), ghe('c', ['btc'])];
    const st = ban(ghes, [gd('di_ngang'), gd('di_ngang')], { vong: 2, truoc });
    const cA = dungChuoi(st, gheCua(st, 'a'), oCua(st));
    const cB = dungChuoi(st, gheCua(st, 'b'), oCua(st));

    expect(tong(cB.chain, 'xep_hang'), 'phải CÓ hàng chờ thì mới đo được').toBeLessThan(0);
    const hoan = cA.chain.filter((m) => m.kind === 'dac_quyen' && m.ly_do === 'xep_hang');
    expect(hoan).toHaveLength(1);
    expect(hoan[0]!.delta_bp).toBeGreaterThan(0);
    // Hoàn MỘT PHẦN, không bao giờ vượt chính khoản phạt (nếu không thì hàng chờ
    // biến thành tiền thưởng cho người có thẻ).
    expect(hoan[0]!.delta_bp).toBeLessThanOrEqual(-tong(cA.chain, 'xep_hang'));
  });

  it('phần RÚT KHẨN của phí Cắt lỗ nhẹ đi, phần LẠM PHÁT thì không', () => {
    const lam = (the: ChienThuatId[]) => {
      const st0 = ban([ghe('a', ['btc'], the), ghe('b', ['vang'])],
        [gd('di_ngang'), gd('di_ngang')]);
      // `a` cắt lỗ trong vòng này; `b` chơi bình thường để vòng cược đóng được.
      const r = giaiQuyetVong(st0, (x) => (
        x.ghe_id === 'a' && x.duoc.includes('bo')
          ? { loai: 'bo' as const } : THEO()));
      return r.trangThai.ghe.find((g) => g.id === 'a')!.von;
    };
    const nhanh = lam(['khop_nhanh']);
    const thuong = lam([]);
    expect(nhanh, 'có thẻ thì mất ít hơn').toBeGreaterThan(thuong);

    /*
     * VÀ KHÔNG ĐƯỢC MIỄN PHÍ CẢ KHOẢN. Phần lạm phát vòng là chi phí GIỮ TIỀN
     * MẶT — hạ tầng khớp lệnh nhanh không làm tiền mặt bớt mất giá. Che cả hai
     * là biến Khớp Nhanh thành lá "bỏ bài rẻ", tức thưởng cho đúng nước đi mà
     * D2 vừa dựng giá cho.
     */
    const conNguyen = ban([ghe('a', ['btc'])], [gd('di_ngang')])
      .ghe[0]!.von;
    const matNhanh = conNguyen - nhanh;
    const matThuong = conNguyen - thuong;
    const tyLeToiThieu = CAT_LO_VE_CASH.PHI_LAM_PHAT_BP
      / (CAT_LO_VE_CASH.PHI_LAM_PHAT_BP + CAT_LO_VE_CASH.PHI_RUT_KHAN_BP);
    expect(matNhanh / matThuong).toBeGreaterThan(tyLeToiThieu * 0.95);
  });
});

// ---------------------------------------------------------------------------
// 3. PHÒNG HỘ — bất biến 5
// ---------------------------------------------------------------------------

describe('3. PHÒNG HỘ — đặt vòng này, KHỚP vòng sau', () => {
  const o8 = Array.from({ length: 8 }, () => gd('giam'));

  it('không cầm thẻ / cổng tắt ⇒ từ chối CÓ LÝ DO, không im lặng', () => {
    const khongThe = ban([ghe('a', ['btc'])], o8);
    expect(apDatShort(khongThe, 'a', 'btc').loi).toBe('khong_co_dac_quyen');
    const tat = ban([ghe('a', ['btc'], ['phong_ho'])], o8, { dacQuyen: false });
    expect(apDatShort(tat, 'a', 'btc').loi).toBe('khong_co_dac_quyen');
    const coThe = ban([ghe('a', ['btc'], ['phong_ho'])], o8);
    expect(apDatShort(coThe, 'a', 'xyz').loi).toBe('ma_khong_ton_tai');
    expect(apDatShort(coThe, 'zzz', 'btc').loi).toBe('khong_co_ghe');
  });

  it('KHÔNG đòi đang nắm mã đó — bán khống là cược vào thứ mình không cầm', () => {
    const st = ban([ghe('a', ['vang'], ['phong_ho'])], o8);
    expect(apDatShort(st, 'a', 'btc').ok).toBe(true);
  });

  it('vòng CUỐI thì chặn: lệnh khớp ở vòng sau, mà vòng sau không tồn tại', () => {
    const st = ban([ghe('a', ['btc'], ['phong_ho'])], o8, { vong: 8 });
    expect(apDatShort(st, 'a', 'btc').loi).toBe('vong_cuoi');
    // Một vòng mỗi lệnh.
    const st2 = ban([ghe('a', ['btc'], ['phong_ho'])], o8, { vong: 3 });
    const r = apDatShort(st2, 'a', 'btc');
    expect(apDatShort(r.st, 'a', 'vang').loi).toBe('da_dat_vong_nay');
  });

  it('KHÔNG khớp ở vòng đặt, KHỚP ở đúng vòng sau', () => {
    const st = ban([ghe('a', ['vang'], ['phong_ho'])], o8, { vong: 3 });
    const dat = apDatShort(st, 'a', 'btc').st;
    expect(shortKhopO(gheCua(dat, 'a'), 3), 'vòng đặt: chưa khớp').toBeNull();
    const cNay = dungChuoi(dat, gheCua(dat, 'a'), oCua(dat));
    expect(co(cNay.chain, 'short'), 'vòng đặt KHÔNG được có mắt xích short').toBe(false);

    const sau = { ...dat, vong: 4 };
    expect(shortKhopO(gheCua(sau, 'a'), 4)).toBeTruthy();
    const cSau = dungChuoi(sau, gheCua(sau, 'a'), oCua(sau));
    const m = cSau.chain.find((x) => x.kind === 'short');
    expect(m, 'vòng sau PHẢI khớp').toBeTruthy();
    if (m?.kind === 'short') {
      expect(m.ma).toBe('btc');
      expect(m.vong_dat).toBe(3);
      // Trần hai chiều — một lệnh không được tự quyết cả vòng.
      expect(Math.abs(m.nghich_dao_bp)).toBeLessThanOrEqual(DAC_QUYEN.PHONG_HO.TRAN_BP);
    }
  });

  it('ăn NGƯỢC chiều với việc nắm giữ — kể cả nhiễu (phòng hộ thật, không phải canh bạc thứ hai)', () => {
    const o = [gd('giam'), gd('tang'), gd('tang')];
    // `tang` là ô tốt cho BTC ⇒ short BTC ở vòng đó phải ĂN ÂM phần lõi.
    const st = ban([ghe('a', ['vang'], ['phong_ho'])], o, { vong: 1 });
    const dat = apDatShort(st, 'a', 'btc').st;
    const sau = { ...dat, vong: 2 };
    const m = dungChuoi(sau, gheCua(sau, 'a'), oCua(sau)).chain
      .find((x) => x.kind === 'short');

    // Cùng ô, cùng seed, cùng vòng: ghế NẮM btc ăn bao nhiêu thì short phải
    // ngược dấu — so DẤU chứ không so số, vì short còn có hệ số và phí.
    const nam = ban([ghe('b', ['btc'])], o, { vong: 2 });
    const pnlNam = dungChuoi(nam, gheCua(nam, 'b'), oCua(nam)).pnl_bp;
    if (m?.kind === 'short' && pnlNam !== 0) {
      expect(Math.sign(m.nghich_dao_bp)).toBe(-Math.sign(pnlNam));
    }
  });

  it('khớp xong thì DỌN — không để lại vị thế ma ở các vòng sau', () => {
    const st = ban([ghe('a', ['vang'], ['phong_ho']), ghe('b', ['vang'])], o8, { vong: 3 });
    const dat = apDatShort(st, 'a', 'btc').st;
    const sau = chotPhien({ ...dat, vong: 4 }, choiVongCuoc({ ...dat, vong: 4 }, THEO));
    expect(sau.trangThai.ghe.find((g) => g.id === 'a')!.short).toBeUndefined();
  });
});

// ---------------------------------------------------------------------------
// 4. ĐA DẠNG HOÁ — trần thẻ mỗi vòng
// ---------------------------------------------------------------------------

describe('4. ĐA DẠNG HOÁ — "2 tài sản một vòng thay vì 1"', () => {
  const shop = bayShop(4242, 1, 'ban', 0, { tai_san: [], chien_thuat: [] });
  const rong = { tai_san: [] as string[], chien_thuat: [] as ChienThuatId[] };

  it('KHÔNG có đặc quyền: gửi 2 lá tài sản thì chỉ vào 1', () => {
    const r = muaCaVong(rong, shop, shop.tai_san.slice(0, 2),
      { tai_san: 1, chien_thuat: 1 });
    expect(r.danh_muc.tai_san).toHaveLength(1);
    expect(r.bo_qua.map((x) => x.loi)).toContain('qua_tran');
  });

  it('CÓ đặc quyền: đúng hai lá vào, lá thứ ba vẫn bị chặn', () => {
    const tran = { tai_san: DAC_QUYEN.DA_DANG_HOA.TAI_SAN_MOI_VONG, chien_thuat: 1 };
    const hai = muaCaVong(rong, shop, shop.tai_san.slice(0, 2), tran);
    expect(hai.danh_muc.tai_san).toHaveLength(2);
    expect(hai.bo_qua).toHaveLength(0);
    const ba = muaCaVong(rong, shop, shop.tai_san.slice(0, 3), tran);
    expect(ba.danh_muc.tai_san).toHaveLength(tran.tai_san);
  });

  it('trần CHIẾN THUẬT không bị đặc quyền tài sản nới theo', () => {
    const r = muaCaVong(rong, shop, shop.chien_thuat.slice(0, 2),
      { tai_san: 2, chien_thuat: 1 });
    expect(r.danh_muc.chien_thuat).toHaveLength(1);
  });

  it('`KHONG_TRAN` dựng lại HÀNH VI CŨ — trận đã lưu không bị siết ngược', () => {
    const r = muaCaVong(rong, shop, [...shop.tai_san.slice(0, 2)], KHONG_TRAN);
    expect(r.danh_muc.tai_san).toHaveLength(2);
    expect(r.bo_qua).toHaveLength(0);
  });

  it('thẻ vượt trần bị BỎ QUA, không làm hỏng cả lượt', () => {
    const r = muaCaVong(rong, shop,
      [shop.tai_san[0]!, shop.tai_san[1]!, shop.chien_thuat[0]!],
      { tai_san: 1, chien_thuat: 1 });
    expect(r.danh_muc.tai_san).toHaveLength(1);
    expect(r.danh_muc.chien_thuat, 'lá chiến thuật vẫn phải vào').toHaveLength(1);
  });
});

// ---------------------------------------------------------------------------
// 5. D34 — NHỊP CHỌN THẺ VÀ GATE ALL-IN
// ---------------------------------------------------------------------------

describe('5. D34 — All-in chỉ mở sau khi chốt đủ 3 thẻ chiến thuật', () => {
  it('đếm theo Ô, không theo lá: ba bản của một thẻ KHÔNG phải "đã chọn xong"', () => {
    const st = ban([ghe('a', ['btc'], ['chan_lo', 'chan_lo', 'chan_lo'])], [gd('tang')]);
    expect(soOChienThuat(gheCua(st, 'a'))).toBe(1);
    expect(allInMoCho(st, gheCua(st, 'a'))).toBe(false);
    expect(allInDaMo(SO_THE_CHIEN_THUAT)).toBe(true);
    expect(allInDaMo(SO_THE_CHIEN_THUAT - 1)).toBe(false);
  });

  it('trận CŨ (cổng tắt) KHÔNG bị áp luật mới — nó đã đánh xong bằng luật khác', () => {
    const cu = ban([ghe('a', ['btc'])], [gd('tang')], { dacQuyen: false });
    expect(allInMoCho(cu, gheCua(cu, 'a'))).toBe(true);
  });

  it('chưa đủ 3 thẻ ⇒ KHÔNG tố được về 0 Vốn, nhưng VẪN tố được', () => {
    const chua = ban([ghe('a', ['btc'], ['chan_lo']), ghe('b', ['vang'])],
      [gd('tang'), gd('tang')]);
    const du = ban([
      ghe('a', ['btc'], ['chan_lo', 'phong_ho', 'khop_nhanh']), ghe('b', ['vang']),
    ], [gd('tang'), gd('tang')]);

    /** Ghế `a` luôn tố hết mức được phép; `b` theo. */
    const donHet = (st: TrangThaiTran) => {
      const tt = choiVongCuoc(st, (x) => (
        x.ghe_id === 'a' && x.duoc.includes('to')
          ? { loai: 'to' as const, them: x.to_toi_da } : THEO()));
      return tt.gop.get('a') ?? 0;
    };
    const gopChua = donHet(chua);
    const gopDu = donHet(du);
    expect(gopChua, 'vẫn phải tố được — cấm hẳn là "ba nút không hậu quả"')
      .toBeGreaterThan(0);
    expect(gopChua, 'nhưng KHÔNG dồn được tới hết').toBeLessThan(gopDu);
  });

  it('chưa đủ 3 thẻ thì chốt phiên KHÔNG gán tư thế all_in', () => {
    const st = ban([ghe('a', ['btc'], ['chan_lo']), ghe('b', ['vang'])],
      [gd('tang'), gd('tang')]);
    const r = giaiQuyetVong(st, (x) => (
      x.ghe_id === 'a' && x.duoc.includes('to')
        ? { loai: 'to' as const, them: x.to_toi_da } : THEO()));
    expect(r.trangThai.ghe.find((g) => g.id === 'a')!.tu_the).not.toBe('all_in');
  });
});

// ---------------------------------------------------------------------------
// 6. LƯỚT SÓNG — ba hạng bảng + dự báo, bất biến 6
// ---------------------------------------------------------------------------

describe('6. LƯỚT SÓNG — bảng SẠCH và ba hạng giá', () => {
  const o = [sk('hack_san'), gd('giam'), gd('tang'), gd('di_ngang')];

  it('ba hạng giá đi theo ĐÚNG một cửa (`giaMoBang`), và nấc dự báo ĐẮT HƠN hạng thường', () => {
    expect(giaMoBang(true, false)).toBeLessThan(giaMoBang(false, false));
    expect(giaMoBang(true, true)).toBeGreaterThan(giaMoBang(false, false));
    // Phí thực thu phải đọc chính bảng giá đó, không có bảng thứ hai.
    expect(phiMoBang(99999, 1, { luot_song: true, du_bao: true }))
      .toBe(giaMoBang(true, true));
    expect(phiMoBang(99999, 1, HANG_BANG_THUONG)).toBe(BANG_DIEN_TU.PHI_MO);
  });

  it('`hangBangCua`: không cầm Lướt Sóng thì KHÔNG mua được nấc dự báo', () => {
    const khong = ban([ghe('ban', ['btc'])], o, { vong: 2 });
    // `toMatchObject` chứ không `toEqual`: hạng bảng có thể MỌC trường (22/08 thêm
    // `cap2`), khoá nguyên văn là khoá HÌNH DẠNG chứ không khoá hành vi (D80).
    expect(hangBangCua(khong, 'ban', true)).toMatchObject({ luot_song: false, du_bao: false });
    const co1 = ban([ghe('ban', ['btc'], ['luot_song'])], o, { vong: 2 });
    expect(hangBangCua(co1, 'ban', true)).toMatchObject({ luot_song: true, du_bao: true, cap2: false });
    // Hai bản ⇒ CẤP 2 (vai đội lái, 22/08).
    const co2 = ban([ghe('ban', ['btc'], ['luot_song', 'luot_song'])], o, { vong: 2 });
    expect(hangBangCua(co2, 'ban', false).cap2).toBe(true);
    expect(hangBangCua(co1, 'ban', false).du_bao).toBe(false);
    // Cổng tắt ⇒ không có đặc quyền nào, dù cầm thẻ.
    const tat = ban([ghe('ban', ['btc'], ['luot_song'])], o, { vong: 2, dacQuyen: false });
    expect(hangBangCua(tat, 'ban', true).luot_song).toBe(false);
  });

  it('hạng SẠCH gỡ ĐÚNG hai lớp che: sương mù và độ trễ', () => {
    const st = ban([ghe('ban', ['btc', 'vang'], ['luot_song'])], o, { vong: 3 });
    const ban1 = dungBangDienTu(st, 'ban', HANG_BANG_THUONG);
    const sach = dungBangDienTu(st, 'ban', { luot_song: true, du_bao: false });

    // Sương mù: mã trong danh sách che không có `nac` ở hạng thường.
    const mu = ban1.thanh_khoan.find((t) => BANG_DIEN_TU.MA_SUONG_MU.includes(t.tai_san_id));
    expect(mu?.nac, 'hạng thường: BTC bị sương mù').toBeNull();
    const ro = sach.thanh_khoan.find((t) => t.tai_san_id === mu?.tai_san_id);
    expect(ro?.nac, 'hạng sạch: hết sương mù').not.toBeNull();

    // Độ trễ: hạng thường che ít nhất một dòng sổ cái; hạng sạch thì không.
    expect(sach.so_dong_chua_ro).toBe(0);
    expect(ban1.so_dong_chua_ro).toBeGreaterThanOrEqual(sach.so_dong_chua_ro);
    expect(sach.sach).toBe(true);
  });

  it('KHÔNG bán cờ tin giả — hạng sạch vẫn giả định tin là THẬT', () => {
    // Thiên nga đen là sự kiện CÓ đụng thanh khoản, nên nó là ca duy nhất mà
    // `gia_dinh_tin_that` bật — dùng một sự kiện không đụng thanh khoản thì test
    // đo nhầm sang nhánh "không có giả định nào để mà nói".
    const stGia = ban([ghe('ban', ['btc'])],
      [sk('thien_nga_den', true), gd('giam')], { vong: 1 });
    const sach = dungBangDienTu(stGia, 'ban', { luot_song: true, du_bao: true });
    expect(sach.gia_dinh_tin_that, 'ranh giới thông tin ẩn không lá nào mua được')
      .toBe(true);
  });
});

describe('7. DỰ BÁO 3 TÊN — "biết hẹp hơn", không phải "biết trước"', () => {
  const khoaO = (o: OThiTruong) =>
    (o.kind === 'su_kien' ? `sk:${o.su_kien}` : `gd:${o.giai_doan}`);
  /**
   * ⚠ TÊN GỬI RA DÙNG `kind` DÀI (`giai_doan`/`su_kien`), còn bảng xếp hạng dùng
   * khoá NGẮN (`gd:`/`sk:`). Bản đầu của test so thẳng hai chuỗi đó và ra tỷ lệ
   * trúng 0% — trông y hệt "chèn tên sai mạnh quá", trong khi thật ra là test tự
   * so hai bảng chữ khác nhau. Giữ hàm quy đổi này ở một chỗ.
   */
  const khoaTen = (t: { kind: string; id: string }) =>
    `${t.kind === 'su_kien' ? 'sk' : 'gd'}:${t.id}`;

  /** Một bàn thật, map SINH RA từ seed (không dàn tay) — đúng phân bố của trận. */
  function banThat(seed: number, vong: number): TrangThaiTran {
    const st = taoTran(seed, [ghe('ban', ['btc'], ['luot_song'])],
      { luatVon: true, dacQuyen: true });
    return { ...st, map: sinhMap(seed, HOLDEM_DECISIONS.MAP_SIZE), vong };
  }

  it('đúng SO_TEN tên, không trùng nhau, không mua thì không có', () => {
    const st = banThat(101, 2);
    const d = dungDuBao(st)!;
    expect(d.ten).toHaveLength(DAC_QUYEN.LUOT_SONG.SO_TEN);
    expect(new Set(d.ten.map(khoaTen)).size).toBe(d.ten.length);
    expect(d.vong).toBe(st.vong + 1);
    expect(d.so_ten_sai).toBe(DAC_QUYEN.LUOT_SONG.SO_TEN_SAI);
    // Không mua nấc +30 thì bảng KHÔNG kèm dự báo.
    expect(dungBangDienTu(st, 'ban', { luot_song: true, du_bao: false }).du_bao).toBeNull();
    expect(dungBangDienTu(st, 'ban', { luot_song: true, du_bao: true }).du_bao).toBeTruthy();
  });

  it('vòng CUỐI không có ô sau ⇒ không dự báo (không bịa một vòng không tồn tại)', () => {
    const st = banThat(101, HOLDEM_DECISIONS.MAP_SIZE);
    expect(dungDuBao(st)).toBeNull();
  });

  it('tất định: cùng (seed, vòng) ra đúng danh sách đó — replay không đổi', () => {
    const a = dungDuBao(banThat(777, 3))!;
    const b = dungDuBao(banThat(777, 3))!;
    expect(a.ten.map((t) => t.id)).toEqual(b.ten.map((t) => t.id));
  });

  it('🔴 TỶ LỆ TRÚNG THẤP HƠN HẲN TOP-3 THÔ — chỗ chèn tên sai có chạy thật', () => {
    /*
     * ⚠ ĐÂY LÀ TEST QUAN TRỌNG NHẤT CỦA CỤM LƯỚT SÓNG, và nó là phép ĐO chứ
     * không phải phép ghim: nếu ai đó gỡ vòng lặp chèn tên sai thì danh sách trở
     * thành top-3 thuần và hai con số bằng nhau. Không có test này thì phương án
     * A hỏng IM LẶNG — bảng vẫn hiện ba tên, vẫn thu 110 Vốn, chỉ là mạnh hơn
     * hẳn thứ founder chốt.
     */
    let trungDuBao = 0;
    let trungTop3 = 0;
    let n = 0;
    for (let s = 1; s <= 400; s += 1) {
      for (let v = 1; v < HOLDEM_DECISIONS.MAP_SIZE; v += 1) {
        const st = banThat(s * 2654435761, v);
        const d = dungDuBao(st);
        if (!d) continue;
        const that = khoaO(st.map.o[v]!);
        n += 1;
        if (d.ten.some((t) => khoaTen(t) === that)) trungDuBao += 1;
        if (xepHangUngVien(st).slice(0, 3).some((x) => x.key === that)) trungTop3 += 1;
      }
    }
    expect(n).toBeGreaterThan(1000);
    const pDuBao = trungDuBao / n;
    const pTop3 = trungTop3 / n;
    expect(pTop3, 'top-3 thô phải trúng đáng kể — nếu không thì bảng xếp hạng vô dụng')
      .toBeGreaterThan(0.35);
    expect(pDuBao, 'chèn tên sai PHẢI hạ tỷ lệ trúng xuống thấp hơn hẳn')
      .toBeLessThan(pTop3 - 0.05);
    expect(pDuBao, 'nhưng vẫn phải đáng tiền — không được rơi về mức đoán mò')
      .toBeGreaterThan(0.2);
  });

  it('xếp hạng ứng viên KHÔNG rò cờ tin giả (gate G4 không mua được)', () => {
    /*
     * Cùng một ô sự kiện, chỉ khác cờ `la_tin_gia` ⇒ bảng xếp hạng phải GIỐNG
     * HỆT. Khác nhau nghĩa là người trả 110 Vốn đọc ra được tin nào bịa — đúng
     * câu trả lời mà cả cơ chế map dựng ra để đo.
     */
    const lam = (gia: boolean) => {
      const st = banThat(31337, 2);
      return xepHangUngVien({
        ...st,
        map: { ...st.map, o: [gd('tang'), sk('hack_san', gia), gd('giam'), gd('tang')] },
      }).map((x) => `${x.key}:${x.w}`);
    };
    expect(lam(true)).toEqual(lam(false));
  });
});
