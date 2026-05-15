import { useState, type FormEvent } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import logoUrl from '../../../Frontend/assets/images/logo.png';
import {
  login,
  register,
  validateEmailInput,
  validatePasswordInput,
} from '../services/auth';

type AuthPageProps = {
  mode: 'login' | 'register';
};

export function AuthPage({ mode }: AuthPageProps) {
  const navigate = useNavigate();
  const isRegister = mode === 'register';

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const validate = () => {
    const emailError = validateEmailInput(email);
    if (emailError) return emailError;
    const passwordError = validatePasswordInput(password);
    if (passwordError) return passwordError;
    if (isRegister && confirmPassword !== password) return 'Mật khẩu xác nhận không khớp.';
    return null;
  };

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const validation = validate();
    if (validation) {
      setError(validation);
      return;
    }

    setSubmitting(true);
    setError(null);
    try {
      if (isRegister) {
        await register(email, password);
      } else {
        await login(email, password);
      }
      navigate('/home', { replace: true });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Xác thực thất bại.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <main className="auth-page">
      <section className="auth-hero" aria-labelledby="auth-title">
        <div className="auth-logo-wrap">
          <img src={logoUrl} alt="Smart Farm" className="auth-logo" />
        </div>
        <p className="eyebrow">Smart Farm</p>
        <h1 id="auth-title">{isRegister ? 'Tạo tài khoản' : 'Chào mừng trở lại'}</h1>
        <p className="auth-copy">
          Theo dõi điều kiện nông trại, quản lý thiết bị và cài đặt tự động hóa ngay trên bảng điều khiển.
        </p>
      </section>

      <form className="auth-card" onSubmit={handleSubmit}>
        <div>
          <h2>{isRegister ? 'Đăng ký' : 'Đăng nhập'}</h2>
          <p>{isRegister ? 'Thiết lập quyền truy cập bảng điều khiển.' : 'Tiếp tục vào bảng điều khiển của bạn.'}</p>
        </div>

        <label className="form-field">
          <span>Email</span>
          <input
            type="email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            placeholder="farmer@smartfarm.vn"
            autoComplete="email"
          />
        </label>

        <label className="form-field">
          <span>Mật khẩu</span>
          <div className="password-input">
            <input
              type={showPassword ? 'text' : 'password'}
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              placeholder="Nhập mật khẩu"
              autoComplete={isRegister ? 'new-password' : 'current-password'}
            />
            <button type="button" onClick={() => setShowPassword((current) => !current)}>
              {showPassword ? 'Ẩn' : 'Hiện'}
            </button>
          </div>
        </label>

        {isRegister ? (
          <label className="form-field">
            <span>Xác nhận mật khẩu</span>
            <input
              type={showPassword ? 'text' : 'password'}
              value={confirmPassword}
              onChange={(event) => setConfirmPassword(event.target.value)}
              placeholder="Nhập lại mật khẩu"
              autoComplete="new-password"
            />
          </label>
        ) : null}

        {error ? <div className="form-error">{error}</div> : null}

        <button className="primary-button" type="submit" disabled={submitting}>
          {submitting ? 'Vui lòng đợi...' : isRegister ? 'Tạo tài khoản' : 'Đăng nhập'}
        </button>

        <p className="auth-switch">
          {isRegister ? 'Đã có tài khoản?' : 'Chưa có tài khoản?'}{' '}
          <Link to={isRegister ? '/' : '/register'}>{isRegister ? 'Đăng nhập' : 'Đăng ký'}</Link>
        </p>
      </form>
    </main>
  );
}
