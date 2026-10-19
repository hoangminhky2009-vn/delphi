/**
 * LÕI HAI CƠ CHẾ VỐN (founder 27/07) — ĐẢO DANH MỤC + KHOÁ TÀI SẢN 2 VÒNG.
 *
 * Viết TRƯỚC engine (A8.3: phần đụng tiền thì test đi trước). Mọi khẳng định ở
 * đây là KHOẢNG hoặc QUAN HỆ, không phải `toBe(hằng_số)` — chép lại hằng số vào
 * test thì test không kiểm gì cả, nó chỉ nhắc lại config.
 *
 * ─── NĂM BẤT BIẾN, mất cái nào là hỏng thứ khác hẳn nhau ───────────────────
 *
 * 1. CỔNG PHIÊN BẢN THẬT. `luat_von` tắt ⇒ engine chạy y hệt bản cũ, tới từng
 *    bp, KỂ CẢ khi ghế đã mang sẵn `dao`/`khoa`. Mất cái này là mọi trận đã lưu
 *    replay ra kết quả khác — im lặng, không lỗi, lịch sử hỏng vĩnh viễn.
 *
 * 2. ĐẢO KHÔNG PHẢI ĐƯỜNG NÉ TRƯỢT GIÁ. Đây là chữ founder gạch chân: chỉ trừ
 *    phí mà không cho vào hàng chờ khớp lệnh thì đảo danh mục thành cửa thoát
 *    crowding, và CẢ LỚP trượt giá mất tác dụng. Nên phải chứng minh người vừa
 *    đảo vào mã B trả NHIỀU HƠN người đã ôm B từ trước, cùng một danh mục.
 *
 * 3. HÀNG CHỜ ĐẾM CẢ NGƯỜI MUA MỚI. Nếu chỉ người đảo mới phải xếp hàng thì
 *    "xếp hàng CÙNG những người mua mới" là nói suông, và người mua thẳng lại
 *    rẻ hơn người đảo ở đúng cùng một lệnh mua.
 *
 * 4. THU HỒI THƯỞNG PHẢI CÓ TÍCH LUỸ THẬT. Bẻ kèo mà `thu_hoi_bp` luôn bằng 0
 *    thì cơ chế chỉ là −600bp đổi tên. Test chạy TRỌN chu kỳ 2 vòng qua
 *    `giaiQuyetVong` để bắt đúng lỗi "code có mà không đường chạy nào gọi"
 *    (bẫy 1 — đã dính 6 lần trong repo này).
 *
 * 5. GIAM VỐN PHẢI CHẶN ĐƯỢC NÚT. Trạng thái `giam_von_den_vong` mà không ai
 *    đọc thì nó là chú thích, không phải hình phạt. Test soi thẳng danh sách
 *    `duoc` mà vòng cược trao cho ghế đó.
 */
import { describe, expect, it } from 'vitest';
import {
  apDaoDanhMuc, apKhoaTaiSan, biGiamVon, chotPhien, choiVongCuoc, demVaoMoi,
  dungChuoi, giaiQuyetVong, khoaDangChay, nhanhHeQua, taoTran, vaoMoiCua,
  type Ghe, type GheMoi, type MatXich, type TrangThaiTran,
} from '../server/holdem/engine.js';
import type { OThiTruong } from '../server/holdem/map.js';
import {
  DAO_DANH_MUC, HOLDEM_MATCH, KHOA_TAI_SAN, SU_KIEN, TRUYEN_NHAN_QUA, luatCua,
  type GiaiDoanId,
} from '../config/holdem.js';

// ---------------------------------------------------------------------------
// Đồ nghề
// ---------------------------------------------------------------------------

function ghe(id: string, taiSan: string[], chienThuat: string[] = []): GheMoi {
  return {
    id, loai: 'bot', bac_rank: 'Đồng',
    danh_muc: { tai_san: taiSan, chien_thuat: chienThuat as never },
  };
}

const gd = (id: GiaiDoanId): OThiTruong => ({ kind: 'giai_doan', giai_doan: id });

/**
 * Bàn có MAP DÀN SẴN — mọi test cân bằng phải cô lập được giai đoạn, nếu không
 * thì thắng/thua đến từ ô ngẫu nhiên chứ không từ cơ chế đang đo.
 */
function ban(
  ghes: readonly GheMoi[],
  o: readonly OThiTruong[],
  opt: { vong?: number; truoc?: Record<string, string[]>; luat?: boolean } = {},
): TrangThaiTran {
  const st = taoTran(4242, ghes, { luatVon: opt.luat ?? true });
  return {
    ...st,
    map: { ...st.map, o },
    vong: opt.vong ?? 1,
    ...(opt.truoc ? { tai_san_truoc: opt.truoc } : {}),
  };
}

const THEO = () => ({ loai: 'theo' as const });
const oCua = (st: TrangThaiTran) => st.map.o[st.vong - 1]!;
const gheCua = (st: TrangThaiTran, id: string): Ghe => st.ghe.find((g) => g.id === id)!;

/** Tổng delta của mọi mắt xích một loại (0 nếu không có). */
function tong(chain: readonly MatXich[], kind: MatXich['kind']): number {
  return chain.filter((m) => m.kind === kind).reduce((s, m) => s + m.delta_bp, 0);
}
const co = (chain: readonly MatXich[], kind: MatXich['kind']) =>
  chain.some((m) => m.kind === kind);

// ---------------------------------------------------------------------------
// 0. CỔNG PHIÊN BẢN — bất biến số 1
// ---------------------------------------------------------------------------

describe('0. CỔNG PHIÊN BẢN — trận cũ phải replay ra ĐÚNG kết quả cũ', () => {
  it('bảng tra `luatCua` biết phiên bản nào bật luật vốn, phiên bản nào không', () => {
    const cu = luatCua('balance-v5-D30-camket');
    const moi = luatCua('balance-v6-luatvon');
    expect(cu.luatVon).toBe(false);
    expect(moi.luatVon).toBe(true);
    // Bản v5 KHÔNG được mất `botTuQuyetCamKet` chỉ vì có bản mới ra đời — đó
    // chính là lỗi của phép so `=== HOLDEM_BALANCE_VERSION`.
    expect(cu.botTuQuyetCamKet).toBe(true);
    expect(moi.botTuQuyetCamKet).toBe(true);
  });

  it('phiên bản lạ / thiếu ⇒ tắt hết, không đoán bừa', () => {
    expect(luatCua(undefined).luatVon).toBe(false);
    expect(luatCua('balance-v1-khong-ton-tai').luatVon).toBe(false);
  });

  it('luật TẮT ⇒ chuỗi chấm điểm giống hệt bản không có trường mới, từng bp', () => {
    const o = [gd('tang'), gd('giam')];
    const truoc = { a: ['btc'], b: ['btc'], c: ['btc'] };
    const goc = ban([ghe('a', ['vang']), ghe('b', ['vang']), ghe('c', ['vang'])],
      o, { vong: 2, truoc, luat: false });
    // Nhét sẵn trạng thái của CẢ HAI cơ chế vào ghế — nếu cổng hở, chúng sẽ
    // sinh mắt xích và số sẽ lệch.
    const banA = {
      ...goc,
      ghe: goc.ghe.map((g) => (g.id === 'a'
        ? {
          ...g,
          dao: { vong: 2, tu: 'btc', den: 'vang' },
          khoa: { ma: 'vang', vong_bat_dau: 2, thuong_bp: 900 },
        }
        : g)),
    };
    const sach = dungChuoi(goc, gheCua(goc, 'a'), oCua(goc));
    const ban2 = dungChuoi(banA, gheCua(banA, 'a'), oCua(banA));
    expect(ban2.pnl_bp).toBe(sach.pnl_bp);
    expect(ban2.chain).toEqual(sach.chain);
  });

  it('luật TẮT ⇒ hai hàm áp hành động đều từ chối, không âm thầm bỏ qua', () => {
    const st = ban([ghe('a', ['btc'])], [gd('tang'), gd('tang')],
      { vong: 2, luat: false });
    expect(apDaoDanhMuc(st, 'a', 'btc', 'vang').loi).toBe('luat_tat');
    expect(apKhoaTaiSan(st, 'a', 'btc').loi).toBe('luat_tat');
  });
});

// ---------------------------------------------------------------------------
// A. ĐẢO DANH MỤC
// ---------------------------------------------------------------------------

describe('A1. Đảo danh mục — luật vào lệnh', () => {
  const o = [gd('tang'), gd('tang'), gd('tang'), gd('tang')];

  it('vòng 1 chưa đảo được — chưa cầm gì để mà bán', () => {
    const st = ban([ghe('a', ['btc'])], o, { vong: 1 });
    expect(st.vong).toBeLessThan(DAO_DANH_MUC.TU_VONG);
    expect(apDaoDanhMuc(st, 'a', 'btc', 'vang').loi).toBe('chua_toi_vong');
  });

  it('đảo thay ĐÚNG MỘT bản sao, không phải quét sạch mã đó', () => {
    const st = ban([ghe('a', ['btc', 'btc'])], o, { vong: 2 });
    const r = apDaoDanhMuc(st, 'a', 'btc', 'vang');
    expect(r.ok).toBe(true);
    const ts = gheCua(r.st, 'a').danh_muc.tai_san;
    expect(ts.filter((x) => x === 'btc')).toHaveLength(1);
    expect(ts.filter((x) => x === 'vang')).toHaveLength(1);
  });

  it('không cầm mã nguồn / mã đích không tồn tại / đảo vào chính nó → từ chối', () => {
    const st = ban([ghe('a', ['btc'])], o, { vong: 2 });
    expect(apDaoDanhMuc(st, 'a', 'vang', 'btc').loi).toBe('khong_nam_ma');
    expect(apDaoDanhMuc(st, 'a', 'btc', 'khong_co_that').loi).toBe('ma_khong_ton_tai');
    expect(apDaoDanhMuc(st, 'a', 'btc', 'btc').loi).toBe('trung_ma');
  });

  it('mỗi vòng đúng MỘT lần đảo — không xoay vòng danh mục miễn phí', () => {
    const st = ban([ghe('a', ['btc', 'cp_cn'])], o, { vong: 2 });
    const r1 = apDaoDanhMuc(st, 'a', 'btc', 'vang');
    expect(r1.ok).toBe(true);
    expect(apDaoDanhMuc(r1.st, 'a', 'cp_cn', 'usd').loi).toBe('da_dao_vong_nay');
  });

  it('không lách được trần bản sao bằng đường đảo', () => {
    const day = Array.from({ length: HOLDEM_MATCH.MAX_TAI_SAN }, () => 'vang');
    const st = ban([ghe('a', [...day, 'btc'])], o, { vong: 2 });
    expect(apDaoDanhMuc(st, 'a', 'btc', 'vang').loi).toBe('da_toi_da_ban_sao');
  });

  it('thẻ đang GẮN vào mã bị bán thì chuyển sang mã mới, không thành thẻ chết', () => {
    const st0 = ban([ghe('a', ['btc'], ['khop_nhanh'])], o, { vong: 2 });
    const st = {
      ...st0,
      ghe: st0.ghe.map((g) => ({ ...g, danh_muc: { ...g.danh_muc, gan: { khop_nhanh: 'btc' } } })),
    };
    const r = apDaoDanhMuc(st, 'a', 'btc', 'vang');
    expect(r.ok).toBe(true);
    expect(gheCua(r.st, 'a').danh_muc.gan?.khop_nhanh).toBe('vang');
  });
});

describe('A2. Hàng chờ khớp lệnh — bất biến 2 và 3', () => {
  const o = [gd('di_ngang'), gd('di_ngang'), gd('di_ngang'), gd('di_ngang')];

  /** Ba ghế cùng nhảy vào `vang` ở vòng 2; ghế `d` đã ôm `vang` từ vòng 1. */
  function banVao(soVao: number): TrangThaiTran {
    const ghes: GheMoi[] = [];
    for (let i = 0; i < soVao; i += 1) ghes.push(ghe(`v${i}`, ['vang']));
    ghes.push(ghe('cu', ['vang']));
    const truoc: Record<string, string[]> = { cu: ['vang'] };
    for (let i = 0; i < soVao; i += 1) truoc[`v${i}`] = ['btc'];
    return ban(ghes, o, { vong: 2, truoc });
  }

  it('người MUA MỚI (không đảo) vẫn phải xếp hàng — hàng chờ không chỉ dành cho người đảo', () => {
    const st = banVao(3);
    expect(demVaoMoi(st).vang).toBe(3);
    const c = dungChuoi(st, gheCua(st, 'v0'), oCua(st)).chain;
    expect(tong(c, 'xep_hang')).toBeLessThan(0);
  });

  it('ghế đã ôm mã từ vòng trước KHÔNG xếp hàng — chỉ dòng tiền MỚI mới đẩy giá', () => {
    const st = banVao(3);
    expect(vaoMoiCua(st, gheCua(st, 'cu')).has('vang')).toBe(false);
    const c = dungChuoi(st, gheCua(st, 'cu'), oCua(st)).chain;
    expect(co(c, 'xep_hang')).toBe(false);
  });

  it('một mình vào thì không có hàng — hàng chờ cần ít nhất hai người tranh fill', () => {
    const st = banVao(1);
    expect(DAO_DANH_MUC.NGUONG_XEP_HANG).toBeGreaterThanOrEqual(2);
    const c = dungChuoi(st, gheCua(st, 'v0'), oCua(st)).chain;
    expect(co(c, 'xep_hang')).toBe(false);
  });

  it('càng đông cùng vào một mã, hàng chờ càng đắt (đơn điệu)', () => {
    const phat = [2, 3, 4].map((n) => {
      const st = banVao(n);
      return -tong(dungChuoi(st, gheCua(st, 'v0'), oCua(st)).chain, 'xep_hang');
    });
    expect(phat[0]!).toBeGreaterThan(0);
    expect(phat[1]!).toBeGreaterThan(phat[0]!);
    expect(phat[2]!).toBeGreaterThan(phat[1]!);
  });

  it('sổ lệnh DÀY nuốt được dòng tiền mới; sổ MỎNG thì không', () => {
    const dung = (ma: string) => {
      const ghes = [ghe('x', [ma]), ghe('y', [ma]), ghe('z', [ma])];
      const st = ban(ghes, o, {
        vong: 2, truoc: { x: ['tpcp'], y: ['tpcp'], z: ['tpcp'] },
      });
      return -tong(dungChuoi(st, gheCua(st, 'x'), oCua(st)).chain, 'xep_hang');
    };
    expect(dung('btc')).toBeGreaterThan(dung('vn30'));   // mỏng > dày
  });

  /**
   * ĐÂY LÀ TEST QUAN TRỌNG NHẤT CỦA CỤM A. Founder gạch chân đúng chỗ này:
   * chỉ trừ phí mà không cho vào hàng thì đảo danh mục thành cửa thoát crowding.
   */
  it('BẤT BIẾN 2 — người vừa ĐẢO vào mã B trả nhiều hơn người đã ôm B từ trước', () => {
    const ghes = [ghe('dao', ['vang']), ghe('vao', ['vang']), ghe('cu', ['vang'])];
    const st0 = ban(ghes, o, {
      vong: 2, truoc: { dao: ['btc'], vao: ['btc'], cu: ['vang'] },
    });
    const st = {
      ...st0,
      ghe: st0.ghe.map((g) => (g.id === 'dao'
        ? { ...g, dao: { vong: 2, tu: 'btc', den: 'vang' } } : g)),
    };
    const p = (id: string) => dungChuoi(st, gheCua(st, id), oCua(st)).pnl_bp;
    // Ba ghế có danh mục Y HỆT NHAU ở vòng này — chênh lệch duy nhất là đường vào.
    expect(p('dao')).toBeLessThan(p('vao'));   // đảo tốn thêm phí chuyển đổi
    expect(p('vao')).toBeLessThan(p('cu'));    // vào mới tốn thêm hàng chờ
  });

  it('đảo vào mã ĐANG CẦM (gom thêm) vẫn phải xếp hàng — không có cửa sau', () => {
    const ghes = [ghe('a', ['vang', 'vang']), ghe('b', ['vang']), ghe('c', ['vang'])];
    const st0 = ban(ghes, o, {
      vong: 2, truoc: { a: ['vang', 'btc'], b: ['btc'], c: ['btc'] },
    });
    const st = {
      ...st0,
      ghe: st0.ghe.map((g) => (g.id === 'a'
        ? { ...g, dao: { vong: 2, tu: 'btc', den: 'vang' } } : g)),
    };
    expect(vaoMoiCua(st, gheCua(st, 'a')).has('vang')).toBe(true);
    expect(co(dungChuoi(st, gheCua(st, 'a'), oCua(st)).chain, 'xep_hang')).toBe(true);
  });

  it('phí chuyển đổi là mắt xích RIÊNG, âm, và chỉ có ở đúng vòng đảo', () => {
    const st0 = ban([ghe('a', ['vang'])], o, { vong: 2, truoc: { a: ['btc'] } });
    const st = {
      ...st0,
      ghe: st0.ghe.map((g) => ({ ...g, dao: { vong: 2, tu: 'btc', den: 'vang' } })),
    };
    expect(tong(dungChuoi(st, gheCua(st, 'a'), oCua(st)).chain, 'dao_phi'))
      .toBeLessThan(0);
    // Sang vòng sau, phí không được thu lại lần nữa.
    const sau = { ...st, vong: 3 };
    expect(co(dungChuoi(sau, gheCua(sau, 'a'), oCua(sau)).chain, 'dao_phi')).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// B. KHOÁ TÀI SẢN 2 VÒNG
// ---------------------------------------------------------------------------

describe('B1. Khoá — luật bật khoá', () => {
  const o = [gd('giam'), gd('giam'), gd('giam'), gd('giam'), gd('giam'), gd('giam')];

  /*
   * ⚠ ĐỔI CHIỀU 27/07. Cổng cũ là "chỉ ở vòng CHỌN TÀI SẢN"; cổng đó đứng trên
   * hai chân và chỉ MỘT chân còn đúng sau spec 01:
   *   (a) chữ founder "khi chọn tài sản đầu vòng" — hết nghĩa, vì chợ tài sản
   *       nay mở ở MỌI vòng nên không còn "vòng chọn tài sản" riêng;
   *   (b) chu kỳ khoá phải kịp chốt trước khi hết map — VẪN đúng, và nếu mất thì
   *       `laVongChotKhoa` không bao giờ nổ ⇒ thưởng sống sót lẫn phạt bẻ kèo
   *       đều câm. Đúng lớp lỗi "nhánh có mà không có đường chạy".
   * Nay cổng kiểm THẲNG (b) — xem `khoaKipChot`.
   */
  it('bật được ở vòng bất kỳ MIỄN LÀ chu kỳ kịp chốt, và phải đang cầm mã đó', () => {
    const v1 = ban([ghe('a', ['btc'])], o, { vong: 1 });
    expect(apKhoaTaiSan(v1, 'a', 'btc').ok).toBe(true);
    expect(apKhoaTaiSan(v1, 'a', 'vang').loi).toBe('khong_nam_ma');

    // Vòng 3 là vòng CHIẾN THUẬT — cổng cũ chặn, cổng mới cho qua.
    const v3 = ban([ghe('a', ['btc'])], o, { vong: 3 });
    expect(apKhoaTaiSan(v3, 'a', 'btc').ok, 'vòng chiến thuật vẫn khoá được').toBe(true);
  });

  it('vòng CUỐI thì KHÔNG — chu kỳ không còn chỗ nghiệm thu', () => {
    const cuoi = ban([ghe('a', ['btc'])], o, { vong: o.length });
    expect(apKhoaTaiSan(cuoi, 'a', 'btc').loi).toBe('sai_nhip_vong');
    // Vòng ngay trước đó thì vừa đủ (SO_VONG = 2 ⇒ phủ vòng cuối).
    const vuaDu = ban([ghe('a', ['btc'])], o, { vong: o.length - KHOA_TAI_SAN.SO_VONG + 1 });
    expect(apKhoaTaiSan(vuaDu, 'a', 'btc').ok).toBe(true);
  });

  it('chu kỳ khoá phủ đúng SO_VONG vòng liên tiếp rồi hết hiệu lực', () => {
    const st = ban([ghe('a', ['btc'])], o, { vong: 1 });
    const g = gheCua(apKhoaTaiSan(st, 'a', 'btc').st, 'a');
    for (let v = 1; v < 1 + KHOA_TAI_SAN.SO_VONG; v += 1) {
      expect(khoaDangChay(g, v)).not.toBeNull();
    }
    expect(khoaDangChay(g, 1 + KHOA_TAI_SAN.SO_VONG)).toBeNull();
  });

  it('đang trong chu kỳ thì không chồng thêm khoá mới', () => {
    /*
     * ⚠ MAP ĐỦ 8 Ô, và khoá bật ở VÒNG 5 chứ không phải vòng 1.
     *
     * Từ D34 nhịp là [ts, ct, ct, ct, ts, ts, khong, khong] ở map 8, nên hai
     * vòng tài sản LIỀN NHAU duy nhất là 5 và 6 — mà "chồng khoá" chỉ kiểm được
     * ở một vòng vừa nằm trong chu kỳ (dài `SO_VONG`) vừa là vòng tài sản. Đặt
     * ở vòng 1 như bản cũ thì vòng 2 nay là vòng chiến thuật và test đo nhầm
     * `sai_nhip_vong` — tức nó không còn kiểm luật "dang_khoa" nữa.
     */
    const o8 = Array.from({ length: 8 }, () => gd('giam'));
    const st = ban([ghe('a', ['btc', 'vang'])], o8, { vong: 5 });
    const r = apKhoaTaiSan(st, 'a', 'btc');
    expect(r.ok, 'vòng 5 phải là vòng tài sản ở map 8').toBe(true);
    expect(apKhoaTaiSan({ ...r.st, vong: 6 }, 'a', 'vang').loi).toBe('dang_khoa');
  });
});

describe('B2. Quyền lợi khoá', () => {
  const oBao = [gd('giam'), gd('giam'), gd('giam')];
  const oEm = [gd('tang'), gd('tang'), gd('tang')];

  /** Bàn 4 ghế cùng ôm `btc` để crowding chắc chắn khác 0. */
  function banDong(o: readonly OThiTruong[], vong = 1): TrangThaiTran {
    return ban(['a', 'b', 'c', 'd'].map((id) => ghe(id, ['btc'])), o, { vong });
  }

  it('giảm trượt giá: khoá hoàn lại một phần khoản phạt, nhưng KHÔNG hoàn hết', () => {
    const st = banDong(oBao);
    const khoa = apKhoaTaiSan(st, 'a', 'btc').st;
    const cA = dungChuoi(khoa, gheCua(khoa, 'a'), oCua(khoa)).chain;
    const cB = dungChuoi(khoa, gheCua(khoa, 'b'), oCua(khoa)).chain;
    const phat = -tong(cA, 'crowding');
    const hoan = tong(cA, 'khoa_giam_truot');
    expect(phat).toBeGreaterThan(0);
    expect(hoan).toBeGreaterThan(0);
    expect(hoan).toBeLessThan(phat);                 // giảm, không miễn
    expect(tong(cB, 'khoa_giam_truot')).toBe(0);     // ghế không khoá: không hoàn
    // Người khoá phải chịu trượt giá RÒNG nhẹ hơn người không khoá ở cùng mã.
    const rongA = tong(cA, 'crowding') + tong(cA, 'khoa_giam_truot');
    expect(rongA).toBeGreaterThan(tong(cB, 'crowding'));
  });

  it('thưởng sống sót CHỈ nổ trong giai đoạn bão, và chỉ khi còn cầm mã', () => {
    const bao = apKhoaTaiSan(banDong(oBao), 'a', 'btc').st;
    const em = apKhoaTaiSan(banDong(oEm), 'a', 'btc').st;
    expect(tong(dungChuoi(bao, gheCua(bao, 'a'), oCua(bao)).chain, 'khoa_thuong'))
      .toBeGreaterThan(0);
    expect(co(dungChuoi(em, gheCua(em, 'a'), oCua(em)).chain, 'khoa_thuong'))
      .toBe(false);
  });

  it('ưu tiên khớp lệnh: người khoá đứng đầu hàng, người lướt sóng xếp sau', () => {
    const ghes = ['a', 'b', 'c'].map((id) => ghe(id, ['vang']));
    // Map 8 ô, vòng 5 — vòng TÀI SẢN gần nhất sau nhịp mới của D34 (xem test
    // "không chồng thêm khoá mới"). Vòng 2 nay là vòng chiến thuật nên khoá bị
    // từ chối và cả phép đo hàng chờ sẽ im lặng đo sai.
    const st0 = ban(ghes, Array.from({ length: 8 }, () => gd('di_ngang')), {
      vong: 5, truoc: { a: ['btc'], b: ['btc'], c: ['btc'] },
    });
    const rKhoa = apKhoaTaiSan(st0, 'a', 'vang');
    expect(rKhoa.ok).toBe(true);
    const st = rKhoa.st;
    const cA = dungChuoi(st, gheCua(st, 'a'), oCua(st)).chain;
    const cB = dungChuoi(st, gheCua(st, 'b'), oCua(st)).chain;
    expect(co(cA, 'xep_hang')).toBe(false);
    expect(tong(cB, 'xep_hang')).toBeLessThan(0);
  });
});

describe('B3. Phạt bẻ kèo — bất biến 4', () => {
  /**
   * Vòng 1 bão (ăn thưởng) → vòng 2 bẻ kèo. Chạy qua `giaiQuyetVong` chứ không
   * gọi thẳng `dungChuoi`: chỉ đường chạy thật mới chứng minh được thưởng có
   * TÍCH LUỸ thật để mà thu hồi.
   */
  function chuKy(be: 'doi_ma' | 'bo_bai' | 'giu'): {
    st: TrangThaiTran; chain2: readonly MatXich[]; thuongV1: number;
  } {
    const o = [gd('giam'), gd('giam'), gd('giam'), gd('giam')];
    let st = ban([ghe('a', ['btc', 'cp_cn']), ghe('b', ['vang']), ghe('c', ['usd'])],
      o, { vong: 1 });
    st = apKhoaTaiSan(st, 'a', 'btc').st;

    const v1 = chotPhien(st, choiVongCuoc(st, THEO));
    const thuongV1 = tong(
      v1.ketQua.ket_qua.find((r) => r.ghe_id === 'a')!.chain, 'khoa_thuong');
    st = v1.trangThai;

    if (be === 'doi_ma') {
      const r = apDaoDanhMuc(st, 'a', 'btc', 'vang');
      expect(r.ok).toBe(true);
      st = r.st;
    }
    const chinhSach = be === 'bo_bai'
      ? (c: { ghe_id: string }) => ({ loai: (c.ghe_id === 'a' ? 'bo' : 'theo') as 'bo' | 'theo' })
      : THEO;
    const v2 = chotPhien(st, choiVongCuoc(st, chinhSach));
    return {
      st: v2.trangThai,
      chain2: v2.ketQua.ket_qua.find((r) => r.ghe_id === 'a')!.chain,
      thuongV1,
    };
  }

  it('vòng 1 của chu kỳ CÓ tích luỹ thưởng thật (nếu không thì phần thu hồi là hư cấu)', () => {
    expect(chuKy('giu').thuongV1).toBeGreaterThan(0);
  });

  it('đổi mã ở vòng chốt = bẻ kèo: phạt CỘNG thu hồi đúng phần đã nhận', () => {
    const { chain2, thuongV1 } = chuKy('doi_ma');
    const mx = chain2.find((m) => m.kind === 'be_keo');
    expect(mx).toBeDefined();
    if (mx?.kind !== 'be_keo') throw new Error('sai kind');
    expect(mx.thu_hoi_bp).toBe(thuongV1);
    expect(mx.delta_bp).toBe(-(mx.phat_bp + mx.thu_hoi_bp));
    // Mất nhiều hơn hẳn phần thưởng đã ăn — bẻ kèo không được là nước đi hời.
    expect(-mx.delta_bp).toBeGreaterThan(thuongV1);
  });

  it('bỏ bài ở vòng chốt cũng là bẻ kèo (không lách bằng cách không đổi mã)', () => {
    const mx = chuKy('bo_bai').chain2.find((m) => m.kind === 'be_keo');
    expect(mx).toBeDefined();
  });

  it('giữ đúng cam kết ⇒ KHÔNG phạt, và vẫn ăn thưởng vòng chốt', () => {
    const { chain2 } = chuKy('giu');
    expect(co(chain2, 'be_keo')).toBe(false);
    expect(tong(chain2, 'khoa_thuong')).toBeGreaterThan(0);
  });

  it('bẻ kèo xong thì chu kỳ đóng lại, không phạt lây sang vòng sau', () => {
    const { st } = chuKy('doi_ma');
    expect(gheCua(st, 'a').khoa).toBeUndefined();
  });
});

describe('B4. Giam vốn sau bẻ kèo — bất biến 5', () => {
  it('vòng kế: ghế bị giam KHÔNG được Tăng cam kết, ghế khác thì được', () => {
    const o = [gd('giam'), gd('giam'), gd('giam'), gd('giam')];
    let st = ban([ghe('a', ['btc', 'cp_cn']), ghe('b', ['vang']), ghe('c', ['usd'])],
      o, { vong: 1 });
    st = apKhoaTaiSan(st, 'a', 'btc').st;
    st = chotPhien(st, choiVongCuoc(st, THEO)).trangThai;
    st = apDaoDanhMuc(st, 'a', 'btc', 'vang').st;
    st = chotPhien(st, choiVongCuoc(st, THEO)).trangThai;

    expect(biGiamVon(gheCua(st, 'a'), st.vong)).toBe(true);
    expect(biGiamVon(gheCua(st, 'b'), st.vong)).toBe(false);

    const duoc = new Map<string, string[]>();
    choiVongCuoc(st, (c) => {
      if (!duoc.has(c.ghe_id)) duoc.set(c.ghe_id, [...c.duoc]);
      return { loai: 'theo' as const };
    });
    expect(duoc.get('a')).not.toContain('to');
    expect(duoc.get('b')).toContain('to');
  });

  it('giam chỉ kéo dài đúng số vòng đã định, không thành án chung thân', () => {
    const g: Ghe = {
      id: 'a', loai: 'bot', bac_rank: 'Đồng', von: 10000, luot_khao_sat: 2,
      danh_muc: { tai_san: [], chien_thuat: [] }, da_chay: false, vong_chay: null,
      tu_the: 'choi', vong_roi: null, so_lan_cat_lo: 0, vi_the: {},
      giam_von_den_vong: 5,
    };
    expect(biGiamVon(g, 5)).toBe(true);
    expect(biGiamVon(g, 6)).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// C. BẤT BIẾN CHUNG — tất định, số nguyên, dây chuyền cộng khớp
// ---------------------------------------------------------------------------

describe('C. Bất biến chung của engine vẫn đứng sau khi thêm hai cơ chế', () => {
  const o = [gd('giam'), gd('giam'), gd('giam'), gd('giam')];

  function banDayDu(): TrangThaiTran {
    const st0 = ban(['a', 'b', 'c', 'd'].map((id) => ghe(id, ['btc'])), o, {
      vong: 2, truoc: { a: ['vang'], b: ['vang'], c: ['btc'], d: ['btc'] },
    });
    const st1 = apKhoaTaiSan(st0, 'c', 'btc').st;
    return {
      ...st1,
      ghe: st1.ghe.map((g) => (g.id === 'a'
        ? { ...g, dao: { vong: 2, tu: 'vang', den: 'btc' } } : g)),
    };
  }

  it('cùng trạng thái → cùng chuỗi, từng mắt xích (tất định)', () => {
    const x = banDayDu(); const y = banDayDu();
    expect(dungChuoi(x, gheCua(x, 'a'), oCua(x)))
      .toEqual(dungChuoi(y, gheCua(y, 'a'), oCua(y)));
  });

  it('mọi delta mới là SỐ NGUYÊN (C5 — cấm float trong tính tiền)', () => {
    const st = banDayDu();
    for (const id of ['a', 'b', 'c', 'd']) {
      const { chain, pnl_bp } = dungChuoi(st, gheCua(st, id), oCua(st));
      expect(Number.isInteger(pnl_bp)).toBe(true);
      for (const m of chain) {
        expect(Number.isInteger(m.delta_bp), JSON.stringify(m)).toBe(true);
      }
    }
  });

  it('tổng mắt xích vẫn cộng khớp PnL khi không có thẻ nhân', () => {
    const st = banDayDu();
    const { chain, pnl_bp } = dungChuoi(st, gheCua(st, 'a'), oCua(st));
    expect(chain.reduce((s, m) => s + m.delta_bp, 0)).toBe(pnl_bp);
  });

  it('`tai_san_truoc` được chốt phiên ghi lại — nếu không, hàng chờ mù vĩnh viễn', () => {
    const st = ban([ghe('a', ['btc']), ghe('b', ['vang'])], o, { vong: 1 });
    const sau = giaiQuyetVong(st, THEO).trangThai;
    expect(sau.tai_san_truoc?.a).toEqual(['btc']);
    expect(sau.tai_san_truoc?.b).toEqual(['vang']);
    expect(sau.luat_von).toBe(true);   // cổng không được rơi giữa các vòng
  });
});

describe('TRẦN TỔNG NHÁNH HỆ QUẢ — chống một lá xoá sạch tài khoản', () => {
  /*
   * Lỗi thật, tìm ra 27/07 từ ảnh chụp của founder: tổng nhánh hệ quả KHÔNG bị
   * chặn bởi bất cứ thứ gì. Với SO_NHANH = 2 thì một lá sinh gốc 100% + 2 nhánh
   * F1 ×70% + tới 4 nhánh F2 ×50% = tối đa 440% sức mạnh một sự kiện, giáng lên
   * TỪNG mã. Đo trên ván thật: một lá Hack sàn → −94,44% trong ĐÚNG MỘT VÒNG.
   *
   * Test kiểm QUAN HỆ chứ không kiểm con số cụ thể (bẫy 7): ngưỡng đổi được mà
   * test không vỡ, nhưng tổng vượt trần thì vỡ.
   */
  it('tổng mọi nhánh KHÔNG vượt trần so với sự kiện gốc', () => {
    for (const sk of SU_KIEN) {
      const goc = { su_kien: sk.id, do_lon_bp: 10000, dao: false };
      const tong = nhanhHeQua(goc).reduce((t, x) => t + x.do_lon_bp, 0);
      const tran = Math.floor((10000 * TRUYEN_NHAN_QUA.TRAN_TONG_NHANH_BP) / 10000);
      expect(tong, `${sk.id}: tổng nhánh ${tong} > trần ${tran}`).toBeLessThanOrEqual(tran);
    }
  });

  it('mọi nhánh đều mang `tu_nhanh` — nếu không, nhãn sẽ nói dối người chơi', () => {
    for (const sk of SU_KIEN) {
      for (const n of nhanhHeQua({ su_kien: sk.id, do_lon_bp: 10000, dao: false })) {
        expect(n.tu_nhanh, `nhánh ${n.su_kien} không biết nó sinh ra từ đâu`).toBe(sk.id);
      }
    }
  });
});
