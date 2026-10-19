/**
 * LỜI ORACLE — linh vật biết NÓI (founder 22/08: *"làm con linh vật hữu dụng hơn
 * đi =)) để nó giục người chơi chơi đủ số trận để lấy chỉ số phân tích hoặc là
 * khịa hoặc khen người chơi từ chỉ số phân tích được"*).
 *
 * Trước đây Oracle là một SVG đứng ở Hub, không nói gì. Nay mỗi lần mở Hub / Tài
 * chính nó nói ĐÚNG MỘT câu, chọn theo ưu tiên:
 *   1. chưa đăng nhập / chưa chơi  → MỜI
 *   2. chưa gói nào đầy            → GIỤC đúng thứ đang thiếu (trận · vòng quyết ·
 *                                    vòng sự kiện) — không "chơi nhiều lên" chung chung
 *   3. có gói                      → KHEN / KHỊA từ chỉ số: bậc đọc, xu hướng Brier,
 *                                    nét (lạnh ↔ bị kết quả / bên ngoài điều khiển),
 *                                    đổi thẻ giữa hai gói
 * Nhiều câu cùng hợp lệ thì xoay theo NGÀY (`hat`) để không nói một câu mãi.
 *
 * ─── LUẬT ───────────────────────────────────────────────────────────────────
 * · A10 — mô tả, không kê đơn: khịa là khịa HÀNH VI ĐÃ ĐO, kết bằng câu hỏi hoặc
 *   câu đùa; không "nên/hãy/đừng/phải". Test quét mọi câu ở cả ba giọng.
 * · §1.2 — KHẨU VỊ (để dành · dồn · rải · mức tiền mặt) KHÔNG BAO GIỜ bị khen hay
 *   khịa: đó là trục app đang ĐO, khen/khịa là làm người chơi diễn. Oracle chỉ
 *   nói về KỸ NĂNG (đọc) và về NÉT (cái gì đang cầm lái) — test quét không có
 *   chữ "dồn/rải/để dành/tiền mặt" trong câu khen/khịa.
 * · Ba giọng như thẻ (tre · vua · chung). Thuần, tất định theo (hồ sơ, giọng, hạt).
 */
import type { HoSoGoi } from '@server/hanh_vi/goi';
import type { Giong } from './tinh_cach';
import { theCua } from './tinh_cach';

export type LoaiLoi = 'moi' | 'giuc' | 'khen' | 'khia' | 'ghi_nhan';
export type DichLoi = 'choi' | 'the';

export interface LoiOracle {
  loai: LoaiLoi;
  cau: string;
  /** Bấm bong bóng đi đâu. */
  dich: DichLoi;
}

type BaGiong = Record<Giong, string>;
const ba = (tre: string, vua: string, chung: string): BaGiong => ({ tre, vua, chung });

/* ── MỜI ──────────────────────────────────────────────────────────────── */
const MOI: BaGiong[] = [
  ba('Bro đứng đó làm gì, vào một ván đi 🗿 — tôi còn chưa có gì để đọc vị bro cả.',
    'Vào một ván đi — tôi chưa có gì để đọc vị bạn cả.',
    'Mời bạn chơi một ván — tôi chưa có dữ liệu nào để đọc về bạn.'),
  ba('Anh bạn thật sự: chơi hết 10 trận là tôi nói cho bro biết bro tiêu tiền kiểu gì 👀',
    'Chơi hết mười trận là tôi nói được bạn tiêu tiền kiểu gì.',
    'Sau mười ván hoàn chỉnh, tôi sẽ cho bạn biết cách bạn tiêu tiền.'),
];

/* ── GIỤC ─────────────────────────────────────────────────────────────── */
function giuc(hs: HoSoGoi, giong: Giong, hat: number): LoiOracle {
  const td = hs.tien_do;
  const thieuTran = Math.max(0, td.can.tran - td.tran);
  const thieuQuyet = Math.max(0, td.can.vong_quyet - td.vong_quyet);
  const thieuSuKien = Math.max(0, td.can.vong_su_kien - td.vong_su_kien);
  const daXongGoiTruoc = hs.goi !== null;
  const cau: BaGiong[] = [];

  if (td.tran === 0 && !daXongGoiTruoc) {
    cau.push(
      ba('Bro mở trận rồi bỏ đi hả 💀 — trận CHƠI HẾT mới tính. Chưa có ván nào xong.',
        'Trận chơi HẾT mới tính — bạn chưa có ván nào xong.',
        'Chỉ ván chơi hết mới được tính — bạn chưa hoàn thành ván nào.'),
    );
  } else if (thieuTran > 0) {
    const n = thieuTran;
    cau.push(
      ba(`Còn ${n} trận nữa là tôi đọc vị được bro 🗿 Chơi hết nhé, bỏ dở là không tính đâu.`,
        `Còn ${n} trận chơi hết nữa là thẻ của bạn nở.`,
        `Còn ${n} ván hoàn chỉnh nữa là đủ dữ liệu cho tấm thẻ.`),
      ba(`${n} trận nữa thôi, anh bạn thật sự. Data đang loading ${Math.round((td.tran / td.can.tran) * 100)}% 📶`,
        `${n} trận nữa — tiến độ ${Math.round((td.tran / td.can.tran) * 100)}%.`,
        `Tiến độ ${Math.round((td.tran / td.can.tran) * 100)}% — còn ${n} ván.`),
    );
  }
  if (thieuTran === 0 && thieuQuyet > 0) {
    cau.push(
      ba(`Đủ trận rồi mà thiếu ${thieuQuyet} vòng có QUYẾT ĐỊNH — bro để đồng hồ chốt hộ hơi nhiều đó 💀`,
        `Đủ trận nhưng thiếu ${thieuQuyet} vòng có quyết định — đồng hồ chốt hộ không tính.`,
        `Đủ ván nhưng còn thiếu ${thieuQuyet} vòng có quyết định thật — vòng hết giờ không được tính.`),
    );
  }
  if (thieuTran === 0 && thieuQuyet === 0 && thieuSuKien > 0) {
    cau.push(
      ba(`Thiếu ${thieuSuKien} vòng có TIN để tôi biết bro phản ứng với tin đồn kiểu gì — map 12 nhiều tin hơn đó 📡`,
        `Thiếu ${thieuSuKien} vòng có tin — tôi chưa biết bạn phản ứng với tin đồn thế nào.`,
        `Còn thiếu ${thieuSuKien} vòng có sự kiện để đo phản ứng với tin tức.`),
    );
  }
  if (cau.length === 0) {
    cau.push(ba('Gói này sắp đầy rồi, bro 👀', 'Gói này sắp đầy rồi.', 'Gói dữ liệu này sắp hoàn tất.'));
  }
  return { loai: 'giuc', cau: chon(cau, hat)[giong], dich: 'choi' };
}

/* ── KHEN / KHỊA ──────────────────────────────────────────────────────── */
function khenKhia(hs: HoSoGoi, giong: Giong, hat: number): LoiOracle {
  const ung: { loai: LoaiLoi; cau: BaGiong }[] = [];
  const cs = hs.chi_so;

  // Bậc đọc — KỸ NĂNG, khen/khịa thoải mái.
  if (hs.bac_doc === 'mat_than') {
    ung.push({ loai: 'khen', cau: ba(
      'Bro đọc chợ như đọc tin nhắn 🧠 Brier thấp tới mức tôi nghi bro có tay trong.',
      'Ước lượng của bạn sát thực tế bất thường — đọc chợ như đọc tin nhắn.',
      'Dự tính của bạn gần như khớp kết quả — hiếm có.') });
  } else if (hs.bac_doc === 'doc_duoc') {
    ung.push({ loai: 'khen', cau: ba(
      'Đọc được rồi đó bro 👓 — ước lượng khớp thực tế kha khá, chứ chẳng bốc đại.',
      'Ước lượng của bạn khớp thực tế kha khá — chứ chẳng bốc đại.',
      'Dự tính của bạn đã bám sát kết quả.') });
  } else if (hs.bac_doc === 'doan_mo') {
    ung.push({ loai: 'khia', cau: ba(
      'Bro ơi, tung đồng xu còn chuẩn hơn ước lượng của bro 🪙💀 Brier đang ở vùng "đoán mò".',
      'Thật lòng: tung đồng xu còn chuẩn hơn ước lượng của bạn đợt này.',
      'Dự tính đợt này còn xa thực tế — ngang với đoán ngẫu nhiên.') });
  }

  // Xu hướng Brier — đang khá lên / loãng dần.
  const xh = cs.hieu_chinh?.xu_huong ?? null;
  if (xh !== null && xh <= -0.1) {
    ung.push({ loai: 'khen', cau: ba(
      'Nửa sau gói bro đọc chuẩn hơn nửa đầu — tiến bộ thật, có số đo 📈',
      'Nửa sau gói bạn đọc chuẩn hơn nửa đầu — tiến bộ có số.',
      'Độ chính xác nửa sau gói cao hơn nửa đầu — bạn đang tiến bộ.') });
  } else if (xh !== null && xh >= 0.1) {
    ung.push({ loai: 'khia', cau: ba(
      'Càng chơi càng loãng hả bro 📉 nửa sau gói đọc kém hơn nửa đầu. Chủ quan hay buồn ngủ?',
      'Nửa sau gói đọc kém hơn nửa đầu — chủ quan, hay mệt?',
      'Độ chính xác nửa sau gói thấp hơn nửa đầu.') });
  }

  // Nét — cái gì đang cầm lái. (Khẩu vị KHÔNG bao giờ vào đây — §1.2.)
  if (hs.net === 'lanh') {
    ung.push({ loai: 'khen', cau: ba(
      'Không ai lái được tay bro — thua không cay, tin đồn không kéo 🧊 Đáng nể.',
      'Không ai lái được tay bạn — thua không cay, tin đồn không kéo.',
      'Kết quả hay tin tức không làm bạn đổi quyết định — đáng nể.') });
  } else if (hs.net === 'ket_qua') {
    // Nói đúng CÁI đã đo, không nói chung — ba mặt của "bị kết quả điều khiển".
    const xThua = cs.don_von?.sau_thua_x ?? null;
    const xThang = cs.don_von?.sau_thang_x ?? null;
    let coNoi = false;
    if (xThua !== null && xThua >= 1.5) {
      coNoi = true;
      ung.push({ loai: 'khia', cau: ba(
        `Thua xong là tay to gấp ${xThua.toFixed(1)} 🌋 chợ chưa kịp xin lỗi bro đã đòi nợ. Đòi được chưa?`,
        `Thua xong là tay to gấp ${xThua.toFixed(1)} — chợ chưa kịp xin lỗi bạn đã đòi nợ.`,
        `Sau một ván thua, quy mô quyết định của bạn tăng gấp ${xThua.toFixed(1)}. Bạn có nhận ra không?`) });
    }
    if (xThang !== null && xThang >= 1.5) {
      coNoi = true;
      ung.push({ loai: 'khia', cau: ba(
        `Thắng xong là tay to gấp ${xThang.toFixed(1)} 🎈 tiền vừa thắng bro tiêu như tiền nhặt được.`,
        `Thắng xong là tay to gấp ${xThang.toFixed(1)} — tiền vừa thắng tiêu như tiền nhặt được.`,
        `Sau một ván thắng, quy mô quyết định tăng gấp ${xThang.toFixed(1)} — tiền vừa thắng được đối xử như tiền nhặt được.`) });
    }
    if (cs.chot_non && cs.chot_non.lech >= 0.25) {
      coNoi = true;
      ung.push({ loai: 'khia', cau: ba(
        'Lãi non là hái ngay, lỗ thì ôm chờ "về bờ" 🥒 Bờ ở đâu thế bro?',
        'Lãi non là hái ngay, lỗ thì ôm chờ "về bờ" — bờ ở đâu thế?',
        'Bạn chốt lãi sớm nhưng giữ lỗ lâu — một mẫu rất phổ biến, và rất tốn.') });
    }
    if (!coNoi) {
      ung.push({ loai: 'khia', cau: ba(
        'Kết quả vừa rồi đang cầm lái tay bro 🎢 thắng thua một ván mà đổi cả cách chơi ván sau.',
        'Kết quả vừa rồi đang cầm lái tay bạn — thắng thua một ván đổi cả ván sau.',
        'Thắng thua gần nhất đang chi phối quyết định kế tiếp của bạn.') });
    }
  } else if (hs.net === 'ben_ngoai') {
    ung.push({ loai: 'khia', cau: ba(
      'Thấy người ta mua là bro mua, nghe nói sắp hết là bro vào 📡 Ai đang chơi, bro hay cái trend?',
      'Thấy người ta mua là mua, nghe nói sắp hết là vào — ai đang chơi, bạn hay cái trend?',
      'Thời điểm quyết định của bạn trùng với tin tức và đà giá nhiều hơn hẳn lúc thường.') });
  }

  // Đổi thẻ giữa hai gói — ghi nhận, đọc tên thẻ cũ/mới.
  if ((hs.lich_su?.length ?? 0) >= 2) {
    const a = hs.lich_su[hs.lich_su.length - 2]!;
    const b = hs.lich_su[hs.lich_su.length - 1]!;
    if (a.tinh_cach !== b.tinh_cach) {
      const ta = theCua(a.tinh_cach, giong); const tb = theCua(b.tinh_cach, giong);
      ung.push({ loai: 'ghi_nhan', cau: ba(
        `Gói trước bro là ${ta.emoji} ${ta.ten}, gói này thành ${tb.emoji} ${tb.ten} — bro lớn rồi hay chỉ đổi mood? 🤔`,
        `Gói trước bạn là ${ta.emoji} ${ta.ten}, gói này thành ${tb.emoji} ${tb.ten} — đổi thật hay đổi mood?`,
        `Gói trước: ${ta.emoji} ${ta.ten}. Gói này: ${tb.emoji} ${tb.ten}. Một thay đổi đáng để bạn tự hỏi vì sao.`) });
    }
  }

  if (ung.length === 0) {
    return { loai: 'ghi_nhan', dich: 'the', cau: ba(
      'Thẻ của bro nở rồi đó, vào xem đi 👀', 'Thẻ của bạn đã nở — vào xem.', 'Tấm thẻ của bạn đã sẵn sàng.')[giong] };
  }
  const c = chon(ung, hat);
  return { loai: c.loai, cau: c.cau[giong], dich: 'the' };
}

/* ── CHỌN ─────────────────────────────────────────────────────────────── */
function chon<T>(xs: readonly T[], hat: number): T {
  return xs[((hat % xs.length) + xs.length) % xs.length]!;
}

/** Hạt theo NGÀY (giờ VN không quan trọng — chỉ cần đổi mỗi ngày). */
export function hatTheoNgay(now = new Date()): number {
  return Math.floor(now.getTime() / 86_400_000);
}

/**
 * Một câu cho Oracle. `hs` undefined = chưa có dữ liệu (chưa đăng nhập / đang tải).
 */
export function loiOracle(
  hs: HoSoGoi | null | undefined, giong: Giong, hat: number,
): LoiOracle {
  if (!hs) return { loai: 'moi', cau: chon(MOI, hat)[giong], dich: 'choi' };
  // Payload thiếu `tien_do` (API cũ hơn bundle — bình thường ở repo này) ⇒ không
  // giục bằng số không có; chỉ mời, hoặc khen/khịa nếu đã có gói.
  if (!hs.tien_do || !hs.tien_do.can) {
    return hs.goi ? khenKhia(hs, giong, hat) : { loai: 'moi', cau: chon(MOI, hat)[giong], dich: 'choi' };
  }
  if (hs.goi === null || hs.goi === undefined) {
    // Chưa từng có gói và chưa chơi gì ⇒ mời; còn lại ⇒ giục đúng chỗ thiếu.
    if ((hs.tien_do?.tran ?? 0) === 0 && (hs.tien_do?.vong_quyet ?? 0) === 0 && hs.n_vong === 0) {
      return { loai: 'moi', cau: chon(MOI, hat)[giong], dich: 'choi' };
    }
    return giuc(hs, giong, hat);
  }
  // Có gói: khen/khịa, thỉnh thoảng (hạt lẻ) nhắc gói kế nếu đang mở dở.
  return khenKhia(hs, giong, hat);
}
