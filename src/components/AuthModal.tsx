import React, { useState } from 'react';
import { Mail, Lock, ShieldCheck, KeyRound, X, RefreshCw, CheckCircle2 } from 'lucide-react';
import { api, setToken } from '../lib/api';
import type { User } from '../types';

type AuthMode = 'login' | 'register' | 'verify' | 'forgot' | 'reset';

interface AuthModalProps {
  initialMode?: 'login' | 'register';
  onClose: () => void;
  onSuccess: (user: User) => void;
  toast: (msg: string) => void;
}

export function AuthModal({ initialMode = 'login', onClose, onSuccess, toast }: AuthModalProps) {
  const [mode, setMode] = useState<AuthMode>(initialMode);
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [role, setRole] = useState<'buyer' | 'contributor'>('buyer');
  const [otp, setOtp] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [deliveryInfo, setDeliveryInfo] = useState<{ sentViaSmtp: boolean; previewCode?: string; message?: string } | null>(null);

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
        setToken(res.token);
        toast(`Welcome, ${res.user.name}`);
        onSuccess(res.user);
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
        body: JSON.stringify({ name, email, password, role }),
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
      setToken(res.token);
      toast(`Email verified! Welcome, ${res.user.name}`);
      onSuccess(res.user);
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
      setToken(res.token);
      toast('Password updated & signed in');
      onSuccess(res.user);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 bg-black/60 backdrop-blur-[2px] flex items-center justify-center p-4"
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div className="bg-white border border-[#d9dbe1] rounded-2xl w-full max-w-[480px] max-h-[92vh] overflow-y-auto p-6 shadow-2xl">
        <div className="flex items-start justify-between gap-3 mb-4">
          <div>
            <h2 className="dm text-[28px] text-[#011f43] leading-tight m-0">
              {mode === 'login' && 'Real Email Sign In'}
              {mode === 'register' && 'Create Real Email Account'}
              {mode === 'verify' && 'Verify Your Email'}
              {mode === 'forgot' && 'Reset Password'}
              {mode === 'reset' && 'Enter Reset Code'}
            </h2>
            <p className="text-xs text-[#5c6170] mt-1">
              {mode === 'login' && 'Sign in with your verified email & password'}
              {mode === 'register' && 'Verified email required (Gmail, Outlook, Yahoo, or domain email)'}
              {mode === 'verify' && `Enter the 6-digit code sent to ${email}`}
              {mode === 'forgot' && 'We will send a 6-digit recovery code to your email'}
              {mode === 'reset' && `Reset password for ${email}`}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="w-9 h-9 rounded-full border border-[#d9dbe1] bg-white text-[#011f43] flex items-center justify-center hover:bg-slate-50 cursor-pointer"
            aria-label="Close"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {error && (
          <div className="mb-4 rounded-xl border border-red-200 bg-red-50 px-3.5 py-2.5 text-sm text-red-700 font-medium">
            {error}
          </div>
        )}

        {(mode === 'verify' || mode === 'reset') && deliveryInfo && (
          <div className="mb-4 rounded-xl border border-emerald-200 bg-emerald-50 px-3.5 py-3 text-sm text-emerald-900">
            <div className="flex items-center gap-2 font-semibold">
              <CheckCircle2 className="w-4 h-4 text-emerald-700 shrink-0" />
              {deliveryInfo.sentViaSmtp
                ? `Email sent to ${email}. Check your inbox & spam folder.`
                : `Live Verification Code for ${email}`}
            </div>
            {!deliveryInfo.sentViaSmtp && deliveryInfo.previewCode && (
              <div className="mt-2 flex items-center justify-between gap-2 bg-white border border-emerald-200 rounded-lg px-3 py-2">
                <div>
                  <div className="text-[11px] text-slate-500">Your 6-digit OTP code:</div>
                  <div className="font-mono text-xl font-extrabold tracking-[6px] text-[#011f43] tabular-nums">
                    {deliveryInfo.previewCode}
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setOtp(deliveryInfo.previewCode || '')}
                  className="px-3 py-1.5 rounded-lg bg-[#011f43] text-white text-xs font-semibold cursor-pointer"
                >
                  Auto-fill
                </button>
              </div>
            )}
            {!deliveryInfo.sentViaSmtp && (
              <p className="text-[11px] text-emerald-800/80 mt-1.5 mb-0">
                Tip: Add RESEND_API_KEY (Cloudflare Pages) or SMTP_HOST/SMTP_USER/SMTP_PASS (local server) to send OTP codes directly to user inboxes.
              </p>
            )}
          </div>
        )}

        {mode === 'login' && (
          <form onSubmit={handleLogin} className="space-y-3.5">
            <div>
              <label className="block text-sm font-semibold text-[#111] mb-1">Email Address</label>
              <div className="relative">
                <Mail className="w-4 h-4 text-[#5c6170] absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="yourname@gmail.com"
                  className="w-full pl-9 pr-3 py-2.5 border border-[#d9dbe1] rounded-lg text-sm outline-none focus:border-[#2f3f8f]"
                />
              </div>
            </div>
            <div>
              <label className="block text-sm font-semibold text-[#111] mb-1">Password</label>
              <div className="relative">
                <Lock className="w-4 h-4 text-[#5c6170] absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="password"
                  required
                  minLength={6}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="w-full pl-9 pr-3 py-2.5 border border-[#d9dbe1] rounded-lg text-sm outline-none focus:border-[#2f3f8f]"
                />
              </div>
            </div>
            <div className="flex items-center justify-between text-xs">
              <button
                type="button"
                onClick={() => { setError(''); setMode('forgot'); }}
                className="text-[#2f3f8f] font-semibold hover:underline bg-transparent border-0 p-0 cursor-pointer"
              >
                Forgot password?
              </button>
            </div>
            <div className="flex gap-2.5 pt-1">
              <button
                type="submit"
                disabled={loading}
                className="flex-1 py-2.5 px-4 rounded-lg bg-[#011f43] text-white font-semibold text-sm hover:bg-[#0d2f5c] disabled:opacity-50 cursor-pointer"
              >
                {loading ? 'Signing in...' : 'Sign In'}
              </button>
              <button
                type="button"
                onClick={onClose}
                className="py-2.5 px-4 rounded-lg border border-[#d9dbe1] bg-white text-[#011f43] font-semibold text-sm cursor-pointer"
              >
                Cancel
              </button>
            </div>
            <p className="text-xs text-[#5c6170] pt-1">
              New to SantalStock?{' '}
              <button
                type="button"
                onClick={() => { setError(''); setMode('register'); }}
                className="text-[#d6262f] font-bold hover:underline bg-transparent border-0 p-0 cursor-pointer"
              >
                Create real email account
              </button>
            </p>
            <div className="rounded-lg bg-[#f6f7fb] border border-[#e3e7f0] p-3 text-xs text-[#5c6170] space-y-1">
              <div className="font-semibold text-[#011f43]">Admin Access</div>
              <div>Default Admin: <code className="text-[#011f43]">admin@santalstock.in</code> / <code className="text-[#011f43]">admin123</code></div>
              <div>Or register with owner email (<code className="text-[#011f43]">sunitasoran98@gmail.com</code>) for automatic Admin role.</div>
            </div>
          </form>
        )}

        {mode === 'register' && (
          <form onSubmit={handleRegister} className="space-y-3.5">
            <div>
              <label className="block text-sm font-semibold text-[#111] mb-1">Full Name</label>
              <input
                type="text"
                required
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. Sunita Soren"
                className="w-full px-3 py-2.5 border border-[#d9dbe1] rounded-lg text-sm outline-none focus:border-[#2f3f8f]"
              />
            </div>
            <div>
              <label className="block text-sm font-semibold text-[#111] mb-1">Real Email Address</label>
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="yourname@gmail.com"
                className="w-full px-3 py-2.5 border border-[#d9dbe1] rounded-lg text-sm outline-none focus:border-[#2f3f8f]"
              />
            </div>
            <div>
              <label className="block text-sm font-semibold text-[#111] mb-1">Account Type</label>
              <select
                value={role}
                onChange={(e) => setRole(e.target.value as 'buyer' | 'contributor')}
                className="w-full px-3 py-2.5 border border-[#d9dbe1] rounded-lg text-sm bg-white outline-none focus:border-[#2f3f8f]"
              >
                <option value="buyer">Buyer (photos kharidna)</option>
                <option value="contributor">Contributor (photos bechna)</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-semibold text-[#111] mb-1">Password (min 6 chars)</label>
              <input
                type="password"
                required
                minLength={6}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Create a strong password"
                className="w-full px-3 py-2.5 border border-[#d9dbe1] rounded-lg text-sm outline-none focus:border-[#2f3f8f]"
              />
            </div>
            <div className="flex gap-2.5 pt-1">
              <button
                type="submit"
                disabled={loading}
                className="flex-1 py-2.5 px-4 rounded-lg bg-[#d6262f] text-white font-semibold text-sm hover:bg-[#b81d25] disabled:opacity-50 cursor-pointer"
              >
                {loading ? 'Checking email...' : 'Send Verification Code'}
              </button>
              <button
                type="button"
                onClick={onClose}
                className="py-2.5 px-4 rounded-lg border border-[#d9dbe1] bg-white text-[#011f43] font-semibold text-sm cursor-pointer"
              >
                Cancel
              </button>
            </div>
            <p className="text-xs text-[#5c6170]">
              Already have an account?{' '}
              <button
                type="button"
                onClick={() => { setError(''); setMode('login'); }}
                className="text-[#2f3f8f] font-bold hover:underline bg-transparent border-0 p-0 cursor-pointer"
              >
                Sign in
              </button>
            </p>
          </form>
        )}

        {mode === 'verify' && (
          <form onSubmit={handleVerify} className="space-y-4">
            <div>
              <label className="block text-sm font-semibold text-[#111] mb-1">6-Digit Verification Code</label>
              <div className="relative">
                <ShieldCheck className="w-4 h-4 text-[#17803d] absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  required
                  maxLength={6}
                  pattern="[0-9]{6}"
                  value={otp}
                  onChange={(e) => setOtp(e.target.value.replace(/\D/g, '').slice(0, 6))}
                  placeholder="123456"
                  className="w-full pl-9 pr-3 py-2.5 border border-[#d9dbe1] rounded-lg text-lg font-mono tracking-[6px] tabular-nums outline-none focus:border-[#17803d]"
                />
              </div>
            </div>
            <div className="flex gap-2.5">
              <button
                type="submit"
                disabled={loading}
                className="flex-1 py-2.5 px-4 rounded-lg bg-[#17803d] text-white font-semibold text-sm hover:bg-[#136a32] disabled:opacity-50 cursor-pointer"
              >
                {loading ? 'Verifying...' : 'Verify & Sign In'}
              </button>
              <button
                type="button"
                disabled={loading}
                onClick={handleResend}
                className="py-2.5 px-3.5 rounded-lg border border-[#d9dbe1] bg-white text-[#011f43] font-semibold text-xs inline-flex items-center gap-1.5 cursor-pointer"
              >
                <RefreshCw className="w-3.5 h-3.5" /> Resend
              </button>
            </div>
          </form>
        )}

        {mode === 'forgot' && (
          <form onSubmit={handleForgot} className="space-y-4">
            <div>
              <label className="block text-sm font-semibold text-[#111] mb-1">Registered Email</label>
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="yourname@gmail.com"
                className="w-full px-3 py-2.5 border border-[#d9dbe1] rounded-lg text-sm outline-none focus:border-[#2f3f8f]"
              />
            </div>
            <div className="flex gap-2.5">
              <button
                type="submit"
                disabled={loading}
                className="flex-1 py-2.5 px-4 rounded-lg bg-[#011f43] text-white font-semibold text-sm cursor-pointer"
              >
                {loading ? 'Sending...' : 'Send Reset Code'}
              </button>
              <button
                type="button"
                onClick={() => setMode('login')}
                className="py-2.5 px-4 rounded-lg border border-[#d9dbe1] bg-white text-[#011f43] font-semibold text-sm cursor-pointer"
              >
                Back
              </button>
            </div>
          </form>
        )}

        {mode === 'reset' && (
          <form onSubmit={handleReset} className="space-y-3.5">
            <div>
              <label className="block text-sm font-semibold text-[#111] mb-1">6-Digit Reset Code</label>
              <div className="relative">
                <KeyRound className="w-4 h-4 text-[#5c6170] absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  required
                  maxLength={6}
                  value={otp}
                  onChange={(e) => setOtp(e.target.value.replace(/\D/g, '').slice(0, 6))}
                  placeholder="123456"
                  className="w-full pl-9 pr-3 py-2.5 border border-[#d9dbe1] rounded-lg font-mono tracking-[6px] text-base outline-none focus:border-[#2f3f8f]"
                />
              </div>
            </div>
            <div>
              <label className="block text-sm font-semibold text-[#111] mb-1">New Password</label>
              <input
                type="password"
                required
                minLength={6}
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                placeholder="At least 6 characters"
                className="w-full px-3 py-2.5 border border-[#d9dbe1] rounded-lg text-sm outline-none focus:border-[#2f3f8f]"
              />
            </div>
            <button
              type="submit"
              disabled={loading}
              className="w-full py-2.5 px-4 rounded-lg bg-[#17803d] text-white font-semibold text-sm cursor-pointer"
            >
              {loading ? 'Updating...' : 'Reset Password & Sign In'}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
