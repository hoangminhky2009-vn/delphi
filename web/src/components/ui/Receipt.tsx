/** Bảng kết toán "hóa đơn terminal" (Mẫu E): khối inset + dòng nhãn/giá trị + nét đứt + chớp lục. */
import type { ReactNode } from 'react';
import s from './Receipt.module.css';

export function Receipt({ flash = false, children }: { flash?: boolean; children: ReactNode }) {
  return (
    <div className={s.box}>
      {flash && <div className={s.flash} aria-hidden="true" />}
      {children}
    </div>
  );
}

Receipt.Row = function Row({
  label,
  value,
  tone = 'plain',
}: {
  label: string;
  value: string;
  tone?: 'plain' | 'win' | 'lose';
}) {
  const toneCls = tone === 'win' ? s.valueWin : tone === 'lose' ? s.valueLose : '';
  return (
    <div className={s.row}>
      <span className={s.label}>{label}</span>
      <span className={`${s.value} ${toneCls}`}>{value}</span>
    </div>
  );
};

Receipt.Sep = function Sep() {
  return <div className={s.sep} />;
};
