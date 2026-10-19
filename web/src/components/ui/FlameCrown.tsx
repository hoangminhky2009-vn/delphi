/**
 * Vương miện lửa của khối THƯỞNG CHUỖI — 8 ngọn nhen lệch pha rồi lụi hẳn, sau
 * đó còn 6 đốm than bay lên.
 *
 * 26/07 — DỰNG LẠI BẰNG SPRITE PIXEL. Bản trước là 8 khối `border-radius` hữu
 * cơ ("2px 60% 45% 55%" + `rotate` + `skewX`) tô `linear-gradient` mềm: đúng
 * hình ngọn lửa thật, và cũng đúng thứ §XI cấm — vật cong duy nhất trên một màn
 * mà khung, nút, thẻ, icon đều đã pixel. Nay mỗi ngọn là lưới `flame` 8×8 có
 * sẵn của `PixelIcon` (cam/vàng/đỏ, đúng bảng màu lửa), phóng ở bội số NGUYÊN
 * 8/16/24px để giữ nét.
 *
 * Vẽ lưới lửa THỨ HAI là phương án đã bỏ: cùng một ngọn lửa mà hai bộ ô vuông
 * khác nhau thì huy hiệu chuỗi và vương miện chuỗi lệch nhau ngay trong một màn.
 */
import { PixelIcon } from './PixelIcon';
import s from './FlameCrown.module.css';

interface Tongue {
  /** vị trí: left theo % hoặc px, hoặc right cho ngọn mép phải */
  left?: string;
  right?: string;
  top: string;
  /** cạnh sprite — PHẢI là bội của 8 (lưới `flame` 8 hàng), nếu không PixelIcon làm tròn */
  size: number;
  /** trễ nhen (s) */
  ignite: number;
  /** chu kỳ lắc (s) + trễ lắc */
  wob: number;
  wobDelay: number;
}

const TONGUES: Tongue[] = [
  { left: '36%', top: '-20px', size: 24, ignite: 0.1, wob: 0.55, wobDelay: 0 },
  { left: '55%', top: '-13px', size: 16, ignite: 0.18, wob: 0.42, wobDelay: 0.2 },
  { left: '21%', top: '-12px', size: 16, ignite: 0.26, wob: 0.55, wobDelay: 0.35 },
  { left: '73%', top: '-10px', size: 16, ignite: 0.34, wob: 0.42, wobDelay: 0.1 },
  { left: '9%', top: '-6px', size: 8, ignite: 0.42, wob: 0.55, wobDelay: 0.18 },
  { left: '88%', top: '-7px', size: 8, ignite: 0.42, wob: 0.42, wobDelay: 0.3 },
  { left: '-6px', top: '30%', size: 8, ignite: 0.5, wob: 0.55, wobDelay: 0.27 },
  { right: '-6px', top: '24%', size: 8, ignite: 0.5, wob: 0.42, wobDelay: 0.06 },
];

const EMBERS = [
  { left: '11%', drift: '5px', dur: 1.9, delay: 2.8, size: 3 },
  { left: '26%', drift: '-4px', dur: 2.4, delay: 3.3, size: 2 },
  { left: '44%', drift: '6px', dur: 2.1, delay: 3.7, size: 3 },
  { left: '63%', drift: '-6px', dur: 2.6, delay: 3.1, size: 2 },
  { left: '80%', drift: '4px', dur: 2.0, delay: 4.1, size: 3 },
  { left: '92%', drift: '-3px', dur: 2.3, delay: 3.5, size: 2 },
];

export function FlameCrown() {
  return (
    <>
      {/* quầng lửa bùng rồi lụi — vai ÁNH SÁNG, chỗ blur được phép */}
      <span className={s.burst} aria-hidden="true" />

      {/* 8 ngọn — nhen lệch pha rồi cháy 2 khung, sau đó lụi hẳn */}
      <span className={s.crown} aria-hidden="true">
        {/*
          Sprite nằm TRONG một span định vị chứ không tự định vị: PixelIcon đặt
          `position: 'relative'` bằng style inline, mà inline thắng cả class lẫn
          style truyền vào sau — bọc ngoài là cách duy nhất không phải cãi nhau
          với nó.
        */}
        {TONGUES.map((t, i) => (
          <span
            key={i}
            className={s.tongue}
            style={{
              ...(t.left !== undefined ? { left: t.left } : {}),
              ...(t.right !== undefined ? { right: t.right } : {}),
              top: t.top,
              animation:
                `${s.fireignite} .16s steps(2, jump-none) ${t.ignite}s both, `
                + `${s.flamewob} ${t.wob}s steps(2, jump-none) ${t.wobDelay}s infinite alternate`,
            }}
          >
            <PixelIcon name="flame" size={t.size} />
          </span>
        ))}
      </span>

      {/* than bay lên sau khi lửa lụi */}
      <span className={s.embers} aria-hidden="true">
        {EMBERS.map((e, i) => (
          <span
            key={i}
            className={s.ember}
            style={{
              left: e.left,
              width: e.size,
              height: e.size,
              ['--drift' as string]: e.drift,
              animationDuration: `${e.dur}s`,
              animationDelay: `${e.delay}s`,
            }}
          />
        ))}
      </span>
    </>
  );
}
