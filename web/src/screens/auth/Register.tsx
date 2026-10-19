/**
 * Đăng ký — MÀN ĐỨNG RIÊNG tại `/onboard/dang-ky`.
 *
 * ⚠ ĐỪNG XOÁ MÀN NÀY khi thấy board ở `/onboard` đã có tab ĐĂNG KÝ. Nó vẫn là
 * đích thật của nhiều đường: link trong app, và người gõ thẳng địa chỉ. Đổi path
 * hay bỏ route là gãy những đường đó.
 *
 * Ruột (ô nhập · age gate C8 · hộp "kiểm tra hộp thư") nằm ở `AuthForms` và
 * dùng CHUNG với board — ở đây chỉ có khung (A11.5/D61).
 */
import { AuthHero } from '@/components/AuthHero';
import { ScreenFrame } from '@/components/ScreenFrame';
import { RegisterForm } from './AuthForms';

export function Register() {
  return (
    <>
      <AuthHero compact />
      <ScreenFrame title="Đăng ký" live>
        <RegisterForm />
      </ScreenFrame>
    </>
  );
}
