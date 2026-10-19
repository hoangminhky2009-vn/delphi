/**
 * NHẬN DIỆN NƠI APP ĐANG CHẠY — để biết người dùng CÀI được không, cài bằng cách nào, và đã cài chưa
 * (SPEC `docs/spec/cai-app-pfm-trong-ban-cai.md`, D603).
 *
 * ⚠ Bản cài = ĐÚNG bản web (cùng mã, cùng địa chỉ). Thứ khác nhau duy nhất là NƠI NÓ CHẠY: tab trình duyệt, cửa sổ
 * độc lập sau khi "Thêm vào màn hình chính", hay trình duyệt NHÚNG của Zalo/Facebook/Messenger/TikTok — loại cuối
 * không cài được, và kho trên máy ở đó dễ mất nhất.
 *
 * ⚠ Hàm `nhanDien` THUẦN (nhận UA + vài cờ, trả kết quả) để bài test chạy cả bảng UA mà không giả `navigator`.
 * Chỉ `moiTruongHienTai` / `daCai` đọc `window` — và bọc `try`: tệp này hỏng thì app vẫn phải chạy.
 *
 * ⚠ KHÔNG dùng để CHẶN theo trình duyệt: nhận diện UA là đoán, đoán sai thì người dùng mất lối. Kết quả chỉ chọn
 * CÂU HƯỚNG DẪN nào để hiện và mã nào để ghi telemetry. Câu "đã cài chưa" thì KHÔNG đoán bằng UA — đọc
 * `display-mode` (xem `daCai`).
 */

export type NenCaiApp = 'ios' | 'android' | 'desktop' | 'nhung';

export type TrinhDuyet =
  | 'safari' | 'chrome' | 'samsung' | 'firefox' | 'edge'
  | 'zalo' | 'facebook' | 'messenger' | 'instagram' | 'tiktok' | 'discord' | 'webview' | 'khac';

/**
 * Cài bằng cách nào:
 *   · `mot_cham`       — Chrome/Edge/Samsung (Android, máy tính): trình duyệt bắn `beforeinstallprompt`, một chạm ra hộp cài.
 *   · `huong_dan_ios`  — iPhone/iPad: Apple không cho web tự mời cài ⇒ ba bước Chia sẻ → Thêm vào MH chính.
 *   · `mo_trinh_duyet` — trình duyệt nhúng / trình duyệt không cài được ⇒ mở lại bằng Chrome/Safari.
 *   · `mo_ngoai_discord` — đang chạy trong iframe Discord Activity.
 */
export type CachCai = 'mot_cham' | 'huong_dan_ios' | 'mo_trinh_duyet' | 'mo_ngoai_discord';

export interface MoiTruong {
  nen: NenCaiApp;
  trinhDuyet: TrinhDuyet;
  cachCai: CachCai;
}

export interface CoNhanDien {
  /** Số điểm chạm (`navigator.maxTouchPoints`) — iPad đời mới khai UA của máy Mac, chỉ lộ ra qua cờ này. */
  diemCham?: number;
  /** Đang nằm trong iframe của trang khác (`window.self !== window.top`). */
  trongKhung?: boolean;
}

/**
 * Trình duyệt NHÚNG — đọc TRƯỚC mọi thứ khác, vì UA của chúng mang luôn chữ `Safari`/`Chrome` của lõi bên dưới.
 * ⚠ Messenger đứng TRƯỚC Facebook: UA Messenger có cả `FBAN`.
 */
const NHUNG: ReadonlyArray<[TrinhDuyet, RegExp]> = [
  ['zalo', /Zalo/i],
  ['messenger', /MessengerForiOS|FBAN\/Messenger|FB_IAB\/Orca|Orca-Android|MessengerLite/i],
  ['facebook', /FBAN|FBAV|FB_IAB|FBIOS|FB4A/],
  ['instagram', /Instagram/],
  ['tiktok', /musical_ly|Bytedance|BytedanceWebview|TikTok|trill_/i],
];

export function nhanDien(ua: string, co: CoNhanDien = {}): MoiTruong {
  if (co.trongKhung) return { nen: 'nhung', trinhDuyet: 'discord', cachCai: 'mo_ngoai_discord' };

  for (const [ten, mau] of NHUNG) {
    if (mau.test(ua)) return { nen: 'nhung', trinhDuyet: ten, cachCai: 'mo_trinh_duyet' };
  }

  const ios = /iPhone|iPad|iPod/.test(ua) || (/Macintosh/.test(ua) && (co.diemCham ?? 0) > 1);
  if (ios) {
    // Từ iOS 16.4, Chrome/Edge/Firefox trên iPhone cũng "Thêm vào MH chính" được qua nút Chia sẻ — cùng ba bước.
    const trinh: TrinhDuyet = /CriOS/.test(ua) ? 'chrome' : /FxiOS/.test(ua) ? 'firefox' : /EdgiOS/.test(ua) ? 'edge' : 'safari';
    return { nen: 'ios', trinhDuyet: trinh, cachCai: 'huong_dan_ios' };
  }

  if (/Android/.test(ua)) {
    // WebView trần của một app lạ (`; wv)`) không cài được, dù UA có chữ Chrome.
    if (/; wv\)/.test(ua)) return { nen: 'nhung', trinhDuyet: 'webview', cachCai: 'mo_trinh_duyet' };
    if (/SamsungBrowser/.test(ua)) return { nen: 'android', trinhDuyet: 'samsung', cachCai: 'mot_cham' };
    if (/EdgA/.test(ua)) return { nen: 'android', trinhDuyet: 'edge', cachCai: 'mot_cham' };
    // Firefox Android cài được, nhưng qua menu ⋮ chứ không qua `beforeinstallprompt`.
    if (/Firefox/.test(ua)) return { nen: 'android', trinhDuyet: 'firefox', cachCai: 'mo_trinh_duyet' };
    if (/Chrome/.test(ua)) return { nen: 'android', trinhDuyet: 'chrome', cachCai: 'mot_cham' };
    return { nen: 'android', trinhDuyet: 'khac', cachCai: 'mo_trinh_duyet' };
  }

  // Máy tính: Chrome/Edge cài được; Safari macOS 17+ thì "Thêm vào Dock" (menu Tệp) — không tự mời được ⇒ coi như
  // mở bằng Chrome; Firefox máy tính không cài được.
  if (/Edg\//.test(ua)) return { nen: 'desktop', trinhDuyet: 'edge', cachCai: 'mot_cham' };
  if (/Firefox/.test(ua)) return { nen: 'desktop', trinhDuyet: 'firefox', cachCai: 'mo_trinh_duyet' };
  if (/Chrome/.test(ua)) return { nen: 'desktop', trinhDuyet: 'chrome', cachCai: 'mot_cham' };
  if (/Safari/.test(ua)) return { nen: 'desktop', trinhDuyet: 'safari', cachCai: 'mo_trinh_duyet' };
  return { nen: 'desktop', trinhDuyet: 'khac', cachCai: 'mo_trinh_duyet' };
}

/**
 * ĐÃ CÀI CHƯA = app đang chạy trong cửa sổ độc lập (mở từ icon màn hình chính).
 *
 * ⚠ Hỏi `display-mode`, KHÔNG đoán bằng UA: cùng một UA vừa là tab Safari vừa là bản cài. iOS cũ chỉ trả lời qua
 * `navigator.standalone`, nên đọc cả hai. Hỏng ⇒ `false` (tệ nhất là thấy lời mời cài thêm một lần).
 */
export function daCai(): boolean {
  try {
    if (typeof window === 'undefined') return false;
    const mm = typeof window.matchMedia === 'function'
      ? (q: string) => window.matchMedia(q).matches
      : () => false;
    if (mm('(display-mode: standalone)') || mm('(display-mode: fullscreen)') || mm('(display-mode: minimal-ui)')) return true;
    return (navigator as Navigator & { standalone?: boolean }).standalone === true;
  } catch {
    return false;
  }
}

export function moiTruongHienTai(): MoiTruong {
  try {
    let trongKhung = false;
    try { trongKhung = window.self !== window.top; } catch { trongKhung = true; /* khác origin ⇒ chắc chắn trong khung */ }
    return nhanDien(navigator.userAgent, { diemCham: navigator.maxTouchPoints, trongKhung });
  } catch {
    return { nen: 'desktop', trinhDuyet: 'khac', cachCai: 'mo_trinh_duyet' };
  }
}

/** Mã `display_mode` cho telemetry `phien_mo` (`config/telemetry.ts`). */
export type CheDoHienThi = 'standalone' | 'browser' | 'nhung';

export function cheDoHienThi(): CheDoHienThi {
  if (daCai()) return 'standalone';
  return moiTruongHienTai().nen === 'nhung' ? 'nhung' : 'browser';
}
