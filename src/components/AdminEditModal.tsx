import React, { useState } from 'react';
import { X, Plus, Trash2, Upload, Save } from 'lucide-react';
import { thumbUrl } from '../data/defaults';
import type { AdminEditTarget, Asset, LicenseOptionKey, SiteConfig, SizeKey, User } from '../types';

interface AdminEditModalProps {
  target: AdminEditTarget;
  siteConfig: SiteConfig;
  assets: Asset[];
  users: User[];
  onClose: () => void;
  onSaveConfig: (next: SiteConfig) => Promise<void>;
  onSavePhoto: (id: string | null, payload: Record<string, unknown>) => Promise<void>;
  onDeletePhoto: (id: string) => Promise<void>;
  toast: (m: string) => void;
}

function resizeImageFile(file: File): Promise<{ w: number; h: number; prevUrl: string; fullUrl: string }> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const img = new Image();
      img.onload = () => {
        const scale = (max: number, q: number) => {
          const c = document.createElement('canvas');
          const s = Math.min(1, max / Math.max(img.naturalWidth, img.naturalHeight));
          c.width = Math.round(img.naturalWidth * s);
          c.height = Math.round(img.naturalHeight * s);
          c.getContext('2d')?.drawImage(img, 0, 0, c.width, c.height);
          return c.toDataURL('image/jpeg', q);
        };
        resolve({
          w: img.naturalWidth,
          h: img.naturalHeight,
          prevUrl: scale(1100, 0.8),
          fullUrl: scale(2600, 0.88),
        });
      };
      img.onerror = reject;
      img.src = String(reader.result);
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

export function AdminEditModal({
  target,
  siteConfig,
  assets,
  users,
  onClose,
  onSaveConfig,
  onSavePhoto,
  onDeletePhoto,
  toast,
}: AdminEditModalProps) {
  const [cfg, setCfg] = useState<SiteConfig>(() => structuredClone(siteConfig));
  const [saving, setSaving] = useState(false);

  // Photo editing / adding state
  const existingPhoto = target.itemId ? assets.find((a) => a.id === target.itemId) : undefined;
  const [photoTitle, setPhotoTitle] = useState(existingPhoto?.title || '');
  const [photoDesc, setPhotoDesc] = useState(existingPhoto?.desc || '');
  const [photoCat, setPhotoCat] = useState(existingPhoto?.cat || 'Culture');
  const [photoLic, setPhotoLic] = useState<'rf' | 'editorial'>(existingPhoto?.lic || 'rf');
  const [photoStatus, setPhotoStatus] = useState<'approved' | 'pending' | 'rejected'>(existingPhoto?.status || 'approved');
  const [photoContributor, setPhotoContributor] = useState(existingPhoto?.contributor || users[0]?.name || 'Admin');
  const [photoOwner, setPhotoOwner] = useState(existingPhoto?.owner || users[0]?.email || 'admin@santalstock.in');
  const [photoPlace, setPhotoPlace] = useState(existingPhoto?.place || '');
  const [photoCaption, setPhotoCaption] = useState(existingPhoto?.caption || '');
  const [photoKw, setPhotoKw] = useState((existingPhoto?.kw || []).join(', '));
  const [uploadedImg, setUploadedImg] = useState<{ w: number; h: number; prevUrl: string; fullUrl: string } | null>(null);

  const [newCatInput, setNewCatInput] = useState('');

  async function saveCms() {
    setSaving(true);
    try {
      await onSaveConfig(cfg);
      onClose();
    } catch (err) {
      toast((err as Error).message);
    } finally {
      setSaving(false);
    }
  }

  async function handlePhotoSubmit(e: React.FormEvent) {
    e.preventDefault();
    const kwList = photoKw.split(',').map((s) => s.trim().toLowerCase()).filter(Boolean);
    if (!existingPhoto && !uploadedImg) {
      toast('Please select an image file first');
      return;
    }
    setSaving(true);
    try {
      await onSavePhoto(existingPhoto ? existingPhoto.id : null, {
        title: photoTitle,
        desc: photoDesc,
        cat: photoCat,
        lic: photoLic,
        status: photoStatus,
        contributor: photoContributor,
        owner: photoOwner,
        assignOwner: photoOwner,
        place: photoPlace,
        caption: photoCaption,
        kw: kwList.length ? kwList : [photoCat.toLowerCase(), 'santalstock'],
        ...(uploadedImg || {}),
      });
      onClose();
    } catch (err) {
      toast((err as Error).message);
    } finally {
      setSaving(false);
    }
  }

  const allCats = Array.from(new Set([...assets.map((a) => a.cat), ...cfg.settings.customCategories]));

  return (
    <div
      className="fixed inset-0 z-50 bg-black/60 backdrop-blur-[2px] flex items-center justify-center p-4"
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div className="bg-white border border-[#d9dbe1] rounded-2xl w-full max-w-[700px] max-h-[90vh] flex flex-col shadow-2xl overflow-hidden">
        <div className="flex items-center justify-between px-6 py-4 border-b border-[#e5e8ef] bg-[#f8faff]">
          <div>
            <div className="text-[11px] font-bold uppercase tracking-wider text-[#d6262f]">Admin Mode Visual Editor</div>
            <h2 className="dm text-2xl text-[#011f43] m-0">
              {target.section === 'brandLogo' && 'Edit Brand Logo & Colors'}
              {target.section === 'heroTitle' && 'Edit Hero Title & Letter Colors'}
              {target.section === 'searchBar' && 'Edit Search Button Color & Placeholder'}
              {target.section === 'subnav' && 'Edit / Add / Delete Navigation Links'}
              {target.section === 'heroText' && 'Edit Hero Heading & Subtitle'}
              {target.section === 'heroChips' && 'Edit / Add / Delete Quick Search Chips'}
              {target.section === 'featureCards' && 'Edit / Add / Delete Feature Cards'}
              {target.section === 'customSections' && 'Add / Edit / Delete Custom Sections'}
              {target.section === 'ctaBanner' && 'Edit Contributor CTA Banner'}
              {target.section === 'pricingMatrix' && 'Edit Affordable Minimum Prices & GST'}
              {target.section === 'plans' && 'Edit / Add / Delete Subscription Plans'}
              {target.section === 'packs' && 'Edit / Add / Delete Credit Packs'}
              {target.section === 'licenseRows' && 'Edit / Add / Delete License Guide Rows'}
              {target.section === 'faqs' && 'Edit / Add / Delete FAQ Items'}
              {target.section === 'pageAbout' && 'Edit About Us Page'}
              {target.section === 'pagePrivacy' && 'Edit Privacy Policy'}
              {target.section === 'pageRefund' && 'Edit Refund Policy'}
              {target.section === 'pageTerms' && 'Edit License Agreement Sections'}
              {target.section === 'contact' && 'Edit Contact Details'}
              {target.section === 'footer' && 'Edit Footer Content, Columns & Links'}
              {target.section === 'categories' && 'Manage Categories'}
              {target.section === 'addPhoto' && 'Add & Publish New Photo'}
              {target.section === 'editPhoto' && `Edit Photo · ${existingPhoto?.id || ''}`}
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="w-9 h-9 rounded-full border border-[#d9dbe1] bg-white text-[#011f43] flex items-center justify-center cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="p-6 overflow-y-auto flex-1 space-y-4">
          {/* 1. BRAND LOGO */}
          {target.section === 'brandLogo' && (
            <div className="space-y-4">
              <div className="p-4 rounded-xl bg-[#f5f8fd] border border-[#dbe3ef] text-center">
                <span className="text-3xl font-bold tracking-[6px]">
                  <span style={{ color: cfg.brand.logoPart1.color }}>{cfg.brand.logoPart1.text}</span>
                  <span style={{ color: cfg.brand.logoPart2.color }}>{cfg.brand.logoPart2.text}</span>
                </span>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="p-3 border border-[#e3e7f0] rounded-xl space-y-2">
                  <label className="text-xs font-bold text-[#011f43]">Part 1 Text (e.g. SANTAL)</label>
                  <input
                    value={cfg.brand.logoPart1.text}
                    onChange={(e) => setCfg({ ...cfg, brand: { ...cfg.brand, logoPart1: { ...cfg.brand.logoPart1, text: e.target.value } } })}
                    className="w-full px-3 py-2 border border-[#d9dbe1] rounded-lg text-sm"
                  />
                  <label className="text-xs font-bold text-[#011f43] block">Part 1 Color</label>
                  <div className="flex items-center gap-2">
                    <input
                      type="color"
                      value={cfg.brand.logoPart1.color}
                      onChange={(e) => setCfg({ ...cfg, brand: { ...cfg.brand, logoPart1: { ...cfg.brand.logoPart1, color: e.target.value } } })}
                      className="w-12 h-10 p-1 border border-[#d9dbe1] rounded-lg cursor-pointer"
                    />
                    <input
                      value={cfg.brand.logoPart1.color}
                      onChange={(e) => setCfg({ ...cfg, brand: { ...cfg.brand, logoPart1: { ...cfg.brand.logoPart1, color: e.target.value } } })}
                      className="flex-1 px-3 py-2 border border-[#d9dbe1] rounded-lg text-sm font-mono"
                    />
                  </div>
                </div>
                <div className="p-3 border border-[#e3e7f0] rounded-xl space-y-2">
                  <label className="text-xs font-bold text-[#011f43]">Part 2 Text (e.g. STOCK)</label>
                  <input
                    value={cfg.brand.logoPart2.text}
                    onChange={(e) => setCfg({ ...cfg, brand: { ...cfg.brand, logoPart2: { ...cfg.brand.logoPart2, text: e.target.value } } })}
                    className="w-full px-3 py-2 border border-[#d9dbe1] rounded-lg text-sm"
                  />
                  <label className="text-xs font-bold text-[#011f43] block">Part 2 Color</label>
                  <div className="flex items-center gap-2">
                    <input
                      type="color"
                      value={cfg.brand.logoPart2.color}
                      onChange={(e) => setCfg({ ...cfg, brand: { ...cfg.brand, logoPart2: { ...cfg.brand.logoPart2, color: e.target.value } } })}
                      className="w-12 h-10 p-1 border border-[#d9dbe1] rounded-lg cursor-pointer"
                    />
                    <input
                      value={cfg.brand.logoPart2.color}
                      onChange={(e) => setCfg({ ...cfg, brand: { ...cfg.brand, logoPart2: { ...cfg.brand.logoPart2, color: e.target.value } } })}
                      className="flex-1 px-3 py-2 border border-[#d9dbe1] rounded-lg text-sm font-mono"
                    />
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* 2. HERO TITLE (SSP | SantalStock Photos) */}
          {target.section === 'heroTitle' && (
            <div className="space-y-4">
              <div className="p-4 rounded-xl bg-[#eef3fb] border border-[#dbe3ef] flex items-center justify-center gap-5 flex-wrap">
                <span className="text-4xl font-bold tracking-[6px]">
                  {cfg.brand.heroAbbr.map((seg, i) => (
                    <span key={i} style={{ color: seg.color }}>{seg.text}</span>
                  ))}
                </span>
                <span className="w-[3px] h-12 rounded-full" style={{ backgroundColor: cfg.brand.heroDividerColor }} />
                <span className="text-4xl font-light tracking-tight">
                  {cfg.brand.heroFull.map((seg, i) => (
                    <span key={i} style={{ color: seg.color }} className={i === cfg.brand.heroFull.length - 1 ? 'ml-2' : ''}>
                      {seg.text}
                    </span>
                  ))}
                </span>
              </div>

              <div>
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm font-bold text-[#011f43]">Left Abbreviation Letters (S · S · P)</span>
                  <button
                    type="button"
                    onClick={() =>
                      setCfg({
                        ...cfg,
                        brand: { ...cfg.brand, heroAbbr: [...cfg.brand.heroAbbr, { text: 'X', color: '#011f43' }] },
                      })
                    }
                    className="text-xs px-2.5 py-1 rounded-lg bg-[#eef3fb] text-[#011f43] font-bold inline-flex items-center gap-1 cursor-pointer"
                  >
                    <Plus className="w-3.5 h-3.5" /> Add Letter
                  </button>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                  {cfg.brand.heroAbbr.map((seg, i) => (
                    <div key={i} className="flex items-center gap-1.5 p-2 border border-[#e3e7f0] rounded-lg">
                      <input
                        value={seg.text}
                        onChange={(e) => {
                          const next = [...cfg.brand.heroAbbr];
                          next[i] = { ...next[i], text: e.target.value };
                          setCfg({ ...cfg, brand: { ...cfg.brand, heroAbbr: next } });
                        }}
                        className="w-14 px-2 py-1.5 border border-[#d9dbe1] rounded text-center font-bold"
                      />
                      <input
                        type="color"
                        value={seg.color}
                        onChange={(e) => {
                          const next = [...cfg.brand.heroAbbr];
                          next[i] = { ...next[i], color: e.target.value };
                          setCfg({ ...cfg, brand: { ...cfg.brand, heroAbbr: next } });
                        }}
                        className="w-10 h-9 p-0.5 border border-[#d9dbe1] rounded cursor-pointer"
                      />
                      {cfg.brand.heroAbbr.length > 1 && (
                        <button
                          type="button"
                          onClick={() => {
                            const next = cfg.brand.heroAbbr.filter((_, idx) => idx !== i);
                            setCfg({ ...cfg, brand: { ...cfg.brand, heroAbbr: next } });
                          }}
                          className="text-red-600 p-1 cursor-pointer"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              </div>

              <div className="flex items-center gap-3">
                <label className="text-sm font-bold text-[#011f43]">Center Divider Bar Color</label>
                <input
                  type="color"
                  value={cfg.brand.heroDividerColor}
                  onChange={(e) => setCfg({ ...cfg, brand: { ...cfg.brand, heroDividerColor: e.target.value } })}
                  className="w-12 h-9 p-0.5 border border-[#d9dbe1] rounded cursor-pointer"
                />
              </div>

              <div>
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm font-bold text-[#011f43]">Right Brand Words (Santal · Stock · Photos)</span>
                  <button
                    type="button"
                    onClick={() =>
                      setCfg({
                        ...cfg,
                        brand: { ...cfg.brand, heroFull: [...cfg.brand.heroFull, { text: 'Word', color: '#011f43' }] },
                      })
                    }
                    className="text-xs px-2.5 py-1 rounded-lg bg-[#eef3fb] text-[#011f43] font-bold inline-flex items-center gap-1 cursor-pointer"
                  >
                    <Plus className="w-3.5 h-3.5" /> Add Word
                  </button>
                </div>
                <div className="space-y-2">
                  {cfg.brand.heroFull.map((seg, i) => (
                    <div key={i} className="flex items-center gap-2 p-2 border border-[#e3e7f0] rounded-lg">
                      <input
                        value={seg.text}
                        onChange={(e) => {
                          const next = [...cfg.brand.heroFull];
                          next[i] = { ...next[i], text: e.target.value };
                          setCfg({ ...cfg, brand: { ...cfg.brand, heroFull: next } });
                        }}
                        className="flex-1 px-3 py-1.5 border border-[#d9dbe1] rounded text-sm font-semibold"
                      />
                      <input
                        type="color"
                        value={seg.color}
                        onChange={(e) => {
                          const next = [...cfg.brand.heroFull];
                          next[i] = { ...next[i], color: e.target.value };
                          setCfg({ ...cfg, brand: { ...cfg.brand, heroFull: next } });
                        }}
                        className="w-10 h-9 p-0.5 border border-[#d9dbe1] rounded cursor-pointer"
                      />
                      {cfg.brand.heroFull.length > 1 && (
                        <button
                          type="button"
                          onClick={() => {
                            const next = cfg.brand.heroFull.filter((_, idx) => idx !== i);
                            setCfg({ ...cfg, brand: { ...cfg.brand, heroFull: next } });
                          }}
                          className="text-red-600 p-1 cursor-pointer"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* 3. SEARCH BAR */}
          {target.section === 'searchBar' && (
            <div className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="text-xs font-bold text-[#011f43] block mb-1">Search Button Background Color</label>
                  <div className="flex items-center gap-2">
                    <input
                      type="color"
                      value={cfg.brand.searchBtnBg}
                      onChange={(e) => setCfg({ ...cfg, brand: { ...cfg.brand, searchBtnBg: e.target.value } })}
                      className="w-12 h-10 p-1 border border-[#d9dbe1] rounded cursor-pointer"
                    />
                    <input
                      value={cfg.brand.searchBtnBg}
                      onChange={(e) => setCfg({ ...cfg, brand: { ...cfg.brand, searchBtnBg: e.target.value } })}
                      className="flex-1 px-3 py-2 border border-[#d9dbe1] rounded-lg text-sm font-mono"
                    />
                  </div>
                </div>
                <div>
                  <label className="text-xs font-bold text-[#011f43] block mb-1">Search Magnifying Icon Color</label>
                  <div className="flex items-center gap-2">
                    <input
                      type="color"
                      value={cfg.brand.searchBtnIcon}
                      onChange={(e) => setCfg({ ...cfg, brand: { ...cfg.brand, searchBtnIcon: e.target.value } })}
                      className="w-12 h-10 p-1 border border-[#d9dbe1] rounded cursor-pointer"
                    />
                    <input
                      value={cfg.brand.searchBtnIcon}
                      onChange={(e) => setCfg({ ...cfg, brand: { ...cfg.brand, searchBtnIcon: e.target.value } })}
                      className="flex-1 px-3 py-2 border border-[#d9dbe1] rounded-lg text-sm font-mono"
                    />
                  </div>
                </div>
              </div>
              <div>
                <label className="text-xs font-bold text-[#011f43] block mb-1">Custom Search Placeholder (leave blank for auto multilingual)</label>
                <input
                  value={cfg.brand.searchPlaceholderCustom || ''}
                  onChange={(e) => setCfg({ ...cfg, brand: { ...cfg.brand, searchPlaceholderCustom: e.target.value } })}
                  placeholder="e.g. Search village, festival, nature photos..."
                  className="w-full px-3 py-2 border border-[#d9dbe1] rounded-lg text-sm"
                />
              </div>
            </div>
          )}

          {/* 4. SUBNAV */}
          {target.section === 'subnav' && (
            <div className="space-y-3">
              {cfg.subnav.map((item, i) => (
                <div key={item.id} className="grid grid-cols-[1fr_1fr_auto] gap-2 items-center p-2.5 border border-[#e3e7f0] rounded-xl">
                  <input
                    value={item.label}
                    onChange={(e) => {
                      const next = [...cfg.subnav];
                      next[i] = { ...next[i], label: e.target.value, i18nKey: undefined };
                      setCfg({ ...cfg, subnav: next });
                    }}
                    placeholder="Link label"
                    className="px-3 py-2 border border-[#d9dbe1] rounded-lg text-sm"
                  />
                  <input
                    value={item.href}
                    onChange={(e) => {
                      const next = [...cfg.subnav];
                      next[i] = { ...next[i], href: e.target.value };
                      setCfg({ ...cfg, subnav: next });
                    }}
                    placeholder="#/search"
                    className="px-3 py-2 border border-[#d9dbe1] rounded-lg text-sm font-mono"
                  />
                  <button
                    type="button"
                    onClick={() => setCfg({ ...cfg, subnav: cfg.subnav.filter((_, idx) => idx !== i) })}
                    className="p-2 text-red-600 hover:bg-red-50 rounded-lg cursor-pointer"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              ))}
              <button
                type="button"
                onClick={() =>
                  setCfg({
                    ...cfg,
                    subnav: [...cfg.subnav, { id: 'nav-' + Date.now(), label: 'New Link', href: '#/search' }],
                  })
                }
                className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-[#eef3fb] text-[#011f43] text-sm font-bold cursor-pointer"
              >
                <Plus className="w-4 h-4" /> Add Navigation Link
              </button>
            </div>
          )}

          {/* 5. HERO TEXT */}
          {target.section === 'heroText' && (
            <div className="space-y-3">
              <div>
                <label className="text-xs font-bold text-[#011f43] block mb-1">Hero Heading (leave blank to use multilingual default)</label>
                <input
                  value={cfg.hero.headingCustom || ''}
                  onChange={(e) => setCfg({ ...cfg, hero: { ...cfg.hero, headingCustom: e.target.value } })}
                  placeholder="Authentic stock photos from Santal country"
                  className="w-full px-3 py-2 border border-[#d9dbe1] rounded-lg text-sm"
                />
              </div>
              <div>
                <label className="text-xs font-bold text-[#011f43] block mb-1">Hero Lead Subtitle (leave blank to use multilingual default)</label>
                <textarea
                  rows={3}
                  value={cfg.hero.subtitleCustom || ''}
                  onChange={(e) => setCfg({ ...cfg, hero: { ...cfg.hero, subtitleCustom: e.target.value } })}
                  placeholder="Royalty-Free and Editorial licenses..."
                  className="w-full px-3 py-2 border border-[#d9dbe1] rounded-lg text-sm"
                />
              </div>
            </div>
          )}

          {/* 6. HERO CHIPS */}
          {target.section === 'heroChips' && (
            <div className="space-y-2.5">
              {cfg.hero.chips.map((c, i) => (
                <div key={c.id} className="grid grid-cols-[1fr_1fr_auto] gap-2 items-center">
                  <input
                    value={c.label}
                    onChange={(e) => {
                      const next = [...cfg.hero.chips];
                      next[i] = { ...next[i], label: e.target.value };
                      setCfg({ ...cfg, hero: { ...cfg.hero, chips: next } });
                    }}
                    className="px-3 py-2 border border-[#d9dbe1] rounded-lg text-sm"
                  />
                  <input
                    value={c.href}
                    onChange={(e) => {
                      const next = [...cfg.hero.chips];
                      next[i] = { ...next[i], href: e.target.value };
                      setCfg({ ...cfg, hero: { ...cfg.hero, chips: next } });
                    }}
                    className="px-3 py-2 border border-[#d9dbe1] rounded-lg text-sm font-mono"
                  />
                  <button
                    type="button"
                    onClick={() => setCfg({ ...cfg, hero: { ...cfg.hero, chips: cfg.hero.chips.filter((_, idx) => idx !== i) } })}
                    className="p-2 text-red-600 hover:bg-red-50 rounded-lg cursor-pointer"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              ))}
              <button
                type="button"
                onClick={() =>
                  setCfg({
                    ...cfg,
                    hero: { ...cfg.hero, chips: [...cfg.hero.chips, { id: 'chip-' + Date.now(), label: 'new tag', href: '#/search?q=culture' }] },
                  })
                }
                className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-[#eef3fb] text-[#011f43] text-sm font-bold cursor-pointer"
              >
                <Plus className="w-4 h-4" /> Add Quick Chip
              </button>
            </div>
          )}

          {/* 7. FEATURE CARDS */}
          {target.section === 'featureCards' && (
            <div className="space-y-4">
              {cfg.featureCards.map((fc, i) => (
                <div key={fc.id} className="p-4 border border-[#dbe3ef] rounded-xl space-y-2.5 bg-[#f9fbff]">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold uppercase text-[#5c6170]">Card #{i + 1}</span>
                    <button
                      type="button"
                      onClick={() => setCfg({ ...cfg, featureCards: cfg.featureCards.filter((_, idx) => idx !== i) })}
                      className="text-xs text-red-600 font-bold inline-flex items-center gap-1 cursor-pointer"
                    >
                      <Trash2 className="w-3.5 h-3.5" /> Delete Card
                    </button>
                  </div>
                  <div className="grid grid-cols-2 gap-2.5">
                    <input
                      value={fc.badge}
                      onChange={(e) => {
                        const next = [...cfg.featureCards];
                        next[i] = { ...next[i], badge: e.target.value };
                        setCfg({ ...cfg, featureCards: next });
                      }}
                      placeholder="Badge text"
                      className="px-3 py-1.5 border border-[#d9dbe1] rounded-lg text-sm"
                    />
                    <select
                      value={fc.badgeType}
                      onChange={(e) => {
                        const next = [...cfg.featureCards];
                        next[i] = { ...next[i], badgeType: e.target.value as 'rf' | 'ed' | 'custom' };
                        setCfg({ ...cfg, featureCards: next });
                      }}
                      className="px-3 py-1.5 border border-[#d9dbe1] rounded-lg text-sm bg-white"
                    >
                      <option value="rf">Green Badge (RF)</option>
                      <option value="ed">Purple Badge (Editorial)</option>
                      <option value="custom">Navy Badge</option>
                    </select>
                  </div>
                  <input
                    value={fc.title}
                    onChange={(e) => {
                      const next = [...cfg.featureCards];
                      next[i] = { ...next[i], title: e.target.value };
                      setCfg({ ...cfg, featureCards: next });
                    }}
                    placeholder="Card title"
                    className="w-full px-3 py-2 border border-[#d9dbe1] rounded-lg text-sm font-semibold"
                  />
                  <textarea
                    rows={2}
                    value={fc.description}
                    onChange={(e) => {
                      const next = [...cfg.featureCards];
                      next[i] = { ...next[i], description: e.target.value };
                      setCfg({ ...cfg, featureCards: next });
                    }}
                    placeholder="Description"
                    className="w-full px-3 py-2 border border-[#d9dbe1] rounded-lg text-sm"
                  />
                  <div className="grid grid-cols-2 gap-2.5">
                    <input
                      value={fc.buttonText}
                      onChange={(e) => {
                        const next = [...cfg.featureCards];
                        next[i] = { ...next[i], buttonText: e.target.value };
                        setCfg({ ...cfg, featureCards: next });
                      }}
                      placeholder="Button text"
                      className="px-3 py-1.5 border border-[#d9dbe1] rounded-lg text-sm"
                    />
                    <input
                      value={fc.buttonLink}
                      onChange={(e) => {
                        const next = [...cfg.featureCards];
                        next[i] = { ...next[i], buttonLink: e.target.value };
                        setCfg({ ...cfg, featureCards: next });
                      }}
                      placeholder="#/search"
                      className="px-3 py-1.5 border border-[#d9dbe1] rounded-lg text-sm font-mono"
                    />
                  </div>
                </div>
              ))}
              <button
                type="button"
                onClick={() =>
                  setCfg({
                    ...cfg,
                    featureCards: [
                      ...cfg.featureCards,
                      {
                        id: 'fc-' + Date.now(),
                        badge: 'Special Offer',
                        badgeType: 'custom',
                        title: 'New Highlight Card',
                        description: 'Describe your new offer, collection, or service here.',
                        buttonText: 'Explore Now',
                        buttonLink: '#/pricing',
                        buttonStyle: 'red',
                      },
                    ],
                  })
                }
                className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-[#eef3fb] text-[#011f43] text-sm font-bold cursor-pointer"
              >
                <Plus className="w-4 h-4" /> Add New Card
              </button>
            </div>
          )}

          {/* 8. CUSTOM SECTIONS */}
          {target.section === 'customSections' && (
            <div className="space-y-4">
              {cfg.customSections.length === 0 && (
                <p className="text-sm text-[#5c6170]">No custom banners/sections added yet. Click below to add one to the Home page!</p>
              )}
              {cfg.customSections.map((sec, i) => (
                <div key={sec.id} className="p-4 border border-[#dbe3ef] rounded-xl space-y-2.5 bg-[#f9fbff]">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold uppercase text-[#5c6170]">Custom Section #{i + 1}</span>
                    <button
                      type="button"
                      onClick={() => setCfg({ ...cfg, customSections: cfg.customSections.filter((_, idx) => idx !== i) })}
                      className="text-xs text-red-600 font-bold inline-flex items-center gap-1 cursor-pointer"
                    >
                      <Trash2 className="w-3.5 h-3.5" /> Delete Section
                    </button>
                  </div>
                  <input
                    value={sec.title}
                    onChange={(e) => {
                      const next = [...cfg.customSections];
                      next[i] = { ...next[i], title: e.target.value };
                      setCfg({ ...cfg, customSections: next });
                    }}
                    placeholder="Section Title"
                    className="w-full px-3 py-2 border border-[#d9dbe1] rounded-lg text-sm font-semibold"
                  />
                  <textarea
                    rows={2}
                    value={sec.subtitle}
                    onChange={(e) => {
                      const next = [...cfg.customSections];
                      next[i] = { ...next[i], subtitle: e.target.value };
                      setCfg({ ...cfg, customSections: next });
                    }}
                    placeholder="Section Subtitle / Content"
                    className="w-full px-3 py-2 border border-[#d9dbe1] rounded-lg text-sm"
                  />
                  <div className="grid grid-cols-2 gap-2.5">
                    <input
                      value={sec.buttonText}
                      onChange={(e) => {
                        const next = [...cfg.customSections];
                        next[i] = { ...next[i], buttonText: e.target.value };
                        setCfg({ ...cfg, customSections: next });
                      }}
                      placeholder="Button Text"
                      className="px-3 py-1.5 border border-[#d9dbe1] rounded-lg text-sm"
                    />
                    <input
                      value={sec.buttonLink}
                      onChange={(e) => {
                        const next = [...cfg.customSections];
                        next[i] = { ...next[i], buttonLink: e.target.value };
                        setCfg({ ...cfg, customSections: next });
                      }}
                      placeholder="#/pricing"
                      className="px-3 py-1.5 border border-[#d9dbe1] rounded-lg text-sm font-mono"
                    />
                  </div>
                  <div className="flex items-center gap-4 text-xs">
                    <label className="flex items-center gap-1.5 font-semibold">
                      Bg <input type="color" value={sec.bgColor} onChange={(e) => {
                        const next = [...cfg.customSections];
                        next[i] = { ...next[i], bgColor: e.target.value };
                        setCfg({ ...cfg, customSections: next });
                      }} />
                    </label>
                    <label className="flex items-center gap-1.5 font-semibold">
                      Text <input type="color" value={sec.textColor} onChange={(e) => {
                        const next = [...cfg.customSections];
                        next[i] = { ...next[i], textColor: e.target.value };
                        setCfg({ ...cfg, customSections: next });
                      }} />
                    </label>
                    <label className="flex items-center gap-1.5 font-semibold">
                      Button <input type="color" value={sec.btnColor} onChange={(e) => {
                        const next = [...cfg.customSections];
                        next[i] = { ...next[i], btnColor: e.target.value };
                        setCfg({ ...cfg, customSections: next });
                      }} />
                    </label>
                  </div>
                </div>
              ))}
              <button
                type="button"
                onClick={() =>
                  setCfg({
                    ...cfg,
                    customSections: [
                      ...cfg.customSections,
                      {
                        id: 'sec-' + Date.now(),
                        title: 'Festival Special Collection',
                        subtitle: 'Download authentic Santali Sohrae & Baha festival photos starting at ₹19.',
                        buttonText: 'Browse Collection',
                        buttonLink: '#/search?q=festival',
                        bgColor: '#0f766e',
                        textColor: '#ffffff',
                        btnColor: '#ea580c',
                      },
                    ],
                  })
                }
                className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-[#011f43] text-white text-sm font-bold cursor-pointer"
              >
                <Plus className="w-4 h-4" /> Add Custom Section
              </button>
            </div>
          )}

          {/* 9. CTA BANNER */}
          {target.section === 'ctaBanner' && (
            <div className="space-y-3">
              <label className="flex items-center gap-2 text-sm font-semibold">
                <input
                  type="checkbox"
                  checked={cfg.ctaBanner.visible}
                  onChange={(e) => setCfg({ ...cfg, ctaBanner: { ...cfg.ctaBanner, visible: e.target.checked } })}
                />
                Show Contributor CTA Banner on Home Page
              </label>
              <input
                value={cfg.ctaBanner.titleCustom || ''}
                onChange={(e) => setCfg({ ...cfg, ctaBanner: { ...cfg.ctaBanner, titleCustom: e.target.value } })}
                placeholder="Custom Heading (blank = default)"
                className="w-full px-3 py-2 border border-[#d9dbe1] rounded-lg text-sm"
              />
              <input
                value={cfg.ctaBanner.subtitleCustom || ''}
                onChange={(e) => setCfg({ ...cfg, ctaBanner: { ...cfg.ctaBanner, subtitleCustom: e.target.value } })}
                placeholder="Custom Subtitle (blank = default)"
                className="w-full px-3 py-2 border border-[#d9dbe1] rounded-lg text-sm"
              />
              <div className="grid grid-cols-2 gap-3">
                <input
                  value={cfg.ctaBanner.buttonTextCustom || ''}
                  onChange={(e) => setCfg({ ...cfg, ctaBanner: { ...cfg.ctaBanner, buttonTextCustom: e.target.value } })}
                  placeholder="Button Label"
                  className="px-3 py-2 border border-[#d9dbe1] rounded-lg text-sm"
                />
                <input
                  value={cfg.ctaBanner.buttonLink}
                  onChange={(e) => setCfg({ ...cfg, ctaBanner: { ...cfg.ctaBanner, buttonLink: e.target.value } })}
                  placeholder="#/contributor"
                  className="px-3 py-2 border border-[#d9dbe1] rounded-lg text-sm font-mono"
                />
              </div>
              <div className="flex items-center gap-4 text-xs">
                <label className="flex items-center gap-1.5 font-semibold">
                  Bg <input type="color" value={cfg.ctaBanner.bgColor} onChange={(e) => setCfg({ ...cfg, ctaBanner: { ...cfg.ctaBanner, bgColor: e.target.value } })} />
                </label>
                <label className="flex items-center gap-1.5 font-semibold">
                  Text <input type="color" value={cfg.ctaBanner.textColor} onChange={(e) => setCfg({ ...cfg, ctaBanner: { ...cfg.ctaBanner, textColor: e.target.value } })} />
                </label>
              </div>
            </div>
          )}

          {/* 10. PRICING MATRIX */}
          {target.section === 'pricingMatrix' && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <div>
                  <label className="text-xs font-bold block mb-1">Currency</label>
                  <input
                    value={cfg.pricing.currency}
                    onChange={(e) => setCfg({ ...cfg, pricing: { ...cfg.pricing, currency: e.target.value } })}
                    className="w-full px-3 py-2 border border-[#d9dbe1] rounded-lg text-sm"
                  />
                </div>
                <div>
                  <label className="text-xs font-bold block mb-1">GST (%)</label>
                  <input
                    type="number"
                    min={0}
                    max={50}
                    value={Math.round(cfg.pricing.gst * 100)}
                    onChange={(e) => setCfg({ ...cfg, pricing: { ...cfg.pricing, gst: Number(e.target.value) / 100 } })}
                    className="w-full px-3 py-2 border border-[#d9dbe1] rounded-lg text-sm"
                  />
                </div>
                <div>
                  <label className="text-xs font-bold block mb-1">Min Payout ({cfg.pricing.currency})</label>
                  <input
                    type="number"
                    min={1}
                    value={cfg.pricing.payoutMin}
                    onChange={(e) => setCfg({ ...cfg, pricing: { ...cfg.pricing, payoutMin: Number(e.target.value) } })}
                    className="w-full px-3 py-2 border border-[#d9dbe1] rounded-lg text-sm"
                  />
                </div>
                <div>
                  <label className="text-xs font-bold block mb-1">RF Royalty (%)</label>
                  <input
                    type="number"
                    min={1}
                    max={95}
                    value={Math.round(cfg.pricing.royalty.rf * 100)}
                    onChange={(e) => setCfg({ ...cfg, pricing: { ...cfg.pricing, royalty: { ...cfg.pricing.royalty, rf: Number(e.target.value) / 100 } } })}
                    className="w-full px-3 py-2 border border-[#d9dbe1] rounded-lg text-sm"
                  />
                </div>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-sm border-collapse">
                  <thead>
                    <tr className="border-b border-[#d9dbe1] text-left text-xs uppercase text-[#5c6170]">
                      <th className="py-2 pr-2">License</th>
                      {cfg.pricing.sizes.map((s) => (
                        <th key={s.k} className="py-2 px-2">{s.n} ({cfg.pricing.currency})</th>
                      ))}
                      <th className="py-2 pl-2">Credits</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(['std', 'ext', 'ed'] as LicenseOptionKey[]).map((lk) => (
                      <tr key={lk} className="border-b border-[#e5e8ef]">
                        <td className="py-2 pr-2 font-semibold">{cfg.pricing.licMeta[lk].n}</td>
                        {(['S', 'M', 'L'] as SizeKey[]).map((sk) => (
                          <td key={sk} className="py-2 px-1.5">
                            <input
                              type="number"
                              min={1}
                              value={cfg.pricing.matrix[lk][sk]}
                              onChange={(e) =>
                                setCfg({
                                  ...cfg,
                                  pricing: {
                                    ...cfg.pricing,
                                    matrix: {
                                      ...cfg.pricing.matrix,
                                      [lk]: { ...cfg.pricing.matrix[lk], [sk]: Number(e.target.value) },
                                    },
                                  },
                                })
                              }
                              className="w-20 px-2 py-1.5 border border-[#d9dbe1] rounded-lg text-sm tabular-nums"
                            />
                          </td>
                        ))}
                        <td className="py-2 pl-1.5">
                          <input
                            type="number"
                            min={1}
                            value={cfg.pricing.licMeta[lk].cr}
                            onChange={(e) =>
                              setCfg({
                                ...cfg,
                                pricing: {
                                  ...cfg.pricing,
                                  licMeta: {
                                    ...cfg.pricing.licMeta,
                                    [lk]: { ...cfg.pricing.licMeta[lk], cr: Number(e.target.value) },
                                  },
                                },
                              })
                            }
                            className="w-16 px-2 py-1.5 border border-[#d9dbe1] rounded-lg text-sm tabular-nums"
                          />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* 11. SUBSCRIPTION PLANS */}
          {target.section === 'plans' && (
            <div className="space-y-3">
              {cfg.pricing.plans.map((p, i) => (
                <div key={p.id} className="p-3.5 border border-[#dbe3ef] rounded-xl space-y-2 bg-[#f9fbff]">
                  <div className="grid grid-cols-[1fr_100px_100px_auto] gap-2 items-center">
                    <input
                      value={p.n}
                      onChange={(e) => {
                        const next = [...cfg.pricing.plans];
                        next[i] = { ...next[i], n: e.target.value };
                        setCfg({ ...cfg, pricing: { ...cfg.pricing, plans: next } });
                      }}
                      placeholder="Plan Name"
                      className="px-3 py-1.5 border border-[#d9dbe1] rounded-lg text-sm font-bold"
                    />
                    <input
                      type="number"
                      min={1}
                      value={p.p}
                      onChange={(e) => {
                        const next = [...cfg.pricing.plans];
                        next[i] = { ...next[i], p: Number(e.target.value) };
                        setCfg({ ...cfg, pricing: { ...cfg.pricing, plans: next } });
                      }}
                      placeholder="Price"
                      className="px-2 py-1.5 border border-[#d9dbe1] rounded-lg text-sm"
                    />
                    <input
                      type="number"
                      min={1}
                      value={p.cr}
                      onChange={(e) => {
                        const next = [...cfg.pricing.plans];
                        next[i] = { ...next[i], cr: Number(e.target.value) };
                        setCfg({ ...cfg, pricing: { ...cfg.pricing, plans: next } });
                      }}
                      placeholder="Credits"
                      className="px-2 py-1.5 border border-[#d9dbe1] rounded-lg text-sm"
                    />
                    <button
                      type="button"
                      onClick={() => setCfg({ ...cfg, pricing: { ...cfg.pricing, plans: cfg.pricing.plans.filter((_, idx) => idx !== i) } })}
                      className="p-1.5 text-red-600 cursor-pointer"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                  <div className="flex items-center gap-3">
                    <input
                      value={p.d}
                      onChange={(e) => {
                        const next = [...cfg.pricing.plans];
                        next[i] = { ...next[i], d: e.target.value };
                        setCfg({ ...cfg, pricing: { ...cfg.pricing, plans: next } });
                      }}
                      placeholder="Description"
                      className="flex-1 px-3 py-1.5 border border-[#d9dbe1] rounded-lg text-xs"
                    />
                    <label className="text-xs font-semibold flex items-center gap-1 whitespace-nowrap">
                      <input
                        type="checkbox"
                        checked={!!p.hot}
                        onChange={(e) => {
                          const next = [...cfg.pricing.plans];
                          next[i] = { ...next[i], hot: e.target.checked };
                          setCfg({ ...cfg, pricing: { ...cfg.pricing, plans: next } });
                        }}
                      />
                      Popular
                    </label>
                  </div>
                </div>
              ))}
              <button
                type="button"
                onClick={() =>
                  setCfg({
                    ...cfg,
                    pricing: {
                      ...cfg.pricing,
                      plans: [...cfg.pricing.plans, { id: 'plan-' + Date.now(), n: 'Basic', cr: 5, p: 49, d: '5 downloads / month' }],
                    },
                  })
                }
                className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-[#eef3fb] text-[#011f43] text-sm font-bold cursor-pointer"
              >
                <Plus className="w-4 h-4" /> Add Plan
              </button>
            </div>
          )}

          {/* 12. CREDIT PACKS */}
          {target.section === 'packs' && (
            <div className="space-y-3">
              {cfg.pricing.packs.map((pk, i) => (
                <div key={pk.id} className="grid grid-cols-[1fr_1fr_auto] gap-2.5 items-center">
                  <div>
                    <label className="text-[11px] text-[#5c6170] block">Credits</label>
                    <input
                      type="number"
                      min={1}
                      value={pk.cr}
                      onChange={(e) => {
                        const next = [...cfg.pricing.packs];
                        next[i] = { ...next[i], cr: Number(e.target.value) };
                        setCfg({ ...cfg, pricing: { ...cfg.pricing, packs: next } });
                      }}
                      className="w-full px-3 py-2 border border-[#d9dbe1] rounded-lg text-sm"
                    />
                  </div>
                  <div>
                    <label className="text-[11px] text-[#5c6170] block">Price ({cfg.pricing.currency})</label>
                    <input
                      type="number"
                      min={1}
                      value={pk.p}
                      onChange={(e) => {
                        const next = [...cfg.pricing.packs];
                        next[i] = { ...next[i], p: Number(e.target.value) };
                        setCfg({ ...cfg, pricing: { ...cfg.pricing, packs: next } });
                      }}
                      className="w-full px-3 py-2 border border-[#d9dbe1] rounded-lg text-sm"
                    />
                  </div>
                  <button
                    type="button"
                    onClick={() => setCfg({ ...cfg, pricing: { ...cfg.pricing, packs: cfg.pricing.packs.filter((_, idx) => idx !== i) } })}
                    className="p-2 text-red-600 mt-4 cursor-pointer"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              ))}
              <button
                type="button"
                onClick={() =>
                  setCfg({
                    ...cfg,
                    pricing: { ...cfg.pricing, packs: [...cfg.pricing.packs, { id: 'pk-' + Date.now(), cr: 10, p: 119 }] },
                  })
                }
                className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-[#eef3fb] text-[#011f43] text-sm font-bold cursor-pointer"
              >
                <Plus className="w-4 h-4" /> Add Credit Pack
              </button>
            </div>
          )}

          {/* 13. LICENSE ROWS */}
          {target.section === 'licenseRows' && (
            <div className="space-y-2.5">
              {cfg.licenseRows.map((row, i) => (
                <div key={row.id} className="grid grid-cols-[1.5fr_1fr_1fr_1fr_auto] gap-1.5 items-center">
                  <input value={row.use} onChange={(e) => { const n = [...cfg.licenseRows]; n[i] = { ...n[i], use: e.target.value }; setCfg({ ...cfg, licenseRows: n }); }} className="px-2 py-1.5 border border-[#d9dbe1] rounded text-xs" />
                  <input value={row.std} onChange={(e) => { const n = [...cfg.licenseRows]; n[i] = { ...n[i], std: e.target.value }; setCfg({ ...cfg, licenseRows: n }); }} className="px-2 py-1.5 border border-[#d9dbe1] rounded text-xs" />
                  <input value={row.ext} onChange={(e) => { const n = [...cfg.licenseRows]; n[i] = { ...n[i], ext: e.target.value }; setCfg({ ...cfg, licenseRows: n }); }} className="px-2 py-1.5 border border-[#d9dbe1] rounded text-xs" />
                  <input value={row.ed} onChange={(e) => { const n = [...cfg.licenseRows]; n[i] = { ...n[i], ed: e.target.value }; setCfg({ ...cfg, licenseRows: n }); }} className="px-2 py-1.5 border border-[#d9dbe1] rounded text-xs" />
                  <button type="button" onClick={() => setCfg({ ...cfg, licenseRows: cfg.licenseRows.filter((_, idx) => idx !== i) })} className="p-1 text-red-600 cursor-pointer"><Trash2 className="w-4 h-4" /></button>
                </div>
              ))}
              <button
                type="button"
                onClick={() => setCfg({ ...cfg, licenseRows: [...cfg.licenseRows, { id: 'lr-' + Date.now(), use: 'New usage right', std: '✓', ext: '✓', ed: '✕' }] })}
                className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-[#eef3fb] text-[#011f43] text-sm font-bold cursor-pointer"
              >
                <Plus className="w-4 h-4" /> Add License Row
              </button>
            </div>
          )}

          {/* 14. FAQs */}
          {target.section === 'faqs' && (
            <div className="space-y-3">
              {cfg.faqs.map((fq, i) => (
                <div key={fq.id} className="p-3 border border-[#dbe3ef] rounded-xl space-y-2 bg-[#f9fbff]">
                  <div className="flex items-center gap-2">
                    <input
                      value={fq.q}
                      onChange={(e) => { const n = [...cfg.faqs]; n[i] = { ...n[i], q: e.target.value }; setCfg({ ...cfg, faqs: n }); }}
                      placeholder="Question"
                      className="flex-1 px-3 py-1.5 border border-[#d9dbe1] rounded-lg text-sm font-semibold"
                    />
                    <button type="button" onClick={() => setCfg({ ...cfg, faqs: cfg.faqs.filter((_, idx) => idx !== i) })} className="p-1.5 text-red-600 cursor-pointer">
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                  <textarea
                    rows={2}
                    value={fq.a}
                    onChange={(e) => { const n = [...cfg.faqs]; n[i] = { ...n[i], a: e.target.value }; setCfg({ ...cfg, faqs: n }); }}
                    placeholder="Answer"
                    className="w-full px-3 py-1.5 border border-[#d9dbe1] rounded-lg text-sm"
                  />
                </div>
              ))}
              <button
                type="button"
                onClick={() => setCfg({ ...cfg, faqs: [...cfg.faqs, { id: 'fq-' + Date.now(), q: 'New question?', a: 'Write answer here.' }] })}
                className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-[#eef3fb] text-[#011f43] text-sm font-bold cursor-pointer"
              >
                <Plus className="w-4 h-4" /> Add FAQ
              </button>
            </div>
          )}

          {/* 15. INFO PAGES */}
          {(target.section === 'pageAbout' || target.section === 'pagePrivacy' || target.section === 'pageRefund') && (() => {
            const pk = target.section === 'pageAbout' ? 'about' : target.section === 'pagePrivacy' ? 'privacy' : 'refund';
            return (
              <div className="space-y-3">
                <div>
                  <label className="text-xs font-bold block mb-1">Page Title</label>
                  <input
                    value={cfg.pages[pk].title}
                    onChange={(e) => setCfg({ ...cfg, pages: { ...cfg.pages, [pk]: { ...cfg.pages[pk], title: e.target.value } } })}
                    className="w-full px-3 py-2 border border-[#d9dbe1] rounded-lg text-sm font-semibold"
                  />
                </div>
                <div>
                  <label className="text-xs font-bold block mb-1">Page Body Content</label>
                  <textarea
                    rows={7}
                    value={cfg.pages[pk].body}
                    onChange={(e) => setCfg({ ...cfg, pages: { ...cfg.pages, [pk]: { ...cfg.pages[pk], body: e.target.value } } })}
                    className="w-full px-3 py-2 border border-[#d9dbe1] rounded-lg text-sm"
                  />
                </div>
              </div>
            );
          })()}

          {/* 16. TERMS */}
          {target.section === 'pageTerms' && (
            <div className="space-y-3">
              <input
                value={cfg.pages.terms.title}
                onChange={(e) => setCfg({ ...cfg, pages: { ...cfg.pages, terms: { ...cfg.pages.terms, title: e.target.value } } })}
                className="w-full px-3 py-2 border border-[#d9dbe1] rounded-lg text-sm font-bold"
              />
              {cfg.pages.terms.sections.map((s, i) => (
                <div key={s.id} className="p-3 border border-[#dbe3ef] rounded-xl space-y-2">
                  <div className="flex gap-2">
                    <input
                      value={s.heading}
                      onChange={(e) => { const n = [...cfg.pages.terms.sections]; n[i] = { ...n[i], heading: e.target.value }; setCfg({ ...cfg, pages: { ...cfg.pages, terms: { ...cfg.pages.terms, sections: n } } }); }}
                      className="flex-1 px-2.5 py-1.5 border border-[#d9dbe1] rounded text-sm font-semibold"
                    />
                    <button type="button" onClick={() => setCfg({ ...cfg, pages: { ...cfg.pages, terms: { ...cfg.pages.terms, sections: cfg.pages.terms.sections.filter((_, idx) => idx !== i) } } })} className="text-red-600 p-1 cursor-pointer">
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                  <textarea
                    rows={2}
                    value={s.content}
                    onChange={(e) => { const n = [...cfg.pages.terms.sections]; n[i] = { ...n[i], content: e.target.value }; setCfg({ ...cfg, pages: { ...cfg.pages, terms: { ...cfg.pages.terms, sections: n } } }); }}
                    className="w-full px-2.5 py-1.5 border border-[#d9dbe1] rounded text-sm"
                  />
                </div>
              ))}
              <button
                type="button"
                onClick={() => setCfg({ ...cfg, pages: { ...cfg.pages, terms: { ...cfg.pages.terms, sections: [...cfg.pages.terms.sections, { id: 'ts-' + Date.now(), heading: 'New Clause', content: 'Clause text...' }] } } })}
                className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-[#eef3fb] text-[#011f43] text-sm font-bold cursor-pointer"
              >
                <Plus className="w-4 h-4" /> Add Clause
              </button>
            </div>
          )}

          {/* 17. CONTACT */}
          {target.section === 'contact' && (
            <div className="space-y-3">
              <div>
                <label className="text-xs font-bold block mb-1">Support Email</label>
                <input value={cfg.contact.email} onChange={(e) => setCfg({ ...cfg, contact: { ...cfg.contact, email: e.target.value } })} className="w-full px-3 py-2 border border-[#d9dbe1] rounded-lg text-sm" />
              </div>
              <div>
                <label className="text-xs font-bold block mb-1">Location / Address</label>
                <input value={cfg.contact.location} onChange={(e) => setCfg({ ...cfg, contact: { ...cfg.contact, location: e.target.value } })} className="w-full px-3 py-2 border border-[#d9dbe1] rounded-lg text-sm" />
              </div>
              <div>
                <label className="text-xs font-bold block mb-1">Organisation / Venture</label>
                <input value={cfg.contact.venture} onChange={(e) => setCfg({ ...cfg, contact: { ...cfg.contact, venture: e.target.value } })} className="w-full px-3 py-2 border border-[#d9dbe1] rounded-lg text-sm" />
              </div>
            </div>
          )}

          {/* 18. FOOTER */}
          {target.section === 'footer' && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-bold block mb-1">Newsletter Heading</label>
                  <input value={cfg.footer.newsletterTitle} onChange={(e) => setCfg({ ...cfg, footer: { ...cfg.footer, newsletterTitle: e.target.value } })} className="w-full px-3 py-2 border border-[#d9dbe1] rounded-lg text-sm" />
                </div>
                <div>
                  <label className="text-xs font-bold block mb-1">Newsletter Subtitle</label>
                  <input value={cfg.footer.newsletterSubtitle} onChange={(e) => setCfg({ ...cfg, footer: { ...cfg.footer, newsletterSubtitle: e.target.value } })} className="w-full px-3 py-2 border border-[#d9dbe1] rounded-lg text-sm" />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-bold block mb-1">Contact Email</label>
                  <input value={cfg.contact.email} onChange={(e) => setCfg({ ...cfg, contact: { ...cfg.contact, email: e.target.value } })} className="w-full px-3 py-2 border border-[#d9dbe1] rounded-lg text-sm" />
                </div>
                <div>
                  <label className="text-xs font-bold block mb-1">Location</label>
                  <input value={cfg.contact.location} onChange={(e) => setCfg({ ...cfg, contact: { ...cfg.contact, location: e.target.value } })} className="w-full px-3 py-2 border border-[#d9dbe1] rounded-lg text-sm" />
                </div>
              </div>
              <div>
                <label className="text-xs font-bold block mb-1">Footer Tagline</label>
                <input value={cfg.footer.taglineCustom || ''} onChange={(e) => setCfg({ ...cfg, footer: { ...cfg.footer, taglineCustom: e.target.value } })} placeholder="Marketplace tagline..." className="w-full px-3 py-2 border border-[#d9dbe1] rounded-lg text-sm" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-bold block mb-1">Bottom Made-With Text</label>
                  <input value={cfg.footer.madeWith} onChange={(e) => setCfg({ ...cfg, footer: { ...cfg.footer, madeWith: e.target.value } })} className="w-full px-3 py-2 border border-[#d9dbe1] rounded-lg text-sm" />
                </div>
                <div>
                  <label className="text-xs font-bold block mb-1">Rights Text</label>
                  <input value={cfg.footer.rights} onChange={(e) => setCfg({ ...cfg, footer: { ...cfg.footer, rights: e.target.value } })} className="w-full px-3 py-2 border border-[#d9dbe1] rounded-lg text-sm" />
                </div>
              </div>
              <div className="space-y-3 pt-2 border-t border-[#e5e8ef]">
                <div className="text-xs font-bold uppercase text-[#5c6170]">Footer Link Columns</div>
                {cfg.footer.columns.map((col, ci) => (
                  <div key={col.id} className="p-3 border border-[#dbe3ef] rounded-xl space-y-2 bg-[#f9fbff]">
                    <input
                      value={col.heading}
                      onChange={(e) => {
                        const cols = [...cfg.footer.columns];
                        cols[ci] = { ...cols[ci], heading: e.target.value };
                        setCfg({ ...cfg, footer: { ...cfg.footer, columns: cols } });
                      }}
                      className="font-bold text-sm px-2.5 py-1 border border-[#d9dbe1] rounded"
                    />
                    {col.links.map((lk, li) => (
                      <div key={lk.id} className="grid grid-cols-[1fr_1fr_auto] gap-1.5">
                        <input
                          value={lk.label}
                          onChange={(e) => {
                            const cols = [...cfg.footer.columns];
                            const links = [...cols[ci].links];
                            links[li] = { ...links[li], label: e.target.value };
                            cols[ci] = { ...cols[ci], links };
                            setCfg({ ...cfg, footer: { ...cfg.footer, columns: cols } });
                          }}
                          className="px-2 py-1 border border-[#d9dbe1] rounded text-xs"
                        />
                        <input
                          value={lk.href}
                          onChange={(e) => {
                            const cols = [...cfg.footer.columns];
                            const links = [...cols[ci].links];
                            links[li] = { ...links[li], href: e.target.value };
                            cols[ci] = { ...cols[ci], links };
                            setCfg({ ...cfg, footer: { ...cfg.footer, columns: cols } });
                          }}
                          className="px-2 py-1 border border-[#d9dbe1] rounded text-xs font-mono"
                        />
                        <button
                          type="button"
                          onClick={() => {
                            const cols = [...cfg.footer.columns];
                            cols[ci] = { ...cols[ci], links: cols[ci].links.filter((_, idx) => idx !== li) };
                            setCfg({ ...cfg, footer: { ...cfg.footer, columns: cols } });
                          }}
                          className="text-red-600 p-1 cursor-pointer"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    ))}
                    <button
                      type="button"
                      onClick={() => {
                        const cols = [...cfg.footer.columns];
                        cols[ci] = { ...cols[ci], links: [...cols[ci].links, { id: 'fl-' + Date.now(), label: 'New Link', href: '#/' }] };
                        setCfg({ ...cfg, footer: { ...cfg.footer, columns: cols } });
                      }}
                      className="text-xs font-bold text-[#011f43] inline-flex items-center gap-1 cursor-pointer"
                    >
                      <Plus className="w-3 h-3" /> Add Link
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* 19. CATEGORIES */}
          {target.section === 'categories' && (
            <div className="space-y-3">
              <div className="flex gap-2">
                <input
                  value={newCatInput}
                  onChange={(e) => setNewCatInput(e.target.value)}
                  placeholder="Add new category (e.g. Festival, Music)"
                  className="flex-1 px-3 py-2 border border-[#d9dbe1] rounded-lg text-sm"
                />
                <button
                  type="button"
                  onClick={() => {
                    const v = newCatInput.trim();
                    if (!v) return;
                    if (!cfg.settings.customCategories.includes(v)) {
                      setCfg({ ...cfg, settings: { ...cfg.settings, customCategories: [...cfg.settings.customCategories, v] } });
                    }
                    setNewCatInput('');
                  }}
                  className="px-4 py-2 rounded-lg bg-[#011f43] text-white text-sm font-bold cursor-pointer"
                >
                  Add
                </button>
              </div>
              <div className="flex flex-wrap gap-2">
                {cfg.settings.customCategories.map((c) => (
                  <span key={c} className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-[#eef3fb] text-[#011f43] text-xs font-bold">
                    {c}
                    <button
                      type="button"
                      onClick={() => setCfg({ ...cfg, settings: { ...cfg.settings, customCategories: cfg.settings.customCategories.filter((x) => x !== c) } })}
                      className="text-red-600 cursor-pointer"
                    >
                      ✕
                    </button>
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* 20. ADD / EDIT PHOTO */}
          {(target.section === 'addPhoto' || target.section === 'editPhoto') && (
            <form id="admin-photo-form" onSubmit={handlePhotoSubmit} className="space-y-3">
              <div className="flex items-center gap-4">
                {(uploadedImg?.prevUrl || (existingPhoto && thumbUrl(existingPhoto, 300))) ? (
                  <img
                    src={uploadedImg?.prevUrl || (existingPhoto ? thumbUrl(existingPhoto, 300) : '')}
                    alt="Preview"
                    className="w-28 h-20 object-cover rounded-lg border border-[#d9dbe1]"
                  />
                ) : (
                  <div className="w-28 h-20 rounded-lg border-2 border-dashed border-[#c5cfe0] flex items-center justify-center text-xs text-[#5c6170]">
                    No image
                  </div>
                )}
                <label className="inline-flex items-center gap-2 px-3.5 py-2 rounded-lg border border-[#c5cfe0] bg-[#f8faff] text-xs font-bold text-[#011f43] cursor-pointer hover:bg-[#eef3fb]">
                  <Upload className="w-4 h-4" />
                  {existingPhoto ? 'Replace Image (optional)' : 'Choose Photo File'}
                  <input
                    type="file"
                    accept="image/*"
                    hidden
                    onChange={async (e) => {
                      const f = e.target.files?.[0];
                      if (!f) return;
                      try {
                        const res = await resizeImageFile(f);
                        setUploadedImg(res);
                        toast(`Image ready (${res.w}×${res.h}px)`);
                      } catch {
                        toast('Failed to read image');
                      }
                    }}
                  />
                </label>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-bold block mb-1">Photo Title</label>
                  <input required value={photoTitle} onChange={(e) => setPhotoTitle(e.target.value)} className="w-full px-3 py-2 border border-[#d9dbe1] rounded-lg text-sm" />
                </div>
                <div>
                  <label className="text-xs font-bold block mb-1">Category</label>
                  <input required list="adm-cats" value={photoCat} onChange={(e) => setPhotoCat(e.target.value)} className="w-full px-3 py-2 border border-[#d9dbe1] rounded-lg text-sm" />
                  <datalist id="adm-cats">
                    {allCats.map((c) => <option key={c} value={c} />)}
                  </datalist>
                </div>
              </div>
              <div>
                <label className="text-xs font-bold block mb-1">Description</label>
                <textarea rows={2} value={photoDesc} onChange={(e) => setPhotoDesc(e.target.value)} className="w-full px-3 py-2 border border-[#d9dbe1] rounded-lg text-sm" />
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-bold block mb-1">Assign Account (Owner)</label>
                  <select
                    value={photoOwner}
                    onChange={(e) => {
                      setPhotoOwner(e.target.value);
                      const found = users.find((u) => u.email === e.target.value);
                      if (found) setPhotoContributor(found.name);
                    }}
                    className="w-full px-3 py-2 border border-[#d9dbe1] rounded-lg text-sm bg-white"
                  >
                    <option value="seed">-- Seed / Custom --</option>
                    {users.map((u) => (
                      <option key={u.email} value={u.email}>{u.name} ({u.email})</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="text-xs font-bold block mb-1">Contributor Display Name</label>
                  <input required value={photoContributor} onChange={(e) => setPhotoContributor(e.target.value)} className="w-full px-3 py-2 border border-[#d9dbe1] rounded-lg text-sm" />
                </div>
              </div>
              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="text-xs font-bold block mb-1">License</label>
                  <select value={photoLic} onChange={(e) => setPhotoLic(e.target.value as 'rf' | 'editorial')} className="w-full px-2.5 py-2 border border-[#d9dbe1] rounded-lg text-sm bg-white">
                    <option value="rf">Royalty-Free</option>
                    <option value="editorial">Editorial</option>
                  </select>
                </div>
                <div>
                  <label className="text-xs font-bold block mb-1">Status</label>
                  <select value={photoStatus} onChange={(e) => setPhotoStatus(e.target.value as 'approved' | 'pending' | 'rejected')} className="w-full px-2.5 py-2 border border-[#d9dbe1] rounded-lg text-sm bg-white">
                    <option value="approved">Approved</option>
                    <option value="pending">Pending</option>
                    <option value="rejected">Rejected</option>
                  </select>
                </div>
                <div>
                  <label className="text-xs font-bold block mb-1">Location</label>
                  <input value={photoPlace} onChange={(e) => setPhotoPlace(e.target.value)} placeholder="Godda, JH" className="w-full px-2.5 py-2 border border-[#d9dbe1] rounded-lg text-sm" />
                </div>
              </div>
              <div>
                <label className="text-xs font-bold block mb-1">Editorial Caption (if Editorial)</label>
                <input value={photoCaption} onChange={(e) => setPhotoCaption(e.target.value)} className="w-full px-3 py-2 border border-[#d9dbe1] rounded-lg text-sm" />
              </div>
              <div>
                <label className="text-xs font-bold block mb-1">Keywords (comma separated)</label>
                <input required value={photoKw} onChange={(e) => setPhotoKw(e.target.value)} placeholder="village, festival, santal, culture, art" className="w-full px-3 py-2 border border-[#d9dbe1] rounded-lg text-sm" />
              </div>
            </form>
          )}
        </div>

        <div className="px-6 py-3.5 border-t border-[#e5e8ef] bg-[#f8faff] flex items-center justify-between gap-3">
          {target.section === 'editPhoto' && existingPhoto ? (
            <button
              type="button"
              onClick={async () => {
                if (!window.confirm('Delete this photo permanently?')) return;
                await onDeletePhoto(existingPhoto.id);
                onClose();
              }}
              className="px-4 py-2 rounded-lg bg-red-50 text-red-700 border border-red-200 text-sm font-bold inline-flex items-center gap-1.5 cursor-pointer"
            >
              <Trash2 className="w-4 h-4" /> Delete Photo
            </button>
          ) : (
            <span className="text-xs text-[#5c6170]">Changes save live to SantalStock server.</span>
          )}
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-lg border border-[#d9dbe1] bg-white text-[#011f43] text-sm font-semibold cursor-pointer"
            >
              Cancel
            </button>
            {target.section === 'addPhoto' || target.section === 'editPhoto' ? (
              <button
                type="submit"
                form="admin-photo-form"
                disabled={saving}
                className="px-5 py-2 rounded-lg bg-[#17803d] text-white text-sm font-bold inline-flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
              >
                <Save className="w-4 h-4" /> {saving ? 'Saving...' : existingPhoto ? 'Update Photo' : 'Add & Publish'}
              </button>
            ) : (
              <button
                type="button"
                disabled={saving}
                onClick={saveCms}
                className="px-5 py-2 rounded-lg bg-[#17803d] text-white text-sm font-bold inline-flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
              >
                <Save className="w-4 h-4" /> {saving ? 'Saving...' : 'Save Changes'}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
