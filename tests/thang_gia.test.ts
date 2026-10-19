/**
 * THANG GIÁ TIÊU DÙNG — founder 05/09/2026:
 * *"đơn vị T tiêu dùng phổ biến phải là từ 10-100 nhé. Chứ thấp quá thì nhìn ko đã."*
 *
 * Bài này làm hai việc, và việc thứ hai mới là việc đắt:
 *   1. canh mọi giá NGƯỜI CHƠI GẶP THƯỜNG XUYÊN nằm trong 10–100 T;
 *   2. ⭐ ghi lại bằng số cái HỆ QUẢ mà luật đó kéo theo — ở thang này, phí
 *      theo tỷ lệ làm tròn xuống thành 0 trên phần lớn giao dịch nhỏ. Đó không
 *      phải lỗi của luật thang giá; đó là chỗ hai luật cấn nhau, và một con số
 *      viết ra được thì founder mới chốt được.
 */
import { describe, it, expect } from 'vitest';
import { CHO, CHO_BP, THANG_TIEU_DUNG } from '../config/cho.js';
import { CHINH_SACH } from '../config/chinh_sach.js';
import { BATTLE_PASS, tMoiChangDaChot } from '../config/battle_pass.js';
import { ECONOMY } from '../config/economy.js';
import { GACHA } from '../server/sandbox/gacha.js';
import { chiaPhi, giaSan } from '../server/kinh_te/gia.js';

/**
 * SỔ ĐĂNG KÝ ĐÓNG — cái gì là "tiêu dùng phổ biến".
 *
 * ⚠ Danh sách ĐÓNG chứ không phải một bài quét đoán mò: "phổ biến" là một phán
 * đoán thiết kế, không phải một tính chất đo được từ mã nguồn. Thêm một mục vào
 * đây là một QUYẾT ĐỊNH, và nó phải kèm `viSao` — cùng khuôn hai sổ đăng ký của
 * `cua_tieu.ts` (D253).
 */
const PHO_BIEN: ReadonlyArray<{ ten: string; gia: number; viSao: string }> = [
  {
    ten: 'một lượt gacha',
    gia: GACHA.COST_T,
    viSao: 'cửa tiêu T mà người chơi bấm nhiều nhất trong ngày',
  },
  {
    ten: 'vé đấu bậc đầu',
    gia: CHO.VE_DAU_BAC[0]!,
    viSao: 'cửa vào đấu giá — founder chốt "rẻ và nhiều, không khan hiếm"',
  },
  {
    ten: 'vé đấu bậc cuối',
    gia: CHO.VE_DAU_BAC[CHO.VE_DAU_BAC.length - 1]!,
    viSao: 'đầu đắt nhất của cùng bậc thang đó',
  },
  {
    ten: 'món bậc thường (giá gốc)',
    gia: CHO.GIA_GOC.thuong!,
    viSao: 'bậc rơi 70% — món người chơi cầm trong tay nhiều nhất',
  },
];

/**
 * CỐ Ý NGOÀI LUẬT — khan hiếm mà rẻ thì không còn khan hiếm.
 * Ghi ra để không ai "sửa cho nhất quán" rồi xoá mất khan hiếm.
 */
const NGOAI_LUAT: ReadonlyArray<{ ten: string; gia: number; viSao: string }> = [
  { ten: 'món epic', gia: CHO.GIA_GOC.epic!, viSao: 'đắt là cả bài học — 1.283 T kỳ vọng một epic' },
  { ten: 'món hiếm', gia: CHO.GIA_GOC.hiem!, viSao: 'bậc giữa, cố ý vượt trần tiêu dùng' },
  {
    ten: 'vé đăng cai bậc cuối',
    gia: CHO.VE_DANG_CAI_BAC[CHO.VE_DANG_CAI_BAC.length - 1]!,
    viSao: 'founder chốt khan hiếm gắt — bậc thang CHÍNH LÀ trần',
  },
];

describe('Thang giá tiêu dùng phổ biến: 10–100 T', () => {
  it('luật đúng như founder nói', () => {
    expect(THANG_TIEU_DUNG.SAN).toBe(10);
    expect(THANG_TIEU_DUNG.TRAN).toBe(100);
  });

  it('mọi giá PHỔ BIẾN nằm trong thang', () => {
    for (const m of PHO_BIEN) {
      expect(m.gia, `${m.ten} (${m.viSao})`).toBeGreaterThanOrEqual(THANG_TIEU_DUNG.SAN);
      expect(m.gia, `${m.ten} (${m.viSao})`).toBeLessThanOrEqual(THANG_TIEU_DUNG.TRAN);
    }
  });

  it('mọi món CỐ Ý ngoài luật thì thật sự ở ngoài — không có mục thừa trong sổ', () => {
    for (const m of NGOAI_LUAT) {
      expect(m.gia, `${m.ten} nằm trong thang ⇒ nó không còn là ngoại lệ, xoá khỏi sổ`)
        .toBeGreaterThan(THANG_TIEU_DUNG.TRAN);
    }
  });

  it('⭐ SÀN hệ số quỹ SUY RA từ thang giá, không đặt tay', () => {
    // Món rẻ nhất trong rổ: bậc thường, kho đầy nhất (hệ số tồn kho bậc cuối).
    const hsTonThapNhat = CHO.HS_TON_KHO_BP[CHO.HS_TON_KHO_BP.length - 1]!;
    const gia = (q: number) =>
      (BigInt(CHO.GIA_GOC.thuong!) * BigInt(hsTonThapNhat) * BigInt(q))
      / (BigInt(CHO_BP) * BigInt(CHO_BP));
    // Ngưỡng nhỏ nhất giữ được sàn 10 T.
    let toiThieu = 0;
    for (let q = 0; q <= CHO_BP; q += 1) {
      if (gia(q) >= BigInt(THANG_TIEU_DUNG.SAN)) { toiThieu = q; break; }
    }
    expect(toiThieu).toBe(3_334);
    expect(CHINH_SACH.HS_QUY_SAN_BP,
      `sàn ${CHINH_SACH.HS_QUY_SAN_BP} cho ra giá dưới ${THANG_TIEU_DUNG.SAN} T`)
      .toBeGreaterThanOrEqual(toiThieu);
    // Và ở sàn đó, món rẻ nhất thật sự còn trong thang.
    expect(giaSan('thuong', CHO.HS_TON_KHO_BP.length - 1, CHINH_SACH.HS_QUY_SAN_BP))
      .toBeGreaterThanOrEqual(BigInt(THANG_TIEU_DUNG.SAN));
  });

  it('HỒI QUY: sàn cũ 3.000 cho ra 9 T — dưới thang, đó là lý do nó đổi', () => {
    expect(giaSan('thuong', CHO.HS_TON_KHO_BP.length - 1, 3_000)).toBe(9n);
  });

  it('⭐ vé đăng cai BẮT ĐẦU đúng ở mép trần rồi leo — có chủ ý, không phải lệch', () => {
    // Bài canh bên trên lúc đầu bắt nó là "mục thừa trong sổ ngoại lệ", vì 100
    // không LỚN HƠN trần 100. Nhưng đọc lại thì đây đúng là thiết kế: nấc đầu
    // phải với tới được (nếu không thì không ai vào), nấc cuối mới là chỗ khan
    // hiếm. Khan hiếm nằm ở ĐỘ DỐC và ở SỐ BẬC, không nằm ở giá vào cửa.
    expect(CHO.VE_DANG_CAI_BAC[0]).toBe(THANG_TIEU_DUNG.TRAN);
    expect(CHO.VE_DANG_CAI_BAC[CHO.VE_DANG_CAI_BAC.length - 1]!)
      .toBeGreaterThan(THANG_TIEU_DUNG.TRAN * 4);
  });
});

describe('⚠⚠ HỆ QUẢ ĐÃ ĐO: ở thang này, phí theo tỷ lệ chạm 0 ở giao dịch nhỏ', () => {
  it('đốt 3% bắt đầu > 0 từ 34 T; Kho bạc 2% từ 50 T', () => {
    const dauTien = (lay: (t: bigint) => bigint) => {
      for (let t = 1; t <= 500; t += 1) if (lay(BigInt(t)) > 0n) return t;
      return null;
    };
    expect(dauTien((t) => chiaPhi(t).dot)).toBe(34);
    expect(dauTien((t) => chiaPhi(t).khoBac)).toBe(50);
  });

  it('⭐ MỌI giao dịch dưới 50 T nộp về Kho bạc ĐÚNG 0 T', () => {
    for (let t = 0; t < 50; t += 1) {
      expect(chiaPhi(BigInt(t)).khoBac, `${t} T`).toBe(0n);
    }
    expect(chiaPhi(50n).khoBac).toBe(1n);
  });

  it('⚠ vé đấu — cửa vào rẻ nhất — nộp về Kho bạc 0 T ở MỌI bậc', () => {
    // Đây là chỗ luật thang giá và mô hình nuôi Kho bạc cấn nhau, viết bằng số.
    for (const v of CHO.VE_DAU_BAC) {
      expect(chiaPhi(BigInt(v)).khoBac, `vé ${v} T`).toBe(0n);
      expect(chiaPhi(BigInt(v)).dot, `vé ${v} T`).toBe(0n);
    }
  });

  it('tỷ lệ phí THỰC TẾ lệch khỏi 2% danh nghĩa ra sao trong thang', () => {
    // Ghi lại bằng số để founder chốt trên số, không chốt trên cảm giác.
    const thucTe = (t: number) => Number(chiaPhi(BigInt(t)).khoBac) / t;
    expect(thucTe(10)).toBe(0);              // 0%
    expect(thucTe(20)).toBe(0);              // 0%
    expect(thucTe(50)).toBeCloseTo(0.02, 3); // 2,0%
    expect(thucTe(60)).toBeCloseTo(0.0167, 3); // 1,67% — dưới danh nghĩa
    expect(thucTe(100)).toBeCloseTo(0.02, 3);  // 2,0%
  });
});

describe('Battle pass: founder chốt 2 T/chặng (05/09)', () => {
  it('⭐ vòi T đã MỞ — cổng không còn ném lỗi', () => {
    expect(BATTLE_PASS.T_MOI_CHANG).toBe(2);
    expect(() => tMoiChangDaChot()).not.toThrow();
    expect(tMoiChangDaChot()).toBe(2);
  });

  it('cả mùa một người nhận 60 T = 6% vốn khởi điểm — tượng trưng có chủ ý', () => {
    const caMua = tMoiChangDaChot() * BATTLE_PASS.SO_CHANG;
    expect(caMua).toBe(60);
    expect(caMua / ECONOMY.STARTING_BANKROLL).toBeCloseTo(0.06, 3);
  });

  it('60 T cả mùa mua được đúng dưới một lượt gacha — thang giá nói lên điều đó', () => {
    expect(tMoiChangDaChot() * BATTLE_PASS.SO_CHANG).toBeLessThan(GACHA.COST_T);
  });
});
