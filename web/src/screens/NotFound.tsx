import { Link } from 'react-router-dom';
import { ScreenFrame } from '@/components/ScreenFrame';

export function NotFound() {
  return (
    <ScreenFrame title="Không có trang này" live>
      <p>
        <span style={{ color: 'var(--lose-soft)' }}>404</span> — đường dẫn không
        tồn tại. <Link to="/">Về bảng giá</Link>.
      </p>
    </ScreenFrame>
  );
}
