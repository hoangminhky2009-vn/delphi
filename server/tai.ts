/**
 * ĐO TẢI — bước 1 của "van nước" (D106, doc duong-ong-hanh-vi §6).
 *
 * Founder 22/08: giới hạn là TẢI HỆ THỐNG, không phải số tài khoản; người đang
 * chơi không bị đụng; van đóng ở ~92%, mở lại ở ~75%. Trước khi có van phải có
 * SỐ — và số phải là cái THẬT SỰ nghẽn ở Delphi: pool Postgres `max: 1` mỗi
 * instance Vercel, kết nối Supabase, p95 của `/rounds`. "Số trận đang mở" không
 * phải tài nguyên ở đây (trận là hàm tất định trong DB, không có game instance).
 *
 * Bản này CHỈ ĐO, không chặn gì. Van (503 + Retry-After trên `POST /matches`) chờ
 * điều kiện kích hoạt ghi ở doc §6 (≥ 50 người/ngày hoặc p95 > 2 s đo được) —
 * D64: mẫu số là mùa này; D93: van đoán mù là rác.
 *
 * ⚠ SERVERLESS KHÔNG CÓ BỘ NHỚ CHUNG: số ở đây là của MỘT instance, cửa sổ 60 s.
 * Đọc `/health` nhiều lần có thể gặp nhiều instance khác nhau — đó là bản chất,
 * không phải lỗi; bước 2 (nếu tới) phải gom qua DB.
 */

export interface MauDoTre { t: number; ms: number }

const CUA_SO_MS = 60_000;
const TRAN_MAU = 256;

/** Ring buffer độ trễ `/rounds` — MỘT chỗ, trong process. */
const mau: MauDoTre[] = [];

export function ghiDoTreRounds(ms: number, now = Date.now()): void {
  mau.push({ t: now, ms });
  if (mau.length > TRAN_MAU) mau.splice(0, mau.length - TRAN_MAU);
}

/** p95 trong cửa sổ — null khi chưa có mẫu (không bịa 0: "chưa đo" ≠ "nhanh"). */
export function p95Rounds(now = Date.now()): { p95_ms: number | null; n: number } {
  const trong = mau.filter((m) => now - m.t <= CUA_SO_MS).map((m) => m.ms).sort((a, b) => a - b);
  if (trong.length === 0) return { p95_ms: null, n: 0 };
  return { p95_ms: trong[Math.min(trong.length - 1, Math.floor(0.95 * trong.length))]!, n: trong.length };
}

/** Chỉ để test: xoá mẫu. */
export function xoaMauDoTre(): void { mau.length = 0; }

export interface SoLieuTai {
  pool: { total: number; idle: number; waiting: number; max: number | null };
  rounds_60s: { p95_ms: number | null; n: number };
}

/** Pool của node-postgres phơi ba bộ đếm sẵn — đọc thẳng, không đoán. */
export function soLieuTai(
  pool: { totalCount: number; idleCount: number; waitingCount: number; options?: { max?: number } },
  now = Date.now(),
): SoLieuTai {
  return {
    pool: {
      total: pool.totalCount, idle: pool.idleCount, waiting: pool.waitingCount,
      max: pool.options?.max ?? null,
    },
    rounds_60s: p95Rounds(now),
  };
}

/* ═══════════════════════════════════════════════════════════════════════════
 * VAN QUÁ TẢI (D274) — bước 2, và nó KHÔNG phải cái van D106 phác.
 *
 * ─── VÌ SAO KHÔNG LÀM VAN NGƯỠNG NHƯ D106 PHÁC ─────────────────────────────
 * D106 phác: đóng ở ~92% tải, mở lại ở ~75%. Đo 05/09 (D271) cho thấy phác đó
 * KHÔNG cài được đúng ở đây, vì hai lẽ:
 *
 *   1. Trần thật là 200 CLIENT ĐỒNG THỜI của Supavisor, tức trần TOÀN CỤC trên
 *      số instance đang sống. Mà số ở file này là của MỘT instance (xem cảnh
 *      báo đầu file). 200 instance mỗi cái tự thấy "pool total=1, ổn" thì không
 *      cái nào đạt 92% của gì cả — trong khi tập thể vừa đâm vào tường. Van
 *      ngưỡng đọc số cục bộ là van ĐOÁN MÙ, đúng thứ đầu file này cấm.
 *   2. Điều kiện kích hoạt của D106 (≥50 người/ngày hoặc p95 > 2s) CHƯA đạt.
 *
 * ─── VÌ SAO VẪN LÀM VAN, VÀ LÀM KIỂU KHÁC ──────────────────────────────────
 * D271 đo được một thứ D106 không biết: khi chạm trần, hệ KHÔNG chậm dần mà ném
 * `EMAXCONN` ⇒ HTTP 500. C2 đòi "xuống cấp có kiểm soát chứ không sập"; 500 là
 * lời nói dối với client — nó bảo "máy chủ hỏng" trong khi sự thật là "đang đủ
 * tải, quay lại sau". Client không biết nên thử lại, và mọi lớp retry phía trên
 * đọc 500 là hỏng thật.
 *
 * ⇒ Van này KHÔNG đoán tải. Nó PHẢN ỨNG với đúng tín hiệu đã đo được: bắt
 * `EMAXCONN` (và hết giờ xin kết nối) rồi đổi 500 thành **503 + Retry-After**.
 * Không cần trạng thái toàn cục, không cần ngưỡng bịa, và nó đúng ở mọi mức
 * tải vì nó phản ứng với SỰ KIỆN chứ không với SỐ ĐO.
 *
 * ⚠ Van này KHÔNG thay cổng hàng chờ (`web/worker/`): cổng chặn TRƯỚC khi chạm
 * DB, van chỉ trả lời cho tử tế khi đã chạm. Hai lớp, hai vai.
 * ═══════════════════════════════════════════════════════════════════════════ */

/**
 * Hết chỗ kết nối — nhận diện theo THÔNG ĐIỆP, không theo mã lỗi.
 *
 * ⚠ VÌ SAO KHÔNG DÙNG `err.code`: Supavisor trả `XX000` (internal_error) cho
 * `EMAXCONN` — mã dùng chung cho hàng loạt lỗi khác nhau, bắt theo nó là bắt
 * nhầm cả những lỗi PHẢI báo động. Chuỗi lấy nguyên văn từ log prod 05/09:
 *   `(EMAXCONN) max client connections reached, limit: 200`
 * Ca thứ hai là `connectionTimeoutMillis` của pool (10s) hết giờ — cùng bản
 * chất "không xin được kết nối", nên cùng câu trả lời.
 */
export function laHetKetNoi(err: unknown): boolean {
  const s = (err instanceof Error ? err.message : String(err ?? '')).toLowerCase();
  if (s.length === 0) return false;
  return (
    s.includes('emaxconn') ||
    s.includes('max client connections reached') ||
    s.includes('timeout exceeded when trying to connect')
  );
}

/**
 * Bao lâu thì bảo client quay lại (giây) — CÓ NHIỄU, cố ý.
 *
 * ⚠ Một con số cố định là hẹn cả đám quay lại cùng một giây: đợt tràn vừa tan
 * thì dựng lại y nguyên. Rải 3–8 giây làm đợt sau thoải hơn. Nhận `rnd` để test
 * tất định được.
 */
export function giaySauThuLai(rnd: () => number = Math.random): number {
  return 3 + Math.floor(rnd() * 6);
}

/* Nhịp báo lỗi hết kết nối — của MỘT instance, cùng bản chất với `mau` ở trên. */
const NHIP_BAO_MS = 60_000;
let baoLuc: number | null = null;

/**
 * Có nên đẩy lỗi này ra kênh báo lỗi không — tối đa một lần mỗi phút mỗi instance.
 *
 * ⚠ VÌ SAO BÓP: một đợt tràn đẻ ra HÀNG TRĂM lỗi giống hệt trong vài giây. Gói
 * Sentry Developer có 5.000 sự kiện/tháng; xả hết vào đó là **chuông tắt đúng
 * lúc cần nó nhất**. Một lần mỗi phút là đủ để biết "đang chạm trần" — thứ ta
 * cần là BIẾT CÓ, không phải đếm đủ.
 */
export function nenBaoHetKetNoi(now = Date.now()): boolean {
  if (baoLuc !== null && now - baoLuc < NHIP_BAO_MS) return false;
  baoLuc = now;
  return true;
}

/** Chỉ để test: quên lần báo gần nhất. */
export function xoaNhipBaoHetKetNoi(): void { baoLuc = null; }
