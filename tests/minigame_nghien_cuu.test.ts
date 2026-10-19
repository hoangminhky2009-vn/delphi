/**
 * D500 — BÀN NGHIÊN CỨU của Tổ Chức (demo bản 34 `nghienCuu`; founder 04/10: *"chỉ tính xác suất và đặt các chỉ báo ở dưới chân chart thôi chứ ko
 * đặt đúng tọa độ. Và hiển thị luôn %. Màu đỏ là tạo đáy, màu xanh là tạo đỉnh"*). Chạy lại CÙNG kịch bản màn (hình · thẻ · sức căng · neo) với
 * `NC_SO_MO_PHONG` seed nhiễu khác ⇒ tỷ lệ đáy / đỉnh rơi vào từng khúc thời gian (`NC_SO_CUA` khúc). Mô hình biết dạng, không biết đường thật.
 */
import { describe, expect, it } from 'vitest';
import { luatCua } from '../config/holdem_balance.js';
import { K_MIN, NEN_LS, TO_CHUC_V57 } from '../config/minigame.js';
import { taoTran, type GheMoi } from '../server/holdem/engine.js';
import { boiCanhGhe } from '../server/holdem/minigame/quyet_toan.js';
import { dungDongMan } from '../server/holdem/minigame/man.js';

const ghe = (id: string, loai: 'nguoi' | 'bot'): GheMoi => ({ id, loai, bac_rank: 'Đồng', danh_muc: { tai_san: [], chien_thuat: [] } });
const st = { ...taoTran(9, [ghe('ban', 'nguoi'), ghe('g1', 'bot')], luatCua('balance-v57-minigame'), 12), vong: 3 };
const bc = (toChuc: boolean, seed = 9) => {
  const x = boiCanhGhe(st, seed, 2, { btc: 1000, vang: 400 }, { btc: -1500, vang: 300 }, undefined, undefined, undefined, undefined, toChuc ? { toChuc: true } : {});
  if ('loi' in x) throw new Error(x.loi);
  return x;
};

describe('§I — bàn nghiên cứu', () => {
  it('⭐ chỉ Tổ Chức có; mỗi dãy đủ NC_SO_CUA khúc, cộng đúng 1 (mỗi mô phỏng một đáy, một đỉnh)', () => {
    expect(bc(false).nghien_cuu).toBeUndefined();
    const nc = bc(true).nghien_cuu!;
    expect(nc.day).toHaveLength(TO_CHUC_V57.NC_SO_CUA);
    expect(nc.dinh).toHaveLength(TO_CHUC_V57.NC_SO_CUA);
    expect(nc.day.reduce((a, x) => a + x, 0)).toBeCloseTo(1, 9);
    expect(nc.dinh.reduce((a, x) => a + x, 0)).toBeCloseTo(1, 9);
  });
  it('⭐ tất định theo màn (cùng bối cảnh ⇒ cùng số), màn khác ⇒ số khác — không phải hằng in sẵn', () => {
    expect(bc(true).nghien_cuu).toEqual(bc(true).nghien_cuu);
    const khac = [11, 21, 31, 41].map((s) => JSON.stringify(bc(true, s).nghien_cuu));
    expect(new Set(khac).size).toBeGreaterThan(1);
  });
  it('⭐ chỉ báo CÓ thông tin: qua 30 màn, xác suất mô hình gán cho khúc chứa ĐÁY / ĐỈNH THẬT cao hơn đoán đều (1/khúc) — nhưng không phải 100 % (không lộ đáp án)', () => {
    let pDay = 0, pDinh = 0, trung = 0;
    for (let sd = 1; sd <= 30; sd++) {
      const b = bc(true, sd), nc = b.nghien_cuu!, chay = dungDongMan(b).slice(NEN_LS * K_MIN), C = nc.day.length;
      let iD = 0, iP = 0;
      chay.forEach((c, j) => { if (c.l < chay[iD]!.l) iD = j; if (c.h > chay[iP]!.h) iP = j; });
      const kD = Math.min(C - 1, Math.floor((iD * C) / chay.length)), kP = Math.min(C - 1, Math.floor((iP * C) / chay.length));
      pDay += nc.day[kD]!; pDinh += nc.dinh[kP]!;
      if (nc.day[kD] === 1) trung++;
    }
    expect(pDay / 30).toBeGreaterThan(1 / TO_CHUC_V57.NC_SO_CUA);
    expect(pDinh / 30).toBeGreaterThan(1 / TO_CHUC_V57.NC_SO_CUA);
    expect(trung, 'mô hình không được biết chắc đáy thật ở hầu hết màn').toBeLessThan(25);
  });
});

/*
 * D520 (founder 05/10: "xác suất phản ánh hơi bịp" → chọn A; "Chứ > 70% thì bá quá") — bàn cũ chạy lại màn với ĐÚNG hình + ĐÚNG giá cuối (kết quả vòng,
 * chưa lộ) ⇒ ô đậm nhất báo TB 72 %, 53 % số lần > 70 %: nhìn trộm kịch bản. Bàn mới chỉ biết THẺ: mỗi mô phỏng RÚT hình theo thẻ (`chonHinh`) và neo
 * về một giá cuối CÓ SAI SỐ (lệch ~ chuẩn × (NC_LECH_TY_LE × |bp| + NC_LECH_SAN_BP)); ô kẹp trần NC_TRAN, phần dư chia cho các ô khác theo tỷ lệ.
 * Đo 420 màn: ô đậm nhất báo TB 37 %, trúng 38 %; > 70 % ở 0,5 % số lần (trước khi kẹp).
 * D522 (founder 05/10: "tổ chức cho max là 67% đi") — trần hạ 70 % → 67 %.
 */
describe('§II — D520: chỉ biết thẻ, không nhìn trộm kịch bản', async () => {
  const { kepTranNc, nghienCuuMan } = await import('../server/holdem/minigame/man.js');
  it('hằng số: lệch 0,6 × |bp| + 300 bp · trần 67 % (D522, PLAYTEST-TUNE)', () => {
    expect(TO_CHUC_V57.NC_LECH_TY_LE).toBe(0.6);
    expect(TO_CHUC_V57.NC_LECH_SAN_BP).toBe(300);
    expect(TO_CHUC_V57.NC_TRAN).toBe(0.67);
  });
  it('⭐ kẹp trần 67 % (vector tay): [0,9 · 0,1 · 0…] ⇒ [0,67 · 0,33 · 0…] · [1 · 0…] ⇒ [0,67 · 0,066 × 5] · dưới trần giữ nguyên', () => {
    expect(kepTranNc([0.9, 0.1, 0, 0, 0, 0]).map((x) => +x.toFixed(10))).toEqual([0.67, 0.33, 0, 0, 0, 0]);
    expect(kepTranNc([1, 0, 0, 0, 0, 0]).map((x) => +x.toFixed(10))).toEqual([0.67, 0.066, 0.066, 0.066, 0.066, 0.066]);
    expect(kepTranNc([0.5, 0.3, 0.2, 0, 0, 0])).toEqual([0.5, 0.3, 0.2, 0, 0, 0]);
  });
  it('⭐ không biết HÌNH thật: đổi hình của màn ⇒ bàn nghiên cứu y hệt (hình không còn là tham số)', () => {
    const b = bc(true);
    const goc = { seed: b.seed, ma: b.ma, kb: b.kb, dai: b.dai, q: b.q, cheDo: b.che_do ?? 'thuong' as const, ...(b.nac ? { nac: b.nac } : {}), nguon: b.nguon, diem: b.diem, mucTieuBp: b.muc_tieu_bp ?? null };
    expect(nghienCuuMan(goc)).toEqual(b.nghien_cuu);
    expect('hinh' in goc).toBe(false);
  });
  it('⭐ trên 30 màn: không ô nào > 67 %; ô đậm nhất TB ≤ 60 % (màn thử: BTC −15 %, biên rộng); ô báo ≥ 30 % trúng gần đúng số báo (±15 điểm) — không báo láo, không lộ đáp án', () => {
    let tongTop = 0, n = 0, bao = 0, trung = 0, o = 0;
    for (let sd = 1; sd <= 30; sd++) {
      const b = bc(true, sd), nc = b.nghien_cuu!, chay = dungDongMan(b).slice(NEN_LS * K_MIN), C = nc.day.length;
      let iD = 0, iP = 0;
      chay.forEach((c, j) => { if (c.l < chay[iD]!.l) iD = j; if (c.h > chay[iP]!.h) iP = j; });
      const that = { day: Math.min(C - 1, Math.floor((iD * C) / chay.length)), dinh: Math.min(C - 1, Math.floor((iP * C) / chay.length)) };
      for (const loai of ['day', 'dinh'] as const) {
        const p = nc[loai];
        expect(Math.max(...p)).toBeLessThanOrEqual(0.67 + 1e-9);
        tongTop += Math.max(...p); n++;
        p.forEach((x, i) => { if (x >= 0.3) { bao += x; o++; if (i === that[loai]) trung++; } });
      }
    }
    expect(tongTop / n).toBeLessThanOrEqual(0.6);
    expect(o).toBeGreaterThan(5);
    expect(Math.abs(trung / o - bao / o), `ô ≥ 30 %: báo TB ${(bao / o).toFixed(2)} · trúng ${(trung / o).toFixed(2)}`).toBeLessThanOrEqual(0.15);
  });
});
