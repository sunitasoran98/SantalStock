import React, { useEffect, useState } from 'react';
import { Copy, Heart, X } from 'lucide-react';
import { UpiQr } from './UpiQr';
import { DEFAULT_SITE_CONFIG } from '../data/defaults';
import type { SiteConfig } from '../types';

/** Open from anywhere: openDonate() */
export const openDonate = () => window.dispatchEvent(new Event('ss-donate'));

const AMOUNTS = [21, 51, 101, 251, 501];

/** Small ❤ Donate pill. Opens the UPI donation box. */
export function DonateButton({ className = '', label = 'Donate' }: { className?: string; label?: string }) {
  return (
    <button
      type="button"
      onClick={openDonate}
      title="Support SantalStock"
      className={`inline-flex items-center gap-1.5 rounded-full border border-[#f4a3ab] bg-[#fff1f3] text-[#c8102e] px-3 py-1.5 text-xs font-bold cursor-pointer hover:bg-[#ffe4e8] transition-colors ${className}`}
    >
      <Heart className="w-3.5 h-3.5 fill-[#e11d48] text-[#e11d48]" aria-hidden /> {label}
    </button>
  );
}

export function DonateModal({ siteConfig, toast }: { siteConfig: SiteConfig; toast: (m: string) => void }) {
  const [open, setOpen] = useState(false);
  const [amt, setAmt] = useState(51);
  const [custom, setCustom] = useState('');
  const pay = siteConfig.payment?.upiId ? siteConfig.payment : DEFAULT_SITE_CONFIG.payment!;

  useEffect(() => {
    const on = () => setOpen(true);
    const esc = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false);
    window.addEventListener('ss-donate', on);
    window.addEventListener('keydown', esc);
    return () => {
      window.removeEventListener('ss-donate', on);
      window.removeEventListener('keydown', esc);
    };
  }, []);
  if (!open) return null;

  const value = Math.max(1, Math.min(100000, Number(custom) || amt));
  const upiUrl = `upi://pay?pa=${encodeURIComponent(pay.upiId).replace(/%40/g, '@')}&pn=${encodeURIComponent(pay.payeeName)}&am=${value}&cu=INR&tn=${encodeURIComponent('SantalStock Donation')}`;

  return (
    <div className="fixed inset-0 z-[200] bg-black/45 flex items-center justify-center p-3" onClick={() => setOpen(false)}>
      <div role="dialog" aria-label="Donate" className="w-full max-w-md bg-white rounded-2xl shadow-2xl overflow-hidden" onClick={(e) => e.stopPropagation()}>
        <div className="bg-gradient-to-r from-[#c8102e] to-[#e0730f] text-white px-5 py-4 flex items-start justify-between gap-3">
          <div>
            <h3 className="m-0 text-lg font-extrabold flex items-center gap-2"><Heart className="w-5 h-5 fill-white" /> Support SantalStock</h3>
            <p className="m-0 mt-1 text-xs text-white/90">Aapka sahyog Santal sanskriti ki photo bachane aur free rakhne me madad karta hai.</p>
          </div>
          <button type="button" aria-label="Close" onClick={() => setOpen(false)} className="bg-white/15 border-0 text-white rounded-full w-8 h-8 flex items-center justify-center cursor-pointer"><X className="w-4 h-4" /></button>
        </div>
        <div className="p-5">
          <div className="flex flex-wrap gap-2">
            {AMOUNTS.map((a) => (
              <button key={a} type="button" onClick={() => { setAmt(a); setCustom(''); }} className={`px-3.5 py-1.5 rounded-full border text-sm font-bold cursor-pointer ${!custom && amt === a ? 'bg-[#011f43] text-white border-[#011f43]' : 'bg-white text-[#011f43] border-[#d9dbe1]'}`}>₹{a}</button>
            ))}
            <input inputMode="numeric" value={custom} onChange={(e) => setCustom(e.target.value.replace(/\D/g, '').slice(0, 6))} placeholder="Apni rakam ₹" className="w-32 px-3 py-1.5 border border-[#d9dbe1] rounded-full text-sm" />
          </div>
          <div className="flex flex-col sm:flex-row items-center gap-4 mt-4">
            <div className="w-40 h-40 shrink-0 rounded-xl border border-[#d9dbe1] p-2 bg-white"><UpiQr value={upiUrl} className="w-full h-full object-contain" /></div>
            <div className="flex-1 w-full text-xs text-[#33405c] space-y-2">
              <div className="text-2xl font-extrabold text-[#011f43] tabular-nums">₹{value}</div>
              <p className="m-0">Kisi bhi UPI app (GPay, PhonePe, Paytm) se QR scan karein.</p>
              <div className="flex items-center gap-2 flex-wrap">
                <code className="px-2 py-1 rounded bg-[#eef1f7] font-bold text-[#011f43]">{pay.upiId}</code>
                <button type="button" onClick={() => { navigator.clipboard?.writeText(pay.upiId); toast('UPI ID copied'); }} className="inline-flex items-center gap-1 px-2 py-1 rounded border border-[#d9dbe1] bg-white font-semibold cursor-pointer"><Copy className="w-3 h-3" /> Copy</button>
              </div>
              <div className="text-[11px] text-[#5c6170]">{pay.payeeName}</div>
              <a href={upiUrl} className="sm:hidden flex items-center justify-center w-full py-2.5 rounded-lg bg-[#1b8a4b] text-white font-bold no-underline">UPI app me kholen</a>
            </div>
          </div>
          <p className="text-[11px] text-[#5c6170] mt-4 mb-0">Donation swaichhik hai. Iske badle koi photo license nahi milta. Dhanyavaad ❤ BASKI ONLINE SERVICE CENTER</p>
        </div>
      </div>
    </div>
  );
}
