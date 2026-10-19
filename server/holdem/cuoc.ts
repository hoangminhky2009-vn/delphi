/**
 * VÒNG CƯỢC TUẦN TỰ — máy trạng thái thuần, không I/O, không thời gian.
 *
 * Thay cho mô hình CAM KẾT ĐỒNG THỜI cũ. Ba thứ mô hình cũ không có mà poker
 * bắt buộc phải có:
 *
 *   1. THEO LÀ MỘT LỰA CHỌN. Cũ: bấm "giữ" mà đối thủ tố 4000 thì bị trừ 4000
 *      dù chưa hề đồng ý. Nay: đối thủ tố xong mới tới lượt mình, và mình
 *      chọn theo / tố lại / bỏ.
 *   2. TỐ LẠI. Vòng cược chỉ đóng khi mọi người còn sống đã góp BẰNG NHAU và
 *      đã được hành động ít nhất một lần kể từ cú tố gần nhất.
 *   3. ALL-IN KHÔNG ĐỦ GIÁ. Cũ: không đủ tiền theo thì bị đá ra. Nay: dồn hết
 *      những gì có, và `pot.ts` tách pot phụ cho đúng.
 *
 * ─── VÌ SAO KHÔNG CÓ THỜI GIAN Ở ĐÂY ───────────────────────────────────────
 * Đồng hồ (độ trễ bot / đếm ngược người thật) nằm ở TẦNG TRÊN. Module này chỉ
 * biết chuỗi hành động. Nhờ vậy tính tất định không phụ thuộc đồng hồ: quá hạn
 * thì tầng trên ghi một hành động mặc định VÀO log rồi gọi xuống đây như bình
 * thường. Replay luôn ra cùng kết quả.
 */

export type LoaiHanhDong = 'theo' | 'to' | 'bo';

export interface GheCuoc {
  id: string;
  /** Vốn CÒN LẠI (chưa trừ phần đã góp trong vòng cược này). */
  von: number;
}

export interface TrangThaiCuoc {
  /** Mức phải góp để còn trong vòng. */
  gia: number;
  /** Ghế → đã góp bao nhiêu trong VÒNG CƯỢC này. */
  gop: Map<string, number>;
  daBo: Set<string>;
  allIn: Set<string>;
  /** Thứ tự hành động, cố định cả vòng. */
  thuTu: string[];
  /** Ghế đang tới lượt; null = vòng cược đã đóng. */
  luot: string | null;
  /** Ai đã hành động kể từ cú tố gần nhất — dùng để biết khi nào đóng vòng. */
  daHanhDong: Set<string>;
  /** Vốn còn lại của từng ghế sau khi trừ phần đã góp. */
  vonConLai: Map<string, number>;
}

export class LoiCuoc extends Error {}

/**
 * Mở vòng cược: mọi ghế còn sống đóng cược nền (ante) trước, rồi tới lượt.
 * Ai không đủ cược nền thì all-in luôn phần còn lại.
 */
export function moVongCuoc(ghe: readonly GheCuoc[], cuocNen: number): TrangThaiCuoc {
  const gop = new Map<string, number>();
  const vonConLai = new Map<string, number>();
  const allIn = new Set<string>();

  for (const g of ghe) {
    const dong = Math.min(cuocNen, g.von);
    gop.set(g.id, dong);
    vonConLai.set(g.id, g.von - dong);
    if (g.von <= cuocNen) allIn.add(g.id);
  }

  const thuTu = ghe.map((g) => g.id);
  const tt: TrangThaiCuoc = {
    gia: cuocNen,
    gop,
    daBo: new Set(),
    allIn,
    thuTu,
    luot: null,
    daHanhDong: new Set(),
    vonConLai,
  };
  tt.luot = timLuotKe(tt, -1);
  return tt;
}

/** Ai có thể còn phải hành động: chưa bỏ, chưa all-in. */
function conPhaiHoi(tt: TrangThaiCuoc, id: string): boolean {
  return !tt.daBo.has(id) && !tt.allIn.has(id);
}

/** Ghế kế tiếp cần hỏi, tính từ vị trí `tu` trong thứ tự. null nếu đóng vòng. */
function timLuotKe(tt: TrangThaiCuoc, tu: number): string | null {
  for (let b = 1; b <= tt.thuTu.length; b += 1) {
    const id = tt.thuTu[(tu + b) % tt.thuTu.length]!;
    if (!conPhaiHoi(tt, id)) continue;
    // Còn nợ tiền → chắc chắn phải hỏi. Đã đủ tiền nhưng chưa hành động kể từ
    // cú tố gần nhất → vẫn phải hỏi (quyền check hoặc tố lại).
    if ((tt.gop.get(id) ?? 0) < tt.gia || !tt.daHanhDong.has(id)) return id;
  }
  return null;
}

/** Vòng cược đã đóng chưa. */
export function daDongVong(tt: TrangThaiCuoc): boolean {
  return tt.luot === null;
}

/** Những gì ghế đang tới lượt được phép làm. */
export function duocLam(tt: TrangThaiCuoc): {
  ghe_id: string; gia_phai_theo: number; con_thieu: number;
  duoc: LoaiHanhDong[]; to_toi_thieu: number; to_toi_da: number;
} | null {
  const id = tt.luot;
  if (!id) return null;
  const daGop = tt.gop.get(id) ?? 0;
  const conLai = tt.vonConLai.get(id) ?? 0;
  const thieu = Math.max(0, tt.gia - daGop);
  const duoc: LoaiHanhDong[] = ['theo', 'bo'];
  // Còn tiền dư sau khi theo thì mới tố lại được.
  if (conLai > thieu) duoc.push('to');
  return {
    ghe_id: id,
    gia_phai_theo: tt.gia,
    con_thieu: Math.min(thieu, conLai),
    duoc,
    to_toi_thieu: thieu + 1,
    to_toi_da: conLai,
  };
}

/**
 * Thực hiện một hành động. Trả trạng thái MỚI (không sửa tại chỗ).
 *
 * `them` (chỉ dùng với 'to') = số chip bỏ THÊM vào lần này. Cú tố hợp lệ phải
 * đẩy tổng góp VƯỢT giá hiện tại — nếu không thì nó là "theo" trá hình.
 *
 * ⚠ Bản đầu âm thầm kẹp `them` lên bằng mức theo: tố 3000 trong khi phải theo
 * 4000 thì thành... theo 4000, không báo gì. Im lặng biến TỐ thành THEO là lớp
 * lỗi tệ nhất — người chơi tưởng mình vừa gây áp lực, thực ra chỉ trả tiền.
 * Nay ném lỗi rõ ràng. Ngoại lệ: dồn hết vốn mà vẫn không đủ vượt giá thì đó
 * là ALL-IN hợp lệ, coi như theo.
 */
export function hanhDong(
  tt: TrangThaiCuoc, gheId: string, loai: LoaiHanhDong, them = 0,
): TrangThaiCuoc {
  if (tt.luot !== gheId) {
    throw new LoiCuoc(`Chưa tới lượt ghế "${gheId}" (đang chờ "${tt.luot ?? 'không ai'}")`);
  }

  const moi: TrangThaiCuoc = {
    ...tt,
    gop: new Map(tt.gop),
    daBo: new Set(tt.daBo),
    allIn: new Set(tt.allIn),
    daHanhDong: new Set(tt.daHanhDong),
    vonConLai: new Map(tt.vonConLai),
  };
  const daGop = moi.gop.get(gheId) ?? 0;
  const conLai = moi.vonConLai.get(gheId) ?? 0;
  moi.daHanhDong.add(gheId);

  if (loai === 'bo') {
    moi.daBo.add(gheId);
  } else {
    if (loai === 'to') {
      const donAllIn = daGop + conLai <= moi.gia;   // dồn hết vẫn không vượt nổi
      if (!donAllIn && daGop + them <= moi.gia) {
        throw new LoiCuoc(
          `Tăng ${them} không hợp lệ: phải vượt giá ${moi.gia} (đã góp ${daGop}, `
          + `cần hơn ${moi.gia - daGop}). Muốn theo thì dùng 'theo'.`);
      }
    }
    // Bao nhiêu chip thực sự rời túi lần này.
    const muon = loai === 'to' ? them : moi.gia - daGop;
    const thuc = Math.max(0, Math.min(muon, conLai));
    moi.gop.set(gheId, daGop + thuc);
    moi.vonConLai.set(gheId, conLai - thuc);
    if (conLai - thuc === 0) moi.allIn.add(gheId);

    const gopMoi = daGop + thuc;
    if (gopMoi > moi.gia) {
      // Đây là một cú TỐ (kể cả all-in vượt giá) → mọi người phải được hỏi lại.
      moi.gia = gopMoi;
      moi.daHanhDong = new Set([gheId]);
    }
  }

  // Chỉ còn ≤1 ghế chưa bỏ → vòng đóng ngay, không hỏi tiếp.
  const conSong = moi.thuTu.filter((id) => !moi.daBo.has(id));
  if (conSong.length <= 1) {
    moi.luot = null;
    return moi;
  }

  moi.luot = timLuotKe(moi, moi.thuTu.indexOf(gheId));
  return moi;
}

/** Tổng tiền đang nằm trong vòng cược này. */
export function tongGop(tt: TrangThaiCuoc): number {
  let s = 0;
  for (const v of tt.gop.values()) s += v;
  return s;
}
