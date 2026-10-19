/**
 * D340 — RỦI RO ĐỐI TÁC TRỪ ĐÚNG MỘT LẦN (cổng `balance-v48-doitac`).
 *
 * LỖI ĐƯỢC SỬA — ca THỨ BA của họ "mắt xích rơi nhầm chỗ" (v46 `nhan`, v47 `khau_vi`,
 * nay `doi_tac`), và là ca duy nhất KHÔNG phải xếp nhầm tầng mà là ĐẾM HAI LẦN:
 * `dungChuoi` teo phần ăn của thẻ phòng thủ xuống `teo` (gán `d = teo`) RỒI CÒN đẩy
 * `−mat` vào chuỗi. `congDon` chỉ cộng `teo` nên PnL tường thuật đúng, nhưng `chotPhien`
 * chia hai tầng bằng cách cộng theo CHUỖI ⇒ TIỀN áp `teo − mat`, mà `AN_CON_BP = 5000`
 * nghĩa là `teo = mat` ⇒ áp đúng **0**.
 *
 * Tức là: cả bàn cùng núp một thẻ phòng thủ thì thẻ ấy mất SẠCH phần che, trong khi luật
 * ghi rõ "CHỈ TEO PHẦN ĂN" (= còn một nửa) và cảnh báo thẳng rằng đánh cả hai đầu sẽ
 * "biến thẻ phòng thủ thành bẫy và dạy người chơi 'đừng bao giờ phòng hộ' — đúng thứ D22 cấm".
 *
 * CÁCH SỬA: `phong_thu` mang phần ăn ĐẦY ĐỦ, `doi_tac` là dòng TRỪ thật. Tổng chuỗi trở
 * lại bằng đúng phần còn lại, nên tiền và lời kể khớp nhau — thay vì thêm một danh sách
 * "mắt xích chỉ để đọc" mà `chotPhien` phải nhớ loại trừ (bản sao thứ hai của luật, D61).
 */
import { describe, expect, it } from 'vitest';
import {
  dungChuoi, giaiQuyetVong, tangCuaMatXich, taoTran,
  type GheMoi, type MatXich, type TrangThaiTran,
} from '../server/holdem/engine.js';
import { RUI_RO_DOI_TAC, THE_PHONG_THU, type ChienThuatId } from '../config/holdem.js';
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


const V48 = luatCua('balance-v48-doitac');
const V47 = luatCua('balance-v47-khauvi');

function ghe(id: string, the: ChienThuatId[]): GheMoi {
  return { id, loai: 'bot', bac_rank: 'Đồng', danh_muc: { tai_san: ['btc', 'vang'], chien_thuat: the } };
}
/** Bàn 4 ghế CÙNG núp `phong_ho` ⇒ tỷ lệ lobby 100%, chắc chắn vượt ngưỡng đối tác. */
function banNup(seed: number, luat: typeof V48, vong: number): TrangThaiTran {
  const st = taoTran(seed, [
    ghe('a', ['phong_ho']), ghe('b', ['phong_ho']), ghe('c', ['phong_ho']), ghe('d', ['phong_ho']),
  ], luat, 12);
  return {
    ...st, vong,
    ghe: st.ghe.map((g) => ({ ...g, vi_the: { btc: 5000, vang: 5000 }, von: 2000 })),
  };
}
/** Bàn CHỈ MỘT ghế cầm thẻ ⇒ 25% lobby, DƯỚI ngưỡng ⇒ đối tác không kích hoạt. */
function banLe(seed: number, luat: typeof V48, vong: number): TrangThaiTran {
  const st = taoTran(seed, [
    ghe('a', ['phong_ho']), ghe('b', []), ghe('c', []), ghe('d', []),
  ], luat, 12);
  return {
    ...st, vong,
    ghe: st.ghe.map((g) => ({ ...g, vi_the: { btc: 5000, vang: 5000 }, von: 2000 })),
  };
}
const AN = THE_PHONG_THU.phong_ho.an_bp;
const TEO = applyBpInt(AN, RUI_RO_DOI_TAC.AN_CON_BP);
const MAT = AN - TEO;
/** Tầng DANH MỤC y hệt `chotPhien` — nơi `phong_thu`/`doi_tac` đổ vào (không mang mã). */
function danhMuc(st: TrangThaiTran, chain: readonly MatXich[]): number {
  return chain.reduce((t, m) => (maCuaMatXich(st, m) === undefined ? t + m.delta_bp : t), 0);
}
/** Các vòng mà CẢ HAI mắt xích cùng xuất hiện (tức đối tác đã kích hoạt). */
function vongKichHoat(luat: typeof V48): { seed: number; vong: number }[] {
  const ra: { seed: number; vong: number }[] = [];
  for (let seed = 1; seed < 60 && ra.length < 12; seed += 1) {
    const st0 = banNup(seed, luat, 1);
    for (let v = 1; v <= st0.map.o.length; v += 1) {
      const { chain } = dungChuoi({ ...st0, vong: v }, st0.ghe[0]!, st0.map.o[v - 1]!);
      const co = (k: string) => chain.some((m) => m.kind === k);
      if (co('doi_tac') && co('phong_thu')) ra.push({ seed, vong: v });
    }
  }
  return ra;
}

describe('0. vector tay — số của luật, không phải số chép tay', () => {
  it('phong_ho ăn 700bp; vượt ngưỡng thì CÒN một nửa (350), mất 350', () => {
    expect(RUI_RO_DOI_TAC.BAT).toBe(true);
    expect(AN).toBe(700);
    expect(TEO).toBe(350);
    expect(MAT).toBe(350);
    expect(TEO + MAT, 'teo + mat phải bằng phần ăn đầy đủ').toBe(AN);
  });
});

describe('I. mắt xích — phần ăn đầy đủ + một dòng trừ, tổng bằng phần còn lại', () => {
  it('v48: phong_thu mang ĐẦY ĐỦ, doi_tac trừ, tổng hai dòng = teo', () => {
    const ds = vongKichHoat(V48);
    expect(ds.length, 'không seed nào kích hoạt đối tác — bài rỗng').toBeGreaterThan(5);
    for (const { seed, vong } of ds) {
      const st = banNup(seed, V48, vong);
      const { chain } = dungChuoi(st, st.ghe[0]!, st.map.o[vong - 1]!);
      const pt = chain.find((m) => m.kind === 'phong_thu')!;
      const dt = chain.find((m) => m.kind === 'doi_tac')!;
      expect(pt.delta_bp, `seed ${seed} v${vong}: phong_thu phải mang phần ăn đầy đủ`).toBe(AN);
      expect(dt.delta_bp, `seed ${seed} v${vong}: doi_tac phải trừ đúng phần mất`).toBe(-MAT);
      expect(pt.delta_bp + dt.delta_bp, 'tổng hai dòng ≠ phần còn lại').toBe(TEO);
    }
  });

  it('⚠ v47 (lỗi cũ, giữ nguyên cho replay): phong_thu đã bị teo mà doi_tac vẫn trừ tiếp ⇒ tổng 0', () => {
    const ds = vongKichHoat(V47);
    expect(ds.length).toBeGreaterThan(5);
    for (const { seed, vong } of ds) {
      const st = banNup(seed, V47, vong);
      const { chain } = dungChuoi(st, st.ghe[0]!, st.map.o[vong - 1]!);
      const pt = chain.find((m) => m.kind === 'phong_thu')!;
      const dt = chain.find((m) => m.kind === 'doi_tac')!;
      expect(pt.delta_bp).toBe(TEO);
      expect(dt.delta_bp).toBe(-MAT);
      expect(pt.delta_bp + dt.delta_bp, 'đây chính là bug: tiền áp 0').toBe(0);
    }
  });
});

describe('II. ⭐⭐ TIỀN — tầng danh mục nhận đúng phần còn lại, không phải 0', () => {
  it('v48 hơn v47 đúng `mat` bp ở tầng danh mục, và chip theo mã nhiều hơn', () => {
    const ds = vongKichHoat(V48);
    expect(ds.length).toBeGreaterThan(5);
    let coTien = 0;
    for (const { seed, vong } of ds) {
      const r = [V47, V48].map((luat) => {
        const st = banNup(seed, luat, vong);
        const kq = giaiQuyetVong(st, () => ({ loai: 'theo' }) as never).ketQua;
        return { st, g: kq.ket_qua.find((x) => x.ghe_id === 'a')! };
      });
      const dm = r.map((x) => danhMuc(x.st, x.g.chain));
      expect(dm[1]! - dm[0]!, `seed ${seed} v${vong}: chênh tầng danh mục ≠ mat`).toBe(MAT);
      // TIỀN: cùng vị thế trước định giá ⇒ tầng danh mục cao hơn thì chip cao hơn.
      for (const ma of ['btc', 'vang']) {
        expect(r[0]!.g.vi_the_truoc?.[ma], 'hai lượt phải cùng vị thế trước định giá')
          .toBe(r[1]!.g.vi_the_truoc?.[ma]);
        const t47 = r[0]!.g.tien_theo_ma?.[ma] ?? 0;
        const t48 = r[1]!.g.tien_theo_ma?.[ma] ?? 0;
        if ((r[1]!.g.vi_the_truoc?.[ma] ?? 0) > 0) {
          expect(t48, `seed ${seed} v${vong} ${ma}: tiền v48 phải hơn v47`).toBeGreaterThan(t47);
          coTien += 1;
        }
      }
    }
    expect(coTien, 'không vòng nào có vị thế — bài rỗng').toBeGreaterThan(5);
  });

  it('PnL tường thuật (`pnl_bp` của `dungChuoi`) KHÔNG đổi — `congDon` vốn đã đúng', () => {
    const ds = vongKichHoat(V48);
    expect(ds.length).toBeGreaterThan(5);
    for (const { seed, vong } of ds) {
      const r = [V47, V48].map((luat) => {
        const st = banNup(seed, luat, vong);
        return dungChuoi(st, st.ghe[0]!, st.map.o[vong - 1]!).pnl_bp;
      });
      expect(r[1], `seed ${seed} v${vong}`).toBe(r[0]);
    }
  });
});

describe('III. PHẠM VI — chưa đủ người núp thì không đổi gì', () => {
  it('một mình cầm thẻ (25% lobby < ngưỡng) ⇒ v48 ≡ v47 tới từng con số', () => {
    let coAn = 0;
    for (let seed = 1; seed < 25; seed += 1) {
      for (let v = 1; v <= 12; v += 1) {
        const r = [V47, V48].map((luat) => {
          const st = banLe(seed, luat, v);
          return giaiQuyetVong(st, () => ({ loai: 'theo' }) as never).ketQua;
        });
        expect(r[1], `seed ${seed} v${v}`).toEqual(r[0]);
        const st = banLe(seed, V48, v);
        const { chain } = dungChuoi(st, st.ghe[0]!, st.map.o[v - 1]!);
        if (chain.some((m) => m.kind === 'phong_thu' && (m as { an: boolean }).an)) coAn += 1;
        expect(chain.some((m) => m.kind === 'doi_tac'), 'dưới ngưỡng mà vẫn teo').toBe(false);
      }
    }
    expect(coAn, 'không vòng nào thẻ ăn — bài rỗng, không chứng minh được phạm vi').toBeGreaterThan(5);
  });
});
