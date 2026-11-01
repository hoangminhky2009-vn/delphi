/**
 * LỜI MỜI CÀI APP — chỗ DUY NHẤT nói chuyện với trình duyệt về việc cài, và chỗ duy nhất phát telemetry `cai_app`
 * (SPEC `docs/spec/cai-app-pfm-trong-ban-cai.md` mục 4–5, D603 đợt 2).
 *
 * ⚠ `beforeinstallprompt` (Chrome/Edge/Samsung — Android và máy tính) bắn RẤT SỚM, thường trước khi React kịp dựng màn nào. Bắt ở
 * `main.tsx` (`khoiDongMoiCai`) rồi GIỮ: nút "Cài app" ở cổng / màn đăng nhập / thẻ hub gọi `moiCai()` đúng lúc người ta bấm. Mỗi
 * sự kiện chỉ `prompt()` được MỘT lần — dùng xong là bỏ, trình duyệt sẽ bắn cái mới nếu còn mời được.
 * ⚠ `preventDefault()` tắt thanh mời nhỏ mặc định của Chrome: lời mời của app (có lý do: giữ sổ) thay nó, không chồng hai lời mời.
 * ⚠ iPhone KHÔNG có sự kiện này (Apple không cho web tự mời) ⇒ `coLoiMoi` luôn `false` ⇒ cổng hiện ba bước Chia sẻ.
 *
 * Telemetry, KHÔNG `events` (A9): không tiền, không niềm tin — chỉ biết lời mời có kéo người ta cài không.
 */
import { useSyncExternalStore } from 'react';
import { moiTruongHienTai } from './cai_app';
import { ghiDo } from './telemetry';

/** Sự kiện `beforeinstallprompt` — chưa có trong `lib.dom` của TypeScript. */
interface SuKienMoiCai extends Event {
  prompt(): Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

/** Lời mời hiện ở đâu (`config/telemetry.ts` `cai_app.noi`). */
export type NoiMoiCai = 'cong_pfm' | 'dang_nhap' | 'hub' | 'bang_nhung';
export type BuocCaiApp = 'hien' | 'bam_cai' | 'da_cai' | 'bo' | 'mo_trinh_duyet';

let loiMoi: SuKienMoiCai | null = null;
let vuaCai = false;
/** Nơi bấm cài gần nhất — gắn cho `da_cai` (cài qua menu trình duyệt thì không có nơi). */
let noiCuoi: NoiMoiCai | null = null;
/** `hien` ghi MỘT lần mỗi nơi mỗi lần nạp trang — Hub dựng lại mỗi lần quay về, đếm mỗi lần là đếm số lần về Hub. */
const daHien = new Set<NoiMoiCai>();

const nghe = new Set<() => void>();
let anh: { coLoiMoi: boolean; vuaCai: boolean } = { coLoiMoi: false, vuaCai: false };
function bao(): void {
  anh = { coLoiMoi: loiMoi !== null, vuaCai };
  for (const f of nghe) f();
}

export function doCaiApp(buoc: BuocCaiApp, noi: NoiMoiCai | null): void {
  ghiDo('cai_app', { chi_tiet: { buoc, ...(noi ? { noi } : {}), nen: moiTruongHienTai().nen } });
}

/** `hien` một lần mỗi nơi mỗi lần nạp trang. */
export function doHien(noi: NoiMoiCai): void {
  if (daHien.has(noi)) return;
  daHien.add(noi);
  doCaiApp('hien', noi);
}

/** Gắn hai bộ nghe của trình duyệt. Gọi MỘT lần ở `main.tsx`, trước khi dựng React. Trả hàm gỡ (cho test). */
export function khoiDongMoiCai(): () => void {
  if (typeof window === 'undefined') return () => {};
  const truoc = (e: Event): void => {
    e.preventDefault();
    loiMoi = e as SuKienMoiCai;
    bao();
  };
  const xong = (): void => {
    vuaCai = true;
    loiMoi = null;
    doCaiApp('da_cai', noiCuoi);
    bao();
  };
  window.addEventListener('beforeinstallprompt', truoc);
  window.addEventListener('appinstalled', xong);
  return () => {
    window.removeEventListener('beforeinstallprompt', truoc);
    window.removeEventListener('appinstalled', xong);
  };
}

export type KetQuaMoiCai = 'chap_nhan' | 'tu_choi' | 'khong_co';

/**
 * Bật hộp cài của trình duyệt. `khong_co` = trình duyệt chưa (hoặc không) cho mời — màn gọi phải có đường lui (hướng dẫn qua menu).
 * ⚠ Gọi TRONG cú bấm của người dùng: `prompt()` ngoài cử chỉ người dùng bị trình duyệt từ chối.
 */
export async function moiCai(noi: NoiMoiCai): Promise<KetQuaMoiCai> {
  const e = loiMoi;
  if (e === null) return 'khong_co';
  noiCuoi = noi;
  loiMoi = null;
  bao();
  doCaiApp('bam_cai', noi);
  try {
    await e.prompt();
    const chon = await e.userChoice;
    if (chon.outcome === 'dismissed') {
      doCaiApp('bo', noi);
      return 'tu_choi';
    }
    return 'chap_nhan';
  } catch {
    return 'khong_co';
  }
}

/** Trạng thái lời mời cho màn: có hộp cài một chạm không · vừa cài xong trong trang này chưa (E4). */
export function useMoiCai(): { coLoiMoi: boolean; vuaCai: boolean } {
  return useSyncExternalStore(
    (f) => { nghe.add(f); return () => { nghe.delete(f); }; },
    () => anh,
    () => anh,
  );
}

/** Địa chỉ để mở lại bằng trình duyệt khác — GỐC app, không mang đường đang đứng (có thể chứa mã trận/kèo). */
export function linkApp(): string {
  try { return `${window.location.origin}/`; } catch { return '/'; }
}

/**
 * Chép link (E2). Trình duyệt nhúng hay chặn `navigator.clipboard` ⇒ lùi về `execCommand('copy')` trên một ô chữ tạm; cả hai hỏng thì
 * trả `false` và màn vẫn đang HIỆN link bằng chữ để người ta nhấn giữ chép tay.
 */
export async function chepLink(noi: NoiMoiCai): Promise<boolean> {
  doCaiApp('mo_trinh_duyet', noi);
  const link = linkApp();
  try {
    await navigator.clipboard.writeText(link);
    return true;
  } catch {
    try {
      const o = document.createElement('textarea');
      o.value = link;
      o.setAttribute('readonly', '');
      o.style.position = 'fixed';
      o.style.opacity = '0';
      document.body.appendChild(o);
      o.select();
      const ok = document.execCommand('copy');
      o.remove();
      return ok;
    } catch {
      return false;
    }
  }
}

/** Chỉ cho test: xoá trạng thái module giữa các bài. */
export function _datLaiMoiCaiChoTest(): void {
  loiMoi = null;
  vuaCai = false;
  noiCuoi = null;
  daHien.clear();
  bao();
}
