import React, { useEffect, useState } from 'react';
import { Bug, Camera, CheckCircle2, Copy, Lightbulb, Mail, MessageSquareHeart, Phone, Send, Star, User as UserIcon, X } from 'lucide-react';
import { api } from '../lib/api';

/** Open from anywhere: window.dispatchEvent(new Event('ss-feedback')) */
export const openFeedback = () => window.dispatchEvent(new Event('ss-feedback'));

const KINDS = [
  { k: 'Suggestion', Icon: Lightbulb, on: 'bg-[#fff4d6] border-[#f5c451] text-[#8a5a00]', ic: 'text-[#d99a00]' },
  { k: 'Feedback', Icon: MessageSquareHeart, on: 'bg-[#e8f0ff] border-[#9cbcf0] text-[#174ea6]', ic: 'text-[#1f6fd1]' },
  { k: 'Problem', Icon: Bug, on: 'bg-[#ffe9ec] border-[#f4a3ab] text-[#a3141c]', ic: 'text-[#d6262f]' },
  { k: 'Photo request', Icon: Camera, on: 'bg-[#e6f6ef] border-[#9fd9b8] text-[#11643a]', ic: 'text-[#1b8a4b]' },
] as const;

const PROFILE_KEY = 'ss_fb_profile';
const RATE_TXT = ['', 'Poor', 'Okay', 'Good', 'Very good', 'Excellent'];
const inp = 'w-full h-11 pl-10 pr-3 border border-[#d9dfe8] rounded-xl text-sm outline-none transition focus:border-[#1f6fd1] focus:ring-4 focus:ring-[#1f6fd1]/10';

export function FeedbackModal({ toast }: { toast: (m: string) => void }) {
  const [open, setOpen] = useState(false);
  const [kind, setKind] = useState<(typeof KINDS)[number]['k']>('Suggestion');
  const [message, setMessage] = useState('');
  const saved = (() => {
    try {
      return JSON.parse(localStorage.getItem(PROFILE_KEY) || '{}') as { name?: string; email?: string; mobile?: string };
    } catch {
      return {};
    }
  })();
  const [name, setName] = useState(saved.name || '');
  const [email, setEmail] = useState(saved.email || (() => { try { return localStorage.getItem('ss_last_email') || ''; } catch { return ''; } })());
  const [mobile, setMobile] = useState(saved.mobile || '');
  const [rating, setRating] = useState(0);
  const [hover, setHover] = useState(0);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const [ticket, setTicket] = useState('');

  useEffect(() => {
    const on = () => {
      setTicket('');
      setErr('');
      setOpen(true);
    };
    const esc = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false);
    window.addEventListener('ss-feedback', on);
    window.addEventListener('keydown', esc);
    return () => {
      window.removeEventListener('ss-feedback', on);
      window.removeEventListener('keydown', esc);
    };
  }, []);

  if (!open) return null;

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setErr('');
    if (name.trim().length < 2) return setErr('Please enter your name.');
    if (!/^[6-9]\d{9}$/.test(mobile)) return setErr('Please enter a valid 10-digit mobile number.');
    if (message.trim().length < 10) return setErr('Please write at least 10 characters.');
    setBusy(true);
    try {
      const res = await api<{ ok: boolean; id?: string }>('/api/contact', {
        method: 'POST',
        body: JSON.stringify({
          name: name.trim(),
          email: email.trim(),
          mobile,
          kind,
          rating: rating || undefined,
          page: location.hash || '#/',
          message: message.trim(),
        }),
      });
      try {
        localStorage.setItem(PROFILE_KEY, JSON.stringify({ name: name.trim(), email: email.trim(), mobile }));
      } catch {
        // ignore
      }
      setMessage('');
      setRating(0);
      setTicket(res.id || 'SENT');
    } catch (e2) {
      setErr((e2 as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="noprint fixed inset-0 z-[60] bg-[#011f43]/45 backdrop-blur-[2px] flex items-end sm:items-center justify-center p-3" onClick={() => setOpen(false)}>
      <form
        onSubmit={submit}
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-[460px] max-h-[94vh] overflow-y-auto bg-white rounded-2xl shadow-[0_30px_60px_-20px_rgba(1,31,67,0.55)] p-5"
        role="dialog"
        aria-modal="true"
        aria-labelledby="fb-title"
      >
        <div className="flex items-start justify-between gap-3">
          <div>
            <h3 id="fb-title" className="m-0 text-[17px] font-bold text-[#011f43]">Suggestion &amp; Feedback</h3>
            <p className="m-0 mt-0.5 text-xs text-[#5c6170]">Help us make SantalStock better.</p>
          </div>
          <button type="button" onClick={() => setOpen(false)} aria-label="Close" className="w-8 h-8 rounded-full bg-[#f4f6fa] text-[#5c6170] hover:text-[#d6262f] flex items-center justify-center cursor-pointer">
            <X className="w-4 h-4" />
          </button>
        </div>

        {ticket ? (
          <div className="text-center py-6">
            <CheckCircle2 className="w-12 h-12 text-[#1b8a4b] mx-auto" aria-hidden />
            <h4 className="m-0 mt-3 text-[16px] font-bold text-[#011f43]">Thank you, {name.split(' ')[0]}!</h4>
            <p className="m-0 mt-1 text-[13px] text-[#5c6170]">We have received your {kind.toLowerCase()}. We reply within 48 hours.</p>
            {ticket !== 'SENT' && (
              <button
                type="button"
                onClick={() => { void navigator.clipboard?.writeText(ticket); toast('Ticket ID copied'); }}
                className="mt-4 inline-flex items-center gap-2 h-9 px-3.5 rounded-full bg-[#f2f4f8] text-[#011f43] text-[13px] font-mono font-semibold cursor-pointer hover:bg-[#e8ecf3]"
              >
                Ticket: {ticket} <Copy className="w-3.5 h-3.5 text-[#1f6fd1]" aria-hidden />
              </button>
            )}
            <button type="button" onClick={() => setOpen(false)} className="mt-5 w-full h-11 rounded-xl bg-[#011f43] text-white font-semibold text-sm cursor-pointer hover:brightness-125">Done</button>
          </div>
        ) : (
        <>
        <div className="grid grid-cols-4 gap-1.5 mt-4" role="radiogroup" aria-label="Type">
          {KINDS.map(({ k, Icon, on, ic }) => (
            <button
              key={k}
              type="button"
              role="radio"
              aria-checked={kind === k}
              onClick={() => setKind(k)}
              className={`h-[62px] px-1 rounded-xl border flex flex-col items-center justify-center gap-1 text-[11px] leading-tight font-semibold cursor-pointer transition ${
                kind === k ? on : 'bg-white border-[#e1e5ec] text-[#33405c] hover:bg-[#f7f9fc]'
              }`}
            >
              <Icon className={`w-[18px] h-[18px] ${ic}`} aria-hidden />
              {k}
            </button>
          ))}
        </div>

        <div className="mt-3 flex items-center gap-2" aria-label="Rating">
          <span className="text-[12.5px] font-semibold text-[#33405c]">Your rating</span>
          <div className="flex" onMouseLeave={() => setHover(0)}>
            {[1, 2, 3, 4, 5].map((n) => (
              <button key={n} type="button" aria-label={`${n} star`} onMouseEnter={() => setHover(n)} onClick={() => setRating(n === rating ? 0 : n)} className="p-0.5 bg-transparent cursor-pointer">
                <Star className={`w-5 h-5 transition ${(hover || rating) >= n ? 'fill-[#f5b301] text-[#f5b301]' : 'text-[#c9d1de]'}`} aria-hidden />
              </button>
            ))}
          </div>
          <span className="text-[12px] text-[#8a93a6]">{RATE_TXT[hover || rating] || 'optional'}</span>
        </div>

        <div className="relative mt-3">
          <textarea
            required
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            rows={4}
            maxLength={2000}
            placeholder={kind === 'Problem' ? 'What went wrong? Which page?' : kind === 'Photo request' ? 'Which photo do you need? Place, subject, use…' : 'Write your idea or feedback…'}
            className="w-full border border-[#d9dfe8] rounded-xl px-3 py-2.5 pb-6 text-sm outline-none transition focus:border-[#1f6fd1] focus:ring-4 focus:ring-[#1f6fd1]/10 resize-y"
          />
          <span className="absolute right-3 bottom-2.5 text-[10.5px] text-[#8a93a6] tabular-nums">{message.length}/2000</span>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 mt-2">
          <span className="relative sm:col-span-2">
            <UserIcon className="w-4 h-4 text-[#1f6fd1] absolute left-3.5 top-1/2 -translate-y-1/2" aria-hidden />
            <input required autoComplete="name" value={name} onChange={(e) => setName(e.target.value)} placeholder="Your name" className={inp} />
          </span>
          <span className="relative">
            <Mail className="w-4 h-4 text-[#d6262f] absolute left-3.5 top-1/2 -translate-y-1/2" aria-hidden />
            <input required type="email" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="Email" className={inp} />
          </span>
          <span className="relative">
            <Phone className="w-4 h-4 text-[#1b8a4b] absolute left-3.5 top-1/2 -translate-y-1/2" aria-hidden />
            <input required type="tel" inputMode="numeric" autoComplete="tel-national" value={mobile} onChange={(e) => setMobile(e.target.value.replace(/\D/g, '').replace(/^(91|0)(?=\d{10})/, '').slice(0, 10))} placeholder="Mobile (10 digits)" pattern="[6-9][0-9]{9}" className={inp} />
          </span>
        </div>
        {err && <div className="mt-3 rounded-xl border border-[#f4c2c6] bg-[#fff2f3] px-3 py-2 text-[12.5px] text-[#a3141c]" role="alert">{err}</div>}
        <button
          type="submit"
          disabled={busy}
          className="mt-4 w-full h-11 rounded-xl bg-[#d6262f] hover:bg-[#bf1f28] disabled:opacity-60 text-white font-semibold text-sm flex items-center justify-center gap-2 cursor-pointer transition"
        >
          <Send className="w-4 h-4" aria-hidden /> {busy ? 'Sending…' : 'Send'}
        </button>
        <p className="m-0 mt-2 text-center text-[11px] text-[#8a93a6]">Your details are used only to reply to you.</p>
        </>
        )}
      </form>
    </div>
  );
}
