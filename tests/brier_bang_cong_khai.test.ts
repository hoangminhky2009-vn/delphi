/**
 * ═══════════════════════════════════════════════════════════════════════════
 * D102 — BẢNG LỢI SUẤT CÔNG KHAI cho chỉ số #1 (bug thứ BA trong hồ sơ dữ liệu)
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * BUG ĐÃ SỐNG TỪ NGÀY CẮM DÂY (migration 0035): `dungChuoi` chỉ dựng mắt xích
 * cho mã GHẾ ĐANG CẦM, nên bảng đưa vào `brierVong` gán 0 cho mọi mã không cầm.
 * Hai hệ quả, cả hai làm thước đo NGƯỢC:
 *   · cầm ĐÚNG MỘT mã mà mã đó lời ⇒ luôn là argmax ⇒ Brier ~hoàn hảo, KỂ CẢ
 *     khi mã khác lời gấp đôi ⇒ thước THƯỞNG việc không đa dạng hoá — đúng cái
 *     docstring của `brierVong` viết ra để tránh;
 *   · mọi mã cầm đều LỖ ⇒ cao nhất = 0 ⇒ "mã thắng" rơi vào mã đầu bảng theo
 *     THỨ TỰ KHAI BÁO trong TAI_SAN. Một hằng số, không phải sự thật thị trường.
 *
 * ⚠ §I là bài quan trọng nhất file: nó dựng ĐÚNG ca (a) và chứng minh bảng công
 * khai chấm khác bảng riêng-ghế. Tiêm lỗi ngược = trả `theoMa` về, bài phải ĐỎ.
 */
import { describe, expect, it } from 'vitest';
import { TAI_SAN } from '../config/holdem.js';
import { brierVong } from '../server/holdem/brier.js';
import {
  choiVongCuoc, chotPhien, loiSuatCongKhai, taoTran, type GheMoi,
} from '../server/holdem/engine.js';

const ghe = (id: string, taiSan: string[] = ['btc']): GheMoi => ({
  id, loai: 'bot', bac_rank: 'Đồng',
  danh_muc: { tai_san: taiSan, chien_thuat: [] as never },
});
/** Bàn n ghế, ai cũng ôm btc — đủ để có crowding khác nhau giữa hai bàn. */
const ban = (n: number): GheMoi[] =>
  Array.from({ length: n }, (_, i) => ghe(`g${i}`, ['btc']));

describe('I. ⭐⭐ bảng CÔNG KHAI khác bảng riêng-ghế ở đúng hai ca hỏng', () => {
  it('ca (a): cầm 1 mã lời, mã KHÁC lời hơn ⇒ Brier phải PHẠT, không được ~0', () => {
    const vt = { btc: 10_000 };                     // ôm trọn một mã
    // Bảng CŨ (chỉ mã đang cầm, còn lại 0): btc là argmax ⇒ Brier = 0.
    const bangCu: Record<string, number> = {};
    for (const t of TAI_SAN) bangCu[t.id] = t.id === 'btc' ? 300 : 0;
    expect(brierVong(vt, bangCu)).toBe(0);          // ← thước cũ khen hoàn hảo

    // Bảng CÔNG KHAI (sự thật): vàng lời 900, hơn hẳn btc 300.
    const bangCong = { ...bangCu, vang: 900 };
    const b = brierVong(vt, bangCong)!;
    // p_btc = 1, o_btc = 0 ⇒ 1; p_vang = 0, o_vang = 1 ⇒ 1. Tổng = 2 (tệ nhất).
    expect(b).toBe(2);
  });

  it('ca (b): mọi mã CẦM đều lỗ ⇒ mã thắng không được là hằng số theo thứ tự khai báo', () => {
    const vt = { btc: 5000, vn30: 5000 };
    const bangCu: Record<string, number> = {};
    for (const t of TAI_SAN) bangCu[t.id] = (t.id === 'btc' || t.id === 'vn30') ? -300 : 0;
    // Thước cũ: cao nhất là 0, argmax = mã ĐẦU BẢNG không cầm — phụ thuộc thứ
    // tự khai báo TAI_SAN, đổi thứ tự là đổi kết quả. Khoá lại để thấy rõ.
    const maDauKhongCam = TAI_SAN.map((t) => t.id).find((id) => !(id in vt))!;
    let thangCu = ''; let cao = -Infinity;
    for (const [ma, r] of Object.entries(bangCu)) if (r > cao) { cao = r; thangCu = ma; }
    expect(thangCu).toBe(maDauKhongCam);

    // Bảng công khai: có một mã thật sự lời ⇒ thắng là nó, bất kể thứ tự khai báo.
    const bangCong = { ...bangCu, tpcp: 120 };
    let thangMoi = ''; cao = -Infinity;
    for (const [ma, r] of Object.entries(bangCong)) if (r > cao) { cao = r; thangMoi = ma; }
    expect(thangMoi).toBe('tpcp');
  });
});

describe('II. loiSuatCongKhai — chạy trên engine thật', () => {
  const st0 = () => taoTran(20260841, ban(5), { nav: true }, 8);

  it('phủ ĐỦ mọi mã, và KHÔNG phải toàn số 0', () => {
    const st = st0();
    const o = st.map.o[0]!;
    const bang = loiSuatCongKhai(st, o);
    expect(Object.keys(bang).sort()).toEqual(TAI_SAN.map((t) => t.id).sort());
    // Ít nhất một mã khác 0 — bảng toàn 0 là bảng chết (đúng lỗi đang vá).
    expect(Object.values(bang).some((x) => x !== 0)).toBe(true);
  });

  it('⭐ KHÔNG phụ thuộc ghế: hai ghế danh mục khác nhau đọc CÙNG một bảng', () => {
    const st = st0();
    const o = st.map.o[0]!;
    const a = loiSuatCongKhai(st, o);
    // Đổi danh mục mọi ghế rồi tính lại — bảng công khai phải y hệt.
    const st2 = {
      ...st,
      ghe: st.ghe.map((g) => ({
        ...g, danh_muc: { ...g.danh_muc, tai_san: ['btc', 'btc', 'vang'] },
      })),
    };
    expect(loiSuatCongKhai(st2, o)).toEqual(a);
  });

  it('⚠ ghế ảo KHÔNG được lọt vào st.ghe (lọt là đổi crowding của mọi trận đã lưu)', () => {
    const st = st0();
    const truoc = st.ghe.length;
    loiSuatCongKhai(st, st.map.o[0]!);
    expect(st.ghe.length).toBe(truoc);
    expect(st.ghe.some((g) => g.id === '__ao__')).toBe(false);
  });

  it('mắt xích RIÊNG GHẾ bị loại — bảng không mang crowding/khoá/bẻ kèo', () => {
    // Chen chúc phụ thuộc số ghế đang nắm mã; nếu nó lọt vào bảng công khai thì
    // đổi số ghế sẽ đổi "mã thắng" — tức đáp án phụ thuộc bàn, không phải thị trường.
    const o = taoTran(20260841, ban(5), { nav: true }, 8).map.o[0]!;
    const it = loiSuatCongKhai(taoTran(20260841, ban(4), { nav: true }, 8), o);
    const nhieu = loiSuatCongKhai(taoTran(20260841, ban(8), { nav: true }, 8), o);
    expect(it).toEqual(nhieu);
  });
});

describe('III. ⭐⭐ ĐƯỜNG CHẠY THẬT — engine phải chấm bằng bảng CÔNG KHAI', () => {
  /*
   * ⚠ VÌ SAO BÀI NÀY TỒN TẠI: tiêm lỗi ngược lần đầu (dựng lại `theoMa` của ghế
   * cho `brierVong`) KHÔNG làm bài nào đỏ — §I và §II đều chỉ đo HÀM, không đo
   * chỗ engine NỐI DÂY. Đó đúng lớp lỗ D93 đã bắt được ở 19 route `:id`: mũi
   * tiêm không đỏ được nghĩa là bộ test chưa canh gì ở đó. Bài này bịt.
   *
   * Cách dựng: quét seed tìm một vòng mà mã ghế đang ôm CÓ LỜI nhưng KHÔNG phải
   * mã lời nhất bàn. Với bảng cũ, ghế ôm đúng một mã lời ⇒ mã đó luôn là argmax
   * ⇒ Brier = 0. Với bảng công khai ⇒ Brier = 2. Khoảng cách không thể nhầm.
   */
  it('ghế ôm 1 mã LỜI nhưng có mã khác lời hơn ⇒ Brier PHẢI khác 0', () => {
    let daThu = 0; let daKhang = 0;
    for (let seed = 1; seed <= 400 && daKhang < 1; seed += 1) {
      const st = taoTran(seed, ban(4), { nav: true }, 8);
      if (!st.nav) continue;
      const o = st.map.o[0]!;
      const bang = loiSuatCongKhai(st, o);
      const cap = Object.entries(bang).sort((a, b) => b[1] - a[1]);
      const [maNhat, rNhat] = cap[0]!;
      // Tìm một mã KHÁC cũng lời, nhưng kém hơn mã nhất.
      const kem = cap.slice(1).find(([, r]) => r > 0 && r < rNhat);
      if (!kem || rNhat <= 0) continue;
      daThu += 1;

      const g = st.ghe[0]!;
      g.vi_the = { [kem[0]]: 10_000 };
      g.danh_muc = { ...g.danh_muc, tai_san: [kem[0]] };
      const b = brierVong(g.vi_the, bang);
      // Ôm trọn một mã KHÔNG phải mã thắng ⇒ (1−0)² + (0−1)² = 2.
      expect(b).toBe(2);
      // Và bảng CŨ sẽ cho 0 — chứng minh hai thước khác nhau thật sự.
      const cu: Record<string, number> = {};
      for (const t of TAI_SAN) cu[t.id] = t.id === kem[0] ? kem[1] : 0;
      expect(brierVong(g.vi_the, cu)).toBe(0);
      expect(maNhat).not.toBe(kem[0]);
      daKhang += 1;
    }
    expect(daThu).toBeGreaterThan(0);   // quét không ra ca nào ⇒ bài vô nghĩa
    expect(daKhang).toBe(1);
  });

  it('⭐ engine NỐI DÂY đúng: chỉ nhận ca hai bảng CHO KẾT QUẢ KHÁC NHAU', () => {
    /*
     * ⚠ BÀI ĐẦU CỦA TÔI LÀ PHÉP RỖNG (D58 lặp lại): tôi chọn ca "ghế ôm mã lời
     * kém hơn" rồi khẳng định brier = 2 — nhưng ở ca đó bảng CŨ cũng ra 2, vì
     * crowding kéo mã ghế đang ôm xuống ÂM nên argmax rơi vào một mã 0. Hai
     * thước cùng ra một số thì bài không chứng minh được engine dùng thước nào.
     * Nay dựng bảng CŨ từ chính `chain` engine trả, và CHỈ nhận ca hai bảng
     * khác nhau — lúc đó "engine trả số nào" mới là một câu hỏi có nghĩa.
     */
    let daPhanBiet = 0;
    for (let seed = 1; seed <= 3000 && daPhanBiet < 1; seed += 1) {
      // Mỗi ghế một mã khác nhau ⇒ crowding nhẹ ⇒ mã ghế ôm còn dương.
      const dan: GheMoi[] = ['btc', 'vn30', 'vang', 'usd']
        .map((m, i) => ghe(`g${i}`, [m]));
      const st = taoTran(seed, dan, { nav: true }, 8);
      if (!st.nav) continue;
      const g = st.ghe[0]!;
      g.vi_the = { btc: 10_000 };
      const { ketQua } = chotPhien(st, choiVongCuoc(st, () => ({ loai: 'theo' as const })));
      const cua = ketQua.ket_qua.find((x) => x.ghe_id === g.id)!;
      if (cua.brier === null || cua.brier === undefined) continue;

      // Bảng CŨ = gộp mắt xích CÓ MÃ trên chuỗi của CHÍNH ghế này (đúng bug cũ).
      const cu: Record<string, number> = {};
      for (const t of TAI_SAN) cu[t.id] = 0;
      for (const m of cua.chain) {
        const ma = (m as { id?: string; ma?: string }).id ?? (m as { ma?: string }).ma;
        if (ma !== undefined && ma in cu) cu[ma] = (cu[ma] ?? 0) + m.delta_bp;
      }
      const bCu = brierVong(g.vi_the, cu);
      const bCong = brierVong(g.vi_the, loiSuatCongKhai(st, st.map.o[0]!));
      if (bCu === bCong) continue;      // ca này không phân biệt được, bỏ

      daPhanBiet += 1;
      expect(cua.brier).toBe(bCong);    // engine phải theo bảng CÔNG KHAI
      expect(cua.brier).not.toBe(bCu);  // và KHÔNG theo bảng riêng ghế
    }
    // Quét không ra ca phân biệt ⇒ bài này không canh gì, phải biết ngay.
    expect(daPhanBiet).toBe(1);
  });
});
