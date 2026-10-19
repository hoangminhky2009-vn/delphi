/**
 * ĐẦU LỚP TRƯỢT: ô icon + tên + dòng nhãn — MỘT bản cho mọi lớp trượt của Hub (Tài chính · Mùa · Predict · Lab · Đấu trường ·
 * bách khoa), nên đầu các lớp không thể lệch nhau (A11.5).
 */
import type { ReactNode } from 'react';
import t from './HubTam.module.css';

export function TamDau({ icon, ten, tag }: { icon: ReactNode; ten: string; tag: string }): React.ReactElement {
  return (
    <div className={t.tamDau}>
      <span className={t.anhTam}>{icon}</span>
      <span className={t.tamTenKhoi}>
        <span className={t.tamTen}>{ten}</span>
        <span className={t.tamTag}>{tag}</span>
      </span>
    </div>
  );
}
