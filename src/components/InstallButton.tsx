import { useEffect, useState } from 'react';
import { Download, X } from 'lucide-react';
import { canPrompt, isIOS, isStandalone, onInstallChange, promptInstall } from '../lib/pwa';

/** Header icon: installs SantalStock as an app. Hidden once the app is installed. */
export function InstallButton({ toast }: { toast?: (m: string) => void }) {
  const [, force] = useState(0);
  const [help, setHelp] = useState(false);
  useEffect(() => onInstallChange(() => force((n) => n + 1)), []);
  if (isStandalone()) return null;

  async function click() {
    if (canPrompt()) {
      const r = await promptInstall();
      if (r === 'accepted') toast?.('SantalStock app install ho raha hai ✓');
      return;
    }
    setHelp(true);
  }

  const ios = isIOS();
  return (
    <>
      <button
        type="button"
        onClick={click}
        aria-label="Install app"
        data-tip="App install karein"
        className="hdr-tip flex items-center text-[#13203a] cursor-pointer bg-transparent border-0 p-0 group"
      >
        <span className="w-9 h-9 sm:w-10 sm:h-10 xl:w-11 xl:h-11 rounded-full bg-[#e8f6f3] text-[#0f766e] ring-1 ring-[#0f766e]/25 flex items-center justify-center shrink-0 transition-transform group-hover:-translate-y-0.5">
          <Download className="w-[18px] h-[18px]" />
        </span>
      </button>
      {help && (
        <div className="fixed inset-0 z-[300] bg-black/40 flex items-end sm:items-center justify-center p-3" onClick={() => setHelp(false)}>
          <div className="w-full max-w-sm bg-white rounded-2xl p-5 shadow-xl" onClick={(e) => e.stopPropagation()} role="dialog" aria-label="Install SantalStock">
            <div className="flex items-start justify-between gap-3 mb-3">
              <div className="flex items-center gap-3">
                <img src="/icon-192.png" alt="" className="w-11 h-11 rounded-xl" />
                <div>
                  <b className="block text-[#011f43]">SantalStock app</b>
                  <span className="text-xs text-[#5c6170]">Home screen se ek tap me kholiye</span>
                </div>
              </div>
              <button type="button" onClick={() => setHelp(false)} aria-label="Close" className="p-1 bg-transparent border-0 cursor-pointer text-[#5c6170]"><X className="w-5 h-5" /></button>
            </div>
            {ios ? (
              <ol className="m-0 pl-5 text-sm text-[#2b3242] space-y-1.5">
                <li>Safari me niche <b>Share</b> (⬆️ wala box) dabaiye.</li>
                <li><b>Add to Home Screen</b> chuniye.</li>
                <li>Upar <b>Add</b> dabaiye.</li>
              </ol>
            ) : (
              <ol className="m-0 pl-5 text-sm text-[#2b3242] space-y-1.5">
                <li>Browser ka menu (<b>⋮</b> ya <b>⋯</b>) kholiye.</li>
                <li><b>Install app</b> ya <b>Add to Home screen</b> chuniye.</li>
                <li>Chrome, Edge, Samsung Internet me sabse achha chalta hai.</li>
              </ol>
            )}
          </div>
        </div>
      )}
    </>
  );
}
