import React, { useEffect, useState } from 'react';
import ComboBox from '../components/ComboBox';
import { USE_OPTIONS } from '../data/pickLists';
import { Pencil, Trash2, Printer, Download } from 'lucide-react';
import { DEFAULT_SITE_CONFIG, fullAssetUrl, thumbUrl, tr } from '../data/defaults';
import { api } from '../lib/api';
import { PhotoTile } from '../components/PhotoTile';
import { UpiQr } from '../components/UpiQr';
import { DonateButton } from '../components/DonateModal';
import type { AdminEditTarget, Asset, CartItem, LangCode, LicenseOptionKey, Order, SiteConfig, SizeKey, User } from '../types';

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = src;
  });
}

function triggerDownload(href: string, filename: string) {
  const a = document.createElement('a');
  a.href = href;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
}

export async function downloadFullAsset(asset: Asset, sizeKey: SizeKey, siteConfig: SiteConfig, toast: (m: string) => void) {
  const S = siteConfig.pricing.sizes.find((s) => s.k === sizeKey) || siteConfig.pricing.sizes[1];
  const url = fullAssetUrl(asset, S.px ? Math.min(S.px, asset.w) : 0);
  toast('Download shuru...');
  try {
    if (url.startsWith('data:')) {
      const img = await loadImage(url);
      const w = S.px ? Math.min(S.px, img.naturalWidth) : img.naturalWidth;
      const c = document.createElement('canvas');
      c.width = w;
      c.height = Math.round((img.naturalHeight * w) / img.naturalWidth);
      c.getContext('2d')?.drawImage(img, 0, 0, c.width, c.height);
      triggerDownload(c.toDataURL('image/jpeg', 0.92), `SantalStock-${asset.id}-${sizeKey}.jpg`);
    } else {
      const res = await fetch(url, { credentials: 'include' });
      if (!res.ok) {
        const msg = ((await res.json().catch(() => ({}))) as { error?: string }).error;
        toast(msg || 'Download nahi ho saka. License kharidne ke baad try karein.');
        return;
      }
      const blob = await res.blob();
      triggerDownload(URL.createObjectURL(blob), `SantalStock-${asset.id}-${sizeKey}.jpg`);
    }
  } catch {
    toast('Direct download blocked by CORS; opening image in new view');
  }
}

/* ================= ASSET DETAIL ================= */
interface AssetDetailProps {
  asset: Asset | undefined;
  allAssets: Asset[];
  lang: LangCode;
  user: User | null;
  siteConfig: SiteConfig;
  dlCount: (a: Asset) => number;
  isFav: (id: string) => boolean;
  onToggleFav: (id: string) => void;
  onAddCart: (item: CartItem, buyNow?: boolean) => void;
  onSpeak: (text: string) => void;
  onNavigate: (hash: string) => void;
  adminMode: boolean;
  onAdminEdit: (target: AdminEditTarget) => void;
  onDeleteAsset: (id: string) => Promise<void>;
  money: (n: number) => string;
  toast: (m: string) => void;
}

export function AssetDetailPage({
  asset,
  allAssets,
  lang,
  user,
  siteConfig,
  dlCount,
  isFav,
  onToggleFav,
  onAddCart,
  onSpeak,
  onNavigate,
  adminMode,
  onAdminEdit,
  onDeleteAsset,
  money,
  toast,
}: AssetDetailProps) {
  const allowed: LicenseOptionKey[] = asset?.lic === 'editorial' ? ['ed'] : ['std', 'ext', 'ed'];
  const [lic, setLic] = useState<LicenseOptionKey>(allowed[0]);
  const [size, setSize] = useState<SizeKey>('M');
  const [zoom, setZoom] = useState(false);
  // SEO: page title, description and Google image data for each photo.
  useEffect(() => {
    if (!asset) return;
    const prevTitle = document.title;
    document.title = `${asset.title} | SantalStock`;
    let meta = document.querySelector('meta[name="description"]') as HTMLMetaElement | null;
    const prevDesc = meta?.content || '';
    if (!meta) {
      meta = document.createElement('meta');
      meta.name = 'description';
      document.head.appendChild(meta);
    }
    meta.content = (asset.desc || asset.caption || `${asset.title} - ${asset.cat} photo on SantalStock`).slice(0, 155);
    const ld = document.createElement('script');
    ld.type = 'application/ld+json';
    ld.id = 'ss-asset-ld';
    ld.text = JSON.stringify({
      '@context': 'https://schema.org',
      '@type': 'ImageObject',
      name: asset.title,
      description: asset.desc || asset.caption || asset.title,
      contentUrl: new URL(thumbUrl(asset, 800), window.location.origin).href,
      creator: { '@type': 'Person', name: asset.contributor },
      copyrightNotice: `© ${asset.contributor} / SantalStock`,
      creditText: 'SantalStock',
      license: `${window.location.origin}/#/licenses`,
      acquireLicensePage: `${window.location.origin}/#/asset/${asset.id}`,
    });
    document.getElementById('ss-asset-ld')?.remove();
    document.head.appendChild(ld);
    return () => {
      document.title = prevTitle;
      if (meta) meta.content = prevDesc;
      ld.remove();
    };
  }, [asset]);

  if (!asset) return <div className="wrap py-16 text-center text-[#5c6170]">Asset nahi mila.</div>;

  const activeLic = allowed.includes(lic) ? lic : allowed[0];
  const price = siteConfig.pricing.matrix[activeLic][size];
  const similar = allAssets
    .filter((x) => x.id !== asset.id && x.status === 'approved' && (x.cat === asset.cat || x.kw.some((k) => asset.kw.includes(k))))
    .slice(0, 8);

  async function compDl() {
    try {
      const img = await loadImage(thumbUrl(asset!, 800));
      const c = document.createElement('canvas');
      c.width = img.naturalWidth;
      c.height = img.naturalHeight;
      const x = c.getContext('2d')!;
      x.drawImage(img, 0, 0);
      x.font = `bold ${Math.round(c.width / 14)}px Arial`;
      x.fillStyle = 'rgba(255,255,255,.45)';
      x.textAlign = 'center';
      x.save();
      x.translate(c.width / 2, c.height / 2);
      x.rotate(-0.35);
      for (let y = -c.height; y < c.height; y += c.width / 6) {
        x.fillText('SantalStock · ' + asset!.id, 0, y);
      }
      x.restore();
      triggerDownload(c.toDataURL('image/jpeg', 0.8), `SantalStock-${asset!.id}-comp.jpg`);
    } catch {
      toast('Comp download nahi ho paya');
    }
  }

  const isAi = /\bai\b|ai generated|ai art/i.test(asset.cat) || asset.kw.some((k) => /^(ai|ai generated|ai art)$/i.test(k));
  const pageUrl = `${window.location.origin}/#/asset/${asset.id}`;
  const shareText = `${asset.title} | SantalStock`;
  async function share(kind: 'wa' | 'fb' | 'x' | 'copy' | 'native') {
    const u = encodeURIComponent(pageUrl);
    const t = encodeURIComponent(shareText);
    if (kind === 'native' && navigator.share) return navigator.share({ title: shareText, url: pageUrl }).catch(() => undefined);
    if (kind === 'copy') {
      await navigator.clipboard?.writeText(pageUrl);
      return toast('Link copy ho gaya');
    }
    const href = kind === 'wa' ? `https://wa.me/?text=${t}%20${u}` : kind === 'fb' ? `https://www.facebook.com/sharer/sharer.php?u=${u}` : `https://twitter.com/intent/tweet?text=${t}&url=${u}`;
    window.open(href, '_blank', 'noopener,noreferrer');
  }

  return (
    <>
      {zoom && (
        <div className="fixed inset-0 z-[150] bg-black/85 flex items-center justify-center p-3 cursor-zoom-out" onClick={() => setZoom(false)} onContextMenu={(e) => e.preventDefault()}>
          <img src={thumbUrl(asset, 1600)} alt={asset.title} draggable={false} className="max-w-full max-h-full object-contain rounded-lg" />
          <span className="absolute top-3 right-4 text-white text-sm font-semibold">✕ Band karein</span>
        </div>
      )}
      <section className="wrap py-8">
        <div className="flex items-center justify-between flex-wrap gap-2 mb-3">
          <p className="text-xs text-[#5c6170] m-0">
            <a href="#/search" onClick={(e) => { e.preventDefault(); onNavigate('#/search'); }} className="text-[#2f3f8f]">{tr(lang, 'browse')}</a> ›{' '}
            <a href={`#/search?cat=${encodeURIComponent(asset.cat)}`} onClick={(e) => { e.preventDefault(); onNavigate(`#/search?cat=${encodeURIComponent(asset.cat)}`); }} className="text-[#2f3f8f]">{asset.cat}</a> › {asset.id}
          </p>
          {adminMode && (
            <div className="flex gap-2">
              <button type="button" onClick={() => onAdminEdit({ section: 'editPhoto', itemId: asset.id })} className="px-3 py-1.5 rounded-lg bg-[#011f43] text-white text-xs font-bold inline-flex items-center gap-1 cursor-pointer">
                <Pencil className="w-3.5 h-3.5" /> Edit Photo
              </button>
              <button
                type="button"
                onClick={async () => {
                  await onDeleteAsset(asset.id);
                  onNavigate('#/search');
                }}
                className="px-3 py-1.5 rounded-lg bg-[#d6262f] text-white text-xs font-bold inline-flex items-center gap-1 cursor-pointer"
              >
                <Trash2 className="w-3.5 h-3.5" /> Delete Photo
              </button>
            </div>
          )}
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-[1.55fr_1fr] gap-7">
          <div>
            <div className="wm rounded-xl overflow-hidden bg-[#dde1ea]" onContextMenu={(e) => e.preventDefault()}>
              <img
                src={thumbUrl(asset, 1200)}
                alt={asset.title}
                draggable={false}
                referrerPolicy="no-referrer"
                onClick={() => setZoom(true)}
                title="Bada dekhein"
                className="w-full block cursor-zoom-in"
                style={{ aspectRatio: `${asset.w}/${asset.h}` }}
              />
            </div>
            <h1 className="dm text-3xl text-[#011f43] mt-4 mb-1">{asset.title}</h1>
            <div className="mt-2 rounded-xl border border-[#d9dbe1] bg-[#f8faff] p-3 text-sm text-[#5c6170]">
              <div className="flex items-center justify-between gap-2 flex-wrap">
                <span className={`px-2 py-0.5 rounded-full text-[11px] font-bold uppercase ${asset.lic === 'editorial' ? 'bg-[#f2e8fd] text-[#8a2be2]' : 'bg-[#e6f4ea] text-[#11602d]'}`}>
                  {asset.lic === 'editorial' ? tr(lang, 'ed') : tr(lang, 'rf')}
                </span>
                {isAi && <span className="px-2 py-0.5 rounded-full text-[11px] font-bold uppercase bg-[#ede9fe] text-[#6d28d9]">AI Generated</span>}
                <span className="flex-1" />
                <button
                  type="button"
                  onClick={() => onSpeak(`${asset.title}. ${tr(lang, 'by')} ${asset.contributor}. ${asset.desc || asset.caption || ''}`)}
                  className="px-2.5 py-1 rounded-md border border-[#d9dbe1] bg-white text-[#011f43] text-xs font-semibold cursor-pointer"
                >
                  🔊 {tr(lang, 'listen')}
                </button>
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mt-2.5">
                <div className="bg-white border border-[#e3e6ee] rounded-lg px-2.5 py-1.5"><div className="text-[10.5px] uppercase tracking-wide">{tr(lang, 'by')}</div><b className="text-[#111] text-[13px] break-words">{asset.contributor}</b></div>
                <div className="bg-white border border-[#e3e6ee] rounded-lg px-2.5 py-1.5"><div className="text-[10.5px] uppercase tracking-wide">ID</div><b className="text-[#111] text-[13px]">{asset.id}</b></div>
                <div className="bg-white border border-[#e3e6ee] rounded-lg px-2.5 py-1.5"><div className="text-[10.5px] uppercase tracking-wide">Size</div><b className="text-[#111] text-[13px]">{asset.w}×{asset.h}px</b></div>
                <div className="bg-white border border-[#e3e6ee] rounded-lg px-2.5 py-1.5"><div className="text-[10.5px] uppercase tracking-wide">{tr(lang, 'downloads')}</div><b className="text-[#111] text-[13px]">{dlCount(asset)}</b></div>
              </div>
            </div>
            <div className="mt-3 rounded-xl border border-[#d9dbe1] bg-white p-4">
              <div className="flex items-center justify-between gap-2 mb-1.5">
                <b className="text-sm text-[#011f43]">Description</b>
                {(asset.desc || asset.caption) && (
                  <button type="button" onClick={() => onSpeak(asset.desc || asset.caption || '')} className="px-2 py-0.5 rounded-md border border-[#d9dbe1] bg-white text-[#011f43] text-[11px] font-semibold cursor-pointer">🔊</button>
                )}
              </div>
              <p className="text-sm m-0 leading-relaxed text-[#2b3242] whitespace-pre-line">{asset.desc || asset.caption || 'Is photo ka vivaran jald joda jaayega.'}</p>
              <div className="flex flex-wrap gap-x-4 gap-y-1 mt-2.5 text-[11.5px] text-[#5c6170]">
                <span>📂 {asset.cat}</span>
                {asset.place && <span>📍 {asset.place}</span>}
                <span>📅 {asset.evdate || asset.date}</span>
                {isAi && <span className="text-[#6d28d9] font-semibold">🤖 AI Generated</span>}
              </div>
            </div>
            {asset.lic === 'editorial' ? (
              <div className="bg-[#f2e8fd] border border-[#dfc8fa] rounded-lg p-3.5 text-sm mt-3">
                <b>📰 {tr(lang, 'edonly')}.</b> {asset.caption}
                <div className="text-xs mt-1 text-[#4c247a]">{asset.place ? `📍 ${asset.place}` : ''} · 📅 {asset.evdate || asset.date}</div>
              </div>
            ) : (
              <div className="bg-[#e9f6ee] border border-[#c5e8d1] rounded-lg p-3.5 text-sm text-[#11602d] mt-3">
                ✓ Royalty-Free · {asset.release === 'none' ? 'Release ki zarurat nahi' : 'Model/property release on file'}
              </div>
            )}
            <div className="flex gap-2 flex-wrap mt-4">
              {asset.kw.map((k) => (
                <a
                  key={k}
                  href={`#/search?q=${encodeURIComponent(k)}`}
                  onClick={(e) => { e.preventDefault(); onNavigate(`#/search?q=${encodeURIComponent(k)}`); }}
                  className="bg-[#eef0f7] border border-[#dfe2ee] text-[#011f43] rounded-full px-3 py-1 text-xs font-semibold no-underline"
                >
                  {k}
                </a>
              ))}
            </div>
            <div className="mt-4 flex items-center gap-2 flex-wrap">
              <span className="text-xs font-bold text-[#011f43] mr-1">Share:</span>
              <button type="button" onClick={() => share('wa')} className="px-3 py-1.5 rounded-full bg-[#25d366] text-white text-xs font-bold border-0 cursor-pointer">WhatsApp</button>
              <button type="button" onClick={() => share('fb')} className="px-3 py-1.5 rounded-full bg-[#1877f2] text-white text-xs font-bold border-0 cursor-pointer">Facebook</button>
              <button type="button" onClick={() => share('x')} className="px-3 py-1.5 rounded-full bg-[#111] text-white text-xs font-bold border-0 cursor-pointer">X</button>
              <button type="button" onClick={() => share('copy')} className="px-3 py-1.5 rounded-full border border-[#d9dbe1] bg-white text-[#011f43] text-xs font-bold cursor-pointer">🔗 Copy link</button>
              <DonateButton className="ml-auto" label="Donate" />
            </div>
          </div>

          <div>
            <div className="bg-white border border-[#d9dbe1] rounded-xl p-5">
              <div className="flex items-center justify-between">
                <b className="text-sm text-[#011f43]">{tr(lang, 'lic')}</b>
                {adminMode && (
                  <button type="button" onClick={() => onAdminEdit({ section: 'pricingMatrix' })} className="text-xs font-bold text-[#d6262f] bg-transparent border-0 cursor-pointer">
                    ✎ Edit Prices
                  </button>
                )}
              </div>
              <div className="space-y-2 mt-2">
                {(['std', 'ext', 'ed'] as LicenseOptionKey[]).map((k) => {
                  const ok = allowed.includes(k);
                  const meta = siteConfig.pricing.licMeta[k];
                  return (
                    <label
                      key={k}
                      className={`flex gap-2.5 p-3 rounded-xl border cursor-pointer ${
                        activeLic === k ? 'border-[#2f3f8f] ring-2 ring-[#2f3f8f]/20 bg-[#f9fbff]' : 'border-[#d9dbe1]'
                      } ${!ok ? 'opacity-45 cursor-not-allowed' : ''}`}
                    >
                      <input type="radio" name="lic" disabled={!ok} checked={activeLic === k} onChange={() => setLic(k)} className="mt-1" />
                      <span className="text-sm">
                        <b>{meta.n}</b>
                        <br />
                        <span className="text-xs text-[#5c6170]">{meta.desc}{!ok ? ' (not available for editorial asset)' : ''}</span>
                      </span>
                    </label>
                  );
                })}
              </div>

              <b className="block text-sm text-[#011f43] mt-4 mb-2">{tr(lang, 'size')}</b>
              <div className="space-y-2">
                {siteConfig.pricing.sizes.map((s) => {
                  const w = s.px ? Math.min(s.px, asset.w) : asset.w;
                  const h = Math.round((asset.h * w) / (asset.w || 1));
                  return (
                    <label
                      key={s.k}
                      className={`flex items-center justify-between gap-2 p-2.5 rounded-xl border cursor-pointer ${
                        size === s.k ? 'border-[#2f3f8f] ring-2 ring-[#2f3f8f]/20 bg-[#f9fbff]' : 'border-[#d9dbe1]'
                      }`}
                    >
                      <span className="flex items-center gap-2 text-sm">
                        <input type="radio" name="size" checked={size === s.k} onChange={() => setSize(s.k)} />
                        <b>{s.n}</b>
                        <span className="text-xs text-[#5c6170]">{w}×{h}px</span>
                      </span>
                      <span className="font-bold text-sm text-[#011f43] tabular-nums">{money(siteConfig.pricing.matrix[activeLic][s.k])}</span>
                    </label>
                  );
                })}
              </div>

              <div className="flex items-center justify-between my-4">
                <span className="text-sm text-[#5c6170]">{tr(lang, 'price')}</span>
                <span className="text-3xl font-extrabold text-[#011f43] tabular-nums">{money(price)}</span>
              </div>

              <div className="flex gap-2.5">
                <button
                  type="button"
                  onClick={() => onAddCart({ id: asset.id, lic: activeLic, size, price }, false)}
                  className="flex-1 py-2.5 rounded-lg bg-[#011f43] text-white font-semibold text-sm cursor-pointer"
                >
                  {tr(lang, 'addcart')}
                </button>
                <button
                  type="button"
                  onClick={() => onAddCart({ id: asset.id, lic: activeLic, size, price }, true)}
                  className="flex-1 py-2.5 rounded-lg bg-[#d6262f] text-white font-semibold text-sm cursor-pointer"
                >
                  {tr(lang, 'buynow')}
                </button>
              </div>

              <div className="flex gap-2 mt-2.5">
                <button
                  type="button"
                  onClick={() => onToggleFav(asset.id)}
                  className="flex-1 py-2 rounded-lg border border-[#d9dbe1] bg-white text-[#011f43] text-xs font-semibold cursor-pointer"
                >
                  {isFav(asset.id) ? tr(lang, 'saved') : `♡ ${tr(lang, 'lightbox')}`}
                </button>
                <button
                  type="button"
                  onClick={compDl}
                  className="flex-1 py-2 rounded-lg border border-[#d9dbe1] bg-white text-[#011f43] text-xs font-semibold cursor-pointer"
                >
                  ⬇ {tr(lang, 'free')}
                </button>
              </div>

              {user && user.credits > 0 && (
                <p className="text-xs text-[#17803d] font-semibold mt-3 mb-0">
                  Ya {siteConfig.pricing.licMeta[activeLic].cr} credit se (aapke paas {user.credits} credits hain).
                </p>
              )}
            </div>
            <details className="mt-3 bg-[#f8faff] border border-[#d9dbe1] rounded-xl p-4 text-sm" open>
              <summary className="font-bold text-[#011f43] cursor-pointer">⬇ Download kaise hoga?</summary>
              <ol className="mt-2 mb-0 pl-5 space-y-1 text-[13px] text-[#33405c]">
                <li>License aur size chuniye, <b>Buy Now</b> dabaiye.</li>
                <li>Naam, email aur upyog bhariye, UPI QR se payment kariye.</li>
                <li>UPI app ka 12 ankon ka <b>UTR</b> number daal kar order bhejiye.</li>
                <li>Admin payment milte hi order <b>Paid</b> karega (aam taur par kuch ghante).</li>
                <li><b>My Account → Downloads</b> me ⬇ dabakar bina watermark ki photo aur License Certificate paiye.</li>
              </ol>
              <p className="text-[11.5px] text-[#5c6170] mt-2 mb-0">Sirf dekhne ya design try karne ke liye <b>Free preview</b> (watermark wali) turant download ho jaati hai.</p>
            </details>
          </div>
        </div>
      </section>

      {similar.length > 0 && (
        <section className="wrap py-6">
          <h2 className="dm text-3xl text-[#011f43] mb-4">{tr(lang, 'similar')}</h2>
          <div className="mason">
            {similar.map((a) => (
              <PhotoTile
                key={a.id}
                asset={a}
                lang={lang}
                isFav={isFav(a.id)}
                adminMode={adminMode}
                onToggleFav={onToggleFav}
                onOpenAsset={(id) => onNavigate(`#/asset/${id}`)}
                onAdminEdit={(id) => onAdminEdit({ section: 'editPhoto', itemId: id })}
                onAdminDelete={(id) => onDeleteAsset(id)}
              />
            ))}
          </div>
        </section>
      )}
    </>
  );
}

/* ================= CART & CHECKOUT ================= */
interface CartCheckoutProps {
  mode: 'cart' | 'checkout';
  planId?: string;
  packId?: string;
  lang: LangCode;
  user: User | null;
  cart: CartItem[];
  assets: Asset[];
  siteConfig: SiteConfig;
  money: (n: number) => string;
  onRemoveCart: (idx: number) => void;
  onClearCart: () => void;
  onNavigate: (hash: string) => void;
  onOpenAuth: (m?: 'login' | 'register') => void;
  onOrderSuccess: (order: Order) => Promise<void>;
  toast: (m: string) => void;
}

export function CartCheckoutPage({
  mode,
  planId,
  packId,
  lang,
  user,
  cart,
  assets,
  siteConfig,
  money,
  onRemoveCart,
  onClearCart,
  onNavigate,
  onOpenAuth,
  onOrderSuccess,
  toast,
}: CartCheckoutProps) {
  const [name, setName] = useState(user?.name || '');
  const [email, setEmail] = useState(user?.email || '');
  const [company, setCompany] = useState(user?.company || '');
  const [gstin, setGstin] = useState(user?.gstin || '');
  const [stateName, setStateName] = useState(user?.state || 'Jharkhand');
  const [pin, setPin] = useState(user?.pin || '');
  const [licensee, setLicensee] = useState(user?.company || user?.name || '');
  const [intendedUse, setIntendedUse] = useState('');
  const [pay, setPay] = useState<'credits' | 'upi'>('upi');
  const [utr, setUtr] = useState('');
  const [payRef] = useState(() => 'SS' + Date.now().toString(36).toUpperCase());
  const [processing, setProcessing] = useState(false);
  const payCfg = siteConfig.payment?.upiId ? siteConfig.payment : DEFAULT_SITE_CONFIG.payment!;

  const validCart = cart.filter((c) => assets.some((a) => a.id === c.id));
  const subCart = validCart.reduce((n, i) => n + i.price, 0);
  const gstCart = Math.round(subCart * siteConfig.pricing.gst);
  const crCart = validCart.reduce((n, i) => n + (siteConfig.pricing.licMeta[i.lic]?.cr || 1), 0);

  if (mode === 'cart') {
    if (!validCart.length) {
      return (
        <section className="wrap py-16 text-center text-[#5c6170]">
          <h2 className="dm text-3xl text-[#011f43]">{tr(lang, 'cart')}</h2>
          <p>{tr(lang, 'empty')}</p>
          <button type="button" onClick={() => onNavigate('#/search')} className="mt-3 px-5 py-2.5 rounded-lg bg-[#011f43] text-white font-semibold cursor-pointer">
            {tr(lang, 'browse')}
          </button>
        </section>
      );
    }
    return (
      <section className="wrap py-9">
        <h1 className="dm text-4xl text-[#011f43] mb-5">{tr(lang, 'cart')}</h1>
        <div className="grid grid-cols-1 lg:grid-cols-[1.6fr_1fr] gap-6">
          <div className="bg-white border border-[#d9dbe1] rounded-xl p-5 overflow-x-auto">
            <table className="w-full text-sm border-collapse">
              <thead>
                <tr className="border-b border-[#d9dbe1] text-left text-xs uppercase text-[#5c6170]">
                  <th className="py-2">Photo</th><th>{tr(lang, 'lic')}</th><th>Price</th><th />
                </tr>
              </thead>
              <tbody>
                {validCart.map((c, i) => {
                  const a = assets.find((x) => x.id === c.id)!;
                  return (
                    <tr key={`${c.id}-${c.lic}-${c.size}`} className="border-b border-[#e5e8ef]">
                      <td className="py-3">
                        <div className="flex items-center gap-2.5">
                          <img src={thumbUrl(a, 180)} alt={a.title} className="w-20 h-14 object-cover rounded" />
                          <div>
                            <a href={`#/asset/${a.id}`} onClick={(e) => { e.preventDefault(); onNavigate(`#/asset/${a.id}`); }} className="font-bold text-[#011f43]">{a.title}</a>
                            <div className="text-xs text-[#5c6170]">{a.id}</div>
                          </div>
                        </div>
                      </td>
                      <td>{siteConfig.pricing.licMeta[c.lic].n}<br /><span className="text-xs text-[#5c6170]">{siteConfig.pricing.sizes.find((s) => s.k === c.size)?.n}</span></td>
                      <td className="font-bold tabular-nums">{money(c.price)}</td>
                      <td>
                        <button type="button" onClick={() => onRemoveCart(i)} className="px-2 py-1 rounded border border-[#d9dbe1] text-xs cursor-pointer">✕</button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <div className="bg-white border border-[#d9dbe1] rounded-xl p-5 h-fit space-y-2.5">
            <div className="flex justify-between text-sm"><span>{tr(lang, 'subtotal')}</span><b className="tabular-nums">{money(subCart)}</b></div>
            <div className="flex justify-between text-sm"><span>GST {Math.round(siteConfig.pricing.gst * 100)}%</span><b className="tabular-nums">{money(gstCart)}</b></div>
            <hr className="border-[#e5e8ef]" />
            <div className="flex justify-between items-center"><span>{tr(lang, 'total')}</span><span className="text-2xl font-extrabold text-[#011f43] tabular-nums">{money(subCart + gstCart)}</span></div>
            <p className="text-xs text-[#5c6170]">Ya {crCart} credits</p>
            <button type="button" onClick={() => onNavigate('#/checkout')} className="w-full py-2.5 rounded-lg bg-[#d6262f] text-white font-bold cursor-pointer">
              {tr(lang, 'checkout')} →
            </button>
          </div>
        </div>
      </section>
    );
  }

  // CHECKOUT MODE
  if (!user) {
    return (
      <section className="wrap py-16 text-center">
        <h2 className="dm text-3xl text-[#011f43]">Login to Checkout</h2>
        <p className="text-sm text-[#5c6170]">Please login with your real email account to receive your license & GST invoice.</p>
        <button type="button" onClick={() => onOpenAuth('login')} className="mt-3 px-5 py-2.5 rounded-lg bg-[#011f43] text-white font-semibold cursor-pointer">
          Login / Sign up
        </button>
      </section>
    );
  }

  const planObj = planId ? siteConfig.pricing.plans.find((p) => p.id === planId) : undefined;
  const packObj = packId ? siteConfig.pricing.packs.find((p) => p.id === packId) || siteConfig.pricing.packs[Number(packId)] : undefined;
  const isCreditPurchase = Boolean(planObj || packObj);

  if (!isCreditPurchase && !validCart.length) {
    return (
      <section className="wrap py-16 text-center text-[#5c6170]">
        <p>Your cart is empty.</p>
        <button type="button" onClick={() => onNavigate('#/search')} className="px-4 py-2 rounded-lg bg-[#011f43] text-white font-semibold cursor-pointer">
          {tr(lang, 'browse')}
        </button>
      </section>
    );
  }

  const sub = planObj ? planObj.p : packObj ? packObj.p : subCart;
  const gst = Math.round(sub * siteConfig.pricing.gst);
  const total = sub + gst;
  const canCredits = !isCreditPurchase && (user.credits || 0) >= crCart;

  async function submitOrder(e: React.FormEvent) {
    e.preventDefault();
    if (pay === 'upi' && !/^\d{12}$/.test(utr.replace(/\s/g, ''))) {
      toast(tr(lang, 'utrLabel'));
      return;
    }
    setProcessing(true);
    try {
      const kind = planObj ? `plan:${planObj.id}` : packObj ? `pack:${packObj.id}` : 'cart';
      const res = await api<{ order: Order }>('/api/orders', {
        method: 'POST',
        body: JSON.stringify({
          kind,
          pay,
          bill: { name, email, company, gstin, state: stateName, pin },
          items: validCart,
          licensee: licensee || company || name,
          use: intendedUse,
          utr: pay === 'upi' ? utr.replace(/\s/g, '') : undefined,
          ref: payRef,
        }),
      });
      if (kind === 'cart') onClearCart();
      toast(res.order.status === 'pending' ? tr(lang, 'pendingMsg') : 'Payment safal ✓');
      await onOrderSuccess(res.order);
    } catch (err) {
      toast((err as Error).message);
    } finally {
      setProcessing(false);
    }
  }

  return (
    <section className="wrap py-9">
      <h1 className="dm text-4xl text-[#011f43] mb-5">{tr(lang, 'checkout')}</h1>
      <form onSubmit={submitOrder} className="grid grid-cols-1 lg:grid-cols-[1.5fr_1fr] gap-6">
        <div className="bg-white border border-[#d9dbe1] rounded-xl p-5 space-y-3">
          <h3 className="m-0 text-lg font-bold text-[#011f43]">{tr(lang, 'billing')}</h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div><label className="text-xs font-bold block mb-1">{tr(lang, 'fullname')}</label><input required value={name} onChange={(e) => setName(e.target.value)} className="w-full px-3 py-2 border border-[#d9dbe1] rounded-lg text-sm" /></div>
            <div><label className="text-xs font-bold block mb-1">{tr(lang, 'email')}</label><input type="email" required value={email} onChange={(e) => setEmail(e.target.value)} className="w-full px-3 py-2 border border-[#d9dbe1] rounded-lg text-sm" /></div>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div><label className="text-xs font-bold block mb-1">{tr(lang, 'company')}</label><input value={company} onChange={(e) => setCompany(e.target.value)} className="w-full px-3 py-2 border border-[#d9dbe1] rounded-lg text-sm" /></div>
            <div><label className="text-xs font-bold block mb-1">GSTIN (optional)</label><input value={gstin} onChange={(e) => setGstin(e.target.value.toUpperCase())} className="w-full px-3 py-2 border border-[#d9dbe1] rounded-lg text-sm" /></div>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div><label className="text-xs font-bold block mb-1">{tr(lang, 'state')}</label><input required value={stateName} onChange={(e) => setStateName(e.target.value)} className="w-full px-3 py-2 border border-[#d9dbe1] rounded-lg text-sm" /></div>
            <div><label className="text-xs font-bold block mb-1">{tr(lang, 'pin')}</label><input required pattern="[0-9]{6}" value={pin} onChange={(e) => setPin(e.target.value)} placeholder="814133" className="w-full px-3 py-2 border border-[#d9dbe1] rounded-lg text-sm" /></div>
          </div>

          {!isCreditPurchase && (
            <>
              <div><label className="text-xs font-bold block mb-1">{tr(lang, 'licensee')}</label><input required value={licensee} onChange={(e) => setLicensee(e.target.value)} className="w-full px-3 py-2 border border-[#d9dbe1] rounded-lg text-sm" /></div>
              <div><label className="text-xs font-bold block mb-1">{tr(lang, 'use')}</label><ComboBox required value={intendedUse} onChange={setIntendedUse} options={USE_OPTIONS} placeholder="List se chuniye ya likhiye" /></div>
            </>
          )}

          <h3 className="text-base font-bold text-[#011f43] pt-2 m-0">{tr(lang, 'payment')}</h3>
          <div className="space-y-2">
            {!isCreditPurchase && (
              <label className={`flex items-center gap-2.5 p-3 rounded-xl border ${canCredits ? 'cursor-pointer border-[#d9dbe1]' : 'opacity-45 cursor-not-allowed border-[#e5e8ef]'}`}>
                <input type="radio" name="pay" disabled={!canCredits} checked={pay === 'credits'} onChange={() => setPay('credits')} />
                <span className="text-sm"><b>Credits</b> <span className="text-xs text-[#5c6170]">({crCart} required · you have {user.credits || 0})</span></span>
              </label>
            )}
            <label className="flex items-center gap-2.5 p-3 rounded-xl border border-[#d9dbe1] cursor-pointer">
              <input type="radio" name="pay" checked={pay === 'upi'} onChange={() => setPay('upi')} />
              <span className="text-sm"><b>UPI</b> <span className="text-xs text-[#5c6170]">GPay, PhonePe, Paytm</span></span>
            </label>
          </div>

          {pay === 'upi' && (() => {
            const amt = String(total);
            const upiUrl = `upi://pay?pa=${encodeURIComponent(payCfg.upiId).replace(/%40/g, '@')}&pn=${encodeURIComponent(payCfg.payeeName)}&am=${amt}&cu=INR&tn=${encodeURIComponent('SantalStock ' + payRef)}`;
            const waText = `SantalStock payment\nRef: ${payRef}\nName: ${name}\nEmail: ${email}\nAmount: Rs ${amt}\nUTR: ${utr || '(screenshot attached)'}`;
            return (
              <div className="rounded-xl border border-[#cfe0ff] bg-gradient-to-b from-[#f5f9ff] to-white p-4">
                <div className="flex items-center justify-between gap-2 mb-2">
                  <h4 className="m-0 text-sm font-bold text-[#011f43]">{tr(lang, 'upiPayTitle')}</h4>
                  <span className="text-lg font-extrabold text-[#011f43] tabular-nums">{money(total)}</span>
                </div>
                <div className="flex flex-col sm:flex-row gap-4 items-center">
                  <div className="w-44 h-44 shrink-0 rounded-xl bg-white border border-[#d9dbe1] p-2">
                    <UpiQr value={upiUrl} className="w-full h-full object-contain" />
                  </div>
                  <div className="flex-1 w-full space-y-2 text-xs text-[#33405c]">
                    <p className="m-0">{tr(lang, 'upiScan')}</p>
                    <div className="flex items-center gap-2 flex-wrap">
                      <code className="px-2 py-1 rounded bg-[#eef1f7] font-bold text-[#011f43]">{payCfg.upiId}</code>
                      <button type="button" onClick={() => { navigator.clipboard?.writeText(payCfg.upiId); toast('UPI ID copied'); }} className="px-2 py-1 rounded border border-[#d9dbe1] bg-white font-semibold cursor-pointer">Copy</button>
                    </div>
                    <div className="text-[11px] text-[#5c6170]">{payCfg.payeeName} · Ref {payRef}</div>
                    <a href={upiUrl} className="sm:hidden inline-flex items-center justify-center w-full py-2.5 rounded-lg bg-[#1b8a4b] text-white font-bold no-underline">{tr(lang, 'upiOpen')}</a>
                  </div>
                </div>
                <label className="text-xs font-bold block mt-3 mb-1">{tr(lang, 'utrLabel')}</label>
                <input
                  required
                  inputMode="numeric"
                  pattern="[0-9 ]{12,14}"
                  maxLength={14}
                  value={utr}
                  onChange={(e) => setUtr(e.target.value.replace(/[^0-9 ]/g, ''))}
                  placeholder="e.g. 412345678901"
                  className="w-full px-3 py-2 border border-[#d9dbe1] rounded-lg text-sm tracking-wider"
                />
                <div className="text-[11px] text-[#5c6170] mt-1">{tr(lang, 'utrHelp')}</div>
                <a
                  href={`https://wa.me/${payCfg.whatsapp}?text=${encodeURIComponent(waText)}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="mt-2.5 inline-flex items-center gap-1.5 px-3 py-2 rounded-lg bg-[#25d366] text-white text-xs font-bold no-underline"
                >
                  {tr(lang, 'waSend')}
                </a>
              </div>
            );
          })()}


          {!isCreditPurchase && (
            <label className="flex items-start gap-2 text-xs text-[#33405c] pt-1">
              <input type="checkbox" required className="mt-0.5" />
              <span>{tr(lang, 'agree')}</span>
            </label>
          )}
        </div>

        <div className="bg-white border border-[#d9dbe1] rounded-xl p-5 h-fit space-y-3">
          {isCreditPurchase ? (
            <div className="font-bold text-[#011f43]">
              {planObj ? `${planObj.n} plan (${planObj.cr} credits/month)` : `${packObj!.cr} credit pack`}
            </div>
          ) : (
            <div className="space-y-2.5">
              {validCart.map((c) => {
                const a = assets.find((x) => x.id === c.id);
                return (
                  <div key={`${c.id}-${c.lic}-${c.size}`} className="flex items-center justify-between gap-2 text-xs pb-2 border-b border-[#eef0f7]">
                    <span className="font-semibold text-[#011f43]">{a?.title} ({c.size})</span>
                    <span className="font-bold tabular-nums">{money(c.price)}</span>
                  </div>
                );
              })}
            </div>
          )}
          <div className="flex justify-between text-sm"><span>{tr(lang, 'subtotal')}</span><b className="tabular-nums">{money(sub)}</b></div>
          <div className="flex justify-between text-sm"><span>GST {Math.round(siteConfig.pricing.gst * 100)}%</span><b className="tabular-nums">{money(gst)}</b></div>
          <hr className="border-[#e5e8ef]" />
          <div className="flex justify-between items-center"><span>{tr(lang, 'total')}</span><span className="text-3xl font-extrabold text-[#011f43] tabular-nums">{money(total)}</span></div>
          <button type="submit" disabled={processing} className="w-full py-3 rounded-lg bg-[#d6262f] text-white font-bold cursor-pointer disabled:opacity-50">
            {processing ? 'Processing...' : pay === 'upi' ? tr(lang, 'submitUtr') : tr(lang, 'pay')}
          </button>
        </div>
      </form>
    </section>
  );
}

/* ================= ORDER, CERT, INVOICE ================= */
export function OrderCertInvoicePage({
  view,
  orderId,
  itemIndex,
  lang,
  orders,
  assets,
  siteConfig,
  money,
  onNavigate,
  toast,
}: {
  view: 'order' | 'cert' | 'invoice';
  orderId: string;
  itemIndex?: number;
  lang: LangCode;
  orders: Order[];
  assets: Asset[];
  siteConfig: SiteConfig;
  money: (n: number) => string;
  onNavigate: (hash: string) => void;
  toast: (m: string) => void;
}) {
  const order = orders.find((o) => o.id === orderId);
  if (!order) return <div className="wrap py-16 text-center text-[#5c6170]">Order nahi mila.</div>;
  if (order.status && order.status !== 'paid') {
    return (
      <section className="wrap py-14 max-w-xl text-center">
        <h1 className="dm text-3xl text-[#011f43] m-0">Order {order.id}</h1>
        <div className={`mt-4 rounded-xl p-4 text-sm ${order.status === 'pending' ? 'bg-[#fff7e6] border border-[#f5d590] text-[#8a5200]' : 'bg-[#fde8e8] border border-[#f3b4b4] text-[#b42318]'}`}>
          {order.status === 'pending' ? tr(lang, 'pendingMsg') : `${tr(lang, 'stRejected')}: UTR ${order.utr || ''}`}
        </div>
        <div className="mt-3 text-xs text-[#5c6170]">UTR {order.utr} · {money(order.total)}</div>
        <button type="button" onClick={() => onNavigate('#/account/orders')} className="mt-5 px-4 py-2 rounded-lg bg-[#011f43] text-white text-sm font-semibold cursor-pointer">Orders</button>
      </section>
    );
  }

  if (view === 'order') {
    return (
      <section className="wrap py-9">
        <div className="flex items-center justify-between flex-wrap gap-3 mb-2">
          <h1 className="dm text-4xl text-[#011f43] m-0">Order {order.id}</h1>
          <button type="button" onClick={() => onNavigate(`#/invoice/${order.id}`)} className="px-4 py-2 rounded-lg border border-[#d9dbe1] bg-white text-[#011f43] text-sm font-semibold cursor-pointer">
            🧾 {tr(lang, 'invoice')}
          </button>
        </div>
        <p className="text-sm text-[#5c6170] mb-5">
          {new Date(order.date).toLocaleString('en-IN')} · {order.pay.toUpperCase()} · {order.credits ? `${order.credits} credits` : money(order.total)}
        </p>
        {order.items.length ? (
          <div className="bg-white border border-[#d9dbe1] rounded-xl p-5 overflow-x-auto">
            <table className="w-full text-sm border-collapse">
              <thead>
                <tr className="border-b border-[#d9dbe1] text-left text-xs uppercase text-[#5c6170]">
                  <th className="py-2">Photo</th><th>License</th><th>License key</th><th />
                </tr>
              </thead>
              <tbody>
                {order.items.map((i, idx) => {
                  const a = assets.find((x) => x.id === i.id);
                  return (
                    <tr key={i.key} className="border-b border-[#e5e8ef]">
                      <td className="py-3">
                        <div className="flex items-center gap-2.5">
                          {a && <img src={thumbUrl(a, 180)} alt={i.title} className="w-20 h-14 object-cover rounded" />}
                          <div><b>{i.title}</b><div className="text-xs text-[#5c6170]">{i.id}</div></div>
                        </div>
                      </td>
                      <td>{siteConfig.pricing.licMeta[i.lic].n}<br /><span className="text-xs text-[#5c6170]">{siteConfig.pricing.sizes.find((s) => s.k === i.size)?.n}</span></td>
                      <td><code className="bg-[#f3f4f8] px-2 py-1 rounded text-xs">{i.key}</code></td>
                      <td>
                        <div className="flex gap-2">
                          <button type="button" onClick={() => a && downloadFullAsset(a, i.size, siteConfig, toast)} className="px-3 py-1.5 rounded-lg bg-[#011f43] text-white text-xs font-bold inline-flex items-center gap-1 cursor-pointer">
                            <Download className="w-3.5 h-3.5" /> {tr(lang, 'download')}
                          </button>
                          <button type="button" onClick={() => onNavigate(`#/cert/${order.id}/${idx}`)} className="px-3 py-1.5 rounded-lg border border-[#d9dbe1] bg-white text-[#011f43] text-xs font-bold cursor-pointer">
                            📜 {tr(lang, 'cert')}
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="bg-[#e9f6ee] border border-[#c5e8d1] rounded-xl p-5 text-[#11602d] font-semibold">
            {order.desc} active. {order.addCr} credits added to your account!
          </div>
        )}
      </section>
    );
  }

  if (view === 'cert') {
    const item = order.items[itemIndex || 0];
    if (!item) return null;
    const asset = assets.find((x) => x.id === item.id);
    return (
      <section className="wrap py-8">
        <div className="noprint flex gap-2.5 mb-5">
          <button type="button" onClick={() => window.print()} className="px-4 py-2 rounded-lg bg-[#011f43] text-white text-sm font-semibold inline-flex items-center gap-1.5 cursor-pointer">
            <Printer className="w-4 h-4" /> Print / Save PDF
          </button>
          <button type="button" onClick={() => onNavigate(`#/order/${order.id}`)} className="px-4 py-2 rounded-lg border border-[#d9dbe1] bg-white text-[#011f43] text-sm font-semibold cursor-pointer">
            ← Order
          </button>
        </div>
        <div className="bg-white max-w-[820px] mx-auto border-[10px] border-double border-[#011f43] p-8 sm:p-10 font-serif">
          <p className="text-center tracking-[4px] text-xs m-0">SANTALSTOCK</p>
          <h1 className="dm text-4xl text-center my-1">License Certificate</h1>
          <p className="text-center font-bold">{siteConfig.pricing.licMeta[item.lic].n}</p>
          <hr className="my-4" />
          <table className="w-full text-sm border-collapse">
            <tbody>
              <tr className="border-b"><th className="text-left py-2">License key</th><td><span className="font-mono text-base bg-[#f3f4f8] px-2.5 py-1 rounded">{item.key}</span></td></tr>
              <tr className="border-b"><th className="text-left py-2">Licensee</th><td>{item.licensee}</td></tr>
              <tr className="border-b"><th className="text-left py-2">Purchased by</th><td>{order.bill.name} ({order.bill.email})</td></tr>
              <tr className="border-b"><th className="text-left py-2">Asset</th><td>{item.title} — ID {item.id}{asset && <img src={thumbUrl(asset, 240)} alt={item.title} className="w-40 rounded mt-2" />}</td></tr>
              <tr className="border-b"><th className="text-left py-2">Intended use</th><td>{item.use}</td></tr>
              <tr className="border-b"><th className="text-left py-2">Order / Date</th><td>{order.id} · {new Date(order.date).toLocaleDateString('en-IN')}</td></tr>
              <tr><th className="text-left py-2">Term / Territory</th><td>Perpetual · Worldwide · Non-exclusive · Non-transferable</td></tr>
            </tbody>
          </table>
        </div>
      </section>
    );
  }

  // INVOICE
  const intra = (order.bill.state || '').toLowerCase() === 'jharkhand';
  const lines = order.items.length
    ? order.items.map((i) => [`${i.title} (${i.id}) – ${siteConfig.pricing.licMeta[i.lic].n}, ${i.size}`, order.credits ? 0 : i.price] as [string, number])
    : [[order.desc || 'Credits', order.sub] as [string, number]];
  const gstPct = Math.round(siteConfig.pricing.gst * 100);

  return (
    <section className="wrap py-8">
      <div className="noprint flex gap-2.5 mb-5">
        <button type="button" onClick={() => window.print()} className="px-4 py-2 rounded-lg bg-[#011f43] text-white text-sm font-semibold inline-flex items-center gap-1.5 cursor-pointer">
          <Printer className="w-4 h-4" /> Print / Save PDF
        </button>
        <button type="button" onClick={() => onNavigate(`#/order/${order.id}`)} className="px-4 py-2 rounded-lg border border-[#d9dbe1] bg-white text-[#011f43] text-sm font-semibold cursor-pointer">
          ← Order
        </button>
      </div>
      <div className="bg-white max-w-[820px] mx-auto border border-[#333] p-8 sm:p-10">
        <div className="flex justify-between flex-wrap gap-4">
          <div>
            <b className="dm text-2xl">SantalStock</b>
            <div className="text-xs text-[#5c6170] mt-1">{siteConfig.contact.venture}<br />{siteConfig.contact.location} · GSTIN: {siteConfig.settings.gstin}</div>
          </div>
          <div className="text-right">
            <b>TAX INVOICE</b>
            <div className="text-xs text-[#5c6170]">{order.id.replace('ORD', 'INV')}<br />{new Date(order.date).toLocaleDateString('en-IN')}</div>
          </div>
        </div>
        <hr className="my-4" />
        <p className="text-xs">
          <b>Bill to:</b> {order.bill.company || order.bill.name}<br />
          {order.bill.email} · {order.bill.state} {order.bill.pin}
          {order.bill.gstin && <><br />GSTIN: {order.bill.gstin}</>}
        </p>
        <table className="w-full text-sm border-collapse mt-4">
          <thead>
            <tr className="border-b text-left text-xs uppercase text-[#5c6170]">
              <th className="py-2">Description</th><th>SAC</th><th className="text-right">Amount</th>
            </tr>
          </thead>
          <tbody>
            {lines.map(([label, amt], idx) => (
              <tr key={idx} className="border-b"><td className="py-2">{label}</td><td>998439</td><td className="text-right tabular-nums">{money(amt)}</td></tr>
            ))}
            <tr className="border-b"><td colSpan={2} className="py-2 text-right">Taxable value</td><td className="text-right tabular-nums">{money(order.sub)}</td></tr>
            {intra ? (
              <>
                <tr className="border-b"><td colSpan={2} className="py-2 text-right">CGST {gstPct / 2}%</td><td className="text-right tabular-nums">{money(order.gst / 2)}</td></tr>
                <tr className="border-b"><td colSpan={2} className="py-2 text-right">SGST {gstPct / 2}%</td><td className="text-right tabular-nums">{money(order.gst / 2)}</td></tr>
              </>
            ) : (
              <tr className="border-b"><td colSpan={2} className="py-2 text-right">IGST {gstPct}%</td><td className="text-right tabular-nums">{money(order.gst)}</td></tr>
            )}
            <tr><th colSpan={2} className="py-2.5 text-right">Total</th><th className="text-right tabular-nums">{money(order.total)}</th></tr>
          </tbody>
        </table>
      </div>
    </section>
  );
}
