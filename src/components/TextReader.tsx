import React, { useEffect, useRef, useState } from 'react';
import { ChevronDown, ChevronLeft, ChevronRight, ChevronUp, MessageSquarePlus, Pause, Play, Settings2, Square, X } from 'lucide-react';
import { openFeedback } from './FeedbackModal';

/* SantalStock's own reader mark: an open book with sound waves */
function ReaderMark({ className = '', active = false }: { className?: string; active?: boolean }) {
  return (
    <svg viewBox="0 0 32 32" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden>
      <path d="M3 8.5c3-1.6 6.3-1.6 9.5 0v15c-3.2-1.6-6.5-1.6-9.5 0z" />
      <path d="M12.5 8.5c3.2-1.6 6.5-1.6 9.5 0v15c-3-1.6-6.3-1.6-9.5 0" />
      <path d="M25 12.5c1.2 1 1.8 2.2 1.8 3.5s-.6 2.5-1.8 3.5" className={active ? 'animate-pulse' : ''} />
      <path d="M27.8 9.8c2 1.7 3 3.8 3 6.2s-1 4.5-3 6.2" className={active ? 'animate-pulse' : ''} opacity=".75" />
    </svg>
  );
}
import { LANGS, tr } from '../data/defaults';
import type { LangCode } from '../types';

interface TextReaderProps {
  lang: LangCode;
  onChangeLang: (lang: LangCode) => void;
  externalText?: { id: number; text: string } | null;
  toast: (m: string) => void;
}

export function TextReader({ lang, onChangeLang, externalText, toast }: TextReaderProps) {
  const [open, setOpen] = useState(false);
  const [state, setState] = useState<'idle' | 'play' | 'paused'>('idle');
  const [parts, setParts] = useState<string[]>([]);
  const [idx, setIdx] = useState(0);
  const [rate, setRate] = useState<number>(() => {
    try {
      return Number(localStorage.getItem('ss_rate') || 1);
    } catch {
      return 1;
    }
  });

  const partsRef = useRef<string[]>([]);
  const idxRef = useRef(0);
  const stateRef = useRef<'idle' | 'play' | 'paused'>('idle');
  const tokenRef = useRef(0);
  const rateRef = useRef(rate);
  rateRef.current = rate;

  const splitText = (x: string) =>
    x
      .replace(/\s+\n/g, '\n')
      .split(/(?<=[.!?।॥])\s+|\n+/)
      .map((s) => s.trim())
      .filter((s) => s.length > 1)
      .flatMap((s) => (s.length > 220 ? s.match(/.{1,200}(\s|$)/g) || [s] : [s]));

  const stop = () => {
    tokenRef.current += 1;
    if ('speechSynthesis' in window) window.speechSynthesis.cancel();
    stateRef.current = 'idle';
    idxRef.current = 0;
    setState('idle');
    setIdx(0);
  };

  const speakNext = () => {
    if (stateRef.current !== 'play') return;
    if (idxRef.current >= partsRef.current.length) {
      stateRef.current = 'idle';
      setState('idle');
      return;
    }
    const want = (LANGS.find((l) => l.k === lang) || LANGS[0]).v;
    const vs = window.speechSynthesis.getVoices();
    const voice = vs.find((v) => v.lang === want) || vs.find((v) => v.lang.startsWith(want.slice(0, 2))) || null;

    const myToken = tokenRef.current;
    const u = new SpeechSynthesisUtterance(partsRef.current[idxRef.current]);
    if (voice) {
      u.voice = voice;
      u.lang = voice.lang;
    } else {
      u.lang = want;
    }
    u.rate = rateRef.current;
    u.onend = () => {
      if (myToken !== tokenRef.current) return;
      idxRef.current += 1;
      setIdx(idxRef.current);
      speakNext();
    };
    u.onerror = () => {
      if (myToken !== tokenRef.current) return;
      if (stateRef.current === 'play') {
        idxRef.current += 1;
        setIdx(idxRef.current);
        speakNext();
      }
    };
    window.speechSynthesis.speak(u);
  };

  const startReading = (rawText?: string) => {
    if (!('speechSynthesis' in window)) {
      toast(tr(lang, 'noVoice'));
      return;
    }
    if (!rawText && stateRef.current === 'paused') {
      window.speechSynthesis.resume();
      stateRef.current = 'play';
      setState('play');
      return;
    }
    stop();
    let txt = rawText || '';
    if (!txt) {
      const sel = String(window.getSelection?.() || '').trim();
      if (sel) txt = sel;
      else {
        const main = document.querySelector('main');
        if (main) {
          const clone = main.cloneNode(true) as HTMLElement;
          clone.querySelectorAll('script,style,select,.noprint,button,input,textarea').forEach((e) => e.remove());
          txt = clone.innerText;
        }
      }
    }
    const list = splitText(txt);
    partsRef.current = list;
    idxRef.current = 0;
    stateRef.current = 'play';
    setParts(list);
    setIdx(0);
    setState('play');
    speakNext();
  };

  const pause = () => {
    if (stateRef.current === 'play') {
      window.speechSynthesis.pause();
      stateRef.current = 'paused';
      setState('paused');
    }
  };

  const loadPageText = () => {
    const sel = String(window.getSelection?.() || '').trim();
    if (sel) return splitText(sel);
    const main = document.querySelector('main');
    if (!main) return [];
    const clone = main.cloneNode(true) as HTMLElement;
    clone.querySelectorAll('script,style,select,.noprint,button,input,textarea').forEach((e) => e.remove());
    return splitText(clone.innerText);
  };

  // Home / Prev / Next / End: jump to a line and keep reading from there
  const jump = (where: 'first' | 'prev' | 'next' | 'last') => {
    if (!('speechSynthesis' in window)) {
      toast(tr(lang, 'noVoice'));
      return;
    }
    if (!partsRef.current.length) {
      const list = loadPageText();
      if (!list.length) return;
      partsRef.current = list;
      setParts(list);
    }
    const max = partsRef.current.length - 1;
    const cur = Math.min(idxRef.current, max);
    const target =
      where === 'first' ? 0 : where === 'last' ? max : where === 'prev' ? Math.max(0, cur - 1) : Math.min(max, cur + 1);
    tokenRef.current += 1;
    window.speechSynthesis.cancel();
    idxRef.current = target;
    setIdx(target);
    stateRef.current = 'play';
    setState('play');
    speakNext();
  };

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement | null;
      if (t && (t.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(t.tagName))) return;
      if (!e.altKey) return;
      const map: Record<string, 'first' | 'prev' | 'next' | 'last'> = {
        Home: 'first',
        ArrowUp: 'first',
        ArrowDown: 'last',
        ArrowLeft: 'prev',
        ArrowRight: 'next',
        End: 'last',
      };
      const w = map[e.key];
      if (w) {
        e.preventDefault();
        jump(w);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lang]);

  useEffect(() => {
    if (externalText?.text) {
      setOpen(true);
      startReading(externalText.text);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [externalText?.id]);

  useEffect(() => {
    return () => {
      if ('speechSynthesis' in window) window.speechSynthesis.cancel();
    };
  }, []);

  // Lift the dock above the footer's legal bar so it never covers text
  const [lift, setLift] = useState(0);
  useEffect(() => {
    let raf = 0;
    const calc = () => {
      raf = 0;
      const el = document.getElementById('ss-legal');
      if (!el) return setLift(0);
      const over = window.innerHeight - el.getBoundingClientRect().top;
      setLift(over > 0 ? Math.round(over) : 0);
    };
    const on = () => { if (!raf) raf = requestAnimationFrame(calc); };
    calc();
    window.addEventListener('scroll', on, { passive: true });
    window.addEventListener('resize', on);
    return () => {
      window.removeEventListener('scroll', on);
      window.removeEventListener('resize', on);
      if (raf) cancelAnimationFrame(raf);
    };
  }, []);

  const pct = parts.length ? Math.round((idx / parts.length) * 100) : 0;

  return (
    <div className="noprint">
      {/* One floating dock, stacked top to bottom: [Home ▲] [reader] [settings] [feedback] [End ▼] */}
      <div
        className="fixed right-2 sm:right-4 bottom-3 sm:bottom-5 z-40 transition-transform duration-150 flex flex-col items-center gap-0.5 px-1 py-1.5 rounded-full bg-gradient-to-b from-[#14958a] to-[#0f766e] backdrop-blur text-white shadow-[0_12px_32px_-10px_rgba(15,118,110,0.65)] ring-1 ring-white/20"
        style={{ marginBottom: 'env(safe-area-inset-bottom)', transform: lift ? `translateY(-${lift}px)` : undefined }}
        role="toolbar"
        aria-orientation="vertical"
        aria-label="Page tools"
      >
        <button
          type="button"
          onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
          aria-label={tr(lang, 'pgTop')}
          title={`${tr(lang, 'pgTop')} · Home`}
          className="w-10 py-1 rounded-full flex flex-col items-center leading-none text-[9.5px] font-bold tracking-wide cursor-pointer hover:bg-white/15 transition"
        >
          <ChevronUp className="w-4 h-4 text-[#fff1b8]" strokeWidth={2.75} aria-hidden />
          Home
        </button>
        <span className="h-px w-5 bg-white/25" aria-hidden />
        <button
          type="button"
          onClick={() => (state === 'play' ? pause() : startReading())}
          aria-label={state === 'play' ? tr(lang, 'pause') : state === 'paused' ? tr(lang, 'resume') : tr(lang, 'listen')}
          title={`${tr(lang, 'reader')} · ${state === 'play' ? tr(lang, 'pause') : tr(lang, 'listen')}`}
          aria-pressed={state === 'play'}
          className={`relative w-9 h-9 rounded-full flex items-center justify-center cursor-pointer transition ${
            state === 'play' ? 'bg-[#d6262f] text-white' : 'hover:bg-white/15 text-[#fff1b8]'
          }`}
        >
          {state === 'play' ? <Pause className="w-4 h-4" aria-hidden /> : <ReaderMark className="w-[18px] h-[18px]" />}
          {state === 'paused' && <span className="absolute top-1 right-1 w-1.5 h-1.5 rounded-full bg-[#ffd479]" aria-hidden />}
        </button>
        <button
          type="button"
          onClick={() => setOpen((o) => !o)}
          aria-label={tr(lang, 'reader')}
          aria-expanded={open}
          title={tr(lang, 'reader')}
          className={`w-9 h-8 rounded-full flex items-center justify-center cursor-pointer transition text-white ${open ? 'bg-white/25' : 'hover:bg-white/15'}`}
        >
          <Settings2 className="w-4 h-4" aria-hidden />
        </button>
        <button
          type="button"
          onClick={openFeedback}
          aria-label="Suggestion / Feedback"
          title="Suggestion / Feedback"
          className="w-9 h-8 rounded-full flex items-center justify-center cursor-pointer hover:bg-white/15 text-[#ffd6d9] transition"
        >
          <MessageSquarePlus className="w-4 h-4" aria-hidden />
        </button>
        <span className="h-px w-5 bg-white/25" aria-hidden />
        <button
          type="button"
          onClick={() => window.scrollTo({ top: document.documentElement.scrollHeight, behavior: 'smooth' })}
          aria-label={tr(lang, 'pgEnd')}
          title={`${tr(lang, 'pgEnd')} · End`}
          className="w-10 py-1 rounded-full flex flex-col items-center leading-none text-[9.5px] font-bold tracking-wide cursor-pointer hover:bg-white/15 transition"
        >
          End
          <ChevronDown className="w-4 h-4 text-[#fff1b8]" strokeWidth={2.75} aria-hidden />
        </button>
      </div>

      {open && (
        <div className="fixed right-[60px] sm:right-[72px] bottom-3 sm:bottom-5 z-40 bg-white/95 backdrop-blur border border-[#d9dbe1] rounded-2xl shadow-[0_24px_48px_-16px_rgba(1,31,67,0.45)] p-4 w-[300px] max-w-[calc(100vw-32px)]">
          <div className="flex items-center justify-between mb-2">
            <h4 className="m-0 font-bold text-sm text-[#011f43] flex items-center gap-2"><span className="w-7 h-7 rounded-lg bg-[#011f43] text-white flex items-center justify-center"><ReaderMark className="w-4.5 h-4.5" active={state === 'play'} /></span> {tr(lang, 'reader')}</h4>
            <button
              type="button"
              onClick={() => setOpen(false)}
              aria-label="Close"
              className="p-1 rounded-md border border-[#d9dbe1] bg-white text-[#011f43] cursor-pointer"
            >
              <X className="w-3.5 h-3.5" aria-hidden />
            </button>
          </div>
          <div className="flex gap-2">
            {state === 'play' ? (
              <button
                type="button"
                onClick={pause}
                className="flex-1 py-1.5 px-2.5 rounded-lg bg-[#011f43] text-white text-xs font-semibold cursor-pointer"
              >
                <Pause className="w-3.5 h-3.5 inline -mt-0.5 mr-1" aria-hidden />{tr(lang, 'pause')}
              </button>
            ) : (
              <button
                type="button"
                onClick={() => startReading()}
                className="flex-1 py-1.5 px-2.5 rounded-lg bg-[#011f43] text-white text-xs font-semibold cursor-pointer"
              >
                <Play className="w-3.5 h-3.5 inline -mt-0.5 mr-1" aria-hidden />{state === 'paused' ? tr(lang, 'resume') : tr(lang, 'readPage')}
              </button>
            )}
            <button
              type="button"
              onClick={stop}
              className="flex-1 py-1.5 px-2.5 rounded-lg border border-[#d9dbe1] bg-white text-[#011f43] text-xs font-semibold cursor-pointer"
            >
              <Square className="w-3.5 h-3.5 inline -mt-0.5 mr-1" aria-hidden />{tr(lang, 'stop')}
            </button>
          </div>
          <div className="mt-3 flex flex-col items-center gap-1" role="group" aria-label={tr(lang, 'reader')}>
            {(() => {
              const Key = ({ w, Icon, k, kbd, cap }: { w: 'first' | 'prev' | 'next' | 'last'; Icon: typeof ChevronUp; k: string; kbd: string; cap: string }) => (
                <button
                  type="button"
                  onClick={() => jump(w)}
                  aria-label={tr(lang, k)}
                  title={`${tr(lang, k)} · ${kbd}`}
                  className="w-14 h-10 rounded-lg bg-gradient-to-b from-white to-[#eef1f7] border border-[#c9d1de] border-b-[3px] border-b-[#a9b4c6] text-[#011f43] flex flex-col items-center justify-center leading-none cursor-pointer hover:from-[#f6f8fc] hover:to-[#e3e9f3] active:border-b active:translate-y-[2px] transition"
                >
                  <Icon className="w-4 h-4" aria-hidden />
                  <span className="text-[9px] font-bold tracking-wide text-[#5c6170] mt-0.5">{cap}</span>
                </button>
              );
              return (
                <>
                  <Key w="first" Icon={ChevronUp} k="rdFirst" kbd="Alt+↑ / Alt+Home" cap="HOME" />
                  <div className="flex gap-1">
                    <Key w="prev" Icon={ChevronLeft} k="rdPrev" kbd="Alt+←" cap="PREV" />
                    <Key w="last" Icon={ChevronDown} k="rdLast" kbd="Alt+↓ / Alt+End" cap="END" />
                    <Key w="next" Icon={ChevronRight} k="rdNext" kbd="Alt+→" cap="NEXT" />
                  </div>
                </>
              );
            })()}
          </div>
          <div className="h-1.5 bg-[#eef0f7] rounded-full overflow-hidden my-2.5">
            <div className="h-full bg-[#2f3f8f] transition-all" style={{ width: `${pct}%` }} />
          </div>
          <div className="text-xs text-[#5c6170] max-h-14 overflow-hidden">
            {state !== 'idle' && parts[idx] ? parts[idx] : tr(lang, 'readSel')}
          </div>
          <div className="flex items-center gap-2 mt-2.5">
            <span className="text-xs text-[#5c6170]">{tr(lang, 'speed')}</span>
            <select
              value={rate}
              onChange={(e) => {
                const r = Number(e.target.value);
                setRate(r);
                try {
                  localStorage.setItem('ss_rate', String(r));
                } catch {
                  // ignore
                }
              }}
              className="border border-[#d9dbe1] rounded-md px-1.5 py-1 text-xs bg-white"
            >
              {[0.75, 1, 1.25, 1.5].map((r) => (
                <option key={r} value={r}>
                  {r}×
                </option>
              ))}
            </select>
            <select
              value={lang}
              onChange={(e) => onChangeLang(e.target.value as LangCode)}
              className="flex-1 border border-[#d9dbe1] rounded-md px-1.5 py-1 text-xs bg-white"
            >
              {LANGS.map((l) => (
                <option key={l.k} value={l.k}>
                  {l.n}
                </option>
              ))}
            </select>
          </div>
        </div>
      )}
    </div>
  );
}
