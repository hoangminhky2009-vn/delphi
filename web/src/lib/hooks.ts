/** Hooks trình diễn dùng chung — mọi animation phải tôn trọng prefers-reduced-motion. */
import { useEffect, useRef, useState, useSyncExternalStore } from 'react';

function subscribeReducedMotion(onChange: () => void): () => void {
  const m = window.matchMedia('(prefers-reduced-motion: reduce)');
  m.addEventListener('change', onChange);
  return () => m.removeEventListener('change', onChange);
}

export function useReducedMotion(): boolean {
  return useSyncExternalStore(
    subscribeReducedMotion,
    () => window.matchMedia('(prefers-reduced-motion: reduce)').matches,
    () => false,
  );
}

/**
 * Gõ chữ kiểu terminal (Mẫu E: 24ms/ký tự). reduced-motion → hiện ngay toàn bộ.
 * `enabled=false` → chuỗi rỗng (chưa tới nhịp gõ).
 */
export function useTypewriter(
  text: string,
  { msPerChar = 24, enabled = true }: { msPerChar?: number; enabled?: boolean } = {},
): { shown: string; done: boolean } {
  const reduced = useReducedMotion();
  const instant = reduced || msPerChar <= 0;
  const [count, setCount] = useState(0);

  useEffect(() => {
    if (!enabled) {
      setCount(0);
      return;
    }
    if (instant) {
      setCount(text.length);
      return;
    }
    setCount(0);
    let i = 0;
    let timer: ReturnType<typeof setTimeout>;
    const tick = () => {
      i += 1;
      setCount(i);
      if (i < text.length) timer = setTimeout(tick, msPerChar);
    };
    timer = setTimeout(tick, msPerChar);
    return () => clearTimeout(timer);
  }, [text, enabled, instant, msPerChar]);

  if (!enabled) return { shown: '', done: false };
  return { shown: text.slice(0, count), done: count >= text.length };
}

/**
 * SỐ CHẠY THEO NẤC (D68 §2: "số chạy chứ không nhảy cóc") — giá trị đổi thì
 * số hiển thị đuổi theo qua N nấc rời rạc (steps, không phải tween mượt —
 * lưới pixel đếm bậc). Dùng cho tiền mặt trong shop: bấm mốc là thấy ví
 * mình TỤT XUỐNG từng nhịp như đếm chip, không phải một cú thay số lạnh.
 * reduced-motion → trả thẳng giá trị đích.
 */
export function useSoChay(dich: number, { nac = 4, msMoiNac = 34 }: {
  nac?: number; msMoiNac?: number;
} = {}): number {
  const reduced = useReducedMotion();
  const [hien, setHien] = useState(dich);
  const truoc = useRef(dich);
  useEffect(() => {
    const tu = truoc.current;
    truoc.current = dich;
    if (reduced || tu === dich) { setHien(dich); return undefined; }
    let i = 0;
    const t = setInterval(() => {
      i += 1;
      if (i >= nac) { setHien(dich); clearInterval(t); return; }
      // Làm tròn về bội 10 giữa chừng — số lẻ chớp nhoáng đọc như nhiễu.
      setHien(Math.round((tu + ((dich - tu) * i) / nac) / 10) * 10);
    }, msMoiNac);
    return () => clearInterval(t);
  }, [dich, nac, msMoiNac, reduced]);
  return hien;
}

/**
 * ĐẾM NGƯỢC VÒNG ĐẤU — MỘT bộ đếm duy nhất cho cả màn (D76).
 *
 * `conLaiS` là số giây server gửi, `nhanLuc` là mốc `Date.now()` LÚC NHẬN
 * response đó (xem `dhNeo` ở AlphaDraftMatch). Hook trừ phần đã trôi kể từ mốc
 * ấy — nên state bị áp trễ (overlay khoảnh khắc giữ màn tới 12s) cũng không
 * làm đồng hồ nói dối lên.
 *
 * ⚠ VÌ SAO LÀ HOOK CHUNG CHỨ KHÔNG PHẢI LOGIC RIÊNG TRONG DongHoVong: từ D76
 * có HAI thứ đọc cùng con số này — mặt đồng hồ và viền cảnh báo sắp hết giờ.
 * Cài đặt thứ hai của cùng một phép trừ sẽ TRÔI (D61), và cú trôi ở đây biểu
 * hiện là viền đỏ nháy trong khi đồng hồ còn 20 giây — hoặc tệ hơn, im khi
 * đồng hồ còn 3. Một nguồn, hai chỗ đọc.
 */
export function useDemNguocVong(conLaiS: number, nhanLuc: number): number {
  const tinh = () => Math.max(0, conLaiS - Math.floor((Date.now() - nhanLuc) / 1000));
  const [con, setCon] = useState(tinh);
  useEffect(() => {
    setCon(tinh());
    /*
     * Dep là (conLaiS, nhanLuc): MỖI response đóng một dấu `nhanLuc` mới nên
     * effect luôn chạy lại khi có dữ liệu mới — kể cả khi hai vòng liên tiếp
     * cùng thời lượng trả cùng một `conLaiS` (bẫy 27/07, trước đây phải vá
     * bằng `key={st.vong}` ở nơi gọi).
     */
    const id = setInterval(() => setCon(tinh()), 250);
    return () => clearInterval(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [conLaiS, nhanLuc]);
  return con;
}

/** Đồng hồ tick — CHỈ cho hiển thị đếm ngược (giờ khóa thật do server quyết). */
export function useNow(intervalMs: number | false): number {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (intervalMs === false) return;
    const t = setInterval(() => setNow(Date.now()), intervalMs);
    return () => clearInterval(t);
  }, [intervalMs]);
  return now;
}

/** Tùy chọn UI lưu localStorage (vd toggle scanline — bắt buộc giữ, doc mục 7.4). */
export function useLocalPref(key: string, defaultValue: boolean): [boolean, (v: boolean) => void] {
  const storageKey = `delphi_ui.${key}`;
  const [value, setValue] = useState<boolean>(() => {
    try {
      const raw = localStorage.getItem(storageKey);
      return raw === null ? defaultValue : raw === 'true';
    } catch {
      return defaultValue;
    }
  });
  const set = useRef((v: boolean) => {
    setValue(v);
    try {
      localStorage.setItem(storageKey, String(v));
    } catch {
      /* private mode — thôi cũng được */
    }
  });
  return [value, set.current];
}
