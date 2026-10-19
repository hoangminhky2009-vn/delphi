/**
 * ĐI VỐN v8 — CAM KẾT = ĐÒN BẨY (D35 hướng 1) + ĐA DẠNG HOÁ NỚI TRẦN SỐ MÃ.
 *
 * ─── VÌ SAO FILE NÀY TỒN TẠI ────────────────────────────────────────────────
 * Hai luật dưới đây được xây trong cùng một đợt và CHỈ MỘT trong hai được bật
 * (`donBayCamKet: false` · `daDangHoaTranTaiSan: true` ở `BO_LUAT_THEO_PHIEN_BAN`).
 * Một luật đã xây mà đang tắt là thứ dễ mục nhất trong repo: không ai chạy vào
 * nó, nên nó thối dần mà test vẫn xanh. Nên nhánh BẬT ở đây được gọi TƯỜNG MINH
 * bằng cờ, không chờ `HOLDEM_BALANCE_VERSION` bật hộ.
 *
 * ─── HAI BẪY ĐÃ DÍNH THẬT TRONG ĐÚNG CỤM NÀY, ĐANG BỊ CANH ──────────────────
 *  1. `maxTaiSanCua()` viết xong, có cổng, có docstring nói "một cửa hỏi duy
 *     nhất" — nhưng `muaCaVong` KHÔNG được truyền `maxTaiSan`, nên đặc quyền chỉ
 *     có tác dụng ở `apDaoDanhMuc`. Người chơi giữ được mã thứ 5 bằng cách ĐẢO
 *     danh mục mà không MUA nổi nó. Đường mua là đường chính ⇒ mất gần hết đặc
 *     quyền, mà không lỗi, không test nào đỏ.
 *  2. Ba nhánh chọn lá trong `bots.ts` đọc thẳng `HOLDEM_MATCH.MAX_TAI_SAN`, nên
 *     bot không bao giờ dùng ô thứ 5. Hệ quả không phải "bot chơi dở" mà là ĐẶC
 *     QUYỀN KHÔNG ĐO ĐƯỢC: Monte Carlo chấm một lá không con bot nào hưởng.
 *
 * ─── TEST THEO QUAN HỆ, KHÔNG THEO HẰNG SỐ ──────────────────────────────────
 * Mọi số trong `DON_BAY_CAM_KET` đánh dấu MC-TUNE và founder chưa chốt (A8.2).
 * Chép chúng vào `toBe()` là biến test thành bản sao của config: đổi tham số thì
 * test đỏ dù hành vi vẫn đúng, còn đổi DẤU thì test vẫn xanh. Nên ở đây kiểm
 * HÌNH DẠNG (đơn điệu · lồi/lõm · bất đối xứng · trần) — những thứ mà nếu vỡ thì
 * cơ chế sai bản chất chứ không chỉ lệch mức.
 */
import { describe, expect, it } from 'vitest';
import {
  apDonBayCamKet, maxTaiSanCua, taoTran,
  type Ghe, type GheMoi, type TrangThaiTran,
} from '../server/holdem/engine.js';
import { muaCaVong } from '../server/holdem/shop.js';
import {
  DAC_QUYEN, DON_BAY_CAM_KET, GOI_KY_QUY, HOLDEM_MATCH, heSoDonBayBp, luatCua,
  type ChienThuatId,
} from '../config/holdem.js';

function ghe(id: string, chienThuat: ChienThuatId[] = [], taiSan: string[] = []): GheMoi {
  return {
    id, loai: 'bot', bac_rank: 'Đồng',
    danh_muc: { tai_san: taiSan, chien_thuat: chienThuat },
  };
}

function ban(ghes: readonly GheMoi[], donBay: boolean, tranMa: boolean): TrangThaiTran {
  return taoTran(4242, ghes, {
    luatVon: true, dacQuyen: true,
    donBayCamKet: donBay, daDangHoaTranTaiSan: tranMa,
  });
}

// ═══════════════════════════════════════════════════════════════════════════
describe('GỌI KÝ QUỸ NỚI RỘNG — cần gạt KỸ NĂNG của lá Đòn Bẩy (D37)', () => {
  it('cửa nổ ở ô THƯỜNG phải NÔNG HƠN ở hack sàn — siết dần vs sập', () => {
    /*
     * Hai ngưỡng đều là số ÂM. "Nông hơn" = gần 0 hơn = dễ chạm hơn, và đi kèm
     * mất ít chip hơn. Nếu ai đó đảo quan hệ này thì ô thường thành nặng hơn cả
     * hack sàn, tức T6 mất hẳn bản sắc mà không test nào đỏ.
     */
    expect(GOI_KY_QUY.NGUONG_LO_THUONG_BP).toBeLessThan(0);
    expect(GOI_KY_QUY.NGUONG_LO_THUONG_BP,
      'ô thường phải DỄ chạm hơn hack sàn')
      .toBeGreaterThan(GOI_KY_QUY.NGUONG_LO_BP);
    expect(GOI_KY_QUY.MAT_CHIP_THUONG, 'ô thường phải mất ÍT hơn hack sàn')
      .toBeLessThan(GOI_KY_QUY.MAT_CHIP);
  });

  it('mọi phiên bản trước v8 KHÔNG nới cửa nổ — trận cũ replay nguyên vẹn', () => {
    for (const pb of ['balance-v5-D30-camket', 'balance-v6-luatvon', 'balance-v7-dacquyen']) {
      expect(luatCua(pb).kyQuyRong, pb).toBe(false);
    }
    expect(luatCua('balance-v999-la').kyQuyRong, 'bản lạ ⇒ tắt').toBe(false);
  });

  it('v8 BẬT — đây là cần gạt founder đã duyệt, khác `donBayCamKet` đang tắt', () => {
    expect(luatCua('balance-v8-donbay').kyQuyRong).toBe(true);
    expect(luatCua('balance-v8-donbay').donBayCamKet,
      'hai cần gạt PHẢI rời nhau: cái này bật, cái kia chờ founder').toBe(false);
  });

  it('cờ chảy đúng từ cổng vào trạng thái trận, không rơi giữa đường', () => {
    // `taoTran` mặc định TẮT HẾT (trận cũ), nên vắng cờ phải là `undefined` chứ
    // không phải `true` — bẫy `exactOptionalPropertyTypes` đúng chỗ này.
    expect(taoTran(1, [ghe('ban')], {}).ky_quy_rong).toBeUndefined();
    expect(taoTran(1, [ghe('ban')], { kyQuyRong: true }).ky_quy_rong).toBe(true);
  });
});

const gheCua = (st: TrangThaiTran, id: string): Ghe => st.ghe.find((g) => g.id === id)!;

// ═══════════════════════════════════════════════════════════════════════════
describe('ĐA DẠNG HOÁ nới trần SỐ MÃ GIỮ ĐỒNG THỜI (chỉ đạo 27/07 điều 3)', () => {
  it('cổng TẮT ⇒ đúng hằng số cũ, kể cả khi đang cầm lá — trận cũ replay không đổi', () => {
    const st = ban([ghe('ban', ['da_dang_hoa'])], false, false);
    expect(maxTaiSanCua(st, gheCua(st, 'ban'))).toBe(HOLDEM_MATCH.MAX_TAI_SAN);
  });

  it('cổng BẬT nhưng KHÔNG cầm lá ⇒ vẫn hằng số cũ', () => {
    const st = ban([ghe('ban')], false, true);
    expect(maxTaiSanCua(st, gheCua(st, 'ban'))).toBe(HOLDEM_MATCH.MAX_TAI_SAN);
  });

  it('cổng BẬT + cầm lá ⇒ nới đúng phần config khai, và nới LÊN chứ không xuống', () => {
    const st = ban([ghe('ban', ['da_dang_hoa'])], false, true);
    const noi = maxTaiSanCua(st, gheCua(st, 'ban'));
    expect(noi).toBeGreaterThan(HOLDEM_MATCH.MAX_TAI_SAN);
    expect(noi - HOLDEM_MATCH.MAX_TAI_SAN)
      .toBe(DAC_QUYEN.DA_DANG_HOA.TRAN_TAI_SAN_THEM);
  });

  it('HAI TRẦN LÀ HAI THỨ KHÁC NHAU — sức chứa ≠ tốc độ nhặt mỗi vòng', () => {
    /*
     * Canh chính chỗ đã nhầm khi thi công: `TAI_SAN_MOI_VONG` (mua bao nhiêu lá
     * MỖI VÒNG) và `TRAN_TAI_SAN_THEM` (giữ đồng thời bao nhiêu mã) là hai con
     * số rời nhau. Gộp lại là hoặc cho mua 5 lá một vòng, hoặc chặn ở 4 mã.
     */
    expect(DAC_QUYEN.DA_DANG_HOA.TAI_SAN_MOI_VONG)
      .not.toBe(HOLDEM_MATCH.MAX_TAI_SAN + DAC_QUYEN.DA_DANG_HOA.TRAN_TAI_SAN_THEM);
    expect(DAC_QUYEN.DA_DANG_HOA.TAI_SAN_MOI_VONG).toBeGreaterThanOrEqual(1);
  });

  it('BẪY 1 — ĐƯỜNG MUA phải nhận trần đã nới, không chỉ đường ĐẢO danh mục', () => {
    /*
     * Đây là test đắt nhất file. Nó KHÔNG kiểm `maxTaiSanCua` (đã kiểm ở trên)
     * mà kiểm rằng `muaCaVong` THẬT SỰ dùng con số được truyền vào — tức nếu ai
     * đó bỏ tham số ở call site trong `holdem_api.ts` thì có một test đỏ.
     */
    /*
     * ⚠ SUY TỪ HẰNG SỐ, KHÔNG CHỐT CỨNG. Bản đầu viết thẳng 4 mã vì lúc đó
     * `MAX_TAI_SAN` đúng bằng 4; founder hạ xuống 3 ngày 27/07 và test đỏ ngay —
     * nhưng đỏ vì FIXTURE sai, không phải vì luật sai. Ý của fixture luôn là
     * "danh mục ĐANG ĐẦY", mà "đầy" thì phải đọc từ trần chứ không phải nhớ.
     * Danh sách bỏ 'vn30' vì đó là lá bày trong shop ở test này.
     */
    const dayNguyen = {
      tai_san: ['btc', 'vang', 'usd', 'tpcp', 'cp_cn'].slice(0, HOLDEM_MATCH.MAX_TAI_SAN),
      chien_thuat: [],
    };
    const shop = { tai_san: ['vn30'], chien_thuat: [], ban_sao: {} } as never;

    // Không truyền trần ⇒ rơi về hằng số ⇒ mã thứ 5 BỊ TỪ CHỐI.
    const khong = muaCaVong(dayNguyen, shop, ['vn30'], { tai_san: 2, chien_thuat: 1 });
    expect(khong.danh_muc.tai_san, 'không truyền trần thì phải chặn ở hằng số cũ')
      .toHaveLength(HOLDEM_MATCH.MAX_TAI_SAN);

    // Truyền trần đã nới ⇒ mã thứ 5 VÀO ĐƯỢC.
    const co = muaCaVong(dayNguyen, shop, ['vn30'], { tai_san: 2, chien_thuat: 1 }, {
      maxTaiSan: HOLDEM_MATCH.MAX_TAI_SAN + DAC_QUYEN.DA_DANG_HOA.TRAN_TAI_SAN_THEM,
    });
    expect(co.danh_muc.tai_san.length,
      'truyền trần nới mà vẫn chặn = shop bỏ qua tham số')
      .toBeGreaterThan(khong.danh_muc.tai_san.length);
    expect(co.danh_muc.tai_san).toContain('vn30');
  });
});

// ═══════════════════════════════════════════════════════════════════════════
describe('CAM KẾT = ĐÒN BẨY — hình dạng hàm hệ số', () => {
  it('cam kết dưới ngưỡng ⇒ hệ số trung tính (1,0×)', () => {
    expect(heSoDonBayBp(0)).toBe(10000);
    expect(heSoDonBayBp(DON_BAY_CAM_KET.NGUONG_BP)).toBe(10000);
  });

  it('ĐƠN ĐIỆU TĂNG — cam kết nhiều hơn không bao giờ cho hệ số nhỏ hơn', () => {
    let truoc = heSoDonBayBp(0);
    for (let bp = 500; bp <= 10000; bp += 500) {
      const nay = heSoDonBayBp(bp);
      expect(nay, `tụt ở ${bp}bp`).toBeGreaterThanOrEqual(truoc);
      truoc = nay;
    }
  });

  it('LÕM (căn bậc hai) — đây là LỰC ĐỐI TRỌNG SỐ 1 với all-in vô não', () => {
    /*
     * Lõm nghĩa là mỗi phần cam kết thêm mua được ÍT đòn bẩy hơn phần trước, nên
     * dồn nốt 40% cuối của ví không đáng bằng 40% đầu. Nếu ai đó đổi sang đường
     * THẲNG hoặc LỒI thì all-in trở thành nước đi trội hẳn — mà số đo đã cho
     * thấy nó vốn đã quá mạnh ngay cả với đường lõm.
     */
    const d1 = heSoDonBayBp(3000) - heSoDonBayBp(2000);
    const d2 = heSoDonBayBp(9000) - heSoDonBayBp(8000);
    expect(d2, 'bước cuối phải mua được ít đòn bẩy hơn bước đầu').toBeLessThan(d1);
  });

  it('cam kết trọn ví ⇒ chạm đúng trần config khai, không vượt', () => {
    expect(heSoDonBayBp(10000)).toBe(10000 + DON_BAY_CAM_KET.TOI_DA_BP);
    expect(heSoDonBayBp(999999), 'kẹp trên phải chặn cả đầu vào bẩn')
      .toBe(heSoDonBayBp(10000));
  });
});

// ═══════════════════════════════════════════════════════════════════════════
describe('CAM KẾT = ĐÒN BẨY — áp vào PnL', () => {
  const VON = HOLDEM_MATCH.START_VON;

  it('cổng TẮT ⇒ PnL nguyên vẹn và KHÔNG mắt xích nào — lá chắn replay', () => {
    const st = ban([ghe('ban')], false, false);
    const r = apDonBayCamKet(st, gheCua(st, 'ban'), 500, VON, VON);
    expect(r.pnl_bp).toBe(500);
    expect(r.he_so_bp).toBe(10000);
    expect(r.phi).toBe(0);
    expect(r.mat_xich).toBeNull();
  });

  it('cổng BẬT ⇒ lãi được nhân lên, và có MẮT XÍCH để người chơi thấy vì sao', () => {
    const st = ban([ghe('ban')], true, false);
    const r = apDonBayCamKet(st, gheCua(st, 'ban'), 500, VON, VON);
    expect(r.pnl_bp).toBeGreaterThan(500);
    expect(r.mat_xich, 'không mắt xích = ChainReveal không vẽ được, D25/R1 hỏng')
      .not.toBeNull();
    expect(r.mat_xich!.kind).toBe('don_bay_cam_ket');
  });

  it('BẤT ĐỐI XỨNG — vế LỖ bị nhân nặng hơn vế LÃI (lực đối trọng số 2)', () => {
    const st = ban([ghe('ban')], true, false);
    const lai = apDonBayCamKet(st, gheCua(st, 'ban'), 500, VON, VON);
    const lo = apDonBayCamKet(st, gheCua(st, 'ban'), -500, VON, VON);
    expect(Math.abs(lo.pnl_bp), 'lỗ phải đau hơn lãi cùng độ lớn')
      .toBeGreaterThan(Math.abs(lai.pnl_bp));
  });

  it('PHÍ TÀI TRỢ chỉ thu trên phần VƯỢT ngưỡng (lực đối trọng số 3)', () => {
    const st = ban([ghe('ban')], true, false);
    const duoi = apDonBayCamKet(st, gheCua(st, 'ban'), 0,
      Math.floor((VON * DON_BAY_CAM_KET.NGUONG_BP) / 10000), VON);
    const tren = apDonBayCamKet(st, gheCua(st, 'ban'), 0, VON, VON);
    expect(duoi.phi, 'cam kết đúng ngưỡng thì chưa vay gì').toBe(0);
    expect(tren.phi).toBeGreaterThan(0);
  });

  it('TRẦN TỔNG khi CHỒNG lá Đòn Bẩy 2× — kẹp TÍCH, không kẹp riêng từng hệ số', () => {
    /*
     * Lá `don_bay` đã nhân `pnl_bp` bên trong `dungChuoi`. Nhân tiếp ở đây là
     * nhân hai lần, và hai trần "đều hợp lệ" vẫn cho ra tích 3,4×. Đúng lớp lỗi
     * D20 gọi là "đo sai đơn vị rủi ro".
     */
    const khong = ban([ghe('ban')], true, false);
    const co = ban([ghe('ban', ['don_bay'])], true, false);
    const a = apDonBayCamKet(khong, gheCua(khong, 'ban'), 500, VON, VON);
    const b = apDonBayCamKet(co, gheCua(co, 'ban'), 500, VON, VON);
    expect(b.he_so_bp, 'cầm lá Đòn Bẩy thì hệ số cam kết phải bị kẹp lại')
      .toBeLessThanOrEqual(a.he_so_bp);
    expect(b.he_so_bp).toBeGreaterThanOrEqual(10000);
  });
});

// ═══════════════════════════════════════════════════════════════════════════
describe('CỔNG PHIÊN BẢN — hai luật độc lập, và một trong hai ĐANG TẮT CÓ CHỦ Ý', () => {
  it('mọi phiên bản trước v8 KHÔNG có cả hai luật', () => {
    for (const pb of ['balance-v5-D30-camket', 'balance-v6-luatvon', 'balance-v7-dacquyen']) {
      const l = luatCua(pb);
      expect(l.donBayCamKet, pb).toBe(false);
      expect(l.daDangHoaTranTaiSan, pb).toBe(false);
    }
  });

  it('phiên bản LẠ ⇒ tắt hết, không đoán "chắc là bản mới"', () => {
    const l = luatCua('balance-v999-khong-ton-tai');
    expect(l.donBayCamKet).toBe(false);
    expect(l.daDangHoaTranTaiSan).toBe(false);
    expect(l.dacQuyen).toBe(false);
  });

  it('v8 bật trần số mã, và ĐÒN BẨY CAM KẾT VẪN TẮT — chờ founder', () => {
    /*
     * ⚠ TEST NÀY LÀ MỘT CÁI CHỐT, KHÔNG PHẢI MỘT MONG ĐỢI VĨNH VIỄN.
     *
     * Đòn bẩy cam kết đo ra VI PHẠM chính ràng buộc founder đặt cho nó ("đừng
     * cho kiểu vô não all-in", 27/07): bật lên thì all-in vô não từ hạng 3/6 lên
     * HẠNG 1/6, thắng 23,2% → 29,6%. Nên nó được xây đủ, đo đủ, rồi GIỮ Ở CỔNG.
     *
     * Ngày founder chốt bật, dòng dưới đây sẽ đỏ. Đó là CHỦ Ý: nó buộc người bật
     * phải mở file này đọc lý do đã tắt, thay vì bật một chữ `true` rồi đi tiếp.
     */
    const l = luatCua('balance-v8-donbay');
    expect(l.daDangHoaTranTaiSan, 'chỉ đạo 27/07 điều 3 — đã duyệt, bật').toBe(true);
    expect(l.donBayCamKet, 'đo ra all-in thành hạng 1/6 — chờ founder quyết').toBe(false);
  });
});
