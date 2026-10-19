/**
 * KHOẢNH KHẮC ĐÃ CHẠM — "HÔM NAY BẠN VỪA CHẠM" ở màn kết (founder 16/08, "vá
 * lối chơi" tầng 1). HÀM THUẦN, không đọc DB, không đọc đồng hồ.
 *
 * ─── VÌ SAO CÓ ───────────────────────────────────────────────────────────────
 * Đi thử bằng mắt người được bạn rủ, chưa có kiến thức nền: chơi xong một trận
 * họ mang ra khỏi bàn được gì? Bảng xếp hạng + một con số NAV. Không một CÁI
 * TÊN nào để kể lại cho người rủ ("hôm nay tao dính TIN GIẢ") — mà cái tên là
 * thứ duy nhất người ta nhớ và lan truyền. Chuỗi VÌ SAO có đủ mọi khái niệm
 * (D26/R1: hiện vô điều kiện mỗi vòng) nhưng nó chảy qua từng vòng và không
 * ai gom lại; đến màn kết thì đã trôi. Khối này GOM: nhặt trong dây chuyền của
 * CHÍNH người chơi những mắt xích mang tên một khái niệm tài chính thật, xếp
 * theo độ đau/độ sướng, trả về tối đa ba cái TÊN.
 *
 * ─── BA RÀNG BUỘC, VÀ CHÚNG LÀ LUẬT KHÔNG PHẢI GU ─────────────────────────
 * 1. HỒI CỐ TUYỆT ĐỐI. Chỉ nói thứ ĐÃ XẢY RA với chính bạn (mắt xích có thật
 *    trong `hd_chot_phien` của bạn). Không đoán, không suy từ bàn người khác.
 *    A3.1: nói về chính mình.
 * 2. MÔ TẢ, KHÔNG KÊ ĐƠN (A10). Server chỉ trả ID + vòng + con số. Câu chữ ở
 *    client (`web/src/lib/khoanh_khac.ts`) và có test cấm mọi động từ khuyên
 *    bảo ("nên/hãy/đừng/lần sau/phải"). Trò dạy bằng phản hồi, không dạy bằng
 *    lời khuyên (D67: feedback > instruction) — và một lời khuyên tài chính là
 *    thứ A10 cấm dù nó đúng.
 * 3. IM KHI KHÔNG CÓ GÌ. Không mắt xích nào đủ ⇒ mảng rỗng ⇒ client KHÔNG vẽ
 *    khối. Bịa một "khoảnh khắc" cho có là dựng đúng cái bảng-nói-sai D62 gọi
 *    tên: một bảng im người ta đi tìm, một bảng nói sai người ta tin.
 *
 * ─── DATA (A1) ─────────────────────────────────────────────────────────────
 * Không ghi thêm event nào: đầu ra là HÀM TẤT ĐỊNH của `hd_chot_phien` (bảng
 * append-only) ⇒ tính lại được bất cứ lúc nào, cho bất cứ trận nào. Câu hỏi
 * nghiên cứu nó mở ra — "được gọi tên khái niệm X ở màn kết trận N thì trận
 * N+1 hành vi quanh X có đổi không" — trả lời bằng cách chạy lại chính hàm này
 * trên lịch sử, không cần cột mới. Đúng nếp D73 (insight thuần từ events).
 */
import type { MatXich } from './engine.js';

/**
 * Tập ID sống ở `khoanh_khac_ids.ts` (không phụ thuộc engine — client import
 * được qua `@server`). Mỗi ID là MỘT khái niệm ngoài đời có tên, map vào đúng
 * một (vài) `kind` của dây chuyền. Thêm ID = thêm một khái niệm người chơi
 * mang về được — không phải thêm một dòng cho vui. Client phải có mục tự điển
 * cho mọi ID (test canh hai danh sách khớp nhau).
 */
export {
  KHOANH_KHAC_IDS, type KhoanhKhacId, type SoTayDTO, type SoTayKhaiNiem,
} from './khoanh_khac_ids.js';
import {
  KHOANH_KHAC_IDS, type KhoanhKhacId, type SoTayKhaiNiem,
} from './khoanh_khac_ids.js';

export interface KhoanhKhac {
  id: KhoanhKhacId;
  /** Vòng có cú chạm MẠNH NHẤT của khái niệm này (1-based). */
  vong: number;
  /** delta_bp của chính cú chạm đó — dấu giữ nguyên, client nhuộm win/lose. */
  delta_bp: number;
}

/** Số khoảnh khắc tối đa trả về — ba cái tên là vừa một câu kể lại. */
export const SO_KHOANH_KHAC_TOI_DA = 3;

/**
 * NGƯỠNG ĐÁNG GỌI TÊN (bp, trên |delta_bp| của cú mạnh nhất). ✅ FOUNDER CHỐT
 * 16/08 (D89) — đổi phải qua founder (A8.2).
 * Dưới ngưỡng là nhiễu — gọi tên một cú −0,1% "trượt giá" là dạy người ta rằng
 * mọi thứ đều đáng sợ như nhau, tức không dạy gì. 25bp = 0,25% NAV một vòng.
 * ⚠ KHÔNG áp cho khái niệm SỰ-KIỆN (bán khống · chặn lỗ · dây chuyền): chúng
 * đáng gọi tên vì ĐÃ XẢY RA, không vì to — cú short hoà vốn vẫn là lần đầu
 * bạn bán khống.
 */
export const NGUONG_DANG_GOI_TEN_BP = 25;
const KHONG_CAN_NGUONG: ReadonlySet<KhoanhKhacId> = new Set(['ban_khong', 'chan_lo', 'day_chuyen']);

/**
 * Một mắt xích thuộc khái niệm nào (null = không phải khoảnh khắc đáng tên —
 * `tai_san` thường, `khau_vi`, `dao_phi` mỗi lần giao dịch, thưởng lá…).
 * ⚠ THUẦN THEO `kind` + cờ đã có trên mắt xích — không suy từ số.
 */
export function khoanhKhacCuaMatXich(x: MatXich): KhoanhKhacId | null {
  switch (x.kind) {
    case 'xep_hang': return 'truot_gia';
    case 'crowding': return 'chen_chuc';
    // Chỉ dư âm bị ĐẢO (tin giả lộ) mới là "dính tin giả" — dư âm thường là
    // thị trường bình thường, không có tên riêng để mang về.
    case 'echo': return x.dao === true ? 'tin_gia' : null;
    // Chỉ dải RẤT CĂNG (2) và chiều XẤU: đó là "bong bóng vỡ" đúng nghĩa. Dải
    // 1 xảy ra thường xuyên; gọi tên nó là gọi tên thời tiết.
    case 'tai_san': return x.cang_dai === 2 && x.delta_bp < 0 ? 'suc_cang' : null;
    case 'nhan': return 'don_bay';
    case 'short': return 'ban_khong';
    // v49 (D342) — sổ khống ăn giá thật: vòng có dòng giá khống là vòng đã "chạm" bán khống.
    case 'khong_gia': return 'ban_khong';
    case 'chan_lo_san': return 'chan_lo';
    case 'day_chuyen': return 'day_chuyen';
    default: return null;
  }
}

/**
 * MỌI khoảnh khắc ĐỦ ĐIỀU KIỆN của một trận (qua ngưỡng, hoặc là khái niệm
 * sự-kiện), xếp theo |delta_bp| giảm dần. Không cắt — SỔ TAY (tầng 3) cần đủ,
 * còn màn kết cắt 3 ở `khoanhKhacCuaTran`. Một hàm lọc, hai chỗ đọc: hai bộ
 * lọc rời nhau là sổ tay ghi một khái niệm mà màn kết chưa từng gọi tên.
 *
 * @param chains `chains[i]` = dây chuyền của vòng `i+1` (thứ tự vòng). Vòng
 *   không có dòng (trận cũ thiếu event) truyền `[]` — hàm không bịa.
 */
export function tatCaKhoanhKhac(chains: readonly (readonly MatXich[])[]): KhoanhKhac[] {
  const manh = new Map<KhoanhKhacId, KhoanhKhac>();
  chains.forEach((chain, i) => {
    for (const x of chain) {
      const id = khoanhKhacCuaMatXich(x);
      if (!id) continue;
      const d = Number(x.delta_bp);
      if (!Number.isFinite(d)) continue;
      const cu = manh.get(id);
      // Cú mạnh nhất của mỗi khái niệm; hoà thì giữ cú SỚM hơn (lần đầu chạm).
      if (!cu || Math.abs(d) > Math.abs(cu.delta_bp)) {
        manh.set(id, { id, vong: i + 1, delta_bp: d });
      }
    }
  });
  return [...manh.values()]
    .filter((k) => KHONG_CAN_NGUONG.has(k.id) || Math.abs(k.delta_bp) >= NGUONG_DANG_GOI_TEN_BP)
    .sort((a, b) => Math.abs(b.delta_bp) - Math.abs(a.delta_bp)
      || KHOANH_KHAC_IDS.indexOf(a.id) - KHOANH_KHAC_IDS.indexOf(b.id));
}

/**
 * Gom dây chuyền của CHÍNH người chơi qua các vòng ⇒ tối đa 3 khoảnh khắc,
 * xếp theo |delta_bp| giảm dần (cú đau/sướng nhất lên đầu) — khối màn kết.
 */
export function khoanhKhacCuaTran(chains: readonly (readonly MatXich[])[]): KhoanhKhac[] {
  return tatCaKhoanhKhac(chains).slice(0, SO_KHOANH_KHAC_TOI_DA);
}

/**
 * SỔ TAY KHÁI NIỆM (tầng 3, 16/08) — gom qua MỌI trận đã xong của một người.
 *
 * Trả lời đúng ba câu người ta hỏi khi lật sổ: khái niệm này tôi gặp mấy
 * trận · lần đầu khi nào · cú nặng nhất là bao nhiêu. Chỉ khái niệm ĐÃ CHẠM;
 * phần "chưa chạm" client tự điền từ `KHOANH_KHAC_IDS` — đó là bản đồ những
 * gì còn tồn tại, không phải danh sách việc phải làm (A10: mô tả, không kê
 * đơn; D67: discovery > instruction).
 *
 * @param tran mỗi trận: mốc (null nếu không có) + dây chuyền theo vòng.
 *   Thứ tự mảng = thứ tự thời gian (cũ → mới) để `lan_dau` là trận SỚM NHẤT.
 */
export function soTayKhaiNiem(
  tran: readonly { luc: Date | null; chains: readonly (readonly MatXich[])[] }[],
): SoTayKhaiNiem[] {
  const so = new Map<KhoanhKhacId, SoTayKhaiNiem>();
  for (const t of tran) {
    for (const k of tatCaKhoanhKhac(t.chains)) {
      const cu = so.get(k.id);
      if (!cu) {
        so.set(k.id, {
          id: k.id, so_tran: 1,
          lan_dau: t.luc ? t.luc.toISOString() : null,
          manh_nhat: { delta_bp: k.delta_bp, vong: k.vong },
        });
        continue;
      }
      cu.so_tran += 1;
      if (Math.abs(k.delta_bp) > Math.abs(cu.manh_nhat.delta_bp)) {
        cu.manh_nhat = { delta_bp: k.delta_bp, vong: k.vong };
      }
    }
  }
  // Gặp nhiều trận nhất lên đầu; hoà thì cú nặng hơn; hoà nữa thì thứ tự bảng.
  return [...so.values()].sort((a, b) => b.so_tran - a.so_tran
    || Math.abs(b.manh_nhat.delta_bp) - Math.abs(a.manh_nhat.delta_bp)
    || KHOANH_KHAC_IDS.indexOf(a.id) - KHOANH_KHAC_IDS.indexOf(b.id));
}
