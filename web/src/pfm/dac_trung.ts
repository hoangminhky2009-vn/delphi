/**
 * PFM — ĐẶC TRƯNG: đóng gói số của gương theo SỔ ĐĂNG KÝ (nhóm J — "invisible product
 * layer"). Đây là thứ DUY NHẤT của vùng sổ được phép rời máy sau consent (K14 · P2 🔒).
 *
 * ⚠⚠ FILE NÀY **KHÔNG TÍNH GÌ CẢ — CHỈ ĐÓNG GÓI.** Mọi con số đến từ `guong/` hoặc từ
 * `hu.nhanNguNghia()`. Tính lại ở đây là dựng bản thứ hai của cùng công thức (D61), và
 * cú trôi biểu hiện là *"màn hình gương nói 42%, hồ sơ cohort nói 38%"* cho cùng một
 * tháng — không ai biết bên nào đúng, và bên sai thì đã nằm trong dataset bán được.
 *
 * ⚠⚠ RANH VỚI SERVER, viết thành luật vì nó dễ bị vượt qua "cho tiện": **client chỉ phát
 * thứ CHỈ CLIENT BIẾT** (suy từ sổ thô — mà server không bao giờ thấy sổ thô). Thứ server
 * đã cầm trong tay (số ngày có mặt, có ghi, khai-0, tiêu-ít — `pfm_ngay`) thì SERVER tự
 * đếm. Client phát thêm là gửi một con số server có thể tự kiểm, và ngày hai bên lệch thì
 * không có trọng tài. Có bài canh danh sách này không giao nhau.
 *
 * ⚠ CỬA MỘT CHIỀU: thứ đã đổ lên server thì đã đổ. Nên mọi giá trị ở đây đi qua
 * `kiemGiaTri` của chính sổ đăng ký TRƯỚC KHI rời hàm — chặn ở đây thì lỗi có địa chỉ;
 * chặn ở cửa server thì lỗi nổ sau khi đã tính cả kỳ, với thông điệp không ai lần ngược
 * được về chỗ sinh ra nó.
 */
import { SCHEMA_VERSION, kiemGiaTri, laMaHopLe, type MaDacTrung } from '@config/pfm_dac_trung';
import { type Hu, nhanNguNghia } from './hu.js';
import { type Khoan, congSo } from './so.js';
import { guongKy, soVoiMoc } from './guong.js';
import { type Luat, tyLeGiuLuat } from './luat.js';
import { ctxCuaHoSo, type HoSo } from './ho_so.js';

export class LoiDacTrung extends Error {}

/** Một dòng đặc trưng sẵn sàng gửi. `doiTuong` chỉ có với mã khai `theo_doi_tuong`. */
export interface DongDacTrung {
  ma: MaDacTrung;
  giaTri: unknown;
  doiTuong?: string;
}

export interface GoiDacTrung {
  /** Kỳ đóng gói — `'YYYY-MM'`. Đặc trưng luôn thuộc về MỘT kỳ, không bao giờ "tới nay". */
  ky: string;
  schemaVersion: number;
  dong: DongDacTrung[];
}

/**
 * ⚠ MÃ THUỘC VỀ SERVER — client KHÔNG BAO GIỜ phát. Xem ranh giới ở đầu file.
 * Danh sách này tồn tại để bài test đối chiếu được; nó là một PHÁT BIỂU, không phải một
 * bộ lọc phòng hờ.
 */
export const MA_CUA_SERVER = [
  'hv_ngay_co_mat', 'hv_ngay_co_ghi', 'hv_khai_0', 'hv_tieu_it',
  // D324 — năm mã GAME: server tính từ `hanh_vi_vong`, ghép dưới cửa noi_game.
  'gm_n_tran', 'gm_tk_giu', 'gm_tk_huy', 'gm_brier_tb', 'gm_phoi_nhiem',
] as const satisfies readonly MaDacTrung[];

/**
 * Làm tròn 3 chữ số — đúng như sổ đăng ký dặn cho `ty_le`.
 * ⚠ Không chỉ cho gọn: bớt độ chính xác là bớt bề mặt vân tay. Một tỷ lệ 17 chữ số thập
 * phân gần như định danh được một người trong nhóm, mà cả kiến trúc cohort dựng ra để
 * điều đó không xảy ra.
 */
export function lamTron3(x: number): number {
  return Math.round(x * 1000) / 1000;
}

function them(ds: DongDacTrung[], ma: MaDacTrung, gt: unknown, doiTuong?: string): void {
  /*
   * ⚠ `null`/`undefined` ⇒ KHÔNG PHÁT DÒNG NÀO. "Chưa đủ mẫu" phải vắng mặt, không được
   * hoá thành 0 (P7/D62): một kỳ thiếu dữ liệu mà gửi 0 sẽ được đọc như một kỳ đo được
   * kết quả bằng 0, và nó kéo mọi trung bình cohort xuống mà không ai thấy.
   */
  if (gt === null || gt === undefined) return;
  /*
   * ⚠ LÀM TRÒN CẢ PHÂN BỐ, KHÔNG CHỈ SỐ ĐƠN (R11). Trước đây chỉ `typeof gt ===
   * 'number'` được làm tròn, mà `phan_bo` là một OBJECT — nên chỉ chỗ nào tự gọi
   * `lamTron3` ở call site mới tròn (`huongSuaMuc`), còn chỗ nào quên thì gửi
   * nguyên `0.30000000000000004` lên server.
   * ⇒ Làm tròn ở ĐÂY là một nguồn: mọi phân bố đi qua cửa này đều tròn, không
   * phụ thuộc người gọi có nhớ hay không. Làm tròn hai lần vô hại (luỹ đẳng).
   */
  const gtCuoi = typeof gt === 'number'
    ? lamTron3(gt)
    : (gt !== null && typeof gt === 'object' && !Array.isArray(gt)
        ? Object.fromEntries(
            Object.entries(gt as Record<string, unknown>)
              .map(([k, v]) => [k, typeof v === 'number' ? lamTron3(v) : v]),
          )
        : gt);
  const loi = kiemGiaTri(ma, gtCuoi);
  if (loi !== null) throw new LoiDacTrung(loi);
  ds.push(doiTuong === undefined ? { ma, giaTri: gtCuoi } : { ma, giaTri: gtCuoi, doiTuong });
}

/* ═══ ĐÓNG GÓI MỘT KỲ ═════════════════════════════════════════════════════════ */

export interface DauVaoGoi {
  ky: string;
  /** Sổ CỦA KỲ NÀY (người gọi đã lọc theo tháng qua `kho`). */
  so: readonly Khoan[];
  /** Sổ kỳ TRƯỚC — chỉ dùng cho trục so-với-chính-mình (E3). Vắng ⇒ bỏ trục đó. */
  soKyTruoc?: readonly Khoan[];
  /**
   * ⚠ D325: hũ ĐÃ DỰNG LẠI TẠI KỲ (`goi_ky.ts` §`huTrongKy`) — trạng thái cuối kỳ, lịch sử
   * trong kỳ, nấc quyết toán chỉ khi chốt trong kỳ. Đưa hũ hôm nay vào gói một kỳ cũ là
   * dán chuyện của tháng sau vào tháng trước.
   */
  hu: readonly Hu[];
  /** Luật nếu-thì (GĐ6). Vắng ⇒ coi như chưa có luật nào — không phát `kq_giu_luat`. */
  luat?: readonly Luat[];
  /**
   * Hồ sơ hoàn cảnh user TỰ KHAI (G1). Vắng, hoặc câu nào chưa trả lời ⇒ **không phát
   * dòng `ctx_*` nào cho câu đó** — xem `ctxCuaHoSo`.
   */
  hoSo?: HoSo;
}

/**
 * ⚠ Nhãn hũ phát THEO ĐỐI TƯỢNG (`doiTuong = id hũ`) chứ không gộp — vì câu hỏi nghiên
 * cứu là *"nhóm có mục tiêu giáo dục hoàn thành cao hơn nhóm du lịch không"*, và gộp
 * trước khi gửi là tự tay xoá đúng phép nối Intent → Outcome mà cả sổ đăng ký dựng ra để
 * phục vụ. ID hũ do máy sinh, không mang tên user đặt (tên ở lại máy — `hu.ts`).
 */
export function dongGoiKy(v: DauVaoGoi): GoiDacTrung {
  const dong: DongDacTrung[] = [];
  const g = guongKy(v.so);

  /*
   * ── CONTEXT: ba câu tự khai (G1) ──
   * ⚠⚠ BA MÃ NÀY NẰM TRONG SỔ ĐĂNG KÝ TỪ ĐẦU MÀ CHƯA TỪNG CÓ AI PHÁT — sổ khai một trục
   * nghiên cứu, viết rõ "vì sao" cho từng mã, rồi trục ấy rỗng ở mọi kỳ. Chúng phải đi
   * ĐẦU gói: mọi chỉ số phía dưới chỉ có nghĩa khi đọc cùng chúng ("chi 2tr/tháng" của
   * người phụ thuộc và của người tự trả tiền nhà là hai hành vi khác hẳn nhau).
   */
  for (const c of ctxCuaHoSo(v.hoSo ?? {})) them(dong, c.ma, c.giaTri);

  /* ── BEHAVIOR: số của gương, KHÔNG tính lại ── */
  them(dong, 'hv_chi_bu', g.chi_bu.gt);
  them(dong, 'hv_tien_ve_tieu', g.tien_ve_tieu.gt);
  them(dong, 'hv_tiet_kiem_rong', g.tiet_kiem_rong.gt);
  them(dong, 'hv_vi_sale', g.vi_sale.gt);
  them(dong, 'hv_cach_ghi', g.cach_ghi.gt);

  if (v.soKyTruoc !== undefined) {
    them(dong, 'hv_so_voi_ky_truoc',
      soVoiMoc(congSo(v.so).chi, congSo(v.soKyTruoc).chi).gt);
  }

  /* ── OUTCOME luật (GĐ6): GỘP cả kỳ, không theo_doi_tuong — xem tyLeGiuLuat ── */
  them(dong, 'kq_giu_luat', tyLeGiuLuat(v.luat ?? []));

  /* ── INTENT + OUTCOME theo TỪNG HŨ ── */
  for (const h of v.hu) {
    const n = nhanNguNghia(h);
    them(dong, 'y_loai', n.y_loai, h.id);
    them(dong, 'y_han', n.y_han, h.id);
    them(dong, 'y_uu_tien', n.y_uu_tien, h.id);
    them(dong, 'y_thiet_yeu', n.y_thiet_yeu, h.id);
    them(dong, 'hv_sua_muc_tieu', huongSuaMuc(h), h.id);
    them(dong, 'hv_tam_dung_hu', demTamDung(h), h.id);
    them(dong, 'kq_bo_giua_chung', ketCuc(h), h.id);
    /*
     * ⚠ HŨ CHƯA QUYẾT TOÁN THÌ KHÔNG CÓ DÒNG NÀO — không phải một nấc mặc định.
     * `kq_dat_muc_tieu` là câu trả lời của NGƯỜI DÙNG; suy nó ra từ phần trăm đã góp là
     * app tự bịa một outcome (P7/D62). Hũ đang chạy chưa có câu trả lời nào để mà
     * thiếu — nó chỉ chưa tới lúc hỏi. Mẫu số của "tỷ lệ đạt mục tiêu" phải là số hũ ĐÃ
     * CHỐT, và cách duy nhất giữ mẫu số ấy đúng là vắng mặt thì vắng hẳn.
     *
     * ⚠⚠ KHÔNG có `if` ở đây, VÀ ĐÓ LÀ CÓ CHỦ Ý: `them()` đã bỏ qua `null`/`undefined` ở
     * ngay cửa nó (một nguồn — A11.5). Bản đầu của tôi thêm một `if` nữa "cho chắc"; nó
     * thừa, và cái giá là bài test canh nó KHÔNG THỂ đỏ — tiêm lỗi vào đúng chốt ấy bắt
     * được **0 bài**, vì chốt thật nằm ở `them()`. Hai chốt chồng nhau thì không chốt nào
     * chứng minh được mình đang giữ gì.
     * ⚠ `undefined` (hũ ghi vào kho TRƯỚC lượt có trường này) đi cùng đường với `null` —
     *   `them()` bắt cả hai; ca ấy có bài canh riêng ở `pfm_dac_trung.test.ts` §VII.
     */
    /*
     * D325 — HAI NGUỒN, MỘT DÒNG. Hũ quyết toán TRONG kỳ mang nấc quyết toán; hũ còn mở mà
     * người dùng đã trả lời thẻ CUỐI KỲ mang nấc của kỳ (`ketQuaKy[ky]`). `??` giữ khoá
     * (mã, hũ) không bao giờ phát đôi — quyết toán thắng vì nó là câu trả lời cuối.
     * ⚠ `h.ketQua` ở đây phải là nấc CỦA KỲ, không phải nấc hôm nay: người gọi đưa hũ đã
     * dựng lại tại kỳ (`goi_ky.ts` §`huTrongKy`) — xem `DauVaoGoi.hu`.
     */
    them(dong, 'kq_dat_muc_tieu', h.ketQua ?? h.ketQuaKy?.[v.ky], h.id);
  }

  /*
   * ── OUTCOME luật THEO TỪNG LUẬT (D325) ── chỉ câu người dùng đã trả lời cho ĐÚNG kỳ này.
   * Chưa trả lời ⇒ `them()` bỏ `undefined`, không có dòng nào (không phải `chua_ro`).
   */
  for (const l of v.luat ?? []) them(dong, 'kq_rule_hieu_qua', l.hieuQuaKy?.[v.ky], l.id);

  return { ky: v.ky, schemaVersion: SCHEMA_VERSION, dong };
}

/* ═══ SUY TỪ LỊCH SỬ HŨ — chỉ HƯỚNG và ĐẾM, không bao giờ SỐ TIỀN ═════════════ */

/** Phân bố hướng sửa mức. Chưa sửa lần nào ⇒ `{khong: 1}`, một phát biểu thật. */
export function huongSuaMuc(h: Hu): { tang: number; giam: number; khong: number } {
  const tang = h.lichSu.filter((d) => d.ma === 'sua_muc_tang').length;
  const giam = h.lichSu.filter((d) => d.ma === 'sua_muc_giam').length;
  const tong = tang + giam;
  return tong === 0
    ? { tang: 0, giam: 0, khong: 1 }
    : { tang: lamTron3(tang / tong), giam: lamTron3(giam / tong), khong: 0 };
}

/** Số lần TẠM DỪNG (không tính bỏ hẳn) — quỹ đạo phục hồi, C8. */
export function demTamDung(h: Hu): number {
  return h.lichSu.filter((d) => d.ma === 'tam_dung').length;
}

/**
 * ⭐ KẾT CỤC — và `bo` là giá trị đắt nhất của cả sổ đăng ký (file 07 §2.1 xếp
 * abandonment là outcome hạng nhất): thiếu nó thì *goal completion rate* tính SAI THEO
 * HƯỚNG ĐẸP LÊN, vì người bỏ cuộc biến mất khỏi mẫu số. Và đó là loại lỗi KHÔNG SỬA ĐƯỢC
 * SAU: mùa đầu không phân biệt thì dữ liệu đã thu vĩnh viễn không tách được hai nhóm.
 */
export function ketCuc(h: Hu): 'bo' | 'con_theo' | 'xong' {
  if (h.trangThai === 'xong') return 'xong';
  if (h.trangThai === 'bo_do') return 'bo';
  return 'con_theo';   // đang chạy HOẶC tạm dừng — tạm dừng chưa phải là bỏ (C8)
}

/* ═══ CỬA KIỂM CUỐI ═══════════════════════════════════════════════════════════ */

/**
 * Soi lại một gói trước khi gửi. Người gọi (`dong_bo/`) chạy cái này; nó cố ý KHÔNG sửa
 * gì — chỉ nói gói có hợp lệ không.
 *
 * ⚠ Kiểm LẦN HAI ở đây không thừa: `dongGoiKy` là đường sinh gói HÔM NAY, nhưng một gói
 * có thể nằm trong hàng đợi qua vài phiên bản app, và `SCHEMA_VERSION` đổi thì miền đổi
 * theo. Gửi một gói dựng bằng danh mục cũ là làm bẩn dataset bằng thứ trông vẫn hợp lệ.
 */
export function soiGoi(goi: GoiDacTrung): string[] {
  const loi: string[] = [];
  if (goi.schemaVersion !== SCHEMA_VERSION) {
    loi.push(`Gói dựng bằng danh mục v${goi.schemaVersion}, máy đang ở v${SCHEMA_VERSION}.`);
  }
  for (const d of goi.dong) {
    if (!laMaHopLe(d.ma)) { loi.push(`Mã lạ: ${d.ma}`); continue; }
    if ((MA_CUA_SERVER as readonly string[]).includes(d.ma)) {
      loi.push(`Mã "${d.ma}" là của SERVER — client không phát.`);
      continue;
    }
    const l = kiemGiaTri(d.ma, d.giaTri);
    if (l !== null) loi.push(l);
  }
  return loi;
}
