/**
 * HỘP THƯ ĐI của đo lường vận hành (A9; bản yêu cầu 01 §2.4).
 *
 * ⚠⚠ MÁY NGƯỜI CHƠI LÀ HỘP THƯ ĐI, KHÔNG PHẢI KHO. Hàng đợi ở đây tồn tại vì
 * đúng hai lý do: GỘP LÔ (Vercel free 1 triệu request/tháng — gửi từng cái một
 * thì riêng phần đo đã ăn hơn nửa hạn mức) và SỐNG SÓT LÚC MẤT MẠNG. Nó không
 * phải chỗ chứa dữ liệu: xoá app là mất, trình duyệt thu hồi bộ nhớ bất kỳ lúc
 * nào, và dữ liệu rải trên 500 điện thoại thì không phân tích được.
 *
 * ⚠ FILE NÀY KHÔNG BAO GIỜ ĐƯỢC NÉM LỖI RA NGOÀI. Đây là dụng cụ đo; nó hỏng
 * thì app vẫn phải chạy bình thường. Mọi cửa công khai đều bọc `try`.
 *
 * ⚠ KHÔNG ĐI QUA `api/client.ts`. Cửa đó ném `ApiError` và có hạn chờ 15 giây —
 * đúng cho nghiệp vụ, sai cho việc này: một lô đo không được phép làm nổi lên
 * một lỗi mà người dùng nhìn thấy, và lần gửi cuối phiên phải đi bằng
 * `sendBeacon` chứ không bằng `fetch`.
 */
import { useEffect } from 'react';
import { matchRoutes } from 'react-router-dom';
import { cheDoHienThi } from './cai_app';
import { MAN_HOP_LE, MAN_KHAC, TELEMETRY, type LoaiTelemetry } from '@config/telemetry';

const BASE = import.meta.env.VITE_API_BASE_URL ?? '';
const URL_DO = `${BASE}/api/v1/telemetry`;

export interface SuKienDo {
  loai: LoaiTelemetry;
  man?: string | null;
  ms?: number;
  chi_tiet?: Record<string, string | number>;
}

interface LoTreo {
  khoa: string;
  suKien: SuKienDo[];
}

interface TrangThai {
  /** Lô đã cắt và đang chờ gửi xong. Giữ NGUYÊN khoá qua các lần gửi lại. */
  cho: LoTreo | null;
  hangDoi: SuKienDo[];
}

let tt: TrangThai = { cho: null, hangDoi: [] };
let dangGui = false;
let hen: ReturnType<typeof setInterval> | null = null;

/* ══════════════════════════════════════════════════════════════════════════
 * `man` — MẪU ROUTE, KHÔNG PHẢI URL CỤ THỂ
 * ══════════════════════════════════════════════════════════════════════════ */

const BANG_ROUTE = MAN_HOP_LE.map((path) => ({ path }));

/**
 * `/keo/8f3a-…` → `/keo/:marketId`.
 *
 * ⚠ VÌ SAO PHẢI CHUẨN HOÁ Ở ĐÂY: `telemetry_ngay` được chọn làm nguồn của
 * dashboard CHÍNH VÌ nó nhỏ vĩnh viễn. Ghi URL cụ thể thì nó đẻ một dòng cho
 * MỖI KÈO MỖI NGÀY và phình theo số kèo — mà không có gì báo lỗi: bảng vẫn
 * chạy, chỉ là mỗi tháng một chậm hơn. Server kiểm lại lần nữa (client là thứ
 * không tin được), nhưng chuẩn hoá đúng chỗ thì server không phải đoán.
 *
 * Dùng `matchRoutes` của chính router thay vì tự so chuỗi: xếp hạng độ cụ thể
 * là việc thư viện đã làm đúng (`/keo/:id/ket-qua` thắng `/keo/:id`, và `*`
 * luôn xếp bét).
 */
export function manCuaDuong(pathname: string): string {
  try {
    const kq = matchRoutes(BANG_ROUTE, pathname);
    const cuoi = kq?.[kq.length - 1];
    return (cuoi?.route as { path?: string } | undefined)?.path ?? MAN_KHAC;
  } catch {
    return MAN_KHAC;
  }
}

/* ══════════════════════════════════════════════════════════════════════════
 * MÃ LỖI — nhóm được các cú sập GIỐNG NHAU mà không gửi một chữ nào của lỗi
 * ══════════════════════════════════════════════════════════════════════════ */

/**
 * `TypeError: Cannot read x of undefined` → `route:typeerror:1f3kq2`.
 *
 * ⚠ VÌ SAO BĂM CHỨ KHÔNG GỬI THÔNG ĐIỆP: thông điệp lỗi là chỗ PII rò ra tự
 * nhiên nhất — nó rất hay kèm email, handle, hoặc một mẩu URL có mã người dùng
 * (C7). Băm một chiều thì hai cú sập giống nhau vẫn ra cùng một mã (đủ để đếm
 * và xếp hạng lỗi), còn nội dung thì không đi đâu cả.
 *
 * Muốn đọc thông điệp thì đọc console/Sentry — `ManLoi` vẫn in đầy đủ.
 */
export function maLoi(nguon: 'route' | 'goc' | 'nen', loi: unknown): string {
  const thoTen =
    loi !== null && typeof loi === 'object' && typeof loi.constructor?.name === 'string'
      ? loi.constructor.name
      : typeof loi;
  const ten = thoTen.toLowerCase().replace(/[^a-z0-9]/g, '').slice(0, 16) || 'khong';
  const mota = loi instanceof Error ? `${loi.name}:${loi.message}` : String(loi ?? '');
  // FNV-1a 32 bit — không phải hàm băm mật mã, chỉ cần tất định và ngắn.
  let h = 0x811c9dc5;
  for (let i = 0; i < mota.length; i += 1) {
    h ^= mota.charCodeAt(i);
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return `${nguon}:${ten}:${h.toString(36)}`;
}

/**
 * ⭐ VIỆC CHẠY NỀN HỎNG THÌ PHẢI ĐỂ LẠI DẤU (D360) — dùng cho mọi `void viecAsync()`.
 *
 * ⚠⚠ VÌ SAO CẦN: `void f()` vứt lời hứa đi, nên `f` ném là thành unhandled rejection —
 * app không có bộ bắt nào cho nó (grep `unhandledrejection` = 0), `ManLoi` cũng không thấy
 * (nó chỉ bắt lỗi lúc RENDER). Người dùng bấm một nút ghi, cú ghi hỏng, và **không có gì
 * xảy ra cả**: không chữ, không log, không một dòng đếm được ở đâu. Đó là cách hỏng đắt
 * nhất — thứ không ai báo lại vì chính người gặp cũng chỉ thấy "bấm không ăn".
 *
 * ⚠ ĐÂY KHÔNG PHẢI BÁO CHO NGƯỜI DÙNG. Một dải lỗi trên màn là thành phần họ NHÌN THẤY ⇒
 * A11.25 đòi demo chốt trước; món đó còn nợ (D360 §Bị bác). Hàm này chỉ đóng vế *im lặng
 * với người vận hành*: console cho người soi prod + một MÃ đếm được ở `loi_client`.
 * ⚠ Chỉ gửi mã băm, không gửi thông điệp (C7 — xem `maLoi`). `ghiDo` không bao giờ ném.
 */
export function baoLoiNen(loi: unknown): void {
  console.error('[DELPHI] việc chạy nền hỏng:', loi);
  ghiDo('loi_client', { chi_tiet: { ma: maLoi('nen', loi) } });
}

/* ══════════════════════════════════════════════════════════════════════════
 * LƯU TRỮ — bền qua mất mạng và qua một lần tải lại trang
 * ══════════════════════════════════════════════════════════════════════════ */

function doc(): TrangThai {
  try {
    const raw = localStorage.getItem(TELEMETRY.KHOA_LUU);
    if (!raw) return { cho: null, hangDoi: [] };
    const v = JSON.parse(raw) as Partial<TrangThai>;
    return {
      cho: v.cho && Array.isArray(v.cho.suKien) && typeof v.cho.khoa === 'string' ? v.cho : null,
      hangDoi: Array.isArray(v.hangDoi) ? v.hangDoi : [],
    };
  } catch {
    // localStorage hỏng / bị chặn (Safari riêng tư) / JSON rác → bắt đầu lại.
    return { cho: null, hangDoi: [] };
  }
}

function ghi(): void {
  try {
    localStorage.setItem(TELEMETRY.KHOA_LUU, JSON.stringify(tt));
  } catch {
    /* Hết chỗ hoặc bị chặn — mất hàng đợi là chấp nhận được, hỏng app thì không. */
  }
}

function khoaMoi(): string {
  try {
    return crypto.randomUUID();
  } catch {
    return `lo-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
  }
}

/**
 * MÃ MỘT LƯỢT NGỒI — sinh ĐÚNG MỘT LẦN mỗi lần nạp trang.
 *
 * Nó tồn tại để đếm phễu của KHÁCH CHƯA CÓ TÀI KHOẢN: các bước đăng ký theo bản
 * chất xảy ra trước khi `user_id` tồn tại, nên không có mã này thì phễu đăng ký
 * chỉ đếm được số DÒNG, và một người tải lại trang ba lần sẽ đọc thành ba người
 * bỏ đi.
 *
 * ⚠⚠ TUYỆT ĐỐI KHÔNG `localStorage.setItem` MÃ NÀY. Nằm trong bộ nhớ thì nó chết
 * cùng tab và không nối được hai lần ghé của cùng một người — đó chính xác là
 * thứ khiến nó KHÔNG phải định danh cá nhân (C7). Đem đi lưu bền là biến một
 * biến đếm thành một mã theo dõi, chỉ tốn một dòng code.
 *
 * ⚠ `randomUUID` cần secure context (https / localhost). Prod và dev đều đạt,
 * nhưng Safari < 15.4 thì không có — rơi về chuỗi ngẫu nhiên đúng HÌNH DẠNG
 * uuid, vì server lọc theo `MAU_PHIEN` và cột DB là kiểu `uuid`.
 */
const PHIEN: string = (() => {
  try {
    return crypto.randomUUID();
  } catch {
    const h = (n: number) =>
      Array.from({ length: n }, () => Math.floor(Math.random() * 16).toString(16)).join('');
    return `${h(8)}-${h(4)}-4${h(3)}-a${h(3)}-${h(12)}`;
  }
})();

/* ══════════════════════════════════════════════════════════════════════════
 * GHI + ĐẨY
 * ══════════════════════════════════════════════════════════════════════════ */

/** Số sự kiện đang giữ (kể cả lô đã cắt chờ gửi). */
function tongDangGiu(): number {
  return tt.hangDoi.length + (tt.cho?.suKien.length ?? 0);
}

/**
 * Tràn thì bỏ CÁI CŨ NHẤT. Dữ liệu mới đáng hơn dữ liệu cũ chưa gửi được:
 * người mất mạng ba tiếng thì thứ đáng giữ là ba phút gần nhất.
 *
 * ⚠ PHẢI CẮT CẢ LÔ TREO, KHÔNG CHỈ HÀNG ĐỢI — bản đầu quên chỗ này và test bắt
 * được. Lô treo giữ những sự kiện CŨ NHẤT (nó được cắt ra trước); chỉ cắt
 * `hangDoi` thì một lô hỏng vĩnh viễn sẽ chiếm 50 chỗ bằng đúng dữ liệu cũ nhất
 * — làm ngược hẳn cái luật mà trần này sinh ra để thi hành, mà vẫn "có trần".
 *
 * Cắt bớt một lô treo rồi gửi lại DƯỚI CÙNG KHOÁ là an toàn: máy chủ đã nhận
 * bản đầy đủ thì lần gửi lại bị chống nhân đôi (không mất gì); chưa nhận thì nó
 * ghi bản đã cắt. Không đường nào sinh ra bản sao.
 */
function catBotCu(): void {
  let du = tongDangGiu() - TELEMETRY.HANG_DOI_TRAN;
  if (du <= 0) return;
  if (tt.cho) {
    const boCho = Math.min(du, tt.cho.suKien.length);
    tt.cho.suKien.splice(0, boCho);
    du -= boCho;
    if (tt.cho.suKien.length === 0) tt.cho = null;
  }
  if (du > 0) tt.hangDoi.splice(0, du);
}

/**
 * Xếp một sự kiện vào hộp thư đi. KHÔNG gửi ngay (trừ khi đã đủ lô).
 * Không bao giờ ném.
 */
export function ghiDo(loai: LoaiTelemetry, tuy: Omit<SuKienDo, 'loai'> = {}): void {
  try {
    tt.hangDoi.push({ loai, ...tuy });
    catBotCu();
    ghi();
    if (tt.hangDoi.length >= TELEMETRY.GOM_SO) void day();
  } catch {
    /* im lặng — xem đầu file */
  }
}

/** Cắt lô kế tiếp (nếu chưa có lô treo). */
function catLo(): LoTreo | null {
  if (tt.cho) return tt.cho;
  if (tt.hangDoi.length === 0) return null;
  tt.cho = { khoa: khoaMoi(), suKien: tt.hangDoi.splice(0, TELEMETRY.LO_TOI_DA) };
  ghi();
  return tt.cho;
}

/**
 * Thân gói — MỘT chỗ duy nhất dựng nó.
 *
 * ⚠ Trước đây hai đường gửi (`fetch` và `sendBeacon`) mỗi đường tự `stringify`
 * một object giống nhau. Thêm trường vào một đường mà quên đường kia thì hỏng
 * ĐÚNG Ở LẦN GỬI CUỐI PHIÊN — lần quý nhất và ít ai soi nhất.
 */
function than(lo: LoTreo): string {
  return JSON.stringify({ idempotency_key: lo.khoa, phien: PHIEN, su_kien: lo.suKien });
}

/**
 * ⚠⚠ HẠN CHỜ LÀ BẮT BUỘC Ở ĐÂY, không phải phòng xa (rà mạng kém 11/08).
 *
 * `fetch` không tự bỏ cuộc. Socket treo thì lời hứa KHÔNG BAO GIỜ settle ⇒
 * `finally` trong `day()` không chạy ⇒ cờ `dangGui` kẹt `true` VĨNH VIỄN ⇒ mọi
 * lượt đẩy sau đó thoát ngay ở cửa đầu, và **cả phiên không gửi thêm một dòng
 * nào**. Tức dụng cụ đo chết đúng lúc có chuyện để đo — mà toàn bộ nếp D62/D65
 * là chẩn bằng dữ liệu prod trước.
 *
 * File này cố ý KHÔNG đi qua `api()` (nó phải im lặng tuyệt đối, không ghi lỗi
 * đệ quy) — nhưng nó bỏ luôn cả hạn chờ theo, và đó là chỗ hở.
 *
 * 10s ngắn hơn 15s của `api()` có chủ ý: đây là dữ liệu VẬN HÀNH, mất một lô
 * là mất một chút xu hướng (A9 cho phép xoá); còn hàng đợi thì vẫn nằm trong
 * localStorage nên lô này sẽ bay ở lượt sau.
 */
const HAN_GUI_MS = 10_000;

async function guiFetch(lo: LoTreo, cuoiPhien: boolean): Promise<boolean> {
  const bo = new AbortController();
  const hen = setTimeout(() => bo.abort(), HAN_GUI_MS);
  try {
    const res = await fetch(URL_DO, {
      method: 'POST',
      credentials: 'include',
      headers: { 'content-type': 'application/json' },
      body: than(lo),
      keepalive: cuoiPhien,
      signal: bo.signal,
    });
    return res.ok;
  } finally {
    clearTimeout(hen);
  }
}

/**
 * ĐẨY. `cuoiPhien` = app sắp bị ẩn/đóng.
 *
 * ⚠ LẦN GỬI CUỐI PHIÊN LÀ LẦN QUÝ NHẤT (nó mang thời lượng màn hình cuối và
 * lý do rời đi) và cũng là lần dễ mất nhất — `fetch` thường không kịp bay khi
 * người ta đóng app. Nên nó đi bằng `sendBeacon`.
 *
 * ⚠⚠ `sendBeacon` KHÔNG đặt được `Content-Type` như `fetch` — phải bọc `Blob`
 * có `type: 'application/json'`, nếu không server đọc ra `text/plain` và parse
 * hỏng ĐÚNG Ở LẦN GỬI CUỐI, tức đúng lúc không ai còn nhìn để phát hiện.
 *
 * Beacon chỉ mang cookie khi CÙNG GỐC. Prod đi qua Worker proxy cùng gốc (D18)
 * nên bình thường là cùng gốc; đặt `VITE_API_BASE_URL` khác gốc thì rơi về
 * `fetch keepalive` (có `credentials`), chậm hơn nhưng không mất danh tính.
 */
export async function day(cuoiPhien = false): Promise<void> {
  if (dangGui) return;
  dangGui = true;
  try {
    const lo = catLo();
    if (!lo) return;

    let xong = false;
    if (cuoiPhien && BASE === '' && typeof navigator !== 'undefined' && navigator.sendBeacon) {
      const goi = new Blob([than(lo)], { type: 'application/json' });
      xong = navigator.sendBeacon(URL_DO, goi);
    } else {
      xong = await guiFetch(lo, cuoiPhien);
    }

    if (xong) {
      tt.cho = null;
      ghi();
    }
    /*
     * Thất bại thì GIỮ NGUYÊN lô treo, CẢ KHOÁ. Gửi lại cùng khoá là an toàn:
     * server chống nhân đôi theo `idempotency_key` (cùng cơ chế đường đặt lệnh).
     * Sinh khoá mới mỗi lần gửi lại chính là cách làm hỏng phép chống đó.
     */
  } catch {
    /* mất mạng / bị chặn — lô treo ở lại, thử lại ở nhịp sau */
  } finally {
    dangGui = false;
  }
}

/* ══════════════════════════════════════════════════════════════════════════
 * VÒNG ĐỜI
 * ══════════════════════════════════════════════════════════════════════════ */

/**
 * Mốc bắt đầu ĐOẠN phiên đang mở. Null = đang ở nền.
 *
 * ⚠ "PHIÊN" Ở ĐÂY LÀ MỘT ĐOẠN Ở TIỀN CẢNH, không phải cả lần mở app. Trên điện
 * thoại người ta ra vào liên tục, và câu hỏi cần trả lời là *"chơi trong mấy
 * giờ · có quay lại thường xuyên không"* — cộng các đoạn lại ra thời lượng
 * thật, đếm số đoạn ra tần suất quay lại. Đo "cả lần mở app" thì một tab bị bỏ
 * quên hai ngày sẽ báo là hai ngày chơi.
 */
let phienTu: number | null = null;

function moPhien(): void {
  if (phienTu !== null) return;
  phienTu = Date.now();
  // D603 — mở từ bản cài, tab, hay trình duyệt nhúng (`cai_app.ts`).
  ghiDo('phien_mo', { chi_tiet: { display_mode: cheDoHienThi() } });
}

function dongPhien(): void {
  if (phienTu === null) return;
  ghiDo('phien_dong', { ms: Date.now() - phienTu });
  phienTu = null;
}

/**
 * ⚠ THỨ TỰ TRONG HÀM NÀY LÀ CẢ VẤN ĐỀ: `dongPhien()` phải chạy TRƯỚC `day(true)`.
 *
 * Bản đầu để `phien_dong` ở một listener riêng (`pagehide`) và cú đẩy cuối ở
 * đây. Nhưng `visibilitychange` bắn TRƯỚC `pagehide`, nên lô cuối bay đi rồi
 * `phien_dong` mới được xếp hàng — tức thời lượng phiên là thứ MẤT THƯỜNG XUYÊN
 * NHẤT trong khi nó là một trong hai câu hỏi chính. Gộp vào một chỗ thì không
 * còn cuộc đua nào để thua.
 */
/* ── MÀN ĐANG XEM ────────────────────────────────────────────────────────────
 *
 * ⚠⚠ VÌ SAO TRẠNG THÁI NÀY NẰM Ở CẤP MODULE CHỨ KHÔNG TRONG `useEffect`.
 *
 * Bản đầu phát `man_ra` trong hàm DỌN của useEffect. Mà React chỉ chạy hàm dọn
 * khi đổi route TRONG app — nó KHÔNG chạy khi người ta đóng tab, chuyển app,
 * hay tắt máy. Nên MÀN CUỐI CÙNG của mỗi lượt ngồi không bao giờ có dòng, tức
 * mất đúng cái màn người ta rời đi — câu hỏi mà cả mặt HÀNH TRÌNH sinh ra để
 * trả lời. Đo trên prod: 9 `man_vao` mà chỉ 1 `man_ra`.
 * Đường DUY NHẤT còn chạy được lúc ấy là `visibilitychange`, và nó ở đây, ngoài
 * React — nên cái đồng hồ màn hình cũng phải ở đây.
 *
 * ⚠ HỆ QUẢ VỀ NGỮ NGHĨA, PHẢI NHỚ KHI ĐỌC SỐ: `man_ra` nay là một ĐOẠN CHÚ Ý,
 * không phải một lượt xem. Ẩn app rồi mở lại sinh HAI đoạn cho cùng một lượt.
 * Vậy nên: đếm LƯỢT thì đọc `man_vao`, đo THỜI GIAN thì cộng `man_ra.ms`.
 * Lẫn hai thứ đó là lỗi đã có thật ở bản trước (`so_lan_vao` đếm `man_ra`).
 */
let manDangXem: string | null = null;
let manTu = 0;
/**
 * Màn người chơi vừa RỜI (mẫu route) — ô Báo lỗi ở Hồ sơ gửi kèm "màn bạn vừa đứng trước khi vào Hồ sơ" (SPEC
 * bao-loi-nguoi-choi, điều khoản T5). Chỉ trong bộ nhớ, không ghi đi đâu thêm.
 */
let manVuaRoiDo: string | null = null;

/** Màn ngay trước màn đang xem (null = mở app thẳng vào màn này). */
export function manVuaRoi(): string | null {
  return manVuaRoiDo;
}

function moMan(man: string): void {
  manDangXem = man;
  manTu = Date.now();
}

/** Chốt đoạn đang đo. Giữ nguyên tên màn — người ta có thể quay lại. */
function dongMan(): void {
  if (manDangXem === null) return;
  ghiDo('man_ra', { man: manDangXem, ms: Date.now() - manTu });
  manTu = Date.now();
}

function roiMan(): void {
  dongMan();
  if (manDangXem !== null) manVuaRoiDo = manDangXem;
  manDangXem = null;
}

/*
 * Việc phải làm khi lượt xem KẾT THÚC — dù kết thúc bằng điều hướng hay bằng
 * đóng app. Màn trận đăng ký vào đây để `tran_thoat` không chết theo cùng cách
 * `man_ra` vừa chết.
 */
let khiRoi: Array<() => void> = [];

export function dangKyKhiRoi(fn: () => void): () => void {
  khiRoi.push(fn);
  return () => {
    khiRoi = khiRoi.filter((f) => f !== fn);
  };
}

function chayKhiRoi(): void {
  for (const f of khiRoi) {
    try {
      f();
    } catch {
      /* một chỗ hỏng không được kéo theo chỗ khác */
    }
  }
}

function khiDoiHienThi(): void {
  try {
    if (document.visibilityState === 'hidden') {
      /*
       * ⚠ THỨ TỰ: mọi thứ phải XẾP HÀNG XONG trước `day(true)`. Cùng lý do đã
       * ghi bên dưới cho `phien_dong` — lô cuối bay đi rồi mới ghi thì thứ ghi
       * sau là thứ mất thường xuyên nhất, mà ở đây nó lại là thứ quý nhất.
       */
      dongMan();
      chayKhiRoi();
      dongPhien();
      void day(true);
    } else {
      moPhien();
      // Không tính khoảng thời gian app nằm trong nền vào thời gian xem màn.
      manTu = Date.now();
    }
  } catch {
    /* im lặng */
  }
}

/**
 * Bật đường ống. Gọi MỘT LẦN lúc app dựng; trả về hàm gỡ.
 * Nạp lại hàng đợi còn sót của phiên trước (mất mạng rồi tải lại trang).
 */
export function khoiDongDo(): () => void {
  try {
    tt = doc();
    if (hen === null) hen = setInterval(() => void day(), TELEMETRY.GOM_MS);
    document.addEventListener('visibilitychange', khiDoiHienThi);
    /*
     * ⚠ THỨ TỰ: kiểm hàng tồn TRƯỚC, mở phiên SAU.
     * Bản đầu làm ngược và test bắt được: `moPhien()` tự xếp một sự kiện vào
     * hàng đợi, nên `tongDangGiu() > 0` LÚC NÀO CŨNG đúng và mỗi lần mở app là
     * một request ngay lập tức — đúng cái mà việc gộp lô sinh ra để tránh (trần
     * 1 triệu request/tháng, A9). "Còn sót" phải nghĩa là sót của PHIÊN TRƯỚC.
     */
    if (tongDangGiu() > 0) void day();
    moPhien();
  } catch {
    /* im lặng */
  }
  return () => {
    try {
      if (hen !== null) {
        clearInterval(hen);
        hen = null;
      }
      document.removeEventListener('visibilitychange', khiDoiHienThi);
      dongPhien();
      void day(true);
    } catch {
      /* im lặng */
    }
  };
}

/**
 * Đo MÀN HÌNH: vào · ra · ở bao lâu. Gọi MỘT LẦN ở khung chung (`AppShell`) —
 * một chỗ duy nhất phủ mọi màn, thay vì rắc lời gọi khắp 20 màn rồi quên vài cái.
 */
export function useDoMan(pathname: string): void {
  useEffect(() => {
    ghiDo('man_vao', { man: manCuaDuong(pathname) });
    moMan(manCuaDuong(pathname));
    return () => roiMan();
  }, [pathname]);
}

/**
 * CHỈ DÙNG TRONG TEST — mở một màn mà không cần dựng cây React.
 * Cùng idiom `_datLaiChoTest`/`_trangThaiChoTest` đã có sẵn ở file này.
 */
export function _moManChoTest(man: string): void {
  moMan(man);
}

/** CHỈ DÙNG TRONG TEST — đưa module về trạng thái trắng. */
export function _datLaiChoTest(): void {
  tt = { cho: null, hangDoi: [] };
  dangGui = false;
  phienTu = null;
  manDangXem = null;
  manVuaRoiDo = null;
  manTu = 0;
  khiRoi = [];
  if (hen !== null) {
    clearInterval(hen);
    hen = null;
  }
  try {
    localStorage.removeItem(TELEMETRY.KHOA_LUU);
  } catch {
    /* im lặng */
  }
}

/** CHỈ DÙNG TRONG TEST — soi hàng đợi mà không phải đọc localStorage. */
export function _trangThaiChoTest(): { cho: LoTreo | null; hangDoi: SuKienDo[] } {
  return { cho: tt.cho, hangDoi: tt.hangDoi };
}
