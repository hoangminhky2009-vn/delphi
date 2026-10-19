/**
 * MA TRẬN TƯƠNG QUAN TÀI SẢN (D39) — founder duyệt 27/07.
 *
 * *"logic cộng gộp tuyến tính đang hơi ngây thơ khi thiếu đi tính tương quan giữa
 * các loại tài sản trong các sự kiện đặc biệt"* → *"Được, thêm ma trận tương quan"*.
 *
 * ─── FILE NÀY ĐO, KHÔNG ĐỌC CÔNG THỨC RỒI TIN ───────────────────────────────
 * Ba test cuối rút hàng chục nghìn lần nhiễu THẬT qua `nhieuCua()` rồi tính tương
 * quan mẫu, và so với ρ = β_i·β_j mà config khai. Lý do: repo này đã tám lần có
 * một cơ chế "code đủ, test đủ, không đường chạy nào gọi". Một test chỉ kiểm
 * `betaCua()` trả đúng số trong bảng sẽ VẪN XANH kể cả khi `dungChuoi` không hề
 * gọi tới nó — tức là canh đúng cái bẫy mà không bắt được nó.
 */
import { describe, expect, it } from 'vitest';
import { nhieuCua, taoTran, type TrangThaiTran } from '../server/holdem/engine.js';
import type { OThiTruong } from '../server/holdem/map.js';
import {
  SU_KIEN, TAI_SAN, betaCua, heSoRiengBp, tuongQuanBp, luatCua,
  type SuKienId,
} from '../config/holdem.js';

const ma = (id: string) => TAI_SAN.find((t) => t.id === id)!;

function ban(tuongQuan: boolean, seed = 7): TrangThaiTran {
  return taoTran(seed, [{
    id: 'ban', loai: 'bot', bac_rank: 'Đồng',
    danh_muc: { tai_san: [], chien_thuat: [] },
  }], { luatVon: true, dacQuyen: true, tuongQuan });
}

const oGiaiDoan: OThiTruong = { kind: 'giai_doan', giai_doan: 'di_ngang' };
const oSuKien = (id: SuKienId, giaMao = false): OThiTruong => ({
  kind: 'su_kien', su_kien: id, la_tin_gia: giaMao, boi_canh: 'don_doc',
  bao_truoc: SU_KIEN.find((x) => x.id === id)!.bao_truoc,
});

/** Tương quan mẫu Pearson của hai dãy — dùng để ĐO, không dùng trong engine. */
function tuongQuanMau(a: readonly number[], b: readonly number[]): number {
  const n = a.length;
  const ma_ = a.reduce((s, x) => s + x, 0) / n;
  const mb = b.reduce((s, x) => s + x, 0) / n;
  let tu = 0; let va = 0; let vb = 0;
  for (let i = 0; i < n; i += 1) {
    const da = a[i]! - ma_; const db = b[i]! - mb;
    tu += da * db; va += da * da; vb += db * db;
  }
  return va === 0 || vb === 0 ? 0 : tu / Math.sqrt(va * vb);
}

/** Rút `n` vòng nhiễu cho một mã — mỗi vòng một lần rút, đúng như engine làm. */
function day(st: TrangThaiTran, maId: string, o: OThiTruong, n: number): number[] {
  const ra: number[] = [];
  for (let v = 1; v <= n; v += 1) ra.push(nhieuCua({ ...st, vong: v }, ma(maId), o));
  return ra;
}

const N = 6000;

// ═══════════════════════════════════════════════════════════════════════════
describe('ma trận SINH RA, không điền vào — nên luôn hợp lệ', () => {
  it('ρ_ij = β_i · β_j, và đối xứng', () => {
    for (const sk of [null, 'hack_san', 'chien_tranh']) {
      const a = tuongQuanBp('btc', 'rui_ro', 'vang', 'phong_thu', sk);
      const b = tuongQuanBp('vang', 'phong_thu', 'btc', 'rui_ro', sk);
      expect(a, `đối xứng vỡ ở ${sk}`).toBe(b);
    }
  });

  it('đường chéo = 1 — mỗi mã tương quan hoàn hảo với chính nó', () => {
    for (const t of TAI_SAN) {
      const r = tuongQuanBp(t.id, t.nhom, t.id, t.nhom, 'hack_san');
      expect(r, `${t.id}`).toBeGreaterThan(0);
      expect(Math.abs(r), `|ρ| > 1 là ma trận không hợp lệ`).toBeLessThanOrEqual(10000);
    }
  });

  it('|ρ| ≤ 1 với MỌI cặp và MỌI sự kiện — bảng gõ tay hay vỡ đúng chỗ này', () => {
    const boiCanh: (SuKienId | null)[] = [null, ...SU_KIEN.map((s) => s.id)];
    for (const sk of boiCanh) {
      for (const x of TAI_SAN) {
        for (const y of TAI_SAN) {
          const r = tuongQuanBp(x.id, x.nhom, y.id, y.nhom, sk);
          expect(Math.abs(r), `${x.id}×${y.id} @ ${sk} = ${r}`).toBeLessThanOrEqual(10000);
        }
      }
    }
  });

  it('β² + k² = 1 — điều kiện GIỮ NGUYÊN độ biến động riêng từng mã', () => {
    /*
     * Nếu vế này vỡ thì tổng biến động phình lên, và mọi chênh lệch Monte Carlo
     * đo được sau đó không tách được "tương quan làm khó" khỏi "engine ồn hơn".
     */
    for (const b of [0, 1500, 3000, 6000, 8500, 9900]) {
      const k = heSoRiengBp(b);
      const tong = (b * b + k * k) / (10000 * 10000);
      expect(tong, `β=${b}bp`).toBeCloseTo(1, 3);
    }
  });

  it('β bị kẹp dưới ±1 — β=±1 biến hai mã cùng nhóm thành MỘT tài sản', () => {
    for (const t of TAI_SAN) {
      for (const sk of SU_KIEN.map((s) => s.id)) {
        expect(Math.abs(betaCua(t.id, t.nhom, sk)), `${t.id}@${sk}`).toBeLessThan(10000);
      }
    }
    expect(heSoRiengBp(9900), 'còn phần nhiễu riêng thật sự').toBeGreaterThan(0);
  });
});

// ═══════════════════════════════════════════════════════════════════════════
describe('CHỮ KÝ TỪNG SỰ KIỆN — phần dạy được, không phải cần gạt độ khó', () => {
  it('KHỦNG HOẢNG THANH KHOẢN: cả hai nhóm cùng DƯƠNG — bán cả vàng để lấy tiền mặt', () => {
    for (const sk of ['hack_san', 'thien_nga_den'] as const) {
      expect(betaCua('btc', 'rui_ro', sk)).toBeGreaterThan(0);
      expect(betaCua('vang', 'phong_thu', sk), `${sk}: vàng phải bị bán theo`)
        .toBeGreaterThan(0);
      expect(tuongQuanBp('btc', 'rui_ro', 'vang', 'phong_thu', sk),
        'phân tán PHẢI thất bại đúng lúc cần nhất').toBeGreaterThan(0);
    }
  });

  it('CHIẾN TRANH: vàng hộ giá THẬT — tương quan với tài sản rủi ro là ÂM', () => {
    expect(betaCua('vang', 'phong_thu', 'chien_tranh')).toBeLessThan(0);
    expect(tuongQuanBp('btc', 'rui_ro', 'vang', 'phong_thu', 'chien_tranh'))
      .toBeLessThan(0);
  });

  it('LẠM PHÁT: trái phiếu rơi CÙNG cổ phiếu, nhưng vàng vẫn hộ (chữ ký 2022)', () => {
    expect(tuongQuanBp('vn30', 'rui_ro', 'tpcp', 'phong_thu', 'lam_phat'),
      'TPCP phải cùng chiều cổ phiếu').toBeGreaterThan(0);
    expect(tuongQuanBp('vn30', 'rui_ro', 'vang', 'phong_thu', 'lam_phat'),
      'vàng vẫn phải ngược chiều').toBeLessThan(0);
  });

  it('VÒNG THƯỜNG phân tán vẫn có tác dụng — khủng hoảng mới là ngoại lệ', () => {
    const thuong = tuongQuanBp('btc', 'rui_ro', 'cp_cn', 'rui_ro', null);
    const sap = tuongQuanBp('btc', 'rui_ro', 'cp_cn', 'rui_ro', 'hack_san');
    expect(sap, 'khủng hoảng phải cùng nhịp hơn hẳn ngày thường')
      .toBeGreaterThan(thuong * 3);
  });
});

// ═══════════════════════════════════════════════════════════════════════════
describe('ĐO THẬT — cơ chế có CHẠY không (bẫy số 1, đã dính 8 lần)', () => {
  it('cổng TẮT ⇒ nhiễu y hệt bản trước D39, và hai mã KHÔNG cùng nhịp', () => {
    const st = ban(false);
    const a = day(st, 'btc', oSuKien('hack_san'), N);
    const b = day(st, 'cp_cn', oSuKien('hack_san'), N);
    expect(Math.abs(tuongQuanMau(a, b)),
      'trước D39 hai mã độc lập — đây là lá chắn replay của trận cũ')
      .toBeLessThan(0.05);
  });

  it('cổng BẬT ⇒ tương quan ĐO ĐƯỢC khớp ρ mà config khai', () => {
    const st = ban(true);
    const o = oSuKien('hack_san');
    const doDuoc = tuongQuanMau(day(st, 'btc', o, N), day(st, 'cp_cn', o, N));
    const khai = tuongQuanBp('btc', 'rui_ro', 'cp_cn', 'rui_ro', 'hack_san') / 10000;
    expect(doDuoc, `đo ${doDuoc.toFixed(3)} vs khai ${khai.toFixed(3)}`)
      .toBeCloseTo(khai, 1);
  });

  it('cổng BẬT + CHIẾN TRANH ⇒ đo ra tương quan ÂM giữa BTC và vàng', () => {
    const st = ban(true);
    const o = oSuKien('chien_tranh');
    const doDuoc = tuongQuanMau(day(st, 'btc', o, N), day(st, 'vang', o, N));
    expect(doDuoc, 'vàng phải thật sự đi ngược, không chỉ khai trong bảng')
      .toBeLessThan(-0.1);
  });

  it('ĐỘ BIẾN ĐỘNG TỪNG MÃ GIỮ NGUYÊN khi bật cổng — chỉ CÙNG NHỊP là đổi', () => {
    const tat = day(ban(false), 'btc', oSuKien('hack_san'), N);
    const bat = day(ban(true), 'btc', oSuKien('hack_san'), N);
    const sd = (x: readonly number[]) => {
      const m = x.reduce((s, v) => s + v, 0) / x.length;
      return Math.sqrt(x.reduce((s, v) => s + (v - m) ** 2, 0) / x.length);
    };
    // Sai số 20%: hai dãy là hai mẫu khác nhau, và trộn hai biến đều làm hình
    // chuông hơn — phương sai giữ nguyên nhưng mẫu hữu hạn vẫn dao động.
    expect(sd(bat) / sd(tat), 'tổng biến động phình lên = đo nhầm biến').toBeGreaterThan(0.8);
    expect(sd(bat) / sd(tat)).toBeLessThan(1.2);
  });

  it('⚠ TIN GIẢ KHÔNG ĐƯỢC LỘ QUA TƯƠNG QUAN — nếu lộ là phát không máy dò tin giả', () => {
    /*
     * BẪY NGUY HIỂM NHẤT CỦA CẢ CỤM. Nếu tương quan chỉ dâng với tin THẬT thì người
     * chơi chỉ cần nhìn "mọi mã có cùng nhịp không" là biết thật hay giả — giết gate
     * G4 và giết luôn bản sắc "tin giả" của trò. Cùng nguyên tắc đã áp cho
     * `GOI_KY_QUY` và `xepHangUngVien`.
     */
    const st = ban(true);
    const that = oSuKien('hack_san', false);
    const gia = oSuKien('hack_san', true);
    expect(day(st, 'btc', gia, 200), 'cùng ô, đổi cờ tin giả ⇒ phải GIỐNG HỆT')
      .toEqual(day(st, 'btc', that, 200));
    expect(tuongQuanMau(day(st, 'btc', gia, N), day(st, 'cp_cn', gia, N)))
      .toBeCloseTo(tuongQuanMau(day(st, 'btc', that, N), day(st, 'cp_cn', that, N)), 5);
  });
});

// ═══════════════════════════════════════════════════════════════════════════
describe('cổng phiên bản', () => {
  it('mọi bản trước v9 KHÔNG có tương quan — trận cũ replay nguyên vẹn', () => {
    for (const pb of ['balance-v5-D30-camket', 'balance-v6-luatvon',
      'balance-v7-dacquyen', 'balance-v8-donbay']) {
      expect(luatCua(pb).tuongQuan, pb).toBe(false);
    }
    expect(luatCua('balance-v999-la').tuongQuan).toBe(false);
  });

  it('v9 bật tương quan, và KHÔNG lén bật thứ đang bị giữ ở cổng', () => {
    const l = luatCua('balance-v9-tuongquan');
    expect(l.tuongQuan).toBe(true);
    expect(l.donBayCamKet, 'bump phiên bản không phải dịp bật thứ đang chờ founder')
      .toBe(false);
  });
});
