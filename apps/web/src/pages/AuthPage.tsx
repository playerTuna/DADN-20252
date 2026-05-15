import { useState, type FormEvent } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import logoUrl from '../../../Frontend/assets/images/logo.png';
import { login, register, validateEmailInput, validatePasswordInput } from '../services/auth';

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

    if (isRegister && confirmPassword !== password) {
      return 'Passwords do not match.';
    }

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
      setError(err instanceof Error ? err.message : 'Authentication failed.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <main className="auth-page">
      <form className="auth-card" onSubmit={handleSubmit}>
        <div className="auth-header">
          <div className="auth-logo-wrap">
            <img src={logoUrl} alt="Smart Farm" className="auth-logo" />
          </div>

          <p className="auth-brand">Smart Farm</p>

          <h1>{isRegister ? 'Create account' : 'Welcome back'}</h1>

          <p className="auth-subtitle">
            {isRegister
              ? 'Create your account to manage your farm.'
              : 'Sign in to continue to your dashboard.'}
          </p>
        </div>

        <label className="auth-field">
          <span>Email</span>
          <input
            type="email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            placeholder="farmer@smartfarm.vn"
            autoComplete="email"
            disabled={submitting}
          />
        </label>

        <label className="auth-field">
          <span>Password</span>

          <div className="auth-password-row">
            <input
              type={showPassword ? 'text' : 'password'}
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              placeholder="Enter your password"
              autoComplete={isRegister ? 'new-password' : 'current-password'}
              disabled={submitting}
            />

            <button
              type="button"
              onClick={() => setShowPassword((current) => !current)}
              disabled={submitting}
            >
              {showPassword ? 'Hide' : 'Show'}
            </button>
          </div>
        </label>

        {isRegister ? (
          <label className="auth-field">
            <span>Confirm password</span>
            <input
              type={showPassword ? 'text' : 'password'}
              value={confirmPassword}
              onChange={(event) => setConfirmPassword(event.target.value)}
              placeholder="Repeat your password"
              autoComplete="new-password"
              disabled={submitting}
            />
          </label>
        ) : null}

        {error ? <div className="form-error">{error}</div> : null}

        <button className="auth-submit-button" type="submit" disabled={submitting}>
          {submitting ? 'Please wait...' : isRegister ? 'Create account' : 'Sign in'}
        </button>

        <p className="auth-switch">
          {isRegister ? 'Already have an account?' : "Don't have an account?"}{' '}
          <Link to={isRegister ? '/' : '/register'}>{isRegister ? 'Sign in' : 'Register'}</Link>
        </p>
      </form>
    </main>
  );
}
