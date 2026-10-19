/**
 * CẢM BIẾN KẾT NỐI — "mạng có đang chập chờn không".
 *
 * Founder 11/08: *"đảm bảo luôn trải nghiệm cho những người mạng kém/chập chờn
 * để họ ko quá khó chịu khi dùng app"*. Rà ra: toàn `web/src` KHÔNG có một chữ
 * `navigator.onLine` nào — người chơi không có cách nào biết vấn đề nằm ở mạng
 * của họ hay ở app. Nút mờ đi 15 giây rồi thôi, không chữ, không lỗi.
 *
 * ─── VÌ SAO CẢM BIẾN ĐẶT Ở TẦNG API, KHÔNG Ở COMPONENT ───────────────────────
 * `api()` là cửa DUY NHẤT ra backend. Rải listener ở 20 màn thì bảo đảm có ngày
 * sót vài cái, và chỗ sót không báo lỗi — nó chỉ im. Một cửa, một cảm biến.
 *
 * ⚠⚠ KHÔNG TIN `navigator.onLine` MỘT MÌNH, và đây là điểm chính của file này.
 * Nó vẫn `true` khi: vào Wi-Fi cổng đăng nhập (quán cà phê, sân bay), sóng
 * 3G chết mà vẫn còn kết nối, hoặc router còn sáng mà đường ra ngoài đứt —
 * tức đúng những ca "chập chờn" founder đang nói tới. `onLine === false` là
 * bằng chứng CHẮC CHẮN mất mạng, còn `true` KHÔNG chứng minh được gì.
 * ⇒ Tín hiệu thật là ĐẾM LỖI LIÊN TIẾP CHƯA TỚI MÁY CHỦ (`status === 0`).
 * `navigator.onLine === false` chỉ dùng làm đường tắt bật sớm.
 *
 * ⚠ NGƯỠNG 2 LẦN, KHÔNG PHẢI 1: một cú rớt lẻ xảy ra thường xuyên trên di động
 * và tự lành ngay. Báo động ở lần đầu là dải cảnh báo chớp tắt suốt buổi, và
 * người chơi học cách phớt lờ nó — đúng thứ làm cảnh báo mất giá trị.
 */

/** Số lần liên tiếp KHÔNG TỚI ĐƯỢC máy chủ thì coi là đang mất kết nối. */
const NGUONG_HONG = 2;

/**
 * ⚠⚠ NHỊP TỰ DÒ — thêm 12/08 sau khi ĐO THẤY BĂNG KHÔNG BAO GIỜ TẮT.
 *
 * Bản đầu chỉ tắt băng khi có một lời gọi API THÀNH CÔNG. Nghe hợp lý, nhưng nó
 * bỏ sót một sự thật của chính app này: từ D64 màn trận KHÔNG polling nhịp nào,
 * và ngoài trận thì react-query cũng ngồi im trên cache. Đo trên prod: rớt mạng
 * rồi ngồi yên 8 giây ⇒ **0 lời gọi API thêm**. Tức mạng về rồi mà băng vẫn nằm
 * đó, vĩnh viễn, cho tới khi người chơi tình cờ bấm thứ gì đó gọi mạng.
 *
 * Và nó không chỉ thừa — nó NÓI DỐI: băng ghi "đang thử lại" trong khi không có
 * gì thử lại cả. Một cảnh báo sai mãi thì người ta học cách phớt lờ, và lần sau
 * mất mạng thật họ cũng không tin nó nữa.
 *
 * ⇒ Đang mất kết nối thì TỰ DÒ, giãn dần. Giãn chứ không đều: mất mạng thường
 * kéo dài hàng phút, dò 2 giây một lần suốt thời gian đó là bào pin và bào cả
 * hạn mức request (C1) đúng lúc mạng đang yếu.
 * ⇒ Tab bị ẩn thì BỎ QUA nhịp đó (không tắt hẳn): dò khi người ta không nhìn là
 * tiêu pin cho một câu trả lời không ai đọc.
 */
const NHIP_DO_MS = [3000, 6000, 12000, 30000] as const;

/** Dò bằng đường RẺ NHẤT và CÔNG KHAI. Bất kỳ câu trả lời nào cũng chứng minh
 *  đường mạng còn sống — kể cả 500, nên không cần endpoint riêng. */
const DUONG_DO = '/api/v1/health';
const HAN_DO_MS = 5000;

type Nghe = (mat: boolean) => void;

let hongLienTiep = 0;
let matKetNoi = false;
const nghe = new Set<Nghe>();
let henDo: ReturnType<typeof setTimeout> | null = null;
let nacDo = 0;

function phat(): void {
  const moi = matKetNoi;
  for (const f of nghe) {
    try {
      f(moi);
    } catch {
      /* một người nghe hỏng không được làm chết cả cảm biến */
    }
  }
}

function dat(mat: boolean): void {
  if (mat === matKetNoi) return;
  matKetNoi = mat;
  if (mat) batDauDo(); else dungDo();
  phat();
}

/** Một nhịp dò. Bất kỳ câu trả lời nào từ máy chủ ⇒ mạng sống ⇒ tắt băng. */
async function doMotNhip(): Promise<void> {
  if (typeof document !== 'undefined' && document.visibilityState === 'hidden') {
    /*
     * ⚠ NHỊP BỎ QUA KHÔNG ĐƯỢC TÍNH VÀO ĐỘ GIÃN. Bản đầu tăng `nacDo` ở cả nhịp
     * bị bỏ qua, nên một tab nằm nền suốt lúc mất mạng sẽ giãn tới trần 30 giây
     * mà chưa hề dò lấy một lần — rồi người quay lại phải ngồi chờ thêm 30 giây
     * nữa mới thấy băng tắt. Độ giãn phải đo số lần DÒ HỎNG, không đo số lần
     * KHÔNG DÒ.
     */
    nacDo = Math.max(0, nacDo - 1);
    henDo = null;
    hen();
    return;
  }
  const bo = new AbortController();
  const cat = setTimeout(() => bo.abort(), HAN_DO_MS);
  try {
    await fetch(DUONG_DO, { method: 'GET', cache: 'no-store', signal: bo.signal });
    ghiNhanGoi(true);                        // tới nơi ⇒ `dat(false)` ⇒ dừng dò
  } catch {
    henDo = null;
    hen();                                   // chưa tới ⇒ giãn ra rồi dò tiếp
  } finally {
    clearTimeout(cat);
  }
}

function hen(): void {
  if (henDo !== null || !matKetNoi) return;
  const cho = NHIP_DO_MS[Math.min(nacDo, NHIP_DO_MS.length - 1)]!;
  nacDo += 1;
  henDo = setTimeout(() => { henDo = null; void doMotNhip(); }, cho);
}

function batDauDo(): void {
  if (typeof window === 'undefined') return;
  nacDo = 0;
  hen();
}

function dungDo(): void {
  if (henDo !== null) { clearTimeout(henDo); henDo = null; }
  nacDo = 0;
}

/**
 * Một lời gọi API vừa xong. `toiNoi` = máy chủ ĐÃ TRẢ LỜI (kể cả trả lời lỗi
 * 4xx/5xx — nó vẫn chứng minh đường mạng còn sống).
 *
 * ⚠ Phân biệt này quan trọng: 409 `sai_vong` KHÔNG phải sự cố mạng, và đếm nó
 * vào đây là dải cảnh báo bật lên mỗi lần người chơi bấm trùng.
 */
export function ghiNhanGoi(toiNoi: boolean): void {
  if (toiNoi) {
    hongLienTiep = 0;
    dat(false);
    return;
  }
  hongLienTiep += 1;
  if (hongLienTiep >= NGUONG_HONG) dat(true);
}

/** Đang mất kết nối theo chỗ cảm biến biết. */
export function dangMatKetNoi(): boolean {
  return matKetNoi;
}

/**
 * D414 — NHỊP GIÃN cho một việc TỰ ĐỘNG gửi lại sau `soLanHong` lần hỏng liên tiếp (0 ⇒ không phải chờ thêm).
 *
 * Cùng thang `NHIP_DO_MS` với nhịp tự dò ở trên, có chủ ý (A11.5 — một thang, không hai): cả hai trả lời cùng một câu
 * "đường tới máy chủ đang hỏng thì bao lâu hỏi lại một lần". Người dùng đầu tiên là tự-nộp-khi-hết-giờ của màn trận
 * (D38): trước D414 nó thử lại mỗi ~1 s, mỗi lần kèm một GET đồng bộ ⇒ máy chủ trả 5xx nhanh thì mỗi máy khách kẹt là
 * ~2 request/giây vào đúng máy chủ đang hỏng — ngược C2 (*"xuống cấp có kiểm soát, giãn polling"*).
 */
export function choThuLaiMs(soLanHong: number): number {
  if (soLanHong <= 0) return 0;
  return NHIP_DO_MS[Math.min(soLanHong - 1, NHIP_DO_MS.length - 1)]!;
}

/*
 * ─── SỔ SỰ CỐ — nuôi lời khai `su_co_khai` (D93) ─────────────────────────────
 *
 * Cảm biến ở trên trả lời "BÂY GIỜ có mất kết nối không"; sổ này trả lời "TỪ
 * MỐC X tới giờ đã hỏng mấy lần, lần cuối là gì" — câu màn trận cần khi nộp
 * vòng muộn: nếu vòng bị server chốt hộ (`het_gio`) thì trong log nó y hệt một
 * người AFK, trừ khi client KHAI rằng mình đã cố gửi mà không được. Server ghi
 * lời khai đó cạnh `tu_dong` (chỉ khi mất lượt), người phân tích tách được
 * "AFK" với "server chết". Founder 16/08: "dán nhãn, không đổi luật".
 *
 * Ghi CẢ 5xx: với người chơi, "máy chủ trả 500" và "không tới máy chủ" cùng
 * là một chuyện — không quyết định được. Cảm biến kết nối thì cố ý KHÔNG đếm
 * 5xx (nó đo ĐƯỜNG MẠNG); hai câu hỏi khác nhau, hai bộ đếm.
 *
 * Sổ có trần: giữ 64 mục gần nhất — đủ cho một vòng dài nhất, không phình theo
 * phiên chơi cả buổi.
 */
export type LoaiSuCo = 'timeout' | 'network' | 'server';
const TRAN_SO_SU_CO = 64;
const soSuCo: { luc: number; loai: LoaiSuCo }[] = [];

/** Một lời gọi ra backend vừa HỎNG theo cách người chơi không làm gì được. */
export function ghiSuCo(loai: LoaiSuCo, luc = Date.now()): void {
  soSuCo.push({ luc, loai });
  if (soSuCo.length > TRAN_SO_SU_CO) soSuCo.splice(0, soSuCo.length - TRAN_SO_SU_CO);
}

/**
 * Lời khai cho một vòng: số lần hỏng KỂ TỪ mốc (ms epoch) + lỗi cuối. `null` khi
 * không có gì để khai — chỗ gọi KHÔNG gửi trường (server phân biệt vắng mặt với
 * có mặt; đừng gửi `null` tường minh).
 */
export function suCoKeTu(mocMs: number): { so_lan_hong: number; loi_cuoi: LoaiSuCo } | null {
  let so = 0;
  let cuoi: LoaiSuCo | null = null;
  for (const m of soSuCo) {
    if (m.luc < mocMs) continue;
    so += 1;
    cuoi = m.loai;
  }
  return so > 0 && cuoi ? { so_lan_hong: so, loi_cuoi: cuoi } : null;
}

/** Đăng ký nghe; trả hàm huỷ. Dùng qua `useMatKetNoi`, đừng gọi thẳng ở màn. */
export function ngheMatKetNoi(f: Nghe): () => void {
  nghe.add(f);
  return () => { nghe.delete(f); };
}

/**
 * Nối sự kiện trình duyệt. `offline` là bằng chứng chắc chắn nên bật NGAY (đỡ
 * phải chờ đủ hai lần hỏng); `online` thì KHÔNG tự tắt — nó chỉ nói card mạng
 * có kết nối, chưa nói ra được Internet. Tắt khi có một lời gọi THÀNH CÔNG.
 */
export function khoiDongCamBienMang(): void {
  if (typeof window === 'undefined') return;
  window.addEventListener('offline', () => {
    hongLienTiep = NGUONG_HONG;
    dat(true);
  });
  /*
   * `online` KHÔNG tự tắt băng — nó chỉ nói card mạng có kết nối, chưa nói ra
   * được Internet (đúng ca Wi-Fi cổng đăng nhập). Nhưng nó là gợi ý RẺ và ĐÚNG
   * LÚC, nên dùng nó để dò NGAY thay vì ngồi chờ hết nhịp giãn: người vừa bước
   * vào vùng sóng không nên phải đợi thêm 30 giây mới thấy băng tắt.
   */
  /*
   * Quay lại nhìn màn hình là khoảnh khắc ĐÚNG NHẤT để dò: người ta vừa mở app
   * lên và câu hỏi đầu tiên trong đầu họ là "vào mạng chưa". Không có cái này
   * thì họ phải chờ hết nhịp giãn đang treo — tới 30 giây ngồi nhìn một dải đỏ
   * có khi đã hết đúng từ lâu.
   */
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState !== 'visible' || !matKetNoi) return;
    dungDo();
    void doMotNhip();
  });
  window.addEventListener('online', () => {
    if (!matKetNoi) return;
    dungDo();
    nacDo = 0;
    void doMotNhip();
  });
}

/** Chỉ dùng trong test — đặt lại cảm biến về trạng thái sạch. */
export function resetCamBienMang(): void {
  dungDo();
  hongLienTiep = 0;
  matKetNoi = false;
  soSuCo.length = 0;
  phat();
}
