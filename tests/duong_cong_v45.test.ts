/**
 * D318 — ĐƯỜNG CONG LỢI SUẤT + BIÊN NHIỄU RÀ LẠI (`balance-v45-duongcong`).
 *
 * Hai cờ, hai việc, một cổng. Cả hai đều là chỗ TÔI TỰ KHAI LÀ SAI ở D315 rồi để
 * lại trong §Còn mở — nên bài này canh cả phần vá lẫn phần *không được đụng vào*.
 *
 * ⚠ Bài KHÔNG chép lại `DUONG_CONG` hay `BIEN_DONG_V45`: chép là dựng bản sao thứ
 * hai và bản sao sẽ trôi (D61). Nó khoá QUAN HỆ và HÌNH DẠNG — cờ tắt ⇒ y hệt bộ
 * máy cũ; cờ bật ⇒ đúng những tính chất mà đời thật đòi, và không mã nào ngoài
 * bốn mã khai bị chạm.
 */
import { describe, expect, it } from 'vitest';
import {
  BIEN_DONG_V45, bienDongCua, BO_LUAT_THEO_PHIEN_BAN, COUPON, couponBp, DUONG_CONG,
  HOLDEM_BALANCE_VERSION, LAI_SUAT_NEN, laiSuatDaiBp, luatCua, TAI_SAN,
} from '../config/holdem.js';
import { apCoupon } from '../server/holdem/nav.js';

const V45 = 'balance-v45-duongcong';
const soCua = (k: string) => Number(/^balance-v(\d+)/.exec(k)?.[1] ?? NaN);
const ts = (id: string) => TAI_SAN.find((t) => t.id === id)!;

// ═══════════════════════════════════════════════════════════════════════════
describe('I. Cờ TẮT ⇒ byte-hệt bộ máy cũ', () => {
  it('⭐ `couponBp` không truyền cờ ⇒ đúng công thức cũ ở MỌI mức lãi hợp lệ', () => {
    for (let d = LAI_SUAT_NEN.SAN; d <= LAI_SUAT_NEN.TRAN; d += 25) {
      expect(couponBp(d), `lãi ${d}`)
        .toBe(Math.floor((Math.floor(d / COUPON.O_MOI_NAM) * COUPON.NHAN_BP) / 10000));
    }
  });

  it('`bienDongCua` cờ v45 tắt ⇒ trả đúng nhánh cũ (lá gốc, hoặc lớp đè v44)', () => {
    for (const t of TAI_SAN) {
      expect(bienDongCua(t, false, false), t.id).toBe(t.bien_dong_bp);
    }
    // v44 vẫn thắng khi chỉ nó bật — lớp cũ không bị lớp mới nuốt mất.
    expect(bienDongCua(ts('cp_cn'), true, false)).not.toBe(ts('cp_cn').bien_dong_bp);
  });
});

// ═══════════════════════════════════════════════════════════════════════════
describe('II. ĐƯỜNG CONG — ba tính chất đời thật, không phải ba con số', () => {
  it('⭐⭐ Ở LÃI KHỞI ĐIỂM, CÚ VÁ KHÔNG ĐỔI MỘT BP NÀO — vá đúng chỗ, không thêm gì', () => {
    /*
     * ⚠ Bài này TỪNG khẳng định điều NGƯỢC LẠI ("có phần bù kỳ hạn, lãi dài > lãi
     * chính sách") vì bản đầu đặt `NEO_BP = 500` theo dữ kiện đời thật: 10 năm Mỹ
     * trung bình nằm trên fed funds khoảng 1 điểm phần trăm.
     *
     * Gate bác. Phần bù ấy làm khống trái phiếu đắt hơn 25%, bào đệm ký quỹ của bot
     * khống qua ngưỡng `GOI_KY_QUY`, và `Ngược dòng` tụt từ 25,5% xuống 11,5% thắng
     * — kéo G5a đỏ cả ba cỡ map. Vách nằm gọn giữa 400 và 450 rồi PHẲNG: hình dạng
     * của một NGƯỠNG, không phải của một chi phí tuyến tính.
     *
     * ⭐ Và nó phơi ra một cú lấn phạm vi: thứ D315 khai là sai chỉ có TRUYỀN DẪN
     * 1:1. Phần bù kỳ hạn là một thay đổi KINH TẾ đội lốt một thay đổi ĐỘ TRUNG
     * THỰC. Nên bài này nay khoá tính chất MẠNH HƠN: **ở lãi khởi điểm, coupon phải
     * ra ĐÚNG con số của bản trước v45.** Cú vá chỉ được đụng vào cách lãi dài PHẢN
     * ỨNG khi lãi chính sách DỜI, không được đụng mức nền.
     */
    expect(laiSuatDaiBp(LAI_SUAT_NEN.KHOI_DIEM)).toBe(LAI_SUAT_NEN.KHOI_DIEM);
    expect(couponBp(LAI_SUAT_NEN.KHOI_DIEM, true))
      .toBe(couponBp(LAI_SUAT_NEN.KHOI_DIEM, false));
  });

  it('⭐ TRUYỀN DẪN < 1: chính sách nhích 100 thì lãi dài nhích ÍT HƠN 100', () => {
    const a = laiSuatDaiBp(LAI_SUAT_NEN.KHOI_DIEM);
    const b = laiSuatDaiBp(LAI_SUAT_NEN.KHOI_DIEM + 100);
    expect(b - a).toBeGreaterThan(0);            // vẫn phải đi CÙNG chiều
    expect(b - a).toBeLessThan(100);             // nhưng không 1:1 — cả cơ chế là đây
  });

  it('⭐⭐ ĐƯỜNG CONG ĐẢO NGƯỢC ĐƯỢC ở lãi cao, và DỐC HẲN ở lãi thấp', () => {
    /*
     * Đây là thứ chơi được mà cơ chế sinh ra vì nó. Người chơi không cần biết chữ
     * "đường cong đảo ngược": họ thấy hai con số trên màn đổi ngôi — gửi tiết kiệm
     * (neo lãi CHÍNH SÁCH) bắt đầu trả cao hơn coupon trái phiếu dài.
     * Bài khoá HIỆN TƯỢNG, không khoá điểm đảo: đổi `TRUYEN_DAN_BP` thì điểm đảo
     * dời chỗ mà bài vẫn đúng, còn hiện tượng biến mất thì bài đỏ.
     */
    expect(laiSuatDaiBp(LAI_SUAT_NEN.TRAN)).toBeLessThan(LAI_SUAT_NEN.TRAN);
    expect(laiSuatDaiBp(LAI_SUAT_NEN.SAN)).toBeGreaterThan(LAI_SUAT_NEN.SAN);
    // ⚠ Và cú ĐẢO phải tới NGAY từ kỳ họp tăng đầu tiên — hệ quả của việc bỏ phần
    // bù kỳ hạn. Với một trò dạy đọc thị trường thì đó là bài học, không phải lỗi.
    const motNac = LAI_SUAT_NEN.KHOI_DIEM + LAI_SUAT_NEN.BUOC_KY_HOP;
    expect(laiSuatDaiBp(motNac)).toBeLessThan(motNac);
  });

  it('kẹp hai đầu — lãi dài không âm và không vượt trần', () => {
    for (let d = LAI_SUAT_NEN.SAN; d <= LAI_SUAT_NEN.TRAN; d += 25) {
      const l = laiSuatDaiBp(d);
      expect(l, `lãi ${d}`).toBeGreaterThanOrEqual(DUONG_CONG.SAN_BP);
      expect(l, `lãi ${d}`).toBeLessThanOrEqual(DUONG_CONG.TRAN_BP);
    }
  });

  it('⭐ VECTOR CHÉP TAY — 400 ⇒ dài 400 (phẳng) · 700 ⇒ dài 520 (ĐẢO) · 0 ⇒ dài 240 (dốc)', () => {
    // Phẳng ở khởi điểm; mọi cú dời chỉ truyền 0,40.
    expect(laiSuatDaiBp(400)).toBe(400);
    expect(couponBp(400, true)).toBe(200);
    // Lãi 7,00%: dài = 400 + ⌊0,4 × 300⌋ = 520 < 700 ⇒ ĐƯỜNG CONG ĐẢO NGƯỢC.
    expect(laiSuatDaiBp(700)).toBe(520);
    expect(couponBp(700, true)).toBe(260);
    expect(couponBp(700, false)).toBe(350);
    // Lãi 0%: dài = 400 + ⌊0,4 × (−400)⌋ = 240 > 0 ⇒ đường cong DỐC HẲN.
    expect(laiSuatDaiBp(0)).toBe(240);
    expect(couponBp(0, true)).toBe(120);
  });

  it('⭐ VECTOR CHÉP TAY — một kỳ họp tăng 75 chỉ đẩy coupon lên 15, không phải 37', () => {
    /*
     * Đây là con số nói rõ nhất cả cơ chế. 75 × 0,40 = 30 điểm lãi dài ⇒ chia đôi
     * còn 15 bp/ô. Bản cũ: 75 chia đôi = 37 (floor 37,5) — gấp hai lần rưỡi.
     */
    const truoc = couponBp(400, true);
    const sau = couponBp(400 + LAI_SUAT_NEN.BUOC_KY_HOP, true);
    expect(sau - truoc).toBe(15);
    expect(couponBp(475, false) - couponBp(400, false)).toBe(37);
  });
});

// ═══════════════════════════════════════════════════════════════════════════
describe('III. BIÊN NHIỄU — phòng thủ phải THẬT SỰ êm hơn rủi ro', () => {
  const bd = (id: string) => bienDongCua(ts(id), true, true);

  it('⭐⭐ trước v45, VÀNG ỒN HƠN VN30 — tức bộ số bác chính lời khuyên của trò', () => {
    /*
     * Bài này khẳng định điều SAI của bản cũ, có chủ ý: nó ghi lại vì sao lượt rà
     * này tồn tại. "Phân tán sang tài sản phòng thủ" chỉ có nghĩa nếu phòng thủ
     * thật sự êm hơn — mà vàng đang 1,41× VN30 và trái phiếu 0,94×.
     */
    expect(ts('vang').bien_dong_bp).toBeGreaterThan(ts('vn30').bien_dong_bp);
    // ...và sau lượt rà thì hết.
    expect(bd('vang')).toBeLessThan(bd('vn30'));
  });

  it('⭐ thứ tự ồn ào khớp đời thật: BTC > CTCK > VN30 > vàng > TPMỹ > USDT', () => {
    const thu = ['btc', 'cp_cn', 'vn30', 'vang', 'tpcp', 'usd'].map(bd);
    for (let i = 1; i < thu.length; i += 1) {
      expect(thu[i - 1]!, `hạng ${i} phải ồn hơn hạng ${i + 1}`).toBeGreaterThan(thu[i]!);
    }
  });

  it('⭐ USDT êm hẳn nhưng KHÔNG chết — rủi ro của nó nằm ở β mất neo (v44)', () => {
    /*
     * Tỷ lệ thật của USDT là ~0,025× VN30, tức gần như bất động. Chép thẳng vào là
     * một ô CHẾT trên bàn. Cái đúng đã sửa ở tầng khác: v44 cho nó β riêng ở ba mặt
     * tin crypto ⇒ rủi ro thật nằm ở MẤT NEO. Nên nền kéo xuống mạnh mà vẫn thở.
     */
    expect(bd('usd')).toBeLessThan(ts('usd').bien_dong_bp / 2);
    expect(bd('usd')).toBeGreaterThan(0);
  });

  it('⭐ KHÔNG mã nào ngoài bốn mã khai bị lớp v45 chạm', () => {
    expect(Object.keys(BIEN_DONG_V45).sort()).toEqual(['btc', 'tpcp', 'usd', 'vang']);
    // `vn30` là MỐC NEO của cả bảng tỷ lệ — đụng vào nó là đổi cả sáu tỷ lệ cùng lúc.
    expect(bienDongCua(ts('vn30'), true, true)).toBe(ts('vn30').bien_dong_bp);
    // `cp_cn` vẫn thuộc lớp v44, không bị v45 nuốt.
    expect(bienDongCua(ts('cp_cn'), true, true)).toBe(bienDongCua(ts('cp_cn'), true, false));
  });

  it('mọi mã trong bảng v45 phải là mã CÓ THẬT', () => {
    const co = new Set(TAI_SAN.map((t) => t.id));
    for (const id of Object.keys(BIEN_DONG_V45)) expect(co.has(id), id).toBe(true);
  });
});

// ═══════════════════════════════════════════════════════════════════════════
describe('III-b. COUPON PHẢI GIỮ ĐỦ MỘT Ô (founder 09/09)', () => {
  /*
   * Trái phiếu Mỹ trả lãi NỬA NĂM MỘT LẦN, mà 1 ô = nửa năm ⇒ đúng một kỳ mỗi ô.
   * Trước v45 ai mua ở ô nào cũng ăn coupon ngay ô ấy — tức nhặt được lãi miễn phí
   * bằng cách nhảy vào sát ngày chốt. Ngoài đời mua giữa kỳ thì người mua TRẢ phần
   * lãi đã dồn cho người bán, nên không có bữa trưa nào ở đó.
   */
  const ghe = (
    vi: Record<string, number>, truoc?: Record<string, number>,
    khong?: Record<string, number>, khongTruoc?: Record<string, number>,
  ) => ({
    von: 1000, vi_the: { ...vi }, vi_the_khong: { ...(khong ?? {}) },
    ...(truoc ? { vi_the_o_truoc: { ...truoc } } : {}),
    ...(khongTruoc ? { vi_the_khong_o_truoc: { ...khongTruoc } } : {}),
  });

  it('⭐ VỪA MUA ở ô này ⇒ KHÔNG coupon (ảnh chụp ô trước là 0)', () => {
    const g = ghe({ tpcp: 3000 }, {});
    expect(apCoupon(g, 200, true)).toEqual([]);
    expect(g.von).toBe(1000);
    // ...và cờ TẮT thì vẫn ăn như bản cũ — đây là chỗ cả cú đổi luật nằm.
    const g2 = ghe({ tpcp: 3000 }, {});
    apCoupon(g2, 200, false);
    expect(g2.von).toBe(1060);
  });

  it('⭐ GIỮ NGUYÊN trọn ô ⇒ coupon ĐỦ', () => {
    const g = ghe({ tpcp: 3000 }, { tpcp: 3000 });
    apCoupon(g, 200, true);
    expect(g.von).toBe(1060);
  });

  it('⭐ MUA THÊM giữa ô ⇒ chỉ phần CŨ được tính', () => {
    // Cũ 3.000, mua thêm 2.000 ⇒ chỉ 3.000 ăn lãi: floor(3000×200/10000) = 60.
    const g = ghe({ tpcp: 5000 }, { tpcp: 3000 });
    apCoupon(g, 200, true);
    expect(g.von).toBe(1060);
  });

  it('⭐ BÁN BỚT giữa ô ⇒ chỉ phần CÒN TRỤ được tính', () => {
    // Cũ 5.000, bán còn 2.000 ⇒ floor(2000×200/10000) = 40.
    const g = ghe({ tpcp: 2000 }, { tpcp: 5000 });
    apCoupon(g, 200, true);
    expect(g.von).toBe(1040);
  });

  it('⭐ SỔ KHỐNG đối xứng: mở khống sát ngày chốt thì KHÔNG phải trả lãi', () => {
    const g = ghe({}, {}, { tpcp: 2000 }, {});
    expect(apCoupon(g, 200, true)).toEqual([]);
    expect(g.vi_the_khong.tpcp).toBe(2000);
  });

  it('⭐ khống trọn kỳ thì TRẢ, và trừ đúng vào ký quỹ HIỆN TẠI', () => {
    /*
     * ⚠ Vector này canh một chỗ dễ sai trong chính cú vá: phần TÍNH LÃI (`min`) và
     * phần BỊ TRỪ (ký quỹ hiện tại) là hai số khác nhau từ v45. Khống 2.000 trọn kỳ
     * rồi mở thêm lên 3.000 ⇒ trả lãi trên 2.000 = 40, nhưng trừ vào 3.000 còn 2.960.
     */
    const g = ghe({}, {}, { tpcp: 3000 }, { tpcp: 2000 });
    apCoupon(g, 200, true);
    expect(g.vi_the_khong.tpcp).toBe(2960);
  });

  it('vắng ảnh chụp hẳn (trận cũ) ⇒ coi như 0 — không ai bỗng dưng mất coupon đã có', () => {
    /*
     * Trận cũ replay bằng luật cũ (cờ TẮT) nên nhánh này không bao giờ chạy cho
     * chúng. Bài vẫn khoá hành vi để cú vá không âm thầm phụ thuộc một trường vắng.
     */
    const g = ghe({ tpcp: 3000 });
    expect(apCoupon(g, 200, true)).toEqual([]);
  });
});

// ═══════════════════════════════════════════════════════════════════════════
describe('IV. Bảng luật — ba cờ v45', () => {
  const CO = ['duongCong', 'bienDongV45', 'couponGiuDu'] as const;

  it('⭐ MỌI khoá < v45 tắt cả ba cờ — v44 là bản trước, không được đổi một bp', () => {
    for (const [ten, luat] of Object.entries(BO_LUAT_THEO_PHIEN_BAN)) {
      const l = luat as unknown as Record<string, boolean>;
      for (const c of CO) expect(l[c], `"${ten}".${c}`).toBe(soCua(ten) >= 45);
    }
    for (const c of CO) expect(luatCua(null)[c], `null.${c}`).toBe(false);
  });

  it('v45 khác v44 ĐÚNG ba cờ đó, không lẫn cờ nào khác', () => {
    const a = luatCua('balance-v44-tuongquan') as unknown as Record<string, boolean>;
    const b = luatCua(V45) as unknown as Record<string, boolean>;
    expect(Object.keys(b).filter((x) => a[x] !== b[x]).sort()).toEqual([...CO].sort());
  });

  it('⭐ v45 xếp chồng — bật nó là mọi cơ chế v42/v43/v44 vẫn phải còn bật', () => {
    /*
     * Cùng lý lẽ bài v44: gate của v45 đo trên bộ CÓ ngân hàng và CÓ tương quan v2.
     * Một khoá bật `duongCong` mà tắt `tietKiem` là bộ luật chưa từng được đo lần nào.
     */
    const l = luatCua(V45) as unknown as Record<string, boolean>;
    for (const c of ['taiSanV42', 'couponTpcp', 'tietKiem', 'khoaTaiSanTat', 'betaTaiSanV2']) {
      expect(l[c], `v45 thiếu ${c}`).toBe(true);
    }
  });

  it('⭐ `duongCong` vô nghĩa nếu không có `couponTpcp` — mọi khoá bật nó phải có cả hai', () => {
    for (const [ten, luat] of Object.entries(BO_LUAT_THEO_PHIEN_BAN)) {
      const l = luat as unknown as Record<string, boolean>;
      if (l.duongCong === true) expect(l.couponTpcp, `${ten}: đường cong mà không có coupon`).toBe(true);
    }
  });

  it('mặc định prod: ba cờ cùng bật hoặc cùng tắt, không bao giờ lẻ', () => {
    const l = luatCua(HOLDEM_BALANCE_VERSION) as unknown as Record<string, boolean>;
    const bat = CO.filter((c) => l[c] === true);
    expect(bat.length === 0 || bat.length === CO.length,
      `ba cờ v45 phải cùng bật hoặc cùng tắt — đang bật: ${bat.join(', ')}`).toBe(true);
  });
});
