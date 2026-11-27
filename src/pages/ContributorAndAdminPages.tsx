import React, { useState } from 'react';
import ComboBox from '../components/ComboBox';
import { CATEGORY_OPTIONS, TITLE_OPTIONS } from '../data/pickLists';
import { Pencil, Trash2, Plus, Download, RotateCcw, Upload, GitBranch } from 'lucide-react';
import { GitHubSourcePanel } from '../components/GitHubSourcePanel';
import { thumbUrl, tr } from '../data/defaults';
import { api } from '../lib/api';
import { fingerprintFile, type ImageFingerprint } from '../lib/imageFingerprint';
import { AdminDupPanel, UploadDupStatus, type DupMatch, type DupState } from '../components/DuplicateCheck';
import { webResultText } from '../lib/webResult';
import type { AdminEditTarget, Asset, LangCode, Order, Payout, SiteConfig, User } from '../types';

function readImageForUpload(file: File): Promise<{ w: number; h: number; prevUrl: string; fullUrl: string }> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const img = new Image();
      img.onload = () => {
        const scale = (max: number, q: number, webp = false) => {
          const c = document.createElement('canvas');
          const s = Math.min(1, max / Math.max(img.naturalWidth, img.naturalHeight));
          c.width = Math.round(img.naturalWidth * s);
          c.height = Math.round(img.naturalHeight * s);
          c.getContext('2d')?.drawImage(img, 0, 0, c.width, c.height);
          if (webp) {
            const w = c.toDataURL('image/webp', q);
            if (w.startsWith('data:image/webp')) return w;
          }
          return c.toDataURL('image/jpeg', q);
        };
        resolve({
          w: img.naturalWidth,
          h: img.naturalHeight,
          prevUrl: scale(1000, 0.74, true), // small WebP preview = fast pages
          fullUrl: scale(2600, 0.88), // buyer file stays JPEG
        });
      };
      img.onerror = reject;
      img.src = String(reader.result);
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

interface ContributorPageProps {
  tab: string;
  lang: LangCode;
  user: User | null;
  assets: Asset[];
  orders: Order[];
  payouts: Payout[];
  siteConfig: SiteConfig;
  money: (n: number) => string;
  onNavigate: (hash: string) => void;
  onOpenAuth: (m?: 'login' | 'register') => void;
  onRefresh: () => Promise<void>;
  onDeleteAsset: (id: string) => Promise<void>;
  toast: (m: string) => void;
}

export function ContributorPage({
  tab,
  lang,
  user,
  assets,
  orders,
  payouts,
  siteConfig,
  money,
  onNavigate,
  onOpenAuth,
  onRefresh,
  onDeleteAsset,
  toast,
}: ContributorPageProps) {
  const [upImg, setUpImg] = useState<{ w: number; h: number; prevUrl: string; fullUrl: string; name: string } | null>(null);
  const [title, setTitle] = useState('');
  const [desc, setDesc] = useState('');
  const [kw, setKw] = useState('');
  const [cat, setCat] = useState('Culture');
  const [lic, setLic] = useState<'rf' | 'editorial'>('rf');
  const [release, setRelease] = useState('none');
  const [relfile, setRelfile] = useState('');
  const [caption, setCaption] = useState('');
  const [evdate, setEvdate] = useState('');
  const [place, setPlace] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [fp, setFp] = useState<ImageFingerprint | null>(null);
  const [dup, setDup] = useState<DupState>({ state: 'idle' });
  const dupBlocked = dup.state === 'done' && dup.matches.some((m) => m.kind === 'exact');

  const [upi, setUpi] = useState(user?.payout?.upi || '');
  const [pan, setPan] = useState(user?.payout?.pan || '');

  if (!user || !['contributor', 'admin'].includes(user.role)) {
    return (
      <section className="wrap py-9">
        <div className="bg-gradient-to-b from-[#eef3fb] to-[#e9eff9] border border-[#d6deeb] rounded-2xl p-8 text-center">
          <h1 className="dm text-4xl text-[#011f43] m-0">Apni photos bechiye</h1>
          <p className="text-[#33405c] max-w-2xl mx-auto mt-2">
            Royalty-Free par {Math.round(siteConfig.pricing.royalty.rf * 100)}% aur Editorial par{' '}
            {Math.round(siteConfig.pricing.royalty.editorial * 100)}% royalty. Minimum payout sirf{' '}
            {money(siteConfig.pricing.payoutMin)}!
          </p>
          {user ? (
            <button
              type="button"
              onClick={async () => {
                await api('/api/auth/profile', { method: 'PUT', body: JSON.stringify({ role: 'contributor' }) });
                await onRefresh();
                toast('Contributor account activated!');
              }}
              className="mt-4 px-5 py-2.5 rounded-lg bg-[#d6262f] text-white font-bold cursor-pointer"
            >
              Contributor account chalu karein
            </button>
          ) : (
            <button
              type="button"
              onClick={() => onOpenAuth('register')}
              className="mt-4 px-5 py-2.5 rounded-lg bg-[#d6262f] text-white font-bold cursor-pointer"
            >
              Join as contributor (Real Email)
            </button>
          )}
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mt-6">
          {[
            ['1. Upload', 'JPG/PNG, clean high-resolution photos.'],
            ['2. License chuniye', 'RF (release ke saath) ya Editorial (caption, date, jagah).'],
            ['3. Review', 'Hamari team 48 ghante me approve karti hai.'],
            ['4. Kamaiye', `Har sale par royalty, sirf ${money(siteConfig.pricing.payoutMin)} par UPI payout.`],
          ].map(([h, p]) => (
            <div key={h} className="bg-white border border-[#d9dbe1] rounded-xl p-5">
              <h3 className="m-0 text-base font-bold text-[#011f43]">{h}</h3>
              <p className="text-sm text-[#5c6170] mt-1.5 mb-0">{p}</p>
            </div>
          ))}
        </div>
      </section>
    );
  }

  const mine = assets.filter((a) => a.owner === user.email);
  const sales = orders.filter((o) => !o.status || o.status === 'paid').flatMap((o) => o.items.filter((i) => i.owner === user.email).map((i) => ({ ...i, date: o.date, oid: o.id })));
  const earned = sales.reduce((n, s) => n + s.royalty, 0);
  const paid = payouts.filter((p) => p.user === user.email).reduce((n, p) => n + p.amt, 0);
  const bal = earned - paid;
  const allCats = Array.from(new Set([...CATEGORY_OPTIONS, ...assets.map((a) => a.cat), ...siteConfig.settings.customCategories]));
  const titleOpts = Array.from(new Set([...TITLE_OPTIONS, ...assets.map((a) => (a.title || '').replace(/\s*#\d+$/, '').trim())])).filter(Boolean);

  async function handleUpload(e: React.FormEvent) {
    e.preventDefault();
    if (!upImg) return toast('Pehle photo chuniye');
    const kwList = kw.split(',').map((s) => s.trim().toLowerCase()).filter(Boolean);
    if (kwList.length < 5) return toast('Kam se kam 5 keywords likhein');
    if (dupBlocked) return toast('Ye photo pehle se SantalStock par hai');
    setSubmitting(true);
    try {
      const res = await api<{ asset?: Asset }>('/api/assets', {
        method: 'POST',
        body: JSON.stringify({
          title,
          desc,
          kw: kwList,
          cat,
          lic,
          release,
          relfile,
          caption,
          evdate,
          place,
          w: upImg.w,
          h: upImg.h,
          prevUrl: upImg.prevUrl,
          fullUrl: upImg.fullUrl,
          ...(fp || {}),
        }),
      });
      await onRefresh();
      setUpImg(null);
      setFp(null);
      setDup({ state: 'idle' });
      setTitle('');
      setDesc('');
      setKw('');
      toast(user?.role === 'admin' ? `Photo published ✓ ${webResultText(res.asset?.web)}` : 'Review ke liye bheja ✓');
      onNavigate('#/contributor/portfolio');
    } catch (err) {
      toast((err as Error).message);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <section className="wrap py-9">
      <h1 className="dm text-4xl text-[#011f43] m-0 mb-4">Contributor</h1>
      <div className="flex gap-1.5 border-b border-[#d9dbe1] mb-5 flex-wrap">
        {[
          ['dashboard', tr(lang, 'dashboard')],
          ['upload', tr(lang, 'upload')],
          ['portfolio', tr(lang, 'portfolio')],
          ['earnings', tr(lang, 'earnings')],
        ].map(([k, l]) => (
          <a
            key={k}
            href={`#/contributor/${k}`}
            onClick={(e) => { e.preventDefault(); onNavigate(`#/contributor/${k}`); }}
            className={`px-3.5 py-2.5 no-underline text-sm border-b-[3px] ${
              tab === k ? 'text-[#011f43] border-[#d6262f] font-bold' : 'text-[#5c6170] border-transparent'
            }`}
          >
            {l}
          </a>
        ))}
      </div>

      {tab === 'dashboard' && (
        <>
          <div className="grid grid-cols-2 sm:grid-cols-5 gap-3.5">
            <div className="bg-white border border-[#d9dbe1] rounded-xl p-4 text-sm text-[#5c6170]">Photos live<b className="block text-2xl text-[#011f43] tabular-nums">{mine.filter((a) => a.status === 'approved').length}</b></div>
            <div className="bg-white border border-[#d9dbe1] rounded-xl p-4 text-sm text-[#5c6170]">Pending review<b className="block text-2xl text-[#011f43] tabular-nums">{mine.filter((a) => a.status === 'pending').length}</b></div>
            <div className="bg-white border border-[#d9dbe1] rounded-xl p-4 text-sm text-[#5c6170]">Downloads<b className="block text-2xl text-[#011f43] tabular-nums">{sales.length}</b></div>
            <div className="bg-white border border-[#d9dbe1] rounded-xl p-4 text-sm text-[#5c6170]">Earnings<b className="block text-2xl text-[#011f43] tabular-nums">{money(earned)}</b></div>
            <div className="bg-white border border-[#d9dbe1] rounded-xl p-4 text-sm text-[#5c6170]">Balance<b className="block text-2xl text-[#011f43] tabular-nums">{money(bal)}</b></div>
          </div>
          <p className="mt-5">
            <button
              type="button"
              onClick={() => onNavigate('#/contributor/upload')}
              className="px-4 py-2.5 rounded-lg bg-[#d6262f] text-white font-semibold cursor-pointer"
            >
              + Nayi photo upload
            </button>
          </p>
        </>
      )}

      {tab === 'upload' && (
        <form onSubmit={handleUpload} className="grid grid-cols-1 lg:grid-cols-[1.5fr_1fr] gap-6">
          <div className="space-y-3">
            <label className="block border-2 border-dashed border-[#c5cfe0] rounded-xl p-7 text-center bg-white cursor-pointer hover:border-[#011f43]">
              <input
                type="file"
                accept="image/*"
                hidden
                onChange={async (e) => {
                  const f = e.target.files?.[0];
                  if (!f) return;
                  setDup({ state: 'checking' });
                  setFp(null);
                  const [res, print] = await Promise.all([readImageForUpload(f), fingerprintFile(f).catch(() => null)]);
                  setUpImg({ ...res, name: f.name });
                  setFp(print);
                  if (!print) return setDup({ state: 'error' });
                  try {
                    const r = await api<{ matches: DupMatch[] }>('/api/assets/check-duplicate', { method: 'POST', body: JSON.stringify(print) });
                    setDup({ state: 'done', matches: r.matches || [] });
                  } catch {
                    setDup({ state: 'error' });
                  }
                }}
              />
              {upImg ? (
                <div>
                  <img src={upImg.prevUrl} alt="Preview" className="max-h-60 mx-auto rounded-lg" />
                  <p className="text-xs text-[#5c6170] mt-2 mb-0">{upImg.w}×{upImg.h}px · {upImg.name}</p>
                </div>
              ) : (
                <div>
                  <Upload className="w-8 h-8 mx-auto text-[#011f43] mb-2" />
                  <b className="block text-[#011f43]">Photo yahan click karke chuniye</b>
                  <p className="text-xs text-[#5c6170] mt-1 mb-0">JPG/PNG/WebP · kam se kam 1600px behtar</p>
                </div>
              )}
            </label>
            <UploadDupStatus dup={dup} />

            <div>
              <label className="block text-sm font-semibold mb-1">Image Title</label>
              <ComboBox required maxLength={90} value={title} onChange={setTitle} options={titleOpts} placeholder="Photo title (list se chuniye ya likhiye)" />
              <p className="text-[11px] text-[#5c6170] mt-1 mb-0">Save par title ke saath serial apne aap judega, jaise {title.trim() || 'Santal Huru Get'}#01. Photo ID SSP se banegi.</p>
            </div>
            <div>
              <label className="block text-sm font-semibold mb-1">Image Description</label>
              <textarea rows={3} value={desc} onChange={(e) => setDesc(e.target.value)} placeholder="Detailed description..." className="w-full px-3 py-2 border border-[#d9dbe1] rounded-lg bg-white text-sm" />
            </div>
            <div>
              <label className="block text-sm font-semibold mb-1">Keywords (comma se alag, kam se kam 5)</label>
              <input required value={kw} onChange={(e) => setKw(e.target.value)} placeholder="village, santal, festival, dance, drum" className="w-full px-3 py-2 border border-[#d9dbe1] rounded-lg bg-white text-sm" />
            </div>
            <div>
              <label className="block text-sm font-semibold mb-1">Category</label>
              <ComboBox required value={cat} onChange={setCat} options={allCats} placeholder="Category" />
            </div>
          </div>

          <div className="bg-white border border-[#d9dbe1] rounded-xl p-5 h-fit space-y-3">
            <b className="text-sm text-[#011f43]">License type</b>
            <label className={`flex gap-2.5 p-3 rounded-xl border cursor-pointer ${lic === 'rf' ? 'border-[#2f3f8f] bg-[#f8faff]' : 'border-[#d9dbe1]'}`}>
              <input type="radio" name="uplic" checked={lic === 'rf'} onChange={() => setLic('rf')} className="mt-1" />
              <span className="text-sm"><b>Royalty-Free</b><br /><span className="text-xs text-[#5c6170]">Commercial use. Release if recognizable person/property.</span></span>
            </label>
            <label className={`flex gap-2.5 p-3 rounded-xl border cursor-pointer ${lic === 'editorial' ? 'border-[#2f3f8f] bg-[#f8faff]' : 'border-[#d9dbe1]'}`}>
              <input type="radio" name="uplic" checked={lic === 'editorial'} onChange={() => setLic('editorial')} className="mt-1" />
              <span className="text-sm"><b>Editorial</b><br /><span className="text-xs text-[#5c6170]">News/documentary. Caption required.</span></span>
            </label>

            {lic === 'rf' ? (
              <div className="space-y-2.5">
                <div>
                  <label className="block text-xs font-bold mb-1">Release</label>
                  <select value={release} onChange={(e) => setRelease(e.target.value)} className="w-full px-3 py-2 border border-[#d9dbe1] rounded-lg text-sm bg-white">
                    <option value="none">No recognizable person or private property</option>
                    <option value="model">Model release on file</option>
                    <option value="property">Property release on file</option>
                    <option value="both">Model + property release on file</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-bold mb-1">Release document (PDF/JPG)</label>
                  <input type="file" accept=".pdf,image/*" onChange={(e) => setRelfile(e.target.files?.[0]?.name || '')} className="w-full text-xs" />
                </div>
              </div>
            ) : (
              <div className="space-y-2.5">
                <div>
                  <label className="block text-xs font-bold mb-1">Caption (who, what, where, when)</label>
                  <textarea required rows={3} value={caption} onChange={(e) => setCaption(e.target.value)} className="w-full px-3 py-2 border border-[#d9dbe1] rounded-lg text-sm" />
                </div>
                <div className="grid grid-cols-2 gap-2.5">
                  <div>
                    <label className="block text-xs font-bold mb-1">Event date</label>
                    <input type="date" value={evdate} onChange={(e) => setEvdate(e.target.value)} className="w-full px-2.5 py-2 border border-[#d9dbe1] rounded-lg text-sm" />
                  </div>
                  <div>
                    <label className="block text-xs font-bold mb-1">Location</label>
                    <input value={place} onChange={(e) => setPlace(e.target.value)} placeholder="Godda, Jharkhand" className="w-full px-2.5 py-2 border border-[#d9dbe1] rounded-lg text-sm" />
                  </div>
                </div>
              </div>
            )}

            <label className="flex gap-2 items-start text-xs text-[#5c6170] pt-1">
              <input type="checkbox" required className="mt-0.5" />
              <span>Main pramanit karta/karti hoon ki ye photo meri hai aur jaankari sahi hai.</span>
            </label>
            <button
              type="submit"
              disabled={submitting || dupBlocked || dup.state === 'checking'}
              className="w-full py-2.5 rounded-lg bg-[#d6262f] text-white font-bold text-sm cursor-pointer disabled:opacity-50"
            >
              {submitting ? 'Uploading...' : user.role === 'admin' ? 'Add & Publish Photo' : 'Review ke liye bhejein'}
            </button>
          </div>
        </form>
      )}

      {tab === 'portfolio' && (
        mine.length ? (
          <div className="bg-white border border-[#d9dbe1] rounded-xl p-5 overflow-x-auto">
            <table className="w-full text-sm border-collapse">
              <thead>
                <tr className="border-b border-[#d9dbe1] text-left text-xs uppercase text-[#5c6170]">
                  <th className="py-2">Photo</th><th>License</th><th>Status</th><th>Sales</th><th />
                </tr>
              </thead>
              <tbody>
                {mine.map((a) => (
                  <tr key={a.id} className="border-b border-[#e5e8ef]">
                    <td className="py-2.5">
                      <div className="flex items-center gap-2.5">
                        <img src={thumbUrl(a, 200)} alt={a.title} className="w-20 h-14 object-cover rounded" />
                        <div>
                          <a href={`#/asset/${a.id}`} onClick={(e) => { e.preventDefault(); onNavigate(`#/asset/${a.id}`); }} className="font-bold text-[#011f43]">{a.title}</a>
                          <div className="text-xs text-[#5c6170]">{a.id} · {a.date}</div>
                        </div>
                      </div>
                    </td>
                    <td>{a.lic === 'editorial' ? 'Editorial' : 'Royalty-Free'}</td>
                    <td>
                      <span className={`px-2 py-0.5 rounded-full text-xs font-bold uppercase ${a.status === 'approved' ? 'bg-emerald-50 text-emerald-700' : a.status === 'pending' ? 'bg-amber-50 text-amber-700' : 'bg-red-50 text-red-700'}`}>
                        {a.status}
                      </span>
                      {a.reason && <div className="text-xs text-[#5c6170] mt-0.5">{a.reason}</div>}
                    </td>
                    <td className="tabular-nums">{sales.filter((s) => s.id === a.id).length}</td>
                    <td>
                      <button type="button" onClick={() => onDeleteAsset(a.id)} className="px-2.5 py-1 rounded border border-[#d9dbe1] text-xs font-semibold text-red-600 cursor-pointer">
                        Delete
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="text-center py-12 text-[#5c6170]">
            {tr(lang, 'empty')}{' '}
            <button type="button" onClick={() => onNavigate('#/contributor/upload')} className="text-[#2f3f8f] underline bg-transparent border-0 cursor-pointer">
              Upload karein
            </button>
          </div>
        )
      )}

      {tab === 'earnings' && (
        <div className="space-y-5">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5">
            <div className="bg-white border border-[#d9dbe1] rounded-xl p-4 text-sm text-[#5c6170]">Kul kamai<b className="block text-2xl text-[#011f43] tabular-nums">{money(earned)}</b></div>
            <div className="bg-white border border-[#d9dbe1] rounded-xl p-4 text-sm text-[#5c6170]">Paid out<b className="block text-2xl text-[#011f43] tabular-nums">{money(paid)}</b></div>
            <div className="bg-white border border-[#d9dbe1] rounded-xl p-4 text-sm text-[#5c6170]">Balance<b className="block text-2xl text-[#011f43] tabular-nums">{money(bal)}</b></div>
          </div>

          <form
            className="bg-white border border-[#d9dbe1] rounded-xl p-5 max-w-lg space-y-3"
            onSubmit={async (e) => {
              e.preventDefault();
              try {
                await api('/api/payouts', { method: 'POST', body: JSON.stringify({ upi, pan }) });
                await onRefresh();
                toast('Payout request sent ✓');
              } catch (err) {
                toast((err as Error).message);
              }
            }}
          >
            <b className="text-[#011f43]">Request UPI Payout</b>
            <div>
              <label className="block text-xs font-bold mb-1">UPI ID</label>
              <input required value={upi} onChange={(e) => setUpi(e.target.value)} placeholder="name@upi" className="w-full px-3 py-2 border border-[#d9dbe1] rounded-lg text-sm" />
            </div>
            <div>
              <label className="block text-xs font-bold mb-1">PAN (optional for small payouts)</label>
              <input value={pan} onChange={(e) => setPan(e.target.value.toUpperCase())} placeholder="ABCDE1234F" className="w-full px-3 py-2 border border-[#d9dbe1] rounded-lg text-sm" />
            </div>
            <button
              type="submit"
              disabled={bal < siteConfig.pricing.payoutMin}
              className="px-4 py-2 rounded-lg bg-[#011f43] text-white font-semibold text-sm disabled:opacity-50 cursor-pointer"
            >
              Request payout
            </button>
            <p className="text-xs text-[#5c6170] m-0">Minimum payout threshold: {money(siteConfig.pricing.payoutMin)}</p>
          </form>
        </div>
      )}
    </section>
  );
}

interface AdminDashboardProps {
  tab: string;
  user: User | null;
  assets: Asset[];
  orders: Order[];
  payouts: Payout[];
  users: User[];
  messages: import('../types').ContactMessage[];
  siteConfig: SiteConfig;
  money: (n: number) => string;
  adminMode: boolean;
  onToggleAdminMode: () => void;
  onAdminEdit: (target: AdminEditTarget) => void;
  onNavigate: (hash: string) => void;
  onOpenAuth: (m?: 'login' | 'register') => void;
  onRefresh: () => Promise<void>;
  onSaveConfig: (next: SiteConfig) => Promise<void>;
  onDeleteAsset: (id: string) => Promise<void>;
  toast: (m: string) => void;
}

export function AdminDashboard({
  tab,
  user,
  assets,
  orders,
  payouts,
  users,
  messages,
  siteConfig,
  money,
  adminMode,
  onToggleAdminMode,
  onAdminEdit,
  onNavigate,
  onOpenAuth,
  onRefresh,
  onSaveConfig,
  onDeleteAsset,
  toast,
}: AdminDashboardProps) {
  const [pq, setPq] = useState('');
  const [gstin, setGstin] = useState(siteConfig.settings.gstin || '');

  if (!user || user.role !== 'admin') {
    return (
      <section className="wrap py-16 text-center">
        <h2 className="dm text-3xl text-[#011f43]">Admin Access Required</h2>
        <p className="text-sm text-[#5c6170]">Please login with an Admin account.</p>
        {!user && (
          <button type="button" onClick={() => onOpenAuth('login')} className="mt-3 px-5 py-2.5 rounded-lg bg-[#011f43] text-white font-semibold cursor-pointer">
            Admin Login
          </button>
        )}
      </section>
    );
  }

  const pending = assets.filter((a) => a.status === 'pending');
  const paidOrders = orders.filter((o) => !o.status || o.status === 'paid');
  const rev = paidOrders.reduce((n, o) => n + (o.sub || 0), 0);
  const gstSum = paidOrders.reduce((n, o) => n + (o.gst || 0), 0);
  const roy = paidOrders.flatMap((o) => o.items).reduce((n, i) => n + i.royalty, 0);
  const filteredPhotos = pq.trim()
    ? assets.filter((a) => [a.title, a.id, a.contributor, a.cat].some((x) => x.toLowerCase().includes(pq.toLowerCase())))
    : assets;

  async function moderate(id: string, status: 'approved' | 'rejected' | 'editorial') {
    try {
      if (status === 'rejected') {
        const reason = window.prompt('Rejection reason (shown to contributor):', 'Low quality / missing release');
        if (reason === null) return;
        await api(`/api/assets/${id}`, { method: 'PUT', body: JSON.stringify({ status: 'rejected', reason }) });
      } else if (status === 'editorial') {
        await api(`/api/assets/${id}`, { method: 'PUT', body: JSON.stringify({ lic: 'editorial', status: 'approved', reason: 'Converted to Editorial' }) });
      } else {
        await api(`/api/assets/${id}`, { method: 'PUT', body: JSON.stringify({ status: 'approved', reason: '' }) });
      }
      await onRefresh();
      toast('Asset updated ✓');
    } catch (err) {
      toast((err as Error).message);
    }
  }

  function exportOrdersCsv() {
    const rows: (string | number | undefined)[][] = [
      ['order', 'date', 'email', 'name', 'gstin', 'state', 'asset', 'license', 'size', 'key', 'price', 'gst', 'total', 'pay'],
    ];
    orders.forEach((o) =>
      (o.items.length ? o.items : [{ id: o.desc, lic: '', size: '', key: '', price: o.sub }]).forEach((i) =>
        rows.push([o.id, o.date, o.user, o.bill.name, o.bill.gstin, o.bill.state, i.id, i.lic, i.size, i.key, i.price, o.gst, o.total, o.pay])
      )
    );
    const csv = rows.map((r) => r.map((c) => `"${String(c ?? '').replace(/"/g, '""')}"`).join(',')).join('\n');
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([csv], { type: 'text/csv' }));
    a.download = 'santalstock-orders.csv';
    a.click();
  }

  return (
    <section className="wrap py-9">
      <div className="flex items-center justify-between gap-4 flex-wrap mb-4">
        <h1 className="dm text-4xl text-[#011f43] m-0">Admin Panel</h1>
        <div className="flex items-center gap-2.5 flex-wrap">
          <button
            type="button"
            onClick={onToggleAdminMode}
            className={`px-4 py-2 rounded-lg text-sm font-bold cursor-pointer ${
              adminMode ? 'bg-[#d6262f] text-white' : 'bg-[#011f43] text-white'
            }`}
          >
            {adminMode ? 'Visual Admin Mode: ON (Click any page element)' : 'Turn ON Live Visual Admin Mode'}
          </button>
          <button
            type="button"
            onClick={() => onAdminEdit({ section: 'heroTitle' })}
            className="px-3.5 py-2 rounded-lg border border-[#d9dbe1] bg-white text-[#011f43] text-sm font-semibold cursor-pointer"
          >
            Edit Brand Colors
          </button>
          <button
            type="button"
            onClick={() => onAdminEdit({ section: 'pricingMatrix' })}
            className="px-3.5 py-2 rounded-lg border border-[#d9dbe1] bg-white text-[#011f43] text-sm font-semibold cursor-pointer"
          >
            Edit Prices
          </button>
          <button
            type="button"
            onClick={() => onNavigate('#/admin/github')}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-[#0f766e] text-white text-sm font-bold cursor-pointer"
          >
            <GitBranch className="w-4 h-4" /> GitHub + Source ZIP
          </button>
        </div>
      </div>

      <div className="flex gap-1.5 border-b border-[#d9dbe1] mb-5 flex-wrap">
        {[
          ['review', `Review queue (${pending.length})`],
          ['photos', `Photos (${assets.length})`],
          ['orders', `Orders (${orders.length})${orders.some((o) => o.status === 'pending') ? ` · ${orders.filter((o) => o.status === 'pending').length} pending` : ''}`],
          ['payouts', `Payouts (${payouts.length})`],
          ['users', `Users (${users.length})`],
          ['messages', `Messages & Feedback (${messages.length})`],
          ['github', 'GitHub + Source ZIP'],
          ['settings', 'Settings & CMS'],
        ].map(([k, l]) => (
          <a
            key={k}
            href={`#/admin/${k}`}
            onClick={(e) => { e.preventDefault(); onNavigate(`#/admin/${k}`); }}
            className={`px-3.5 py-2.5 no-underline text-sm border-b-[3px] ${
              tab === k ? 'text-[#011f43] border-[#d6262f] font-bold' : 'text-[#5c6170] border-transparent'
            }`}
          >
            {l}
          </a>
        ))}
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-5 gap-3.5 mb-5">
        <div className="bg-white border border-[#d9dbe1] rounded-xl p-4 text-sm text-[#5c6170]">Revenue (ex-GST)<b className="block text-2xl text-[#011f43] tabular-nums">{money(rev)}</b></div>
        <div className="bg-white border border-[#d9dbe1] rounded-xl p-4 text-sm text-[#5c6170]">GST collected<b className="block text-2xl text-[#011f43] tabular-nums">{money(gstSum)}</b></div>
        <div className="bg-white border border-[#d9dbe1] rounded-xl p-4 text-sm text-[#5c6170]">Royalty owed<b className="block text-2xl text-[#011f43] tabular-nums">{money(roy)}</b></div>
        <div className="bg-white border border-[#d9dbe1] rounded-xl p-4 text-sm text-[#5c6170]">Assets live<b className="block text-2xl text-[#011f43] tabular-nums">{assets.filter((a) => a.status === 'approved').length}</b></div>
        <div className="bg-white border border-[#d9dbe1] rounded-xl p-4 text-sm text-[#5c6170]">Users<b className="block text-2xl text-[#011f43] tabular-nums">{users.length}</b></div>
      </div>

      {tab === 'review' && (
        pending.length ? (
          <div className="space-y-4">
            {pending.map((a) => (
              <div key={a.id} className="bg-white border border-[#d9dbe1] rounded-xl p-5 grid grid-cols-1 md:grid-cols-[260px_1fr] gap-5">
                <img src={thumbUrl(a, 500)} alt={a.title} className="rounded-lg w-full object-cover" />
                <div>
                  <h3 className="m-0 text-lg font-bold text-[#011f43]">{a.title}</h3>
                  <p className="text-xs text-[#5c6170] mt-1">{a.id} · {a.w}×{a.h}px · by {a.contributor} ({a.owner})</p>
                  {a.desc && <p className="text-sm mt-2">{a.desc}</p>}
                  <p className="text-xs text-[#5c6170]">
                    <b>Category:</b> {a.cat} · <b>Keywords:</b> {(a.kw || []).join(', ')}
                  </p>
                  <AdminDupPanel asset={a} assets={assets} onRefresh={onRefresh} toast={toast} />
                  <div className="flex flex-wrap gap-2 mt-3">
                    <button type="button" onClick={() => moderate(a.id, 'approved')} className="px-3.5 py-1.5 rounded-lg bg-[#17803d] text-white text-xs font-bold cursor-pointer">✓ Approve</button>
                    <button type="button" onClick={() => onAdminEdit({ section: 'editPhoto', itemId: a.id })} className="px-3.5 py-1.5 rounded-lg border border-[#d9dbe1] bg-white text-[#011f43] text-xs font-bold cursor-pointer">✎ Edit</button>
                    <button type="button" onClick={() => moderate(a.id, 'editorial')} className="px-3.5 py-1.5 rounded-lg border border-[#d9dbe1] bg-white text-[#011f43] text-xs font-bold cursor-pointer">Editorial & Approve</button>
                    <button type="button" onClick={() => moderate(a.id, 'rejected')} className="px-3.5 py-1.5 rounded-lg bg-[#d6262f] text-white text-xs font-bold cursor-pointer">✕ Reject</button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="text-center py-12 bg-white border border-[#d9dbe1] rounded-xl text-[#5c6170]">Review queue is empty.</div>
        )
      )}

      {tab === 'photos' && (
        <div>
          <div className="flex items-center justify-between gap-3 flex-wrap mb-3.5">
            <button
              type="button"
              onClick={() => onAdminEdit({ section: 'addPhoto' })}
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-[#d6262f] text-white text-sm font-bold cursor-pointer"
            >
              <Plus className="w-4 h-4" /> Add New Photo
            </button>
            <input
              value={pq}
              onChange={(e) => setPq(e.target.value)}
              placeholder="Filter by title, ID, contributor..."
              className="px-3 py-2 border border-[#d9dbe1] rounded-lg bg-white text-sm w-full sm:w-72"
            />
          </div>
          <div className="bg-white border border-[#d9dbe1] rounded-xl p-4 overflow-x-auto">
            <table className="w-full text-sm border-collapse">
              <thead>
                <tr className="border-b border-[#d9dbe1] text-left text-xs uppercase text-[#5c6170]">
                  <th className="py-2">Photo</th><th>Title</th><th>Contributor</th><th>Category / Lic</th><th>Status</th><th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredPhotos.map((a) => (
                  <tr key={a.id} className="border-b border-[#e5e8ef]">
                    <td className="py-2">
                      <div className="flex items-center gap-2">
                        <img src={thumbUrl(a, 180)} alt={a.title} className="w-16 h-11 object-cover rounded" />
                        <code className="text-xs">{a.id}</code>
                      </div>
                    </td>
                    <td>
                      <a href={`#/asset/${a.id}`} onClick={(e) => { e.preventDefault(); onNavigate(`#/asset/${a.id}`); }} className="font-bold text-[#011f43]">{a.title}</a>
                    </td>
                    <td className="text-xs"><b>{a.contributor}</b><br /><span className="text-[#5c6170]">{a.owner}</span></td>
                    <td className="text-xs">{a.cat}<br />{a.lic === 'editorial' ? 'Editorial' : 'RF'}</td>
                    <td><span className="text-xs font-bold uppercase text-emerald-700">{a.status}</span></td>
                    <td>
                      <div className="flex gap-1.5">
                        <button type="button" onClick={() => onAdminEdit({ section: 'editPhoto', itemId: a.id })} className="px-2.5 py-1 rounded border border-[#d9dbe1] text-xs font-semibold inline-flex items-center gap-1 cursor-pointer">
                          <Pencil className="w-3 h-3" /> Edit
                        </button>
                        <button type="button" onClick={() => onDeleteAsset(a.id)} className="px-2.5 py-1 rounded bg-[#d6262f] text-white text-xs font-semibold inline-flex items-center gap-1 cursor-pointer">
                          <Trash2 className="w-3 h-3" /> Del
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {tab === 'orders' && (
        <div className="bg-white border border-[#d9dbe1] rounded-xl p-5 overflow-x-auto">
          <table className="w-full text-sm border-collapse">
            <thead>
              <tr className="border-b border-[#d9dbe1] text-left text-xs uppercase text-[#5c6170]">
                <th className="py-2">Order</th><th>Date</th><th>Customer</th><th>Items</th><th>Pay / UTR</th><th>Total</th><th>Status</th>
              </tr>
            </thead>
            <tbody>
              {orders.map((o) => (
                <tr key={o.id} className="border-b border-[#e5e8ef]">
                  <td className="py-2"><a href={`#/order/${o.id}`} onClick={(e) => { e.preventDefault(); onNavigate(`#/order/${o.id}`); }} className="font-semibold text-[#2f3f8f]">{o.id}</a></td>
                  <td>{new Date(o.date).toLocaleDateString('en-IN')}</td>
                  <td>{o.bill.name}<br /><span className="text-xs text-[#5c6170]">{o.user}</span></td>
                  <td>{o.items.length || o.desc}</td>
                  <td className="text-xs"><b className="uppercase">{o.pay}</b>{o.utr && <><br /><code className="bg-[#f3f4f8] px-1.5 py-0.5 rounded">{o.utr}</code></>}</td>
                  <td className="tabular-nums font-bold">{o.credits ? `${o.credits} cr` : money(o.total)}</td>
                  <td>
                    {o.status === 'pending' ? (
                      <div className="flex gap-1.5">
                        {(['approve', 'reject'] as const).map((act) => (
                          <button
                            key={act}
                            type="button"
                            onClick={async () => {
                              if (act === 'reject' && !window.confirm(`Reject ${o.id}? UTR ${o.utr || ''}`)) return;
                              try {
                                await api(`/api/orders/${encodeURIComponent(o.id)}/${act}`, { method: 'POST' });
                                await onRefresh();
                                toast(act === 'approve' ? `${o.id} approved ✓` : `${o.id} rejected`);
                              } catch (err) {
                                toast((err as Error).message);
                              }
                            }}
                            className={`px-2.5 py-1 rounded text-xs font-bold cursor-pointer ${act === 'approve' ? 'bg-[#1b8a4b] text-white' : 'border border-[#e3b4b4] text-[#b42318] bg-white'}`}
                          >
                            {act === 'approve' ? 'Approve' : 'Reject'}
                          </button>
                        ))}
                      </div>
                    ) : (
                      <span className={`text-xs font-bold uppercase ${o.status === 'rejected' ? 'text-[#b42318]' : 'text-[#1b8a4b]'}`}>{o.status || 'paid'}</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <button type="button" onClick={exportOrdersCsv} className="mt-4 inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg border border-[#d9dbe1] text-xs font-bold cursor-pointer">
            <Download className="w-3.5 h-3.5" /> Export Orders CSV
          </button>
        </div>
      )}

      {tab === 'payouts' && (
        payouts.length ? (
          <div className="bg-white border border-[#d9dbe1] rounded-xl p-5 overflow-x-auto">
            <table className="w-full text-sm border-collapse">
              <thead>
                <tr className="border-b border-[#d9dbe1] text-left text-xs uppercase text-[#5c6170]">
                  <th className="py-2">ID</th><th>Contributor</th><th>UPI</th><th>Amount</th><th>Status</th><th />
                </tr>
              </thead>
              <tbody>
                {payouts.map((p) => (
                  <tr key={p.id} className="border-b border-[#e5e8ef]">
                    <td className="py-2">{p.id}</td>
                    <td>{p.user}</td>
                    <td>{p.upi}</td>
                    <td className="tabular-nums font-bold">{money(p.amt)}</td>
                    <td className="uppercase text-xs font-bold">{p.status}</td>
                    <td>
                      {p.status !== 'paid' && (
                        <button
                          type="button"
                          onClick={async () => {
                            await api(`/api/payouts/${p.id}/pay`, { method: 'PUT' });
                            await onRefresh();
                            toast('Marked paid ✓');
                          }}
                          className="px-3 py-1 rounded bg-[#17803d] text-white text-xs font-bold cursor-pointer"
                        >
                          Mark paid
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="text-center py-12 bg-white border border-[#d9dbe1] rounded-xl text-[#5c6170]">No payout requests yet.</div>
        )
      )}

      {tab === 'users' && (
        <div className="bg-white border border-[#d9dbe1] rounded-xl p-5 overflow-x-auto">
          <table className="w-full text-sm border-collapse">
            <thead>
              <tr className="border-b border-[#d9dbe1] text-left text-xs uppercase text-[#5c6170]">
                <th className="py-2">Name</th><th>Email</th><th>Verified</th><th>Role</th><th>Credits</th><th>Joined</th>
              </tr>
            </thead>
            <tbody>
              {users.map((u) => (
                <tr key={u.email} className="border-b border-[#e5e8ef]">
                  <td className="py-2 font-semibold">{u.name}</td>
                  <td>{u.email}</td>
                  <td>{u.emailVerified ? <span className="text-emerald-700 font-bold text-xs">✓ Verified</span> : <span className="text-amber-700 text-xs">Pending</span>}</td>
                  <td>
                    <select
                      value={u.role}
                      onChange={async (e) => {
                        await api(`/api/users/${encodeURIComponent(u.email)}/role`, {
                          method: 'PUT',
                          body: JSON.stringify({ role: e.target.value }),
                        });
                        await onRefresh();
                        toast('User role updated');
                      }}
                      className="px-2 py-1 border border-[#d9dbe1] rounded text-xs bg-white"
                    >
                      <option value="buyer">buyer</option>
                      <option value="contributor">contributor</option>
                      <option value="admin">admin</option>
                    </select>
                  </td>
                  <td className="tabular-nums">{u.credits || 0}</td>
                  <td className="text-xs text-[#5c6170]">{(u.joined || '').slice(0, 10)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {tab === 'messages' && (
        messages.length ? (
          <div className="space-y-3">
            {messages.map((m) => (
              <div key={m.id} className="bg-white border border-[#d9dbe1] rounded-xl p-4">
                <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-[#5c6170]">
                  <span className="flex flex-wrap items-center gap-2">
                    {m.kind && <span className="px-2 py-0.5 rounded-full bg-[#e8f0ff] text-[#174ea6] font-bold">{m.kind}</span>}
                    <b className="text-[#011f43]">{m.name}</b>
                    <a href={`mailto:${m.email}`} className="text-[#1f6fd1]">{m.email}</a>
                    {m.mobile && <a href={`tel:+91${m.mobile}`} className="text-[#1b8a4b]">+91 {m.mobile}</a>}
                    {m.rating ? <span className="text-[#f5b301]" aria-label={`${m.rating} stars`}>{'★'.repeat(m.rating)}<span className="text-[#c9d1de]">{'★'.repeat(5 - m.rating)}</span></span> : null}
                  </span>
                  <span className="font-mono">{m.id} · {new Date(m.date).toLocaleString('en-IN')}</span>
                </div>
                <p className="text-sm mt-2 mb-0 whitespace-pre-wrap">{m.message}</p>
                {m.page && <div className="text-[11px] text-[#8a93a6] mt-1">Page: {m.page}</div>}
              </div>
            ))}
          </div>
        ) : (
          <div className="text-center py-12 bg-white border border-[#d9dbe1] rounded-xl text-[#5c6170]">No contact messages yet.</div>
        )
      )}

      {tab === 'github' && (
        <GitHubSourcePanel siteConfig={siteConfig} assets={assets} money={money} toast={toast} />
      )}

      {tab === 'settings' && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
          <div className="bg-white border border-[#d9dbe1] rounded-xl p-5 space-y-4">
            <h3 className="m-0 text-lg font-bold text-[#011f43]">Visual CMS Quick Jump</h3>
            <div className="grid grid-cols-2 gap-2.5">
              {[
                ['brandLogo', 'Brand Logo Colors'],
                ['heroTitle', 'SSP / Hero Colors'],
                ['searchBar', 'Search Button Color'],
                ['subnav', 'Navigation Links'],
                ['featureCards', 'Feature Cards'],
                ['customSections', 'Custom Sections'],
                ['pricingMatrix', 'Minimum Prices & GST'],
                ['plans', 'Subscription Plans'],
                ['packs', 'Credit Packs'],
                ['faqs', 'FAQ Items'],
                ['pageAbout', 'About Us Text'],
                ['footer', 'Footer & Contact'],
              ].map(([sec, lbl]) => (
                <button
                  key={sec}
                  type="button"
                  onClick={() => onAdminEdit({ section: sec as AdminEditTarget['section'] })}
                  className="px-3 py-2 rounded-lg border border-[#dbe3ef] bg-[#f8faff] text-[#011f43] text-xs font-bold hover:border-[#d6262f] text-left cursor-pointer"
                >
                  ✎ {lbl}
                </button>
              ))}
            </div>
          </div>

          <div className="space-y-4">
            <form
              className="bg-white border border-[#d9dbe1] rounded-xl p-5 space-y-3"
              onSubmit={async (e) => {
                e.preventDefault();
                await onSaveConfig({ ...siteConfig, settings: { ...siteConfig.settings, gstin } });
              }}
            >
              <b className="text-[#011f43]">Business GSTIN (on Invoices)</b>
              <input value={gstin} onChange={(e) => setGstin(e.target.value)} className="w-full px-3 py-2 border border-[#d9dbe1] rounded-lg text-sm" />
              <button type="submit" className="px-4 py-2 rounded-lg bg-[#011f43] text-white text-sm font-bold cursor-pointer">Save GSTIN</button>
            </form>

            <div className="bg-white border border-[#d9dbe1] rounded-xl p-5 space-y-3">
              <b className="text-[#011f43]">CMS Backup & Reset</b>
              <div className="flex gap-2.5 flex-wrap">
                <button
                  type="button"
                  onClick={async () => {
                    const data = await api('/api/admin/export');
                    const a = document.createElement('a');
                    a.href = URL.createObjectURL(new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' }));
                    a.download = 'santalstock-backup.json';
                    a.click();
                  }}
                  className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg border border-[#d9dbe1] text-xs font-bold cursor-pointer"
                >
                  <Download className="w-3.5 h-3.5" /> Export JSON Backup
                </button>
                <button
                  type="button"
                  onClick={async () => {
                    if (!window.confirm('Reset all visual colors, pricing, and CMS edits to default?')) return;
                    await api('/api/cms/reset', { method: 'POST' });
                    await onRefresh();
                    toast('CMS reset to defaults');
                  }}
                  className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-[#d6262f] text-white text-xs font-bold cursor-pointer"
                >
                  <RotateCcw className="w-3.5 h-3.5" /> Reset CMS Defaults
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
