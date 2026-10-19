/**
 * MÃ LỖI GẦN NHẤT client thấy (SPEC chan-truoc-beta — báo lỗi kèm "mã lỗi gần nhất"). Chỉ giữ trong bộ nhớ của tab: một MÃ
 * (`timeout` · `network` · `sai_vong` · mã băm lỗi màn…), không giữ thông điệp, không giữ thân phản hồi.
 * Ghi ở cửa duy nhất ra backend (`api/client.ts`) và ở màn lỗi (`ManLoi`); đọc ở `guiBaoLoi`.
 */
let ganNhat: string | null = null;

const KHUON = /^[a-zA-Z0-9_.:\-]{1,64}$/;

export function ghiLoiGanNhat(ma: string): void {
  if (KHUON.test(ma)) ganNhat = ma;
}

export function docLoiGanNhat(): string | null {
  return ganNhat;
}
