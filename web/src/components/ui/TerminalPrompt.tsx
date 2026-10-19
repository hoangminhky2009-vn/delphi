/**
 * Banner dòng lệnh Mẫu E: khung cyan mờ + prompt lục + text (gõ từng ký tự 24ms)
 * + cursor block nhấp nháy. reduced-motion → hiện ngay (useTypewriter lo).
 */
import { useEffect } from 'react';
import { useTypewriter } from '@/lib/hooks';
import s from './TerminalPrompt.module.css';

interface Props {
  /** Prompt, vd "gso@delphi:~$". */
  user: string;
  text: string;
  /** Bật hiệu ứng gõ (false = hiện nguyên chuỗi). */
  typing?: boolean;
  /** Hiện cursor nhấp nháy (mặc định: khi đang gõ hoặc text rỗng). */
  cursor?: boolean;
  onDone?: () => void;
}

export function TerminalPrompt({ user, text, typing = false, cursor, onDone }: Props) {
  const { shown, done } = useTypewriter(text, { enabled: typing });
  const display = typing ? shown : text;
  const showCursor = cursor ?? (typing ? !done : display.length === 0);
  useEffect(() => {
    if (typing && done && onDone) onDone();
  }, [typing, done, onDone]);
  return (
    <div className={s.banner}>
      <span className={s.prompt}>{user}</span> {display}
      {showCursor && <span className={s.cursor} aria-hidden="true" />}
    </div>
  );
}
