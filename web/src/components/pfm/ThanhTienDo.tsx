/**
 * PFM — THANH TIẾN ĐỘ HŨ (`.tt` của demo đã chốt).
 *
 * ⚠⚠ CHÉP TỪ DEMO, KHÔNG THIẾT KẾ LẠI (A11.25). Năm nấc màu và ba mốc 25/50/75 là bản
 * founder đã chốt, và mỗi nấc có số đo đi kèm (≥ 4,2 tương phản so với lòng thanh; ΔE00
 * giữa hai nấc bất kỳ ≥ 18,1). Đổi một nấc là làm hỏng một phép đo đã có kết quả.
 */
import s from './ThanhTienDo.module.css';

/**
 * ⚠ THỨ TỰ NẤC LÀ CÓ CHỦ Ý (demo, sửa từ D239): lạnh → ấm dần → XANH khi xong. Founder
 * muốn hũ đầy "biến thành màu XANH", nên xanh phải **dành riêng** cho 100% — để `--win`
 * ở nấc 50–74% thì một hũ 60% và một hũ 100% cùng xanh, hai trạng thái khác hẳn nhau mà
 * chung một mã màu.
 */
export const MOC_TIEN_DO = [
  { tu: 0, tok: '--c-2b' },    // 0–24%   — đã bắt đầu
  { tu: 25, tok: '--c-3' },    // 25–49%  — chỗ đang sống
  { tu: 50, tok: '--v-2b' },   // 50–74%  — quá nửa, bắt đầu ấm
  { tu: 75, tok: '--v-3' },    // 75–99%  — sắp tới nơi
  { tu: 100, tok: '--win' },   // 100%    — XONG, xanh dành riêng
] as const;

/** Vạch mốc vẽ đè lên thanh. Mốc ĐÃ QUA chuyển vàng và ĐỨNG LẠI đó. */
export const VACH_MOC = [25, 50, 75] as const;

export function nacCua(pct: number): (typeof MOC_TIEN_DO)[number] {
  for (let i = MOC_TIEN_DO.length - 1; i >= 0; i--) {
    if (pct >= MOC_TIEN_DO[i]!.tu) return MOC_TIEN_DO[i]!;
  }
  return MOC_TIEN_DO[0]!;
}

/**
 * ⚠⚠ KHÔNG `transition` TRÊN BỀ RỘNG. Demo đã trả giá bốn lần cho cùng một gốc:
 * transition do TRÌNH DUYỆT chạy theo nhịp vẽ, nên khi khung bị ẩn nó không tiến một
 * bước nào và thanh ĐỨNG NGUYÊN ở giá trị đầu — vĩnh viễn, không lỗi, không cảnh báo.
 * Bề rộng thanh là **chức năng** (nó chính là con số), nên đặt xong là xong.
 *
 * ⚠ `--nac` đặt bằng tên biến của nấc; CSS đọc `var()`. Demo đọc mã màu thật ra để
 * `getComputedStyle` kiểm được — ở đây bài test đọc thẳng `--nac` nên không cần vòng đó.
 */
export function ThanhTienDo(
  { pct, nhan }: { pct: number; nhan?: string },
): React.ReactElement {
  const p = Math.max(0, Math.min(100, pct));
  return (
    <span
      className={s.tt}
      style={{ '--p': `${p}%`, '--nac': `var(${nacCua(Math.round(p)).tok})` } as React.CSSProperties}
      role="img"
      aria-label={nhan ?? `Tiến độ ${Math.round(p)}%`}
    >
      <span className={s.tan} />
      {VACH_MOC.map((m) => (
        <u key={m} className={p >= m ? s.dat : undefined} style={{ left: `${m}%` }} />
      ))}
    </span>
  );
}
