/** Nút theo Mẫu E: CTA "▶ CÔNG BỐ KẾT QUẢ" và pill phụ "↻ CHẠY LẠI". */
import type { ButtonHTMLAttributes } from 'react';
import s from './NeonButton.module.css';

interface Props extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'cta' | 'ghost';
  block?: boolean;
}

export function NeonButton({ variant = 'cta', block = false, className, ...rest }: Props) {
  const cls = [s[variant], block ? s.block : '', className].filter(Boolean).join(' ');
  return <button type="button" className={cls} {...rest} />;
}
