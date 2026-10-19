/**
 * Đích link email xác minh (server dựng `/verify-email?token=...` — GĐ2).
 * Tự gửi token khi mở trang; hiển thị đúng message server (một lần, có hạn 24h).
 */
import { useEffect, useRef } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { useMutation } from '@tanstack/react-query';
import { api, ApiError } from '@/api/client';
import type { OkResponse } from '@/api/types';
import { ScreenFrame } from '@/components/ScreenFrame';
import { AuthHero } from '@/components/AuthHero';
import { NeonButton, Pill } from '@/components/ui';
import { duongBanTuMa, ghiDiemQuayVe } from '@/lib/diem_quay_ve';
import s from './auth/auth.module.css';

export function VerifyEmail() {
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const token = params.get('token') ?? '';
  /*
   * D333 — link xác minh của người đăng ký từ BÀN BUỔI ĐO mang `&ban=<mã>` (server chỉ gắn mã đã kiểm).
   * Thư thường mở ở một trình duyệt khác nơi đăng ký, nên điểm quay về phải ghi lại TỪ LINK, ở đây.
   */
  const banTuLink = duongBanTuMa(params.get('ban'));
  useEffect(() => {
    if (banTuLink) ghiDiemQuayVe(banTuLink);
  }, [banTuLink]);

  const verify = useMutation<OkResponse, Error, string>({
    mutationFn: (t) => api('/auth/verify-email', { method: 'POST', body: { token: t } }),
    /*
     * ⚠ GỠ 03/08 mốc telemetry "xac-minh-email". Đây là bậc bị nghi rò rỉ nhiều
     * nhất, nên nó càng phải đo bằng nguồn ĐÚNG: `auth_accounts.email_verified_at`.
     * Telemetry KHÔNG ghép được bậc này với các bậc khác — màn xác minh mở từ
     * LINK TRONG EMAIL, tức một lần nạp trang khác, thường là trình duyệt khác,
     * nên mã phiên không nối lại được. Một bậc phễu không ghép được với bậc trên
     * thì không phải bậc phễu, nó chỉ là một con số nằm cạnh.
     */
  });
  const { mutate } = verify;

  // Token dùng MỘT LẦN — chặn StrictMode/dev bắn effect 2 lần (lần 2 sẽ 400 oan)
  const sent = useRef(false);
  useEffect(() => {
    if (!token || sent.current) return;
    sent.current = true;
    mutate(token);
  }, [token, mutate]);

  if (verify.isSuccess) {
    return (
      <>
        <AuthHero compact />
        <ScreenFrame title="Xác minh email" live>
          <div className={`${s.resultBox} ${s.resultBoxWin}`}>
            <Pill tone="win">✓ ĐÃ XÁC MINH</Pill>
            <span>{verify.data.message ?? 'Email đã xác minh. Bạn đăng nhập được rồi.'}</span>
          </div>
          <NeonButton block onClick={() => navigate('/onboard')}>
            ▶ ĐĂNG NHẬP
          </NeonButton>
        </ScreenFrame>
      </>
    );
  }

  let body: string;
  let failed = false;
  if (!token) {
    body = 'Thiếu mã xác minh — mở đúng liên kết trong email nhé.';
    failed = true;
  } else if (verify.isPending || verify.isIdle) {
    body = 'Đang xác minh email…';
  } else if (verify.error instanceof ApiError) {
    body = verify.error.message;
    failed = true;
  } else {
    body = 'Không gọi được máy chủ. Kiểm tra mạng rồi tải lại trang nhé.';
    failed = true;
  }

  return (
    <>
      <AuthHero compact />
      <ScreenFrame title="Xác minh email" live>
        <div className={failed ? `${s.resultBox} ${s.resultBoxLose}` : s.resultBox} role={failed ? 'alert' : undefined}>
          <span>{body}</span>
        </div>
        {failed && (
          <p className={s.hintLine}>
            <Link to="/onboard/dang-ky">← Đăng ký lại</Link>
          </p>
        )}
      </ScreenFrame>
    </>
  );
}
