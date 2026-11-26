import { useState } from 'react';
import { api } from '../lib/api';
import { reverseSearchLinks } from '../lib/dupMatch';
import type { Asset } from '../types';

export interface DupMatch {
  id: string;
  kind: 'exact' | 'similar';
  score: number;
  mine: boolean;
  title: string;
  thumb: string;
  status?: string;
}

export type DupState = { state: 'idle' } | { state: 'checking' } | { state: 'done'; matches: DupMatch[] } | { state: 'error' };

const row = 'flex items-start gap-2 text-xs leading-snug';

/* Contributor side: shows layers 1-3 right after a photo is picked. */
export function UploadDupStatus({ dup }: { dup: DupState }) {
  if (dup.state === 'idle') return null;
  const exact = dup.state === 'done' ? dup.matches.filter((m) => m.kind === 'exact') : [];
  const similar = dup.state === 'done' ? dup.matches.filter((m) => m.kind === 'similar') : [];
  const label = (m: DupMatch) => (m.mine ? `aapki photo ${m.id}` : m.title ? `${m.id} "${m.title}"` : 'kisi aur contributor ki photo');
  return (
    <div className="bg-white border border-[#d9dbe1] rounded-xl p-3.5 space-y-2" aria-live="polite">
      <b className="block text-sm text-[#011f43]">Duplicate jaanch</b>
      {dup.state === 'checking' && <p className="text-xs text-[#5c6170] m-0">Jaanch ho rahi hai...</p>}
      {dup.state === 'error' && <p className="text-xs text-[#9a6700] m-0">Jaanch abhi nahi ho saki. Upload ke baad admin dekhega.</p>}
      {dup.state === 'done' && (
        <>
          <div className={row}>
            <span>{exact.length ? '⛔' : '✅'}</span>
            <span><b>1. Exact copy:</b> {exact.length ? `Ye photo pehle se hai (${label(exact[0])}). Upload band hai.` : 'Koi exact copy nahi mili.'}</span>
          </div>
          <div className={row}>
            <span>{similar.length ? '⚠️' : '✅'}</span>
            <span><b>2. Edited copy:</b> {similar.length ? `${similar[0].score}% milti-julti photo mili (${label(similar[0])}). Admin review me dikhega.` : 'Crop, filter ya resize wali copy nahi mili.'}</span>
          </div>
          <div className={row}>
            <span>🌐</span>
            <span><b>3. Internet:</b> Upload ke baad reverse image search se jaanch hogi.</span>
          </div>
        </>
      )}
    </div>
  );
}

/* Admin side: badges + internet reverse search for one photo in the review queue. */
export function AdminDupPanel({ asset, assets, onRefresh, toast }: { asset: Asset; assets: Asset[]; onRefresh: () => Promise<void>; toast: (m: string) => void }) {
  const [busy, setBusy] = useState(false);
  const pub = asset.prevUrl && !asset.prevUrl.startsWith('data:') ? new URL(asset.prevUrl, window.location.origin).href : '';
  const dups = asset.dup || [];
  async function runWeb() {
    setBusy(true);
    try {
      await api(`/api/assets/${encodeURIComponent(asset.id)}/web-check`, { method: 'POST' });
      await onRefresh();
      toast('Internet jaanch ho gayi');
    } catch (e) {
      toast((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className="mt-3 border border-[#e5e8ef] rounded-lg p-3 bg-[#fafbfd] space-y-1.5">
      <div className={row}>
        <span>{dups.some((d) => d.kind === 'exact') ? '⛔' : '✅'}</span>
        <span><b>Exact:</b> {dups.filter((d) => d.kind === 'exact').map((d) => d.id).join(', ') || 'nahi mila'}</span>
      </div>
      <div className={row}>
        <span>{dups.some((d) => d.kind === 'similar') ? '⚠️' : '✅'}</span>
        <span>
          <b>Edited:</b>{' '}
          {dups.filter((d) => d.kind === 'similar').length
            ? dups.filter((d) => d.kind === 'similar').map((d) => {
                const o = assets.find((x) => x.id === d.id);
                return `${d.id}${o ? ` "${o.title}" (${o.contributor})` : ''} ${d.score}%`;
              }).join(' · ')
            : asset.phash ? 'nahi mila' : 'fingerprint nahi (purani photo)'}
        </span>
      </div>
      <div className={row}>
        <span>{asset.web ? (asset.web.count ? '⚠️' : asset.web.error ? '❔' : '✅') : '🌐'}</span>
        <span>
          <b>Internet:</b>{' '}
          {asset.web
            ? asset.web.error
              ? `auto jaanch nahi hui (${asset.web.error})`
              : asset.web.count
                ? `${asset.web.count} website par mili`
                : 'kahin aur nahi mili'
            : 'auto jaanch abhi nahi hui'}
        </span>
      </div>
      {asset.web?.links?.length ? (
        <ul className="m-0 pl-6 text-xs space-y-0.5">
          {asset.web.links.map((l) => (
            <li key={l.url}><a href={l.url} target="_blank" rel="noopener noreferrer" className="text-[#2f3f8f] underline break-all">{l.source || l.title}</a></li>
          ))}
        </ul>
      ) : null}
      <div className="flex flex-wrap gap-1.5 pt-1">
        {pub ? (
          reverseSearchLinks(pub).map((l) => (
            <a key={l.name} href={l.url} target="_blank" rel="noopener noreferrer" className="px-2.5 py-1 rounded border border-[#d9dbe1] bg-white text-[11px] font-bold text-[#011f43]">{l.name}</a>
          ))
        ) : (
          <span className="text-[11px] text-[#5c6170]">Reverse search ke liye KV ya R2 chalu karein (photo ka public link chahiye).</span>
        )}
        {pub && (
          <button type="button" disabled={busy} onClick={runWeb} className="px-2.5 py-1 rounded bg-[#011f43] text-white text-[11px] font-bold cursor-pointer disabled:opacity-50">
            {busy ? 'Jaanch...' : 'Auto internet check'}
          </button>
        )}
      </div>
    </div>
  );
}
