/** Pill/tag nhỏ — trạng thái kèo, pool, nguồn (Mẫu E card sảnh). */
import type { ReactNode } from 'react';
import s from './Pill.module.css';

type Tone = 'muted' | 'accent' | 'win' | 'lose' | 'gold';

interface Props {
  tone?: Tone;
  /** Chấm tròn nhấp nháy (trạng thái "ĐANG MỞ"). */
  dot?: boolean;
  children: ReactNode;
  className?: string;
}

export function Pill({ tone = 'muted', dot = false, children, className }: Props) {
  const cls = [s.pill, s[tone], className].filter(Boolean).join(' ');
  return (
    <span className={cls}>
      {dot && <span className={s.dot} aria-hidden="true" />}
      {children}
    </span>
  );
}
