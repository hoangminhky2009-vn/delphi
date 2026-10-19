/**
 * Đích link email đặt lại mật khẩu (server dựng `/reset-password?token=...` — GĐ2).
 * Client chỉ kiểm 2 ô khớp nhau; mọi luật thật (độ dài, token 1 lần/2h) server quyết.
 */
import { useState, type FormEvent } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { useMutation } from '@tanstack/react-query';
import { api, ApiError } from '@/api/client';
import type { OkResponse } from '@/api/types';
import { AUTH } from '@config/auth';
import { ScreenFrame } from '@/components/ScreenFrame';
import { AuthHero } from '@/components/AuthHero';
import { Field, NeonButton, Pill } from '@/components/ui';
import s from './auth/auth.module.css';

export function ResetPassword() {
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const token = params.get('token') ?? '';
  const [pw1, setPw1] = useState('');
  const [pw2, setPw2] = useState('');
  const [localError, setLocalError] = useState('');

  const reset = useMutation<OkResponse, Error, string>({
    mutationFn: (newPassword) =>
      api('/auth/reset-password', {
        method: 'POST',
        body: { token, new_password: newPassword },
      }),
  });

  function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (reset.isPending) return;
    if (pw1 !== pw2) {
      setLocalError('Hai ô mật khẩu chưa khớp nhau.');
      return;
    }
    setLocalError('');
    reset.mutate(pw1);
  }

  if (!token) {
    return (
      <>
        <AuthHero compact />
        <ScreenFrame title="Đặt lại mật khẩu" live>
          <div className={`${s.resultBox} ${s.resultBoxLose}`} role="alert">
            <span>Thiếu mã đặt lại — mở đúng liên kết trong email nhé.</span>
          </div>
          <p className={s.hintLine}>
            <Link to="/onboard/quen-mat-khau">← Gửi lại email đặt lại</Link>
          </p>
        </ScreenFrame>
      </>
    );
  }

  if (reset.isSuccess) {
    return (
      <>
        <AuthHero compact />
        <ScreenFrame title="Đặt lại mật khẩu" live>
          <div className={`${s.resultBox} ${s.resultBoxWin}`}>
            <Pill tone="win">✓ XONG</Pill>
            <span>{reset.data.message ?? 'Đã đặt lại mật khẩu. Đăng nhập lại nhé.'}</span>
          </div>
          <NeonButton block onClick={() => navigate('/onboard')}>
            ▶ ĐĂNG NHẬP
          </NeonButton>
        </ScreenFrame>
      </>
    );
  }

  const serverError =
    reset.error instanceof ApiError
      ? reset.error.message
      : reset.error
        ? 'Không gọi được máy chủ. Thử lại sau nhé.'
        : '';

  return (
    <>
      <AuthHero compact />
      <ScreenFrame title="Đặt lại mật khẩu" live>
        <form className={s.form} onSubmit={onSubmit}>
        <Field
          id="rp-pw1"
          label="Mật khẩu mới"
          type="password"
          autoComplete="new-password"
          hint={`Từ ${AUTH.PASSWORD_MIN_LENGTH} ký tự.`}
          value={pw1}
          onChange={(e) => setPw1(e.target.value)}
          required
        />
        <Field
          id="rp-pw2"
          label="Nhập lại mật khẩu mới"
          type="password"
          autoComplete="new-password"
          value={pw2}
          onChange={(e) => setPw2(e.target.value)}
          error={localError || undefined}
          required
        />
        {serverError && (
          <p className={s.serverError} role="alert">
            ✕ {serverError}
          </p>
        )}
        <NeonButton type="submit" block disabled={reset.isPending}>
          {reset.isPending ? 'ĐANG ĐỔI…' : '▶ ĐẶT LẠI MẬT KHẨU'}
        </NeonButton>
        </form>
      </ScreenFrame>
    </>
  );
}
