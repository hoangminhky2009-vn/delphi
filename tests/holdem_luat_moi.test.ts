/**
 * LUẬT MỚI 20/07 — stack · nhịp chọn bài · all-in khoá bài · đứng ngoài / đầu hàng.
 *
 * Bốn luật này founder chốt trong một lượt, và chúng KHOÁ LẪN NHAU:
 * bỏ phí giữ tiền thì đứng ngoài thành bến an toàn miễn phí; bỏ nhịp chọn bài
 * thì trần 6 ô thành vô nghĩa; cho đầu hàng giữ hạng thì ai đang dẫn cứ thoát
 * là ăn non. Nên test cả bốn cùng chỗ.
 */
import { describe, expect, it } from 'vitest';
import {
  chotPhien, choiVongCuoc, daKetThuc, dungChuoi, giaiQuyetVong, taoTran, xepHang,
  type Ghe, type TrangThaiTran, type GheMoi,
} from '../server/holdem/engine.js';
import { bayShop, capThe, mua } from '../server/holdem/shop.js';
import {
  HOLDEM_DECISIONS, HOLDEM_MATCH, MAX_BAN_SAO, NHIP_CHON_BAI, PHI_DUNG_NGOAI,
  SO_THE_CHIEN_THUAT, THE_CANH_NHIP, heSoStackBp, loaiTheVong, nhipChonBai,
  TAI_SAN, vongChonChienThuat,
} from '../config/holdem.js';

function ghe(id: string, taiSan: string[] = [], chienThuat: string[] = []): GheMoi {
  return {
    id, loai: 'bot', bac_rank: 'Đồng',
    danh_muc: { tai_san: taiSan, chien_thuat: chienThuat as never },
  };
}
const THEO = () => ({ loai: 'theo' as const });

describe('1. NHỊP CHỌN BÀI — D34: co theo đường cong, All-in mở giữa trận', () => {
  /*
   * ⚠ TEST NÀY KIỂM QUAN HỆ, KHÔNG CHÉP SỐ. Bản trước ghim `toBe(6)` — mà 6 là
   * chính con số nhịp cũ sinh ra, nên nó không kiểm gì ngoài "hằng số bằng chính
   * nó". D34 đổi nhịp thành hàm của CỠ MAP, nên thứ phải giữ là ba bất biến:
   * đủ 3 lần chọn chiến thuật, mốc cuối = ⌈số_ô/2⌉, hai vòng cuối không shop.
   */
  it.each([8, 12, 16])('map %i: đúng 3 lần chọn chiến thuật, mốc cuối = ⌈n/2⌉', (n) => {
    const v = vongChonChienThuat(n);
    expect(v).toHaveLength(SO_THE_CHIEN_THUAT);
    expect(v).toHaveLength(HOLDEM_MATCH.MAX_CHIEN_THUAT);
    expect(v[0], 'D34: chọn thẻ chiến thuật TỪ VÒNG 2').toBe(2);
    expect(v[v.length - 1], 'All-in mở đúng GIỮA TRẬN').toBe(Math.ceil(n / 2));
    // Tăng nghiêm ngặt — không được có hai lần chọn dồn vào một vòng.
    expect([...v].sort((a, b) => a - b)).toEqual(v);
    expect(new Set(v).size).toBe(v.length);
    // Nhịp phải khai đúng ba vòng đó là 'chien_thuat', không lệch một ô.
    const nhip = nhipChonBai(n);
    expect(nhip.filter((x) => x === 'chien_thuat')).toHaveLength(SO_THE_CHIEN_THUAT);
    for (const x of v) expect(nhip[x - 1]).toBe('chien_thuat');
  });

  it('map 12 (mặc định D31) ra ĐÚNG 2·4·6 — luật cũ là trường hợp riêng', () => {
    expect(vongChonChienThuat(12)).toEqual([2, 4, 6]);
  });

  it('map 8 · 12 · 16 — All-in mở ở đúng 50% số vòng', () => {
    for (const n of [8, 12, 16]) {
      const moO = vongChonChienThuat(n)[SO_THE_CHIEN_THUAT - 1]!;
      expect(moO / n, `map ${n}`).toBeCloseTo(0.5, 5);
    }
  });

  it.each([8, 12, 16])('map %i: hai vòng CUỐI không có shop', (n) => {
    expect(loaiTheVong(n - 1, n)).toBe('khong');
    expect(loaiTheVong(n, n)).toBe('khong');
    expect(loaiTheVong(n - 2, n)).not.toBe('khong');
  });

  it('bảng mặc định của catalog khớp map mặc định — không có nguồn thứ hai', () => {
    expect(NHIP_CHON_BAI).toEqual(nhipChonBai(HOLDEM_DECISIONS.MAP_SIZE));
  });

  /*
   * ⚠ HAI TEST DƯỚI ĐÂY ĐỔI CHIỀU 27/07 — luật đổi, không phải test hỏng.
   *
   * Bản cũ khoá HAI chiều: vòng tài sản không lấy được chiến thuật VÀ vòng chiến
   * thuật không lấy được tài sản; vòng 7·8 thì không mua được gì. Founder chốt
   * (spec 01 §7): **chợ TÀI SẢN mở ở MỌI vòng**, nhịp chỉ còn gác THẺ CHIẾN THUẬT.
   *
   * Vì sao phải đổi: đo trên map thật (8 ô) thì chỉ 3/8 vòng đụng được tài sản —
   * đúng thứ founder than là *"thẻ tiếp theo lật thì đ** có gì xảy ra"*.
   * Chi tiết: `docs/thiet-ke-da-chot/00-ra-co-che-27-07.md` §4.
   */
  it('nhịp CHỈ gác thẻ chiến thuật — vòng tài sản không lấy được chiến thuật', () => {
    const s = bayShop(11, 3, 'g', 0, { tai_san: [], chien_thuat: [] });
    const r1 = mua({ tai_san: [], chien_thuat: [] }, s, s.chien_thuat[0]!, { vong: 1 });
    expect(r1.ok, 'vòng 1 là vòng tài sản → không được lấy thẻ chiến thuật').toBe(false);
    if (!r1.ok) expect(r1.loi).toBe('sai_nhip_vong');
  });

  it('CHIỀU NGƯỢC LẠI NAY MỞ — vòng chiến thuật VẪN mua được tài sản', () => {
    const s = bayShop(11, 3, 'g', 0, { tai_san: [], chien_thuat: [] });
    const r = mua({ tai_san: [], chien_thuat: [] }, s, s.tai_san[0]!, { vong: 3 });
    expect(r.ok, 'chợ tài sản phải mở ở mọi vòng').toBe(true);
  });

  it('vòng 7·8 (không có thẻ chiến thuật) VẪN mua được tài sản', () => {
    for (const vong of [7, 8]) {
      const s = bayShop(11, vong, 'g', 0, { tai_san: [], chien_thuat: [] });
      const r = mua({ tai_san: [], chien_thuat: [] }, s, s.tai_san[0]!, { vong });
      expect(r.ok, `vòng ${vong} phải mua được tài sản — nếu không thì đây là vòng chết`)
        .toBe(true);
      const rct = mua({ tai_san: [], chien_thuat: [] }, s, s.chien_thuat[0]!, { vong });
      expect(rct.ok, `vòng ${vong} KHÔNG được bày thẻ chiến thuật`).toBe(false);
    }
  });

  it('chợ bày ĐỦ 6 mã ở mọi vòng, thứ tự ỔN ĐỊNH (bảng giá phải đọc được)', () => {
    const v1 = bayShop(11, 1, 'g', 0, { tai_san: [], chien_thuat: [] }).tai_san;
    const v5 = bayShop(11, 5, 'g', 0, { tai_san: [], chien_thuat: [] }).tai_san;
    expect(v1).toHaveLength(TAI_SAN.length);
    expect(v5, 'thứ tự nhảy chỗ mỗi vòng = bảng giá không so sánh được').toEqual(v1);
  });
});

describe('2. STACK — cấp tăng dần, KHÔNG tuyến tính', () => {
  it('hệ số giảm dần: lá 3 thêm ít hơn lá 1 (dồn phải có giá)', () => {
    const b1 = heSoStackBp(1); const b2 = heSoStackBp(2); const b3 = heSoStackBp(3);
    expect(b1).toBe(10000);
    expect(b2 - b1, 'lá thứ hai thêm').toBeLessThan(b1);
    expect(b3 - b2, 'lá thứ ba thêm còn ít hơn nữa').toBeLessThan(b2 - b1);
  });

  it('quá MAX_BAN_SAO thì kẹp, không trả hệ số chưa định nghĩa', () => {
    expect(heSoStackBp(99)).toBe(heSoStackBp(MAX_BAN_SAO));
  });

  it('🔴 3 lá BTC KHÔNG bằng 3 lần 1 lá — đây là chỗ dễ sai nhất', () => {
    const mot = taoTran(4242, [ghe('a', ['btc'])]);
    const ba = taoTran(4242, [ghe('a', ['btc', 'btc', 'btc'])]);
    const p1 = dungChuoi(mot, mot.ghe[0]!, mot.map.o[0]!).pnl_bp;
    const p3 = dungChuoi(ba, ba.ghe[0]!, ba.map.o[0]!).pnl_bp;
    expect(Math.abs(p3)).toBeLessThan(Math.abs(p1 * 3));
  });

  it('chain ghi CẤP để UI hiện được ¹²³', () => {
    const st = taoTran(7, [ghe('a', ['btc', 'btc'])]);
    const m = dungChuoi(st, st.ghe[0]!, st.map.o[0]!)
      .chain.find((x) => x.kind === 'tai_san');
    expect(m && 'cap' in m && m.cap).toBe(2);
  });

  it('nhiễu rút MỘT lần mỗi mã, không nhân phương sai theo bản sao', () => {
    // Nếu nhiễu rút lại theo từng bản sao thì tỷ lệ p2/p1 sẽ trôi lung tung
    // giữa các seed. Ràng buộc đúng hệ số chứng minh chỉ rút một lần.
    for (const seed of [1, 2, 3, 99, 12345]) {
      const mot = taoTran(seed, [ghe('a', ['vang'])]);
      const hai = taoTran(seed, [ghe('a', ['vang', 'vang'])]);
      const p1 = dungChuoi(mot, mot.ghe[0]!, mot.map.o[0]!).pnl_bp;
      const p2 = dungChuoi(hai, hai.ghe[0]!, hai.map.o[0]!).pnl_bp;
      expect(Math.sign(p2), `seed ${seed} phải cùng dấu`).toBe(Math.sign(p1));
      expect(Math.abs(p2), `seed ${seed} phải mạnh hơn`).toBeGreaterThanOrEqual(Math.abs(p1));
      expect(Math.abs(p2), `seed ${seed} nhưng chưa gấp đôi`).toBeLessThan(Math.abs(p1) * 2);
    }
  });

  it('bản sao không tốn ô, nhưng mã MỚI thì tốn', () => {
    const s = bayShop(21, 1, 'g', 0, { tai_san: [], chien_thuat: [] });
    const ts = s.tai_san[0]!;
    const day = { tai_san: [ts, 'a1', 'a2', 'a3'], chien_thuat: [] };
    expect(mua(day, s, ts, { vong: 1 }).ok, 'nâng cấp mã đang có').toBe(true);
    expect(capThe({ tai_san: [ts, ts], chien_thuat: [] }, ts)).toBe(2);
  });
});

describe('3. ALL IN — khoá bài tới hết trận', () => {
  it('dồn hết vốn thì vào tư thế all_in', () => {
    const st = taoTran(31, [
      ghe('a', ['btc'], ['don_bay']), ghe('b', ['vang']), ghe('c', ['usd']),
    ]);
    const r = giaiQuyetVong(st, (c) => (
      c.ghe_id === 'a' && c.duoc.includes('to')
        ? { loai: 'to' as const, them: c.to_toi_da }
        : { loai: 'theo' as const }));
    const a = r.trangThai.ghe.find((g) => g.id === 'a')!;
    expect(a.tu_the, 'dồn hết vốn thì phải vào tư thế all_in').toBe('all_in');
    expect(a.vong_roi).toBe(1);
  });

  it('🔴 ALL IN SỚM (chưa có chiến thuật) thì KHÔNG khoá — chỉ là cược 100%', () => {
    // Founder nói rõ 20/07: "All in những vòng đầu thì không sao chỉ là cược
    // 100% vốn nhưng bắt đầu từ sau vòng chọn chiến thuật đầu tiên thì all-in
    // sẽ đóng tất cả lựa chọn tiếp theo... đủ điều kiện (có ít nhất 1 lá bài
    // chiến thuật)".
    const st = taoTran(41, [ghe('a', ['btc']), ghe('b', ['vang']), ghe('c', ['usd'])]);
    const r = giaiQuyetVong(st, (c) => (
      c.ghe_id === 'a' && c.duoc.includes('to')
        ? { loai: 'to' as const, them: c.to_toi_da } : { loai: 'theo' as const }));
    const a = r.trangThai.ghe.find((g) => g.id === 'a')!;
    expect(a.tu_the, 'chưa có chiến thuật thì all-in không khoá gì cả').toBe('choi');
  });

  it('CÓ chiến thuật rồi all-in → khoá thật', () => {
    const st = taoTran(41, [
      ghe('a', ['btc'], ['don_bay']), ghe('b', ['vang']), ghe('c', ['usd']),
    ]);
    const r = giaiQuyetVong(st, (c) => (
      c.ghe_id === 'a' && c.duoc.includes('to')
        ? { loai: 'to' as const, them: c.to_toi_da } : { loai: 'theo' as const }));
    expect(r.trangThai.ghe.find((g) => g.id === 'a')!.tu_the).toBe('all_in');
  });

  it('🔴 ALL IN xong trận phải CHẠY TIẾP tới hết map, không kết thúc luôn', () => {
    // Founder 20/07: "All in không lật hết bài ngay mà lật đúng 1 lá sau đó rồi
    // báo kết quả luôn".
    //
    // Gốc: `daKetThuc` từng đếm ghế CÒN CƯỢC. Người chơi all-in thì bot buộc
    // phải theo giá nên cũng all-in theo — gần cả bàn rời tư thế 'choi', số ghế
    // "còn cược" tụt xuống ≤1, và trận đóng ngay sau đúng một vòng.
    // All-in KHÔNG phải rời trận: đó chính là lúc phải lật nốt board.
    let st = taoTran(77, [
      ghe('a', ['btc'], ['don_bay']), ghe('b', ['vang'], ['chan_lo']),
      ghe('c', ['usd'], ['phong_ho']), ghe('d', ['vn30'], ['don_bay']),
      ghe('e', ['cp_cn'], ['chan_lo']),
    ]);
    st = giaiQuyetVong(st, (c) => (
      c.duoc.includes('to') ? { loai: 'to' as const, them: c.to_toi_da }
        : { loai: 'theo' as const })).trangThai;

    const soAllIn = st.ghe.filter((g) => g.tu_the === 'all_in').length;
    expect(soAllIn, 'phải có nhiều ghế all-in để tái hiện đúng tình huống')
      .toBeGreaterThan(1);
    expect(daKetThuc(st), 'cả bàn all-in KHÔNG phải là hết trận').toBe(false);
  });

  it('chỉ hết trận khi ≤1 ghế còn TRONG trận (cháy / đầu hàng mới là ra)', () => {
    const st0 = taoTran(78, [ghe('a'), ghe('b'), ghe('c')]);
    const st = {
      ...st0,
      ghe: st0.ghe.map((g) => {
        if (g.id === 'b') return { ...g, da_chay: true, vong_chay: 1 };
        if (g.id === 'c') return { ...g, tu_the: 'dau_hang' as const, vong_roi: 1 };
        return g;
      }),
    };
    expect(daKetThuc(st)).toBe(true);
  });

  it('đã all_in thì shop TỪ CHỐI, kể cả đúng nhịp vòng', () => {
    const s = bayShop(5, 1, 'g', 0, { tai_san: [], chien_thuat: [] });
    const r = mua({ tai_san: [], chien_thuat: [] }, s, s.tai_san[0]!,
      { vong: 1, daAllIn: true });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.loi).toBe('da_all_in');
  });
});

describe('4. ĐỨNG NGOÀI — vốn đóng băng KHÔNG có nghĩa là vốn an toàn', () => {
  function banCoNguoiDungNgoai(seed: number, vong = 1): TrangThaiTran {
    const st = taoTran(seed, [
      ghe('a', ['btc']), ghe('b', ['vang']), ghe('c', ['usd']),
    ]);
    return {
      ...st, vong,
      ghe: st.ghe.map((g) => (g.id === 'a'
        ? { ...g, tu_the: 'dung_ngoai' as const, vong_roi: 1 } : g)),
    };
  }

  it('KHÔNG bị hỏi lượt và KHÔNG phải đóng cược nền', () => {
    const st = banCoNguoiDungNgoai(1);
    const tt = choiVongCuoc(st, THEO);
    expect(tt.gop.has('a'), 'đóng băng mà vẫn bị trừ cược nền là nói dối').toBe(false);
  });

  it('🔴 nhưng BỊ BÀO mỗi vòng — nếu không thì đứng ngoài là bến an toàn', () => {
    const st = banCoNguoiDungNgoai(2);
    const vonTruoc = st.ghe.find((g) => g.id === 'a')!.von;
    const { trangThai, ketQua } = chotPhien(st, choiVongCuoc(st, THEO));
    const a = trangThai.ghe.find((g) => g.id === 'a')!;
    expect(a.von).toBeLessThan(vonTruoc);
    expect(ketQua.phi_dung_ngoai.find((p) => p.ghe_id === 'a')!.mat)
      .toBeGreaterThan(0);
  });

  it('vòng có LẠM PHÁT thì bào nặng hơn vòng thường', () => {
    let matThuong = -1; let matLamPhat = -1;
    for (let seed = 0; seed < 400 && (matThuong < 0 || matLamPhat < 0); seed += 1) {
      for (let v = 1; v <= 8; v += 1) {
        const st = banCoNguoiDungNgoai(seed, v);
        const o = st.map.o[v - 1]!;
        const { ketQua } = chotPhien(st, choiVongCuoc(st, THEO));
        const mat = ketQua.phi_dung_ngoai.find((p) => p.ghe_id === 'a')?.mat ?? 0;
        const laLamPhat = o.kind === 'su_kien' && o.su_kien === 'lam_phat';
        if (laLamPhat && matLamPhat < 0) matLamPhat = mat;
        if (!laLamPhat && matThuong < 0) matThuong = mat;
      }
    }
    expect(matLamPhat, 'phải tìm được vòng lạm phát để đo').toBeGreaterThan(0);
    expect(matLamPhat).toBeGreaterThan(matThuong);
  });

  it('phí không bao giờ đẩy vốn xuống âm', () => {
    const st0 = banCoNguoiDungNgoai(3);
    const st = { ...st0, ghe: st0.ghe.map((g) => (g.id === 'a' ? { ...g, von: 1 } : g)) };
    const { trangThai } = chotPhien(st, choiVongCuoc(st, THEO));
    expect(trangThai.ghe.find((g) => g.id === 'a')!.von).toBeGreaterThanOrEqual(0);
  });

  it('VẪN được tính hạng — đứng ngoài không phải bỏ cuộc', () => {
    const st = banCoNguoiDungNgoai(4);
    expect(xepHang(st)).toContain('a');
  });

  it('phí nền phải KHÁC 0, không thì cả cơ chế vô nghĩa', () => {
    expect(PHI_DUNG_NGOAI.NEN_BP).toBeGreaterThan(0);
    expect(PHI_DUNG_NGOAI.LAM_PHAT_BP).toBeGreaterThan(0);
  });
});

describe('5. ĐẦU HÀNG — thoát là thua, không có hạng để giữ', () => {
  it('🔴 xếp BÉT, dưới cả người đã cháy — dù vốn đang cao nhất', () => {
    // Đây là lỗ hổng founder bịt: nếu đầu hàng giữ hạng thì ai đang dẫn ở
    // vòng 3 cứ thoát là ăn non được hạng đẹp.
    const st0 = taoTran(9, [ghe('a'), ghe('b'), ghe('c')]);
    const st: TrangThaiTran = {
      ...st0,
      ghe: st0.ghe.map((g) => {
        if (g.id === 'a') {
          return { ...g, von: 99999, tu_the: 'dau_hang' as const, vong_roi: 3 };
        }
        if (g.id === 'b') return { ...g, von: 10, da_chay: true, vong_chay: 2 };
        return { ...g, von: 20 };
      }),
    };
    const hang = xepHang(st);
    expect(hang[hang.length - 1], 'đầu hàng phải bét bảng').toBe('a');
    expect(hang.indexOf('b')).toBeLessThan(hang.indexOf('a'));
  });

  it('bỏ cuộc SỚM hơn thì xếp dưới — bỏ sớm là bỏ nhiều hơn', () => {
    const st0 = taoTran(10, [ghe('a'), ghe('b')]);
    const st: TrangThaiTran = {
      ...st0,
      ghe: st0.ghe.map((g) => ({
        ...g, tu_the: 'dau_hang' as const, vong_roi: g.id === 'a' ? 2 : 6,
      })),
    };
    expect(xepHang(st)).toEqual(['b', 'a']);
  });

  it('KHÔNG bị hỏi lượt cược', () => {
    const st0 = taoTran(11, [ghe('a'), ghe('b'), ghe('c')]);
    const st = {
      ...st0,
      ghe: st0.ghe.map((g) => (g.id === 'a'
        ? { ...g, tu_the: 'dau_hang' as const, vong_roi: 1 } : g)),
    };
    expect(choiVongCuoc(st, THEO).gop.has('a')).toBe(false);
  });
});

/**
 * 6. KHÔNG THẺ NÀO ĐƯỢC LÀ Ô CHẾT.
 *
 * ⚠ Test này tồn tại vì một chẩn đoán SAI kéo dài. Tôi báo founder ba lần rằng
 * bot "Bắt đáy" có ALPHA GIẢ và quy vào D22. Sự thật khác hẳn: `bat_day`,
 * `mua_duoi`, `da_dang_hoa` KHÔNG có cơ chế nào trong engine — chúng là tên gọi
 * không có hành vi. Bot "Bắt đáy" cầm ['bat_day','chia_lenh'] thực chất là cầm
 * MỘT lá giảm trượt giá cộng MỘT Ô CHẾT KHÔNG MẤT PHÍ.
 *
 * Bài học đắt: "bot X mạnh bất thường" KHÔNG đủ để kết luận cơ chế X mạnh.
 * Phải đếm xem X có cơ chế nào không đã.
 */
describe('6. Ô CHẾT — mọi thẻ phải có hành vi đo được', () => {
  const CHIEN_THUAT_IDS = [
    'mua_duoi', 'luot_song', 'bat_day', 'chan_lo', 'phong_ho',
    'don_bay', 'ban_khong', 'khop_nhanh', 'chia_lenh', 'da_dang_hoa',
  ] as const;

  it('🔴 MỖI chiến thuật phải đổi được kết quả ở ÍT NHẤT một tình huống', () => {
    for (const ct of CHIEN_THUAT_IDS) {
      let doiDuoc = false;
      // Quét nhiều seed và nhiều vòng: mỗi thẻ có điều kiện kích hoạt riêng
      // (có thẻ cần sự kiện, có thẻ cần giai đoạn trước cụ thể, có thẻ cần đông).
      // BÀN ĐÔNG, cùng ôm một mã: bắt buộc, vì `khop_nhanh` và `chia_lenh` chỉ
      // có nghĩa khi có crowding. Bàn một ghế thì hai thẻ đó trông như ô chết
      // trong khi chúng hoàn toàn có cơ chế — test phải dựng đúng điều kiện
      // kích hoạt, nếu không nó tố oan.
      const ban = (them: readonly string[]) => [
        ghe('a', ['btc', 'vn30'], them as string[]),
        ghe('b', ['btc', 'vn30']),
        ghe('c', ['btc', 'vn30']),
      ];
      for (let seed = 0; seed < 120 && !doiDuoc; seed += 1) {
        for (let v = 1; v <= 8 && !doiDuoc; v += 1) {
          const khong = { ...taoTran(seed, ban([])), vong: v };
          const co = { ...taoTran(seed, ban([ct])), vong: v };
          const p1 = dungChuoi(khong, khong.ghe[0]!, khong.map.o[v - 1]!).pnl_bp;
          const p2 = dungChuoi(co, co.ghe[0]!, co.map.o[v - 1]!).pnl_bp;
          if (p1 !== p2) doiDuoc = true;
        }
      }
      expect(doiDuoc, `"${ct}" là Ô CHẾT — không đổi kết quả ở bất kỳ tình huống nào`)
        .toBe(true);
    }
  });

  it('thẻ canh nhịp có PHƯƠNG SAI nhưng KHÔNG có lợi thế (D22)', () => {
    // "Động cơ giá timing vô dụng là ĐÚNG, không phải lỗi" — người chơi vẫn
    // đuổi giá dù vô ích, và chính sự bốc đồng đó mới là dữ liệu đáng bán.
    for (const id of ['bat_day', 'mua_duoi'] as const) {
      const l = THE_CANH_NHIP[id];
      expect(l.trung_bp, `${id}: bắt trúng phải có thưởng`).toBeGreaterThan(0);
      expect(Math.abs(l.truot_bp), `${id}: bắt trượt phải phạt NẶNG HƠN thưởng`)
        .toBeGreaterThan(l.trung_bp);
    }
  });

  it('Đa dạng hoá thưởng theo SỐ MÃ, và một mã thì lỗ', () => {
    const doVoi = (soMa: number) => {
      const ts = ['btc', 'vn30', 'vang', 'usd'].slice(0, soMa);
      const st = taoTran(5, [ghe('a', ts, ['da_dang_hoa'])]);
      return dungChuoi(st, st.ghe[0]!, st.map.o[0]!)
        .chain.find((m) => m.kind === 'da_dang')?.delta_bp ?? 0;
    };
    expect(doVoi(1), 'dồn một mã thì đa dạng hoá là phí suông').toBeLessThan(0);
    expect(doVoi(4)).toBeGreaterThan(doVoi(2));
  });
});
