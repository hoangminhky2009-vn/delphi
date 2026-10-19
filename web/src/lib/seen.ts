/**
 * Đánh dấu câu hỏi ĐÃ XEM LỄ CÔNG BỐ (lưu localStorage, theo máy).
 *
 * VÌ SAO CÓ FILE NÀY (chỉ đạo founder 19/07): nếu danh sách Kết quả và Hồ sơ
 * phun thẳng ±T ra ngoài thì người chơi biết thắng/thua trước khi mở → lễ công
 * bố thành vô nghĩa, chẳng ai buồn bấm vào. Số ±T chỉ được lộ SAU khi user tự
 * bấm công bố ở màn Kết quả.
 *
 * Đây thuần là trạng thái TRÌNH BÀY phía client — không phải nguồn chân lý,
 * mất cũng không sao (mất = xem lại lễ một lần nữa, không hại gì).
 */
import { useMemo, useSyncExternalStore } from 'react';

const KEY = 'delphi.revealed_results';
const EVENT = 'delphi:revealed';

function read(): Set<string> {
  try {
    const raw = localStorage.getItem(KEY);
    return new Set<string>(raw ? (JSON.parse(raw) as string[]) : []);
  } catch {
    return new Set();
  }
}

export function hasRevealed(marketId: string): boolean {
  return read().has(marketId);
}

export function markRevealed(marketId: string): void {
  try {
    const set = read();
    if (set.has(marketId)) return;
    set.add(marketId);
    // giữ tối đa 200 mục gần nhất — không phình localStorage vô hạn
    localStorage.setItem(KEY, JSON.stringify([...set].slice(-200)));
    window.dispatchEvent(new Event(EVENT));
  } catch {
    /* private mode — thôi cũng được */
  }
}

function subscribe(cb: () => void): () => void {
  window.addEventListener(EVENT, cb);
  window.addEventListener('storage', cb);
  return () => {
    window.removeEventListener(EVENT, cb);
    window.removeEventListener('storage', cb);
  };
}

function snapshot(): string {
  try {
    return localStorage.getItem(KEY) ?? '';
  } catch {
    return '';
  }
}

/** Tập câu hỏi đã xem lễ — tự cập nhật khi có lễ vừa chạy xong. */
export function useRevealed(): Set<string> {
  const raw = useSyncExternalStore(subscribe, snapshot, () => '');
  return useMemo(() => {
    try {
      return new Set<string>(raw ? (JSON.parse(raw) as string[]) : []);
    } catch {
      return new Set<string>();
    }
  }, [raw]);
}
