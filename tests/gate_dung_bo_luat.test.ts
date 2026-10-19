import { describe, expect, it } from 'vitest';
import { HOLDEM_BALANCE_VERSION, HOLDEM_DECISIONS, luatCua } from '../config/holdem.js';
import { taoTran } from '../server/holdem/engine.js';
import { sinhMap } from '../server/holdem/map.js';

/*
 * BÀN ĐO PHẢI ĐO ĐÚNG TRÒ ĐANG SHIP — Ở MỌI CỠ MAP (dựng 11/08).
 *
 * ⚠⚠ BÀI NÀY CANH MỘT LỖI ĐÃ XẢY RA VÀ ĐÃ BẨN NHIỀU THÁNG SỐ ĐO.
 * `scripts/holdem_montecarlo.ts` từng làm thế này ngay sau `taoTran`:
 *       if (CO_MAP !== MAP_SIZE) st = { ...st, map: sinhMap(seed, CO_MAP) };
 * `sinhMap(seed, size)` THIẾU tham số thứ ba thì mặc định TẮT HẾT cổng hành vi
 * (lịch · quán tính · sức căng · chu kỳ · telegraph · lãi suất nền · bong bóng
 * chuỗi · mapV28). Nên với mọi cỡ map KHÁC mặc định, bàn đo chạy một `st` mang
 * cờ bộ luật đang ship trên một TẤM MAP không có bộ luật ấy.
 *
 * Đó là kiểu hỏng tệ nhất repo biết: không ném lỗi, không làm test nào đỏ, và
 * vẫn in ra một bảng số trông hợp lý. Nó âm thầm làm bẩn mọi kết luận cân bằng
 * ở map 12/16 — G1 "đỏ ở map 12", G4 "đỏ cả hai vế" đều đo trên một trò đã
 * không tồn tại từ D43. Ô map 8 thoát chỉ vì nó BẰNG mặc định nên nhánh ghi đè
 * không chạy — tức đúng ô mọi người quen nhìn là ô duy nhất còn sạch.
 *
 * Bài khoá TÍNH CHẤT, không khoá một con số: cỡ map không được phép đổi BỘ LUẬT
 * của trận. Đổi tham số kinh tế bao nhiêu cũng vẫn xanh; dựng lại nguồn map thứ
 * hai ở bất kỳ đâu là đỏ.
 */

const GHE = [0, 1, 2, 3, 4].map((i) => ({
  id: `g${i}`, loai: 'bot' as const, bac_rank: 'Đồng',
  danh_muc: { tai_san: [], chien_thuat: [] },
}));

const CO_MAP = HOLDEM_DECISIONS.CO_MAP_CHON;
const LUAT = luatCua(HOLDEM_BALANCE_VERSION);

describe('bàn đo dùng đúng bộ luật ở mọi cỡ map', () => {
  it('bộ luật đang ship có bật cổng map — nếu không thì cả bài này vô nghĩa', () => {
    // Chốt chặn: bài dưới so "có cổng" với "không cổng". Nếu bộ luật đang ship
    // vô tình tắt hết cổng map thì hai vế bằng nhau và bài kia xanh giả.
    const coCong = LUAT.chuKy === true || LUAT.mapV28 === true
      || LUAT.quanTinh === true || LUAT.lichChinhSach === true;
    expect(coCong, 'bộ luật đang ship phải bật ít nhất một cổng sinh map').toBe(true);
  });

  it.each(CO_MAP)('map %i: taoTran dựng map CÓ cổng, khác hẳn sinhMap trần', (soO) => {
    for (const seed of [1, 7, 20260841]) {
      const coCong = taoTran(seed, GHE, LUAT, soO).map;
      const tran = sinhMap(seed, soO);
      expect(coCong.o).toHaveLength(soO);
      expect(tran.o).toHaveLength(soO);
      expect(
        JSON.stringify(coCong.o),
        `map ${soO} seed ${seed}: map của taoTran TRÙNG map trần`
        + ' ⇒ cổng luật không tới được đường sinh map',
      ).not.toBe(JSON.stringify(tran.o));
    }
  });

  it.each(CO_MAP)('map %i: trạng thái chu kỳ có mặt đủ mọi ô', (soO) => {
    // `trang_thai` chỉ sinh ra khi cổng chu kỳ/lãi suất chạy. Nó vắng mặt chính
    // là dấu tay của một tấm map dựng bằng lời gọi trần.
    const st = taoTran(20260841, GHE, LUAT, soO);
    expect(st.map.trang_thai, `map ${soO} thiếu trang_thai`).toBeDefined();
    expect(st.map.trang_thai).toHaveLength(soO);
  });

  it('cỡ map KHÔNG được đổi bộ luật của trận', () => {
    // Cùng seed, khác cỡ map ⇒ mọi cờ luật trên trạng thái phải y hệt nhau.
    const co = (soO: number) => {
      const st = taoTran(11, GHE, LUAT, soO) as unknown as Record<string, unknown>;
      return Object.fromEntries(Object.entries(st)
        .filter(([, v]) => typeof v === 'boolean').sort());
    };
    const nen = co(HOLDEM_DECISIONS.MAP_SIZE);
    for (const soO of CO_MAP) {
      expect(co(soO), `map ${soO} mang bộ cờ khác map mặc định`).toEqual(nen);
    }
  });
});
