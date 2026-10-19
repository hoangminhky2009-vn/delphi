/**
 * D342 — LÕI BÁN KHỐNG (cổng `balance-v49-bankhong`). Vector tay đi TRƯỚC (A8.3).
 *
 * BỐN LỖI ĐƯỢC SỬA, cả bốn lòi ra từ MỘT trận founder chơi 16/09 20:52 (bàn 16 ô, v48):
 *
 * 1. SỔ KHỐNG KHÔNG CHẠY THEO GIÁ. `dungChuoi` chỉ dựng mắt xích giá cho mã trong
 *    `danh_muc.tai_san` — gương của SỔ DÀI — nên khống một mã mình không cầm dài nhận
 *    0bp giá. Trận founder: vòng 9 (Sập sàn) btc −92,98% mà ký quỹ khống chỉ +490, toàn bộ
 *    từ hiệu ứng thẻ; vòng 7 btc +28%, vòng 10 −61% ⇒ khống đứng im 0. Có từ v17 (01/08).
 *    Còn khi CÓ cầm dài cùng mã thì sổ khống đảo dấu CẢ phần chen chúc của sổ dài.
 * 2. CHIP KHỐNG TÍNH TRÊN TIỀN MẶT mà trần là 30% NAV ⇒ 50–100% gần như luôn vượt ⇒
 *    `qua_tran_khong` ⇒ server bác CẢ CHUỖI (vòng 4 và 6 mất luôn lệnh "RÚT btc HẾT").
 * 3. LÁ BÁN KHỐNG CỘNG/TRỪ CẢ DANH MỤC THEO TIN (di tích thời chưa có sổ khống thật) —
 *    vòng 12 (Hạ lãi suất) nó trừ 15% vào cả vị thế dài btc.
 * 4. `xep_hang` MANG MÃ MÀ RƠI XUỐNG TẦNG DANH MỤC — họ lỗi D338–D340: phạt xếp hàng vào
 *    một mã áp lên MỌI vị thế, kể cả sổ khống.
 *
 * ⚠ Bot KHÔNG BAO GIỜ khống, nên gate G1–G5 không đo được lỗi 1–2 (vì vậy nó sống 6 tuần).
 * Phép đo thật của cổng này nằm ở các bài dưới + cặp song sinh ghi ở D342.
 */
import { describe, expect, it } from 'vitest';
import {
  BAN_KHONG_LENH, MT_CHIEN_THUAT_SU_KIEN, NAV_V10, khauViCua,
} from '../config/holdem.js';
import { luatCua } from '../config/holdem_balance.js';
import {
  apDinhGia, apLenhGiaoDich, giaiLenhMoc, hanMucKhongCon, type GheNav, type LenhMoc,
} from '../server/holdem/nav.js';
import {
  apLenhMocNav, dungChuoi, giaiQuyetVong, tangCuaMatXich, taoTran,
  type GheMoi, type MatXich, type TrangThaiTran,
} from '../server/holdem/engine.js';
import { applyBpInt } from '../server/sandbox/rng.js';

const V49 = luatCua('balance-v49-bankhong');
const V48 = luatCua('balance-v48-doitac');
type Luat = typeof V49;
const THEO = () => ({ loai: 'theo' }) as never;
const KY_QUY = 2000;

/** Ký quỹ sau định giá khi lợi suất của CHÍNH sổ khống là `rBp` và tầng danh mục bằng 0. */
const sauKhong = (truoc: number, rBp: number): number =>
  Math.max(0, Math.floor((truoc * (10000 + rBp)) / 10000));

describe('0. VECTOR TAY — số lấy thẳng từ trận founder 16/09 (vòng 9 và vòng 4)', () => {
  /** Vòng 9: tiền 9.868, không cầm dài, đang khống btc 2.421 ⇒ NAV 12.289. */
  const g9 = (): GheNav => ({ von: 9868, vi_the: {}, vi_the_khong: { btc: 2421 } });

  it('trần 30% NAV: floor(12.289 × 30%) = 3.686, đang 2.421 ⇒ hạn mức còn 1.265', () => {
    expect(BAN_KHONG_LENH.TRAN_BP).toBe(3000);
    expect(hanMucKhongCon(g9())).toBe(1265);
  });

  it('hạn mức không vượt TIỀN MẶT, và không bao giờ âm', () => {
    // NAV 10.000 ⇒ trần 3.000, nhưng chỉ còn 500 tiền mặt để đặt ký quỹ.
    expect(hanMucKhongCon({ von: 500, vi_the: { vang: 9500 }, vi_the_khong: {} })).toBe(500);
    // Giá chạy làm sổ khống vượt trần (5.000 > floor(5.100 × 30%) = 1.530) ⇒ 0, không âm.
    expect(hanMucKhongCon({ von: 100, vi_the: {}, vi_the_khong: { btc: 5000 } })).toBe(0);
  });

  it('⭐ v49: chip KHỐNG 100% = đúng hạn mức 1.265 · v48: 100% tiền mặt 9.868 ⇒ bác cả chuỗi', () => {
    const lenh: LenhMoc[] = [{ ma: 'btc', chieu: 'khong', moc_bp: 10000 }];
    const moi = giaiLenhMoc(g9(), lenh, false, { coBanKhong: true, khongTheoHanMuc: true });
    expect(moi.loi).toBeNull();
    expect(moi.lenh).toEqual([{ ma: 'btc', tien: 1265, khong: true }]);
    expect(giaiLenhMoc(g9(), lenh, false, { coBanKhong: true }).loi).toBe('qua_tran_khong');
  });

  it('v49: chip 25% = floor(1.265 × 25%) = 316 ⇒ về bước 10 = 310', () => {
    expect(NAV_V10.BUOC_TIEN).toBe(10);
    const r = giaiLenhMoc(g9(), [{ ma: 'btc', chieu: 'khong', moc_bp: 2500 }], false,
      { coBanKhong: true, khongTheoHanMuc: true });
    expect(r.lenh).toEqual([{ ma: 'btc', tien: 310, khong: true }]);
  });

  it('v49: hai chip 100% liền nhau — chuỗi KHÔNG bị bác, tổng khống không vượt trần', () => {
    const lenh: LenhMoc[] = [
      { ma: 'btc', chieu: 'khong', moc_bp: 10000 }, { ma: 'vang', chieu: 'khong', moc_bp: 10000 },
    ];
    const r = giaiLenhMoc(g9(), lenh, false, { coBanKhong: true, khongTheoHanMuc: true });
    expect(r.loi).toBeNull();
    expect(r.lenh[0]).toEqual({ ma: 'btc', tien: 1265, khong: true });
    const nhap = g9();
    expect(apLenhGiaoDich(nhap, r.lenh).loi, 'chuỗi đã giải phải áp được').toBeNull();
  });

  it('⭐ founder vòng 4 [RÚT btc HẾT, KHỐNG btc 100%]: v49 chạy CẢ HAI · v48 bác CẢ chuỗi', () => {
    const g4 = (): GheNav => ({ von: 0, vi_the: { btc: 9613 }, vi_the_khong: { btc: 3200 } });
    const lenh: LenhMoc[] = [
      { ma: 'btc', chieu: 'ban', moc_bp: 10000 }, { ma: 'btc', chieu: 'khong', moc_bp: 10000 },
    ];
    const moi = giaiLenhMoc(g4(), lenh, false,
      { coBanKhong: true, khongTheoHanMuc: true, voiVang: true });
    expect(moi.loi).toBeNull();
    expect(moi.lenh[0]).toEqual({ ma: 'btc', tien: -9613 });
    // Cú khống lấy ĐÚNG hạn mức SAU cú bán (tiền đã về) — không phải tiền mặt đầu vòng (0).
    const sauBan = g4();
    apLenhGiaoDich(sauBan, [moi.lenh[0]!], { voiVang: true });
    expect(hanMucKhongCon(sauBan)).toBeGreaterThan(0);
    expect(moi.lenh[1]).toEqual({ ma: 'btc', tien: hanMucKhongCon(sauBan), khong: true });
    expect(giaiLenhMoc(g4(), lenh, false, { coBanKhong: true, voiVang: true }).loi)
      .toBe('qua_tran_khong');
  });

  it('định giá bằng lợi suất RIÊNG của sổ khống: 2.421 × (1 + 92,98%) = 4.672', () => {
    const g: GheNav = { von: 0, vi_the: {}, vi_the_khong: { btc: 2421 } };
    const r = apDinhGia(g, {}, 0, { btc: 9298 });
    expect(g.vi_the_khong!.btc).toBe(4672);
    expect(r.tien_theo_ma['khong:btc']).toBe(2251);
  });

  it('dài và khống cùng mã đọc HAI bảng riêng: chen chúc của sổ dài không chạm sổ khống', () => {
    const g: GheNav = { von: 0, vi_the: { btc: 1000 }, vi_the_khong: { btc: 1000 } };
    // Sổ dài: giá −10% và chen chúc −3,6%. Sổ khống: ngược ĐÚNG giá chợ, +10%.
    apDinhGia(g, { btc: -1360 }, 0, { btc: 1000 });
    expect(g.vi_the.btc).toBe(864);
    expect(g.vi_the_khong!.btc).toBe(1100);
  });

  it('không truyền bảng khống (trận ≤ v48) ⇒ đúng số học cũ: đảo dấu bảng sổ dài', () => {
    const g: GheNav = { von: 0, vi_the: {}, vi_the_khong: { btc: 988 } };
    apDinhGia(g, { btc: -500 }, 0);
    expect(g.vi_the_khong!.btc).toBe(1037);
  });
});

/**
 * Bàn 3 ghế đặt tay: ghế `a` KHỐNG btc 2.000 (tuỳ chọn cầm dài btc / khẩu vị / Đòn Bẩy).
 * Tiền mặt 5.000 ⇒ nền vòng trừ từ tiền, không chạm sổ khống. Không `tai_san_truoc` ⇒ không
 * xếp hàng. Không thẻ ⇒ tầng danh mục bằng 0, nên tiền sổ khống đọc được bằng một phép nhân.
 */
function banKhong(
  seed: number, luat: Luat, vong: number,
  tuy: { daiBtc?: boolean; khauVi?: 'quyet_liet'; donBay?: boolean } = {},
): TrangThaiTran {
  const moi = (id: string, the: string[] = []): GheMoi => ({
    id, loai: 'bot', bac_rank: 'Đồng',
    danh_muc: { tai_san: [], chien_thuat: the as never },
    ...(id === 'a' && tuy.khauVi ? { khau_vi: tuy.khauVi } : {}),
  });
  const st = taoTran(seed, [moi('a', tuy.donBay ? ['don_bay'] : []), moi('b'), moi('c')], luat, 12);
  const dai = tuy.daiBtc ? 'btc' : 'vang';
  return {
    ...st, vong,
    ghe: st.ghe.map((g) => ({
      ...g, von: 5000,
      vi_the: g.id === 'a' && !tuy.daiBtc ? {} : { [dai]: 3000 },
      danh_muc: { ...g.danh_muc, tai_san: g.id === 'a' && !tuy.daiBtc ? [] : [dai] },
      ...(g.id === 'a' ? { vi_the_khong: { btc: KY_QUY } } : {}),
    })),
  };
}

function chot(st: TrangThaiTran) {
  const r = giaiQuyetVong(st, THEO);
  return {
    r, cong: r.loiSuatCong!.btc!,
    a: r.ketQua.ket_qua.find((k) => k.ghe_id === 'a')!,
  };
}

describe('I. ⭐⭐ LÕI — sổ khống ăn NGƯỢC ĐÚNG giá chợ (founder chốt 16/09)', () => {
  it('v49: ghế CHỈ khống btc — ký quỹ đổi đúng ngược lợi suất công khai, mọi vòng', () => {
    let coGia = 0;
    for (let seed = 1; seed <= 20; seed += 1) {
      for (let v = 1; v <= 12; v += 1) {
        const { cong, a } = chot(banKhong(seed, V49, v));
        expect(a.tien_theo_ma?.['khong:btc'], `seed ${seed} v${v} btc ${cong}bp`)
          .toBe(sauKhong(KY_QUY, -cong) - KY_QUY);
        const mx = a.chain.find((m) => m.kind === 'khong_gia');
        if (cong === 0) continue;
        expect(mx, `seed ${seed} v${v}: thiếu dòng giá của sổ khống`)
          .toMatchObject({ id: 'btc', gia_bp: cong, delta_bp: -cong });
        coGia += 1;
      }
    }
    expect(coGia, 'không vòng nào btc đổi giá — bài rỗng').toBeGreaterThan(100);
  });

  it('⚠ v48 (lỗi cũ, giữ nguyên cho replay): ghế chỉ khống thì ký quỹ KHÔNG nhúc nhích theo giá', () => {
    let coGia = 0;
    for (let seed = 1; seed <= 20; seed += 1) {
      for (let v = 1; v <= 12; v += 1) {
        const { cong, a } = chot(banKhong(seed, V48, v));
        if (cong === 0) continue;
        expect(a.tien_theo_ma?.['khong:btc'], `seed ${seed} v${v}`).toBe(0);
        expect(a.chain.some((m) => m.kind === 'khong_gia')).toBe(false);
        coGia += 1;
      }
    }
    expect(coGia).toBeGreaterThan(100);
  });

  it('v49: vừa dài vừa khống btc (cả bàn cầm btc ⇒ có chen chúc) — khống KHÔNG ăn ngược chen chúc', () => {
    let coChen = 0;
    for (let seed = 1; seed <= 20; seed += 1) {
      for (let v = 1; v <= 12; v += 1) {
        const { cong, a } = chot(banKhong(seed, V49, v, { daiBtc: true }));
        expect(a.tien_theo_ma?.['khong:btc'], `seed ${seed} v${v}`)
          .toBe(sauKhong(KY_QUY, -cong) - KY_QUY);
        if (a.chain.some((m) => m.kind === 'crowding' && (m as { id: string }).id === 'btc')) coChen += 1;
      }
    }
    expect(coChen, 'không vòng nào có chen chúc — bài không chứng minh được gì').toBeGreaterThan(100);
  });

  it('dòng giá của sổ khống thuộc TẦNG KHỐNG, không rơi vào tầng mã hay tầng danh mục', () => {
    const st = banKhong(3, V49, 5);
    const { a } = chot(st);
    const mx = a.chain.find((m) => m.kind === 'khong_gia')!;
    expect(tangCuaMatXich(st, mx)).toEqual({ tang: 'khong', ma: 'btc' });
  });
});

describe('II. khẩu vị và Đòn Bẩy nhân ĐÚNG phần khống của mã', () => {
  it('v49 quyết liệt: một dòng khau_vi mang {ma, khong} = phần khống × (1,35 − 1), tiền khớp', () => {
    const k = khauViCua('quyet_liet').he_so_bp;
    expect(k).toBe(13500);
    let coNhan = 0;
    for (let seed = 1; seed <= 20; seed += 1) {
      for (let v = 1; v <= 12; v += 1) {
        const { cong, a } = chot(banKhong(seed, V49, v, { khauVi: 'quyet_liet' }));
        const r0 = -cong;
        const d = applyBpInt(r0, k) - r0;
        const kv = a.chain.find((m) => m.kind === 'khau_vi'
          && (m as { ma?: string }).ma === 'btc' && (m as { khong?: boolean }).khong === true);
        if (d === 0) expect(kv).toBeUndefined();
        else { expect(kv?.delta_bp, `seed ${seed} v${v}`).toBe(d); coNhan += 1; }
        expect(a.tien_theo_ma?.['khong:btc'], `seed ${seed} v${v}`)
          .toBe(sauKhong(KY_QUY, r0 + d) - KY_QUY);
        expect(a.chain.some((m) => m.kind === 'khau_vi' && (m as { ma?: string }).ma === undefined),
          'danh mục không có phần nào mà vẫn mọc dòng khẩu vị danh mục').toBe(false);
      }
    }
    expect(coNhan).toBeGreaterThan(100);
  });

  it('v49 Đòn Bẩy chưa gắn: phần khống ×2 và lãi vay tính trên ký quỹ khống', () => {
    let coNhan = 0;
    for (let seed = 1; seed <= 20; seed += 1) {
      for (let v = 1; v <= 12; v += 1) {
        const { r, cong, a } = chot(banKhong(seed, V49, v, { donBay: true }));
        expect(a.tien_theo_ma?.['khong:btc'], `seed ${seed} v${v}`)
          .toBe(sauKhong(KY_QUY, -2 * cong) - KY_QUY);
        if (cong === 0) continue;
        const nh = a.chain.find((m) => m.kind === 'nhan' && (m as { khong?: boolean }).khong === true);
        expect(nh, `seed ${seed} v${v}`).toMatchObject({ ma: 'btc', delta_bp: -cong });
        const lv = r.ketQua.lai_vay_don_bay?.find((x) => x.ghe_id === 'a');
        expect(lv?.vay, 'lãi vay phải tính trên đúng phần đang được nhân').toBe(KY_QUY);
        coNhan += 1;
      }
    }
    expect(coNhan).toBeGreaterThan(100);
  });
});

describe('III. chip KHỐNG theo hạn mức — qua cửa engine thật (`apLenhMocNav`)', () => {
  const banV9 = (luat: Luat): TrangThaiTran => {
    const st = taoTran(77, [
      { id: 'a', loai: 'bot', bac_rank: 'Đồng', danh_muc: { tai_san: [], chien_thuat: ['ban_khong'] } },
      { id: 'b', loai: 'bot', bac_rank: 'Đồng', danh_muc: { tai_san: [], chien_thuat: [] } },
    ], luat, 12);
    return {
      ...st,
      ghe: st.ghe.map((g) => (g.id === 'a' ? { ...g, von: 9868, vi_the_khong: { btc: 2421 } } : g)),
    };
  };
  const lenh: LenhMoc[] = [{ ma: 'btc', chieu: 'khong', moc_bp: 10000 }];

  it('v49: KHỐNG 100% khớp, ký quỹ tăng đúng tới trần (trừ trượt giá)', () => {
    const r = apLenhMocNav(banV9(V49), 'a', lenh);
    expect(r.ok, String(r.loi)).toBe(true);
    const k = r.st.ghe.find((g) => g.id === 'a')!.vi_the_khong!.btc!;
    expect(k).toBeGreaterThan(2421);
    expect(k).toBeLessThanOrEqual(2421 + 1265);
  });

  it('v48: cùng lệnh bị bác `qua_tran_khong` (giữ nguyên cho replay)', () => {
    expect(apLenhMocNav(banV9(V48), 'a', lenh).loi).toBe('qua_tran_khong');
  });
});

describe('IV. lá Bán Khống thuần quyền mở khống — hết cộng/trừ cả danh mục theo tin', () => {
  it('v49 không còn dòng `ct_su_kien` của lá Bán Khống; v48 còn, đúng số bảng', () => {
    let dem = 0;
    for (let seed = 1; seed <= 40 && dem < 20; seed += 1) {
      const dung = (luat: Luat) => {
        const st = taoTran(seed, [
          { id: 'a', loai: 'bot', bac_rank: 'Đồng', danh_muc: { tai_san: ['vang'], chien_thuat: ['ban_khong'] } },
        ], luat, 16);
        return { ...st, ghe: st.ghe.map((g) => ({ ...g, vi_the: { vang: 5000 } })) };
      };
      const s49 = dung(V49); const s48 = dung(V48);
      for (let v = 1; v <= s49.map.o.length; v += 1) {
        const o = s49.map.o[v - 1]!;
        if (o.kind !== 'su_kien') continue;
        const bang = MT_CHIEN_THUAT_SU_KIEN.ban_khong?.[o.su_kien as never];
        if (!bang) continue;
        const c49 = dungChuoi({ ...s49, vong: v }, s49.ghe[0]!, o).chain;
        const c48 = dungChuoi({ ...s48, vong: v }, s48.ghe[0]!, s48.map.o[v - 1]!).chain;
        expect(c49.some((m) => m.kind === 'ct_su_kien'), `seed ${seed} v${v}`).toBe(false);
        expect(c48.find((m) => m.kind === 'ct_su_kien')?.delta_bp, `seed ${seed} v${v}`).toBe(bang);
        dem += 1;
      }
    }
    expect(dem, 'không ô tin nào có hiệu ứng của lá — bài rỗng').toBeGreaterThan(5);
  });
});

describe('V. xếp hàng khớp lệnh áp vào ĐÚNG mã vừa vào', () => {
  /** Ba ghế cùng VÀO btc vòng này (ảnh chụp trước không có btc); `a` còn cầm vàng từ trước. */
  function banXepHang(seed: number, luat: Luat, vong: number, the: string[] = []): TrangThaiTran {
    const moi = (id: string, t: string[] = []): GheMoi => ({
      id, loai: 'bot', bac_rank: 'Đồng', danh_muc: { tai_san: [], chien_thuat: t as never },
    });
    const st = taoTran(seed, [moi('a', the), moi('b'), moi('c')], luat, 12);
    return {
      ...st, vong,
      tai_san_truoc: { a: ['vang'], b: [], c: [] },
      ghe: st.ghe.map((g) => (g.id === 'a'
        ? { ...g, von: 5000, vi_the: { vang: 3000, btc: 3000 }, danh_muc: { ...g.danh_muc, tai_san: ['vang', 'btc'] } }
        : { ...g, von: 5000, vi_the: { btc: 3000 }, danh_muc: { ...g.danh_muc, tai_san: ['btc'] } })),
    };
  }
  const tongTang = (st: TrangThaiTran, chain: readonly MatXich[], ma: string): number =>
    chain.reduce((t, m) => {
      const x = tangCuaMatXich(st, m);
      return x.tang === 'ma' && x.ma === ma ? t + m.delta_bp : t;
    }, 0);

  it('v49: `xep_hang` btc thuộc tầng btc — vị thế vàng không chịu; v48 thì vàng chịu', () => {
    let dem = 0;
    for (let seed = 1; seed <= 20; seed += 1) {
      for (let v = 1; v <= 12; v += 1) {
        const s49 = banXepHang(seed, V49, v);
        const { a } = chot(s49);
        const xh = a.chain.find((m) => m.kind === 'xep_hang');
        if (!xh) continue;
        expect(tangCuaMatXich(s49, xh)).toEqual({ tang: 'ma', ma: 'btc' });
        expect(tangCuaMatXich(banXepHang(seed, V48, v), xh)).toEqual({ tang: 'danh_muc' });
        const rVang = tongTang(s49, a.chain, 'vang');
        expect(a.tien_theo_ma?.vang, `seed ${seed} v${v}`)
          .toBe(Math.max(0, Math.floor((3000 * (10000 + rVang)) / 10000)) - 3000);
        dem += 1;
      }
    }
    expect(dem, 'không vòng nào có xếp hàng — bài rỗng').toBeGreaterThan(20);
  });

  it('v49: phần HOÀN xếp hàng của Khớp Nhanh đi cùng mã với khoản phạt', () => {
    let dem = 0;
    for (let seed = 1; seed <= 20; seed += 1) {
      for (let v = 1; v <= 12; v += 1) {
        const s49 = banXepHang(seed, V49, v, ['khop_nhanh']);
        const { a } = chot(s49);
        const hoan = a.chain.find((m) => m.kind === 'dac_quyen'
          && (m as { ly_do?: string }).ly_do === 'xep_hang');
        if (!hoan) continue;
        expect(tangCuaMatXich(s49, hoan)).toEqual({ tang: 'ma', ma: 'btc' });
        dem += 1;
      }
    }
    expect(dem).toBeGreaterThan(20);
  });
});

describe('VI. PHẠM VI — không khống · không lá Bán Khống · không xếp hàng ⇒ v49 ≡ v48', () => {
  it('bàn thường (dài, thẻ khác, khẩu vị, Đòn Bẩy) ra ĐÚNG từng con số như v48', () => {
    let dem = 0;
    for (let seed = 1; seed <= 15; seed += 1) {
      const dung = (luat: Luat, v: number): TrangThaiTran => {
        const st = taoTran(seed, [
          { id: 'a', loai: 'bot', bac_rank: 'Đồng', khau_vi: 'quyet_liet', danh_muc: { tai_san: [], chien_thuat: ['don_bay', 'phong_ho'] } },
          { id: 'b', loai: 'bot', bac_rank: 'Đồng', danh_muc: { tai_san: [], chien_thuat: ['chan_lo'] } },
          { id: 'c', loai: 'bot', bac_rank: 'Đồng', khau_vi: 'than_trong', danh_muc: { tai_san: [], chien_thuat: [] } },
        ], luat, 12);
        return {
          ...st, vong: v,
          ghe: st.ghe.map((g, i) => ({
            ...g, von: 3000,
            vi_the: i === 0 ? { btc: 4000, vang: 3000 } : { btc: 3000, usd: 4000 },
            danh_muc: { ...g.danh_muc, tai_san: i === 0 ? ['btc', 'vang'] : ['btc', 'usd'] },
          })),
        };
      };
      for (let v = 1; v <= 12; v += 1) {
        const k49 = giaiQuyetVong(dung(V49, v), THEO).ketQua;
        const k48 = giaiQuyetVong(dung(V48, v), THEO).ketQua;
        expect(k49, `seed ${seed} v${v}`).toEqual(k48);
        dem += 1;
      }
    }
    expect(dem).toBe(180);
  });
});
