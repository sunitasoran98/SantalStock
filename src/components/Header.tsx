import React, { useEffect, useRef, useState } from 'react';
import {
  SlidersHorizontal,
  ShoppingCart,
  User as UserIcon,
  Lock,
  Sparkles,
  Heart,
  Wrench,
  Shield,
  Pencil,
} from 'lucide-react';
import { getSantaliDateTime, LANGS, tr } from '../data/defaults';
import { SearchCapsule } from './SearchCapsule';
import type { AdminEditTarget, LangCode, SiteConfig, User } from '../types';

interface HeaderProps {
  lang: LangCode;
  onChangeLang: (l: LangCode) => void;
  siteConfig: SiteConfig;
  user: User | null;
  cartCount: number;
  dark: boolean;
  onToggleDark: () => void;
  fontSizeStep: number;
  onCycleFontSize: () => void;
  currentPage: string;
  searchQ: string;
  searchLic: string;
  onSearch: (q: string, lic: string) => void;
  onNavigate: (hash: string) => void;
  onOpenAuth: (mode?: 'login' | 'register') => void;
  adminMode: boolean;
  onToggleAdminMode: () => void;
  onAdminEdit: (target: AdminEditTarget) => void;
  toast: (m: string) => void;
}

export function Header({
  lang,
  onChangeLang,
  siteConfig,
  user,
  cartCount,
  dark,
  onToggleDark,
  fontSizeStep,
  onCycleFontSize,
  currentPage,
  searchQ,
  searchLic,
  onSearch,
  onNavigate,
  onOpenAuth,
  adminMode,
  onToggleAdminMode,
  onAdminEdit,
  toast,
}: HeaderProps) {
  const [langMenuOpen, setLangMenuOpen] = useState(false);
  const [sdt, setSdt] = useState(() => getSantaliDateTime(lang));
  const langRef = useRef<HTMLDivElement>(null);
  const isCompact = currentPage !== '';

  useEffect(() => {
    setSdt(getSantaliDateTime(lang));
    const timer = setInterval(() => setSdt(getSantaliDateTime(lang)), 20000);
    return () => clearInterval(timer);
  }, [lang]);

  useEffect(() => {
    const onDocClick = (e: MouseEvent) => {
      if (langRef.current && !langRef.current.contains(e.target as Node)) {
        setLangMenuOpen(false);
      }
    };
    document.addEventListener('click', onDocClick);
    return () => document.removeEventListener('click', onDocClick);
  }, []);

  const langShort = (LANGS.find((l) => l.k === lang) || LANGS[0]).short;

  return (
    <header
      className={`bg-gradient-to-b from-[#f5f8fd] to-[#eef3fb] text-[#13203a] z-30 ${
        isCompact ? 'sticky top-0 border-b border-[#d6deeb] shadow-[0_4px_14px_-8px_rgba(1,31,67,0.18)]' : 'relative'
      }`}
    >
      <div
        className={`wrap flex items-center justify-between gap-4 flex-wrap lg:flex-nowrap ${
          isCompact ? 'py-3.5' : 'pt-7 pb-4'
        }`}
      >
        {/* Brand column: Distinct colored SANTAL + STOCK + live Santali date */}
        <div className="flex flex-col items-start gap-2 shrink-0">
          <div className="relative flex items-center">
            <a
              href="#/"
              onClick={(e) => {
                e.preventDefault();
                if (adminMode) {
                  onAdminEdit({ section: 'brandLogo' });
                } else {
                  onNavigate('#/');
                }
              }}
              className={`no-invert font-bold no-underline whitespace-nowrap transition-opacity ${
                isCompact ? 'text-[22px] tracking-[5px]' : 'text-[27px] tracking-[7px]'
              } ${adminMode ? 'admin-edit-zone px-1.5 py-0.5' : ''}`}
              title={adminMode ? 'Click to edit Logo text & colors' : 'SantalStock Home'}
            >
              <span style={{ color: siteConfig.brand.logoPart1.color }}>
                {siteConfig.brand.logoPart1.text}
              </span>
              <span style={{ color: siteConfig.brand.logoPart2.color }}>
                {siteConfig.brand.logoPart2.text}
              </span>
            </a>
            {adminMode && (
              <button
                type="button"
                onClick={() => onAdminEdit({ section: 'brandLogo' })}
                className="ml-1.5 bg-[#d6262f] text-white rounded-full p-1 shadow cursor-pointer"
                title="Edit Brand Logo & Colors"
              >
                <Pencil className="w-3 h-3" />
              </button>
            )}
          </div>

          <div
            className={`sdt inline-flex items-center gap-1.5 rounded-full font-bold text-[#011f43] whitespace-nowrap ${
              isCompact ? 'text-[11.5px] px-2.5 py-1' : 'text-[12.5px] px-3 py-1'
            }`}
          >
            <span className="font-extrabold text-[#d6262f] tabular-nums">{sdt.time}</span>
            <span>{sdt.day}</span>
            <span className="text-[#1f3a63] font-semibold">{sdt.dateText}</span>
          </div>
        </div>

        {/* Mini Search on sub-pages */}
        {isCompact && (
          <div className="flex-1 min-w-[260px] max-w-[600px] mx-2 order-3 lg:order-none w-full lg:w-auto">
            <SearchCapsule
              lang={lang}
              siteConfig={siteConfig}
              initialQ={searchQ}
              initialLic={searchLic}
              compact
              adminMode={adminMode}
              onEditSearch={() => onAdminEdit({ section: 'searchBar' })}
              onSearch={onSearch}
              toast={toast}
            />
          </div>
        )}

        {/* Circular Tool Icons */}
        <nav className="flex items-center gap-1.5 sm:gap-2.5 xl:gap-4 shrink-0 flex-wrap justify-end max-w-full">
          <button
            type="button"
            onClick={onToggleDark}
            title="Dark mode"
            className="flex items-center gap-2 text-[#13203a] text-[14px] leading-tight cursor-pointer bg-transparent border-0 p-0 group"
          >
            <span className="w-9 h-9 sm:w-10 sm:h-10 xl:w-11 xl:h-11 rounded-full bg-[#011f43] text-white flex items-center justify-center text-lg shrink-0 transition-transform group-hover:-translate-y-0.5">
              {dark ? '☀️' : '🌙'}
            </span>
            {!isCompact && (
              <span className="hidden xl:inline text-left whitespace-nowrap">
                Dark<br />mode
              </span>
            )}
          </button>

          <button
            type="button"
            onClick={onCycleFontSize}
            title="Text size"
            className="flex items-center gap-2 text-[#13203a] text-[14px] leading-tight cursor-pointer bg-transparent border-0 p-0 group"
          >
            <span className="w-9 h-9 sm:w-10 sm:h-10 xl:w-11 xl:h-11 rounded-full bg-[#011f43] text-white flex items-center justify-center text-sm font-extrabold shrink-0 transition-transform group-hover:-translate-y-0.5">
              {['A', 'A+', 'A++'][fontSizeStep]}
            </span>
            {!isCompact && (
              <span className="hidden xl:inline text-left whitespace-nowrap">
                Text<br />size
              </span>
            )}
          </button>

          <div ref={langRef} className="relative">
            <button
              type="button"
              onClick={() => setLangMenuOpen((o) => !o)}
              title="Language"
              className="flex items-center gap-2 text-[#13203a] text-[14px] leading-tight cursor-pointer bg-transparent border-0 p-0 group"
            >
              <span className="w-9 h-9 sm:w-10 sm:h-10 xl:w-11 xl:h-11 rounded-full bg-[#011f43] text-white flex items-center justify-center text-base font-bold font-serif shrink-0 transition-transform group-hover:-translate-y-0.5">
                {langShort}
              </span>
              {!isCompact && (
                <span className="hidden xl:inline text-left whitespace-nowrap">
                  Lang-<br />uage
                </span>
              )}
            </button>
            {langMenuOpen && (
              <div className="absolute right-0 top-[calc(100%+8px)] z-50 bg-white border border-[#dbe3ef] rounded-2xl shadow-[0_18px_40px_-12px_rgba(1,31,67,0.35)] p-1.5 min-w-[210px]">
                {LANGS.map((l) => (
                  <button
                    key={l.k}
                    type="button"
                    onClick={() => {
                      onChangeLang(l.k);
                      setLangMenuOpen(false);
                    }}
                    className={`block w-full text-left rounded-xl px-3 py-2.5 text-[15px] font-semibold text-[#011f43] cursor-pointer ${
                      l.k === lang ? 'bg-[#eef3fb]' : 'hover:bg-[#eef3fb]'
                    }`}
                  >
                    {l.n}
                  </button>
                ))}
              </div>
            )}
          </div>

          <button
            type="button"
            onClick={() => onNavigate('#/about')}
            title="About"
            className="hidden sm:flex items-center text-[#13203a] cursor-pointer bg-transparent border-0 p-0 group"
          >
            <span className="w-9 h-9 sm:w-10 sm:h-10 xl:w-11 xl:h-11 rounded-full bg-[#011f43] text-white flex items-center justify-center font-serif font-bold text-lg shrink-0 transition-transform group-hover:-translate-y-0.5">
              i
            </span>
          </button>

          <button
            type="button"
            onClick={() => onNavigate('#/search')}
            title="Advance search"
            className="flex items-center gap-2 text-[#13203a] text-[14px] leading-tight cursor-pointer bg-transparent border-0 p-0 group"
          >
            <span className="w-9 h-9 sm:w-10 sm:h-10 xl:w-11 xl:h-11 rounded-full bg-[#011f43] text-white flex items-center justify-center shrink-0 transition-transform group-hover:-translate-y-0.5">
              <SlidersHorizontal className="w-4 h-4" />
            </span>
            {!isCompact && (
              <span className="hidden xl:inline text-left whitespace-nowrap">
                Advance<br />search
              </span>
            )}
          </button>

          <button
            type="button"
            onClick={() => onNavigate('#/ai')}
            title="AI search"
            className="flex items-center gap-2 text-[#13203a] text-[14px] leading-tight cursor-pointer bg-transparent border-0 p-0 group"
          >
            <span className="w-9 h-9 sm:w-10 sm:h-10 xl:w-11 xl:h-11 rounded-full bg-gradient-to-br from-[#f2b8c6] to-[#a98fd6] text-[#011f43] flex items-center justify-center shrink-0 transition-transform group-hover:-translate-y-0.5">
              <Sparkles className="w-5 h-5" />
            </span>
            {!isCompact && (
              <span className="hidden xl:inline text-left whitespace-nowrap">
                AI<br />search
              </span>
            )}
          </button>

          <button
            type="button"
            onClick={() => onNavigate('#/lightbox')}
            title="Lightbox"
            className="flex items-center text-[#13203a] cursor-pointer bg-transparent border-0 p-0 group"
          >
            <span className="w-9 h-9 sm:w-10 sm:h-10 xl:w-11 xl:h-11 rounded-full bg-[#011f43] text-white flex items-center justify-center shrink-0 transition-transform group-hover:-translate-y-0.5">
              <Heart className="w-4 h-4" />
            </span>
          </button>

          <button
            type="button"
            onClick={() => onNavigate('#/cart')}
            title="Cart"
            className="relative flex items-center text-[#13203a] cursor-pointer bg-transparent border-0 p-0 group"
          >
            <span className="w-9 h-9 sm:w-10 sm:h-10 xl:w-11 xl:h-11 rounded-full bg-[#011f43] text-white flex items-center justify-center shrink-0 transition-transform group-hover:-translate-y-0.5">
              <ShoppingCart className="w-4 h-4" />
            </span>
            <span className="absolute -right-1 -top-1 bg-[#d6262f] text-white rounded-full text-[11px] font-bold min-w-[18px] h-[18px] px-1 flex items-center justify-center border-2 border-[#f5f8fd] tabular-nums">
              {cartCount}
            </span>
          </button>

          {user ? (
            <>
              <button
                type="button"
                onClick={() => onNavigate('#/account')}
                title="Account"
                className="flex items-center gap-2 text-[#13203a] text-[14px] leading-tight cursor-pointer bg-transparent border-0 p-0 group"
              >
                <span className="w-9 h-9 sm:w-10 sm:h-10 xl:w-11 xl:h-11 rounded-full bg-[#011f43] text-white flex items-center justify-center shrink-0 transition-transform group-hover:-translate-y-0.5">
                  <UserIcon className="w-4 h-4" />
                </span>
                {!isCompact && (
                  <span className="hidden xl:inline text-left whitespace-nowrap">
                    {user.name.split(' ')[0]}
                    <br />
                    <span className="text-xs text-[#5c6170]">
                      {user.credits ? `${user.credits} cr` : 'Account'}
                    </span>
                  </span>
                )}
              </button>

              {user.role === 'admin' && (
                <>
                  <button
                    type="button"
                    onClick={() => onNavigate('#/admin')}
                    title="Admin dashboard"
                    className="flex items-center gap-2 text-[#13203a] text-[14px] leading-tight cursor-pointer bg-transparent border-0 p-0 group"
                  >
                    <span className="w-9 h-9 sm:w-10 sm:h-10 xl:w-11 xl:h-11 rounded-full bg-[#011f43] text-white flex items-center justify-center shrink-0 transition-transform group-hover:-translate-y-0.5">
                      <Shield className="w-4 h-4" />
                    </span>
                    {!isCompact && (
                      <span className="hidden 2xl:inline text-left whitespace-nowrap">
                        Admin<br />panel
                      </span>
                    )}
                  </button>

                  {/* Live Admin Edit Mode Toggle */}
                  <button
                    type="button"
                    onClick={onToggleAdminMode}
                    title="Toggle Click-to-Edit Admin Mode"
                    className={`no-invert inline-flex items-center gap-1.5 px-3 py-2 rounded-full text-xs font-extrabold whitespace-nowrap shrink-0 shadow cursor-pointer transition-all ${
                      adminMode
                        ? 'bg-[#d6262f] text-white ring-2 ring-[#d6262f]/40'
                        : 'bg-white text-[#011f43] border border-[#c5cfe0] hover:border-[#d6262f]'
                    }`}
                  >
                    <Wrench className="w-3.5 h-3.5" />
                    {adminMode ? 'Admin Mode: ON' : 'Admin Mode'}
                  </button>
                </>
              )}
            </>
          ) : (
            <button
              type="button"
              onClick={() => onOpenAuth('login')}
              title="Sign in"
              className="flex items-center gap-2 text-[#13203a] text-[14px] leading-tight cursor-pointer bg-transparent border-0 p-0 group"
            >
              <span className="w-9 h-9 sm:w-10 sm:h-10 xl:w-11 xl:h-11 rounded-full bg-[#011f43] text-white flex items-center justify-center shrink-0 transition-transform group-hover:-translate-y-0.5">
                <Lock className="w-4 h-4" />
              </span>
              {!isCompact && (
                <span className="hidden xl:inline text-left whitespace-nowrap">
                  Sign<br />in
                </span>
              )}
            </button>
          )}
        </nav>
      </div>

      {/* Sub-navigation bar */}
      <div
        className={`wrap flex items-center gap-1.5 pb-3 pt-2 mt-1 border-t border-[#e3e9f3] sm:border-t-0 sm:pt-0 sm:mt-0 overflow-x-auto ${
          isCompact ? 'justify-start lg:justify-end -mt-1' : 'justify-start sm:justify-center'
        }`}
      >
        {siteConfig.subnav.map((item) => {
          const slug = item.href.replace(/^#\/?/, '').split(/[/?]/)[0];
          const label = item.i18nKey ? tr(lang, item.i18nKey) : item.label;
          const active = currentPage === slug;
          return (
            <a
              key={item.id}
              href={item.href}
              onClick={(e) => {
                e.preventDefault();
                if (adminMode) {
                  onAdminEdit({ section: 'subnav' });
                } else {
                  onNavigate(item.href);
                }
              }}
              className={`no-underline text-[14px] font-semibold text-[#011f43] px-3 py-1.5 rounded-full whitespace-nowrap shrink-0 transition-colors ${
                active ? 'bg-[#e3eaf6]' : 'hover:bg-[#e3eaf6]'
              } ${adminMode ? 'outline-1 outline-dashed outline-[#d6262f]/60' : ''}`}
            >
              {label}
            </a>
          );
        })}
        {adminMode && (
          <button
            type="button"
            onClick={() => onAdminEdit({ section: 'subnav' })}
            className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-[#d6262f] text-white text-xs font-bold cursor-pointer shrink-0"
          >
            <Pencil className="w-3 h-3" /> Edit Nav
          </button>
        )}
      </div>
    </header>
  );
}
