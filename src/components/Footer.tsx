import React, { useState } from 'react';
import { Lock, Mail, MapPin, MessageSquarePlus, Pencil } from 'lucide-react';
import { FeedbackModal, openFeedback } from './FeedbackModal';
import { DonateButton, DonateModal } from './DonateModal';
import { LANGS, tr } from '../data/defaults';
import { api } from '../lib/api';
import type { AdminEditTarget, LangCode, SiteConfig } from '../types';

interface FooterProps {
  lang: LangCode;
  onChangeLang: (l: LangCode) => void;
  siteConfig: SiteConfig;
  adminMode: boolean;
  onAdminEdit: (t: AdminEditTarget) => void;
  onNavigate: (hash: string) => void;
  toast: (m: string) => void;
}

const SOCIAL_COLOR: Record<string, string> = { fb: '#1877F2', ig: '#E4405F', yt: '#FF0000', x: '#1D9BF0', wa: '#25D366' };

const SOCIAL_ICONS: [string, string, string][] = [
  ['fb', 'Facebook', 'M14 8h3V4h-3c-2.8 0-4 1.7-4 4v2H7v4h3v8h4v-8h3l1-4h-4V8.5c0-.3.2-.5.5-.5z'],
  ['ig', 'Instagram', 'M12 7a5 5 0 100 10 5 5 0 000-10zm0 8a3 3 0 110-6 3 3 0 010 6zm5.5-9a1.2 1.2 0 100 2.4 1.2 1.2 0 000-2.4zM12 2c-2.7 0-3 0-4.1.1C4 2.3 2.3 4 2.1 7.9 2 9 2 9.3 2 12s0 3 .1 4.1C2.3 20 4 21.7 7.9 21.9 9 22 9.3 22 12 22s3 0 4.1-.1c3.9-.2 5.6-1.9 5.8-5.8.1-1.1.1-1.4.1-4.1s0-3-.1-4.1C21.7 4 20 2.3 16.1 2.1 15 2 14.7 2 12 2zm0 2c2.7 0 2.9 0 4 .1 2.7.1 3.8 1.3 3.9 3.9.1 1.1.1 1.3.1 4s0 2.9-.1 4c-.1 2.6-1.3 3.8-3.9 3.9-1.1.1-1.3.1-4 .1s-2.9 0-4-.1C5.4 19.8 4.2 18.6 4.1 16 4 14.9 4 14.7 4 12s0-2.9.1-4C4.2 5.4 5.4 4.2 8 4.1 9.1 4 9.3 4 12 4z'],
  ['yt', 'YouTube', 'M23 7.2s-.2-1.6-.9-2.3c-.9-.9-1.9-.9-2.3-1C16.5 3.6 12 3.6 12 3.6s-4.5 0-7.8.3c-.5.1-1.5.1-2.3 1C1.2 5.6 1 7.2 1 7.2S.8 9.1.8 11v1.8c0 1.9.2 3.8.2 3.8s.2 1.6.9 2.3c.9.9 2 .9 2.5 1 1.8.2 7.6.2 7.6.2s4.5 0 7.8-.3c.5-.1 1.5-.1 2.3-1 .7-.7.9-2.3.9-2.3s.2-1.9.2-3.8V11c0-1.9-.2-3.8-.2-3.8zM9.7 15V8.4l6.2 3.3L9.7 15z'],
  ['x', 'X', 'M17.8 3h3.3l-7.2 8.2L22.4 21h-6.6l-5.2-6.8L4.6 21H1.3l7.7-8.8L.9 3h6.8l4.7 6.2L17.8 3zm-1.2 16h1.8L6.6 4.9H4.7L16.6 19z'],
  ['wa', 'WhatsApp', 'M12 2a10 10 0 00-8.6 15.1L2 22l5-1.3A10 10 0 1012 2zm0 18a8 8 0 01-4.1-1.1l-.3-.2-3 .8.8-2.9-.2-.3A8 8 0 1112 20zm4.4-6c-.2-.1-1.4-.7-1.7-.8-.2-.1-.4-.1-.5.1l-.8.9c-.1.2-.3.2-.5.1a6.6 6.6 0 01-3.3-2.9c-.2-.4.2-.4.7-1.3.1-.2 0-.3 0-.4l-.8-1.8c-.2-.5-.4-.4-.5-.4h-.5a.9.9 0 00-.7.3 2.8 2.8 0 00-.9 2.1 5 5 0 001 2.6 11.2 11.2 0 004.3 3.8c1.6.7 2.2.7 3 .6.5-.1 1.4-.6 1.6-1.1.2-.6.2-1 .1-1.1l-.5-.3z'],
];


export function Footer({ lang, onChangeLang, siteConfig, adminMode, onAdminEdit, onNavigate, toast }: FooterProps) {
  const [email, setEmail] = useState('');

  async function handleSubscribe(e: React.FormEvent) {
    e.preventDefault();
    try {
      await api('/api/newsletter', { method: 'POST', body: JSON.stringify({ email }) });
      setEmail('');
      toast(tr(lang, 'subscribed'));
    } catch (err) {
      toast((err as Error).message);
    }
  }

  return (
    <footer className="bg-gradient-to-b from-[#eef3fb] to-[#e4ecf8] text-[#33405c] border-t border-[#d6deeb] mt-12 text-sm">
      <div className="bg-[#f5f8fd] border-b border-[#d6deeb] py-6">
        <div className="wrap flex items-center justify-between gap-5 flex-wrap">
          <div
            className={adminMode ? 'admin-edit-zone px-2 py-1' : ''}
            onClick={() => adminMode && onAdminEdit({ section: 'footer' })}
          >
            <h3 className="dm text-[#011f43] text-[22px] m-0">{siteConfig.footer.newsletterTitle}</h3>
            <span className="text-[#4a5568]">{siteConfig.footer.newsletterSubtitle}</span>
          </div>
          <form
            onSubmit={handleSubscribe}
            className="flex bg-white border border-[#c5cfe0] rounded-full p-1 min-w-[min(420px,100%)] shadow-[0_4px_12px_rgba(1,31,67,0.06)]"
          >
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@email.com"
              className="border-0 rounded-full bg-transparent outline-none px-4 py-2 text-[#111] flex-1"
            />
            <button
              type="submit"
              className="rounded-full bg-[#d6262f] text-white px-5 py-2 font-semibold whitespace-nowrap cursor-pointer"
            >
              {tr(lang, 'subscribe')}
            </button>
          </form>
        </div>
      </div>

      <div className="py-10 pb-6 relative">
        {adminMode && (
          <div className="wrap mb-3 flex justify-end">
            <button
              type="button"
              onClick={() => onAdminEdit({ section: 'footer' })}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-[#d6262f] text-white text-xs font-bold shadow cursor-pointer"
            >
              <Pencil className="w-3.5 h-3.5" /> Edit Footer Links, Text & Contact
            </button>
          </div>
        )}
        <div className="wrap grid grid-cols-2 lg:grid-cols-[2.2fr_1fr_1fr_1fr_1fr] gap-7">
          <div className="col-span-2 lg:col-span-1">
            <div className="dm text-[28px] leading-tight">
              <span style={{ color: siteConfig.brand.logoPart1.color }}>{siteConfig.brand.logoPart1.text}</span>
              <span style={{ color: siteConfig.brand.logoPart2.color }}>{siteConfig.brand.logoPart2.text}</span>
            </div>
            <p className="mt-2 text-[#33405c]">{siteConfig.footer.taglineCustom || tr(lang, 'ftag')}</p>
            <div className="flex gap-2.5 my-3.5">
              {SOCIAL_ICONS.map(([key, label, d]) => (
                <a
                  key={key}
                  href="#/contact"
                  onClick={(e) => {
                    e.preventDefault();
                    onNavigate('#/contact');
                  }}
                  aria-label={label}
                  title={label}
                  style={{ ['--b' as string]: SOCIAL_COLOR[key] } as React.CSSProperties}
                  className="w-9 h-9 rounded-full bg-white border border-[#d6deeb] text-[var(--b)] flex items-center justify-center shadow-sm hover:bg-[var(--b)] hover:border-[var(--b)] hover:text-white transition-colors"
                >
                  <svg viewBox="0 0 24 24" className="w-4 h-4 fill-current">
                    <path d={d} />
                  </svg>
                </a>
              ))}
            </div>
            <div className="my-2 flex flex-col gap-1.5 text-[#33405c]">
              <a href={`mailto:${siteConfig.contact.email}`} className="inline-flex items-center gap-2 no-underline text-inherit hover:text-[#d6262f]">
                <Mail className="w-4 h-4 text-[#d6262f]" aria-hidden /> {siteConfig.contact.email}
              </a>
              <span className="inline-flex items-center gap-2">
                <MapPin className="w-4 h-4 text-[#1b8a4b]" aria-hidden /> {siteConfig.contact.location}
              </span>
            </div>
            <div className="mt-2 flex items-center gap-2 flex-wrap">
            <select
              aria-label={tr(lang, 'lang')}
              value={lang}
              onChange={(e) => onChangeLang(e.target.value as LangCode)}
              className="bg-white text-[#011f43] border border-[#c5cfe0] rounded-full px-3 py-1.5 text-xs font-semibold w-auto"
            >
              {LANGS.map((l) => (
                <option key={l.k} value={l.k}>
                  {l.n}
                </option>
              ))}
            </select>
            <button
              type="button"
              onClick={openFeedback}
              className="inline-flex items-center gap-1.5 bg-white text-[#011f43] border border-[#c5cfe0] rounded-full px-3 py-1.5 text-xs font-semibold cursor-pointer hover:border-[#d6262f] hover:text-[#d6262f] transition-colors"
            >
              <MessageSquarePlus className="w-3.5 h-3.5 text-[#e0730f]" aria-hidden /> Suggestion / Feedback
            </button>
            <DonateButton />
            </div>
          </div>

          {siteConfig.footer.columns.map((col) => (
            <div key={col.id}>
              <h5 className="text-[#011f43] text-[13px] uppercase tracking-[1.5px] font-extrabold mb-3 mt-0">
                {col.heading}
              </h5>
              <div className="flex flex-col gap-1.5">
                {col.links.map((lk) => (
                  <a
                    key={lk.id}
                    href={lk.href}
                    onClick={(e) => {
                      e.preventDefault();
                      onNavigate(lk.href);
                    }}
                    className="text-[#2b3a55] hover:text-[#d6262f] no-underline font-medium transition-colors"
                  >
                    {lk.label}
                  </a>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>

      <div id="ss-legal" className="bg-[#011f43] text-[#c9d4e6] text-[12.5px]">
        <div className="wrap py-4 flex flex-col lg:flex-row items-center justify-between gap-3">
          <p className="m-0 text-center lg:text-left leading-relaxed">
            © {new Date().getFullYear()} <b className="text-white font-semibold">SantalStock</b>
            <span className="mx-2 text-white/30">|</span>
            <span className="whitespace-nowrap">{siteConfig.contact.venture.replace(/baski online service center/gi, 'BASKI ONLINE SERVICE CENTER')}</span>
            <span className="mx-2 text-white/30">|</span>
            {siteConfig.footer.rights}
          </p>
          <div className="flex items-center justify-center gap-1.5 flex-wrap">
            <span className="inline-flex items-center gap-1 text-[10.5px] font-bold uppercase tracking-[0.1em] text-[#8fd4ad] mr-1">
              <Lock className="w-3 h-3" aria-hidden /> {tr(lang, 'secure')}
            </span>
            {siteConfig.footer.paymentMethods.map((pm) => (
              <span
                key={pm}
                className="inline-flex items-center h-[22px] px-2 rounded-[5px] bg-white/[0.08] border border-white/15 text-white text-[10.5px] font-bold tracking-wide whitespace-nowrap"
              >
                {pm}
              </span>
            ))}
          </div>
        </div>
      </div>
      <FeedbackModal toast={toast} />
      <DonateModal siteConfig={siteConfig} toast={toast} />
    </footer>
  );
}
