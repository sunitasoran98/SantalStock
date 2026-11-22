import React, { useEffect, useRef, useState } from 'react';
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

    const u = new SpeechSynthesisUtterance(partsRef.current[idxRef.current]);
    if (voice) {
      u.voice = voice;
      u.lang = voice.lang;
    } else {
      u.lang = want;
    }
    u.rate = rateRef.current;
    u.onend = () => {
      idxRef.current += 1;
      setIdx(idxRef.current);
      speakNext();
    };
    u.onerror = () => {
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

  const pct = parts.length ? Math.round((idx / parts.length) * 100) : 0;

  return (
    <div className="noprint">
      <button
        type="button"
        aria-label={tr(lang, 'reader')}
        title={tr(lang, 'reader')}
        onClick={() => setOpen((o) => !o)}
        className="fixed right-4 bottom-4 z-40 w-14 h-14 rounded-full bg-[#d6262f] text-white text-2xl shadow-lg flex items-center justify-center cursor-pointer hover:scale-105 transition-transform"
      >
        {state === 'play' ? '🔊' : '🗣️'}
      </button>

      {open && (
        <div className="fixed right-4 bottom-20 z-40 bg-white border border-[#d9dbe1] rounded-2xl shadow-xl p-3.5 w-[300px] max-w-[calc(100vw-32px)]">
          <div className="flex items-center justify-between mb-2">
            <h4 className="m-0 font-bold text-sm text-[#011f43]">🗣️ {tr(lang, 'reader')}</h4>
            <button
              type="button"
              onClick={() => setOpen(false)}
              className="px-2 py-0.5 rounded-md border border-[#d9dbe1] bg-white text-[#011f43] text-xs cursor-pointer"
            >
              ✕
            </button>
          </div>
          <div className="flex gap-2">
            {state === 'play' ? (
              <button
                type="button"
                onClick={pause}
                className="flex-1 py-1.5 px-2.5 rounded-lg bg-[#011f43] text-white text-xs font-semibold cursor-pointer"
              >
                ⏸ {tr(lang, 'pause')}
              </button>
            ) : (
              <button
                type="button"
                onClick={() => startReading()}
                className="flex-1 py-1.5 px-2.5 rounded-lg bg-[#011f43] text-white text-xs font-semibold cursor-pointer"
              >
                ▶ {state === 'paused' ? tr(lang, 'resume') : tr(lang, 'readPage')}
              </button>
            )}
            <button
              type="button"
              onClick={stop}
              className="flex-1 py-1.5 px-2.5 rounded-lg border border-[#d9dbe1] bg-white text-[#011f43] text-xs font-semibold cursor-pointer"
            >
              ⏹ {tr(lang, 'stop')}
            </button>
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
