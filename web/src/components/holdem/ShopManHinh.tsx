/**
 * MÀN SHOP — trọn MỘT khung hình, không cuộn.
 *
 * Founder 20/07, nguyên văn: "Khi t ấn vào shop thì đổi sang màn hình shop với
 * ở trên là 2 mục tài sản và chiến thuật và nút roll ở mỗi mục còn ở dưới là
 * danh sách tài sản và chiến thuật của tôi (ĐẶC BIỆT LƯU Ý TẤT CẢ PHẢI Ở
 * TRONG 1 KHUNG HÌNH ĐỂ HẠN CHẾ TỐI ĐA VIỆC PHẢI THAO TÁC TAY LƯỚT)".
 *
 * Nên đây KHÔNG phải panel bung ra tại chỗ (bản cũ, và đó đúng là thứ founder
 * bảo hiểu sai ý). Nó là một lớp phủ toàn màn, chiều cao chia cứng, và mọi dải
 * đều `flex-shrink: 0` — không dải nào được phép đẩy dải khác ra khỏi màn.
 *
 * ─── VÌ SAO VẪN HIỆN CẢ HAI MỤC DÙ MỖI VÒNG CHỈ MUA ĐƯỢC MỘT ──────────────
 * Nhịp chọn bài mới (V1,2,4,5 tài sản · V3,6 chiến thuật · V7,8 không shop)
 * làm mỗi vòng chỉ MỘT mục mua được. Vẫn vẽ cả hai, mục kia làm mờ kèm chữ
 * "mở ở vòng N", vì giấu đi thì người chơi không lập được kế hoạch — mà lập
 * kế hoạch qua 8 vòng chính là trò chơi. Làm mờ ≠ giấu: thông tin vẫn hiện
 * vô điều kiện, không nằm sau thao tác nào (D26/R1).
 *
 * ─── 16/08 — TRẬN NAV LÀ MỘT BÀN CƯỢC (thiết kế 07, founder chốt "làm y nguyên") ──
 * Nhánh `nav` không còn "chạm mã → panel mốc bung ra → chạm mốc". Nay:
 *   · HÀNG CHIP dán đáy (`HangChip`): 4 chip cỡ vốn · 3 mặt MUA/RÚT/KHỐNG.
 *   · Ngữ pháp duy nhất: CẦM rồi CHẠM — cầm chip rồi chạm lá, hoặc chạm lá rồi
 *     chạm chip; hai đường ra CÙNG một lệnh `{ma, chieu, moc_bp}` (server áp,
 *     C4). Chip KHÔNG dính tay: sau lệnh thả cả chip lẫn lá.
 *   · CỌC CHIP trên lá (`CocChip`) thay kho DANH MỤC tài sản: đang giữ / đang
 *     xếp / khống / all-in — mỗi màu một nghĩa. Chạm cọc = lật sang mặt RÚT.
 *   · TAY (thay kho DANH MỤC): lá chiến thuật đang cầm; Đòn Bẩy = "cầm rồi chạm
 *     lá" để gắn/đổi đích (thay bảng GẮN/ĐỔI ĐÍCH); cọc khống đang mở + ĐÓNG.
 *   · ALL-IN lúc yên y hệt ba chip kia; bấm chip: nút bật + cột chip vàng bay
 *     lên lá (founder: "đặc biệt khi bấm, không phát sáng sẵn"). Dấu ALL-IN toàn
 *     màn + loé + rung mạnh CHỈ ở cú CAM KẾT (CHỐT / KHỚP NGAY có ALL-IN) —
 *     founder: "chỉ hiện khi bấm chốt, bấm cho vui mắt thì hiện liên tục à".
 *   · Nhãn cách nhập lệnh → telemetry `cham_nut` (`shop-chip-truoc` /
 *     `shop-la-truoc`) — câu hỏi §8.4, ngày rà trong config/telemetry.ts.
 * Trận cũ (không `nav`) chạy nguyên nhánh cũ.
 */
import { useEffect, useMemo, useRef, useState, type CSSProperties } from 'react';
import { useReducedMotion, useSoChay } from '@/lib/hooks';
import { lyDoTuChoi, xemTruocLenh, type TraitLenh, xemTruocTheoTuyChon, lyDoTuChoiTheoTuyChon } from '@/lib/xemTruocLenh';
import { themLenhMoc, type LenhMocNhap } from '@/lib/lenh_moc';
import { LOI_LENH_BIET_CHAC, LOI_LENH_BIET_CHAC_THEO_SERVER, chuLoiLenh } from '@/lib/loi_lenh';
import type { TuyChonLenhGhe } from '@server/holdem/engine';
import { hanMucKhongCon } from '@server/holdem/nav';
import { PHI_LENH_V50, PHI_LENH_V51 } from '@config/holdem';
import { NGUONG_GAP_S, NGUONG_KHAN_S } from './DongHoVong';
import { NHIP_RUNG, rung } from '@/lib/rung';
import { ghiDo } from '@/lib/telemetry';
import type { LoaiTheVong, NhanDTO, TaiSanDTO, TuDienDTO } from '@/api/holdem';
import { T_DON_HET_UPPER } from '@/lib/vocab';
import { PixelIcon } from '@/components/ui/PixelIcon';
import { GameCard } from './GameCard';
import { NHIP } from '@/lib/nhip';
import { EASING_BAY, khungBay } from '@/lib/duong_bay';
import { CocChip } from './CocChip';
import { HangChip, PhieuLenh, type LenhMoc, type MatChip } from './HangChip';
import { ICON_VAI } from './ChaoVai';
import { TheGiaiThich } from './TheGiaiThich';
import { KhayTrait } from './KhayTrait';
import { phutHat } from './TheTrait';
import gc from './GameCard.module.css';
import { LangKinh, phanBoNav } from './LangKinh';
import s from './ShopManHinh.module.css';
import { htmlTinh } from '@/lib/html_tinh';

/**
 * CHIP BAY — vật trên lưới nên `steps(6)`; chỉ transform (D68). Tạo ngoài cây
 * React (document.body) vì nó sống 300ms rồi tự huỷ, không đáng một state.
 * Không có `Element.animate` (jsdom / trình duyệt cũ) hoặc reduced-motion ⇒ im.
 */
/**
 * Sổ chip ĐANG BAY — để dọn được khi shop rời màn.
 *
 * ⚠ Chip sống NGOÀI cây React (`document.body`) nên React không dọn hộ. Không
 * có sổ này thì: đặt lệnh rồi vòng lật ngay (hoặc bấm ✕ / hết giờ tự nộp) trong
 * ~0,5s sau đó ⇒ tối đa 8 chip vàng còn bay ngang qua MÀN KẾT QUẢ VÒNG — đúng
 * khoảnh khắc D114 vừa dọn cho sạch. Không rò rỉ vĩnh viễn (node vẫn tự xoá ở
 * `onfinish`), nhưng nó là hoạt ảnh của một màn đã đóng diễn trên một màn khác.
 */
const chipDangBay = new Set<{ huy: () => void }>();

/**
 * ⭐ MÀU LÁ KHI ĐANG KHỐNG (24/08, founder: *"thẻ bài bán khống khi đặt lệnh chip
 * sẽ hiện là màu đỏ"*). Cặp `[viền, quầng]` cùng hình dạng với bảng `MAU` của lá,
 * nên nó cắm thẳng vào `--bd`/`--gl` mà không cần cơ chế nào mới.
 *
 * ⚠ Đọc từ token `--lose` (#f87171) — CÙNG màu mà cọc chip khống (`.khg`) và số
 * lỗ đang dùng. Gõ một hex đỏ khác ở đây là dựng bản sao thứ hai của cùng một
 * nghĩa, và cú trôi biểu hiện là "khung lá một đỏ, cọc chip một đỏ khác" (D61).
 */
const MAU_KHONG = ['#f87171', 'rgba(248, 113, 113, .22)'] as const;
function bayChip(
  tu: Element | null, den: Element | null, n: number,
  mau: 'cho' | 'vang' | 'lai' | 'lo', nhanh: boolean, xong?: () => void,
): void {
  if (typeof document === 'undefined' || !tu || !den
    || typeof (tu as HTMLElement).animate !== 'function'
    || window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) {
    xong?.();
    return;
  }
  const a = tu.getBoundingClientRect();
  const b = den.getBoundingClientRect();
  /*
   * 13/09 — founder: chip bay "gượng và kịch". Ba thứ sửa: (1) `steps(6)` cho một
   * cú BAY là giật cục — A11.18 dành `steps()` cho vật đổi trạng thái, còn CHUYỂN
   * ĐỘNG VẬT LÝ thì cubic-bezier (motion.module.css cùng luật); (2) vòm 46px trên
   * quãng ~150px là ném, không phải đặt — hạ còn 22; (3) ALL-IN bay cả đàn 6–8
   * viên — trần 3, số nhiều nói bằng cọc đích, không bằng đàn bay.
   */
  const soBay = Math.min(n, 3);
  let conLai = soBay;
  for (let i = 0; i < soBay; i++) {
    const c = document.createElement('span');
    c.className = `${s.bay} ${mau === 'vang' ? s.bayVang : mau === 'lai' ? s.bayLai : mau === 'lo' ? s.bayLo : ''}`;
    c.setAttribute('aria-hidden', 'true');
    const x0 = a.left + a.width / 2 - 7;
    const y0 = a.top + a.height / 2 - 2;
    const x1 = b.left + 8 + i * 3;
    const y1 = b.bottom - 8 - i * 2;
    c.style.left = `${x0}px`;
    c.style.top = `${y0}px`;
    document.body.appendChild(c);
    // D401 — dáng bay (vòm + đường cong) nay ở `lib/duong_bay.ts`, dùng chung với xu nộp GIẢI và hộp "Ăn chia cược".
    const anim = c.animate(
      khungBay({ x: 0, y: 0 }, { x: x1 - x0, y: y1 - y0 }),
      // Thời lượng chip ĐẦU đọc từ `nhip.ts` — cọc đích lấy đúng số đó làm độ trễ.
      { duration: (nhanh ? 200 : NHIP.CHIP_BAY) + i * (nhanh ? 24 : 40), easing: EASING_BAY, delay: i * (nhanh ? 18 : 30), fill: 'forwards' },
    );
    const the = {
      huy: () => { anim.cancel(); c.remove(); chipDangBay.delete(the); },
    };
    chipDangBay.add(the);
    anim.onfinish = () => {
      c.remove();
      chipDangBay.delete(the);
      if (--conLai === 0) xong?.();
    };
  }
}

/** Dọn mọi chip còn bay — gọi khi shop rời màn. */
function donChipBay(): void {
  for (const t of [...chipDangBay]) t.huy();
}

/**
 * Thời lượng hoạt ảnh ĐÓNG shop, ms — phải khớp `.phuDong` trong CSS.
 *
 * Hai chỗ giữ cùng một con số là chuyện không tránh được (JS không đọc được
 * thời lượng CSS mà không chạm DOM), nên nó có bài canh:
 * `web/tests/shop_chuyen_canh.test.tsx` đọc CSS thật và so với hằng số này —
 * lệch nhau thì shop hoặc đóng trước khi diễn xong, hoặc treo lại sau khi diễn.
 */
export const SHOP_DONG_MS = 180;

export interface TheShop {
  id: string;
  ten: string;
  en?: string;
  svg?: string;
  mau: readonly [string, string];
  sao?: number;
  nhan?: string;
}

export interface ODanhMuc {
  id: string;
  ten: string;
  mau: readonly [string, string];
  /** 1..3 — bản sao đã stack. */
  cap: number;
  loai: 'tai_san' | 'chien_thuat';
}

/*
 * 13/09 — CHIA BÀI MỘT LẦN MỖI VÒNG. `ShopManHinh` unmount khi đóng, nên bộ lá
 * "chia" lại (adTheVao so le 6×60ms) MỖI LẦN mở shop — mở 20 lần một trận là 20
 * lần chia, founder đọc là "kịch". Bài chỉ đổi khi sang vòng, nên chỉ chia khi
 * vòng đổi; cờ ở tầng module vì nó phải sống qua unmount. Sang trận mới vòng về
 * 1 ⇒ chia lại, đúng ý.
 */
let vongDaChiaBai = -1;

/** v51 (D346) — ngưỡng bậc 1 tính ra CHIP, đọc từ cùng hằng engine dùng (D61). */
const NGUONG_BAC = Math.floor(
  (PHI_LENH_V50.DO_SAU_THI_TRUONG * PHI_LENH_V51.NGUONG_BP) / 10000);

/** D432 — dấu của cái cân trait: +2 · −2 · 0 (dấu trừ U+2212 như chợ trait). */
const soDep = (n: number): string => (n > 0 ? `+${n}` : n < 0 ? `−${-n}` : '0');

/** v55 (D425) — ràng buộc lệnh từ trait (server phát) vào bản nháp: cùng số server kiểm lúc áp (C4). */
function traitLenhCua(nav: { phiCoDinhLenh?: number; tranBanCon?: number }): TraitLenh {
  return {
    ...(nav.phiCoDinhLenh !== undefined ? { phiCoDinhLenh: nav.phiCoDinhLenh } : {}),
    ...(nav.tranBanCon !== undefined ? { tranBanCon: nav.tranBanCon } : {}),
  };
}

export function ShopManHinh({
  vong, loaiVongNay, vongMoTiepTheo,
  taiSan, chienThuat, chonTS, chonCT, onChonTS, onChonCT,
  danhMuc, sucChuaTaiSan, sucChuaChienThuat, toiDaTaiSan = 1, art,
  ganVao, onGan, phamViThe, ganHienTai, doiGan, onDoiGan,
  chiPhiRoll, luotConLai, onRoll, onDong, canhBao, vohieu, daAllIn,
  tuDien, giaiDoanNhan, suKienNhan, moTaChienThuat,
  nav, onChotVong, taiSanCat, khoa, nganHang, vai, dongHo, onDocTo, tam, onTam,
  choTrait, doiLoiHet = false, chotLoi, dongLenh, buocChon, onBuocChon, canTrait, traitDangGiu, theLat,
}: {
  /**
   * 12/09 — BÁO RA NGOÀI khi tờ (!) mở/đóng. Trợ lý màn tập cần biết: bước
   * "chạm dấu (!) để đọc lá" chờ đúng cú ấy, và nó cũng là mốc telemetry sau này.
   * ⚠ Báo qua một `useEffect` theo dõi `dangGiaiThich` chứ không nhét vào ba chỗ
   * `setDangGiaiThich` rải rác — thêm một nút (!) thứ tư là quên ngay một chỗ.
   */
  onDocTo?: ((mo: boolean) => void) | undefined;
  /**
   * D321 — TẤM TRƯỢT hệ phụ đang mở (`'bank'` | null). Có thể điều khiển từ cha
   * (coach dàn cảnh) hoặc để shop tự giữ; xem `tamHT`/`doiTam` trong thân.
   */
  tam?: string | null | undefined;
  onTam?: ((t: string | null) => void) | undefined;
  vong: number;
  loaiVongNay: LoaiTheVong;
  /** Vòng gần nhất mở lại mục đang bị khoá (null = hết trận không mở nữa). */
  vongMoTiepTheo: { tai_san: number | null; chien_thuat: number | null };
  taiSan: TheShop[];
  /**
   * Catalog tài sản (id + `nhom`) — chỉ để LĂNG KÍNH biết mã nào là rủi ro /
   * phòng thủ (M3, D90). Vắng ⇒ không vẽ lăng kính; KHÔNG đoán nhóm theo tên mã.
   */
  taiSanCat?: readonly TaiSanDTO[] | undefined;
  chienThuat: TheShop[];
  /**
   * D33 — MẢNG. Đặc quyền ĐA DẠNG HOÁ cho lấy `toiDaTaiSan` lá một vòng, nên
   * trạng thái "đang chọn" không còn tả được bằng một lá.
   */
  chonTS: string[];
  chonCT: string | null;
  onChonTS: (id: string) => void;
  onChonCT: (id: string) => void;
  danhMuc: ODanhMuc[];
  /** D3 — mã mà thẻ chiến thuật đang chọn sẽ gắn vào (null = chưa chọn). */
  ganVao: string | null;
  onGan: (ma: string | null) => void;
  /** Tra thẻ có hỏi gắn không: 'tai_san' mới hỏi. Nguồn là cờ `ghim` của
   *  catalog — từ 02/08 chỉ còn Đòn Bẩy; lá chức năng không hỏi. */
  phamViThe: (id: string) => 'tai_san' | 'danh_muc';
  /** Founder 02/08 — thẻ ghim ĐANG CẦM đổi đích mỗi vòng (D40 "ghim không còn
   *  vĩnh viễn"). `ganHienTai` = bảng server; `doiGan` = đổi đang chờ chốt. */
  ganHienTai?: Record<string, string> | undefined;
  doiGan?: Record<string, string>;
  onDoiGan?: (the: string, ma: string) => void;
  sucChuaTaiSan: number;
  /**
   * D33 — số thẻ TÀI SẢN lấy được TRONG MỘT VÒNG (`ban.toi_da_tai_san_vong`).
   *
   * ⚠ SERVER CẤP, client không suy "có thẻ Đa Dạng Hoá thì 2". Trần thật nằm
   * trong `replay`, và hai công thức cho cùng một trần sẽ lệch đúng lần đầu ai
   * đó đổi tham số — biểu hiện là quầy cho chọn hai lá mà engine chỉ nhận một,
   * im lặng.
   */
  toiDaTaiSan?: number;
  sucChuaChienThuat: number;
  /** SVG artwork theo id thẻ — thứ làm danh mục nhìn ra hồn thay vì ô chữ. */
  art: Record<string, string>;
  chiPhiRoll: number;
  luotConLai: number;
  onRoll: () => void;
  onDong: () => void;
  canhBao?: { nhan: string; nhan_xung_dot: string } | null;
  vohieu?: boolean;
  daAllIn?: boolean;
  /** Nội dung nút (!) — server phát số, tờ giải thích dựng câu. */
  tuDien: TuDienDTO;
  giaiDoanNhan: NhanDTO[];
  suKienNhan: NhanDTO[];
  /** Mô tả một câu của thẻ chiến thuật (catalog đã có). */
  moTaChienThuat: (id: string) => string | undefined;
  /**
   * v10 NAV — chế độ PHÂN BỔ VỐN: bấm mã là mở panel lệnh theo MỐC thay vì
   * lấy lá. Vắng ⇒ trận cũ, quầy chạy nguyên như trước. Mốc SERVER kiểm lại
   * lúc áp; client chỉ bày đúng nấc để không ai bấm phải cú từ chối.
   */
  /** 22/08 — đồng hồ vòng hiện ngay trên shop (cùng bộ đếm với mặt đồng hồ). */
  dongHo?: { conLai: number; hetGio: boolean; tamDung: boolean };
  /**
   * v34 — VAI CỦA BẠN. Mọi chữ (tên · đặc quyền · cái giá) và mọi cờ (mandate,
   * dòng tiền, gắn đích phụ) do SERVER phát — client vẽ, không suy (C4/D61).
   * Vắng ⇒ map 8 / trận cũ: không có khối nào.
   */
  vai?: {
    id: string;
    ten: string;
    dacQuyen: string;
    caiGia: string;
    /** Mandate tổ chức (server): trần %NAV mỗi mã khi mua · cấm khống. */
    mandate?: { tran_ma_bp: number; cam_khong: boolean };
    /** Dòng tiền thô theo mã (chỉ tổ chức nhận). */
    dongTien?: Record<string, 'vang' | 'vua' | 'dong'>;
    /** Đòn Bẩy cấp 2 ⇒ được nhắm đích PHỤ (server khai). */
    ganPhuDuoc?: boolean;
    /** D435 — cầm đúng một Đòn Bẩy: CHỌN thêm lá ấy ở quầy vòng này ⇒ nhắm đích phụ được ngay (server khai). */
    ganPhuKhiMua?: boolean;
    /** Đích phụ hiện tại (server) và đích phụ đang chờ chốt ('' = bỏ). */
    ganPhuHienTai?: string | undefined;
    doiGanPhu?: string | null;
    onDoiGanPhu?: (ma: string | '') => void;
  };
  nav?: {
    tienMat: number;
    viThe: Record<string, number>;
    /**
     * D446 — bộ tham số lệnh server áp (`ban.tuy_chon_lenh`, lá lõi đang chọn đã cộng ở màn trận). Có mặt ⇒ xem trước
     * + dòng "sẽ bị từ chối" chạy bằng CHÍNH bộ này; các cờ lẻ dưới chỉ còn là đường lùi cho server chưa phát.
     */
    tuyChonLenh?: TuyChonLenhGhe;
    /** D446 — vòng này người chơi đang chọn một lá lõi (lá vào tay lúc chốt) ⇒ lỗi trần số mã / bước chip chưa chắc. */
    laVuaChon?: boolean;
    /** v17 — sổ khống + cờ đặc quyền lá Bán Khống (server cấp, không đoán). */
    viKhong?: Record<string, number>;
    coBanKhong?: boolean;
    /** v29 — trận tính PHÍ VỘI VÀNG: xem trước phải tính cùng công thức. */
    phiVoiVang?: boolean;
    /**
     * v42 (D311) — sàn cấm MỞ khống mã cơ sở. `xemTruocLenh` gọi CHÍNH
     * `giaiLenhMoc` với cờ này nên bản nháp tự từ chối đúng chỗ server từ chối.
     * ⚠ Thiếu nó là "màn cho xếp lệnh, server mới báo không được" (D67) — và nó
     * ĐÃ thiếu suốt từ D311 tới D317 dù DTO có sẵn trường.
     */
    khongTheoMa?: boolean;
    /**
     * v49 (D342) — chip KHỐNG tính trên HẠN MỨC khống còn lại (server phát). Bản nháp đi qua
     * CÙNG `giaiLenhMoc` với cờ này; hàng chip KHỐNG tắt khi hạn mức về 0.
     */
    khongTheoHanMuc?: boolean;
    /**
     * D342 — ĐỘ SÂU SỔ QUY CHIẾU của phí vội vàng = vốn khởi điểm của vai (server phát, chỉ khi
     * trận có vai). Thiếu nó thì ghế vốn ×2/×3 thấy phí báo trước theo sổ 10.000 trong khi server
     * trừ theo sổ của vai — đúng lớp lỗi "màn báo 140, bị trừ 190" (D67).
     */
    vonQuyChieu?: number;
    /**
     * D342 — lý do chuỗi lệnh của VÒNG VỪA CHỐT bị server bác (`loi_von.lenh`). Trước D342 không
     * chỗ nào vẽ nó: bốn vòng lệnh khống của founder bị bác mà màn không nói gì.
     */
    loiLenhVongTruoc?: string | null;
    /** v50 (D345) — phí lệnh nhẹ + phần còn lại của Khớp Nhanh (server phát). Bản nháp tính cùng bảng. */
    phiLenhNhe?: boolean;
    /** v51 (D346) — phí hai bậc. */
    phiLenhBac?: boolean;
    phiLenhConBp?: number;
    /** D516 — độ sâu chợ của ghế (bp) cho phí hai bậc; server phát (C4). */
    sauBp?: number;
    /** v55 (D425) — SỔ MỎNG: phí cố định mỗi lệnh (chip) · GÔNG CÙM: phần BÁN còn được vòng này (chip). Server phát (C4). */
    phiCoDinhLenh?: number;
    tranBanCon?: number;
    /** v34 — hệ số tác động giá của VAI mình (server phát). Vắng = 1. */
    tacDongGia?: number;
    /**
     * v54 (D403) — trận KHÔNG còn nước BỎ (`bo_bai_tat`) ⇒ hàng mặt có nút BÁN SẠCH thay chỗ nó (founder 24/09:
     * *"cho nó thành 1 nút bấm nhanh để dùng ở trong shop khi muốn bán sạch tài sản đi"*). Vắng ⇒ không có nút:
     * trận v53 / đề buổi đo giữ nguyên màn (thứ mới khoanh theo cờ luật, không theo "trận NAV").
     */
    banSach?: boolean;
    /** Bước mốc CỦA GHẾ NÀY: 500 khi cầm Chia Lệnh, thô khi không. */
    buocMocBp: number;
    /** v55 (D409) — mốc MUA server cho phép (xem `HangChip.mocChoPhep`). */
    mocChoPhep?: readonly number[];
    lenh: { ma: string; chieu: 'mua' | 'ban' | 'khong' | 'dong_khong'; moc_bp: number }[];
    /** Bước 5 — dải sức căng theo mã (chỉ ghế cầm Lướt Sóng nhận được). */
    sucCangDai?: Record<string, number>;
    onThem: (l: { ma: string; chieu: 'mua' | 'ban' | 'khong' | 'dong_khong'; moc_bp: number }) => void;
    onXoa: (i: number) => void;
    /** Lỗi cú khớp gần nhất — nút bấm phải có câu trả lời, không nuốt im. */
    khopLoi?: string | null;
    /**
     * Vốn khởi điểm (catalog `luat.START_VON`) — đơn vị chip của CỌC = ¼ số này.
     * Vắng ⇒ 10.000 (số hiện hành), nhưng phải TRUYỀN để đổi tham số không làm
     * cọc vẽ sai im lặng.
     */
    startVon?: number;
    /** LẶP: các lá của vòng trước (đã gửi), để xếp lại y hệt bằng một cú bấm. */
    lenhTruoc?: LenhMoc[];
  };
  /**
   * ═══════════════════════════════════════════════════════════════════════
   * CAM KẾT GIỮ (khoá tài sản) — founder 17/08, D104
   * ═══════════════════════════════════════════════════════════════════════
   *
   * Nguyên văn chỉ đạo: *"Khóa tài sản là 1 lựa chọn trong shop khi mua, ko
   * phải thêm thao tác bắt buộc. Và chọn xong thì cũng phải cho UI-UX hiển thị
   * rõ rằng mã đó sẽ không được đụng tới trong time cam kết khóa."*
   *
   * ⚠ CƠ CHẾ NÀY ĐÃ CÓ ĐỦ TỪ 27/07 VÀ CHƯA AI DÙNG ĐƯỢC MỘT LẦN NÀO: engine
   * (`apKhoaTaiSan`), config (`KHOA_TAI_SAN`), DTO (`khoa_duoc`, `khoa`), đường
   * nộp (`NopVongBody.khoa`) — tất cả đã chạy. Thứ duy nhất thiếu là ĐƯỜNG BẤM:
   * panel `QuanTriVon` bị `hienQuanTriVon` đòi `b.nav === undefined`, mà từ v10
   * mọi trận đều là NAV. Đo prod: **0/167 trận** từng có khoá trong action_log.
   * Đây là "cơ chế trang trí" ở dạng ngược — nó CHẠY, chỉ không ai tìm ra nút.
   *
   * Nên nó về SHOP, cạnh đúng cú mua, chứ không dựng lại panel cũ.
   */
  khoa?: {
    /** Có được bật khoá ở vòng này không (server suy — C4, đừng tính lại). */
    duoc: boolean;
    /** Chu kỳ ĐANG chạy: mã nào, còn mấy vòng. Null = chưa khoá gì. */
    dangChay: { ma: string; con_vong: number; la_vong_chot: boolean } | null;
    /** Mã người chơi vừa chọn cam kết ở vòng NÀY (chưa nộp). */
    chon: string | null;
    onChon: (ma: string | null) => void;
    /** Số vòng của một chu kỳ (catalog — không gõ 2). */
    soVong: number;
  };
  /**
   * ═══════════════════════════════════════════════════════════════════════
   * NGÂN HÀNG — SỔ TIẾT KIỆM (v43, D314/D317)
   * ═══════════════════════════════════════════════════════════════════════
   *
   * ⚠⚠ VÌ SAO NÓ Ở ĐÂY chứ không phải panel `QuanTriVon`: panel ấy bị
   * `hienQuanTriVon` đòi `b.nav === undefined`, mà từ v10 MỌI trận đều là NAV —
   * tức nó không bao giờ hiện. Đó đúng là cách CAM KẾT GIỮ đã nằm chết ba tuần
   * ngay trên (0/167 trận prod). Đặt cơ chế mới vào cùng cái panel ấy là lặp lại
   * y nguyên một lỗi đã đo được, nên nó về SHOP — đúng khe CAM KẾT GIỮ, mà v43
   * khai tử cơ chế đó nên hai thứ không bao giờ tranh chỗ.
   *
   * `vung` là JSX dựng sẵn ở màn nộp vòng (`AlphaDraftMatch`) — shop chỉ đặt chỗ.
   * Sở hữu state phải là màn nộp vòng: lệnh đi kèm `POST /rounds`, để state ở đây
   * thì shop phải tự bắn POST, tức thêm một dòng `action_log` (nguồn dựng lại trận).
   */
  nganHang?: React.ReactNode;
  /**
   * v55 (D409 → D430 → D432) — CHỢ TRAIT ở vòng mốc: node cha dựng (state ở màn nộp vòng vì đi kèm `POST /rounds`).
   * D430 đặt nó vào chỗ hàng lõi của shop; D432 đưa nó lên MÀN CHỌN riêng (xem `buocChon`). Vòng mốc không bao giờ là vòng
   * lõi (D428 + bài canh `lua_trait`), nên hai lượt chọn không tranh một màn. Vắng = không phải vòng mốc.
   */
  choTrait?: React.ReactNode;
  /** D526 — vòng này đã dùng hết lượt đổi lõi (nhịp xen kẽ: một lần — DTO `doi_loi_toi_da`). */
  doiLoiHet?: boolean;
  /**
   * ⭐ D432 — BƯỚC của vòng có lượt chọn: `'chon'` = MÀN CHỌN (lõi / chợ trait) · `'ban'` = BÀN CƯỢC. Cha giữ để bước sống
   * qua đóng/mở shop (cùng nếp `tam`); vắng ⇒ shop tự giữ, mở vào màn chọn. Xem khối D432 trong thân.
   */
  buocChon?: 'chon' | 'ban' | undefined;
  onBuocChon?: ((b: 'chon' | 'ban') => void) | undefined;
  /** D432 — cái cân của phần trait đang lấy (cha tính bằng `tongDiemChon`): nút chính màn chọn + nút ◆ quay lại đọc nó. */
  canTrait?: { can: number; soChon: number } | undefined;
  /**
   * D432 — trait ĐANG HIỆU LỰC của ghế (server `ban.trait`, đã gồm cặp của vai). Founder 27/09: *"Phần trống ra từ chỗ bỏ
   * đi trong shop thì hiện lõi đang nắm và trait đang giữ"* — hàng TAY của bàn cược in chúng cạnh lõi, chạm để đọc. Trait
   * như GÔNG CÙM (trần bán) · SỔ MỎNG (phí cố định) đổi ngay giá của lệnh đang xếp, nên chỗ của chúng là cạnh hàng chip.
   * Vắng / rỗng = trận không trait.
   */
  traitDangGiu?: readonly string[] | undefined;
  /**
   * D569 (founder 10/10: *"thu bớt diện tích để nơi hiển thị lõi/trait đang nắm và trạng thái danh mục, thẻ sự kiện đang
   * lật hiện tại"*) — lá VỪA LẬT (mặt lá của bản đồ: art + tên + màu họ) và ô SẮP LẬT (cùng chữ bản đồ: KỲ HỌP · TIN ·
   * PHA · ?). Màn trận dựng từ đúng dữ liệu bản đồ đang vẽ — shop không suy lại. Vắng = trận không bản đồ.
   */
  theLat?: {
    vua?: { svg: string; ten: string; mau?: string } | undefined;
    sap?: { so: number; glyph: string; nhan: string } | undefined;
  } | undefined;
  /**
   * v55 (D422) — ĐI SAU: cả bàn đang mua (+) / bán (−) từng mã ở vòng này, mức −3…+3 (server tính trước từ lệnh bot —
   * C4). Vẽ thành mũi tên trên lá tài sản, không số. Vắng = không mang lá.
   */
  dongLenh?: Readonly<Record<string, number>> | undefined;
  /** v55 (D409) — CHỐT LỜI TRONG Ô (Lướt Sóng mới): node cha dựng, đặt inline trên hàng chip. Vắng = không cầm lá/không cổng. */
  chotLoi?: React.ReactNode;
  /**
   * Founder 01/08: "đa số thao tác phải trong shop, kể cả cam kết danh mục" —
   * chốt vòng ngay tại đây, không phải đóng shop rồi đi tìm nút ở thanh cuối.
   */
  /**
   * Trả `false` = màn nộp vòng TỪ CHỐI cú chốt (D430: phần trait đã lấy lệch cân) ⇒ shop nhả khoá chốt và đứng yên, để
   * người chơi sửa ngay tại chợ. Trước D430 khoá (`khoaCoc`) không bao giờ nhả: shop thường đóng sau cú chốt nên không ai
   * thấy, nhưng cú chốt bị chặn để lại nút CHỐT chết và sáu lá tài sản mang lớp khoá.
   */
  onChotVong?: () => boolean | void;
}) {
  /** Lá đang mở tờ giải thích — null là đóng. */
  const [dangGiaiThich, setDangGiaiThich] = useState<string | null>(null);
  // Chốt lúc mount: render sau vẫn cùng câu trả lời, hoạt ảnh không chạy lại giữa chừng.
  const chiaBai = useRef(vong !== vongDaChiaBai).current;
  useEffect(() => { vongDaChiaBai = vong; }, [vong]);
  /*
   * D321 — tấm trượt: cha truyền `tam` thì cha là nguồn (coach cần dàn cảnh);
   * không truyền thì shop tự giữ (test/người gọi cũ). Một nguồn tại một thời điểm.
   */
  const [tamNoi, setTamNoi] = useState<string | null>(null);
  const tamHT = tam !== undefined ? tam : tamNoi;
  const doiTam = (t: string | null) => { setTamNoi(t); onTam?.(t); };
  // 12/09 — báo ra ngoài ở MỘT chỗ (xem prop `onDocTo`): mọi nút (!) đều đi qua
  // `dangGiaiThich`, nên theo dõi nó là không bao giờ sót một nút nào.
  const docToRef = useRef(onDocTo);
  docToRef.current = onDocTo;
  useEffect(() => { docToRef.current?.(dangGiaiThich !== null); }, [dangGiaiThich]);

  /* ── BÀN CƯỢC (nav) — trạng thái "trên tay" ───────────────────────────────
   * `mat`: mặt của hàng chip. `chipCam`: mốc đang cầm. `ganCam`: lá ghim (Đòn
   * Bẩy) đang cầm để chạm lá gắn — là `chonCT` (vừa chọn) hoặc id lá trong tay.
   * Lá đang cầm = `chonTS[0]` (state của cha, để coach `shopChonMa` đọc được).
   * `allNhip` tăng mỗi cú ALL-IN ⇒ chạy lại hoạt ảnh. `thongBao` = một dòng
   * nhắn nổi (rút sạch · đòn bẩy nhắm vào… · lỗi tay).
   */
  const [mat, setMat] = useState<MatChip>('mua');
  const [chipCam, setChipCam] = useState<number | null>(null);
  /*
   * Chi tiết VAI — mặc định ĐÓNG (founder 23/08: chỉ chú thích khi người chơi
   * chủ động đọc). Không nhớ qua vòng: mở ra là để đọc lại một lần, không phải
   * một tuỳ chọn hiển thị.
   */
  const [moVai, setMoVai] = useState(false);
  /* Hướng dẫn dùng lá trên tay — cùng luật: đóng mặc định, mở khi CHỦ ĐỘNG bấm. */
  const [moTayChu, setMoTayChu] = useState(false);
  const [ganCam, setGanCam] = useState<string | null>(null);
  const [allNhip, setAllNhip] = useState(0);
  const [thongBao, setThongBao] = useState<{ chu: string; n: number } | null>(null);
  const [khoaCoc, setKhoaCoc] = useState(false);
  const laCam = chonTS.length === 1 ? chonTS[0]! : null;
  const donViChip = Math.max(1, Math.floor((nav?.startVon ?? 10000) / 4));

  const baoNhanh = (chu: string) => setThongBao((t) => ({ chu, n: (t?.n ?? 0) + 1 }));
  useEffect(() => {
    if (!thongBao) return undefined;
    const t = window.setTimeout(() => setThongBao(null), 1000);
    return () => window.clearTimeout(t);
  }, [thongBao]);
  /*
   * ⚠⚠ CÚ RUNG SHOP ĐÃ GỠ (24/08, founder: *"hiệu ứng lúc đi vốn bị khựng rung 1
   * nhịp lỗi làm màn hình bị chuyển khung và ko nhìn rõ chip chuyển lên bàn"*).
   *
   * Hai cái sai chồng nhau, và cái thứ hai mới là cái đắt:
   *   (1) nó rung CHÍNH `.phu` — `position: fixed; inset: 0` — nên thứ dịch đi là
   *       CẢ KHUNG MÀN, không phải cái nút vừa bấm. Đúng vế founder đã bác ở D113
   *       khi gỡ rung-cả-bàn của ALL-IN; cú rung này sống sót chỉ vì nó treo ở một
   *       cò khác, không phải vì nó được xét lại và giữ.
   *   (2) `bayChip` chụp `getBoundingClientRect()` NGAY sau khi cú rung khởi hành,
   *       nên đàn chip bay theo một đường tính từ một hệ quy chiếu ĐANG RUNG, rồi
   *       nền tiếp tục rung dưới chúng suốt 120ms. Chip bay LÀ phản hồi của việc
   *       đi vốn; rung cái nền phía sau là che đúng hoạt ảnh mang nghĩa.
   *
   * ⚠ BÀI HỌC, không phải lời xin lỗi: D122 tôi SỬA CHO CÚ RUNG CHẠY ĐƯỢC (nó chết
   * vì React bail-out) mà không hỏi nó có nên tồn tại không. Làm một cơ chế chết
   * sống dậy KHÁC với làm nó đúng — và một cơ chế sai thì chạy được xong mới lộ ra
   * là sai. Phản hồi của cú đặt chip nay do đúng ba thứ mang: nút chip lún xuống,
   * đàn chip bay lên lá, và cọc chip mọc thêm trên lá.
   */
  /*
   * Rời màn ⇒ huỷ mọi chip còn đang bay. Chúng là node trên `document.body`,
   * sống NGOÀI vòng đời React, nên không dọn tay thì chúng diễn nốt trên màn
   * kế tiếp — đàn chip bay ngang một màn kết trận.
   */
  useEffect(() => () => { donChipBay(); }, []);

  /* Vòng đổi ⇒ tay trống, mặt về MUA. Không thì chip cầm dở từ vòng trước còn
     nằm trên tay khi bàn đã sang vòng mới. */
  useEffect(() => { setChipCam(null); setGanCam(null); setMat('mua'); }, [vong]);

  /*
   * §7.4 — XEM TRƯỚC. `useMemo` vì nó chạy lại mỗi lần bấm một mốc, và nó gọi
   * đúng lõi giải lệnh của server (không rẻ, nhưng cũng không đắt tới mức phải
   * hoãn). Trả null ⇒ khối không render, xem chú thích trong `xemTruocLenh`.
   */
  const mandateXT = vai?.mandate
    ? { tranMaBp: vai.mandate.tran_ma_bp, camKhong: vai.mandate.cam_khong } : undefined;
  const xemTruoc = useMemo(
    () => (nav && nav.tuyChonLenh
      ? xemTruocTheoTuyChon({ tienMat: nav.tienMat, viThe: nav.viThe, viKhong: nav.viKhong }, nav.lenh, nav.tuyChonLenh)
      : nav
      ? xemTruocLenh(
        { tienMat: nav.tienMat, viThe: nav.viThe, viKhong: nav.viKhong },
        nav.lenh, nav.buocMocBp, nav.coBanKhong === true,
        nav.phiVoiVang === true,
        nav.tacDongGia ?? 1,
        mandateXT,
        // D342 — hai cờ này từng không tới được bản nháp (`khongTheoMa` thiếu từ D311).
        nav.khongTheoMa === true,
        nav.khongTheoHanMuc === true,
        nav.vonQuyChieu,
        { phiLenhNhe: nav.phiLenhNhe === true, phiLenhBac: nav.phiLenhBac === true, ...(nav.phiLenhConBp !== undefined ? { phiLenhConBp: nav.phiLenhConBp } : {}), ...(nav.sauBp !== undefined ? { sauBp: nav.sauBp } : {}) },
        traitLenhCua(nav),
      )
      : null),
    // eslint-disable-next-line react-hooks/exhaustive-deps -- mandate là hằng theo vai của trận
    [nav, vai?.mandate?.tran_ma_bp, vai?.mandate?.cam_khong],
  );
  /**
   * D533 — lý do server sẽ bác CẢ chuỗi `lenh` (đúng lõi giải lệnh của server) — MỘT chỗ cho ba nơi hỏi: dòng MANDATE · dòng chuỗi hỏng · kiểm
   * TRƯỚC khi xếp lệnh mới (`datLenh`). Trước D533 lời gọi dài này chép nguyên ở hai chỗ.
   */
  const lyDoCuaChuoi = (lenh: readonly LenhMocNhap[]) => {
    if (!nav) return null;
    return nav.tuyChonLenh
      ? lyDoTuChoiTheoTuyChon({ tienMat: nav.tienMat, viThe: nav.viThe, viKhong: nav.viKhong }, lenh, nav.tuyChonLenh)
      : lyDoTuChoi(
      { tienMat: nav.tienMat, viThe: nav.viThe, viKhong: nav.viKhong },
      lenh, nav.buocMocBp, nav.coBanKhong === true, nav.phiVoiVang === true,
      nav.tacDongGia ?? 1, mandateXT, nav.khongTheoMa === true,
      nav.khongTheoHanMuc === true, nav.vonQuyChieu,
      { phiLenhNhe: nav.phiLenhNhe === true, phiLenhBac: nav.phiLenhBac === true, ...(nav.phiLenhConBp !== undefined ? { phiLenhConBp: nav.phiLenhConBp } : {}), ...(nav.sauBp !== undefined ? { sauBp: nav.sauBp } : {}) },
      traitLenhCua(nav),
    );
  };
  /** D533 — lỗi chuỗi client BIẾT CHẮC (hai lỗi mandate + bộ `LOI_LENH_BIET_CHAC*`) — lỗi có thể giả thì im, như cũ. */
  const loiBietChac = (ld: string | null): string | null => {
    if (!ld || !nav) return null;
    if (ld === 'mandate_ma' || ld === 'mandate_khong') return ld;
    return (nav.tuyChonLenh && !nav.laVuaChon ? LOI_LENH_BIET_CHAC_THEO_SERVER : LOI_LENH_BIET_CHAC).has(ld) ? ld : null;
  };
  /*
   * v34 — MANDATE BỊ CHẠM: chuỗi đang xếp sẽ bị server từ chối CẢ CHUỖI. Chỉ
   * bày hai lỗi mandate (client BIẾT CHẮC vai mình); lỗi khác giữ luật "im"
   * của `xemTruocLenh` (có thể là lỗi giả — xem đầu module đó).
   */
  const mandateLoi = useMemo(() => {
    if (!nav || !mandateXT) return null;
    const ld = lyDoCuaChuoi(nav.lenh);
    /*
     * ⚠ `khong_cam_san` VÀO DANH SÁCH NÀY, và đó là một cú vá chứ không phải nới
     * lỏng luật "im" của `xemTruocLenh`. Luật ấy im vì phần lớn lỗi có thể là lỗi
     * GIẢ (danh mục client thấy chưa chắc là danh mục server sẽ có sau khi áp thẻ).
     * `khong_cam_san` KHÔNG thuộc loại đó: nó chỉ phụ thuộc MÃ và một cờ server
     * gửi thẳng — client biết chắc như biết vai của mình. Cùng hạng với hai lỗi
     * mandate ngay cạnh.
     * Thiếu nó từ D311 tới D317: người chơi xếp lệnh khống CP Chứng khoán, bấm
     * chốt, rồi mới biết cả chuỗi bị bác.
     */
    /*
     * ⚠ D342 — `khong_cam_san` RỜI khối này sang `loiChuoi` ngay dưới: khối render chỉ có HAI câu
     * (mandate_ma / còn lại = "tổ chức không được Bán Khống"), nên lỗi sàn từng in NHẦM câu
     * mandate. Lỗi ấy ngủ vì màn trận chưa bao giờ truyền `khongTheoMa` xuống.
     */
    return ld === 'mandate_ma' || ld === 'mandate_khong' ? ld : null;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [nav, vai?.mandate?.tran_ma_bp, vai?.mandate?.cam_khong, nav?.khongTheoMa, nav?.khongTheoHanMuc]);

  /**
   * D342 — CHUỖI SẼ BỊ BÁC, nói TRƯỚC khi chốt. Chỉ các lỗi client BIẾT CHẮC (`LOI_LENH_BIET_CHAC`)
   * — lỗi có thể giả (danh mục đầy · lá vừa chọn) vẫn giữ luật "im" của `xemTruocLenh`.
   * ⚠ Vì sao phải có: bản nháp hỏng thì khối DANH MỤC SAU LỆNH biến mất IM LẶNG, và người chơi
   * đọc sự biến mất ấy là "lệnh đã nhận". Trận founder 16/09: bốn lần như thế, bốn lần bị bác.
   */
  const loiChuoi = useMemo(() => {
    if (!nav || nav.lenh.length === 0 || mandateLoi) return null;
    const ld = lyDoCuaChuoi(nav.lenh);
    // D446 — có bộ tham số server (và không đang chọn lá lõi) ⇒ trần số mã · bước chip · lá Bán Khống cũng biết chắc.
    const bietChac = nav.tuyChonLenh && !nav.laVuaChon ? LOI_LENH_BIET_CHAC_THEO_SERVER : LOI_LENH_BIET_CHAC;
    return ld && bietChac.has(ld) ? ld : null;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [nav, mandateLoi, vai?.mandate?.tran_ma_bp, vai?.mandate?.cam_khong]);

  /*
   * D68 §2 — SỐ CHẠY, KHÔNG NHẢY CÓC: ví và "tiền mặt sau lệnh" đuổi theo giá
   * trị mới qua vài nấc như đếm chip. Hook ở ĐỈNH component (luật hooks);
   * chỗ render nào cần thì đọc hai biến này thay vì giá trị thô.
   */
  const tienMatChay = useSoChay(nav?.tienMat ?? 0);
  const tienSauChay = useSoChay(xemTruoc?.tienMatSau ?? 0);

  /*
   * Hàng nào đáng hiện: mã ĐANG giữ hợp với mã SẼ giữ. Union chứ không phải
   * chỉ mã đang giữ — mua mã mới mà bảng không có dòng cho nó thì bảng đang
   * giấu đúng thứ người chơi vừa quyết.
   */
  const maSauLenh = useMemo(() => {
    if (!nav || !xemTruoc) return [] as string[];
    return [...new Set([...Object.keys(nav.viThe), ...Object.keys(xemTruoc.viTheSau)])];
  }, [nav, xemTruoc]);
  /**
   * D342 — SỔ KHỐNG cũng có dòng trong DANH MỤC SAU LỆNH. Trước đó mở khống chỉ hiện "TIỀN MẶT
   * → 0" và thanh rủi ro vọt, không một chữ nào nói tiền đi đâu — founder đọc thành "lệnh khống
   * không được tính".
   */
  const maKhongSauLenh = useMemo(() => {
    if (!nav || !xemTruoc) return [] as string[];
    return [...new Set([...Object.keys(nav.viKhong ?? {}), ...Object.keys(xemTruoc.viKhongSau)])]
      .filter((ma) => (nav.viKhong?.[ma] ?? 0) > 0 || (xemTruoc.viKhongSau[ma] ?? 0) > 0);
  }, [nav, xemTruoc]);

  /**
   * Tra id → tên hiển thị. Tìm cả trong shop LẪN danh mục: lá xung đột có thể
   * đang nằm trong tay chứ không còn trên quầy, và hiện id thô ("ban_khong") ở
   * mục "XUNG ĐỘT" thì đúng bằng không giải thích gì.
   */
  const moTaTen = (id: string): string =>
    [...taiSan, ...chienThuat].find((t) => t.id === id)?.ten
    ?? danhMuc.find((o) => o.id === id)?.ten
    ?? id;
  /*
   * ⚠ 27/07 — `khoaHet` KHÔNG còn tính `loaiVongNay === 'khong'`. Bản hôm qua
   * để vế đó lại là một lỗi tự tạo: server đã cho mua tài sản ở MỌI vòng
   * (spec 01 §7) mà UI vẫn xám cả hai mục ở vòng 7·8 — nút xám trong khi server
   * cho phép, ảnh gương của đúng lớp lỗi tệ nhất repo này. Giờ chỉ ALL-IN
   * (lật bài đến cuối) mới khoá shop.
   */
  const khoaHet = daAllIn;
  const soO = sucChuaTaiSan + sucChuaChienThuat;

  /*
   * ═══════════════════════════════════════════════════════════════════════
   * ⭐ D432 — LƯỢT CHỌN LÀ MỘT MÀN RIÊNG (founder 27/09, chọn phương án B)
   * ═══════════════════════════════════════════════════════════════════════
   * Nguyên văn: *"phấn shop đang hơi rối mắt và khó thao tác, cải tiến đi"* rồi *"Quá nhiều thứ trên 1 màn hình"*. Đếm trên
   * engine thật ở 375px: vòng lõi 28 chỗ bấm; vòng mốc trait hai lưới thẻ chồng nhau (6 thẻ trait gọn cao 67px + 6 lá tài
   * sản). Hai quyết định KHÁC LOẠI — chọn lá giữ cả trận · chia tiền cho vòng này — tranh cùng một khung hình.
   * Nay vòng có lượt chọn mở vào MÀN CHỌN: lá to, `!`, nút đổi lại + MỘT nút chính neo đáy (BỎ QUA / VÀO BÀN CƯỢC).
   *   · Chọn LÕI vẫn là MỘT chạm như cũ (MUA), rồi tự sang bàn sau một nhịp để lá kịp búng lên.
   *   · Trait phải cân về 0 nên không tự sang — nút chính là cửa, và nó khoá kèm con số lệch khi chưa cân.
   *   · ⚠ KHÔNG GIẤU: bàn cược mang nút ◆ ở đầu mục TÀI SẢN để quay lại màn chọn bất cứ lúc nào (gu founder 13/09: không
   *     ngăn kéo, mọi thứ chơi được một chạm tới). Giá của phương án: thêm MỘT chạm cho ai BỎ QUA lượt chọn.
   */
  const [buocNoi, setBuocNoi] = useState<'chon' | 'ban'>('chon');
  const buocHT = buocChon ?? buocNoi;
  const doiBuoc = (b: 'chon' | 'ban') => { setBuocNoi(b); onBuocChon?.(b); };
  /*
   * D526 — NHỊP XEN KẼ (khoá v58): vòng 4 · 6 mở chợ trait CÙNG lượt lõi (demo nhịp trận founder chốt 05/10: hàng lõi đứng trên chợ, một
   * chặng). `ca_hai` = một màn chọn mang cả hai: lá lõi gọn ở trên, chợ trait dưới, nút chính là cửa của trait (phải cân về 0). Khoá cũ không
   * bao giờ trùng hai thứ (mốc trait né vòng lõi — D428), nên nhánh này chỉ sống dưới v58.
   */
  const coLuotLoi = loaiVongNay === 'chien_thuat';
  const coChoTrait = choTrait !== undefined && choTrait !== null;
  const luotChon: 'loi' | 'trait' | 'ca_hai' | null = !nav || khoaHet ? null
    : coLuotLoi && coChoTrait ? 'ca_hai'
      : coLuotLoi ? 'loi'
        : coChoTrait ? 'trait' : null;
  const dangManChon = luotChon !== null && buocHT === 'chon';
  const giamChuyenDong = useReducedMotion();
  const chonCTTruoc = useRef(chonCT);
  useEffect(() => {
    const truoc = chonCTTruoc.current;
    chonCTTruoc.current = chonCT;
    if (!dangManChon || luotChon !== 'loi' || !chonCT || chonCT === truoc) return undefined;
    const t = window.setTimeout(() => doiBuoc('ban'), NHIP.CHON_XONG_SANG_BAN);
    return () => window.clearTimeout(t);
  }, [chonCT]); // eslint-disable-line react-hooks/exhaustive-deps -- chỉ cú CHỌN mới đẩy sang bàn, không phải mọi lần render
  /** Nhãn nút ◆ quay lại màn chọn — nói luôn trạng thái lượt chọn (lõi đã lấy gì · cân trait). */
  const nhanVeChon = (): string => {
    if (luotChon === 'loi') return chonCT ? `◆ ${moTaTen(chonCT).toUpperCase()}` : '◆ CHỌN LÕI';
    const traitChu = !canTrait || canTrait.soChon === 0 ? 'CHỢ TRAIT'
      : canTrait.can === 0 ? 'TRAIT · CÂN 0' : `TRAIT · LỆCH ${soDep(canTrait.can)}`;
    // D526 — màn chọn mang cả hai: nhãn nói cả hai trạng thái.
    if (luotChon === 'ca_hai') return `◆ ${chonCT ? moTaTen(chonCT).toUpperCase() : 'LÕI'} · ${traitChu}`;
    return `◆ ${traitChu}`;
  };
  /*
   * D526 (founder 05/10: *"Đổi lõi và đổi trait cho luôn trong khung của trait và lõi đi chứ để dưới khó nhìn"* → *"Đổi trait ở
   * dưới xu và đổi lõi ở dưới 2 lõi (đổi lõi chỉ đổi được 1 lần)"*) — nút ĐỔI LÕI đứng TRONG khung lõi, ngay dưới hai lá (đổi trait
   * dưới ô XU của chợ, `ChoTrait.nutCuon`); đáy màn chọn chỉ còn nút chính. Lùi lệnh 27/09 *"cho xuống chỗ chung bàn"* của
   * D430/D432 — lệnh sau thắng lệnh trước. Hết lượt đổi (`doiLoiHet`) ⇒ khoá + nói đã đổi.
   */
  const nutDoiLoi = (
    <button
      type="button"
      className={s.nutDoi}
      data-tap="doi-loi"
      aria-label={doiLoiHet ? 'Đã đổi lõi vòng này' : `Đổi lõi, ${chiPhiRoll ? `giá ${chiPhiRoll} xu` : 'miễn phí'}`}
      disabled={!!vohieu || doiLoiHet || luotConLai < chiPhiRoll}
      onClick={(e) => { rung(NHIP_RUNG.nang); phutHat(e.currentTarget, '#fde047', giamChuyenDong); onRoll(); }}
    >
      {doiLoiHet ? 'ĐÃ ĐỔI LÕI' : (
        <>
          <span className={s.nutDoiXoay} aria-hidden>⟳</span>ĐỔI LÕI
          <span className={s.nutDoiGia}>
            {chiPhiRoll ? <><i className={s.nutDoiXu} aria-hidden />{chiPhiRoll}</> : 'MIỄN PHÍ'}
          </span>
        </>
      )}
    </button>
  );

  const muc = (
    loai: 'tai_san' | 'chien_thuat', nhan: string, phu: string, the: TheShop[],
    dangChon: readonly string[], onChon: (id: string) => void,
    /**
     * Trần số lá lấy được ở mục này. Đầy rồi thì các lá CHƯA CHỌN bị vô hiệu —
     * chứ không phải âm thầm thay lá cũ. Người chơi phải bỏ chọn có ý thức, nếu
     * không thì cú bấm thứ ba lặng lẽ vứt mất một lựa chọn họ đã cân nhắc.
     */
    tran = 1,
  ) => {
    /*
     * ⚠ CHỢ TÀI SẢN MỞ Ở MỌI VÒNG (founder 27/07, spec 01 §7) — chỉ mục CHIẾN
     * THUẬT còn theo nhịp D34. Trước đây cả hai mục cùng đóng/mở theo
     * `loaiTheVong`, nên trên map 8 thì mục TÀI SẢN xám ở 5/8 vòng.
     *
     * Cổng này phải khớp ĐÚNG cổng server (`mua` trong server/holdem/shop.ts).
     * Lệch một chút là "nút sáng mà bấm không ăn" — lớp lỗi tệ nhất của repo.
     */
    const mo = !khoaHet && (loai === 'tai_san' || loaiVongNay === loai);
    // D526 — lá lõi ở MÀN CHỌN: chạm mở tờ chú thích có nút LẤY (như tấm trait), không còn nút MUA dưới lá.
    const theoTam = loai === 'chien_thuat' && dangManChon;
    const vongMo = loai === 'tai_san' ? undefined : vongMoTiepTheo[loai];
    /**
     * ⚠ TÀI SẢN KHÔNG CÓ NÚT ROLL — và đây là luật, không phải thiếu sót.
     *
     * `bayShop` cố ý KHÔNG đưa lượt khảo sát vào toạ độ rút tài sản: 3 lá tài
     * sản là CHUNG cả bàn, ai cũng thấy y hệt nhau. Đó chính là thứ đẻ ra
     * tranh mua (crowding) — trụ cột cơ chế của D24. Roll được thì mỗi người
     * một bộ, crowding biến mất.
     *
     * Bản trước tôi vẫn vẽ nút roll ở cả hai mục cho "đối xứng". Hậu quả:
     * founder bấm roll ở mục TÀI SẢN thì thấy CHIẾN THUẬT đổi (vì bayShop
     * dựng lại cả hai, mà chỉ chiến thuật phụ thuộc lượt khảo sát). Nút hứa
     * một việc rồi làm việc khác — tệ hơn hẳn việc không có nút.
     */
    /*
     * ⭐ D432 — Ô BÊN PHẢI ĐẦU MỤC TÀI SẢN = VIỆC RIÊNG CỦA VÒNG NÀY. D430 (founder 27/09: *"Phần đổi lại của chiến thuật
     * và chợ trait cho xuống chỗ chung bàn đi"*) đặt nút đổi lõi / đổi chợ ở đây khi lõi và chợ còn chung màn với bàn. D432
     * tách lượt chọn ra MÀN CHỌN, nên nút đổi lại theo lượt chọn xuống ĐÁY màn chọn (vẫn là "xuống", sát ngón cái); ô này
     * mang nút ◆ QUAY LẠI màn chọn. Vòng thường: nhãn hẹn lõi kế (thay dòng khung đứt "LÕI CHIẾN THUẬT tiếp theo…").
     * ⚠ Cú nhầm ghi ngay trên (bấm ⟳ ở mục TÀI SẢN mà lõi đổi) vẫn là luật: nút ở ô này PHẢI nói đích — "◆ CHỌN LÕI".
     * Nhãn "CHUNG BÀN" khung đứt bỏ ở trận nav: nó là câu giải thích thường trực cho một luật học một lần.
     */
    // Tài sản = lưới 2 hàng → cần `.mucCao` (172px là ngân sách MỘT hàng).
    return (
      <section
        className={`${s.muc} ${loai === 'tai_san' ? s.mucCao : ''} ${mo ? '' : s.mucKhoa}`}
        data-tap={loai === 'tai_san' ? 'shop-taisan' : 'shop-loi'}
      >
        <header className={s.mucDau}>
          <span className={s.mucTen}>{nhan}</span>
          {/* D302 — ĐÃ LẤY ĐỦ: lá thứ hai bị `vohieu` (xám 0,4) và chạm vào không
              có gì xảy ra — trên điện thoại không có con trỏ "not-allowed", nên
              người mới đọc là "lõi bị lỗi khi chọn" (founder 07/09; telemetry
              45 ngày: 0 lỗi API ở màn trận). Nói ngay trên đầu mục lấy gì rồi và
              đổi bằng cách nào — chữ đổi theo trạng thái, không thêm nút. */}
          <span
            className={s.mucPhu}
            {...(mo && loai === 'chien_thuat' && dangChon.length >= tran
              ? { 'data-da-lay': dangChon[0] } : {})}
          >
            {mo
              ? (loai === 'chien_thuat' && dangChon.length >= tran
                ? (theoTam ? `đã lấy ${the.find((t) => t.id === dangChon[0])?.ten ?? 'một lá'}`
                  : `đã lấy ${the.find((t) => t.id === dangChon[0])?.ten ?? 'một lá'} · chạm lại lá đó để đổi`)
                : phu)
              : vongMo ? `mở ở vòng ${vongMo}`
                : 'hết lượt lấy trong trận này'}
          </span>
          {loai === 'chien_thuat' ? null : nav ? (luotChon ? (
            <button
              type="button"
              className={[s.nutVeChon,
                luotChon !== 'loi' && canTrait !== undefined && canTrait.soChon > 0 && canTrait.can !== 0 ? s.nutVeChonLech : '',
              ].filter(Boolean).join(' ')}
              data-tap="ve-chon"
              onClick={() => { rung(NHIP_RUNG.cham); doiBuoc('chon'); }}
            >
              {nhanVeChon()}
            </button>
          ) : vongMoTiepTheo.chien_thuat !== null ? (
            <span className={s.henLoiTag} data-hen-loi>◆ LÕI Ở VÒNG {vongMoTiepTheo.chien_thuat}</span>
          ) : null) : (
            /*
             * Nhãn này KHÔNG có icon ổ khoá, dù chỗ khác trong màn thì có.
             * Lưới `lock` là 16 hàng nên cỡ nhỏ nhất render được là 16px, mà cả
             * hàng `.mucDau` chỉ cao 22px và nhãn chữ ở đây là 9px — nhét vào là
             * phá đúng ngân sách chiều cao mà cả file này dựng để giữ (xem
             * docstring đầu ShopManHinh.module.css). Chữ "CHUNG BÀN" trong khung
             * gạch đứt đã nói đủ là khoá có lý do.
             */
            <span className={s.khongRoll} title="Tài sản chung cả bàn nên không đổi được">
              CHUNG BÀN
            </span>
          )}
        </header>
        {/*
          Hàng TÀI SẢN nay có 6 lá (trước là 3) nên phải xuống LƯỚI 3 CỘT.
          Giữ một hàng ngang thì trên máy 375px mỗi lá còn ~52px — không đủ chỗ
          cho art + tên + nút (!), tức bày đủ 6 mã xong lại không đọc được mã nào.
          Mục CHIẾN THUẬT vẫn 2 lá nên giữ hàng ngang.
        */}
        <div className={loai === 'tai_san' ? s.luoiThe : s.hangThe}>
          {the.map((t, i) => {
            /*
             * Founder 02/08 — lá trùng phải NÓI nó là nâng cấp: server đã lọc
             * lá chết (đủ bản/ô kín) khỏi shop, lá đang cầm còn hiện nghĩa là
             * lấy thêm = lên cấp (D40). Không ghi ra thì người chơi đọc thành
             * "pick rồi mà vẫn hiện" — đúng câu founder báo. Ghi đè dòng phụ
             * `en` (tên tiếng Anh) — thông tin cấp đáng chỗ hơn ở lá đã thuộc.
             */
            const capCam = loai === 'chien_thuat'
              ? danhMuc.find((o) => o.id === t.id && o.loai === 'chien_thuat')?.cap ?? 0
              : 0;
            /*
             * BÀN CƯỢC (nav, mục TÀI SẢN): lá là Ô ĐẶT CHIP. Không nút MUA, không
             * vô hiệu vì "đã đầy" — chạm lá là nhấc lên tay / đặt chip đang cầm.
             * Phụ kiện: cọc chip + giá trị vị thế + badge ×2 khi Đòn Bẩy nhắm.
             */
            const banCuoc = !!nav && loai === 'tai_san';
            const giaTri = banCuoc ? (nav!.viThe[t.id] ?? 0) : 0;
            const khong = banCuoc ? (nav!.viKhong?.[t.id] ?? 0) : 0;
            const dichGan = banCuoc
              ? Object.entries({ ...(ganHienTai ?? {}), ...(doiGan ?? {}), ...(chonCT && ganVao ? { [chonCT]: ganVao } : {}) })
                .filter(([, ma]) => ma === t.id).map(([the]) => the)
              : [];
            // v34 — đích PHỤ Đòn Bẩy cấp 2: đang chờ ('' = bỏ) đè lên bảng server.
            const dichPhu = banCuoc
              ? (vai?.doiGanPhu !== undefined && vai?.doiGanPhu !== null ? vai.doiGanPhu : (vai?.ganPhuHienTai ?? ''))
              : '';
            const lenhCuaMa = banCuoc ? nav!.lenh.filter((l) => l.ma === t.id) : [];
            /*
             * ⭐ ĐANG KHỐNG MÃ NÀY — cọc khống đã mở (server) HOẶC lệnh khống
             * đang xếp trong hàng đợi (chưa chốt). Cả hai đều là "tôi đang cược
             * mã này xuống", nên cả hai đều nhuộm lá.
             * ⚠ `dong_khong` KHÔNG tính: đó là cú ĐÓNG vị thế khống — trạng thái
             * đang đi ra, không phải đang ở trong.
             */
            const dangKhong = banCuoc
              && (khong > 0 || lenhCuaMa.some((l) => l.chieu === 'khong'));
            /*
             * ⭐ ĐÒN BẨY ĐANG NHẮM MÃ NÀY — dùng cho CỌC TÍM RIÊNG bên cạnh.
             * ⚠ Hỏi ĐÍCH DANH `don_bay`, KHÔNG hỏi `dichGan.length > 0`: bảng
             * `gan` gom MỌI lá có `pham_vi: 'tai_san'` (9 lá), nhưng chỉ mình
             * `don_bay` được engine nhân đôi (`engine.ts` đọc `ganThe?.don_bay`).
             * Đếm cả nhóm là vẽ cọc tím cho một lá không nhân gì.
             */
            const donBayNham = banCuoc
              && (dichGan.includes('don_bay') || dichPhu === t.id);
            // D435 — tiền MUA đang xếp ở mã này (bản nháp server): cọc chờ đếm theo tiền, không theo mốc %.
            const tienChoMua = xemTruoc && lenhCuaMa.some((l) => l.chieu === 'mua')
              ? xemTruoc.buoc.filter((b) => b.ma === t.id && !b.khong && b.tien > 0).reduce((a, b) => a + b.tien, 0)
              : undefined;
            const phuKien = banCuoc ? (
              <>
                <CocChip
                  giu={giaTri} khong={khong} donVi={donViChip}
                  cho={lenhCuaMa} choTien={tienChoMua}
                  donBay={donBayNham}
                  onCham={() => chamCoc(t.id)}
                  vohieu={!!vohieu}
                />
                {(() => {
                  /*
                   * D432 — SỐ SAU LỆNH IN LÊN CHÍNH LÁ (thay bảng "DANH MỤC SAU LỆNH" thường trực trên nỉ). Lá có lệnh đang
                   * xếp ⇒ "trước→sau", màu "đang xếp" (họ lam của cọc chờ chốt). Số do bản nháp server (`xemTruocLenh`, C4).
                   */
                  const coLenh = lenhCuaMa.length > 0 && xemTruoc !== null;
                  const sauDai = coLenh ? (xemTruoc.viTheSau[t.id] ?? 0) : giaTri;
                  const sauKhong = coLenh ? (xemTruoc.viKhongSau[t.id] ?? 0) : khong;
                  const so = (n: number) => n.toLocaleString('vi-VN');
                  const phan = [
                    giaTri > 0 || sauDai > 0 ? (sauDai !== giaTri ? `${so(giaTri)}→${so(sauDai)}` : so(giaTri)) : '',
                    khong > 0 || sauKhong > 0 ? `K ${sauKhong !== khong ? `${so(khong)}→${so(sauKhong)}` : so(khong)}` : '',
                  ].filter(Boolean);
                  if (phan.length === 0) return null;
                  const doi = sauDai !== giaTri || sauKhong !== khong;
                  return (
                    <span className={doi ? `${gc.giaTri} ${s.giaTriSau}` : gc.giaTri} {...(doi ? { 'data-sau-lenh': '' } : {})}>
                      {phan.join(' · ')}
                    </span>
                  );
                })()}
                {dichGan.length > 0 && (
                  <span className={gc.badgeGan} title={dichGan.map((d) => moTaTen(d)).join(', ')}>×2</span>
                )}
                {dichGan.length === 0 && dichPhu === t.id && (
                  <span className={gc.badgeGan} title="Đích phụ Đòn Bẩy (cấp 2)">×2</span>
                )}
                {vai?.dongTien?.[t.id] && (
                  <span
                    className={`${gc.badgeDong} ${vai.dongTien[t.id] === 'dong' ? gc.dongDong : vai.dongTien[t.id] === 'vua' ? gc.dongVua : gc.dongVang}`}
                    title="Dòng tiền cả bàn (đặc quyền tổ chức)"
                    data-testid={`dong-tien-${t.id}`}
                  >
                    {vai.dongTien[t.id] === 'dong' ? 'ĐÔNG' : vai.dongTien[t.id] === 'vua' ? 'VỪA' : 'VẮNG'}
                  </span>
                )}
                {dongLenh && dongLenh[t.id] !== undefined && (() => {
                  const muc = dongLenh[t.id]!;
                  return (
                    <span
                      className={`${gc.badgeLenh} ${muc > 0 ? gc.lenhMua : muc < 0 ? gc.lenhBan : gc.lenhIm}`}
                      title={muc === 0
                        ? 'ĐI SAU — cả bàn chưa đụng mã này ở vòng này'
                        : `ĐI SAU — cả bàn đang ${muc > 0 ? 'MUA' : 'BÁN'} mã này (${Math.abs(muc) === 3 ? 'mạnh' : Math.abs(muc) === 2 ? 'vừa' : 'nhẹ'})`}
                      data-dong-lenh={muc}
                    >
                      {muc === 0 ? '—' : (muc > 0 ? '▲' : '▼').repeat(Math.abs(muc))}
                    </span>
                  );
                })()}
              </>
            ) : undefined;
            return (
              <GameCard
                /*
                 * ⚠⚠ KEY THEO Ô, KHÔNG THEO LÁ — và đây là cả lý do cú lật
                 * `px.lat` chưa bao giờ chạy trong app.
                 *
                 * `GameCard` lật khi prop `id` ĐỔI (`idTruoc.current !== id`).
                 * Với `key={t.id}`, đổi bài là React UNMOUNT lá cũ + MOUNT lá
                 * mới ⇒ instance mới khởi tạo `idTruoc = id` ⇒ `doi === false`
                 * ⇒ không lật lần nào. Bài `cardfx.test.tsx` xanh vì nó
                 * `rerender` thẳng một instance KHÔNG có key — điều kiện đó
                 * không tồn tại trong app (đúng lớp lỗi D62/D66: test xanh
                 * mãi mà chưa từng chạm thứ nó mang tên).
                 *
                 * Key theo Ô còn đúng về mặt thiết kế: Ô LÀ MỘT CHỖ TRÊN BÀN,
                 * lá đến rồi đi khỏi chỗ đó — chứ không phải mỗi lá một vũ trụ.
                 */
                key={`${loai}-${i}`}
                id={t.id} ten={t.ten}
                en={capCam > 0 ? `ĐANG CẦM ×${capCam} → LẤY = CẤP ${capCam + 1}` : banCuoc ? undefined : t.en}
                svg={t.svg}
                mau={t.mau}
                {...(dangKhong ? { mauDe: MAU_KHONG } : {})}
                chon={dangChon.includes(t.id)}
                vohieu={!mo || !!vohieu
                  || (!banCuoc && !theoTam && !dangChon.includes(t.id) && dangChon.length >= tran)}
                {...(banCuoc ? {
                  anNutMua: true,
                  duocMoi: chipCam !== null || ganCam !== null,
                  phuKien,
                } : theoTam ? { anNutMua: true } : {})}
                /*
                 * CHIA BÀI SO LE — prop `hieuUng` + lớp `.vao` đã viết xong từ
                 * lâu mà CHƯA CÓ MỘT CALLER NÀO truyền vào (cơ chế trang trí,
                 * lớp lỗi repo dính nhiều lần). Nối dây ở đây.
                 *
                 * Sáu lá hiện cùng một khung hình đọc ra là "màn hình vừa
                 * refresh"; sáu lá đáp lần lượt đọc ra là "người ta vừa CHIA
                 * BÀI cho tôi". Đó là toàn bộ khác biệt founder đang đòi, và
                 * nó tốn đúng một biến CSS.
                 */
                hieuUng={[chiaBai ? s.laVao : '', banCuoc && khoaCoc ? s.laKhoa : ''].filter(Boolean).join(' ')}
                doTre={i}
                onToggle={() => (banCuoc ? chamLaNav(t.id) : theoTam ? setDangGiaiThich(t.id) : onChon(t.id))}
                onGiaiThich={() => setDangGiaiThich(t.id)}
              />
            );
          })}
          {/*
            * D540 — PHIẾU LỆNH mọc ngay trên lưới (founder 06/10: "chạm thẻ mã thì hàng chip và MUA/BÁN mọc ngay trên thẻ"): đè lên hàng thẻ KIA,
            * mũi chỉ đúng cột thẻ đang chọn ⇒ thẻ vẫn thấy, chip nằm TRONG lưới (trong vùng rọi `shop-taisan` của bàn tập).
            */}
          {loai === 'tai_san' && nav && laCam && (() => {
            const i = the.findIndex((t) => t.id === laCam);
            if (i < 0) return null;
            const hangTren = i < 3;
            return (
              <div className={`${s.phieuNoi} ${hangTren ? s.phieuDuoi : s.phieuTren}`} style={{ '--mui': `${((i % 3) + 0.5) * (100 / 3)}%` } as CSSProperties}>
                <PhieuLenh
                  mui={hangTren ? 'tren' : 'duoi'}
                  tenMa={moTaTen(laCam)}
                  mat={mat} onDoiMat={doiMat}
                  coBanKhong={nav.coBanKhong === true} coCocRut={(viThe[laCam] ?? 0) > 0}
                  buocMocBp={nav.buocMocBp} mocChoPhep={nav.mocChoPhep}
                  coSo={coSoChip}
                  onChamChip={chamChip}
                  chipVoHieu={!lenhDuoc(mat, laCam)}
                  allDangNhip={allNhip}
                  vohieu={!!vohieu}
                  onDong={thaLa}
                />
              </div>
            );
          })()}
        </div>
        {/* D526 — ĐỔI LÕI ngay dưới hai lá, trong khung lõi (chỉ ở màn chọn, khi lượt lõi đang mở). */}
        {theoTam && mo && <div className={s.doiLoiDuoi}>{nutDoiLoi}</div>}
      </section>
    );
  };

  /** Một nhóm trong danh mục. Viết thẳng hai lần thay vì map — map thì phải
   *  bọc Fragment để chèn vạch dọc, và Fragment mang key là chỗ React hay
   *  cảnh báo mà không ai đọc log. */
  const nhomDanhMuc = (
    loai: 'tai_san' | 'chien_thuat', nhan: string, suc: number,
  ) => {
    const cua = danhMuc.filter((o) => o.loai === loai);
    return (
      <div>
        <div className={s.nhomNhan}>{nhan} ({cua.length}/{suc})</div>
        <div className={s.pcards}>
          {cua.length === 0 && <span className={s.trong}>chưa có</span>}
          {cua.map((o) => {
            /*
             * Founder 01/08: "cho t bấm vào phần hình ảnh tài sản ở phần danh
             * mục... chứ không phải chỉ có chữ" — tile TÀI SẢN trên trận nav
             * là NÚT: bấm là chọn đúng mã đó và panel phân bổ mốc mở ngay
             * (mã nào cũng có mặt trong chợ nên chọn luôn hợp lệ). Kèm giá
             * trị vị thế hiện tại — danh mục phải nói số, không chỉ nói tên.
             */
            const bamDuoc = nav && loai === 'tai_san';
            const giaTri = bamDuoc ? (nav!.viThe[o.id] ?? 0) : 0;
            const Tile = bamDuoc ? 'button' : 'div';
            return (
              <Tile
                key={o.id}
                {...(bamDuoc ? { type: 'button' as const } : {})}
                className={bamDuoc ? `${s.pc} ${s.pcBam}` : s.pc}
                style={{ ['--bd' as string]: o.mau[0], ['--gl' as string]: o.mau[1] }}
                {...(bamDuoc ? { onClick: () => onChonTS(o.id) } : {})}
              >
                {/* eslint-disable-next-line react/no-danger -- SVG hằng số trong repo */}
                <span
                  className={s.pcArt}
                  dangerouslySetInnerHTML={htmlTinh(art[o.id] ?? '')}
                />
                <span>{o.ten.toUpperCase()}</span>
                {bamDuoc && giaTri > 0 && (
                  <span className={s.pcGia}>{giaTri.toLocaleString('vi-VN')}</span>
                )}
                {/* Stack tới 3 bản nên CẤP hiện bằng SỐ. Ký hiệu ² của bản cũ chỉ
                    tả được đúng một mức. */}
                {o.cap > 1 && <span className={s.pcCap}>×{o.cap}</span>}
              </Tile>
            );
          })}
        </div>
      </div>
    );
  };

  /*
   * ══════════════════════════════════════════════════════════════════════════
   * CHUYỂN CẢNH MỞ / ĐÓNG (D68 §3) — VÌ SAO NÓ NẰM TRONG CHÍNH COMPONENT NÀY
   *
   * Chiều VÀO thì dễ: hoạt ảnh chạy lúc mount, cha không cần biết gì.
   * Chiều RA thì không: cha gỡ component khỏi cây ngay khi `onDong()` chạy, nên
   * hoạt ảnh đóng không kịp một khung hình nào. Cách thông thường là để cha giữ
   * cờ "đang đóng" — nhưng cha là `AlphaDraftMatch.tsx`, và **cửa sổ kia đang
   * sửa dở đúng file đó**. Chạm vào là giẫm chân nhau.
   *
   * Nên component tự nuốt độ trễ: bấm ✕ → bật cờ nội bộ → chạy hoạt ảnh → HẾT
   * hoạt ảnh mới gọi `onDong()` của cha. Cha không phải biết gì cả.
   *
   * ⚠ GIÁ ĐÃ KHAI: đường đóng do CHA quyết (chốt vòng, hết giờ, tự-nộp) vẫn cụp
   * tức thì — component không chặn được những đường đó. Đây là đánh đổi có chủ
   * đích để không đụng file đang bẩn, và nó LÙI ĐƯỢC: khi cửa sổ kia commit
   * xong, thêm ba dòng ở cha là hai chiều dùng chung một đường.
   *
   * ⚠ `onAnimationEnd` KHÔNG dùng được làm chốt: nó bắn cho MỌI animation con
   * nổi bọt lên (shop có hàng chục thẻ có hoạt ảnh riêng), nên nút ✕ sẽ đóng
   * màn ngay khi một thẻ bất kỳ diễn xong. Dùng đồng hồ khớp đúng thời lượng CSS.
   */
  const [dangDong, setDangDong] = useState(false);
  const dongTimer = useRef<number | null>(null);
  useEffect(() => () => {
    if (dongTimer.current !== null) clearTimeout(dongTimer.current);
  }, []);
  const dongCoHoatAnh = () => {
    if (dangDong) return;
    // Tiết kiệm chuyển động → đóng ngay, không bắt người ta chờ một hiệu ứng
    // mà chính họ đã tắt.
    if (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) {
      onDong();
      return;
    }
    setDangDong(true);
    dongTimer.current = window.setTimeout(onDong, SHOP_DONG_MS);
  };

  /** Mã người chơi ĐANG CẦM — chỉ gắn được vào thứ mình có. */
  const maDangCam = danhMuc.filter((o) => o.loai === 'tai_san').map((o) => o.id);

  /* ═══════════════════════════════════════════════════════════════════════
   * BÀN CƯỢC — ngữ pháp "CẦM rồi CHẠM" (chỉ nhánh nav)
   * ═══════════════════════════════════════════════════════════════════════ */

  /** Chọn ĐÚNG MỘT lá (chonTS là mảng của cha — dùng như ô đơn ở trận nav). */
  const chonMotLa = (ma: string) => {
    if (chonTS.includes(ma)) { onChonTS(ma); return; }
    for (const x of chonTS) onChonTS(x);
    onChonTS(ma);
  };
  const thaLa = () => { for (const x of chonTS) onChonTS(x); };

  const tienMat = nav?.tienMat ?? 0;
  const viThe = nav?.viThe ?? {};
  const viKhong = nav?.viKhong ?? {};
  const coCocRut = Object.values(viThe).some((v) => v > 0);
  /** Lệnh có được không, theo mặt và lá — cùng điều kiện với nút cũ. */
  /*
   * ⚠⚠ MUA PHẢI SOI TIỀN MẶT *SAU HÀNG ĐỢI*, KHÔNG PHẢI TIỀN MẶT SERVER
   * (founder 23/08: *"sao t đặt được lắm lệnh all in thế?"*).
   *
   * Bản cũ hỏi `tienMat > 0` — mà đó là số dư SERVER, chỉ đổi lúc CHỐT VÒNG.
   * Hàng đợi có 4 lệnh vẫn chưa trừ đồng nào, nên cửa này luôn mở và người chơi
   * xếp được ALL-IN nhiều lần liền. Server thì giải lệnh TUẦN TỰ trên số dư
   * đang chạy (`nav.ts: tien = tienTuMoc(l.moc_bp, nhap.von)`), nên ALL-IN thứ
   * hai lấy 100% CỦA 0 = 0. Đúng ảnh founder gửi: 4 lệnh xếp, chỉ 2 lệnh đầu ra
   * tiền (USD 7.257 · TPCP 2.425), còn VÀNG và CP CÔNG NGHỆ là **lệnh CHẾT** —
   * vẫn hiện tag, vẫn có nút ✕, và không làm gì cả.
   *
   * Đây đúng lớp "no-op cũng là một cú từ chối" mà D70 đã chốt cho `/khop-lenh`
   * (trả 409 thay vì 200 im lặng); hàng đợi thì chưa ai áp. `xemTruoc.tienMatSau`
   * là CHÍNH phép giải của server chạy trên bản nháp (D67) nên không có bản sao
   * công thức thứ hai để trôi.
   */
  const tienMatSau = xemTruoc?.tienMatSau ?? tienMat;
  /**
   * D342 — HẠN MỨC KHỐNG CÒN LẠI sau hàng đợi, bằng CHÍNH hàm server giải chip KHỐNG
   * (`hanMucKhongCon`) trên bản nháp — không một phép tính thứ hai.
   */
  const hanMucKhongSau = hanMucKhongCon({
    von: tienMatSau,
    vi_the: xemTruoc?.viTheSau ?? viThe,
    vi_the_khong: xemTruoc?.viKhongSau ?? viKhong,
  });
  const lenhDuoc = (m: MatChip, ma: string | null): boolean => {
    if (!nav || vohieu) return false;
    if (m === 'ban') return ma ? (viThe[ma] ?? 0) > 0 : coCocRut;
    /*
     * D342 — CHUỖI ĐANG HỎNG ⇒ không xếp thêm tiền ra. Bản nháp hỏng thì `tienMatSau` rơi về
     * số dư server, tức cửa lại mở như thể hàng đợi rỗng — người chơi chồng thêm lệnh lên một
     * chuỗi mà cả chuỗi sẽ bị bác. RÚT vẫn mở: bán bớt là một cách sửa chuỗi.
     */
    if (loiChuoi || mandateLoi) return false;
    if (m === 'khong' && nav.khongTheoHanMuc === true) return hanMucKhongSau > 0;
    return tienMatSau > 0;
  };

  /**
   * ĐẶT LỆNH — điểm hội tụ của cả hai đường (chip→lá · lá→chip). Server vẫn là
   * nơi duy nhất áp lệnh (C4); đây chỉ nạp `{ma, chieu, moc_bp}` vào hàng đợi
   * của cha qua `nav.onThem` (luật gộp ở `lib/lenh_moc`).
   */
  const datLenh = (ma: string, mocBp: number, nguon: 'chip-truoc' | 'la-truoc' | 'lap') => {
    if (!nav) return;
    const chieu: LenhMoc['chieu'] = mat === 'ban' ? 'ban' : mat === 'khong' ? 'khong' : 'mua';
    /*
     * ⚠ CAM KẾT GIỮ = KHÔNG ĐỤNG TỚI (founder 17/08). Engine cho bán mã đang
     * khoá rồi PHẠT (bẻ kèo); UI thì chặn hẳn ở đây và nói vì sao, vì một cam
     * kết mà bấm nhầm một cái là mất tiền thì nó không phải cam kết, nó là bẫy.
     * Muốn bẻ kèo thật thì có cửa riêng ở thanh CAM KẾT (có báo giá).
     */
    if (chieu === 'ban' && khoa?.dangChay?.ma === ma) {
      baoNhanh(`ĐANG CAM KẾT GIỮ · CÒN ${khoa.dangChay.con_vong} VÒNG`);
      return;
    }
    if (!lenhDuoc(mat, ma)) {
      /*
       * Nói ĐÚNG lý do: hết tiền vì HÀNG ĐỢI đã tiêu hết chứ không phải vì ví
       * rỗng. Người chơi đang nhìn "VÍ 10.000" trên đầu shop, nên câu "HẾT TIỀN
       * MẶT" trơ trọi đọc ra như app hỏng.
       */
      baoNhanh(
        mat === 'ban' ? 'CHƯA GIỮ MÃ NÀY — KHÔNG CÓ GÌ ĐỂ RÚT'
          : loiChuoi || mandateLoi ? 'CHUỖI ĐANG XẾP SẼ BỊ TỪ CHỐI — XEM DÒNG ĐỎ'
            : mat === 'khong' && nav.khongTheoHanMuc === true ? 'HẾT HẠN MỨC KHỐNG'
              : tienMat > 0 ? 'LỆNH ĐANG XẾP ĐÃ TIÊU HẾT TIỀN MẶT' : 'HẾT TIỀN MẶT',
      );
      return;
    }
    /*
     * ⚠ D533 — KIỂM TRƯỚC KHI XẾP: thêm lệnh này mà CẢ chuỗi sẽ bị server bác (lỗi biết chắc: trần một mã của Tổ Chức, khống khi không có lá…)
     * ⇒ không xếp, nói lý do ngay. Trước đây lệnh vượt trần ĐẦU TIÊN vẫn lọt (dòng đỏ chỉ chặn lệnh thứ hai), CHỐT VÒNG vẫn mở ⇒ cả chuỗi bị bác,
     * không cầm mã nào, vòng có màn thì không có màn. Bộ quét 06/10: Tổ Chức bấm 50 % / ALL-IN một mã là dính — ca bị bác nhiều nhất.
     */
    const ldMoi = loiBietChac(lyDoCuaChuoi(themLenhMoc(nav.lenh, { ma, chieu, moc_bp: mocBp })));
    if (ldMoi) { baoNhanh(chuLoiLenh(ldMoi).toUpperCase()); return; }
    nav.onThem({ ma, chieu, moc_bp: mocBp });
    // Nhãn CÁCH nhập lệnh — telemetry, không phải events (A9). LẶP không ghi:
    // đó là lặp lại một cách nhập đã ghi.
    if (nguon !== 'lap') {
      ghiDo('cham_nut', { chi_tiet: { nut: nguon === 'chip-truoc' ? 'shop-chip-truoc' : 'shop-la-truoc' } });
    }
    const allIn = mocBp === 10000 && chieu === 'mua';
    /*
     * ⚠⚠ HIỆU ỨNG ALL-IN NAY CHỈ CÒN Ở ĐÂY — TRÊN CHÍNH CÁI NÚT (founder 22/08:
     * *"xóa hiệu ứng all in đi, chỉ cải tiến hiệu ứng khi bấm nút all in thôi,
     * không còn hiện all in toàn màn hình nữa"*).
     *
     * Lịch sử để người sau khỏi dựng lại: 16/08 founder đã gạt hiệu ứng ra khỏi
     * cú BẤM CHIP và dời sang cú CAM KẾT (*"bấm cho vui mắt thì hiện liên tục
     * à"*) — dấu chữ ALL-IN toàn màn + loé vàng + rung cả shop nổ ở CHỐT/KHỚP
     * NGAY. Nay cả cụm toàn màn ĐÃ GỠ HẲN; thứ còn lại là phản lực của cái nút
     * (`allDang` + vòng xung `allXung`) + cột chip vàng bay lên lá + rung nặng.
     * Cú CAM KẾT trở về đúng một nhịp rung như mọi cú chốt khác.
     *
     * Vì sao gỡ đúng chỗ đó mà không phải "làm nhẹ đi": dấu toàn màn che bàn
     * 780ms VÀ ép cú chốt chờ thêm 400ms trước khi trao cho cha — nó vừa là lớp
     * phủ vừa là độ trễ, mà cả hai đều rơi vào đúng giây người chơi vừa cam kết
     * xong và đang muốn xem kết quả.
     */
    if (allIn) setAllNhip((n) => n + 1);
    if (mocBp === 10000 && chieu === 'ban') baoNhanh(`RÚT SẠCH ${moTaTen(ma).toUpperCase()}`);
    // Chip KHÔNG dính tay: thả cả chip lẫn lá.
    setChipCam(null);
    if (chonTS.includes(ma)) onChonTS(ma);
    // Chip bay: mua/khống từ hàng chip lên lá; rút từ cọc xuống hàng chip.
    const nutChip = document.querySelector(`[data-hang-chip] [data-moc="${mocBp}"]`);
    const la = document.querySelector(`[data-card="${ma}"]`);
    const coc = la?.querySelector('[data-coc]') ?? la;
    const n = allIn ? 8 : Math.max(1, Math.min(6, Math.round(mocBp / 2500)));
    if (chieu === 'ban') bayChip(coc, nutChip, n, 'lai', false);
    else bayChip(nutChip, coc, n, chieu === 'khong' ? 'lo' : allIn ? 'vang' : 'cho', allIn);
  };

  /*
   * D435 — đường nhắm ĐÍCH PHỤ mở khi Đòn Bẩy đã cấp 2 (`ganPhuDuoc`) HOẶC đúng vòng đang mua lá thứ hai (`ganPhuKhiMua` +
   * đang chọn Đòn Bẩy ở quầy). Bản trước chỉ đọc cờ thứ nhất ⇒ đúng vòng lên cấp 2, chạm mã thứ hai chỉ ĐỔI đích chính.
   */
  const ganPhuMo = vai?.ganPhuDuoc === true || (vai?.ganPhuKhiMua === true && chonCT === 'don_bay');

  const chamLaNav = (ma: string) => {
    if (!nav) return;
    if (ganCam) {
      // Đòn Bẩy cầm-chạm: chạm lá = gắn / đổi đích. Chỉ nhắm vào mã đang giữ
      // hoặc đang xếp mua (gắn vào mã không có gì là gắn vào khoảng trống).
      const coMa = (viThe[ma] ?? 0) > 0 || maDangCam.includes(ma)
        || nav.lenh.some((l) => l.ma === ma && l.chieu === 'mua');
      if (!coMa) { baoNhanh('CHƯA CẦM MÃ NÀY — GẮN VÀO ĐÂU?'); return; }
      /*
       * v34 — ĐÍCH PHỤ (Đòn Bẩy cấp 2, server khai `ganPhuDuoc`): đã có đích
       * chính ⇒ chạm mã KHÁC là nhắm đích phụ; chạm lại đích phụ đang chờ = bỏ;
       * chạm đúng đích chính = đổi đích chính như cũ.
       */
      // D435 — vòng NÂNG CẤP (chọn lại lá đang cầm): đích chính là đích vừa gắn cho lượt mua, chưa gắn thì đích CŨ của lá.
      const dichCu = doiGan?.[ganCam] ?? ganHienTai?.[ganCam] ?? null;
      const dichChinh = ganCam === chonCT ? (ganVao ?? dichCu) : dichCu;
      if (ganPhuMo && vai?.onDoiGanPhu && ganCam === 'don_bay' && dichChinh && ma !== dichChinh) {
        const phuHienTai = vai.doiGanPhu ?? vai.ganPhuHienTai ?? '';
        vai.onDoiGanPhu(phuHienTai === ma ? '' : ma);
        setGanCam(null);
        rung(NHIP_RUNG.cham);
        baoNhanh(phuHienTai === ma
          ? 'BỎ ĐÍCH PHỤ'
          : `ĐÒN BẨY NHẮM THÊM ${moTaTen(ma).toUpperCase()} (ĐÍCH PHỤ)`);
        return;
      }
      if (ganCam === chonCT) onGan(ganVao === ma ? null : ma);
      else onDoiGan?.(ganCam, ma);
      setGanCam(null);
      rung(NHIP_RUNG.cham);
      baoNhanh(`${moTaTen(ganCam).toUpperCase()} NHẮM VÀO ${moTaTen(ma).toUpperCase()}`);
      return;
    }
    if (chipCam !== null) { datLenh(ma, chipCam, 'chip-truoc'); return; }
    // Chưa cầm gì: nhấc lá lên tay (chọn/bỏ chọn); mặt RÚT chỉ hợp lá có cọc.
    if (mat === 'ban' && (viThe[ma] ?? 0) <= 0) setMat('mua');
    chonMotLa(ma);
  };

  const chamChip = (mocBp: number) => {
    if (!nav) return;
    setGanCam(null);
    if (laCam) { datLenh(laCam, mocBp, 'la-truoc'); return; }
    setChipCam((c) => (c === mocBp ? null : mocBp));
  };

  /** Chạm CỌC trên lá = lật sang mặt RÚT cho đúng mã đó. */
  const chamCoc = (ma: string) => {
    if (!nav || (viThe[ma] ?? 0) <= 0) return;
    setMat('ban');
    setChipCam(null);
    setGanCam(null);
    if (!chonTS.includes(ma)) chonMotLa(ma);
    rung(NHIP_RUNG.cham);
  };

  /*
   * ⚠ ĐỔI MẶT ⇒ TẮT NHỊP ALL-IN. `HangChip` neo `key` của chip theo `mat` LẪN
   * `allDangNhip`, nên đổi mặt là remount; mà lớp `.allDang` được dán khi
   * `allDangNhip > 0`, tức nó sẽ diễn LẠI trọn cú lún-bật-vàng + vòng xung ở
   * mặt mới dù không ai bấm ALL-IN. Đo được 23/08: bấm RÚT rồi bấm MUA là chip
   * 10.000 tự ăn mừng. Nhịp là chuyện của MỘT cú bấm, không sống qua đổi mặt.
   */
  const doiMat = (m: MatChip) => { setMat(m); setChipCam(null); setAllNhip(0); };

  /** LẶP — xếp lại y hệt các lá của vòng trước, qua đúng đường onThem. */
  const lapLenh = () => {
    if (!nav?.lenhTruoc?.length) return;
    let ok = 0;
    for (const l of nav.lenhTruoc) {
      const m: MatChip = l.chieu === 'ban' ? 'ban' : l.chieu === 'khong' ? 'khong' : 'mua';
      if (l.chieu === 'dong_khong') continue;
      if (!lenhDuoc(m, l.ma)) continue;
      nav.onThem({ ma: l.ma, chieu: l.chieu, moc_bp: l.moc_bp });
      ok++;
    }
    setChipCam(null); thaLa();
    baoNhanh(ok ? `ĐÃ XẾP LẠI ${ok} LÁ NHƯ VÒNG TRƯỚC` : 'KHÔNG XẾP LẠI ĐƯỢC — HẾT VÍ / HẾT HÀNG');
  };

  /** v54 (D403) — còn gì để đưa về tiền mặt không: cọc thường HOẶC cọc khống. */
  const coCocKhong = Object.values(viKhong).some((v) => v > 0);
  /**
   * v54 (D403) — BÁN SẠCH: một chạm đưa cả danh mục về TIỀN MẶT, thay nút BỎ đã gỡ (founder 24/09: *"cho nó thành 1
   * nút bấm nhanh để dùng ở trong shop khi muốn bán sạch tài sản đi"*). Chỉ XẾP LỆNH, qua đúng đường onXoa/onThem: gỡ
   * mọi lá đang xếp (bán sạch mà còn lệnh mua chờ thì không sạch), rồi RÚT HẾT mọi mã đang cầm + ĐÓNG KHỐNG mọi cọc
   * khống. Từng lá vẫn hiện ở hàng "đã xếp", gỡ được từng cái, và phải CHỐT VÒNG mới đi — server áp lệnh
   * (C4), phí lệnh thường, KHÔNG mất phần quỹ như cắt lỗ cũ.
   * ⚠ Mã đang CAM KẾT GIỮ được chừa lại và nói vì sao — cùng luật `datLenh` (cam kết mà một cú bấm phá được là bẫy).
   */
  const banSach = () => {
    if (!nav || vohieu) return;
    const giu = khoa?.dangChay?.ma ?? null;
    const dai = Object.keys(viThe).filter((ma) => (viThe[ma] ?? 0) > 0 && ma !== giu);
    const khong = Object.keys(viKhong).filter((ma) => (viKhong[ma] ?? 0) > 0);
    if (dai.length + khong.length === 0) {
      baoNhanh(giu ? `ĐANG CAM KẾT GIỮ ${moTaTen(giu).toUpperCase()} — KHÔNG CÒN GÌ ĐỂ BÁN` : 'CHƯA CẦM MÃ NÀO');
      return;
    }
    for (let i = nav.lenh.length - 1; i >= 0; i -= 1) nav.onXoa(i);
    for (const ma of dai) nav.onThem({ ma, chieu: 'ban', moc_bp: 10000 });
    for (const ma of khong) nav.onThem({ ma, chieu: 'dong_khong', moc_bp: 10000 });
    setChipCam(null); setGanCam(null); thaLa();
    rung(NHIP_RUNG.nang);
    baoNhanh(`BÁN SẠCH ${dai.length + khong.length} MÃ${giu ? ` · CHỪA ${moTaTen(giu).toUpperCase()} (CAM KẾT)` : ''} — CHỐT VÒNG ĐỂ ĐI LỆNH`);
    // Cọc của từng lá đổ về chính cái nút — cùng dáng bay với cú RÚT một mã (`datLenh`).
    const nut = document.querySelector('[data-ban-sach]');
    for (const ma of [...dai, ...khong]) {
      const la = document.querySelector(`[data-card="${ma}"]`);
      bayChip(la?.querySelector('[data-coc]') ?? la, nut, 3, 'lai', false);
    }
  };

  /**
   * CHỐT VÒNG có hoạt ảnh — cọc "khoá" một nhịp (dealer gạt cược) rồi mới gọi
   * cha. Cùng khuôn với `dongCoHoatAnh`: reduced-motion ⇒ gọi ngay.
   */
  const chotTimer = useRef<number | null>(null);
  useEffect(() => () => { if (chotTimer.current !== null) clearTimeout(chotTimer.current); }, []);
  /*
   * CAM KẾT (CHỐT / KHỚP NGAY) — MỘT nhịp rung, MỘT nhịp khoá cọc, không rẽ
   * nhánh theo all-in nữa (founder 22/08). Trước bản này cú chốt có ALL-IN đi
   * đường riêng: nổ dấu toàn màn + rung cả shop rồi giữ shop 700ms; nay mọi cú
   * chốt dùng chung 300ms của nhịp khoá cọc.
   */
  const chotCoHoatAnh = () => {
    if (!onChotVong || khoaCoc) return;
    if (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) { onChotVong(); return; }
    setKhoaCoc(true);
    rung(NHIP_RUNG.nang);
    chotTimer.current = window.setTimeout(() => { if (onChotVong() === false) setKhoaCoc(false); }, 300);
  };

  /*
   * ⭐⭐ D375 → D432 — MẪU SỐ CỦA HÀNG CHIP nay in trên TỪNG CHIP (`coSo` của `HangChip`), không còn là dòng chữ "CHIP TÍNH
   * TRÊN …" đứng trên hàng chip (founder 27/09: *"Quá nhiều thứ trên 1 màn hình"* — dòng ấy là bản thứ tư của cùng con số
   * tiền mặt trên màn). Ca founder 21/09 (ALL-IN của ghế tiền mặt 2.234, NAV 56.122) nay đọc thẳng trên chip: "ALL-IN 2.234",
   * còn VÍ · NAV ở đầu màn nói phần còn lại nằm ở vị thế.
   * Cơ sở theo mặt — y D375, số lấy từ bản nháp SAU HÀNG ĐỢI (đúng thứ `giaiLenhMoc` làm):
   *   · MUA: tiền mặt sau hàng đợi · KHỐNG: hạn mức khống còn (v49) hoặc tiền mặt · RÚT: vị thế của mã đang cầm;
   *   · RÚT chưa chạm mã nào ⇒ `null` — chip chỉ in phần trăm, không bịa một con số "trung bình".
   */
  const coSoChip = ((): number | null | undefined => {
    if (!nav) return undefined;
    if (mat === 'khong') return nav.khongTheoHanMuc === true ? hanMucKhongSau : tienMatSau;
    if (mat === 'ban') return laCam ? ((xemTruoc?.viTheSau ?? viThe)[laCam] ?? 0) : null;
    return tienMatSau;
  })();
  /*
   * D432 — GỢI Ý ĐẦU MÀN thay dòng mời "cầm một chip, hoặc chạm một lá" ở mép nỉ và tiêu đề "CẦM CHIP → CHẠM LÁ" (hai bản
   * của cùng một câu; bản tiêu đề trên 375px còn bị cắt thành "CẦM CH:"). Chỉ lên tiếng khi TAY đang cầm thứ gì — nói bước
   * kế tiếp; tay không thì im (vật đang cầm tự sáng: chip nhấc lên viền vàng, lá mời viền sáng).
   */
  const goiYTay = dangManChon ? null
    : ganCam ? 'CHẠM MÃ ĐỂ NHẮM'
      : chipCam !== null ? 'CHẠM MỘT MÃ'
        : laCam ? 'CHẠM MỘT CHIP' : null;
  /*
   * D432 — TAY = LÕI ĐANG NẮM + TRAIT ĐANG GIỮ (founder 27/09: *"Phần trống ra từ chỗ bỏ đi trong shop thì hiện lõi đang nắm
   * và trait đang giữ"*). Khối chỉ hiện khi có thứ để hiện: bản cũ là một hộp viền tím "TAY ? 0/6 ô · chưa cầm lá chiến
   * thuật nào" đứng suốt trận để nói "không có gì" (gu founder 13/09: hàng phụ chỉ mọc khi có nội dung).
   */
  const coLoiTay = !!chonCT || danhMuc.some((o) => o.loai === 'chien_thuat') || Object.values(viKhong).some((v) => v > 0);
  const coTraitTay = (traitDangGiu?.length ?? 0) > 0;
  const coTay = coLoiTay || coTraitTay;
  /*
   * D432 — TẤM SAU LỆNH: bảng trước → sau · lăng kính M3 (D90) · luật phí — y nguyên khối §7.4 cũ, chỉ dời từ mặt nỉ vào
   * tấm trượt mở bằng PHÍ ! ở hàng lệnh. Số chính (sau lệnh) đã in trên lá và VÍ; tấm này là tầng đọc-khi-muốn.
   */
  const khoiSauLenh = () => (nav && xemTruoc ? (
        <div className={s.xemTruoc} data-sau-lenh-bang>
          <div className={s.xtDau}>DANH MỤC SAU LỆNH</div>
          <ul className={s.xtBang}>
            {maSauLenh.map((ma) => {
              const truoc = nav.viThe[ma] ?? 0;
              const sau = xemTruoc.viTheSau[ma] ?? 0;
              return (
                <li key={ma} className={s.xtHang}>
                  <span className={s.xtTen}>{moTaTen(ma).toUpperCase()}</span>
                  <span className={s.xtTruoc}>{truoc.toLocaleString('vi-VN')}</span>
                  <span className={s.xtMuiTen}>→</span>
                  <span className={sau >= truoc ? s.xtLen : s.xtXuong}>
                    {sau.toLocaleString('vi-VN')}
                  </span>
                </li>
              );
            })}
            {maKhongSauLenh.map((ma) => {
              const truoc = nav.viKhong?.[ma] ?? 0;
              const sau = xemTruoc.viKhongSau[ma] ?? 0;
              return (
                <li key={`khong-${ma}`} className={s.xtHang} data-testid={`xt-khong-${ma}`}>
                  <span className={s.xtTen}>KHỐNG {moTaTen(ma).toUpperCase()}</span>
                  <span className={s.xtTruoc}>{truoc.toLocaleString('vi-VN')}</span>
                  <span className={s.xtMuiTen}>→</span>
                  <span className={sau >= truoc ? s.xtLen : s.xtXuong}>
                    {sau.toLocaleString('vi-VN')}
                  </span>
                </li>
              );
            })}
            <li className={`${s.xtHang} ${s.xtTienMat}`}>
              <span className={s.xtTen}>TIỀN MẶT</span>
              <span className={s.xtTruoc}>{nav.tienMat.toLocaleString('vi-VN')}</span>
              <span className={s.xtMuiTen}>→</span>
              <span className={xemTruoc.tienMatSau >= nav.tienMat ? s.xtLen : s.xtXuong}>
                {tienSauChay.toLocaleString('vi-VN')}
              </span>
            </li>
          </ul>
          {/* M3 (D90, 17/08) — TRƯỚC → SAU trên ba trục: người mới đọc được
              "lệnh này đẩy tôi từ 40% rủi ro lên 75%" mà không phải cộng nhẩm
              từng mã. MÔ TẢ, không kê đơn (A10). */}
          {taiSanCat && (
            <LangKinh
              nhan
              truoc={phanBoNav(nav.viThe, nav.tienMat, taiSanCat, nav.viKhong)}
              pb={phanBoNav(xemTruoc.viTheSau, xemTruoc.tienMatSau, taiSanCat, xemTruoc.viKhongSau)}
            />
          )}
          <div className={s.xtPhi}>
            phí mua bán <b>{(xemTruoc.phi + xemTruoc.phiCoDinh).toLocaleString('vi-VN')}</b>
            {/* v55 (D425) — SỔ MỎNG: phần phí cố định nói riêng, vì câu giải thích ngay sau (thanh khoản · cỡ lệnh)
                không đúng với nó. Mô tả, không kê đơn (A10). */}
            {xemTruoc.phiCoDinh > 0 && (
              <>
                {' (gồm '}
                <b data-testid="phi-co-dinh">{xemTruoc.phiCoDinh.toLocaleString('vi-VN')}</b>
                {' phí cố định SỔ MỎNG)'}
              </>
            )}
            {/* v51 (D346) — hai bậc: nói thẳng cái đuôi, vì đó là chỗ người chơi mất tiền mà
                không hiểu vì sao. Mô tả, không kê đơn (A10). */}
            {nav.phiLenhBac === true
              ? (
                <>
                  {' — '}
                  <b data-testid="phi-bac-1">{NGUONG_BAC.toLocaleString('vi-VN')}</b>
                  {/* v56 (D447) — trận cộng dồn: ngưỡng tính trên tổng mỗi mã trong vòng (bộ server có `daDoiMa`). */}
                  {nav.tuyChonLenh?.daDoiMa !== undefined
                    ? ' chip đầu của mỗi mã trong vòng (cộng mọi lệnh) tính giá gốc; phần vượt bị đẩy giá, càng vượt nhiều càng xấu.'
                    : ' chip đầu của mỗi lệnh tính giá gốc; phần vượt bị đẩy giá, càng vượt nhiều càng xấu.'}
                </>
              )
              : ' — mã càng ít người mua bán thì phí càng nặng, lệnh càng to phí càng nhiều.'}
            {nav.khongTheoHanMuc === true && (mat === 'khong' || nav.lenh.some((l) => l.chieu === 'khong')) && (
              <> · hạn mức khống còn <b data-testid="han-muc-khong">{hanMucKhongSau.toLocaleString('vi-VN')}</b></>
            )}
          </div>
        </div>
  ) : null);
  /* Tấm SAU LỆNH đang mở mà hàng đợi rỗng đi ⇒ đóng, đừng để nó tự bật lại ở lệnh kế tiếp. */
  useEffect(() => { if (tamHT === 'sau' && !xemTruoc) doiTam(null); }, [tamHT, xemTruoc]); // eslint-disable-line react-hooks/exhaustive-deps
  /*
   * D432 — TAY = LÕI ĐANG NẮM + TRAIT ĐANG GIỮ, một hàm cho hai chỗ: đầu nỉ bàn cược, và đầu MÀN CHỌN LÕI (founder 27/09:
   * *"Phần trống ra từ chỗ bỏ đi trong shop thì hiện lõi đang nắm và trait đang giữ"* — chọn lõi mới thì phải thấy mình
   * đang nắm gì: trùng lá là lên cấp). Màn chọn TRAIT không gọi: chợ trait có khay "ĐANG MANG" riêng — gọi nữa là in một
   * thứ hai lần.
   */
  /*
   * D569 (founder 10/10) — khối TAY LUÔN có mặt ở bàn cược, kể cả tay trắng: chỗ của lõi/trait được GIỮ từ vòng 1, nên
   * nhặt lõi đầu tiên không làm sáu lá tụt xuống (luật bàn tiền cố định, 26/09). Thay gu 13/09 "hàng phụ chỉ mọc khi có
   * nội dung" — ô trống nói một dòng: lõi tới ở vòng nào.
   */
  const khoiTay = () => (nav ? (
        /*
         * ── TAY (bàn cược, thay kho DANH MỤC ở trận nav) ──────────────────
         * Tài sản đang giữ đã hiện bằng CỌC ngay trên lá chợ, nên kho không
         * cần kể lại. Ở đây chỉ còn thứ KHÔNG nằm trên lá:
         *   · lá chiến thuật đang cầm (art + cấp) — lá ghim (Đòn Bẩy) là NÚT
         *     "cầm rồi chạm": chạm nó rồi chạm một mã trên bàn = gắn/đổi đích
         *     (thay bảng GẮN VÀO MÃ NÀO? / ĐANG NHẮM VÀO — cùng onGan/onDoiGan);
         *   · cọc KHỐNG đang mở + nút ĐÓNG (`dong_khong`, y đường cũ);
         *   · chú thích tiền cọc khống (founder 02/08) khi cầm Bán Khống.
         * `data-tap="shop-danhmuc"` giữ nguyên cho coach.
         */
        <section className={`${s.ganKhung} ${s.tay} ${s.tayGon}`} data-testid="tay-gon">
          {/*
            Founder 23/08: *"bài trên tay cũng không để text tràn lan, thu lại
            tối đa các box text và chỉ chú thích khi người chơi muốn chủ động
            đọc"*. Tiêu đề rút còn "TAY", và cái nút `?` là đường DUY NHẤT tới
            hai đoạn hướng dẫn — chúng vốn nằm thường trực dưới khối này và
            chiếm 2–4 dòng mỗi lần mở chợ, cả trận, để dạy một luật học một lần.
          */}
          <div className={s.ganDau}>
            TAY
            <span className={s.tayPhu}>{danhMuc.length}/{soO} ô</span>
            <button
              type="button"
              className={s.tayHoi}
              aria-expanded={moTayChu}
              aria-label="Cách dùng lá trên tay"
              onClick={() => { rung(NHIP_RUNG.cham); setMoTayChu((x) => !x); }}
            >
              ?
            </button>
          </div>
          {!coTay && (
            <div className={s.tayTrong} data-tay-trong>
              {vongMoTiepTheo.chien_thuat === vong || luotChon === 'loi' || luotChon === 'ca_hai'
                ? 'chưa nắm lõi — lượt chọn lõi đang mở'
                : vongMoTiepTheo.chien_thuat !== null
                  ? `chưa nắm lõi — lõi tới ở vòng ${vongMoTiepTheo.chien_thuat}`
                  : 'chưa nắm lõi nào'}
              {traitDangGiu !== undefined ? ' · chưa giữ trait' : ''}
            </div>
          )}
          {coLoiTay && (<div className={s.ganHang}>
            {(() => {
              const laTay = danhMuc.filter((o) => o.loai === 'chien_thuat');
              /*
               * D435 — chọn lại đúng lá đang cầm là NÂNG CẤP, không phải một lá mới: MỘT ô "LÊN CẤP n" giữ nguyên đích cũ.
               * Bản trước bày ô "VỪA CHỌN · MỌI MÃ" và giấu lá đang cầm ⇒ người chơi thấy mình mất luôn đích đang có.
               */
              const dangGiu = chonCT ? laTay.find((o) => o.id === chonCT) : undefined;
              const the: { id: string; ten: string; cap: number; vuaChon: boolean; nangCap: boolean }[] = [
                ...(chonCT ? [{
                  id: chonCT, ten: dangGiu?.ten ?? moTaTen(chonCT), cap: dangGiu ? dangGiu.cap + 1 : 0,
                  vuaChon: true, nangCap: dangGiu !== undefined,
                }] : []),
                ...laTay.filter((o) => o.id !== chonCT)
                  .map((o) => ({ id: o.id, ten: o.ten, cap: o.cap, vuaChon: false, nangCap: false })),
              ];
              if (the.length === 0 && Object.values(viKhong).every((v) => v <= 0)) {
                return null;
              }
              return the.map((t) => {
                const ghim = phamViThe(t.id) === 'tai_san';
                const dichCu = doiGan?.[t.id] ?? ganHienTai?.[t.id] ?? null;
                const dich = t.vuaChon ? (ganVao ?? (t.nangCap ? dichCu : null)) : dichCu;
                const dangCam = ganCam === t.id;
                const chu = t.nangCap ? `LÊN CẤP ${t.cap}` : t.vuaChon ? 'VỪA CHỌN' : t.cap > 1 ? `CẤP ${t.cap}` : '';
                const than = (
                  <>
                    {/* eslint-disable-next-line react/no-danger -- SVG hằng số trong repo */}
                    <span className={s.tayArt} dangerouslySetInnerHTML={htmlTinh(art[t.id] ?? '')} />
                    <span className={s.tayTen}>
                      {t.ten.toUpperCase()}
                      {chu && <small> {chu}</small>}
                      {ghim && (
                        <small className={s.tayDich}>
                          {' · '}
                          {dangCam ? 'chạm một mã…'
                            : dich ? `→ ${moTaTen(dich).toUpperCase()}${
                              t.id === 'don_bay' && ganPhuMo
                                ? ((vai?.doiGanPhu ?? vai?.ganPhuHienTai) ? ` + ${moTaTen((vai?.doiGanPhu ?? vai?.ganPhuHienTai)!).toUpperCase()}` : ' · chạm mã 2')
                                : ''}` : t.id === 'don_bay' ? 'MỌI MÃ · chạm để nhắm' : 'chạm rồi chạm mã'}
                        </small>
                      )}
                    </span>
                  </>
                );
                /*
                 * ⭐⭐ 24/08 — LÁ LÕI ĐÃ CẦM NAY BẤM ĐƯỢC ĐỂ ĐỌC LẠI TÁC DỤNG.
                 * Founder: *"sau khi pick lõi t cũng không có cách nào đọc lại
                 * tác dụng của lõi đó"*.
                 *
                 * Truy ra thì founder KHÔNG bỏ sót — đường ấy chưa từng tồn tại:
                 * nút (!) chỉ sống trên `GameCard` trong QUẦY, mà mục quầy chỉ
                 * render ở vòng CHỌN LÕI. Hết ba vòng chọn là cả mục biến mất
                 * cùng cái (!). Người chơi học được "lá nào cũng có (!)" rồi mất
                 * nó đúng lúc lá thành của mình.
                 * ⚠ Và trang HƯỚNG DẪN đang HỨA đúng cái nút đó ("bấm nút (!)
                 * trên lá đó trong trận là nó tự giải thích") — founder làm theo
                 * lời hướng dẫn rồi không tìm ra nút.
                 *
                 * Sửa rẻ nhất: chính lá là NÚT. Không thêm một pixel bề ngang
                 * nào (khối TAY ở 375px vốn đã chật, D118 vừa rút nó còn 23px),
                 * không art mới. Mọi mắt xích đã sẵn trong file này: state
                 * `dangGiaiThich` + overlay `TheGiaiThich` + `tuDien.chien_thuat`
                 * (đã mang đủ ĐẶC QUYỀN / XUNG ĐỘT / CỘNG HƯỞNG).
                 *
                 * ⚠ Bỏ `title={moTaChienThuat(...)}`: tooltip hover KHÔNG BAO GIỜ
                 * hiện trên màn chạm (C6 mobile-first), và nội dung nó là `mo_ta`
                 * D28 = ĐẶC ĐIỂM NGOÀI ĐỜI, cố ý cấm nhắc tác dụng game — tức kể
                 * cả rê được chuột cũng không đọc ra thứ đang hỏi.
                 */
                if (!ghim) {
                  return (
                    <button
                      key={t.id} type="button"
                      className={`${s.ganO} ${s.tayLa}`}
                      onClick={() => { rung(NHIP_RUNG.cham); setDangGiaiThich(t.id); }}
                      title="Lá này làm gì?"
                      aria-label={`Giải thích ${t.ten}`}
                    >
                      {than}
                    </button>
                  );
                }
                /*
                 * Lá GHIM (Đòn Bẩy): cú chạm của nó ĐÃ có chủ — nhắm đích ×2 —
                 * nên cửa đọc phải là một nút RIÊNG. Dùng lại đúng lớp `gc.hoi`
                 * của `GameCard` (22px, glyph chữ `!`, radius 0, không emoji).
                 * ⚠ SIBLING absolute, KHÔNG lồng trong nút lá: button lồng
                 * button là HTML không hợp lệ và cú chạm sẽ bị nuốt thành "nhắm
                 * đích" — đúng bẫy `GameCard` đã ghi khi tách dấu (!) ra ngoài.
                 * Chỉ MỘT lá trong bộ là ghim nên đây là đúng một badge, không
                 * phải thêm nhiễu cho cả hàng.
                 */
                return (
                  <span key={t.id} className={s.tayBoc}>
                    <button
                      type="button"
                      className={[s.ganO, s.tayLa, dangCam ? s.tayCam : '', dich ? s.ganChon : ''].filter(Boolean).join(' ')}
                      disabled={!!vohieu}
                      aria-pressed={dangCam}
                      title="Chạm rồi chạm một mã trên bàn để nhắm"
                      onClick={() => {
                        rung(NHIP_RUNG.cham);
                        setChipCam(null);
                        setGanCam((g) => (g === t.id ? null : t.id));
                      }}
                    >
                      {than}
                    </button>
                    <button
                      type="button"
                      className={`${gc.hoi} ${s.tayHoiLa}`}
                      onClick={() => { rung(NHIP_RUNG.cham); setDangGiaiThich(t.id); }}
                      title="Lá này làm gì?"
                      aria-label={`Giải thích ${t.ten}`}
                    >
                      !
                    </button>
                  </span>
                );
              });
            })()}
            {Object.entries(viKhong).filter(([, v]) => v > 0).map(([ma, v]) => (
              <button
                key={`k-${ma}`} type="button"
                className={`${s.ganO} ${s.tayKhong}`}
                disabled={!!vohieu}
                title="Đóng cọc khống — tiền về ví"
                onClick={() => { rung(NHIP_RUNG.cham); nav.onThem({ ma, chieu: 'dong_khong', moc_bp: 10000 }); }}
              >
                KHỐNG {moTaTen(ma).toUpperCase()} {v.toLocaleString('vi-VN')} · ĐÓNG
              </button>
            ))}
          </div>)}
          {/* D432 — TRAIT ĐANG GIỮ (v55): huy hiệu gọn, chạm để đọc luật trong trận + đặc điểm ngoài đời (khay D422). */}
          {coTraitTay && (
            <div className={s.tayTrait} data-tay-trait>
              <KhayTrait trait={traitDangGiu ?? []} gon vai={vai?.id} />
            </div>
          )}
          {/* Hai đoạn này CHỈ dựng khi người chơi bấm `?` — xem chú thích ở đó. */}
          {/* D530 — gợi ý nhắm ×2 chỉ khi tay có lá nhắm được (khoá v60 lõi chỉ trong màn: không lá nào). */}
          {moTayChu && (nav.coBanKhong ? (
            <div className={s.khongChu}>
              Mặt <b>KHỐNG</b> ở hàng chip: tiền bị trừ khỏi ví là <b>TIỀN CỌC</b>,
              chưa mất — mã <b>rơi</b> thì cọc <b>phồng lên</b>, mã <b>lên</b> thì
              nó <b>teo lại</b>. ĐÓNG là tiền về ví. Mỗi vòng giữ mất một chút phí
              thuê — cửa để <b>đánh nhanh</b>, không phải ôm cả trận.
            </div>
          ) : danhMuc.some((o) => o.loai === 'chien_thuat' && phamViThe(o.id) === 'tai_san') && (
            <div className={s.ganChu}>
              Đòn Bẩy nhân ×2 mọi mã đang cầm; chạm lá ở tay rồi chạm một mã trên bàn = dồn ×2
              vào riêng mã đó (đổi mỗi vòng, hiệu lực khi CHỐT). Lá khác là đặc quyền chức năng, không cần nhắm.
            </div>
          ))}
        </section>
  ) : null);

  /*
   * D569 (founder 10/10) — TÌNH HÌNH: thẻ VỪA LẬT ▸ ô SẮP LẬT, và DANH MỤC (lăng kính M3, trước → sau khi có lệnh xếp).
   * Ba câu người chơi cần lúc đặt chip — "tin gì vừa nổ · ô kế là gì · tôi đang nghiêng về đâu" — đứng sẵn trên nỉ thay
   * vì bắt đóng shop đọc bản đồ hoặc mở tấm SAU LỆNH. Chỗ cố định: không mọc/mất theo lệnh (bàn tiền cố định, 26/09).
   */
  const khoiTinhHinh = () => {
    if (!nav) return null;
    const vua = theLat?.vua;
    const sap = theLat?.sap;
    const truoc = taiSanCat ? phanBoNav(nav.viThe, nav.tienMat, taiSanCat, nav.viKhong) : null;
    const sau = taiSanCat && xemTruoc
      ? phanBoNav(xemTruoc.viTheSau, xemTruoc.tienMatSau, taiSanCat, xemTruoc.viKhongSau) : truoc;
    return (
      <section className={s.tinhHinh} data-tinh-hinh>
        {theLat && (
          <div className={s.theLat}>
            <div
              className={s.theLatO} data-the-lat="vua"
              {...(vua?.mau ? { style: { '--ho': vua.mau } as CSSProperties } : {})}
            >
              {/* eslint-disable-next-line react/no-danger -- SVG hằng số trong repo (art của bản đồ) */}
              {vua?.svg ? <span className={s.theLatArt} dangerouslySetInnerHTML={htmlTinh(vua.svg)} />
                : <span className={s.theLatUp} aria-hidden>?</span>}
              <span className={s.theLatChu}>
                <small>VỪA LẬT</small>
                <b>{vua?.ten ?? 'ĐANG ÚP'}</b>
              </span>
            </div>
            <span className={s.theLatMui} aria-hidden>▸</span>
            <div className={s.theLatO} data-the-lat="sap">
              <span className={s.theLatUp} aria-hidden>{sap?.glyph ?? '–'}</span>
              <span className={s.theLatChu}>
                <small>{sap ? `Ô ${sap.so}` : 'HẾT DÃY'}</small>
                <b>{sap?.nhan ?? 'KHÔNG CÒN Ô'}</b>
              </span>
            </div>
          </div>
        )}
        {truoc && sau && <LangKinh nhan truoc={truoc} pb={sau} />}
      </section>
    );
  };

  /*
   * D432 — MÀN CHỌN: nỉ mang lượt chọn (lá lõi to / chợ trait thẻ thường), đáy mang nút ĐỔI LẠI (xuống sát ngón cái — lời
   * founder 27/09) và MỘT nút chính. Luật neo đáy (04-mau-va-tuong-phan): mỗi màn một hành động chính ở đáy.
   */
  const manChon = () => {
    const laLoi = luotChon === 'loi';
    const caHai = luotChon === 'ca_hai';
    const soChonTrait = canTrait?.soChon ?? 0;
    const lech = laLoi ? 0 : (canTrait?.can ?? 0);
    const daChon = laLoi ? chonCT !== null : caHai ? chonCT !== null || soChonTrait > 0 : soChonTrait > 0;
    // Khoá theo CÂN của trait — lấy lõi mà chưa chạm trait thì không khoá.
    const khoaNut = !laLoi && soChonTrait > 0 && lech !== 0;
    const mucLoi = () => muc('chien_thuat', 'LÕI CHIẾN THUẬT', 'riêng bạn · chạm lá để đọc rồi lấy · giữ vĩnh viễn',
      chienThuat, chonCT ? [chonCT] : [], onChonCT, 1);
    return (
      <>
        <div className={`${s.ni} ${s.niChon}`} data-man="chon">
          {laLoi && coTay && khoiTay()}
          <div className={s.manChon} data-tap="man-chon" data-luot={luotChon ?? ''}>
            {laLoi ? mucLoi() : caHai ? <>{mucLoi()}{choTrait}</> : choTrait}
          </div>
        </div>
        <div className={s.dayChon} data-day-chon>
          <button
            type="button"
            className={s.nutVaoBan}
            data-tap="vao-ban"
            disabled={khoaNut}
            onClick={() => { rung(NHIP_RUNG.cham); doiBuoc('ban'); }}
          >
            {khoaNut ? `LỆCH ${soDep(lech)} — CÂN VỀ 0` : daChon ? 'VÀO BÀN CƯỢC →' : 'BỎ QUA →'}
          </button>
        </div>
      </>
    );
  };

  return (
    <div
      className={[
        s.phu, dangDong ? s.phuDong : '',
      ].filter(Boolean).join(' ')}
      role="dialog"
      aria-label="Cửa hàng"
      data-shop-pha={dangDong ? 'dong' : 'mo'}
    >
      <header className={s.dau}>
        {/* Bàn cược: ✕ đứng đầu (một tay, ngón cái), số vòng đã có bộ đếm ngoài
            bàn (founder 16/08: "không cần hiện số vòng ở trên đầu"); thay bằng
            VÍ · NAV — con số người chơi cần khi đang cầm chip. */}
        {nav ? (
          <button type="button" className={s.nutDong} onClick={dongCoHoatAnh} aria-label="Đóng">
            ✕
          </button>
        ) : (
          <span className={s.dauVong}>VÒNG {vong}</span>
        )}
        {/*
          v34 — VAI CỦA BẠN. Founder 23/08: *"vào trận thì thu nhỏ nó lại chỉ còn
          1 icon pixel ở trong chợ đại diện cho role và nếu quên chức năng/role thì
          có thể bấm vào để đọc"*.
          Khối cũ ngồi thường trực và ăn ~140px MỖI LẦN mở chợ, cả trận, để nói một
          điều CHỈ ĐỔI MỘT LẦN duy nhất (vai bốc lúc tạo bàn, D107 — không chọn,
          không đổi giữa trận). Nay: một nút icon + tên; chi tiết QUYỀN/GIÁ chỉ mở
          khi người chơi CHỦ ĐỘNG chạm. Phần giới thiệu to đã dời sang màn chào 5s
          đầu trận (`ChaoVai`), nơi nó không tranh chỗ với việc gì.
          Chữ vẫn từ server (catalog `vai`) — không gõ lại (D61).
        */}
        {vai && (
          <div className={s.vaiKhoi} data-testid="vai-cua-ban" data-vai={vai.id}>
            <button
              type="button"
              className={s.vaiNut}
              aria-expanded={moVai}
              onClick={() => { rung(NHIP_RUNG.cham); setMoVai((x) => !x); }}
            >
              <PixelIcon name={ICON_VAI[vai.id] ?? 'user'} size={16} />
              {/* D432 — founder 23/08: *"chỉ còn 1 icon pixel … bấm vào để đọc"*. Tên vẫn trong nút (tên truy cập được) nhưng
                  không chiếm bề ngang — chỗ ấy nay cho VÍ → sau lệnh. Mở ra thì tên đứng đầu tờ. */}
              <span className={`${s.vaiTen} ${s.vaiTenAn}`}>{vai.ten}</span>
              <span className={s.vaiMo} aria-hidden>{moVai ? '▴' : '▾'}</span>
            </button>
            {moVai && (
              <div className={s.vaiChiTiet}>
                <span className={s.vaiNhan}>VAI</span>
                <span className={s.vaiChu}>{vai.ten}</span>
                <span className={s.vaiNhan}>QUYỀN</span>
                <span className={s.vaiChu}>{vai.dacQuyen}</span>
                <span className={s.vaiNhan}>GIÁ</span>
                <span className={`${s.vaiChu} ${s.vaiGia}`}>{vai.caiGia}</span>
              </div>
            )}
          </div>
        )}
        <span className={s.dauNhip}>
          {/* Hàng đầu màn cao 40px nên lưới ổ khoá 16px đứng vừa, khác hẳn nhãn
              "CHUNG BÀN" ở hàng 22px bên dưới. */}
          {daAllIn ? (
            <>
              <PixelIcon name="lock" size={16} />
              {`ĐÃ ${T_DON_HET_UPPER} — KHOÁ THẺ TỚI HẾT TRẬN`}
            </>
          /*
           * D321 — đầu màn nay gánh thêm chip VAI (dời từ khối riêng lên), nên tiêu
           * đề vòng phải NGẮN: trên 375px, chữ dài tràn đè lên chip vai và VÍ (đo
           * 13/09). Nghĩa giữ nguyên; "vòng này"/"mở mọi vòng" đã nói ở mục dưới.
           */
          ) : !nav ? (loaiVongNay === 'chien_thuat' ? 'CHỌN 1 LÕI'
            /*
             * Vòng 'khong' KHÔNG còn là "không lấy thẻ": chợ tài sản mở mọi
             * vòng (spec 01 §7). Chữ cũ nói dối người chơi ở vòng 7·8.
             */
            : 'CHỢ TÀI SẢN — MỞ MỌI VÒNG')
            /* D432 — trận nav: không tiêu đề thường trực; chỉ gợi ý bước kế khi tay đang cầm (xem `goiYTay`). */
            : goiYTay}
        </span>
        {dongHo && !dongHo.tamDung && (
          <span
            className={[s.dauGio, dongHo.hetGio ? s.dauGioHet : dongHo.conLai <= NGUONG_KHAN_S ? s.dauGioKhan : dongHo.conLai <= NGUONG_GAP_S ? s.dauGioGap : ''].filter(Boolean).join(' ')}
            data-testid="shop-dong-ho"
            aria-live="polite"
          >
            {dongHo.hetGio ? 'HẾT GIỜ' : `${dongHo.conLai}s`}
          </span>
        )}
        {nav ? (
          <span className={s.dauVi} data-tap="shop-vi">
            VÍ <b>{tienMatChay.toLocaleString('vi-VN')}</b>
            {/* D432 — tiền mặt SAU hàng đợi đứng ngay cạnh, màu "đang xếp" (thay dòng TIỀN MẶT của bảng sau lệnh cũ). */}
            {xemTruoc && xemTruoc.tienMatSau !== nav.tienMat && (
              <b className={s.viSau} data-vi-sau>→{tienSauChay.toLocaleString('vi-VN')}</b>
            )}
            {' · NAV '}
            <b>
              {(nav.tienMat
                + Object.values(nav.viThe).reduce((a, b) => a + b, 0)
                + Object.values(nav.viKhong ?? {}).reduce((a, b) => a + b, 0)
              ).toLocaleString('vi-VN')}
            </b>
          </span>
        ) : (
          <button type="button" className={s.nutDong} onClick={dongCoHoatAnh} aria-label="Đóng">
            ✕
          </button>
        )}
      </header>

      {/* ── D321 — MẶT NỈ: lấp hết chỗ giữa đầu màn và rack, không cuộn.
          Thứ tự: cảnh báo · TAY gọn · lá kỹ năng (dealer chia lên nỉ) · SÁU Ô
          CƯỢC (phình) · xem trước · cam kết. Sáu mã lên GIỮA màn — chỗ trước
          đây là khoảng trống founder chỉ (13/09) — và chip đang giữ nằm ngay
          trên ô (CocChip) nên không cần dải "đang giữ" riêng. */}
      {dangManChon && manChon()}
      {!dangManChon && (<>
      <div className={s.ni}>
      {mandateLoi && (
        <div className={s.mandateLoi} role="alert" data-testid="mandate-loi">
          {mandateLoi === 'mandate_ma'
            ? `MANDATE — không mua mã nào quá ${Math.round((vai?.mandate?.tran_ma_bp ?? 4000) / 100)}% NAV. Chuỗi này sẽ bị từ chối: chia chip ra nhiều mã.`
            : 'MANDATE — tổ chức không được Bán Khống. Bỏ lệnh khống khỏi chuỗi.'}
        </div>
      )}
      {/* D342 — cùng khuôn dòng MANDATE: lỗi chắc chắn của chuỗi, nói TRƯỚC khi chốt. */}
      {loiChuoi && (
        <div className={s.mandateLoi} role="alert" data-testid="chuoi-loi" data-loi={loiChuoi}>
          {`CHUỖI NÀY SẼ BỊ TỪ CHỐI CẢ CHUỖI — ${chuLoiLenh(loiChuoi)}`}
        </div>
      )}
      {/*
        D342 — LỆNH VÒNG VỪA CHỐT BỊ BÁC. Hiện tới khi người chơi bắt đầu xếp lệnh mới: nó là
        chuyện của vòng trước, đứng mãi thì thành nhiễu che dòng lỗi của chuỗi đang xếp.
      */}
      {nav?.loiLenhVongTruoc && nav.lenh.length === 0 && (
        <div className={s.mandateLoi} role="status" data-testid="loi-lenh-vong-truoc">
          {`LỆNH VÒNG TRƯỚC KHÔNG KHỚP, VỊ THẾ GIỮ NGUYÊN — ${chuLoiLenh(nav.loiLenhVongTruoc)}`}
        </div>
      )}

      {nav && khoiTinhHinh()}
      {nav ? khoiTay() : (
        <section className={s.kho}>
          <header className={s.khoDau}>
            <span className={s.mucTen}>DANH MỤC</span>
            <span className={s.mucPhu}>
              {`${danhMuc.length}/${soO} ô · trùng lá = nâng cấp`}
            </span>
          </header>
          <div className={s.khoHai}>
            {nhomDanhMuc('tai_san', 'TÀI SẢN', sucChuaTaiSan)}
            <div className={s.vline} />
            {nhomDanhMuc('chien_thuat', 'CHIẾN THUẬT', sucChuaChienThuat)}
          </div>
        </section>
      )}

      {/*
        ⚠ CHIẾN THUẬT KIỂU LÕI TFT (founder 27/07, spec 01 §4.4): mục chỉ RENDER
        đúng vòng chọn, không còn khối cố định bị xám chờ tới lượt. Founder:
        *"chiến thuật không còn khóa cứng vị trí xuất hiện trong shop nữa mà chỉ
        hiện lên khi đến vòng (Đúng như tính năng chọn lõi trong TFT)"*.

        Ngoài vòng chọn chỉ còn MỘT DÒNG hẹn giờ — người chơi vẫn biết lõi kế
        tiếp ở vòng nào (không giấu thông tin nhịp trận), nhưng shop không phí
        một phần ba màn hình cho thứ không bấm được. Hết cả ba lượt thì thôi hẳn:
        một dòng hẹn không bao giờ tới là một lời hứa sai.
      */}
      {/* D432 — trận nav: lượt chọn lõi / chợ trait nằm ở MÀN CHỌN (`manChon`), lời hẹn lõi kế thành nhãn ở đầu mục TÀI SẢN.
          Trận cũ (không nav) giữ nguyên. */}
      {!nav && (loaiVongNay === 'chien_thuat' ? muc(
        'chien_thuat', 'LÕI CHIẾN THUẬT', 'riêng bạn · lấy 1 · giữ vĩnh viễn',
        chienThuat, chonCT ? [chonCT] : [], onChonCT, 1,
      ) : vongMoTiepTheo.chien_thuat !== null && (
        <div className={s.henLoi}>
          ◆ LÕI CHIẾN THUẬT tiếp theo: vòng {vongMoTiepTheo.chien_thuat}
        </div>
      ))}

      {muc(
        'tai_san', 'TÀI SẢN',
        // D432 — trận nav bỏ phụ đề: "cả bàn thấy chung 6 mã · lấy 1" là giải thích thường trực, và vế "lấy 1" SAI ở bàn
        // cược (đặt chip được lên nhiều mã một vòng).
        nav ? '' : `cả bàn thấy chung ${taiSan.length} mã · lấy ${toiDaTaiSan}`,
        taiSan, chonTS, onChonTS, toiDaTaiSan,
      )}
      {/* ── BÀN CƯỢC (nav): panel mốc · hàng khống · lá đã xếp của v10/v17 đã
          DỜI XUỐNG HÀNG CHIP dán đáy (`HangChip`, cuối cây) — 16/08, thiết kế 07.
          Cùng lệnh, cùng đường onThem/onXoa; chỉ đổi chỗ đứng và
          ngữ pháp (cầm rồi chạm thay vì chạm mã → panel → chạm mốc). */}

      {/*
        ── D432 — BẢNG "DANH MỤC SAU LỆNH" RỜI MẶT NỈ (founder 27/09: *"Quá nhiều thứ trên 1 màn hình"*). Xếp MỘT lệnh là tiền
        mặt in bốn lần (VÍ · dòng TIỀN MẶT · lăng kính · dòng mẫu số) và lệnh vừa đặt hiện bốn chỗ (tag · cọc · dòng mã · dòng
        mẫu số). Nay số SAU LỆNH in lên CHÍNH vật: lá (trước→sau), VÍ (→sau); PHÍ đứng đầu hàng lệnh — vẫn thấy giá trước khi
        trả (§7.4) — và `!` của nó mở tấm SAU LỆNH (`khoiSauLenh`: bảng trước→sau, lăng kính, luật phí).
      */}
      {/* ── D3 — GẮN THẺ VÀO MỘT MÃ (trận cũ) ─────────────────────────────
          Chỉ hỏi khi thẻ đang chọn có phạm vi 'tai_san' VÀ người chơi đang cầm
          mã nào đó. Chưa cầm mã nào mà bắt chọn thì đó là ô trống không trả lời
          được — lúc ấy thẻ mua không gắn và tác động toàn danh mục như trước.
          ⚠ Trận nav: gắn bằng "cầm rồi chạm" ở TAY (bên dưới), không hiện bảng. */}
      {!nav && chonCT && phamViThe(chonCT) === 'tai_san' && maDangCam.length > 0 && (
        <div className={s.ganKhung}>
          <div className={s.ganDau}>GẮN VÀO MÃ NÀO?</div>
          <div className={s.ganHang}>
            {maDangCam.map((ma) => (
              <button
                key={ma}
                type="button"
                className={`${s.ganO} ${ganVao === ma ? s.ganChon : ''}`}
                onClick={() => onGan(ganVao === ma ? null : ma)}
                aria-pressed={ganVao === ma}
              >
                {ma.toUpperCase()}
              </button>
            ))}
          </div>
          <div className={s.ganChu}>
            {ganVao
              ? 'Thẻ chỉ tác động lên mã này. Ghép cặp trên CÙNG một mã thì cộng '
                + 'hưởng ăn đủ — mà xung đột cũng đủ.'
              : 'Không gắn cũng được: thẻ tác động lên cả danh mục như cũ.'}
          </div>
        </div>
      )}

      {/* ── ĐỔI ĐÍCH THẺ GHIM ĐANG CẦM (founder 02/08, thi hành D40) ─────
          "chọn xong gán được đúng 1 lần, sau đó chả biết gán lại kiểu gì" —
          server nhận đổi `gan` mỗi vòng từ lâu, đây là đường bấm còn thiếu.
          Đổi có hiệu lực khi CHỐT VÒNG (đi cùng dòng log của vòng, C4).
          ⚠ Trận nav: đổi đích bằng "cầm rồi chạm" ở TAY — bảng này chỉ trận cũ. */}
      {!nav && onDoiGan && maDangCam.length > 0 && danhMuc
        .filter((o) => o.loai === 'chien_thuat' && o.id !== chonCT
          && phamViThe(o.id) === 'tai_san')
        .map((the) => {
          const dangCho = doiGan?.[the.id];
          const hienTai = ganHienTai?.[the.id];
          const dich = dangCho ?? hienTai;
          return (
            <div key={the.id} className={s.ganKhung}>
              <div className={s.ganDau}>{the.ten.toUpperCase()} ĐANG NHẮM VÀO</div>
              <div className={s.ganHang}>
                {maDangCam.map((ma) => (
                  <button
                    key={ma}
                    type="button"
                    className={`${s.ganO} ${dich === ma ? s.ganChon : ''}`}
                    onClick={() => onDoiGan(the.id, ma)}
                    aria-pressed={dich === ma}
                    disabled={vohieu}
                  >
                    {ma.toUpperCase()}
                  </button>
                ))}
              </div>
              <div className={s.ganChu}>
                {dangCho
                  ? `Đổi sang ${dangCho.toUpperCase()} khi CHỐT VÒNG — bấm lại mã đó để giữ như cũ.`
                  : hienTai
                    ? 'Bấm mã khác để đổi đích từ lần chốt vòng này.'
                    : 'Chưa nhắm mã nào — hiệu ứng trải cả danh mục. Bấm một mã để dồn vào nó.'}
              </div>
            </div>
          );
        })}

      {canhBao && (
        // Không icon cảnh báo: U+26A0 là ví dụ chuẩn của luật 4 (tam giác đơn
        // sắc trên Windows, tam giác MÀU trên iPhone). Khung đỏ + chữ đỏ đã là
        // tín hiệu cảnh báo, thêm một hình nữa chỉ nói lại lần hai.
        <div className={s.canhBao}>
          {canhBao.nhan} đánh nhau với {canhBao.nhan_xung_dot} — hai thẻ triệt
          tiêu nhau và bào vốn mỗi vòng.
        </div>
      )}

      {/*
        Tờ giải thích nằm CUỐI cây và là lớp phủ riêng (z-index cao hơn shop):
        shop vốn đã là lớp phủ toàn màn, nên chèn tờ này vào giữa các dải sẽ đẩy
        bố cục "trọn một khung hình" mà founder chốt.
      */}
      {!nav && onChotVong && (
        <button
          type="button"
          className={s.nutChotShop}
          data-tap="shop-chot"
          onClick={onChotVong}
        >
          CHỐT VÒNG — xác nhận lệnh đã xếp
        </button>
      )}

      {/*
        ── CAM KẾT GIỮ ─────────────────────────────────────────────────────
        Một LỰA CHỌN cạnh cú mua, không phải một thao tác bắt buộc: không bấm
        thì không có gì xảy ra, và trận chạy y như trước. Chỉ hiện khi có thứ
        để nói — đang cam kết, hoặc đang cầm một lá mà vòng này khoá kịp chốt.
      */}
      {nav && khoa && (khoa.dangChay || (khoa.duoc && laCam)) && (
        <div
          className={khoa.dangChay ? `${s.camKet} ${s.camKetChay}` : s.camKet}
          data-tap="shop-cam-ket"
        >
          {khoa.dangChay ? (
            <>
              <span className={s.camKetNhan}>
                🔒 ĐANG CAM KẾT GIỮ {moTaTen(khoa.dangChay.ma).toUpperCase()}
              </span>
              <span className={s.camKetPhu}>
                {khoa.dangChay.la_vong_chot
                  ? 'VÒNG CHỐT — giữ hết vòng này là xong lời hứa'
                  : `còn ${khoa.dangChay.con_vong} vòng · KHÔNG rút được mã này`}
              </span>
            </>
          ) : (
            <>
              <button
                type="button"
                className={khoa.chon === laCam ? `${s.nutCamKet} ${s.nutCamKetBat}` : s.nutCamKet}
                onClick={() => khoa.onChon(khoa.chon === laCam ? null : laCam)}
              >
                {khoa.chon === laCam ? '🔒 ĐÃ CHỌN CAM KẾT' : `🔒 CAM KẾT GIỮ ${khoa.soVong} VÒNG`}
              </button>
              <span className={s.camKetPhu}>
                {khoa.chon === laCam
                  ? `${moTaTen(laCam!).toUpperCase()} — chốt vòng là khoá; trong ${khoa.soVong} vòng KHÔNG rút được`
                  : `${moTaTen(laCam!).toUpperCase()} — đổi lấy trượt giá nhẹ hơn và thưởng nếu trụ qua bão`}
              </span>
            </>
          )}
        </div>
      )}

      {/*
        ── NGÂN HÀNG (v43) ──────────────────────────────────────────────────
        Cùng khe với CAM KẾT GIỮ ngay trên, và hai thứ KHÔNG BAO GIỜ cùng hiện:
        v43 bật `khoaTaiSanTat` thì `khoa.duoc` luôn false và `khoa.dangChay`
        luôn null, nên dải trên tự tắt. Không cần một điều kiện loại trừ ở đây —
        thêm nó là dựng luật thứ hai cho cùng một sự thật (D61).
      */}
      {/* ── v55 (D409) — CHỐT LỜI TRONG Ô: cùng khe với NGÂN HÀNG, chỉ hiện khi cha đưa node. (Nút mở CHỢ TRAIT ở đây gỡ ở
          D430 — chợ nay đứng sẵn ở chỗ hàng lõi.) */}
      {nav && chotLoi}
      </div>{/* /.ni */}

      {/* ── HÀNG CHIP dán đáy — bàn cược (nav) ────────────────────────── */}
      {nav && (
        <HangChip
          phieuTrenThe
          mat={mat}
          onDoiMat={doiMat}
          coBanKhong={nav.coBanKhong === true}
          coCocRut={coCocRut}
          buocMocBp={nav.buocMocBp}
          mocChoPhep={nav.mocChoPhep}
          coSo={coSoChip}
          phi={xemTruoc ? xemTruoc.phi + xemTruoc.phiCoDinh : undefined}
          onXemSau={() => { doiTam(tamHT === 'sau' ? null : 'sau'); }}
          chipCam={chipCam}
          onChamChip={chamChip}
          chipVoHieu={!lenhDuoc(mat, laCam)}
          allDangNhip={allNhip}
          onNganHang={nganHang ? () => { rung(NHIP_RUNG.cham); doiTam(tamHT === 'bank' ? null : 'bank'); } : undefined}
          nganHangMo={tamHT === 'bank'}
          lenh={nav.lenh}
          tenMa={moTaTen}
          onXoa={nav.onXoa}
          vohieu={!!vohieu}
          khopLoi={nav.khopLoi}
          onChotVong={onChotVong ? chotCoHoatAnh : undefined}
          lapDuoc={nav.lenh.length === 0 && (nav.lenhTruoc?.length ?? 0) > 0}
          onLap={lapLenh}
          onBanSach={nav.banSach === true && (coCocRut || coCocKhong) ? banSach : undefined}
        />
      )}
      </>)}

      {/* ── D321 — TẤM TRƯỢT NGÂN HÀNG. Khối v43 (`nganHang`, có neo coach
          `ngan-hang` / `ngan-hang-ky`) không còn chiếm chiều cao thường trực;
          mở bằng nút 🏦 ở hàng TAY hoặc coach dàn cảnh (`tam: 'bank'`). Nội
          dung y nguyên node cha truyền — không dựng lại (D61). */}
      {nav && nganHang && tamHT === 'bank' && (
        <>
          <div className={s.tamNen} onClick={() => doiTam(null)} aria-hidden="true" />
          <div className={s.tam} role="dialog" aria-label="Ngân hàng" data-tam="bank">
            <div className={s.tamKeo} aria-hidden="true" />
            {nganHang}
            <button type="button" className={s.tamDong} onClick={() => doiTam(null)}>XONG</button>
          </div>
        </>
      )}


      {/* D432 — TẤM SAU LỆNH (mở bằng PHÍ ! ở hàng lệnh): cùng khuôn tấm trượt ngân hàng. */}
      {nav && tamHT === 'sau' && xemTruoc && (
        <>
          <div className={s.tamNen} onClick={() => doiTam(null)} aria-hidden="true" />
          <div className={s.tam} role="dialog" aria-label="Danh mục sau lệnh" data-tam="sau">
            <div className={s.tamKeo} aria-hidden="true" />
            {khoiSauLenh()}
            <button type="button" className={s.tamDong} onClick={() => doiTam(null)}>XONG</button>
          </div>
        </>
      )}

      {/* Nhắn nổi — chỉ trang trí, không chở thông tin nào mà màn không hiện
          chỗ khác (D26/R1 sạch).
          ⚠ Hai lớp toàn màn (`.loe` loé vàng + `.dauAll` chữ ALL-IN) ĐÃ GỠ
          22/08 theo chỉ thị founder — xem chú thích ở `chamChip`. */}
      {thongBao && (
        <div key={thongBao.n} className={s.thongBao} role="status">{thongBao.chu}</div>
      )}

      {dangGiaiThich && (() => {
        const idThe = dangGiaiThich;
        const tenThe = [...taiSan, ...chienThuat].find((t) => t.id === idThe)?.ten
          ?? danhMuc.find((o) => o.id === idThe)?.ten
          ?? idThe;
        return (
          <TheGiaiThich
            ten={tenThe}
            moTa={moTaChienThuat(idThe)}
            taiSan={tuDien.tai_san[idThe]}
            chienThuat={tuDien.chien_thuat[idThe]}
            idThe={idThe}
            tenChienThuat={(id) => moTaTen(id)}
            giaiDoan={giaiDoanNhan}
            suKien={suKienNhan}
            onDong={() => setDangGiaiThich(null)}
            /* D526 — mở từ MÀN CHỌN lõi ⇒ tờ là bảng xác nhận: ĐÓNG (không lấy) · LẤY. */
            {...(dangManChon && luotChon !== 'trait' && !khoaHet && loaiVongNay === 'chien_thuat'
              && chienThuat.some((t) => t.id === idThe) ? {
                lay: {
                  trangThai: chonCT === idThe ? 'da_lay' as const : chonCT !== null || vohieu ? 'het' as const : 'lay' as const,
                  onLay: () => { rung(NHIP_RUNG.cham); onChonCT(idThe); setDangGiaiThich(null); },
                },
              } : {})}
          />
        );
      })()}
    </div>
  );
}
