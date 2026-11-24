import React, { useEffect, useRef, useState } from 'react';
import { CheckCircle2, Eye, EyeOff, KeyRound, Lock, Mail, RefreshCw, ShieldCheck, User as UserIcon, X } from 'lucide-react';
import { api, setToken } from '../lib/api';
import type { User } from '../types';

type AuthMode = 'login' | 'register' | 'verify' | 'forgot' | 'reset';
import { PORTALS, type AuthPortal } from '../lib/portals';
export type { AuthPortal };

interface AuthModalProps {
  initialMode?: 'login' | 'register';
  initialPortal?: AuthPortal;
  onClose: () => void;
  onSuccess: (user: User) => void;
  toast: (msg: string) => void;
}

const inputCls =
  'w-full h-11 pl-10 pr-3 border border-[#d9dfe8] rounded-xl text-[14px] bg-white outline-none transition focus:border-[var(--ac)] focus:ring-4 focus:ring-[var(--ac-soft)]';

function Field({ label, Icon, children, right }: { label: string; Icon: typeof Mail; children: React.ReactNode; right?: React.ReactNode }) {
  return (
    <label className="block">
      <span className="flex items-center justify-between text-[12.5px] font-semibold text-[#33405c] mb-1.5">
        {label}
        {right}
      </span>
      <span className="relative block">
        <Icon className="w-4 h-4 text-[var(--ac)] absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" aria-hidden />
        {children}
      </span>
    </label>
  );
}

export function AuthModal({ initialMode = 'login', initialPortal = 'buyer', onClose, onSuccess, toast }: AuthModalProps) {
  const [portal, setPortal] = useState<AuthPortal>(initialPortal);
  const [mode, setMode] = useState<AuthMode>(initialPortal === 'admin' ? 'login' : initialMode);
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPw, setShowPw] = useState(false);
  const [otp, setOtp] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [deliveryInfo, setDeliveryInfo] = useState<{ sentViaSmtp: boolean; previewCode?: string; message?: string } | null>(null);
  const [shown, setShown] = useState(false);
  const firstRef = useRef<HTMLInputElement>(null);

  const P = PORTALS.find((x) => x.k === portal) || PORTALS[0];

  useEffect(() => {
    const t = requestAnimationFrame(() => setShown(true));
    const esc = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', esc);
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      cancelAnimationFrame(t);
      window.removeEventListener('keydown', esc);
      document.body.style.overflow = prev;
    };
  }, [onClose]);

  useEffect(() => {
    firstRef.current?.focus();
  }, [mode, portal]);

  function switchPortal(k: AuthPortal) {
    setPortal(k);
    setError('');
    if (k === 'admin' && mode === 'register') setMode('login');
  }

  function finish(u: User, token: string, msg: string) {
    if (portal === 'admin' && u.role !== 'admin') {
      setToken('');
      setError('This account does not have Admin access.');
      return;
    }
    setToken(token);
    toast(msg);
    onSuccess(u);
    if (portal === 'admin') location.hash = '#/admin';
    else if (portal === 'contributor' && (u.role === 'contributor' || u.role === 'admin')) location.hash = '#/contributor';
  }

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const res = await api<{
        user?: User;
        token?: string;
        verificationRequired?: boolean;
        email?: string;
        sentViaSmtp?: boolean;
        previewCode?: string;
        message?: string;
      }>('/api/auth/login', {
        method: 'POST',
        body: JSON.stringify({ email, password }),
      });

      if (res.verificationRequired) {
        setEmail(res.email || email);
        setDeliveryInfo({ sentViaSmtp: !!res.sentViaSmtp, previewCode: res.previewCode, message: res.message });
        setMode('verify');
        toast('Please verify your email with the 6-digit code');
      } else if (res.user && res.token) {
        finish(res.user, res.token, `Welcome, ${res.user.name}`);
      }
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  }

  async function handleRegister(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const res = await api<{
        verificationRequired: boolean;
        email: string;
        sentViaSmtp: boolean;
        previewCode?: string;
        message?: string;
      }>('/api/auth/register', {
        method: 'POST',
        body: JSON.stringify({ name, email, password, role: portal === 'contributor' ? 'contributor' : 'buyer' }),
      });
      setEmail(res.email);
      setDeliveryInfo({ sentViaSmtp: res.sentViaSmtp, previewCode: res.previewCode, message: res.message });
      setMode('verify');
      toast(res.sentViaSmtp ? 'Verification code sent to your email!' : '6-digit verification code ready');
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  }

  async function handleVerify(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const res = await api<{ user: User; token: string }>('/api/auth/verify-email', {
        method: 'POST',
        body: JSON.stringify({ email, code: otp }),
      });
      finish(res.user, res.token, `Email verified! Welcome, ${res.user.name}`);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  }

  async function handleResend() {
    setError('');
    setLoading(true);
    try {
      const res = await api<{ sentViaSmtp: boolean; previewCode?: string; message?: string }>('/api/auth/resend-otp', {
        method: 'POST',
        body: JSON.stringify({ email }),
      });
      setDeliveryInfo({ sentViaSmtp: res.sentViaSmtp, previewCode: res.previewCode, message: res.message });
      toast(res.sentViaSmtp ? 'New code emailed!' : 'New code generated');
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  }

  async function handleForgot(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const res = await api<{ sentViaSmtp: boolean; previewCode?: string }>('/api/auth/forgot-password', {
        method: 'POST',
        body: JSON.stringify({ email }),
      });
      setDeliveryInfo({ sentViaSmtp: res.sentViaSmtp, previewCode: res.previewCode });
      setMode('reset');
      toast('Password reset code generated');
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  }

  async function handleReset(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const res = await api<{ user: User; token: string }>('/api/auth/reset-password', {
        method: 'POST',
        body: JSON.stringify({ email, code: otp, newPassword }),
      });
      finish(res.user, res.token, 'Password updated. You are logged in.');
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  }

  const title =
    mode === 'login' ? `${P.label} Login` :
    mode === 'register' ? `Create ${P.label} account` :
    mode === 'verify' ? 'Verify your email' :
    mode === 'forgot' ? 'Forgot password' : 'Set a new password';
  const sub =
    mode === 'login' ? P.sub :
    mode === 'register' ? 'Use a real email. We send a 6-digit code to verify it.' :
    mode === 'verify' ? `Enter the 6-digit code sent to ${email}` :
    mode === 'forgot' ? 'We will email you a 6-digit recovery code.' : `Reset password for ${email}`;

  const primary = 'w-full h-11 rounded-xl text-white font-semibold text-[14px] shadow-[0_8px_18px_-8px_var(--ac)] hover:brightness-110 active:scale-[0.99] disabled:opacity-60 transition cursor-pointer bg-[var(--ac)]';
  const link = 'bg-transparent border-0 p-0 font-semibold text-[var(--ac)] hover:underline cursor-pointer';

  return (
    <div
      className={`fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 transition-colors duration-200 ${shown ? 'bg-[#011f43]/55 backdrop-blur-[3px]' : 'bg-transparent'}`}
      onMouseDown={(e) => e.target === e.currentTarget && onClose()}
      style={{ ['--ac' as string]: P.c, ['--ac-soft' as string]: P.soft } as React.CSSProperties}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="auth-title"
        className={`w-full sm:max-w-[430px] max-h-[94vh] overflow-y-auto bg-white rounded-t-3xl sm:rounded-3xl shadow-[0_40px_80px_-24px_rgba(1,31,67,0.55)] transition-all duration-200 ease-out ${
          shown ? 'opacity-100 translate-y-0 sm:scale-100' : 'opacity-0 translate-y-6 sm:scale-[0.97]'
        }`}
      >
        {/* Portal switch */}
        <div className="px-5 pt-5">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <img src="/favicon.svg" alt="" className="w-7 h-7 rounded-lg" />
              <span className="font-bold text-[#011f43] text-[15px] tracking-tight">SantalStock</span>
            </div>
            <button type="button" onClick={onClose} aria-label="Close" className="w-8 h-8 rounded-full bg-[#f2f4f8] text-[#5c6170] hover:text-[#d6262f] flex items-center justify-center cursor-pointer transition">
              <X className="w-4 h-4" />
            </button>
          </div>
          {(mode === 'login' || mode === 'register') && (
            <div className="grid grid-cols-3 gap-1 p-1 rounded-2xl bg-[#f2f4f8]" role="tablist" aria-label="Login as">
              {PORTALS.map(({ k, label, Icon, c }) => (
                <button
                  key={k}
                  type="button"
                  role="tab"
                  aria-selected={portal === k}
                  onClick={() => switchPortal(k)}
                  className={`h-10 rounded-xl flex items-center justify-center gap-1.5 text-[12.5px] font-semibold cursor-pointer transition ${
                    portal === k ? 'bg-white shadow-sm text-[#011f43]' : 'text-[#5c6170] hover:text-[#011f43]'
                  }`}
                >
                  <Icon className="w-4 h-4" style={{ color: c }} aria-hidden /> {label}
                </button>
              ))}
            </div>
          )}
        </div>

        <div className="px-5 pb-6 pt-4">
          <div className="flex items-center gap-3 mb-4">
            <span className="w-11 h-11 rounded-2xl flex items-center justify-center shrink-0" style={{ background: P.soft, color: P.c }}>
              <P.Icon className="w-5 h-5" aria-hidden />
            </span>
            <div className="min-w-0">
              <h2 id="auth-title" className="m-0 text-[19px] font-bold text-[#011f43] leading-tight">{title}</h2>
              <p className="m-0 mt-0.5 text-[12.5px] text-[#5c6170] truncate">{sub}</p>
            </div>
          </div>

          {(mode === 'login' || mode === 'register') && portal !== 'admin' && (
            <div className="flex border-b border-[#e8ecf2] mb-4 text-[13.5px] font-semibold">
              {(['login', 'register'] as const).map((m) => (
                <button
                  key={m}
                  type="button"
                  onClick={() => { setError(''); setMode(m); }}
                  className={`flex-1 pb-2.5 -mb-px border-b-2 cursor-pointer bg-transparent transition ${mode === m ? 'border-[var(--ac)] text-[var(--ac)]' : 'border-transparent text-[#8a93a6] hover:text-[#33405c]'}`}
                >
                  {m === 'login' ? 'Login' : 'Sign up'}
                </button>
              ))}
            </div>
          )}

          {error && (
            <div className="mb-3.5 rounded-xl border border-[#f4c2c6] bg-[#fff2f3] px-3.5 py-2.5 text-[13px] text-[#a3141c] font-medium" role="alert">
              {error}
            </div>
          )}

          {(mode === 'verify' || mode === 'reset') && deliveryInfo && (
            <div className="mb-4 rounded-xl border border-emerald-200 bg-emerald-50 px-3.5 py-3 text-[13px] text-emerald-900">
              <div className="flex items-center gap-2 font-semibold">
                <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                {deliveryInfo.sentViaSmtp ? `Code sent to ${email}. Check inbox & spam.` : `Verification code for ${email}`}
              </div>
              {!deliveryInfo.sentViaSmtp && deliveryInfo.previewCode && (
                <div className="mt-2 flex items-center justify-between gap-2 bg-white border border-emerald-200 rounded-lg px-3 py-2">
                  <div className="font-mono text-xl font-extrabold tracking-[6px] text-[#011f43] tabular-nums">{deliveryInfo.previewCode}</div>
                  <button type="button" onClick={() => setOtp(deliveryInfo.previewCode || '')} className="px-3 py-1.5 rounded-lg bg-emerald-600 text-white text-xs font-semibold cursor-pointer">
                    Auto-fill
                  </button>
                </div>
              )}
            </div>
          )}

          {mode === 'login' && (
            <form onSubmit={handleLogin} className="space-y-3.5">
              <Field label="Email" Icon={Mail}>
                <input ref={firstRef} type="email" required autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="yourname@gmail.com" className={inputCls} />
              </Field>
              <Field
                label="Password"
                Icon={Lock}
                right={<button type="button" onClick={() => { setError(''); setMode('forgot'); }} className={`${link} text-[12px]`}>Forgot?</button>}
              >
                <input type={showPw ? 'text' : 'password'} required minLength={6} autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="••••••••" className={`${inputCls} pr-11`} />
                <button type="button" onClick={() => setShowPw((v) => !v)} aria-label={showPw ? 'Hide password' : 'Show password'} className="absolute right-2 top-1/2 -translate-y-1/2 w-8 h-8 rounded-lg flex items-center justify-center text-[#8a93a6] hover:text-[var(--ac)] cursor-pointer bg-transparent">
                  {showPw ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </Field>
              <button type="submit" disabled={loading} className={primary}>
                {loading ? 'Logging in…' : `Login as ${P.label}`}
              </button>
              {portal !== 'admin' && (
                <p className="text-center text-[12.5px] text-[#5c6170] m-0 pt-1">
                  New to SantalStock?{' '}
                  <button type="button" onClick={() => { setError(''); setMode('register'); }} className={link}>Create an account</button>
                </p>
              )}
              {portal === 'admin' && (
                <p className="text-center text-[12px] text-[#8a93a6] m-0 pt-1">Admin accounts are created by the site owner only.</p>
              )}
            </form>
          )}

          {mode === 'register' && (
            <form onSubmit={handleRegister} className="space-y-3.5">
              <Field label="Full name" Icon={UserIcon}>
                <input ref={firstRef} type="text" required autoComplete="name" value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Sunita Soren" className={inputCls} />
              </Field>
              <Field label="Email" Icon={Mail}>
                <input type="email" required autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="yourname@gmail.com" className={inputCls} />
              </Field>
              <Field label="Password" Icon={Lock}>
                <input type={showPw ? 'text' : 'password'} required minLength={6} autoComplete="new-password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="At least 6 characters" className={`${inputCls} pr-11`} />
                <button type="button" onClick={() => setShowPw((v) => !v)} aria-label={showPw ? 'Hide password' : 'Show password'} className="absolute right-2 top-1/2 -translate-y-1/2 w-8 h-8 rounded-lg flex items-center justify-center text-[#8a93a6] hover:text-[var(--ac)] cursor-pointer bg-transparent">
                  {showPw ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </Field>
              <button type="submit" disabled={loading} className={primary}>
                {loading ? 'Sending code…' : `Sign up as ${P.label}`}
              </button>
              <p className="text-center text-[12.5px] text-[#5c6170] m-0 pt-1">
                Already have an account?{' '}
                <button type="button" onClick={() => { setError(''); setMode('login'); }} className={link}>Login</button>
              </p>
            </form>
          )}

          {mode === 'verify' && (
            <form onSubmit={handleVerify} className="space-y-3.5">
              <Field label="6-digit code" Icon={ShieldCheck}>
                <input ref={firstRef} type="text" inputMode="numeric" autoComplete="one-time-code" required maxLength={6} pattern="[0-9]{6}" value={otp} onChange={(e) => setOtp(e.target.value.replace(/\D/g, '').slice(0, 6))} placeholder="123456" className={`${inputCls} text-lg font-mono tracking-[6px] tabular-nums`} />
              </Field>
              <div className="flex gap-2">
                <button type="submit" disabled={loading} className={primary}>{loading ? 'Verifying…' : 'Verify & Login'}</button>
                <button type="button" disabled={loading} onClick={handleResend} className="h-11 px-3.5 rounded-xl border border-[#d9dfe8] bg-white text-[#33405c] font-semibold text-xs inline-flex items-center gap-1.5 cursor-pointer shrink-0">
                  <RefreshCw className="w-3.5 h-3.5 text-[var(--ac)]" /> Resend
                </button>
              </div>
            </form>
          )}

          {mode === 'forgot' && (
            <form onSubmit={handleForgot} className="space-y-3.5">
              <Field label="Registered email" Icon={Mail}>
                <input ref={firstRef} type="email" required autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="yourname@gmail.com" className={inputCls} />
              </Field>
              <button type="submit" disabled={loading} className={primary}>{loading ? 'Sending…' : 'Send reset code'}</button>
              <p className="text-center m-0"><button type="button" onClick={() => setMode('login')} className={`${link} text-[12.5px]`}>Back to Login</button></p>
            </form>
          )}

          {mode === 'reset' && (
            <form onSubmit={handleReset} className="space-y-3.5">
              <Field label="6-digit reset code" Icon={KeyRound}>
                <input ref={firstRef} type="text" inputMode="numeric" autoComplete="one-time-code" required maxLength={6} value={otp} onChange={(e) => setOtp(e.target.value.replace(/\D/g, '').slice(0, 6))} placeholder="123456" className={`${inputCls} font-mono tracking-[6px]`} />
              </Field>
              <Field label="New password" Icon={Lock}>
                <input type="password" required minLength={6} autoComplete="new-password" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} placeholder="At least 6 characters" className={inputCls} />
              </Field>
              <button type="submit" disabled={loading} className={primary}>{loading ? 'Updating…' : 'Reset & Login'}</button>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
