/**
 * SỔ LIÊN HỆ — CÁI KÉO NÀO BẠN ĐÃ SỐNG QUA (12/09/2026, Q3 "liên kết nhìn thấy").
 *
 * ─── VÌ SAO CÓ ─────────────────────────────────────────────────────────────
 * Đo 12/09 (tệp nghiên cứu §8): bàn 12 ô có 1,7 sự kiện thật mỗi trận; sau 10
 * trận ngẫu nhiên một nửa người chơi mới gặp mỗi chữ ký thường đúng hai lần — và
 * không có gì cộng dồn qua trận, nên "hiểu sơ sơ mỗi cái một tý" là mô tả chính
 * xác. Founder 12/09: *"biến 10 trận thành một thứ có milestone cụ thể"*.
 * Mốc = MỘT MẶT SỰ KIỆN đã sống qua, ba bậc: GẶP (1) · GẶP LẠI (2) · QUEN (≥3).
 * Không đếm trận, không thưởng token (A11.11), không dãy cố định (seed ngẫu nhiên).
 *
 * ─── LUẬT ──────────────────────────────────────────────────────────────────
 * · HÀM THUẦN trên thứ đã lưu: seed + cỡ bàn + `balance_version` của trận ĐÃ XONG
 *   (`holdem_results`) ⇒ `sinhMap` tất định ⇒ mặt thật/giả từng ô. Không event mới,
 *   không migration, tính lại được bất cứ lúc nào (cùng nếp `soTayKhaiNiem`).
 * · KHÔNG đọc dây chuyền ghế mình: "sống qua" là cả bàn thấy — từ 12/09 dải
 *   thị trường (`DaiThiTruong`) cho cả sáu mã nhích, kể cả mã không cầm.
 * · `dau` = dấu của ma trận trôi `mtSuKien(bộ luật)` — luật engine, KHÔNG chép
 *   tay, KHÔNG phải β. Client chỉ vẽ sáu chấm nghiêng (D26: ID + số).
 * · Chỉ mặt ĐÃ GẶP có mặt trong danh sách; phần "chưa gặp" client tự vẽ mờ từ
 *   catalog (bản đồ những gì còn tồn tại — không phải danh sách việc, D67/A10).
 * ⚠ Trung thực về "đã thấy": trận chốt TRƯỚC khi dải sáu mã lên prod thì người
 *   chơi chưa thấy gì dù mặt có lật — gate theo trục `giao_dien` chưa cài (không
 *   có cột phiên bản giao diện trên trận). PLAYTEST: ghi trong báo cáo 12/09.
 */
import {
  boMaTranCua, mtSuKien, TAI_SAN, TINH_CHAT_NEN, type SuKienId,
} from '../../config/holdem.js';
import { luatCua } from '../../config/holdem_balance.js';
import { tuyChonSinhMap } from './engine.js';
import { bacLienHe, type LienHeSoTay } from './khoanh_khac_ids.js';
import { sinhMap } from './map.js';

export interface TranDaXong {
  /** Mốc trận (ISO/Date) — null nếu trận không có mốc. */
  luc: Date | null;
  seed: number;
  so_o: number;
  balance_version: string;
}

/** Ba bậc sống ở `khoanh_khac_ids.ts` (client vẽ cùng thang); đây chỉ là tên cũ cho test. */
export const bacCua = bacLienHe;

/**
 * Gom qua MỌI trận đã xong (thứ tự cũ → mới để `lan_dau` là trận SỚM NHẤT gặp thật).
 * Mặt gặp nhiều lên đầu; hoà thì theo thứ tự `TINH_CHAT_NEN` (thứ tự catalog).
 */
export function soLienHe(tran: readonly TranDaXong[]): LienHeSoTay[] {
  const so = new Map<string, LienHeSoTay>();
  const thuTu = Object.keys(TINH_CHAT_NEN);
  for (const t of tran) {
    const luat = luatCua(t.balance_version);
    const m = sinhMap(t.seed, t.so_o, tuyChonSinhMap(luat));
    const mt = mtSuKien(boMaTranCua({
      lop_vn: luat.lopVn === true, tai_san_v42: luat.taiSanV42 === true,
    }));
    for (const o of m.o) {
      if (o.kind !== 'su_kien') continue;
      const id: SuKienId = o.su_kien;
      let d = so.get(id);
      if (!d) {
        d = {
          id,
          tinh_chat: TINH_CHAT_NEN[id],
          so_lan: 0,
          so_lan_gia: 0,
          lan_dau: null,
          dau: TAI_SAN.map((ts) => ({
            ma: ts.id, dau: Math.sign(mt[ts.id]?.[id] ?? 0) as -1 | 0 | 1,
          })),
        };
        so.set(id, d);
      }
      if (o.la_tin_gia) {
        d.so_lan_gia += 1;
      } else {
        d.so_lan += 1;
        if (d.lan_dau === null && t.luc) d.lan_dau = t.luc.toISOString();
      }
    }
  }
  return [...so.values()].sort((a, b) => b.so_lan - a.so_lan
    || thuTu.indexOf(a.id) - thuTu.indexOf(b.id));
}
