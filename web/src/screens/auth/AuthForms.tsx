/**
 * HAI BIỂU MẪU AUTH — MỘT BẢN CÀI ĐẶT DUY NHẤT (A11.5/D61).
 *
 * Vì sao tách khỏi màn: từ 07/09 mỗi biểu mẫu có HAI chỗ hiện ra —
 *   · trong `BoardAuth` (board bật lên từ nút chính ở `/onboard`);
 *   · ở màn đứng riêng (`/onboard/dang-ky` — đích của link trong email và của
 *     mọi chỗ trong app còn trỏ tới).
 * Chép ruột sang board là dựng bản thứ hai của luồng đăng ký, và bản thứ hai SẼ
 * trôi im lặng: một bên sửa age gate, bên kia không. Nên ruột nằm ĐÂY, hai chỗ
 * kia chỉ là vỏ.
 *
 * Hai hàm dưới trả về RUỘT (form / hộp kết quả), KHÔNG kèm `AuthHero` hay
 * `ScreenFrame` — người gọi tự quyết khung, vì board và màn cần khung khác nhau.
 */
import { useEffect, useState, type FormEvent } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { api, ApiError } from '@/api/client';
import type { LoginResponse, OkResponse } from '@/api/types';
import { queryKeys } from '@/api/queries';
import { AUTH } from '@config/auth';
import { Field, NeonButton, PixelIcon, Pill } from '@/components/ui';
import { datTokenDiscord } from '@/lib/discord_phien';
import { docDiemQuayVe, maBanQuayVe } from '@/lib/diem_quay_ve';
import { ghiDo } from '@/lib/telemetry';
import s from './auth.module.css';

// ══════════════════════════════════════════════════════════════════════════
// ĐĂNG NHẬP — POST /api/v1/auth/login (contract GĐ2, server/app.ts)
// ══════════════════════════════════════════════════════════════════════════

export function LoginForm({ onXong }: { onXong?: () => void }) {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  const login = useMutation<LoginResponse, Error, { email: string; password: string }>({
    mutationFn: (body) => api('/auth/login', { method: 'POST', body }),
    onSuccess: async (res) => {
      /*
       * ⚠⚠ GIỮ TOKEN — thiếu dòng này thì ĐĂNG NHẬP KHÔNG DÍNH TRONG DISCORD.
       * Activity chạy trong iframe xuyên site nên cookie `SameSite=Lax` không
       * được gửi: màn hình nói đã vào, mọi request vẫn 401. Đây chính là lý do
       * người mở Activity trước nay chỉ có mỗi đường tài khoản KHÁCH.
       * Trên web thì `datTokenDiscord` chỉ giữ trong bộ nhớ (xem `discord_phien`),
       * nên gọi ở đây vô hại — cookie `HttpOnly` vẫn là đường chính.
       */
      if (res.token) datTokenDiscord(res.token);
      /*
       * §2.3 — "đăng nhập xong CÓ CHƠI KHÔNG". Trước 03/08 không có cách nào
       * trả lời: không dấu vết nào phân biệt người đăng nhập rồi chơi với
       * người đăng nhập rồi đóng app.
       */
      ghiDo('dang_nhap');
      await qc.invalidateQueries({ queryKey: queryKeys.me });
      onXong?.();
      // D333 — đến từ link bàn buổi đo thì về lại đúng bàn (chưa lập hồ sơ thì hồ sơ trước).
      navigate(res.onboarded ? (docDiemQuayVe() ?? '/') : '/onboard/ho-so');
    },
  });

  function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (login.isPending) return;
    login.mutate({ email, password });
  }

  const err = login.error instanceof ApiError ? login.error : null;

  return (
    <form className={s.form} onSubmit={onSubmit}>
      <Field
        id="login-email"
        label="Email"
        type="email"
        autoComplete="email"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        required
      />
      <Field
        id="login-password"
        label="Mật khẩu"
        type="password"
        autoComplete="current-password"
        value={password}
        onChange={(e) => setPassword(e.target.value)}
        required
      />
      {err && (
        <p className={s.serverError} role="alert">
          {/* Hiện NGUYÊN VĂN message server (đã viết sẵn tiếng Việt) — không tự chế */}
          ✕ {err.message}
          {err.code === 'email_not_verified' && (
            <>
              <br />
              Mở email xác minh đã gửi khi đăng ký nhé (kiểm tra cả mục spam).
            </>
          )}
          {err.code === 'rate_limited' && err.retryAfterSeconds !== undefined && (
            <>
              <br />
              Thử lại sau khoảng {Math.ceil(err.retryAfterSeconds / 60)} phút.
            </>
          )}
        </p>
      )}
      {login.error && !err && (
        <p className={s.serverError} role="alert">
          ✕ Không gọi được máy chủ. Kiểm tra mạng rồi thử lại nhé.
        </p>
      )}
      <NeonButton type="submit" block disabled={login.isPending}>
        {login.isPending ? 'ĐANG ĐĂNG NHẬP…' : '▶ ĐĂNG NHẬP'}
      </NeonButton>
      <div className={s.links}>
        <Link to="/onboard/quen-mat-khau">Quên mật khẩu?</Link>
      </div>
    </form>
  );
}

// ══════════════════════════════════════════════════════════════════════════
// ĐĂNG KÝ — POST /api/v1/auth/register {email, password, birth_year}
// Age gate 16+ (C8) do SERVER quyết; client chỉ hiển thị thông điệp chặn tử tế.
// Server chỉ lưu age_band, không lưu năm sinh (C7).
// ══════════════════════════════════════════════════════════════════════════

/** D392 — đăng ký từ bàn buổi đo đang mở trả thêm phiên (`dang_nhap`); đăng ký thường chỉ có `ok` + `message`. */
interface DangKyResponse extends OkResponse {
  dang_nhap?: boolean;
  token?: string;
}

interface RegisterBody {
  email: string;
  password: string;
  birth_year: number;
  /**
   * D333 — mã bàn buổi đo người này đến từ (nếu có). Server chỉ dùng nó để đổi xô hạn mức sang theo
   * BÀN (cả lớp chung một IP) và gắn vào link xác minh; mã lạ thì như không gửi.
   */
  ban_ma?: string;
}

/** `onSangDangNhap` — có thì đường "đã có tài khoản" gọi hàm (board đổi tab);
 *  không thì rơi về `<Link>` sang `/onboard` (màn đứng riêng). */
export function RegisterForm({ onSangDangNhap }: { onSangDangNhap?: () => void }) {
  const [email, setEmail] = useState('');
  const [pw1, setPw1] = useState('');
  const [pw2, setPw2] = useState('');
  const [birthYear, setBirthYear] = useState('');
  const [localErr, setLocalErr] = useState<{ field: string; message: string } | null>(null);

  // Phễu §4.2(7): mốc đầu là MỞ MÀN, không phải bấm gửi — bỏ ở màn đăng ký mà
  // chưa gõ gì cũng là một cách rời đi, và nó đếm được.
  useEffect(() => ghiDo('dang_ky_buoc', { chi_tiet: { buoc: 'mo-dang-ky' } }), []);

  const navigate = useNavigate();
  const qc = useQueryClient();
  const register = useMutation<DangKyResponse, Error, RegisterBody>({
    mutationFn: (body) => api('/auth/register', { method: 'POST', body }),
    onSuccess: async (res) => {
      ghiDo('dang_ky_buoc', { chi_tiet: { buoc: 'gui-dang-ky' } });
      /*
       * D392 — đăng ký TỪ BÀN BUỔI ĐO ĐANG MỞ thì server cấp phiên luôn (D370 ① — bỏ bước xác minh email):
       * đi thẳng vào lập hồ sơ, cùng đường với đăng nhập. Giữ token như đăng nhập (Activity Discord không
       * gửi cookie xuyên site). Đăng ký thường vẫn ra hộp "KIỂM TRA HỘP THƯ" như cũ.
       */
      if (res.dang_nhap === true) {
        if (res.token) datTokenDiscord(res.token);
        await qc.invalidateQueries({ queryKey: queryKeys.me });
        navigate('/onboard/ho-so');
      }
    },
  });

  function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (register.isPending) return;
    if (pw1 !== pw2) {
      setLocalErr({ field: 'password2', message: 'Hai ô mật khẩu chưa khớp nhau.' });
      return;
    }
    if (!/^\d{4}$/.test(birthYear.trim())) {
      setLocalErr({ field: 'birth_year', message: 'Năm sinh gồm 4 chữ số, vd 2008.' });
      return;
    }
    setLocalErr(null);
    const banMa = maBanQuayVe();
    register.mutate({
      email, password: pw1, birth_year: Number(birthYear.trim()),
      ...(banMa ? { ban_ma: banMa } : {}),
    });
  }

  const err = register.error instanceof ApiError ? register.error : null;
  const fieldErr = (name: string): string | undefined => {
    if (localErr?.field === name) return localErr.message;
    if (err?.field === name) return err.message;
    return undefined;
  };

  /** Đường "đã có tài khoản / đã xác minh xong" — nút trong board, link ở màn. */
  const duongSangDangNhap = (chu: string) =>
    onSangDangNhap ? (
      <button type="button" className={s.lienKetChu} onClick={onSangDangNhap}>
        {chu}
      </button>
    ) : (
      <Link to="/onboard">{chu}</Link>
    );

  if (register.isSuccess && register.data.dang_nhap !== true) {
    return (
      <>
        <div className={s.resultBox}>
          {/* 📮 → lưới `mail` (phong bì), dùng chung với màn quên mật khẩu. */}
          <Pill tone="accent">
            <PixelIcon name="mail" size={16} className={s.pillIcon} />
            {' '}KIỂM TRA HỘP THƯ
          </Pill>
          <span>{register.data.message ?? 'Kiểm tra hộp thư để xác minh email nhé.'}</span>
          <span className={s.hintLine}>Không thấy? Xem mục spam · link hạn 24h.</span>
        </div>
        <div className={s.links}>{duongSangDangNhap('Đã xác minh xong? Đăng nhập')}</div>
      </>
    );
  }

  if (err?.code === 'under_age') {
    return (
      <>
        <div className={`${s.resultBox} ${s.resultBoxLose}`} role="alert">
          <Pill tone="lose">16+</Pill>
          <span>{err.message}</span>
        </div>
        <div className={s.links}>
          <Link to="/">← Về sảnh</Link>
        </div>
      </>
    );
  }

  return (
    <form className={s.form} onSubmit={onSubmit}>
      <Field
        id="reg-email"
        label="Email"
        type="email"
        autoComplete="email"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        error={fieldErr('email')}
        required
      />
      <Field
        id="reg-password"
        label="Mật khẩu"
        type="password"
        autoComplete="new-password"
        hint={`Từ ${AUTH.PASSWORD_MIN_LENGTH} ký tự.`}
        value={pw1}
        onChange={(e) => setPw1(e.target.value)}
        error={fieldErr('password')}
        required
      />
      <Field
        id="reg-password2"
        label="Nhập lại mật khẩu"
        type="password"
        autoComplete="new-password"
        value={pw2}
        onChange={(e) => setPw2(e.target.value)}
        error={fieldErr('password2')}
        required
      />
      <Field
        id="reg-birth-year"
        label="Năm sinh"
        inputMode="numeric"
        maxLength={4}
        placeholder="vd 2008"
        hint="Từ 16 tuổi · chỉ lưu nhóm tuổi, không lưu năm sinh."
        value={birthYear}
        onChange={(e) => setBirthYear(e.target.value)}
        error={fieldErr('birth_year')}
        required
      />
      {err && !err.field && err.code !== 'under_age' && (
        <p className={s.serverError} role="alert">
          {/* Hiện NGUYÊN VĂN message server — kể cả 429 rate_limited */}
          ✕ {err.message}
          {err.code === 'rate_limited' && err.retryAfterSeconds !== undefined && (
            <>
              <br />
              Thử lại sau khoảng {Math.ceil(err.retryAfterSeconds / 60)} phút.
            </>
          )}
        </p>
      )}
      {register.error && !err && (
        <p className={s.serverError} role="alert">
          ✕ Không gọi được máy chủ. Kiểm tra mạng rồi thử lại nhé.
        </p>
      )}
      <NeonButton type="submit" block disabled={register.isPending}>
        {register.isPending ? 'ĐANG TẠO…' : '▶ TẠO TÀI KHOẢN'}
      </NeonButton>
      <div className={s.links}>{duongSangDangNhap('Đã có tài khoản? Đăng nhập')}</div>
    </form>
  );
}
