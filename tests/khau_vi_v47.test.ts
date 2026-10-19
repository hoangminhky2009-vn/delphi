/**
 * D339 — KHẨU VỊ RỦI RO NHÂN ĐÚNG BIÊN ĐỘ (cổng `balance-v47-khauvi`).
 *
 * LỖI ĐƯỢC SỬA — cùng lớp với Đòn Bẩy v46, khác chỗ nó nằm: `dungChuoi` bước 6 nhân
 * TỔNG % của chuỗi rồi đẩy phần chênh xuống MỘT mắt xích `khau_vi` không mang mã ⇒
 * `chotPhien` xếp nó vào tầng DANH MỤC của `apDinhGia`, tức áp (k−1)×(tổng % MỌI mã)
 * lên TỪNG vị thế. Hai hệ quả, cả hai phá đúng điều `KHAU_VI` nói là quan trọng nhất
 * ("kỳ vọng không đổi, chỉ phương sai đổi"):
 *   · cầm N mã cùng lên thì quyết liệt ăn ~N lần phần thưởng đáng ra được nhân;
 *   · thận trọng bị TRỪ (k−1<0) theo tổng cả rổ ⇒ rổ đang lãi vẫn có thể về âm.
 * Đo 400 bộ ba (cùng seed, cùng bàn, cùng bot, chỉ khác khẩu vị ghế 0, map 12 · v46):
 * về nhất 5,0% (thận trọng) · 17,3% (cân bằng) · 53,3% (quyết liệt); NAV trung bình
 * −36,6% / +69,1% so với cân bằng. Đó là nút-bấm-là-đúng, không phải khẩu vị.
 *
 * Bài này khoá bằng TIỀN (`tien_theo_ma` — delta chip sau CẢ HAI tầng định giá), và khoá
 * bằng ĐẲNG THỨC THIẾT KẾ: cùng bàn, cùng vị thế, cùng vòng ⇒ CẢ HAI TẦNG của ghế quyết
 * liệt bằng đúng k lần ghế cân bằng.
 *
 * ⚠ Đẳng thức ấy ở TẦNG, không phải ở chip: hai tầng nhân nhau nên chip còn số hạng chéo
 * (k²−k)·r_mã·r_danhmục. Một bài canh đòi "chip = k × chip" sẽ đỏ thật (đã đỏ một lượt) và
 * cách "sửa" sai là nới sai số cho hết đỏ — tức tự tay tháo lưới.
 */
import { describe, expect, it } from 'vitest';
import {
  dungChuoi, giaiQuyetVong, tangCuaMatXich, taoTran,
  type GheMoi, type MatXich, type TrangThaiTran,
} from '../server/holdem/engine.js';
import { KHAU_VI, khauViCua, type ChienThuatId, type KhauViId } from '../config/holdem.js';
import { luatCua } from '../config/holdem_balance.js';
import { applyBpInt } from '../server/sandbox/rng.js';

/**
 * Tầng MÃ của một mắt xích, đọc qua `tangCuaMatXich` (v49/D342 thay `maCuaMatXich` bằng
 * hàm ba tầng). Bài này chạy v47/v48 — không có tầng khống; gặp thì là dữ liệu sai, NÉM.
 */
function maCuaMatXich(st: TrangThaiTran, m: MatXich): string | undefined {
  const t = tangCuaMatXich(st, m);
  if (t.tang === 'khong') throw new Error(`tầng khống không thể có ở ${st.vong}: ${m.kind}`);
  return t.tang === 'ma' ? t.ma : undefined;
}


const V47 = luatCua('balance-v47-khauvi');
const V46 = luatCua('balance-v46-donbay');
const K_QL = khauViCua('quyet_liet').he_so_bp;
const K_TT = khauViCua('than_trong').he_so_bp;

/*
 * ⚠ BA THẺ NÀY LÀ MỘT PHẦN CỦA BÀI CANH, không phải trang trí. Bàn KHÔNG cầm thẻ thì tầng
 * DANH MỤC luôn rỗng, và khi tầng ấy rỗng thì hai lỗi thật đi lọt (đã tiêm để biết):
 *   · cổng v47 nới whitelist sang `dac_quyen` — không có `chan_lo` thì không có gì để nới;
 *   · quên nhân phần danh mục — không có phần danh mục thì "quên" cũng ra đúng số.
 * `da_dang_hoa` + `phong_ho` + `chan_lo` sinh mắt xích KHÔNG mang mã (`da_dang`, `phong_thu`,
 * `dac_quyen`) ⇒ tầng danh mục khác 0 ở hầu hết các vòng.
 */
const THE: ChienThuatId[] = ['da_dang_hoa', 'phong_ho', 'chan_lo'];
function ghe(id: string, khauVi?: KhauViId): GheMoi {
  return {
    id, loai: 'bot', bac_rank: 'Đồng',
    danh_muc: { tai_san: ['btc', 'vang'], chien_thuat: [...THE] },
    ...(khauVi ? { khau_vi: khauVi } : {}),
  };
}
/** Bàn ba khẩu vị + một ghế đối chứng cầm mã khác. */
function ban(seed: number, luat: typeof V47, vong: number): TrangThaiTran {
  const st = taoTran(seed, [
    ghe('q', 'quyet_liet'), ghe('c'), ghe('t', 'than_trong'),
    { id: 'd', loai: 'bot', bac_rank: 'Đồng', danh_muc: { tai_san: ['usd'], chien_thuat: [] } },
  ], luat, 12);
  return {
    ...st,
    vong,
    ghe: st.ghe.map((g) => (g.id === 'd' ? g : { ...g, vi_the: { btc: 5000, vang: 5000 }, von: 2000 })),
  };
}
/** Tách chuỗi y hệt `chotPhien` — nếu mắt xích rơi nhầm tầng, số dưới lệch ngay. */
function haiTang(st: TrangThaiTran, chain: readonly MatXich[]): {
  theoMa: Record<string, number>; danhMuc: number;
} {
  const theoMa: Record<string, number> = {}; let danhMuc = 0;
  for (const m of chain) {
    const ma = maCuaMatXich(st, m);
    if (ma) theoMa[ma] = (theoMa[ma] ?? 0) + m.delta_bp; else danhMuc += m.delta_bp;
  }
  return { theoMa, danhMuc };
}
/** Phần % của một mã KHÔNG tính khẩu vị — nền để so hệ số. */
function nenCuaMa(st: TrangThaiTran, chain: readonly MatXich[], ma: string): number {
  return chain.reduce(
    (t, m) => (m.kind !== 'khau_vi' && maCuaMatXich(st, m) === ma ? t + m.delta_bp : t), 0);
}
/** Phần % của DANH MỤC (mắt xích không mang mã) KHÔNG tính khẩu vị. */
function nenDanhMuc(st: TrangThaiTran, chain: readonly MatXich[]): number {
  return chain.reduce(
    (t, m) => (m.kind !== 'khau_vi' && maCuaMatXich(st, m) === undefined ? t + m.delta_bp : t), 0);
}

describe('I. mắt xích — khẩu vị chia theo mã, mỗi mã nhân phần CỦA CHÍNH NÓ', () => {
  it('mỗi mã đang cầm một `khau_vi` mang `ma`, delta = (k−1)× phần nền của mã đó', () => {
    let daKiem = 0;
    for (let seed = 31; seed < 51; seed += 1) {
      const st = ban(seed, V47, 1);
      for (let v = 1; v <= st.map.o.length; v += 1) {
        const stV = { ...st, vong: v };
        const { chain } = dungChuoi(stV, stV.ghe[0]!, stV.map.o[v - 1]!);
        const kv = chain.filter((m) => m.kind === 'khau_vi') as (MatXich & { ma?: string })[];
        for (const ma of ['btc', 'vang']) {
          const nen = nenCuaMa(stV, chain, ma);
          const cua = kv.filter((x) => x.ma === ma);
          const mong = applyBpInt(nen, K_QL) - nen;
          if (mong === 0) { expect(cua, `seed ${seed} v${v} ${ma}`).toHaveLength(0); continue; }
          expect(cua, `seed ${seed} v${v} ${ma}`).toHaveLength(1);
          expect(cua[0]!.delta_bp).toBe(mong);
          daKiem += 1;
        }
      }
    }
    expect(daKiem, 'không quét được mã nào — bài rỗng').toBeGreaterThan(100);
  });

  it('⚠ v46 (lỗi cũ, giữ nguyên cho replay): ĐÚNG MỘT mắt xích gộp, không mang mã', () => {
    const st = ban(13, V46, 6);
    const { chain } = dungChuoi(st, st.ghe[0]!, st.map.o[5]!);
    const kv = chain.filter((m) => m.kind === 'khau_vi') as (MatXich & { ma?: string })[];
    expect(kv).toHaveLength(1);
    expect(kv[0]!.ma).toBeUndefined();
  });
});

describe('II. ⭐⭐ TIỀN — cùng vị thế thì lãi/lỗ đúng k lần ghế cân bằng', () => {
  it('v47: tầng theo mã của quyết liệt = k × nền; tiền từng mã khớp hai tầng định giá', () => {
    let daKiem = 0; let coDong = 0; let coDanhMuc = 0;
    for (let seed = 61; seed < 71; seed += 1) {
      for (const v of [3, 6, 9]) {
        const st = ban(seed, V47, v);
        const { ketQua } = giaiQuyetVong(st, () => ({ loai: 'theo' }) as never);
        const r = Object.fromEntries(ketQua.ket_qua.map((x) => [x.ghe_id, x]));
        for (const id of ['q', 'c', 't']) {
          const k = khauViCua(st.ghe.find((g) => g.id === id)!.khau_vi).he_so_bp;
          const { theoMa, danhMuc } = haiTang(st, r[id]!.chain);
          /*
           * ①b TẦNG DANH MỤC CŨNG PHẢI ĐƯỢC NHÂN. Chỗ này là lý do bàn có ba thẻ: bỏ quên
           * vế danh mục là một mũi tiêm ĐI LỌT khi tầng ấy rỗng, vì "quên nhân 0" ra đúng 0.
           */
          const nenDm = nenDanhMuc(st, r[id]!.chain);
          expect(danhMuc, `seed ${seed} v${v} ${id}: tầng danh mục ≠ k×nền`)
            .toBe(applyBpInt(nenDm, k));
          if (nenDm !== 0) coDanhMuc += 1;
          for (const ma of ['btc', 'vang']) {
            // ① hệ số đúng: tầng riêng của mã = k × phần nền của chính mã đó.
            const nen = nenCuaMa(st, r[id]!.chain, ma);
            expect(theoMa[ma] ?? 0, `seed ${seed} v${v} ${id} ${ma}: tầng riêng ≠ k×nền`)
              .toBe(applyBpInt(nen, k));
            // ② tiền: đúng hai tầng của `apDinhGia` trên vị thế engine chụp trước định giá.
            const truoc = r[id]!.vi_the_truoc?.[ma] ?? 0;
            const sauRieng = Math.max(0, Math.floor((truoc * (10000 + (theoMa[ma] ?? 0))) / 10000));
            const mong = Math.max(0, Math.floor((sauRieng * (10000 + danhMuc)) / 10000)) - truoc;
            expect(r[id]!.tien_theo_ma?.[ma], `seed ${seed} v${v} ${id} ${ma}`).toBe(mong);
            if (nen !== 0) coDong += 1;
            daKiem += 1;
          }
        }
        /*
         * ③ ĐẲNG THỨC THIẾT KẾ — ba ghế cùng bàn, cùng vị thế, cùng vòng, chỉ khác khẩu vị.
         * Ghế cân bằng có k = 1 nên chuỗi của nó CHÍNH LÀ phần nền; hai ghế kia phải bằng
         * đúng nền ấy nhân k, CẢ HAI TẦNG. Đây là cả lý do khẩu vị được phép tồn tại (KHAU_VI).
         *
         * ⚠ Không đòi "chip = k × chip cân bằng" theo tỉ lệ thẳng: hai tầng nhân nhau nên còn
         * số hạng chéo (k²−k)·r_mã·r_danhmục. Nó nhỏ nhưng CÓ THẬT, và một bài canh đòi điều
         * sai sẽ bị vặn cho hết đỏ bằng cách nới sai số — tức tự tay tháo lưới.
         */
        const nenC = haiTang(st, r.c!.chain);
        for (const id of ['q', 't'] as const) {
          const k = khauViCua(st.ghe.find((g) => g.id === id)!.khau_vi).he_so_bp;
          const { theoMa, danhMuc } = haiTang(st, r[id]!.chain);
          expect(danhMuc, `seed ${seed} v${v} ${id}: danh mục ≠ k× ghế cân bằng`)
            .toBe(applyBpInt(nenC.danhMuc, k));
          for (const ma of ['btc', 'vang']) {
            expect(theoMa[ma] ?? 0, `seed ${seed} v${v} ${id} ${ma}: theo mã ≠ k× ghế cân bằng`)
              .toBe(applyBpInt(nenC.theoMa[ma] ?? 0, k));
          }
        }
      }
    }
    expect(daKiem).toBe(10 * 3 * 3 * 2);
    expect(coDong, 'mọi vòng đều đứng im — bài rỗng').toBeGreaterThan(30);
    expect(coDanhMuc, 'tầng danh mục luôn rỗng — bàn thiếu thẻ, bài canh hở').toBeGreaterThan(30);
  });

  it('⚠ v46 (lỗi cũ): cùng vị thế mà quyết liệt ăn hơn 1,35× — đó chính là bug', () => {
    let lech = 0; let xet = 0;
    for (let seed = 61; seed < 71; seed += 1) {
      for (const v of [3, 6, 9]) {
        const st = ban(seed, V46, v);
        const { ketQua } = giaiQuyetVong(st, () => ({ loai: 'theo' }) as never);
        const r = Object.fromEntries(ketQua.ket_qua.map((x) => [x.ghe_id, x]));
        for (const ma of ['btc', 'vang']) {
          const c = r.c!.tien_theo_ma?.[ma] ?? 0;
          if (Math.abs(c) < 20) continue;
          xet += 1;
          if (Math.abs((r.q!.tien_theo_ma?.[ma] ?? 0) - applyBpInt(c, K_QL)) > 2) lech += 1;
        }
      }
    }
    expect(xet, 'bài rỗng').toBeGreaterThan(20);
    expect(lech, 'v46 phải còn lệch — nếu hết lệch là cổng đã rò sang trận cũ').toBe(xet);
  });
});

describe('III. SỔ KHỐNG — biên độ nhân cả CHIỀU NGƯỢC', () => {
  /*
   * Chỗ này là lý do khẩu vị KHÔNG được ở lại tầng danh mục. `apDinhGia` áp tầng theo mã
   * cho sổ khống bằng (10000 − r) — đảo dấu, vì mã lên thì người khống lỗ — còn tầng danh
   * mục áp THUẬN. Nên khi khẩu vị nằm ở tầng danh mục, "quyết liệt" trên một mã đang lên
   * vừa lỗ vì giá vừa được CỘNG thuận vì hệ số: nhân biên độ hoá ra nửa thưởng nửa phạt.
   */
  it('khống một mã: tầng theo mã = k×nền, và mã lên thì quyết liệt lỗ ĐẬM hơn cân bằng', () => {
    let xet = 0;
    for (let seed = 81; seed < 91; seed += 1) {
      for (const v of [4, 7]) {
        /*
         * ⚠ Bàn này CỐ Ý KHÔNG cầm thẻ (khác §II): tầng danh mục áp THUẬN lên sổ khống, nên
         * còn phí thẻ trong đó thì dấu của tổng do phí quyết định chứ không do giá — câu
         * "khống mã đang lên thì quyết liệt lỗ đậm hơn" sẽ sai theo đúng nghĩa số học. Tầng
         * danh mục đã có §II canh; ở đây cần cô lập CHIỀU của tầng theo mã.
         */
        const st0 = ban(seed, V47, v);
        const st: TrangThaiTran = {
          ...st0,
          ghe: st0.ghe.map((g) => (g.id === 'd' ? g : {
            ...g,
            danh_muc: { ...g.danh_muc, chien_thuat: [] },
            vi_the: { vang: 5000 }, vi_the_khong: { btc: 5000 }, von: 2000,
          })),
        };
        const { ketQua } = giaiQuyetVong(st, () => ({ loai: 'theo' }) as never);
        const r = Object.fromEntries(ketQua.ket_qua.map((x) => [x.ghe_id, x]));
        const nenBtc = nenCuaMa(st, r.c!.chain, 'btc');
        if (Math.abs(nenBtc) < 100) continue; // mã gần đứng im — chiều không đọc được
        xet += 1;
        for (const id of ['q', 't'] as const) {
          const k = khauViCua(st.ghe.find((g) => g.id === id)!.khau_vi).he_so_bp;
          const { theoMa, danhMuc } = haiTang(st, r[id]!.chain);
          expect(theoMa.btc ?? 0, `seed ${seed} v${v} ${id}: tầng theo mã ≠ k×nền`)
            .toBe(applyBpInt(nenBtc, k));
          // Tiền khống: ĐẢO DẤU tầng theo mã, THUẬN tầng danh mục (`apDinhGia`).
          const truoc = 5000;
          const sauRieng = Math.max(0, Math.floor((truoc * (10000 - (theoMa.btc ?? 0))) / 10000));
          const mong = Math.max(0, Math.floor((sauRieng * (10000 + danhMuc)) / 10000)) - truoc;
          expect(r[id]!.tien_theo_ma?.['khong:btc'], `seed ${seed} v${v} ${id} khống btc`).toBe(mong);
        }
        // CHIỀU: mã lên ⇒ khống lỗ; quyết liệt phải lỗ đậm hơn, thận trọng nhẹ hơn.
        const [cq, cc, ct] = (['q', 'c', 't'] as const)
          .map((id) => r[id]!.tien_theo_ma?.['khong:btc'] ?? 0);
        if (nenBtc > 0) {
          expect(cq, `seed ${seed} v${v}: quyết liệt phải lỗ đậm hơn`).toBeLessThan(cc!);
          expect(ct, `seed ${seed} v${v}: thận trọng phải lỗ nhẹ hơn`).toBeGreaterThan(cc!);
        } else {
          expect(cq, `seed ${seed} v${v}: quyết liệt phải lãi đậm hơn`).toBeGreaterThan(cc!);
          expect(ct, `seed ${seed} v${v}: thận trọng phải lãi nhẹ hơn`).toBeLessThan(cc!);
        }
      }
    }
    expect(xet, 'không ghi nhận vòng khống nào — bài rỗng').toBeGreaterThan(5);
  });
});

describe('V. ⭐ BÀN KHÔNG AI CHỌN KHẨU VỊ: v47 ≡ v46 tới từng con số', () => {
  /*
   * Đây là bài canh cho một câu KHẲNG ĐỊNH đã viết vào docstring `HOLDEM_BALANCE_VERSION`:
   * gate G1–G5 của v47 trùng v46 tới từng chữ số, và trùng ở đây KHÔNG phải bẫy "bot chưa
   * nhận cờ" (D313) mà là hệ quả — `holdem_montecarlo` không đặt `khau_vi` cho ghế nào.
   * Câu ấy chỉ đáng tin nếu có thứ canh nó, vì nếu cờ v47 lỡ chạm một thứ khác thì gate
   * trùng số sẽ nói dối đúng theo cách D313 đã trả giá.
   */
  it('cùng seed, cùng bàn, không ghế nào đặt khẩu vị ⇒ chuỗi + tiền + PnL giống hệt', () => {
    let daKiem = 0;
    for (let seed = 101; seed < 111; seed += 1) {
      for (const v of [2, 5, 8, 11]) {
        const ra = [V46, V47].map((luat) => {
          const st0 = ban(seed, luat, v);
          // Gỡ SẠCH khẩu vị — đúng cấu hình bàn đo Monte Carlo (mọi ghế `can_bang`).
          const st: TrangThaiTran = {
            ...st0,
            ghe: st0.ghe.map(({ khau_vi: _bo, ...g }) => g as (typeof st0.ghe)[number]),
          };
          expect(st.ghe.every((g) => g.khau_vi === undefined)).toBe(true);
          return giaiQuyetVong(st, () => ({ loai: 'theo' }) as never).ketQua;
        });
        // So CẢ kết quả vòng: chuỗi, tiền theo mã, PnL, quỹ vòng. `st` không so được
        // (nó mang chính cái cờ đang bật), nhưng thứ người chơi nhận thì phải y hệt.
        expect(ra[1], `seed ${seed} v${v}`).toEqual(ra[0]);
        daKiem += 1;
      }
    }
    expect(daKiem).toBe(40);
  });
});

describe('IV. cân bằng không sinh mắt xích (bất biến cũ, giữ nguyên)', () => {
  it('he_so_bp = 10000 ⇒ không có mắt xích khẩu vị ở cả v46 lẫn v47', () => {
    expect(khauViCua('can_bang').he_so_bp).toBe(10000);
    expect(KHAU_VI.map((k) => k.he_so_bp)).toEqual([7500, 10000, 13500]);
    for (const luat of [V46, V47]) {
      const st = ban(29, luat, 5);
      const { chain } = dungChuoi(st, st.ghe.find((g) => g.id === 'c')!, st.map.o[4]!);
      expect(chain.some((m) => m.kind === 'khau_vi')).toBe(false);
    }
  });
});
