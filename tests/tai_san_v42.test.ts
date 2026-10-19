/**
 * D311 — TÀI SẢN v2 (`balance-v42-taisan`): bộ số ba hàng · coupon · khống theo mã ·
 * lạm phát ăn tiền mặt.
 *
 * Bài này khoá SỐ, không khoá lời văn. Mọi vector tiền ở §II–§IV chép tay TRƯỚC khi
 * viết code (A8.3) và lấy từ §7.1 của `docs/yeu-cau-ky-thuat/08-tai-san-v2-ngan-hang-lam-phat.md`
 * — đổi một hằng số kinh tế mà quên sửa ở đây là ĐỎ, đúng ý: số trong tài liệu mà
 * không ai đếm lại thì sẽ trôi (D61).
 *
 * ⚠ §I không chép lại bảng V42 bằng tay. Nó khẳng định QUAN HỆ giữa V42 và v41 (ba
 * hàng đổi, ba hàng y hệt) — chép lại bảng là dựng bản sao thứ hai, và bản sao thứ hai
 * SẼ trôi. Con số cụ thể sống ở `config/holdem.ts` với chú thích nguồn cạnh nó.
 */
import { describe, expect, it } from 'vitest';
import {
  BO_LUAT_THEO_PHIEN_BAN, boMaTranCua, CAN_TROI_BP_V23, CAN_TROI_BP_V42, COUPON, couponBp,
  bangCanTroi, HOLDEM_BALANCE_VERSION, luatCua, mtGiaiDoan, mtSuKien,
  MT_TAI_SAN_GIAI_DOAN, MT_TAI_SAN_GIAI_DOAN_V42, MT_TAI_SAN_GIAI_DOAN_VN,
  MT_TAI_SAN_SU_KIEN, MT_TAI_SAN_SU_KIEN_V42, MT_TAI_SAN_SU_KIEN_VN,
  HOLDEM_DECISIONS, LAI_SUAT_NEN, PHI_DUNG_NGOAI, seedManTap, TAI_SAN, TIEN_MAT_SU_KIEN,
} from '../config/holdem.js';
import { apCoupon, giaiLenhMoc, navCua, type GheNav } from '../server/holdem/nav.js';
import {
  apSuKienTienMat, coV42ChoBot, couponBpCua, lucSuKienCua, tuyChonSinhMap,
  type TrangThaiTran,
} from '../server/holdem/engine.js';
import { loiSuatKyVongBp } from '../server/holdem/bots.js';
import { sinhMap } from '../server/holdem/map.js';
import { khoaBanTap } from '../config/luoc_bo.js';
/** `OThiTruong` không export khỏi engine — bài này chỉ cần ĐỦ trường cho hai hàm dưới. */
type ONhe = Parameters<typeof apSuKienTienMat>[2];

const V42 = 'balance-v42-taisan';
/** Ba mã mà cái tên mới tả một VẬT KHÁC ⇒ hàng số phải đổi. */
const DOI = ['cp_cn', 'usd', 'tpcp'];
/** Ba mã đổi tên mà không đổi vật ⇒ hàng số phải Y HỆT v41. */
const GIU = ['btc', 'vn30', 'vang'];

const ghe = (von: number, viThe: Record<string, number> = {},
  viKhong: Record<string, number> = {}): GheNav =>
  ({ von, vi_the: { ...viThe }, vi_the_khong: { ...viKhong } });

/**
 * Trạng thái TỐI THIỂU cho `lucSuKienCua`/`apSuKienTienMat`.
 * Vòng 1 + map rỗng ⇒ không có dư âm; `gia_chong_nen` vắng ⇒ `heSoTinTheoNen` trả
 * 10000 (hệ số nền TRUNG TÍNH — đúng điều kiện V5 ghi trong yêu cầu 08).
 */
const stToiThieu = (them: Record<string, unknown> = {}): TrangThaiTran => ({
  vong: 1,
  map: { o: [], trang_thai: [] },
  bo_nhanh_he_qua: true,
  tien_mat_su_kien: true,
  ...them,
} as unknown as TrangThaiTran);

const oLamPhat = (tinGia = false): ONhe => ({
  kind: 'su_kien', su_kien: 'lam_phat', la_tin_gia: tinGia, bao_truoc: 'bien_dong',
} as unknown as ONhe);

// ═══════════════════════════════════════════════════════════════════════════
describe('I. Bộ số v42 — quan hệ với v41, không chép lại bảng', () => {
  it('phủ ĐÚNG bộ mã và bộ trạng thái của v41 — không thiếu ô, không thừa ô', () => {
    for (const [v42, v41] of [
      [MT_TAI_SAN_GIAI_DOAN_V42, MT_TAI_SAN_GIAI_DOAN_VN],
      [MT_TAI_SAN_SU_KIEN_V42, MT_TAI_SAN_SU_KIEN_VN],
    ] as const) {
      expect(Object.keys(v42).sort()).toEqual(Object.keys(v41).sort());
      for (const ma of Object.keys(v41)) {
        expect(Object.keys(v42[ma]!).sort(), ma).toEqual(Object.keys(v41[ma]!).sort());
      }
    }
  });

  it('⭐ ba mã ĐỔI TÊN mà KHÔNG đổi vật (btc · vn30 · vang) giữ nguyên từng bp của v41', () => {
    for (const ma of GIU) {
      expect(MT_TAI_SAN_GIAI_DOAN_V42[ma], `${ma} × giai đoạn`)
        .toEqual(MT_TAI_SAN_GIAI_DOAN_VN[ma]);
      expect(MT_TAI_SAN_SU_KIEN_V42[ma], `${ma} × sự kiện`)
        .toEqual(MT_TAI_SAN_SU_KIEN_VN[ma]);
    }
  });

  it('⭐ ba mã ĐỔI VẬT (cp_cn · usd · tpcp) phải khác v41 ở ÍT NHẤT một ô — không đổi tên suông', () => {
    for (const ma of DOI) {
      const khac = JSON.stringify(MT_TAI_SAN_GIAI_DOAN_V42[ma]) !== JSON.stringify(MT_TAI_SAN_GIAI_DOAN_VN[ma])
        || JSON.stringify(MT_TAI_SAN_SU_KIEN_V42[ma]) !== JSON.stringify(MT_TAI_SAN_SU_KIEN_VN[ma]);
      expect(khac, `${ma} khai là đổi vật mà số y hệt v41`).toBe(true);
    }
  });

  it('⭐ `tpcp` lấy tiên nghiệm v40 CHỨ KHÔNG PHẢI v41 — nó thôi là tài sản VN', () => {
    /*
     * Gộp co rút của D307 kéo hàng TPCP theo lợi suất trái phiếu chính phủ VIỆT NAM.
     * Lá này nay là trái phiếu MỸ ⇒ mọi mẫu VN có w = 0 ⇒ phải quay về tiên nghiệm
     * toàn cầu. Bài canh: ba ô mà v41 đã kéo khỏi v40 thì v42 KHÔNG được giữ giá trị
     * v41 — giữ là gán hành vi trái phiếu VN cho trái phiếu Mỹ.
     */
    const oV41KhacV40 = Object.keys(MT_TAI_SAN_SU_KIEN.tpcp!).filter(
      (k) => MT_TAI_SAN_SU_KIEN_VN.tpcp![k as never] !== MT_TAI_SAN_SU_KIEN.tpcp![k as never]);
    expect(oV41KhacV40.length, 'v41 phải từng kéo TPCP, không thì bài này rỗng')
      .toBeGreaterThan(0);
    for (const k of oV41KhacV40) {
      expect(MT_TAI_SAN_SU_KIEN_V42.tpcp![k as never],
        `ô tpcp × ${k}: v42 giữ nguyên giá trị v41 — nhưng mẫu VN có w = 0 cho trái phiếu Mỹ`)
        .not.toBe(MT_TAI_SAN_SU_KIEN_VN.tpcp![k as never]);
    }
  });

  it('⭐ hàng pha `tpcp` là GIÁ-THUẦN: lever D20 kiểm trên TỔNG giá + coupon', () => {
    // Trú ẩn không được LỜI ở pha risk-on — nhưng phải đọc TỔNG, vì coupon là tiền thật.
    const cp = couponBp(LAI_SUAT_NEN.KHOI_DIEM);
    for (const pha of ['tang', 'phuc_hoi'] as const) {
      expect(MT_TAI_SAN_GIAI_DOAN_V42.tpcp![pha] + cp,
        `tpcp × ${pha}: giá ${MT_TAI_SAN_GIAI_DOAN_V42.tpcp![pha]} + coupon ${cp} phải ≤ 0 (lever D20)`)
        .toBeLessThanOrEqual(0);
    }
  });

  it('bảng cân trôi V42: `tpcp` về 0 (carry đã tách sang coupon), bốn mã khác giữ V23', () => {
    expect(CAN_TROI_BP_V42.tpcp).toBe(0);
    expect(CAN_TROI_BP_V23.tpcp).not.toBe(0);
    for (const ma of ['btc', 'vn30', 'vang', 'usd']) {
      expect(CAN_TROI_BP_V42[ma], ma).toBe(CAN_TROI_BP_V23[ma]);
    }
  });

  it('MỘT CỬA `boMaTranCua` — v42 đè v41, và ba cửa đọc đúng bảng', () => {
    expect(boMaTranCua({})).toBe('v40');
    expect(boMaTranCua({ lop_vn: true })).toBe('v41');
    expect(boMaTranCua({ tai_san_v42: true })).toBe('v42');
    // Trận v42 mang cả `lop_vn` (quy ước xếp chồng) — vẫn phải đọc bảng V42.
    expect(boMaTranCua({ lop_vn: true, tai_san_v42: true })).toBe('v42');
    expect(mtGiaiDoan('v42')).toBe(MT_TAI_SAN_GIAI_DOAN_V42);
    expect(mtSuKien('v42')).toBe(MT_TAI_SAN_SU_KIEN_V42);
    expect(mtGiaiDoan('v40')).toBe(MT_TAI_SAN_GIAI_DOAN);
    expect(bangCanTroi(true, true, 'v42')).toBe(CAN_TROI_BP_V42);
    expect(bangCanTroi(true, true, 'v41')).toBe(CAN_TROI_BP_V23);
    expect(bangCanTroi(false, true, 'v42')).toEqual({});
  });

  it('⭐ ĐẾM ô đổi — con số trong sổ nguồn phải là con số MÁY đếm được', () => {
    /*
     * Ở D307 tôi ghi "34/102 ô đổi" và SAI (máy đếm 32) vì đếm tay. Không lặp lại:
     * số ở §4.0 của `tai-san-v42-nguon-va-quy-doi.md` phải khớp đúng dòng này.
     */
    const dem = (a: Record<string, Record<string, number>>,
      b: Record<string, Record<string, number>>) => {
      let doi = 0; let tong = 0;
      for (const ma of Object.keys(a)) {
        for (const k of Object.keys(a[ma]!)) { tong += 1; if (a[ma]![k] !== b[ma]![k]) doi += 1; }
      }
      return { doi, tong };
    };
    const gd = dem(MT_TAI_SAN_GIAI_DOAN_VN, MT_TAI_SAN_GIAI_DOAN_V42);
    const sk = dem(MT_TAI_SAN_SU_KIEN_VN, MT_TAI_SAN_SU_KIEN_V42);
    expect({ gd: gd.doi, sk: sk.doi, tong: gd.tong + sk.tong },
      'sổ nguồn v42 §4.0 phải khớp con số này').toEqual({ gd: 8, sk: 14, tong: 102 });
  });

  it('mọi lá khai `dong_tien` + `khong_duoc`; đúng một lá trả coupon, đúng một lá cấm khống', () => {
    expect(TAI_SAN.filter((t) => t.dong_tien === 'coupon').map((t) => t.id)).toEqual(['tpcp']);
    expect(TAI_SAN.filter((t) => !t.khong_duoc).map((t) => t.id)).toEqual(['cp_cn']);
    // VN30 khống được — có phái sinh. Đây là ranh giới thật của thị trường.
    expect(TAI_SAN.find((t) => t.id === 'vn30')!.khong_duoc).toBe(true);
  });
});

// ═══════════════════════════════════════════════════════════════════════════
describe('II. COUPON — vector tiền chép tay (V1–V4)', () => {
  it('V1 — lãi nền 400, giữ 3.000 tpcp ⇒ suất 200 bp/ô, nhận 60 vào TIỀN MẶT', () => {
    expect(couponBp(400)).toBe(200);
    const g = ghe(1000, { tpcp: 3000 });
    const ra = apCoupon(g, couponBp(400));
    expect(ra).toEqual([{ ma: 'tpcp', tien: 60, khong: 0 }]);
    expect(g.von).toBe(1060);
    // Vị thế KHÔNG đổi — coupon vào ví, không cộng vào giá.
    expect(g.vi_the.tpcp).toBe(3000);
  });

  it('V2 — khống 1.000 tpcp ⇒ TRẢ 20, ký quỹ còn 980 (đốt, không ai trong bàn nhận)', () => {
    const g = ghe(1000, {}, { tpcp: 1000 });
    const ra = apCoupon(g, couponBp(400));
    expect(ra).toEqual([{ ma: 'tpcp', tien: 0, khong: 20 }]);
    expect(g.vi_the_khong!.tpcp).toBe(980);
    expect(g.von).toBe(1000);
  });

  it('V3 — lãi nền 475 ⇒ floor(475/2) = 237 ⇒ floor(3000 × 237 / 10000) = 71', () => {
    expect(couponBp(475)).toBe(237);
    const g = ghe(0, { tpcp: 3000 });
    apCoupon(g, couponBp(475));
    expect(g.von).toBe(71);
  });

  it('V4 — cờ TẮT ⇒ suất 0 ⇒ không một chip nào đổi (song sinh)', () => {
    expect(couponBpCua(stToiThieu({ coupon_tpcp: false }))).toBe(0);
    expect(couponBpCua(stToiThieu({ coupon_tpcp: true }))).toBe(couponBp(LAI_SUAT_NEN.KHOI_DIEM));
    const g = ghe(1000, { tpcp: 3000 }, { tpcp: 1000 });
    expect(apCoupon(g, 0)).toEqual([]);
    expect(g.von).toBe(1000);
    expect(g.vi_the_khong!.tpcp).toBe(1000);
  });

  it('chỉ mã `dong_tien === "coupon"` được trả — cầm cả bàn cũng chỉ tpcp sinh tiền', () => {
    const g = ghe(0, { btc: 5000, vn30: 5000, vang: 5000, usd: 5000, cp_cn: 5000, tpcp: 5000 });
    const ra = apCoupon(g, 200);
    expect(ra.map((x) => x.ma)).toEqual(['tpcp']);
    expect(g.von).toBe(100);
  });

  it('hệ số NHAN_BP mặc định = ×1 — đổi mặc định phải đổi bài này', () => {
    expect(COUPON.O_MOI_NAM).toBe(2);
    expect(COUPON.NHAN_BP).toBe(10000);
  });
});

// ═══════════════════════════════════════════════════════════════════════════
describe('III. KHỐNG THEO MÃ — V15', () => {
  const moKhong = (ma: string, khongTheoMa: boolean) => giaiLenhMoc(
    ghe(10000), [{ ma, moc_bp: 2500, chieu: 'khong' } as never], false,
    { coBanKhong: true, khongTheoMa },
  );

  it('V15a — khống `cp_cn` dưới v42 ⇒ `khong_cam_san`; dưới v41 (cờ tắt) ⇒ chấp nhận', () => {
    expect(moKhong('cp_cn', true).loi).toBe('khong_cam_san');
    expect(moKhong('cp_cn', false).loi).toBeNull();
  });

  it('V15b — mã khác vẫn khống được dưới v42 (chỉ cổ phiếu cơ sở bị chặn)', () => {
    for (const ma of ['btc', 'vn30', 'vang', 'usd', 'tpcp']) {
      expect(moKhong(ma, true).loi, ma).toBeNull();
    }
  });

  it('⭐ V15c — `dong_khong` KHÔNG BAO GIỜ bị chặn: cấm đóng là nhốt người chơi trong vị thế', () => {
    const g = ghe(1000, {}, { cp_cn: 4000 });
    const r = giaiLenhMoc(g, [{ ma: 'cp_cn', moc_bp: 10000, chieu: 'dong_khong' } as never],
      false, { coBanKhong: true, khongTheoMa: true });
    expect(r.loi).toBeNull();
    expect(r.lenh.length).toBe(1);
  });

  it('mandate của vai tổ chức BÁO LỖI TRƯỚC — thứ tự "thiếu lá → vai cấm → sàn không có"', () => {
    const r = giaiLenhMoc(ghe(10000), [{ ma: 'cp_cn', moc_bp: 2500, chieu: 'khong' } as never],
      false, { coBanKhong: true, khongTheoMa: true, mandate: { tranMaBp: 10000, camKhong: true } });
    expect(r.loi).toBe('mandate_khong');
  });

  it('thiếu lá Bán Khống vẫn báo `can_la_ban_khong`, không phải `khong_cam_san`', () => {
    const r = giaiLenhMoc(ghe(10000), [{ ma: 'cp_cn', moc_bp: 2500, chieu: 'khong' } as never],
      false, { coBanKhong: false, khongTheoMa: true });
    expect(r.loi).toBe('can_la_ban_khong');
  });
});

// ═══════════════════════════════════════════════════════════════════════════
describe('IV. TIỀN MẶT × SỰ KIỆN — V5, V7', () => {
  it('V5 — vốn 4.000, ô lạm phát THẬT, nền trung tính ⇒ bp −400 ⇒ mất 160 ⇒ còn 3.840', () => {
    const st = stToiThieu();
    // Điều kiện của vector: đúng MỘT lực, hệ số nền trung tính 10000.
    const luc = lucSuKienCua(st, oLamPhat(false));
    expect(luc.length).toBe(1);
    expect(luc[0]!.do_lon_bp).toBe(10000);

    const g = ghe(4000, { btc: 9999 });
    const r = apSuKienTienMat(st, g, oLamPhat(false));
    expect(TIEN_MAT_SU_KIEN.MT.lam_phat).toBe(-400);
    expect(r.mat).toBe(-160);
    expect(g.von).toBe(3840);
    // Vị thế KHÔNG bị chạm — hàng này chỉ ăn TIỀN MẶT TỰ DO.
    expect(g.vi_the.btc).toBe(9999);
  });

  it('V7 — TIN GIẢ lạm phát đảo dấu y hệt quy ước của giá: tiền mặt TĂNG 160', () => {
    const g = ghe(4000);
    const r = apSuKienTienMat(stToiThieu(), g, oLamPhat(true));
    expect(r.mat).toBe(160);
    expect(g.von).toBe(4160);
    expect(r.chi_tiet).toEqual([{ su_kien: 'lam_phat', delta_bp: 400, dao: true }]);
  });

  it('mười một mặt tin còn lại KHÔNG chạm tiền mặt (v1 chỉ lạm phát khác 0)', () => {
    const khac0 = Object.entries(TIEN_MAT_SU_KIEN.MT).filter(([, v]) => v !== 0);
    expect(khac0.map(([k]) => k)).toEqual(['lam_phat']);
  });

  it('⭐ V6 — MỘT NGUỒN THAY MỘT NGUỒN: ghế đứng ngoài trả ĐÚNG BẰNG tổng cũ', () => {
    /*
     * Trước v42, ô lạm phát trừ ghế `dung_ngoai` thêm `PHI_DUNG_NGOAI.LAM_PHAT_BP`
     * (400) trong khối phí đứng ngoài. Từ v42, khối ấy THÔI cộng 400 và hàng
     * `TIEN_MAT_SU_KIEN` trừ 400 cho MỌI ghế còn trong trận — gồm cả ghế đứng ngoài.
     *
     * Tổng của ghế đứng ngoài vì thế KHÔNG đổi (150 nền + 400 + 150 `apLamPhat`);
     * cái đổi là 400 ấy nay áp cho cả bàn. Hai hằng số phải khớp nhau về ĐỘ LỚN —
     * sửa một cái mà quên cái kia là ghế đứng ngoài âm thầm trả nhiều/ít hơn trước,
     * và không một bài nào khác nhìn thấy.
     */
    expect(TIEN_MAT_SU_KIEN.MT.lam_phat).toBe(-PHI_DUNG_NGOAI.LAM_PHAT_BP);
  });

  it('vốn 0 ⇒ không mất gì, không chia cho 0', () => {
    const g = ghe(0);
    expect(apSuKienTienMat(stToiThieu(), g, oLamPhat(false)).mat).toBe(0);
    expect(g.von).toBe(0);
  });

  it('ô GIAI ĐOẠN không sinh lực tiền mặt nào', () => {
    const g = ghe(4000);
    const o = { kind: 'giai_doan', giai_doan: 'giam' } as unknown as ONhe;
    expect(apSuKienTienMat(stToiThieu(), g, o).mat).toBe(0);
    expect(g.von).toBe(4000);
  });
});

// ═══════════════════════════════════════════════════════════════════════════
describe('V. Bảng luật — bốn cờ v42', () => {
  const soCua = (k: string) => Number(/^balance-v(\d+)/.exec(k)?.[1] ?? NaN);
  const CO = ['taiSanV42', 'couponTpcp', 'khongTheoMa', 'tienMatSuKien'] as const;

  it('⭐ MỌI khoá < v42 tắt cả bốn cờ — không một trận cũ nào đổi kết quả', () => {
    for (const [ten, luat] of Object.entries(BO_LUAT_THEO_PHIEN_BAN)) {
      const moi = soCua(ten) >= 42;
      for (const c of CO) {
        expect((luat as unknown as Record<string, boolean>)[c], `"${ten}".${c}`).toBe(moi);
      }
    }
    for (const c of CO) expect(luatCua(null)[c], `null.${c}`).toBe(false);
  });

  it('⭐ mặc định prod mang ĐỦ bốn cờ v42 — và KHÔNG ghim tên phiên bản', () => {
    /*
     * ⚠ BÀI NÀY ĐÃ HAI LẦN GHIM TÊN MẶC ĐỊNH và hai lần đỏ vì đúng cú lật nó lẽ ra
     * phải bảo vệ: bản đầu khẳng định "chưa lật v42" (đỏ ở D313), bản sau khẳng định
     * `=== V42` (đỏ ở D317 khi lật v44). Một bài canh đỏ mỗi lần làm việc đúng là
     * bài canh sẽ bị sửa cho qua, và lần thứ ba thì người ta sửa bằng cách xoá.
     *
     * Nên nó khoá TÍNH CHẤT, không khoá chuỗi: dù mặc định là v42, v44 hay v50, nó
     * phải mang ĐỦ bốn cờ. Vế đáng giá vẫn nguyên — bật lẻ ba trong bốn là ca
     * `taiSanV42` không có `couponTpcp`: trả lãi hai lần hoặc nuốt mất carry.
     *
     * Vế "mặc định không được đổi lặng lẽ" KHÔNG mất: golden replay canh nó bằng
     * cách chắc hơn nhiều — lật mà quên ghim bản cũ là 120 hàng đổi hash.
     */
    expect(luatCua(HOLDEM_BALANCE_VERSION).taiSanV42, 'mặc định phải ≥ v42').toBe(true);
    for (const c of CO) {
      expect(luatCua(HOLDEM_BALANCE_VERSION)[c], `mặc định thiếu cờ ${c}`).toBe(true);
    }
  });

  it('⭐ v42 khác v41 ĐÚNG bốn cờ đó, không lẫn cờ nào khác', () => {
    const a = luatCua('balance-v41-lopvn') as unknown as Record<string, boolean>;
    const b = luatCua(V42) as unknown as Record<string, boolean>;
    expect(Object.keys(b).filter((x) => a[x] !== b[x]).sort()).toEqual([...CO].sort());
  });

  it('`taiSanV42` và `couponTpcp` PHẢI cùng bật ở mọi khoá — tách là trả lãi hai lần', () => {
    /*
     * Hàng giá của tpcp ở bảng V42 là GIÁ-THUẦN (carry đã rút). Bật coupon một mình
     * ⇒ ma trận vẫn chở carry ⇒ trả hai lần. Bật bảng một mình ⇒ nuốt mất carry.
     * Hai cờ riêng là để ĐỌC ĐƯỢC ý định trong bảng luật, không phải để bật lẻ.
     */
    for (const [ten, luat] of Object.entries(BO_LUAT_THEO_PHIEN_BAN)) {
      const l = luat as unknown as Record<string, boolean>;
      expect(l.taiSanV42, `"${ten}" — hai cờ này phải đi cùng nhau`).toBe(l.couponTpcp);
    }
  });
});

// ═══════════════════════════════════════════════════════════════════════════
describe('V-b. ⭐ BOT PHẢI ĐỌC CÙNG BỘ SỐ VỚI ENGINE (bài canh của một lỗi đã xảy ra)', () => {
  /*
   * Lỗi thật, trong chính đợt này: khối dựng `BoiCanhLenh` có HAI bản —
   * `holdem_api.ts` (đường thật) và `nhip_lenh_bot.ts` (MỌI bàn đo, dựng ở D156 chính
   * để chống chuyện này). Tôi nối ba cờ v42 vào bản thứ nhất, chạy gate 12.000×3, ra
   * 12/12 — và số GIỐNG HỆT lần chạy trước khi nối, tới từng chữ số thập phân. Bot vẫn
   * chấm mã bằng bảng v41 trong khi engine định giá bằng V42: gate đo CHÊNH LỆCH HAI
   * BẢNG, không đo kỹ năng (đúng lỗi `can_troi` v21↔v23 — D61).
   *
   * Dấu hiệu DUY NHẤT là "số không đổi", mà số không đổi thì không ai nhìn. Nên bài
   * canh phải hỏi thẳng: một cửa `coV42ChoBot` có trả đủ ba cờ không.
   */
  it('`coV42ChoBot` trả ĐỦ ba cờ cho trận v42 — thiếu một cái là bot mù', () => {
    const st = stToiThieu({
      tai_san_v42: true, coupon_tpcp: true, tien_mat_su_kien: true, lop_vn: true,
    });
    expect(coV42ChoBot(st)).toEqual({
      tai_san_v42: true,
      coupon_bp: couponBp(LAI_SUAT_NEN.KHOI_DIEM),
      tien_mat_su_kien: true,
    });
  });

  it('trận CŨ (cờ tắt) không nhận trường nào — replay nguyên', () => {
    expect(coV42ChoBot(stToiThieu({ tien_mat_su_kien: false }))).toEqual({});
  });

  it('⭐ mọi cờ v42 CHẠM BỘ SỐ đều phải có mặt trong `coV42ChoBot` — thêm cờ mới là ĐỎ', () => {
    /*
     * Bài này canh chuyện quên: ai thêm một cờ v42 nữa mà nó đổi cách ĐỊNH GIÁ thì
     * bot phải biết. `khongTheoMa` cố ý KHÔNG có mặt — nó chặn lệnh, không đổi giá,
     * và bot mùa này chưa từng mở khống (D80).
     */
    const st = stToiThieu({
      tai_san_v42: true, coupon_tpcp: true, tien_mat_su_kien: true, khong_theo_ma: true,
    });
    expect(Object.keys(coV42ChoBot(st)).sort())
      .toEqual(['coupon_bp', 'tai_san_v42', 'tien_mat_su_kien']);
  });

  it('bot chấm Trái phiếu Mỹ CAO HƠN khi biết coupon — nếu không nó không bao giờ mua', () => {
    /*
     * Hàng giá của `tpcp` ở V42 là GIÁ-THUẦN, âm ở pha risk-on. Bot mù coupon thấy nó
     * là mã dở toàn tập; engine thì vẫn trả lãi mỗi ô cho ai cầm.
     */
    const bcGoc = {
      o: { kind: 'giai_doan' as const, giai_doan: 'tang' as const },
      echo: [], tai_san_v42: true,
    } as unknown as Parameters<typeof loiSuatKyVongBp>[2];
    const bot = { id: 'x', doc_tin: 'phot' } as unknown as Parameters<typeof loiSuatKyVongBp>[1];
    const mu = loiSuatKyVongBp('tpcp', bot, bcGoc);
    const biet = loiSuatKyVongBp('tpcp', bot, { ...bcGoc, coupon_bp: 200 });
    expect(biet - mu).toBe(200);
    // Mã KHÔNG trả coupon thì không được cộng gì.
    expect(loiSuatKyVongBp('vn30', bot, { ...bcGoc, coupon_bp: 200 }))
      .toBe(loiSuatKyVongBp('vn30', bot, bcGoc));
  });
});

// ═══════════════════════════════════════════════════════════════════════════
describe('V-c. ⭐ BÀN TẬP không đổi dãy ô khi lên v42 (D302 lặp lại thì Oracle kể sai)', () => {
  /*
   * `sinhMap` KHÔNG trung lập với ma trận: S-map (sức căng) đọc `mtGiaiDoan`/`mtSuKien`
   * qua `tuyChonSinhMap`, nên đổi bộ số CÓ THỂ đổi dãy ô sinh ra. Nếu bàn tập đổi thì
   * kịch bản `CoachTap` kể sai — đúng lỗi D302, và lần ấy test vẫn xanh vì nó đối chiếu
   * map tĩnh chứ không dựng lại map.
   *
   * Bài này dựng map THẬT cho từng phiên bản rồi so dãy ô. Nó KHÔNG khoá dãy ô cụ thể
   * (đó là việc của `coach_ban_tap`), chỉ khoá một điều: ba phiên bản phải ra CÙNG dãy.
   * Đỏ ⇒ phải rà lại từng bước có `keO` của CoachTap cùng commit (A11.3).
   */
  const dayO = (v: string) => {
    const seed = seedManTap(v);
    const m = sinhMap(seed, HOLDEM_DECISIONS.MAN_TAP_SO_O, tuyChonSinhMap(luatCua(v)));
    return (m.o as readonly { kind: string; su_kien?: string; giai_doan?: string }[])
      .map((o) => (o.kind === 'su_kien' ? `SK:${o.su_kien}` : `GD:${o.giai_doan}`)).join(' | ');
  };

  /*
   * ⚠ D317 — NỚI TỚI v44, và nới bằng cách quét MỌI khoá ≥ v40 thay vì liệt kê tay.
   * Liệt kê tay là bài canh chết dần: cổng thứ N+1 ra đời thì không ai nhớ thêm vào
   * đây, và nó vẫn XANH — đúng kiểu bài canh rỗng D262/D269/D272 đã trả giá.
   * Quét bảng thì cổng mới TỰ ĐỘNG vào lưới ngay commit nó sinh ra.
   */
  const TU_V40 = Object.keys(BO_LUAT_THEO_PHIEN_BAN)
    .filter((k) => Number(/^balance-v(\d+)/.exec(k)?.[1] ?? 0) >= 40);

  /*
   * ⚠ D389 — hỏi theo KHOÁ BÀN TẬP (`khoaBanTap`), không theo khoá trần: v54 (bánh xe) CỐ Ý sinh
   * dãy ô khác, nên khoá ấy làm mặc định thì bàn tập chạy khoá trước bánh xe. Câu bài này canh
   * vẫn nguyên: dù mặc định là khoá nào, BÀN TẬP phải ra đúng dãy ô CoachTap đã kể.
   */
  it('MỌI cổng ≥ v40 làm mặc định thì bàn tập vẫn ra ĐÚNG dãy ô của v40 — kịch bản màn tập còn đúng', () => {
    // Lưới phải thật sự phủ cái nó hứa phủ; 1 khoá thì bài này không canh gì.
    expect(TU_V40.length, 'quét phải bắt được ít nhất v40..v44').toBeGreaterThanOrEqual(5);
    const v40 = dayO('balance-v40-lichcodinh');
    for (const k of TU_V40) {
      expect(dayO(khoaBanTap(k)), `${k} vs v40 — đổi là phải rà lại lời CoachTap cùng commit`).toBe(v40);
    }
  });

  it('D389 — khoá bánh xe KHÔNG được chạy bàn tập (nó đổi dãy ô), khoá khác chạy chính nó', () => {
    expect(dayO('balance-v54-ngare')).not.toBe(dayO('balance-v40-lichcodinh'));
    expect(khoaBanTap('balance-v54-ngare')).toBe('balance-v53-upo');
    expect(khoaBanTap('balance-v53-upo')).toBe('balance-v53-upo');
  });

  it('seed bàn tập không đổi theo cổng nào từ v40 trở đi', () => {
    const s0 = seedManTap('balance-v40-lichcodinh');
    for (const k of TU_V40) expect(seedManTap(khoaBanTap(k)), k).toBe(s0);
  });
});

// ═══════════════════════════════════════════════════════════════════════════
describe('VI. Hệ kín — coupon và sốc tiền mặt không đẻ tiền ngoài luồng', () => {
  it('coupon sổ dài: NAV tăng ĐÚNG phần tiền vào ví, không hơn', () => {
    const g = ghe(1000, { tpcp: 3000 });
    const truoc = navCua(g);
    apCoupon(g, 200);
    expect(navCua(g) - truoc).toBe(60);
  });

  it('coupon sổ khống: NAV giảm ĐÚNG phần ký quỹ bị trừ (khoản này ĐỐT)', () => {
    const g = ghe(1000, {}, { tpcp: 1000 });
    const truoc = navCua(g);
    apCoupon(g, 200);
    expect(navCua(g) - truoc).toBe(-20);
  });

  it('vừa giữ vừa khống cùng một mã ⇒ hai chiều bù nhau đúng số học', () => {
    const g = ghe(0, { tpcp: 3000 }, { tpcp: 1000 });
    apCoupon(g, 200);
    expect(g.von).toBe(60);
    expect(g.vi_the_khong!.tpcp).toBe(980);
  });

  it('ký quỹ cạn vì coupon ⇒ XOÁ ô, không để lại số âm', () => {
    const g = ghe(0, {}, { tpcp: 4 });
    apCoupon(g, 10000);
    expect(g.vi_the_khong!.tpcp).toBeUndefined();
  });
});
