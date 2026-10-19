/**
 * D338 — ĐÒN BẨY Ở TRẬN NAV (cổng `balance-v46-donbay`): nhân ĐÚNG TỪNG MÃ + LÃI VAY.
 *
 * LỖI ĐƯỢC SỬA (đo trên trận tập founder 15/09, v45): chưa gắn mã, cầm Crypto + CP cùng
 * +49–50% ở vòng 7 ⇒ mắt xích Đòn Bẩy +98,99% (TỔNG % giá hai mã) rồi áp như % CẢ VÍ lên
 * từng vị thế ⇒ mỗi vị thế ×2,97; đúng 2× phải là ×1,98. Vòng 9 −152,85% ⇒ vị thế về 0.
 *
 * Bài này khoá bằng TIỀN, không bằng mắt xích: `tien_theo_ma` là delta chip từng mã sau CẢ
 * HAI tầng của `apDinhGia` — thứ người chơi thật sự có trong túi.
 */
import { describe, expect, it } from 'vitest';
import {
  dichDonBayTheoMa, dungChuoi, giaiQuyetVong, laiSuatLuc, taoTran,
  type GheMoi, type MatXich, type TrangThaiTran,
} from '../server/holdem/engine.js';
import { LAI_SUAT_NEN, LAI_VAY_DON_BAY, laiMoiO, laiVayDonBayBp, type ChienThuatId } from '../config/holdem.js';
import { luatCua } from '../config/holdem_balance.js';

const V46 = luatCua('balance-v46-donbay');
const V45 = luatCua('balance-v45-duongcong');
const GIA: readonly string[] = ['tai_san', 'echo', 'crowding', 'hoan_truot'];

function ghe(
  id: string, ts: string[], ct: ChienThuatId[], gan?: Partial<Record<ChienThuatId, string>>,
): GheMoi {
  return {
    id, loai: 'bot', bac_rank: 'Đồng',
    danh_muc: { tai_san: ts, chien_thuat: ct, ...(gan ? { gan } : {}) },
  };
}
/** Tổng % giá của một mã trong chuỗi (không tính `nhan`). */
const giaCua = (chain: readonly MatXich[], ma: string) => chain.reduce(
  (t, m) => (GIA.includes(m.kind) && (m as { id?: string }).id === ma ? t + m.delta_bp : t), 0);
/** Đặt vị thế NAV cho ghế — tiền nằm hết ở hai mã. */
function coViThe(st: TrangThaiTran, viThe: Record<string, number>, von = 0): TrangThaiTran {
  return { ...st, ghe: st.ghe.map((g) => (g.id === 'd' ? g : { ...g, vi_the: { ...viThe }, von })) };
}

describe('I. lãi vay — vector tay (mặc định HE_SO_NEN 10000, PHAN_BU 100)', () => {
  it('bp mỗi ô = floor(lãi nền / 2) + 100', () => {
    expect(LAI_VAY_DON_BAY.HE_SO_NEN_BP).toBe(10000);
    expect(LAI_VAY_DON_BAY.PHAN_BU_BP).toBe(100);
    expect(laiVayDonBayBp(400)).toBe(300);   // khởi điểm 4%/năm ⇒ 2%/ô + 1%
    expect(laiVayDonBayBp(250)).toBe(225);   // tiền rẻ ⇒ vay rẻ
    expect(laiVayDonBayBp(550)).toBe(375);   // sau kỳ họp tăng lãi ⇒ vay đắt
    expect(laiMoiO(10000, 300)).toBe(300);
    expect(laiMoiO(7777, 225)).toBe(174);    // làm tròn XUỐNG (C5)
  });
});

describe('II. mắt xích — mỗi mã một `nhan` mang `ma`', () => {
  it('CHƯA GẮN ⇒ mọi mã đang cầm, mỗi mã đúng bằng phần giá của nó; không còn `nhan` gộp', () => {
    let daKiem = 0;
    for (let seed = 1; seed < 25; seed += 1) {
      const st = taoTran(seed, [ghe('a', ['btc', 'vang'], ['don_bay']), ghe('d', ['usd'], [])], V46, 12);
      for (let v = 1; v <= st.map.o.length; v += 1) {
        const { chain } = dungChuoi({ ...st, vong: v }, st.ghe[0]!, st.map.o[v - 1]!);
        const nhan = chain.filter((m) => m.kind === 'nhan') as (MatXich & { ma?: string })[];
        for (const n of nhan) expect(n.ma, 'nhan phải mang mã').toBeDefined();
        for (const ma of ['btc', 'vang']) {
          const gia = giaCua(chain, ma);
          const cua = nhan.filter((n) => n.ma === ma);
          if (gia === 0) { expect(cua).toHaveLength(0); continue; }
          expect(cua, `seed ${seed} v${v} ${ma}`).toHaveLength(1);
          expect(cua[0]!.delta_bp).toBe(gia);
          daKiem += 1;
        }
      }
    }
    expect(daKiem, 'không quét được mã nào — bài rỗng').toBeGreaterThan(100);
  });

  it('GẮN btc ⇒ chỉ btc được nhân; đích dùng chung với lãi vay', () => {
    const st = taoTran(7, [ghe('a', ['btc', 'vang'], ['don_bay'], { don_bay: 'btc' }), ghe('d', ['usd'], [])], V46, 12);
    const { chain } = dungChuoi({ ...st, vong: 5 }, st.ghe[0]!, st.map.o[4]!);
    expect(dichDonBayTheoMa(st, st.ghe[0]!, chain)).toEqual(['btc']);
    for (const m of chain.filter((x) => x.kind === 'nhan')) expect((m as { ma?: string }).ma).toBe('btc');
  });
});

describe('III. ⭐⭐ TIỀN — vị thế ăn đúng 2× giá của CHÍNH nó', () => {
  it('v46: `nhan` của mỗi mã vào đúng vị thế mã đó — delta chip = hai tầng với tầng riêng = giá + giá', () => {
    /*
     * Tách chuỗi y hệt `chotPhien`: tầng RIÊNG từng mã (mắt xích giá + `nhan` mang mã) rồi
     * tầng DANH MỤC (mọi thứ còn lại — vd phản ứng của lá với tin) áp lên từng vị thế.
     * Lỗi v45 là `nhan` rơi xuống tầng danh mục; nếu nó rơi lại, số dưới lệch ngay.
     */
    const THEO_MA = new Set(['tai_san', 'echo', 'crowding', 'khoa_giam_truot', 'hoan_truot', 'khoa_thuong', 'be_keo']);
    let daKiem = 0; let coNhan = 0;
    for (let seed = 11; seed < 21; seed += 1) {
      for (const v of [3, 6, 9]) {
        let st = taoTran(seed, [
          ghe('a', ['btc', 'vang'], ['don_bay']), ghe('b', ['btc', 'vang'], []), ghe('d', ['usd'], []),
        ], V46, 12);
        st = coViThe({ ...st, vong: v }, { btc: 5000, vang: 5000 });
        const { ketQua } = giaiQuyetVong(st, () => ({ loai: 'theo' }) as never);
        for (const id of ['a', 'b']) {
          const r = ketQua.ket_qua.find((x) => x.ghe_id === id)!;
          const theoMa: Record<string, number> = {}; let danhMuc = 0;
          for (const m of r.chain) {
            const mx = m as { id?: string; ma?: string };
            const ma = m.kind === 'nhan' ? mx.ma : THEO_MA.has(m.kind) ? (mx.id ?? mx.ma) : undefined;
            if (ma) theoMa[ma] = (theoMa[ma] ?? 0) + m.delta_bp; else danhMuc += m.delta_bp;
          }
          for (const ma of ['btc', 'vang']) {
            const gia = giaCua(r.chain, ma);
            if (id === 'a' && gia !== 0) coNhan += 1;
            /*
             * ⚠ Vị thế TRƯỚC định giá không phải 5000: cam kết nền trừ trên NAV (v14) đã bán
             * bớt vị thế pro-rata khi tiền mặt 0 — đọc đúng số engine chụp (`vi_the_truoc`).
             */
            const truoc = r.vi_the_truoc?.[ma] ?? 0;
            const sauRieng = Math.max(0, Math.floor((truoc * (10000 + (theoMa[ma] ?? 0))) / 10000));
            const mong = Math.max(0, Math.floor((sauRieng * (10000 + danhMuc)) / 10000)) - truoc;
            expect(r.tien_theo_ma?.[ma], `seed ${seed} v${v} ghế ${id} ${ma}`).toBe(mong);
            daKiem += 1;
          }
        }
        // Ghế Đòn Bẩy: tầng riêng của mỗi mã = đúng HAI lần giá (không có mắt xích riêng nào khác ở bàn này).
        const a = ketQua.ket_qua.find((x) => x.ghe_id === 'a')!;
        for (const ma of ['btc', 'vang']) {
          const tong = a.chain.reduce((t, m) => {
            const mx = m as { id?: string; ma?: string };
            const mm = m.kind === 'nhan' ? mx.ma : THEO_MA.has(m.kind) ? (mx.id ?? mx.ma) : undefined;
            return mm === ma ? t + m.delta_bp : t;
          }, 0);
          expect(tong, `seed ${seed} v${v} ${ma}: tầng riêng ≠ 2× giá`).toBe(2 * giaCua(a.chain, ma));
        }
      }
    }
    expect(daKiem).toBe(10 * 3 * 2 * 2);
    expect(coNhan, 'không vòng nào có giá ≠ 0 — bài rỗng').toBeGreaterThan(20);
  });

  it('⚠ v45 (lỗi cũ, giữ nguyên cho replay): Đòn Bẩy chưa gắn áp TỔNG % hai mã lên từng vị thế', () => {
    let st = taoTran(13, [ghe('a', ['btc', 'vang'], ['don_bay']), ghe('d', ['usd'], [])], V45, 12);
    st = coViThe({ ...st, vong: 6 }, { btc: 5000, vang: 5000 });
    const { ketQua } = giaiQuyetVong(st, () => ({ loai: 'theo' }) as never);
    const r = ketQua.ket_qua.find((x) => x.ghe_id === 'a')!;
    const nhan = r.chain.filter((m) => m.kind === 'nhan');
    expect(nhan, 'v45: một mắt xích gộp, không mang mã').toHaveLength(1);
    expect((nhan[0] as { ma?: string }).ma).toBeUndefined();
    expect(ketQua.lai_vay_don_bay, 'v45 không có lãi vay — trường phải VẮNG').toBeUndefined();
  });
});

describe('IV. ⭐ lãi vay trên phần đang được nhân đôi', () => {
  it('ghế có Đòn Bẩy trả laiMoiO(vay, bp); vay = vị thế các mã trong đích TRƯỚC khi giá chạy; ghế không Đòn Bẩy không trả', () => {
    let st = taoTran(17, [
      ghe('a', ['btc', 'vang'], ['don_bay']), ghe('g', ['btc', 'vang'], ['don_bay'], { don_bay: 'vang' }),
      ghe('b', ['btc', 'vang'], []), ghe('d', ['usd'], []),
    ], V46, 12);
    st = coViThe({ ...st, vong: 4 }, { btc: 6000, vang: 3000 }, 2000);
    const bp = laiVayDonBayBp(laiSuatLuc({ ...st }) ?? LAI_SUAT_NEN.KHOI_DIEM);
    const { ketQua } = giaiQuyetVong(st, () => ({ loai: 'theo' }) as never);
    const lai = ketQua.lai_vay_don_bay!;
    expect(lai.find((x) => x.ghe_id === 'a')).toEqual({ ghe_id: 'a', vay: 9000, lai_bp: bp, lai: laiMoiO(9000, bp) });
    expect(lai.find((x) => x.ghe_id === 'g'), 'gắn vang ⇒ chỉ vay phần vang')
      .toEqual({ ghe_id: 'g', vay: 3000, lai_bp: bp, lai: laiMoiO(3000, bp) });
    expect(lai.find((x) => x.ghe_id === 'b')).toBeUndefined();
  });
});
