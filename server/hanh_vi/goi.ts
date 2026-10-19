/**
 * ═══════════════════════════════════════════════════════════════════════════
 * GÓI HÀNH VI — "phân tích chỉ bật khi có đủ pack data" (founder 22/08, D106)
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * Thuần + tất định: nhận dòng `hanh_vi_vong` đã sắp theo thời gian, chia thành
 * GÓI. Một gói đầy khi CẢ BA đủ (doc duong-ong-hanh-vi §2, founder chốt Q1-A):
 *   · ≥ GOI.TRAN trận ĐÃ XONG
 *   · ≥ GOI.VONG_QUYET vòng có quyết định (không `tu_dong`)
 *   · ≥ GOI.VONG_SU_KIEN vòng sự kiện có quyết định
 * Chưa đủ thì gói cứ mở tiếp — gói có thể DÀI HƠN 10 trận, không bao giờ ngắn hơn.
 *
 * Vì sao đếm ba thứ chứ không đếm trận: 90 bỏ dở / 47 xong (D62) và 79–92% vòng
 * nửa sau trận trống (D102) ⇒ "10 trận" có thể chỉ chứa ~30 vòng có quyết định,
 * còn chỉ số #3 cần vòng SỰ KIỆN. Số trận là thước sai đơn vị.
 *
 * ─── CÁI GÌ VÀO GÓI ─────────────────────────────────────────────────────────
 *   · chỉ trận ĐÃ XONG (`tran_xong`) — trận bỏ dở loại hẳn: D86 (trận mở farm
 *     được) + D62 (66/90 lượt bỏ nằm ở phút đầu — mẫu lệch về phía "mở rồi đi");
 *   · không màn tập (`man_tap`) — bàn dạy, không phải quyết định;
 *   · không trận nghi máy (`nghi_may`).
 *   Cờ là NHÃN ở tầng kho; đây là nơi QUYẾT loại — một chỗ, có tên.
 *
 * ⚠ Ngưỡng là PLAYTEST-TUNE (A8.2) — chọn từ sàn cỡ mẫu sẵn có của insight.ts
 * (#2: 5 · #3: 5 · #4: 4+4 · #5: 3+3) nhân ~4. Phải đo lại bằng phân phối null
 * trên bot (scripts/hieu_chuan_null.ts) trước khi tin.
 */
import { dungHoSo, type HoSoTinhCach, type VongInsight } from '../holdem/insight.js';

/**
 * Đầu vào của gói — `VongInsight` + đúng bốn cờ gói cần. Khai ở đây (không import
 * `kho.ts`) để module này THUẦN: web bundle kiểu `HoSoGoi` qua `@server/hanh_vi/goi`
 * mà không kéo `pg` vào chương trình tsc của web.
 */
export interface VongGoi extends VongInsight {
  tran_xong: boolean;
  man_tap: boolean;
  nghi_may: boolean;
}

export const GOI = {
  TRAN: 10,
  VONG_QUYET: 40,
  VONG_SU_KIEN: 8,
  /** Trục tiêu dùng đếm riêng theo HÀNH ĐỘNG TIỀN (doc §2) — chưa dùng để chặn gói. */
  TIEU_DUNG: 15,
} as const;

/** Tiến độ của gói đang mở — để màn nói "còn thiếu gì", không phải "còn N trận". */
export interface TienDoGoi {
  tran: number;
  vong_quyet: number;
  vong_su_kien: number;
  can: { tran: number; vong_quyet: number; vong_su_kien: number };
  /** Đủ cả ba chưa. */
  day: boolean;
}

export interface GoiDay<V extends VongGoi = VongGoi> {
  goi_so: number;
  tran_ids: string[];
  vongs: V[];
  tien_do: TienDoGoi;
  ho_so: HoSoTinhCach;
}

/** Hồ sơ trả cho người chơi (D106): thẻ của gói đầy gần nhất + tiến độ + lịch sử. */
export interface HoSoGoi extends HoSoTinhCach {
  /** Gói đầy gần nhất (số thứ tự) và tổng số gói đầy. null = chưa gói nào đầy. */
  goi: { so: number; tong: number } | null;
  /** Tiến độ gói ĐANG MỞ — màn nói "còn thiếu gì". */
  tien_do: TienDoGoi;
  /** Đường đi qua các gói (ảnh chụp đã lưu, cùng công thức). */
  lich_su: { goi_so: number; tinh_cach: string; n_tran: number; computed_at: string }[];
}

/** Dòng có vào gói không — MỘT chỗ quyết (xem đầu file). */
export const vaoGoi = (v: VongGoi): boolean => v.tran_xong && !v.man_tap && !v.nghi_may;

function demTienDo(vongs: readonly VongGoi[]): TienDoGoi {
  const tran = new Set(vongs.map((v) => v.match_id)).size;
  const quyet = vongs.filter((v) => !v.tu_dong);
  const vongQuyet = quyet.length;
  const vongSuKien = quyet.filter((v) => v.o_su_kien).length;
  return {
    tran, vong_quyet: vongQuyet, vong_su_kien: vongSuKien,
    can: { tran: GOI.TRAN, vong_quyet: GOI.VONG_QUYET, vong_su_kien: GOI.VONG_SU_KIEN },
    day: tran >= GOI.TRAN && vongQuyet >= GOI.VONG_QUYET && vongSuKien >= GOI.VONG_SU_KIEN,
  };
}

/**
 * Chia dòng (đã sắp theo thời gian, gom theo trận) thành gói đầy + gói đang mở.
 * Ranh giới gói rơi ở RANH GIỚI TRẬN — không cắt một trận làm đôi.
 */
export function chiaGoi<V extends VongGoi>(vongs: readonly V[]): { day: GoiDay<V>[]; dangMo: TienDoGoi; vongDangMo: V[] } {
  const hopLe = vongs.filter(vaoGoi);
  // Gom theo trận giữ thứ tự xuất hiện.
  const theoTran = new Map<string, V[]>();
  for (const v of hopLe) {
    const a = theoTran.get(v.match_id);
    if (a) a.push(v); else theoTran.set(v.match_id, [v]);
  }
  const day: GoiDay<V>[] = [];
  let dangMo: V[] = [];
  let dangMoIds: string[] = [];
  for (const [id, ds] of theoTran) {
    dangMo = dangMo.concat(ds);
    dangMoIds.push(id);
    const td = demTienDo(dangMo);
    if (td.day) {
      day.push({
        goi_so: day.length + 1,
        tran_ids: dangMoIds,
        vongs: dangMo,
        tien_do: td,
        ho_so: dungHoSo(dangMo, dangMoIds.length),
      });
      dangMo = [];
      dangMoIds = [];
    }
  }
  return { day, dangMo: demTienDo(dangMo), vongDangMo: dangMo };
}
