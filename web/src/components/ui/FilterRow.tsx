/** Nhóm chip chọn-một — demographic onboarding, mức cược nhanh. */
import s from './FilterRow.module.css';

export interface FilterOption<V extends string> {
  value: V;
  label: string;
}

interface Props<V extends string> {
  label?: string;
  options: readonly FilterOption<V>[];
  value: V | null;
  onChange: (v: V) => void;
}

export function FilterRow<V extends string>({ label, options, value, onChange }: Props<V>) {
  return (
    <div className={s.group} role="group" aria-label={label}>
      {label && <span className={s.label}>{label}</span>}
      <div className={s.row}>
        {options.map((o) => (
          <button
            key={o.value}
            type="button"
            className={o.value === value ? `${s.chip} ${s.active}` : s.chip}
            aria-pressed={o.value === value}
            onClick={() => onChange(o.value)}
          >
            {o.label}
          </button>
        ))}
      </div>
    </div>
  );
}
