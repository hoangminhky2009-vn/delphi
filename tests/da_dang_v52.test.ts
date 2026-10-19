/**
 * ĐA DẠNG HOÁ v52 (D371) — LÁ THÔI THU TIỀN THUÊ MỖI VÒNG.
 *
 * ─── CÁI BÀI NÀY CANH, VÀ VÌ SAO NÓ PHẢI TỒN TẠI ───────────────────────────
 * Mắt xích `da_dang` chạy MỖI VÒNG chỉ cần lá nằm trong danh mục, và rơi vào
 * tầng DANH MỤC nên `apDinhGia` nhân nó vào MỌI vị thế. Bộ số cũ (−700 + 260×n)
 * hoà vốn ở 2,69 mã trong khi trần số mã là 3 (4 với chính lá này), nên người
 * cầm 1–2 mã bị bào mỗi vòng. Founder báo 21/09 khi chơi vai TỔ CHỨC — vai
 * GHIM sẵn lá này từ vòng 1, lúc danh mục còn trống.
 *
 * ⚠⚠ VÌ SAO 71 BÀI CANH VAI + ĐẶC QUYỀN ĐANG XANH VẪN KHÔNG BẮT ĐƯỢC: không
 * bài nào hỏi "mắt xích này ÂM ở mấy mã". Chúng canh cổng bật/tắt, canh cơ chế
 * có chạy, canh replay không đổi — đều đúng, đều không chạm chỗ hỏng. Nên bài
 * dưới đây canh đúng một TÍNH CHẤT mà bộ số phải giữ, không canh một con số:
 *
 *   ⭐ CẦM LÁ + CẦM ÍT NHẤT MỘT MÃ ⇒ MẮT XÍCH KHÔNG ĐƯỢC ÂM.
 *
 * Phát biểu bằng tính chất chứ không bằng hằng số là cố ý (bẫy 7 ghi ở đầu
 * `holdem_dac_quyen.test.ts`): chép `-30`/`35` vào đây thì bài chỉ nhắc lại
 * config. Phát biểu thế này thì LẦN SAU ai chỉnh bộ số về vùng bào, bài đỏ.
 */
import { describe, expect, it } from 'vitest';
import {
  daDangCua, dungChuoi, taoTran,
  type Ghe, type GheMoi, type MatXich, type TrangThaiTran,
} from '../server/holdem/engine.js';
import { dungTuDien } from '../server/holdem/tu_dien.js';
import {
  CHIEN_THUAT, DA_DANG_HOA, DA_DANG_HOA_V52, HOLDEM_BALANCE_VERSION, HOLDEM_MATCH,
  TAI_SAN, luatCua, type ChienThuatId,
} from '../config/holdem.js';
import type { OThiTruong } from '../server/holdem/map.js';

// ---------------------------------------------------------------------------
// Đồ nghề
// ---------------------------------------------------------------------------

const gd = (): OThiTruong => ({ kind: 'giai_doan', giai_doan: 'di_ngang' });

function ghe(id: string, taiSan: string[], chienThuat: ChienThuatId[] = []): GheMoi {
  return {
    id, loai: 'bot', bac_rank: 'Đồng',
    danh_muc: { tai_san: taiSan, chien_thuat: chienThuat },
  };
}

/** Bàn map dàn sẵn một ô ĐI NGANG — cô lập mắt xích đang đo khỏi ô ngẫu nhiên. */
function ban(ghes: readonly GheMoi[], v52: boolean): TrangThaiTran {
  const st = taoTran(4242, ghes, {
    luatVon: true, dacQuyen: true, daDangV52: v52,
  });
  return { ...st, map: { ...st.map, o: [gd(), gd()] }, vong: 1 };
}

const gheCua = (st: TrangThaiTran, id: string): Ghe => st.ghe.find((g) => g.id === id)!;
const daDang = (chain: readonly MatXich[]) =>
  chain.filter((m) => m.kind === 'da_dang').reduce((s, m) => s + m.delta_bp, 0);

/** Sáu mã thật của config — KHÔNG gõ tay id, thêm/bớt mã là bài tự theo. */
const MA = TAI_SAN.map((t) => t.id);
/** Trần số mã khi CẦM lá này (sức chứa, khác hẳn tốc độ nhặt lá mỗi vòng). */
const TRAN_CO_LA = HOLDEM_MATCH.MAX_TAI_SAN + 1;

/** Mắt xích `da_dang` của một ghế cầm `n` mã khác nhau. */
function mucTaiN(n: number, v52: boolean): number {
  const st = ban([ghe('a', MA.slice(0, n), ['da_dang_hoa'])], v52);
  return daDang(dungChuoi(st, gheCua(st, 'a'), st.map.o[0]!).chain);
}

// ---------------------------------------------------------------------------
// 1. CỔNG — trận cũ phải replay ra đúng bộ số cũ
// ---------------------------------------------------------------------------

describe('1. CỔNG v52', () => {
  it('bảng tra biết bản nào dùng bộ số mới, bản nào không', () => {
    expect(luatCua('balance-v51-phibac').daDangV52).toBe(false);
    expect(luatCua('balance-v52-dadang').daDangV52).toBe(true);
    // Bản cũ KHÔNG được mất cần gạt của chính nó chỉ vì có bản mới ra đời.
    expect(luatCua('balance-v51-phibac').phiLenhBac).toBe(true);
  });

  it('phiên bản lạ / thiếu ⇒ tắt, không đoán bừa', () => {
    expect(luatCua(undefined).daDangV52).toBe(false);
    expect(luatCua('balance-v0-khong-ton-tai').daDangV52).toBe(false);
  });

  it('`daDangCua` là MỘT CỬA: cờ tắt ⇒ bộ cũ, cờ bật ⇒ bộ mới', () => {
    expect(daDangCua({})).toBe(DA_DANG_HOA);
    expect(daDangCua({ da_dang_v52: false })).toBe(DA_DANG_HOA);
    expect(daDangCua({ da_dang_v52: true })).toBe(DA_DANG_HOA_V52);
  });

  it('cổng TẮT ⇒ mắt xích ra ĐÚNG bộ số cũ, từng bp', () => {
    for (let n = 1; n <= TRAN_CO_LA; n += 1) {
      expect(mucTaiN(n, false), `${n} mã`)
        .toBe(DA_DANG_HOA.PHI_BP + n * DA_DANG_HOA.MOI_MA_BP);
    }
  });

  it('cổng BẬT ⇒ số PHẢI KHÁC cổng tắt — bằng nhau nghĩa là cờ không điều khiển gì', () => {
    // Đo ở mọi nấc để một nấc tình cờ trùng không che được cả cụm.
    const khac: number[] = [];
    for (let n = 1; n <= TRAN_CO_LA; n += 1) {
      if (mucTaiN(n, true) !== mucTaiN(n, false)) khac.push(n);
    }
    expect(khac.length, 'số nấc mà cờ đổi được kết quả').toBe(TRAN_CO_LA);
  });
});

// ---------------------------------------------------------------------------
// 2. TÍNH CHẤT — cái founder báo, viết thành một bất biến
// ---------------------------------------------------------------------------

describe('2. CẦM LÁ + CÓ MÃ ⇒ KHÔNG BỊ BÀO', () => {
  it('⭐ v52: mọi nấc từ 1 mã tới hết trần đều KHÔNG ÂM', () => {
    for (let n = 1; n <= TRAN_CO_LA; n += 1) {
      expect(mucTaiN(n, true), `${n} mã — lá thu tiền thuê của người đã giữ vị thế`)
        .toBeGreaterThanOrEqual(0);
    }
  });

  it('🔴 bộ CŨ đúng là bào thật — nếu không thì bài trên canh một chuyện không có', () => {
    // Đây là vế ĐỐI CHỨNG. Không có nó thì bài trên có thể xanh vì cả hai bộ
    // đều không âm, tức nó chứng minh một chuyện chẳng ai nghi ngờ.
    const am: number[] = [];
    for (let n = 1; n <= TRAN_CO_LA; n += 1) if (mucTaiN(n, false) < 0) am.push(n);
    expect(am, 'bộ cũ phải âm ở ít nhất một nấc trong tầm với').not.toHaveLength(0);
  });

  it('thưởng vẫn TĂNG theo số mã — không được làm phẳng thành "cầm mấy mã cũng thế"', () => {
    for (let n = 2; n <= TRAN_CO_LA; n += 1) {
      expect(mucTaiN(n, true), `${n} mã phải hơn ${n - 1} mã`)
        .toBeGreaterThan(mucTaiN(n - 1, true));
    }
  });

  it('không cầm mã nào ⇒ mắt xích vẫn có mặt nhưng danh mục rỗng thì không có gì để nhân', () => {
    // Vế thứ hai do `apDinhGia` lo (nhân trên 0 vị thế = 0); ở đây chỉ canh
    // rằng vế SỐ không phình ra khi n = 0.
    expect(mucTaiN(0, true)).toBe(DA_DANG_HOA_V52.PHI_BP);
  });

  it('hoà vốn DƯỚI 1 mã — phát biểu bằng quan hệ, không bằng hằng số', () => {
    const hoaVon = -DA_DANG_HOA_V52.PHI_BP / DA_DANG_HOA_V52.MOI_MA_BP;
    expect(hoaVon).toBeLessThanOrEqual(1);
    // …và bộ cũ thì KHÔNG, đó chính là cái đã hỏng.
    expect(-DA_DANG_HOA.PHI_BP / DA_DANG_HOA.MOI_MA_BP).toBeGreaterThan(1);
  });

  it('mức hoà vốn phải nằm trong TẦM VỚI của trần số mã, kể cả sau này chỉnh số', () => {
    // Bài canh cho LẦN SAU: ai kéo phí lên mà quên trần thì đỏ ở đây, đúng
    // chỗ bộ số cũ đã trôi ra ngoài khi founder hạ trần 4 → 3 (27/07).
    const hoaVon = -DA_DANG_HOA_V52.PHI_BP / DA_DANG_HOA_V52.MOI_MA_BP;
    expect(hoaVon).toBeLessThan(TRAN_CO_LA);
  });
});

// ---------------------------------------------------------------------------
// 3. TỜ (!) — người chơi phải ĐỌC ĐƯỢC khoản thu mỗi vòng
// ---------------------------------------------------------------------------

describe('3. TỜ (!) khai khoản mỗi vòng', () => {
  const dung = (v52: boolean) => dungTuDien(
    TAI_SAN, CHIEN_THUAT.map((x) => x.id),
    undefined, undefined, undefined,
    false, false, false, false, false, false, v52,
  ).chien_thuat['da_dang_hoa']?.dac_quyen ?? [];

  it('có dòng nói "MỖI vòng" — trước D371 tờ này chỉ liệt kê hai điều lợi', () => {
    const d = dung(true).join(' | ');
    expect(d).toMatch(/MỖI vòng/);
  });

  it('nói rõ nó tính trên TOÀN BỘ vị thế, không phải trên một mã', () => {
    expect(dung(true).join(' | ')).toMatch(/TOÀN BỘ vị thế/);
  });

  it('nói mức hoà vốn — con số quyết định lá này đáng cầm hay không', () => {
    const hoaVon = Math.ceil(-DA_DANG_HOA_V52.PHI_BP / DA_DANG_HOA_V52.MOI_MA_BP);
    expect(dung(true).join(' | ')).toContain(`${hoaVon} mã`);
  });

  it('tờ đi theo ĐÚNG bộ số của bộ luật đang phục vụ, không cứng một bảng', () => {
    expect(dung(true).join(' | ')).not.toBe(dung(false).join(' | '));
  });
});

// ---------------------------------------------------------------------------
// 4. BẢN ĐANG SHIP
// ---------------------------------------------------------------------------

describe('4. bộ luật mặc định', () => {
  it('bản đang ship bật cờ này — ghim TÍNH CHẤT, không ghim chuỗi tên', () => {
    expect(luatCua(HOLDEM_BALANCE_VERSION).daDangV52).toBe(true);
  });

  it('vai TỔ CHỨC vẫn ghim đúng lá này — nếu đổi ghim thì cả bộ số trên phải đo lại', () => {
    // Không import `VAI` để canh tên vai; canh bằng quan hệ: lá bị ghim bởi
    // MỘT vai nào đó nghĩa là có người trả khoản này mà không hề chọn nó.
    expect(luatCua(HOLDEM_BALANCE_VERSION).vaiCoRang).toBe(true);
  });
});
