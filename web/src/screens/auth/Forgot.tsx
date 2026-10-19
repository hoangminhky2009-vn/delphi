/** Quên mật khẩu — POST /api/v1/auth/forgot-password (202 luôn — không lộ email tồn tại). */
import { useState, type FormEvent } from 'react';
import { Link } from 'react-router-dom';
import { useMutation } from '@tanstack/react-query';
import { api, ApiError } from '@/api/client';
import type { OkResponse } from '@/api/types';
import { ScreenFrame } from '@/components/ScreenFrame';
import { AuthHero } from '@/components/AuthHero';
import { Field, NeonButton, PixelIcon, Pill } from '@/components/ui';
import s from './auth.module.css';

export function Forgot() {
  const [email, setEmail] = useState('');
  const forgot = useMutation<OkResponse, Error, string>({
    mutationFn: (e) => api('/auth/forgot-password', { method: 'POST', body: { email: e } }),
  });

  function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (!forgot.isPending) forgot.mutate(email);
  }

  const err = forgot.error instanceof ApiError ? forgot.error : null;

  if (forgot.isSuccess) {
    return (
      <>
        <AuthHero compact />
        <ScreenFrame title="Quên mật khẩu" live>
          <div className={s.resultBox}>
            {/* 📮 → lưới `mail` (phong bì), dùng chung với màn đăng ký. */}
            <Pill tone="accent">
              <PixelIcon name="mail" size={16} className={s.pillIcon} />
              {' '}ĐÃ GỬI
            </Pill>
            <span>{forgot.data.message ?? 'Nếu email tồn tại, thư đặt lại mật khẩu đã được gửi.'}</span>
            <span className={s.hintLine}>Link hạn 2 giờ.</span>
          </div>
          <div className={s.links}>
            <Link to="/onboard">← Về đăng nhập</Link>
          </div>
        </ScreenFrame>
      </>
    );
  }

  return (
    <>
      <AuthHero compact />
      <ScreenFrame title="Quên mật khẩu" live>
        <form className={s.form} onSubmit={onSubmit}>
        <Field
          id="forgot-email"
          label="Email"
          type="email"
          autoComplete="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          error={err?.field === 'email' ? err.message : undefined}
          required
        />
        {err && err.field !== 'email' && (
          <p className={s.serverError} role="alert">
            ✕ {err.message}
          </p>
        )}
        <NeonButton type="submit" block disabled={forgot.isPending}>
          {forgot.isPending ? 'ĐANG GỬI…' : '▶ GỬI EMAIL ĐẶT LẠI'}
        </NeonButton>
        <div className={s.links}>
          <Link to="/onboard">← Về đăng nhập</Link>
        </div>
        </form>
      </ScreenFrame>
    </>
  );
}
