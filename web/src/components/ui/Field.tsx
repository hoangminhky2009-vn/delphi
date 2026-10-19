/** Ô nhập có nhãn + lỗi + gợi ý — form auth dùng thống nhất. */
import type { InputHTMLAttributes } from 'react';
import s from './Field.module.css';

interface Props extends InputHTMLAttributes<HTMLInputElement> {
  id: string;
  label: string;
  error?: string;
  hint?: string;
}

export function Field({ id, label, error, hint, className, ...rest }: Props) {
  return (
    <div className={[s.field, className].filter(Boolean).join(' ')}>
      <label className={s.label} htmlFor={id}>
        {label}
      </label>
      <input
        id={id}
        className={[s.input, error ? s.inputError : ''].join(' ')}
        aria-invalid={error ? true : undefined}
        aria-describedby={error ? `${id}-err` : hint ? `${id}-hint` : undefined}
        {...rest}
      />
      {error ? (
        <p id={`${id}-err`} className={s.error} role="alert">
          ✕ {error}
        </p>
      ) : hint ? (
        <p id={`${id}-hint`} className={s.hint}>
          {hint}
        </p>
      ) : null}
    </div>
  );
}
