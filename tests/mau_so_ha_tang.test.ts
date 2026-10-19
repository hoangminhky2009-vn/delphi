/**
 * MẪU SỐ HẠ TẦNG — "cân bằng T cho đúng số user app chịu được" (founder 05/09).
 *
 * Hai việc, và việc thứ hai mới là việc chính:
 *   1. canh `config/ha_tang.ts` không trôi khỏi `docs/gioi-han-ha-tang.md`;
 *   2. ⭐ tách kết luận nào GIỮ NGUYÊN trên cả dải mẫu số, khỏi kết luận nào
 *      chỉ đúng ở một con số. Tài liệu hạ tầng tự nói con số của nó là "bậc độ
 *      lớn, không phải 220" — nên một kết luận đổi dấu giữa 150 và 250 thì nó
 *      không phải kết luận, nó là một sự trùng hợp.
 */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, it, expect } from 'vitest';
import { C2_DANG_KY, DAI_MAU_SO, TRAN_HA_TANG } from '../config/ha_tang.js';
import { ECONOMY } from '../config/economy.js';
import { BATTLE_PASS } from '../config/battle_pass.js';
import {
  chiPhiBattlePass, nghiaVuMuaLai, runwayNgay, tongCungDuKien, tyLeQuyenDoiTrenCung,
} from '../server/kinh_te/mo_phong.js';
import { giaRoT, sucMuaBp } from '../server/kinh_te/chi_so_gia.js';

const DOC = readFileSync(join(process.cwd(), 'docs/gioi-han-ha-tang.md'), 'utf8');

describe('Mẫu số phải bám tài liệu hạ tầng, không được trôi (D61)', () => {
  it('con số 220 người/ngày vẫn là con số tài liệu tự tính ra', () => {
    expect(DOC).toContain('220 người chơi đều mỗi ngày');
    expect(TRAN_HA_TANG.GIUA).toBe(220);
  });

  it('dải "~200–250" và trần đồng thời vẫn đúng như tài liệu', () => {
    expect(DOC).toMatch(/200[-–]250/);
    expect(TRAN_HA_TANG.THAP).toBe(200);
    expect(TRAN_HA_TANG.CAO).toBe(250);
    // ⚠ Bài này ĐÃ ĐỎ MỘT LẦN, và đúng lúc nó nên đỏ: D271 nâng cổng 150 → 300
    // mà config kinh tế không ai sửa theo. Đó là toàn bộ việc của bài canh trôi.
    expect(DOC).toContain('300 người cùng lúc');
    expect(TRAN_HA_TANG.DONG_THOI).toBe(300);
  });

  it('⚠ tài liệu VẪN tự cảnh báo con số của nó là bậc độ lớn — đừng đọc như phép đo', () => {
    // Nếu câu này biến mất thì ai đó đã "chốt" con số; lúc đó phải đọc lại cả
    // bảng kinh tế, vì cả thiết kế đang đứng trên chỗ nó là một DẢI.
    expect(DOC).toContain('bậc độ lớn');
  });

  it('mốc C2 giữ ở đây chỉ để ĐỐI CHIẾU — và nó xa gấp hơn 20 lần', () => {
    expect(C2_DANG_KY).toBe(5_000);
    expect(C2_DANG_KY / TRAN_HA_TANG.GIUA).toBeGreaterThan(20);
  });
});

describe('⭐ Kết luận nào GIỮ trên cả dải, kết luận nào KHÔNG', () => {
  it('GIỮ: quyền đòi từ vật phẩm phát miễn phí vượt cung tiền ở MỌI mẫu số', () => {
    // Đây là lý do kết luận 176% không phải một tạo tác của con số 1.000: cả
    // tử lẫn mẫu đều tỉ lệ với số người, nên tỷ lệ gần như không đổi.
    for (const n of [...DAI_MAU_SO, 1_000, 5_000]) {
      const quyenDoi = nghiaVuMuaLai(BATTLE_PASS.SO_MAU_DOC_BAN * n, 600n);
      const bp = tyLeQuyenDoiTrenCung(quyenDoi, tongCungDuKien(n))!;
      expect(bp, `mẫu số ${n}: ${bp} bp`).toBeGreaterThan(10_000);
    }
  });

  it('GIỮ: battle pass ở thang Q cũ (60/chặng) vượt cung tiền ở MỌI mẫu số', () => {
    for (const n of [...DAI_MAU_SO, 1_000, 5_000]) {
      const chi = chiPhiBattlePass(60, BATTLE_PASS.SO_CHANG, n);
      expect(chi, `mẫu số ${n}`).toBeGreaterThan(tongCungDuKien(n));
    }
  });

  it('GIỮ: 1–2 T/chặng nằm trong tầm ở MỌI mẫu số (dưới 10% cung tiền)', () => {
    for (const n of [...DAI_MAU_SO, 1_000, 5_000]) {
      const chi = chiPhiBattlePass(2, BATTLE_PASS.SO_CHANG, n);
      const bp = tyLeQuyenDoiTrenCung(chi, tongCungDuKien(n))!;
      expect(bp, `mẫu số ${n}: ${bp} bp`).toBeLessThan(1_000);
    }
  });

  it('⚠ KHÔNG GIỮ: Kho bạc nuôi nổi bao nhiêu lượt trợ cấp/ngày — phụ thuộc mẫu số', () => {
    // Số này KHÔNG tỉ lệ với số người (Kho bạc là một khoản genesis CỐ ĐỊNH),
    // nên nó là kết luận duy nhất ở đây thật sự đổi theo mẫu số. Ghi ra để
    // không ai trích nó như một hằng số.
    const moiNgay = (soNguoiNhan: number) =>
      runwayNgay(BigInt(ECONOMY.TREASURY_GENESIS),
        BigInt(ECONOMY.SUBSIDY_AMOUNT) * BigInt(soNguoiNhan));
    // Cả roster nhận trợ cấp mỗi ngày ⇒ Kho bạc sống chưa tới ba ngày.
    for (const n of DAI_MAU_SO) {
      expect(moiNgay(n), `mẫu số ${n}`).toBeLessThan(3);
    }
    // Muốn sống trọn 90 ngày thì mỗi ngày chỉ được ~4 lượt nhận.
    expect(moiNgay(4)).toBeGreaterThanOrEqual(90);
    expect(moiNgay(5)).toBeLessThan(90);
  });
});

describe('Neo SỨC MUA — cách nói mà người chơi cảm được (founder 05/09)', () => {
  it('kỳ gốc: sức mua đúng 100%, rổ gốc tốn đúng vốn khởi điểm', () => {
    expect(sucMuaBp(10_000)).toBe(10_000);
    expect(giaRoT(10_000, ECONOMY.STARTING_BANKROLL))
      .toBe(BigInt(ECONOMY.STARTING_BANKROLL));
  });

  it('giá gấp đôi ⇒ sức mua còn một nửa, và rổ tốn gấp đôi vốn', () => {
    expect(sucMuaBp(20_000)).toBe(5_000);
    expect(giaRoT(20_000, 1_000)).toBe(2_000n);
  });

  it('giá còn một nửa ⇒ sức mua gấp đôi', () => {
    expect(sucMuaBp(5_000)).toBe(20_000);
    expect(giaRoT(5_000, 1_000)).toBe(500n);
  });

  it('chưa đo được ⇒ `null` cả hai vế, KHÔNG phải 0 hay 100% (A11.2)', () => {
    expect(sucMuaBp(null)).toBeNull();
    expect(giaRoT(null, 1_000)).toBeNull();
    // Chỉ số 0 là vô nghiệm, không phải "sức mua vô hạn".
    expect(sucMuaBp(0)).toBeNull();
  });

  it('từ chối đầu vào vô nghĩa', () => {
    expect(() => sucMuaBp(-1)).toThrow();
    expect(() => giaRoT(10_000, -1)).toThrow();
  });
});
