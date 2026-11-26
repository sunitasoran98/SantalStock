import React, { useEffect, useMemo, useRef, useState } from 'react';

/** Text box + full dropdown list. Pick from the list or type your own (editable). */
export default function ComboBox({
  value,
  onChange,
  options,
  placeholder,
  required,
  maxLength,
  id,
}: {
  value: string;
  onChange: (v: string) => void;
  options: string[];
  placeholder?: string;
  required?: boolean;
  maxLength?: number;
  id?: string;
}) {
  const [open, setOpen] = useState(false);
  const [typed, setTyped] = useState(false);
  const box = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const close = (e: MouseEvent) => {
      if (box.current && !box.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', close);
    return () => document.removeEventListener('mousedown', close);
  }, []);
  const list = useMemo(() => {
    const uniq = Array.from(new Set(options.map((o) => o.trim()).filter(Boolean)));
    const q = value.trim().toLowerCase();
    // While typing, show matches first; when opened with ▾, show the whole list.
    if (!typed || !q) return uniq;
    const hit = uniq.filter((o) => o.toLowerCase().includes(q));
    return hit.length ? hit : uniq;
  }, [options, value, typed]);

  return (
    <div ref={box} className="relative">
      <input
        id={id}
        required={required}
        maxLength={maxLength}
        value={value}
        placeholder={placeholder}
        autoComplete="off"
        onChange={(e) => {
          onChange(e.target.value);
          setTyped(true);
          setOpen(true);
        }}
        onFocus={() => {
          setTyped(false);
          setOpen(true);
        }}
        onKeyDown={(e) => e.key === 'Escape' && setOpen(false)}
        className="w-full pl-3 pr-9 py-2 border border-[#d9dbe1] rounded-lg bg-white text-sm"
      />
      <button
        type="button"
        aria-label="Show list"
        onClick={() => {
          setTyped(false);
          setOpen((o) => !o);
        }}
        className="absolute right-1 top-1/2 -translate-y-1/2 w-7 h-7 rounded-md text-[#011f43] bg-transparent border-0 cursor-pointer text-xs"
      >
        ▾
      </button>
      {open && list.length > 0 && (
        <ul className="absolute z-50 left-0 right-0 mt-1 max-h-64 overflow-auto bg-white border border-[#d9dbe1] rounded-lg shadow-lg list-none m-0 p-1">
          {list.map((o) => (
            <li key={o}>
              <button
                type="button"
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => {
                  onChange(o);
                  setOpen(false);
                }}
                className={`w-full text-left px-2.5 py-1.5 rounded-md text-sm border-0 cursor-pointer ${o === value ? 'bg-[#eef0f7] font-semibold' : 'bg-transparent hover:bg-[#f4f6fb]'}`}
              >
                {o}
              </button>
            </li>
          ))}
          <li className="px-2.5 py-1 text-[11px] text-[#5c6170]">List me nahi hai? Upar khud likh dijiye.</li>
        </ul>
      )}
    </div>
  );
}
