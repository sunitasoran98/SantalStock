import React, { useEffect, useRef, useState } from 'react';
import { Filter, ChevronDown, Mic, Search, Pencil } from 'lucide-react';
import { SLIDES, tr } from '../data/defaults';
import type { LangCode, SiteConfig } from '../types';

interface SearchCapsuleProps {
  lang: LangCode;
  siteConfig: SiteConfig;
  initialQ?: string;
  initialLic?: string;
  compact?: boolean;
  adminMode?: boolean;
  onEditSearch?: () => void;
  onSearch: (q: string, lic: string) => void;
  toast: (m: string) => void;
}

export function SearchCapsule({
  lang,
  siteConfig,
  initialQ = '',
  initialLic = '',
  compact = false,
  adminMode = false,
  onEditSearch,
  onSearch,
  toast,
}: SearchCapsuleProps) {
  const [q, setQ] = useState(initialQ);
  const [lic, setLic] = useState(initialLic);
  const [menuOpen, setMenuOpen] = useState(false);
  const [listening, setListening] = useState(false);
  const wrapRef = useRef<HTMLFormElement>(null);

  useEffect(() => {
    setQ(initialQ);
  }, [initialQ]);

  useEffect(() => {
    setLic(initialLic);
  }, [initialLic]);

  useEffect(() => {
    const onDocClick = (e: MouseEvent) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) {
        setMenuOpen(false);
      }
    };
    document.addEventListener('click', onDocClick);
    return () => document.removeEventListener('click', onDocClick);
  }, []);

  const segs: [string, string, string][] = [
    ['', tr(lang, 'all'), tr(lang, 'allLang')],
    ['rf', tr(lang, 'rf'), 'RF'],
    ['editorial', tr(lang, 'ed'), 'ED'],
  ];
  const cur = segs.find((s) => s[0] === lic) || segs[0];
  const placeholder =
    siteConfig.brand.searchPlaceholderCustom ||
    `${tr(lang, 'eg')}: ${SLIDES[lang].slice(0, 3).join('  ·  ')}`;

  function handleVoice() {
    type SRInstance = {
      lang: string;
      interimResults: boolean;
      onresult: ((ev: { results: { 0: { 0: { transcript: string } } } }) => void) | null;
      onend: (() => void) | null;
      onerror: (() => void) | null;
      start: () => void;
    };
    const w = window as unknown as { SpeechRecognition?: new () => SRInstance; webkitSpeechRecognition?: new () => SRInstance };
    const SR = w.SpeechRecognition || w.webkitSpeechRecognition;
    if (!SR) {
      toast('Voice search is not supported in this browser');
      return;
    }
    const r = new SR();
    r.lang = lang === 'en' ? 'en-IN' : 'hi-IN';
    r.interimResults = false;
    setListening(true);
    r.onresult = (ev) => {
      const spoken = ev.results[0][0].transcript;
      setQ(spoken);
      onSearch(spoken, lic);
    };
    r.onend = () => setListening(false);
    r.onerror = () => setListening(false);
    r.start();
  }

  return (
    <form
      ref={wrapRef}
      onSubmit={(e) => {
        e.preventDefault();
        onSearch(q.trim(), lic);
      }}
      className={`searchbox relative flex items-center mx-auto bg-white rounded-full border border-[#c5cfe0] shadow-[0_8px_22px_rgba(1,31,67,0.08)] transition-shadow text-left ${
        compact ? 'h-[48px] max-w-[640px]' : 'h-[60px] max-w-[960px]'
      }`}
    >
      <button
        type="button"
        onClick={() => setMenuOpen((o) => !o)}
        className={`flex items-center gap-2 rounded-full border font-bold whitespace-nowrap shrink-0 cursor-pointer transition-colors ${
          compact ? 'h-[36px] text-sm px-2.5 ml-1.5' : 'h-[44px] text-[16px] px-3.5 ml-3'
        } ${
          lic
            ? 'bg-[#011f43] text-white border-[#011f43]'
            : 'bg-[#f4f7fc] text-[#011f43] border-[#dbe3ef] hover:border-[#9fb0cc]'
        }`}
      >
        <Filter className={compact ? 'w-4 h-4' : 'w-5 h-5'} />
        <span className="hidden sm:inline">{cur[1]}</span>
        <ChevronDown className="w-4 h-4" />
      </button>

      {menuOpen && (
        <div className="absolute left-2 top-[calc(100%+8px)] z-50 bg-white border border-[#dbe3ef] rounded-2xl shadow-[0_18px_40px_-12px_rgba(1,31,67,0.35)] p-1.5 min-w-[230px]">
          {segs.map(([val, label, sub]) => (
            <button
              key={val || 'all'}
              type="button"
              onClick={() => {
                setLic(val);
                setMenuOpen(false);
              }}
              className={`flex items-center justify-between gap-2 w-full px-3 py-2.5 rounded-xl text-sm font-semibold text-[#011f43] cursor-pointer ${
                val === lic ? 'bg-[#eef3fb]' : 'hover:bg-[#eef3fb]'
              }`}
            >
              <span>{label}</span>
              <small className="font-normal text-[#6b7387] text-xs">{sub}</small>
            </button>
          ))}
        </div>
      )}

      <div className="inw relative flex-1 min-w-0 self-stretch my-1.5 mr-1 ml-5 rounded-full bg-[#fbfcfe] shadow-[0_3px_10px_-2px_rgba(1,31,67,0.12),inset_0_0_0_1px_#e3e9f2] flex items-center">
        <input
          type="search"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder={placeholder}
          aria-label={tr(lang, 'search')}
          className={`border-0 bg-transparent h-full w-full rounded-full outline-none text-[#111] placeholder:text-[#5f6577] ${
            compact ? 'text-[15px] px-3.5' : 'text-[17px] px-4'
          }`}
        />
        <button
          type="button"
          onClick={handleVoice}
          title={tr(lang, 'aiMic')}
          aria-label={tr(lang, 'aiMic')}
          className={`rounded-full flex items-center justify-center mr-1.5 shrink-0 cursor-pointer transition-colors ${
            compact ? 'w-8 h-8' : 'w-10 h-10'
          } ${
            listening
              ? 'bg-[#d6262f] text-white animate-pulse'
              : 'bg-[#eef3fb] text-[#011f43] hover:bg-[#dbe5f5]'
          }`}
        >
          <Mic className="w-4 h-4" />
        </button>
      </div>

      {/* Distinctly colored Search Button (marked in user's screenshot) */}
      <div className="relative flex items-center shrink-0 mr-1.5">
        <button
          type={adminMode ? 'button' : 'submit'}
          onClick={(e) => {
            if (adminMode && onEditSearch) {
              e.preventDefault();
              e.stopPropagation();
              onEditSearch();
            }
          }}
          aria-label={tr(lang, 'search')}
          title={adminMode ? 'Click to edit Search button color' : tr(lang, 'search')}
          style={{
            backgroundColor: siteConfig.brand.searchBtnBg,
            color: siteConfig.brand.searchBtnIcon,
          }}
          className={`no-invert rounded-full flex items-center justify-center shrink-0 cursor-pointer transition-transform hover:scale-105 shadow-md ${
            compact ? 'w-9 h-9' : 'w-12 h-12'
          } ${adminMode ? 'ring-2 ring-dashed ring-[#d6262f] ring-offset-2' : ''}`}
        >
          <Search className={compact ? 'w-4 h-4' : 'w-5 h-5'} strokeWidth={2.6} />
        </button>
        {adminMode && onEditSearch && (
          <button
            type="button"
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              onEditSearch();
            }}
            className="absolute -top-3 -right-2 bg-[#d6262f] text-white rounded-full p-1 shadow cursor-pointer"
            title="Edit Search button color"
          >
            <Pencil className="w-2.5 h-2.5" />
          </button>
        )}
      </div>
    </form>
  );
}
