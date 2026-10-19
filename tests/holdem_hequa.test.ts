/**
 * v18 — HỆ QUẢ CHƯA LẬT THÔI CẮN GIÁ (founder 01/08).
 *
 * Founder bắt trên prod: lật Bong bóng là chuỗi "VÌ SAO" trừ luôn "hệ quả
 * Bong bóng → Thiên nga đen / Hạ lãi suất / Siết pháp lý" — toàn thẻ CHƯA
 * LẬT. *"Trừ thì chỉ trừ tin giả thôi chứ mấy cái kia đã xảy ra đâu mà trừ??"*
 *
 * Cặp song sinh cùng seed: v17 phải CÓ mắt xích nhánh (chứng minh phép so
 * không rỗng — thiếu vế này thì test xanh cả khi cả hai bản đều không sinh
 * nhánh), v18 phải KHÔNG có. Dư âm thường + dư âm ĐẢO của tin giả giữ nguyên.
 */
import { describe, expect, it } from 'vitest';
import { HOLDEM_BALANCE_VERSION, luatCua } from '../config/holdem.js';
import {
  apLenhMocNav, giaiQuyetVong, taoTran, type GheMoi,
} from '../server/holdem/engine.js';
import { navCua } from '../server/holdem/nav.js';

const gheMoi = (id: string): GheMoi => ({
  id, loai: 'bot', bac_rank: 'Đồng',
  danh_muc: { tai_san: [], chien_thuat: [] },
});
const THEO = () => ({ loai: 'theo' as const });

/** Chạy hết trận, gom mọi mắt xích chain của ghế `a`. */
function chainCaTran(seed: number, phienBan: string) {
  let st = taoTran(seed, [gheMoi('a'), gheMoi('b'), gheMoi('c')], luatCua(phienBan));
  // Ghế phải NẮM mã thì lực sự kiện mới thành mắt xích — mua rộng hai mã.
  // Bước mốc THÔ (không lá Chia Lệnh) — 3000 sẽ bị `moc_khong_hop_le`.
  st = apLenhMocNav(st, 'a', [
    { ma: 'btc', chieu: 'mua', moc_bp: 2500 },
    { ma: 'vang', chieu: 'mua', moc_bp: 2500 },
  ]).st;
  const ra: { kind: string; tu_nhanh?: string }[] = [];
  const soVong = st.map.o.length;
  for (let v = 1; v <= soVong; v += 1) {
    const r = giaiQuyetVong(st, THEO);
    const cua = r.ketQua.ket_qua.find((k) => k.ghe_id === 'a');
    for (const m of cua?.chain ?? []) ra.push(m as never);
    st = r.trangThai;
  }
  return ra;
}

describe('v18 — nhánh F1/F2 rời khỏi giá', () => {
  it('v21 — CÂN TRÔI: ôm một mã suốt trận thì HOÀ, nhưng đuôi may/xui còn nguyên', () => {
    // Bất biến D43 §4.2 "EV phẳng, phương sai nổ" — founder 02/08 bác trần
    // biên độ: chuỗi may hiếm vẫn phải cho lãi khủng. Nên test khoá CẢ HAI vế.
    const gheMoi2 = (id: string): GheMoi => ({
      id, loai: 'bot', bac_rank: 'Đồng',
      danh_muc: { tai_san: [], chien_thuat: [] },
    });
    const omMotMa = (phienBan: string, ma: string) => {
      const nhan: number[] = [];
      for (let seed = 1; seed <= 120; seed += 1) {
        let st = taoTran(seed, ['a', 'b', 'c'].map(gheMoi2), luatCua(phienBan));
        const r0 = apLenhMocNav(st, 'a', [{ ma, chieu: 'mua', moc_bp: 10000 }]);
        if (!r0.ok) continue;
        st = r0.st;
        const dau = navCua(st.ghe.find((g) => g.id === 'a')!);
        for (let v = 1; v <= st.map.o.length; v += 1) {
          st = giaiQuyetVong(st, THEO).trangThai;
        }
        nhan.push(navCua(st.ghe.find((g) => g.id === 'a')!) / dau);
      }
      nhan.sort((x, y) => x - y);
      return {
        trungVi: nhan[Math.floor(nhan.length / 2)] ?? 0,
        p95: nhan[Math.floor(nhan.length * 0.95)] ?? 0,
      };
    };

    const cu = omMotMa('balance-v20-conghuong', 'btc');
    const moi = omMotMa('balance-v21-cantroi', 'btc');
    // TÂM: v20 ôm BTC là giàu chắc; v21 phải về quanh hoà.
    expect(cu.trungVi).toBeGreaterThan(1.2);
    expect(moi.trungVi).toBeLessThan(1.15);
    // ĐUÔI: chuỗi may vẫn phải cho lãi lớn — đây là vế founder bảo vệ.
    expect(moi.p95).toBeGreaterThan(2);
  });

  it('mặc định trỏ v25 và các cờ v18→v25 nối tới bảng luật', () => {
    /*
     * ⚠ 04/08 — mặc định chuyển v23 → v25. v25 khác v23 ĐÚNG MỘT CỜ
     * (`hoaCongBang`), là bản VÁ MỘT LỖI ĐANG CẮN NGƯỜI CHƠI THẬT: phá hoà Quỹ
     * vòng so CHUỖI id ghế, mà ghế người tên `'ban'` nên `'ban' < 'bot_1'` ⇒
     * người chơi thắng mọi cú hoà. Không trộn thêm thay đổi cân bằng nào vào
     * bản này, để hiệu ứng của riêng bản vá đo được (bài học D51/D54).
     */
    /*
     * ⚠ 04/08 (lần 2) — mặc định chuyển v25 → v27 (founder: "Thực hiện đi").
     * v27 gồm TRỌN v26: lãi suất nền công khai (`LAI_SUAT_NEN`) + bong bóng
     * thành chuỗi gãy được (`BONG_BONG_V27`). Đo đối chiếu 6.000 trận trước khi
     * bật: không gate nào đổi trạng thái, mọi chỉ số trong nhiễu.
     * ⚠ Bài này là CHỐT CHỐNG BẬT NHẦM: đổi mặc định mà quên đo thì nó đỏ, và
     * người đổi buộc phải đọc đoạn trên trước khi sửa con số này.
     *
     * ⚠ 08/08 — mặc định chuyển v27 → v28 (founder: "Đọc kỹ và khắc phục…
     * Thay đổi tỷ lệ tin giả…"). v28 = trọn v27 + MAP_V28 (tin giả theo loại ·
     * bong bóng có gốc · tin giả lộ kéo Sập sàn · phục hồi là cầu). Đo đối
     * chiếu 6.000 trận map 8 trước khi bật: G2 ✓ (oracle 1,87) · G3 ✓ (4,02) ·
     * G1/G4 đỏ NHƯ CŨ trên v27 (nợ cấu trúc, 04 §4.6–4.7), gap G4 thu hẹp
     * −0,34 → −0,08. Seed màn tập 20260373 quét lại: dãy ô GIỮ NGUYÊN.
     */
    /*
     * ⚠ 08/08 (lần 2) — mặc định v28 → v29 (founder: "Thực hiện bộ core logic
     * trước"). v29 = trọn v28 + PHÍ VỘI VÀNG phi tuyến theo cỡ lệnh
     * (NAV_V10.VOI_VANG — dò 5 nấc, chốt 160000/220000). Số đo 12.000 trận
     * map 8: ⭐ G1 XANH LẦN ĐẦU từ khi gate đo trò thật (Tất tay 60,2% →
     * 31,0%, cách á quân 7,8 < 8 — "chen chúc lành" D21) · G2 ✓ oracle 1,83 ·
     * G3 ✓ 3,80 · G4 đỏ như mọi bản từ v21 (nợ riêng). Xác nhận map 12/16:
     * G1 ✓ 30,7%/29,2%.
     */
    /*
     * ⚠⚠ 11/08 — mặc định v29 → v30 (founder: "làm theo thứ tự đó đi", sau rà
     * soát cổng D79). v30 KHÔNG đổi một tham số kinh tế nào — nó SỬA DỤNG CỤ
     * ĐO: bot chấm điểm mã bằng ĐÚNG bảng cân trôi engine đang dùng (trước đây
     * bot đọc v21 trong khi engine định giá v23) và chiết khấu tin giả bằng
     * tỷ lệ HIỆU DỤNG ở cả ba kênh (trước đây hai kênh dùng 35% phẳng, trong
     * khi tỷ lệ thật từ v28 chạy 5–80%).
     *
     * ⭐ Kết quả đo lại (12.000 trận) tách được LỖI THƯỚC khỏi LỖI TRÒ:
     *     bàn 5 × map 8 (mặc định): G1 ✓ 5,6 · G2 ✓ · G3 ✓ · G4 ✓ ← G4 XANH,
     *       trước khi sửa thước nó ĐỎ. Tức một phần "trò hỏng" là thước hỏng.
     *     bàn 8 × map 8:  G1 ✗ (21,3) · G4 ✗
     *     bàn 5 × map 12: G1 ✗ · G4 ✗ (cả hai vế)
     *     bàn 5 × map 16: G1 ✓ · G4 ✗ (cả hai vế)
     * ⚠ PHẦN CÒN ĐỎ LÀ NỢ THẬT, và chạm vào nó là chạm THAM SỐ KINH TẾ (A8.2)
     * — chờ founder duyệt số, KHÔNG tự chỉnh.
     */
    /*
     * ⚠⚠ 11/08 (lần 2) — mặc định v30 → v31 (founder: *"co dãn theo số bàn"*).
     * v31 khác v30 ĐÚNG MỘT CỜ: số suất Quỹ vòng = ceil(60% × số ghế) thay vì
     * ba suất cứng. Trước đó bàn 8 chỉ 3/8 ghế có thưởng ⇒ hạng 4 và hạng 8
     * nhận NHƯ NHAU (đều 0) ⇒ đánh liều không mất thêm gì (lồi phương sai).
     *
     * ⭐ Đo 12.000 trận: bàn 8 × map 8 ĐẠT CẢ BỐN GATE (G1 cách 21,3 → 10,8;
     * G4 từ ✗ sang ✓). Bàn 5 × map 8 ra số Y HỆT v30 (G1 5,6 · G4 2,72) —
     * chứng minh hai cỡ bàn đang xanh không đổi một chip. Bàn 6 × map 12: G1
     * ✓ (trước đỏ), G4 vẫn ✗ — nợ riêng, xem D82.
     */
    /*
     * ⚠⚠ 16/08 (lần 3) — mặc định v31 → v32 (founder: *"Mở kỳ ngộ cho các bàn
     * đã chốt đi"*). v32 = bản sắc cỡ map + kỳ ngộ (hai cờ, cùng cổng — D87
     * tách cờ để đo được "gate dịch vì cung tín dụng hay vì kỳ ngộ"). Số đo
     * trước khi lật (D87/D88b): map 8 v31 ≡ v32 từng chữ số; map 12/16 bốn
     * gate xanh. Bản ngay trước (v31) KHÔNG có hai cờ — cổng replay trận cũ.
     */
    /*
     * ⚠ 17/08 (lần 4) — mặc định v32 → v33 (founder: *"Làm hết đi"*, D90 M1).
     * v33 = GIÃN LỚP CHIẾN THUẬT ở map ngắn (2·3·4 → 2·4·6). Đo trước khi lật:
     * G1–G4 map 8 trên v32 và v33 GIỐNG HỆT TỪNG CHỮ SỐ (bot lấy lá theo shop
     * chứ không theo nhịp) — cổng vẫn cần vì bàn tập ghim bộ lõi theo VÒNG.
     *
     * ⚠ 22/08 (lần 5) — mặc định v33 → v34 (founder: *"Lật luôn đi"*, D109).
     * v34 = VAI CÓ RĂNG (vốn/ghim/tác động giá theo vai, SIẾT, mandate, xếp hạng
     * theo % tăng trưởng) + gọi ký quỹ trừ từ NAV. Map 8 không có vai ⇒ lệch
     * nhỏ so v33 chỉ đến từ ký quỹ (Tất tay 33,2 → 32,8; oracle 1,88 → 1,87).
     */
    /*
     * ⚠ 30/08 (lần 6) — mặc định v34 → v35 (founder: *"Làm đi"*, D164, trên
     * bảng số D161: 13/13 gate xanh ở 12.000×3 cỡ map). v35 = CHUỖI MỞ RỘNG
     * (cạnh nhân quả mới + môi trường) + duoi5 BẬT LẠI (5 mặt đuôi vào chợ,
     * thiên nga đen ra — SIẾT PHÁP LÝ sống lại theo) + NHTW dập bong bóng ở
     * kỳ họp + 3 luật tương tác thẻ + Markov theo nguyên nhân + bẻ chuỗi bằng
     * vốn. Map 8 nay CŨNG đổi phân phối (duoi5) — khác các lần lật trước.
     */
    /*
     * ⚠ 30/08 (lần 7) — mặc định v35 → v36 (founder: *"Làm đi"*, D179). v36 =
     * MÁY REGIME TICK (nền tick trước, ô công bố sau; `phuc_hoi` chỉ sinh khi
     * tin tốt THẬT cắt chuỗi giảm) + giá vòng tin NHÂN theo nền + bot đọc cùng
     * nền + dự báo theo máy đang sinh ô + hồ sơ map 8 "ngắn & căng". 12/12 gate
     * xanh ở 12.000 trận × 3 cỡ map.
     */
    // 07/09 (lần 8) — v36 → v40 (founder *"Lật tất"*, D303): kéo v37 áp lực bàn +
    // v38 đối xứng + v39 chu kỳ thực tế + v40 lịch cố định; gate 12.000×3 đo trên v40.
    /*
     * ⚠ 09/09 (lần 9) — mặc định v40 → v42 (founder: *"Hiện tại đã có user đâu mà lo
     * không tách được dữ liệu, thực hiện đi. Duyệt."*, D313). v42 xếp chồng v41 nên cú
     * lật này kéo THEO cả lớp dữ liệu VN (D307): bộ số ba hàng cp_cn/usd/tpcp suy lại +
     * coupon Trái phiếu Mỹ + cấm khống theo mã + lạm phát ăn tiền mặt. Gate 12.000 trận
     * × 3 cỡ map đo trên CHÍNH v42: 12/12.
     * ⚠⚠ Hai lần chạy gate ĐẦU cũng ra 12/12 nhưng ĐO SAI (bot đọc bảng v41 trong khi
     * engine định giá bằng V42) — số ở D311 là lần thứ ba, sau khi gộp về một cửa
     * `coV42ChoBot`. Đừng tin một bảng gate chỉ vì nó xanh: so nó với lần chạy trước.
     */
    /*
     * ⚠ Ghim SÀN, không ghim chuỗi (đổi 09/09 ở D317 — xem chuoi_mo_rong.test.ts).
     * Mọi `expect` dưới đây mới là vế đáng giá: từng cơ chế PHẢI còn bật ở mặc định,
     * và chúng tự đỏ nếu ai đó lật về một bộ luật cổ hơn.
     */
    expect(Number(/^balance-v(\d+)/.exec(HOLDEM_BALANCE_VERSION)?.[1] ?? 0))
      .toBeGreaterThanOrEqual(42);
    expect(luatCua(HOLDEM_BALANCE_VERSION).regimeTick).toBe(true);
    expect(luatCua(HOLDEM_BALANCE_VERSION).giaChongNen).toBe(true);
    expect(luatCua('balance-v35-chuoi').regimeTick).toBe(false);
    expect(luatCua(HOLDEM_BALANCE_VERSION).vaiCoRang).toBe(true);
    expect(luatCua(HOLDEM_BALANCE_VERSION).kyQuyTuNav).toBe(true);
    expect(luatCua(HOLDEM_BALANCE_VERSION).chuoiMoRong).toBe(true);
    expect(luatCua(HOLDEM_BALANCE_VERSION).tuongTacThe).toBe(true);
    expect(luatCua(HOLDEM_BALANCE_VERSION).markovNguon).toBe(true);
    // D406 — v54 (mặc định từ 0.0.45) CẮT bẻ chuỗi (D389 lược bỏ) ⇒ ghim khoá cuối còn bật nó; bàn tập v53 vẫn chạy.
    expect(luatCua('balance-v53-upo').beChuoiVon).toBe(true);
    expect(luatCua(HOLDEM_BALANCE_VERSION).duoi5).toBe(true);
    expect(luatCua('balance-v34-vai').chuoiMoRong).toBe(false);
    expect(luatCua('balance-v34-vai').duoi5).toBe(false);
    expect(luatCua('balance-v33-gianla').vaiCoRang).toBe(false);
    expect(luatCua('balance-v33-gianla').kyQuyTuNav).toBe(false);
    expect(luatCua(HOLDEM_BALANCE_VERSION).gianLaMapNgan).toBe(true);
    expect(luatCua('balance-v32-bansac').gianLaMapNgan).toBe(false);
    expect(luatCua(HOLDEM_BALANCE_VERSION).banSacMap).toBe(true);
    // D406 — v54 bỏ kỳ ngộ (founder: "bỏ cơ chế kỳ ngộ", D389) ⇒ ghim khoá cuối còn nó; bàn tập v53 vẫn có một lần.
    expect(luatCua('balance-v53-upo').kyNgo).toBe(true);
    expect(luatCua(HOLDEM_BALANCE_VERSION).kyNgo).toBe(false);
    expect(luatCua('balance-v31-quycogian').banSacMap).toBe(false);
    expect(luatCua('balance-v31-quycogian').kyNgo).toBe(false);
    expect(luatCua(HOLDEM_BALANCE_VERSION).quyCoGian).toBe(true);
    // Bản ngay trước v31 KHÔNG có cờ quỹ co giãn — cổng replay của trận cũ.
    expect(luatCua('balance-v30-suathuoc').quyCoGian).toBe(false);
    expect(luatCua(HOLDEM_BALANCE_VERSION).botDungThuocThat).toBe(true);
    expect(luatCua('balance-v29-voivang').botDungThuocThat).toBe(false);
    expect(luatCua(HOLDEM_BALANCE_VERSION).phiVoiVang).toBe(true);
    expect(luatCua('balance-v28-goc').phiVoiVang).toBe(false);
    expect(luatCua(HOLDEM_BALANCE_VERSION).mapV28).toBe(true);
    expect(luatCua(HOLDEM_BALANCE_VERSION).laiSuatNen).toBe(true);
    expect(luatCua(HOLDEM_BALANCE_VERSION).bongBongChuoi).toBe(true);
    // Bản ngay trước KHÔNG có cờ mới — cổng replay của trận cũ.
    expect(luatCua('balance-v27-bongbong').mapV28).toBe(false);
    expect(luatCua('balance-v25-hoacongbang').laiSuatNen).toBe(false);
    expect(luatCua('balance-v25-hoacongbang').bongBongChuoi).toBe(false);
    expect(luatCua(HOLDEM_BALANCE_VERSION).hoaCongBang).toBe(true);
    expect(luatCua('balance-v23-cantroi2').hoaCongBang).toBe(false);
    expect(luatCua(HOLDEM_BALANCE_VERSION).canTroi2).toBe(true);
    expect(luatCua('balance-v22-botdoctin').canTroi2).toBe(false);
    expect(luatCua(HOLDEM_BALANCE_VERSION).botDocTin).toBe(true);
    expect(luatCua('balance-v21-cantroi').botDocTin).toBe(false);
    /*
     * ⚠ v24 ĐO RỒI, KHÔNG ĐẠT, CỐ Ý TẮT — xem lý do dài ở `CO_VI_THE` và ở
     * mục v24 trong bảng luật. Dòng này là chốt chặn: ai bật nó lên phải làm
     * test đỏ trước, tức phải đi đọc vì sao nó bị tắt.
     */
    expect(luatCua(HOLDEM_BALANCE_VERSION).coViThe,
      'v24 chưa đạt phép đo — bật thì phải đo lại G1–G4').toBe(false);
    expect(luatCua('balance-v24-coviThe').coViThe).toBe(true);
    expect(luatCua(HOLDEM_BALANCE_VERSION).canTroi).toBe(true);
    expect(luatCua('balance-v20-conghuong').canTroi).toBe(false);
    expect(luatCua(HOLDEM_BALANCE_VERSION).boNhanhHeQua).toBe(true);
    expect(luatCua(HOLDEM_BALANCE_VERSION).xungDotGon).toBe(true);
    expect(luatCua(HOLDEM_BALANCE_VERSION).congHuongGon).toBe(true);
    // Trận cũ giữ nhánh — cổng là để replay đứng yên, không phải công tắc chung.
    expect(luatCua('balance-v19-xungdot').congHuongGon).toBe(false);
    expect(luatCua('balance-v18-hequa').xungDotGon).toBe(false);
    expect(luatCua('balance-v17-khong').boNhanhHeQua).toBe(false);
    expect(luatCua(null).boNhanhHeQua).toBe(false);
  });

  it('v20 — cặp Lướt Sóng × Đòn Bẩy HẾT thưởng cộng hưởng; v19 còn; cặp bảo hiểm Chặn Lỗ × Phòng Hộ còn ở cả hai', () => {
    const gheCap = (ct: string[]): GheMoi => ({
      id: 'a', loai: 'bot', bac_rank: 'Đồng',
      danh_muc: { tai_san: [], chien_thuat: ct as never },
    });
    const chayVong1 = (phienBan: string, ct: string[]) => {
      let st = taoTran(20260841, [gheCap(ct), gheMoi('b'), gheMoi('c')], luatCua(phienBan));
      st = apLenhMocNav(st, 'a', [{ ma: 'btc', chieu: 'mua', moc_bp: 2500 }]).st;
      const r = giaiQuyetVong(st, THEO);
      return (r.ketQua.ket_qua.find((k) => k.ghe_id === 'a')?.chain
        ?? []) as readonly { kind: string }[];
    };
    const capGo = ['luot_song', 'don_bay'];
    expect(chayVong1('balance-v19-xungdot', capGo).some((m) => m.kind === 'cong_huong'))
      .toBe(true);
    expect(chayVong1('balance-v20-conghuong', capGo).some((m) => m.kind === 'cong_huong'))
      .toBe(false);
    // Cặp bảo hiểm GIỮ — vòng 1 seed 20260841 là BIẾN ĐỘNG, đúng giai đoạn ăn.
    const capGiu = ['chan_lo', 'phong_ho'];
    expect(chayVong1('balance-v20-conghuong', capGiu).some((m) => m.kind === 'cong_huong'))
      .toBe(true);
  });

  it('v19 — cặp Bán Khống × Lướt Sóng HẾT phạt xung đột; v18 còn; Mua Đuổi × Chặn Lỗ còn ở cả hai', () => {
    const gheCap = (ct: string[]): GheMoi => ({
      id: 'a', loai: 'bot', bac_rank: 'Đồng',
      danh_muc: { tai_san: [], chien_thuat: ct as never },
    });
    const chayVong1 = (phienBan: string, ct: string[]) => {
      let st = taoTran(20260841, [gheCap(ct), gheMoi('b'), gheMoi('c')], luatCua(phienBan));
      st = apLenhMocNav(st, 'a', [{ ma: 'btc', chieu: 'mua', moc_bp: 2500 }]).st;
      const r = giaiQuyetVong(st, THEO);
      return (r.ketQua.ket_qua.find((k) => k.ghe_id === 'a')?.chain
        ?? []) as readonly { kind: string }[];
    };
    const capGo = ['ban_khong', 'luot_song'];
    expect(chayVong1('balance-v18-hequa', capGo).some((m) => m.kind === 'xung_dot'))
      .toBe(true);
    expect(chayVong1('balance-v19-xungdot', capGo).some((m) => m.kind === 'xung_dot'))
      .toBe(false);
    // Cặp CÒN NGHĨA giữ nguyên phạt — v19 là gỡ cặp chết, không phải tắt cơ chế.
    const capGiu = ['mua_duoi', 'chan_lo'];
    expect(chayVong1('balance-v19-xungdot', capGiu).some((m) => m.kind === 'xung_dot'))
      .toBe(true);
  });

  it('song sinh cùng seed: v17 có mắt xích `tu_nhanh`, v18 tuyệt đối không', () => {
    // Tìm seed mà v17 THẬT SỰ sinh nhánh — không có thì phép so là so rỗng.
    let seedCo: number | null = null;
    for (let seed = 1; seed <= 60 && seedCo === null; seed += 1) {
      if (chainCaTran(seed, 'balance-v17-khong')
        .some((m) => m.kind === 'echo' && m.tu_nhanh !== undefined)) seedCo = seed;
    }
    expect(seedCo, 'không seed nào 1..60 sinh nhánh ở v17 — harness hỏng, không phải v18 sạch')
      .not.toBeNull();

    const v18 = chainCaTran(seedCo!, 'balance-v18-hequa');
    expect(v18.filter((m) => m.kind === 'echo' && m.tu_nhanh !== undefined)).toEqual([]);
    // Dư âm của thẻ ĐÃ lật vẫn phải sống — v18 gỡ nhánh, không gỡ trí nhớ giá.
    expect(v18.some((m) => m.kind === 'echo')).toBe(true);
  });
});
