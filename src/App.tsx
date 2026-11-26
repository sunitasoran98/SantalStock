import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Plus, Pencil, Mic, Sparkles, CheckCircle2, Mail, ShieldCheck } from 'lucide-react';
import {
  aiRunSearch,
  DEFAULT_SITE_CONFIG,
  LIDX,
  orientOf,
  SEED_ASSETS,
  thumbUrl,
  tr,
} from './data/defaults';
import { api, getToken, setToken } from './lib/api';
import { Header } from './components/Header';
import { Footer } from './components/Footer';
import { SearchCapsule } from './components/SearchCapsule';
import { PhotoTile } from './components/PhotoTile';
import { TextReader } from './components/TextReader';
import type { AuthPortal } from './lib/portals';
const AuthModal = React.lazy(() => import('./components/AuthModal').then((m) => ({ default: m.AuthModal })));
import { AdminEditable } from './components/AdminEditable';
const AdminEditModal = React.lazy(() => import('./components/AdminEditModal').then((m) => ({ default: m.AdminEditModal })));
import { AdminDock } from './components/AdminDock';
const AssetDetailPage = React.lazy(() => import('./pages/ShopPages').then((m) => ({ default: m.AssetDetailPage })));
const CartCheckoutPage = React.lazy(() => import('./pages/ShopPages').then((m) => ({ default: m.CartCheckoutPage })));
const OrderCertInvoicePage = React.lazy(() => import('./pages/ShopPages').then((m) => ({ default: m.OrderCertInvoicePage })));
const downloadFullAsset: typeof import('./pages/ShopPages').downloadFullAsset = (...a) => import('./pages/ShopPages').then((m) => m.downloadFullAsset(...a));
const AdminDashboard = React.lazy(() => import('./pages/ContributorAndAdminPages').then((m) => ({ default: m.AdminDashboard })));
const ContributorPage = React.lazy(() => import('./pages/ContributorAndAdminPages').then((m) => ({ default: m.ContributorPage })));
import type {
  AdminEditTarget,
  Asset,
  CartItem,
  LangCode,
  LicenseOptionKey,
  Order,
  Payout,
  SiteConfig,
  User,
} from './types';

function parseHash() {
  const raw = window.location.hash.replace(/^#\/?/, '');
  const [pathPart, queryPart = ''] = raw.split('?');
  const segs = pathPart ? pathPart.split('/').map((s) => decodeURIComponent(s)) : [''];
  const params = new URLSearchParams(queryPart);
  return { page: segs[0] || '', args: segs.slice(1), params };
}

export default function App() {
  const [route, setRoute] = useState(parseHash);
  const [lang, setLang] = useState<LangCode>(() => {
    try {
      const saved = localStorage.getItem('ss_lang') as LangCode | null;
      return saved && ['satr', 'satd', 'hi', 'en'].includes(saved) ? saved : 'hi';
    } catch {
      return 'hi';
    }
  });
  const [dark, setDark] = useState<boolean>(() => {
    try {
      return Boolean(localStorage.getItem('ss_dark'));
    } catch {
      return false;
    }
  });
  const [fontSizeStep, setFontSizeStep] = useState<number>(() => {
    try {
      return Number(localStorage.getItem('ss_fs') || 0) % 3;
    } catch {
      return 0;
    }
  });

  const [siteConfig, setSiteConfig] = useState<SiteConfig>(DEFAULT_SITE_CONFIG);
  const [assets, setAssets] = useState<Asset[]>(SEED_ASSETS);
  const [user, setUser] = useState<User | null>(() => {
    // Show the logged-in screen instantly after a reload; the server confirms it a moment later.
    try {
      if (!getToken()) return null;
      const raw = localStorage.getItem('ss_user_cache_v1');
      return raw ? (JSON.parse(raw) as User) : null;
    } catch {
      return null;
    }
  });
  useEffect(() => {
    try {
      if (user) localStorage.setItem('ss_user_cache_v1', JSON.stringify(user));
      else localStorage.removeItem('ss_user_cache_v1');
    } catch {
      // ignore
    }
  }, [user]);
  const [orders, setOrders] = useState<Order[]>([]);
  const [payouts, setPayouts] = useState<Payout[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [messages, setMessages] = useState<import('./types').ContactMessage[]>([]);
  const [dlCounts, setDlCounts] = useState<Record<string, number>>({});
  const [cart, setCart] = useState<CartItem[]>(() => {
    try {
      return JSON.parse(localStorage.getItem('ss_cart_v1') || '[]');
    } catch {
      return [];
    }
  });
  const [lightbox, setLightbox] = useState<Record<string, string[]>>(() => {
    try {
      return JSON.parse(localStorage.getItem('ss_lb_v1') || '{"Favorites":[]}');
    } catch {
      return { Favorites: [] };
    }
  });

  const [authModal, setAuthModal] = useState<'login' | 'register' | null>(null);
  const [authPortal, setAuthPortal] = useState<AuthPortal>('buyer');
  const [adminMode, setAdminMode] = useState(false);
  const [adminEditTarget, setAdminEditTarget] = useState<AdminEditTarget | null>(null);
  const [toastMsg, setToastMsg] = useState<string>('');
  const [readerSpeech, setReaderSpeech] = useState<{ id: number; text: string } | null>(null);

  // Verify License state
  const [verifyInput, setVerifyInput] = useState('');
  const [verifyRes, setVerifyRes] = useState<{ valid: boolean; checked: boolean; license?: { key: string; lic: LicenseOptionKey; assetId: string; title: string; licensee: string; date: string } }>({ valid: false, checked: false });

  // AI search input state
  const [aiInput, setAiInput] = useState('');
  const [aiListening, setAiListening] = useState(false);

  // Account profile form state
  const [profName, setProfName] = useState('');
  const [profCompany, setProfCompany] = useState('');
  const [profGstin, setProfGstin] = useState('');
  const [profRole, setProfRole] = useState<'buyer' | 'contributor'>('buyer');

  // Contact form state
  const [cName, setCName] = useState('');
  const [cEmail, setCEmail] = useState('');
  const [cMsg, setCMsg] = useState('');

  const toast = useCallback((m: string) => {
    setToastMsg(m);
    window.setTimeout(() => {
      setToastMsg((cur) => (cur === m ? '' : cur));
    }, 2800);
  }, []);

  const fetchState = useCallback(async () => {
    try {
      const data = await api<{
        user: User | null;
        tokenStatus?: 'none' | 'ok' | 'pending' | 'invalid';
        siteConfig: SiteConfig;
        assets: Asset[];
        orders: Order[];
        payouts: Payout[];
        users: User[];
        lightbox: Record<string, string[]> | null;
        dlCounts: Record<string, number>;
        messages: { id: string; name: string; email: string; message: string; date: string }[];
      }>('/api/state');
      setSiteConfig(data.siteConfig);
      setAssets(data.assets);
      // Log out only when the server clearly says the token is invalid (logout, password reset,
      // deleted account). A busy server, offline mode or a KV sync delay keeps the admin logged in.
      const keepLogin = !data.user && !!getToken() && data.tokenStatus !== 'invalid';
      if (!keepLogin) setUser(data.user);
      if (!data.user && getToken() && data.tokenStatus === 'invalid') setToken('');
      setOrders(data.orders || []);
      setPayouts(data.payouts || []);
      setUsers(data.users || []);
      setDlCounts(data.dlCounts || {});
      setMessages(data.messages || []);
      if (data.lightbox) setLightbox(data.lightbox);
      if (data.user) {
        setProfName(data.user.name);
        setProfCompany(data.user.company || '');
        setProfGstin(data.user.gstin || '');
        setProfRole(data.user.role === 'contributor' ? 'contributor' : 'buyer');
      } else if (!keepLogin) {
        setAdminMode(false);
      }
    } catch {
      // Keep local defaults if server unreachable momentarily
    }
  }, []);

  useEffect(() => {
    fetchState();
  }, [fetchState]);

  useEffect(() => {
    const onHash = () => {
      setRoute(parseHash());
      window.scrollTo(0, 0);
    };
    window.addEventListener('hashchange', onHash);
    return () => window.removeEventListener('hashchange', onHash);
  }, []);

  useEffect(() => {
    document.documentElement.classList.toggle('dark', dark);
    try {
      localStorage.setItem('ss_dark', dark ? '1' : '');
    } catch {
      // ignore
    }
  }, [dark]);

  useEffect(() => {
    const z = [1, 1.12, 1.25][fontSizeStep] || 1;
    document.documentElement.style.zoom = z === 1 ? '' : String(z);
    try {
      localStorage.setItem('ss_fs', String(fontSizeStep));
    } catch {
      // ignore
    }
  }, [fontSizeStep]);

  useEffect(() => {
    document.documentElement.lang = lang === 'en' ? 'en' : lang === 'hi' ? 'hi' : 'sat';
    try {
      localStorage.setItem('ss_lang', lang);
    } catch {
      // ignore
    }
  }, [lang]);

  useEffect(() => {
    try {
      localStorage.setItem('ss_cart_v1', JSON.stringify(cart));
    } catch {
      // ignore
    }
  }, [cart]);

  useEffect(() => {
    if (route.page === 'ai') setAiInput(route.args[0] || '');
    if (route.page === 'verify') {
      const k = route.params.get('k') || '';
      setVerifyInput(k);
      if (k) {
        api<{ valid: boolean; license?: { key: string; lic: LicenseOptionKey; assetId: string; title: string; licensee: string; date: string } }>(`/api/verify-license?k=${encodeURIComponent(k)}`)
          .then((r) => setVerifyRes({ valid: r.valid, checked: true, license: r.license }))
          .catch(() => {});
      }
    }
  }, [route]);

  const navigate = useCallback((hash: string) => {
    const next = hash.startsWith('#') ? hash : `#${hash}`;
    if (window.location.hash === next) {
      setRoute(parseHash());
    } else {
      window.location.hash = next;
    }
  }, []);

  const money = useCallback(
    (n: number) => `${siteConfig.pricing.currency}${Math.round(n).toLocaleString('en-IN')}`,
    [siteConfig.pricing.currency]
  );

  const dlCount = useCallback((a: Asset) => (a.dl || 0) + (dlCounts[a.id] || 0), [dlCounts]);

  const isFav = useCallback(
    (id: string) => Object.values(lightbox).some((arr) => arr.includes(id)),
    [lightbox]
  );

  const syncLightbox = useCallback(
    async (next: Record<string, string[]>) => {
      setLightbox(next);
      try {
        localStorage.setItem('ss_lb_v1', JSON.stringify(next));
      } catch {
        // ignore
      }
      if (user) {
        try {
          await api('/api/lightbox', { method: 'PUT', body: JSON.stringify({ lightbox: next }) });
        } catch {
          // ignore
        }
      }
    },
    [user]
  );

  const toggleFav = useCallback(
    (id: string) => {
      const next: Record<string, string[]> = structuredClone(lightbox);
      next.Favorites = next.Favorites || [];
      if (isFav(id)) {
        Object.keys(next).forEach((k) => {
          next[k] = next[k].filter((x) => x !== id);
        });
        toast('Lightbox se hataya');
      } else {
        next.Favorites.push(id);
        toast('Lightbox me joda ♥');
      }
      syncLightbox(next);
    },
    [lightbox, isFav, syncLightbox, toast]
  );

  const handleSaveConfig = useCallback(
    async (next: SiteConfig) => {
      const res = await api<{ siteConfig: SiteConfig }>('/api/cms', {
        method: 'PUT',
        body: JSON.stringify({ siteConfig: next }),
      });
      setSiteConfig(res.siteConfig);
      toast('Changes saved live ✓');
    },
    [toast]
  );

  const handleSavePhoto = useCallback(
    async (id: string | null, payload: Record<string, unknown>) => {
      if (id) {
        await api(`/api/assets/${id}`, { method: 'PUT', body: JSON.stringify(payload) });
        toast('Photo updated ✓');
      } else {
        await api('/api/assets', { method: 'POST', body: JSON.stringify(payload) });
        toast('Photo added & published ✓');
      }
      await fetchState();
    },
    [fetchState, toast]
  );

  const handleDeletePhoto = useCallback(
    async (id: string) => {
      if (!window.confirm('Delete this photo permanently?')) return;
      try {
        await api(`/api/assets/${id}`, { method: 'DELETE' });
        await fetchState();
        toast('Photo deleted');
      } catch (err) {
        toast((err as Error).message);
      }
    },
    [fetchState, toast]
  );

  const approvedAssets = useMemo(() => assets.filter((a) => a.status === 'approved'), [assets]);
  const allCategories = useMemo(
    () => Array.from(new Set([...approvedAssets.map((a) => a.cat), ...siteConfig.settings.customCategories])),
    [approvedAssets, siteConfig.settings.customCategories]
  );

  const handleSearchGo = (q: string, lic: string) => {
    const p = new URLSearchParams();
    if (q) p.set('q', q);
    if (lic) p.set('lic', lic);
    navigate('#/search' + (p.toString() ? `?${p.toString()}` : ''));
  };

  const renderMasonry = (list: Asset[]) =>
    list.length ? (
      <div className="mason">
        {list.map((a) => (
          <PhotoTile
            key={a.id}
            asset={a}
            lang={lang}
            isFav={isFav(a.id)}
            adminMode={adminMode}
            onToggleFav={toggleFav}
            onOpenAsset={(id) => navigate(`#/asset/${id}`)}
            onAdminEdit={(id) => setAdminEditTarget({ section: 'editPhoto', itemId: id })}
            onAdminDelete={handleDeletePhoto}
          />
        ))}
      </div>
    ) : (
      <div className="py-12 text-center text-[#5c6170]">{tr(lang, 'empty')}</div>
    );

  /* ================= PAGE RENDERER ================= */
  const renderPage = () => {
    const { page, args, params } = route;

    /* ---------- HOME ---------- */
    if (page === '') {
      const trending = [...approvedAssets].sort((a, b) => dlCount(b) - dlCount(a)).slice(0, 12);
      const newest = [...approvedAssets].sort((a, b) => (b.date || '').localeCompare(a.date || '')).slice(0, 8);

      return (
        <>
          <div className="bg-gradient-to-b from-[#eef3fb] to-[#e9eff9] text-[#13203a] border-b border-[#d6deeb] pt-2 pb-11 text-center">
            <div className="wrap">
              {/* HERO TITLE: Distinct colored S S P | Santal Stock Photos */}
              <div className="flex justify-center my-2.5 mb-6">
                <AdminEditable
                  adminMode={adminMode}
                  label="Hero Title Colors"
                  onEdit={() => setAdminEditTarget({ section: 'heroTitle' })}
                  className="inline-flex items-center justify-center gap-4 sm:gap-7 flex-wrap px-3 py-1"
                >
                  <span className="no-invert font-bold text-[32px] sm:text-[50px] tracking-[7px] leading-none">
                    {siteConfig.brand.heroAbbr.map((seg, idx) => (
                      <span key={idx} style={{ color: seg.color }}>
                        {seg.text}
                      </span>
                    ))}
                  </span>
                  <span
                    className="no-invert w-[3px] h-10 sm:h-[62px] rounded-full shrink-0"
                    style={{ backgroundColor: siteConfig.brand.heroDividerColor }}
                  />
                  <span className="no-invert font-light text-[32px] sm:text-[50px] tracking-[-0.5px] leading-none">
                    {siteConfig.brand.heroFull.map((seg, idx) => (
                      <span
                        key={idx}
                        style={{ color: seg.color }}
                        className={idx === siteConfig.brand.heroFull.length - 1 ? 'ml-2 sm:ml-3' : ''}
                      >
                        {seg.text}
                      </span>
                    ))}
                  </span>
                </AdminEditable>
              </div>

              {/* Capsule Search Bar with distinct colored Search button */}
              <SearchCapsule
                lang={lang}
                siteConfig={siteConfig}
                adminMode={adminMode}
                onEditSearch={() => setAdminEditTarget({ section: 'searchBar' })}
                onSearch={handleSearchGo}
                toast={toast}
              />

              {/* Hero Heading & Subtitle */}
              <AdminEditable
                adminMode={adminMode}
                label="Hero Heading"
                onEdit={() => setAdminEditTarget({ section: 'heroText' })}
                className="mt-9 mb-2 inline-block px-3 py-1"
              >
                <h2 className="font-light text-[24px] sm:text-[34px] text-[#011f43] m-0">
                  {siteConfig.hero.headingCustom || tr(lang, 'heroT')}
                </h2>
                <p className="text-[16px] sm:text-[18px] text-[#33405c] max-w-[820px] mx-auto mt-2 mb-0">
                  {siteConfig.hero.subtitleCustom || tr(lang, 'heroS')}
                </p>
              </AdminEditable>

              {/* Quick Search Chips */}
              <div className="flex gap-2 flex-wrap justify-center mt-5 items-center">
                {siteConfig.hero.chips.map((ch) => (
                  <a
                    key={ch.id}
                    href={ch.href}
                    onClick={(e) => {
                      e.preventDefault();
                      if (adminMode) setAdminEditTarget({ section: 'heroChips' });
                      else navigate(ch.href);
                    }}
                    className={`bg-white border border-[#d6deeb] text-[#011f43] font-semibold rounded-full px-3.5 py-1.5 text-[13px] no-underline hover:bg-[#011f43] hover:text-white transition-colors ${
                      adminMode ? 'outline-1 outline-dashed outline-[#d6262f]' : ''
                    }`}
                  >
                    {ch.label}
                  </a>
                ))}
                {adminMode && (
                  <button
                    type="button"
                    onClick={() => setAdminEditTarget({ section: 'heroChips' })}
                    className="inline-flex items-center gap-1 bg-[#d6262f] text-white rounded-full px-3 py-1.5 text-xs font-bold cursor-pointer"
                  >
                    <Pencil className="w-3 h-3" /> Edit / Add Chips
                  </button>
                )}
              </div>
            </div>
          </div>

          {/* Feature Cards */}
          <section className="wrap py-9">
            <AdminEditable
              adminMode={adminMode}
              label="Feature Cards"
              onEdit={() => setAdminEditTarget({ section: 'featureCards' })}
            >
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {siteConfig.featureCards.map((fc) => (
                  <div key={fc.id} className="bg-white border border-[#d9dbe1] rounded-xl p-5 flex flex-col justify-between">
                    <div>
                      <span
                        className={`inline-block text-[11px] font-bold tracking-wide px-2.5 py-0.5 rounded-full uppercase ${
                          fc.badgeType === 'rf'
                            ? 'bg-[#e6f4ea] text-[#11602d]'
                            : fc.badgeType === 'ed'
                            ? 'bg-[#f2e8fd] text-[#8a2be2]'
                            : 'bg-[#eef3fb] text-[#011f43]'
                        }`}
                      >
                        {fc.badge}
                      </span>
                      <h3 className="dm text-[24px] text-[#011f43] my-2">{fc.title}</h3>
                      <p className="text-[#5c6170] text-sm mt-0 mb-4">{fc.description}</p>
                    </div>
                    <div>
                      <a
                        href={fc.buttonLink}
                        onClick={(e) => {
                          e.preventDefault();
                          if (!adminMode) navigate(fc.buttonLink);
                        }}
                        className={`inline-flex items-center px-4 py-2.5 rounded-lg text-sm font-semibold no-underline ${
                          fc.buttonStyle === 'red'
                            ? 'bg-[#d6262f] text-white'
                            : fc.buttonStyle === 'alt'
                            ? 'bg-white text-[#011f43] border border-[#d9dbe1]'
                            : 'bg-[#011f43] text-white'
                        }`}
                      >
                        {fc.buttonText}
                      </a>
                    </div>
                  </div>
                ))}
              </div>
            </AdminEditable>
          </section>

          {/* Custom Admin Sections */}
          {(siteConfig.customSections.length > 0 || adminMode) && (
            <section className="wrap py-2 space-y-4">
              {siteConfig.customSections.map((sec) => (
                <AdminEditable
                  key={sec.id}
                  adminMode={adminMode}
                  label="Custom Section"
                  onEdit={() => setAdminEditTarget({ section: 'customSections' })}
                >
                  <div
                    className="rounded-xl p-6 flex items-center justify-between gap-4 flex-wrap"
                    style={{ backgroundColor: sec.bgColor, color: sec.textColor }}
                  >
                    <div>
                      <h3 className="dm text-2xl m-0">{sec.title}</h3>
                      <p className="m-0 mt-1 opacity-90 text-sm">{sec.subtitle}</p>
                    </div>
                    {sec.buttonText && (
                      <a
                        href={sec.buttonLink}
                        onClick={(e) => {
                          e.preventDefault();
                          if (!adminMode) navigate(sec.buttonLink);
                        }}
                        style={{ backgroundColor: sec.btnColor }}
                        className="px-4 py-2.5 rounded-lg text-white font-semibold text-sm no-underline"
                      >
                        {sec.buttonText}
                      </a>
                    )}
                  </div>
                </AdminEditable>
              ))}
              {adminMode && (
                <div className="text-center">
                  <button
                    type="button"
                    onClick={() => setAdminEditTarget({ section: 'customSections' })}
                    className="inline-flex items-center gap-1.5 px-4 py-2 rounded-full border-2 border-dashed border-[#d6262f] text-[#d6262f] bg-white text-xs font-extrabold cursor-pointer hover:bg-red-50"
                  >
                    <Plus className="w-4 h-4" /> Add / Manage Custom Section Here
                  </button>
                </div>
              )}
            </section>
          )}

          {/* Trending */}
          <section className="wrap py-8">
            <div className="flex items-center justify-between gap-3 mb-4">
              <h2 className="dm text-[30px] text-[#011f43] m-0">{tr(lang, 'trending')}</h2>
              {adminMode && (
                <button
                  type="button"
                  onClick={() => setAdminEditTarget({ section: 'addPhoto' })}
                  className="inline-flex items-center gap-1 px-3.5 py-2 rounded-lg bg-[#d6262f] text-white text-xs font-bold cursor-pointer"
                >
                  <Plus className="w-4 h-4" /> Add Photo
                </button>
              )}
            </div>
            {renderMasonry(trending)}
          </section>

          {/* Categories */}
          <section className="wrap py-7">
            <div className="flex items-center justify-between gap-3 mb-4">
              <h2 className="dm text-[30px] text-[#011f43] m-0">{tr(lang, 'cats')}</h2>
              {adminMode && (
                <button
                  type="button"
                  onClick={() => setAdminEditTarget({ section: 'categories' })}
                  className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg bg-[#011f43] text-white text-xs font-bold cursor-pointer"
                >
                  <Plus className="w-3.5 h-3.5" /> Add Category
                </button>
              )}
            </div>
            <div className="flex gap-2 flex-wrap">
              {allCategories.map((c) => (
                <a
                  key={c}
                  href={`#/search?cat=${encodeURIComponent(c)}`}
                  onClick={(e) => {
                    e.preventDefault();
                    navigate(`#/search?cat=${encodeURIComponent(c)}`);
                  }}
                  className="bg-[#eef0f7] border border-[#dfe2ee] text-[#011f43] rounded-full px-3.5 py-1.5 text-sm font-semibold no-underline hover:bg-[#011f43] hover:text-white transition-colors"
                >
                  {c}
                </a>
              ))}
            </div>
          </section>

          {/* Newest */}
          <section className="wrap py-8">
            <h2 className="dm text-[30px] text-[#011f43] mb-4">{tr(lang, 'newest')}</h2>
            {renderMasonry(newest)}
          </section>

          {/* Contributor CTA Banner */}
          {(siteConfig.ctaBanner.visible || adminMode) && (
            <section className="wrap py-6">
              <AdminEditable
                adminMode={adminMode}
                label="CTA Banner"
                onEdit={() => setAdminEditTarget({ section: 'ctaBanner' })}
              >
                <div
                  className="rounded-xl p-6 flex items-center justify-between gap-4 flex-wrap"
                  style={{
                    backgroundColor: siteConfig.ctaBanner.bgColor,
                    color: siteConfig.ctaBanner.textColor,
                    opacity: siteConfig.ctaBanner.visible ? 1 : 0.45,
                  }}
                >
                  <div>
                    <h3 className="dm text-[26px] m-0">
                      {siteConfig.ctaBanner.titleCustom || tr(lang, 'ctaT')}
                    </h3>
                    <p className="mt-1 mb-0 opacity-85 text-sm">
                      {siteConfig.ctaBanner.subtitleCustom ||
                        `${tr(lang, 'ctaS')} RF ${Math.round(siteConfig.pricing.royalty.rf * 100)}% · Editorial ${Math.round(siteConfig.pricing.royalty.editorial * 100)}% · Min payout ${money(siteConfig.pricing.payoutMin)}`}
                    </p>
                  </div>
                  <a
                    href={siteConfig.ctaBanner.buttonLink}
                    onClick={(e) => {
                      e.preventDefault();
                      if (!adminMode) navigate(siteConfig.ctaBanner.buttonLink);
                    }}
                    className="px-5 py-2.5 rounded-lg bg-[#d6262f] text-white font-semibold no-underline"
                  >
                    {siteConfig.ctaBanner.buttonTextCustom || tr(lang, 'ctaB')}
                  </a>
                </div>
              </AdminEditable>
            </section>
          )}
        </>
      );
    }

    /* ---------- SEARCH / BROWSE ---------- */
    if (page === 'search') {
      const q = (params.get('q') || '').toLowerCase().trim();
      const lic = params.get('lic') || '';
      const cat = params.get('cat') || '';
      const orient = params.get('o') || '';
      const sort = params.get('sort') || 'rel';
      const limit = Number(params.get('n') || 24);

      const score = (a: Asset) => {
        if (!q) return 1;
        const terms = q.split(/\s+/);
        let s = 0;
        for (const w of terms) {
          if (a.id.toLowerCase() === w) s += 10;
          if (a.title.toLowerCase().includes(w)) s += 3;
          if (a.kw.some((k) => k.includes(w))) s += 2;
          if (a.cat.toLowerCase().includes(w)) s += 2;
          if ((a.desc || '').toLowerCase().includes(w) || (a.caption || '').toLowerCase().includes(w) || (a.place || '').toLowerCase().includes(w)) s += 1;
        }
        return s;
      };

      let list = approvedAssets
        .map((a) => ({ a, s: score(a) }))
        .filter((x) => x.s > 0);
      if (lic) list = list.filter((x) => x.a.lic === lic);
      if (cat) list = list.filter((x) => x.a.cat === cat);
      if (orient) list = list.filter((x) => orientOf(x.a) === orient);
      if (sort === 'new') list.sort((x, y) => (y.a.date || '').localeCompare(x.a.date || ''));
      else if (sort === 'pop') list.sort((x, y) => dlCount(y.a) - dlCount(x.a));
      else list.sort((x, y) => y.s - x.s);

      const setFilter = (k: string, v: string) => {
        const next = new URLSearchParams(params);
        if (v) next.set(k, v);
        else next.delete(k);
        next.delete('n');
        navigate('#/search?' + next.toString());
      };

      return (
        <section className="wrap py-9">
          <div className="grid grid-cols-1 md:grid-cols-[240px_1fr] gap-6">
            <aside>
              <div className="bg-white border border-[#d9dbe1] rounded-xl p-4 space-y-3">
                <b className="text-sm text-[#011f43]">{tr(lang, 'filters')}</b>
                <div>
                  <label className="text-xs font-bold block mb-1">{tr(lang, 'lic')}</label>
                  <select value={lic} onChange={(e) => setFilter('lic', e.target.value)} className="w-full px-2.5 py-2 border border-[#d9dbe1] rounded-lg text-sm bg-white">
                    <option value="">{tr(lang, 'all')}</option>
                    <option value="rf">{tr(lang, 'rf')}</option>
                    <option value="editorial">{tr(lang, 'ed')}</option>
                  </select>
                </div>
                <div>
                  <label className="text-xs font-bold block mb-1">{tr(lang, 'cat')}</label>
                  <select value={cat} onChange={(e) => setFilter('cat', e.target.value)} className="w-full px-2.5 py-2 border border-[#d9dbe1] rounded-lg text-sm bg-white">
                    <option value="">{tr(lang, 'all')}</option>
                    {allCategories.map((c) => <option key={c} value={c}>{c}</option>)}
                  </select>
                </div>
                <div>
                  <label className="text-xs font-bold block mb-1">{tr(lang, 'orient')}</label>
                  <select value={orient} onChange={(e) => setFilter('o', e.target.value)} className="w-full px-2.5 py-2 border border-[#d9dbe1] rounded-lg text-sm bg-white">
                    <option value="">{tr(lang, 'all')}</option>
                    <option value="land">{tr(lang, 'land')}</option>
                    <option value="port">{tr(lang, 'port')}</option>
                    <option value="sq">{tr(lang, 'sq')}</option>
                  </select>
                </div>
                <div>
                  <label className="text-xs font-bold block mb-1">{tr(lang, 'sort')}</label>
                  <select value={sort} onChange={(e) => setFilter('sort', e.target.value)} className="w-full px-2.5 py-2 border border-[#d9dbe1] rounded-lg text-sm bg-white">
                    <option value="rel">{tr(lang, 'rel')}</option>
                    <option value="new">{tr(lang, 'new')}</option>
                    <option value="pop">{tr(lang, 'pop')}</option>
                  </select>
                </div>
                <button type="button" onClick={() => navigate('#/search')} className="text-xs font-bold text-[#2f3f8f] underline bg-transparent border-0 p-0 cursor-pointer">
                  {tr(lang, 'reset')}
                </button>
              </div>
            </aside>
            <div>
              <div className="flex items-center justify-between gap-2 mb-3">
                <h2 className="dm text-3xl text-[#011f43] m-0">
                  {q ? `“${q}”` : tr(lang, 'browse')}{' '}
                  <span className="text-sm font-sans text-[#5c6170]">{list.length} {tr(lang, 'results')}</span>
                </h2>
                {adminMode && (
                  <button type="button" onClick={() => setAdminEditTarget({ section: 'addPhoto' })} className="px-3 py-1.5 rounded-lg bg-[#d6262f] text-white text-xs font-bold cursor-pointer">
                    + Add Photo
                  </button>
                )}
              </div>
              {renderMasonry(list.slice(0, limit).map((x) => x.a))}
              {list.length > limit && (
                <div className="text-center mt-5">
                  <button
                    type="button"
                    onClick={() => {
                      const next = new URLSearchParams(params);
                      next.set('n', String(limit + 24));
                      navigate('#/search?' + next.toString());
                    }}
                    className="px-5 py-2.5 rounded-lg border border-[#d9dbe1] bg-white text-[#011f43] font-semibold cursor-pointer"
                  >
                    {tr(lang, 'loadmore')}
                  </button>
                </div>
              )}
            </div>
          </div>
        </section>
      );
    }

    /* ---------- ASSET DETAIL ---------- */
    if (page === 'asset') {
      const a = assets.find((x) => x.id === args[0]);
      return (
        <AssetDetailPage
          asset={a}
          allAssets={approvedAssets}
          lang={lang}
          user={user}
          siteConfig={siteConfig}
          dlCount={dlCount}
          isFav={isFav}
          onToggleFav={toggleFav}
          onAddCart={(item, buyNow) => {
            if (cart.some((c) => c.id === item.id && c.lic === item.lic && c.size === item.size)) {
              if (buyNow) navigate('#/checkout');
              else toast('Pehle se cart me hai');
              return;
            }
            setCart((prev) => [...prev, item]);
            toast('Cart me joda');
            if (buyNow) navigate('#/checkout');
          }}
          onSpeak={(text) => setReaderSpeech({ id: Date.now(), text })}
          onNavigate={navigate}
          adminMode={adminMode}
          onAdminEdit={setAdminEditTarget}
          onDeleteAsset={handleDeletePhoto}
          money={money}
          toast={toast}
        />
      );
    }

    /* ---------- CART & CHECKOUT ---------- */
    if (page === 'cart' || page === 'checkout') {
      return (
        <CartCheckoutPage
          mode={page}
          planId={params.get('plan') || undefined}
          packId={params.get('pack') || undefined}
          lang={lang}
          user={user}
          cart={cart}
          assets={assets}
          siteConfig={siteConfig}
          money={money}
          onRemoveCart={(idx) => setCart((prev) => prev.filter((_, i) => i !== idx))}
          onClearCart={() => setCart([])}
          onNavigate={navigate}
          onOpenAuth={(m) => { setAuthPortal('buyer'); setAuthModal(m || 'login'); }}
          onOrderSuccess={async (ord) => {
            await fetchState();
            navigate(`#/order/${ord.id}`);
          }}
          toast={toast}
        />
      );
    }

    /* ---------- ORDER / CERT / INVOICE ---------- */
    if (page === 'order' || page === 'cert' || page === 'invoice') {
      return (
        <OrderCertInvoicePage
          view={page}
          orderId={args[0] || ''}
          itemIndex={Number(args[1] || 0)}
          lang={lang}
          orders={orders}
          assets={assets}
          siteConfig={siteConfig}
          money={money}
          onNavigate={navigate}
          toast={toast}
        />
      );
    }

    /* ---------- ACCOUNT ---------- */
    if (page === 'account') {
      if (!user) {
        return (
          <section className="wrap py-16 text-center">
            <h2 className="dm text-3xl text-[#011f43]">Login to My Account</h2>
            <button type="button" onClick={() => setAuthModal('login')} className="mt-3 px-6 py-2.5 rounded-xl bg-[#1f6fd1] text-white font-semibold cursor-pointer hover:brightness-110">
              Login
            </button>
          </section>
        );
      }
      const tab = args[0] || 'downloads';
      const myOrders = orders.filter((o) => o.user === user.email);
      const myItems = myOrders.filter((o) => !o.status || o.status === 'paid').flatMap((o) => o.items.map((i, idx) => ({ o, i, idx })));

      return (
        <section className="wrap py-9">
          <div className="flex items-center justify-between flex-wrap gap-3 mb-4">
            <div>
              <h1 className="dm text-4xl text-[#011f43] m-0">{tr(lang, 'account')}</h1>
              <div className="flex items-center gap-2 text-xs text-[#5c6170] mt-1">
                <span>{user.email}</span>
                {user.emailVerified && (
                  <span className="inline-flex items-center gap-1 text-emerald-700 font-bold">
                    <ShieldCheck className="w-3.5 h-3.5" /> Verified Email
                  </span>
                )}
                <span>· Role: <b className="uppercase">{user.role}</b></span>
              </div>
            </div>
            <button
              type="button"
              onClick={async () => {
                await api('/api/auth/logout', { method: 'POST' });
                setToken('');
                setUser(null);
                setAdminMode(false);
                toast('Logged out');
                navigate('#/');
              }}
              className="px-4 py-2 rounded-lg border border-[#d9dbe1] bg-white text-[#011f43] text-sm font-semibold cursor-pointer"
            >
              {tr(lang, 'logout')}
            </button>
          </div>

          <div className="flex gap-1.5 border-b border-[#d9dbe1] mb-5 flex-wrap">
            {[
              ['downloads', tr(lang, 'orders')],
              ['orders', 'Orders & invoices'],
              ['plan', 'Plan & credits'],
              ['profile', 'Profile'],
            ].map(([k, l]) => (
              <a
                key={k}
                href={`#/account/${k}`}
                onClick={(e) => { e.preventDefault(); navigate(`#/account/${k}`); }}
                className={`px-3.5 py-2.5 no-underline text-sm border-b-[3px] ${
                  tab === k ? 'text-[#011f43] border-[#d6262f] font-bold' : 'text-[#5c6170] border-transparent'
                }`}
              >
                {l}
              </a>
            ))}
          </div>

          {tab === 'downloads' && (
            myItems.length ? (
              <div className="bg-white border border-[#d9dbe1] rounded-xl p-5 overflow-x-auto">
                <table className="w-full text-sm border-collapse">
                  <thead>
                    <tr className="border-b border-[#d9dbe1] text-left text-xs uppercase text-[#5c6170]">
                      <th className="py-2">Photo</th><th>License</th><th>Key</th><th />
                    </tr>
                  </thead>
                  <tbody>
                    {myItems.map(({ o, i, idx }) => {
                      const a = assets.find((x) => x.id === i.id);
                      return (
                        <tr key={i.key} className="border-b border-[#e5e8ef]">
                          <td className="py-2.5">
                            <div className="flex items-center gap-2.5">
                              {a && <img src={thumbUrl(a, 180)} alt={i.title} className="w-20 h-14 object-cover rounded" />}
                              <b>{i.title}</b>
                            </div>
                          </td>
                          <td>{siteConfig.pricing.licMeta[i.lic].n}</td>
                          <td><code className="text-xs bg-[#f3f4f8] px-2 py-1 rounded">{i.key}</code></td>
                          <td>
                            <div className="flex gap-1.5">
                              <button type="button" onClick={() => a && downloadFullAsset(a, i.size, siteConfig, toast)} className="px-2.5 py-1 rounded bg-[#011f43] text-white text-xs font-bold cursor-pointer">⬇</button>
                              <button type="button" onClick={() => navigate(`#/cert/${o.id}/${idx}`)} className="px-2.5 py-1 rounded border border-[#d9dbe1] text-xs font-bold cursor-pointer">📜</button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="py-12 text-center text-[#5c6170]">{tr(lang, 'empty')}</div>
            )
          )}

          {tab === 'orders' && (
            myOrders.length ? (
              <div className="bg-white border border-[#d9dbe1] rounded-xl p-5 overflow-x-auto">
                <table className="w-full text-sm border-collapse">
                  <thead>
                    <tr className="border-b border-[#d9dbe1] text-left text-xs uppercase text-[#5c6170]">
                      <th className="py-2">Order</th><th>Date</th><th>Items</th><th>Total</th><th>Status</th><th />
                    </tr>
                  </thead>
                  <tbody>
                    {myOrders.map((o) => (
                      <tr key={o.id} className="border-b border-[#e5e8ef]">
                        <td className="py-2.5"><a href={`#/order/${o.id}`} onClick={(e) => { e.preventDefault(); navigate(`#/order/${o.id}`); }} className="font-semibold text-[#2f3f8f]">{o.id}</a></td>
                        <td>{new Date(o.date).toLocaleDateString('en-IN')}</td>
                        <td>{o.items.length || o.desc}</td>
                        <td className="tabular-nums font-bold">{o.credits ? `${o.credits} cr` : money(o.total)}</td>
                        <td><span className={`text-[11px] font-bold px-2 py-0.5 rounded-full ${o.status === 'pending' ? 'bg-[#fff4d6] text-[#8a5200]' : o.status === 'rejected' ? 'bg-[#fde8e8] text-[#b42318]' : 'bg-[#e6f6ec] text-[#1b8a4b]'}`}>{tr(lang, o.status === 'pending' ? 'stPending' : o.status === 'rejected' ? 'stRejected' : 'stPaid')}</span></td>
                        <td><a href={`#/invoice/${o.id}`} onClick={(e) => { e.preventDefault(); navigate(`#/invoice/${o.id}`); }} className="text-[#2f3f8f] text-xs font-bold">Invoice</a></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="py-12 text-center text-[#5c6170]">{tr(lang, 'empty')}</div>
            )
          )}

          {tab === 'plan' && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 max-w-md gap-3.5">
                <div className="bg-white border border-[#d9dbe1] rounded-xl p-4 text-sm text-[#5c6170]">Credits<b className="block text-2xl text-[#011f43] tabular-nums">{user.credits || 0}</b></div>
                <div className="bg-white border border-[#d9dbe1] rounded-xl p-4 text-sm text-[#5c6170]">Plan<b className="block text-2xl text-[#011f43]">{user.plan ? siteConfig.pricing.plans.find((p) => p.id === user.plan?.id)?.n || 'Active' : '—'}</b></div>
              </div>
              <div className="flex gap-2.5">
                <button type="button" onClick={() => navigate('#/pricing')} className="px-4 py-2 rounded-lg bg-[#011f43] text-white text-sm font-semibold cursor-pointer">View Plans</button>
                {user.plan && (
                  <button
                    type="button"
                    onClick={async () => {
                      await api('/api/auth/profile', { method: 'PUT', body: JSON.stringify({ plan: null }) });
                      await fetchState();
                      toast('Plan cancelled (unused credits remain)');
                    }}
                    className="px-4 py-2 rounded-lg border border-[#d9dbe1] bg-white text-[#011f43] text-sm font-semibold cursor-pointer"
                  >
                    Cancel Plan
                  </button>
                )}
              </div>
            </div>
          )}

          {tab === 'profile' && (
            <form
              className="bg-white border border-[#d9dbe1] rounded-xl p-5 max-w-lg space-y-3"
              onSubmit={async (e) => {
                e.preventDefault();
                await api('/api/auth/profile', {
                  method: 'PUT',
                  body: JSON.stringify({ name: profName, company: profCompany, gstin: profGstin, role: profRole }),
                });
                await fetchState();
                toast('Profile saved ✓');
              }}
            >
              <div><label className="text-xs font-bold block mb-1">Full Name</label><input value={profName} onChange={(e) => setProfName(e.target.value)} className="w-full px-3 py-2 border border-[#d9dbe1] rounded-lg text-sm" /></div>
              <div><label className="text-xs font-bold block mb-1">Company</label><input value={profCompany} onChange={(e) => setProfCompany(e.target.value)} className="w-full px-3 py-2 border border-[#d9dbe1] rounded-lg text-sm" /></div>
              <div><label className="text-xs font-bold block mb-1">GSTIN</label><input value={profGstin} onChange={(e) => setProfGstin(e.target.value.toUpperCase())} className="w-full px-3 py-2 border border-[#d9dbe1] rounded-lg text-sm" /></div>
              {user.role !== 'admin' && (
                <div>
                  <label className="text-xs font-bold block mb-1">Account Type</label>
                  <select value={profRole} onChange={(e) => setProfRole(e.target.value as 'buyer' | 'contributor')} className="w-full px-3 py-2 border border-[#d9dbe1] rounded-lg text-sm bg-white">
                    <option value="buyer">Buyer</option>
                    <option value="contributor">Contributor</option>
                  </select>
                </div>
              )}
              <button type="submit" className="px-5 py-2 rounded-lg bg-[#011f43] text-white text-sm font-bold cursor-pointer">Save Profile</button>
            </form>
          )}
        </section>
      );
    }

    /* ---------- LIGHTBOX ---------- */
    if (page === 'lightbox') {
      const names = Object.keys(lightbox);
      return (
        <section className="wrap py-9">
          <div className="flex items-center justify-between flex-wrap gap-3 mb-5">
            <h1 className="dm text-4xl text-[#011f43] m-0">♡ {tr(lang, 'lightbox')}</h1>
            <button
              type="button"
              onClick={() => {
                const n = window.prompt('Naye collection ka naam');
                if (n && n.trim()) {
                  syncLightbox({ ...lightbox, [n.trim()]: lightbox[n.trim()] || [] });
                }
              }}
              className="px-4 py-2 rounded-lg border border-[#d9dbe1] bg-white text-[#011f43] text-sm font-semibold cursor-pointer"
            >
              {tr(lang, 'newcol')}
            </button>
          </div>
          {names.map((col) => {
            const list = (lightbox[col] || []).map((id) => assets.find((a) => a.id === id)).filter(Boolean) as Asset[];
            return (
              <div key={col} className="my-6">
                <div className="flex items-center justify-between flex-wrap gap-2 mb-3">
                  <h3 className="m-0 text-lg font-bold text-[#011f43]">{col} <span className="text-xs text-[#5c6170] font-normal">({list.length})</span></h3>
                  <div className="flex gap-2">
                    {list.length > 0 && (
                      <button
                        type="button"
                        onClick={() => {
                          const toAdd: CartItem[] = [];
                          list.forEach((a) => {
                            const l: LicenseOptionKey = a.lic === 'editorial' ? 'ed' : 'std';
                            if (!cart.some((c) => c.id === a.id)) {
                              toAdd.push({ id: a.id, lic: l, size: 'M', price: siteConfig.pricing.matrix[l].M });
                            }
                          });
                          setCart((prev) => [...prev, ...toAdd]);
                          navigate('#/cart');
                        }}
                        className="px-3 py-1.5 rounded-lg bg-[#011f43] text-white text-xs font-bold cursor-pointer"
                      >
                        Add all to cart (M)
                      </button>
                    )}
                    {col !== 'Favorites' && (
                      <button
                        type="button"
                        onClick={() => {
                          const next = { ...lightbox };
                          delete next[col];
                          syncLightbox(next);
                        }}
                        className="px-3 py-1.5 rounded-lg border border-[#d9dbe1] text-xs font-bold text-red-600 cursor-pointer"
                      >
                        Delete
                      </button>
                    )}
                  </div>
                </div>
                {renderMasonry(list)}
              </div>
            );
          })}
        </section>
      );
    }

    /* ---------- PRICING (Affordable Minimum Pricing + Admin Click-to-Edit) ---------- */
    if (page === 'pricing') {
      return (
        <section className="wrap py-9">
          <div className="text-center mb-8">
            <h1 className="dm text-4xl sm:text-[42px] text-[#011f43] m-0">Affordable, Minimum Pricing</h1>
            <p className="text-[#5c6170] mt-2">
              Photos starting at just <b>{money(siteConfig.pricing.matrix.ed.S)}</b> (Editorial) & <b>{money(siteConfig.pricing.matrix.std.S)}</b> (Royalty-Free). All prices +{Math.round(siteConfig.pricing.gst * 100)}% GST.
            </p>
          </div>

          <h2 className="dm text-3xl text-[#011f43] mb-3">{tr(lang, 'ondemand')}</h2>
          <AdminEditable adminMode={adminMode} label="Pricing Table" onEdit={() => setAdminEditTarget({ section: 'pricingMatrix' })}>
            <div className="bg-white border border-[#d9dbe1] rounded-xl p-5 overflow-x-auto">
              <table className="w-full text-sm border-collapse text-center">
                <thead>
                  <tr className="border-b border-[#d9dbe1] text-xs uppercase text-[#5c6170]">
                    <th className="py-2.5 text-left">License</th>
                    {siteConfig.pricing.sizes.map((s) => <th key={s.k} className="py-2.5">{s.n}</th>)}
                    <th className="py-2.5">Credits</th>
                  </tr>
                </thead>
                <tbody>
                  {(['std', 'ext', 'ed'] as LicenseOptionKey[]).map((lk) => (
                    <tr key={lk} className="border-b border-[#e5e8ef]">
                      <td className="py-3 text-left font-bold text-[#011f43]">{siteConfig.pricing.licMeta[lk].n}</td>
                      {siteConfig.pricing.sizes.map((s) => (
                        <td key={s.k} className="py-3 font-bold tabular-nums text-[#011f43]">{money(siteConfig.pricing.matrix[lk][s.k])}</td>
                      ))}
                      <td className="py-3 tabular-nums">{siteConfig.pricing.licMeta[lk].cr}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </AdminEditable>

          <h2 className="dm text-3xl text-[#011f43] mt-10 mb-4">{tr(lang, 'plans')}</h2>
          <AdminEditable adminMode={adminMode} label="Subscription Plans" onEdit={() => setAdminEditTarget({ section: 'plans' })}>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              {siteConfig.pricing.plans.map((p) => (
                <div
                  key={p.id}
                  className={`bg-white rounded-xl p-6 text-center flex flex-col justify-between ${
                    p.hot ? 'border-2 border-[#d6262f] shadow-md' : 'border border-[#d9dbe1]'
                  }`}
                >
                  <div>
                    {p.hot && <span className="inline-block text-[11px] font-bold uppercase px-2.5 py-0.5 rounded-full bg-[#f2e8fd] text-[#8a2be2]">Popular</span>}
                    <h3 className="dm text-2xl text-[#011f43] my-2">{p.n}</h3>
                    <div className="text-3xl font-extrabold text-[#011f43] tabular-nums my-2">
                      {money(p.p)}<span className="text-xs font-normal text-[#5c6170]">/mo</span>
                    </div>
                    <p className="text-sm text-[#5c6170]">{p.d}<br />~{money(p.p / Math.max(1, p.cr))} per download</p>
                  </div>
                  <button
                    type="button"
                    onClick={() => !adminMode && navigate(`#/checkout?plan=${p.id}`)}
                    className={`mt-4 w-full py-2.5 rounded-lg font-bold text-white cursor-pointer ${p.hot ? 'bg-[#d6262f]' : 'bg-[#011f43]'}`}
                  >
                    Choose {p.n}
                  </button>
                </div>
              ))}
            </div>
          </AdminEditable>

          <h2 className="dm text-3xl text-[#011f43] mt-10 mb-4">Credit packs (1 year valid)</h2>
          <AdminEditable adminMode={adminMode} label="Credit Packs" onEdit={() => setAdminEditTarget({ section: 'packs' })}>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {siteConfig.pricing.packs.map((pk) => (
                <div key={pk.id} className="bg-white border border-[#d9dbe1] rounded-xl p-6 text-center">
                  <h3 className="m-0 text-lg font-bold text-[#011f43]">{pk.cr} credits</h3>
                  <div className="text-3xl font-extrabold text-[#011f43] tabular-nums my-2">{money(pk.p)}</div>
                  <p className="text-xs text-[#5c6170] mb-4">~{money(pk.p / Math.max(1, pk.cr))} / credit</p>
                  <button
                    type="button"
                    onClick={() => !adminMode && navigate(`#/checkout?pack=${pk.id}`)}
                    className="px-5 py-2 rounded-lg border border-[#d9dbe1] bg-white text-[#011f43] font-bold cursor-pointer hover:bg-[#eef3fb]"
                  >
                    Buy Pack
                  </button>
                </div>
              ))}
            </div>
          </AdminEditable>
        </section>
      );
    }

    /* ---------- LICENSES GUIDE ---------- */
    if (page === 'licenses') {
      return (
        <section className="wrap py-9">
          <h1 className="dm text-4xl text-[#011f43] m-0">License Guide</h1>
          <p className="text-[#5c6170] mb-5">Kaun sa license chahiye? Ye comparison table dekhiye.</p>
          <AdminEditable adminMode={adminMode} label="License Guide Table" onEdit={() => setAdminEditTarget({ section: 'licenseRows' })}>
            <div className="bg-white border border-[#d9dbe1] rounded-xl p-5 overflow-x-auto">
              <table className="w-full text-sm border-collapse text-center">
                <thead>
                  <tr className="border-b border-[#d9dbe1] text-xs uppercase text-[#5c6170]">
                    <th className="py-2.5 text-left">Use</th><th>RF Standard</th><th>RF Extended</th><th>Editorial</th>
                  </tr>
                </thead>
                <tbody>
                  {siteConfig.licenseRows.map((r) => (
                    <tr key={r.id} className="border-b border-[#e5e8ef]">
                      <td className="py-2.5 text-left font-semibold text-[#011f43]">{r.use}</td>
                      <td>{r.std}</td><td>{r.ext}</td><td>{r.ed}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </AdminEditable>
          <div className="flex gap-3 mt-5">
            <button type="button" onClick={() => navigate('#/terms')} className="px-4 py-2.5 rounded-lg bg-[#011f43] text-white text-sm font-semibold cursor-pointer">License Agreement</button>
            <button type="button" onClick={() => navigate('#/verify')} className="px-4 py-2.5 rounded-lg border border-[#d9dbe1] bg-white text-[#011f43] text-sm font-semibold cursor-pointer">Verify License</button>
          </div>
        </section>
      );
    }

    /* ---------- TERMS ---------- */
    if (page === 'terms') {
      return (
        <section className="wrap py-9 max-w-[860px]">
          <AdminEditable adminMode={adminMode} label="License Agreement" onEdit={() => setAdminEditTarget({ section: 'pageTerms' })}>
            <h1 className="dm text-4xl text-[#011f43] m-0 mb-4">{siteConfig.pages.terms.title}</h1>
            <div className="bg-white border border-[#d9dbe1] rounded-xl p-6 space-y-4">
              {siteConfig.pages.terms.sections.map((s) => (
                <div key={s.id}>
                  <h3 className="text-base font-bold text-[#011f43] m-0 mb-1">{s.heading}</h3>
                  <p className="text-sm text-[#33405c] m-0">{s.content}</p>
                </div>
              ))}
            </div>
          </AdminEditable>
        </section>
      );
    }

    /* ---------- VERIFY LICENSE ---------- */
    if (page === 'verify') {
      return (
        <section className="wrap py-9 max-w-[640px]">
          <h1 className="dm text-4xl text-[#011f43] mb-4">{tr(lang, 'verify')}</h1>
          <form
            className="bg-white border border-[#d9dbe1] rounded-xl p-6 space-y-3"
            onSubmit={async (e) => {
              e.preventDefault();
              const k = verifyInput.trim().toUpperCase();
              if (!k) return;
              const r = await api<{ valid: boolean; license?: { key: string; lic: LicenseOptionKey; assetId: string; title: string; licensee: string; date: string } }>(`/api/verify-license?k=${encodeURIComponent(k)}`);
              setVerifyRes({ valid: r.valid, checked: true, license: r.license });
            }}
          >
            <label className="text-sm font-bold block">License Key</label>
            <input
              value={verifyInput}
              onChange={(e) => setVerifyInput(e.target.value)}
              placeholder="SSL-XXXX-XXXX-XXXX"
              className="w-full px-3.5 py-2.5 border border-[#d9dbe1] rounded-lg font-mono text-sm"
            />
            <button type="submit" className="px-5 py-2.5 rounded-lg bg-[#011f43] text-white font-semibold text-sm cursor-pointer">
              Verify
            </button>
            {verifyRes.checked && (
              verifyRes.valid && verifyRes.license ? (
                <div className="rounded-lg bg-emerald-50 border border-emerald-200 p-3.5 text-sm text-emerald-900 flex items-start gap-2">
                  <CheckCircle2 className="w-4 h-4 mt-0.5 shrink-0" />
                  <div>
                    <b>Valid license.</b> {siteConfig.pricing.licMeta[verifyRes.license.lic].n} · Asset {verifyRes.license.assetId} ({verifyRes.license.title}) · Licensee: {verifyRes.license.licensee} · {new Date(verifyRes.license.date).toLocaleDateString('en-IN')}
                  </div>
                </div>
              ) : (
                <div className="rounded-lg bg-amber-50 border border-amber-200 p-3.5 text-sm text-amber-900">
                  ✕ License key not found in registry.
                </div>
              )
            )}
          </form>
        </section>
      );
    }

    /* ---------- FAQ ---------- */
    if (page === 'faq') {
      return (
        <section className="wrap py-9 max-w-[860px]">
          <div className="flex items-center justify-between mb-4">
            <h1 className="dm text-4xl text-[#011f43] m-0">{tr(lang, 'faq')}</h1>
            {adminMode && (
              <button type="button" onClick={() => setAdminEditTarget({ section: 'faqs' })} className="px-3.5 py-2 rounded-lg bg-[#d6262f] text-white text-xs font-bold cursor-pointer">
                + Add / Edit FAQs
              </button>
            )}
          </div>
          <AdminEditable adminMode={adminMode} label="FAQs" onEdit={() => setAdminEditTarget({ section: 'faqs' })} className="space-y-2.5">
            {siteConfig.faqs.map((fq) => (
              <details key={fq.id} className="bg-white border border-[#d9dbe1] rounded-xl p-4">
                <summary className="font-bold text-[#011f43] cursor-pointer">{fq.q}</summary>
                <p className="text-sm text-[#33405c] mt-2 mb-0">{fq.a}</p>
              </details>
            ))}
          </AdminEditable>
        </section>
      );
    }

    /* ---------- INFO PAGES (About, Privacy, Refund) ---------- */
    if (page === 'about' || page === 'privacy' || page === 'refund') {
      const secKey = page === 'about' ? 'pageAbout' : page === 'privacy' ? 'pagePrivacy' : 'pageRefund';
      const content = siteConfig.pages[page];
      return (
        <section className="wrap py-9 max-w-[820px]">
          <AdminEditable adminMode={adminMode} label={`${content.title}`} onEdit={() => setAdminEditTarget({ section: secKey })}>
            <h1 className="dm text-4xl text-[#011f43] mb-4">{content.title}</h1>
            <div className="bg-white border border-[#d9dbe1] rounded-xl p-6">
              <p className="text-[16px] leading-relaxed text-[#222] whitespace-pre-line m-0">{content.body}</p>
            </div>
          </AdminEditable>
        </section>
      );
    }

    /* ---------- CONTACT ---------- */
    if (page === 'contact') {
      return (
        <section className="wrap py-9 max-w-[760px]">
          <h1 className="dm text-4xl text-[#011f43] mb-5">{tr(lang, 'contact')}</h1>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            <AdminEditable adminMode={adminMode} label="Contact Info" onEdit={() => setAdminEditTarget({ section: 'contact' })}>
              <div className="bg-white border border-[#d9dbe1] rounded-xl p-5 space-y-2.5 h-full">
                <p className="flex items-center gap-2 font-bold text-[#011f43] m-0"><Mail className="w-4 h-4" /> {siteConfig.contact.email}</p>
                <p className="text-sm text-[#33405c] m-0">📍 {siteConfig.contact.location}</p>
                <p className="text-xs text-[#5c6170] m-0">{siteConfig.contact.venture}</p>
              </div>
            </AdminEditable>

            <form
              className="bg-white border border-[#d9dbe1] rounded-xl p-5 space-y-3"
              onSubmit={async (e) => {
                e.preventDefault();
                try {
                  await api('/api/contact', { method: 'POST', body: JSON.stringify({ name: cName, email: cEmail, message: cMsg }) });
                  setCName('');
                  setCEmail('');
                  setCMsg('');
                  toast(tr(lang, 'sent'));
                } catch (err) {
                  toast((err as Error).message);
                }
              }}
            >
              <div><label className="text-xs font-bold block mb-1">{tr(lang, 'fullname')}</label><input required value={cName} onChange={(e) => setCName(e.target.value)} className="w-full px-3 py-2 border border-[#d9dbe1] rounded-lg text-sm" /></div>
              <div><label className="text-xs font-bold block mb-1">{tr(lang, 'email')}</label><input type="email" required value={cEmail} onChange={(e) => setCEmail(e.target.value)} className="w-full px-3 py-2 border border-[#d9dbe1] rounded-lg text-sm" /></div>
              <div><label className="text-xs font-bold block mb-1">{tr(lang, 'message')}</label><textarea required rows={4} value={cMsg} onChange={(e) => setCMsg(e.target.value)} className="w-full px-3 py-2 border border-[#d9dbe1] rounded-lg text-sm" /></div>
              <button type="submit" className="px-5 py-2.5 rounded-lg bg-[#011f43] text-white font-semibold text-sm cursor-pointer">{tr(lang, 'send')}</button>
            </form>
          </div>
        </section>
      );
    }

    /* ---------- AI SEARCH ---------- */
    if (page === 'ai') {
      const activeQ = args[0] || '';
      const examples = [
        ['village festival photos for a news article', 'गाँव के पर्व की फोटो न्यूज़ के लिए', "ato parab photo news lagit'", 'आतो परब फोटो न्यूज़ लागित्'],
        ['vertical forest photo for instagram reel', 'इंस्टाग्राम रील के लिए जंगल की खड़ी फोटो', "bir photo reel lagit' khada", 'बिर फोटो रील लागित् खड़ा'],
        ['latest food pictures for my restaurant ad', 'रेस्टोरेंट विज्ञापन के लिए नई खाने की तस्वीरें', "jom photo vigyapan lagit' nawa", 'जोम फोटो विज्ञापन लागित् नावा'],
        ['popular people portraits', 'लोकप्रिय लोगों के पोर्ट्रेट', 'hor portrait popular', 'होड़ पोर्ट्रेट पॉपुलर'],
      ].map((r) => r[LIDX[lang]]);

      const aiOut = activeQ ? aiRunSearch(activeQ, approvedAssets, dlCount) : null;

      return (
        <section className="wrap py-9">
          <div className="bg-gradient-to-br from-white via-[#f6f1ff] to-[#fdeef3] border border-[#e4dcf5] rounded-3xl p-6 sm:p-8 shadow-md">
            <div className="flex items-center gap-4">
              <span className="w-14 h-14 rounded-full bg-gradient-to-br from-[#f2b8c6] to-[#a98fd6] text-[#011f43] flex items-center justify-center shrink-0 shadow">
                <Sparkles className="w-6 h-6" />
              </span>
              <div>
                <h1 className="dm text-3xl sm:text-4xl text-[#011f43] m-0">{tr(lang, 'aiT')}</h1>
                <p className="text-sm text-[#4a5370] mt-1 mb-0">{tr(lang, 'aiS')}</p>
              </div>
            </div>

            <form
              onSubmit={(e) => {
                e.preventDefault();
                if (aiInput.trim()) navigate(`#/ai/${encodeURIComponent(aiInput.trim())}`);
              }}
              className="mt-5 mb-3 bg-white border border-[#c5cfe0] rounded-3xl p-2.5 pl-4 flex flex-col sm:flex-row gap-2.5 sm:items-end shadow-sm"
            >
              <textarea
                rows={2}
                value={aiInput}
                onChange={(e) => setAiInput(e.target.value)}
                placeholder={tr(lang, 'aiPh')}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    if (aiInput.trim()) navigate(`#/ai/${encodeURIComponent(aiInput.trim())}`);
                  }
                }}
                className="flex-1 border-0 outline-none resize-none text-base bg-transparent py-1.5"
              />
              <div className="flex items-center gap-2 justify-end shrink-0">
                <button
                  type="button"
                  onClick={() => {
                    type SRInstance = {
                      lang: string;
                      onresult: ((ev: { results: { 0: { 0: { transcript: string } } } }) => void) | null;
                      onend: (() => void) | null;
                      onerror: (() => void) | null;
                      start: () => void;
                    };
                    const w = window as unknown as { SpeechRecognition?: new () => SRInstance; webkitSpeechRecognition?: new () => SRInstance };
                    const SR = w.SpeechRecognition || w.webkitSpeechRecognition;
                    if (!SR) return toast('Voice input not supported');
                    const r = new SR();
                    r.lang = lang === 'en' ? 'en-IN' : 'hi-IN';
                    setAiListening(true);
                    r.onresult = (ev) => {
                      const v = ev.results[0][0].transcript;
                      setAiInput(v);
                      navigate(`#/ai/${encodeURIComponent(v)}`);
                    };
                    r.onend = () => setAiListening(false);
                    r.onerror = () => setAiListening(false);
                    r.start();
                  }}
                  className={`w-11 h-11 rounded-full flex items-center justify-center cursor-pointer ${aiListening ? 'bg-[#d6262f] text-white animate-pulse' : 'bg-[#eef3fb] text-[#011f43]'}`}
                >
                  <Mic className="w-5 h-5" />
                </button>
                <button type="submit" className="h-11 px-5 rounded-full bg-[#011f43] text-white font-bold text-sm cursor-pointer">
                  ✦ {tr(lang, 'aiAsk')}
                </button>
              </div>
            </form>

            <div className="flex flex-wrap gap-2">
              {examples.map((ex) => (
                <button
                  key={ex}
                  type="button"
                  onClick={() => navigate(`#/ai/${encodeURIComponent(ex)}`)}
                  className="bg-white text-[#011f43] border border-[#dbe3ef] rounded-full px-3.5 py-1.5 text-xs font-semibold hover:bg-[#011f43] hover:text-white transition-colors cursor-pointer"
                >
                  {ex}
                </button>
              ))}
            </div>
            <p className="text-xs text-[#4a5370] mt-3 mb-0">{tr(lang, 'aiNote')}</p>
          </div>

          {aiOut && (
            <div className="mt-6">
              <div className="flex flex-wrap items-center gap-2 text-sm text-[#011f43] mb-4">
                <b>✦ {tr(lang, 'aiGot')}:</b>
                {[...aiOut.P.topics.map((k) => `🏷 ${k}`), ...aiOut.P.free.map((f) => `🔤 ${f}`), aiOut.P.lic ? `📄 ${aiOut.P.lic}` : '', aiOut.P.o ? `📐 ${aiOut.P.o}` : ''].filter(Boolean).map((chip) => (
                  <span key={chip} className="bg-white border border-[#dbe3ef] rounded-full px-3 py-1 text-xs font-semibold">{chip}</span>
                ))}
              </div>
              <h3 className="dm text-2xl text-[#011f43] mb-3">{aiOut.results.length} {tr(lang, 'results')}</h3>
              {aiOut.results.length ? renderMasonry(aiOut.results) : <div className="py-10 text-center text-[#5c6170]">{tr(lang, 'aiNone')}</div>}
            </div>
          )}
        </section>
      );
    }

    /* ---------- CONTRIBUTOR ---------- */
    if (page === 'contributor') {
      return (
        <ContributorPage
          tab={args[0] || 'dashboard'}
          lang={lang}
          user={user}
          assets={assets}
          orders={orders}
          payouts={payouts}
          siteConfig={siteConfig}
          money={money}
          onNavigate={navigate}
          onOpenAuth={(m) => { setAuthPortal('contributor'); setAuthModal(m || 'register'); }}
          onRefresh={fetchState}
          onDeleteAsset={handleDeletePhoto}
          toast={toast}
        />
      );
    }

    /* ---------- ADMIN DASHBOARD ---------- */
    if (page === 'admin') {
      return (
        <AdminDashboard
          tab={args[0] || 'review'}
          user={user}
          assets={assets}
          orders={orders}
          payouts={payouts}
          users={users}
          messages={messages}
          siteConfig={siteConfig}
          money={money}
          adminMode={adminMode}
          onToggleAdminMode={() => setAdminMode((v) => !v)}
          onAdminEdit={setAdminEditTarget}
          onNavigate={navigate}
          onOpenAuth={(m) => { setAuthPortal('admin'); setAuthModal(m || 'login'); }}
          onRefresh={fetchState}
          onSaveConfig={handleSaveConfig}
          onDeleteAsset={handleDeletePhoto}
          toast={toast}
        />
      );
    }

    return (
      <section className="wrap py-16 text-center">
        <h2 className="dm text-4xl text-[#011f43]">404</h2>
        <button type="button" onClick={() => navigate('#/')} className="mt-3 px-5 py-2 rounded-lg bg-[#011f43] text-white font-semibold cursor-pointer">
          Home
        </button>
      </section>
    );
  };

  return (
    <div className="min-h-screen flex flex-col">
      <Header
        lang={lang}
        onChangeLang={setLang}
        siteConfig={siteConfig}
        user={user}
        cartCount={cart.length}
        dark={dark}
        onToggleDark={() => setDark((d) => !d)}
        fontSizeStep={fontSizeStep}
        onCycleFontSize={() => setFontSizeStep((s) => (s + 1) % 3)}
        currentPage={route.page}
        searchQ={route.page === 'search' ? route.params.get('q') || '' : ''}
        searchLic={route.page === 'search' ? route.params.get('lic') || '' : ''}
        onSearch={handleSearchGo}
        onNavigate={navigate}
        onOpenAuth={(m, pt) => { if (pt) setAuthPortal(pt); setAuthModal(m || 'login'); }}
        adminMode={adminMode}
        onToggleAdminMode={() => {
          setAdminMode((v) => {
            const next = !v;
            toast(next ? 'Admin Mode ON — Click any highlighted part to edit/add/update/delete!' : 'Admin Mode OFF');
            return next;
          });
        }}
        onAdminEdit={setAdminEditTarget}
        toast={toast}
      />

      <main className="flex-1">
        <React.Suspense
          fallback={
            <div className="wrap py-20 flex justify-center" aria-busy="true">
              <span className="w-8 h-8 rounded-full border-[3px] border-[#e1e5ec] border-t-[#d6262f] animate-spin" />
            </div>
          }
        >
          {renderPage()}
        </React.Suspense>
      </main>

      <Footer
        lang={lang}
        onChangeLang={setLang}
        siteConfig={siteConfig}
        adminMode={adminMode}
        onAdminEdit={setAdminEditTarget}
        onNavigate={navigate}
        toast={toast}
      />

      <TextReader lang={lang} onChangeLang={setLang} externalText={readerSpeech} toast={toast} />

      {adminMode && user?.role === 'admin' && (
        <AdminDock
          onEdit={setAdminEditTarget}
          onNavigate={navigate}
          onExit={() => setAdminMode(false)}
        />
      )}

      {authModal && (
        <React.Suspense fallback={null}>
        <AuthModal
          initialMode={authModal}
          initialPortal={authPortal}
          onClose={() => setAuthModal(null)}
          onSuccess={async (loggedUser) => {
            setAuthModal(null);
            setUser(loggedUser);
            await fetchState();
          }}
          toast={toast}
        />
        </React.Suspense>
      )}

      {adminEditTarget && user?.role === 'admin' && (
        <React.Suspense fallback={null}>
        <AdminEditModal
          target={adminEditTarget}
          siteConfig={siteConfig}
          assets={assets}
          users={users}
          onClose={() => setAdminEditTarget(null)}
          onSaveConfig={handleSaveConfig}
          onSavePhoto={handleSavePhoto}
          onDeletePhoto={handleDeletePhoto}
          toast={toast}
        />
        </React.Suspense>
      )}

      {toastMsg && (
        <div className="noprint fixed bottom-[76px] left-1/2 -translate-x-1/2 bg-[#011f43] text-white px-5 py-3 rounded-xl z-50 shadow-xl text-sm font-semibold">
          {toastMsg}
        </div>
      )}
    </div>
  );
}
