import React, { useEffect, useState } from 'react';
import { Bug, Lightbulb, MessageSquareHeart, Send, X } from 'lucide-react';
import { api } from '../lib/api';

/** Open from anywhere: window.dispatchEvent(new Event('ss-feedback')) */
export const openFeedback = () => window.dispatchEvent(new Event('ss-feedback'));

const KINDS = [
  { k: 'Suggestion', Icon: Lightbulb, on: 'bg-[#fff4d6] border-[#f5c451] text-[#8a5a00]', ic: 'text-[#d99a00]' },
  { k: 'Feedback', Icon: MessageSquareHeart, on: 'bg-[#e8f0ff] border-[#9cbcf0] text-[#174ea6]', ic: 'text-[#1f6fd1]' },
  { k: 'Problem', Icon: Bug, on: 'bg-[#ffe9ec] border-[#f4a3ab] text-[#a3141c]', ic: 'text-[#d6262f]' },
] as const;

export function FeedbackModal({ toast }: { toast: (m: string) => void }) {
  const [open, setOpen] = useState(false);
  const [kind, setKind] = useState<(typeof KINDS)[number]['k']>('Suggestion');
  const [message, setMessage] = useState('');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    const on = () => setOpen(true);
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
    if (message.trim().length < 5) {
      toast('Please write a little more.');
      return;
    }
    setBusy(true);
    try {
      await api('/api/contact', {
        method: 'POST',
        body: JSON.stringify({
          name: name.trim() || `${kind} (guest)`,
          email: email.trim() || 'not-given',
          message: `[${kind}] ${message.trim()}\n— page: ${location.hash || '#/'}`,
        }),
      });
      setMessage('');
      setOpen(false);
      toast('Thank you! Your ' + kind.toLowerCase() + ' has been sent.');
    } catch (err) {
      toast((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="noprint fixed inset-0 z-[60] bg-[#011f43]/45 backdrop-blur-[2px] flex items-end sm:items-center justify-center p-3" onClick={() => setOpen(false)}>
      <form
        onSubmit={submit}
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-[440px] bg-white rounded-2xl shadow-[0_30px_60px_-20px_rgba(1,31,67,0.55)] p-5"
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

        <div className="grid grid-cols-3 gap-2 mt-4" role="radiogroup" aria-label="Type">
          {KINDS.map(({ k, Icon, on, ic }) => (
            <button
              key={k}
              type="button"
              role="radio"
              aria-checked={kind === k}
              onClick={() => setKind(k)}
              className={`h-16 rounded-xl border flex flex-col items-center justify-center gap-1 text-[12px] font-semibold cursor-pointer transition ${
                kind === k ? on : 'bg-white border-[#e1e5ec] text-[#33405c] hover:bg-[#f7f9fc]'
              }`}
            >
              <Icon className={`w-5 h-5 ${ic}`} aria-hidden />
              {k}
            </button>
          ))}
        </div>

        <textarea
          required
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          rows={4}
          maxLength={2000}
          placeholder={kind === 'Problem' ? 'What went wrong? Which page?' : 'Write your idea or feedback…'}
          className="mt-3 w-full border border-[#d9dbe1] rounded-xl px-3 py-2.5 text-sm outline-none focus:border-[#1f6fd1] focus:ring-2 focus:ring-[#1f6fd1]/15 resize-y"
        />
        <div className="grid grid-cols-2 gap-2 mt-2">
          <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Name (optional)" className="border border-[#d9dbe1] rounded-xl px-3 py-2 text-sm outline-none focus:border-[#1f6fd1]" />
          <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="Email (optional)" className="border border-[#d9dbe1] rounded-xl px-3 py-2 text-sm outline-none focus:border-[#1f6fd1]" />
        </div>
        <button
          type="submit"
          disabled={busy}
          className="mt-4 w-full h-11 rounded-xl bg-[#d6262f] hover:bg-[#bf1f28] disabled:opacity-60 text-white font-semibold text-sm flex items-center justify-center gap-2 cursor-pointer"
        >
          <Send className="w-4 h-4" aria-hidden /> {busy ? 'Sending…' : 'Send'}
        </button>
      </form>
    </div>
  );
}
